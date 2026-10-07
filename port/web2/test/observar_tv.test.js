// @ts-check
// Modo TV (paso N3.6, decisión 23): la secuencia pura (src/lib/observar/tv/
// maquina.js) contra el motor de torneos (engine/torneos.js: lgEdition,
// lgTvNext, lgPlay) con resultados sintéticos, el rótulo de cada fase
// (rotulo.js) con los textos de es y en, y los cabos sueltos del Nivel 3
// que se verifican sin DOM (el filtro «cambios» de Analizar › Eventos).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { almacenMemoria } from '../engine/almacen.js';
import * as LG from '../engine/league.js';
import { crearTorneos } from '../engine/torneos.js';
import { areaDeRuta, juntarAreas, traducir } from '../src/i18n/core.js';
import { filtrarEventos, filtroDe } from '../src/lib/analizar/eventos.js';
import { CLAVES_TV } from '../src/lib/competir/textos.js';
import {
  activo,
  CAMPEON_S,
  claveRegistro,
  cuenta,
  ESPERA_REGISTRO_MS,
  estadoInicial,
  FALLOS_MAX,
  PAUSA_DEF,
  paso,
  pausaValida,
  RESPIRO_MS,
  registrosPrevios,
  TV_ERRORES,
  vigilarPartido,
} from '../src/lib/observar/tv/maquina.js';
import { anuncioTV, rotuloTV, textoErrorTv } from '../src/lib/observar/tv/rotulo.js';
import { rng } from './util/clasica-vm.js';
import { depsDePrueba, inventarioVacio } from './util/torneos-deps.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Todos los diccionarios (es y en). */
function diccionarios() {
  const archivos = [];
  for (const idioma of ['es', 'en']) {
    const dir = path.join(RAIZ, 'src', 'i18n', idioma);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const a = /** @type {{idioma: string, area: string}} */ (areaDeRuta(`${idioma}/${f}`));
      archivos.push({ ...a, dic: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) });
    }
  }
  return juntarAreas(archivos);
}
const DICS = diccionarios();

/** Traductor que anota las claves que faltan. @param {'es' | 'en'} idioma */
function traductor(idioma) {
  /** @type {string[]} */
  const faltan = [];
  const tr = {
    /** @param {string} clave @param {Record<string, string | number>} [p] */
    t: (clave, p) => {
      if (!Object.hasOwn(DICS[idioma], clave)) faltan.push(clave);
      return traducir(DICS, idioma, clave, p);
    },
    num: (/** @type {number} */ n) => String(n),
  };
  return { tr, faltan };
}

/** @param {string} s @param {string} donde */
function limpio(s, donde) {
  assert.doesNotMatch(s, /(observar|competir)\.[a-z]/, `${donde}: clave sin texto (${s})`);
  assert.doesNotMatch(s, /\{\w+\}/, `${donde}: marcador sin reemplazar (${s})`);
}

/** @param {string} name */
const ent = (name) => ({ name, dna: `cond start ${name.length} .up store stop end ' ${name}` });

/**
 * Juega con la máquina del TV (sin temporizadores: cada tic adelanta el
 * reloj) un torneo del motor; cada pelea la gana el primero del sorteo.
 * Devuelve las fases por las que pasó, los rótulos de las cortinillas y
 * los campeones anunciados.
 * @param {Record<string, any>} fmt @param {number} n @param {number} ediciones
 */
