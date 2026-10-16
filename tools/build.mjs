import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await rm('dist',{recursive:true,force:true}); await mkdir('dist',{recursive:true});
for(const p of ['index.html','style.css','src','vendor','LICENSE']) await cp(p,`dist/${p}`,{recursive:true});
// A second, truly self-contained distribution for file:// kiosks and simple handoffs.
const sources = ['content.js','simulation.js','persistence.js','render.js','main.js'];
const scripts = [];
for (const file of sources) { let code = await readFile(`src/${file}`,'utf8'); code=code.replace(/^import .*?;\n/gm,'').replace(/^export /gm,''); scripts.push(code); }
// Module scope constants shared by the sources are deliberately unique.
let html=await readFile('index.html','utf8');
const css=await readFile('style.css','utf8'), engine=await readFile('vendor/my-3d2dge.js','utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`)
 .replace('<script src="vendor/my-3d2dge.js"></script>',()=>`<script>${engine.replaceAll('</script','<\\/script')}</script>`)
 .replace('<script type="module" src="src/main.js"></script>',()=>`<script type="module">${scripts.join('\n').replaceAll('</script','<\\/script')}</script>`);
const licenses = `\n<!-- Game license\n${await readFile('LICENSE','utf8')}\nEngine license\n${await readFile('vendor/ENGINE-LICENSE','utf8')}\n-->\n`;
html=html.replace('</body>',()=>`${licenses}</body>`);
await writeFile('dist/TheGildedGoner-F3.html',html);
await writeFile('dist/build.json',JSON.stringify({game:'TheGildedGoner-F3',version:'1.0.0',engine:'0.46.1',engineCommit:'cfa866aa45474868350cad1a7fc015e612f9305f',standaloneSha256:createHash('sha256').update(html).digest('hex')},null,2)+'\n');
console.log('Built dist/ and standalone dist/TheGildedGoner-F3.html');
