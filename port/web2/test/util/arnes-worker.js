// @ts-check
// Arnés para correr los workers de sim en node, dentro de un worker_thread:
//
//   workerEngine() — engine/worker.js (la orquestación nueva): shims de
//                    self/postMessage/importScripts, import del módulo y el
//                    mensaje {t:'init', base, v:''} con la URL file:// (absoluta,
//                    como exige el init) de port/build-wasm/.
//   workerWeb()    — port/web/worker.js (la clásica, congelada) con el mismo
//                    shim que usan tools/imrelay/smoke_im.mjs y compañía.
//
// Opciones deterministas (para comparar las dos orquestaciones): `fechaFija`
// congela Date (vbNowSimStart y el Timer de AssignSkin) y `semillaAzar`
// cambia Math.random por un LCG (colores de formas). Ninguna toca la sim:
// solo fijan las entradas de host que la clásica toma del reloj y del azar.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { BUILD_WASM, WEB, WEB2 } from './dbcore-node.js';

/**
 * @typedef {object} OpcionesArnes
 * @property {number} [fechaFija]    ms epoch que devuelve Date
 * @property {number} [semillaAzar]  semilla del LCG que reemplaza Math.random
 * @property {boolean} [init]        false = no mandar el init (engine)
 * @property {'modulo' | 'red'} [importScripts]  engine/worker.js sin un
 *                                   importScripts que funcione: 'modulo' = el
 *                                   de un worker módulo (lanza TypeError: el
 *                                   worker tiene que caer en fetch + eval;
 *                                   `fetch` lee file:// del disco), 'red' = un
 *                                   fallo de red (otro error: sin fetch)
 * @property {boolean} [atrapar]     las excepciones sin atrapar del worker se
 *                                   publican como {t:'uncaught', msg} en vez de
 *                                   terminar el worker_thread (en el navegador
 *                                   irían a worker.onerror)
 */

/** @param {OpcionesArnes} o */
function prologo(o) {
  let s = `
const { parentPort } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
globalThis.self = globalThis;
self.postMessage = (m, transfer) => parentPort.postMessage(m, transfer);
`;
  if (o.atrapar) {
    s += `
process.on('uncaughtException', (e) => self.postMessage({ t: 'uncaught', msg: String(e) }));
`;
  }
  if (o.fechaFija !== undefined) {
    s += `
{
  const RealDate = Date;
  const T = ${Number(o.fechaFija)};
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(T); else super(...a); }
    static now() { return T; }
  }
  globalThis.Date = FakeDate;
}
`;
  }
  if (o.semillaAzar !== undefined) {
    s += `
{
  let x = ${o.semillaAzar >>> 0} || 1;
  Math.random = () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
`;
  }
  return s;
}

/**
 * port/web/worker.js en un worker_thread (shim de smoke_im). Resuelve sus
 * rutas relativas contra port/web/: importScripts por el shim y el
 * locateFile ('../build-wasm/') contra el cwd, que el proceso tiene que
 * fijar en port/web/ (`process.chdir(WEB)`; los worker_threads no pueden).
 * @param {OpcionesArnes} [o]
 */
export function workerWeb(o = {}) {
  const src = `${prologo(o)}
self.importScripts = (...files) => {
  for (const f of files) {
    const p = path.resolve(${JSON.stringify(WEB)}, f);
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
  }
};
parentPort.on('message', (data) => { if (self.onmessage) self.onmessage({ data }); });
importScripts('worker.js');
`;
  return new Worker(src, { eval: true });
}

/**
 * engine/worker.js en un worker_thread. El módulo se importa en diferido:
 * los mensajes que llegan antes quedan en una cola del shim (y los que
 * llegan antes del wasm, en la del propio worker).
 * @param {OpcionesArnes} [o]
 */
