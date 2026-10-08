// @ts-check
// Conexión con el worker (src/lib/sim/conexion.js) contra un worker simulado.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { H, HEADER, REG } from '../engine/protocolo.js';
import { ConexionSim, ErrorConexion, TIEMPOS } from '../src/lib/sim/conexion.js';
import { urlBuildWasm, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM } from './util/dbcore-node.js';

/** @typedef {import('../src/lib/sim/conexion.js').WorkerLike} WorkerLike */

class WorkerFalso {
  /** @type {{ msg: any, transfer?: Transferable[] }[]} */
  enviados = [];
  /** @type {((e: { data: any }) => void) | null} */
  onmessage = null;
  /** @type {((e: any) => void) | null} */
  onerror = null;
  /** @param {any} msg @param {Transferable[]} [transfer] */
  postMessage(msg, transfer) {
    this.enviados.push({ msg, transfer });
  }
  /** @param {any} data */
  llega(data) {
    this.onmessage?.({ data });
  }
  /** @param {string} t */
  de(t) {
    return this.enviados.filter((e) => e.msg.t === t);
  }
}

/** Reloj falso: `avanzar(ms)` dispara los temporizadores vencidos. */
class RelojFalso {
  ahora = 0;
  sig = 0;
  /** @type {Map<number, { fn: () => void, en: number }>} */
  timers = new Map();
  /** @param {() => void} fn @param {number} ms */
  poner(fn, ms) {
    const h = ++this.sig;
    this.timers.set(h, { fn, en: this.ahora + ms });
    return h;
  }
  /** @param {number} h */
  quitar(h) {
    this.timers.delete(h);
  }
  /** @param {number} ms */
  avanzar(ms) {
    this.ahora += ms;
    for (const [h, t] of [...this.timers]) {
      if (t.en <= this.ahora) {
        this.timers.delete(h);
        t.fn();
      }
    }
  }
}

function armar() {
  const w = new WorkerFalso();
  const reloj = new RelojFalso();
  /** @type {(() => void)[]} */
  const agenda = [];
  const c = new ConexionSim({
    worker: w,
    base: 'http://x/build-wasm/',
    v: 'abc',
    programar: (cb) => agenda.push(cb),
    ahora: () => 0,
    reloj: {
      poner: (fn, ms) => reloj.poner(fn, ms),
      quitar: (h) => reloj.quitar(h),
    },
  });
  const correrAgenda = () => {
    while (agenda.length) /** @type {() => void} */ (agenda.shift())();
  };
  return { w, c, agenda, correrAgenda, reloj };
}

/**
 * Estado de una promesa sin esperarla: 'pendiente' | {ok: valor} | {error}.
 * @param {Promise<any>} p
 */
async function estado(p) {
  const marca = Symbol('pendiente');
  try {
    const v = await Promise.race([p, Promise.resolve().then(() => marca)]);
    return v === marca ? 'pendiente' : { ok: v };
  } catch (e) {
    return { error: /** @type {any} */ (e).clave ?? String(e) };
  }
}

/** Worker simulado que contesta en orden y SIN id (protocolo sin correlación). */
function contestarSinId(/** @type {WorkerFalso} */ w, /** @type {number} */ desde, sim = true) {
  const out = [];
  for (const { msg } of w.enviados.slice(desde)) {
    if (msg.t === 'save' && sim) out.push({ t: 'saved', bytes: new Uint8Array([7]).buffer });
    if (msg.t === 'bot-text')
      out.push({ t: 'bot-text', n: msg.n, text: msg.n ? `adn${msg.n}` : '' });
    if (msg.t === 'getopt' && sim) out.push({ t: 'opt', id: msg.id, v: msg.id * 10 });
  }
  return out;
}

/** Frame mínimo: 1 bot (índice 5) y foco en él. */
function frame() {
  const v = new Float32Array(HEADER + REG.bot + REG.focus + 16);
  v[H.fieldW] = 1000;
  v[H.fieldH] = 800;
  v[H.nBots] = 1;
  v[H.focus] = 5;
  v[H.cycle] = 77;
  v[HEADER] = 5;
  v[HEADER + REG.bot] = 10; // x del foco
  return v.buffer;
}

