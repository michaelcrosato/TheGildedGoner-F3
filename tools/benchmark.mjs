import { chromium, webkit, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out=process.env.GONER_QA_OUT || '/tmp/goner-benchmark';await mkdir(out,{recursive:true});
const results=[];
for (const name of (process.env.GONER_ENGINES || 'chromium,webkit,firefox').split(',')) {
  const browser=await ({chromium,webkit,firefox}[name]).launch({headless:true,...(name==='webkit'?{env:{...process.env,GST_PLUGIN_FEATURE_RANK:'pulsesink:NONE,alsasink:NONE,oss4sink:NONE,jacksink:NONE'}}:{})});
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    await page.goto(`${process.env.GONER_TEST_URL || `file://${process.cwd()}/dist/TheGildedGoner-F3.html`}?qa`);
    await page.waitForFunction(()=>!!window.__GONER__ && __GONER__.game.real>.2);
    await page.evaluate(()=>{const g=__GONER__.game,draw=g.scene.draw;window.framesMeasured=[];g.scene.draw=function(r){const now=performance.now();draw(r);framesMeasured.push({at:now,cost:performance.now()-now});};});
    for (const phase of ['title','journey','boss']) {
      if (phase==='title') await page.evaluate(()=>__GONER__.setIdle(-30));
      if (phase==='journey') await page.evaluate(()=>__GONER__.start({demo:true}));
      if (phase==='boss') await page.evaluate(()=>{__GONER__.start({demo:true});__GONER__.game.stop();__GONER__.game.advance(56,{draw:true});__GONER__.game.start();});
      await page.waitForTimeout(1500);await page.evaluate(()=>framesMeasured=[]);await page.waitForTimeout(8000);
      const metrics=await page.evaluate(()=>{const f=framesMeasured,span=(f.at(-1).at-f[0].at)/1000,cost=f.map(v=>v.cost).sort((a,b)=>a-b);return {fps:+((f.length-1)/span).toFixed(1),frames:f.length,meanDrawMs:+(cost.reduce((a,b)=>a+b,0)/cost.length).toFixed(2),p95DrawMs:+cost[Math.floor(cost.length*.95)].toFixed(2),scene:__GONER__.snapshot()};});
      await page.screenshot({path:`${out}/${name}-${phase}.png`});const row={engine:name,phase,viewport:'1920x1080',...metrics};results.push(row);console.log(`${name} ${phase}: ${metrics.fps} FPS, ${metrics.meanDrawMs} ms scene submission`);
    }
  } finally {await browser.close();}
}
await writeFile(`${out}/report.json`,JSON.stringify({date:new Date().toISOString(),note:'Actual scene draw frequency over 8 seconds after warmup. Headless Canvas 2D; no dedicated GPU throughput claim.',results},null,2));
if (results.some(r=>r.fps<25)) {console.error('A measured scene averaged below 25 FPS.');process.exitCode=1;}
