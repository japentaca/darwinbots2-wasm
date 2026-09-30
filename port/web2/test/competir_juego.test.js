// @ts-check
// Competir en la página (N3.5, correcciones de la revisión): lo puro de
// src/lib/competir/juego.js, sin wasm ni DOM.
//   - cancelar una ronda libera la temporada con el estado FRESCO del
//     trabajo: en la dueña de la cola (aunque su lista() siga en caché
//     diciendo «corriendo») y en otra pestaña (lee el almacén);
//   - «Jugar y mirar»: la marca del partido detecta que otra cosa tomó la
//     sim y que la corrida recibió cambios en caliente (registrarCambio,
//     siembra, objetos, un setopt o un reset por fuera de la corrida),
//     también en el camino de respaldo (reglas que no caben en un escenario);
//   - el roster del Contest viejo: 'preset' como la clásica (PRESETS de
//     port/web/index.html), híbridos entre los propios, 'form' con su ADN;
//   - el escenario efectivo de las reglas para Experimentar;
//   - textoError: errores con código traducidos y la opción desconocida sin «()».
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { almacenMemoria, ErrorAlmacen } from '../engine/almacen.js';
import { ColaCompartida, ST_TRABAJOS } from '../engine/cola.js';
import { crearCorridas } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { ErrorEscenario } from '../engine/escenarios/index.js';
import * as LG from '../engine/league.js';
import { planPartido } from '../engine/partido.js';
import { ErrorInforme } from '../engine/report/textos.js';
import {
  escenarioDelPartido,
  ID_ESCENARIO_PARTIDO,
  lanzamiento,
  mensajesDelPlan,
  reglasDeEscenario,
  TIPO_RONDA,
} from '../engine/rondas.js';
import { crearTorneos, ST_TORNEOS } from '../engine/torneos.js';
import { juntarAreas, traducir } from '../src/i18n/core.js';
import {
  adnRosterViejo,
  escenarioDeReglas,
  estadoTrabajo,
  ID_REGLAS_TORNEO,
  liberarSiCancelada,
  marcaPartido,
  presetsClasica,
  vigiaPartido,
} from '../src/lib/competir/juego.js';
import { textoError } from '../src/lib/competir/textos.js';
import { estadoVacio, NucleoCorrida } from '../src/lib/sim/corrida-nucleo.js';
import { especiesPrueba } from '../src/lib/sim/prueba.js';
import { rng } from './util/clasica-vm.js';
import { depsDePrueba } from './util/torneos-deps.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- Rondas canceladas ---------------------------------------------------------------

/** Un torneo rr guardado de 4 participantes, con su ronda armada. @param {any} almacen */
async function torneoConRonda(almacen) {
  let k = 0;
  const T = crearTorneos(
    depsDePrueba({ almacen, nuevoId: () => `T${++k}`, azar: rng(5), lanzar: () => {} }),
  );
  await T.lgLoadAll();
  const L = await T.lgCreate({});
  await T.lgSetFmt('format', 'rr');
  for (let i = 0; i < 4; i++)
    await T.lgAdd({ name: `E${i}`, dna: `cond start ${i} .up store stop end`, src: 'form' });
  const r = /** @type {any} */ (await T.lgRonda());
  assert.ok(r?.n >= 2);
  return { T, L, r };
}

/** Ejecutor de ronda que no termina nunca (hasta que lo abortan). */
const ejecutorColgado = {
  reintentable: false,
  unidad: (/** @type {any} */ _t, /** @type {number} */ _i, /** @type {any} */ ctx) =>
    new Promise((_res, rej) =>
      ctx.senal.addEventListener('abort', () => rej(new Error('abortada'))),
    ),
  final: () => ({}),
  vista: (/** @type {any} */ p) => p,
};

/** @param {any} almacen @param {string} id */
const marcaGuardada = async (almacen, id) =>
  /** @type {any} */ (LG.lgSeason(await almacen.get(ST_TORNEOS, id))).ronda;

