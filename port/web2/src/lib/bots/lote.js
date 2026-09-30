// @ts-check
// Siembra en lote desde la biblioteca (paso N3.2, puro; decisión 20):
// varios bots elegidos →
//   - «Sembrar en la corrida actual»: una siembra por especie, en el formato
//     de corrida.sembrar (src/lib/sim/corrida-nucleo.js), que la registra
//     como evento 'siembra' de la corrida (las réplicas la repiten);
//   - «Nuevo escenario con estos»: un escenario propio (decisión 12) con
//     esas especies, validado con validarPropio (engine/escenarios), para
//     guardarlo en el almacén 'escenarios' y abrirlo en Experimentar.
// Las especies salen de especiesLote (engine/biblioteca.js): una por clave,
// con la cantidad, la energía y un color que no esté ya en la corrida
// (paletaLibre). Con un solo bot, el diálogo deja elegir nombre, color,
// vegetal, cantidad y energía (conCampos). Dos especies del lote con el
// mismo nombre (un propio homónimo de uno del foro, dos archivos del foro
// con el mismo nombre) se renombran con un sufijo (nombresUnicos).

import { crearPaleta, lgHash } from '../../../engine/adn.js';
import { especiesLote } from '../../../engine/biblioteca.js';
import { normalizarPropio, validarPropio } from '../../../engine/escenarios/fabrica.js';
import { idLibre } from '../experimentar/archivo.js';
import { colorLibre, PALETA } from '../experimentar/borrador.js';

/**
 * @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada
 * @typedef {{entrada?: Entrada, especie: Especie, adn: string}} EspecieLote
 * @typedef {import('../../../engine/escenarios/index.js').Especie} Especie
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../../engine/escenarios/index.js').ErrorValidacion} ErrorValidacion
 * @typedef {{cantidad: number, cantidadVeg: number, energia: number}} OpcionesLote
 * @typedef {{nombre: string, adn: string, cantidad: number, color: string, vegetal: boolean,
 *   energia: number}} Siembra  lo que recibe corrida.sembrar
 */

/** Los valores de la clásica (inv-qty 5, inv-vqty 15, inv-nrg 3000). */
export const LOTE_INICIAL = Object.freeze({ cantidad: 5, cantidadVeg: 15, energia: 3000 });
/**
 * Tope de bots por especie: el de la validación de los escenarios
 * (engine/escenarios, 1-10000). La clásica no pone tope (C23): pasado
 * CANTIDAD_AVISO solo hay un aviso.
 */
export const CANTIDAD_MAX = 10000;
/** Desde cuántos bots por especie se avisa que es mucho (el tope anterior). */
export const CANTIDAD_AVISO = 500;
/** Tope de la energía inicial (engine/escenarios: 0-32000). */
export const ENERGIA_MAX = 32000;

/**
 * Opciones del lote con valores válidos: enteros, cantidades 1-10000 y
 * energía 1-32000; lo que no es número vuelve al valor inicial.
 * @param {Partial<Record<keyof OpcionesLote, unknown>>} o @returns {OpcionesLote}
 */
export function normalizarLote(o) {
  /** @param {unknown} v @param {number} def @param {number} max */
  const n = (v, def, max) => {
    const x = Math.trunc(Number(v));
    return Number.isFinite(x) && x >= 1 ? Math.min(max, x) : def;
  };
  return {
    cantidad: n(o.cantidad, LOTE_INICIAL.cantidad, CANTIDAD_MAX),
    cantidadVeg: n(o.cantidadVeg, LOTE_INICIAL.cantidadVeg, CANTIDAD_MAX),
    energia: n(o.energia, LOTE_INICIAL.energia, ENERGIA_MAX),
  };
}

/**
 * Una entrada por clave, en orden (la misma deduplicación que especiesLote).
 * @param {Entrada[]} entradas
 */
export function entradasUnicas(entradas) {
  const vistos = new Set();
  return entradas.filter((e) => {
    if (vistos.has(e.clave)) return false;
    vistos.add(e.clave);
    return true;
  });
}

