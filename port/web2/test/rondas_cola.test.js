// @ts-check
// Rondas en segundo plano contra la cola y entre pestañas (N3.4, correcciones
// de la revisión; decisiones 10 y 23, C20), sin wasm:
//   - una ronda cancelada (o fallida) y después «reintentada» no registra
//     partidos repetidos: el registro exige la marca de ESA ronda en la
//     temporada guardada, y la cola rechaza reintentar un trabajo de ronda;
//   - dos pestañas (dos crearTorneos sobre el mismo almacén) que registran
//     la misma ronda: una sola vez; dos registros simultáneos en la misma
//     pestaña: una sola vez;
//   - idempotencia por partido (rec.ronda + rec.rondaI): un registro a
//     medias se completa sin repetir;
//   - lgReconciliarRondas: terminado → registra; cancelado, fallido o
//     ausente → cancela (con margen para uno recién armado); en curso → nada;
//   - con una ronda en curso quedan bloqueados lgAdd, lgAddItems,
//     lgCupRedraw, lgEntrant*, lgNewSeason, lgSetDraw, lgRedraw y lgPlay;
//     color y cantidad bloqueados desde el primer partido y no se quita un
//     participante que ya jugó (como la clásica);
//   - params compactos: rr de 30 ida y vuelta muy por debajo de 5,9 MB, y
//     planDeRonda arma el mismo plan que lgPlay (y acepta los de formato 1).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { Cola, ErrorCola } from '../engine/cola.js';
import * as LG from '../engine/league.js';
import { planPartido } from '../engine/partido.js';
import {
  crearParamsRonda,
  FORMATO_RONDA,
  planDeRonda,
  TIPO_RONDA,
  valoresDePartido,
  vistaParamsRonda,
} from '../engine/rondas.js';
import { crearTorneos, ST_PARTIDOS, ST_TORNEOS } from '../engine/torneos.js';
import { rng } from './util/clasica-vm.js';
import { depsDePrueba } from './util/torneos-deps.js';

/** Resultado sintético: gana el primero. @param {string[]} names */
const res = (names) => ({
  winner: names[0],
  note: '',
  f1: { sp: names.map((name, i) => ({ name, wins: i ? 0 : 2, capWins: 0 })) },
  cycles: 100,
  capRounds: 0,
});
/** @param {any} p */
const resultados = (p) => p.partidos.map((/** @type {any} */ x) => res(x.fighters));

/**
 * Un torneo guardado con n participantes y el formato dado.
 * @param {{almacen?: any, azar?: () => number, fmt?: string, n?: number, notas?: string[],
 *   lanzar?: (p: any) => void, dna?: (i: number) => string, extra?: Record<string, any>}} [o]
 */
async function torneo(o = {}) {
  let k = 0;
  const almacen = o.almacen ?? almacenMemoria();
  const T = crearTorneos(
    depsDePrueba({
      almacen,
      nuevoId: () => `T${++k}`,
      azar: o.azar ?? rng(5),
      lanzar: o.lanzar ?? (() => {}),
      alEvento: (/** @type {any} */ ev) => ev.t === 'nota' && o.notas?.push(ev.clave),
    }),
  );
  await T.lgLoadAll();
  const L = await T.lgCreate({});
  await T.lgSetFmt('format', o.fmt ?? 'rr');
  for (const [c, v] of Object.entries(o.extra ?? {})) await T.lgSetFmt(c, v);
  for (let i = 0; i < (o.n ?? 4); i++)
    await T.lgAdd({
      name: `E${i}`,
      dna: o.dna ? o.dna(i) : `cond start ${i} .up store stop end`,
      src: 'form',
    });
  return { T, L, almacen };
}

/** @param {any} almacen @param {string} league */
const guardados = async (almacen, league) =>
  (await almacen.porIndice(ST_PARTIDOS, 'league', league)).sort(
    (/** @type {any} */ a, /** @type {any} */ b) => a.season - b.season || a.no - b.no,
  );

