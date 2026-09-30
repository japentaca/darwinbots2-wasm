#!/usr/bin/env node
// web2 E2 — test byte a byte de la API de solo lectura (port/web2/PLAN.md,
// decisión 6): dos sims idénticas (misma semilla, opciones y especies)
// corren N ciclos; la A llama a TODOS los exports de la etapa E2 (y
// db_sim_vis_observe con el acumulador de comportamiento encendido) y la B
// no. Los .dbsim (db_sim_save, el mismo export que usa web/worker.js) de
// ciclos intermedios y del final tienen que salir idénticos byte a byte, y
// el estado del LCG también. Además, chequeos de cordura de los valores y:
//   (a) el .dbsim final cargado en dos handles (uno con todos los exports y
//       el acumulador, otro sin nada), bytes y LCG en varios puntos;
//   (b) acumulador encendido con foto vieja (2500 ticks sin observe);
//   (c) behavior_take en tandas de max_rows = 1 no pierde filas;
//   (d) histogram con bins < 1 → −1 sin escribir (búfer centinela);
//   (e) sim vacía: volcados en 0 y métricas sin NaN;
//   (f) apagar y volver a encender el acumulador.
// Corre en el job `wasm` de CI.
//
//   node tests/wasm/solo_lectura.mjs [ciclos]   (desde port/, con build-wasm/)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT_DIR = path.resolve(here, '..', '..');
const BUILD = path.join(PORT_DIR, 'build-wasm');
if (!fs.existsSync(path.join(BUILD, 'dbcore.wasm'))) {
  console.error('falta build-wasm/dbcore.wasm (cmake --build --preset wasm)');
  process.exit(2);
}

const CYCLES = Math.max(3000, Number(process.argv[2]) || 3000);
const CHECKPOINTS = new Set([500, 1500, 2500, CYCLES]);

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
}

// ADN: los presets de web/index.html (Animal y Alga Minimalis) + un bot del
// Bestiary con venom y virus.
const ANIMAL = `cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refveldx .dx store
*.refvelup 30 add .up store
stop
cond
*.eye5 50 >
*.refeye *.myeye !=
start
-1 .shoot store
*.refvelup .up store
stop
cond
*.eye5 0 =
*.refeye *.myeye = or
start
314 rnd .aimdx store
stop
cond
*.nrg 20000 >
start
10 .repro store
stop
end
`;
const ALGA = `cond
*.nrg 5000 >
start
50 .repro store
stop
cond
*.fixpos 0 =
start
628 rnd 314 sub .aimdx store
stop
end
`;
const bot = (f) => fs.readFileSync(path.join(PORT_DIR, 'web', 'bots', f), 'utf8');
const SPECIES = [
  { dna: ANIMAL, name: 'Animal_Minimalis.txt', veg: 0, color: 0x4040ff, qty: 8 },
  { dna: ALGA, name: 'Alga_Minimalis.txt', veg: 1, color: 0x30d030, qty: 20 },
  { dna: bot('Animal_Minimaxis_2_F1_-Venom-_-05.01.07.txt'),
    name: 'Animal_Minimaxis_2_F1_-Venom-_-05.01.07.txt', veg: 0, color: 0xff8020, qty: 5 },
];

