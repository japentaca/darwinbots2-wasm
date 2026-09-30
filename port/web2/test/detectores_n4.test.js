// @ts-check
// Detectores del Nivel 4 (engine/detectors.js, decisión 11): sustitución de
// especie y oscilaciones. Series armadas a mano: casos positivos, negativos
// (ruido blanco y lento, tendencia sin ciclos, algas oscilantes, dos
// especies estables al 50/50), bordes (serie corta, huecos, historia
// fundida) y el caso en que no escriben nada; más la agrupación, los textos
// es/en, el informe y la tarjeta Hallazgos.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  agruparHallazgos,
  CLAVES_AGRUPADAS,
  CLAVES_HALLAZGO,
  detectar,
  detectarOscilaciones,
  detectarSustitucion,
  FIGURAS,
  UMBRALES,
} from '../engine/detectors.js';
import { Historia } from '../engine/history.js';
import { informeCorrida } from '../engine/report/index.js';
import { parametrosDe, TEXTOS, traductor } from '../engine/report/textos.js';
import {
  claveHallazgo,
  hallazgosTarjeta,
  marcaHallazgo,
  textoHallazgo,
} from '../src/lib/analizar/hallazgos.js';
import { ciclos, historiaDe } from './util/historia-sintetica.js';
import { validar } from './util/validar-informe.js';

/** @param {number} n @param {(i: number) => number | null} f */
const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/** Ruido determinista en [0, 1) (hash de i). @param {number} i */
const ruido = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Seno de período `p` puntos. @param {number} i @param {number} p @param {number} [fase] */
const seno = (i, p, fase = 0) => Math.sin((2 * Math.PI * i) / p + fase);

/** @param {import('../engine/detectors.js').Hallazgo} x */
function formaValida(x) {
  assert.ok(['sustitucion', 'oscilacion'].includes(x.tipo), x.tipo);
  assert.ok(CLAVES_HALLAZGO.includes(x.clave), x.clave);
  assert.ok(Object.values(FIGURAS).includes(x.figura));
  assert.ok(['info', 'aviso', 'alta'].includes(x.severidad));
  assert.ok(x.desde <= x.hasta, `${x.desde} ≤ ${x.hasta}`);
  for (const v of Object.values(x.params))
    assert.ok(typeof v === 'string' || Number.isFinite(v), `param ${v}`);
}

/** Depredador–presa: presa y depredador desfasados un cuarto de período. */
function depredadorPresa(n = 600, p = 40, o = {}) {
  return historiaDe({
    t: ciclos(n),
    especies: {
      Presa: serie(n, (i) => Math.round(80 + 50 * seno(i, p) + 12 * (ruido(i) - 0.5))),
      Depredador: serie(n, (i) =>
        Math.round(40 + 22 * seno(i, p, -Math.PI / 2) + 8 * (ruido(i + 5000) - 0.5)),
      ),
      Alga: serie(n, () => 200),
    },
    vegetales: ['Alga'],
    ...o,
  });
}

// ---- silencio y bordes comunes ----------------------------------------------

test('N4: historia vacía, una muestra y serie corta: no escriben', () => {
  const vacia = new Historia();
  assert.deepEqual(detectarSustitucion(vacia), []);
  assert.deepEqual(detectarOscilaciones(vacia), []);
  const una = historiaDe({ t: [0], especies: { A: [80], B: [5] } });
  assert.deepEqual(detectarSustitucion(una), []);
  assert.deepEqual(detectarOscilaciones(una), []);
  // 15 puntos (< minPuntos) con un ciclo perfecto de 4: nada
  const corta = historiaDe({
    t: ciclos(15),
    especies: { A: serie(15, (i) => 100 + 50 * seno(i, 4)) },
  });
  assert.deepEqual(detectarOscilaciones(corta), []);
  // una sustitución en 4 puntos (etapas de < minCiclos): nada
  const s4 = historiaDe({ t: ciclos(4), especies: { A: [80, 80, 5, 5], B: [5, 5, 80, 80] } });
  assert.deepEqual(detectarSustitucion(s4), []);
});

test('N4: corrida estable: ni sustitución ni oscilación', () => {
  const n = 400;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => 29 + (i % 3)),
      B: serie(n, () => 30),
      Alga: serie(n, () => 60),
    },
    vegetales: ['Alga'],
  });
  assert.deepEqual(detectarSustitucion(h), []);
  assert.deepEqual(detectarOscilaciones(h), []);
  assert.deepEqual(detectar(h), []);
});

// ---- sustitución -------------------------------------------------------------

