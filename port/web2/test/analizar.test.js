// @ts-check
// Analizar (src/lib/analizar/*.js, lógica pura): catálogo del Panel y su
// elección recordada, tabla de especies, árbol de especies e individuos,
// histogramas y mapa de calor, diff de ADN, filtros de eventos, fuente de
// una corrida guardada y las claves i18n armadas con plantilla.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Historia } from '../engine/history.js';
import { diffGenes, Linaje } from '../engine/lineage.js';
import {
  FLAG_LINAJE,
  GRUPOS,
  HISTOGRAMAS,
  IE,
  IM,
  N_ESPECIE,
  N_LINAJE,
  N_METRICAS,
} from '../engine/metricas.js';
import {
  CATALOGO,
  CLAVE_PANEL,
  claveNombre,
  colorEspecie,
  entrada,
  guardarPanel,
  leerPanel,
  PANEL_POR_DEFECTO,
  panelValido,
  porGrupo,
  serieAlineada,
  seriesDe,
} from '../src/lib/analizar/catalogo.js';
import {
  COLUMNAS,
  COMPORTAMIENTO_FICHA,
  filasEspecies,
  ordenarFilas,
  sparkline,
} from '../src/lib/analizar/especies.js';
import { cuentas, FILTROS, filtrarEventos, filtroDe } from '../src/lib/analizar/eventos.js';
import {
  arbolIndividuos,
  enlacesIndividuos,
  filasArbol,
  vecinoIndividuo,
} from '../src/lib/analizar/filogenia.js';
import { coloresDe, fuenteActual, fuenteGuardada } from '../src/lib/analizar/fuente.js';
import {
  compararFotos,
  diffPalabras,
  distanciaDiff,
  finMapa,
  histogramaDe,
  histogramaEspecie,
  KINDS_LINAJE,
  lcsLongitud,
  mapaCalor,
  mediana,
  memoComparaciones,
  numeroGen,
  pathsMapa,
  ultimoHistograma,
} from '../src/lib/analizar/genetica.js';
import { geometria } from '../src/lib/analizar/grafico/geometria.js';
import {
  claveHallazgo,
  esperaHallazgos,
  hallazgosDe,
  REFRESCO_HALLAZGOS_MS,
  textoHallazgo,
} from '../src/lib/analizar/hallazgos.js';

const leer = (/** @type {string} */ l) =>
  JSON.parse(readFileSync(new URL(`../src/i18n/${l}/analizar.json`, import.meta.url), 'utf8'));
const ES = leer('es');
const EN = leer('en');

/**
 * Muestra con especies (vivos, genMax, adnMedia) y, opcionalmente, un histograma.
 * @param {number} ciclo @param {Record<string, number>} especies
 * @param {{bins: number, datos: number[], n: number[]}} [hist]
 */
function muestra(ciclo, especies, hist) {
  const metrics = new Float32Array(N_METRICAS);
  metrics[IM.ciclo] = ciclo;
  metrics[IM.vivos] = Object.values(especies).reduce((s, n) => s + n, 0);
  return {
    ciclo,
    metrics,
    especies: Object.entries(especies)
      .filter(([, n]) => n > 0)
      .map(([nombre, n]) => {
        const stats = new Float32Array(N_ESPECIE);
        stats[IE.vivos] = n;
        stats[IE.genMax] = ciclo / 100;
        stats[IE.adnMedia] = 50 + n;
        stats[IE.nrgTotal] = n * 1000;
        return { nombre: `${nombre}.txt`, stats };
      }),
    histogramas: hist ?? null,
  };
}

test('catálogo: los seis grupos, ids únicos, modos válidos y claves i18n en es y en', () => {
  const ids = CATALOGO.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    porGrupo().map((g) => g.grupo),
    [...GRUPOS],
  );
  for (const g of porGrupo()) assert.ok(g.entradas.length > 0, `grupo vacío: ${g.grupo}`);
  for (const e of CATALOGO) {
    assert.ok(['lineas', 'apilado'].includes(e.modo));
    assert.ok(GRUPOS.includes(e.grupo));
    assert.ok(Object.hasOwn(ES, claveNombre(e)), `falta ${claveNombre(e)} (es)`);
    assert.ok(Object.hasOwn(EN, claveNombre(e)), `falta ${claveNombre(e)} (en)`);
  }
  assert.equal(entrada('g:ciclo'), null, 'el ciclo no es un gráfico');
  assert.equal(entrada('e:vivos')?.modo, 'apilado');
  assert.equal(entrada('e:adnMedia')?.modo, 'lineas');
  assert.equal(entrada('c:ticks'), null);
  for (const id of PANEL_POR_DEFECTO) assert.ok(entrada(id), id);
});

