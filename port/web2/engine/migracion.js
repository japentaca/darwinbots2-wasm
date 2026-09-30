// @ts-check
// Migración de los datos de la clásica e import/export de la biblioteca
// (paso N3.1 de port/web2/PLAN.md; decisión 17), sin DOM.
//
// La primera vez que arranca, la nueva COPIA la IndexedDB de la clásica
// (mismo origen en Pages) a darwinbots2 y avisa qué importó. La clásica no
// se toca: la base vieja se abre sin versión (no dispara upgrade) y, si no
// existe, la apertura se aborta para no crearla. Cada migración se hace una
// sola vez: una marca en 'ajustes' ({clave: 'migracion.<base>', fecha,
// resumen}), escrita en la misma transacción que los datos.
//
// «Importar desde la clásica» (manual, desde la biblioteca): la misma
// migración forzada, migrarInventario(almacen, {...ctx, forzar: true}).
// Vuelve a leer la base vieja y a aplicar sin mirar la marca (y la
// reescribe). Es idempotente: las marcas se funden, las selecciones que ya
// existen no se pisan y los híbridos ya migrados (mismo nombre en el
// Laboratorio y misma primera versión) no se duplican.
//
// Infraestructura común (la usará también la de `darwinbots-ligas`):
//   leerBaseVieja({idb, nombre, stores}) → {version, stores: {nombre: filas[]}} | null
//   migrarUnaVez(almacen, {clave, stores, leer, aplicar, reloj, forzar?}) → {nueva, resumen}
//
// darwinbots-inventario (port/web/inventory.js InvDB, versión 2), stores:
//   'bots'    keyPath 'key': {key, name?, file?, tags[], fav, notes}. key =
//             hash del ADN canónico (profiles.json) o 'file:<archivo>' si el
//             bot no tenía perfil. Se borraba al quedar vacío.
//   'sets'    keyPath 'name': {name, keys[]} (selecciones con nombre)
//   'hybrids' keyPath 'name' (lab.js): {name, veg, remap, parts: [{file, gi}],
//             updated}. Sin ADN: se arma con genes.json (engine/adn.js
//             componerHibrido) y pasa a ser un bot propio con clave nueva
//             ('p:…', engine/bots.js), origen {tipo: 'hibrido', nombre} y
//             los orígenes de sus genes (decisión 19). Dos híbridos con las
//             mismas partes y distinto nombre son dos propios.
// Las claves 'file:<archivo>' pasan al hash de profiles.json si el archivo
// lo tiene.
//
// Import/export:
//   exportarBiblioteca(almacen, {reloj}) → objeto JSON
//     {formato: 'darwinbots2-biblioteca', version: 1, exportado,
//      bots: BotPropio[] (con su clave 'p:…' y sus versiones),
//      marcas: MarcaForo[], selecciones: [{nombre, claves}]}
//   importarBiblioteca(almacen, texto | objeto, ctx) → resumen. Acepta ese
//     formato y el del Export del inventario de la clásica
//     ({format: 'darwinbots-inventario', version: 1, bots, sets};
//     inventory.js invExport/invImport, con su misma fusión: tags unidos,
//     favorito si lo era en alguno, las notas del archivo si trae; las
//     selecciones se pisan).
// Errores de formato (ErrorBots de engine/bots.js): 'json-invalido',
// 'formato-desconocido' (tampoco trae `version` numérica), 'version-nueva'
// {version}. Los registros sueltos que no validan se saltean y se cuentan
// (resumen.invalidos): un propio sin nombre o sin versiones, una versión
// sin ADN, `n` repetidos o desordenados, `origenes` que no son null ni
// {archivo|hash, gen entero ≥ 0}; una marca cuya clave no es del foro
// (16 hex o 'file:<archivo>'); una selección sin nombre o sin lista. Dos
// versiones seguidas con el mismo hash se funden (la segunda sobra).
//
// Bots propios del archivo (import de la nueva), por su clave 'p:…':
//   - no está en la biblioteca: se agrega con esa clave (sin clave válida,
//     con una nueva);
//   - está, y sus versiones (por hash) son un prefijo de las del archivo:
//     se agregan las que faltan y se actualizan adn y actualizado
//     (resumen.actualizados); si son las mismas o más, yaEstaban;
//   - está y divergen: resumen.conflictos [{clave, nombre, nuevaClave,
//     nombreNuevo}] y se importa como propio nuevo (clave nueva, nombre con
//     sufijo « 2»…). Las selecciones del archivo siguen a la clave nueva.
// Con un nombre usado por otro propio, se les da uno libre (renombrados).
//
// Fusión de marcas ya presentes en la nueva: tags unidos, favorito si lo es
// en alguno; notas: en la migración mandan las de la nueva si tiene
// (nada se pisa), en el import las del archivo si trae (como la clásica;
// resumen.notasPisadas cuenta las que reemplazaron otras distintas).
// Selecciones: la migración no pisa una que ya exista con el mismo nombre
// (seleccionesOmitidas); el import sí (seleccionesPisadas).

