// @ts-check
// Admisión a una liga (PLAN-LIGAS.md, paso L3.1, decisión D7). Puro: sin DOM
// ni wasm. Dos funciones:
//
//   perfilLiga(adn)       lo que se sabe del ADN sin correrlo: cantidad de genes,
//                         de comandos de la familia store, sysvars que escribe y
//                         capacidades prohibidas por alguna liga (D7)
//   admitir(liga, entrada) ¿puede inscribirse? {ok, errores, avisos}
//
// Tres comprobaciones, de la más dura a la más blanda (D7):
//   forma del ADN ...... exacta (SB: ≤ 6 genes; SS: un solo store/inc/dec) → error
//   categoría .......... el board del foro o la etiqueta del nombre → aviso
//   acciones prohibidas  estático y APROXIMADO → aviso (el árbitro es la DQ)
//
// El análisis de acciones es una versión corta de la detección de
// port/tools/bestiary/analyze_bots.js (`geneCaps`/`scanGene`): mira el token
// anterior a cada comando de la familia store como destino y el anterior a
// ese como valor, pero NO sigue la pila como el analizador. Un destino o un
// valor calculados en tiempo de ejecución no se ven; para los bots del foro
// la UI usa sus `caps` ya calculadas por el core (profiles.json) y este
// módulo recibe las que vengan en `entrada.caps`.
//
// No importa engine/adn.js (que importa league.js) para no hacer un ciclo de
// módulos: league.js usa este archivo en lgPool (liga:<id>, paso L3.2).
//
// Los mensajes tienen la forma {clave, params} que usa el asistente
// (competir.admision.<motivo>, en src/i18n/*/competir.json).

import { ligaPorId } from './ligas.js';
import { genesAdn } from './lineage.js';
import { tokensEjecutables } from './pila.js';
import { COMANDOS, SYSVARS } from './vocabulario.js';

/**
 * @typedef {{clave: string, params?: Record<string, string | number>}} Mensaje
 * @typedef {{genes: number, stores: number, escribe: Set<string>, caps: Set<string>}} Perfil
 * @typedef {{nombre?: string, board?: string | null, veg?: boolean, adn: string,
 *   caps?: string[], genes?: number}} Entrada
 * @typedef {{ok: boolean, errores: Mensaje[], avisos: Mensaje[]}} Veredicto
 */

const STORES = new Set(COMANDOS.store);

/** Nombre de la sysvar de cada dirección (el primero de la tabla si hay alias). */
const NOMBRE_DE_DIR = new Map();
for (const [nombre, dir] of SYSVARS) if (!NOMBRE_DE_DIR.has(dir)) NOMBRE_DE_DIR.set(dir, nombre);

/** El nombre de sysvar (minúsculas, sin el punto) al que apunta un token, o null. */
function destino(w) {
  if (w[0] === '.') return w.slice(1).toLowerCase();
  if (/^-?\d+$/.test(w)) return NOMBRE_DE_DIR.get(Number.parseInt(w, 10)) ?? null;
  return null;
}

/**
 * Perfil estático del ADN: lo que se puede saber sin correrlo.
 *  - `genes`: cantidad de genes (contarGenes);
 *  - `stores`: tokens de la familia store (store, inc, dec, addstore…) en el
 *    cuerpo ejecutable;
 *  - `escribe`: sysvars escritas (el token anterior a un comando store, si es
 *    `.nombre` o la dirección de una sysvar);
 *  - `caps`: capacidades de las claves de D7 (las que alguna liga avisa).
 * @param {string} adn
 * @returns {Perfil}
 */
export function perfilLiga(adn) {
  const tokens = tokensEjecutables(adn).map((t) => t.w.toLowerCase());
  /** @type {Set<string>} */
  const escribe = new Set();
  /** @type {Set<string>} */
  const caps = new Set();
  let stores = 0;
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (!STORES.has(w)) continue;
    stores++;
    const nombre = i > 0 ? destino(tokens[i - 1]) : null;
    if (!nombre) continue;
    escribe.add(nombre);
    // El valor literal que `store` guarda (el token anterior al destino).
    const v =
      w === 'store' && i > 1 && /^-?\d+$/.test(tokens[i - 2]) ? Number(tokens[i - 2]) : null;
    if (nombre === 'shoot' && v !== null) {
      if (v === -8) caps.add('repro-sex');
      else if (v === -3) caps.add('veneno');
      else if (v > 0) caps.add('dispara-info');
    }
    if (nombre === 'tieloc' && v === -1) caps.add('come-lazo');
  }
  const escr = (re) => [...escribe].some((n) => re.test(n));
  if (
    escr(
      /^(tie|stifftie|deltie|tienum|tieloc|tieval|fixang|fixlen|readtie|tieang[1-4]|tielen[1-4])$/,
    )
  )
    caps.add('lazos');
  if (escr(/^(strvenom|mkvenom|venval|vloc)$/)) caps.add('veneno');
  if (escr(/^(strpoison|mkpoison|ploc|pval)$/)) caps.add('toxina');
  if (escr(/^(mkvirus|vshoot)$/)) caps.add('virus');
  if (escr(/^mkshell$/)) caps.add('caparazon');
  if (escr(/^mkslime$/)) caps.add('limo');
  if (escr(/^delgene$/)) caps.add('autoedita');
  if (escr(/^sexrepro$/)) caps.add('repro-sex');
  return { genes: genesAdn(adn).genes.length, stores, escribe, caps };
}

