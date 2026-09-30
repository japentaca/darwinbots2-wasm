// @ts-check
// Base única darwinbots2 (engine/almacen.js, decisión 17): el almacén en
// memoria (semántica de IndexedDB: copias, autoincremento, índices, tx
// atómica) y la apertura de IndexedDB con un IDBFactory falso: migraciones
// (v2 completa una v1 de desarrollo), reintento tras un fallo, onblocked,
// versionchange («hay que recargar»: VersionError al reabrir), onclose y
// transacciones sobre varios almacenes que se deshacen si fallan. Y que
// torneos-db.js abre por aquí.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  almacenIndexedDB,
  almacenMemoria,
  DB2_NOMBRE,
  DB2_VERSION,
  ErrorAlmacen,
  MIGRACIONES,
  STORES,
} from '../engine/almacen.js';
import * as tdb from '../engine/torneos-db.js';

test('los almacenes del plan, con los de los torneos como antes', () => {
  for (const s of [
    'bots',
    'escenarios',
    'corridas',
    'corridas-datos',
    'informes',
    'torneos',
    'partidos',
    'trabajos',
    'ajustes',
  ])
    assert.ok(STORES[s], s);
  assert.equal(DB2_NOMBRE, 'darwinbots2');
  assert.equal(DB2_VERSION, MIGRACIONES.length);
  assert.deepEqual(STORES.torneos, { keyPath: 'id' });
  assert.equal(STORES.partidos.keyPath, 'id');
  assert.equal(STORES.partidos.autoIncrement, true);
  assert.equal(STORES.partidos.indices?.league, 'league');
  // torneos-db.js re-exporta la apertura común
  assert.equal(tdb.almacenMemoria, almacenMemoria);
  assert.equal(tdb.almacenIndexedDB, almacenIndexedDB);
  assert.equal(tdb.DB2_NOMBRE, DB2_NOMBRE);
  assert.deepEqual(Object.keys(tdb.STORES_TORNEOS), ['torneos', 'partidos']);
});

test('memoria: copias, autoincremento, índices y almacén desconocido', async () => {
  const a = almacenMemoria();
  const m = { league: 'L1', x: 1 };
  const k1 = await a.put('partidos', m);
  const k2 = await a.put('partidos', { league: 'L2' });
  assert.deepEqual([k1, k2], [1, 2]);
  assert.equal(/** @type {any} */ (m).id, undefined, 'el original no recibe el id');
  const g = await a.get('partidos', 1);
  g.x = 99;
  assert.equal((await a.get('partidos', 1)).x, 1, 'get devuelve copias');
  assert.deepEqual(await a.porIndice('partidos', 'league', 'L2'), [{ league: 'L2', id: 2 }]);
  await a.put('partidos', { id: 10, league: 'L1' });
  assert.equal(await a.put('partidos', { league: 'L3' }), 11);
  await a.delete('partidos', 10);
  assert.equal((await a.list('partidos')).length, 3);
  await assert.rejects(a.put('torneos', { nombre: 'sin id' }));
  await assert.rejects(a.get('nada', 1));
  await assert.rejects(a.porIndice('torneos', 'nada', 1));
  await a.put('ajustes', { clave: 'idioma', valor: 'es' });
  assert.equal((await a.get('ajustes', 'idioma')).valor, 'es');
  assert.equal(await a.get('ajustes', 'otra'), undefined);
});

