// @ts-check
// Dependencias de crearTorneos (engine/torneos.js) para tests y smokes: los
// valores por defecto que engine/ ya no pone solo (reglasBase e
// inventario.color son obligatorios allí). Nada de esto es de la interfaz.

import { LG_NO_COLOR } from '../../engine/league.js';

/** Inventario vacío: sin bots y con el color de reserva de la clásica. */
export const inventarioVacio = () => ({
  items: [],
  sel: new Set(),
  sets: new Map(),
  userRec: () => ({ fav: false, tags: [] }),
  fetchDna: async () => {
    throw new Error('no inventory');
  },
  color: () => LG_NO_COLOR,
});

/**
 * deps completas: reglas base vacías e inventario vacío salvo lo que se pase.
 * @param {Record<string, any>} deps
 * @returns {any}
 */
export function depsDePrueba(deps) {
  return { reglasBase: () => ({}), inventario: inventarioVacio(), ...deps };
}
