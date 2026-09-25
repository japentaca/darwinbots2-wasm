#!/usr/bin/env node
// Revision del port, pilotos 12 y 13 (spec/REVISION-PORT.md, RV-34..RV-41): el
// pegamento de web/worker.js con la API corregida, con el worker real dentro
// de un worker_thread (mismo shim que tools/pp/smoke_formas.mjs). La API en
// si la cubren los casos RV-32..RV-40 de tests/test_host.cpp.
//
//   node tools/rv/smoke_host.mjs     (desde port/, con build-wasm/)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT_DIR = path.resolve(here, '..', '..');
const WEB = path.join(PORT_DIR, 'web');
if (!fs.existsSync(path.join(PORT_DIR, 'build-wasm', 'dbcore.wasm'))) {
  console.error('falta build-wasm/dbcore.wasm (cmake --build --preset wasm --target dbcore.js)');
  process.exit(2);
}

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ok   ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
process.chdir(WEB);

class W {
  constructor() {
    this.w = new Worker(SHIM, { eval: true });
    this.waiters = [];
    this.frame = null;
    this.logs = [];
    this.con = [];
    this.w.on('message', (m) => {
      if (m.t === 'frame') {
        this.frame = new Float32Array(m.buf.slice(0));
        this.w.postMessage({ t: 'ack', buf: m.buf }, [m.buf]);
      }
      if (m.t === 'log') this.logs.push(m.msg);
      if (m.t === 'console-out') this.con.push(m.text);
      if (m.t === 'error') { console.error('worker error', m.msg); fail++; }
      this.waiters = this.waiters.filter(([pred, res]) => (pred(m) ? (res(m), false) : true));
    });
  }
  wait(pred, ms = 8000) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), ms);
      this.waiters.push([pred, (m) => { clearTimeout(t); res(m); }]);
    });
  }
  async until(pred, ms = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (pred()) return true; await sleep(50); }
    return false;
  }
  send(m) { this.w.postMessage(m); }
  async frameNow() {
    await sleep(300);
    this.send({ t: 'redraw' });
    await this.wait((m) => m.t === 'frame');
    await sleep(100);
    return this.frame;
  }
}

const ALGA = `cond
*.nrg 5000 >
start
50 .repro store
stop
end
`;
const resetMsg = (seed) => ({
  t: 'reset', seed,
  options: { fieldW: 8000, fieldH: 6000, minVegs: 0, repopAmount: 0, repopCooldown: 0,
             maxEnergy: 40, startChlr: 3000, mutations: false },
  species: [{ dna: ALGA, name: 'AlgaSola.txt', veg: true, qty: 5, nrg: 3000, color: 0x30d030 }],
});
const roundSeeds = (w) => w.logs.filter((l) => l.startsWith('ronda nueva'))
  .map((l) => +/seed (-?\d+)/.exec(l)[1]);

// RV-34/RV-35 — rondas del modo Restart (id 90; sin heterotrofos, una ronda
// por tick): la semilla sale del LCG de la sim que termina (dos corridas
// iguales dan las mismas semillas) y el contador de ciclos sigue.
console.log('\n== rondas: semilla del LCG y contador que sigue ==');
async function runRounds() {
  const A = new W();
  await A.wait((m) => m.t === 'ready');
  A.send(resetMsg(1234));
  await A.wait((m) => m.t === 'frame');
  A.send({ t: 'setopt', id: 90, v: 1 });
  for (let i = 0; i < 4; i++) A.send({ t: 'step' });
  await A.until(() => roundSeeds(A).length >= 4);
  const f = await A.frameNow();
  const out = { seeds: roundSeeds(A).slice(0, 4), cycle: f[11] };
  await A.w.terminate();
  return out;
}
{
  const r1 = await runRounds();
  const r2 = await runRounds();
  check('RV-34: la semilla de ronda es reproducible (LCG, no Math.random)',
        r1.seeds.length === 4 && r1.seeds.join() === r2.seeds.join(), r1.seeds.join(', '));
  check('RV-35: el contador de ciclos sigue a través de las rondas',
        r1.cycle === 3, `ciclo ${r1.cycle} tras 4 ticks (0..3)`);
}

