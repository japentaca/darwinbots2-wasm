// @ts-check
// Bots del usuario en darwinbots2 (paso N3.1 de port/web2/PLAN.md;
// decisiones 17, 18, 19 y 20), sin DOM: los bots propios con sus versiones,
// las marcas (favorito, tags, notas) de cualquier bot y las selecciones con
// nombre. El almacén (engine/almacen.js) se inyecta: IndexedDB en el
// navegador, almacenMemoria() en los tests.
//
// Almacén 'bots' (clave = `hash`, el hash de identidad de engine/adn.js).
// Un registro por hash, de una de dos clases:
//   clase 'propio'  un bot propio: {hash, clase, nombre, vegetal, descripcion,
//                   adn (el de la última versión), creado, actualizado,
//                   origen, versiones[], fav, tags[], notas}. Su `hash` es el
//                   de la PRIMERA versión y no cambia al editarlo (las
//                   selecciones, las marcas y el historial lo siguen); cada
//                   versión trae el suyo.
//   clase 'foro'    solo las marcas de un bot del foro (el registro del
//                   store 'bots' de la clásica): {hash, clase, nombre?,
//                   archivo?, fav, tags[], notas}. Se borra al quedar vacío
//                   (inventory.js saveUser).
// Las marcas son los mismos campos en las dos clases: van con el ADN (el
// mismo hash), como en la clásica. Si un bot propio nace con el hash de un
// registro 'foro', lo absorbe (conserva sus marcas); al borrar un propio con
// marcas, quedan como registro 'foro'.
//
// Versión: {n (1, 2, …), adn, hash, lg (lgHash, engine/adn.js), fecha, nota,
// origenes?}. `origenes` (decisión 19): una entrada por gen, en orden, con
// el bot de origen {archivo, gen} o {hash, gen} (gen en base 0) o null si el
// gen se escribió a mano. Guardar un ADN con el mismo hash que la última
// versión no crea otra.
//
// Selecciones con nombre: en 'ajustes', {clave: 'seleccion:<nombre>',
// nombre, claves[]} (claves = hashes, como las de la clásica). No se suma un
// almacén para no subir la versión del esquema.
//
// Errores: ErrorBots {codigo, params}: 'adn-vacio', 'nombre-vacio',
// 'nombre-repetido' {nombre}, 'ya-existe' {hash, nombre}, 'no-existe'
// {hash}, 'no-es-propio' {hash} (los del foro son de solo lectura: se editan
// duplicándolos, decisión 18), 'version-inexistente' {n}.

import { contarGenes, hashAdn, lgHash, tamanoDe } from './adn.js';
import { diffGenes } from './lineage.js';

export const ST_BOTS = 'bots';
export const ST_AJUSTES = 'ajustes';
export const PREFIJO_SELECCION = 'seleccion:';

/**
 * @typedef {import('./almacen.js').Almacen} Almacen
 * @typedef {import('./almacen.js').OperacionesAlmacen} OperacionesAlmacen
 * @typedef {{archivo: string, gen: number} | {hash: string, gen: number} | null} OrigenGen
 * @typedef {{n: number, adn: string, hash: string, lg: string, fecha: string, nota: string,
 *   origenes?: OrigenGen[]}} Version
 * @typedef {{tipo: 'nuevo' | 'foro' | 'propio' | 'hibrido' | 'importado', hash?: string,
 *   archivo?: string, nombre?: string}} OrigenBot
 * @typedef {{fav: boolean, tags: string[], notas: string}} Marcas
 * @typedef {Marcas & {hash: string, clase: 'propio', nombre: string, vegetal: boolean,
 *   descripcion: string, adn: string, creado: string, actualizado: string, origen: OrigenBot,
 *   versiones: Version[]}} BotPropio
 * @typedef {Marcas & {hash: string, clase: 'foro', nombre?: string, archivo?: string}} MarcaForo
 * @typedef {BotPropio | MarcaForo} RegistroBot
 * @typedef {{nombre: string, claves: string[]}} Seleccion
 * @typedef {(hash: string) => {nombre?: string, archivo?: string} | undefined} InfoBot
 */

/** Error con código estable (el texto lo pone la interfaz). */
export class ErrorBots extends Error {
  /** @param {string} codigo @param {Record<string, any>} [params] */
  constructor(codigo, params = {}) {
    super(`${codigo} ${JSON.stringify(params)}`);
    this.codigo = codigo;
    this.params = params;
  }
}

/**
 * Tag normalizado como en la clásica (inventory.js invAddTag): sin '#'
 * inicial, espacios → '-', minúsculas. '' si no queda nada.
 * @param {string} tag
 */
export const normalizarTag = (tag) =>
  String(tag ?? '')
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

