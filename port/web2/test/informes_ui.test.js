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
import { generarInforme } from '../engine/report/index.js';
import { hallazgosTarjeta } from '../src/lib/analizar/hallazgos.js';
import {
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
import { filasLeyenda, medidasLienzo } from '../src/lib/analizar/informes/png.js';
import { leerRuta, PESTAÑAS, rutaAnalizar } from '../src/lib/analizar/ruta.js';
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
  const l = trabajosReplicas([
    t('a', 'replicas', 'terminado', '2026-01-01'),
    t('b', 'replicas', 'corriendo', '2026-01-02'),
    t('c', 'torneo', 'terminado', '2026-01-03'),
    t('d', 'replicas', 'terminado', '2026-01-04'),
    t('e', 'replicas', 'fallido', '2026-01-05'),
  ]);
  assert.deepEqual(
    l.terminados.map((x) => x.id),
    ['d', 'a'],
  );
  assert.equal(l.enCola, 1);
});

test('guardados: guardar, listar sin html, leer, borrar y podar a MAX_INFORMES', async () => {
  const a = almacenMemoria();
  const base = { tipo: /** @type {const} */ ('corrida'), idioma: 'es', html: '<p>ñ</p>' };
  const r = await guardarInforme(
    a,
    { ...base, titulo: 'Uno', archivo: 'uno.html', corrida: 'c1' },
    { id: 'x1', fecha: new Date('2026-09-01T00:00:00Z') },
  );
  assert.equal(r.bytes, 9, 'bytes UTF-8');
  assert.equal(r.corrida, 'c1');
  const sin = await guardarInforme(
    a,
    { ...base, titulo: 'Dos', archivo: 'dos.html', corrida: null },
    { id: 'x2', fecha: new Date('2026-09-02T00:00:00Z') },
  );
  assert.ok(!('corrida' in sin), 'sin corrida guardada: sin el campo del índice');
  const l = await listarInformes(a);
  assert.deepEqual(
    l.map((x) => x.id),
    ['x2', 'x1'],
  );
  assert.ok(l.every((x) => !('html' in x)));
  assert.equal((await leerInforme(a, 'x1'))?.html, '<p>ñ</p>');
  await borrarInforme(a, 'x1');
  assert.equal(await leerInforme(a, 'x1'), null);
  for (let i = 0; i < MAX_INFORMES + 5; i++)
    await guardarInforme(
      a,
      { ...base, titulo: `N${i}`, archivo: `n${i}.html` },
      { id: `n${String(i).padStart(3, '0')}`, fecha: new Date(Date.UTC(2026, 9, 1, 0, i)) },
    );
  const todos = await listarInformes(a);
  assert.equal(todos.length, MAX_INFORMES);
  assert.equal(todos[0].titulo, `N${MAX_INFORMES + 4}`, 'quedan los más recientes');
  assert.ok(!todos.some((x) => x.id === 'x2'), 'el más viejo se podó');
});

test('ruta: Analizar en una corrida y una pestaña', () => {
  assert.deepEqual(leerRuta([]), { sel: 'actual', pestaña: null });
  assert.deepEqual(leerRuta(['c1']), { sel: 'c1', pestaña: null });
  assert.deepEqual(leerRuta(['actual', 'comparar']), { sel: 'actual', pestaña: 'comparar' });
  assert.deepEqual(leerRuta(['c1', 'informes']), { sel: 'c1', pestaña: 'informes' });
  assert.deepEqual(leerRuta(['c1', 'nada']), { sel: 'c1', pestaña: null });
  assert.equal(rutaAnalizar(), '#/analizar');
  assert.equal(rutaAnalizar('actual', 'comparar'), '#/analizar/actual/comparar');
  assert.equal(rutaAnalizar('c 1', 'informes'), '#/analizar/c%201/informes');
  assert.equal(rutaAnalizar('c1'), '#/analizar/c1');
  for (const p of PESTAÑAS) {
    const r = parsearHash(rutaAnalizar('id/raro', p));
    assert.equal(r.seccion, 'analizar');
    assert.deepEqual(leerRuta(r.partes), { sel: 'id/raro', pestaña: p }, 'ida y vuelta');
  }
  // el chip de trabajos de la barra lleva a Comparar
  const barra = readFileSync(new URL('../src/lib/BarraSuperior.svelte', import.meta.url), 'utf8');
  assert.match(barra, /rutaAnalizar\('actual', 'comparar'\)/);
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
