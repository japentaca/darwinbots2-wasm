// @ts-check
// engine/replicas.js: semillas, parámetros, plan de pasos, percentiles,
// agregación alineada por ciclo y tabla de medias y desvíos (sin wasm).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registrarCambio } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { Historia } from '../engine/history.js';
import { METRICAS } from '../engine/metricas.js';
import {
  agregarMuestra,
  agregarReplicas,
  agregarSeries,
  crearParametros,
  ErrorReplicas,
  estadoSemilla,
  GRUPOS_COMPARAR,
  grupoDe,
  historiaReplica,
  MAX_REPLICAS,
  METRICAS_CLAVE,
  MUNDOS_DISTINTOS,
  mediaDesvio,
  mensajesReplica,
  percentil,
  planReplica,
  SEMILLA_MAX,
  semillasReplicas,
  serieDe,
  tablaReplicas,
} from '../engine/replicas.js';

const ESC = /** @type {any} */ (escenarioFabrica('sopa-primordial'));
const ADN = ESC.especies.map((/** @type {any} */ s) => `cond start *.nrg ${s.bot.length} stop`);

test('semillas: la primera es la base tal cual, distintas, en rango y deterministas', () => {
  const s = semillasReplicas(777, 50);
  assert.equal(s.length, 50);
  assert.equal(s[0], 777);
  assert.equal(new Set(s).size, 50);
  for (const x of s.slice(1)) assert.ok(Number.isInteger(x) && x >= 1 && x <= SEMILLA_MAX);
  assert.deepEqual(semillasReplicas(777, 50), s);
  assert.notDeepEqual(semillasReplicas(778, 5), semillasReplicas(777, 5));
  // La réplica 1 es la corrida de origen, aunque su semilla esté fuera del rango de la interfaz.
  assert.equal(semillasReplicas(0, 1)[0], 0);
  assert.equal(semillasReplicas(-5, 3)[0], -5);
});

test('C19: estadoSemilla replica Rnd -1 : Randomize semilla/100 del motor', () => {
  // Caso dorado R-01 (rng.hpp): Randomize 12.34 deja 0xEE3C en los bits 8-23 del
  // estado (fresh => 0xEE3C00). La semilla 1234 hace Randomize 12.34.
  assert.equal(estadoSemilla(1234).mezcla, 0xee3c);
  assert.equal((estadoSemilla(1234).estado >> 8) & 0xffff, 0xee3c);
  // El byte bajo sale de Rnd -1 y es el mismo para toda semilla.
  const fijo = estadoSemilla(1).estado & 0xff;
  for (const s of [0, 7, 4242, -9, 2147483646]) assert.equal(estadoSemilla(s).estado & 0xff, fijo);
  // CLng: redondeo al par en los medios; −0 y 0 son el mismo mundo; se acota a int32.
  assert.equal(estadoSemilla(12.5).mezcla, estadoSemilla(12).mezcla);
  assert.equal(estadoSemilla(13.5).mezcla, estadoSemilla(14).mezcla);
  assert.equal(estadoSemilla(-0.4).mezcla, estadoSemilla(0).mezcla);
  assert.equal(estadoSemilla(3e9).mezcla, estadoSemilla(2147483647).mezcla);
  // Hay semillas distintas con el mismo mundo (65.536 mundos).
  const vistos = new Map();
  let choque = null;
  for (let s = 1; s < 200000 && !choque; s++) {
    const m = estadoSemilla(s).mezcla;
    if (vistos.has(m)) choque = [vistos.get(m), s];
    else vistos.set(m, s);
  }
  assert.ok(choque, 'hay choques');
  assert.ok(MUNDOS_DISTINTOS === 65536);
});

test('C19: las réplicas no repiten un mundo del motor (y la primera sigue siendo la base)', () => {
  const s = semillasReplicas(4242, 64);
  const mundos = s.map((x) => estadoSemilla(x).mezcla);
  assert.equal(new Set(mundos).size, 64, 'mundos distintos');
  assert.equal(s[0], 4242);
  // Muchas bases: nunca un mundo repetido dentro de un trabajo.
  for (let b = 1; b <= 300; b++) {
    const m = semillasReplicas(b * 7919, 64).map((x) => estadoSemilla(x).mezcla);
    assert.equal(new Set(m).size, 64, `base ${b * 7919}`);
  }
});

