// @ts-check
// Torneos: modelo, formatos, calendarios, tablas, Elo, Hall of Fame,
// sorteos, migraciones y exportar/importar. Funciones puras, sin DOM ni
// estado: el estado (torneo abierto, partidos, partido en curso) y la
// persistencia están en engine/torneos.js; el lanzamiento de cada partido,
// en engine/partido.js.
//
// Procedencia (paso E1.2 de port/web2/PLAN.md, decisiones 1 y 21): el código
// es el de port/web/league.js (congelado), copiado y convertido a módulo, con
// los mismos nombres. Cambios, todos sin efecto en los resultados:
//   - Sin globales: el generador de los sorteos entra como parámetro (`rnd`,
//     por defecto Math.random) donde la clásica usaba el Math.random global
//     (lgFixture en el rey de la colina) y el color de reserva de
//     lgAddEntrant/lgFreeColor (invColor en la clásica) también.
//   - Sin texto de interfaz: los rótulos de lgFixture, lgCupState,
//     lgSwissState y lgCupRound son {clave, params} (ver ROTULOS abajo) y
//     los errores de lgImportObj son ErrorLiga con clave y params; el texto
//     lo pone la interfaz con t(). LG_HOW (texto) queda en la interfaz: aquí
//     solo están sus claves (LG_HOWS).
//   - Del resto de web/: tnProgress, tnDrawHint y tnRrWarn (tournament.js)
//     como lgProgress, lgDrawHint y lgRrWarn (datos, sin texto); la edición
//     de un valor del formato (el onchange de #tn-fmt) como lgFmtSet; lgPool
//     recibe el Inventario como parámetro; lgOldHofFile recibe el texto
//     guardado (la clásica lo leía de localStorage).
//
// Origen de cada parte en web/league.js:
//   constantes (LG_*) .............................. líneas 84-127, 394-395, 681, 1145, 1640
//   lgSeason, lgPlayed, lgIsScratch, lgDrawOf/Clean  129-142
//   lgHash .......................................... 145-149
//   lgRrFixtures, lgPairKey, lgRrState .............. 243-277
//   rey de la colina (lgKoth*) ...................... 283-322
//   lgSeasonDone, lgSeasonChampion .................. 329-360
//   lgLadderState ................................... 370-384
//   copa (lgCup*) ................................... 394-570
//   lgShuffle ....................................... 572-579
//   suizo (lgSwiss*) ................................ 594-752
//   lgFixture ....................................... 759-802
//   lgElo, lgStandings, lgAllTime ................... 807-891
//   lgMigrate ....................................... 896-909
//   lgNewLeague, lgUniqueName, lgNextName ........... 943-966
//   lgScratchNew, lgPromote ......................... 981-1005
//   lgSeasonNext .................................... 1034-1038
//   lgExportObj, lgImportObj, lgNewId, lgFileName ... 1145-1206
//   lgOldHofFile .................................... 1259-1269
//   lgFreeColor, lgAddEntrant, lgLaunchList ......... 1292-1315
//   lgPool .......................................... 1341-1355
//   lgH2H ........................................... 1631-1638
//
// ROTULOS ({clave, params}; el texto de la clásica entre comillas):
//   single    {n, total}          "Single match: {n} entrants" + si total > n " (the first {n} of {total})"
//   rr        {no, total}         "Fixture {no} of {total}"
//   ladder    {challenger, rung, entrant, total}
//                                 "Ladder: {challenger} challenges rung {rung} (entrant {entrant} of {total})"
//   cup-group {group, day, days}  "Group {group} · matchday {day} of {days}"
//   cup-ko    {ties, match}       ties 1: "FINAL"; 2: "Semi-final"; 4: "Quarter-final"; si no
//                                 "Round of {2·ties}"; con match > 0 se agrega " · match {match} of {ties}"
//   cup-third {}                  "Third place"
//   swiss     {round, rounds, match, matches, bye}
//                                 "Swiss round {round} of {rounds} · match {match} of {matches}" + con bye " · bye: {bye}"
//   koth      {champ, fight, cap} champ ? "👑 {champ} defends the crown" : "Open fight: no champion",
//                                 + " · fight {fight}" + si cap !== null " of at most {cap}"
//   replay    {no, season, seed}  "Replay of match #{no} (season {season}, seed {seed})"
// La traducción ejecutable de este mapeo al inglés de la clásica está en
// test/smokes/rotulos_en.mjs (la usan los smokes y el test de paridad).
//
// ERRORES de lgImportObj (ErrorLiga.clave, params; texto de la clásica):
//   not-league       {}           "Not a DarwinBots league file."
//   newer-version    {version}    "League file version {version} is newer than this page."
//   no-seasons       {}           "The league has no seasons."
//   season-incomplete {season}    "Season {season} is incomplete."
//   entrant-no-dna   {season}     "Season {season}: an entrant has no name or DNA."
//
// OTROS ERRORES de engine/ (ErrorLiga.clave, params), para la misma tabla de t():
//   no-dna           {name}       partido.js planPartido: un luchador sin ADN
//                                 (clásica: "{name}: no DNA")
//   no-options       {}           partido.js mensajesPartido sin las opciones del reset
//   no-base-options  {}           partido.js reglasAOpciones sin las opciones base
//   bad-base         {}           partido.js mensajesPartido: la siembra base no es una lista
//   deps-missing     {dep}        torneos.js crearTorneos sin una dependencia obligatoria
//                                 (almacen, reglasBase, inventario, inventario.color)
//   no-launcher      {}           torneos.js: se jugó un partido sin `lanzar`
//   match-running    {}           torneos.js lgPlay con un partido en curso
//                                 (clásica: "A league match is already running.")
//
// Nombres que se guardan en los datos (LG_NOMBRES): por defecto los de la
// clásica, para que los archivos sigan siendo compatibles (v1/v2): 'League'
// (nombre sin nombre), 'Scratch', el sufijo ' (imported)' y el prefijo
// 'Tournament' ("Tournament N"). Las funciones que los usan aceptan otros
// (lgNewLeague, lgScratchNew, lgPromote, lgImportObj y crearTorneos(deps.nombres)).
// La nota del Hall of Fame viejo queda fija: es contenido del archivo.

/**
 * @typedef {{name: string, dna: string, hash: string, src: string, file: string, color: string, qty?: number}} Entrant
 * @typedef {Record<string, any>} Fmt
 * @typedef {{no: number, started?: string, rules: Record<string, any>, fmt: Fmt, entrants: Entrant[],
 *   live?: {pool: string, n: number}, next?: {at: number, names: string[]}, dry?: number,
 *   groups?: string[][], order?: string[]}} Season
 * @typedef {{id: string, name: string, notes?: string, created: string, draw?: any, seasons: Season[]}} League
 * @typedef {{id?: number, league?: string, season: number, no: number, fighters: string[], winner: string,
 *   seed?: number, wins?: number[], capWins?: number[], rounds?: number, cycles?: number,
 *   capRounds?: number, note?: string, date?: string, format?: string}} Match
 * @typedef {{clave: string, params: Record<string, any>}} Rotulo
 * @typedef {() => number} Rnd
 */

/** Error con clave para t() (la interfaz arma el texto). */
export class ErrorLiga extends Error {
  /** @param {string} clave @param {Record<string, any>} [params] */
  constructor(clave, params = {}) {
    super(clave);
    this.name = 'ErrorLiga';
    this.clave = clave;
    this.params = params;
  }
}

/**
 * Nombres guardados en los datos (ver la cabecera); los de la clásica.
 * @typedef {{league: string, scratch: string, imported: string, tournament: string}} Nombres
 */
export const LG_NOMBRES = Object.freeze({
  league: 'League',
  scratch: 'Scratch',
  imported: ' (imported)',
  tournament: 'Tournament',
});

/** @param {string} clave @param {Record<string, any>} [params] @returns {Rotulo} */
const rotulo = (clave, params = {}) => ({ clave, params });

