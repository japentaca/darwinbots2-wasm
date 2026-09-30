// @ts-check
// Barra «Mundo» de Observar (paso N3.8, decisión 15) sin wasm: órdenes de
// objeto y sus mensajes (engine/corridas.js), el evento 'objetos' y su
// repetición en las réplicas (engine/replicas.js), el plegado a órdenes del
// escenario, el hit test y el recorrido por teclado del modo borrar
// (src/lib/observar/objetos/ordenes.js) y la corrida (corrida-nucleo.js):
// aplicarObjetos, objetosActuales, guardarObjetosEnEscenario.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import {
  copiaOrden,
  crearCorridas,
  errorOrden,
  mensajeObjeto,
  mensajesEvento,
  ORDENES_OBJETO,
  registrarCambio,
  registrarObjetos,
} from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { diff, normalizar, validar } from '../engine/escenarios/index.js';
import { crearParametros, mensajesReplica, planReplica } from '../engine/replicas.js';
import {
  contarObjetos,
  enteroPositivo,
  fraccion,
  objetoEn,
  orden,
  ordenBorrar,
  plegarObjetos,
  siguienteObjeto,
} from '../src/lib/observar/objetos/ordenes.js';
import { estadoVacio, NucleoCorrida } from '../src/lib/sim/corrida-nucleo.js';

const SOPA = /** @type {import('../engine/escenarios/index.js').Escenario} */ (
  escenarioFabrica('sopa-primordial')
);
const LAB = /** @type {import('../engine/escenarios/index.js').Escenario} */ (
  escenarioFabrica('laberinto')
);

test('cada orden de objeto da el mensaje del menú de objetos del worker', () => {
  /** @type {[any, any][]} */
  const casos = [
    [
      { tipo: 'forma', ancho: 0.2, alto: 0.1 },
      { t: 'shape', dw: 0.2, dh: 0.1 },
    ],
    [
      { tipo: 'formas', ancho: 0.05, alto: 1 },
      { t: 'shapes-add10', dw: 0.05, dh: 1 },
    ],
    [
      { tipo: 'laberinto', forma: 'spiral', pasillo: 400, muro: 40 },
      { t: 'maze', kind: 'spiral', corridor: 400, wall: 40 },
    ],
    [{ tipo: 'teleporter' }, { t: 'teleporter' }],
    [
      { tipo: 'borrar-forma', n: 3 },
      { t: 'shape-del', n: 3 },
    ],
    [{ tipo: 'borrar-formas10' }, { t: 'shapes-del10' }],
    [{ tipo: 'borrar-formas' }, { t: 'shapes-clear' }],
    [
      { tipo: 'borrar-teleporter', n: 2 },
      { t: 'tp-del', n: 2 },
    ],
    [{ tipo: 'borrar-teleporters' }, { t: 'tp-clear' }],
  ];
  assert.deepEqual(
    casos.map(([o]) => o.tipo).sort(),
    [...ORDENES_OBJETO].sort(),
    'un caso por tipo',
  );
  for (const [o, m] of casos) {
    assert.equal(errorOrden(o), null, o.tipo);
    assert.deepEqual(mensajeObjeto(o), m, o.tipo);
    assert.deepEqual(mensajesEvento({ ciclo: 5, tipo: 'objetos', orden: o }), [m]);
  }
  for (const f of ['h', 'v', 'spiral', 'checker', 'polar', 'trash'])
    assert.equal(mensajeObjeto({ tipo: 'laberinto', forma: f, pasillo: 500, muro: 50 }).kind, f);
});

test('órdenes inválidas: se rechazan antes de mandar nada', () => {
  /** @type {[any, string][]} */
  const malas = [
    [null, 'orden'],
    [{ tipo: 'volar' }, 'orden-tipo'],
    [{ tipo: 'forma', ancho: 0, alto: 0.2 }, 'orden-tamano'],
    [{ tipo: 'forma', ancho: 0.2, alto: 1.5 }, 'orden-tamano'],
    [{ tipo: 'formas', ancho: Number.NaN, alto: 0.2 }, 'orden-tamano'],
    [{ tipo: 'laberinto', forma: 'estrella', pasillo: 500, muro: 50 }, 'orden-forma'],
    [{ tipo: 'laberinto', forma: 'h', pasillo: 0, muro: 50 }, 'orden-tamano'],
    [{ tipo: 'laberinto', forma: 'h', pasillo: 500, muro: 2.5 }, 'orden-tamano'],
    [{ tipo: 'borrar-forma', n: 0 }, 'orden-indice'],
    [{ tipo: 'borrar-teleporter' }, 'orden-indice'],
  ];
  for (const [o, cod] of malas) {
    assert.equal(errorOrden(o), cod, JSON.stringify(o));
    assert.throws(() => mensajeObjeto(o));
  }
  // La copia deja solo los campos de la orden.
  assert.deepEqual(copiaOrden(/** @type {any} */ ({ tipo: 'teleporter', x: 1 })), {
    tipo: 'teleporter',
  });
});

