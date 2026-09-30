// @ts-check
// Un partido de torneo contra el worker, sin DOM: qué se le manda para
// lanzarlo (reinicio con semilla, modo F1, topes, siembra, censo y arranque)
// y cómo se leen sus respuestas (f1-started, f1-note, f1-over y el f1 de
// cada frame). El estado del partido en curso (lg.live) lo guarda
// engine/torneos.js; aquí están las funciones que lo leen y lo actualizan.
//
// Origen (paso E1.2 de port/web2/PLAN.md, decisión 1):
//   contestWinsNeeded, contestMinLength ... port/web/contest.js 17-24
//   contestRule ........................... contest.js 28-44 (contestRuleText/Hint, como datos)
//   planPartido, mensajesPartido .......... contest.js 76-100 (contestLaunch) y el reinicio de
//                                           web/index.html (newSim 3741-3756, btn-reset 3822-3827,
//                                           setRunning 3813-3817)
//   reglasAOpciones ....................... web/league.js 203-216 (lgApplyRules) + web/index.html
//                                           1133-1155 (collectOptions), 1076-1101 (los 'change' del
//                                           panel), 1113-1126 (costValue, optValue), 3860-3863 (setInput)
//   CONTROLES_CLASICA ..................... web/index.html 864-990 (OPT_GROUPS) y 671, 701, 703
//                                           (los data-id fijos de la barra lateral)
//   ALGA_ARRANQUE, siembraArranque ........ web/index.html 824-839 (PRESETS.alga) y 3745-3753
//   fieldSizeDims, PHYS_CLASICA ........... web/index.html 1002-1006, 995-999
//   cssToVbColor .......................... web/index.html 845-850
//   contestRoundWinner .................... contest.js 103-107
//   nuevoVivo ............................. web/league.js 1392-1394 (lgPlay)
//   interpretarMensaje .................... web/league.js 1495-1517 (leagueOnMessage)
//   marcadorFinal ......................... web/league.js 1465-1468 (lgRecord)
//   compararRepeticion .................... web/league.js 1434-1438 (lgReplayCheck)
//   alFrame ............................... web/tournament.js 422-427 (tnOnStats)
//
// Orden de los mensajes (el worker atiende en orden, así que llega tal cual):
// f1-cap → f1-popcap → run(false) → reset → seed-species… → f1start → run(true).
// Con {limpio: true} (la nueva, C15; ver mensajesPartido): run(false) →
// reset limpio → f1-cap → f1-popcap → seed-species… → f1start → run(true).
// Diferencia con la clásica, sin efecto en la sim: contestLaunch escribía las
// opciones de modo de juego (91 F1, 97 rondas, 98 Maxrounds, 99 y 100 en 0)
// en el panel, que las mandaba en vivo a la sim vieja y el reinicio las
// recogía del panel; aquí van directamente en las opciones del reset.
// Esos 'change' (y los de lgApplyRules) mandaban setopt/setcost en vivo a la
// sim ANTERIOR, que el reinicio reemplaza: no llegan a la sim del partido y
// aquí no se mandan.
//
// Las opciones del reset: reglasAOpciones(rules, base) hace lo que la
// clásica hacía con el panel (lgApplyRules escribe la foto de las reglas en
// los controles y collectOptions los recoge): `base` son las opciones del
// panel antes del partido (en la nueva, las del escenario), y todo control
// que la foto no incluye conserva ese valor. La siembra del reset es SIEMPRE
// la del arranque de la clásica (el alga, siembraArranque()) salvo que el
// anfitrión pase otra.
//
// Errores (ErrorLiga; tabla completa en la cabecera de league.js):
//   no-dna {name} · no-options {} · no-base-options {} · bad-base {}
//
// Notas de partido nulo: se guardan en el registro (rec.note) con el mismo
// texto que la clásica, para que los archivos exportados sigan siendo
// compatibles; la interfaz las reconoce por valor (NOTA_*) y las traduce.

import { ErrorLiga } from './league.js';

export const NOTA_CENSO_VACIO = 'void: the census found no fighters';
export const NOTA_UNA_ESPECIE = 'void: only one species in the census';

