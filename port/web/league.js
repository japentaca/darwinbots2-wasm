'use strict';
// Ligas (E10, capa host, fuera de la fidelidad). Una liga junta lo que el
// Contest y el Canal tienen suelto: reglas (una foto del panel de opciones),
// formato del torneo, participantes con el ADN congelado, historial de
// partidos con su semilla y estadísticas derivadas de ese historial.
//
// Temporadas: las reglas y el formato se bloquean con el primer partido de la
// temporada; "New season" los desbloquea, copia los participantes y deja el
// historial anterior consultable. Las estadísticas son siempre de una
// temporada.
//
// Los partidos se juegan con contestLaunch (contest.js): reinicio, siembra,
// censo F1 y arranque. index.html reenvía aquí los mensajes del worker
// (leagueOnMessage); las stats de cada frame van a tournament.js.
//
// E11 (torneos unificados): todo es un torneo. Formato `single` (el Contest:
// un partido con todos), toda temporada termina (lgSeasonDone) y tiene
// campeón (lgSeasonChampion), el sorteo es de la liga (league.draw), la
// tabla histórica sale del historial (lgAllTime) y el torneo "Scratch" vive
// en memoria hasta "Save as tournament" (lgScratchSave).
//
// Usa globales de index.html (makeWindow, winLayer, log, escHtml, worker,
// setInput, fieldSizeDims, F1_COSTS, F1_OPTS, F1_KEYS), de inventory.js (inv,
// invLoad, invFetchDna, invColor, userRec, allTags, InvDB), de lab.js
// (labDnaByName), de contest.js (contestLaunch, contestDna) y de
// tournament.js (tnRender, tnNote, tnOnResult, tvStop), estos últimos solo
// si existen.

// ---- IndexedDB (base propia: no toca la del Inventario) ----------------------
const LgDB = (() => {
  let dbp = null;
  function open() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('darwinbots-ligas', 1);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('leagues')) db.createObjectStore('leagues', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('matches'))
            db.createObjectStore('matches', { keyPath: 'id', autoIncrement: true });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  function req(store, mode, fn) {
    return open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }
  return {
    all: (store) => req(store, 'readonly', (s) => s.getAll()),
    put: (store, v) => req(store, 'readwrite', (s) => s.put(v)),
    del: (store, k) => req(store, 'readwrite', (s) => s.delete(k)),
    // Borra los partidos de una liga (en una transacción).
    delMatches: (league) => req('matches', 'readwrite', (s) => {
      s.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (!c) return;
        if (c.value.league === league) c.delete();
        c.continue();
      };
    }),
  };
})();

// ---- Estado -------------------------------------------------------------------
const lg = {
  win: null,
  list: [],        // ligas
  cur: null,       // liga abierta
  matches: [],     // partidos de la liga abierta (todas las temporadas)
  live: null,      // partido en curso (ver lgPlayNext); live.replay = repetición
  checked: new Map(), // id del partido → 'same' | 'diff' (repeticiones de esta sesión)
  scratch: null,   // E11: {L, matches, seq} torneo Scratch en memoria (ver lgScratchNew)
};
const LG_CUR_KEY = 'db-league-cur';
const LG_FMT_DEFAULT = {
  // 'single' (un partido con todos) | 'koth' (rey de la colina) |
  // 'rr' (todos contra todos) | 'ladder' (escalera) | 'cup' (copa, E12)
  format: 'koth',
  k: 2,             // koth: luchadores por pelea
  retire: 5,        // koth: victorias seguidas para retirarse invicto (0 = nunca, solo sin fin)
  kothEnd: 'retire', // koth: la temporada termina con el primer retiro ('retire') o nunca ('never')
  noRepeat: false,  // koth: quien ya peleó no vuelve a retar (el campeón defiende mientras gane)
  legs: 1,          // rr: vueltas
  qty: 5,           // bots por especie (entrant.qty lo pisa)
  nrg: 3000, rounds: 5, wins: 3,
  cap: 5000,        // tope de ciclos por ronda (0 = sin tope)
  capMode: 'pop',   // al llegar al tope: 'pop' (más bots) | 'nrg' (más nrg + body×10)
  popCap: 500,      // tope de bots por especie: poda a los más pobres (0 = sin tope)
  groupLegs: 1,     // cup (E12): vueltas de la fase de grupos
  pots: 'elo',      // cup: bombos por el Elo del Hall of Fame ('elo') o sorteo puro ('random')
  third: false,     // cup: partido por el 3.er puesto
};
const LG_FORMATS = ['single', 'koth', 'rr', 'ladder', 'cup'];
// Participantes de cada temporada: lista fija (a mano, se copia a la
// temporada nueva), sorteo de n del pool en cada temporada nueva ('random')
// o sorteo en cada pelea ('fight', salvo la copa, que entonces sortea en
// cada temporada: ver lgLiveFill). El pool es un filtro de lgPool ('all',
// 'fav', 'sel', 'tag:…', 'set:…').
const LG_DRAW_DEFAULT = { mode: 'fixed', pool: 'all', n: 8 };
// Sin tope real: el sorteo toma a lo sumo lo que tiene el pool. Este número
// solo acota lo que llega de un archivo o de un campo mal escrito.
const LG_DRAW_MAX = 10000;
// Todos contra todos: a partir de aquí la ventana avisa del largo del calendario.
const LG_RR_WARN = 1000;
const LG_ELO0 = 1500, LG_K = 32;
const LG_MAX_FIGHTERS = 20;   // PopArray(1 To 20), F1Mode.bas:59
const LG_KOTH_CAP = 3;        // rey de la colina: tope de 3 × N peleas por temporada
const LG_SCRATCH_ID = 'scratch';
// Colores de los participantes, claros para el campo oscuro y ordenados para
// que los primeros sean los más distintos entre sí. Hasta 20 (el máximo de
// especies por partido).
const LG_COLORS = [
  '#ff4040', '#3d9bff', '#ffd83a', '#ff5ce1', '#3fe8e0', '#ff9020', '#a46bff',
  '#8ce83c', '#ffffff', '#ff9eb0', '#1fbf7a', '#c79a62', '#b8c8ff', '#f0ff80',
  '#8a8aff', '#ffc6f0', '#e05a2a', '#7fd8ff', '#b0b0b0', '#c0ffc8',
];

const lgSeason = (L) => L.seasons[L.seasons.length - 1];
const lgSeasonMatches = (no) => lg.matches.filter((m) => m.season === no)
  .sort((a, b) => a.no - b.no);
const lgPlayed = (ms) => ms.filter((m) => m.winner);
const lgIsScratch = (L) => !!L && L.id === LG_SCRATCH_ID;
// Liga por id: la de la lista o el Scratch.
const lgFind = (id) => (id === LG_SCRATCH_ID ? lg.scratch && lg.scratch.L : lg.list.find((L) => L.id === id));
const lgDrawOf = (L) => lgDrawClean(L && L.draw);
function lgDrawClean(d) {
  const o = { ...LG_DRAW_DEFAULT, ...(d && typeof d === 'object' ? d : {}) };
  return { mode: o.mode === 'random' || o.mode === 'fight' ? o.mode : 'fixed',
           pool: typeof o.pool === 'string' && o.pool ? o.pool : LG_DRAW_DEFAULT.pool,
           n: Math.min(LG_DRAW_MAX, Math.max(2, parseInt(o.n, 10) || LG_DRAW_DEFAULT.n)) };
}

// FNV-1a de 32 bits: identifica el ADN congelado de cada participante.
function lgHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---- Reglas: foto del panel de opciones ----------------------------------------
// Todo control con data-id / data-cost / data-key más el campo. Los de modo de
// juego que contestLaunch fija en cada partido quedan fuera.
const LG_FIELD_IDS = ['o-fsize', 'o-fw', 'o-fh', 'o-shape'];
const LG_SKIP = new Set(['o-91', 'o-97', 'o-98', 'o-99', 'o-100']);
function lgRuleEls() {
  const els = LG_FIELD_IDS.map((id) => document.getElementById(id));
  document.querySelectorAll('aside [data-id], #opts-panel [data-cost], #opts-panel [data-key]')
    .forEach((el) => { if (el.id && !LG_SKIP.has(el.id)) els.push(el); });
  return els.filter(Boolean);
}
const lgElValue = (el) => (el.type === 'checkbox' ? el.checked : String(el.value));

function lgCaptureRules() {
  const r = {};
  for (const el of lgRuleEls()) r[el.id] = lgElValue(el);
  return r;
}

// Los ajustes de liga de btnSetF1 (applyF1Settings) sin tocar el panel.
function lgF1Rules() {
  const r = lgCaptureRules();
  const put = (id, v) => {
    const el = document.getElementById(id);
    if (el) r[id] = el.type === 'checkbox' ? !!v : String(v);
  };
  for (const id in r) {
    const el = document.getElementById(id);
    if (el.dataset.cost !== undefined) put(id, F1_COSTS[+el.dataset.cost] ?? 0);
  }
  for (const id in F1_OPTS) if (!LG_SKIP.has('o-' + id)) put('o-' + id, F1_OPTS[id]);
  for (const k in F1_KEYS) put('o-' + k, F1_KEYS[k]);
  const [w, h] = fieldSizeDims(1);
  Object.assign(r, { 'o-fsize': '1', 'o-fw': String(w), 'o-fh': String(h), 'o-shape': 'tor' });
  return r;
}

function lgNoCostRules() {
  const r = lgCaptureRules();
  for (const id in r) {
    const el = document.getElementById(id);
    if (el.dataset.cost === undefined) continue;
    const c = +el.dataset.cost;
    // CostX (54) queda en 1 como el default del panel; los demás a 0.
    r[id] = el.type === 'checkbox' ? false : (c === 54 ? '1' : '0');
  }
  return r;
}

