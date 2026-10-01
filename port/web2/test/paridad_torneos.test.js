// @ts-check
// Paridad de los torneos (paso E1.2, decisión C6 de port/web2/PLAN.md):
// port/web/league.js (con contest.js y tournament.js), cargados en un vm
// como los smokes de tools/, contra engine/league.js, engine/torneos.js y
// engine/partido.js. Los mismos casos en las dos y deepStrictEqual sobre los
// resultados: calendarios y cruces de todos los formatos con varios N y
// semillas, suizo con byes y nulos, copa con bombos y desempates, colina con
// y sin fin, escalera, Elo, Hall of Fame, sorteos con semilla, el registro
// de los partidos, exportar → importar v1 y v2 y migraciones. Sin wasm: los
// resultados de los partidos los inventa el test.
//
// Los rótulos (texto en la clásica, {clave, params} en engine/) se comparan
// pasando los de engine/ por test/smokes/rotulos_en.mjs; lo mismo el avance
// (tnProgress), el aviso de sorteo (tnDrawHint) y el de todos contra todos
// (tnRrWarn) con los formateadores de abajo. Las fechas (created, started,
// date, exported) no se comparan.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as E from '../engine/league.js';
import * as P from '../engine/partido.js';
import { crearTorneos } from '../engine/torneos.js';
import { almacenMemoria } from '../engine/torneos-db.js';
import { errorEn, HOW_EN, rotuloEn } from './smokes/rotulos_en.mjs';
import { depsDePrueba } from './util/torneos-deps.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, '..', '..', 'web');

// ---- Generador con semilla (mulberry32), igual en las dos --------------------------
const MULBERRY = `(seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }`;
/** @type {(seed: number) => () => number} */
const rng = new Function(`return ${MULBERRY}`)();

// ---- La clásica en un vm -----------------------------------------------------------
/** @param {any} [extra] */
function clasica(extra = {}) {
  const store = new Map();
  /** @type {any} */
  const ctx = {
    indexedDB: null,
    // tournament.js dibuja desde lgRender: sin ventana ni zócalo, no hace nada.
    document: { getElementById: () => null, fullscreenElement: null },
    log: () => {},
    console,
    invColor: () => '#rnd',
    localStorage: {
      getItem: (/** @type {string} */ k) => (store.has(k) ? store.get(k) : null),
      setItem: (/** @type {string} */ k, /** @type {any} */ v) => store.set(k, String(v)),
      removeItem: (/** @type {string} */ k) => store.delete(k),
    },
    inv: { items: [], sel: new Set(), sets: new Map() },
    userRec: () => ({ fav: false, tags: [] }),
    invFetchDna: async () => {
      throw new Error('no');
    },
    ...extra,
  };
  vm.createContext(ctx);
  for (const f of ['league.js', 'contest.js', 'tournament.js'])
    vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
  vm.runInContext(
    `Object.assign(this, { lg, LG_FMT_DEFAULT, LG_HOW, LG_SCRATCH_ID, lgSeason, lgDrawClean,
      lgRrFixtures, lgRrState, lgKothState, lgKothClean, lgKothCap, lgSeasonDone, lgSeasonChampion,
      lgLadderState, lgCupGroups, lgCupGroupsOk, lgCupDraw, lgCupState, lgShuffle, lgSwissRounds,
      lgSwissRec, lgSwissTable, lgSwissPair, lgSwissDraw, lgSwissState, lgFixture, lgElo, lgStandings,
      lgAllTime, lgH2H, lgMigrate, lgNewLeague, lgScratchNew, lgPromote, lgSeasonNext, lgExportObj,
      lgImportObj, lgAddEntrant, lgLaunchList, lgHash, lgNewSeason, lgLiveSync, lgLiveFill, lgRedraw,
      lgSelect, lgRecord, leagueOnMessage, lgReplayCheck, lgMigrateRoster, lgOldHofFile, lgOldHofDiscard, lgPool,
      lgUniqueName, lgFileName, contestWinsNeeded, contestMinLength, contestRoundWinner,
      tnProgress, tnDrawHint, tnRrWarn });
    this.__store = null;`,
    ctx,
  );
  ctx.__store = store;
  /** @param {number} seed */
  ctx.semilla = (seed) => {
    ctx.__seed = seed;
    vm.runInContext(`Math.random = (${MULBERRY})(__seed);`, ctx);
  };
  return ctx;
}
const C = clasica();

