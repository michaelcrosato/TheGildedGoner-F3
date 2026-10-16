# Architecture and expansion guide

## Boundaries

```text
content.js ── level / enemy / weapon data
     ↓
simulation.js ← player intents OR AttractPilot
     ↓ events                 ↓ state
main.js (lifecycle, DOM, save)  render.js (engine world + rigs)
     ↓
persistence.js → versioned localStorage

vendor/my-3d2dge.js supplies the fixed-step clock, bodies, map,
combat timing, navigation, projection, drawing, animation, input and audio.
```

The simulation has no DOM, timers, storage, rendering or audio. Run it in Node by importing the engine and calling `sim.update(1/120, intent)`. The live game executes the same function through `E.Game`. The AI only produces intents. `snapshot()` exposes a reproducible state for tests.

`main.js` owns the title/play/demo modes and modal menus. A modal freezes the gameplay simulation while the engine continues polling input and painting. A death is a simulation state with a timed respawn; victory emits a durable progression flag. Returning from the ending enables free exploration. Focus loss, visibility loss and controller disconnection pause live play.

## An intent

```js
{
  x: -1, y: 0,           // normalized WORLD direction, not screen pixels
  attack: false, heavy: false, dodge: false,
  guard: false, sprint: false,
  heal: false, spell: false, summon: false,
  interact: false, lock: false, cycle: false
}
```

Screen-relative movement is converted with `game.view.screenDirToGround`. One-shot actions use engine pressed/buffered input. The same action names work from a gamepad, keyboard, mouse, test harness or bot. Movement never trusts input magnitude above one.

## Combat invariants

- `Body` positions and ranges use world units; one tile is 16. `z` is up.
- `Attack` owns wind-up, active and recovery phases and its once-per-swing hit set.
- A sword hit needs range, facing arc and line of sight. Enemies lock their attack facing halfway through the wind-up; their final telegraph is truthful.
- Resources are spent before actions start. Empty stamina cannot produce another attack or dodge.
- Guard only covers the forward hemisphere. Its initial 230 ms can parry; later hits cost stamina and chip health. A guard cannot stop a ring hazard.
- Posture breaks provide a clear kneeling recovery window. Heavy attacks exploit it; the same rules cover regular enemies and Aurel.
- Healing consumes a charge on start, restores health later, and can be interrupted by damage.
- Death replaces the previous ember drop, resets unspent currency and respawns at the selected rest. Permanent upgrades and quest flags remain.
- Rest recreates ordinary enemies, refills resources and clears transient hazards/echoes. Defeated bosses stay defeated.

## Add a level with content

Copy the shape of `TRIAL` or `SANCTUM` into `content.js`, then add it to `LEVELS`. A level has `id`, `name`, `width`, `height`, `rooms`, `start`, `checkpoints`, `gates`, `enemies`, `objects` and `obstacles`. Empty optional collections should be `[]`.

Rooms carve walkable rectangles; the map builder surrounds them with low masonry and blocks the void. Overlap room rectangles to connect them. Gates list the exact cells they close. `point(tileX, tileY)` places an entity at a cell center.

```js
const nextChapter = {
  id: 'reed-abbey', name: 'The Reed Abbey', width: 30, height: 28,
  rooms: [{ id: 'hall', name: 'Hall of Rain', x: 2, y: 2, w: 26, h: 24, floor: 'stone' }],
  start: point(15, 23),
  checkpoints: [{ id: 'reed-rest', name: 'Reed Rest', ...point(15, 23) }],
  gates: [], obstacles: [],
  enemies: [{ id: 'abbey-lancer', type: 'lancer', ...point(15, 14) }],
  objects: [
    { id: 'reed-memory', type: 'story', name: 'A voice in the rain',
      ...point(8, 12), once: true, lines: ['The bell reaches even here.'],
      gainItems: ['reed-token'], grantEmbers: 40, setFlags: ['heard-reed'] },
    { id: 'return', type: 'exit', name: 'Return to the sanctuary',
      ...point(15, 25), destination: 'bellwether' }
  ],
  props: [{ name: 'brazier', ...point(12, 23), size: 1.5 }],
  landmarks: [{ type: 'arch', ...point(15, 6), width: 90, height: 100 }],
  objectives: [{ text: 'Listen to the voice in the rain', until: 'heard-reed' }],
  demoRoute: [{ target: 'reed-memory', until: 'heard-reed' }]
};
LEVELS[nextChapter.id] = nextChapter;
```

