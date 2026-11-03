'use strict';
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
async function startLocalSite(backend, publicKey) {
  assert(['127.0.0.1','localhost','[::1]'].includes(backend.hostname), 'Loopback test backend required');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const ext = path.extname(file).toLowerCase();
      if (!file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.')) || !types[ext] || !fs.statSync(file).isFile()) {
        response.writeHead(404).end(); return;
      }
      // Rewrite only an in-memory test response; tracked source remains intact.
      if (file === path.join(root, 'script.js')) {
        let rewritten = 0;
        let text = fs.readFileSync(file, 'utf8');
        text = text.replace(/^const SUPABASE_URL = .*;[ \t]*\r?$/m, () => { rewritten++; return 'const SUPABASE_URL = ' + JSON.stringify(backend.origin) + ';'; });
        text = text.replace(/^const SUPABASE_KEY = .*;[ \t]*\r?$/m, () => { rewritten++; return 'const SUPABASE_KEY = ' + JSON.stringify(publicKey) + ';'; });
        assert.equal(rewritten, 2, 'Test backend rewrite failed');
        assert(!/https:\/\/[^'"\s]+\.supabase\.co/.test(text), 'Production backend reference remains');
        response.writeHead(200, { 'Content-Type': types[ext] + '; charset=utf-8', 'Cache-Control': 'no-store' }).end(text); return;
      }
      response.writeHead(200, { 'Content-Type': types[ext], 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(response);
    } catch (_) { if (!response.headersSent) response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const frontend = 'http://127.0.0.1:' + server.address().port;
  return { server, frontend };
}
module.exports = { startLocalSite };
