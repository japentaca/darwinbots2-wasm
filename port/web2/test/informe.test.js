// @ts-check
// Informes (engine/report/, decisión 11): el .html es válido en lo básico y
// autocontenido, las figuras respetan su tamaño, los nombres se escapan
// (XSS), el resumen solo escribe lo que encuentran los detectores y enlaza
// cada frase a su figura, los textos existen en es y en, y una corrida
// sintética de 50.000 ciclos genera el informe (se mide su tamaño).
//
// INFORME_EJEMPLO=<ruta> guarda el informe de 50.000 ciclos en esa ruta.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  agruparHallazgos,
  CLAVES_AGRUPADAS,
  CLAVES_HALLAZGO,
  detectar,
} from '../engine/detectors.js';
import { Historia } from '../engine/history.js';
import { Linaje } from '../engine/lineage.js';
import { asignarColores, PALETA } from '../engine/report/corrida.js';
import { generarInforme, informeCorrida } from '../engine/report/index.js';
import { esc, pasoLindo, reducir } from '../engine/report/svg.js';
import { CODIGOS_ERROR, parametrosDe, TEXTOS, traductor } from '../engine/report/textos.js';
import { ciclos, historiaDe } from './util/historia-sintetica.js';
import { figurasEnTamaño, validar } from './util/validar-informe.js';

/** @param {any} d @param {'es' | 'en'} idioma */
const informe = (d, idioma) => informeCorrida(d, { idioma });

/** @param {number} n @param {(i: number) => number | null} f */
const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/** Corrida chica con de todo un poco. */
function corridaChica() {
  const n = 300;
  const t = ciclos(n);
  const historia = historiaDe({
    t,
    especies: {
      'Animal Minimalis 4G': serie(n, (i) => 20 + i / 3),
      Yojimbo: serie(n, (i) => (i < 150 ? 40 - i / 5 : null)),
      'Alga Minimalis 3.0': serie(n, () => 50),
    },
    vegetales: ['Alga Minimalis 3.0'],
    adn: serie(n, (i) => 200 + i / 2),
    comportamiento: true,
    bins: 16,
  });
  historia.evento({ ciclo: 0, tipo: 'inicio', params: { nombre: 'Sopa', semilla: 1234 } });
  historia.evento({ ciclo: 15000, tipo: 'extincion', params: { especie: 'Yojimbo' } });
  historia.evento({ ciclo: 9000, tipo: 'cambio', params: { cambios: { 'opt:11': 1 } } });
  return {
    historia,
    semilla: 1234,
    fecha: '2026-09-29T12:00:00Z',
    escenario: {
      nombre: { es: 'Sopa F1 con Zebedee', en: 'F1 soup with Zebedee' },
      opciones: { base: 'f1', cambios: { 'base:minVegs': 30 } },
      especies: [
        { bot: 'Animal Minimalis 4G.txt', cantidad: 10, color: '#2a78d6', vegetal: false },
        { bot: 'Yojimbo', cantidad: 10, color: '#e87ba4', vegetal: false },
        { bot: 'Alga Minimalis 3.0', cantidad: 30, color: '#1baf7a', vegetal: true },
      ],
    },
    cambios: [
      { ciclo: 9000, tipo: 'opciones', cambios: { 'opt:11': 1 } },
      {
        ciclo: 12000,
        tipo: 'siembra',
        especie: {
          nombre: 'Yojimbo',
          adn: 'x',
          cantidad: 5,
          color: '#e87ba4',
          vegetal: false,
          energia: 3000,
        },
      },
    ],
  };
}

