// @ts-check
// Las variantes del editor (PLAN-EDITOR E4.2, engine/variantes.js y el caso
// 'variantes' de engine/sim.js):
//   1. Puro, sin wasm: sinColaDeGuardado (y que adn.js la re-exporta); injertar
//      con genes cambiados, agregados, quitados e idénticos, y con la
//      referencia del motor (los alias de sysvars no cuentan como cambios);
//      distintas.
//   2. Con wasm, por el worker: 'variantes' sobre un bot del Bestiario da entre
//      1 y 4 textos distintos del original, sin error de lint, con sus
//      comentarios de cabecera; un ADN que el cargador rechaza da error 'adn'.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { canonico } from '../engine/adn.js';
import { genesAdn } from '../engine/lineage.js';
import { distintas, injertar, sinColaDeGuardado } from '../engine/variantes.js';
import { sinColaDeGuardado as sinColaDesdeInspector } from '../src/lib/inspector/adn.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

/** Las palabras de cada gen, como texto (para comparar genes sin comentarios). @param {string} t */
const palabras = (t) => genesAdn(t).genes.map((g) => g.join(' '));

// Un bot de dos genes, con cabeceras de nombre (comentarios sobre cada gen).
const ORIG = [
  "' Gen uno: come",
  'cond .up 5 >',
  'start',
  '  3 .up store',
  'stop',
  "' Gen dos: vecino",
  'cond *50 1 >',
  'start 7 100 store',
  'stop',
  'end',
].join('\n');

test('sinColaDeGuardado: quita las líneas #hash y #tag; adn.js la re-exporta', () => {
  const con = `${ORIG}\n'#hash: abc\n'#tag: demo\n`;
  assert.equal(sinColaDeGuardado(con), ORIG);
  assert.equal(sinColaDeGuardado('x\r\ny\0 \n\n'), 'x\ny');
  assert.equal(sinColaDesdeInspector, sinColaDeGuardado, 'misma función, un solo lugar');
});

test('injertar: sin cambios en genes devuelve el original tal cual', () => {
  assert.equal(injertar(ORIG, ORIG), ORIG);
  // mismos genes, con otros comentarios y espacios: el original no se toca
  const otros = ORIG.replace("' Gen uno: come", "'   otro comentario  ").replace(
    'stop\nend',
    'stop  \nend',
  );
  assert.equal(injertar(ORIG, otros), ORIG);
});

test('injertar: un gen cambiado se reemplaza y el vecino conserva su texto y su comentario', () => {
  const variante = ORIG.replace('cond .up 5 >', 'cond .up 9 >');
  const esperado = [
    "' Gen uno: come",
    'cond',
    '  .up 9 >',
    'start',
    '  3 .up store',
    'stop',
    "' Gen dos: vecino",
    'cond *50 1 >',
    'start 7 100 store',
    'stop',
    'end',
  ].join('\n');
  assert.equal(injertar(ORIG, variante), esperado);
});

test('injertar: un gen agregado entra después del gen que lo precede en la variante', () => {
  const variante = [
    "' Gen uno: come",
    'cond .up 5 >',
    'start',
    '  3 .up store',
    'stop',
    'cond .shoot 1 >',
    'start',
    '  2 .up store',
    'stop',
    "' Gen dos: vecino",
    'cond *50 1 >',
    'start 7 100 store',
    'stop',
    'end',
  ].join('\n');
  const r = injertar(ORIG, variante);
  assert.deepEqual(palabras(r), palabras(variante));
  assert.equal(
    r,
    [
      "' Gen uno: come",
      'cond .up 5 >',
      'start',
      '  3 .up store',
      'stop',
      'cond',
      '  .shoot 1 >',
      'start',
      '  2 .up store',
      'stop',
      "' Gen dos: vecino",
      'cond *50 1 >',
      'start 7 100 store',
      'stop',
      'end',
    ].join('\n'),
  );
});

test('injertar: un gen agregado al principio va antes de la cabecera del primero', () => {
  const variante = ['cond .shoot 1 >', 'start', '  2 .up store', 'stop', ORIG].join('\n');
  const r = injertar(ORIG, variante);
  assert.deepEqual(palabras(r), palabras(variante));
  assert.equal(r.indexOf("' Gen uno") > r.indexOf('.shoot'), true, 'el nuevo va primero');
  assert.equal(
    r.startsWith("cond\n  .shoot 1 >\nstart\n  2 .up store\nstop\n' Gen uno: come"),
    true,
  );
});

