// @ts-check
// Evolución asistida del editor (PLAN-EDITOR E4.3): «Generar y probar» de
// PanelEvolucionar. Hay una base (el ADN del usuario) y k variantes (las que
// armó el worker con las mutaciones del motor, E4.2; ya vienen injertadas
// sobre la base: solo cambian los genes mutados). Cada texto se prueba con la
// maquinaria de «Probar» (src/lib/trabajos/prueba.js, correrPrueba) y con LAS
// MISMAS semillas, así que las diferencias son del ADN y no del azar.
//
// Un trabajo de la cola (engine/cola.js) de tipo 'evolucion': una unidad por
// texto (primero la base, variante -1; después cada variante, variante i).
// Cada unidad corre una prueba por semilla sobre su texto.
//
// Los params son autocontenidos (la base, los textos de las variantes y las
// reglas de la prueba, como los de 'prueba') y llevan {clave, hash, lg, adn}
// para que el historial del bot (engine/biblioteca.js historialBot) lo
// encuentre. Los `mutaciones` y `factor` son los que se usaron para generar
// las variantes; la lista de la cola no copia los textos (vistaEvolucion).
//
// Puro JS, sin DOM: el worker llega como «canal» (replica.js), igual que en
// prueba.js, así corre en node con el arnés de los tests.

import { hashAdn, lgHash } from '../../../engine/adn.js';
import { diffGenes } from '../../../engine/lineage.js';
import { correrPrueba, crearParamsPrueba, resumirVersion, vistaPrueba } from './prueba.js';

/** Tipo del trabajo de la cola (ejecutores.js lo registra). */
export const TIPO_EVOLUCION = 'evolucion';
/** Modos de mutación del motor (db::mutate): 0 en vida, 1 en reproducción, 2 ambos. */
export const MUTACIONES = Object.freeze([0, 1, 2]);
export const LIMITES_EVOLUCION = Object.freeze({
  k: Object.freeze([1, 16]),
  factor: Object.freeze([1, 1000]),
});
export const POR_DEFECTO_EVOLUCION = Object.freeze({ k: 8, mutaciones: 2, factor: 1 });

/**
 * Error de parámetros de la evolución con código estable (texto:
 * t('editor.evolucion.error.<codigo>')). Los de la prueba (adn, modo, base,
 * copias, ciclos, semillas, semilla, alga) llegan como ErrorPrueba.
 * Códigos: 'textos' (un texto vacío o no es lista), 'sinVariantes', 'k',
 * 'mutaciones', 'factor', 'indice'.
 */
export class ErrorEvolucion extends Error {
  /** @param {string} codigo @param {string} [detalle] */
  constructor(codigo, detalle) {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.codigo = codigo;
  }
}

/**
 * @typedef {import('./prueba.js').ParamsPrueba} ParamsPrueba
 * @typedef {{variante: number, texto: string}} UnidadEvolucion
 *   (variante -1 es la base; 0.. son las variantes en orden)
 * @typedef {{variante: number, texto: string,
 *   resultados: import('./prueba.js').ResultadoPrueba[]}} ResultadoUnidadEvolucion
 * @typedef {ParamsPrueba & {k: number, textos: string[], mutaciones: number, factor: number}} ParamsEvolucion
 * @typedef {{i: number, texto: string, resumen: import('./prueba.js').ResumenVersion | null,
 *   genesCambiados: number}} VarianteEvolucion
 */

/** @param {unknown} v @param {readonly number[]} r @param {string} codigo */
function entero(v, r, codigo) {
  const n = Math.trunc(Number(v));
  if (!(n >= r[0] && n <= r[1])) throw new ErrorEvolucion(codigo, String(v));
  return n;
}

/**
 * Parámetros de una evolución. Las semillas de réplica, la base y las reglas
 * son las de crearParamsPrueba (y se validan igual).
 * @param {{clave: string, nombre: string, vegetal?: boolean, adn: string,
 *   textos: string[], k?: number, mutaciones?: number, factor?: number,
 *   modo?: string, base?: string, copias?: number, ciclos?: number,
 *   semillas?: number, semilla?: number, adnAlga?: string | null}} o
 * @returns {ParamsEvolucion}
 */
export function crearParamsEvolucion(o) {
  const k = entero(o.k ?? POR_DEFECTO_EVOLUCION.k, LIMITES_EVOLUCION.k, 'k');
  const mutaciones = o.mutaciones ?? POR_DEFECTO_EVOLUCION.mutaciones;
  if (!MUTACIONES.includes(mutaciones)) throw new ErrorEvolucion('mutaciones', String(mutaciones));
  const factor = entero(
    o.factor ?? POR_DEFECTO_EVOLUCION.factor,
    LIMITES_EVOLUCION.factor,
    'factor',
  );
  if (!Array.isArray(o.textos) || o.textos.some((x) => typeof x !== 'string' || !x.trim()))
    throw new ErrorEvolucion('textos');
  if (o.textos.length === 0) throw new ErrorEvolucion('sinVariantes');
  if (o.textos.length > LIMITES_EVOLUCION.k[1]) throw new ErrorEvolucion('textos');
  const pb = crearParamsPrueba({
    clave: o.clave,
    nombre: o.nombre,
    vegetal: o.vegetal,
    adn: o.adn,
    modo: o.modo,
    base: o.base,
    copias: o.copias,
    ciclos: o.ciclos,
    semillas: o.semillas,
    semilla: o.semilla,
    adnAlga: o.adnAlga,
  });
  return { ...pb, k, textos: [...o.textos], mutaciones, factor };
}

