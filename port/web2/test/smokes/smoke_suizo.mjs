#!/usr/bin/env node
// Smoke del suizo de la liga web: rondas automáticas, cada uno juega
// una vez por ronda, sin repetir rival, un bye por cabeza (al de más abajo),
// revanchas cuando ya no queda con quién, nulos que se repiten, campeón y
// tabla (puntos, Buchholz), el sorteo del orden de la ronda 1, capWins en el
// desempate, migración y el ida y vuelta de exportar e importar con S.order.
// La paridad con torneo.mjs (mismos cruces que una corrida real) la mira
// tools/swiss/cruces_suizo.mjs.
//
// Copia de tools/swiss/smoke_suizo.mjs contra engine/ (paso E1.2, decisión
// C6 de port/web2/PLAN.md): los mismos chequeos, con engine/league.js en vez
// de web/league.js en un vm. Los rótulos se comparan con el inglés de la
// clásica (test/smokes/rotulos_en.mjs).
//
//   node test/smokes/smoke_suizo.mjs     (desde port/web2/)
import * as LG from '../../engine/league.js';
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
const ctx = { ...LG, lgFixture: (S, ms) => fixtureEn(LG.lgFixture(S, ms)) };

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
const ent = (name) => ({
  name,
  dna: `${name} .up store`,
  hash: ctx.lgHash(`${name} .up store`),
  src: 'form',
  file: '',
  color: '#fff',
});
const ents = (n) => Array.from({ length: n }, (_, i) => ent(`E${i}`));
const idx = (n) => +n.slice(1);
function season(n, o = {}, seed = 1) {
  const S = { no: 1, entrants: ents(n), fmt: { ...ctx.LG_FMT_DEFAULT, format: 'swiss', ...o } };
  S.order = ctx.lgShuffle(
    S.entrants.map((e) => e.name),
    rng(seed),
  );
  return S;
}
// Juega hasta el final: gana el de menor índice salvo que pick diga otra cosa.
function playAll(S, pick = (a, b) => (idx(a.name) < idx(b.name) ? a : b), voidAt = new Set()) {
  const ms = [],
    labels = [];
  for (let guard = 0; guard < 2000; guard++) {
    const fx = ctx.lgFixture(S, ms);
    if (!fx) break;
    labels.push(fx.label);
    const [a, b] = fx.fighters;
    const no = ms.length + 1,
      w = voidAt.has(no) ? null : pick(a, b);
    ms.push({
      id: no,
      season: 1,
      no,
      fighters: [a.name, b.name],
      winner: w ? w.name : '',
      wins: w ? [w === a ? 3 : 1, w === b ? 3 : 1] : [0, 0],
      capWins: [0, 0],
      cycles: 100,
      capRounds: 0,
      rounds: 4,
    });
  }
  return { ms, labels };
}

console.log('== rondas automáticas ==');
for (const [n, r] of [
  [2, 2],
  [8, 4],
  [16, 5],
  [17, 6],
  [32, 6],
  [33, 7],
])
  check(`${n} participantes: ${r} rondas`, ctx.lgSwissRounds(ctx.LG_FMT_DEFAULT, n) === r);
check('swissRounds fija las rondas', ctx.lgSwissRounds({ swissRounds: 3 }, 32) === 3);

console.log('\n== temporadas completas ==');
for (const n of [8, 16, 17, 24, 32]) {
  const S = season(n, {}, 100 + n);
  const { ms, labels } = playAll(S);
  const st = ctx.lgSwissState(S, ms),
    R = st.rounds;
  check(
    `${n}: ${R} rondas de ${Math.floor(n / 2)} partidos`,
    ms.length === R * Math.floor(n / 2),
    `${ms.length} partidos`,
  );
  const once = st.history.every((rd) => {
    const seen = rd.pairs.flatMap((t) => [t.a, t.b]).concat(rd.bye ? [rd.bye] : []);
    return seen.length === n && new Set(seen).size === n;
  });
  check(`${n}: cada ronda, cada uno juega una vez (o tiene el bye)`, once);
  const keys = ms.map((m) => m.fighters.slice().sort().join());
  check(`${n}: nunca el mismo cruce dos veces`, new Set(keys).size === keys.length);
  const byes = st.history.map((rd) => rd.bye).filter(Boolean);
  check(
    `${n}: ${n % 2 ? 'un bye por ronda, nunca dos al mismo' : 'sin byes'}`,
    n % 2 ? byes.length === R && new Set(byes).size === R : byes.length === 0,
  );
  check(
    `${n}: temporada terminada, sin próxima pelea`,
    ctx.lgSeasonDone(S, ms) && !ctx.lgFixture(S, ms),
  );
  const c = ctx.lgSeasonChampion(S, ms);
  check(
    `${n}: campeón el más fuerte, con ${R} puntos`,
    c && c.name === 'E0' && c.how === 'swiss' && st.table[0].points === R,
    c && `${c.name} ${st.table[0].points}`,
  );
  const rows = ctx.lgStandings(S, ms);
  check(
    `${n}: la tabla sigue a la del suizo (puntos no crecientes)`,
    rows.every((r, i) => r.name === st.table[i].name && (i === 0 || rows[i - 1].pts >= r.pts)),
  );
  check(
    `${n}: rótulo "Swiss round 1 of ${R} · match 1 of ${Math.floor(n / 2)}"`,
    labels[0].startsWith(`Swiss round 1 of ${R} · match 1 of ${Math.floor(n / 2)}`),
    labels[0],
  );
}