test('ronda cancelada, jugada a mano y registrada tarde: nada repetido (suizo y copa)', async () => {
  for (const [fmt, n] of /** @type {const} */ ([
    ['swiss', 4],
    ['cup', 8],
  ])) {
    /** @type {any} */
    let plan = null;
    const { T, L, almacen } = await torneo({
      fmt,
      n,
      azar: rng(3),
      lanzar: (p) => {
        plan = p;
      },
    });
    const r = /** @type {any} */ (await T.lgRonda());
    assert.ok(r && r.n >= 2, fmt);
    // La cola falló o se canceló: se quita la marca; el usuario juega a mano.
    assert.equal(await T.lgRondaCancelar(r.params.ronda), true);
    await T.lgPlayNext();
    const names = plan.species.map((/** @type {any} */ s) => s.name.replace(/\.txt$/, ''));
    await T.leagueOnMessage({ t: 'f1-started', n: 2 });
    await T.leagueOnMessage({
      t: 'f1-over',
      winner: names[1],
      f1: { sp: names.map((name, i) => ({ name, wins: i ? 2 : 0, capWins: 0 })) },
      cycles: 50,
    });
    // «Reintentar» el trabajo viejo y registrarlo al terminar: nada.
    const tarde = await T.lgRegistrarRonda(r.params, resultados(r.params));
    assert.deepEqual(
      tarde,
      { registrados: 0, nulos: 0, descartados: r.n, previos: 0, ya: false },
      fmt,
    );
    const ms = await guardados(almacen, L.id);
    assert.equal(ms.length, 1, fmt);
    assert.equal(ms[0].ronda, undefined);
    // Una ronda nueva sigue desde ahí, sin repetir el partido jugado a mano.
    const r2 = /** @type {any} */ (await T.lgRonda());
    assert.ok(
      !r2.params.partidos.some((/** @type {any} */ x) => x.fighters.join() === names.join()),
      fmt,
    );
  }
});

test('la cola no reintenta un trabajo de ronda (reintentable: false)', async () => {
  let falla = true;
  const cola = new Cola({
    almacen: almacenMemoria(),
    ejecutores: {
      [TIPO_RONDA]: {
        unidad: async () => {
          if (falla) throw new Error('worker');
          return 1;
        },
        reintentable: false,
      },
      otro: {
        unidad: async () => {
          if (falla) throw new Error('worker');
          return 1;
        },
      },
    },
  });
  const a = await cola.encolar({ tipo: TIPO_RONDA, params: {}, unidades: 1 });
  const b = await cola.encolar({ tipo: 'otro', params: {}, unidades: 1 });
  assert.equal((await cola.esperar(a))?.estado, 'fallido');
  assert.equal((await cola.esperar(b))?.estado, 'fallido');
  falla = false;
  await assert.rejects(cola.reintentar(a), (/** @type {any} */ e) => {
    assert.ok(e instanceof ErrorCola);
    assert.equal(e.codigo, 'no-reintentable');
    return true;
  });
  assert.equal(cola.trabajo(a)?.estado, 'fallido');
  assert.equal(await cola.reintentar(b), true);
  assert.equal((await cola.esperar(b))?.estado, 'terminado');
  cola.detener();
});

test('dos pestañas registran la misma ronda: una sola vez; y dos a la vez en la misma', async () => {
  const almacen = almacenMemoria();
  const { T: A, L } = await torneo({ almacen, n: 4 });
  // B abrió antes de la ronda: su memoria no tiene la marca.
  const B = crearTorneos(depsDePrueba({ almacen, azar: rng(6) }));
  await B.lgLoadAll();
  await B.lgSelect(/** @type {any} */ (B.lgFind(L.id)));
  const r = /** @type {any} */ (await A.lgRonda());
  assert.equal(r.n, 6);
  assert.equal(/** @type {any} */ (LG.lgSeason(/** @type {any} */ (B.lg.cur))).ronda, undefined);
  const ra = await A.lgRegistrarRonda(r.params, resultados(r.params));
  const rb = await B.lgRegistrarRonda(r.params, resultados(r.params));
  assert.equal(ra.registrados, 6);
  assert.deepEqual(rb, { registrados: 0, nulos: 0, descartados: 0, previos: 6, ya: true });
  assert.equal((await guardados(almacen, L.id)).length, 6);
  // B quedó al día (leyó la liga y los partidos del almacén).
  assert.equal(B.lg.matches.length, 6);
  assert.deepEqual(
    B.lgSeasonMatches(1).map((m) => m.no),
    [1, 2, 3, 4, 5, 6],
  );

  // Dos registros simultáneos en la misma pestaña.
  const { T, L: L2, almacen: al2 } = await torneo({ n: 4 });
  const r2 = /** @type {any} */ (await T.lgRonda());
  const [x, y] = await Promise.all([
    T.lgRegistrarRonda(r2.params, resultados(r2.params)),
    T.lgRegistrarRonda(r2.params, resultados(r2.params)),
  ]);
  assert.equal(x.registrados + y.registrados, 6);
  assert.ok(x.ya !== y.ya);
  const ms = await guardados(al2, L2.id);
  assert.deepEqual(
    ms.map((m) => [m.no, m.rondaI]),
    [
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
      [6, 5],
    ],
  );
  assert.equal(T.lg.matches.length, 6);
});

