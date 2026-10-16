import { chromium, webkit, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const out='/tmp/goner-experience';await mkdir(out,{recursive:true});
const url=process.env.GONER_TEST_URL || 'http://127.0.0.1:49173/';
const results=[];
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${url}?qa`);await page.waitForFunction(()=>!!window.__GONER__);
  await page.keyboard.press('Enter');await page.waitForFunction(()=>__GONER__.mode==='play');
  // Fixture resources only; the actual menu dispatch, restrictions, charge and save path are exercised.
  await page.evaluate(()=>__GONER__.sim.progress.embers=300);
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>__GONER__.panel==='rest');
  await page.getByRole('button',{name:/Strengthen vigor/}).click();
  assert.equal(await page.evaluate(()=>__GONER__.sim.progress.vigor),1);
  assert.equal(await page.evaluate(()=>__GONER__.sim.progress.embers),230);
  await page.screenshot({path:`${out}/upgrades.png`});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!__GONER__.panel);
  await page.evaluate(()=>{const s=__GONER__.sim,o=s.level.objects.find(o=>o.id==='glaive');s.enemies=[];Object.assign(s.hero,{x:o.x,y:o.y});});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>__GONER__.sim.progress.inventory.includes('glaive'));
  await page.keyboard.press('KeyI');await page.waitForFunction(()=>__GONER__.panel==='gear');
  await page.getByRole('button',{name:/Pilgrim’s blade/}).click();assert.equal(await page.evaluate(()=>__GONER__.sim.progress.weapon),'sword');
  await page.getByRole('button',{name:/Vesper glaive/}).click();assert.equal(await page.evaluate(()=>__GONER__.sim.progress.weapon),'glaive');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!__GONER__.panel);
  await page.evaluate(()=>{const s=__GONER__.sim;s.hero.invulnerable=0;s.damageHero(500,{x:s.hero.x+20,y:s.hero.y});});
  await page.waitForFunction(()=>!document.getElementById('death').hidden);await page.screenshot({path:`${out}/death.png`});
  await page.waitForFunction(()=>__GONER__.sim.state==='playing');
  assert.equal(await page.evaluate(()=>__GONER__.sim.progress.deaths),1);
  await page.evaluate(()=>{const s=__GONER__.sim;s.enemies=[];Object.assign(s.hero,{x:s.progress.dropped.x,y:s.progress.dropped.y});});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>!__GONER__.sim.progress.dropped);assert.equal(await page.evaluate(()=>__GONER__.sim.progress.embers),230);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>__GONER__.panel==='pause');await page.getByRole('button',{name:'Save & return to title'}).click();
  await page.reload();await page.waitForFunction(()=>!!window.__GONER__);assert.equal(await page.locator('#begin-label').innerText(),'Continue journey');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>__GONER__.mode==='play');
  assert.equal(await page.evaluate(()=>__GONER__.sim.progress.vigor),1);assert.equal(await page.evaluate(()=>__GONER__.sim.progress.weapon),'glaive');assert.equal(await page.evaluate(()=>__GONER__.sim.progress.deaths),1);
  // End-state fixture isolates the ending UI. The full boss fight is exercised by the other two suites.
  await page.evaluate(()=>{const s=__GONER__.sim;s.openGate('seal');const b=s.enemies.at(-1);b.hp=1;b.cooldown=50;s.hero.x=b.x-23;s.hero.y=b.y;s.hero.invulnerable=10;});
  await page.keyboard.press('KeyJ');await page.waitForFunction(()=>__GONER__.sim.progress.flags.includes('boss'));
  await page.evaluate(()=>{const s=__GONER__.sim,o=s.level.objects.find(o=>o.id==='bell');s.hero.x=o.x;s.hero.y=o.y;});
  await page.keyboard.press('KeyE');await page.waitForFunction(()=>__GONER__.panel==='victory');await page.screenshot({path:`${out}/ending.png`});
  await page.getByRole('button',{name:'Wander the quiet sanctuary'}).click();await page.waitForFunction(()=>!__GONER__.panel);assert.equal(await page.evaluate(()=>__GONER__.sim.state),'playing');
  const before=await page.evaluate(()=>__GONER__.sim.hero.x);await page.keyboard.down('KeyA');await page.waitForTimeout(700);await page.keyboard.up('KeyA');assert.notEqual(await page.evaluate(()=>__GONER__.sim.hero.x),before);
  const audio=await page.evaluate(async()=>{const a=__GONER__.game.audio;a.sfx('charge',{vol:.6});const analyser=a.ctx.createAnalyser();a._master.connect(analyser);analyser.fftSize=1024;await new Promise(r=>setTimeout(r,70));const values=new Float32Array(1024);analyser.getFloatTimeDomainData(values);const peak=Math.max(...values.map(Math.abs));a._master.disconnect(analyser);return {state:a.ctx.state,peak};});
  assert.equal(audio.state,'running');assert.ok(audio.peak>0 && audio.peak<1,'synth produces a non-clipped signal');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>__GONER__.panel==='pause');await page.getByRole('button',{name:'Save & return to title'}).click();
  const save=await page.evaluate(()=>localStorage.getItem('TheGildedGoner-F3:save:v1'));
  await page.getByRole('button',{name:/About this tale/}).click();await page.getByRole('button',{name:/Enter the proving ground/}).click();await page.waitForFunction(()=>__GONER__.sim.trial);
  await page.keyboard.press('KeyJ');await page.waitForTimeout(500);await page.keyboard.press('Escape');await page.waitForFunction(()=>__GONER__.panel==='pause');await page.getByRole('button',{name:'Save & return to title'}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('TheGildedGoner-F3:save:v1')),save,'trial preserves campaign');assert.deepEqual(errors,[]);
  results.push({desktop:true,upgrades:true,equipment:true,deathRecovery:true,reloadPersistence:true,endingAndPostgameMovement:true,trialIsolation:true,audio});
  console.log('Desktop: upgrade, equipment, death/recovery, reload, ending, postgame movement, trial isolation and audio passed.');
} finally {await browser.close();}
const safari=await webkit.launch({headless:true,env:{...process.env,GST_PLUGIN_FEATURE_RANK:'pulsesink:NONE,alsasink:NONE,oss4sink:NONE,jacksink:NONE'}});
try {
  const page=await safari.newPage({...devices['iPhone SE (3rd gen)']}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${url}?qa`);await page.waitForFunction(()=>window.__GONER__?.mode==='demo');
  const visible=await page.evaluate(()=>['title-screen','hud','region','notice','demo-banner','performance'].filter(id=>getComputedStyle(document.getElementById(id)).display!=='none'));
  assert.deepEqual(visible,[]);assert.equal(await page.locator('[data-act]').count(),0);
  await page.locator('#menu-button').tap();await page.waitForFunction(()=>__GONER__.panel==='settings');assert.equal(await page.evaluate(()=>__GONER__.mode),'title');
  await page.screenshot({path:`${out}/phone-settings.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:/Sound/ ,exact:false}).first().tap();assert.equal(await page.evaluate(()=>__GONER__.settings.sound),false);
  await page.getByRole('button',{name:/Return/}).tap();await page.waitForFunction(()=>__GONER__.mode==='demo');
  await page.locator('#screen').tap({position:{x:80,y:160}});assert.equal(await page.evaluate(()=>__GONER__.mode),'title');assert.deepEqual(errors,[]);
  results.push({webkitPhone:true,spectatorOnly:true,menuTouch:true,touchInterrupt:true});console.log('WebKit phone: spectator-only presentation, menu and touch interrupt passed.');
} finally {await safari.close();}
await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));
