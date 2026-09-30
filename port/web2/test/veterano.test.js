// @ts-check
// Herramientas de veterano del inspector (paso N4.1): presets y teclas del
// Player Bot, archivos .pbkp, diseñador de ojos (contra la clásica en vm),
// cambios en caliente de las facilidades, mensajes de la conexión y, con el
// wasm, el protocolo contra engine/worker.js real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { mensajesEvento, nuevaCorrida, registrarCambio } from '../engine/corridas.js';
import { ESCENARIOS_FABRICA } from '../engine/escenarios/fabrica.js';
import {
  ACCESIBILIDAD,
  ARCHIVOS_MUERTOS,
  aPbkp,
  aplicarCambioVivo,
  archivosVivos,
  codigoVirtual,
  dePbkp,
  EYE1DIR,
  EYE1WIDTH,
  indicesDe,
  leerMemloc,
  leerValor,
  lineasAdnOjos,
  mensajeOjo,
  mensajeTeclas,
  nombreMemloc,
  nombreTecla,
  PRESETS_PB,
  preset,
  presetDe,
  SETAIM,
  TecladoPb,
  textoAdnOjos,
  textoAEntero,
} from '../src/lib/inspector/veterano.js';
import { ConexionSim } from '../src/lib/sim/conexion.js';
import { urlBuildWasm, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const INDEX = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');

/** Trozo de la clásica entre dos marcas (la final incluida si `incluir`). */
function trozo(desde, hasta, incluir = false) {
  const a = INDEX.indexOf(desde);
  const b = INDEX.indexOf(hasta, a);
  assert.ok(a >= 0 && b > a, `no encontré ${desde} … ${hasta}`);
  return INDEX.slice(a, incluir ? b + hasta.length : b);
}

// ---- Player Bot: presets y teclas ---------------------------------------------

test('el preset «flechas» es el juego de teclas fijo de la clásica', () => {
  const ctx = vm.createContext({});
  // JSON: las matrices del contexto vm son de otro reino.
  const PB_KEYS = JSON.parse(
    vm.runInContext(`${trozo('const PB_KEYS = [', '];', true)}; JSON.stringify(PB_KEYS)`, ctx),
  );
  assert.equal(PB_KEYS.length, 5);
  assert.deepEqual(
    preset('flechas').map((k) => [k.codigo, k.memloc, k.valor, k.invertir]),
    PB_KEYS.map((/** @type {any} */ k) => [k.code, k.memloc, k.value, false]),
  );
  // y el mensaje pb-keys es el mismo que manda la clásica
  const clasica = PB_KEYS.map((/** @type {any} */ k) => ({
    memloc: k.memloc,
    value: k.value,
    invert: false,
  }));
  assert.deepEqual(mensajeTeclas(preset('flechas')), { t: 'pb-keys', keys: clasica });
});

test('presets: copias independientes, presetDe reconoce cada uno', () => {
  const a = preset('wasd');
  a[0].valor = 99;
  assert.equal(PRESETS_PB.wasd[0].valor, 40);
  for (const n of /** @type {const} */ (['flechas', 'wasd', 'vacio']))
    assert.equal(presetDe(preset(n)), n);
  assert.equal(presetDe(a), null);
  assert.throws(() => preset(/** @type {any} */ ('nada')), /preset/);
  // WASD usa las mismas memorias que las flechas
  assert.deepEqual(
    preset('wasd').map((k) => k.memloc),
    preset('flechas').map((k) => k.memloc),
  );
});

test('leerMemloc: número 1..999 o sysvar por nombre; leerValor −32000..32000', () => {
  assert.equal(leerMemloc('.up'), 1);
  assert.equal(leerMemloc('UP'), 1);
  assert.equal(leerMemloc(' 7 '), 7);
  assert.equal(leerMemloc('.eye1dir'), EYE1DIR);
  assert.equal(leerMemloc('.setaim'), SETAIM);
  assert.equal(leerMemloc(999), 999);
  for (const x of ['0', '1000', '-3', 'nada', '', '1.5', '.']) assert.equal(leerMemloc(x), null, x);
  assert.equal(nombreMemloc(1), '.up');
  assert.equal(nombreMemloc(5), '.aimdx'); // el primero de la tabla, sin alias
  assert.equal(nombreMemloc(998), '998');
  assert.equal(leerValor('-32000'), -32000);
  assert.equal(leerValor('32000'), 32000);
  for (const x of ['32001', '-32001', '1.5', 'x', '']) assert.equal(leerValor(x), null, x);
});

test('TecladoPb: un pb-key por cambio, sin repeticiones; varias filas por tecla; soltar todas', () => {
  /** @type {any[]} */
  const env = [];
  const tk = new TecladoPb((m) => env.push(m));
  const teclas = [...preset('flechas'), { codigo: 'ArrowUp', memloc: 8, valor: 5, invertir: true }];
  tk.ponerTeclas(teclas);
  assert.deepEqual(indicesDe(teclas, 'ArrowUp'), [0, 5]);
  assert.equal(tk.tecla('KeyZ', true), false);
  assert.equal(tk.tecla('ArrowUp', true), true);
  assert.equal(tk.tecla('ArrowUp', true), true); // repetición: nada
  assert.equal(tk.tecla('Space', true), true);
  assert.deepEqual(env, [
    { t: 'pb-key', idx: 0, active: true },
    { t: 'pb-key', idx: 5, active: true },
    { t: 'pb-key', idx: 4, active: true },
  ]);
  env.length = 0;
  tk.soltarTodas();
  assert.deepEqual(env, [
    { t: 'pb-key', idx: 0, active: false },
    { t: 'pb-key', idx: 5, active: false },
    { t: 'pb-key', idx: 4, active: false },
  ]);
  assert.equal(tk.apretadas.size, 0);
  env.length = 0;
  tk.tecla('ArrowDown', true);
  tk.ponerTeclas(preset('vacio')); // teclas nuevas: se olvidan las apretadas
  tk.soltarTodas();
  assert.deepEqual(env, [{ t: 'pb-key', idx: 1, active: true }]);
});

test('.pbkp: ida y vuelta, formato de escritorio (CRLF, True/False) y archivos inválidos', () => {
  const teclas = [
    ...preset('wasd'),
    { codigo: 'Numpad5', memloc: 19, valor: 0, invertir: true },
    { codigo: 'F3', memloc: 7, valor: -6, invertir: false },
  ];
  const r = aPbkp(teclas);
  assert.deepEqual(r.omitidas, []);
  assert.ok(r.texto.startsWith('87\r\n1\r\n40\r\nFalse\r\n'));
  assert.ok(r.texto.includes('101\r\n19\r\n0\r\nTrue\r\n'));
  assert.deepEqual(dePbkp(r.texto), { teclas, omitidas: [] });
  assert.equal(codigoVirtual('ArrowLeft'), 37);
  assert.equal(codigoVirtual('ShiftRight'), 16);
  // Lo que guarda el diálogo de escritorio: KeyCode, memloc, valor, Invert.
  assert.deepEqual(dePbkp('38\n1\n40\nFalse\n32\n7\n-1\nTrue\n').teclas, [
    { codigo: 'ArrowUp', memloc: 1, valor: 40, invertir: false },
    { codigo: 'Space', memloc: 7, valor: -1, invertir: true },
  ]);
  assert.deepEqual(dePbkp(''), { teclas: [], omitidas: [] });
  const raro = aPbkp([{ codigo: 'IntlBackslash', memloc: 1, valor: 1, invertir: false }]);
  assert.equal(raro.texto, '');
  assert.equal(raro.omitidas.length, 1);
  // Teclas fuera de la tabla (F13 = 124, 999): se omiten y el resto se carga.
  assert.deepEqual(dePbkp('124\n1\n40\nFalse\n38\n2\n40\nFalse\n999\n3\n1\nTrue\n'), {
    teclas: [{ codigo: 'ArrowUp', memloc: 2, valor: 40, invertir: false }],
    omitidas: [124, 999],
  });
  for (const malo of [
    '38\n1\n40',
    '38\n1\n40\nquizas',
    'x\n1\n40\nTrue',
    '38\n0\n40\nTrue',
    '999\n0\n40\nTrue',
  ])
    assert.throws(() => dePbkp(malo), /pbkp/, malo);
  assert.equal(nombreTecla('ArrowUp'), '↑');
  assert.equal(nombreTecla('KeyW'), 'W');
  assert.equal(nombreTecla('Digit4'), '4');
  assert.equal(nombreTecla('Space'), 'Space');
});

// ---- Diseñador de ojos ----------------------------------------------------------

test('textoAEntero = vbTextToInteger de la clásica', () => {
  const ctx = vm.createContext({});
  vm.runInContext(trozo('function vbRoundHalfEven(x)', '// Val() de VB6'), ctx);
  const clasica = /** @type {(s: string) => number | null} */ (
    vm.runInContext('vbTextToInteger', ctx)
  );
  const casos = [
    '0',
    '10',
    '-10',
    ' 42 ',
    '+7',
    '2.5',
    '3.5',
    '-2.5',
    '1e3',
    '1.5E2',
    '.5',
    '0.5',
    '32767',
    '32768',
    '-32768',
    '-32769',
    '&HFFFF',
    '&H7FFF',
    '&H8000',
    '&H10000',
    '&h1f',
    '&O17',
    '&17',
    '&O8',
    '',
    ' ',
    'abc',
    '12abc',
    '1,5',
    '--1',
    'e5',
    '1e',
    '99999999',
    '&HFFFFF',
    '0x10',
    'Infinity',
    'NaN',
  ];
  for (const s of casos) assert.equal(textoAEntero(s), clasica(s), JSON.stringify(s));
});

test('el gen de «Escribir en el ADN» = el de la clásica (btnOut)', () => {
  const dir = ['0', '-35', '35', '70', '-70', '105', '-105', '140', 'x'];
  const wth = ['10', '0', '0', '5', '5', '-7', '0', '0', '1256'];
  const ctx = vm.createContext({
    w: {
      body: {
        /** @param {string} sel */
        querySelector: (sel) => {
          const m = /\.e-(dir|wth)\[data-i="(\d)"\]/.exec(sel);
          assert.ok(m, sel);
          return { value: (m[1] === 'dir' ? dir : wth)[Number(m[2])] };
        },
      },
    },
  });
  const L = vm.runInContext(
    `(() => { ${trozo("const L = ['Cond', '*.robage 0 =', 'Start'];", "L.push('Stop');", true)} return L; })()`,
    ctx,
  );
  assert.deepEqual(lineasAdnOjos(dir, wth), JSON.parse(JSON.stringify(L)));
  assert.equal(L.length, 3 + 9 * 3 + 1);
  assert.equal(textoAdnOjos(dir, wth), `${L.join('\n')}\n`);
});

test('mensajeOjo: setmem en .eyeNdir / .eyeNwidth; texto inválido o sin bot = nada', () => {
  assert.deepEqual(mensajeOjo(7, 'dir', 0, '35'), { t: 'setmem', n: 7, addr: 521, v: 35 });
  assert.deepEqual(mensajeOjo(7, 'ancho', 8, '2.5'), { t: 'setmem', n: 7, addr: 539, v: 2 });
  assert.equal(EYE1WIDTH, 531);
  assert.equal(mensajeOjo(7, 'dir', 0, 'x'), null);
  assert.equal(mensajeOjo(7, 'dir', 0, '40000'), null);
  assert.equal(mensajeOjo(0, 'dir', 0, '1'), null);
  assert.equal(mensajeOjo(7, 'dir', 9, '1'), null);
});

test('facilidades: cambios en caliente registrados que las réplicas repiten igual que la clásica', async () => {
  const c = nuevaCorrida({ escenario: ESCENARIOS_FABRICA[0], semilla: 1 });
  /** @type {any[][]} */
  const mandados = [];
  const doble = {
    sesion: {
      aplicarEnCiclo: async (/** @type {any[]} */ m) => {
        mandados.push(m);
        return 120;
      },
    },
    registrarCambio: (/** @type {Record<string, number>} */ k, /** @type {number} */ ciclo) =>
      registrarCambio(c, ciclo, k),
  };
  await aplicarCambioVivo(doble, ACCESIBILIDAD.sinCostos);
  await aplicarCambioVivo(doble, ACCESIBILIDAD.sinBrowniano);
  await aplicarCambioVivo(doble, { 'opt:111': 1, 'opt:112': 1 });
  // Los mismos mensajes que la clásica (salvo nocap, inocuo en 0 y 1).
  assert.deepEqual(mandados, [
    [{ t: 'setcost', i: 54, v: 0 }],
    [{ t: 'setopt', id: 13, v: 0 }],
    [
      { t: 'setopt', id: 111, v: 1 },
      { t: 'setopt', id: 112, v: 1 },
    ],
  ]);
  assert.equal(c.eventos.length, 1); // mismo ciclo: un evento
  assert.equal(c.eventos[0].ciclo, 120);
  assert.deepEqual(mensajesEvento(c.eventos[0]), mandados.flat());
  const sinSetter = { sesion: {}, registrarCambio: () => null };
  await assert.rejects(aplicarCambioVivo(sinSetter, { 'opt:13': 0 }), /aplicarEnCiclo/);
});

test('instantáneas: nombres de archivo', () => {
  assert.deepEqual(archivosVivos('Sopa-1200'), {
    snp: 'Sopa-1200.snp',
    mut: 'Sopa-1200_Mutations.txt',
  });
  assert.deepEqual(ARCHIVOS_MUERTOS, {
    snp: 'DeadRobots.snp',
    mut: 'DeadRobots_Mutations.txt',
  });
});

// ---- Conexión ------------------------------------------------------------------

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
  return { c, enviados, llega: (/** @type {any} */ d) => w.onmessage({ data: d }) };
}

