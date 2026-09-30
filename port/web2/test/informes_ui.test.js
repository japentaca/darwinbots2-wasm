// @ts-check
// Pestaña Informes de Analizar (lo puro): datos de las tres plantillas desde
// lo que tiene la interfaz, informes guardados en el almacén 'informes'
// (decisión 17), rutas de Analizar con pestaña, medidas del PNG y la
// tarjeta Hallazgos del Panel agrupada como el resumen del informe.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { Linaje } from '../engine/lineage.js';
import { semillasReplicas } from '../engine/replicas.js';
import { CODIGOS_ERROR, generarInforme } from '../engine/report/index.js';
import { hallazgosTarjeta } from '../src/lib/analizar/hallazgos.js';
import {
  CODIGOS_ERROR_UI,
  claveError,
  corridasPorDefecto,
  datosComparacion,
  datosCorrida,
  datosReplicas,
  trabajosReplicas,
} from '../src/lib/analizar/informes/datos.js';
import {
  borrarInforme,
  guardarInforme,
  leerInforme,
  listarInformes,
  MAX_INFORMES,
} from '../src/lib/analizar/informes/guardados.js';
import {
  CODIGOS_ERROR_PNG,
  ErrorPng,
  escalaPng,
  filasLeyenda,
  medidasLienzo,
} from '../src/lib/analizar/informes/png.js';
import { hashAnalizar, leerRuta, PESTAÑAS, rutaAnalizar } from '../src/lib/analizar/ruta.js';
import { parsearHash } from '../src/router.js';
import { ciclos, historiaDe } from './util/historia-sintetica.js';
import { resultadoSintetico } from './util/replicas-sinteticas.js';
import { validar } from './util/validar-informe.js';

/** @param {number} n @param {(i: number) => number | null} f */
const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const ESCENARIO = {
  id: 'sopa',
  nombre: { es: 'Sopa', en: 'Soup' },
  opciones: { base: 'f1', cambios: {} },
  especies: [{ bot: 'Alga Minimalis 3.0', cantidad: 30, vegetal: true }],
  objetos: { obstaculos: [], teleporters: [] },
};

test('datos: Corrida desde la fuente de Analizar genera un informe válido', () => {
  const historia = historiaDe({ t: ciclos(50), especies: { A: serie(50, () => 10) } });
  const fuente = /** @type {any} */ ({
    tipo: 'guardada',
    id: 'c1',
    nombre: 'Mi corrida',
    semilla: 42,
    escenario: ESCENARIO,
    historia,
    linaje: new Linaje(),
    colores: {},
  });
  const cambios = [{ ciclo: 100, tipo: 'opciones', cambios: { 'opt:11': 1 } }];
  const d = datosCorrida(fuente, cambios, '2026-09-29T00:00:00Z');
  assert.equal(d.titulo, 'Mi corrida');
  assert.equal(d.semilla, 42);
  assert.notEqual(d.cambios, cambios, 'copia');
  const r = generarInforme('corrida', d, { idioma: 'es' });
  const datos = validar(r.html);
  assert.equal(datos.titulo, 'Mi corrida');
  assert.equal(datos.cambios.length, 1);
});

test('datos: Comparación desde dos fuentes de Comparar', () => {
  const h = historiaDe({ t: ciclos(40), especies: { A: serie(40, () => 10) } });
  /** @param {string} nombre @param {number} semilla */
  const f = (nombre, semilla) => ({
    id: nombre,
    nombre,
    escenario: ESCENARIO,
    semilla,
    eventos: [],
    historia: h,
  });
  const d = datosComparacion(f('Uno', 1), f('Dos', 2), 0);
  assert.equal(d.a.titulo, 'Uno');
  assert.equal(d.b.semilla, 2);
  const r = generarInforme('comparacion', d, { idioma: 'en' });
  const datos = validar(r.html);
  assert.deepEqual(
    datos.diferencias.map((/** @type {any} */ x) => x.clave),
    ['semilla'],
  );
});

