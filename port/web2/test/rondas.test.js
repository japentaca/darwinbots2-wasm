// @ts-check
// Motor de Competir (paso N3.4; decisiones 17, 21, 22 y 23), sin wasm:
//   - partidosDeRonda: el primero es siempre lgFixture; la ronda de cada
//     formato; jugar por rondas (resultados sintéticos, función de los
//     luchadores y la semilla) da los MISMOS partidos (cruces, semillas,
//     números) que jugar en secuencia con lgPlayNext, en los seis formatos;
//     con nulos, la temporada termina igual y nada se registra fuera de
//     orden.
//   - lgRonda / lgRegistrarRonda / lgRondaCancelar: marca, bloqueo, registro
//     idempotente, liga cerrada.
//   - reglas bloqueadas desde el primer partido (lgSetRules, lgSetFmt).
//   - escenario efectivo: las opciones del reset son las de la clásica
//     (salvo el campo Toroidal del .dbsim), reglas-escenario, caída a
//     mensajesPartido, repeticionDe; mensajesPartido con `limpio`.
//   - Salón de la fama global.
//   - migración de darwinbots-ligas; imports v1/v2 y reglas-escenario en el
//     archivo; participantes e inventario desde la Biblioteca.
// La paridad de resultados con el worker real está en
// test/rondas_worker.test.js.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar, ErrorEscenario } from '../engine/escenarios/index.js';
import * as LG from '../engine/league.js';
import { CLAVE_MIGRACION_LIGAS, migrarLigas, transformarLigas } from '../engine/migracion.js';
import {
  mensajesPartido,
  planPartido,
  reglasAOpciones,
  siembraArranque,
} from '../engine/partido.js';
import {
  BOT_ALGA,
  cambiosDeOpciones,
  escenarioDelPartido,
  esReglasEscenario,
  inventarioDeBiblioteca,
  lanzamiento,
  mensajesDelPlan,
  mensajesF1,
  opcionesBaseClasica,
  participantesDeEntradas,
  partidosDeRonda,
  reglasBloqueadas,
  reglasDeEscenario,
  repeticionDe,
  resumenRonda,
  vbColorACss,
  vistaParamsRonda,
} from '../engine/rondas.js';
import { crearTorneos, lgSalonGlobal } from '../engine/torneos.js';
import { clasica, plano, rng } from './util/clasica-vm.js';
import { depsDePrueba } from './util/torneos-deps.js';

/** @param {string} name */
const ent = (name) => ({
  name,
  dna: `cond start ${name.length} .up store stop end ' ${name}`,
  hash: LG.lgHash(`cond start ${name.length} .up store stop end ' ${name}`),
  src: 'form',
  file: '',
  color: '#ffffff',
});
/** @param {number} n */
const ents = (n) => Array.from({ length: n }, (_, i) => ent(`E${i}`));

// ---- Resultado sintético (función de los luchadores y la semilla) ---------------------
/**
 * @param {string[]} names @param {number} seed @param {boolean} [nulos]
 * @returns {{winner: string, note: string, f1: any, cycles: number, capRounds: number}}
 */
function sintetico(names, seed, nulos = false) {
  if (nulos && seed % 5 === 0)
    return {
      winner: '',
      note: 'void: only one species in the census',
      f1: null,
      cycles: 0,
      capRounds: 0,
    };
  const w = seed % names.length;
  return {
    winner: names[w],
    note: '',
    f1: {
      sp: names.map((name, i) => ({
        name,
        wins: i === w ? 3 : seed % 2,
        capWins: i === w ? 1 : 0,
      })),
    },
    cycles: 100 + (seed % 900),
    capRounds: seed % 3,
  };
}
/** Los mensajes del worker que darían ese resultado. @param {ReturnType<typeof sintetico>} r */
const mensajesDe = (r) =>
  r.winner
    ? [
        { t: 'f1-started', n: 2 },
        ...Array.from({ length: r.capRounds }, () => ({ t: 'f1-note', kind: 'cap' })),
        { t: 'f1-over', winner: r.winner, f1: r.f1, cycles: r.cycles },
      ]
    : [
        { t: 'f1-started', n: 2 },
        { t: 'f1-note', kind: 'single' },
      ];

const CAMPOS = [
  'season',
  'no',
  'fighters',
  'seed',
  'winner',
  'wins',
  'capWins',
  'rounds',
  'cycles',
  'capRounds',
  'note',
];
/** @param {any[]} ms */
const huella = (ms) =>
  ms
    .slice()
    .sort((a, b) => a.season - b.season || a.no - b.no)
    .map((m) => Object.fromEntries(CAMPOS.map((k) => [k, m[k]])));

/**
 * Un torneo con n participantes y el formato dado.
 * @param {Record<string, any>} deps @param {Record<string, any>} fmt @param {number} n
 */