test('cancelar una ronda en la dueña libera la temporada aunque lista() siga en caché', async () => {
  const almacen = almacenMemoria();
  const { T, L, r } = await torneoConRonda(almacen);
  let k = 0;
  const c = new ColaCompartida({
    almacen,
    ejecutores: { [TIPO_RONDA]: ejecutorColgado },
    nuevoId: () => `J${++k}`,
    guardarCadaMs: 0,
    refrescoMs: 200,
  });
  await c.iniciar();
  await c.esperarDuena();
  const id = await c.encolar({ tipo: TIPO_RONDA, params: r.params, unidades: r.n });
  await new Promise((s) => setTimeout(s, 300));
  assert.equal(c.lista().find((x) => x.id === id)?.estado, 'corriendo');
  await c.cancelar(id);
  // lo que veía la revisión: la lista en caché sigue en «corriendo» y
  // lgReconciliarRondas no libera nada
  assert.equal(c.lista().find((x) => x.id === id)?.estado, 'corriendo');
  assert.equal(await estadoTrabajo(c, almacen, id), 'cancelado');
  const libre = await liberarSiCancelada({
    torneos: T,
    cola: c,
    almacen,
    trabajo: id,
    ronda: r.params.ronda,
    league: L.id,
  });
  assert.equal(libre, true);
  assert.equal(/** @type {any} */ (LG.lgSeason(/** @type {any} */ (T.lg.cur))).ronda, undefined);
  assert.equal(await marcaGuardada(almacen, L.id), undefined);
  c.detener();
});

test('cancelar una ronda desde otra pestaña: lee el estado del almacén y libera', async () => {
  const almacen = almacenMemoria();
  const { L, r } = await torneoConRonda(almacen);
  // otra pestaña (B): su propio estado de torneos, sin la cola local
  const B = crearTorneos(depsDePrueba({ almacen, azar: rng(6) }));
  await B.lgLoadAll();
  await B.lgSelect(/** @type {any} */ (B.lgFind(L.id)));
  const colaB = { cola: null };
  const base = { tipo: TIPO_RONDA, params: { ronda: r.params.ronda }, unidades: [] };
  // sigue corriendo (el cancelar no llegó): no libera
  await almacen.put(ST_TRABAJOS, { ...base, id: 'J1', estado: 'corriendo' });
  const o = { torneos: B, cola: colaB, almacen, ronda: r.params.ronda, league: L.id };
  assert.equal(await liberarSiCancelada({ ...o, trabajo: 'J1' }), false);
  assert.ok(await marcaGuardada(almacen, L.id));
  // terminado: tampoco (lo registra lgReconciliarRondas)
  await almacen.put(ST_TRABAJOS, { ...base, id: 'J1', estado: 'terminado' });
  assert.equal(await liberarSiCancelada({ ...o, trabajo: 'J1' }), false);
  // la dueña lo canceló (y lo guardó): B libera la temporada
  await almacen.put(ST_TRABAJOS, { ...base, id: 'J1', estado: 'cancelado' });
  assert.equal(await liberarSiCancelada({ ...o, trabajo: 'J1' }), true);
  assert.equal(await marcaGuardada(almacen, L.id), undefined);
  assert.equal(/** @type {any} */ (LG.lgSeason(/** @type {any} */ (B.lg.cur))).ronda, undefined);
});

test('ronda con el trabajo fallido o ya borrado: se libera', async () => {
  for (const estado of ['fallido', null]) {
    const almacen = almacenMemoria();
    const { T, L, r } = await torneoConRonda(almacen);
    if (estado)
      await almacen.put(ST_TRABAJOS, { id: 'J9', tipo: TIPO_RONDA, estado, unidades: [] });
    const libre = await liberarSiCancelada({
      torneos: T,
      cola: { cola: null },
      almacen,
      trabajo: 'J9',
      ronda: r.params.ronda,
      league: L.id,
    });
    assert.equal(libre, true, String(estado));
    assert.equal(await marcaGuardada(almacen, L.id), undefined);
  }
});

// ---- Jugar y mirar: la marca del partido ---------------------------------------------

