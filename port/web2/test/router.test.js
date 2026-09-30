// @ts-check
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashCorregido, hashDe, parsearHash, SECCIONES } from '../src/router.js';

test('hash vacío o #/ → inicio', () => {
  for (const h of ['', '#', '#/', '#//', undefined, null]) {
    assert.deepEqual(parsearHash(h), { seccion: 'inicio', partes: [] }, String(h));
  }
});

test('cada sección se reconoce', () => {
  for (const s of SECCIONES) {
    assert.equal(parsearHash(`#/${s}`).seccion, s);
    assert.equal(parsearHash(`#/${s}/`).seccion, s);
  }
  assert.deepEqual(SECCIONES, [
    'inicio',
    'observar',
    'experimentar',
    'analizar',
    'bots',
    'competir',
  ]);
});

test('rutas desconocidas → inicio', () => {
  assert.deepEqual(parsearHash('#/nada'), { seccion: 'inicio', partes: [] });
  assert.deepEqual(parsearHash('#/nada/bots'), { seccion: 'inicio', partes: [] });
  assert.deepEqual(parsearHash('#/Bots'), { seccion: 'inicio', partes: [] });
});

test('subrutas', () => {
  assert.deepEqual(parsearHash('#/bots/xyz'), { seccion: 'bots', partes: ['xyz'] });
  assert.deepEqual(parsearHash('#/bots/xyz/adn?x=1'), { seccion: 'bots', partes: ['xyz', 'adn'] });
  assert.deepEqual(parsearHash('#/bots/Zebedee%20V2.1'), {
    seccion: 'bots',
    partes: ['Zebedee V2.1'],
  });
  assert.deepEqual(parsearHash('#/bots/%E0%A4%A'), { seccion: 'bots', partes: ['%E0%A4%A'] });
});

test('hashDe es inverso de parsearHash', () => {
  assert.equal(hashDe('inicio'), '#/');
  assert.equal(hashDe('observar'), '#/observar');
  assert.equal(hashDe('bots', 'Zebedee V2.1'), '#/bots/Zebedee%20V2.1');
  assert.deepEqual(parsearHash(hashDe('bots', 'a/b', 'c')), {
    seccion: 'bots',
    partes: ['a/b', 'c'],
  });
});

test('hashCorregido: desconocidas → #/, válidas → null', () => {
  for (const h of ['', '#', '#/', '#//', undefined, null]) {
    assert.equal(hashCorregido(h), null, String(h));
  }
  for (const s of SECCIONES) {
    assert.equal(hashCorregido(`#/${s}`), null, s);
    assert.equal(hashCorregido(`#/${s}/x?y=1`), null, s);
  }
  for (const h of ['#/nada', '#/nada/bots', '#/Bots', '#/%E0%A4%A', '#nada']) {
    assert.equal(hashCorregido(h), '#/', h);
  }
  // Coherente con parsearHash: lo que se corrige cae en inicio sin partes.
  assert.deepEqual(parsearHash('#/nada/bots'), { seccion: 'inicio', partes: [] });
});
