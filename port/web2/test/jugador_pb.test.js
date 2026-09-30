// @ts-check
// Player Bot Mode (paso N4.1, correcciones de la revisión): el foco sigue al
// heredero cuando muere el bot controlado (indicador opcional `seguirFoco`
// de engine/worker.js; sin él, lo mismo que la clásica), el estado de la
// página (jugador.svelte.js: Esc, campos, captura, modificadores), las
// funciones puras nuevas de veterano.js, la conexión (pb con el indicador,
// snapshot/dead tras un fallo) y un efecto real del modo en el motor.
//
// jugador.svelte.js y sesion.svelte.js usan runes: se compilan con
// svelte/compiler (compileModule, cliente) a un .mjs temporal cuyas
// importaciones relativas apuntan a los archivos reales.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileModule } from 'svelte/compiler';
import { H } from '../engine/protocolo.js';
import {
  controlados,
  detalleMemloc,
  mismasTeclas,
  modificadorAjeno,
  preset,
} from '../src/lib/inspector/veterano.js';
import { ConexionSim } from '../src/lib/sim/conexion.js';
import { BOT, decodificarFrame, FLAG, focoVivo, offBot } from '../src/lib/sim/frame.js';
import { ClienteSim, urlBuildWasm, workerEngine, workerWeb } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- Entorno mínimo de navegador para jugador.svelte.js ----------------------

/** @type {Map<string, Set<(e: any) => void>>} */
const oyentesVentana = new Map();
/** hay un <dialog open> (lo que mira el Esc) */
let dialogoAbierto = false;
const g = /** @type {any} */ (globalThis);
g.window = {
  addEventListener: (/** @type {string} */ t, /** @type {any} */ fn) => {
    if (!oyentesVentana.has(t)) oyentesVentana.set(t, new Set());
    oyentesVentana.get(t)?.add(fn);
  },
  removeEventListener: (/** @type {string} */ t, /** @type {any} */ fn) =>
    oyentesVentana.get(t)?.delete(fn),
};
g.document = { querySelector: () => (dialogoAbierto ? {} : null) };
g.requestAnimationFrame = (/** @type {() => void} */ cb) => setImmediate(cb);
/** @type {Map<string, string>} */
const ls = new Map();
g.localStorage = {
  getItem: (/** @type {string} */ k) => ls.get(k) ?? null,
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => ls.set(k, String(v)),
};

/**
 * Compila un módulo con runes y lo importa.
 * @param {string} rel  ruta desde port/web2
 */
async function importarRunas(rel) {
  const p = path.join(RAIZ, rel);
  const r = compileModule(fs.readFileSync(p, 'utf8'), { filename: p, generate: 'client' });
  const codigo = r.js.code.replace(
    /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g,
    (m, pre, q, spec) => {
      if (spec.startsWith('.'))
        return `${pre}${q}${pathToFileURL(path.resolve(path.dirname(p), spec)).href}${q}`;
      if (spec.startsWith('svelte')) return `${pre}${q}${import.meta.resolve(spec)}${q}`;
      return m;
    },
  );
  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'runas-')),
    `${path.basename(rel)}.mjs`,
  );
  fs.writeFileSync(tmp, codigo);
  return import(pathToFileURL(tmp).href);
}

/** Pulsación falsa (lo que lee #alTecla). @param {string} tipo @param {Record<string, any>} o */
function tecla(tipo, o) {
  const e = {
    type: tipo,
    key: '',
    code: '',
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    target: { tagName: 'BODY', closest: () => null },
    prevenido: false,
    preventDefault() {
      e.prevenido = true;
    },
    stopPropagation() {},
    ...o,
  };
  for (const fn of oyentesVentana.get(tipo) ?? []) fn(e);
  return e;
}

