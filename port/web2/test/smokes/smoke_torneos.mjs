#!/usr/bin/env node
// E11 R1 — smoke del modelo de torneos (spec/PLAN-EXTENSIONES.md §E11):
// formato single, fin de temporada del rey de la colina (retiro y tope de
// 3 × N), campeón de cada formato, cantidad por participante, sorteo de la
// liga sin repetidos, tabla histórica, Scratch en memoria y "Save as
// tournament", exportar v2 e importar v1/v2, migración de ligas viejas y del
// roster del Contest, Hall of Fame viejo del Canal.
//
// Copia de tools/e11/smoke_torneos.mjs contra engine/ (paso E1.2, decisión
// C6 de port/web2/PLAN.md): los mismos chequeos, con engine/league.js (lo
// puro) y engine/torneos.js (lo que tiene estado) en vez de web/league.js en
// un vm. El Inventario, el ADN y el almacén clave-valor (localStorage en la
// clásica) son de mentira; la base, un almacén en memoria.
//
//   node test/smokes/smoke_torneos.mjs     (desde port/web2/)
import * as LG from '../../engine/league.js';
import { crearTorneos } from '../../engine/torneos.js';
import { almacenMemoria } from '../../engine/torneos-db.js';
import { depsDePrueba } from '../util/torneos-deps.js';
import { fixtureEn } from './rotulos_en.mjs';

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

// ---- Contexto ------------------------------------------------------------------
const store = new Map();
const kv = {
  get: (k) => (store.has(k) ? store.get(k) : null),
  set: (k, v) => store.set(k, String(v)),
  del: (k) => store.delete(k),
};
// Inventario: 12 bestias; dos con el mismo ADN, una ilegible y un vegetal.
const beasts = [];
for (let i = 0; i < 12; i++)
  beasts.push({ name: `B${i}`, file: `b${i}.txt`, dna: `${i} .up store` });
beasts[5].dna = beasts[4].dna; // mismo ADN que B4
beasts[7].dna = null; // ilegible
beasts.push({ name: 'Veg', file: 'veg.txt', dna: 'veg', veg: true });
const inventario = {
  items: beasts.map((b) => ({ key: b.file, b })),
  sel: new Set(),
  sets: new Map(),
  userRec: () => ({ fav: false, tags: [] }),
  fetchDna: async (b) => {
    if (!b.dna) throw new Error('unreadable');
    return b.dna;
  },
  color: () => '#rnd',
};
const T = crearTorneos(depsDePrueba({ almacen: almacenMemoria(), inventario, kv }));
// Lo puro y lo que tiene estado, con los nombres de la clásica; la pelea con
// el rótulo en el inglés de la clásica (test/smokes/rotulos_en.mjs).
const ctx = { ...LG, ...T, lgFixture: (S, ms) => fixtureEn(LG.lgFixture(S, ms)) };

const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const ent = (name, dna = `${name} .up store`) => ({
  name,
  dna,
  hash: ctx.lgHash(dna),
  src: 'form',
  file: '',
  color: '#fff',
});
const M = (winner, ...fighters) => ({ winner, fighters });
const _numbered = (ms) => ms.map((m, i) => ({ ...m, season: 1, no: i + 1 }));

console.log('\n== single: un partido con todos ==');
{
  const E = [];
  for (let i = 0; i < 25; i++) E.push(ent(`E${i}`));
  const S = { entrants: E, fmt: { format: 'single' } };
  const fx = ctx.lgFixture(S, []);
  check(
    'la pelea lleva a todos, hasta 20',
    fx && fx.fighters.length === 20 && fx.fighters[0].name === 'E0',
    fx?.label,
  );
  const voided = [M('', 'E0', 'E1')];
  check(
    'un nulo no termina la temporada',
    !ctx.lgSeasonDone(S, voided) && ctx.lgFixture(S, voided),
  );
  const ms = [...voided, M('E3', 'E0', 'E3')];
  const c = ctx.lgSeasonChampion(S, ms);
  check(
    'con el partido jugado termina y gana su ganador',
    ctx.lgSeasonDone(S, ms) && !ctx.lgFixture(S, ms) && c.name === 'E3' && c.how === 'match',
  );
  check(
    'con menos de 2 participantes ni se juega ni termina',
    !ctx.lgFixture({ entrants: [E[0]], fmt: { format: 'single' } }, []) &&
      !ctx.lgSeasonDone({ entrants: [E[0]], fmt: { format: 'single' } }, []),
  );
}