// ---- Constantes -------------------------------------------------------------------
export const LG_FMT_DEFAULT = {
  // 'single' (un partido con todos) | 'koth' (rey de la colina) |
  // 'rr' (todos contra todos) | 'ladder' (escalera) | 'cup' (copa, E12) |
  // 'swiss' (suizo)
  format: 'koth',
  k: 2, // koth: luchadores por pelea
  retire: 5, // koth: victorias seguidas para retirarse invicto (0 = nunca, solo sin fin)
  kothEnd: 'retire', // koth: la temporada termina con el primer retiro ('retire') o nunca ('never')
  noRepeat: false, // koth: quien ya peleó no vuelve a retar (el campeón defiende mientras gane)
  legs: 1, // rr: vueltas
  qty: 5, // bots por especie (entrant.qty lo pisa)
  nrg: 3000,
  rounds: 5,
  wins: 3,
  cap: 5000, // tope de ciclos por ronda (0 = sin tope)
  capMode: 'pop', // al llegar al tope: 'pop' (más bots) | 'nrg' (más nrg + body×10)
  popCap: 500, // tope de bots por especie: poda a los más pobres (0 = sin tope)
  groupLegs: 1, // cup (E12): vueltas de la fase de grupos
  pots: 'elo', // cup: bombos por el Elo del Hall of Fame ('elo') o sorteo puro ('random')
  third: false, // cup: partido por el 3.er puesto
  swissRounds: 0, // swiss: rondas (0 = ⌈log2 N⌉ + 1)
};
export const LG_FORMATS = ['single', 'koth', 'rr', 'ladder', 'cup', 'swiss'];
// Participantes de cada temporada: lista fija (a mano, se copia a la
// temporada nueva), sorteo de n del pool en cada temporada nueva ('random')
// o sorteo en cada pelea ('fight', salvo la copa, que entonces sortea en
// cada temporada: ver lgLiveFill). El pool es un filtro de lgPool ('all',
// 'fav', 'sel', 'tag:…', 'set:…').
export const LG_DRAW_DEFAULT = { mode: 'fixed', pool: 'all', n: 8 };
// Sin tope real: el sorteo toma a lo sumo lo que tiene el pool. Este número
// solo acota lo que llega de un archivo o de un campo mal escrito.
export const LG_DRAW_MAX = 10000;
// Todos contra todos: a partir de aquí la ventana avisa del largo del calendario.
export const LG_RR_WARN = 1000;
export const LG_ELO0 = 1500;
export const LG_K = 32;
export const LG_MAX_FIGHTERS = 20; // PopArray(1 To 20), F1Mode.bas:59
export const LG_KOTH_CAP = 3; // rey de la colina: tope de 3 × N peleas por temporada
export const LG_SCRATCH_ID = 'scratch';
// Colores de los participantes, claros para el campo oscuro y ordenados para
// que los primeros sean los más distintos entre sí. Hasta 20 (el máximo de
// especies por partido).
export const LG_COLORS = [
  '#ff4040',
  '#3d9bff',
  '#ffd83a',
  '#ff5ce1',
  '#3fe8e0',
  '#ff9020',
  '#a46bff',
  '#8ce83c',
  '#ffffff',
  '#ff9eb0',
  '#1fbf7a',
  '#c79a62',
  '#b8c8ff',
  '#f0ff80',
  '#8a8aff',
  '#ffc6f0',
  '#e05a2a',
  '#7fd8ff',
  '#b0b0b0',
  '#c0ffc8',
];
// Cómo se ganó una temporada (lgSeasonChampion().how). El texto (LG_HOW de
// la clásica) lo pone la interfaz.
export const LG_HOWS = ['match', 'retired', 'elo', 'dry', 'table', 'ladder', 'cup', 'swiss'];
// Color de reserva (el de la clásica para filas sin participante).
export const LG_NO_COLOR = '#8899bb';

/** @param {League} L @returns {Season} */
export const lgSeason = (L) => L.seasons[L.seasons.length - 1];
/** @param {Match[]} ms */
export const lgPlayed = (ms) => ms.filter((m) => m.winner);
/** @param {League | null | undefined} L */
export const lgIsScratch = (L) => !!L && L.id === LG_SCRATCH_ID;
/** @param {League | null | undefined} L */
export const lgDrawOf = (L) => lgDrawClean(L?.draw);
/** @param {any} d @returns {{mode: string, pool: string, n: number}} */
export function lgDrawClean(d) {
  const o = { ...LG_DRAW_DEFAULT, ...(d && typeof d === 'object' ? d : {}) };
  return {
    mode: o.mode === 'random' || o.mode === 'fight' ? o.mode : 'fixed',
    pool: typeof o.pool === 'string' && o.pool ? o.pool : LG_DRAW_DEFAULT.pool,
    n: Math.min(LG_DRAW_MAX, Math.max(2, parseInt(o.n, 10) || LG_DRAW_DEFAULT.n)),
  };
}

// FNV-1a de 32 bits: identifica el ADN congelado de cada participante.
/** @param {string} s */
export function lgHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---- Calendario ------------------------------------------------------------------
// Todos contra todos por el método del círculo: cada jornada, cada uno juega
// a lo sumo una vez (con número impar, uno descansa). La segunda vuelta
// invierte el orden de siembra.
/** @param {number} n @param {number} legs @returns {{leg: number, pair: number[]}[]} */
export function lgRrFixtures(n, legs) {
  const a = [...Array(n).keys()];
  if (n % 2) a.push(-1);
  const m = a.length;
  const pairs = [];
  for (let r = 0; r < m - 1; r++) {
    for (let i = 0; i < m / 2; i++) {
      const x = a[i];
      const y = a[m - 1 - i];
      if (x >= 0 && y >= 0) pairs.push(r % 2 ? [y, x] : [x, y]);
    }
    a.splice(1, 0, /** @type {number} */ (a.pop()));
  }
  const out = [];
  for (let leg = 1; leg <= legs; leg++)
    for (const [x, y] of pairs) out.push({ leg, pair: leg % 2 ? [x, y] : [y, x] });
  return out;
}
/** @param {string} a @param {string} b */
export const lgPairKey = (a, b) => (a < b ? `${a}\u0001${b}` : `${b}\u0001${a}`);

