// @ts-check
// Barrido de parámetros (Nivel 4, decisión 10): grilla y validación (C23),
// parámetros del trabajo (semillas C19, eventos sin el parámetro barrido),
// unidades, agregación por valor, CSV y vista para la lista.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  agregarBarrido,
  crearParametrosBarrido,
  csvBarrido,
  csvBarridoUnidades,
  ErrorBarrido,
  escenarioCon,
  eventosCon,
  grilla,
  indiceUnidad,
  LectorBarrido,
  listaDeTexto,
  MAX_UNIDADES,
  paramsUnidad,
  reescritosBarrido,
  reiniciosBarrido,
  seriesBarrido,
  unidadDe,
  unidadesBarrido,
  valoresOrigen,
  valorFinal,
  vistaBarrido,
} from '../engine/barrido.js';
import { registrarCambio, registrarSiembra } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar, resolverOpciones } from '../engine/escenarios/index.js';
import { METRICAS } from '../engine/metricas.js';
import { valorEfectivo } from '../engine/opciones.js';
import {
  agregarMuestra,
  historiaReplica,
  mensajesReplica,
  resultadoReplica,
  semillasReplicas,
} from '../engine/replicas.js';
import { escalaX } from '../src/lib/analizar/comparar/grafico.js';

const SOPA = /** @type {any} */ (escenarioFabrica('sopa-primordial'));
const ADN = SOPA.especies.map(() => 'cond start 1 1 store stop end');

/** @param {() => unknown} fn @param {string} codigo */
const lanza = (fn, codigo) =>
  assert.throws(fn, (e) => e instanceof ErrorBarrido && e.codigo === codigo, codigo);