async function jugarTv(fmt, n, ediciones, idioma = /** @type {'es' | 'en'} */ ('es')) {
  /** @type {any} */
  let plan = null;
  /** @type {any[]} */
  const resultados = [];
  let k = 0;
  const T = crearTorneos(
    depsDePrueba({
      almacen: almacenMemoria(),
      nuevoId: () => `T${++k}`,
      azar: rng(7),
      // el pool del sorteo: el TV sortea cada edición (lgEdition)
      inventario: {
        ...inventarioVacio(),
        items: Array.from({ length: n }, (_, i) => ({ key: `k${i}`, b: { name: `E${i}` } })),
        fetchDna: async (/** @type {any} */ b) => ent(b.name).dna,
      },
      lanzar: (/** @type {any} */ p) => {
        plan = p;
      },
      alEvento: (/** @type {any} */ ev) => {
        if (ev.t === 'resultado') resultados.push(ev.rec);
      },
    }),
  );
  await T.lgLoadAll();
  const L = await T.lgCreate({ 'o-11': '5' });
  for (const [c, v] of Object.entries(fmt)) assert.ok(await T.lgSetFmt(c, v), c);
  assert.ok(await T.lgSetDraw({ mode: 'fixed', pool: 'all', n }));

  const { tr, faltan } = traductor(idioma);
  const ctx = { torneo: L.name, formato: fmt.format };
  let ahora = 0;
  let r = paso(estadoInicial(), { t: 'iniciar', pausa: 3 });
  /** @type {string[]} */
  const fases = [];
  /** @type {string[]} */
  const cortinillas = [];
  /** @type {any[]} */
  const campeones = [];
  /** @type {Set<string>} */
  let previos = new Set();
  /** @type {any} */
  let vivo = null;
  for (let g = 0; g < 2000 && campeones.length < ediciones; g++) {
    const e = r.e;
    fases.push(e.fase);
    const rot = rotuloTV(e, ctx, tr, ahora, idioma);
    for (const v of Object.values(rot)) if (typeof v === 'string') limpio(v, e.fase);
    limpio(anuncioTV(e, tr), `anuncio ${e.fase}`);
    assert.ok(activo(e), `${e.fase}: ${JSON.stringify(e.error)}`);
    if (r.accion === 'edicion') r = paso(e, { t: 'edicion', r: await T.lgEdition(L) });
    else if (r.accion === 'siguiente')
      r = paso(e, { t: 'siguiente', r: await T.lgTvNext(L), ahora });
    else if (r.accion === 'lanzar') {
      previos = registrosPrevios(T.lg.matches, L.id);
      await T.lgPlay(L, /** @type {any} */ (e.fx));
      vivo = T.lg.live;
      r = paso(e, { t: 'lanzado', ok: true });
    } else if (e.fase === 'cortinilla') {
      cortinillas.push(`${rot.vs.map((f) => f.name).join(' vs ')} · ${rot.etiqueta}`);
      assert.equal(cuenta(e, ahora), 3);
      ahora = e.hasta;
      r = paso(e, { t: 'tic', ahora });
    } else if (e.fase === 'partido') {
      assert.ok(rot.vivo);
      const names = plan.species.map((/** @type {any} */ s) => s.name.replace(/\.txt$/, ''));
      /** @param {boolean} enJuego */
      const vigilar = (enJuego) =>
        vigilarPartido({
          enJuego,
          matches: T.lg.matches,
          liga: L.id,
          temporada: LG.lgSeason(L).no,
          luchadores: (e.fx?.fighters ?? []).map((f) => f.name),
          previos,
          nota: null,
          notaAntes: 0,
          sinJuegoDesde: ahora,
          ahora,
        });
      assert.equal(vigilar(!!T.lg.live && T.lg.live === vivo), null, 'en juego');
      for (const m of [
        { t: 'f1-started', n: names.length },
        {
          t: 'f1-over',
          winner: names[0],
          f1: { sp: names.map((name, i) => ({ name, wins: i ? 0 : 3, capWins: 0 })) },
          cycles: 500,
        },
      ])
        await T.leagueOnMessage(m);
      assert.equal(T.lg.live, null);
      const ev = vigilar(false);
      assert.equal(ev?.t, 'resultado');
      assert.equal(/** @type {any} */ (ev).rec, resultados.at(-1));
      r = paso(e, /** @type {any} */ (ev));
      assert.equal(r.e.ganador, names[0]);
    } else if (e.fase === 'resultado') {
      assert.ok(rot.ganador.includes(e.ganador));
      ahora += RESPIRO_MS;
      r = paso(e, { t: 'tic', ahora });
    } else if (e.fase === 'campeon') {
      campeones.push({ temporada: e.temporada, campeon: e.campeon, como: rot.como });
      assert.equal(cuenta(e, ahora), CAMPEON_S);
      ahora = e.hasta;
      r = paso(e, { t: 'tic', ahora });
    } else assert.fail(`fase sin acción: ${e.fase}`);
  }
  assert.deepEqual(faltan, []);
  return { T, L, fases, cortinillas, campeones, resultados };
}