/** @param {Season} S @param {Match[]} ms */
export function lgRrState(S, ms) {
  const E = S.entrants;
  const fx = lgRrFixtures(E.length, S.fmt.legs);
  const cnt = new Map();
  for (const m of lgPlayed(ms)) {
    if (m.fighters.length !== 2) continue;
    const k = lgPairKey(m.fighters[0], m.fighters[1]);
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  let played = 0;
  /** @type {Entrant[] | null} */
  let next = null;
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
/** @param {Season} S @param {Match[]} ms */
export function lgKothState(S, ms) {
  /** @type {string | null} */
  let champ = null;
  let streak = 0;
  /** @type {string | null} */
  let first = null;
  let played = 0;
  /** @type {Map<string, number>} */
  const titles = new Map();
  for (const m of lgPlayed(ms)) {
    played++;
    if (champ === m.winner) streak++;
    else {
      champ = m.winner;
      streak = 1;
    }
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
/** @param {Match[]} ms */
export const lgFought = (ms) => new Set(lgPlayed(ms).flatMap((m) => m.fighters));
// Rey de la colina sin repetir: ¿quedan retadores que no pelearon? Con
// sorteo en cada pelea lo decide lgLiveFill al sortear (S.dry = partidos de
// la temporada cuando el pool se secó); con la lista fija, la lista.
/** @param {Season} S @param {Match[]} ms */
export function lgKothDry(S, ms) {
  if (!S.fmt.noRepeat) return false;
  if (S.live) return S.dry === ms.length;
  const { champ } = lgKothState(S, ms);
  const fought = lgFought(ms);
  const fresh = S.entrants.filter((e) => e.name !== champ && !fought.has(e.name)).length;
  return fresh < (champ ? 1 : 2);
}
// Con sorteo en cada pelea, N es el n del sorteo (los inscriptos no paran de crecer).
/** @param {Season} S */
export const lgKothCap = (S) => LG_KOTH_CAP * (S.live ? S.live.n : S.entrants.length);
// Colina sin fin: la temporada no termina nunca (ni retiro ni tope).
/** @param {Fmt} f */
export const lgKothEndless = (f) => f.format === 'koth' && f.kothEnd === 'never';
// Retiro 0 (nunca) solo tiene sentido en la colina sin fin.
/** @param {Fmt} f */
export function lgKothClean(f) {
  if (f.kothEnd !== 'never') f.kothEnd = 'retire';
  if (f.kothEnd !== 'never' && !(f.retire >= 1)) f.retire = 1;
  f.noRepeat = f.noRepeat === true;
  return f;
}

// ¿Terminó la temporada? Con menos de 2 participantes no se juega ni termina.
// single: con su partido; rr y escalera: con el calendario completo; rey de
// la colina: con el primer retiro invicto o al tope de 3 × N peleas (sin fin:
// nunca) y, sin repetir, también sin retadores nuevos; copa: con la final
// jugada; suizo: con la última ronda.
/** @param {Season} S @param {Match[]} ms @returns {boolean} */
export function lgSeasonDone(S, ms) {
  if (S.entrants.length < 2) return false;
  const f = S.fmt.format;
  if (f === 'single') return lgPlayed(ms).length > 0;
  if (f === 'rr') return !lgRrState(S, ms).next;
  if (f === 'ladder')
    return !lgLadderState(S, ms).next && !(S.live && S.entrants.length < S.live.n);
  if (f === 'cup') return lgCupState(S, ms).phase === 'done';
  if (f === 'swiss') return lgSwissState(S, ms).phase === 'done';
  if (lgKothDry(S, ms)) return true;
  if (lgKothEndless(S.fmt)) return false;
  const k = lgKothState(S, ms);
  return !!k.first || k.played >= lgKothCap(S);
}

// Campeón de una temporada terminada: {name, how} o null si sigue en juego.
// how: 'match' (single), 'retired' (rey de la colina), 'elo' (rey de la
// colina al tope: el primero por Elo), 'table' (rr: el primero de la tabla),
// 'ladder' (escalera: el peldaño 1), 'cup' (copa: el ganador de la final),
// 'swiss' (suizo: el primero de la tabla).
/** @param {Season} S @param {Match[]} ms @returns {{name: string, how: string} | null} */
export function lgSeasonChampion(S, ms) {
  if (!lgSeasonDone(S, ms)) return null;
  const f = S.fmt.format;
  if (f === 'single') return { name: lgPlayed(ms)[0].winner, how: 'match' };
  if (f === 'cup') return { name: /** @type {string} */ (lgCupState(S, ms).champion), how: 'cup' };
  if (f === 'swiss') return { name: lgSwissState(S, ms).table[0].name, how: 'swiss' };
  if (f === 'koth') {
    const k = lgKothState(S, ms);
    if (k.first) return { name: k.first, how: 'retired' };
    return { name: lgStandings(S, ms)[0].name, how: lgKothDry(S, ms) ? 'dry' : 'elo' };
  }
  return { name: lgStandings(S, ms)[0].name, how: f === 'ladder' ? 'ladder' : 'table' };
}

// Escalera (populateladder, F1Mode.bas:443-500): los participantes entran de
// a uno en el orden de inscripción; el primero ocupa el peldaño 1 sin pelear.
// Cada aspirante desafía desde el peldaño 1 hacia abajo: si gana, ocupa ese
// peldaño y empuja a los demás un lugar; si pierde con todos, queda último.
// Todo sale de recorrer el historial (solo cuentan los duelos esperados).
/** @param {Season} S @param {Match[]} ms */
export function lgLadderState(S, ms) {
  const E = S.entrants;
  /** @type {string[]} */
  const ladder = [];
  let ci = 0;
  let pos = 0;
  if (E.length) {
    ladder.push(E[0].name);
    ci = 1;
  }
  for (const m of lgPlayed(ms)) {
    if (ci >= E.length) break;
    const c = E[ci].name;
    const rung = ladder[pos];
    if (m.fighters.length !== 2 || !m.fighters.includes(c) || !m.fighters.includes(rung)) continue;
    if (m.winner === c) {
      ladder.splice(pos, 0, c);
      ci++;
      pos = 0;
    } else if (++pos >= ladder.length) {
      ladder.push(c);
      ci++;
      pos = 0;
    }
  }
  const next =
    ci < E.length && E.length >= 2
      ? [/** @type {Entrant} */ (E.find((e) => e.name === ladder[pos])), E[ci]]
      : null;
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
export const LG_CUP_SIZES = [8, 16, 32];
export const LG_CUP_GROUP = 4;
/** @param {Season} S */
export const lgCupSizeOk = (S) => LG_CUP_SIZES.includes(S.entrants.length);
/** @param {number} g */
export const lgCupLetter = (g) => String.fromCharCode(65 + g);

// ¿S.groups reparte exactamente a los participantes de la temporada?
/** @param {Season} S */
export function lgCupGroupsOk(S) {
  const G = S.groups;
  if (!lgCupSizeOk(S) || !Array.isArray(G) || G.length !== S.entrants.length / LG_CUP_GROUP)
    return false;
  const names = new Set(S.entrants.map((e) => e.name));
  const seen = new Set();
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
/** @param {Entrant[]} entrants @param {Fmt} fmt @param {Map<string, number> | null} elo @param {Rnd} [rnd] */
export function lgCupGroups(entrants, fmt, elo, rnd = Math.random) {
  const G = Math.max(1, Math.floor(entrants.length / LG_CUP_GROUP));
  const list = lgShuffle(
    entrants.map((e) => e.name),
    rnd,
  );
  if (fmt.pots !== 'random') {
    /** @param {string} n */
    const v = (n) => (elo?.has(n) ? /** @type {number} */ (elo.get(n)) : LG_ELO0);
    list.sort((a, b) => v(b) - v(a)); // sort estable: los empates siguen al azar
  }
  /** @type {string[][]} */
  const groups = Array.from({ length: G }, () => []);
  for (let p = 0; p < list.length; p += G)
    lgShuffle(list.slice(p, p + G), rnd).forEach((n, i) => {
      groups[i].push(n);
    });
  return groups;
}

// Sortea los grupos de la temporada abierta si faltan (o ya no sirven) y el
// tamaño es de copa. Bombos con el Elo de la tabla histórica. true si sorteó.
/** @param {League} L @param {Match[]} matches @param {Rnd} [rnd] */
export function lgCupDraw(L, matches, rnd = Math.random) {
  const S = lgSeason(L);
  if (S.fmt.format !== 'cup' || !lgCupSizeOk(S) || lgCupGroupsOk(S)) return false;
  const elo = new Map(lgAllTime(L, matches).map((r) => [r.name, r.elo]));
  S.groups = lgCupGroups(S.entrants, S.fmt, elo, rnd);
  return true;
}

// Tabla de un grupo: victorias; entre los empatados, sus duelos directos; el
// Elo de la fase de grupos; menos rondas ganadas por el tope de ciclos; menos
// ciclos por partido; y por último el orden del sorteo.
/** @param {any[]} rows @param {(a: string, b: string) => number} h2h */
export function lgCupSort(rows, h2h) {
  /** @param {any} r */
  const avg = (r) => (r.p ? r.cyc / r.p : 0);
  const mini = new Map(
    rows.map((r) => [
      r,
      rows.filter((x) => x.w === r.w).reduce((s, x) => s + h2h(r.name, x.name), 0),
    ]),
  );
  return rows
    .slice()
    .sort(
      (a, b) =>
        b.w - a.w ||
        mini.get(b) - mini.get(a) ||
        b.elo - a.elo ||
        a.capR - b.capR ||
        avg(a) - avg(b) ||
        a.seed - b.seed,
    );
}

// Nombre de la ronda de n cruces (y del k-ésimo cruce, si k): rótulo cup-ko.
/** @param {number} n @param {number} [k] @returns {Rotulo} */
export function lgCupRound(n, k) {
  return rotulo('cup-ko', { ties: n, match: n === 1 ? 0 : k || 0 });
}

// Estado de la copa (pura): {phase: 'draw' | 'groups' | 'ko' | 'done',
// groups: [{name, rows}], played y total (partidos de grupo), fixtures: el
// calendario de grupos [{gi, day, leg, a, b, winner, no, id}], bracket:
// [[{a, b, winner, no, id}]] por ronda, third, next, label, champion, reach}.
// reach: nombre → hasta dónde llegó (0 = grupos, 1 = primera ronda del
// cuadro…; el ganador del 3.er puesto suma 0.5 y el campeón uno más que la
// final). Los partidos de grupo son los duelos del calendario hasta
// completarlo; después solo cuenta el duelo del cruce pendiente.
/** @param {Season} S @param {Match[]} ms */
export function lgCupState(S, ms) {
  /** @type {any} */
  const st = {
    phase: 'draw',
    groups: [],
    played: 0,
    total: 0,
    fixtures: [],
    bracket: [],
    third: null,
    next: null,
    label: null,
    champion: null,
    reach: new Map(),
  };
  if (!lgCupGroupsOk(S)) return st;
  const groupsS = /** @type {string[][]} */ (S.groups);
  const legs = S.fmt.groupLegs === 2 ? 2 : 1;
  const E = new Map(S.entrants.map((e) => [e.name, e]));
  const gOf = new Map();
  groupsS.forEach((g, gi) => {
    for (const n of g) gOf.set(n, gi);
  });
  // Calendario intercalado: la jornada 1 de A, B, C…, luego la 2…
  const rr = lgRrFixtures(LG_CUP_GROUP, legs);
  const perDay = LG_CUP_GROUP / 2;
  const days = rr.length / perDay;
  /** @type {any[]} */
  const fx = [];
  for (let d = 0; d < days; d++) {
    groupsS.forEach((g, gi) => {
      for (let k = 0; k < perDay; k++) {
        const f = rr[d * perDay + k];
        fx.push({ gi, day: d + 1, leg: f.leg, a: g[f.pair[0]], b: g[f.pair[1]] });
      }
    });
  }
  st.total = fx.length;
  const rows = new Map();
  groupsS.forEach((g, gi) => {
    g.forEach((n, i) => {
      rows.set(n, {
        name: n,
        color: E.get(n)?.color || LG_NO_COLOR,
        group: gi,
        seed: i,
        p: 0,
        w: 0,
        elo: LG_ELO0,
        cyc: 0,
        capR: 0,
        rounds: 0,
      });
    });
  });
  for (const n of rows.keys()) st.reach.set(n, 0);
  const cnt = new Map();
  /** @type {Match[]} */
  const gms = [];
  /** @type {Match[]} */
  const ko = [];
  for (const m of lgPlayed(ms)) {
    if (gms.length >= fx.length) {
      ko.push(m);
      continue;
    }
    const [a, b] = m.fighters;
    if (m.fighters.length !== 2 || a === b || !gOf.has(a) || gOf.get(a) !== gOf.get(b)) continue;
    const k = lgPairKey(a, b);
    const c = cnt.get(k) || 0;
    if (c >= legs) continue;
    cnt.set(k, c + 1);
    gms.push(m);
    const f0 = fx.find((x) => x.leg === c + 1 && lgPairKey(x.a, x.b) === k);
    if (f0) Object.assign(f0, { winner: m.winner, no: m.no, id: m.id });
    const f = [rows.get(a), rows.get(b)];
    const w = rows.get(m.winner);
    for (const r of f) {
      r.p++;
      r.cyc += m.cycles || 0;
    }
    if (!w) continue;
    w.w++;
    w.capR += m.capRounds || 0;
    w.rounds += m.rounds || 0;
    lgElo(f, w);
  }
  st.played = gms.length;
  st.fixtures = fx;
  const h2h = lgH2H(gms);
  st.groups = groupsS.map((g, gi) => ({
    name: lgCupLetter(gi),
    rows: lgCupSort(
      g.map((n) => rows.get(n)),
      h2h,
    ),
  }));
  if (gms.length < fx.length) {
    const f = fx.find((x) => (cnt.get(lgPairKey(x.a, x.b)) || 0) < x.leg);
    st.phase = 'groups';
    st.next = [E.get(f.a), E.get(f.b)];
    st.label = rotulo('cup-group', { group: lgCupLetter(f.gi), day: f.day, days });
    return st;
  }
  // Cuadro: 1A-2B, 1C-2D… en la mitad de arriba; 1B-2A, 1D-2C… en la de abajo.
  st.phase = 'ko';
  const top = [];
  const bottom = [];
  /** @param {number} gi @param {number} pos */
  const at = (gi, pos) => st.groups[gi].rows[pos].name;
  for (let gi = 0; gi < st.groups.length; gi += 2) {
    top.push({ a: at(gi, 0), b: at(gi + 1, 1) });
    bottom.push({ a: at(gi + 1, 0), b: at(gi, 1) });
  }
  let i = 0;
  /** @param {any} t @param {Rotulo} label */
  const play = (t, label) => {
    while (i < ko.length) {
      const m = ko[i++];
      if (m.fighters.length === 2 && m.fighters.includes(t.a) && m.fighters.includes(t.b)) {
        Object.assign(t, { winner: m.winner, no: m.no, id: m.id });
        return;
      }
    }
    if (!st.next) {
      st.next = [E.get(t.a), E.get(t.b)];
      st.label = label;
    }
  };
  /** @param {any} t */
  const loser = (t) => (t.winner === t.a ? t.b : t.a);
  /** @type {any[]} */
  let ties = [...top, ...bottom];
  let lvl = 1;
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
      play(st.third, rotulo('cup-third'));
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

/** @template T @param {T[]} list @param {Rnd} [rnd] @returns {T[]} */
export function lgShuffle(list, rnd = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Suizo ------------------------------------------------------------------------
// Cada ronda empareja a los de igual puntaje (sin repetir rival mientras se
// pueda); en ~log2(N) rondas los fuertes terminan peleando entre ellos. Puntos:
// victoria 1, nula ½, bye 1 (sin pelea). Desempates: Buchholz (suma de los
// puntos de los rivales), Elo (1500, K 32, en el orden de los partidos) y
// rondas ganadas por extinción. La tabla y el emparejamiento son los de
// tools/fight/torneo.mjs swiss (que los toma de web/league.js). Todo sale del
// historial salvo el orden sorteado de la ronda 1: S.order = [nombres]. En la
// web un nulo se repite (como en la copa); en torneo.mjs vale ½.
//
// Registro de la tabla: {fighters: [a, b], winner ('' = nula), bye, won, ext,
// lost} con won/ext/lost = rondas ganadas, ganadas por extinción y perdidas
// de cada luchador; el bye es {bye: true, fighters: [n], winner: n}.
/** @param {Fmt} f @param {number} n */
export const lgSwissRounds = (f, n) =>
  parseInt(f.swissRounds, 10) > 0
    ? parseInt(f.swissRounds, 10)
    : Math.ceil(Math.log2(Math.max(2, n))) + 1;

// Un partido de la liga como registro de la tabla: extinción = victorias
// menos las del tope de ciclos (m.capWins; los partidos de antes, 0).
/** @param {Match} m */
export function lgSwissRec(m) {
  const wins = m.wins || m.fighters.map((n) => (n === m.winner ? 1 : 0));
  const cap = m.capWins || [];
  const total = wins.reduce((a, b) => a + b, 0);
  return {
    fighters: m.fighters,
    winner: m.winner,
    bye: false,
    won: wins,
    ext: wins.map((w, i) => Math.max(0, w - (cap[i] || 0))),
    lost: wins.map((w) => total - w),
  };
}

// Tabla (pura): names en el orden de desempate final (el de inscripción).
/** @param {string[]} names @param {any[]} recs */
export function lgSwissTable(names, recs) {
  /** @type {Map<string, any>} */
  const T = new Map(
    names.map((n) => [
      n,
      {
        name: n,
        points: 0,
        buchholz: 0,
        elo: LG_ELO0,
        fights: 0,
        won: 0,
        lost: 0,
        void: 0,
        byes: 0,
        roundsWon: 0,
        roundsWonExtinct: 0,
        roundsLost: 0,
        opponents: [],
      },
    ]),
  );
  for (const m of recs) {
    if (m.bye) {
      const r = T.get(m.fighters[0]);
      if (r) {
        r.points += 1;
        r.byes++;
      }
      continue;
    }
    const [A, B] = m.fighters.map((/** @type {string} */ n) => T.get(n));
    if (!A || !B) continue;
    A.opponents.push(B.name);
    B.opponents.push(A.name);
    [A, B].forEach((r, i) => {
      r.fights++;
      if (!m.winner) {
        r.void++;
        r.points += 0.5;
      } else if (m.winner === r.name) {
        r.won++;
        r.points += 1;
      } else r.lost++;
      r.roundsWon += m.won?.[i] || 0;
      r.roundsWonExtinct += m.ext?.[i] || 0;
      r.roundsLost += m.lost?.[i] || 0;
    });
    const sA = !m.winner ? 0.5 : m.winner === A.name ? 1 : 0;
    // biome-ignore lint/style/useExponentiationOperator: el mismo cálculo que web/league.js
    const exp = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400));
    const d = LG_K * (sA - exp);
    A.elo += d;
    B.elo -= d;
  }
  for (const r of T.values())
    r.buchholz = r.opponents.reduce(
      (/** @type {number} */ s, /** @type {string} */ n) => s + T.get(n).points,
      0,
    );
  return [...T.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.buchholz - x.buchholz ||
      y.elo - x.elo ||
      y.roundsWonExtinct - x.roundsWonExtinct,
  );
}

export const LG_SWISS_STEPS = 100000;

// Emparejamiento de una ronda (puro): por la tabla (nombres, de arriba
// abajo), el primero libre con el siguiente libre que no haya enfrentado
// todavía. Con N impar, el bye va al de más abajo que aún no tuvo.
// order: los nombres del campo; devuelve {pairs: [[a, b]], bye}.
/** @param {string[]} order @param {string[]} table @param {any[]} recs */
export function lgSwissPair(order, table, recs) {
  const played = new Set(
    recs.filter((m) => !m.bye).map((m) => m.fighters.slice().sort().join('\u0000')),
  );
  /** @param {string} x @param {string} y */
  const met = (x, y) => played.has([x, y].sort().join('\u0000'));
  const pos = new Map(table.map((n, i) => [n, i]));
  const list = order.slice().sort((x, y) => pos.get(x) - pos.get(y));
  /** @type {string | null} */
  let bye = null;
  if (list.length % 2) {
    const byes = new Set(recs.filter((m) => m.bye).map((m) => m.fighters[0]));
    const i = list.map((n) => !byes.has(n)).lastIndexOf(true);
    bye = list.splice(i < 0 ? list.length - 1 : i, 1)[0];
  }
  // Sin revanchas si se puede: el primero libre con el primer candidato que
  // no enfrentó y, si lo que queda no se puede emparejar, el siguiente
  // candidato (vuelta atrás). Cuando el goloso no deja revanchas, da lo
  // mismo que él. Si no hay forma (o se pasa del presupuesto), el goloso con
  // revanchas.
  let steps = 0;
  /** @param {string[]} free @returns {string[][] | null} */
  const clean = (free) => {
    if (!free.length) return [];
    const p = free[0];
    for (let j = 1; j < free.length; j++) {
      if (met(p, free[j])) continue;
      if (++steps > LG_SWISS_STEPS) return null;
      const rest = clean(free.slice(1, j).concat(free.slice(j + 1)));
      if (rest) return [[p, free[j]], ...rest];
    }
    return null;
  };
  let pairs = clean(list);
  if (!pairs) {
    pairs = [];
    const free = list.slice();
    while (free.length) {
      const p = /** @type {string} */ (free.shift());
      let j = free.findIndex((q) => !met(p, q));
      if (j < 0) j = 0; // todos enfrentados: revancha
      pairs.push([p, free.splice(j, 1)[0]]);
    }
  }
  return { pairs, bye };
}

// El campo del suizo: S.order sin repetidos ni los que ya no están.
/** @param {Season} S @returns {string[]} */
export function lgSwissField(S) {
  if (!Array.isArray(S.order)) return [];
  const have = new Set(S.entrants.map((e) => e.name));
  const seen = new Set();
  return S.order.filter((n) => have.has(n) && !seen.has(n) && seen.add(n));
}

// Sortea el orden de la ronda 1 de la temporada abierta si falta o, sin
// partidos todavía, si no es el de los participantes. Con partidos, el campo
// queda fijo (los que se sumen juegan desde la temporada siguiente). true si sorteó.
/** @param {League} L @param {Match[]} matches @param {Rnd} [rnd] */
export function lgSwissDraw(L, matches, rnd = Math.random) {
  const S = lgSeason(L);
  if (S.fmt.format !== 'swiss') return false;
  const names = S.entrants.map((e) => e.name);
  if (Array.isArray(S.order)) {
    if (matches.some((m) => m.league === L.id && m.season === S.no)) return false;
    const field = lgSwissField(S);
    if (field.length === names.length && field.length === S.order.length) return false;
  }
  S.order = lgShuffle(names, rnd);
  return true;
}

// Estado del suizo (puro): {phase: 'draw' | 'play' | 'done', field, round,
// rounds, history: [{no, pairs: [{a, b, winner, no, id}], bye}], next, label,
// table (lgSwissTable)}. Los partidos cuentan en orden: cada cruce toma el
// siguiente partido jugado entre esos dos (los demás se saltean).
/** @param {Season} S @param {Match[]} ms */
export function lgSwissState(S, ms) {
  const field = lgSwissField(S);
  /** @type {any} */
  const st = {
    phase: 'draw',
    field,
    round: 0,
    rounds: 0,
    history: [],
    next: null,
    label: null,
    table: [],
  };
  if (field.length < 2) return st;
  const inField = new Set(field);
  const names = S.entrants.map((e) => e.name).filter((n) => inField.has(n));
  const E = new Map(S.entrants.map((e) => [e.name, e]));
  st.rounds = lgSwissRounds(S.fmt, field.length);
  /** @type {any[]} */
  const recs = [];
  const played = lgPlayed(ms);
  let i = 0;
  for (let r = 1; r <= st.rounds; r++) {
    const table = r === 1 ? field : lgSwissTable(names, recs).map((x) => x.name);
    const { pairs, bye } = lgSwissPair(field, table, recs);
    /** @type {{no: number, pairs: any[], bye: string | null}} */
    const rd = { no: r, pairs: pairs.map(([a, b]) => ({ a, b })), bye };
    st.history.push(rd);
    st.round = r;
    for (const [k, t] of rd.pairs.entries()) {
      while (i < played.length) {
        const m = played[i++];
        if (
          m.fighters.length === 2 &&
          m.fighters.includes(t.a) &&
          m.fighters.includes(t.b) &&
          t.a !== t.b
        ) {
          Object.assign(t, { winner: m.winner, no: m.no, id: m.id });
          recs.push(lgSwissRec(m));
          break;
        }
      }
      if (!t.winner) {
        st.phase = 'play';
        st.next = [E.get(t.a), E.get(t.b)];
        st.label = rotulo('swiss', {
          round: r,
          rounds: st.rounds,
          match: k + 1,
          matches: rd.pairs.length,
          bye,
        });
        st.table = lgSwissTable(names, recs);
        return st;
      }
    }
    if (bye) recs.push({ bye: true, fighters: [bye], winner: bye });
  }
  st.phase = 'done';
  st.table = lgSwissTable(names, recs);
  return st;
}

// Próxima pelea: {fighters, label} o null si la temporada terminó (o tiene
// menos de 2 participantes). Pura salvo el sorteo del rey de la colina (rnd).
/** @param {Season} S @param {Match[]} ms @param {Rnd} [rnd] @returns {{fighters: Entrant[], label: Rotulo} | null} */
export function lgFixture(S, ms, rnd = Math.random) {
  const E = S.entrants;
  if (E.length < 2 || lgSeasonDone(S, ms)) return null;
  if (S.fmt.format === 'single') {
    const n = Math.min(E.length, LG_MAX_FIGHTERS);
    return { fighters: E.slice(0, n), label: rotulo('single', { n, total: E.length }) };
  }
  if (S.fmt.format === 'rr') {
    const st = lgRrState(S, ms);
    return (
      st.next && { fighters: st.next, label: rotulo('rr', { no: st.played + 1, total: st.total }) }
    );
  }
  if (S.fmt.format === 'ladder') {
    const st = lgLadderState(S, ms);
    return (
      st.next && {
        fighters: st.next,
        label: rotulo('ladder', {
          challenger: st.next[1].name,
          rung: st.rung,
          entrant: st.placed + 1,
          total: st.total,
        }),
      }
    );
  }
  if (S.fmt.format === 'cup') {
    // Sin grupos sorteados (lgCupEnsure) o sin 8, 16 o 32 participantes: nada.
    const st = lgCupState(S, ms);
    return st.next && { fighters: st.next, label: st.label };
  }
  if (S.fmt.format === 'swiss') {
    // Sin orden sorteado (lgSwissEnsure): nada.
    const st = lgSwissState(S, ms);
    return st.next && { fighters: st.next, label: st.label };
  }
  const { champ, played } = lgKothState(S, ms);
  const ce = champ ? E.find((e) => e.name === champ) : null;
  /** @type {Entrant[]} */
  let others;
  if (S.live) {
    // Sorteo en cada pelea: los retadores que sorteó lgLiveFill para esta pelea.
    const nx =
      S.next && S.next.at === ms.length
        ? S.next.names.map((n) => E.find((e) => e.name === n))
        : null;
    if (!nx || nx.some((e) => !e || e === ce) || nx.length + (ce ? 1 : 0) < 2) return null;
    others = /** @type {Entrant[]} */ (nx);
  } else {
    const k = Math.min(Math.max(2, S.fmt.k), E.length, LG_MAX_FIGHTERS);
    const fought = S.fmt.noRepeat ? lgFought(ms) : new Set();
    others = lgShuffle(
      E.filter((e) => e !== ce && !fought.has(e.name)),
      rnd,
    ).slice(0, ce ? k - 1 : k);
  }
  return {
    fighters: ce ? [ce, ...others] : others,
    label: rotulo('koth', {
      champ: ce ? champ : null,
      fight: played + 1,
      cap: lgKothEndless(S.fmt) ? null : lgKothCap(S),
    }),
  };
}

// ---- Tabla -------------------------------------------------------------------
// Elo: en una pelea de N, el ganador le gana a cada uno de los demás con
// K / (N − 1), así una pelea de muchos no vale más que un duelo.
/** @param {{elo: number}[]} f @param {{elo: number}} w */
export function lgElo(f, w) {
  const k = LG_K / Math.max(1, f.length - 1);
  const before = w.elo;
  for (const r of f) {
    if (r === w) continue;
    // biome-ignore lint/style/useExponentiationOperator: el mismo cálculo que web/league.js
    const exp = 1 / (1 + Math.pow(10, (r.elo - before) / 400));
    const d = k * (1 - exp);
    w.elo += d;
    r.elo -= d;
  }
}

/** @param {Season} S @param {Match[]} ms @returns {any[]} */
export function lgStandings(S, ms) {
  const rows = new Map();
  /** @param {string} name */
  const row = (name) =>
    rows.get(name) ||
    rows
      .set(name, {
        name,
        color: S.entrants.find((e) => e.name === name)?.color || LG_NO_COLOR,
        p: 0,
        w: 0,
        elo: LG_ELO0,
        cyc: 0,
        capR: 0,
        rounds: 0,
      })
      .get(name);
  for (const e of S.entrants) row(e.name);
  for (const m of lgPlayed(ms)) {
    const f = m.fighters.map(row);
    for (const r of f) {
      r.p++;
      r.cyc += m.cycles || 0;
    }
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
    /** @param {any} r */
    const rank = (r) => (at.has(r.name) ? at.get(r.name) : 1e9);
    list.sort((a, b) => rank(a) - rank(b) || b.elo - a.elo);
  } else if (S.fmt.format === 'cup') {
    // Hasta dónde llegó cada uno (lgCupState), luego victorias y Elo.
    const reach = lgCupState(S, ms).reach;
    /** @param {any} r */
    const lv = (r) => reach.get(r.name) || 0;
    list.sort((a, b) => lv(b) - lv(a) || b.w - a.w || b.elo - a.elo);
  } else if (S.fmt.format === 'swiss') {
    // El orden de la tabla del suizo (con sus puntos y su Buchholz); los que
    // no están en el campo, al final.
    const tab = lgSwissState(S, ms).table;
    const at = new Map(tab.map((/** @type {any} */ r, /** @type {number} */ _i) => [r.name, r]));
    for (const r of list) {
      const t = at.get(r.name);
      if (t)
        Object.assign(r, { pts: t.points, bh: t.buchholz, byes: t.byes, rank: tab.indexOf(t) });
    }
    /** @param {any} r */
    const rank = (r) => (r.rank === undefined ? 1e9 : r.rank);
    list.sort((a, b) => rank(a) - rank(b) || b.elo - a.elo);
  } else if (lgKothEndless(S.fmt)) {
    // Colina sin fin: manda quien junta más retiros invictos, luego el Elo.
    const t = lgKothState(S, ms).titles;
    /** @param {any} r */
    const n = (r) => t.get(r.name) || 0;
    list.sort((a, b) => n(b) - n(a) || b.elo - a.elo || b.w - a.w);
  } else if (S.fmt.format === 'rr') list.sort((a, b) => b.w - a.w || b.elo - a.elo || a.p - b.p);
  else list.sort((a, b) => b.elo - a.elo || b.w - a.w);
  return list;
}

// Tabla histórica (el Hall of Fame de la liga): todas las temporadas, en
// orden, con un Elo que sigue de una a otra. Títulos = temporadas ganadas;
// seasons = temporadas en las que jugó al menos un partido. Solo aparecen
// los que jugaron. matches: los partidos de la liga (de cualquier temporada).
/** @param {League} L @param {Match[]} matches @returns {any[]} */
export function lgAllTime(L, matches) {
  const rows = new Map();
  /** @param {string} name */
  const row = (name) =>
    rows.get(name) ||
    rows
      .set(name, { name, color: LG_NO_COLOR, seasons: 0, titles: 0, p: 0, w: 0, elo: LG_ELO0 })
      .get(name);
  for (const S of L.seasons) {
    const ms = matches.filter((m) => m.season === S.no).sort((a, b) => a.no - b.no);
    const seen = new Set();
    for (const m of lgPlayed(ms)) {
      const f = m.fighters.map(row);
      for (const r of f) {
        r.p++;
        seen.add(r);
      }
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
  return [...rows.values()]
    .filter((r) => r.p)
    .sort((a, b) => b.titles - a.titles || b.w - a.w || b.elo - a.elo);
}

// Enfrentamientos directos: h[a][b] = veces que a le ganó a b (en una pelea
// de N, el ganador le gana a cada uno de los demás, como en el Elo).
/** @param {Match[]} ms @returns {(a: string, b: string) => number} */
export function lgH2H(ms) {
  const h = new Map();
  for (const m of lgPlayed(ms)) {
    const r = h.get(m.winner) || h.set(m.winner, new Map()).get(m.winner);
    for (const n of m.fighters) if (n !== m.winner) r.set(n, (r.get(n) || 0) + 1);
  }
  return (a, b) => h.get(a)?.get(b) || 0;
}
export const LG_H2H_MAX = 14;

// ---- Persistencia (lo puro) ------------------------------------------------------
// Migración (E11): el sorteo de la liga y los valores de formato que falten.
// Devuelve true si cambió algo (hay que guardarla).
/** @param {League} L */
export function lgMigrate(L) {
  let changed = false;
  const d = lgDrawOf(L);
  if (JSON.stringify(d) !== JSON.stringify(L.draw)) {
    L.draw = d;
    changed = true;
  }
  for (const S of L.seasons) {
    // Las temporadas de antes del tope de bots juegan sin él (las repeticiones
    // de sus partidos deben dar lo mismo).
    const f = { ...LG_FMT_DEFAULT, popCap: 0, ...(S.fmt || {}) };
    if (!LG_FORMATS.includes(f.format)) f.format = LG_FMT_DEFAULT.format;
    lgKothClean(f);
    if (JSON.stringify(f) !== JSON.stringify(S.fmt)) {
      S.fmt = f;
      changed = true;
    }
  }
  return changed;
}

export const lgNewId = () =>
  `L${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

// Liga nueva (pura): o = {id, name, rules, fmt, entrants, draw}; sin nombre,
// nombres.league.
/** @param {{id?: string, name?: string, rules?: any, fmt?: any, entrants?: Entrant[], draw?: any}} o @param {Nombres} [nombres] @returns {League} */
export function lgNewLeague(o, nombres = LG_NOMBRES) {
  const now = new Date().toISOString();
  return {
    id: o.id || lgNewId(),
    name: o.name || nombres.league,
    notes: '',
    created: now,
    draw: lgDrawClean(o.draw),
    seasons: [
      {
        no: 1,
        started: now,
        rules: { ...(o.rules || {}) },
        fmt: { ...LG_FMT_DEFAULT, ...(o.fmt || {}) },
        entrants: (o.entrants || []).map((e) => ({ ...e })),
      },
    ],
  };
}

// Nombre libre entre `names`: base, "base 2", "base 3"…
/** @param {string} base @param {Set<string>} names */
export function lgUniqueName(base, names) {
  let name = base;
  for (let k = 2; names.has(name); k++) name = `${base} ${k}`;
  return name;
}

// "prefix N" libre entre las ligas de `list` (lgNextName de la clásica, que
// leía lg.list).
/** @param {string} prefix @param {League[]} list */
export function lgNextName(prefix, list) {
  const names = new Set(list.map((L) => L.name));
  let n = list.length + 1;
  while (names.has(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
}

// ---- Scratch (E11): el partido rápido ---------------------------------------------
// Un torneo en memoria (id fijo, no se guarda) de formato single, para jugar
// enseguida como el Contest de antes. "Save as tournament" lo persiste con id
// nuevo y deja un Scratch limpio con las mismas reglas, formato y
// participantes. base: una liga de la que copiar eso (o nada: reglas dadas).
/** @param {League | null} base @param {any} [rules] @param {Nombres} [nombres] */
export function lgScratchNew(base, rules, nombres = LG_NOMBRES) {
  const S = base && lgSeason(base);
  const L = lgNewLeague(
    {
      id: LG_SCRATCH_ID,
      name: nombres.scratch,
      rules: S ? S.rules : rules || {},
      fmt: S ? S.fmt : { format: 'single' },
      entrants: S ? S.entrants : [],
      draw: base ? base.draw : null,
    },
    nombres,
  );
  return { L, matches: /** @type {Match[]} */ ([]), seq: 0 };
}

// Pura: el Scratch como liga nueva {L, matches} (id y nombre dados; los
// partidos reasignados, sin id). Reusa el camino de exportar e importar.
/** @param {League} L @param {Match[]} matches @param {string} id @param {string} name @param {Nombres} [nombres] */
export function lgPromote(L, matches, id, name, nombres = LG_NOMBRES) {
  const r = lgImportObj(lgExportObj({ ...L, name }, matches), new Set(), id, nombres);
  r.L.created = new Date().toISOString();
  return r;
}

// Temporada siguiente (pura): mismas reglas y formato; los participantes se
// copian salvo que se vayan a sortear.
/** @param {Season} S @param {boolean} draw @returns {Season} */
export function lgSeasonNext(S, draw) {
  return {
    no: S.no + 1,
    started: new Date().toISOString(),
    rules: { ...S.rules },
    fmt: { ...S.fmt },
    entrants: draw ? [] : S.entrants.map((e) => ({ ...e })),
  };
}

// ---- Compartir (L3) ---------------------------------------------------------------
// El archivo lleva la liga entera (temporadas con reglas, formato y
// participantes con su ADN) y sus partidos sin id ni liga: al importar se
// reasignan. Versión 2 (E11): la liga lleva su sorteo (draw) y los
// participantes su cantidad (qty); la 1 se importa con el sorteo 'fixed'.
export const LG_FILE_KIND = 'darwinbots-league';
export const LG_FILE_VER = 2;

/** @param {League} L @param {Match[]} matches */
export function lgExportObj(L, matches) {
  const { id, ...league } = L;
  return {
    kind: LG_FILE_KIND,
    version: LG_FILE_VER,
    exported: new Date().toISOString(),
    league: JSON.parse(JSON.stringify(league)),
    matches: matches
      .filter((m) => m.league === id)
      .sort((a, b) => a.season - b.season || a.no - b.no)
      .map(({ id: _i, league: _l, ...m }) => ({ ...m })),
  };
}

// Valida el archivo y devuelve {L, matches} listos para guardar, con un id
// nuevo y el nombre sin repetir entre `names` (con nombres.imported). Lanza
// ErrorLiga si no sirve.
/** @param {any} o @param {Set<string>} names @param {string} newId @param {Nombres} [nombres] @returns {{L: League, matches: Match[]}} */
export function lgImportObj(o, names, newId, nombres = LG_NOMBRES) {
  if (!o || o.kind !== LG_FILE_KIND) throw new ErrorLiga('not-league');
  if (o.version > LG_FILE_VER) throw new ErrorLiga('newer-version', { version: o.version });
  const src = o.league || {};
  if (!Array.isArray(src.seasons) || !src.seasons.length) throw new ErrorLiga('no-seasons');
  const seasons = src.seasons.map((/** @type {any} */ s, /** @type {number} */ i) => {
    if (!s || typeof s.rules !== 'object' || !Array.isArray(s.entrants))
      throw new ErrorLiga('season-incomplete', { season: i + 1 });
    const entrants = s.entrants.map((/** @type {any} */ e) => {
      if (!e || typeof e.name !== 'string' || typeof e.dna !== 'string')
        throw new ErrorLiga('entrant-no-dna', { season: i + 1 });
      /** @type {Entrant} */
      const x = {
        name: e.name,
        dna: e.dna,
        hash: lgHash(e.dna),
        src: e.src || 'form',
        file: e.file || '',
        color: e.color || LG_NO_COLOR,
      };
      const q = parseInt(e.qty, 10);
      if (q > 0) x.qty = Math.min(200, q);
      return x;
    });
    /** @type {Season} */
    const x = {
      no: +s.no || i + 1,
      started: s.started || '',
      rules: { ...s.rules },
      fmt: lgKothClean({ ...LG_FMT_DEFAULT, popCap: 0, ...(s.fmt || {}) }),
      entrants,
    };
    // Sorteo en cada pelea: la foto del sorteo de la temporada.
    if (s.live && typeof s.live === 'object' && typeof s.live.pool === 'string')
      x.live = {
        pool: s.live.pool,
        n: Math.min(LG_DRAW_MAX, Math.max(0, parseInt(s.live.n, 10) || 0)),
      };
    if (x.live && Number.isInteger(s.dry)) x.dry = s.dry; // rey de la colina sin repetir: el pool se secó
    // E12: el reparto de los grupos de la copa, si reparte a estos participantes.
    if (Array.isArray(s.groups)) {
      x.groups = s.groups.map((/** @type {any} */ g) => (Array.isArray(g) ? g.map(String) : []));
      if (!lgCupGroupsOk(x)) delete x.groups;
    }
    // Suizo: el orden sorteado de la ronda 1 del suizo.
    if (Array.isArray(s.order)) x.order = s.order.map(String);
    return x;
  });
  let name = String(src.name || nombres.league).trim() || nombres.league;
  if (names.has(name)) name = lgUniqueName(`${name}${nombres.imported}`, names);
  /** @type {League} */
  const L = {
    id: newId,
    name,
    notes: String(src.notes || ''),
    created: src.created || new Date().toISOString(),
    draw: o.version >= 2 ? lgDrawClean(src.draw) : lgDrawClean(null),
    seasons,
  };
  lgMigrate(L);
  const nos = new Set(seasons.map((/** @type {Season} */ s) => s.no));
  const matches = (Array.isArray(o.matches) ? o.matches : [])
    .filter((/** @type {any} */ m) => m && nos.has(m.season) && Array.isArray(m.fighters))
    .map(({ id: _i, ...m }) => ({ ...m, league: newId }));
  return { L, matches };
}

/** @param {League} L */
export const lgFileName = (L) =>
  `${
    L.name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'league'
  }.league.json`;

// ---- Migración del Contest y el Canal viejos (E11) ---------------------------------
// El Hall of Fame del Canal viejo como archivo, o null si no hay. raw: el
// texto guardado bajo LG_OLD_HOF_KEY (la clásica lo leía de localStorage).
export const LG_OLD_ROSTER_KEY = 'db-contest-roster';
export const LG_OLD_HOF_KEY = 'db-channel-hof';
export const LG_OLD_CHCFG_KEY = 'db-channel-cfg';

/** @param {string | null} raw */
export function lgOldHofFile(raw) {
  let hof = null;
  try {
    hof = JSON.parse(raw || 'null');
  } catch (_e) {
    hof = null;
  }
  const rows = hof && typeof hof === 'object' ? Object.values(hof).filter((r) => r?.name) : [];
  if (!rows.length) return null;
  return {
    kind: 'darwinbots-channel-hof',
    exported: new Date().toISOString(),
    note: 'Hall of Fame of the old F1 Channel (before Tournaments): fights, wins, undefeated retirements and best streak per bot.',
    rows: rows.sort((a, b) => (b.titles || 0) - (a.titles || 0) || (b.wins || 0) - (a.wins || 0)),
  };
}

// ---- Participantes ---------------------------------------------------------------
/** @param {Season} S @param {() => string} [otro] color si la paleta está llena (invColor en la clásica) */
export function lgFreeColor(S, otro = () => LG_NO_COLOR) {
  const used = new Set(S.entrants.map((e) => e.color));
  return LG_COLORS.find((c) => !used.has(c)) || otro();
}

// Agrega {name, dna, src, file, qty?, color?}. El mismo ADN no entra dos
// veces; un nombre repetido con otro ADN lleva sufijo (el censo agrupa por
// nombre). qty (E11) pisa los bots por especie del formato; el color pedido
// se respeta si nadie lo usa.
/** @param {Season} S @param {any} e @param {() => string} [otro] */
export function lgAddEntrant(S, e, otro) {
  const hash = lgHash(e.dna);
  if (S.entrants.some((x) => x.hash === hash)) return false;
  const name = lgUniqueName(e.name, new Set(S.entrants.map((x) => x.name)));
  const color =
    e.color && !S.entrants.some((x) => x.color === e.color) ? e.color : lgFreeColor(S, otro);
  /** @type {Entrant} */
  const x = { name, dna: e.dna, hash, src: e.src, file: e.file || '', color };
  const q = parseInt(e.qty, 10);
  if (q > 0) x.qty = Math.min(200, q);
  S.entrants.push(x);
  return true;
}

// Lo que recibe el lanzamiento (partido.js): el ADN congelado y la cantidad de cada uno.
/** @param {Fmt} f @param {Entrant[]} fighters */
export const lgLaunchList = (f, fighters) =>
  fighters.map((e) => ({
    name: e.name,
    src: 'form',
    dna: e.dna,
    qty: e.qty || f.qty,
    color: e.color,
  }));

// Pool del Inventario, como el del Canal (no vegetales, un nombre por especie).
// inv = {items: [{key, b}], sel: Set, sets: Map, userRec(key) → {fav, tags}}
// (inv y userRec de inventory.js en la clásica).
/** @param {any} inv @param {string} filter */
export function lgPool(inv, filter) {
  let items = inv.items.filter((/** @type {any} */ it) => !it.b.veg);
  if (filter === 'fav') items = items.filter((/** @type {any} */ it) => inv.userRec(it.key).fav);
  else if (filter === 'sel') items = items.filter((/** @type {any} */ it) => inv.sel.has(it.key));
  else if (filter.startsWith('tag:')) {
    const t = filter.slice(4);
    items = items.filter((/** @type {any} */ it) => inv.userRec(it.key).tags.includes(t));
  } else if (filter.startsWith('set:')) {
    const set = inv.sets.get(filter.slice(4));
    const keys = new Set(set ? set.keys : []);
    items = items.filter((/** @type {any} */ it) => keys.has(it.key));
  } else if (filter !== 'all') items = [];
  const seen = new Set();
  return items.filter((/** @type {any} */ it) => !seen.has(it.b.name) && seen.add(it.b.name));
}

// ---- De tournament.js: avance, avisos y edición del formato (sin texto) -----------
// Avance de la temporada (tnProgress): null o {clave, params}.
//   complete {}; rr {played, total}; ladder {placed, n}; cup-size {n};
//   cup-draw {}; cup-groups {played, total}; cup-ko {label} (el rótulo del
//   cruce pendiente; la clásica mostraba solo el nombre de la ronda);
//   swiss-draw {}; swiss {round, rounds, done, matches, waiting};
//   koth-endless {played, retire, crowns, champ, streak};
//   koth {played, cap, champ, streak, retire}; not-played {}.
/** @param {Season} S @param {Match[]} ms @returns {Rotulo | null} */
export function lgProgress(S, ms) {
  if (S.entrants.length < 2) return null;
  if (lgSeasonDone(S, ms)) return rotulo('complete');
  const f = S.fmt.format;
  if (f === 'rr') {
    const st = lgRrState(S, ms);
    return rotulo('rr', { played: st.played, total: st.total });
  }
  if (f === 'ladder') {
    const st = lgLadderState(S, ms);
    return rotulo('ladder', { placed: st.placed, n: S.live ? S.live.n : st.total });
  }
  if (f === 'cup') {
    if (!lgCupSizeOk(S)) return rotulo('cup-size', { n: S.entrants.length });
    const st = lgCupState(S, ms);
    if (st.phase === 'draw') return rotulo('cup-draw');
    if (st.phase === 'groups') return rotulo('cup-groups', { played: st.played, total: st.total });
    return rotulo('cup-ko', { label: st.label });
  }
  if (f === 'swiss') {
    const st = lgSwissState(S, ms);
    if (st.phase === 'draw') return rotulo('swiss-draw');
    const rd = st.history[st.round - 1];
    const done = rd.pairs.filter((/** @type {any} */ t) => t.winner).length;
    return rotulo('swiss', {
      round: st.round,
      rounds: st.rounds,
      done,
      matches: rd.pairs.length,
      waiting: S.entrants.length - st.field.length,
    });
  }
  if (f === 'koth') {
    const k = lgKothState(S, ms);
    if (lgKothEndless(S.fmt)) {
      const crowns = [...k.titles.values()].reduce((a, b) => a + b, 0);
      return rotulo('koth-endless', {
        played: k.played,
        retire: S.fmt.retire,
        crowns,
        champ: k.champ,
        streak: k.streak,
      });
    }
    return rotulo('koth', {
      played: k.played,
      cap: lgKothCap(S),
      champ: k.champ,
      streak: k.streak,
      retire: S.fmt.retire,
    });
  }
  return rotulo('not-played');
}

// Todos contra todos con muchos participantes (tnRrWarn): los partidos del
// calendario de n si pasan de LG_RR_WARN, o 0.
/** @param {Season} S @param {number} n */
export function lgRrWarn(S, n) {
  const fx = (n * (n - 1)) / 2;
  return S.fmt.format === 'rr' && fx > LG_RR_WARN ? fx : 0;
}

// Qué hace el sorteo en cada pelea con el formato de la temporada
// (tnDrawHint): null o {clave, params}.
//   cup {}; next-season {}; koth {locked, n, cap}; koth-endless {locked, n};
//   ladder {locked, n}; first-match {locked, n}.
/** @param {{mode: string, pool: string, n: number}} dr @param {Season} S @param {boolean} locked @returns {Rotulo | null} */
export function lgDrawHint(dr, S, locked) {
  if (dr.mode !== 'fight') return null;
  const f = S.fmt.format;
  if (f === 'cup') return rotulo('cup');
  if (locked && !S.live) return rotulo('next-season');
  const n = S.live ? S.live.n : dr.n;
  if (f === 'koth')
    return lgKothEndless(S.fmt)
      ? rotulo('koth-endless', { locked, n })
      : rotulo('koth', { locked, n, cap: LG_KOTH_CAP * n });
  if (f === 'ladder') return rotulo('ladder', { locked, n });
  return rotulo('first-match', { locked, n });
}

// Valores editables del formato (los campos de lgFmtHtml): 'select',
// 'check' o [mín, máx] (máx 0 = sin tope, 1e7 como en la ventana).
/** @type {Record<string, string | number[] | ((f: Fmt) => number[])>} */
export const LG_FMT_FIELDS = {
  format: 'select',
  pots: 'select',
  kothEnd: 'select',
  capMode: 'select',
  third: 'check',
  noRepeat: 'check',
  swissRounds: [0, 99],
  groupLegs: [1, 2],
  legs: [1, 2],
  k: [2, 20],
  retire: (f) => (f.kothEnd === 'never' ? [0, 999] : [1, 999]),
  qty: [1, 200],
  nrg: [1, 0],
  rounds: [1, 99],
  wins: [0, 99],
  cap: [0, 0],
  popCap: [0, 0],
};

// Un valor del formato cambiado en la ventana (el onchange de #tn-fmt): lo
// acota como el campo, limpia la colina y, si cambia el formato o los
// bombos, borra los grupos de la copa. true si k es un campo conocido.
/** @param {Season} S @param {string} k @param {any} v */
export function lgFmtSet(S, k, v) {
  const kind = LG_FMT_FIELDS[k];
  if (!kind) return false;
  const f = S.fmt;
  if (kind === 'check') f[k] = !!v;
  else if (kind === 'select') f[k] = String(v);
  else {
    const [lo, hi] = typeof kind === 'function' ? kind(f) : /** @type {number[]} */ (kind);
    const n = parseInt(v, 10);
    f[k] = Math.min(
      hi || 1e7,
      Math.max(lo || 0, Number.isNaN(n) ? /** @type {any} */ (LG_FMT_DEFAULT)[k] : n),
    );
  }
  lgKothClean(f); // retiro 0 solo sin fin
  if (k === 'format' || k === 'pots') delete S.groups; // copa: otro sorteo
  return true;
}