import { componerHibrido } from './adn.js';
import {
  ErrorBots,
  esClaveForo,
  esClavePropia,
  marcasDe,
  marcasVacias,
  nombreUnico,
  normalizarTag,
  nuevaClavePropia,
  nuevaVersion,
  nuevoBotPropio,
  PREFIJO_SELECCION,
  ST_AJUSTES,
  ST_BOTS,
} from './bots.js';
import { ST_PARTIDOS, ST_TORNEOS } from './torneos.js';

/**
 * @typedef {import('./almacen.js').Almacen} Almacen
 * @typedef {import('./almacen.js').OperacionesAlmacen} OperacionesAlmacen
 * @typedef {import('./bots.js').BotPropio} BotPropio
 * @typedef {import('./bots.js').MarcaForo} MarcaForo
 * @typedef {import('./bots.js').Seleccion} Seleccion
 * @typedef {import('./biblioteca.js').Perfiles} Perfiles
 * @typedef {import('./biblioteca.js').BotForo} BotForo
 * @typedef {import('./adn.js').GenesJson} GenesJson
 * @typedef {{version: number, stores: Record<string, any[]>}} BaseLeida
 * @typedef {{hash: string, nombre?: string, archivo?: string, fav: boolean, tags: string[],
 *   notas: string}} MarcaImportada
 * @typedef {{marcas: MarcaImportada[], selecciones: Seleccion[], propios: BotPropio[]}} DatosBiblioteca
 * @typedef {{perfiles?: Perfiles | null, genes?: GenesJson | null, bestiario?: BotForo[] | null,
 *   reloj?: () => Date, nuevaClave?: () => string}} Contexto
 *   nuevaClave: claves de los propios nuevos (tests); por defecto, al azar.
 * @typedef {{clave: string, nombre: string, nuevaClave: string, nombreNuevo: string}} Conflicto
 */

export const INV_NOMBRE = 'darwinbots-inventario';
export const INV_STORES = Object.freeze(['bots', 'sets', 'hybrids']);
export const CLAVE_MIGRACION_INVENTARIO = `migracion.${INV_NOMBRE}`;
export const FORMATO_BIBLIOTECA = 'darwinbots2-biblioteca';
export const VERSION_BIBLIOTECA = 1;
export const FORMATO_INVENTARIO = 'darwinbots-inventario';

// ---- Infraestructura común ------------------------------------------------

/**
 * Lee todos los registros de algunos almacenes de una IndexedDB ajena (la
 * de la clásica) sin modificarla: se abre sin versión (no hay upgrade) y,
 * si no existía, la apertura se aborta dentro del upgrade para no crearla.
 * null si la base no existe o no hay IndexedDB. Los almacenes que no están
 * vuelven vacíos.
 * @param {{idb?: IDBFactory | null, nombre: string, stores: readonly string[]}} o
 * @returns {Promise<BaseLeida | null>}
 */
export async function leerBaseVieja(o) {
  const idb = o.idb === undefined ? globalThis.indexedDB : o.idb;
  if (!idb) return null;
  if (typeof idb.databases === 'function') {
    try {
      const bases = await idb.databases();
      if (!bases.some((b) => b.name === o.nombre)) return null;
    } catch {
      /* sin lista: se prueba abriéndola */
    }
  }
  return new Promise((res, rej) => {
    let nueva = false;
    const r = idb.open(o.nombre);
    r.onupgradeneeded = () => {
      // no existía: se aborta para no dejarla creada (vacía, versión 1)
      nueva = true;
      r.transaction?.abort();
    };
    r.onerror = (ev) => {
      ev?.preventDefault?.();
      if (nueva) res(null);
      else
        rej(new ErrorBots('lectura', { base: o.nombre, detalle: String(r.error?.message ?? '') }));
    };
    r.onsuccess = () => {
      const db = r.result;
      /** @type {Record<string, any[]>} */
      const out = {};
      for (const s of o.stores) out[s] = [];
      const hay = o.stores.filter((s) => db.objectStoreNames.contains(s));
      if (!hay.length) {
        db.close();
        res({ version: db.version, stores: out });
        return;
      }
      const t = db.transaction(hay, 'readonly');
      for (const s of hay) {
        const q = t.objectStore(s).getAll();
        q.onsuccess = () => {
          out[s] = q.result;
        };
      }
      t.oncomplete = () => {
        db.close();
        res({ version: db.version, stores: out });
      };
      const falla = () => {
        db.close();
        rej(new ErrorBots('lectura', { base: o.nombre, detalle: String(t.error?.message ?? '') }));
      };
      t.onerror = falla;
      t.onabort = falla;
    };
  });
}

