// @ts-check
// Experimentar en modo avanzado (paso N3.7, decisión 14): todos los
// parámetros una vez, buscador, vuelta a la base por parámetro y por grupo,
// validación, coherencia básico ↔ avanzado sobre el mismo borrador y el modo
// recordado.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESCENARIOS_FABRICA, escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { validar } from '../engine/escenarios/index.js';
import { GRUPOS, PARAMETROS, parametro } from '../engine/opciones.js';
import {
  CLAVE_MODO,
  clavesDeGrupo,
  coincideBusqueda,
  escribirParametro,
  gruposAvanzado,
  guardarModo,
  leerModo,
  numeroDeTexto,
  resumenGrupos,
  valorBase,
  volverABase,
} from '../src/lib/experimentar/avanzado.js';
import {
  borradorDe,
  controlBasico,
  escribirControl,
  leerControl,
  pendientes,
} from '../src/lib/experimentar/borrador.js';

/**
 * @typedef {import('../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../engine/opciones.js').Parametro} Parametro
 */

/** @param {string} id */
const fab = (id) => {
  const e = escenarioFabrica(id);
  assert.ok(e, id);
  return borradorDe(e);
};
/** @param {string} id */
const ctl = (id) => {
  const c = controlBasico(id);
  assert.ok(c, id);
  return c;
};
/** @param {Escenario} b @param {string} clave */
const fila = (b, clave) => {
  const f = gruposAvanzado(b, null)
    .flatMap((g) => g.filas)
    .find((x) => x.p.clave === clave);
  assert.ok(f, clave);
  return f;
};
/** @param {Escenario} b @param {string} clave @param {unknown} v */
const poner = (b, clave, v) => {
  const r = escribirParametro(b, clave, v);
  assert.ok(r.ok, `${clave} = ${v}: ${r.ok ? '' : r.codigo}`);
  return r.borrador;
};

/**
 * Un valor válido distinto de `x` para el parámetro.
 * @param {Parametro} p @param {number} x
 */
function otroValor(p, x) {
  if (p.valor === 'bool') return x ? 0 : (p.on ?? 1);
  if (p.valor === 'enum') {
    const o = (p.valores ?? []).find((y) => y.v !== x);
    assert.ok(o, p.clave);
    return o.v;
  }
  const paso = p.paso ?? (p.valor === 'int' ? 1 : 0.001);
  const arriba = x + paso;
  if (p.max === undefined || arriba <= p.max) return arriba;
  return x - paso;
}

test('todos los parámetros del catálogo aparecen exactamente una vez', () => {
  for (const e of ESCENARIOS_FABRICA) {
    const b = borradorDe(e);
    const claves = gruposAvanzado(b, null).flatMap((g) => g.filas.map((f) => f.p.clave));
    assert.equal(claves.length, PARAMETROS.length, e.id);
    assert.equal(new Set(claves).size, claves.length, `${e.id}: repetidos`);
    assert.deepEqual([...claves].sort(), PARAMETROS.map((p) => p.clave).sort(), e.id);
  }
  // Grupos en el orden del catálogo, cada uno con sus parámetros.
  const b = fab('sopa-primordial');
  assert.deepEqual(
    gruposAvanzado(b, null).map((g) => g.id),
    GRUPOS.map((g) => g.id),
  );
  // Elegir un grupo muestra solo ese grupo; la unión de todos es el catálogo.
  const union = [];
  for (const g of GRUPOS) {
    const r = gruposAvanzado(b, null, { grupo: g.id });
    assert.deepEqual(
      r.map((x) => x.id),
      [g.id],
    );
    assert.deepEqual(
      r[0].filas.map((f) => f.p.clave),
      clavesDeGrupo(g.id),
    );
    union.push(...r[0].filas.map((f) => f.p.clave));
  }
  assert.deepEqual(union.sort(), PARAMETROS.map((p) => p.clave).sort());
  // El resumen lateral cuenta todos.
  assert.equal(
    resumenGrupos(b).reduce((n, g) => n + g.total, 0),
    PARAMETROS.length,
  );
});

test('el buscador encuentra por nombre en español, en inglés y por variable', () => {
  const b = fab('sopa-primordial');
  /** @param {string} q */
  const buscar = (q) =>
    gruposAvanzado(b, null, { q }).flatMap((g) => g.filas.map((f) => f.p.clave));
  // Español, sin distinguir tildes ni mayúsculas.
  assert.ok(buscar('viscosidad').includes('opt:15'));
  assert.ok(buscar('ENERGIA SOLAR').includes('base:maxEnergy'));
  assert.ok(buscar('Energía solar').includes('base:maxEnergy'));
  // Inglés.
  assert.ok(buscar('brownian').includes('opt:13'));
  assert.ok(buscar('Solar share').includes('base:maxEnergy'));
  // Variable del core.
  assert.deepEqual(buscar('SHOTCOST'), ['cost:23']);
  assert.ok(buscar('maxvelocity').includes('opt:11'));
  assert.ok(buscar('DisableMutations').includes('base:mutations'));
  // La búsqueda cruza grupos aunque haya uno elegido; sin coincidencias, nada.
  const r = gruposAvanzado(b, null, { grupo: 'campo', q: 'SHOTCOST' });
  assert.deepEqual(
    r.map((g) => g.id),
    ['costos'],
  );
  assert.deepEqual(buscar('zzz-no-existe'), []);
  // Cada parámetro se encuentra por su propia variable, su nombre es y en.
  for (const p of PARAMETROS) {
    for (const q of [p.variable, p.es, p.en]) {
      assert.ok(coincideBusqueda(p, q), `${p.clave} por «${q}»`);
      assert.ok(buscar(q).includes(p.clave), `${p.clave} por «${q}»`);
    }
  }
});

