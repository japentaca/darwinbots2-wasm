// @ts-check
// El worker del editor con tres clases de pedido: el lint, la traza del visor
// de pila (PLAN-EDITOR E1.5, linter.js) y las variantes de la evolución
// (E4.4). Cada clase conserva solo la respuesta a su último pedido, y un
// pedido de una clase no cancela al de las otras. Canal falso: responde a cada
// mensaje en el orden en que llega.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearLinter, ErrorLint } from '../src/lib/bots/editor/linter.js';

/** Un canal que contesta lint, traza y variantes como el worker (con la misma `req`). */
function canalFalso() {
  /** @type {((m: any) => void)[]} */
  const oyentes = [];
  /** @type {any[]} */
  const enviados = [];
  return {
    enviados,
    canal: {
      /** @param {any} m */
      enviar: (m) => {
        enviados.push(m);
        queueMicrotask(() => {
          for (const f of oyentes) {
            if (m.t === 'lint-dna') f({ t: 'lint-dna', req: m.req, issues: [] });
            else if (m.t === 'variantes')
              f({ t: 'variantes', req: m.req, textos: [`variante de ${m.req}`] });
            else f({ t: 'trace-dna', req: m.req, tsv: `tsv de ${m.req}` });
          }
        });
      },
      /** @param {(m: any) => void} fn */
      on: (fn) => {
        oyentes.push(fn);
        return () => {};
      },
      terminar: () => {},
    },
  };
}

test('trazar: dos pedidos seguidos → solo el segundo resuelve con su traza', async () => {
  const { canal } = canalFalso();
  const linter = crearLinter({ crear: () => canal });
  const primero = linter.trazar('start stop', null, 1234);
  const segundo = linter.trazar('start 10 store stop', null, 1234);
  assert.equal(await primero, null, 'el primero se descarta');
  assert.equal(await segundo, 'tsv de traza2');
  linter.cerrar();
});

test('lint y traza no se cancelan entre sí', async () => {
  const { canal, enviados } = canalFalso();
  const linter = crearLinter({ crear: () => canal });
  const lint = linter.lint('start stop');
  const traza = linter.trazar('start stop', null, 1234);
  assert.deepEqual(await lint, [], 'el lint llega con su respuesta');
  assert.equal(await traza, 'tsv de traza2');
  assert.deepEqual(
    enviados.map((m) => m.t),
    ['lint-dna', 'trace-dna'],
  );
  assert.equal(enviados[1].seed, 1234, 'la semilla llega al worker');
  linter.cerrar();
});

const PEDIDO = { adn: 'start stop', k: 8, modo: 2, factor: 4, semilla: 5 };

test('variantes: dos pedidos seguidos → solo el segundo resuelve con sus textos', async () => {
  const { canal } = canalFalso();
  const linter = crearLinter({ crear: () => canal });
  const primero = linter.variantes(PEDIDO);
  const segundo = linter.variantes({ ...PEDIDO, semilla: 6 });
  assert.equal(await primero, null, 'el primero se descarta');
  assert.deepEqual(await segundo, { textos: ['variante de variantes2'], error: null });
  linter.cerrar();
});

test('variantes no cancela el lint ni la traza, y manda los campos al worker', async () => {
  const { canal, enviados } = canalFalso();
  const linter = crearLinter({ crear: () => canal });
  const lint = linter.lint('start stop');
  const variantes = linter.variantes(PEDIDO);
  const traza = linter.trazar('start stop', null, 1234);
  assert.deepEqual(await lint, [], 'el lint llega con su respuesta');
  assert.deepEqual(await variantes, { textos: ['variante de variantes2'], error: null });
  assert.equal(await traza, 'tsv de traza3');
  const v = enviados.find((m) => m.t === 'variantes');
  assert.deepEqual(
    { adn: v.adn, k: v.k, modo: v.modo, factor: v.factor, semilla: v.semilla },
    PEDIDO,
    'el mensaje lleva el ADN, k, modo, factor y la semilla',
  );
  linter.cerrar();
});

test('variantes: un ADN que el cargador rechaza llega como error, no como lista', async () => {
  /** @type {((m: any) => void)[]} */
  const oyentes = [];
  const linter = crearLinter({
    crear: () => ({
      /** @param {any} m */
      enviar: (m) =>
        queueMicrotask(() => {
          for (const f of oyentes) f({ t: 'variantes', req: m.req, error: 'adn' });
        }),
      /** @param {(m: any) => void} fn */
      on: (fn) => {
        oyentes.push(fn);
        return () => {};
      },
      terminar: () => {},
    }),
  });
  assert.deepEqual(await linter.variantes(PEDIDO), { textos: [], error: 'adn' });
  linter.cerrar();
});

test('variantes: si el worker cae, el pedido se rechaza con ErrorLint', async () => {
  /** @type {((m: any) => void)[]} */
  const oyentes = [];
  const linter = crearLinter({
    crear: () => ({
      /** @param {any} _m */
      enviar: () =>
        queueMicrotask(() => {
          for (const f of oyentes) f({ t: 'error', msg: 'boom' });
        }),
      /** @param {(m: any) => void} fn */
      on: (fn) => {
        oyentes.push(fn);
        return () => {};
      },
      terminar: () => {},
    }),
  });
  await assert.rejects(linter.variantes(PEDIDO), (e) => {
    assert.ok(e instanceof ErrorLint);
    assert.equal(e.codigo, 'lint-no-disponible');
    return true;
  });
});