test('grilla lineal: reales sin ruido, enteros redondeados y sin repetir', () => {
  assert.deepEqual(
    grilla('base:maxPopulation', { modo: 'lineal', desde: 0, hasta: 1, pasos: 11 }).valores,
    [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  );
  assert.deepEqual(
    grilla('base:minVegs', { modo: 'lineal', desde: 0, hasta: 10, pasos: 4 }).valores,
    [0, 3, 7, 10],
  );
  const r = grilla('base:minVegs', { modo: 'lineal', desde: 0, hasta: 2, pasos: 5 });
  assert.deepEqual(r.valores, [0, 1, 2]);
  assert.equal(r.avisos.filter((a) => a.codigo === 'repetido').length, 2);
  // Al revés da lo mismo (orden creciente).
  assert.deepEqual(
    grilla('base:minVegs', { modo: 'lineal', desde: 10, hasta: 0, pasos: 4 }).valores,
    [0, 3, 7, 10],
  );
});

test('grilla: bool y enum toman los valores permitidos; lista', () => {
  assert.deepEqual(
    grilla('base:mutations', { modo: 'lineal', desde: 0, hasta: 1, pasos: 7 }).valores,
    [0, 1],
  );
  assert.deepEqual(
    grilla('opt:39', { modo: 'lineal', desde: 0, hasta: 2, pasos: 2 }).valores,
    [0, 1, 2],
  );
  assert.deepEqual(
    grilla('opt:53', { modo: 'lineal', desde: 1, hasta: 3, pasos: 2 }).valores,
    [2, 3],
  );
  assert.deepEqual(
    grilla('base:maxEnergy', { modo: 'lista', valores: [50, 5, 20, 5] }).valores,
    [5, 20, 50],
  );
  lanza(() => grilla('opt:53', { modo: 'lista', valores: [0, 1] }), 'barrido-valor');
});

test('grilla: validación con normalizarValor (C23) y avisos', () => {
  lanza(() => grilla('opt:1', { modo: 'lista', valores: [0, 1] }), 'barrido-derivado');
  lanza(() => grilla('opt:9999', { modo: 'lista', valores: [0, 1] }), 'barrido-parametro');
  lanza(
    () => grilla('base:minVegs', { modo: 'lineal', desde: 0, hasta: 9, pasos: 1 }),
    'barrido-pasos',
  );
  lanza(
    () => grilla('base:minVegs', { modo: 'lineal', desde: 0, hasta: 9, pasos: 33 }),
    'barrido-pasos',
  );
  lanza(() => grilla('base:minVegs', { modo: 'lista', valores: [4] }), 'barrido-valores');
  lanza(() => grilla('base:minVegs', { modo: 'lista', valores: [4, 4] }), 'barrido-valores');
  lanza(() => grilla('base:minVegs', { modo: 'lista', valores: [1.5, 2] }), 'barrido-valor');
  // i16 fuera de su tipo: error (no satura)
  lanza(() => grilla('base:repopAmount', { modo: 'lista', valores: [0, 40000] }), 'barrido-valor');
  lanza(
    () => grilla('base:minVegs', { modo: 'lineal', desde: 0, hasta: Number.NaN, pasos: 3 }),
    'barrido-valor',
  );
  lanza(() => grilla('base:minVegs', /** @type {any} */ ({ modo: 'otro' })), 'barrido-modo');
  // fuera de lo sugerido: se acepta con aviso
  const r = grilla('base:repopAmount', { modo: 'lista', valores: [10, 5000] });
  assert.deepEqual(r.valores, [10, 5000]);
  assert.deepEqual(r.avisos, [{ valor: 5000, codigo: 'fuera-de-lo-usual' }]);
  // opt que el core satura: al tope, con aviso
  const s = grilla('opt:52', { modo: 'lista', valores: [10, 3e9] });
  assert.deepEqual(s.valores, [10, 2147483647]);
  assert.ok(s.avisos.some((a) => a.codigo === 'valor-saturado' && a.pedido === 3e9));
  // Dos pedidos que saturan al mismo tope: un solo aviso de saturado y uno
  // de valores juntados.
  const s2 = grilla('opt:52', { modo: 'lista', valores: [3e9, 4e9, 5] });
  assert.deepEqual(s2.valores, [5, 2147483647]);
  assert.equal(s2.avisos.filter((a) => a.codigo === 'valor-saturado').length, 1);
  assert.equal(s2.avisos.filter((a) => a.codigo === 'repetido').length, 1);
  // Sin -0 al redondear (-0,4 → 0).
  const z = grilla('base:minVegs', { modo: 'lineal', desde: -0.4, hasta: 3, pasos: 2 });
  assert.ok(Object.is(z.valores[0], 0));
});

test('eje X del gráfico: marcas sin repetir', () => {
  assert.deepEqual(
    escalaX(0, 1, 0, 100).marcas.map((m) => m.v),
    [0, 1],
  );
  assert.deepEqual(
    escalaX(0, 1, 0, 100, true).marcas.map((m) => m.v),
    [0, 0.5, 1],
  );
  assert.equal(escalaX(3, 3, 0, 100).marcas.length, 1);
});

test('listaDeTexto', () => {
  assert.deepEqual(listaDeTexto('1; 2,5; 10'), [1, 2.5, 10]);
  assert.deepEqual(listaDeTexto('1 2.5  10'), [1, 2.5, 10]);
  assert.deepEqual(listaDeTexto('1, 2, 3'), [1, 2, 3]);
  assert.deepEqual(listaDeTexto(''), []);
  assert.equal(listaDeTexto('1; x'), null);
});

test('escenarioCon y eventosCon', () => {
  const e = escenarioCon(SOPA, 'base:minVegs', 33);
  assert.equal(valorEfectivo(resolverOpciones(e), 'base:minVegs'), 33);
  assert.deepEqual(SOPA.opciones.cambios, {}, 'no toca el original');
  // Acoplados: barrer 101 no deja un 97 que lo pise en caliente, pero el
  // 97 del evento se conserva.
  const c = /** @type {any} */ ({ eventos: [] });
  registrarCambio(c, 50, { 'base:minVegs': 40, 'opt:97': 3 });
  registrarCambio(c, 60, { 'base:minVegs': 2 });
  registrarSiembra(c, 70, {
    nombre: 'x',
    adn: 'end',
    cantidad: 1,
    color: '#ffffff',
    vegetal: true,
    energia: 100,
  });
  const conMin = eventosCon(c.eventos, 'base:minVegs', 7);
  assert.deepEqual(
    conMin.map((/** @type {any} */ ev) => [ev.ciclo, ev.tipo, ev.cambios]),
    [
      [50, 'opciones', { 'opt:97': 3, 'base:minVegs': 7 }],
      [60, 'opciones', { 'base:minVegs': 7 }],
      [70, 'siembra', undefined],
    ],
  );
  assert.equal(reescritosBarrido(c.eventos, 'base:minVegs'), 2);
  assert.deepEqual(c.eventos[0].cambios, { 'base:minVegs': 40, 'opt:97': 3 }, 'sin tocar');
  // 97 escribe 101: el evento conserva su 97 y el barrido fija 101 después.
  const con101 = eventosCon(c.eventos, 'opt:101', 9);
  assert.deepEqual(con101[0].cambios, { 'base:minVegs': 40, 'opt:97': 3, 'opt:101': 9 });
  assert.deepEqual(con101[1].cambios, { 'base:minVegs': 2 }, 'el que no toca queda igual');
  assert.equal(con101.length, 3);
  assert.equal(reescritosBarrido(c.eventos, 'opt:101'), 1);
});

test('eventosCon: casos acoplados (97 → 101, opt:1 → 2 y 3)', () => {
  const ev = (/** @type {Record<string, number>} */ cambios) => [
    { ciclo: 10, tipo: /** @type {const} */ ('opciones'), cambios },
  ];
  // Barrer 97 arrastra 101: el 101 del evento lo pisa el barrido.
  assert.deepEqual(eventosCon(ev({ 'opt:101': 3, 'base:minVegs': 4 }), 'opt:97', 9)[0].cambios, {
    'base:minVegs': 4,
    'opt:97': 9,
  });
  // 101 en el evento DESPUÉS de 97: sigue ganando el barrido de 97.
  assert.deepEqual(eventosCon(ev({ 'opt:97': 2, 'opt:101': 3 }), 'opt:97', 9)[0].cambios, {
    'opt:97': 9,
  });
  // Barrer 2 con un opt:1 en caliente: el 3 del toroidal se conserva.
  assert.deepEqual(eventosCon(ev({ 'opt:1': 1 }), 'opt:2', 0)[0].cambios, {
    'opt:3': 1,
    'opt:2': 0,
  });
  assert.deepEqual(eventosCon(ev({ 'opt:1': 1 }), 'opt:3', 0)[0].cambios, {
    'opt:2': 1,
    'opt:3': 0,
  });
  // El que no toca ni se reescribe ni cuenta.
  assert.deepEqual(eventosCon(ev({ 'opt:1': 1 }), 'opt:97', 5)[0].cambios, { 'opt:1': 1 });
  assert.equal(reescritosBarrido(ev({ 'opt:1': 1 }), 'opt:97'), 0);
  assert.equal(reescritosBarrido(ev({ 'opt:1': 1 }), 'opt:2'), 1);
  // Aplicados en orden sobre el escenario, el valor del barrido gana y lo
  // demás queda como en la corrida.
  const e = /** @type {any} */ ({
    ...SOPA,
    opciones: { ...SOPA.opciones, cambios: {} },
  });
  const o = valoresOrigen(e, ev({ 'opt:97': 3, 'base:minVegs': 4 }), 'opt:101');
  assert.equal(o.fin, 3);
  const r = eventosCon(ev({ 'opt:97': 3, 'base:minVegs': 4 }), 'opt:101', 9);
  const x = valoresOrigen(escenarioCon(e, 'opt:101', 9), r, 'opt:101');
  assert.equal(x.inicio, 9);
  assert.equal(x.fin, 9);
  assert.equal(valoresOrigen(escenarioCon(e, 'opt:101', 9), r, 'opt:97').fin, 3);
  assert.equal(valoresOrigen(escenarioCon(e, 'opt:101', 9), r, 'base:minVegs').fin, 4);
});

test('crearParametrosBarrido: semillas C19, eventos, unidades y errores', () => {
  const c = /** @type {any} */ ({ eventos: [] });
  registrarCambio(c, 50, { 'base:minVegs': 40 });
  const base = {
    escenario: SOPA,
    adn: ADN,
    semilla: 777,
    n: 3,
    ciclos: 250,
    clave: 'base:minVegs',
    grilla: /** @type {const} */ ({ modo: 'lineal', desde: 0, hasta: 30, pasos: 4 }),
    eventos: c.eventos,
    origen: { nombre: 'origen', id: 'x' },
  };
  const p = crearParametrosBarrido(base);
  assert.deepEqual(p.valores, [0, 10, 20, 30]);
  assert.deepEqual(p.semillas, semillasReplicas(777, 3));
  assert.equal(p.semillas[0], 777);
  assert.deepEqual(p.eventos, c.eventos, 'guarda los eventos originales');
  assert.deepEqual(
    paramsUnidad(p, 1).eventos.map((/** @type {any} */ ev) => ev.cambios),
    [{ 'base:minVegs': 10 }],
    'cada unidad los reescribe con su valor',
  );
  assert.equal(p.cada, 100);
  assert.equal(p.metricas[0], 'vivos');
  assert.equal(unidadesBarrido(p), 12);
  assert.equal(crearParametrosBarrido({ ...base, ciclos: 40 }).cada, 40);
  assert.deepEqual(crearParametrosBarrido({ ...base, metricas: ['nrgTotal', 'vivos'] }).metricas, [
    'nrgTotal',
    'vivos',
  ]);
  lanza(() => crearParametrosBarrido({ ...base, escenario: null }), 'sin-escenario');
  lanza(() => crearParametrosBarrido({ ...base, n: 0 }), 'n');
  lanza(() => crearParametrosBarrido({ ...base, ciclos: 0 }), 'ciclos');
  lanza(() => crearParametrosBarrido({ ...base, metricas: ['nada'] }), 'metrica');
  lanza(() => crearParametrosBarrido({ ...base, adn: [] }), 'sin-adn');
  lanza(() => crearParametrosBarrido({ ...base, semilla: Number.NaN }), 'semilla');
  lanza(
    () =>
      crearParametrosBarrido({
        ...base,
        n: 64,
        grilla: { modo: 'lineal', desde: 0, hasta: 100, pasos: 9 },
      }),
    'barrido-unidades',
  );
  assert.ok(9 * 64 > MAX_UNIDADES);
  const v = vistaBarrido(p);
  assert.ok(!('adn' in v) && !('escenario' in v) && !('eventos' in v));
  assert.deepEqual(v.valores, p.valores);
});

test('unidades: semilla por semilla; paramsUnidad = una réplica con el escenario modificado', () => {
  const p = crearParametrosBarrido({
    escenario: SOPA,
    adn: ADN,
    semilla: 5,
    n: 2,
    ciclos: 100,
    clave: 'base:maxEnergy',
    grilla: { modo: 'lista', valores: [10, 40, 90] },
  });
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => indiceUnidad(p, i)),
    [
      { v: 0, s: 0 },
      { v: 1, s: 0 },
      { v: 2, s: 0 },
      { v: 0, s: 1 },
      { v: 1, s: 1 },
      { v: 2, s: 1 },
    ],
  );
  for (let i = 0; i < 6; i++) {
    const { v, s } = indiceUnidad(p, i);
    assert.equal(unidadDe(p, v, s), i);
  }
  assert.throws(() => indiceUnidad(p, 6));
  const r = paramsUnidad(p, 4);
  assert.deepEqual(r.semillas, [p.semillas[1]]);
  assert.equal(valorEfectivo(resolverOpciones(r.escenario), 'base:maxEnergy'), 40);
  // Los mensajes de arranque son los del escenario modificado con esa semilla.
  const m = mensajesReplica(r, 0);
  const e40 = escenarioCon(SOPA, 'base:maxEnergy', 40);
  assert.deepEqual(
    m.inicio,
    aplicar(e40, p.semillas[1], (x) => ADN[e40.especies.indexOf(x)]),
  );
});

