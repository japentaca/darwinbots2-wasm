// @ts-check
// Detectores del resumen automático (engine/detectors.js; decisión 11 y
// criterio de cierre del Nivel 2): series armadas a mano, casos en que NO
// escriben nada y bordes (historia vacía, una muestra, huecos, especies que
// aparecen tarde, puntos fundidos).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AGRUPACION,
  agruparHallazgos,
  CLAVES_AGRUPADAS,
  CLAVES_HALLAZGO,
  detectar,
  detectarColapso,
  detectarCrecimientoAdn,
  detectarDominio,
  detectarExtincion,
  esVegetal,
  FIGURAS,
  UMBRALES,
} from '../engine/detectors.js';
import { Historia } from '../engine/history.js';
import { ciclos, historiaDe } from './util/historia-sintetica.js';

/** @param {number} n @param {(i: number) => number | null} f */
const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/** Ruido determinista en [0, 1) (hash de i). @param {number} i */
const ruido = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** @param {import('../engine/detectors.js').Hallazgo} x */
function formaValida(x) {
  assert.ok(
    ['dominio', 'colapso', 'extincion', 'adn', 'sustitucion', 'oscilacion'].includes(x.tipo),
  );
  assert.ok(CLAVES_HALLAZGO.includes(x.clave), x.clave);
  assert.ok(Object.values(FIGURAS).includes(x.figura));
  assert.ok(['info', 'aviso', 'alta'].includes(x.severidad));
  assert.ok(x.desde <= x.hasta);
  for (const v of Object.values(x.params))
    assert.ok(typeof v === 'string' || Number.isFinite(v), `param ${v}`);
}

// ---- bordes comunes ----------------------------------------------------------

test('historia vacía: ningún detector escribe', () => {
  const h = new Historia();
  assert.deepEqual(detectar(h), []);
  assert.deepEqual(detectarDominio(h), []);
  assert.deepEqual(detectarColapso(h), []);
  assert.deepEqual(detectarExtincion(h), []);
  assert.deepEqual(detectarCrecimientoAdn(h), []);
});

test('una sola muestra: ningún detector escribe', () => {
  const h = historiaDe({ t: [0], especies: { A: [80], B: [5] }, adn: [100] });
  assert.deepEqual(detectar(h), []);
});

test('corrida estable (sin cambios): no escribe nada', () => {
  const n = 200;
  const h = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30), B: serie(n, () => 30), Alga: serie(n, () => 60) },
    vegetales: ['Alga'],
    adn: serie(n, (i) => 150 + (i % 3)),
  });
  assert.deepEqual(detectar(h), []);
});

// ---- dominio -----------------------------------------------------------------

test('dominio: una especie sobre el 50 % durante más de 5000 ciclos', () => {
  const n = 200; // 0..19.900
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i >= 50 && i < 150 ? 80 : 20)),
      B: serie(n, () => 20),
    },
  });
  const r = detectarDominio(h);
  assert.equal(r.length, 1);
  formaValida(r[0]);
  assert.equal(r[0].params.especie, 'A');
  assert.equal(r[0].desde, 5000);
  assert.equal(r[0].hasta, 14900);
  assert.equal(r[0].params.max, 80);
  assert.equal(r[0].figura, FIGURAS.especies);
});

test('dominio: no escribe si el período es corto, la especie está sola o son vegetales', () => {
  const n = 200;
  const corto = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => (i >= 50 && i < 80 ? 80 : 20)), B: serie(n, () => 20) },
  });
  assert.deepEqual(detectarDominio(corto), [], '3000 ciclos < 5000');
  const sola = historiaDe({ t: ciclos(n), especies: { A: serie(n, () => 50) } });
  assert.deepEqual(detectarDominio(sola), [], 'una sola especie');
  const conAlgas = historiaDe({
    t: ciclos(n),
    especies: { Alga: serie(n, () => 500), A: serie(n, () => 20), B: serie(n, () => 20) },
    vegetales: ['Alga'],
  });
  assert.deepEqual(detectarDominio(conAlgas), [], 'los vegetales no cuentan');
  assert.equal(detectarDominio(conAlgas, { contarVegetales: true }).length, 1);
  const chica = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 6), B: serie(n, () => 1) },
  });
  assert.deepEqual(detectarDominio(chica), [], 'población por debajo de minPoblacion');
  assert.equal(detectarDominio(chica, { minPoblacion: 1 }).length, 1);
});

