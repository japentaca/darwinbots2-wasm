// @ts-check
// Corrida actual de la interfaz (src/lib/sim/corrida-nucleo.js) con una
// sesión simulada y el almacén en memoria.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { almacenMemoria, ErrorAlmacen } from '../engine/almacen.js';
import { crearCorridas } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar, diff } from '../engine/escenarios/index.js';
import { avisoDeError, CLAVES_ERROR } from '../src/lib/observar/errores.js';
import { ErrorConexion } from '../src/lib/sim/conexion.js';
import { ErrorCorrida, estadoVacio, NucleoCorrida } from '../src/lib/sim/corrida-nucleo.js';

function sesionFalsa() {
  /** @type {Map<string, ((m: any) => void)[]>} */
  const oyentes = new Map();
  /** @type {any[]} */
  const enviados = [];
  const s = {
    stats: { cycle: 0, bots: 0 },
    corriendo: false,
    hayMundo: false,
    /** @type {string[]} */
    especies: [],
    enviados,
    c: {
      /** @param {string} t @param {(m: any) => void} cb */
      on(t, cb) {
        oyentes.set(t, [...(oyentes.get(t) ?? []), cb]);
        return () => {};
      },
      /** @param {any} m */
      enviar: (m) => enviados.push(m),
      /** @param {any} sp */
      seedSpecies: (sp) => enviados.push({ t: 'seed-species', sp }),
      /** @param {any[]} entries */
      dnaLib: (entries) => enviados.push({ t: 'dna-lib', entries }),
    },
    /** @param {any} o */
    reset(o) {
      enviados.push({ t: 'reset', ...o });
      s.hayMundo = true;
    },
    /** @param {boolean} on */
    correr(on) {
      s.corriendo = on;
      enviados.push({ t: 'run', running: on });
    },
    /** @param {number} n */
    seleccionar: (n) => enviados.push({ t: 'select', n }),
    /** @param {any} b */
    cargar(b) {
      s.hayMundo = true;
      enviados.push({ t: 'load', bytes: new Uint8Array(b) });
    },
    guardar: async () => new Uint8Array([7, 7, 7, s.stats.cycle & 0xff]),
    /** @param {string} t @param {any} m */
    emitir(t, m) {
      for (const cb of oyentes.get(t) ?? []) cb(m);
    },
  };
  return s;
}

function entorno() {
  const sesion = sesionFalsa();
  const corridas = crearCorridas({ almacen: almacenMemoria() });
  /** @type {{ bytes: Uint8Array, nombre: string }[]} */
  const descargas = [];
  let reloj = 0;
  const n = new NucleoCorrida({
    sesion: /** @type {any} */ (sesion),
    corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async (s) => `' ADN de ${s.bot}\nend\n`,
    miniatura: () => 'data:image/png;base64,AA==',
    descargar: (bytes, nombre) => descargas.push({ bytes, nombre }),
    ahora: () => reloj,
    semillaNueva: () => 4242,
  });
  return {
    sesion,
    corridas,
    descargas,
    n,
    /** @param {number} ms */
    avanzar: (ms) => {
      reloj += ms;
    },
  };
}

/**
 * Resumen armado a mano.
 * @param {number} ciclo @param {Record<string, number>} especies @param {number} [gen]
 */
function resumen(ciclo, especies, gen = 0) {
  /** @type {Record<string, {n: number, color: number}>} */
  const e = {};
  let vivos = 0;
  for (const [k, n] of Object.entries(especies)) {
    e[k] = { n, color: k.length * 1000 };
    vivos += n;
  }
  return {
    ciclo,
    vivos,
    vegetales: 0,
    nrgMedia: 1000,
    genMax: gen,
    genEspecie: 'Animal',
    rica: true,
    especies: e,
  };
}

const SOPA = /** @type {import('../engine/escenarios/index.js').Escenario} */ (
  escenarioFabrica('sopa-primordial')
);

test('iniciar manda los mensajes del escenario por la sesión y empieza una corrida', async () => {
  const { sesion, n } = entorno();
  await n.iniciar(SOPA, 99);
  const tipos = sesion.enviados.map((m) => m.t);
  // los mismos mensajes que aplicar() (en orden) y después la selección vacía
  const esperados = aplicar(
    SOPA,
    99,
    (s) => `' ADN de ${s.bot}
end
`,
  ).map((m) => m.t);
  assert.deepEqual(tipos, [...esperados, 'select']);
  const reset = sesion.enviados[1];
  assert.equal(reset.seed, 99);
  assert.equal(reset.species.length, 2);
  assert.match(reset.species[0].dna, /ADN de Alga minimalis 3\.0/);
  assert.equal(n.estado.nombre, 'Sopa primordial');
  assert.equal(n.estado.semilla, 99);
  assert.equal(n.estado.id, null);
  assert.deepEqual(n.estado.eventos, []);
  assert.equal(n.estado.feed[0].tipo, 'inicio');
  assert.equal(n.estado.ocupado, '');
});

