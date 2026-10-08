// @ts-check
// Competir (paso N3.5): lo puro de la interfaz. El asistente «Nuevo torneo»
// (estado, validaciones, esquema, plan de creación, reglas-escenario), el
// sorteo de claves de la Biblioteca, los datos de las vistas y el mapeo de
// claves a textos: TODAS las claves que engine/{league,torneos,rondas,
// partido}.js pueden devolver (notas, registro, rótulos, avance, sorteo,
// errores, modo TV, cómo se ganó) tienen texto en es y en.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESCENARIOS_FABRICA } from '../engine/escenarios/fabrica.js';
import * as LG from '../engine/league.js';
import { costosNinguno } from '../engine/opciones.js';
import { NOTA_CENSO_VACIO, NOTA_UNA_ESPECIE } from '../engine/partido.js';
import { juntarAreas, traducir } from '../src/i18n/core.js';
import * as A from '../src/lib/competir/asistente.js';
import * as X from '../src/lib/competir/textos.js';
import * as V from '../src/lib/competir/vistas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Los diccionarios de competir.json (es y en). */
function diccionarios() {
  const archivos = ['es', 'en'].map((idioma) => ({
    idioma,
    area: 'competir',
    dic: JSON.parse(
      fs.readFileSync(path.join(RAIZ, 'src', 'i18n', idioma, 'competir.json'), 'utf8'),
    ),
  }));
  return juntarAreas(archivos);
}
const DICS = diccionarios();

/**
 * Traductor de un idioma que ANOTA las claves que faltan (traducir
 * devuelve la clave misma si no está).
 * @param {'es' | 'en'} idioma
 */
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

/** Texto sin claves ni marcadores sin reemplazar. @param {string} s @param {string} donde */
function limpio(s, donde) {
  assert.ok(s?.trim(), `${donde}: vacío`);
  assert.doesNotMatch(s, /competir\.[a-z]/, `${donde}: clave sin texto (${s})`);
  assert.doesNotMatch(s, /\{\w+\}/, `${donde}: marcador sin reemplazar (${s})`);
}

/** Fuente de un archivo del motor. @param {string} f */
const fuente = (f) => fs.readFileSync(path.join(RAIZ, 'engine', f), 'utf8');

/**
 * Las claves literales de las llamadas `nombre(` de una fuente: cada texto
 * entre comillas dentro de los primeros argumentos (también los ternarios:
 * lgNote(ok ? 'a' : 'b', …)).
 * @param {string} src @param {string} nombre
 */
function clavesDeLlamadas(src, nombre) {
  const out = new Set();
  const re = new RegExp(`\\b${nombre}\\(`, 'g');
  for (const m of src.matchAll(re)) {
    // hasta la primera coma o el primer { de nivel 0 (el objeto de params)
    let i = /** @type {number} */ (m.index) + m[0].length;
    let nivel = 0;
    let tramo = '';
    for (; i < src.length; i++) {
      const c = src[i];
      if (nivel === 0 && (c === ',' || c === '{')) break;
      if (c === '(') nivel++;
      if (c === ')') {
        if (nivel === 0) break;
        nivel--;
      }
      tramo += c;
    }
    for (const q of tramo.matchAll(/'([a-z][a-z0-9-]*)'/g)) out.add(q[1]);
  }
  return out;
}

// ---- asistente -------------------------------------------------------------------------

test('asistente: estado inicial, formato y valores acotados como lgFmtSet', () => {
  const a = A.nuevoAsistente();
  assert.equal(a.paso, 1);
  assert.equal(a.fmt.format, 'swiss');
  assert.equal(a.modo, 'fixed');
  assert.deepEqual(a.claves, []);
  assert.equal(a.reglas.tipo, 'f1');
  const b = A.conFormato(a, 'koth');
  assert.equal(b.fmt.format, 'koth');
  assert.equal(b.fmt.qty, a.fmt.qty);
  // k en [2, 20]; retiro ≥ 1 salvo en la colina sin fin; texto → default
  assert.equal(A.fmtCon(b.fmt, 'k', 1).k, 2);
  assert.equal(A.fmtCon(b.fmt, 'k', 99).k, 20);
  assert.equal(A.fmtCon(b.fmt, 'retire', 0).retire, 1);
  const sinFin = A.fmtCon(b.fmt, 'kothEnd', 'never');
  assert.equal(A.fmtCon(sinFin, 'retire', 0).retire, 0);
  assert.equal(A.fmtCon(b.fmt, 'rounds', 'x').rounds, LG.LG_FMT_DEFAULT.rounds);
  assert.equal(A.fmtCon(b.fmt, 'third', 1).third, true);
  assert.equal(A.fmtCon(b.fmt, 'capMode', 'nrg').capMode, 'nrg');
  // el mismo resultado que lgFmtSet sobre una temporada
  const S = LG.lgNewLeague({ fmt: { format: 'koth' } }).seasons[0];
  for (const [k, v] of [
    ['k', 7],
    ['retire', -3],
    ['cap', 12345],
    ['swissRounds', 150],
  ]) {
    LG.lgFmtSet(S, /** @type {string} */ (k), v);
    assert.equal(A.fmtCon(b.fmt, /** @type {string} */ (k), v)[k], S.fmt[k], String(k));
  }
});

