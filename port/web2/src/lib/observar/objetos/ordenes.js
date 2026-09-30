// @ts-check
// Barra «Mundo» de Observar (decisión 15, paso N3.8): la parte pura.
//
// Cada acción de la barra es una orden de objeto (engine/corridas.js,
// EventoObjetos) que se manda al worker en un ciclo exacto y queda como
// evento de la corrida (decisión 13): las réplicas la repiten en el mismo
// ciclo. «Guardar en el escenario» pliega las órdenes en los objetos del
// escenario (C13: órdenes, no posiciones), con estas reglas:
//   - crear (forma, formas, laberinto, teleporter) agrega su orden;
//   - borrar todas las formas (o todos los teleporters) vacía esa lista;
//   - borrar un teleporter quita una orden de teleporter (son todas iguales:
//     el motor sortea dónde va cada uno);
//   - borrar una forma suelta o 10 al azar no tiene orden equivalente en el
//     escenario (no se sabe qué orden la creó: un laberinto crea muchas):
//     se conservan las órdenes de creación y el resultado se marca
//     `aproximado` para avisarlo.
// El laberinto polar además enciende la deriva de las formas (opciones
// 83–85, DERIVA_POLAR): es un cambio de opciones en su posición entre los
// eventos, que se pliega en los cambios del escenario (y no se va al borrar
// las formas: la sim sigue con la deriva).

import { copiaOrden, errorOrden } from '../../../../engine/corridas.js';
import { DERIVA_POLAR, TOPE_TELEPORTERS, tienePolar } from '../../../../engine/escenarios/index.js';
import { fusionarCambios } from '../../../../engine/opciones.js';

/** Tamaño por defecto de una forma nueva (fracción del campo). */
export const TAMANO_DEF = 0.2;
/** Pasillo y muro por defecto de un laberinto. */
export const PASILLO_DEF = 500;
export const MURO_DEF = 50;
/** Laberintos: los que usan el pasillo y el muro (checker solo el pasillo). */
export const LABERINTOS = Object.freeze([
  { forma: 'h', pasillo: true, muro: true },
  { forma: 'v', pasillo: true, muro: true },
  { forma: 'spiral', pasillo: true, muro: true },
  { forma: 'checker', pasillo: true, muro: false },
  { forma: 'polar', pasillo: false, muro: false },
  { forma: 'trash', pasillo: false, muro: false },
]);

/**
 * @typedef {import('../../../../engine/corridas.js').OrdenObjeto} OrdenObjeto
 * @typedef {import('../../../../engine/corridas.js').EventoCorrida} EventoCorrida
 * @typedef {import('../../../../engine/escenarios/index.js').Escenario['objetos']} ObjetosEsc
 */

/**
 * Fracción del campo de un texto de entrada ('0,25' o '0.25'); null si no
 * es un número en (0, 1].
 * @param {string | number} x
 * @returns {number | null}
 */
