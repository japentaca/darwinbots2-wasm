// @ts-check
// Diferencias de configuración entre dos corridas (decisión 10: «Dos
// corridas superpuestas, con sus diferencias de configuración»). Puro, sin
// DOM ni runes. Una corrida es escenario + semilla + cambios en caliente
// (decisión 12); se compara:
//   - el escenario (id y nombre) y la base de opciones;
//   - las opciones EFECTIVAS al arrancar (base + cambios del escenario,
//     valorEfectivo de engine/opciones.js): solo las que difieren, con su
//     parámetro del catálogo (nombre es/en y tipo de valor);
//   - las especies (por bot: cantidad, color, vegetal, energía y ADN: el
//     hash del texto propio si la especie lo trae, si no el hash guardado);
//   - los objetos (obstáculos y teleporters);
//   - la semilla;
//   - los cambios en caliente y siembras (eventos), con su ciclo.
// Una corrida sin escenario (un .dbsim importado) no tiene opciones ni
// especies que comparar: sus valores quedan undefined.

import { resolverOpciones } from '../../../../engine/escenarios/index.js';
import { lgHash } from '../../../../engine/league.js';
import { PARAMETROS, parametro, valorEfectivo } from '../../../../engine/opciones.js';

/**
 * @typedef {import('../../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../../../engine/corridas.js').EventoCorrida} EventoCorrida
 * @typedef {{escenario: Escenario | null, semilla: number | null, eventos: EventoCorrida[]}} ConfigCorrida
 * @typedef {{clave: string, a: number | undefined, b: number | undefined}} DifOpcion
 * @typedef {{cantidad: number, color: string, vegetal: boolean, energia: number,
 *   hash?: string, propio?: true}} DatosEspecie
 * @typedef {{bot: string, a: DatosEspecie | null, b: DatosEspecie | null, igual: boolean}} DifEspecie
 * @typedef {{
 *   escenario: {a: Escenario | null, b: Escenario | null, igual: boolean},
 *   base: {a: string | undefined, b: string | undefined, igual: boolean},
 *   semilla: {a: number | null, b: number | null, igual: boolean},
 *   opciones: DifOpcion[],
 *   opcionesIguales: number,
 *   especies: DifEspecie[],
 *   objetos: {a: string[], b: string[], igual: boolean},
 *   eventos: {a: EventoCorrida[], b: EventoCorrida[], igual: boolean},
 *   total: number,
 * }} Diferencias
 */

/** @param {Escenario | null} e @returns {Record<string, number> | null} */
const resueltos = (e) => (e ? resolverOpciones(e) : null);

/** @param {Escenario} e */
function especiesPorBot(e) {
  /** @type {Map<string, DatosEspecie>} */
  const m = new Map();
  for (const s of e.especies) {
    // Un bot repetido (dos grupos del mismo bot) se lista con sufijo.
    let k = s.bot;
    for (let n = 2; m.has(k); n++) k = `${s.bot} (${n})`;
    /** @type {DatosEspecie} */
    const d = {
      cantidad: s.cantidad,
      color: s.color.toLowerCase(),
      vegetal: !!s.vegetal,
      energia: s.energia,
    };
    // El ADN propio se compara por su texto (su hash): dos corridas con el
    // mismo bot editado distinto difieren aunque el hash guardado sea viejo.
    const hash = s.adn ? lgHash(s.adn) : s.hash;
    if (hash) d.hash = hash;
    if (s.adn) d.propio = true;
    m.set(k, d);
  }
  return m;
}

/**
 * Descripción estable de un objeto del escenario (para comparar y mostrar
 * con t(): tipo + medidas).
 * @param {any} o
 */
export function objetoTexto(o) {
  if (o.tipo === 'laberinto') return `laberinto:${o.forma}:${o.pasillo}:${o.muro}`;
  if (o.tipo === 'local') return 'teleporter';
  return `${o.tipo}:${o.ancho}:${o.alto}`;
}

/** @param {Escenario | null} e */
const objetos = (e) =>
  e ? [...e.objetos.obstaculos.map(objetoTexto), ...e.objetos.teleporters.map(objetoTexto)] : [];

