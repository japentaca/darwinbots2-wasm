// @ts-check
// Layout del frame que publica el worker (engine/worker.js → página).
//
// El frame es UN solo ArrayBuffer transferible leído como Float32Array:
// una cabecera de 13 floats y después los bloques, en este orden:
//   bots nBots×20, shots nShots×9, ties nTies×5, obstáculos nObs×5,
//   teleporters nTps×7;
//   si focus > 0, el bloque de foco (44 floats de db_sim_dump_focus);
//   si rich, nBots×24 de db_sim_dump_bots_vis (misma fila que el bot) +
//   nBirths×6 + nDeaths×6 de db_sim_vis_events;
//   si extras&1, nBots×3 de db_sim_dump_monitor (E8);
//   si extras&2, nBots×9 de db_sim_dump_skins (E8).
// (mismos registros que db_sim_dump_* — ver port/wasm/dbcore_api.cpp)
//
// El búfer sale de un pool y puede ser más largo que lo usado: el largo real
// es `largoFrame(v)`.

/** Índices de la cabecera. */
export const H = Object.freeze({
  fieldW: 0,
  fieldH: 1,
  nBots: 2,
  nShots: 3,
  nTies: 4,
  nObs: 5,
  nTps: 6,
  /** índice del bot seleccionado con volcado válido; 0 = no */
  focus: 7,
  /** E6.5: 1 si viaja el bloque de la vista enriquecida */
  rich: 8,
  nBirths: 9,
  nDeaths: 10,
  cycle: 11,
  /** E8: bit0 monitor, bit1 skins */
  extras: 12,
});

/** Floats de la cabecera. */
export const HEADER = 13;

/** Floats por registro de cada bloque. */
export const REG = Object.freeze({
  bot: 20,
  shot: 9,
  tie: 5,
  obs: 5,
  tp: 7,
  focus: 44,
  vis: 24,
  evento: 6,
  monitor: 3,
  skin: 9,
});

/** Bits de `extras`. */
export const EXTRA_MONITOR = 1;
export const EXTRA_SKINS = 2;

/** Tope de nacimientos (y de muertes) por frame en la vista enriquecida. */
export const VIS_MAX_EVENTS = 2000;

/**
 * @typedef {object} SeccionesFrame
 * @property {number} bots
 * @property {number} shots
 * @property {number} ties
 * @property {number} obs
 * @property {number} tps
 * @property {number} focus   -1 si no viaja
 * @property {number} vis     -1 si no viaja
 * @property {number} births  -1 si no viaja
 * @property {number} deaths  -1 si no viaja
 * @property {number} monitor -1 si no viaja
 * @property {number} skins   -1 si no viaja
 * @property {number} fin     largo usado (floats)
 */

/**
 * Offsets (en floats) de cada bloque del frame, a partir de su cabecera.
 * @param {ArrayLike<number>} v
 * @returns {SeccionesFrame}
 */
export function seccionesFrame(v) {
  const nB = v[H.nBots];
  let off = HEADER;
  const bots = off;
  off += nB * REG.bot;
  const shots = off;
  off += v[H.nShots] * REG.shot;
  const ties = off;
  off += v[H.nTies] * REG.tie;
  const obs = off;
  off += v[H.nObs] * REG.obs;
  const tps = off;
  off += v[H.nTps] * REG.tp;
  let focus = -1;
  if (v[H.focus] > 0) {
    focus = off;
    off += REG.focus;
  }
  let vis = -1;
  let births = -1;
  let deaths = -1;
  if (v[H.rich]) {
    vis = off;
    off += nB * REG.vis;
    births = off;
    off += v[H.nBirths] * REG.evento;
    deaths = off;
    off += v[H.nDeaths] * REG.evento;
  }
  let monitor = -1;
  if (v[H.extras] & EXTRA_MONITOR) {
    monitor = off;
    off += nB * REG.monitor;
  }
  let skins = -1;
  if (v[H.extras] & EXTRA_SKINS) {
    skins = off;
    off += nB * REG.skin;
  }
  return { bots, shots, ties, obs, tps, focus, vis, births, deaths, monitor, skins, fin: off };
}

/**
 * Floats usados del frame (el búfer del pool puede ser más largo).
 * @param {ArrayLike<number>} v
 */
export function largoFrame(v) {
  return seccionesFrame(v).fin;
}