// Escribe las reglas en el panel y dispara cada 'change' (en vivo, como
// applyF1Settings). El reinicio del partido las toma de ahí (collectOptions);
// los costes que el panel no muestra salen del core recién creado, en 0.
function lgApplyRules(r) {
  for (const id of Object.keys(r)) {
    const el = document.getElementById(id);
    if (!el) continue;
    setInput(el, r[id]);
    el.dispatchEvent(new Event('change'));
  }
  // o-fsize rellena ancho y alto: se reescriben después con los de la foto.
  for (const id of ['o-fw', 'o-fh']) {
    const el = document.getElementById(id);
    if (el && r[id] !== undefined) el.value = r[id];
  }
}

const lgLabel = (id) => {
  const l = document.querySelector(`label[for="${id}"]`);
  return l ? l.textContent.trim() : id;
};
function lgRulesSummary(r) {
  const costs = [];
  for (const id in r) {
    const el = document.getElementById(id);
    if (!el || el.dataset.cost === undefined || el.type === 'checkbox') continue;
    const v = parseFloat(r[id]) || 0;
    if (v && +el.dataset.cost !== 54) costs.push(`${lgLabel(id)} <b>${escHtml(String(r[id]))}</b>`);
  }
  const shape = { wall: 'walls', tor: 'toroidal', h: 'horizontal cylinder', v: 'vertical cylinder' }[r['o-shape']] || '';
  const diff = lgRuleEls().filter((el) => r[el.id] !== undefined && r[el.id] !== lgElValue(el)).length;
  return `<div>Field <b>${escHtml(r['o-fw'] || '?')}×${escHtml(r['o-fh'] || '?')}</b> ${shape}` +
    (r['o-maxPopulation'] !== undefined ? ` · max population <b>${escHtml(String(r['o-maxPopulation']))}</b>` : '') +
    (r['o-mutations'] !== undefined ? ` · mutations <b>${r['o-mutations'] ? 'on' : 'off'}</b>` : '') + '</div>' +
    `<div class="lg-costs">${costs.length ? costs.join(' · ') : 'No costs: bots spend no energy.'}` +
    (r['o-c54'] !== undefined && r['o-c54'] !== '1' ? ` · CostX <b>${escHtml(String(r['o-c54']))}</b>` : '') + '</div>' +
    `<div class="ct-rule">${diff ? `The Sim options panel differs in ${diff} settings.` : 'The Sim options panel matches these rules.'}</div>`;
}

// ---- Calendario ------------------------------------------------------------------
// Todos contra todos por el método del círculo: cada jornada, cada uno juega
// a lo sumo una vez (con número impar, uno descansa). La segunda vuelta
// invierte el orden de siembra.
function lgRrFixtures(n, legs) {
  const a = [...Array(n).keys()];
  if (n % 2) a.push(-1);
  const m = a.length, pairs = [];
  for (let r = 0; r < m - 1; r++) {
    for (let i = 0; i < m / 2; i++) {
      const x = a[i], y = a[m - 1 - i];
      if (x >= 0 && y >= 0) pairs.push(r % 2 ? [y, x] : [x, y]);
    }
    a.splice(1, 0, a.pop());
  }
  const out = [];
  for (let leg = 1; leg <= legs; leg++)
    for (const [x, y] of pairs) out.push({ leg, pair: leg % 2 ? [x, y] : [y, x] });
  return out;
}
const lgPairKey = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a);