test('dominio: umbral configurable y tolerancia a un punto por debajo', () => {
  const n = 200;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i === 100 ? 20 : i >= 20 && i < 180 ? 70 : 20)),
      B: serie(n, () => 30),
    },
  });
  const r = detectarDominio(h);
  assert.equal(r.length, 1, 'un hueco de un punto no corta el período');
  assert.equal(detectarDominio(h, { tolerancia: 0 }).length, 2);
  assert.deepEqual(detectarDominio(h, { umbral: 0.75 }), []);
});

// ---- colapso -----------------------------------------------------------------

test('colapso: caída brusca de la población total', () => {
  const n = 100;
  const total = serie(n, (i) => (i < 40 ? 200 : i < 45 ? 200 - (i - 39) * 35 : 25));
  const h = historiaDe({ t: ciclos(n), especies: { A: total } });
  const r = detectarColapso(h);
  assert.equal(r.length, 1);
  formaValida(r[0]);
  assert.equal(r[0].params.de, 200);
  assert.equal(r[0].params.a, 25);
  assert.equal(r[0].params.caida, 88);
  assert.equal(r[0].desde, 3900);
  assert.equal(r[0].hasta, 4400);
  assert.equal(r[0].severidad, 'alta');
  assert.equal(r[0].figura, FIGURAS.total);
});

test('colapso: no escribe si la caída es lenta, chica o parte de una población mínima', () => {
  const n = 300;
  const lenta = historiaDe({ t: ciclos(n), especies: { A: serie(n, (i) => 300 - i) } });
  assert.deepEqual(detectarColapso(lenta), [], 'baja 1 bot cada 100 ciclos');
  const chica = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => (i < 100 ? 100 : 70)) },
  });
  assert.deepEqual(detectarColapso(chica), [], '30 % < 50 %');
  assert.equal(detectarColapso(chica, { caida: 0.25 }).length, 1);
  const minima = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => (i < 100 ? 25 : 1)) },
  });
  assert.deepEqual(detectarColapso(minima), [], 'pico por debajo de minPico');
});

test('colapso: dos caídas separadas son dos hallazgos; huecos en la serie global', () => {
  const n = 200;
  const total = serie(n, (i) => (i < 50 ? 100 : i < 100 ? 30 : i < 150 ? 120 : 20));
  const h = historiaDe({
    t: ciclos(n),
    especies: { A: total },
    total: total.map((v, i) => (i % 17 === 5 ? null : v)),
  });
  const r = detectarColapso(h, { serie: 'vivos' });
  assert.equal(detectarColapso(h).length, 2, 'la serie por defecto (no vegetales) da lo mismo');
  assert.equal(r.length, 2);
  assert.ok(r[0].hasta < r[1].desde);
  assert.equal(r[1].severidad, 'alta');
});

test('colapso: historia fundida de 400.000 ciclos (maxPuntos 200): una caída 200→25 en 500 ciclos se detecta', () => {
  const n = 4001; // 0..400.000, una muestra cada 100
  const t = ciclos(n);
  const g = {
    t,
    especies: {
      A: t.map((c) => (c < 250000 ? 200 : c >= 250500 ? 25 : 200 - ((c - 250000) / 500) * 175)),
      Alga: serie(n, () => 50),
    },
    vegetales: ['Alga'],
    opciones: { maxPuntos: 200 },
  };
  const h = historiaDe(g);
  assert.ok(h.puntos <= 200, `${h.puntos} puntos`);
  const vivos = /** @type {import('../engine/history.js').Serie} */ (h.serie('noVegetales'));
  const paso = Math.max(...vivos.t.slice(1).map((c, j) => c - vivos.t[j]));
  assert.ok(paso > UMBRALES.colapso.ventanaCiclos, `puntos de hasta ${paso} ciclos`);
  const r = detectarColapso(h);
  assert.equal(r.length, 1);
  formaValida(r[0]);
  assert.equal(r[0].params.de, 200);
  assert.equal(r[0].params.a, 25);
  assert.ok(r[0].desde <= 250000 && r[0].hasta >= 250500, `${r[0].desde}–${r[0].hasta}`);
  assert.equal(r[0].severidad, 'alta');
});