/** Sesión falsa (lo que usa jugador.svelte.js). */
function sesionFalsa() {
  /** @type {any[]} */
  const enviados = [];
  const s = {
    hayMundo: true,
    mundo: 1,
    stats: /** @type {Record<string, any>} */ ({}),
    limpiezas: 0,
    quitarFamilia() {
      s.limpiezas++;
    },
    c: {
      enviar: (/** @type {any} */ m) => enviados.push(m),
      pb: (/** @type {boolean} */ on, /** @type {boolean} */ seguir) =>
        enviados.push(seguir ? { t: 'pb', on, seguirFoco: true } : { t: 'pb', on }),
      pbMouse: (/** @type {number} */ x, /** @type {number} */ y) =>
        enviados.push({ t: 'pb-mouse', x, y }),
    },
  };
  return { s, enviados };
}

// ---- Funciones puras ------------------------------------------------------------

test('detalleMemloc: número junto al sysvar y aclaración de los laterales', () => {
  assert.deepEqual(detalleMemloc('.up'), { numero: '1', lateral: null });
  assert.deepEqual(detalleMemloc('.sx'), { numero: '3', lateral: 'derecha' });
  assert.deepEqual(detalleMemloc('.dx'), { numero: '4', lateral: 'izquierda' });
  assert.deepEqual(detalleMemloc('3'), { numero: '', lateral: 'derecha' });
  assert.deepEqual(detalleMemloc('50'), { numero: '', lateral: null });
  assert.deepEqual(detalleMemloc('.nada'), { numero: '', lateral: null });
  // Las filas del preset: → escribe en 3 (.sx) y ← en 4 (.dx).
  const f = preset('flechas');
  assert.equal(f.find((k) => k.codigo === 'ArrowRight')?.memloc, 3);
  assert.equal(f.find((k) => k.codigo === 'ArrowLeft')?.memloc, 4);
});

test('mismasTeclas y modificadorAjeno', () => {
  const a = preset('flechas');
  assert.ok(mismasTeclas(a, preset('flechas')));
  assert.ok(!mismasTeclas(a, preset('wasd')));
  assert.ok(!mismasTeclas(a, [...a, { codigo: 'KeyQ', memloc: 7, valor: 1, invertir: false }]));
  assert.ok(
    !mismasTeclas(
      a,
      a.map((k, i) => (i ? k : { ...k, invertir: true })),
    ),
  );
  // Sin Ctrl/Alt asignados, Ctrl+S y Alt+… son del navegador.
  assert.equal(modificadorAjeno(a, { ctrlKey: true }), true);
  assert.equal(modificadorAjeno(a, { altKey: true }), true);
  assert.equal(modificadorAjeno(a, { metaKey: true }), true);
  assert.equal(modificadorAjeno(a, {}), false);
  const conCtrl = [...a, { codigo: 'ControlRight', memloc: 7, valor: -1, invertir: false }];
  assert.equal(modificadorAjeno(conCtrl, { ctrlKey: true }), false);
  assert.equal(modificadorAjeno(conCtrl, { ctrlKey: true, altKey: true }), true);
  const conAlt = [...a, { codigo: 'AltLeft', memloc: 7, valor: -1, invertir: false }];
  assert.equal(modificadorAjeno(conAlt, { altKey: true }), false);
});

// ---- Conexión ---------------------------------------------------------------------

function conexionFalsa() {
  /** @type {any[]} */
  const enviados = [];
  /** @type {any} */
  const w = {
    onmessage: null,
    onerror: null,
    postMessage: (/** @type {any} */ m) => enviados.push(m),
  };
  const c = new ConexionSim({
    worker: w,
    base: 'http://x/',
    v: '',
    programar: () => {},
    ahora: () => 0,
    reloj: { poner: () => 0, quitar: () => {} },
  });
  return {
    c,
    enviados,
    llega: (/** @type {any} */ d) => w.onmessage({ data: d }),
    falla: (/** @type {string} */ msg) => w.onerror({ message: msg }),
  };
}

test('conexión: pb con seguirFoco solo si se pide y al encender', () => {
  const { c, enviados } = conexionFalsa();
  enviados.length = 0;
  c.pb(true, true);
  c.pb(false, true);
  c.pb(true);
  assert.deepEqual(enviados, [
    { t: 'pb', on: true, seguirFoco: true },
    { t: 'pb', on: false },
    { t: 'pb', on: true },
  ]);
});

