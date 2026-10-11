// @ts-check
// Admisión a una liga (engine/admision.js, paso L3.1 de PLAN-LIGAS.md, D7):
// el perfil estático del ADN y admitir() con sus tres comprobaciones.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admitir, erroresAlInscribir, perfilLiga } from '../engine/admision.js';
import { almacenMemoria } from '../engine/almacen.js';
import { lgPool } from '../engine/league.js';
import { ligaPorId } from '../engine/ligas.js';
import { participantesDeEntradas } from '../engine/rondas.js';
import { crearTorneos } from '../engine/torneos.js';
import { rng } from './util/clasica-vm.js';
import { depsDePrueba } from './util/torneos-deps.js';

/** Un ADN de `n` genes que solo mueven el bot: un store por gen. */
const nGenes = (n) =>
  Array.from({ length: n }, () => 'cond\n*.robage 1 >\nstart\n1 .up store\nstop').join('\n');

const claves = (ms) => ms.map((m) => m.clave);

test('perfilLiga cuenta genes y comandos de la familia store', () => {
  const p = perfilLiga('cond\n*.robage 1 >\nstart\n1 .up store\n.sx inc\n.dn dec\nstop\n');
  assert.equal(p.genes, 1);
  assert.equal(p.stores, 3);
  assert.deepEqual([...p.escribe].sort(), ['dn', 'sx', 'up']);
  assert.equal(perfilLiga(nGenes(7)).genes, 7);
});

test('perfilLiga: el destino puede ser una dirección de sysvar, y los comentarios no cuentan', () => {
  // 1 es la dirección de .up; el store comentado no se cuenta.
  const p = perfilLiga("start\n10 1 store 'otro .sx store\nstop\n");
  assert.equal(p.stores, 1);
  assert.deepEqual([...p.escribe], ['up']);
});

test('perfilLiga detecta las capacidades de D7 y solo esas', () => {
  const adn = [
    'start',
    '1 .tie store',
    '-1 .tieloc store',
    '5 .mkvirus store',
    '1 .mkshell store',
    '1 .mkslime store',
    '1 .strvenom store',
    '1 .strpoison store',
    '1 .delgene store',
    '1 .sexrepro store',
    '7 .shoot store',
    '1 .up store',
    'stop',
  ].join('\n');
  const p = perfilLiga(adn);
  assert.deepEqual(
    [...p.caps].sort(),
    [
      'autoedita',
      'caparazon',
      'come-lazo',
      'dispara-info',
      'lazos',
      'limo',
      'repro-sex',
      'toxina',
      'veneno',
      'virus',
    ].sort(),
  );
});

test('perfilLiga: shoot -8 es reproducción sexual y shoot -3 es veneno', () => {
  assert.deepEqual([...perfilLiga('start\n-8 .shoot store\nstop').caps], ['repro-sex']);
  assert.deepEqual([...perfilLiga('start\n-3 .shoot store\nstop').caps], ['veneno']);
  // cazar (-1) y comer no están prohibidos en ninguna liga
  assert.equal(perfilLiga('start\n-1 .shoot store\nstop').caps.size, 0);
});

test('SB: siete genes es error y seis pasan', () => {
  const sb = ligaPorId('sb');
  const siete = admitir(sb, { nombre: 'Largo', adn: nGenes(7) });
  assert.equal(siete.ok, false);
  assert.deepEqual(claves(siete.errores), ['competir.admision.genes']);
  assert.deepEqual(siete.errores[0].params, { nombre: 'Largo', liga: 'SB', genes: 7, max: 6 });
  assert.equal(admitir(sb, { nombre: 'Corto', adn: nGenes(6) }).ok, true);
  // F1 no tiene tope de genes
  assert.equal(admitir('f1', { nombre: 'Largo', adn: nGenes(7) }).ok, true);
});

