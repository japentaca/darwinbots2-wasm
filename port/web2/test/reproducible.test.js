// @ts-check
// C15: «escenario + semilla» da la misma corrida en cualquier worker. El
// mismo escenario de fábrica con la misma semilla (engine/escenarios
// aplicar(), que manda el reset con `limpio`) en un worker recién creado y
// en uno que ya corrió otro escenario —con formas, teleporters, charts
// abiertos, topes del Canal, Player Bot, apodo IM y el registro de
// muertos— da el mismo .dbsim byte a byte tras N ciclos. Los dos workers
// tienen distinto Math.random (los colores de las formas salen del LCG
// sembrado) y la misma fecha (strSimStart va en el .dbsim).
//
// Control: con el reset de siempre (sin `limpio`) la sim usada NO da lo
// mismo: el test detecta el arrastre que corrige.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar } from '../engine/escenarios/index.js';
import { H, REG, seccionesFrame } from '../engine/protocolo.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
/** @param {{bot: string}} s */
const adnDe = (s) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};

const FECHA = Date.UTC(2026, 0, 15, 13, 2, 3);
const SEMILLA = 777;
const CICLOS = 200;

/** @param {number} semillaAzar */
async function worker(semillaAzar) {
  const c = new ClienteSim(workerEngine({ fechaFija: FECHA, semillaAzar }));
  await c.wait((m) => m.t === 'ready');
  return c;
}

/** @param {ClienteSim} c @param {any[]} msgs @param {number} ciclos */
async function correr(c, msgs, ciclos) {
  for (const m of msgs) c.send(m);
  for (let i = 0; i < ciclos; i++) c.send({ t: 'step' });
  c.send({ t: 'save', req: 'fin' });
  const m = await c.wait((x) => x.t === 'saved' && x.req === 'fin', 120000);
  assert.ok(!c.error, String(c.error));
  return Buffer.from(new Uint8Array(m.bytes));
}

/**
 * Deja el worker "usado": el escenario `previo`, ciclos y todo lo que un
 * reset de siempre arrastraría.
 * @param {ClienteSim} c @param {string} previo
 */
async function usar(c, previo) {
  const e = /** @type {any} */ (escenarioFabrica(previo));
  for (const m of aplicar(e, 5, adnDe)) c.send(m);
  for (const m of [
    { t: 'setopt', id: 111, v: 1 }, // registro de muertos
    { t: 'f1-popcap', n: 3 },
    { t: 'f1-cap', cycles: 40, mode: 'nrg' },
    { t: 'graph-open', n: 1 },
    { t: 'im-name', name: 'otra pestaña' },
    { t: 'pb', on: 1 },
    { t: 'shape', dw: 0.1, dh: 0.1 },
    { t: 'maze', kind: 'h', corridor: 900, wall: 100 },
    { t: 'teleporter' },
  ])
    c.send(m);
  for (let i = 0; i < 60; i++) c.send({ t: 'step' });
  await c.sync();
}

/** @param {Buffer} a @param {Buffer} b */
function primeraDiferencia(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

for (const [previo, objetivo] of [
  ['archipielago', 'laberinto'],
  ['laberinto', 'archipielago'],
  ['depredador-y-presa', 'sopa-primordial'],
]) {
  test(`${objetivo} tras ${previo} = ${objetivo} en un worker nuevo`, {
    skip: !hayWasm() && SIN_WASM,
    timeout: 300000,
  }, async () => {
    const [nuevo, usado] = await Promise.all([worker(1), worker(424242)]);
    try {
      await usar(usado, previo);
      const msgs = aplicar(/** @type {any} */ (escenarioFabrica(objetivo)), SEMILLA, adnDe);
      assert.equal(msgs[1].limpio, true);
      const [a, b] = await Promise.all([correr(nuevo, msgs, CICLOS), correr(usado, msgs, CICLOS)]);
      assert.ok(a.length > 1000);
      assert.equal(primeraDiferencia(a, b), -1, `.dbsim distinto (${a.length} vs ${b.length})`);
    } finally {
      await Promise.all([nuevo.stop(), usado.stop()]);
    }
  });
}

test('control: sin `limpio` el worker usado arrastra estado', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 300000,
}, async () => {
  const [nuevo, usado] = await Promise.all([worker(1), worker(424242)]);
  try {
    await usar(usado, 'archipielago');
    const msgs = aplicar(/** @type {any} */ (escenarioFabrica('laberinto')), SEMILLA, adnDe).map(
      (m) => (m.t === 'reset' ? { ...m, limpio: undefined } : m),
    );
    const [a, b] = await Promise.all([correr(nuevo, msgs, CICLOS), correr(usado, msgs, CICLOS)]);
    assert.notEqual(primeraDiferencia(a, b), -1);
  } finally {
    await Promise.all([nuevo.stop(), usado.stop()]);
  }
});

test('semillaColores: los colores de las formas no dependen de Math.random', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 120000,
}, async () => {
  const [a, b] = await Promise.all([worker(1), worker(2)]);
  try {
    /** @param {ClienteSim} c */
    const colores = async (c) => {
      c.send({
        t: 'reset',
        seed: 3,
        options: { fieldW: 16000, fieldH: 16000 },
        species: [],
        semillaColores: 42,
      });
      c.send({ t: 'shapes-add10', dw: 0.1, dh: 0.1 });
      await c.sync();
      await c.sync();
      const f = /** @type {Float32Array} */ (c.frame);
      const off = seccionesFrame(f).obs;
      const out = [];
      for (let i = 0; i < f[H.nObs]; i++) out.push(f[off + i * REG.obs + 4]); // color
      return out;
    };
    const [ca, cb] = await Promise.all([colores(a), colores(b)]);
    assert.equal(ca.length, 10);
    assert.deepEqual(ca, cb);
  } finally {
    await Promise.all([a.stop(), b.stop()]);
  }
});
