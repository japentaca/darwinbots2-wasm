// @ts-check
// Estadísticas vivas de Observar (src/lib/observar/metricas.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REG } from '../engine/protocolo.js';
import {
  capasApiladas,
  Historia,
  muestraDe,
  resumirFrame,
  topeEje,
  variacion,
  vbAHex,
} from '../src/lib/observar/metricas.js';
import { BOT, FLAG, VIS } from '../src/lib/sim/frame.js';

/**
 * Frame armado a mano: bots [{nrg, color, flags, especie, gen}].
 * @param {{ nrg: number, color: number, flags?: number, especie?: number, gen?: number }[]} bots
 * @param {{ rica?: boolean, ciclo?: number }} [o]
 */
function frame(bots, o = {}) {
  const rica = o.rica ?? true;
  const n = bots.length;
  const v = new Float32Array(n * REG.bot + (rica ? n * REG.vis : 0));
  const vis = rica ? n * REG.bot : -1;
  bots.forEach((b, i) => {
    const q = i * REG.bot;
    v[q + BOT.idx] = i + 1;
    v[q + BOT.nrg] = b.nrg;
    v[q + BOT.color] = b.color;
    v[q + BOT.flags] = b.flags ?? 0;
    if (rica) {
      const r = vis + i * REG.vis;
      v[r + VIS.especie] = b.especie ?? 0;
      v[r + VIS.gen] = b.gen ?? 0;
    }
  });
  return /** @type {import('../src/lib/sim/frame.js').Frame} */ (
    /** @type {unknown} */ ({
      v,
      nBots: n,
      rica,
      ciclo: o.ciclo ?? 0,
      of: { bots: 0, vis },
    })
  );
}

const ROJO = 0x0000ff; // Long BGR
const VERDE = 0x00ff00;
const nombres = ['Alga_minimalis_3.0.txt', 'Animal Minimalis'];

test('resumirFrame con la vista enriquecida: especies, energía, generación, sin cadáveres', () => {
  const f = frame(
    [
      { nrg: 1000, color: VERDE, flags: FLAG.veg, especie: 0, gen: 0 },
      { nrg: 3000, color: VERDE, flags: FLAG.veg, especie: 0, gen: 2 },
      { nrg: 2000, color: ROJO, especie: 1, gen: 7 },
      { nrg: 9999, color: ROJO, flags: FLAG.corpse, especie: 1, gen: 50 },
    ],
    { ciclo: 300 },
  );
  const r = resumirFrame(f, { nombreEspecie: (i) => nombres[i] });
  assert.equal(r.ciclo, 300);
  assert.equal(r.vivos, 3);
  assert.equal(r.vegetales, 2);
  assert.equal(r.nrgMedia, 2000);
  assert.equal(r.genMax, 7);
  assert.equal(r.genEspecie, 'Animal Minimalis');
  assert.deepEqual(r.especies, {
    'Alga_minimalis_3.0': { n: 2, color: VERDE },
    'Animal Minimalis': { n: 1, color: ROJO },
  });
  assert.deepEqual(muestraDe(r), {
    ciclo: 300,
    total: 3,
    especies: { 'Alga_minimalis_3.0': 2, 'Animal Minimalis': 1 },
  });
});

test('resumirFrame con la vista clásica: agrupa por color y no sabe la generación', () => {
  const f = frame(
    [
      { nrg: 10, color: VERDE },
      { nrg: 20, color: ROJO },
      { nrg: 30, color: ROJO },
    ],
    { rica: false },
  );
  const r = resumirFrame(f, {
    nombreEspecie: () => 'x',
    nombrePorColor: new Map([[VERDE, 'Alga']]),
  });
  assert.equal(r.rica, false);
  assert.ok(Number.isNaN(r.genMax));
  assert.deepEqual(Object.keys(r.especies).sort(), ['#ff0000', 'Alga']);
  assert.equal(r.especies['#ff0000'].n, 2);
  assert.equal(vbAHex(0x563412), '#123456');
});

test('resumirFrame sin bots', () => {
  const r = resumirFrame(frame([]), { nombreEspecie: () => '' });
  assert.equal(r.vivos, 0);
  assert.ok(Number.isNaN(r.nrgMedia));
  assert.ok(Number.isNaN(r.genMax));
});

