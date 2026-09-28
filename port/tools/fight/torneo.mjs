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
    'lgStandings, lgKothState, lgKothClean, lgAddEntrant, LG_FMT_DEFAULT, LG_HOW });', ctx);
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

// ---- Main ---------------------------------------------------------------------------
async function main() {
  const a = parseArgs(process.argv.slice(2));
  const mode = a._.shift();
  if (mode !== 'koth' && mode !== 'duel') {
    console.error('usage: torneo.mjs koth [options] | duel <bot A> <bot B> [options]');
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
  const matches = [];
  const t0 = Date.now();
  console.log(`${mode === 'duel' ? 'Duel' : 'King of the hill'}: ${S.entrants.length} entrants · ` +
    `retire ${fmt.retire}${fmt.kothEnd === 'never' ? ' (endless)' : ''}${fmt.noRepeat ? ' · no repeats' : ''} · ` +
    `${fmt.qty} bots, ${fmt.nrg} nrg, ${fmt.rounds} rounds, ${fmt.wins} wins, cap ${fmt.cap} (${fmt.capMode}), ` +
    `popcap ${fmt.popCap} · preset ${a.preset || 'f1'}`);
  for (;;) {
    const fx = mode === 'duel'
      ? (matches.length ? null : { fighters: S.entrants })
      : lgx.lgFixture(S, matches);
    if (!fx) break;
    const seed = nextSeed();
    const fighters = fx.fighters;
    const res = await runFight(exe, fightCfg(rules, page, fmt, fighters, seed, a));
    // El nombre de especie es el del participante (+ ".txt" que RealName quita).
    const m = { no: matches.length + 1, fighters: fighters.map((e) => e.name), winner: res.winner,
                seed, result: res };
    matches.push(m);
    const rds = (res.rounds || []).map((r) => `${r.winner === fighters[0].name ? 'A' : 'B'}${r.how === 'cap' ? '*' : ''}`).join('');
    console.log(`#${m.no} ${m.fighters.join(' vs ')} → ` +
      (res.winner ? `🏆 ${res.winner}` : `void (${res.void})`) +
      ` · rounds ${rds || '-'} · ${res.cycles} cycles · ${res.secs}s · seed ${seed}`);
  }

  const out = { mode, date: new Date().toISOString(), fmt, rules, entrants: S.entrants.map((e) => e.name),
                matches, bots: botSummary(matches) };
  if (mode === 'koth') {
    out.champion = lgx.lgSeasonChampion(S, matches);
    out.standings = lgx.lgStandings(S, matches);
    if (out.champion) console.log(`\nChampion: ${out.champion.name} ${lgx.LG_HOW[out.champion.how]}.`);
  }
  const file = a.out || path.join(here, 'out', `${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${matches.length} fights in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${file}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