test('registrarObjetos: un evento por orden, en orden de ciclo, junto con los demás', () => {
  const c = /** @type {any} */ ({ eventos: [] });
  registrarObjetos(c, -1, { tipo: 'teleporter' });
  registrarCambio(c, 10, { 'base:minVegs': 30 });
  registrarObjetos(c, 10, { tipo: 'forma', ancho: 0.3, alto: 0.3 });
  registrarObjetos(c, 10, { tipo: 'borrar-forma', n: 1 });
  assert.deepEqual(
    c.eventos.map((/** @type {any} */ e) => [e.ciclo, e.tipo]),
    [
      [-1, 'objetos'],
      [10, 'opciones'],
      [10, 'objetos'],
      [10, 'objetos'],
    ],
  );
  assert.throws(() => registrarObjetos(c, 9, { tipo: 'teleporter' }), /orden de ciclo/);
  assert.throws(() => registrarObjetos(c, 11, /** @type {any} */ ({ tipo: 'forma' })));
  assert.throws(() => registrarObjetos(c, -2, { tipo: 'teleporter' }), /ciclo/);
  // registrarCambio del mismo ciclo después de un evento de objetos: evento nuevo
  // (no se funde con el de opciones anterior, el orden importa).
  registrarCambio(c, 10, { 'base:minVegs': 31 });
  assert.equal(c.eventos.length, 5);
  assert.equal(c.eventos[4].tipo, 'opciones');
});

test('réplicas: los eventos de objetos van en su ciclo, en orden, con los demás', () => {
  const c = /** @type {any} */ ({ eventos: [] });
  registrarObjetos(c, -1, { tipo: 'laberinto', forma: 'h', pasillo: 500, muro: 50 });
  registrarObjetos(c, 20, { tipo: 'forma', ancho: 0.2, alto: 0.2 });
  registrarCambio(c, 20, { 'base:minVegs': 30 });
  registrarObjetos(c, 20, { tipo: 'borrar-formas10' });
  registrarObjetos(c, 45, { tipo: 'borrar-teleporters' });
  const p = crearParametros({
    escenario: SOPA,
    adn: SOPA.especies.map(() => 'cond start *.nrg 1 stop'),
    semilla: 7,
    n: 1,
    ciclos: 40,
    cada: 10,
    eventos: c.eventos,
  });
  const m = mensajesReplica(p, 0);
  const plan = planReplica(m.eventos, -1, 40);
  assert.deepEqual(plan, [
    { ciclo: -1, mensajes: [{ t: 'maze', kind: 'h', corridor: 500, wall: 50 }] },
    {
      ciclo: 20,
      mensajes: [
        { t: 'shape', dw: 0.2, dh: 0.2 },
        { t: 'setbase', vals: { minVegs: 30 } },
        { t: 'shapes-del10' },
      ],
    },
    { ciclo: 40, mensajes: [] },
  ]);
});

