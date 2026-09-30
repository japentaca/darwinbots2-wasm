// @ts-check
// Biblioteca de bots (paso N3.1): índice unificado con los JSON reales del
// Bestiary (port/web/bots/), identidad por el hash de la clásica, filtros,
// agrupación y orden contra las funciones de port/web/inventory.js
// cargadas en un vm, la paleta (invColor), los híbridos (lab.js
// labCompose), la siembra en lote, los bots propios con versiones y el
// historial del bot con un almacén en memoria.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  canonico,
  componerHibrido,
  crearPaleta,
  hashAdn,
  lgHash,
  sha1Hex,
  tamanoDe,
} from '../engine/adn.js';
import { almacenMemoria } from '../engine/almacen.js';
import {
  agrupar,
  CAP_COMUNES,
  coincide,
  construirIndice,
  entradasDe,
  especiesLote,
  filtrar,
  foros,
  historialBot,
  ordenar,
  todosLosTags,
} from '../engine/biblioteca.js';
import { crearBots, diffVersiones, ErrorBots, normalizarTag } from '../engine/bots.js';
import { MULBERRY, plano, rng } from './util/clasica-vm.js';
import { cargarDbCore, hayWasm, PORT_DIR, SIN_WASM, WEB } from './util/dbcore-node.js';

const BOTS = path.join(WEB, 'bots');
/** @param {string} f */
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(BOTS, f), 'utf8'));
const bestiario = leerJson('bots.json');
const perfiles = leerJson('profiles.json');
const genes = leerJson('genes.json');

/** @param {string} codigo */
const conCodigo = (codigo) => (/** @type {any} */ e) =>
  e instanceof ErrorBots && e.codigo === codigo;

// ---- La clásica en un vm: inventory.js + lab.js --------------------------------------
/**
 * @param {{seed?: number, fecha?: string}} [o]
 */
async function clasicaInventario(o = {}) {
  const FECHA = o.fecha ?? '2026-03-04T05:06:07.000Z';
  /** @type {any} */
  const ctx = {
    BESTIARY: structuredClone(bestiario),
    log: () => {},
    console,
    fetch: async () => ({
      ok: true,
      json: async () => structuredClone(perfiles),
    }),
    __FECHA: FECHA,
  };
  vm.createContext(ctx);
  // Date sin argumentos = la fecha fija (lab.js pone la del día en la cabecera)
  vm.runInContext(
    'const __D = Date; Date = class extends __D { constructor(...a) { super(...(a.length ? a : [__FECHA])); } };',
    ctx,
  );
  if (o.seed !== undefined) {
    ctx.__seed = o.seed;
    vm.runInContext(`Math.random = (${MULBERRY})(__seed);`, ctx);
  }
  for (const f of ['inventory.js', 'lab.js'])
    vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
  await vm.runInContext('invLoad()', ctx);
  return { ctx, ev: (/** @type {string} */ js) => vm.runInContext(js, ctx) };
}

// ---- Hash de identidad ----------------------------------------------------------------

test('sha1Hex = SHA-1 de node (UTF-8, bordes de bloque)', () => {
  const casos = [
    '',
    'abc',
    'á é ñ 🧬',
    'x'.repeat(55),
    'x'.repeat(56),
    'y'.repeat(64),
    'z'.repeat(1000),
  ];
  for (const s of casos)
    assert.equal(sha1Hex(s), crypto.createHash('sha1').update(s).digest('hex'), s.slice(0, 10));
});

// `canonical` de tools/bestiary/analyze_bots.js (el que generó profiles.json),
// extraído del fuente y evaluado en un vm, más el hash tal como lo calcula.
const ANALIZADOR = fs.readFileSync(
  path.join(PORT_DIR, 'tools', 'bestiary', 'analyze_bots.js'),
  'utf8',
);
function hashDelAnalizador() {
  const a = ANALIZADOR.indexOf('function canonical(');
  const b = ANALIZADOR.indexOf('\n}\n', a) + 3;
  /** @type {any} */
  const ctx = { crypto };
  vm.createContext(ctx);
  vm.runInContext(ANALIZADOR.slice(a, b), ctx);
  // la línea de profile(): crypto.createHash('sha1').update(canonical(text)).digest('hex').slice(0, 16)
  const linea = /const hash = (crypto\.createHash\('sha1'\)[^;]+);/.exec(ANALIZADOR);
  assert.ok(linea, 'la línea del hash sigue en analyze_bots.js');
  return {
    canonical: /** @type {(t: string) => string} */ (ctx.canonical),
    hash: /** @type {(text: string) => string} */ (vm.runInContext(`(text) => ${linea[1]}`, ctx)),
  };
}

