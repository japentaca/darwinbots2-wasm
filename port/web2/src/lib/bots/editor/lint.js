// @ts-check
// Avisos del lint del ADN (db_dna_lint vía el mensaje {t:'lint-dna'} del
// worker; decisión 18), sin DOM. El core devuelve por cada hallazgo {kind,
// token, count, line, hint}; la pista viene en inglés desde el core, así que
// acá se clasifica en un código estable (el texto lo pone t('editor.lint.<código>'))
// y, cuando la pista trae la corrección, se arma el arreglo de un clic:
// cambiar esa palabra (todas sus apariciones fuera de comentarios) por otra.

import { reemplazarPalabras, tokensTexto } from '../../../../engine/lab.js';

/**
 * @typedef {{kind: string, token: string, count: number, line: number, hint: string}} HallazgoLint
 * @typedef {{de: string, a: string}} Arreglo
 * @typedef {{codigo: string, params: Record<string, string | number>, arreglo: Arreglo | null,
 *   linea: number, token: string, veces: number}} AvisoLint
 */

/** Sin los caracteres invisibles o fuera de ASCII (como StripNonAscii del core). @param {string} s */
const soloAscii = (s) => [...s].filter((c) => c >= ' ' && c <= '~').join('');

/**
 * Aviso del editor para un hallazgo del lint.
 * @param {HallazgoLint} h
 * @returns {AvisoLint}
 */
export function describirLint(h) {
  const token = String(h.token ?? '');
  const hint = String(h.hint ?? '');
  const estrella = token.startsWith('*') ? '*' : '';
  const base = { linea: h.line | 0, token, veces: h.count | 0 };
  /** @type {Record<string, string | number>} */
  const params = { token };
  /** @param {string} codigo @param {Arreglo | null} [arreglo] */
  const aviso = (codigo, arreglo = null) => ({ ...base, codigo, params, arreglo });
  switch (h.kind) {
    case 'nombre': {
      const dir = /did you mean address (\d+)\?/.exec(hint);
      if (dir) {
        params.sugerencia = estrella + dir[1];
        return aviso('nombre-direccion', { de: token, a: estrella + dir[1] });
      }
      const par = /did you mean (\.\S+)\?/.exec(hint);
      if (par) {
        params.sugerencia = estrella + par[1];
        return aviso('nombre-parecido', { de: token, a: estrella + par[1] });
      }
      if (/def is further down/.test(hint)) return aviso('nombre-def-abajo');
      if (/case-sensitive/.test(hint)) return aviso('nombre-mayusculas');
      return aviso('nombre-desconocido');
    }
    case 'palabra': {
      const limpia = soloAscii(token);
      if (/invisible character/.test(hint)) {
        params.sugerencia = limpia;
        return aviso('palabra-invisible-comando', { de: token, a: limpia });
      }
      if (/invisible or encoding/.test(hint))
        return aviso('palabra-invisible', limpia ? { de: token, a: limpia } : null);
      const punto = /missing dot\? (\.\S+)/.exec(hint);
      if (punto) {
        params.sugerencia = estrella + punto[1];
        return aviso('palabra-sin-punto', { de: token, a: estrella + punto[1] });
      }
      const par = /did you mean (\S+)\?/.exec(hint);
      if (par) {
        params.sugerencia = par[1];
        return aviso('palabra-parecida', { de: token, a: par[1] });
      }
      return aviso('palabra-desconocida');
    }
    case 'pegado': {
      const p = /reads as (\S*); "(.*)" is lost/.exec(hint);
      if (p) {
        params.leido = estrella + p[1];
        params.perdido = p[2];
        return aviso('pegado', { de: token, a: `${estrella}${p[1]} ${p[2]}` });
      }
      return aviso('pegado-otro');
    }
    case 'primero':
      return aviso('primero');
    case 'sombra':
      params.nombre = token.replace(/^def\s+/, '');
      return aviso('sombra');
    case 'error':
      params.codigo = token.replace(/^error\s+/, '');
      return aviso('error');
    default:
      return aviso('otro');
  }
}

/**
 * Aplica un arreglo: cada palabra igual a `de` (fuera de comentarios) pasa a
 * ser `a`.
 * @param {string} texto @param {Arreglo} arreglo
 */
export function aplicarArreglo(texto, arreglo) {
  const { tokens } = tokensTexto(texto);
  const cambios = [];
  for (const [i, k] of tokens.entries()) if (k.w === arreglo.de) cambios.push({ i, w: arreglo.a });
  return reemplazarPalabras(texto, cambios);
}

/**
 * Palabras marcadas por el lint (para subrayarlas en el resaltado).
 * @param {HallazgoLint[]} hallazgos
 */
export const palabrasMarcadas = (hallazgos) =>
  new Set(
    hallazgos
      .filter((h) => h.kind === 'nombre' || h.kind === 'palabra' || h.kind === 'pegado')
      .map((h) => h.token),
  );