const require = createRequire(import.meta.url);
const createDbCore = require(path.join(BUILD, 'dbcore.js'));
const M = await createDbCore({ locateFile: (f) => path.join(BUILD, f) });
const C = (n, r, a) => M.cwrap(n, r, a);
const N = 'number';
const api = {
  create: C('db_sim_create', N, []),
  destroy: C('db_sim_destroy', null, [N]),
  start: C('db_sim_start', null, [N, N]),
  setField: C('db_sim_set_field', null, [N, N, N]),
  setMinVegs: C('db_sim_set_minvegs', null, [N, N]),
  setRepop: C('db_sim_set_repop', null, [N, N, N]),
  setMaxPop: C('db_sim_set_maxpop', null, [N, N]),
  setMaxEnergy: C('db_sim_set_max_energy', null, [N, N]),
  setStartChlr: C('db_sim_set_start_chlr', null, [N, N]),
  setMutations: C('db_sim_set_mutations', null, [N, N]),
  setOpt: C('db_sim_set_opt', null, [N, N, N]),
  setCost: C('db_sim_set_cost', null, [N, N, N]),
  setSimStart: C('db_sim_set_sim_start', null, [N, 'string']),
  addSpecies: C('db_sim_add_species', N, [N, 'string', 'string', N, N, N, N, N]),
  seed: C('db_sim_seed_species', N, [N, N, N]),
  tick: C('db_sim_tick', null, [N]),
  cycle: C('db_sim_cycle', N, [N]),
  rngState: C('db_sim_rng_state', N, [N]),
  maxRobs: C('db_sim_max_robs', N, [N]),
  dumpBots: C('db_sim_dump_bots', N, [N, N, N]),
  save: C('db_sim_save', N, [N, N]),
  load: C('db_sim_load', null, [N, N, N]),
  free: C('db_free', null, [N]),
  botText: C('db_sim_bot_text', N, [N, N]),
  // vista enriquecida (ya existente) — el acumulador vive en ella
  visReset: C('db_sim_vis_reset', null, [N]),
  visObserve: C('db_sim_vis_observe', null, [N]),
  dumpBotsVis: C('db_sim_dump_bots_vis', N, [N, N, N]),
  visSpCount: C('db_sim_vis_species_count', N, [N]),
  visSpName: C('db_sim_vis_species_name', N, [N, N]),
  // E2
  lineage: C('db_sim_dump_lineage', N, [N, N, N]),
  spStats: C('db_sim_species_stats', N, [N, N, N]),
  spOrigin: C('db_sim_species_origin', N, [N, N, N]),
  spDominant: C('db_sim_species_dominant', N, [N, N, N]),
  metrics: C('db_sim_metrics', N, [N, N, N]),
  histogram: C('db_sim_histogram', N, [N, N, N, N, N, N]),
  behEnable: C('db_sim_behavior_enable', null, [N, N]),
  behTake: C('db_sim_behavior_take', N, [N, N, N]),
};

function makeSim() {
  const h = api.create();
  api.setField(h, 12000, 9000);
  api.setMinVegs(h, 15);
  api.setMaxPop(h, 100);
  api.setRepop(h, 10, 10);
  api.setMaxEnergy(h, 10);
  api.setStartChlr(h, 16000);
  api.setMutations(h, 1);
  api.setOpt(h, 60, 1);      // defaults del panel de web/index.html
  api.setOpt(h, 61, 200);
  api.setOpt(h, 62, 1);
  api.setOpt(h, 63, 0.75);
  api.setOpt(h, 56, 400);
  api.setCost(h, 54, 1);
  api.start(h, 2718281);
  api.setSimStart(h, '2026-09-29 12:00:00');
  for (const s of SPECIES) {
    const i = api.addSpecies(h, s.dna, s.name, s.veg, 0, 3000, s.color, s.qty);
    api.seed(h, i, 0);
  }
  return h;
}

function takeStr(p) {
  if (!p) return '';
  const s = M.UTF8ToString(p);
  api.free(p);
  return s;
}

function spNames(h) {
  const out = [];
  for (let i = 0; i < api.visSpCount(h); i++) out.push(takeStr(api.visSpName(h, i)));
  return out;
}

function saveBytes(h) {
  const lenP = M._malloc(4);
  const p = api.save(h, lenP);
  const len = M.HEAP32[lenP >> 2];
  M._free(lenP);
  const bytes = new Uint8Array(M.HEAPU8.buffer, p, len).slice();
  api.free(p);
  return bytes;
}