test('el primer mensaje es el init con la base y la versión', () => {
  const { w } = armar();
  assert.deepEqual(w.enviados[0].msg, { t: 'init', base: 'http://x/build-wasm/', v: 'abc' });
});

test('frame: se dibuja en el cuadro siguiente y el búfer vuelve con ack', () => {
  const { w, c, agenda, correrAgenda } = armar();
  /** @type {number[]} */
  const dibujados = [];
  c.ponerDibujante((f) => dibujados.push(f.ciclo));
  /** @type {any[]} */
  const eventos = [];
  c.on('frame', (ev) =>
    eventos.push({ ciclo: ev.frame.ciclo, seq: ev.seqVigente, x: ev.frame.v[HEADER + REG.bot] }),
  );
  const buf = frame();
  w.llega({ t: 'frame', buf, stats: { cycle: 77, bots: 1, vegs: 0, tps: 0, selSeq: 0 } });
  assert.equal(agenda.length, 1);
  assert.equal(w.de('ack').length, 0, 'sin ack antes de dibujar');
  correrAgenda();
  assert.deepEqual(dibujados, [77]);
  assert.deepEqual(eventos, [{ ciclo: 77, seq: true, x: 10 }]);
  const acks = w.de('ack');
  assert.equal(acks.length, 1);
  assert.equal(acks[0].msg.buf, buf);
  assert.deepEqual(acks[0].transfer, [buf]);
});

test('sin dibujante el búfer vuelve igual (la sim sigue)', () => {
  const { w, correrAgenda } = armar();
  w.llega({ t: 'frame', buf: frame(), stats: { cycle: 1, bots: 1, vegs: 0, tps: 0 } });
  correrAgenda();
  assert.equal(w.de('ack').length, 1);
});

test('un dibujante que falla no se queda con el búfer', () => {
  const { w, c, correrAgenda } = armar();
  c.ponerDibujante(() => {
    throw new Error('x');
  });
  w.llega({ t: 'frame', buf: frame(), stats: { cycle: 1, bots: 1, vegs: 0, tps: 0 } });
  assert.throws(correrAgenda, /x/);
  assert.equal(w.de('ack').length, 1);
});

test('select lleva número de secuencia y el frame viejo no es vigente', () => {
  const { w, c, correrAgenda } = armar();
  c.select(5);
  c.select(0);
  assert.deepEqual(
    w.de('select').map((e) => e.msg),
    [
      { t: 'select', n: 5, seq: 1 },
      { t: 'select', n: 0, seq: 2 },
    ],
  );
  /** @type {boolean[]} */
  const vig = [];
  c.on('frame', (ev) => vig.push(ev.seqVigente));
  w.llega({ t: 'frame', buf: frame(), stats: { cycle: 1, bots: 1, vegs: 0, tps: 0, selSeq: 1 } });
  correrAgenda();
  w.llega({ t: 'frame', buf: frame(), stats: { cycle: 2, bots: 1, vegs: 0, tps: 0, selSeq: 2 } });
  correrAgenda();
  assert.deepEqual(vig, [false, true]);
});

test('save → Promise<Uint8Array> y bot-text → Promise<string> (sin id: en orden)', async () => {
  const { w, c } = armar();
  const p = c.save();
  const q = c.botText(9);
  const r = c.botText(4);
  assert.equal(w.de('save').length, 1);
  assert.equal(typeof w.de('save')[0].msg.id, 'number', 'el save lleva id de correlación');
  // tras el save va la valla (bot-text 0)
  assert.deepEqual(
    w.de('bot-text').map((e) => e.msg.n),
    [0, 9, 4],
  );
  w.llega({ t: 'bot-text', n: 4, text: 'cuatro' });
  w.llega({ t: 'saved', bytes: new Uint8Array([1, 2, 3]).buffer, cycle: 10 });
  w.llega({ t: 'bot-text', n: 0, text: '' });
  w.llega({ t: 'bot-text', n: 9, text: '' });
  const bytes = await p;
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual([...bytes], [1, 2, 3]);
  assert.equal(await q, '');
  assert.equal(await r, 'cuatro');
});