test('conexión: mensajes del Player Bot, setmem y dead-reset', () => {
  const { c, enviados } = conexionFalsa();
  enviados.length = 0;
  c.pb(true);
  c.pbKeys([{ memloc: 1.7, value: 40, invert: false }]);
  c.pbKey(2, true);
  c.pbMouse(1234.5, 99);
  c.pbMouse(Number.NaN, 1);
  c.setmem(3, 521, 35);
  c.deadReset();
  c.pb(false);
  assert.deepEqual(enviados, [
    { t: 'pb', on: true },
    { t: 'pb-keys', keys: [{ memloc: 1, value: 40, invert: false }] },
    { t: 'pb-key', idx: 2, active: true },
    { t: 'pb-mouse', x: 1234.5, y: 99 },
    { t: 'pb-mouse', x: 0, y: 1 },
    { t: 'setmem', n: 3, addr: 521, v: 35 },
    { t: 'dead-reset' },
    { t: 'pb', on: false },
  ]);
});

test('conexión: snapshot y dead-take se emparejan en orden', async () => {
  const { c, enviados, llega } = conexionFalsa();
  enviados.length = 0;
  const a = c.snapshot(true);
  const b = c.deadTake();
  const a2 = c.snapshot(false);
  assert.deepEqual(enviados, [
    { t: 'snapshot', withMut: true },
    { t: 'dead-take', drain: false },
    { t: 'snapshot', withMut: false },
  ]);
  llega({ t: 'snapshot-done', records: 3, snp: 'S1', mut: 'M1' });
  llega({ t: 'dead-data', records: 0, snp: '', mut: '' });
  llega({ t: 'snapshot-done', records: 2, snp: 'S2', mut: '' });
  assert.deepEqual(await a, { records: 3, snp: 'S1', mut: 'M1' });
  assert.deepEqual(await b, { records: 0, snp: '', mut: '' });
  assert.deepEqual(await a2, { records: 2, snp: 'S2', mut: '' });
});

