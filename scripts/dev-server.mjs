import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHandler } from '../api/waitlist.js';
import { memoryStore } from '../checks/memory-store.mjs';

const mock = process.argv.includes('--test-storage');
const handler = mock ? createHandler({ store: memoryStore(), secret: () => 'local-test-only-'.repeat(4) }) : createHandler();
const types = { html:'text/html', css:'text/css', js:'text/javascript', png:'image/png', svg:'image/svg+xml', woff2:'font/woff2', txt:'text/plain' };
const allowed = new Set(['index.html','orbit-tokens.css','site.css','site.js','waitlist.css','waitlist.js','assets/mark.svg','assets/woven-light.png','assets/OpenRunde-Regular.woff2','assets/OpenRunde-Medium.woff2','assets/OpenRunde-Semibold.woff2','assets/OFL.txt']);
createServer(async (req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/waitlist') {
    let content = ''; for await (const chunk of req) { content += chunk; if (Buffer.byteLength(content) > 4096) { res.writeHead(413).end(); return; } }
    req.body = content;
    res.status = status => { res.statusCode = status; return res; };
    res.json = body => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)); };
    await handler(req,res); return;
  }
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!allowed.has(file)) { res.writeHead(404).end('Not found'); return; }
  try { res.setHeader('Content-Type', types[file.split('.').pop()] || 'application/octet-stream'); res.setHeader('Cache-Control','no-store'); res.end(await readFile(new URL('../'+file,import.meta.url))); }
  catch { res.writeHead(404).end('Not found'); }
}).listen(4323,'127.0.0.1',() => console.log(`Mentionloom at http://127.0.0.1:4323 (${mock ? 'isolated test storage; no production signups' : 'connected private storage'})`));