function lgRrState(S, ms) {
  const E = S.entrants;
  const fx = lgRrFixtures(E.length, S.fmt.legs);
  const cnt = new Map();
  for (const m of lgPlayed(ms)) {
    if (m.fighters.length !== 2) continue;
    const k = lgPairKey(m.fighters[0], m.fighters[1]);
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  let played = 0, next = null;
  for (const f of fx) {
    const [x, y] = f.pair;
    if ((cnt.get(lgPairKey(E[x].name, E[y].name)) || 0) >= f.leg) played++;
    else if (!next) next = [E[x], E[y]];
  }
  return { total: fx.length, played, next };
}

// Rey de la colina: el campeón y su racha salen de recorrer el historial.
// E11: first = el primero que se retiró invicto (gana la temporada);
// played = peleas jugadas (los nulos no cuentan). Con retire 0 (solo en la
// colina sin fin) el rey no se retira nunca.
function lgKothState(S, ms) {
  let champ = null, streak = 0, first = null, played = 0;
  const titles = new Map();
  for (const m of lgPlayed(ms)) {
    played++;
    if (champ === m.winner) streak++;
    else { champ = m.winner; streak = 1; }
    if (S.fmt.retire > 0 && streak >= S.fmt.retire) {
      titles.set(champ, (titles.get(champ) || 0) + 1);
      if (!first) first = champ;
      champ = null;
      streak = 0;
    }
  }
  if (champ && !S.entrants.some((e) => e.name === champ)) champ = null;
  return { champ, streak, titles, first, played };
}
// Sin repetir: los que ya pelearon en la temporada (los nulos no cuentan).
const lgFought = (ms) => new Set(lgPlayed(ms).flatMap((m) => m.fighters));
// Rey de la colina sin repetir: ¿quedan retadores que no pelearon? Con
// sorteo en cada pelea lo decide lgLiveFill al sortear (S.dry = partidos de
// la temporada cuando el pool se secó); con la lista fija, la lista.
function lgKothDry(S, ms) {
  if (!S.fmt.noRepeat) return false;
  if (S.live) return S.dry === ms.length;
  const { champ } = lgKothState(S, ms), fought = lgFought(ms);
  const fresh = S.entrants.filter((e) => e.name !== champ && !fought.has(e.name)).length;
  return fresh < (champ ? 1 : 2);
}
// Con sorteo en cada pelea, N es el n del sorteo (los inscriptos no paran de crecer).
const lgKothCap = (S) => LG_KOTH_CAP * (S.live ? S.live.n : S.entrants.length);
// Colina sin fin: la temporada no termina nunca (ni retiro ni tope).
const lgKothEndless = (f) => f.format === 'koth' && f.kothEnd === 'never';
// Retiro 0 (nunca) solo tiene sentido en la colina sin fin.
function lgKothClean(f) {
  if (f.kothEnd !== 'never') f.kothEnd = 'retire';
  if (f.kothEnd !== 'never' && !(f.retire >= 1)) f.retire = 1;
  f.noRepeat = f.noRepeat === true;
  return f;
}

// ¿Terminó la temporada? Con menos de 2 participantes no se juega ni termina.
// single: con su partido; rr y escalera: con el calendario completo; rey de
// la colina: con el primer retiro invicto o al tope de 3 × N peleas (sin fin:
// nunca) y, sin repetir, también sin retadores nuevos; copa: con la final jugada.
function lgSeasonDone(S, ms) {
  if (S.entrants.length < 2) return false;
  const f = S.fmt.format;
  if (f === 'single') return lgPlayed(ms).length > 0;
  if (f === 'rr') return !lgRrState(S, ms).next;
  if (f === 'ladder') return !lgLadderState(S, ms).next && !(S.live && S.entrants.length < S.live.n);
  if (f === 'cup') return lgCupState(S, ms).phase === 'done';
  if (lgKothDry(S, ms)) return true;
  if (lgKothEndless(S.fmt)) return false;
  const k = lgKothState(S, ms);
  return !!k.first || k.played >= lgKothCap(S);
}

// Campeón de una temporada terminada: {name, how} o null si sigue en juego.
// how: 'match' (single), 'retired' (rey de la colina), 'elo' (rey de la
// colina al tope: el primero por Elo), 'table' (rr: el primero de la tabla),
// 'ladder' (escalera: el peldaño 1), 'cup' (copa: el ganador de la final).
function lgSeasonChampion(S, ms) {
  if (!lgSeasonDone(S, ms)) return null;
  const f = S.fmt.format;
  if (f === 'single') return { name: lgPlayed(ms)[0].winner, how: 'match' };
  if (f === 'cup') return { name: lgCupState(S, ms).champion, how: 'cup' };
  if (f === 'koth') {
    const k = lgKothState(S, ms);
    if (k.first) return { name: k.first, how: 'retired' };
    return { name: lgStandings(S, ms)[0].name, how: lgKothDry(S, ms) ? 'dry' : 'elo' };
  }
  return { name: lgStandings(S, ms)[0].name, how: f === 'ladder' ? 'ladder' : 'table' };
}
const LG_HOW = { match: 'wins the match', retired: 'retires undefeated',
                 elo: 'tops the Elo at the fight cap', dry: 'tops the table when no fresh challenger is left', table: 'tops the table',
                 ladder: 'holds the top rung', cup: 'wins the final' };

// Escalera (populateladder, F1Mode.bas:443-500): los participantes entran de
// a uno en el orden de inscripción; el primero ocupa el peldaño 1 sin pelear.
// Cada aspirante desafía desde el peldaño 1 hacia abajo: si gana, ocupa ese
// peldaño y empuja a los demás un lugar; si pierde con todos, queda último.
// Todo sale de recorrer el historial (solo cuentan los duelos esperados).
function lgLadderState(S, ms) {
  const E = S.entrants, ladder = [];
  let ci = 0, pos = 0;
  if (E.length) { ladder.push(E[0].name); ci = 1; }
  for (const m of lgPlayed(ms)) {
    if (ci >= E.length) break;
    const c = E[ci].name, rung = ladder[pos];
    if (m.fighters.length !== 2 || !m.fighters.includes(c) || !m.fighters.includes(rung)) continue;
    if (m.winner === c) { ladder.splice(pos, 0, c); ci++; pos = 0; }
    else if (++pos >= ladder.length) { ladder.push(c); ci++; pos = 0; }
  }
  const next = ci < E.length && E.length >= 2
    ? [E.find((e) => e.name === ladder[pos]), E[ci]] : null;
  return { ladder, next, rung: pos + 1, placed: ci, total: E.length };
}

// ---- Copa (E12): grupos + eliminatorias --------------------------------------
// Grupos de 4 (todos contra todos, 1 o 2 vueltas); pasan los 2 primeros de
// cada grupo a un cuadro con el cruce del Mundial (1A-2B y 1B-2A en mitades
// opuestas, y así con cada par de grupos). Cada cruce es un partido (un nulo
// se repite) y, con fmt.third, el partido por el 3.er puesto va antes de la
// final. Solo con 8, 16 o 32 participantes. Todo sale del historial salvo el
// reparto de los grupos: S.groups = [[nombres del grupo A], [B], …], cada
// grupo con su bombo 1 primero.
const LG_CUP_SIZES = [8, 16, 32];
const LG_CUP_GROUP = 4;
const lgCupSizeOk = (S) => LG_CUP_SIZES.includes(S.entrants.length);
const lgCupLetter = (g) => String.fromCharCode(65 + g);

// ¿S.groups reparte exactamente a los participantes de la temporada?
function lgCupGroupsOk(S) {
  const G = S.groups;
  if (!lgCupSizeOk(S) || !Array.isArray(G) || G.length !== S.entrants.length / LG_CUP_GROUP) return false;
  const names = new Set(S.entrants.map((e) => e.name)), seen = new Set();
  for (const g of G) {
    if (!Array.isArray(g) || g.length !== LG_CUP_GROUP) return false;
    for (const n of g) {
      if (!names.has(n) || seen.has(n)) return false;
      seen.add(n);
    }
  }
  return true;
}

// Sorteo de los grupos (pura; rnd: generador en [0, 1)). elo: nombre → Elo
// del Hall of Fame (1500 si no está). Con pots 'elo', los bombos son tramos
// de G participantes ordenados por Elo (los empates quedan al azar) y cada
// grupo recibe uno de cada bombo; con 'random', sorteo puro.
function lgCupGroups(entrants, fmt, elo, rnd = Math.random) {
  const G = Math.max(1, Math.floor(entrants.length / LG_CUP_GROUP));
  const list = lgShuffle(entrants.map((e) => e.name), rnd);
  if (fmt.pots !== 'random') {
    const v = (n) => (elo && elo.has(n) ? elo.get(n) : LG_ELO0);
    list.sort((a, b) => v(b) - v(a));        // sort estable: los empates siguen al azar
  }
  const groups = Array.from({ length: G }, () => []);
  for (let p = 0; p < list.length; p += G)
    lgShuffle(list.slice(p, p + G), rnd).forEach((n, i) => groups[i].push(n));
  return groups;
}

// Sortea los grupos de la temporada abierta si faltan (o ya no sirven) y el
// tamaño es de copa. Bombos con el Elo de la tabla histórica. true si sorteó.
function lgCupDraw(L, matches, rnd = Math.random) {
  const S = lgSeason(L);
  if (S.fmt.format !== 'cup' || !lgCupSizeOk(S) || lgCupGroupsOk(S)) return false;
  const elo = new Map(lgAllTime(L, matches).map((r) => [r.name, r.elo]));
  S.groups = lgCupGroups(S.entrants, S.fmt, elo, rnd);
  return true;
}
async function lgCupEnsure(L) {
  if (lgCupDraw(L, lg.matches)) await lgSave(L);
}

// Tabla de un grupo: victorias; entre los empatados, sus duelos directos; el
// Elo de la fase de grupos; menos rondas ganadas por el tope de ciclos; menos
// ciclos por partido; y por último el orden del sorteo.
function lgCupSort(rows, h2h) {
  const avg = (r) => (r.p ? r.cyc / r.p : 0);
  const mini = new Map(rows.map((r) => [r, rows.filter((x) => x.w === r.w)
    .reduce((s, x) => s + h2h(r.name, x.name), 0)]));
  return rows.slice().sort((a, b) => b.w - a.w || mini.get(b) - mini.get(a) || b.elo - a.elo ||
    a.capR - b.capR || avg(a) - avg(b) || a.seed - b.seed);
}

// Nombre de la ronda de n cruces (y del k-ésimo cruce, si k).
function lgCupRound(n, k) {
  if (n === 1) return 'FINAL';
  const r = n === 2 ? 'Semi-final' : n === 4 ? 'Quarter-final' : `Round of ${2 * n}`;
  return k ? `${r} · match ${k} of ${n}` : r;
}

// Estado de la copa (pura): {phase: 'draw' | 'groups' | 'ko' | 'done',
// groups: [{name, rows}], played y total (partidos de grupo), fixtures: el
// calendario de grupos [{gi, day, leg, a, b, winner, no, id}], bracket:
// [[{a, b, winner, no, id}]] por ronda, third, next, label, champion, reach}.
// reach: nombre → hasta dónde llegó (0 = grupos, 1 = primera ronda del
// cuadro…; el ganador del 3.er puesto suma 0.5 y el campeón uno más que la
// final). Los partidos de grupo son los duelos del calendario hasta
// completarlo; después solo cuenta el duelo del cruce pendiente.
function lgCupState(S, ms) {
  const st = { phase: 'draw', groups: [], played: 0, total: 0, fixtures: [], bracket: [], third: null,
               next: null, label: '', champion: null, reach: new Map() };
  if (!lgCupGroupsOk(S)) return st;
  const legs = S.fmt.groupLegs === 2 ? 2 : 1;
  const E = new Map(S.entrants.map((e) => [e.name, e]));
  const gOf = new Map();
  S.groups.forEach((g, gi) => g.forEach((n) => gOf.set(n, gi)));
  // Calendario intercalado: la jornada 1 de A, B, C…, luego la 2…
  const rr = lgRrFixtures(LG_CUP_GROUP, legs), perDay = LG_CUP_GROUP / 2, days = rr.length / perDay;
  const fx = [];
  for (let d = 0; d < days; d++) {
    S.groups.forEach((g, gi) => {
      for (let k = 0; k < perDay; k++) {
        const f = rr[d * perDay + k];
        fx.push({ gi, day: d + 1, leg: f.leg, a: g[f.pair[0]], b: g[f.pair[1]] });
      }
    });
  }
  st.total = fx.length;
  const rows = new Map();
  S.groups.forEach((g, gi) => g.forEach((n, i) => rows.set(n, {
    name: n, color: (E.get(n) || {}).color || '#8899bb', group: gi, seed: i,
    p: 0, w: 0, elo: LG_ELO0, cyc: 0, capR: 0, rounds: 0 })));
  for (const n of rows.keys()) st.reach.set(n, 0);
  const cnt = new Map(), gms = [], ko = [];
  for (const m of lgPlayed(ms)) {
    if (gms.length >= fx.length) { ko.push(m); continue; }
    const [a, b] = m.fighters;
    if (m.fighters.length !== 2 || a === b || !gOf.has(a) || gOf.get(a) !== gOf.get(b)) continue;
    const k = lgPairKey(a, b), c = cnt.get(k) || 0;
    if (c >= legs) continue;
    cnt.set(k, c + 1);
    gms.push(m);
    const f0 = fx.find((x) => x.leg === c + 1 && lgPairKey(x.a, x.b) === k);
    if (f0) Object.assign(f0, { winner: m.winner, no: m.no, id: m.id });
    const f = [rows.get(a), rows.get(b)], w = rows.get(m.winner);
    for (const r of f) { r.p++; r.cyc += m.cycles || 0; }
    if (!w) continue;
    w.w++;
    w.capR += m.capRounds || 0;
    w.rounds += m.rounds || 0;
    lgElo(f, w);
  }
  st.played = gms.length;
  st.fixtures = fx;
  const h2h = lgH2H(gms);
  st.groups = S.groups.map((g, gi) => ({ name: lgCupLetter(gi),
                                         rows: lgCupSort(g.map((n) => rows.get(n)), h2h) }));
  if (gms.length < fx.length) {
    const f = fx.find((x) => (cnt.get(lgPairKey(x.a, x.b)) || 0) < x.leg);
    st.phase = 'groups';
    st.next = [E.get(f.a), E.get(f.b)];
    st.label = `Group ${lgCupLetter(f.gi)} · matchday ${f.day} of ${days}`;
    return st;
  }
  // Cuadro: 1A-2B, 1C-2D… en la mitad de arriba; 1B-2A, 1D-2C… en la de abajo.
  st.phase = 'ko';
  const top = [], bottom = [], at = (gi, pos) => st.groups[gi].rows[pos].name;
  for (let gi = 0; gi < st.groups.length; gi += 2) {
    top.push({ a: at(gi, 0), b: at(gi + 1, 1) });
    bottom.push({ a: at(gi + 1, 0), b: at(gi, 1) });
  }
  let i = 0;
  const play = (t, label) => {
    while (i < ko.length) {
      const m = ko[i++];
      if (m.fighters.length === 2 && m.fighters.includes(t.a) && m.fighters.includes(t.b)) {
        Object.assign(t, { winner: m.winner, no: m.no, id: m.id });
        return;
      }
    }
    if (!st.next) { st.next = [E.get(t.a), E.get(t.b)]; st.label = label; }
  };
  const loser = (t) => (t.winner === t.a ? t.b : t.a);
  let ties = [...top, ...bottom], lvl = 1;
  for (;;) {
    st.bracket.push(ties);
    ties.forEach((t, k) => {
      st.reach.set(t.a, lvl);
      st.reach.set(t.b, lvl);
      play(t, lgCupRound(ties.length, ties.length > 1 ? k + 1 : 0));
    });
    if (ties.some((t) => !t.winner)) return st;
    if (ties.length === 1) break;
    if (ties.length === 2 && S.fmt.third) {
      st.third = { a: loser(ties[0]), b: loser(ties[1]) };
      play(st.third, 'Third place');
      if (!st.third.winner) return st;
      st.reach.set(st.third.winner, lvl + 0.5);
    }
    const nx = [];
    for (let k = 0; k < ties.length; k += 2) nx.push({ a: ties[k].winner, b: ties[k + 1].winner });
    ties = nx;
    lvl++;
  }
  st.phase = 'done';
  st.champion = ties[0].winner;
  st.reach.set(st.champion, lvl + 1);
  return st;
}

function lgShuffle(list, rnd = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Próxima pelea de la temporada abierta de L (lee lg.matches).
const lgNextFixture = (L) => lgFixture(lgSeason(L), lgSeasonMatches(lgSeason(L).no));

// Próxima pelea: {fighters, label} o null si la temporada terminó (o tiene
// menos de 2 participantes). Pura salvo el sorteo del rey de la colina.
function lgFixture(S, ms) {
  const E = S.entrants;
  if (E.length < 2 || lgSeasonDone(S, ms)) return null;
  if (S.fmt.format === 'single') {
    const n = Math.min(E.length, LG_MAX_FIGHTERS);
    return { fighters: E.slice(0, n),
             label: `Single match: ${n} entrants` + (E.length > n ? ` (the first ${n} of ${E.length})` : '') };
  }
  if (S.fmt.format === 'rr') {
    const st = lgRrState(S, ms);
    return st.next && { fighters: st.next, label: `Fixture ${st.played + 1} of ${st.total}` };
  }
  if (S.fmt.format === 'ladder') {
    const st = lgLadderState(S, ms);
    return st.next && { fighters: st.next,
      label: `Ladder: ${st.next[1].name} challenges rung ${st.rung} (entrant ${st.placed + 1} of ${st.total})` };
  }
  if (S.fmt.format === 'cup') {
    // Sin grupos sorteados (lgCupEnsure) o sin 8, 16 o 32 participantes: nada.
    const st = lgCupState(S, ms);
    return st.next && { fighters: st.next, label: st.label };
  }
  const { champ, played } = lgKothState(S, ms);
  const ce = champ ? E.find((e) => e.name === champ) : null;
  let others;
  if (S.live) {
    // Sorteo en cada pelea: los retadores que sorteó lgLiveFill para esta pelea.
    const nx = S.next && S.next.at === ms.length ? S.next.names.map((n) => E.find((e) => e.name === n)) : null;
    if (!nx || nx.some((e) => !e || e === ce) || nx.length + (ce ? 1 : 0) < 2) return null;
    others = nx;
  } else {
    const k = Math.min(Math.max(2, S.fmt.k), E.length, LG_MAX_FIGHTERS);
    const fought = S.fmt.noRepeat ? lgFought(ms) : new Set();
    others = lgShuffle(E.filter((e) => e !== ce && !fought.has(e.name))).slice(0, ce ? k - 1 : k);
  }
  return { fighters: ce ? [ce, ...others] : others,
           label: (ce ? `👑 ${champ} defends the crown` : 'Open fight: no champion') +
                  ` · fight ${played + 1}` + (lgKothEndless(S.fmt) ? '' : ` of at most ${lgKothCap(S)}`) };
}

// ---- Tabla -------------------------------------------------------------------
// Elo: en una pelea de N, el ganador le gana a cada uno de los demás con
// K / (N − 1), así una pelea de muchos no vale más que un duelo.
function lgElo(f, w) {
  const k = LG_K / Math.max(1, f.length - 1), before = w.elo;
  for (const r of f) {
    if (r === w) continue;
    const exp = 1 / (1 + Math.pow(10, (r.elo - before) / 400));
    const d = k * (1 - exp);
    w.elo += d;
    r.elo -= d;
  }
}

function lgStandings(S, ms) {
  const rows = new Map();
  const row = (name) => rows.get(name) || rows.set(name, {
    name, color: (S.entrants.find((e) => e.name === name) || {}).color || '#8899bb',
    p: 0, w: 0, elo: LG_ELO0, cyc: 0, capR: 0, rounds: 0 }).get(name);
  for (const e of S.entrants) row(e.name);
  for (const m of lgPlayed(ms)) {
    const f = m.fighters.map(row);
    for (const r of f) { r.p++; r.cyc += m.cycles || 0; }
    const w = row(m.winner);
    w.w++;
    w.capR += m.capRounds || 0;
    w.rounds += m.rounds || 0;
    lgElo(f, w);
  }
  const list = [...rows.values()];
  if (S.fmt.format === 'ladder') {
    // El orden de la escalera; los que aún no entraron, al final.
    const at = new Map(lgLadderState(S, ms).ladder.map((n, i) => [n, i]));
    const rank = (r) => (at.has(r.name) ? at.get(r.name) : 1e9);
    list.sort((a, b) => rank(a) - rank(b) || b.elo - a.elo);
  } else if (S.fmt.format === 'cup') {
    // Hasta dónde llegó cada uno (lgCupState), luego victorias y Elo.
    const reach = lgCupState(S, ms).reach;
    const lv = (r) => reach.get(r.name) || 0;
    list.sort((a, b) => lv(b) - lv(a) || b.w - a.w || b.elo - a.elo);
  } else if (lgKothEndless(S.fmt)) {
    // Colina sin fin: manda quien junta más retiros invictos, luego el Elo.
    const t = lgKothState(S, ms).titles, n = (r) => t.get(r.name) || 0;
    list.sort((a, b) => n(b) - n(a) || b.elo - a.elo || b.w - a.w);
  } else if (S.fmt.format === 'rr') list.sort((a, b) => b.w - a.w || b.elo - a.elo || a.p - b.p);
  else list.sort((a, b) => b.elo - a.elo || b.w - a.w);
  return list;
}

// Tabla histórica (el Hall of Fame de la liga): todas las temporadas, en
// orden, con un Elo que sigue de una a otra. Títulos = temporadas ganadas;
// seasons = temporadas en las que jugó al menos un partido. Solo aparecen
// los que jugaron. matches: los partidos de la liga (de cualquier temporada).
function lgAllTime(L, matches) {
  const rows = new Map();
  const row = (name) => rows.get(name) || rows.set(name, {
    name, color: '#8899bb', seasons: 0, titles: 0, p: 0, w: 0, elo: LG_ELO0 }).get(name);
  for (const S of L.seasons) {
    const ms = matches.filter((m) => m.season === S.no).sort((a, b) => a.no - b.no);
    const seen = new Set();
    for (const m of lgPlayed(ms)) {
      const f = m.fighters.map(row);
      for (const r of f) { r.p++; seen.add(r); }
      const w = row(m.winner);
      w.w++;
      lgElo(f, w);
    }
    for (const r of seen) {
      r.seasons++;
      const e = S.entrants.find((x) => x.name === r.name);
      if (e) r.color = e.color;
    }
    const c = lgSeasonChampion(S, ms);
    if (c) row(c.name).titles++;
  }
  return [...rows.values()].filter((r) => r.p)
    .sort((a, b) => b.titles - a.titles || b.w - a.w || b.elo - a.elo);
}

// ---- Persistencia ---------------------------------------------------------------
// Migración (E11): el sorteo de la liga y los valores de formato que falten.
// Devuelve true si cambió algo (hay que guardarla).
function lgMigrate(L) {
  let changed = false;
  const d = lgDrawOf(L);
  if (JSON.stringify(d) !== JSON.stringify(L.draw)) { L.draw = d; changed = true; }
  for (const S of L.seasons) {
    // Las temporadas de antes del tope de bots juegan sin él (las repeticiones
    // de sus partidos deben dar lo mismo).
    const f = { ...LG_FMT_DEFAULT, popCap: 0, ...(S.fmt || {}) };
    if (!LG_FORMATS.includes(f.format)) f.format = LG_FMT_DEFAULT.format;
    lgKothClean(f);
    if (JSON.stringify(f) !== JSON.stringify(S.fmt)) { S.fmt = f; changed = true; }
  }
  return changed;
}

async function lgLoadAll() {
  try {
    lg.list = (await LgDB.all('leagues')).sort((a, b) => a.created.localeCompare(b.created));
  } catch (e) { lg.list = []; log('leagues: no IndexedDB (' + e.message + ')'); }
  for (const L of lg.list) if (lgMigrate(L)) await lgSave(L);
  let id = '';
  try { id = localStorage.getItem(LG_CUR_KEY) || ''; } catch (e) { /* nada */ }
  // E11: sin torneo recordado (o el Scratch), el Scratch.
  await lgSelect(lg.list.find((L) => L.id === id) || lgScratch());
}

async function lgSelect(L) {
  // El Canal con liga lee el calendario de lg.cur: cambiar de liga lo apaga.
  // El TV mode juega el torneo abierto: cambiar de torneo lo apaga.
  if (lg.cur !== L && typeof tvStop === 'function') tvStop();
  lg.cur = L;
  lg.matches = [];
  if (lgIsScratch(L)) lg.matches = lg.scratch.matches;   // el mismo arreglo: lgRecord lo llena
  else if (L) {
    try { lg.matches = (await LgDB.all('matches')).filter((m) => m.league === L.id); } catch (e) { /* nada */ }
  }
  if (L) try { localStorage.setItem(LG_CUR_KEY, L.id); } catch (e) { /* nada */ }
  lgRender();
}

// El Scratch no se guarda (vive en memoria hasta "Save as tournament").
async function lgSave(L) {
  if (lgIsScratch(L)) return;
  try { await LgDB.put('leagues', L); } catch (e) { log('leagues: could not save (' + e.message + ')'); }
}

// Liga nueva (pura): o = {id, name, rules, fmt, entrants, draw}.
function lgNewLeague(o) {
  const now = new Date().toISOString();
  return {
    id: o.id || lgNewId(), name: o.name || 'League', notes: '', created: now,
    draw: lgDrawClean(o.draw),
    seasons: [{ no: 1, started: now, rules: { ...(o.rules || {}) },
                fmt: { ...LG_FMT_DEFAULT, ...(o.fmt || {}) },
                entrants: (o.entrants || []).map((e) => ({ ...e })) }],
  };
}

// Nombre libre entre `names`: base, "base 2", "base 3"…
function lgUniqueName(base, names) {
  let name = base;
  for (let k = 2; names.has(name); k++) name = `${base} ${k}`;
  return name;
}

function lgNextName(prefix) {
  const names = new Set(lg.list.map((L) => L.name));
  let n = lg.list.length + 1;
  while (names.has(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
}

async function lgCreate(base) {
  const rules = base === 'f1' ? lgF1Rules() : base === 'free' ? lgNoCostRules() : lgCaptureRules();
  const L = lgNewLeague({ name: lgNextName('Tournament'), rules });
  lg.list.push(L);
  await lgSave(L);
  await lgSelect(L);
}

// ---- Scratch (E11): el partido rápido ---------------------------------------------
// Un torneo en memoria (id fijo, no se guarda) de formato single, para jugar
// enseguida como el Contest de antes. "Save as tournament" lo persiste con id
// nuevo y deja un Scratch limpio con las mismas reglas, formato y
// participantes. base: una liga de la que copiar eso (o nada: reglas F1).
function lgScratchNew(base, rules) {
  const S = base && lgSeason(base);
  const L = lgNewLeague({
    id: LG_SCRATCH_ID, name: 'Scratch',
    rules: S ? S.rules : rules || {},
    fmt: S ? S.fmt : { format: 'single' },
    entrants: S ? S.entrants : [],
    draw: base ? base.draw : null,
  });
  return { L, matches: [], seq: 0 };
}

// El Scratch, creado la primera vez con las reglas F1 (las del Contest).
function lgScratch() {
  if (!lg.scratch) lg.scratch = lgScratchNew(null, lgF1Rules());
  return lg.scratch.L;
}

// Pura: el Scratch como liga nueva {L, matches} (id y nombre dados; los
// partidos reasignados, sin id). Reusa el camino de exportar e importar.
function lgPromote(L, matches, id, name) {
  const r = lgImportObj(lgExportObj({ ...L, name }, matches), new Set(), id);
  r.L.created = new Date().toISOString();
  return r;
}

async function lgScratchSave(name) {
  const sc = lg.scratch;
  if (!sc) return null;
  if (lg.live && lg.live.league === LG_SCRATCH_ID) leagueAbort();
  const names = new Set(lg.list.map((L) => L.name));
  const r = lgPromote(sc.L, sc.matches, lgNewId(),
                      lgUniqueName((name || '').trim() || lgNextName('Tournament'), names));
  await lgSave(r.L);
  for (const m of r.matches) {
    try { await LgDB.put('matches', m); } catch (e) { log('leagues: could not save a match'); }
  }
  lg.list.push(r.L);
  lg.scratch = lgScratchNew(sc.L);
  await lgSelect(r.L);
  return r.L;
}

async function lgDelete(L) {
  if (lgIsScratch(L)) return;
  if (lg.live && lg.live.league === L.id) leagueAbort();
  try { await LgDB.del('leagues', L.id); await LgDB.delMatches(L.id); } catch (e) { /* nada */ }
  lg.list = lg.list.filter((x) => x !== L);
  await lgSelect(lg.list[lg.list.length - 1] || null);
}

// Temporada siguiente (pura): mismas reglas y formato; los participantes se
// copian salvo que se vayan a sortear.
function lgSeasonNext(S, draw) {
  return { no: S.no + 1, started: new Date().toISOString(),
           rules: { ...S.rules }, fmt: { ...S.fmt },
           entrants: draw ? [] : S.entrants.map((e) => ({ ...e })) };
}

// Temporada nueva. Con el sorteo de la liga en 'random' (o o.draw, el TV
// mode, que sortea siempre) los participantes salen de n del pool; en
// 'fight' empieza vacía y se sortea al jugar (lgLiveFill).
// Devuelve el resultado del sorteo ({added, failed}) o null.
async function lgNewSeason(L, o = {}) {
  if (lg.live && lg.live.league === L.id) leagueAbort();
  const d = lgDrawOf(L), fresh = !!o.draw || d.mode !== 'fixed';
  L.seasons.push(lgSeasonNext(lgSeason(L), fresh));
  lgLiveSync(L);
  const r = fresh && !lgSeason(L).live ? await lgDrawRandom(L, lgPool(d.pool), d.n) : (await lgSave(L), null);
  lgRender();
  return r;
}

// ---- Sorteo en cada pelea -----------------------------------------------------------
// Con el sorteo de la liga en 'fight' (y un formato que no sea copa) la
// temporada lleva S.live = {pool, n}, la foto del sorteo que se congela con
// su primer partido, y los participantes se inscriben (con el ADN congelado,
// como siempre) a medida que hacen falta: en el rey de la colina, los
// retadores de cada pelea (S.next = {at: partidos de la temporada, names}),
// con un tope de 3 × n peleas; en la escalera, cada aspirante cuando le toca
// entrar, hasta n; en todos contra todos y el partido único, n al lanzar el
// primer partido.
const lgLiveOn = (L) => lgDrawOf(L).mode === 'fight' && lgSeason(L).fmt.format !== 'cup';

// Pone S.live al día con el sorteo de la liga mientras la temporada abierta
// (la de lg.cur) no tiene partidos. true si cambió.
function lgLiveSync(L) {
  const S = lgSeason(L);
  if (lgSeasonMatches(S.no).length) return false;
  const d = lgDrawOf(L);
  // n no pasa del pool: el tope del rey de la colina (3 × n) sale de aquí.
  const live = lgLiveOn(L) ? { pool: d.pool, n: Math.min(d.n, Math.max(2, lgPool(d.pool).length)) } : undefined;
  if (JSON.stringify(live) === JSON.stringify(S.live)) return false;
  if (live) S.live = live; else delete S.live;
  delete S.next;
  delete S.dry;
  return true;
}

// Un bot del pool como participante: el que ya tiene su ADN o uno nuevo.
// null si su ADN no se puede leer.
async function lgEnrollOne(S, it) {
  let dna;
  try { dna = await invFetchDna(it.b); } catch (e) { return null; }
  const hash = lgHash(dna);
  const have = S.entrants.find((x) => x.hash === hash);
  if (have) return have;
  lgAddEntrant(S, { name: it.b.name, dna, src: 'bestiary', file: it.b.file });
  return S.entrants[S.entrants.length - 1];
}

// Inscribe lo que la próxima pelea de la temporada abierta de L (lg.cur)
// necesita del pool; nada si no sortea en cada pelea. Con el pool corto, la
// escalera termina con los que hay y los demás formatos juegan con menos.
async function lgLiveFill(L) {
  const S = lgSeason(L), live = S.live;
  if (!live) return;
  const ms = lgSeasonMatches(S.no);
  delete S.dry;                              // sin repetir: se vuelve a mirar el pool
  if (lgSeasonDone(S, ms)) return;
  const f = S.fmt.format;
  if (f === 'koth') {
    if (lgFixture(S, ms)) return;            // ya sorteada (p. ej. tras abandonarla)
    const { champ } = lgKothState(S, ms);
    const need = Math.min(Math.max(2, S.fmt.k), LG_MAX_FIGHTERS) - (champ ? 1 : 0);
    const fought = S.fmt.noRepeat ? lgFought(ms) : new Set();
    const names = [];
    for (const it of lgShuffle(lgPool(live.pool))) {
      if (names.length >= need) break;
      if (it.b.name === champ || fought.has(it.b.name)) continue;
      const e = await lgEnrollOne(S, it);
      if (e && e.name !== champ && !fought.has(e.name) && !names.includes(e.name)) names.push(e.name);
    }
    // Sin repetir y sin retadores nuevos suficientes: la temporada termina.
    if (S.fmt.noRepeat && names.length < (champ ? 1 : 2)) S.dry = ms.length;
    S.next = { at: ms.length, names };
    await lgSave(L);
  } else if (f === 'ladder') {
    const want = Math.min(live.n, Math.max(2, lgLadderState(S, ms).placed + 1));
    if (S.entrants.length < want) await lgDrawRandom(L, lgPool(live.pool), want - S.entrants.length);
    if (S.entrants.length < want) { live.n = S.entrants.length; await lgSave(L); }
  } else if (!ms.length && S.entrants.length < live.n) {
    await lgDrawRandom(L, lgPool(live.pool), live.n - S.entrants.length);
  }
}

// Vuelve a sortear los participantes de la temporada abierta (solo si aún no
// tiene partidos).
async function lgRedraw(L) {
  const S = lgSeason(L);
  if (lg.matches.some((m) => m.league === L.id && m.season === S.no)) return null;
  const d = lgDrawOf(L);
  S.entrants = [];
  const r = await lgDrawRandom(L, lgPool(d.pool), d.n);
  lgRender();
  return r;
}

// ---- Compartir (L3) ---------------------------------------------------------------
// El archivo lleva la liga entera (temporadas con reglas, formato y
// participantes con su ADN) y sus partidos sin id ni liga: al importar se
// reasignan. Funciones puras (el smoke hace el ida y vuelta sin DOM).
// Versión 2 (E11): la liga lleva su sorteo (draw) y los participantes su
// cantidad (qty); la 1 se importa con el sorteo 'fixed'.
const LG_FILE_KIND = 'darwinbots-league', LG_FILE_VER = 2;

function lgExportObj(L, matches) {
  const { id, ...league } = L;
  return {
    kind: LG_FILE_KIND, version: LG_FILE_VER, exported: new Date().toISOString(),
    league: JSON.parse(JSON.stringify(league)),
    matches: matches.filter((m) => m.league === id)
      .sort((a, b) => a.season - b.season || a.no - b.no)
      .map(({ id: _i, league: _l, ...m }) => ({ ...m })),
  };
}

// Valida el archivo y devuelve {L, matches} listos para guardar, con un id
// nuevo y el nombre sin repetir entre `names`. Lanza Error si no sirve.
function lgImportObj(o, names, newId) {
  if (!o || o.kind !== LG_FILE_KIND) throw new Error('Not a DarwinBots league file.');
  if (o.version > LG_FILE_VER) throw new Error(`League file version ${o.version} is newer than this page.`);
  const src = o.league || {};
  if (!Array.isArray(src.seasons) || !src.seasons.length) throw new Error('The league has no seasons.');
  const seasons = src.seasons.map((s, i) => {
    if (!s || typeof s.rules !== 'object' || !Array.isArray(s.entrants))
      throw new Error(`Season ${i + 1} is incomplete.`);
    const entrants = s.entrants.map((e) => {
      if (!e || typeof e.name !== 'string' || typeof e.dna !== 'string')
        throw new Error(`Season ${i + 1}: an entrant has no name or DNA.`);
      const x = { name: e.name, dna: e.dna, hash: lgHash(e.dna), src: e.src || 'form',
                  file: e.file || '', color: e.color || '#8899bb' };
      const q = parseInt(e.qty, 10);
      if (q > 0) x.qty = Math.min(200, q);
      return x;
    });
    const x = { no: +s.no || i + 1, started: s.started || '', rules: { ...s.rules },
                fmt: lgKothClean({ ...LG_FMT_DEFAULT, popCap: 0, ...(s.fmt || {}) }), entrants };
    // Sorteo en cada pelea: la foto del sorteo de la temporada.
    if (s.live && typeof s.live === 'object' && typeof s.live.pool === 'string')
      x.live = { pool: s.live.pool, n: Math.min(LG_DRAW_MAX, Math.max(0, parseInt(s.live.n, 10) || 0)) };
    if (x.live && Number.isInteger(s.dry)) x.dry = s.dry;   // rey de la colina sin repetir: el pool se secó
    // E12: el reparto de los grupos de la copa, si reparte a estos participantes.
    if (Array.isArray(s.groups)) {
      x.groups = s.groups.map((g) => (Array.isArray(g) ? g.map(String) : []));
      if (!lgCupGroupsOk(x)) delete x.groups;
    }
    return x;
  });
  let name = String(src.name || 'League').trim() || 'League';
  if (names.has(name)) name = lgUniqueName(name + ' (imported)', names);
  const L = { id: newId, name, notes: String(src.notes || ''),
              created: src.created || new Date().toISOString(),
              draw: o.version >= 2 ? lgDrawClean(src.draw) : lgDrawClean(null), seasons };
  lgMigrate(L);
  const nos = new Set(seasons.map((s) => s.no));
  const matches = (Array.isArray(o.matches) ? o.matches : [])
    .filter((m) => m && nos.has(m.season) && Array.isArray(m.fighters))
    .map(({ id: _i, ...m }) => ({ ...m, league: newId }));
  return { L, matches };
}

const lgNewId = () => 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const lgFileName = (L) => (L.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'league') + '.league.json';

function lgDownload(obj, fileName) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function lgExport(L) {
  lgDownload(lgExportObj(L, lg.matches), lgFileName(L));
  lgNote(`Exported to ${lgFileName(L)}.`);
}

// ---- Migración de lo que guardaban el Contest y el Canal (E11) -------------------
// El roster del Contest pasa a los participantes del Scratch (el ADN se lee
// ahora y queda congelado; los de 'form' no guardaban ADN y se pierden). La
// config del Canal se descarta. Su Hall of Fame no tiene partidos de los que
// derivarse: se ofrece descargarlo como JSON y se borra.
const LG_OLD_ROSTER_KEY = 'db-contest-roster';
const LG_OLD_HOF_KEY = 'db-channel-hof';
const LG_OLD_CHCFG_KEY = 'db-channel-cfg';

const lgStoreGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lgStoreDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } };

// dnaOf(r) → ADN del renglón del roster (contestDna de contest.js).
async function lgMigrateRoster(L, dnaOf) {
  const raw = lgStoreGet(LG_OLD_ROSTER_KEY);
  lgStoreDel(LG_OLD_CHCFG_KEY);
  if (raw === null) return null;
  let list = [];
  try { list = JSON.parse(raw) || []; } catch (e) { list = []; }
  const S = lgSeason(L);
  let added = 0, lost = 0;
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || !r.name) continue;
    try {
      const dna = await dnaOf(r);
      if (lgAddEntrant(S, { name: r.name, dna, src: r.src === 'hybrid' ? 'hybrid' : r.src === 'bestiary' ? 'bestiary' : 'form',
                            file: r.file, qty: r.qty, color: r.color })) added++;
    } catch (e) { lost++; }
  }
  lgStoreDel(LG_OLD_ROSTER_KEY);
  await lgSave(L);
  return { added, lost };
}