/** Sesión simulada con el objeto `opciones` que cambia como el de la página. */
function sesionFalsa() {
  /** @type {Map<string, ((m: any) => void)[]>} */
  const oyentes = new Map();
  const s = {
    stats: { cycle: 0, bots: 0 },
    corriendo: false,
    hayMundo: false,
    /** @type {any} */
    opciones: null,
    c: {
      /** @param {string} t @param {(m: any) => void} cb */
      on(t, cb) {
        oyentes.set(t, [...(oyentes.get(t) ?? []), cb]);
        return () => {};
      },
      enviar: () => {},
      seedSpecies: () => {},
      dnaLib: () => {},
    },
    /** @param {any} o */
    reset(o) {
      s.opciones = o.options;
      s.hayMundo = true;
    },
    /** @param {number} id @param {number} v */
    setopt(id, v) {
      s.opciones = { ...s.opciones, opts: { ...s.opciones.opts, [id]: v } };
    },
    /** @param {boolean} on */
    correr(on) {
      s.corriendo = on;
    },
    seleccionar: () => {},
  };
  return s;
}

function corridaFalsa() {
  const sesion = sesionFalsa();
  const n = new NucleoCorrida({
    sesion: /** @type {any} */ (sesion),
    corridas: crearCorridas({ almacen: almacenMemoria() }),
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async (s) => `' ADN de ${s.bot}\nend\n`,
    miniatura: () => '',
    descargar: () => {},
  });
  return { n, sesion };
}

const LUCHADORES = [
  { name: 'Uno', dna: 'cond start 10 .up store stop end', color: '#ff4040', qty: 3 },
  { name: 'Dos', dna: 'cond start 5 .aimdx store stop end', color: '#3d9bff', qty: 2 },
];
const VALORES = { nrg: 3000, rounds: 5, wins: 3, cap: 5000, capMode: 'pop', popCap: 500 };

/** Lanza el partido como lanzar() de torneos.svelte.js (los dos caminos). @param {any} plan */
async function lanzarComoLaPagina(plan) {
  const { n, sesion } = corridaFalsa();
  const l = lanzamiento(plan);
  if (l) assert.equal(await n.iniciar(l.escenario, l.semilla), true);
  else {
    const aprox = escenarioDelPartido({ ...plan, rules: {} });
    assert.equal(await n.iniciar(aprox, plan.seed), true);
    for (const m of mensajesDelPlan(plan))
      if (m.t === 'reset') {
        const { t: _t, ...r } = m;
        sesion.reset(r);
      }
  }
  return { n, sesion, marca: marcaPartido(n.estado, sesion) };
}

test('vigía: cambios en caliente alteran el partido; otra corrida lo toma', async () => {
  const plan = planPartido(
    LUCHADORES,
    VALORES,
    99,
    reglasDeEscenario(escenarioFabrica('partido-f1')),
  );
  // sin tocar: sigue
  {
    const { n, sesion, marca } = await lanzarComoLaPagina(plan);
    assert.equal(marca.escenario, ID_ESCENARIO_PARTIDO);
    assert.equal(marca.semilla, 99);
    assert.equal(vigiaPartido(marca, n.estado, sesion), 'sigue');
    // guardar objetos en el escenario (sin cambiarlos) no altera nada
    n.guardarObjetosEnEscenario();
    assert.equal(vigiaPartido(marca, n.estado, sesion), 'sigue');
  }
  // un cambio en caliente registrado (Experimentar → «Aplicar a la actual»)
  {
    const { n, sesion, marca } = await lanzarComoLaPagina(plan);
    n.registrarCambio({ 'opt:11': 180 });
    assert.equal(vigiaPartido(marca, n.estado, sesion), 'alterada');
  }
  // una siembra en caliente
  {
    const { n, sesion, marca } = await lanzarComoLaPagina(plan);
    await n.sembrar({
      nombre: 'Intruso',
      adn: 'end',
      cantidad: 3,
      color: '#123456',
      vegetal: false,
    });
    assert.equal(vigiaPartido(marca, n.estado, sesion), 'alterada');
  }
  // una orden de objeto en caliente (barra «Mundo»)
  {
    const { n, sesion, marca } = await lanzarComoLaPagina(plan);
    await n.aplicarObjetos({ tipo: 'forma', ancho: 0.1, alto: 0.1 });
    assert.equal(vigiaPartido(marca, n.estado, sesion), 'alterada');
  }
  // un setopt suelto en la sesión (sin pasar por la corrida)
  {
    const { n, sesion, marca } = await lanzarComoLaPagina(plan);
    sesion.setopt(11, 1);
    assert.equal(vigiaPartido(marca, n.estado, sesion), 'alterada');
  }
  // otra corrida (Inicio, Experimentar): tomada
  {
    const { n, sesion, marca } = await lanzarComoLaPagina(plan);
    assert.equal(
      await n.iniciar(/** @type {any} */ (escenarioFabrica('sopa-primordial')), 5),
      true,
    );
    assert.equal(vigiaPartido(marca, n.estado, sesion), 'tomada');
  }
});