test('corrida: html válido y autocontenido, en es y en en', () => {
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const r = informe(corridaChica(), idioma);
    const datos = validar(r.html);
    assert.equal(datos.tipo, 'corrida');
    assert.equal(datos.idioma, idioma);
    assert.equal(datos.semilla, 1234);
    assert.ok(datos.series.length > 5);
    assert.ok(datos.t.length === 300);
    assert.match(r.archivo, /^informe_[a-z0-9-]+_2026-09-29\.html$/);
    assert.match(r.html, new RegExp(`<html lang="${idioma}">`));
    assert.match(r.html, /@media print/);
    assert.match(r.html, /@page\{size:A4/);
    assert.match(r.html, /IBM Plex Sans', system-ui, sans-serif/);
    // secciones de la plantilla
    for (const id of [
      'fig-especies',
      'fig-total',
      'fig-adn',
      'fig-gen',
      'fig-histogramas',
      'fig-nacimientos',
      'fig-disparos',
      'fig-energia',
      'fig-luz',
      'fig-genealogia',
    ])
      assert.match(r.html, new RegExp(`id="${id}"`), id);
    assert.equal((r.html.match(/<h3>/g) ?? []).length >= 6, true, 'los seis grupos');
  }
});

test('corrida: el resumen escribe una frase por hallazgo (agrupados), enlazada a su figura', () => {
  const d = corridaChica();
  const hallazgos = agruparHallazgos(detectar(d.historia));
  assert.ok(hallazgos.length >= 2);
  const r = informe(d, 'es');
  const frases = [...r.html.matchAll(/<p class="find">([\s\S]*?)<\/p>/g)];
  assert.equal(frases.length, hallazgos.length);
  hallazgos.forEach((x, i) => {
    assert.match(frases[i][1], new RegExp(`href="#${x.figura}"`));
  });
  assert.match(r.html, /Yojimbo se extinguió en el ciclo 15\.000/);
  const en = informe(d, 'en');
  assert.match(en.html, /Yojimbo went extinct at cycle 15,000/);
});

test('corrida: cifras y tabla de especies (final, pico, gen. máx., estado)', () => {
  const r = informe(corridaChica(), 'es');
  const texto = r.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(texto, /30 generación máxima/, 'genMax global = ciclo/1000 (29,9)');
  assert.match(texto, / 0 0,25 0,5 0,75 1 /, 'ticks de la luz');
  assert.match(texto, /2 de 3 especies vivas/);
  // Yojimbo: 40 − i/5 hasta la muestra 149; pico 40, gen. máx. 14, extinta en 15.000
  assert.match(texto, /Yojimbo 0 40 14 \d+ extinta · 15\.000/);
  assert.match(texto, /Alga Minimalis 3\.0 · vegetal 50 50 29 \d+ viva/);
});

test('corrida: si ningún detector encuentra nada, el resumen no escribe', () => {
  const n = 100;
  const historia = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 30), B: serie(n, () => 30) },
    adn: serie(n, () => 150),
  });
  assert.deepEqual(detectar(historia), []);
  const r = informe({ historia, fecha: 0 }, 'es');
  validar(r.html);
  assert.doesNotMatch(r.html, /class="resumen"/);
  assert.doesNotMatch(r.html, /class="find"/);
  assert.doesNotMatch(r.html, /class="rotulo"/, 'sin marcas en los gráficos');
});

test('corrida: historia vacía y de una muestra generan un informe válido', () => {
  for (const historia of [new Historia(), historiaDe({ t: [0], especies: { A: [3] } })]) {
    const r = informe({ historia, fecha: 0 }, 'en');
    validar(r.html);
    figurasEnTamaño(r.html);
  }
});

test('las figuras respetan el tamaño pedido', () => {
  const r = informe(corridaChica(), 'es');
  const n = figurasEnTamaño(r.html);
  assert.ok(n >= 12, `${n} svg`);
});