test('asistente: esquema de cada formato', () => {
  for (const f of X.FORMATOS) {
    const e = A.esquemaFormato({ ...LG.LG_FMT_DEFAULT, format: f }, 16);
    assert.ok(e.length >= 1 && e.every((l) => l.length > 0), f);
  }
  assert.match(A.esquemaFormato({ ...LG.LG_FMT_DEFAULT, format: 'rr', legs: 2 })[0], /×2/);
  assert.match(
    A.esquemaFormato({ ...LG.LG_FMT_DEFAULT, format: 'koth', kothEnd: 'never', retire: 0 })[1],
    /∞/,
  );
  // suizo: ⌈log2 16⌉ + 1 = 5 rondas
  assert.equal(
    A.esquemaFormato({ ...LG.LG_FMT_DEFAULT, format: 'swiss' }, 16)[0],
    'R1 R2 R3 R4 R5',
  );
  assert.match(
    A.esquemaFormato({ ...LG.LG_FMT_DEFAULT, format: 'cup', third: true }, 8, '3.º')[1],
    /3\.º/,
  );
});

test('asistente: validaciones de participantes (lista fija y sorteo)', () => {
  const claves = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => `k${i}`);
  const con = (/** @type {Partial<A.Asistente>} */ o, formato = 'swiss') => ({
    ...A.conFormato(A.nuevoAsistente(), formato),
    ...o,
  });
  const v = (/** @type {any} */ a, tamPool = 100) => A.validarParticipantes(a, { tamPool });
  const errores = (/** @type {any} */ a, tamPool = 100) =>
    v(a, tamPool).errores.map((e) => e.clave);
  const avisos = (/** @type {any} */ a, tamPool = 100) => v(a, tamPool).avisos.map((e) => e.clave);
  assert.deepEqual(errores(con({ claves: claves(1) })), ['competir.val.pocos']);
  assert.deepEqual(errores(con({ claves: claves(2) })), []);
  assert.deepEqual(errores(con({ claves: claves(7) }, 'cup')), ['competir.val.copa']);
  assert.deepEqual(errores(con({ claves: claves(16) }, 'cup')), []);
  assert.deepEqual(avisos(con({ claves: claves(21) }, 'single')), ['competir.val.single']);
  assert.deepEqual(avisos(con({ claves: claves(46) }, 'rr')), ['competir.val.rrLargo']);
  assert.deepEqual(avisos(con({ claves: claves(45) }, 'rr')), []); // 990 partidos
  // sorteo
  assert.deepEqual(errores(con({ modo: 'random', n: 8 }), 1), ['competir.val.poolCorto']);
  assert.deepEqual(errores(con({ modo: 'random', n: 1 })), ['competir.val.nMin']);
  assert.deepEqual(avisos(con({ modo: 'random', n: 12 }), 10), ['competir.val.nMayorPool']);
  assert.deepEqual(errores(con({ modo: 'random', n: 12 }, 'cup')), ['competir.val.copa']);
  assert.deepEqual(errores(con({ modo: 'fight', n: 16 }, 'cup')), []);
  assert.deepEqual(avisos(con({ modo: 'fight', n: 16 }, 'cup')), ['competir.val.copaPelea']);
});

test('asistente: pasos, valores del partido y plan de creación', () => {
  const ctx = { tamPool: 50 };
  let a = A.nuevoAsistente('koth');
  a = A.mover(a, 1, ctx);
  assert.equal(a.paso, 2);
  // sin participantes no avanza
  assert.equal(A.mover(a, 1, ctx).paso, 2);
  a = { ...a, claves: ['x', 'y', 'z'] };
  a = A.mover(a, 1, ctx);
  assert.equal(a.paso, 3);
  assert.deepEqual(A.erroresDelPaso(a, ctx), []);
  assert.equal(A.mover(a, -1, ctx).paso, 2);
  // valores fuera de rango
  const malo = { ...a, fmt: { ...a.fmt, rounds: 0, qty: 500 } };
  assert.deepEqual(
    A.validarValores(malo.fmt).map((e) => e.params?.campo),
    ['qty', 'rounds'],
  );
  assert.equal(A.mover(malo, 1, ctx).paso, 3);
  // plan: el formato primero y, en la colina, el fin antes que el retiro
  const p = A.planCreacion({ ...a, fmt: { ...a.fmt, kothEnd: 'never', retire: 0 } });
  const campos = p.fmt.map(([k]) => k);
  assert.equal(campos[0], 'format');
  assert.ok(campos.indexOf('kothEnd') < campos.indexOf('retire'));
  assert.deepEqual(campos.slice(-A.CAMPOS_PARTIDO.length), [...A.CAMPOS_PARTIDO]);
  assert.equal(p.llenar, 'lista');
  assert.deepEqual(p.draw, { mode: 'fixed', pool: 'all', n: 8 });
  // aplicado a una temporada, deja el formato pedido
  const S = LG.lgNewLeague({}).seasons[0];
  for (const [k, v] of p.fmt) LG.lgFmtSet(S, k, v);
  assert.equal(S.fmt.format, 'koth');
  assert.equal(S.fmt.kothEnd, 'never');
  assert.equal(S.fmt.retire, 0);
  assert.equal(A.planCreacion({ ...a, modo: 'random' }).llenar, 'sorteo');
  assert.equal(A.planCreacion({ ...a, modo: 'fight' }).llenar, 'pelea');
  assert.equal(A.planCreacion(A.conFormato({ ...a, modo: 'fight' }, 'cup')).llenar, 'sorteo');
});