test('arrancarPorDefecto: Sopa primordial con semilla nueva y a correr; una sola vez', async () => {
  const { sesion, n } = entorno();
  await Promise.all([n.arrancarPorDefecto(), n.arrancarPorDefecto()]);
  assert.equal(sesion.enviados.filter((m) => m.t === 'reset').length, 1);
  assert.equal(n.estado.semilla, 4242);
  assert.equal(sesion.corriendo, true);
  await n.arrancarPorDefecto();
  assert.equal(sesion.enviados.filter((m) => m.t === 'reset').length, 1, 'ya hay mundo');
});

test('arrancarPorDefecto sin Bestiary cae en la sim de prueba', async () => {
  const sesion = sesionFalsa();
  const n = new NucleoCorrida({
    sesion: /** @type {any} */ (sesion),
    corridas: crearCorridas({ almacen: almacenMemoria() }),
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async () => {
      throw new Error('sin red');
    },
  });
  await n.arrancarPorDefecto();
  const reset = sesion.enviados.find((m) => m.t === 'reset');
  assert.equal(reset.seed, 1234);
  assert.equal(n.estado.nombre, '');
  assert.equal(n.estado.escenario, null);
  assert.equal(sesion.corriendo, true);
});

test('ingerir: muestras cada 100 ciclos, panel con refresco limitado, eventos del detector', async () => {
  const { sesion, n, avanzar } = entorno();
  await n.iniciar(SOPA, 1);
  sesion.corriendo = true;
  n.ingerir(resumen(0, { Alga: 15, Animal: 5 }));
  assert.equal(n.estado.muestras.length, 1);
  assert.equal(n.estado.vivo?.vivos, 20);
  assert.equal(n.estado.colores.Alga, 'rgb(160,15,0)');
  n.ingerir(resumen(40, { Alga: 16, Animal: 5 }));
  assert.equal(n.estado.muestras.length, 1, 'todavía no toca muestra');
  assert.equal(n.estado.vivo?.ciclo, 0, 'corriendo, el panel no se refresca antes de 250 ms');
  avanzar(300);
  n.ingerir(resumen(120, { Alga: 18, Animal: 2 }, 1));
  assert.equal(n.estado.muestras.length, 2);
  assert.equal(n.estado.vivo?.ciclo, 120);
  avanzar(300);
  n.ingerir(resumen(220, { Alga: 18, Animal: 0 }, 1));
  assert.equal(n.estado.vivo?.extinguidas, 1);
  assert.deepEqual(
    n.estado.feed.slice(0, 2).map((e) => [e.ciclo, e.tipo]),
    [
      [220, 'extincion'],
      [120, 'generacion'],
    ],
  );
  // en pausa, cada frame refresca el panel
  sesion.corriendo = false;
  n.ingerir(resumen(221, { Alga: 18 }));
  assert.equal(n.estado.vivo?.ciclo, 221);
});

test('frames viejos tras un reset se ignoran hasta el primero con la selección vigente', async () => {
  const { sesion, n } = entorno();
  await n.iniciar(SOPA, 1);
  const f = /** @type {any} */ ({
    v: new Float32Array(0),
    nBots: 0,
    rica: false,
    ciclo: 5000,
    nTps: 0,
    of: { bots: 0, vis: -1 },
  });
  sesion.emitir('frame', { frame: f, stats: {}, seqVigente: false, drawMs: 0 });
  assert.equal(n.estado.muestras.length, 0, 'frame de la sim anterior');
  sesion.emitir('frame', { frame: { ...f, ciclo: 0 }, stats: {}, seqVigente: true, drawMs: 0 });
  assert.equal(n.estado.muestras.length, 1);
});

test('especies que aparecen sin sembrarse: llegada por teleporter; lo sembrado no cuenta', async () => {
  const { n } = entorno();
  await n.iniciar(SOPA, 1);
  n.revisarEspecies(['Alga minimalis 3.0', 'Animal Minimalis (4G)(Numsgil)-10.03.05'], true, 0);
  n.sembrar({
    nombre: 'Zebedee',
    adn: 'end',
    cantidad: 3,
    color: '#ff8800',
    vegetal: false,
  });
  n.revisarEspecies(
    ['Alga minimalis 3.0', 'Animal Minimalis (4G)(Numsgil)-10.03.05', 'Zebedee', 'Anubis'],
    true,
    1400,
  );
  assert.deepEqual(
    n.estado.feed.slice(0, 2).map((e) => [e.tipo, e.params.especie]),
    [
      ['llegada', 'Anubis'],
      ['sembrado', 'Zebedee'],
    ],
  );
});

test('sembrar manda seed-species con el color en Long BGR', () => {
  const { sesion, n } = entorno();
  n.sembrar({ nombre: 'X.txt', adn: 'end', cantidad: 2.7, color: '#102030', vegetal: true });
  const m = sesion.enviados.at(-1);
  assert.equal(m.t, 'seed-species');
  assert.deepEqual(m.sp, {
    dna: 'end',
    name: 'X.txt',
    veg: true,
    qty: 2,
    nrg: 3000,
    color: 0x10 + 0x20 * 256 + 0x30 * 65536,
  });
});