// El Hall of Fame del Canal viejo como archivo, o null si no hay.
function lgOldHofFile() {
  let hof = null;
  try { hof = JSON.parse(lgStoreGet(LG_OLD_HOF_KEY) || 'null'); } catch (e) { hof = null; }
  const rows = hof && typeof hof === 'object' ? Object.values(hof).filter((r) => r && r.name) : [];
  if (!rows.length) return null;
  return {
    kind: 'darwinbots-channel-hof', exported: new Date().toISOString(),
    note: 'Hall of Fame of the old F1 Channel (before Tournaments): fights, wins, undefeated retirements and best streak per bot.',
    rows: rows.sort((a, b) => (b.titles || 0) - (a.titles || 0) || (b.wins || 0) - (a.wins || 0)),
  };
}
const lgOldHofDiscard = () => lgStoreDel(LG_OLD_HOF_KEY);
function lgOldHofDownload() {
  const f = lgOldHofFile();
  if (f) lgDownload(f, 'channel_hall_of_fame.json');
  lgOldHofDiscard();
}

async function lgImport(file) {
  let r;
  try {
    r = lgImportObj(JSON.parse(await file.text()), new Set(lg.list.map((L) => L.name)), lgNewId());
  } catch (e) { lgNote(`Import failed: ${e.message}`, true); return; }
  await lgSave(r.L);
  for (const m of r.matches) {
    try { await LgDB.put('matches', m); } catch (e) { log('leagues: could not save a match'); }
  }
  lg.list.push(r.L);
  await lgSelect(r.L);
  lgNote(`Imported "${r.L.name}": ${r.L.seasons.length} seasons, ${r.matches.length} matches.`);
}

