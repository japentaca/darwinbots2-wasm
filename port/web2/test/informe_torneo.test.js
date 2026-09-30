// @ts-check
// Plantilla «Torneo» del informe (engine/report/torneo.js; decisiones 11 y
// 22, paso N3.5): html válido y autocontenido en es y en para cada formato,
// sin URLs externas, ids únicos y enlaces internos resueltos, figuras dentro
// de su tamaño, nombres escapados (XSS), datos embebidos parseables, el
// resumen por reglas (y que no escribe si no hay nada que decir) y el Elo
// igual al de la tabla.
//
// INFORME_EJEMPLO_DIR=<carpeta> guarda un ejemplo (informe-torneo.html).
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as LG from '../engine/league.js';
import { eloPorPartido, generarInforme, informeTorneo, TIPOS } from '../engine/report/index.js';
import { datosTorneo } from '../src/lib/analizar/informes/datos.js';
import { figurasEnTamaño, validar } from './util/validar-informe.js';

/** Texto visible (sin etiquetas, espacios juntados). @param {string} html */
const visible = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style>[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

/**
 * Un torneo de una temporada jugada con lgFixture: gana el primero salvo
 * `gana`; cada tres partidos uno es nulo si `nulos`.
 * @param {string} formato @param {string[]} nombres @param {Record<string, any>} [fmt]
 * @param {{nulos?: boolean, max?: number, gana?: (fx: any, i: number) => string}} [o]
 */
function torneo(formato, nombres, fmt = {}, o = {}) {
  const L = LG.lgNewLeague({
    id: 'L1',
    name: 'Liga de prueba',
    fmt: { format: formato, ...fmt },
    rules: {
      escenario: {
        id: 'partido-f1',
        nombre: { es: 'Partido F1', en: 'F1 match' },
        opciones: { base: 'f1', cambios: {} },
      },
    },
  });
  const S = L.seasons[0];
  for (const [i, n] of nombres.entries())
    LG.lgAddEntrant(S, { name: n, dna: `adn ${i}`, src: 'form' });
  /** @type {any[]} */
  const ms = [];
  LG.lgCupDraw(L, ms, () => 0.4);
  LG.lgSwissDraw(L, ms, () => 0.4);
  const gana = o.gana ?? ((/** @type {any} */ fx) => fx.fighters[0].name);
  for (let i = 0; i < (o.max ?? 400); i++) {
    const fx = LG.lgFixture(S, ms, () => 0.3);
    if (!fx) break;
    const nulo = o.nulos && i % 3 === 2;
    const w = nulo ? '' : gana(fx, i);
    ms.push({
      id: i + 1,
      league: 'L1',
      season: 1,
      no: i + 1,
      date: `2026-09-${String(10 + (i % 20)).padStart(2, '0')}T00:00:00.000Z`,
      fighters: fx.fighters.map((/** @type {any} */ e) => e.name),
      winner: w,
      wins: fx.fighters.map((/** @type {any} */ e) => (e.name === w ? 3 : 1)),
      capWins: fx.fighters.map(() => 0),
      rounds: nulo ? 0 : 3 + fx.fighters.length - 1,
      capRounds: nulo ? 0 : 2,
      cycles: nulo ? 0 : 1000 + 37 * i,
      seed: 1000 + i,
      note: nulo ? 'void: only one species in the census' : '',
    });
  }
  return { L, ms };
}

const NOMBRES = (/** @type {number} */ n) =>
  Array.from({ length: n }, (_, i) => `Bot ${String.fromCharCode(65 + i)}`);

test('torneo: la plantilla está registrada y valida los datos', () => {
  assert.ok(TIPOS.includes('torneo'));
  assert.throws(() => generarInforme('torneo', {}), { codigo: 'falta-torneo' });
  assert.throws(
    () => informeTorneo(/** @type {any} */ ({ torneo: { seasons: [] }, partidos: [] })),
    {
      codigo: 'falta-torneo',
    },
  );
});

test('torneo: html válido y autocontenido en es y en, para cada formato', () => {
  const casos = [
    torneo('single', NOMBRES(5)),
    torneo('koth', NOMBRES(5), { retire: 2 }),
    torneo('koth', NOMBRES(4), { kothEnd: 'never', retire: 2 }, { max: 12 }),
    torneo('rr', NOMBRES(5), { legs: 2 }, { nulos: true }),
    torneo('ladder', NOMBRES(4), {}, { gana: (fx) => fx.fighters[1].name }),
    torneo('cup', NOMBRES(8), { third: true }),
    torneo('swiss', NOMBRES(9)),
  ];
  for (const { L, ms } of casos)
    for (const idioma of /** @type {const} */ (['es', 'en'])) {
      const r = generarInforme(
        'torneo',
        { torneo: L, partidos: ms, titulo: L.name, fecha: '2026-09-30' },
        { idioma },
      );
      const datos = validar(r.html);
      figurasEnTamaño(r.html);
      assert.equal(datos.tipo, 'torneo');
      assert.equal(datos.idioma, idioma);
      assert.equal(datos.partidos.length, ms.length);
      assert.equal(datos.tabla.length, L.seasons[0].entrants.length);
      assert.match(r.archivo, /^informe_liga-de-prueba-(temporada|season)-1_2026-09-30\.html$/);
      assert.match(r.html, /id="tabla"/);
      assert.match(r.html, /id="partidos"/);
      // las semillas de los partidos, para repetirlos
      for (const m of ms) assert.ok(r.html.includes(`>${m.seed}<`), `semilla ${m.seed}`);
      // sin ADN en los datos embebidos
      assert.doesNotMatch(r.html, /adn \d/);
      // la estructura del formato (el partido único no tiene)
      const secciones = [...r.html.matchAll(/<h2>/g)].length;
      assert.equal(
        secciones,
        L.seasons[0].fmt.format === 'single' ? 4 : 5,
        L.seasons[0].fmt.format,
      );
    }
  const { L, ms } = casos[6];
  const r = generarInforme('torneo', { torneo: L, partidos: ms }, { idioma: 'es' });
  if (process.env.INFORME_EJEMPLO_DIR)
    writeFileSync(join(process.env.INFORME_EJEMPLO_DIR, 'informe-torneo.html'), r.html);
});

test('torneo: resumen por reglas enlazado a la tabla, el Elo y los partidos', () => {
  const { L, ms } = torneo('rr', NOMBRES(4), {}, { nulos: true });
  const S = L.seasons[0];
  const r = informeTorneo({ torneo: L, partidos: ms, fecha: '2026-09-30' }, { idioma: 'es' });
  const txt = visible(r.html);
  const champ = LG.lgSeasonChampion(
    S,
    ms.filter((m) => m.season === 1),
  );
  // el calendario tiene nulos: la temporada puede no terminar; hay líder o campeón
  if (champ) assert.match(txt, new RegExp(`${champ.name} ganó la temporada`));
  else assert.match(txt, /va primero/);
  assert.match(txt, /partidos? fue(ron)? nulos?/);
  assert.match(txt, /se decidió por el tope de ciclos/);
  assert.match(r.html, /<section class="resumen">/);
  assert.match(r.html, /href="#tabla"/);
  assert.match(r.html, /href="#partidos"/);
  // sin partidos, el resumen no escribe
  const vacio = torneo('rr', NOMBRES(3), {}, { max: 0 });
  const r2 = informeTorneo({ torneo: vacio.L, partidos: vacio.ms }, { idioma: 'en' });
  validar(r2.html);
  assert.doesNotMatch(r2.html, /<section class="resumen">/);
  assert.match(visible(r2.html), /No match has been played yet/);
});

test('torneo: el Elo después de cada partido termina en el de la tabla', () => {
  for (const [f, n] of /** @type {const} */ ([
    ['koth', 5],
    ['rr', 6],
    ['single', 4],
  ])) {
    const { L, ms } = torneo(f, NOMBRES(n), { k: 3 });
    const S = L.seasons[0];
    const e = eloPorPartido(S, ms);
    assert.equal(e.x.length, LG.lgPlayed(ms).length + 1);
    for (const r of LG.lgStandings(S, ms)) {
      const v = /** @type {number[]} */ (e.series.get(r.name));
      assert.equal(v[0], LG.LG_ELO0);
      assert.ok(Math.abs(v[v.length - 1] - r.elo) < 1e-9, `${f} ${r.name}`);
    }
  }
  // las series del CSV: una por participante, con t = número de partido
  const { L, ms } = torneo('rr', NOMBRES(3));
  const d = informeTorneo({ torneo: L, partidos: ms }).datos;
  assert.deepEqual(d.t, [0, 1, 2, 3]);
  assert.equal(d.series.length, 3);
  assert.ok(d.series.every((/** @type {any} */ s) => s.metrica === 'elo' && s.media.length === 4));
});

test('torneo: escape de nombres (XSS) y colores que no son #rrggbb', () => {
  const malo = `<script>alert("x")</script> & 'q' </script><img src=x onerror=alert(1)>`;
  const { L, ms } = torneo('swiss', [malo, 'Otro', 'Tercero', 'Cuarto']);
  L.seasons[0].entrants[1].color = 'red;background:url(http://x.test/a.png)';
  const r = informeTorneo({ torneo: L, partidos: ms, titulo: malo }, { idioma: 'es' });
  assert.doesNotMatch(r.html, /<img/);
  assert.doesNotMatch(r.html, /<script>alert/);
  assert.doesNotMatch(r.html, /url\(/);
  const datos = validar(r.html);
  assert.equal(datos.titulo.includes(malo), true);
  assert.ok(r.html.includes('&lt;script&gt;alert'));
});

test('torneo: datosTorneo (Informes y Competir) copia el torneo y filtra sus partidos', () => {
  const { L, ms } = torneo('rr', NOMBRES(3));
  const ajenos = [{ ...ms[0], league: 'otra', id: 99 }];
  const d = datosTorneo(L, [...ms, ...ajenos], { temporada: 1, titulo: 'Mi torneo', fecha: 0 });
  assert.equal(d.partidos.length, ms.length);
  assert.notEqual(d.torneo, L);
  assert.deepEqual(d.torneo, L);
  assert.equal(d.titulo, 'Mi torneo');
  const r = generarInforme('torneo', d, { idioma: 'en' });
  assert.match(r.archivo, /^informe_mi-torneo-season-1_1970-01-01\.html$/);
  // una temporada vieja
  const L2 = structuredClone(L);
  L2.seasons.push(LG.lgSeasonNext(L2.seasons[0], false));
  const r2 = informeTorneo({ torneo: L2, partidos: ms, temporada: 1 }, { idioma: 'es' });
  assert.equal(r2.datos.torneo.temporada, 1);
  assert.equal(r2.datos.torneo.temporadas, 2);
  const r3 = informeTorneo({ torneo: L2, partidos: ms }, { idioma: 'es' });
  assert.equal(r3.datos.torneo.temporada, 2);
  assert.equal(r3.datos.partidos.length, 0);
});