async function torneo(deps, fmt, n) {
  let k = 0;
  const T = crearTorneos(
    depsDePrueba({ almacen: almacenMemoria(), nuevoId: () => `T${++k}`, ...deps }),
  );
  await T.lgLoadAll();
  const L = await T.lgCreate({ 'o-11': '5' });
  for (const [c, v] of Object.entries(fmt)) assert.ok(await T.lgSetFmt(c, v), c);
  for (const e of ents(n)) await T.lgAdd({ name: e.name, dna: e.dna, src: 'form' });
  return { T, L };
}

/** @param {Record<string, any>} fmt @param {number} n @param {number} semilla @param {boolean} [nulos] */
async function enSecuencia(fmt, n, semilla, nulos = false) {
  /** @type {any} */
  let plan = null;
  const { T, L } = await torneo(
    {
      azar: rng(semilla),
      lanzar: (/** @type {any} */ p) => {
        plan = p;
      },
    },
    fmt,
    n,
  );
  for (let g = 0; g < 500; g++) {
    await T.lgPlayNext();
    if (!T.lg.live) break;
    const names = plan.species.map((/** @type {any} */ s) => s.name.replace(/\.txt$/, ''));
    for (const m of mensajesDe(sintetico(names, plan.seed, nulos))) await T.leagueOnMessage(m);
  }
  return { T, L };
}

/** @param {Record<string, any>} fmt @param {number} n @param {number} semilla @param {boolean} [nulos] */
async function porRondas(fmt, n, semilla, nulos = false) {
  const { T, L } = await torneo({ azar: rng(semilla) }, fmt, n);
  const tamaños = [];
  let descartados = 0;
  for (let g = 0; g < 500; g++) {
    const r = await T.lgRonda();
    if (!r) break;
    tamaños.push(r.n);
    assert.ok(LG.lgSeason(L).ronda, 'la temporada queda marcada');
    const res = r.params.partidos.map((p) => sintetico(p.fighters, p.seed, nulos));
    const reg = await T.lgRegistrarRonda(r.params, res);
    descartados += reg.descartados;
    assert.equal(reg.registrados + reg.descartados, r.n);
    assert.equal(LG.lgSeason(L).ronda, undefined);
  }
  return { T, L, tamaños, descartados };
}

const FORMATOS = [
  { fmt: { format: 'rr', legs: 2 }, n: 5, rondas: [20] },
  { fmt: { format: 'swiss' }, n: 7, rondas: [3, 3, 3, 3] },
  { fmt: { format: 'swiss', swissRounds: 3 }, n: 6, rondas: [3, 3, 3] },
  { fmt: { format: 'cup', groupLegs: 2, third: true }, n: 8, rondas: [24, 2, 1, 1] },
  { fmt: { format: 'cup', pots: 'random' }, n: 16, rondas: [24, 4, 2, 1] },
  { fmt: { format: 'koth', k: 3, retire: 2 }, n: 5, rondas: null },
  { fmt: { format: 'ladder' }, n: 5, rondas: null },
  { fmt: { format: 'single' }, n: 4, rondas: [1] },
];

test('por rondas = en secuencia: mismos cruces, semillas y números en los seis formatos', async () => {
  for (const c of FORMATOS)
    for (const semilla of [3, 41]) {
      const a = await enSecuencia(c.fmt, c.n, semilla);
      const b = await porRondas(c.fmt, c.n, semilla);
      const msg = `${c.fmt.format} (${JSON.stringify(c.fmt)}) semilla ${semilla}`;
      assert.ok(a.T.lg.matches.length > 0, msg);
      assert.deepEqual(huella(b.T.lg.matches), huella(a.T.lg.matches), msg);
      assert.equal(b.descartados, 0, msg);
      if (c.rondas) assert.deepEqual(b.tamaños, c.rondas, msg);
      else
        assert.ok(
          b.tamaños.every((x) => x === 1),
          `${msg}: de a uno`,
        );
      const S = LG.lgSeason(b.L);
      assert.ok(LG.lgSeasonDone(S, b.T.lgSeasonMatches(S.no)), `${msg}: temporada terminada`);
      assert.deepEqual(
        LG.lgSeasonChampion(S, b.T.lgSeasonMatches(S.no)),
        LG.lgSeasonChampion(LG.lgSeason(a.L), a.T.lgSeasonMatches(1)),
      );
      // Todos los partidos de la ronda llevan su id de ronda.
      assert.ok(b.T.lg.matches.every((m) => typeof (/** @type {any} */ (m).ronda) === 'string'));
    }
});

