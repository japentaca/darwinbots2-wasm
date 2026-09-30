// @ts-check
// Bots del usuario en darwinbots2 (paso N3.1 de port/web2/PLAN.md;
// decisiones 17, 18, 19 y 20), sin DOM: los bots propios con sus versiones,
// las marcas (favorito, tags, notas) de los bots del foro y las selecciones
// con nombre. El almacén (engine/almacen.js) se inyecta: IndexedDB en el
// navegador, almacenMemoria() en los tests.
//
// ---- Claves -------------------------------------------------------------------
//
// Almacén 'bots'. Su keyPath es `hash` (esquema de engine/almacen.js), así
// que la clave de cada registro vive en el campo `hash`, pero NO siempre es
// un hash del contenido. En esta API se la llama «clave»:
//   - bot propio: un id propio 'p:' + 16 hex al azar (esClavePropia),
//     independiente del ADN. Dos propios con el mismo ADN coexisten; editar
//     un propio no cambia su clave. El `hash` (hashAdn) y el `lg` (lgHash) de
//     cada versión están en `versiones[]`.
//   - marcas de un bot del foro: el hash de identidad de profiles.json (16
//     hex, el de la clásica) o 'file:<archivo>' si no tiene perfil
//     (esClaveForo). Varios archivos con el mismo ADN comparten marcas.
// Las dos familias no se pisan nunca: duplicar un bot del foro no toca sus
// marcas, y las selecciones (listas de claves) distinguen foro vs propio
// por el prefijo.
//
// Registros:
//   clase 'propio'  {hash: clave 'p:…', clase, nombre, vegetal, descripcion,
//                   adn (el de la última versión), creado, actualizado,
//                   origen, versiones[], fav, tags[], notas}. Las marcas de
//                   un propio van en su propio registro y se borran con él.
//   clase 'foro'    solo las marcas de un bot del foro (el registro del
//                   store 'bots' de la clásica): {hash: clave del foro,
//                   clase, nombre?, archivo?, fav, tags[], notas}. Se borra
//                   al quedar vacío (inventory.js saveUser).
//
// Versión: {n (1, 2, …), adn, hash (hashAdn, engine/adn.js), lg (lgHash),
// fecha, nota, origenes?}. `origenes` (decisión 19): una entrada por gen, en
// orden, con el bot de origen {archivo, gen} (del foro) o {hash, gen} (el
// hashAdn del ADN de donde salió; gen en base 0) o null si el gen se
// escribió a mano. Guardar un ADN con el mismo hash que la última versión
// no crea otra.
//
// Origen del bot (`origen`): {tipo: 'nuevo' | 'foro' | 'propio' | 'hibrido'
// | 'importado', clave?, archivo?, nombre?}. En un duplicado, `clave` es la
// del original (hash del foro o 'p:…'); en un híbrido migrado de la
// clásica, `nombre` es el nombre del híbrido en el Laboratorio.
//
// Selecciones con nombre: en 'ajustes', {clave: 'seleccion:<nombre>',
// nombre, claves[]} (claves del foro o de propios). No se suma un almacén
// para no subir la versión del esquema. Borrar un propio lo quita de las
// selecciones.
//
// ---- API ------------------------------------------------------------------------
//
// Funciones puras:
//   esClavePropia(k), esClaveForo(k), nuevaClavePropia()
//   normalizarTag(tag), marcasDe(r), marcasVacias(m), nombreUnico(nombre, usados)
//   nuevaVersion(n, adn, fecha, nota, origenes?) → Version
//   nuevoBotPropio({nombre, adn, vegetal?, descripcion?, nota?, origen?,
//     origenes?, fecha, clave?}) → BotPropio (sin guardar; clave nueva si no
//     se da)
//   resumenPropio(b) → {genes, tamano, hashes[], lgs[]}
//   diffVersiones(b, na, nb) → diffGenes + {origenesA, origenesB}
//
// crearBots({almacen, reloj?, nuevaClave?, nombresForo?}) → operaciones.
//   nombresForo: () => Iterable<string> con los nombres del Bestiary
//   (bots.json); sin él no se avisa de nombres del foro.
//   todos() → RegistroBot[]
//   propios() → BotPropio[] (por nombre)
//   obtener(clave) → RegistroBot | undefined
//   porNombre(nombre) → BotPropio | null
//   porLg(lg) → {bot, version} | null   (la versión exacta con ese lgHash)
//   adnDeEspecie(especie) → string | undefined   ADN de una especie de
//     escenario de origen 'propio' sin ADN dentro: porLg(s.hash) → la
//     versión exacta; si no, el propio por nombre (su última versión: el
//     llamador avisa con verificarAdn de engine/escenarios).
//   crear(o, {renombrar?, permitirNombreForo?}) → BotPropio
//   duplicar(de, adn, {nombre?, nota?, permitirNombreForo?}) → BotPropio.
//     de = {clase, clave, nombre, archivo?, vegetal?} (una Entrada de
//     engine/biblioteca.js sirve). Sin nombre: el del original con « 2»,
//     « 3»… libre entre los propios Y el Bestiary.
//   guardarVersion(clave, adn, {nota?, origenes?}) → BotPropio | null
//     null solo si el texto es EXACTAMENTE el de la última versión (el `lg`
//     cambia con comentarios, cabecera o sangría: eso también se guarda;
//     `hash` sigue siendo la identidad del ADN)
//   restaurarVersion(clave, n, nota?) → BotPropio | null
//   cambiarDatos(clave, {nombre?, vegetal?, descripcion?}, {permitirNombreForo?}) → BotPropio
//   borrar(clave)   borra el propio con sus marcas y lo quita de las selecciones
//   marcar(claves, cambio, info?), favorito(claves, fav, info?),
//   agregarTag(claves, tag, info?), quitarTag(claves, tag),
//   notas(clave, texto, info?)   en un propio, su registro; en uno del foro,
//     el registro de marcas (info completa nombre y archivo). Las claves que
//     no son de ninguna de las dos familias (o un propio que no existe) se
//     ignoran.
//   selecciones() → Seleccion[], guardarSeleccion(nombre, claves),
//   borrarSeleccion(nombre)
//
// Errores: ErrorBots {codigo, params}: 'adn-vacio', 'nombre-vacio',
// 'nombre-repetido' {nombre}, 'nombre-del-foro' {nombre} (crear, duplicar
// con nombre y cambiarDatos: el nombre es el de un bot del Bestiary; la
// interfaz avisa y reintenta con permitirNombreForo si el usuario confirma),
// 'no-existe' {clave}, 'no-es-propio' {clave} (los del foro son de solo
// lectura: se editan duplicándolos, decisión 18), 'version-inexistente' {n}.