test('crearParametros valida y guarda el ADN, las semillas y los eventos', () => {
  const c = /** @type {any} */ ({ eventos: [] });
  registrarCambio(c, 50, { 'base:minVegs': 30 });
  const p = crearParametros({
    escenario: ESC,
    adn: ADN,
    semilla: 9,
    n: 3,
    ciclos: 1000,
    eventos: c.eventos,
    origen: { nombre: 'x', id: 'c-1' },
  });
  assert.equal(p.semillas.length, 3);
  assert.equal(p.semillas[0], 9);
  assert.deepEqual(p.adn, ADN);
  assert.equal(p.cada, 100);
  assert.equal(p.metrica, 'vivos');
  assert.deepEqual(p.eventos, c.eventos);
  assert.notEqual(p.eventos, c.eventos, 'copia');
  /** @param {any} o @param {string} codigo */
  const falla = (o, codigo) =>
    assert.throws(
      () => crearParametros({ escenario: ESC, adn: ADN, semilla: 1, n: 2, ciclos: 100, ...o }),
      (e) => e instanceof ErrorReplicas && e.codigo === codigo,
    );
  falla({ escenario: null }, 'sin-escenario');
  falla({ n: 0 }, 'n');
  falla({ n: MAX_REPLICAS + 1 }, 'n');
  falla({ ciclos: 0 }, 'ciclos');
  falla({ cada: 500 }, 'cada');
  falla({ adn: [ADN[0], undefined] }, 'sin-adn');
  falla({ metrica: 'nada' }, 'metrica');
  falla({ semilla: Number.NaN }, 'semilla');
});

test('mensajesReplica: reset limpio con la semilla de la réplica, muestreo barato y eventos', () => {
  const c = /** @type {any} */ ({ eventos: [] });
  registrarCambio(c, 50, { 'base:minVegs': 30, 'opt:14': 0 });
  const p = crearParametros({
    escenario: ESC,
    adn: ADN,
    semilla: 9,
    n: 2,
    ciclos: 1000,
    eventos: c.eventos,
  });
  const m = mensajesReplica(p, 1);
  const reset = m.inicio.find((x) => x.t === 'reset');
  assert.equal(reset.seed, p.semillas[1]);
  assert.equal(reset.limpio, true);
  assert.equal(reset.species[1].dna, ADN[1]);
  assert.deepEqual(m.muestreo, { t: 'muestreo', cada: 100, grupos: ['poblacion'] });
  assert.equal(m.eventos.length, 1);
  assert.equal(m.eventos[0].ciclo, 50);
  assert.deepEqual(
    m.eventos[0].mensajes.map((x) => x.t),
    ['setbase', 'setopt'],
  );
  assert.throws(() => mensajesReplica(p, 2), ErrorReplicas);
});

test('planReplica: eventos en su ciclo, los de ciclo < 0 al arranque (0 = tras el primer tick)', () => {
  const ev = (/** @type {number} */ ciclo, /** @type {string} */ x) => ({
    ciclo,
    mensajes: [{ t: x }],
  });
  assert.deepEqual(planReplica([], -1, 500), [{ ciclo: 500, mensajes: [] }]);
  assert.deepEqual(
    planReplica(
      [ev(-1, 'a'), ev(0, 'z'), ev(100, 'b'), ev(100, 'c'), ev(500, 'd'), ev(700, 'e')],
      -1,
      500,
    ),
    [
      { ciclo: -1, mensajes: [{ t: 'a' }] },
      { ciclo: 0, mensajes: [{ t: 'z' }] },
      { ciclo: 100, mensajes: [{ t: 'b' }, { t: 'c' }] },
      { ciclo: 500, mensajes: [{ t: 'd' }] },
    ],
  );
  assert.throws(() => planReplica([ev(200, 'a'), ev(100, 'b')], -1, 500), ErrorReplicas);
  // Corrida vieja: su 0 (que podía ser «antes del primer tick») se toma al pie de la letra.
  assert.deepEqual(planReplica([ev(0, 'v')], -1, 10), [
    { ciclo: 0, mensajes: [{ t: 'v' }] },
    { ciclo: 10, mensajes: [] },
  ]);
});