test('idempotencia por partido: un registro a medias se completa sin repetir', async () => {
  const { T, L, almacen } = await torneo({ n: 4 });
  const r = /** @type {any} */ (await T.lgRonda());
  // Lo que habría dejado un registro interrumpido: el partido 0 de la ronda.
  const x0 = r.params.partidos[0];
  await almacen.put(ST_PARTIDOS, {
    league: L.id,
    season: 1,
    no: 1,
    fighters: x0.fighters,
    seed: x0.seed,
    winner: x0.fighters[0],
    wins: [2, 0],
    capWins: [0, 0],
    rounds: 2,
    cycles: 100,
    capRounds: 0,
    note: '',
    format: 'rr',
    ronda: r.params.ronda,
    rondaI: 0,
  });
  const out = await T.lgRegistrarRonda(r.params, resultados(r.params));
  assert.deepEqual(out, { registrados: 5, nulos: 0, descartados: 0, previos: 1, ya: false });
  const ms = await guardados(almacen, L.id);
  assert.deepEqual(
    ms.map((m) => [m.no, m.rondaI]),
    [
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
      [6, 5],
    ],
  );
  assert.equal(LG.lgSeason(L).ronda, undefined);
});

test('lgReconciliarRondas: terminado registra; cancelado, fallido y ausente cancelan', async () => {
  const almacen = almacenMemoria();
  let k = 0;
  const T = crearTorneos(
    depsDePrueba({ almacen, nuevoId: () => `T${++k}`, azar: rng(9), lanzar: () => {} }),
  );
  await T.lgLoadAll();
  /** @type {Record<string, {L: any, r: any}>} */
  const ligas = {};
  for (const nombre of ['terminado', 'cancelado', 'fallido', 'ausente', 'reciente', 'corriendo']) {
    const L = await T.lgCreate({});
    await T.lgSetFmt('format', 'rr');
    for (let i = 0; i < 3; i++)
      await T.lgAdd({
        name: `${nombre}${i}`,
        dna: `cond start ${i} .up store stop end`,
        src: 'form',
      });
    ligas[nombre] = { L, r: await T.lgRonda() };
  }
  // La marca de 'ausente' es vieja (la de 'reciente', de ahora).
  const Lg = await almacen.get(ST_TORNEOS, ligas.ausente.L.id);
  LG.lgSeason(Lg).ronda.creado = 0;
  await almacen.put(ST_TORNEOS, Lg);
  /** @param {string} n @param {string} estado */
  const t = (n, estado) => ({
    id: `t-${n}`,
    tipo: TIPO_RONDA,
    estado,
    params: vistaParamsRonda(ligas[n].r.params),
  });
  const lista = [
    t('terminado', 'terminado'),
    t('cancelado', 'cancelado'),
    t('fallido', 'fallido'),
    t('corriendo', 'corriendo'),
    { id: 'otro', tipo: 'replicas', estado: 'terminado', params: {} },
  ];
  const cola = {
    lista: () => /** @type {any[]} */ (lista),
    resultados: async (/** @type {string} */ id) =>
      id === 't-terminado' ? resultados(ligas.terminado.r.params) : [],
  };
  const out = await T.lgReconciliarRondas(cola);
  assert.deepEqual(out, { registradas: 1, canceladas: 3, enCurso: 2 });
  /** @param {string} n */
  const marca = async (n) =>
    LG.lgSeason(await almacen.get(ST_TORNEOS, ligas[n].L.id)).ronda?.id ?? null;
  assert.equal(await marca('terminado'), null);
  assert.equal((await guardados(almacen, ligas.terminado.L.id)).length, 3);
  for (const n of ['cancelado', 'fallido', 'ausente']) {
    assert.equal(await marca(n), null, n);
    assert.equal((await guardados(almacen, ligas[n].L.id)).length, 0, n);
  }
  assert.equal(await marca('reciente'), ligas.reciente.r.params.ronda);
  assert.equal(await marca('corriendo'), ligas.corriendo.r.params.ronda);
  // La memoria también: la liga cancelada acepta otra ronda.
  await T.lgSelect(ligas.cancelado.L);
  assert.ok(await T.lgRonda());
  // Otra vez: nada nuevo (la terminada ya no tiene marca). Pasado el margen,
  // la reciente sin trabajo se cancela.
  const otra = await T.lgReconciliarRondas(cola, { ahora: Date.now() + 120_000 });
  assert.deepEqual(otra, { registradas: 0, canceladas: 2, enCurso: 1 });
  assert.equal(await marca('reciente'), null);
});

