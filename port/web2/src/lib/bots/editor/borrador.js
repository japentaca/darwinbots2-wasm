// @ts-check
// Borrador por bot del editor de ADN: lo escrito y sin guardar no se pierde
// al salir de la pestaña ADN, al cambiar de bot ni al recargar.
//
// Vive en un Map del módulo (dura toda la sesión, aunque el editor se
// desmonte) y se copia a localStorage (sobrevive a una recarga; si el
// almacenamiento no está o falla, solo queda el de la sesión). La clave es
// la del bot (Entrada.clave). Cada borrador guarda el texto y la `base`: el
// texto guardado sobre el que se escribió. Al volver:
//   - base igual al texto guardado de hoy → se restaura solo, con aviso;
//   - base distinta (el bot cambió por otro lado) → se ofrece recuperarlo.
// Un borrador igual al texto guardado no se guarda (y borra el que hubiera).

const PREFIJO = 'dbw2.editor.borrador:';

/**
 * @typedef {{texto: string, base: string, fecha: string}} Borrador
 * @typedef {{getItem: (k: string) => string | null, setItem: (k: string, v: string) => void,
 *   removeItem: (k: string) => void}} Almacen
 */

/** @type {Map<string, Borrador>} */
const sesion = new Map();

/** @returns {Almacen | null} */
function local() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {{almacen?: Almacen | null, mapa?: Map<string, Borrador>}} [o] (tests)
 */
export function crearBorradores(o = {}) {
  const mapa = o.mapa ?? sesion;
  const alm = () => (o.almacen === undefined ? local() : o.almacen);
  return {
    /** @param {string} clave @returns {Borrador | null} */
    leer(clave) {
      const b = mapa.get(clave);
      if (b) return b;
      try {
        const s = alm()?.getItem(PREFIJO + clave);
        if (!s) return null;
        const x = JSON.parse(s);
        if (typeof x?.texto !== 'string' || typeof x?.base !== 'string') return null;
        /** @type {Borrador} */
        const r = { texto: x.texto, base: x.base, fecha: String(x.fecha ?? '') };
        mapa.set(clave, r);
        return r;
      } catch {
        return null;
      }
    },
    /** @param {string} clave @param {string} texto @param {string} base */
    guardar(clave, texto, base) {
      if (!clave) return;
      if (texto === base) {
        this.borrar(clave);
        return;
      }
      const b = { texto, base, fecha: new Date().toISOString() };
      mapa.set(clave, b);
      try {
        alm()?.setItem(PREFIJO + clave, JSON.stringify(b));
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

/** Los borradores de la página. */
export const borradores = crearBorradores();

/** Texto con saltos LF (el editor trabaja siempre en LF). @param {string} s */
export const aLf = (s) => String(s ?? '').replace(/\r\n?/g, '\n');
