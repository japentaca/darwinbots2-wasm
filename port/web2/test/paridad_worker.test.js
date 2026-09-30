// @ts-check
// Cierre de E1 (PLAN de web2): la orquestación extraída (engine/worker.js)
// da exactamente lo mismo que la clásica (port/web/worker.js).
//
// La misma corrida —semilla fija, mismas opciones y especies, la misma
// secuencia de mensajes— por las dos orquestaciones, cada una en su
// worker_thread. Se comparan byte a byte los .dbsim (save → saved.bytes),
// frames completos (cabecera + todos los bloques) y los mensajes que no son
// frame (logs, tabla de especies, charts…). Después, cada una carga el .dbsim
// de la otra y siguen corriendo iguales.
//
// El reloj y Math.random se fijan en los dos workers (entradas de host de la
// clásica: vbNowSimStart, el Timer de AssignSkin y el color de las formas).
// Sin port/build-wasm/dbcore.wasm el test se saltea (el job web2 del CI no
// compila el wasm).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { H, largoFrame, seccionesFrame } from '../engine/protocolo.js';
import { ClienteSim, urlBuildWasm, workerEngine, workerWeb } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const CICLOS_1 = 1000;
const CICLOS_2 = 1000;
const CICLOS_CARGA = 500;

// Presets de la página clásica (port/web/index.html, PRESETS).
const ANIMAL = `' Animal Minimalis
' Gene 1 Food Finder
cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refveldx .dx store
*.refvelup 30 add .up store
stop

' Gene 2 Eat Food
cond
*.eye5 50 >
*.refeye *.myeye !=
start
-1 .shoot store
*.refvelup .up store
stop

' Gene 3 Avoiding Family
cond
*.eye5 0 =
*.refeye *.myeye = or
start
314 rnd .aimdx store
stop

' Gene 4 Reproduce
cond
*.nrg 20000 >
start
10 .repro store
stop
end
`;
const ALGA = `' Alga Minimalis
' Gene 1 Reproduce
cond
*.nrg 5000 >
start
50 .repro store
stop

' Gene 2 turn
cond
*.fixpos 0 =
start
628 rnd 314 sub .aimdx store
stop
end
`;

/** @param {string} f */
const bot = (f) => fs.readFileSync(path.join(WEB, 'bots', f), 'utf8');

function especies() {
  return [
    { dna: ALGA, name: 'Alga_Minimalis.txt', veg: true, qty: 8, nrg: 3000, color: 0x30d030 },
    { dna: ANIMAL, name: 'Animal_Minimalis.txt', veg: false, qty: 4, nrg: 3000, color: 0x4040ff },
    {
      dna: bot('Zebedee_V2.1_F2_Jez_-26.07.06.txt'),
      name: 'Zebedee_V2.1_F2_Jez_-26.07.06.txt',
      veg: false,
      qty: 3,
      nrg: 3000,
      color: 0xff8030,
    },
    {
      dna: bot('All_Hunter_F1_Spike43884_11-21-2014.txt'),
      name: 'All_Hunter_F1_Spike43884_11-21-2014.txt',
      veg: false,
      qty: 3,
      nrg: 3000,
      color: 0x8030ff,
    },
    {
      dna: bot('Alga_minimalis_3.0.txt'),
      name: 'Alga_minimalis_3.0.txt',
      veg: true,
      qty: 6,
      nrg: 3000,
      color: 0x20a020,
    },
  ];
}

const RESET = {
  t: 'reset',
  seed: 424242,
  options: {
    fieldW: 9000,
    fieldH: 7000,
    minVegs: 5,
    repopAmount: 3,
    repopCooldown: 50,
    maxPopulation: 30,
    maxEnergy: 40,
    startChlr: 3000,
    mutations: true,
    opts: { 33: 1, 34: 400, 50: 1, 110: 50 },
    costs: { 54: 1 },
  },
};

/**
 * Tras dos barreras el último frame recibido es el del estado actual: la
 * primera asegura que llegaron los frames previos (y salieron sus ack); la
 * segunda, que un frame diferido por el ping-pong ya se publicó.
 * @param {ClienteSim} c
 */
async function estable(c) {
  await c.sync();
  await c.sync();
  return /** @type {Float32Array} */ (c.frame);
}

/**
 * @param {ClienteSim} c
 * @param {number} n
 */
