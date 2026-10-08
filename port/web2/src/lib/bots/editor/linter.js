// @ts-check
// Lint del editor de ADN (decisión 18): el mensaje {t:'lint-dna'} de
// engine/worker.js (db_dna_lint: no siembra ni toca ninguna sim) en un
// worker propio del editor, creado al primer uso y cerrado con cerrar().
// Solo importa la respuesta al ÚLTIMO pedido de cada clase (lint y traza del
// visor de pila, PLAN-EDITOR E1.5): las viejas se descartan.
// La fábrica del worker se inyecta (tests); en la página es un Worker del
// navegador con el init de C10.
//
// Si el worker no carga (el wasm falta o falla: {t:'error'} del worker,
// un error del Worker o ninguna respuesta en PLAZO_MS), el pedido se
// rechaza con ErrorLint y el worker se descarta: el editor muestra el
// error en vez de quedar esperando, y el próximo pedido prueba con uno
// nuevo.

import { BUILD_ID, urlSitio } from '../../../build.js';

export const PLAZO_MS = 30_000;

/**
 * @typedef {{enviar: (m: any) => void, on: (fn: (m: any) => void) => () => void,
 *   terminar: () => void, alError?: (fn: (e: any) => void) => () => void}} CanalLint
 */

/** El lint no está disponible (el worker o el wasm no cargaron). */
export class ErrorLint extends Error {
  /** @param {string} detalle */
  constructor(detalle) {
    super(detalle);
    this.codigo = 'lint-no-disponible';
  }
}

/** Worker del navegador (como el de la sesión, C10). @returns {CanalLint} */
function workerPagina() {
  const w = import.meta.env.DEV
    ? new Worker(new URL('../../../../engine/worker.js', import.meta.url), { type: 'module' })
    : new Worker(new URL('../../../../engine/worker.js', import.meta.url));
  w.postMessage({ t: 'init', base: urlSitio('build-wasm/'), v: BUILD_ID });
  return {
    enviar: (m) => w.postMessage(m),
    on: (fn) => {
      /** @param {MessageEvent} e */
      const h = (e) => fn(e.data);
      w.addEventListener('message', h);
      return () => w.removeEventListener('message', h);
    },
    alError: (fn) => {
      /** @param {ErrorEvent} e */
      const h = (e) => fn(e.message || 'worker');
      w.addEventListener('error', h);
      return () => w.removeEventListener('error', h);
    },
    terminar: () => w.terminate(),
  };
}

/** Un pedido en vuelo de un tipo (lint o traza). */
/** @typedef {{req: string, res: (v: any) => void, rej: (e: Error) => void, plazo: any}} Pendiente */

/**
 * @param {{crear?: () => CanalLint, plazoMs?: number}} [o]
 */
export function crearLinter(o = {}) {
  /** @type {CanalLint | null} */
  let canal = null;
  let n = 0;
  // Un pedido pendiente por clase: el lint y la traza del visor de pila se
  // piden juntos al cambiar el ADN, y no deben cancelarse entre sí.
  /** @type {{lint: Pendiente | null, traza: Pendiente | null}} */
  const pend = { lint: null, traza: null };

  /**
   * Resuelve el pedido pendiente de una clase (y lo saca).
   * @param {'lint' | 'traza'} clase @param {(p: Pendiente) => void} fn
   */
  function soltar(clase, fn) {
    const p = pend[clase];
    pend[clase] = null;
    if (!p) return;
    clearTimeout(p.plazo);
    fn(p);
  }

  /** @param {(p: Pendiente) => void} fn */
  function soltarTodos(fn) {
    soltar('lint', fn);
    soltar('traza', fn);
  }

  /** El worker no sirve: se rechaza lo pendiente y se descarta. @param {string} detalle */
  function caer(detalle) {
    const c = canal;
    canal = null;
    soltarTodos((p) => p.rej(new ErrorLint(detalle)));
    try {
      c?.terminar();
    } catch {
      // ya estaba cerrado
    }
  }

  function abrir() {
    if (canal) return canal;
    const c = (o.crear ?? workerPagina)();
    canal = c;
    c.on((m) => {
      if (canal !== c) return;
      if (m?.t === 'error') {
        caer(String(m.msg ?? m.clave ?? 'error'));
        return;
      }
      if (m?.t === 'lint-dna' && pend.lint?.req === m.req)
        soltar('lint', (p) => p.res(Array.isArray(m.issues) ? m.issues : []));
      else if (m?.t === 'trace-dna' && pend.traza?.req === m.req)
        soltar('traza', (p) => p.res(String(m.tsv ?? '')));
    });
    c.alError?.((e) => {
      if (canal === c) caer(String(e?.message ?? e));
    });
    return c;
  }

  /**
   * Manda un pedido de la clase dada y espera su respuesta. El anterior de la
   * misma clase se resuelve con null (ya no importa).
   * @param {'lint' | 'traza'} clase
   * @param {Record<string, any>} mensaje sin `req`
   * @returns {Promise<any>}
   */
  function pedir(clase, mensaje) {
    soltar(clase, (p) => p.res(null));
    let c;
    try {
      c = abrir();
    } catch (e) {
      return Promise.reject(new ErrorLint(String(/** @type {any} */ (e)?.message ?? e)));
    }
    const req = `${clase}${++n}`;
    return new Promise((res, rej) => {
      const plazo = setTimeout(() => {
        if (pend[clase]?.req === req) caer('tiempo');
      }, o.plazoMs ?? PLAZO_MS);
      pend[clase] = { req, res, rej, plazo };
      c.enviar({ ...mensaje, req });
    });
  }

  return {
    /**
     * Hallazgos del lint para el texto; null si otro pedido lo reemplazó.
     * Rechaza con ErrorLint si el worker no carga.
     * @param {string} dna
     * @returns {Promise<import('./lint.js').HallazgoLint[] | null>}
     */
    lint(dna) {
      return pedir('lint', { t: 'lint-dna', dna });
    },
    /**
     * Traza (TSV de db_dna_trace, sin parsear) del gen del ADN con la memoria
     * de ejemplo; null si otro pedido lo reemplazó. Rechaza con ErrorLint si
     * el worker no carga. Como el lint, anda sin sim (PLAN-EDITOR E1.5).
     * @param {string} dna
     * @param {number[] | null} mem  1001 enteros o null
     * @param {number} seed
     * @returns {Promise<string | null>}
     */
    trazar(dna, mem, seed) {
      return pedir('traza', { t: 'trace-dna', dna, mem, seed });
    },
    cerrar() {
      soltarTodos((p) => p.res(null));
      canal?.terminar();
      canal = null;
    },
  };
}
