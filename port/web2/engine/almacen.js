// @ts-check
// Base única de los datos del usuario (decisión 17 de port/web2/PLAN.md):
// la IndexedDB `darwinbots2`, con TODOS sus almacenes y su versión en un
// solo lugar. Todo el motor la abre por aquí (engine/torneos-db.js también).
//
// Interfaz inyectable (Almacen):
//   get(store, key)                 → valor | undefined
//   put(store, valor)               → clave (la nueva si el store es
//                                     autoincremental y el valor no la trae)
//   delete(store, key)
//   list(store)                     → todos los valores
//   claves(store)                   → todas las claves (sin leer los valores)
//   porIndice(store, indice, valor) → los valores con ese valor de índice
//   tx(stores, fn)                  → operación atómica sobre varios
//                                     almacenes: fn(t) recibe las mismas
//                                     operaciones (salvo tx) limitadas a
//                                     `stores`; si fn lanza (o una operación
//                                     falla) no queda nada de lo que hizo.
//                                     Devuelve lo que devuelve fn. Dentro de
//                                     fn solo se esperan operaciones de `t`
//                                     (en IndexedDB, esperar otra cosa cierra
//                                     la transacción).
// Dos implementaciones: almacenMemoria() (tests en node) y
// almacenIndexedDB() (el navegador). Importar este módulo no abre nada: la
// base se abre en el primer uso.
//
// Semántica de put (la de LgDB de port/web/league.js, que la base hereda):
// se guarda una copia y se devuelve la clave; el objeto original no recibe
// el id autoincremental.
//
// Esquema versionado: MIGRACIONES[v-1] lleva la base de la versión v-1 a la
// v. Una versión nueva se AGREGA al final (nunca se edita una publicada); el
// onupgradeneeded corre las que falten en orden. La versión 2 repite la
// creación de todos los almacenes e índices (idempotente): completa una
// base v1 de desarrollo que se abrió con menos almacenes.

/**
 * @typedef {{
 *   get: (store: string, key: any) => Promise<any>,
 *   put: (store: string, value: any) => Promise<any>,
 *   delete: (store: string, key: any) => Promise<void>,
 *   list: (store: string) => Promise<any[]>,
 *   claves: (store: string) => Promise<any[]>,
 *   porIndice: (store: string, indice: string, valor: any) => Promise<any[]>,
 * }} OperacionesAlmacen
 * @typedef {OperacionesAlmacen & {
 *   tx: <T>(stores: string[], fn: (t: OperacionesAlmacen) => Promise<T> | T) => Promise<T>,
 * }} Almacen
 */

/**
 * Error del almacén con código estable: 'version-vieja' (otra pestaña ya
 * abrió la base con una versión más nueva: hay que recargar la página),
 * 'sin-indexeddb', 'store-fuera-de-tx'.
 */
export class ErrorAlmacen extends Error {
  /** @param {string} codigo @param {string} [detalle] */
  constructor(codigo, detalle) {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.codigo = codigo;
  }
}

/**
 * @typedef {{keyPath: string, autoIncrement?: boolean, indices?: Record<string, string>}} DefStore
 */

export const DB2_NOMBRE = 'darwinbots2';

/**
 * Almacenes de darwinbots2 y sus índices ({nombre: keyPath}).
 *   bots            bots propios (clave = hash del ADN)
 *   escenarios      escenarios propios (engine/escenarios.js)
 *   corridas        metadatos de corridas guardadas (engine/corridas.js)
 *   corridas-datos  el .dbsim (y más adelante la historia) de cada corrida:
 *                   aparte para que listar no cargue megas
 *   informes        informes generados
 *   torneos         torneos (engine/torneos.js)
 *   partidos        partidos de los torneos (autoincremental)
 *   trabajos        cola de trabajos en segundo plano (decisión 10)
 *   ajustes         preferencias sueltas (clave → valor)
 * @type {Readonly<Record<string, DefStore>>}
 */