test('plegarObjetos: órdenes de creación, borrados que se pueden llevar y los aproximados', () => {
  const ini = {
    obstaculos: [{ tipo: /** @type {const} */ ('forma'), ancho: 0.2, alto: 0.2 }],
    teleporters: [],
  };
  /** @param {number} ciclo @param {any} o */
  const ev = (ciclo, o) => /** @type {any} */ ({ ciclo, tipo: 'objetos', orden: o });
  // Sin eventos: los de arranque.
  assert.deepEqual(plegarObjetos(ini, []), { objetos: ini, aproximado: false, sueltas: 0 });
  // Crear y borrar teleporters: exacto.
  let r = plegarObjetos(ini, [
    ev(1, { tipo: 'teleporter' }),
    ev(2, { tipo: 'teleporter' }),
    ev(3, { tipo: 'borrar-teleporter', n: 1 }),
    ev(4, { tipo: 'laberinto', forma: 'polar', pasillo: 500, muro: 50 }),
    ev(5, { tipo: 'formas', ancho: 0.1, alto: 0.05 }),
    { ciclo: 5, tipo: 'opciones', cambios: { 'base:minVegs': 3 } },
  ]);
  assert.equal(r.aproximado, false);
  assert.deepEqual(r.objetos, {
    obstaculos: [
      { tipo: 'forma', ancho: 0.2, alto: 0.2 },
      { tipo: 'laberinto', forma: 'polar', pasillo: 500, muro: 50 },
      { tipo: 'formas', ancho: 0.1, alto: 0.05 },
    ],
    teleporters: [{ tipo: 'local' }],
  });
  assert.deepEqual(contarObjetos(r.objetos), {
    forma: 1,
    formas: 1,
    laberintos: 1,
    teleporters: 1,
  });
  // Un borrado suelto: aproximado (se conservan las órdenes).
  r = plegarObjetos(ini, [
    ev(1, { tipo: 'borrar-forma', n: 1 }),
    ev(2, { tipo: 'borrar-formas10' }),
  ]);
  assert.equal(r.aproximado, true);
  assert.equal(r.sueltas, 2);
  assert.deepEqual(r.objetos.obstaculos, ini.obstaculos);
  // Borrar todas las formas después: vuelve a ser exacto.
  r = plegarObjetos(ini, [
    ev(1, { tipo: 'borrar-forma', n: 1 }),
    ev(2, { tipo: 'borrar-formas' }),
    ev(3, { tipo: 'forma', ancho: 0.5, alto: 0.5 }),
  ]);
  assert.equal(r.aproximado, false);
  assert.deepEqual(r.objetos.obstaculos, [{ tipo: 'forma', ancho: 0.5, alto: 0.5 }]);
  // Tope de 10 teleporters y borrar todos.
  const muchos = Array.from({ length: 12 }, (_, i) => ev(i, { tipo: 'teleporter' }));
  assert.equal(plegarObjetos(undefined, muchos).objetos.teleporters.length, 10);
  assert.deepEqual(
    plegarObjetos(undefined, [...muchos, ev(20, { tipo: 'borrar-teleporters' })]).objetos
      .teleporters,
    [],
  );
  // No toca los de arranque.
  assert.deepEqual(ini.obstaculos.length, 1);
  // El resultado es un bloque de objetos válido para un escenario.
  const esc = { ...structuredClone(SOPA), objetos: r.objetos };
  assert.deepEqual(validar(esc), []);
  assert.deepEqual(normalizar(esc).objetos, r.objetos);
});

test('orden(), fraccion() y enteroPositivo(): lo que acepta la barra', () => {
  assert.equal(fraccion('0,25'), 0.25);
  assert.equal(fraccion('1'), 1);
  assert.equal(fraccion(''), null);
  assert.equal(fraccion('0'), null);
  assert.equal(fraccion('1.2'), null);
  assert.equal(enteroPositivo('500'), 500);
  assert.equal(enteroPositivo('2.5'), null);
  assert.equal(enteroPositivo('-3'), null);
  assert.deepEqual(orden('laberinto', { forma: 'checker' }), {
    tipo: 'laberinto',
    forma: 'checker',
    pasillo: 500,
    muro: 50,
  });
  assert.deepEqual(orden('forma', { ancho: 0.3, alto: 0.4 }), {
    tipo: 'forma',
    ancho: 0.3,
    alto: 0.4,
  });
  assert.throws(() => orden('forma', { ancho: null, alto: 0.4 }));
  assert.deepEqual(ordenBorrar({ tipo: 'teleporter', n: 2 }), { tipo: 'borrar-teleporter', n: 2 });
  assert.deepEqual(ordenBorrar({ tipo: 'forma', n: 5 }), { tipo: 'borrar-forma', n: 5 });
});

