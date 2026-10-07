// @ts-check
// Torneo en curso (PLAN-TORNEO-EN-CURSO.md, TC2): el controlador del
// avance (src/lib/observar/tv/avance.js) contra el motor de torneos
// (engine/torneos.js), sin DOM ni pantallas: con un reloj falso, juega la
// temporada, para según «Al terminar la pelea», registra las peleas igual
// que mirándolas (el registro es el del motor), guarda y borra el id del
// torneo en curso (T9: «Reanudar» tras recargar) y se apaga con un error
// si se abre otro torneo. Al final, el texto de la franja (franjaTV) en es
// y en.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { almacenMemoria } from '../engine/almacen.js';
import * as LG from '../engine/league.js';
import { crearTorneos } from '../engine/torneos.js';
import { areaDeRuta, juntarAreas, traducir } from '../src/i18n/core.js';
import { crearAvance, debeParar } from '../src/lib/observar/tv/avance.js';
import { estadoInicial } from '../src/lib/observar/tv/maquina.js';
import { franjaTV } from '../src/lib/observar/tv/rotulo.js';
import { rng } from './util/clasica-vm.js';
import { depsDePrueba, inventarioVacio } from './util/torneos-deps.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} name */
const ent = (name) => ({ name, dna: `cond start ${name.length} .up store stop end ' ${name}` });

/** Deja correr las promesas del motor (lgEdition, lgTvNext, lgPlay). */
async function vaciar() {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
}

/**
 * Un torneo del motor con `n` participantes elegidos a mano (lista fija) y
 * el avance armado sobre él, con dobles de la página.
 * @param {Record<string, any>} fmt @param {number} n
 * @param {'parar' | 'temporada' | 'ediciones'} alTerminar
 */