/**
 * Las unidades del trabajo: la base (variante -1) y una por variante, en ese
 * orden. Cada una corre con las mismas semillas.
 * @param {ParamsEvolucion} p @returns {UnidadEvolucion[]}
 */
export function unidadesEvolucion(p) {
  return [{ variante: -1, texto: p.adn }, ...p.textos.map((texto, i) => ({ variante: i, texto }))];
}

/**
 * La unidad i (base 0), o lanza ErrorEvolucion 'indice'.
 * @param {ParamsEvolucion} p @param {number} i @returns {UnidadEvolucion}
 */
export function unidadEvolucion(p, i) {
  const us = unidadesEvolucion(p);
  if (!(i >= 0 && i < us.length)) throw new ErrorEvolucion('indice', String(i));
  return us[i];
}

/**
 * Los params de una prueba del texto dado dentro de la evolución: mismas
 * semillas, reglas y copias que la base; el ADN, el hash y el lg son los del
 * texto y no hay versión anterior.
 * @param {ParamsEvolucion} p @param {string} texto @returns {ParamsPrueba}
 */
export function paramsTexto(p, texto) {
  return {
    ...p,
    adn: texto,
    hash: hashAdn(texto),
    lg: lgHash(texto),
    version: null,
    anterior: null,
  };
}

/**
 * Corre la unidad i: el texto de la unidad, una prueba por semilla
 * (correrPrueba). El progreso va de 0 a 1 sobre todas las semillas.
 * @param {{canal: import('./replica.js').Canal, params: ParamsEvolucion, i: number,
 *   progreso?: (fr: number) => void, senal?: AbortSignal, tanda?: number, enVuelo?: number,
 *   plazoMs?: number}} o
 * @returns {Promise<ResultadoUnidadEvolucion>}
 */
export async function correrEvolucion(o) {
  const u = unidadEvolucion(o.params, o.i);
  const pt = paramsTexto(o.params, u.texto);
  const n = pt.semillas.length;
  /** @type {import('./prueba.js').ResultadoPrueba[]} */
  const resultados = [];
  for (let s = 0; s < n; s++) {
    resultados.push(
      await correrPrueba({
        canal: o.canal,
        params: pt,
        i: s,
        progreso: (fr) => o.progreso?.((s + fr) / n),
        senal: o.senal,
        tanda: o.tanda,
        enVuelo: o.enVuelo,
        plazoMs: o.plazoMs,
      }),
    );
  }
  o.progreso?.(1);
  return { variante: u.variante, texto: u.texto, resultados };
}

/**
 * Resumen del trabajo: la base y las variantes ordenadas por supervivencia
 * (sobreviven desc) y, en empate, por hijos por copia (desc). `genesCambiados`
 * = cambiados + agregados + quitados de diffGenes contra la base.
 * @param {ParamsEvolucion} p @param {(ResultadoUnidadEvolucion | null)[]} datos
 * @returns {{base: import('./prueba.js').ResumenVersion | null, variantes: VarianteEvolucion[]}}
 */
export function resumenEvolucion(p, datos) {
  const ok = /** @type {ResultadoUnidadEvolucion[]} */ (datos.filter(Boolean));
  const baseD = ok.find((x) => x.variante === -1);
  const variantes = ok
    .filter((x) => x.variante >= 0)
    .map((x) => {
      const d = diffGenes(p.adn, x.texto);
      return {
        i: x.variante,
        texto: x.texto,
        resumen: resumirVersion(x.resultados, p.copias),
        genesCambiados: d.cambiados + d.agregados + d.quitados,
      };
    })
    .sort(
      (a, b) =>
        (b.resumen?.sobreviven ?? 0) - (a.resumen?.sobreviven ?? 0) ||
        (b.resumen?.hijosPorCopia ?? 0) - (a.resumen?.hijosPorCopia ?? 0),
    );
  return {
    base: baseD ? resumirVersion(baseD.resultados, p.copias) : null,
    variantes,
  };
}

/**
 * Lo que hace falta para LISTAR el trabajo (sin los textos): la vista de la
 * prueba más la cantidad de variantes, las mutaciones y la intensidad.
 * @param {ParamsEvolucion} p
 */
export function vistaEvolucion(p) {
  return {
    ...vistaPrueba(p),
    k: p?.k,
    variantes: p?.textos?.length ?? 0,
    mutaciones: p?.mutaciones,
    factor: p?.factor,
  };
}

/**
 * Ejecutor de la cola para la evolución (engine/cola.js), sobre el pool de
 * workers de las réplicas. Igual que el de 'prueba'.
 * @param {{pool: import('./pool.js').PoolWorkers, tanda?: number}} d
 * @returns {import('../../../engine/cola.js').Ejecutor}
 */
export function ejecutorEvolucion(d) {
  return {
    async unidad(t, i, ctx) {
      const w = await d.pool.tomar(ctx.senal);
      let sano = false;
      try {
        const r = await correrEvolucion({
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
    final(t, datos) {
      return resumenEvolucion(t.params, datos);
    },
    vista: vistaEvolucion,
  };
}
