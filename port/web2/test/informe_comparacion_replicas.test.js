// @ts-check
// Plantillas «Comparación» y «Réplicas» del informe (engine/report/,
// decisiones 10 y 11): html válido y autocontenido en es y en, sin URLs
// externas, ids únicos y enlaces internos resueltos, figuras dentro de su
// tamaño, nombres escapados (XSS), datos embebidos parseables, diferencias
// de configuración, resumen por reglas enlazado a sus figuras y la nota de
// C19 cuando se descartaron semillas.
//
// INFORME_EJEMPLO_DIR=<carpeta> guarda un ejemplo de cada plantilla ahí
// (informe-comparacion.html, informe-replicas.html).
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { agruparHallazgos, detectar } from '../engine/detectors.js';
import { semillasReplicas } from '../engine/replicas.js';
import { COLOR_A, COLOR_B, GRUPOS_CMP, idFigura } from '../engine/report/comparacion.js';
import { generarInforme, informeComparacion, informeReplicas } from '../engine/report/index.js';
import { semillasDescartadas } from '../engine/report/replicas.js';
import { traductor } from '../engine/report/textos.js';
import { ciclos, historiaDe } from './util/historia-sintetica.js';
import { resultadoSintetico } from './util/replicas-sinteticas.js';
import { figurasEnTamaño, validar } from './util/validar-informe.js';

/** @param {number} n @param {(i: number) => number | null} f */
const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/** Texto visible (sin etiquetas, espacios juntados). @param {string} html */
const visible = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style>[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

const ESCENARIO = {
  id: 'sopa',
  nombre: { es: 'Sopa F1', en: 'F1 soup' },
  opciones: { base: 'f1', cambios: { 'base:minVegs': 30 } },
  especies: [
    { bot: 'Animal Minimalis 4G.txt', cantidad: 10, color: '#2a78d6', vegetal: false },
    { bot: 'Yojimbo', cantidad: 10, color: '#e87ba4', vegetal: false },
    { bot: 'Alga Minimalis 3.0', cantidad: 30, color: '#1baf7a', vegetal: true },
  ],
  objetos: { obstaculos: [], teleporters: [] },
};

/** Dos corridas: A con una extinción, B más larga, con otra semilla y otros cambios. */
function dosCorridas() {
  const n = 300;
  const ha = historiaDe({
    t: ciclos(n),
    especies: {
      'Animal Minimalis 4G': serie(n, (i) => 20 + i / 3),
      Yojimbo: serie(n, (i) => (i < 150 ? 40 - i / 5 : null)),
      'Alga Minimalis 3.0': serie(n, () => 50),
    },
    vegetales: ['Alga Minimalis 3.0'],
    adn: serie(n, (i) => 200 + i / 2),
  });
  const m = 400;
  const hb = historiaDe({
    t: ciclos(m),
    especies: {
      'Animal Minimalis 4G': serie(m, () => 30),
      Yojimbo: serie(m, () => 30),
      'Alga Minimalis 3.0': serie(m, () => 60),
    },
    vegetales: ['Alga Minimalis 3.0'],
    adn: serie(m, () => 150),
    // la historia de B se fundió: sus puntos van cada 200 ciclos
    opciones: { maxPuntos: 200 },
  });
  const escB = structuredClone(ESCENARIO);
  escB.opciones.cambios = { 'base:minVegs': 50 };
  escB.especies[1].cantidad = 20;
  return {
    a: {
      historia: ha,
      escenario: ESCENARIO,
      semilla: 1234,
      titulo: 'Sopa A',
      cambios: [{ ciclo: 9000, tipo: 'opciones', cambios: { 'opt:11': 1 } }],
    },
    b: { historia: hb, escenario: escB, semilla: 999, titulo: 'Sopa B', cambios: [] },
    fecha: '2026-09-29T12:00:00Z',
  };
}

test('comparación: html válido y autocontenido, en es y en en', () => {
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const d = dosCorridas();
    const r = informeComparacion(d, { idioma });
    const datos = validar(r.html);
    const nFig = figurasEnTamaño(r.html);
    assert.ok(nFig >= 12, `${nFig} figuras`);
    assert.equal(datos.tipo, 'comparacion');
    assert.equal(datos.idioma, idioma);
    assert.deepEqual(
      datos.corridas.map((/** @type {any} */ c) => [c.lado, c.nombre, c.semilla]),
      [
        ['A', 'Sopa A', 1234],
        ['B', 'Sopa B', 999],
      ],
    );
    assert.deepEqual(datos.corridas[1].ciclos, { desde: 0, hasta: d.b.historia.t.at(-1) });
    assert.ok(datos.series.some((/** @type {any} */ s) => s.corrida === 'B'));
    assert.match(r.archivo, /^informe_sopa-a-.*_2026-09-29\.html$/);
    assert.match(r.html, new RegExp(`<html lang="${idioma}">`));
    assert.match(r.html, /@media print/);
    // los seis grupos, con una figura superpuesta de A y B
    for (const [, metricas] of GRUPOS_CMP)
      for (const m of metricas)
        if (m !== 'disparosCiclo' && m !== 'killsTotal' && m !== 'bodyTotal')
          assert.match(r.html, new RegExp(`id="${idFigura(m)}"`), m);
    assert.equal((r.html.match(/<h3>/g) ?? []).length >= 6, true);
    const fig = r.html.match(/<figure id="fig-c-vivos">([\s\S]*?)<\/figure>/)?.[1] ?? '';
    assert.match(fig, new RegExp(`stroke="${COLOR_A}"`));
    assert.match(fig, new RegExp(`stroke="${COLOR_B}"[^>]*stroke-dasharray`));
  }
});