// ¿Hay un emparejamiento de todos sin repetir ninguno de met? (fuerza bruta)
function canPair(list, met) {
  if (!list.length) return true;
  const [p, ...rest] = list;
  return rest.some(
    (q, j) =>
      !met.has([p, q].sort().join()) &&
      canPair(
        rest.filter((_, k) => k !== j),
        met,
      ),
  );
}
console.log('\n== sin revanchas evitables (50 semillas, ganadores al azar) ==');
for (const n of [6, 8, 12, 16, 17, 32]) {
  let rep = 0,
    avoidable = 0,
    fights = 0;
  for (let s = 1; s <= 50; s++) {
    const r = rng(1000 * n + s),
      S = season(n, {}, s);
    const { ms } = playAll(S, (a, b) => (r() < 0.5 ? a : b));
    const st = ctx.lgSwissState(S, ms),
      met = new Set();
    for (const rd of st.history) {
      const keys = rd.pairs.map((t) => [t.a, t.b].sort().join());
      if (keys.some((k) => met.has(k))) {
        rep++;
        if (
          canPair(
            rd.pairs.flatMap((t) => [t.a, t.b]),
            met,
          )
        )
          avoidable++;
      }
      for (const k of keys) met.add(k);
    }
    fights += ms.length;
  }
  check(
    `${n}: ${fights} partidos, revanchas solo inevitables`,
    avoidable === 0,
    `${rep} rondas con revancha, ${avoidable} evitables`,
  );
}

console.log('\n== bye y puntos ==');
{
  const S = season(5, {}, 7);
  const { ms } = playAll(S);
  const st = ctx.lgSwissState(S, ms);
  const r1 = st.history[0];
  check(
    'ronda 1: el bye es el último del orden sorteado',
    r1.bye === S.order[4],
    `${r1.bye} / ${S.order.join(',')}`,
  );
  const pts = st.table.reduce((s, r) => s + r.points, 0);
  check(
    'puntos repartidos = partidos + byes',
    pts === ms.length + st.history.filter((rd) => rd.bye).length,
  );
  const bh = st.table.every(
    (r) =>
      r.buchholz === r.opponents.reduce((s, o) => s + st.table.find((x) => x.name === o).points, 0),
  );
  check('Buchholz = suma de los puntos de los rivales', bh);
}

console.log('\n== revanchas ==');
{
  const S = season(4, { swissRounds: 5 }, 3);
  const { ms } = playAll(S);
  check(
    '4 participantes y 5 rondas: 10 partidos, con revanchas',
    ms.length === 10 && ctx.lgSeasonDone(S, ms),
  );
}

console.log('\n== nulos ==');
{
  const S = season(8, {}, 9);
  const { ms } = playAll(S, undefined, new Set([2, 5]));
  const played = ms.filter((m) => m.winner);
  check(
    'dos nulos: se repiten (misma cantidad de partidos con ganador)',
    played.length === 4 * 4 && ms.length === 18,
  );
  check(
    'el partido que sigue a un nulo es el mismo cruce',
    ms[2].fighters.join() === ms[1].fighters.join() &&
      ms[5].fighters.join() === ms[4].fighters.join(),
  );
}