// ---- Contra engine/worker.js real -------------------------------------------------

test('contra engine/worker.js: pb, setmem + eye-read, findbest, snapshot y registro de muertos', {
  skip: hayWasm() ? false : SIN_WASM,
}, async () => {
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
  /** @param {string} tipo */
  const siguiente = (tipo) =>
    new Promise((r) => {
      const baja = c.on(tipo, (m) => {
        baja();
        r(m);
      });
    });
  try {
    c.reset({
      seed: 77,
      options: {
        fieldW: 8000,
        fieldH: 6000,
        minVegs: 0,
        repopAmount: 0,
        repopCooldown: 50,
        maxEnergy: 40,
        startChlr: 0,
        mutations: false,
        opts: { 111: 1 },
      },
      species: [
        {
          dna: 'cond start 10 .up store stop',
          name: 'Corredor.txt',
          veg: false,
          qty: 6,
          nrg: 30,
          color: 0xff00,
        },
      ],
    });
    for (let i = 0; i < 5; i++) c.step();
    await c.ciclo();
    // «Buscar el mejor»: el motor elige un bot y contesta con su foco.
    const foco = siguiente('focus');
    c.findbest();
    const n = /** @type {any} */ (await foco).n;
    assert.ok(n > 0, `findbest: ${n}`);
    // Diseñador de ojos: setmem y releer.
    c.setmem(n, EYE1DIR + 2, 123);
    c.setmem(n, EYE1WIDTH + 8, -40);
    const ojos = siguiente('eye-vals');
    c.eyeRead(n);
    const ev = /** @type {any} */ (await ojos);
    assert.equal(ev.dir[2], 123);
    assert.equal(ev.wth[8], -40);
    // Player Bot: encender con teclas y puntero no rompe el tick.
    c.pb(true);
    c.enviar(mensajeTeclas(preset('flechas')));
    c.pbMouse(4000, 3000);
    c.pbKey(0, true);
    c.step();
    c.pbKey(0, false);
    c.pb(false);
    await c.ciclo();
    // Instantánea de los vivos.
    const snp = await c.snapshot(true);
    assert.equal(snp.records, 6);
    assert.ok(snp.snp.length > 0 && snp.mut.length > 0);
    const sinMut = await c.snapshot(false);
    assert.equal(sinMut.mut, '');
    // Registro de muertos (vacío: nadie murió) y reinicio.
    const muertos = await c.deadTake(false);
    assert.equal(typeof muertos.records, 'number');
    c.deadReset();
    assert.equal((await c.deadTake(false)).records, 0);
  } finally {
    c.terminar();
  }
});