async function armar(fmt, n, alTerminar) {
  /** @type {any} */
  let plan = null;
  /** @type {any[]} */
  const resultados = [];
  const T = crearTorneos(
    depsDePrueba({
      almacen: almacenMemoria(),
      azar: rng(5),
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
  for (let i = 0; i < n; i++) assert.ok(await T.lgAdd(ent(`A${i}`)));

  let reloj = 0;
  /** @type {(() => void) | null} */
  let tic = null;
  /** @type {string[]} */
  const enCurso = [];
  let abandonos = 0;
  /** @type {import('../src/lib/observar/tv/avance.js').EstadoAvance} */
  const estado = {
    e: estadoInicial(),
    ahora: 0,
    liga: '',
    final: null,
    alTerminar,
    pararTras: false,
  };
  const est = { nota: null, marcador: null, version: 0 };
  const av = crearAvance({
    estado,
    torneos: () => T,
    asegurarTorneos: async () => T,
    abrir: async (id) => T.lgSelect(T.lgFind(id)),
    abandonar: () => {
      abandonos++;
      T.leagueAbort();
    },
    asegurarBiblioteca: async () => {},
    est: () => est,
    reanudarSim: () => {},
    ahora: () => reloj,
    reloj: {
      poner: (fn) => {
        tic = fn;
        return 1;
      },
      quitar: () => {
        tic = null;
      },
    },
    enCurso: {
      guardar: (id) => enCurso.push(`+${id}`),
      borrar: () => enCurso.push('-'),
    },
    textoError: (e) => String(e),
  });

  /** Termina la pelea en juego: la gana el primero del plan. */
  async function terminarPelea() {
    const names = plan.species.map((/** @type {any} */ s) => s.name.replace(/\.txt$/, ''));
    await T.leagueOnMessage({ t: 'f1-started', n: names.length });
    await T.leagueOnMessage({
      t: 'f1-over',
      winner: names[0],
      f1: { sp: names.map((name, i) => ({ name, wins: i ? 0 : 3, capWins: 0 })) },
      cycles: 500,
    });
  }

  /**
   * Avanza el reloj de a 10 s y termina cada pelea en juego hasta que el
   * avance se apaga (o `hasta(estado)` da true).
   * @param {(e: typeof estado) => boolean} [hasta]
   */
  async function correr(hasta = () => false) {
    /** @type {string[]} */
    const fases = [];
    for (let g = 0; g < 3000; g++) {
      await vaciar();
      fases.push(estado.e.fase);
      if (estado.e.fase === 'apagado' || estado.e.fase === 'error' || hasta(estado)) break;
      if (estado.e.fase === 'partido' && T.lg.live) await terminarPelea();
      reloj += 10_000;
      tic?.();
    }
    return fases;
  }

  return {
    T,
    L,
    av,
    estado,
    est,
    resultados,
    enCurso,
    correr,
    terminarPelea,
    abandonos: () => abandonos,
    hayReloj: () => tic !== null,
  };
}

test('avance: «hasta el final de la temporada» juega todas las peleas sin pantallas y para tras el campeón', async () => {
  const a = await armar({ format: 'rr' }, 4, 'temporada');
  await a.av.iniciar({ pausa: 3 });
  assert.equal(a.estado.liga, a.L.id);
  assert.deepEqual(a.enCurso, [`+${a.L.id}`]);
  assert.ok(a.hayReloj());
  const fases = await a.correr();
  assert.equal(a.estado.e.fase, 'apagado');
  assert.ok(fases.includes('campeon'));
  // las 6 peleas de la temporada, registradas por el motor (como mirándolas)
  assert.equal(a.resultados.length, 6);
  assert.equal(a.T.lgSeasonMatches(1).length, 6);
  assert.ok(LG.lgSeasonDone(LG.lgSeason(a.L), a.T.lgSeasonMatches(1)));
  // la lista elegida a mano no se volvió a sortear
  assert.ok(LG.lgSeason(a.L).entrants.every((/** @type {any} */ e) => /^A\d$/.test(e.name)));
  // al apagarse borra el torneo en curso y suelta el reloj
  assert.deepEqual(a.enCurso, [`+${a.L.id}`, '-']);
  assert.equal(a.hayReloj(), false);
  assert.ok(a.est.version > 0);
});

test('avance: «parar» juega una pelea; «ediciones» sigue con la temporada siguiente', async () => {
  const p = await armar({ format: 'rr' }, 4, 'parar');
  await p.av.iniciar({ pausa: 0 });
  await p.correr();
  assert.equal(p.estado.e.fase, 'apagado');
  assert.equal(p.resultados.length, 1);

  const ed = await armar({ format: 'rr' }, 3, 'ediciones');
  await ed.av.iniciar({ pausa: 0 });
  await ed.correr((e) => e.e.temporada === 2 && e.e.fase === 'partido');
  assert.equal(ed.estado.e.temporada, 2);
  assert.equal(ed.T.lgSeasonMatches(1).length, 3);
  assert.equal(LG.lgSeason(ed.L).no, 2);
  ed.av.detener();
  assert.equal(ed.estado.e.fase, 'apagado');
});

test('avance: Parar con una pelea en juego la deja registrarse; Abandonar la corta sin registrarla', async () => {
  const a = await armar({ format: 'rr' }, 4, 'temporada');
  await a.av.iniciar({ pausa: 0 });
  await a.correr((e) => e.e.fase === 'partido');
  assert.ok(a.av.hayPelea());
  a.av.parar();
  assert.equal(a.estado.pararTras, true);
  a.av.seguir();
  assert.equal(a.estado.pararTras, false);
  a.av.parar();
  await a.correr();
  assert.equal(a.estado.e.fase, 'apagado');
  assert.equal(a.resultados.length, 1);
  assert.equal(a.estado.pararTras, false);

  const b = await armar({ format: 'rr' }, 4, 'temporada');
  await b.av.iniciar({ pausa: 0 });
  await b.correr((e) => e.e.fase === 'partido');
  assert.ok(b.T.lg.live);
  b.av.abandonarPelea();
  assert.equal(b.estado.e.fase, 'apagado');
  assert.equal(b.abandonos(), 1);
  assert.equal(b.T.lg.live, null);
  assert.equal(b.resultados.length, 0);
  assert.equal(b.enCurso.at(-1), '-');
  // sin pelea en juego, Parar apaga ya
  const c = await armar({ format: 'rr' }, 4, 'temporada');
  await c.av.iniciar({ pausa: 30 });
  await vaciar();
  assert.equal(c.estado.e.fase, 'cortinilla');
  c.av.parar();
  assert.equal(c.estado.e.fase, 'apagado');
});

test('avance: toma la pelea del torneo ya en juego, se apaga con otro torneo abierto y sin torneo no guarda nada', async () => {
  const a = await armar({ format: 'rr' }, 4, 'temporada');
  // una pelea lanzada desde Competir antes de encender el avance
  const fx = await a.T.lgTvNext(a.L);
  await a.T.lgPlay(a.L, fx.fx);
  const vivo = a.T.lg.live;
  await a.av.iniciar({ pausa: 0 });
  assert.equal(a.estado.e.fase, 'partido');
  assert.equal(a.T.lg.live, vivo);
  assert.equal(a.abandonos(), 0);
  await a.correr((e) => e.e.fase === 'resultado');
  assert.equal(a.resultados.length, 1);
  // otro torneo abierto: error en el tic siguiente (el id sigue para «Reanudar»)
  await a.T.lgCreate({});
  a.av.tic();
  assert.equal(a.estado.e.fase, 'error');
  assert.equal(a.estado.e.error?.clave, 'tv-otro-torneo');
  assert.equal(a.enCurso.at(-1), `+${a.L.id}`);
  a.av.detener();
  assert.equal(a.enCurso.at(-1), '-');

  const b = await armar({ format: 'rr' }, 4, 'temporada');
  await b.T.lgSelect(null);
  await b.av.iniciar({ pausa: 0 });
  assert.equal(b.estado.e.fase, 'error');
  assert.equal(b.estado.e.error?.clave, 'tv-sin-torneo');
  assert.deepEqual(b.enCurso, []);
  assert.equal(b.hayReloj(), false);
});

test('avance: debeParar según «Al terminar la pelea» y el Parar pedido', () => {
  const e = (/** @type {any} */ x) => ({ ...estadoInicial(), ...x });
  const cort = (/** @type {number} */ pelea) => e({ fase: 'cortinilla', pelea });
  const p = (/** @type {any} */ alTerminar, pararTras = false) => ({ alTerminar, pararTras });
  assert.equal(debeParar(e({ fase: 'buscando' }), cort(1), p('parar')), false);
  assert.equal(debeParar(e({ fase: 'buscando' }), cort(2), p('parar')), true);
  assert.equal(debeParar(e({ fase: 'buscando' }), cort(2), p('temporada')), false);
  assert.equal(debeParar(e({ fase: 'buscando' }), cort(1), p('ediciones', true)), true);
  const fin = [e({ fase: 'campeon' }), e({ fase: 'edicion' })];
  assert.equal(debeParar(fin[0], fin[1], p('temporada')), true);
  assert.equal(debeParar(fin[0], fin[1], p('ediciones')), false);
  assert.equal(debeParar(fin[0], fin[1], p('ediciones', true)), true);
});

test('franja: título con el progreso y estado de cada fase, sin claves sueltas en es y en', () => {
  const archivos = [];
  for (const idioma of ['es', 'en']) {
    const dir = path.join(RAIZ, 'src', 'i18n', idioma);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const a = /** @type {{idioma: string, area: string}} */ (areaDeRuta(`${idioma}/${f}`));
      archivos.push({ ...a, dic: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) });
    }
  }
  const DICS = juntarAreas(archivos);
  for (const idioma of ['es', 'en']) {
    const tr = {
      /** @param {string} k @param {Record<string, string | number>} [x] */
      t: (k, x) => {
        assert.ok(Object.hasOwn(DICS[idioma], k), `${idioma}: falta ${k}`);
        return traducir(DICS, idioma, k, x);
      },
      num: (/** @type {number} */ n) => String(n),
    };
    for (const k of ['ver', 'ver.ayuda', 'cortado', 'reanudar', 'reanudar.ayuda', 'descartar'])
      tr.t(`observar.tv.franja.${k}`, { torneo: 'X' });
    const ctx = { torneo: 'Liga', formato: 'rr', progreso: '2 de 6' };
    const fx = { fighters: [{ name: 'A0' }, { name: 'A1' }], label: null };
    const casos = [
      { fase: 'edicion' },
      { fase: 'cortinilla', pelea: 3, fx, hasta: 5000 },
      { fase: 'lanzando', pelea: 3, fx },
      { fase: 'partido', pelea: 3, fx },
      { fase: 'resultado', pelea: 3, fx, ganador: 'A0' },
      { fase: 'campeon', campeon: { name: 'A0', how: 'table' } },
      { fase: 'error', error: { clave: 'tv-otro-torneo', params: {} } },
    ];
    for (const c of casos) {
      const f = franjaTV(
        { ...estadoInicial(), temporada: 2, ...c },
        ctx,
        tr,
        0,
        c.fase === 'partido',
      );
      assert.ok(f.titulo.includes('Liga') && f.titulo.endsWith('2 de 6'), f.titulo);
      assert.ok(f.estado.length > 0, c.fase);
      assert.doesNotMatch(`${f.titulo} ${f.estado}`, /\{\w+\}|observar\.tv/);
      assert.equal(f.vivo, c.fase === 'partido');
      assert.equal(f.error, c.fase === 'error');
      if (c.fase === 'resultado') assert.ok(f.estado.includes('A0'));
      if (c.fase === 'partido') assert.ok(f.estado.includes(tr.t('observar.tv.parara')));
    }
  }
});