test('asistente: reglas del mundo = un escenario sin especies (decisión 21)', () => {
  const f1 = A.reglasDeSeleccion({ tipo: 'f1' });
  assert.equal(f1.escenario.id, 'partido-f1');
  assert.deepEqual(f1.escenario.especies, []);
  assert.equal(f1.escenario.opciones.base, 'f1');
  assert.equal(A.tipoDeReglas(f1), 'f1');
  const sc = A.reglasDeSeleccion({ tipo: 'sincostos' });
  assert.equal(A.tipoDeReglas(sc), 'sincostos');
  for (const [k, v] of Object.entries(costosNinguno()))
    assert.equal(sc.escenario.opciones.cambios[k], v, k);
  const sopa = /** @type {any} */ (ESCENARIOS_FABRICA.find((e) => e.especies.length > 0));
  const r = A.reglasDeSeleccion({ tipo: 'escenario', escenario: sopa });
  assert.deepEqual(r.escenario.especies, []);
  assert.equal(r.escenario.id, sopa.id);
  assert.equal(A.tipoDeReglas(r), 'escenario');
  assert.equal(A.tipoDeReglas({ 'o-11': '180' }), 'clasica');
  // un escenario inválido no pasa el paso 3
  const a = {
    ...A.nuevoAsistente(),
    paso: /** @type {3} */ (3),
    reglas: /** @type {any} */ ({ tipo: 'escenario', escenario: { nombre: '' } }),
  };
  assert.ok(A.erroresDelPaso(a, { tamPool: 9 }).some((e) => e.clave === 'competir.val.reglas'));
});

test('asistente: pool y sorteo de claves de la Biblioteca', () => {
  const e = (/** @type {string} */ clave, /** @type {any} */ o = {}) => ({
    clave,
    nombre: o.nombre ?? clave,
    vegetal: !!o.vegetal,
    marcas: { fav: !!o.fav, tags: o.tags ?? [], notas: '' },
  });
  const indice = [
    e('a', { fav: true, tags: ['x'] }),
    e('b', { tags: ['x'] }),
    e('c', { vegetal: true, fav: true }),
    e('d'),
    e('d2', { nombre: 'd' }), // mismo nombre: una especie
  ];
  const inv = A.inventarioClaves({
    indice,
    sel: ['b', 'd'],
    selecciones: [{ nombre: 'mia', claves: ['a', 'd'] }],
  });
  assert.deepEqual(A.clavesDelPool(inv, 'all'), ['a', 'b', 'd']);
  assert.deepEqual(A.clavesDelPool(inv, 'fav'), ['a']);
  assert.deepEqual(A.clavesDelPool(inv, 'sel'), ['b', 'd']);
  assert.deepEqual(A.clavesDelPool(inv, 'tag:x'), ['a', 'b']);
  assert.deepEqual(A.clavesDelPool(inv, 'set:mia'), ['a', 'd']);
  assert.deepEqual(A.clavesDelPool(inv, 'nada'), []);
  // sin repetir las ya elegidas, determinista con el generador
  const s = A.sortearClaves(['a', 'b', 'c', 'd'], ['b'], 2, () => 0);
  assert.equal(s.length, 2);
  assert.ok(!s.includes('b'));
  assert.deepEqual(
    A.sortearClaves(['a', 'b', 'c', 'd'], ['b'], 2, () => 0),
    s,
  );
  assert.deepEqual(A.sortearClaves(['a'], ['a'], 3), []);
});

// ---- claves del motor → textos --------------------------------------------------------

