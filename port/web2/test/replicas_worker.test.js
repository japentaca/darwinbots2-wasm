// @ts-check
// Reproducibilidad de las réplicas (decisión 10, C15) con el worker real
// (engine/worker.js en worker_threads, test/util/arnes-worker.js):
//
//   1. Una réplica corrida por la cola (engine/cola.js + ejecutor de réplicas
//      + pool) da la MISMA historia que la misma semilla corrida sola, a mano,
//      en un worker aparte (steps de a uno y los eventos en su ciclo).
//   2. Dos réplicas en paralelo en workers distintos no se contaminan (cada
//      una igual a su corrida sola), y en un solo worker reutilizado (una
//      tras otra) tampoco.
//   3. Los cambios en caliente se repiten en el mismo ciclo: con el evento la
//      historia difiere de la de sin él, y es la de aplicarlo en ese ciclo.
//   4. Una réplica abortada a mitad (worker descartado) y reiniciada desde
//      cero da lo mismo.
//   5. C19: dos semillas con el mismo estado del generador del motor
//      (estadoSemilla) dan la misma historia y el mismo .dbsim salvo el
//      campo de la semilla; con otro estado, otro mundo.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { Cola } from '../engine/cola.js';
import { mensajesEvento, registrarCambio, registrarSiembra } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar } from '../engine/escenarios/index.js';
import { Historia } from '../engine/history.js';
import {
  agregarMuestra,
  crearParametros,
  estadoSemilla,
  historiaDe,
  historiaReplica,
  semillasReplicas,
  TIPO_REPLICAS,
} from '../engine/replicas.js';
import { ejecutorReplicas } from '../src/lib/trabajos/ejecutores.js';
import { PoolWorkers } from '../src/lib/trabajos/pool.js';
import { correrReplica } from '../src/lib/trabajos/replica.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const BOTS = hayWasm()
  ? JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'))
  : [];
/** @param {{bot: string}} s */
const adnDe = (s) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};

const CICLOS = 330; // no múltiplo de CADA: la última muestra se pide al llegar
const CADA = 25;
const ESC = /** @type {any} */ (escenarioFabrica('sopa-primordial'));

/** Eventos de una corrida: un cambio en caliente (ciclo 120) y una siembra (ciclo 200). */
function eventos() {
  const c = /** @type {any} */ ({ eventos: [] });
  registrarCambio(c, 120, { 'base:minVegs': 40 });
  registrarSiembra(c, 200, {
    nombre: 'Alga minimalis 3.0',
    adn: /** @type {string} */ (adnDe({ bot: 'Alga minimalis 3.0' })),
    cantidad: 4,
    color: '#20a0ff',
    vegetal: true,
    energia: 3000,
  });
  return c.eventos;
}

/** @param {any[]} evs @param {number} n */
function params(evs, n) {
  return crearParametros({
    escenario: ESC,
    adn: ESC.especies.map(adnDe),
    semilla: 4242,
    n,
    ciclos: CICLOS,
    cada: CADA,
    eventos: evs,
    origen: { nombre: 'prueba' },
  });
}

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

/**
 * La misma semilla corrida sola, a mano, sin la cola ni replica.js: steps de
 * a uno y los mensajes de cada evento cuando la sim está en su ciclo.
 * @param {number} semilla @param {any[]} evs
 */