test('vigía en el camino de respaldo: corrida con el partido y marca propia', async () => {
  // una foto de la clásica que no cabe en un escenario (campo fuera del tope)
  const raro = planPartido(LUCHADORES, VALORES, 77, { 'o-fw': '99999999' });
  assert.equal(lanzamiento(raro), null);
  const { n, sesion, marca } = await lanzarComoLaPagina(raro);
  // Observar muestra el partido (no la corrida anterior)
  assert.equal(n.estado.escenario?.id, ID_ESCENARIO_PARTIDO);
  assert.equal(n.estado.semilla, 77);
  assert.deepEqual(
    n.estado.escenario?.especies.slice(1).map((e) => e.bot),
    ['Uno', 'Dos'],
  );
  // el mundo es el de mensajesDelPlan: su reset (limpio) fue el último
  const reset = /** @type {any} */ (mensajesDelPlan(raro).find((m) => m.t === 'reset'));
  assert.equal(reset.limpio, true);
  assert.deepEqual(sesion.opciones, reset.options);
  assert.equal(vigiaPartido(marca, n.estado, sesion), 'sigue');
  n.registrarCambio({ 'opt:11': 180 });
  assert.equal(vigiaPartido(marca, n.estado, sesion), 'alterada');
  // otro reset por fuera de la corrida (antes no se detectaba): alterada
  const otra = await lanzarComoLaPagina(raro);
  otra.sesion.reset({ options: { opts: {} } });
  assert.equal(vigiaPartido(otra.marca, otra.n.estado, otra.sesion), 'alterada');
});

// ---- Roster del Contest viejo --------------------------------------------------------

/** PRESETS de port/web/index.html (el ADN de cada uno). */
function presetsDeLaClasica() {
  const html = fs.readFileSync(path.join(RAIZ, '..', 'web', 'index.html'), 'utf8');
  /** @param {string} k */
  const adn = (k) => {
    const m = html.match(new RegExp(`\\n  ${k}: \\{[\\s\\S]*?dna: \`([\\s\\S]*?)\`\\}`));
    assert.ok(m, k);
    return m[1];
  };
  return { animal: adn('animal'), alga: adn('alga') };
}

test('roster del Contest: preset como la clásica, híbridos entre los propios, form', async () => {
  const P = presetsClasica(especiesPrueba()[0].dna);
  const clasica = presetsDeLaClasica();
  assert.equal(P.animal.dna, clasica.animal);
  assert.equal(P.alga.dna, clasica.alga);
  /** @type {string[]} */
  const pedidos = [];
  const d = {
    foro: async (/** @type {string} */ f) => {
      pedidos.push(f);
      return `adn de ${f}`;
    },
    propios: async () => [
      { clase: 'foro', nombre: 'Mezcla', adn: 'no' },
      { clase: 'propio', nombre: 'Mezcla', adn: 'adn híbrido' },
    ],
    presets: P,
  };
  assert.equal(
    await adnRosterViejo({ name: 'A', src: 'preset', file: 'animal' }, d),
    clasica.animal,
  );
  assert.equal(await adnRosterViejo({ name: 'B', src: 'preset', file: 'alga' }, d), clasica.alga);
  assert.equal(
    await adnRosterViejo({ name: 'C', src: 'bestiary', file: 'x.txt' }, d),
    'adn de x.txt',
  );
  assert.deepEqual(pedidos, ['x.txt']);
  assert.equal(
    await adnRosterViejo({ name: 'D', src: 'hybrid', file: 'Mezcla' }, d),
    'adn híbrido',
  );
  assert.equal(await adnRosterViejo({ name: 'E', src: 'form', dna: 'mi adn' }, d), 'mi adn');
  await assert.rejects(adnRosterViejo({ name: 'F', src: 'hybrid', file: 'Otro' }, d));
  await assert.rejects(adnRosterViejo({ name: 'G', src: 'preset', file: 'zzz' }, d));
  await assert.rejects(adnRosterViejo({ name: 'H', src: 'form' }, d));

  // lgMigrateRoster con esa resolución: los presets ya no se pierden
  /** @type {Record<string, string>} */
  const store = {
    [LG.LG_OLD_ROSTER_KEY]: JSON.stringify([
      { name: 'Animal_Minimalis', src: 'preset', file: 'animal', qty: 5, color: '#ff4040' },
      { name: 'Mezcla', src: 'hybrid', file: 'Mezcla' },
      { name: 'Perdido', src: 'form' },
    ]),
  };
  const kv = {
    get: (/** @type {string} */ k) => store[k] ?? null,
    set: (/** @type {string} */ k, /** @type {string} */ v) => (store[k] = v),
  };
  const T = crearTorneos(depsDePrueba({ almacen: almacenMemoria(), azar: rng(1), kv }));
  const S0 = T.lgScratch();
  const r = await T.lgMigrateRoster(S0, (x) => adnRosterViejo(x, d));
  assert.deepEqual(r, { added: 2, lost: 1 });
  assert.deepEqual(
    LG.lgSeason(S0).entrants.map((e) => [e.name, e.dna]),
    [
      ['Animal_Minimalis', clasica.animal],
      ['Mezcla', 'adn híbrido'],
    ],
  );
});