/** Resultado sintético de una unidad: muestras cada 50 ciclos con vivos = f(ciclo). */
function resultado(/** @type {(c: number) => number} */ f, hasta = 100) {
  const iv = METRICAS.findIndex((m) => m.clave === 'vivos');
  const h = historiaReplica({ cada: 50, maxPuntos: 50 });
  let fin = null;
  for (let c = 0; c <= hasta; c += 50) {
    const metrics = METRICAS.map(() => 0);
    metrics[iv] = f(c);
    agregarMuestra(h, { ciclo: c, metrics });
    fin = { ciclo: c, metrics };
  }
  return resultadoReplica(h, fin);
}

test('agregación por valor, series medias y CSV', () => {
  const p = crearParametrosBarrido({
    escenario: SOPA,
    adn: ADN,
    semilla: 5,
    n: 3,
    ciclos: 100,
    cada: 50,
    clave: 'base:maxEnergy',
    grilla: { modo: 'lista', valores: [10, 20] },
    metricas: ['vivos'],
  });
  /** @type {any[]} */
  const res = new Array(unidadesBarrido(p)).fill(null);
  // valor 10: finales 10, 20, 30; valor 20: 100, 200 y una sin terminar
  res[unidadDe(p, 0, 0)] = resultado((c) => c / 10);
  res[unidadDe(p, 0, 1)] = resultado((c) => c / 5);
  res[unidadDe(p, 0, 2)] = resultado((c) => (c * 3) / 10);
  res[unidadDe(p, 1, 0)] = resultado((c) => c);
  res[unidadDe(p, 1, 1)] = resultado((c) => c * 2);
  assert.equal(valorFinal(res[0], 'vivos'), 10);
  assert.ok(Number.isNaN(valorFinal(null, 'vivos')));
  const filas = agregarBarrido(p, res);
  assert.deepEqual(
    filas.map((f) => [f.valor, f.n]),
    [
      [10, 3],
      [20, 2],
    ],
  );
  const a = filas[0].metricas.vivos;
  assert.equal(a.media, 20);
  assert.equal(a.desvio, 10);
  assert.equal(a.min, 10);
  assert.equal(a.max, 30);
  assert.ok(Math.abs(a.p10 - 12) < 1e-9);
  assert.ok(Math.abs(a.p90 - 28) < 1e-9);
  assert.equal(filas[1].metricas.vivos.media, 150);
  // Sin resultados: n 0 y NaN.
  const vacias = agregarBarrido(p, []);
  assert.equal(vacias[0].n, 0);
  assert.ok(Number.isNaN(vacias[0].metricas.vivos.media));

  const s = seriesBarrido(p, res, 'vivos');
  assert.deepEqual(s[0].agregado.t, [0, 50, 100]);
  assert.deepEqual(s[0].agregado.media, [0, 10, 20]);
  assert.deepEqual(s[1].agregado.n, [2, 2, 2]);

  const csv = csvBarrido(p, res).trim().split('\n');
  assert.equal(csv[0], 'parametro,valor,metrica,n,media,desvio,p10,p90,min,max,reiniciadas');
  assert.equal(csv.length, 3);
  assert.match(csv[1], /^base:maxEnergy,10,vivos,3,20,10,12,28,10,30,0$/);
  const u = csvBarridoUnidades(p, res).trim().split('\n');
  assert.equal(u[0], 'parametro,valor,semilla,ciclo,vivos,reinicio');
  assert.equal(u.length, 6);
  assert.equal(u[1], `base:maxEnergy,10,${p.semillas[0]},100,10,`);

  // Una unidad con la ronda reiniciada: fuera de la tabla y de las series,
  // contada aparte, listada y marcada en el CSV por unidad.
  const conReinicio = [...res];
  const rr = /** @type {any} */ (resultado((c) => c * 100, 50));
  rr.reinicio = { ciclo: 60, esperado: 100 };
  conReinicio[unidadDe(p, 1, 2)] = rr;
  const f2 = agregarBarrido(p, conReinicio);
  assert.equal(f2[1].n, 2);
  assert.equal(f2[1].reiniciadas, 1);
  assert.equal(f2[1].metricas.vivos.media, 150);
  assert.equal(f2[0].reiniciadas, 0);
  assert.deepEqual(reiniciosBarrido(p, conReinicio), [
    { v: 1, s: 2, i: unidadDe(p, 1, 2), ciclo: 60 },
  ]);
  assert.deepEqual(seriesBarrido(p, conReinicio, 'vivos')[1].agregado.n, [2, 2, 2]);
  assert.match(csvBarrido(p, conReinicio).trim().split('\n')[2], /,1$/);
  const u2 = csvBarridoUnidades(p, conReinicio).trim().split('\n');
  assert.equal(u2.length, 7);
  assert.ok(u2.some((l) => l.endsWith(',60')));
});