test('claves: todo lo que el motor emite está en las listas de textos.js', () => {
  const torneos = fuente('torneos.js');
  const league = fuente('league.js');
  const rondas = fuente('rondas.js');
  const partido = fuente('partido.js');
  // la extracción encuentra lo que tiene que encontrar (no pasa en vacío)
  assert.ok(clavesDeLlamadas(torneos, 'lgNote').size >= 28);
  assert.ok(clavesDeLlamadas(torneos, 'log').size >= 8);
  assert.ok(clavesDeLlamadas(league, 'rotulo').size >= 15);
  assert.ok(clavesDeLlamadas(league, 'new ErrorLiga').size >= 5);
  assert.ok(clavesDeLlamadas(torneos, 'lgNote').has('entrant-dup'));
  // notas y registro de torneos.js
  for (const k of clavesDeLlamadas(torneos, 'lgNote'))
    assert.ok(X.CLAVES_NOTA.includes(k), `nota ${k}`);
  for (const k of clavesDeLlamadas(torneos, 'log')) assert.ok(X.CLAVES_LOG.includes(k), `log ${k}`);
  // rótulos de league.js y rondas.js (peleas, avance y sorteo usan la misma función)
  const rotulos = new Set([...X.CLAVES_ROTULO, ...X.CLAVES_PROGRESO, ...X.CLAVES_SORTEO]);
  for (const src of [league, rondas, torneos])
    for (const k of clavesDeLlamadas(src, 'rotulo')) assert.ok(rotulos.has(k), `rótulo ${k}`);
  // errores (ErrorLiga) de los cuatro módulos
  for (const src of [league, rondas, torneos, partido])
    for (const k of clavesDeLlamadas(src, 'new ErrorLiga'))
      assert.ok(X.CLAVES_ERROR.includes(k), `error ${k}`);
  // claves devueltas como {clave: '…'} por torneos.js (modo TV, import, errores de nota)
  for (const m of torneos.matchAll(/clave: '([a-z][a-z0-9-]*)'/g)) {
    const k = m[1];
    assert.ok(
      X.CLAVES_TV.includes(k) || X.CLAVES_ERROR.includes(k) || X.CLAVES_ROTULO.includes(k),
      `clave ${k}`,
    );
  }
  assert.deepEqual([...X.LG_HOWS].sort(), [...LG.LG_HOWS].sort());
  // la tabla de la cabecera de torneos.js (claves de nota documentadas)
  const cabecera = torneos.slice(0, torneos.indexOf('\nimport '));
  const i = cabecera.indexOf('// Claves de nota');
  const j = cabecera.indexOf('// Claves de log');
  for (const m of cabecera.slice(i, j).matchAll(/^\/\/ {3}([a-z][a-z0-9-]+) \{/gm))
    assert.ok(X.CLAVES_NOTA.includes(m[1]), `nota documentada ${m[1]}`);
});

/** Parámetros de ejemplo para cada nota. */
const PARAMS_NOTA = {
  fixture: { label: { clave: 'rr', params: { no: 1, total: 3 } } },
  'cup-size': { n: 7 },
  'cap-reached': { capMode: 'nrg' },
  'round-won': { round: 2, winner: 'Ymir' },
  'match-won': { winner: 'Ymir' },
  'match-void': { note: NOTA_UNA_ESPECIE },
  'replay-abandoned': { no: 3 },
  'replay-missing': { no: 3, season: 1 },
  'replay-same': { no: 3, winner: '', wins: [2, 1], cycles: 1234, full: false },
  'replay-diff': {
    no: 3,
    diffs: [
      { field: 'winner', got: 'A', was: 'B' },
      { field: 'wins', got: [2, 1], was: [1, 2] },
      { field: 'cycles', got: 10, was: 11 },
    ],
  },
  exported: { fileName: 'x.league.json' },
  'import-failed': { clave: 'newer-version', params: { version: 9 } },
  imported: { name: 'Tournament 3 (imported)', seasons: 2, matches: 5 },
  'entrant-dup': { name: 'Ymir' },
  'entrant-added': { name: 'Ymir' },
  'entrant-played': { name: 'Ymir' },
  'entrants-added': { added: 3, failed: 1, already: 0 },
  error: { clave: 'no-dna', params: { name: 'Ymir' } },
  'round-recorded': {
    registrados: 4,
    nulos: 1,
    descartados: 0,
    previos: 0,
    ya: false,
    league: 'League',
  },
};

test('claves: cada nota, registro, rótulo, avance, sorteo, error y TV tiene texto en es y en', () => {
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const { tr, faltan } = traductor(idioma);
    for (const k of X.CLAVES_NOTA)
      limpio(
        X.textoNota({ clave: k, params: /** @type {any} */ (PARAMS_NOTA)[k] ?? {} }, tr),
        `nota ${k}`,
      );
    // variantes
    limpio(X.textoNota({ clave: 'cap-reached', params: { capMode: 'pop' } }, tr), 'cap pop');
    limpio(
      X.textoNota(
        { clave: 'replay-same', params: { no: 1, winner: 'A', wins: [1], cycles: 1, full: true } },
        tr,
      ),
      'same full',
    );
    limpio(X.textoNota({ clave: 'round-recorded', params: { ya: true, league: 'L' } }, tr), 'ya');
    limpio(X.textoNota({ clave: 'error', params: { message: 'boom' } }, tr), 'error msg');
    for (const k of X.CLAVES_ERROR)
      limpio(
        X.textoNota(
          {
            clave: 'import-failed',
            params: {
              clave: k,
              params: {
                message: 'm',
                version: 3,
                season: 2,
                name: 'n',
                dep: 'd',
                no: 1,
                clave: 'o-99',
                i: 0,
              },
            },
          },
          tr,
        ),
        `import ${k}`,
      );
    for (const k of X.CLAVES_LOG)
      limpio(
        X.textoLog(
          {
            clave: k,
            params: {
              message: 'm',
              league: 'L',
              fighters: ['a', 'b'],
              winner: 'a',
              rounds: 3,
              cycles: 9,
              note: NOTA_CENSO_VACIO,
              no: 1,
              diffs: [],
            },
          },
          tr,
        ),
        `log ${k}`,
      );
    const rotulos = [
      { clave: 'single', params: { n: 20, total: 25 } },
      { clave: 'single', params: { n: 5, total: 5 } },
      { clave: 'rr', params: { no: 1, total: 10 } },
      { clave: 'ladder', params: { challenger: 'A', rung: 1, entrant: 2, total: 5 } },
      { clave: 'cup-group', params: { group: 'B', day: 1, days: 3 } },
      ...[1, 2, 4, 8].flatMap((ties) => [
        { clave: 'cup-ko', params: { ties, match: 0 } },
        { clave: 'cup-ko', params: { ties, match: 1 } },
      ]),
      { clave: 'cup-third', params: {} },
      { clave: 'swiss', params: { round: 1, rounds: 5, match: 2, matches: 8, bye: 'Z' } },
      { clave: 'swiss', params: { round: 1, rounds: 5, match: 2, matches: 8, bye: null } },
      { clave: 'koth', params: { champ: 'A', fight: 3, cap: 12 } },
      { clave: 'koth', params: { champ: null, fight: 1, cap: null } },
      { clave: 'replay', params: { no: 2, season: 1, seed: 4242 } },
    ];
    for (const r of rotulos) limpio(X.textoRotulo(r, tr), `rótulo ${r.clave}`);
    for (const k of X.CLAVES_ROTULO)
      assert.ok(
        rotulos.some((r) => r.clave === k),
        `rótulo sin probar: ${k}`,
      );
    const progresos = [
      { clave: 'complete' },
      { clave: 'rr', params: { played: 1, total: 3 } },
      { clave: 'ladder', params: { placed: 1, n: 4 } },
      { clave: 'cup-size', params: { n: 7 } },
      { clave: 'cup-draw' },
      { clave: 'cup-groups', params: { played: 1, total: 12 } },
      { clave: 'cup-ko', params: { label: { clave: 'cup-ko', params: { ties: 2, match: 1 } } } },
      { clave: 'swiss-draw' },
      { clave: 'swiss', params: { round: 1, rounds: 5, done: 2, matches: 8, waiting: 3 } },
      { clave: 'koth-endless', params: { played: 4, retire: 3, crowns: 1, champ: 'A', streak: 2 } },
      { clave: 'koth-endless', params: { played: 4, retire: 0, crowns: 0, champ: 'A', streak: 2 } },
      { clave: 'koth', params: { played: 4, cap: 12, champ: 'A', streak: 2, retire: 5 } },
      { clave: 'not-played' },
    ];
    for (const r of progresos) limpio(X.textoProgreso(r, tr), `avance ${r.clave}`);
    for (const k of X.CLAVES_PROGRESO)
      assert.ok(
        progresos.some((r) => r.clave === k),
        `avance sin probar: ${k}`,
      );
    for (const k of X.CLAVES_SORTEO) {
      limpio(
        X.textoSorteo({ clave: k, params: { locked: false, n: 8, cap: 24 } }, tr),
        `sorteo ${k}`,
      );
      limpio(
        X.textoSorteo({ clave: k, params: { locked: true, n: 8, cap: 24 } }, tr),
        `sorteo ${k}`,
      );
    }
    for (const k of X.CLAVES_TV)
      limpio(
        X.textoTv({ clave: k, params: { pool: 'tag:f1', n: 7 } }, tr, (p) => X.nombrePool(p, tr)),
        `tv ${k}`,
      );
    for (const k of X.CLAVES_ERROR)
      limpio(
        X.textoError(
          {
            clave: k,
            params: {
              message: 'm',
              version: 3,
              season: 2,
              name: 'n',
              dep: 'd',
              no: 1,
              clave: 'o-99',
              i: 0,
            },
          },
          tr,
        ),
        `error ${k}`,
      );
    for (const k of X.CODIGOS_COLA)
      limpio(X.textoError({ codigo: k, message: k }, tr), `cola ${k}`);
    for (const how of LG.LG_HOWS) limpio(X.textoCampeon({ name: 'A', how }, tr), `cómo ${how}`);
    limpio(X.textoCampeon(null, tr), 'sin campeón');
    for (const p of ['all', 'fav', 'sel', 'tag:x', 'set:y'])
      limpio(X.nombrePool(p, tr), `pool ${p}`);
    assert.deepEqual(faltan, [], `${idioma}: claves sin texto`);
  }
});