// ---- Normalización -----------------------------------------------------------------
const FECHAS = new Set(['created', 'started', 'date', 'exported']);
/** Estructura plana del reino principal (el vm tiene sus propios prototipos). @param {any} x @returns {any} */
function norm(x) {
  const tag = Object.prototype.toString.call(x);
  if (tag === '[object Map]') return { $map: [...x.entries()].map(norm) };
  if (tag === '[object Set]') return { $set: [...x.values()].map(norm) };
  if (Array.isArray(x)) return Array.from(x, norm); // del reino principal (map daría uno del vm)
  if (x && typeof x === 'object') {
    /** @type {any} */
    const o = {};
    for (const k of Object.keys(x)) if (!FECHAS.has(k)) o[k] = norm(x[k]);
    return o;
  }
  return x;
}
/** Los rótulos de engine/ en el texto de la clásica. @param {any} x @returns {any} */
function txt(x) {
  if (Array.isArray(x)) return x.map(txt);
  const tag = Object.prototype.toString.call(x);
  if (tag === '[object Map]') return new Map([...x.entries()].map(([k, v]) => [k, txt(v)]));
  if (x && typeof x === 'object') {
    /** @type {any} */
    const o = {};
    for (const k of Object.keys(x)) {
      const v = x[k];
      o[k] =
        k === 'label' && (v === null || (v && typeof v === 'object' && 'clave' in v))
          ? rotuloEn(v)
          : txt(v);
    }
    return o;
  }
  return x;
}
/** @param {any} got @param {any} want @param {string} [msg] */
const igual = (got, want, msg) => assert.deepStrictEqual(norm(txt(got)), norm(want), msg);
// La nueva elige otros colores que la clásica (nunca verdes ni parecidos entre
// participantes): para comparar el resto, se quitan los colores de ambos lados.
/** @param {any} x @returns {any} */
function sinColor(x) {
  if (Array.isArray(x)) return x.map(sinColor);
  if (Object.prototype.toString.call(x) === '[object Object]') {
    /** @type {any} */
    const o = {};
    for (const k of Object.keys(x)) if (k !== 'color') o[k] = sinColor(x[k]);
    return o;
  }
  return x;
}
/** @param {any} got @param {any} want @param {string} [msg] */
const igualSinColor = (got, want, msg) => igual(sinColor(got), sinColor(want), msg);

// Avance (tnProgress), aviso de sorteo (tnDrawHint) y de todos contra todos
// (tnRrWarn) con el texto de la clásica.
/** @param {any} p */
function progresoEn(p) {
  if (!p) return '';
  const q = p.params;
  switch (p.clave) {
    case 'complete':
      return '🏁 complete';
    case 'rr':
      return `${q.played} of ${q.total} fixtures played`;
    case 'ladder':
      return `${q.placed} of ${q.n} on the ladder`;
    case 'cup-size':
      return 'needs 8, 16 or 32 entrants';
    case 'cup-draw':
      return 'groups not drawn yet';
    case 'cup-groups':
      return `group stage: ${q.played} of ${q.total} matches`;
    case 'cup-ko':
      return `knockout: ${rotuloEn(q.label).split(' · ')[0]}`;
    case 'swiss-draw':
      return 'round 1 order not drawn yet';
    case 'swiss':
      return (
        `round ${q.round} of ${q.rounds}: ${q.done} of ${q.matches} matches` +
        (q.waiting > 0 ? ` · ${q.waiting} wait for the next season` : '')
      );
    case 'koth-endless':
      return (
        `fight ${q.played}` +
        (q.retire > 0 ? ` · 👑 ${q.crowns} retirements` : '') +
        (q.champ
          ? ` · on the hill: ${q.champ} ${q.streak}${q.retire > 0 ? `/${q.retire}` : ' in a row'}`
          : '')
      );
    case 'koth':
      return (
        `${q.played} of at most ${q.cap} fights` +
        (q.champ ? ` · 👑 ${q.champ} ${q.streak}/${q.retire}` : '')
      );
    case 'not-played':
      return 'not played yet';
    default:
      throw new Error(p.clave);
  }
}
/** @param {any} h */
function sorteoEn(h) {
  if (!h) return '';
  const q = h.params;
  if (h.clave === 'cup')
    return 'A World cup needs its entrants before the first match: it draws them at every new season.';
  if (h.clave === 'next-season') return 'From the next season on (this one started with its list).';
  const pre = q.locked ? 'This season: ' : '';
  if (h.clave === 'koth-endless')
    return `${pre}the challengers of every fight come from the pool; the season never ends.`;
  if (h.clave === 'koth')
    return `${pre}the challengers of every fight come from the pool; the season ends with a retirement or after ${q.cap} fights (3 × ${q.n}).`;
  if (h.clave === 'ladder')
    return `${pre}each newcomer is drawn when its turn comes, up to ${q.n} on the ladder.`;
  return `${pre}${q.n} are drawn when the first match starts.`;
}

// ---- Temporadas de prueba ------------------------------------------------------------
/** @param {string} name */
const ent = (name) => ({
  name,
  dna: `${name} .up store`,
  hash: E.lgHash(`${name} .up store`),
  src: 'form',
  file: '',
  color: '#fff',
});
/** @param {number} n */
const ents = (n) => Array.from({ length: n }, (_, i) => ent(`E${i}`));
/** @param {number} n @param {any} fmt @param {any} [extra] */
const temporada = (n, fmt, extra = {}) => ({
  no: 1,
  rules: {},
  entrants: ents(n),
  fmt: { ...E.LG_FMT_DEFAULT, ...fmt },
  ...structuredClone(extra),
});

