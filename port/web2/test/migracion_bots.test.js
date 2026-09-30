// @ts-check
// Migración del inventario de la clásica (darwinbots-inventario) a
// darwinbots2 e import/export de la biblioteca (paso N3.1, decisión 17):
// transformación pura de un inventario viejo armado a mano, lectura de la
// base vieja con un IDBFactory falso (sin modificarla ni crearla), una sola
// vez (marca en 'ajustes'), fusión con lo que ya había, export → import y el
// JSON del Export de inventory.js.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { componerHibrido, hashAdn } from '../engine/adn.js';
import { almacenMemoria } from '../engine/almacen.js';
import { construirIndice } from '../engine/biblioteca.js';
import { crearBots, ErrorBots } from '../engine/bots.js';
import {
  CLAVE_MIGRACION_INVENTARIO,
  exportarBiblioteca,
  importarBiblioteca,
  leerBaseVieja,
  migrarInventario,
  migrarUnaVez,
  transformarInventario,
} from '../engine/migracion.js';
import { WEB } from './util/dbcore-node.js';

const BOTS = path.join(WEB, 'bots');
/** @param {string} f */
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(BOTS, f), 'utf8'));
const bestiario = leerJson('bots.json');
const perfiles = leerJson('profiles.json');
const genes = leerJson('genes.json');
const ctx = { perfiles, genes, bestiario, reloj: () => new Date('2026-06-01T00:00:00Z') };

/** @param {string} codigo */
const conCodigo = (codigo) => (/** @type {any} */ e) =>
  e instanceof ErrorBots && e.codigo === codigo;

const H = (/** @type {number} */ i) => perfiles.bots[bestiario[i].file].hash;
const F = (/** @type {number} */ i) => bestiario[i].file;

// Un inventario de la clásica armado a mano, con el formato exacto de
// inventory.js (store 'bots', keyPath 'key') y lab.js (store 'hybrids').
function inventarioViejo() {
  return {
    bots: [
      {
        key: H(0),
        tags: ['caza', 'favorito-viejo'],
        fav: true,
        notes: 'el mejor',
        name: bestiario[0].name,
        file: F(0),
      },
      { key: H(1), tags: [], fav: false, notes: 'solo nota', name: bestiario[1].name, file: F(1) },
      // clave sin perfil ('file:'): pasa al hash de profiles.json
      { key: `file:${F(2)}`, tags: ['alga'], fav: false, notes: '' },
      // bot que ya no está en el Bestiary: se guarda igual (huérfana)
      {
        key: '0123456789abcdef',
        tags: ['viejo'],
        fav: true,
        notes: '',
        name: 'Ya no está',
        file: 'borrado.txt',
      },
      { tags: ['sin clave'] },
    ],
    sets: [
      { name: 'Mis cazadores', keys: [H(0), `file:${F(2)}`, H(0)] },
      { name: 'Otra', keys: [H(1)] },
      { keys: [] },
    ],
    hybrids: [
      {
        name: 'Híbrido 1',
        veg: false,
        remap: true,
        parts: [
          { file: '1.txt', gi: 0 },
          { file: '1.txt', gi: 3 },
          { file: F(10), gi: 0 },
        ],
        updated: '2026-02-03T10:00:00.000Z',
      },
      {
        name: 'Con faltantes',
        veg: true,
        parts: [
          { file: '1.txt', gi: 1 },
          { file: 'no-existe.txt', gi: 0 },
        ],
        updated: '2026-02-04T00:00:00.000Z',
      },
      { name: 'Vacío', parts: [{ file: 'no-existe.txt', gi: 0 }] },
    ],
  };
}

// ---- IDBFactory falso de la base vieja ------------------------------------------------
// Bases {nombre → {version, stores: {nombre → filas[]}}}. open(nombre) sin
// versión: si la base no existe dispara upgradeneeded; si ahí se aborta,
// onerror (AbortError) y la base no queda creada. Solo transacciones
// 'readonly' (se registran los modos para verificar que no se escribe).