test('lgReconciliarRondas con la cola real: la ronda terminada tras una «recarga»', async () => {
  const almacen = almacenMemoria();
  const { T, L } = await torneo({ almacen, n: 4 });
  const r = /** @type {any} */ (await T.lgRonda());
  const ejecutores = {
    [TIPO_RONDA]: {
      unidad: async (/** @type {any} */ t, /** @type {number} */ i) =>
        res(t.params.partidos[i].fighters),
      vista: vistaParamsRonda,
      reintentable: false,
    },
  };
  const cola = new Cola({ almacen, ejecutores });
  const id = await cola.encolar({ tipo: TIPO_RONDA, params: r.params, unidades: r.n });
  assert.equal((await cola.esperar(id))?.estado, 'terminado');
  cola.detener();
  // La página se recargó antes de registrar: otra pestaña (la dueña nueva).
  const T2 = crearTorneos(depsDePrueba({ almacen, azar: rng(1) }));
  await T2.lgLoadAll();
  const cola2 = new Cola({ almacen, ejecutores });
  await cola2.reanudar();
  assert.deepEqual(await T2.lgReconciliarRondas(cola2), {
    registradas: 1,
    canceladas: 0,
    enCurso: 0,
  });
  assert.equal((await guardados(almacen, L.id)).length, 6);
  // La primera pestaña, al refrescar, ve lo registrado.
  assert.equal(await T.lgRefrescar(L.id), true);
  assert.equal(T.lg.matches.length, 6);
  assert.equal(LG.lgSeason(/** @type {any} */ (T.lg.cur)).ronda, undefined);
  cola2.detener();
});

test('con una ronda en curso: participantes, sorteo, temporada y juego bloqueados', async () => {
  /** @type {string[]} */
  const notas = [];
  for (const [fmt, n] of /** @type {const} */ ([
    ['swiss', 5],
    ['cup', 8],
  ])) {
    notas.length = 0;
    const { T, L } = await torneo({ fmt, n, notas });
    const r = /** @type {any} */ (await T.lgRonda());
    const S = LG.lgSeason(L);
    const antes = JSON.stringify(S.entrants);
    assert.equal(await T.lgAdd({ name: 'E9', dna: 'cond start 99 .up store stop end' }), false);
    assert.equal(await T.lgAddItems([]), null);
    assert.equal(await T.lgEntrantRemove(0), false);
    assert.equal(await T.lgEntrantSet(0, { qty: 7, color: '#000000' }), false);
    assert.equal(await T.lgCupRedraw(), false);
    assert.equal(await T.lgSetDraw({ mode: 'random' }), false);
    assert.equal(await T.lgRedraw(L), null);
    assert.equal(await T.lgNewSeason(L), null);
    assert.equal(L.seasons.length, 1);
    await assert.rejects(
      T.lgPlay(L, { fighters: S.entrants.slice(0, 2), label: null }),
      (/** @type {any} */ e) => e.clave === 'round-running',
    );
    assert.equal(T.lg.live, null);
    assert.deepEqual(await T.lgEdition(L), { ok: false, clave: 'round-running', params: {} });
    assert.deepEqual(await T.lgTvNext(L), { t: 'error', clave: 'round-running' });
    assert.equal(JSON.stringify(S.entrants), antes, fmt);
    assert.ok(notas.filter((x) => x === 'round-running').length >= 8, fmt);
    // Registrada, la ronda queda entera (nada se descarta por los intentos).
    const out = await T.lgRegistrarRonda(r.params, resultados(r.params));
    assert.equal(out.registrados, r.n, fmt);
    assert.equal(out.descartados, 0, fmt);
  }
});