// ---- Participantes ---------------------------------------------------------------
function lgFreeColor(S) {
  const used = new Set(S.entrants.map((e) => e.color));
  return LG_COLORS.find((c) => !used.has(c)) || invColor();
}

// Agrega {name, dna, src, file, qty?, color?}. El mismo ADN no entra dos
// veces; un nombre repetido con otro ADN lleva sufijo (el censo agrupa por
// nombre). qty (E11) pisa los bots por especie del formato; el color pedido
// se respeta si nadie lo usa.
function lgAddEntrant(S, e) {
  const hash = lgHash(e.dna);
  if (S.entrants.some((x) => x.hash === hash)) return false;
  const name = lgUniqueName(e.name, new Set(S.entrants.map((x) => x.name)));
  const color = e.color && !S.entrants.some((x) => x.color === e.color) ? e.color : lgFreeColor(S);
  const x = { name, dna: e.dna, hash, src: e.src, file: e.file || '', color };
  const q = parseInt(e.qty, 10);
  if (q > 0) x.qty = Math.min(200, q);
  S.entrants.push(x);
  return true;
}

// Lo que recibe contestLaunch: el ADN congelado y la cantidad de cada uno.
const lgLaunchList = (f, fighters) => fighters.map((e) => ({
  name: e.name, src: 'form', dna: e.dna, qty: e.qty || f.qty, color: e.color }));

