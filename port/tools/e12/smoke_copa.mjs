#!/usr/bin/env node
// E12 C1 — smoke del modelo de la copa (spec/PLAN-EXTENSIONES.md §E12):
// tamaños de 8, 16 y 32 (grupos de 4, cantidad de partidos), tamaños que no
// sirven, bombos por Elo (un cabeza de serie por grupo) y al azar, grupos
// intercalados, desempates, cruce del Mundial (nunca dos del mismo grupo en
// la primera ronda), nulos que se repiten, 3.er puesto, campeón y tabla,
// sorteo con el Elo del Hall of Fame, migración y el ida y vuelta de
// exportar e importar con S.groups.
//
// Solo web/league.js en un vm, como tools/e11/smoke_torneos.mjs.
//
//   node tools/e12/smoke_copa.mjs     (desde port/)
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT_DIR = path.resolve(here, '..', '..');

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  ok   ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}

// ---- Contexto ------------------------------------------------------------------
const store = new Map();
const ctx = {
  indexedDB: null, log: () => {}, console, invColor: () => '#rnd',
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null),
                  setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  inv: { items: [], sel: new Set(), sets: new Map() },
  userRec: () => ({ fav: false, tags: [] }),
  invFetchDna: async () => { throw new Error('no'); },
};
vm.createContext(ctx);
const src = fs.readFileSync(path.join(PORT_DIR, 'web', 'league.js'), 'utf8');
vm.runInContext(src + '\nObject.assign(this, { lg, lgFixture, lgSeasonDone, lgSeasonChampion, ' +
  'lgStandings, lgAllTime, lgNewLeague, lgExportObj, lgImportObj, lgMigrate, lgHash, ' +
  'lgCupGroups, lgCupGroupsOk, lgCupState, lgCupDraw, LG_HOW, LG_FMT_DEFAULT });', ctx);

// Generador con semilla (mulberry32): sorteos repetibles.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ent = (name) => ({ name, dna: name + ' .up store', hash: ctx.lgHash(name + ' .up store'),
                         src: 'form', file: '', color: '#fff' });
const ents = (n) => Array.from({ length: n }, (_, i) => ent('E' + i));
const fmt = (o = {}) => ({ ...ctx.LG_FMT_DEFAULT, format: 'cup', ...o });
const idx = (n) => +n.slice(1);
// Una temporada de copa con grupos sorteados al azar (semilla).
function season(n, o = {}, seed = 1) {
  const S = { no: 1, entrants: ents(n), fmt: fmt(o) };
  S.groups = ctx.lgCupGroups(S.entrants, S.fmt, new Map(), rng(seed));
  return S;
}
// Juega la temporada hasta el final: gana el de menor índice salvo que
// `pick` diga otra cosa. Devuelve los partidos y los rótulos.
function playAll(S, pick = (a, b) => (idx(a.name) < idx(b.name) ? a : b), voidAt = new Set()) {
  const ms = [], labels = [];
  for (let guard = 0; guard < 500; guard++) {
    const fx = ctx.lgFixture(S, ms);
    if (!fx) break;
    labels.push(fx.label);
    const [a, b] = fx.fighters;
    const no = ms.length + 1;
    const winner = voidAt.has(no) ? '' : pick(a, b).name;
    ms.push({ id: no, season: 1, no, fighters: [a.name, b.name], winner, cycles: 100, capRounds: 0, rounds: 1 });
  }
  return { ms, labels };
}

console.log('\n== tamaños: grupos de 4 y cantidad de partidos ==');
for (const [n, legs, expect] of [[8, 1, 15], [16, 1, 31], [32, 1, 63], [8, 2, 27]]) {
  const S = season(n, { groupLegs: legs }, n);
  const ok = ctx.lgCupGroupsOk(S) && S.groups.length === n / 4 && S.groups.every((g) => g.length === 4);
  const { ms, labels } = playAll(S);
  const c = ctx.lgSeasonChampion(S, ms);
  check(`${n} participantes, ${legs} vuelta(s): ${n / 4} grupos de 4 y ${expect} partidos`,
        ok && ms.length === expect && ctx.lgSeasonDone(S, ms) && !ctx.lgFixture(S, ms),
        `${ms.length} partidos; ${labels[0]} … ${labels[labels.length - 1]}`);
  check(`${n}/${legs}: gana el más fuerte y la final es lo último`,
        c && c.name === 'E0' && c.how === 'cup' && labels[labels.length - 1] === 'FINAL');
}