test('sustitución: A (80 %) es desplazada por B, que pasa del 10 % al 80 %', () => {
  const n = 400;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 150 ? 80 : i < 200 ? 80 - (i - 150) * 1.4 : 10)),
      B: serie(n, (i) => (i < 150 ? 10 : i < 200 ? 10 + (i - 150) * 1.4 : 80)),
      C: serie(n, () => 10),
      Alga: serie(n, () => 500),
    },
    vegetales: ['Alga'],
  });
  const r = detectarSustitucion(h);
  assert.equal(r.length, 1);
  formaValida(r[0]);
  const p = r[0].params;
  assert.equal(p.especie, 'A');
  assert.equal(p.otra, 'B');
  assert.equal(p.antes, 80);
  assert.equal(p.despues, 10);
  assert.equal(p.antesOtra, 10);
  assert.equal(p.despuesOtra, 80);
  // se cruzan a mitad de la transición (ciclo 17.500)
  assert.equal(p.ciclo, 17500);
  assert.ok(r[0].desde <= 17500 && r[0].hasta >= 17500);
  assert.ok(r[0].desde >= 15000 && r[0].hasta <= 20000, `${r[0].desde}–${r[0].hasta}`);
  assert.equal(r[0].figura, FIGURAS.especies);
  // detectar() la incluye
  assert.ok(detectar(h).some((x) => x.tipo === 'sustitucion'));
});

test('sustitución: una especie nueva (ausente antes) desplaza a la de origen', () => {
  const n = 300;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      Madre: serie(n, (i) => (i < 120 ? 60 : i < 140 ? 60 - (i - 120) * 2.5 : null)),
      '(5001)Madre': serie(n, (i) => (i < 110 ? null : Math.min(70, (i - 109) * 3))),
    },
  });
  const r = detectarSustitucion(h);
  assert.equal(r.length, 1);
  assert.equal(r[0].params.especie, 'Madre');
  assert.equal(r[0].params.otra, '(5001)Madre');
  assert.equal(r[0].params.antesOtra, 0);
  assert.equal(r[0].params.despues, 0);
});

test('sustitución: ida y vuelta son dos hallazgos, cada uno con su dirección', () => {
  const n = 600;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 200 || i >= 400 ? 70 : 10)),
      B: serie(n, (i) => (i < 200 || i >= 400 ? 10 : 70)),
    },
  });
  const r = detectarSustitucion(h);
  assert.equal(r.length, 2);
  assert.deepEqual(
    r.map((x) => [x.params.especie, x.params.otra]),
    [
      ['A', 'B'],
      ['B', 'A'],
    ],
  );
});

test('sustitución: dos especies estables al 50/50 (con ruido) no escriben', () => {
  const n = 1000;
  for (const amp of [10, 30, 50]) {
    const h = historiaDe({
      t: ciclos(n),
      especies: {
        A: serie(n, (i) => Math.round(50 + amp * (ruido(i) - 0.5))),
        B: serie(n, (i) => Math.round(50 + amp * (ruido(i + 777) - 0.5))),
      },
    });
    assert.deepEqual(detectarSustitucion(h), [], `ruido ±${amp / 2}`);
  }
  // 60/40 fijo: A siempre adelante pero sin duplicar a B
  const fijo = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 60), B: serie(n, () => 40) },
  });
  assert.deepEqual(detectarSustitucion(fijo), []);
});

test('sustitución: ruido entre especies independientes no escribe', () => {
  const n = 1000;
  for (let s = 0; s < 40; s++) {
    const h = historiaDe({
      t: ciclos(n),
      especies: {
        A: serie(n, (i) => Math.round(5 + 55 * ruido(i * 3 + s * 1000))),
        B: serie(n, (i) => Math.round(5 + 55 * ruido(i * 7 + s * 1777))),
        C: serie(n, (i) => Math.round(5 + 55 * ruido(i * 11 + s * 3333))),
      },
    });
    assert.deepEqual(detectarSustitucion(h), [], `semilla ${s}`);
  }
});

test('sustitución: etapas cortas, transición larga o vegetales no cuentan', () => {
  const n = 400;
  // B adelante solo 2.000 ciclos (< minCiclos) y después vuelve A
  const corta = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i >= 200 && i < 220 ? 10 : 70)),
      B: serie(n, (i) => (i >= 200 && i < 220 ? 70 : 10)),
    },
  });
  assert.deepEqual(detectarSustitucion(corta), []);
  // transición de 20.000 ciclos al 50/50 (> maxTransicion)
  const lenta = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 100 ? 70 : i < 300 ? 40 : 10)),
      B: serie(n, (i) => (i < 100 ? 10 : i < 300 ? 40 : 70)),
    },
  });
  assert.deepEqual(detectarSustitucion(lenta), []);
  assert.equal(detectarSustitucion(lenta, { maxTransicion: 25000 }).length, 1, 'configurable');
  // un vegetal que reemplaza a otro no es una sustitución (ni A contra un vegetal)
  const algas = historiaDe({
    t: ciclos(n),
    especies: {
      Alga1: serie(n, (i) => (i < 200 ? 300 : 10)),
      Alga2: serie(n, (i) => (i < 200 ? 10 : 300)),
      A: serie(n, () => 30),
    },
    vegetales: ['Alga1', 'Alga2'],
  });
  assert.deepEqual(detectarSustitucion(algas), []);
});