/** @param {unknown} a @param {unknown} b */
const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @param {ConfigCorrida} a @param {ConfigCorrida} b
 * @returns {Diferencias}
 */
export function diferenciasConfig(a, b) {
  const ra = resueltos(a.escenario);
  const rb = resueltos(b.escenario);
  /** @type {DifOpcion[]} */
  const opciones = [];
  let opcionesIguales = 0;
  for (const p of PARAMETROS) {
    if (p.derivado) continue;
    const va = ra ? valorEfectivo(ra, p.clave) : undefined;
    const vb = rb ? valorEfectivo(rb, p.clave) : undefined;
    if (Object.is(va, vb)) opcionesIguales++;
    else opciones.push({ clave: p.clave, a: va, b: vb });
  }
  const ea = a.escenario ? especiesPorBot(a.escenario) : new Map();
  const eb = b.escenario ? especiesPorBot(b.escenario) : new Map();
  /** @type {DifEspecie[]} */
  const especies = [...new Set([...ea.keys(), ...eb.keys()])].map((bot) => {
    const da = ea.get(bot) ?? null;
    const db = eb.get(bot) ?? null;
    return { bot, a: da, b: db, igual: mismo(da, db) };
  });
  const oa = objetos(a.escenario);
  const ob = objetos(b.escenario);
  const d = {
    escenario: {
      a: a.escenario,
      b: b.escenario,
      igual: (a.escenario?.id ?? null) === (b.escenario?.id ?? null),
    },
    base: {
      a: a.escenario?.opciones.base,
      b: b.escenario?.opciones.base,
      igual: a.escenario?.opciones.base === b.escenario?.opciones.base,
    },
    semilla: { a: a.semilla, b: b.semilla, igual: a.semilla === b.semilla },
    opciones,
    opcionesIguales,
    especies,
    objetos: { a: oa, b: ob, igual: mismo(oa, ob) },
    eventos: { a: a.eventos, b: b.eventos, igual: mismo(a.eventos, b.eventos) },
    total: 0,
  };
  d.total =
    (d.escenario.igual ? 0 : 1) +
    (d.base.igual ? 0 : 1) +
    (d.semilla.igual ? 0 : 1) +
    opciones.length +
    especies.filter((e) => !e.igual).length +
    (d.objetos.igual ? 0 : 1) +
    (d.eventos.igual ? 0 : 1);
  return d;
}

/**
 * Valor de un parámetro para mostrar: {tipo:'bool', on} | {tipo:'enum',
 * texto:{es,en}} | {tipo:'num', v} | {tipo:'nada'}. El texto final lo arma
 * la interfaz (t() y num()).
 * @param {string} clave @param {number | undefined} v
 */
export function valorParametro(clave, v) {
  if (v === undefined) return /** @type {const} */ ({ tipo: 'nada' });
  const p = parametro(clave);
  if (p?.valor === 'bool') return /** @type {const} */ ({ tipo: 'bool', on: v !== 0 });
  if (p?.valor === 'enum') {
    const e = p.valores?.find((x) => x.v === v);
    if (e) return /** @type {const} */ ({ tipo: 'enum', texto: { es: e.es, en: e.en } });
  }
  return /** @type {const} */ ({ tipo: 'num', v });
}

/**
 * Resumen de un evento para listarlo: el ciclo y, según el tipo, los
 * parámetros cambiados (clave → valor), la especie sembrada o la orden de
 * objeto (evento 'objetos' de engine/corridas.js).
 * @param {EventoCorrida} ev
 */
export function resumenEvento(ev) {
  if (ev.tipo === 'siembra')
    return {
      ciclo: ev.ciclo,
      tipo: 'siembra',
      especie: ev.especie.nombre,
      cantidad: ev.especie.cantidad,
    };
  // Orden de objeto en caliente (barra «Mundo»): la orden tal cual; sin
  // parámetros cambiados.
  if (ev.tipo === 'objetos')
    return { ciclo: ev.ciclo, tipo: 'objetos', orden: { ...ev.orden }, cambios: [] };
  return { ciclo: ev.ciclo, tipo: 'opciones', cambios: Object.entries(ev.cambios ?? {}) };
}
