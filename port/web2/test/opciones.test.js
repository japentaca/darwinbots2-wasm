// @ts-check
// Catálogo de parámetros (engine/opciones.js, decisión 14): cubre todos los
// ids de la API del wasm y los costos con nombre de SimOptions.bas, sin
// repetidos y con textos en los dos idiomas. Con el wasm compilado, además,
// cada id del catálogo hace ida y vuelta por db_sim_set_opt/get_opt.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  BASES,
  CONTROLES_BASICOS,
  costosF1,
  dimensionesCampo,
  efectosDe,
  fusionarCambios,
  GRUPOS,
  mensajeVivo,
  normalizarValor,
  opcionesReset,
  PARAMETROS,
  parametro,
  valorEfectivo,
  valoresResueltos,
} from '../engine/opciones.js';
import { cargarDbCore, hayWasm, PORT_DIR, SIN_WASM } from './util/dbcore-node.js';

const API = fs.readFileSync(path.join(PORT_DIR, 'wasm', 'dbcore_api.cpp'), 'utf8');
const SIMOPTIONS = fs.readFileSync(
  path.join(PORT_DIR, '..', 'Darwinbots2', 'SimOptions.bas'),
  'latin1',
);

/** Ids de los `case N:` del cuerpo de una función exportada. @param {string} fn */
function idsDe(fn) {
  const i = API.indexOf(`DB_EXPORT ${fn.startsWith('db_sim_get') ? 'double' : 'void'} ${fn}(`);
  assert.ok(i >= 0, `no encuentro ${fn}`);
  const fin = API.indexOf('\n}\n', i);
  const cuerpo = API.slice(i, fin);
  return new Set([...cuerpo.matchAll(/case (\d+):/g)].map((m) => Number(m[1])));
}

const opts = PARAMETROS.filter((p) => p.tipo === 'opt');
const costs = PARAMETROS.filter((p) => p.tipo === 'cost');

test('cubre todos los ids de db_sim_set_opt y db_sim_get_opt', () => {
  const set = idsDe('db_sim_set_opt');
  const get = idsDe('db_sim_get_opt');
  assert.deepEqual(
    [...set].sort((a, b) => a - b),
    [...get].sort((a, b) => a - b),
  );
  assert.ok(set.size > 60, `pocos ids: ${set.size}`);
  const cat = new Set(opts.map((p) => p.id));
  assert.deepEqual(
    [...set].filter((id) => !cat.has(id)),
    [],
    'ids del wasm sin entrada en el catálogo',
  );
  assert.deepEqual(
    [...cat].filter((id) => !set.has(/** @type {number} */ (id))),
    [],
    'ids del catálogo que el wasm no conoce',
  );
});

test('cubre los costos con nombre de SimOptions.bas (0..62) con su variable', () => {
  const bloque = SIMOPTIONS.slice(0, SIMOPTIONS.indexOf('TEMPSUNSUSPEND'));
  const consts = [...bloque.matchAll(/Public Const (\w+) As Integer = (\d+)/g)].map((m) => ({
    variable: m[1],
    id: Number(m[2]),
  }));
  assert.ok(consts.length >= 30);
  const cat = new Map(costs.map((p) => [p.id, p.variable]));
  for (const c of consts) assert.equal(cat.get(c.id), c.variable, `costo ${c.id}`);
  assert.equal(costs.length, consts.length);
  // setcost acepta 0..70
  for (const p of costs)
    assert.ok(/** @type {number} */ (p.id) >= 0 && /** @type {number} */ (p.id) <= 70);
});

test('las opciones base son las del reset del worker', () => {
  const sim = fs.readFileSync(new URL('../engine/sim.js', import.meta.url), 'utf8');
  const i = sim.indexOf('function resetSim(');
  const cuerpo = sim.slice(i, sim.indexOf('api.start(sim', i));
  const leidas = new Set([...cuerpo.matchAll(/\bo\.(\w+)/g)].map((m) => m[1]));
  leidas.delete('opts');
  leidas.delete('costs');
  const bases = new Set(PARAMETROS.filter((p) => p.tipo === 'base').map((p) => p.id));
  assert.deepEqual([...leidas].sort(), [...bases].sort());
});

