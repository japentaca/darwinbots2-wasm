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
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { planPartido } from '../engine/partido.js';
import { mensajesDelPlan, reglasDeEscenario } from '../engine/rondas.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM } from './util/dbcore-node.js';

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
    return { dq, over };
  } finally {
    await c.stop();
  }
}

test('la DQ de F3 llega al log del worker y el pasivo gana la ronda', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const { dq, over } = await jugar('partido-f3');
  assert.equal(over.t, 'f1-over');
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
  const { dq } = await jugar('partido-f1');
  assert.deepEqual(dq, []);
});