test('Historia: una muestra por intervalo, tope con fusión de a dos y variación', () => {
  const h = new Historia({ intervalo: 100, max: 4 });
  /** @param {number} c @param {number} n */
  const m = (c, n) => ({ ciclo: c, total: n, especies: { A: n } });
  assert.equal(h.agregar(m(0, 10)), true);
  assert.equal(h.agregar(m(50, 11)), false, 'antes del intervalo');
  assert.equal(h.agregar(m(130, 12)), true);
  assert.equal(h.agregar(m(230, 13)), true);
  assert.equal(h.agregar(m(330, 14)), true);
  assert.equal(h.muestras.length, 4);
  assert.equal(h.agregar(m(430, 15)), true);
  // 5 > 4: queda una de cada dos, con la última, y el intervalo se duplica
  assert.deepEqual(
    h.muestras.map((x) => x.ciclo),
    [0, 230, 430],
  );
  assert.equal(h.intervalo, 200);
  assert.equal(h.proxima, 630);
  assert.equal(h.hasta(429)?.ciclo, 230);
  assert.equal(h.hasta(-1), undefined);
  const r = { ciclo: 1300, vivos: 20 };
  assert.equal(variacion(h, /** @type {any} */ (r)), 20 - 13);
  assert.equal(variacion(h, /** @type {any} */ ({ ciclo: 500, vivos: 3 })), null);
  const copia = new Historia(h.aJSON());
  assert.deepEqual(copia.muestras, h.muestras);
  assert.equal(copia.intervalo, 200);
});

test('capasApiladas: orden de aparición, «otras» para las chicas', () => {
  const ms = [
    { ciclo: 0, total: 3, especies: { A: 1, B: 2 } },
    { ciclo: 100, total: 9, especies: { A: 3, B: 0, C: 5, D: 1 } },
  ];
  assert.deepEqual(capasApiladas(ms), [
    { nombre: 'A', valores: [1, 3] },
    { nombre: 'B', valores: [2, 0] },
    { nombre: 'C', valores: [0, 5] },
    { nombre: 'D', valores: [0, 1] },
  ]);
  assert.deepEqual(capasApiladas(ms, 3), [
    { nombre: 'A', valores: [1, 3] },
    { nombre: 'C', valores: [0, 5] },
    { nombre: null, valores: [2, 1] },
  ]);
});

test('topeEje redondea a 1, 2 o 5 × 10^k', () => {
  assert.equal(topeEje(0), 10);
  assert.equal(topeEje(7), 10);
  assert.equal(topeEje(13), 20);
  assert.equal(topeEje(344), 500);
  assert.equal(topeEje(1000), 1000);
});

test('muestrasDeHistoria: al reducir puntos para el gráfico, promedio ponderado por muestras (n)', async () => {
  const { Historia: HistoriaMotor } = await import('../engine/history.js');
  const { muestrasDeHistoria } = await import('../src/lib/observar/metricas.js');
  const h = new HistoriaMotor({ maxPuntos: 10, maxBytes: Number.POSITIVE_INFINITY });
  /** @type {{ciclo: number, vivos: number, A: number}[]} */
  const crudas = [];
  for (let i = 0; i < 40; i++) {
    const vivos = (i * 7) % 13;
    const A = i % 4 ? i : 0; // A falta una de cada cuatro muestras
    crudas.push({ ciclo: i * 100, vivos, A });
    const metrics = new Float32Array(56);
    metrics[0] = i * 100;
    metrics[2] = vivos;
    const stats = new Float32Array(27);
    stats[1] = A;
    h.agregar({ ciclo: i * 100, metrics, especies: A ? [{ nombre: 'A', stats }] : [] });
  }
  const n = /** @type {any} */ (h.serie('vivos')).n;
  assert.ok(new Set(n).size > 1, `puntos con distinta cantidad de muestras: ${n}`);
  for (const max of [2, 3, 4, 100]) {
    const ms = muestrasDeHistoria(h, max);
    // cada muestra del gráfico = la media de las muestras crudas que cubre
    ms.forEach((m, i) => {
      const hasta = i + 1 < ms.length ? ms[i + 1].ciclo : Number.POSITIVE_INFINITY;
      const cub = crudas.filter((c) => c.ciclo >= m.ciclo && c.ciclo < hasta);
      const media = (/** @type {number[]} */ xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
      assert.ok(Math.abs(m.total - media(cub.map((c) => c.vivos))) < 1e-9, `total ${max}/${i}`);
      if (cub.some((c) => c.A))
        assert.ok(Math.abs(m.especies.A - media(cub.map((c) => c.A))) < 1e-9, `A ${max}/${i}`);
      else assert.equal(m.especies.A, undefined);
    });
  }
});