test('TV: copa de 8 — grupos, semifinales, tercer puesto, final, campeón y edición nueva', async () => {
  const { T, L, cortinillas, campeones, resultados } = await jugarTv(
    { format: 'cup', third: true },
    8,
    2,
  );
  // 12 de grupos + 2 semis + tercer puesto + final = 16 por edición
  assert.equal(campeones.length, 2);
  assert.deepEqual(
    campeones.map((c) => c.temporada),
    [1, 2],
  );
  for (const c of campeones) {
    assert.ok(c.campeon?.name);
    assert.equal(c.como, 'gana la final');
  }
  assert.equal(resultados.filter((m) => m.season === 1).length, 16);
  assert.ok(cortinillas[0].endsWith('GRUPO A · JORNADA 1 DE 3'), cortinillas[0]);
  const ed1 = cortinillas.slice(0, 16);
  assert.equal(ed1.filter((c) => c.includes('SEMIFINAL')).length, 2);
  assert.ok(ed1[14].endsWith('TERCER PUESTO'), ed1[14]);
  assert.ok(ed1[15].endsWith('FINAL'), ed1[15]);
  assert.match(ed1[15], /^E\d vs E\d · FINAL$/);
  // la segunda edición es otra temporada del mismo torneo, con sus grupos
  assert.equal(LG.lgSeason(L).no, 2);
  assert.ok(T.lgSeasonMatches(2).length > 0);
});

test('TV: todos contra todos y escalera juegan la temporada entera sin intervención', async () => {
  const rr = await jugarTv({ format: 'rr' }, 4, 1, 'en');
  assert.equal(rr.resultados.length, 6);
  assert.match(rr.cortinillas[0], /^E\d vs E\d · Fixture 1 of 6$/);
  assert.equal(rr.campeones[0].como, 'tops the table');
  const esc = await jugarTv({ format: 'ladder' }, 4, 1);
  assert.ok(esc.campeones[0].campeon?.name);
});

test('TV: la máquina — pausa, fallos de lanzamiento, nulos, abandono, respuestas viejas', () => {
  assert.equal(pausaValida('x'), PAUSA_DEF);
  assert.equal(pausaValida(-3), 0);
  assert.equal(pausaValida('99'), 60);
  let r = paso(estadoInicial(), { t: 'iniciar', pausa: 2 });
  assert.equal(r.accion, 'edicion');
  // una respuesta que no corresponde a la fase se ignora
  assert.equal(paso(r.e, { t: 'siguiente', r: { t: 'fin' }, ahora: 0 }).e, r.e);
  r = paso(r.e, { t: 'edicion', r: { ok: true, season: 4 } });
  assert.equal(r.e.temporada, 4);
  assert.equal(r.accion, 'siguiente');
  const fx = { fighters: [{ name: 'A' }, { name: 'B' }], label: { clave: 'rr', params: {} } };
  const pelea = paso(r.e, { t: 'siguiente', r: { t: 'pelea', fx }, ahora: 1000 });
  assert.equal(pelea.e.fase, 'cortinilla');
  assert.equal(pelea.e.hasta, 3000);
  assert.equal(paso(pelea.e, { t: 'tic', ahora: 2999 }).e.fase, 'cortinilla');
  // lanzamientos fallidos: vuelve a buscar con aviso; más de FALLOS_MAX seguidos, se apaga
  let e = pelea.e;
  for (let i = 0; i <= FALLOS_MAX; i++) {
    const l = paso(e, { t: 'tic', ahora: e.hasta });
    assert.equal(l.accion, 'lanzar');
    const f = paso(l.e, { t: 'lanzado', ok: false, detalle: 'sin ADN' });
    if (i < FALLOS_MAX) {
      assert.equal(f.accion, 'siguiente');
      assert.equal(f.e.aviso?.clave, 'no-arranco');
      e = paso(f.e, { t: 'siguiente', r: { t: 'pelea', fx }, ahora: 0 }).e;
    } else {
      assert.equal(f.e.fase, 'error');
      assert.equal(f.e.error?.clave, 'tv-fallos-lanzar');
    }
  }
  // nulos seguidos
  e = paso(pelea.e, { t: 'tic', ahora: 5000 }).e;
  e = paso(e, { t: 'lanzado', ok: true }).e;
  for (let i = 0; i <= FALLOS_MAX; i++) {
    const x = paso(e, { t: 'resultado', rec: { winner: '' }, ahora: 0 });
    if (i < FALLOS_MAX) {
      assert.equal(x.e.fase, 'resultado');
      e = { ...x.e, fase: 'partido' };
    } else assert.equal(x.e.error?.clave, 'tv-fallos-nulos');
  }
  // una victoria reinicia la cuenta de fallos
  const g = paso({ ...e, fallos: 3 }, { t: 'resultado', rec: { winner: 'A' }, ahora: 0 });
  assert.equal(g.e.fallos, 0);
  // abandono durante la pelea
  assert.equal(paso(e, { t: 'abandonado' }).e.error?.clave, 'tv-abandonado');
  // errores del motor (bloqueo por ronda en segundo plano)
  const bloq = paso(paso(estadoInicial(), { t: 'iniciar' }).e, {
    t: 'edicion',
    r: { ok: false, clave: 'round-running', params: {} },
  });
  assert.equal(bloq.e.fase, 'error');
  assert.equal(bloq.e.error?.clave, 'round-running');
  assert.equal(
    paso(r.e, { t: 'siguiente', r: { t: 'error', clave: 'round-running' }, ahora: 0 }).e.error
      ?.clave,
    'round-running',
  );
  // detener y entrar con una pelea en juego
  assert.equal(paso(e, { t: 'detener' }).e.fase, 'apagado');
  const enCurso = paso(estadoInicial(), { t: 'iniciar', enCurso: fx, temporada: 2 });
  assert.equal(enCurso.e.fase, 'partido');
  assert.equal(enCurso.accion, null);
  // el campeón: max(CAMPEON_S, pausa)
  const fin = paso(
    { ...estadoInicial(), fase: 'buscando', pausa: 20 },
    { t: 'siguiente', r: { t: 'fin', champ: { name: 'A', how: 'table' } }, ahora: 0 },
  );
  assert.equal(fin.e.hasta, 20000);
  assert.equal(paso(fin.e, { t: 'tic', ahora: 20000 }).accion, 'edicion');
});

