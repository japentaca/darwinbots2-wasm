// @ts-check
// Arrastre del modo Fichas (PLAN-EDITOR E3.3, src/lib/bots/editor/arrastre.js),
// sin DOM: los eventos de puntero son objetos a mano y `elementoEn` es un
// mapa inyectado (un hueco es un elemento con dataset.hueco).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearArrastre } from '../src/lib/bots/editor/arrastre.js';

/** @param {number} id @param {number} x @param {number} y */
const ev = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y });

/** Un elemento con data-hueco = n. */
const hueco = (/** @type {number} */ n) => ({ dataset: { hueco: String(n) } });

/**
 * Un mapa de huecos: `zonas` es una lista de [x0, x1, n] (el hueco n cubre
 * x0 ≤ x < x1, en cualquier y). Fuera de todas las zonas, null.
 * @param {[number, number, number][]} zonas
 */
function huecosEn(zonas) {
  return (/** @type {number} */ x, /** @type {number} */ _y) => {
    const z = zonas.find(([x0, x1]) => x >= x0 && x < x1);
    return z ? hueco(z[2]) : null;
  };
}

const ZONAS = huecosEn([
  [0, 100, 1],
  [100, 200, 2],
  [200, 300, 0],
]);

test('arrastre: un toque sin movimiento no arranca nada y deja pasar el clic', () => {
  const llamadas = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => llamadas.push(['soltar', d, h]),
    alMarcar: (h) => llamadas.push(['marcar', h]),
  });
  a.alEmpezar(ev(1, 50, 50), 'A');
  a.alMover(ev(1, 53, 54)); // distancia 5 ≤ 6
  assert.equal(a.alSoltar(ev(1, 53, 54)), false, 'un toque no es arrastre');
  assert.deepEqual(llamadas, [], 'sin marcar ni soltar');
});

test('arrastre: el umbral es estricto (6 px no arrastra, 7 sí)', () => {
  const a = crearArrastre({ elementoEn: ZONAS });
  a.alEmpezar(ev(1, 50, 50), 'A');
  a.alMover(ev(1, 56, 50)); // exactamente 6
  assert.equal(a.estado().arrastrando, false);
  a.alMover(ev(1, 57, 50)); // 7
  assert.equal(a.estado().arrastrando, true);
});

test('arrastre: el umbral usa la distancia euclídea, no la suma de los ejes', () => {
  const a = crearArrastre({ elementoEn: ZONAS });
  a.alEmpezar(ev(1, 0, 0), 'A');
  a.alMover(ev(1, 4, 4)); // hypot(4,4) ≈ 5.66 ≤ 6: todavía no
  assert.equal(a.estado().arrastrando, false);
  a.alMover(ev(1, 5, 5)); // hypot(5,5) ≈ 7.07 > 6
  assert.equal(a.estado().arrastrando, true);
});

test('arrastre: marca el hueco bajo el puntero y suelta con él', () => {
  const marcas = [];
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alMarcar: (h) => marcas.push(h),
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.alEmpezar(ev(1, 10, 10), 'A');
  a.alMover(ev(1, 150, 10)); // hueco 2
  assert.deepEqual(marcas, [2]);
  assert.equal(a.estado().hueco, 2);
  assert.equal(a.alSoltar(ev(1, 150, 10)), true, 'el arrastre consume el gesto');
  assert.deepEqual(soltados, [['A', 2]]);
  assert.deepEqual(marcas, [2, null], 'al soltar se quita la marca');
  assert.deepEqual(a.estado(), {
    arrastrando: false,
    dato: null,
    hueco: null,
    seleccionado: null,
  });
});

test('arrastre: cambiar de hueco marca cada cambio; repetir el mismo no avisa', () => {
  const marcas = [];
  const a = crearArrastre({ elementoEn: ZONAS, alMarcar: (h) => marcas.push(h) });
  a.alEmpezar(ev(1, 10, 10), 'A');
  a.alMover(ev(1, 50, 10)); // hueco 1
  a.alMover(ev(1, 60, 10)); // sigue en el 1: sin aviso
  a.alMover(ev(1, 150, 10)); // hueco 2
  a.alMover(ev(1, 250, 10)); // hueco 0 (data-hueco="0" es válido)
  a.alMover(ev(1, 400, 10)); // fuera de todo hueco
  assert.deepEqual(marcas, [1, 2, 0, null]);
});

test('arrastre: soltar fuera de todo hueco llama alSoltar con null', () => {
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.alEmpezar(ev(1, 10, 10), 'A');
  a.alMover(ev(1, 400, 10));
  assert.equal(a.alSoltar(ev(1, 400, 10)), true);
  assert.deepEqual(soltados, [['A', null]]);
});

test('arrastre: el hueco al soltar es el de la posición de soltar, no el último movimiento', () => {
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.alEmpezar(ev(1, 10, 10), 'A');
  a.alMover(ev(1, 50, 10)); // hueco 1
  a.alSoltar(ev(1, 150, 10)); // sin movimiento intermedio: hueco 2
  assert.deepEqual(soltados, [['A', 2]]);
});

