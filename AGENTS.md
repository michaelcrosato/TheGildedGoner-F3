# Working on The Gilded Goner

Read README.md and docs/ARCHITECTURE.md. This is an original game built on the pinned my-3d2dge engine; preserve the source reference and engine license.

- Simulation rules belong in src/simulation.js and must run without the DOM.
- Add content in src/content.js. Keep rendering and particles out of combat decisions.
- Demo intentions follow player rules and never write a campaign save.
- Every UI must work with gamepad focus navigation. Touch is demo-only; do not add mobile controls.
- Run npm test before browser work, then npm run build and the focused browser checks appropriate to changes.
- Screenshots and browser reports belong in /tmp, not the repository. Only deliberately selected handoff images go in docs/images.
- Do not stop other projects’ servers or browsers. Use the owned localhost port 49173 or GONER_PORT.
- Test small phones, tablets, wide displays and WebKit for interface changes. Inspect screenshots. WebKit emulation is not a physical iPhone test.
- Do not claim a physical controller was tested when only the standard gamepad API was emulated.