/** @param {any} r @returns {Marcas} */
export const marcasDe = (r) => ({
  fav: !!r?.fav,
  tags: Array.isArray(r?.tags) ? [...r.tags] : [],
  notas: typeof r?.notas === 'string' ? r.notas : '',
});

/** @param {Marcas} m */
export const marcasVacias = (m) => !m.fav && !m.tags.length && !m.notas;

/**
 * Nombre libre: el mismo, o con « 2», « 3»… si ya está usado.
 * @param {string} nombre @param {Set<string>} usados
 */
export function nombreUnico(nombre, usados) {
  if (!usados.has(nombre)) return nombre;
  for (let i = 2; ; i++) if (!usados.has(`${nombre} ${i}`)) return `${nombre} ${i}`;
}

/**
 * Versión nueva.
 * @param {number} n @param {string} adn @param {string} fecha @param {string} nota
 * @param {OrigenGen[]} [origenes]
 * @returns {Version}
 */
export function nuevaVersion(n, adn, fecha, nota, origenes) {
  /** @type {Version} */
  const v = { n, adn, hash: hashAdn(adn), lg: lgHash(adn), fecha, nota: nota || '' };
  if (origenes) v.origenes = origenes.map((o) => (o ? { ...o } : null));
  return v;
}

/**
 * Registro de un bot propio nuevo (sin guardar). Lanza ErrorBots
 * 'adn-vacio' o 'nombre-vacio'.
 * @param {{nombre: string, adn: string, vegetal?: boolean, descripcion?: string, nota?: string,
 *   origen?: OrigenBot, origenes?: OrigenGen[], fecha: string}} o
 * @returns {BotPropio}
 */
export function nuevoBotPropio(o) {
  if (typeof o.adn !== 'string' || !o.adn.trim()) throw new ErrorBots('adn-vacio');
  const nombre = String(o.nombre ?? '').trim();
  if (!nombre) throw new ErrorBots('nombre-vacio');
  const v = nuevaVersion(1, o.adn, o.fecha, o.nota || '', o.origenes);
  return {
    hash: v.hash,
    clase: 'propio',
    nombre,
    vegetal: !!o.vegetal,
    descripcion: o.descripcion || '',
    adn: o.adn,
    creado: o.fecha,
    actualizado: o.fecha,
    origen: o.origen ? { ...o.origen } : { tipo: 'nuevo' },
    versiones: [v],
    fav: false,
    tags: [],
    notas: '',
  };
}

/**
 * Datos derivados de un propio para el índice: genes (regla del core),
 * tamaño y los hashes de todas sus versiones.
 * @param {BotPropio} b
 */
export function resumenPropio(b) {
  const genes = contarGenes(b.adn);
  return {
    genes,
    tamano: tamanoDe(genes),
    hashes: b.versiones.map((v) => v.hash),
    lgs: b.versiones.map((v) => v.lg),
  };
}

/**
 * Diff gen por gen entre dos versiones de un bot (engine/lineage.js
 * diffGenes), con el origen de cada gen de cada lado cuando lo hay.
 * @param {BotPropio} b @param {number} na @param {number} nb
 */
export function diffVersiones(b, na, nb) {
  const va = b.versiones.find((v) => v.n === na);
  const vb = b.versiones.find((v) => v.n === nb);
  if (!va) throw new ErrorBots('version-inexistente', { n: na });
  if (!vb) throw new ErrorBots('version-inexistente', { n: nb });
  return {
    ...diffGenes(va.adn, vb.adn),
    origenesA: va.origenes ?? null,
    origenesB: vb.origenes ?? null,
  };
}

/**
 * Operaciones sobre los bots del usuario.
 * @param {{almacen: Almacen, reloj?: () => Date}} deps
 */