test('memoria: claves y tx atómica (deshace si fn falla; solo sus almacenes)', async () => {
  const a = almacenMemoria();
  await a.put('corridas', { id: 'c1', n: 1 });
  await a.put('partidos', { league: 'L' });
  assert.deepEqual(await a.claves('corridas'), ['c1']);
  // ok: devuelve lo de fn y deja todo
  const r = await a.tx(['corridas', 'corridas-datos'], async (t) => {
    await t.put('corridas', { id: 'c2', n: 2 });
    await t.put('corridas-datos', { id: 'c2', dbsim: 1 });
    return (await t.claves('corridas')).length;
  });
  assert.equal(r, 2);
  assert.deepEqual((await a.claves('corridas-datos')).sort(), ['c2']);
  // falla a mitad: no queda nada (ni el autoincremento)
  await assert.rejects(
    a.tx(['corridas', 'partidos'], async (t) => {
      await t.delete('corridas', 'c1');
      await t.put('partidos', { league: 'M' });
      throw new Error('a mitad');
    }),
    /a mitad/,
  );
  assert.deepEqual((await a.claves('corridas')).sort(), ['c1', 'c2']);
  assert.equal(await a.put('partidos', { league: 'N' }), 2, 'el autoincremento volvió atrás');
  // un almacén que no pidió la tx
  await assert.rejects(
    a.tx(['corridas'], (t) => t.list('partidos')),
    (/** @type {any} */ e) => e instanceof ErrorAlmacen && e.codigo === 'store-fuera-de-tx',
  );
  await assert.rejects(a.tx(['nada'], () => 1));
});

// ---- IDBFactory falso -------------------------------------------------------
// Lo justo para almacen.js, con el comportamiento del real que importa:
//  - open: upgrade/success/error/blocked; abrir con una versión MENOR que la
//    de la base falla con VersionError; abrir una más nueva avisa
//    versionchange a las conexiones abiertas.
//  - transacciones sobre uno o varios almacenes: cada request resuelve en
//    diferido (onsuccess), la transacción queda activa mientras haya
//    requests pendientes y completa cuando queda ociosa; abort (o un fn que
//    lanza) deshace lo que hizo.
//  - requests get/put/delete/getAll/getAllKeys/index().getAll.
//  - db.onclose: el navegador cerró la conexión por su cuenta (cerrarTodo).