test('con nulos: la temporada termina y nada queda fuera de orden', async () => {
  for (const c of FORMATOS)
    for (const semilla of [5, 8]) {
      const b = await porRondas(c.fmt, c.n, semilla, true);
      const S = LG.lgSeason(b.L);
      const ms = b.T.lgSeasonMatches(S.no);
      const msg = `${c.fmt.format} semilla ${semilla}`;
      assert.ok(LG.lgSeasonDone(S, ms), `${msg}: terminada`);
      // Recorriendo los registrados en orden con lgFixture, cada partido con
      // ganador es un cruce que el formato esperaba (el estado lo consume).
      const jugados = LG.lgPlayed(ms).length;
      if (c.fmt.format === 'swiss') {
        const st = LG.lgSwissState(S, ms);
        const cruces = st.history.flatMap((rd) => rd.pairs).filter((t) => t.winner).length;
        assert.equal(cruces, jugados, `${msg}: cada partido jugado es un cruce del suizo`);
      }
      if (c.fmt.format === 'cup') {
        const st = LG.lgCupState(S, ms);
        const n =
          st.played + st.bracket.flat().filter((t) => t.winner).length + (st.third?.winner ? 1 : 0);
        assert.equal(n, jugados, `${msg}: cada partido jugado es de la copa`);
      }
      if (c.fmt.format === 'swiss' || c.fmt.format === 'cup')
        assert.ok(
          ms.some((m) => !m.winner),
          `${msg}: hubo nulos`,
        );
    }
});

test('partidosDeRonda: el primero es lgFixture y la ronda es la del formato', () => {
  // Suizo: la ronda en curso, desde el primer cruce sin jugar.
  const S = { no: 1, entrants: ents(6), fmt: { ...LG.LG_FMT_DEFAULT, format: 'swiss' } };
  S.order = LG.lgShuffle(
    S.entrants.map((e) => e.name),
    rng(1),
  );
  /** @type {any[]} */
  const ms = [];
  const r1 = partidosDeRonda(/** @type {any} */ (S), ms);
  assert.equal(r1.orden, 'estricto');
  assert.equal(r1.partidos.length, 3);
  const fx = LG.lgFixture(/** @type {any} */ (S), ms);
  assert.deepEqual(r1.partidos[0], fx);
  const [a, b] = r1.partidos[0].fighters.map((e) => e.name);
  ms.push({ season: 1, no: 1, fighters: [a, b], winner: a });
  const r2 = partidosDeRonda(/** @type {any} */ (S), ms);
  assert.equal(r2.partidos.length, 2);
  assert.deepEqual(r2.partidos[0], LG.lgFixture(/** @type {any} */ (S), ms));
  assert.deepEqual(r2.partidos[0].label.params.match, 2);
  // Copa con 3.er puesto: después de las semis, el 3.er puesto solo.
  const C = { no: 1, entrants: ents(8), fmt: { ...LG.LG_FMT_DEFAULT, format: 'cup', third: true } };
  const L = { id: 'x', seasons: [C] };
  LG.lgCupDraw(/** @type {any} */ (L), [], rng(2));
  /** @type {any[]} */
  const cm = [];
  for (let g = 0; g < 40; g++) {
    const r = partidosDeRonda(/** @type {any} */ (C), cm);
    if (!r.partidos.length) break;
    assert.deepEqual(r.partidos[0], LG.lgFixture(/** @type {any} */ (C), cm));
    const st = LG.lgCupState(/** @type {any} */ (C), cm);
    if (st.phase === 'groups') assert.equal(r.orden, 'libre');
    if (st.third && !st.third.winner) {
      assert.equal(r.partidos.length, 1);
      assert.equal(r.partidos[0].label.clave, 'cup-third');
    }
    for (const p of r.partidos) {
      const n = p.fighters.map((e) => e.name);
      cm.push({ season: 1, no: cm.length + 1, fighters: n, winner: n[0] });
    }
  }
  assert.ok(LG.lgSeasonDone(/** @type {any} */ (C), cm));
  assert.equal(LG.lgSeasonChampion(/** @type {any} */ (C), cm)?.how, 'cup');
  // Temporada terminada o con menos de 2: nada.
  assert.deepEqual(partidosDeRonda(/** @type {any} */ (C), cm).partidos, []);
  const U = { no: 1, entrants: ents(1), fmt: { ...LG.LG_FMT_DEFAULT, format: 'rr' } };
  assert.deepEqual(partidosDeRonda(/** @type {any} */ (U), []).partidos, []);
});

