// @ts-check
// El vocabulario del editor de ADN (decisión 18) sale del core, no se
// inventa, y el lint del editor ({t:'lint-dna'} de engine/worker.js) es el
// del motor y no tiene efectos:
//   1. SYSVARS y COMANDOS (src/lib/bots/editor/vocabulario.js) = las tablas
//      de port/core/include/dbcore/{sysvars,loader}.hpp, releídas acá.
//   2. Cada sysvar tiene en el motor la dirección de la lista (mensaje
//      {t:'sysvar'} del worker real) y ningún comando es para el lint una
//      palabra desconocida.
//   3. lint-dna: los hallazgos del core con su línea; anda sin sim; y una
//      corrida con pedidos de lint en el medio da el MISMO .dbsim byte a
//      byte que sin ellos.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar } from '../engine/escenarios/index.js';
import { describirLint } from '../src/lib/bots/editor/lint.js';
import { crearLinter } from '../src/lib/bots/editor/linter.js';
import { COMANDOS, SYSVARS } from '../src/lib/bots/editor/vocabulario.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, PORT_DIR, SIN_WASM, WEB } from './util/dbcore-node.js';

const CORE = path.join(PORT_DIR, 'core', 'include', 'dbcore');

test('SYSVARS y COMANDOS = las tablas del core', () => {
  const sv = fs.readFileSync(path.join(CORE, 'sysvars.hpp'), 'utf8');
  const a = sv.indexOf('t.entries = {');
  const tabla = [...sv.slice(a, sv.indexOf('};', a)).matchAll(/\{"([^"]+)",\s*(-?\d+)\}/g)].map(
    (m) => [m[1], +m[2]],
  );
  assert.equal(tabla.length, 255);
  assert.deepEqual(
    SYSVARS.map((x) => [...x]),
    tabla,
  );
  const ld = fs.readFileSync(path.join(CORE, 'loader.hpp'), 'utf8');
  /** @param {string} fn */
  const tokens = (fn) => {
    const i = ld.indexOf(`inline Block ${fn}(`);
    return [...ld.slice(i, ld.indexOf('return b;', i)).matchAll(/s == "([^"]+)"/g)].map(
      (m) => m[1],
    );
  };
  assert.deepEqual(
    { ...COMANDOS },
    {
      basico: tokens('BasicCommandTok'),
      avanzado: tokens('AdvancedCommandTok'),
      bits: tokens('BitwiseCommandTok'),
      condicion: tokens('ConditionsTok'),
      logica: tokens('LogicTok'),
      store: tokens('StoresTok'),
      flujo: tokens('FlowTok'),
      fin: tokens('MasterFlowTok'),
    },
  );
});

/** @param {ClienteSim} c @param {string} req */
const esperar = (c, req) => c.wait((m) => m.req === req, 120000);

test('el motor da a cada sysvar la dirección de la lista; los comandos no son palabras sueltas', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 300000,
}, async () => {
  const c = new ClienteSim(workerEngine(), { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    // sin sim, el mensaje sysvar contesta 0: hace falta una
    c.send({ t: 'reset', seed: 1, options: {}, species: [], limpio: true });
    const faltan = [];
    for (const [i, [nombre, dir]] of SYSVARS.entries()) {
      c.send({ t: 'sysvar', id: `s${i}`, name: `.${nombre}` });
      const r = await c.wait((m) => m.t === 'sysvar' && m.id === `s${i}`);
      // en el core gana la ÚLTIMA entrada con ese nombre (no hay repetidos)
      if (r.v !== dir) faltan.push(`${nombre}: ${r.v} ≠ ${dir}`);
    }
    assert.deepEqual(faltan, []);
    c.send({ t: 'sysvar', id: 'x', name: '.noexiste' });
    assert.equal((await c.wait((m) => m.t === 'sysvar' && m.id === 'x')).v, 0);

    const todos = Object.values(COMANDOS).flat();
    c.send({ t: 'lint-dna', dna: `start\n${todos.join('\n')}\n`, req: 'cmds' });
    const r = await esperar(c, 'cmds');
    assert.deepEqual(
      r.issues.filter((/** @type {any} */ h) => h.kind === 'palabra'),
      [],
      'ningún comando de la lista es una palabra desconocida',
    );
  } finally {
    await c.stop();
  }
});

