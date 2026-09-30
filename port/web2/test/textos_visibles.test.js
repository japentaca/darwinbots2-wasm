// @ts-check
// Textos visibles (regla del proyecto): la interfaz no menciona «el original»
// ni VB6/Visual Basic. Recorre todos los textos que llegan a la pantalla:
// los valores de src/i18n/**/*.json, los textos es/en/ayuda de todo lo que
// exporta engine/opciones.js (parámetros, grupos, bases, medios, controles
// básicos y sus opciones de enum) y nombre/descripción/etiquetas de los
// escenarios de fábrica. Los comentarios de código pueden seguir citándolo.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as opciones from '../engine/opciones.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PROHIBIDO = [/\boriginal\b/i, /\bVB6\b/i, /visual\s*basic/i];

// Lista blanca explícita: `ubicación` exacta (tal como la arma este test) de
// un texto que puede mencionar alguno de los términos, con su justificación.
// Vacía por ahora.
/** @type {Map<string, string>} */
const LISTA_BLANCA = new Map([]);

/** @typedef {{ donde: string, texto: string }} Texto */

/** @param {string} dir @returns {string[]} */
function jsonsDe(dir) {
  /** @type {string[]} */
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonsDe(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out.sort();
}

/**
 * Todas las cadenas de `v` (recorre objetos y arreglos).
 * @param {unknown} v @param {string} donde @param {Texto[]} out
 */
function cadenas(v, donde, out) {
  if (typeof v === 'string') out.push({ donde, texto: v });
  else if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) cadenas(x, `${donde}[${i}]`, out);
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) cadenas(x, `${donde}.${k}`, out);
  }
}

/**
 * Cadenas visibles de un objeto del catálogo: las que cuelgan de claves
 * `es`, `en` o `ayuda` (a cualquier profundidad).
 * @param {unknown} v @param {string} donde @param {Texto[]} out
 * @param {Set<object>} vistos
 */
function visiblesCatalogo(v, donde, out, vistos = new Set()) {
  if (!v || typeof v !== 'object') return;
  if (vistos.has(v)) return;
  vistos.add(v);
  const entradas = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.entries(v);
  for (const [k, x] of entradas) {
    const aqui = Array.isArray(v) ? `${donde}[${k}]` : `${donde}.${k}`;
    if ((k === 'es' || k === 'en' || k === 'ayuda') && typeof x === 'string') {
      out.push({ donde: aqui, texto: x });
    } else if (k === 'ayuda' && x && typeof x === 'object') {
      cadenas(x, aqui, out);
    } else {
      visiblesCatalogo(x, aqui, out, vistos);
    }
  }
}

/** @returns {Texto[]} */
function textosI18n() {
  /** @type {Texto[]} */
  const out = [];
  for (const f of jsonsDe(path.join(RAIZ, 'src', 'i18n'))) {
    cadenas(JSON.parse(fs.readFileSync(f, 'utf8')), path.relative(RAIZ, f), out);
  }
  return out;
}

/** @returns {Texto[]} */
function textosOpciones() {
  /** @type {Texto[]} */
  const out = [];
  for (const [nombre, v] of Object.entries(opciones)) {
    if (typeof v === 'object') visiblesCatalogo(v, `opciones.${nombre}`, out);
  }
  return out;
}

/** @returns {Texto[]} */
function textosFabrica() {
  /** @type {Texto[]} */
  const out = [];
  for (const f of jsonsDe(path.join(RAIZ, 'engine', 'escenarios', 'fabrica'))) {
    const esc = JSON.parse(fs.readFileSync(f, 'utf8'));
    const donde = path.relative(RAIZ, f);
    for (const campo of ['nombre', 'descripcion', 'etiquetas']) {
      cadenas(esc[campo], `${donde}.${campo}`, out);
    }
  }
  return out;
}

/** @param {Texto[]} textos */
function prohibidos(textos) {
  return textos
    .filter((t) => PROHIBIDO.some((re) => re.test(t.texto)) && !LISTA_BLANCA.has(t.donde))
    .map((t) => `${t.donde}: ${t.texto}`);
}

test('el recorrido encuentra textos en las tres fuentes', () => {
  const i18n = textosI18n();
  const ops = textosOpciones();
  const fab = textosFabrica();
  assert.ok(i18n.length > 100, `i18n: ${i18n.length}`);
  assert.ok(ops.length > 100, `opciones: ${ops.length}`);
  assert.ok(fab.length >= 14, `fábrica: ${fab.length}`);
  // Llega a las ayudas y a las opciones de enum de los controles básicos.
  assert.ok(ops.some((t) => /CONTROLES_BASICOS\[\d+\]\.ayuda\.es$/.test(t.donde)));
  assert.ok(ops.some((t) => /CONTROLES_BASICOS\[\d+\]\.opciones\[\d+\]\.en$/.test(t.donde)));
  assert.ok(ops.some((t) => /BASES\.f1\.ayuda\.es$/.test(t.donde)));
});

test('los textos de src/i18n no mencionan el original ni VB6', () => {
  assert.deepEqual(prohibidos(textosI18n()), []);
});

test('los textos del catálogo de opciones no mencionan el original ni VB6', () => {
  assert.deepEqual(prohibidos(textosOpciones()), []);
});

test('los escenarios de fábrica no mencionan el original ni VB6', () => {
  assert.deepEqual(prohibidos(textosFabrica()), []);
});

test('la lista blanca solo tiene entradas justificadas y vigentes', () => {
  const todos = new Map(
    [...textosI18n(), ...textosOpciones(), ...textosFabrica()].map((t) => [t.donde, t.texto]),
  );
  for (const [donde, motivo] of LISTA_BLANCA) {
    assert.ok(motivo.trim().length > 10, `sin justificación: ${donde}`);
    const texto = todos.get(donde);
    assert.ok(texto !== undefined, `la lista blanca apunta a un texto que no existe: ${donde}`);
    assert.ok(
      PROHIBIDO.some((re) => re.test(texto)),
      `entrada innecesaria en la lista blanca: ${donde}`,
    );
  }
});

test('el detector reconoce las menciones prohibidas', () => {
  const casos = [
    'Como el original',
    'The ORIGINAL settings',
    'the original’s sizes',
    'Igual que en VB6',
    'Visual Basic 6',
  ];
  for (const c of casos) {
    assert.equal(prohibidos([{ donde: 'x', texto: c }]).length, 1, c);
  }
  for (const c of ['Originalidad', 'originales', 'Campo F1']) {
    assert.equal(prohibidos([{ donde: 'x', texto: c }]).length, 0, c);
  }
});
