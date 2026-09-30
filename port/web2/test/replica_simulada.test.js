// @ts-check
// src/lib/trabajos/replica.js con un worker SIMULADO (sin wasm): la última
// muestra cruda de una réplica larga (la historia ya fundió puntos), la
// tabla de valores finales sobre esa muestra, una ronda que se reinicia
// (opt 90 / F1: el ciclo vuelve atrás) y un ciclo que se adelanta (desfase).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { Historia } from '../engine/history.js';
import { METRICAS } from '../engine/metricas.js';
import { crearParametros, finalDe, historiaDe, tablaReplicas } from '../engine/replicas.js';
import { correrReplica } from '../src/lib/trabajos/replica.js';

const ESC = /** @type {any} */ (escenarioFabrica('sopa-primordial'));
const ADN = ESC.especies.map((/** @type {any} */ s) => `cond start *.nrg ${s.bot.length} stop`);
const I_VIVOS = METRICAS.findIndex((m) => m.clave === 'vivos');

/**
 * Worker simulado: step = un tick, muestra cada `cada` ciclos (y al
 * configurar el muestreo si la sim ya tuvo su primer tick), {t:'ciclo'}
 * contesta el ciclo. Los mensajes llegan en orden y asíncronos.
 * @param {{vivos?: (c: number) => number, reiniciarEn?: number, paso?: number}} [o]
 */
function workerSimulado(o = {}) {
  const vivos = o.vivos ?? ((c) => (c % 1000) + c / 1000);
  /** @type {Set<(m: any) => void>} */
  const oyentes = new Set();
  let ciclo = -1;
  let cada = 0;
  /** @type {any} */
  let req;
  let reiniciado = false;
  /** @param {any} m */
  const emitir = (m) =>
    queueMicrotask(() => {
      for (const fn of [...oyentes]) fn(m);
    });
  const muestra = () => {
    const metrics = new Float32Array(METRICAS.length);
    metrics[0] = ciclo;
    metrics[I_VIVOS] = vivos(ciclo);
    emitir({ t: 'muestra', req, ciclo, metrics });
  };
  return {
    enviar(/** @type {any} */ m) {
      if (m.t === 'reset') ciclo = -1;
      else if (m.t === 'muestreo') {
        cada = m.cada;
        req = m.req;
        if (cada > 0 && ciclo >= 0) muestra();
      } else if (m.t === 'step') {
        ciclo += o.paso ?? 1;
        if (o.reiniciarEn !== undefined && !reiniciado && ciclo === o.reiniciarEn) {
          // Ronda nueva: otra sim, el ciclo vuelve atrás.
          reiniciado = true;
          ciclo = -1;
          return;
        }
        if (cada > 0 && ciclo >= 0 && ciclo % cada === 0) muestra();
      } else if (m.t === 'ciclo') emitir({ t: 'ciclo', req: m.req, cycle: ciclo });
    },
    on(/** @type {(m: any) => void} */ fn) {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
  };
}

/** @param {number} ciclos @param {number} [n] */
const params = (ciclos, n = 2) =>
  crearParametros({ escenario: ESC, adn: ADN, semilla: 11, n, ciclos, cada: 100 });

test('réplica larga (> 90.000 ciclos): la muestra final es la cruda, no el punto fundido', {
  timeout: 120000,
}, async () => {
  const objetivo = 100_000;
  const p = params(objetivo);
  const f1 = (/** @type {number} */ c) => (c % 1000) + c / 1000;
  const f2 = (/** @type {number} */ c) => 2 * ((c % 1000) + c / 1000) + 1;
  const r1 = await correrReplica({
    canal: workerSimulado({ vivos: f1 }),
    params: p,
    i: 0,
    tanda: 2000,
  });
  const r2 = await correrReplica({
    canal: workerSimulado({ vivos: f2 }),
    params: p,
    i: 1,
    tanda: 2000,
  });
  assert.equal(r1.reinicio, undefined);
  const fin = finalDe(r1);
  assert.equal(fin?.ciclo, objetivo);
  assert.equal(fin?.metrics[I_VIVOS], Math.fround(f1(objetivo)));
  // La historia fundió puntos (1.001 muestras en ≤ 500 puntos): los puntos
  // son medias; la tabla no depende de cómo quede el último.
  const h = historiaDe(r1);
  assert.ok(h.t.length <= p.maxPuntos, 'historia con presupuesto');
  assert.ok(h.nivel > 1, 'hubo fusión');
  const s = /** @type {any} */ (h.serie('vivos'));
  assert.equal(s.t[s.t.length - 1], objetivo);
  // La tabla usa la muestra cruda de cada réplica.
  const tab = tablaReplicas([r1, r2], ['vivos'])[0];
  const v1 = Math.fround(f1(objetivo));
  const v2 = Math.fround(f2(objetivo));
  assert.equal(tab.n, 2);
  assert.equal(tab.ciclo, objetivo);
  assert.ok(Math.abs(tab.media - (v1 + v2) / 2) < 1e-9);
  assert.equal(tab.min, Math.min(v1, v2));
  assert.equal(tab.max, Math.max(v1, v2));
  // Aunque el último punto de la historia fuera otro (fundido), manda la muestra final.
  const otra = { ...r1, final: { ciclo: objetivo, metrics: [...r1.final.metrics] } };
  otra.final.metrics[I_VIVOS] = 12345;
  assert.equal(tablaReplicas([otra], ['vivos'])[0].media, 12345);
  // Un resultado viejo (historia serializada sola) sigue sirviendo: último punto.
  const viejo = tablaReplicas([r1.historia], ['vivos'])[0];
  assert.equal(viejo.n, 1);
  assert.equal(viejo.ciclo, objetivo);
  assert.ok(Historia.deserializar(r1.historia) instanceof Historia);
});

test('ronda reiniciada (el ciclo vuelve atrás): la réplica termina ahí, sin «desfase»', async () => {
  const p = params(1000, 1);
  /** @type {number[]} */
  const avance = [];
  const r = await correrReplica({
    canal: workerSimulado({ reiniciarEn: 350 }),
    params: p,
    i: 0,
    tanda: 40,
    progreso: (fr) => avance.push(fr),
  });
  assert.ok(r.reinicio, 'marca el reinicio');
  assert.ok(/** @type {any} */ (r.reinicio).ciclo < /** @type {any} */ (r.reinicio).esperado);
  assert.equal(finalDe(r)?.ciclo, 300, 'la muestra final es la de antes del reinicio');
  assert.equal(historiaDe(r).ultimoCiclo, 300);
  assert.equal(avance[avance.length - 1], 1);
  // En la tabla cuenta con su ciclo final.
  assert.equal(tablaReplicas([r], ['vivos'])[0].ciclo, 300);
});

test('ronda reiniciada justo en una muestra: se detecta por la muestra que no avanza', async () => {
  const p = params(1000, 1);
  const r = await correrReplica({
    canal: workerSimulado({ reiniciarEn: 400 }),
    params: p,
    i: 0,
    tanda: 1000,
    enVuelo: 1,
  });
  assert.ok(r.reinicio);
  assert.equal(finalDe(r)?.ciclo, 300);
});

test('un ciclo que se adelanta sí es un error (desfase)', async () => {
  await assert.rejects(
    correrReplica({ canal: workerSimulado({ paso: 2 }), params: params(500, 1), i: 0, tanda: 10 }),
    (e) => /** @type {any} */ (e).codigo === 'desfase',
  );
});
