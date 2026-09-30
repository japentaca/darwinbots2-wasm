// @ts-check
// Lint del editor de ADN (decisión 18): el mensaje {t:'lint-dna'} de
// engine/worker.js (db_dna_lint: no siembra ni toca ninguna sim) en un
// worker propio del editor, creado al primer uso y cerrado con cerrar().
// Solo importa la respuesta al ÚLTIMO pedido: las viejas se descartan.
// La fábrica del worker se inyecta (tests); en la página es un Worker del
// navegador con el init de C10.
//
// Si el worker no carga (el wasm falta o falla: {t:'error'} del worker,
// un error del Worker o ninguna respuesta en PLAZO_MS), el pedido se
// rechaza con ErrorLint y el worker se descarta: el editor muestra el
// error en vez de quedar esperando, y el próximo pedido prueba con uno
// nuevo.

import { BUILD_ID } from '../../../build.js';

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
  w.postMessage({ t: 'init', base: new URL('./build-wasm/', document.baseURI).href, v: BUILD_ID });
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

/**
 * @param {{crear?: () => CanalLint, plazoMs?: number}} [o]
 */
export function crearLinter(o = {}) {
  /** @type {CanalLint | null} */
  let canal = null;
  let n = 0;
  /** @type {{res: (v: any[] | null) => void, rej: (e: Error) => void, plazo: any} | null} */
  let pendiente = null;
  let esperado = '';

  /** Resuelve el pedido pendiente (y lo saca). @param {(p: NonNullable<typeof pendiente>) => void} fn */
  function soltar(fn) {
    const p = pendiente;
    pendiente = null;
    if (!p) return;
    clearTimeout(p.plazo);
    fn(p);
  }

  /** El worker no sirve: se rechaza lo pendiente y se descarta. @param {string} detalle */
  function caer(detalle) {
    const c = canal;
    canal = null;
    soltar((p) => p.rej(new ErrorLint(detalle)));
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
      if (m?.t !== 'lint-dna' || m.req !== esperado) return;
      soltar((p) => p.res(Array.isArray(m.issues) ? m.issues : []));
    });
    c.alError?.((e) => {
      if (canal === c) caer(String(e?.message ?? e));
    });
    return c;
  }

  return {
    /**
     * Hallazgos del lint para el texto; null si otro pedido lo reemplazó.
     * Rechaza con ErrorLint si el worker no carga.
     * @param {string} dna
     * @returns {Promise<import('./lint.js').HallazgoLint[] | null>}
     */
    lint(dna) {
      soltar((p) => p.res(null));
      let c;
      try {
        c = abrir();
      } catch (e) {
        return Promise.reject(new ErrorLint(String(/** @type {any} */ (e)?.message ?? e)));
      }
      esperado = `lint${++n}`;
      const req = esperado;
      return new Promise((res, rej) => {
        const plazo = setTimeout(() => {
          if (esperado === req) caer('tiempo');
        }, o.plazoMs ?? PLAZO_MS);
        pendiente = { res, rej, plazo };
        c.enviar({ t: 'lint-dna', dna, req });
      });
    },
    cerrar() {
      soltar((p) => p.res(null));
      canal?.terminar();
      canal = null;
    },
  };
}