test('SS: dos store es error y uno pasa', () => {
  const ss = ligaPorId('ss');
  const dos = admitir(ss, { nombre: 'Dos', adn: 'start\n1 .up store\n1 .dn store\nstop' });
  assert.equal(dos.ok, false);
  assert.deepEqual(claves(dos.errores), ['competir.admision.stores']);
  assert.deepEqual(dos.errores[0].params, { nombre: 'Dos', liga: 'SS', stores: 2, max: 1 });
  assert.equal(admitir(ss, { nombre: 'Uno', adn: 'start\n1 .up store\nstop' }).ok, true);
  // inc y dec cuentan como store
  assert.equal(admitir(ss, { nombre: 'IncDec', adn: 'start\n.up inc\n.dn dec\nstop' }).ok, false);
});

test('F3: un .tie store avisa; en F1 no pasa nada', () => {
  const adn = 'start\n1 .tie store\nstop';
  const f3 = admitir('f3', { nombre: 'Atador', adn });
  assert.equal(f3.ok, true);
  assert.deepEqual(claves(f3.avisos), ['competir.admision.accion']);
  assert.equal(f3.avisos[0].params?.cap, 'lazos');
  const f1 = admitir('f1', { nombre: 'Atador', adn });
  assert.deepEqual(f1, { ok: true, errores: [], avisos: [] });
  // F2 prohíbe menos: los lazos solos no avisan, comer por lazo sí
  assert.deepEqual(admitir('f2', { nombre: 'Atador', adn }).avisos, []);
  const come = admitir('f2', { nombre: 'Comedor', adn: 'start\n-1 .tieloc store\nstop' });
  assert.equal(come.avisos[0].params?.cap, 'come-lazo');
});

test('las caps que trae la entrada (bots del foro) mandan sobre el análisis', () => {
  const adn = 'start\n1 .tie store\nstop';
  assert.deepEqual(admitir('f3', { nombre: 'Foro', adn, caps: ['mueve'] }).avisos, []);
  const v = admitir('f3', { nombre: 'Foro', adn: 'start\n1 .up store\nstop', caps: ['virus'] });
  assert.equal(v.avisos[0].params?.cap, 'virus');
});

test('categoría: un bot del board «F1 bots» avisa en F2 y uno de «F2 bots» no', () => {
  const adn = nGenes(1);
  const f1bot = admitir('f2', { nombre: 'Viejo', board: 'F1 bots', adn });
  assert.equal(f1bot.ok, true);
  assert.deepEqual(claves(f1bot.avisos), ['competir.admision.categoria']);
  assert.deepEqual(f1bot.avisos[0].params, { nombre: 'Viejo', liga: 'F2', board: 'F1 bots' });
  assert.deepEqual(admitir('f2', { nombre: 'Nuevo', board: 'F2 bots', adn }).avisos, []);
  assert.deepEqual(admitir('f2', { nombre: 'Mejor', board: 'F3 bots', adn }).avisos, []);
  // F3 solo admite el board F3
  assert.equal(admitir('f3', { nombre: 'Medio', board: 'F2 bots', adn }).avisos.length, 1);
});

test('categoría: la etiqueta del nombre entre paréntesis también cuenta', () => {
  const adn = nGenes(1);
  const avisos = (nombre, liga = 'f2') =>
    admitir(liga, { nombre, board: 'F1 bots', adn }).avisos.length;
  assert.equal(avisos('Foo (F2)'), 0);
  assert.equal(avisos('Foo (f3)'), 0);
  assert.equal(avisos('Foo (F2MB)'), 0);
  assert.equal(avisos('Foo (F2, evo)'), 0);
  assert.equal(avisos('Foo (Version 1.1)'), 1);
  assert.equal(avisos('Foo F2'), 1, 'sin paréntesis no cuenta');
  assert.equal(avisos('Foo (Passive)'), 1, 'SS dentro de una palabra no cuenta');
  assert.equal(avisos('Foo (F2)', 'f3'), 1);
  assert.equal(avisos('Foo (F3SB)', 'sb'), 0);
  assert.equal(avisos('Foo (SS-ish)', 'sb'), 0);
});

