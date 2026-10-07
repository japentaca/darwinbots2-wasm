// @ts-check
// Disposiciones y pestañas de Observar (PLAN-TORNEO-EN-CURSO.md, TC3: T6 y
// T7): la disposición que vale y la que se recuerda, las pestañas del
// panel según haya torneo y a cuál se salta cuando empieza o termina el
// torneo o cuando se elige o se suelta un bot.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DISPOSICIONES,
  disposicionGuardada,
  disposicionValida,
  guardarDisposicion,
  KV_DISPOSICION,
  pestañaInicial,
  pestañasPanel,
  pestañaTras,
} from '../src/lib/observar/disposicion.js';

test('disposición: Mixta por defecto, las tres valen', () => {
  assert.deepEqual(DISPOSICIONES, ['campo', 'mixta', 'datos']);
  for (const d of DISPOSICIONES) assert.equal(disposicionValida(d), d);
  assert.equal(disposicionValida('tv'), 'mixta');
  assert.equal(disposicionValida(null), 'mixta');
});

test('disposición: se recuerda en localStorage, y sin almacenamiento es Mixta', () => {
  const g = /** @type {any} */ (globalThis);
  const antes = g.localStorage;
  try {
    delete g.localStorage;
    assert.equal(disposicionGuardada(), 'mixta');
    guardarDisposicion('datos'); // no tira
    /** @type {Map<string, string>} */
    const m = new Map();
    g.localStorage = {
      getItem: (/** @type {string} */ k) => m.get(k) ?? null,
      setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, v),
    };
    assert.equal(disposicionGuardada(), 'mixta');
    guardarDisposicion('datos');
    assert.equal(m.get(KV_DISPOSICION), 'datos');
    assert.equal(disposicionGuardada(), 'datos');
    m.set(KV_DISPOSICION, 'cualquiera');
    assert.equal(disposicionGuardada(), 'mixta');
  } finally {
    if (antes === undefined) delete g.localStorage;
    else g.localStorage = antes;
  }
});

test('pestañas: «Torneo» solo con torneo en curso', () => {
  assert.deepEqual(pestañasPanel(false), ['vivo', 'bot']);
  assert.deepEqual(pestañasPanel(true), ['vivo', 'torneo', 'bot']);
});

test('pestaña inicial: el bot, si no el torneo, si no En vivo', () => {
  assert.equal(pestañaInicial(false, false), 'vivo');
  assert.equal(pestañaInicial(true, false), 'torneo');
  assert.equal(pestañaInicial(true, true), 'bot');
  assert.equal(pestañaInicial(false, true), 'bot');
});

test('pestaña tras un cambio', () => {
  const nada = { torneo: false, bot: false };
  const torneo = { torneo: true, bot: false };
  const bot = { torneo: false, bot: true };
  const ambos = { torneo: true, bot: true };
  // empieza el torneo → Torneo; termina → En vivo
  assert.equal(pestañaTras('vivo', nada, torneo), 'torneo');
  assert.equal(pestañaTras('torneo', torneo, nada), 'vivo');
  // se elige un bot → Bot (también con torneo); se suelta → la de antes
  assert.equal(pestañaTras('vivo', nada, bot), 'bot');
  assert.equal(pestañaTras('torneo', torneo, ambos), 'bot');
  assert.equal(pestañaTras('bot', ambos, torneo), 'torneo');
  assert.equal(pestañaTras('bot', bot, nada), 'vivo');
  // termina el torneo mirando un bot: sigue en Bot
  assert.equal(pestañaTras('bot', ambos, bot), 'bot');
  // sin cambios, o soltar el bot mirando otra pestaña: queda la que está
  assert.equal(pestañaTras('vivo', torneo, torneo), 'vivo');
  assert.equal(pestañaTras('vivo', ambos, torneo), 'vivo');
  // la pestaña Bot vacía (elegida a mano) se queda
  assert.equal(pestañaTras('bot', nada, nada), 'bot');
});