console.log('\n== tamaños que no sirven ==');
for (const n of [4, 12, 20]) {
  const S = { no: 1, entrants: ents(n), fmt: fmt() };
  S.groups = ctx.lgCupGroups(S.entrants, S.fmt, new Map(), rng(3));
  check(`${n} participantes: sin grupos válidos, sin partido y sin terminar`,
        !ctx.lgCupGroupsOk(S) && !ctx.lgFixture(S, []) && !ctx.lgSeasonDone(S, []) &&
        ctx.lgCupState(S, []).phase === 'draw');
}
{
  const S = { no: 1, entrants: ents(8), fmt: fmt() };
  check('sin S.groups no hay partido (hay que sortear)', !ctx.lgFixture(S, []));
  S.groups = [['E0', 'E1', 'E2', 'E3'], ['E4', 'E5', 'E6', 'E9']];
  check('un reparto con un nombre ajeno no sirve', !ctx.lgCupGroupsOk(S));
  S.groups = [['E0', 'E1', 'E2', 'E3'], ['E4', 'E5', 'E6', 'E3']];
  check('un reparto con un repetido no sirve', !ctx.lgCupGroupsOk(S));
}

console.log('\n== bombos ==');
{
  const E = ents(16), elo = new Map(E.map((e, i) => [e.name, 2000 - i * 10]));
  let okPots = true;
  for (let seed = 1; seed <= 20; seed++) {
    const G = ctx.lgCupGroups(E, fmt(), elo, rng(seed));
    // El bombo p son los índices 4p..4p+3: cada grupo tiene uno de cada bombo, en orden.
    okPots = okPots && G.every((g) => g.every((n, p) => Math.floor(idx(n) / 4) === p));
  }
  check('por Elo: cada grupo tiene un participante de cada bombo (20 sorteos)', okPots);
  const a = ctx.lgCupGroups(E, fmt(), elo, rng(7)), b = ctx.lgCupGroups(E, fmt(), elo, rng(7));
  check('el mismo generador da el mismo sorteo', JSON.stringify(a) === JSON.stringify(b));
  let mixed = false;
  for (let seed = 1; seed <= 20 && !mixed; seed++) {
    const G = ctx.lgCupGroups(E, fmt({ pots: 'random' }), elo, rng(seed));
    mixed = G.some((g) => g.some((n, p) => Math.floor(idx(n) / 4) !== p));
  }
  check("'random' no respeta los bombos", mixed);
  const G = ctx.lgCupGroups(E, fmt(), new Map(), rng(5));
  check('sin Elo (todos 1500) el sorteo reparte a todos', new Set(G.flat()).size === 16);
}

console.log('\n== fase de grupos: calendario intercalado ==');
{
  const S = season(16, {}, 4);
  const { labels, ms } = playAll(S);
  check('jornada 1: A, A, B, B, C, C, D, D; luego la 2',
        labels[0] === 'Group A · matchday 1 of 3' && labels[1] === 'Group A · matchday 1 of 3' &&
        labels[2] === 'Group B · matchday 1 of 3' && labels[7] === 'Group D · matchday 1 of 3' &&
        labels[8] === 'Group A · matchday 2 of 3' && labels[23] === 'Group D · matchday 3 of 3', labels[8]);
  check('en cada jornada de un grupo juegan los 4',
        [0, 2, 4, 6].every((k) => new Set([...ms[k].fighters, ...ms[k + 1].fighters]).size === 4));
  check('cuadro de 16: cuartos, semis y final',
        labels[24] === 'Quarter-final · match 1 of 4' && labels[28] === 'Semi-final · match 1 of 2' &&
        labels[30] === 'FINAL');
  const S2 = season(32, {}, 4);
  check('cuadro de 32: octavos', playAll(S2).labels[48] === 'Round of 16 · match 1 of 8');
}