// RV-36 — teleporter local con el slider sin tocar: 300 de alto.
console.log('\n== teleporter local ==');
{
  const A = new W();
  await A.wait((m) => m.t === 'ready');
  A.send(resetMsg(1234));
  await A.wait((m) => m.t === 'frame');
  A.send({ t: 'teleporter' });
  const f = await A.frameNow();
  const [nB, nS, nT, nO, nP] = [f[2], f[3], f[4], f[5], f[6]];
  const off = 13 + nB * 20 + nS * 9 + nT * 5 + nO * 5;
  check('RV-36: alto = 300 (TeleportForm.frm:378-379), ancho = 300 · aspect',
        nP === 1 && f[off + 3] === 300 && f[off + 2] === 225,
        `${f[off + 2]} × ${f[off + 3]}`);
  await A.w.terminate();
}

// RV-37 — `set` de la consola: CInt bancario en valor y direccion.
console.log('\n== consola: set ==');
{
  const A = new W();
  await A.wait((m) => m.t === 'ready');
  A.send(resetMsg(1234));
  await A.wait((m) => m.t === 'frame');
  A.send({ t: 'console', n: 1, on: true });
  await A.wait((m) => m.t === 'console-open');
  const cmd = async (line) => {
    const k = A.con.length;
    A.send({ t: 'console-cmd', n: 1, line });
    await A.until(() => A.con.length > k);
    return A.con[A.con.length - 1];
  };
  check('RV-37: set 7 3.5 -> mem(7) = 4', (await cmd('set 7 3.5')) === ' 7-> 4');
  check('RV-37: set 7 -1.7 -> mem(7) = -2', (await cmd('set 7 -1.7')) === ' 7-> -2');
  check('RV-37: set 7 2.5 -> mem(7) = 2', (await cmd('set 7 2.5')) === ' 7-> 2');
  check('RV-37: set 5.5 9 -> mem(6) = 9', (await cmd('set 5.5 9')) === ' 6-> 9');
  await A.w.terminate();
}

// ---- Piloto 13 (worker.js) ------------------------------------------------
const simMsg = (seed, fw, name) => ({
  t: 'reset', seed,
  options: { fieldW: fw, fieldH: 6000, minVegs: 0, repopAmount: 0, repopCooldown: 0,
             maxEnergy: 40, startChlr: 3000, mutations: false },
  species: [{ dna: ALGA, name, veg: true, qty: 5, nrg: 3000, color: 0x30d030 }],
});

// RV-38 — la ronda que sigue a una sim cargada arranca de la sim cargada
// (MDIForm1.frm:2166-2170), no del último "Start New".
console.log('\n== ronda tras cargar ==');
{
  const A = new W();
  await A.wait((m) => m.t === 'ready');
  A.send(simMsg(1234, 8000, 'Archivo.txt'));
  await A.wait((m) => m.t === 'frame');
  A.send({ t: 'save' });
  const saved = await A.wait((m) => m.t === 'saved');
  A.send(simMsg(99, 12000, 'Pagina.txt'));
  await A.wait((m) => m.t === 'frame');
  A.send({ t: 'load', bytes: saved.bytes });
  await A.frameNow();
  A.send({ t: 'setopt', id: 90, v: 1 });
  A.logs.length = 0;
  A.send({ t: 'step' });
  await A.until(() => A.logs.some((l) => l.startsWith('ronda nueva')));
  const f = await A.frameNow();
  check('RV-38: campo de la ronda = el del archivo', f[0] === 8000, `${f[0]} × ${f[1]}`);
  check('RV-38: la ronda siembra las especies del archivo',
        A.logs.includes('sembrados 5 × Archivo.txt') &&
        !A.logs.some((l) => l.includes('Pagina.txt')), A.logs.filter((l) => l.startsWith('sembrados')).join('; '));
  await A.w.terminate();
}

