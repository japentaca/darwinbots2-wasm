// @ts-check
// Escenarios (decisión 12 de port/web2/PLAN.md): la unidad de configuración.
// Un escenario es un JSON con las opciones (una base + cambios), las
// especies que se siembran y los objetos del mundo. La semilla va aparte:
// corrida = escenario + semilla + cambios en caliente (engine/corridas.js).
//
// Formato 1:
//   {
//     formato: 1,
//     id: 'sopa-primordial',               // [a-z0-9-], único
//     nombre: {es, en} | 'texto',
//     descripcion?: {es, en} | 'texto',
//     etiquetas?: ['básico', …],
//     destino?: 'observar' | 'competir',   // dónde lo abre Inicio
//     opciones: {
//       base: 'clasica' | 'f1',            // BASES de engine/opciones.js
//       cambios?: {'opt:33': 1, 'cost:23': 2, 'base:minVegs': 10, …},
//     },
//     especies: [{
//       bot: 'Alga minimalis 3.0',         // nombre exacto (Bestiary o propio)
//       origen?: 'bestiario' | 'propio',   // default 'bestiario'
//       hash?: '7688556d',                 // FNV-1a del ADN (lgHash)
//       cantidad: 15, color: '#30d030', vegetal: true,
//       energia?: 3000,                    // energía inicial (Stnrg)
//       adn?: '…',                         // texto, para propios exportados
//     }],
//     objetos?: {
//       obstaculos: [{tipo: 'forma', ancho, alto}                   // 1 al azar
//                  | {tipo: 'formas', ancho, alto}                  // 10 al azar
//                  | {tipo: 'laberinto', forma, pasillo?, muro?}],  // Obstacles.bas
//       teleporters: [{tipo: 'local'}],
//     },
//   }
// Los obstáculos y teleporters son órdenes al motor (las mismas del menú
// Objects del original): su posición la sortea la sim con su semilla.
//
// Los cambios no pueden traer parámetros derivados (opt:1, Toroidal: se
// edita con los ejes 2 y 3; ver engine/opciones.js).
//
// API (sin DOM):
//   validar(x, {reservados}?)   → [{codigo, ruta, detalle?}] (vacía = válido);
//                                 `reservados` = ids que el escenario no puede
//                                 usar (los de fábrica para uno propio:
//                                 validarPropio de ./fabrica.js)
//   normalizar(x, {reservados}?) → copia con los defaults (lanza ErrorEscenario)
//   resolverOpciones(e)         → {clave: valor} que tiene la sim armada con aplicar()
//                                 (base + cambios + la deriva de un laberinto polar)
//   aplicar(e, semilla, adnDe)  → mensajes al worker (engine/worker.js)
//   diff(borrador, actual)      → qué va en vivo y qué requiere sim nueva
//   verificarAdn(e, adnDe)      → avisos de ADN que no coincide con su hash

import { lgHash } from '../league.js';
import {
  BASES,
  efectosDe,
  mensajeVivo,
  normalizarValor,
  opcionesReset,
  PARAMETROS,
  parametro,
  valorEfectivo,
  valoresResueltos,
} from '../opciones.js';
import { cssToVbColor } from '../partido.js';

export const FORMATO = 1;
export const TOPE_TELEPORTERS = 10; // el core no pasa de 10
/**
 * Lo que el laberinto polar escribe en las opciones (db_sim_maze_polar_ice
 * de port/wasm/dbcore_api.cpp, Obstacles.bas:123-125): deriva vertical (83)
 * y horizontal (84) encendidas, velocidad (85) 20.
 */
export const DERIVA_POLAR = Object.freeze({ 'opt:83': 1, 'opt:84': 1, 'opt:85': 20 });
export const ENERGIA_POR_DEFECTO = 3000;
export const FORMAS_LABERINTO = Object.freeze(['h', 'v', 'spiral', 'checker', 'polar', 'trash']);
export const DESTINOS = Object.freeze(['observar', 'competir']);
export const ORIGENES = Object.freeze(['bestiario', 'propio']);

/**
 * @typedef {{codigo: string, ruta: string, detalle?: string}} ErrorValidacion
 * @typedef {string | {es: string, en: string}} TextoEsc
 * @typedef {{bot: string, origen: string, hash?: string, cantidad: number, color: string,
 *   vegetal: boolean, energia: number, adn?: string}} Especie
 * @typedef {{tipo: 'forma' | 'formas', ancho: number, alto: number}
 *   | {tipo: 'laberinto', forma: string, pasillo: number, muro: number}} Obstaculo
 * @typedef {{
 *   formato: number, id: string, nombre: TextoEsc, descripcion: TextoEsc, etiquetas: string[],
 *   destino: string, opciones: {base: string, cambios: Record<string, number>},
 *   especies: Especie[], objetos: {obstaculos: Obstaculo[], teleporters: {tipo: 'local'}[]},
 * }} Escenario
 */