console.log('\n== desempates ==');
{
  const S = { no: 1, entrants: ents(8), fmt: fmt(),
              groups: [['A', 'B', 'C', 'D'].map((x) => 'E' + 'ABCD'.indexOf(x)), ['E4', 'E5', 'E6', 'E7']] };
  const [A, B, C, D] = ['E0', 'E1', 'E2', 'E3'];
  const g = (w, x, y) => ({ fighters: [x, y], winner: w, cycles: 10 });
  // A y B con 2 victorias (B le ganó a A); C y D con 1 (C le ganó a D).
  const ms = [g(A, A, C), g(A, A, D), g(B, B, A), g(D, B, D), g(B, B, C), g(C, C, D)]
    .map((m, i) => ({ ...m, season: 1, no: i + 1 }));
  const rows = ctx.lgCupState(S, ms).groups[0].rows.map((r) => r.name);
  check('empate en victorias: decide el duelo directo', rows.join() === [B, A, C, D].join(), rows.join());
  const none = ctx.lgCupState(S, []).groups[1].rows.map((r) => r.name);
  check('sin partidos: el orden del sorteo', none.join() === 'E4,E5,E6,E7');
  // Triple empate con duelos parejos (A>B, B>C, C>A; D pierde todo): decide
  // el Elo y, a Elo igual, siguen al frente de D.
  const cyc = [g(A, A, B), g(B, B, C), g(C, C, A), g(A, A, D), g(B, B, D), g(C, C, D)]
    .map((m, i) => ({ ...m, season: 1, no: i + 1 }));
  const r2 = ctx.lgCupState(S, cyc).groups[0].rows;
  check('triple empate: D último y el resto por Elo',
        r2[3].name === D && r2[0].elo >= r2[1].elo && r2[1].elo >= r2[2].elo,
        r2.map((r) => `${r.name} ${Math.round(r.elo)}`).join(' · '));
}

console.log('\n== cruce del Mundial ==');
for (const n of [8, 16, 32]) {
  const S = season(n, {}, 11 + n);
  const { ms } = playAll(S);
  const st = ctx.lgCupState(S, ms), grp = (name) => S.groups.findIndex((g) => g.includes(name));
  const R1 = st.bracket[0], G = S.groups.length;
  const first = (gi) => st.groups[gi].rows[0].name, second = (gi) => st.groups[gi].rows[1].name;
  let ok = R1.length === G;
  for (let gi = 0; gi < G; gi += 2) {
    ok = ok && R1[gi / 2].a === first(gi) && R1[gi / 2].b === second(gi + 1) &&
         R1[G / 2 + gi / 2].a === first(gi + 1) && R1[G / 2 + gi / 2].b === second(gi);
  }
  check(`${n}: 1A-2B, 1C-2D… arriba y 1B-2A, 1D-2C… abajo`, ok,
        R1.map((t) => `${t.a}-${t.b}`).join(' '));
  check(`${n}: nadie cruza a uno de su grupo en la primera ronda`, R1.every((t) => grp(t.a) !== grp(t.b)));
  check(`${n}: los de un mismo grupo solo pueden verse en la final`,
        st.bracket.slice(0, -1).every((r) => r.every((t) => grp(t.a) !== grp(t.b))));
}

console.log('\n== nulos y 3.er puesto ==');
{
  const S = season(8, {}, 21);
  const { ms, labels } = playAll(S, undefined, new Set([3, 14]));
  check('un nulo en grupos y otro en eliminatorias se repiten',
        ms.length === 17 && labels[2] === labels[3] && labels[13] === labels[14] &&
        ms[2].fighters.join() === ms[3].fighters.join() && ctx.lgSeasonDone(S, ms), `${ms.length} partidos`);
  const T = season(8, { third: true }, 21);
  const r = playAll(T);
  const st = ctx.lgCupState(T, r.ms), semis = st.bracket[0];
  const losers = semis.map((t) => (t.winner === t.a ? t.b : t.a));
  check('con 3.er puesto: 16 partidos y el de 3.º va antes de la final',
        r.ms.length === 16 && r.labels[14] === 'Third place' && r.labels[15] === 'FINAL' &&
        st.third.a === losers[0] && st.third.b === losers[1]);
  const tab = ctx.lgStandings(T, r.ms).map((x) => x.name);
  const fin = st.bracket[1][0];
  check('tabla: campeón, finalista, 3.º y 4.º; luego los cuartofinalistas',
        tab[0] === st.champion && tab[1] === (fin.winner === fin.a ? fin.b : fin.a) &&
        tab[2] === st.third.winner && tab.slice(3, 4).every((x) => losers.includes(x)) &&
        tab.slice(4).every((x) => ctx.lgCupState(T, r.ms).reach.get(x) === 0) && tab.length === 8,
        tab.join(' '));
  check("LG_HOW.cup = 'wins the final'", ctx.LG_HOW.cup === 'wins the final');
  // Un partido que no es el cruce pendiente no cuenta.
  const U = season(8, {}, 21);
  const u = playAll(U).ms.slice(0, 12);
  const fx = ctx.lgFixture(U, u);
  const stray = [...u, { season: 1, no: 13, fighters: [fx.fighters[0].name, 'E99'], winner: fx.fighters[0].name }];
  check('un duelo ajeno en eliminatorias no avanza el cuadro',
        ctx.lgFixture(U, stray).label === fx.label && ctx.lgFixture(U, stray).fighters[1] === fx.fighters[1]);
}

