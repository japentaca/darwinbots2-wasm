// @ts-check
// Datos del Bestiary que usa el editor (C1: se leen de classic/bots/, la
// carpeta que publica la clásica), pedidos una sola vez y a pedido:
//   bots.json      nombres y archivos (nombres del foro, «Duplicar»)
//   profiles.json  capacidades por gen (panel «Genes», avisos del Laboratorio)
//   genes.json     el texto y la memoria de cada gen (Laboratorio, decisión 19)
//   <archivo>.txt  el ADN de un bot del foro

import { urlSitio } from '../../../build.js';

/** @type {Map<string, Promise<any>>} */
const cache = new Map();

/** @param {string} ruta */
const url = (ruta) => urlSitio(`classic/bots/${ruta}`);

/**
 * @param {string} ruta @param {'json' | 'text'} como
 * @returns {Promise<any>}
 */
function pedir(ruta, como) {
  let p = cache.get(ruta);
  if (!p) {
    p = fetch(url(ruta)).then((r) => {
      if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
      return como === 'json' ? r.json() : r.text();
    });
    cache.set(ruta, p);
    p.catch(() => cache.delete(ruta));
  }
  return p;
}

/** @returns {Promise<{file: string, name: string, board: string, veg: boolean}[]>} */
export const bestiario = () => pedir('bots.json', 'json');
/** @returns {Promise<import('../../../../engine/biblioteca.js').Perfiles>} */
export const perfiles = () => pedir('profiles.json', 'json');
/** @returns {Promise<import('../../../../engine/lab.js').GenesJson>} */
export const genesJson = () => pedir('genes.json', 'json');
/** @param {string} archivo @returns {Promise<string>} */
export const adnForo = (archivo) => pedir(encodeURIComponent(archivo), 'text');