test('registrarCambio antes del primer tick: ciclo −1 (distinto de tras un tick, 0); el feed muestra 0', async () => {
  const { sesion, n } = entorno();
  await n.iniciar(SOPA, 1);
  sesion.stats.cycle = -1;
  n.registrarCambio({ 'opt:33': 1 });
  assert.deepEqual(n.estado.eventos, [{ ciclo: -1, tipo: 'opciones', cambios: { 'opt:33': 1 } }]);
  assert.equal(n.estado.feed[0].ciclo, 0, 'la interfaz no muestra −1');
  assert.equal(n.historia.eventos.at(-1).ciclo, 0);
  assert.equal(n.mensajesEventos()[0].ciclo, -1);
  // tras exactamente un tick: ciclo 0, otro evento
  sesion.stats.cycle = 0;
  n.registrarCambio({ 'opt:34': 900 });
  assert.deepEqual(
    n.estado.eventos.map((e) => e.ciclo),
    [-1, 0],
  );
  // sin ciclo conocido (NaN) también es antes del primer tick
  const b = entorno();
  await b.n.iniciar(SOPA, 1);
  b.sesion.stats.cycle = Number.NaN;
  b.n.registrarCambio({ 'opt:33': 0 });
  assert.equal(b.n.estado.eventos[0].ciclo, -1);
});

test('feed: una sola copia (los eventos de la historia); lee corridas viejas con extra.feed', async () => {
  const a = entorno();
  await a.n.iniciar(SOPA, 3);
  a.n.ingerir(resumen(0, { Alga: 1 }));
  a.sesion.stats.cycle = 40;
  a.n.registrarCambio({ 'opt:33': 1 });
  const r = await a.n.guardar('Una');
  const d = /** @type {any} */ (await a.corridas.cargar(r.id));
  assert.equal(d.extra.feed, undefined);
  assert.deepEqual(
    d.extra.historia.eventos.map((/** @type {any} */ e) => e.tipo),
    ['inicio', 'cambio', 'guardada'],
  );
  // una corrida vieja: historia sin eventos y el feed aparte (el más nuevo primero)
  const vieja = structuredClone(d);
  vieja.extra.historia.eventos = [];
  vieja.extra.feed = [
    { ciclo: 40, tipo: 'guardada', params: { nombre: 'Una' } },
    { ciclo: 40, tipo: 'cambio', params: { cambios: { 'opt:33': 1 } } },
    { ciclo: 0, tipo: 'inicio', params: { nombre: 'x', semilla: 3 } },
  ];
  // y una de N2.1: los dos (la historia sin «guardada», el feed con ella)
  const n21 = structuredClone(d);
  n21.extra.historia.eventos = n21.extra.historia.eventos.slice(0, 2);
  n21.extra.feed = [
    { ciclo: 40, tipo: 'guardada', params: { nombre: 'Una' } },
    ...[...n21.extra.historia.eventos].reverse(),
  ];
  for (const [nombre, datos] of [
    ['vieja', vieja],
    ['n21', n21],
  ]) {
    const b = entorno();
    const cargar = b.corridas.cargar;
    b.corridas.cargar = async () => datos;
    const nb = new NucleoCorrida({
      sesion: /** @type {any} */ (b.sesion),
      corridas: b.corridas,
      estado: estadoVacio(),
      idioma: () => 'es',
      adnDe: async () => 'end',
    });
    await nb.cargar(r.id);
    b.corridas.cargar = cargar;
    assert.deepEqual(
      nb.estado.feed.map((e) => e.tipo),
      ['cargada', 'guardada', 'cambio', 'inicio'],
      nombre,
    );
    assert.deepEqual(
      nb.historia.eventos.map((e) => e.tipo),
      ['inicio', 'cambio', 'guardada', 'cargada'],
      `${nombre}: migrado a la historia, sin repetir`,
    );
  }
});

test('registrarCambio: acepta el diff de Experimentar, lo guarda con su ciclo y va al feed', async () => {
  const { sesion, n } = entorno();
  await n.iniciar(SOPA, 1);
  const borrador = structuredClone(SOPA);
  borrador.opciones.cambios = { ...borrador.opciones.cambios, 'opt:33': 1 };
  const d = diff(borrador, SOPA);
  assert.ok(d.vivo.length > 0);
  sesion.stats.cycle = 500;
  n.registrarCambio(d);
  assert.deepEqual(n.estado.eventos, [{ ciclo: 500, tipo: 'opciones', cambios: { 'opt:33': 1 } }]);
  assert.equal(n.estado.feed[0].tipo, 'cambio');
  assert.equal(n.escenarioEfectivo()?.opciones.cambios['opt:33'], 1);
  assert.equal(SOPA.opciones.cambios['opt:33'], undefined, 'el escenario no se toca');
  // un ciclo atrasado (frame viejo) no rompe el orden: va al mismo ciclo
  sesion.stats.cycle = 400;
  n.registrarCambio({ 'opt:34': 800 });
  assert.equal(n.estado.eventos.length, 1);
  assert.deepEqual(n.estado.eventos[0].cambios, { 'opt:33': 1, 'opt:34': 800 });
  assert.equal(n.registrarCambio({}), null);
  assert.deepEqual(n.mensajesEventos()[0], {
    ciclo: 500,
    mensajes: [
      { t: 'setopt', id: 33, v: 1 },
      { t: 'setopt', id: 34, v: 800 },
    ],
  });
});

