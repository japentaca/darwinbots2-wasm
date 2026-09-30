// @ts-check
// La corrida con las muestras del worker (N2.1): historia (engine/history.js)
// y linaje (engine/lineage.js) alimentados por {t:'muestra'}, correlación
// del muestreo, panel por nombre con la vista clásica, y guardar/cargar la
// historia y el linaje en corridas-datos (C14). Primero con una sesión
// simulada; después con engine/worker.js real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { crearCorridas } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { IE, IM, N_ESPECIE, N_LINAJE, N_METRICAS } from '../engine/metricas.js';
import { estadoVacio, NucleoCorrida } from '../src/lib/sim/corrida-nucleo.js';
import { MUESTREO_CORRIDA } from '../src/lib/sim/metricas.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';
import { sesionNode } from './util/sesion-node.js';

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
    /** @param {number} n */
    seleccionar: (n) => enviados.push({ t: 'select', n }),
    /** @param {any} b */
    cargar(b) {
      s.hayMundo = true;
      enviados.push({ t: 'load', bytes: new Uint8Array(b) });
      return Promise.resolve({ cycle: 300, bots: 5, missing: [] });
    },
    guardarConCiclo: async () => ({ bytes: new Uint8Array([1, 2, 3]), cycle: s.stats.cycle }),
    guardar: async () => new Uint8Array([1, 2, 3]),
    /** @param {string} t @param {any} m */
    emitir(t, m) {
      for (const cb of oyentes.get(t) ?? []) cb(m);
    },
  };
  return s;
}

/** @param {ReturnType<typeof sesionFalsa>} sesion @param {ReturnType<typeof crearCorridas>} corridas */
function nucleo(sesion, corridas) {
  return new NucleoCorrida({
    sesion: /** @type {any} */ (sesion),
    corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async (s) => `' ${s.bot}\nend\n`,
    muestreo: MUESTREO_CORRIDA,
  });
}

/**
 * {t:'muestra'} armada a mano.
 * @param {string} req @param {number} ciclo @param {Record<string, number>} especies
 * @param {{linaje?: [number, number, number][]}} [o]
 */
function muestra(req, ciclo, especies, o = {}) {
  const metrics = new Float32Array(N_METRICAS);
  metrics[IM.ciclo] = ciclo;
  const nombres = Object.keys(especies).map((k) => `${k}.txt`);
  const lista = Object.entries(especies).map(([nombre, n], i) => {
    const stats = new Float32Array(N_ESPECIE);
    stats[IE.indice] = i;
    stats[IE.vivos] = n;
    stats[IE.genMax] = ciclo / 100;
    stats[IE.color] = 0x0000ff * (i + 1);
    metrics[IM.vivos] += n;
    return { nombre: `${nombre}.txt`, indice: i, stats };
  });
  let linaje = null;
  if (o.linaje) {
    const filas = new Int32Array(o.linaje.length * N_LINAJE);
    o.linaje.forEach(([abs, parent, sp], i) => {
      filas.set([abs, parent, sp, 0, 0, 0, 10, 0, 0, 0, 1, 0], i * N_LINAJE);
    });
    linaje = { filas, nacidos: new Int32Array(0), origen: new Int32Array(0), nombres };
  }
  return { t: 'muestra', req, ciclo, metrics, especies: lista, comportamiento: [], linaje };
}

const SOPA = /** @type {any} */ (escenarioFabrica('sopa-primordial'));

test('iniciar pide el muestreo (tras el select) y solo acepta las muestras de ese pedido', async () => {
  const s = sesionFalsa();
  const n = nucleo(s, crearCorridas({ almacen: almacenMemoria() }));
  await n.iniciar(SOPA, 1);
  const i = s.enviados.findIndex((m) => m.t === 'muestreo');
  assert.ok(i > 0);
  assert.equal(s.enviados[i - 1].t, 'select');
  const pedido = s.enviados[i];
  assert.equal(pedido.cada, 100);
  assert.equal(pedido.grupos.length, 6);
  s.emitir('muestra', muestra('otro', 0, { Viejo: 9 }));
  assert.equal(n.historia.puntos, 0, 'de una sim anterior');
  s.emitir('muestra', muestra(pedido.req, 0, { Alga: 10, Animal: 3 }));
  s.emitir('muestra', muestra(pedido.req, 100, { Alga: 12, Animal: 1 }));
  s.emitir('muestra', muestra(pedido.req, 200, { Alga: 12 }));
  assert.deepEqual(
    n.estado.muestras.map((m) => [m.ciclo, m.total]),
    [
      [0, 13],
      [100, 13],
      [200, 12],
    ],
  );
  assert.deepEqual(n.estado.muestras[1].especies, { Alga: 12, Animal: 1 });
  assert.ok(
    n.estado.feed.some(
      (e) => e.tipo === 'extincion' && e.params.especie === 'Animal' && e.ciclo === 200,
    ),
  );
  // otro iniciar: nueva correlación, lo viejo se descarta
  await n.iniciar(SOPA, 2);
  const pedido2 = s.enviados.filter((m) => m.t === 'muestreo').at(-1);
  assert.notEqual(pedido2.req, pedido.req);
  s.emitir('muestra', muestra(pedido.req, 300, { Alga: 1 }));
  assert.equal(n.historia.puntos, 0);
});