test('un bot propio (sin board) pasa la categoría; F1 y F4 admiten cualquier board', () => {
  const adn = nGenes(1);
  assert.deepEqual(admitir('f3', { nombre: 'Mío', adn }).avisos, []);
  assert.deepEqual(admitir('f3', { nombre: 'Mío', board: null, adn }).avisos, []);
  for (const liga of ['f1', 'f4'])
    assert.deepEqual(admitir(liga, { nombre: 'X', board: 'Short bots', adn }).avisos, []);
});

test('un vegetal es error en cualquier liga', () => {
  for (const liga of ['f1', 'f2', 'f4']) {
    const v = admitir(liga, { nombre: 'Pasto', veg: true, board: 'Veggies', adn: nGenes(1) });
    assert.equal(v.ok, false);
    assert.equal(v.errores[0].clave, 'competir.admision.vegetal');
  }
});

test('sin liga todo se admite', () => {
  for (const liga of [null, undefined, 'nada'])
    assert.deepEqual(admitir(liga, { nombre: 'X', veg: true, adn: nGenes(9) }), {
      ok: true,
      errores: [],
      avisos: [],
    });
});

test('admitir acepta el objeto de la liga o su id', () => {
  const adn = nGenes(7);
  assert.deepEqual(
    admitir('sb', { nombre: 'X', adn }),
    admitir(ligaPorId('sb'), { nombre: 'X', adn }),
  );
});

// ---- lgPool 'liga:<id>' (paso L3.2) -----------------------------------------------

/** Un inventario como el de la Biblioteca: cada ítem lleva su entrada en `b.entrada`. */
function inventario(entradas) {
  return {
    items: entradas.map((e) => ({
      key: e.clave,
      b: { name: e.nombre, file: '', veg: !!e.vegetal, entrada: e },
    })),
    sel: new Set(),
    sets: new Map(),
    userRec: () => ({ fav: false, tags: [] }),
  };
}

const propio = (nombre, adn) => ({
  clave: `p:${nombre}`,
  clase: 'propio',
  nombre,
  foro: null,
  adn,
});
const foro = (nombre, board, genes = 1, caps = []) => ({
  clave: `f:${nombre}`,
  clase: 'foro',
  nombre,
  foro: board,
  perfil: { genes, caps },
});
const nombresDelPool = (inv, filtro) => lgPool(inv, filtro).map((it) => it.b.name);

test("lgPool 'liga:sb' deja afuera al de siete genes y a los de otra categoría", () => {
  const inv = inventario([
    propio('Corto', nGenes(6)),
    propio('Largo', nGenes(7)),
    foro('ForoLargo', 'Short bots', 9),
    foro('ForoCorto', 'Short bots', 2),
    foro('Otro', 'F1 bots', 2),
  ]);
  assert.deepEqual(nombresDelPool(inv, 'liga:sb'), ['Corto', 'ForoCorto']);
});

test("lgPool 'liga:ss' mira los store del ADN de los propios", () => {
  const inv = inventario([
    propio('Uno', 'start\n1 .up store\nstop'),
    propio('Dos', 'start\n1 .up store\n1 .dn store\nstop'),
    foro('SS', 'Single store'),
    foro('Corto', 'Short bots'),
  ]);
  assert.deepEqual(nombresDelPool(inv, 'liga:ss'), ['Uno', 'SS']);
});

test("lgPool 'liga:f2' excluye a un «F1 bots» y deja a un propio", () => {
  const inv = inventario([
    foro('Viejo', 'F1 bots'),
    foro('Nuevo', 'F2 bots'),
    foro('Mejor', 'F3 bots'),
    propio('Mío', nGenes(1)),
  ]);
  assert.deepEqual(nombresDelPool(inv, 'liga:f2'), ['Nuevo', 'Mejor', 'Mío']);
});

test("lgPool 'liga:f3': las acciones prohibidas solo avisan, no excluyen", () => {
  const inv = inventario([
    propio('Atador', 'start\n1 .tie store\nstop'),
    foro('Virus', 'F3 bots', 2, ['virus']),
  ]);
  assert.deepEqual(nombresDelPool(inv, 'liga:f3'), ['Atador', 'Virus']);
});

