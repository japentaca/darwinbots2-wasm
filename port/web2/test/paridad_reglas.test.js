// @ts-check
// Paridad del lanzamiento de un partido de torneo (E1.2): lo que la clásica
// le manda al worker al jugar (lgPlay → lgApplyRules escribe las reglas en
// el panel de opciones → contestLaunch → btn-reset → newSim → collectOptions)
// contra engine/ (lgPlay de torneos.js → lanzar(plan) → reglasAOpciones +
// mensajesPartido). Mismos mensajes (orden, semilla, opciones del reset,
// siembra) con deepStrictEqual.
//
// La clásica corre en un vm con web/league.js, contest.js y tournament.js
// (como test/paridad_torneos.test.js) más las piezas de web/index.html que
// hacen falta, extraídas del fuente tal cual (el panel de opciones, su
// recolección, el reinicio), sobre un DOM mínimo: elementos con id, dataset,
// value/checked (con el saneamiento del navegador: un <input type="number">
// descarta lo que no es un número; un <select>, lo que no es una opción),
// 'change' y querySelectorAll para los selectores que usan esas funciones
// (test/util/clasica-vm.js, que comparte con test/paridad_base.test.js).
//
// Los setopt/setcost que los 'change' mandan en vivo van a la sim ANTERIOR
// (el reinicio la reemplaza): no se comparan (ver la cabecera de
// engine/partido.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as E from '../engine/league.js';
import {
  ALGA_ARRANQUE,
  CONTROLES_CLASICA,
  fieldSizeDims,
  idControl,
  mensajesPartido,
  PHYS_CLASICA,
  reglasAOpciones,
  siembraArranque,
} from '../engine/partido.js';
import { crearTorneos } from '../engine/torneos.js';
import { almacenMemoria } from '../engine/torneos-db.js';
import { clasica, plano, rng } from './util/clasica-vm.js';
import { depsDePrueba } from './util/torneos-deps.js';

// ---- Casos --------------------------------------------------------------------------------
const PARTICIPANTES = [
  { name: 'Uno', dna: 'cond start 10 .up store stop end', color: '#ff4040', qty: 3 },
  { name: 'Dos', dna: 'cond start 5 .aimdx store stop end', color: '#4080ff' },
  { name: 'Tres', dna: "' tres\ncond start -1 .shoot store stop end", color: '#20c040', qty: 7 },
];
const FORMATOS = [
  { format: 'single', nrg: 3000, rounds: 5, wins: 3, cap: 5000, capMode: 'pop', popCap: 500 },
  { format: 'single', nrg: 1500, qty: 2, rounds: 9, wins: 0, cap: 0, capMode: 'nrg', popCap: 0 },
];
const CAMBIOS_PANEL = /** @type {[string, any][]} */ ([
  ['o-fsize', '3'],
  ['o-shape', 'h'],
  ['o-12', '0.5'],
  ['o-53', '2'],
  ['o-10', true],
  ['o-c30', '0.1'],
  ['o-c56', true],
  ['o-mutations', false],
  ['o-maxEnergy', '25'],
  ['o-phys', 'fluido'],
  ['o-110', '50'],
]);
const DESPUES = /** @type {[string, any][]} */ ([
  ['o-11', '99'],
  ['o-fw', '12345'],
  ['o-c20', '0.3'],
  ['o-minVegs', '3'],
  ['o-shape', 'tor'],
]);

/**
 * @typedef {{nombre: string, panel?: [string, any][], reglas: string | ((c: any) => any),
 *   despues?: [string, any][], replay?: number}} Caso
 */