/**
 * Corre una migración una sola vez. Si la marca `clave` ya está en
 * 'ajustes', devuelve {nueva: false, resumen} (el de entonces). Si no, lee
 * la base vieja (`leer`, fuera de la transacción) y, en una transacción
 * sobre `stores` + 'ajustes', vuelve a mirar la marca (otra pestaña pudo
 * ganarle), aplica (`aplicar(t, leida)` → resumen; leida null = la base
 * vieja no existe) y escribe la marca. `forzar` (la importación manual):
 * aplica aunque la marca esté, y la reescribe con el resumen nuevo.
 * @template R
 * @param {Almacen} almacen
 * @param {{clave: string, stores: string[], leer: () => Promise<BaseLeida | null>,
 *   aplicar: (t: OperacionesAlmacen, leida: BaseLeida | null) => Promise<R>,
 *   reloj?: () => Date, forzar?: boolean}} o
 * @returns {Promise<{nueva: boolean, resumen: R}>}
 */
export async function migrarUnaVez(almacen, o) {
  if (!o.forzar) {
    const previa = await almacen.get(ST_AJUSTES, o.clave);
    if (previa) return { nueva: false, resumen: previa.resumen };
  }
  const leida = await o.leer();
  const stores = [...new Set([...o.stores, ST_AJUSTES])];
  return almacen.tx(stores, async (t) => {
    const ya = o.forzar ? null : await t.get(ST_AJUSTES, o.clave);
    if (ya) return { nueva: false, resumen: ya.resumen };
    const resumen = await o.aplicar(t, leida);
    const fecha = (o.reloj ?? (() => new Date()))().toISOString();
    await t.put(ST_AJUSTES, { clave: o.clave, fecha, resumen });
    return { nueva: true, resumen };
  });
}

// ---- Transformación del inventario viejo --------------------------------------

/**
 * Clave del inventario viejo → hash de la nueva ('file:<archivo>' pasa al
 * hash de profiles.json si lo tiene).
 * @param {string} k @param {Perfiles | null | undefined} perfiles
 */
export function claveNueva(k, perfiles) {
  if (k.startsWith('file:')) {
    const p = perfiles?.bots?.[k.slice(5)];
    if (p) return p.hash;
  }
  return k;
}

/** @param {unknown} x */
const tagsDe = (x) =>
  Array.isArray(x)
    ? [...new Set(x.map((t) => normalizarTag(String(t))).filter(Boolean))].sort()
    : [];

/**
 * Registros de la clásica → datos de la nueva (función pura). `viejo` son
 * las filas de los stores 'bots', 'sets' y 'hybrids' (los que falten,
 * vacíos). Sin genes.json, los híbridos no se pueden armar y se cuentan en
 * resumen.hibridosDescartados con motivo 'sin-genes'.
 * @param {{bots?: any[], sets?: any[], hybrids?: any[]}} viejo
 * @param {Contexto} [ctx]
 */