test('colapso: la oscilación de las algas (repoblación) no es un colapso', () => {
  const n = 400;
  // las algas se comen hasta desaparecer y se reponen, cada 8.000 ciclos
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      Alga: serie(n, (i) => (i % 80 < 40 ? 300 : i % 80 < 42 ? 20 : null)),
      A: serie(n, () => 40),
      B: serie(n, () => 25),
    },
    vegetales: ['Alga'],
  });
  assert.deepEqual(detectarColapso(h), []);
  assert.ok(!detectar(h).some((x) => x.tipo === 'colapso'));
  // sobre el total (con las algas), la misma corrida sí «colapsaría»
  assert.ok(detectarColapso(h, { serie: 'vivos' }).length > 0);
});

test('colapso: una población chica y ruidosa no da falsos colapsos', () => {
  const n = 2000;
  for (const [lo, hi] of [
    [3, 40],
    [0, 60],
    [10, 80],
  ]) {
    const h = historiaDe({
      t: ciclos(n),
      especies: { A: serie(n, (i) => Math.round(lo + ruido(i + lo) * (hi - lo))) },
    });
    assert.deepEqual(detectarColapso(h), [], `ruido ${lo}–${hi}`);
    const f = historiaDe({
      t: ciclos(n),
      especies: { A: serie(n, (i) => Math.round(lo + ruido(i + hi) * (hi - lo))) },
      opciones: { maxPuntos: 150 },
    });
    assert.deepEqual(detectarColapso(f), [], `ruido ${lo}–${hi}, fundida`);
  }
  // un pozo de un punto tampoco es un colapso
  const pozo = historiaDe({
    t: ciclos(300),
    especies: { A: serie(300, (i) => (i === 150 ? 5 : 120)) },
  });
  assert.deepEqual(detectarColapso(pozo), []);
  // y un colapso real con el mismo ruido sí se encuentra
  const real = historiaDe({
    t: ciclos(600),
    especies: {
      A: serie(600, (i) => Math.round((i < 300 ? 150 : 20) * (0.7 + 0.6 * ruido(i)))),
    },
  });
  assert.equal(detectarColapso(real).length, 1);
});

// ---- extinción ---------------------------------------------------------------

test('extinción: llega a 0 y no vuelve', () => {
  const n = 100;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, () => 30),
      B: serie(n, (i) => (i < 60 ? 10 + (i === 20 ? 25 : 0) : null)),
    },
  });
  const r = detectarExtincion(h);
  assert.equal(r.length, 1);
  formaValida(r[0]);
  assert.deepEqual(r[0].params, { especie: 'B', ciclo: 6000, pico: 35, cicloPico: 2000 });
  assert.equal(r[0].clave, 'extincion');
});

test('extinción: una ausencia corta no cuenta; la que vuelve después de N muestras sí (retorno)', () => {
  const n = 100;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, () => 30),
      B: serie(n, (i) => (i >= 20 && i < 23 ? null : 10)),
      C: serie(n, (i) => (i >= 20 && i < 40 ? null : 10)),
    },
  });
  const r = detectarExtincion(h);
  assert.equal(r.length, 1, 'B falta 3 muestras (< 5)');
  assert.equal(r[0].params.especie, 'C');
  assert.equal(r[0].clave, 'extincion.retorno');
  assert.equal(r[0].params.vuelve, 4000);
  assert.equal(detectarExtincion(h, { muestras: 2 }).length, 2);
});

test('extinción: la repoblación de vegetales no es extinción; sí si no vuelve nunca', () => {
  const n = 100;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      Alga: serie(n, (i) => (i >= 30 && i < 60 ? null : 40)),
      Musgo: serie(n, (i) => (i < 70 ? 40 : null)),
    },
    vegetales: ['Alga', 'Musgo'],
  });
  assert.ok(esVegetal(h, 'Alga'));
  const r = detectarExtincion(h);
  assert.deepEqual(
    r.map((x) => x.params.especie),
    ['Musgo'],
  );
  assert.equal(detectarExtincion(h, { ignorarRepoblacion: false }).length, 2);
});

test('extinción: una especie que aparece tarde no está extinta antes de aparecer', () => {
  const n = 100;
  const h = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30), Tarde: serie(n, (i) => (i < 70 ? null : 12)) },
  });
  assert.deepEqual(detectarExtincion(h), []);
});

