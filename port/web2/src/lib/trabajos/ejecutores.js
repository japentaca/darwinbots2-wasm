// @ts-check
// Ejecutores de la cola de trabajos (engine/cola.js) de la página. Puro JS
// (sin DOM): el pool de workers se inyecta, así corre igual en node con el
// arnés de los tests.
//
//   replicas  una unidad = una réplica (src/lib/trabajos/replica.js) en un
//             worker del pool; el resumen final es la tabla de medias y
//             desvíos del valor final de las métricas clave
//             (engine/replicas.js); la lista usa vistaParams (sin ADN). Los partidos de una ronda de torneo
//             (decisión 23) serán otro ejecutor sobre la misma cola.

import { TIPO_REPLICAS, tablaReplicas, vistaParams } from '../../../engine/replicas.js';
import { correrReplica } from './replica.js';

/**
 * @param {{pool: import('./pool.js').PoolWorkers, tanda?: number}} d
 * @returns {import('../../../engine/cola.js').Ejecutor}
 */
export function ejecutorReplicas(d) {
  return {
    async unidad(t, i, ctx) {
      const w = await d.pool.tomar(ctx.senal);
      let sano = false;
      try {
        const r = await correrReplica({
          canal: w.canal,
          params: t.params,
          i,
          progreso: ctx.progreso,
          senal: ctx.senal,
          tanda: d.tanda,
        });
        sano = true;
        return r;
      } finally {
        if (sano) d.pool.soltar(w);
        else d.pool.descartar(w);
      }
    },
    final(_t, datos) {
      return { tabla: tablaReplicas(datos) };
    },
    // La lista de la cola no copia el ADN ni el escenario.
    vista: vistaParams,
  };
}

/**
 * Los ejecutores de la página por tipo.
 * @param {{pool: import('./pool.js').PoolWorkers}} d
 */
export function ejecutores(d) {
  return { [TIPO_REPLICAS]: ejecutorReplicas(d) };
}