// Inscribe bots del Inventario (lee su ADN). Con `max`, para al llegar a
// esa cantidad de altas (el sorteo salta los ilegibles y los repetidos).
async function lgEnroll(L, items, max = Infinity) {
  const S = lgSeason(L);
  let added = 0, failed = 0;
  for (const it of items) {
    if (added >= max) break;
    try {
      const dna = await invFetchDna(it.b);
      if (lgAddEntrant(S, { name: it.b.name, dna, src: 'bestiary', file: it.b.file })) added++;
    } catch (e) { failed++; }
  }
  await lgSave(L);
  return { added, failed };
}

// Sorteo de n participantes de un pool (lo usan la ventana y el Canal con
// una liga vacía). Los que ya están en la temporada no cuentan.
async function lgDrawRandom(L, pool, n) {
  const have = new Set(lgSeason(L).entrants.map((e) => e.name));
  return lgEnroll(L, lgShuffle(pool.filter((it) => !have.has(it.b.name))), n);
}

// Pool del Inventario, como el del Canal (no vegetales, un nombre por especie).
function lgPool(filter) {
  let items = inv.items.filter((it) => !it.b.veg);
  if (filter === 'fav') items = items.filter((it) => userRec(it.key).fav);
  else if (filter === 'sel') items = items.filter((it) => inv.sel.has(it.key));
  else if (filter.startsWith('tag:')) {
    const t = filter.slice(4);
    items = items.filter((it) => userRec(it.key).tags.includes(t));
  } else if (filter.startsWith('set:')) {
    const set = inv.sets.get(filter.slice(4));
    const keys = new Set(set ? set.keys : []);
    items = items.filter((it) => keys.has(it.key));
  } else if (filter !== 'all') items = [];
  const seen = new Set();
  return items.filter((it) => !seen.has(it.b.name) && seen.add(it.b.name));
}

