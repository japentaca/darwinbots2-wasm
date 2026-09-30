// @ts-check
// El worker contra el wasm, en el mismo proceso (engine/sim.js con el
// Module de dbcore y un post que junta los mensajes):
//  - C12: {t:'setbase'} aplica en vivo cada opción 'base' del catálogo con
//    los mismos exports que el reset (se lee de vuelta con db_sim_get_base
//    y el .dbsim sale igual que el de un reset con ese valor);
//  - los cambios en caliente con opciones acopladas (97/101, 1/2/3) dejan
//    la sim igual mandados de a uno que repetidos desde el evento fusionado
//    o desde diff();
//  - la correlación opcional de save, bot-text y getopt (la clásica no la
//    manda: sin ella, todo sigue igual).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mensajesEvento, nuevaCorrida, registrarCambio } from '../engine/corridas.js';
import { ESCENARIOS_FABRICA } from '../engine/escenarios/fabrica.js';
import { diff, normalizar } from '../engine/escenarios/index.js';
import { mensajeVivo, opcionesReset, PARAMETROS, valoresResueltos } from '../engine/opciones.js';
import { crearSim } from '../engine/sim.js';
import { cargarDbCore, hayWasm, SIN_WASM } from './util/dbcore-node.js';

const SKIP = { skip: !hayWasm() && SIN_WASM };

/** Índice de db_sim_get_base de cada opción base viva. */
const K_BASE = {
  minVegs: 0,
  repopAmount: 1,
  repopCooldown: 2,
  maxEnergy: 3,
  startChlr: 4,
  mutations: 5,
  maxPopulation: 6,
};

/** @type {any} */
let M = null;
async function modulo() {
  if (!M) M = await cargarDbCore();
  return M;
}

/**
 * Una sim de engine/sim.js sobre el Module, con los handles a la vista.
 * @returns {Promise<{handle: (m: any) => void, msgs: any[], h: () => number,
 *   api: Record<string, (...a: any[]) => any>}>}
 */
async function nueva() {
  const Mod = await modulo();
  /** @type {number[]} */
  const handles = [];
  const espia = Object.create(Mod);
  espia.cwrap = (/** @type {string} */ n, /** @type {any} */ r, /** @type {any} */ a) => {
    const f = Mod.cwrap(n, r, a);
    if (n !== 'db_sim_create') return f;
    return () => {
      const h = f();
      handles.push(h);
      return h;
    };
  };
  /** @type {any[]} */
  const msgs = [];
  const sim = crearSim({
    Module: espia,
    post: (m) => {
      msgs.push(m);
      if (m.t === 'frame') queueMicrotask(() => sim.handle({ t: 'ack', buf: m.buf }));
    },
    fecha: () => new Date(Date.UTC(2026, 0, 15, 13, 2, 3)),
    azar: () => 0.5,
  });
  const n = 'number';
  const api = {
    getBase: Mod.cwrap('db_sim_get_base', n, [n, n]),
    getOpt: Mod.cwrap('db_sim_get_opt', n, [n, n]),
  };
  return { handle: sim.handle, msgs, h: () => handles[handles.length - 1], api };
}

const RESET = {
  t: 'reset',
  seed: 99,
  options: opcionesReset(valoresResueltos('clasica')),
  species: [],
  limpio: true,
};

/**
 * .dbsim de la sim actual.
 * @param {{handle: (m: any) => void, msgs: any[]}} s
 */
function volcar(s) {
  s.handle({ t: 'save', req: 'v' });
  const m = s.msgs.findLast((x) => x.t === 'saved' && x.req === 'v');
  assert.ok(m, 'saved');
  s.msgs.length = 0;
  return Buffer.from(new Uint8Array(m.bytes));
}

test('setbase: cada opción base viva se aplica en vivo y se lee de vuelta', SKIP, async () => {
  const s = await nueva();
  s.handle(RESET);
  const bases = PARAMETROS.filter((p) => p.tipo === 'base' && p.vivo);
  assert.deepEqual(bases.map((p) => p.id).sort(), Object.keys(K_BASE).sort());
  for (const p of bases) {
    const k = /** @type {Record<string, number>} */ (K_BASE)[/** @type {string} */ (p.id)];
    const antes = s.api.getBase(s.h(), k);
    const v =
      p.valor === 'bool'
        ? p.porDefecto
          ? 0
          : 1
        : Math.min(/** @type {number} */ (p.max), /** @type {number} */ (p.porDefecto) + 7);
    assert.notEqual(antes, v, `${p.clave}: el valor de prueba no cambia nada`);
    const m = /** @type {any} */ (mensajeVivo(p.clave, v));
    assert.equal(m.t, 'setbase');
    s.handle(m);
    assert.equal(s.api.getBase(s.h(), k), v, p.clave);
  }
  // repop se escribe de a par: el otro queda como estaba
  s.handle({ t: 'setbase', vals: { repopAmount: 3 } });
  assert.equal(s.api.getBase(s.h(), 1), 3);
  assert.equal(s.api.getBase(s.h(), 2), 17, 'repopCooldown sigue en 10 + 7');
  // el tamaño del campo no es vivo: se ignora con un log
  s.handle({ t: 'setbase', vals: { fieldW: 1000 } });
  assert.ok(s.msgs.some((x) => x.t === 'log' && /field size/.test(x.msg)));
});