function idbFalso() {
  /** @type {Map<string, {version: number, stores: Map<string, any>, conexiones: any[]}>} */
  const bases = new Map();
  const log = { aperturas: 0, fallar: 0, bloquear: false };
  /** @param {string} nombre */
  const base = (nombre) => {
    let b = bases.get(nombre);
    if (!b) {
      b = { version: 0, stores: new Map(), conexiones: [] };
      bases.set(nombre, b);
    }
    return b;
  };
  /** @param {any} v */
  const nuevoStore = (v) => ({ ...v, datos: new Map(), seq: 0, indices: new Map() });
  /** @param {any} b */
  function conexion(b) {
    const names = () => ({ contains: (/** @type {string} */ n) => b.stores.has(n) });
    const db = {
      onversionchange: /** @type {any} */ (null),
      onclose: /** @type {any} */ (null),
      cerrada: false,
      get objectStoreNames() {
        return names();
      },
      close() {
        db.cerrada = true;
      },
      createObjectStore(/** @type {string} */ n, /** @type {any} */ o) {
        if (b.stores.has(n)) throw new Error(`ConstraintError: ${n} ya existe`);
        const s = nuevoStore(o);
        b.stores.set(n, s);
        return vistaStore(s, null);
      },
      transaction(/** @type {string | string[]} */ n) {
        if (db.cerrada) throw new Error('InvalidStateError: conexión cerrada');
        const nombres = Array.isArray(n) ? n : [n];
        const foto = new Map(
          nombres.map((x) => {
            const s = b.stores.get(x);
            if (!s) throw new Error(`NotFoundError: ${x}`);
            return [x, { datos: new Map(s.datos), seq: s.seq }];
          }),
        );
        const t = {
          oncomplete: /** @type {any} */ (null),
          onerror: /** @type {any} */ (null),
          onabort: /** @type {any} */ (null),
          error: /** @type {any} */ (null),
          pendientes: 0,
          terminada: false,
          objectStore: (/** @type {string} */ x) => {
            if (!foto.has(x)) throw new Error(`NotFoundError: ${x} fuera de la transacción`);
            if (t.terminada) throw new Error('TransactionInactiveError');
            return vistaStore(b.stores.get(x), t);
          },
          abort() {
            if (t.terminada) throw new Error('InvalidStateError: ya terminó');
            t.terminada = true;
            for (const [x, f] of foto) {
              const s = b.stores.get(x);
              s.datos = f.datos;
              s.seq = f.seq;
            }
            setTimeout(() => t.onabort?.());
          },
        };
        // Completa cuando queda ociosa (sin requests pendientes al volver al
        // bucle de eventos), como el real.
        t.revisar = () =>
          setTimeout(() => {
            if (t.terminada || t.pendientes > 0) return;
            t.terminada = true;
            t.oncomplete?.();
          });
        t.revisar();
        return t;
      },
    };
    return db;
  }
  /** @param {any} s @param {any} t */
  function vistaStore(s, t) {
    /** @param {() => any} f */
    const req = (f) => {
      const r = { result: /** @type {any} */ (undefined), onsuccess: /** @type {any} */ (null) };
      if (t) t.pendientes++;
      setTimeout(() => {
        r.result = f();
        if (t) t.pendientes--;
        r.onsuccess?.();
        t?.revisar();
      });
      return r;
    };
    return {
      indexNames: { contains: (/** @type {string} */ i) => s.indices.has(i) },
      createIndex: (/** @type {string} */ i, /** @type {string} */ kp) => s.indices.set(i, kp),
      get: (/** @type {any} */ k) => req(() => structuredClone(s.datos.get(k))),
      put: (/** @type {any} */ v) => {
        const c = structuredClone(v);
        return req(() => {
          let k = c[s.keyPath];
          if (k === undefined && s.autoIncrement) k = c[s.keyPath] = ++s.seq;
          s.datos.set(k, c);
          return k;
        });
      },
      delete: (/** @type {any} */ k) => req(() => void s.datos.delete(k)),
      getAll: () => req(() => [...s.datos.values()].map((v) => structuredClone(v))),
      getAllKeys: () => req(() => [...s.datos.keys()]),
      index: (/** @type {string} */ i) => ({
        getAll: (/** @type {any} */ v) =>
          req(() =>
            [...s.datos.values()]
              .filter((x) => x[s.indices.get(i)] === v)
              .map((x) => structuredClone(x)),
          ),
      }),
    };
  }
  const factory = {
    open(/** @type {string} */ nombre, /** @type {number} */ version) {
      log.aperturas++;
      const r = {
        result: /** @type {any} */ (null),
        transaction: /** @type {any} */ (null),
        error: /** @type {any} */ (null),
        onupgradeneeded: /** @type {any} */ (null),
        onsuccess: /** @type {any} */ (null),
        onerror: /** @type {any} */ (null),
        onblocked: /** @type {any} */ (null),
      };
      queueMicrotask(() => {
        if (log.fallar > 0) {
          log.fallar--;
          r.error = new Error('falla simulada');
          r.onerror?.();
          return;
        }
        const b = base(nombre);
        if (version < b.version) {
          const e = new Error(
            `The requested version (${version}) is less than the existing version (${b.version}).`,
          );
          e.name = 'VersionError';
          r.error = e;
          r.onerror?.();
          return;
        }
        if (log.bloquear) r.onblocked?.();
        const db = conexion(b);
        if (version > b.version) {
          for (const c of b.conexiones) if (!c.cerrada) c.onversionchange?.();
          const vieja = b.version;
          b.version = version;
          r.result = db;
          r.transaction = {
            objectStore: (/** @type {string} */ n) => vistaStore(b.stores.get(n), null),
          };
          r.onupgradeneeded?.({ oldVersion: vieja, newVersion: version });
        }
        r.result = db;
        b.conexiones.push(db);
        r.onsuccess?.();
      });
      return r;
    },
  };
  /** El navegador cierra todas las conexiones por su cuenta (onclose). @param {string} nombre */
  const cerrarTodo = (nombre) => {
    for (const c of base(nombre).conexiones)
      if (!c.cerrada) {
        c.cerrada = true;
        c.onclose?.();
      }
  };
  return { factory, bases, log, cerrarTodo, nuevoStore };
}