test('lgRonda: marca, bloqueo, cancelar, registro idempotente y con la liga cerrada', async () => {
  /** @type {any[]} */
  const notas = [];
  const { T, L } = await torneo(
    {
      azar: rng(7),
      lanzar: () => {},
      alEvento: (/** @type {any} */ ev) => ev.t === 'nota' && notas.push(ev.clave),
    },
    { format: 'rr' },
    4,
  );
  const r = /** @type {any} */ (await T.lgRonda());
  assert.equal(r.n, 6);
  assert.equal(r.params.formatoTorneo, 'rr');
  assert.equal(r.params.orden, 'libre');
  // Con la ronda en curso: ni jugar a mano, ni otra ronda, ni tocar el formato.
  await T.lgPlayNext();
  assert.equal(T.lg.live, null);
  assert.equal(await T.lgRonda(), null);
  assert.equal(await T.lgSetFmt('rounds', 7), false);
  assert.ok(notas.includes('round-running') && notas.includes('locked'));
  // Cancelar (la cola la canceló): se puede pedir otra, con semillas nuevas.
  assert.equal(await T.lgRondaCancelar('otra'), false);
  assert.equal(await T.lgRondaCancelar(r.params.ronda), true);
  const r2 = /** @type {any} */ (await T.lgRonda());
  assert.notDeepEqual(
    r2.params.partidos.map((/** @type {any} */ p) => p.seed),
    r.params.partidos.map((/** @type {any} */ p) => p.seed),
  );
  // La ronda vieja (cancelada) ya no se registra.
  const res = (/** @type {any} */ p) =>
    p.params.partidos.map((/** @type {any} */ x) => sintetico(x.fighters, x.seed));
  const vieja = await T.lgRegistrarRonda(r.params, res(r));
  assert.equal(vieja.registrados, 0);
  assert.equal(vieja.descartados, 6);
  // Con otra liga abierta: se registra en la base con su número.
  const otra = await T.lgCreate({});
  assert.equal(T.lg.cur, otra);
  const reg = await T.lgRegistrarRonda(r2.params, [...res(r2).slice(0, 5), null]);
  assert.deepEqual(reg, { registrados: 5, nulos: 0, descartados: 1, previos: 0, ya: false });
  assert.equal(await T.lgRegistrarRonda(r2.params, res(r2)).then((x) => x.ya), true);
  await T.lgSelect(L);
  assert.deepEqual(
    T.lgSeasonMatches(1).map((m) => m.no),
    [1, 2, 3, 4, 5],
  );
  assert.equal(LG.lgSeason(L).ronda, undefined);
  // La vista de la cola no lleva ADN; el resumen, lo de cada partido.
  const v = vistaParamsRonda(r2.params);
  assert.ok(!JSON.stringify(v).includes('.up store'));
  assert.equal(v.partidos.length, 6);
  const s = resumenRonda(r2.params, [...res(r2).slice(0, 5), null]);
  assert.equal(s.partidos[5], null);
  assert.equal(s.partidos[0]?.winner, res(r2)[0].winner);
  // El partido que falta, en la ronda siguiente.
  const r3 = /** @type {any} */ (await T.lgRonda());
  assert.equal(r3.n, 1);
  assert.deepEqual(r3.params.partidos[0].fighters, r2.params.partidos[5].fighters);
});

test('reglas y formato bloqueados desde el primer partido de la temporada', async () => {
  /** @type {any} */
  let plan = null;
  const { T, L } = await torneo(
    {
      azar: rng(1),
      lanzar: (/** @type {any} */ p) => {
        plan = p;
      },
    },
    { format: 'rr' },
    3,
  );
  const S = LG.lgSeason(L);
  assert.equal(reglasBloqueadas(S, T.lg.matches), false);
  assert.equal(await T.lgSetRules({ 'o-11': '7' }), true);
  assert.equal(await T.lgSetFmt('rounds', 4), true);
  await T.lgPlayNext();
  for (const m of mensajesDe({ ...sintetico(['x', 'y'], 1), winner: '' }))
    await T.leagueOnMessage(m);
  assert.equal(T.lg.matches.length, 1, 'un nulo también cuenta');
  assert.ok(plan);
  assert.equal(reglasBloqueadas(S, T.lg.matches), true);
  assert.equal(await T.lgSetRules({ 'o-11': '9' }), false);
  assert.equal(await T.lgSetFmt('rounds', 6), false);
  assert.deepEqual(S.rules, { 'o-11': '7' });
  assert.equal(S.fmt.rounds, 4);
  // Temporada nueva: se desbloquea.
  await T.lgNewSeason(L);
  assert.equal(await T.lgSetRules({ 'o-11': '9' }), true);
});

// ---- Escenario efectivo ------------------------------------------------------------------
const LUCHADORES = [
  { name: 'Uno', dna: 'cond start 10 .up store stop end', color: '#ff4040', qty: 3 },
  { name: 'Dos', dna: 'cond start 5 .aimdx store stop end', color: '#3d9bff', qty: 2 },
];
const VALORES = { nrg: 3000, rounds: 5, wins: 3, cap: 5000, capMode: 'pop', popCap: 500 };

