// @ts-check
// Corre UNA réplica en un worker de sim (engine/worker.js) sin dibujar, a
// máxima velocidad y hasta un ciclo objetivo (decisión 10), con muestreo.
// Puro JS, sin DOM ni runes: el worker llega envuelto en un «canal» (en la
// página, un Worker del navegador; en los tests, un worker_thread del arnés).
//
// Cómo avanza: con {t:'step'} en tandas, no con {t:'run'}. Un step es un
// tick exacto, así que los eventos de la corrida (cambios en caliente y
// siembras) se mandan justo cuando la sim está en su ciclo (decisión 13):
// el worker atiende en orden. Tras cada tanda va un {t:'ciclo', req} que
// confirma el ciclo (y marca el progreso); como mucho `enVuelo` tandas sin
// confirmar. No se devuelve ningún frame con 'ack': el worker publica uno
// solo y después deja de armarlos (sin costo de dibujo).
//
// Muestras: el muestreo se configura DESPUÉS del reset (en un worker usado,
// antes del reset publicaría una muestra de la sim vieja) con una
// correlación propia; las muestras de otra correlación se descartan. Si el
// objetivo no es múltiplo de `cada`, al llegar se vuelve a mandar el
// muestreo (publica una muestra en el acto): la historia termina en el
// objetivo. Además de la historia se devuelve la última muestra CRUDA
// (`final`): la tabla de valores finales no puede usar el último punto de
// la historia, que en una réplica larga es la media de varias muestras.
//
// Ronda reiniciada (modo de reinicio, opt 90, o la ronda nueva de F1): el
// worker arma otra sim y el ciclo vuelve atrás. Una réplica mide UNA
// corrida hasta el objetivo, así que se TERMINA ahí: el resultado trae la
// historia y la muestra final de antes del reinicio y `reinicio: {ciclo,
// esperado}` (el ciclo al que volvió y el que se esperaba). No es un error
// («desfase» queda para un ciclo que se ADELANTA, que no debería pasar).

import {
  agregarMuestra,
  historiaReplica,
  mensajesReplica,
  muestraFinal,
  planReplica,
  resultadoReplica,
} from '../../../engine/replicas.js';

/**
 * @typedef {object} Canal
 * @property {(m: any) => void} enviar
 * @property {(fn: (m: any) => void) => () => void} on          mensajes del worker
 * @property {(fn: (e: any) => void) => () => void} [alError]   excepción del worker
 */

/** Error de una réplica con código estable (texto: t('comparar.error.<codigo>')). */
export class ErrorReplica extends Error {
  /** @param {string} codigo @param {string} [detalle] */
  constructor(codigo, detalle) {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.name = codigo === 'abortada' ? 'AbortError' : 'ErrorReplica';
    this.codigo = codigo;
  }
}

let secuencia = 0;

/**
 * Corre la réplica i del trabajo y devuelve su resultado
 * (resultadoReplica de engine/replicas.js: historia serializada con solo
 * las métricas globales, última muestra cruda y, si la ronda se reinició,
 * dónde).
 * @param {{
 *   canal: Canal,
 *   params: import('../../../engine/replicas.js').ParamsReplicas,
 *   i: number,
 *   progreso?: (fr: number) => void,
 *   senal?: AbortSignal,
 *   tanda?: number,
 *   enVuelo?: number,
 *   plazoMs?: number,
 * }} o
 * @returns {Promise<import('../../../engine/replicas.js').ResultadoReplica>}
 */
