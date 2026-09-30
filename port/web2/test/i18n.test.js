// @ts-check
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpolar, normalizarIdioma, traducir } from '../src/i18n/core.js';

const dics = {
  es: { hola: 'Hola', saludo: 'Hola, {nombre}', ciclo: 'ciclo {n} de {total}', soloEs: 'Solo es' },
  en: { hola: 'Hello', saludo: 'Hello, {nombre}', ciclo: 'cycle {n} of {total}' },
};

test('t() devuelve el texto del idioma pedido', () => {
  assert.equal(traducir(dics, 'es', 'hola'), 'Hola');
  assert.equal(traducir(dics, 'en', 'hola'), 'Hello');
});

test('t() interpola params', () => {
  assert.equal(traducir(dics, 'es', 'saludo', { nombre: 'Zebedee' }), 'Hola, Zebedee');
  assert.equal(traducir(dics, 'en', 'ciclo', { n: 5, total: 10 }), 'cycle 5 of 10');
  assert.equal(interpolar('{a} y {b}', { a: 1 }), '1 y {b}');
  assert.equal(interpolar('sin params {x}'), 'sin params {x}');
});

test('t() cae al idioma fuente y luego a la clave', () => {
  assert.equal(traducir(dics, 'en', 'soloEs'), 'Solo es');
  assert.equal(traducir(dics, 'en', 'no.existe'), 'no.existe');
  assert.equal(traducir(dics, 'fr', 'hola'), 'Hola');
});

test('normalizarIdioma', () => {
  assert.equal(normalizarIdioma('en-US'), 'en');
  assert.equal(normalizarIdioma('ES'), 'es');
  assert.equal(normalizarIdioma('fr'), 'es');
  assert.equal(normalizarIdioma(undefined), 'es');
});