test('escenario efectivo: las opciones del reset son las de la clásica (salvo Toroidal)', () => {
  const c = clasica();
  const f1 = plano(c.ev('lgF1Rules()'));
  c.tocar([
    ['o-fsize', '3'],
    ['o-12', '0.5'],
    ['o-c30', '0.1'],
    ['o-c56', true],
    ['o-mutations', false],
    ['o-phys', 'fluido'],
  ]);
  const panel = plano(c.ev('lgCaptureRules()'));
  const sinCostos = plano(c.ev('lgNoCostRules()'));
  for (const reglas of [f1, panel, sinCostos, {}, { 'o-fsize': '2', 'o-shape': 'v' }]) {
    const plan = planPartido(LUCHADORES, VALORES, 4321, reglas);
    const clasicos = mensajesPartido(plan, reglasAOpciones(reglas, opcionesBaseClasica()));
    const a = clasicos.find((m) => m.t === 'reset');
    const e = escenarioDelPartido(plan);
    const msgs = aplicar(e, plan.seed);
    const b = msgs.find((m) => m.t === 'reset');
    const oa = structuredClone(a.options);
    const ob = structuredClone(b.options);
    // Toroidal (opt 1) solo va en el .dbsim: la clásica no lo manda.
    assert.equal(ob.opts[1], oa.opts[2] && oa.opts[3] ? 1 : undefined);
    delete oa.opts[1];
    delete ob.opts[1];
    assert.deepEqual(ob, oa);
    assert.equal(b.seed, a.seed);
    assert.equal(b.limpio, true);
    // Especies: el alga y los luchadores, igual que la siembra de la clásica.
    const clasicas = [
      ...a.species,
      ...clasicos.filter((m) => m.t === 'seed-species').map((m) => m.sp),
    ];
    assert.deepEqual(b.species, clasicas);
    assert.equal(e.especies[0].bot, BOT_ALGA);
    assert.equal(e.id, 'partido-torneo');
    assert.equal(e.destino, 'competir');
  }
  assert.equal(vbColorACss(0x3dff40), '#40ff3d');
});

test('mensajesDelPlan: escenario + topes después del reset limpio; caída a mensajesPartido', () => {
  const plan = planPartido(LUCHADORES, VALORES, 99, { 'o-fsize': '1' });
  const m = mensajesDelPlan(plan);
  const tipos = m.map((x) => x.t);
  assert.deepEqual(tipos.slice(0, 2), ['run', 'reset']);
  assert.deepEqual(tipos.slice(-4), ['f1-cap', 'f1-popcap', 'f1start', 'run']);
  assert.equal(m[1].limpio, true);
  assert.equal(m[1].quietF1, true);
  assert.deepEqual(m.slice(-4, -1), mensajesF1(plan));
  assert.deepEqual(m[m.length - 1], { t: 'run', running: true });
  // Una foto que no cabe en un escenario (campo fuera del tope): sin corrida.
  const raro = planPartido(LUCHADORES, VALORES, 99, { 'o-fw': '99999999' });
  assert.equal(lanzamiento(raro), null);
  const m2 = mensajesDelPlan(raro);
  assert.deepEqual(
    m2,
    mensajesPartido(raro, reglasAOpciones(raro.rules, opcionesBaseClasica()), siembraArranque(), {
      limpio: true,
    }),
  );
  assert.deepEqual(
    m2.map((x) => x.t),
    ['run', 'reset', 'f1-cap', 'f1-popcap', 'seed-species', 'seed-species', 'f1start', 'run'],
  );
  assert.equal(m2[1].options.fieldW, 99999999);
  // Sin `limpio`, mensajesPartido es el de la clásica (topes antes del reset).
  assert.deepEqual(
    mensajesPartido(raro, reglasAOpciones(raro.rules, opcionesBaseClasica())).map((x) => x.t),
    ['f1-cap', 'f1-popcap', 'run', 'reset', 'seed-species', 'seed-species', 'f1start', 'run'],
  );
  assert.throws(() => cambiosDeOpciones({ zzz: 1, opts: {}, costs: {} }), /rule-unknown/);
});

test('reglas-escenario (decisión 21): opciones y objetos del escenario + el modo F1', () => {
  const base = /** @type {any} */ (escenarioFabrica('partido-f1'));
  const reglas = reglasDeEscenario({
    ...base,
    opciones: { base: 'f1', cambios: { 'opt:12': 0.5, 'opt:97': 9 } },
    objetos: { obstaculos: [{ tipo: 'forma', ancho: 0.1, alto: 0.1 }], teleporters: [] },
  });
  assert.ok(esReglasEscenario(reglas));
  assert.equal(esReglasEscenario({ 'o-11': 1 }), false);
  assert.deepEqual(reglas.escenario.especies, []);
  const plan = planPartido(LUCHADORES, VALORES, 5, reglas);
  const e = escenarioDelPartido(plan);
  assert.equal(e.opciones.base, 'f1');
  assert.equal(e.opciones.cambios['opt:12'], 0.5);
  assert.equal(e.opciones.cambios['opt:97'], 5, 'las rondas del partido pisan las del escenario');
  assert.equal(e.opciones.cambios['opt:91'], 1);
  assert.equal(e.especies.length, 3);
  assert.deepEqual(e.objetos.obstaculos, [{ tipo: 'forma', ancho: 0.1, alto: 0.1 }]);
  const tipos = mensajesDelPlan(plan).map((m) => m.t);
  assert.deepEqual(tipos, ['run', 'reset', 'shape', 'f1-cap', 'f1-popcap', 'f1start', 'run']);
  // Reglas-escenario inválidas: error (no hay caída).
  const mal = planPartido(LUCHADORES, VALORES, 5, {
    escenario: { ...reglas.escenario, opciones: { base: 'nada', cambios: {} } },
  });
  assert.throws(() => lanzamiento(mal), ErrorEscenario);
});