test('sustitución: huecos y poblaciones mínimas no rompen; un punto sin datos se tolera', () => {
  const n = 400;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      // en el punto 100 no hay nadie (menos de minPoblacion): se tolera
      A: serie(n, (i) => (i === 100 ? null : i < 200 ? 70 : 8)),
      B: serie(n, (i) => (i === 100 ? 2 : i < 200 ? 8 : 70)),
    },
  });
  const r = detectarSustitucion(h);
  assert.equal(r.length, 1);
  assert.equal(r[0].params.especie, 'A');
  // población mínima en toda la corrida: nada
  const chica = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => (i < 200 ? 6 : 1)), B: serie(n, (i) => (i < 200 ? 1 : 6)) },
  });
  assert.deepEqual(detectarSustitucion(chica), []);
});

test('sustitución: historia fundida (maxPuntos 150) encuentra lo mismo', () => {
  const n = 2000; // 0..199.900
  const g = {
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 1200 ? 80 : i < 1250 ? 80 - (i - 1200) * 1.4 : 10)),
      B: serie(n, (i) => (i < 1200 ? 10 : i < 1250 ? 10 + (i - 1200) * 1.4 : 80)),
    },
    opciones: { maxPuntos: 150 },
  };
  const h = historiaDe(g);
  assert.ok(h.puntos <= 150);
  const r = detectarSustitucion(h);
  assert.equal(r.length, 1);
  formaValida(r[0]);
  assert.equal(r[0].params.especie, 'A');
  assert.ok(Math.abs(Number(r[0].params.ciclo) - 122500) <= 5000, `${r[0].params.ciclo}`);
});

// ---- oscilaciones -------------------------------------------------------------

test('oscilación: depredador–presa (período 4.000), en el total y en cada especie', () => {
  const h = depredadorPresa();
  const r = detectarOscilaciones(h);
  for (const x of r) formaValida(x);
  const total = r.filter((x) => x.clave === 'oscilacion.total');
  const esp = r.filter((x) => x.clave === 'oscilacion');
  assert.equal(total.length, 1);
  assert.deepEqual(esp.map((x) => x.params.especie).sort(), ['Depredador', 'Presa']);
  for (const x of r) {
    assert.ok(Math.abs(Number(x.params.periodo) - 4000) <= 400, `período ${x.params.periodo}`);
    assert.ok(Number(x.params.periodos) >= UMBRALES.oscilacion.minPeriodos);
    assert.ok(Number(x.params.pct) >= 20);
  }
  const presa = /** @type {any} */ (esp.find((x) => x.params.especie === 'Presa'));
  assert.ok(Math.abs(presa.params.amplitud - 100) <= 20, `amplitud ${presa.params.amplitud}`);
  assert.equal(presa.figura, FIGURAS.especies);
  assert.equal(total[0].figura, FIGURAS.total);
  // las algas (vegetales, constantes) no aparecen
  assert.ok(!r.some((x) => x.params.especie === 'Alga'));
});

test('oscilación: sobre una tendencia creciente se encuentra con su período', () => {
  const n = 500;
  const h = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => 30 + i / 2 + 25 * seno(i, 25)) },
  });
  const r = detectarOscilaciones(h).filter((x) => x.clave === 'oscilacion');
  assert.equal(r.length, 1);
  assert.equal(r[0].params.periodo, 2500);
});

test('oscilación: solo en una parte de la corrida', () => {
  const n = 800;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i >= 300 && i < 600 ? 100 + 50 * seno(i - 300, 30) : 100)),
    },
  });
  const r = detectarOscilaciones(h).filter((x) => x.clave === 'oscilacion');
  assert.equal(r.length, 1);
  assert.ok(r[0].desde >= 29000 && r[0].hasta <= 61000, `${r[0].desde}–${r[0].hasta}`);
});

test('oscilación: el ruido blanco no oscila (poblaciones chicas y grandes, entera y fundida)', () => {
  const n = 1000;
  for (let s = 0; s < 30; s++)
    for (const [lo, hi] of [
      [3, 40],
      [0, 60],
      [10, 80],
      [40, 60],
    ]) {
      const g = {
        t: ciclos(n),
        especies: { A: serie(n, (i) => Math.round(lo + ruido(i * 7 + s * 1000 + lo) * (hi - lo))) },
      };
      assert.deepEqual(detectarOscilaciones(historiaDe(g)), [], `ruido ${lo}–${hi}, ${s}`);
      if (s < 5)
        assert.deepEqual(
          detectarOscilaciones(historiaDe({ ...g, opciones: { maxPuntos: 150 } })),
          [],
          `ruido ${lo}–${hi}, ${s}, fundida`,
        );
    }
});

test('oscilación: el ruido lento (paseo al azar, AR(1)) no oscila', () => {
  const n = 1000;
  for (let s = 0; s < 40; s++) {
    let x = 50;
    const paso = 4 + (s % 4) * 4;
    const paseo = historiaDe({
      t: ciclos(n),
      especies: {
        A: serie(n, (i) => {
          x = Math.max(12, Math.min(150, x + (ruido(i + s * 5000) - 0.5) * paso));
          return Math.round(x);
        }),
      },
    });
    assert.deepEqual(detectarOscilaciones(paseo), [], `paseo ${s}`);
    let z = 0;
    const phi = 0.7 + (s % 3) * 0.1;
    const ar = historiaDe({
      t: ciclos(n),
      especies: {
        A: serie(n, (i) => {
          z = phi * z + (ruido(i + s * 7000) - 0.5) * 20;
          return Math.round(60 + z);
        }),
      },
    });
    assert.deepEqual(detectarOscilaciones(ar), [], `AR(1) ${phi} ${s}`);
  }
});