import { contarGenes, hashAdn, lgHash, tamanoDe } from './adn.js';
import { diffGenes } from './lineage.js';

export const ST_BOTS = 'bots';
export const ST_AJUSTES = 'ajustes';
export const PREFIJO_SELECCION = 'seleccion:';
export const PREFIJO_PROPIO = 'p:';

/**
 * @typedef {import('./almacen.js').Almacen} Almacen
 * @typedef {import('./almacen.js').OperacionesAlmacen} OperacionesAlmacen
 * @typedef {{archivo: string, gen: number} | {hash: string, gen: number} | null} OrigenGen
 * @typedef {{n: number, adn: string, hash: string, lg: string, fecha: string, nota: string,
 *   origenes?: OrigenGen[]}} Version
 * @typedef {{tipo: 'nuevo' | 'foro' | 'propio' | 'hibrido' | 'importado', clave?: string,
 *   archivo?: string, nombre?: string}} OrigenBot
 * @typedef {{fav: boolean, tags: string[], notas: string}} Marcas
 * @typedef {Marcas & {hash: string, clase: 'propio', nombre: string, vegetal: boolean,
 *   descripcion: string, adn: string, creado: string, actualizado: string, origen: OrigenBot,
 *   versiones: Version[]}} BotPropio  `hash` = la clave 'p:…'
 * @typedef {Marcas & {hash: string, clase: 'foro', nombre?: string, archivo?: string}} MarcaForo
 * @typedef {BotPropio | MarcaForo} RegistroBot
 * @typedef {{nombre: string, claves: string[]}} Seleccion
 * @typedef {(clave: string) => {nombre?: string, archivo?: string} | undefined} InfoBot
 * @typedef {{clase: 'foro' | 'propio', clave: string, nombre: string, archivo?: string,
 *   vegetal?: boolean}} OrigenDuplicado
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

const RE_PROPIA = /^p:[0-9a-f]{16}$/;
const RE_HASH = /^[0-9a-f]{16}$/;

/** ¿Es la clave de un bot propio ('p:' + 16 hex)? @param {unknown} k */
export const esClavePropia = (k) => typeof k === 'string' && RE_PROPIA.test(k);

