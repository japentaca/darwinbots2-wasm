#!/usr/bin/env node
// E7 — smoke test de Internet Mode bajo node (spec/PLAN-EXTENSIONES.md §E7).
//
// Corre DOS web/worker.js reales (cada uno en un worker_thread con un shim
// mínimo de importScripts/postMessage) y los conecta primero por
// BroadcastChannel ('bc', lo que usan dos pestañas del mismo navegador) y
// después por tools/imrelay/relay.mjs ('ws'). Verifica que los organismos
// viajen de verdad entre las dos sims, con el apodo del emisor como
// LastOwner, que los censos de writeIMdata lleguen y alimenten
// InternetSpecies, y el resto del contrato del toggle.
//
//   node tools/imrelay/smoke_im.mjs        (desde port/, con build-wasm/)
import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT_DIR = path.resolve(here, '..', '..');
const WEB = path.join(PORT_DIR, 'web');
if (!fs.existsSync(path.join(PORT_DIR, 'build-wasm', 'dbcore.wasm'))) {
  console.error('falta build-wasm/dbcore.wasm (cmake --build --preset wasm --target dbcore.js)');
  process.exit(2);
}

// worker.js resuelve '../build-wasm/' contra el directorio actual (y los
// worker_threads no pueden cambiarlo): se fija aquí, para todos.
process.chdir(WEB);

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ok   ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- worker.js dentro de un worker_thread ----------------------------------
const SHIM = `
const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
globalThis.self = globalThis;
self.postMessage = (m, transfer) => parentPort.postMessage(m, transfer);
self.importScripts = (...files) => {
  for (const f of files) {
    const p = path.resolve(${JSON.stringify(WEB)}, f);
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
  }
};
parentPort.on('message', (data) => { if (self.onmessage) self.onmessage({ data }); });
importScripts('worker.js');
`;

class Sim {
  constructor(tag) {
    this.tag = tag;
    this.w = new Worker(SHIM, { eval: true });
    this.logs = [];
    this.im = null;
    this.imLog = [];
    this.frame = null;
    this.waiters = [];
    this.w.on('message', (m) => this.onMsg(m));
    this.w.on('error', (e) => { console.error(tag, 'worker error', e); fail++; });
  }
  onMsg(m) {
    switch (m.t) {
      case 'frame':
        this.frame = { hdr: Array.from(new Float32Array(m.buf, 0, 12)), stats: m.stats };
        this.w.postMessage({ t: 'ack', buf: m.buf }, [m.buf]);
        break;
      case 'log': this.logs.push(m.msg); break;
      case 'im-state': this.im = m.st; break;
      case 'im-log': this.imLog.push(...m.lines); break;
      case 'im-off': this.imOff = true; break;
    }
    for (const w of this.waiters.slice()) if (w.pred(m)) {
      this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m);
    }
  }
  wait(pred, ms = 20000) {
    return new Promise((res, rej) => {
      const w = { pred, res };
      this.waiters.push(w);
      setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) { this.waiters.splice(i, 1); rej(new Error(`${this.tag}: timeout`)); }
      }, ms);
    });
  }
  send(m) { this.w.postMessage(m); }
  async until(fn, ms = 60000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (fn()) return true;
      await sleep(100);
    }
    return false;
  }
  stop() { return this.w.terminate(); }
}

const ALGA = `' Alga Minimalis
cond
*.nrg 5000 >
start
50 .repro store
stop
`;
// Un "nadador": gira y acelera siempre, para cruzar el puerto.
const SWIM = `cond
start
40 .up store
7 .aimdx store
stop
`;

function resetMsg(seed, species) {
  return {
    t: 'reset', seed,
    options: { fieldW: 8000, fieldH: 6000, minVegs: 20, repopAmount: 10,
               repopCooldown: 10, maxEnergy: 40, startChlr: 3000,
               mutations: false },
    species,
  };
}

