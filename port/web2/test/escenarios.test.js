// @ts-check
// Escenarios (engine/escenarios/, decisiones 12 y 13): validación con casos
// buenos y malos, normalización, los mensajes de aplicar(), la clasificación
// de diff() y los escenarios de fábrica (validan y referencian bots que
// existen en el Bestiary con el ADN de su hash). Con el wasm compilado, un
// escenario de fábrica se aplica de verdad en engine/worker.js.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  ESCENARIOS_FABRICA,
  esDeFabrica,
  FABRICA_CRUDA,
  IDS_FABRICA,
  normalizarPropio,
  validarPropio,
} from '../engine/escenarios/fabrica.js';
import {
  aplicar,
  diff,
  ErrorEscenario,
  normalizar,
  resolverOpciones,
  textoEn,
  validar,
  verificarAdn,
} from '../engine/escenarios/index.js';
import { lgHash } from '../engine/league.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
/** @param {string} nombre */
const archivoDe = (nombre) => BOTS.find((/** @type {any} */ b) => b.name === nombre);
/** @param {{bot: string}} s */
const adnBestiario = (s) => {
  const b = archivoDe(s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};

const BUENO = {
  formato: 1,
  id: 'prueba',
  nombre: { es: 'Prueba', en: 'Test' },
  etiquetas: ['x'],
  opciones: { base: 'clasica', cambios: { 'opt:33': true, 'cost:56': true, 'base:minVegs': 3 } },
  especies: [
    { bot: 'Alga', cantidad: 10, color: '#30D030', vegetal: true, adn: 'cond start stop end' },
    { bot: 'Bicho', cantidad: 2, color: '#ff0000', vegetal: false, energia: 5000 },
  ],
  objetos: {
    obstaculos: [
      { tipo: 'laberinto', forma: 'h' },
      { tipo: 'formas', ancho: 0.1, alto: 0.1 },
      { tipo: 'forma' },
    ],
    teleporters: [{ tipo: 'local' }],
  },
};

/** @param {(x: any) => void} f */
const variante = (f) => {
  const x = structuredClone(BUENO);
  f(x);
  return x;
};
/** @param {unknown} x */
const codigos = (x) => validar(x).map((e) => e.codigo);

test('validar: el caso bueno y el mínimo no dan errores', () => {
  assert.deepEqual(validar(BUENO), []);
  assert.deepEqual(
    validar({ formato: 1, id: 'm', nombre: 'Mínimo', opciones: { base: 'f1' }, especies: [] }),
    [],
  );
});

test('validar: casos malos con su código y su ruta', () => {
  assert.deepEqual(codigos(null), ['no-objeto']);
  assert.deepEqual(codigos([]), ['no-objeto']);
  assert.deepEqual(codigos(variante((x) => (x.formato = 2))), ['formato']);
  assert.deepEqual(codigos(variante((x) => (x.id = 'Con Espacios'))), ['id']);
  assert.deepEqual(codigos(variante((x) => (x.nombre = { es: 'solo es' }))), ['nombre']);
  assert.deepEqual(codigos(variante((x) => (x.nombre = ''))), ['nombre']);
  assert.deepEqual(codigos(variante((x) => (x.etiquetas = [3]))), ['etiquetas']);
  assert.deepEqual(codigos(variante((x) => (x.destino = 'marte'))), ['destino']);
  assert.deepEqual(codigos(variante((x) => delete x.opciones)), ['opciones']);
  assert.deepEqual(codigos(variante((x) => (x.opciones.base = 'f2'))), ['base']);
  const e = validar(variante((x) => (x.opciones.cambios['opt:999'] = 1)));
  assert.deepEqual(e, [{ codigo: 'clave-desconocida', ruta: 'opciones.cambios.opt:999' }]);
  assert.deepEqual(codigos(variante((x) => (x.opciones.cambios['opt:34'] = 0))), ['valor-rango']);
  assert.deepEqual(codigos(variante((x) => (x.opciones.cambios['opt:53'] = 1))), ['valor-enum']);
  assert.deepEqual(codigos(variante((x) => (x.opciones.cambios['opt:33'] = 'sí'))), ['valor-tipo']);
  assert.deepEqual(codigos(variante((x) => (x.especies = {}))), ['especies']);
  assert.deepEqual(codigos(variante((x) => (x.especies[0].bot = ''))), ['especie-bot']);
  assert.deepEqual(codigos(variante((x) => (x.especies[0].cantidad = 0))), ['especie-cantidad']);
  assert.deepEqual(codigos(variante((x) => (x.especies[0].cantidad = 1.5))), ['especie-cantidad']);
  assert.deepEqual(codigos(variante((x) => (x.especies[0].color = 'verde'))), ['especie-color']);
  assert.deepEqual(codigos(variante((x) => (x.especies[0].vegetal = 1))), ['especie-vegetal']);
  assert.deepEqual(codigos(variante((x) => (x.especies[1].energia = 40000))), ['especie-energia']);
  assert.deepEqual(codigos(variante((x) => (x.especies[1].origen = 'foro'))), ['especie-origen']);
  assert.deepEqual(codigos(variante((x) => (x.especies[1].hash = 'XYZ'))), ['especie-hash']);
  assert.deepEqual(codigos(variante((x) => (x.especies[0].hash = '00000000'))), [
    'especie-hash-adn',
  ]);
  assert.deepEqual(codigos(variante((x) => (x.especies[0].adn = ' '))), ['especie-adn']);
  const r = validar(variante((x) => (x.especies[1].color = '#12345')));
  assert.equal(r[0].ruta, 'especies.1.color');
  assert.deepEqual(codigos(variante((x) => (x.objetos = []))), ['objetos']);
  assert.deepEqual(codigos(variante((x) => (x.objetos.obstaculos[0].forma = 'cubo'))), [
    'obstaculo-forma',
  ]);
  assert.deepEqual(codigos(variante((x) => (x.objetos.obstaculos[0].pasillo = -3))), [
    'obstaculo-tamano',
  ]);
  assert.deepEqual(codigos(variante((x) => (x.objetos.obstaculos[1].ancho = 2))), [
    'obstaculo-tamano',
  ]);
  assert.deepEqual(codigos(variante((x) => (x.objetos.obstaculos[2].tipo = 'roca'))), [
    'obstaculo-tipo',
  ]);
  assert.deepEqual(codigos(variante((x) => (x.objetos.teleporters = [{ tipo: 'internet' }]))), [
    'teleporter',
  ]);
  assert.deepEqual(
    codigos(variante((x) => (x.objetos.teleporters = Array(11).fill({ tipo: 'local' })))),
    ['teleporters-tope'],
  );
  // varios errores a la vez
  assert.equal(validar({ formato: 1 }).length, 4);
});

test('normalizar: defaults, bool a número y copia independiente', () => {
  const e = normalizar(BUENO);
  assert.equal(e.destino, 'observar');
  assert.equal(e.descripcion, '');
  assert.deepEqual(e.opciones.cambios, { 'opt:33': 1, 'cost:56': -1, 'base:minVegs': 3 });
  assert.equal(e.especies[0].color, '#30d030');
  assert.equal(e.especies[0].energia, 3000);
  assert.equal(e.especies[0].origen, 'bestiario');
  assert.equal(e.especies[1].energia, 5000);
  assert.deepEqual(e.objetos.obstaculos, [
    { tipo: 'laberinto', forma: 'h', pasillo: 500, muro: 50 },
    { tipo: 'formas', ancho: 0.1, alto: 0.1 },
    { tipo: 'forma', ancho: 0.2, alto: 0.2 },
  ]);
  assert.deepEqual(normalizar(e), e, 'idempotente');
  e.especies[0].cantidad = 99;
  assert.equal(BUENO.especies[0].cantidad, 10);
  assert.throws(
    () => normalizar({ formato: 1 }),
    (/** @type {any} */ err) => err instanceof ErrorEscenario && err.errores.length === 4,
  );
  assert.equal(textoEn(e.nombre, 'en'), 'Test');
  assert.equal(textoEn('Solo', 'en'), 'Solo');
});

test('aplicar: la secuencia de mensajes del protocolo del worker', () => {
  const e = normalizar(BUENO);
  const m = aplicar(e, 1234, (s) => (s.bot === 'Bicho' ? 'start stop end' : undefined));
  assert.deepEqual(
    m.map((x) => x.t),
    ['run', 'reset', 'maze', 'shapes-add10', 'shape', 'teleporter'],
  );
  assert.deepEqual(m[0], { t: 'run', running: false });
  const r = m[1];
  assert.equal(r.seed, 1234);
  assert.equal(r.limpio, true, 'C15: la sim no hereda nada de la anterior');
  assert.deepEqual(r.species, [
    {
      dna: 'cond start stop end',
      name: 'Alga.txt',
      veg: true,
      qty: 10,
      nrg: 3000,
      color: 0x30 + 0xd0 * 256 + 0x30 * 65536,
    },
    { dna: 'start stop end', name: 'Bicho.txt', veg: false, qty: 2, nrg: 5000, color: 255 },
  ]);
  const o = r.options;
  assert.equal(o.minVegs, 3);
  assert.equal(o.mutations, true);
  assert.equal(o.fieldW, 32000);
  assert.equal(o.opts[33], 1);
  assert.equal(o.costs[56], -1);
  assert.deepEqual(m[2], { t: 'maze', kind: 'h', corridor: 500, wall: 50 });
  assert.deepEqual(m[3], { t: 'shapes-add10', dw: 0.1, dh: 0.1 });
  assert.deepEqual(m[4], { t: 'shape', dw: 0.2, dh: 0.2 });
  // sin ADN → error; semilla inválida → error
  assert.throws(
    () => aplicar(e, 1),
    (/** @type {any} */ err) => err.codigo === 'sin-adn',
  );
  assert.throws(
    () => aplicar(e, Number.NaN, () => 'x'),
    (/** @type {any} */ err) => err.codigo === 'semilla',
  );
  // la base F1 llega entera
  const f = normalizar({ ...BUENO, opciones: { base: 'f1' } });
  const of = aplicar(f, 1, () => 'x')[1].options;
  assert.deepEqual([of.fieldW, of.fieldH, of.mutations, of.costs[23]], [9237, 6928, false, 2]);
});

test('verificarAdn avisa si el ADN cambió desde que se guardó el hash', () => {
  const e = normalizar(
    variante((x) => {
      x.especies[1].hash = lgHash('start stop end');
    }),
  );
  assert.deepEqual(
    verificarAdn(e, () => 'start stop end'),
    [],
  );
  assert.deepEqual(
    verificarAdn(e, () => 'otro'),
    [{ indice: 1, bot: 'Bicho', esperado: lgHash('start stop end'), actual: lgHash('otro') }],
  );
});

test('diff: vivos como mensajes, el resto requiere sim nueva', () => {
  const actual = normalizar(BUENO);
  assert.deepEqual(diff(actual, actual), {
    vivo: [],
    nueva: [],
    mensajes: [],
    requiereNueva: false,
  });
  const b = normalizar(
    variante((x) => {
      x.opciones.cambios['cost:23'] = 2;
      x.opciones.cambios['opt:11'] = 60;
      x.opciones.cambios['opt:33'] = false;
    }),
  );
  const d = diff(b, actual);
  assert.equal(d.requiereNueva, false);
  assert.deepEqual(d.mensajes, [
    { t: 'setopt', id: 11, v: 60 },
    { t: 'setopt', id: 33, v: 0 },
    { t: 'setcost', i: 23, v: 2 },
  ]);
  assert.deepEqual(d.vivo[0], { clave: 'opt:11', antes: 40, despues: 60 });
  // el campo, las especies y los objetos requieren sim nueva; las base van
  // en vivo con setbase (C12)
  const n = normalizar(
    variante((x) => {
      x.opciones.cambios['base:fieldW'] = 16000;
      x.opciones.cambios['base:minVegs'] = 4;
      x.especies[0].cantidad = 11;
      x.objetos.teleporters = [];
    }),
  );
  const dn = diff(n, actual);
  assert.equal(dn.requiereNueva, true);
  assert.deepEqual(dn.mensajes, [{ t: 'setbase', vals: { minVegs: 4 } }]);
  assert.deepEqual(dn.vivo, [{ clave: 'base:minVegs', antes: 3, despues: 4 }]);
  assert.deepEqual(dn.nueva, [
    { que: 'parametro', clave: 'base:fieldW', antes: 32000, despues: 16000 },
    { que: 'especies' },
    { que: 'objetos' },
  ]);
  // solo opciones base: no requiere sim nueva
  const sb = normalizar(
    variante((x) => {
      x.opciones.cambios['base:maxEnergy'] = 30;
      x.opciones.cambios['base:mutations'] = false;
    }),
  );
  const dsb = diff(sb, actual);
  assert.equal(dsb.requiereNueva, false);
  assert.deepEqual(dsb.mensajes, [
    { t: 'setbase', vals: { maxEnergy: 30 } },
    { t: 'setbase', vals: { mutations: 0 } },
  ]);
  // cambiar la base: cuentan los valores efectivos que cambian
  const f1 = normalizar({ ...BUENO, opciones: { base: 'f1', cambios: BUENO.opciones.cambios } });
  const df = diff(f1, actual);
  assert.ok(df.requiereNueva); // campo
  assert.deepEqual(
    df.nueva.map((x) => (x.que === 'parametro' ? x.clave : x.que)),
    ['base:fieldW', 'base:fieldH'],
  );
  assert.ok(df.mensajes.some((x) => x.t === 'setcost' && x.i === 23 && x.v === 2));
  assert.ok(df.mensajes.some((x) => x.t === 'setopt' && x.id === 11 && x.v === 180));
  // un cambio igual al de la base no es diferencia
  const igual = normalizar(variante((x) => (x.opciones.cambios['opt:11'] = 40)));
  assert.deepEqual(diff(igual, actual).mensajes, []);
  // setbase, después los setopt y después los setcost, por id creciente
  // (orden del reset)
  const tipos = df.mensajes.map((x) =>
    x.t === 'setbase' ? 'b' : x.t === 'setopt' ? `o${x.id}` : `c${x.i}`,
  );
  assert.deepEqual(
    tipos.map((t) => t[0]).join(''),
    [...tipos.map((t) => t[0])].sort((a, b) => 'boc'.indexOf(a) - 'boc'.indexOf(b)).join(''),
  );
  assert.ok(tipos.includes('b'), 'la base F1 cambia vegetales y mutaciones en vivo');
  const os = tipos.filter((t) => t[0] === 'o');
  assert.deepEqual(
    os.map((t) => Number(t.slice(1))),
    [...os.map((t) => Number(t.slice(1)))].sort((a, b) => a - b),
  );
});

test('diff: acopladas (Toroidal = 2 && 3; 101 tras 97) en el orden en que escriben', () => {
  /** @param {Record<string, any>} cambios */
  const esc = (cambios) =>
    normalizar({
      formato: 1,
      id: 'x',
      nombre: 'x',
      opciones: { base: 'clasica', cambios },
      especies: [],
    });
  const paredes = esc({});
  // paredes → toroidal: 1 escribe los dos ejes; no hace falta mandarlos
  const t = diff(esc({ 'opt:2': 1, 'opt:3': 1 }), paredes);
  assert.deepEqual(t.mensajes, [{ t: 'setopt', id: 1, v: 1 }]);
  assert.deepEqual(t.vivo, [{ clave: 'opt:1', antes: 0, despues: 1 }]);
  // toroidal → cilindro: 1 = 0 apaga los dos y se reenvía el que queda en 1
  const c = diff(esc({ 'opt:2': 0, 'opt:3': 1 }), esc({ 'opt:2': 1, 'opt:3': 1 }));
  assert.deepEqual(c.mensajes, [
    { t: 'setopt', id: 1, v: 0 },
    { t: 'setopt', id: 3, v: 1 },
  ]);
  assert.deepEqual(c.vivo[1], { clave: 'opt:3', antes: 1, despues: 1, reenvio: true });
  // un eje suelto sin cambiar Toroidal: solo ese eje
  assert.deepEqual(diff(esc({ 'opt:3': 1 }), paredes).mensajes, [{ t: 'setopt', id: 3, v: 1 }]);
  // el caso de la revisión: un escenario no puede traer opt:1 (derivado)
  assert.deepEqual(
    validar({
      formato: 1,
      id: 'x',
      nombre: 'x',
      opciones: { base: 'clasica', cambios: { 'opt:1': 1, 'opt:2': 0, 'opt:3': 1 } },
      especies: [],
    }),
    [{ codigo: 'clave-derivada', ruta: 'opciones.cambios.opt:1' }],
  );
  // 97 pisa 101: se reenvía 101 si tiene que ser otro
  const r = diff(esc({ 'opt:97': 3, 'opt:101': 7 }), esc({ 'opt:101': 7 }));
  assert.deepEqual(r.mensajes, [
    { t: 'setopt', id: 97, v: 3 },
    { t: 'setopt', id: 101, v: 7 },
  ]);
  // …y no si 101 sigue a 97
  assert.deepEqual(diff(esc({ 'opt:97': 3 }), paredes).mensajes, [{ t: 'setopt', id: 97, v: 3 }]);
  // 101 solo
  assert.deepEqual(diff(esc({ 'opt:101': 9 }), paredes).mensajes, [{ t: 'setopt', id: 101, v: 9 }]);
});

test('un escenario propio no puede usar el id de uno de fábrica', () => {
  const x = { ...structuredClone(BUENO), id: 'sopa-primordial' };
  assert.deepEqual(validar(x), [], 'sin reservados, el formato es válido');
  assert.deepEqual(validarPropio(x), [
    { codigo: 'id-reservado', ruta: 'id', detalle: 'sopa-primordial' },
  ]);
  assert.throws(
    () => normalizarPropio(x),
    (/** @type {any} */ e) => e.codigo === 'invalido' && e.errores[0].codigo === 'id-reservado',
  );
  assert.deepEqual(validarPropio(BUENO), []);
  assert.equal(normalizarPropio(BUENO).id, 'prueba');
  assert.deepEqual(validar(BUENO, { reservados: ['prueba'] })[0].codigo, 'id-reservado');
  assert.ok(IDS_FABRICA.includes('partido-f1'));
});

test('fábrica: validan, ids únicos y bots del Bestiary con su hash', () => {
  assert.ok(ESCENARIOS_FABRICA.length >= 6);
  const ids = ESCENARIOS_FABRICA.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const x of FABRICA_CRUDA) assert.deepEqual(validar(x), [], /** @type {any} */ (x).id);
  for (const id of [
    'sopa-primordial',
    'depredador-y-presa',
    'partido-f1',
    'dia-y-noche',
    'laberinto',
  ])
    assert.ok(esDeFabrica(id), id);
  assert.ok(!esDeFabrica('prueba'));
  for (const e of ESCENARIOS_FABRICA) {
    assert.ok(Object.isFrozen(e));
    assert.equal(typeof e.nombre, 'object');
    assert.ok(e.descripcion && typeof e.descripcion === 'object', `${e.id}: descripción es/en`);
    assert.ok(e.especies.length > 0);
    for (const s of e.especies) {
      const b = archivoDe(s.bot);
      assert.ok(b, `${e.id}: ${s.bot} no está en bots.json`);
      assert.equal(b.veg, s.vegetal, `${e.id}: ${s.bot} vegetal`);
      assert.ok(s.hash, `${e.id}: ${s.bot} sin hash`);
    }
    assert.deepEqual(verificarAdn(e, adnBestiario), [], e.id);
    // se puede aplicar con el ADN del Bestiary
    const m = aplicar(e, 1, adnBestiario);
    assert.equal(m[1].species.length, e.especies.length);
  }
  const zeb = ESCENARIOS_FABRICA.find((e) => e.id === 'depredador-y-presa');
  assert.ok(zeb?.especies.some((s) => s.bot === 'Zebedee V2.1 (F2)(Jez)-26.07.06'));
  const f1 = ESCENARIOS_FABRICA.find((e) => e.id === 'partido-f1');
  assert.equal(f1?.destino, 'competir');
  assert.equal(resolverOpciones(/** @type {any} */ (f1))['base:fieldW'], 9237);
  // btnSetF1: qty = 5 para todas las especies y Toroidal = True
  assert.deepEqual(
    f1?.especies.map((s) => s.cantidad),
    [5, 5, 5],
  );
  assert.equal(aplicar(/** @type {any} */ (f1), 1, adnBestiario)[1].options.opts[1], 1);
});