export function crearBots(deps) {
  const { almacen } = deps;
  const ahora = () => (deps.reloj ?? (() => new Date()))().toISOString();

  /** @param {OperacionesAlmacen} t @param {string} [salvo] hash que no cuenta */
  async function nombresPropios(t, salvo) {
    const filas = /** @type {RegistroBot[]} */ (await t.list(ST_BOTS));
    return new Set(
      filas.filter((r) => r.clase === 'propio' && r.hash !== salvo).map((r) => r.nombre),
    );
  }

  /** @param {OperacionesAlmacen} t @param {string} hash */
  async function propio(t, hash) {
    const r = /** @type {RegistroBot | undefined} */ (await t.get(ST_BOTS, hash));
    if (!r) throw new ErrorBots('no-existe', { hash });
    if (r.clase !== 'propio') throw new ErrorBots('no-es-propio', { hash });
    return r;
  }

  /**
   * Guarda un propio nuevo. Nombre repetido: 'nombre-repetido', salvo con
   * `renombrar` (le busca uno libre). Mismo ADN que otro propio: 'ya-existe'.
   * @param {OperacionesAlmacen} t @param {BotPropio} b @param {boolean} renombrar
   */
  async function insertar(t, b, renombrar) {
    const previo = /** @type {RegistroBot | undefined} */ (await t.get(ST_BOTS, b.hash));
    if (previo?.clase === 'propio')
      throw new ErrorBots('ya-existe', { hash: b.hash, nombre: previo.nombre });
    const usados = await nombresPropios(t);
    if (usados.has(b.nombre)) {
      if (!renombrar) throw new ErrorBots('nombre-repetido', { nombre: b.nombre });
      b.nombre = nombreUnico(b.nombre, usados);
    }
    if (previo) Object.assign(b, marcasDe(previo)); // absorbe las marcas del foro
    await t.put(ST_BOTS, b);
    return b;
  }

  return {
    /** Todos los registros (propios y marcas del foro). @returns {Promise<RegistroBot[]>} */
    todos: () => almacen.list(ST_BOTS),

    /** Los propios, por nombre. @returns {Promise<BotPropio[]>} */
    async propios() {
      const filas = /** @type {RegistroBot[]} */ (await almacen.list(ST_BOTS));
      return /** @type {BotPropio[]} */ (filas.filter((r) => r.clase === 'propio')).sort(
        (a, b) => a.nombre.localeCompare(b.nombre) || a.hash.localeCompare(b.hash),
      );
    },

    /** @param {string} hash @returns {Promise<RegistroBot | undefined>} */
    obtener: (hash) => almacen.get(ST_BOTS, hash),

    /**
     * Crea un bot propio (versión 1). Ver insertar().
     * @param {{nombre: string, adn: string, vegetal?: boolean, descripcion?: string, nota?: string,
     *   origen?: OrigenBot, origenes?: OrigenGen[]}} o
     * @param {{renombrar?: boolean}} [op]
     * @returns {Promise<BotPropio>}
     */
    async crear(o, op = {}) {
      const b = nuevoBotPropio({ ...o, fecha: ahora() });
      return almacen.tx([ST_BOTS], (t) => insertar(t, b, !!op.renombrar));
    },

    /**
     * Duplica un bot (del foro o propio) como propio nuevo: los del foro
     * son de solo lectura y se editan así (decisión 18). El nombre, si no
     * se da, es el del original con un número libre.
     * @param {{hash: string, nombre: string, archivo?: string, vegetal?: boolean, clase: 'foro' | 'propio'}} de
     * @param {string} adn el texto del original (el .txt del foro o la versión elegida)
     * @param {{nombre?: string, nota?: string}} [o]
     * @returns {Promise<BotPropio>}
     */
    async duplicar(de, adn, o = {}) {
      /** @type {OrigenBot} */
      const origen = { tipo: de.clase, hash: de.hash, nombre: de.nombre };
      if (de.archivo) origen.archivo = de.archivo;
      const b = nuevoBotPropio({
        nombre: o.nombre || de.nombre,
        adn,
        vegetal: de.vegetal,
        nota: o.nota,
        origen,
        fecha: ahora(),
      });
      return almacen.tx([ST_BOTS], (t) => insertar(t, b, !o.nombre));
    },

    /**
     * Guarda una versión nueva del ADN. Devuelve el bot (con la versión
     * nueva al final) o null si el ADN no cambió (mismo hash que la última).
     * @param {string} hash
     * @param {string} adn
     * @param {{nota?: string, origenes?: OrigenGen[]}} [o]
     * @returns {Promise<BotPropio | null>}
     */
    guardarVersion(hash, adn, o = {}) {
      if (typeof adn !== 'string' || !adn.trim()) return Promise.reject(new ErrorBots('adn-vacio'));
      return almacen.tx([ST_BOTS], async (t) => {
        const b = await propio(t, hash);
        const ult = b.versiones[b.versiones.length - 1];
        if (ult && ult.hash === hashAdn(adn)) return null;
        const fecha = ahora();
        b.versiones.push(nuevaVersion((ult?.n ?? 0) + 1, adn, fecha, o.nota || '', o.origenes));
        b.adn = adn;
        b.actualizado = fecha;
        await t.put(ST_BOTS, b);
        return b;
      });
    },

    /**
     * Vuelve a una versión anterior: la guarda como versión nueva (no se
     * pierde la historia). null si ya es la actual.
     * @param {string} hash @param {number} n @param {string} [nota]
     */
    async restaurarVersion(hash, n, nota) {
      const b = await propio(almacen, hash);
      const v = b.versiones.find((x) => x.n === n);
      if (!v) throw new ErrorBots('version-inexistente', { n });
      return this.guardarVersion(hash, v.adn, { nota: nota ?? '', origenes: v.origenes });
    },

    /**
     * Cambia nombre, vegetal o descripción de un propio.
     * @param {string} hash @param {{nombre?: string, vegetal?: boolean, descripcion?: string}} c
     * @returns {Promise<BotPropio>}
     */
    cambiarDatos(hash, c) {
      return almacen.tx([ST_BOTS], async (t) => {
        const b = await propio(t, hash);
        if (c.nombre !== undefined) {
          const nombre = String(c.nombre).trim();
          if (!nombre) throw new ErrorBots('nombre-vacio');
          if ((await nombresPropios(t, hash)).has(nombre))
            throw new ErrorBots('nombre-repetido', { nombre });
          b.nombre = nombre;
        }
        if (c.vegetal !== undefined) b.vegetal = !!c.vegetal;
        if (c.descripcion !== undefined) b.descripcion = String(c.descripcion);
        b.actualizado = ahora();
        await t.put(ST_BOTS, b);
        return b;
      });
    },

    /**
     * Borra un propio. Si tenía marcas, quedan (como las de un bot del foro
     * con ese ADN).
     * @param {string} hash
     */
    borrar(hash) {
      return almacen.tx([ST_BOTS], async (t) => {
        const b = await propio(t, hash);
        const m = marcasDe(b);
        if (marcasVacias(m)) await t.delete(ST_BOTS, hash);
        else await t.put(ST_BOTS, { hash, clase: 'foro', ...m });
      });
    },

    /**
     * El propio y la versión que tienen ese lgHash (el hash de los
     * escenarios y los torneos), o null.
     * @param {string} lg
     * @returns {Promise<{bot: BotPropio, version: Version} | null>}
     */
    async porLg(lg) {
      for (const b of await this.propios()) {
        const v = b.versiones.find((x) => x.lg === lg);
        if (v) return { bot: b, version: v };
      }
      return null;
    },

    // ---- Marcas ----------------------------------------------------------------

    /**
     * Cambia las marcas de uno o varios bots. `info` completa el registro
     * de un bot del foro (nombre y archivo, como la clásica).
     * @param {string[]} hashes
     * @param {(m: Marcas) => Marcas} cambio
     * @param {InfoBot} [info]
     */
    marcar(hashes, cambio, info) {
      return almacen.tx([ST_BOTS], async (t) => {
        for (const hash of hashes) {
          const r = /** @type {RegistroBot | undefined} */ (await t.get(ST_BOTS, hash));
          const m = cambio(marcasDe(r));
          m.tags = [...new Set(m.tags.map(normalizarTag).filter(Boolean))].sort();
          if (r?.clase === 'propio') await t.put(ST_BOTS, { ...r, ...m });
          else if (marcasVacias(m)) {
            if (r) await t.delete(ST_BOTS, hash);
          } else {
            /** @type {MarcaForo} */
            const f = { hash, clase: 'foro', ...m };
            const i = info?.(hash) ?? r;
            if (i?.nombre) f.nombre = i.nombre;
            if (i?.archivo) f.archivo = i.archivo;
            await t.put(ST_BOTS, f);
          }
        }
      });
    },

    /** @param {string[]} hashes @param {boolean} fav @param {InfoBot} [info] */
    favorito(hashes, fav, info) {
      return this.marcar(hashes, (m) => ({ ...m, fav }), info);
    },
    /** @param {string[]} hashes @param {string} tag @param {InfoBot} [info] */
    agregarTag(hashes, tag, info) {
      const g = normalizarTag(tag);
      if (!g) return Promise.resolve();
      return this.marcar(hashes, (m) => ({ ...m, tags: [...m.tags, g] }), info);
    },
    /** @param {string[]} hashes @param {string} tag */
    quitarTag(hashes, tag) {
      const g = normalizarTag(tag);
      return this.marcar(hashes, (m) => ({ ...m, tags: m.tags.filter((x) => x !== g) }));
    },
    /** @param {string} hash @param {string} notas @param {InfoBot} [info] */
    notas(hash, notas, info) {
      return this.marcar([hash], (m) => ({ ...m, notas: String(notas ?? '').trim() }), info);
    },

    // ---- Selecciones con nombre -----------------------------------------------

    /** @returns {Promise<Seleccion[]>} */
    async selecciones() {
      const filas = await almacen.list(ST_AJUSTES);
      return filas
        .filter((f) => typeof f.clave === 'string' && f.clave.startsWith(PREFIJO_SELECCION))
        .map((f) => ({ nombre: f.nombre, claves: [...f.claves] }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    /** @param {string} nombre @param {string[]} claves */
    async guardarSeleccion(nombre, claves) {
      const n = String(nombre ?? '').trim();
      if (!n) throw new ErrorBots('nombre-vacio');
      await almacen.put(ST_AJUSTES, {
        clave: PREFIJO_SELECCION + n,
        nombre: n,
        claves: [...new Set(claves)],
      });
    },
    /** @param {string} nombre */
    borrarSeleccion: (nombre) => almacen.delete(ST_AJUSTES, PREFIJO_SELECCION + nombre),
  };
}
