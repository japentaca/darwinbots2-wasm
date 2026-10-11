// @ts-check
// Las ligas llegan al partido (paso L1.2 de PLAN-LIGAS.md): los escenarios de
// fábrica partido-f3 y partido-f4 se vuelven opciones del reset (sin wasm) y
// la descalificación de F2/F3 (opción 93) hace perder la ronda a la especie
// que hace una acción prohibida (con wasm, worker real).
//
// La acción prohibida del test es fabricar slime (`.mkslime`): descalifica
// con Disqualify = 2 sin depender de que dos bots se toquen, así que el
// partido es corto y reproducible. (Un tie también descalifica, pero necesita
// contacto; el core lo cubren sus propios casos dorados.)

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { lgScratchNew } from '../engine/league.js';
import { interpretarMensaje, nuevoVivo, planPartido } from '../engine/partido.js';
import { mensajesDelPlan, reglasDeEscenario } from '../engine/rondas.js';
import { crearTorneos } from '../engine/torneos.js';
import { correrPartido } from '../src/lib/trabajos/partido.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM } from './util/dbcore-node.js';
import { depsDePrueba } from './util/torneos-deps.js';

const VALORES = { nrg: 3000, rounds: 1, wins: 1, cap: 300, capMode: 'pop', popCap: 15 };
// Hace slime desde el primer ciclo (acción prohibida en F3) y se reproduce.
const ADN_SLIME = 'cond\n start\nthen\n 50 .mkslime store\nend\n';
// Pasivo: no hace nada prohibido.
const ADN_PASIVO = 'cond\n start\nthen\n 1 .up store\nend\n';

/** @param {string} idEscenario @param {number} [semilla] */
function planDe(idEscenario, semilla = 7) {
  const luchadores = [
    { name: 'Slimer', dna: ADN_SLIME, qty: 2, color: '#ff4040' },
    { name: 'Pasivo', dna: ADN_PASIVO, qty: 2, color: '#3d9bff' },
  ];
  return planPartido(
    luchadores,
    VALORES,
    semilla,
    reglasDeEscenario(escenarioFabrica(idEscenario)),
  );
}

/** El mensaje reset de un plan. @param {any} plan */
const resetDe = (plan) => mensajesDelPlan(plan).find((m) => m.t === 'reset');

test('partido-f3: las opciones del reset traen la DQ nivel 2, el modo F1 y energía 30', () => {
  const r = resetDe(planDe('partido-f3'));
  assert.ok(r);
  assert.equal(r.options.opts[93], 2);
  assert.equal(r.options.opts[91], 1);
  assert.equal(r.options.maxEnergy, 30);
});

test('partido-f2: DQ nivel 1; partido-f1: sin DQ', () => {
  assert.equal(resetDe(planDe('partido-f2')).options.opts[93], 1);
  assert.ok(!resetDe(planDe('partido-f1')).options.opts[93]);
});

test('partido-f4: AGECOST 1 y campo de 18474 x 13856', () => {
  const o = resetDe(planDe('partido-f4')).options;
  assert.equal(o.costs[31], 1);
  assert.equal(o.fieldW, 18474);
  assert.equal(o.fieldH, 13856);
  assert.ok(!o.opts[93], 'F4 no descalifica');
});

/**
 * Juega el partido y devuelve las líneas DQ del log del worker y el f1-over.
 * @param {string} idEscenario
 */
async function jugar(idEscenario) {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    for (const m of mensajesDelPlan(planDe(idEscenario))) c.send(m);
    const over = await c.wait(
      (m) => m.t === 'f1-over' || (m.t === 'f1-note' && m.kind === 'single'),
      300000,
    );
    c.send({ t: 'run', running: false });
    await c.sync();
    assert.ok(!c.error, String(c.error));
    const dq = c.msgs
      .filter((m) => m.t === 'log' && String(m.msg).startsWith('DQ: '))
      .map((m) => String(m.msg));
    // L2.4: las mismas líneas viajan al anfitrión como f1-dq (sin el prefijo).
    const dqMsgs = c.msgs.filter((m) => m.t === 'f1-dq').flatMap((m) => m.lines);
    return { dq, dqMsgs, over };
  } finally {
    await c.stop();
  }
}