/**
 * Especies del lote con el ADN que corresponde a cada una (el .txt de los
 * del foro lo trae `adnDe`; los propios lo tienen en la entrada). Las que
 * no consiguen ADN quedan en `sinAdn` (por nombre) y no se siembran.
 * @param {Entrada[]} entradas
 * @param {OpcionesLote} o
 * @param {(e: Entrada) => Promise<string | undefined>} adnDe
 * @param {() => string} [paleta] generador de colores (crearPaleta)
 * @returns {Promise<{especies: Array<Required<EspecieLote>>, sinAdn: string[]}>}
 */
export async function especiesConAdn(entradas, o, adnDe, paleta) {
  const unicas = entradasUnicas(entradas);
  const lote = normalizarLote(o);
  const especies = /** @type {Especie[]} */ (especiesLote(unicas, { ...lote, paleta }));
  /** @type {Array<Required<EspecieLote>>} */
  const out = [];
  /** @type {string[]} */
  const sinAdn = [];
  for (let i = 0; i < unicas.length; i++) {
    const e = unicas[i];
    let adn;
    try {
      adn = e.clase === 'propio' ? e.adn : await adnDe(e);
    } catch {
      adn = undefined;
    }
    if (typeof adn !== 'string' || !adn.trim()) {
      sinAdn.push(e.nombre);
      continue;
    }
    out.push({ entrada: e, especie: especies[i], adn });
  }
  return { especies: out, sinAdn };
}

/**
 * ¿Es cantidad «mucha»? (aviso, no error: C23).
 * @param {unknown} n
 */
export const cantidadAlta = (n) => Number(n) > CANTIDAD_AVISO;

/**
 * Generador de colores para las especies nuevas que evita los `usados`
 * (los de la corrida, y los que ya dio): primero los de la paleta de
 * Experimentar (colorLibre); agotada, los de la clásica (crearPaleta).
 * @param {Iterable<string>} [usados] @param {() => string} [respaldo]
 * @returns {() => string}
 */
export function paletaLibre(usados = [], respaldo = crearPaleta()) {
  const u = [...usados].map((c) => String(c).toLowerCase());
  return () => {
    const libres = PALETA.some((c) => !u.includes(c));
    let c = libres ? colorLibre(u) : respaldo();
    for (let i = 0; !libres && u.includes(c.toLowerCase()) && i < 20; i++) c = respaldo();
    c = c.toLowerCase();
    u.push(c);
    return c;
  };
}

/**
 * Nombres únicos en el lote (sin distinguir mayúsculas). Conservan su
 * nombre, primero, los del foro que siguen con el nombre del Bestiary (el
 * escenario los busca por nombre); después, en orden, el resto. El que
 * repite un nombre ya tomado pasa a «<nombre> 2», «<nombre> 3»…
 * @template {EspecieLote} T
 * @param {T[]} especies
 * @returns {{especies: T[], renombrados: Array<{de: string, a: string}>}}
 */
export function nombresUnicos(especies) {
  /** @param {EspecieLote} x */
  const fijo = (x) =>
    x.especie.origen !== 'propio' && (!x.entrada || x.entrada.nombre === x.especie.bot);
  const orden = especies
    .map((_, i) => i)
    .sort((i, j) => Number(fijo(especies[j])) - Number(fijo(especies[i])) || i - j);
  const tomados = new Set();
  const out = [...especies];
  /** @type {Array<{i: number, de: string, a: string}>} */
  const cambios = [];
  for (const i of orden) {
    const x = especies[i];
    const base = x.especie.bot.trim();
    let nombre = base;
    for (let k = 2; tomados.has(nombre.toLowerCase()); k++) nombre = `${base} ${k}`;
    tomados.add(nombre.toLowerCase());
    if (nombre !== x.especie.bot) {
      out[i] = { ...x, especie: { ...x.especie, bot: nombre } };
      if (nombre !== base) cambios.push({ i, de: base, a: nombre });
    }
  }
  cambios.sort((p, q) => p.i - q.i);
  return { especies: out, renombrados: cambios.map(({ de, a }) => ({ de, a })) };
}

