// @ts-check
// Lo puro (sin runes ni DOM) de jugar en la página (paso N3.5), para
// torneos.svelte.js y sus tests:
//   · la marca del partido en la sim de la página y su vigía: si otra cosa
//     toma la sim (corrida nueva, carga, reinicio) o si la corrida recibe
//     cambios en caliente (registrarCambio, siembra, objetos, opciones), el
//     partido se abandona sin registrarse (un resultado alterado no vale);
//   · liberar la temporada tras cancelar una ronda, mirando el estado FRESCO
//     del trabajo (la cola local o el almacén, no la lista en caché);
//   · el ADN de un renglón del roster del Contest viejo (contestDna de
//     port/web/contest.js, con los presets de port/web/index.html);
//   · el escenario efectivo de las reglas de una temporada, para abrirlo
//     como borrador en Experimentar («Load into the panel» de la clásica).

import { ST_TRABAJOS } from '../../../engine/cola.js';
import { normalizar } from '../../../engine/escenarios/index.js';
import { ALGA_ARRANQUE, reglasAOpciones } from '../../../engine/partido.js';
import {
  cambiosDeOpciones,
  esReglasEscenario,
  opcionesBaseClasica,
} from '../../../engine/rondas.js';

// ---- Marca y vigía del partido ------------------------------------------------------

/**
 * Lo que identifica al partido lanzado en la sim de la página: la corrida
 * (escenario y semilla), cuántos eventos en caliente tenía y el objeto de
 * opciones de la sesión (cambia con cada reset, carga y cambio de opción).
 * @typedef {{escenario: string | null, semilla: number | null, eventos: number, opciones: unknown}} MarcaPartido
 */

/**
 * @param {{escenario?: {id?: string} | null, semilla?: number | null, eventos?: unknown[]} | null | undefined} estado
 *   estado de la corrida de la página (null sin corrida)
 * @param {{opciones?: unknown}} sesion
 * @returns {MarcaPartido}
 */
export function marcaPartido(estado, sesion) {
  return {
    escenario: estado?.escenario?.id ?? null,
    semilla: estado?.semilla ?? null,
    eventos: estado?.eventos?.length ?? 0,
    opciones: sesion.opciones,
  };
}

/**
 * ¿La sim de la página sigue siendo el partido de la marca?
 *   'sigue'    nada cambió
 *   'tomada'   otra corrida (otro escenario u otra semilla): otra cosa tomó la sim
 *   'alterada' la misma corrida con cambios en caliente (eventos nuevos) o
 *              con otras opciones en la sesión (un setopt/setbase/setcost o
 *              un reinicio que no pasó por la corrida)
 * @param {MarcaPartido} m
 * @param {Parameters<typeof marcaPartido>[0]} estado @param {{opciones?: unknown}} sesion
 * @returns {'sigue' | 'tomada' | 'alterada'}
 */
export function vigiaPartido(m, estado, sesion) {
  const ahora = marcaPartido(estado, sesion);
  if (ahora.escenario !== m.escenario || ahora.semilla !== m.semilla) return 'tomada';
  if (ahora.eventos !== m.eventos || ahora.opciones !== m.opciones) return 'alterada';
  return 'sigue';
}

// ---- Rondas canceladas ---------------------------------------------------------------

/**
 * Estado actual de un trabajo: el de la cola local si esta pestaña es la
 * dueña; si no, el guardado en el almacén (la dueña guarda antes de
 * contestar un cancelar). undefined si no existe (borrado o podado).
 * @param {{cola?: {trabajo: (id: string) => any} | null}} cola
 * @param {{get: (store: string, key: any) => Promise<any>}} almacen
 * @param {string} id
 * @returns {Promise<string | undefined>}
 */
export async function estadoTrabajo(cola, almacen, id) {
  if (cola.cola) return cola.cola.trabajo(id)?.estado;
  return (await almacen.get(ST_TRABAJOS, id))?.estado;
}