test('repeticionDe: escenario y semilla del partido guardado; falta un participante', async () => {
  /** @type {any} */
  let plan = null;
  const { T, L } = await torneo(
    {
      azar: rng(2),
      lanzar: (/** @type {any} */ p) => {
        plan = p;
      },
    },
    { format: 'rr' },
    3,
  );
  await T.lgPlayNext();
  for (const m of mensajesDe(sintetico(['E0', 'E1'], 7))) await T.leagueOnMessage(m);
  const m = T.lg.matches[0];
  const r = T.lgRepeticion(/** @type {number} */ (m.id));
  assert.equal(r.semilla, m.seed);
  assert.deepEqual(r.plan, plan, 'el mismo plan que se jugó');
  assert.deepEqual(
    r.escenario.especies.map((s) => s.bot),
    [BOT_ALGA, ...m.fighters],
  );
  assert.deepEqual(r.f1, mensajesF1(plan));
  const E = LG.lgSeason(L).entrants;
  E.splice(
    E.findIndex((e) => e.name === m.fighters[0]),
    1,
  );
  assert.throws(() => repeticionDe(L, m), /replay-missing/);
});

// ---- Salón de la fama global --------------------------------------------------------------
test('lgSalonGlobal: un renglón por ADN, Elo sobre todos los torneos en orden de fecha', () => {
  const A = ent('A');
  const B = ent('B');
  const C = ent('C');
  const B2 = { ...B, name: 'Bravo' }; // el mismo ADN con otro nombre
  const L1 = LG.lgNewLeague({ id: 'L1', name: 'Uno', fmt: { format: 'single' }, entrants: [A, B] });
  const L2 = LG.lgNewLeague({ id: 'L2', name: 'Dos', fmt: { format: 'rr' }, entrants: [B2, C] });
  const ms = [
    { league: 'L2', season: 1, no: 1, fighters: ['Bravo', 'C'], winner: 'C', date: '2026-02-01' },
    { league: 'L1', season: 1, no: 1, fighters: ['A', 'B'], winner: 'B', date: '2026-01-01' },
    { league: 'L2', season: 1, no: 2, fighters: ['Bravo', 'C'], winner: '', date: '2026-03-01' },
    { league: 'scratch', season: 1, no: 1, fighters: ['A', 'B'], winner: 'A', date: '2026-01-05' },
  ];
  const s = lgSalonGlobal([L1, L2], ms);
  const porHash = new Map(s.map((r) => [r.hash, r]));
  const rb = /** @type {any} */ (porHash.get(B.hash));
  assert.deepEqual(rb.names, ['B', 'Bravo']);
  assert.equal(rb.name, 'Bravo');
  assert.equal(rb.torneos, 2);
  assert.equal(rb.p, 2);
  assert.equal(rb.w, 1);
  assert.equal(rb.titles, 1, 'ganó el single');
  // Elo en orden de fecha: primero L1 (B le gana a A), después L2 (C a B).
  const e = { A: { elo: 1500 }, B: { elo: 1500 }, C: { elo: 1500 } };
  LG.lgElo([e.A, e.B], e.B);
  LG.lgElo([e.B, e.C], e.C);
  assert.equal(rb.elo, e.B.elo);
  assert.equal(/** @type {any} */ (porHash.get(A.hash)).elo, e.A.elo);
  assert.equal(/** @type {any} */ (porHash.get(C.hash)).elo, e.C.elo);
  assert.equal(/** @type {any} */ (porHash.get(C.hash)).titles, 1, 'ganó su todos contra todos');
  assert.deepEqual(
    s.map((r) => r.hash),
    [C.hash, B.hash, A.hash],
    'títulos, victorias y Elo',
  );
  assert.equal(s.length, 3);
});

test('lgSalon lee todos los torneos guardados', async () => {
  const { T } = await torneo({ azar: rng(3), lanzar: () => {} }, { format: 'single' }, 2);
  await T.lgPlayNext();
  for (const m of mensajesDe(sintetico(['E0', 'E1'], 4))) await T.leagueOnMessage(m);
  const s = await T.lgSalon();
  assert.equal(s.length, 2);
  assert.equal(s[0].titles, 1);
  assert.equal(s[0].name, 'E0');
});