export function transformarInventario(viejo, ctx = {}) {
  const perfiles = ctx.perfiles;
  const ahora = (ctx.reloj ?? (() => new Date()))().toISOString();
  /** @type {Map<string, MarcaImportada>} */
  const marcas = new Map();
  let invalidos = 0;
  for (const r of viejo.bots ?? []) {
    if (!r || typeof r.key !== 'string' || !r.key) {
      invalidos++;
      continue;
    }
    const hash = claveNueva(r.key, perfiles);
    const m = marcas.get(hash) ?? { hash, fav: false, tags: [], notas: '' };
    m.fav = m.fav || !!r.fav;
    m.tags = [...new Set([...m.tags, ...tagsDe(r.tags)])].sort();
    if (!m.notas && r.notes) m.notas = String(r.notes);
    if (typeof r.name === 'string' && r.name) m.nombre = r.name;
    if (typeof r.file === 'string' && r.file) m.archivo = r.file;
    marcas.set(hash, m);
  }
  /** @type {Seleccion[]} */
  const selecciones = [];
  for (const s of viejo.sets ?? []) {
    if (!s?.name) {
      invalidos++;
      continue;
    }
    selecciones.push({
      nombre: String(s.name),
      claves: [
        ...new Set(
          (Array.isArray(s.keys) ? s.keys : []).map((k) => claveNueva(String(k), perfiles)),
        ),
      ],
    });
  }
  const nombreArchivo = new Map((ctx.bestiario ?? []).map((b) => [b.file, b.name]));
  /** @type {BotPropio[]} */
  const propios = [];
  /** @type {Array<{nombre: string, faltan: number}>} */
  const hibridosIncompletos = [];
  /** @type {Array<{nombre: string, motivo: 'sin-genes' | 'vacio'}>} */
  const hibridosDescartados = [];
  for (const h of viejo.hybrids ?? []) {
    if (!h || typeof h.name !== 'string' || !h.name) {
      invalidos++;
      continue;
    }
    if (!ctx.genes) {
      hibridosDescartados.push({ nombre: h.name, motivo: 'sin-genes' });
      continue;
    }
    const c = componerHibrido(h, { genes: ctx.genes, nombreDe: (f) => nombreArchivo.get(f) });
    if (!c.origenes.length) {
      hibridosDescartados.push({ nombre: h.name, motivo: 'vacio' });
      continue;
    }
    if (c.faltan) hibridosIncompletos.push({ nombre: h.name, faltan: c.faltan });
    propios.push(
      nuevoBotPropio({
        nombre: h.name,
        adn: c.adn,
        vegetal: !!h.veg,
        origen: { tipo: 'hibrido', nombre: h.name },
        origenes: c.origenes,
        fecha: typeof h.updated === 'string' && h.updated ? h.updated : ahora,
        clave: (ctx.nuevaClave ?? nuevaClavePropia)(),
      }),
    );
  }
  const lm = [...marcas.values()];
  const conocidos = perfiles ? new Set(Object.values(perfiles.bots).map((p) => p.hash)) : null;
  return {
    datos: /** @type {DatosBiblioteca} */ ({ marcas: lm, selecciones, propios }),
    resumen: {
      marcas: lm.length,
      favoritos: lm.filter((m) => m.fav).length,
      conTags: lm.filter((m) => m.tags.length).length,
      conNotas: lm.filter((m) => m.notas).length,
      // marcas de bots que ya no están en el Bestiary (se guardan igual)
      huerfanas: conocidos ? lm.filter((m) => !conocidos.has(m.hash)).length : 0,
      selecciones: selecciones.length,
      hibridos: propios.length,
      hibridosIncompletos,
      hibridosDescartados,
      invalidos,
    },
  };
}

// ---- Aplicar datos al almacén ------------------------------------------------------

/** Los hashes de las versiones de a son un prefijo de los de b. @param {BotPropio} a @param {BotPropio} b */
const esPrefijo = (a, b) =>
  a.versiones.length <= b.versiones.length &&
  a.versiones.every((v, i) => v.hash === b.versiones[i].hash);

/**
 * Escribe propios, marcas y selecciones (dentro de una transacción sobre
 * 'bots' y 'ajustes'). modo 'migracion': no pisa notas ni selecciones de la
 * nueva y saltea los híbridos ya migrados; 'importar': como el Import de la
 * clásica, con los propios por clave (ver la cabecera).
 * @param {OperacionesAlmacen} t @param {DatosBiblioteca} d @param {'migracion' | 'importar'} modo
 * @param {{nuevaClave?: () => string}} [o]
 */
