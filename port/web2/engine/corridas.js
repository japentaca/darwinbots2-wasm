// @ts-check
// Corridas guardadas (decisiones 8 y 12 de port/web2/PLAN.md), sin DOM.
//
// Corrida = escenario + semilla + cambios en caliente. Los cambios quedan
// como eventos con su ciclo, así una réplica (u otra orquestación) los
// repite en el mismo ciclo. Al guardar se suma la foto binaria de la sim
// (el .dbsim de {t:'save'}) y los metadatos para listar.
//
// Dos almacenes de engine/almacen.js:
//   'corridas'        metadatos (lo que lista Inicio): id, nombre, fecha,
//                     escenario, semilla, eventos, ciclo, bots, especies,
//                     miniatura (data URL opcional), marcada (0/1: IndexedDB
//                     no indexa booleanos), bytes (largo del .dbsim)
//   'corridas-datos'  {id, dbsim: ArrayBuffer, ...extra}: aparte, para que
//                     listar no cargue megas. `extra` es lo pesado que no
//                     hace falta para listar (la interfaz guarda ahí la
//                     historia, con el feed en sus eventos, y el linaje, C14;
//                     las corridas viejas traen además `feed` aparte)
//
// Política (decisión 8): se conservan las últimas 20 corridas y las
// marcadas. Se aplica al guardar: las no marcadas que quedan fuera de las 20
// más recientes se borran (metadatos y datos), salvo la que se acaba de
// guardar (aunque el reloj la ponga más vieja que otras), y se barren los
// datos huérfanos (un .dbsim sin metadatos). Guardar, podar y borrar son
// transacciones sobre los dos almacenes (Almacen.tx): nunca queda uno sin
// el otro.
//
// Eventos: los cambios del mismo ciclo se juntan en uno, en el orden en que
// se aplicaron (una clave repetida pasa al final con su último valor). Así
// repetir el evento deja la sim igual aunque haya opciones acopladas (97
// escribe también 101; 1 escribe 2 y 3: ver engine/opciones.js).
//
// Además de los cambios de opciones ('opciones'), la siembra en caliente
// (Sembrar en Observar) es un evento 'siembra' con la especie completa (ADN
// incluido): repetirlo manda el mismo {t:'seed-species'} en el mismo ciclo.
//
// Los objetos del mundo editados en caliente (barra «Mundo» de Observar,
// decisión 15) son eventos 'objetos': una orden al motor por evento (C13:
// órdenes, no posiciones; el motor sortea con su azar), incluidas las de
// borrar. Repetirlo manda el mismo mensaje del menú de objetos (shape,
// shapes-add10, shapes-del10, shape-del, shapes-clear, maze, teleporter,
// tp-del, tp-clear) en el mismo ciclo, así la réplica queda igual.

import { FORMAS_LABERINTO } from './escenarios/index.js';
import { mensajeVivo, parametro } from './opciones.js';
import { cssToVbColor } from './partido.js';

export const ST_CORRIDAS = 'corridas';
export const ST_CORRIDAS_DATOS = 'corridas-datos';
export const MAX_CORRIDAS = 20;

