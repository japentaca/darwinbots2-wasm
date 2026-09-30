// @ts-check
// Rótulos traducidos de Bots: capacidades, sus grupos, arquetipos, tamaños,
// disparos y los títulos de los grupos de la biblioteca. Los que faltan en
// src/i18n caen al rótulo de profiles.json (en inglés) o al valor mismo.
// Los boards del foro, los nombres de bots y los tags no se traducen.

import { t } from '../../i18n/index.svelte.js';
import { DISPAROS_CONOCIDOS } from './adn.js';

export { ARQUETIPOS, CAPS, GRUPOS_CAP } from './textos.js';

/**
 * @typedef {import('../../../engine/biblioteca.js').Perfiles} Perfiles
 * @typedef {import('../../../engine/biblioteca.js').ClaveGrupo} ClaveGrupo
 */

/**
 * t(clave) o `otro` si la clave no tiene texto.
 * @param {string} clave @param {string} otro
 */
function tO(clave, otro) {
  const s = t(clave);
  return s === clave ? otro : s;
}

/** @param {string} cap @param {Perfiles | null} [p] */
export const rotuloCap = (cap, p) => tO(`bots.cap.${cap}`, p?.caps?.[cap]?.label ?? cap);

/** Descripción técnica de la capacidad (profiles.json, en inglés: nombra sysvars). @param {string} cap @param {Perfiles | null} [p] */
export const descCap = (cap, p) => p?.caps?.[cap]?.desc ?? '';

/** @param {string} grupo */
export const rotuloGrupoCap = (grupo) => tO(`bots.capGrupo.${grupo}`, grupo);

/** @param {string | null | undefined} arq @param {Perfiles | null} [p] */
export const rotuloArquetipo = (arq, p) =>
  arq ? tO(`bots.arquetipo.${arq}`, p?.archetypes?.[arq] ?? arq) : t('bots.arquetipo.ninguno');

/** @param {string | null | undefined} tam */
export const rotuloTamano = (tam) => (tam ? tO(`bots.tamano.${tam}`, tam) : t('bots.sinPerfil'));

/** @param {number} n */
export const rotuloDisparo = (n) =>
  DISPAROS_CONOCIDOS.includes(n) ? t(`bots.disparo.${-n}`, { n }) : String(n);

/**
 * Título de un grupo de la biblioteca.
 * @param {ClaveGrupo} c @param {Perfiles | null} [p]
 */
export function tituloGrupo(c, p) {
  const v = c.valor;
  switch (c.tipo) {
    case 'foro':
      return v === null ? t('bots.grupo.propios') : String(v);
    case 'arquetipo':
      return v === null ? t('bots.grupo.sinPerfil') : rotuloArquetipo(String(v), p);
    case 'capacidad':
      return v === null ? t('bots.grupo.soloBasicas') : rotuloCap(String(v), p);
    case 'tag':
      return v === null ? t('bots.grupo.sinTags') : `#${v}`;
    case 'tamano':
      return v === null ? t('bots.grupo.sinPerfil') : rotuloTamano(String(v));
    case 'fav':
      return v ? t('bots.grupo.favoritos') : t('bots.grupo.otros');
    case 'origen':
      return v === 'propio' ? t('bots.grupo.propios') : t('bots.grupo.foro');
    default:
      return t('bots.grupo.todos');
  }
}

/**
 * Las capacidades de profiles.json agrupadas por su grupo, en el orden del
 * archivo.
 * @param {Perfiles | null} p @returns {Array<[string, string[]]>}
 */
export function capsPorGrupo(p) {
  /** @type {Map<string, string[]>} */
  const g = new Map();
  for (const [k, c] of Object.entries(p?.caps ?? {})) {
    let l = g.get(c.group);
    if (!l) {
      l = [];
      g.set(c.group, l);
    }
    l.push(k);
  }
  return [...g.entries()];
}
