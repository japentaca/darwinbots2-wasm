// @ts-check
// Decodificación del frame que publica engine/worker.js. Puro (sin DOM):
// la cabecera y los offsets salen de engine/protocolo.js; acá se nombran los
// campos de cada registro (los de db_sim_dump_* en port/wasm/dbcore_api.cpp).

import {
  EXTRA_MONITOR,
  EXTRA_SKINS,
  H,
  HEADER,
  REG,
  seccionesFrame,
} from '../../../engine/protocolo.js';

/** Registro de bot (db_sim_dump_bots, REG.bot floats). */
export const BOT = Object.freeze({
  idx: 0,
  x: 1,
  y: 2,
  r: 3,
  aim: 4,
  nrg: 5,
  /** color de la especie, Long BGR */
  color: 6,
  flags: 7,
  body: 8,
  waste: 9,
  venom: 10,
  shell: 11,
  slime: 12,
  poison: 13,
  vtimer: 14,
  chlr: 15,
  lastup: 16,
  lastdown: 17,
  lastleft: 18,
  lastright: 19,
});

/** Bits de BOT.flags. */
export const FLAG = Object.freeze({ veg: 1, fixed: 2, corpse: 4, multibot: 8, highlight: 16 });

/** Registro de shot (REG.shot). */
export const SHOT = Object.freeze({
  x: 0,
  y: 1,
  vx: 2,
  vy: 3,
  color: 4,
  tipo: 5,
  flash: 6,
  ox: 7,
  oy: 8,
});

/** Registro de tie (REG.tie). tipo 3 = dura. */
export const TIE = Object.freeze({ x1: 0, y1: 1, x2: 2, y2: 3, tipo: 4 });
export const TIE_DURA = 3;

/** Registro de obstáculo (REG.obs). */
export const OBS = Object.freeze({ x: 0, y: 1, w: 2, h: 3, color: 4 });

/** Registro de teleporter (REG.tp). */
export const TP = Object.freeze({ x: 0, y: 1, w: 2, h: 3, color: 4, flags: 5, enviados: 6 });
export const TP_FLAG = Object.freeze({ entrada: 1, salida: 2, local: 4, internet: 8 });

/** Bloque del bot con foco (REG.focus = 8 de cabecera + 9 ojos × 4). */
export const FOCO = Object.freeze({
  x: 0,
  y: 1,
  aim: 2,
  r: 3,
  ojoFoco: 4,
  edad: 5,
  nrg: 6,
  body: 7,
  ojos: 8,
});
export const OJO = Object.freeze({ dir: 0, medio: 1, esd: 2, visto: 3 });
export const REG_OJO = 4;
export const N_OJOS = 9;

/** Registro extendido de la vista enriquecida (REG.vis, misma fila que el bot). */
export const VIS = Object.freeze({
  abs: 0,
  madre: 1,
  gen: 2,
  mut: 3,
  edad: 4,
  dnaLen: 5,
  kills: 6,
  acciones: 7,
  estado: 8,
  ojosVen: 9,
  especie: 10,
  ties: 11,
  /** 9 floats: dirección de cada ojo */
  dirOjos: 12,
  /** −1 = sin dato */
  gendist: 21,
  shotTipo: 22,
});

/** Bits de VIS.estado. */
export const ESTADO = Object.freeze({
  paralizado: 1,
  envenenado: 2,
  virus: 4,
  fertilizado: 8,
  nacido: 16,
});

/** Evento de nacimiento (REG.evento). mx/my = NaN si la madre no está. */
export const NACE = Object.freeze({ x: 0, y: 1, mx: 2, my: 3, color: 4, abs: 5 });
/** Evento de muerte (REG.evento). tp = 1 si salió por un teleporter. */
export const MUERE = Object.freeze({ x: 0, y: 1, r: 2, color: 3, abs: 4, tp: 5 });