test('canonico = canonical del analizador en los 571 .txt', () => {
  const an = hashDelAnalizador();
  for (const b of bestiario) {
    const t = fs.readFileSync(path.join(BOTS, b.file), 'utf8');
    assert.equal(canonico(t), an.canonical(t), b.file);
    assert.equal(hashAdn(t), an.hash(t), b.file);
  }
});

test('el índice carga los 571 bots con los hashes de la clásica (inventory.js en vm)', async () => {
  const idx = construirIndice({ bestiario, perfiles, registros: [] });
  assert.equal(idx.length, 571);
  assert.equal(new Set(idx.map((e) => e.id)).size, 571);
  assert.equal(new Set(idx.map((e) => e.hash)).size, 552, 'varios archivos comparten ADN');
  const { ev } = await clasicaInventario();
  const items = plano(ev('inv.items'));
  assert.equal(items.length, 571);
  for (let i = 0; i < 571; i++) {
    assert.equal(idx[i].archivo, items[i].b.file);
    assert.equal(idx[i].hash, items[i].key, items[i].b.file);
    assert.equal(idx[i].nombre, items[i].b.name);
    assert.equal(idx[i].foro, items[i].b.board);
    assert.equal(idx[i].vegetal, items[i].b.veg);
    assert.equal(idx[i].soloLectura, true);
  }
  assert.deepEqual(foros(idx), [...new Set(bestiario.map((/** @type {any} */ b) => b.board))]);
  // sin perfil (profiles.json ausente): la clave de la clásica, 'file:<archivo>'
  const sin = construirIndice({ bestiario: bestiario.slice(0, 2), perfiles: null });
  assert.equal(sin[0].hash, `file:${bestiario[0].file}`);
  assert.equal(sin[0].perfil, null);
});

test('hashAdn del texto que decompila el core = hash de profiles.json (muestra, con el core)', {
  skip: !hayWasm() && SIN_WASM,
}, async () => {
  const M = await cargarDbCore();
  const n = 'number';
  const api = {
    create: M.cwrap('db_sim_create', n, []),
    destroy: M.cwrap('db_sim_destroy', null, [n]),
    start: M.cwrap('db_sim_start', null, [n, n]),
    setField: M.cwrap('db_sim_set_field', null, [n, n, n]),
    addSpecies: M.cwrap('db_sim_add_species', n, [n, 'string', 'string', n, n, n, n, n]),
    seed: M.cwrap('db_sim_seed_species', n, [n, n, n]),
    botText: M.cwrap('db_sim_bot_text', n, [n, n]),
    free: M.cwrap('db_free', null, [n]),
  };
  // coreText de analyze_bots.js
  const textoCore = (
    /** @type {string} */ dna,
    /** @type {string} */ nombre,
    /** @type {boolean} */ veg,
  ) => {
    const sim = api.create();
    let t = '';
    api.setField(sim, 9237, 6928);
    api.start(sim, 42);
    const i = api.addSpecies(sim, dna, nombre, veg ? 1 : 0, 0, 3000, 0x40ff40, 1);
    if (api.seed(sim, i, 1) === 1) {
      const p = api.botText(sim, 1);
      if (p) {
        t = M.UTF8ToString(p);
        api.free(p);
      }
    }
    api.destroy(sim);
    return t;
  };
  const an = hashDelAnalizador();
  const muestra = bestiario.filter(
    (/** @type {any} */ _b, /** @type {number} */ i) => i % 29 === 0,
  );
  assert.ok(muestra.length >= 19);
  for (const b of muestra) {
    const t = textoCore(fs.readFileSync(path.join(BOTS, b.file), 'utf8'), `${b.name}.txt`, b.veg);
    assert.ok(t, b.file);
    const esperado = perfiles.bots[b.file].hash;
    assert.equal(an.hash(t), esperado, `analizador ${b.file}`);
    assert.equal(hashAdn(t), esperado, `hashAdn ${b.file}`);
  }
});