// ---- Reglas → Experimentar -----------------------------------------------------------

test('escenario de las reglas: reglas-escenario tal cual, foto de la clásica sin modo F1', () => {
  const f1 = /** @type {any} */ (escenarioFabrica('partido-f1'));
  const e1 = escenarioDeReglas(reglasDeEscenario(f1), { es: 'x', en: 'x' });
  assert.equal(e1.id, f1.id);
  assert.deepEqual(e1.especies, []);
  assert.deepEqual(e1.opciones, f1.opciones);
  const e2 = escenarioDeReglas({ 'o-fsize': '3', 'o-12': '0.5' }, { es: 'Reglas', en: 'Rules' });
  assert.equal(e2.id, ID_REGLAS_TORNEO);
  assert.equal(e2.opciones.base, 'clasica');
  assert.equal(e2.opciones.cambios['opt:12'], 0.5);
  for (const k of ['opt:91', 'opt:97', 'opt:98']) assert.equal(k in e2.opciones.cambios, false, k);
  assert.deepEqual(e2.especies, []);
  assert.throws(
    () => escenarioDeReglas({ 'o-fw': '99999999' }, { es: 'x', en: 'x' }),
    ErrorEscenario,
  );
});

// ---- Errores por código ------------------------------------------------------------------

test('textoError: errores con código en es y en; opción desconocida sin «()»', () => {
  const dics = juntarAreas(
    ['es', 'en'].map((idioma) => ({
      idioma,
      area: 'competir',
      dic: JSON.parse(
        fs.readFileSync(path.join(RAIZ, 'src', 'i18n', idioma, 'competir.json'), 'utf8'),
      ),
    })),
  );
  for (const idioma of ['es', 'en']) {
    const tr = {
      t: (/** @type {string} */ c, /** @type {any} */ p) => {
        assert.ok(Object.hasOwn(dics[idioma], c), `${idioma}: falta ${c}`);
        return traducir(dics, idioma, c, p);
      },
      num: (/** @type {number} */ n) => String(n),
    };
    const casos = [
      new LG.ErrorLiga('rule-unknown', {}),
      new LG.ErrorLiga('rule-unknown', { clave: 'opt:999' }),
      new ErrorEscenario('invalido', [{ codigo: 'rango', ruta: 'opciones.cambios.base:fieldW' }]),
      new ErrorEscenario('semilla'),
      new ErrorAlmacen('version-vieja', 'x'),
      new ErrorAlmacen('sin-indexeddb'),
      new ErrorInforme('falta-torneo'),
    ];
    for (const e of casos) {
      const s = textoError(e, tr);
      assert.doesNotMatch(s, /\(\)|\{\w+\}|competir\./, `${idioma}: ${s}`);
      assert.notEqual(s, e.message, `${idioma}: sin traducir ${s}`);
    }
    assert.match(textoError(casos[1], tr), /opt:999/);
    assert.match(textoError(casos[2], tr), /base:fieldW/);
  }
});