export function workerEngine(o = {}) {
  const url = pathToFileURL(path.join(WEB2, 'engine', 'worker.js')).href;
  let cargador = `
self.importScripts = (...files) => {
  for (const f of files) {
    const p = require('node:url').fileURLToPath(f.replace(/\\?.*$/, ''));
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
  }
};
`;
  if (o.importScripts === 'modulo')
    cargador = `
self.importScripts = () => {
  throw new TypeError("Failed to execute 'importScripts': Module scripts don't support importScripts().");
};
self.fetch = async (u) => {
  self.postMessage({ t: 'fetch-usado', url: String(u) });
  const p = require('node:url').fileURLToPath(String(u).replace(/\\?.*$/, ''));
  return { ok: true, status: 200, text: async () => fs.readFileSync(p, 'utf8') };
};
`;
  else if (o.importScripts === 'red')
    cargador = `
self.importScripts = () => {
  const e = new Error('NetworkError: failed to load');
  e.name = 'NetworkError';
  throw e;
};
self.fetch = async () => {
  self.postMessage({ t: 'fetch-usado' });
  throw new Error('no debería usarse');
};
`;
  const src = `${prologo(o)}
globalThis.require = require;   // dbcore.js en modo node hace require('node:fs')
${cargador}
let antes = [];
parentPort.on('message', (data) => {
  if (antes) antes.push(data);
  else if (self.onmessage) self.onmessage({ data });
});
import(${JSON.stringify(url)}).then(() => {
  const q = antes;
  antes = null;
  for (const data of q) if (self.onmessage) self.onmessage({ data });
}, (err) => self.postMessage({ t: 'error', msg: 'import: ' + String(err) }));
`;
  const w = new Worker(src, { eval: true });
  if (o.init !== false) w.postMessage({ t: 'init', base: urlBuildWasm(), v: '' });
  return w;
}

/** URL file:// absoluta, con barra final, de port/build-wasm/ (el init de engine/worker.js). */
export function urlBuildWasm() {
  return `${pathToFileURL(BUILD_WASM).href}/`;
}

/**
 * Cliente mínimo de un worker de sim: acumula mensajes, espera por
 * predicado y devuelve cada frame con 'ack' (como la página).
 */
export class ClienteSim {
  /**
   * @param {Worker} w
   * @param {{ copiarFrames?: boolean }} [o]
   */
  constructor(w, o = {}) {
    this.w = w;
    /** @type {any[]} mensajes que no son frame, en orden */
    this.msgs = [];
    /** @type {Float32Array | null} copia del último frame */
    this.frame = null;
    /** @type {any} stats del último frame */
    this.stats = null;
    this.copiar = o.copiarFrames !== false;
    /** @type {Array<{pred: (m: any) => boolean, res: (m: any) => void}>} */
    this.waiters = [];
    /** @type {Error | null} */
    this.error = null;
    w.on('message', (m) => this.onMsg(m));
    w.on('error', (e) => {
      this.error = e;
    });
  }
  /** @param {any} m */
  onMsg(m) {
    if (m.t === 'frame') {
      if (this.copiar) this.frame = new Float32Array(m.buf.slice(0));
      this.stats = m.stats;
      this.w.postMessage({ t: 'ack', buf: m.buf }, [m.buf]);
    } else {
      this.msgs.push(m);
    }
    for (const w of this.waiters.slice())
      if (w.pred(m)) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        w.res(m);
      }
  }
  /**
   * @param {(m: any) => boolean} pred
   * @param {number} [ms]
   * @returns {Promise<any>}
   */
  wait(pred, ms = 30000) {
    return new Promise((res, rej) => {
      const w = { pred, res };
      this.waiters.push(w);
      setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) {
          this.waiters.splice(i, 1);
          rej(new Error('timeout esperando un mensaje del worker'));
        }
      }, ms).unref();
    });
  }
  /**
   * @param {any} m
   * @param {Transferable[]} [transfer]
   */
  send(m, transfer) {
    this.w.postMessage(m, /** @type {any} */ (transfer));
  }
  /**
   * Barrera: todo lo mandado antes ya se procesó (getopt es de solo lectura
   * y el worker atiende los mensajes en orden).
   */
  async sync() {
    this.send({ t: 'getopt', id: 1, sync: true });
    await this.wait((m) => m.t === 'opt', 600000);
  }
  stop() {
    return this.w.terminate();
  }
}