test('comparación: diferencias de configuración y tabla de valores finales', () => {
  const r = informeComparacion(dosCorridas(), { idioma: 'es' });
  const txt = visible(r.html);
  assert.match(txt, /Semilla 1234 999/);
  assert.match(txt, /Especie: Yojimbo 10 bots · energía 3\.000|Especie: Yojimbo 10 bots/);
  assert.match(txt, /Cambios en caliente 1 cambio 0 cambios/);
  assert.match(txt, /\d+ diferencias al arrancar/);
  const datos = validar(r.html);
  const claves = datos.diferencias.map((/** @type {any} */ x) => x.clave);
  assert.ok(claves.includes('semilla'));
  assert.ok(claves.includes('especie:Yojimbo'));
  assert.ok(claves.includes('caliente'));
  assert.ok(
    claves.some((/** @type {string} */ c) => c.startsWith('opcion:')),
    'minVegs 30 vs 50',
  );
  assert.ok(!claves.includes('escenario'), 'mismo escenario');
  assert.ok(!claves.includes('base'), 'misma base');
  // valores finales: A termina con 20 + 299/3 ≈ 119,67 animales + 50 algas
  assert.match(txt, /Valores finales/);
  assert.match(txt, /Bots vivos 169,67 120 −?-?49,67/);
  // misma configuración: lo dice
  const d = dosCorridas();
  const igual = informeComparacion(
    { ...d, b: { ...d.a, titulo: 'Otra', historia: d.b.historia } },
    { idioma: 'en' },
  );
  assert.match(visible(igual.html), /Both runs have the same configuration\./);
  assert.equal(validar(igual.html).diferencias.length, 0);
});