test('guardar → cargar restaura escenario, semilla, eventos, feed e historia', async () => {
  const a = entorno();
  await a.n.iniciar(SOPA, 77);
  a.n.ingerir(resumen(0, { Alga: 15, Animal: 5 }));
  a.avanzar(1000);
  a.n.ingerir(resumen(100, { Alga: 16, Animal: 5 }));
  a.sesion.stats.cycle = 150;
  a.n.registrarCambio({ 'opt:33': 1 });
  const r = await a.n.guardar('Mi corrida');
  assert.deepEqual(r.borradas, []);
  assert.equal(a.n.estado.id, r.id);
  assert.equal(a.n.estado.nombre, 'Mi corrida');
  assert.equal(a.n.estado.feed[0].tipo, 'guardada');
  const lista = await a.corridas.listar();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].ciclo, 150);
  assert.equal(lista[0].bots, 21);
  assert.deepEqual(lista[0].especies, ['Alga', 'Animal']);
  assert.equal(lista[0].miniatura, 'data:image/png;base64,AA==');

  // guardar otra vez sobrescribe (mismo id)
  const r2 = await a.n.guardar('Mi corrida');
  assert.equal(r2.id, r.id);
  assert.equal((await a.corridas.listar()).length, 1);

  // «recargar la página»: núcleo nuevo sobre el mismo almacén
  const b = entorno();
  const nb = new NucleoCorrida({
    sesion: /** @type {any} */ (b.sesion),
    corridas: a.corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async () => 'end',
  });
  const c = await nb.cargar(r.id);
  assert.equal(c.nombre, 'Mi corrida');
  const load = b.sesion.enviados.find((m) => m.t === 'load');
  assert.deepEqual([...load.bytes], [7, 7, 7, 150]);
  const iLoad = b.sesion.enviados.findIndex((m) => m.t === 'load');
  assert.equal(b.sesion.enviados[iLoad + 1].t, 'select', 'select después del load');
  // y los globales de proceso del escenario (RV-39), sin el diálogo de opciones
  const tras = b.sesion.enviados.slice(iLoad + 2);
  assert.deepEqual(tras[0], { t: 'setbase', vals: { startChlr: 16000 }, nocap: true });
  assert.deepEqual(
    tras.slice(1).map((m) => [m.t, m.id, m.nocap]),
    [92, 93, 94, 95, 96, 97, 98, 99, 100, 101].map((id) => ['setopt', id, true]),
  );
  assert.equal(nb.estado.semilla, 77);
  assert.equal(nb.estado.id, r.id);
  assert.deepEqual(nb.estado.escenario, SOPA);
  assert.deepEqual(nb.estado.eventos, [{ ciclo: 150, tipo: 'opciones', cambios: { 'opt:33': 1 } }]);
  assert.equal(nb.estado.feed[0].tipo, 'cargada');
  assert.ok(nb.estado.feed.some((e) => e.tipo === 'cambio'));
  assert.deepEqual(
    nb.estado.muestras.map((m) => m.ciclo),
    [0, 100],
  );
  // la historia sigue: la próxima muestra va a partir del ciclo 200
  nb.ingerir(resumen(160, { Alga: 1 }));
  assert.equal(nb.estado.muestras.length, 2);
  nb.ingerir(resumen(200, { Alga: 1 }));
  assert.equal(nb.estado.muestras.length, 3);
  // seguir registrando cambios en la corrida retomada
  b.sesion.stats.cycle = 300;
  nb.registrarCambio({ 'opt:34': 800 });
  assert.equal(nb.estado.eventos.length, 2);
  await assert.rejects(() => nb.cargar('no-existe'), /inexistente/);
});

test('importarDbsim y exportarDbsim', async () => {
  const { sesion, n, descargas } = entorno();
  n.importarDbsim(new Uint8Array([1, 2, 3]), 'vieja.dbsim');
  assert.equal(n.estado.nombre, 'vieja');
  assert.equal(n.estado.escenario, null);
  assert.equal(n.escenarioEfectivo(), null);
  assert.equal(n.estado.feed[0].tipo, 'importada');
  assert.deepEqual([...sesion.enviados.find((m) => m.t === 'load').bytes], [1, 2, 3]);
  sesion.stats.cycle = 9;
  const bytes = await n.exportarDbsim();
  assert.deepEqual(descargas, [{ bytes, nombre: 'vieja' }]);
  // una corrida importada también se puede guardar
  const r = await n.guardar();
  assert.equal(n.estado.id, r.id);
});

