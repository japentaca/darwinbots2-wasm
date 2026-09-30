#!/usr/bin/env node
// Copia de tools/e10/smoke_liga.mjs contra engine/ (paso E1.2, decisión C6
// de port/web2/PLAN.md): los mismos chequeos, con engine/league.js en vez de
// web/league.js en un vm. La primera parte usa la API wasm directa
// (db_sim_f1_cap(h, mode), como el original: una especie numerosa y flaca
// contra una escasa y gorda). Si falta port/build-wasm/dbcore.wasm esa parte
// no corre (el resto sí) y el smoke sale con código 2, como el original: no
// pasa en verde sin haber probado el criterio del tope.
//
//   node test/smokes/smoke_liga.mjs     (desde port/web2/)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as LG from '../../engine/league.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT_DIR = path.resolve(here, '..', '..', '..');
const HAY_WASM = fs.existsSync(path.join(PORT_DIR, 'build-wasm', 'dbcore.wasm'));

let pass = 0,
  fail = 0;
function check(name, ok, extra = '') {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

if (HAY_WASM) {
  const DNA_STILL = 'cond start 0 .up store stop';
  const COL_MANY = 0x3080ff,
    COL_FEW = 0x20c040;

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
    addSpecies: C('db_sim_add_species', 'number', [
      'number',
      'string',
      'string',
      'number',
      'number',
      'number',
      'number',
      'number',
    ]),
    seed: C('db_sim_seed_species', 'number', ['number', 'number', 'number']),
    f1Start: C('db_sim_f1_start', 'number', ['number']),
    f1Cap: C('db_sim_f1_cap', 'number', ['number', 'number']),
    dumpBots: C('db_sim_dump_bots', 'number', ['number', 'number', 'number']),
  };

  // Vivos por color (float 6 del volcado; flags bit2 = cadáver).
  function alive(h) {
    const cap = 256,
      buf = M._malloc(cap * 20 * 4);
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
    api.setOpt(h, 91, 1); // F1
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
  check(
    'mode 0 (más bots): queda la numerosa',
    pop.killed === 1 && pop.many === 3 && pop.few === 0,
    `many ${pop.many} · few ${pop.few}`,
  );
  const nrg = contest(1);
  check(
    'mode 1 (más energía): queda la gorda',
    nrg.killed === 1 && nrg.many === 0 && nrg.few === 2,
    `many ${nrg.many} · few ${nrg.few}`,
  );
} else {
  console.log('\n== db_sim_f1_cap: criterio ==');
  console.log('  (no corrió: falta build-wasm/dbcore.wasm; el smoke sale con código 2)');
}

console.log('\n== league.js: todos contra todos ==');
// Solo las funciones puras del calendario (engine/league.js).
const ctx = LG;
for (const n of [2, 3, 4, 5, 6, 7]) {
  for (const legs of [1, 2]) {
    const fx = ctx.lgRrFixtures(n, legs);
    const want = ((n * (n - 1)) / 2) * legs;
    const seen = new Map();
    for (const f of fx) {
      const [x, y] = f.pair;
      const k = `${Math.min(x, y)},${Math.max(x, y)}`;
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    const even = [...seen.values()].every((v) => v === legs);
    // Con 2 vueltas, cada pareja se siembra una vez en cada orden.
    let swapped = true;
    if (legs === 2) {
      const order = new Map();
      for (const f of fx) {
        const k = `${Math.min(...f.pair)},${Math.max(...f.pair)}`;
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
    check(
      `n=${n} vueltas=${legs}`,
      fx.length === want && seen.size === (n * (n - 1)) / 2 && even && swapped && rounds,
      `${fx.length} partidos`,
    );
  }
}

console.log('\n== league.js: rey de la colina, enfrentamientos, Elo ==');
{
  const E = ['A', 'B', 'C'].map((name) => ({ name, color: '#fff' }));
  const S = { entrants: E, fmt: { format: 'koth', retire: 2 } };
  const M = (winner, ...fighters) => ({ winner, fighters });
  // A gana dos seguidas (se retira), B abre, un nulo no cuenta, C le gana a todos.
  const ms = [
    M('A', 'A', 'B'),
    M('A', 'A', 'C'),
    M('B', 'B', 'C'),
    M('', 'C', 'B'),
    M('C', 'B', 'C', 'A'),
  ];
  const k = ctx.lgKothState(S, ms);
  check(
    'retiro invicto a las 2 y campeón nuevo',
    k.titles.get('A') === 1 && k.champ === 'C' && k.streak === 1,
    `títulos A ${k.titles.get('A')} · campeón ${k.champ} · racha ${k.streak}`,
  );
  const h = ctx.lgH2H(ms);
  check(
    'enfrentamientos: el ganador le gana a cada uno de los demás',
    h('A', 'B') === 1 &&
      h('A', 'C') === 1 &&
      h('B', 'C') === 1 &&
      h('C', 'B') === 1 &&
      h('C', 'A') === 1 &&
      h('B', 'A') === 0,
    'A>B 1, A>C 1, B>C 1, C>B 1, C>A 1',
  );
  const st = ctx.lgStandings(S, ms);
  const sum = st.reduce((a, r) => a + r.elo, 0);
  const a = st.find((r) => r.name === 'A');
  check(
    'Elo de suma cero y el nulo no cuenta',
    Math.abs(sum - 4500) < 1e-9 && a.p === 3 && a.w === 2,
    `suma ${sum.toFixed(6)} · A ${a.p} PJ ${a.w} G`,
  );
}

console.log('\n== league.js: escalera (L3, populateladder) ==');
{
  const E = ['A', 'B', 'C', 'D'].map((name) => ({ name, color: '#fff' }));
  const S = { entrants: E, fmt: { format: 'ladder' } };
  const M = (winner, a, b) => ({ winner, fighters: [a, b] });
  const st0 = ctx.lgLadderState(S, []);
  check(
    'arranque: A en el peldaño 1 y B lo desafía',
    st0.ladder.join() === 'A' && st0.next[0].name === 'A' && st0.next[1].name === 'B',
  );
  // B pierde con A (queda último); C le gana a A (sube al 1); D pierde con C
  // y con A, le gana a B (ocupa el peldaño 3); un nulo no cuenta.
  const ms = [
    M('A', 'A', 'B'),
    M('C', 'A', 'C'),
    M('C', 'C', 'D'),
    M('', 'A', 'D'),
    M('A', 'A', 'D'),
    M('D', 'B', 'D'),
  ];
  const mid = ctx.lgLadderState(S, ms.slice(0, 4));
  check(
    'a mitad: D desafía el peldaño 2 (A)',
    mid.next && mid.next[0].name === 'A' && mid.rung === 2,
    `escalera ${mid.ladder.join(' ')}`,
  );
  const st = ctx.lgLadderState(S, ms);
  const tab = ctx
    .lgStandings(S, ms)
    .map((r) => r.name)
    .join(' ');
  check(
    'escalera final C A D B, temporada completa y la tabla en su orden',
    st.ladder.join(' ') === 'C A D B' && !st.next && tab === 'C A D B',
    `tabla ${tab}`,
  );
}

console.log('\n== league.js: exportar e importar (L3) ==');
{
  const ent = (name, dna) => ({
    name,
    dna,
    hash: ctx.lgHash(dna),
    src: 'form',
    file: '',
    color: '#123456',
  });
  const L = {
    id: 'Lviejo',
    name: 'Copa',
    notes: 'n',
    created: '2026-09-27T00:00:00.000Z',
    seasons: [
      {
        no: 1,
        started: 's1',
        rules: { 'o-fw': '9237', 'o-c1': '0' },
        fmt: { format: 'rr', legs: 2, qty: 5 },
        entrants: [ent('A', 'cond start 0 .up store stop'), ent('B', '10 .dx store')],
      },
      {
        no: 2,
        started: 's2',
        rules: { 'o-fw': '1000' },
        fmt: { format: 'koth', k: 3, retire: 4 },
        entrants: [ent('A', 'cond start 0 .up store stop')],
      },
    ],
  };
  const ms = [
    {
      id: 7,
      league: 'Lviejo',
      season: 2,
      no: 1,
      fighters: ['A', 'B'],
      seed: 42,
      winner: 'A',
      wins: [3, 1],
      cycles: 900,
    },
    {
      id: 3,
      league: 'Lviejo',
      season: 1,
      no: 1,
      fighters: ['B', 'A'],
      seed: 99,
      winner: 'B',
      wins: [3, 0],
      cycles: 500,
    },
    {
      id: 5,
      league: 'Otra',
      season: 1,
      no: 1,
      fighters: ['X', 'Y'],
      seed: 1,
      winner: 'X',
      wins: [3, 0],
      cycles: 1,
    },
  ];
  const file = JSON.parse(JSON.stringify(ctx.lgExportObj(L, ms)));
  check(
    'el archivo no lleva ids ni los partidos de otra liga',
    !('id' in file.league) &&
      file.matches.length === 2 &&
      file.matches.every((m) => !('id' in m) && !('league' in m)) &&
      file.matches[0].seed === 99,
    `${file.matches.length} partidos, el primero de la temporada ${file.matches[0].season}`,
  );
  const r = ctx.lgImportObj(file, new Set(['Copa', 'Copa (imported)']), 'Lnuevo');
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const shape = (ss) =>
    ss.map((s) => [s.no, s.rules, s.entrants.map((e) => [e.name, e.dna, e.hash])]);
  check(
    'ida y vuelta: temporadas, reglas, formato y ADN iguales',
    same(shape(r.L.seasons), shape(L.seasons)) &&
      r.L.seasons[0].fmt.legs === 2 &&
      r.L.seasons[1].fmt.retire === 4 &&
      r.L.seasons[1].fmt.cap === 5000,
  );
  check(
    'id nuevo, nombre sin repetir y partidos reasignados',
    r.L.id === 'Lnuevo' &&
      r.L.name === 'Copa (imported) 2' &&
      r.matches.length === 2 &&
      r.matches.every((m) => m.league === 'Lnuevo' && !('id' in m)) &&
      same(
        r.matches.map((m) => [m.season, m.seed, m.winner, m.wins, m.cycles]),
        [
          [1, 99, 'B', [3, 0], 500],
          [2, 42, 'A', [3, 1], 900],
        ],
      ),
    r.L.name,
  );
  let bad = 0;
  for (const o of [
    null,
    { kind: 'x' },
    { kind: 'darwinbots-league', version: 99, league: L },
    { kind: 'darwinbots-league', version: 1, league: { seasons: [] } },
    {
      kind: 'darwinbots-league',
      version: 1,
      league: { seasons: [{ rules: {}, entrants: [{ name: 'A' }] }] },
    },
  ]) {
    try {
      ctx.lgImportObj(o, new Set(), 'L');
    } catch (_e) {
      bad++;
    }
  }
  check('rechaza archivos que no son ligas o están incompletos', bad === 5, `${bad}/5`);
}

console.log(`\n${pass} ok, ${fail} fallas`);
if (!fail && !HAY_WASM)
  console.error('falta build-wasm/dbcore.wasm (cmake --build --preset wasm --target dbcore.js)');
process.exit(fail ? 1 : HAY_WASM ? 0 : 2);