console.log('\n== rey de la colina: fin de temporada ==');
{
  const E = ['A', 'B', 'C'].map((n) => ent(n));
  const S = { entrants: E, fmt: { format: 'koth', k: 2, retire: 2 } };
  const ms = [M('B', 'A', 'B'), M('A', 'B', 'A'), M('', 'A', 'C'), M('A', 'A', 'C')];
  const pre = ms.slice(0, 3);
  const fx = ctx.lgFixture(S, pre);
  check(
    'antes del retiro sigue: el campeón defiende',
    fx && fx.fighters[0].name === 'A' && /fight 3 of at most 9/.test(fx.label),
    fx?.label,
  );
  const c = ctx.lgSeasonChampion(S, ms);
  check(
    'el primero que se retira invicto gana la temporada',
    ctx.lgSeasonDone(S, ms) && !ctx.lgFixture(S, ms) && c && c.name === 'A' && c.how === 'retired',
  );
  // Tope: retiro 5 y ganadores alternados; 9 peleas = 3 × N.
  const S2 = { entrants: E, fmt: { format: 'koth', k: 2, retire: 5 } };
  const win = ['A', 'B', 'A', 'C', 'A', 'B', 'C', 'A', 'B'];
  const ms2 = win.map((w) => M(w, ...E.map((e) => e.name)));
  check(
    'a 8 peleas sigue',
    !ctx.lgSeasonDone(S2, ms2.slice(0, 8)) && ctx.lgFixture(S2, ms2.slice(0, 8)),
  );
  const c2 = ctx.lgSeasonChampion(S2, ms2);
  const top = ctx.lgStandings(S2, ms2)[0].name;
  check(
    'al tope de 3 × N gana el primero por Elo',
    ctx.lgSeasonDone(S2, ms2) && c2 && c2.how === 'elo' && c2.name === top,
    `${c2?.name} (Elo)`,
  );
}

console.log('\n== rey de la colina sin fin ==');
{
  const E = ['A', 'B', 'C'].map((n) => ent(n));
  // Retiro 2: A se corona dos veces, C una; la temporada no termina nunca.
  const S = { entrants: E, fmt: { format: 'koth', k: 2, retire: 2, kothEnd: 'never' } };
  const win = ['A', 'A', 'B', 'C', 'C', 'A', 'A', 'B', 'C', 'B', 'A', 'B', 'C', 'A'];
  const ms = win.map((w) => M(w, ...E.map((e) => e.name)));
  const k = ctx.lgKothState(S, ms);
  check(
    'los retiros suman coronas y la colina sigue',
    k.titles.get('A') === 2 &&
      k.titles.get('C') === 1 &&
      !ctx.lgSeasonDone(S, ms) &&
      !ctx.lgSeasonChampion(S, ms),
    [...k.titles].join(' '),
  );
  const fx = ctx.lgFixture(S, ms);
  check(
    'pasado el tope de 3 × N sigue habiendo pelea, sin "of at most"',
    fx && /fight 15$/.test(fx.label),
    fx?.label,
  );
  check('la tabla la encabeza quien tiene más coronas', ctx.lgStandings(S, ms)[0].name === 'A');
  // Retiro 0: el rey no se retira nunca.
  const S0 = { entrants: E, fmt: { format: 'koth', k: 2, retire: 0, kothEnd: 'never' } };
  const ms0 = Array.from({ length: 12 }, () => M('B', 'A', 'B'));
  const k0 = ctx.lgKothState(S0, ms0);
  check(
    'retiro 0: el rey sigue, racha 12, sin coronas',
    k0.champ === 'B' && k0.streak === 12 && !k0.titles.size && !ctx.lgSeasonDone(S0, ms0),
  );
  // Retiro 0 fuera de la colina sin fin no vale: vuelve a 1.
  const f = ctx.lgKothClean({ format: 'koth', retire: 0, kothEnd: 'retire' });
  const g = ctx.lgKothClean({ format: 'koth', retire: 5, kothEnd: 'xx' });
  check(
    'lgKothClean: retiro ≥ 1 con fin, modo desconocido = retire',
    f.retire === 1 && g.kothEnd === 'retire' && g.retire === 5,
  );
}

