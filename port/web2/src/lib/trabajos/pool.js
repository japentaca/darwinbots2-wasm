// @ts-check
// Workers de sim para los trabajos en segundo plano (decisión 10): se crean
// a pedido, se reutilizan (C15: el reset `limpio` deja un worker usado igual
// que uno nuevo) y se cierran al quedar ociosos un rato. Sin
// SharedArrayBuffer (decisión 3): cada réplica corre en su worker y solo
// viajan mensajes. Puro JS: la fábrica de workers se inyecta (en la página,
// Workers del navegador con el init de C10; en los tests, worker_threads).
//
// Un worker que falló o se abortó a mitad de una réplica se descarta
// (terminate): no se sabe en qué quedó su cola de mensajes.

import { ErrorReplica } from './replica.js';

/**
 * @typedef {object} WorkerTrabajo
 * @property {import('./replica.js').Canal} canal
 * @property {() => void} terminar
 */

/**
 * @typedef {object} OpcionesPool
 * @property {() => WorkerTrabajo} crear   worker nuevo (ya con su init)
 * @property {number} [ociosoMs]          cerrar los libres tras este tiempo sin uso (0 = nunca)
 * @property {number} [plazoListoMs]      espera máxima del {t:'ready'}
 */

export class PoolWorkers {
  #crear;
  #ociosoMs;
  #plazoListoMs;
  /** @type {WorkerTrabajo[]} */
  #libres = [];
  /** @type {Set<WorkerTrabajo>} */
  #usados = new Set();
  /** @type {any} */
  #timer = null;

  /** @param {OpcionesPool} o */
  constructor(o) {
    this.#crear = o.crear;
    this.#ociosoMs = o.ociosoMs ?? 30_000;
    this.#plazoListoMs = o.plazoListoMs ?? 60_000;
  }

  /** Workers vivos (libres + en uso). */
  get tamaño() {
    return this.#libres.length + this.#usados.size;
  }

  /**
   * Un worker listo (uno libre, o uno nuevo cuando carga el motor).
   * @param {AbortSignal} [senal]
   * @returns {Promise<WorkerTrabajo>}
   */
  async tomar(senal) {
    if (senal?.aborted) throw new ErrorReplica('abortada');
    this.#cancelarCierre();
    const libre = this.#libres.pop();
    if (libre) {
      this.#usados.add(libre);
      return libre;
    }
    const w = this.#crear();
    this.#usados.add(w);
    try {
      await this.#listo(w, senal);
      return w;
    } catch (e) {
      this.descartar(w);
      throw e;
    }
  }

  /** Devuelve un worker sano al pool. @param {WorkerTrabajo} w */
  soltar(w) {
    if (!this.#usados.delete(w)) return;
    this.#libres.push(w);
    this.#programarCierre();
  }

  /** Termina un worker (falló o quedó a mitad). @param {WorkerTrabajo} w */
  descartar(w) {
    this.#usados.delete(w);
    const i = this.#libres.indexOf(w);
    if (i >= 0) this.#libres.splice(i, 1);
    try {
      w.terminar();
    } catch {
      // ya estaba terminado
    }
    this.#programarCierre();
  }

  /** Termina los libres (los en uso siguen). */
  cerrarLibres() {
    for (const w of this.#libres.splice(0)) {
      try {
        w.terminar();
      } catch {
        // ya estaba terminado
      }
    }
  }

  /** Termina todos. */
  cerrarTodos() {
    this.#cancelarCierre();
    this.cerrarLibres();
    for (const w of [...this.#usados]) this.descartar(w);
  }

  #cancelarCierre() {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #programarCierre() {
    this.#cancelarCierre();
    if (!this.#ociosoMs || this.#usados.size || !this.#libres.length) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (!this.#usados.size) this.cerrarLibres();
    }, this.#ociosoMs);
    this.#timer?.unref?.();
  }

  /**
   * Espera el {t:'ready'} del worker ({t:'error'} = el motor no cargó).
   * @param {WorkerTrabajo} w @param {AbortSignal} [senal]
   * @returns {Promise<void>}
   */
  #listo(w, senal) {
    return new Promise((res, rej) => {
      /** @type {(() => void)[]} */
      const bajas = [];
      const fin = () => {
        for (const b of bajas) b();
        clearTimeout(plazo);
        senal?.removeEventListener('abort', abortar);
      };
      const plazo = setTimeout(() => {
        fin();
        rej(new ErrorReplica('tiempo', 'ready'));
      }, this.#plazoListoMs);
      const abortar = () => {
        fin();
        rej(new ErrorReplica('abortada'));
      };
      senal?.addEventListener('abort', abortar);
      bajas.push(
        w.canal.on((m) => {
          if (m?.t === 'ready') {
            fin();
            res();
          } else if (m?.t === 'error') {
            fin();
            rej(new ErrorReplica('carga', String(m.msg ?? m.clave)));
          }
        }),
      );
      if (w.canal.alError)
        bajas.push(
          w.canal.alError((e) => {
            fin();
            rej(new ErrorReplica('worker', String(e?.message ?? e)));
          }),
        );
    });
  }
}

/** Tope de unidades en paralelo que acepta la interfaz. */
export const TOPE_MAX = 32;
/** Tope por defecto (sin uno configurado): cada worker carga su motor y su memoria. */
export const TOPE_POR_DEFECTO = 8;

/**
 * Unidades en paralelo: hardwareConcurrency − 1 (deja un núcleo para la
 * página), al menos 1 y como mucho el tope configurado (sin tope,
 * TOPE_POR_DEFECTO; nunca más de TOPE_MAX).
 * @param {number | undefined} nucleos @param {number | null | undefined} [tope]
 */
export function paraleloDe(nucleos, tope) {
  const n = Math.max(1, (Math.trunc(Number(nucleos)) || 2) - 1);
  const t = Math.trunc(Number(tope));
  return Math.min(n, t >= 1 ? t : TOPE_POR_DEFECTO, TOPE_MAX);
}
