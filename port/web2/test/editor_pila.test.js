// @ts-check
// El parseo y la alineación de la pila del editor (PLAN-EDITOR E1.4, engine/pila.js):
//   1. Puro, sin wasm: parsearTraza sobre un TSV escrito a mano; tokensEjecutables
//      con líneas def, comentarios, el primer token de un bot con def y basura
//      después del `end`.
//   2. Con wasm: para cada bot del Bestiario, la traza del motor tiene un paso
//      por token ejecutable (o el cargador la rechazó: tsv vacío y el lint lo
//      marca); ningún bot tira excepción.
//   3. Con wasm: la traza del gen de ejemplo con mem[50]=5 se alinea y las
//      cuentas por gen y los valores de store coinciden con el motor.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  alinear,
  memoriaDe,
  parsearTraza,
  pasosDeGen,
  resumenPaso,
  sysvarsLeidos,
  tokensEjecutables,
} from '../engine/pila.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

/** @param {ClienteSim} c @param {string} req */
const esperar = (c, req) => c.wait((m) => m.req === req, 120000);

/** @param {ClienteSim} c @param {string} dna @param {string} req @param {number[]} [mem] */
async function traza(c, dna, req, mem) {
  c.send({ t: 'trace-dna', dna, req, ...(mem ? { mem } : {}) });
  return (await esperar(c, req)).tsv;
}

// Dos pasos de cabecera a mano (E2 la escribe; E1 no): la línea 1 no tiene
// pila, la 2 tiene un valor en `ints`, y la 4 es un store que escribió.
const TSV_A_MANO = [
  '1\t9\t1\t1\t1\t1\t0\t\t0\t\t0\t0',
  '2\t1\t50\t1\t1\t1\t1\t5\t0\t\t0\t0',
  '3\t0\t1\t1\t1\t1\t2\t5,1\t1\t-1\t0\t0',
  '4\t7\t100\t1\t2\t1\t0\t\t0\t\t100\t7',
  '',
].join('\n');

test('parsearTraza: pasos con sus columnas, ints vacíos y ejec booleano', () => {
  const { cabecera, pasos } = parsearTraza(TSV_A_MANO);
  assert.equal(cabecera, null, 'sin cabecera, E1 no la trae');
  assert.equal(pasos.length, 4, 'la línea vacía no cuenta');
  assert.deepEqual(pasos[0].ints, [], 'ints vacío');
  assert.deepEqual(pasos[1].ints, [5]);
  assert.deepEqual(pasos[2].ints, [5, 1]);
  assert.deepEqual(pasos[2].bools, [-1]);
  assert.equal(pasos[0].ejec, true);
  assert.equal(
    pasos.every((p) => typeof p.ejec === 'boolean'),
    true,
  );
  assert.equal(pasos[3].ejec, true);
  assert.equal(pasos[3].dir, 100);
  assert.equal(pasos[3].val, 7);
  assert.equal(pasos[3].flujo, 2);
  assert.equal(pasos[3].gen, 1);
});

test('parsearTraza: una cabecera #\\t ciclo n genenum va aparte de los pasos', () => {
  const { cabecera, pasos } = parsearTraza(`#\t120\t3\t2\r\n${TSV_A_MANO}`);
  assert.deepEqual(cabecera, { ciclo: 120, n: 3, genenum: 2 });
  assert.equal(pasos.length, 4, 'la cabecera no es un paso');
  assert.deepEqual(parsearTraza('').pasos, []);
});

test('tokensEjecutables: sin líneas def ni comentarios, hasta el end sin incluirlo', () => {
  const dna = [
    'def mov 5',
    "cond ' comentario con start y stop",
    '/ una línea entera de comentario',
    'start 10 .up store',
    'stop',
    'end basura 1 2',
  ].join('\n');
  assert.deepEqual(
    tokensEjecutables(dna).map((t) => t.w),
    ['cond', 'start', '10', '.up', 'store', 'stop'],
  );
  const pos = tokensEjecutables(dna).find((t) => t.w === 'store');
  assert.equal(dna.slice(pos?.ini, pos?.fin), 'store', 'la posición apunta a la palabra');
  assert.equal(tokensEjecutables('def x 1\ndef y 2\n').length, 0);
});

test('tokensEjecutables: con def y primer token que no es de flujo, ese token no se ejecuta', () => {
  // loader.hpp LoadDNAText: con defs, el fantasma se borra y el primer token
  // no-flujo queda fuera del rango (el [PROBABLE BUG] A2-2 del port).
  const conDef = 'Alga Reactum\ndef x 1\ncond\nstart\n10 .up store\nstop\nend\n';
  assert.deepEqual(
    tokensEjecutables(conDef).map((t) => t.w),
    ['Reactum', 'cond', 'start', '10', '.up', 'store', 'stop'],
  );
  // sin def, el primer token sí corre
  assert.deepEqual(
    tokensEjecutables('Alga Reactum\ncond\nstop\nend\n').map((t) => t.w),
    ['Alga', 'Reactum', 'cond', 'stop'],
  );
  // con def pero el primer token es de flujo: no se pierde nada
  assert.deepEqual(
    tokensEjecutables('def x 1\ncond\nstop\nend\n').map((t) => t.w),
    ['cond', 'stop'],
  );
});

