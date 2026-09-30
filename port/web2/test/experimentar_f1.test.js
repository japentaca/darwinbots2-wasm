// @ts-check
// Revisión de Experimentar avanzado (N3.7):
//  - «Ajustes F1» sobre el borrador = applyF1Settings() de la clásica sobre
//    su panel (con cambios previos del usuario), comparado con
//    collectOptions() como en test/paridad_base.test.js, con las mismas dos
//    diferencias documentadas (opt:1 y los costos que el panel no muestra,
//    que la clásica manda en vivo);
//  - «Cambiar base»: la base nueva fija sus valores; especies, objetos y los
//    cambios en parámetros que la base no fija siguen;
//  - borradorDe respeta un .json editado a mano con 101 antes que 97 (el
//    reset los manda por id: 97 y después 101);
//  - ayudas del avanzado: presets de grupo, aviso de lo inusual, saturación.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { normalizar, resolverOpciones } from '../engine/escenarios/index.js';
import {
  BASES,
  CONTROLES_BASICOS,
  opcionesReset,
  valorEfectivo,
  valoresResueltos,
} from '../engine/opciones.js';
import {
  escribirParametro,
  gruposAvanzado,
  PRESETS_GRUPO,
  presetsDeGrupo,
  totalFilas,
} from '../src/lib/experimentar/avanzado.js';
import {
  borradorDe,
  cambiarBase,
  conAjustesF1,
  efectivos,
  escribirCambios,
} from '../src/lib/experimentar/borrador.js';
import { clasica, plano } from './util/clasica-vm.js';

/** @typedef {import('../engine/escenarios/index.js').Escenario} Escenario */

/** Escenario mínimo con una especie y un objeto. @param {string} base @param {Record<string, number>} [cambios] */
const esc = (base, cambios = {}) =>
  borradorDe(
    normalizar({
      formato: 1,
      id: 'x',
      nombre: 'x',
      opciones: { base, cambios },
      especies: [
        {
          bot: 'Alga_Minimalis',
          adn: 'cond start 1 1 store stop',
          cantidad: 7,
          color: '#2aa84f',
          vegetal: true,
          energia: 3000,
        },
      ],
      objetos: { obstaculos: [{ tipo: 'forma', ancho: 0.2, alto: 0.2 }], teleporters: [] },
    }),
  );

/** @param {Escenario} b @param {string} clave @param {number} v */
const poner = (b, clave, v) => {
  const r = escribirParametro(b, clave, v);
  assert.ok(r.ok, `${clave} = ${v}`);
  return r.borrador;
};

/**
 * Compara el reset de la nueva con collectOptions() de la clásica: opt:1 y
 * los costos que el panel no muestra son las diferencias documentadas.
 * @param {any} nueva @param {any} clas @param {Map<string, number>} envivo
 */
function igualQueClasica(nueva, clas, envivo) {
  assert.equal(nueva.opts[1], 1, 'Toroidal = True con los dos ejes conectados');
  assert.equal(clas.opts[1], undefined);
  delete nueva.opts[1];
  for (const i of Object.keys(nueva.costs))
    if (!(i in clas.costs)) {
      assert.equal(envivo.get(i), nueva.costs[i], `costo ${i}: el setcost en vivo de la clásica`);
      delete nueva.costs[i];
    }
  assert.deepStrictEqual(nueva, clas);
}

test('«Ajustes F1» = applyF1Settings() de la clásica, sin cambios previos', () => {
  const c = clasica();
  c.ev('applyF1Settings()');
  const clas = plano(c.ev('collectOptions()'));
  const envivo = new Map(
    c.enviados.filter((m) => m.t === 'setcost').map((m) => [String(m.i), m.v]),
  );
  const b = conAjustesF1(esc('clasica'));
  igualQueClasica(plano(opcionesReset(resolverOpciones(b))), clas, envivo);
  // mismos valores efectivos que la base F1 entera
  const f1 = valoresResueltos('f1');
  const ef = efectivos(b);
  for (const k of Object.keys(f1)) assert.equal(ef(k), valorEfectivo(f1, k), k);
});