function sameBytes(a, b) {
  if (a.length !== b.length) return `largo ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return `difieren en el byte ${i}`;
  return '';
}

// Búfer del heap reutilizable (se agranda); vistas frescas en cada uso.
const buf = { p: 0, bytes: 0 };
function heap(bytes) {
  if (bytes > buf.bytes) {
    if (buf.p) M._free(buf.p);
    buf.bytes = Math.max(bytes, 2 * buf.bytes, 4096);
    buf.p = M._malloc(buf.bytes);
  }
  return buf.p;
}
const f32 = (p, n) => new Float32Array(M.HEAPF32.buffer, p, n).slice();
const i32 = (p, n) => new Int32Array(M.HEAP32.buffer, p, n).slice();

const A = makeSim();   // con los exports
const B = makeSim();   // sin ellos
api.visReset(A);
api.behEnable(A, 1);

// Totales de comportamiento por especie (sumados sobre todas las lecturas).
const behTot = new Map();
let behTicksSeen = 0;
let sane = { rounds: 0, errs: [] };
const HIST_KINDS = 9;

function readAll(h, full) {
  const rows = api.maxRobs(h) + 1;
  // Métricas
  let p = heap(64 * 4);
  const K = api.metrics(h, p, 64);
  const m = f32(p, K);
  // Linaje
  p = heap(rows * 12 * 4);
  const nl = api.lineage(h, p, rows);
  const lin = i32(p, nl * 12);
  // Especies
  p = heap(rows * 27 * 4);
  const ns = api.spStats(h, p, rows);
  const st = f32(p, ns * 27);
  p = heap(rows * 6 * 4);
  const nd = api.spDominant(h, p, rows);
  const dom = i32(p, nd * 6);
  const spCount = api.visSpCount(h);
  const corpseIdx = spNames(h).indexOf('Corpse');
  p = heap((spCount + 1) * 5 * 4);
  const no = api.spOrigin(h, p, spCount + 1);
  const org = i32(p, no * 5);
  // Histogramas: todos los kinds, global; y DnaLen por especie y por tipo.
  const hist = [];
  for (let k = 0; k < HIST_KINDS; k++) {
    p = heap((32 + 2) * 4);
    const n = api.histogram(h, k, -1, 0, 32, p);
    hist.push({ n, v: f32(p, 34) });
  }
  const histSp = [];
  if (full) {
    for (let r = 0; r < ns; r++) {
      p = heap((16 + 2) * 4);
      const n = api.histogram(h, 0, st[r * 27], 0, 16, p);
      histSp.push({ sp: st[r * 27], n, v: f32(p, 18) });
    }
  }
  const hAnim = api.histogram(h, 1, -1, 1, 8, heap(10 * 4));
  const hVeg = api.histogram(h, 1, -1, 2, 8, heap(10 * 4));
  const hBad = api.histogram(h, 99, -1, 0, 8, heap(10 * 4));
  // dump de render para comparar filas
  p = heap(rows * 20 * 4);
  const nb = api.dumpBots(h, p, rows);
  // ADN dominante: su texto (lo que usará la foto de la decisión 9)
  if (full && nd > 0) takeStr(api.botText(h, dom[1]));
  // bins < 1: −1 y el búfer intacto (centinela)
  p = heap(8 * 4);
  M.HEAPF32.fill(-7.5, p >> 2, (p >> 2) + 8);
  const hBins0 = api.histogram(h, 0, -1, 0, 0, p);
  const hBinsNeg = api.histogram(h, 0, -1, 0, -3, p);
  const hSent = f32(p, 8).every((x) => x === -7.5);
  return { K, m, nl, lin, ns, st, nd, dom, no, org, spCount, corpseIdx, hist, histSp, hAnim, hVeg, hBad, hBins0, hBinsNeg, hSent, nb };
}

function sanity(r) {
  const e = [];
  const { m, nl, lin, ns, st, nd, dom, no, org, spCount, corpseIdx, hist, histSp, hAnim, hVeg, hBad, nb } = r;
  if (r.K !== 56) e.push(`metrics devuelve ${r.K}`);
  if (nl !== nb) e.push(`linaje ${nl} filas vs dump_bots ${nb}`);
  if (m[1] !== nl) e.push(`metrics[1] ${m[1]} vs linaje ${nl}`);
  let vivos = 0, veg = 0;
  for (let i = 0; i < nl; i++) {
    const fl = lin[i * 12 + 7];
    if (!(fl & 2)) { vivos++; if (fl & 1) veg++; }
    if (lin[i * 12 + 2] < 0 || lin[i * 12 + 2] >= spCount) e.push('especie fuera de la tabla');
  }
  if (m[2] !== vivos) e.push(`metrics[2] ${m[2]} vs vivos del linaje ${vivos}`);
  if (m[3] !== veg) e.push(`metrics[3] ${m[3]} vs vegetales del linaje ${veg}`);
  if (m[3] + m[4] !== m[2] || m[2] + m[5] !== m[1]) e.push('población no cuadra');
  let sumV = 0, sumVeg = 0, sumNrg = 0;
  for (let i = 0; i < ns; i++) {
    sumV += st[i * 27 + 1]; sumVeg += st[i * 27 + 2]; sumNrg += st[i * 27 + 3];
    const mn = st[i * 27 + 11], mean = st[i * 27 + 10], mx = st[i * 27 + 12];
    if (!(mn <= mean + 1e-3 && mean <= mx + 1e-3)) e.push(`DnaLen mín/media/máx de la especie ${st[i * 27]}`);
  }
  if (sumV !== m[2]) e.push(`suma de vivos por especie ${sumV} vs ${m[2]}`);
  if (sumVeg !== m[3]) e.push(`suma de vegetales por especie ${sumVeg} vs ${m[3]}`);
  if (ns !== m[6]) e.push(`filas de especies ${ns} vs metrics[6] ${m[6]}`);
  if (Math.abs(sumNrg - m[21]) > Math.max(1, m[21] * 1e-4)) e.push(`nrg por especie ${sumNrg} vs ${m[21]}`);
  if (nd !== ns) e.push(`dominantes ${nd} vs especies ${ns}`);
  for (let i = 0; i < nd; i++) {
    const row = st.findIndex((_, k) => k % 27 === 0 && st[k] === dom[i * 6]);
    if (row < 0 || dom[i * 6 + 3] < 1 || dom[i * 6 + 3] > st[row + 1]) e.push(`dominante de la especie ${dom[i * 6]}`);
  }
  const noEsp = spCount - (corpseIdx >= 0 ? 1 : 0);
  if (no !== noEsp) e.push(`origen ${no} filas vs tabla ${spCount} (sin Corpse: ${noEsp})`);
  for (let i = 0; i < no; i++) {
    const ix = org[i * 5];
    if (ix === corpseIdx) e.push('origen incluye la fila Corpse');
    if (i > 0 && ix <= org[(i - 1) * 5]) e.push('origen fuera de orden');
    if (org[i * 5 + 1] < 0) e.push(`origen: ciclo ${org[i * 5 + 1]} < 0`);
    if (corpseIdx >= 0 && org[i * 5 + 4] === corpseIdx) e.push('especie madre = Corpse');
  }
  if (r.hBins0 !== -1 || r.hBinsNeg !== -1 || !r.hSent) e.push(`histograma con bins < 1: ${r.hBins0}/${r.hBinsNeg}, centinela ${r.hSent}`);
  for (let k = 0; k < hist.length; k++) {
    const { n, v } = hist[k];
    let s = 0;
    for (let b = 2; b < v.length; b++) s += v[b];
    if (n !== m[2] || s !== n) e.push(`histograma ${k}: n ${n}, suma ${s}, vivos ${m[2]}`);
    if (n > 0 && v[0] > v[1]) e.push(`histograma ${k}: mín > máx`);
  }
  if (hist[0].n > 0 && (hist[0].v[0] !== m[15] || hist[0].v[1] !== m[16])) e.push('rango del histograma de DnaLen vs metrics[15/16]');
  if (hAnim + hVeg !== m[2] || hVeg !== m[3]) e.push(`histograma por tipo ${hAnim}+${hVeg} vs ${m[2]}`);
  if (hBad !== -1) e.push('kind inválido no devuelve -1');
  for (const { sp, n, v } of histSp) {
    const row = st.findIndex((_, k) => k % 27 === 0 && st[k] === sp);
    let s = 0;
    for (let b = 2; b < v.length; b++) s += v[b];
    if (n !== st[row + 1] || s !== n) e.push(`histograma de la especie ${sp}`);
    if (n > 0 && (v[0] !== st[row + 11] || v[1] !== st[row + 12])) e.push(`rango DnaLen de la especie ${sp}`);
  }
  return e;
}

function takeBehavior(h) {
  const rows = api.visSpCount(h) + 1;
  const p = heap(rows * 26 * 4);
  const n = api.behTake(h, p, rows);
  const v = f32(p, n * 26);
  for (let i = 0; i < n; i++) {
    const sp = v[i * 26];
    const t = behTot.get(sp) || new Array(26).fill(0);
    for (let c = 1; c < 25; c++) t[c] += v[i * 26 + c];
    behTot.set(sp, t);
    behTicksSeen = Math.max(behTicksSeen, v[i * 26 + 25]);
  }
  return n;
}

console.log(`\n== web2 E2: solo lectura (${CYCLES} ciclos, dos sims) ==`);
const t0 = Date.now();
let takes = 0;
for (let c = 1; c <= CYCLES; c++) {
  api.tick(A);
  api.tick(B);
  api.visObserve(A);                        // alimenta el acumulador
  if (c % 7 === 0) {                         // lecturas intercaladas
    const p = heap((api.maxRobs(A) + 1) * 24 * 4);
    api.dumpBotsVis(A, p, api.maxRobs(A) + 1);
    const r = readAll(A, c % 35 === 0);
    if (c % 35 === 0) {
      sane.rounds++;
      for (const e of sanity(r)) if (sane.errs.length < 20) sane.errs.push(`ciclo ${c}: ${e}`);
    }
  }
  if (c % 50 === 0) { takeBehavior(A); takes++; }
  if (CHECKPOINTS.has(c)) {
    const a = saveBytes(A), b = saveBytes(B);
    const d = sameBytes(a, b);
    check(`.dbsim idéntico en el ciclo ${api.cycle(A)}`, !d, d || `${a.length} bytes`);
    check(`LCG idéntico en el ciclo ${api.cycle(A)}`, api.rngState(A) === api.rngState(B),
      `${api.rngState(A)} / ${api.rngState(B)}`);
  }
}
takeBehavior(A);
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

console.log('\n== cordura de los valores ==');
check(`chequeos cruzados en ${sane.rounds} lecturas`, sane.errs.length === 0,
  sane.errs.length ? sane.errs.join('; ') : 'linaje = dump_bots, Σ especies = vivos, histogramas = vivos');
const fin = readAll(A, true);
const names = spNames(A);
console.log(`  población: ${fin.m[2]} vivos (${fin.m[3]} vegetales), ${fin.m[5]} cadáveres, ` +
  `${fin.m[6]} especies vivas de ${names.length} vistas; gen. máx ${fin.m[11]}, ` +
  `DnaLen ${fin.m[15]}..${fin.m[16]}, shots en vuelo ${fin.m[35]}, lazos ${fin.m[37]}`);
const idx = (n) => names.indexOf(n);
const tot = (n) => behTot.get(idx(n)) || new Array(26).fill(0);
const an = tot('Animal_Minimalis.txt');
const shotsAll = [...behTot.values()].reduce((s, t) => s + t.slice(1, 11).reduce((x, y) => x + y, 0), 0);
const births = [...behTot.values()].reduce((s, t) => s + t[12], 0);
const repro = [...behTot.values()].reduce((s, t) => s + t[11], 0);
const deaths = [...behTot.values()].reduce((s, t) => s + t[23], 0);
check('Animal Minimalis dispara -1 (col 1)', an[1] > 0, `${an[1]} disparos -1`);
check('hubo disparos en total', shotsAll > 0, `${shotsAll}`);
check('hubo nacimientos y reproducciones', births > 0 && repro > 0 && repro <= births,
  `${births} nacimientos, ${repro} con madre viva`);
check('hubo muertes', deaths > 0, `${deaths}`);
const vz = tot('Animal_Minimaxis_2_F1_-Venom-_-05.01.07.txt');
console.log(`  Minimaxis venom: disparos por tipo ${vz.slice(1, 11).join(',')}; venom +${vz[19]} veces`);
check('ticks del acumulador', behTicksSeen > 0 && behTicksSeen <= 50, `${behTicksSeen} por lectura (${takes} lecturas)`);
const nCorpse = names.includes('Corpse') ? 1 : 0;
check('origen: una fila por especie de la tabla (sin Corpse)', fin.no === names.length - nCorpse,
  `${fin.no} filas, ${names.length} en la tabla (Corpse: ${nCorpse ? 'sí' : 'no'}); ` +
  `autoespeciadas: ${names.filter((n) => n.startsWith('(')).length}`);
check('histograma con bins < 1 → −1 sin escribir', fin.hBins0 === -1 && fin.hBinsNeg === -1 && fin.hSent);
const mutOrigin = [];
for (let i = 0; i < fin.no; i++) if (fin.org[i * 5 + 4] >= 0) mutOrigin.push(`${names[i]}←${names[fin.org[i * 5 + 4]]}`);
if (mutOrigin.length) console.log(`  orígenes con especie madre: ${mutOrigin.slice(0, 4).join(', ')}${mutOrigin.length > 4 ? ' …' : ''}`);

// El acumulador apagado no cuenta más.
api.behEnable(A, 0);
for (let c = 0; c < 20; c++) { api.tick(A); api.tick(B); api.visObserve(A); }
const nOff = api.behTake(A, heap(4096 * 26 * 4), 4096);
check('apagado no acumula', nOff === 0, `${nOff} filas`);
const d = sameBytes(saveBytes(A), saveBytes(B));
check(`.dbsim idéntico tras apagar (ciclo ${api.cycle(A)})`, !d, d);

const saved = saveBytes(B);
api.destroy(A);
api.destroy(B);

// Lectura completa del acumulador: suma por especie (cols 1..24) y los
// ticks (col 25) de cada fila, leyendo en tandas de max_rows hasta que
// devuelva menos filas que max_rows.
function takeAll(h, maxRows) {
  const sum = new Map();
  const ticks = [];
  let calls = 0;
  for (;;) {
    const p = heap(maxRows * 26 * 4);
    const n = api.behTake(h, p, maxRows);
    calls++;
    const v = f32(p, n * 26);
    for (let i = 0; i < n; i++) {
      const sp = v[i * 26];
      const t = sum.get(sp) || new Array(26).fill(0);
      for (let c = 1; c < 25; c++) t[c] += v[i * 26 + c];
      sum.set(sp, t);
      ticks.push(v[i * 26 + 25]);
    }
    if (n < maxRows || calls > 10000) break;
  }
  return { sum, ticks, calls };
}
const sumCol = (sum, c) => [...sum.values()].reduce((s, t) => s + t[c], 0);

function loadSim(bytes) {
  const h = api.create();
  const p = M._malloc(bytes.length);
  M.HEAPU8.set(bytes, p);
  api.load(h, p, bytes.length);
  M._free(p);
  return h;
}

// (a) .dbsim guardado → dos handles: LA con todos los exports y el
// acumulador (con tandas parciales, y apagado y vuelto a encender a mitad:
// caso f); LB sin nada. Bytes y LCG en varios puntos.
const LOAD_CYCLES = 400;
const LOAD_CP = new Set([1, 100, 250, LOAD_CYCLES]);
console.log(`\n== .dbsim cargado (${saved.length} bytes) en dos handles, ${LOAD_CYCLES} ciclos ==`);
const t1 = Date.now();
const LA = loadSim(saved);
const LB = loadSim(saved);
api.behEnable(LA, 1);
const errsAntes = sane.errs.length;
let offTake = null, onTake = null;
for (let c = 1; c <= LOAD_CYCLES; c++) {
  api.tick(LA);
  api.tick(LB);
  api.visObserve(LA);
  if (c % 5 === 0) {
    const p = heap((api.maxRobs(LA) + 1) * 24 * 4);
    api.dumpBotsVis(LA, p, api.maxRobs(LA) + 1);
    const r = readAll(LA, c % 25 === 0);
    if (c % 25 === 0)
      for (const e of sanity(r)) if (sane.errs.length < 40) sane.errs.push(`cargado, ciclo ${c}: ${e}`);
  }
  if (c % 40 === 0 && c < 150) takeAll(LA, 1 + (c % 3));
  // (f) apagar a los 150; 29 ticks observados sin acumular; encender a los
  // 180; 10 ticks observados.
  if (c === 150) { takeAll(LA, 4096); api.behEnable(LA, 0); }
  if (c === 179) offTake = takeAll(LA, 4096);
  if (c === 180) api.behEnable(LA, 1);
  if (c === 190) onTake = takeAll(LA, 4096);
  if (c > 190 && c % 40 === 0) takeAll(LA, 2);
  if (LOAD_CP.has(c)) {
    const a = saveBytes(LA), b = saveBytes(LB);
    const d = sameBytes(a, b);
    check(`cargado: .dbsim idéntico en el ciclo ${api.cycle(LA)}`, !d, d || `${a.length} bytes`);
    check(`cargado: LCG idéntico en el ciclo ${api.cycle(LA)}`, api.rngState(LA) === api.rngState(LB),
      `${api.rngState(LA)} / ${api.rngState(LB)}`);
  }
}
console.log(`  (${((Date.now() - t1) / 1000).toFixed(1)} s)`);
check('cargado: chequeos cruzados', sane.errs.length === errsAntes, sane.errs.slice(errsAntes).join('; '));
check('(f) apagado 29 ticks: nada acumulado', offTake.sum.size === 0, `${offTake.sum.size} filas`);
check('(f) reencendido: cuenta solo desde el enable', onTake.ticks.length > 0 && onTake.ticks.every((t) => t === 10),
  `ticks por fila ${[...new Set(onTake.ticks)].join(',')} (esperado 10), ${onTake.sum.size} especies`);

// (c) take con max_rows = 1 no pierde filas. LA y LB siguen idénticas
// (bytes comprobados arriba): se encienden las dos desde cero, 60 ticks
// observados, y se lee LA de una vez y LB de a una fila.
api.behEnable(LA, 1);
api.behEnable(LB, 1);
for (let c = 0; c < 60; c++) {
  api.tick(LA); api.tick(LB);
  api.visObserve(LA); api.visObserve(LB);
}
{
  const big = takeAll(LA, 4096);
  const one = takeAll(LB, 1);
  let same = big.sum.size === one.sum.size && big.sum.size > 1;
  for (const [sp, t] of big.sum) {
    const u = one.sum.get(sp);
    if (!u || t.some((x, c) => x !== u[c])) same = false;
  }
  check('(c) take con max_rows=1 en tandas = take de una vez', same,
    `${big.sum.size} especies con actividad; ${one.calls} llamadas de a 1 fila`);
  check('(c) ticks = 60 en todas las filas', one.ticks.every((t) => t === 60) &&
    big.ticks.every((t) => t === 60), `${[...new Set(one.ticks)].join(',')}`);
  // La lectura completa (última tanda) volvió el contador a 0.
  api.tick(LB); api.visObserve(LB);
  api.tick(LB); api.visObserve(LB);
  const again = takeAll(LB, 4096);
  check('(c) tras leer todo, el contador de ticks vuelve a empezar',
    again.ticks.length > 0 && again.ticks.every((t) => t === 2), `${[...new Set(again.ticks)].join(',')}`);
}
api.destroy(LA);
api.destroy(LB);

// (b) Acumulador encendido con foto vieja: la vista se primó al principio,
// 2500 ticks sin observe, enable, 1 tick + observe → solo ese tick.
console.log('\n== acumulador con foto vieja ==');
{
  const h = makeSim();
  api.visReset(h);
  for (let c = 0; c < 2500; c++) api.tick(h);
  api.behEnable(h, 1);
  api.tick(h);
  api.visObserve(h);
  const r = takeAll(h, 4096);
  const births = sumCol(r.sum, 12), deaths = sumCol(r.sum, 23);
  const shots = [...r.sum.values()].reduce((s, t) => s + t.slice(1, 11).reduce((x, y) => x + y, 0), 0);
  check('(b) ticks = 1 tras enable + 1 tick', r.ticks.length > 0 && r.ticks.every((t) => t === 1),
    `${[...new Set(r.ticks)].join(',')}`);
  check('(b) nacimientos y muertes de un solo tick', births <= 5 && deaths <= 10,
    `${births} nacimientos, ${deaths} muertes, ${shots} disparos`);
  api.destroy(h);
}

// (d) está en cada lectura (bins 0 y −3 con búfer centinela); (e) sim vacía.
console.log('\n== sim vacía (0 bots) ==');
{
  const h = api.create();
  api.setField(h, 8000, 6000);
  api.start(h, 12345);
  api.visReset(h);
  api.behEnable(h, 1);
  for (let c = 0; c < 5; c++) { api.tick(h); api.visObserve(h); }
  const rows = api.maxRobs(h) + 1;
  const r = readAll(h, true);
  const nb = api.behTake(h, heap(rows * 26 * 4), rows);
  const nVis = api.dumpBotsVis(h, heap(rows * 24 * 4), rows);
  const finite = [...r.m].every(Number.isFinite) &&
    r.hist.every(({ v }) => [...v].every(Number.isFinite));
  const zeros = r.nl === 0 && r.ns === 0 && r.nd === 0 && r.no === 0 && nb === 0 && nVis === 0 &&
    r.hist.every(({ n, v }) => n === 0 && v.every((x) => x === 0)) && r.hAnim === 0 && r.hVeg === 0;
  check('(e) sin bots: todos los volcados devuelven 0', zeros,
    `linaje ${r.nl}, especies ${r.ns}, dominantes ${r.nd}, origen ${r.no}, take ${nb}, vis ${nVis}, hist ${r.hist[0].n}`);
  check('(e) sin bots: métricas sin NaN y población 0', r.K === 56 && finite &&
    r.m[1] === 0 && r.m[2] === 0 && r.m[6] === 0, `metrics devuelve ${r.K} (largo del vector), ciclo ${r.m[0]}`);
  check('(e) sin bots: histograma bins < 1 → −1 sin escribir', r.hBins0 === -1 && r.hBinsNeg === -1 && r.hSent);
  api.destroy(h);
}

console.log(`\n${pass} ok, ${fail} fallas  (${((Date.now() - t0) / 1000).toFixed(1)} s en total)`);
process.exit(fail ? 1 : 0);
