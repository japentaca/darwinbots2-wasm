// @ts-check
// Datos del foro para Bots (decisión C1): classic/bots/bots.json (el mismo
// índice que usa Observar, src/lib/observar/bestiario.js), profiles.json,
// genes.json (solo para armar híbridos viejos al migrar o importar) y el
// .txt de cada bot. Se piden una vez y quedan en memoria.

import { indiceBestiario } from '../observar/bestiario.js';

/** @param {string} ruta */
const url = (ruta) => new URL(`./classic/bots/${ruta}`, document.baseURI).href;

/**
 * @typedef {import('../../../engine/biblioteca.js').BotForo} BotForo
 * @typedef {import('../../../engine/biblioteca.js').Perfiles} Perfiles
 * @typedef {import('../../../engine/adn.js').GenesJson} GenesJson
 */

/** @param {string} ruta */
async function json(ruta) {
  const r = await fetch(url(ruta));
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

/** @type {Promise<Perfiles | null> | null} */
let perfiles = null;
/** @type {Promise<GenesJson | null> | null} */
let genes = null;
/** @type {Map<string, Promise<string>>} */
const textos = new Map();
/** @type {string[]} */
let nombres = [];

/**
 * El Bestiary y los perfiles. Sin profiles.json, perfiles = null (la
 * biblioteca sigue, sin capacidades); sin bots.json, lanza.
 * @returns {Promise<{bestiario: BotForo[], perfiles: Perfiles | null}>}
 */
export async function cargarForo() {
  perfiles ??= json('profiles.json').catch(() => {
    perfiles = null;
    return null;
  });
  const [bestiario, p] = await Promise.all([
    /** @type {Promise<BotForo[]>} */ (indiceBestiario()),
    perfiles,
  ]);
  nombres = bestiario.map((b) => b.name);
  return { bestiario, perfiles: p };
}

/** genes.json (null si no se pudo leer). @returns {Promise<GenesJson | null>} */
export function cargarGenes() {
  genes ??= json('genes.json').catch(() => {
    genes = null;
    return null;
  });
  return genes;
}

/** Nombres del Bestiary ya cargados (para crearBots: aviso de nombre del foro). */
export const nombresForo = () => nombres;

/**
 * El .txt de un bot del foro.
 * @param {string} archivo @returns {Promise<string>}
 */
export function adnForo(archivo) {
  let p = textos.get(archivo);
  if (!p) {
    p = fetch(url(encodeURIComponent(archivo))).then((r) => {
      if (!r.ok) throw new Error(`${archivo}: ${r.status}`);
      return r.text();
    });
    textos.set(archivo, p);
    p.catch(() => textos.delete(archivo));
  }
  return p;
}

/**
 * ADN de una entrada de la biblioteca: el de un propio (su última versión)
 * o el .txt de uno del foro.
 * @param {import('../../../engine/biblioteca.js').Entrada} e
 * @returns {Promise<string | undefined>}
 */
export async function adnDeEntrada(e) {
  if (e.clase === 'propio') return e.adn;
  return e.archivo ? adnForo(e.archivo) : undefined;
}