export async function aplicarDatos(t, d, modo, o = {}) {
  const nuevaClave = o.nuevaClave ?? nuevaClavePropia;
  const r = {
    marcasEscritas: 0,
    notasPisadas: 0,
    seleccionesEscritas: 0,
    seleccionesOmitidas: 0,
    seleccionesPisadas: 0,
    propiosEscritos: 0,
    actualizados: 0,
    yaEstaban: 0,
    renombrados: 0,
    /** @type {Conflicto[]} */
    conflictos: [],
  };
  /** Notas fundidas (y si se pisó una distinta). @param {string} nueva @param {string} actual */
  const fundirNotas = (nueva, actual) => {
    if (modo !== 'importar') return actual || nueva;
    if (nueva && actual && nueva !== actual) r.notasPisadas++;
    return nueva || actual;
  };

  // ---- propios
  const filas = /** @type {any[]} */ (await t.list(ST_BOTS));
  const existentes = /** @type {BotPropio[]} */ (filas.filter((x) => x.clase === 'propio'));
  const usados = new Set(existentes.map((x) => x.nombre));
  /** clave del archivo → clave con que quedó (para las selecciones) @type {Map<string, string>} */
  const remapeo = new Map();
  /** @param {BotPropio} b */
  const agregar = async (b) => {
    const nombre = nombreUnico(b.nombre, usados);
    if (nombre !== b.nombre) r.renombrados++;
    b.nombre = nombre;
    usados.add(nombre);
    await t.put(ST_BOTS, b);
    r.propiosEscritos++;
  };
  for (const b0 of d.propios) {
    const b = structuredClone(b0);
    if (modo === 'migracion') {
      const ya = existentes.some(
        (x) =>
          x.origen?.tipo === 'hibrido' &&
          x.origen.nombre === b.origen?.nombre &&
          x.versiones[0]?.hash === b.versiones[0]?.hash,
      );
      if (ya) r.yaEstaban++;
      else await agregar(b);
      continue;
    }
    const clave0 = b.hash;
    const cur = esClavePropia(clave0) ? await t.get(ST_BOTS, clave0) : undefined;
    if (cur?.clase !== 'propio') {
      if (!esClavePropia(clave0) || cur) b.hash = nuevaClave();
      remapeo.set(clave0, b.hash);
      await agregar(b);
      continue;
    }
    /** @type {BotPropio} */
    const dest = cur;
    if (esPrefijo(b, dest)) {
      r.yaEstaban++;
    } else if (esPrefijo(dest, b)) {
      // el archivo es más nuevo: se agregan las versiones que faltan
      let n = dest.versiones[dest.versiones.length - 1].n;
      for (const v of b.versiones.slice(dest.versiones.length))
        dest.versiones.push({ ...v, n: ++n });
      dest.adn = b.adn;
      dest.actualizado = b.actualizado > dest.actualizado ? b.actualizado : dest.actualizado;
      dest.fav = dest.fav || b.fav;
      dest.tags = [...new Set([...dest.tags, ...b.tags])].sort();
      dest.notas = fundirNotas(b.notas, dest.notas);
      await t.put(ST_BOTS, dest);
      r.actualizados++;
    } else {
      // divergen: entra como propio nuevo
      b.hash = nuevaClave();
      remapeo.set(clave0, b.hash);
      await agregar(b);
      r.conflictos.push({
        clave: clave0,
        nombre: b0.nombre,
        nuevaClave: b.hash,
        nombreNuevo: b.nombre,
      });
    }
  }

  // ---- marcas de los del foro
  for (const m of d.marcas) {
    const cur = await t.get(ST_BOTS, m.hash);
    if (cur?.clase === 'propio') continue; // solo claves del foro
    const c = marcasDe(cur);
    const f = {
      fav: c.fav || m.fav,
      tags: [...new Set([...c.tags, ...m.tags])].sort(),
      notas: fundirNotas(m.notas, c.notas),
    };
    if (marcasVacias(f)) continue;
    /** @type {MarcaForo} */
    const reg = { hash: m.hash, clase: 'foro', ...f };
    const nombre = m.nombre ?? cur?.nombre;
    const archivo = m.archivo ?? cur?.archivo;
    if (nombre) reg.nombre = nombre;
    if (archivo) reg.archivo = archivo;
    await t.put(ST_BOTS, reg);
    r.marcasEscritas++;
  }

  // ---- selecciones (las claves de propios siguen al remapeo)
  for (const s of d.selecciones) {
    const clave = PREFIJO_SELECCION + s.nombre;
    const previa = await t.get(ST_AJUSTES, clave);
    if (previa && modo === 'migracion') {
      r.seleccionesOmitidas++;
      continue;
    }
    const claves = [...new Set(s.claves.map((k) => remapeo.get(k) ?? k))];
    if (previa && JSON.stringify(previa.claves) !== JSON.stringify(claves)) r.seleccionesPisadas++;
    await t.put(ST_AJUSTES, { clave, nombre: s.nombre, claves });
    r.seleccionesEscritas++;
  }
  return r;
}

// ---- Migración del inventario ------------------------------------------------------

/**
 * Migra darwinbots-inventario a darwinbots2 una sola vez. `leer` se inyecta
 * en los tests (por defecto, leerBaseVieja con `idb`). El resumen dice qué
 * importó (para el aviso): {existia, version?, marcas, favoritos, conTags,
 * conNotas, huerfanas, selecciones, hibridos, hibridosIncompletos,
 * hibridosDescartados, invalidos, marcasEscritas, seleccionesEscritas,
 * seleccionesOmitidas, …los contadores de aplicarDatos}. `forzar`: la
 * importación manual («Importar desde la clásica»), ver la cabecera.
 * @param {Almacen} almacen
 * @param {Contexto & {idb?: IDBFactory | null, leer?: () => Promise<BaseLeida | null>,
 *   forzar?: boolean}} [o]
 */