test('datos: Réplicas desde el registro de la cola y sus resultados (null = sin terminar)', () => {
  const semillas = semillasReplicas(7, 3);
  const tr = {
    titulo: '3 réplicas de Sopa',
    params: {
      escenario: ESCENARIO,
      adn: ['x'],
      semillas,
      eventos: [],
      ciclos: 2000,
      cada: 100,
      maxPuntos: 500,
      metrica: 'vivos',
      origen: { nombre: 'Sopa', id: null },
    },
  };
  const res = [resultadoSintetico({ ciclos: 2000, cada: 100, vivos: () => 50 })];
  const d = datosReplicas(tr, res, 0);
  assert.equal(d.resultados.length, 3);
  assert.deepEqual(d.resultados.slice(1), [null, null]);
  assert.equal(d.titulo, '3 réplicas de Sopa');
  const r = generarInforme('replicas', d, { idioma: 'es' });
  const datos = validar(r.html);
  assert.equal(datos.hechas, 1);
  assert.equal(datos.titulo, '3 réplicas de Sopa');
  // lista de trabajos: solo los de réplicas terminados, el más reciente primero
  /** @param {string} id @param {string} tipo @param {string} estado @param {string} act */
  const t = (id, tipo, estado, act) => /** @type {any} */ ({ id, tipo, estado, actualizado: act });
  /** @param {string[]} estados */
  const u = (estados) => estados.map((estado) => ({ estado, progreso: 0 }));
  const l = trabajosReplicas([
    { ...t('a', 'replicas', 'terminado', '2026-01-01'), unidades: u(['hecha', 'hecha']) },
    t('b', 'replicas', 'corriendo', '2026-01-02'),
    t('c', 'torneo', 'terminado', '2026-01-03'),
    t('d', 'replicas', 'terminado', '2026-01-04'),
    { ...t('e', 'replicas', 'fallido', '2026-01-05'), unidades: u(['pendiente', 'fallida']) },
    {
      ...t('f', 'replicas', 'cancelado', '2026-01-06'),
      unidades: u(['hecha', 'pendiente', 'hecha']),
    },
    { ...t('g', 'replicas', 'fallido', '2026-01-07'), unidades: u(['hecha', 'fallida']) },
  ]);
  // terminados y, con alguna réplica hecha, cancelados y fallidos (parciales)
  assert.deepEqual(
    l.listos.map((x) => x.id),
    ['g', 'f', 'd', 'a'],
  );
  const f = /** @type {any} */ (l.listos[1]);
  assert.deepEqual([f.parcial, f.hechas, f.n], [true, 2, 3]);
  assert.equal(/** @type {any} */ (l.listos[3]).parcial, false);
  assert.equal(l.enCola, 1);
  // el informe de un trabajo parcial: las réplicas sin terminar van en null
  const parcial = datosReplicas(tr, [res[0], null, null], 0);
  assert.equal(validar(generarInforme('replicas', parcial, { idioma: 'en' }).html).hechas, 1);
});

test('errores con código: se traducen (engine/report y png.js), en es y en en', () => {
  const es = JSON.parse(
    readFileSync(new URL('../src/i18n/es/informes.json', import.meta.url), 'utf8'),
  );
  const en = JSON.parse(
    readFileSync(new URL('../src/i18n/en/informes.json', import.meta.url), 'utf8'),
  );
  for (const c of CODIGOS_ERROR_UI) {
    const k = claveError({ codigo: c });
    assert.equal(k, `informes.error.cod.${c}`);
    assert.ok(es[/** @type {string} */ (k)] && en[/** @type {string} */ (k)], `texto de ${c}`);
  }
  for (const c of CODIGOS_ERROR) assert.ok(CODIGOS_ERROR_UI.includes(c));
  for (const c of CODIGOS_ERROR_PNG) assert.ok(CODIGOS_ERROR_UI.includes(c));
  assert.equal(claveError(new ErrorPng('png-imagen')), 'informes.error.cod.png-imagen');
  assert.equal(claveError(new Error('otra cosa')), null);
  assert.equal(claveError({ codigo: 'nada' }), null);
  assert.equal(claveError(null), null);
  let e = null;
  try {
    generarInforme(/** @type {any} */ ('nada'), {});
  } catch (x) {
    e = x;
  }
  assert.equal(claveError(e), 'informes.error.cod.tipo');
});