test('como la clásica: color y cantidad bloqueados con partidos; no se quita quien jugó', async () => {
  /** @type {string[]} */
  const notas = [];
  const { T, L } = await torneo({ n: 3, notas });
  const S = LG.lgSeason(L);
  // Sin partidos: se puede.
  assert.equal(await T.lgEntrantSet(2, { qty: 4, color: '#123456' }), true);
  assert.equal(S.entrants[2].qty, 4);
  const r = /** @type {any} */ (await T.lgRonda());
  await T.lgRegistrarRonda(r.params, [res(r.params.partidos[0].fighters), null, null]);
  assert.equal(T.lg.matches.length, 1);
  assert.equal(await T.lgEntrantSet(2, { qty: 9 }), false);
  assert.equal(S.entrants[2].qty, 4);
  assert.ok(notas.includes('locked'));
  const jugo = T.lg.matches[0].fighters[0];
  const i = S.entrants.findIndex((e) => e.name === jugo);
  assert.equal(await T.lgEntrantRemove(i), false);
  assert.ok(notas.includes('entrant-played'));
  const libre = S.entrants.findIndex((e) => !T.lg.matches[0].fighters.includes(e.name));
  assert.equal(await T.lgEntrantRemove(libre), true);
});

test('params compactos: rr de 30 ida y vuelta muy por debajo de 5,9 MB; el mismo plan', async () => {
  // ADN de ~6 KB por participante (el tamaño de un bot real del foro).
  const dna = (/** @type {number} */ i) =>
    `' bot ${i}\n${Array.from({ length: 300 }, (_, g) => `cond *.eye5 ${g} > start ${i} .up store stop`).join('\n')}\nend`;
  const { T, L } = await torneo({ n: 30, dna, extra: { legs: 2 } });
  const r = /** @type {any} */ (await T.lgRonda());
  assert.equal(r.n, 870);
  assert.equal(r.params.formato, FORMATO_RONDA);
  const bytes = JSON.stringify(r.params).length;
  assert.ok(bytes < 600_000, `params de ${(bytes / 1e6).toFixed(2)} MB`);
  assert.equal(r.params.participantes.length, 30);
  assert.ok(!('plan' in r.params.partidos[0]));
  // Cada plan es el que lgPlay lanzaría con esa semilla.
  const S = LG.lgSeason(L);
  for (const i of [0, 1, 437, 869]) {
    const x = r.params.partidos[i];
    const fighters = x.fighters.map(
      (/** @type {string} */ n) => /** @type {any} */ (S.entrants.find((e) => e.name === n)),
    );
    assert.deepEqual(
      planDeRonda(r.params, i),
      planPartido(LG.lgLaunchList(S.fmt, fighters), valoresDePartido(S.fmt), x.seed, S.rules),
    );
  }
  // La vista de la cola no lleva ADN ni reglas.
  assert.ok(JSON.stringify(vistaParamsRonda(r.params)).length < 120_000);
  // Params de formato 1 (el plan en cada partido): planDeRonda lo devuelve.
  const viejo = {
    ...r.params,
    formato: 1,
    partidos: [{ ...r.params.partidos[0], plan: { x: 1 } }],
  };
  assert.deepEqual(planDeRonda(viejo, 0), { x: 1 });
  assert.throws(
    () => planDeRonda({ ...r.params, participantes: [] }, 0),
    (/** @type {any} */ e) => e.clave === 'round-bad',
  );
  // crearParamsRonda: solo los participantes de la ronda, en orden de aparición.
  const p = crearParamsRonda({
    league: L,
    season: S,
    ronda: 'R',
    orden: 'estricto',
    partidos: [
      { fighters: [S.entrants[3], S.entrants[1]], label: { clave: 'x', params: {} }, seed: 7 },
    ],
  });
  assert.deepEqual(
    p.participantes?.map((e) => e.name),
    ['E3', 'E1'],
  );
});

test('el Scratch no juega rondas en segundo plano', async () => {
  /** @type {string[]} */
  const notas = [];
  const T = crearTorneos(
    depsDePrueba({
      almacen: almacenMemoria(),
      lanzar: () => {},
      alEvento: (/** @type {any} */ ev) => ev.t === 'nota' && notas.push(ev.clave),
    }),
  );
  await T.lgLoadAll();
  assert.ok(T.lg.cur && LG.lgIsScratch(T.lg.cur));
  for (let i = 0; i < 2; i++)
    await T.lgAdd({ name: `S${i}`, dna: `cond start ${i} .up store stop end`, src: 'form' });
  assert.equal(await T.lgRonda(), null);
  assert.ok(notas.includes('round-scratch'));
});