/**
 * @typedef {{ciclo: number, tipo: 'opciones', cambios: Record<string, number>}} EventoOpciones
 * @typedef {{nombre: string, adn: string, cantidad: number, color: string, vegetal: boolean,
 *   energia: number}} EspecieSiembra  color CSS `#rrggbb`; nombre sin `.txt`
 * @typedef {{ciclo: number, tipo: 'siembra', especie: EspecieSiembra}} EventoSiembra
 * @typedef {{tipo: 'forma' | 'formas', ancho: number, alto: number}
 *   | {tipo: 'laberinto', forma: string, pasillo: number, muro: number}
 *   | {tipo: 'teleporter'}
 *   | {tipo: 'borrar-forma' | 'borrar-teleporter', n: number}
 *   | {tipo: 'borrar-formas10' | 'borrar-formas' | 'borrar-teleporters'}} OrdenObjeto
 *   ancho/alto: fracciones del campo (0, 1]; n: índice 1-based del objeto
 *   (el orden del frame: obstáculos y teleporters existentes, ascendente)
 * @typedef {{ciclo: number, tipo: 'objetos', orden: OrdenObjeto}} EventoObjetos
 * @typedef {EventoOpciones | EventoSiembra | EventoObjetos} EventoCorrida
 * @typedef {{
 *   id?: string, nombre: string, fecha?: string,
 *   escenario: import('./escenarios/index.js').Escenario, semilla: number,
 *   eventos: EventoCorrida[], ciclo: number, bots: number, especies: string[],
 *   miniatura?: string, marcada: 0 | 1, bytes?: number,
 * }} Corrida
 */

/**
 * Corrida nueva (todavía sin guardar) para un escenario y una semilla.
 * @param {{escenario: import('./escenarios/index.js').Escenario, semilla: number, nombre?: string}} o
 * @returns {Corrida}
 */
export function nuevaCorrida(o) {
  const n = o.escenario.nombre;
  return {
    nombre: o.nombre || (typeof n === 'string' ? n : n.es),
    escenario: structuredClone(o.escenario),
    semilla: o.semilla,
    eventos: [],
    ciclo: 0,
    bots: 0,
    especies: [],
    marcada: 0,
  };
}

/**
 * Registra un cambio en caliente aplicado en `ciclo` (decisión 13). Los
 * cambios del mismo ciclo se juntan en un evento. Lanza si alguna clave no
 * es un parámetro vivo (lo que requiere sim nueva no es un cambio en
 * caliente). `ciclo` −1 = antes del primer tick (se aplica en el arranque).
 * @param {Corrida} c @param {number} ciclo @param {Record<string, number>} cambios
 */
export function registrarCambio(c, ciclo, cambios) {
  if (!Number.isInteger(ciclo) || ciclo < -1) throw new Error(`ciclo inválido: ${ciclo}`);
  for (const [k, v] of Object.entries(cambios)) {
    const p = parametro(k);
    if (!p) throw new Error(`parámetro desconocido: ${k}`);
    if (!p.vivo) throw new Error(`requiere sim nueva: ${k}`);
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`valor inválido: ${k}`);
  }
  const ult = c.eventos[c.eventos.length - 1];
  if (ult && ult.ciclo > ciclo) throw new Error('los eventos van en orden de ciclo');
  if (ult && ult.ciclo === ciclo && ult.tipo === 'opciones')
    for (const [k, v] of Object.entries(cambios)) {
      // Borrar antes de reasignar: la clave pasa al final (orden de
      // reemisión = orden de la última escritura de cada una).
      delete ult.cambios[k];
      ult.cambios[k] = v;
    }
  else c.eventos.push({ ciclo, tipo: 'opciones', cambios: { ...cambios } });
}

/**
 * Registra una siembra en caliente hecha en `ciclo`. Lanza si la especie no
 * es válida. Va después de los eventos que ya haya (el orden importa: el
 * worker atiende en orden).
 * @param {Corrida} c @param {number} ciclo @param {EspecieSiembra} especie
 */