console.log('\n== rey de la colina sin repetir retadores ==');
{
  const E = ['A', 'B', 'C', 'D'].map((n) => ent(n));
  const S = { entrants: E, fmt: { format: 'koth', k: 2, retire: 5, noRepeat: true } };
  // El nulo no cuenta: C sigue siendo un retador nuevo.
  const ms = [M('A', 'A', 'B'), M('', 'A', 'C'), M('A', 'A', 'C')];
  const fx = ctx.lgFixture(S, ms);
  check(
    'el campeón defiende contra el único que no peleó',
    fx && fx.fighters.map((e) => e.name).join() === 'A,D',
    fx?.fighters.map((e) => e.name).join(),
  );
  const ms2 = [...ms, M('D', 'A', 'D')];
  const c = ctx.lgSeasonChampion(S, ms2);
  check(
    'destronado A no vuelve: sin retadores nuevos termina la temporada',
    ctx.lgSeasonDone(S, ms2) && !ctx.lgFixture(S, ms2) && c && c.how === 'dry',
    c && `${c.name} (${c.how})`,
  );
  const S2 = { ...S, fmt: { ...S.fmt, noRepeat: false } };
  check(
    'con repeticiones sigue habiendo pelea',
    !ctx.lgSeasonDone(S2, ms2) && ctx.lgFixture(S2, ms2),
  );
  // Sin fin + sin repetir: también termina al quedarse sin retadores.
  const S3 = { ...S, fmt: { ...S.fmt, kothEnd: 'never', retire: 0 } };
  check('la colina sin fin termina sin retadores nuevos', ctx.lgSeasonDone(S3, ms2));
  check(
    'lgKothClean: noRepeat es booleano',
    ctx.lgKothClean({ format: 'koth', noRepeat: 'x' }).noRepeat === false &&
      ctx.lgKothClean({ format: 'koth', noRepeat: true }).noRepeat === true,
  );
}

console.log('\n== campeón de todos contra todos y escalera ==');
{
  const E = ['A', 'B', 'C'].map((n) => ent(n));
  const S = { entrants: E, fmt: { format: 'rr', legs: 1 } };
  const ms = [M('C', 'A', 'C'), M('B', 'B', 'C'), M('C', 'A', 'B')];
  check('rr sin terminar: sin campeón', !ctx.lgSeasonChampion(S, ms.slice(0, 2)));
  const ms3 = [M('C', 'A', 'C'), M('B', 'B', 'C'), M('A', 'A', 'B')];
  check(
    'rr completo: gana el primero de la tabla',
    ctx.lgSeasonDone(S, ms3) &&
      ctx.lgSeasonChampion(S, ms3).how === 'table' &&
      ctx.lgSeasonChampion(S, ms3).name === ctx.lgStandings(S, ms3)[0].name,
  );
  const L = { entrants: ['A', 'B'].map((n) => ent(n)), fmt: { format: 'ladder' } };
  const c = ctx.lgSeasonChampion(L, [M('B', 'A', 'B')]);
  check('escalera completa: el peldaño 1', c && c.name === 'B' && c.how === 'ladder');
}

console.log('\n== cantidad por participante ==');
{
  const S = { entrants: [], fmt: { format: 'single', qty: 5 } };
  ctx.lgAddEntrant(S, { name: 'A', dna: 'a', src: 'form', qty: 12, color: '#abc' });
  ctx.lgAddEntrant(S, { name: 'A', dna: 'b', src: 'form', color: '#abc' });
  check(
    'el color pedido se respeta si está libre y el nombre repetido lleva sufijo',
    S.entrants[0].color === '#abc' &&
      S.entrants[1].color !== '#abc' &&
      S.entrants[1].name === 'A 2',
  );
  const list = ctx.lgLaunchList(S.fmt, S.entrants);
  check(
    'entrant.qty pisa fmt.qty',
    list[0].qty === 12 && list[1].qty === 5 && list[0].dna === 'a',
    list.map((x) => x.qty).join(' / '),
  );
}

