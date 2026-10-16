import { TITLE, ID, WEAPONS } from './content.js';
import { Simulation, AttractPilot, freshProgress } from './simulation.js';
import { WorldPainter } from './render.js';
import { SaveStore } from './persistence.js';

const E = globalThis.My3D2dge;
const $ = id => document.getElementById(id);
const mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/.test(navigator.userAgent);
document.body.classList.toggle('mobile', mobile);
let storage;
try { storage = localStorage; } catch { storage = { getItem() { return null; }, setItem() { throw Error('Storage unavailable'); } }; }
const store = new SaveStore(storage);
const savedSettings = store.settings();
const settings = { sound: savedSettings.sound !== false, music: savedSettings.music !== false, volume: [0, .3, .6, 1].includes(savedSettings.volume) ? savedSettings.volume : .6, motion: savedSettings.motion ?? !matchMedia('(prefers-reduced-motion: reduce)').matches, quality: savedSettings.quality === 'Economy' ? 'Economy' : 'Full', hints: savedSettings.hints !== false, symbols: savedSettings.symbols === 'Keyboard' ? 'Keyboard' : 'PlayStation' };
const bindings = {
  up: ['KeyW', 'ArrowUp', 'Pad12'], down: ['KeyS', 'ArrowDown', 'Pad13'], left: ['KeyA', 'ArrowLeft', 'Pad14'], right: ['KeyD', 'ArrowRight', 'Pad15'],
  attack: ['KeyJ', 'Mouse0', 'Pad5'], heavy: ['KeyK', 'Pad7'], dodge: ['Space', 'Pad1'], guard: ['KeyF', 'Mouse2', 'Pad4'],
  interact: ['KeyE', 'Pad3'], heal: ['KeyQ', 'Pad2'], spell: ['KeyC', 'Pad6'], summon: ['KeyR', 'Pad12'],
  sprint: ['ShiftLeft', 'ShiftRight', 'Pad10'], lock: ['Tab', 'Pad11'], cycle: ['KeyV', 'Pad15'],
  journal: ['KeyM', 'Pad17', 'Pad8'], gear: ['KeyI', 'Pad13'], pause: ['Escape', 'Pad9'],
  confirm: ['Enter', 'Pad0'], cancel: ['Escape', 'Backspace', 'Pad1']
};
const game = new E.Game({ canvas: 'screen', id: ID, view: 'iso', views: ['iso'], res: [640, 360], expand: true, nativePixels: true, input: bindings, menu: false, corner: false, fullscreen: false, autoPause: false, backGesture: false, bg: '#162925' });
game.cam.smooth = .14; game.settings.set('touch', 'off');
game.r.outline = '#1b2922'; game.r.rim = '#e4ca89'; game.r.rimAlpha = .23;
E.style.propSize = 1.15;
let sim, painter, pilot, mode = 'title', panelKind = null, panelReturn = null, lastInput = performance.now(), hudTick = 0, noticeUntil = 0, regionUntil = 0, demoEnd = 0, autosave = 0, suppressUntil = 0;
let dialog = null, dialogIndex = 0, menuRepeat = 0, lastPadDirection = 0, sessionStarted = false, demoCycles = 0;
const score = { bpm: 46, steps: 2, tracks: [
  { wave: 'sine', vol: .11, notes: 'D3 - - - A3 - - - F3 - - - E3 - - - | D3 - - - C3 - - - A2 - - - - - - -' },
  { wave: 'triangle', vol: .025, notes: 'D5 - . . . . A4 - | . . F5 - . . E5 - | D5 - . . C5 - . . | A4 - - - . . . .' }
] };