export const STORES = Object.freeze({
  bots: { keyPath: 'hash', indices: { nombre: 'nombre' } },
  escenarios: { keyPath: 'id', indices: { nombre: 'nombre' } },
  corridas: { keyPath: 'id', indices: { fecha: 'fecha', marcada: 'marcada' } },
  'corridas-datos': { keyPath: 'id' },
  informes: { keyPath: 'id', indices: { corrida: 'corrida' } },
  torneos: { keyPath: 'id' },
  partidos: { keyPath: 'id', autoIncrement: true, indices: { league: 'league' } },
  trabajos: { keyPath: 'id', indices: { estado: 'estado' } },
  ajustes: { keyPath: 'clave' },
});

/**
 * Migraciones: la i-ésima lleva de la versión i a la i+1. Reciben la base
 * en el upgrade y la transacción de versión (para tocar almacenes que ya
 * existen, p. ej. agregarles un índice).
 * @type {ReadonlyArray<(db: IDBDatabase, tx: IDBTransaction) => void>}
 */
export const MIGRACIONES = Object.freeze([
  // v1: todos los almacenes del plan con sus índices.
  (db, tx) => {
    for (const [nombre, d] of Object.entries(STORES)) crearStore(db, tx, nombre, d);
  },
  // v2: lo mismo (idempotente): completa una v1 de desarrollo con menos
  // almacenes o índices.
  (db, tx) => {
    for (const [nombre, d] of Object.entries(STORES)) crearStore(db, tx, nombre, d);
  },
]);

/** Versión actual del esquema. */
export const DB2_VERSION = MIGRACIONES.length;

/**
 * Crea el almacén (o le completa los índices si ya existe): idempotente.
 * @param {IDBDatabase} db @param {IDBTransaction} tx @param {string} nombre @param {DefStore} d
 */
function crearStore(db, tx, nombre, d) {
  const s = db.objectStoreNames.contains(nombre)
    ? tx.objectStore(nombre)
    : db.createObjectStore(nombre, {
        keyPath: d.keyPath,
        ...(d.autoIncrement ? { autoIncrement: true } : {}),
      });
  for (const [ind, kp] of Object.entries(d.indices || {}))
    if (!s.indexNames.contains(ind)) s.createIndex(ind, kp);
}

/** @param {string} store */
function def(store) {
  const d = STORES[store];
  if (!d) throw new Error(`almacén desconocido: ${store}`);
  return d;
}

/**
 * Almacén en memoria, con copias como IndexedDB.
 * @returns {Almacen}
 */
export function almacenMemoria() {
  /** @type {Map<string, Map<any, any>>} */
  const data = new Map();
  /** @type {Map<string, number>} */
  const seq = new Map();
  /** @param {string} store */
  const tabla = (store) => {
    def(store);
    let t = data.get(store);
    if (!t) {
      t = new Map();
      data.set(store, t);
    }
    return t;
  };
  /**
   * Las operaciones, limitadas a `permitidos` (null = todos).
   * @param {Set<string> | null} permitidos
   * @returns {OperacionesAlmacen}
   */
  const operaciones = (permitidos) => {
    /** @param {string} store */
    const t = (store) => {
      if (permitidos && !permitidos.has(store)) throw new ErrorAlmacen('store-fuera-de-tx', store);
      return tabla(store);
    };
    return {
      get: async (store, key) => {
        const v = t(store).get(key);
        return v === undefined ? undefined : structuredClone(v);
      },
      put: async (store, value) => {
        const d = def(store);
        const tb = t(store);
        const v = structuredClone(value);
        let key = v[d.keyPath];
        if (key === undefined && d.autoIncrement) {
          key = (seq.get(store) || 0) + 1;
          v[d.keyPath] = key;
        }
        if (key === undefined) throw new Error(`${store}: falta la clave ${d.keyPath}`);
        if (d.autoIncrement && typeof key === 'number')
          seq.set(store, Math.max(seq.get(store) || 0, key));
        tb.set(key, v);
        return key;
      },
      delete: async (store, key) => {
        t(store).delete(key);
      },
      list: async (store) => [...t(store).values()].map((v) => structuredClone(v)),
      claves: async (store) => [...t(store).keys()],
      porIndice: async (store, indice, valor) => {
        const kp = def(store).indices?.[indice];
        if (!kp) throw new Error(`${store}: índice desconocido ${indice}`);
        return [...t(store).values()].filter((v) => v[kp] === valor).map((v) => structuredClone(v));
      },
    };
  };
  // Las transacciones van de a una (como las readwrite de IndexedDB que se
  // pisan en almacenes) y, si fn falla, los almacenes vuelven a la foto de
  // antes.
  /** @type {Promise<unknown>} */
  let cola = Promise.resolve();
  return {
    ...operaciones(null),
    tx: (stores, fn) => {
      try {
        for (const st of stores) def(st);
      } catch (err) {
        return Promise.reject(err);
      }
      const correr = async () => {
        const foto = stores.map((st) => ({
          st,
          filas: new Map(tabla(st)),
          seq: seq.get(st),
        }));
        try {
          return await fn(operaciones(new Set(stores)));
        } catch (err) {
          for (const f of foto) {
            data.set(f.st, f.filas);
            if (f.seq === undefined) seq.delete(f.st);
            else seq.set(f.st, f.seq);
          }
          throw err;
        }
      };
      const p = cola.then(correr, correr);
      cola = p.catch(() => {});
      return p;
    },
  };
}