export function fraccion(x) {
  const v = typeof x === 'number' ? x : Number(String(x).trim().replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : null;
}

/**
 * Entero positivo de un texto de entrada (pasillo, muro); null si no vale.
 * @param {string | number} x
 * @returns {number | null}
 */
export function enteroPositivo(x) {
  const v = typeof x === 'number' ? x : Number(String(x).trim());
  return Number.isInteger(v) && v > 0 && v <= 100000 ? v : null;
}

/**
 * Orden de una acción de la barra; lanza si algún dato no vale.
 * @param {string} tipo
 * @param {{ancho?: number | null, alto?: number | null, forma?: string,
 *   pasillo?: number | null, muro?: number | null, n?: number}} [d]
 * @returns {OrdenObjeto}
 */
export function orden(tipo, d = {}) {
  /** @type {any} */
  let o;
  if (tipo === 'forma' || tipo === 'formas') o = { tipo, ancho: d.ancho, alto: d.alto };
  else if (tipo === 'laberinto')
    o = {
      tipo,
      forma: d.forma,
      pasillo: d.pasillo ?? PASILLO_DEF,
      muro: d.muro ?? MURO_DEF,
    };
  else if (tipo === 'borrar-forma' || tipo === 'borrar-teleporter') o = { tipo, n: d.n };
  else o = { tipo };
  const e = errorOrden(o);
  if (e) throw new Error(e);
  return copiaOrden(o);
}

/**
 * Los objetos que tendría el escenario si las órdenes de la corrida fueran
 * suyas: los de arranque más los eventos 'objetos' en orden (ver la
 * cabecera). `sueltas` = borrados de formas que no se pudieron llevar.
 * `cambios`: los cambios de opciones del escenario (`cambiosIniciales`) con
 * los eventos 'opciones' y la deriva de cada laberinto polar fusionados en
 * orden (fusionarCambios): los del escenario efectivo.
 * @param {ObjetosEsc | undefined} iniciales @param {EventoCorrida[]} eventos
 * @param {Record<string, number>} [cambiosIniciales]
 * @returns {{objetos: ObjetosEsc, aproximado: boolean, sueltas: number,
 *   cambios: Record<string, number>}}
 */
export function plegarObjetos(iniciales, eventos, cambiosIniciales = {}) {
  /** @type {ObjetosEsc} */
  const out = {
    obstaculos: structuredClone(iniciales?.obstaculos ?? []),
    teleporters: (iniciales?.teleporters ?? []).map(() => ({
      tipo: /** @type {const} */ ('local'),
    })),
  };
  let sueltas = 0;
  // Un polar de arranque deja su deriva en las claves que los cambios no
  // fijan (resolverOpciones): queda explícita, así sobrevive a borrar las
  // formas.
  let cambios = tienePolar({ objetos: iniciales })
    ? { ...DERIVA_POLAR, ...cambiosIniciales }
    : { ...cambiosIniciales };
  for (const ev of eventos) {
    if (ev.tipo === 'opciones') cambios = fusionarCambios(cambios, ev.cambios);
    if (ev.tipo !== 'objetos') continue;
    const o = /** @type {any} */ (ev.orden);
    switch (o.tipo) {
      case 'forma':
      case 'formas':
        out.obstaculos.push({ tipo: o.tipo, ancho: o.ancho, alto: o.alto });
        break;
      case 'laberinto':
        out.obstaculos.push({
          tipo: 'laberinto',
          forma: o.forma,
          pasillo: o.pasillo,
          muro: o.muro,
        });
        if (o.forma === 'polar') cambios = fusionarCambios(cambios, DERIVA_POLAR);
        break;
      case 'teleporter':
        // El motor no pasa de TOPE_TELEPORTERS: la orden de más no creó nada.
        if (out.teleporters.length < TOPE_TELEPORTERS) out.teleporters.push({ tipo: 'local' });
        break;
      case 'borrar-formas':
        out.obstaculos = [];
        sueltas = 0;
        break;
      case 'borrar-teleporters':
        out.teleporters = [];
        break;
      case 'borrar-teleporter':
        out.teleporters.pop();
        break;
      case 'borrar-forma':
      case 'borrar-formas10':
        if (out.obstaculos.length) sueltas++;
        break;
    }
  }
  return { objetos: out, aproximado: sueltas > 0, sueltas, cambios };
}

/**
 * Resumen de los objetos de un escenario (para el aviso de «Guardar en el
 * escenario»): formas sueltas, tandas de 10, laberintos y teleporters.
 * @param {ObjetosEsc} o
 */
export function contarObjetos(o) {
  let forma = 0;
  let formas = 0;
  let laberintos = 0;
  for (const b of o.obstaculos) {
    if (b.tipo === 'forma') forma++;
    else if (b.tipo === 'formas') formas++;
    else laberintos++;
  }
  return { forma, formas, laberintos, teleporters: o.teleporters.length };
}

/**
 * Objeto bajo el punto de mundo (x, y): primero los teleporters, en orden
 * ascendente (whichTeleporter), y después las formas en orden DESCENDENTE
 * (whichobstacle: gana la última dibujada, la que queda encima). `obs` y
 * `tps` son las filas del frame (REG.obs y REG.tp floats por objeto, con x,
 * y, ancho, alto al principio). `tol` agranda la caja (unidades de mundo)
 * para objetos finos. null si no hay ninguno.
 * @param {ArrayLike<number>} obs @param {number} nObs @param {number} regObs
 * @param {ArrayLike<number>} tps @param {number} nTps @param {number} regTp
 * @param {number} x @param {number} y @param {number} [tol]
 * @returns {{tipo: 'forma' | 'teleporter', n: number} | null}
 */
export function objetoEn(obs, nObs, regObs, tps, nTps, regTp, x, y, tol = 0) {
  /** @param {ArrayLike<number>} v @param {number} o */
  const dentro = (v, o) =>
    x >= v[o] - tol &&
    x <= v[o] + v[o + 2] + tol &&
    y >= v[o + 1] - tol &&
    y <= v[o + 1] + v[o + 3] + tol;
  for (let i = 0; i < nTps; i++)
    if (dentro(tps, i * regTp)) return { tipo: 'teleporter', n: i + 1 };
  for (let i = nObs - 1; i >= 0; i--)
    if (dentro(obs, i * regObs)) return { tipo: 'forma', n: i + 1 };
  return null;
}

/**
 * Recorrido por teclado de los objetos (modo borrar): teleporters 1..nTps y
 * después formas 1..nObs, circular. `dir` +1 o −1; sin selección, el
 * primero (o el último con −1). null si no hay objetos.
 * @param {{tipo: 'forma' | 'teleporter', n: number} | null} sel
 * @param {number} nObs @param {number} nTps @param {1 | -1} dir
 * @returns {{tipo: 'forma' | 'teleporter', n: number} | null}
 */
export function siguienteObjeto(sel, nObs, nTps, dir) {
  const total = nObs + nTps;
  if (total <= 0) return null;
  let k;
  if (!sel) k = dir > 0 ? 0 : total - 1;
  else {
    const actual = sel.tipo === 'teleporter' ? sel.n - 1 : nTps + sel.n - 1;
    k = (((actual + dir) % total) + total) % total;
  }
  return k < nTps ? { tipo: 'teleporter', n: k + 1 } : { tipo: 'forma', n: k - nTps + 1 };
}

/**
 * La orden que borra el objeto `sel`.
 * @param {{tipo: 'forma' | 'teleporter', n: number}} sel
 * @returns {OrdenObjeto}
 */
export const ordenBorrar = (sel) =>
  orden(sel.tipo === 'teleporter' ? 'borrar-teleporter' : 'borrar-forma', { n: sel.n });

/**
 * Un tipo de laberinto se puede crear con esos valores de pasillo y muro
 * (null = el campo no vale): solo cuentan los que ese tipo usa (el damero
 * no usa el muro; polar y escombros, ninguno).
 * @param {(typeof LABERINTOS)[number]} l
 * @param {number | null} pasillo @param {number | null} muro
 */
export const laberintoValido = (l, pasillo, muro) =>
  (!l.pasillo || pasillo !== null) && (!l.muro || muro !== null);

/** Frames que se ignoran, como mucho, esperando que el worker confirme un borrado. */
export const MAX_FRAMES_PENDIENTE = 120;

/**
 * Copia local de las formas y los teleporters del último frame (modo
 * borrar de Mundo.svelte: clic, resaltado y recorrido por teclado). Tras
 * un borrado los índices del motor se corren (db_sim_delete_obstacle y
 * db_sim_delete_teleporter mueven los de atrás un lugar), pero el frame
 * siguiente puede llegar tarde o ser uno anterior al borrado: la copia
 * repite la compactación en el momento y no toma frames hasta que el
 * worker confirma el borrado (confirmar); así un segundo clic no usa un
 * índice viejo. Si la confirmación no llega, a los MAX_FRAMES_PENDIENTE
 * frames vuelve a tomar los del worker.
 */
export class CopiaObjetos {
  obs = new Float32Array(0);
  tps = new Float32Array(0);
  nObs = 0;
  nTps = 0;
  #regObs;
  #regTp;
  #pendientes = 0;
  #ignorados = 0;

  /** @param {number} regObs floats por forma @param {number} regTp floats por teleporter */
  constructor(regObs, regTp) {
    this.#regObs = regObs;
    this.#regTp = regTp;
  }

  /** Borrados mandados que el worker todavía no confirmó. */
  get pendientes() {
    return this.#pendientes;
  }

  /**
   * Toma los objetos de un frame (v: floats del frame; ofObs/ofTps: dónde
   * empiezan; nO/nT: cuántos hay), salvo con borrados sin confirmar.
   * Devuelve si cambió la cantidad de formas o de teleporters.
   * @param {Float32Array} v @param {number} ofObs @param {number} nO
   * @param {number} ofTps @param {number} nT
   */
  tomar(v, ofObs, nO, ofTps, nT) {
    if (this.#pendientes > 0 && ++this.#ignorados <= MAX_FRAMES_PENDIENTE) return false;
    this.#pendientes = 0;
    this.#ignorados = 0;
    const ro = this.#regObs;
    const rt = this.#regTp;
    if (this.obs.length < nO * ro) this.obs = new Float32Array(nO * ro + 256);
    this.obs.set(v.subarray(ofObs, ofObs + nO * ro));
    if (this.tps.length < nT * rt) this.tps = new Float32Array(nT * rt + 64);
    this.tps.set(v.subarray(ofTps, ofTps + nT * rt));
    const cambio = nO !== this.nObs || nT !== this.nTps;
    this.nObs = nO;
    this.nTps = nT;
    return cambio;
  }

  /**
   * Un borrado mandado al worker: quita el objeto de la copia y corre los
   * de atrás un lugar, como el motor. false si no existe (no se mandó).
   * @param {{tipo: 'forma' | 'teleporter', n: number}} sel
   */
  borrar(sel) {
    const tp = sel.tipo === 'teleporter';
    const total = tp ? this.nTps : this.nObs;
    if (!(Number.isInteger(sel.n) && sel.n >= 1 && sel.n <= total)) return false;
    const reg = tp ? this.#regTp : this.#regObs;
    (tp ? this.tps : this.obs).copyWithin((sel.n - 1) * reg, sel.n * reg, total * reg);
    if (tp) this.nTps--;
    else this.nObs--;
    this.#pendientes++;
    this.#ignorados = 0;
    return true;
  }

  /** El worker confirmó un borrado: los frames que lleguen después ya lo reflejan. */
  confirmar() {
    if (this.#pendientes > 0) this.#pendientes--;
  }
}
