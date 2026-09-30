// @ts-check
// Rondas en segundo plano con el worker real (paso N3.4; decisiones 21, 22 y
// 23; C15): engine/worker.js en worker_threads (test/util/arnes-worker.js).
//
//   1. Test de la decisión 23: un suizo (5 participantes: con bye) y una
//      copa (8, con 3.er puesto) pequeños jugados por rondas en la cola
//      (engine/cola.js + ejecutorRonda de src/lib/trabajos/partido.js +
//      pool de 3 workers en paralelo) dan EXACTAMENTE los mismos partidos
//      (cruces, semillas, ganador, victorias, victorias al tope, ciclos) que
//      jugándolos en secuencia con engine/torneos.js (lgPlayNext → lanzar →
//      leagueOnMessage) en un solo worker que dibuja (frames con ack, a la
//      velocidad por defecto), y la misma tabla final.
//   2. El escenario efectivo (lo que corren la cola, «Jugar y mirar» y
//      «Repetir y analizar») da lo mismo que los mensajes de la clásica
//      (mensajesPartido sin `limpio`, en un worker nuevo) con las reglas F1
//      de la clásica.
//   3. «Repetir y analizar»: aplicar(escenario, semilla) + los mensajes de F1
//      de repeticionDe reproduce el partido registrado.
//   4. Un partido abortado a mitad (worker descartado) y vuelto a correr da lo
//      mismo.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { Cola } from '../engine/cola.js';
import { aplicar } from '../engine/escenarios/index.js';
import { lgSeason, lgStandings } from '../engine/league.js';
import { mensajesPartido, planPartido, reglasAOpciones } from '../engine/partido.js';
import { mensajesDelPlan, opcionesBaseClasica, TIPO_RONDA } from '../engine/rondas.js';
import { crearTorneos } from '../engine/torneos.js';
import { correrPartido, ejecutorRonda } from '../src/lib/trabajos/partido.js';
import { PoolWorkers } from '../src/lib/trabajos/pool.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { clasica, plano, rng } from './util/clasica-vm.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';
import { depsDePrueba } from './util/torneos-deps.js';

const BOTS = hayWasm()
  ? JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'))
  : [];
/** @param {string} nombre */
const adnDe = (nombre) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === nombre);
  return fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8');
};
/** Ocho bots F1 del foro (los primeros no vegetales con «(F1)» en el nombre). */
const F1_BOTS = BOTS.filter((/** @type {any} */ b) => !b.veg && /\(F1\)/.test(b.name))
  .slice(0, 8)
  .map((/** @type {any} */ b) => b.name);
// Partidos cortos: 2 bots por especie, tope de 300 ciclos por ronda y de 15
// bots por especie; gana quien llega a 2 victorias (o la regla de 3 rondas).
const VALORES = { qty: 2, rounds: 3, wins: 2, cap: 300, capMode: 'pop', popCap: 15 };
const CAMPOS = /** @type {const} */ ([
  'season',
  'no',
  'fighters',
  'seed',
  'winner',
  'wins',
  'capWins',
  'rounds',
  'cycles',
  'capRounds',
  'note',
  'format',
]);
/** @param {any[]} ms */
const huella = (ms) =>
  ms
    .slice()
    .sort((a, b) => a.season - b.season || a.no - b.no)
    .map((m) => Object.fromEntries(CAMPOS.map((k) => [k, m[k]])));

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

let F1_REGLAS = /** @type {Record<string, any> | null} */ (null);
/** Las reglas F1 de la clásica (lgF1Rules sobre su panel), una vez. */
const reglasF1 = () => {
  F1_REGLAS ??= plano(clasica().ev('lgF1Rules()'));
  return /** @type {Record<string, any>} */ (F1_REGLAS);
};

/**
 * Un torneo nuevo con el formato y los participantes dados, sobre un
 * crearTorneos con azar sembrado.
 * @param {any} deps @param {Record<string, any>} fmt @param {string[]} bots
 */
async function armar(deps, fmt, bots) {
  let n = 0;
  const T = crearTorneos(
    depsDePrueba({
      almacen: almacenMemoria(),
      nuevoId: () => `T${++n}`,
      reglasBase: reglasF1,
      ...deps,
    }),
  );
  await T.lgLoadAll();
  await T.lgCreate(reglasF1());
  for (const [k, v] of Object.entries({ ...VALORES, ...fmt })) assert.ok(await T.lgSetFmt(k, v), k);
  for (const b of bots)
    assert.ok(await T.lgAdd({ name: b, dna: adnDe(b), src: 'bestiary', file: '' }));
  return T;
}

/**
 * En secuencia: lgPlayNext → lanzar (mensajesDelPlan al worker, que dibuja:
 * el cliente devuelve cada frame con ack) → leagueOnMessage, hasta el final
 * de la temporada.
 * @param {Record<string, any>} fmt @param {string[]} bots @param {number} semilla
 */