test('extinción: se extingue cerca del final sin llegar a N muestras → no escribe', () => {
  const n = 100;
  const h = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30), B: serie(n, (i) => (i < 97 ? 10 : null)) },
  });
  assert.deepEqual(detectarExtincion(h), []);
  assert.equal(detectarExtincion(h, { muestras: 3 }).length, 1);
});

// ---- ADN ---------------------------------------------------------------------

test('ADN: tendencia sostenida hacia arriba y hacia abajo', () => {
  const n = 200;
  const sube = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30) },
    adn: serie(n, (i) => 180 + i * 0.3 + (i % 5) - 2),
  });
  const r = detectarCrecimientoAdn(sube);
  assert.equal(r.length, 1);
  formaValida(r[0]);
  assert.equal(r[0].clave, 'adn.crecimiento');
  assert.ok(Number(r[0].params.cambio) >= 20);
  assert.equal(r[0].figura, FIGURAS.adn);
  const baja = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30) },
    adn: serie(n, (i) => 300 - i),
  });
  const b = detectarCrecimientoAdn(baja);
  assert.equal(b.length, 1);
  assert.equal(b[0].clave, 'adn.reduccion');
});

test('ADN: no escribe con ruido sin tendencia, cambio chico, un salto aislado o pocas muestras', () => {
  const n = 200;
  const ruido = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30) },
    adn: serie(n, (i) => 200 + ((i * 37) % 60) - 30),
  });
  assert.deepEqual(detectarCrecimientoAdn(ruido), []);
  const chico = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30) },
    adn: serie(n, (i) => 200 + i * 0.1),
  });
  assert.deepEqual(detectarCrecimientoAdn(chico), [], '+10 % < 20 %');
  assert.equal(detectarCrecimientoAdn(chico, { cambio: 0.05 }).length, 1);
  const pocas = historiaDe({
    t: ciclos(5),
    especies: { A: [1, 1, 1, 1, 1] },
    adn: [100, 150, 200, 250, 300],
  });
  assert.deepEqual(detectarCrecimientoAdn(pocas), [], 'menos de minMuestras');
  const salto = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30) },
    adn: serie(n, (i) => (i === n - 1 ? 900 : 200)),
  });
  assert.deepEqual(detectarCrecimientoAdn(salto), [], 'un punto aislado no es tendencia');
});

test('ADN: huecos (NaN) en la serie no rompen el detector', () => {
  const n = 200;
  const h = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30) },
    adn: serie(n, (i) => (i % 10 === 3 ? null : 150 + i)),
  });
  assert.equal(detectarCrecimientoAdn(h).length, 1);
});

// ---- ADN por especie -----------------------------------------------------------

test('ADN: un cambio de composición sin cambio de ADN no es crecimiento', () => {
  const n = 200;
  // A (ADN 100) pasa de 80 a 20 bots y B (ADN 200) de 20 a 80: la media
  // global sube de 120 a 180 (+50 %), pero ninguna especie cambió su ADN
  const a = serie(n, (i) => Math.round(80 - (60 * i) / (n - 1)));
  const b = serie(n, (i) => Math.round(20 + (60 * i) / (n - 1)));
  const global = a.map(
    (x, i) => (100 * Number(x) + 200 * Number(b[i])) / (Number(x) + Number(b[i])),
  );
  const h = historiaDe({
    t: ciclos(n),
    especies: { A: a, B: b },
    adn: global,
    adnEspecie: { A: serie(n, () => 100), B: serie(n, () => 200) },
  });
  assert.deepEqual(detectarCrecimientoAdn(h), []);
  // el mismo cambio de composición con A alargando su ADN (100 → 299) sí lo es
  const crece = historiaDe({
    t: ciclos(n),
    especies: { A: a, B: b },
    adn: global,
    adnEspecie: { A: serie(n, (i) => 100 + i), B: serie(n, () => 200) },
  });
  const r = detectarCrecimientoAdn(crece);
  assert.equal(r.length, 1);
  formaValida(r[0]);
  assert.equal(r[0].clave, 'adn.crecimiento');
  assert.ok(Number(r[0].params.cambio) >= 20 && Number(r[0].params.cambio) < 199);
});

