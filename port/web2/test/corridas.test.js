// @ts-check
// Corridas guardadas (engine/corridas.js, decisiones 8 y 12) sobre el
// almacén en memoria: guardar/listar/cargar/borrar, eventos en caliente y
// la política de las últimas 20 más las marcadas (sin podar la recién
// guardada y barriendo huérfanos), la atomicidad y el orden de los eventos.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import {
  crearCorridas,
  MAX_CORRIDAS,
  mensajesEvento,
  nuevaCorrida,
  registrarCambio,
  registrarSiembra,
  ST_CORRIDAS,
  ST_CORRIDAS_DATOS,
} from '../engine/corridas.js';
import { ESCENARIOS_FABRICA } from '../engine/escenarios/fabrica.js';

const ESC = ESCENARIOS_FABRICA[0];

function entorno(max = MAX_CORRIDAS) {
  const almacen = almacenMemoria();
  let t = Date.UTC(2026, 8, 29, 12, 0, 0);
  let n = 0;
  const corridas = crearCorridas({
    almacen,
    max,
    reloj: () => {
      t += 1000;
      return new Date(t);
    },
    nuevoId: () => `c${String(++n).padStart(3, '0')}`,
  });
  return { almacen, corridas };
}

test('nuevaCorrida y eventos en caliente', () => {
  const c = nuevaCorrida({ escenario: ESC, semilla: 42 });
  assert.equal(c.nombre, 'Sopa primordial');
  assert.equal(c.semilla, 42);
  assert.deepEqual(c.escenario, ESC);
  assert.notEqual(c.escenario, ESC, 'copia');
  registrarCambio(c, 100, { 'opt:33': 1 });
  registrarCambio(c, 100, { 'opt:34': 800 });
  registrarCambio(c, 250, { 'cost:23': 2 });
  assert.deepEqual(c.eventos, [
    { ciclo: 100, tipo: 'opciones', cambios: { 'opt:33': 1, 'opt:34': 800 } },
    { ciclo: 250, tipo: 'opciones', cambios: { 'cost:23': 2 } },
  ]);
  assert.deepEqual(mensajesEvento(c.eventos[0]), [
    { t: 'setopt', id: 33, v: 1 },
    { t: 'setopt', id: 34, v: 800 },
  ]);
  assert.deepEqual(mensajesEvento(c.eventos[1]), [{ t: 'setcost', i: 23, v: 2 }]);
  assert.throws(() => registrarCambio(c, 300, { 'base:fieldW': 1000 }), /requiere sim nueva/);
  assert.throws(() => registrarCambio(c, 300, { 'base:fieldH': 1000 }), /requiere sim nueva/);
  assert.throws(() => registrarCambio(c, 300, { 'opt:999': 1 }), /desconocido/);
  assert.throws(() => registrarCambio(c, 200, { 'opt:33': 0 }), /orden/);
  assert.throws(() => registrarCambio(c, -2, { 'opt:33': 0 }), /ciclo/);
  // −1 = antes del primer tick (distinto de 0, tras un tick)
  const d = nuevaCorrida({ escenario: ESC, semilla: 1, nombre: 'x' });
  registrarCambio(d, -1, { 'opt:33': 1 });
  registrarCambio(d, 0, { 'opt:33': 0 });
  assert.deepEqual(
    d.eventos.map((e) => e.ciclo),
    [-1, 0],
  );
});

test('guardar, listar, cargar, renombrar y borrar', async () => {
  const { almacen, corridas } = entorno();
  const c = nuevaCorrida({ escenario: ESC, semilla: 7, nombre: 'Mi corrida' });
  registrarCambio(c, 10, { 'opt:50': 0 });
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const { id, borradas } = await corridas.guardar(c, {
    dbsim: bytes,
    ciclo: 1234,
    bots: 56,
    especies: ['Alga minimalis 3.0', 'Animal Minimalis (4G)(Numsgil)-10.03.05'],
    miniatura: 'data:image/png;base64,AA==',
  });
  assert.equal(id, 'c001');
  assert.deepEqual(borradas, []);
  const lista = await corridas.listar();
  assert.equal(lista.length, 1);
  const m = lista[0];
  assert.equal(m.nombre, 'Mi corrida');
  assert.equal(m.ciclo, 1234);
  assert.equal(m.bots, 56);
  assert.equal(m.bytes, 5);
  assert.equal(m.marcada, 0);
  assert.match(/** @type {string} */ (m.fecha), /^2026-09-29T12:00:01/);
  assert.equal(/** @type {any} */ (m).dbsim, undefined, 'la lista no trae el .dbsim');
  assert.equal(m.miniatura, 'data:image/png;base64,AA==');
  const got = await corridas.cargar(id);
  assert.ok(got);
  assert.deepEqual(new Uint8Array(/** @type {ArrayBuffer} */ (got.dbsim)), bytes);
  assert.deepEqual(got.corrida.eventos, c.eventos);
  assert.equal(got.corrida.semilla, 7);
  // sobrescribir la misma corrida (trae id)
  const again = await corridas.guardar(
    { ...got.corrida },
    { dbsim: new ArrayBuffer(8), ciclo: 2000 },
  );
  assert.equal(again.id, id);
  assert.equal((await corridas.listar()).length, 1);
  assert.equal((await corridas.listar())[0].ciclo, 2000);
  assert.ok(await corridas.renombrar(id, 'Otro nombre'));
  assert.equal((await corridas.listar())[0].nombre, 'Otro nombre');
  assert.equal(await corridas.renombrar('nada', 'x'), false);
  await corridas.borrar(id);
  assert.deepEqual(await corridas.listar(), []);
  assert.equal(await corridas.cargar(id), null);
  assert.deepEqual(await almacen.list(ST_CORRIDAS_DATOS), []);
});