function persist() { if (mode === 'play' && sim && !sim.demo && !sim.trial) { if (!store.write(sim.save())) notify('Your browser cannot save here. This journey will last for this session.'); } }
function applySettings() {
  game.reduceMotion = !settings.motion; document.body.classList.toggle('reduced-motion', !settings.motion);
  game.audio.setVolume(settings.sound ? settings.volume : 0);
  if (sessionStarted) game.audio.music(settings.music && settings.sound ? score : null);
  store.saveSettings(settings);
}
function sound(name, options = {}) { if (settings.sound) game.audio.sfx(name, { vol: .28, ...options }); }
function notify(text, duration = 3) { $('notice').textContent = text; $('notice').classList.add('visible'); noticeUntil = game.real + duration; }
function rebuild(options = {}) { sim = new Simulation(E, options); painter = new WorldPainter(E, game, sim); pilot = options.demo ? new AttractPilot(sim) : null; game.particles.clear?.(); game.cam.bounds = null; game.cam.smooth = .14; }
function showTitle() {
  if (mode === 'play') persist();
  mode = 'title'; panelKind = null; $('overlay').hidden = true; $('title-screen').hidden = false; $('hud').hidden = true; $('demo-banner').hidden = true; $('death').hidden = true;
  $('region').classList.remove('visible'); $('notice').classList.remove('visible'); document.body.classList.remove('playing', 'demo', 'boss-active');
  rebuild(); sim.hero.x = 25.5 * 16; sim.hero.y = 43.4 * 16; sim.hero.facing = -1.5;
  lastInput = performance.now(); $('begin-label').textContent = store.load() ? 'Continue journey' : 'Begin journey';
  game.cam.offset = [Math.min(game.W * .22, 150), 30];
  focusFirst();
}
function start({ fresh = false, demo = false, trial = false } = {}) {
  rebuild({ progress: fresh || demo || trial ? freshProgress() : store.load() || freshProgress(), demo, trial });
  mode = demo ? 'demo' : 'play'; panelKind = null; sessionStarted = true; demoEnd = 0; autosave = 0;
  $('title-screen').hidden = true; $('overlay').hidden = true; $('hud').hidden = mobile; $('demo-banner').hidden = !demo || mobile;
  document.body.classList.add('playing'); document.body.classList.toggle('demo', demo);
  game.cam.offset = [0, 15]; game.cam.smooth = .14;
  if (!demo) applySettings();
  if (!demo && sim.progress.flags.includes('complete')) openPanel('victory');
  else if (!demo && !trial && !store.load()) notify('Find Iona by the golden rest. E / △ to speak.', 7);
  else if (trial) notify('A safe place to learn. Rest restores every opponent.', 6);
  if (!demo) persist();
}
function activeRoot() { return panelKind ? $('panel') : mode === 'title' ? $('title-actions') : null; }
function focusFirst() { requestAnimationFrame(() => activeRoot()?.querySelector('button:not(:disabled),a')?.focus({ preventScroll: true })); }
function row(label, action, detail = '') { return `<button class="row" data-action="${action}">${label}${detail ? `<span>${detail}</span>` : ''}</button>`; }
function back(label = 'Return', action = 'back') { return `<button class="back" data-action="${action}">○ / Esc &nbsp; ${label}</button>`; }
function heading(kicker, title) { return `<p class="eyebrow">${kicker}</p><h2 id="panel-title">${title}</h2>`; }
function controls() { return `<div class="controls">${[
  ['Move', 'Left stick', 'WASD'], ['Look / lock target', 'R3', 'Tab'], ['Light attack', 'R1', 'J / click'], ['Heavy attack', 'R2', 'K'], ['Guard / timed parry', 'L1', 'F / right-click'], ['Dodge', '○', 'Space'], ['Amber flask', '□', 'Q'], ['Speak / rest / open', '△', 'E'], ['Chime bolt', 'L2', 'C'], ['Call Iona’s echo', 'D-pad ↑', 'R'], ['Sprint', 'L3 held', 'Shift'], ['Change target', 'D-pad →', 'V'], ['Map & journal', 'Touchpad', 'M'], ['Equipment', 'D-pad ↓', 'I'], ['Pause', 'Options', 'Esc']
].map(([a,b,c])=>`<div><span>${a}</span><span><b>${b}</b> <small>${c}</small></span></div>`).join('')}</div>`; }
function mapSVG() {
  const level = sim.level, flags = sim.progress.flags;
  const rooms = level.rooms.map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.floor === 'grass' ? '#4d6447' : '#536153'}" stroke="#a0a074" stroke-width=".2"/>`).join('');
  const rests = level.checkpoints.map(c => `<path d="M${c.x/16} ${c.y/16-1.1}l1 1.1-1 1.1-1-1.1Z" fill="#edcf8d"/>`).join('');
  const gates = level.gates.map(g => `<path d="M${g.cells[0][0]} ${g.cells[0][1]+.5}h${g.cells.length}" stroke="${flags.includes(g.id) ? '#a3c6aa' : '#b6684c'}" stroke-width=".8"/>`).join('');
  return `<svg viewBox="0 0 ${level.width} ${level.height}" role="img" aria-label="Map of the sanctuary. Gold diamonds are rests. The white dot is your position.">${rooms}${rests}${gates}<circle cx="${sim.hero.x/16}" cy="${sim.hero.y/16}" r=".9" fill="#fff0c3" stroke="#1c3326" stroke-width=".3"/><text x="28" y="8" fill="#d2c48f" font-size="2" text-anchor="middle">♜</text></svg>`;
}
function objective() {
  const p = sim.progress;
  if (sim.level.objectives) return sim.level.objectives.find(o=>!o.until || !p.flags.includes(o.until))?.text || sim.level.name;
  if (sim.trial) return 'Practice your timing · Rest to reset the trial';
  if (p.flags.includes('boss')) return 'Ring the dawn bell';
  if (!p.inventory.includes('key')) return 'Find the clapper in the western garden';
  if (!p.inventory.includes('echo')) return 'Return to Iona · A voice for the journey';
  if (!p.flags.includes('seal')) return 'Take the northern road to the cathedral';
  return 'Defeat Aurel, the last bellkeeper';
}
function openPanel(kind, returnTo) {
  if (mode === 'demo') { showTitle(); }
  if (returnTo !== undefined) panelReturn = returnTo;
  else if (!panelKind) panelReturn = mode === 'title' ? 'title' : 'pause';
  panelKind = kind; $('overlay').hidden = false; $('notice').classList.remove('visible');
  let html = '';
  if (kind === 'pause') html = heading('TAKE A BREATH', 'A moment of quiet') + `<p>${sim.region || sim.level.name}</p>` + row('Continue journey', 'resume', '✕') + row('Map & journal', 'journal', 'Touchpad / M') + row('Arms & echoes', 'gear', 'D-pad ↓ / I') + row('Settings', 'settings') + row('Controls & combat', 'controls') + row('Save & return to title', 'quit') + `<p class="caption">Progress is saved automatically. Continue returns to your last rest.</p>`;
  if (kind === 'settings') html = heading('MAKE YOURSELF AT HOME', 'Settings') + row('Sound', 'setting-sound', settings.sound ? 'On' : 'Off') + row('Music', 'setting-music', settings.music ? 'On' : 'Off') + row('Volume', 'setting-volume', `${Math.round(settings.volume*100)}%`) + row('Motion & impact shake', 'setting-motion', settings.motion ? 'Full' : 'Reduced') + row('Atmospheric detail', 'setting-quality', settings.quality) + row('Combat prompts', 'setting-hints', settings.hints ? 'On' : 'Off') + row('Control prompts', 'setting-symbols', settings.symbols) + row('Full screen', 'fullscreen', document.fullscreenElement ? 'Leave' : 'Enter') + row('View controls', 'controls') + back();
  if (kind === 'controls') html = heading('PATIENCE IS A WEAPON', 'Learn the rhythm') + controls() + `<p class="caption">Guard just as a strike lands to parry. A kneeling enemy is vulnerable to a heavy riposte. Blue rings cannot be blocked: roll through them. Stamina returns when you stop attacking. Chime focus returns on kills and at rests.</p>` + back();
  if (kind === 'journal') html = heading('THE PATH REMEMBERS', 'Map & journal') + `<div class="map-layout">${mapSVG()}<div><h3>${objective()}</h3><p>West: the garden and its stolen voice.<br>East: a longer road, a longer blade.<br>North: the bell that swallowed the dawn.</p><div class="map-legend">◇ Gold · a place of rest<br>● White · your position<br>━ Rust · barred passage<br>━ Sage · opened shortcut</div></div></div><p class="caption">${sim.progress.inventory.includes('echo') ? 'Iona’s promise: “Even a goner needn’t go alone.”' : 'Iona waits near the first rest. Bring her the clapper from the western garden.'}</p>` + back('Continue journey', 'resume');
  if (kind === 'gear') html = heading('CARRY ONLY WHAT MATTERS', 'Arms & echoes') + row('Pilgrim’s blade', 'equip-sword', `${sim.progress.weapon === 'sword' ? 'EQUIPPED · ' : ''}Quick / ${23+sim.progress.temper*5} power`) + (sim.progress.inventory.includes('glaive') ? row('Vesper glaive', 'equip-glaive', `${sim.progress.weapon === 'glaive' ? 'EQUIPPED · ' : ''}Reach / ${32+sim.progress.temper*5} power`) : `<p>Another weapon sleeps in the Amber Cloister.</p>`) + `<h3>Voice of the sanctuary</h3><p>Chime bolt · L2 / C<br>${sim.progress.inventory.includes('echo') ? 'Iona’s echo · D-pad ↑ / R · fights beside you for 22 seconds.' : 'Bring the clapper to Iona to learn her echo.'}</p><div class="stat-line"><span>Vigor ${sim.progress.vigor}</span><span>Tempering ${sim.progress.temper}</span><span>${sim.maxFlasks} flasks</span></div>` + back('Continue journey', 'resume');
  if (kind === 'rest') html = heading('AN EMBER STILL BURNS', sim.level.checkpoints.find(c=>c.id===sim.progress.checkpoint)?.name || 'Pilgrim’s Rest') + `<p>Body, flasks, and focus restored. The fallen stir once more.</p><div class="stat-line"><span>✧ ${Math.floor(sim.progress.embers)} embers</span></div>` + row('Strengthen vigor', 'upgrade-vigor', sim.progress.vigor >= 3 ? 'Complete · 160 vitality' : `${70+sim.progress.vigor*50} embers · +20 vitality`) + row('Temper your blades', 'upgrade-temper', sim.progress.temper >= 3 ? 'Complete · +15 power' : `${70+sim.progress.temper*50} embers · +5 power`) + row('Arms & echoes', 'gear') + row('Leave the warmth', 'resume', '✕') + `<p class="caption">Permanent upgrades survive death. Unspent embers fall where you do.</p>`;
  if (kind === 'dialog') html = heading('A VOICE IN THE QUIET', dialog.title) + `<p class="lead">“${dialog.lines[dialogIndex]}”</p>` + row(dialogIndex < dialog.lines.length - 1 ? 'Listen' : 'Until we meet again', 'dialog-next', `${dialogIndex+1} / ${dialog.lines.length} · ✕`);
  if (kind === 'new') html = heading('A NEW PILGRIMAGE', 'Leave this journey behind?') + `<p>This replaces the saved journey in this browser.</p>` + row('Keep my journey', 'back') + row('Begin a new journey', 'fresh');
  if (kind === 'victory') html = heading('THE BELL REMEMBERS', 'A small dawn') + `<p class="lead">The first note is hardly a whisper.<br>Somewhere beyond the ruins, a bird answers.</p><p>You were never asked to mend the sun.<br>Only to remind it that someone was listening.</p><div class="stat-line"><span>${Math.floor((sim.progress.elapsed+sim.time)/60)}m ${Math.floor((sim.progress.elapsed+sim.time)%60)}s</span><span>${sim.progress.deaths} deaths</span><span>${sim.stats.parries} parries</span></div>` + row('Wander the quiet sanctuary', 'resume') + row('Enter the proving ground', 'trial') + row('Return to title', 'quit');
  if (kind === 'credits') html = heading('AN ORIGINAL ASHEN TALE', TITLE) + `<p class="lead">A deliberate little adventure about finding your voice at the end of the world.</p>` + row('Enter the proving ground', 'trial', 'Practice every combat system') + (store.load() ? row('Begin a new journey', 'new') : '') + `<div class="credits-grid"><p><b>Source reference</b><br>Initial date: October 16, 2026.<br>Inspiration: Elden Ring (2022). Original world, characters, art and music.<br>Engine: <a href="https://github.com/michaelcrosato/my-3d2dge" target="_blank" rel="noopener">my-3d2dge 0.46.1</a> · MIT license.<br>Environment: Ubuntu 26.04.1 / WSL2, Codex CLI, Node 22.23.3.<br>Lab / model: OpenAI, Codex based on GPT-6 (session identification). Reasoning effort is not exposed.</p><p><b>Craft</b><br>Procedural pixel art, skeletal animation and synthesized audio. No third-party game assets. The engine evaluation is documented separately in the repository.</p><a href="https://github.com/michaelcrosato/TheGildedGoner-F3" target="_blank" rel="noopener">Source code & development notes ↗</a></div>` + back();
  $('panel').innerHTML = html; focusFirst(); lastInput = performance.now(); sound('select', { vol: .12 });
}
function closePanel() { panelKind = null; $('overlay').hidden = true; if (mode === 'play' && sim.state === 'won') sim.state = 'playing'; lastInput = performance.now(); game.input.clear?.(); }
function action(name) {
  if (performance.now() < suppressUntil) return;
  lastInput = performance.now(); sound('confirm', { vol: .16 });
  if (name === 'begin') return start();
  if (name === 'fresh') return start({ fresh: true });
  if (name === 'demo') return start({ demo: true });
  if (name === 'trial') return start({ trial: true });
  if (name === 'resume') return closePanel();
  if (name === 'quit') return showTitle();
  if (name === 'back') { if (panelReturn && panelReturn !== 'title' && mode === 'play') return openPanel(panelReturn, 'title'); closePanel(); focusFirst(); return; }
  if (name === 'dialog-next') { if (++dialogIndex < dialog.lines.length) openPanel('dialog'); else closePanel(); return; }
  if (name === 'fullscreen') { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(()=>notify('Full screen is unavailable in this browser.')); return; }
  if (name.startsWith('setting-')) {
    const key = name.slice(8), focus = [...$('panel').querySelectorAll('button')].indexOf(document.activeElement);
    if (key === 'volume') settings.volume = [0,.3,.6,1][([0,.3,.6,1].indexOf(settings.volume)+1)%4];
    else if (key === 'quality') settings.quality = settings.quality === 'Full' ? 'Economy' : 'Full';
    else if (key === 'symbols') settings.symbols = settings.symbols === 'PlayStation' ? 'Keyboard' : 'PlayStation';
    else settings[key] = !settings[key];
    applySettings(); openPanel('settings'); requestAnimationFrame(()=>$('panel').querySelectorAll('button')[focus]?.focus()); return;
  }
  if (name.startsWith('upgrade-')) { sim.upgrade(name.slice(8)); handleEvents(); openPanel('rest'); return; }
  if (name.startsWith('equip-')) { sim.equip(name.slice(6)); persist(); openPanel('gear'); return; }
  if (['pause','settings','controls','journal','gear','credits','new'].includes(name)) openPanel(name);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b) action(b.dataset.action); });