export function migrarInventario(almacen, o = {}) {
  const leer =
    o.leer ?? (() => leerBaseVieja({ idb: o.idb, nombre: INV_NOMBRE, stores: INV_STORES }));
  return migrarUnaVez(almacen, {
    clave: CLAVE_MIGRACION_INVENTARIO,
    stores: [ST_BOTS],
    leer,
    reloj: o.reloj,
    forzar: o.forzar,
    aplicar: async (t, leida) => {
      if (!leida) return { existia: false };
      const { datos, resumen } = transformarInventario(leida.stores, o);
      const r = await aplicarDatos(t, datos, 'migracion', o);
      return { existia: true, version: leida.version, ...resumen, ...r };
    },
  });
}

// ---- Export / import ------------------------------------------------------------------

/**
 * La biblioteca propia a JSON (objeto; la interfaz lo serializa y lo baja).
 * @param {Almacen} almacen @param {{reloj?: () => Date}} [o]
 */
export async function exportarBiblioteca(almacen, o = {}) {
  const filas = await almacen.list(ST_BOTS);
  const ajustes = await almacen.list(ST_AJUSTES);
  return {
    formato: FORMATO_BIBLIOTECA,
    version: VERSION_BIBLIOTECA,
    exportado: (o.reloj ?? (() => new Date()))().toISOString(),
    bots: filas
      .filter((r) => r.clase === 'propio')
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    marcas: filas.filter((r) => r.clase === 'foro'),
    selecciones: ajustes
      .filter((f) => typeof f.clave === 'string' && f.clave.startsWith(PREFIJO_SELECCION))
      .map((f) => ({ nombre: f.nombre, claves: f.claves })),
  };
}

/** @param {any} o origen de un gen */
const origenValido = (o) =>
  o === null ||
  (!!o &&
    typeof o === 'object' &&
    Number.isInteger(o.gen) &&
    o.gen >= 0 &&
    ((typeof o.archivo === 'string' && !!o.archivo) || (typeof o.hash === 'string' && !!o.hash)));

/**
 * Un bot propio de un archivo de la nueva, validado y con los hashes de
 * sus versiones recalculados (no se confía en los del archivo). Conserva
 * su clave si es una 'p:…' válida (si no, `hash` queda '' y aplicarDatos
 * le da una). null si no vale.
 * @param {any} b @param {string} ahora
 * @returns {BotPropio | null}
 */
function botImportado(b, ahora) {
  if (!b || typeof b !== 'object') return null;
  const nombre = typeof b.nombre === 'string' ? b.nombre.trim() : '';
  if (!nombre || !Array.isArray(b.versiones) || !b.versiones.length) return null;
  /** @type {import('./bots.js').Version[]} */
  const versiones = [];
  let nPrevio = 0;
  for (const v of b.versiones) {
    if (!v || typeof v.adn !== 'string' || !v.adn.trim()) return null;
    if (v.n !== undefined) {
      // n repetido o desordenado
      if (!Number.isInteger(v.n) || v.n <= nPrevio) return null;
      nPrevio = v.n;
    }
    let origenes;
    if (v.origenes !== undefined && v.origenes !== null) {
      if (!Array.isArray(v.origenes) || !v.origenes.every(origenValido)) return null;
      origenes = v.origenes;
    }
    const x = nuevaVersion(
      versiones.length + 1,
      v.adn,
      typeof v.fecha === 'string' && v.fecha ? v.fecha : ahora,
      typeof v.nota === 'string' ? v.nota : '',
      origenes,
    );
    // dos versiones seguidas con el mismo ADN: sobra la segunda
    if (versiones.length && versiones[versiones.length - 1].hash === x.hash) continue;
    versiones.push(x);
  }
  const ult = versiones[versiones.length - 1];
  const origen =
    b.origen && typeof b.origen === 'object' && typeof b.origen.tipo === 'string'
      ? { ...b.origen }
      : { tipo: 'importado' };
  return {
    hash: esClavePropia(b.hash) ? b.hash : '',
    clase: 'propio',
    nombre,
    vegetal: !!b.vegetal,
    descripcion: typeof b.descripcion === 'string' ? b.descripcion : '',
    adn: ult.adn,
    creado: typeof b.creado === 'string' && b.creado ? b.creado : versiones[0].fecha,
    actualizado: typeof b.actualizado === 'string' && b.actualizado ? b.actualizado : ult.fecha,
    origen,
    versiones,
    fav: !!b.fav,
    tags: tagsDe(b.tags),
    notas: typeof b.notas === 'string' ? b.notas : '',
  };
}

/** Versión del documento: formato-desconocido si falta, version-nueva si pasa de `max`. @param {any} doc @param {number} max */
function verificarVersion(doc, max) {
  if (!Number.isInteger(doc.version) || doc.version < 1) throw new ErrorBots('formato-desconocido');
  if (doc.version > max) throw new ErrorBots('version-nueva', { version: doc.version });
}