test('conexión: tras un fallo del worker, snapshot y dead-take no dejan lápida en su cola', async () => {
  const { c, llega, falla } = conexionFalsa();
  llega({ t: 'ready' });
  const a = c.snapshot(true);
  const b = c.deadTake();
  falla('boom');
  await assert.rejects(a, { clave: 'worker' });
  await assert.rejects(b, { clave: 'worker' });
  // Los pedidos nuevos reciben SU respuesta (sin lápida que se la coma).
  const a2 = c.snapshot(false);
  const b2 = c.deadTake();
  llega({ t: 'snapshot-done', records: 4, snp: 'S', mut: '' });
  llega({ t: 'dead-data', records: 1, snp: 'D', mut: 'M' });
  assert.deepEqual(await a2, { records: 4, snp: 'S', mut: '' });
  assert.deepEqual(await b2, { records: 1, snp: 'D', mut: 'M' });
});

// ---- jugador.svelte.js --------------------------------------------------------------

test('jugador: encender con seguirFoco, teclas, campos, captura, modificadores, Esc y limpieza', async () => {
  const { jugador } = await importarRunas('src/lib/inspector/jugador.svelte.js');
  const { s, enviados } = sesionFalsa();
  jugador.ponerTeclas(preset('flechas'));
  assert.equal(jugador.activar(s), true);
  assert.deepEqual(enviados[0], { t: 'pb', on: true, seguirFoco: true });
  assert.equal(enviados[1].t, 'pb-keys');
  assert.deepEqual(enviados[2], { t: 'pb-mouse', x: 0, y: 0 });
  enviados.length = 0;

  // Tecla del modo: un pb-key por cambio (sin repetir), con preventDefault.
  const e1 = tecla('keydown', { code: 'ArrowUp', key: 'ArrowUp' });
  assert.ok(e1.prevenido);
  tecla('keydown', { code: 'ArrowUp', key: 'ArrowUp' });
  tecla('keyup', { code: 'ArrowUp', key: 'ArrowUp' });
  assert.deepEqual(enviados, [
    { t: 'pb-key', idx: 0, active: true },
    { t: 'pb-key', idx: 0, active: false },
  ]);
  enviados.length = 0;

  // Escribiendo en un campo: bajar no cuenta; soltar, siempre (y no repite).
  const campo = { tagName: 'INPUT', closest: () => null };
  const e2 = tecla('keydown', { code: 'ArrowDown', target: campo });
  assert.ok(!e2.prevenido);
  assert.deepEqual(enviados, []);
  // Eligiendo la tecla de una fila: es para la fila.
  const boton = { tagName: 'BUTTON', closest: (/** @type {string} */ q) => (q ? {} : null) };
  tecla('keydown', { code: 'ArrowDown', target: boton });
  assert.deepEqual(enviados, []);

  // Ctrl+S sin Ctrl asignado: del navegador.
  const e3 = tecla('keydown', { code: 'KeyS', key: 's', ctrlKey: true });
  assert.ok(!e3.prevenido);
  // Con Ctrl asignado: la tecla funciona, y otra del modo con Ctrl apretado también.
  jugador.ponerTeclas([
    ...preset('flechas'),
    { codigo: 'ControlLeft', memloc: 7, valor: -1, invertir: false },
  ]);
  assert.equal(enviados.pop()?.t, 'pb-keys');
  enviados.length = 0;
  tecla('keydown', { code: 'ControlLeft', key: 'Control', ctrlKey: true });
  tecla('keydown', { code: 'ArrowRight', key: 'ArrowRight', ctrlKey: true });
  assert.deepEqual(enviados, [
    { t: 'pb-key', idx: 5, active: true },
    { t: 'pb-key', idx: 2, active: true },
  ]);
  enviados.length = 0;

  // Las mismas teclas (la pestaña Control al montarse): no se reenvían, y
  // las apretadas siguen apretadas.
  jugador.ponerTeclas(jugador.teclas.map((/** @type {any} */ k) => ({ ...k })));
  assert.deepEqual(enviados, []);

  // Esc con un diálogo abierto: cierra el diálogo, no el modo.
  dialogoAbierto = true;
  tecla('keydown', { key: 'Escape', code: 'Escape' });
  assert.equal(jugador.activo, true);
  dialogoAbierto = false;
  // Esc: suelta lo apretado, apaga el modo y borra los resaltados.
  tecla('keydown', { key: 'Escape', code: 'Escape' });
  assert.equal(jugador.activo, false);
  assert.deepEqual(enviados, [
    { t: 'pb-key', idx: 5, active: false },
    { t: 'pb-key', idx: 2, active: false },
    { t: 'pb-mouse', x: 0, y: 0 },
    { t: 'pb', on: false },
  ]);
  assert.equal(s.limpiezas, 1);
  // Apagado, las teclas ya no se escuchan.
  enviados.length = 0;
  tecla('keydown', { code: 'ArrowUp' });
  assert.deepEqual(enviados, []);

  // Con la sim cambiada se apaga sin borrar resaltados (la sim nueva no tiene).
  jugador.activar(s);
  s.mundo++;
  jugador.vigilar(s);
  assert.equal(jugador.activo, false);
  assert.equal(s.limpiezas, 1);
  // Sin mundo o con un contest F1 no se enciende.
  s.stats = { f1: 1 };
  assert.equal(jugador.activar(s), false);
});