// Juega la temporada entera con una implementación y guarda todo lo que se
// puede mirar en cada paso. api: {lgFixture, …}; la colina con la lista fija
// sortea con Math.random (la clásica) o con rnd (engine/). pick(a, b, r):
// ganador; voidAt: partidos nulos.
/** @param {any} api @param {any} S @param {{seed: number, voidAt?: Set<number>, max?: number, engine: boolean}} o */
function jugar(api, S, o) {
  const pick = rng(o.seed * 7 + 1);
  const rnd = rng(o.seed);
  if (!o.engine) C.semilla(o.seed);
  const fixture = o.engine
    ? (/** @type {any} */ s, /** @type {any} */ ms) => api.lgFixture(s, ms, rnd)
    : api.lgFixture;
  /** @type {any[]} */
  const ms = [];
  const trace = [];
  const max = o.max || 400;
  for (let g = 0; g < max; g++) {
    const fx = fixture(S, ms);
    trace.push({
      fx,
      done: api.lgSeasonDone(S, ms),
      champ: api.lgSeasonChampion(S, ms),
      prog: o.engine ? progresoEn(E.lgProgress(S, ms)) : api.tnProgress(S, ms),
    });
    if (!fx) break;
    const names = fx.fighters.map((/** @type {any} */ e) => e.name);
    const no = ms.length + 1;
    const r = pick();
    const w = o.voidAt?.has(no) ? '' : names[Math.floor(r * names.length)];
    const wins = names.map((/** @type {string} */ n) => (n === w ? 3 : Math.floor(pick() * 3)));
    const capWins = wins.map((/** @type {number} */ x) => Math.floor(pick() * (x + 1)));
    ms.push({
      id: no,
      league: 'L',
      season: S.no,
      no,
      fighters: names,
      winner: w,
      wins,
      capWins,
      rounds: wins.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0),
      cycles: 100 + Math.floor(pick() * 900),
      capRounds: Math.floor(pick() * 2),
    });
  }
  const h2h = api.lgH2H(ms);
  const names = S.entrants.map((/** @type {any} */ e) => e.name);
  return {
    trace,
    ms,
    standings: api.lgStandings(S, ms),
    koth: api.lgKothState(S, ms),
    ladder: api.lgLadderState(S, ms),
    rr: S.fmt.format === 'rr' ? api.lgRrState(S, ms) : null,
    cup: api.lgCupState(S, ms),
    swiss: api.lgSwissState(S, ms),
    h2h: names.map((/** @type {string} */ a) => names.map((/** @type {string} */ b) => h2h(a, b))),
  };
}
/** @param {number} n @param {any} fmt @param {number} seed @param {{extra?: any, voidAt?: number[], max?: number}} [o] */
function comparar(n, fmt, seed, o = {}) {
  const voidAt = new Set(o.voidAt || []);
  const a = jugar(C, temporada(n, fmt, o.extra), { seed, voidAt, max: o.max, engine: false });
  const b = jugar(E, temporada(n, fmt, o.extra), { seed, voidAt, max: o.max, engine: true });
  igual(b, a, `${fmt.format} N=${n} semilla ${seed}`);
  return a;
}

// ---- Casos -------------------------------------------------------------------------
test('calendario de todos contra todos (N 1-12, 1 y 2 vueltas)', () => {
  for (let n = 1; n <= 12; n++)
    for (const legs of [1, 2]) igual(E.lgRrFixtures(n, legs), C.lgRrFixtures(n, legs));
});

test('single: todos en un partido, hasta 20, con nulos', () => {
  for (const n of [1, 2, 5, 20, 25]) comparar(n, { format: 'single' }, n, { voidAt: [1, 2] });
});

test('todos contra todos: N 2-9, 1 y 2 vueltas, nulos', () => {
  for (let n = 2; n <= 9; n++)
    for (const legs of [1, 2])
      for (const seed of [1, 2])
        comparar(n, { format: 'rr', legs }, seed * 10 + n, { voidAt: [3, 7] });
});

test('escalera: N 2-8', () => {
  for (let n = 2; n <= 8; n++)
    for (const seed of [1, 2, 3]) comparar(n, { format: 'ladder' }, seed * 10 + n, { voidAt: [2] });
});

test('rey de la colina: con fin (retiro y tope), sin fin, sin repetir', () => {
  for (const n of [3, 5, 8])
    for (const k of [2, 3, 4])
      for (const retire of [1, 2, 5]) {
        comparar(n, { format: 'koth', k, retire }, n * 100 + k * 10 + retire, { voidAt: [4] });
        comparar(n, { format: 'koth', k, retire, noRepeat: true }, n + k + retire, {});
        comparar(n, { format: 'koth', k, retire, kothEnd: 'never' }, n * k * retire, { max: 40 });
      }
  comparar(4, { format: 'koth', k: 2, retire: 0, kothEnd: 'never' }, 9, { max: 30 });
  // Peleas de muchos (hasta 20 por pelea) y más participantes que el tope.
  for (const k of [10, 20]) comparar(24, { format: 'koth', k, retire: 2 }, k, { voidAt: [3] });
  comparar(6, { format: 'koth', k: 2, retire: 0, kothEnd: 'never', noRepeat: true }, 5, {});
  for (const f of [
    { retire: 0 },
    { retire: 5, kothEnd: 'xx' },
    { noRepeat: 'x' },
    { noRepeat: true },
  ])
    igual(E.lgKothClean({ format: 'koth', ...f }), C.lgKothClean({ format: 'koth', ...f }));
});

