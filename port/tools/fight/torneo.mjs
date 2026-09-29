#!/usr/bin/env node
// Torneos con el binario nativo (tools/fight/dbfight.cpp): el rey de la
// colina de la web, pelea por pelea, sin navegador.
//
// Las reglas salen de la propia página, no de una copia: los defaults del
// panel de opciones (OPT_GROUPS de web/index.html) con el preset F1 encima
// (F1_OPTS, F1_COSTS, F1_KEYS, campo 9237×6928 toroidal), como "F1 preset"
// de un torneo; los valores del partido, de LG_FMT_DEFAULT (web/league.js).
// La lógica del torneo (quién pelea, rachas, retiro, sin repetir, Elo) es la
// de web/league.js, cargada en un vm como en los smokes.
//
//   node tools/fight/torneo.mjs koth [opciones]        (desde port/)
//   node tools/fight/torneo.mjs swiss [opciones]       (perfilar muchos bots)
//   node tools/fight/torneo.mjs duel <bot A> <bot B> [opciones]
//
// Bots: por nombre o archivo del Bestiary (web/bots/bots.json) o por ruta a
// un .txt. Sin --bots, el torneo usa todo el Bestiary de combate.
//
// Opciones (entre paréntesis, el default):
//   --bots a,b,c         participantes (todo el Bestiary)
//   --limit n            solo n participantes sorteados (todos)
//   --retire n           victorias seguidas para retirarse invicto (5)
//   --endless            la temporada no termina con el retiro
//   --no-repeat          quien ya peleó no vuelve a retar
//   --swiss-rounds n     suizo: rondas (⌈log2 N⌉ + 1)
//   --jobs n             suizo: peleas en paralelo (núcleos − 2)
//   --qty n              bots por especie (5)
//   --nrg n              energía inicial (3000)
//   --rounds n           rondas mínimas por partido (5)
//   --wins n             victorias para ganar el partido (3)
//   --cap n              tope de ciclos por ronda, 0 = sin tope (5000)
//   --cap-mode pop|nrg   al llegar al tope decide población o energía (pop)
//   --popcap n           tope de bots por especie, 0 = sin tope (500)
//   --min-vegs n --repop-amount n --repop-cooldown n --max-energy n
//   --max-pop n          economía vegetal (los del preset F1: 10, 10, 25, 40, 25)
//   --opt id=v --cost i=v  cualquier opción o coste (ids de dbcore_api.cpp)
//   --preset f1|panel    reglas: preset F1 (f1) o el panel por defecto (panel)
//   --seed n             semilla del torneo: fija las de cada partido (al azar)
//   --match-seed n       duel: la semilla del partido tal cual (la del JSON de
//                        un torneo), en vez de derivarla de --seed
//   --maxcycles n        red de seguridad por partido (2000000)
//   --exe ruta           dbfight (build/dbfight.exe)
//   --out archivo.json   resultado completo (tools/fight/out/<fecha>.json)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT_DIR = path.resolve(here, '..', '..');
const WEB = path.join(PORT_DIR, 'web');

// ---- Argumentos ------------------------------------------------------------
function parseArgs(argv) {
  const a = { _: [], opt: {}, cost: {} };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (!s.startsWith('--')) { a._.push(s); continue; }
    const k = s.slice(2);
    if (k === 'endless' || k === 'no-repeat') { a[k] = true; continue; }
    const v = argv[++i];
    if (v === undefined) throw new Error(`--${k} needs a value`);
    if (k === 'opt' || k === 'cost') {
      const [id, val] = v.split('=');
      a[k][+id] = +val;
    } else a[k] = v;
  }
  return a;
}
const num = (v, d) => (v === undefined ? d : Number(v));

// ---- Reglas desde la página ---------------------------------------------------
// Recorta `const NAME = ...;` de index.html y lo evalúa (son literales).
function pageConst(html, name, end) {
  const i = html.indexOf(`const ${name} = `);
  if (i < 0) throw new Error(`index.html: ${name} not found`);
  const j = html.indexOf(end, i);
  return vm.runInNewContext('(' + html.slice(i + `const ${name} = `.length, j + end.length - 1) + ')');
}