test('la DQ de F3 llega al log del worker y el pasivo gana la ronda', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const { dq, dqMsgs, over } = await jugar('partido-f3');
  assert.equal(over.t, 'f1-over');
  assert.deepEqual(
    dqMsgs.map((l) => `DQ: ${l}`),
    dq,
    'f1-dq lleva las mismas líneas que el log',
  );
  assert.ok(
    dq.some((l) => /Slimer/.test(l) && /has been disqualified for making slime\./.test(l)),
    `línea DQ de Slimer: ${JSON.stringify(dq)}`,
  );
  assert.equal(over.winner, 'Pasivo');
});

test('con las reglas F1 el mismo partido no descalifica a nadie', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const { dq, dqMsgs } = await jugar('partido-f1');
  assert.deepEqual(dq, []);
  assert.deepEqual(dqMsgs, []);
});

test('correrPartido (ronda en segundo plano) devuelve la DQ en el resultado', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const w = workerEngine();
  try {
    const canal = {
      enviar: (/** @type {any} */ m) => w.postMessage(m),
      on: (/** @type {(m: any) => void} */ fn) => {
        w.on('message', fn);
        return () => {
          w.off('message', fn);
        };
      },
    };
    const r = await correrPartido({ canal, plan: planDe('partido-f3'), cadaMs: 20 });
    assert.equal(r.winner, 'Pasivo');
    assert.ok(
      r.dq?.some((l) => /Slimer/.test(l) && /disqualified for making slime/.test(l)),
      JSON.stringify(r.dq),
    );
  } finally {
    await w.terminate();
  }
});

// ---- Sin wasm: el reductor y el registro -------------------------------------------

test('interpretarMensaje: f1-dq se acumula en el partido y no lo termina', () => {
  const m = nuevoVivo({ league: 'x', season: 1, fighters: [], label: null });
  // Antes del censo (mensajes de la sim anterior) se ignora.
  assert.equal(interpretarMensaje(m, { t: 'f1-dq', lines: ['viejo'] }), null);
  assert.equal(m.dq, undefined);
  interpretarMensaje(m, { t: 'f1-started', n: 2 });
  assert.equal(interpretarMensaje(m, { t: 'f1-dq', lines: ['a', 'b'] }), null);
  assert.equal(interpretarMensaje(m, { t: 'f1-dq', lines: ['c'] }), null);
  assert.deepEqual(m.dq, ['a', 'b', 'c']);
});

test('el registro del partido lleva dq solo si hubo descalificaciones', async () => {
  const T = crearTorneos(depsDePrueba({ almacen: almacenMemoria() }));
  await T.lgLoadAll();
  const sc = lgScratchNew(null, {}, ['A', 'B']);
  T.lg.scratch = sc;
  const F = sc.L.seasons[0].entrants;
  for (const n of ['A', 'B'])
    F.push({ name: n, dna: `${n} .up store`, hash: n, src: 'form', file: '', color: '#fff' });
  await T.lgSelect(sc.L);
  /** @param {string[]} [lineas] */
  const jugar1 = async (lineas) => {
    T.lg.live = {
      league: sc.L.id,
      season: 1,
      fighters: F,
      label: 'x',
      ready: false,
      capRounds: 0,
      cycles: 0,
      f1: null,
      lastWins: null,
      replay: null,
      seed: 1,
    };
    await T.leagueOnMessage({ t: 'f1-started', n: 2 });
    if (lineas) await T.leagueOnMessage({ t: 'f1-dq', lines: lineas });
    await T.leagueOnMessage({
      t: 'f1-over',
      winner: 'B',
      f1: { sp: F.map((e) => ({ name: e.name, wins: e.name === 'B' ? 1 : 0, capWins: 0 })) },
      cycles: 10,
    });
  };
  await jugar1(['Robot "A.txt" has been disqualified for making slime.']);
  await jugar1();
  const [con, sin] = sc.matches;
  assert.deepEqual(con.dq, ['Robot "A.txt" has been disqualified for making slime.']);
  assert.ok(!('dq' in sin));
});