test('sin claves repetidas, grupos conocidos y textos es/en', () => {
  const claves = PARAMETROS.map((p) => p.clave);
  assert.equal(new Set(claves).size, claves.length);
  const grupos = new Set(GRUPOS.map((g) => g.id));
  for (const p of PARAMETROS) {
    assert.ok(grupos.has(p.grupo), `${p.clave}: grupo ${p.grupo}`);
    for (const t of [p, p.ayuda]) {
      assert.ok(typeof t.es === 'string' && t.es.length > 0, `${p.clave}: es`);
      assert.ok(typeof t.en === 'string' && t.en.length > 0, `${p.clave}: en`);
    }
    assert.ok(p.variable, `${p.clave}: variable`);
    assert.ok(['basico', 'avanzado'].includes(p.nivel));
    assert.ok(normalizarValor(p, p.porDefecto).ok, `${p.clave}: el default no valida`);
    if (p.valor === 'enum') {
      assert.ok(p.valores && p.valores.length > 1);
      for (const v of p.valores) assert.ok(v.es && v.en);
    }
    if (p.valor === 'int' || p.valor === 'float')
      assert.ok(p.min !== undefined && p.max !== undefined);
  }
  for (const g of GRUPOS) assert.ok(g.es && g.en && PARAMETROS.some((p) => p.grupo === g.id));
});

test('vivo: solo el tamaño del campo requiere sim nueva (C12: las base van con setbase)', () => {
  const noVivos = PARAMETROS.filter((p) => !p.vivo).map((p) => p.clave);
  assert.deepEqual(noVivos.sort(), ['base:fieldH', 'base:fieldW']);
  assert.deepEqual(mensajeVivo('opt:33', 1), { t: 'setopt', id: 33, v: 1 });
  assert.deepEqual(mensajeVivo('cost:23', 2), { t: 'setcost', i: 23, v: 2 });
  assert.deepEqual(mensajeVivo('base:minVegs', 3), { t: 'setbase', vals: { minVegs: 3 } });
  assert.deepEqual(mensajeVivo('base:mutations', 0), { t: 'setbase', vals: { mutations: 0 } });
  assert.equal(mensajeVivo('base:fieldW', 1000), null);
  // cada base viva es una de las que setbase del worker escribe
  const sim = fs.readFileSync(new URL('../engine/sim.js', import.meta.url), 'utf8');
  const i = sim.indexOf('function setBase(');
  const cuerpo = sim.slice(i, sim.indexOf('\n  }\n', i));
  for (const p of PARAMETROS.filter((x) => x.tipo === 'base' && x.vivo))
    assert.ok(cuerpo.includes(`hay('${p.id}')`), `setbase no escribe ${p.id}`);
});

