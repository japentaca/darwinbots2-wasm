// @ts-check
// Gráficos de Analizar (src/lib/analizar/grafico/*): escalas, ticks, paths,
// bandas de los tramos fundidos, simplificación por píxel y el costo de
// dibujar la historia llena (2.000 puntos × 20 especies).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Historia } from '../engine/history.js';
import { IE, IM, N_ESPECIE, N_METRICAS } from '../engine/metricas.js';
import { entrada, seriesDe } from '../src/lib/analizar/catalogo.js';
import {
  corto,
  escalaLineal,
  indiceCercano,
  pasoLindo,
  pathBanda,
  pathLinea,
  pathPunto,
  pathsApilados,
  primeroDesde,
  primeroDespues,
  reducirColumnas,
  simplificarLinea,
  ticksCiclos,
  ticksEjeY,
  ticksLindos,
  vertices,
} from '../src/lib/analizar/grafico/escala.js';
import { geometria, valoresEn } from '../src/lib/analizar/grafico/geometria.js';

test('escalaLineal: ida, vuelta y dominio vacío', () => {
  const x = escalaLineal(0, 100, 10, 210);
  assert.equal(x(0), 10);
  assert.equal(x(50), 110);
  assert.equal(x(100), 210);
  assert.equal(x.inv(110), 50);
  const y = escalaLineal(0, 10, 100, 0); // invertida (eje y)
  assert.equal(y(10), 0);
  assert.equal(y.inv(50), 5);
  assert.equal(escalaLineal(5, 5, 0, 100)(5), 50);
});

test('pasoLindo y ticksLindos: 1, 2 o 5 × 10^k, extremos hacia afuera', () => {
  assert.equal(pasoLindo(100, 4), 20);
  assert.equal(pasoLindo(100, 3), 50);
  assert.equal(pasoLindo(7, 4), 2);
  assert.equal(pasoLindo(0.3, 3), 0.1);
  assert.deepEqual(ticksLindos(0, 87, 4).ticks, [0, 20, 40, 60, 80, 100]);
  const t = ticksLindos(0, 1234, 4);
  assert.equal(t.min, 0);
  assert.ok(t.max >= 1234);
  assert.deepEqual(ticksLindos(-3, 3, 3).ticks, [-4, -2, 0, 2, 4]);
  // sin rango: no se rompe
  assert.deepEqual(ticksLindos(0, 0).ticks, [0, 1]);
  assert.ok(ticksLindos(5, 5).max > 5);
  assert.deepEqual(ticksLindos(Number.NaN, 3).ticks, [0, 1]);
});

test('ticksCiclos: dentro del dominio, sin extenderlo', () => {
  assert.deepEqual(ticksCiclos(0, 48210, 5), [0, 10000, 20000, 30000, 40000]);
  assert.deepEqual(ticksCiclos(1500, 2600, 5), [1600, 1800, 2000, 2200, 2400, 2600]);
  assert.deepEqual(ticksCiclos(7, 7), [7]);
});

test('corto: números de eje', () => {
  assert.equal(corto(0), '0');
  assert.equal(corto(48000), '48k');
  assert.equal(corto(1500), '1.5k');
  assert.equal(corto(1500000), '1.5M');
  assert.equal(corto(12.3), '12');
  assert.equal(corto(1.25), '1.3');
  assert.equal(corto(0.0123), '0.012');
  assert.equal(corto(-2500), '-2.5k');
  assert.equal(
    corto(1500, (n) => String(n).replace('.', ',')),
    '1,5k',
  );
});

test('indiceCercano y primeroDesde (búsqueda binaria)', () => {
  const t = [0, 100, 200, 400, 800];
  assert.equal(indiceCercano(t, -50), 0);
  assert.equal(indiceCercano(t, 149), 1);
  assert.equal(indiceCercano(t, 150), 1, 'empate: el anterior');
  assert.equal(indiceCercano(t, 700), 4);
  assert.equal(indiceCercano(t, 9999), 4);
  assert.equal(indiceCercano([], 5), -1);
  assert.equal(primeroDesde(t, 150), 2);
  assert.equal(primeroDesde(t, 0), 0);
  assert.equal(primeroDesde(t, 801), 5);
});