test('escape de nombres (XSS): <, &, comillas en bots, escenario y eventos', () => {
  const malo = `<script>alert("x")</script> & 'q' </script><img src=x onerror=alert(1)>`;
  const n = 120;
  const historia = historiaDe({
    t: ciclos(n),
    especies: { [malo]: serie(n, (i) => (i < 60 ? 50 : null)), B: serie(n, () => 10) },
  });
  historia.evento({ ciclo: 100, tipo: 'sembrado', params: { especie: malo, n: 3 } });
  const r = informe(
    {
      historia,
      fecha: 0,
      escenario: {
        nombre: malo,
        opciones: { base: 'clasica', cambios: {} },
        especies: [{ bot: malo, cantidad: 1, color: '#123456" onload="x', vegetal: false }],
      },
    },
    'es',
  );
  assert.doesNotMatch(r.html, /<script>alert/);
  assert.doesNotMatch(r.html, /<img/);
  assert.doesNotMatch(r.html, /onload="x/);
  assert.match(r.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;q&#39;/);
  const datos = validar(r.html);
  assert.equal(datos.titulo, malo, 'el JSON embebido devuelve el nombre intacto');
  assert.ok(datos.series.some((/** @type {any} */ s) => s.especie === malo));
  assert.equal(esc(`a<b>&"'`), 'a&lt;b&gt;&amp;&quot;&#39;');
});

test('textos: mismas claves y parámetros en es y en, sin «original», con texto para cada hallazgo', () => {
  const es = TEXTOS.es;
  const en = TEXTOS.en;
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  for (const k of Object.keys(es)) {
    assert.deepEqual(parametrosDe(en[k]), parametrosDe(es[k]), k);
    for (const s of [es[k], en[k]]) {
      assert.ok(s.trim(), `${k} vacío`);
      assert.doesNotMatch(s, /\boriginal\b|\bVB6\b|visual\s*basic/i, k);
    }
  }
  for (const c of [...CLAVES_HALLAZGO, ...CLAVES_AGRUPADAS]) assert.ok(`hallazgo.${c}` in es, c);
  // plurales
  const t = traductor('es').tx;
  assert.equal(t('hist.adn', { n: 1 }), 'Longitud del ADN (1 bot)');
  assert.equal(t('hist.adn', { n: 1500 }), 'Longitud del ADN (1.500 bots)');
  assert.equal(t('conf.cambios', { n: 1 }), '1 parámetro cambiado sobre la base.');
  assert.equal(t('conf.cambios', { n: 3 }), '3 parámetros cambiados sobre la base.');
  assert.match(t('fig.especies', { n: 1 }), /\(la principal\)/);
  assert.match(t('fig.especies', { n: 4 }), /\(las 4 principales\)/);
  assert.equal(traductor('en').tx('evento.pico', { n: 1 }), 'Population peak: 1 bot');
  assert.equal(
    traductor('en').tx('evento.pico', { n: 1000000 }),
    'Population peak: 1,000,000 bots',
  );
  assert.equal(t('evento.pico', { n: 1000000 }), 'Pico de población: 1.000.000 bots');
  assert.deepEqual(parametrosDe('{n} {n#bot|bots} {x#a|b {y}}'), ['n', 'x', 'y']);
  assert.throws(() => traductor('es').tx('no.existe'), { codigo: 'texto' });
  const { tx } = traductor('en');
  assert.equal(tx('kpi.pico', { ciclo: 48210 }), 'peak · cycle 48,210');
  assert.equal(traductor('es').tx('kpi.pico', { ciclo: 48210 }), 'pico · ciclo 48.210');
});

test('generarInforme: tipo desconocido y la Corrida por su tipo', () => {
  assert.throws(() => generarInforme(/** @type {any} */ ('otro'), {}), { codigo: 'tipo' });
  assert.throws(() => generarInforme('corrida', {}), { codigo: 'falta-historia' });
  const r = generarInforme('corrida', corridaChica(), { idioma: 'en' });
  validar(r.html);
});

test('svg: pasoLindo y reducir', () => {
  assert.equal(pasoLindo(100, 4), 25);
  assert.equal(pasoLindo(48210, 5), 10000);
  assert.equal(pasoLindo(0, 4), 1);
  const x = serie(1000, (i) => i);
  const y = serie(1000, (i) => (i < 500 ? 1 : Number.NaN));
  const r = reducir(/** @type {number[]} */ (x), [/** @type {number[]} */ (y)], 100);
  assert.equal(r.x.length, 100);
  assert.equal(r.ys[0][0], 1);
  assert.ok(Number.isNaN(r.ys[0][99]), 'una columna sin valores queda en NaN');
  const chico = reducir([1, 2], [[3, 4]], 100);
  assert.deepEqual(chico, { x: [1, 2], ys: [[3, 4]] });
});

test('extremo a extremo: 50.000 ciclos, 20 especies, los seis grupos y linaje', () => {
  const n = 501; // ciclos 0..50.000, una muestra cada 100
  const t = ciclos(n);
  /** @type {Record<string, (number | null)[]>} */
  const especies = {};
  for (let k = 0; k < 20; k++) {
    const nombre =
      k === 0 ? 'Alga Minimalis 3.0' : k < 10 ? `(${5000 + k})Zebedee V2.1` : `Bot ${k}`;
    const muere = k % 4 === 3 ? 100 + k * 15 : n;
    const nace = k >= 15 ? 50 * (k - 14) : 0;
    especies[nombre] = serie(n, (i) =>
      i < nace || i >= muere
        ? null
        : Math.round(10 + 8 * Math.sin(i / (20 + k)) + (k === 1 ? i / 5 : 0)),
    );
  }
  const historia = historiaDe({
    t,
    especies,
    vegetales: ['Alga Minimalis 3.0'],
    adn: serie(n, (i) => 180 + i / 6 + Math.sin(i / 7) * 3),
    comportamiento: true,
    bins: 32,
  });
  for (let c = 0; c <= 50000; c += 2500)
    historia.evento({ ciclo: c, tipo: 'pico', params: { n: 100 + c / 100 } });
  const linaje = new Linaje();
  const nombres = Object.keys(especies);
  for (const [k, nombre] of nombres.entries())
    linaje.especies.set(nombre, {
      nombre,
      ciclo: k >= 15 ? 5000 * (k - 14) : 0,
      primerAbs: k + 1,
      madreAbs: 0,
      madre: k >= 2 && k < 10 ? nombres[1] : null,
    });
  const adn = (/** @type {number} */ genes) =>
    Array.from({ length: genes }, (_, g) => `cond *.nrg ${g} > start ${g} .up store stop`).join(
      '\n',
    );
  linaje.fotos.set(nombres[1], [
    { ciclo: 0, hash: 1, copias: 10, adnLen: 120, abs: 2, adn: adn(12) },
    {
      ciclo: 40000,
      hash: 2,
      copias: 30,
      adnLen: 150,
      abs: 900,
      adn: `${adn(13)}\ncond 1 1 = start .x inc stop`,
    },
  ]);
  const cambios = [{ ciclo: 20000, tipo: 'opciones', cambios: { 'opt:11': 1 } }];
  const t0 = performance.now();
  const r = informe(
    {
      historia,
      linaje,
      semilla: 424242,
      fecha: '2026-09-29T00:00:00Z',
      cambios,
      escenario: {
        nombre: { es: 'Sopa de 50.000 ciclos', en: '50,000-cycle soup' },
        opciones: { base: 'f1', cambios: { 'base:minVegs': 30 } },
        especies: [{ bot: 'Alga Minimalis 3.0', cantidad: 30, color: '#1baf7a', vegetal: true }],
      },
    },
    'es',
  );
  const ms = performance.now() - t0;
  const datos = validar(r.html);
  figurasEnTamaño(r.html);
  const bytes = Buffer.byteLength(r.html, 'utf8');
  console.log(
    `informe 50.000 ciclos: ${(bytes / 1024).toFixed(0)} KiB, ${datos.series.length} series embebidas, ` +
      `${(ms).toFixed(0)} ms, hallazgos: ${datos.hallazgos.map((/** @type {any} */ x) => x.clave).join(', ')}`,
  );
  assert.ok(bytes < 3 * 1024 * 1024, 'el informe pesa menos de 3 MB');
  assert.equal(datos.ciclos.hasta, 50000);
  assert.ok(datos.hallazgos.length > 0);
  assert.match(r.html, /id="fig-genealogia"/);
  assert.match(r.html, /ADN dominante frente al fundador/);
  const destino = process.env.INFORME_EJEMPLO;
  if (destino) writeFileSync(destino, r.html);
});

test('colores: la paleta va primero a las especies principales, sin repetir ni pisar los del escenario', () => {
  const porPeso = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
  const sembradas = [
    { bot: 'P3.txt', color: PALETA[0].toUpperCase() },
    { bot: 'P8', color: PALETA[1] },
    { bot: 'P5', color: PALETA[0] }, // repetido: P3 (más pesada) se lo queda
    { bot: 'Nunca', color: '#123456' },
  ];
  const c = asignarColores(porPeso, sembradas);
  const principales = porPeso.slice(0, 6).map((n) => c.get(n));
  assert.equal(new Set(principales).size, 6, 'seis capas, seis colores');
  assert.equal(c.get('P3'), PALETA[0]);
  assert.ok(!principales.includes(PALETA[1]), 'el color de P8 (del escenario) no lo toma otra');
  assert.equal(c.get('P8'), PALETA[1], 'P8 no es principal pero conserva su color');
  assert.notEqual(c.get('P5'), PALETA[0]);
  assert.equal(c.get('P1'), PALETA[2], 'la paleta sin los colores del escenario, en orden de peso');
  assert.equal(c.get('Nunca'), '#123456');
  // con todos los colores tomados, siguen sin repetirse
  const muchas = Array.from({ length: 30 }, (_, i) => `E${i}`);
  const todas = [...PALETA, '#7b5cc4', '#c23b3b', '#3a9fbf', '#8a6a2e', '#5b6f7a', '#a3a300'].map(
    (color, i) => ({ bot: `E${i + 10}`, color }),
  );
  const c2 = asignarColores(muchas, todas, 8);
  const capas = muchas.slice(0, 8).map((n) => c2.get(n));
  assert.equal(new Set([...capas, ...todas.map((x) => x.color)]).size, 8 + todas.length);
  for (const x of capas) assert.match(String(x), /^#[0-9a-f]{6}$/);
});

test('colores: el color de una especie es el mismo en todas las figuras y tablas', () => {
  const n = 120;
  /** @type {Record<string, (number | null)[]>} */
  const especies = {};
  // la de más bots aparece última: igual recibe el primer color libre
  for (let k = 0; k < 9; k++) especies[`S${k}`] = serie(n, () => 5 + k * 3);
  const historia = historiaDe({ t: ciclos(n), especies });
  const r = informe({ historia, fecha: 0 }, 'es');
  validar(r.html);
  const fig = r.html.match(/<figure id="fig-especies">([\s\S]*?)<\/figure>/)?.[1] ?? '';
  const ley = [...fig.matchAll(/background:(#[0-9a-f]{6})"><\/span>([^<]+)</g)].map((m) => [
    m[2],
    m[1],
  ]);
  assert.equal(ley.length, 7, 'seis capas y «otras»');
  assert.equal(new Set(ley.map((x) => x[1])).size, 7);
  assert.deepEqual(ley[0], ['S8', PALETA[0]]);
  // la fila de la tabla de especies usa el mismo color
  for (const [nombre, color] of ley.slice(0, 6))
    assert.match(r.html, new RegExp(`background:${color}"></span>${nombre}<`));
});

test('portada: cuenta los cambios del escenario y aparte los cambios en caliente', () => {
  const r = informe(corridaChica(), 'es');
  const meta = r.html.match(/<div class="meta">([^<]*)<\/div>/)?.[1] ?? '';
  assert.match(meta, /base Liga F1 \+ 1 cambio · 2 cambios en caliente/);
  assert.match(r.html, /1 parámetro cambiado sobre la base\./);
  const en = informe({ ...corridaChica(), cambios: [] }, 'en').html;
  const metaEn = en.match(/<div class="meta">([^<]*)<\/div>/)?.[1] ?? '';
  assert.match(metaEn, /F1 league base \+ 1 change/);
  assert.doesNotMatch(metaEn, /live change/);
});

test('css: una columna solo en pantalla; impresión en A4 sin cortar figuras ni tablas', () => {
  const r = informe(corridaChica(), 'es');
  const css = r.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  assert.match(
    css,
    /@media screen and \(max-width:840px\)\{[^}]*\}[^@]*\.dos\{grid-template-columns:1fr\}/,
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width/,
    'ninguna media query de ancho alcanza a la impresión',
  );
  assert.match(css, /@media screen\{\[id\]\{scroll-margin-top:\d+px\}\}/);
  const print = css.slice(css.indexOf('@media print'));
  assert.match(print, /figure,figure svg,[^{]*\.tbl tr[^{]*\{break-inside:avoid/);
  assert.match(print, /\.tbl thead\{display:table-header-group\}/);
  assert.match(print, /\.dos\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /@page\{size:A4;margin:14mm 12mm\}/);
});

test('eventos: un vegetal que se queda sin bots y se repone no «se extingue»', () => {
  const n = 120;
  const historia = historiaDe({
    t: ciclos(n),
    especies: {
      Alga: serie(n, (i) => (i >= 40 && i < 50 ? null : 60)),
      Viajero: serie(n, (i) => (i >= 30 && i < 60 ? null : 12)),
      Muerto: serie(n, (i) => (i < 80 ? 15 : null)),
    },
    vegetales: ['Alga'],
  });
  historia.evento({ ciclo: 4000, tipo: 'extincion', params: { especie: 'Alga' } });
  historia.evento({ ciclo: 3000, tipo: 'extincion', params: { especie: 'Viajero' } });
  historia.evento({ ciclo: 8000, tipo: 'extincion', params: { especie: 'Muerto' } });
  const r = informe({ historia, fecha: 0 }, 'es');
  const texto = r.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.doesNotMatch(texto, /Alga se extinguió/);
  assert.match(texto, /Sin bots Alga se quedó sin bots \(vegetal: se repone\)/);
  assert.match(texto, /Viajero se quedó sin bots y después volvió/);
  assert.match(texto, /Extinción Muerto se extinguió/);
  assert.match(texto, /Alga · vegetal 60 60 \d+ \d+ viva/, 'coherente con la tabla de Especies');
});

test('genealogía: una especie del linaje sin ciclo no deja NaN', () => {
  const n = 60;
  const historia = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 20), B: serie(n, (i) => (i < 10 ? null : 8)) },
  });
  const linaje = new Linaje();
  linaje.especies.set('A', { nombre: 'A', ciclo: 0, primerAbs: 1, madreAbs: 0, madre: null });
  linaje.especies.set(
    'B',
    /** @type {any} */ ({ nombre: 'B', primerAbs: 2, madreAbs: 1, madre: 'A' }),
  );
  linaje.especies.set(
    'C',
    /** @type {any} */ ({ nombre: 'C', primerAbs: 3, madreAbs: 1, madre: 'A' }),
  );
  const r = informe({ historia, linaje, fecha: 0 }, 'es');
  const datos = validar(r.html);
  assert.doesNotMatch(r.html, /NaN/);
  figurasEnTamaño(r.html);
  const b = datos.especies.find((/** @type {any} */ e) => e.nombre === 'B');
  assert.equal(b.desde, 1000, 'sin ciclo en el linaje: el primero con bots');
  const c = datos.especies.find((/** @type {any} */ e) => e.nombre === 'C');
  assert.equal(c.desde, 0);
});

test('resumen: extinciones simultáneas en una frase enlazada a la figura', () => {
  const n = 200;
  /** @type {Record<string, (number | null)[]>} */
  const especies = { Alga: serie(n, () => 300) };
  for (let k = 1; k <= 12; k++) especies[`Bot ${k}`] = serie(n, (i) => (i < 100 ? 5 + k : null));
  const historia = historiaDe({ t: ciclos(n), especies, vegetales: ['Alga'] });
  const r = informe({ historia, fecha: 0 }, 'es');
  const frases = [...r.html.matchAll(/<p class="find">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  const ext = frases.filter((f) => /extingui/.test(f));
  assert.equal(ext.length, 1);
  assert.match(
    ext[0],
    /12 especies se extinguieron en el ciclo 10\.000: Bot 12, Bot 11, Bot 10, …/,
  );
  assert.match(ext[0], /href="#fig-especies"/);
  assert.match(r.html, /12 extinciones/, 'la marca en el gráfico');
  const texto = r.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(texto, / 12 extinciones /, 'la cifra cuenta las 12');
});

test('errores: el código del informe de barrido está registrado, con texto en es y en', async () => {
  const { informeBarrido } = await import('../engine/report/barrido.js');
  /** @type {any} */
  let err = null;
  try {
    informeBarrido(/** @type {any} */ ({ valores: [], semillas: [], resultados: [] }));
  } catch (e) {
    err = e;
  }
  assert.equal(err?.codigo, 'falta-barrido');
  assert.ok(CODIGOS_ERROR.includes(err.codigo));
  for (const l of ['es', 'en']) {
    const dic = JSON.parse(
      readFileSync(new URL(`../src/i18n/${l}/informes.json`, import.meta.url), 'utf8'),
    );
    assert.ok(dic['informes.error.cod.falta-barrido']?.length > 0, l);
  }
});
