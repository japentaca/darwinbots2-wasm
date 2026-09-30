// @ts-check
// Historias armadas a mano para los tests de detectores, informes y
// exportación (engine/history.js alimentada con muestras sintéticas).
import { Historia } from '../../engine/history.js';
import {
  CAMPOS_COMPORTAMIENTO,
  HISTOGRAMAS,
  IE,
  IM,
  N_COMPORTAMIENTO,
  N_ESPECIE,
  N_METRICAS,
} from '../../engine/metricas.js';

/**
 * @typedef {object} Guion
 * @property {number[]} t                      ciclo de cada muestra
 * @property {Record<string, (number | null)[]>} [especies]  vivos por muestra (null o 0 = ausente)
 * @property {string[]} [vegetales]            especies vegetales (todos sus bots lo son)
 * @property {(number | null)[]} [total]       vivos global (por defecto, la suma de las especies)
 * @property {(number | null)[]} [adn]         adnMedia global (y de cada especie, salvo adnEspecie)
 * @property {Record<string, (number | null)[]>} [adnEspecie]  adnMedia de una especie (por
 *                                             defecto, el global; sin ninguno, 100)
 * @property {Record<string, number>} [metricas]  otras métricas globales constantes
 * @property {boolean} [comportamiento]        agrega nacimientos/muertes/disparos por especie
 * @property {number} [bins]                   agrega histogramas con estos bins
 * @property {{intervalo?: number, maxPuntos?: number}} [opciones]
 */

/** @param {Guion} g */
export function historiaDe(g) {
  const h = new Historia(g.opciones);
  const especies = Object.entries(g.especies ?? {});
  const veg = new Set(g.vegetales ?? []);
  g.t.forEach((ciclo, i) => {
    const metrics = new Float32Array(N_METRICAS);
    metrics[IM.ciclo] = ciclo;
    let suma = 0;
    let vegs = 0;
    const filas = [];
    for (const [nombre, serie] of especies) {
      const v = serie[i];
      if (v === null || v === undefined || !(v > 0)) continue;
      suma += v;
      if (veg.has(nombre)) vegs += v;
      const stats = new Float32Array(N_ESPECIE);
      stats[IE.indice] = filas.length;
      stats[IE.vivos] = v;
      stats[IE.vegetales] = veg.has(nombre) ? v : 0;
      stats[IE.genMax] = Math.floor(ciclo / 1000);
      const adn = g.adnEspecie?.[nombre] ?? g.adn;
      stats[IE.adnMedia] = adn ? (adn[i] ?? Number.NaN) : 100;
      filas.push({ nombre, stats });
    }
    const total = g.total?.[i];
    metrics[IM.vivos] = total === undefined ? suma : (total ?? Number.NaN);
    metrics[IM.vegetales] = vegs;
    metrics[IM.noVegetales] = suma - vegs;
    metrics[IM.especiesVivas] = filas.length;
    metrics[IM.genMedia] = ciclo / 2000;
    metrics[IM.genMax] = ciclo / 1000;
    if (g.adn) metrics[IM.adnMedia] = g.adn[i] ?? Number.NaN;
    metrics[IM.nrgTotal] = suma * 1000;
    metrics[IM.nrgVegetales] = vegs * 1000;
    metrics[IM.nrgNoVegetales] = (suma - vegs) * 1000;
    metrics[IM.luz] = 0.5 + 0.5 * Math.sin(ciclo / 5000);
    for (const [k, v] of Object.entries(g.metricas ?? {})) metrics[IM[k]] = v;
    const comportamiento = g.comportamiento
      ? filas.map((f, j) => {
          const datos = new Float32Array(N_COMPORTAMIENTO);
          datos[0] = j;
          const v = f.stats[IE.vivos];
          datos[CAMPOS_COMPORTAMIENTO.indexOf('nacimientos')] = Math.round(v / 10);
          datos[CAMPOS_COMPORTAMIENTO.indexOf('muertes')] = Math.round(v / 12);
          datos[CAMPOS_COMPORTAMIENTO.indexOf('disparosNrg')] = v;
          datos[CAMPOS_COMPORTAMIENTO.indexOf('disparosVenom')] = Math.round(v / 5);
          return { nombre: `${f.nombre}.txt`, datos };
        })
      : null;
    let histogramas = null;
    if (g.bins) {
      const b = g.bins;
      const datos = new Float32Array(HISTOGRAMAS.length * (b + 2));
      const n = new Int32Array(HISTOGRAMAS.length);
      for (let k = 0; k < HISTOGRAMAS.length; k++) {
        datos[k * (b + 2)] = 0;
        datos[k * (b + 2) + 1] = 10 * (k + 1);
        for (let j = 0; j < b; j++) datos[k * (b + 2) + 2 + j] = (j * 7 + k + i) % 11;
        n[k] = suma;
      }
      histogramas = { bins: b, n, datos };
    }
    h.agregar({
      ciclo,
      metrics,
      especies: filas.map((f) => ({ ...f, nombre: `${f.nombre}.txt` })),
      comportamiento,
      histogramas,
    });
  });
  return h;
}

/** Ciclos 0, paso, 2·paso… (n muestras). @param {number} n @param {number} [paso] */
export const ciclos = (n, paso = 100) => Array.from({ length: n }, (_, i) => i * paso);