test('guardados: guardar, listar sin html, leer, borrar y podar a MAX_INFORMES', async () => {
  const a = almacenMemoria();
  const base = { tipo: /** @type {const} */ ('corrida'), idioma: 'es', html: '<p>ñ</p>' };
  const r = await guardarInforme(
    a,
    { ...base, titulo: 'Uno', archivo: 'uno.html', corrida: 'c1' },
    { id: 'a1', fecha: new Date('2026-09-01T00:00:00Z') },
  );
  assert.equal(r.bytes, 9, 'bytes UTF-8');
  assert.equal(r.corrida, 'c1');
  const sin = await guardarInforme(
    a,
    { ...base, titulo: 'Dos', archivo: 'dos.html', corrida: null },
    { id: 'a2', fecha: new Date('2026-09-02T00:00:00Z') },
  );
  assert.ok(!('corrida' in sin), 'sin corrida guardada: sin el campo del índice');
  const l = await listarInformes(a);
  assert.deepEqual(
    l.map((x) => x.id),
    ['a2', 'a1'],
  );
  assert.ok(l.every((x) => !('html' in x)));
  assert.equal((await leerInforme(a, 'a1'))?.html, '<p>ñ</p>');
  await borrarInforme(a, 'a1');
  assert.equal(await leerInforme(a, 'a1'), null);
  // podar lee solo las claves: una transacción sin list() alcanza
  const sinList = /** @type {typeof a} */ ({
    ...a,
    tx: (stores, fn) => a.tx(stores, (t) => fn({ ...t, list: () => assert.fail('list') })),
  });
  for (let i = 0; i < MAX_INFORMES + 5; i++)
    await guardarInforme(
      sinList,
      { ...base, titulo: `N${i}`, archivo: `n${i}.html` },
      { id: `n${String(i).padStart(3, '0')}`, fecha: new Date(Date.UTC(2026, 9, 1, 0, i)) },
    );
  const todos = await listarInformes(a);
  assert.equal(todos.length, MAX_INFORMES);
  assert.equal(todos[0].titulo, `N${MAX_INFORMES + 4}`, 'quedan los más recientes');
  assert.ok(!todos.some((x) => x.id === 'a2'), 'el más viejo se podó');
});