/** Una etiqueta de liga suelta o pegada a otras: «F2», «F2MB», «F3SB». */
const SOLO_ETIQUETAS = /^(?:f\d|mb|sb|ss)+$/i;

/**
 * Las etiquetas de categoría que el nombre lleva entre paréntesis, en
 * minúsculas: cada palabra del paréntesis que esté formada solo por
 * etiquetas (F1, F2, F3, MB, SB, SS) se parte en ellas. «Foo (F2MB)» →
 * {f2, mb}; «Foo (Version 1.1)» → {}.
 * @param {string} nombre
 * @returns {Set<string>}
 */
function etiquetasDeNombre(nombre) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const m of String(nombre ?? '').matchAll(/\(([^)]*)\)/g)) {
    for (const palabra of m[1].split(/[^A-Za-z0-9]+/)) {
      if (!SOLO_ETIQUETAS.test(palabra)) continue;
      for (const e of palabra.toLowerCase().match(/f\d|mb|sb|ss/g) ?? []) out.add(e);
    }
  }
  return out;
}

/**
 * ¿Puede inscribirse el bot en la liga? Errores: vegetal o forma del ADN que
 * pasa el máximo de la liga. Avisos: fuera de la categoría y acciones que la
 * liga descalifica. `liga` es el objeto del catálogo, su id, o null/ausente
 * (sin liga todo se admite). Los bots propios no tienen board: pasan la
 * categoría (D7).
 * @param {import('./ligas.js').Liga | string | null | undefined} liga
 * @param {Entrada} entrada
 * @returns {Veredicto}
 */
export function admitir(liga, entrada) {
  const L = typeof liga === 'string' ? ligaPorId(liga) : (liga ?? null);
  /** @type {Mensaje[]} */
  const errores = [];
  /** @type {Mensaje[]} */
  const avisos = [];
  if (!L) return { ok: true, errores, avisos };
  const nombre = entrada.nombre ?? '';
  const nombreLiga = L.id.toUpperCase();

  if (entrada.veg) errores.push({ clave: 'competir.admision.vegetal', params: { nombre } });

  const perfil = perfilLiga(entrada.adn);
  // sin ADN a mano (un bot del foro sin bajar) la cantidad de genes la da el perfil de la Biblioteca
  if (!entrada.adn && entrada.genes !== undefined) perfil.genes = entrada.genes;
  const { maxGenes, maxStores } = L.forma ?? {};
  if (maxGenes !== undefined && perfil.genes > maxGenes)
    errores.push({
      clave: 'competir.admision.genes',
      params: { nombre, liga: nombreLiga, genes: perfil.genes, max: maxGenes },
    });
  if (maxStores !== undefined && perfil.stores > maxStores)
    errores.push({
      clave: 'competir.admision.stores',
      params: { nombre, liga: nombreLiga, stores: perfil.stores, max: maxStores },
    });

  if (entrada.board != null && L.boards) {
    const tags = etiquetasDeNombre(nombre);
    const enBoard = L.boards.includes(entrada.board);
    const enNombre = L.etiquetas.some((e) => tags.has(e.toLowerCase()));
    if (!enBoard && !enNombre)
      avisos.push({
        clave: 'competir.admision.categoria',
        params: { nombre, liga: nombreLiga, board: entrada.board },
      });
  }

  const caps = entrada.caps ? new Set(entrada.caps) : perfil.caps;
  for (const cap of L.avisos)
    if (caps.has(cap))
      avisos.push({
        clave: 'competir.admision.accion',
        params: { nombre, liga: nombreLiga, cap },
      });

  return { ok: errores.length === 0, errores, avisos };
}

/**
 * Una entrada del índice de la Biblioteca (engine/biblioteca.js) → la
 * `entrada` de admitir(). Los del foro traen su board, sus `caps` (las
 * calculó el core) y la cantidad de genes del perfil, pero no el ADN (se
 * baja a pedido); los propios traen el ADN y se analizan con perfilLiga. Sin
 * perfil (un bot del foro que profiles.json no conoce) no hay caps ni genes:
 * solo cuenta la categoría.
 * @param {{nombre?: string, foro?: string | null, vegetal?: boolean, clase?: string, adn?: string,
 *   perfil?: {genes: number, caps: string[]} | null}} e
 * @returns {Entrada}
 */
export function entradaDeIndice(e) {
  /** @type {Entrada} */
  const out = {
    nombre: e.nombre ?? '',
    board: e.foro ?? null,
    veg: !!e.vegetal,
    adn: e.adn ?? '',
  };
  if (e.clase === 'foro' && e.perfil) {
    out.caps = e.perfil.caps;
    out.genes = e.perfil.genes;
  }
  return out;
}
