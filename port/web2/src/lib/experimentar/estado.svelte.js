// @ts-check
// Estado de Experimentar que sobrevive a cambiar de pantalla (el borrador
// no se pierde al ir a Observar y volver) y los escenarios propios (store
// 'escenarios' de darwinbots2), sobre la conexión única de la página
// (src/lib/sim/almacen.svelte.js; sus avisos, en estadoAlmacen).

import { almacen } from '../sim/almacen.svelte.js';
import { crearPropios } from './propios.js';

/** @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario */

class EstadoExperimentar {
  /** @type {Escenario | null} */
  borrador = $state.raw(null);
  /** id del escenario del que salió el borrador */
  baseId = $state('');
  /** id de la ruta #/experimentar/<id> ya abierta (no se reabre al volver) */
  rutaId = '';
  /**
   * @type {unknown} escenario (objeto de la corrida) de la última corrida
   * que el borrador tuvo en cuenta (sin reactividad): si la de la página es
   * otra, empezó una corrida nueva
   */
  escCorrida = null;
  /**
   * @type {Escenario | null} foto de lo que el borrador tiene «aplicado»: el
   * escenario efectivo de la corrida de la que salió (al armarlo o al
   * aplicar) o el escenario elegido. Editado = con diferencias respecto de
   * la foto (sin reactividad)
   */
  foto = null;
  /** texto del campo semilla */
  semilla = $state('');
}

export const estadoExp = new EstadoExperimentar();

/** @type {ReturnType<typeof crearPropios> | null} */
let propios = null;

/** Escenarios propios (la base se abre en el primer uso). */
export function escenariosPropios() {
  propios ??= crearPropios(almacen());
  return propios;
}
