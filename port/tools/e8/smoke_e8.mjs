#!/usr/bin/env node
// E8 — smoke test de los extras bajo node (spec/PLAN-EXTENSIONES.md §E8).
//
// API wasm directa: el paso 23 del monitor RGB (Master.bas:416-427) como
// espejo de host, la caché oaim/OSkin de DrawRobSkin (main.frm:838-866)
// contra la fórmula del fuente, SysvarTok sin bot; y web/worker.js real
// (worker_thread con el shim de smoke_im): cabecera de 13 floats, bloques
// del frame, eye designer (eye-read / setmem) y sysvar.
//
//   node tools/e8/smoke_e8.mjs        (desde port/, con build-wasm/)
import { Worker } from 'node:worker_threads';
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
process.chdir(WEB);

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ok   ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}

// CInt de VB6 (bancario) con su error 6.
function cint(x) {
  const f = Math.floor(x), d = x - f;
  const r = d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1);
  return r < -32768 || r > 32767 ? null : r;
}

const DNA_TURN = 'cond start 10 .aimsx store stop';   // gira cada ciclo
const DNA_STILL = 'cond start 0 .up store stop';

async function direct() {
  console.log('\n== API wasm (monitor / skins / sysvar) ==');
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
    maxRobs: C('db_sim_max_robs', 'number', ['number']),
    dumpBots: C('db_sim_dump_bots', 'number', ['number','number','number']),
    botMem: C('db_sim_bot_mem', 'number', ['number','number','number']),
    botSetMem: C('db_sim_bot_set_mem', null, ['number','number','number','number']),
    monCapture: C('db_sim_monitor_capture', null, ['number','number','number','number']),
    dumpMonitor: C('db_sim_dump_monitor', 'number', ['number','number','number']),
    dumpSkins: C('db_sim_dump_skins', 'number', ['number','number','number']),
    botSkin: C('db_sim_bot_skin', 'number', ['number','number','number']),
    botAim: C('db_sim_bot_aim', 'number', ['number','number']),
    tok0: C('db_sim_sysvar_tok0', 'number', ['number','string']),
    assignSkin: C('db_sim_species_assign_skin', null, ['number','number','number']),
    numSpecies: C('db_sim_num_species', 'number', ['number']),
    save: C('db_sim_save', 'number', ['number','number']),
    load: C('db_sim_load', null, ['number','number','number']),
    free: C('db_free', null, ['number']),
  };
  const h = api.create();
  api.setField(h, 8000, 6000);
  api.start(h, 4242);
  const sa = api.addSpecies(h, DNA_TURN, 'Turner', 0, 0, 3000, 0x3080ff, 6);
  const sb = api.addSpecies(h, DNA_STILL, 'Still', 0, 0, 3000, 0x20c040, 4);
  api.assignSkin(h, sa, 1000.25);
  api.assignSkin(h, sb, 1000.25);
  api.seed(h, sa, 0);
  api.seed(h, sb, 0);

  const cap = 64;
  const bBots = M._malloc(cap * 20 * 4), bMon = M._malloc(cap * 3 * 4), bSk = M._malloc(cap * 9 * 4);
  const F = (p, i) => M.HEAPF32[(p >> 2) + i];
  const rows = () => {
    const n = api.dumpBots(h, bBots, cap);
    const out = [];
    for (let i = 0; i < n; i++) out.push(F(bBots, i * 20) | 0);
    return out;
  };
  const GM = [971, 972, 973];    // memoria genética: nada la escribe salvo nosotros

  // ---- Monitor RGB ----
  let slots = rows();
  check('siembra: 10 bots', slots.length === 10, String(slots.length));
  // Antes del primer paso 23: los campos valen 0 (rob(posto) = blank).
  let n = api.dumpMonitor(h, bMon, cap);
  check('monitor: sin paso 23 los campos valen 0',
        n === slots.length && [...Array(n * 3).keys()].every((i) => F(bMon, i) === 0));
  slots.forEach((t, k) => GM.forEach((a, c) => api.botSetMem(h, t, a, 100 * k + c + 1)));
  api.tick(h);
  api.monCapture(h, GM[0], GM[1], GM[2]);
  slots = rows();
  n = api.dumpMonitor(h, bMon, cap);
  let okCopy = n === slots.length;
  for (let i = 0; i < n && okCopy; i++)
    for (let c = 0; c < 3; c++)
      okCopy = okCopy && F(bMon, i * 3 + c) === api.botMem(h, slots[i], GM[c]);
  check('monitor: el paso 23 copia mem(Monitor_mem_r/g/b) de cada bot vivo', okCopy);
  // Una escritura de UI entre ticks NO se ve hasta el próximo paso 23.
  api.botSetMem(h, slots[0], GM[0], 7777);
  api.dumpMonitor(h, bMon, cap);
  check('monitor: cambio de mem entre ticks no se ve hasta el siguiente paso 23',
        F(bMon, 0) !== 7777 && api.botMem(h, slots[0], GM[0]) === 7777);
  api.tick(h);
  api.monCapture(h, GM[0], GM[1], GM[2]);
  api.dumpMonitor(h, bMon, cap);
  check('monitor: ... y sí tras el siguiente', F(bMon, 0) === 7777);
  // Monitor apagado (sin captura): los campos quedan viejos.
  api.botSetMem(h, slots[0], GM[0], 1234);
  api.tick(h);
  api.dumpMonitor(h, bMon, cap);
  check('monitor: apagado, el campo conserva el último valor copiado', F(bMon, 0) === 7777);
  // Bot nuevo (slot nuevo) = 0 aunque no haya pasado por el paso 23.
  api.seed(h, sb, 0);
  const slots2 = rows();
  n = api.dumpMonitor(h, bMon, cap);
  const newIdx = slots2.findIndex((t) => !slots.includes(t));
  check('monitor: bot sembrado entre ticks vale 0 (blank)',
        newIdx >= 0 && F(bMon, newIdx * 3) === 0 && F(bMon, newIdx * 3 + 1) === 0);
  // Direcciones fuera de 0..1000: no se copia nada.
  api.monCapture(h, 5000, GM[1], GM[2]);
  api.dumpMonitor(h, bMon, cap);
  check('monitor: dirección fuera de mem() no copia', F(bMon, 0) === 7777);
  // Cargar una sim: el formato no persiste monitor_r/g/b.
  const lenP = M._malloc(4);
  const p = api.save(h, lenP);
  const len = M.HEAP32[lenP >> 2];
  api.load(h, p, len);
  api.free(p);
  n = api.dumpMonitor(h, bMon, cap);
  check('monitor: tras cargar, los campos vuelven a 0',
        n > 0 && [...Array(n * 3).keys()].every((i) => F(bMon, i) === 0));

  // ---- Skins ----
  slots = rows();
  let nk = api.dumpSkins(h, bSk, cap);
  const expectSkin = (t) => {
    const sk = [...Array(8).keys()].map((i) => api.botSkin(h, t, i));
    const aim = api.botAim(h, t);
    const bi = slots.indexOf(t);
    const rad = F(bBots, bi * 20 + 3);
    const o = [];
    for (let k = 0; k <= 6; k += 2) {
      const ang = sk[k + 1] / 100 - aim;
      o.push(cint(Math.cos(ang) * sk[k] * rad / 60), cint(Math.sin(ang) * sk[k] * rad / 60));
    }
    return { o, sk };
  };
  rows();   // refresca bBots (radios) para expectSkin
  let okSk = nk === slots.length, anyNonZero = false;
  for (let i = 0; i < nk && okSk; i++) {
    const { o, sk } = expectSkin(slots[i]);
    if (sk.some((x) => x !== 0)) anyNonZero = true;
    okSk = F(bSk, i * 9) === 1 && o.every((x, j) => x === F(bSk, i * 9 + 1 + j));
  }
  check('skins: OSkin = CInt((Cos(Skin(t+1)/100 - aim) * Skin(t)) * radius / 60)', okSk);
  check('skins: los fundadores traen Skin (loadrobs)', anyNonZero);
  // Caché: sin tick (aim igual) dos volcados dan lo mismo; tras girar, cambia.
  const before = [...Array(nk * 9).keys()].map((i) => F(bSk, i));
  nk = api.dumpSkins(h, bSk, cap);
  check('skins: con el mismo aim la caché no se recalcula (mismo volcado)',
        before.every((x, i) => x === F(bSk, i)));
  const turnSlot = slots.find((t) => {
    const a0 = api.botAim(h, t);
    return a0 !== undefined;
  });
  const aim0 = api.botAim(h, turnSlot);
  for (let k = 0; k < 3; k++) api.tick(h);
  slots = rows();
  const aim1 = api.botAim(h, turnSlot);
  nk = api.dumpSkins(h, bSk, cap);
  const ti = slots.indexOf(turnSlot);
  const { o: o1 } = expectSkin(turnSlot);
  check('skins: con aim nuevo la caché se recalcula',
        aim1 !== aim0 && o1.every((x, j) => x === F(bSk, ti * 9 + 1 + j)),
        `aim ${aim0.toFixed(3)} → ${aim1.toFixed(3)}`);

  // ---- AssignSkin (OptionsForm.frm:3411-3472) ----
  // Skin de una especie: determinista por nombre + ADN salvo Skin(6), que
  // mezcla el Randomize del reloj. Se lee por un fundador de cada especie.
  const skinOf = (dna, name, timer) => {
    const hh = api.create();
    api.setField(hh, 8000, 6000);
    api.start(hh, 1);
    const k = api.addSpecies(hh, dna, name, 0, 0, 3000, 0, 1);
    api.assignSkin(hh, k, timer);
    api.seed(hh, k, 1);
    const nb = api.dumpBots(hh, bBots, cap);
    const t = F(bBots, 0) | 0;
    const sk = [...Array(8).keys()].map((i) => api.botSkin(hh, t, i));
    api.destroy(hh);
    return nb === 1 ? sk : null;
  };
  const s1 = skinOf(DNA_TURN, 'Turner.txt', 100);
  const s2 = skinOf(DNA_TURN, 'Turner.txt', 100);
  const s3 = skinOf(DNA_TURN, 'Turner.txt', 54321.5);
  const s4 = skinOf(DNA_TURN, 'Otro.txt', 100);
  const s5 = skinOf(DNA_STILL, 'Turner.txt', 100);
  const s6 = skinOf(DNA_TURN, 'Turner', 100);
  check('AssignSkin: mismo nombre + ADN + reloj = misma skin', JSON.stringify(s1) === JSON.stringify(s2),
        JSON.stringify(s1));
  check('AssignSkin: el reloj solo mueve Skin(6)',
        [0, 1, 2, 3, 4, 5, 7].every((i) => s1[i] === s3[i]));
  check('AssignSkin: Replace(Name, ".txt", "") — "Turner.txt" = "Turner"',
        JSON.stringify(s1) === JSON.stringify(s6));
  check('AssignSkin: otro nombre u otro ADN cambian la skin',
        JSON.stringify(s1) !== JSON.stringify(s4) && JSON.stringify(s1) !== JSON.stringify(s5));
  check('AssignSkin: rangos Int(Rnd*61) y Int(Rnd*629)',
        [s1, s3, s4, s5].every((s) => s.every((v, i) => v >= 0 && v <= (i % 2 ? 628 : 60))));
  // ---- SysvarTok sin bot ----
  check('SysvarTok(".nrg") = 310', api.tok0(h, '.nrg') === 310);
  check('SysvarTok(".eye1width") = 531', api.tok0(h, '.eye1width') === 531);
  check('SysvarTok(".EYE5DIR") (LCase) = 525', api.tok0(h, '.EYE5DIR') === 525);
  check('SysvarTok(".noexiste") = 0', api.tok0(h, '.noexiste') === 0);
  check('SysvarTok("12") = Val = 12', api.tok0(h, '12') === 12);
  api.destroy(h);
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