test('simplificarLinea: a lo sumo 4 vértices por columna, conserva extremos; NaN corta', () => {
  // 1.000 puntos en 10 columnas de píxel
  const xs = Array.from({ length: 1000 }, (_, i) => i / 100);
  const ys = xs.map((_, i) => (i === 555 ? 99 : i === 222 ? -99 : Math.sin(i)));
  const tr = simplificarLinea(xs, ys);
  assert.equal(tr.length, 1);
  assert.ok(tr[0].length <= 40, `${tr[0].length} vértices`);
  const yv = tr[0].map((p) => p[1]);
  assert.ok(yv.includes(99) && yv.includes(-99), 'los picos sobreviven');
  assert.deepEqual(tr[0][0], [0, ys[0]]);
  assert.deepEqual(tr[0].at(-1), [xs[999], ys[999]]);
  // en orden de x
  for (let i = 1; i < tr[0].length; i++) assert.ok(tr[0][i][0] >= tr[0][i - 1][0]);
  const cortada = simplificarLinea([0, 1, 2, 3, 4], [1, 2, Number.NaN, 3, 4]);
  assert.equal(cortada.length, 2);
  assert.equal(pathLinea([0, 10], [5, 6]), 'M0 5L10 6');
  assert.equal(pathLinea([0, 1, 2, 3], [1, Number.NaN, 2, 3]).split('M').length - 1, 2);
});

test('pathBanda: solo en los tramos con n > 1', () => {
  const xs = [0, 10, 20, 30, 40, 50];
  const lo = [9, 9, 9, 9, 9, 9];
  const hi = [1, 1, 1, 1, 1, 1];
  assert.equal(pathBanda(xs, lo, hi, [1, 1, 1, 1, 1, 1]), '');
  const d = pathBanda(xs, lo, hi, [2, 2, 2, 1, 4, 4]);
  // dos polígonos: [0..20] y [40..50]
  assert.equal(d.split('Z').length - 1, 2);
  assert.ok(d.startsWith('M0 1L10 1L20 1L20 9L10 9L0 9Z'));
  // un tramo de un solo punto no dibuja
  assert.equal(pathBanda(xs, lo, hi, [1, 1, 3, 1, 1, 1]), '');
});

test('reducirColumnas y pathsApilados: una columna por píxel, capas acumuladas', () => {
  const xs = [0, 0.5, 1, 1.2, 2];
  const r = reducirColumnas(xs, [
    [2, 4, 1, 3, 5],
    [1, Number.NaN, 1, 1, 1],
  ]);
  assert.deepEqual(r.xs, [0, 1, 2]);
  assert.deepEqual(r.capas[0], [3, 2, 5]);
  assert.deepEqual(r.capas[1], [0.5, 1, 1]);
  const Y = escalaLineal(0, 10, 100, 0);
  const ds = pathsApilados(
    [0, 10],
    [
      [2, 4],
      [3, 1],
    ],
    Y,
  );
  // capa 0: de 0 a su valor; capa 1: encima de la 0
  assert.equal(ds[0], 'M0 80L10 60L10 100L0 100Z');
  assert.equal(ds[1], 'M0 50L10 50L10 60L0 80Z');
});