test('↺ vuelve cada parámetro editable a la base', () => {
  for (const id of ['sopa-primordial', 'partido-f1']) {
    const b0 = fab(id);
    for (const p of PARAMETROS) {
      if (p.derivado) continue;
      const base = valorBase(b0.opciones.base, p.clave);
      const actual = fila(b0, p.clave).valor;
      const b1 = poner(b0, p.clave, otroValor(p, actual));
      const f1 = fila(b1, p.clave);
      if (Object.is(actual, base)) assert.ok(f1.cambiado, `${id} ${p.clave} cambiado`);
      const b2 = volverABase(b1, [p.clave]);
      const f2 = fila(b2, p.clave);
      assert.equal(f2.valor, base, `${id} ${p.clave}`);
      assert.equal(f2.cambiado, false, `${id} ${p.clave}`);
      assert.deepEqual(validar(b2), [], `${id} ${p.clave}: borrador válido`);
    }
  }
});

test('↺ de un grupo vuelve todo el grupo a la base (acopladas incluidas)', () => {
  for (const id of ['sopa-primordial', 'partido-f1']) {
    for (const g of GRUPOS) {
      let b = fab(id);
      const limpio = b.opciones.cambios;
      for (const p of PARAMETROS.filter((x) => x.grupo === g.id && !x.derivado))
        b = poner(b, p.clave, otroValor(p, fila(b, p.clave).valor));
      const antes = gruposAvanzado(b, null, { grupo: g.id })[0];
      assert.ok(antes.cambiados > 0, `${id} ${g.id}`);
      b = volverABase(b, clavesDeGrupo(g.id));
      const r = gruposAvanzado(b, null, { grupo: g.id })[0];
      assert.equal(r.cambiados, 0, `${id} ${g.id}`);
      for (const f of r.filas) assert.equal(f.valor, f.base, `${id} ${f.p.clave}`);
      // Los cambios que el escenario traía fuera del grupo siguen.
      for (const [k, v] of Object.entries(limpio))
        if (parametro(k)?.grupo !== g.id) assert.equal(b.opciones.cambios[k], v, `${id} ${k}`);
    }
  }
  // 97 arrastra 101: volver el grupo deja los dos en la base.
  let b = fab('sopa-primordial');
  b = poner(b, 'opt:97', 9);
  b = poner(b, 'opt:101', 3);
  assert.equal(fila(b, 'opt:101').valor, 3);
  b = volverABase(b, clavesDeGrupo('modos'));
  assert.deepEqual(b.opciones.cambios, fab('sopa-primordial').opciones.cambios);
});

test('validación con normalizarValor: el borrador no cambia con un valor inválido', () => {
  const b = fab('sopa-primordial');
  /** @param {string} k @param {unknown} v */
  const codigo = (k, v) => {
    const r = escribirParametro(b, k, v);
    assert.equal(r.ok, false, `${k} = ${v}`);
    return r.ok ? '' : r.codigo;
  };
  assert.equal(codigo('opt:34', 40000), 'valor-rango'); // i16 del core
  assert.equal(codigo('base:repopAmount', -40000), 'valor-rango');
  assert.equal(codigo('base:fieldW', 3e6), 'valor-rango'); // el campo conserva su tope
  assert.equal(codigo('opt:34', 1.5), 'valor-tipo');
  assert.equal(codigo('opt:34', 'abc'), 'valor-tipo');
  assert.equal(codigo('opt:53', 1), 'valor-enum');
  assert.equal(codigo('cost:51', 7), 'valor-tipo');
  assert.equal(codigo('opt:1', 1), 'clave-derivada');
  assert.equal(codigo('opt:9999', 1), 'clave-desconocida');
  // Bool: true/false y, si el core lee ≠ 0, cualquier número.
  assert.equal(fila(poner(b, 'opt:10', true), 'opt:10').valor, 1);
  assert.equal(fila(poner(b, 'cost:56', true), 'cost:56').valor, -1);
  assert.equal(fila(poner(b, 'cost:56', 5), 'cost:56').valor, -1);
  // Entrada de texto: coma decimal y vacío.
  assert.equal(numeroDeTexto('0,5'), 0.5);
  assert.equal(numeroDeTexto(' 1e-7 '), 1e-7);
  assert.equal(numeroDeTexto(''), null);
  assert.equal(numeroDeTexto('x'), null);
});