test('copa: 8, 16, 32; vueltas, 3.er puesto, bombos por Elo y al azar, nulos', () => {
  for (const n of [4, 8, 12, 16, 32])
    for (const groupLegs of [1, 2])
      for (const third of [false, true])
        for (const pots of ['elo', 'random'])
          for (const seed of [1, 2]) {
            const fmt = { format: 'cup', groupLegs, third, pots };
            const elo = new Map(ents(n).map((e, i) => [e.name, 1500 + ((i * 37) % 11) * 10]));
            const ga = C.lgCupGroups(ents(n), { ...E.LG_FMT_DEFAULT, ...fmt }, elo, rng(seed));
            const gb = E.lgCupGroups(ents(n), { ...E.LG_FMT_DEFAULT, ...fmt }, elo, rng(seed));
            igual(gb, ga, 'sorteo de grupos');
            comparar(n, fmt, seed + n, { extra: { groups: ga }, voidAt: [3, 14, 20] });
          }
  // Sin grupos, con un reparto ajeno y con uno repetido.
  for (const groups of [
    undefined,
    [
      ['E0', 'E1', 'E2', 'E3'],
      ['E4', 'E5', 'E6', 'E9'],
    ],
    [
      ['E0', 'E1', 'E2', 'E3'],
      ['E4', 'E5', 'E6', 'E3'],
    ],
  ])
    comparar(8, { format: 'cup' }, 3, { extra: groups ? { groups } : {} });
});

test('copa: desempates (duelo directo, triple empate)', () => {
  const groups = [
    ['E0', 'E1', 'E2', 'E3'],
    ['E4', 'E5', 'E6', 'E7'],
  ];
  const [A, B, Cc, D] = groups[0];
  /** @param {string} w @param {string} x @param {string} y */
  const g = (w, x, y) => ({ fighters: [x, y], winner: w, cycles: 10 });
  for (const list of [
    [g(A, A, Cc), g(A, A, D), g(B, B, A), g(D, B, D), g(B, B, Cc), g(Cc, Cc, D)],
    [g(A, A, B), g(B, B, Cc), g(Cc, Cc, A), g(A, A, D), g(B, B, D), g(Cc, Cc, D)],
  ]) {
    const ms = list.map((m, i) => ({ ...m, season: 1, no: i + 1 }));
    const S = temporada(8, { format: 'cup' }, { groups });
    igual(E.lgCupState(S, ms), C.lgCupState(S, ms));
    igual(E.lgStandings(S, ms), C.lgStandings(S, ms));
  }
});

test('suizo: N 2-33, rondas automáticas y fijas, byes y nulos', () => {
  for (const n of [2, 3, 4, 5, 7, 8, 9, 16, 17, 24, 32, 33])
    for (const swissRounds of [0, 3])
      for (const seed of [1, 2]) {
        const order = C.lgShuffle(
          ents(n).map((e) => e.name),
          rng(seed),
        );
        igual(
          E.lgShuffle(
            ents(n).map((e) => e.name),
            rng(seed),
          ),
          order,
          'orden de la ronda 1',
        );
        comparar(n, { format: 'swiss', swissRounds }, seed * 100 + n, {
          extra: { order },
          voidAt: [2, 5, 11],
        });
      }
  // 4 participantes y 5 rondas: revanchas.
  comparar(4, { format: 'swiss', swissRounds: 5 }, 3, {
    extra: { order: ['E2', 'E0', 'E3', 'E1'] },
  });
  // Un participante que llegó tarde (fuera del campo).
  comparar(7, { format: 'swiss' }, 4, { extra: { order: ['E3', 'E1', 'E0', 'E5', 'E2', 'E4'] } });
});

test('suizo: tabla, emparejamiento y registro sueltos', () => {
  for (const m of [
    { fighters: ['A', 'B'], winner: 'A', wins: [3, 1], capWins: [2, 1] },
    { fighters: ['A', 'B'], winner: 'A', wins: [3, 0] },
    { fighters: ['A', 'B'], winner: '' },
  ])
    igual(E.lgSwissRec(m), C.lgSwissRec(m));
  const r = rng(77);
  const names = ents(11).map((e) => e.name);
  /** @type {any[]} */
  const recs = [];
  for (let i = 0; i < 30; i++) {
    const a = names[Math.floor(r() * 11)];
    const b = names[Math.floor(r() * 11)];
    if (a === b) recs.push({ bye: true, fighters: [a], winner: a });
    else
      recs.push(
        E.lgSwissRec({
          fighters: [a, b],
          winner: r() < 0.2 ? '' : r() < 0.5 ? a : b,
          wins: [2, 1],
        }),
      );
  }
  const ta = C.lgSwissTable(names, recs);
  igual(E.lgSwissTable(names, recs), ta);
  const table = ta.map((/** @type {any} */ x) => x.name);
  igual(E.lgSwissPair(names, table, recs), C.lgSwissPair(names, table, recs));
  for (const [n, f] of [
    [2, {}],
    [17, {}],
    [33, {}],
    [32, { swissRounds: 3 }],
    [8, { swissRounds: '4' }],
  ])
    assert.equal(E.lgSwissRounds(f, n), C.lgSwissRounds(f, n));
});

test('Elo: pelea de N y suma cero', () => {
  for (const n of [2, 3, 5, 20]) {
    const mk = () => Array.from({ length: n }, (_, i) => ({ elo: 1400 + i * 25 }));
    const a = mk();
    const b = mk();
    C.lgElo(a, a[n - 1]);
    E.lgElo(b, b[n - 1]);
    igual(b, a);
  }
});

