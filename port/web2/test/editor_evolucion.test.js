// @ts-check
// «Evolucionar» del editor (PLAN-EDITOR E4.4, src/lib/bots/editor/evolucion.js):
// la parte pura del panel, sin DOM ni wasm.
//   1. adaptarDiff: la forma que espera DiffGenes (la de diffVersiones), con los
//      números de diffGenes.
//   2. notaAdopcion: la nota con el texto real de es/editor.json (las claves
//      existen y los parámetros se rellenan).
//   3. ultimoTrabajo y progresoTrabajo: el último trabajo de evolución de este
//      bot, sin mirar pruebas ni otros bots.
//   4. claveError, comprobarRonda y semillaAleatoria, y que las constantes del
//      panel coinciden con las del motor (MUTACIONES, POR_DEFECTO_EVOLUCION).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { diffGenes } from '../engine/lineage.js';
import {
  adaptarDiff,
  claveError,
  comprobarRonda,
  INTENSIDADES,
  notaAdopcion,
  progresoTrabajo,
  semillaAleatoria,
  TIPOS_MUTACION,
  ultimoTrabajo,
} from '../src/lib/bots/editor/evolucion.js';
import {
  ErrorEvolucion,
  LIMITES_EVOLUCION,
  MUTACIONES,
  POR_DEFECTO_EVOLUCION,
  TIPO_EVOLUCION,
} from '../src/lib/trabajos/evolucion.js';
import { LIMITES, POR_DEFECTO } from '../src/lib/trabajos/prueba.js';

/** El diccionario real de es (las claves que no existan salen como la clave). */
const ES = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL('../src/i18n/es/editor.json', import.meta.url)), 'utf8'),
);
const EN = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL('../src/i18n/en/editor.json', import.meta.url)), 'utf8'),
);

/**
 * Un t que rellena {params} con el texto de es; una clave que no existe se
 * devuelve tal cual (el test lo detecta).
 * @param {string} clave @param {Record<string, string | number>} [p]
 */
const tEs = (clave, p = {}) =>
  (ES[clave] ?? clave).replace(/\{(\w+)\}/g, (_, n) => String(p[n] ?? `{${n}}`));

const A = [
  "' Gen uno: come",
  'cond .up 5 >',
  'start',
  '  3 .up store',
  'stop',
  "' Gen dos: vecino",
  'cond *50 1 >',
  'start 7 100 store',
  'stop',
  'end',
].join('\n');
const B = A.replace('3 .up store', '4 .up store');

test('adaptarDiff: la forma de diffVersiones (con los números de diffGenes)', () => {
  const d = adaptarDiff(A, B);
  const ref = diffGenes(A, B);
  assert.deepEqual(d.cambios, ref.cambios);
  assert.deepEqual(d.genesA, ref.genesA);
  assert.deepEqual(d.genesB, ref.genesB);
  assert.equal(d.iguales, ref.iguales);
  assert.equal(d.cambiados, 1, 'un gen cambió');
  assert.equal(d.agregados + d.quitados, 0);
  assert.equal(d.origenesA, null);
  assert.equal(d.origenesB, null);
});

test('adaptarDiff: dos textos iguales no tienen cambios', () => {
  const d = adaptarDiff(A, A);
  assert.equal(d.cambiados + d.agregados + d.quitados, 0);
  assert.ok(d.iguales > 0);
});

test('notaAdopcion: la variante se nombra desde 1 con la semilla y la intensidad', () => {
  assert.equal(
    notaAdopcion(tEs, { i: 2, semilla: 77, factor: 4 }),
    'evolución: variante 3 (semilla 77, intensidad 4×)',
  );
  assert.equal(
    notaAdopcion(tEs, { i: 0, semilla: 1, factor: 16 }),
    'evolución: variante 1 (semilla 1, intensidad 16×)',
  );
});

test('las claves que usa el panel existen en es y en en', () => {
  const usadas = [
    'editor.evolucion.notaAdoptada',
    'editor.evolucion.factor',
    'editor.evolucion.ultima',
    'editor.evolucion.desdeVariante',
    'editor.evolucion.variante',
    'editor.evolucion.tituloTrabajo',
    'editor.evolucion.tipo.ambos',
    'editor.evolucion.tipo.vida',
    'editor.evolucion.tipo.reproduccion',
    'editor.evolucion.errorAdn',
    'editor.evolucion.sinVariantes',
    'editor.evolucion.anuncio.corriendo',
    'editor.evolucion.anuncio.terminada',
    'editor.evolucion.cancelada',
    'editor.evolucion.corriendo',
    'editor.evolucion.genesCambiados',
    'editor.evolucion.otraRonda',
    'editor.evolucion.adoptar',
    'editor.evolucion.verDiff',
    'editor.evolucion.base',
    'editor.evolucion.num',
    'editor.evolucion.generar',
    'editor.evolucion.generando',
    'editor.evolucion.cancelar',
    'editor.evolucion.ayuda',
    'editor.evolucion.titulo',
    'editor.evolucion.variantes',
    'editor.evolucion.intensidad',
    'editor.evolucion.tipo',
  ];
  for (const k of usadas) {
    assert.ok(Object.hasOwn(ES, k), `falta en es: ${k}`);
    assert.ok(Object.hasOwn(EN, k), `falta en en: ${k}`);
  }
});

