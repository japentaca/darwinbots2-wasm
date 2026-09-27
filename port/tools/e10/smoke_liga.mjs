#!/usr/bin/env node
// E10 — smoke del criterio del tope de ciclos de las ligas
// (spec/PLAN-EXTENSIONES.md §E10). API wasm directa: db_sim_f1_cap(h, mode)
// con una especie numerosa y flaca contra una escasa y gorda. mode 0 (el
// del Canal) deja viva la numerosa; mode 1 (liga con "most energy"), la
// gorda. Más el calendario de todos contra todos de web/league.js.
//
//   node tools/e10/smoke_liga.mjs     (desde port/, con build-wasm/)
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT_DIR = path.resolve(here, '..', '..');
if (!fs.existsSync(path.join(PORT_DIR, 'build-wasm', 'dbcore.wasm'))) {
  console.error('falta build-wasm/dbcore.wasm (cmake --build --preset wasm --target dbcore.js)');
  process.exit(2);
}

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ok   ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}

const DNA_STILL = 'cond start 0 .up store stop';
const COL_MANY = 0x3080ff, COL_FEW = 0x20c040;

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
  addSpecies: C('db_sim_add_species', 'number', ['number','string','string','number','number','number','number','number']),
  seed: C('db_sim_seed_species', 'number', ['number','number','number']),
  f1Start: C('db_sim_f1_start', 'number', ['number']),
  f1Cap: C('db_sim_f1_cap', 'number', ['number', 'number']),
  dumpBots: C('db_sim_dump_bots', 'number', ['number','number','number']),
};

// Vivos por color (float 6 del volcado; flags bit2 = cadáver).
function alive(h) {
  const cap = 256, buf = M._malloc(cap * 20 * 4);
  const n = api.dumpBots(h, buf, cap);
  const f = new Float32Array(M.HEAPF32.buffer, buf, n * 20).slice();
  M._free(buf);
  const by = new Map();
  for (let i = 0; i < n; i++) {
    if (f[i * 20 + 7] & 4) continue;
    const c = f[i * 20 + 6];
    by.set(c, (by.get(c) || 0) + 1);
  }
  return by;
}

function contest(mode) {
  const h = api.create();
  api.setField(h, 9237, 6928);
  api.setOpt(h, 91, 1);                       // F1
  // Al sembrar, cada bot trae body 1000 (10000 de medida): la gorda gana
  // por nrg con 3 contra 2 (3 × 10200 < 2 × 30000).
  const a = api.addSpecies(h, DNA_STILL, 'Many.txt', 0, 0, 200, COL_MANY, 3);
  const b = api.addSpecies(h, DNA_STILL, 'Few.txt', 0, 0, 20000, COL_FEW, 2);
  api.start(h, 12345);
  api.seed(h, a, 3);
  api.seed(h, b, 2);
  const ts = api.f1Start(h);
  const killed = api.f1Cap(h, mode);
  const by = alive(h);
  api.destroy(h);
  return { ts, killed, many: by.get(COL_MANY) || 0, few: by.get(COL_FEW) || 0 };
}

console.log('\n== db_sim_f1_cap: criterio ==');
const pop = contest(0);
check('censo de 2 especies', pop.ts === 2, `TotSpecies ${pop.ts}`);
check('mode 0 (más bots): queda la numerosa', pop.killed === 1 && pop.many === 3 && pop.few === 0,
      `many ${pop.many} · few ${pop.few}`);
const nrg = contest(1);
check('mode 1 (más energía): queda la gorda', nrg.killed === 1 && nrg.many === 0 && nrg.few === 2,
      `many ${nrg.many} · few ${nrg.few}`);

console.log('\n== league.js: todos contra todos ==');
// Solo las funciones puras del calendario (sin DOM).
const src = fs.readFileSync(path.join(PORT_DIR, 'web', 'league.js'), 'utf8');
const ctx = { indexedDB: null };
vm.createContext(ctx);
vm.runInContext(src + '\nthis.lgRrFixtures = lgRrFixtures;', ctx);
for (const n of [2, 3, 4, 5, 6, 7]) {
  for (const legs of [1, 2]) {
    const fx = ctx.lgRrFixtures(n, legs);
    const want = (n * (n - 1) / 2) * legs;
    const seen = new Map();
    for (const f of fx) {
      const [x, y] = f.pair;
      const k = Math.min(x, y) + ',' + Math.max(x, y);
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    const even = [...seen.values()].every((v) => v === legs);
    // Con 2 vueltas, cada pareja se siembra una vez en cada orden.
    let swapped = true;
    if (legs === 2) {
      const order = new Map();
      for (const f of fx) {
        const k = Math.min(...f.pair) + ',' + Math.max(...f.pair);
        (order.get(k) || order.set(k, []).get(k)).push(f.pair[0]);
      }
      swapped = [...order.values()].every((v) => v[0] !== v[1]);
    }
    // Jornadas: dentro de cada bloque de floor(n/2) partidos nadie repite.
    const per = Math.floor(n / 2);
    let rounds = true;
    for (let i = 0; i < fx.length; i += per) {
      const ids = fx.slice(i, i + per).flatMap((f) => f.pair);
      if (new Set(ids).size !== ids.length) rounds = false;
    }
    check(`n=${n} vueltas=${legs}`, fx.length === want && seen.size === n * (n - 1) / 2 && even && swapped && rounds,
          `${fx.length} partidos`);
  }
}

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