export class ErrorEscenario extends Error {
  /** @param {string} codigo @param {ErrorValidacion[]} [errores] */
  constructor(codigo, errores = []) {
    super(
      `${codigo}${errores.length ? `: ${errores.map((e) => `${e.codigo}@${e.ruta}`).join(', ')}` : ''}`,
    );
    this.codigo = codigo;
    this.errores = errores;
  }
}

/** @param {unknown} x @returns {x is Record<string, any>} */
const esObjeto = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
/** @param {unknown} x */
const textoOk = (x) =>
  (typeof x === 'string' && x.trim() !== '') ||
  (esObjeto(x) &&
    typeof x.es === 'string' &&
    typeof x.en === 'string' &&
    x.es.trim() !== '' &&
    x.en.trim() !== '');
const RE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RE_COLOR = /^#[0-9a-fA-F]{6}$/;
const RE_HASH = /^[0-9a-f]{8}$/;

/**
 * Errores de formato (lista vacía = válido). No toca el Bestiary: que los
 * bots existan lo comprueba quien tiene la lista (Inicio, los tests).
 * @param {unknown} x
 * @param {{reservados?: Iterable<string>}} [o]  ids prohibidos (código 'id-reservado')
 * @returns {ErrorValidacion[]}
 */
export function validar(x, o = {}) {
  /** @type {ErrorValidacion[]} */
  const err = [];
  /** @param {string} codigo @param {string} ruta @param {string} [detalle] */
  const mal = (codigo, ruta, detalle) =>
    err.push(detalle === undefined ? { codigo, ruta } : { codigo, ruta, detalle });
  if (!esObjeto(x)) {
    mal('no-objeto', '');
    return err;
  }
  if (x.formato !== FORMATO) mal('formato', 'formato', String(x.formato));
  if (typeof x.id !== 'string' || !RE_ID.test(x.id)) mal('id', 'id');
  else if (o.reservados && new Set(o.reservados).has(x.id)) mal('id-reservado', 'id', x.id);
  if (!textoOk(x.nombre)) mal('nombre', 'nombre');
  if (x.descripcion !== undefined && x.descripcion !== '' && !textoOk(x.descripcion))
    mal('descripcion', 'descripcion');
  if (
    x.etiquetas !== undefined &&
    !(Array.isArray(x.etiquetas) && x.etiquetas.every((t) => typeof t === 'string' && t !== ''))
  )
    mal('etiquetas', 'etiquetas');
  if (x.destino !== undefined && !DESTINOS.includes(x.destino)) mal('destino', 'destino');

  // Opciones
  const op = x.opciones;
  if (!esObjeto(op)) mal('opciones', 'opciones');
  else {
    if (typeof op.base !== 'string' || !(op.base in BASES))
      mal('base', 'opciones.base', String(op.base));
    if (op.cambios !== undefined && !esObjeto(op.cambios)) mal('opciones', 'opciones.cambios');
    else
      for (const [clave, v] of Object.entries(op.cambios || {})) {
        const p = parametro(clave);
        const ruta = `opciones.cambios.${clave}`;
        if (!p) {
          mal('clave-desconocida', ruta);
          continue;
        }
        if (p.derivado) {
          mal('clave-derivada', ruta);
          continue;
        }
        const r = normalizarValor(p, v);
        if (!r.ok) mal(r.codigo, ruta, String(v));
      }
  }

  // Especies
  if (!Array.isArray(x.especies)) mal('especies', 'especies');
  else
    x.especies.forEach((/** @type {unknown} */ s, /** @type {number} */ i) => {
      const r = `especies.${i}`;
      if (!esObjeto(s)) {
        mal('especie', r);
        return;
      }
      if (typeof s.bot !== 'string' || s.bot.trim() === '') mal('especie-bot', `${r}.bot`);
      if (s.origen !== undefined && !ORIGENES.includes(s.origen))
        mal('especie-origen', `${r}.origen`);
      if (s.hash !== undefined && !(typeof s.hash === 'string' && RE_HASH.test(s.hash)))
        mal('especie-hash', `${r}.hash`);
      if (!Number.isInteger(s.cantidad) || s.cantidad < 1 || s.cantidad > 10000)
        mal('especie-cantidad', `${r}.cantidad`);
      if (typeof s.color !== 'string' || !RE_COLOR.test(s.color))
        mal('especie-color', `${r}.color`);
      if (typeof s.vegetal !== 'boolean') mal('especie-vegetal', `${r}.vegetal`);
      if (
        s.energia !== undefined &&
        !(Number.isInteger(s.energia) && s.energia >= 0 && s.energia <= 32000)
      )
        mal('especie-energia', `${r}.energia`);
      if (s.adn !== undefined && (typeof s.adn !== 'string' || s.adn.trim() === ''))
        mal('especie-adn', `${r}.adn`);
      if (s.adn !== undefined && typeof s.adn === 'string' && typeof s.hash === 'string')
        if (lgHash(s.adn) !== s.hash) mal('especie-hash-adn', `${r}.hash`);
    });

  // Objetos
  const ob = x.objetos;
  if (ob !== undefined) {
    if (!esObjeto(ob)) mal('objetos', 'objetos');
    else {
      const obs = ob.obstaculos ?? [];
      const tps = ob.teleporters ?? [];
      if (!Array.isArray(obs)) mal('objetos', 'objetos.obstaculos');
      else
        for (let i = 0; i < obs.length; i++)
          validarObstaculo(obs[i], `objetos.obstaculos.${i}`, mal);
      if (!Array.isArray(tps)) mal('objetos', 'objetos.teleporters');
      else {
        tps.forEach((/** @type {unknown} */ t, /** @type {number} */ i) => {
          if (!esObjeto(t) || t.tipo !== 'local') mal('teleporter', `objetos.teleporters.${i}`);
        });
        if (tps.length > TOPE_TELEPORTERS) mal('teleporters-tope', 'objetos.teleporters');
      }
    }
  }
  return err;
}