test('el evento de un .dbsim importado toma el ciclo del primer frame de la sim cargada', () => {
  const { sesion, n } = entorno();
  n.importarDbsim(new Uint8Array([1]), 'x.dbsim');
  const f = /** @type {any} */ ({
    v: new Float32Array(0),
    nBots: 0,
    rica: false,
    ciclo: 26454,
    nTps: 0,
    of: { bots: 0, vis: -1 },
  });
  sesion.emitir('frame', { frame: { ...f, ciclo: -1 }, stats: {}, seqVigente: true, drawMs: 0 });
  assert.equal(n.estado.feed[0].ciclo, 0, 'el ciclo −1 no cuenta');
  sesion.emitir('frame', { frame: f, stats: {}, seqVigente: true, drawMs: 0 });
  assert.equal(n.estado.feed[0].ciclo, 26454);
  assert.equal(n.estado.feed[0].tipo, 'importada');
});

// ---- N1.7 -----------------------------------------------------------------

test('iniciar manda el reset COMPLETO (limpio: true, C15) y los colores del escenario', async () => {
  const { sesion, n } = entorno();
  n.estado.colores = { Viejo: '#123456' };
  await n.iniciar(SOPA, 99);
  const reset = sesion.enviados.find((m) => m.t === 'reset');
  assert.equal(reset.limpio, true);
  const esperado = aplicar(SOPA, 99, (s) => `' ADN de ${s.bot}\nend\n`).find(
    (m) => m.t === 'reset',
  );
  assert.deepEqual(reset, esperado);
  assert.deepEqual(n.estado.colores, {
    'Alga minimalis 3.0': '#30d030',
    'Animal Minimalis (4G)(Numsgil)-10.03.05': '#ff4040',
  });
});

test('guardar con la sim corriendo: foto del ciclo del .dbsim; retomar no borra la historia', async () => {
  const a = entorno();
  await a.n.iniciar(SOPA, 7);
  // el worker armó el .dbsim en el ciclo 250 pero la página ya vio hasta 400
  /** @type {any} */ (a.sesion).guardarConCiclo = async () => ({
    bytes: new Uint8Array([9, 250 & 0xff]),
    cycle: 250,
  });
  for (let c = 0; c <= 400; c += 50) {
    a.avanzar(1000);
    a.n.ingerir(resumen(c, { Alga: 10 + c / 50, Animal: 5 }));
  }
  a.sesion.stats.cycle = 200;
  a.n.registrarCambio({ 'opt:33': 1 });
  a.sesion.stats.cycle = 380;
  a.n.registrarCambio({ 'opt:34': 900 });
  assert.deepEqual(
    a.n.estado.muestras.map((m) => m.ciclo),
    [0, 100, 200, 300, 400],
  );
  const r = await a.n.guardar('En marcha');
  const guardada = await a.corridas.cargar(r.id);
  assert.ok(guardada);
  assert.equal(guardada.corrida.ciclo, 250);
  assert.equal(guardada.corrida.bots, 10 + 200 / 50 + 5, 'bots de la última muestra ≤ 250');
  assert.deepEqual(
    guardada.corrida.eventos.map((e) => e.ciclo),
    [200],
  );
  // historia nueva (engine/history.js, N2.1): el eje de ciclos, recortado
  assert.deepEqual(Array.from(guardada.extra.historia.t), [0, 100, 200]);
  // el feed se guarda una sola vez: en los eventos de la historia
  assert.equal(guardada.extra.feed, undefined);
  const evs = guardada.extra.historia.eventos;
  assert.ok(evs.every((/** @type {any} */ e) => e.ciclo <= 250));
  assert.equal(evs.at(-1).tipo, 'guardada');
  // en memoria la corrida sigue con todo
  assert.equal(a.n.estado.eventos.length, 2);

  // retomar: el primer frame (ciclo 250) es el punto de partida
  const b = entorno();
  const nb = new NucleoCorrida({
    sesion: /** @type {any} */ (b.sesion),
    corridas: a.corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async () => 'end',
  });
  await nb.cargar(r.id);
  const f = /** @type {any} */ ({
    v: new Float32Array(0),
    nBots: 0,
    rica: false,
    ciclo: 250,
    nTps: 0,
    of: { bots: 0, vis: -1 },
  });
  b.sesion.emitir('frame', { frame: f, stats: {}, seqVigente: true, drawMs: 0 });
  assert.deepEqual(
    nb.estado.muestras.map((m) => m.ciclo),
    [0, 100, 200],
    'la historia no se borra',
  );
  nb.ingerir(resumen(300, { Alga: 1 }));
  assert.deepEqual(
    nb.estado.muestras.map((m) => m.ciclo),
    [0, 100, 200, 300],
  );
});

