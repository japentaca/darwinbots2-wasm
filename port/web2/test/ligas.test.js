// @ts-check
// Catálogo de ligas (engine/ligas.js, paso L2.1 de PLAN-LIGAS.md): los siete
// ids, cada escenario de la liga existente en el catálogo de fábrica, la
// liga de un escenario y la de unas reglas (también las viejas, sin `liga`),
// y que los avisos sean claves de capacidad reales.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { LIGAS, ligaDeEscenario, ligaDeReglas, ligaPorId } from '../engine/ligas.js';
import { CAPS } from '../src/lib/bots/textos.js';

const IDS = ['f1', 'f2', 'f3', 'mb', 'sb', 'ss', 'f4'];

test('el catálogo tiene las siete ligas, una por id, y está congelado', () => {
  assert.deepEqual(LIGAS.map((l) => l.id).sort(), [...IDS].sort());
  assert.equal(new Set(LIGAS.map((l) => l.id)).size, 7);
  assert.ok(Object.isFrozen(LIGAS));
  for (const l of LIGAS) {
    assert.ok(Object.isFrozen(l), `${l.id} congelada`);
    assert.ok(Object.isFrozen(l.etiquetas) && Object.isFrozen(l.avisos));
  }
});

test('cada liga apunta a un escenario de fábrica que existe', () => {
  for (const l of LIGAS) {
    assert.equal(l.escenario, `partido-${l.id}`);
    assert.ok(escenarioFabrica(l.escenario), `${l.escenario} está en el catálogo`);
  }
});

test('los avisos son claves de capacidad de CAPS', () => {
  for (const l of LIGAS) {
    for (const a of l.avisos) {
      assert.ok(CAPS.includes(a), `${l.id}: «${a}» no es una capacidad`);
    }
  }
});

test('ligaPorId devuelve la liga o null', () => {
  for (const id of IDS) assert.equal(ligaPorId(id)?.id, id);
  assert.equal(ligaPorId('xx'), null);
  assert.equal(ligaPorId(''), null);
});

test('ligaDeEscenario: cada escenario de liga da su liga; los demás, null', () => {
  for (const id of IDS) {
    assert.equal(ligaDeEscenario(`partido-${id}`), ligaPorId(id));
  }
  assert.equal(ligaDeEscenario('sopa-primordial'), null);
  assert.equal(ligaDeEscenario('mi-escenario'), null);
});

test('ligaDeReglas: con liga explícita, la liga dicha', () => {
  const r = { liga: 'f2', escenario: { id: 'partido-f1' } };
  assert.equal(ligaDeReglas(r)?.id, 'f2');
});

test('ligaDeReglas: reglas viejas sin liga se deducen del escenario', () => {
  assert.equal(ligaDeReglas({ escenario: { id: 'partido-f1' } })?.id, 'f1');
  assert.equal(ligaDeReglas({ escenario: { id: 'partido-sb' } })?.id, 'sb');
});

test('ligaDeReglas: escenario propio, sin datos o nulo → null', () => {
  assert.equal(ligaDeReglas({ escenario: { id: 'mi-escenario' } }), null);
  assert.equal(ligaDeReglas({}), null);
  assert.equal(ligaDeReglas(null), null);
  assert.equal(ligaDeReglas(undefined), null);
});

test('valores de D2, D3 y D7: forma, formato y boards', () => {
  assert.deepEqual(ligaPorId('sb')?.forma, { maxGenes: 6 });
  assert.deepEqual(ligaPorId('ss')?.forma, { maxStores: 1 });
  assert.deepEqual(ligaPorId('f4')?.fmt, { capMode: 'nrg', popCap: 100 });
  assert.equal(ligaPorId('f1')?.boards, null);
  assert.equal(ligaPorId('f4')?.boards, null);
  assert.deepEqual(ligaPorId('f2')?.boards, ['F2 bots', 'F3 bots']);
  assert.deepEqual(ligaPorId('ss')?.boards, ['Single store']);
  assert.equal(ligaPorId('f1')?.fmt, null);
});
