// @ts-check
// Trazador del inspector en engine/worker.js (PLAN-EDITOR E2.2) con el motor real:
//   1. trace-on antes de cualquier sim: el reset siguiente nace con la traza
//      encendida (trace-on se recuerda y se reaplica a cada handle nuevo);
//   2. trace-on + select + step → TSV con cabecera `#` y un paso por token;
//   3. solo el bot con foco tiene traza (select 0 → "");
//   4. trace-on sigue tras un reset (handle nuevo): sin volver a pedirlo, la
//      traza del bot con foco vuelve a llegar;
//   5. trace-on false → "" aunque haya foco y ciclo;
//   6. mem-dump: 1000 valores, mem[i] es la dirección i+1 (setmem en 50 → mem[49]);
//   7. sin sim, trace-bot y mem-dump contestan "" y [] sin tirar.
// Sin wasm se saltea.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsearTraza, tokensEjecutables } from '../engine/pila.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM } from './util/dbcore-node.js';

const SKIP = { skip: hayWasm() ? false : SIN_WASM, timeout: 300000 };

// El ADN de E1.1 (ver editor_pila.test.js): 13 tokens ejecutables.
const E11 = 'cond *50 1 > start 7 100 store else 9 200 store stop';

const OPCIONES = {
  fieldW: 9000,
  fieldH: 7000,
  minVegs: 5,
  repopAmount: 3,
  repopCooldown: 50,
  maxEnergy: 40,
  startChlr: 3000,
  mutations: true,
  opts: {},
  costs: {},
};

/** Una especie con un bot: queda en el índice 1. */
const RESET = {
  t: 'reset',
  seed: 4242,
  options: OPCIONES,
  species: [{ dna: E11, name: 'Trazado', veg: false, qty: 1, nrg: 1000, color: 0x20a020 }],
  limpio: true,
};

async function arrancar() {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  await c.wait((m) => m.t === 'ready');
  return c;
}

/**
 * Pedido con respuesta: el worker atiende en orden, así que la respuesta
 * refleja todo lo mandado antes.
 * @param {ClienteSim} c @param {any} msg @param {string} req @param {string} tipo
 */
async function pedir(c, msg, req, tipo) {
  c.send({ ...msg, req });
  return c.wait((m) => m.t === tipo && m.req === req, 120000);
}

/** @param {ClienteSim} c @param {number} n @param {string} req */
async function traza(c, n, req) {
  return (await pedir(c, { t: 'trace-bot', n }, req, 'trace')).tsv;
}

test(
  'trace-on antes de la primera sim: el reset la hereda y el paso deja traza',
  SKIP,
  async () => {
    const c = await arrancar();
    try {
      c.send({ t: 'trace-on', on: true });
      c.send(RESET);
      c.send({ t: 'select', n: 1 });
      c.send({ t: 'step' });
      const tsv = await traza(c, 1, 'a');
      const { cabecera, pasos } = parsearTraza(tsv);
      assert.equal(cabecera?.n, 1, 'cabecera con el bot con foco');
      assert.equal(pasos.length, tokensEjecutables(E11).length, 'un paso por token');
    } finally {
      await c.stop();
    }
  },
);

test('solo el bot con foco tiene traza; trace-on false la apaga', SKIP, async () => {
  const c = await arrancar();
  try {
    c.send({ t: 'trace-on', on: true });
    c.send(RESET);
    c.send({ t: 'select', n: 0 });
    c.send({ t: 'step' });
    assert.equal(await traza(c, 1, 'sin-foco'), '', 'sin foco en el bot no hay traza');
    c.send({ t: 'select', n: 1 });
    c.send({ t: 'step' });
    assert.notEqual(await traza(c, 1, 'con-foco'), '');
    c.send({ t: 'trace-on', on: false });
    c.send({ t: 'step' });
    assert.equal(await traza(c, 1, 'apagada'), '', 'apagada, aunque haya foco y ciclo');
  } finally {
    await c.stop();
  }
});

test('trace-on sobrevive a un reset: el handle nuevo vuelve a traza', SKIP, async () => {
  const c = await arrancar();
  try {
    c.send({ t: 'trace-on', on: true });
    c.send(RESET);
    c.send({ t: 'reset', ...RESET, seed: 77 }); // handle nuevo
    c.send({ t: 'select', n: 1 });
    c.send({ t: 'step' });
    const { cabecera, pasos } = parsearTraza(await traza(c, 1, 'nuevo'));
    assert.equal(cabecera?.n, 1, 'el handle nuevo traza sin volver a pedir trace-on');
    assert.equal(pasos.length, tokensEjecutables(E11).length);
  } finally {
    await c.stop();
  }
});

test('mem-dump: 1000 valores, dirección i+1 en el índice i', SKIP, async () => {
  const c = await arrancar();
  try {
    c.send(RESET);
    c.send({ t: 'setmem', n: 1, addr: 50, v: 5 });
    const { mem } = await pedir(c, { t: 'mem-dump', n: 1 }, 'mem', 'mem');
    assert.equal(mem.length, 1000);
    assert.equal(mem[49], 5, 'mem[49] es la dirección 50');
    assert.equal(mem[0], 0, 'la dirección 1 no se tocó');
  } finally {
    await c.stop();
  }
});

test('sin sim: trace-bot y mem-dump contestan "" y [] sin tirar', SKIP, async () => {
  const c = await arrancar();
  try {
    assert.equal(await traza(c, 1, 'vacia'), '');
    const { mem } = await pedir(c, { t: 'mem-dump', n: 1 }, 'vacio', 'mem');
    assert.deepEqual(mem, []);
  } finally {
    await c.stop();
  }
});