test('ADN: reemplazo de especie (una de ADN largo desplaza a una de ADN corto) no es crecimiento', () => {
  const n = 300;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      Corta: serie(n, (i) => (i < 150 ? 60 - Math.floor(i / 3) : null)),
      Larga: serie(n, (i) => (i < 100 ? null : 5 + Math.min(55, i - 100))),
      Alga: serie(n, () => 80),
    },
    vegetales: ['Alga'],
    adnEspecie: {
      Corta: serie(n, () => 80),
      Larga: serie(n, () => 300),
      Alga: serie(n, (i) => 20 + i), // los vegetales no cuentan
    },
  });
  assert.deepEqual(detectarCrecimientoAdn(h), []);
  // si la especie nueva además alarga su ADN, se ve
  const h2 = historiaDe({
    t: ciclos(n),
    especies: {
      Corta: serie(n, (i) => (i < 150 ? 60 - Math.floor(i / 3) : null)),
      Larga: serie(n, (i) => (i < 100 ? null : 5 + Math.min(55, i - 100))),
    },
    adnEspecie: {
      Corta: serie(n, () => 80),
      Larga: serie(n, (i) => (i < 100 ? null : 300 + (i - 100))),
    },
  });
  const r = detectarCrecimientoAdn(h2);
  assert.equal(r.length, 1);
  assert.equal(r[0].clave, 'adn.crecimiento');
});

// ---- dominio sobre todo el período --------------------------------------------

test('dominio: la participación media cuenta los puntos del período en que la especie falta', () => {
  const n = 200;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      // del punto 21 al 79 domina con el 90 %, pero falta uno de cada tres
      A: serie(n, (i) => (i >= 20 && i < 80 ? (i % 3 === 2 ? null : 90) : 10)),
      B: serie(n, () => 10),
    },
  });
  const r = detectarDominio(h);
  assert.equal(r.length, 1);
  assert.equal(r[0].params.max, 90);
  assert.equal(r[0].desde, 2100);
  assert.equal(r[0].hasta, 7900);
  assert.equal(r[0].params.media, 61, '40 puntos al 90 % y 19 en 0: 61 %, no 90 %');
});

// ---- agrupación del resumen ------------------------------------------------------

test('agrupar: 12 extinciones simultáneas son una sola frase', () => {
  const n = 200;
  /** @type {Record<string, (number | null)[]>} */
  const especies = { Grande: serie(n, () => 300) };
  for (let k = 1; k <= 12; k++) especies[`Bot ${k}`] = serie(n, (i) => (i < 100 ? 5 + k : null));
  const h = historiaDe({ t: ciclos(n), especies, vegetales: ['Grande'] });
  const hallazgos = detectar(h);
  assert.equal(hallazgos.filter((x) => x.tipo === 'extincion').length, 12);
  const r = agruparHallazgos(hallazgos);
  const ext = r.filter((x) => x.tipo === 'extincion');
  assert.equal(ext.length, 1);
  assert.equal(ext[0].clave, 'extincion.grupoCiclo');
  assert.equal(ext[0].params.n, 12);
  assert.equal(ext[0].params.ciclo, 10000);
  assert.equal(ext[0].params.ejemplos, 'Bot 12, Bot 11, Bot 10, …', 'las de pico más alto');
  assert.equal(ext[0].hallazgos?.length, 12);
  assert.equal(ext[0].figura, FIGURAS.especies);
  assert.ok(CLAVES_AGRUPADAS.includes(ext[0].clave));
  // escalonadas (cada 1.000 ciclos) también se juntan, con su rango
  /** @type {Record<string, (number | null)[]>} */
  const esc = { Grande: serie(n, () => 300) };
  for (let k = 1; k <= 5; k++) esc[`E${k}`] = serie(n, (i) => (i < 90 + 10 * k ? 8 : null));
  const r2 = agruparHallazgos(
    detectar(historiaDe({ t: ciclos(n), especies: esc, vegetales: ['Grande'] })),
  );
  assert.deepEqual(
    r2.filter((x) => x.tipo === 'extincion').map((x) => [x.clave, x.params.desde, x.params.hasta]),
    [['extincion.grupo', 10000, 14000]],
  );
  // dos no alcanzan para agrupar
  const pocas = detectar(
    historiaDe({
      t: ciclos(n),
      especies: {
        Grande: serie(n, () => 300),
        X: serie(n, (i) => (i < 100 ? 9 : null)),
        Y: serie(n, (i) => (i < 100 ? 9 : null)),
      },
    }),
  );
  assert.deepEqual(agruparHallazgos(pocas), pocas);
});

