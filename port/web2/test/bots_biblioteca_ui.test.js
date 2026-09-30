// @ts-check
// Bots, paso N3.2 (lógica pura de la interfaz): estado de los filtros y la
// vista, selección múltiple, contrato de la siembra en lote (corrida.sembrar
// y escenario propio), ruta de la ficha por nombre o clave, textos por
// código (errores, migración, import) y lectura del ADN para el Resumen.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lgHash } from '../engine/adn.js';
import { almacenMemoria, ErrorAlmacen } from '../engine/almacen.js';
import { construirIndice, historialBot } from '../engine/biblioteca.js';
import { crearBots, ErrorBots } from '../engine/bots.js';
import { crearCorridas } from '../engine/corridas.js';
import { escenarioFabrica, IDS_FABRICA, validarPropio } from '../engine/escenarios/fabrica.js';
import { importarBiblioteca, migrarInventario } from '../engine/migracion.js';
import { juntarAreas } from '../src/i18n/core.js';
import { ADN_NUEVO, descripcionAdn, leeYEscribe } from '../src/lib/bots/adn.js';
import * as E from '../src/lib/bots/estado.js';
import {
  CANTIDAD_AVISO,
  CANTIDAD_MAX,
  cantidadAlta,
  conCampos,
  entradasUnicas,
  escenarioLote,
  especiesConAdn,
  especiesEscenario,
  LOTE_INICIAL,
  nombresUnicos,
  normalizarLote,
  paletaLibre,
  siembrasDe,
} from '../src/lib/bots/lote.js';
import { claveDe, leerRuta, resolverClave, rutaFicha } from '../src/lib/bots/ruta.js';
import { buscarBots } from '../src/lib/bots/selector.js';
import {
  ARQUETIPOS,
  CAPS,
  CLAVES_ARMADAS,
  CODIGOS_ERROR,
  GRUPOS_CAP,
  lineasImport,
  lineasMigracion,
  mensajeError,
  migracionTrajoAlgo,
} from '../src/lib/bots/textos.js';
import { PALETA } from '../src/lib/experimentar/borrador.js';
import { estadoVacio, NucleoCorrida } from '../src/lib/sim/corrida-nucleo.js';
import { parsearHash } from '../src/router.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOTS_WEB = path.resolve(RAIZ, '..', 'web', 'bots');

/** Los textos de bots.json en los dos idiomas. */
function diccionarios() {
  const archivos = ['es', 'en'].map((idioma) => ({
    idioma,
    area: 'bots',
    dic: JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'i18n', idioma, 'bots.json'), 'utf8')),
  }));
  return juntarAreas(archivos);
}

/** @param {{clave: string, params?: Record<string, any>}[]} lineas */
function verificarLineas(lineas) {
  const dics = diccionarios();
  for (const l of lineas)
    for (const idioma of ['es', 'en']) {
      const s = dics[idioma][l.clave];
      assert.ok(s, `${idioma}: falta ${l.clave}`);
      for (const m of s.matchAll(/\{(\w+)\}/g))
        assert.ok(l.params && m[1] in l.params, `${l.clave}: falta el parámetro ${m[1]}`);
    }
}

// ---- Índice armado a mano -------------------------------------------------------

const ADN_A =
  "' Cazador de prueba\n' caza algas\ncond\n*.eye5 0 >\nstart\n-1 .shoot store\n.up inc\nstop\nend\n";
const ADN_P = 'cond\n*.nrg 100 >\nstart\n50 .repro store\nstop\nend\n';

const BESTIARIO = [
  { file: 'a.txt', name: 'Alfa', board: 'F1 bots', veg: false },
  { file: 'a2.txt', name: 'Alfa bis', board: 'F1 bots', veg: false },
  { file: 'b.txt', name: 'Beta', board: 'F2 bots', veg: true },
  { file: 'c.txt', name: 'Gamma', board: 'F2 bots', veg: false },
];
const PERFILES = {
  caps: {
    mueve: { label: 'moves', group: 'Movement', desc: '' },
    veneno: { label: 'venom', group: 'Attack', desc: '' },
    fotosintesis: { label: 'photosynthesis', group: 'Energy', desc: '' },
  },
  archetypes: { depredador: 'Predator', vegetal: 'Vegetable' },
  bots: {
    // a.txt y a2.txt comparten ADN: misma clave
    'a.txt': {
      hash: 'aaaaaaaaaaaaaaaa',
      genes: 3,
      tokens: 20,
      caps: ['mueve', 'veneno'],
      arch: 'depredador',
      size: 'S',
      geneCaps: [],
    },
    'a2.txt': {
      hash: 'aaaaaaaaaaaaaaaa',
      genes: 3,
      tokens: 20,
      caps: ['mueve', 'veneno'],
      arch: 'depredador',
      size: 'S',
      geneCaps: [],
    },
    'b.txt': {
      hash: 'bbbbbbbbbbbbbbbb',
      genes: 1,
      tokens: 5,
      caps: ['fotosintesis'],
      arch: 'vegetal',
      size: 'S',
      geneCaps: [],
    },
  },
};