async function pair(kind, url) {
  console.log(`\n== transporte ${kind}${url ? ' (' + url + ')' : ''} ==`);
  const room = 'smoke-' + kind + '-' + Date.now();
  const A = new Sim('A');
  let B = new Sim('B');
  await Promise.all([A.wait((m) => m.t === 'ready'), B.wait((m) => m.t === 'ready')]);

  A.send(resetMsg(1111, [
    { dna: ALGA, name: 'AlgaAna.txt', veg: true, qty: 30, nrg: 3000, color: 0x00c000 },
    { dna: SWIM, name: 'Nadador.txt', veg: false, qty: 25, nrg: 30000, color: 0x0000ff }]));
  B.send(resetMsg(2222, [
    { dna: ALGA, name: 'AlgaBeto.txt', veg: true, qty: 30, nrg: 3000, color: 0xc0c000 }]));
  await Promise.all([A.wait((m) => m.t === 'frame'), B.wait((m) => m.t === 'frame')]);

  A.send({ t: 'im', on: true, name: 'Ana', kind, url, room });
  B.send({ t: 'im', on: true, name: '', kind, url, room });   // => Newbie N
  await A.until(() => A.im && A.im.enabled);
  await B.until(() => B.im && B.im.enabled);
  check('toggle: puerto Internet creado en A', A.im && A.im.port > 0, `#${A.im && A.im.port}`);
  check('apodo vacío => "Newbie N" (Random(1,10000))',
        B.im && /^Newbie \d+$/.test(B.im.name), B.im && B.im.name);
  const bName = B.im.name;

  const seen = await A.until(() => A.im.peers.some((p) => p.alive && p.name === bName), 15000);
  check('A ve a B como par', seen);
  await B.until(() => B.im.peers.some((p) => p.alive && p.name === 'Ana'), 15000);

  A.send({ t: 'speed', n: 0 });
  B.send({ t: 'speed', n: 0 });
  A.send({ t: 'run', running: true });
  B.send({ t: 'run', running: true });

  const traffic = await A.until(() =>
    A.im.counters.acked >= 3 && B.im.counters.acked >= 3 &&
    B.im.inTotal >= 3 && A.im.inTotal >= 3, 90000);
  check('tráfico en ambos sentidos (≥3 confirmados y cargados c/u)', traffic,
        `A: sale ${A.im.outTotal}/env ${A.im.counters.sent}/ack ${A.im.counters.acked}/entra ${A.im.inTotal} · ` +
        `B: sale ${B.im.outTotal}/env ${B.im.counters.sent}/ack ${B.im.counters.acked}/entra ${B.im.inTotal}`);

  // El registro viaja en tandas (im-log, ~250 ms) y puede llegar después
  // del im-state que ya cuenta la llegada.
  await B.until(() => B.imLog.some((l) => /^llegó .* de Ana$/.test(l)), 10000);
  await A.until(() => A.imLog.some((l) => l.endsWith(' de ' + bName)), 10000);
  const bFromAna = B.imLog.filter((l) => /^llegó .* de Ana$/.test(l));
  check('B recibe organismos con LastOwner = "Ana" (Sim::fmt, E7-01)',
        bFromAna.length > 0, bFromAna[0] || B.imLog.slice(0, 3).join(' | '));
  const aFromB = A.imLog.filter((l) => l.endsWith(' de ' + bName));
  check(`A recibe organismos con LastOwner = "${bName}"`, aFromB.length > 0, aFromB[0] || '');
  // La llegada consume RNG del receptor en el momento en que ocurre: la
  // trayectoria no es reproducible entre corridas y el Nadador puede tardar.
  const nadador = await B.until(() =>
    B.imLog.some((l) => l.startsWith('llegó Nadador.txt')), 60000);
  check('un heterótrofo de A llegó a B (teleportHeterotrophs = True)', nadador);

  const census = await A.until(() => {
    const p = A.im.peers.find((q) => q.name === bName);
    return p && p.census && p.census.cycle >= 200;
  }, 60000);
  check('censo writeIMdata de B llega a A (cada 200 ciclos)', census);
  const pb = A.im.peers.find((q) => q.name === bName);
  const algaB = pb && pb.census && pb.census.pop.find((x) => x.botName === 'AlgaBeto');
  check('JSON del censo: botName sin extensión + repopulating', !!(algaB && algaB.repopulating),
        algaB ? JSON.stringify(algaB) : '');
  const isp = A.im.internetSpecies.find((x) => x.name === 'AlgaBeto.txt');
  check('InternetSpecies de A trae AlgaBeto.txt con su color', !!isp && isp.color === 0xc0c000,
        isp ? `color ${isp.color}` : '');

  if (kind === 'ws') {
    // Resiliencia: B se cae de golpe (sin bye propio: lo emite el relay).
    // Lo que A exporte mientras no hay pares espera en la cola y se vacía
    // hacia el primer par nuevo.
    await B.stop();
    const dropped = await A.until(() => !A.im.peers.some((p) => p.alive), 20000);
    check('caída abrupta de B: A lo da de baja', dropped);
    const waiting = await A.until(() => A.im.pending > 0, 90000);
    check('sin pares: lo que sale espera en la cola', waiting, `pending ${A.im.pending}`);
    B = new Sim('C');
    await B.wait((m) => m.t === 'ready');
    B.send(resetMsg(4444, [{ dna: ALGA, name: 'AlgaCarla.txt', veg: true, qty: 20,
                             nrg: 3000, color: 0x0080ff }]));
    await B.wait((m) => m.t === 'frame');
    B.send({ t: 'im', on: true, name: 'Carla', kind, url, room });
    const drained = await A.until(() => A.im.pending === 0 && B.im && B.im.counters.recv > 0, 30000);
    check('par nuevo: la cola se vacía hacia él', drained,
          `pending ${A.im.pending}, C recibió ${B.im ? B.im.counters.recv : 0}`);
    B.send({ t: 'speed', n: 0 });
    B.send({ t: 'run', running: true });
    const loaded = await B.until(() => B.imLog.some((l) => / de Ana$/.test(l)), 30000);
    check('C carga lo que esperaba (LastOwner = "Ana")', loaded);
  }

  // Apagar en A: puerto borrado y el par desaparece de B.
  A.send({ t: 'run', running: false });
  const tpsBefore = A.frame.hdr[6];
  A.send({ t: 'im', on: false });
  await A.until(() => A.imOff);
  A.send({ t: 'redraw' });
  await A.wait((m) => m.t === 'frame');
  check('apagar: el puerto Internet se borra', A.frame.hdr[6] === tpsBefore - 1,
        `${tpsBefore} -> ${A.frame.hdr[6]}`);
  const gone = await B.until(() => !B.im.peers.some((p) => p.alive && p.name === 'Ana'), 20000);
  check('B deja de ver a A (bye)', gone);

  // Sim nueva apaga Internet Mode (OptionsForm.frm:4802).
  B.imOff = false;
  B.send({ t: 'run', running: false });
  B.send(resetMsg(3333, [{ dna: ALGA, name: 'AlgaBeto.txt', veg: true, qty: 5,
                           nrg: 3000, color: 0xc0c000 }]));
  await B.until(() => B.imOff, 10000);
  check('sim nueva apaga Internet Mode (F1Internet_Click como toggle)', B.imOff);

  await Promise.all([A.stop(), B.stop()]);
}

// ---- los dos transportes ------------------------------------------------------
await pair('bc', '');

const port = 18060 + Math.floor(Math.random() * 1000);
const relay = spawn(process.execPath,
  [path.join(here, 'relay.mjs'), '--port', String(port), '--host', '127.0.0.1', '--quiet'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res) => relay.stdout.once('data', res));
try {
  // El relay sirve también la página.
  const r = await fetch(`http://127.0.0.1:${port}/web/imnet.js`);
  check('relay sirve port/web estático', r.ok && (await r.text()).includes('ImNet'));
  const bad = await fetch(`http://127.0.0.1:${port}/web/..%2f..%2f..%2fsecret`);
  check('relay no sale de la raíz', bad.status === 404 || bad.status === 403, String(bad.status));
  await pair('ws', `ws://127.0.0.1:${port}/im`);
} finally {
  relay.kill();
}

console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