console.log('\n== sorteo de la liga y temporada nueva ==');
{
  const L = ctx.lgNewLeague({
    name: 'Copa',
    rules: { 'o-fw': '100' },
    fmt: { format: 'rr' },
    entrants: [ent('Old1'), ent('Old2')],
    draw: { mode: 'random', pool: 'all', n: 8 },
  });
  ctx.lg.list.push(L);
  await ctx.lgSelect(L);
  check(
    'liga nueva: sorteo limpio',
    same(ctx.lgDrawOf(L), { mode: 'random', pool: 'all', n: 8 }) && L.id,
  );
  const r = await ctx.lgNewSeason(L);
  const S2 = L.seasons[1];
  const names = S2.entrants.map((e) => e.name),
    hashes = S2.entrants.map((e) => e.hash);
  check(
    'la temporada nueva sortea 8 sin repetidos, ni vegetales ni ilegibles',
    S2.no === 2 &&
      r.added === 8 &&
      S2.entrants.length === 8 &&
      new Set(names).size === 8 &&
      new Set(hashes).size === 8 &&
      !names.includes('Veg') &&
      !names.includes('B7') &&
      !(names.includes('B4') && names.includes('B5')),
    names.join(' '),
  );
  check(
    'reglas y formato copiados; la temporada 1 intacta',
    same(S2.rules, { 'o-fw': '100' }) &&
      S2.fmt.format === 'rr' &&
      L.seasons[0].entrants.map((e) => e.name).join() === 'Old1,Old2',
  );
  const before = names.join();
  let changed = false;
  for (let i = 0; i < 6 && !changed; i++) {
    await ctx.lgRedraw(L);
    changed = L.seasons[1].entrants.map((e) => e.name).join() !== before;
  }
  check('sin partidos se puede volver a sortear', changed && L.seasons[1].entrants.length === 8);
  L.draw = { mode: 'fixed', pool: 'all', n: 8 };
  await ctx.lgNewSeason(L);
  check(
    'lista fija: la temporada nueva copia los participantes',
    L.seasons[2].entrants.map((e) => e.name).join() ===
      L.seasons[1].entrants.map((e) => e.name).join(),
  );
  await ctx.lgNewSeason(L, { draw: true });
  check('el TV mode sortea aunque la lista sea fija', L.seasons[3].entrants.length === 8);
  ctx.lg.list.length = 0;
}

console.log('\n== tabla histórica ==');
{
  const L = {
    seasons: [
      { no: 1, entrants: ['A', 'B', 'C'].map((n) => ent(n)), fmt: { format: 'single' } },
      {
        no: 2,
        entrants: ['A', 'B', 'D'].map((n) => ent(n)),
        fmt: { format: 'koth', k: 2, retire: 2 },
      },
      { no: 3, entrants: ['B', 'D'].map((n) => ent(n)), fmt: { format: 'rr', legs: 1 } },
    ],
  };
  const ms = [
    { ...M('A', 'A', 'B', 'C'), season: 1, no: 1 },
    { ...M('B', 'A', 'B'), season: 2, no: 1 },
    { ...M('', 'B', 'D'), season: 2, no: 2 },
    { ...M('B', 'B', 'D'), season: 2, no: 3 },
    { ...M('D', 'B', 'D'), season: 3, no: 1 },
  ];
  const t = ctx.lgAllTime(L, ms);
  const by = new Map(t.map((r) => [r.name, r]));
  const sum = t.reduce((a, r) => a + r.elo, 0);
  check(
    'títulos: A (single), B (retiro), D (rr)',
    by.get('A').titles === 1 && by.get('B').titles === 1 && by.get('D').titles === 1,
  );
  check(
    'temporadas jugadas, partidos y victorias',
    by.get('B').seasons === 3 &&
      by.get('B').p === 4 &&
      by.get('B').w === 2 &&
      by.get('C').seasons === 1 &&
      by.get('D').seasons === 2 &&
      by.get('D').p === 2,
    t.map((r) => `${r.name} ${r.seasons}T ${r.p}PJ ${r.w}G`).join(' · '),
  );
  check(
    'Elo de suma cero de temporada a temporada y orden por títulos y victorias',
    Math.abs(sum - 1500 * t.length) < 1e-9 && t[0].name === 'B',
    t.map((r) => r.name).join(' '),
  );
}

