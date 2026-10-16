import { SANCTUM, TRIAL, LEVELS, ENEMIES, WEAPONS, TILE, LORE } from './content.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const direction = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const diff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const freshProgress = () => ({ version: 1, level: 'bellwether', worlds: {}, checkpoint: 'hearth', embers: 0, vigor: 0, temper: 0, weapon: 'sword', inventory: [], flags: [], kills: [], deaths: 0, elapsed: 0, dropped: null });

export function makeMap(E, level, progress) {
  const cells = Array.from({ length: level.height }, () => Array(level.width).fill(' '));
  for (const room of level.rooms) for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) cells[y][x] = room.floor === 'grass' ? ',' : room.floor === 'marble' ? '_' : '.';
  const floors = cells.map(row => [...row]);
  for (let y = 1; y < level.height - 1; y++) for (let x = 1; x < level.width - 1; x++) {
    if (floors[y][x] === ' ' && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => floors[y + dy][x + dx] !== ' ')) cells[y][x] = '#';
  }
  for (const [x, y] of level.obstacles) cells[y][x] = 'P';
  const stone = ['#3e4948', '#434d49', '#46514a'].map(E.hex);
  const map = new E.TileMap({
    rows: cells.map(row => row.join('')),
    legend: { ' ': { floor: 'void', block: true }, '.': { floor: 'stone' }, ',': { floor: 'grass' }, '_': { floor: 'marble' }, '#': 1, P: 3 },
    types: {
      1: { h: 14, top: '#667062', side: '#303c3b', line: '#273332', face: 'stone', roof: 'slab' },
      2: { h: 65, top: '#a28d57', side: '#615b43', face: 'none', roof: 'plain' },
      3: { h: 50, top: '#7c8068', side: '#4e5750', face: 'stone', roof: 'slab', cut: true, cutH: 18 }
    },
    floorTex(x, y, tag) {
      if (tag === 'void') return [19, 32, 33];
      if (tag === 'grass') return E.tex.grass(x, y, { base: '#414b38', dark: '#303e32', light: '#65704a' });
      return E.tex.flagstone(x, y, { stones: tag === 'marble' ? ['#596358', '#566057'].map(E.hex) : stone, mortar: E.hex('#2b3634'), hi: E.hex('#697366'), lo: E.hex('#35403c'), speck: E.hex('#7a7b5b') });
    }
  });
  for (const gate of level.gates) if (!progress.flags.includes(gate.id)) for (const [x, y] of gate.cells) map.set(x, y, 2);
  return { map, cells };
}