/** @param {Record<string, {version: number, stores: Record<string, any[]>}>} bases @param {{conLista?: boolean}} [o] */
function idbViejo(bases, o = {}) {
  const log = {
    modos: /** @type {string[]} */ ([]),
    aperturas: 0,
    cierres: 0,
    versiones: /** @type {any[]} */ ([]),
  };
  /** @param {{version: number, stores: Record<string, any[]>}} b */
  const conexion = (b) => ({
    version: b.version,
    objectStoreNames: { contains: (/** @type {string} */ n) => n in b.stores },
    transaction(/** @type {string[]} */ nombres, /** @type {string} */ modo) {
      log.modos.push(modo);
      let pendientes = 0;
      /** @type {any} */
      const t = {
        objectStore(/** @type {string} */ n) {
          assert.ok(nombres.includes(n));
          return {
            getAll() {
              pendientes++;
              /** @type {any} */
              const q = {};
              queueMicrotask(() => {
                q.result = structuredClone(b.stores[n]);
                q.onsuccess?.();
                if (--pendientes === 0) queueMicrotask(() => t.oncomplete?.());
              });
              return q;
            },
          };
        },
      };
      return t;
    },
    close() {
      log.cierres++;
    },
  });
  const factory = {
    open(/** @type {string} */ nombre, /** @type {number | undefined} */ version) {
      log.aperturas++;
      log.versiones.push(version);
      /** @type {any} */
      const r = {};
      queueMicrotask(() => {
        const b = bases[nombre];
        if (!b) {
          const nueva = { version: 1, stores: {} };
          let abortada = false;
          r.transaction = {
            abort() {
              abortada = true;
            },
          };
          r.result = conexion(nueva);
          r.onupgradeneeded?.({ oldVersion: 0, newVersion: 1 });
          if (abortada) {
            r.error = { name: 'AbortError', message: 'abortada' };
            r.onerror?.({ preventDefault() {} });
            return;
          }
          bases[nombre] = nueva;
          r.onsuccess?.();
          return;
        }
        r.result = conexion(b);
        r.onsuccess?.();
      });
      return r;
    },
    ...(o.conLista
      ? {
          databases: async () =>
            Object.entries(bases).map(([name, b]) => ({ name, version: b.version })),
        }
      : {}),
  };
  return { factory: /** @type {any} */ (factory), log, bases };
}

// ---- Transformación pura -----------------------------------------------------------------

test('transformarInventario: marcas, claves file:, selecciones e híbridos', () => {
  const { datos, resumen } = transformarInventario(inventarioViejo(), ctx);
  const porHash = new Map(datos.marcas.map((m) => [m.hash, m]));
  assert.deepEqual(porHash.get(H(0)), {
    hash: H(0),
    fav: true,
    tags: ['caza', 'favorito-viejo'],
    notas: 'el mejor',
    nombre: bestiario[0].name,
    archivo: F(0),
  });
  assert.deepEqual(porHash.get(H(2)), { hash: H(2), fav: false, tags: ['alga'], notas: '' });
  assert.ok(porHash.has('0123456789abcdef'));
  assert.deepEqual(datos.selecciones, [
    { nombre: 'Mis cazadores', claves: [H(0), H(2)] },
    { nombre: 'Otra', claves: [H(1)] },
  ]);
  const [h1, h2] = datos.propios;
  assert.equal(datos.propios.length, 2);
  const nombreDe = new Map(bestiario.map((/** @type {any} */ b) => [b.file, b.name]));
  const c1 = componerHibrido(inventarioViejo().hybrids[0], {
    genes,
    nombreDe: (f) => nombreDe.get(f),
  });
  assert.equal(h1.nombre, 'Híbrido 1');
  assert.equal(h1.adn, c1.adn);
  assert.equal(h1.hash, hashAdn(c1.adn));
  assert.equal(h1.creado, '2026-02-03T10:00:00.000Z');
  assert.deepEqual(h1.origen, { tipo: 'hibrido' });
  assert.deepEqual(h1.versiones[0].origenes, [
    { archivo: '1.txt', gen: 0 },
    { archivo: '1.txt', gen: 3 },
    { archivo: F(10), gen: 0 },
  ]);
  assert.match(h1.adn, /Built in the Hybrid lab \(2026-02-03\)/);
  assert.equal(h2.vegetal, true);
  assert.equal(h2.versiones[0].origenes?.length, 1);
  assert.deepEqual(resumen, {
    marcas: 4,
    favoritos: 2,
    conTags: 3,
    conNotas: 2,
    huerfanas: 1,
    selecciones: 2,
    hibridos: 2,
    hibridosIncompletos: [{ nombre: 'Con faltantes', faltan: 1 }],
    hibridosDescartados: [{ nombre: 'Vacío', motivo: 'vacio' }],
    invalidos: 2,
  });
  // sin genes.json no se pueden armar los híbridos
  const sin = transformarInventario(inventarioViejo(), { perfiles });
  assert.equal(sin.datos.propios.length, 0);
  assert.deepEqual(
    sin.resumen.hibridosDescartados.map((x) => x.motivo),
    ['sin-genes', 'sin-genes', 'sin-genes'],
  );
});

