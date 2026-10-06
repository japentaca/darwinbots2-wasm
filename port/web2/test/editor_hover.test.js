// @ts-check
// La tarjeta del manual del editor (S10 de PLAN-SITIO.md): los helpers puros
// de hover.js (la palabra bajo el cursor y su entrada del vocabulario) y los
// de lib/manual.js (el prefijo por idioma y la página de una sysvar).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entradaDe, offsetVisual, palabraBajo } from '../src/lib/bots/editor/hover.js';
import { PREFIJO_MANUAL, paginaSysvar } from '../src/lib/manual.js';

test('palabraBajo: la palabra de la posición, y nada en comentarios', () => {
  const adn = 'start\n -1 .shoot store\nstop\n';
  assert.equal(palabraBajo(adn, 0), 'start');
  assert.equal(palabraBajo(adn, 4), 'start');
  assert.equal(palabraBajo(adn, 7), '-1');
  assert.equal(palabraBajo(adn, 10), '.shoot');
  assert.equal(palabraBajo(adn, 17), 'store');
  // Sobre un espacio, la palabra de la izquierda (el límite comparte).
  assert.equal(palabraBajo(adn, 9), '-1');
  // Comentario al fin de la línea: nada, aunque la palabra sea una sysvar.
  const conComentario = "start\n-1 .shoot store ' .up\nstop\n";
  assert.equal(palabraBajo(conComentario, conComentario.indexOf('.up')), null);
  // Comentario de línea entera (empieza con /): nada.
  const conBarra = '/ .up todo comentario\n';
  assert.equal(palabraBajo(conBarra, conBarra.indexOf('.up')), null);
  // Fuera de rango y vacío.
  assert.equal(palabraBajo(adn, 999), null);
  assert.equal(palabraBajo('', 0), null);
});

test('entradaDe: sysvars y operadores del vocabulario, por nombre y por símbolo', () => {
  const vocab = {
    sysvars: { shoot: { u: 'sysvars/shoot/', t: '.shoot', r: 'Dispara.' } },
    direcciones: { 7: { u: 'sysvars/shoot/', t: '.shoot', r: 'Dispara.' } },
    operadores: {
      store: { u: 'operadores/store/', t: 'store', r: 'Guarda.' },
      '!=': { u: 'operadores/distinto/', t: '!=', r: 'Distinto.' },
    },
  };
  assert.equal(entradaDe('.shoot', vocab)?.u, 'sysvars/shoot/');
  assert.equal(entradaDe('*.shoot', vocab)?.u, 'sysvars/shoot/');
  assert.equal(entradaDe('.SHOOT', vocab)?.u, 'sysvars/shoot/');
  assert.equal(entradaDe('store', vocab)?.u, 'operadores/store/');
  assert.equal(entradaDe('Store', vocab)?.u, 'operadores/store/');
  assert.equal(entradaDe('!=', vocab)?.u, 'operadores/distinto/');
  assert.equal(entradaDe('50', vocab), null);
  assert.equal(entradaDe('.nada', vocab), null);
  assert.equal(entradaDe('.shoot', null), null);
  assert.equal(entradaDe('shoot', vocab), null, 'sin punto no es sysvar');
});

test('offsetVisual: línea y columna visual, con tabuladores cada 4', () => {
  const adn = 'start\n\t-1 .shoot store\nstop\n';
  assert.equal(offsetVisual(adn, 0, 0), 0);
  assert.equal(offsetVisual(adn, 0, 3), 3);
  // La línea 1 empieza en 6; el tabulador avanza de golpe hasta la columna
  // visual 4 (apuntar entre la 1 y la 4 cae después del tabulador).
  assert.equal(offsetVisual(adn, 1, 0), 6);
  assert.equal(offsetVisual(adn, 1, 1), 7);
  assert.equal(offsetVisual(adn, 1, 4), 7);
  assert.equal(offsetVisual(adn, 1, 6), 9);
  // La línea 2 empieza en 23.
  assert.equal(offsetVisual(adn, 2, 0), 23);
  assert.equal(offsetVisual(adn, 2, 4), 27, 'fin de la línea');
  // Línea que no existe: el fin del texto.
  assert.equal(offsetVisual(adn, 9, 0), adn.length);
  assert.equal(offsetVisual(adn, -1, 0), 0);
});

test('manual: prefijo por idioma y página de una sysvar del vocabulario', () => {
  assert.equal(PREFIJO_MANUAL('es'), 'manual/');
  assert.equal(PREFIJO_MANUAL('en'), 'en/manual/');
  const vocab = {
    sysvars: { nrg: { u: 'sysvars/nrg/', t: '.nrg', r: 'Energía.' } },
    direcciones: { 310: { u: 'sysvars/nrg/', t: '.nrg', r: 'Energía.' } },
    operadores: {},
  };
  assert.equal(paginaSysvar(vocab, '.nrg')?.u, 'sysvars/nrg/');
  assert.equal(paginaSysvar(vocab, 'nrg')?.u, 'sysvars/nrg/');
  assert.equal(paginaSysvar(vocab, '*.nrg')?.u, 'sysvars/nrg/');
  assert.equal(paginaSysvar(vocab, '310')?.u, 'sysvars/nrg/');
  assert.equal(paginaSysvar(vocab, 'nada'), null);
  assert.equal(paginaSysvar(null, '.nrg'), null);
});