test('TV: vigilarPartido — resultado, abandono y en juego sin depender del último resultado ni de la última nota', () => {
  const rec = (
    /** @type {string} */ league,
    /** @type {number} */ no,
    winner = 'A',
    season = 2,
  ) => ({
    league,
    season,
    no,
    fighters: ['A', 'B'],
    winner,
  });
  // antes de lanzar: la pelea 1 de la temporada 2, con los mismos luchadores (revancha)
  const antes = [rec('L1', 1), rec('L1', 3, 'A', 1)];
  const previos = registrosPrevios(antes, 'L1');
  assert.deepEqual([...previos].sort(), ['1:3', '2:1']);
  assert.equal(claveRegistro({ season: 2, no: 1 }), '2:1');
  const base = {
    enJuego: false,
    matches: antes,
    liga: 'L1',
    temporada: 2,
    luchadores: ['B', 'A'],
    previos,
    nota: /** @type {{clave: string, n: number} | null} */ ({ clave: 'match-won', n: 3 }),
    notaAntes: 3,
    sinJuegoDesde: 1000,
    ahora: 1000,
  };
  // la pelea sigue en juego: nada, aunque haya una nota de abandono (de otra cosa)
  assert.equal(
    vigilarPartido({ ...base, enJuego: true, nota: { clave: 'abandoned', n: 9 } }),
    null,
  );
  // terminó y se está registrando: todavía nada (la revancha vieja no cuenta)
  assert.equal(vigilarPartido(base), null, 'registrándose');
  // el registro nuevo de la pelea del TV
  const nuevo = rec('L1', 2, 'B');
  const ok = vigilarPartido({ ...base, matches: [...antes, nuevo] });
  assert.equal(ok?.t, 'resultado');
  assert.equal(/** @type {any} */ (ok).rec, nuevo);
  // caso del revisor: justo después se registra una ronda en segundo plano de
  // otro torneo (el «último resultado» ya no es el del TV) y llega otra nota
  const otra = rec('L2', 1, 'C');
  const pisado = vigilarPartido({
    ...base,
    matches: [...antes, nuevo, otra],
    nota: { clave: 'round-recorded', n: 5 },
  });
  assert.equal(/** @type {any} */ (pisado).rec, nuevo, 'se encuentra igual');
  // resultados de otras ligas o de otra temporada o con otros luchadores: se ignoran
  assert.equal(vigilarPartido({ ...base, matches: [...antes, otra] }), null, 'otra liga');
  assert.equal(vigilarPartido({ ...base, matches: [...antes, rec('L1', 1, 'A', 3)] }), null);
  assert.equal(
    vigilarPartido({ ...base, matches: [...antes, { ...rec('L1', 2), fighters: ['A', 'C'] }] }),
    null,
    'otros luchadores',
  );
  // abandono: la nota posterior al lanzamiento
  assert.equal(vigilarPartido({ ...base, nota: { clave: 'abandoned', n: 4 } })?.t, 'abandonado');
  // caso del revisor: la nota de abandono la pisa otra (ronda registrada) →
  // sin registro en ESPERA_REGISTRO_MS, abandonado igual
  const pisada = { ...base, nota: { clave: 'round-recorded', n: 5 } };
  assert.equal(vigilarPartido({ ...pisada, ahora: 1000 + ESPERA_REGISTRO_MS - 1 }), null);
  assert.equal(vigilarPartido({ ...pisada, ahora: 1000 + ESPERA_REGISTRO_MS })?.t, 'abandonado');
  // un abandono viejo (anterior al lanzamiento) no cuenta
  assert.equal(vigilarPartido({ ...base, nota: { clave: 'abandoned', n: 3 } }), null);
});