test('oscilación: una tendencia sin ciclos no oscila (lineal, logística, exponencial, escalón)', () => {
  const n = 400;
  const casos = {
    lineal: (/** @type {number} */ i) => 20 + i / 2 + 5 * ruido(i),
    logistica: (/** @type {number} */ i) => 10 + 200 / (1 + Math.exp(-(i - 200) / 30)),
    exponencial: (/** @type {number} */ i) => 10 * Math.exp(i / 130),
    escalon: (/** @type {number} */ i) => (i < 200 ? 40 : 120) + 4 * ruido(i),
  };
  for (const [nombre, f] of Object.entries(casos)) {
    const h = historiaDe({ t: ciclos(n), especies: { A: serie(n, f) } });
    assert.deepEqual(detectarOscilaciones(h), [], nombre);
  }
});

test('oscilación: las algas que suben y bajan (repoblación) no son una oscilación', () => {
  const n = 600;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      // se comen hasta desaparecer y se reponen, cada 4.000 ciclos
      Alga: serie(n, (i) => (i % 40 < 25 ? 300 - (i % 40) * 10 : i % 40 < 30 ? 20 : null)),
      A: serie(n, (i) => 40 + (i % 2)),
      B: serie(n, () => 25),
    },
    vegetales: ['Alga'],
  });
  assert.deepEqual(detectarOscilaciones(h), []);
  assert.ok(!detectar(h).some((x) => x.tipo === 'oscilacion'));
  // contando vegetales, la misma corrida sí oscilaría
  assert.ok(detectarOscilaciones(h, { contarVegetales: true }).length > 0);
});

test('oscilación: pocos ciclos, amplitud chica o población mínima no escriben', () => {
  const n = 400;
  // 3 ciclos completos (< minPeriodos) y después estable
  const tres = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => (i < 120 ? 100 + 50 * seno(i, 40) : 100)) },
  });
  assert.deepEqual(detectarOscilaciones(tres), []);
  // el mismo ciclo sostenido 7 veces, sí
  const siete = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => (i < 280 ? 100 + 50 * seno(i, 40) : 100)) },
  });
  assert.equal(detectarOscilaciones(siete).filter((x) => x.clave === 'oscilacion').length, 1);
  // amplitud del 6 % de pico a valle
  const chica = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => 100 + 3 * seno(i, 40)) },
  });
  assert.deepEqual(detectarOscilaciones(chica), []);
  // nivel medio de 5 bots
  const minima = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => Math.round(5 + 4 * seno(i, 40))) },
  });
  assert.deepEqual(detectarOscilaciones(minima), []);
  // período de 4 puntos (< minPuntosPeriodo): no se resuelve
  const rapida = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => 100 + 50 * seno(i, 4)) },
  });
  assert.deepEqual(detectarOscilaciones(rapida), []);
});

test('oscilación: huecos en la serie global y ausencias de la especie no la rompen', () => {
  const n = 600;
  const h = historiaDe({
    t: ciclos(n),
    // (con B, la global no es la de una sola especie: se mide aparte)
    especies: { A: serie(n, (i) => Math.round(80 + 50 * seno(i, 40))), B: serie(n, () => 20) },
    // la serie global pierde 20 puntos (NaN)
    total: serie(n, (i) => (i >= 250 && i < 270 ? null : Math.round(80 + 50 * seno(i, 40)))),
  });
  const r = detectarOscilaciones(h, { contarVegetales: true });
  const total = r.filter((x) => x.clave === 'oscilacion.total');
  assert.ok(total.length >= 1);
  assert.ok(Math.abs(Number(total[0].params.periodo) - 4000) <= 400);
  // una especie que cae a 0 en cada valle (ausente) sigue oscilando
  const g = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => Math.max(0, Math.round(60 + 70 * seno(i, 40)))) },
  });
  const esp = detectarOscilaciones(g).filter((x) => x.clave === 'oscilacion');
  assert.equal(esp.length, 1);
  assert.ok(Math.abs(Number(esp[0].params.periodo) - 4000) <= 400);
});