test('ultimoTrabajo: el más nuevo de esta clave y de tipo evolución', () => {
  const lista = [
    { id: 'p1', tipo: 'prueba', params: { clave: 'a' }, creado: '2026-10-09T10:00' },
    { id: 'e1', tipo: TIPO_EVOLUCION, params: { clave: 'a' }, creado: '2026-10-07T10:00' },
    { id: 'e2', tipo: TIPO_EVOLUCION, params: { clave: 'a' }, creado: '2026-10-08T09:00' },
    { id: 'e3', tipo: TIPO_EVOLUCION, params: { clave: 'b' }, creado: '2026-10-09T12:00' },
  ];
  const antes = lista.map((x) => x.id).join();
  assert.equal(ultimoTrabajo(lista, 'a')?.id, 'e2');
  assert.equal(lista.map((x) => x.id).join(), antes, 'no reordena la lista de entrada');
  assert.equal(ultimoTrabajo(lista, 'b')?.id, 'e3');
  assert.equal(ultimoTrabajo(lista, 'c'), null, 'sin trabajos de ese bot');
  assert.equal(ultimoTrabajo([], 'a'), null);
});

test('progresoTrabajo: las unidades hechas cuentan 1 y las que corren, su fracción', () => {
  assert.equal(
    progresoTrabajo({
      unidades: [{ estado: 'hecha' }, { estado: 'corriendo', progreso: 0.5 }],
    }),
    0.75,
  );
  assert.equal(progresoTrabajo({ unidades: [{ estado: 'pendiente' }] }), 0);
  assert.equal(progresoTrabajo({ unidades: [] }), 0);
  assert.equal(progresoTrabajo(null), 0);
});

test('claveError: los códigos de la evolución y los de la prueba tienen su clave', () => {
  assert.equal(claveError('k'), 'editor.evolucion.error.k');
  assert.equal(claveError('sinVariantes'), 'editor.evolucion.error.sinVariantes');
  assert.equal(claveError('copias'), 'editor.probar.error.copias');
  assert.equal(claveError('alga'), 'editor.probar.error.alga');
  assert.equal(claveError('indice'), 'editor.evolucion.error.indice', 'indice: el de la evolución');
  assert.equal(claveError('otro'), null);
  assert.equal(claveError(undefined), null);
});

test('claveError: cada clave que devuelve existe en es', () => {
  for (const c of ['textos', 'sinVariantes', 'k', 'mutaciones', 'factor', 'indice']) {
    assert.ok(Object.hasOwn(ES, `editor.evolucion.error.${c}`), c);
  }
  for (const c of ['adn', 'modo', 'base', 'copias', 'ciclos', 'semillas', 'semilla', 'alga']) {
    assert.ok(Object.hasOwn(ES, `editor.probar.error.${c}`), c);
  }
});

test('comprobarRonda: acepta los valores del panel y los trunca a entero', () => {
  assert.deepEqual(comprobarRonda({ k: 8, factor: 1, mutaciones: 2 }), {
    k: 8,
    factor: 1,
    mutaciones: 2,
  });
  assert.deepEqual(comprobarRonda({ k: '7.9', factor: 16, mutaciones: 0 }), {
    k: 7,
    factor: 16,
    mutaciones: 0,
  });
});

test('comprobarRonda: rechaza k fuera de 1..16 (antes de pedir variantes), factor y modo', () => {
  const codigo = (/** @type {Record<string, unknown>} */ o) => {
    try {
      comprobarRonda({ k: 8, factor: 1, mutaciones: 2, ...o });
      return null;
    } catch (e) {
      assert.ok(e instanceof ErrorEvolucion);
      return e.codigo;
    }
  };
  assert.equal(codigo({ k: 0 }), 'k');
  assert.equal(codigo({ k: 17 }), 'k');
  assert.equal(codigo({ k: '' }), 'k');
  assert.equal(codigo({ k: null }), 'k');
  assert.equal(codigo({ factor: 0 }), 'factor');
  assert.equal(codigo({ factor: 1001 }), 'factor');
  assert.equal(codigo({ mutaciones: 3 }), 'mutaciones');
});

test('semillaAleatoria: entera en 1..SEMILLA_MAX, también en los extremos del azar', () => {
  const max = LIMITES.semilla[1];
  assert.equal(
    semillaAleatoria(() => 0),
    1,
  );
  assert.equal(
    semillaAleatoria(() => 0.999999999999),
    max,
  );
  for (let i = 0; i < 200; i++) {
    const s = semillaAleatoria();
    assert.ok(Number.isInteger(s) && s >= 1 && s <= max, `semilla ${s}`);
  }
});

test('las opciones del panel coinciden con las del motor y con los límites', () => {
  assert.deepEqual(
    TIPOS_MUTACION.map((x) => x.valor).sort(),
    [...MUTACIONES].sort(),
    'cada modo de mutación del motor tiene su opción',
  );
  assert.deepEqual([...INTENSIDADES], [1, 4, 16]);
  assert.ok(INTENSIDADES.includes(POR_DEFECTO_EVOLUCION.factor));
  assert.ok(MUTACIONES.includes(POR_DEFECTO_EVOLUCION.mutaciones));
  assert.ok(
    POR_DEFECTO_EVOLUCION.k >= LIMITES_EVOLUCION.k[0] &&
      POR_DEFECTO_EVOLUCION.k <= LIMITES_EVOLUCION.k[1],
  );
  assert.equal(POR_DEFECTO.modo, 'algas', 'la evolución corre con algas, como la prueba');
});
