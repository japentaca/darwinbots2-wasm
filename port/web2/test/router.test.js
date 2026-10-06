// @ts-check
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consultaDe, hashCorregido, hashDe, parsearHash, SECCIONES } from '../src/router.js';

test('hash vacío o #/ → inicio', () => {
  for (const h of ['', '#', '#/', '#//', undefined, null]) {
    assert.deepEqual(parsearHash(h), { seccion: 'inicio', partes: [], consulta: {} }, String(h));
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
  assert.deepEqual(parsearHash('#/nada'), { seccion: 'inicio', partes: [], consulta: {} });
  assert.deepEqual(parsearHash('#/nada/bots'), { seccion: 'inicio', partes: [], consulta: {} });
  assert.deepEqual(parsearHash('#/Bots'), { seccion: 'inicio', partes: [], consulta: {} });
});

test('subrutas', () => {
  assert.deepEqual(parsearHash('#/bots/xyz'), {
    seccion: 'bots',
    partes: ['xyz'],
    consulta: {},
  });
  assert.deepEqual(parsearHash('#/bots/xyz/adn?x=1'), {
    seccion: 'bots',
    partes: ['xyz', 'adn'],
    consulta: { x: '1' },
  });
  assert.deepEqual(parsearHash('#/bots/Zebedee%20V2.1'), {
    seccion: 'bots',
    partes: ['Zebedee V2.1'],
    consulta: {},
  });
  assert.deepEqual(parsearHash('#/bots/%E0%A4%A'), {
    seccion: 'bots',
    partes: ['%E0%A4%A'],
    consulta: {},
  });
});

test('consulta: ?adn=… llega decodificada (la ruta de «Abrir en la app»)', () => {
  assert.deepEqual(parsearHash('#/bots/nuevo'), {
    seccion: 'bots',
    partes: ['nuevo'],
    consulta: {},
  });
  const adn = 'cond\n-6 .shoot store\nstart\nstop\nend\n';
  const r = parsearHash(`#/bots/nuevo?adn=${encodeURIComponent(adn)}`);
  assert.deepEqual(r, { seccion: 'bots', partes: ['nuevo'], consulta: { adn } });
  // Varios parámetros, y el repetido gana el último.
  assert.deepEqual(consultaDe('#/bots/nuevo?adn=a&adn=b&x=1'), { adn: 'b', x: '1' });
  // El + y el %20 son espacio; sin decodificar raro, queda tal cual.
  assert.equal(consultaDe('#/a?adn=a%20b').adn, 'a b');
  assert.equal(consultaDe('#/a?adn=a+b').adn, 'a b');
});

test('hashDe es inverso de parsearHash', () => {
  assert.equal(hashDe('inicio'), '#/');
  assert.equal(hashDe('observar'), '#/observar');
  assert.equal(hashDe('bots', 'Zebedee V2.1'), '#/bots/Zebedee%20V2.1');
  assert.deepEqual(parsearHash(hashDe('bots', 'a/b', 'c')), {
    seccion: 'bots',
    partes: ['a/b', 'c'],
    consulta: {},
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
  assert.deepEqual(parsearHash('#/nada/bots'), { seccion: 'inicio', partes: [], consulta: {} });
});
