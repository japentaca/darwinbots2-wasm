// @ts-check
// Resultados de réplicas armados a mano para los tests del informe de
// Réplicas (engine/replicas.js: la historia de solo métricas globales y la
// última muestra cruda de cada réplica).
import { IM, N_METRICAS } from '../../engine/metricas.js';
import {
  agregarMuestra,
  historiaReplica,
  muestraFinal,
  resultadoReplica,
} from '../../engine/replicas.js';

/**
 * Un resultado de réplica: `vivos(c)` bots vivos en el ciclo c (el resto de
 * las métricas clave, derivadas de ahí).
 * @param {{ciclos: number, cada: number, vivos: (c: number) => number}} o
 */
export function resultadoSintetico(o) {
  const h = historiaReplica({ cada: o.cada, maxPuntos: 500 });
  /** @type {{ciclo: number, metrics: Float32Array} | null} */
  let ultima = null;
  for (let c = 0; c <= o.ciclos; c += o.cada) {
    const m = new Float32Array(N_METRICAS);
    const v = o.vivos(c);
    m[IM.ciclo] = c;
    m[IM.vivos] = v;
    m[IM.vegetales] = Math.round(v / 3);
    m[IM.noVegetales] = v - Math.round(v / 3);
    m[IM.especiesVivas] = 3;
    m[IM.genMax] = Math.floor(c / 1000);
    m[IM.mutMedia] = c / 5000;
    m[IM.adnMedia] = 150 + c / 200;
    m[IM.nrgTotal] = v * 1000;
    m[IM.killsTotal] = Math.floor(c / 500);
    ultima = { ciclo: c, metrics: m };
    agregarMuestra(h, ultima);
  }
  return resultadoReplica(h, ultima ? muestraFinal(ultima) : null);
}