test('oscilación: historia fundida (400.000 ciclos, maxPuntos 200)', () => {
  const n = 4001;
  // período de 30.000 ciclos: ~10 puntos fundidos (de 1.600 a 3.200 ciclos)
  // por período → se encuentra (el mínimo es minPuntosPeriodo × el paso más
  // grueso)
  const lenta = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => Math.round(100 + 40 * seno(i, 300) + 10 * (ruido(i) - 0.5))) },
    opciones: { maxPuntos: 200 },
  });
  assert.ok(lenta.puntos <= 200);
  const r = detectarOscilaciones(lenta).filter((x) => x.clave === 'oscilacion');
  assert.equal(r.length, 1);
  assert.ok(Math.abs(Number(r[0].params.periodo) - 30000) <= 3000, `${r[0].params.periodo}`);
  // período de 3.000 ciclos: dentro de cada punto fundido; las medias dan un
  // eco de período falso que la banda mín/máx delata → no se informa
  const rapida = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, (i) => 100 + 40 * seno(i, 30)) },
    opciones: { maxPuntos: 200 },
  });
  assert.deepEqual(detectarOscilaciones(rapida), []);
  // y sin fundir, la rápida sí se encuentra (período 3.000)
  const entera = historiaDe({
    t: ciclos(600),
    especies: { A: serie(600, (i) => 100 + 40 * seno(i, 30)) },
  });
  const re = detectarOscilaciones(entera).filter((x) => x.clave === 'oscilacion');
  assert.equal(re.length, 1);
  assert.equal(re[0].params.periodo, 3000);
});

// ---- agrupación ---------------------------------------------------------------

test('agrupar: depredador–presa y el total van en una sola frase', () => {
  const h = depredadorPresa();
  const g = agruparHallazgos(detectar(h)).filter((x) => x.tipo === 'oscilacion');
  assert.equal(g.length, 1);
  assert.equal(g[0].clave, 'oscilacion.grupoTotal');
  assert.ok(CLAVES_AGRUPADAS.includes(g[0].clave));
  assert.equal(g[0].params.n, 2);
  assert.equal(g[0].params.ejemplos, 'Presa, Depredador', 'por amplitud');
  assert.equal(g[0].figura, FIGURAS.total);
  assert.equal(g[0].hallazgos?.length, 3);
});

test('agrupar: especies a la par sin el total; períodos distintos no se juntan', () => {
  /** @param {string | null} especie @param {number} periodo @param {number} [desde] */
  const osc = (especie, periodo, desde = 1000) => ({
    tipo: /** @type {const} */ ('oscilacion'),
    clave: especie ? 'oscilacion' : 'oscilacion.total',
    params: {
      ...(especie ? { especie } : {}),
      periodo,
      periodos: 6,
      amplitud: 50,
      pct: 50,
      media: 100,
      desde,
      hasta: desde + 30000,
    },
    desde,
    hasta: desde + 30000,
    figura: especie ? FIGURAS.especies : FIGURAS.total,
    severidad: /** @type {const} */ ('info'),
  });
  const g = agruparHallazgos([osc('A', 4000), osc('B', 4400), osc('C', 9000)]);
  assert.equal(g.length, 2);
  const grupo = /** @type {any} */ (g.find((x) => x.clave === 'oscilacion.grupo'));
  assert.equal(grupo.params.n, 2);
  assert.equal(grupo.params.periodo, 4200);
  assert.ok(g.some((x) => x.clave === 'oscilacion' && x.params.especie === 'C'));
  // sin superposición en el tiempo, no se juntan
  const lejos = agruparHallazgos([osc('A', 4000, 0), osc('B', 4000, 100000)]);
  assert.equal(lejos.length, 2);
  // la misma especie dos veces no es «a la par»
  const misma = agruparHallazgos([osc('A', 4000, 0), osc('A', 4000, 20000)]);
  assert.equal(misma.length, 2);
  // el total solo, tal cual
  assert.equal(agruparHallazgos([osc(null, 4000)])[0].clave, 'oscilacion.total');
});

test('agrupar: tope de frases de sustitución, con una que resume el resto', () => {
  const xs = Array.from({ length: 7 }, (_, k) => ({
    tipo: /** @type {const} */ ('sustitucion'),
    clave: 'sustitucion',
    params: {
      especie: `E${k}`,
      otra: `E${k + 1}`,
      antes: 70,
      despues: 10,
      antesOtra: 10,
      despuesOtra: 70,
      ciclo: k * 10000 + 500,
      desde: k * 10000,
      hasta: k * 10000 + 1000,
    },
    desde: k * 10000,
    hasta: k * 10000 + 1000,
    figura: FIGURAS.especies,
    severidad: /** @type {const} */ ('info'),
  }));
  const g = agruparHallazgos(xs);
  assert.equal(g.length, 4);
  const resto = /** @type {any} */ (g.find((x) => x.clave === 'resto.sustitucion'));
  assert.equal(resto.params.n, 4);
});

// ---- textos, informe y tarjeta --------------------------------------------------