/** @type {Caso[]} */
const CASOS = [
  { nombre: 'F1 (lgF1Rules) desde el panel por defecto', reglas: 'lgF1Rules()' },
  { nombre: 'F1 con el panel cambiado después', reglas: 'lgF1Rules()', despues: DESPUES },
  { nombre: 'sin costos (lgNoCostRules)', panel: CAMBIOS_PANEL, reglas: 'lgNoCostRules()' },
  { nombre: 'panel actual con cambios', panel: CAMBIOS_PANEL, reglas: 'lgCaptureRules()' },
  {
    nombre: 'panel actual con cambios, repetición con semilla',
    panel: CAMBIOS_PANEL,
    reglas: 'lgCaptureRules()',
    despues: DESPUES,
    replay: 4321,
  },
  {
    nombre: 'foto parcial: lo que no nombra queda como en el panel',
    panel: CAMBIOS_PANEL,
    reglas: () => ({ 'o-fsize': '2', 'o-12': '0.25', 'o-c31': '0.5', 'o-maxPopulation': '40' }),
    despues: DESPUES,
  },
  {
    nombre: 'valores raros: no numéricos, opciones inexistentes, controles que no existen',
    reglas: () => ({
      'o-fw': 'abc',
      'o-fh': '1e3',
      'o-fsize': '14',
      'o-53': '7',
      'o-60': 0,
      'o-shape': 'x',
      'o-999': 5,
      'o-2': 1,
      'o-c99': 3,
      'o-11': '12abc',
      'o-13': '.5',
      'o-14': '+1',
      'o-10': 'false',
      'o-c56': 1,
      'o-c61': 0,
      'o-mutations': 'x',
      'o-startChlr': null,
      'o-phys': 'solido',
      'o-91': true,
      'o-97': '12',
    }),
  },
  {
    nombre: 'o-fsize sin o-fw/o-fh y o-fw antes de o-fsize',
    reglas: () => ({ 'o-fw': '777', 'o-fsize': '1', 'o-phys': 'espacio', 'o-16': '0.9' }),
  },
];

/**
 * Juega el caso en la clásica y en engine/ y devuelve los mensajes de cada una.
 * @param {Caso} caso @param {any} fmt @param {number} seed
 */
async function jugar(caso, fmt, seed) {
  const c = clasica();
  if (caso.panel) c.tocar(caso.panel);
  const reglas = plano(typeof caso.reglas === 'string' ? c.ev(caso.reglas) : caso.reglas(c));
  if (caso.despues) c.tocar(caso.despues);
  const base = plano(c.ev('collectOptions()'));

  /** @type {any[]} */
  let enviadosE = [];
  let azar = rng(0);
  const t = crearTorneos(
    depsDePrueba({
      almacen: almacenMemoria(),
      azar: () => azar(),
      lanzar: (/** @type {any} */ plan) => {
        enviadosE = mensajesPartido(plan, reglasAOpciones(plan.rules, base));
      },
    }),
  );

  const out = [];
  for (const api of ['clasica', 'engine']) {
    const L = (api === 'clasica' ? c.ev('lgNewLeague') : E.lgNewLeague)({
      id: 'T',
      name: 'T',
      rules: reglas,
      fmt,
      entrants: PARTICIPANTES.map((e) => ({ ...e, hash: E.lgHash(e.dna), src: 'form', file: '' })),
    });
    const lg = api === 'clasica' ? c.ev('lg') : t.lg;
    lg.list.push(L);
    lg.cur = L;
    lg.matches = [];
    const fx = { fighters: L.seasons[0].entrants, label: 'x' };
    const o = caso.replay ? { replay: { season: 1, seed: caso.replay, no: 1 } } : {};
    if (api === 'clasica') {
      c.semilla(seed);
      c.enviados.length = 0;
      await c.ev('lgPlay')(L, fx, o);
      out.push(c.enviados.filter((m) => m.t !== 'setopt' && m.t !== 'setcost'));
    } else {
      azar = rng(seed);
      await t.lgPlay(L, fx, o);
      out.push(plano(enviadosE));
    }
  }
  return { clasica: out[0], engine: out[1], reglas, base };
}

// La nueva cambia el color de un luchador que se confunde con su rival o es
// verde (lgColoresCruces) y la clásica no: el color de los luchadores no se
// compara.
/** @param {any[]} ms */
const sinColorLuchador = (ms) =>
  ms.map((m) => {
    if (m.t !== 'seed-species') return m;
    const { color: _c, ...sp } = m.sp;
    return { ...m, sp };
  });

test('reglasAOpciones + mensajesPartido = lo que la clásica le manda al worker', async () => {
  for (const caso of CASOS)
    for (const fmt of FORMATOS)
      for (const seed of [1, 7]) {
        const r = await jugar(caso, fmt, seed);
        const msg = `${caso.nombre} · ${fmt.capMode} · semilla ${seed}`;
        assert.deepStrictEqual(sinColorLuchador(r.engine), sinColorLuchador(r.clasica), msg);
        // El reinicio lleva la semilla, el modo F1 y el alga de arranque.
        const reset = r.clasica.find((m) => m.t === 'reset');
        assert.equal(reset.seed, caso.replay ?? Math.floor(rng(seed)() * 100000), msg);
        assert.equal(reset.options.opts[91], 1, msg);
        assert.deepEqual(reset.species, siembraArranque(), msg);
      }
});

