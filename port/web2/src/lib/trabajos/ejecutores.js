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
//   prueba    «Probar» del editor de ADN (decisión 18): una unidad = una
//             semilla de una versión, en un worker del pool
//             (src/lib/trabajos/prueba.js).
//   ronda     una ronda de torneo en segundo plano (decisión 23): una unidad
//             = un partido, en un worker del pool (src/lib/trabajos/partido.js;
//             no reintentable: se pide otra ronda).
//   barrido   barrido de parámetros (Nivel 4): una unidad = un valor × una
//             semilla, corrida como una réplica (paramsUnidad de
//             engine/barrido.js) con el ejecutor de réplicas; el resumen es
//             la tabla por valor (agregarBarrido).

import {
  agregarBarrido,
  paramsUnidad,
  TIPO_BARRIDO,
  vistaBarrido,
} from '../../../engine/barrido.js';
import { TIPO_REPLICAS, tablaReplicas, vistaParams } from '../../../engine/replicas.js';
import { TIPO_RONDA } from '../../../engine/rondas.js';
import { ejecutorRonda } from './partido.js';
import { ejecutorPrueba, TIPO_PRUEBA } from './prueba.js';
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
 * Barrido de parámetros: cada unidad es una réplica del escenario con el
 * valor de esa unidad (reutiliza el ejecutor de réplicas).
 * @param {{pool: import('./pool.js').PoolWorkers, tanda?: number}} d
 * @returns {import('../../../engine/cola.js').Ejecutor}
 */
export function ejecutorBarrido(d) {
  const rep = ejecutorReplicas(d);
  return {
    unidad: (t, i, ctx) => rep.unidad({ ...t, params: paramsUnidad(t.params, i) }, 0, ctx),
    final: (t, datos) => ({ filas: agregarBarrido(t.params, datos) }),
    vista: vistaBarrido,
  };
}

/**
 * Los ejecutores de la página por tipo.
 * @param {{pool: import('./pool.js').PoolWorkers}} d
 */
export function ejecutores(d) {
  return {
    [TIPO_REPLICAS]: ejecutorReplicas(d),
    [TIPO_PRUEBA]: ejecutorPrueba(d),
    [TIPO_RONDA]: ejecutorRonda(d),
    [TIPO_BARRIDO]: ejecutorBarrido(d),
  };
}