function pageRules() {
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  return {
    groups: pageConst(html, 'OPT_GROUPS', '\n];'),
    f1Costs: pageConst(html, 'F1_COSTS', '\n};'),
    f1Opts: pageConst(html, 'F1_OPTS', '\n};'),
    f1Keys: pageConst(html, 'F1_KEYS', '\n};'),
    alga: pageConst(html, 'PRESETS', '\n};').alga,
  };
}

const cssToVbColor = (css) =>
  parseInt(css.slice(1, 3), 16) + parseInt(css.slice(3, 5), 16) * 256 + parseInt(css.slice(5, 7), 16) * 65536;

// collectOptions() de la página con el panel en sus defaults y, con el
// preset F1, lo que hace applyF1Settings / lgF1Rules.
function buildRules(page, a) {
  const opts = {}, costs = {}, base = {};
  for (const g of page.groups) for (const it of g.items) {
    const v = it.bool ? (it.def ? 1 : 0) : it.def;
    if (it.id !== undefined) opts[it.id] = v;
    else if (it.cost !== undefined) costs[it.cost] = it.bool ? (it.def ? (it.on ?? 1) : 0) : v;
    else if (it.key !== undefined) base[it.key] = it.bool ? !!it.def : v;
  }
  // Fuera del panel de opciones (aside): gráficas y registro de muertos.
  Object.assign(opts, { 110: 200, 111: 0, 112: 0 });
  let field = [32000, 32000], shape = 'wall';
  if ((a.preset || 'f1') === 'f1') {
    for (const i in costs) costs[i] = page.f1Costs[i] ?? 0;
    for (const id in page.f1Opts) opts[id] = page.f1Opts[id];
    for (const k in page.f1Keys) base[k] = page.f1Keys[k];
    field = [9237, 6928];
    shape = 'tor';
  }
  opts[2] = shape === 'tor' || shape === 'v' ? 1 : 0;
  opts[3] = shape === 'tor' || shape === 'h' ? 1 : 0;
  const over = { 'min-vegs': 'minVegs', 'repop-amount': 'repopAmount', 'repop-cooldown': 'repopCooldown',
                 'max-energy': 'maxEnergy', 'max-pop': 'maxPopulation' };
  for (const k in over) if (a[k] !== undefined) base[over[k]] = +a[k];
  Object.assign(opts, a.opt);
  Object.assign(costs, a.cost);
  return { opts, costs, base, field };
}

// ---- Lógica del torneo (web/league.js) ---------------------------------------
// rnd: generador en [0, 1) para los sorteos de league.js (Math.random del vm).
function loadLeague(rnd) {
  // invColor: el color de un participante sin paleta libre (inventory.js).
  const ctx = { indexedDB: null, log: () => {}, console, invColor: () => '#8899bb',
                localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(WEB, 'league.js'), 'utf8');
  vm.runInContext(src + '\nObject.assign(this, { lgFixture, lgSeasonDone, lgSeasonChampion, ' +
    'lgStandings, lgKothState, lgKothClean, lgAddEntrant, lgSwissTable, lgSwissPair, lgSwissRounds, ' +
    'LG_FMT_DEFAULT, LG_HOW });', ctx);
  if (rnd) { ctx.__rnd = rnd; vm.runInContext('Math.random = __rnd;', ctx); }
  return ctx;
}

// ---- Bots ---------------------------------------------------------------------
function loadBestiary() {
  return JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8')).filter((b) => !b.veg);
}
function resolveBot(ref, bestiary) {
  if (fs.existsSync(ref) && fs.statSync(ref).isFile())
    return { name: path.basename(ref).replace(/\.txt$/i, ''), file: path.resolve(ref) };
  const b = bestiary.find((x) => x.name === ref || x.file === ref || x.file === ref + '.txt');
  if (!b) throw new Error(`bot not found: ${ref}`);
  return { name: b.name, file: path.join(WEB, 'bots', b.file) };
}