/** @param {unknown} b @param {string} r @param {(c: string, r: string, d?: string) => void} mal */
function validarObstaculo(b, r, mal) {
  if (!esObjeto(b)) {
    mal('obstaculo', r);
    return;
  }
  /** @param {unknown} v */
  const frac = (v) => typeof v === 'number' && v > 0 && v <= 1;
  /** @param {unknown} v */
  const pos = (v) => v === undefined || (Number.isInteger(v) && /** @type {number} */ (v) > 0);
  if (b.tipo === 'forma' || b.tipo === 'formas') {
    if (!frac(b.ancho ?? 0.2) || !frac(b.alto ?? 0.2)) mal('obstaculo-tamano', r);
  } else if (b.tipo === 'laberinto') {
    if (!FORMAS_LABERINTO.includes(b.forma)) mal('obstaculo-forma', `${r}.forma`);
    if (!pos(b.pasillo) || !pos(b.muro)) mal('obstaculo-tamano', r);
  } else mal('obstaculo-tipo', `${r}.tipo`);
}

/** @param {TextoEsc} t */
const copiaTexto = (t) => (typeof t === 'string' ? t : { es: t.es, en: t.en });

/**
 * Copia con los defaults puestos y los bool de las opciones como números
 * (lo que viaja al motor). Lanza ErrorEscenario('invalido') si no valida.
 * @param {unknown} x @param {{reservados?: Iterable<string>}} [o]  como en validar
 * @returns {Escenario}
 */
export function normalizar(x, o = {}) {
  const errores = validar(x, o);
  if (errores.length) throw new ErrorEscenario('invalido', errores);
  const e = /** @type {Record<string, any>} */ (x);
  /** @type {Record<string, number>} */
  const cambios = {};
  for (const [clave, v] of Object.entries(e.opciones.cambios || {})) {
    const r = normalizarValor(/** @type {any} */ (parametro(clave)), v);
    if (r.ok) cambios[clave] = r.v;
  }
  const ob = e.objetos || {};
  return {
    formato: FORMATO,
    id: e.id,
    nombre: copiaTexto(e.nombre),
    descripcion: e.descripcion ? copiaTexto(e.descripcion) : '',
    etiquetas: [...(e.etiquetas || [])],
    destino: e.destino || 'observar',
    opciones: { base: e.opciones.base, cambios },
    especies: e.especies.map((/** @type {any} */ s) => {
      /** @type {Especie} */
      const out = {
        bot: s.bot,
        origen: s.origen || 'bestiario',
        cantidad: s.cantidad,
        color: s.color.toLowerCase(),
        vegetal: s.vegetal,
        energia: s.energia ?? ENERGIA_POR_DEFECTO,
      };
      if (s.hash) out.hash = s.hash;
      if (s.adn !== undefined) out.adn = s.adn;
      return out;
    }),
    objetos: {
      obstaculos: (ob.obstaculos || []).map((/** @type {any} */ b) =>
        b.tipo === 'laberinto'
          ? { tipo: 'laberinto', forma: b.forma, pasillo: b.pasillo ?? 500, muro: b.muro ?? 50 }
          : { tipo: b.tipo, ancho: b.ancho ?? 0.2, alto: b.alto ?? 0.2 },
      ),
      teleporters: (ob.teleporters || []).map(() => ({ tipo: /** @type {const} */ ('local') })),
    },
  };
}