test('lgHash (torneos/escenarios) cambia con el formato; hashAdn no', () => {
  const a = 'cond\n*.eye5 0 >\nstart\n10 .up store\nstop\n';
  const b = "' comentario\n  cond  \n*.eye5 0 >\n\nstart\n10 .up store\nstop";
  assert.equal(hashAdn(a), hashAdn(b));
  assert.notEqual(lgHash(a), lgHash(b));
  assert.match(hashAdn(a), /^[0-9a-f]{16}$/);
  assert.match(lgHash(a), /^[0-9a-f]{8}$/);
});

// ---- Paleta y híbridos contra la clásica --------------------------------------------------

test('crearPaleta = invColor de la clásica con el mismo azar', async () => {
  for (const seed of [1, 7, 12345]) {
    const { ev } = await clasicaInventario({ seed });
    const color = crearPaleta(rng(seed));
    for (let i = 0; i < 40; i++) assert.equal(color(), ev('invColor()'), `semilla ${seed} #${i}`);
  }
});

test('componerHibrido = labCompose de lab.js (remapeo de memoria incluido)', async () => {
  // dos bots cuyos genes usan la misma dirección propia (fuerza el remapeo)
  /** @type {Map<number, Array<{file: string, gi: number}>>} */
  const usos = new Map();
  /** @type {any[]} */ for (const [file, gs] of Object.entries(genes.bots))
    gs.forEach((g, gi) => {
      if (!g.ai) return;
      for (const a of g.w || []) {
        const l = usos.get(a) ?? [];
        if (!l.some((x) => x.file === file)) l.push({ file, gi });
        usos.set(a, l);
      }
    });
  const choque = [...usos.values()].find((l) => l.length >= 3);
  assert.ok(choque, 'hay direcciones compartidas');
  const nombreDe = new Map(bestiario.map((/** @type {any} */ b) => [b.file, b.name]));
  const casos = [
    { name: 'Híbrido A', remap: true, parts: [...choque.slice(0, 3), { file: '1.txt', gi: 3 }] },
    { name: 'Sin remapeo', remap: false, parts: choque.slice(0, 2) },
    {
      name: 'Uno',
      parts: [
        { file: '1.txt', gi: 0 },
        { file: '1.txt', gi: 5 },
      ],
    },
  ];
  const FECHA = '2026-03-04T05:06:07.000Z';
  const { ctx, ev } = await clasicaInventario({ fecha: FECHA });
  for (const h of casos) {
    ctx.__genes = genes;
    ev('lab.genes = __genes; lab.sys = new Set(__genes.sysAddrs || []);');
    ctx.__parts = h.parts;
    ctx.__remap = h.remap !== false;
    ev('lab.parts = __parts.map((p) => ({ ...p })); lab.remap = __remap;');
    const esperado = ev(`labCompose(${JSON.stringify(h.name)})`);
    const c = componerHibrido(
      { ...h, updated: FECHA },
      { genes, nombreDe: (f) => nombreDe.get(f) },
    );
    assert.equal(c.adn, esperado, h.name);
    assert.deepEqual(
      c.origenes,
      h.parts.map((p) => ({ archivo: p.file, gen: p.gi })),
    );
    assert.equal(c.faltan, 0);
  }
  assert.notEqual(
    componerHibrido({ ...casos[0], updated: FECHA }, { genes }).adn,
    componerHibrido({ ...casos[0], remap: false, updated: FECHA }, { genes }).adn,
    'el remapeo cambia el texto',
  );
  // una parte que ya no está en genes.json se descarta y se cuenta
  const c = componerHibrido(
    {
      name: 'x',
      parts: [
        { file: '1.txt', gi: 0 },
        { file: 'no-existe.txt', gi: 0 },
      ],
    },
    { genes },
  );
  assert.equal(c.faltan, 1);
  assert.equal(c.origenes.length, 1);
});

// ---- Filtros, agrupación y orden contra inventory.js --------------------------------------

