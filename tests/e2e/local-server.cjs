'use strict';
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
async function startLocalSite(backend, publicKey, options = {}) {
  assert(['127.0.0.1','localhost','[::1]'].includes(backend.hostname), 'Loopback test backend required');
  assert(backend.protocol === 'http:' && !backend.username && !backend.password, 'Plain loopback HTTP without credentials required');
  if (!String(publicKey).startsWith('sb_publishable_')) {
    assert.equal(JSON.parse(Buffer.from(String(publicKey).split('.')[1] || '', 'base64url')).role, 'anon', 'A service-role key cannot be served to a browser');
  }
  const sockets = new Set();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (options.closedTest && pathname.startsWith('/backend/')) {
        const target = proxyTarget(request.url);
        if (!target) { response.writeHead(403).end(); return; }
        if (Number(request.headers['content-length'] || 0)>65536) { response.writeHead(413).end(); return; }
        const upstream=http.request(target,{method:request.method,headers:{...request.headers,host:backend.host,apikey:publicKey}},result=>{
          response.writeHead(result.statusCode,result.headers);result.pipe(response);
        });
        upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end();});
        let length=0;request.on('data',chunk=>{length+=chunk.length;if(length>65536){upstream.destroy();if(!response.headersSent)response.writeHead(413);response.end();}});
        request.pipe(upstream);return;
      }
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const ext = path.extname(file).toLowerCase();
      if (!file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.')) || !types[ext] || !fs.statSync(file).isFile()) {
        response.writeHead(404).end(); return;
      }
      // Rewrite only an in-memory test response; tracked source remains intact.
      if (file === path.join(root, 'script.js')) {
        let rewritten = 0;
        let text = fs.readFileSync(file, 'utf8');
        text = text.replace(/^const SUPABASE_URL = .*;[ \t]*\r?$/m, () => { rewritten++; return 'const SUPABASE_URL = ' + (options.closedTest ? "window.location.origin + '/backend'" : JSON.stringify(backend.origin)) + ';'; });
        text = text.replace(/^const SUPABASE_KEY = .*;[ \t]*\r?$/m, () => { rewritten++; return 'const SUPABASE_KEY = ' + JSON.stringify(publicKey) + ';'; });
        assert.equal(rewritten, 2, 'Test backend rewrite failed');
        assert(!/https:\/\/[^'"\s]+\.supabase\.co/.test(text), 'Production backend reference remains');
        if (options.closedTest) text = 'window.PEPEN_CLOSED_TEST = true;\n' + text;
        response.writeHead(200, { 'Content-Type': types[ext] + '; charset=utf-8', 'Cache-Control': 'no-store' }).end(text); return;
      }
      response.writeHead(200, { 'Content-Type': types[ext], 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(response);
    } catch (_) { if (!response.headersSent) response.writeHead(404); response.end(); }
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  function proxyTarget(requestUrl) {
    const url=new URL(requestUrl,'http://localhost');
    if (!/^\/backend\/(auth\/v1\/(token|logout|user|health)|rest\/v1\/|functions\/v1\/(award-coins|rpg-pvp)|realtime\/v1\/)/.test(url.pathname)) return null;
    if (/\/auth\/v1\/(admin|signup|invite)/.test(url.pathname)) return null;
    const target=new URL(url.pathname.slice('/backend'.length)+url.search,backend);
    if (target.searchParams.has('apikey')) target.searchParams.set('apikey',publicKey);
    return target;
  }
  if (options.closedTest) server.on('upgrade',(request,socket,head)=>{
    const target=proxyTarget(request.url);
    if (!target || target.pathname!=='/realtime/v1/websocket') { socket.destroy();return; }
    const upstream=http.request(target,{headers:{...request.headers,host:backend.host,apikey:publicKey}});
    upstream.on('upgrade',(result,remote,remoteHead)=>{
      socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(result.headers).map(([name,value])=>name+': '+value+'\r\n').join('')+'\r\n');
      if(remoteHead.length)socket.write(remoteHead);if(head.length)remote.write(head);
      socket.pipe(remote).pipe(socket);remote.on('error',()=>socket.destroy());socket.on('error',()=>remote.destroy());
      socket.on('close',()=>remote.destroy());remote.on('close',()=>socket.destroy());
    });
    upstream.on('error',()=>socket.destroy());upstream.on('response',()=>socket.destroy());upstream.end();
  });
  await new Promise(resolve => server.listen(options.port || 0, '127.0.0.1', resolve));
  const frontend = 'http://127.0.0.1:' + server.address().port;
  return { server, frontend, stop: () => { for (const socket of sockets) socket.destroy(); return new Promise(resolve=>server.close(resolve)); } };
}
module.exports = { startLocalSite };