test('LectorBarrido: lee solo las unidades nuevas y extrae cada serie una vez', async () => {
  const p = { valores: [1, 2], semillas: [7, 8], metricas: ['vivos'] };
  const datos = [0, 1, 2, 3].map((k) => resultado((c) => c + k));
  /** @type {number[]} */
  const pedidas = [];
  const l = new LectorBarrido(async (i) => {
    pedidas.push(i);
    return datos[i];
  });
  const u = [0, 1, 2, 3].map(() => ({ estado: 'pendiente' }));
  assert.equal(await l.actualizar(u), true, 'toma el largo');
  assert.equal(pedidas.length, 0);
  u[0].estado = 'hecha';
  u[2].estado = 'hecha';
  assert.equal(await l.actualizar(u), true);
  assert.deepEqual(pedidas, [0, 2]);
  // Otra unidad termina: se lee solo esa.
  u[1].estado = 'hecha';
  assert.equal(await l.actualizar(u), true);
  assert.deepEqual(pedidas, [0, 2, 1]);
  assert.equal(await l.actualizar(u), false, 'nada nuevo: no relee');
  assert.equal(l.leidas, 3);
  const res = l.resultados;
  assert.equal(res[3], null);
  assert.equal(agregarBarrido(p, res)[0].n, 2);
  // Series: mismas que sin caché, y la misma referencia la segunda vez.
  const a = seriesBarrido(p, res, 'vivos', (i) => l.serie(i, 'vivos'));
  assert.deepEqual(a, seriesBarrido(p, res, 'vivos'));
  assert.equal(l.serie(0, 'vivos'), l.serie(0, 'vivos'));
  // Un reintento la suelta y se vuelve a leer al terminar de nuevo.
  u[0].estado = 'pendiente';
  assert.equal(await l.actualizar(u), true);
  assert.equal(l.resultados[0], null);
  u[0].estado = 'hecha';
  await l.actualizar(u);
  assert.deepEqual(pedidas, [0, 2, 1, 0]);
});
