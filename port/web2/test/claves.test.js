// @ts-check
// Claves de i18n por área (decisión C9): src/i18n/<idioma>/<área>.json.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { areaDeRuta, IDIOMAS, juntarAreas } from '../src/i18n/core.js';
import { CLAVES_ARMADAS, ERRORES_CARGA } from '../src/lib/mundo/claves.js';

const RAIZ = fileURLToPath(new URL('../src/i18n/', import.meta.url));
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** @returns {{ idioma: string, area: string, dic: Record<string, string> }[]} */
function leerArchivos() {
  const out = [];
  for (const idioma of readdirSync(RAIZ)) {
    const dir = join(RAIZ, idioma);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const a = areaDeRuta(`${idioma}/${f}`);
      assert.ok(a, `nombre de archivo inválido: ${idioma}/${f}`);
      out.push({ ...a, dic: JSON.parse(readFileSync(join(dir, f), 'utf8')) });
    }
  }
  return out;
}

const archivos = leerArchivos();

/** @param {string} idioma */
const areasDe = (idioma) =>
  new Map(archivos.filter((a) => a.idioma === idioma).map((a) => [a.area, a.dic]));

test('solo hay carpetas de los idiomas soportados y cada área está en todos', () => {
  const idiomas = [...new Set(archivos.map((a) => a.idioma))].sort();
  assert.deepEqual(idiomas, [...IDIOMAS].sort());
  const fuente = [...areasDe('es').keys()].sort();
  assert.ok(fuente.includes('app'));
  for (const l of IDIOMAS) assert.deepEqual([...areasDe(l).keys()].sort(), fuente, `áreas de ${l}`);
});

test('en cada área, es y en tienen las mismas claves', () => {
  const es = areasDe('es');
  const en = areasDe('en');
  for (const [area, dic] of es) {
    const otro = en.get(area) ?? {};
    const faltan = Object.keys(dic).filter((k) => !Object.hasOwn(otro, k));
    const sobran = Object.keys(otro).filter((k) => !Object.hasOwn(dic, k));
    assert.deepEqual(faltan, [], `claves de es/${area}.json que faltan en en/`);
    assert.deepEqual(sobran, [], `claves de en/${area}.json que no están en es/`);
  }
});

test('ningún valor vacío ni que no sea texto', () => {
  for (const { idioma, area, dic } of archivos) {
    for (const [k, v] of Object.entries(dic)) {
      assert.equal(typeof v, 'string', `${idioma}/${area}: ${k} no es texto`);
      assert.ok(v.trim() !== '', `${idioma}/${area}: ${k} está vacío`);
    }
  }
});

test('los marcadores {x} coinciden entre idiomas', () => {
  /** @param {string} s */
  const marcas = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const en = areasDe('en');
  for (const [area, dic] of areasDe('es')) {
    const otro = en.get(area) ?? {};
    for (const k of Object.keys(dic)) {
      assert.deepEqual(marcas(otro[k] ?? ''), marcas(dic[k]), `marcadores distintos en ${k}`);
    }
  }
});

test('cada clave lleva el prefijo de su área y ninguna está en dos áreas', () => {
  // juntarAreas lanza en los dos casos.
  const dics = juntarAreas(archivos);
  for (const l of IDIOMAS) {
    const total = archivos
      .filter((a) => a.idioma === l)
      .reduce((n, a) => n + Object.keys(a.dic).length, 0);
    assert.equal(Object.keys(dics[l]).length, total);
  }
});

test('juntarAreas rechaza claves repetidas y sin prefijo', () => {
  assert.throws(
    () =>
      juntarAreas([
        { idioma: 'es', area: 'a', dic: { 'a.x': '1' } },
        { idioma: 'es', area: 'b', dic: { 'a.x': '2' } },
      ]),
    /a\.x/,
  );
  assert.throws(() => juntarAreas([{ idioma: 'es', area: 'a', dic: { 'b.x': '1' } }]), /prefijo/);
  assert.deepEqual(areaDeRuta('./en/mundo.json'), { idioma: 'en', area: 'mundo' });
  assert.equal(areaDeRuta('./es.json'), null);
});

test('las claves literales que usa src/ existen', () => {
  const es = juntarAreas(archivos).es;
  /** @param {string} dir @returns {string[]} */
  const recorrer = (dir) =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return recorrer(p);
      return /\.(svelte|js)$/.test(f) ? [p] : [];
    });
  const faltan = [];
  for (const f of recorrer(SRC)) {
    const txt = readFileSync(f, 'utf8');
    for (const m of txt.matchAll(/\bt\('([a-z][\w-]*(?:\.[\w-]+)+)'/g)) {
      if (!Object.hasOwn(es, m[1])) faltan.push(`${m[1]} (${f.slice(SRC.length)})`);
    }
  }
  assert.deepEqual(faltan, []);
});

test('las claves armadas con plantilla en el área mundo existen en todos los idiomas', () => {
  const dics = juntarAreas(archivos);
  const faltan = [];
  for (const { prefijo, sufijos } of CLAVES_ARMADAS) {
    assert.ok(sufijos.length > 0, `${prefijo}: sin sufijos`);
    for (const suf of sufijos) {
      for (const l of IDIOMAS) {
        if (!Object.hasOwn(dics[l], `${prefijo}${suf}`)) faltan.push(`${l}: ${prefijo}${suf}`);
      }
    }
  }
  assert.deepEqual(faltan, []);
});

test('toda plantilla t(`mundo.<prefijo>…`) de src/ tiene su lista de sufijos declarada', () => {
  /** @param {string} dir @returns {string[]} */
  const recorrer = (dir) =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return recorrer(p);
      return /\.(svelte|js)$/.test(f) ? [p] : [];
    });
  const declarados = new Set(CLAVES_ARMADAS.map((c) => c.prefijo));
  const sueltos = [];
  for (const f of recorrer(SRC)) {
    const txt = readFileSync(f, 'utf8');
    for (const m of txt.matchAll(/\bt\(`(mundo\.[\w.-]*)\$\{/g)) {
      if (!declarados.has(m[1])) sueltos.push(`${m[1]} (${f.slice(SRC.length)})`);
    }
  }
  assert.deepEqual(sueltos, []);
});

test('las claves de fallo de carga del worker están declaradas', () => {
  const worker = readFileSync(new URL('../engine/worker.js', import.meta.url), 'utf8');
  const claves = [...worker.matchAll(/fallar\('([\w-]+)'/g)].map((m) => m[1]);
  assert.ok(claves.length > 0);
  for (const k of claves) assert.ok(ERRORES_CARGA.includes(k), `clave de error sin texto: ${k}`);
});