async function indiceConPropio() {
  const almacen = almacenMemoria();
  let n = 0;
  const bots = crearBots({
    almacen,
    nombresForo: () => BESTIARIO.map((b) => b.name),
    nuevaClave: () => `p:${String(++n).padStart(16, '0')}`,
    reloj: () => new Date('2026-09-30T10:00:00Z'),
  });
  const p = await bots.crear({ nombre: 'Mío', adn: ADN_P });
  // un propio con el mismo nombre que uno del foro
  const q = await bots.crear({ nombre: 'Gamma', adn: ADN_P }, { permitirNombreForo: true });
  await bots.favorito(['aaaaaaaaaaaaaaaa'], true);
  await bots.agregarTag(['bbbbbbbbbbbbbbbb', p.hash], 'algas');
  const indice = construirIndice({
    bestiario: BESTIARIO,
    perfiles: /** @type {any} */ (PERFILES),
    registros: await bots.todos(),
  });
  return { almacen, bots, indice, p, q };
}

// ---- Estado de filtros y vista ------------------------------------------------------

test('filtros: modo rápido, tag «sin tags», capacidades en tres estados y contadores', () => {
  const f = E.filtroInicial();
  assert.equal(E.modoRapido(f), 'todos');
  assert.equal(E.hayFiltro(f), false);
  const fav = E.conModoRapido(f, 'favoritos');
  assert.deepEqual([fav.fav, fav.origen, E.modoRapido(fav)], [true, '', 'favoritos']);
  const pr = E.conModoRapido(fav, 'propios');
  assert.deepEqual([pr.fav, pr.origen, E.modoRapido(pr)], [false, 'propio', 'propios']);
  assert.equal(E.modoRapido(E.conModoRapido(pr, 'todos')), 'todos');

  assert.equal(E.tagDeSelector(E.TAG_SIN), null);
  assert.equal(E.tagDeSelector('x'), 'x');
  assert.equal(E.selectorDeTag(null), E.TAG_SIN);
  assert.equal(E.selectorDeTag(''), '');

  let caps = E.ciclarCap({}, 'veneno');
  assert.deepEqual(caps, { veneno: 1 });
  caps = E.ciclarCap(caps, 'veneno');
  assert.deepEqual(caps, { veneno: -1 });
  caps = E.ciclarCap(caps, 'veneno');
  assert.deepEqual(caps, {});

  assert.equal(E.filtrosAvanzados({ ...f, foro: 'F1 bots', tag: null, caps: { a: 1, b: -1 } }), 4);
  assert.equal(E.hayFiltro({ ...f, q: '  ' }), false);
  assert.equal(E.hayFiltro({ ...f, q: 'alfa' }), true);

  assert.deepEqual(E.normalizarVista({ agrupar: 'nada', orden: 'genes' }), {
    agrupar: 'arquetipo',
    orden: 'genes',
  });
});