test('textos: cada clave nueva en es y en, con los mismos parámetros y plurales', () => {
  const nuevas = [
    'hallazgo.sustitucion',
    'hallazgo.oscilacion',
    'hallazgo.oscilacion.total',
    'hallazgo.oscilacion.grupo',
    'hallazgo.oscilacion.grupoTotal',
    'hallazgo.resto.sustitucion',
    'hallazgo.resto.oscilacion',
    'marca.sustitucion',
    'marca.sustitucion.detalle',
    'marca.oscilacion',
  ];
  for (const k of nuevas) {
    assert.ok(k in TEXTOS.es && k in TEXTOS.en, k);
    assert.deepEqual(parametrosDe(TEXTOS.es[k]), parametrosDe(TEXTOS.en[k]), k);
    assert.doesNotMatch(TEXTOS.es[k] + TEXTOS.en[k], /\boriginal\b/i);
  }
  const es = traductor('es').tx;
  const en = traductor('en').tx;
  const p = {
    especie: 'A',
    periodo: 4000,
    periodos: 1,
    amplitud: 1,
    pct: 50,
    desde: 0,
    hasta: 9000,
  };
  assert.match(es('hallazgo.oscilacion', p), /1 ciclo completo de unos 4\.000 ciclos/);
  assert.match(es('hallazgo.oscilacion', p), /1 bot de pico a valle/);
  assert.match(
    es('hallazgo.oscilacion', { ...p, periodos: 6, amplitud: 40 }),
    /6 ciclos completos .* 40 bots/,
  );
  assert.match(en('hallazgo.oscilacion', { ...p, periodos: 6 }), /6 full cycles of about 4,000/);
  const g = { n: 1, ejemplos: 'Presa', periodo: 4000, desde: 0, hasta: 9000 };
  assert.match(es('hallazgo.oscilacion.grupoTotal', g), /con ella osciló Presa\./);
  assert.match(
    es('hallazgo.oscilacion.grupoTotal', { ...g, n: 2, ejemplos: 'Presa, Depredador' }),
    /con ella oscilaron Presa, Depredador\./,
  );
  assert.match(es('hallazgo.resto.sustitucion', { n: 1, desde: 0, hasta: 1 }), /1 sustitución /);
  assert.match(
    en('hallazgo.resto.sustitucion', { n: 3, desde: 0, hasta: 1 }),
    /3 more species replacements/,
  );
});

test('informe: la sustitución y la oscilación se escriben, enlazadas a su figura y marcadas', () => {
  const n = 600;
  const historia = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 250 ? 80 : 10)),
      B: serie(n, (i) => (i < 250 ? 10 : Math.round(80 + 40 * seno(i, 40)))),
    },
  });
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const r = informeCorrida({ historia, fecha: 0 }, { idioma });
    validar(r.html);
    const frases = [...r.html.matchAll(/<p class="find">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    const sust = frases.filter((f) => (idioma === 'es' ? /desplazó a A/ : /displaced A/).test(f));
    assert.equal(sust.length, 1, idioma);
    assert.match(sust[0], /href="#fig-especies"/);
    const osc = frases.filter((f) => (idioma === 'es' ? /oscil/ : /oscillat/).test(f));
    assert.ok(osc.length >= 1, idioma);
    assert.match(r.html, idioma === 'es' ? /B desplaza a A/ : /B displaces A/, 'marca');
  }
});

test('tarjeta Hallazgos: aparecen la sustitución y la oscilación, con texto y claves únicas', () => {
  const n = 600;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 250 ? 80 : 10)),
      B: serie(n, (i) => (i < 250 ? 10 : 70)),
      C: serie(n, (i) => (i < 250 ? 10 : 70)),
      P: serie(n, (i) => Math.round(60 + 30 * seno(i, 40))),
    },
  });
  const xs = hallazgosTarjeta(h);
  assert.ok(xs.some((x) => x.tipo === 'oscilacion'));
  // B y C desplazan a A a la vez: dos frases, con claves distintas
  assert.deepEqual(
    xs.filter((x) => x.tipo === 'sustitucion').map((x) => `${x.params.especie}→${x.params.otra}`),
    ['A→B', 'A→C'],
  );
  const h2 = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 250 ? 80 : 5)),
      B: serie(n, (i) => (i < 250 ? 10 : 80)),
      P: serie(n, (i) => Math.round(20 + 12 * seno(i, 40))),
    },
  });
  const ys = hallazgosTarjeta(h2);
  assert.ok(ys.some((x) => x.tipo === 'sustitucion'));
  assert.ok(ys.some((x) => x.tipo === 'oscilacion'));
  for (const x of [...xs, ...ys]) {
    assert.ok(textoHallazgo(x, 'es').length > 20, x.clave);
    assert.ok(textoHallazgo(x, 'en').length > 20, x.clave);
    assert.doesNotMatch(textoHallazgo(x, 'es'), /[{}]/);
  }
  for (const lista of [xs, ys]) {
    const claves = lista.map(claveHallazgo);
    assert.equal(new Set(claves).size, claves.length, claves.join(' '));
  }
  // la etiqueta del tipo existe en la interfaz (es y en)
  for (const l of ['es', 'en']) {
    const dic = JSON.parse(
      readFileSync(new URL(`../src/i18n/${l}/analizar.json`, import.meta.url), 'utf8'),
    );
    for (const tipo of ['sustitucion', 'oscilacion'])
      assert.ok(`analizar.hallazgos.tipo.${tipo}` in dic, `${l}: ${tipo}`);
  }
});