async function pasos(c, n) {
  for (let i = 0; i < n; i++) c.send({ t: 'step' });
  return estable(c);
}

/** @param {ClienteSim} c */
async function guardar(c) {
  c.send({ t: 'save' });
  const m = await c.wait((x) => x.t === 'saved');
  return new Uint8Array(m.bytes);
}

/** @param {Float32Array} f */
const usado = (f) => Buffer.from(f.buffer, f.byteOffset, largoFrame(f) * 4);

/**
 * Mensajes que no son frame, sin el ArrayBuffer de 'saved' (se compara
 * aparte) y sin las respuestas a las barreras.
 * @param {ClienteSim} c
 */
const bitacora = (c) =>
  c.msgs
    .filter((m) => m.t !== 'opt')
    .map((m) => (m.t === 'saved' ? { t: 'saved', cycle: m.cycle } : m));

/**
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @param {string} que
 */
function mismoFrame(a, b, que) {
  assert.ok(a && b, `${que}: sin frame`);
  const sa = seccionesFrame(a);
  assert.deepEqual(
    Array.from(a.subarray(0, 13)),
    Array.from(b.subarray(0, 13)),
    `${que}: cabecera`,
  );
  const bots = (/** @type {Float32Array} */ f) =>
    Buffer.from(f.buffer, f.byteOffset + sa.bots * 4, f[H.nBots] * 20 * 4);
  assert.ok(bots(a).equals(bots(b)), `${que}: bloque de bots`);
  assert.ok(usado(a).equals(usado(b)), `${que}: frame completo (${sa.fin} floats)`);
}

test('paridad web/worker.js ↔ engine/worker.js (.dbsim y frames)', {
  skip: hayWasm() ? false : SIN_WASM,
  timeout: 600000,
}, async () => {
  // web/worker.js resuelve '../build-wasm/' contra el cwd.
  process.chdir(WEB);
  const det = { fechaFija: Date.UTC(2026, 0, 15, 13, 2, 3), semillaAzar: 12345 };
  const web = new ClienteSim(workerWeb(det));
  const eng = new ClienteSim(workerEngine(det));
  try {
    await Promise.all([web.wait((m) => m.t === 'ready'), eng.wait((m) => m.t === 'ready')]);

    /** @param {(c: ClienteSim) => Promise<any>} fn */
    const ambos = (fn) => Promise.all([fn(web), fn(eng)]);

    // ---- misma secuencia en las dos ----
    const r = await ambos(async (c) => {
      c.send({ ...RESET, species: especies() });
      c.send({ t: 'view', rich: true });
      c.send({ t: 'monitor', on: true, mem: [971, 310, 972] });
      c.send({ t: 'setopt', id: 31, v: 150 });
      c.send({ t: 'setopt', id: 13, v: 1 });
      c.send({ t: 'setcost', i: 54, v: 1.5 });
      c.send({ t: 'shapes-add10', dw: 0.05, dh: 0.05 });
      c.send({ t: 'teleporter' });
      c.send({ t: 'graph-open', n: 1 });
      c.send({ t: 'seed-species', sp: especies()[1] });
      return estable(c);
    });
    mismoFrame(r[0], r[1], 'tras el reset');

    const f1 = await ambos((c) => pasos(c, CICLOS_1));
    mismoFrame(f1[0], f1[1], `ciclo ${CICLOS_1}`);
    assert.ok(f1[0][H.nBots] > 0, 'hay bots vivos');

    // Foco en el primer bot del frame: el bloque de 44 floats viaja.
    const slot = f1[0][13] | 0;
    const f2 = await ambos(async (c) => {
      c.send({ t: 'select', n: slot, seq: 7 });
      c.send({ t: 'bot-text', n: slot });
      c.send({ t: 'family', n: slot, maxrec: 1000, lines: true });
      c.send({ t: 'snapshot', withMut: true });
      return pasos(c, CICLOS_2);
    });
    mismoFrame(f2[0], f2[1], `ciclo ${CICLOS_1 + CICLOS_2}`);
    assert.equal(web.stats.cycle, eng.stats.cycle);

    const s1 = await ambos(guardar);
    assert.ok(s1[0].length > 1000, '.dbsim no vacío');
    assert.ok(Buffer.from(s1[0]).equals(Buffer.from(s1[1])), '.dbsim idéntico byte a byte');

    // ---- cada una carga el .dbsim de la otra y sigue ----
    web.send({ t: 'load', bytes: s1[1].slice().buffer });
    eng.send({ t: 'load', bytes: s1[0].slice().buffer });
    const f3 = await ambos((c) => pasos(c, CICLOS_CARGA));
    mismoFrame(f3[0], f3[1], 'tras cargar el .dbsim cruzado');
    const s2 = await ambos(guardar);
    assert.ok(
      Buffer.from(s2[0]).equals(Buffer.from(s2[1])),
      '.dbsim idéntico tras la carga cruzada',
    );

    assert.deepEqual(bitacora(web), bitacora(eng), 'mismos mensajes (logs, especies, charts…)');
    assert.equal(web.error, null);
    assert.equal(eng.error, null);
  } finally {
    await Promise.all([web.stop(), eng.stop()]);
  }
});

