// @ts-check
// Cámara del mundo (src/lib/mundo/camara.js): transformaciones mundo↔lienzo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aLienzo,
  aMundo,
  barraEscala,
  botEn,
  camaraNueva,
  centrarEn,
  cssAMundo,
  escalaBase,
  limitar,
  redimensionar,
  tolMundo,
  visible,
  ZOOM_MAX,
  zoomEn,
} from '../src/lib/mundo/camara.js';

const W = 16000;
const H = 12000;
const CW = 1000;
const CH = 500;
const cerca = (/** @type {number} */ a, /** @type {number} */ b) =>
  assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test('escala base: el campo entra entero', () => {
  const s = escalaBase(W, H, CW, CH);
  assert.equal(s, CH / H);
  assert.ok(W * s <= CW);
  assert.equal(escalaBase(0, H, CW, CH), 1);
});

test('con zoom 1 el campo queda centrado', () => {
  const s = escalaBase(W, H, CW, CH);
  const cam = limitar({ z: 1, ox: 123, oy: -40 }, s, W, H, CW, CH);
  cerca(cam.ox, (CW - W * s) / 2);
  cerca(cam.oy, 0);
  const [px, py] = aLienzo(cam, s, W / 2, H / 2);
  cerca(px, CW / 2);
  cerca(py, CH / 2);
});

test('mundo → lienzo → mundo es la identidad', () => {
  const s = escalaBase(W, H, CW, CH);
  const cam = { z: 3.7, ox: -812.5, oy: -233 };
  for (const [x, y] of [
    [0, 0],
    [W, H],
    [1234.5, 9876],
  ]) {
    const [px, py] = aLienzo(cam, s, x, y);
    const [wx, wy] = aMundo(cam, s, px, py);
    cerca(wx, x);
    cerca(wy, y);
  }
});

test('el zoom deja fijo el punto bajo el cursor', () => {
  const s = escalaBase(W, H, CW, CH);
  const cam = limitar(camaraNueva(), s, W, H, CW, CH);
  const antes = aMundo(cam, s, 700, 300);
  zoomEn(cam, 700, 300, 2.5);
  assert.equal(cam.z, 2.5);
  const despues = aMundo(cam, s, 700, 300);
  cerca(despues[0], antes[0]);
  cerca(despues[1], antes[1]);
  zoomEn(cam, 0, 0, 1e6);
  assert.equal(cam.z, ZOOM_MAX);
  zoomEn(cam, 0, 0, 1e-9);
  assert.equal(cam.z, 1);
});

test('limitar no muestra afuera del campo cuando no entra', () => {
  const s = escalaBase(W, H, CW, CH);
  const cam = limitar({ z: 4, ox: 500, oy: 500 }, s, W, H, CW, CH);
  assert.equal(cam.ox, 0);
  assert.equal(cam.oy, 0);
  limitar(Object.assign(cam, { ox: -1e9, oy: -1e9 }), s, W, H, CW, CH);
  cerca(cam.ox, CW - W * s * 4);
  cerca(cam.oy, CH - H * s * 4);
  const [x0, x1, y0, y1] = visible(cam, s, CW, CH);
  cerca(x1, W);
  cerca(y1, H);
  assert.ok(x0 > 0 && y0 > 0);
});

test('centrar en un punto lo lleva al medio del lienzo', () => {
  const s = escalaBase(W, H, CW, CH);
  const cam = { z: 8, ox: 0, oy: 0 };
  centrarEn(cam, s, 8000, 6000, CW, CH);
  const [px, py] = aLienzo(cam, s, 8000, 6000);
  cerca(px, CW / 2);
  cerca(py, CH / 2);
});

test('barra de escala: largos redondos cerca del objetivo', () => {
  // 0,05 px por unidad → 80 px ≈ 1600 u → 2000 (100 px) es el más cercano en log.
  const b = barraEscala(0.05, 80);
  assert.equal(b.unidades, 2000);
  cerca(b.px, 100);
  assert.equal(barraEscala(0.08, 80).unidades, 1000);
  assert.equal(barraEscala(1, 80).unidades, 100);
  assert.equal(barraEscala(0.016, 80).unidades, 5000);
  assert.deepEqual(barraEscala(0), { unidades: 0, px: 0 });
});

test('redimensionar conserva el punto del centro (ventana y devicePixelRatio)', () => {
  const s = escalaBase(W, H, CW, CH);
  const cam = camaraNueva();
  cam.z = 8;
  centrarEn(cam, s, 5000, 4000, CW, CH);
  limitar(cam, s, W, H, CW, CH);
  const [cx, cy] = aMundo(cam, s, CW / 2, CH / 2);
  // ventana más ancha y dpr 2 (el lienzo duplica sus píxeles)
  for (const [cw, ch] of [
    [1400, 700],
    [2800, 1400],
    [600, 900],
  ]) {
    const s2 = redimensionar(cam, W, H, CW, CH, cw, ch);
    cerca(s2, escalaBase(W, H, cw, ch));
    const [x, y] = aMundo(cam, s2, cw / 2, ch / 2);
    cerca(x, cx);
    cerca(y, cy);
    assert.equal(cam.z, 8);
    // vuelta al tamaño original para la siguiente
    redimensionar(cam, W, H, cw, ch, CW, CH);
  }
});