test('Hall of Fame: varias temporadas y formatos; sorteo de grupos con su Elo', () => {
  const seasons = [
    temporada(4, { format: 'single' }),
    temporada(4, { format: 'koth', k: 2, retire: 2 }),
    temporada(4, { format: 'rr', legs: 1 }),
    temporada(4, { format: 'ladder' }),
    temporada(8, { format: 'cup' }),
  ].map((s, i) => ({ ...s, no: i + 1 }));
  const r = rng(5);
  /** @type {any[]} */
  const matches = [];
  for (const S of seasons.slice(0, 4)) {
    const names = S.entrants.map((e) => e.name);
    for (let i = 0; i < 8; i++) {
      const f = S.fmt.format === 'single' ? names : [names[i % 4], names[(i + 1 + (i >> 2)) % 4]];
      matches.push({
        league: 'L',
        season: S.no,
        no: i + 1,
        fighters: f,
        winner: r() < 0.15 ? '' : f[Math.floor(r() * f.length)],
      });
    }
  }
  const L = { id: 'L', name: 'HoF', created: '', seasons };
  igual(E.lgAllTime(/** @type {any} */ (L), matches), C.lgAllTime(L, matches));
  const La = structuredClone(L);
  const Lb = structuredClone(L);
  assert.equal(
    E.lgCupDraw(/** @type {any} */ (Lb), matches, rng(8)),
    C.lgCupDraw(La, matches, rng(8)),
  );
  igual(Lb, La);
});

test('sorteos con semilla: mezcla, grupos, orden del suizo', () => {
  for (const seed of [1, 2, 3, 99]) {
    const list = ents(13).map((e) => e.name);
    igual(E.lgShuffle(list, rng(seed)), C.lgShuffle(list, rng(seed)));
    for (const n of [6, 7]) {
      const mk = () => ({
        id: 'L',
        name: 'S',
        created: '',
        seasons: [temporada(n, { format: 'swiss' })],
      });
      const a = mk();
      const b = mk();
      assert.equal(
        E.lgSwissDraw(/** @type {any} */ (b), [], rng(seed)),
        C.lgSwissDraw(a, [], rng(seed)),
      );
      igual(b, a);
      a.seasons[0].entrants.push(ent('Late'));
      b.seasons[0].entrants.push(ent('Late'));
      assert.equal(
        E.lgSwissDraw(/** @type {any} */ (b), [], rng(seed)),
        C.lgSwissDraw(a, [], rng(seed)),
      );
      const ms = [{ league: 'L', season: 1, no: 1, fighters: ['E0', 'E1'], winner: 'E0' }];
      assert.equal(
        E.lgSwissDraw(/** @type {any} */ (b), ms, rng(seed)),
        C.lgSwissDraw(a, ms, rng(seed)),
      );
      igual(b, a);
    }
  }
});

test('avisos de la ventana: sorteo en cada pelea y calendario largo', () => {
  for (const mode of ['fixed', 'random', 'fight'])
    for (const format of ['single', 'koth', 'rr', 'ladder', 'cup', 'swiss'])
      for (const kothEnd of ['retire', 'never'])
        for (const locked of [false, true])
          for (const live of [undefined, { pool: 'all', n: 6 }]) {
            const S = temporada(5, { format, kothEnd }, live ? { live } : {});
            const dr = { mode, pool: 'all', n: 9 };
            assert.equal(sorteoEn(E.lgDrawHint(dr, S, locked)), C.tnDrawHint(dr, S, locked));
          }
  for (const n of [10, 45, 46, 100, 1000])
    for (const format of ['rr', 'koth']) {
      const S = temporada(3, { format });
      const fx = E.lgRrWarn(S, n);
      assert.equal(
        fx ? `⚠ Round robin: drawing ${n} means ${fx.toLocaleString('en')} fixtures.` : '',
        C.tnRrWarn(S, n),
      );
    }
});