test('acopladas: Toroidal derivado de 2 y 3, 101 sigue a 97', () => {
  const r = valoresResueltos('clasica');
  assert.equal(parametro('opt:1')?.derivado, true);
  assert.equal(valorEfectivo(r, 'opt:1'), 0);
  assert.equal(valorEfectivo({ ...r, 'opt:2': 1 }, 'opt:1'), 0);
  assert.equal(valorEfectivo({ ...r, 'opt:2': 1, 'opt:3': 1 }, 'opt:1'), 1);
  assert.equal(valorEfectivo({ ...r, 'opt:1': 1 }, 'opt:1'), 0, 'un valor propio se ignora');
  // el reset manda 1 solo con los dos ejes conectados
  assert.equal(opcionesReset(r).opts[1], undefined);
  assert.equal(opcionesReset({ ...r, 'opt:2': 1, 'opt:3': 1 }).opts[1], 1);
  assert.equal(opcionesReset({ ...r, 'opt:1': 1 }).opts[1], undefined);
  // 101 sin fijar = 97 (la base clásica manda 97 = 5)
  assert.equal(valorEfectivo(r, 'opt:101'), 5);
  assert.equal(valorEfectivo({ ...r, 'opt:101': 7 }, 'opt:101'), 7);
  assert.equal(valorEfectivo({}, 'opt:101'), 0);
  assert.deepEqual(efectosDe('opt:1', 1), { 'opt:1': 1, 'opt:2': 1, 'opt:3': 1 });
  assert.deepEqual(efectosDe('opt:97', 3), { 'opt:97': 3, 'opt:101': 3 });
  assert.deepEqual(efectosDe('opt:33', 1), { 'opt:33': 1 });
  // fusionarCambios: el orden y los efectos de las acopladas
  assert.deepEqual(fusionarCambios({ 'opt:101': 7 }, { 'opt:97': 3 }), { 'opt:97': 3 });
  assert.deepEqual(Object.entries(fusionarCambios({ 'opt:97': 3 }, { 'opt:101': 7 })), [
    ['opt:97', 3],
    ['opt:101', 7],
  ]);
  assert.deepEqual(fusionarCambios({ 'opt:2': 0, 'opt:33': 1 }, { 'opt:1': 1, 'opt:3': 0 }), {
    'opt:33': 1,
    'opt:2': 1,
    'opt:3': 0,
  });
  const f = fusionarCambios({ 'opt:3': 1 }, { 'opt:1': 1 });
  assert.equal(valorEfectivo({ ...r, ...f }, 'opt:1'), 1);
  assert.equal('opt:1' in f, false, 'el derivado no queda en los cambios');
});

test('normalizarValor: tipos, rangos, enums y bool con valor on', () => {
  const p = /** @param {string} k */ (k) => /** @type {any} */ (parametro(k));
  assert.deepEqual(normalizarValor(p('opt:33'), true), { ok: true, v: 1 });
  assert.deepEqual(normalizarValor(p('cost:56'), true), { ok: true, v: -1 });
  // USEDYNAMICCOSTS: el core lo toma encendido con cualquier valor ≠ 0
  // (master.hpp:109, Master.bas:254): 1 vale y se guarda como el -1 de la UI
  assert.deepEqual(normalizarValor(p('cost:56'), 1), { ok: true, v: -1 });
  assert.deepEqual(normalizarValor(p('cost:56'), 0), { ok: true, v: 0 });
  assert.deepEqual(normalizarValor(p('cost:61'), 2), { ok: true, v: 1 });
  // ALLOWNEGATIVECOSTX y AGECOSTMAKELOG se comparan con = 1 en el core
  assert.deepEqual(normalizarValor(p('cost:62'), -1), { ok: false, codigo: 'valor-tipo' });
  assert.deepEqual(normalizarValor(p('cost:51'), 2), { ok: false, codigo: 'valor-tipo' });
  // set_opt hace v != 0: cualquier número es un bool válido
  assert.deepEqual(normalizarValor(p('opt:33'), -1), { ok: true, v: 1 });
  assert.deepEqual(normalizarValor(p('base:mutations'), 5), { ok: true, v: 1 });
  assert.deepEqual(normalizarValor(p('opt:33'), Number.NaN), { ok: false, codigo: 'valor-tipo' });
  assert.deepEqual(normalizarValor(p('opt:33'), '1'), { ok: false, codigo: 'valor-tipo' });
  assert.deepEqual(normalizarValor(p('opt:34'), 2.5), { ok: false, codigo: 'valor-tipo' });
  assert.deepEqual(normalizarValor(p('opt:34'), 0), { ok: false, codigo: 'valor-rango' });
  assert.deepEqual(normalizarValor(p('opt:53'), 1), { ok: false, codigo: 'valor-enum' });
  assert.deepEqual(normalizarValor(p('opt:53'), 3), { ok: true, v: 3 });
  assert.deepEqual(normalizarValor(p('opt:11'), '40'), { ok: false, codigo: 'valor-tipo' });
});

