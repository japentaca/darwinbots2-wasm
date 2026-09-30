// @ts-check
// Barra «Mundo» (paso N3.8, decisiones 13 y 15) contra engine/worker.js REAL:
// una corrida con la sim CORRIENDO recibe órdenes de objeto en caliente
// (formas, tandas de 10, laberintos, teleporters y sus borrados, incluidos
// los que sortean con el azar del motor) por NucleoCorrida.aplicarObjetos,
// que las registra en su ciclo exacto. Después:
//   - la réplica de la cola (src/lib/trabajos/replica.js, con los eventos de
//     la corrida) da el MISMO .dbsim byte a byte que la corrida interactiva;
//   - la misma semilla corrida paso a paso a mano (steps de a uno y cada
//     evento en su ciclo) da el mismo .dbsim y la misma historia que la
//     réplica;
//   - control: la réplica sin los eventos de objetos da otro .dbsim.
// Misma fecha en todos los workers (strSimStart va en el .dbsim) y distinto
// Math.random (los colores de las formas salen del LCG sembrado, C15).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { crearCorridas, mensajesEvento } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar } from '../engine/escenarios/index.js';
import { Historia } from '../engine/history.js';
import {
  agregarMuestra,
  crearParametros,
  historiaDe,
  historiaReplica,
} from '../engine/replicas.js';
import { orden } from '../src/lib/observar/objetos/ordenes.js';
import { estadoVacio, NucleoCorrida } from '../src/lib/sim/corrida-nucleo.js';
import { correrReplica } from '../src/lib/trabajos/replica.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';
import { sesionNode } from './util/sesion-node.js';

const SKIP = { skip: hayWasm() ? false : SIN_WASM, timeout: 600000 };
const FECHA = Date.UTC(2026, 8, 29, 12, 0, 0);
const SEMILLA = 2468;
const CADA = 25;

const BOTS = hayWasm()
  ? JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'))
  : [];
/** @param {{bot: string}} s */
const adnDe = (s) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};

const ESC = /** @type {import('../engine/escenarios/index.js').Escenario} */ (
  escenarioFabrica('laberinto')
);

/** Las órdenes de la prueba, en el orden en que se aplican. */
const ORDENES = [
  orden('forma', { ancho: 0.1, alto: 0.15 }),
  orden('formas', { ancho: 0.05, alto: 0.05 }),
  orden('teleporter'),
  orden('borrar-forma', { n: 2 }),
  orden('borrar-formas10'),
  orden('laberinto', { forma: 'checker', pasillo: 900, muro: 50 }),
  orden('teleporter'),
  orden('borrar-teleporter', { n: 1 }),
  orden('laberinto', { forma: 'polar' }),
];

/** Worker del arnés como canal de replica.js (con la fecha fija). @param {number} azar */
function canalWorker(azar) {
  const w = workerEngine({ fechaFija: FECHA, semillaAzar: azar });
  return {
    w,
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
  };
}

/** .dbsim de un worker del arnés. @param {import('node:worker_threads').Worker} w */
function guardarDe(w) {
  return new Promise((res) => {
    /** @param {any} m */
    const fn = (m) => {
      if (m?.t === 'saved' && m.req === 'fin') {
        w.off('message', fn);
        res(Buffer.from(new Uint8Array(m.bytes)));
      }
    };
    w.on('message', fn);
    w.postMessage({ t: 'save', req: 'fin' });
  });
}

/** Todas las columnas globales de una historia (t y media). @param {any} h */
function huella(h) {
  const out = { t: [...h.t], cols: /** @type {Record<string, any[]>} */ ({}) };
  for (const k of Historia.columnas.global)
    out.cols[k] = h.serie(k).media.map((/** @type {number} */ v) => (Number.isNaN(v) ? 'NaN' : v));
  return out;
}

