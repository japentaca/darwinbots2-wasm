#!/usr/bin/env node
// PP-01 — smoke de la rejilla con campo chico bajo node (wasm).
//
// Hasta PP-01, sembrar 15 algas (el preset de la página) en 4000x3000 daba
// "Maximum call stack size exceeded": con un eje de menos de 4000 la
// rejilla de Quads.bas quedaba en 0 celdas y EnsureBuckets recursaba sin
// fin (70-CASOS-DORADOS.md §15). Ahora el port da 1 celda por eje.
//
//   node tools/pp/smoke_campo.mjs     (desde port/, con build-wasm/)
import path from 'node:path';
import fs from 'node:fs';
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
  numBots: C('db_sim_total_robots', 'number', ['number']),
};

// El Alga Minimalis del preset de web/index.html.
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

console.log('\n== siembra y ticks con campos chicos (PP-01) ==');
for (const [w, h] of [[4000, 3000], [3000, 4000], [2000, 1500], [8000, 6000]]) {
  const sim = api.create();
  let seeded = -1, err = '';
  try {
    api.setField(sim, w, h);
    api.start(sim, 4242);
    const sp = api.addSpecies(sim, ALGA, 'Alga_Minimalis.txt', 1, 0, 3000, 0x30d030, 15);
    seeded = api.seed(sim, sp, 0);
    for (let t = 0; t < 1000; t++) api.tick(sim);
  } catch (e) {
    err = e.message;
  }
  check(`${w}×${h}: 15 algas sembradas`, seeded === 15, err || `n = ${seeded}`);
  const n = err ? 0 : api.numBots(sim);
  check(`${w}×${h}: 1000 ticks sin desborde`, !err && n > 0, err || `${n} bots vivos`);
  api.destroy(sim);
}

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