test('la valla no se avisa a los oyentes de bot-text', () => {
  const { w, c } = armar();
  /** @type {number[]} */
  const vistos = [];
  c.on('bot-text', (m) => vistos.push(m.n));
  c.save();
  c.botText(3);
  for (const m of contestarSinId(w, 1)) w.llega(m);
  assert.deepEqual(vistos, [3]);
});

test('con id: una respuesta tardía (vencida) no resuelve el pedido siguiente', async () => {
  const { w, c, reloj } = armar();
  const p1 = c.botText(5);
  reloj.avanzar(TIEMPOS.botText);
  assert.deepEqual(await estado(p1), { error: 'tiempo' });
  const p2 = c.botText(5);
  const [e1, e2] = w.de('bot-text').map((e) => e.msg);
  assert.notEqual(e1.id, e2.id);
  w.llega({ t: 'bot-text', n: 5, text: 'viejo', id: e1.id }); // tardía: se descarta
  assert.equal(await estado(p2), 'pendiente');
  w.llega({ t: 'bot-text', n: 5, text: 'nuevo', id: e2.id });
  assert.deepEqual(await estado(p2), { ok: 'nuevo' });
});

test('sin id: la respuesta tardía la consume la lápida, no el pedido siguiente', async () => {
  const { w, c, reloj } = armar();
  const p1 = c.botText(5);
  reloj.avanzar(TIEMPOS.botText + 1);
  assert.deepEqual(await estado(p1), { error: 'tiempo' });
  const p2 = c.botText(5);
  w.llega({ t: 'bot-text', n: 5, text: 'viejo' });
  assert.equal(await estado(p2), 'pendiente');
  w.llega({ t: 'bot-text', n: 5, text: 'nuevo' });
  assert.deepEqual(await estado(p2), { ok: 'nuevo' });
});

test('save sin respuesta (sim vacía, worker sin id): la valla lo rechaza y resincroniza', async () => {
  const { w, c } = armar();
  const p1 = c.save();
  const n = w.enviados.length;
  // el worker viejo no contesta un save vacío: solo llega la valla
  for (const m of contestarSinId(w, 1, false)) w.llega(m);
  assert.deepEqual(await estado(p1), { error: 'sin-respuesta' });
  const p2 = c.save();
  for (const m of contestarSinId(w, n)) w.llega(m);
  assert.ok((await estado(p2)).ok instanceof Uint8Array);
});

test('save vencido: su respuesta tardía no resuelve el save siguiente (sin id)', async () => {
  const { w, c, reloj } = armar();
  const p1 = c.save();
  reloj.avanzar(TIEMPOS.save);
  assert.deepEqual(await estado(p1), { error: 'tiempo' });
  const p2 = c.save();
  // llegan, tarde y en orden: saved(1), valla(1), saved(2), valla(2)
  w.llega({ t: 'saved', bytes: new Uint8Array([1]).buffer });
  w.llega({ t: 'bot-text', n: 0, text: '' });
  assert.equal(await estado(p2), 'pendiente');
  w.llega({ t: 'saved', bytes: new Uint8Array([2]).buffer });
  w.llega({ t: 'bot-text', n: 0, text: '' });
  const r = await estado(p2);
  assert.deepEqual([...r.ok], [2]);
});

test('save-error con id rechaza ese save', async () => {
  const { w, c } = armar();
  const p = c.save();
  const { id } = w.de('save')[0].msg;
  w.llega({ t: 'save-error', id, clave: 'save-empty' });
  assert.deepEqual(await estado(p), { error: 'save-empty' });
});

test('getopt y getopts: en orden por opción, con una sola valla', async () => {
  const { w, c } = armar();
  const todas = c.getopts([21, 3, 99]);
  assert.deepEqual(
    w.de('getopt').map((e) => e.msg),
    [
      { t: 'getopt', id: 21 },
      { t: 'getopt', id: 3 },
      { t: 'getopt', id: 99 },
    ],
  );
  assert.equal(w.de('bot-text').length, 1);
  w.llega({ t: 'opt', id: 3, v: 30 });
  w.llega({ t: 'opt', id: 21, v: 1 });
  // la 99 no contesta (id desconocido): la valla la da por perdida
  w.llega({ t: 'bot-text', n: 0, text: '' });
  assert.deepEqual(await todas, { 21: 1, 3: 30 });
  const una = c.getopt(21);
  w.llega({ t: 'opt', id: 21, v: 0 });
  assert.equal(await una, 0);
});