test('textos: formato, regla, colina, nombres guardados y notas de nulo por valor', () => {
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const { tr, faltan } = traductor(idioma);
    const fmts = [
      { format: 'single' },
      { format: 'ladder' },
      { format: 'rr', legs: 1 },
      { format: 'rr', legs: 2 },
      { format: 'swiss', swissRounds: 0 },
      { format: 'swiss', swissRounds: 7 },
      { format: 'cup', groupLegs: 2, pots: 'random', third: true },
      { format: 'cup', groupLegs: 1, pots: 'elo', third: false },
      { format: 'koth', k: 3, kothEnd: 'retire', retire: 5, noRepeat: true },
      { format: 'koth', k: 2, kothEnd: 'never', retire: 0 },
      { format: 'koth', k: 2, kothEnd: 'never', retire: 4 },
    ];
    for (const f of fmts) {
      limpio(X.textoFormato({ ...LG.LG_FMT_DEFAULT, ...f }, tr, 16), f.format);
      if (f.format === 'koth') limpio(X.textoColina({ ...LG.LG_FMT_DEFAULT, ...f }, tr), 'colina');
    }
    for (const [n, w] of [
      [5, 3],
      [5, 0],
      [1, 0],
      [3, 9],
    ])
      limpio(X.textoRegla(n, w, tr), `regla ${n}/${w}`);
    assert.equal(X.nombreTorneo({ id: 'x', name: 'Mi liga' }, tr), 'Mi liga');
    assert.notEqual(X.nombreTorneo({ id: LG.LG_SCRATCH_ID, name: 'Scratch' }, tr), 'Scratch');
    limpio(X.nombreTorneo({ id: 'x', name: 'League' }, tr), 'League');
    const t3 = X.nombreTorneo({ id: 'x', name: 'Tournament 3' }, tr);
    assert.match(t3, /3/);
    assert.ok(idioma === 'en' || !t3.includes('Tournament'), t3);
    const imp = X.nombreTorneo({ id: 'x', name: 'Mi liga (imported)' }, tr);
    assert.match(imp, /Mi liga/);
    assert.ok(idioma === 'en' || !imp.includes('imported'), imp);
    assert.equal(X.notaNulo('otra nota', tr), 'otra nota');
    limpio(X.notaNulo(NOTA_CENSO_VACIO, tr), 'censo');
    limpio(X.notaNulo(NOTA_UNA_ESPECIE, tr), 'una');
    if (idioma === 'es') {
      assert.notEqual(X.notaNulo(NOTA_CENSO_VACIO, tr), NOTA_CENSO_VACIO);
      assert.notEqual(X.notaNulo(NOTA_UNA_ESPECIE, tr), NOTA_UNA_ESPECIE);
    }
    for (const r of [
      { existia: false },
      {
        existia: true,
        torneos: 2,
        partidos: 9,
        yaEstaban: 1,
        partidosReasignados: 2,
        invalidos: 1,
        huerfanos: 3,
      },
      { existia: true, torneos: 0 },
    ])
      for (const l of X.lineasMigracionLigas(r)) limpio(tr.t(l.clave, l.params), l.clave);
    assert.equal(X.ligasTrajoAlgo({ existia: true, torneos: 0 }), false);
    assert.equal(X.ligasTrajoAlgo({ existia: true, torneos: 1 }), true);
    assert.deepEqual(faltan, []);
  }
});