test('TV: todos los errores (del motor y propios) y las fases tienen texto en es y en', () => {
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const { tr, faltan } = traductor(idioma);
    for (const clave of [...CLAVES_TV, ...TV_ERRORES]) {
      const s = textoErrorTv({ clave, params: { pool: 'all', n: 5, detalle: 'x' } }, tr);
      assert.ok(s.trim(), clave);
      limpio(s, clave);
    }
    const fx = {
      fighters: [{ name: 'A', color: '#f00' }, { name: 'B' }],
      label: { clave: 'cup-ko', params: { ties: 2, match: 1 } },
    };
    const e = {
      ...estadoInicial(),
      pelea: 3,
      temporada: 2,
      fx,
      ganador: 'A',
      campeon: { name: 'A', how: 'cup' },
      error: { clave: 'tv-excepcion', params: { detalle: 'x' } },
      aviso: { clave: 'no-arranco', params: { n: 2, detalle: 'x' } },
    };
    for (const fase of /** @type {const} */ ([
      'edicion',
      'buscando',
      'cortinilla',
      'lanzando',
      'partido',
      'resultado',
      'campeon',
      'error',
    ])) {
      const r = rotuloTV({ ...e, fase }, { torneo: 'Copa', formato: 'cup' }, tr, 0, idioma);
      for (const v of Object.values(r)) if (typeof v === 'string') limpio(v, `${idioma} ${fase}`);
      assert.ok(r.linea, fase);
      // la región viva: solo los cambios de fase, sin la cuenta atrás
      const a = anuncioTV({ ...e, fase, hasta: 7000 }, tr);
      limpio(a, `anuncio ${idioma} ${fase}`);
      assert.equal(!!a, !['edicion', 'buscando', 'lanzando'].includes(fase), fase);
      assert.equal(a, anuncioTV({ ...e, fase, hasta: 1000 }, tr), 'no depende de la cuenta');
    }
    const c = rotuloTV({ ...e, fase: 'cortinilla' }, { torneo: 'Copa', formato: 'cup' }, tr, 0);
    assert.equal(c.vs[1].color, LG.LG_NO_COLOR);
    assert.ok(c.grande);
    assert.equal(c.etiqueta, c.etiqueta.toUpperCase());
    // el pie del campeón según el sorteo del torneo (la lista fija pasa entera
    // a la edición nueva; las otras se sortean)
    const pie = (/** @type {string} */ sorteo) =>
      rotuloTV({ ...e, fase: 'campeon' }, { torneo: 'Copa', formato: 'rr', sorteo }, tr, 0).pie;
    assert.equal(new Set(['fixed', 'random', 'fight'].map(pie)).size, 3);
    assert.deepEqual(faltan, []);
  }
});