/**
 * @typedef {object} Frame
 * @property {Float32Array} v
 * @property {number} W        ancho del campo
 * @property {number} H        alto del campo
 * @property {number} nBots
 * @property {number} nShots
 * @property {number} nTies
 * @property {number} nObs
 * @property {number} nTps
 * @property {number} foco     índice del bot con foco y volcado válido (0 = no)
 * @property {boolean} rica    viaja el bloque de la vista enriquecida
 * @property {number} nNac
 * @property {number} nMue
 * @property {number} ciclo
 * @property {boolean} monitor viaja el bloque del monitor RGB (no se dibuja)
 * @property {boolean} skins   viaja el bloque de skins (no se dibuja)
 * @property {import('../../../engine/protocolo.js').SeccionesFrame} of
 */

/**
 * Lee la cabecera y los offsets de un frame. El búfer puede ser más largo que
 * lo usado (sale de un pool); si es más corto, error.
 * @param {Float32Array} v
 * @returns {Frame}
 */
export function decodificarFrame(v) {
  if (v.length < HEADER) throw new RangeError(`frame corto: ${v.length} floats`);
  const of = seccionesFrame(v);
  if (of.fin > v.length) throw new RangeError(`frame corto: ${v.length} < ${of.fin} floats`);
  const extras = v[H.extras];
  return {
    v,
    W: v[H.fieldW],
    H: v[H.fieldH],
    nBots: v[H.nBots],
    nShots: v[H.nShots],
    nTies: v[H.nTies],
    nObs: v[H.nObs],
    nTps: v[H.nTps],
    foco: v[H.focus],
    rica: v[H.rich] === 1,
    nNac: v[H.rich] === 1 ? v[H.nBirths] : 0,
    nMue: v[H.rich] === 1 ? v[H.nDeaths] : 0,
    ciclo: v[H.cycle],
    monitor: (extras & EXTRA_MONITOR) !== 0,
    skins: (extras & EXTRA_SKINS) !== 0,
    of,
  };
}

/** Offset del bot i (fila) en el frame. @param {Frame} f @param {number} i */
export const offBot = (f, i) => f.of.bots + i * REG.bot;
/** Offset del registro enriquecido del bot i. @param {Frame} f @param {number} i */
export const offVis = (f, i) => f.of.vis + i * REG.vis;
/** @param {Frame} f @param {number} i */
export const offShot = (f, i) => f.of.shots + i * REG.shot;
/** @param {Frame} f @param {number} i */
export const offTie = (f, i) => f.of.ties + i * REG.tie;
/** @param {Frame} f @param {number} i */
export const offObs = (f, i) => f.of.obs + i * REG.obs;
/** @param {Frame} f @param {number} i */
export const offTp = (f, i) => f.of.tps + i * REG.tp;
/** @param {Frame} f @param {number} i */
export const offNace = (f, i) => f.of.births + i * REG.evento;
/** @param {Frame} f @param {number} i */
export const offMuere = (f, i) => f.of.deaths + i * REG.evento;

/**
 * @typedef {object} FocoVivo
 * @property {number} n
 * @property {number} x
 * @property {number} y
 * @property {number} aim
 * @property {number} r
 * @property {number} edad
 * @property {number} nrg
 * @property {number} body
 */

/**
 * Datos en vivo del bot con foco, o null si el frame no los trae.
 * @param {Frame} f
 * @returns {FocoVivo | null}
 */
export function focoVivo(f) {
  if (!(f.foco > 0) || f.of.focus < 0) return null;
  const v = f.v;
  const o = f.of.focus;
  return {
    n: f.foco,
    x: v[o + FOCO.x],
    y: v[o + FOCO.y],
    aim: v[o + FOCO.aim],
    r: v[o + FOCO.r],
    edad: v[o + FOCO.edad],
    nrg: v[o + FOCO.nrg],
    body: v[o + FOCO.body],
  };
}

export { H, HEADER, REG };