// ---- Partidos -------------------------------------------------------------------
async function lgPlayNext() {
  const L = lg.cur;
  if (!L || lg.live) return;
  const S = lgSeason(L);
  if (S.fmt.format === 'cup' && !lgCupSizeOk(S)) {
    lgNote(`A World cup needs 8, 16 or 32 entrants (this one has ${S.entrants.length}).`, true);
    return;
  }
  await lgCupEnsure(L);
  if (lgLiveSync(L)) await lgSave(L);
  if (S.live) lgNote('Drawing from the pool…');
  await lgLiveFill(L);
  const fx = lgNextFixture(L);
  if (!fx) {
    lgNote(lgSeasonDone(S, lgSeasonMatches(S.no)) ? 'The season is complete.'
      : S.live ? 'The draw pool has too few readable bots for the next fight.'
      : 'A tournament needs at least 2 entrants.', true);
    lgRender();
    return;
  }
  try { await lgPlay(L, fx); } catch (e) { lgNote(e.message, true); }
}

// Juega una pelea de la liga (la lanza la ventana o el Canal, L2): aplica
// las reglas de la temporada, abre lg.live y arranca con contestLaunch.
// Lanza excepción si algún ADN no se puede sembrar (sin partido abierto).
// L3: o.replay = partido del historial a repetir (su temporada y su semilla;
// no se registra, se compara).
async function lgPlay(L, fx, o = {}) {
  if (lg.live) throw new Error('A league match is already running.');
  const S = o.replay ? L.seasons.find((s) => s.no === o.replay.season) : lgSeason(L);
  lgApplyRules(S.rules);
  const f = S.fmt;
  lg.live = { league: L.id, season: S.no, fighters: fx.fighters, label: fx.label,
              ready: false, capRounds: 0, cycles: 0, f1: null, lastWins: null,
              replay: o.replay || null };
  if (o.replay) document.getElementById('seed').value = o.replay.seed;
  lgNote('Preparing…');
  try {
    await contestLaunch(lgLaunchList(f, fx.fighters),
      { nrg: f.nrg, f1: false, rounds: f.rounds, wins: f.wins, cap: f.cap,
        capMode: f.capMode, popCap: f.popCap || 0, newSeed: !o.replay });
  } catch (e) {
    lg.live = null;
    lgRender();
    throw e;
  }
  lg.live.seed = parseFloat(document.getElementById('seed').value) || 0;
  log(`🏟 ${L.name}: ${fx.fighters.map((e) => e.name).join(' vs ')}`);
  lgNote(fx.label);
  lgRender();
}

// Repite un partido del historial: las reglas y el formato de SU temporada,
// los mismos participantes (el ADN congelado) en el mismo orden de siembra y
// la misma semilla. El core es determinista: debe salir lo mismo.
async function lgReplay(id) {
  const L = lg.cur, m = L && lg.matches.find((x) => x.id === id);
  if (!m || lg.live) return;
  const S = L.seasons.find((s) => s.no === m.season);
  const fighters = m.fighters.map((n) => S && S.entrants.find((e) => e.name === n));
  if (!S || fighters.some((e) => !e)) {
    lgNote(`Match #${m.no} cannot be replayed: an entrant is no longer in season ${m.season}.`, true);
    return;
  }
  if (typeof tvStop === 'function') tvStop();   // la repetición toma la sim
  try {
    await lgPlay(L, { fighters, label: `Replay of match #${m.no} (season ${m.season}, seed ${m.seed})` },
                 { replay: m });
  } catch (e) { lgNote(e.message, true); }
}

// Compara la repetición con lo registrado (ganador, victorias y ciclos). Los
// partidos de antes de que f1-over trajera el marcador (0 ciclos) solo
// guardan el ganador.
function lgReplayCheck(m, got) {
  const diffs = [], full = !!m.cycles;
  if (got.winner !== (m.winner || '')) diffs.push(`winner ${got.winner || '—'} (was ${m.winner || '—'})`);
  if (full && (m.wins || []).join() !== got.wins.join()) diffs.push(`wins ${got.wins.join('-')} (was ${(m.wins || []).join('-')})`);
  if (full && m.cycles !== got.cycles) diffs.push(`${got.cycles} cycles (was ${m.cycles})`);
  lg.checked.set(m.id, diffs.length ? 'diff' : 'same');
  if (diffs.length) {
    log(`🏟 replay of #${m.no} differs: ${diffs.join(' · ')}`);
    lgNote(`⚠ Replay of match #${m.no} differs: ${diffs.join(' · ')}.`, true);
  } else {
    log(`🏟 replay of #${m.no} matches the record`);
    lgNote(`✓ Replay of match #${m.no} matches: ${got.winner || 'void'}, ${got.wins.join('-')}, ${got.cycles} cycles` +
           (full ? '.' : ' (only the winner was recorded).'));
  }
  lgRender();
}

// Abandona el partido en curso sin registrarlo (otro torneo toma la sim).
function leagueAbort() {
  if (!lg.live) return;
  const replay = lg.live.replay;
  lg.live = null;
  lgNote(replay ? `Replay of match #${replay.no} abandoned.` : 'Match abandoned: not recorded.', true);
  lgRender();
}

async function lgRecord(winner, note) {
  const m = lg.live;
  if (!m) return;
  lg.live = null;
  const L = lgFind(m.league);
  const sp = (m.f1 && m.f1.sp) || [];
  const wins = m.fighters.map((e) => (sp.find((s) => s.name === e.name) || {}).wins || 0);
  if (m.replay) { lgReplayCheck(m.replay, { winner: winner || '', wins, cycles: m.cycles || 0 }); return; }
  // Los partidos del Scratch quedan en memoria (con id negativo); los demás,
  // en la base y, si es la liga abierta, en lg.matches.
  const scratch = m.league === LG_SCRATCH_ID;
  const bucket = scratch ? lg.scratch && lg.scratch.matches
    : lg.cur && lg.cur.id === m.league ? lg.matches : null;
  const no = Math.max(0, ...(bucket || []).filter((x) => x.league === m.league && x.season === m.season)
    .map((x) => x.no)) + 1;
  const rec = {
    league: m.league, season: m.season, no, date: new Date().toISOString(),
    format: L ? lgSeason(L).fmt.format : '', fighters: m.fighters.map((e) => e.name),
    seed: m.seed, winner: winner || '', wins, rounds: wins.reduce((a, b) => a + b, 0),
    cycles: m.cycles || 0, capRounds: m.capRounds, note: note || '',
  };
  if (scratch) rec.id = -(++lg.scratch.seq);
  else try { rec.id = await LgDB.put('matches', rec); } catch (e) { log('leagues: could not save the match'); }
  if (bucket) bucket.push(rec);
  log(winner ? `🏟 ${winner} wins (${rec.rounds} rounds, ${rec.cycles} cycles)` : `🏟 match void: ${note}`);
  lgNote(winner ? `🏆 ${winner} wins the match.` : note, !winner);
  lgRender();
  if (typeof tnOnResult === 'function') tnOnResult(rec);
}

// Hasta la respuesta al censo del partido (f1-started) llegan mensajes y
// frames de la sim anterior: se ignoran. El worker atiende en orden, así que
// lo que viene después es del partido nuevo.
function leagueOnMessage(msg) {
  const m = lg.live;
  if (!m) return;
  if (msg.t === 'f1-started') {
    if (!m.ready && !msg.n) lgRecord('', 'void: the census found no fighters');
    m.ready = true;
    return;
  }
  if (!m.ready) return;
  if (msg.t === 'f1-note' && msg.kind === 'single') lgRecord('', 'void: only one species in the census');
  else if (msg.t === 'f1-note' && msg.kind === 'cap') {
    m.capRounds++;
    const L = lgFind(m.league), f = L ? lgSeason(L).fmt : LG_FMT_DEFAULT;
    lgNote('Cycle cap reached: the round goes to the ' +
           (f.capMode === 'nrg' ? 'species with the most energy.' : 'most numerous species.'));
  }
  else if (msg.t === 'f1-over') {
    // El worker manda el marcador final y los ciclos con el aviso.
    if (msg.f1) m.f1 = msg.f1;
    if (msg.cycles !== undefined) m.cycles = msg.cycles;
    lgRecord(msg.winner);
  }
}

// ---- Render ---------------------------------------------------------------------
// La regla del rey de la colina, en una línea (bajo sus campos en Setup).
function lgKothHint(f) {
  const once = f.noRepeat
    ? ' No repeats: a bot that has fought never challenges again (the champion defends while it wins), ' +
      'and the season also ends when no fresh challenger is left.' : '';
  if (f.kothEnd !== 'never')
    return `The first to win ${f.retire} in a row retires undefeated and takes the season; ` +
           `if nobody does, it ends after ${LG_KOTH_CAP} × entrants fights and the Elo decides.` + once;
  return (f.retire > 0
    ? `The season never ends: ${f.retire} wins in a row earn a 👑 and a fresh hill; the most 👑 lead the table.`
    : 'The season never ends: the champion stays until beaten. Start a new season to reset it.') + once;
}

