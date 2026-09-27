#!/usr/bin/env node
// Torneos — smoke del sorteo en cada pelea (league.draw.mode 'fight'): el
// rey de la colina sortea los retadores de cada pelea y termina con el
// retiro o a las 3 × n; la escalera sortea cada aspirante al entrar, hasta n
// (o hasta que el pool se agota); todos contra todos sortea n al primer
// partido; la copa no sortea en cada pelea (sortea por temporada); la
// temporada nueva empieza vacía; exportar e importar conserva la foto del
// sorteo.
//
// Solo web/league.js en un vm, con el Inventario y el ADN de mentira (sin
// DOM ni IndexedDB: lgSave falla en silencio).
//
//   node tools/e11/smoke_sorteo_pelea.mjs     (desde port/)
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

// Inventario: 12 bestias; dos con el mismo ADN, una ilegible y un vegetal.
const beasts = [];
for (let i = 0; i < 12; i++) beasts.push({ name: `B${i}`, file: `b${i}.txt`, dna: `${i} .up store` });
beasts[5].dna = beasts[4].dna;              // mismo ADN que B4
beasts[7].dna = null;                       // ilegible
beasts.push({ name: 'Veg', file: 'veg.txt', dna: 'veg', veg: true });
const ctx = {
  indexedDB: null, log: () => {}, console,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  invColor: () => '#rnd',
  inv: { items: beasts.map((b) => ({ key: b.file, b })), sel: new Set(),
         sets: new Map([['two', { keys: ['b0.txt', 'b1.txt'] }]]) },
  userRec: () => ({ fav: false, tags: [] }),
  invFetchDna: async (b) => { if (!b.dna) throw new Error('unreadable'); return b.dna; },
};
vm.createContext(ctx);
const src = fs.readFileSync(path.join(PORT_DIR, 'web', 'league.js'), 'utf8');
vm.runInContext(src + '\nObject.assign(this, { lg, lgFixture, lgSeasonDone, lgSeasonChampion, ' +
  'lgNewLeague, lgNewSeason, lgLiveSync, lgLiveFill, lgKothCap, lgLadderState, lgRrState, lgSeason, ' +
  'lgExportObj, lgImportObj, lgDrawClean });', ctx);

// Liga abierta (lg.cur) con el sorteo dado, sin partidos.
function open(fmt, draw) {
  const L = ctx.lgNewLeague({ id: 'T', name: 'T', fmt, draw: { pool: 'all', ...draw } });
  ctx.lg.cur = L;
  ctx.lg.matches = [];
  ctx.lgLiveSync(L);
  return L;
}
// Juega la próxima pelea (sorteo incluido) y la gana `pick(fighters)`.
async function play(L, pick = (f) => f[0]) {
  await ctx.lgLiveFill(L);
  const S = ctx.lgSeason(L), ms = ctx.lg.matches.filter((m) => m.season === S.no);
  const fx = ctx.lgFixture(S, ms);
  if (!fx) return null;
  const names = fx.fighters.map((e) => e.name);
  ctx.lg.matches.push({ league: L.id, season: S.no, no: ms.length + 1, fighters: names, winner: pick(names) });
  return names;
}
const done = (L) => {
  const S = ctx.lgSeason(L);
  return ctx.lgSeasonDone(S, ctx.lg.matches.filter((m) => m.season === S.no));
};

console.log('\n== el modo se guarda ==');
check('lgDrawClean acepta fight', ctx.lgDrawClean({ mode: 'fight' }).mode === 'fight');
check('y lo que no conoce es fixed', ctx.lgDrawClean({ mode: 'x' }).mode === 'fixed');