test('IndexedDB: no abre nada al crear; la primera vez migra todo', async () => {
  const f = idbFalso();
  const a = almacenIndexedDB({ idb: /** @type {any} */ (f.factory) });
  assert.equal(f.log.aperturas, 0);
  assert.equal(await a.put('partidos', { league: 'L', n: 1 }), 1);
  assert.equal(f.log.aperturas, 1);
  const b = /** @type {any} */ (f.bases.get('darwinbots2'));
  assert.equal(b.version, DB2_VERSION);
  assert.equal(DB2_VERSION, 2);
  assert.deepEqual([...b.stores.keys()].sort(), Object.keys(STORES).sort());
  for (const [n, d] of Object.entries(STORES)) {
    const s = b.stores.get(n);
    assert.equal(s.keyPath, d.keyPath, n);
    assert.deepEqual(Object.fromEntries(s.indices), d.indices || {}, n);
  }
  assert.deepEqual(await a.porIndice('partidos', 'league', 'L'), [{ league: 'L', n: 1, id: 1 }]);
  assert.deepEqual(await a.list('partidos'), [{ league: 'L', n: 1, id: 1 }]);
  assert.deepEqual(await a.claves('partidos'), [1]);
  await a.delete('partidos', 1);
  assert.deepEqual(await a.list('partidos'), []);
  assert.equal(f.log.aperturas, 1, 'una sola apertura');
  await assert.rejects(a.porIndice('partidos', 'nada', 1));
});

test('IndexedDB: v1 de desarrollo con menos almacenes → v2 la completa sin perder datos', async () => {
  const f = idbFalso();
  // una v1 vieja: solo 'torneos' (sin índices) con un dato, y 'partidos' sin su índice
  const b = {
    version: 1,
    stores: new Map([
      ['torneos', f.nuevoStore({ keyPath: 'id' })],
      ['partidos', f.nuevoStore({ keyPath: 'id', autoIncrement: true })],
    ]),
    conexiones: [],
  };
  b.stores.get('torneos').datos.set('t1', { id: 't1', name: 'viejo' });
  f.bases.set('darwinbots2', b);
  const a = almacenIndexedDB({ idb: /** @type {any} */ (f.factory) });
  assert.deepEqual(await a.get('torneos', 't1'), { id: 't1', name: 'viejo' });
  assert.equal(b.version, 2);
  assert.deepEqual([...b.stores.keys()].sort(), Object.keys(STORES).sort());
  assert.equal(b.stores.get('partidos').indices.get('league'), 'league');
  // idempotente: una base completa en v1 pasa a v2 sin cambios ni errores
  // (el falso, como el real, no deja crear dos veces un almacén)
  const v1 = almacenIndexedDB({ idb: /** @type {any} */ (f.factory), nombre: 'otra', version: 1 });
  await v1.put('ajustes', { clave: 'k', valor: 1 });
  v1.cerrar();
  const otra = /** @type {any} */ (f.bases.get('otra'));
  const foto = () => [...otra.stores].map(([n, st]) => [n, st.keyPath, [...st.indices]]).sort();
  const antes = JSON.stringify(foto());
  const v2 = almacenIndexedDB({ idb: /** @type {any} */ (f.factory), nombre: 'otra' });
  assert.equal((await v2.get('ajustes', 'k')).valor, 1);
  assert.equal(otra.version, 2);
  assert.equal(JSON.stringify(foto()), antes);
  v2.cerrar();
  a.cerrar();
});

test('IndexedDB: si la apertura falla, el próximo uso reintenta', async () => {
  const f = idbFalso();
  f.log.fallar = 1;
  const a = almacenIndexedDB({ idb: /** @type {any} */ (f.factory) });
  await assert.rejects(a.list('torneos'), /falla simulada/);
  assert.deepEqual(await a.list('torneos'), []);
  assert.equal(f.log.aperturas, 2);
  // sin IndexedDB: rechaza, sin romper
  const sin = almacenIndexedDB({ idb: /** @type {any} */ (undefined) });
  if (!globalThis.indexedDB)
    await assert.rejects(
      sin.list('torneos'),
      (/** @type {any} */ e) => e instanceof ErrorAlmacen && e.codigo === 'sin-indexeddb',
    );
});