test('los casos de verdad cambian las opciones (el test no compara dos bases iguales)', async () => {
  const r = await jugar(CASOS[4], FORMATOS[0], 3);
  const o = r.clasica.find((m) => m.t === 'reset').options;
  assert.notDeepEqual(o, r.base);
  assert.equal(o.fieldW, 24000); // o-fsize 3 de la foto
  assert.equal(o.opts[11], 40); // la foto es de antes de DESPUES: pisa el 99
  assert.equal(o.costs[30], 0.1);
  assert.equal(o.costs[56], -1); // data-on del maestro de costes dinámicos
  const f = await jugar(CASOS[6], FORMATOS[0], 3);
  const g = f.clasica.find((m) => m.t === 'reset').options;
  assert.equal(g.fieldW, 32000); // 'abc' → '' → 32000
  assert.equal(g.fieldH, 1000);
  assert.equal(g.opts[53], 0); // '7' no es una opción del select
  assert.equal(g.opts[11], 0); // '12abc' no es un número válido
  assert.equal(g.opts[13], 0.5);
  assert.equal(g.opts[10], 1); // !!'false'
});

test('el panel de la clásica como datos: controles, tamaños, presets y alga', () => {
  const c = clasica();
  // OPT_GROUPS + los data-id fijos de la barra lateral.
  const grupos = plano(c.ev('OPT_GROUPS'));
  const esperado = [];
  for (const g of grupos)
    for (const it of g.items) {
      if (it.note || it.btn) continue;
      /** @type {any} */
      const x = {};
      for (const k of ['id', 'cost', 'key']) if (it[k] !== undefined) x[k] = it[k];
      if (it.bool) x.bool = true;
      if (it.sel) x.sel = it.sel.map((/** @type {any[]} */ s) => String(s[0]));
      if (it.on !== undefined) x.on = it.on;
      esperado.push(x);
    }
  const fijos = c.ctx.document
    .lista()
    .filter((/** @type {any} */ el) => el.enAside && !el.panel && el.dataset.id !== undefined);
  for (const el of fijos)
    esperado.push(
      el.type === 'checkbox' ? { id: +el.dataset.id, bool: true } : { id: +el.dataset.id },
    );
  assert.deepStrictEqual(plano(CONTROLES_CLASICA), esperado);
  // Los mismos ids que el DOM (lo que fotografía lgRuleEls, sin los del campo).
  const ids = plano(
    c.ev(
      "[...document.querySelectorAll('aside [data-id], #opts-panel [data-cost], #opts-panel [data-key]')].map((e) => e.id)",
    ),
  );
  assert.deepStrictEqual(CONTROLES_CLASICA.map(idControl).sort(), ids.sort());
  for (let n = 0; n <= 15; n++)
    assert.deepStrictEqual(fieldSizeDims(n), plano(c.ev(`fieldSizeDims(${n})`)), `tamaño ${n}`);
  assert.deepStrictEqual(plano(PHYS_CLASICA), plano(c.ev('PHYS_PRESETS')));
  assert.deepStrictEqual(plano(ALGA_ARRANQUE), plano(c.ev('PRESETS.alga')));
  // collectOptions de un panel sin tocar = reglasAOpciones de su propia foto.
  const base = plano(c.ev('collectOptions()'));
  assert.deepStrictEqual(reglasAOpciones(plano(c.ev('lgCaptureRules()')), base), base);
});

test('mensajesPartido y reglasAOpciones: errores con clave', () => {
  const plan = {
    seed: 1,
    rules: {},
    f1: { rounds: 5, wins: 0, cap: 0, capMode: 'pop', popCap: 0 },
    species: [],
  };
  assert.throws(() => mensajesPartido(/** @type {any} */ (plan), undefined), {
    clave: 'no-options',
  });
  assert.throws(() => mensajesPartido(/** @type {any} */ (plan), {}, /** @type {any} */ ({})), {
    clave: 'bad-base',
  });
  assert.throws(() => reglasAOpciones({}, undefined), { clave: 'no-base-options' });
  const m = mensajesPartido(/** @type {any} */ (plan), { opts: {} });
  assert.deepStrictEqual(m.find((x) => x.t === 'reset')?.species, siembraArranque());
  assert.deepStrictEqual(
    mensajesPartido(/** @type {any} */ (plan), { opts: {} }, [])[3].species,
    [],
  );
});