/**
 * Importa un archivo de la biblioteca (de la nueva o el Export del
 * inventario de la clásica). Lanza ErrorBots 'json-invalido',
 * 'formato-desconocido' o 'version-nueva'. Devuelve el resumen: {formato:
 * 'darwinbots2' | 'clasica', bots, marcas, selecciones, invalidos, …los
 * contadores de aplicarDatos: marcasEscritas, notasPisadas,
 * seleccionesEscritas, seleccionesOmitidas, seleccionesPisadas,
 * propiosEscritos, actualizados, yaEstaban, renombrados, conflictos[]}.
 * @param {Almacen} almacen @param {string | object} entrada @param {Contexto} [ctx]
 */
export async function importarBiblioteca(almacen, entrada, ctx = {}) {
  /** @type {any} */
  let doc = entrada;
  if (typeof entrada === 'string') {
    try {
      doc = JSON.parse(entrada);
    } catch {
      throw new ErrorBots('json-invalido');
    }
  }
  if (!doc || typeof doc !== 'object') throw new ErrorBots('formato-desconocido');
  const ahora = (ctx.reloj ?? (() => new Date()))().toISOString();
  /** @type {DatosBiblioteca} */
  let datos;
  let invalidos = 0;
  /** @type {'darwinbots2' | 'clasica'} */
  let formato;
  if (doc.formato === FORMATO_BIBLIOTECA) {
    formato = 'darwinbots2';
    verificarVersion(doc, VERSION_BIBLIOTECA);
    /** @type {BotPropio[]} */
    const propios = [];
    for (const b of Array.isArray(doc.bots) ? doc.bots : []) {
      const x = botImportado(b, ahora);
      if (x) propios.push(x);
      else invalidos++;
    }
    /** @type {MarcaImportada[]} */
    const marcas = [];
    for (const m of Array.isArray(doc.marcas) ? doc.marcas : []) {
      if (!m || !esClaveForo(m.hash)) {
        invalidos++;
        continue;
      }
      /** @type {MarcaImportada} */
      const x = {
        hash: m.hash,
        fav: !!m.fav,
        tags: tagsDe(m.tags),
        notas: typeof m.notas === 'string' ? m.notas : '',
      };
      if (typeof m.nombre === 'string') x.nombre = m.nombre;
      if (typeof m.archivo === 'string') x.archivo = m.archivo;
      marcas.push(x);
    }
    /** @type {Seleccion[]} */
    const selecciones = [];
    for (const s of Array.isArray(doc.selecciones) ? doc.selecciones : []) {
      if (!s || typeof s.nombre !== 'string' || !s.nombre.trim() || !Array.isArray(s.claves)) {
        invalidos++;
        continue;
      }
      selecciones.push({ nombre: s.nombre.trim(), claves: [...new Set(s.claves.map(String))] });
    }
    datos = { marcas, selecciones, propios };
  } else if (doc.format === FORMATO_INVENTARIO) {
    formato = 'clasica';
    verificarVersion(doc, 1);
    const t = transformarInventario(
      {
        bots: Array.isArray(doc.bots) ? doc.bots : [],
        sets: Array.isArray(doc.sets) ? doc.sets : [],
        hybrids: Array.isArray(doc.hybrids) ? doc.hybrids : [],
      },
      ctx,
    );
    datos = t.datos;
    invalidos = t.resumen.invalidos;
  } else throw new ErrorBots('formato-desconocido');
  const r = await almacen.tx([ST_BOTS, ST_AJUSTES], (t) => aplicarDatos(t, datos, 'importar', ctx));
  return {
    formato,
    bots: datos.propios.length,
    marcas: datos.marcas.length,
    selecciones: datos.selecciones.length,
    invalidos,
    ...r,
  };
}

// ---- Migración de los torneos (darwinbots-ligas) ------------------------------------
// Paso N3.4 (decisión 17). darwinbots-ligas (port/web/league.js LgDB,
// versión 1), stores:
//   'leagues'  keyPath 'id': la liga entera ({id, name, notes, created, draw,
//              seasons: [{no, started, rules, fmt, entrants: [{name, dna,
//              hash, src, file, color, qty?}], live?, next?, dry?, groups?,
//              order?}]}), el mismo modelo que engine/league.js.
//   'matches'  keyPath 'id' autoincremental: {id, league, season, no, date,
//              format, fighters[], seed, winner, wins[], capWins[], rounds,
//              cycles, capRounds, note}.
// Se COPIAN tal cual a 'torneos' y 'partidos' de darwinbots2 (la clásica no
// se toca; lgLoadAll de engine/torneos.js corre lgMigrate al leerlos). Una
// liga cuyo id ya está en la nueva no se pisa (yaEstaban) y sus partidos no
// se copian: así la importación forzada no duplica nada. Los partidos
// conservan su id si está libre en la nueva; si no, reciben uno nuevo
// (partidosReasignados; nada apunta al id de un partido fuera de la sesión).
// Registros que no tienen la forma mínima (liga sin id o sin temporadas;
// partido sin liga, temporada o luchadores) se cuentan en `invalidos`, y los
// partidos de una liga que no vino, en `huerfanos`.