test('percentil (tipo 7) y media/desvío muestral', () => {
  assert.ok(Number.isNaN(percentil([], 0.5)));
  assert.equal(percentil([4], 0.9), 4);
  const l = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentil(l, 0), 1);
  assert.equal(percentil(l, 1), 10);
  assert.ok(Math.abs(percentil(l, 0.1) - 1.9) < 1e-12);
  assert.ok(Math.abs(percentil(l, 0.9) - 9.1) < 1e-12);
  assert.equal(percentil(l, 0.5), 5.5);
  const md = mediaDesvio([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(md.media, 5);
  assert.ok(Math.abs(md.desvio - Math.sqrt(32 / 7)) < 1e-12);
  assert.deepEqual(mediaDesvio([3]), { media: 3, desvio: 0 });
});

test('agregarSeries alinea por ciclo exacto, con n por ciclo y sin valores no finitos', () => {
  const a = agregarSeries([
    { t: [0, 100, 200], v: [1, 2, 3] },
    { t: [0, 100, 200, 300], v: [3, 4, Number.NaN, 10] },
    { t: [100, 200], v: [6, 9] },
  ]);
  assert.deepEqual(a.t, [0, 100, 200, 300]);
  assert.deepEqual(a.n, [2, 3, 2, 1]);
  assert.deepEqual(a.media, [2, 4, 6, 10]);
  assert.deepEqual(a.min, [1, 2, 3, 10]);
  assert.deepEqual(a.max, [3, 6, 9, 10]);
  assert.ok(Math.abs(a.p10[1] - 2.4) < 1e-12);
  assert.ok(Math.abs(a.p90[1] - 5.6) < 1e-12);
  assert.deepEqual(agregarSeries([]).t, []);
});

/** Historia de réplica armada a mano: vivos = f(ciclo). @param {(c: number) => number} f @param {number} hasta */
function hist(f, hasta, cada = 100) {
  const h = historiaReplica({ cada, maxPuntos: 500 });
  for (let c = 0; c <= hasta; c += cada) {
    const metrics = new Float32Array(METRICAS.length);
    metrics[0] = c;
    metrics[2] = f(c);
    metrics[3] = 7;
    agregarMuestra(h, { ciclo: c, metrics });
  }
  return h;
}

test('agregarReplicas y tablaReplicas sobre historias serializadas (null = sin terminar)', () => {
  const rs = [
    hist((c) => c / 100, 1000).serializar(),
    hist((c) => 2 * (c / 100), 1000).serializar(),
    null,
    hist((c) => 3 * (c / 100), 1000),
  ];
  const a = agregarReplicas(rs, 'vivos');
  assert.equal(a.t.length, 11);
  assert.deepEqual(a.n, new Array(11).fill(3));
  assert.equal(a.media[10], 20);
  assert.equal(a.min[10], 10);
  assert.equal(a.max[10], 30);
  const tab = tablaReplicas(rs, ['vivos', 'vegetales', 'noVegetales']);
  assert.equal(tab[0].clave, 'vivos');
  assert.equal(tab[0].n, 3);
  assert.equal(tab[0].media, 20);
  assert.equal(tab[0].desvio, 10);
  assert.equal(tab[0].ciclo, 1000);
  assert.equal(tab[1].media, 7);
  assert.equal(tab[1].desvio, 0);
  assert.equal(tab[2].media, 0);
  assert.deepEqual(serieDe(rs[0], 'nada'), { t: [], v: [] });
  const vacia = tablaReplicas([null], ['vivos'])[0];
  assert.equal(vacia.n, 0);
  assert.ok(Number.isNaN(vacia.media));
});

test('historias largas se funden igual en todas las réplicas: siguen alineadas', () => {
  const rs = [1, 2].map((k) => {
    const h = historiaReplica({ cada: 10, maxPuntos: 16 });
    for (let c = 0; c <= 1000; c += 10) {
      const metrics = new Float32Array(METRICAS.length);
      metrics[2] = k * c;
      agregarMuestra(h, { ciclo: c, metrics });
    }
    return h.serializar();
  });
  const t0 = Historia.deserializar(rs[0]).t;
  assert.ok(t0.length <= 16);
  assert.deepEqual(Historia.deserializar(rs[1]).t, t0);
  const a = agregarReplicas(rs, 'vivos');
  assert.deepEqual(a.n, new Array(t0.length).fill(2));
});

test('grupos de Comparar: seis, sin repetir, métricas que existen', () => {
  assert.deepEqual(Object.keys(GRUPOS_COMPARAR), [
    'poblacion',
    'evolucion',
    'genetica',
    'comportamiento',
    'energia',
    'entorno',
  ]);
  const todas = Object.values(GRUPOS_COMPARAR).flat();
  assert.equal(new Set(todas).size, todas.length);
  const claves = new Set(METRICAS.map((m) => m.clave));
  for (const k of todas) assert.ok(claves.has(k), k);
  for (const k of METRICAS_CLAVE) assert.ok(grupoDe(k), k);
  assert.equal(grupoDe('ciclo'), undefined);
});