// Fixed-step, DOM-free game rules. The browser and the kiosk AI submit identical intents.
export class Simulation {
  constructor(E, { progress = freshProgress(), trial = false, demo = false, levels = LEVELS, level = null } = {}) {
    this.E = E; this.levels = levels; this.level = level || (trial ? TRIAL : levels[progress.level] || SANCTUM); this.demo = demo; this.trial = trial;
    this.progress = structuredClone({ ...freshProgress(), ...progress, level: this.level.id }); this.events = []; this.time = 0; this.state = 'playing'; this.deathTime = 0;
    this.stats = { attacks: 0, heavy: 0, dodges: 0, parries: 0, blocks: 0, heals: 0, casts: 0, summons: 0, kills: 0, damage: 0, recovered: 0 };
    const built = makeMap(E, this.level, this.progress); Object.assign(this, built);
    const spawn = this.level.checkpoints.find(c => c.id === this.progress.checkpoint) || this.level.start;
    this.hero = Object.assign(new E.Body({ ...spawn, r: 5 }), { facing: -Math.PI / 2, hp: this.maxHp, stamina: 100, focus: 100, flasks: this.maxFlasks, hurt: 0, invulnerable: 0, roll: 0, rollAngle: 0, guard: false, parry: 0, cooldown: 0, regenDelay: 0, heal: 0, cast: 0, chain: 0, lastAttack: -10 });
    this.hero.attack = new E.Attack('slash');
    this.enemies = this.level.enemies.map(spec => this.createEnemy(spec));
    this.projectiles = []; this.waves = []; this.echo = null; this.lock = null; this.region = ''; this.bossActive = false;
    this.flow = new E.FlowField(this.map); this.navClock = 0;
    if (trial) { this.progress.inventory.push('echo'); this.hero.flasks = 6; }
  }
  get maxHp() { return 100 + this.progress.vigor * 20; }
  get maxFlasks() { return this.progress.inventory.includes('flask') ? 4 : 3; }
  get weapon() { return WEAPONS[this.progress.weapon] || WEAPONS.sword; }
  emit(type, data = {}) { this.events.push({ type, ...data, time: this.time }); if (this.events.length > 150) this.events.shift(); }
  createEnemy(spec) {
    const def = spec.definition || ENEMIES[spec.type];
    return Object.assign(new this.E.Body({ x: spec.x, y: spec.y, r: def.boss ? 12 : 6 }), spec, {
      def, home: { x: spec.x, y: spec.y }, hp: def.hp, maxHp: def.hp, posture: def.posture,
      dead: !!def.boss && this.progress.flags.includes('boss'), deadTime: 0, facing: Math.PI / 2,
      attack: new this.E.Attack(def.move, { wind: def.wind, active: .2, recover: def.recover }),
      cooldown: 1, stun: 0, hurt: 0, phase: 1, pattern: 0, aggro: false, kind: 'melee'
    });
  }
  save() { return structuredClone({ ...this.progress, elapsed: this.progress.elapsed + this.time }); }
  nearby(radius = 120) { return this.enemies.filter(e => !e.dead && dist(e, this.hero) < radius).sort((a, b) => dist(a, this.hero) - dist(b, this.hero)); }
  target(cycle = false) {
    const all = this.nearby(180).filter(e => this.map.los(this.hero.x, this.hero.y, e.x, e.y));
    this.lock = cycle ? all[(all.indexOf(this.lock) + 1) % all.length] || null : this.lock ? null : all[0] || null;
  }
  spend(amount) { if (this.hero.stamina < amount) return false; this.hero.stamina -= amount; this.hero.regenDelay = .6; return true; }
  startAttack(heavy = false) {
    const h = this.hero, w = this.weapon;
    if (h.roll > 0 || h.hurt > .1 || h.heal > 0 || h.cast > 0 || h.cooldown > 0 || h.guard) return false;
    if (h.attack.busy && (h.attack.phase !== 'recover' || h.attack.u < .65)) return false;
    if (!this.spend(w.cost * (heavy ? 1.65 : 1))) return false;
    h.chain = this.time - h.lastAttack < 1.1 && !heavy ? (h.chain + 1) % 3 : 0;
    h.lastAttack = this.time;
    h.attack = new this.E.Attack(heavy ? 'overhead' : ['slash', 'backslash', 'thrust'][h.chain], { wind: w.wind * (heavy ? 2.2 : 1), active: w.active, recover: w.recover * (heavy ? 1.4 : 1) });
    h.heavy = heavy; h.attack.start();
    const target = this.lock || this.nearby(w.reach + 12)[0];
    if (target) h.facing = direction(h, target);
    this.stats.attacks++; if (heavy) this.stats.heavy++;
    this.emit('swing', { heavy }); return true;
  }
  dodge(mx, my) {
    const h = this.hero;
    if (h.roll || h.heal || h.cast || h.hurt > .12 || !this.spend(23)) return false;
    h.attack.cancel(); h.roll = .43; h.invulnerable = .32; h.rollAngle = Math.hypot(mx, my) > .1 ? Math.atan2(my, mx) : h.facing + Math.PI; h.guard = false;
    this.stats.dodges++; this.emit('dodge'); return true;
  }
  heal() {
    const h = this.hero;
    if (h.flasks <= 0 || h.hp >= this.maxHp || h.roll || h.heal || h.attack.busy || h.hurt || h.cast) return false;
    h.flasks--; h.heal = .85; h.healDone = false; this.stats.heals++; this.emit('drink'); return true;
  }
  spell(summon = false) {
    const h = this.hero, cost = summon ? 60 : 28;
    if (h.focus < cost || h.attack.busy || h.roll || h.heal || h.cast || h.hurt) return false;
    if (summon && (!this.progress.inventory.includes('echo') || this.echo)) { this.emit('notice', { text: 'Iona can teach you to call an echo.' }); return false; }
    h.focus -= cost; h.cast = .55;
    if (summon) { this.echo = { x: h.x - 18, y: h.y + 18, z: 0, facing: h.facing, life: 22, cooldown: .7 }; this.stats.summons++; this.emit('summon'); }
    else {
      const target = this.lock || this.nearby(220)[0], a = target ? direction(h, target) : h.facing;
      this.projectiles.push({ x: h.x, y: h.y, z: 15, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, team: 'hero', life: 2, damage: 34 + this.progress.temper * 4, r: 5 });
      h.facing = a; this.stats.casts++; this.emit('spell');
    }
    return true;
  }
  context() {
    const h = this.hero;
    if (this.progress.dropped && dist(h, this.progress.dropped) < 30) return { type: 'recover', name: `Recover ${this.progress.dropped.embers} embers`, ...this.progress.dropped };
    const objects = [
      ...this.level.checkpoints.map(o => ({ ...o, type: 'rest', name: `Rest at ${o.name}` })),
      ...this.level.objects.filter(o => !this.progress.flags.includes(o.id) || ['npc', 'lore', 'bell'].includes(o.type)),
      ...this.level.gates.filter(o => !this.progress.flags.includes(o.id)).map(o => ({ ...o, type: 'gate', name: o.label }))
    ];
    return objects.filter(o => dist(h, o) < 33 && (o.id !== 'bell' || this.progress.flags.includes('boss'))).sort((a, b) => dist(h, a) - dist(h, b))[0] || null;
  }
  interact() {
    const o = this.context(); if (!o || this.state !== 'playing') return;
    if (o.requires && !o.requires.every(id => this.progress.inventory.includes(id) || this.progress.flags.includes(id))) { this.emit('notice', { text: o.lockedText || 'Something is still missing.' }); return; }
    if (o.type === 'exit') { this.travel(o.destination); return; }
    if (o.type === 'story') {
      for (const item of o.gainItems || []) if (!this.progress.inventory.includes(item)) this.progress.inventory.push(item);
      for (const flag of o.setFlags || []) if (!this.progress.flags.includes(flag)) this.progress.flags.push(flag);
      this.progress.embers += o.grantEmbers || 0;
      if (o.once) this.progress.flags.push(o.id);
      if (o.lines) this.emit('dialog', { title: o.name, lines: o.lines });
      this.emit('save'); return;
    }
    if (o.type === 'recover') {
      this.progress.embers += o.embers; this.stats.recovered += o.embers; this.progress.dropped = null; this.emit('recovery', { text: 'EMBERS RECLAIMED' }); this.emit('save'); return;
    }
    if (o.type === 'rest') { if (this.nearby(85).some(e => e.aggro)) { this.emit('notice', { text: 'Find a moment of quiet before resting.' }); return; } this.rest(o.id); this.emit('rest', { name: o.name.replace('Rest at ', '') }); return; }
    if (o.type === 'gate') {
      if (o.id === 'shortcut' && this.hero.y > o.y + 7) { this.emit('notice', { text: 'Barred from the other side. Follow the western steps.' }); return; }
      if (o.id === 'seal' && !this.progress.inventory.includes('key')) { this.emit('notice', { text: 'A silent bell. Find its clapper in the Garden of Names.' }); return; }
      this.openGate(o.id); this.emit('notice', { text: o.id === 'shortcut' ? 'SHORTCUT OPENED' : 'The cathedral remembers your footsteps.' }); return;
    }
    if (o.type === 'npc') {
      if (this.progress.inventory.includes('key') && !this.progress.inventory.includes('echo')) {
        this.progress.inventory.push('echo'); this.emit('dialog', { title: 'Iona · keeper of names', lines: ['You found its voice. Aurel will hear it, too.', 'Take my echo. Even a goner needn’t go alone.', 'Call with D-pad ↑ / R. It will fight beside you for a little while.'] }); this.emit('save');
      } else this.emit('dialog', { title: 'Iona · keeper of names', lines: ['You have the look of a gilded goner. Good. We have enough heroes.', 'The bell’s clapper rests in the western garden. Bring it back, and I will lend you a voice.', 'Strike after their swing. Gold remembers the patient.'] });
      return;
    }
    if (o.type === 'lore') { this.emit('dialog', { title: 'Garden of Names', lines: LORE }); return; }
    if (o.type === 'bell') { this.state = 'won'; this.progress.flags.push('complete'); this.emit('victory'); this.emit('save'); return; }
    if (this.nearby(55).some(e => e.aggro)) { this.emit('notice', { text: 'Clear a little space first.' }); return; }
    this.progress.flags.push(o.id);
    if (o.item === 'embers') this.progress.embers += 90;
    else { if (!this.progress.inventory.includes(o.item)) this.progress.inventory.push(o.item); if (o.item === 'glaive') this.progress.weapon = 'glaive'; if (o.item === 'flask') this.hero.flasks++; }
    this.emit('loot', { text: o.name, item: o.item }); this.emit('save');
  }
  openGate(id) { const o = this.level.gates.find(g => g.id === id); if (!o) return; if (!this.progress.flags.includes(id)) this.progress.flags.push(id); for (const [x, y] of o.cells) this.map.set(x, y, 0); this.emit('gate', { id }); this.emit('save'); }
  travel(destination) {
    if (!this.levels[destination]) return false;
    const progress = this.save();
    progress.worlds[this.level.id] = { checkpoint: progress.checkpoint, flags: [...progress.flags], kills: [...progress.kills], dropped: progress.dropped };
    const local = progress.worlds[destination] || { checkpoint: this.levels[destination].checkpoints[0]?.id || 'hearth', flags: [], kills: [], dropped: null };
    Object.assign(progress, structuredClone(local), { level: destination });
    this.state = 'travel'; this.emit('travel', { progress }); return true;
  }
  rest(id) {
    this.progress.checkpoint = id; const h = this.hero;
    Object.assign(h, { hp: this.maxHp, stamina: 100, focus: 100, flasks: this.maxFlasks, hurt: 0, invulnerable: 1, roll: 0, heal: 0, cast: 0, guard: false }); h.attack.cancel();
    this.enemies = this.level.enemies.map(spec => this.createEnemy(spec)); this.projectiles = []; this.waves = []; this.echo = null; this.lock = null; this.bossActive = false;
    this.emit('save');
  }
  upgrade(type) {
    if (!['vigor', 'temper'].includes(type) || this.progress[type] >= 3) return false;
    if (this.context()?.type !== 'rest' || this.nearby(85).some(e=>e.aggro)) return false;
    const cost = 70 + this.progress[type] * 50;
    if (this.progress.embers < cost) { this.emit('notice', { text: `You need ${cost} embers.` }); return false; }
    this.progress.embers -= cost; this.progress[type]++; this.hero.hp = this.maxHp; this.emit('upgrade', { stat: type }); this.emit('save'); return true;
  }
  equip(id) { if (id === 'sword' || this.progress.inventory.includes(id) && WEAPONS[id]) { this.progress.weapon = id; this.emit('save'); } }
  damageEnemy(e, damage, posture, source = 'blade') {
    if (e.dead) return;
    if (e.def.guard && !e.stun && source === 'blade' && !this.hero.heavy && Math.abs(diff(direction(e, this.hero), e.facing)) < 1.3) { damage *= .22; posture *= .8; this.emit('clang', { x: e.x, y: e.y }); }
    e.hp -= damage; e.posture -= posture; e.hurt = .17; e.aggro = true;
    this.emit('hit', { x: e.x, y: e.y, damage: Math.round(damage), boss: e.def.boss });
    if (e.posture <= 0 && e.hp > 0) { e.stun = 2.1; e.posture = e.def.posture; e.attack.cancel(); this.emit('stagger', { x: e.x, y: e.y }); }
    if (e.hp <= 0) {
      e.dead = true; e.attack.cancel(); e.hp = 0; this.progress.embers += e.def.reward; this.stats.kills++;
      if (!this.progress.kills.includes(e.id)) this.progress.kills.push(e.id);
      this.hero.focus = Math.min(100, this.hero.focus + 9);
      this.emit('kill', { x: e.x, y: e.y, boss: e.def.boss, reward: e.def.reward });
      if (this.lock === e) this.lock = null;
      if (e.def.boss) { this.progress.flags.push('boss'); this.bossActive = false; this.emit('bossDefeated'); this.emit('save'); }
    }
  }
  damageHero(damage, enemy, unblockable = false) {
    const h = this.hero;
    if (h.invulnerable > 0 || this.state !== 'playing') return false;
    const facing = Math.abs(diff(direction(h, enemy), h.facing)) < 1.6;
    if (h.guard && facing && !unblockable) {
      if (h.parry > 0 && enemy.attack) {
        enemy.attack.cancel(); enemy.stun = enemy.def.boss ? .85 : 1.8; enemy.posture -= enemy.def.boss ? 60 : 100;
        if (enemy.posture <= 0) { enemy.stun = 2.4; enemy.posture = enemy.def.posture; }
        h.stamina = Math.min(100, h.stamina + 12); this.stats.parries++; this.emit('parry', { x: h.x, y: h.y }); return false;
      }
      if (this.spend(damage * 1.1)) { damage *= .12; this.stats.blocks++; this.emit('block'); }
      else { h.hurt = .8; h.guard = false; this.emit('notice', { text: 'GUARD BROKEN' }); }
    }
    h.hp = Math.max(0, h.hp - damage); h.invulnerable = .5; h.hurt = Math.max(h.hurt, .23); h.heal = 0; h.cast = 0; h.attack.cancel(); this.stats.damage += damage;
    this.emit('hurt', { x: h.x, y: h.y, damage });
    if (h.hp <= 0) {
      this.state = 'dead'; this.deathTime = 0; this.progress.deaths++;
      this.progress.dropped = { x: h.x, y: h.y, embers: this.progress.embers }; this.progress.embers = 0; this.lock = null;
      this.emit('death'); this.emit('save');
    }
    return true;
  }
  respawn() {
    const p = this.level.checkpoints.find(c => c.id === this.progress.checkpoint) || this.level.start;
    Object.assign(this.hero, { x: p.x, y: p.y, z: 0, vx: 0, vy: 0 });
    this.state = 'playing'; this.rest(this.progress.checkpoint); this.emit('respawn');
  }
  update(dt, intent = {}) {
    this.time += dt;
    if (this.state === 'dead') { this.deathTime += dt; if (this.deathTime > 2.4) this.respawn(); return; }
    if (this.state !== 'playing') return;
    const h = this.hero;
    this.navClock -= dt; if (this.navClock <= 0) { this.flow.update(h.x, h.y); this.navClock = .22; }
    for (const key of ['hurt', 'invulnerable', 'roll', 'parry', 'cooldown', 'regenDelay', 'heal', 'cast']) h[key] = Math.max(0, h[key] - dt);
    let mx = intent.x || 0, my = intent.y || 0;
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    if (intent.lock) this.target(); if (intent.cycle) this.target(true);
    if (this.lock && (this.lock.dead || dist(this.lock, h) > 230)) this.lock = null;
    if (this.lock) h.facing = direction(h, this.lock); else if (m > .1) h.facing = Math.atan2(my, mx);
    const wantsGuard = !!intent.guard && !h.roll && !h.heal && !h.cast && h.hurt < .1;
    if (wantsGuard && !h.guard) { h.parry = .23; h.attack.cancel(); }
    h.guard = wantsGuard;
    if (intent.dodge) this.dodge(mx, my);
    if (intent.heal) this.heal();
    if (intent.spell) this.spell(); if (intent.summon) this.spell(true);
    if (intent.attack || intent.heavy) this.startAttack(!!intent.heavy);
    if (intent.interact) this.interact();
    if (intent.upgrade) this.upgrade(intent.upgrade);
    if (h.heal > 0 && h.heal < .34 && !h.healDone) { h.hp = Math.min(this.maxHp, h.hp + 65); h.healDone = true; this.emit('heal', { x: h.x, y: h.y }); }
    if (h.regenDelay <= 0 && !h.roll && !h.attack.busy) h.stamina = Math.min(100, h.stamina + dt * (h.guard ? 15 : 36));
    const sprint = intent.sprint && !h.guard && !h.attack.busy && this.spend(dt * (this.nearby(120).length ? 12 : 0));
    let speed = sprint ? 100 : 70;
    if (h.guard) speed *= .45; if (h.attack.busy || h.heal || h.cast) speed *= .3; if (h.hurt) speed *= .2;
    h.vx = mx * speed; h.vy = my * speed;
    if (h.roll) { h.vx = Math.cos(h.rollAngle) * 172; h.vy = Math.sin(h.rollAngle) * 172; }
    h.update(dt, this.map);
    h.attack.update(dt);
    h.attack.hits(this.enemies, e => dist(h, e) < this.weapon.reach + e.r && Math.abs(diff(direction(h, e), h.facing)) < 1.45 && this.map.los(h.x, h.y, e.x, e.y), e => {
      const riposte = e.stun > .5;
      this.damageEnemy(e, (this.weapon.damage + this.progress.temper * 5) * (h.heavy ? 1.85 : 1) * (riposte ? 1.7 : 1) * (h.chain === 2 ? 1.2 : 1), h.heavy ? 80 : 25);
    });
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.updateProjectiles(dt);
    if (this.echo) {
      const echo = this.echo; echo.life -= dt; echo.cooldown -= dt;
      const target = this.nearby(230)[0];
      const to = target || h, a = direction(echo, to); echo.facing = a;
      if (dist(echo, to) > 34) { echo.x += Math.cos(a) * dt * 78; echo.y += Math.sin(a) * dt * 78; }
      if (target && echo.cooldown <= 0 && dist(echo, target) < 45) { this.damageEnemy(target, 15, 20, 'echo'); echo.cooldown = .95; this.emit('echoHit'); }
      if (echo.life <= 0) this.echo = null;
    }
    const room = [...this.level.rooms].reverse().find(r => h.x / TILE >= r.x && h.x / TILE < r.x + r.w && h.y / TILE >= r.y && h.y / TILE < r.y + r.h);
    if (room && room.name !== this.region) { this.region = room.name; this.emit('region', { name: this.region }); }
  }
  updateEnemy(e, dt) {
    if (e.dead) { e.deadTime += dt; return; }
    e.hurt = Math.max(0, e.hurt - dt); e.stun = Math.max(0, e.stun - dt); e.cooldown -= dt;
    const h = this.hero, d = dist(e, h);
    if (e.def.boss && !this.progress.flags.includes('seal')) return;
    if (e.def.boss && h.y > 15 * TILE) { if (e.aggro) { e.hp = e.maxHp; e.phase = 1; e.attack.cancel(); e.aggro = false; this.bossActive = false; } return; }
    if (d < (e.def.boss ? 230 : 135) && this.map.los(e.x, e.y, h.x, h.y)) e.aggro = true;
    if (d > 320) e.aggro = false;
    if (!e.aggro || e.stun > 0) { e.vx = 0; e.vy = 0; return; }
    if (e.def.boss && !this.bossActive) { this.bossActive = true; this.emit('bossStart'); }
    if (e.def.boss && e.hp < e.maxHp * .5 && e.phase === 1) {
      e.phase = 2; e.stun = 1.3; e.attack.cancel(); e.cooldown = 1.5; this.emit('phase', { text: 'AUREL, VOICE OF THE HOLLOW SUN' });
      this.waves.push({ x: e.x, y: e.y, r: 0, max: 210, speed: 63, hit: false, warning: 1.3 }); return;
    }
    if (!e.attack.busy) {
      e.facing = direction(e, h);
      const stop = e.def.ranged ? 110 : e.def.range * .78;
      if (d > stop) {
        const vec = this.flow.dir(e.x, e.y, h.x, h.y); e.vx = vec[0] * e.def.speed * (e.phase === 2 ? 1.2 : 1); e.vy = vec[1] * e.def.speed * (e.phase === 2 ? 1.2 : 1); e.update(dt, this.map);
      } else { e.vx = 0; e.vy = 0; }
      if (d < e.def.range + 6 && e.cooldown <= 0 && this.map.los(e.x, e.y, h.x, h.y)) {
        e.pattern++;
        e.kind = e.def.ranged ? 'bolt' : e.def.boss && e.phase === 2 && e.pattern % 3 === 0 ? 'wave' : 'melee';
        e.attack = new this.E.Attack(e.kind === 'wave' ? 'cast' : e.def.move, { wind: e.kind === 'wave' ? 1.3 : e.def.wind / (e.phase === 2 ? 1.15 : 1), active: .2, recover: e.def.recover }); e.attack.start(); e.fired = false;
      }
    } else {
      e.vx = 0; e.vy = 0;
      // Wind-up tracks only in its first half. The final direction is a promise to the player.
      if (e.attack.phase === 'wind' && e.attack.u < .5) e.facing = direction(e, h);
      e.attack.update(dt);
      if (e.attack.active && !e.fired && e.kind !== 'melee') {
        e.fired = true;
        if (e.kind === 'wave') this.waves.push({ x: e.x, y: e.y, r: 0, max: 200, speed: 80, hit: false, warning: 0 });
        else this.projectiles.push({ x: e.x, y: e.y, z: 15, vx: Math.cos(e.facing) * 100, vy: Math.sin(e.facing) * 100, life: 3, team: 'enemy', damage: e.def.damage, r: 4 });
      }
      if (e.kind === 'melee') e.attack.hits([h], () => dist(e, h) < e.def.range + h.r && Math.abs(diff(direction(e, h), e.facing)) < 1.2, () => this.damageHero(e.def.damage * (e.phase === 2 ? 1.15 : 1), e));
      if (!e.attack.busy) e.cooldown = e.def.boss ? .3 : .5;
    }
  }
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const [cx, cy] = this.map.toCell(p.x, p.y);
      if (!this.map.walkable(cx, cy)) p.life = 0;
      if (p.team === 'hero') {
        const e = this.enemies.find(e => !e.dead && dist(e, p) < e.r + p.r + 2);
        if (e) { this.damageEnemy(e, p.damage, 40, 'spell'); p.life = 0; }
      } else if (dist(p, this.hero) < this.hero.r + p.r) { this.damageHero(p.damage, p); p.life = 0; }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
    for (const w of this.waves) {
      if (w.warning > 0) { w.warning -= dt; continue; }
      w.r += w.speed * dt;
      if (!w.hit && Math.abs(dist(w, this.hero) - w.r) < 8) { if (this.damageHero(26, w, true)) w.hit = true; }
    }
    this.waves = this.waves.filter(w => w.r < w.max);
  }
  snapshot() {
    return { state: this.state, level: this.level.id, time: +this.time.toFixed(2), hero: { x: +this.hero.x.toFixed(2), y: +this.hero.y.toFixed(2), hp: +this.hero.hp.toFixed(1), stamina: +this.hero.stamina.toFixed(1), focus: this.hero.focus, flasks: this.hero.flasks }, progress: this.save(), enemies: this.enemies.map(e => ({ id: e.id, hp: e.hp, phase: e.phase, dead: e.dead })), stats: { ...this.stats } };
  }
}