Add an `exit` object in the source level with `destination: 'reed-abbey'`. The simulation emits a `travel` event; the shell constructs the destination and its painter. No combat or rendering architecture needs to change. World-local checkpoint, gates, kills and dropped embers are stored in `progress.worlds`; equipment, upgrades and currency travel with the player. A test travels between the shipped level definitions and back through save validation to prove this boundary.

Generic `story` objects support `requires` (inventory items or flags), `lockedText`, `gainItems`, `setFlags`, `grantEmbers`, `lines`, and `once`. Existing sanctuary-specific interactions remain explicit readable game code. New story content can use the generic form. `props` accepts built-in engine props; `landmarks` accepts the game’s cached tree, arch and bell. `objectives` and `demoRoute` supply text and navigation goals for new chapters.

Add an enemy archetype to `ENEMIES`, or set an encounter’s `definition` to a full archetype object. The renderer selects silhouettes from type and boss/ranged flags. Add weapons to `WEAPONS` with damage, stamina, range and phase durations. New behavior classes can extend the existing enemy decision method without replacing the simulation loop.

## Saves

`TheGildedGoner-F3:save:v1` stores a validated schema. Unknown versions fail closed to a new journey; missing fields get defaults. Non-finite numeric values, invalid weapons and invalid checkpoints are rejected or normalized. Browser storage failure is caught and reported without stopping play. Settings have a separate key. Runtime state such as active attacks, particles and the echo is not saved; Continue restores a safe checkpoint.

Save on rest, progression, death, travel, boss defeat, pause/title transitions, page leave, and every 12 gameplay seconds. Attract and proving-ground sessions never call the campaign write boundary. Tests compare the stored save byte-for-byte across whole demo cycles.

## Attract lifecycle

The idle clock listens only to physical input, independently of simulation intent. Any key, mouse movement/button, touch, or gamepad button/axis exits the demo before an action is dispatched. The pilot uses grid paths, line of sight, enemy wind-ups, stamina, normal heals/spells and contextual interactions. It returns to the same content objectives after combat. Victory displays for six seconds, then creates a fresh simulation. A 240-second watchdog also creates a fresh demo if an unexpected content change causes a stall. Dead pilots use the normal respawn loop.

## Rendering and performance

The scene is a low-resolution isometric buffer with DOM typography for room-distance legibility. World props, walls and rigs are depth sorted. Player/enemy silhouettes remain visible through obstructing art. Cache static trees and arches as trimmed bitmaps; never re-rasterize their hundreds of leaves every frame. Keep cosmetic randomness outside simulation state.

The local engine patch requests CPU-backed Canvas 2D surfaces to avoid WebKit synchronization overhead. Keep it when upgrading until a measured comparison proves it unnecessary. The overlay reports actual engine FPS and inter-frame milliseconds; it is hidden in touch-only attract presentation. Economy mode reduces atmospheric particles. Benchmark after changes that add actors, alpha compositing or large world buffers.

## Useful entry points

- `npm test`: deterministic rules, complete bot journeys, campaign transitions and save safety.
- `npm run test:browser`: actual inputs and focus, cross-engine painting, controller API, persistence, kiosk lifecycle.
- `?qa`: read state and performance through `window.__GONER__`, stop/advance the engine, start modes. It is an explicit development query, absent from the normal page.
- `npm run build`: modular static site plus a one-file offline handoff.

Read `VERIFICATION.md` for exact measured coverage and physical-device limitations.