// ---- Lectura de la base vieja ---------------------------------------------------------

test('leerBaseVieja: lee sin versión ni escritura; si no existe, no la crea', async () => {
  for (const conLista of [false, true]) {
    const inv = inventarioViejo();
    const f = idbViejo(
      { 'darwinbots-inventario': { version: 2, stores: { bots: inv.bots, sets: inv.sets } } },
      { conLista },
    );
    const l = await leerBaseVieja({
      idb: f.factory,
      nombre: 'darwinbots-inventario',
      stores: ['bots', 'sets', 'hybrids'],
    });
    assert.ok(l);
    assert.equal(l.version, 2);
    assert.deepEqual(l.stores.bots, inv.bots);
    assert.deepEqual(l.stores.sets, inv.sets);
    assert.deepEqual(l.stores.hybrids, [], 'el store que falta vuelve vacío');
    assert.deepEqual(f.log.modos, ['readonly']);
    assert.deepEqual(f.log.versiones, [undefined], 'se abre sin versión: no hay upgrade');
    assert.equal(f.log.cierres, 1);
    const no = await leerBaseVieja({
      idb: f.factory,
      nombre: 'darwinbots-ligas',
      stores: ['leagues'],
    });
    assert.equal(no, null);
    assert.equal('darwinbots-ligas' in f.bases, false, 'la base que no existía no queda creada');
  }
  assert.equal(await leerBaseVieja({ idb: null, nombre: 'x', stores: [] }), null);
});

// ---- Migración una sola vez --------------------------------------------------------------

test('migrarInventario: copia una vez, avisa qué importó y no toca la clásica', async () => {
  const inv = inventarioViejo();
  const bases = { 'darwinbots-inventario': { version: 2, stores: structuredClone(inv) } };
  const foto = JSON.stringify(bases);
  const f = idbViejo(bases);
  const almacen = almacenMemoria();
  const bots = crearBots({ almacen });
  // lo que ya había en la nueva: una nota propia y una selección con el mismo nombre
  await bots.notas(H(0), 'nota nueva');
  await bots.guardarSeleccion('Otra', ['ffffffffffffffff']);

  const r = await migrarInventario(almacen, { ...ctx, idb: f.factory });
  assert.equal(r.nueva, true);
  assert.equal(r.resumen.existia, true);
  assert.equal(r.resumen.version, 2);
  assert.equal(r.resumen.marcas, 4);
  assert.equal(r.resumen.hibridos, 2);
  assert.equal(r.resumen.propiosEscritos, 2);
  assert.equal(r.resumen.seleccionesEscritas, 1);
  assert.equal(r.resumen.seleccionesOmitidas, 1);
  assert.equal(JSON.stringify(bases), foto, 'la base de la clásica no cambió');
  assert.deepEqual(f.log.modos, ['readonly']);

  const m0 = await bots.obtener(H(0));
  assert.deepEqual(
    [m0?.fav, m0?.tags, m0?.notas],
    [true, ['caza', 'favorito-viejo'], 'nota nueva'],
    'la migración no pisa las notas de la nueva',
  );
  assert.deepEqual(await bots.selecciones(), [
    { nombre: 'Mis cazadores', claves: [H(0), H(2)] },
    { nombre: 'Otra', claves: ['ffffffffffffffff'] },
  ]);
  const propios = await bots.propios();
  assert.deepEqual(
    propios.map((p) => [p.nombre, p.origen.tipo, p.versiones.length]),
    [
      ['Con faltantes', 'hibrido', 1],
      ['Híbrido 1', 'hibrido', 1],
    ],
  );
  const marca = await almacen.get('ajustes', CLAVE_MIGRACION_INVENTARIO);
  assert.equal(marca.fecha, '2026-06-01T00:00:00.000Z');

  // el índice ve las marcas migradas con el hash de la clásica
  const idx = construirIndice({ bestiario, perfiles, registros: await bots.todos() });
  assert.equal(idx.find((e) => e.archivo === F(2))?.marcas.tags[0], 'alga');

  // segunda vez: no lee ni escribe nada, devuelve el resumen de entonces
  await bots.favorito([H(0)], false);
  const r2 = await migrarInventario(almacen, { ...ctx, idb: f.factory });
  assert.equal(r2.nueva, false);
  assert.deepEqual(r2.resumen, r.resumen);
  assert.equal(f.log.aperturas, 1);
  assert.equal((await bots.obtener(H(0)))?.fav, false);
});

