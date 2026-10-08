// @ts-check
// Evolución asistida del editor (PLAN-EDITOR E4.3; src/lib/trabajos/evolucion.js):
//
//   1. Unidades: la base y una por variante, con las mismas semillas y reglas
//      que una «Probar» de cada texto; la vista de la cola no copia los textos.
//   2. Resumen: ordena por supervivencia y luego por hijos por copia, y cuenta
//      los genes cambiados contra la base (diffGenes), con datos armados a mano.
//   3. Registro: el ejecutor 'evolucion' está en la cola, y el historial del bot
//      (engine/biblioteca.js historialBot) lo lista con su tipo.
//   4. Con el worker real (wasm): una unidad da lo mismo en cada corrida y usa
//      las semillas de la evolución.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashAdn, lgHash } from '../engine/adn.js';
import { almacenMemoria } from '../engine/almacen.js';
import { historialBot } from '../engine/biblioteca.js';
import { crearTrabajo } from '../engine/cola.js';
import { ejecutores } from '../src/lib/trabajos/ejecutores.js';
import {
  correrEvolucion,
  crearParamsEvolucion,
  ErrorEvolucion,
  MUTACIONES,
  POR_DEFECTO_EVOLUCION,
  paramsTexto,
  resumenEvolucion,
  TIPO_EVOLUCION,
  unidadEvolucion,
  unidadesEvolucion,
  vistaEvolucion,
} from '../src/lib/trabajos/evolucion.js';
import { ErrorPrueba } from '../src/lib/trabajos/prueba.js';
import { workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM } from './util/dbcore-node.js';

// dos genes; el segundo está completo para que genesAdn los separe bien
const A =
  'cond\n*.nrg 0 <\nstart\n1 .up store\nstop\ncond\n*.robage 20 >\nstart\n50 .repro store\nstop\n';
// cambia el primer gen (un cambiado)
const A1 = A.replace('1 .up store', '2 .up store');
// agrega un tercer gen (un agregado)
const A2 = `${A}cond\n*.nrg 5 >\nstart\n1 .down store\nstop\n`;
// cambia los dos genes (dos cambiados)
const A3 = A.replace('1 .up store', '2 .up store').replace('50 .repro store', '60 .repro store');
// un bot que no hace nada (el mismo del arnés de prueba)
const QUIETO = "' quieto\ncond\n*.nrg 0 <\nstart\n1 .up store\nstop\n";
// uno que se reproduce en cuanto puede
const REPRO = "' repro\ncond\n*.robage 20 >\nstart\n50 .repro store\nstop\n";

/** @param {Partial<{copias: number, sobreviven: number}>} o */
const resultado = (o = {}) => ({
  version: 'actual',
  semilla: 1,
  ciclo: 100,
  fundadores: o.copias ?? 4,
  fundadoresVivos: o.sobreviven ?? 0,
  nacidos: 4,
  hijosDirectos: 0,
  vivos: 5,
  nrg: 100,
  extincion: null,
  serie: [],
});

/** @param {string} texto */
const pars = (texto) =>
  crearParamsEvolucion({
    clave: 'p:0123456789abcdef',
    nombre: 'Mi bot',
    adn: A,
    textos: [texto],
    modo: 'solo',
    copias: 4,
    ciclos: 200,
    semillas: 3,
    semilla: 77,
  });