test('error del worker en ejecución: rechaza lo pendiente y avisa sin matar la conexión', async () => {
  const { w, c } = armar();
  w.llega({ t: 'ready' });
  /** @type {any[]} */
  const avisos = [];
  c.on('worker-error', (m) => avisos.push(m.msg));
  c.on('error', (m) => avisos.push(`carga:${m.msg}`));
  const p = c.botText(2);
  w.onerror?.({ message: 'boom' });
  assert.deepEqual(await estado(p), { error: 'worker' });
  assert.deepEqual(avisos, ['boom']);
  // la respuesta tardía del rechazado no se cruza con el siguiente
  const q = c.botText(2);
  w.llega({ t: 'bot-text', n: 2, text: 'viejo' });
  w.llega({ t: 'bot-text', n: 2, text: 'nuevo' });
  assert.deepEqual(await estado(q), { ok: 'nuevo' });
});

test('fallo de carga (mensaje error o onerror antes del ready): rechaza todo y lo nuevo', async () => {
  for (const modo of ['mensaje', 'onerror']) {
    const { w, c } = armar();
    /** @type {any[]} */
    const errores = [];
    c.on('error', (m) => errores.push(m.clave));
    const p = c.save();
    const q = c.botText(1);
    if (modo === 'mensaje') w.llega({ t: 'error', clave: 'init-base', params: {}, msg: 'x' });
    else w.onerror?.({ message: 'no script' });
    assert.deepEqual(await estado(p), { error: 'carga' }, modo);
    assert.deepEqual(await estado(q), { error: 'carga' }, modo);
    assert.deepEqual(await estado(c.botText(1)), { error: 'carga' }, modo);
    assert.deepEqual(errores, [modo === 'mensaje' ? 'init-base' : 'carga']);
  }
});

test('terminar rechaza lo pendiente', async () => {
  const { c } = armar();
  const p = c.save();
  c.terminar();
  const r = await estado(p);
  assert.deepEqual(r, { error: 'terminada' });
  await assert.rejects(c.botText(1), ErrorConexion);
});

test('load copia y transfiere los bytes', () => {
  const { w, c } = armar();
  const orig = new Uint8Array([9, 8, 7]);
  c.load(orig);
  const [e] = w.de('load');
  assert.notEqual(e.msg.bytes, orig.buffer);
  assert.deepEqual([...new Uint8Array(e.msg.bytes)], [9, 8, 7]);
  assert.deepEqual(e.transfer, [e.msg.bytes]);
});

test('redraw: uno solo en vuelo hasta que llega un frame', () => {
  const { w, c, correrAgenda } = armar();
  c.redraw();
  c.redraw();
  assert.equal(w.de('redraw').length, 1);
  w.llega({ t: 'frame', buf: frame(), stats: { cycle: 1, bots: 1, vegs: 0, tps: 0 } });
  correrAgenda();
  c.redraw();
  assert.equal(w.de('redraw').length, 2);
});

test('suscripciones: por tipo, comodín y baja', () => {
  const { w, c } = armar();
  /** @type {string[]} */
  const vistos = [];
  const baja = c.on('species', (m) => vistos.push(`sp:${m.names.join(',')}`));
  c.on('*', (m) => vistos.push(`*:${m.t}`));
  w.llega({ t: 'species', names: ['A', 'B'] });
  baja();
  w.llega({ t: 'species', names: ['C'] });
  w.llega({ t: 'stopped' });
  assert.deepEqual(vistos, ['sp:A,B', '*:species', '*:species', '*:stopped']);
});