test('retomar una corrida cuya historia pasa del ciclo del .dbsim: se recorta, no se borra', async () => {
  const a = entorno();
  await a.n.iniciar(SOPA, 7);
  for (let c = 0; c <= 400; c += 100) a.n.ingerir(resumen(c, { Alga: 3 }));
  a.sesion.stats.cycle = 400;
  const r = await a.n.guardar('x');
  // una corrida vieja (antes de saveConCiclo): .dbsim en 250, historia hasta 400
  const g = /** @type {any} */ (await a.corridas.cargar(r.id));
  await a.corridas.guardar(g.corrida, { dbsim: g.dbsim, extra: g.extra });
  const b = entorno();
  const nb = new NucleoCorrida({
    sesion: /** @type {any} */ (b.sesion),
    corridas: a.corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async () => 'end',
  });
  await nb.cargar(r.id);
  nb.ingerir(resumen(250, { Alga: 3 }));
  assert.deepEqual(
    nb.estado.muestras.map((m) => m.ciclo),
    [0, 100, 200],
  );
  // después, un ciclo hacia atrás sí es otra sim
  nb.ingerir(resumen(10, { Alga: 3 }));
  assert.deepEqual(
    nb.estado.muestras.map((m) => m.ciclo),
    [10],
  );
});

test('feed e historia van al store de datos (C14): listar no los lee', async () => {
  const a = entorno();
  await a.n.iniciar(SOPA, 1);
  a.n.ingerir(resumen(0, { Alga: 1 }));
  const r = await a.n.guardar('Liviana');
  const [meta] = await a.corridas.listar();
  assert.equal(meta.id, r.id);
  assert.equal(/** @type {any} */ (meta).feed, undefined);
  assert.equal(/** @type {any} */ (meta).historia, undefined);
  const d = /** @type {any} */ (await a.corridas.cargar(r.id));
  assert.equal(d.extra.feed, undefined, 'el feed va en los eventos de la historia');
  assert.ok(Array.isArray(d.extra.historia.eventos));
  assert.equal(d.extra.historia.t.length, 1);
  assert.ok(d.extra.linaje, 'el linaje también va a corridas-datos');
});

test('guardar como nueva y nombre intacto si el guardado falla', async () => {
  const a = entorno();
  await a.n.iniciar(SOPA, 1);
  const r1 = await a.n.guardar('Uno');
  const r2 = await a.n.guardar('Dos', { comoNueva: true });
  assert.notEqual(r2.id, r1.id);
  assert.equal(a.n.estado.id, r2.id);
  assert.equal((await a.corridas.listar()).length, 2);
  a.sesion.guardar = async () => {
    throw new Error('sin respuesta');
  };
  await assert.rejects(() => a.n.guardar('Tres'));
  assert.equal(a.n.estado.nombre, 'Dos');
  assert.equal(a.n.estado.ocupado, '');
});

test('vista clásica: sin especies inventadas, sin extinciones; el detector reinicia al cambiar', async () => {
  const { n, avanzar } = entorno();
  await n.iniciar(SOPA, 1);
  /** @param {number} ciclo @param {Record<string, number>} esp @param {boolean} rica */
  const r = (ciclo, esp, rica) => ({ ...resumen(ciclo, esp), rica });
  n.ingerir(r(0, { Alga: 10, Animal: 5 }, true));
  avanzar(1000);
  // en la clásica los "nombres" son grupos por color (el color muta)
  n.ingerir(r(100, { '#30d030': 10, '#31d02f': 3 }, false));
  avanzar(1000);
  n.ingerir(r(200, { '#30d030': 10 }, false));
  assert.equal(
    n.estado.feed.filter((e) => e.tipo === 'extincion' || e.tipo === 'especieNueva').length,
    0,
  );
  assert.deepEqual(n.estado.muestras[1].especies, {}, 'la historia guarda solo el total');
  assert.equal(n.estado.muestras[1].total, 13);
  assert.equal(n.estado.vivo?.extinguidas, null);
  assert.equal(n.estado.colores['#31d02f'], undefined, 'no hay colores por grupo');
  // vuelve a la enriquecida: base nueva, no anuncia la «extinción» de Animal
  avanzar(1000);
  n.ingerir(r(300, { Alga: 10 }, true));
  avanzar(1000);
  n.ingerir(r(400, { Alga: 10 }, true));
  assert.equal(n.estado.feed.filter((e) => e.tipo === 'extincion').length, 0);
  assert.equal(n.estado.vivo?.extinguidas, 1, 'Animal tuvo bots y ya no');
});

