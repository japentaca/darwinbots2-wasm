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
import { createRequire } from 'node:module';

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
  send(m, transfer) { this.w.postMessage(m, transfer); }
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

  if (kind === 'bc') {
    // Cargar una sim con IM encendido: LoadSimulation borra el puerto y el
    // modo sigue SIN puerto (loadsim_Click no vuelve a F1Internet_Click).
    A.send({ t: 'run', running: false });
    A.send({ t: 'save' });
    const saved = await A.wait((m) => m.t === 'saved');
    A.send({ t: 'load', bytes: saved.bytes }, [saved.bytes]);
    await A.wait((m) => m.t === 'frame');
    await sleep(600);
    check('cargar con IM: sigue conectado sin puerto', A.im.enabled && !A.im.port,
          `port ${A.im.port}`);
    A.send({ t: 'im', on: false });
    await A.until(() => A.imOff);
    A.imOff = false;
    A.send({ t: 'im', on: true, name: 'Ana', kind, url, room });
    await A.until(() => A.im && A.im.enabled && A.im.port > 0);
    check('reconectar recrea el puerto', A.im.port > 0);
    A.send({ t: 'run', running: true });
    await sleep(1500);
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

// ---- la API wasm directa ----------------------------------------------------
async function direct() {
  console.log('\n== API wasm (db_sim_im_* / tp_*) ==');
  const require = createRequire(import.meta.url);
  const createDbCore = require(path.join(PORT_DIR, 'build-wasm', 'dbcore.js'));
  const M = await createDbCore({ locateFile: (f) => path.join(PORT_DIR, 'build-wasm', f) });
  const C = (n, r, a) => M.cwrap(n, r, a);
  const api = {
    create: C('db_sim_create', 'number', []),
    destroy: C('db_sim_destroy', null, ['number']),
    start: C('db_sim_start', null, ['number', 'number']),
    setField: C('db_sim_set_field', null, ['number', 'number', 'number']),
    tick: C('db_sim_tick', null, ['number']),
    addSpecies: C('db_sim_add_species', 'number', ['number','string','string','number','number','number','number','number']),
    seed: C('db_sim_seed_species', 'number', ['number','number','number']),
    imEnable: C('db_sim_im_enable', 'number', ['number','number']),
    imDisable: C('db_sim_im_disable', 'number', ['number']),
    setIName: C('db_sim_set_iname', null, ['number','string']),
    getIName: C('db_sim_get_iname', 'number', ['number']),
    imStats: C('db_sim_im_stats', 'number', ['number']),
    setSimStart: C('db_sim_set_sim_start', null, ['number','string']),
    addTp: C('db_sim_add_teleporter', 'number', ['number','number','number','number','number','number','number','number','number','number']),
    delTp: C('db_sim_delete_teleporter', null, ['number','number']),
    tpGet: C('db_sim_tp_get', 'number', ['number','number','number']),
    tpCopy: C('db_sim_tp_copy', 'number', ['number','number','number']),
    numTp: C('db_sim_num_teleporters', 'number', ['number']),
    dumpTp: C('db_sim_dump_teleporters', 'number', ['number','number','number']),
    save: C('db_sim_save', 'number', ['number','number']),
    saveOrg: C('db_sim_save_organism', 'number', ['number','number','number']),
    peek: C('db_dbo_peek', 'number', ['number','number']),
    free: C('db_free', null, ['number']),
  };
  const str = (p) => { const t = M.UTF8ToString(p); api.free(p); return t; };
  const mk = (seed) => {
    const h = api.create();
    api.setField(h, 8000, 6000);
    api.start(h, seed);
    return h;
  };

  // writeIMdata byte a byte (main.frm:3134-3180), con el vbCrLf de Print #.
  const s1 = mk(77);
  api.setSimStart(s1, '9-24-2026 1-02-03 PM');
  const ia = api.addSpecies(s1, 'cond start 0 .up store stop', 'Alga.txt', 1, 0, 3000, 1, 3);
  const ib = api.addSpecies(s1, 'cond start 0 .up store stop', 'Bicho', 0, 0, 3000, 2, 2);
  api.seed(s1, ia, 0);
  api.seed(s1, ib, 0);
  const raw = str(api.imStats(s1));
  // Sin ticks, TotRunCycle vale -1 (StartNew, OptionsForm.frm:4752; RV-35).
  const expect = '-177.stats\n{"cycle":-1,"simId":"9-24-2026 1-02-03 PM","width":8000,' +
    '"height":6000,"population":[{"botName":"Alga","count":3,"repopulating":true},' +
    '{"botName":"","count":2}]}\r\n';
  const seedNum = raw.slice(0, raw.indexOf('.stats'));
  check('writeIMdata: JSON exacto (extractexactname sin punto => "")',
        raw.slice(raw.indexOf('.stats')) === expect.slice(expect.indexOf('.stats')),
        JSON.stringify(raw.slice(raw.indexOf('\n') + 1)));
  check('writeIMdata: archivo = TotRunCycle & UserSeedNumber & ".stats"',
        seedNum === '-177', seedNum + '.stats');

  // Apodo vacío: "Newbie " & Random(1, 10000) ANTES de los 2 Random de
  // NewTeleporter (MDIForm1.frm:1310-1324): con apodo, el puerto usa las
  // dos primeras extracciones; sin apodo, la 2.ª y la 3.ª.
  const buf = M._malloc(7 * 4 * 4);
  const tpPos = (h) => { api.dumpTp(h, buf, 4); return [M.HEAPF32[buf >> 2], M.HEAPF32[(buf >> 2) + 1]]; };
  const a = mk(99), b = mk(99), c = mk(99);
  api.setIName(a, 'X');
  api.imEnable(a, 0);
  api.imEnable(b, 0);
  api.setIName(c, 'X');
  api.addTp(c, 0, 0, 3000, 0, 1, 1, 1, 10, 10);  // mismas 2 extracciones
  const pa = tpPos(a), pb = tpPos(b);
  check('Newbie N consume 1 extracción antes del puerto', pa[0] !== pb[0] || pa[1] !== pb[1],
        `${str(api.getIName(b))}: (${pb}) vs con apodo (${pa})`);
  check('puerto Internet: alto √FieldHeight·10, heterótrofos, sondeo 10/10/10',
        api.tpGet(a, 1, 6) === 1 && api.tpGet(a, 1, 8) === 10 && api.tpGet(a, 1, 9) === 10 &&
        api.tpGet(a, 1, 10) === 10 && Math.abs(M.HEAPF32[(buf >> 2) + 3] - Math.fround(Math.sqrt(6000) * 10)) < 1e-3);

  // Slot reutilizado: NewTeleporter no reinicia `local` (Teleport.bas:60-104).
  const d = mk(5);
  api.addTp(d, 0, 0, 3000, 0, 1, 1, 1, 10, 10);   // local en el slot 1
  api.delTp(d, 1);
  const k = api.imEnable(d, 300);
  check('slot reutilizado: el puerto Internet hereda local = True', k === 1 &&
        api.tpGet(d, 1, 3) === 1 && api.tpGet(d, 1, 2) === 1);
  check('apagar borra los Internet', api.imDisable(d) === 1 && api.numTp(d) === 0);

  // Copia de teleporters entre handles (rondas): sin RNG, campos intactos.
  const e = mk(6), f = mk(6);
  const ie = api.imEnable(e, 0);
  for (let t = 0; t < 30; t++) api.tick(e);
  const g = api.create();
  const ig = api.tpCopy(g, e, ie);
  api.dumpTp(e, buf, 4);
  const before = Array.from(M.HEAPF32.subarray(buf >> 2, (buf >> 2) + 7));
  api.dumpTp(g, buf, 4);
  const after = Array.from(M.HEAPF32.subarray(buf >> 2, (buf >> 2) + 7));
  check('db_sim_tp_copy: mismo teleporter en el handle nuevo', ig === 1 &&
        before.every((v, i) => v === after[i]) && api.tpGet(g, 1, 10) === api.tpGet(e, ie, 10));

  // SaveOrganism estampa IntOpts.IName (HDRoutines.bas:232).
  const n = api.seed(f, api.addSpecies(f, 'cond start 0 .up store stop', 'Z.txt', 0, 0, 3000, 3, 1), 0);
  api.setIName(f, 'Pepe');
  const lp = M._malloc(4);
  const po = api.saveOrg(f, 1, lp);
  const len = M.HEAP32[lp >> 2];
  check('db_sim_save_organism estampa el apodo', n === 1 && po &&
        str(api.peek(po, len)).split('\t')[2] === 'Pepe');
  api.free(po);
  M._free(lp);
  M._free(buf);
  for (const h of [s1, a, b, c, d, e, f, g]) api.destroy(h);
}

await direct();

// Rondas (E5): Restart sin heterótrofos => ronda nueva en cada tick. El
// puerto (con su inbox) pasa al handle nuevo sin RNG y no se duplica.
async function rounds() {
  console.log('\n== rondas con Internet Mode ==');
  const D = new Sim('D');
  await D.wait((m) => m.t === 'ready');
  D.send(resetMsg(5555, [{ dna: ALGA, name: 'AlgaSola.txt', veg: true, qty: 10,
                           nrg: 3000, color: 0x00ff00 }]));
  await D.wait((m) => m.t === 'frame');
  D.send({ t: 'im', on: true, name: 'Dora', kind: 'bc', url: '', room: 'smoke-rounds-' + Date.now() });
  await D.until(() => D.im && D.im.enabled);
  D.send({ t: 'setopt', id: 90, v: 1 });
  D.send({ t: 'speed', n: 0 });
  D.send({ t: 'run', running: true });
  const n = () => D.logs.filter((l) => l.startsWith('ronda nueva')).length;
  const ok = await D.until(() => n() >= 5, 20000);
  D.send({ t: 'run', running: false });
  D.send({ t: 'redraw' });
  await D.wait((m) => m.t === 'frame');
  await sleep(600);
  check('rondas nuevas: el puerto Internet sobrevive sin duplicarse',
        ok && D.im.enabled && D.im.port === 1 && D.frame.hdr[6] === 1,
        `${n()} rondas, teleporters ${D.frame.hdr[6]}, puerto #${D.im.port}`);
  await D.stop();
}
await rounds();

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
  const mal = await fetch(`http://127.0.0.1:${port}/web/%E0%A4`);
  const nul = await fetch(`http://127.0.0.1:${port}/web/a%00b`);
  const still = await fetch(`http://127.0.0.1:${port}/web/imnet.js`);
  check('relay sobrevive a URLs malformadas / NUL', still.ok,
        `${mal.status}, ${nul.status}, luego ${still.status}`);
  await pair('ws', `ws://127.0.0.1:${port}/im`);
} finally {
  relay.kill();
}

console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
