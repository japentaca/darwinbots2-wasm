// @ts-check
// Tarjeta «Hallazgos» del Panel de Analizar (puro): los detectores del
// resumen automático (engine/detectors.js) sobre la historia de la fuente,
// con la misma frase que escribe el informe (engine/report/textos.js:
// `hallazgo.<clave>` formateado por `traductor`). A diferencia del informe
// (decisión 11: si no hay hallazgos no escribe), la interfaz sí dice que no
// hay (lo pone Panel.svelte con t()).

import { agruparHallazgos, detectar } from '../../../engine/detectors.js';
import { idiomaValido, traductor } from '../../../engine/report/textos.js';

/** Con la corrida actual en vivo, se recalculan a lo sumo cada tanto (ms). */
export const REFRESCO_HALLAZGOS_MS = 5000;

/**
 * Hallazgos de una historia ([] si los detectores fallan con una historia
 * incompleta: la tarjeta no debe romper el Panel).
 * @param {import('../../../engine/detectors.js').HistoriaLeible} h
 * @returns {import('../../../engine/detectors.js').Hallazgo[]}
 */
export function hallazgosDe(h) {
  try {
    return detectar(h);
  } catch {
    return [];
  }
}

/**
 * Lo que muestra la tarjeta: los hallazgos con lo repetitivo agrupado, igual
 * que el resumen del informe (agruparHallazgos: extinciones simultáneas en
 * una frase, la especie que desaparece y vuelve en una, y un tope de frases
 * por tipo). [] si algo falla.
 * @param {import('../../../engine/detectors.js').HistoriaLeible} h
 * @returns {import('../../../engine/detectors.js').HallazgoAgrupado[]}
 */
export function hallazgosTarjeta(h) {
  try {
    return agruparHallazgos(hallazgosDe(h));
  } catch {
    return [];
  }
}

/**
 * Frase de un hallazgo en un idioma, la misma del informe ('' si falta).
 * @param {import('../../../engine/detectors.js').Hallazgo} x @param {string} idioma
 */
export function textoHallazgo(x, idioma) {
  try {
    return traductor(idiomaValido(idioma)).tx(`hallazgo.${x.clave}`, x.params);
  } catch {
    return '';
  }
}

/**
 * Clave estable de un hallazgo (para el #each y para saber si su marca es
 * la elegida): no depende de su posición en la lista.
 * @param {import('../../../engine/detectors.js').Hallazgo} x
 */
export function claveHallazgo(x) {
  return `h:${x.clave}:${x.params.especie ?? ''}:${x.desde}`;
}

/**
 * ¿Hay que recalcular? Siempre con otra corrida o con una guardada (se
 * calcula una vez); con la actual, si pasó el plazo desde el último cálculo.
 * @param {{id: string, en: number}} ultimo  corrida y momento del último cálculo
 * @param {string} id @param {boolean} vivo @param {number} ahora
 * @returns {number} 0 = ya; > 0 = ms que faltan
 */
export function esperaHallazgos(ultimo, id, vivo, ahora) {
  if (id !== ultimo.id) return 0;
  if (!vivo) return Number.POSITIVE_INFINITY;
  return Math.max(0, REFRESCO_HALLAZGOS_MS - (ahora - ultimo.en));
}