test('objetoEn: primero los teleporters (ascendente), después las formas (la de encima)', () => {
  // Formas [x, y, w, h, color]: 1 y 2 se superponen en (150, 150).
  const obs = new Float32Array([
    100, 100, 100, 100, 0, 120, 120, 100, 100, 0, 1000, 1000, 10, 10, 0,
  ]);
  // Teleporter [x, y, w, h, color, flags, enviados] sobre la forma 1.
  const tps = new Float32Array([90, 90, 30, 30, 0, 4, 0, 500, 500, 50, 50, 0, 4, 0]);
  assert.deepEqual(objetoEn(obs, 3, 5, tps, 2, 7, 150, 150), { tipo: 'forma', n: 2 });
  assert.deepEqual(objetoEn(obs, 3, 5, tps, 2, 7, 105, 105), { tipo: 'teleporter', n: 1 });
  assert.deepEqual(objetoEn(obs, 3, 5, tps, 2, 7, 510, 510), { tipo: 'teleporter', n: 2 });
  assert.deepEqual(objetoEn(obs, 3, 5, tps, 2, 7, 105, 190), { tipo: 'forma', n: 1 });
  assert.equal(objetoEn(obs, 3, 5, tps, 2, 7, 700, 700), null);
  // Tolerancia: la forma fina se alcanza desde cerca.
  assert.equal(objetoEn(obs, 3, 5, tps, 0, 7, 1013, 1005), null);
  assert.deepEqual(objetoEn(obs, 3, 5, tps, 0, 7, 1013, 1005, 4), { tipo: 'forma', n: 3 });
  // Solo cuentan los n primeros registros (el búfer puede ser más largo).
  assert.equal(objetoEn(obs, 2, 5, tps, 0, 7, 1005, 1005), null);
});

test('siguienteObjeto: recorre teleporters y formas en círculo', () => {
  assert.equal(siguienteObjeto(null, 0, 0, 1), null);
  assert.deepEqual(siguienteObjeto(null, 2, 1, 1), { tipo: 'teleporter', n: 1 });
  assert.deepEqual(siguienteObjeto(null, 2, 1, -1), { tipo: 'forma', n: 2 });
  assert.deepEqual(siguienteObjeto({ tipo: 'teleporter', n: 1 }, 2, 1, 1), { tipo: 'forma', n: 1 });
  assert.deepEqual(siguienteObjeto({ tipo: 'forma', n: 2 }, 2, 1, 1), { tipo: 'teleporter', n: 1 });
  assert.deepEqual(siguienteObjeto({ tipo: 'teleporter', n: 1 }, 2, 1, -1), {
    tipo: 'forma',
    n: 2,
  });
  assert.deepEqual(siguienteObjeto({ tipo: 'forma', n: 1 }, 3, 0, 1), { tipo: 'forma', n: 2 });
});

/** Sesión mínima: aplicarEnCiclo contesta el ciclo que se le diga. */
function sesionFalsa() {
  /** @type {any[]} */
  const enviados = [];
  /** @type {((c: number) => void)[]} */
  const pendientes = [];
  const s = {
    stats: { cycle: 0, bots: 0 },
    corriendo: false,
    hayMundo: false,
    /** @type {string[]} */
    especies: [],
    enviados,
    pendientes,
    c: {
      on: () => () => {},
      /** @param {any} m */
      enviar: (m) => enviados.push(m),
      /** @param {any} sp */
      seedSpecies: (sp) => enviados.push({ t: 'seed-species', sp }),
      dnaLib: () => {},
    },
    /** @param {any} o */
    reset(o) {
      enviados.push({ t: 'reset', ...o });
      s.hayMundo = true;
    },
    /** @param {boolean} on */
    correr(on) {
      s.corriendo = on;
    },
    seleccionar: () => {},
    cargar() {
      s.hayMundo = true;
    },
    guardar: async () => new Uint8Array([1, 2, 3]),
    /** @param {any[]} ms @returns {Promise<number>} */
    aplicarEnCiclo(ms) {
      enviados.push(...ms);
      return new Promise((res) => pendientes.push(res));
    },
    redibujar() {},
  };
  return s;
}

function nucleo() {
  const sesion = sesionFalsa();
  const corridas = crearCorridas({ almacen: almacenMemoria() });
  const n = new NucleoCorrida({
    sesion: /** @type {any} */ (sesion),
    corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async (s) => `' ADN de ${s.bot}\nend\n`,
  });
  return { sesion, corridas, n };
}