// ---- Contra engine/worker.js real ----------------------------------------------------------

// El bot con la marca en la memoria 50 se reproduce con el 99 % de su
// energía y muere al ciclo siguiente; su hijo nace sin la marca (la memoria
// 50 no se hereda) y vive. Sin cadáveres (opción 50): el muerto se va.
const MADRE = 'cond *50 1 = start 99 .repro store stop';
const OPCIONES = {
  fieldW: 8000,
  fieldH: 6000,
  minVegs: 0,
  repopAmount: 0,
  repopCooldown: 50,
  maxEnergy: 40,
  startChlr: 0,
  mutations: false,
  opts: { 50: 0, 13: 0 },
};
const RESET = {
  t: 'reset',
  seed: 5,
  options: OPCIONES,
  species: [{ dna: MADRE, name: 'Madre.txt', veg: false, qty: 3, nrg: 30, color: 0xff00 }],
};

/** Slots resaltados de un frame decodificado. @param {import('../src/lib/sim/frame.js').Frame} f */
function resaltados(f) {
  const out = [];
  for (let i = 0; i < f.nBots; i++) {
    const o = offBot(f, i);
    if ((f.v[o + BOT.flags] | 0) & FLAG.highlight) out.push(f.v[o + BOT.idx]);
  }
  return out;
}

