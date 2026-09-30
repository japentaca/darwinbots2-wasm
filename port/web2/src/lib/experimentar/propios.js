// @ts-check
// Escenarios propios en el almacén 'escenarios' de darwinbots2 (decisiones
// 12 y 17; engine/almacen.js). El almacén se inyecta: IndexedDB en el
// navegador, almacenMemoria() en los tests. Lo que se guarda pasa por
// normalizarPropio (un propio nunca usa el id de uno de fábrica).

import { esDeFabrica, normalizarPropio } from '../../../engine/escenarios/fabrica.js';
import { textoEn } from '../../../engine/escenarios/index.js';

export const ST_ESCENARIOS = 'escenarios';

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 */

/**
 * @param {import('../../../engine/almacen.js').Almacen} almacen
 */
export function crearPropios(almacen) {
  return {
    /**
     * Los propios, por nombre. Los registros que ya no validan (un formato
     * viejo) se cuentan aparte y no se listan.
     * @param {'es' | 'en'} [idioma]
     * @returns {Promise<{escenarios: Escenario[], invalidos: number}>}
     */
    async listar(idioma = 'es') {
      const filas = await almacen.list(ST_ESCENARIOS);
      /** @type {Escenario[]} */
      const escenarios = [];
      let invalidos = 0;
      for (const f of filas) {
        try {
          escenarios.push(normalizarPropio(f));
        } catch {
          invalidos++;
        }
      }
      escenarios.sort(
        (a, b) =>
          textoEn(a.nombre, idioma).localeCompare(textoEn(b.nombre, idioma), idioma) ||
          a.id.localeCompare(b.id),
      );
      return { escenarios, invalidos };
    },
    /**
     * Un propio por id (undefined si no está o ya no valida).
     * @param {string} id
     * @returns {Promise<Escenario | undefined>}
     */
    async obtener(id) {
      const f = await almacen.get(ST_ESCENARIOS, id);
      if (!f) return undefined;
      try {
        return normalizarPropio(f);
      } catch {
        return undefined;
      }
    },
    /**
     * Guarda (o reemplaza, mismo id) un escenario propio.
     * @param {unknown} e
     * @returns {Promise<Escenario>}
     */
    async guardar(e) {
      const n = normalizarPropio(e);
      await almacen.put(ST_ESCENARIOS, n);
      return n;
    },
    /** @param {string} id */
    async borrar(id) {
      if (esDeFabrica(id)) throw new Error(`de fábrica: ${id}`);
      await almacen.delete(ST_ESCENARIOS, id);
    },
  };
}
