import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.GONER_PORT || 49173);
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' };
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname), path = resolve(root, '.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if (!path.startsWith(root+sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(path); res.writeHead(200, {'Content-Type': mime[extname(path)]||'application/octet-stream', 'Cache-Control':'no-store'}).end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(port,'127.0.0.1',()=>console.log(`The Gilded Goner: http://127.0.0.1:${port}`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