test('agrupar: una especie esporádica de 1 bot no escribe una frase por vuelta', () => {
  const n = 300;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, () => 30),
      // aparece con un bot cada 12 puntos, 17 veces, y después no vuelve
      Rara: serie(n, (i) => (i < 204 && i % 12 === 0 ? 1 : null)),
    },
  });
  const hallazgos = detectar(h);
  const deRara = hallazgos.filter((x) => x.params.especie === 'Rara');
  assert.equal(deRara.length, 17, '16 retornos y la extinción final');
  const r = agruparHallazgos(hallazgos);
  assert.equal(r.length, 1);
  assert.equal(r[0].clave, 'extincion.intermitenteFin');
  assert.deepEqual(r[0].params, { especie: 'Rara', veces: 16, desde: 100, hasta: 19300 });
  assert.equal(r[0].hallazgos?.length, 17);
});

test('agrupar: tope de frases por tipo, con una que resume el resto', () => {
  const n = 600;
  /** @type {Record<string, (number | null)[]>} */
  const especies = { Grande: serie(n, () => 300) };
  // 8 extinciones separadas por 5.000 ciclos (no se agrupan por cercanía)
  for (let k = 1; k <= 8; k++) especies[`S${k}`] = serie(n, (i) => (i < 50 * k ? 10 + k : null));
  const hallazgos = detectar(historiaDe({ t: ciclos(n), especies, vegetales: ['Grande'] }));
  assert.equal(hallazgos.length, 8);
  const r = agruparHallazgos(hallazgos);
  assert.equal(r.length, AGRUPACION.tope);
  const resto = r.filter((x) => x.clave === 'resto.extincion');
  assert.equal(resto.length, 1);
  assert.equal(resto[0].params.n, 8 - (AGRUPACION.tope - 1));
  assert.deepEqual([resto[0].params.desde, resto[0].params.hasta], [5000, 25000]);
  // se quedan las de pico más alto
  assert.deepEqual(
    r.filter((x) => x.clave === 'extincion').map((x) => x.params.especie),
    ['S6', 'S7', 'S8'],
  );
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].desde <= r[i].desde, 'en orden de ciclo');
  assert.equal(agruparHallazgos(hallazgos, { tope: 20 }).length, 8);
  assert.deepEqual(agruparHallazgos([]), []);
});

// ---- conjunto ----------------------------------------------------------------

test('detectar(): todos en orden de ciclo, con umbrales configurables', () => {
  const n = 300;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 200 ? 60 : 8)),
      B: serie(n, (i) => (i < 120 ? 20 : null)),
      C: serie(n, () => 15),
    },
    adn: serie(n, (i) => 100 + i),
  });
  const r = detectar(h);
  const tipos = r.map((x) => x.tipo).sort();
  // A domina hasta que colapsa; después domina C
  assert.deepEqual(tipos, ['adn', 'colapso', 'dominio', 'dominio', 'extincion']);
  for (const x of r) formaValida(x);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].desde <= r[i].desde);
  const sinAdn = detectar(h, { adn: { cambio: 10 } });
  assert.ok(!sinAdn.some((x) => x.tipo === 'adn'));
  assert.equal(UMBRALES.dominio.umbral, 0.5, 'los defaults no cambian');
});

test('historia fundida (maxPuntos chico): los detectores siguen encontrando lo mismo', () => {
  const n = 600;
  const g = {
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 400 ? 80 : 5)),
      B: serie(n, (i) => (i < 300 ? 20 : null)),
      C: serie(n, () => 20),
    },
  };
  const entera = historiaDe(g);
  const fundida = historiaDe({ ...g, opciones: { maxPuntos: 300 } });
  assert.ok(fundida.puntos <= 300);
  assert.ok(
    /** @type {import('../engine/history.js').Serie} */ (fundida.serie('vivos')).n.some(
      (x) => x > 1,
    ),
  );
  const tipos = (/** @type {Historia} */ h) =>
    detectar(h)
      .map((x) => `${x.tipo}:${x.params.especie ?? ''}`)
      .sort();
  assert.deepEqual(tipos(fundida), tipos(entera));
});