console.log('\n== rey de la colina: retadores en cada pelea ==');
{
  const L = open({ format: 'koth', k: 3, retire: 3 }, { mode: 'fight', n: 4 });
  const S = ctx.lgSeason(L);
  check('la temporada lleva la foto del sorteo', S.live && S.live.pool === 'all' && S.live.n === 4);
  check('sin participantes todavía', S.entrants.length === 0 && !ctx.lgFixture(S, []) && !done(L));
  check('el tope es 3 × n', ctx.lgKothCap(S) === 12);
  const f1 = await play(L);
  check('la primera pelea sortea 3 del pool', f1 && f1.length === 3 && S.entrants.length === 3, f1 && f1.join(' '));
  check('sin vegetales ni ilegibles', f1.every((n) => n !== 'Veg' && n !== 'B7'));
  const f2 = await play(L);
  check('el campeón defiende contra 2 retadores nuevos del pool',
        f2 && f2.length === 3 && f2[0] === f1[0] && !f2.slice(1).includes(f1[0]), f2 && f2.join(' '));
  check('los sorteados quedan inscriptos (con su ADN)', f2.every((n) => S.entrants.some((e) => e.name === n && e.dna)));
  // Abandonar: la misma pelea sigue sorteada.
  await ctx.lgLiveFill(L);
  const a = ctx.lgFixture(S, ctx.lg.matches).fighters.map((e) => e.name).join();
  await ctx.lgLiveFill(L);
  check('volver a pedirla no sortea de nuevo', ctx.lgFixture(S, ctx.lg.matches).fighters.map((e) => e.name).join() === a);
  await play(L);
  check('tres seguidas: se retira y termina la temporada', done(L) &&
        ctx.lgSeasonChampion(S, ctx.lg.matches).name === f1[0]);
}
{
  const L = open({ format: 'koth', k: 2, retire: 99 }, { mode: 'fight', n: 2 });
  let n = 0;
  while (!done(L) && n < 20) { await play(L, (f) => f[n % 2]); n++; }
  check('sin retiro, termina a las 3 × n peleas', done(L) && n === 6, `${n} peleas`);
}

console.log('\n== escalera: cada aspirante al entrar ==');
{
  const L = open({ format: 'ladder' }, { mode: 'fight', n: 4 });
  const S = ctx.lgSeason(L);
  const f1 = await play(L);
  check('la primera pelea sortea 2', f1 && f1.length === 2 && S.entrants.length === 2);
  await play(L);
  check('el tercero se sortea cuando le toca', S.entrants.length === 3 && !done(L));
  let n = 0;
  while (!done(L) && n < 20) { await play(L, (f) => f[1]); n++; }
  const st = ctx.lgLadderState(S, ctx.lg.matches);
  check('termina con n en la escalera', done(L) && S.entrants.length === 4 && st.ladder.length === 4);
}
{
  const L = open({ format: 'ladder' }, { mode: 'fight', n: 5, pool: 'set:two' });
  await play(L);
  await ctx.lgLiveFill(L);
  check('con el pool agotado, termina con los que hay', done(L) && ctx.lgSeason(L).live.n === 2);
}

console.log('\n== todos contra todos y partido único: n al primer partido ==');
{
  const L = open({ format: 'rr' }, { mode: 'fight', n: 4 });
  const S = ctx.lgSeason(L);
  await play(L);
  check('sortea n y arma el calendario', S.entrants.length === 4 && ctx.lgRrState(S, ctx.lg.matches).total === 6);
  await play(L);
  check('después no sortea más', S.entrants.length === 4);
  const M = open({ format: 'single' }, { mode: 'fight', n: 5 });
  const f = await play(M);
  check('partido único con los n sorteados', f && f.length === 5 && done(M));
}

console.log('\n== copa, temporada nueva e importar ==');
{
  const L = open({ format: 'cup' }, { mode: 'fight', n: 8 });
  check('la copa no sortea en cada pelea', !ctx.lgSeason(L).live);
  await ctx.lgNewSeason(L);
  check('sortea en cada temporada nueva', ctx.lgSeason(L).entrants.length === 8 && !ctx.lgSeason(L).live);
}
{
  const L = open({ format: 'koth', k: 2, retire: 1 }, { mode: 'fight', n: 3 });
  await play(L);
  check('fijada la temporada, cambiar el sorteo no la toca',
        (L.draw = ctx.lgDrawClean({ ...L.draw, n: 9 }), !ctx.lgLiveSync(L)) && ctx.lgSeason(L).live.n === 3);
  await ctx.lgNewSeason(L);
  const S2 = ctx.lgSeason(L);
  check('la temporada nueva empieza vacía, con la foto nueva', S2.no === 2 && !S2.entrants.length && S2.live.n === 9);
  const r = ctx.lgImportObj(JSON.parse(JSON.stringify(ctx.lgExportObj(L, ctx.lg.matches))), new Set(), 'X');
  check('exportar e importar conserva la foto', r.L.seasons[0].live.n === 3 && r.L.seasons[1].live.n === 9);
}
{
  const L = open({ format: 'koth' }, { mode: 'random', n: 3 });
  check('con el sorteo por temporada no hay foto', !ctx.lgSeason(L).live);
}

console.log(`\n${pass} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