// ---- Una pelea -------------------------------------------------------------------
// Con --seed todo el torneo es reproducible: xorshift32 en [0, 1) para los
// sorteos (cruces, --limit) y, aparte, las semillas de cada partido.
function xorshift(seed) {
  let s = (Number(seed) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
// Semillas como el campo Seed de la página: enteros en [0, 100000).
function seeder(seed) {
  const r = seed === undefined ? Math.random : xorshift(Number(seed) ^ 0x9e3779b9);
  return () => Math.floor(r() * 100000);
}

function fightCfg(rules, page, fmt, fighters, seed, a) {
  const T = '\t', L = [];
  L.push(['seed', seed].join(T));
  L.push(['field', ...rules.field].join(T));
  const b = rules.base;
  for (const [k, v] of [['minvegs', b.minVegs], ['repopamount', b.repopAmount], ['repopcooldown', b.repopCooldown],
                        ['maxenergy', b.maxEnergy], ['startchlr', b.startChlr], ['mutations', b.mutations ? 1 : 0],
                        ['maxpop', b.maxPopulation]])
    L.push(['base', k, v].join(T));
  // contestLaunch: modo F1 y los valores del partido (99 y 100 en 0: el tope
  // es el del host).
  const opts = { ...rules.opts, 91: 1, 97: fmt.rounds, 98: fmt.wins || 0, 99: 0, 100: 0 };
  for (const id of Object.keys(opts).map(Number).sort((x, y) => x - y)) L.push(['opt', id, opts[id]].join(T));
  for (const i of Object.keys(rules.costs).map(Number).sort((x, y) => x - y)) L.push(['cost', i, rules.costs[i]].join(T));
  const alga = page.alga;
  L.push(['species', 1, alga.qty, alga.nrg, cssToVbColor(alga.color), alga.name, alga.file].join(T));
  const colors = ['#ff4040', '#4080ff', '#ffc020', '#c040ff'];
  fighters.forEach((e, i) => L.push(['species', 0, e.qty || fmt.qty, fmt.nrg, cssToVbColor(colors[i % 4]),
                                     e.name + '.txt', e.file].join(T)));
  L.push(['cap', fmt.cap || 0, fmt.capMode === 'nrg' ? 'nrg' : 'pop'].join(T));
  L.push(['popcap', fmt.popCap || 0].join(T));
  L.push(['maxcycles', num(a.maxcycles, 2000000)].join(T));
  return L.join('\n') + '\n';
}

function runFight(exe, cfg) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, ['-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    // Prioridad baja: con varias peleas en paralelo la máquina sigue usable.
    try { os.setPriority(p.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* sin permiso: sigue */ }
    let out = '', err = '';
    p.stdout.setEncoding('utf8').on('data', (d) => { out += d; });
    p.stderr.setEncoding('utf8').on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`dbfight exited ${code}: ${err.trim()}`));
      try { resolve(JSON.parse(out)); } catch (e) { reject(new Error(`dbfight: bad output: ${out}`)); }
    });
    p.stdin.end(cfg, 'utf8');
  });
}

// ---- Resumen por bot ------------------------------------------------------------
function botSummary(matches) {
  const rows = new Map();
  const row = (n) => rows.get(n) || rows.set(n, { name: n, fights: 0, won: 0, lost: 0, void: 0,
    roundsWon: 0, roundsWonExtinct: 0, roundsLost: 0 }).get(n);
  for (const m of matches) {
    for (const n of m.fighters) {
      const r = row(n);
      r.fights++;
      if (!m.winner) r.void++;
      else if (m.winner === n) r.won++;
      else r.lost++;
      for (const rd of m.result.rounds || []) {
        if (rd.winner === n) { r.roundsWon++; if (rd.how === 'extinct') r.roundsWonExtinct++; }
        else r.roundsLost++;
      }
    }
  }
  return [...rows.values()];
}