test('evolución: la base y una unidad por variante, con las mismas semillas', () => {
  const p = crearParamsEvolucion({
    clave: 'p:0123456789abcdef',
    nombre: 'Mi bot',
    adn: A,
    textos: [A1, A2, A3],
    k: 4,
    mutaciones: 2,
    factor: 4,
    modo: 'solo',
    copias: 5,
    ciclos: 250,
    semillas: 3,
    semilla: 9,
  });
  assert.equal(p.k, 4, 'k es lo pedido');
  assert.equal(p.textos.length, 3, 'las variantes que llegaron');
  assert.equal(p.mutaciones, 2);
  assert.equal(p.factor, 4);
  assert.equal(p.hash, hashAdn(A));
  assert.equal(p.lg, lgHash(A));
  assert.equal(p.adn, A, 'la base lleva el ADN del usuario');

  const us = unidadesEvolucion(p);
  assert.equal(us.length, 4, 'la base y tres variantes');
  assert.deepEqual(us[0], { variante: -1, texto: A });
  assert.deepEqual(
    us.slice(1).map((u) => [u.variante, u.texto]),
    [
      [0, A1],
      [1, A2],
      [2, A3],
    ],
  );
  assert.deepEqual(unidadEvolucion(p, 2), { variante: 1, texto: A2 });

  // cada texto corre con las mismas semillas y reglas que la base
  const semillasBase = paramsTexto(p, A).semillas;
  assert.equal(semillasBase.length, 3);
  for (const u of us) {
    const pt = paramsTexto(p, u.texto);
    assert.deepEqual(pt.semillas, semillasBase, 'mismas semillas');
    assert.equal(pt.copias, 5);
    assert.equal(pt.ciclos, 250);
    assert.equal(pt.anterior, null);
    assert.equal(pt.version, null);
    assert.equal(pt.adn, u.texto);
    assert.equal(pt.hash, hashAdn(u.texto));
  }
  assert.throws(
    () => unidadEvolucion(p, 4),
    (e) => e instanceof ErrorEvolucion,
  );
  assert.throws(
    () => unidadEvolucion(p, -1),
    (e) => e instanceof ErrorEvolucion,
  );

  // la vista de la cola no copia los textos
  const v = vistaEvolucion(p);
  assert.ok(!JSON.stringify(v).includes('.up store'), 'la vista no copia el ADN');
  assert.equal(v.variantes, 3);
  assert.equal(v.mutaciones, 2);
  assert.equal(v.factor, 4);
  assert.equal(v.clave, 'p:0123456789abcdef', 'la clave queda para el historial de la ficha');
});

test('evolución: valores por defecto y errores con código', () => {
  const ok = pars(A1);
  assert.equal(ok.k, POR_DEFECTO_EVOLUCION.k);
  assert.equal(ok.mutaciones, POR_DEFECTO_EVOLUCION.mutaciones);
  assert.equal(ok.factor, POR_DEFECTO_EVOLUCION.factor);
  assert.deepEqual([...MUTACIONES], [0, 1, 2]);

  /** @param {() => unknown} f @param {string} codigo */
  const falla = (f, codigo) =>
    assert.throws(f, (e) => e instanceof ErrorEvolucion && e.codigo === codigo, codigo);
  const base = { clave: 'p:1', nombre: 'x', adn: A, textos: [A1], modo: 'solo' };
  falla(() => crearParamsEvolucion({ ...base, textos: [] }), 'sinVariantes');
  falla(() => crearParamsEvolucion({ ...base, textos: ['  '] }), 'textos');
  falla(() => crearParamsEvolucion({ ...base, textos: [A1, 7] }), 'textos');
  falla(() => crearParamsEvolucion({ ...base, k: 0 }), 'k');
  falla(() => crearParamsEvolucion({ ...base, k: 17 }), 'k');
  falla(() => crearParamsEvolucion({ ...base, mutaciones: 3 }), 'mutaciones');
  falla(() => crearParamsEvolucion({ ...base, factor: 0 }), 'factor');
  falla(() => crearParamsEvolucion({ ...base, factor: 1001 }), 'factor');
  // lo de la prueba sigue saliendo como ErrorPrueba
  assert.throws(
    () => crearParamsEvolucion({ ...base, adn: '  ' }),
    (e) => e instanceof ErrorPrueba && e.codigo === 'adn',
  );
  assert.throws(
    () => crearParamsEvolucion({ ...base, modo: 'algas' }),
    (e) => e instanceof ErrorPrueba && e.codigo === 'alga',
    'con algas hace falta el ADN del alga',
  );
});

test('resumen: ordena por supervivencia, luego hijos por copia, y cuenta los genes cambiados', () => {
  const p = crearParamsEvolucion({
    clave: 'p:1',
    nombre: 'x',
    adn: A,
    textos: [A1, A2, A3],
    modo: 'solo',
    copias: 4,
    ciclos: 100,
    semillas: 1,
    semilla: 5,
  });
  const base = { variante: -1, texto: A, resultados: [resultado({ sobreviven: 1 })] };
  // la variante 2 sobrevive menos; la 0 y la 1 empatan en supervivencia
  const v0 = { variante: 0, texto: A1, resultados: [resultado({ sobreviven: 3 })] };
  const v1 = { variante: 1, texto: A2, resultados: [resultado({ sobreviven: 3 })] };
  const v2 = { variante: 2, texto: A3, resultados: [resultado({ sobreviven: 0 })] };
  // los hijos por copia desempatan: la 1 tiene más hijos directos
  v0.resultados[0].hijosDirectos = 2;
  v1.resultados[0].hijosDirectos = 6;
  // desordenado, con un hueco (una unidad que no terminó)
  const r = resumenEvolucion(p, [v2, null, base, v0, v1]);

  assert.equal(r.base?.n, 1);
  assert.equal(r.base?.sobreviven, 1);
  assert.deepEqual(
    r.variantes.map((x) => x.i),
    [1, 0, 2],
    'la 1 gana el empate por hijos por copia',
  );
  assert.deepEqual(
    r.variantes.map((x) => x.genesCambiados),
    [1, 1, 2],
    'agregado = 1, cambiado = 1 (A1), dos cambiados (A3)',
  );
  assert.equal(r.variantes[0].texto, A2);
  assert.equal(r.variantes[0].resumen?.sobreviven, 3);
  assert.equal(r.variantes[0].resumen?.copias, 4);

  // sin la base no hay resumen de base
  const sinBase = resumenEvolucion(p, [v0]);
  assert.equal(sinBase.base, null);
  assert.equal(sinBase.variantes.length, 1);
});