/** Espera a que `cond()` valga (sondeo). @param {() => boolean} cond @param {string} que */
async function esperar(cond, que, ms = 20000) {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error(`timeout: ${que}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

test('muere el bot controlado con hijos: la sesión sigue al hijo (seguirFoco)', {
  skip: hayWasm() ? false : SIN_WASM,
  timeout: 120000,
}, async () => {
  const { Sesion } = await importarRunas('src/lib/sim/sesion.svelte.js');
  const { jugador } = await importarRunas('src/lib/inspector/jugador.svelte.js');
  const nw = workerEngine({ init: false });
  /** @type {any} */
  const w = {
    onmessage: null,
    onerror: null,
    postMessage: (/** @type {any} */ m, /** @type {any} */ tr) => nw.postMessage(m, tr),
    terminate: () => void nw.terminate(),
  };
  nw.on('message', (data) => w.onmessage?.({ data }));
  nw.on('error', (e) => w.onerror?.(e));
  const c = new ConexionSim({
    worker: w,
    base: urlBuildWasm(),
    v: '',
    programar: (cb) => setImmediate(cb),
    ahora: () => 0,
  });
  const s = new Sesion(c);
  /** @type {import('../src/lib/sim/frame.js').Frame | null} */
  let ultimo = null;
  /** @type {number[]} */
  let hl = [];
  c.on('frame', (/** @type {any} */ ev) => {
    ultimo = ev.frame;
    hl = resaltados(ev.frame);
  });
  /** @type {any[]} */
  const avisos = [];
  c.on('pb-focus', (m) => avisos.push(m));
  try {
    await esperar(() => s.listo, 'ready');
    const { t: _t, ...o } = RESET;
    s.reset(o);
    s.unCiclo();
    await c.ciclo();
    const madre = await s.buscarMejor();
    assert.ok(madre > 0, `findbest: ${madre}`);
    assert.equal(s.foco, madre);
    c.setmem(madre, 50, 1);
    assert.equal(jugador.activar(s), true);
    // Ciclo 1: nace el hijo, resaltado (hereda el control).
    s.unCiclo();
    await c.ciclo();
    await esperar(() => hl.length === 1, 'hijo resaltado');
    const hijo = hl[0];
    assert.notEqual(hijo, madre);
    assert.equal(s.foco, madre);
    // Ciclo 2: muere la madre; el motor pasa el foco al hijo y la sesión lo sigue.
    s.unCiclo();
    await c.ciclo();
    await esperar(() => s.foco !== madre, 'foco heredado');
    assert.equal(s.foco, hijo);
    assert.deepEqual(avisos, [{ t: 'pb-focus', n: hijo, prev: madre }]);
    await esperar(() => s.focoVivo?.n === hijo, 'frame con el foco del hijo');
    const f = /** @type {any} */ (ultimo);
    assert.equal(f.foco, hijo);
    assert.equal(controlados(f).foco, hijo);
    // Al salir del modo se borran los resaltados.
    jugador.desactivar();
    s.unCiclo();
    await c.ciclo();
    await esperar(() => hl.length === 0, 'resaltados borrados');
    assert.equal(s.foco, hijo, 'el foco queda en el hijo');
  } finally {
    jugador.desactivar();
    c.terminar();
  }
});

test('sin seguirFoco: el foco se suelta al morir el bot, igual que en la clásica', {
  skip: hayWasm() ? false : SIN_WASM,
  timeout: 120000,
}, async () => {
  // web/worker.js resuelve '../build-wasm/' contra el cwd.
  process.chdir(WEB);
  const det = { fechaFija: Date.UTC(2026, 0, 15, 13, 2, 3), semillaAzar: 777 };
  const web = new ClienteSim(workerWeb(det));
  const eng = new ClienteSim(workerEngine(det));
  const conSeguir = new ClienteSim(workerEngine(det));
  const todos = [web, eng, conSeguir];
  // Contar frames no es determinista: con un frame en vuelo (sin 'ack'),
  // setmem/step no publican y el siguiente sale al volver el 'ack', ya con
  // el estado de ese momento (findbest, setmem y step pueden juntarse en uno
  // según los tiempos de cada worker). Se espera a que el worker quede
  // quieto: getopt es de solo lectura y se atiende en orden; tras la
  // primera barrera, el 'ack' del último frame recibido ya salió y el frame
  // que haya dejado pendiente llega antes de la segunda. Después de las dos,
  // c.frame es el estado actual.
  /** @param {ClienteSim} c */
  const quieto = async (c) => {
    await c.sync();
    await c.sync();
    return /** @type {Float32Array} */ (c.frame).slice();
  };
  /** @param {ClienteSim} c */
  const paso = (c) => {
    c.send({ t: 'step' });
    return quieto(c);
  };
  try {
    await Promise.all(todos.map((c) => c.wait((m) => m.t === 'ready', 110000)));
    const madres = await Promise.all(
      todos.map(async (c) => {
        c.send(RESET);
        await paso(c);
        const m = c.wait((x) => x.t === 'focus');
        c.send({ t: 'findbest' });
        return (await m).n;
      }),
    );
    assert.ok(madres[0] > 0);
    assert.deepEqual(madres, [madres[0], madres[0], madres[0]]);
    const madre = madres[0];
    /** @type {Float32Array[][]} */
    const frames = [[], [], []];
    // Ciclo 0 con la marca y el modo puestos (redraw: frame fresco sin tick).
    const f0 = await Promise.all(
      todos.map((c) => {
        c.send({ t: 'setmem', n: madre, addr: 50, v: 1 });
        c.send(c === conSeguir ? { t: 'pb', on: true, seguirFoco: true } : { t: 'pb', on: true });
        c.send({ t: 'redraw' });
        return quieto(c);
      }),
    );
    f0.forEach((f, j) => {
      frames[j].push(f);
    });
    for (let i = 1; i < 3; i++) {
      const fs3 = await Promise.all(todos.map(paso));
      fs3.forEach((f, j) => {
        frames[j].push(f);
      });
    }
    // Ciclo 0: la madre marcada; en el ciclo 1 nace el hijo y en el 2 muere
    // la madre.
    for (const fr of frames)
      assert.deepEqual(
        fr.map((f) => f[H.cycle]),
        [0, 1, 2],
      );
    // Sin el indicador: frames idénticos a los de la clásica, y el foco se
    // apaga en el frame de la muerte.
    for (let i = 0; i < 3; i++)
      assert.ok(
        Buffer.from(frames[0][i].buffer).equals(Buffer.from(frames[1][i].buffer)),
        `frame ${i}: engine sin seguirFoco = clásica`,
      );
    assert.equal(frames[1][1][H.focus], madre);
    assert.equal(frames[1][2][H.focus], 0);
    assert.equal(
      eng.msgs.some((m) => m.t === 'pb-focus'),
      false,
    );
    // Con el indicador, el mismo mundo: el foco pasa al hijo resaltado.
    const hijo = resaltados(decodificarFrame(frames[2][1]))[0];
    assert.ok(hijo > 0 && hijo !== madre);
    assert.equal(frames[2][2][H.focus], hijo);
    assert.ok(conSeguir.msgs.some((m) => m.t === 'pb-focus' && m.n === hijo && m.prev === madre));
  } finally {
    await Promise.all(todos.map((c) => c.stop()));
  }
});

test('efecto real del Player Bot: con .up apretada el bot controlado avanza y los demás no', {
  skip: hayWasm() ? false : SIN_WASM,
  timeout: 120000,
}, async () => {
  const c = new ClienteSim(workerEngine());
  /** @param {number} n */
  const pasos = async (n) => {
    for (let i = 0; i < n; i++) {
      const f = c.wait((m) => m.t === 'frame');
      c.send({ t: 'step' });
      await f;
    }
    return decodificarFrame(/** @type {Float32Array} */ (c.frame).slice());
  };
  /** @param {import('../src/lib/sim/frame.js').Frame} f @param {number} slot */
  const pos = (f, slot) => {
    for (let i = 0; i < f.nBots; i++) {
      const o = offBot(f, i);
      if (f.v[o + BOT.idx] === slot) return [f.v[o + BOT.x], f.v[o + BOT.y]];
    }
    throw new Error(`sin bot ${slot}`);
  };
  /** @param {number[]} a @param {number[]} b */
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  try {
    await c.wait((m) => m.t === 'ready');
    c.send({
      ...RESET,
      species: [
        { dna: 'cond start stop', name: 'Quieto.txt', veg: false, qty: 3, nrg: 30, color: 0xff00 },
      ],
    });
    const f0 = await pasos(1);
    const quieto = f0.v[offBot(f0, 0) + BOT.idx];
    const otro = f0.v[offBot(f0, 1) + BOT.idx];
    c.send({ t: 'select', n: quieto, seq: 1 });
    const f1 = await pasos(5);
    // Sin el modo nadie se mueve (sin browniano, ADN vacío).
    assert.ok(dist(pos(f0, quieto), pos(f1, quieto)) < 1e-3);
    c.send({ t: 'pb', on: true, seguirFoco: true });
    c.send({ t: 'pb-keys', keys: [{ memloc: 1, value: 40, invert: false }] });
    c.send({ t: 'pb-key', idx: 0, active: true });
    const f2 = await pasos(5);
    const avance = dist(pos(f1, quieto), pos(f2, quieto));
    assert.ok(avance > 1, `el controlado avanza con .up (avanzó ${avance})`);
    assert.ok(dist(pos(f1, otro), pos(f2, otro)) < 1e-3, 'el que no se controla no se mueve');
    assert.ok(focoVivo(f2), 'el foco sigue en el controlado');
    // Soltar la tecla: deja de empujar (la velocidad decae sin más impulso).
    c.send({ t: 'pb-key', idx: 0, active: false });
    c.send({ t: 'pb', on: false });
    await pasos(1);
    assert.equal(c.error, null);
  } finally {
    await c.stop();
  }
});