test('métodos del protocolo: forma de los mensajes', () => {
  const { w, c } = armar();
  c.reset({ seed: 1234, options: { fieldW: 1 }, species: [] });
  c.run(true);
  c.speed(0);
  c.step();
  c.setopt(21, 1);
  c.setcost(23, 2, true);
  c.view(true);
  c.gendist(7);
  c.family(7, 3);
  c.skins(false);
  c.activ(true);
  c.eyeRead(7);
  const tipos = w.enviados.slice(1).map((e) => e.msg);
  assert.deepEqual(tipos, [
    { t: 'reset', seed: 1234, options: { fieldW: 1 }, species: [], quietF1: false },
    { t: 'run', running: true },
    { t: 'speed', n: 0 },
    { t: 'step' },
    { t: 'setopt', id: 21, v: 1 },
    { t: 'setcost', i: 23, v: 2, nocap: true },
    { t: 'view', rich: true },
    { t: 'gendist', n: 7 },
    { t: 'family', n: 7, maxrec: 3, lines: true },
    { t: 'skins', on: false },
    { t: 'activ', on: true },
    { t: 'eye-read', n: 7 },
  ]);
});

test('contra engine/worker.js real: save sin sim se rechaza, con sim resuelve; getopts y botText', {
  skip: hayWasm() ? false : SIN_WASM,
}, async () => {
  const nw = workerEngine({ init: false });
  /** @type {WorkerLike} */
  const w = {
    onmessage: null,
    onerror: null,
    postMessage: (m, tr) => nw.postMessage(m, /** @type {any} */ (tr)),
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
  try {
    const vacio = await c.save().then(
      () => 'resuelto',
      (e) => e.clave,
    );
    assert.ok(['sin-respuesta', 'save-empty'].includes(vacio), `save sin sim: ${vacio}`);
    c.reset({
      seed: 1234,
      options: {
        fieldW: 9000,
        fieldH: 7000,
        minVegs: 5,
        repopAmount: 3,
        repopCooldown: 50,
        maxEnergy: 40,
        startChlr: 3000,
        mutations: false,
        opts: { 21: 1, 34: 400 },
      },
      species: [],
    });
    const bytes = await c.save();
    assert.ok(bytes instanceof Uint8Array && bytes.length > 0);
    const opts = await c.getopts([21, 34]);
    assert.deepEqual(opts, { 21: 1, 34: 400 });
    assert.equal(await c.botText(1), '');
  } finally {
    c.terminar();
  }
});

test('quitarDibujante solo quita el propio', () => {
  const { w, c, correrAgenda } = armar();
  /** @type {string[]} */
  const quien = [];
  const a = () => quien.push('a');
  const b = () => quien.push('b');
  c.ponerDibujante(a);
  c.ponerDibujante(b); // otro mundo montado después
  c.quitarDibujante(a); // el viejo se desmonta
  w.llega({ t: 'frame', buf: frame(), stats: { cycle: 1, bots: 1, vegs: 0, tps: 0 } });
  correrAgenda();
  c.quitarDibujante(b);
  w.llega({ t: 'frame', buf: frame(), stats: { cycle: 2, bots: 1, vegs: 0, tps: 0 } });
  correrAgenda();
  assert.deepEqual(quien, ['b']);
});

test('saveConCiclo resuelve bytes y ciclo', async () => {
  const { w, c } = armar();
  const p = c.saveConCiclo();
  const { id } = w.de('save')[0].msg;
  w.llega({ t: 'saved', bytes: new Uint8Array([4, 5]).buffer, cycle: 321, id });
  const r = await p;
  assert.deepEqual([...r.bytes], [4, 5]);
  assert.equal(r.cycle, 321);
});

test('reset reenvía los indicadores de la nueva (limpio, semillaColores; C15) y setbase', () => {
  const { w, c } = armar();
  c.reset({ seed: 5, options: {}, species: [], limpio: true, semillaColores: 9 });
  c.reset({ seed: 6, options: {}, species: [] });
  c.setbase({ minVegs: 20, mutations: true });
  c.setbase({ repopAmount: 3 }, true);
  assert.deepEqual(
    w.enviados.slice(1).map((e) => e.msg),
    [
      {
        t: 'reset',
        seed: 5,
        options: {},
        species: [],
        quietF1: false,
        limpio: true,
        semillaColores: 9,
      },
      { t: 'reset', seed: 6, options: {}, species: [], quietF1: false },
      { t: 'setbase', vals: { minVegs: 20, mutations: true } },
      { t: 'setbase', vals: { repopAmount: 3 }, nocap: true },
    ],
  );
});

test('cargarConRespuesta: transfiere los bytes y resuelve con lo cargado', async () => {
  const { w, c } = armar();
  const p = c.cargarConRespuesta(new Uint8Array([1, 2, 3]));
  const e = w.de('load')[0];
  assert.deepEqual([...new Uint8Array(e.msg.bytes)], [1, 2, 3]);
  assert.deepEqual(e.transfer, [e.msg.bytes]);
  w.llega({ t: 'loaded', id: e.msg.id, cycle: 250, bots: 31, missing: ['A.txt'] });
  assert.deepEqual(await p, { cycle: 250, bots: 31, missing: ['A.txt'] });
});

test('aplicarEnCiclo: pausa, pide el ciclo, manda y reanuda después de la respuesta', async () => {
  const { w, c } = armar();
  let sigue = true;
  const p = c.aplicarEnCiclo([{ t: 'setopt', id: 33, v: 1 }], () => sigue);
  const tipos = () => w.enviados.slice(1).map((e) => e.msg.t);
  assert.deepEqual(tipos(), ['run', 'ciclo', 'setopt'], 'sin reanudar hasta la respuesta');
  const { id } = w.de('ciclo')[0].msg;
  w.llega({ t: 'ciclo', id, cycle: 1234 });
  assert.equal(await p, 1234);
  assert.deepEqual(tipos(), ['run', 'ciclo', 'setopt', 'run']);
  assert.deepEqual(
    w.enviados.filter((e) => e.msg.t === 'run').map((e) => e.msg.running),
    [false, true],
  );
  // en pausa no toca run; si el usuario pausó mientras, no reanuda
  const q = c.aplicarEnCiclo([{ t: 'step' }]);
  w.llega({ t: 'ciclo', id: w.de('ciclo')[1].msg.id, cycle: 5 });
  assert.equal(await q, 5);
  sigue = false;
  const r = c.aplicarEnCiclo([], () => sigue);
  w.llega({ t: 'ciclo', id: w.de('ciclo')[2].msg.id, cycle: 6 });
  await r;
  assert.equal(w.enviados.filter((e) => e.msg.t === 'run').length, 3, 'solo la pausa');
});

test('trazador (E2.2): trace-on sin respuesta; traceBot y memDump con id y tiempo límite', async () => {
  const { w, c, reloj } = armar();
  c.traceOn(true);
  assert.deepEqual(w.enviados.at(-1)?.msg, { t: 'trace-on', on: true });
  c.traceOn(false);
  assert.deepEqual(w.enviados.at(-1)?.msg, { t: 'trace-on', on: false });

  const p = c.traceBot(3);
  const { id } = w.de('trace-bot')[0].msg;
  assert.deepEqual(w.de('trace-bot')[0].msg, { t: 'trace-bot', n: 3, id });
  w.llega({ t: 'trace', n: 3, id, tsv: '#\t9\t3\t1\n1\t9\t1\t1\t1\t1\t0\t\t0\t\t0\t0\n' });
  assert.equal(await p, '#\t9\t3\t1\n1\t9\t1\t1\t1\t1\t0\t\t0\t\t0\t0\n');

  // una respuesta vacía resuelve con "" (el bot no se trazó)
  const q = c.traceBot(3);
  w.llega({ t: 'trace', n: 3, id: w.de('trace-bot')[1].msg.id, tsv: '' });
  assert.equal(await q, '');

  const m = c.memDump(3);
  const mid = w.de('mem-dump')[0].msg.id;
  assert.deepEqual(w.de('mem-dump')[0].msg, { t: 'mem-dump', n: 3, id: mid });
  w.llega({ t: 'mem', n: 3, id: mid, mem: [0, 5, 7] });
  assert.deepEqual(await m, [0, 5, 7]);

  // vence sin respuesta: rechaza con 'tiempo'
  const v = c.traceBot(3);
  reloj.avanzar(TIEMPOS.traza);
  assert.deepEqual(await estado(v), { error: 'tiempo' });
  const w2 = c.memDump(3);
  reloj.avanzar(TIEMPOS.mem);
  assert.deepEqual(await estado(w2), { error: 'tiempo' });
});
