// @ts-check
// engine/worker.js servido como MÓDULO (vite dev, paso N1.7): ahí
// importScripts no existe o lanza un TypeError, y el worker carga dbcore.js
// con fetch + eval indirecto. Un fallo de red de importScripts (worker
// clásico) no se reintenta con fetch: es un fallo de carga.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM } from './util/dbcore-node.js';

const SKIP = { skip: hayWasm() ? false : SIN_WASM, timeout: 120000 };

test('sin importScripts (worker módulo): fetch + eval, ready y la sim anda', SKIP, async () => {
  const c = new ClienteSim(workerEngine({ importScripts: 'modulo' }));
  try {
    const fetch = await c.wait((m) => m.t === 'fetch-usado');
    assert.match(fetch.url, /^file:.*\/build-wasm\/dbcore\.js$/);
    await c.wait((m) => m.t === 'ready');
    c.send({
      t: 'reset',
      seed: 7,
      options: { fieldW: 8000, fieldH: 6000, minVegs: 3, repopAmount: 2, repopCooldown: 5 },
      species: [],
    });
    for (let i = 0; i < 5; i++) c.send({ t: 'step' });
    c.send({ t: 'save', req: 'x' });
    const m = await c.wait((x) => x.t === 'saved' && x.req === 'x');
    assert.ok(m.bytes.byteLength > 1000);
    assert.equal(m.cycle, 4);
    assert.ok(!c.msgs.some((x) => x.t === 'error'));
  } finally {
    await c.stop();
  }
});

test('un fallo de red de importScripts es un fallo de carga (sin fetch)', SKIP, async () => {
  const c = new ClienteSim(workerEngine({ importScripts: 'red' }));
  try {
    const e = await c.wait((m) => m.t === 'error');
    assert.equal(e.clave, 'carga');
    assert.ok(!c.msgs.some((x) => x.t === 'fetch-usado'));
    assert.ok(!c.msgs.some((x) => x.t === 'ready'));
  } finally {
    await c.stop();
  }
});