function lgFmtHtml(f, locked) {
  const d = locked ? ' disabled' : '';
  const num = (id, label, v, min, max, title) =>
    `<label${title ? ` title="${title}"` : ''}>${label}</label>` +
    `<input type="number" data-f="${id}" min="${min}"${max ? ` max="${max}"` : ''} value="${v}"${d}>`;
  return '<div class="ct-rules">' +
    `<label>Format</label><select data-f="format"${d}>` +
    `<option value="single"${f.format === 'single' ? ' selected' : ''} title="One match with every entrant (up to ${LG_MAX_FIGHTERS})">Single match</option>` +
    `<option value="koth"${f.format === 'koth' ? ' selected' : ''} title="The winner stays; the first to retire undefeated wins the season">King of the hill</option>` +
    `<option value="rr"${f.format === 'rr' ? ' selected' : ''}>Round robin</option>` +
    `<option value="ladder"${f.format === 'ladder' ? ' selected' : ''} title="The original's step ladder: each newcomer challenges from the top rung down and takes the first rung it wins">Step ladder</option>` +
    `<option value="cup"${f.format === 'cup' ? ' selected' : ''} title="8, 16 or 32 entrants in groups of 4 (round robin); the top 2 of each group go to a knockout bracket">World cup (groups + knockout)</option></select>` +
    (f.format === 'ladder' || f.format === 'single' ? ''
    : f.format === 'cup'
      ? num('groupLegs', 'Group stage legs', f.groupLegs, 1, 2, '1 = each pair of a group meets once; 2 = twice, with the seeding order swapped') +
        `<label title="How the groups are seeded: pots by the Hall of Fame Elo (1500 without history), or a pure random draw">Pots</label><select data-f="pots"${d}>` +
        `<option value="elo"${f.pots !== 'random' ? ' selected' : ''}>by Elo</option>` +
        `<option value="random"${f.pots === 'random' ? ' selected' : ''}>random</option></select>` +
        `<label title="The semi-final losers play for third place before the final">Third-place match</label>` +
        `<input type="checkbox" data-f="third"${f.third ? ' checked' : ''}${d}>`
    : f.format === 'rr'
      ? num('legs', 'Legs (each pair meets)', f.legs, 1, 2, '1 = once; 2 = home and away, with the seeding order swapped')
      : num('k', 'Fighters per fight', f.k, 2, 20) +
        `<label title="When the season is over">Season ends</label><select data-f="kothEnd"${d}>` +
        `<option value="retire"${f.kothEnd !== 'never' ? ' selected' : ''}>at the first undefeated retirement</option>` +
        `<option value="never"${f.kothEnd === 'never' ? ' selected' : ''}>never (endless hill)</option></select>` +
        (f.kothEnd === 'never'
          ? num('retire', 'Champion retires after (0 = never)', f.retire, 0, 999,
                'Consecutive wins that earn a 👑 and send the champion off the hill; 0 = it stays until beaten')
          : num('retire', 'Champion retires after', f.retire, 1, 999, 'Consecutive wins the champion needs to retire undefeated')) +
        `<label title="A bot that has fought this season (and lost, or retired) never challenges again; the champion keeps defending while it wins">No repeated challengers</label>` +
        `<input type="checkbox" data-f="noRepeat"${f.noRepeat ? ' checked' : ''}${d}>` +
        `<div class="ct-wide ct-rule">${escHtml(lgKothHint(f))}</div>`) +
    num('qty', 'Bots per species', f.qty, 1, 200, 'Each entrant can set its own in the list below') +
    num('nrg', 'Starting energy', f.nrg, 1, 0) +
    num('rounds', 'Minimum rounds per match', f.rounds, 1, 99) +
    num('wins', 'Wins to take the match', f.wins, 0, 99, "The original's Maxrounds; 0 = only the statistical rule") +
    num('cap', 'Cycle cap per round (0 = off)', f.cap, 0, 0) +
    `<label title="Who takes a round that reaches the cycle cap">At the cap, the round goes to</label>` +
    `<select data-f="capMode"${d}>` +
    `<option value="pop"${f.capMode === 'pop' ? ' selected' : ''}>most bots</option>` +
    `<option value="nrg"${f.capMode === 'nrg' ? ' selected' : ''}>most energy</option></select>` +
    num('popCap', 'Max bots per species (0 = off)', f.popCap || 0, 0, 0,
        'A species above this loses its poorest bots (lowest nrg + body×10). Keeps prolific bots from slowing the match down') +
    `<div class="ct-wide ct-rule">${escHtml(contestRuleHint(f.rounds, f.wins))}</div>` +
    '</div>';
}

function lgChampionHtml(S, ms) {
  const c = lgSeasonChampion(S, ms);
  return c ? `🏁 Season complete: 🏆 <b>${escHtml(c.name)}</b> ${LG_HOW[c.how]}.` : '🏁 Season complete.';
}

function lgStandingsHtml(S, ms) {
  const rows = lgStandings(S, ms);
  const koth = S.fmt.format === 'koth' ? lgKothState(S, ms) : null;
  if (!rows.length) return '<div class="ct-empty">No entrants yet.</div>';
  const champ = lgSeasonChampion(S, ms);
  return '<table class="ch-table"><tr><th></th><th>Entrant</th><th title="Played">P</th>' +
    '<th title="Won">W</th><th title="Lost">L</th><th title="Win rate">%</th><th>Elo</th>' +
    (koth ? '<th title="Undefeated retirements">👑</th>' : '') +
    '<th title="Share of the rounds it won that were decided by the cycle cap">cap</th>' +
    '<th title="Average cycles per match played">⏱</th></tr>' +
    rows.map((r, i) => `<tr><td>${i + 1}</td><td class="ch-n" title="${escHtml(r.name)}">` +
      `<span class="ct-dot lg-dot" style="background:${r.color}"></span>${champ && champ.name === r.name ? '🏆 ' : ''}${escHtml(r.name)}</td>` +
      `<td>${r.p}</td><td>${r.w}</td><td>${r.p - r.w}</td>` +
      `<td>${r.p ? Math.round((r.w / r.p) * 100) : '–'}</td><td>${Math.round(r.elo)}</td>` +
      (koth ? `<td>${koth.titles.get(r.name) || ''}</td>` : '') +
      `<td>${r.rounds ? Math.round((r.capR / r.rounds) * 100) + '%' : ''}</td>` +
      `<td>${r.p ? Math.round(r.cyc / r.p) : ''}</td></tr>`).join('') +
    '</table>';
}

// Enfrentamientos directos: h[a][b] = veces que a le ganó a b (en una pelea
// de N, el ganador le gana a cada uno de los demás, como en el Elo).
function lgH2H(ms) {
  const h = new Map();
  for (const m of lgPlayed(ms)) {
    const r = h.get(m.winner) || h.set(m.winner, new Map()).get(m.winner);
    for (const n of m.fighters) if (n !== m.winner) r.set(n, (r.get(n) || 0) + 1);
  }
  return (a, b) => (h.get(a) && h.get(a).get(b)) || 0;
}

const LG_H2H_MAX = 14;
function lgH2HHtml(S, ms) {
  const rows = lgStandings(S, ms);
  if (rows.length < 2) return '<div class="ct-empty">No entrants yet.</div>';
  if (rows.length > LG_H2H_MAX)
    return `<div class="ct-empty">Only for leagues of up to ${LG_H2H_MAX} entrants.</div>`;
  const w = lgH2H(ms);
  return '<table class="ch-table lg-h2h"><tr><th></th><th>Row beat column</th>' +
    rows.map((_, j) => `<th>${j + 1}</th>`).join('') + '</tr>' +
    rows.map((a, i) => `<tr><td>${i + 1}</td><td class="ch-n" title="${escHtml(a.name)}">` +
      `<span class="ct-dot lg-dot" style="background:${a.color}"></span>${escHtml(a.name)}</td>` +
      rows.map((b) => {
        if (a === b) return '<td class="lg-x">·</td>';
        const x = w(a.name, b.name), y = w(b.name, a.name);
        if (!x && !y) return '<td class="lg-x"></td>';
        return `<td class="${x > y ? 'lg-up' : x < y ? 'lg-dn' : ''}" title="${escHtml(a.name)} ${x}–${y} ${escHtml(b.name)}">${x}–${y}</td>`;
      }).join('') + '</tr>').join('') +
    '</table>';
}

// Cada partido con su botón de repetir (L3) y la marca de la última
// repetición de esta sesión (✓ igual, ≠ distinto).
function lgHistoryHtml(ms) {
  if (!ms.length) return '<div class="ct-empty">No matches yet.</div>';
  const busy = lg.live ? ' disabled' : '';
  const mark = { same: '<b class="lg-up" title="The last replay matched">✓</b> ',
                 diff: '<b class="lg-dn" title="The last replay differed">≠</b> ' };
  return ms.slice().reverse().slice(0, 60).map((m) =>
    `<div class="ch-res">` +
    (m.id !== undefined ? `<button class="ch-small lg-replay" data-replay="${m.id}"${busy}` +
      ` title="Replay with the same rules, entrants, order and seed">↻</button> ` : '') +
    (mark[lg.checked.get(m.id)] || '') + `<span>#${m.no}</span> ` +
    m.fighters.map((n, i) => escHtml(n) + (m.wins && m.wins[i] ? ` <span>${m.wins[i]}</span>` : '')).join(' vs ') +
    ' → ' + (m.winner ? `<b>${escHtml(m.winner)}</b>` : '—') +
    ` <i>${m.cycles || 0} cyc` + (m.capRounds ? ` · ${m.capRounds} by cap` : '') +
    ` · seed ${m.seed}${m.note ? ' · ' + escHtml(m.note) : ''}</i></div>`).join('');
}

// Filtros del Inventario para lgPool. head: primera opción vacía (o nada).
function lgPoolOptions(head) {
  return (head ? `<option value="">${head}</option>` : '<option value="all">the whole Bestiary</option>') +
    '<option value="sel">the Inventory selection</option>' +
    '<option value="fav">★ favorites</option>' +
    allTags().map(([t, n]) => `<option value="tag:${escHtml(t)}">#${escHtml(t)} (${n})</option>`).join('') +
    [...inv.sets.keys()].map((n) => `<option value="set:${escHtml(n)}">selection: ${escHtml(n)}</option>`).join('') +
    (head ? '<option value="all">the whole Bestiary</option>' : '');
}

// E11: la ventana es la de Torneos (tournament.js). Estos dos avisan allá
// (y no hacen nada sin ella: el smoke corre league.js solo).
function lgRender() { if (typeof tnRender === 'function') tnRender(); }
function lgNote(text, warn) { if (typeof tnNote === 'function') tnNote(text, warn); }