test('geometria: líneas con banda, dominio recortado y valoresEn', () => {
  const s = {
    clave: 'a',
    nombre: 'A',
    color: '#000',
    t: [0, 100, 200, 300],
    v: [10, 20, 30, 40],
    min: [5, 20, 30, 40],
    max: [15, 20, 30, 40],
    n: [2, 1, 1, 1],
  };
  const g = geometria({ series: [s], modo: 'lineas', ancho: 400, alto: 200 });
  assert.equal(g.vacio, false);
  assert.equal(g.c0, 0);
  assert.equal(g.c1, 300);
  assert.ok(g.yt[0].v === 0 && g.yt.at(-1)?.v >= 40);
  assert.ok(g.capas[0].d.startsWith('M40 '));
  assert.equal(g.capas[0].banda, '', 'un solo punto fundido no hace banda');
  const g2 = geometria({ series: [s], modo: 'lineas', ancho: 400, alto: 200, dominio: [150, 300] });
  assert.equal(g2.c0, 150);
  // entra el punto anterior (100) para que la línea llegue al borde
  assert.equal(vertices(g2.capas[0].d), 3);
  const v = valoresEn([s], 90);
  assert.deepEqual(v, {
    ciclo: 100,
    filas: [{ clave: 'a', nombre: 'A', color: '#000', v: 20, min: null, max: null }],
  });
  assert.deepEqual(valoresEn([s], 0)?.filas[0].min, 5);
  assert.equal(geometria({ series: [], modo: 'lineas', ancho: 400, alto: 200 }).vacio, true);
});

test('geometria: apilado con eje desde 0 hasta la suma', () => {
  const t = [0, 100, 200];
  const g = geometria({
    series: [
      { clave: 'a', nombre: 'A', color: '#111', t, v: [10, 20, 30] },
      { clave: 'b', nombre: 'B', color: '#222', t, v: [5, Number.NaN, 25] },
    ],
    modo: 'apilado',
    ancho: 300,
    alto: 120,
  });
  assert.equal(g.yt[0].v, 0);
  assert.ok(/** @type {number} */ (g.yt.at(-1)?.v) >= 55);
  assert.equal(g.capas.length, 2);
  assert.ok(g.capas.every((c) => c.d.endsWith('Z')));
});

/**
 * Historia llena: `puntos` muestras × `especies` especies (vivos, genMedia).
 * @param {number} puntos @param {number} especies
 */
function historiaLlena(puntos, especies) {
  const h = new Historia({ maxPuntos: 2000 });
  for (let k = 0; k < puntos; k++) {
    const metrics = new Float32Array(N_METRICAS);
    metrics[IM.ciclo] = k * 100;
    metrics[IM.vivos] = 200 + 50 * Math.sin(k / 30);
    metrics[IM.adnMedia] = 100 + k / 10;
    h.agregar({
      ciclo: k * 100,
      metrics,
      especies: Array.from({ length: especies }, (_, e) => {
        const stats = new Float32Array(N_ESPECIE);
        stats[IE.vivos] = 10 + 8 * Math.sin(k / (7 + e)) + e;
        stats[IE.genMedia] = k / 10 + e;
        stats[IE.adnMedia] = 100 + ((k * (e + 1)) % 37);
        return { nombre: `Bot ${e}.txt`, stats };
      }),
    });
  }
  return h;
}