export const LIGAS_NOMBRE = 'darwinbots-ligas';
export const LIGAS_STORES = Object.freeze(['leagues', 'matches']);
export const CLAVE_MIGRACION_LIGAS = `migracion.${LIGAS_NOMBRE}`;

/** @param {any} L */
const ligaValida = (L) =>
  !!L &&
  typeof L === 'object' &&
  typeof L.id === 'string' &&
  !!L.id &&
  Array.isArray(L.seasons) &&
  L.seasons.length > 0;
/** @param {any} m */
const partidoValido = (m) =>
  !!m &&
  typeof m === 'object' &&
  typeof m.league === 'string' &&
  Number.isFinite(m.season) &&
  Array.isArray(m.fighters);

/**
 * Las filas de la base vieja → ligas y partidos para copiar (pura).
 * @param {{leagues?: any[], matches?: any[]}} viejo
 */
export function transformarLigas(viejo) {
  let invalidos = 0;
  let huerfanos = 0;
  const ligas = [];
  for (const L of viejo.leagues ?? []) {
    if (ligaValida(L)) ligas.push(L);
    else invalidos++;
  }
  const ids = new Set(ligas.map((L) => L.id));
  const partidos = [];
  for (const m of viejo.matches ?? []) {
    if (!partidoValido(m)) invalidos++;
    else if (!ids.has(m.league)) huerfanos++;
    else partidos.push(m);
  }
  return { ligas, partidos, invalidos, huerfanos };
}

/**
 * Migra darwinbots-ligas a darwinbots2 una sola vez (misma infraestructura
 * que migrarInventario: marca en 'ajustes', `leer` inyectable, `forzar` para
 * la importación manual). Resumen para el aviso: {existia, version?,
 * torneos, partidos, yaEstaban, partidosReasignados, invalidos, huerfanos,
 * nombres: los nombres de los torneos copiados}.
 * @param {Almacen} almacen
 * @param {{idb?: IDBFactory | null, leer?: () => Promise<BaseLeida | null>, reloj?: () => Date,
 *   forzar?: boolean}} [o]
 */
export function migrarLigas(almacen, o = {}) {
  const leer =
    o.leer ?? (() => leerBaseVieja({ idb: o.idb, nombre: LIGAS_NOMBRE, stores: LIGAS_STORES }));
  return migrarUnaVez(almacen, {
    clave: CLAVE_MIGRACION_LIGAS,
    stores: [ST_TORNEOS, ST_PARTIDOS],
    leer,
    reloj: o.reloj,
    forzar: o.forzar,
    aplicar: async (t, leida) => {
      if (!leida) return { existia: false };
      const d = transformarLigas(leida.stores);
      const r = {
        existia: true,
        version: leida.version,
        torneos: 0,
        partidos: 0,
        yaEstaban: 0,
        partidosReasignados: 0,
        invalidos: d.invalidos,
        huerfanos: d.huerfanos,
        nombres: /** @type {string[]} */ ([]),
      };
      const copiadas = new Set();
      for (const L of d.ligas) {
        if (await t.get(ST_TORNEOS, L.id)) {
          r.yaEstaban++;
          continue;
        }
        await t.put(ST_TORNEOS, L);
        copiadas.add(L.id);
        r.torneos++;
        r.nombres.push(String(L.name ?? ''));
      }
      // Primero los que conservan su id; después, con id nuevo, los que lo
      // tenían ocupado (así un id nuevo no le quita el suyo a otro de la clásica).
      const reasignar = [];
      for (const m of d.partidos) {
        if (!copiadas.has(m.league)) continue;
        const libre =
          typeof m.id === 'number' && Number.isInteger(m.id) && !(await t.get(ST_PARTIDOS, m.id));
        if (libre) await t.put(ST_PARTIDOS, m);
        else reasignar.push(m);
        r.partidos++;
      }
      for (const { id: _id, ...sinId } of reasignar) {
        await t.put(ST_PARTIDOS, sinId);
        r.partidosReasignados++;
      }
      return r;
    },
  });
}