test('corrida: aplicarObjetos manda la orden y la registra en el ciclo que confirma el worker', async () => {
  const { sesion, n } = nucleo();
  await n.iniciar(LAB, 99);
  const antes = sesion.enviados.length;
  const p = n.aplicarObjetos({ tipo: 'forma', ancho: 0.25, alto: 0.1 });
  assert.deepEqual(sesion.enviados.slice(antes), [{ t: 'shape', dw: 0.25, dh: 0.1 }]);
  assert.equal(n.estado.eventos.length, 0, 'todavía sin ciclo');
  sesion.pendientes.shift()?.(137);
  await p;
  assert.deepEqual(n.estado.eventos, [
    { ciclo: 137, tipo: 'objetos', orden: { tipo: 'forma', ancho: 0.25, alto: 0.1 } },
  ]);
  assert.deepEqual(n.mensajesEventos(), [
    { ciclo: 137, mensajes: [{ t: 'shape', dw: 0.25, dh: 0.1 }] },
  ]);
  // Inválida: lanza sin mandar nada.
  const k = sesion.enviados.length;
  assert.throws(() => n.aplicarObjetos(/** @type {any} */ ({ tipo: 'forma', ancho: 3, alto: 1 })));
  assert.equal(sesion.enviados.length, k);
  // Otra sim empieza mientras se espera el ciclo: el cambio no es de ella.
  const q = n.aplicarObjetos({ tipo: 'teleporter' });
  await n.iniciar(SOPA, 5);
  sesion.pendientes.shift()?.(300);
  await q;
  assert.deepEqual(n.estado.eventos, []);
});

test('corrida: «Guardar en el escenario» cambia el escenario efectivo, no el de arranque', async () => {
  const { sesion, corridas, n } = nucleo();
  await n.iniciar(LAB, 99);
  const arranque = structuredClone(n.estado.escenario);
  const ref = n.estado.escenario;
  for (const [c, o] of /** @type {[number, any][]} */ ([
    [10, { tipo: 'borrar-formas' }],
    [12, { tipo: 'laberinto', forma: 'spiral', pasillo: 600, muro: 60 }],
    [15, { tipo: 'teleporter' }],
  ])) {
    const p = n.aplicarObjetos(o);
    sesion.pendientes.shift()?.(c);
    await p;
  }
  // Antes de guardar: el efectivo sigue con los objetos de arranque.
  assert.deepEqual(n.escenarioEfectivo()?.objetos, arranque?.objetos);
  const esperado = {
    obstaculos: [{ tipo: 'laberinto', forma: 'spiral', pasillo: 600, muro: 60 }],
    teleporters: [{ tipo: 'local' }],
  };
  assert.deepEqual(n.objetosActuales()?.objetos, esperado);
  const r = n.guardarObjetosEnEscenario();
  assert.equal(r?.aproximado, false);
  assert.deepEqual(n.escenarioEfectivo()?.objetos, esperado);
  // El de arranque (lo que usan las réplicas con los eventos) no cambia de
  // contenido, pero es otra referencia (las vistas que lo siguen se enteran).
  assert.deepEqual(n.estado.escenario, arranque);
  assert.notEqual(n.estado.escenario, ref);
  // Experimentar: sin diferencias de objetos entre un borrador del efectivo y el efectivo.
  const ef = /** @type {any} */ (n.escenarioEfectivo());
  assert.equal(
    diff(ef, ef).nueva.some((x) => x.que === 'objetos'),
    false,
  );
  // Se guarda con la corrida y vuelve al cargarla.
  sesion.stats = { cycle: 20, bots: 0 };
  const { id } = await n.guardar('con objetos');
  const guardada = await corridas.cargar(id);
  assert.deepEqual(/** @type {any} */ (guardada)?.corrida.objetosEscenario, esperado);
  await n.iniciar(SOPA, 1);
  assert.deepEqual(n.escenarioEfectivo()?.objetos, SOPA.objetos, 'una sim nueva no lo arrastra');
  await n.cargar(id);
  assert.deepEqual(n.escenarioEfectivo()?.objetos, esperado);
  assert.equal(n.estado.eventos.length, 3);
});

test('corrida: sin escenario no hay dónde guardar; los eventos igual se registran', async () => {
  const { sesion, n } = nucleo();
  await n.importarDbsim(new Uint8Array([1, 2, 3]), 'suelto.dbsim').catch(() => false);
  assert.equal(n.objetosActuales(), null);
  assert.equal(n.guardarObjetosEnEscenario(), null);
  const p = n.aplicarObjetos({ tipo: 'borrar-formas10' });
  sesion.pendientes.shift()?.(4);
  await p;
  assert.deepEqual(n.estado.eventos, [
    { ciclo: 4, tipo: 'objetos', orden: { tipo: 'borrar-formas10' } },
  ]);
});