/** @param {{tipo: string, forma?: string}} b */
const esPolar = (b) => b.tipo === 'laberinto' && b.forma === 'polar';

/**
 * El escenario tiene un laberinto polar (enciende la deriva al crearse).
 * @param {{objetos?: {obstaculos?: {tipo: string, forma?: string}[]}}} e
 */
export const tienePolar = (e) => !!e.objetos?.obstaculos?.some(esPolar);

/**
 * Valores de las opciones que tiene la sim armada con aplicar(): base +
 * cambios y, con un laberinto polar, su deriva (DERIVA_POLAR) en las claves
 * 83–85 que los cambios no fijan (las que sí fija se reenvían después de
 * los objetos: ver aplicar).
 * @param {Escenario} e
 */
export const resolverOpciones = (e) =>
  valoresResueltos(
    e.opciones.base,
    tienePolar(e) ? { ...DERIVA_POLAR, ...e.opciones.cambios } : e.opciones.cambios,
  );

/**
 * Con un laberinto polar: las opciones 83–85 que los cambios fijan con otro
 * valor que el que deja el laberinto, reenviadas sin pasar por el diálogo de
 * opciones (nocap: el laberinto tampoco pasa), para que la sim quede con
 * resolverOpciones(e).
 * @param {Escenario} e
 */
function reenviosDeriva(e) {
  if (!tienePolar(e)) return [];
  const r = resolverOpciones(e);
  return Object.entries(DERIVA_POLAR)
    .filter(([clave, v]) => valorEfectivo(r, clave) !== v)
    .map(([clave]) => ({
      t: 'setopt',
      id: /** @type {number} */ (parametro(clave)?.id),
      v: valorEfectivo(r, clave),
      nocap: true,
    }));
}

/**
 * Mensajes de un obstáculo (protocolo de engine/worker.js).
 * @param {Obstaculo} b
 */
function mensajeObstaculo(b) {
  if (b.tipo === 'laberinto')
    return { t: 'maze', kind: b.forma, corridor: b.pasillo, wall: b.muro };
  return { t: b.tipo === 'forma' ? 'shape' : 'shapes-add10', dw: b.ancho, dh: b.alto };
}

/**
 * La secuencia de mensajes al worker que arma el escenario con esa semilla:
 * pausa, reset limpio (C15: opciones + siembra de las especies, sin nada de
 * la sim anterior —ni las formas que PP-03 regenera— y con los colores de
 * las formas sembrados con la semilla) y los objetos. Así «escenario +
 * semilla» da la misma corrida en cualquier worker. El worker atiende en
 * orden, así que la secuencia llega tal cual. Un laberinto polar enciende
 * la deriva (DERIVA_POLAR): las opciones 83–85 que los cambios fijan con
 * otro valor se reenvían al final (setopt nocap), así la sim queda con
 * resolverOpciones(e).
 *
 * adnDe(especie) da el ADN de cada especie sin `adn` propio (Bestiary o
 * bots del usuario); si no lo hay, ErrorEscenario('sin-adn').
 * @param {Escenario} e @param {number} semilla
 * @param {(s: Especie) => string | undefined} [adnDe]
 * @returns {any[]}
 */
export function aplicar(e, semilla, adnDe = () => undefined) {
  if (typeof semilla !== 'number' || !Number.isFinite(semilla))
    throw new ErrorEscenario('semilla', [
      { codigo: 'semilla', ruta: '', detalle: String(semilla) },
    ]);
  const species = e.especies.map((s, i) => {
    const dna = s.adn ?? adnDe(s);
    if (!dna)
      throw new ErrorEscenario('sin-adn', [
        { codigo: 'sin-adn', ruta: `especies.${i}`, detalle: s.bot },
      ]);
    return {
      dna,
      name: `${s.bot}.txt`,
      veg: s.vegetal,
      qty: s.cantidad,
      nrg: s.energia,
      color: cssToVbColor(s.color),
    };
  });
  return [
    { t: 'run', running: false },
    {
      t: 'reset',
      seed: semilla,
      // Sin la deriva del polar: la pone el laberinto al crearse.
      options: opcionesReset(valoresResueltos(e.opciones.base, e.opciones.cambios)),
      species,
      limpio: true,
    },
    ...e.objetos.obstaculos.map(mensajeObstaculo),
    ...e.objetos.teleporters.map(() => ({ t: 'teleporter' })),
    ...reenviosDeriva(e),
  ];
}