test('migrarInventario: sin base vieja marca la migración como hecha', async () => {
  const f = idbViejo({});
  const almacen = almacenMemoria();
  const r = await migrarInventario(almacen, { ...ctx, idb: f.factory });
  assert.deepEqual(r, { nueva: true, resumen: { existia: false } });
  assert.deepEqual(f.bases, {});
  assert.deepEqual(await almacen.list('bots'), []);
  assert.equal((await migrarInventario(almacen, { ...ctx, idb: f.factory })).nueva, false);
});

test('migrarUnaVez: dos pestañas a la vez aplican una sola; un fallo no deja la marca', async () => {
  const almacen = almacenMemoria();
  let aplicadas = 0;
  const o = {
    clave: 'migracion.prueba',
    stores: ['bots'],
    leer: async () => ({ version: 1, stores: {} }),
    aplicar: async () => ({ n: ++aplicadas }),
  };
  const [a, b] = await Promise.all([migrarUnaVez(almacen, o), migrarUnaVez(almacen, o)]);
  assert.equal(aplicadas, 1);
  assert.deepEqual([a.nueva, b.nueva].sort(), [false, true]);
  assert.deepEqual(b.resumen, { n: 1 });
  await assert.rejects(
    migrarUnaVez(almacen, {
      ...o,
      clave: 'migracion.falla',
      aplicar: async (t) => {
        await t.put('bots', { hash: 'x', clase: 'foro', fav: true, tags: [], notas: '' });
        throw new Error('falla');
      },
    }),
  );
  assert.equal(await almacen.get('ajustes', 'migracion.falla'), undefined);
  assert.equal(await almacen.get('bots', 'x'), undefined, 'la transacción se deshizo');
});

// ---- Import / export ---------------------------------------------------------------------

test('export → import en otra base da la misma biblioteca', async () => {
  const a = almacenMemoria();
  const bots = crearBots({ almacen: a, reloj: () => new Date('2026-06-02T00:00:00Z') });
  const b1 = await bots.crear({
    nombre: 'Uno',
    adn: 'cond start 1 .up store stop',
    vegetal: true,
    descripcion: 'd',
  });
  await bots.guardarVersion(b1.hash, 'cond start 2 .up store stop', {
    nota: 'v2',
    origenes: [{ archivo: '1.txt', gen: 0 }],
  });
  await bots.agregarTag([b1.hash, H(3)], 'mio');
  await bots.guardarSeleccion('S', [b1.hash, H(3)]);
  const exp = await exportarBiblioteca(a, { reloj: () => new Date('2026-06-03T00:00:00Z') });
  assert.equal(exp.formato, 'darwinbots2-biblioteca');
  assert.equal(exp.version, 1);
  assert.equal(exp.exportado, '2026-06-03T00:00:00.000Z');
  assert.equal(exp.bots.length, 1);
  assert.equal(exp.marcas.length, 1);

  const b = almacenMemoria();
  const r = await importarBiblioteca(b, JSON.stringify(exp), ctx);
  assert.deepEqual(r, {
    formato: 'darwinbots2',
    bots: 1,
    marcas: 1,
    selecciones: 1,
    invalidos: 0,
    marcasEscritas: 1,
    seleccionesEscritas: 1,
    seleccionesOmitidas: 0,
    propiosEscritos: 1,
    yaEstaban: 0,
    renombrados: 0,
  });
  assert.deepEqual(
    await exportarBiblioteca(b, { reloj: () => new Date('2026-06-03T00:00:00Z') }),
    exp,
  );
  // importar dos veces: el bot ya está (no se duplica)
  const r2 = await importarBiblioteca(b, exp, ctx);
  assert.equal(r2.yaEstaban, 1);
  assert.equal((await crearBots({ almacen: b }).propios()).length, 1);
  // un bot con el mismo nombre y otro ADN entra con un nombre libre
  const otro = structuredClone(exp);
  otro.bots[0].versiones = [{ adn: 'cond start 3 .up store stop' }];
  const r3 = await importarBiblioteca(b, otro, ctx);
  assert.equal(r3.renombrados, 1);
  assert.deepEqual(
    (await crearBots({ almacen: b }).propios()).map((p) => p.nombre),
    ['Uno', 'Uno 2'],
  );
});

