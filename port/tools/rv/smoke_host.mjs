#!/usr/bin/env node
// Revision del port, piloto 12 (spec/REVISION-PORT.md, RV-34..RV-37): el
// pegamento de web/worker.js con la API corregida, con el worker real dentro
// de un worker_thread (mismo shim que tools/pp/smoke_formas.mjs). La API en
// si la cubren los casos RV-32..RV-37 de tests/test_host.cpp.
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

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