test("lgPool 'liga:f1' deja pasar a todo bot no vegetal; los vegetales y una liga inexistente, no", () => {
  const inv = inventario([
    foro('Viejo', 'F1 bots'),
    { ...foro('Pasto', 'Veggies'), vegetal: true },
    propio('Mío', nGenes(9)),
  ]);
  assert.deepEqual(nombresDelPool(inv, 'liga:f1'), ['Viejo', 'Mío']);
  assert.deepEqual(nombresDelPool(inv, 'liga:nada'), []);
});

// ---- Al inscribir, con el ADN real (pendientes 2 y 3 de PLAN-LIGAS-INFORME.md) -------

const DOS_STORES = 'start\n1 .up store\n1 .dn store\nstop';
const UN_STORE = 'start\n1 .up store\nstop';

test('erroresAlInscribir: el ADN real de un bot del foro decide la regla de un solo store', () => {
  const e = { ...foro('Doble', 'Single store'), clave: 'f:Doble' };
  assert.deepEqual(claves(erroresAlInscribir('ss', e, DOS_STORES)), ['competir.admision.stores']);
  assert.deepEqual(erroresAlInscribir('ss', e, UN_STORE), []);
  // los genes también salen del ADN, no del perfil del índice
  assert.deepEqual(claves(erroresAlInscribir('sb', foro('X', 'Short bots', 2), nGenes(7))), [
    'competir.admision.genes',
  ]);
  assert.deepEqual(erroresAlInscribir(null, e, DOS_STORES), []);
  assert.deepEqual(erroresAlInscribir('f1', e, DOS_STORES), []);
});

test('participantesDeEntradas rechaza con su motivo a los que la liga no admite', async () => {
  const entradas = [
    { ...foro('Doble', 'Single store'), archivo: 'doble.txt', vegetal: false },
    { ...foro('Simple', 'Single store'), archivo: 'simple.txt', vegetal: false },
    { ...propio('Mío', DOS_STORES), vegetal: false },
  ];
  const adnDe = (/** @type {any} */ e) => (e.archivo === 'doble.txt' ? DOS_STORES : UN_STORE);
  const r = await participantesDeEntradas(entradas, adnDe, ligaPorId('ss'));
  assert.deepEqual(
    r.participantes.map((p) => p.name),
    ['Simple'],
  );
  assert.deepEqual(
    r.rechazados.map((x) => [x.nombre, claves(x.errores)]),
    [
      ['Doble', ['competir.admision.stores']],
      ['Mío', ['competir.admision.stores']],
    ],
  );
  // sin liga entran todos
  const todos = await participantesDeEntradas(entradas, adnDe);
  assert.equal(todos.participantes.length, 3);
  assert.deepEqual(todos.rechazados, []);
});

test('el sorteo de un torneo SS salta a los que el ADN bajado deja afuera', async () => {
  const entradas = [
    { ...foro('Doble', 'Single store'), archivo: 'doble.txt' },
    { ...foro('Simple', 'Single store'), archivo: 'simple.txt' },
    { ...foro('Otro', 'Single store'), archivo: 'otro.txt' },
  ];
  const inv = {
    ...inventario(entradas),
    fetchDna: async (/** @type {any} */ b) =>
      b.entrada.archivo === 'doble.txt' ? DOS_STORES : `start\n${b.name.length} .up store\nstop`,
    color: () => '#888888',
  };
  let k = 0;
  const T = crearTorneos(
    depsDePrueba({
      almacen: almacenMemoria(),
      nuevoId: () => `T${++k}`,
      azar: rng(2),
      inventario: inv,
    }),
  );
  await T.lgLoadAll();
  const L = await T.lgCreate({ liga: 'ss' });
  // el pool por liga deja pasar a los tres (el índice no trae ADN); con 'all', igual
  for (const pool of ['liga:ss', 'all']) {
    await T.lgSetDraw({ mode: 'random', n: 3, pool });
    const r = await T.lgRedraw(L);
    assert.deepEqual(r, { added: 2, failed: 0, rejected: 1 }, pool);
    assert.deepEqual(
      L.seasons
        .at(-1)
        .entrants.map((e) => e.name)
        .sort(),
      ['Otro', 'Simple'],
      pool,
    );
  }
});