test('filtros, agrupación y orden = invMatches / invGroupsOf / invSorted', async () => {
  const { ctx, ev } = await clasicaInventario();
  const items = ev('inv.items');
  // marcas de usuario iguales en los dos lados
  const h = (/** @type {number} */ i) => items[i].key;
  const recs = [
    { key: h(0), tags: ['caza', 'rapido'], fav: true, notes: 'muy bueno' },
    { key: h(5), tags: ['caza'], fav: false, notes: '' },
    { key: h(40), tags: [], fav: true, notes: 'lento pero seguro' },
    { key: h(100), tags: ['alga'], fav: false, notes: 'nota' },
  ];
  ctx.__recs = recs;
  ev('inv.user = new Map(__recs.map((r) => [r.key, r]));');
  const registros = recs.map((r) => ({
    hash: r.key,
    clase: /** @type {const} */ ('foro'),
    fav: r.fav,
    tags: r.tags,
    notas: r.notes,
  }));
  const idx = construirIndice({ bestiario, perfiles, registros });
  const sel = new Set([h(0), h(3), h(200)]);
  ctx.__sel = [...sel];
  ev('inv.sel = new Set(__sel);');
  const board = bestiario[0].board;
  const filtros = [
    [{}, {}],
    [{ q: 'alga' }, { q: 'alga' }],
    [{ q: 'caza muy' }, { q: 'caza muy' }],
    [{ q: 'lento' }, { q: 'lento' }],
    [{ foro: board }, { board }],
    [{ arquetipo: 'vegetal' }, { arch: 'vegetal' }],
    [{ tamano: 'XL' }, { size: 'XL' }],
    [{ tag: 'caza' }, { tag: 'caza' }],
    [{ tag: null }, { tag: '\u0000' }],
    [{ fav: true }, { fav: true }],
    [{ soloSeleccion: true }, { onlySel: true }],
    [{ caps: { virus: 1 } }, {}, [['virus', 1]]],
    [
      { caps: { virus: 1, caparazon: -1 }, tamano: 'L' },
      { size: 'L' },
      [
        ['virus', 1],
        ['caparazon', -1],
      ],
    ],
  ];
  for (const [nuevo, viejo, caps] of filtros) {
    const f = {
      q: [],
      board: '',
      arch: '',
      size: '',
      tag: '',
      fav: false,
      onlySel: false,
      ...viejo,
    };
    if (typeof f.q === 'string') f.q = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    ctx.__f = f;
    ctx.__caps = caps ?? [];
    ev('inv.capFilter = new Map(__caps);');
    const esperado = plano(items)
      .map((/** @type {any} */ _it, /** @type {number} */ i) =>
        ev('invMatches')(items[i], f) ? i : -1,
      )
      .filter((/** @type {number} */ i) => i >= 0);
    const obtenido = idx
      .map((e, i) => (coincide(e, /** @type {any} */ (nuevo), sel) ? i : -1))
      .filter((i) => i >= 0);
    assert.deepEqual(obtenido, esperado, JSON.stringify(nuevo));
    assert.equal(filtrar(idx, /** @type {any} */ (nuevo), sel).length, esperado.length);
  }
  ev('inv.capFilter = new Map();');

  // orden
  for (const [como, viejo] of [
    ['nombre', 'name'],
    ['genes', 'genes'],
    ['caps', 'caps'],
  ]) {
    ctx.__lista = items.slice();
    const esperado = plano(ev(`invSorted(__lista, '${viejo}').map((it) => it.b.file)`));
    assert.deepEqual(
      ordenar(idx, como).map((e) => e.archivo),
      esperado,
      como,
    );
  }

  // agrupación: mismos grupos con los mismos bots (el rótulo lo pone la interfaz)
  const SIZE = { S: 'S (≤5 genes)', M: 'M (6-20)', L: 'L (21-60)', XL: 'XL (>60)' };
  /** @type {Record<string, (v: any) => string>} */
  const rotulo = {
    foro: (v) => v,
    arquetipo: (v) => (v ? perfiles.archetypes[v] : '—'),
    tamano: (v) => (v ? SIZE[/** @type {'S'} */ (v)] : '—'),
    fav: (v) => (v ? '★ Favorites' : 'Others'),
    tag: (v) => (v === null ? '(no tags)' : v),
    capacidad: (v) => (v === null ? '(basics only)' : perfiles.caps[v].label),
    ninguno: () => 'All',
  };
  const viejo = {
    foro: 'board',
    arquetipo: 'arch',
    tamano: 'size',
    fav: 'fav',
    tag: 'tag',
    capacidad: 'cap',
    ninguno: 'none',
  };
  for (const [como, v] of Object.entries(viejo)) {
    /** @type {Map<string, string[]>} */
    const esperado = new Map();
    for (const it of items)
      for (const g of ev('invGroupsOf')(it, v)) {
        const l = esperado.get(g) ?? [];
        l.push(it.b.file);
        esperado.set(g, l);
      }
    const grupos = agrupar(idx, /** @type {any} */ (como));
    const obtenido = new Map(
      grupos.map((g) => [
        rotulo[como](g.clave.valor),
        g.entradas.map((e) => /** @type {string} */ (e.archivo)),
      ]),
    );
    assert.deepEqual(obtenido, esperado, como);
    for (let i = 1; i < grupos.length && como !== 'foro'; i++)
      assert.ok(grupos[i - 1].entradas.length >= grupos[i].entradas.length, 'por cantidad');
    if (como === 'foro')
      assert.deepEqual(
        grupos.map((g) => g.clave.valor),
        [...esperado.keys()],
      );
  }
  assert.deepEqual(CAP_COMUNES, plano(ev('[...CAP_COMMON]')));
  assert.deepEqual(todosLosTags(idx), plano(ev('allTags()')));
});

