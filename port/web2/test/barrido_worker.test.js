// @ts-check
// Barrido de parámetros con el worker real (engine/worker.js en
// worker_threads): un barrido chico (2 valores × 2 semillas) por la cola
// con el ejecutor de barrido termina, cada unidad da lo MISMO que una
// réplica del escenario con ese valor y esa semilla (C15), y el valor del
// parámetro cambia el resultado.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import {
  agregarBarrido,
  crearParametrosBarrido,
  escenarioCon,
  TIPO_BARRIDO,
  unidadDe,
  unidadesBarrido,
  valorFinal,
} from '../engine/barrido.js';
import { Cola } from '../engine/cola.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { Historia } from '../engine/history.js';
import { crearParametros, historiaDe } from '../engine/replicas.js';
import { ejecutorBarrido } from '../src/lib/trabajos/ejecutores.js';
import { PoolWorkers } from '../src/lib/trabajos/pool.js';
import { correrReplica } from '../src/lib/trabajos/replica.js';
import { workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const BOTS = hayWasm()
  ? JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'))
  : [];
/** @param {{bot: string}} s */
const adnDe = (s) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};

const ESC = /** @type {any} */ (escenarioFabrica('sopa-primordial'));
const CICLOS = 160;
const CADA = 40;

/** Worker del arnés como WorkerTrabajo del pool. */
function workerTrabajo() {
  const w = workerEngine();
  return {
    canal: {
      enviar: (/** @type {any} */ m) => w.postMessage(m),
      on: (/** @type {(m: any) => void} */ fn) => {
        w.on('message', fn);
        return () => {
          w.off('message', fn);
        };
      },
      alError: (/** @type {(e: any) => void} */ fn) => {
        w.on('error', fn);
        return () => {
          w.off('error', fn);
        };
      },
    },
    terminar: () => {
      void w.terminate();
    },
  };
}

/** Columnas globales de una historia (t y media), para comparar. @param {any} r */
function huella(r) {
  const h = historiaDe(r);
  const out = { t: [...h.t], cols: /** @type {Record<string, any[]>} */ ({}) };
  for (const k of Historia.columnas.global)
    out.cols[k] = /** @type {any} */ (h.serie(k)).media.map((/** @type {number} */ v) =>
      Number.isNaN(v) ? 'NaN' : v,
    );
  return out;
}

test('barrido en la cola = réplicas del escenario con cada valor; el valor cambia el resultado', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const p = crearParametrosBarrido({
    escenario: ESC,
    adn: ESC.especies.map(adnDe),
    semilla: 4242,
    n: 2,
    ciclos: CICLOS,
    cada: CADA,
    clave: 'base:maxEnergy',
    grilla: { modo: 'lista', valores: [2, 400] },
    metricas: ['nrgTotal', 'vivos'],
    origen: { nombre: 'prueba' },
  });
  const pool = new PoolWorkers({ crear: workerTrabajo, ociosoMs: 0 });
  const cola = new Cola({
    almacen: almacenMemoria(),
    ejecutores: { [TIPO_BARRIDO]: ejecutorBarrido({ pool, tanda: 40 }) },
    paralelo: 2,
  });
  try {
    const id = await cola.encolar({ tipo: TIPO_BARRIDO, params: p, unidades: unidadesBarrido(p) });
    const fin = await cola.esperar(id);
    assert.equal(fin?.estado, 'terminado', fin?.error);
    const res = await cola.resultados(id);
    assert.equal(res.length, 4);
    for (const r of res) assert.equal(historiaDe(r).ultimoCiclo, CICLOS);

    // Cada unidad = la réplica del escenario con ese valor y esa semilla, en otro worker.
    const aparte = new PoolWorkers({ crear: workerTrabajo, ociosoMs: 0 });
    const w = await aparte.tomar();
    try {
      for (const [v, s] of [
        [1, 1],
        [0, 0],
      ]) {
        const rep = crearParametros({
          escenario: escenarioCon(ESC, p.clave, p.valores[v]),
          adn: p.adn,
          semilla: p.semillas[s],
          n: 1,
          ciclos: CICLOS,
          cada: CADA,
          maxPuntos: p.maxPuntos,
        });
        const r = await correrReplica({ canal: w.canal, params: rep, i: 0, tanda: 64 });
        assert.deepEqual(
          huella(res[unidadDe(p, v, s)]),
          huella(r),
          `valor ${p.valores[v]} × semilla ${p.semillas[s]} = su réplica`,
        );
      }
    } finally {
      aparte.cerrarTodos();
    }

    for (let s = 0; s < 2; s++)
      assert.notEqual(
        valorFinal(res[unidadDe(p, 0, s)], 'nrgTotal'),
        valorFinal(res[unidadDe(p, 1, s)], 'nrgTotal'),
        'la energía solar cambia la energía total',
      );
    const filas = agregarBarrido(p, res);
    assert.deepEqual(
      filas.map((f) => [f.valor, f.n]),
      [
        [2, 2],
        [400, 2],
      ],
    );
    assert.deepEqual(
      fin?.resumen?.filas?.map((/** @type {any} */ f) => f.n),
      [2, 2],
    );
  } finally {
    cola.detener();
    pool.cerrarTodos();
  }
});