export function registrarSiembra(c, ciclo, especie) {
  if (!Number.isInteger(ciclo) || ciclo < -1) throw new Error(`ciclo inválido: ${ciclo}`);
  const e = especie;
  if (!e || typeof e.nombre !== 'string' || !e.nombre) throw new Error('siembra sin nombre');
  if (typeof e.adn !== 'string' || !e.adn.trim()) throw new Error('siembra sin ADN');
  if (!Number.isInteger(e.cantidad) || e.cantidad < 1) throw new Error('cantidad inválida');
  if (!/^#[0-9a-f]{6}$/i.test(e.color)) throw new Error(`color inválido: ${e.color}`);
  if (typeof e.energia !== 'number' || !Number.isFinite(e.energia))
    throw new Error('energía inválida');
  const ult = c.eventos[c.eventos.length - 1];
  if (ult && ult.ciclo > ciclo) throw new Error('los eventos van en orden de ciclo');
  c.eventos.push({
    ciclo,
    tipo: 'siembra',
    especie: {
      nombre: e.nombre,
      adn: e.adn,
      cantidad: e.cantidad,
      color: e.color.toLowerCase(),
      vegetal: !!e.vegetal,
      energia: e.energia,
    },
  });
}

/** Tipos de orden de objeto (EventoObjetos). */
export const ORDENES_OBJETO = Object.freeze([
  'forma',
  'formas',
  'laberinto',
  'teleporter',
  'borrar-forma',
  'borrar-formas10',
  'borrar-formas',
  'borrar-teleporter',
  'borrar-teleporters',
]);

/** Tope de pasillo y muro de un laberinto (unidades del campo). */
export const TOPE_LABERINTO = 100000;

/**
 * Código de error de una orden de objeto, o null si vale.
 * @param {unknown} o
 * @returns {string | null}
 */
export function errorOrden(o) {
  if (!o || typeof o !== 'object') return 'orden';
  const x = /** @type {Record<string, any>} */ (o);
  if (!ORDENES_OBJETO.includes(x.tipo)) return 'orden-tipo';
  /** @param {unknown} v */
  const frac = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1;
  /** @param {unknown} v */
  const ent = (v) => Number.isInteger(v) && /** @type {number} */ (v) > 0;
  switch (x.tipo) {
    case 'forma':
    case 'formas':
      return frac(x.ancho) && frac(x.alto) ? null : 'orden-tamano';
    case 'laberinto':
      if (!FORMAS_LABERINTO.includes(x.forma)) return 'orden-forma';
      return ent(x.pasillo) &&
        ent(x.muro) &&
        x.pasillo <= TOPE_LABERINTO &&
        x.muro <= TOPE_LABERINTO
        ? null
        : 'orden-tamano';
    case 'borrar-forma':
    case 'borrar-teleporter':
      return ent(x.n) ? null : 'orden-indice';
    default:
      return null;
  }
}

/**
 * Copia limpia de una orden (solo sus campos). Lanza si no vale.
 * @param {OrdenObjeto} o
 * @returns {OrdenObjeto}
 */
export function copiaOrden(o) {
  const e = errorOrden(o);
  if (e) throw new Error(`orden de objeto inválida (${e})`);
  const x = /** @type {any} */ (o);
  switch (x.tipo) {
    case 'forma':
    case 'formas':
      return { tipo: x.tipo, ancho: x.ancho, alto: x.alto };
    case 'laberinto':
      return { tipo: 'laberinto', forma: x.forma, pasillo: x.pasillo, muro: x.muro };
    case 'borrar-forma':
    case 'borrar-teleporter':
      return { tipo: x.tipo, n: x.n };
    default:
      return { tipo: x.tipo };
  }
}

/**
 * El mensaje al worker de una orden de objeto (protocolo de
 * engine/worker.js, menú de objetos E3).
 * @param {OrdenObjeto} o
 */
export function mensajeObjeto(o) {
  const x = /** @type {any} */ (copiaOrden(o));
  switch (x.tipo) {
    case 'forma':
      return { t: 'shape', dw: x.ancho, dh: x.alto };
    case 'formas':
      return { t: 'shapes-add10', dw: x.ancho, dh: x.alto };
    case 'laberinto':
      return { t: 'maze', kind: x.forma, corridor: x.pasillo, wall: x.muro };
    case 'teleporter':
      return { t: 'teleporter' };
    case 'borrar-forma':
      return { t: 'shape-del', n: x.n };
    case 'borrar-formas10':
      return { t: 'shapes-del10' };
    case 'borrar-formas':
      return { t: 'shapes-clear' };
    case 'borrar-teleporter':
      return { t: 'tp-del', n: x.n };
    default:
      return { t: 'tp-clear' };
  }
}

/**
 * Registra una orden de objeto hecha en `ciclo` (decisión 13 y 15). Lanza
 * si la orden no vale. Va después de los eventos que ya haya.
 * @param {Corrida} c @param {number} ciclo @param {OrdenObjeto} orden
 */
export function registrarObjetos(c, ciclo, orden) {
  if (!Number.isInteger(ciclo) || ciclo < -1) throw new Error(`ciclo inválido: ${ciclo}`);
  const o = copiaOrden(orden);
  const ult = c.eventos[c.eventos.length - 1];
  if (ult && ult.ciclo > ciclo) throw new Error('los eventos van en orden de ciclo');
  c.eventos.push({ ciclo, tipo: 'objetos', orden: o });
}

/**
 * Mensajes al worker que repiten un evento (setopt/setbase/setcost en vivo,
 * el seed-species de una siembra o el mensaje de una orden de objeto).
 * @param {EventoCorrida} ev
 */
export function mensajesEvento(ev) {
  if (ev.tipo === 'objetos') return [mensajeObjeto(ev.orden)];
  if (ev.tipo === 'siembra') {
    const e = ev.especie;
    return [
      {
        t: 'seed-species',
        sp: {
          dna: e.adn,
          name: `${e.nombre}.txt`,
          veg: e.vegetal,
          qty: e.cantidad,
          nrg: e.energia,
          color: cssToVbColor(e.color),
        },
      },
    ];
  }
  return Object.entries(ev.cambios).map(([k, v]) => {
    const m = mensajeVivo(k, v);
    if (!m) throw new Error(`requiere sim nueva: ${k}`);
    return m;
  });
}

/** @param {ArrayBuffer | Uint8Array} b */
const aBuffer = (b) =>
  b instanceof Uint8Array ? b.slice().buffer : /** @type {ArrayBuffer} */ (b).slice(0);

/** Más reciente primero; a igual fecha, por id. @param {Corrida} a @param {Corrida} b */
const porFecha = (a, b) =>
  (b.fecha || '').localeCompare(a.fecha || '') || String(b.id).localeCompare(String(a.id));

/**
 * @param {{
 *   almacen: import('./almacen.js').Almacen,
 *   reloj?: () => Date,
 *   nuevoId?: () => string,
 *   max?: number,
 * }} deps
 */
export function crearCorridas(deps) {
  const { almacen } = deps;
  const reloj = deps.reloj || (() => new Date());
  const max = deps.max ?? MAX_CORRIDAS;
  const nuevoId =
    deps.nuevoId ||
    (() => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

  const STS = [ST_CORRIDAS, ST_CORRIDAS_DATOS];

  /**
   * Dentro de una transacción: borra las que la política no conserva (nunca
   * `proteger`) y los datos huérfanos. Devuelve los ids de corridas borradas.
   * @param {import('./almacen.js').OperacionesAlmacen} t @param {string} [proteger]
   */
  async function podarEn(t, proteger) {
    const todas = /** @type {Corrida[]} */ (await t.list(ST_CORRIDAS)).sort(porFecha);
    // La protegida cuenta entre las `max` aunque su fecha sea vieja (reloj
    // atrasado): se conservan ella y las max-1 más recientes del resto.
    const hay = todas.some((c) => c.id === proteger);
    const borrar = todas
      .filter((c) => c.id !== proteger)
      .filter((c, i) => i >= max - (hay ? 1 : 0) && !c.marcada)
      .map((c) => /** @type {string} */ (c.id));
    for (const id of borrar) {
      await t.delete(ST_CORRIDAS, id);
      await t.delete(ST_CORRIDAS_DATOS, id);
    }
    const vivas = new Set(todas.map((c) => c.id));
    for (const id of await t.claves(ST_CORRIDAS_DATOS))
      if (!vivas.has(id)) await t.delete(ST_CORRIDAS_DATOS, id);
    return borrar;
  }

  /** Borra las que la política no conserva; devuelve sus ids. */
  const podar = () => almacen.tx(STS, (t) => podarEn(t));

  /** @param {string} id */
  const borrarId = (id) =>
    almacen.tx(STS, async (t) => {
      await t.delete(ST_CORRIDAS, id);
      await t.delete(ST_CORRIDAS_DATOS, id);
    });

  return {
    /**
     * Guarda (o sobrescribe, si trae id) la corrida con su .dbsim. Fecha =
     * ahora. Devuelve el id y los ids que la política borró.
     * @param {Corrida} c
     * @param {{dbsim: ArrayBuffer | Uint8Array, ciclo?: number, bots?: number,
     *   especies?: string[], miniatura?: string, extra?: Record<string, any>}} foto
     *   extra: datos pesados que van con el .dbsim en 'corridas-datos' (no
     *   se leen al listar; `cargar` los devuelve)
     */
    async guardar(c, foto) {
      const id = c.id || nuevoId();
      const dbsim = aBuffer(foto.dbsim);
      /** @type {Corrida} */
      const meta = {
        ...structuredClone(c),
        id,
        fecha: reloj().toISOString(),
        ciclo: foto.ciclo ?? c.ciclo,
        bots: foto.bots ?? c.bots,
        especies: [...(foto.especies ?? c.especies)],
        marcada: c.marcada ? 1 : 0,
        bytes: dbsim.byteLength,
      };
      if (foto.miniatura !== undefined) meta.miniatura = foto.miniatura;
      const borradas = await almacen.tx(STS, async (t) => {
        await t.put(ST_CORRIDAS_DATOS, { ...structuredClone(foto.extra ?? {}), id, dbsim });
        await t.put(ST_CORRIDAS, meta);
        return podarEn(t, id);
      });
      return { id, borradas };
    },
    /** Metadatos de todas, la más reciente primero. @returns {Promise<Corrida[]>} */
    async listar() {
      return (await almacen.list(ST_CORRIDAS)).sort(porFecha);
    },
    /**
     * La corrida, su .dbsim (para {t:'load', bytes}) y los `extra` que se
     * guardaron con él; null si no existe.
     * @param {string} id
     * @returns {Promise<{corrida: Corrida, dbsim: ArrayBuffer | null,
     *   extra: Record<string, any>} | null>}
     */
    async cargar(id) {
      const corrida = await almacen.get(ST_CORRIDAS, id);
      if (!corrida) return null;
      const d = await almacen.get(ST_CORRIDAS_DATOS, id);
      if (!d) return { corrida, dbsim: null, extra: {} };
      const { id: _id, dbsim, ...extra } = d;
      return { corrida, dbsim: dbsim ?? null, extra };
    },
    /** @param {string} id */
    borrar: (id) => borrarId(id),
    /**
     * Marca (se conserva siempre) o desmarca. Al desmarcar se aplica la
     * política. @param {string} id @param {boolean} on
     */
    async marcar(id, on) {
      return almacen.tx(STS, async (t) => {
        const c = await t.get(ST_CORRIDAS, id);
        if (!c) return [];
        c.marcada = on ? 1 : 0;
        await t.put(ST_CORRIDAS, c);
        return on ? [] : podarEn(t);
      });
    },
    /** Aplica la política (y barre huérfanos) sin guardar nada. */
    podar,
    /** @param {string} id @param {string} nombre */
    async renombrar(id, nombre) {
      const c = await almacen.get(ST_CORRIDAS, id);
      if (!c) return false;
      c.nombre = nombre;
      await almacen.put(ST_CORRIDAS, c);
      return true;
    },
  };
}
