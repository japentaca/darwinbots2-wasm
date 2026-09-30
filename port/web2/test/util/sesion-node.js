// @ts-check
// Una sesión de sim mínima para node (la forma de SesionLike de
// src/lib/sim/corrida-nucleo.js) sobre ConexionSim y engine/worker.js real
// en un worker_thread (arnes-worker.js). La sesión de la interfaz
// (sesion.svelte.js) usa runes y no corre en node; esta hace lo mismo que
// ella en lo que la corrida usa: reset/cargar/guardar por la conexión,
// stats y tabla de especies de los frames.

import { ConexionSim } from '../../src/lib/sim/conexion.js';
import { urlBuildWasm, workerEngine } from './arnes-worker.js';

/**
 * @param {{ fechaFija?: number, semillaAzar?: number }} [o]
 */
export async function sesionNode(o = {}) {
  const nw = workerEngine({ ...o, init: false });
  /** @type {import('../../src/lib/sim/conexion.js').WorkerLike} */
  const w = {
    onmessage: null,
    onerror: null,
    postMessage: (m, tr) => nw.postMessage(m, /** @type {any} */ (tr)),
    terminate: () => void nw.terminate(),
  };
  nw.on('message', (data) => w.onmessage?.({ data }));
  nw.on('error', (e) => w.onerror?.(e));
  const c = new ConexionSim({
    worker: w,
    base: urlBuildWasm(),
    v: '',
    programar: (cb) => setImmediate(cb),
    ahora: () => 0,
  });
  const listo = new Promise((res, rej) => {
    c.on('ready', res);
    c.on('error', (m) => rej(new Error(String(m.msg))));
  });
  const s = {
    c,
    stats: { cycle: 0, bots: 0 },
    corriendo: false,
    hayMundo: false,
    /** @type {string[]} */
    especies: [],
    /** @param {any} m */
    reset(m) {
      s.hayMundo = true;
      c.reset(m);
    },
    /** @param {boolean} on */
    correr(on) {
      s.corriendo = on;
      c.run(on);
    },
    /** @param {number} n */
    seleccionar: (n) => c.select(n),
    /** @param {Uint8Array | ArrayBuffer} b */
    cargar(b) {
      s.hayMundo = true;
      return c.cargarConRespuesta(b);
    },
    guardar: () => c.save(),
    guardarConCiclo: () => c.saveConCiclo(),
    /** @param {any[]} mensajes */
    aplicarEnCiclo: (mensajes) =>
      c.aplicarEnCiclo(mensajes, s.corriendo ? () => s.corriendo : undefined),
    redibujar() {},
    /** n ticks sueltos. @param {number} n */
    pasos(n) {
      for (let i = 0; i < n; i++) c.step();
    },
    cerrar: () => c.terminar(),
  };
  c.on('frame', (ev) => {
    s.stats = ev.stats;
  });
  c.on('species', (m) => {
    s.especies = Array.isArray(m.names) ? m.names : [];
  });
  await listo;
  return s;
}