async function corridaSola(semilla, evs) {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    for (const m of aplicar(ESC, semilla, adnDe)) c.send(m);
    c.send({ t: 'muestreo', cada: CADA, grupos: ['poblacion'], req: 'sola' });
    c.send({ t: 'ciclo', req: 'c0' });
    const c0 = (await c.wait((m) => m.t === 'ciclo' && m.req === 'c0')).cycle;
    assert.equal(c0, -1, 'la sim nueva arranca en −1');
    let ciclo = c0;
    for (const ev of evs) {
      for (; ciclo < ev.ciclo; ciclo++) c.send({ t: 'step' });
      for (const m of mensajesEvento(ev)) c.send(m);
    }
    for (; ciclo < CICLOS; ciclo++) c.send({ t: 'step' });
    c.send({ t: 'muestreo', cada: CADA, grupos: ['poblacion'], req: 'sola' });
    c.send({ t: 'ciclo', req: 'fin' });
    const fin = await c.wait((m) => m.t === 'ciclo' && m.req === 'fin', 300000);
    assert.equal(fin.cycle, CICLOS);
    assert.ok(!c.error, String(c.error));
    const h = historiaReplica({ cada: CADA, maxPuntos: 500 });
    for (const m of c.msgs) if (m.t === 'muestra' && m.req === 'sola') agregarMuestra(h, m);
    return h;
  } finally {
    await c.stop();
  }
}

/** Todas las columnas globales de una historia (t y media), para comparar. @param {any} r */
function huella(r) {
  const h = historiaDe(r);
  const out = { t: [...h.t], cols: /** @type {Record<string, number[]>} */ ({}) };
  for (const k of Historia.columnas.global)
    out.cols[k] = /** @type {any} */ (h.serie(k)).media.map((/** @type {number} */ v) =>
      Number.isNaN(v) ? 'NaN' : v,
    );
  return out;
}

test('réplicas en la cola = la misma semilla corrida sola; sin contaminación entre workers', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const evs = eventos();
  const p = params(evs, 2);
  const pool = new PoolWorkers({ crear: workerTrabajo, ociosoMs: 0 });
  const cola = new Cola({
    almacen: almacenMemoria(),
    ejecutores: { [TIPO_REPLICAS]: ejecutorReplicas({ pool, tanda: 37 }) },
    paralelo: 2,
  });
  try {
    const id = await cola.encolar({ tipo: TIPO_REPLICAS, params: p, unidades: 2 });
    const [fin, solas] = await Promise.all([
      cola.esperar(id),
      Promise.all(p.semillas.map((s) => corridaSola(s, evs))),
    ]);
    assert.equal(fin?.estado, 'terminado', fin?.error);
    assert.equal(pool.tamaño, 2, 'dos workers en paralelo');
    const res = await cola.resultados(id);
    for (let i = 0; i < 2; i++) {
      const a = huella(res[i]);
      assert.equal(a.t[a.t.length - 1], CICLOS, 'la historia termina en el objetivo');
      assert.equal(a.t[0], 0);
      assert.deepEqual(a, huella(solas[i]), `réplica ${i + 1} = su corrida sola`);
    }
    assert.notDeepEqual(huella(res[0]).cols.vivos, huella(res[1]).cols.vivos, 'semillas distintas');
    assert.equal(fin?.resumen?.tabla?.[0]?.n, 2);

    // En un solo worker reutilizado, una tras otra: lo mismo.
    const uno = new PoolWorkers({ crear: workerTrabajo, ociosoMs: 0 });
    const w = await uno.tomar();
    try {
      for (const i of [1, 0]) {
        const r = await correrReplica({ canal: w.canal, params: p, i, tanda: 64 });
        assert.deepEqual(huella(r), huella(solas[i]), `réplica ${i + 1} en worker usado`);
      }
    } finally {
      uno.cerrarTodos();
    }
  } finally {
    cola.detener();
    pool.cerrarTodos();
  }
});

