import { chromium, webkit, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = process.env.GONER_QA_OUT || '/tmp/goner-browser-qa';
await mkdir(output,{recursive:true});
const url = process.env.GONER_TEST_URL || `file://${process.cwd()}/dist/TheGildedGoner-F3.html`;
const engines = (process.env.GONER_ENGINES || 'chromium,webkit,firefox').split(',');
const report=[];
for (const name of engines) {
  console.log(`Checking ${name}: title → keyboard play → rest → map → save → attract → controller`);
  // This host's PulseAudio endpoint stalls (even `pactl info` times out).
  // Use GStreamer's automatic silent sink for WebKit automation; Web Audio itself stays real.
  const browser = await ({chromium,webkit,firefox}[name]).launch({headless:true,
    ...(name === 'webkit' ? { env: { ...process.env, GST_PLUGIN_FEATURE_RANK: 'pulsesink:NONE,alsasink:NONE,oss4sink:NONE,jacksink:NONE' } } : {}) });
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text());});
    await page.goto(`${url}?qa`);await page.waitForFunction(()=>!!window.__GONER__ && __GONER__.game.real>.25);await page.waitForTimeout(150);
    const snap=()=>page.evaluate(()=>__GONER__.snapshot());
    await page.screenshot({path:`${output}/${name}-title.png`});
    assert.equal((await snap()).mode,'title');
    await page.keyboard.press('Enter');await page.waitForFunction(()=>__GONER__.mode==='play');
    await page.keyboard.press('KeyE');await page.waitForFunction(()=>__GONER__.panel==='rest');
    console.log(`${name}: rest and input ready`);
    await page.screenshot({path:`${output}/${name}-rest.png`});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!__GONER__.panel);
    const before=(await snap()).hero;
    await page.keyboard.down('KeyA');await page.waitForTimeout(600);await page.keyboard.up('KeyA');
    const after=(await snap()).hero;assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>20,'keyboard movement');
    await page.keyboard.press('Space');await page.waitForFunction(()=>__GONER__.sim.stats.dodges>0 && __GONER__.sim.hero.roll===0);
    await page.keyboard.press('KeyJ');await page.waitForFunction(()=>__GONER__.sim.stats.attacks>0);
    await page.keyboard.press('KeyM');await page.waitForFunction(()=>__GONER__.panel==='journal');assert.equal(await page.locator('svg[aria-label^="Map of"]').count(),1);
    await page.screenshot({path:`${output}/${name}-map.png`});await page.keyboard.press('Escape');await page.waitForFunction(()=>!__GONER__.panel);await page.waitForTimeout(80);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>__GONER__.panel==='pause');
    const frozen=(await snap()).time;await page.waitForTimeout(300);assert.equal((await snap()).time,frozen,'pause freezes combat');
    await page.getByRole('button',{name:'Save & return to title'}).click();await page.waitForFunction(()=>__GONER__.mode==='title');
    const saved=await page.evaluate(()=>localStorage.getItem('TheGildedGoner-F3:save:v1'));assert.ok(saved);
    // Attract starts after ten seconds of real inactivity, not after synthetic bot intents.
    if (name==='chromium') {await page.waitForTimeout(9200);assert.equal((await snap()).mode,'title');await page.waitForFunction(()=>__GONER__.mode==='demo',{timeout:3000});}
    else {await page.evaluate(()=>__GONER__.setIdle(10.1));await page.waitForFunction(()=>__GONER__.mode==='demo');}
    await page.evaluate(()=>{__GONER__.game.stop();__GONER__.game.advance(62,{draw:true});});
    await page.screenshot({path:`${output}/${name}-boss.png`});
    await page.evaluate(()=>__GONER__.game.advance(100,{draw:true}));
    const demo=await snap();assert.ok(demo.demoCycles>=2,`two full autonomous loops: ${demo.demoCycles}`);
    assert.equal(await page.evaluate(()=>localStorage.getItem('TheGildedGoner-F3:save:v1')),saved,'demo preserves save byte-for-byte');
    await page.keyboard.press('KeyZ');assert.equal((await snap()).mode,'title','unbound keyboard input exits attract immediately');
    await page.waitForTimeout(250);await page.evaluate(()=>__GONER__.game.start());
    await page.keyboard.press('Enter');await page.waitForFunction(()=>__GONER__.mode==='play');
    assert.equal((await snap()).progress.checkpoint,JSON.parse(saved).checkpoint,'continue loads saved progress');
    await page.screenshot({path:`${output}/${name}-play.png`});
    // Standard mapping is the browser contract used by DualSense over USB/Bluetooth.
    await page.evaluate(()=>{
      window.testPad={id:'DualSense Wireless Controller',index:0,connected:true,mapping:'standard',timestamp:1,axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.testPad]});
    });
    async function pad(button){await page.evaluate(i=>{testPad.buttons[i]={pressed:true,touched:true,value:1};},button);await page.waitForFunction(i=>__GONER__.game.input.padPrev[i]===true,button);await page.evaluate(i=>{testPad.buttons[i]={pressed:false,touched:false,value:0};},button);await page.waitForFunction(i=>!__GONER__.game.input.padPrev[i],button);await page.waitForTimeout(80);}
    const pos=(await snap()).hero;await page.evaluate(()=>testPad.axes[0]=.8);await page.waitForTimeout(500);await page.evaluate(()=>testPad.axes[0]=0);assert.ok(Math.hypot((await snap()).hero.x-pos.x,(await snap()).hero.y-pos.y)>15,'left stick moves');
    const attacks=(await snap()).stats.attacks;await pad(5);assert.ok((await snap()).stats.attacks>attacks,'R1 attack');
    await pad(9);assert.equal((await snap()).panel,'pause','Options opens menu');await pad(13);await pad(0);assert.equal((await snap()).panel,'journal','d-pad navigation and Cross confirm');await pad(1);assert.equal((await snap()).panel,null,'Circle goes back');
    await pad(17);assert.equal((await snap()).panel,'journal','DualSense touchpad opens map');await pad(1);
    await page.evaluate(()=>__GONER__.start({demo:true}));await page.evaluate(()=>testPad.axes[2]=.8);await page.waitForTimeout(100);assert.equal((await snap()).mode,'title','right stick interrupts demo');await page.evaluate(()=>testPad.axes[2]=0);
    await page.evaluate(()=>__GONER__.start({demo:true}));await page.mouse.move(700,450);assert.equal((await snap()).mode,'title','mouse movement interrupts demo');
    assert.deepEqual(errors,[],'no browser errors or engine warnings');
    report.push({engine:name,passed:true,checks:['keyboard play','rest','pause','map','save/continue','idle trigger','two autonomous completions','save isolation','DualSense standard mapping','keyboard/mouse/right-stick interruption'],demoCycles:demo.demoCycles});
    console.log(`${name}: all checks passed, ${demo.demoCycles} completed demo cycles`);
  } finally {await browser.close();}
}
await writeFile(`${output}/report.json`,JSON.stringify({url,results:report},null,2));
console.log(`Evidence: ${output}`);