export async function correrReplica(o) {
  const { canal, params: p } = o;
  const tanda = Math.max(1, o.tanda ?? 50);
  const enVuelo = Math.max(1, o.enVuelo ?? 4);
  const plazoMs = o.plazoMs ?? 120_000;
  const msgs = mensajesReplica(p, o.i);
  const req = `rep${++secuencia}-${o.i}`;
  const hist = historiaReplica(p);
  /** @type {import('../../../engine/replicas.js').MuestraFinal | null} */
  let final = null;
  /** @type {{ciclo: number, esperado: number} | null} */
  let reinicio = null;
  let nCiclo = 0;
  /** @type {Map<string, {res: (c: number) => void, rej: (e: Error) => void}>} */
  const pedidos = new Map();
  /** @type {Error | null} */
  let fallo = null;

  /** @param {Error} e */
  const fallar = (e) => {
    fallo ??= e;
    for (const pd of pedidos.values()) pd.rej(e);
    pedidos.clear();
  };

  /** @param {any} m */
  const alMuestra = (m) => {
    if (reinicio) return;
    // Una muestra que no avanza es de una ronda nueva (el ciclo volvió atrás).
    if (final && m.ciclo <= final.ciclo) {
      reinicio = { ciclo: m.ciclo, esperado: final.ciclo };
      return;
    }
    agregarMuestra(hist, m);
    final = muestraFinal(m);
  };

  const bajas = [
    canal.on((m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'muestra' && m.req === req) alMuestra(m);
      else if (m.t === 'ciclo' && typeof m.req === 'string' && pedidos.has(m.req)) {
        const pd = pedidos.get(m.req);
        pedidos.delete(m.req);
        pd?.res(m.cycle);
      } else if (m.t === 'error') fallar(new ErrorReplica('carga', String(m.msg ?? m.clave)));
    }),
  ];
  if (canal.alError)
    bajas.push(canal.alError((e) => fallar(new ErrorReplica('worker', String(e?.message ?? e)))));
  const alAbortar = () => fallar(new ErrorReplica('abortada'));
  o.senal?.addEventListener('abort', alAbortar);

  /** Pide el ciclo (barrera: todo lo anterior ya se atendió). @returns {Promise<number>} */
  const pedirCiclo = () => {
    if (fallo) return Promise.reject(fallo);
    const r = `${req}:c${++nCiclo}`;
    /** @type {Promise<number>} */
    const pr = new Promise((res, rej) => {
      const plazo = setTimeout(() => {
        pedidos.delete(r);
        rej(new ErrorReplica('tiempo'));
      }, plazoMs);
      pedidos.set(r, {
        res: (c) => {
          clearTimeout(plazo);
          res(c);
        },
        rej: (e) => {
          clearTimeout(plazo);
          rej(e);
        },
      });
      canal.enviar({ t: 'ciclo', req: r });
    });
    // Las tandas en vuelo que nadie llega a esperar (fallo, aborto) no
    // dejan rechazos sin atender; quien la espera recibe el error igual.
    pr.catch(() => {});
    return pr;
  };

  /**
   * Controla un ciclo confirmado: atrás = ronda reiniciada (se anota y se
   * termina), adelante = desfase (error).
   * @param {number} c @param {number} esperado
   */
  const controlar = (c, esperado) => {
    if (reinicio) return;
    if (c < esperado) reinicio = { ciclo: c, esperado };
    else if (c !== esperado) throw new ErrorReplica('desfase', `${c} ≠ ${esperado}`);
  };

  try {
    if (o.senal?.aborted) throw new ErrorReplica('abortada');
    for (const m of msgs.inicio) canal.enviar(m);
    canal.enviar({ ...msgs.muestreo, req });
    const c0 = await pedirCiclo();
    const objetivo = p.ciclos;
    const plan = planReplica(msgs.eventos, c0, objetivo);
    const total = Math.max(1, objetivo - c0);
    let actual = c0;
    /** @type {{hasta: number, p: Promise<number>}[]} */
    const vuelo = [];
    /** Espera la tanda más vieja y controla el ciclo. */
    const confirmar = async () => {
      const v = /** @type {{hasta: number, p: Promise<number>}} */ (vuelo.shift());
      const c = await v.p;
      controlar(c, v.hasta);
      if (!reinicio) o.progreso?.((c - c0) / total);
    };
    pasos: for (const paso of plan) {
      while (actual < paso.ciclo) {
        if (fallo) throw fallo;
        if (reinicio) break pasos;
        const n = Math.min(tanda, paso.ciclo - actual);
        for (let k = 0; k < n; k++) canal.enviar({ t: 'step' });
        actual += n;
        vuelo.push({ hasta: actual, p: pedirCiclo() });
        if (vuelo.length >= enVuelo) await confirmar();
      }
      if (reinicio) break;
      for (const m of paso.mensajes) canal.enviar(m);
    }
    // Las tandas que quedan (también tras un reinicio: el worker queda sin
    // pedidos pendientes para la próxima réplica).
    while (vuelo.length) await confirmar();
    if (!reinicio) {
      if (hist.ultimoCiclo !== objetivo) canal.enviar({ ...msgs.muestreo, req });
      const fin = await pedirCiclo();
      controlar(fin, objetivo);
    }
    if (fallo) throw fallo;
    // Deja el worker callado para la próxima (sin muestreo).
    canal.enviar({ t: 'muestreo', cada: 0 });
    o.progreso?.(1);
    return resultadoReplica(hist, final, reinicio);
  } finally {
    o.senal?.removeEventListener('abort', alAbortar);
    for (const b of bajas) b();
    for (const pd of pedidos.values()) pd.rej(new ErrorReplica('abortada'));
    pedidos.clear();
  }
}