test('iniciar y arrancarPorDefecto a la vez: un solo reset, el de iniciar', async () => {
  const sesion = sesionFalsa();
  /** @type {(() => void)[]} */
  const esperas = [];
  const n = new NucleoCorrida({
    sesion: /** @type {any} */ (sesion),
    corridas: crearCorridas({ almacen: almacenMemoria() }),
    estado: estadoVacio(),
    idioma: () => 'es',
    // el ADN tarda: las dos operaciones se solapan
    adnDe: (s) => new Promise((res) => esperas.push(() => res(`' ${s.bot}\nend\n`))),
    semillaNueva: () => 1,
  });
  const defecto = n.arrancarPorDefecto();
  const elegido = structuredClone(SOPA);
  elegido.nombre = 'Elegido';
  const inicio = n.iniciar(elegido, 55);
  while (esperas.length) /** @type {() => void} */ (esperas.shift())();
  const [, ok] = await Promise.all([defecto, inicio]);
  assert.equal(ok, true);
  const resets = sesion.enviados.filter((m) => m.t === 'reset');
  assert.equal(resets.length, 1);
  assert.equal(resets[0].seed, 55);
  assert.equal(n.estado.nombre, 'Elegido');
  assert.equal(sesion.corriendo, false, 'el arranque por defecto descartado no la pone a correr');
  // y después de un iniciar, arrancarPorDefecto no hace nada aunque no haya mundo
  const s2 = sesionFalsa();
  const n2 = new NucleoCorrida({
    sesion: /** @type {any} */ (s2),
    corridas: crearCorridas({ almacen: almacenMemoria() }),
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: (s) => new Promise((res) => setTimeout(() => res(`' ${s.bot}\nend\n`), 5)),
  });
  const p = n2.iniciar(SOPA, 3);
  await n2.arrancarPorDefecto();
  await p;
  assert.equal(s2.enviados.filter((m) => m.t === 'reset').length, 1);
});

test('sembrar en caliente queda como evento de la corrida y se repite igual', async () => {
  const { sesion, n } = entorno();
  await n.iniciar(SOPA, 1);
  sesion.stats.cycle = 321;
  n.sembrar({ nombre: 'Zeta', adn: 'end', cantidad: 4, color: '#102030', vegetal: false });
  const ev = n.estado.eventos.at(-1);
  assert.deepEqual(ev, {
    ciclo: 321,
    tipo: 'siembra',
    especie: {
      nombre: 'Zeta',
      adn: 'end',
      cantidad: 4,
      color: '#102030',
      vegetal: false,
      energia: 3000,
    },
  });
  const enviado = sesion.enviados.filter((m) => m.t === 'seed-species').at(-1);
  assert.deepEqual(n.mensajesEventos().at(-1), { ciclo: 321, mensajes: [enviado] });
  // la siembra no cambia el escenario efectivo
  assert.deepEqual(n.escenarioEfectivo()?.especies, SOPA.especies);
});

test('escenarioEfectivo usa fusionarCambios (acopladas: Toroidal escribe los dos ejes)', async () => {
  const { sesion, n } = entorno();
  await n.iniciar(SOPA, 1);
  sesion.stats.cycle = 10;
  n.registrarCambio({ 'opt:2': 0 });
  n.registrarCambio({ 'opt:1': 1 });
  const c = /** @type {any} */ (n.escenarioEfectivo()).opciones.cambios;
  assert.equal(c['opt:2'], 1);
  assert.equal(c['opt:3'], 1);
  assert.equal(c['opt:1'], undefined, 'derivada: no se guarda');
});

test('dna-missing: responde con dna-lib (lo sembrado, presets y Bestiary) antes de terminar la carga', async () => {
  const a = entorno();
  await a.n.iniciar(SOPA, 1);
  a.n.sembrar({
    nombre: 'Propio',
    adn: "' mío\nend\n",
    cantidad: 1,
    color: '#aabbcc',
    vegetal: false,
  });
  const r = await a.n.guardar('con adn');
  const b = { sesion: sesionFalsa() }; // una sola corrida sobre esta sesión
  /** @type {string[]} */
  const pedidos = [];
  const nb = new NucleoCorrida({
    sesion: /** @type {any} */ (b.sesion),
    corridas: a.corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async (s) => {
      pedidos.push(s.bot);
      return s.bot === 'Nadie' ? undefined : `' bestiary ${s.bot}\nend\n`;
    },
  });
  // el .dbsim no trae el ADN: el worker lo pide al cargar (antes del 'loaded')
  b.sesion.cargar = () => {
    b.sesion.emitir('dna-missing', {
      names: ['Nadie.txt', 'Alga_Minimalis.txt', 'Propio.txt', 'Alga minimalis 3.0.txt'],
    });
    return Promise.resolve({ cycle: 5, bots: 3, missing: ['Nadie.txt', 'Propio.txt'] });
  };
  await nb.cargar(r.id);
  const libs = b.sesion.enviados.filter((m) => m.t === 'dna-lib');
  assert.equal(libs.length, 1, 'una sola respuesta');
  assert.deepEqual(
    libs[0].entries.map((/** @type {any} */ e) => e.name),
    ['Alga_Minimalis.txt', 'Propio.txt', 'Alga minimalis 3.0.txt'],
  );
  const porNombre = Object.fromEntries(
    libs[0].entries.map((/** @type {any} */ e) => [e.name, e.dna]),
  );
  assert.equal(porNombre['Propio.txt'], "' mío\nend\n", 'la siembra guardada en los eventos');
  assert.match(porNombre['Alga_Minimalis.txt'], /Alga Minimalis/, 'preset de la sim de prueba');
  assert.equal(porNombre['Alga minimalis 3.0.txt'], "' bestiary Alga minimalis 3.0\nend\n");
  assert.deepEqual(pedidos.sort(), ['Alga minimalis 3.0', 'Nadie']);
  assert.equal(nb.estado.ocupado, '');
});