console.log('\n== sorteo en la liga: Elo del Hall of Fame ==');
{
  const E = ents(8);
  const L = ctx.lgNewLeague({ name: 'Cup', fmt: { format: 'rr' }, entrants: E });
  // Temporada 1 (rr): gana siempre el de mayor índice → E7, E6… arriba en Elo.
  const matches = [];
  let no = 0;
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++)
    matches.push({ league: L.id, season: 1, no: ++no, fighters: ['E' + i, 'E' + j], winner: 'E' + j });
  L.seasons.push({ no: 2, started: '', rules: {}, fmt: fmt(), entrants: E.map((e) => ({ ...e })) });
  check('sortea si faltan los grupos', ctx.lgCupDraw(L, matches, rng(2)) && ctx.lgCupGroupsOk(L.seasons[1]));
  const G = L.seasons[1].groups;
  check('bombo 1: los 2 mejores del Hall of Fame (E7 y E6), uno por grupo',
        new Set([G[0][0], G[1][0]]).size === 2 && [G[0][0], G[1][0]].every((n) => n === 'E7' || n === 'E6'),
        JSON.stringify(G));
  check('con grupos válidos no vuelve a sortear', !ctx.lgCupDraw(L, matches, rng(3)));
  L.seasons[1].entrants.pop();
  check('con 7 participantes no sortea', !ctx.lgCupDraw(L, matches, rng(3)));
  const R = ctx.lgNewLeague({ name: 'RR', fmt: { format: 'rr' }, entrants: E });
  check('en otro formato no sortea', !ctx.lgCupDraw(R, [], rng(3)) && !R.seasons[0].groups);
}

console.log('\n== migración y exportar/importar con S.groups ==');
{
  const old = { id: 'x', name: 'Old', seasons: [{ no: 1, rules: {}, entrants: [], fmt: { format: 'rr', legs: 1 } }] };
  ctx.lgMigrate(old);
  const f = old.seasons[0].fmt;
  check('lgMigrate completa groupLegs, pots y third', f.groupLegs === 1 && f.pots === 'elo' && f.third === false);
  const L = ctx.lgNewLeague({ name: 'Copa', fmt: { format: 'cup', third: true }, entrants: ents(8) });
  L.id = 'L1';
  const S = L.seasons[0];
  S.groups = ctx.lgCupGroups(S.entrants, S.fmt, new Map(), rng(9));
  const played = playAll(S).ms.map((m) => ({ ...m, league: 'L1' }));
  const file = JSON.parse(JSON.stringify(ctx.lgExportObj(L, played)));
  const r = ctx.lgImportObj(file, new Set(), 'L2');
  const S2 = r.L.seasons[0];
  // El cuadro sin el id de cada partido (al importar se reasigna).
  const bk = (st) => JSON.stringify(st.bracket.map((r) => r.map((t) => [t.a, t.b, t.winner, t.no])));
  check('los grupos viajan en el archivo', JSON.stringify(S2.groups) === JSON.stringify(S.groups));
  check('el importado llega al mismo campeón y cuadro',
        ctx.lgSeasonChampion(S2, r.matches).name === ctx.lgSeasonChampion(S, played).name &&
        bk(ctx.lgCupState(S2, r.matches)) === bk(ctx.lgCupState(S, played)));
  file.league.seasons[0].groups[0][0] = 'Nobody';
  check('un reparto que no cuadra se descarta al importar', !ctx.lgImportObj(file, new Set(), 'L3').L.seasons[0].groups);
  delete file.league.seasons[0].groups;
  check('un archivo sin grupos se importa (se sortean al jugar)', !ctx.lgImportObj(file, new Set(), 'L4').L.seasons[0].groups);
}

console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
