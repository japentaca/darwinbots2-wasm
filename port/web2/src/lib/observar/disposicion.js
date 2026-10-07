// @ts-check
// Disposiciones y pestañas de Observar (PLAN-TORNEO-EN-CURSO.md, TC3: T6 y
// T7). Lógica pura: qué disposición vale, cuál se recuerda y a qué pestaña
// del panel lateral se salta cuando empieza o termina un torneo o cuando se
// elige o se suelta un bot. Observar.svelte la cablea.

/** ▣ Campo: el mundo solo · ◧ Mixta: el mundo y el panel · ▤ Datos: el panel y el mundo en miniatura. */
export const DISPOSICIONES = /** @type {const} */ (['campo', 'mixta', 'datos']);
/** @typedef {(typeof DISPOSICIONES)[number]} Disposicion */
/** @typedef {'vivo' | 'torneo' | 'bot'} Pestaña */

/** localStorage: la disposición elegida. */
export const KV_DISPOSICION = 'darwinbots2.observar-disposicion';

/** @param {any} x @returns {Disposicion} */
export function disposicionValida(x) {
  return DISPOSICIONES.includes(x) ? x : 'mixta';
}

/** Disposición guardada en este navegador (Mixta si no hay o no hay almacenamiento). */
export function disposicionGuardada() {
  try {
    return disposicionValida(localStorage.getItem(KV_DISPOSICION));
  } catch {
    return 'mixta';
  }
}

/** @param {Disposicion} d */
export function guardarDisposicion(d) {
  try {
    localStorage.setItem(KV_DISPOSICION, d);
  } catch {
    // sin almacenamiento: no se recuerda
  }
}

/**
 * Las pestañas del panel lateral: «Torneo» solo con un torneo en curso.
 * @param {boolean} torneo
 * @returns {Pestaña[]}
 */
export function pestañasPanel(torneo) {
  return torneo ? ['vivo', 'torneo', 'bot'] : ['vivo', 'bot'];
}

/**
 * La pestaña al abrir Observar: el bot con foco, si lo hay; si no, el
 * torneo en curso; si no, En vivo.
 * @param {boolean} torneo @param {boolean} bot
 * @returns {Pestaña}
 */
export function pestañaInicial(torneo, bot) {
  return bot ? 'bot' : torneo ? 'torneo' : 'vivo';
}

/**
 * La pestaña después de un cambio: empieza el torneo → Torneo; se elige un
 * bot → Bot; termina el torneo o se suelta el bot estando en su pestaña →
 * la que corresponda sin él. Cualquier otra cosa deja la que está.
 * @param {Pestaña} actual
 * @param {{ torneo: boolean, bot: boolean }} antes
 * @param {{ torneo: boolean, bot: boolean }} ahora
 * @returns {Pestaña}
 */
export function pestañaTras(actual, antes, ahora) {
  if (ahora.bot && !antes.bot) return 'bot';
  if (ahora.torneo && !antes.torneo) return 'torneo';
  if (actual === 'bot' && antes.bot && !ahora.bot) return ahora.torneo ? 'torneo' : 'vivo';
  if (actual === 'torneo' && !ahora.torneo) return 'vivo';
  return actual;
}