/**
 * Después de cancelar (o de ver cancelado) el trabajo de una ronda: si el
 * trabajo quedó cancelado, fallido o ya no existe, quita la marca de ronda
 * de la temporada (lgRondaCancelar, en cualquier pestaña: escribe en el
 * almacén). Si sigue activo (el cancelar no llegó) o terminó (se registra
 * con lgReconciliarRondas), no toca nada. Devuelve true si la liberó.
 * @param {{
 *   torneos: {lgRondaCancelar: (id?: string, league?: string) => Promise<boolean>},
 *   cola: {cola?: {trabajo: (id: string) => any} | null},
 *   almacen: {get: (store: string, key: any) => Promise<any>},
 *   trabajo: string | undefined, ronda: string, league: string,
 * }} o
 */
export async function liberarSiCancelada(o) {
  const e = o.trabajo ? await estadoTrabajo(o.cola, o.almacen, o.trabajo) : undefined;
  if (e !== undefined && e !== 'cancelado' && e !== 'fallido') return false;
  return o.torneos.lgRondaCancelar(o.ronda, o.league);
}

// ---- Roster del Contest viejo --------------------------------------------------------

/**
 * Los presets de la clásica que el roster del Contest puede nombrar
 * (`src: 'preset'`, `file: 'animal' | 'alga'`: PRESETS de
 * port/web/index.html). El ADN es el mismo texto.
 * @param {string} animal ADN de Animal Minimalis
 */
export const presetsClasica = (animal) =>
  Object.freeze({ animal: { dna: animal }, alga: { dna: ALGA_ARRANQUE.dna } });

/**
 * ADN de un renglón del roster del Contest viejo, como contestDna de la
 * clásica: 'bestiary' por su archivo del foro; 'hybrid' por nombre entre
 * los propios (la migración de Bots pasó los híbridos a propios); 'preset'
 * por el preset; si no, el ADN que trae ('form'). Lanza si no hay.
 * @param {{name: string, src?: string, file?: string, dna?: string}} r
 * @param {{
 *   foro: (file: string) => Promise<string>,
 *   propios: () => Promise<{clase: string, nombre: string, adn?: string, origen?: any}[]>,
 *   presets: Record<string, {dna: string}>,
 * }} d
 * @returns {Promise<string>}
 */
export async function adnRosterViejo(r, d) {
  if (r.src === 'bestiary') {
    if (!r.file) throw new Error(`${r.name}: no longer in the Bestiary`);
    return d.foro(r.file);
  }
  if (r.src === 'hybrid') {
    const f = String(r.file ?? '').replace(/\.txt$/, '');
    const e = (await d.propios()).find(
      (x) =>
        x.clase === 'propio' &&
        !!x.adn &&
        (x.nombre.replace(/\.txt$/, '') === f ||
          String(x.origen?.nombre ?? '').replace(/\.txt$/, '') === f),
    );
    if (!e?.adn) throw new Error(`${r.name}: hybrid "${r.file}" not found`);
    return e.adn;
  }
  if (r.src === 'preset') {
    const p = r.file ? d.presets[r.file] : undefined;
    if (!p) throw new Error(`${r.name}: unknown preset`);
    return p.dna;
  }
  if (r.dna) return r.dna;
  throw new Error(`${r.name}: no DNA`);
}

// ---- Reglas → Experimentar -----------------------------------------------------------

/** id del borrador que sale de las reglas de un torneo */
export const ID_REGLAS_TORNEO = 'reglas-torneo';

/**
 * El escenario efectivo de las reglas de una temporada (sin especies, como
 * el mundo del torneo): las reglas-escenario tal cual; la foto del panel de
 * la clásica, como cambios sobre la base 'clasica'. El modo F1 del partido
 * no va (lo pone cada partido). Normalizado: lanza ErrorEscenario o
 * ErrorLiga('rule-unknown') si no cabe.
 * @param {any} rules @param {{es: string, en: string}} nombre
 */
export function escenarioDeReglas(rules, nombre) {
  if (esReglasEscenario(rules)) {
    const e = structuredClone(rules.escenario);
    return normalizar({ ...e, especies: [] });
  }
  const cambios = cambiosDeOpciones(reglasAOpciones(rules || {}, opcionesBaseClasica()));
  for (const k of ['opt:90', 'opt:91', 'opt:97', 'opt:98', 'opt:99', 'opt:100', 'opt:101'])
    delete cambios[k];
  return normalizar({
    formato: 1,
    id: ID_REGLAS_TORNEO,
    nombre,
    opciones: { base: 'clasica', cambios },
    especies: [],
    objetos: { obstaculos: [], teleporters: [] },
  });
}