test('ruta: Analizar en una corrida y una pestaña', () => {
  assert.deepEqual(leerRuta([]), { sel: 'actual', pestaña: null });
  assert.deepEqual(leerRuta(['c1']), { sel: 'c1', pestaña: null });
  assert.deepEqual(leerRuta(['actual', 'comparar']), { sel: 'actual', pestaña: 'comparar' });
  assert.deepEqual(leerRuta(['c1', 'informes']), { sel: 'c1', pestaña: 'informes' });
  assert.deepEqual(leerRuta(['c1', 'nada']), { sel: 'c1', pestaña: null });
  // `#/analizar/<pestaña>` es la actual en esa pestaña
  assert.deepEqual(leerRuta(['informes']), { sel: 'actual', pestaña: 'informes' });
  assert.deepEqual(leerRuta(['comparar']), { sel: 'actual', pestaña: 'comparar' });
  // hash canónico que escribe Analizar al cambiar de pestaña o de corrida
  assert.equal(hashAnalizar('actual', 'panel'), '#/analizar');
  assert.equal(hashAnalizar('c1', 'panel'), '#/analizar/c1');
  assert.equal(hashAnalizar('actual', 'informes'), '#/analizar/actual/informes');
  for (const sel of ['actual', 'c 1'])
    for (const p of PESTAÑAS) {
      const r = leerRuta(parsearHash(hashAnalizar(sel, p)).partes);
      assert.equal(r.sel, sel);
      assert.equal(r.pestaña ?? 'panel', p, 'ida y vuelta');
    }
  assert.equal(rutaAnalizar(), '#/analizar');
  assert.equal(rutaAnalizar('actual', 'comparar'), '#/analizar/actual/comparar');
  assert.equal(rutaAnalizar('c 1', 'informes'), '#/analizar/c%201/informes');
  assert.equal(rutaAnalizar('c1'), '#/analizar/c1');
  for (const p of PESTAÑAS) {
    const r = parsearHash(rutaAnalizar('id/raro', p));
    assert.equal(r.seccion, 'analizar');
    assert.deepEqual(leerRuta(r.partes), { sel: 'id/raro', pestaña: p }, 'ida y vuelta');
  }
  // el chip de trabajos de la barra lleva a Comparar (las réplicas; las
  // rondas de torneo, a Competir: N4.4, test/pulido.test.js)
  const barra = readFileSync(new URL('../src/lib/BarraSuperior.svelte', import.meta.url), 'utf8');
  assert.match(barra, /destinoChip\(/);
  const destino = readFileSync(new URL('../src/lib/trabajos/destino.js', import.meta.url), 'utf8');
  assert.match(destino, /rutaAnalizar\('actual', 'comparar'\)/);
});

test('png: filas de la leyenda y medidas del lienzo', () => {
  const medir = (/** @type {string} */ s) => s.length * 7;
  const items = ['Alga', 'Zebedee V2.1', 'Animal Minimalis 4G', 'Yojimbo'].map((nombre) => ({
    nombre,
    color: '#000000',
  }));
  const filas = filasLeyenda(items, 200, medir);
  assert.ok(filas.length >= 2);
  for (const f of filas) {
    assert.equal(f[0].x, 0);
    const ult = f[f.length - 1];
    assert.ok(f.length === 1 || ult.x + medir(ult.nombre) + 26 <= 200, 'cada fila cabe');
  }
  assert.deepEqual(
    filas.flat().map((x) => x.nombre),
    items.map((x) => x.nombre),
  );
  assert.deepEqual(filasLeyenda([], 100, medir), []);
  // escala: la densidad de la pantalla, entre 1 y 4
  assert.equal(escalaPng(2), 2);
  assert.equal(escalaPng(1.5), 1.5);
  assert.equal(escalaPng(undefined), 1);
  assert.equal(escalaPng(0.5), 1);
  assert.equal(escalaPng(9), 4);
  const m = medidasLienzo(600, 200, 0);
  assert.equal(m.xSvg, 16);
  assert.ok(m.ySvg > 16);
  assert.equal(m.ancho, 632);
  assert.ok(medidasLienzo(600, 200, 2).alto > m.alto);
});

test('Panel: la tarjeta Hallazgos agrupa como el resumen (12 extinciones = 1 frase)', () => {
  const n = 200;
  /** @type {Record<string, (number | null)[]>} */
  const especies = { Alga: serie(n, () => 300) };
  for (let k = 1; k <= 12; k++) especies[`Bot ${k}`] = serie(n, (i) => (i < 100 ? 5 + k : null));
  const h = historiaDe({ t: ciclos(n), especies, vegetales: ['Alga'] });
  const hs = hallazgosTarjeta(h);
  const ext = hs.filter((x) => x.tipo === 'extincion');
  assert.equal(ext.length, 1);
  assert.equal(ext[0].clave, 'extincion.grupoCiclo');
  assert.deepEqual(hallazgosTarjeta(/** @type {any} */ ({})), [], 'historia rota: ninguno');
});

test('Informes: corridas por defecto (la que mira Analizar; B razonable)', () => {
  const ids = ['actual', 'g2', 'g1'];
  assert.deepEqual(corridasPorDefecto(ids, 'actual', 'actual'), {
    origen: 'actual',
    a: 'actual',
    b: 'g2',
  });
  assert.deepEqual(corridasPorDefecto(ids, 'g1', 'actual'), { origen: 'g1', a: 'g1', b: 'actual' });
  // la guardada que se mira todavía no está en la lista (cargando): la primera
  assert.deepEqual(corridasPorDefecto(['actual'], 'g1', 'actual'), {
    origen: 'actual',
    a: 'actual',
    b: '',
  });
  // sin corrida actual
  assert.deepEqual(corridasPorDefecto(['g2', 'g1'], '', 'actual'), {
    origen: 'g2',
    a: 'g2',
    b: 'g1',
  });
  assert.deepEqual(corridasPorDefecto(['g2', 'g1'], 'g1', 'actual'), {
    origen: 'g1',
    a: 'g1',
    b: 'g2',
  });
  assert.deepEqual(corridasPorDefecto([], '', 'actual'), { origen: '', a: '', b: '' });
});