test('vista: filtra, agrupa y cuenta la selección por grupo (por clave, como la clásica)', async () => {
  const { indice, p } = await indiceConPropio();
  const f = E.filtroInicial();
  const sel = new Set(['aaaaaaaaaaaaaaaa']);
  const v = E.armarVista(indice, f, { agrupar: 'arquetipo', orden: 'nombre' }, sel, new Set());
  assert.equal(v.visibles.length, indice.length);
  const dep = v.grupos.find((g) => g.clave.valor === 'depredador');
  assert.ok(dep);
  // Alfa y Alfa bis comparten clave: una sola elegida = el grupo entero
  assert.equal(dep.entradas.length, 2);
  assert.equal(dep.nSel, 1);
  assert.equal(dep.estado, 'todos');
  assert.equal(dep.id, E.idGrupo('arquetipo', 'depredador'));
  const sin = v.grupos.find((g) => g.clave.valor === null);
  assert.equal(sin?.estado, 'ninguno');

  // plegados
  const v2 = E.armarVista(
    indice,
    f,
    { agrupar: 'arquetipo', orden: 'nombre' },
    sel,
    new Set([dep.id]),
  );
  assert.equal(v2.grupos.find((g) => g.id === dep.id)?.plegado, true);

  // tag, favoritos, propios y solo la selección
  const porTag = E.armarVista(indice, { ...f, tag: 'algas' }, E.vistaInicial(), sel);
  assert.deepEqual(porTag.visibles.map((e) => e.nombre).sort(), ['Beta', 'Mío']);
  const favs = E.armarVista(indice, E.conModoRapido(f, 'favoritos'), E.vistaInicial(), sel);
  assert.deepEqual(favs.visibles.map((e) => e.nombre).sort(), ['Alfa', 'Alfa bis']);
  const propios = E.armarVista(indice, E.conModoRapido(f, 'propios'), E.vistaInicial(), sel);
  assert.deepEqual(
    propios.visibles.map((e) => e.clave).sort(),
    [p.hash, `p:${'2'.padStart(16, '0')}`].sort(),
  );
  const soloSel = E.armarVista(indice, { ...f, soloSeleccion: true }, E.vistaInicial(), sel);
  assert.equal(soloSel.visibles.length, 2);
  // capacidad requerida y excluida
  const conVeneno = E.armarVista(indice, { ...f, caps: { veneno: 1 } }, E.vistaInicial(), sel);
  assert.deepEqual(conVeneno.visibles.map((e) => e.nombre).sort(), ['Alfa', 'Alfa bis']);
  const sinVeneno = E.armarVista(indice, { ...f, caps: { veneno: -1 } }, E.vistaInicial(), sel);
  assert.equal(sinVeneno.visibles.length, indice.length - 2);
});

test('selección múltiple: alternar, grupo, visibles, selección con nombre y poda', async () => {
  const { indice, p } = await indiceConPropio();
  let sel = new Set();
  sel = E.alternar(sel, 'bbbbbbbbbbbbbbbb');
  assert.deepEqual([...sel], ['bbbbbbbbbbbbbbbb']);
  const sel0 = sel;
  sel = E.alternar(sel, 'bbbbbbbbbbbbbbbb');
  assert.equal(sel.size, 0);
  assert.equal(sel0.size, 1, 'no muta la anterior');

  const alfas = indice.filter((e) => e.nombre.startsWith('Alfa'));
  assert.deepEqual(E.clavesDe(alfas), ['aaaaaaaaaaaaaaaa']);
  // grupo con algunos elegidos → los agrega todos; todos elegidos → los quita
  const grupo = indice.filter((e) => e.clase === 'foro');
  let s = E.alternarGrupo(new Set(['aaaaaaaaaaaaaaaa']), grupo);
  assert.equal(s.size, E.clavesDe(grupo).length);
  s = E.alternarGrupo(s, grupo);
  assert.equal(s.size, 0);
  assert.deepEqual(E.estadoSeleccion(grupo, new Set(['aaaaaaaaaaaaaaaa'])), {
    nSel: 1,
    estado: 'algunos',
  });

  s = E.agregarClaves(new Set(), E.clavesDe(indice));
  assert.equal(s.size, new Set(indice.map((e) => e.clave)).size);
  s = E.quitarClaves(s, [p.hash]);
  assert.equal(s.has(p.hash), false);

  // selección con nombre: ignora las claves que ya no están
  const cargada = E.seleccionDesde(
    { claves: [p.hash, 'p:ffffffffffffffff', 'file:zzz.txt'] },
    indice,
  );
  assert.deepEqual([...cargada], [p.hash]);
  // poda: devuelve la misma si no cambia
  const igual = new Set([p.hash]);
  assert.equal(E.podarSeleccion(igual, indice), igual);
  assert.deepEqual(
    [...E.podarSeleccion(new Set([p.hash, 'p:ffffffffffffffff']), indice)],
    [p.hash],
  );
  // plegados
  assert.deepEqual([...E.alternarPlegado(new Set(), 'tag|x')], ['tag|x']);
});

// ---- Siembra en lote ---------------------------------------------------------------------

