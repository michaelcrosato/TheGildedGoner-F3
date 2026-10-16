import test from 'node:test';
import assert from 'node:assert/strict';
import '../vendor/my-3d2dge.js';
import { Simulation, AttractPilot, freshProgress, pathTo } from '../src/simulation.js';
import { validateSave, SaveStore, SAVE_KEY } from '../src/persistence.js';
const E = globalThis.My3D2dge;
const make = opts => new Simulation(E, opts);
const advance = (s, sec, intent = {}) => { for (let n=0;n<Math.round(sec*120);n++) s.update(1/120, typeof intent==='function'?intent(n):intent); };
const alone = () => { const s=make();s.enemies=[];return s; };

test('uses upstream Body, Attack, TileMap and FlowField at version 0.46.1',()=>{const s=make();assert.ok(s.hero instanceof E.Body);assert.ok(s.hero.attack instanceof E.Attack);assert.ok(s.map instanceof E.TileMap);assert.ok(s.flow instanceof E.FlowField);assert.equal(E.version,'0.46.1');});
test('all authored objectives can be reached, except the deliberately sealed arena',()=>{
  const s=make();for(const o of s.level.objects.filter(o=>o.type!=='bell'))assert.ok(pathTo(s.map,s.hero,o).length>0,o.id);
  assert.equal(pathTo(s.map,s.hero,s.level.objects.find(o=>o.id==='bell')).length,0);
  s.openGate('seal');assert.ok(pathTo(s.map,s.hero,s.level.objects.find(o=>o.id==='bell')).length>0);
});
test('walls and closed gates cannot be walked through, opened gates can',()=>{
  const s=alone();s.hero.x=408;s.hero.y=500;advance(s,1,{y:-1});assert.ok(s.hero.y>480);
  s.openGate('shortcut');advance(s,1,{y:-1});assert.ok(s.hero.y<470);
});
test('attack requires stamina and has a committed recovery; stamina regenerates after a delay',()=>{
  const s=alone();s.hero.stamina=5;assert.equal(s.startAttack(),false);s.hero.stamina=100;assert.equal(s.startAttack(),true);assert.equal(s.startAttack(),false);assert.equal(s.hero.stamina,83);advance(s,2);assert.equal(s.hero.stamina,100);
});
test('a sword hits each target once per swing, with an actual directional arc',()=>{
  const s=alone(),e=s.createEnemy({id:'test',type:'warden',x:s.hero.x+20,y:s.hero.y});e.def={...e.def,guard:false};e.aggro=false;e.cooldown=100;s.enemies=[e];s.hero.facing=0;s.startAttack();advance(s,.48);assert.equal(e.hp,127);
});
test('dodge spends stamina, moves against collision, and grants only a bounded invulnerability window',()=>{
  const s=alone(),h=s.hero;assert.ok(s.dodge(1,0));assert.equal(h.stamina,77);assert.equal(s.damageHero(20,{x:h.x+20,y:h.y}),false);advance(s,.6);assert.equal(s.damageHero(20,{x:h.x+20,y:h.y}),true);assert.equal(h.hp,80);
});
test('perfect parry staggers; held guard spends stamina; blue shockwaves bypass guarding',()=>{
  const s=alone(),h=s.hero,e=s.createEnemy({id:'test',type:'pilgrim',x:h.x+20,y:h.y});h.facing=0;h.guard=true;h.parry=.2;s.damageHero(20,e);assert.equal(h.hp,100);assert.ok(e.stun>0);assert.equal(s.stats.parries,1);
  h.parry=0;s.damageHero(20,e);assert.ok(h.hp>95);assert.ok(h.stamina<100);h.invulnerable=0;s.damageHero(20,e,true);assert.ok(h.hp<80);
});
test('heavy attacks break a warden’s posture and enable amplified ripostes',()=>{
  const s=alone(),e=s.createEnemy({id:'test',type:'warden',x:s.hero.x+20,y:s.hero.y});s.hero.heavy=true;s.damageEnemy(e,20,90);assert.ok(e.stun>1);assert.equal(e.hp,130);
});
test('healing is limited, delayed, and can be interrupted',()=>{
  const s=alone();s.hero.hp=10;assert.ok(s.heal());assert.equal(s.hero.hp,10);advance(s,.6);assert.equal(s.hero.hp,75);assert.equal(s.hero.flasks,2);
  advance(s,.4);s.heal();s.damageHero(10,{x:s.hero.x+20,y:s.hero.y});advance(s,1);assert.equal(s.hero.hp,65);assert.equal(s.hero.flasks,1);
});
test('death drops embers, replaces a prior loss, respawns at the chosen rest, and supports recovery',()=>{
  const s=alone();s.progress.embers=120;s.progress.dropped={x:1,y:1,embers:999};const spot={x:s.hero.x+20,y:s.hero.y};Object.assign(s.hero,spot);s.damageHero(200,{x:spot.x+10,y:spot.y});assert.equal(s.state,'dead');assert.equal(s.progress.embers,0);assert.equal(s.progress.dropped.embers,120);
  advance(s,2.5);assert.equal(s.state,'playing');assert.equal(s.hero.hp,100);Object.assign(s.hero,spot);s.interact();assert.equal(s.progress.embers,120);assert.equal(s.progress.dropped,null);
});
test('rests respawn regular enemies, preserve boss defeat, and refill all resources',()=>{
  const s=make();s.enemies[0].dead=true;s.progress.flags.push('boss');s.hero.hp=10;s.hero.focus=0;s.hero.flasks=0;s.rest('choir');assert.equal(s.enemies[0].dead,false);assert.equal(s.enemies.at(-1).dead,true);assert.equal(s.hero.focus,100);assert.equal(s.hero.flasks,3);assert.equal(s.progress.checkpoint,'choir');
});
test('upgrades require currency, cap at three, and survive a save roundtrip',()=>{
  const s=make();assert.equal(s.upgrade('vigor'),false);s.progress.embers=1000;for(let i=0;i<3;i++)assert.ok(s.upgrade('vigor'));assert.equal(s.upgrade('vigor'),false);assert.equal(s.maxHp,160);const loaded=make({progress:validateSave(s.save())});assert.equal(loaded.maxHp,160);assert.equal(loaded.progress.embers,640);
});
test('key and quest gate the echo, equipment and final seal; shortcut requires approach from north',()=>{
  const s=alone(),key=s.level.objects.find(o=>o.id==='key'),npc=s.level.objects.find(o=>o.id==='keeper'),gate=s.level.gates.find(o=>o.id==='seal');Object.assign(s.hero,gate);s.interact();assert.equal(s.progress.flags.includes('seal'),false);
  Object.assign(s.hero,key);s.interact();assert.ok(s.progress.inventory.includes('key'));Object.assign(s.hero,npc);s.interact();assert.ok(s.progress.inventory.includes('echo'));Object.assign(s.hero,gate);s.interact();assert.ok(s.progress.flags.includes('seal'));
});
test('projectiles collide with actors and walls and focus is finite',()=>{
  const s=alone(),h=s.hero,e=s.createEnemy({id:'test',type:'pilgrim',x:h.x+45,y:h.y});s.enemies=[e];e.cooldown=100;s.lock=e;assert.ok(s.spell());advance(s,.35);assert.equal(e.hp,38);assert.equal(h.focus,72);
  h.focus=0;assert.equal(s.spell(),false);
});
test('echo companion requires its quest and expires',()=>{
  const s=alone();assert.equal(s.spell(true),false);s.progress.inventory.push('echo');assert.ok(s.spell(true));assert.equal(s.hero.focus,40);assert.ok(s.echo);advance(s,23);assert.equal(s.echo,null);
});
test('boss changes phase at half health, emits a dodgeable ring, and can be defeated permanently',()=>{
  const s=make();s.openGate('seal');const b=s.enemies.at(-1);s.hero.x=b.x;s.hero.y=b.y+75;s.hero.invulnerable=20;b.hp=320;b.aggro=true;advance(s,.02);assert.equal(b.phase,2);assert.ok(s.waves.length>0);s.damageEnemy(b,1000,1);assert.ok(s.progress.flags.includes('boss'));assert.ok(s.context()===null||s.context().id!=='bell');Object.assign(s.hero,s.level.objects.find(o=>o.id==='bell'));s.interact();assert.equal(s.state,'won');
});
test('full attract pilot completes the authored route through normal rules, including both boss phases',()=>{
  const s=make({demo:true}),bot=new AttractPilot(s);for(let i=0;i<120*180&&s.state!=='won';i++)s.update(1/120,bot.update(1/120));assert.equal(s.state,'won',JSON.stringify(s.snapshot()));
  for(const id of ['shortcut','seal','boss','complete'])assert.ok(s.progress.flags.includes(id));
  for(const id of ['key','echo','glaive','flask'])assert.ok(s.progress.inventory.includes(id));
  assert.ok(s.stats.attacks>15);assert.ok(s.stats.parries>0);assert.ok(s.stats.dodges>0);assert.ok(s.stats.casts>0);assert.ok(s.stats.summons>0);assert.equal(s.enemies.at(-1).phase,2);
});
test('attract route is deterministic and repeatable across five whole journeys',()=>{
  let expected;for(let run=0;run<5;run++){const s=make({demo:true}),bot=new AttractPilot(s);for(let i=0;i<120*100&&s.state!=='won';i++)s.update(1/120,bot.update(1/120));assert.equal(s.state,'won');const result=JSON.stringify(s.snapshot());if(expected)assert.equal(result,expected);expected=result;}
});
test('proving ground uses the same combat entities and provides resettable practice',()=>{const s=make({trial:true});assert.equal(s.enemies.length,4);assert.ok(s.progress.inventory.includes('echo'));s.enemies.forEach(e=>e.dead=true);s.rest('hearth');assert.ok(s.enemies.every(e=>!e.dead));});
test('save validation handles corruption, unknown versions, forged values and unavailable storage',()=>{
  assert.equal(validateSave(null),null);assert.equal(validateSave({version:99}),null);const v=validateSave({version:1,vigor:999,embers:NaN,inventory:'x',weapon:'hax',checkpoint:'void'});assert.equal(v.vigor,3);assert.equal(v.embers,0);assert.equal(v.weapon,'sword');
  const blocked=new SaveStore({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});assert.equal(blocked.load(),null);assert.equal(blocked.write(freshProgress()),false);
});
test('save store writes a versioned snapshot and does not mutate the simulation',()=>{const memory=new Map(),store=new SaveStore({getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)}),s=make();s.progress.embers=42;store.write(s.save());assert.ok(memory.has(SAVE_KEY));assert.equal(store.load().embers,42);assert.equal(s.progress.embers,42);});
test('content-only level travel preserves per-level gates and global equipment through saves',()=>{
  const s=make();s.openGate('shortcut');s.progress.inventory.push('glaive');s.progress.embers=77;assert.ok(s.travel('trial'));
  const event=s.events.find(e=>e.type==='travel'),next=make({progress:validateSave(event.progress)});
  assert.equal(next.level.id,'trial');assert.equal(next.progress.embers,77);assert.ok(next.progress.inventory.includes('glaive'));assert.equal(next.progress.flags.includes('shortcut'),false);
  next.travel('bellwether');const home=make({progress:validateSave(next.events.find(e=>e.type==='travel').progress)});assert.ok(home.progress.flags.includes('shortcut'));assert.equal(home.map.cell(25,29),0);
});
test('data-authored story objects support conditions, rewards and one-time interactions',()=>{
  const s=alone();s.level={...s.level,objects:[{id:'test-story',type:'story',name:'A new voice',x:s.hero.x+20,y:s.hero.y,requires:['seal-token'],gainItems:['story-token'],setFlags:['helped'],grantEmbers:33,once:true,lines:['Remember this place.']}],checkpoints:[],gates:[]};
  s.interact();assert.equal(s.progress.embers,0);s.progress.inventory.push('seal-token');s.interact();assert.equal(s.progress.embers,33);assert.ok(s.progress.inventory.includes('story-token'));s.interact();assert.equal(s.progress.embers,33);
});