// Lo que manda la clásica al reiniciar con el panel sin tocar
// (port/web/index.html: OPT_GROUPS, collectOptions y los ids 110-112).
test('base clásica = collectOptions de la clásica sin tocar', () => {
  const o = opcionesReset(valoresResueltos('clasica'));
  assert.equal(o.fieldW, 32000);
  assert.equal(o.fieldH, 32000);
  assert.equal(o.minVegs, 15);
  assert.equal(o.maxPopulation, 100);
  assert.equal(o.repopAmount, 10);
  assert.equal(o.repopCooldown, 10);
  assert.equal(o.maxEnergy, 10);
  assert.equal(o.startChlr, 16000);
  assert.equal(o.mutations, true);
  assert.equal(o.opts[34], 500);
  assert.equal(o.opts[2], 0);
  assert.equal(o.opts[3], 0);
  assert.equal(o.opts[97], 5);
  assert.equal(o.opts[110], 200);
  assert.equal(o.opts[101], undefined, 'la clásica no manda 101 (pisaría optMinRounds)');
  assert.equal(o.opts[1], undefined);
  assert.deepEqual(
    [o.costs[54], o.costs[55], o.costs[52], o.costs[56], o.costs[23]],
    [1, 50, -1, 0, 0],
  );
  assert.equal(o.costs[0], undefined, 'costos que la clásica no muestra quedan en el core');
});

test('base F1 = btnSetF1 (applyF1Settings de la clásica)', () => {
  const r = valoresResueltos('f1');
  const o = opcionesReset(r);
  assert.deepEqual([o.fieldW, o.fieldH], [9237, 6928]);
  assert.deepEqual([o.opts[2], o.opts[3]], [1, 1]);
  assert.equal(o.opts[1], 1, 'TmpOpts.Toroidal = True (OptionsForm.frm:2621)');
  assert.equal(o.maxEnergy, 40);
  assert.equal(o.maxPopulation, 25);
  assert.equal(o.minVegs, 10);
  assert.equal(o.repopCooldown, 25);
  assert.equal(o.mutations, false);
  assert.equal(o.opts[11], 180);
  assert.equal(o.opts[56], 10000);
  assert.equal(o.opts[50], 0);
  assert.equal(o.opts[40], 1);
  assert.equal(o.costs[23], 2);
  assert.equal(o.costs[30], 0.00001);
  assert.equal(o.costs[56], 0, 'DynamicCosts = False');
  assert.equal(o.costs[55], 0, 'For t = 1 To 70: el resto en 0');
  assert.equal(o.costs[54], 1);
  // el costo 0 no lo toca btnSetF1 (el For arranca en 1)
  assert.equal(o.costs[0], undefined);
  assert.equal(
    Object.keys(costosF1()).length,
    costs.filter((p) => /** @type {number} */ (p.id) >= 1).length,
  );
});

test('valorEfectivo cae al default del core', () => {
  const r = valoresResueltos('clasica');
  assert.equal(valorEfectivo(r, 'opt:96'), 100);
  assert.equal(valorEfectivo(r, 'opt:41'), 1);
  assert.equal(valorEfectivo({ ...r, 'opt:41': 0 }, 'opt:41'), 0);
  assert.throws(() => valorEfectivo(r, 'opt:999'));
  assert.throws(() => valoresResueltos('nada'));
});