// Regla del original (F1Mode.bas:361-426): con MinRounds = N, gana quien
// tenga MÁS de √N + N/2 victorias; si nadie llega, "Statistical Draw.
// Extending contest." y N sube en 1. Victorias necesarias con N rondas:
/** @param {number} n */
export const contestWinsNeeded = (n) => Math.floor(Math.sqrt(n) + n / 2) + 1;
// Rondas que dura como mínimo (ganando una especie todas): el primer n ≥ N
// en el que n victorias alcanzan.
/** @param {number} n */
export function contestMinLength(n) {
  let m = n;
  while (contestWinsNeeded(m) > m) m++;
  return m;
}
// La regla del partido como datos (contestRuleText y contestRuleHint de la
// clásica arman el texto con esto): need = victorias que alcanzan en la
// ronda n; wins = tope de victorias (0 = apagado); min = rondas mínimas si
// una especie las gana todas.
/** @param {number} n @param {number} wins */
export const contestRule = (n, wins) => ({
  need: contestWinsNeeded(n),
  wins: wins || 0,
  min: contestMinLength(n),
});

// ---- Opciones del reset: el panel de la clásica como datos ------------------------
// Los controles del panel de opciones de la clásica que lgRuleEls fotografía
// (web/league.js 153-160) y collectOptions recoge: data-id (opción E1, sale en
// opts[id]), data-cost (Costs(i), en costs[i]; `on` = valor del checkbox
// encendido, data-on) y data-key (opción con nombre, en el objeto de arriba).
// bool = checkbox; sel = valores de las opciones de un <select>; si no, un
// <input type="number">. El id del control es 'o-' + id | 'o-c' + cost | 'o-' + key.
// test/paridad_torneos.test.js verifica que coincide con OPT_GROUPS.
/** @typedef {{id?: number, cost?: number, key?: string, bool?: boolean, sel?: string[], on?: number}} Control */
// biome-ignore format: tabla compacta, en el orden de OPT_GROUPS
/** @type {readonly Control[]} */
export const CONTROLES_CLASICA = Object.freeze([
  // Physics
  { id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }, { id: 15 }, { id: 16 }, { id: 17 },
  { id: 18 }, { id: 19 }, { id: 20 }, { id: 10, bool: true }, { id: 21, bool: true },
  // Light and day/night
  { id: 33, bool: true }, { id: 34 }, { id: 40, bool: true }, { id: 35, bool: true },
  { id: 36 }, { id: 37, bool: true }, { id: 38 }, { id: 30, bool: true }, { id: 31 },
  { id: 32 },
  // Death and decay
  { id: 50, bool: true }, { id: 51 }, { id: 52 }, { id: 53, sel: ['0', '2', '3'] },
  { id: 54, bool: true }, { id: 55, bool: true }, { id: 56 },
  // Energy and vegetables
  { key: 'maxEnergy' }, { key: 'minVegs' }, { key: 'maxPopulation' }, { key: 'repopAmount' },
  { key: 'repopCooldown' }, { key: 'startChlr' }, { key: 'mutations', bool: true },
  { id: 60, sel: ['1', '0'] }, { id: 61 }, { id: 62 }, { id: 63 }, { id: 64 },
  // Game modes (F1 / rounds)
  { id: 90, bool: true }, { id: 91, bool: true }, { id: 97 }, { id: 98 }, { id: 99 },
  { id: 100 }, { id: 93, sel: ['0', '1', '2'] },
  // Costs
  { cost: 30 }, { cost: 31 }, { cost: 32 }, { cost: 24 }, { cost: 25 }, { cost: 20 },
  { cost: 21 }, { cost: 23 }, { cost: 22 }, { cost: 7 }, { cost: 5 }, { cost: 8 },
  { cost: 26 }, { cost: 27 }, { cost: 28 }, { cost: 29 },
  // Dynamic costs
  { cost: 56, bool: true, on: -1 }, { cost: 53 }, { cost: 55 }, { cost: 57 }, { cost: 58 },
  { cost: 61, bool: true }, { cost: 54 }, { cost: 62, bool: true }, { cost: 52 }, { cost: 59 },
  // Restrictions
  { id: 70, bool: true }, { id: 71, bool: true }, { id: 72, bool: true },
  // Shapes (vision and drift)
  { id: 80, bool: true }, { id: 81, bool: true }, { id: 82, bool: true },
  { id: 84, bool: true }, { id: 83, bool: true }, { id: 85 },
  // Fijos en la barra lateral: Graphs y Snapshots
  { id: 110 }, { id: 111, bool: true }, { id: 112, bool: true },
]);