/**
 * Almacén sobre IndexedDB (darwinbots2). Abre la base en el primer uso; si
 * la apertura falla, el próximo uso vuelve a intentar.
 *
 * alBloqueo: otra pestaña tiene abierta una versión vieja y no la cierra (la
 * apertura queda esperando; la interfaz puede pedir que se cierre la otra).
 * alCambioVersion: HAY QUE RECARGAR LA PÁGINA. Otra pestaña abrió la base
 * con una versión más nueva (este código quedó viejo): esta conexión se
 * cierra (db.close) para no bloquearla, y desde entonces cada operación
 * rechaza con ErrorAlmacen('version-vieja') —reabrir con la versión vieja
 * da VersionError— hasta que la página se recargue con el código nuevo. Se
 * llama una sola vez (también si lo primero que ve es el VersionError). La
 * interfaz lo usa para avisar.
 * Si el navegador cierra la conexión por su cuenta (db.onclose: se borraron
 * los datos del sitio, falla del disco), se descarta y el próximo uso
 * reabre.
 * @param {{nombre?: string, version?: number, idb?: IDBFactory,
 *   alBloqueo?: () => void, alCambioVersion?: () => void}} [o]
 * @returns {Almacen & {cerrar: () => void}}
 */
export function almacenIndexedDB(o = {}) {
  const nombre = o.nombre || DB2_NOMBRE;
  const version = o.version || DB2_VERSION;
  /** @type {Promise<IDBDatabase> | null} */
  let dbp = null;
  let avisado = false;
  const avisarCambioVersion = () => {
    if (avisado) return;
    avisado = true;
    o.alCambioVersion?.();
  };
  function open() {
    if (!dbp) {
      const p = new Promise((res, rej) => {
        const idb = o.idb || globalThis.indexedDB;
        if (!idb) {
          rej(new ErrorAlmacen('sin-indexeddb', 'sin IndexedDB'));
          return;
        }
        const r = idb.open(nombre, version);
        r.onupgradeneeded = (ev) => {
          const db = r.result;
          const tx = /** @type {IDBTransaction} */ (r.transaction);
          const desde = ev.oldVersion || 0;
          for (let v = desde; v < Math.min(version, MIGRACIONES.length); v++)
            MIGRACIONES[v](db, tx);
        };
        r.onblocked = () => o.alBloqueo?.();
        r.onsuccess = () => {
          const db = r.result;
          db.onversionchange = () => {
            db.close();
            if (dbp === p) dbp = null;
            avisarCambioVersion();
          };
          db.onclose = () => {
            if (dbp === p) dbp = null;
          };
          res(db);
        };
        r.onerror = () => {
          const err = r.error;
          if (err && err.name === 'VersionError') {
            avisarCambioVersion();
            rej(new ErrorAlmacen('version-vieja', String(err.message || err)));
          } else rej(err);
        };
      });
      dbp = p;
      // Sin cachear el rechazo: el próximo uso reintenta.
      p.catch(() => {
        if (dbp === p) dbp = null;
      });
    }
    return dbp;
  }
  /**
   * @param {string} store @param {IDBTransactionMode} mode
   * @param {(s: IDBObjectStore) => IDBRequest | undefined} fn
   */
  function req(store, mode, fn) {
    def(store);
    return open().then(
      (db) =>
        new Promise((res, rej) => {
          const t = db.transaction(store, mode);
          const r = fn(t.objectStore(store));
          t.oncomplete = () => res(r?.result);
          t.onerror = () => rej(t.error);
          t.onabort = () => rej(t.error);
        }),
    );
  }
  /**
   * Operaciones dentro de una transacción ya abierta: cada una es una
   * promesa que se resuelve con el onsuccess de su pedido.
   * @param {IDBTransaction} t @param {Set<string>} permitidos
   * @returns {OperacionesAlmacen}
   */
  function operacionesTx(t, permitidos) {
    /**
     * @param {string} store @param {(s: IDBObjectStore) => IDBRequest} fn
     * @returns {Promise<any>}
     */
    const pedir = (store, fn) =>
      new Promise((res, rej) => {
        def(store);
        if (!permitidos.has(store)) throw new ErrorAlmacen('store-fuera-de-tx', store);
        const r = fn(t.objectStore(store));
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    return {
      get: (store, key) => pedir(store, (s) => s.get(key)),
      put: (store, value) => pedir(store, (s) => s.put(value)),
      delete: (store, key) => pedir(store, (s) => s.delete(key)).then(() => {}),
      list: (store) => pedir(store, (s) => s.getAll()),
      claves: (store) => pedir(store, (s) => s.getAllKeys()),
      porIndice: (store, indice, valor) => {
        if (!def(store).indices?.[indice])
          return Promise.reject(new Error(`${store}: índice desconocido ${indice}`));
        return pedir(store, (s) => s.index(indice).getAll(valor));
      },
    };
  }

  return {
    get: (store, key) => req(store, 'readonly', (s) => s.get(key)),
    put: (store, value) => req(store, 'readwrite', (s) => s.put(value)),
    delete: (store, key) => req(store, 'readwrite', (s) => s.delete(key)).then(() => {}),
    list: (store) => req(store, 'readonly', (s) => s.getAll()),
    claves: (store) => req(store, 'readonly', (s) => s.getAllKeys()),
    porIndice: (store, indice, valor) => {
      if (!def(store).indices?.[indice])
        return Promise.reject(new Error(`${store}: índice desconocido ${indice}`));
      return req(store, 'readonly', (s) => s.index(indice).getAll(valor));
    },
    tx: (stores, fn) => {
      try {
        for (const st of stores) def(st);
      } catch (err) {
        return Promise.reject(err);
      }
      return open().then(
        (db) =>
          new Promise((res, rej) => {
            const t = db.transaction(stores, 'readwrite');
            /** @type {any} */
            let resultado;
            /** @type {unknown} */
            let fallo = null;
            t.oncomplete = () => (fallo ? rej(fallo) : res(resultado));
            t.onabort = () => rej(fallo || t.error || new Error('transacción abortada'));
            t.onerror = () => {};
            Promise.resolve()
              .then(() => fn(operacionesTx(t, new Set(stores))))
              .then(
                (v) => {
                  resultado = v;
                },
                (err) => {
                  fallo = err;
                  try {
                    t.abort();
                  } catch (_e) {
                    /* ya terminó: oncomplete/onabort rechazan con `fallo` */
                  }
                },
              );
          }),
      );
    },
    cerrar: () => {
      const p = dbp;
      dbp = null;
      if (p)
        p.then(
          (db) => db.close(),
          () => {},
        );
    },
  };
}