console.log('\n== desempate por extinción (capWins) ==');
{
  const rec = ctx.lgSwissRec({ fighters: ['A', 'B'], winner: 'A', wins: [3, 1], capWins: [2, 1] });
  check(
    'lgSwissRec: extinción = victorias − las del tope',
    rec.ext.join() === '1,0' && rec.won.join() === '3,1' && rec.lost.join() === '1,3',
  );
  const old = ctx.lgSwissRec({ fighters: ['A', 'B'], winner: 'A', wins: [3, 0] });
  check('sin capWins (partidos viejos): todas por extinción', old.ext.join() === '3,0');
  // Dos ganadores con igual puntaje, Buchholz y Elo: manda la extinción.
  const recs = [
    ctx.lgSwissRec({ fighters: ['A', 'B'], winner: 'A', wins: [3, 0], capWins: [3, 0] }),
    ctx.lgSwissRec({ fighters: ['C', 'D'], winner: 'C', wins: [3, 0], capWins: [0, 0] }),
  ];
  const t = ctx.lgSwissTable(['A', 'B', 'C', 'D'], recs).map((r) => r.name);
  check(
    'a igual puntaje, Buchholz y Elo: primero el que ganó por extinción',
    t.join() === 'C,A,B,D',
    t.join(),
  );
}

console.log('\n== sorteo del orden ==');
{
  const L = ctx.lgNewLeague({ name: 'Suizo', fmt: { format: 'swiss' }, entrants: ents(6) });
  const S = L.seasons[0];
  check(
    'sin orden: ninguna pelea todavía',
    !ctx.lgFixture(S, []) && ctx.lgSwissState(S, []).phase === 'draw',
  );
  check('lgSwissDraw sortea', ctx.lgSwissDraw(L, [], rng(1)) && S.order.length === 6);
  check('con orden válido no vuelve a sortear', !ctx.lgSwissDraw(L, [], rng(2)));
  S.entrants.push(ent('E6'));
  check(
    'sin partidos, un participante nuevo: vuelve a sortear',
    ctx.lgSwissDraw(L, [], rng(3)) && S.order.length === 7,
  );
  const ms = [
    { league: L.id, season: 1, no: 1, fighters: [S.order[0], S.order[1]], winner: S.order[0] },
  ];
  S.entrants.push(ent('E7'));
  const before = S.order.join();
  check(
    'con partidos: no vuelve a sortear',
    !ctx.lgSwissDraw(L, ms, rng(4)) && S.order.join() === before,
  );
  const st = ctx.lgSwissState(S, ms);
  check(
    'el que llegó tarde no entra en el campo (juega desde la temporada siguiente)',
    st.field.length === 7 && !st.field.includes('E7'),
  );
  const R = ctx.lgNewLeague({ name: 'RR', fmt: { format: 'rr' }, entrants: ents(4) });
  check('en otro formato no sortea', !ctx.lgSwissDraw(R, [], rng(1)) && !R.seasons[0].order);
}

console.log('\n== migración y archivo ==');
{
  check('LG_FORMATS incluye swiss', ctx.LG_FORMATS.includes('swiss'));
  const old = {
    id: 'x',
    name: 'Old',
    seasons: [{ no: 1, rules: {}, fmt: { format: 'swiss', qty: 5 }, entrants: [] }],
  };
  ctx.lgMigrate(old);
  check(
    'lgMigrate conserva el formato y completa swissRounds',
    old.seasons[0].fmt.format === 'swiss' && old.seasons[0].fmt.swissRounds === 0,
  );
  const L = ctx.lgNewLeague({ name: 'Suizo', fmt: { format: 'swiss' }, entrants: ents(9) });
  ctx.lgSwissDraw(L, [], rng(5));
  const S = L.seasons[0];
  const { ms } = playAll(S);
  const played = ms.map((m) => ({ ...m, league: L.id }));
  const file = JSON.parse(JSON.stringify(ctx.lgExportObj(L, played)));
  const imp = ctx.lgImportObj(file, new Set(), 'L2');
  const S2 = imp.L.seasons[0];
  check('importar conserva el orden de la ronda 1', S2.order.join() === S.order.join());
  const a = ctx.lgSeasonChampion(S, ms),
    b = ctx.lgSeasonChampion(
      S2,
      imp.matches.sort((x, y) => x.no - y.no),
    );
  check('y el mismo campeón', a && b && a.name === b.name, a?.name);
}

console.log(`\n${pass} ok · ${fail} fail`);
process.exit(fail ? 1 : 0);