test('claves armadas con plantilla en las pantallas de Competir existen en es y en', () => {
  const armadas = [
    ...X.FORMATOS.flatMap((f) => [
      `competir.formato.${f}`,
      `competir.formato.${f}.desc`,
      `competir.formato.${f}.nota`,
    ]),
    ...[
      'k',
      'retire',
      'noRepeat',
      'swissRounds',
      'legs',
      'groupLegs',
      'third',
      'qty',
      'nrg',
      'rounds',
      'wins',
      'cap',
      'popCap',
      'capMode',
    ].flatMap((k) => [`competir.campo.${k}`, `competir.campo.${k}.ayuda`]),
    ...['fixed', 'random', 'fight'].flatMap((m) => [
      `competir.entrantes.${m}`,
      `competir.entrantes.${m}.desc`,
    ]),
    ...['bestiary', 'hybrid', 'form', 'preset'].map((s) => `competir.participantes.src.${s}`),
    ...['pendiente', 'corriendo', 'terminado', 'fallido', 'cancelado'].map(
      (e) => `competir.jugar.rondaEstado.${e}`,
    ),
    ...['tabla', 'partidos', 'participantes', 'reglas', 'temporadas'].map(
      (v) => `competir.vista.${v}`,
    ),
    ...['rondas', 'copa', 'colina', 'escalera', 'calendario'].map(
      (v) => `competir.vista.estructura.${v}`,
    ),
    ...[1, 2, 3].map((p) => `competir.nuevo.paso${p}`),
    ...LG.LG_HOWS.map((h) => `competir.como.${h}`),
    ...X.CAMPOS_DIFF.map((d) => `competir.diff.${d}`),
    ...['rr', 'cup', 'ladder', 'kothSinFin', 'elo', 'swiss'].map(
      (d) => `competir.tabla.desempate.${d}`,
    ),
  ];
  for (const f of X.FORMATOS) {
    const e = V.vistaEstructura(f);
    if (e) assert.ok(armadas.includes(`competir.vista.estructura.${e}`), f);
  }
  for (const idioma of ['es', 'en'])
    for (const k of armadas) assert.ok(Object.hasOwn(DICS[idioma], k), `${idioma}: ${k}`);
  // los textos no mencionan «el original»
  for (const idioma of ['es', 'en'])
    for (const [k, v] of Object.entries(DICS[idioma]))
      if (k.startsWith('competir.')) assert.doesNotMatch(v, /\boriginal\b|VB6|visual\s*basic/i, k);
});