test('claveHallazgo: dos sustituciones de la misma especie en el mismo ciclo no chocan', () => {
  const base = {
    tipo: /** @type {const} */ ('sustitucion'),
    clave: 'sustitucion',
    desde: 100,
    hasta: 200,
    figura: FIGURAS.especies,
    severidad: /** @type {const} */ ('info'),
  };
  const a = { ...base, params: { especie: 'A', otra: 'B' } };
  const b = { ...base, params: { especie: 'A', otra: 'C' } };
  assert.notEqual(claveHallazgo(a), claveHallazgo(b));
});

// ---- correcciones de la revisión (N4.3) ----------------------------------------

test('sustitución en cascada A → B → C: solo A → B y B → C (no A → C)', () => {
  const n = 300;
  /** @param {number} i @param {number} a @param {number} b */
  const f = (i, a, b) => (i >= a && i < b ? 80 : 5);
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => f(i, 0, 100)),
      B: serie(n, (i) => f(i, 100, 150)),
      C: serie(n, (i) => f(i, 150, 300)),
    },
  });
  const r = detectarSustitucion(h);
  for (const x of r) formaValida(x);
  assert.deepEqual(
    r.map((x) => `${x.params.especie}→${x.params.otra}`),
    ['A→B', 'B→C'],
  );
  // con el mismo tramo sin nadie adelante (A y C parejas, D siempre chica), A → C sí
  const sinB = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i >= 100 && i < 150 ? 20 : f(i, 0, 100))),
      C: serie(n, (i) => (i >= 100 && i < 150 ? 20 : f(i, 150, 300))),
      D: serie(n, () => 5),
    },
  });
  assert.deepEqual(
    detectarSustitucion(sinB).map((x) => `${x.params.especie}→${x.params.otra}`),
    ['A→C'],
  );
});

test('sustitución: cientos de especies efímeras no la vuelven lenta', () => {
  const n = 500;
  const E = 400;
  /** @type {Record<string, (number | null)[]>} */
  const esp = {};
  for (let k = 0; k < E; k++) {
    const a = Math.floor((k / E) * n);
    esp[`E${k}`] = serie(n, (i) => (i >= a && i < a + 20 ? 10 + (k % 7) : 0));
  }
  const h = historiaDe({ t: ciclos(n), especies: esp, opciones: { maxPuntos: n } });
  hallazgosTarjeta(h);
  const t0 = performance.now();
  hallazgosTarjeta(h);
  const ms = performance.now() - t0;
  // medido: ~20–30 ms; el tope del test es holgado (máquinas lentas)
  assert.ok(ms < 500, `${ms.toFixed(0)} ms`);
});

test('oscilación: historia fundida con ruido ±20 por muestra (período 30.000) se encuentra', () => {
  const n = 4001;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) =>
        Math.max(1, Math.round(100 + 40 * seno(i, 300) + 20 * (2 * ruido(i * 3 + 11) - 1))),
      ),
    },
    opciones: { maxPuntos: 200 },
  });
  assert.ok(h.puntos <= 200);
  const r = detectarOscilaciones(h).filter((x) => x.clave === 'oscilacion');
  assert.equal(r.length, 1);
  assert.ok(Math.abs(Number(r[0].params.periodo) - 30000) <= 3000, `${r[0].params.periodo}`);
  // tras serializar, lo mismo
  const h2 = Historia.deserializar(h.serializar());
  assert.equal(detectarOscilaciones(h2).filter((x) => x.clave === 'oscilacion').length, 1);
  // y el eco de un ciclo más corto que los puntos, con el mismo ruido, sigue sin pasar
  for (const p of [20, 30, 35, 40])
    assert.deepEqual(
      detectarOscilaciones(
        historiaDe({
          t: ciclos(n),
          especies: {
            A: serie(n, (i) => Math.round(100 + 40 * seno(i, p) + 20 * (2 * ruido(i) - 1))),
          },
          opciones: { maxPuntos: 200 },
        }),
      ),
      [],
      `eco de período ${p}`,
    );
});

test('oscilación: desde y hasta son ciclos de muestras de la historia', () => {
  const h = depredadorPresa();
  const muestras = new Set(h.t);
  const r = detectarOscilaciones(h);
  assert.ok(r.length > 0);
  for (const x of r) {
    assert.ok(muestras.has(x.desde), `desde ${x.desde}`);
    assert.ok(muestras.has(x.hasta), `hasta ${x.hasta}`);
    assert.equal(x.params.desde, x.desde);
    assert.equal(x.params.hasta, x.hasta);
  }
});

test('oscilación: con una sola especie no vegetal no se repite en la población total', () => {
  const n = 600;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      Alga: serie(n, () => 200),
      Z: serie(n, (i) => Math.round(60 + 30 * seno(i, 40))),
    },
    vegetales: ['Alga'],
  });
  assert.deepEqual(
    detectarOscilaciones(h).map((x) => x.clave),
    ['oscilacion'],
  );
  const g = agruparHallazgos(detectar(h)).filter((x) => x.tipo === 'oscilacion');
  assert.equal(g.length, 1);
  assert.equal(g[0].clave, 'oscilacion');
  assert.doesNotMatch(textoHallazgo(g[0], 'es'), /con ella/);
});