test('claves armadas con plantilla (pestañas, grupos, columnas, kinds, eventos…) existen', () => {
  const claves = [
    ...['panel', 'especies', 'filogenia', 'genetica', 'eventos', 'comparar', 'informes'].map(
      (p) => `analizar.tab.${p}`,
    ),
    ...['todo', 'r10k', 'r1k'].map((r) => `analizar.rango.${r}`),
    ...GRUPOS.map((g) => `analizar.grupo.${g}`),
    ...[...COLUMNAS, 'spark'].map((c) => `analizar.col.${c}`),
    ...HISTOGRAMAS.map((k) => `analizar.hist.${k}`),
    ...['igual', 'cambiado', 'agregado', 'quitado'].flatMap((x) => [
      `analizar.gen.tipo.${x}`,
      `analizar.gen.ley.${x}`,
    ]),
    ...Object.keys(FILTROS).map((f) => `analizar.ev.f.${f}`),
    ...[
      'extincion',
      'pico',
      'generacion',
      'llegada',
      'especieNueva',
      'cambio',
      'sembrado',
      'guardada',
      'cargada',
      'importada',
      'inicio',
    ].map((x) => `analizar.ev.tipo.${x}`),
    ...COMPORTAMIENTO_FICHA.map((c) => `analizar.m.c.${c}`),
  ];
  const faltan = claves.filter((k) => !Object.hasOwn(ES, k) || !Object.hasOwn(EN, k));
  assert.deepEqual(faltan, []);
  // los kinds de una especie son kinds del motor
  for (const k of Object.keys(KINDS_LINAJE)) assert.ok(HISTOGRAMAS.includes(k));
});

test('Panel: la elección se valida y se recuerda (y sin almacenamiento no falla)', () => {
  assert.deepEqual(panelValido(null), [...PANEL_POR_DEFECTO]);
  assert.deepEqual(panelValido(['g:vivos', 'nada', 3]), [
    'g:vivos',
    PANEL_POR_DEFECTO[1],
    PANEL_POR_DEFECTO[2],
    PANEL_POR_DEFECTO[3],
  ]);
  /** @type {Map<string, string>} */
  const m = new Map();
  const alm = {
    getItem: (/** @type {string} */ k) => m.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => void m.set(k, v),
  };
  guardarPanel(alm, ['g:luz', 'e:vivos', 'c:muertes', 'g:dia']);
  assert.deepEqual(JSON.parse(/** @type {string} */ (m.get(CLAVE_PANEL))), [
    'g:luz',
    'e:vivos',
    'c:muertes',
    'g:dia',
  ]);
  assert.deepEqual(leerPanel(alm), ['g:luz', 'e:vivos', 'c:muertes', 'g:dia']);
  m.set(CLAVE_PANEL, '{roto');
  assert.deepEqual(leerPanel(alm), [...PANEL_POR_DEFECTO]);
  const rompe = {
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
  };
  assert.deepEqual(leerPanel(rompe), [...PANEL_POR_DEFECTO]);
  assert.doesNotThrow(() => guardarPanel(rompe, ['g:vivos']));
  assert.deepEqual(leerPanel(null), [...PANEL_POR_DEFECTO]);
});