// ---- Siembra en lote ----------------------------------------------------------------

test('siembra en lote: una especie por ADN, cantidades de vegetal y color por especie', () => {
  const propio = {
    hash: 'aaaaaaaaaaaaaaaa',
    clase: /** @type {const} */ ('propio'),
    nombre: 'Mío',
    vegetal: false,
    descripcion: '',
    adn: 'cond start 1 .up store stop',
    creado: '',
    actualizado: '',
    origen: /** @type {const} */ ({ tipo: 'nuevo' }),
    versiones: [],
    fav: false,
    tags: [],
    notas: '',
  };
  const idx = construirIndice({ bestiario, perfiles, registros: [propio] });
  const veg = idx.find((e) => e.vegetal);
  const noVeg = idx.find((e) => !e.vegetal);
  const mio = idx.find((e) => e.clase === 'propio');
  assert.ok(veg && noVeg && mio);
  // dos archivos con el mismo ADN: uno solo
  const dup = idx.filter((e) => e.hash === '50423e92d2d704d8');
  assert.equal(dup.length, 2);
  const esp = especiesLote([veg, noVeg, mio, ...dup], {
    cantidad: 7,
    cantidadVeg: 20,
    energia: 1500,
    color: crearPaleta(rng(3)),
  });
  assert.equal(esp.length, 4);
  assert.deepEqual(
    esp.map((s) => [s.bot, s.origen, s.cantidad, s.vegetal, s.energia]),
    [
      [veg.nombre, 'bestiario', 20, true, 1500],
      [noVeg.nombre, 'bestiario', 7, false, 1500],
      [mio.nombre, 'propio', 7, false, 1500],
      [dup[0].nombre, 'bestiario', 7, false, 1500],
    ],
  );
  const c = crearPaleta(rng(3));
  assert.deepEqual(
    esp.map((s) => s.color),
    [c(), c(), c(), c()],
  );
  assert.equal(esp[2].adn, propio.adn);
  assert.equal(esp[2].hash, lgHash(propio.adn));
  // valores por defecto de la clásica: 5 / 15 / 3000
  const d = especiesLote([veg, noVeg]);
  assert.deepEqual(
    d.map((s) => [s.cantidad, s.energia]),
    [
      [15, 3000],
      [5, 3000],
    ],
  );
  assert.match(d[0].color, /^#[0-9a-f]{6}$/);
  assert.deepEqual(
    entradasDe(idx, ['50423e92d2d704d8', mio.hash]).map((e) => e.id),
    [dup[0].id, mio.id],
  );
});

// ---- Bots propios con versiones ------------------------------------------------------

const ADN1 =
  "' mi bot\ncond\n*.eye5 0 >\nstart\n10 .up store\nstop\ncond\n*.nrg 5000 >\nstart\n50 .repro store\nstop\n";
const ADN2 =
  'cond\n*.eye5 0 >\nstart\n20 .up store\nstop\ncond\n*.nrg 5000 >\nstart\n50 .repro store\nstop\ncond\nstart\n.shoot inc\nstop\n';

function relojFijo() {
  let t = Date.parse('2026-05-01T00:00:00Z');
  return () => {
    t += 1000;
    return new Date(t);
  };
}

test('bots propios: crear, versiones con hash y lg, diff gen por gen y restaurar', async () => {
  const almacen = almacenMemoria();
  const bots = crearBots({ almacen, reloj: relojFijo() });
  const b = await bots.crear({ nombre: ' Mi bot ', adn: ADN1, nota: 'primera' });
  assert.equal(b.nombre, 'Mi bot');
  assert.equal(b.hash, hashAdn(ADN1));
  assert.equal(b.versiones.length, 1);
  assert.deepEqual(
    {
      n: b.versiones[0].n,
      hash: b.versiones[0].hash,
      lg: b.versiones[0].lg,
      nota: b.versiones[0].nota,
    },
    { n: 1, hash: hashAdn(ADN1), lg: lgHash(ADN1), nota: 'primera' },
  );
  await assert.rejects(bots.crear({ nombre: 'Otro', adn: ADN1 }), conCodigo('ya-existe'));
  await assert.rejects(bots.crear({ nombre: 'Mi bot', adn: ADN2 }), conCodigo('nombre-repetido'));
  await assert.rejects(bots.crear({ nombre: '', adn: ADN2 }), conCodigo('nombre-vacio'));
  await assert.rejects(bots.crear({ nombre: 'x', adn: '  ' }), conCodigo('adn-vacio'));
  const r2 = await bots.crear({ nombre: 'Mi bot', adn: ADN2 }, { renombrar: true });
  assert.equal(r2.nombre, 'Mi bot 2');

  // mismo ADN canónico (solo cambia un comentario): no hay versión nueva
  assert.equal(await bots.guardarVersion(b.hash, `${ADN1}' otro comentario\n`), null);
  const origenes = [{ archivo: '1.txt', gen: 0 }, null, { hash: r2.hash, gen: 2 }];
  const v2 = await bots.guardarVersion(b.hash, ADN2, { nota: 'dispara', origenes });
  assert.ok(v2);
  assert.equal(v2.hash, b.hash, 'la identidad no cambia al editar');
  assert.equal(v2.adn, ADN2);
  assert.equal(v2.versiones.length, 2);
  assert.equal(v2.versiones[1].hash, hashAdn(ADN2));
  assert.deepEqual(v2.versiones[1].origenes, origenes);
  const d = diffVersiones(v2, 1, 2);
  assert.deepEqual([d.iguales, d.cambiados, d.agregados, d.quitados], [1, 1, 1, 0]);
  assert.deepEqual(d.origenesB, origenes);
  assert.equal(d.origenesA, null);
  assert.throws(() => diffVersiones(v2, 1, 9), conCodigo('version-inexistente'));

  const v3 = await bots.restaurarVersion(b.hash, 1, 'vuelta');
  assert.ok(v3);
  assert.equal(v3.versiones.length, 3);
  assert.equal(v3.adn, ADN1);
  assert.equal(await bots.restaurarVersion(b.hash, 3), null);

  const x = await bots.porLg(lgHash(ADN2));
  assert.equal(x?.bot.hash, b.hash);
  assert.equal(x?.version.n, 2);
  assert.equal(await bots.porLg('00000000'), null);

  await assert.rejects(
    bots.cambiarDatos(b.hash, { nombre: 'Mi bot 2' }),
    conCodigo('nombre-repetido'),
  );
  const c = await bots.cambiarDatos(b.hash, {
    nombre: 'Renombrado',
    vegetal: true,
    descripcion: 'd',
  });
  assert.deepEqual([c.nombre, c.vegetal, c.descripcion], ['Renombrado', true, 'd']);
  assert.deepEqual(
    (await bots.propios()).map((p) => p.nombre),
    ['Mi bot 2', 'Renombrado'],
  );
});

test('los del foro son de solo lectura: se duplican; marcas, tags y selecciones', async () => {
  const almacen = almacenMemoria();
  const bots = crearBots({ almacen, reloj: relojFijo() });
  const idx = construirIndice({ bestiario, perfiles });
  const foro = idx[0];
  const texto = fs.readFileSync(path.join(BOTS, /** @type {string} */ (foro.archivo)), 'utf8');
  await assert.rejects(bots.guardarVersion(foro.hash, texto), conCodigo('no-existe'));

  // marcas de un bot del foro (registro 'foro', con nombre y archivo como la clásica)
  const info = () => ({ nombre: foro.nombre, archivo: foro.archivo });
  await bots.agregarTag([foro.hash], '  #Muy Rápido ', info);
  await bots.favorito([foro.hash], true, info);
  await bots.notas(foro.hash, ' notas ');
  assert.deepEqual(await bots.obtener(foro.hash), {
    hash: foro.hash,
    clase: 'foro',
    fav: true,
    tags: ['muy-rápido'],
    notas: 'notas',
    nombre: foro.nombre,
    archivo: foro.archivo,
  });
  await assert.rejects(bots.guardarVersion(foro.hash, texto), conCodigo('no-es-propio'));
  assert.equal(normalizarTag('#A b'), 'a-b');

  const copia = await bots.duplicar(
    {
      clase: 'foro',
      hash: foro.hash,
      nombre: foro.nombre,
      archivo: foro.archivo,
      vegetal: foro.vegetal,
    },
    texto,
  );
  assert.equal(copia.nombre, foro.nombre);
  assert.deepEqual(copia.origen, {
    tipo: 'foro',
    hash: foro.hash,
    nombre: foro.nombre,
    archivo: foro.archivo,
  });
  assert.equal(copia.hash, hashAdn(texto));
  assert.notEqual(copia.hash, foro.hash, 'el .txt crudo no es el texto del core');
  const otra = await bots.duplicar(
    { clase: 'foro', hash: foro.hash, nombre: foro.nombre, archivo: foro.archivo },
    `${texto}\ncond start 1 .dn store stop`,
  );
  assert.equal(otra.nombre, `${foro.nombre} 2`);

  // quitar todas las marcas de un bot del foro borra su registro
  await bots.quitarTag([foro.hash], 'muy-rápido');
  await bots.favorito([foro.hash], false);
  await bots.notas(foro.hash, '');
  assert.equal(await bots.obtener(foro.hash), undefined);

  // un propio con marcas que se borra deja sus marcas (mismo ADN)
  await bots.favorito([copia.hash], true);
  await bots.borrar(copia.hash);
  assert.deepEqual(await bots.obtener(copia.hash), {
    hash: copia.hash,
    clase: 'foro',
    fav: true,
    tags: [],
    notas: '',
  });
  // y si vuelve a crearse, las absorbe
  const again = await bots.crear({ nombre: 'Otra vez', adn: texto });
  assert.equal(again.fav, true);

  // selecciones con nombre (en 'ajustes')
  await bots.guardarSeleccion('B', [foro.hash, again.hash, foro.hash]);
  await bots.guardarSeleccion('A', [again.hash]);
  assert.deepEqual(await bots.selecciones(), [
    { nombre: 'A', claves: [again.hash] },
    { nombre: 'B', claves: [foro.hash, again.hash] },
  ]);
  await bots.borrarSeleccion('A');
  assert.deepEqual(
    (await bots.selecciones()).map((s) => s.nombre),
    ['B'],
  );

  // el índice mezcla foro + propios, con marcas por hash
  const todo = construirIndice({ bestiario, perfiles, registros: await bots.todos() });
  assert.equal(todo.length, 571 + 2);
  const p = todo.filter((e) => e.clase === 'propio');
  assert.deepEqual(
    p.map((e) => e.nombre),
    [`${foro.nombre} 2`, 'Otra vez'],
  );
  assert.equal(p[1].marcas.fav, true);
  assert.equal(p[1].soloLectura, false);
  assert.equal(p[1].perfil?.size, tamanoDe(p[1].perfil?.genes ?? 0));
  assert.deepEqual(p[1].lgs, [lgHash(texto)]);
  assert.equal(filtrar(todo, { origen: 'propio' }).length, 2);
});

// ---- Historial ------------------------------------------------------------------------

test('historial: corridas, torneos y pruebas cruzados por hash, nombre o archivo', async () => {
  const almacen = almacenMemoria();
  const bots = crearBots({ almacen, reloj: relojFijo() });
  const mio = await bots.crear({ nombre: 'Mío', adn: ADN1 });
  const mioV2 = await bots.guardarVersion(mio.hash, ADN2);
  assert.ok(mioV2);
  const idx = construirIndice({ bestiario, perfiles, registros: await bots.todos() });
  const eMio = /** @type {any} */ (idx.find((e) => e.clase === 'propio'));
  const foro = idx[0];
  const txtForo = fs.readFileSync(path.join(BOTS, /** @type {string} */ (foro.archivo)), 'utf8');

  const esc = (/** @type {any[]} */ especies) => ({
    formato: 1,
    id: 'x',
    nombre: 'x',
    opciones: { base: 'clasica' },
    especies,
  });
  await almacen.put('corridas', {
    id: 'c1',
    nombre: 'Con el del foro',
    fecha: '2026-05-02T00:00:00Z',
    escenario: esc([{ bot: foro.nombre, origen: 'bestiario', cantidad: 5 }]),
    eventos: [],
  });
  await almacen.put('corridas', {
    id: 'c2',
    nombre: 'Con el mío (v1) y una siembra de la v2',
    fecha: '2026-05-03T00:00:00Z',
    escenario: esc([{ bot: 'Mío', origen: 'propio', hash: lgHash(ADN1), cantidad: 5 }]),
    eventos: [{ ciclo: 10, tipo: 'siembra', especie: { nombre: 'Mío v2', adn: ADN2 } }],
  });
  await almacen.put('corridas', {
    id: 'c3',
    nombre: 'Ninguno',
    fecha: '2026-05-04T00:00:00Z',
    escenario: esc([
      { bot: 'Mío', origen: 'bestiario', cantidad: 5 },
      { bot: 'Mío', origen: 'propio', adn: 'otra cosa' },
    ]),
    eventos: [],
  });
  await almacen.put('torneos', {
    id: 'L1',
    name: 'Liga',
    created: '',
    seasons: [
      {
        no: 1,
        rules: {},
        fmt: {},
        entrants: [
          {
            name: 'Del foro',
            dna: txtForo,
            hash: lgHash(txtForo),
            src: 'bestiary',
            file: foro.archivo,
            color: '',
          },
          { name: 'Mío', dna: ADN2, hash: lgHash(ADN2), src: 'form', file: '', color: '' },
        ],
      },
      {
        no: 2,
        rules: {},
        fmt: {},
        entrants: [{ name: 'Otro', dna: 'x', hash: lgHash('x'), src: 'form', file: '', color: '' }],
      },
    ],
  });
  const p1 = await almacen.put('partidos', {
    league: 'L1',
    season: 1,
    no: 1,
    fighters: ['Del foro', 'Mío'],
    winner: 'Mío',
  });
  const p2 = await almacen.put('partidos', {
    league: 'L1',
    season: 1,
    no: 2,
    fighters: ['Mío', 'Del foro'],
    winner: 'Del foro',
    date: 'd',
  });
  await almacen.put('partidos', {
    league: 'L1',
    season: 2,
    no: 1,
    fighters: ['Otro', 'Mío'],
    winner: 'Otro',
  });
  await almacen.put('trabajos', {
    id: 't1',
    clase: 'trabajo',
    tipo: 'prueba',
    titulo: 'Probar',
    estado: 'terminado',
    creado: '2026-05-05',
    params: { hash: mio.hash },
  });
  await almacen.put('trabajos', {
    id: 't2',
    clase: 'trabajo',
    tipo: 'prueba',
    titulo: 'Probar v2',
    estado: 'pendiente',
    creado: '2026-05-06',
    params: { adn: ADN2 },
  });
  await almacen.put('trabajos', {
    id: 't3',
    clase: 'trabajo',
    tipo: 'replicas',
    titulo: 'R',
    estado: 'terminado',
    creado: '2026-05-07',
    params: { hash: mio.hash },
  });
  await almacen.put('trabajos', { id: 't1#0', clase: 'resultado', params: { hash: mio.hash } });

  const hm = await historialBot(almacen, eMio);
  assert.deepEqual(
    hm.corridas.map((c) => [c.id, c.especies]),
    [['c2', ['Mío', 'Mío v2']]],
  );
  assert.deepEqual(hm.torneos, [
    {
      id: 'L1',
      nombre: 'Liga',
      scratch: false,
      temporadas: [{ no: 1, participante: 'Mío' }],
      partidos: [
        { id: p1, temporada: 1, no: 1, gano: true },
        { id: p2, temporada: 1, no: 2, gano: false, fecha: 'd' },
      ],
    },
  ]);
  assert.deepEqual(
    hm.pruebas.map((p) => p.id),
    ['t2', 't1'],
  );

  const hf = await historialBot(almacen, foro);
  assert.deepEqual(
    hf.corridas.map((c) => c.id),
    ['c1'],
  );
  assert.deepEqual(
    hf.torneos[0].partidos.map((p) => [p.no, p.gano]),
    [
      [1, false],
      [2, true],
    ],
  );
  assert.equal(hf.torneos[0].temporadas[0].participante, 'Del foro');
  assert.deepEqual(hf.pruebas, []);
  // por lgHash del .txt (la interfaz lo pasa para uno del foro)
  const hl = await historialBot(
    almacen,
    { ...foro, archivo: undefined },
    { lgs: [lgHash(txtForo)] },
  );
  assert.equal(hl.torneos.length, 1);
  const vacio = await historialBot(almacenMemoria(), eMio);
  assert.deepEqual(vacio, { corridas: [], torneos: [], pruebas: [] });
});
