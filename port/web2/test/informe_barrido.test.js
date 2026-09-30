// @ts-check
// Informe «Barrido» (engine/report/barrido.js): se genera en los dos
// idiomas con resultados sintéticos, completos y parciales, sin recursos
// externos y con los datos embebidos.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearParametrosBarrido, unidadDe, unidadesBarrido } from '../engine/barrido.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { METRICAS } from '../engine/metricas.js';
import { agregarMuestra, historiaReplica, resultadoReplica } from '../engine/replicas.js';
import { ErrorInforme, generarInforme, informeBarrido } from '../engine/report/index.js';

const SOPA = /** @type {any} */ (escenarioFabrica('sopa-primordial'));
const IV = METRICAS.findIndex((m) => m.clave === 'vivos');

/** @param {number} k */
function resultado(k) {
  const h = historiaReplica({ cada: 50, maxPuntos: 50 });
  let fin = null;
  for (let c = 0; c <= 200; c += 50) {
    const metrics = METRICAS.map(() => 1);
    metrics[IV] = k * (c + 10);
    agregarMuestra(h, { ciclo: c, metrics });
    fin = { ciclo: c, metrics };
  }
  return resultadoReplica(h, fin);
}

function datos(parcial = false) {
  const p = crearParametrosBarrido({
    escenario: SOPA,
    adn: SOPA.especies.map(() => 'end'),
    semilla: 9,
    n: 2,
    ciclos: 200,
    cada: 50,
    clave: 'base:maxEnergy',
    grilla: { modo: 'lineal', desde: 10, hasta: 30, pasos: 3 },
    metricas: ['vivos', 'nrgTotal'],
    origen: { nombre: 'Origen <x>' },
  });
  const res = new Array(unidadesBarrido(p)).fill(null);
  for (let s = 0; s < 2; s++)
    for (let v = 0; v < 3; v++)
      if (!parcial || s === 0) res[unidadDe(p, v, s)] = resultado(v + 1 + s);
  return { ...p, resultados: res, fecha: Date.UTC(2026, 8, 30) };
}

test('informe de barrido en es y en: figuras, resumen, tabla y datos', () => {
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const inf = informeBarrido(datos(), { idioma });
    assert.match(inf.archivo, /^informe_.+_2026-09-30\.html$/);
    assert.ok(inf.html.includes('id="fig-b-vivos"'));
    assert.ok(inf.html.includes('id="fig-b-nrgTotal"'));
    assert.ok(inf.html.includes('id="fig-b-series"'));
    assert.ok(inf.html.includes('class="resumen"'));
    assert.ok(!/<(link|img)\b|src="http/.test(inf.html), 'sin recursos externos');
    assert.ok(!inf.html.includes('Origen <x>'), 'escapa los nombres');
    const d = /** @type {any} */ (inf.datos);
    assert.equal(d.tipo, 'barrido');
    assert.deepEqual(d.valores, [10, 20, 30]);
    assert.equal(d.hechas, 6);
    assert.equal(d.tabla[2].metricas.vivos.media, ((3 + 4) / 2) * 210);
    assert.equal(d.series.length, 3);
    assert.equal(d.series[0].corrida, 'base:maxEnergy=10');
  }
  const g = generarInforme('barrido', datos(), { idioma: 'en' });
  assert.ok(g.html.startsWith('<!doctype html>'));
});

test('informe de barrido parcial y sin resultados', () => {
  const inf = informeBarrido(datos(true), { idioma: 'es' });
  assert.ok(inf.html.includes('3 de 6 corridas terminadas'));
  const vacio = { ...datos(), resultados: [] };
  const v = informeBarrido(vacio, { idioma: 'es' });
  assert.ok(!v.html.includes('id="fig-b-vivos"'));
  assert.throws(
    () => informeBarrido(/** @type {any} */ ({ valores: [] }), {}),
    (e) => e instanceof ErrorInforme && /** @type {any} */ (e).codigo === 'falta-barrido',
  );
  // Parcial: la figura dice el n real («hasta 2»), no las semillas pedidas.
  assert.ok(inf.html.includes('media de 1 semilla'));
  const mixto = datos();
  mixto.resultados[unidadDe(mixto, 0, 1)] = null;
  assert.ok(informeBarrido(mixto, { idioma: 'es' }).html.includes('media de hasta 2 semillas'));
});

test('informe de barrido: reinicios, cambios reescritos y eje de un bool', () => {
  const d = datos();
  const r = /** @type {any} */ (resultado(50));
  r.reinicio = { ciclo: 120, esperado: 200 };
  d.resultados[unidadDe(d, 1, 1)] = r;
  d.eventos = [
    { ciclo: 50, tipo: 'opciones', cambios: { 'base:maxEnergy': 3, 'base:minVegs': 2 } },
    { ciclo: 60, tipo: 'opciones', cambios: { 'base:minVegs': 4 } },
  ];
  const inf = informeBarrido(d, { idioma: 'es' });
  const x = /** @type {any} */ (inf.datos);
  assert.deepEqual(x.reinicios, [{ valor: 20, semilla: d.semillas[1], ciclo: 120 }]);
  assert.equal(x.tabla[1].n, 1);
  assert.equal(x.tabla[1].reiniciadas, 1);
  assert.equal(x.tabla[1].metricas.vivos.media, 2 * 210, 'la reiniciada no cuenta');
  assert.equal(x.reescritos, 1);
  assert.ok(inf.html.includes('Corridas con la ronda reiniciada'));
  assert.ok(inf.html.includes('Reiniciadas (no cuentan)'));
  assert.ok(inf.html.includes('Uno de ellos escribe'));
  assert.match(
    inf.html,
    /al arrancar y 3 tras sus cambios en caliente/,
    'valor de origen efectivo',
  );
  assert.ok(!inf.html.includes('réplica'), 'textos propios del barrido');

  const b = crearParametrosBarrido({
    escenario: SOPA,
    adn: SOPA.especies.map(() => 'end'),
    semilla: 9,
    n: 1,
    ciclos: 200,
    cada: 50,
    clave: 'base:mutations',
    grilla: { modo: 'lineal', desde: 0, hasta: 1, pasos: 2 },
    metricas: ['vivos'],
  });
  const ib = informeBarrido(
    { ...b, resultados: [resultado(1), resultado(2)], fecha: 0 },
    { idioma: 'es' },
  );
  const ejes = [...ib.html.matchAll(/text-anchor="(?:start|middle|end)">([^<]*)<\/text>/g)].map(
    (m) => m[1],
  );
  assert.ok(ejes.includes('sí') && ejes.includes('no'), 'rótulos del bool');
  assert.ok(!ejes.includes('0,5'), 'sin marcas entre valores');
});