test('«Ajustes F1» sobre cambios del usuario: pisa lo de liga y conserva el resto', () => {
  const c = clasica();
  const toques = /** @type {[string, string, any][]} */ ([
    // id de la clásica, clave de la nueva, valor
    ['o-34', 'opt:34', 800], // no es de liga: queda
    ['o-33', 'opt:33', true], // de liga (0): se pisa
    ['o-11', 'opt:11', 60], // de liga (180): se pisa
    ['o-c24', 'cost:24', 0.5], // costo sin valor de liga: 0
    ['o-c30', 'cost:30', 7], // costo de liga: 0.00001
    ['o-startChlr', 'base:startChlr', 9000], // no es de liga: queda
    ['o-32', 'opt:32', 1.5], // no es de liga: queda
    ['o-97', 'opt:97', 9], // no es de liga: queda
  ]);
  c.tocar(toques.map(([id, , v]) => [id, v]));
  c.ev('applyF1Settings()');
  const clas = plano(c.ev('collectOptions()'));
  const envivo = new Map(
    c.enviados.filter((m) => m.t === 'setcost').map((m) => [String(m.i), m.v]),
  );
  let b = esc('clasica');
  for (const [, k, v] of toques) b = poner(b, k, typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const antes = b;
  b = conAjustesF1(b);
  igualQueClasica(plano(opcionesReset(resolverOpciones(b))), clas, envivo);
  const ef = efectivos(b);
  assert.equal(ef('opt:34'), 800);
  assert.equal(ef('opt:33'), 0);
  assert.equal(ef('opt:11'), 180);
  assert.equal(ef('cost:24'), 0);
  assert.equal(ef('cost:30'), 0.00001);
  assert.equal(ef('base:startChlr'), 9000);
  assert.equal(ef('base:fieldW'), 9237);
  assert.equal(ef('opt:1'), 1);
  assert.equal(ef('base:mutations'), 0);
  // especies y objetos intactos (lo de la especie de F1 va en el escenario)
  assert.deepEqual(b.especies, antes.especies);
  assert.deepEqual(b.objetos, antes.objetos);
  assert.equal(b.opciones.base, 'clasica');
  // idempotente
  assert.deepEqual(conAjustesF1(b), b);
});

test('«Cambiar base»: la base nueva fija sus valores; lo demás sigue', () => {
  let b = esc('clasica');
  b = poner(b, 'opt:34', 800); // la clásica lo fija: pasa al de F1 (500)
  b = poner(b, 'opt:39', 1); // ninguna base lo fija: sigue
  b = poner(b, 'opt:101', 3); // ninguna lo fija: sigue aunque la base fije 97
  const f = cambiarBase(b, 'f1');
  assert.equal(f.opciones.base, 'f1');
  const ef = efectivos(f);
  const f1 = valoresResueltos('f1');
  for (const k of Object.keys(f1)) assert.equal(ef(k), valorEfectivo(f1, k), k);
  assert.equal(ef('opt:39'), 1);
  assert.equal(ef('opt:101'), 3);
  assert.deepEqual(f.opciones.cambios, { 'opt:39': 1, 'opt:101': 3 });
  assert.deepEqual(f.especies, b.especies);
  assert.deepEqual(f.objetos, b.objetos);
  // y de vuelta
  const c = cambiarBase(f, 'clasica');
  assert.equal(c.opciones.base, 'clasica');
  const ec = efectivos(c);
  const cl = valoresResueltos('clasica');
  for (const k of Object.keys(cl)) assert.equal(ec(k), valorEfectivo(cl, k), k);
  assert.equal(ec('opt:101'), 3);
  // misma base o base desconocida: nada
  assert.equal(cambiarBase(b, 'clasica'), b);
  assert.equal(cambiarBase(b, 'marte'), b);
  assert.ok(Object.keys(BASES).length >= 2);
});

test('borradorDe respeta 101 antes que 97 en un .json editado a mano', () => {
  // El reset manda por id (97, que escribe también 101, y después 101):
  // la sim queda con MinRounds 9 y optMinRounds 3.
  const e = esc('clasica', { 'opt:101': 3, 'opt:97': 9 });
  const r = opcionesReset(resolverOpciones(e));
  assert.deepEqual(
    Object.keys(r.opts).map(Number).indexOf(97) < Object.keys(r.opts).map(Number).indexOf(101),
    true,
  );
  const ef = efectivos(e);
  assert.equal(ef('opt:97'), 9);
  assert.equal(ef('opt:101'), 3);
  assert.deepEqual(e.opciones.cambios, { 'opt:97': 9, 'opt:101': 3 });
  // y escribir otra cosa no lo pierde
  const e2 = escribirCambios(e, { 'opt:34': 700 });
  assert.equal(efectivos(e2)('opt:101'), 3);
  // escribir 97 después sí lo arrastra (como la sim en vivo)
  assert.equal(efectivos(poner(e, 'opt:97', 4))('opt:101'), 4);
});

test('avanzado: presets de grupo, aviso de lo inusual y saturación', () => {
  const ids = new Set(CONTROLES_BASICOS.map((c) => c.id));
  for (const [g, cs] of Object.entries(PRESETS_GRUPO))
    for (const c of cs) assert.ok(ids.has(c), `${g}: ${c}`);
  assert.deepEqual(presetsDeGrupo('campo'), ['tamano']);
  assert.deepEqual(presetsDeGrupo('fisica'), ['medio']);
  assert.deepEqual(presetsDeGrupo('luz'), []);
  const e = escenarioFabrica('sopa-primordial');
  assert.ok(e);
  let b = borradorDe(e);
  b = poner(b, 'opt:20', -1);
  const fila = gruposAvanzado(b, null)
    .flatMap((g) => g.filas)
    .find((f) => f.p.clave === 'opt:20');
  assert.equal(fila?.inusual, true);
  assert.equal(fila?.valor, -1);
  const s = escribirParametro(b, 'opt:36', 3e9);
  assert.ok(s.ok);
  assert.equal(s.aviso, 'valor-saturado');
  assert.equal(s.v, 2147483647);
  assert.equal(efectivos(s.borrador)('opt:36'), 2147483647);
  const g = gruposAvanzado(b, null, { q: 'gravedad' });
  assert.equal(
    totalFilas(g),
    g.reduce((n, x) => n + x.filas.length, 0),
  );
  assert.ok(totalFilas(g) >= 2);
});
