#!/usr/bin/env node
// PP-03 — smoke de las formas en la sim/ronda nueva bajo node (wasm).
//
// El original guarda las formas en xObstacle (fraccion del campo) al activar
// el dialogo de opciones con la sim visible (OptionsForm.frm:4546-4563) y
// StartSimul las re-crea escaladas al campo nuevo en cada arranque, sim nueva
// o ronda nueva (main.frm:1357-1365). Los 3 Rnd del color de NewObstacle
// (Obstacles.bas:201) no se replican (Rnd crudo de arranque, B7-5/Q01).
// Obstacles() y leftCompactor/rightCompactor son globales que nada reinicia
// (tampoco LoadSimulation). La ronda hereda SimOpts. Hasta PP-03 la ronda
// nueva del port perdia las formas.
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
  save: C('db_sim_save', 'number', ['number', 'number']),
  load: C('db_sim_load', null, ['number', 'number', 'number']),
  free: C('db_free', null, ['number']),
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

console.log('\n== API directa: ObsRepop → StartSimul (main.frm:1357-1365) ==');
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
  check('regen: sin RNG (los 3 Rnd crudos del color no se replican, B7-5)', s1 === s0 && lcg(s0, 1) !== s0,
        `${s0.toString(16)} → ${s1.toString(16)}`);
  const now = obstacles(B);
  const exp = old.map((o) => ({
    x: f32(f32(o.x / 8000) * 16000), y: f32(f32(o.y / 6000) * 12000),
    w: f32(f32(o.w / 8000) * 16000), h: f32(f32(o.h / 6000) * 12000), color: o.color }));
  check('regen: posiciones y tamaños escalados al campo nuevo (Single)',
        now.every((o, i) => o.x === exp[i].x && o.y === exp[i].y && o.w === exp[i].w && o.h === exp[i].h),
        JSON.stringify(now[0]));
  check('regen: el color viene de xObstacle', now.every((o, i) => o.color === exp[i].color));

  // Mismo campo: la ida y vuelta en Single (x/FW)*FW, bit a bit.
  const same = regenInto(8000, 6000, true);
  const back = (v, d) => f32(f32(v / d) * d);
  check('regen en el mismo campo: (x/FW)*FW en Single, en el mismo orden',
        obstacles(same.B).every((o, i) => o.x === back(old[i].x, 8000) && o.y === back(old[i].y, 6000)
          && o.w === back(old[i].w, 8000) && o.h === back(old[i].h, 6000) && o.color === old[i].color));

  // El compactor: con carry los índices 3/4 siguen siendo compactors y
  // TrashCompactorMove los hace rebotar; sin carry, se cruzan y siguen.
  const walls = (h, li = 2) => { const o = obstacles(h); return [o[li].x, o[li + 1].x]; };
  const bounced = (h, li = 2) => {
    let rev = false, prev = walls(h, li)[0];
    for (let t = 0; t < 600; t++) {
      api.tick(h);
      const x = walls(h, li)[0];
      if (x < prev) rev = true;
      prev = x;
    }
    return rev;
  };
  check('compactor: la vel ±20 pasa con la forma (vel de xObstacle)',
        (() => { const a = walls(B); api.tick(B); const b = walls(B); return b[0] - a[0] === 20 && b[1] - a[1] === -20; })());
  check('compactor: los índices globales pasan y el muro rebota', bounced(B));
  const nc = regenInto(16000, 12000, false);
  // Sin compactor el muro izquierdo (vel +20) recorre 16000 en ~800 ticks:
  // en los 600 de la ventana no llega al borde que lo re-armaria.
  check('control: sin carry no hay compactor y el muro no rebota', !bounced(nc.B));

  // LoadSimulation: numObstacles = 0 y reescribe 1..n (HDRoutines.bas:
  // 1347-1352); los indices del compactador siguen.
  const lenP = M._malloc(4);
  // 16000 de ancho: el cruce (~410 ticks) llega antes que el borde (~800).
  const L = api.create();
  api.setField(L, 16000, 12000);
  api.start(L, 31);
  api.setOpt(L, 85, 200);
  api.trash(L);
  const p = api.save(L, lenP);
  const len = M.HEAP32[lenP >> 2];
  const bytes = M.HEAPU8.slice(p, p + len);
  api.free(p);
  const q = M._malloc(len);
  M.HEAPU8.set(bytes, q);
  api.load(L, q, len);
  check('carga: el compactor sigue rebotando (índices globales)', bounced(L, 0));
  // Un registro por encima del numObstacles cargado conserva su exist:
  // invisible, pero ObsRepop lo ve.
  const K = api.create();
  api.setField(K, 8000, 6000);
  api.start(K, 32);
  for (let i = 0; i < 5; i++) api.addObs(K, 100 * i, 100, 50, 50, 0x010101);
  const e = M._malloc(1);                      // .dbsim de una sim sin formas
  const Z0 = api.create();
  api.setField(Z0, 8000, 6000);
  api.start(Z0, 33);
  const pz = api.save(Z0, lenP);
  const lz = M.HEAP32[lenP >> 2];
  api.load(K, pz, lz);
  api.free(pz);
  api.repop(K);
  check('carga: los registros viejos por encima de n quedan (invisibles, ObsRepop los toma)',
        api.numObs(K) === 0 && obstacles(K).length === 0 && api.xcount() === 5, `xObstacle = ${api.xcount()}`);
  M._free(e); M._free(q); M._free(lenP);
  for (const h of [L, K, Z0]) api.destroy(h);

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
  await A.until(() => A.logs.some((l) => l.startsWith('shapes regenerated')));
  const f = await A.frameNow();
  check('sim nueva: re-crea las formas que había al pulsar "Nueva sim"',
        before > 2 && nObsOf(f) === before, `${before} → ${nObsOf(f)}`);

  // Rondas: Restart (id 90) sin heterótrofos ⇒ una ronda nueva por tick.
  // Cambiar una opción del panel = abrir OptionsForm = ObsRepop (captura
  // las formas de ahora); borrarlas DESPUÉS no toca xObstacle.
  A.send({ t: 'setopt', id: 90, v: 1 });
  A.send({ t: 'setopt', id: 85, v: 77 });     // opción en vivo: pasa a la ronda
  A.send({ t: 'shapes-clear' });
  A.send({ t: 'speed', n: 0 });
  A.send({ t: 'run', running: true });
  const rounds = () => A.logs.filter((l) => l.startsWith('new round')).length;
  const ok = await A.until(() => rounds() >= 5);
  A.send({ t: 'run', running: false });
  await sleep(200);
  const g = await A.frameNow();
  check('rondas nuevas: cada ronda re-crea las formas de xObstacle (ni se pierden ni se acumulan)',
        ok && nObsOf(g) === before, `${rounds()} rondas, ${nObsOf(g)} formas`);
  const regenLogs = A.logs.filter((l) => l === `shapes regenerated: ${before}`).length;
  check('rondas nuevas: una regeneración por ronda (+1 de la sim nueva)', regenLogs === rounds() + 1,
        `${regenLogs} regeneraciones, ${rounds()} rondas`);

  A.send({ t: 'getopt', id: 85 });
  const o85 = await A.wait((m) => m.t === 'opt' && m.id === 85);
  check('rondas nuevas: heredan las opciones en vivo (SimOpts sobrevive)', o85.v === 77, `shapeDriftRate = ${o85.v}`);

  // Borrar y DESPUÉS cambiar una opción: la captura queda vacía y la ronda
  // siguiente sale sin formas. Un toggle de menú (id 70) o el eye designer
  // (nocap) no capturan.
  A.send({ t: 'shapes-clear' });
  A.send({ t: 'setopt', id: 70, v: 0 });                  // menú de MDIForm1
  A.send({ t: 'setopt', id: 13, v: 0, nocap: true });    // eye designer
  A.send({ t: 'step' });
  const h = await A.frameNow();
  check('toggle de menú / eye designer: no capturan (la ronda re-crea las formas)', nObsOf(h) === before,
        `${nObsOf(h)} formas`);
  A.send({ t: 'shapes-clear' });
  A.send({ t: 'setopt', id: 31, v: 100 });                // panel de opciones
  A.send({ t: 'step' });
  const k = await A.frameNow();
  check('cambio en el panel tras borrar: la ronda siguiente sale sin formas', nObsOf(k) === 0,
        `${nObsOf(k)} formas`);

  // "Nueva sim" sin formas: la captura nueva está vacía.
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