// ---- Sistema suizo -----------------------------------------------------------------
// Para perfilar muchos bots: cada ronda empareja bots con el mismo puntaje
// (sin repetir rival mientras se pueda), así en ~log2(N) rondas los fuertes
// terminan peleando entre ellos y la tabla ordena a todos. Las peleas de una
// ronda son independientes: corren en paralelo (--jobs).
// Puntos: victoria 1, nula ½, bye 1 (sin pelea). Desempates: Buchholz (suma
// de los puntos de los rivales), luego Elo (1500, K 32, en el orden de la
// ronda) y rondas ganadas por extinción. La tabla y el emparejamiento son
// los del formato 'swiss' de la liga web (lgSwissTable y lgSwissPair de
// web/league.js): los dos arman los mismos cruces.

// Un partido como registro de lgSwissTable: rondas ganadas, ganadas por
// extinción y perdidas de cada luchador (de result.rounds de dbfight).
function swissRec(m) {
  if (m.bye) return { bye: true, fighters: m.fighters, winner: m.winner };
  const rds = (m.result && m.result.rounds) || [];
  const count = (f) => m.fighters.map((n) => rds.filter((rd) => f(rd, n)).length);
  return { fighters: m.fighters, winner: m.winner, bye: false,
           won: count((rd, n) => rd.winner === n),
           ext: count((rd, n) => rd.winner === n && rd.how === 'extinct'),
           lost: count((rd, n) => rd.winner !== n) };
}
const swissTable = (lgx, players, matches) =>
  lgx.lgSwissTable(players.map((e) => e.name), matches.map(swissRec));

// Emparejamiento de una ronda (lgSwissPair) con los participantes.
function swissPair(lgx, order, table, matches) {
  const E = new Map(order.map((e) => [e.name, e]));
  const { pairs, bye } = lgx.lgSwissPair(order.map((e) => e.name), table.map((r) => r.name),
                                         matches.map(swissRec));
  return { pairs: pairs.map(([x, y]) => [E.get(x), E.get(y)]), bye: bye === null ? null : E.get(bye) };
}

async function pool(tasks, jobs) {
  const out = new Array(tasks.length);
  let next = 0;
  const worker = async () => { while (next < tasks.length) { const i = next++; out[i] = await tasks[i](); } };
  await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, worker));
  return out;
}