test('IndexedDB: versionchange → hay que recargar (VersionError al reabrir, aviso una vez)', async () => {
  const f = idbFalso();
  let bloqueos = 0;
  let cambios = 0;
  const a = almacenIndexedDB({
    idb: /** @type {any} */ (f.factory),
    alBloqueo: () => bloqueos++,
    alCambioVersion: () => cambios++,
  });
  await a.put('torneos', { id: 't1' });
  const b = /** @type {any} */ (f.bases.get('darwinbots2'));
  const primera = b.conexiones[0];
  // otra pestaña (código nuevo) abre una versión más nueva
  f.log.bloquear = true;
  const otra = almacenIndexedDB({ idb: /** @type {any} */ (f.factory), version: DB2_VERSION + 1 });
  await otra.list('torneos');
  assert.equal(primera.cerrada, true, 'db.close() en onversionchange');
  assert.equal(cambios, 1);
  assert.equal(bloqueos, 0, 'el alBloqueo es del que abre, no de esta');
  f.log.bloquear = false;
  // reabrir con la versión vieja: VersionError → ErrorAlmacen('version-vieja'), sin otro aviso
  const esVieja = (/** @type {any} */ e) =>
    e instanceof ErrorAlmacen && e.codigo === 'version-vieja';
  await assert.rejects(a.get('torneos', 't1'), esVieja);
  await assert.rejects(
    a.tx(['torneos'], (t) => t.get('torneos', 't1')),
    esVieja,
  );
  assert.equal(cambios, 1, 'el aviso sale una sola vez');
  // una pestaña que arranca con el código viejo: el primer uso ya avisa
  let tarde = 0;
  const vieja = almacenIndexedDB({
    idb: /** @type {any} */ (f.factory),
    alCambioVersion: () => tarde++,
  });
  await assert.rejects(vieja.list('torneos'), esVieja);
  await assert.rejects(vieja.list('torneos'), esVieja);
  assert.equal(tarde, 1);
  // onblocked
  f.log.bloquear = true;
  const c = almacenIndexedDB({
    idb: /** @type {any} */ (f.factory),
    version: DB2_VERSION + 1,
    alBloqueo: () => bloqueos++,
  });
  await c.list('torneos');
  assert.equal(bloqueos, 1);
  otra.cerrar();
  c.cerrar();
});

test('IndexedDB: si el navegador cierra la conexión (onclose), el próximo uso reabre', async () => {
  const f = idbFalso();
  const a = almacenIndexedDB({ idb: /** @type {any} */ (f.factory) });
  await a.put('ajustes', { clave: 'x', valor: 1 });
  f.cerrarTodo('darwinbots2');
  assert.equal((await a.get('ajustes', 'x')).valor, 1);
  assert.equal(f.log.aperturas, 2);
  a.cerrar();
});

test('IndexedDB: tx sobre varios almacenes es atómica', async () => {
  const f = idbFalso();
  const a = almacenIndexedDB({ idb: /** @type {any} */ (f.factory) });
  await a.put('torneos', { id: 'T' });
  for (let i = 0; i < 3; i++) await a.put('partidos', { league: i < 2 ? 'T' : 'U' });
  // ok: varias operaciones encadenadas con await dentro de la misma tx
  const n = await a.tx(['torneos', 'partidos'], async (t) => {
    await t.delete('torneos', 'T');
    const ps = await t.porIndice('partidos', 'league', 'T');
    for (const p of ps) await t.delete('partidos', p.id);
    return ps.length;
  });
  assert.equal(n, 2);
  assert.deepEqual(await a.claves('torneos'), []);
  assert.deepEqual(await a.claves('partidos'), [3]);
  // falla a mitad: se deshace todo
  await a.put('torneos', { id: 'V' });
  await assert.rejects(
    a.tx(['torneos', 'partidos'], async (t) => {
      await t.delete('torneos', 'V');
      await t.put('partidos', { league: 'V' });
      throw new Error('a mitad');
    }),
    /a mitad/,
  );
  assert.deepEqual(await a.claves('torneos'), ['V']);
  assert.deepEqual(await a.claves('partidos'), [3]);
  // un almacén fuera de la tx
  await assert.rejects(
    a.tx(['torneos'], (t) => t.list('partidos')),
    (/** @type {any} */ e) => e instanceof ErrorAlmacen && e.codigo === 'store-fuera-de-tx',
  );
  a.cerrar();
});