test('la evolución está en la cola y en el historial del bot', async () => {
  const p = crearParamsEvolucion({
    clave: 'p:0011223344556677',
    nombre: 'Mi bot',
    adn: A,
    textos: [A1, A2],
    modo: 'solo',
    copias: 3,
    ciclos: 100,
    semillas: 2,
    semilla: 3,
  });
  const ej = ejecutores({ pool: /** @type {any} */ (null) });
  assert.ok(ej[TIPO_EVOLUCION], 'el ejecutor está registrado');
  const t = crearTrabajo(
    { tipo: TIPO_EVOLUCION, params: p, unidades: unidadesEvolucion(p).length, titulo: 'Evolución' },
    { ejecutores: ej },
  );
  assert.equal(t.unidades.length, 3, 'la base y dos variantes');
  assert.equal(t.tipo, 'evolucion');

  const almacen = almacenMemoria();
  await almacen.put('trabajos', {
    id: 'ev1',
    clase: 'trabajo',
    tipo: TIPO_EVOLUCION,
    titulo: 'Evolución de Mi bot',
    estado: 'terminado',
    creado: '2026-10-01',
    params: p,
  });
  await almacen.put('trabajos', {
    id: 'otro',
    clase: 'trabajo',
    tipo: 'prueba',
    titulo: 'Probar',
    estado: 'terminado',
    creado: '2026-10-02',
    params: { clave: 'p:ffffffffffffffff' },
  });
  const h = await historialBot(almacen, {
    clase: 'propio',
    clave: 'p:0011223344556677',
    nombre: 'Mi bot',
    lgs: [],
  });
  assert.deepEqual(
    h.pruebas.map((x) => [x.id, x.tipo]),
    [['ev1', 'evolucion']],
  );
});

test('evolución con el worker real: una unidad da lo mismo en cada corrida', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const p = crearParamsEvolucion({
    clave: 'p:0000000000000002',
    nombre: 'Quieto',
    adn: QUIETO,
    textos: [REPRO],
    modo: 'solo',
    copias: 3,
    ciclos: 300,
    semillas: 2,
    semilla: 4242,
  });
  const w = workerTrabajo();
  try {
    const canal = w.canal;
    const a = await correrEvolucion({ canal, params: p, i: 1 });
    const b = await correrEvolucion({ canal, params: p, i: 1 });
    assert.deepEqual(a, b, 'determinista');
    assert.equal(a.variante, 0);
    assert.equal(a.texto, REPRO);
    assert.equal(a.resultados.length, 2, 'una prueba por semilla');
    assert.deepEqual(
      a.resultados.map((r) => r.semilla),
      paramsTexto(p, REPRO).semillas,
      'las semillas de la evolución',
    );
    for (const r of a.resultados) {
      assert.equal(r.fundadores, 3, 'las copias fundadoras');
      assert.equal(r.ciclo, 300, 'termina en el objetivo');
    }
    const base = await correrEvolucion({ canal, params: p, i: 0 });
    assert.equal(base.variante, -1);
    assert.equal(base.texto, QUIETO);
  } finally {
    w.terminar();
  }
});

/** Un worker del engine con el canal que espera replica.js (como en editor_prueba_worker). */
function workerTrabajo() {
  const w = workerEngine();
  return {
    canal: {
      enviar: (/** @type {any} */ m) => w.postMessage(m),
      on: (/** @type {(m: any) => void} */ fn) => {
        w.on('message', fn);
        return () => {
          w.off('message', fn);
        };
      },
      alError: (/** @type {(e: any) => void} */ fn) => {
        w.on('error', fn);
        return () => {
          w.off('error', fn);
        };
      },
    },
    terminar: () => {
      void w.terminate();
    },
  };
}