test('controles básicos: 10, con textos, claves válidas y ida y vuelta', () => {
  assert.equal(CONTROLES_BASICOS.length, 10);
  const ids = CONTROLES_BASICOS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CONTROLES_BASICOS) {
    assert.ok(c.es && c.en && c.ayuda.es && c.ayuda.en, c.id);
    for (const k of c.claves) assert.ok(parametro(k), `${c.id}: ${k}`);
    for (const o of c.opciones || []) assert.ok(o.es && o.en);
  }
  const base = valoresResueltos('clasica');
  /** @param {Record<string, number>} r */
  const ef = (r) => (/** @type {string} */ k) => valorEfectivo(r, k);
  /** @param {string} id */
  const ctl = (id) => /** @type {any} */ (CONTROLES_BASICOS.find((c) => c.id === id));
  // Costos
  assert.equal(ctl('costos').lee(ef(base)), 'ninguno');
  assert.equal(ctl('costos').lee(ef(valoresResueltos('f1'))), 'f1');
  const f1 = { ...base, ...ctl('costos').escribe('f1') };
  assert.equal(ctl('costos').lee(ef(f1)), 'f1');
  assert.equal(ctl('costos').lee(ef({ ...f1, 'cost:23': 3 })), 'personalizado');
  assert.deepEqual(ctl('costos').escribe('personalizado'), {});
  // Tamaño
  assert.deepEqual(ctl('tamano').escribe(2), { 'base:fieldW': 16000, 'base:fieldH': 12000 });
  assert.equal(ctl('tamano').lee(ef(base)), 0, '32000² no es un tamaño del slider');
  assert.equal(ctl('tamano').lee(ef(valoresResueltos('f1'))), 1);
  assert.deepEqual(dimensionesCampo(1), [9237, 6928]);
  // Bordes
  assert.equal(ctl('bordes').lee(ef(base)), 'paredes');
  assert.deepEqual(ctl('bordes').escribe('cilindro-h'), { 'opt:2': 0, 'opt:3': 1 });
  // Día y noche
  assert.deepEqual(ctl('dia-noche').escribe(0), { 'opt:33': 0 });
  assert.deepEqual(ctl('dia-noche').escribe(800), { 'opt:33': 1, 'opt:34': 800 });
  assert.equal(ctl('dia-noche').lee(ef(base)), 0);
  // Medio
  assert.equal(ctl('medio').lee(ef(base)), 'espacio');
  assert.equal(ctl('medio').lee(ef({ ...base, ...ctl('medio').escribe('fluido') })), 'fluido');
  // Simples
  assert.deepEqual(ctl('mutaciones').escribe(false), { 'base:mutations': 0 });
  assert.equal(ctl('mutaciones').lee(ef(base)), true);
  assert.deepEqual(ctl('cadaveres').escribe(true), { 'opt:50': 1 });
});

test('bases: todas las claves existen y sus valores validan', () => {
  for (const [id, b] of Object.entries(BASES)) {
    assert.ok(b.es && b.en && b.ayuda.es && b.ayuda.en, id);
    for (const [k, v] of Object.entries(b.valores)) {
      const p = parametro(k);
      assert.ok(p, `${id}: ${k}`);
      assert.ok(normalizarValor(p, v).ok, `${id}: ${k}=${v}`);
    }
  }
});

test('ida y vuelta de cada opción por el wasm', { skip: !hayWasm() && SIN_WASM }, async () => {
  const M = await cargarDbCore();
  const create = M.cwrap('db_sim_create', 'number', []);
  const destroy = M.cwrap('db_sim_destroy', null, ['number']);
  const setOpt = M.cwrap('db_sim_set_opt', null, ['number', 'number', 'number']);
  const getOpt = M.cwrap('db_sim_get_opt', 'number', ['number', 'number']);
  const setCost = M.cwrap('db_sim_set_cost', null, ['number', 'number', 'number']);
  const getCost = M.cwrap('db_sim_get_cost', 'number', ['number', 'number']);
  const h = create();
  try {
    for (const p of opts) {
      if (p.id === 1) continue; // Toroidal: get(1) lee los dos ejes, se prueba aparte
      // un valor válido distinto del default
      let v = p.porDefecto;
      if (p.valor === 'bool') v = p.porDefecto ? 0 : 1;
      else if (p.valor === 'enum')
        v = /** @type {any} */ (p.valores).find((x) => x.v !== p.porDefecto).v;
      else v = Math.min(/** @type {number} */ (p.max), (p.min ?? 0) + 3);
      setOpt(h, p.id, v);
      const got = getOpt(h, p.id);
      assert.ok(Math.abs(got - v) <= Math.abs(v) * 1e-6, `opt ${p.id}: ${got} ≠ ${v}`);
    }
    setOpt(h, 1, 1);
    assert.deepEqual([getOpt(h, 1), getOpt(h, 2), getOpt(h, 3)], [1, 1, 1]);
    for (const p of costs) {
      const v = p.valor === 'bool' ? (p.on ?? 1) : 3;
      setCost(h, p.id, v);
      assert.equal(getCost(h, p.id), v, `cost ${p.id}`);
    }
  } finally {
    destroy(h);
  }
});
