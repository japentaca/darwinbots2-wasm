// @ts-check
// Destino del chip de trabajos de la barra superior (puro, N4.4).
//
// El chip cuenta los trabajos en curso o, si no hay, los avisos de los que
// terminaron; al hacer clic lleva a donde se ven:
//   - rondas de torneo (tipo 'ronda') → #/competir, o #/competir/<liga> si
//     el trabajo trae la liga (params.league): abre ese torneo;
//   - réplicas y cualquier otro tipo → #/analizar/actual/comparar.
// El destino sigue al texto del chip: con trabajos en curso, el trabajo en
// cola creado más recientemente (campo `creado`); sin trabajos en curso, el
// aviso más reciente (el último: se agregan al terminar cada trabajo). El
// tipo y la liga de un aviso salen del aviso si los trae o, si no, del
// trabajo de la lista con el mismo id; sin datos, Comparar.

// Sin importar engine/cola.js ni engine/rondas.js: la barra va en el chunk
// principal y ellos no (test/pulido.test.js comprueba que las constantes
// coinciden).
import { hashDe } from '../../router.js';
import { rutaAnalizar } from '../analizar/ruta.js';

/**
 * @typedef {{id: string, tipo?: string, params?: any, estado?: string,
 *   creado?: string, actualizado?: string}} TrabajoChip
 * @typedef {{id: string, tipo?: string, liga?: string}} AvisoChip
 */

/** Tipo de trabajo de las rondas de torneo (= TIPO_RONDA de engine/rondas.js). */
export const TIPO_RONDA = 'ronda';
/** Estados de un trabajo en cola (= ACTIVOS de engine/cola.js). */
export const ACTIVOS = Object.freeze(['pendiente', 'corriendo']);

/** Hash de Comparar (el destino de siempre). */
export const DESTINO_COMPARAR = rutaAnalizar('actual', 'comparar');

/**
 * Hash al que lleva un trabajo según su tipo.
 * @param {string | undefined} tipo @param {unknown} liga
 */
export function destinoDeTipo(tipo, liga) {
  if (tipo !== TIPO_RONDA) return DESTINO_COMPARAR;
  return typeof liga === 'string' && liga ? hashDe('competir', liga) : hashDe('competir');
}

/**
 * Destino del chip.
 * @param {TrabajoChip[]} lista trabajos de la cola (estadoTrabajos.lista)
 * @param {AvisoChip[]} avisos avisos pendientes, del más viejo al más nuevo
 * @returns {string} hash
 */
export function destinoChip(lista, avisos) {
  const activos = lista.filter((x) => ACTIVOS.includes(String(x.estado)));
  if (activos.length) {
    let ultimo = activos[0];
    for (const x of activos) if ((x.creado || '') >= (ultimo.creado || '')) ultimo = x;
    return destinoDeTipo(ultimo.tipo, ultimo.params?.league);
  }
  if (!avisos.length) return DESTINO_COMPARAR;
  const a = avisos[avisos.length - 1];
  const tr = lista.find((x) => x.id === a.id);
  return destinoDeTipo(a.tipo ?? tr?.tipo, a.liga ?? tr?.params?.league);
}
