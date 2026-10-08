// @ts-check
// El worker del editor con dos clases de pedido: el lint y la traza del visor
// de pila (PLAN-EDITOR E1.5, linter.js). Cada clase conserva solo la respuesta
// a su último pedido, y un pedido de una clase no cancela al de la otra. Canal
// falso: responde a cada mensaje en el orden en que llega.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearLinter } from '../src/lib/bots/editor/linter.js';

/** Un canal que contesta lint y traza como el worker (con la misma `req`). */
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