test('redimensionar sin tamaño anterior solo limita', () => {
  const cam = camaraNueva();
  const s = redimensionar(cam, W, H, 0, 0, CW, CH);
  cerca(s, escalaBase(W, H, CW, CH));
  cerca(cam.ox, (CW - W * s) / 2);
});

// ---- Clic: pantalla (px CSS) → mundo → bot, con distintos devicePixelRatio ----

const CAMPOS = { idx: 0, x: 1, y: 2, r: 3 };
const PASO = 4;
/** @param {number[][]} filas [idx, x, y, r] */
const registros = (filas) => Float32Array.from(filas.flat());

/**
 * Arma el lienzo como Mundo.svelte: caja de cssW × cssH px CSS, lienzo de
 * round(css · dpr) px; devuelve la cámara y la escala base.
 * @param {number} dpr @param {number} cssW @param {number} cssH
 */
function lienzoCon(dpr, cssW, cssH) {
  const cw = Math.round(cssW * dpr);
  const ch = Math.round(cssH * dpr);
  const cam = camaraNueva();
  const s = redimensionar(cam, W, H, 0, 0, cw, ch);
  return { cam, s, cw, ch };
}

/**
 * Posición CSS (relativa al lienzo) donde se dibuja el punto de mundo:
 * mundo → lienzo y de ahí a CSS dividiendo por el dpr (lo que ve el usuario).
 * @param {import('../src/lib/mundo/camara.js').Camara} cam @param {number} s
 * @param {number} dpr @param {number} wx @param {number} wy
 */
const dondeSeVe = (cam, s, dpr, wx, wy) => aLienzo(cam, s, wx, wy).map((v) => v / dpr);

for (const dpr of [0.9, 1, 1.5, 2]) {
  test(`dpr ${dpr}: el punto CSS donde se ve un punto de mundo vuelve a ese punto`, () => {
    // 1733 × 904 px CSS: el caso real con dpr 0.9 (lienzo de 1560 px de ancho)
    const { cam, s, cw } = lienzoCon(dpr, 1733, 904);
    if (dpr === 0.9) assert.equal(cw, 1560);
    for (const z of [1, 3.7]) {
      zoomEn(cam, cw / 3, 200, z / cam.z);
      for (const [wx, wy] of [
        [0, 0],
        [W / 2, H / 2],
        [1234, 9876],
        [W, H],
      ]) {
        const [x, y] = dondeSeVe(cam, s, dpr, wx, wy);
        const [mx, my] = cssAMundo(cam, s, dpr, x, y);
        cerca(mx, wx);
        cerca(my, wy);
      }
    }
  });

  test(`dpr ${dpr}: clic sobre un bot lo selecciona; al lado, no`, () => {
    const { cam, s } = lienzoCon(dpr, 1733, 904);
    const bots = registros([
      [7, 3000, 4000, 60],
      [12, 9000, 6000, 60],
      [31, 9100, 6000, 60],
    ]);
    const tol = tolMundo(6, dpr, s, cam.z);
    const clic = (/** @type {number} */ x, /** @type {number} */ y) => {
      const [wx, wy] = cssAMundo(cam, s, dpr, x, y);
      return botEn(bots, 3, PASO, CAMPOS, wx, wy, tol);
    };
    const [x7, y7] = dondeSeVe(cam, s, dpr, 3000, 4000);
    assert.equal(clic(x7, y7), 7);
    // dos bots pegados: gana el más cercano al punto
    const [x31, y31] = dondeSeVe(cam, s, dpr, 9090, 6000);
    assert.equal(clic(x31, y31), 31);
    // lejos de todos: ninguno
    const [xv, yv] = dondeSeVe(cam, s, dpr, 6000, 1000);
    assert.equal(clic(xv, yv), 0);
    // la tolerancia son 6 px de pantalla, sin importar el dpr: a 5 px CSS
    // del borde del bot todavía lo toma, a 8 px ya no
    const bordeX = dondeSeVe(cam, s, dpr, 3000 + 60, 4000)[0];
    assert.ok(bordeX - x7 < 5, 'el bot se ve más chico que la tolerancia');
    assert.equal(clic(x7 + 5, y7), 7);
    assert.equal(clic(x7 + 8, y7), 0);
  });
}

test('tolerancia del clic: TOL px de pantalla en mundo, con zoom y dpr', () => {
  cerca(tolMundo(6, 1, 0.05, 1), 120);
  cerca(tolMundo(6, 2, 0.1, 1), 120); // dpr 2 → lienzo con el doble de px
  cerca(tolMundo(6, 0.9, 0.045, 1), 120);
  cerca(tolMundo(6, 1, 0.05, 4), 30);
});

test('hit test: filas de más en el búfer no cuentan', () => {
  const bots = registros([
    [1, 100, 100, 50],
    [2, 500, 500, 50],
  ]);
  assert.equal(botEn(bots, 1, PASO, CAMPOS, 500, 500, 0), 0);
  assert.equal(botEn(bots, 2, PASO, CAMPOS, 500, 500, 0), 2);
});