// ---- vistas ------------------------------------------------------------------------------

/**
 * Una temporada con sus partidos jugados en orden (lgFixture), el primer
 * luchador gana salvo que `gana` diga otra cosa.
 * @param {string} formato @param {number} n @param {Record<string, any>} [fmt]
 * @param {(fx: any, i: number) => string} [gana]
 */
function temporada(formato, n, fmt = {}, gana = (fx) => fx.fighters[0].name) {
  const L = LG.lgNewLeague({ id: 'L1', name: 'Prueba', fmt: { format: formato, ...fmt } });
  const S = L.seasons[0];
  for (let i = 0; i < n; i++) LG.lgAddEntrant(S, { name: `B${i}`, dna: `adn ${i}`, src: 'form' });
  /** @type {any[]} */
  const ms = [];
  LG.lgCupDraw(L, ms, () => 0.4);
  LG.lgSwissDraw(L, ms, () => 0.4);
  for (let i = 0; i < 400; i++) {
    const fx = LG.lgFixture(S, ms, () => 0.3);
    if (!fx) break;
    const w = gana(fx, i);
    ms.push({
      id: i + 1,
      league: 'L1',
      season: 1,
      no: i + 1,
      fighters: fx.fighters.map((/** @type {any} */ e) => e.name),
      winner: w,
      wins: fx.fighters.map((/** @type {any} */ e) => (e.name === w ? 3 : 1)),
      capWins: fx.fighters.map(() => 0),
      rounds: 3 + fx.fighters.length - 1,
      capRounds: i % 2,
      cycles: 1000 + i,
      seed: 100 + i,
    });
  }
  return { L, S, ms };
}

test('vistas: tabla con Elo, % por tope, ciclos, últimos y campeón', () => {
  const { S, ms } = temporada('rr', 4);
  assert.ok(LG.lgSeasonDone(S, ms));
  const filas = V.filasTabla(S, ms);
  assert.equal(filas.length, 4);
  const st = LG.lgStandings(S, ms);
  assert.deepEqual(
    filas.map((f) => f.name),
    st.map((r) => r.name),
  );
  assert.equal(filas.filter((f) => f.campeon).length, 1);
  assert.equal(filas[0].campeon, true);
  for (const f of filas) {
    assert.equal(f.p, 3);
    assert.ok(f.ultimos.length <= V.ULTIMOS && f.ultimos.every((u) => u === 'G' || u === 'P'));
    assert.equal(f.ciclos, Math.round(st.find((r) => r.name === f.name).cyc / 3));
  }
  assert.equal(V.claveDesempate(S.fmt), 'competir.tabla.desempate.rr');
  const h = V.matrizH2H(S, ms);
  assert.ok(h);
  assert.equal(h.celdas.length, 4);
  assert.equal(h.celdas[0][0], null);
});

