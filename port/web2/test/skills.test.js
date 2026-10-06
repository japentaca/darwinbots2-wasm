// @ts-check
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINO, leerArbol, ORIGEN } from '../scripts/sincronizar-skills.mjs';

test('.claude/skills es copia exacta de .agents/skills', () => {
  const origen = leerArbol(ORIGEN);
  const destino = leerArbol(DESTINO);
  assert.ok(origen.size > 0, 'no hay skills en .agents/skills');
  assert.deepEqual(
    [...destino.keys()].sort(),
    [...origen.keys()].sort(),
    'correr node port/web2/scripts/sincronizar-skills.mjs',
  );
  for (const [rel, contenido] of origen) {
    assert.ok(contenido.equals(/** @type {Buffer} */ (destino.get(rel))), `${rel} difiere`);
  }
});

test('cada skill tiene name igual a su carpeta y description', () => {
  for (const [rel, contenido] of leerArbol(ORIGEN)) {
    if (!rel.endsWith('/SKILL.md')) continue;
    const texto = contenido.toString('utf8');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(texto);
    assert.ok(fm, `${rel}: falta el frontmatter`);
    const carpeta = rel.split('/')[0];
    assert.match(fm[1], new RegExp(`^name: ${carpeta}$`, 'm'), `${rel}: name`);
    assert.match(fm[1], /^description: \S/m, `${rel}: description`);
  }
});