class W {
  constructor() {
    this.w = new Worker(SHIM, { eval: true });
    this.waiters = [];
    this.frame = null;
    this.w.on('message', (m) => {
      if (m.t === 'frame') {
        this.frame = new Float32Array(m.buf.slice(0));
        this.w.postMessage({ t: 'ack', buf: m.buf }, [m.buf]);
      }
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
  send(m) { this.w.postMessage(m); }
}

async function viaWorker() {
  console.log('\n== worker.js (frame, eye designer, sysvar) ==');
  const A = new W();
  await A.wait((m) => m.t === 'ready');
  A.send({ t: 'reset', seed: 99, options: { fieldW: 8000, fieldH: 6000, minVegs: 0,
           repopAmount: 0, repopCooldown: 0, maxEnergy: 40, startChlr: 0, mutations: false },
           species: [{ dna: DNA_TURN, name: 'Turner', veg: false, qty: 5, nrg: 3000, color: 0xff8030 }] });
  A.send({ t: 'monitor', on: true, mem: [971, 310, 972] });
  A.send({ t: 'step' });
  let f = (await A.wait((m) => m.t === 'frame'), A.frame);
  await new Promise((r) => setTimeout(r, 300));
  f = A.frame;
  const nB = f[2];
  check('frame: cabecera de 13 floats con extras = monitor|skins', f[12] === 3, `extras=${f[12]}`);
  const off = 13 + nB * 20 + f[3] * 9 + f[4] * 5 + f[5] * 5 + f[6] * 7 + (f[7] > 0 ? 44 : 0);
  const total = off + nB * 3 + nB * 9;
  check('frame: bloques monitor (nB×3) y skins (nB×9) al final', nB > 0 && f.length >= total,
        `nB=${nB}`);
  check('frame: el monitor trae .nrg (mem 310) en el canal verde',
        f[off + 1] > 0, `g=${f[off + 1]}`);
  const slot = f[13] | 0;

  // Eye designer: escribir .eye3width y leerlo de vuelta.
  A.send({ t: 'setmem', n: slot, addr: 531 + 2, v: 321 });
  A.send({ t: 'setmem', n: slot, addr: 521 + 8, v: -100 });
  A.send({ t: 'eye-read', n: slot });
  const ev = await A.wait((m) => m.t === 'eye-vals');
  check('eye designer: setmem → eye-vals (eye3width = 321, eye9dir = -100)',
        ev.wth[2] === 321 && ev.dir[8] === -100 && ev.dir.length === 9 && ev.wth.length === 9);
  A.send({ t: 'sysvar', id: 7, name: '.eye1dir' });
  const sv = await A.wait((m) => m.t === 'sysvar');
  check('sysvar: {t:sysvar} → 521', sv.id === 7 && sv.v === 521);

  // Skin(6) estable entre sims nuevas (la especie llega clonada en cada
  // reset; el Timer de AssignSkin se fija la primera vez por nombre + ADN).
  const skinRow = () => { const g = A.frame; const k = g[2];
    const o = 13 + k * 20 + g[3] * 9 + g[4] * 5 + g[5] * 5 + g[6] * 7 + (g[7] > 0 ? 44 : 0) + (g[12] & 1 ? k * 3 : 0);
    return Array.from(g.slice(o, o + 9)).join(','); };
  const RESET = { t: 'reset', seed: 99, options: { fieldW: 8000, fieldH: 6000, minVegs: 0,
    repopAmount: 0, repopCooldown: 0, maxEnergy: 40, startChlr: 0, mutations: false },
    species: [{ dna: DNA_TURN, name: 'Turner', veg: false, qty: 5, nrg: 3000, color: 0xff8030 }] };
  const sk = [];
  for (let k = 0; k < 2; k++) {
    A.send(JSON.parse(JSON.stringify(RESET)));
    await new Promise((r) => setTimeout(r, 400));
    A.send({ t: 'redraw' });
    await new Promise((r) => setTimeout(r, 300));
    sk.push(skinRow());
  }
  check('skins: la misma especie conserva la skin en una sim nueva', sk[0] === sk[1], sk[0]);

  // Skins apagadas y monitor apagado: extras = 0.
  A.send({ t: 'skins', on: false });
  A.send({ t: 'monitor', on: false });
  A.send({ t: 'redraw' });
  await new Promise((r) => setTimeout(r, 300));
  check('frame: sin monitor ni skins, extras = 0', A.frame[12] === 0);
  await A.w.terminate();
}

try {
  await direct();
  await viaWorker();
} catch (e) {
  console.error(e);
  fail++;
}
console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
