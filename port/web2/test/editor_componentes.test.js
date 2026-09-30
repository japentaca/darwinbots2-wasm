// @ts-check
// Los componentes del editor de ADN (src/lib/bots/editor/*.svelte) compilan
// sin errores ni advertencias (accesibilidad incluida). Hasta que la ficha
// del bot los monte, el build de Vite no los recorre: este test sí.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';

const DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'lib',
  'bots',
  'editor',
);

test('los componentes del editor compilan sin advertencias', () => {
  const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.svelte'));
  assert.ok(archivos.includes('Editor.svelte'));
  for (const f of archivos) {
    const p = path.join(DIR, f);
    const r = compile(fs.readFileSync(p, 'utf8'), { filename: p });
    assert.deepEqual(
      r.warnings.map((w) => `${w.code}: ${w.message}`),
      [],
      f,
    );
  }
});