async function runSwiss({ lgx, S, a, draw, nextSeed, fight, matches, file, fmt, rules, t0 }) {
  const N = S.entrants.length;
  const rounds = num(a['swiss-rounds'], lgx.lgSwissRounds({}, N));
  const jobs = Math.max(1, num(a.jobs, Math.max(1, os.cpus().length - 2)));
  // Orden inicial al azar (con --seed, reproducible): la ronda 1 empareja así.
  const order = S.entrants.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(draw() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  console.log(`Swiss: ${N} entrants · ${rounds} rounds · ${jobs} parallel fights · ` +
    `${fmt.qty} bots, ${fmt.nrg} nrg, ${fmt.rounds} rounds, ${fmt.wins} wins, cap ${fmt.cap} (${fmt.capMode}), ` +
    `popcap ${fmt.popCap} · preset ${a.preset || 'f1'}`);
  const save = (done, round) => {
    fs.writeFileSync(file, JSON.stringify({ mode: 'swiss', done, round, rounds, date: new Date().toISOString(),
      fmt, rules, entrants: S.entrants.map((e) => e.name), matches,
      standings: swissTable(lgx, S.entrants, matches) }, null, 1));
  };
  for (let r = 1; r <= rounds; r++) {
    const table = r === 1 ? order.map((e) => ({ name: e.name })) : swissTable(lgx, S.entrants, matches);
    const { pairs, bye } = swissPair(lgx, order, table, matches);
    // Semillas y números en el orden del emparejamiento: el resultado no
    // depende de qué pelea termina primero.
    const base = matches.length;
    const todo = pairs.map(([x, y], i) => {
      const seed = nextSeed();
      return () => fight([x, y], seed, base + i + 1);
    });
    console.log(`\n== Round ${r}/${rounds}: ${pairs.length} fights${bye ? ` · bye: ${bye.name}` : ''} ==`);
    const tr = Date.now();
    const got = await pool(todo, jobs);
    for (const m of got) { m.round = r; matches.push(m); }
    if (bye) matches.push({ no: matches.length + 1, round: r, bye: true, fighters: [bye.name], winner: bye.name });
    const tab = swissTable(lgx, S.entrants, matches);
    console.log(`-- round ${r} in ${((Date.now() - tr) / 1000).toFixed(0)}s · top 10:`);
    tab.slice(0, 10).forEach((x, i) => console.log(`   ${i + 1}. ${x.name} · ${x.points} pts · ` +
      `Bh ${x.buchholz} · Elo ${Math.round(x.elo)} · ${x.roundsWonExtinct}/${x.roundsWon} rounds by extinction`));
    save(r === rounds, r);
  }
  console.log(`\n${matches.filter((m) => !m.bye).length} fights in ${((Date.now() - t0) / 60000).toFixed(1)} min → ${file}`);
}

// ---- Main ---------------------------------------------------------------------------
async function main() {
  const a = parseArgs(process.argv.slice(2));
  const mode = a._.shift();
  if (mode !== 'koth' && mode !== 'duel' && mode !== 'swiss') {
    console.error('usage: torneo.mjs koth|swiss [options] | duel <bot A> <bot B> [options]');
    process.exit(2);
  }
  const exe = a.exe || path.join(PORT_DIR, 'build', process.platform === 'win32' ? 'dbfight.exe' : 'dbfight');
  if (!fs.existsSync(exe)) throw new Error(`${exe} not found: cmake --build --preset native-gcc --target dbfight`);

  const page = pageRules();
  const rules = buildRules(page, a);
  const draw = a.seed === undefined ? Math.random : xorshift(a.seed);
  const lgx = loadLeague(a.seed === undefined ? null : draw);
  const D = lgx.LG_FMT_DEFAULT;
  const fmt = lgx.lgKothClean({
    ...D, format: 'koth', k: 2,
    retire: num(a.retire, D.retire), kothEnd: a.endless ? 'never' : 'retire', noRepeat: !!a['no-repeat'],
    qty: num(a.qty, D.qty), nrg: num(a.nrg, D.nrg), rounds: num(a.rounds, D.rounds), wins: num(a.wins, D.wins),
    cap: num(a.cap, D.cap), capMode: a['cap-mode'] || D.capMode, popCap: num(a.popcap, D.popCap),
  });

  // El alga de arranque va como archivo, igual que los luchadores.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dbfight-'));
  page.alga.file = path.join(tmp, page.alga.name);
  fs.writeFileSync(page.alga.file, page.alga.dna);

  const bestiary = loadBestiary();
  let refs = mode === 'duel' ? a._.slice(0, 2) : a.bots ? a.bots.split(',') : bestiary.map((b) => b.file);
  if (mode === 'duel' && refs.length !== 2) throw new Error('duel needs two bots');
  const S = { no: 1, entrants: [], fmt };
  const byName = new Map();
  for (const ref of refs) {
    const b = resolveBot(ref.trim(), bestiary);
    const dna = fs.readFileSync(b.file, 'utf8');
    if (lgx.lgAddEntrant(S, { name: b.name, dna, src: 'form' }))
      byName.set(S.entrants[S.entrants.length - 1].name, b.file);
  }
  if (a.limit) {
    for (let i = S.entrants.length - 1; i > 0; i--) {   // Fisher-Yates
      const j = Math.floor(draw() * (i + 1));
      [S.entrants[i], S.entrants[j]] = [S.entrants[j], S.entrants[i]];
    }
    S.entrants.length = Math.min(S.entrants.length, +a.limit);
  }
  for (const e of S.entrants) e.file = byName.get(e.name);

  const nextSeed = seeder(a.seed);
  const matches = [], dropped = [];
  const file = a.out || path.join(here, 'out', `${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Cada 10 peleas se guarda lo jugado (done: false): una corrida larga
  // cortada no pierde todo.
  const save = (done) => {
    const out = { mode, done, date: new Date().toISOString(), fmt, rules,
                  entrants: S.entrants.map((e) => e.name), dropped, matches, bots: botSummary(matches) };
    if (mode === 'koth') {
      out.champion = lgx.lgSeasonChampion(S, matches);
      out.standings = lgx.lgStandings(S, matches);
      if (done && out.champion) console.log(`\nChampion: ${out.champion.name} ${lgx.LG_HOW[out.champion.how]}.`);
    }
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
  };
  const t0 = Date.now();
  // Una pelea: dbfight + registro. Un fallo de dbfight cuenta como nula.
  const fight = async (fighters, seed, no) => {
    let res;
    try {
      res = await runFight(exe, fightCfg(rules, page, fmt, fighters, seed, a));
    } catch (e) {
      res = { winner: '', void: 'dbfight failed: ' + e.message, cycles: 0, secs: 0, rounds: [] };
    }
    // El nombre de especie es el del participante (+ ".txt" que RealName quita).
    const m = { no, fighters: fighters.map((e) => e.name), winner: res.winner, seed, result: res };
    const rds = (res.rounds || []).map((r) => `${r.winner === fighters[0].name ? 'A' : 'B'}${r.how === 'cap' ? '*' : ''}`).join('');
    console.log(`#${m.no} ${m.fighters.join(' vs ')} → ` +
      (res.winner ? `🏆 ${res.winner}` : `void (${res.void})`) +
      ` · rounds ${rds || '-'} · ${res.cycles} cycles · ${res.secs}s · seed ${seed}`);
    return m;
  };
  if (mode === 'swiss') {
    await runSwiss({ lgx, S, a, draw, nextSeed, fight, matches, file, fmt, rules, t0 });
    fs.rmSync(tmp, { recursive: true, force: true });
    return;
  }
  console.log(`${mode === 'duel' ? 'Duel' : 'King of the hill'}: ${S.entrants.length} entrants · ` +
    `retire ${fmt.retire}${fmt.kothEnd === 'never' ? ' (endless)' : ''}${fmt.noRepeat ? ' · no repeats' : ''} · ` +
    `${fmt.qty} bots, ${fmt.nrg} nrg, ${fmt.rounds} rounds, ${fmt.wins} wins, cap ${fmt.cap} (${fmt.capMode}), ` +
    `popcap ${fmt.popCap} · preset ${a.preset || 'f1'}`);
  for (;;) {
    const fx = mode === 'duel'
      ? (matches.length ? null : { fighters: S.entrants })
      : lgx.lgFixture(S, matches);
    if (!fx) break;
    const fighters = fx.fighters;
    const seed = mode === 'duel' && a['match-seed'] !== undefined ? Number(a['match-seed']) : nextSeed();
    const m = await fight(fighters, seed, matches.length + 1);
    matches.push(m);
    const res = m.result;
    // Sin ganador, la misma pelea se volvería a sortear siempre: fuera los
    // que el cargador rechazó (no llegan al censo) o, si no se sabe, los
    // retadores (el campeón sigue).
    if (!res.winner && mode === 'koth') {
      const inCensus = new Set((res.species || []).map((x) => x.name));
      let gone = fighters.filter((e) => res.species && !inCensus.has(e.name));
      if (!gone.length) {
        const { champ } = lgx.lgKothState(S, matches);
        gone = fighters.filter((e) => e.name !== champ);
      }
      for (const e of gone) {
        S.entrants.splice(S.entrants.indexOf(e), 1);
        dropped.push({ name: e.name, fight: m.no, why: res.void });
        console.log(`   dropped: ${e.name} (${res.void})`);
      }
    }
    if (m.no % 10 === 0) save(false);
  }

  save(true);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${matches.length} fights in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${file}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
