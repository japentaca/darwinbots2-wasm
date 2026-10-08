// @ts-check
// Memoria de ejemplo del visor de pila (PLAN-EDITOR E1.5): los valores que el
// visor usa para las sysvars que lee el ADN (`*.eye5` y compañía), para ver
// qué hace el gen con esos valores. Son de cada bot y se guardan en este
// navegador (localStorage); no van al bot ni a sus versiones.
//
// Igual que borrador.js: un Map del módulo es la copia de la sesión y
// localStorage la del navegador (sobrevive a recargar). Si el almacenamiento
// no está o falla, queda la de la sesión. La clave es la del bot (Entrada.clave).

const PREFIJO = 'dbw2.editor.pila:';

/**
 * @typedef {{getItem: (k: string) => string | null, setItem: (k: string, v: string) => void,
 *   removeItem: (k: string) => void}} Almacen
 */

/** @returns {Almacen | null} */
function local() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Solo enteros finitos, como pares [nombre, valor].
 * @param {Iterable<[string, number]>} pares
 * @returns {Map<string, number>}
 */
function limpio(pares) {
  /** @type {Map<string, number>} */
  const m = new Map();
  for (const [k, v] of pares)
    if (typeof k === 'string' && Number.isFinite(v)) m.set(k, Math.trunc(v));
  return m;
}

/**
 * @param {{mapa?: Map<string, Map<string, number>>, almacen?: Almacen | null}} [o] (tests)
 */
export function crearEjemplos(o = {}) {
  /** @type {Map<string, Map<string, number>>} */
  const mapa = o.mapa ?? new Map();
  const alm = () => (o.almacen === undefined ? local() : o.almacen);
  return {
    /** Los valores de ejemplo del bot (un Map nuevo; vacío si no hay). @param {string} clave */
    leer(clave) {
      const en = mapa.get(clave);
      if (en) return new Map(en);
      try {
        const s = alm()?.getItem(PREFIJO + clave);
        if (!s) return new Map();
        const pares = JSON.parse(s);
        if (!Array.isArray(pares)) return new Map();
        const m = limpio(pares.filter((p) => Array.isArray(p) && p.length === 2));
        mapa.set(clave, m);
        return new Map(m);
      } catch {
        return new Map();
      }
    },
    /** Guarda los valores del bot; sin valores, borra lo guardado. @param {string} clave @param {Map<string, number>} valores */
    guardar(clave, valores) {
      if (!clave) return;
      const m = limpio(valores);
      if (m.size === 0) {
        this.borrar(clave);
        return;
      }
      mapa.set(clave, m);
      try {
        alm()?.setItem(PREFIJO + clave, JSON.stringify([...m]));
      } catch {
        // sin lugar o sin permiso: queda el de la sesión
      }
    },
    /** @param {string} clave */
    borrar(clave) {
      mapa.delete(clave);
      try {
        alm()?.removeItem(PREFIJO + clave);
      } catch {
        // nada
      }
    },
  };
}

/** Los valores de ejemplo de la página. */
export const ejemplos = crearEjemplos();