test('importar un archivo que no es un .dbsim: error con clave, sin corrida a medias', async () => {
  const { sesion, n } = entorno();
  sesion.cargar = () => Promise.resolve({ cycle: 0, bots: 0, missing: [] });
  await assert.rejects(
    () => n.importarDbsim(new Uint8Array([1, 2, 3]), 'basura.dbsim'),
    (e) => e instanceof ErrorCorrida && e.clave === 'dbsimInvalido',
  );
  assert.equal(n.estado.nombre, '');
  assert.deepEqual(n.estado.feed, []);
  assert.equal(n.estado.ocupado, '');
  assert.deepEqual(avisoDeError(new ErrorCorrida('dbsimInvalido')), {
    clave: 'observar.aviso.error.dbsimInvalido',
  });
});

test('sinGuardar: pregunta solo si hay algo que perder', async () => {
  const { sesion, n } = entorno();
  assert.equal(n.sinGuardar(), false, 'sin mundo');
  await n.iniciar(SOPA, 1);
  assert.equal(n.sinGuardar(), false, 'recién iniciada');
  sesion.stats.cycle = 120;
  assert.equal(n.sinGuardar(), true);
  await n.guardar('g');
  assert.equal(n.sinGuardar(), false, 'recién guardada');
  n.registrarCambio({ 'opt:33': 1 });
  assert.equal(n.sinGuardar(), true, 'un cambio en caliente');
});

test('avisoDeError: claves por tipo de error, nunca el mensaje técnico', () => {
  assert.deepEqual(avisoDeError(new ErrorConexion('tiempo')), {
    clave: 'observar.aviso.error.conexion.tiempo',
  });
  assert.deepEqual(avisoDeError(new ErrorConexion('sin-respuesta')), {
    clave: 'observar.aviso.error.conexion.sinRespuesta',
  });
  assert.deepEqual(avisoDeError(new ErrorConexion('rara')), {
    clave: 'observar.aviso.error.conexion.otro',
  });
  const cuota = new Error('x');
  cuota.name = 'QuotaExceededError';
  assert.deepEqual(avisoDeError(cuota), { clave: 'observar.aviso.error.cuota' });
  assert.deepEqual(avisoDeError(new ErrorAlmacen('version-vieja')), {
    clave: 'observar.aviso.error.almacen.versionVieja',
  });
  assert.deepEqual(avisoDeError(new ErrorCorrida('inexistente', 'c-1')), {
    clave: 'observar.aviso.error.inexistente',
  });
  assert.deepEqual(avisoDeError(new Error('corrida inexistente: c-1')), {
    clave: 'observar.aviso.error.desconocido',
  });
  // todas existen en es y en
  const dic = (/** @type {string} */ l) =>
    JSON.parse(readFileSync(new URL(`../src/i18n/${l}/observar.json`, import.meta.url), 'utf8'));
  for (const l of ['es', 'en'])
    for (const k of CLAVES_ERROR) assert.ok(Object.hasOwn(dic(l), k), `${l}: ${k}`);
});

test('registrarCambio con el ciclo exacto (aplicarEnCiclo); nunca antes del último evento', async () => {
  const { sesion, n } = entorno();
  await n.iniciar(SOPA, 1);
  sesion.stats.cycle = 100; // la página va atrasada
  n.registrarCambio({ 'opt:33': 1 }, 137);
  n.registrarCambio({ 'opt:34': 900 }, 120);
  assert.deepEqual(
    n.estado.eventos.map((e) => e.ciclo),
    [137],
    'el atrasado va al mismo ciclo que el último',
  );
  // con aplicarEnCiclo, sembrar registra en el ciclo que confirma el worker
  /** @type {any} */ (sesion).aplicarEnCiclo = async (/** @type {any[]} */ msgs) => {
    sesion.enviados.push(...msgs);
    return 150;
  };
  await n.sembrar({ nombre: 'Z', adn: 'end', cantidad: 1, color: '#010203', vegetal: false });
  assert.equal(n.estado.eventos.at(-1)?.ciclo, 150);
  assert.equal(n.estado.eventos.at(-1)?.tipo, 'siembra');
  assert.equal(sesion.enviados.at(-1).t, 'seed-species');
});
