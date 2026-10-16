import { TILE, point } from './content.js';

const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const PALETTE = ['#b6994d', '#c6a75c', '#d4b968', '#e5cc85', '#8b804d'];

export class WorldPainter {
  constructor(E, game, sim) {
    this.E = E; this.game = game; this.sim = sim; this.rigs = new Map(); this.stamps = new Map(); this.props = this.makeProps();
    this.heroRig = new E.Humanoid({ size: 1.36, build: 'heroic', hat: 'helmet', outfit: 'coat', armor: true, sleeves: 'long', hair: 'long', cape: { len: 12, width: 7, seg: 3 }, colors: { skin: '#b4b1a0', cloth: '#4e6260', coat: '#697873', pants: '#343d3d', boot: '#292e2e', cape: '#a34c37', capeIn: '#5d302b', plate: '#9b9d8c', metal: '#d2cab0', trim: '#d5b675', hair: '#ded2ae', hilt: '#a98b48' } });
    this.ionaRig = new E.Humanoid({ size: 1.25, build: 'heroic', outfit: 'robe', hood: true, weapon: 'staff', colors: { skin: '#c4b99a', cloth: '#8c876a', pants: '#393c34', metal: '#d7c78a', trim: '#d7bf7a' } });
    this.echoRig = new E.Humanoid({ size: 1.3, build: 'heroic', outfit: 'robe', weapon: 'sword', cape: { len: 10, width: 6 }, colors: { cloth: '#85baba', coat: '#77a8a7', skin: '#cae5d5', pants: '#5c8587', metal: '#b8eadb', trim: '#b8eadb' } });
  }
  makeProps() {
    const props = [], s = this.sim;
    for (const room of s.level.rooms) {
      if (room.w < 8 || room.h < 8) continue;
      for (let n = 0; n < room.w * room.h / 8; n++) {
        const x = room.x + 1 + hash(n + room.x * 19) * (room.w - 2), y = room.y + 1 + hash(n + room.y * 13 + 7) * (room.h - 2);
        if (s.level.objects.some(o => Math.hypot(o.x - x * TILE, o.y - y * TILE) < 24)) continue;
        props.push({ name: room.floor === 'grass' ? n % 3 ? 'grass' : 'flowers' : n % 4 === 0 ? 'rock' : 'grass', x: x * TILE, y: y * TILE, size: .6 + hash(n) * .5, color: n % 2 ? '#8a8952' : '#596d50' });
      }
    }
    if (s.level.id === 'bellwether') {
      for (const [x, y] of [[17, 43], [30, 43], [16, 36], [30, 36], [14, 28], [19, 21], [26, 16], [30, 16], [34, 27], [45, 31], [23, 6], [34, 6], [23, 12], [34, 12]]) props.push({ name: 'brazier', ...point(x, y), size: 1.6 });
      for (const [x, y] of [[5, 22], [5, 26], [5, 29], [10, 21], [12, 23], [8, 31], [16, 31]]) props.push({ name: 'statue', ...point(x, y), size: 1.25, color: '#777d69' });
      for (const [x, y] of [[16, 39], [31, 39], [34, 22], [46, 22], [34, 33], [46, 33]]) props.push({ name: 'pillar', ...point(x, y), size: 2.4, color: '#808574', broken: true });
      for (const [x, y] of [[36, 23], [44, 23], [36, 32], [22, 7], [36, 7]]) props.push({ name: 'banner', ...point(x, y), size: 2, color: '#7c4033' });
    }
    return [...props, ...(s.level.props || [])];
  }
  rigFor(e) {
    if (this.rigs.has(e.id)) return this.rigs.get(e.id);
    const boss = e.def.boss, rig = new this.E.Humanoid({ size: e.def.size, build: boss || e.type === 'warden' ? 'bulky' : e.type === 'pilgrim' ? 'skeleton' : 'heroic', outfit: e.def.ranged ? 'robe' : 'coat', hat: boss ? 'crown' : e.type === 'warden' ? 'helmet' : undefined, hood: e.def.ranged, armor: !e.def.ranged, weapon: e.def.ranged ? 'staff' : 'sword', eyeGlow: '#e0b368', cape: boss ? { len: 15, width: 10, seg: 3 } : { len: 7, width: 5 }, colors: { cloth: e.def.color, coat: e.def.color, skin: '#9d9f89', bone: '#a0a08c', metal: '#b7a777', plate: e.def.color, pants: '#343e38', boot: '#30352f', trim: '#d4b66e', cape: boss ? '#634332' : '#48534b', capeIn: '#342c28', eye: '#ffe2a0' } });
    this.rigs.set(e.id, rig); return rig;
  }
  update(dt) {
    const s = this.sim, h = s.hero;
    this.heroRig.update(dt, { ...h, attack: h.attack.state, dash: h.roll > 0, pose: s.state === 'dead' ? 'die' : s.state === 'won' ? 'cheer' : h.guard ? 'block' : h.heal ? 'cast' : h.cast ? 'cast' : null, stance: 'ready', down: s.state === 'dead' ? Math.min(1, s.deathTime) : 0 });
    for (const e of s.enemies) if (Math.hypot(e.x - h.x, e.y - h.y) < 430) this.rigFor(e).update(dt, { ...e, attack: e.attack.state, hurt: e.hurt, pose: e.dead ? 'die' : e.stun ? 'kneel' : null, down: e.dead ? Math.min(1, e.deadTime * 1.7) : 0, stance: 'ready' });
    this.ionaRig.update(dt, { ...s.level.objects.find(o => o.type === 'npc'), facing: .6, pose: 'kneel' });
    if (s.echo) this.echoRig.update(dt, { ...s.echo, pose: s.echo.cooldown > .6 ? 'cast' : null });
  }
  prism(r, g, x, y, w, d, h, color, z = 0) {
    const p = (a, b, c) => r.w(a, b, c), t = this.E.tones(color), { px } = this.E;
    px.poly(g, [p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, h + z), p(x, y + d, h + z)], t.base);
    px.poly(g, [p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, h + z), p(x + w, y, h + z)], t.sh);
    px.poly(g, [p(x, y, h + z), p(x + w, y, h + z), p(x + w, y + d, h + z), p(x, y + d, h + z)], t.lt);
  }
  cached(r, key, x, y, z, paint, options = {}) {
    const id = `${key}:${r.view.scale}:${r.view.yawDeg}`, anchorX = 240, anchorY = 360;
    let cached = this.stamps.get(id);
    if (!cached) {
      const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 400;
      const g = canvas.getContext('2d', { willReadFrequently: true }), [sx, sy] = r.view.p(x, y, 0), ix = r.ix, iy = r.iy;
      r.ix = sx - anchorX; r.iy = sy - anchorY;
      try { paint(g); } finally { r.ix = ix; r.iy = iy; }
      // Trim once at bake time; repeated frames only blit the occupied rectangle.
      const pixels = g.getImageData(0, 0, 480, 400).data; let left = 480, top = 400, right = 0, bottom = 0;
      for (let yy=0;yy<400;yy++) for (let xx=0;xx<480;xx++) if (pixels[(yy*480+xx)*4+3]) { left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,yy);bottom=Math.max(bottom,yy); }
      cached = { canvas, left, top, width: Math.max(1,right-left+1), height: Math.max(1,bottom-top+1) }; this.stamps.set(id,cached);
    }
    r.queue(x,y,z,g=>{const [sx,sy]=r.w(x,y,0);g.drawImage(cached.canvas,cached.left,cached.top,cached.width,cached.height,Math.round(sx-anchorX+cached.left),Math.round(sy-anchorY+cached.top),cached.width,cached.height);},options);
  }
  arch(r, x, y, width = 70, height = 105) {
    const { px } = this.E;
    for (const side of [-1, 1]) {
      const xx = x + side * width / 2 - 8;
      this.cached(r, `pillar:${width}:${height}:${side}`, xx, y, 0, g => {
        this.prism(r, g, xx - 4, y - 4, 24, 22, 7, '#747a68');
        this.prism(r, g, xx, y, 16, 14, height * .69, '#686f61');
        for (let z = 15; z < height * .69; z += 15) { const a = r.w(xx, y + 14, z), b = r.w(xx + 16, y + 14, z); px.line(g, ...a, ...b, '#424f45'); }
        this.prism(r, g, xx - 3, y - 2, 22, 18, 5, '#949780', height * .66);
      }, { hides: true });
    }
    this.cached(r, `arch:${width}:${height}`, x, y + 4, height * .7, g => {
      for (let n = 0; n < 11; n++) {
        const a = Math.PI * n / 11, b = Math.PI * (n + .94) / 11;
        const p = (ang, rad) => r.w(x + Math.cos(ang) * rad, y + 8, height * .66 + Math.sin(ang) * height * .37);
        px.poly(g, [p(a, width / 2 + 9), p(b, width / 2 + 9), p(b, width / 2 - 6), p(a, width / 2 - 6)], n % 3 === 0 ? '#93977c' : '#747b65');
      }
    }, { hides: true });
  }
  tree(r, x, y, size = 1, gold = false) {
    const { px } = this.E, [sx, sy] = r.w(x, y), scale = r.view.scale * size;
    if (sx < -180 || sx > r.W + 180 || sy < -40 || sy > r.H + 220) return;
    r.shadow(x, y, 40 * size, .28);
    this.cached(r, `tree:${size}:${gold}`, x, y, 0, g => {
      const p = (xx, zz) => r.w(x + xx * size, y, zz * size);
      const twig = (a, b, width, color) => { const aa = p(...a), bb = p(...b); px.line(g, ...aa, ...bb, color, width * scale); };
      twig([0, 0], [9, 43], 8, '#444a35'); twig([9, 40], [-4, 89], 5, '#6d704d'); twig([-4, 85], [4, 129], 3, '#9b915d');
      for (let i = 0; i < 18; i++) {
        const side = i % 2 ? 1 : -1, z = 45 + hash(i + 2) * 65, out = side * (20 + hash(i + 5) * 48), end = [out, z + 23 + hash(i) * 15];
        twig([2, z], end, 1 + hash(i) * 1.8, '#8b8456');
        if (gold) for (let k = 0; k < 18; k++) {
          const xx = out + (hash(i * 23 + k) - .5) * 38, zz = end[1] + (hash(i * 19 + k + 80) - .5) * 28;
          const [a, b] = p(xx, zz), rad = (2 + hash(k + i) * 3.5) * size;
          px.poly(g, [[a-rad,b-1],[a-rad*.6,b-rad],[a+rad*.7,b-rad*.8],[a+rad,b+1],[a+rad*.3,b+rad*.65],[a-rad*.8,b+rad*.5]], PALETTE[(i + k) % PALETTE.length]);
          for (let leaf = 0; leaf < 5; leaf++) px.rect(g, a+(hash(k*31+leaf)-.5)*rad*2, b+(hash(i*37+leaf)-.5)*rad*2, size*1.5, size*.7, PALETTE[(i+k+leaf+2)%PALETTE.length]);
          if (k % 4 === 0) { const [c, d] = p(xx, zz - 14); px.line(g, a, b, c, d, '#9f9156'); for (let z=3;z<14;z+=3) {const q=p(xx+Math.sin(z)*2,zz-z);px.rect(g,q[0],q[1],2*size,size,'#c2a85f');} }
        }
      }
    }, { hides: true });
  }
  bell(r, x, y, rung = false) {
    const { px } = this.E;
    this.arch(r, x, y - 4, 86, 130);
    r.queue(x, y + 10, 75, g => {
      const p = (dx, z) => r.w(x + dx, y + 12, z);
      px.poly(g, [p(-16, 94), p(-19, 70), p(-29, 57), p(29, 57), p(19, 70), p(16, 94)], '#a58d51');
      px.poly(g, [p(-13, 92), p(-16, 69), p(-23, 60), p(-4, 60), p(-6, 92)], '#d5ba74');
      px.line(g, ...p(-29, 57), ...p(29, 57), '#e7ce88', 3);
      px.line(g, ...p(0, 59), ...p(Math.sin(this.game.time * (rung ? 3 : .6)) * (rung ? 14 : 1), 45), '#c1a264', 4);
      px.line(g, ...p(0, 96), ...p(0, 113), '#8a8056', 3);
    });
  }
  draw(r, { title = false, low = false } = {}) {
    const s = this.sim, h = s.hero, { px } = this.E, t = this.game.time;
    r.sky(['#182a2c', '#3b4940']); s.map.drawFloor(r);
    // Concentric masonry and gilded inlays lead the eye through each place of rest.
    for (const c of s.level.checkpoints) {
      r.groundDisc(c.x, c.y, 31, '#374943');
      for (const rad of [18, 25, 31]) r.groundRing(c.x, c.y, rad, rad === 25 ? '#a59961' : '#71806b', .8);
      r.groundDisc(c.x, c.y, 14 + Math.sin(t * 2), '#d6bb71', .16);
      r.prop('brazier', c.x, c.y, 0, { size: 1.1, light: true });
      r.queue(c.x, c.y, 10, g => { const [x, y] = r.w(c.x, c.y, 18 + Math.sin(t * 2) * 3); px.poly(g, [[x, y - 9], [x + 4, y], [x, y + 5], [x - 4, y]], '#f2daa0'); }, { emissive: true });
    }
    if (s.level.id === 'bellwether') for (const rad of [60, 82, 104]) r.groundRing(28.5 * TILE, 8.5 * TILE, rad, '#938e60', .65);
    s.map.queueWalls(r);
    for (const prop of this.props) { const [x, y] = r.w(prop.x, prop.y); if (x < -50 || x > r.W + 50 || y < -10 || y > r.H + 100) continue; r.prop(prop.name, prop.x, prop.y, 0, prop); }
    if (s.level.id === 'bellwether') {
      this.tree(r, 32.5 * TILE, 42 * TILE, 1.5, true);
      this.tree(r, 8 * TILE, 26 * TILE, 1.1, true);
      this.tree(r, 35.5 * TILE, 31 * TILE, .85, false);
      this.tree(r, 15 * TILE, 19 * TILE, 1.2, false);
      for (const [x, y, width] of [[23.5, 39, 88], [15, 32, 60], [39, 22, 110], [27.5, 16, 85]]) { const [sx, sy] = r.w(x * TILE, y * TILE); if (sx > -180 && sx < r.W + 180 && sy > -30 && sy < r.H + 200) this.arch(r, x * TILE, y * TILE, width); }
      this.bell(r, 28.5 * TILE, 4.5 * TILE, s.state === 'won');
    }
    for (const landmark of s.level.landmarks || []) {
      if (landmark.type === 'tree') this.tree(r, landmark.x, landmark.y, landmark.size || 1, landmark.gold);
      if (landmark.type === 'arch') this.arch(r, landmark.x, landmark.y, landmark.width, landmark.height);
      if (landmark.type === 'bell') this.bell(r, landmark.x, landmark.y, s.state === 'won');
    }
    for (const o of s.level.objects) {
      const opened = s.progress.flags.includes(o.id);
      if (o.type === 'chest') { r.prop('chest', o.x, o.y, 0, { size: 1.5, color: '#93805a', open: opened }); if (!opened) r.groundRing(o.x, o.y, 13, '#ddc383', .7); }
      if (o.type === 'pickup' && !opened) { r.prop('crystal', o.x, o.y, 3 + Math.sin(t * 2) * 2, { size: .7, color: '#e3bc71' }); r.groundRing(o.x, o.y, 10, '#d8b977', .6); }
      if (o.type === 'lore') r.prop('sign', o.x, o.y, 0, { size: 1.1, color: '#8a8f79' });
      if (o.type === 'npc') { r.shadow(o.x, o.y, 9); r.actor(o.x, o.y, 0, (g, x, y) => this.ionaRig.draw(g, x, y, r.view)); }
    }
    for (const gate of s.level.gates) if (!s.progress.flags.includes(gate.id)) {
      r.queue(gate.x, gate.y, 0, g => { for (let k = -3; k <= 3; k++) { const a = r.w(gate.x + k * 13, gate.y - 12, 4), b = r.w(gate.x + k * 13, gate.y - 12, 64); px.line(g, ...a, ...b, '#d4bc76', 1); } });
    }
    if (s.progress.dropped) { const p = s.progress.dropped; r.groundRing(p.x, p.y, 13 + Math.sin(t * 2) * 2, '#e7ba77'); r.prop('crystal', p.x, p.y, 5, { color: '#e7ba77', size: 1 }); }
    for (const e of s.enemies) {
      if (Math.hypot(e.x - h.x, e.y - h.y) > (title ? 500 : 430) || e.dead && e.deadTime > 6) continue;
      const rig = this.rigFor(e);
      if (!e.dead) r.shadow(e.x, e.y, e.r * 1.6);
      if (e.attack.phase === 'wind') {
        const color = e.kind === 'wave' ? '#b3d7d2' : '#db976a';
        r.groundArc(e.x, e.y, 4, e.def.range, e.facing - 1.2, e.facing + 1.2, color, .14 + e.attack.u * .2);
        r.groundArc(e.x, e.y, e.def.range - 1.2, e.def.range, e.facing - 1.2, e.facing + 1.2, color, .85);
      }
      r.actor(e.x, e.y, 0, (g, x, y) => rig.draw(g, x, y, r.view), { flash: e.hurt > 0 ? .6 : 0, alpha: e.dead ? Math.max(0, 1 - e.deadTime / 6) : 1, xray: true });
      if (!title && !e.def.boss && !e.dead && (e.hp < e.maxHp || s.lock === e)) {
        r.overlay(g => { const [x, y] = r.w(e.x, e.y, 49 * e.def.size); px.rect(g, x - 15, y - 3, 30, 3, '#182721'); px.rect(g, x - 15, y - 3, 30 * e.hp / e.maxHp, 2, '#c3b484'); if (e.stun > .5) px.poly(g, [[x, y + 2], [x + 3, y + 5], [x, y + 8], [x - 3, y + 5]], '#f2d48a'); });
      }
      if (s.lock === e) r.groundRing(e.x, e.y, e.r + 7, '#f4dfab', .9);
    }
    r.shadow(h.x, h.y, 10);
    if (h.roll) r.groundRing(h.x, h.y, 13, '#a6c4b4', .4);
    r.actor(h.x, h.y, h.z, (g, x, y) => this.heroRig.draw(g, x, y, r.view), { xray: true, flash: h.hurt > 0 ? .4 : 0, ghost: h.roll > 0, ghostColor: '#a4c6b9' });
    if (h.attack.busy) this.heroRig.drawSmear(r);
    if (s.echo) { r.groundDisc(s.echo.x, s.echo.y, 13, '#a1dace', .25); r.actor(s.echo.x, s.echo.y, 0, (g, x, y) => this.echoRig.draw(g, x, y, r.view), { alpha: .55, emissive: true }); }
    for (const p of s.projectiles) { r.groundDisc(p.x, p.y, 8, p.team === 'hero' ? '#a8d7c9' : '#dba570', .25); r.actor(p.x, p.y, p.z, (g, x, y) => { px.disc(g, x, y, p.r, p.team === 'hero' ? '#bce9dc' : '#f1b36d'); px.disc(g, x, y, p.r / 2, '#fff1cc'); }, { emissive: true }); }
    for (const w of s.waves) { r.groundRing(w.x, w.y, w.r + 1, '#e8c88d', .9); r.groundRing(w.x, w.y, w.r + 4, '#b0d9d0', .65); }
    if (!low) r.overlay(g => {
      // Slow drifting ash stays at fixed density, independent of display resolution.
      for (let i = 0; i < 48; i++) {
        const x = (hash(i + 19) * r.W + t * (1 + hash(i)) * 2) % r.W, y = (hash(i + 27) * r.H + t * (2 + hash(i + 8))) % r.H;
        px.rect(g, x, y, i % 5 === 0 ? 2 : 1, 1, i % 4 === 0 ? '#d5ba79' : '#849486');
      }
    });
  }
}