/** id del control ('o-…') de un Control. @param {Control} c */
export const idControl = (c) =>
  `o-${c.id !== undefined ? c.id : c.cost !== undefined ? `c${c.cost}` : c.key}`;
const POR_ID = new Map(CONTROLES_CLASICA.map((c) => [idControl(c), c]));

// Tamaños del campo del original (OptionsForm.frm:4075-4099); o-fsize = n.
/** @param {number} n @returns {[number, number]} */
export function fieldSizeDims(n) {
  if (n === 1) return [9237, 6928];
  if (n <= 12) return [8000 * n, 6000 * n];
  return [8000 * 12 * (n - 12) * 2, 6000 * 12 * (n - 12) * 2];
}
const FSIZE_VALORES = Array.from({ length: 16 }, (_, n) => String(n));
const SHAPE_VALORES = ['wall', 'tor', 'h', 'v'];
// Presets de física de o-phys (OptionsForm.frm:4406-4453): id → valor.
export const PHYS_CLASICA = Object.freeze({
  fluido: { 14: 1e-7, 15: 0.0005, 16: 0, 17: 0, 19: 0 },
  solido: { 14: 0, 15: 0, 16: 0.6, 17: 0.4, 19: 2 },
  espacio: { 14: 0, 15: 0, 16: 0, 17: 0, 19: 0 },
});

// Lo que queda en .value al escribir v en un control (setInput): un
// <input type="number"> se queda con '' si v no es un número de coma flotante
// válido (saneamiento del navegador); un <select>, con '' si ninguna opción
// tiene ese valor.
const FLOAT_VALIDO = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;
/** @param {any} v */
const valorNumero = (v) => {
  const t = v === null ? '' : String(v);
  return FLOAT_VALIDO.test(t) ? t : '';
};
/** @param {any} v @param {string[]} valores */
const valorSelect = (v, valores) => (valores.includes(String(v)) ? String(v) : '');
/** optValue de la clásica sobre el .value de un control. @param {string} t */
const aNumero = (t) => parseFloat(t) || 0;

/**
 * Las opciones del reset de un partido: las reglas de la temporada (la foto
 * del panel, {id del control: valor}) escritas sobre `base` (las opciones
 * del panel antes del partido: {…nombradas, opts, costs, fieldW, fieldH},
 * la forma de collectOptions). Replica lgApplyRules + collectOptions:
 *   - las claves se aplican en orden; las que no son controles del panel se
 *     ignoran (como `if (!el) continue`);
 *   - o-fsize > 0 pone ancho y alto de fieldSizeDims y después o-fw/o-fh de
 *     la foto los pisan; o-shape da opts[2] y opts[3]; o-phys aplica su preset;
 *   - checkbox = !!valor (opts 1/0, costs `on` o 1 / 0, nombradas booleano);
 *     número o select: parseFloat del valor saneado, o 0;
 *   - lo que la foto no nombra (y los costes que el panel no muestra, que en
 *     la clásica salen en 0 del core recién creado) queda como en `base`.
 * Lanza ErrorLiga('no-base-options') sin base.
 * @param {Record<string, any>} rules
 * @param {any} base
 */
