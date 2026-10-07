// @ts-check
// Estado del marcador flotante de torneo (puro, N4.4): si está plegado a un
// chip (se recuerda en este navegador), en qué rutas se ve y dónde va.

import { parsearHash } from '../../router.js';

export const CLAVE_PLEGADO = 'darwinbots2.marcador.plegado';

/**
 * @typedef {{getItem: (k: string) => string | null,
 *   setItem: (k: string, v: string) => void}} Almacen
 */

/** @returns {Almacen | null} */
function almacenPorDefecto() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * ¿Quedó plegado la última vez? Sin almacenamiento o sin dato: desplegado.
 * @param {Almacen | null} [almacen]
 */
export function leerPlegado(almacen = almacenPorDefecto()) {
  try {
    return almacen?.getItem(CLAVE_PLEGADO) === '1';
  } catch {
    return false;
  }
}

/**
 * Recuerda el estado (si no se puede, vale solo para esta sesión).
 * @param {boolean} plegado @param {Almacen | null} [almacen]
 */
export function guardarPlegado(plegado, almacen = almacenPorDefecto()) {
  try {
    almacen?.setItem(CLAVE_PLEGADO, plegado ? '1' : '0');
  } catch {
    // modo privado o almacenamiento bloqueado
  }
}

/**
 * ¿Se ve el marcador flotante? No en Competir (el panel de juego ya lo
 * muestra) ni en Observar con el avance automático del torneo encendido
 * (va integrado en el rótulo). En pantalla angosta con el avance encendido,
 * en ninguna sección: la franja ya dice qué pelea se juega y «Ver» lleva al
 * marcador; el flotante tapaba el contenido (TC5).
 * @param {string} hash @param {boolean} hayPartido @param {boolean} [avance]
 * @param {boolean} [angosta]
 */
export function flotanteVisible(hash, hayPartido, avance = false, angosta = false) {
  if (!hayPartido) return false;
  if (angosta && avance) return false;
  const { seccion } = parsearHash(hash);
  if (seccion === 'competir') return false;
  if (seccion === 'observar' && avance) return false;
  return true;
}

/** Pantalla angosta (teléfono): el corte de la franja del torneo. */
export const ANGOSTA = '(max-width: 640px)';

/**
 * Estado plegado al entrar en una sección: en Observar arranca plegado (el
 * flotante taparía el mundo y el inspector); en pantalla angosta, en todas
 * (taparía el contenido, PLAN-TORNEO-EN-CURSO.md TC5); en las demás, lo
 * recordado.
 * @param {string} hash @param {boolean} recordado @param {boolean} [angosta]
 */
export function plegadoInicial(hash, recordado, angosta = false) {
  return angosta || parsearHash(hash).seccion === 'observar' ? true : recordado;
}

/** Separación del flotante respecto de los bordes y del contenido (px). */
export const MARGEN = 10;
/** Separación del borde derecho de la ventana (px). */
export const MARGEN_DERECHO = 16;

/**
 * Posición del flotante (position: fixed). `arribaContenido` es el borde
 * superior de <main> (debajo de la barra y del aviso, con su alto real);
 * `lateral` el panel derecho de Observar (inspector o «En vivo») si está
 * a la derecha, al lado del mundo: el flotante se corre a su izquierda para
 * no taparlo. Con el panel debajo del mundo (pantalla angosta) se ignora.
 * @param {{arribaContenido: number, anchoVentana: number,
 *   lateral?: {left: number, top: number, width: number} | null}} m
 * @returns {{top: number, right: number}}
 */
export function posicionMarcador({ arribaContenido, anchoVentana, lateral }) {
  const top = Math.max(0, Math.round(arribaContenido)) + MARGEN;
  let right = MARGEN_DERECHO;
  const alLado =
    lateral &&
    lateral.width > 0 &&
    lateral.left > anchoVentana / 2 &&
    lateral.top <= arribaContenido + 1;
  if (alLado) right = Math.max(0, Math.round(anchoVentana - lateral.left)) + MARGEN_DERECHO;
  return { top, right };
}

/**
 * Resumen del partido para lectores de pantalla: cambia una vez por ronda
 * (no con cada refresco de la tabla). `f1` = stats.f1 del worker.
 * @param {{contests: number, minrounds: number, over?: boolean} | null | undefined} f1
 * @returns {{fin: true} | {fin: false, ronda: number, de: number} | null}
 */
export function resumenRonda(f1) {
  if (!f1) return null;
  if (f1.over) return { fin: true };
  return { fin: false, ronda: Math.min(f1.contests + 1, f1.minrounds), de: f1.minrounds };
}