// Grid navigation serves both the attract pilot and authored encounter tooling.
export function pathTo(map, from, to) {
  const [ax, ay] = map.toCell(from.x, from.y), [bx, by] = map.toCell(to.x, to.y);
  const key = (x, y) => `${x},${y}`, start = key(ax, ay), end = key(bx, by);
  const queue = [[ax, ay]], prev = new Map([[start, null]]); let at = 0;
  while (at < queue.length && at < 4000) {
    const [x, y] = queue[at++]; if (key(x, y) === end) break;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, id = key(nx, ny);
      if (!prev.has(id) && map.walkable(nx, ny)) { prev.set(id, key(x, y)); queue.push([nx, ny]); }
    }
  }
  if (!prev.has(end)) return [];
  const route = []; let cur = end;
  while (cur && cur !== start) { const [x, y] = cur.split(',').map(Number); route.push({ x: (x + .5) * TILE, y: (y + .5) * TILE }); cur = prev.get(cur); }
  return route.reverse();
}

export class AttractPilot {
  constructor(sim) { this.sim = sim; this.route = []; this.repath = 0; this.goal = ''; this.stage = 0; this.wait = 0; }
  objective() {
    const s = this.sim, p = s.progress;
    if (s.level.demoRoute) {
      const step = s.level.demoRoute.find(step => !p.flags.includes(step.until) && !p.inventory.includes(step.until) && p.checkpoint !== step.until);
      return step ? [...s.level.objects, ...s.level.gates, ...s.level.checkpoints].find(o=>o.id===step.target) : null;
    }
    if (!p.inventory.includes('key')) return s.level.objects.find(o => o.id === 'key');
    if (!p.inventory.includes('echo')) return s.level.objects.find(o => o.id === 'keeper');
    if (!p.inventory.includes('glaive')) return s.level.objects.find(o => o.id === 'glaive');
    if (!p.inventory.includes('flask')) return s.level.objects.find(o => o.id === 'flask');
    if (!p.flags.includes('shortcut')) return s.level.gates.find(o => o.id === 'shortcut');
    if (p.checkpoint !== 'choir') return { ...s.level.checkpoints[1], type: 'rest' };
    if (!p.flags.includes('seal')) return s.level.gates.find(o => o.id === 'seal');
    return s.level.objects.find(o => o.id === 'bell');
  }
  update(dt) {
    const s = this.sim, h = s.hero, i = { x: 0, y: 0 };
    if (s.state !== 'playing') return i;
    const threat = s.nearby(150).find(e => e.aggro && s.map.los(h.x, h.y, e.x, e.y));
    const wave = s.waves.find(w => w.warning <= 0 && Math.abs(dist(w, h) - w.r) < 22 && w.r < dist(w, h) + 7);
    if (wave && h.stamina > 23 && !h.roll) { const a = direction(h, wave); return { x: Math.cos(a), y: Math.sin(a), dodge: true }; }
    if (threat) {
      if (s.lock !== threat) { i.lock = !s.lock; i.cycle = !!s.lock; }
      const d = dist(h, threat), a = direction(h, threat), atk = threat.attack;
      if (h.hp < 58 && h.flasks && !h.attack.busy && (d > 70 || threat.stun > .9 || atk.phase === 'recover')) { i.heal = true; i.x = -Math.cos(a); i.y = -Math.sin(a); return i; }
      if (threat.def.boss && !s.echo && h.focus >= 60 && pHas(s, 'echo') && d > 80) { i.summon = true; return i; }
      if (atk.phase === 'wind' && atk.spec.wind - atk.t < .13 && d < threat.def.range + 8) {
        if (threat.kind === 'melee') { i.guard = true; return i; }
        i.x = -Math.sin(a); i.y = Math.cos(a); i.dodge = true; return i;
      }
      if (atk.phase === 'active' && d < threat.def.range + 8 && threat.kind === 'melee') { i.guard = true; return i; }
      if (d > s.weapon.reach + threat.r - 8) { i.x = Math.cos(a); i.y = Math.sin(a); }
      if (d < s.weapon.reach + threat.r - 4 && h.stamina > 30 && (atk.phase !== 'wind' || atk.spec.wind - atk.t > .6)) { i.heavy = threat.stun > .8 || threat.def.guard; i.attack = !i.heavy; }
      if (threat.def.ranged && d > 65 && h.focus > 28 && !h.attack.busy) i.spell = true;
      return i;
    }
    if (s.lock) i.lock = true;
    if (h.hp < 65 && h.flasks && !h.heal) return { heal: true };
    const goal = this.objective(); if (!goal) return i;
    if (dist(h, goal) < 24) {
      i.interact = true; this.route = []; this.repath = 0;
      if (goal.type === 'rest' && s.context()?.type === 'rest') {
        if (s.progress.temper < 3 && s.progress.embers >= 70 + s.progress.temper * 50) { i.upgrade = 'temper'; i.interact = false; }
        else if (s.progress.vigor < 3 && s.progress.embers >= 70 + s.progress.vigor * 50) { i.upgrade = 'vigor'; i.interact = false; }
      }
      return i;
    }
    this.repath -= dt;
    if (this.goal !== goal.id || this.repath <= 0 || !this.route.length) { this.route = pathTo(s.map, h, goal); this.goal = goal.id; this.repath = 1; }
    while (this.route.length && dist(h, this.route[0]) < 5) this.route.shift();
    const next = this.route[0] || goal, a = direction(h, next);
    i.x = Math.cos(a); i.y = Math.sin(a); i.sprint = h.stamina > 60; return i;
  }
}
const pHas = (s, item) => s.progress.inventory.includes(item);