test('engine/worker.js encola lo que llega antes del init y del wasm', {
  skip: hayWasm() ? false : SIN_WASM,
  timeout: 60000,
}, async () => {
  const w = workerEngine({ init: false });
  const c = new ClienteSim(w);
  try {
    // Antes del init: se encola.
    c.send({ ...RESET, species: especies().slice(0, 1) });
    c.send({ t: 'step' });
    c.send({ t: 'getopt', id: 34 });
    c.send({ t: 'init', base: urlBuildWasm(), v: '' });
    c.send({ t: 'step' }); // después del init, antes del wasm: también
    c.send({ t: 'init', base: 'no/importa/', v: 'x' }); // un segundo init se ignora
    const opt = await c.wait((m) => m.t === 'opt');
    assert.equal(opt.v, 400);
    const f = await estable(c);
    assert.equal(f[H.cycle], 1); // TotRunCycle arranca en -1 (RV-35)
    const i = c.msgs.findIndex((m) => m.t === 'ready');
    assert.equal(i, 0, 'ready sale antes que lo encolado');
    assert.equal(c.msgs[1].t, 'log');
    assert.equal(c.error, null);
  } finally {
    await c.stop();
  }
});

test('engine/worker.js: una excepción de la sim al vaciar la cola no corta la cola ni es fallo de carga', {
  skip: hayWasm() ? false : SIN_WASM,
  timeout: 60000,
}, async () => {
  const w = workerEngine({ init: false, atrapar: true });
  const c = new ClienteSim(w);
  try {
    c.send({ ...RESET, species: especies().slice(0, 1) });
    c.send({ t: 'getopt', id: 34 });
    c.send(null); // sim.handle(null) lanza TypeError
    c.send({ t: 'getopt', id: 36 });
    c.send({ t: 'init', base: urlBuildWasm(), v: '' });
    await c.wait((m) => m.t === 'opt' && m.id === 36);
    const u = c.msgs.find((m) => m.t === 'uncaught') || (await c.wait((m) => m.t === 'uncaught'));
    assert.match(u.msg, /TypeError/);
    assert.deepEqual(
      c.msgs.filter((m) => m.t === 'opt').map((m) => m.id),
      [34, 36],
      'el resto de la cola se procesa',
    );
    assert.ok(!c.msgs.some((m) => m.t === 'error'), 'no es un fallo de carga');
    assert.equal(c.error, null);
  } finally {
    await c.stop();
  }
});

test('engine/worker.js: init con base no absoluta o sin barra final → error explícito', async () => {
  for (const base of [
    'build-wasm/',
    './build-wasm/',
    '/build-wasm/',
    'https://x.org/build-wasm',
    '',
  ]) {
    const w = workerEngine({ init: false });
    const c = new ClienteSim(w);
    try {
      c.send({ t: 'step' }); // encolado: se descarta con el fallo
      c.send({ t: 'init', base, v: '' });
      const e = await c.wait((m) => m.t === 'error');
      assert.equal(e.clave, 'init-base', base);
      assert.deepEqual(e.params, { base });
      assert.equal(typeof e.msg, 'string');
      c.send({ t: 'init', base: urlBuildWasm(), v: '' }); // un segundo init se ignora
      c.send({ t: 'getopt', id: 34 });
      await new Promise((r) => setTimeout(r, 200));
      assert.ok(
        !c.msgs.some((m) => m.t === 'ready' || m.t === 'opt'),
        'el worker queda inutilizable',
      );
    } finally {
      await c.stop();
    }
  }
});