$('menu-button').addEventListener('click', () => { if (mode === 'demo') showTitle(); openPanel(mode === 'play' ? 'pause' : 'settings', 'title'); });
// Physical activity is deliberately separate from game intents: the pilot cannot reset the idle clock.
function activity(e) {
  if (mode === 'demo') {
    const menuIntent = e.target.closest?.('#menu-button') && e.type !== 'pointermove';
    showTitle(); suppressUntil = performance.now() + 220;
    if (!menuIntent) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
  lastInput = performance.now();
  if ((panelKind || mode === 'title') && e.type === 'keydown' && ['Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
}
for (const type of ['keydown','pointerdown','pointermove','wheel','touchstart']) window.addEventListener(type, activity, { capture: true, passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => { if (mode === 'play' && !panelKind) { persist(); openPanel('pause'); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') { persist(); openPanel('pause'); } });
window.addEventListener('gamepaddisconnected', () => { if (mode === 'play') { persist(); openPanel('pause'); notify('Controller disconnected. Your journey is paused.'); } });
window.addEventListener('beforeunload', persist);

function handleEvents() {
  for (const e of sim.events.splice(0)) {
    const p = game.particles;
    if (e.type === 'travel') { rebuild({ progress: e.progress, demo: mode === 'demo', trial: sim.trial }); persist(); continue; }
    if (e.type === 'save') persist();
    if (e.type === 'region' && mode !== 'title') { $('region').textContent = e.name; $('region').classList.add('visible'); regionUntil = game.real + 3; }
    if (e.type === 'notice') notify(e.text);
    if (e.type === 'loot') { notify(`ACQUIRED · ${e.text}`, 4); sound('pickup'); p.glints(sim.hero.x, sim.hero.y, 12, 10, '#e7cf93'); }
    if (e.type === 'dialog' && mode === 'play') { dialog = e; dialogIndex = 0; openPanel('dialog'); }
    if (e.type === 'rest' && mode === 'play') openPanel('rest');
    if (e.type === 'swing') sound('swing', { pitch: e.heavy ? .6 : .9, vol: .16 });
    if (e.type === 'dodge') { sound('whoosh', { vol: .13 }); p.dust(sim.hero.x, sim.hero.y, 1, 4); }
    if (e.type === 'hit') {
      p.sparks(e.x, e.y, 20, 5); p.text(e.x, e.y, 30, `${e.damage}`, '#e8d7a6', { bounce: true }); sound('hit', { vol: .21, pitch: .7 });
      if (settings.motion) { game.freeze(.025); game.shake(1.4); }
      game.input.rumble?.(.13, 60);
    }
    if (e.type === 'kill') { p.bits(e.x, e.y, 12, 9, ['#8e865c','#b9a870','#d8c086']); sound('die', { vol: .15, pitch: .5 }); }
    if (e.type === 'hurt') { sound('hurt', { vol: .26, pitch: .7 }); if (settings.motion) { game.shake(2.5); game.freeze(.045); } game.input.rumble?.(.5, 120); }
    if (e.type === 'parry' || e.type === 'stagger') { p.sparks(e.x, e.y, 23, 13); p.ring(e.x, e.y, 3, 45, '#f4dfad', .4); sound('clang' === e.type ? 'bump' : 'charge', { vol: .2, pitch: 1.4 }); if (e.type === 'parry') notify('PERFECT PARRY', 1.3); }
    if (e.type === 'spell' || e.type === 'summon') sound('warp', { vol: .14, pitch: .6 });
    if (e.type === 'heal') { p.glints(e.x, e.y, 14, 12, '#ead69d'); sound('heal'); }
    if (e.type === 'gate') sound('door', { pitch: .5 });
    if (e.type === 'upgrade') sound('powerup');
    if (e.type === 'recovery') { notify(e.text); sound('pickup'); }
    if (e.type === 'phase') notify(e.text, 4);
    if (e.type === 'bossDefeated') { notify('A GREAT SILENCE LIFTED', 6); sound('oneup', { vol: .25, pitch: .5 }); }
    if (e.type === 'death') sound('die', { vol: .3, pitch: .4 });
    if (e.type === 'victory') { sound('secret', { vol: .3, pitch: .6 }); if (mode === 'play') openPanel('victory'); else { demoCycles++; demoEnd = game.real + 6; } }
  }
}
function menuInput(dt) {
  const root = activeRoot(); if (!root) return;
  const I = game.input, dir = I.down('down') ? 1 : I.down('up') ? -1 : 0;
  menuRepeat -= dt;
  if (dir && (dir !== lastPadDirection || menuRepeat <= 0)) {
    const buttons = [...root.querySelectorAll('button:not(:disabled),a')], index = buttons.indexOf(document.activeElement);
    buttons[(index + dir + buttons.length) % buttons.length]?.focus({ preventScroll: false });
    menuRepeat = dir !== lastPadDirection ? .32 : .14; sound('select', { vol: .08 });
  }
  lastPadDirection = dir;
  if (I.pressed('confirm')) document.activeElement?.click();
  if (I.pressed('cancel') && panelKind) { if (mode === 'play' && ['pause','gear','journal','rest','dialog'].includes(panelKind)) closePanel(); else action('back'); }
  if (panelKind === 'settings' && (I.pressed('left') || I.pressed('right'))) document.activeElement?.click();
}
function updateHUD() {
  const h = sim.hero, pad = settings.symbols === 'PlayStation' && game.input.lastDevice !== 'keyboard';
  $('hp-bar').style.width = `${h.hp/sim.maxHp*100}%`; $('focus-bar').style.width = `${h.focus}%`; $('stamina-bar').style.width = `${h.stamina}%`;
  $('hp-label').textContent = `${Math.ceil(h.hp)} / ${sim.maxHp}`; $('embers').textContent = Math.floor(sim.progress.embers).toLocaleString(); $('flasks').textContent = h.flasks;
  $('weapon-name').textContent = sim.weapon.name; $('flask-hint').textContent = `${pad?'□':'Q'} · Amber flask`;
  $('play-hints').innerHTML = settings.hints ? `<span><b>${pad?'R1':'J'}</b>Strike</span><span><b>${pad?'○':'Space'}</b>Evade</span><span><b>${pad?'L1':'F'}</b>Guard</span><span><b>${pad?'Options':'Esc'}</b>Menu</span>` : '';
  $('objective').textContent = objective();
  const c = sim.context(); $('interact').hidden = !c || !!panelKind || mode === 'title';
  if (c) $('interact').innerHTML = `<b>${pad?'△':'E'}</b> ${c.name}`;
  const boss = sim.enemies.find(e=>e.def.boss); $('boss').hidden = !sim.bossActive || !boss || boss.dead; document.body.classList.toggle('boss-active', !$('boss').hidden);
  if (boss) { $('boss-name').textContent = boss.phase === 2 ? 'AUREL, VOICE OF THE HOLLOW SUN' : boss.def.name; $('boss-bar').style.width = `${boss.hp/boss.maxHp*100}%`; }
  $('death').hidden = sim.state !== 'dead';
  $('performance').innerHTML = `${game.fps} <span>FPS</span> <i>·</i> ${game.stats.frameMs.toFixed(1)} ms`;
  $('performance').style.color = game.fps < 25 ? '#ecb58a' : '#c9d6b9';
}
showTitle(); applySettings();
game.start({ update(dt) {
  const I = game.input;
  const padActivity = I.lastDevice === 'gamepad' && (I.anyPressed() || Math.hypot(...I.padMove) > .2 || Math.hypot(...(I.padAim || [0,0])) > .2);
  if (padActivity) { lastInput = performance.now(); if (mode === 'demo') { showTitle(); suppressUntil = performance.now()+220; return; } }
  if (mode === 'title') {
    const idle = (performance.now()-lastInput)/1000; $('idle-label').textContent = `THE WORLD WAKES IN ${Math.max(0,Math.ceil(10-idle))}s`;
    if (!panelKind && (idle >= 10 || mobile && idle >= 1)) { start({ demo:true }); return; }
    if (panelKind && idle >= 10) { start({ demo:true }); return; }
    menuInput(dt); painter.update(dt); game.focus(sim.hero.x, sim.hero.y, 38);
  } else if (panelKind) menuInput(dt);
  else {
    if (mode === 'play' && (I.pressed('pause') || I.pressed('journal') || I.pressed('gear'))) { openPanel(I.pressed('journal') ? 'journal' : I.pressed('gear') ? 'gear' : 'pause'); return; }
    let intent;
    if (mode === 'demo') intent = pilot.update(dt);
    else {
      const move = I.move(), d = game.view.screenDirToGround(...move);
      // D-pad up/down remain discrete actions in play; only the left stick/WASD steer.
      const pad = I.lastDevice === 'gamepad';
      const v = pad && Math.hypot(...I.padMove) < .1 ? [0,0] : d;
      intent = { x: v[0], y: v[1], guard: I.down('guard'), sprint: I.down('sprint') };
      for (const key of ['attack','heavy','dodge','interact','heal','spell','summon','lock','cycle']) intent[key] = I.pressed(key);
      if (I.buffered('attack', .17) && !sim.hero.attack.busy) { intent.attack = true; I.consume('attack'); }
    }
    sim.update(dt, intent); handleEvents(); painter.update(dt);
    const target = sim.lock;
    game.focus(target ? sim.hero.x*.75+target.x*.25 : sim.hero.x, target ? sim.hero.y*.75+target.y*.25 : sim.hero.y, 24);
    if (mode === 'demo' && (demoEnd && game.real > demoEnd || sim.time > 240)) start({ demo: true });
    autosave += dt; if (autosave > 12) { persist(); autosave = 0; }
  }
  if (game.real > noticeUntil) $('notice').classList.remove('visible');
  if (game.real > regionUntil) $('region').classList.remove('visible');
  hudTick += dt; if (hudTick > .1) { updateHUD(); hudTick = 0; }
}, draw(r) { painter.draw(r, { title: mode === 'title', low: settings.quality === 'Economy' }); } });

game.debug = { snapshot: () => ({ mode, panel: panelKind, demo: sim.demo, demoCycles, saveAvailable: store.available, performance: { fps: game.fps, ...game.stats }, ...sim.snapshot() }) };
game.stateHash = () => [sim.hero.x, sim.hero.y, sim.hero.hp, sim.progress.embers, sim.state];
if (new URLSearchParams(location.search).has('qa')) globalThis.__GONER__ = { game, get sim(){return sim;}, get mode(){return mode;}, get panel(){return panelKind;}, get pilot(){return pilot;}, start, showTitle, action, openPanel, snapshot: game.debug.snapshot, settings, setIdle: seconds => { lastInput=performance.now()-seconds*1000; } };
globalThis.addEventListener('error', event => { $('boot-error').hidden = false; $('boot-error').textContent = `The sanctuary could not wake: ${event.message}. Reload to try again. Your saved journey is kept.`; });
