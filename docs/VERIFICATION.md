# Verification

Tested on October 16, 2026, in Ubuntu 26.04.1 / WSL2 on an Intel i9-13900K and NVIDIA RTX 3060 Ti host. Playwright 1.63 supplies Chromium, Firefox and WebKit. All automated browsers were headless. The only local server used port 49173 and bound to loopback.

## Evidence

| Check | Scope and result |
|---|---|
| `npm test` | 23 passing DOM-free tests using the actual vendored engine. Combat windows/resources, collisions, parries, posture, healing interruption, death/recovery, rest, quest, weapons, projectiles, echo, boss phases, full AI journey, five repeat journeys, save corruption, proving ground, cross-level travel and generic story effects. |
| `npm run build` | Modular static site plus one self-contained HTML; engine and game licenses included. No runtime downloads. |
| `npm run test:browser` | Chromium, WebKit and Firefox. Keyboard movement/combat, rest, map, pause, Continue, real ten-second idle trigger, two complete demo cycles per browser, byte-for-byte campaign-save isolation, simulated standard gamepad input and keyboard/mouse/stick interruptions. |
| `npm run test:experience` | Live DOM interactions: spending upgrade currency, equipping both weapons, death screen, respawn/recovery, actual page reload persistence, ending, postgame movement and proving-ground isolation. A real Web Audio analyser observed a nonzero unclipped signal. A WebKit iPhone profile verified spectator-only presentation, the menu, settings and touch interruption. |
| `viewport-matrix` | 24 clean screenshots: six phone/foldable profiles, three tablets and five desktop sizes in three engines. No horizontal overflow, page errors, console errors or failed requests. Representative phone, tablet, 4:3, 16:9 and ultrawide PNGs were visually inspected, as were the title, gameplay, boss, rest, map, ending and phone menu. |

Browser test images live outside the repository in `/tmp/goner-browser-qa`, `/tmp/goner-experience` and `/tmp/goner-viewport-matrix`. A small curated selection is in `docs/images`. Machine-readable summaries are in `docs/evidence`.

## Frame-rate gate

`npm run bench` counts actual rendered scene frames over eight seconds after warmup, at **1920×1080**, sequentially for each browser and each scene. The requirement is an average of at least 25 FPS per measured scene. The visible game overlay reports actual engine FPS and inter-frame milliseconds, not a fabricated fixed value.

| Browser | Title | Exploration | Boss |
|---|---:|---:|---:|
| Chromium | 60 FPS | 59.4 FPS | 60 FPS |
| Webkit | 47.9 FPS | 30.1 FPS | 35.2 FPS |
| Firefox | 60 FPS | 59.9 FPS | 60.1 FPS |

This is a Canvas 2D workload on the requested host, with software-backed compositing surfaces and CSS pixel scaling. It is not an isolated RTX shader-throughput benchmark. Browser startup and first-time world baking are excluded from the steady-state sample. Other agents were also using the machine; no other project’s processes were stopped.

## Issues caught and repaired

- Engine grid coordinate helpers return arrays, not `{cx, cy}` objects. Corrected navigation and projectile collision callers.
- Dollar-sign patterns in embedded engine source were being interpreted by JavaScript string replacement. The standalone builder now uses callbacks.
- Default Canvas backing caused expensive WebKit sprite readbacks. All 2D surfaces now request the software-friendly context hint; static scenery is cached and native-resolution presentation avoids a second large rasterization.
- WebKit reports zero `movementX/Y` for some real pointer motion. All pointer activity now interrupts attract mode.
- Reloading from the title could save its decorative empty simulation over the campaign. Writes are now restricted to live campaign play; a real reload regression test proves upgraded equipment and death history survive.
- Returning from the ending now restores exploration; mobile menu activation waits for its click rather than inserting a modal in the middle of a touch gesture.
- Gamepad tests wait for actual polling transitions, and combat tests wait for actual recovery states, instead of assuming a fixed number of wall-clock milliseconds has advanced the simulation on every browser.

## Exact verification limits

- The controller tests inject the browser’s standard gamepad API, including DualSense touchpad button 17 and Create fallback 8. No physical DualSense was attached during verification; physical haptics and transport were not measured.
- WebKit device profiles exercise Safari’s engine and mobile layouts. They are not tests on a physical iPhone or macOS Safari.
- The host’s PulseAudio endpoint stalled even `pactl info`. WebKit automation uses process-local GStreamer sink selection (`pulsesink:NONE,alsasink:NONE,oss4sink:NONE,jacksink:NONE`) to keep real Web Audio running through an automatic silent sink. The shipped game does not disable or replace audio. Chromium signal analysis proves synthesis, not the user’s speaker output.
- End-screen and individual equipment tests use explicit fixtures to isolate those interfaces. Full boss combat and uninterrupted whole journeys are independently exercised by the simulation and attract browser suites.

No live online service or secret is needed to play. Saves stay in the browser’s local storage and are origin-specific.