test('colorEspecie: el de la corrida o uno estable de la paleta', () => {
  assert.equal(colorEspecie('Alga', { Alga: '#00ff00' }), '#00ff00');
  const a = colorEspecie('Zebedee V2.1', {});
  assert.match(a, /^#[0-9a-f]{6}$/);
  assert.equal(colorEspecie('Zebedee V2.1', {}), a);
});

test('seriesDe: global con banda, apilado alineado y líneas por especie', () => {
  const h = new Historia();
  h.agregar(muestra(0, { A: 5, B: 1 }));
  h.agregar(muestra(100, { A: 6 }));
  h.agregar(muestra(200, { A: 7, B: 3 }));
  const g = seriesDe(h, /** @type {any} */ (entrada('g:vivos')), {
    colores: {},
    nombreGlobal: 'Vivos',
    otras: 'Otras',
  });
  assert.equal(g.length, 1);
  assert.deepEqual(Array.from(g[0].v), [6, 6, 10]);
  const ap = seriesDe(h, /** @type {any} */ (entrada('e:vivos')), {
    colores: {},
    nombreGlobal: '',
    otras: 'Otras',
  });
  assert.deepEqual(
    ap.map((s) => s.nombre),
    ['A', 'B'],
  );
  assert.deepEqual(ap[1].t, h.t, 'apilado: comparten el eje global');
  assert.notEqual(ap[1].t, h.t, 'copia: la historia viva crece');
  assert.ok(Number.isNaN(ap[1].v[1]), 'B ausente en 100');
  const li = seriesDe(h, /** @type {any} */ (entrada('e:adnMedia')), {
    colores: {},
    nombreGlobal: '',
    otras: 'Otras',
    soloEspecie: 'B',
  });
  assert.equal(li.length, 1);
  assert.deepEqual(li[0].t, [0, 100, 200], 'líneas: alineadas con el eje global');
  assert.ok(Number.isNaN(li[0].v[1]), 'B ausente en 100: NaN (la línea se corta)');
  assert.equal(li[0].n?.[1], 0);
  assert.deepEqual(li[0].v[0], 51);
  assert.deepEqual(
    seriesDe(new Historia(), /** @type {any} */ (entrada('e:vivos')), {
      colores: {},
      nombreGlobal: '',
      otras: '',
    }),
    [],
  );
});

test('especies: filas (hoy, máximo, aparición, extinción), orden y sparkline', () => {
  const h = new Historia();
  h.agregar(muestra(0, { A: 5, B: 2 }));
  h.agregar(muestra(100, { A: 9, B: 4 }));
  h.agregar(muestra(200, { A: 7 }));
  h.agregar(muestra(300, { A: 8, C: 1 }));
  const filas = filasEspecies(h, null);
  const por = Object.fromEntries(filas.map((f) => [f.nombre, f]));
  assert.equal(por.A.vivos, 8);
  assert.equal(por.A.max, 9);
  assert.equal(por.A.cicloMax, 100);
  assert.equal(por.A.aparicion, 0);
  assert.equal(por.A.extincion, null);
  assert.equal(por.B.vivos, 0);
  assert.equal(por.B.extincion, 100, 'último ciclo con bots');
  assert.equal(por.C.aparicion, 300);
  assert.equal(por.A.genMax, 3);
  assert.equal(por.A.nrgMedia, 1000);
  assert.deepEqual(
    ordenarFilas(filas, 'vivos', false).map((f) => f.nombre),
    ['A', 'C', 'B'],
  );
  assert.deepEqual(
    ordenarFilas(filas, 'nombre', true).map((f) => f.nombre),
    ['A', 'B', 'C'],
  );
  // extinción: las vivas (null) al final en los dos sentidos
  assert.deepEqual(
    ordenarFilas(filas, 'extincion', true).map((f) => f.nombre),
    ['B', 'A', 'C'],
  );
  assert.deepEqual(
    ordenarFilas(filas, 'extincion', false).map((f) => f.nombre),
    ['B', 'A', 'C'],
  );
  const d = sparkline(h.t, por.B.spark, 100, 20);
  assert.ok(d.startsWith('M1 '));
  assert.equal(sparkline([0], [1], 100, 20), '');
});

/**
 * Filas de linaje: [abs, parent, especie, gen, muerto?].
 * @param {[number, number, number, number, boolean?][]} bots
 */
function filasLin(bots) {
  const out = new Int32Array(bots.length * N_LINAJE);
  bots.forEach(([abs, parent, esp, gen, muerto], i) => {
    out.set(
      [
        abs,
        parent,
        esp,
        gen,
        gen,
        gen * 10,
        100 + gen,
        muerto ? FLAG_LINAJE.cadaver : 0,
        0,
        0,
        1,
        0,
      ],
      i * N_LINAJE,
    );
  });
  return out;
}

test('filogenia: árbol plano (C7) con vidas, y colapsar hijas', () => {
  const h = new Historia();
  h.agregar(muestra(0, { A: 5, B: 2 }));
  h.agregar(muestra(100, { A: 9 }));
  const lin = new Linaje();
  // sin linaje: raíces desde la historia
  let f = filasArbol(null, filasEspecies(h, null), new Set());
  assert.deepEqual(
    f.map((x) => [x.nombre, x.nivel, x.desde, x.hasta]),
    [
      ['A', 0, 0, null],
      ['B', 0, 0, 0],
    ],
  );
  // con madres: B deriva de A (autoespeciación de un .dbsim)
  lin.agregarOrigen([0, 0, 1, 0, -1, 1, 50, 7, 1, 0], ['A', 'B']);
  f = filasArbol(lin, filasEspecies(h, lin), new Set());
  assert.deepEqual(
    f.map((x) => [x.nombre, x.nivel, x.madre, x.hijas]),
    [
      ['A', 0, null, 1],
      ['B', 1, 'A', 0],
    ],
  );
  f = filasArbol(lin, filasEspecies(h, lin), new Set(['A']));
  assert.deepEqual(
    f.map((x) => [x.nombre, x.colapsada]),
    [['A', true]],
  );
});

test('filogenia: individuos podados como árbol (x = generación) y tope', () => {
  const lin = new Linaje();
  // 1 → 2 → (3 vivo, 4 vivo); 5 fundador vivo; 9 de otra especie
  lin.agregarLinaje(40, {
    filas: filasLin([
      [3, 2, 0, 2],
      [4, 2, 0, 2],
      [5, 0, 0, 0],
      [9, 0, 1, 0],
    ]),
    nacidos: filasLin([
      [1, 0, 0, 0],
      [2, 1, 0, 1],
    ]),
    nombres: ['A.txt', 'B.txt'],
  });
  const a = arbolIndividuos(lin, 'A');
  assert.equal(a.total, 5);
  assert.equal(a.mostrados, 5);
  assert.equal(a.filas, 3, 'hojas: 3, 4 y 5');
  const por = Object.fromEntries(a.nodos.map((n) => [n.abs, n]));
  assert.equal(por[2].y, (por[3].y + por[4].y) / 2, 'interno = media de sus hijos');
  assert.equal(por[1].parent, 0);
  assert.equal(por[3].vivo, true);
  assert.equal(por[1].vivo, false);
  const d = enlacesIndividuos(
    a.nodos,
    (g) => g * 10,
    (y) => y * 10,
  );
  assert.equal((d.match(/M/g) ?? []).length, 3, 'enlaces 1→2, 2→3, 2→4');
  // tope: los ancestros de los vivos de generación más alta
  const b = arbolIndividuos(lin, 'A', 3);
  assert.ok(b.mostrados <= 4 && b.mostrados >= 3, `${b.mostrados}`);
  assert.equal(b.total, 5);
  assert.equal(arbolIndividuos(lin, 'Nadie').nodos.length, 0);
});

test('genética: histograma de la historia, de una especie, mediana y mapa de calor', () => {
  const h = new Historia();
  const k = HISTOGRAMAS.length;
  /** @param {number} lo @param {number} hi @param {number[]} bins */
  const hist = (lo, hi, bins) => {
    const datos = [];
    for (let i = 0; i < k; i++) datos.push(lo + i, hi + i, ...bins);
    return { bins: bins.length, datos, n: new Array(k).fill(bins.reduce((s, x) => s + x, 0)) };
  };
  h.agregar(muestra(0, { A: 4 }, hist(0, 10, [1, 2, 1, 0])));
  h.agregar(muestra(100, { A: 4 }, hist(10, 30, [0, 1, 3, 4])));
  const u = /** @type {any} */ (ultimoHistograma(h, 'adn'));
  assert.deepEqual(u, { ciclo: 100, min: 10, max: 30, bins: [0, 1, 3, 4], n: 8 });
  assert.equal(/** @type {any} */ (ultimoHistograma(h, 'gen')).min, 11);
  assert.equal(ultimoHistograma(h, 'nada'), null);
  assert.equal(mediana({ ciclo: 0, min: 0, max: 4, bins: [1, 1, 1, 1], n: 4 }), 2);
  assert.equal(mediana({ ciclo: 0, min: 0, max: 4, bins: [0, 0, 0, 0], n: 0 }), null);
  const m = /** @type {any} */ (mapaCalor(h, 'adn', 3));
  assert.equal(m.min, 0);
  assert.equal(m.max, 30);
  assert.deepEqual(m.ciclos, [0, 100]);
  // cada columna suma 1 (fracción de bots)
  for (let c = 0; c < 2; c++) {
    let s = 0;
    for (let r = 0; r < 3; r++) s += m.celdas[c * 3 + r];
    assert.ok(Math.abs(s - 1) < 1e-6);
  }
  const capas = pathsMapa(m, 0, 100, 0, 30);
  assert.ok(capas.length >= 1 && capas.every((c) => c.op > 0 && c.op <= 1 && c.d));
  assert.equal(mapaCalor(new Historia(), 'adn'), null);

  const hd = histogramaDe([1, 2, 2, 3, 10], 3, 7);
  assert.deepEqual(hd, { ciclo: 7, min: 1, max: 10, bins: [4, 0, 1], n: 5 });
  assert.deepEqual(histogramaDe([], 2, 0).bins, [0, 0]);
  const lin = new Linaje();
  lin.agregarLinaje(40, {
    filas: filasLin([
      [3, 0, 0, 2],
      [4, 0, 0, 4],
      [5, 0, 1, 9],
      [6, 0, 0, 7, true],
    ]),
    nombres: ['A.txt', 'B.txt'],
  });
  const he = /** @type {any} */ (histogramaEspecie(lin, 'A', 'gen', 2));
  assert.equal(he.n, 2, 'solo los vivos de la especie');
  assert.deepEqual([he.min, he.max], [2, 4]);
  assert.equal(histogramaEspecie(lin, 'A', 'nrg'), null, 'nrg no sale del linaje');
});

test('ADN: palabras que cambian dentro de un gen y distancia al fundador', () => {
  const d = diffPalabras(
    'cond *.nrg 1500 > start 20 .shoot store stop',
    'cond *.nrg 1180 > start 20 .shoot store stop',
  );
  assert.deepEqual(
    d.a.filter((x) => x.cambio).map((x) => x.w),
    ['1500'],
  );
  assert.deepEqual(
    d.b.filter((x) => x.cambio).map((x) => x.w),
    ['1180'],
  );
  const a = 'cond start 1 .up store stop\ncond start 2 .dn store stop';
  const b = 'cond start 1 .up store stop\ncond start 3 .dn store stop\ncond start 9 .fx store stop';
  const g = diffGenes(a, b);
  assert.equal(distanciaDiff(diffGenes(a, a)), 0);
  const dist = distanciaDiff(g);
  // 12 + 18 palabras; cambian «2»→«3» (2) y el gen agregado entero (6)
  assert.equal(dist, 8 / 30);
  assert.equal(lcsLongitud([1, 2, 3, 4, 5], [1, 9, 3, 4, 7, 5]), 4);
  assert.equal(lcsLongitud([], [1]), 0);
  assert.equal(lcsLongitud('abcbdab', 'bdcaba'), 4);
});

test('eventos: filtros por tipo, orden por ciclo y cuentas', () => {
  const evs = [
    { ciclo: 500, tipo: 'extincion', params: { especie: 'A' } },
    { ciclo: 0, tipo: 'inicio', params: {} },
    { ciclo: 300, tipo: 'pico', params: { n: 40 } },
    { ciclo: 300, tipo: 'cambio', params: { cambios: {} } },
    { ciclo: 700, tipo: 'llegada', params: { especie: 'B' } },
    { ciclo: Number.NaN, tipo: 'raro' },
  ];
  assert.deepEqual(
    filtrarEventos(evs, 'todos').map((e) => e.tipo),
    ['inicio', 'pico', 'cambio', 'extincion', 'llegada'],
  );
  assert.deepEqual(
    filtrarEventos(evs, 'records').map((e) => e.ciclo),
    [300],
  );
  assert.equal(filtrarEventos(evs, 'todos')[1].i, 2, 'índice original (clave estable)');
  const c = cuentas(evs);
  assert.equal(c.todos, 5);
  assert.equal(c.especies, 1);
  assert.equal(c.siembras, 1);
  assert.equal(filtroDe('generacion'), 'records');
  assert.equal(filtroDe('otro'), 'todos');
});

test('fuente: guardada desde corridas-datos (sin cargar la sim) y actual', () => {
  const h = new Historia();
  h.agregar(muestra(0, { A: 5 }));
  h.agregar(muestra(100, { A: 6 }));
  h.evento({ ciclo: 100, tipo: 'pico', params: { n: 6 } });
  const lin = new Linaje();
  const corrida = {
    id: 'c-1',
    nombre: 'Prueba',
    semilla: 42,
    escenario: { especies: [{ bot: 'A', color: '#112233' }] },
    eventos: [{ ciclo: 50, tipo: 'siembra', especie: { nombre: 'S', color: '#445566' } }],
  };
  const f = fuenteGuardada({
    corrida,
    extra: { historia: h.serializar(), linaje: lin.serializar() },
  });
  assert.equal(f.tipo, 'guardada');
  assert.equal(f.id, 'c-1');
  assert.equal(f.semilla, 42);
  assert.deepEqual(f.historia.t, [0, 100]);
  assert.equal(f.historia.eventos.length, 1);
  assert.deepEqual(f.colores, { A: '#112233', S: '#445566' });
  assert.deepEqual(coloresDe(null), {});
  // vieja: historia en los metadatos, sin linaje
  const vieja = fuenteGuardada({ corrida: { nombre: 'V', historia: h.serializar() } });
  assert.equal(vieja.historia.puntos, 2);
  assert.equal(vieja.linaje.ciclo, -1);
  const vacia = fuenteGuardada({ corrida: {} });
  assert.equal(vacia.historia.puntos, 0);
  const a = fuenteActual({
    historia: h,
    linaje: lin,
    estado: { nombre: 'N', id: null, semilla: 1, escenario: null, colores: { A: '#fff' } },
  });
  assert.equal(a.tipo, 'actual');
  assert.equal(a.historia, h, 'la actual lee la historia viva');
});

test('I1: línea por especie con presencia 0–49, ausencia 50–99 y presencia 100–149: se corta', () => {
  const h = new Historia();
  for (let k = 0; k < 150; k++) {
    const presente = k < 50 || k >= 100;
    h.agregar(muestra(k * 100, presente ? { A: 5 + (k % 3), B: 2 } : { B: 2 }));
  }
  const s = serieAlineada(h, 'adnMedia', 'A');
  assert.equal(s.t.length, 150);
  assert.notEqual(s.t, h.t, 'copia del eje');
  for (let k = 0; k < 150; k++) {
    const presente = k < 50 || k >= 100;
    assert.equal(Number.isFinite(s.v[k]), presente, `punto ${k}`);
    assert.equal(s.n[k] > 0, presente, `n del punto ${k}`);
    assert.equal(Number.isFinite(s.min[k]), presente);
  }
  const [linea] = seriesDe(h, /** @type {any} */ (entrada('e:adnMedia')), {
    colores: {},
    nombreGlobal: '',
    otras: '',
    soloEspecie: 'A',
  });
  const g = geometria({ series: [linea], modo: 'lineas', ancho: 600, alto: 200 });
  const tramos = g.capas[0].d.split('M').filter(Boolean);
  assert.equal(tramos.length, 2, 'dos tramos: no une el hueco');
  // el primero termina en el ciclo 4900 y el segundo empieza en el 10000
  const xs = (/** @type {string} */ tr) => tr.split('L').map((p) => Number(p.split(' ')[0]));
  const X = /** @type {any} */ (g.X);
  assert.ok(Math.max(...xs(tramos[0])) <= X(4900) + 0.1);
  assert.ok(Math.min(...xs(tramos[1])) >= X(10000) - 0.1);
  // la sparkline hace lo mismo (se corta en la ausencia)
  const f = filasEspecies(h, null).find((x) => x.nombre === 'A');
  const d = sparkline(h.t, /** @type {any} */ (f).spark, 110, 22);
  assert.equal(d.split('M').filter(Boolean).length, 2);
});

test('I3: el tope de individuos se cumple dentro de las cadenas de ancestros («…»)', () => {
  const lin = new Linaje();
  // una cadena de 1.000 generaciones (1 → 2 → … → 1000, vivo el último) y
  // otra rama viva corta (2000, hija de 1)
  /** @type {[number, number, number, number][]} */
  const nacidos = [];
  for (let i = 1; i < 1000; i++) nacidos.push([i, i - 1, 0, i - 1]);
  lin.agregarLinaje(40, {
    filas: filasLin([
      [1000, 999, 0, 999],
      [2000, 1, 0, 1],
    ]),
    nacidos: filasLin(nacidos),
    nombres: ['A.txt'],
  });
  const a = arbolIndividuos(lin, 'A', 400);
  assert.equal(a.total, 1001);
  assert.ok(a.mostrados <= 400, `${a.mostrados} > 400`);
  assert.equal(a.mostrados, 400);
  const por = new Map(a.nodos.map((n) => [n.abs, n]));
  assert.ok(por.has(1000), 'el vivo de generación más alta');
  assert.ok(por.has(601) && !por.has(600), 'se recorta desde la raíz');
  assert.equal(por.get(601)?.cortado, true, 'el primer nodo de la cadena recortada lleva «…»');
  assert.equal(a.nodos.filter((n) => n.cortado).length, 1);
  assert.equal(por.get(1000)?.cortado, false);
  // con tope 1: solo el vivo
  assert.equal(arbolIndividuos(lin, 'A', 1).mostrados, 1);
  // sin llegar al tope: nadie cortado
  assert.equal(
    arbolIndividuos(lin, 'A', 5000).nodos.some((n) => n.cortado),
    false,
  );
});

test('M7: el árbol de individuos se recorre con el teclado', () => {
  const lin = new Linaje();
  lin.agregarLinaje(40, {
    filas: filasLin([
      [3, 2, 0, 2],
      [4, 2, 0, 2],
    ]),
    nacidos: filasLin([
      [1, 0, 0, 0],
      [2, 1, 0, 1],
    ]),
    nombres: ['A.txt'],
  });
  const { nodos } = arbolIndividuos(lin, 'A');
  assert.equal(vecinoIndividuo(nodos, 3, 'ArrowLeft'), 2, 'izquierda = madre');
  assert.equal(vecinoIndividuo(nodos, 2, 'ArrowLeft'), 1);
  assert.equal(vecinoIndividuo(nodos, 1, 'ArrowLeft'), null, 'la raíz no tiene madre');
  assert.equal(vecinoIndividuo(nodos, 1, 'ArrowRight'), 2, 'derecha = primer hijo');
  assert.equal(vecinoIndividuo(nodos, 3, 'ArrowRight'), null);
  const orden = [...nodos].sort((a, b) => a.y - b.y || a.gen - b.gen).map((n) => n.abs);
  assert.equal(vecinoIndividuo(nodos, orden[0], 'ArrowDown'), orden[1]);
  assert.equal(vecinoIndividuo(nodos, orden[1], 'ArrowUp'), orden[0]);
  assert.equal(vecinoIndividuo(nodos, orden[0], 'ArrowUp'), null);
  assert.equal(vecinoIndividuo(nodos, orden[2], 'Home'), orden[0]);
  assert.equal(vecinoIndividuo(nodos, orden[0], 'End'), orden.at(-1));
  assert.equal(vecinoIndividuo(nodos, 3, 'Enter'), null);
});

/**
 * ADN sintético de `genes` genes de `palabras` palabras cada uno.
 * @param {number} genes @param {number} palabras @param {(g: number, w: number) => string} f
 */
function adnSintetico(genes, palabras, f) {
  const out = [];
  for (let g = 0; g < genes; g++) {
    const ws = ['cond'];
    for (let w = 0; w < palabras - 3; w++) ws.push(f(g, w));
    ws.push('start', 'stop');
    out.push(ws.join(' '));
  }
  return out.join('\n');
}

/**
 * Celdas de Int32Array que reserva `fn` (genetica.js y lineage.js las toman
 * del global al llamarse: se cuentan con una subclase mientras corre).
 * @param {() => unknown} fn
 */
function celdasReservadas(fn) {
  const Original = globalThis.Int32Array;
  let n = 0;
  class Contada extends Original {
    /** @param {any[]} args */
    constructor(...args) {
      // @ts-expect-error: los mismos argumentos que Int32Array
      super(...args);
      n += this.length;
    }
  }
  globalThis.Int32Array = /** @type {any} */ (Contada);
  try {
    fn();
  } finally {
    globalThis.Int32Array = Original;
  }
  return n;
}

// Tope holgado: con la suite en paralelo la comparación tarda 60–90 ms (sola,
// unos 20); la versión vieja, con la matriz n×m, tardaba 323 ms sola.
test('I4: comparación de ADN de 7.200 palabras en menos de 250 ms y memorizada por hashes', () => {
  // 600 genes × 12 palabras; el dominante cambia una palabra cada 5 genes,
  // borra el gen 11 y agrega uno al final
  const palabra = (/** @type {number} */ g, /** @type {number} */ w) =>
    w % 3 === 0 ? String(g * 13 + w) : w % 3 === 1 ? '.up' : 'store';
  const a = adnSintetico(600, 12, palabra);
  const genesB = adnSintetico(600, 12, (g, w) =>
    g % 5 === 0 && w === 4 ? '777' : palabra(g, w),
  ).split('\n');
  genesB.splice(10, 1);
  genesB.push('cond 1 2 3 start .dn store stop');
  const b = genesB.join('\n');
  assert.equal(a.split(/\s+/).length, 7200);
  compararFotos({ adn: 'cond start stop' }, { adn: 'cond start stop' }); // calentar
  const t0 = performance.now();
  const r = compararFotos({ adn: a }, { adn: b });
  const ms = performance.now() - t0;
  console.log(`# comparación de 7.200 palabras: ${ms.toFixed(1)} ms`);
  assert.ok(ms < 250, `${ms.toFixed(1)} ms`);
  assert.ok(r.distancia > 0 && r.distancia < 0.2, `${r.distancia}`);
  assert.equal(r.d.quitados, 1);
  assert.ok(r.cambios.length <= 30 && r.resto > 0);

  // un solo gen enorme (7.200 palabras) con cambios salteados: Myers, sin matriz
  const g1 = Array.from({ length: 7200 }, (_, i) => `w${i % 97}`);
  const g2 = g1.map((w, i) => (i % 700 === 350 ? 'X' : w));
  const t1 = performance.now();
  const l = lcsLongitud(g1, g2);
  const ms2 = performance.now() - t1;
  assert.equal(l, 7200 - 10, '10 palabras cambiadas');
  assert.ok(ms2 < 250, `LCS de un gen de 7.200 palabras: ${ms2.toFixed(1)} ms`);
  const t2 = performance.now();
  const r2 = compararFotos(
    { adn: `cond ${g1.join(' ')} start stop` },
    { adn: `cond ${g2.join(' ')} start stop` },
  );
  assert.equal(r2.d.cambiados, 1, 'un gen modificado');
  const ms3 = performance.now() - t2;
  assert.ok(ms3 < 250, `un gen enorme modificado: ${ms3.toFixed(1)} ms`);
  assert.ok(r2.distancia > 0 && r2.distancia < 0.01, `${r2.distancia}`);

  // Guardas deterministas (los tiempos de arriba son topes holgados: con la
  // suite en paralelo no sirven como medida relativa).
  // 1) Celdas de Int32Array reservadas por la comparación: la matriz de genes
  //    (601 × 601, por diseño) y las chicas por gen; nunca palabras × palabras
  //    (7.200² ≈ 52 millones).
  const celdas = celdasReservadas(() => compararFotos({ adn: a }, { adn: b }));
  assert.ok(celdas < 2 * 601 * 601, `${celdas} celdas reservadas (ADN de 600 genes)`);
  const celdas2 = celdasReservadas(() =>
    compararFotos(
      { adn: `cond ${g1.join(' ')} start stop` },
      { adn: `cond ${g2.join(' ')} start stop` },
    ),
  );
  assert.ok(celdas2 < 7200 * 4, `${celdas2} celdas reservadas (un gen de 7.200 palabras)`);
  // 2) Lecturas de palabras de lcsLongitud: con los mismos 10 cambios, el
  //    doble de palabras lee el doble (Myers, O((n + m)·D)); una matriz leería ×4.
  const lecturas = (/** @type {number} */ n) => {
    const x = Array.from({ length: n }, (_, i) => `w${i % 97}`);
    const y = x.map((w, i) => (i % (n / 10) === n / 20 ? 'X' : w));
    let k = 0;
    /** @param {string[]} arr */
    const contar = (arr) =>
      new Proxy(arr, {
        get(o, p) {
          if (typeof p === 'string' && /^\d+$/.test(p)) k++;
          return Reflect.get(o, p);
        },
      });
    assert.equal(lcsLongitud(contar(x), contar(y)), n - 10);
    return k;
  };
  const razon = lecturas(7200) / lecturas(3600);
  assert.ok(razon < 2.5, `razón de lecturas 7.200/3.600 palabras: ${razon.toFixed(2)}`);

  // memoria por par de hashes: la segunda vez es la misma respuesta
  const comparar = memoComparaciones(2);
  const fa = { hash: 1, ciclo: 0, adn: a };
  const fb = { hash: 2, ciclo: 1000, adn: b };
  const x = comparar(fa, fb);
  assert.equal(comparar({ ...fa }, { ...fb }), x, 'mismo par de hashes: no recalcula');
  assert.notEqual(comparar(fa, { ...fb, hash: 3 }), x);
  comparar(fa, { ...fb, hash: 4 });
  assert.equal(comparar.cuantas(), 2, 'tope de la memoria');
});

test('O5: numeración de genes consistente (la del dominante; los borrados, la del fundador)', () => {
  const a = 'cond start 1 .a store stop\ncond start 2 .b store stop\ncond start 3 .c store stop';
  const b = 'cond start 1 .a store stop\ncond start 3 .c store stop\ncond start 4 .d store stop';
  const r = compararFotos({ adn: a }, { adn: b });
  assert.deepEqual(
    r.celdas.map((c) => [c.tipo, c.n, c.fundador]),
    [
      ['igual', 1, false],
      ['quitado', 2, true],
      ['igual', 2, false],
      ['agregado', 3, false],
    ],
  );
  // la lista de cambios usa el mismo número que la celda
  for (const c of r.cambios) {
    const celda = r.celdas.find((x) => x.k === c.k);
    assert.equal(c.n, celda?.n);
    assert.equal(c.fundador, celda?.fundador);
  }
  assert.deepEqual(numeroGen({ tipo: 'cambiado', a: 4, b: 6 }), { n: 7, fundador: false });
});

test('M4: el mapa de calor ubica cada columna por su ciclo', () => {
  const m = {
    ciclos: [0, 100, 1000],
    filas: 1,
    celdas: new Float32Array([1, 1, 1]),
    maxFrac: 1,
  };
  assert.equal(finMapa(m.ciclos, 2000), 2000);
  assert.equal(finMapa(m.ciclos, 1000), 1500, 'sin ciclos después: la separación media');
  const [capa] = pathsMapa(m, 0, 200, 0, 10, 1, 2000);
  const xs = [...capa.d.matchAll(/M([\d.]+) /g)].map((x) => Number(x[1]));
  assert.deepEqual(xs, [0, 10, 100], 'x = X(ciclo), no columnas parejas');
});

test('M5: la clave de un evento no cambia cuando se descartan los viejos', () => {
  const evs = [
    { ciclo: 100, tipo: 'pico' },
    { ciclo: 200, tipo: 'extincion' },
    { ciclo: 300, tipo: 'llegada' },
  ];
  const antes = filtrarEventos(evs, 'todos', 0);
  // se descarta el primero (tope de bytes de la historia)
  const despues = filtrarEventos(evs.slice(1), 'todos', 1);
  assert.equal(antes[2].i, despues[1].i);
  assert.equal(antes[1].i, despues[0].i);
});

test('Hallazgos: detectores sobre la historia, frase del informe en es/en y plazo en vivo', () => {
  const h = new Historia();
  // A domina (más del 50 %) durante 10.000 ciclos con B presente
  for (let k = 0; k <= 100; k++) h.agregar(muestra(k * 100, { A: 30, B: 5 }));
  const hs = hallazgosDe(h);
  const dom = hs.find((x) => x.tipo === 'dominio');
  assert.ok(dom, JSON.stringify(hs));
  const es = textoHallazgo(dom, 'es');
  const en = textoHallazgo(dom, 'en');
  assert.match(es, /^A superó/);
  assert.ok(en.startsWith('A ') && en !== es);
  assert.equal(textoHallazgo({ ...dom, clave: 'nada' }, 'es'), '', 'sin texto: vacío, sin romper');
  assert.equal(claveHallazgo(dom), claveHallazgo({ ...dom }), 'clave estable');
  assert.deepEqual(hallazgosDe(new Historia()), [], 'sin datos: ninguno');
  // plazo: otra corrida → ya; guardada → una sola vez; vivo → cada tanto
  const u = { id: 'x', en: 1000 };
  assert.equal(esperaHallazgos(u, 'y', true, 1001), 0);
  assert.equal(esperaHallazgos(u, 'x', false, 1e9), Number.POSITIVE_INFINITY);
  assert.equal(esperaHallazgos(u, 'x', true, 1000 + REFRESCO_HALLAZGOS_MS), 0);
  assert.equal(esperaHallazgos(u, 'x', true, 2000), REFRESCO_HALLAZGOS_MS - 1000);
});

test('claves nuevas de la revisión (aria, hallazgos, filogenia, genética) en es y en', () => {
  const claves = [
    'analizar.grafico.aria',
    'analizar.grafico.ariaSerie',
    'analizar.grafico.ariaTotal',
    'analizar.grafico.ariaVacio',
    'analizar.hallazgos.titulo',
    'analizar.hallazgos.sub',
    'analizar.hallazgos.ninguno',
    'analizar.hallazgos.marcar',
    'analizar.hallazgos.marcarAria',
    ...['dominio', 'colapso', 'extincion', 'adn'].map((x) => `analizar.hallazgos.tipo.${x}`),
    'analizar.filo.botNodo',
    'analizar.filo.cortadas',
    'analizar.gen.genFundador',
  ];
  const params = (/** @type {string} */ s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();
  for (const k of claves) {
    assert.ok(Object.hasOwn(ES, k) && Object.hasOwn(EN, k), k);
    assert.deepEqual(params(ES[k]), params(EN[k]), `parámetros de ${k}`);
  }
  for (const k of ['aria', 'ariaSerie', 'ariaTotal'])
    for (const x of ['ultimo', 'min', 'max'])
      assert.ok(ES[`analizar.grafico.${k}`].includes(`{${x}}`), `${k}: {${x}}`);
});