export function reglasAOpciones(rules, base) {
  if (!base || typeof base !== 'object') throw new ErrorLiga('no-base-options');
  const out = { ...base, opts: { ...(base.opts || {}) }, costs: { ...(base.costs || {}) } };
  /** @type {string | null} */
  let fw = null;
  /** @type {string | null} */
  let fh = null;
  const r = rules || {};
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (k === 'o-fsize') {
      const n = parseInt(valorSelect(v, FSIZE_VALORES), 10);
      if (n > 0) [fw, fh] = fieldSizeDims(n).map(String);
    } else if (k === 'o-fw') fw = valorNumero(v);
    else if (k === 'o-fh') fh = valorNumero(v);
    else if (k === 'o-shape') {
      const t = valorSelect(v, SHAPE_VALORES);
      out.opts[2] = t === 'tor' || t === 'v' ? 1 : 0;
      out.opts[3] = t === 'tor' || t === 'h' ? 1 : 0;
    } else if (k === 'o-phys') {
      const p = /** @type {Record<string, Record<number, number>>} */ (PHYS_CLASICA)[
        valorSelect(v, Object.keys(PHYS_CLASICA))
      ];
      if (p) for (const id of Object.keys(p)) out.opts[+id] = aNumero(valorNumero(p[+id]));
    } else {
      const c = POR_ID.get(k);
      if (!c) continue;
      let x;
      if (c.bool) {
        const on = !!v;
        x = c.key !== undefined ? on : c.cost !== undefined ? (on ? (c.on ?? 1) : 0) : on ? 1 : 0;
      } else x = aNumero(c.sel ? valorSelect(v, c.sel) : valorNumero(v));
      if (c.id !== undefined) out.opts[c.id] = x;
      else if (c.cost !== undefined) out.costs[c.cost] = x;
      else out[/** @type {string} */ (c.key)] = x;
    }
  }
  // lgApplyRules: o-fw y o-fh de la foto, al final (o-fsize los había rellenado).
  if (r['o-fw'] !== undefined) fw = valorNumero(r['o-fw']);
  if (r['o-fh'] !== undefined) fh = valorNumero(r['o-fh']);
  if (fw !== null) out.fieldW = parseFloat(fw) || 32000;
  if (fh !== null) out.fieldH = parseFloat(fh) || 32000;
  return out;
}

// ---- La siembra del reset -----------------------------------------------------------
// El alga de arranque de la clásica (PRESETS.alga): newSim la siembra en todo
// reinicio, también el de los partidos, "para que la repoblación tenga
// especie elegible".
export const ALGA_ARRANQUE = Object.freeze({
  name: 'Alga_Minimalis.txt',
  veg: true,
  qty: 15,
  nrg: 3000,
  color: '#30d030',
  dna: `' Alga Minimalis
' Gene 1 Reproduce
cond
*.nrg 5000 >
start
50 .repro store
stop

' Gene 2 turn
cond
*.fixpos 0 =
start
628 rnd 314 sub .aimdx store
stop
end
`,
});

/** La lista `species` del reset de la clásica (newSim). */
export function siembraArranque() {
  const a = ALGA_ARRANQUE;
  return [
    { dna: a.dna, name: a.name, veg: true, qty: a.qty, nrg: a.nrg, color: cssToVbColor(a.color) },
  ];
}

// Color CSS "#rrggbb" → Long BGR de VB6 (RGB() = r + g*256 + b*65536).
/** @param {string} css */
export function cssToVbColor(css) {
  const r = parseInt(css.slice(1, 3), 16);
  const g = parseInt(css.slice(3, 5), 16);
  const b = parseInt(css.slice(5, 7), 16);
  return r + g * 256 + b * 65536;
}

/**
 * @typedef {{name: string, src?: string, dna?: string, qty: number, color: string}} Luchador
 * @typedef {{nrg: number, rounds: number, wins: number, cap: number, capMode: string, popCap: number}} ValoresPartido
 * @typedef {{seed: number, rules: Record<string, any>, f1: {rounds: number, wins: number, cap: number,
 *   capMode: string, popCap: number}, species: any[]}} Plan
 */

