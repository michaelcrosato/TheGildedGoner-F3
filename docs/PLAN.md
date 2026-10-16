# The Gilded Goner — delivery contract

Explore a ruined sanctuary, read and counter deliberate attacks, risk embers, open a return route, defeat the bellkeeper, and ring the dawn bell.

## Required slice

- One authored, decorated, interconnected sanctuary with two rests, two paths, a shortcut, optional equipment, NPC and environmental story, locked boss threshold, two-phase boss and ending.
- Stamina, attack chains, heavy guard breaks, dodge invulnerability, guard/perfect parry/riposte, lock-on/cycling, healing, ranged chime and unlockable echo companion.
- Death, dropped/recoverable embers, respawn and rest resets; persistent equipment, upgrades, checkpoints, gates, quest and victory; versioned safe saves.
- PS-compatible controller mapping, focus navigation, pause, journal/map, loadout, audio/comfort settings, contextual hints, keyboard/mouse equivalents.
- Title idles into actual autonomous play after ten seconds; all physical input interrupts to title; bot loops without touching a player's save. Small touch devices are display-only demo with menu access.
- Procedural art/animation/audio, telegraph clarity, impact feedback, performance overlay and a measured 25-FPS minimum target. Hardware measurements must name the tested environment honestly.
- Extensible, data-driven content, a proving ground, deterministic tests, browser/controller/viewport checks, build, CI, public GitHub repository and handoff documentation.

## Verification order

1. Node simulation tests, including full AI route, death/recovery and boss mechanics.
2. Headless browser via file URL when possible.
3. One owned local server on port 49173 for browser features requiring HTTP and the viewport matrix.
4. Inspect generated images, record actual limitations, then commit and publish the repository.

No mobile controls. No copied Elden Ring assets, names, music or map layouts. All art and sound are procedural; engine license retained.