test('exportar → importar v1 y v2, Scratch guardado, errores y migración', () => {
  const L = E.lgNewLeague({
    id: 'Lx',
    name: 'Copa',
    rules: { 'o-fw': '9237' },
    fmt: { format: 'cup', third: true },
    entrants: [{ ...ent('A'), qty: 9 }, ...ents(7)],
    draw: { mode: 'fight', pool: 'fav', n: 6 },
  });
  const S = L.seasons[0];
  S.groups = E.lgCupGroups(S.entrants, S.fmt, new Map(), rng(9));
  L.seasons.push({
    ...E.lgSeasonNext(S, false),
    fmt: { ...S.fmt, format: 'swiss' },
    order: ['A', 'E0', 'E1'],
    live: { pool: 'all', n: 3 },
    dry: 2,
  });
  const ms = [
    {
      id: 7,
      league: 'Lx',
      season: 2,
      no: 1,
      fighters: ['A', 'E0'],
      seed: 42,
      winner: 'A',
      wins: [3, 1],
    },
    {
      id: 3,
      league: 'Lx',
      season: 1,
      no: 1,
      fighters: ['E1', 'A'],
      seed: 9,
      winner: 'E1',
      cycles: 5,
    },
    { id: 5, league: 'Otra', season: 1, no: 1, fighters: ['X', 'Y'], seed: 1, winner: 'X' },
  ];
  const fa = C.lgExportObj(L, ms);
  const fb = E.lgExportObj(L, ms);
  igual(fb, fa);
  const file2 = JSON.parse(JSON.stringify(fa));
  const file1 = { ...file2, version: 1, league: { ...file2.league } };
  delete file1.league.draw;
  for (const [f, names] of [
    [file2, new Set()],
    [file1, new Set(['Copa', 'Copa (imported)'])],
  ]) {
    const a = C.lgImportObj(f, names, 'N');
    const b = E.lgImportObj(f, /** @type {Set<string>} */ (names), 'N');
    igual(b, a);
  }
  // Un reparto de grupos que no cuadra y un archivo sin grupos.
  const bad = JSON.parse(JSON.stringify(file2));
  bad.league.seasons[0].groups[0][0] = 'Nobody';
  igual(E.lgImportObj(bad, new Set(), 'N'), C.lgImportObj(bad, new Set(), 'N'));
  // El Scratch guardado como torneo.
  igual(E.lgPromote(L, ms, 'P', 'Mío'), C.lgPromote(L, ms, 'P', 'Mío'));
  // Errores: los mismos casos fallan y con el mismo mensaje.
  for (const o of [
    null,
    { kind: 'x' },
    { kind: 'darwinbots-league', version: 99, league: L },
    { kind: 'darwinbots-league', version: 1, league: { seasons: [] } },
    { kind: 'darwinbots-league', version: 1, league: { seasons: [null] } },
    {
      kind: 'darwinbots-league',
      version: 1,
      league: { seasons: [{ rules: {}, entrants: [{ name: 'A' }] }] },
    },
  ]) {
    let got = '';
    let want = '';
    try {
      C.lgImportObj(o, new Set(), 'L');
    } catch (e) {
      want = /** @type {any} */ (e).message;
    }
    try {
      E.lgImportObj(o, new Set(), 'L');
    } catch (e) {
      got = errorEn(/** @type {any} */ (e));
    }
    assert.ok(want, 'la clásica rechaza el archivo');
    assert.equal(got, want);
  }
  // Migración de ligas viejas.
  for (const fmt of [
    { format: 'rr', legs: 2, qty: 3 },
    { format: 'xx' },
    { format: 'koth', retire: 0 },
    { format: 'swiss', qty: 5 },
    undefined,
  ]) {
    const mk = () => ({ id: 'v', name: 'V', seasons: [{ no: 1, rules: {}, fmt, entrants: [] }] });
    const a = mk();
    const b = mk();
    assert.equal(E.lgMigrate(/** @type {any} */ (b)), C.lgMigrate(a));
    igual(b, a);
    assert.equal(E.lgMigrate(/** @type {any} */ (b)), C.lgMigrate(a));
  }
  for (const d of [
    null,
    { mode: 'fight' },
    { mode: 'x', n: '568' },
    { pool: '', n: 1 },
    { n: 1e9 },
  ])
    igual(E.lgDrawClean(d), C.lgDrawClean(d));
  for (const name of ['Copa del Mundo', '¡¿?!', '  a  b  '])
    assert.equal(E.lgFileName(/** @type {any} */ ({ name })), C.lgFileName({ name }));
});

test('participantes: sufijos, colores, cantidad y lista de lanzamiento', () => {
  const mk = () => ({ entrants: /** @type {any[]} */ ([]), fmt: { format: 'single', qty: 5 } });
  const a = mk();
  const b = mk();
  const alta = [
    { name: 'A', dna: 'a', src: 'form', qty: 12, color: '#abc' },
    { name: 'A', dna: 'b', src: 'form', color: '#abc' },
    { name: 'A', dna: 'a', src: 'form' },
    ...Array.from({ length: 22 }, (_, i) => ({
      name: `X${i}`,
      dna: `x${i}`,
      src: 'bestiary',
      qty: 0,
    })),
  ];
  for (const e of alta)
    assert.equal(
      E.lgAddEntrant(/** @type {any} */ (b), e, () => '#rnd'),
      C.lgAddEntrant(a, e),
    );
  igualSinColor(b, a);
  igualSinColor(E.lgLaunchList(b.fmt, b.entrants), C.lgLaunchList(a.fmt, a.entrants));
});

test('partido: regla de victorias y ganador de la ronda', () => {
  for (let n = 1; n <= 60; n++) {
    assert.equal(P.contestWinsNeeded(n), C.contestWinsNeeded(n));
    assert.equal(P.contestMinLength(n), C.contestMinLength(n));
  }
  const f1 = {
    sp: [
      { name: 'A', wins: 1 },
      { name: 'B', wins: 2 },
    ],
  };
  for (const prev of [null, [1, 1], [1, 2], [0, 2]])
    assert.equal(P.contestRoundWinner(prev, f1), C.contestRoundWinner(prev, f1));
});

// ---- Con estado: sorteos del pool y registro de partidos ---------------------------------
// Inventario de las dos: 12 bestias; dos con el mismo ADN, una ilegible y un vegetal.
const beasts = Array.from({ length: 12 }, (_, i) => ({
  name: `B${i}`,
  file: `b${i}.txt`,
  dna: /** @type {string | null} */ (`${i} .up store`),
  veg: false,
}));
beasts[5].dna = beasts[4].dna;
beasts[7].dna = null;
beasts.push({ name: 'Veg', file: 'veg.txt', dna: 'veg', veg: true });
const items = beasts.map((b) => ({ key: b.file, b }));
const sets = new Map([['two', { keys: ['b0.txt', 'b1.txt'] }]]);
/** @param {any} b */
const fetchDna = async (b) => {
  if (!b.dna) throw new Error('unreadable');
  return b.dna;
};