console.log('\n== Scratch y "Save as tournament" ==');
{
  ctx.lg.scratch = ctx.lgScratchNew(null, { 'o-fw': '9237' });
  const L = ctx.lg.scratch.L;
  L.seasons[0].entrants.push(ent('A'), ent('B'));
  await ctx.lgSelect(L);
  check(
    'Scratch: id fijo, formato single, en memoria',
    L.id === ctx.LG_SCRATCH_ID &&
      L.seasons[0].fmt.format === 'single' &&
      ctx.lg.matches === ctx.lg.scratch.matches,
  );
  for (const [w, seed] of [
    ['B', 11],
    ['A', 22],
  ]) {
    ctx.lg.live = {
      league: L.id,
      season: 1,
      fighters: L.seasons[0].entrants,
      seed,
      capRounds: 0,
      cycles: 400,
      f1: {
        sp: [
          { name: 'A', wins: w === 'A' ? 3 : 1 },
          { name: 'B', wins: w === 'B' ? 3 : 0 },
        ],
      },
    };
    await ctx.lgRecord(w);
  }
  const sm = ctx.lg.scratch.matches;
  check(
    'los partidos del Scratch quedan en memoria con id negativo y numerados',
    sm.length === 2 &&
      sm[0].id === -1 &&
      sm[1].id === -2 &&
      sm[1].no === 2 &&
      same(sm[0].wins, [1, 3]),
  );
  const r = ctx.lgPromote(L, sm, 'Lnuevo', 'Mi torneo');
  check(
    'guardarlo: id y nombre nuevos, partidos reasignados sin id',
    r.L.id === 'Lnuevo' &&
      r.L.name === 'Mi torneo' &&
      r.matches.length === 2 &&
      r.matches.every((m) => m.league === 'Lnuevo' && !('id' in m)) &&
      r.matches[1].seed === 22 &&
      r.L.seasons[0].entrants.map((e) => e.name).join() === 'A,B',
  );
  check('el Scratch no cambia al guardarlo', L.id === ctx.LG_SCRATCH_ID && sm.length === 2);
  ctx.lg.scratch = null;
  ctx.lg.cur = null;
  ctx.lg.matches = [];
}

console.log('\n== exportar v2, importar v1 y v2 ==');
{
  const L = ctx.lgNewLeague({
    id: 'Lx',
    name: 'Copa',
    rules: {},
    fmt: { format: 'single' },
    entrants: [{ ...ent('A'), qty: 9 }, ent('B')],
    draw: { mode: 'random', pool: 'fav', n: 6 },
  });
  const f2 = JSON.parse(JSON.stringify(ctx.lgExportObj(L, [])));
  check(
    'versión 2 con el sorteo',
    f2.version === 2 && same(f2.league.draw, { mode: 'random', pool: 'fav', n: 6 }),
  );
  const r2 = ctx.lgImportObj(f2, new Set(), 'L2');
  check(
    'importar v2: sorteo, formato y cantidad por participante',
    same(r2.L.draw, { mode: 'random', pool: 'fav', n: 6 }) &&
      r2.L.seasons[0].fmt.format === 'single' &&
      r2.L.seasons[0].entrants[0].qty === 9 &&
      !('qty' in r2.L.seasons[0].entrants[1]),
  );
  const f1 = { ...f2, version: 1, league: { ...f2.league } };
  delete f1.league.draw;
  const r1 = ctx.lgImportObj(f1, new Set(['Copa']), 'L1');
  check(
    'importar v1: sorteo fijo por defecto',
    same(r1.L.draw, { mode: 'fixed', pool: 'all', n: 8 }) && r1.L.name === 'Copa (imported)',
  );
  let bad = false;
  try {
    ctx.lgImportObj({ ...f2, version: 3 }, new Set(), 'L3');
  } catch (_e) {
    bad = true;
  }
  check('rechaza una versión más nueva', bad);
}