test('Analizar › Eventos: los cambios de objetos del mundo entran en el filtro «cambios»', () => {
  const eventos = [
    { ciclo: 10, tipo: 'cambio', params: {} },
    { ciclo: 20, tipo: 'objetos', params: { orden: { t: 'forma' } } },
    { ciclo: 30, tipo: 'extincion', params: {} },
  ];
  assert.equal(filtroDe('objetos'), 'cambios');
  assert.deepEqual(
    filtrarEventos(eventos, 'cambios').map((e) => e.tipo),
    ['cambio', 'objetos'],
  );
});

test('tv: lgEdition sin sortear juega la lista elegida a mano; con sorteo (la clásica) la vuelve a sortear', async () => {
  const T = crearTorneos(
    depsDePrueba({
      almacen: almacenMemoria(),
      azar: rng(3),
      inventario: {
        ...inventarioVacio(),
        items: Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, b: { name: `E${i}` } })),
        fetchDna: async (/** @type {any} */ b) => ent(b.name).dna,
      },
    }),
  );
  await T.lgLoadAll();
  const L = await T.lgCreate({});
  assert.ok(await T.lgSetDraw({ mode: 'fixed', pool: 'all', n: 4 }));
  for (const n of ['A', 'B']) assert.ok(await T.lgAdd({ name: n, dna: ent(n).dna }));
  const nombres = () => LG.lgSeason(L).entrants.map((/** @type {any} */ e) => e.name);
  const r = await T.lgEdition(L, { sortear: false });
  assert.equal(r.ok, true);
  assert.deepEqual(nombres(), ['A', 'B']);
  await T.lgEdition(L);
  assert.equal(nombres().length, 4);
  assert.ok(nombres().every((n) => /^E\d$/.test(n)));
});

test('tv: sin sortear, la temporada nueva tras el campeón conserva la lista fija; la de sorteo se sortea', async () => {
  for (const mode of ['fixed', 'random']) {
    /** @type {any} */
    let plan = null;
    const T = crearTorneos(
      depsDePrueba({
        almacen: almacenMemoria(),
        azar: rng(3),
        inventario: {
          ...inventarioVacio(),
          items: Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, b: { name: `E${i}` } })),
          fetchDna: async (/** @type {any} */ b) => ent(b.name).dna,
        },
        lanzar: (/** @type {any} */ p) => {
          plan = p;
        },
      }),
    );
    await T.lgLoadAll();
    const L = await T.lgCreate({});
    assert.ok(await T.lgSetDraw({ mode: 'fixed', pool: 'all', n: 4 }));
    for (const n of ['A', 'B', 'C']) assert.ok(await T.lgAdd({ name: n, dna: ent(n).dna }));
    if (mode === 'random') assert.ok(await T.lgSetDraw({ mode, pool: 'all', n: 4 }));
    const nombres = () => LG.lgSeason(L).entrants.map((/** @type {any} */ e) => e.name);
    assert.equal((await T.lgEdition(L, { sortear: false })).ok, true);
    const antes = nombres();
    // la temporada entera: gana siempre el primero del sorteo
    let r = await T.lgTvNext(L);
    for (let i = 0; r.t === 'pelea' && i < 50; i++, r = await T.lgTvNext(L)) {
      await T.lgPlay(L, r.fx);
      const sp = plan.species.map((/** @type {any} */ s) => s.name.replace(/\.txt$/, ''));
      await T.leagueOnMessage({ t: 'f1-started', n: sp.length });
      await T.leagueOnMessage({
        t: 'f1-over',
        winner: sp[0],
        f1: {
          sp: sp.map((/** @type {string} */ name, j) => ({ name, wins: j ? 0 : 3, capWins: 0 })),
        },
        cycles: 500,
      });
    }
    assert.equal(r.t, 'fin', mode);
    const e = await T.lgEdition(L, { sortear: false });
    assert.equal(e.ok, true, mode);
    assert.equal(e.season, 2, mode);
    if (mode === 'fixed') assert.deepEqual(nombres(), antes);
    else {
      assert.equal(nombres().length, 4);
      assert.ok(
        nombres().every((n) => /^E\d$/.test(n)),
        nombres().join(),
      );
    }
  }
});
