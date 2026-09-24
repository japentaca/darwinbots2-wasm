#!/usr/bin/env node
// PP-03 — smoke de las formas en la sim/ronda nueva bajo node (wasm).
//
// El original guarda las formas en xObstacle (fraccion del campo) al activar
// el dialogo de opciones con la sim visible (OptionsForm.frm:4546-4563) y
// StartSimul las re-crea escaladas al campo nuevo en cada arranque, sim nueva
// o ronda nueva (main.frm:1355-1364), con los 3 Rnd del color de NewObstacle
// (Obstacles.bas:201). leftCompactor/rightCompactor son globales que nada
// reinicia. Hasta PP-03 la ronda nueva del port perdia las formas.
//
//   node tools/pp/smoke_formas.mjs     (desde port/, con build-wasm/)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
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

const require = createRequire(import.meta.url);
const createDbCore = require(path.join(PORT_DIR, 'build-wasm', 'dbcore.js'));
const M = await createDbCore({ locateFile: (f) => path.join(PORT_DIR, 'build-wasm', f) });
const C = (n, r, a) => M.cwrap(n, r, a);
const api = {
  create: C('db_sim_create', 'number', []),
  destroy: C('db_sim_destroy', null, ['number']),
  start: C('db_sim_start', null, ['number', 'number']),
  setField: C('db_sim_set_field', null, ['number', 'number', 'number']),
  setOpt: C('db_sim_set_opt', null, ['number', 'number', 'number']),
  tick: C('db_sim_tick', null, ['number']),
  rng: C('db_sim_rng_state', 'number', ['number']),
  addObs: C('db_sim_add_obstacle', 'number', ['number','number','number','number','number','number']),
  obsColor: C('db_sim_obstacle_set_color', null, ['number','number','number']),
  delObs: C('db_sim_delete_obstacle', null, ['number','number']),
  trash: C('db_sim_maze_trash_compactor', 'number', ['number']),
  numObs: C('db_sim_num_obstacles', 'number', ['number']),
  dumpObs: C('db_sim_dump_obstacles', 'number', ['number','number','number']),
  repop: C('db_sim_obs_repop', null, ['number']),
  carry: C('db_sim_obs_carry', null, ['number','number']),
  regen: C('db_sim_obs_regen', 'number', ['number']),
  xcount: C('db_xobs_count', 'number', []),
};

const obsBuf = M._malloc(1000 * 5 * 4);
function obstacles(h) {
  const n = api.dumpObs(h, obsBuf, 1000);
  const f = new Float32Array(M.HEAPF32.buffer, obsBuf, n * 5);
  const out = [];
  for (let i = 0; i < n; i++)
    out.push({ x: f[i*5], y: f[i*5+1], w: f[i*5+2], h: f[i*5+3], color: f[i*5+4] });
  return out;
}
// El LCG de VB6 (R-01), para contar extracciones.
const lcg = (s, k) => { for (let i = 0; i < k; i++) s = (Math.imul(s, 0x43FD43FD) + 0xC39EC3) & 0xFFFFFF; return s; };
const f32 = Math.fround;

console.log('\n== API directa: ObsRepop → StartSimul (main.frm:1355-1364) ==');
{
  // Sim vieja 8000×6000: dos formas a mano (con un hueco borrado entre
  // medio) y el trash compactor a tasa 200 (vel ±20).
  const A = api.create();
  api.setField(A, 8000, 6000);
  api.start(A, 4242);
  api.setOpt(A, 85, 200);
  api.addObs(A, 1000, 500, 800, 400, 0x123456);
  api.addObs(A, 2500, 2500, 100, 100, 0x777777);
  api.addObs(A, 3000, 2000, 500, 700, 0xabcdef);
  api.delObs(A, 2);                              // desplaza: quedan 2 formas
  api.trash(A);                                  // formas 3 y 4 = compactors
  api.obsColor(A, 3, 0x00ff00);
  api.obsColor(A, 4, 0x0000ff);
  const old = obstacles(A);
  api.repop(A);
  check('ObsRepop: xObstacle guarda las 4 formas vivas', api.xcount() === 4, `${api.xcount()}`);

  // Sim nueva en 16000×12000.
  const regenInto = (w, h, doCarry) => {
    const B = api.create();
    api.setField(B, w, h);
    api.start(B, 777);
    if (doCarry) api.carry(B, A);
    const s0 = api.rng(B);
    const n = api.regen(B);
    return { B, n, s0, s1: api.rng(B) };
  };
  const { B, n, s0, s1 } = regenInto(16000, 12000, true);
  check('regen: re-crea las 4 formas', n === 4 && api.numObs(B) === 4, `n=${n}`);
  check('regen: 3 Rnd por forma (12 extracciones del LCG)', s1 === lcg(s0, 12),
        `${s0.toString(16)} → ${s1.toString(16)}`);
  const now = obstacles(B);
  const exp = old.map((o) => ({
    x: f32(f32(o.x / 8000) * 16000), y: f32(f32(o.y / 6000) * 12000),
    w: f32(f32(o.w / 8000) * 16000), h: f32(f32(o.h / 6000) * 12000), color: o.color }));
  check('regen: posiciones y tamaños escalados al campo nuevo (Single)',
        now.every((o, i) => o.x === exp[i].x && o.y === exp[i].y && o.w === exp[i].w && o.h === exp[i].h),
        JSON.stringify(now[0]));
  check('regen: el color viene de xObstacle', now.every((o, i) => o.color === exp[i].color));

  // Mismo campo: vuelve exacto (x/FW*FW en Single) salvo 1 ulp; basta
  // con que el conteo y el orden coincidan.
  const same = regenInto(8000, 6000, true);
  check('regen en el mismo campo: mismas formas en el mismo orden',
        obstacles(same.B).every((o, i) => Math.abs(o.x - old[i].x) <= 0.001 && o.color === old[i].color));

  // El compactor: con carry los índices 3/4 siguen siendo compactors y
  // TrashCompactorMove los hace rebotar; sin carry, se cruzan y siguen.
  const walls = (h) => { const o = obstacles(h); return [o[2].x, o[3].x]; };
  const bounced = (h) => {
    let rev = false, prev = walls(h)[0];
    for (let t = 0; t < 600; t++) {
      api.tick(h);
      const x = walls(h)[0];
      if (x < prev) rev = true;
      prev = x;
    }
    return rev;
  };
  check('compactor: la vel ±20 pasa con la forma (vel de xObstacle)',
        (() => { const a = walls(B); api.tick(B); const b = walls(B); return b[0] - a[0] === 20 && b[1] - a[1] === -20; })());
  check('compactor: los índices globales pasan y el muro rebota', bounced(B));
  const nc = regenInto(16000, 12000, false);
  check('control: sin carry no hay compactor y el muro no rebota', !bounced(nc.B));

  // Carry: el array viejo llega apagado y sin formas antes de regenerar.
  const E = api.create();
  api.setField(E, 8000, 6000);
  api.start(E, 1);
  api.carry(E, A);
  check('carry: numObstacles = 0 y nada visible antes de regenerar',
        api.numObs(E) === 0 && obstacles(E).length === 0);

  // xObstacle vacía: sin formas y sin RNG.
  const Z = api.create();
  api.setField(Z, 8000, 6000);
  api.start(Z, 5);
  api.repop(Z);
  const z0 = api.rng(Z);
  check('xObstacle vacía: regen no crea nada ni consume RNG',
        api.regen(Z) === 0 && api.rng(Z) === z0 && api.xcount() === 0);
  for (const h of [A, B, same.B, nc.B, E, Z]) api.destroy(h);
}

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
process.chdir(WEB);