/**
 * Especies cuyo ADN no coincide con el hash que guardó el escenario (el
 * bot propio cambió desde entonces). No impide correr: es un aviso.
 * @param {Escenario} e @param {(s: Especie) => string | undefined} adnDe
 * @returns {{indice: number, bot: string, esperado: string, actual: string}[]}
 */
export function verificarAdn(e, adnDe) {
  const out = [];
  for (let i = 0; i < e.especies.length; i++) {
    const s = e.especies[i];
    if (!s.hash) continue;
    const dna = s.adn ?? adnDe(s);
    if (!dna) continue;
    const h = lgHash(dna);
    if (h !== s.hash) out.push({ indice: i, bot: s.bot, esperado: s.hash, actual: h });
  }
  return out;
}

/**
 * @typedef {{clave: string, antes: number, despues: number, reenvio?: true}} CambioParametro
 * @typedef {{
 *   vivo: CambioParametro[],
 *   nueva: Array<{que: 'parametro', clave: string, antes: number, despues: number}
 *     | {que: 'especies'} | {que: 'objetos'}>,
 *   mensajes: any[],
 *   requiereNueva: boolean,
 * }} Diferencias
 */

/**
 * Qué cambia del escenario `actual` (el de la sim corriendo) al `borrador`
 * (decisiones 13 y C12): los parámetros vivos van como mensajes
 * setbase/setopt/setcost («Aplicar a la actual» manda solo esto); el resto
 * requiere sim nueva: el tamaño del campo, las especies (la siembra
 * inicial) y los objetos (son órdenes con sorteo: repetirlas suma, no
 * reemplaza). Se comparan valores efectivos, así que cambiar la base
 * cuenta como los parámetros que de verdad cambian.
 *
 * Acopladas (engine/opciones.js): el diff sigue lo que cada mensaje escribe
 * en la sim, así que si Toroidal (opt:1, derivado de 2 y 3) cambia se manda
 * opt:1 y después el eje que no quede con ese valor, y si 97 pisa un 101
 * que tiene que ser otro, 101 se vuelve a mandar después. `vivo` lista las
 * escrituras en el orden de `mensajes` (las reenviadas llevan
 * `reenvio: true`): es lo que se registra como cambio en caliente.
 * @param {Escenario} borrador @param {Escenario} actual
 * @returns {Diferencias}
 */
export function diff(borrador, actual) {
  const rb = resolverOpciones(borrador);
  const ra = resolverOpciones(actual);
  /** @type {Diferencias} */
  const d = { vivo: [], nueva: [], mensajes: [], requiereNueva: false };
  // Orden de los mensajes: base, opts y después costs, por id creciente
  // (el mismo orden en que el reset los aplica: 1 antes que 2/3, 97 antes
  // que 101).
  const orden = [...PARAMETROS].sort(
    (a, b) =>
      'boc'.indexOf(a.tipo[0]) - 'boc'.indexOf(b.tipo[0]) ||
      (typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : 0),
  );
  // Lo que la sim tendrá a medida que se aplican los mensajes.
  /** @type {Record<string, number>} */
  const estado = {};
  for (const p of orden) estado[p.clave] = valorEfectivo(ra, p.clave);
  for (const p of orden) {
    const antes = valorEfectivo(ra, p.clave);
    const despues = valorEfectivo(rb, p.clave);
    if (Object.is(estado[p.clave], despues)) continue;
    const m = mensajeVivo(p.clave, despues);
    if (m) {
      d.vivo.push(
        Object.is(antes, despues)
          ? { clave: p.clave, antes, despues, reenvio: true }
          : { clave: p.clave, antes, despues },
      );
      d.mensajes.push(m);
      Object.assign(estado, efectosDe(p.clave, despues));
    } else d.nueva.push({ que: 'parametro', clave: p.clave, antes, despues });
  }
  if (JSON.stringify(borrador.especies) !== JSON.stringify(actual.especies))
    d.nueva.push({ que: 'especies' });
  if (JSON.stringify(borrador.objetos) !== JSON.stringify(actual.objetos))
    d.nueva.push({ que: 'objetos' });
  d.requiereNueva = d.nueva.length > 0;
  return d;
}

/**
 * Nombre (o descripción) en el idioma pedido.
 * @param {TextoEsc} t @param {'es' | 'en'} idioma
 */
export const textoEn = (t, idioma) => (typeof t === 'string' ? t : t[idioma] || t.es);