async function enSecuencia(fmt, bots, semilla) {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  await c.wait((m) => m.t === 'ready');
  /** @type {((rec: any) => void) | null} */
  let alResultado = null;
  const azar = rng(semilla);
  const T = await armar(
    {
      azar,
      lanzar: (/** @type {any} */ plan) => {
        for (const m of mensajesDelPlan(plan)) c.send(m);
      },
      alEvento: (/** @type {any} */ ev) => {
        if (ev.t === 'resultado') alResultado?.(ev.rec);
      },
    },
    fmt,
    bots,
  );
  c.w.on('message', (m) => {
    if (m.t === 'f1-started' || m.t === 'f1-note' || m.t === 'f1-over') T.leagueOnMessage(m);
    else if (m.t === 'frame') T.lgOnStats(m.stats);
  });
  try {
    for (let guarda = 0; guarda < 200; guarda++) {
      /** @type {Promise<any>} */
      const hecho = new Promise((res) => {
        alResultado = res;
      });
      await T.lgPlayNext();
      if (!T.lg.live) break;
      await hecho;
    }
    assert.ok(!c.error, String(c.error));
    return T;
  } finally {
    await c.stop();
  }
}

/**
 * Por rondas en la cola (3 workers en paralelo), registrando cada ronda al
 * terminar.
 * @param {Record<string, any>} fmt @param {string[]} bots @param {number} semilla
 */
async function porRondas(fmt, bots, semilla) {
  const pool = new PoolWorkers({ crear: workerTrabajo, ociosoMs: 0 });
  const cola = new Cola({
    almacen: almacenMemoria(),
    ejecutores: { [TIPO_RONDA]: ejecutorRonda({ pool, cadaMs: 50 }) },
    paralelo: 3,
  });
  const T = await armar({ azar: rng(semilla) }, fmt, bots);
  /** @type {number[]} */
  const tamaños = [];
  let progresos = 0;
  try {
    for (let guarda = 0; guarda < 50; guarda++) {
      const r = await T.lgRonda();
      if (!r) break;
      tamaños.push(r.n);
      const id = await cola.encolar({
        tipo: TIPO_RONDA,
        params: r.params,
        unidades: r.n,
        titulo: r.params.nombre,
      });
      const t = await cola.esperar(id);
      assert.equal(t?.estado, 'terminado', t?.error);
      progresos += t?.unidades.filter((u) => u.progreso === 1).length ?? 0;
      const reg = await T.lgRegistrarRonda(r.params, await cola.resultados(id));
      assert.equal(reg.registrados, r.n, 'sin nulos se registran todos');
      assert.equal(reg.descartados, 0);
      // Registrarla otra vez no hace nada (idempotente).
      const otra = await T.lgRegistrarRonda(r.params, await cola.resultados(id));
      assert.equal(otra.ya, true);
    }
    assert.ok(pool.tamaño >= 2, 'varios workers en paralelo');
    assert.equal(
      progresos,
      tamaños.reduce((a, b) => a + b, 0),
    );
    return { T, tamaños };
  } finally {
    cola.detener();
    pool.cerrarTodos();
  }
}

test('decisión 23: suizo y copa por rondas en la cola = jugados en secuencia', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 900000,
}, async () => {
  const casos = [
    { fmt: { format: 'swiss' }, bots: F1_BOTS.slice(0, 5), semilla: 11, rondas: [2, 2, 2, 2] },
    {
      fmt: { format: 'cup', third: true, pots: 'random' },
      bots: F1_BOTS,
      semilla: 23,
      rondas: [12, 2, 1, 1], // grupos · semis · 3.er puesto · final
    },
  ];
  for (const k of casos) {
    // Una después de la otra (no en paralelo: menos workers vivos a la vez).
    const sec = await enSecuencia(k.fmt, k.bots, k.semilla);
    const cola = await porRondas(k.fmt, k.bots, k.semilla);
    const a = huella(sec.lg.matches);
    const b = huella(cola.T.lg.matches);
    assert.ok(a.length > 0);
    assert.ok(
      a.every((m) => m.winner),
      'sin nulos (si no, la secuencia repetiría el cruce con otra semilla)',
    );
    assert.deepEqual(b, a, `${k.fmt.format}: mismos partidos`);
    assert.deepEqual(cola.tamaños, k.rondas, `${k.fmt.format}: rondas del formato`);
    const Sa = lgSeason(/** @type {any} */ (sec.lg.cur));
    const Sb = lgSeason(/** @type {any} */ (cola.T.lg.cur));
    assert.deepEqual(
      lgStandings(Sb, cola.T.lg.matches).map((r) => [r.name, r.w, r.elo]),
      lgStandings(Sa, sec.lg.matches).map((r) => [r.name, r.w, r.elo]),
      `${k.fmt.format}: misma tabla`,
    );
    assert.equal(Sb.ronda, undefined, 'la marca de la ronda se quita al registrar');
    // Las repeticiones de «Repetir y analizar» dan lo registrado.
    if (k.fmt.format === 'swiss') await repetirYComparar(cola.T, cola.T.lg.matches.slice(0, 3));
  }
});