// ---- Migración de darwinbots-ligas -----------------------------------------------------
function ligasViejas() {
  const L = LG.lgNewLeague({
    id: 'Lviejo',
    name: 'Liga vieja',
    fmt: { format: 'rr' },
    entrants: ents(3),
  });
  const M = LG.lgNewLeague({
    id: 'Lotro',
    name: 'Otra',
    fmt: { format: 'single' },
    entrants: ents(2),
  });
  delete (/** @type {any} */ (M).draw); // de antes de E11: lgMigrate lo completa al cargar
  return {
    leagues: [L, M, { id: '', seasons: [] }],
    matches: [
      { id: 1, league: 'Lviejo', season: 1, no: 1, fighters: ['E0', 'E1'], winner: 'E0', seed: 5 },
      { id: 2, league: 'Lviejo', season: 1, no: 2, fighters: ['E0', 'E2'], winner: 'E2', seed: 6 },
      { id: 3, league: 'Lotro', season: 1, no: 1, fighters: ['E0', 'E1'], winner: 'E1', seed: 7 },
      { id: 4, league: 'nadie', season: 1, no: 1, fighters: ['X'], winner: 'X' },
      { id: 5, league: 'Lviejo' },
    ],
  };
}

test('migrarLigas: copia una vez, avisa, no duplica y no toca la clásica', async () => {
  const viejo = ligasViejas();
  const foto = JSON.stringify(viejo);
  let lecturas = 0;
  const leer = async () => {
    lecturas++;
    return { version: 1, stores: structuredClone(viejo) };
  };
  const almacen = almacenMemoria();
  // Lo que ya había en la nueva: un partido con el id 2.
  await almacen.put('partidos', {
    id: 2,
    league: 'Lnuevo',
    season: 1,
    no: 1,
    fighters: [],
    winner: '',
  });
  const r = await migrarLigas(almacen, { leer, reloj: () => new Date('2026-09-30T00:00:00Z') });
  assert.equal(r.nueva, true);
  assert.deepEqual(r.resumen, {
    existia: true,
    version: 1,
    torneos: 2,
    partidos: 3,
    yaEstaban: 0,
    partidosReasignados: 1,
    invalidos: 2,
    huerfanos: 1,
    nombres: ['Liga vieja', 'Otra'],
  });
  assert.equal(JSON.stringify(viejo), foto, 'la clásica no se toca');
  const marca = await almacen.get('ajustes', CLAVE_MIGRACION_LIGAS);
  assert.equal(marca.fecha, '2026-09-30T00:00:00.000Z');
  // Segunda vez: no lee ni copia.
  const r2 = await migrarLigas(almacen, { leer });
  assert.equal(r2.nueva, false);
  assert.equal(lecturas, 1);
  // Forzada (importación manual): las ligas que ya están no se duplican.
  const r3 = await migrarLigas(almacen, { leer, forzar: true });
  assert.equal(r3.resumen.torneos, 0);
  assert.equal(r3.resumen.yaEstaban, 2);
  assert.equal((await almacen.list('partidos')).length, 4);
  // La nueva los carga como torneos (lgMigrate completa lo que falta).
  const T = crearTorneos(depsDePrueba({ almacen }));
  await T.lgLoadAll();
  assert.deepEqual(T.lg.list.map((L) => L.name).sort(), ['Liga vieja', 'Otra']);
  const otra = /** @type {any} */ (T.lg.list.find((L) => L.id === 'Lotro'));
  assert.deepEqual(otra.draw, LG.LG_DRAW_DEFAULT);
  await T.lgSelect(/** @type {any} */ (T.lg.list.find((L) => L.id === 'Lviejo')));
  assert.equal(T.lg.matches.length, 2);
  assert.deepEqual(T.lg.matches.map((m) => m.seed).sort(), [5, 6]);
  // Sin base vieja: existia false.
  const vacio = await migrarLigas(almacenMemoria(), { leer: async () => null });
  assert.deepEqual(vacio.resumen, { existia: false });
  assert.deepEqual(transformarLigas({}), { ligas: [], partidos: [], invalidos: 0, huerfanos: 0 });
});

