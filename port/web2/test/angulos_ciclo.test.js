// @ts-check
// Robustez de lo que se muestra (N1.9): normalizarAngulo reemplaza los
// `while (x > 2π) x -= 2π` que con ±Infinity/NaN/valores enormes no
// terminaban, y cicloVisible muestra 0 en vez del −1 con que arranca el core.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arcoOjo } from '../src/lib/inspector/datos.js';
import { normalizarAngulo, PIV } from '../src/lib/mundo/render-clasico.js';
import { cicloVisible } from '../src/lib/sim/ciclo.js';

const T = PIV * 2;

/** Los bucles de antes, para comparar donde terminan. @param {number} x */
function conBucles(x) {
  while (x > T) x -= T;
  while (x < 0) x += T;
  return x;
}

test('normalizarAngulo: coincide con los bucles en valores razonables', () => {
  const casos = [
    0,
    T,
    1,
    T - 1e-9,
    T + 1e-3,
    2 * T,
    3 * T + 0.5,
    -1e-3,
    -T,
    -2 * T - 0.5,
    100,
    -100,
  ];
  for (const x of casos) {
    const a = normalizarAngulo(x);
    assert.ok(Math.abs(a - conBucles(x)) < 1e-9, `${x}: ${a} vs ${conBucles(x)}`);
  }
  // Los bordes se conservan como con los bucles.
  assert.equal(normalizarAngulo(0), 0);
  assert.equal(normalizarAngulo(T), T);
  assert.equal(normalizarAngulo(-T), 0);
  assert.equal(normalizarAngulo(2 * T), T);
});

test('normalizarAngulo: Infinity, NaN, enormes y negativos terminan en rango', () => {
  assert.equal(normalizarAngulo(Infinity), 0);
  assert.equal(normalizarAngulo(-Infinity), 0);
  assert.equal(normalizarAngulo(Number.NaN), 0);
  for (const x of [1e300, -1e300, Number.MAX_VALUE, -Number.MAX_VALUE, 1e20, -1e20, -7, -0.25]) {
    const a = normalizarAngulo(x);
    assert.ok(Number.isFinite(a) && a >= 0 && a <= T, `${x}: ${a}`);
  }
  // Con otro período (el barrido del abanico de Sentidos usa 2·Math.PI).
  const P = 2 * Math.PI;
  assert.ok(Math.abs(normalizarAngulo(-1, P) - (P - 1)) < 1e-12);
  assert.equal(normalizarAngulo(-Infinity, P), 0);
  assert.ok(normalizarAngulo(-1e300, P) < P);
});

test('arcoOjo: aim o dir no finitos o enormes dan ángulos finitos en [0, 2π]', () => {
  const ojo = { dir: 0, medio: 0.1, alcance: 1000, visto: 0 };
  for (const v of [Infinity, -Infinity, Number.NaN, 1e300, -1e300, -50]) {
    for (const a of [arcoOjo(v, 4, ojo, 30), arcoOjo(0, 4, { ...ojo, dir: v }, 30)]) {
      for (const x of [a.hi, a.lo]) {
        assert.ok(Number.isFinite(x) && x >= 0 && x <= T, `${v}: ${x}`);
      }
    }
  }
});

test('cicloVisible: el −1 inicial y lo no válido se muestran como 0', () => {
  assert.equal(cicloVisible(-1), 0);
  assert.equal(cicloVisible(-1000), 0);
  assert.equal(cicloVisible(0), 0);
  assert.equal(cicloVisible(1), 1);
  assert.equal(cicloVisible(12345.9), 12345);
  assert.equal(cicloVisible(Number.NaN), 0);
  assert.equal(cicloVisible(Infinity), 0);
  assert.equal(cicloVisible(undefined), 0);
  assert.equal(cicloVisible(null), 0);
  assert.equal(cicloVisible('7'), 7);
});