test('política: se conservan las últimas 20 y las marcadas', async () => {
  const { almacen, corridas } = entorno();
  const ids = [];
  for (let i = 0; i < 20; i++) {
    const c = nuevaCorrida({ escenario: ESC, semilla: i });
    if (i === 2) c.marcada = 1;
    const r = await corridas.guardar(c, { dbsim: new Uint8Array([i]) });
    assert.deepEqual(r.borradas, []);
    ids.push(r.id);
  }
  // marcar otra vieja después de guardarla
  await corridas.marcar(ids[5], true);
  // 5 más: las últimas 20 son 5..24; salen las más viejas no marcadas (0, 1, 3, 4)
  const nuevas = [];
  for (let i = 20; i < 25; i++)
    nuevas.push(
      await corridas.guardar(nuevaCorrida({ escenario: ESC, semilla: i }), {
        dbsim: new Uint8Array([i]),
      }),
    );
  assert.deepEqual(
    nuevas.flatMap((r) => r.borradas),
    [ids[0], ids[1], ids[3], ids[4]],
  );
  const lista = await corridas.listar();
  assert.equal(lista.length, 21); // 20 más recientes (incluida la 5, marcada) + la 2
  assert.equal(lista[0].semilla, 24, 'la más reciente primero');
  assert.ok(lista.some((c) => c.id === ids[2]) && lista.some((c) => c.id === ids[5]));
  assert.equal((await almacen.list(ST_CORRIDAS_DATOS)).length, 21, 'datos podados también');
  assert.equal((await almacen.porIndice(ST_CORRIDAS, 'marcada', 1)).length, 2);
  // desmarcar aplica la política
  const b = await corridas.marcar(ids[2], false);
  assert.deepEqual(b, [ids[2]]);
  assert.equal((await corridas.listar()).length, 20);
  assert.deepEqual(await corridas.marcar('nada', true), []);
});

test('la recién guardada nunca se poda (reloj atrasado) y se barren los datos huérfanos', async () => {
  const almacen = almacenMemoria();
  let t = Date.UTC(2026, 8, 29, 12, 0, 0);
  let n = 0;
  const corridas = crearCorridas({
    almacen,
    max: 3,
    reloj: () => {
      t += 1000;
      return new Date(t);
    },
    nuevoId: () => `c${++n}`,
  });
  for (let i = 0; i < 3; i++)
    await corridas.guardar(nuevaCorrida({ escenario: ESC, semilla: i }), {
      dbsim: new Uint8Array([i]),
    });
  // un .dbsim sin metadatos (p. ej. de una versión que no era atómica)
  await almacen.put(ST_CORRIDAS_DATOS, { id: 'huerfano', dbsim: new ArrayBuffer(4) });
  // el reloj vuelve atrás: la nueva queda como la más vieja por fecha
  t = Date.UTC(2025, 0, 1);
  const r = await corridas.guardar(nuevaCorrida({ escenario: ESC, semilla: 9 }), {
    dbsim: new Uint8Array([9]),
  });
  assert.equal(r.id, 'c4');
  assert.deepEqual(r.borradas, ['c1'], 'sale la más vieja del resto, no la recién guardada');
  assert.ok(await corridas.cargar('c4'));
  assert.deepEqual(
    (await almacen.claves(ST_CORRIDAS_DATOS)).sort(),
    ['c2', 'c3', 'c4'],
    'sin huérfanos',
  );
  // también desde podar() suelto
  await almacen.put(ST_CORRIDAS_DATOS, { id: 'otro', dbsim: new ArrayBuffer(1) });
  assert.deepEqual(await corridas.podar(), []);
  assert.deepEqual((await almacen.claves(ST_CORRIDAS_DATOS)).sort(), ['c2', 'c3', 'c4']);
});