test('comparación: el resumen escribe los hallazgos de cada corrida, enlazados a su figura', () => {
  const d = dosCorridas();
  const ha = agruparHallazgos(detectar(d.a.historia));
  const hb = agruparHallazgos(detectar(d.b.historia));
  assert.ok(ha.length >= 1, 'A tiene hallazgos (extinción de Yojimbo)');
  assert.equal(hb.length, 0, 'B no tiene hallazgos');
  const r = informeComparacion(d, { idioma: 'es' });
  const resumen = r.html.match(/<section class="resumen">([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.match(resumen, /<h3>A · Sopa A<\/h3>/);
  assert.doesNotMatch(resumen, /Sopa B/, 'B no escribe nada');
  const frases = [...resumen.matchAll(/<p class="find">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  assert.equal(frases.length, ha.length);
  for (const f of frases) assert.match(f, /href="#fig-c-[a-zA-Z]+"/);
  assert.match(resumen, /Yojimbo se extinguió en el ciclo 15\.000/);
  // sin hallazgos en ninguna, no hay resumen
  const sin = informeComparacion({ a: d.b, b: { ...d.b, titulo: 'Otra' } }, { idioma: 'es' });
  assert.doesNotMatch(sin.html, /class="resumen"/);
  assert.doesNotMatch(sin.html, /class="find"/);
});

test('comparación: escape de nombres (XSS) y nombres iguales', () => {
  const malo = `<script>alert("x")</script> & 'q' </script><img src=x onerror=alert(1)>`;
  const n = 80;
  const h = historiaDe({
    t: ciclos(n),
    especies: { [malo]: serie(n, (i) => (i < 40 ? 50 : null)), B: serie(n, () => 10) },
  });
  const esc = {
    ...ESCENARIO,
    nombre: malo,
    especies: [{ bot: malo, cantidad: 1, color: '#123456" onload="x', vegetal: false }],
  };
  const r = informeComparacion(
    { a: { historia: h, escenario: esc }, b: { historia: h, escenario: { ...esc, id: 'otro' } } },
    { idioma: 'es' },
  );
  assert.doesNotMatch(r.html, /<script>alert/);
  assert.doesNotMatch(r.html, /<img/);
  assert.doesNotMatch(r.html, /onload="x/);
  const datos = validar(r.html);
  assert.equal(datos.corridas[0].nombre, `${malo} (A)`, 'mismo nombre: se distinguen con (A)/(B)');
  assert.equal(datos.corridas[1].nombre, `${malo} (B)`);
  figurasEnTamaño(r.html);
});

test('comparación: historias vacías y de una muestra generan un informe válido', () => {
  const vacia = historiaDe({ t: [] });
  const una = historiaDe({ t: [0], especies: { A: [3] } });
  for (const [a, b] of [
    [vacia, vacia],
    [una, vacia],
  ]) {
    const r = informeComparacion(
      { a: { historia: a }, b: { historia: b }, fecha: 0 },
      { idioma: 'en' },
    );
    validar(r.html);
    figurasEnTamaño(r.html);
    assert.doesNotMatch(r.html, /NaN/);
  }
  assert.throws(() => informeComparacion(/** @type {any} */ ({})), { codigo: 'faltan-corridas' });
});

/**
 * Trabajo de réplicas sintético: n semillas desde `base`, las `hechas`
 * primeras terminadas.
 * @param {number} base @param {number} n @param {number} [hechas]
 */
function trabajo(base, n, hechas = n) {
  const semillas = semillasReplicas(base, n);
  return {
    escenario: ESCENARIO,
    semillas,
    ciclos: 20000,
    cada: 100,
    metrica: 'vivos',
    origen: { nombre: 'Sopa del lunes', id: 'c1' },
    eventos: [{ ciclo: 5000, tipo: 'opciones', cambios: { 'opt:11': 1 } }],
    resultados: semillas.map((_, i) =>
      i < hechas
        ? resultadoSintetico({
            ciclos: 20000,
            cada: 100,
            vivos: (c) => 100 + i * 10 + Math.round(20 * Math.sin(c / 3000 + i)),
          })
        : null,
    ),
    fecha: '2026-09-29T12:00:00Z',
  };
}

test('réplicas: html válido y autocontenido, en es y en en, con bandas y tabla', () => {
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const d = trabajo(1234, 8);
    const r = informeReplicas(d, { idioma });
    const datos = validar(r.html);
    const nFig = figurasEnTamaño(r.html);
    assert.ok(nFig >= 8, `${nFig} figuras`);
    assert.equal(datos.tipo, 'replicas');
    assert.equal(datos.hechas, 8);
    assert.deepEqual(datos.semillas, d.semillas);
    assert.equal(datos.semillas[0], 1234);
    const vivos = datos.series.find((/** @type {any} */ s) => s.metrica === 'vivos');
    assert.ok(
      vivos.p10.every(
        (/** @type {number} */ v, /** @type {number} */ i) => v <= vivos.media[i] + 1e-9,
      ),
    );
    assert.ok(
      vivos.p90.every(
        (/** @type {number} */ v, /** @type {number} */ i) => v >= vivos.media[i] - 1e-9,
      ),
    );
    const fila = datos.tabla.find((/** @type {any} */ x) => x.clave === 'vivos');
    assert.equal(fila.n, 8);
    assert.ok(fila.desvio > 0);
    assert.match(r.html, /id="fig-r-vivos"/);
    // resumen enlazado a sus figuras
    const frases = [...r.html.matchAll(/<p class="find">([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    assert.ok(frases.length >= 2);
    for (const f of frases) assert.match(f, /href="#fig-r-\w+"/);
    assert.match(r.html, /<table class="tbl">/);
    assert.doesNotMatch(r.html, /class="p"><strong>/, 'sin nota de parcial');
  }
  const txt = visible(informeReplicas(trabajo(1234, 8), { idioma: 'es' }).html);
  assert.match(txt, /8 réplicas × 20\.000 ciclos · una muestra cada 100 ciclos/);
  assert.match(txt, /Corrida de origen: Sopa del lunes\./);
  assert.match(txt, /repite en el mismo ciclo 1 cambio en caliente/);
  assert.match(txt, /1234 \(la de la corrida de origen\) terminada 20\.000/);
});

test('réplicas: resultados parciales y sin ninguno terminado', () => {
  const r = informeReplicas(trabajo(77, 6, 2), { idioma: 'es' });
  const datos = validar(r.html);
  assert.equal(datos.hechas, 2);
  assert.match(visible(r.html), /2 de 6 réplicas terminadas: los resultados son parciales\./);
  assert.match(visible(r.html), /sin terminar —/);
  const nada = informeReplicas(trabajo(77, 3, 0), { idioma: 'en' });
  validar(nada.html);
  figurasEnTamaño(nada.html);
  assert.match(visible(nada.html), /No replicate has finished yet\./);
  assert.doesNotMatch(nada.html, /class="find"/);
  assert.doesNotMatch(nada.html, /NaN/);
  assert.throws(() => informeReplicas(/** @type {any} */ ({})), { codigo: 'faltan-replicas' });
});

test('réplicas: nota de C19 solo si se descartaron semillas', () => {
  // una base cuyo trabajo de 64 réplicas descarta alguna semilla
  let base = 0;
  let desc = 0;
  for (let b = 1; b < 5000 && !desc; b++) {
    desc = semillasDescartadas(semillasReplicas(b, 64));
    if (desc) base = b;
  }
  assert.ok(base > 0, 'hay alguna base que descarta');
  const con = informeReplicas({ ...trabajo(base, 64, 1) }, { idioma: 'es' });
  assert.match(visible(con.html), /Al elegir las semillas se descart/);
  assert.equal(validar(con.html).semillasDescartadas, desc);
  const en = informeReplicas({ ...trabajo(base, 64, 1) }, { idioma: 'en' });
  assert.match(visible(en.html), /skipped: the engine tells 65,536 worlds apart/);
  // sin descartes: no escribe la nota
  const sin = informeReplicas(trabajo(1234, 4), { idioma: 'es' });
  assert.equal(semillasDescartadas(sin.datos.semillas), 0);
  assert.doesNotMatch(sin.html, /Al elegir las semillas/);
  // semillas que no salen del generador: 0
  assert.equal(semillasDescartadas([5, 6, 7]), 0);
  const t = traductor('es').tx;
  assert.match(t('rep.c19', { n: 1 }), /se descartó 1 semilla que repetía/);
  assert.match(t('rep.c19', { n: 2 }), /se descartaron 2 semillas que repetían/);
});

test('réplicas: escape de nombres (XSS)', () => {
  const malo = `<script>alert(1)</script>"'&`;
  const d = trabajo(1234, 2);
  d.origen = { nombre: malo, id: null };
  d.escenario = { ...ESCENARIO, nombre: malo, especies: [{ bot: malo, cantidad: 2 }] };
  const r = informeReplicas(d, { idioma: 'es' });
  assert.doesNotMatch(r.html, /<script>alert/);
  const datos = validar(r.html);
  assert.equal(datos.origen.nombre, malo);
});

test('generarInforme reparte por tipo; ejemplos para abrir a mano', () => {
  const cmp = generarInforme('comparacion', dosCorridas(), { idioma: 'es' });
  const rep = generarInforme('replicas', trabajo(1234, 16), { idioma: 'es' });
  validar(cmp.html);
  validar(rep.html);
  const dir = process.env.INFORME_EJEMPLO_DIR;
  if (dir) {
    writeFileSync(join(dir, 'informe-comparacion.html'), cmp.html);
    writeFileSync(join(dir, 'informe-replicas.html'), rep.html);
  }
});

test('órdenes de objeto en caliente: texto en es y en, en la Corrida y contadas en las demás', async () => {
  const { ORDENES_OBJETO } = await import('../engine/corridas.js');
  const { textoOrdenObjeto, informeCorrida } = await import('../engine/report/corrida.js');
  const ordenes = {
    forma: { tipo: 'forma', ancho: 0.1, alto: 0.25 },
    formas: { tipo: 'formas', ancho: 0.05, alto: 0.05 },
    laberinto: { tipo: 'laberinto', forma: 'spiral', pasillo: 300, muro: 100 },
    teleporter: { tipo: 'teleporter' },
    'borrar-forma': { tipo: 'borrar-forma', n: 2 },
    'borrar-formas10': { tipo: 'borrar-formas10' },
    'borrar-formas': { tipo: 'borrar-formas' },
    'borrar-teleporter': { tipo: 'borrar-teleporter', n: 1 },
    'borrar-teleporters': { tipo: 'borrar-teleporters' },
  };
  assert.deepEqual(Object.keys(ordenes).sort(), [...ORDENES_OBJETO].sort(), 'todas las órdenes');
  for (const idioma of /** @type {const} */ (['es', 'en'])) {
    const { tx, num } = traductor(idioma);
    for (const o of Object.values(ordenes)) {
      const s = textoOrdenObjeto(o, tx, num);
      assert.ok(s && !/[{}]|NaN|undefined/.test(s), `${idioma} ${o.tipo}: ${s}`);
    }
  }
  const { tx, num } = traductor('es');
  assert.equal(
    textoOrdenObjeto(ordenes.forma, tx, num),
    'Obstáculo al azar de 10 % × 25 % del campo',
  );
  assert.equal(
    textoOrdenObjeto(ordenes.laberinto, tx, num),
    'Laberinto espiral (pasillo 300, muro 100)',
  );
  assert.equal(textoOrdenObjeto({ tipo: 'nuevo' }, tx, num), 'Orden de objetos: nuevo');
  const d = dosCorridas();
  d.a.cambios.push({ ciclo: 12000, tipo: 'objetos', orden: ordenes.laberinto });
  const r = informeCorrida({ ...d.a, fecha: 0 }, { idioma: 'en' });
  assert.match(visible(r.html), /12,000 Spiral maze \(corridor 300, wall 100\)/);
  const cmp = informeComparacion(d, { idioma: 'es' });
  assert.match(visible(cmp.html), /Cambios en caliente 2 cambios 0 cambios/);
});

test('comparación: las diferencias coinciden con las de la pestaña Comparar (bots repetidos, color, objetos)', async () => {
  const { diferenciasConfig } = await import('../src/lib/analizar/comparar/diferencias.js');
  const { diferenciasComparacion } = await import('../engine/report/comparacion.js');
  /** Claves de diferenciasConfig, con los nombres de las del informe. @param {any} x */
  const clavesPestaña = (x) =>
    [
      ...(x.escenario.igual ? [] : ['escenario']),
      ...(x.semilla.igual ? [] : ['semilla']),
      ...(x.base.igual ? [] : ['base']),
      ...x.opciones.map((/** @type {any} */ o) => `opcion:${o.clave}`),
      ...x.especies
        .filter((/** @type {any} */ e) => !e.igual)
        .map((/** @type {any} */ e) => `especie:${e.bot}`),
      ...(x.objetos.igual ? [] : ['objetos']),
      ...(x.eventos.igual ? [] : ['caliente']),
    ].sort();
  const base = structuredClone(ESCENARIO);
  base.especies.push({ bot: 'Yojimbo', cantidad: 5, color: '#e87ba4', vegetal: false });
  const casos = [];
  // mismo bot repetido: solo difiere el segundo grupo
  const b1 = structuredClone(base);
  b1.especies[3].cantidad = 7;
  casos.push(b1);
  // color distinto (mayúsculas no cuentan)
  const b2 = structuredClone(base);
  b2.especies[0].color = '#FF0000';
  const b2b = structuredClone(base);
  b2b.especies[0].color = base.especies[0].color.toUpperCase();
  casos.push(b2, b2b);
  // objetos: mismo tipo con otras medidas; otro id de escenario con el mismo nombre
  const b3 = structuredClone(base);
  b3.objetos.obstaculos.push({ tipo: 'forma', ancho: 0.1, alto: 0.2 });
  const b4 = structuredClone(b3);
  b4.objetos.obstaculos[0].alto = 0.3;
  b4.id = 'otra';
  casos.push(b3, b4);
  const tr = traductor('es');
  for (const [i, e] of casos.entries()) {
    const previo = i === 4 ? b3 : base;
    const informe = diferenciasComparacion(
      /** @type {any} */ ({ escenario: previo, semilla: 1, cambios: [] }),
      /** @type {any} */ ({ escenario: e, semilla: 1, cambios: [] }),
      tr,
    )
      .map((x) => x.clave)
      .sort();
    const pestaña = clavesPestaña(
      diferenciasConfig(
        /** @type {any} */ ({ escenario: previo, semilla: 1, eventos: [] }),
        /** @type {any} */ ({ escenario: e, semilla: 1, eventos: [] }),
      ),
    );
    assert.deepEqual(informe, pestaña, `caso ${i}`);
  }
  const rep = diferenciasComparacion(
    /** @type {any} */ ({ escenario: base, semilla: 1, cambios: [] }),
    /** @type {any} */ ({ escenario: b1, semilla: 1, cambios: [] }),
    tr,
  );
  assert.deepEqual(
    rep.map((x) => x.clave),
    ['especie:Yojimbo (2)'],
  );
  assert.equal(rep[0].aspecto, 'Especie: Yojimbo (2)');
  const color = diferenciasComparacion(
    /** @type {any} */ ({ escenario: base, semilla: 1, cambios: [] }),
    /** @type {any} */ ({ escenario: b2, semilla: 1, cambios: [] }),
    tr,
  );
  assert.match(color[0].b, /color #ff0000/);
});

test('comparación: nota si las dos semillas dan el mismo mundo (C19)', async () => {
  const { mismoMundo } = await import('../engine/report/comparacion.js');
  assert.equal(mismoMundo(1234, 66184), true);
  assert.equal(mismoMundo(1234, 1234), false, 'la misma semilla no es aviso');
  assert.equal(mismoMundo(1234, 999), false);
  assert.equal(mismoMundo(null, 1234), false);
  const d = dosCorridas();
  d.b.semilla = 66184;
  const r = informeComparacion(d, { idioma: 'es' });
  assert.match(visible(r.html), /Las semillas 1234 y 66184 dan el mismo mundo/);
  assert.equal(validar(r.html).mismoMundo, true);
  const otro = informeComparacion(dosCorridas(), { idioma: 'en' });
  assert.doesNotMatch(visible(otro.html), /same world/);
  assert.equal(validar(otro.html).mismoMundo, false);
});

test('comparación: dominio y extinción enlazan a la población por especie de su corrida', async () => {
  const { idFiguraEspecies } = await import('../engine/report/comparacion.js');
  const r = informeComparacion(dosCorridas(), { idioma: 'es' });
  const resumen = r.html.match(/<section class="resumen">([\s\S]*?)<\/section>/)?.[1] ?? '';
  const ext = [...resumen.matchAll(/<p class="find">([\s\S]*?)<\/p>/g)]
    .map((m) => m[1])
    .find((f) => /Yojimbo se extinguió/.test(f));
  assert.ok(ext);
  assert.match(ext, new RegExp(`href="#${idFiguraEspecies('A')}"`));
  for (const l of ['A', 'B'])
    assert.match(r.html, new RegExp(`<figure id="${idFiguraEspecies(l)}">`));
  figurasEnTamaño(r.html);
  // la misma especie tiene el mismo color en A y en B
  /** @param {string} l */
  const leyendaDe = (l) => {
    const i = r.html.indexOf(`<figure id="${idFiguraEspecies(l)}">`);
    const fin = r.html.indexOf('</figure>', i);
    return r.html.slice(i, fin).match(/<div class="leyenda">([\s\S]*?)<\/div>/)?.[1] ?? '';
  };
  /** @param {string} l */
  const colorDe = (l) => leyendaDe(l).match(/background:(#[0-9a-f]{6})"><\/span>Yojimbo/)?.[1];
  assert.ok(colorDe('A'));
  assert.equal(colorDe('A'), colorDe('B'));
  // series por especie embebidas, con su corrida
  const datos = validar(r.html);
  assert.ok(
    datos.series.some((/** @type {any} */ s) => s.corrida === 'B' && s.especie === 'Yojimbo'),
  );
});