test('import del Export del inventario de la clásica (invExport) con su fusión', async () => {
  const almacen = almacenMemoria();
  const bots = crearBots({ almacen });
  await bots.notas(H(0), 'nota de antes');
  await bots.agregarTag([H(0)], 'antes');
  await bots.guardarSeleccion('Otra', ['ffffffffffffffff']);
  const inv = inventarioViejo();
  // lo que escribe inventory.js invExport
  const doc = {
    format: 'darwinbots-inventario',
    version: 1,
    exported: '2026-01-01T00:00:00.000Z',
    bots: inv.bots,
    sets: inv.sets,
  };
  const r = await importarBiblioteca(almacen, JSON.stringify(doc, null, 1), ctx);
  assert.equal(r.formato, 'clasica');
  assert.equal(r.marcas, 4);
  assert.equal(r.selecciones, 2);
  assert.equal(r.invalidos, 2);
  const m0 = await bots.obtener(H(0));
  // como invImport: tags unidos, favorito, y las notas del archivo si trae
  assert.deepEqual(
    [m0?.fav, m0?.tags, m0?.notas],
    [true, ['antes', 'caza', 'favorito-viejo'], 'el mejor'],
  );
  // las selecciones se pisan
  assert.deepEqual((await bots.selecciones()).find((s) => s.nombre === 'Otra')?.claves, [H(1)]);
});

test('import: errores de formato con código y registros inválidos salteados', async () => {
  const almacen = almacenMemoria();
  await assert.rejects(importarBiblioteca(almacen, '{no es json'), conCodigo('json-invalido'));
  await assert.rejects(importarBiblioteca(almacen, '[]'), conCodigo('formato-desconocido'));
  await assert.rejects(importarBiblioteca(almacen, '"texto"'), conCodigo('formato-desconocido'));
  await assert.rejects(
    importarBiblioteca(almacen, { formato: 'darwinbots2-biblioteca', version: 2 }),
    (/** @type {any} */ e) => e.codigo === 'version-nueva' && e.params.version === 2,
  );
  await assert.rejects(
    importarBiblioteca(almacen, { format: 'darwinbots-inventario', version: 3 }),
    conCodigo('version-nueva'),
  );
  await assert.rejects(
    importarBiblioteca(almacen, { kind: 'darwinbots-league' }),
    conCodigo('formato-desconocido'),
  );
  const r = await importarBiblioteca(almacen, {
    formato: 'darwinbots2-biblioteca',
    version: 1,
    bots: [
      null,
      { nombre: '', versiones: [{ adn: 'x' }] },
      { nombre: 'Sin versiones', versiones: [] },
      { nombre: 'ADN vacío', versiones: [{ adn: '  ' }] },
      // hashes falsos en el archivo: se recalculan
      {
        nombre: 'Bueno',
        hash: 'mentira',
        versiones: [{ adn: 'cond start 1 .up store stop', hash: 'x', lg: 'y' }],
      },
    ],
    marcas: [{ hash: '' }, { hash: H(0), tags: ['#A b', 3], fav: 1 }],
    selecciones: [
      { nombre: 'S', claves: 'no' },
      { nombre: ' T ', claves: [H(0)] },
    ],
  });
  assert.equal(r.invalidos, 6);
  assert.equal(r.bots, 1);
  const [b] = await crearBots({ almacen }).propios();
  assert.equal(b.hash, hashAdn('cond start 1 .up store stop'));
  assert.equal(b.versiones[0].hash, b.hash);
  assert.equal(b.origen.tipo, 'importado');
  assert.deepEqual((await almacen.get('bots', H(0))).tags, ['3', 'a-b']);
  assert.deepEqual(await crearBots({ almacen }).selecciones(), [{ nombre: 'T', claves: [H(0)] }]);
});