test('injertar: un gen quitado se va con sus líneas y su cabecera; el resto queda', () => {
  const variante = ORIG.split('\n').slice(0, 5).concat('end').join('\n');
  assert.equal(
    injertar(ORIG, variante),
    ["' Gen uno: come", 'cond .up 5 >', 'start', '  3 .up store', 'stop', 'end'].join('\n'),
  );
});

test('injertar: la referencia del motor no cuenta como cambio (alias de sysvars)', () => {
  // El original usa .aimdx; el motor lo escribe como .aimright al decompilar.
  const orig = ORIG.replace('start 7 100 store', 'start .aimdx store');
  const ref = ORIG.replace('start 7 100 store', 'start .aimright store');
  // La variante es la referencia: ningún gen cambió, el original vuelve tal cual.
  assert.equal(injertar(orig, ref, ref), orig);
  // Mutó solo el gen 1: el 2 conserva su .aimdx original.
  const mutada = ref.replace('cond .up 5 >', 'cond .up 9 >');
  assert.equal(
    injertar(orig, mutada, ref),
    [
      "' Gen uno: come",
      'cond',
      '  .up 9 >',
      'start',
      '  3 .up store',
      'stop',
      "' Gen dos: vecino",
      'cond *50 1 >',
      'start .aimdx store',
      'stop',
      'end',
    ].join('\n'),
  );
  // sin la referencia, el alias cuenta como cambio y el gen 2 se reescribe
  assert.equal(injertar(orig, mutada).includes('.aimright store'), true);
});

test('distintas: fuera las iguales al original (sin comentarios) y las repetidas', () => {
  const a = ORIG.replace('cond .up 5 >', 'cond .up 9 >');
  const b = ORIG.replace('cond *50 1 >', 'cond *50 2 >');
  const textos = [ORIG.replace("' Gen uno: come", "' otro"), a, a, ORIG, b];
  assert.deepEqual(distintas(ORIG, textos), [a, b]);
  assert.equal(canonico(a) !== canonico(ORIG), true);
});

// ---- Con wasm: el caso 'variantes' del worker -------------------------------

/** @param {ClienteSim} c @param {string} req */
const esperar = (c, req) => c.wait((m) => m.req === req, 120000);

test('wasm: variantes de un bot del Bestiario: 1..4 textos distintos, sin error de lint, con su cabecera', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 300000,
}, async () => {
  const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
  const archivo = BOTS[0].file;
  const adn = fs.readFileSync(path.join(WEB, 'bots', archivo), 'utf8');
  const cabecera = adn.split('\n').find((l) => l.startsWith("'"));
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    c.send({ t: 'variantes', adn, k: 4, modo: 2, factor: 4, semilla: 7, req: 'var' });
    const m = await esperar(c, 'var');
    assert.equal(m.error, undefined, `error: ${m.error}`);
    assert.ok(m.textos.length >= 1 && m.textos.length <= 4, `textos: ${m.textos.length}`);
    for (const [i, t] of m.textos.entries()) {
      assert.notEqual(canonico(t), canonico(adn), `variante ${i} igual al original`);
      assert.ok(t.includes(cabecera), `variante ${i} perdió el comentario de cabecera`);
      c.send({ t: 'lint-dna', dna: t, req: `lint${i}` });
      const l = await esperar(c, `lint${i}`);
      const errores = l.issues.filter((/** @type {{kind: string}} */ x) => x.kind === 'error');
      assert.deepEqual(errores, [], `variante ${i} con error de lint`);
    }
    console.log(`variantes de ${archivo}: ${m.textos.length} distintas`);
  } finally {
    await c.stop();
  }
});

test('wasm: un ADN que el cargador rechaza da error "adn" y no tira el worker', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 120000,
}, async () => {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    c.send({
      t: 'variantes',
      adn: 'cond .foo bar 9999999 > start store stop end',
      k: 2,
      modo: 2,
      factor: 4,
      semilla: 7,
      req: 'mal',
    });
    const m = await esperar(c, 'mal');
    assert.equal(m.error, 'adn');
    assert.equal(m.textos, undefined);
  } finally {
    await c.stop();
  }
});
