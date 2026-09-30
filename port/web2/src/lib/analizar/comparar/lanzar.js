// @ts-check
// Lanzar réplicas de una corrida (decisión 10): resuelve el ADN de cada
// especie del escenario (el propio, los bots del usuario por hash o el
// Bestiary, C1), verifica que coincida con el hash que guardó el escenario
// (verificarAdn: si el bot cambió desde entonces, se avisa y se usa el
// actual), arma los parámetros (engine/replicas.js: autocontenidos, para
// reanudar tras una recarga sin volver a pedir nada) y los encola.

import { verificarAdn } from '../../../../engine/escenarios/index.js';
import { CADA_REPLICA, crearParametros, TIPO_REPLICAS } from '../../../../engine/replicas.js';
import { adnBestiario } from '../../observar/bestiario.js';
import { almacen } from '../../sim/almacen.svelte.js';

/**
 * ADN de una especie del escenario.
 * @param {import('../../../../engine/escenarios/index.js').Especie} s
 * @returns {Promise<string | undefined>}
 */
async function adnDe(s) {
  if (s.adn) return s.adn;
  if (s.origen === 'propio' && s.hash) {
    const b = await almacen().get('bots', s.hash);
    return b ? (b.adn ?? b.dna) : undefined;
  }
  return adnBestiario(s.bot);
}

/**
 * Encola N réplicas de la fuente (escenario con el que arrancó + sus
 * cambios en caliente, que se repiten en el mismo ciclo). Devuelve el id
 * del trabajo y los avisos de ADN que no coincide con su hash (bots). Lanza
 * ErrorReplicas (engine/replicas.js) si algo no vale.
 * @param {{encolar: (o: {tipo: string, params: any, unidades: number, titulo?: string}) => Promise<string>}} cola
 * @param {import('./fuentes.js').Fuente} f
 * @param {{n: number, ciclos: number, metrica: string, titulo: string}} o
 * @returns {Promise<{id: string, avisosAdn: string[]}>}
 */
export async function lanzarReplicas(cola, f, o) {
  const esc = f.escenario;
  const adn = esc ? await Promise.all(esc.especies.map(adnDe)) : [];
  const avisosAdn = esc
    ? verificarAdn(esc, (s) => adn[esc.especies.indexOf(s)]).map((a) => a.bot)
    : [];
  const params = crearParametros({
    escenario: esc,
    adn,
    semilla: f.semilla ?? 1,
    n: o.n,
    ciclos: o.ciclos,
    // una muestra cada 100 ciclos (o al final, si la réplica es más corta)
    cada: Math.max(1, Math.min(CADA_REPLICA, Math.trunc(o.ciclos) || 1)),
    metrica: o.metrica,
    eventos: f.eventos,
    origen: { nombre: f.nombre, id: f.id },
  });
  const id = await cola.encolar({
    tipo: TIPO_REPLICAS,
    params,
    unidades: params.semillas.length,
    titulo: o.titulo,
  });
  return { id, avisosAdn };
}