test('el cambio en caliente se repite en su ciclo; una réplica abortada y reiniciada da lo mismo', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const evs = eventos();
  const conEv = params(evs, 1);
  const sinEv = params([], 1);
  const pool = new PoolWorkers({ crear: workerTrabajo, ociosoMs: 0 });
  try {
    const w1 = await pool.tomar();
    const rSin = await correrReplica({ canal: w1.canal, params: sinEv, i: 0 });
    pool.soltar(w1);
    // Abortada a mitad (como cancelar o recargar la página): el worker se descarta.
    const ctl = new AbortController();
    const w2 = await pool.tomar();
    await assert.rejects(
      correrReplica({
        canal: w2.canal,
        params: conEv,
        i: 0,
        senal: ctl.signal,
        tanda: 10,
        progreso: (fr) => {
          if (fr > 0.3) ctl.abort();
        },
      }),
      (e) => /** @type {any} */ (e).codigo === 'abortada',
    );
    pool.descartar(w2);
    const w3 = await pool.tomar();
    const rCon = await correrReplica({ canal: w3.canal, params: conEv, i: 0 });
    pool.soltar(w3);
    const sola = await corridaSola(conEv.semillas[0], evs);
    assert.deepEqual(huella(rCon), huella(sola), 'reiniciada desde cero = corrida sola');
    const a = huella(rCon);
    const b = huella(rSin);
    const i120 = a.t.indexOf(100);
    assert.deepEqual(a.cols.vivos.slice(0, i120 + 1), b.cols.vivos.slice(0, i120 + 1));
    assert.notDeepEqual(a.cols.vivos, b.cols.vivos, 'los eventos cambian la réplica');
  } finally {
    pool.cerrarTodos();
  }
});

/**
 * .dbsim tras `ciclos` ciclos de la semilla, con fecha y azar de host fijos
 * (strSimStart y el Timer de las skins van en el archivo).
 * @param {number} semilla @param {number} ciclos
 */
async function dbsim(semilla, ciclos) {
  const c = new ClienteSim(workerEngine({ fechaFija: Date.UTC(2026, 0, 1), semillaAzar: 1 }), {
    copiarFrames: false,
  });
  try {
    await c.wait((m) => m.t === 'ready');
    for (const m of aplicar(ESC, semilla, adnDe)) c.send(m);
    for (let i = 0; i < ciclos; i++) c.send({ t: 'step' });
    c.send({ t: 'save', req: 'fin' });
    const m = await c.wait((x) => x.t === 'saved' && x.req === 'fin', 300000);
    return Buffer.from(new Uint8Array(m.bytes));
  } finally {
    await c.stop();
  }
}

/** Índices de los bytes distintos. @param {Buffer} a @param {Buffer} b */
function bytesDistintos(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

test('C19: dos semillas con el mismo estado del generador dan el mismo mundo; con otro estado, no', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  // Semillas que el motor ve como el mismo mundo (misma mezcla de 16 bits) y una que no.
  const base = 4242;
  const mezcla = estadoSemilla(base).mezcla;
  let gemela = 0;
  for (let s = base + 1; !gemela; s++) if (estadoSemilla(s).mezcla === mezcla) gemela = s;
  const otra = base + 1;
  assert.notEqual(estadoSemilla(otra).mezcla, mezcla);
  // Historia: la gemela da exactamente la misma.
  const [ha, hb] = await Promise.all([base, gemela].map((s) => corridaSola(s, [])));
  assert.deepEqual(huella(hb), huella(ha), `${gemela} = ${base} (mismo mundo)`);
  // .dbsim tras 200 ciclos: con la gemela solo cambia la semilla guardada
  // (un Long: ≤ 4 bytes seguidos); con otro estado cambia el mundo.
  const [a, b, c] = await Promise.all([base, gemela, otra].map((s) => dbsim(s, 200)));
  const db = bytesDistintos(a, b);
  assert.ok(db.length >= 1 && db.length <= 4, `gemela: ${db.length} bytes distintos`);
  assert.ok(db[db.length - 1] - db[0] < 4, 'solo el campo de la semilla');
  const dc = bytesDistintos(a, c);
  assert.ok(dc.length > 50, `otra: ${dc.length} bytes distintos (otro mundo)`);
  // semillasReplicas nunca elige la gemela junto a la base.
  const s = semillasReplicas(base, 64);
  assert.equal(new Set(s.map((x) => estadoSemilla(x).mezcla)).size, s.length);
});