test('setbase deja la misma sim que un reset con esos valores (.dbsim igual)', SKIP, async () => {
  const cambios = {
    'base:minVegs': 4,
    'base:maxPopulation': 33,
    'base:repopAmount': 6,
    'base:repopCooldown': 40,
    'base:maxEnergy': 25,
    'base:startChlr': 12000,
    'base:mutations': 0,
  };
  const alga = ESCENARIOS_FABRICA[0].especies[0];
  const especie = {
    dna: "' alga\ncond\n*.nrg 5000 >\nstart\n50 .repro store\nstop\nend\n",
    name: `${alga.bot}.txt`,
    veg: true,
    qty: 10,
    nrg: 3000,
    color: 0x30d030,
  };
  // La siembra inicial usa StartChlr y las mutaciones (por eso son de
  // «sim nueva» en la siembra): las dos sims siembran DESPUÉS de fijarlas.
  const a = await nueva();
  a.handle(RESET);
  /** @type {Record<string, number>} */
  const vals = {};
  for (const [k, v] of Object.entries(cambios))
    Object.assign(vals, /** @type {any} */ (mensajeVivo(k, v)).vals);
  a.handle({ t: 'setbase', vals });
  a.handle({ t: 'seed-species', sp: especie });
  const b = await nueva();
  b.handle({ ...RESET, options: opcionesReset(valoresResueltos('clasica', cambios)) });
  b.handle({ t: 'seed-species', sp: especie });
  assert.ok(volcar(a).equals(volcar(b)), 'recién aplicadas');
  for (let i = 0; i < 120; i++) {
    a.handle({ t: 'step' });
    b.handle({ t: 'step' });
  }
  assert.ok(volcar(a).equals(volcar(b)), 'tras 120 ciclos');
});

test(
  'acopladas: el evento fusionado y diff() dejan la sim como los cambios de a uno',
  SKIP,
  async () => {
    /** @param {any[]} msgs */
    const estado = async (msgs) => {
      const s = await nueva();
      s.handle(RESET);
      for (const m of msgs) s.handle(m);
      const opts = [1, 2, 3, 97, 101].map((id) => s.api.getOpt(s.h(), id)).join(',');
      return `${opts} ${volcar(s).toString('base64')}`;
    };
    // 101=3, 97=5, 101=7 (el caso de la revisión) y los bordes 2=0, 1=1, 3=0
    const secuencia = [
      { 'opt:101': 3 },
      { 'opt:97': 5 },
      { 'opt:101': 7 },
      { 'opt:2': 0 },
      { 'opt:1': 1 },
      { 'opt:3': 0 },
    ];
    const c = nuevaCorrida({ escenario: ESCENARIOS_FABRICA[0], semilla: 1 });
    for (const x of secuencia) registrarCambio(c, 10, x);
    const deAUno = secuencia.map((x) => {
      const [k, v] = Object.entries(x)[0];
      return mensajeVivo(k, v);
    });
    assert.equal(await estado(mensajesEvento(c.eventos[0])), await estado(deAUno));
    // diff(): toroidal → cilindro y 97 con 101 fijo
    /** @param {Record<string, number>} cambios */
    const esc = (cambios) =>
      normalizar({
        formato: 1,
        id: 'x',
        nombre: 'x',
        opciones: { base: 'clasica', cambios },
        especies: [],
      });
    const actual = esc({ 'opt:2': 1, 'opt:3': 1, 'opt:101': 7 });
    const borrador = esc({ 'opt:2': 0, 'opt:3': 1, 'opt:97': 3, 'opt:101': 7 });
    const d = diff(borrador, actual);
    const resetDe = (/** @type {any} */ e) => ({
      ...RESET,
      options: opcionesReset(valoresResueltos('clasica', e.opciones.cambios)),
    });
    const vivo = await estado([resetDe(actual), ...d.mensajes]);
    const nuevo = await estado([resetDe(borrador)]);
    assert.equal(vivo, nuevo);
    assert.equal(nuevo.split(' ')[0], '0,0,1,3,7');
  },
);

test('correlación opcional: save, bot-text y getopt', SKIP, async () => {
  const s = await nueva();
  // sin sim: con correlación responde save-error; sin ella, solo el log
  s.handle({ t: 'save', req: 1 });
  assert.deepEqual(s.msgs.pop(), { t: 'save-error', req: 1, clave: 'save-empty' });
  s.handle({ t: 'save', id: 'a' });
  assert.deepEqual(s.msgs.pop(), { t: 'save-error', id: 'a', clave: 'save-empty' });
  s.handle({ t: 'save' });
  assert.deepEqual(s.msgs.pop(), { t: 'log', msg: 'empty save' });
  s.handle(RESET);
  s.msgs.length = 0;
  s.handle({ t: 'save', req: 2 });
  const sv = s.msgs.pop();
  assert.equal(sv.t, 'saved');
  assert.equal(sv.req, 2);
  assert.ok(sv.bytes.byteLength > 0);
  s.handle({ t: 'save' });
  assert.deepEqual(Object.keys(s.msgs.pop()).sort(), ['bytes', 'cycle', 't'], 'como la clásica');
  s.handle({ t: 'bot-text', n: 1, req: 3, id: 'b' });
  assert.deepEqual(s.msgs.pop(), { t: 'bot-text', n: 1, text: '', req: 3, id: 'b' });
  s.handle({ t: 'bot-text', n: 1 });
  assert.deepEqual(s.msgs.pop(), { t: 'bot-text', n: 1, text: '' });
  s.handle({ t: 'getopt', id: 97, req: 4 });
  assert.deepEqual(s.msgs.pop(), { t: 'opt', id: 97, v: 5, req: 4 });
  s.handle({ t: 'getopt', id: 97 });
  assert.deepEqual(s.msgs.pop(), { t: 'opt', id: 97, v: 5 });
});