/**
 * «Repetir y analizar»: corrida.iniciar(escenario, semilla) manda
 * aplicar(escenario, semilla); después, los mensajes de F1 y correr.
 * @param {any} T @param {any[]} ms
 */
async function repetirYComparar(T, ms) {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    for (const m of ms) {
      const r = T.lgRepeticion(m.id);
      assert.equal(r.semilla, m.seed);
      assert.equal(r.escenario.especies.length, 3, 'el alga y los dos luchadores');
      for (const x of aplicar(r.escenario, r.semilla)) c.send(x);
      for (const x of r.f1) c.send(x);
      c.send({ t: 'run', running: true });
      const over = await c.wait((x) => x.t === 'f1-over', 300000);
      c.send({ t: 'run', running: false });
      assert.equal(over.winner, m.winner, `partido ${m.no}: ganador`);
      assert.equal(over.cycles, m.cycles, `partido ${m.no}: ciclos`);
      assert.deepEqual(
        over.f1.sp.map((/** @type {any} */ s) => s.wins),
        m.wins,
        `partido ${m.no}: victorias`,
      );
    }
  } finally {
    await c.stop();
  }
}

/**
 * f1-over (o el nulo) de una secuencia de mensajes en el cliente.
 * @param {ClienteSim} c @param {any[]} msgs
 */
async function jugar(c, msgs) {
  const antes = c.msgs.length;
  for (const m of msgs) c.send(m);
  const over = await c.wait(
    (m) => m.t === 'f1-over' || (m.t === 'f1-note' && m.kind === 'single'),
    300000,
  );
  c.send({ t: 'run', running: false });
  await c.sync();
  assert.ok(c.msgs.length > antes);
  return plano({ t: over.t, winner: over.winner, cycles: over.cycles, sp: over.f1?.sp });
}

test('el escenario efectivo da lo mismo que los mensajes de la clásica (reglas F1)', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const usado = new ClienteSim(workerEngine(), { copiarFrames: false });
  await usado.wait((m) => m.t === 'ready');
  try {
    for (const [i, s] of [
      [0, 5],
      [2, 77],
      [4, 1234],
    ]) {
      const fighters = [F1_BOTS[i], F1_BOTS[i + 1]].map((n, k) => ({
        name: `B${i}_${k}`,
        dna: adnDe(n),
        qty: 2,
        color: ['#ff4040', '#3d9bff'][k],
      }));
      const plan = planPartido(fighters, { nrg: 3000, ...VALORES }, s, reglasF1());
      // La clásica: sus mensajes tal cual, en un worker nuevo.
      const nuevo = new ClienteSim(workerEngine(), { copiarFrames: false });
      await nuevo.wait((m) => m.t === 'ready');
      let a;
      try {
        a = await jugar(
          nuevo,
          mensajesPartido(plan, reglasAOpciones(plan.rules, opcionesBaseClasica())),
        );
      } finally {
        await nuevo.stop();
      }
      // La nueva: el escenario efectivo, en un worker usado.
      const b = await jugar(usado, mensajesDelPlan(plan));
      assert.equal(a.t, 'f1-over');
      assert.deepEqual(b, a, `partido ${i} semilla ${s}`);
    }
  } finally {
    await usado.stop();
  }
});

test('un partido abortado a mitad y vuelto a correr da lo mismo', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const pool = new PoolWorkers({ crear: workerTrabajo, ociosoMs: 0 });
  try {
    const fighters = [F1_BOTS[6], F1_BOTS[7]].map((n, k) => ({
      name: `C${k}`,
      dna: adnDe(n),
      qty: 2,
      color: ['#ff4040', '#3d9bff'][k],
    }));
    const plan = planPartido(fighters, { nrg: 3000, ...VALORES, cap: 700 }, 99, reglasF1());
    const w1 = await pool.tomar();
    const r1 = await correrPartido({ canal: w1.canal, plan, cadaMs: 20 });
    pool.soltar(w1);
    const ctl = new AbortController();
    const w2 = await pool.tomar();
    let vistos = 0;
    await assert.rejects(
      correrPartido({
        canal: w2.canal,
        plan,
        senal: ctl.signal,
        cadaMs: 5,
        progreso: () => {
          if (++vistos === 2) ctl.abort();
        },
      }),
      (e) => /** @type {any} */ (e).codigo === 'abortada',
    );
    pool.descartar(w2);
    const w3 = await pool.tomar();
    const r3 = await correrPartido({ canal: w3.canal, plan });
    pool.soltar(w3);
    assert.deepEqual(r3, r1);
    assert.ok(r1.winner);
    assert.equal(r1.seed, 99);
    assert.deepEqual(r1.fighters, ['C0', 'C1']);
  } finally {
    pool.cerrarTodos();
  }
});