// ---- Exportar / importar -----------------------------------------------------------------
test('importar: archivos v1 y v2 de la clásica, y reglas-escenario de ida y vuelta', async () => {
  const { T, L } = await torneo({ azar: rng(4), lanzar: () => {} }, { format: 'rr' }, 3);
  const reglas = reglasDeEscenario(escenarioFabrica('partido-f1'));
  assert.equal(await T.lgSetRules(reglas), true);
  await T.lgPlayNext();
  for (const m of mensajesDe(sintetico(['E0', 'E1'], 4))) await T.leagueOnMessage(m);
  const { obj } = T.lgExport(L);
  const texto = JSON.stringify(obj);
  const imp = /** @type {any} */ (await T.lgImport(texto));
  assert.ok(imp);
  assert.deepEqual(LG.lgSeason(imp).rules, reglas);
  assert.equal(T.lg.matches.length, 1);
  assert.equal(T.lg.matches[0].seed, obj.matches[0].seed);
  // v1: sin sorteo ni cantidades; se importa con el sorteo fijo.
  const v1 = {
    kind: 'darwinbots-league',
    version: 1,
    league: {
      name: 'Vieja',
      seasons: [
        {
          no: 1,
          rules: { 'o-11': '180' },
          fmt: { format: 'koth' },
          entrants: [ents(2)[0], ents(2)[1]],
        },
      ],
    },
    matches: [{ season: 1, no: 1, fighters: ['E0', 'E1'], winner: 'E1', seed: 3 }],
  };
  const i1 = /** @type {any} */ (await T.lgImport(JSON.stringify(v1)));
  assert.equal(i1.name, 'Vieja');
  assert.deepEqual(i1.draw, LG.LG_DRAW_DEFAULT);
  assert.equal(LG.lgSeason(i1).fmt.popCap, 0, 'las temporadas viejas sin tope de bots');
  assert.equal(T.lg.matches.length, 1);
  const v2 = {
    ...v1,
    version: 2,
    league: { ...v1.league, draw: { mode: 'random', pool: 'fav', n: 4 } },
  };
  const i2 = /** @type {any} */ (await T.lgImport(JSON.stringify(v2)));
  assert.equal(i2.name, 'Vieja (imported)');
  assert.deepEqual(i2.draw, { mode: 'random', pool: 'fav', n: 4 });
  assert.equal(await T.lgImport(JSON.stringify({ ...v1, version: 3 })), null);
});

// ---- Participantes desde la Biblioteca --------------------------------------------------
test('participantes e inventario desde la Biblioteca (ADN congelado al inscribir)', async () => {
  const indice = [
    {
      clase: 'foro',
      clave: 'h1',
      nombre: 'Foro uno',
      archivo: 'uno.txt',
      vegetal: false,
      marcas: { fav: true, tags: ['caza'] },
    },
    {
      clase: 'foro',
      clave: 'h2',
      nombre: 'Alga',
      archivo: 'alga.txt',
      vegetal: true,
      marcas: { fav: true, tags: [] },
    },
    {
      clase: 'propio',
      clave: 'p:1',
      nombre: 'Mío',
      vegetal: false,
      adn: 'cond start 3 .up store stop end',
      marcas: { fav: false, tags: ['caza'] },
    },
    {
      clase: 'foro',
      clave: 'h3',
      nombre: 'Roto',
      archivo: 'roto.txt',
      vegetal: false,
      marcas: { fav: false, tags: [] },
    },
  ];
  const adnDe = (/** @type {any} */ e) =>
    e.archivo === 'uno.txt' ? 'cond start 1 .up store stop end' : undefined;
  const { participantes, sinAdn } = await participantesDeEntradas(indice, adnDe);
  assert.deepEqual(
    participantes.map((p) => [p.name, p.src, p.file]),
    [
      ['Foro uno', 'bestiary', 'uno.txt'],
      ['Mío', 'form', ''],
    ],
  );
  assert.deepEqual(sinAdn, ['Roto']);
  const inventario = inventarioDeBiblioteca({
    indice,
    sel: ['p:1'],
    selecciones: [{ nombre: 'S', claves: ['h1', 'h3'] }],
    adnDe,
  });
  assert.deepEqual(
    LG.lgPool(inventario, 'all').map((it) => it.key),
    ['h1', 'p:1', 'h3'],
  );
  assert.deepEqual(
    LG.lgPool(inventario, 'fav').map((it) => it.key),
    ['h1'],
  );
  assert.deepEqual(
    LG.lgPool(inventario, 'tag:caza').map((it) => it.key),
    ['h1', 'p:1'],
  );
  assert.deepEqual(
    LG.lgPool(inventario, 'sel').map((it) => it.key),
    ['p:1'],
  );
  assert.deepEqual(
    LG.lgPool(inventario, 'set:S').map((it) => it.key),
    ['h1', 'h3'],
  );
  const T = crearTorneos(depsDePrueba({ almacen: almacenMemoria(), inventario }));
  await T.lgLoadAll();
  const L = await T.lgCreate({});
  const r = await T.lgEnroll(L, LG.lgPool(inventario, 'all'));
  assert.deepEqual(r, { added: 2, failed: 1 });
  assert.deepEqual(
    LG.lgSeason(L).entrants.map((e) => [e.name, e.dna.slice(0, 12)]),
    [
      ['Foro uno', 'cond start 1'],
      ['Mío', 'cond start 3'],
    ],
  );
});