/** @param {number} seed */
function par(seed) {
  const c = clasica({ inv: { items, sel: new Set(), sets }, invFetchDna: fetchDna });
  c.semilla(seed);
  const store = new Map();
  const t = crearTorneos(
    depsDePrueba({
      almacen: almacenMemoria(),
      inventario: {
        items,
        sel: new Set(),
        sets,
        userRec: () => ({ fav: false, tags: [] }),
        fetchDna,
        color: () => '#rnd',
      },
      kv: {
        get: (k) => (store.has(k) ? store.get(k) : null),
        set: (k, v) => store.set(k, String(v)),
        del: (k) => store.delete(k),
      },
      azar: rng(seed),
    }),
  );
  // Lo puro y lo que tiene estado de engine/, con los nombres de la clásica.
  return { c, t: { ...E, ...t }, store };
}

test('sorteo por temporada y en cada pelea (colina, escalera, todos contra todos)', async () => {
  for (const seed of [1, 2, 3])
    for (const [fmt, draw] of [
      [{ format: 'rr' }, { mode: 'random', n: 8 }],
      [
        { format: 'koth', k: 3, retire: 3 },
        { mode: 'fight', n: 4 },
      ],
      [
        { format: 'koth', k: 2, retire: 99, noRepeat: true },
        { mode: 'fight', n: 20 },
      ],
      [{ format: 'ladder' }, { mode: 'fight', n: 4 }],
      [{ format: 'ladder' }, { mode: 'fight', n: 5, pool: 'set:two' }],
      [{ format: 'rr' }, { mode: 'fight', n: 4 }],
      [{ format: 'single' }, { mode: 'fight', n: 5 }],
      [{ format: 'cup' }, { mode: 'fight', n: 8 }],
    ]) {
      const { c, t } = par(seed);
      const out = [];
      for (const api of [c, t]) {
        const L = api.lgNewLeague({ id: 'T', name: 'T', fmt, draw: { pool: 'all', ...draw } });
        api.lg.list.push(L);
        api.lg.cur = L;
        api.lg.matches = [];
        api.lgLiveSync(L);
        const pick = rng(seed + 50);
        const steps = [];
        for (let i = 0; i < 25; i++) {
          await api.lgLiveFill(L);
          const S = api.lgSeason(L);
          const ms = api.lg.matches.filter((/** @type {any} */ m) => m.season === S.no);
          const fx = api === t ? E.lgFixture(S, ms, () => 0) : api.lgFixture(S, ms);
          steps.push({ fx, S: structuredClone(norm(S)) });
          if (!fx) break;
          const names = fx.fighters.map((/** @type {any} */ e) => e.name);
          api.lg.matches.push({
            league: L.id,
            season: S.no,
            no: ms.length + 1,
            fighters: names,
            winner: names[Math.floor(pick() * names.length)],
          });
        }
        const r1 = await api.lgNewSeason(L);
        const r2 = await api.lgNewSeason(L, { draw: true });
        const r3 = await api.lgRedraw(L);
        out.push({ steps, r1, r2, r3, L, file: api.lgExportObj(L, api.lg.matches) });
      }
      igualSinColor(out[1], out[0], `${fmt.format} ${draw.mode} semilla ${seed}`);
    }
});

test('registro de partidos: mensajes del worker, nulos, Scratch y repetición', async () => {
  const { c, t } = par(4);
  const out = [];
  for (const api of [c, t]) {
    api.lg.scratch = api.lgScratchNew(null, { 'o-fw': '9237' });
    const L = api.lg.scratch.L;
    L.seasons[0].entrants.push(ent('A'), ent('B'), ent('C'));
    await api.lgSelect(L);
    const F = L.seasons[0].entrants;
    /** @param {any} over */
    const vivo = (over = {}) => {
      api.lg.live = {
        league: L.id,
        season: 1,
        fighters: F,
        label: 'x',
        ready: false,
        capRounds: 0,
        cycles: 0,
        f1: null,
        lastWins: null,
        replay: null,
        seed: 1234,
        ...over,
      };
    };
    const sp = (/** @type {number[]} */ w, /** @type {number[]} */ cw) =>
      F.map((e, i) => ({ name: e.name, wins: w[i], capWins: cw[i], pop: 3 }));
    // Un partido normal con dos rondas por tope; mensajes viejos antes del censo.
    vivo();
    await api.leagueOnMessage({ t: 'f1-over', winner: 'Z' }); // de la sim anterior: se ignora
    await api.leagueOnMessage({ t: 'f1-started', n: 3 });
    await api.leagueOnMessage({ t: 'f1-note', kind: 'cap' });
    await api.leagueOnMessage({ t: 'f1-note', kind: 'cap' });
    await api.leagueOnMessage({ t: 'f1-note', kind: 'many' });
    await api.leagueOnMessage({
      t: 'f1-over',
      winner: 'B',
      f1: { sp: sp([1, 3, 0], [0, 2, 0]) },
      cycles: 4321,
    });
    // Nulos: censo vacío y una sola especie.
    vivo();
    await api.leagueOnMessage({ t: 'f1-started', n: 0 });
    vivo();
    await api.leagueOnMessage({ t: 'f1-started', n: 2 });
    await api.leagueOnMessage({ t: 'f1-note', kind: 'single' });
    // Sin marcador (f1-over sin f1).
    vivo();
    await api.leagueOnMessage({ t: 'f1-started', n: 3 });
    await api.leagueOnMessage({ t: 'f1-over', winner: 'A' });
    const recs = structuredClone(norm(api.lg.scratch.matches));
    // Repeticiones: igual y distinta; sin partido abierto no pasa nada.
    const m0 = api.lg.scratch.matches[0];
    vivo({ replay: m0 });
    await api.leagueOnMessage({ t: 'f1-started', n: 3 });
    await api.leagueOnMessage({
      t: 'f1-over',
      winner: 'B',
      f1: { sp: sp([1, 3, 0], [0, 0, 0]) },
      cycles: 4321,
    });
    vivo({ replay: m0 });
    await api.leagueOnMessage({ t: 'f1-started', n: 3 });
    await api.leagueOnMessage({
      t: 'f1-over',
      winner: 'C',
      f1: { sp: sp([0, 1, 3], [0, 0, 0]) },
      cycles: 9,
    });
    await api.leagueOnMessage({ t: 'f1-over', winner: 'C' });
    const checked = [...api.lg.checked.entries()];
    // El Scratch guardado: temporada, partidos y campeón.
    const promo = api.lgPromote(L, api.lg.scratch.matches, 'P', 'Guardado');
    out.push({ recs, checked, promo, n: api.lg.scratch.matches.length, seq: api.lg.scratch.seq });
  }
  igual(out[1], out[0]);
});

