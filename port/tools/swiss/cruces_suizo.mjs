#!/usr/bin/env node
// ¿La liga web arma los mismos cruces que torneo.mjs swiss? Toma el
// JSON de una corrida (tools/fight/out/*.json, mode 'swiss'), reconstruye el
// orden sorteado de la ronda 1 con sus cruces y su bye, pasa los partidos a
// registros de la liga (wins y capWins de result.rounds) y compara, ronda
// por ronda, los cruces y el bye de lgSwissState con los del JSON; al final,
// la tabla (orden, puntos y Buchholz) con sus standings.
//
// Los nulos valen ½ en torneo.mjs y se repiten en la web: con nulos en el
// JSON, la comparación no aplica (se avisa y sale con error). Las corridas
// anteriores emparejaban con el goloso puro, que a veces dejaba una
// revancha evitable; ahora se vuelve atrás para evitarla. En esas
// corridas se compara hasta la ronda de la primera revancha.
//
//   node tools/swiss/cruces_suizo.mjs tools/fight/out/bestiario-swiss-v3.json [...]   (desde port/)
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT_DIR = path.resolve(here, '..', '..');

const ctx = { indexedDB: null, log: () => {}, console, invColor: () => '#8899bb',
              localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
vm.createContext(ctx);
const src = fs.readFileSync(path.join(PORT_DIR, 'web', 'league.js'), 'utf8');
vm.runInContext(src + '\nObject.assign(this, { lgSwissState, lgStandings, lgSeasonChampion, LG_FMT_DEFAULT });', ctx);

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: cruces_suizo.mjs <swiss JSON> [...]'); process.exit(2); }
let bad = 0;
for (const file of files) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tag = path.basename(file);
  if (j.mode !== 'swiss') { console.log(`${tag}: not a swiss run`); bad++; continue; }
  const fights = j.matches.filter((m) => !m.bye);
  if (fights.some((m) => !m.winner)) { console.log(`${tag}: has void fights (½ in torneo.mjs, replayed on the web)`); bad++; continue; }
  const byRound = (r) => j.matches.filter((m) => m.round === r);
  const r1 = byRound(1);
  const order = [...r1.filter((m) => !m.bye).flatMap((m) => m.fighters), ...r1.filter((m) => m.bye).map((m) => m.fighters[0])];
  const S = { no: 1, entrants: j.entrants.map((name) => ({ name, color: '#fff' })), order,
              fmt: { ...ctx.LG_FMT_DEFAULT, format: 'swiss', swissRounds: j.rounds } };
  // Partidos de la liga: en el orden de juego (el de torneo.mjs), sin byes.
  const ms = fights.map((m, i) => {
    const rds = m.result.rounds || [];
    return { id: i + 1, no: i + 1, season: 1, fighters: m.fighters, winner: m.winner,
             wins: m.fighters.map((n) => rds.filter((rd) => rd.winner === n).length),
             capWins: m.fighters.map((n) => rds.filter((rd) => rd.winner === n && rd.how !== 'extinct').length) };
  });
  const st = ctx.lgSwissState(S, ms);
  let diffs = 0;
  const seen = new Set();
  const rematch = fights.find((m) => { const k = m.fighters.slice().sort().join('\u0000');
                                       return seen.has(k) || !seen.add(k); });
  const last = Math.max(...j.matches.map((m) => m.round)), upTo = rematch ? rematch.round - 1 : last;
  if (rematch) console.log(`  rematch in round ${rematch.round} (${rematch.fighters.join(' vs ')}): comparing rounds 1-${upTo}`);
  for (let r = 1; r <= upTo; r++) {
    const want = byRound(r), rd = st.history[r - 1];
    const wp = want.filter((m) => !m.bye).map((m) => m.fighters.join(' | '));
    const wb = (want.find((m) => m.bye) || { fighters: [null] }).fighters[0];
    const gp = rd ? rd.pairs.map((t) => [t.a, t.b].join(' | ')) : [];
    const same = wp.length === gp.length && wp.every((p, k) => p === gp[k]) && (rd ? rd.bye : null) === wb;
    if (!same) {
      diffs++;
      const k = wp.findIndex((p, i) => p !== gp[i]);
      console.log(`  round ${r}: DIFFERS` + (k >= 0 ? ` at pair ${k + 1}: ${wp[k]}  vs web  ${gp[k]}` : ` (bye ${wb} vs ${rd && rd.bye})`));
    }
  }
  const tabOk = !!rematch || st.table.length === j.standings.length && st.table.every((x, k) =>
    x.name === j.standings[k].name && x.points === j.standings[k].points && x.buchholz === j.standings[k].buchholz);
  const done = st.phase === 'done' ? 'season done' : `phase ${st.phase}`;
  const champ = ctx.lgSeasonChampion(S, ms);
  console.log(`${tag}: ${j.entrants.length} entrants · ${last} rounds · ${fights.length} fights · ` +
              `${diffs ? `${diffs} rounds differ` : `rounds 1-${upTo} pair the same`} · table ${rematch ? 'not compared' : tabOk ? 'same' : 'DIFFERS'}` +
              `${rematch ? '' : ` · ${done}`}${champ ? ` · champion ${champ.name}` : ''}`);
  if (diffs || !tabOk || (!rematch && j.done && st.phase !== 'done')) bad++;
}
process.exit(bad ? 1 : 0);
