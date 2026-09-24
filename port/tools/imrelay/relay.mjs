#!/usr/bin/env node
// E7 — relay de Internet Mode (spec/PLAN-EXTENSIONES.md §E7).
//
// El original nunca habló con la red: F1Internet_Click lanzaba un proceso
// aparte, DarwinbotsIM.exe (MDIForm1.frm:1347-1354), que movía los .dbo de
// la carpeta outbound a un servidor ("PeterIM", 198.50.150.51:79) y los del
// servidor a la inbound. Este relay hace de ese servidor para el port: un
// HUB tonto por sala. No decide nada — el destino de cada organismo lo
// sortea el emisor (web/imnet.js) entre los pares vivos — y no guarda nada.
//
//   node tools/imrelay/relay.mjs [--port 8060] [--host 0.0.0.0]
//                                [--root <dir>] [--no-static]
//
// - WebSocket en /im?room=<sala> (RFC 6455, escrito a mano: sin
//   dependencias). Mensajes de texto JSON; si traen `to`, van solo a ese par
//   (el `from` del primer mensaje de cada conexión la identifica); si no, a
//   todos los demás de la sala. Al cerrarse una conexión avisa {t:'bye'}.
// - HTTP estático de `port/` (por defecto) para no depender de
//   `python -m http.server`: la página queda en http://host:puerto/web/ y
//   su panel Internet propone ws://host:puerto/im solo.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const PORT = Number(opt('port', process.env.PORT || 8060));
const HOST = opt('host', '0.0.0.0');
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(opt('root', path.join(here, '..', '..')));
const STATIC = !args.includes('--no-static');
const QUIET = args.includes('--quiet');

const MAX_MESSAGE = 4 * 1024 * 1024;   // un .dbo ronda 10 KB; margen amplio
const PING_MS = 30000;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const log = (...a) => { if (!QUIET) console.log(new Date().toISOString().slice(11, 19), ...a); };

// ---- HTTP estático -------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.md': 'text/plain; charset=utf-8',
};

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') { res.writeHead(302, { Location: '/web/' }); res.end(); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403); res.end(); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (STATIC) serveStatic(req, res);
  else { res.writeHead(404); res.end('DarwinBots IM relay: WebSocket en /im'); }
});

// ---- WebSocket ------------------------------------------------------------
const rooms = new Map();   // sala -> Set<Client>

class Client {
  constructor(socket, room) {
    this.socket = socket;
    this.room = room;
    this.id = '';          // `from` del primer mensaje
    this.buf = Buffer.alloc(0);
    this.frag = null;      // fragmentos de un mensaje en curso
    this.alive = true;
    this.closed = false;
  }

  sendText(str) {
    if (this.closed) return;
    const payload = Buffer.from(str, 'utf8');
    this.socket.write(frame(0x1, payload));
  }

  close(code = 1000) {
    if (this.closed) return;
    this.closed = true;
    const p = Buffer.alloc(2);
    p.writeUInt16BE(code, 0);
    try { this.socket.write(frame(0x8, p)); } catch { /* ya cerrado */ }
    this.socket.end();
  }
}

function frame(opcode, payload) {
  const n = payload.length;
  let head;
  if (n < 126) {
    head = Buffer.from([0x80 | opcode, n]);
  } else if (n < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(n, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([head, payload]);
}

// Consume los frames completos del búfer del cliente.
function parseFrames(c) {
  for (;;) {
    const b = c.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < 4) return;
      len = b.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (b.length < 10) return;
      const big = b.readBigUInt64BE(2);
      if (big > BigInt(MAX_MESSAGE)) { c.close(1009); return; }
      len = Number(big); off = 10;
    }
    if (!masked) { c.close(1002); return; }   // RFC 6455 §5.1
    if (len > MAX_MESSAGE) { c.close(1009); return; }
    if (b.length < off + 4 + len) return;
    const mask = b.subarray(off, off + 4);
    const data = Buffer.from(b.subarray(off + 4, off + 4 + len));
    for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    c.buf = b.subarray(off + 4 + len);

    if (opcode === 0x8) { c.close(); return; }
    if (opcode === 0x9) { c.socket.write(frame(0xA, data)); continue; }
    if (opcode === 0xA) { c.alive = true; continue; }
    if (opcode === 0x0) {                       // continuación
      if (!c.frag) { c.close(1002); return; }
      c.frag.parts.push(data);
      c.frag.size += data.length;
      if (c.frag.size > MAX_MESSAGE) { c.close(1009); return; }
      if (fin) {
        const whole = Buffer.concat(c.frag.parts);
        const op = c.frag.opcode;
        c.frag = null;
        onMessage(c, op, whole);
      }
      continue;
    }
    if (opcode === 0x1 || opcode === 0x2) {
      if (fin) onMessage(c, opcode, data);
      else c.frag = { opcode, parts: [data], size: data.length };
      continue;
    }
    c.close(1002);
    return;
  }
}

function onMessage(c, opcode, data) {
  c.alive = true;
  if (opcode !== 0x1) return;                  // el protocolo es solo texto
  const text = data.toString('utf8');
  let msg;
  try { msg = JSON.parse(text); } catch { return; }
  if (!msg || typeof msg !== 'object') return;
  if (!c.id && typeof msg.from === 'string') {
    c.id = msg.from.slice(0, 64);
    log(`+ ${c.id} (${String(msg.name || '').slice(0, 40)}) en sala "${c.room}"`);
  }
  const peers = rooms.get(c.room);
  if (!peers) return;
  if (typeof msg.to === 'string' && msg.to) {
    for (const p of peers) if (p !== c && p.id === msg.to) p.sendText(text);
  } else {
    for (const p of peers) if (p !== c) p.sendText(text);
  }
}

function leave(c) {
  const peers = rooms.get(c.room);
  if (!peers || !peers.delete(c)) return;
  if (c.id) {
    const bye = JSON.stringify({ v: 1, t: 'bye', from: c.id });
    for (const p of peers) p.sendText(bye);
    log(`- ${c.id} deja "${c.room}" (${peers.size} quedan)`);
  }
  if (!peers.size) rooms.delete(c.room);
}

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://x');
  const key = req.headers['sec-websocket-key'];
  if (url.pathname !== '/im' || !key ||
      String(req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }
  const room = (url.searchParams.get('room') || 'publica').slice(0, 64);
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
               'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
               `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const c = new Client(socket, room);
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(c);
  socket.on('data', (chunk) => {
    c.buf = c.buf.length ? Buffer.concat([c.buf, chunk]) : chunk;
    if (c.buf.length > MAX_MESSAGE + 16) { c.close(1009); return; }
    parseFrames(c);
  });
  socket.on('close', () => { c.closed = true; leave(c); });
  socket.on('error', () => { c.closed = true; leave(c); });
});

// Ping periódico: un cliente que no contesta en un intervalo se cae.
setInterval(() => {
  for (const peers of rooms.values()) {
    for (const c of peers) {
      if (!c.alive) { c.socket.destroy(); continue; }
      c.alive = false;
      try { c.socket.write(frame(0x9, Buffer.alloc(0))); } catch { /* */ }
    }
  }
}, PING_MS).unref();

server.listen(PORT, HOST, () => {
  const where = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`DarwinBots IM relay en ws://${where}:${PORT}/im?room=<sala>`);
  if (STATIC) console.log(`página: http://${where}:${PORT}/web/  (raíz ${ROOT})`);
});