test('rendimiento: 2.000 puntos × 20 especies se dibujan con O(ancho) vértices', () => {
  // 3.000 muestras: la historia funde la mitad vieja (hay bandas) y queda ≤ 2.000 puntos
  const h = historiaLlena(3000, 20);
  assert.ok(h.puntos <= 2000 && h.puntos > 1000, `${h.puntos} puntos`);
  const ancho = 460;
  const casos = [
    ['e:vivos', 'apilado'],
    ['e:genMedia', 'lineas'],
    ['e:adnMedia', 'lineas'],
    ['g:vivos', 'lineas'],
  ];
  const t0 = performance.now();
  let total = 0;
  for (const [id, modo] of casos) {
    const e = /** @type {any} */ (entrada(id));
    assert.equal(e.modo, modo);
    const series = seriesDe(h, e, {
      colores: {},
      nombreGlobal: 'x',
      otras: 'Otras',
      maxEspecies: 20,
    });
    const g = geometria({ series, modo: e.modo, ancho, alto: 200 });
    let v = 0;
    let lineas = 0;
    for (const c of g.capas) {
      v += vertices(c.d) + vertices(c.banda);
      lineas += vertices(c.d);
    }
    total += v;
    const puntosCrudos = series.reduce((s, x) => s + x.t.length, 0);
    // apilado: ≤ 2 vértices por columna y capa; líneas: ≤ 4 (+ la banda, ≤ 2)
    const cota = series.length * (ancho - 40) * (modo === 'apilado' ? 2 : 6);
    assert.ok(v <= cota, `${id}: ${v} vértices (cota ${cota})`);
    // la simplificación se mide en el trazo (la banda suma hasta 2 por columna aparte)
    const trazo = modo === 'apilado' ? v : lineas;
    assert.ok(
      trazo < puntosCrudos * (modo === 'apilado' ? 2 : 1),
      `${id}: simplifica (${trazo} < ${puntosCrudos})`,
    );
    if (e.fuente !== 'g') assert.equal(series.length, 20);
  }
  const ms = performance.now() - t0;
  console.log(`# vértices de los 4 gráficos: ${total} · ${ms.toFixed(0)} ms`);
  assert.ok(ms < 1500, `${ms.toFixed(0)} ms`);
});

test('rendimiento: con 8 especies por gráfico el resto va en «Otras»', () => {
  const h = historiaLlena(300, 20);
  const s = seriesDe(h, /** @type {any} */ (entrada('e:vivos')), {
    colores: { 'Bot 19': '#123456' },
    nombreGlobal: 'x',
    otras: 'Otras',
  });
  assert.equal(s.length, 9);
  assert.equal(s.at(-1)?.nombre, 'Otras');
  // la más importante primero (la de más bots: Bot 19) con su color
  assert.equal(s[0].nombre, 'Bot 19');
  assert.equal(s[0].color, '#123456');
});

test('M2: un tramo de un solo punto se dibuja (círculo) y un apilado de 1 columna se ve', () => {
  // valor aislado entre ausencias: 3 tramos, el del medio es un punto
  const d = pathLinea([0, 10, 20, 30, 40], [5, 5, Number.NaN, 7, Number.NaN]);
  assert.equal(d, `M0 5L10 5${pathPunto(30, 7)}`);
  assert.match(pathPunto(30, 7), /^M[\d.]+ 7a/);
  const Y = escalaLineal(0, 10, 100, 0);
  const [capa] = pathsApilados([50], [[4]], Y);
  assert.equal(capa, 'M48.5 60L51.5 60L51.5 100L48.5 100Z', 'franja de 3 px');
  // geometría: una sola muestra en el dominio
  const g = geometria({
    series: [{ clave: 'a', nombre: 'A', color: '#000', t: [500], v: [3] }],
    modo: 'lineas',
    ancho: 300,
    alto: 120,
  });
  assert.equal(g.vacio, false);
  assert.ok(g.capas[0].d.includes('a'), 'círculo');
  assert.ok(Math.abs(/** @type {any} */ (g.X)(500) - (g.x0 + g.x1) / 2) < 0.01, 'al centro');
});

test('I2: con dominio se usa tal cual (gráficos alineados aunque la serie empiece después)', () => {
  const s = { clave: 'a', nombre: 'A', color: '#000', t: [2000, 3000], v: [1, 2] };
  const g = geometria({ series: [s], modo: 'lineas', ancho: 400, alto: 200, dominio: [0, 5000] });
  assert.equal(g.c0, 0);
  assert.equal(g.c1, 5000);
  const ap = geometria({ series: [s], modo: 'apilado', ancho: 400, alto: 200, dominio: [0, 5000] });
  assert.equal(ap.c0, 0);
  assert.equal(primeroDespues([0, 100, 100, 200], 100), 3);
  assert.equal(primeroDespues([0, 100], 500), 2);
});

