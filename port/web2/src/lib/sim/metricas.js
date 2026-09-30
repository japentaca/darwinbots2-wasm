// @ts-check
// Pedidos de métricas al worker (N2: mensajes opcionales `muestreo`,
// `linaje` y `dominante` de engine/worker.js) sobre la conexión de la
// sesión, solo con c.enviar y c.on. Sin DOM ni runes.

import { GRUPOS } from '../../../engine/metricas.js';

/**
 * @typedef {{ on: (t: string, cb: (m: any) => void) => () => void,
 *   enviar: (m: any) => void }} ConexionLike
 */

/**
 * @typedef {object} OpcionesMuestreo
 * @property {number} [cada]       ciclos entre muestras (decisión 8: 100)
 * @property {string[]} [grupos]   de la decisión 7 (por defecto, los seis)
 * @property {boolean} [linaje]    juntar el linaje entre muestras
 * @property {number} [dominante]  ADN dominante cada tantas muestras (0 = nunca)
 * @property {number} [bins]       barras de los histogramas
 */

/** Lo que pide la corrida de la interfaz: todo, cada 100 ciclos; ADN dominante cada 1.000. */
export const MUESTREO_CORRIDA = Object.freeze({
  cada: 100,
  grupos: [...GRUPOS],
  linaje: true,
  dominante: 10,
  bins: 20,
});

let secuencia = 0;

/**
 * Enciende (o reconfigura) el muestreo. Devuelve la correlación que llevan
 * sus muestras (las de antes llevan otra y se descartan).
 * @param {ConexionLike} c @param {OpcionesMuestreo} o
 */
export function activarMuestreo(c, o) {
  const req = `m${++secuencia}`;
  c.enviar({ t: 'muestreo', ...o, req });
  return req;
}

/** @param {ConexionLike} c */
export function apagarMuestreo(c) {
  c.enviar({ t: 'muestreo', cada: 0 });
}

/**
 * Un pedido con respuesta correlacionada por `req`.
 * @param {ConexionLike} c @param {'linaje' | 'dominante'} t @param {number} [ms]
 * @returns {Promise<any>}
 */
function pedir(c, t, ms = 15000) {
  const req = `${t}${++secuencia}`;
  return new Promise((res, rej) => {
    /** @type {any} */
    let plazo = null;
    const baja = c.on(t, (m) => {
      if (m.req !== req) return;
      baja();
      if (plazo) clearTimeout(plazo);
      res(m);
    });
    plazo = setTimeout(() => {
      baja();
      rej(new Error(`sin respuesta a ${t}`));
    }, ms);
    c.enviar({ t, req });
  });
}

/**
 * Linaje de ahora: {ciclo, filas, origen, nombres}.
 * @param {ConexionLike} c
 */
export const pedirLinaje = (c) => pedir(c, 'linaje');

/**
 * ADN dominante de cada especie viva, con el texto: {ciclo, especies[]}.
 * @param {ConexionLike} c
 */
export const pedirDominante = (c) => pedir(c, 'dominante');