// Todo lo necesario para lanzar el partido. fighters: lgLaunchList (ADN
// congelado); o: los valores del partido de la temporada; seed: la semilla
// (la nueva, o la del partido que se repite); rules: las reglas del mundo de
// la temporada, que el anfitrión convierte en las opciones del reset.
// Lanza ErrorLiga('no-dna', {name}) si a alguno le falta el ADN (antes de
// tocar la sim), como contestDna con src 'form'.
/** @param {Luchador[]} fighters @param {ValoresPartido} o @param {number} seed @param {Record<string, any>} [rules] @returns {Plan} */
export function planPartido(fighters, o, seed, rules = {}) {
  const dnas = [];
  for (const r of fighters) {
    if (!r.dna) throw new ErrorLiga('no-dna', { name: r.name });
    dnas.push(r.dna);
  }
  return {
    seed,
    rules,
    f1: {
      rounds: o.rounds,
      wins: o.wins || 0,
      cap: o.cap || 0,
      capMode: o.capMode || 'pop',
      popCap: o.popCap || 0,
    },
    species: fighters.map((r, i) => ({
      dna: dnas[i],
      name: `${r.name}.txt`,
      veg: false,
      qty: r.qty,
      nrg: o.nrg,
      color: cssToVbColor(r.color),
    })),
  };
}

// Las opciones de modo de juego que el partido fija sobre las del reset
// (contestLaunch): F1 encendido, rondas (97), tope de victorias (98,
// Maxrounds) y 99/100 en 0. Modifica y devuelve `opts`.
/** @param {Record<number, number>} opts @param {Plan} plan */
export function fijarModoF1(opts, plan) {
  opts[91] = 1; // Modo F1
  opts[97] = parseFloat(String(plan.f1.rounds)) || 0;
  opts[98] = parseFloat(String(plan.f1.wins || 0)) || 0; // Maxrounds
  opts[99] = 0;
  opts[100] = 0;
  return opts;
}

// Los topes del Canal del partido (van al worker aparte de las opciones).
/** @param {Plan} plan */
export const mensajesTopes = (plan) => [
  { t: 'f1-cap', cycles: plan.f1.cap || 0, mode: plan.f1.capMode || 'pop' },
  { t: 'f1-popcap', n: plan.f1.popCap || 0 }, // tope de bots por especie
];

// Los mensajes al worker, en orden. opciones (obligatorias): las del reset,
// reglasAOpciones(plan.rules, base del panel); se copian y se les fijan las
// de modo de juego. base: la siembra del reset; por defecto la de la clásica
// (siembraArranque(), el alga), que siembra el alga en todo reinicio.
// Lanza ErrorLiga('no-options') sin opciones y ('bad-base') si base no es
// una lista.
// o.limpio (de la nueva, C15; sin él, los mensajes de la clásica tal cual):
// el reset lleva `limpio: true` (el partido da lo mismo en cualquier worker,
// nuevo o usado) y los topes (f1-cap, f1-popcap) van DESPUÉS del reset,
// porque el reset limpio los vuelve a 0. Antes del primer tick da lo mismo:
// los topes solo se miran al correr.
/** @param {Plan} plan @param {any} opciones @param {any[]} [base] @param {{limpio?: boolean}} [o] */
export function mensajesPartido(plan, opciones, base = siembraArranque(), o = {}) {
  if (!opciones || typeof opciones !== 'object') throw new ErrorLiga('no-options');
  if (!Array.isArray(base)) throw new ErrorLiga('bad-base');
  const options = { ...opciones, opts: fijarModoF1({ ...(opciones.opts || {}) }, plan) };
  const reset = { t: 'reset', seed: plan.seed, quietF1: true, options, species: base };
  const run0 = { t: 'run', running: false };
  const arranque = o.limpio
    ? [run0, { ...reset, limpio: true }, ...mensajesTopes(plan)]
    : [...mensajesTopes(plan), run0, reset];
  return [
    ...arranque,
    ...plan.species.map((sp) => ({ t: 'seed-species', sp })),
    { t: 'f1start' }, // FindSpecies
    { t: 'run', running: true },
  ];
}

// Nombre de quien sumó una victoria entre dos frames (o '').
/** @param {number[] | null} prev @param {{sp: {name: string, wins: number}[]}} f1 */
export function contestRoundWinner(prev, f1) {
  if (!prev) return '';
  const s = f1.sp.find((x, i) => x.wins > (prev[i] || 0));
  return s ? s.name : '';
}