test('agrupar: la especie que desaparece y vuelve con regularidad no se reporta también como oscilación', () => {
  const n = 600;
  const h = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, () => 50),
      B: serie(n, (i) => (Math.floor(i / 20) % 2 ? null : 40)),
    },
  });
  // los detectores ven las dos cosas...
  const todos = detectar(h);
  assert.ok(todos.some((x) => x.tipo === 'oscilacion'));
  assert.ok(todos.some((x) => x.tipo === 'extincion'));
  // ...pero el resumen escribe una sola frase, con las oscilaciones adentro
  const g = agruparHallazgos(todos);
  assert.deepEqual(
    g.map((x) => x.clave),
    ['extincion.intermitenteFin'],
  );
  assert.ok(g[0].hallazgos?.some((x) => x.tipo === 'oscilacion' && x.params.especie === 'B'));
  // la oscilación de otra especie sí sigue saliendo
  const conOtra = agruparHallazgos([
    ...todos,
    {
      tipo: 'oscilacion',
      clave: 'oscilacion',
      params: {
        especie: 'A',
        periodo: 9000,
        periodos: 5,
        amplitud: 30,
        pct: 60,
        media: 50,
        desde: 0,
        hasta: 50000,
      },
      desde: 0,
      hasta: 50000,
      figura: FIGURAS.especies,
      severidad: 'info',
    },
  ]);
  assert.ok(conOtra.some((x) => x.clave === 'oscilacion' && x.params.especie === 'A'));
});

test('agrupar: el tope por tipo prioriza por magnitud (sustitución y oscilación)', () => {
  const sust = Array.from({ length: 6 }, (_, k) => ({
    tipo: /** @type {const} */ ('sustitucion'),
    clave: 'sustitucion',
    params: {
      especie: `E${k}`,
      otra: `F${k}`,
      antes: 40 + k * 10,
      despues: 10,
      antesOtra: 10,
      despuesOtra: 40,
      ciclo: k * 10000 + 500,
      desde: k * 10000,
      hasta: k * 10000 + 1000,
    },
    desde: k * 10000,
    hasta: k * 10000 + 1000,
    figura: FIGURAS.especies,
    severidad: /** @type {const} */ ('info'),
  }));
  const g = agruparHallazgos(sust).filter((x) => x.clave === 'sustitucion');
  // quedan las tres de mayor |antes − después| (E5, E4, E3)
  assert.deepEqual(g.map((x) => x.params.especie).sort(), ['E3', 'E4', 'E5']);
  // oscilaciones de períodos distintos (no se agrupan): quedan las de mayor pct
  const osc = [2000, 3100, 4700, 7100, 11000].map((periodo, k) => ({
    tipo: /** @type {const} */ ('oscilacion'),
    clave: 'oscilacion',
    params: {
      especie: `O${k}`,
      periodo,
      periodos: 5,
      amplitud: 10,
      pct: 20 + k * 10,
      media: 50,
      desde: 0,
      hasta: 60000,
    },
    desde: 0,
    hasta: 60000,
    figura: FIGURAS.especies,
    severidad: /** @type {const} */ ('info'),
  }));
  const go = agruparHallazgos(osc);
  assert.deepEqual(
    go
      .filter((x) => x.clave === 'oscilacion')
      .map((x) => x.params.especie)
      .sort(),
    ['O2', 'O3', 'O4'],
  );
  assert.equal(/** @type {any} */ (go.find((x) => x.clave === 'resto.oscilacion')).params.n, 2);
});

test('marca de la sustitución: en el cruce, con rótulo corto y el detalle (informe y tarjeta)', () => {
  const n = 600;
  const historia = historiaDe({
    t: ciclos(n),
    especies: {
      A: serie(n, (i) => (i < 250 ? 80 : 10)),
      B: serie(n, (i) => (i < 250 ? 10 : 80)),
    },
  });
  const s = /** @type {any} */ (detectarSustitucion(historia)[0]);
  assert.ok(s);
  const m = marcaHallazgo(s, 'es');
  assert.equal(m.ciclo, s.params.ciclo);
  assert.equal(m.texto, 'Sustitución: B');
  assert.equal(marcaHallazgo(s, 'en').texto, 'Replacement: B');
  // los demás tipos: en su desde, sin rótulo propio
  const osc = { ...s, tipo: 'oscilacion', clave: 'oscilacion' };
  assert.deepEqual(marcaHallazgo(osc, 'es'), { ciclo: s.desde, texto: '' });
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const r = informeCorrida({ historia, fecha: 0 }, { idioma });
    validar(r.html);
    const rotulo = idioma === 'es' ? 'Sustitución: B' : 'Replacement: B';
    const detalle = idioma === 'es' ? 'B desplaza a A' : 'B displaces A';
    assert.ok(r.html.includes(`<title>${detalle}</title>${rotulo}</text>`), idioma);
  }
});
