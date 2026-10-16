# Engine evaluation — my-3d2dge 0.46.1

This evaluates the engine integration, separately from the source reference in the README and HTML.

## What the game actually uses

The complete upstream `engine/my-3d2dge.js` is vendored at `vendor/my-3d2dge.js`, with the small Canvas context patch documented below. The pin is `cfa866aa45474868350cad1a7fc015e612f9305f`. It is not a placeholder dependency: all walking bodies, collisions, melee timing, flow-field navigation, rendering/projection, skeletal characters, animation poses, particles, input polling, audio synthesis and fixed-step execution use it.

| Engine primitive | Game responsibility |
|---|---|
| `Game`, 1/120-second fixed step, `advance` | Live play and deterministic browser test execution |
| `View`, depth-sorted `Renderer`, `px` | Isometric world, bespoke arches/tree/bell, translucent cues |
| `TileMap`, floor textures, wall types | Authored floor plan, collision, closed/open gates, navigation topology |
| `Body` | Player and enemy locomotion against the same collision map |
| `Attack`, named moves | Wind-up/active/recovery, once-per-swing hit sets, animation states |
| `FlowField` | Enemy pursuit around walls |
| `Humanoid` | Dressed player, four enemies, boss, NPC and echo; procedural animation |
| `Input` | Keyboard, mouse, standard-mapped gamepads, dead zones and vibration |
| `Particles`, `Audio` | Hit sparks, damage numbers, ash, item feedback, synthesized sound/music |

## Game-side extensions

`Simulation` adds stamina, directional blocking and parry windows, posture/ripostes, dodge invulnerability, limited delayed healing, weapons, a resource-powered projectile spell, an expiring ally, enemy decisions, two-phase boss patterns, expanding-ring hazards, death/recovery, rest resets, permanent upgrades, quest flags and an ending.

The DOM shell replaces the engine’s default presentation to meet the requested ten-foot navigation model. It still uses engine input polling; it supplies game-specific focus navigation, pause/focus-loss/controller-loss behavior, settings, a journal/map, save boundaries and the attract lifecycle. No mobile stick or action buttons are created.

The standalone build preserves the engine’s one-file handoff advantage while the development sources remain modular. The build escapes script endings and uses callback replacements, so literal dollar-sign replacement patterns in upstream code are preserved.

## Integration findings

- `TileMap.toCell()` and `.center()` return arrays. The prose API discusses cell objects elsewhere; callers must not assume `.cx/.cy`. Tests caught this during initial pathfinding integration.
- Engine props and rigs provide a credible retro base quickly. A distinctive scene still needs authored silhouettes, coherent color, world decoration and readable interface typography.
- Canvas 2D avoids WebGL availability as a game requirement. Its performance depends substantially on the CPU, buffer size, actor count and frame pacing. GPU model alone is not a sufficient performance measurement.
- The fixed-step/no-DOM design made complete gameplay tests fast enough to run before any browser work.
- Cosmetic particles and sound are deliberately outside the deterministic gameplay state; tests compare progression, actor positions, combat and outcomes, rather than particle randomness.

## Local engine patch

All 2D context creation requests `{ willReadFrequently: true }`. WebKit on this WSL host spent roughly 123 ms per frame in sprite compositing with its default backing path; asking for CPU-backed surfaces reduced an observed frame to 14 ms and raised the sampled frame rate from 6 to 36 FPS. This preserves outlines, rim light and occlusion silhouettes instead of removing them. The context hint is advisory and is ignored safely by implementations that do not support it.

The optional `nativePixels: true` presentation path keeps the visible canvas at the game buffer’s resolution and lets pixelated CSS scaling fill the screen. It avoids a second multi-megapixel Canvas rasterization, while retaining the same world buffer and all game detail. `clientToScreen` maps through the actual CSS rectangle for this mode. It is intended for `expand: true` games. Game-side static arch/tree stamps additionally avoid repeating procedural geometry. Final benchmark results are in VERIFICATION.md.

## Upgrade procedure

Read the new engine changelog; copy its readable engine and license; update the pinned version in README, HTML, build metadata and the version test. Run simulation tests, then browser/controller checks and performance measurements. Do not silently pull a moving upstream branch at runtime.