console.log('\n== migración de ligas viejas ==');
{
  const L = {
    id: 'Lv',
    name: 'Vieja',
    created: 'x',
    seasons: [{ no: 1, rules: {}, fmt: { format: 'rr', legs: 2, qty: 3 }, entrants: [] }],
  };
  const ch1 = ctx.lgMigrate(L);
  check(
    'recibe el sorteo fijo y los valores que le faltan',
    ch1 &&
      same(L.draw, { mode: 'fixed', pool: 'all', n: 8 }) &&
      L.seasons[0].fmt.legs === 2 &&
      L.seasons[0].fmt.qty === 3 &&
      L.seasons[0].fmt.cap === 5000 &&
      L.seasons[0].fmt.capMode === 'pop',
  );
  check('migrar otra vez no cambia nada', !ctx.lgMigrate(L));
}

console.log('\n== roster del Contest y Hall of Fame del Canal ==');
{
  store.set(
    'db-contest-roster',
    JSON.stringify([
      { name: 'B1', src: 'bestiary', file: 'b1.txt', color: '#111', qty: 7 },
      { name: 'Hy', src: 'hybrid', file: 'Hy', color: '#222', qty: 5 },
      { name: 'Form', src: 'form', color: '#333', qty: 5 },
      { name: 'Animal_Minimalis', src: 'preset', file: 'animal', color: '#444', qty: 2 },
    ]),
  );
  store.set('db-channel-cfg', '{"k":2}');
  const sc = ctx.lgScratchNew(null, {});
  const dnaOf = async (r) => {
    if (r.src === 'bestiary') return `dna-${r.file}`;
    if (r.src === 'preset') return 'dna-animal';
    throw new Error(`${r.name}: no DNA`);
  };
  const r = await ctx.lgMigrateRoster(sc.L, dnaOf);
  const E = sc.L.seasons[0].entrants;
  check(
    'pasa al Scratch con su cantidad y color; los ilegibles se pierden',
    r.added === 2 &&
      r.lost === 2 &&
      E.map((e) => `${e.name}:${e.qty}:${e.color}:${e.src}`).join() ===
        'B1:7:#111:bestiary,Animal_Minimalis:2:#444:form',
    E.map((e) => e.name).join(),
  );
  // Diferencia con la clásica (decisión 17): no borra sus claves; anota la
  // migración en el espacio de nombres de la nueva.
  check(
    'no borra el roster ni la config del Canal de la clásica',
    store.has('db-contest-roster') && store.get('db-channel-cfg') === '{"k":2}',
  );
  check('migrar otra vez no hace nada', (await ctx.lgMigrateRoster(sc.L, dnaOf)) === null);
  check('sin Hall of Fame viejo no hay archivo', ctx.lgOldHofFile() === null);
  store.set(
    'db-channel-hof',
    JSON.stringify({
      X: { name: 'X', fights: 4, wins: 1, titles: 0, best: 1 },
      Y: { name: 'Y', fights: 6, wins: 5, titles: 1, best: 5 },
    }),
  );
  const f = ctx.lgOldHofFile();
  check(
    'el Hall of Fame viejo como archivo, ordenado por títulos',
    f && f.kind === 'darwinbots-channel-hof' && f.rows.map((x) => x.name).join() === 'Y,X',
  );
  ctx.lgOldHofDiscard();
  check(
    'descartarlo lo oculta sin borrar la clave de la clásica',
    store.has('db-channel-hof') && ctx.lgOldHofFile() === null,
  );
  check(
    'la nueva solo escribe claves con su prefijo',
    [...store.keys()].every((k) => k.startsWith('darwinbots2.') || k.startsWith('db-')) &&
      [...store.keys()].filter((k) => k.startsWith('db-')).length === 3,
    [...store.keys()].join(),
  );
}

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