test('vistas: tabla de la escalera en juego — peldaños, retador en curso, los que faltan', () => {
  // gana siempre el de nombre menor: cada retador pierde con todos
  const { S, ms } = temporada(
    'ladder',
    4,
    {},
    (fx) => fx.fighters.map((/** @type {any} */ e) => e.name).sort()[0],
  );
  const nombres = (/** @type {any[]} */ m) => V.filasTabla(S, m).map((f) => f.name);
  // B1 quedó en el peldaño 2; B2 ya perdió con B0 y sigue desafiando; B3 no entró
  const parcial = ms.slice(0, 2);
  assert.deepEqual(LG.lgLadderState(S, parcial).ladder, ['B0', 'B1']);
  assert.deepEqual(nombres(parcial), ['B0', 'B1', 'B2', 'B3']);
  // el motor (paridad con la clásica) pone al retador bajo el que ni entró
  assert.deepEqual(
    LG.lgStandings(S, parcial).map((r) => r.name),
    ['B0', 'B1', 'B3', 'B2'],
  );
  assert.deepEqual(nombres([]), ['B0', 'B1', 'B2', 'B3']);
  // terminada: el orden de la escalera
  assert.deepEqual(
    nombres(ms),
    LG.lgStandings(S, ms).map((r) => r.name),
  );
});

test('vistas: calendario, colina, escalera, suizo y copa', () => {
  const rr = temporada('rr', 5, { legs: 2 });
  const cal = V.calendarioRr(rr.S, rr.ms);
  assert.equal(cal.flatMap((d) => d.partidos).length, 20);
  assert.ok(cal.every((d) => d.partidos.length === 2));
  assert.ok(cal.flatMap((d) => d.partidos).every((p) => p.winner && p.id));

  const koth = temporada('koth', 5, { retire: 2, k: 2 });
  const c = V.peleasColina(koth.S, koth.ms);
  assert.equal(c.peleas.length, koth.ms.length);
  assert.ok(c.peleas.some((p) => p.corona));
  assert.equal(c.primero, LG.lgKothState(koth.S, koth.ms).first);

  const lad = temporada('ladder', 4, {}, (fx) => fx.fighters[1].name);
  const e = V.escalera(lad.S, lad.ms);
  assert.equal(e.peldaños.length, 4);
  assert.equal(e.siguiente, null);
  assert.deepEqual(e.esperan, []);

  const sw = temporada('swiss', 9);
  const r = V.rondasSuizo(sw.S, sw.ms);
  assert.equal(r.fase, 'done');
  assert.equal(r.historia.length, r.rondas);
  assert.ok(r.historia.every((h) => h.bye));

  const cup = temporada('cup', 8, { third: true });
  const k = V.copa(cup.S, cup.ms);
  assert.equal(k.estado, 'done');
  assert.equal(k.grupos?.length, 2);
  assert.equal(k.cuadro?.length, 2); // 8 bots: 2 grupos → semifinales y final
  assert.ok(k.tercero?.winner);
  assert.ok(k.campeon);
  // a medias: el cuadro muestra los puestos (1A, 2B…)
  const media = V.copa(cup.S, cup.ms.slice(0, 3));
  assert.equal(media.estado, 'groups');
  assert.deepEqual(
    media.cuadro?.[0].map((t) => `${t.pa}-${t.pb}`),
    ['1A-2B', '1B-2A'],
  );
  assert.deepEqual(V.copa({ ...cup.S, entrants: cup.S.entrants.slice(0, 7) }, []), {
    estado: 'tamano',
    n: 7,
  });
});

test('vistas: resumen de reglas (escenario y foto de la clásica), partidos y temporadas', () => {
  const r = V.resumenReglas(A.reglasDeSeleccion({ tipo: 'sincostos' }));
  assert.equal(r.origen, 'escenario');
  assert.equal(r.id, A.ID_SIN_COSTOS);
  assert.ok(r.cambios.length > 0);
  const f1 = V.resumenReglas(A.reglasDeSeleccion({ tipo: 'f1' }));
  assert.equal(f1.cambios.length, 0);
  const foto = V.resumenReglas({ 'o-11': '180', 'o-mutations': false });
  assert.equal(foto.origen, 'clasica');
  assert.equal(foto.error, '');
  assert.ok(
    foto.cambios.some(([k]) => k === 'opt:11'),
    JSON.stringify(foto.cambios),
  );
  // lo que fija el partido (modo F1) no cuenta como cambio
  assert.ok(!foto.cambios.some(([k]) => k === 'opt:91'));
  const p = V.parametroVisible('opt:11', 180, 'es');
  assert.ok(p.nombre && p.valor === '180');

  const { L, ms } = temporada('rr', 3);
  const filas = V.filasPartidos(ms);
  assert.equal(filas[0].no, ms.length);
  assert.equal(filas.at(-1)?.no, 1);
  assert.equal(V.ultimoPartido(ms)?.no, ms.length);
  const ts = V.temporadas(L, ms);
  assert.equal(ts.length, 1);
  assert.equal(ts[0].terminada, true);
  assert.equal(ts[0].partidos, 3);
  assert.ok(ts[0].campeon);
});