test('lote: opciones normalizadas y una especie por clave', async () => {
  assert.deepEqual(normalizarLote({}), { ...LOTE_INICIAL });
  assert.deepEqual(normalizarLote({ cantidad: '7.9', cantidadVeg: 0, energia: 99999 }), {
    cantidad: 7,
    cantidadVeg: LOTE_INICIAL.cantidadVeg,
    energia: 32000,
  });
  // sin el tope de 500 (C23): solo el de los escenarios, con aviso desde 500
  assert.equal(normalizarLote({ cantidad: 9999 }).cantidad, 9999);
  assert.equal(normalizarLote({ cantidad: 99999 }).cantidad, CANTIDAD_MAX);
  assert.equal(cantidadAlta(CANTIDAD_AVISO), false);
  assert.equal(cantidadAlta(CANTIDAD_AVISO + 1), true);
  const { indice } = await indiceConPropio();
  const alfas = indice.filter((e) => e.nombre.startsWith('Alfa'));
  assert.equal(entradasUnicas(alfas).length, 1);
});

/** Sesión de sim falsa, como la de test/corrida.test.js. */
function sesionFalsa() {
  /** @type {any[]} */
  const enviados = [];
  const s = {
    stats: { cycle: 0, bots: 0 },
    corriendo: false,
    hayMundo: false,
    especies: [],
    enviados,
    c: {
      on: () => () => {},
      /** @param {any} m */
      enviar: (m) => enviados.push(m),
      /** @param {any} sp */
      seedSpecies: (sp) => enviados.push({ t: 'seed-species', sp }),
      dnaLib: () => {},
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
    seleccionar: () => {},
    cargar() {
      s.hayMundo = true;
    },
    guardar: async () => new Uint8Array([1, 2, 3]),
  };
  return s;
}

test('lote → corrida.sembrar: cada especie queda como evento «siembra» y el historial la encuentra', async () => {
  const { almacen, indice, p } = await indiceConPropio();
  const alfa = /** @type {any} */ (indice.find((e) => e.nombre === 'Alfa'));
  const beta = /** @type {any} */ (indice.find((e) => e.nombre === 'Beta'));
  const mio = /** @type {any} */ (indice.find((e) => e.clave === p.hash));
  const gamma = /** @type {any} */ (indice.find((e) => e.nombre === 'Gamma' && e.clase === 'foro'));
  const adnes = { 'a.txt': ADN_A, 'b.txt': 'cond\nstart\nstop\nend\n' };
  const colores = ['#112233', '#445566', '#778899'];
  const { especies, sinAdn } = await especiesConAdn(
    [alfa, beta, mio, alfa, gamma],
    { cantidad: 4, cantidadVeg: 9, energia: 2000 },
    async (e) => /** @type {any} */ (adnes)[e.archivo],
    () => /** @type {string} */ (colores.shift()),
  );
  assert.deepEqual(sinAdn, ['Gamma'], 'sin .txt no se siembra');
  const siembras = siembrasDe(especies);
  assert.deepEqual(siembras, [
    { nombre: 'Alfa', adn: ADN_A, cantidad: 4, color: '#112233', vegetal: false, energia: 2000 },
    {
      nombre: 'Beta',
      adn: adnes['b.txt'],
      cantidad: 9,
      color: '#445566',
      vegetal: true,
      energia: 2000,
    },
    { nombre: 'Mío', adn: ADN_P, cantidad: 4, color: '#778899', vegetal: false, energia: 2000 },
  ]);

  // el contrato de corrida.sembrar (src/lib/sim/corrida-nucleo.js)
  const sesion = sesionFalsa();
  const corridas = crearCorridas({ almacen });
  const n = new NucleoCorrida({
    sesion: /** @type {any} */ (sesion),
    corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: async (s) => `' ${s.bot}\nend\n`,
    miniatura: () => 'data:image/png;base64,AA==',
    descargar: () => {},
    ahora: () => 0,
    semillaNueva: () => 7,
  });
  await n.iniciar(/** @type {any} */ (escenarioFabrica('sopa-primordial')), 1);
  sesion.stats.cycle = 50;
  for (const s of siembras) await n.sembrar(s);
  const ev = n.estado.eventos.filter((e) => e.tipo === 'siembra');
  assert.equal(ev.length, 3);
  assert.deepEqual(
    ev.map((e) => /** @type {any} */ (e).especie),
    siembras.map((s) => ({ ...s })),
  );
  assert.equal(sesion.enviados.filter((m) => m.t === 'seed-species').length, 3);

  // guardada la corrida, el historial de cada bot la encuentra
  const g = await n.guardar('Con lote');
  const hMio = await historialBot(almacen, mio);
  assert.deepEqual(
    hMio.corridas.map((c) => c.id),
    [g.id],
  );
  const hAlfa = await historialBot(almacen, alfa, { lgs: [lgHash(ADN_A)] });
  assert.deepEqual(
    hAlfa.corridas.map((c) => c.id),
    [g.id],
  );
});

test('lote → escenario propio: valida, no pisa ids y lleva el hash del .txt de los del foro', async () => {
  const { indice, p } = await indiceConPropio();
  const alfa = /** @type {any} */ (indice.find((e) => e.nombre === 'Alfa'));
  const mio = /** @type {any} */ (indice.find((e) => e.clave === p.hash));
  const { especies } = await especiesConAdn([alfa, mio], LOTE_INICIAL, async () => ADN_A);
  const esp = especiesEscenario(especies);
  assert.equal(esp[0].origen, 'bestiario');
  assert.equal(esp[0].hash, lgHash(ADN_A));
  assert.equal(esp[0].adn, undefined, 'los del foro van por nombre');
  assert.equal(esp[1].origen, 'propio');
  assert.equal(esp[1].adn, ADN_P);
  assert.equal(esp[1].hash, lgHash(ADN_P));

  const r = escenarioLote(esp, { nombre: 'Sopa primordial' }, ['sopa-primordial-2']);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(validarPropio(r.escenario), []);
  assert.ok(!IDS_FABRICA.includes(r.escenario.id));
  assert.equal(r.escenario.id, 'sopa-primordial-3');
  assert.equal(r.escenario.nombre, 'Sopa primordial');
  assert.equal(r.escenario.opciones.base, 'clasica');
  assert.deepEqual(
    r.escenario.especies.map((s) => [s.bot, s.origen, s.cantidad]),
    [
      ['Alfa', 'bestiario', 5],
      ['Mío', 'propio', 5],
    ],
  );

  const mal = escenarioLote(esp, { nombre: '  ' });
  assert.equal(mal.ok, false);
  if (!mal.ok) assert.ok(mal.errores.some((e) => e.codigo === 'nombre'));
});

test('lote: nombres repetidos (propio homónimo de uno del foro) se renombran con sufijo', async () => {
  const { indice, p, q } = await indiceConPropio();
  const gammaForo = /** @type {any} */ (
    indice.find((e) => e.nombre === 'Gamma' && e.clase === 'foro')
  );
  const gammaMio = /** @type {any} */ (indice.find((e) => e.clave === q.hash));
  const mio = /** @type {any} */ (indice.find((e) => e.clave === p.hash));
  const ADN_G = 'cond\nstart\n.up inc\nstop\nend\n';
  // el propio va primero en el lote: igual conserva el nombre el del foro
  const { especies } = await especiesConAdn(
    [gammaMio, mio, gammaForo],
    LOTE_INICIAL,
    async () => ADN_G,
    () => '#123456',
  );
  const u = nombresUnicos(especies);
  assert.deepEqual(
    u.especies.map((x) => x.especie.bot),
    ['Gamma 2', 'Mío', 'Gamma'],
  );
  assert.deepEqual(u.renombrados, [{ de: 'Gamma', a: 'Gamma 2' }]);

  // corrida.sembrar recibe nombres distintos (cada especie, su ADN)
  const siembras = siembrasDe(especies);
  assert.deepEqual(
    siembras.map((s) => [s.nombre, s.adn]),
    [
      ['Gamma 2', ADN_P],
      ['Mío', ADN_P],
      ['Gamma', ADN_G],
    ],
  );

  // en el escenario: el del foro sigue por nombre; el propio, con su ADN
  const esp = especiesEscenario(especies);
  assert.deepEqual(
    esp.map((s) => [s.bot, s.origen, s.adn === undefined]),
    [
      ['Gamma 2', 'propio', false],
      ['Mío', 'propio', false],
      ['Gamma', 'bestiario', true],
    ],
  );
  const r = escenarioLote(esp, { nombre: 'Gammas' });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(validarPropio(r.escenario), []);

  // dos del mismo nombre sin entrada (y mayúsculas distintas): «x», «X 2», «x 3»
  const sueltos = ['x', 'X', 'x'].map((bot) => ({
    especie: /** @type {any} */ ({ bot, origen: 'propio', cantidad: 1, color: '#000000' }),
    adn: ADN_P,
  }));
  assert.deepEqual(
    nombresUnicos(sueltos).especies.map((x) => x.especie.bot),
    ['x', 'X 2', 'x 3'],
  );
  // sin repetidos, nada cambia
  const sinRep = nombresUnicos([especies[1]]);
  assert.equal(sinRep.especies[0], especies[1]);
  assert.deepEqual(sinRep.renombrados, []);
});

test('lote: un solo bot con los campos elegidos (nombre, color, vegetal, cantidad, energía)', async () => {
  const { indice } = await indiceConPropio();
  const alfa = /** @type {any} */ (indice.find((e) => e.nombre === 'Alfa'));
  const { especies } = await especiesConAdn([alfa], LOTE_INICIAL, async () => ADN_A);
  const x = conCampos(especies[0], {
    nombre: '  Cazador ',
    color: '#AABBCC',
    vegetal: true,
    cantidad: '750',
    energia: 1234.7,
  });
  assert.deepEqual(
    [x.especie.bot, x.especie.color, x.especie.vegetal, x.especie.cantidad, x.especie.energia],
    ['Cazador', '#aabbcc', true, 750, 1234],
  );
  // lo inválido queda como estaba
  const y = conCampos(especies[0], { nombre: ' ', color: 'rojo', cantidad: 0, energia: 'x' });
  assert.deepEqual(y.especie, especies[0].especie);
  assert.equal(conCampos(especies[0], { cantidad: 1e9 }).especie.cantidad, CANTIDAD_MAX);

  // renombrado a mano, el del foro va al escenario con su ADN dentro
  const [s] = especiesEscenario([x]);
  assert.deepEqual([s.bot, s.origen, s.adn, s.hash], ['Cazador', 'propio', ADN_A, lgHash(ADN_A)]);
  const [sembrada] = siembrasDe([x]);
  assert.deepEqual(sembrada, {
    nombre: 'Cazador',
    adn: ADN_A,
    cantidad: 750,
    color: '#aabbcc',
    vegetal: true,
    energia: 1234,
  });
});

test('lote: los colores evitan los que ya están en la corrida', () => {
  const usados = [PALETA[0].toUpperCase(), PALETA[2]];
  let k = 0;
  const p = paletaLibre(usados, () => `#0000${String(++k).padStart(2, '0')}`);
  const dados = PALETA.map(() => p());
  assert.ok(!dados.includes(PALETA[0]) && !dados.includes(PALETA[2]));
  assert.equal(new Set(dados).size, dados.length, 'sin repetir');
  assert.deepEqual(dados.slice(0, 2), [PALETA[1], PALETA[3]]);
  // agotada la paleta, el respaldo (la de la clásica), sin repetir los usados
  let n = 0;
  const q = paletaLibre(PALETA, () => (n++ === 0 ? PALETA[1] : '#ABCDEF'));
  assert.equal(q(), '#abcdef');
});

test('selector: busca en foro y propios; primero el nombre exacto y los que empiezan así', async () => {
  const { indice, p } = await indiceConPropio();
  const todos = buscarBots(indice, '');
  assert.equal(todos.total, indice.length);
  // favoritos (Alfa) y propios antes que el resto
  assert.equal(todos.lista[0].nombre, 'Alfa');
  assert.ok(
    todos.lista.findIndex((e) => e.clave === p.hash) <
      todos.lista.findIndex((e) => e.nombre === 'Beta'),
  );
  const g = buscarBots(indice, 'gamma');
  assert.deepEqual(g.lista.map((e) => e.clase).sort(), ['foro', 'propio']);
  const al = buscarBots(indice, 'alfa');
  assert.deepEqual(
    al.lista.map((e) => e.nombre),
    ['Alfa', 'Alfa bis'],
  );
  // por etiqueta
  assert.ok(buscarBots(indice, 'algas').lista.some((e) => e.clave === p.hash));
  // tope de resultados
  const uno = buscarBots(indice, '', 1);
  assert.deepEqual([uno.lista.length, uno.total], [1, indice.length]);
});

// ---- Ruta de la ficha ------------------------------------------------------------------------

test('ruta: pestañas y ficha por id, clave propia, nombre o hash', async () => {
  const { indice, p, q } = await indiceConPropio();
  assert.deepEqual(leerRuta([]), { clave: null, pestaña: 'resumen' });
  assert.deepEqual(leerRuta(['Alfa', 'adn']), { clave: 'Alfa', pestaña: 'adn' });
  assert.deepEqual(leerRuta(['Alfa', 'nada']), { clave: 'Alfa', pestaña: 'resumen' });

  const alfa = indice.find((e) => e.id === 'foro:a.txt');
  const alfaBis = indice.find((e) => e.id === 'foro:a2.txt');
  const mio = indice.find((e) => e.clave === p.hash);
  const gammaForo = indice.find((e) => e.id === 'foro:c.txt');
  const gammaMio = indice.find((e) => e.clave === q.hash);
  assert.ok(alfa && alfaBis && mio && gammaForo && gammaMio);

  assert.equal(mio.id, `propio:${p.hash}`);
  assert.equal(resolverClave(indice, 'foro:a2.txt'), alfaBis);
  assert.equal(resolverClave(indice, mio.id), mio);
  assert.equal(resolverClave(indice, p.hash), mio, "la clave 'p:…' sola");
  assert.equal(resolverClave(indice, 'Alfa bis'), alfaBis, 'por nombre exacto (Inicio)');
  assert.equal(resolverClave(indice, 'aaaaaaaaaaaaaaaa'), alfa, 'hash: el primero del foro');
  // hash de identidad compartido por dos propios (mismo ADN): uno de ellos
  const porHash = resolverClave(indice, mio.hash);
  assert.equal(porHash?.clase, 'propio');
  assert.equal(porHash?.hash, mio.hash);
  assert.equal(resolverClave(indice, 'no existe'), null);
  assert.equal(resolverClave(indice, null), null);
  // nombre repetido: gana el del foro; el propio se enlaza por id
  assert.equal(resolverClave(indice, 'Gamma'), gammaForo);
  assert.equal(claveDe(gammaForo, indice), 'Gamma');
  assert.equal(claveDe(gammaMio, indice), gammaMio.id);
  assert.equal(claveDe(mio, indice), 'Mío');

  // ida y vuelta por el router
  for (const e of [alfa, alfaBis, mio, gammaForo, gammaMio])
    for (const pestaña of /** @type {const} */ (['resumen', 'adn', 'historial'])) {
      const h = rutaFicha(e, indice, pestaña);
      const r = parsearHash(h);
      assert.equal(r.seccion, 'bots');
      const lr = leerRuta(r.partes);
      assert.equal(lr.pestaña, pestaña);
      assert.equal(resolverClave(indice, lr.clave), e, h);
    }
  assert.equal(rutaFicha(mio, indice), '#/bots/M%C3%ADo');
});

// ---- Textos por código ------------------------------------------------------------------------

test('errores: todos los códigos de ErrorBots del motor tienen texto en es y en', () => {
  const codigos = new Set();
  for (const f of ['bots.js', 'migracion.js', 'biblioteca.js', 'adn.js']) {
    const src = fs.readFileSync(path.join(RAIZ, 'engine', f), 'utf8');
    for (const m of src.matchAll(/ErrorBots\('([\w-]+)'/g)) codigos.add(m[1]);
  }
  assert.ok(codigos.size > 5);
  for (const c of codigos) assert.ok(CODIGOS_ERROR.includes(c), `sin texto: ${c}`);

  const m = mensajeError(new ErrorBots('nombre-del-foro', { nombre: 'Alfa' }));
  assert.deepEqual(m, { clave: 'bots.error.nombre-del-foro', params: { nombre: 'Alfa' } });
  assert.deepEqual(mensajeError(new ErrorAlmacen('version-vieja')), {
    clave: 'bots.error.almacen.version-vieja',
  });
  assert.equal(mensajeError(new Error('x')).clave, 'bots.error.otro');
  verificarLineas([m, mensajeError(new ErrorBots('version-nueva', { version: 9 }))]);

  const dics = diccionarios();
  for (const { prefijo, sufijos } of CLAVES_ARMADAS)
    for (const s of sufijos)
      for (const idioma of ['es', 'en'])
        assert.ok(dics[idioma][`${prefijo}${s}`], `${idioma}: falta ${prefijo}${s}`);
});

test('rótulos: las capacidades, grupos y arquetipos de profiles.json tienen texto', () => {
  const p = JSON.parse(fs.readFileSync(path.join(BOTS_WEB, 'profiles.json'), 'utf8'));
  assert.deepEqual(Object.keys(p.caps).sort(), [...CAPS].sort());
  assert.deepEqual(
    [...new Set(Object.values(p.caps).map((/** @type {any} */ c) => c.group))].sort(),
    [...GRUPOS_CAP].sort(),
  );
  assert.deepEqual(Object.keys(p.archetypes).sort(), [...ARQUETIPOS].sort());
});

test('migración e import: las líneas del resumen tienen texto y parámetros', async () => {
  // migración de un inventario viejo armado a mano
  const almacen = almacenMemoria();
  const leer = async () => ({
    version: 2,
    stores: {
      bots: [
        { key: 'aaaaaaaaaaaaaaaa', tags: ['caza'], fav: true, notes: 'bueno' },
        { key: 'file:b.txt', tags: [], fav: true, notes: '' },
        { key: 'cccccccccccccccc', tags: ['x'], fav: false, notes: '' },
      ],
      sets: [{ name: 'copa', keys: ['aaaaaaaaaaaaaaaa'] }],
      hybrids: [{ name: 'H1', parts: [{ file: 'a.txt', gi: 0 }] }],
    },
  });
  const r = await migrarInventario(almacen, { leer, perfiles: /** @type {any} */ (PERFILES) });
  assert.equal(r.nueva, true);
  assert.equal(migracionTrajoAlgo(r.resumen), true);
  const lm = lineasMigracion(r.resumen);
  assert.ok(lm.some((l) => l.clave === 'bots.migracion.marcas'));
  assert.ok(
    lm.some((l) => l.clave === 'bots.migracion.sinGenes'),
    'sin genes.json',
  );
  verificarLineas(lm);
  verificarLineas(lineasMigracion({ existia: false }));
  assert.equal(migracionTrajoAlgo({ existia: false }), false);
  verificarLineas(lineasMigracion({ existia: true }));

  // import del Export del inventario de la clásica (JSON viejo)
  const viejo = {
    format: 'darwinbots-inventario',
    version: 1,
    bots: [{ key: 'bbbbbbbbbbbbbbbb', tags: ['algas'], fav: false, notes: 'otra nota' }],
    sets: [{ name: 'copa', keys: ['bbbbbbbbbbbbbbbb'] }],
  };
  const ri = await importarBiblioteca(almacen, JSON.stringify(viejo), {
    perfiles: /** @type {any} */ (PERFILES),
  });
  const li = lineasImport(ri);
  assert.equal(li[0].clave, 'bots.importar.formatoClasica');
  assert.ok(li.some((l) => l.clave === 'bots.importar.seleccionesPisadas'));
  verificarLineas(li);
  verificarLineas(
    lineasImport({
      formato: 'darwinbots2',
      conflictos: [{ clave: 'p:1', nombre: 'A', nuevaClave: 'p:2', nombreNuevo: 'A 2' }],
      invalidos: 2,
    }),
  );
  assert.deepEqual(
    lineasImport({ formato: 'darwinbots2' }).map((l) => l.clave),
    ['bots.importar.formato', 'bots.importar.nada'],
  );

  // errores de formato traducidos por código
  for (const [txt, codigo] of [
    ['{', 'json-invalido'],
    ['{"x":1}', 'formato-desconocido'],
    ['{"formato":"darwinbots2-biblioteca","version":99}', 'version-nueva'],
  ]) {
    await assert.rejects(importarBiblioteca(almacen, txt), (e) => {
      const m = mensajeError(e);
      assert.equal(m.clave, `bots.error.${codigo}`);
      verificarLineas([m]);
      return true;
    });
  }
});

// ---- ADN en el Resumen ----------------------------------------------------------------------------

test('ADN: descripción de la cabecera, qué lee y escribe, y disparos', () => {
  assert.equal(descripcionAdn(ADN_A), 'Cazador de prueba\ncaza algas');
  assert.equal(descripcionAdn(ADN_P), '');
  assert.equal(descripcionAdn("'''''''\n' Título\n'\n' más\ncond"), 'Título\n\nmás');
  assert.deepEqual(leeYEscribe(ADN_A), { lee: ['eye5'], escribe: ['shoot', 'up'], disparos: [-1] });
  const x = leeYEscribe(
    "cond\n*.refxpos *.refypos angle .setaim store ' .fake store\n-3 .shoot store\n.shoot .vloc store\n-6 .shoot store\n",
  );
  assert.deepEqual(x.lee, ['refxpos', 'refypos']);
  assert.deepEqual(x.escribe, ['setaim', 'shoot', 'vloc']);
  assert.deepEqual(x.disparos, [-6, -3]);
  // el ADN de un bot nuevo no está vacío (crear lo exige)
  assert.ok(ADN_NUEVO.trim());
});