test('vista clásica: especies, extinciones y generación por nombre desde las muestras; colores de la sim', async () => {
  const s = sesionFalsa();
  const n = nucleo(s, crearCorridas({ almacen: almacenMemoria() }));
  await n.iniciar(SOPA, 1);
  const req = s.enviados.filter((m) => m.t === 'muestreo').at(-1).req;
  s.emitir('muestra', muestra(req, 0, { Alga: 10, Zeta: 2 }));
  s.emitir('muestra', muestra(req, 100, { Alga: 11 }));
  // un frame de la vista clásica (grupos por color: no son especies)
  n.ingerir({
    ciclo: 150,
    vivos: 11,
    vegetales: 11,
    nrgMedia: 900,
    genMax: Number.NaN,
    genEspecie: '',
    rica: false,
    especies: { '#30d030': { n: 11, color: 1 } },
  });
  const v = /** @type {any} */ (n.estado.vivo);
  assert.equal(v.porEspecie, true);
  assert.deepEqual(v.especies, [{ nombre: 'Alga', n: 11 }]);
  assert.equal(v.extinguidas, 1, 'Zeta tuvo bots y ya no');
  assert.equal(v.genMax, 1);
  assert.equal(v.genEspecie, 'Alga');
  assert.ok(n.estado.colores.Zeta, 'color de la especie sembrada fuera del escenario');
  assert.equal(n.estado.colores['#30d030'], undefined);
});

test('guardar → cargar: historia y linaje a corridas-datos, recortados; la carga los retoma', async () => {
  const s = sesionFalsa();
  const corridas = crearCorridas({ almacen: almacenMemoria() });
  const n = nucleo(s, corridas);
  await n.iniciar(SOPA, 5);
  const req = s.enviados.filter((m) => m.t === 'muestreo').at(-1).req;
  for (let c = 0; c <= 400; c += 100)
    s.emitir(
      'muestra',
      muestra(
        req,
        c,
        { Alga: 5 + c / 100 },
        {
          linaje: [
            [1, 0, 0],
            [2 + c / 100, 1, 0],
          ],
        },
      ),
    );
  assert.equal(n.linaje.vivos.size, 2);
  s.stats.cycle = 300; // el .dbsim es del ciclo 300
  const r = await n.guardar('con historia');
  const g = /** @type {any} */ (await corridas.cargar(r.id));
  assert.deepEqual(Array.from(g.extra.historia.t), [0, 100, 200, 300]);
  assert.ok(g.extra.linaje.individuos instanceof Int32Array);
  assert.equal(n.historia.puntos, 5, 'en memoria sigue todo');

  // otra página: carga la corrida
  const s2 = sesionFalsa();
  const n2 = nucleo(s2, corridas);
  await n2.cargar(r.id);
  const i = s2.enviados.findIndex((m) => m.t === 'load');
  assert.equal(s2.enviados[i + 1].t, 'select');
  assert.equal(s2.enviados[i + 2].t, 'muestreo');
  assert.equal(n2.historia.puntos, 4);
  assert.deepEqual(
    n2.estado.muestras.map((m) => m.ciclo),
    [0, 100, 200, 300],
  );
  // la primera muestra de la sim cargada (ciclo 300) es el punto de partida
  const req2 = s2.enviados[i + 2].req;
  s2.emitir('muestra', muestra(req2, 300, { Alga: 42 }));
  assert.deepEqual(n2.historia.t, [0, 100, 200, 300]);
  assert.equal(n2.estado.muestras.at(-1)?.total, 42, 'reemplaza el punto del ciclo de la carga');
  s2.emitir('muestra', muestra(req2, 400, { Alga: 43 }));
  assert.equal(n2.historia.puntos, 5);
  assert.ok(n2.linaje.individuos.size >= 1);
});

// ---- con el worker real -------------------------------------------------------

const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
/** @param {{bot: string}} s */
const adnBestiario = async (s) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};

test('worker real: vista clásica, historia por especie, guardar y retomar', {
  skip: hayWasm() ? false : SIN_WASM,
  timeout: 300000,
}, async () => {
  const sesion = await sesionNode({ fechaFija: Date.UTC(2026, 8, 29), semillaAzar: 5 });
  const s2 = await sesionNode({ fechaFija: Date.UTC(2026, 8, 29), semillaAzar: 6 });
  try {
    const corridas = crearCorridas({ almacen: almacenMemoria() });
    const mk = (/** @type {any} */ ses) =>
      new NucleoCorrida({
        sesion: ses,
        corridas,
        estado: estadoVacio(),
        idioma: () => 'es',
        adnDe: adnBestiario,
        muestreo: MUESTREO_CORRIDA,
      });
    const n = mk(sesion);
    sesion.c.view(false); // vista clásica
    await n.iniciar(SOPA, 31);
    sesion.pasos(1000);
    const { cycle } = await sesion.guardarConCiclo(); // barrera
    assert.equal(cycle, 999, 'el core arranca en −1');
    const nombres = n.historia.nombresEspecies();
    assert.ok(nombres.includes('Alga minimalis 3.0'), nombres.join(','));
    assert.ok(n.historia.puntos >= 10);
    const ult = /** @type {any} */ (n.estado.muestras.at(-1));
    assert.ok(Object.keys(ult.especies).length >= 1, 'por especie con la vista clásica');
    assert.ok(n.estado.colores['Alga minimalis 3.0']);
    assert.ok(n.linaje.vivos.size > 0);
    assert.ok(n.linaje.fotos.size > 0, 'foto del ADN dominante');
    const r = await n.guardar('real');

    const n2 = mk(s2);
    await n2.cargar(r.id);
    s2.pasos(300);
    await s2.guardarConCiclo();
    assert.ok(n2.historia.puntos >= n.historia.puntos, 'retoma y sigue');
    assert.equal(n2.historia.ultimoCiclo, 1200, 'muestras en los múltiplos de 100');
    assert.ok(n2.historia.t.includes(999), 'el punto de partida de la carga');
    for (let i = 1; i < n2.historia.t.length; i++)
      assert.ok(n2.historia.t[i] > n2.historia.t[i - 1]);
  } finally {
    sesion.cerrar();
    s2.cerrar();
  }
});