test('arrastre: el dato viaja opaco (objetos y null)', () => {
  const soltados = [];
  const dato = { tipo: 'ficha', w: '.up' };
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.alEmpezar(ev(1, 10, 10), dato);
  a.alMover(ev(1, 50, 10));
  a.alSoltar(ev(1, 50, 10));
  assert.equal(soltados[0][0], dato, 'es la misma referencia');
});

test('punteros: un segundo dedo no mueve ni suelta el arrastre del primero', () => {
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.alEmpezar(ev(1, 10, 10), 'A');
  a.alMover(ev(2, 500, 10)); // otro puntero: ignorado
  assert.equal(a.estado().arrastrando, false);
  assert.equal(a.alSoltar(ev(2, 150, 10)), false, 'soltar el otro puntero no cuenta');
  assert.deepEqual(soltados, []);
  a.alMover(ev(1, 150, 10));
  assert.equal(a.alSoltar(ev(1, 150, 10)), true);
  assert.deepEqual(soltados, [['A', 2]]);
});

test('punteros: un empezar nuevo reemplaza al pendiente anterior', () => {
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.alEmpezar(ev(1, 10, 10), 'viejo');
  a.alEmpezar(ev(2, 10, 10), 'nuevo');
  a.alMover(ev(2, 50, 10));
  a.alSoltar(ev(2, 50, 10));
  assert.deepEqual(soltados, [['nuevo', 1]]);
});

test('táctil: seleccionar y tocar un hueco suelta la ficha ahí y limpia la selección', () => {
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.seleccionar('.up');
  assert.equal(a.estado().seleccionado, '.up');
  // Toque fuera de todo hueco: no suelta y la selección sigue.
  a.alEmpezar(ev(1, 400, 10), null);
  assert.equal(a.alSoltar(ev(1, 400, 10)), false);
  assert.equal(a.estado().seleccionado, '.up');
  // Toque sobre el hueco 2: suelta.
  a.alEmpezar(ev(1, 150, 10), null);
  assert.equal(a.alSoltar(ev(1, 150, 10)), true);
  assert.deepEqual(soltados, [['.up', 2]]);
  assert.equal(a.estado().seleccionado, null);
  // Otro toque sobre un hueco ya no suelta nada.
  assert.equal(a.alSoltar(ev(1, 150, 10)), false);
  assert.deepEqual(soltados, [['.up', 2]]);
});

test('táctil: un toque sin selección sobre un hueco no suelta nada', () => {
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  assert.equal(a.alSoltar(ev(1, 150, 10)), false);
  assert.deepEqual(soltados, []);
});

test('táctil: un toque sobre un hueco que es el de un pendiente sin mover también suelta', () => {
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.seleccionar('X');
  a.alEmpezar(ev(1, 150, 10), 'paleta');
  assert.equal(a.alSoltar(ev(1, 150, 10)), true, 'el toque no llegó a arrastre');
  assert.deepEqual(soltados, [['X', 2]]);
});

test('seleccionar(null) quita la selección', () => {
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.seleccionar('.up');
  a.seleccionar(null);
  assert.equal(a.alSoltar(ev(1, 150, 10)), false);
  assert.deepEqual(soltados, []);
});

test('alCancelar: corta el arrastre sin soltar y quita la marca', () => {
  const marcas = [];
  const soltados = [];
  const a = crearArrastre({
    elementoEn: ZONAS,
    alMarcar: (h) => marcas.push(h),
    alSoltar: (d, h) => soltados.push([d, h]),
  });
  a.alEmpezar(ev(1, 10, 10), 'A');
  a.alMover(ev(1, 150, 10));
  a.alCancelar();
  assert.deepEqual(marcas, [2, null]);
  assert.equal(a.alSoltar(ev(1, 150, 10)), false);
  assert.deepEqual(soltados, []);
  assert.equal(a.estado().arrastrando, false);
});

test('estado: durante el arrastre refleja el dato y el hueco marcado', () => {
  const a = crearArrastre({ elementoEn: ZONAS });
  a.alEmpezar(ev(1, 10, 10), 'A');
  assert.equal(a.estado().dato, null, 'todavía es un toque: sin dato');
  a.alMover(ev(1, 50, 10));
  assert.deepEqual(a.estado(), {
    arrastrando: true,
    dato: 'A',
    hueco: 1,
    seleccionado: null,
  });
});

test('elementoEn sin data-hueco (o sin elemento) cuenta como fuera de huecos', () => {
  const a = crearArrastre({
    elementoEn: () => ({ dataset: {} }),
    alSoltar: () => {},
  });
  a.alEmpezar(ev(1, 10, 10), 'A');
  a.alMover(ev(1, 50, 10));
  assert.equal(a.estado().hueco, null);
  const b = crearArrastre({ elementoEn: () => null });
  b.seleccionar('.up');
  assert.equal(b.alSoltar(ev(1, 0, 0)), false);
});

test('sin DOM (node) el valor por defecto de elementoEn no falla', () => {
  const soltados = [];
  const a = crearArrastre({ alSoltar: (d, h) => soltados.push([d, h]) });
  a.alEmpezar(ev(1, 10, 10), 'A');
  a.alMover(ev(1, 50, 10));
  assert.equal(a.alSoltar(ev(1, 50, 10)), true);
  assert.deepEqual(soltados, [['A', null]]);
});
