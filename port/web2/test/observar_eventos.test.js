// @ts-check
// Detector del feed de Observar con series armadas a mano
// (src/lib/observar/eventos.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DetectorEventos,
  especiesNuevas,
  hitoGeneracion,
  textoEvento,
} from '../src/lib/observar/eventos.js';

/**
 * Pasa una serie por un detector nuevo y junta los eventos.
 * @param {{ ciclo: number, total: number, especies: Record<string, number>, genMax?: number,
 *   genEspecie?: string }[]} serie
 */
function correr(serie) {
  const d = new DetectorEventos();
  return serie.flatMap((m) => d.muestra(m));
}

/** Serie con un total y las especies repartidas. @param {number[]} totales */
const serieTotal = (totales) =>
  totales.map((n, i) => ({ ciclo: i * 100, total: n, especies: { A: n } }));

test('una serie estable no produce eventos', () => {
  assert.deepEqual(correr(serieTotal([50, 51, 50, 52, 51, 50, 49, 50])), []);
});

test('la primera muestra solo fija la base (una sim cargada no anuncia nada)', () => {
  assert.deepEqual(
    correr([{ ciclo: 5000, total: 300, especies: { A: 0, B: 300 }, genMax: 40 }]),
    [],
  );
});

test('extinción: una especie que tenía bots se queda sin ninguno, una sola vez', () => {
  const evs = correr([
    { ciclo: 0, total: 30, especies: { Alga: 20, Yojimbo: 10 } },
    { ciclo: 100, total: 25, especies: { Alga: 22, Yojimbo: 3 } },
    { ciclo: 200, total: 22, especies: { Alga: 22, Yojimbo: 0 } },
    { ciclo: 300, total: 22, especies: { Alga: 22 } },
  ]);
  assert.deepEqual(evs, [{ ciclo: 200, tipo: 'extincion', params: { especie: 'Yojimbo' } }]);
});

test('pico: se informa al confirmarse con una caída del 10 %, con el ciclo del máximo', () => {
  const evs = correr(serieTotal([100, 150, 200, 344, 330, 300, 280]));
  assert.deepEqual(evs, [{ ciclo: 300, tipo: 'pico', params: { n: 344 } }]);
});

test('pico: uno más bajo que el último informado no se repite; uno más alto sí', () => {
  const evs = correr(serieTotal([100, 344, 300, 340, 290, 420, 300]));
  assert.deepEqual(
    evs.map((e) => [e.ciclo, e.params.n]),
    [
      [100, 344],
      [500, 420],
    ],
  );
});

test('pico: poblaciones chicas no cuentan', () => {
  assert.deepEqual(correr(serieTotal([3, 8, 4, 2])), []);
});

test('generación récord por hitos: de a 1 hasta 10, de a 5 hasta 50, de a 10 después', () => {
  assert.equal(hitoGeneracion(-1), 1);
  assert.equal(hitoGeneracion(0), 1);
  assert.equal(hitoGeneracion(9), 10);
  assert.equal(hitoGeneracion(10), 15);
  assert.equal(hitoGeneracion(12), 15);
  assert.equal(hitoGeneracion(50), 60);
  const gens = [0, 1, 1, 2, 3, 3, 9, 11, 14, 15, 16, 20];
  const evs = correr(
    gens.map((g, i) => ({
      ciclo: i * 100,
      total: 10,
      especies: { A: 10 },
      genMax: g,
      genEspecie: 'Animal Minimalis',
    })),
  );
  assert.deepEqual(
    evs.map((e) => e.params.n),
    [1, 2, 3, 9, 11, 15, 20],
  );
  assert.equal(evs[0].tipo, 'generacion');
  assert.equal(evs[0].params.especie, 'Animal Minimalis');
});

test('generación: sin la vista enriquecida (NaN) no hay eventos', () => {
  const evs = correr(
    [0, 1, 2].map((i) => ({ ciclo: i * 100, total: 10, especies: { A: 10 }, genMax: Number.NaN })),
  );
  assert.deepEqual(evs, []);
});

test('reiniciar vuelve a fijar la base', () => {
  const d = new DetectorEventos();
  d.muestra({ ciclo: 0, total: 10, especies: { A: 10 } });
  d.reiniciar();
  assert.deepEqual(d.muestra({ ciclo: 0, total: 5, especies: { B: 5 } }), []);
});

test('especiesNuevas: llegada por teleporter o especie nueva; ignora Corpse y las conocidas', () => {
  const conocidas = new Set(['Alga']);
  assert.deepEqual(especiesNuevas(conocidas, ['Alga', 'Corpse', 'Anubis'], true, 1400), [
    { ciclo: 1400, tipo: 'llegada', params: { especie: 'Anubis' } },
  ]);
  assert.ok(conocidas.has('Anubis'));
  assert.deepEqual(especiesNuevas(conocidas, ['Alga', 'Anubis'], true, 1500), []);
  assert.deepEqual(especiesNuevas(conocidas, ['(5001)Anubis'], false, 1600), [
    { ciclo: 1600, tipo: 'especieNueva', params: { especie: '(5001)Anubis' } },
  ]);
});

test('textoEvento arma el texto con t() y los parámetros', () => {
  /** @param {string} k @param {Record<string, any>} [p] */
  const t = (k, p) => `${k}${p ? ` ${JSON.stringify(p)}` : ''}`;
  assert.equal(
    textoEvento({ ciclo: 1, tipo: 'extincion', params: { especie: 'Yojimbo' } }, t, 'es'),
    'observar.evento.extincion {"especie":"Yojimbo"}',
  );
  assert.equal(
    textoEvento({ ciclo: 1, tipo: 'generacion', params: { n: 3, especie: '' } }, t, 'es'),
    'observar.evento.generacionSin {"n":"3"}',
  );
  const cambio = textoEvento(
    { ciclo: 1, tipo: 'cambio', params: { cambios: { 'opt:33': 1 } } },
    t,
    'en',
  );
  assert.match(cambio, /^observar\.evento\.cambio \{"lista":".+ = 1"\}$/);
  assert.doesNotMatch(cambio, /opt:33/, 'usa el nombre del parámetro');
});
