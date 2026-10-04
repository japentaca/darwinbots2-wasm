// @ts-check
// Tema claro/oscuro (src/lib/tema.js, src/app.css, index.html): los dos
// bloques oscuros de app.css son idénticos y solo redefinen tokens que el
// claro ya declara; el mundo no cambia; el script de arranque de index.html
// usa la misma clave y los mismos valores que src/lib/tema.js.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLAVE_TEMA,
  COLORES_OSCURO,
  colorEnTema,
  normalizarTema,
  TEMAS,
  temaEfectivo,
} from '../src/lib/tema.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (/** @type {string} */ r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');

/** @param {string} css @param {string} selector @returns {Map<string, string>} */
function tokensDe(css, selector) {
  const i = css.indexOf(`${selector} {`);
  assert.ok(i >= 0, `falta ${selector}`);
  const cuerpo = css.slice(i + selector.length + 2, css.indexOf('}', i));
  /** @type {Map<string, string>} */
  const m = new Map();
  for (const [, k, v] of cuerpo.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) m.set(k, v.trim());
  return m;
}

test('tema: normalizar y efectivo', () => {
  assert.deepEqual(TEMAS, ['auto', 'claro', 'oscuro']);
  assert.equal(normalizarTema('oscuro'), 'oscuro');
  assert.equal(normalizarTema('claro'), 'claro');
  assert.equal(normalizarTema(null), 'auto');
  assert.equal(normalizarTema('dark'), 'auto');
  assert.equal(temaEfectivo('auto', true), 'oscuro');
  assert.equal(temaEfectivo('auto', false), 'claro');
  assert.equal(temaEfectivo('claro', true), 'claro');
  assert.equal(temaEfectivo('oscuro', false), 'oscuro');
});

test('tema: bloques oscuros de app.css idénticos y sobre tokens del claro', () => {
  const css = leer('src/app.css');
  const claro = tokensDe(css, ':root');
  const sistema = tokensDe(css, ':root:not([data-tema="claro"])');
  const elegido = tokensDe(css, ':root[data-tema="oscuro"]');
  assert.deepEqual([...sistema], [...elegido]);
  assert.ok(sistema.size > 20);
  for (const k of sistema.keys()) assert.ok(claro.has(k), `${k} no está en el tema claro`);
  // El campo de batalle es negro en los dos temas.
  assert.ok(!sistema.has('--mundo'));
  assert.match(
    css,
    /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-tema="claro"\]\)/,
  );
});

test('tema: index.html fija el tema guardado antes de montar', () => {
  const html = leer('index.html');
  const i = html.indexOf(CLAVE_TEMA);
  assert.ok(i >= 0 && i < html.indexOf('src/main.js'), 'el script de tema va antes de la app');
  for (const t of TEMAS.filter((x) => x !== 'auto')) assert.ok(html.includes(`'${t}'`), t);
  assert.match(html, /dataset\.tema/);
});

test('tema: textos del selector en es y en', async () => {
  for (const idioma of ['es', 'en']) {
    const app = JSON.parse(leer(`src/i18n/${idioma}/app.json`));
    for (const k of ['aria', ...TEMAS]) assert.ok(app[`app.tema.${k}`], `${idioma}: app.tema.${k}`);
  }
});

test('tema: colores de datos con variante para el oscuro', () => {
  assert.equal(colorEnTema('#0f5c55', false), '#0f5c55');
  assert.equal(colorEnTema('#0F5C55', true), COLORES_OSCURO['#0f5c55']);
  assert.equal(colorEnTema('#2a78d6', true), '#2a78d6');
  for (const [c, o] of Object.entries(COLORES_OSCURO)) {
    assert.equal(c, c.toLowerCase());
    assert.match(o, /^#[0-9a-f]{6}$/);
  }
});

// Colores del tema claro que no deben volver a escribirse a mano en los
// componentes (rompen el oscuro): se usan los tokens de src/app.css. Quedan
// fuera el mundo, el modo TV y las barras que son oscuras en los dos temas.
const SIEMPRE_OSCUROS = [
  'src/lib/mundo/',
  'src/lib/observar/tv/',
  'src/lib/observar/objetos/BarraMundo.svelte',
  'src/lib/BarraSuperior.svelte',
];
const CLAROS_A_MANO = [
  /background: #fff(fff)?;/,
  /#fcfcfb/i,
  /#ebe9e2/i,
  /#e1e0d9/i,
  /#e3ecea|#e3eeec|#eef5f4/i,
  /background: #f4f3ef;/,
  /stroke="#151513"|stroke: #151513/,
  /var\(--[a-z-]+, #/,
];

test('tema: componentes sin colores claros escritos a mano', () => {
  /** @param {string} dir @returns {string[]} */
  const svelte = (dir) =>
    fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true }).flatMap((e) => {
      const r = `${dir}/${e.name}`;
      if (e.isDirectory()) return svelte(r);
      return e.name.endsWith('.svelte') ? [r] : [];
    });
  const malos = [];
  for (const f of svelte('src')) {
    if (SIEMPRE_OSCUROS.some((x) => f.startsWith(x))) continue;
    leer(f)
      .split('\n')
      .forEach((l, i) => {
        if (CLAROS_A_MANO.some((re) => re.test(l))) malos.push(`${f}:${i + 1}: ${l.trim()}`);
      });
  }
  assert.deepEqual(malos, []);
});