test('un escenario de fábrica corre en engine/worker.js', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 120000,
}, async () => {
  const c = new ClienteSim(workerEngine({ fechaFija: 0, semillaAzar: 1 }));
  try {
    await c.wait((m) => m.t === 'ready');
    const e = /** @type {any} */ (ESCENARIOS_FABRICA.find((x) => x.id === 'laberinto'));
    for (const m of aplicar(e, 4321, adnBestiario)) c.send(m);
    await c.sync();
    const logs = c.msgs.filter((m) => m.t === 'log').map((m) => m.msg);
    assert.ok(
      logs.some((l) => l.startsWith('new sim (seed 4321)')),
      logs.join('\n'),
    );
    assert.ok(
      logs.some((l) => l.startsWith('seeded 20 × Alga minimalis 3.0.txt')),
      logs.join('\n'),
    );
    assert.ok(
      logs.some((l) => l.startsWith('maze spiral: +')),
      logs.join('\n'),
    );
    // las opciones llegaron: 80 (ven las formas) y el panel de la clásica
    for (const [id, v] of [
      [80, 1],
      [34, 500],
      [110, 200],
    ]) {
      c.send({ t: 'getopt', id });
      const r = await c.wait((m) => m.t === 'opt' && m.id === id);
      assert.equal(r.v, v, `opt ${id}`);
    }
    await c.sync();
    const antes = c.stats?.cycle ?? 0;
    for (let i = 0; i < 20; i++) c.send({ t: 'step' });
    // dos barreras: el frame pendiente sale tras el ack del anterior
    await c.sync();
    await c.sync();
    assert.equal(c.stats?.cycle, antes + 20);
    assert.ok(c.stats.bots > 0);
    assert.ok(!c.error, String(c.error));
  } finally {
    await c.stop();
  }
});