test('lint-dna: hallazgos del core con su línea, sin sim y por el linter del editor', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 300000,
}, async () => {
  const w = workerEngine();
  const c = new ClienteSim(w, { copiarFrames: false });
  try {
    await c.wait((m) => m.t === 'ready');
    const dna = [
      "' prueba",
      'cond',
      '*.refshel 5 <',
      'start',
      '-1 .shoot store',
      'stor',
      '12ab',
      'up',
      '*.refshel 1 >',
      'stop',
    ].join('\n');
    c.send({ t: 'lint-dna', dna, req: 'a', id: 7 });
    const r = await esperar(c, 'a');
    assert.equal(r.id, 7, 'la correlación vuelve');
    const por = new Map(r.issues.map((/** @type {any} */ h) => [h.token, h]));
    assert.deepEqual([...por.keys()].sort(), ['*.refshel', '12ab', 'stor', 'up'].sort());
    const refshel = por.get('*.refshel');
    assert.equal(refshel.kind, 'nombre');
    assert.equal(refshel.line, 3, 'primera línea, base 1');
    assert.equal(refshel.count, 2);
    assert.equal(describirLint(refshel).codigo, 'nombre-parecido');
    assert.deepEqual(describirLint(refshel).arreglo, { de: '*.refshel', a: '*.refshell' });
    // la sugerencia es la del core (la última palabra a distancia 1)
    const stor = describirLint(por.get('stor'));
    assert.equal(stor.codigo, 'palabra-parecida');
    assert.ok(Object.values(COMANDOS).flat().includes(String(stor.arreglo?.a)));
    assert.deepEqual(describirLint(por.get('12ab')).arreglo, { de: '12ab', a: '12 ab' });
    assert.equal(describirLint(por.get('up')).arreglo?.a, '.up');
    // un ADN sano: nada
    c.send({ t: 'lint-dna', dna: 'cond\n*.eye5 0 >\nstart\n10 .up store\nstop\n', req: 'b' });
    assert.deepEqual((await esperar(c, 'b')).issues, []);
    // def con valor que no es número, y una línea leída como def; con
    // espacios de más el valor sí se lee (Val los saltea)
    c.send({
      t: 'lint-dna',
      dna: 'def mov .up\ndefensa 50\ndef ok    5\ncond\nstart\n10 .mov store\nstop\n',
      req: 'd',
    });
    const d = (await esperar(c, 'd')).issues.map(describirLint);
    assert.deepEqual(
      d.map((/** @type {any} */ a) => [a.codigo, a.linea, a.params.nombre]),
      [
        ['defvalor', 1, 'mov'],
        ['defpegado', 2, 'nsa'],
      ],
    );
  } finally {
    await c.stop();
  }

  // El linter del editor (linter.js) sobre un worker del arnés: solo vale
  // la respuesta al último pedido.
  const w2 = workerEngine();
  const linter = crearLinter({
    crear: () => ({
      enviar: (m) => w2.postMessage(m),
      on: (fn) => {
        w2.on('message', fn);
        return () => w2.off('message', fn);
      },
      terminar: () => {
        void w2.terminate();
      },
    }),
  });
  try {
    const viejo = linter.lint('cond\nfoo\nstart\nstop');
    const nuevo = linter.lint('cond\nbar\nstart\nstop');
    assert.equal(await viejo, null, 'reemplazado por el siguiente');
    const h = await nuevo;
    assert.deepEqual(
      h?.map((x) => [x.kind, x.token, x.line]),
      [['palabra', 'bar', 2]],
    );
  } finally {
    linter.cerrar();
  }
});

test('lint-dna no tiene efectos: el .dbsim sale igual con y sin lint en el medio', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 300000,
}, async () => {
  const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
  /** @param {{bot: string}} s */
  const adnDe = (s) => {
    const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
    return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
  };
  const esc = /** @type {any} */ (escenarioFabrica('sopa-primordial'));
  const FECHA = Date.UTC(2026, 8, 30, 12, 0, 0);
  /** @param {boolean} conLint */
  async function correr(conLint) {
    const c = new ClienteSim(workerEngine({ fechaFija: FECHA, semillaAzar: 3 }));
    try {
      await c.wait((m) => m.t === 'ready');
      if (conLint) c.send({ t: 'lint-dna', dna: 'cond\nfoo\nstart\n.up inc\nstop', req: 'l0' });
      for (const m of aplicar(esc, 4321, adnDe)) c.send(m);
      for (let i = 0; i < 150; i++) {
        c.send({ t: 'step' });
        if (conLint && i % 10 === 0)
          c.send({
            t: 'lint-dna',
            dna: /** @type {string} */ (adnDe(esc.especies[i % 2])),
            req: `l${i}`,
          });
      }
      c.send({ t: 'save', req: 'fin' });
      const m = await c.wait((x) => x.t === 'saved' && x.req === 'fin', 120000);
      if (conLint) assert.ok(c.msgs.filter((x) => x.t === 'lint-dna').length >= 15);
      assert.ok(!c.error, String(c.error));
      return Buffer.from(new Uint8Array(m.bytes));
    } finally {
      await c.stop();
    }
  }
  const sin = await correr(false);
  const con = await correr(true);
  assert.ok(sin.length > 1000);
  assert.ok(sin.equals(con), '.dbsim idéntico byte a byte');
});