test('derivado visible con su valor efectivo y no editable', () => {
  let b = fab('sopa-primordial');
  assert.equal(fila(b, 'opt:1').valor, 0);
  assert.equal(fila(b, 'opt:1').editable, false);
  b = poner(b, 'opt:2', 1);
  b = poner(b, 'opt:3', 1);
  assert.equal(fila(b, 'opt:1').valor, 1);
  assert.equal(leerControl(ctl('bordes'), b), 'toroidal');
  // En la base F1 (toroidal) vale 1 y no cuenta como cambiado.
  const f1 = fab('partido-f1');
  assert.equal(fila(f1, 'opt:1').valor, 1);
  assert.equal(fila(f1, 'opt:1').cambiado, false);
});

test('coherencia básico ↔ avanzado sobre el mismo borrador', () => {
  // Un costo cambiado en avanzado pone «Costos: personalizados» en el básico.
  let b = fab('sopa-primordial');
  const costos = ctl('costos');
  assert.equal(leerControl(costos, b), 'ninguno');
  b = poner(b, 'cost:23', 5);
  assert.equal(leerControl(costos, b), 'personalizado');
  assert.deepEqual(b.opciones.cambios, { 'cost:23': 5 });
  // Y volverlo a la base lo deja en «Sin costos».
  b = volverABase(b, ['cost:23']);
  assert.equal(leerControl(costos, b), 'ninguno');
  assert.deepEqual(b.opciones.cambios, {});
  // Con base F1 igual: un costo tocado deja de ser F1.
  let f = fab('partido-f1');
  assert.equal(leerControl(costos, f), 'f1');
  f = poner(f, 'cost:23', 3);
  assert.equal(leerControl(costos, f), 'personalizado');

  // Del básico al avanzado: «Medio: fluido» se ve en los parámetros.
  b = escribirControl(fab('sopa-primordial'), ctl('medio'), 'fluido');
  assert.equal(fila(b, 'opt:14').valor, 1e-7);
  assert.equal(fila(b, 'opt:14').cambiado, true);
  assert.equal(fila(b, 'opt:15').valor, 0.0005);
  // Y un parámetro del medio cambiado en avanzado lo vuelve «personalizado».
  b = poner(b, 'opt:15', 0.001);
  assert.equal(leerControl(ctl('medio'), b), 'personalizado');
  // Día y noche: el control compuesto lee los dos parámetros.
  b = poner(b, 'opt:33', 1);
  b = poner(b, 'opt:34', 700);
  assert.equal(leerControl(ctl('dia-noche'), b), 700);
  b = escribirControl(b, ctl('dia-noche'), 0);
  assert.equal(fila(b, 'opt:33').valor, 0);
  // Mutaciones (bool nombrada) en los dos sentidos.
  b = poner(b, 'base:mutations', false);
  assert.equal(leerControl(ctl('mutaciones'), b), false);
  b = escribirControl(b, ctl('mutaciones'), true);
  assert.equal(fila(b, 'base:mutations').valor, 1);
});

test('«sin aplicar» contra la referencia y pendientes de lo cambiado en avanzado', () => {
  const ref = fab('sopa-primordial');
  let b = poner(ref, 'opt:11', 60);
  b = poner(b, 'base:fieldW', 16000);
  const f = gruposAvanzado(b, ref)
    .flatMap((g) => g.filas)
    .filter((x) => x.sinAplicar)
    .map((x) => x.p.clave)
    .sort();
  assert.deepEqual(f, ['base:fieldW', 'opt:11']);
  // Sin referencia no hay nada sin aplicar.
  assert.ok(gruposAvanzado(b, null).every((g) => g.filas.every((x) => !x.sinAplicar)));
  // «Aplicar a la actual» manda solo lo vivo; el campo requiere nueva (C12).
  const pend = pendientes(b, ref, 'es', (k) => k);
  assert.deepEqual(
    pend.otros.map((o) => o.clave),
    ['opt:11'],
  );
  assert.deepEqual(pend.diff.mensajes, [{ t: 'setopt', id: 11, v: 60 }]);
  assert.equal(pend.requiereNueva, true);
  // «Solo cambiados» filtra por diferencia con la base.
  const solo = gruposAvanzado(b, null, { soloCambiados: true }).flatMap((g) =>
    g.filas.map((x) => x.p.clave),
  );
  assert.deepEqual(solo.sort(), ['base:fieldW', 'opt:11']);
});

test('el modo se recuerda y sin almacenamiento vale básico', () => {
  /** @type {Map<string, string>} */
  const m = new Map();
  const almacen = {
    getItem: (/** @type {string} */ k) => m.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => void m.set(k, v),
  };
  assert.equal(leerModo(almacen), 'basico');
  guardarModo(almacen, 'avanzado');
  assert.equal(m.get(CLAVE_MODO), 'avanzado');
  assert.equal(leerModo(almacen), 'avanzado');
  m.set(CLAVE_MODO, 'raro');
  assert.equal(leerModo(almacen), 'basico');
  const roto = {
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
  };
  assert.equal(leerModo(roto), 'basico');
  assert.doesNotThrow(() => guardarModo(roto, 'avanzado'));
  assert.equal(leerModo(null), 'basico');
  assert.doesNotThrow(() => guardarModo(undefined, 'basico'));
});