class W {
  constructor() {
    this.w = new Worker(SHIM, { eval: true });
    this.waiters = [];
    this.frame = null;
    this.logs = [];
    this.w.on('message', (m) => {
      if (m.t === 'frame') {
        this.frame = new Float32Array(m.buf.slice(0));
        this.w.postMessage({ t: 'ack', buf: m.buf }, [m.buf]);
      }
      if (m.t === 'log') this.logs.push(m.msg);
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
  // Deja drenar lo encolado y toma el ultimo frame.
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
const resetMsg = (seed, fw, fh) => ({
  t: 'reset', seed,
  options: { fieldW: fw, fieldH: fh, minVegs: 0, repopAmount: 0, repopCooldown: 0,
             maxEnergy: 40, startChlr: 3000, mutations: false },
  species: [{ dna: ALGA, name: 'AlgaSola.txt', veg: true, qty: 10, nrg: 3000, color: 0x30d030 }],
});
// Cabecera del frame (web/worker.js): [5] = obstáculos.
const nObsOf = (f) => f[5];

console.log('\n== worker.js: sim nueva y rondas ==');
{
  const A = new W();
  await A.wait((m) => m.t === 'ready');
  A.send(resetMsg(99, 8000, 6000));
  await A.wait((m) => m.t === 'frame');
  check('primera sim: sin formas (xObstacle vacía)', nObsOf(await A.frameNow()) === 0);
  A.send({ t: 'shape', dw: 0.2, dh: 0.2 });
  A.send({ t: 'shape', dw: 0.1, dh: 0.3 });
  A.send({ t: 'maze', kind: 'h', corridor: 500, wall: 50 });
  const before = nObsOf(await A.frameNow());
  A.send(resetMsg(100, 16000, 12000));
  await A.until(() => A.logs.some((l) => l.startsWith('formas regeneradas')));
  const f = await A.frameNow();
  check('sim nueva: re-crea las formas que había al pulsar "Nueva sim"',
        before > 2 && nObsOf(f) === before, `${before} → ${nObsOf(f)}`);

  // Rondas: Restart (id 90) sin heterótrofos ⇒ una ronda nueva por tick.
  A.send({ t: 'shapes-clear' });              // no toca xObstacle
  A.send({ t: 'setopt', id: 90, v: 1 });
  A.send({ t: 'speed', n: 0 });
  A.send({ t: 'run', running: true });
  const rounds = () => A.logs.filter((l) => l.startsWith('ronda nueva')).length;
  const ok = await A.until(() => rounds() >= 5);
  A.send({ t: 'run', running: false });
  await sleep(200);
  const g = await A.frameNow();
  check('rondas nuevas: cada ronda re-crea las formas de xObstacle (ni se pierden ni se acumulan)',
        ok && nObsOf(g) === before, `${rounds()} rondas, ${nObsOf(g)} formas`);
  const regenLogs = A.logs.filter((l) => l === `formas regeneradas: ${before}`).length;
  check('rondas nuevas: una regeneración por ronda', regenLogs >= rounds() + 1,
        `${regenLogs} regeneraciones`);

  // Borrar todas y "Nueva sim": la captura nueva está vacía.
  A.send({ t: 'setopt', id: 90, v: 0 });
  A.send({ t: 'shapes-clear' });
  A.send(resetMsg(101, 8000, 6000));
  await sleep(300);
  check('borrar todas + sim nueva: sin formas', nObsOf(await A.frameNow()) === 0);
  await A.w.terminate();
}

M._free(obsBuf);
console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