/** @param {Buffer} a @param {Buffer} b */
function primeraDiferencia(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/**
 * La semilla paso a paso a mano: steps de a uno y los mensajes de cada
 * evento cuando la sim está en su ciclo. Devuelve historia y .dbsim.
 * @param {any[]} evs @param {number} fin
 */
async function pasoAPaso(evs, fin) {
  const c = new ClienteSim(workerEngine({ fechaFija: FECHA, semillaAzar: 77 }), {
    copiarFrames: false,
  });
  try {
    await c.wait((m) => m.t === 'ready');
    for (const m of aplicar(ESC, SEMILLA, adnDe)) c.send(m);
    c.send({ t: 'muestreo', cada: CADA, grupos: ['poblacion'], req: 'pp' });
    let ciclo = -1;
    for (const ev of evs) {
      for (; ciclo < ev.ciclo; ciclo++) c.send({ t: 'step' });
      for (const m of mensajesEvento(ev)) c.send(m);
    }
    for (; ciclo < fin; ciclo++) c.send({ t: 'step' });
    c.send({ t: 'muestreo', cada: CADA, grupos: ['poblacion'], req: 'pp' });
    c.send({ t: 'save', req: 'fin' });
    const s = await c.wait((m) => m.t === 'saved' && m.req === 'fin', 300000);
    assert.ok(!c.error, String(c.error));
    const h = historiaReplica({ cada: CADA, maxPuntos: 500 });
    for (const m of c.msgs) if (m.t === 'muestra' && m.req === 'pp') agregarMuestra(h, m);
    return { h, dbsim: Buffer.from(new Uint8Array(s.bytes)) };
  } finally {
    await c.stop();
  }
}

test(
  'objetos en caliente con la sim corriendo: la réplica y el paso a paso dan el mismo .dbsim e historia',
  SKIP,
  async (t) => {
    const a = await sesionNode({ fechaFija: FECHA, semillaAzar: 11 });
    let original;
    let eventos;
    let fin;
    try {
      const n = new NucleoCorrida({
        sesion: /** @type {any} */ (a),
        corridas: crearCorridas({ almacen: almacenMemoria() }),
        estado: estadoVacio(),
        idioma: () => 'es',
        adnDe: async (s) => adnDe(s),
      });
      assert.ok(await n.iniciar(ESC, SEMILLA));
      const avanzar = async (/** @type {number} */ k) => {
        const meta = (await a.c.ciclo()) + k;
        while (a.stats.cycle < meta) await new Promise((r) => setTimeout(r, 5));
      };
      a.c.speed(5);
      a.correr(true);
      for (const o of ORDENES) {
        await avanzar(12);
        await n.aplicarObjetos(o);
      }
      a.correr(false);
      fin = (await a.c.ciclo()) + 40;
      a.pasos(fin - (await a.c.ciclo()));
      original = Buffer.from((await a.guardarConCiclo()).bytes);
      eventos = n.estado.eventos;
      assert.equal(eventos.length, ORDENES.length);
      assert.ok(eventos.every((e) => e.tipo === 'objetos'));
      const ciclos = eventos.map((e) => e.ciclo);
      for (let i = 1; i < ciclos.length; i++)
        assert.ok(ciclos[i] > ciclos[i - 1], `ciclos crecientes: ${ciclos}`);
      assert.ok(ciclos[0] > 0);
      // «Guardar en el escenario»: órdenes del laberinto de arranque + las nuevas.
      const r = n.guardarObjetosEnEscenario();
      assert.equal(r?.aproximado, true, 'hubo borrados sueltos de formas');
      assert.equal(r?.objetos.teleporters.length, 1);
      assert.equal(r?.objetos.obstaculos.length, 5);
    } finally {
      a.cerrar();
    }

    const params = (/** @type {any[]} */ evs) =>
      crearParametros({
        escenario: ESC,
        adn: ESC.especies.map(adnDe),
        semilla: SEMILLA,
        n: 1,
        ciclos: fin,
        cada: CADA,
        eventos: evs,
      });
    const [rep, sinObjetos, pp] = await Promise.all([
      (async () => {
        const { w, canal } = canalWorker(12);
        try {
          const res = await correrReplica({ canal, params: params(eventos), i: 0, tanda: 29 });
          return { res, dbsim: await guardarDe(w) };
        } finally {
          await w.terminate();
        }
      })(),
      (async () => {
        const { w, canal } = canalWorker(13);
        try {
          await correrReplica({ canal, params: params([]), i: 0, tanda: 64 });
          return await guardarDe(w);
        } finally {
          await w.terminate();
        }
      })(),
      pasoAPaso(eventos, fin),
    ]);
    t.diagnostic(
      `ciclos de los eventos ${eventos.map((e) => e.ciclo).join(', ')}; fin ${fin}; ` +
        `.dbsim ${original.length} B; puntos de historia ${historiaDe(rep.res).t.length}`,
    );
    assert.equal(primeraDiferencia(original, rep.dbsim), -1, 'réplica ≠ corrida interactiva');
    assert.equal(primeraDiferencia(pp.dbsim, rep.dbsim), -1, 'réplica ≠ paso a paso');
    assert.deepEqual(
      huella(historiaDe(rep.res)),
      huella(pp.h),
      'historia de la réplica = paso a paso',
    );
    assert.notEqual(primeraDiferencia(original, sinObjetos), -1, 'sin los eventos, otra sim');
  },
);