/**
 * Siembras para corrida.sembrar (una por especie, con nombres únicos).
 * @param {EspecieLote[]} especies
 * @returns {Siembra[]}
 */
export const siembrasDe = (especies) =>
  nombresUnicos(especies).especies.map(({ especie: s, adn }) => ({
    nombre: s.bot,
    adn,
    cantidad: s.cantidad,
    color: s.color,
    vegetal: s.vegetal,
    energia: s.energia,
  }));

/**
 * Las especies en el formato del escenario, con nombres únicos. Los del
 * foro van por nombre (origen 'bestiario') con el lgHash de su .txt, así
 * el escenario avisa si el archivo cambia (verificarAdn) y el historial lo
 * cruza; los propios, con su ADN y su hash (como los deja especiesLote).
 * Uno del foro que ya no lleva el nombre del Bestiary (renombrado por
 * repetido o a mano) no se puede buscar por nombre: va con su ADN dentro
 * (origen 'propio', como el ADN pegado de Experimentar).
 * @param {EspecieLote[]} especies
 * @returns {Especie[]}
 */
export const especiesEscenario = (especies) =>
  nombresUnicos(especies).especies.map(({ especie, adn }, i) => {
    if (especie.origen === 'propio') return { ...especie };
    const x = especies[i];
    const delForo = x.entrada?.nombre ?? x.especie.bot;
    if (especie.bot === delForo) return { ...especie, hash: lgHash(adn) };
    return { ...especie, origen: 'propio', adn, hash: lgHash(adn) };
  });

/**
 * Una especie del lote con los campos elegidos a mano (siembra de un solo
 * bot, como «To the form» de la clásica): nombre, color, vegetal,
 * cantidad y energía. Lo que no es válido queda como estaba.
 * @template {EspecieLote} T
 * @param {T} x
 * @param {{nombre?: unknown, color?: unknown, vegetal?: unknown, cantidad?: unknown,
 *   energia?: unknown}} c
 * @returns {T}
 */
export function conCampos(x, c) {
  const s = { ...x.especie };
  const nombre = String(c.nombre ?? '').trim();
  if (nombre) s.bot = nombre;
  if (typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color))
    s.color = c.color.toLowerCase();
  if (typeof c.vegetal === 'boolean') s.vegetal = c.vegetal;
  const n = Math.trunc(Number(c.cantidad));
  if (Number.isFinite(n) && n >= 1) s.cantidad = Math.min(CANTIDAD_MAX, n);
  const en = Math.trunc(Number(c.energia));
  if (Number.isFinite(en) && en >= 1) s.energia = Math.min(ENERGIA_MAX, en);
  return { ...x, especie: s };
}

/**
 * Escenario propio nuevo con esas especies, sobre el mundo de la clásica
 * (base 'clasica' sin cambios ni objetos, como la Sopa primordial).
 * @param {Especie[]} especies
 * @param {{nombre: string, descripcion?: string}} meta
 * @param {Iterable<string>} [ocupados] ids de los escenarios propios
 * @returns {{ok: true, escenario: Escenario} | {ok: false, errores: ErrorValidacion[]}}
 */
export function escenarioLote(especies, meta, ocupados = []) {
  const nombre = String(meta.nombre ?? '').trim();
  const x = {
    formato: 1,
    id: idLibre(nombre, ocupados),
    nombre,
    descripcion: String(meta.descripcion ?? '').trim(),
    etiquetas: [],
    opciones: { base: 'clasica', cambios: {} },
    especies: especies.map((s) => ({ ...s })),
    objetos: { obstaculos: [], teleporters: [] },
  };
  const errores = validarPropio(x);
  if (errores.length) return { ok: false, errores };
  return { ok: true, escenario: normalizarPropio(x) };
}