test('M6: el punto previo al dominio entra en el trazo, no en la escala ni en el tooltip', () => {
  const s = {
    clave: 'a',
    nombre: 'A',
    color: '#000',
    t: [0, 100, 200, 300],
    v: [1000, 10, 12, 11],
  };
  const g = geometria({ series: [s], modo: 'lineas', ancho: 400, alto: 200, dominio: [150, 300] });
  assert.ok(/** @type {number} */ (g.yt.at(-1)?.v) < 100, 'el 1000 de t=100 no escala');
  assert.equal(vertices(g.capas[0].d), 3, 'pero la línea llega al borde');
  assert.equal(valoresEn([s], 150, [150, 300])?.ciclo, 200, 'tooltip: solo dentro');
  assert.equal(valoresEn([s], 150)?.ciclo, 100, 'sin dominio, el más cercano');
  assert.equal(g.resumen?.max, 12);
  // apilado: el tope tampoco cuenta el punto previo
  const ap = geometria({
    series: [{ ...s, v: [1000, 10, 12, 11] }],
    modo: 'apilado',
    ancho: 400,
    alto: 200,
    dominio: [150, 300],
  });
  assert.ok(/** @type {number} */ (ap.yt.at(-1)?.v) < 100);
});

test('O2: eje Y de líneas ajustado si el rango es chico; desde 0 en conteos y apilados', () => {
  // positivos con rango chico: sin forzar 0, con margen
  const a = ticksEjeY(100, 136, false);
  assert.ok(a.min > 0 && a.min <= 100 && a.max >= 136, JSON.stringify(a));
  // conteo: desde 0
  assert.equal(ticksEjeY(100, 136, true).min, 0);
  // rango amplio: desde 0
  assert.equal(ticksEjeY(5, 40, false).min, 0);
  // negativos: tal cual
  assert.ok(ticksEjeY(-5, 3, false).min <= -5);
  // constante: no colapsa
  const c = ticksEjeY(50, 50, false);
  assert.ok(c.min < 50 && c.max > 50);
  const s = { clave: 'a', nombre: 'A', color: '#000', t: [0, 100], v: [100, 136] };
  const libre = geometria({ series: [s], modo: 'lineas', ancho: 300, alto: 150 });
  assert.ok(libre.yt[0].v > 0);
  const cero = geometria({ series: [s], modo: 'lineas', ancho: 300, alto: 150, cero: true });
  assert.equal(cero.yt[0].v, 0);
  const ap = geometria({ series: [s], modo: 'apilado', ancho: 300, alto: 150 });
  assert.equal(ap.yt[0].v, 0);
});

test('O1: resumen para el aria-label (último, mínimo y máximo dentro del dominio)', () => {
  const t = [0, 100, 200, 300];
  const a = { clave: 'a', nombre: 'A', color: '#000', t, v: [4, 9, Number.NaN, 6] };
  const b = { clave: 'b', nombre: 'B', color: '#111', t, v: [1, 1, 2, Number.NaN] };
  const li = geometria({ series: [a, b], modo: 'lineas', ancho: 300, alto: 150 });
  assert.deepEqual(li.resumen, { nombre: 'A', ultimo: 6, min: 4, max: 9, series: 2 });
  const ap = geometria({ series: [a, b], modo: 'apilado', ancho: 300, alto: 150 });
  assert.deepEqual(ap.resumen, { nombre: null, ultimo: 6, min: 2, max: 10, series: 2 });
  const rec = geometria({
    series: [a],
    modo: 'lineas',
    ancho: 300,
    alto: 150,
    dominio: [50, 300],
  });
  assert.equal(rec.resumen?.min, 6, 'el 4 de t=0 queda fuera');
  assert.equal(geometria({ series: [], modo: 'lineas', ancho: 300, alto: 150 }).resumen, null);
});