// ---- El partido en curso ---------------------------------------------------------
/**
 * @typedef {{league: string, season: number, fighters: any[], label: any, ready: boolean,
 *   capRounds: number, cycles: number, f1: any, lastWins: number[] | null, replay: any,
 *   seed?: number}} Vivo
 */

/** @param {{league: string, season: number, fighters: any[], label: any, replay?: any}} o @returns {Vivo} */
export function nuevoVivo(o) {
  return {
    league: o.league,
    season: o.season,
    fighters: o.fighters,
    label: o.label,
    ready: false,
    capRounds: 0,
    cycles: 0,
    f1: null,
    lastWins: null,
    replay: o.replay || null,
  };
}

// Un mensaje del worker para el partido en curso (leagueOnMessage). Hasta
// la respuesta al censo del partido (f1-started) llegan mensajes y frames de
// la sim anterior: se ignoran. Actualiza m y devuelve qué hacer:
//   null · {t: 'registrar', winner, note?} · {t: 'tope'} (una ronda llegó al
//   tope de ciclos; el criterio es fmt.capMode).
/** @param {Vivo} m @param {any} msg */
export function interpretarMensaje(m, msg) {
  if (msg.t === 'f1-started') {
    const out = !m.ready && !msg.n ? { t: 'registrar', winner: '', note: NOTA_CENSO_VACIO } : null;
    m.ready = true;
    return out;
  }
  if (!m.ready) return null;
  if (msg.t === 'f1-note' && msg.kind === 'single')
    return { t: 'registrar', winner: '', note: NOTA_UNA_ESPECIE };
  if (msg.t === 'f1-note' && msg.kind === 'cap') {
    m.capRounds++;
    return { t: 'tope' };
  }
  if (msg.t === 'f1-over') {
    // El worker manda el marcador final y los ciclos con el aviso.
    if (msg.f1) m.f1 = msg.f1;
    if (msg.cycles !== undefined) m.cycles = msg.cycles;
    return { t: 'registrar', winner: msg.winner, note: undefined };
  }
  return null;
}

// Victorias de cada luchador y, de esas, las ganadas por el tope de ciclos
// (worker.js las cuenta; las usa el desempate del suizo).
/** @param {Vivo} m */
export function marcadorFinal(m) {
  const sp = m.f1?.sp || [];
  /** @param {string} n */
  const of = (n) => sp.find((/** @type {any} */ s) => s.name === n) || {};
  return {
    wins: m.fighters.map((e) => of(e.name).wins || 0),
    capWins: m.fighters.map((e) => of(e.name).capWins || 0),
  };
}

// Compara una repetición con lo registrado (ganador, victorias y ciclos).
// Los partidos de antes de que f1-over trajera el marcador (0 ciclos) solo
// guardan el ganador. Devuelve {diffs: [{field, got, was}], full}.
/** @param {any} m @param {{winner: string, wins: number[], cycles: number}} got */
export function compararRepeticion(m, got) {
  const diffs = [];
  const full = !!m.cycles;
  if (got.winner !== (m.winner || ''))
    diffs.push({ field: 'winner', got: got.winner, was: m.winner || '' });
  if (full && (m.wins || []).join() !== got.wins.join())
    diffs.push({ field: 'wins', got: got.wins, was: m.wins || [] });
  if (full && m.cycles !== got.cycles)
    diffs.push({ field: 'cycles', got: got.cycles, was: m.cycles });
  return { diffs, full };
}

// Las stats de un frame durante el partido (tnOnStats): quién ganó la ronda
// que acaba de terminar (o '') y el número de esa ronda; null si el frame no
// es del partido. Actualiza m.lastWins.
/** @param {Vivo | null} m @param {any} st */
export function alFrame(m, st) {
  if (!m?.ready || !st.f1) return null;
  const rw = contestRoundWinner(m.lastWins, st.f1);
  m.lastWins = st.f1.sp.map((/** @type {any} */ s) => s.wins);
  return { roundWinner: rw, round: st.f1.contests };
}