// RV-40 — el .sim no trae el ADN: la sesión lo busca por nombre y lo que no
// encuentra se lo pide a la página; sin ADN, la especie no se siembra.
console.log('\n== ADN de las especies cargadas ==');
{
  const A = new W();
  await A.wait((m) => m.t === 'ready');
  A.send(simMsg(1234, 8000, 'Archivo.txt'));
  await A.wait((m) => m.t === 'frame');
  A.send({ t: 'save' });
  const saved = await A.wait((m) => m.t === 'saved');
  await A.w.terminate();

  const B = new W();                          // sesión que no conoce la especie
  await B.wait((m) => m.t === 'ready');
  B.send(simMsg(99, 12000, 'Pagina.txt'));
  await B.wait((m) => m.t === 'frame');
  B.send({ t: 'load', bytes: saved.bytes });
  const miss = await B.wait((m) => m.t === 'dna-missing');
  check('RV-40: la carga pide el ADN que la sesión no tiene',
        miss.names.join() === 'Archivo.txt', miss.names.join());
  B.send({ t: 'setopt', id: 90, v: 1 });
  B.logs.length = 0;
  B.send({ t: 'step' });
  await B.until(() => B.logs.some((l) => l.startsWith('ronda nueva')));
  await B.frameNow();
  check('RV-40: sin ADN la ronda no siembra la especie (el .txt ausente)',
        B.logs.some((l) => l.startsWith('sin ADN para Archivo.txt')) &&
        !B.logs.some((l) => l.startsWith('sembrados')), B.logs.join(' | '));
  B.send({ t: 'load', bytes: saved.bytes });
  await B.wait((m) => m.t === 'dna-missing');
  B.send({ t: 'setopt', id: 90, v: 1 });
  B.logs.length = 0;
  B.send({ t: 'dna-lib', entries: [{ name: 'Archivo.txt', dna: ALGA }] });
  B.send({ t: 'step' });
  await B.until(() => B.logs.some((l) => l.startsWith('ronda nueva')));
  await B.frameNow();
  check('RV-40: con el ADN de la página la ronda la siembra',
        B.logs.includes('sembrados 5 × Archivo.txt'), B.logs.join(' | '));
  await B.w.terminate();
}

// RV-41 — puntos de gráfica: StartSimul no llama a FeedGraph y el tick que
// abre la ronda sale antes de alimentar (main.frm:2081); NewGraph al cargar
// alimenta el chart abierto que el archivo marca visible.
console.log('\n== gráficas y rondas ==');
{
  const A = new W();
  const pts = [];
  A.w.on('message', (m) => { if (m.t === 'graph-data') pts.push(m.cycle); });
  await A.wait((m) => m.t === 'ready');
  A.send(simMsg(1234, 8000, 'AlgaSola.txt'));
  await A.wait((m) => m.t === 'frame');
  A.send({ t: 'setopt', id: 110, v: 1 });
  A.send({ t: 'graph-open', n: 1 });
  await A.until(() => pts.length === 1);
  pts.length = 0;
  A.send({ t: 'save' });
  const saved = await A.wait((m) => m.t === 'saved');
  A.send(simMsg(99, 8000, 'AlgaSola.txt'));
  await A.frameNow();
  check('RV-41: "Start New" no suma un punto', pts.length === 0, `${pts.length} puntos`);
  A.send({ t: 'setopt', id: 110, v: 1 });   // el "Start New" volvió a 200
  A.send({ t: 'setopt', id: 90, v: 1 });
  for (let i = 0; i < 3; i++) A.send({ t: 'step' });
  await A.frameNow();
  await sleep(300);
  check('RV-41: los ticks que abren ronda no alimentan', pts.length === 0,
        `${pts.length} puntos (${pts.join()})`);
  A.send({ t: 'setopt', id: 90, v: 0 });
  A.send({ t: 'step' });
  await A.frameNow();
  check('RV-41: el tick normal sí alimenta', pts.length === 1, `${pts.length} puntos`);
  pts.length = 0;
  A.send({ t: 'load', bytes: saved.bytes });
  await A.wait((m) => m.t === 'graphs-restore');
  await A.frameNow();
  check('RV-41: la carga alimenta el chart abierto que el archivo marca visible',
        pts.length === 1, `${pts.length} puntos`);
  await A.w.terminate();
}

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