/** ¿Es la clave de un bot del foro (16 hex o 'file:<archivo>')? @param {unknown} k */
export const esClaveForo = (k) =>
  typeof k === 'string' && (RE_HASH.test(k) || (k.startsWith('file:') && k.length > 5));

/** Clave nueva de un propio: 'p:' + 16 hex al azar (crypto). */
export function nuevaClavePropia() {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return PREFIJO_PROPIO + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
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
 * ¿La versión tiene exactamente este texto? Por `lg` (lgHash, del texto
 * exacto) y, si la versión trae el ADN, comparándolo (sin colisiones).
 * @param {{adn?: string, lg?: string}} v @param {string} adn
 */
export function mismoTexto(v, adn) {
  if (typeof v.adn === 'string') return v.adn === adn;
  return v.lg === lgHash(adn);
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
 * Registro de un bot propio nuevo (sin guardar), con clave nueva si no se
 * da. Lanza ErrorBots 'adn-vacio' o 'nombre-vacio'.
 * @param {{nombre: string, adn: string, vegetal?: boolean, descripcion?: string, nota?: string,
 *   origen?: OrigenBot, origenes?: OrigenGen[], fecha: string, clave?: string}} o
 * @returns {BotPropio}
 */
export function nuevoBotPropio(o) {
  if (typeof o.adn !== 'string' || !o.adn.trim()) throw new ErrorBots('adn-vacio');
  const nombre = String(o.nombre ?? '').trim();
  if (!nombre) throw new ErrorBots('nombre-vacio');
  const v = nuevaVersion(1, o.adn, o.fecha, o.nota || '', o.origenes);
  return {
    hash: o.clave ?? nuevaClavePropia(),
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

/** Orden de los propios: nombre y, de desempate, clave. */
const porNombreYClave = (/** @type {BotPropio} */ a, /** @type {BotPropio} */ b) =>
  a.nombre.localeCompare(b.nombre) || a.hash.localeCompare(b.hash);

/**
 * Operaciones sobre los bots del usuario (ver la cabecera).
 * @param {{almacen: Almacen, reloj?: () => Date, nuevaClave?: () => string,
 *   nombresForo?: () => Iterable<string>}} deps
 */
export function crearBots(deps) {
  const { almacen } = deps;
  const ahora = () => (deps.reloj ?? (() => new Date()))().toISOString();
  const nuevaClave = deps.nuevaClave ?? nuevaClavePropia;
  /** Nombres del Bestiary (se leen fuera de las transacciones). */
  const nombresForo = () => new Set(deps.nombresForo ? deps.nombresForo() : []);

  /** @param {OperacionesAlmacen} t @param {string} [salvo] clave que no cuenta */
  async function nombresPropios(t, salvo) {
    const filas = /** @type {RegistroBot[]} */ (await t.list(ST_BOTS));
    return new Set(
      filas.filter((r) => r.clase === 'propio' && r.hash !== salvo).map((r) => r.nombre),
    );
  }

  /** @param {OperacionesAlmacen} t @param {string} clave */
  async function propio(t, clave) {
    const r = /** @type {RegistroBot | undefined} */ (await t.get(ST_BOTS, clave));
    if (!r) throw new ErrorBots('no-existe', { clave });
    if (r.clase !== 'propio') throw new ErrorBots('no-es-propio', { clave });
    return r;
  }

  /**
   * Nombre de un propio nuevo o renombrado. Con `libre`, busca uno que no
   * usen los propios ni el Bestiary (« 2», « 3»…); si no, lanza
   * 'nombre-repetido' o 'nombre-del-foro' (salvo permitirNombreForo).
   * @param {string} nombre @param {Set<string>} propios @param {Set<string>} foro
   * @param {{libre?: boolean, usado?: string, permitirNombreForo?: boolean}} o
   *   usado: un nombre más que cuenta como usado (con libre)
   */
  function elegirNombre(nombre, propios, foro, o) {
    if (o.libre) {
      const usados = new Set([...propios, ...foro]);
      if (o.usado) usados.add(o.usado);
      return nombreUnico(nombre, usados);
    }
    if (propios.has(nombre)) throw new ErrorBots('nombre-repetido', { nombre });
    if (!o.permitirNombreForo && foro.has(nombre))
      throw new ErrorBots('nombre-del-foro', { nombre });
    return nombre;
  }

  /**
   * Guarda un propio nuevo (ver elegirNombre).
   * @param {BotPropio} b @param {{libre?: boolean, usado?: string, permitirNombreForo?: boolean}} o
   */
  function insertar(b, o) {
    const foro = nombresForo();
    return almacen.tx([ST_BOTS], async (t) => {
      b.nombre = elegirNombre(b.nombre, await nombresPropios(t), foro, o);
      await t.put(ST_BOTS, b);
      return b;
    });
  }

  const api = {
    /** Todos los registros (propios y marcas del foro). @returns {Promise<RegistroBot[]>} */
    todos: () => almacen.list(ST_BOTS),

    /** Los propios, por nombre. @returns {Promise<BotPropio[]>} */
    async propios() {
      const filas = /** @type {RegistroBot[]} */ (await almacen.list(ST_BOTS));
      return /** @type {BotPropio[]} */ (filas.filter((r) => r.clase === 'propio')).sort(
        porNombreYClave,
      );
    },

    /** @param {string} clave @returns {Promise<RegistroBot | undefined>} */
    obtener: (clave) => almacen.get(ST_BOTS, clave),

    /**
     * El propio con ese nombre exacto (los nombres de los propios no se
     * repiten), o null.
     * @param {string} nombre @returns {Promise<BotPropio | null>}
     */
    async porNombre(nombre) {
      return (await api.propios()).find((b) => b.nombre === nombre) ?? null;
    },

    /**
     * El propio y la versión exacta que tienen ese lgHash (el hash de los
     * escenarios y los torneos), o null. Si varios propios la tienen, el
     * primero por nombre.
     * @param {string} lg
     * @returns {Promise<{bot: BotPropio, version: Version} | null>}
     */
    async porLg(lg) {
      for (const b of await api.propios()) {
        const v = b.versiones.find((x) => x.lg === lg);
        if (v) return { bot: b, version: v };
      }
      return null;
    },

    /**
     * ADN de una especie de escenario de origen 'propio' (sin ADN dentro):
     * la versión exacta por `hash` (lgHash) y, si no está, la última del
     * propio con ese nombre. undefined si no hay ninguno.
     * @param {{bot: string, hash?: string}} s
     * @returns {Promise<string | undefined>}
     */
    async adnDeEspecie(s) {
      if (s.hash) {
        const x = await api.porLg(s.hash);
        if (x) return x.version.adn;
      }
      return (await api.porNombre(s.bot))?.adn;
    },

    /**
     * Crea un bot propio (versión 1) con clave nueva. `renombrar`: con un
     * nombre usado (por un propio o el Bestiary) le busca uno libre.
     * @param {{nombre: string, adn: string, vegetal?: boolean, descripcion?: string, nota?: string,
     *   origen?: OrigenBot, origenes?: OrigenGen[]}} o
     * @param {{renombrar?: boolean, permitirNombreForo?: boolean}} [op]
     * @returns {Promise<BotPropio>}
     */
    crear(o, op = {}) {
      try {
        const b = nuevoBotPropio({ ...o, fecha: ahora(), clave: nuevaClave() });
        return insertar(b, { libre: !!op.renombrar, permitirNombreForo: op.permitirNombreForo });
      } catch (e) {
        return Promise.reject(e);
      }
    },

    /**
     * Duplica un bot (del foro o propio) como propio nuevo: los del foro
     * son de solo lectura y se editan así (decisión 18). Las marcas del
     * original no se tocan. Sin nombre: el del original con « 2», « 3»…
     * libre entre los propios y el Bestiary.
     * @param {OrigenDuplicado} de
     * @param {string} adn el texto del original (el .txt del foro o la versión elegida)
     * @param {{nombre?: string, nota?: string, permitirNombreForo?: boolean}} [o]
     * @returns {Promise<BotPropio>}
     */
    duplicar(de, adn, o = {}) {
      try {
        /** @type {OrigenBot} */
        const origen = { tipo: de.clase, clave: de.clave, nombre: de.nombre };
        if (de.archivo) origen.archivo = de.archivo;
        const b = nuevoBotPropio({
          nombre: o.nombre || de.nombre,
          adn,
          vegetal: de.vegetal,
          nota: o.nota,
          origen,
          fecha: ahora(),
          clave: nuevaClave(),
        });
        // sin nombre, desde « 2»: el del original cuenta como usado
        return insertar(
          b,
          o.nombre
            ? { permitirNombreForo: o.permitirNombreForo }
            : { libre: true, usado: b.nombre },
        );
      } catch (e) {
        return Promise.reject(e);
      }
    },

    /**
     * Guarda una versión nueva del ADN. Devuelve el bot (con la versión
     * nueva al final) o null si el texto es exactamente el de la última
     * (mismo `lg`, texto exacto; un cambio de comentarios o sangría, que no
     * cambia el `hash`, sí se guarda).
     * @param {string} clave
     * @param {string} adn
     * @param {{nota?: string, origenes?: OrigenGen[]}} [o]
     * @returns {Promise<BotPropio | null>}
     */
    guardarVersion(clave, adn, o = {}) {
      if (typeof adn !== 'string' || !adn.trim()) return Promise.reject(new ErrorBots('adn-vacio'));
      return almacen.tx([ST_BOTS], async (t) => {
        const b = await propio(t, clave);
        const ult = b.versiones[b.versiones.length - 1];
        if (ult && mismoTexto(ult, adn)) return null;
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
     * @param {string} clave @param {number} n @param {string} [nota]
     */
    async restaurarVersion(clave, n, nota) {
      const b = await propio(almacen, clave);
      const v = b.versiones.find((x) => x.n === n);
      if (!v) throw new ErrorBots('version-inexistente', { n });
      return api.guardarVersion(clave, v.adn, { nota: nota ?? '', origenes: v.origenes });
    },

    /**
     * Cambia nombre, vegetal o descripción de un propio.
     * @param {string} clave @param {{nombre?: string, vegetal?: boolean, descripcion?: string}} c
     * @param {{permitirNombreForo?: boolean}} [op]
     * @returns {Promise<BotPropio>}
     */
    cambiarDatos(clave, c, op = {}) {
      const foro = nombresForo();
      return almacen.tx([ST_BOTS], async (t) => {
        const b = await propio(t, clave);
        if (c.nombre !== undefined) {
          const nombre = String(c.nombre).trim();
          if (!nombre) throw new ErrorBots('nombre-vacio');
          if (nombre !== b.nombre)
            b.nombre = elegirNombre(nombre, await nombresPropios(t, clave), foro, op);
        }
        if (c.vegetal !== undefined) b.vegetal = !!c.vegetal;
        if (c.descripcion !== undefined) b.descripcion = String(c.descripcion);
        b.actualizado = ahora();
        await t.put(ST_BOTS, b);
        return b;
      });
    },

    /**
     * Borra un propio: con sus marcas (no quedan huérfanas) y fuera de las
     * selecciones con nombre.
     * @param {string} clave
     */
    borrar(clave) {
      return almacen.tx([ST_BOTS, ST_AJUSTES], async (t) => {
        await propio(t, clave);
        await t.delete(ST_BOTS, clave);
        for (const f of await t.list(ST_AJUSTES)) {
          if (typeof f.clave !== 'string' || !f.clave.startsWith(PREFIJO_SELECCION)) continue;
          if (!Array.isArray(f.claves) || !f.claves.includes(clave)) continue;
          await t.put(ST_AJUSTES, {
            ...f,
            claves: f.claves.filter((/** @type {string} */ k) => k !== clave),
          });
        }
      });
    },

    // ---- Marcas ----------------------------------------------------------------

    /**
     * Cambia las marcas de uno o varios bots. `info` completa el registro
     * de un bot del foro (nombre y archivo, como la clásica).
     * @param {string[]} claves
     * @param {(m: Marcas) => Marcas} cambio
     * @param {InfoBot} [info]
     */
    marcar(claves, cambio, info) {
      return almacen.tx([ST_BOTS], async (t) => {
        for (const clave of claves) {
          const r = /** @type {RegistroBot | undefined} */ (await t.get(ST_BOTS, clave));
          if (r?.clase !== 'propio' && !esClaveForo(clave)) continue;
          const m = cambio(marcasDe(r));
          m.tags = [...new Set(m.tags.map(normalizarTag).filter(Boolean))].sort();
          if (r?.clase === 'propio') await t.put(ST_BOTS, { ...r, ...m });
          else if (marcasVacias(m)) {
            if (r) await t.delete(ST_BOTS, clave);
          } else {
            /** @type {MarcaForo} */
            const f = { hash: clave, clase: 'foro', ...m };
            const i = info?.(clave) ?? r;
            if (i?.nombre) f.nombre = i.nombre;
            if (i?.archivo) f.archivo = i.archivo;
            await t.put(ST_BOTS, f);
          }
        }
      });
    },

    /** @param {string[]} claves @param {boolean} fav @param {InfoBot} [info] */
    favorito(claves, fav, info) {
      return api.marcar(claves, (m) => ({ ...m, fav }), info);
    },
    /** @param {string[]} claves @param {string} tag @param {InfoBot} [info] */
    agregarTag(claves, tag, info) {
      const g = normalizarTag(tag);
      if (!g) return Promise.resolve();
      return api.marcar(claves, (m) => ({ ...m, tags: [...m.tags, g] }), info);
    },
    /** @param {string[]} claves @param {string} tag */
    quitarTag(claves, tag) {
      const g = normalizarTag(tag);
      return api.marcar(claves, (m) => ({ ...m, tags: m.tags.filter((x) => x !== g) }));
    },
    /** @param {string} clave @param {string} notas @param {InfoBot} [info] */
    notas(clave, notas, info) {
      return api.marcar([clave], (m) => ({ ...m, notas: String(notas ?? '').trim() }), info);
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
  return api;
}