test('guardar es atómico: si falla a mitad no queda ni el .dbsim ni los metadatos', async () => {
  const base = almacenMemoria();
  /** @type {import('../engine/almacen.js').Almacen} */
  const almacen = {
    ...base,
    tx: (stores, fn) =>
      base.tx(stores, (t) =>
        fn({
          ...t,
          put: async (store, v) => {
            if (store === ST_CORRIDAS) throw new Error('disco lleno');
            return t.put(store, v);
          },
        }),
      ),
  };
  const corridas = crearCorridas({ almacen, nuevoId: () => 'x' });
  await assert.rejects(
    corridas.guardar(nuevaCorrida({ escenario: ESC, semilla: 1 }), { dbsim: new Uint8Array(3) }),
    /disco lleno/,
  );
  assert.deepEqual(await base.claves(ST_CORRIDAS_DATOS), []);
  assert.deepEqual(await base.claves(ST_CORRIDAS), []);
});

test('eventos: fusionar en el mismo ciclo conserva el orden de la última escritura', () => {
  // el caso de la revisión: 101=3, 97=5 (escribe también 101), 101=7
  const c = nuevaCorrida({ escenario: ESC, semilla: 1 });
  registrarCambio(c, 100, { 'opt:101': 3 });
  registrarCambio(c, 100, { 'opt:97': 5 });
  registrarCambio(c, 100, { 'opt:101': 7 });
  assert.deepEqual(mensajesEvento(c.eventos[0]), [
    { t: 'setopt', id: 97, v: 5 },
    { t: 'setopt', id: 101, v: 7 },
  ]);
  // Toroidal (derivado) se registra como cambio en caliente y va antes que
  // el eje que se escribió después
  const d = nuevaCorrida({ escenario: ESC, semilla: 1 });
  registrarCambio(d, 5, { 'opt:2': 0 });
  registrarCambio(d, 5, { 'opt:1': 1 });
  registrarCambio(d, 5, { 'opt:2': 0 });
  assert.deepEqual(mensajesEvento(d.eventos[0]), [
    { t: 'setopt', id: 1, v: 1 },
    { t: 'setopt', id: 2, v: 0 },
  ]);
  // las opciones base ya son vivas (C12): setbase
  registrarCambio(d, 6, { 'base:minVegs': 4 });
  assert.deepEqual(mensajesEvento(d.eventos[1]), [{ t: 'setbase', vals: { minVegs: 4 } }]);
});

test('siembra en caliente: evento propio, en orden con los cambios, y su seed-species', () => {
  const c = nuevaCorrida({ escenario: ESC, semilla: 1 });
  registrarCambio(c, 100, { 'opt:33': 1 });
  const sp = {
    nombre: 'Zeta',
    adn: 'end',
    cantidad: 3,
    color: '#FF8000',
    vegetal: true,
    energia: 500,
  };
  registrarSiembra(c, 100, sp);
  // un cambio en el mismo ciclo después de la siembra no se junta con el anterior
  registrarCambio(c, 100, { 'opt:34': 800 });
  assert.deepEqual(
    c.eventos.map((e) => e.tipo),
    ['opciones', 'siembra', 'opciones'],
  );
  assert.equal(/** @type {any} */ (c.eventos[1]).especie.color, '#ff8000');
  assert.deepEqual(mensajesEvento(c.eventos[1]), [
    {
      t: 'seed-species',
      sp: { dna: 'end', name: 'Zeta.txt', veg: true, qty: 3, nrg: 500, color: 0xff + 0x80 * 256 },
    },
  ]);
  assert.throws(() => registrarSiembra(c, 50, sp), /orden/);
  assert.throws(() => registrarSiembra(c, 200, { ...sp, adn: ' ' }), /ADN/);
  assert.throws(() => registrarSiembra(c, 200, { ...sp, cantidad: 0 }), /cantidad/);
  assert.throws(() => registrarSiembra(c, 200, { ...sp, color: 'red' }), /color/);
});

test('extra: lo pesado va con el .dbsim en corridas-datos y vuelve al cargar', async () => {
  const { almacen, corridas } = entorno();
  const c = nuevaCorrida({ escenario: ESC, semilla: 1 });
  const { id } = await corridas.guardar(c, {
    dbsim: new Uint8Array([1, 2]),
    extra: { feed: [{ ciclo: 0, tipo: 'inicio' }], historia: { muestras: [] } },
  });
  const meta = await almacen.get(ST_CORRIDAS, id);
  assert.equal(meta.feed, undefined);
  const datos = await almacen.get(ST_CORRIDAS_DATOS, id);
  assert.deepEqual(datos.feed, [{ ciclo: 0, tipo: 'inicio' }]);
  const r = await corridas.cargar(id);
  assert.ok(r);
  assert.deepEqual(r.extra, { feed: [{ ciclo: 0, tipo: 'inicio' }], historia: { muestras: [] } });
  assert.deepEqual([...new Uint8Array(/** @type {ArrayBuffer} */ (r.dbsim))], [1, 2]);
  // el extra no puede pisar id ni dbsim
  const { id: id2 } = await corridas.guardar(c, {
    dbsim: new Uint8Array([3]),
    extra: { id: 'otro', dbsim: 'x' },
  });
  const r2 = await corridas.cargar(id2);
  assert.deepEqual([...new Uint8Array(/** @type {ArrayBuffer} */ (r2?.dbsim))], [3]);
});