test('migración del roster del Contest y del Hall of Fame del Canal', async () => {
  const out = [];
  const { c, t, store } = par(6);
  const roster = JSON.stringify([
    { name: 'B1', src: 'bestiary', file: 'b1.txt', color: '#111', qty: 7 },
    { name: 'Hy', src: 'hybrid', file: 'Hy', color: '#222', qty: 5 },
    { name: 'Form', src: 'form', color: '#333', qty: 5 },
    { name: 'Animal_Minimalis', src: 'preset', file: 'animal', color: '#444', qty: 2 },
    null,
    { name: 'B1', src: 'bestiary', file: 'b1.txt' },
  ]);
  const hof = JSON.stringify({
    X: { name: 'X', fights: 4, wins: 1, titles: 0, best: 1 },
    Y: { name: 'Y', fights: 6, wins: 5, titles: 1, best: 5 },
    Z: { name: 'Z', fights: 6, wins: 6, titles: 1, best: 5 },
  });
  /** @param {any} r */
  const dnaOf = async (r) => {
    if (r.src === 'bestiary') return `dna-${r.file}`;
    if (r.src === 'preset') return 'dna-animal';
    throw new Error(`${r.name}: no DNA`);
  };
  for (const [api, kv] of [
    [c, c.__store],
    [t, store],
  ]) {
    kv.set('db-contest-roster', roster);
    kv.set('db-channel-cfg', '{}');
    kv.set('db-channel-hof', hof);
    const sc = api.lgScratchNew(null, {});
    const r = await api.lgMigrateRoster(sc.L, dnaOf);
    const again = await api.lgMigrateRoster(sc.L, dnaOf);
    const f = api.lgOldHofFile();
    api.lgOldHofDiscard();
    const f2 = api.lgOldHofFile();
    out.push({ r, again, E: sc.L.seasons[0].entrants, f, f2, keys: [...kv.keys()].sort() });
  }
  // Mismo resultado, salvo las claves: la clásica borraba las suyas; la nueva
  // no las toca (decisión 17) y anota lo hecho en su espacio de nombres.
  const [kc, ke] = [out[0].keys, out[1].keys];
  delete out[0].keys;
  delete out[1].keys;
  igual(out[1], out[0]);
  assert.deepEqual(kc, []);
  assert.deepEqual(ke, [
    'darwinbots2.descartado.channel-hof',
    'darwinbots2.migrado.contest-roster',
    'db-channel-cfg',
    'db-channel-hof',
    'db-contest-roster',
  ]);
  assert.equal(store.get('db-contest-roster'), roster);
  assert.equal(store.get('db-channel-cfg'), '{}');
  assert.equal(store.get('db-channel-hof'), hof);
  assert.equal(HOW_EN.cup, C.LG_HOW.cup);
  for (const k of Object.keys(C.LG_HOW)) assert.ok(E.LG_HOWS.includes(k), k);
});

test('participantes: nunca verde ni colores parecidos entre competidores', async () => {
  assert.equal(E.lgEsVerde('#8ce83c'), true);
  assert.equal(E.lgEsVerde('#1fbf7a'), true);
  assert.equal(E.lgEsVerde('#c0ffc8'), true);
  assert.equal(E.lgEsVerde('#ff4040'), false);
  assert.equal(E.lgEsVerde('#ffffff'), false);
  const S = { entrants: /** @type {any[]} */ ([]), fmt: { format: 'single', qty: 5 } };
  const pedidos = ['#00ff00', '#ff4040', '#ff4545', '#3d9bff'];
  for (const [i, color] of pedidos.entries())
    E.lgAddEntrant(
      /** @type {any} */ (S),
      { name: `P${i}`, dna: `p${i}`, src: 'form', color },
      () => '#00cc33',
    );
  for (let i = 0; i < 8; i++)
    E.lgAddEntrant(
      /** @type {any} */ (S),
      { name: `Q${i}`, dna: `q${i}`, src: 'form' },
      () => '#00cc33',
    );
  const cs = S.entrants.map((e) => e.color);
  assert.equal(
    cs.some((c) => E.lgEsVerde(c)),
    false,
  );
  for (let i = 0; i < cs.length; i++)
    for (let j = i + 1; j < cs.length; j++)
      assert.equal(E.lgColorValido(cs[i], [cs[j]]), true, `${cs[i]} ~ ${cs[j]}`);
});