test('sysvarsLeidos y resumenPaso: nombres con punto, sin repetir; clase por tipo', () => {
  const toks = tokensEjecutables(
    'cond *.eye5 *.eye5 *.Eye5 *50 1 >\nstart 10 .up store\nstop\nend\n',
  );
  assert.deepEqual(sysvarsLeidos(toks), ['.eye5', '.Eye5']);
  const { pasos } = parsearTraza(
    '1\t1\t50\t1\t0\t1\t0\t\t0\t\t0\t0\n2\t7\t3\t1\t0\t1\t0\t\t0\t\t0\t0\n',
  );
  assert.deepEqual(resumenPaso(pasos[0]), { tipo: 'lee' });
  assert.deepEqual(resumenPaso(pasos[1]), { tipo: 'escribe' });
});

test('memoriaDe: 1001 enteros en cero; nombres sin dirección se ignoran', () => {
  const mem = memoriaDe(
    new Map([
      ['50', 5],
      ['nada', 9],
      ['2000', 3],
    ]),
    (n) => +n,
  );
  assert.equal(Array.isArray(mem), true, 'Array plano: el worker lo chequea con Array.isArray');
  assert.equal(mem.length, 1001);
  assert.equal(mem[50], 5);
  assert.equal(mem.filter((v) => v !== 0).length, 1);
});

// El ADN de E1.1: cond *50 1 > start 7 100 store else 9 200 store stop.
const E11 = 'cond *50 1 > start 7 100 store else 9 200 store stop';

test('wasm: los 684 bots del Bestiario, un paso por token ejecutable o tsv vacío', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    /** @type {string[]} */
    const rechazados = [];
    /** @type {string[]} */
    const malos = [];
    for (const [i, b] of BOTS.entries()) {
      const texto = fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8');
      const tsv = await traza(c, texto, `bot${i}`);
      if (tsv === '') {
        rechazados.push(b.file);
        continue;
      }
      const tokens = tokensEjecutables(texto);
      const { pasos } = parsearTraza(tsv);
      if (pasos.length !== tokens.length)
        malos.push(`${b.file}: ${pasos.length} ≠ ${tokens.length}`);
      else if (alinear(tokens, pasos).length !== tokens.length)
        malos.push(`${b.file}: sin alinear`);
    }
    console.log(`bots rechazados por el cargador (tsv vacío): ${rechazados.length}`, rechazados);
    assert.deepEqual(malos, []);
  } finally {
    await c.stop();
  }
});

test('wasm: el cargador rechaza un def sin valor; el lint lo marca', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 300000,
}, async () => {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    const dna = 'def x\ncond\nstart\n10 .up store\nstop\nend\n';
    assert.equal(await traza(c, dna, 'rech'), '');
    c.send({ t: 'lint-dna', dna, req: 'lint-rech' });
    // el core lo marca como error del archivo entero (línea 0, base 1 = 0)
    const issues = (await esperar(c, 'lint-rech')).issues;
    assert.deepEqual(
      issues.map((/** @type {{kind: string, line: number}} */ h) => [h.kind, h.line]),
      [['error', 0]],
    );
  } finally {
    await c.stop();
  }
});

test('wasm: el gen de ejemplo con mem[50]=5 se alinea y su store escribe 7 en 100', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 300000,
}, async () => {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    const mem = memoriaDe(new Map([['50', 5]]), (n) => +n);
    const tsv = await traza(c, E11, 'e11', mem);
    const tokens = tokensEjecutables(E11);
    const alineados = alinear(tokens, parsearTraza(tsv).pasos);
    assert.equal(alineados.length, 13, 'un paso por palabra del ADN de E1.1');
    // genesTexto: el gen 0 es cond…store (8 palabras) y el 1 es else…stop (5):
    // el plan decía 11 pasos para el gen 0, pero son 8 (manda el código).
    assert.equal(pasosDeGen(alineados, E11, 0).length, 8);
    assert.equal(pasosDeGen(alineados, E11, 1).length, 5);
    const store = alineados.find((p) => p.palabra === 'store' && p.idx === 8);
    assert.equal(store?.dir, 100);
    assert.equal(store?.val, 7);
    assert.equal(store?.ejec, true);
    const elseStore = alineados.find((p) => p.palabra === 'store' && p.idx === 12);
    assert.equal(elseStore?.ejec, false, 'la rama else no corre con la condición verdadera');
    assert.equal(alineados.find((p) => p.palabra === '9')?.ejec, false);
    // sin mem, la condición *50 vale 0 y la rama else corre
    const sinMem = alinear(tokens, parsearTraza(await traza(c, E11, 'e11b')).pasos);
    const elseOtra = sinMem.find((p) => p.idx === 12);
    assert.equal(elseOtra?.dir, 200);
    assert.equal(elseOtra?.val, 9);
  } finally {
    await c.stop();
  }
});
