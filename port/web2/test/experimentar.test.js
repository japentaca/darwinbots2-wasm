// @ts-check
// Experimentar en modo básico (paso N1.5): borrador ↔ controles compuestos,
// marca de «cambiado», clasificación vivo / requiere nueva (C12), especies,
// objetos, semilla, escenarios propios (almacén en memoria) e
// import/export con errores traducibles por código.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { almacenMemoria, ErrorAlmacen } from '../engine/almacen.js';
import { escenarioFabrica, IDS_FABRICA } from '../engine/escenarios/fabrica.js';
import { diff, ErrorEscenario, textoEn, validar } from '../engine/escenarios/index.js';
import { lgHash } from '../engine/league.js';
import { BASES, CONTROLES_BASICOS, costosF1, fueraDeLoUsual } from '../engine/opciones.js';
import {
  CODIGOS_ALMACEN,
  CODIGOS_VALIDACION,
  codigoError,
  comoPropio,
  duplicar,
  ERRORES_CONOCIDOS,
  exportarEscenario,
  idLibre,
  importarEscenario,
  mensajeError,
  parsearEtiquetas,
  textoValidacion,
} from '../src/lib/experimentar/archivo.js';
import {
  agregarEspecie,
  borradorDe,
  cambiarEspecie,
  cambiosVivos,
  clavePlural,
  colorLibre,
  controlBasico,
  controlCambiado,
  controlVivo,
  efectivos,
  escribirControl,
  especieCambiada,
  especieNueva,
  formaPlural,
  GRUPOS_BASICOS,
  leerControl,
  limpiarCambios,
  normalizarEntrada,
  opcionInerte,
  PALETA,
  PLURALES,
  parsearSemilla,
  pendientes,
  quitarEspecie,
  quitarObjetos,
  resumenObjetos,
  SEMILLA_MAX,
  semillaAleatoria,
  textoValor,
  tienePendientes,
  validarAdn,
  vbAHex,
} from '../src/lib/experimentar/borrador.js';
import { crearPropios } from '../src/lib/experimentar/propios.js';

/** @param {string} id */
const fab = (id) => {
  const e = escenarioFabrica(id);
  assert.ok(e, id);
  return e;
};
/** @param {string} id */
const ctl = (id) => {
  const c = controlBasico(id);
  assert.ok(c, id);
  return c;
};
/** Traductor falso: la clave y sus parámetros. @param {string} k @param {Record<string, any>} [p] */
const tr = (k, p) => (p ? `${k}${JSON.stringify(p)}` : k);

const ES = JSON.parse(
  readFileSync(new URL('../src/i18n/es/experimentar.json', import.meta.url), 'utf8'),
);
const EN = JSON.parse(
  readFileSync(new URL('../src/i18n/en/experimentar.json', import.meta.url), 'utf8'),
);

test('las tarjetas cubren cada control básico una sola vez', () => {
  const ids = GRUPOS_BASICOS.flatMap((g) => g.controles);
  assert.deepEqual([...ids].sort(), CONTROLES_BASICOS.map((c) => c.id).sort());
  assert.equal(new Set(ids).size, ids.length);
});

test('vivo / requiere nueva (C12): solo el tamaño del campo requiere sim nueva', () => {
  const nuevos = CONTROLES_BASICOS.filter((c) => !controlVivo(c)).map((c) => c.id);
  assert.deepEqual(nuevos, ['tamano']);
});

test('borradorDe copia, no toca el original y deja los cambios limpios', () => {
  const e = fab('depredador-y-presa');
  const b = borradorDe(e);
  assert.notEqual(b, e);
  assert.deepEqual(b.opciones.cambios, { 'base:maxEnergy': 20 });
  b.especies[0].cantidad = 99;
  assert.equal(e.especies[0].cantidad, 25);
  // opt:1 (derivado) se reparte en los ejes; un cambio igual a la base desaparece.
  const sucio = {
    ...structuredClone(e),
    opciones: { base: 'clasica', cambios: { 'opt:1': 1, 'base:minVegs': 15, 'opt:50': 0 } },
  };
  assert.deepEqual(borradorDe(sucio).opciones.cambios, { 'opt:2': 1, 'opt:3': 1, 'opt:50': 0 });
});

test('limpiarCambios conserva 101 si difiere del 97 que lo arrastra', () => {
  assert.deepEqual(limpiarCambios('clasica', { 'opt:97': 7, 'opt:101': 7 }), { 'opt:97': 7 });
  assert.deepEqual(limpiarCambios('clasica', { 'opt:97': 7, 'opt:101': 3 }), {
    'opt:97': 7,
    'opt:101': 3,
  });
});

test('controles compuestos: leer y escribir ida y vuelta', () => {
  let b = borradorDe(fab('sopa-primordial'));
  const costos = ctl('costos');
  assert.equal(leerControl(costos, b), 'ninguno');
  b = escribirControl(b, costos, 'f1');
  assert.equal(leerControl(costos, b), 'f1');
  const ef = efectivos(b);
  for (const [k, v] of Object.entries(costosF1())) assert.equal(ef(k), v, k);
  // «Personalizados» no escribe nada: el mismo borrador.
  assert.equal(escribirControl(b, costos, 'personalizado'), b);
  b = escribirControl(b, costos, 'ninguno');
  assert.deepEqual(b.opciones.cambios, {}, 'volver a la base deja el borrador limpio');

  const bordes = ctl('bordes');
  b = escribirControl(b, bordes, 'toroidal');
  assert.equal(leerControl(bordes, b), 'toroidal');
  assert.equal(efectivos(b)('opt:1'), 1);
  b = escribirControl(b, bordes, 'cilindro-h');
  assert.deepEqual(b.opciones.cambios, { 'opt:3': 1 });

  const medio = ctl('medio');
  b = escribirControl(b, medio, 'solido');
  assert.equal(leerControl(medio, b), 'solido');

  const dn = ctl('dia-noche');
  b = escribirControl(b, dn, 800);
  assert.equal(leerControl(dn, b), 800);
  b = escribirControl(b, dn, 0);
  assert.equal(leerControl(dn, b), 0);
  assert.equal(efectivos(b)('opt:33'), 0);

  const tam = ctl('tamano');
  b = escribirControl(b, tam, 1);
  assert.equal(leerControl(tam, b), 1);
  assert.deepEqual([efectivos(b)('base:fieldW'), efectivos(b)('base:fieldH')], [9237, 6928]);

  const mut = ctl('mutaciones');
  b = escribirControl(b, mut, false);
  assert.equal(leerControl(mut, b), false);
  assert.equal(b.opciones.cambios['base:mutations'], 0);
  assert.deepEqual(validar(b), [], 'el borrador sigue siendo un escenario válido');
});

test('opciones inertes: las «personalizadas» no escriben', () => {
  const inertes = CONTROLES_BASICOS.flatMap((c) =>
    (c.opciones ?? []).filter((o) => opcionInerte(c, o.v)).map((o) => `${c.id}:${o.v}`),
  );
  assert.deepEqual(inertes, ['costos:personalizado', 'tamano:0', 'medio:personalizado']);
});

test('F1: la base f1 se lee como costos F1 y bordes toroidales', () => {
  const b = borradorDe(fab('partido-f1'));
  assert.equal(b.opciones.base, 'f1');
  assert.equal(leerControl(ctl('costos'), b), 'f1');
  assert.equal(leerControl(ctl('bordes'), b), 'toroidal');
  assert.equal(leerControl(ctl('tamano'), b), 1);
  assert.ok(BASES.f1);
});

test('marca de «cambiado» contra la referencia', () => {
  const ref = borradorDe(fab('sopa-primordial'));
  let b = borradorDe(ref);
  for (const c of CONTROLES_BASICOS) assert.equal(controlCambiado(c, b, ref), false, c.id);
  b = escribirControl(b, ctl('luz'), 77);
  assert.equal(controlCambiado(ctl('luz'), b, ref), true);
  assert.equal(controlCambiado(ctl('vegetales'), b, ref), false);
  assert.equal(controlCambiado(ctl('luz'), b, null), false, 'sin referencia no marca');
  b = escribirControl(b, ctl('luz'), efectivos(ref)('base:maxEnergy'));
  assert.equal(controlCambiado(ctl('luz'), b, ref), false);
});

test('normalizarEntrada: número, redondeo y rango', () => {
  const luz = ctl('luz');
  assert.equal(normalizarEntrada(luz, '12,6'), 13);
  // El rango es el del tipo del core (MaxEnergy es Long): fuera de lo
  // habitual vale (con aviso: fueraDeLoUsual); fuera del tipo, al tope.
  assert.equal(normalizarEntrada(luz, '-5'), -5);
  assert.equal(normalizarEntrada(luz, '1e9'), 1e9);
  assert.equal(normalizarEntrada(luz, '1e10'), luz.max);
  assert.equal(luz.max, 2147483647);
  assert.equal(fueraDeLoUsual(luz, 150000), true);
  assert.equal(fueraDeLoUsual(luz, 40), false);
  const dn = ctl('dia-noche');
  assert.equal(normalizarEntrada(dn, '40000'), 32767);
  assert.equal(fueraDeLoUsual(dn, 32500), true);
  assert.equal(normalizarEntrada(luz, 'x'), null);
  assert.equal(normalizarEntrada(luz, ''), null);
  assert.equal(normalizarEntrada({ valor: 'float', min: 0, max: 1 }, '0.25'), 0.25);
});

test('textoValor: opción en el idioma, sí/no y número', () => {
  assert.equal(textoValor(ctl('costos'), 'ninguno', 'es', tr), 'Sin costos');
  assert.equal(textoValor(ctl('costos'), 'ninguno', 'en', tr), 'No costs');
  assert.equal(textoValor(ctl('mutaciones'), true, 'es', tr), 'experimentar.valor.si');
  assert.equal(textoValor(ctl('mutaciones'), false, 'es', tr), 'experimentar.valor.no');
  assert.equal(textoValor(ctl('luz'), 40, 'es', tr), '40');
  assert.ok(textoValor(ctl('tamano'), 1, 'es', tr).includes('9237'));
});

test('pendientes: vivo por mensajes, tamaño/especies/objetos requieren nueva', () => {
  const actual = borradorDe(fab('sopa-primordial'));
  let b = borradorDe(actual);
  let p = pendientes(b, actual, 'es', tr);
  assert.equal(p.total, 0);
  assert.equal(p.hayVivo, false);
  assert.equal(p.requiereNueva, false);

  b = escribirControl(b, ctl('luz'), 55);
  b = escribirControl(b, ctl('costos'), 'f1');
  p = pendientes(b, actual, 'es', tr);
  assert.deepEqual(
    p.controles.map((c) => [c.id, c.vivo]),
    [
      ['costos', true],
      ['luz', true],
    ],
  );
  assert.equal(p.requiereNueva, false);
  assert.ok(p.hayVivo);
  assert.ok(p.diff.mensajes.some((m) => m.t === 'setbase' && m.vals.maxEnergy === 55));
  assert.ok(p.diff.mensajes.some((m) => m.t === 'setcost' && m.i === 23 && m.v === 2));
  const luz = p.controles.find((c) => c.id === 'luz');
  assert.ok(luz);
  assert.equal(luz.despues, '55');

  b = escribirControl(b, ctl('tamano'), 3);
  b = cambiarEspecie(b, 0, { cantidad: 3 });
  const conObj = {
    ...b,
    objetos: { obstaculos: [{ tipo: 'forma', ancho: 0.2, alto: 0.2 }], teleporters: [] },
  };
  p = pendientes(conObj, actual, 'es', tr);
  assert.ok(p.requiereNueva);
  assert.ok(p.especies);
  assert.ok(p.objetos);
  const tam = p.controles.find((c) => c.id === 'tamano');
  assert.equal(tam?.vivo, false);
  assert.ok(p.diff.nueva.some((x) => x.que === 'parametro' && x.clave === 'base:fieldW'));
  // Los mensajes vivos no incluyen el tamaño.
  assert.ok(!p.diff.mensajes.some((m) => m.t === 'setbase' && 'fieldW' in m.vals));
});

test('pendientes: parámetros fuera de los controles básicos van en «otros»', () => {
  const actual = borradorDe(fab('sopa-primordial'));
  const b = { ...actual, opciones: { ...actual.opciones, cambios: { 'opt:11': 90 } } };
  const p = pendientes(b, actual, 'en', tr);
  assert.deepEqual(p.controles, []);
  assert.deepEqual(
    p.otros.map((o) => [o.clave, o.variable, o.antes, o.despues, o.vivo]),
    [['opt:11', 'MaxVelocity', 40, 90, true]],
  );
  assert.equal(p.otros[0].nombre, 'Max speed');
});

test('cambiosVivos cuenta los cambios vivos que muestra la barra', () => {
  const actual = borradorDe(fab('sopa-primordial'));
  let b = escribirControl(borradorDe(actual), ctl('bordes'), 'toroidal');
  b = escribirControl(b, ctl('tamano'), 3);
  b = { ...b, opciones: { ...b.opciones, cambios: { ...b.opciones.cambios, 'opt:11': 90 } } };
  const p = pendientes(b, actual, 'es', tr);
  assert.equal(p.total, 3);
  // Bordes y MaxVelocity; el tamaño no es vivo. El diff puede tener más
  // escrituras (bordes escribe opt:1 y un eje), pero el aviso cuenta lo que se ve.
  assert.equal(cambiosVivos(p), 2);
});

test('tienePendientes: editado = con diferencias respecto de la foto', () => {
  const foto = borradorDe(fab('sopa-primordial'));
  assert.equal(tienePendientes(borradorDe(foto), foto), false, 'recién armado');
  const luz = escribirControl(borradorDe(foto), ctl('luz'), 77);
  assert.equal(tienePendientes(luz, foto), true, 'control vivo sin aplicar');
  assert.equal(tienePendientes(cambiarEspecie(foto, 0, { cantidad: 2 }), foto), true);
  const lab = borradorDe(fab('laberinto'));
  assert.equal(tienePendientes(quitarObjetos(lab), lab), true);
  // Tras aplicar, la foto es el efectivo de la corrida: ya no está editado.
  const d = diff(luz, foto);
  const efectivo = borradorDe({
    ...foto,
    opciones: {
      ...foto.opciones,
      cambios: {
        ...foto.opciones.cambios,
        ...Object.fromEntries(d.vivo.map((c) => [c.clave, c.despues])),
      },
    },
  });
  assert.equal(tienePendientes(luz, efectivo), false);
  // Lo que requiere sim nueva sigue pendiente aunque se aplique lo vivo.
  const tam = escribirControl(luz, ctl('tamano'), 3);
  assert.equal(tienePendientes(tam, efectivo), true);
  assert.equal(tienePendientes(foto, null), true, 'sin foto cuenta como editado');
});

test('especieCambiada compara por bot y hash, no por posición', () => {
  const ref = borradorDe(fab('depredador-y-presa'));
  const sin0 = quitarEspecie(ref, 0);
  for (const s of sin0.especies) assert.equal(especieCambiada(s, ref), false, s.bot);
  const cambiada = cambiarEspecie(sin0, 0, { cantidad: 1 });
  assert.equal(especieCambiada(cambiada.especies[0], ref), true);
  const adn = 'cond\nstart\nstop\nend\n';
  const nueva = especieNueva({ bot: 'X', cantidad: 1, color: '#000000', vegetal: false, adn });
  assert.equal(especieCambiada(nueva, ref), true, 'no está en la referencia');
  assert.equal(especieCambiada(nueva, null), false);
});

test('validarAdn: vacío, sin genes y válido (sin contar comentarios)', () => {
  assert.equal(validarAdn(''), 'vacio');
  assert.equal(validarAdn("  ' solo un comentario\n"), 'vacio');
  assert.equal(validarAdn('hola mundo 5 .up store'), 'sin-gen');
  assert.equal(validarAdn("' cond\n10 .up store"), 'sin-gen', 'cond en un comentario no cuenta');
  assert.equal(validarAdn('cond\n*.nrg 100 >\nstart\n10 .up store\nstop\nend'), '');
  assert.equal(validarAdn('START\r\n10 .up store\r\nSTOP'), '');
  assert.equal(validarAdn('start 10 .up store stop'), '');
});

test('colorLibre: el primero de la paleta sin usar; después rota', () => {
  assert.equal(colorLibre([]), PALETA[0]);
  assert.equal(colorLibre([PALETA[0].toUpperCase()]), PALETA[1]);
  const todos = [...PALETA, '#123456'];
  assert.equal(colorLibre(todos), PALETA[todos.length % PALETA.length]);
});

test('plurales: forma con Intl.PluralRules y claves .uno/.otros en es y en', () => {
  assert.equal(formaPlural(1, 'es'), 'uno');
  assert.equal(formaPlural(0, 'es'), 'otros');
  assert.equal(formaPlural(2, 'en'), 'otros');
  assert.equal(clavePlural('experimentar.cambiosBase', 1, 'en'), 'experimentar.cambiosBase.uno');
  for (const k of PLURALES) {
    for (const f of ['uno', 'otros']) {
      const c = `${k}.${f}`;
      assert.ok(Object.hasOwn(ES, c) && Object.hasOwn(EN, c), c);
      assert.ok(ES[c].includes('{n}') && EN[c].includes('{n}'), `${c} sin {n}`);
    }
    assert.ok(!Object.hasOwn(ES, k) && !Object.hasOwn(EN, k), `${k} sin plural`);
  }
});

test('aplicar vivo y registrar: tras aplicar, el diff contra el actual queda vacío', () => {
  const actual = borradorDe(fab('sopa-primordial'));
  let b = escribirControl(borradorDe(actual), ctl('bordes'), 'toroidal');
  b = escribirControl(b, ctl('repoblacion'), 4);
  const d = diff(b, actual);
  const cambios = Object.fromEntries(d.vivo.map((c) => [c.clave, c.despues]));
  // El «actual» tras el evento (lo que hace escenarioEfectivo) saneado por borradorDe.
  const despues = borradorDe({
    ...actual,
    opciones: { ...actual.opciones, cambios: { ...actual.opciones.cambios, ...cambios } },
  });
  assert.equal(pendientes(b, despues, 'es', tr).total, 0);
});

test('especies: cambiar, quitar y agregar (preset, ADN pegado, Bestiary)', () => {
  let b = borradorDe(fab('depredador-y-presa'));
  b = cambiarEspecie(b, 1, { cantidad: '0', color: '#ABCDEF' });
  assert.equal(b.especies[1].cantidad, 1);
  assert.equal(b.especies[1].color, '#abcdef');
  b = cambiarEspecie(b, 1, { cantidad: 99999, color: 'rojo' });
  assert.equal(b.especies[1].cantidad, 10000);
  assert.equal(b.especies[1].color, '#abcdef');
  assert.equal(cambiarEspecie(b, 9, { cantidad: 2 }), b);

  const adn = 'cond\nstart\nstop\nend\n';
  const pegada = especieNueva({ bot: ' Mío ', cantidad: 4, color: '#FF0000', vegetal: false, adn });
  assert.deepEqual(pegada, {
    bot: 'Mío',
    origen: 'propio',
    cantidad: 4,
    color: '#ff0000',
    vegetal: false,
    energia: 3000,
    adn,
    hash: lgHash(adn),
  });
  const best = especieNueva({
    bot: 'Alga minimalis 3.0',
    cantidad: 10,
    color: '#30d030',
    vegetal: true,
    adnBestiario: adn,
  });
  assert.equal(best.origen, 'bestiario');
  assert.equal(best.adn, undefined);
  assert.equal(best.hash, lgHash(adn));
  b = agregarEspecie(agregarEspecie(b, pegada), best);
  assert.equal(b.especies.length, 4);
  assert.deepEqual(validar(b), []);
  b = quitarEspecie(b, 0);
  assert.equal(b.especies[0].bot, 'Zebedee V2.1 (F2)(Jez)-26.07.06');
  assert.equal(vbAHex(0x4040ff), '#ff4040');
});

test('objetos: resumen y quitar todo', () => {
  const lab = borradorDe(fab('laberinto'));
  const r = resumenObjetos(lab);
  assert.equal(r.vacio, false);
  assert.ok(r.laberintos.length + r.forma + r.formas + r.teleporters > 0);
  const vacio = quitarObjetos(lab);
  assert.deepEqual(resumenObjetos(vacio), {
    forma: 0,
    formas: 0,
    laberintos: [],
    teleporters: 0,
    vacio: true,
  });
});

test('semilla: aleatoria en rango y parseo estricto', () => {
  assert.equal(
    semillaAleatoria(() => 0),
    1,
  );
  assert.equal(
    semillaAleatoria(() => 0.9999999999),
    SEMILLA_MAX,
  );
  assert.equal(parsearSemilla(' 1234 '), 1234);
  for (const x of ['', '0', '-3', '1.5', 'abc', '2147483647', '99999999999'])
    assert.equal(parsearSemilla(x), null, x);
});

test('idLibre y etiquetas', () => {
  assert.equal(idLibre('Algas con marea'), 'algas-con-marea');
  assert.equal(idLibre('Día y noche', ['dia-y-noche-2']), 'dia-y-noche-3');
  assert.equal(idLibre('¡¡¡'), 'escenario');
  assert.ok(!IDS_FABRICA.includes(idLibre('sopa primordial')));
  assert.deepEqual(parsearEtiquetas(' a, b ,, a,c '), ['a', 'b', 'c']);
});

test('comoPropio y duplicar: id libre, nombre y validación', () => {
  const b = borradorDe(fab('sopa-primordial'));
  const r = comoPropio(b, { nombre: 'Mi sopa', descripcion: ' x ', etiquetas: ['t'] }, []);
  assert.ok(r.ok);
  assert.equal(r.escenario.id, 'mi-sopa');
  assert.equal(r.escenario.nombre, 'Mi sopa');
  assert.equal(r.escenario.descripcion, 'x');
  const mal = comoPropio(b, { nombre: '  ' }, []);
  assert.equal(mal.ok, false);
  assert.ok(!mal.ok && mal.errores.some((e) => e.codigo === 'nombre'));
  const reemplazo = comoPropio(b, { nombre: 'Otro', id: 'mi-sopa' });
  assert.ok(reemplazo.ok && reemplazo.escenario.id === 'mi-sopa');
  const nombreEn = textoEn(fab('laberinto').nombre, 'en');
  const idEn = idLibre(`${nombreEn} (copy)`);
  const d = duplicar(fab('laberinto'), 'en', ' (copy)', [idEn]);
  assert.equal(d.id, `${idEn}-2`, 'el id sale del nombre y no pisa uno ocupado');
  assert.equal(d.nombre, `${textoEn(fab('laberinto').nombre, 'en')} (copy)`);
  assert.deepEqual(d.objetos, fab('laberinto').objetos);
});

test('exportar e importar .json: ida y vuelta, renombrado y errores', () => {
  const b = borradorDe(fab('dia-y-noche'));
  const txt = exportarEscenario(b);
  assert.ok(txt.endsWith('\n'));
  const r = importarEscenario(txt, []);
  assert.ok(r.ok);
  assert.ok(r.renombrado, 'el id de fábrica se cambia por uno libre');
  assert.notEqual(r.escenario.id, 'dia-y-noche');
  assert.deepEqual(r.escenario.especies, b.especies);
  assert.deepEqual(r.escenario.opciones, b.opciones);

  const propio = comoPropio(b, { nombre: 'Mío' });
  assert.ok(propio.ok);
  const txt2 = exportarEscenario(propio.escenario);
  const r2 = importarEscenario(txt2, []);
  assert.ok(r2.ok && !r2.renombrado && r2.escenario.id === 'mio');
  const r3 = importarEscenario(txt2, ['mio']);
  assert.ok(r3.ok && r3.renombrado && r3.escenario.id === 'mio-2');

  const vacio = importarEscenario('  ');
  assert.ok(!vacio.ok && vacio.errores[0].codigo === 'vacio');
  const noJson = importarEscenario('{no');
  assert.ok(!noJson.ok && noJson.errores[0].codigo === 'json');
  const arr = importarEscenario('[]');
  assert.ok(!arr.ok && arr.errores[0].codigo === 'no-objeto');
  const malo = importarEscenario(
    JSON.stringify({ ...propio.escenario, opciones: { base: 'x', cambios: { 'opt:1': 1 } } }),
  );
  assert.ok(!malo.ok);
  assert.deepEqual(malo.errores.map((e) => e.codigo).sort(), ['base', 'clave-derivada']);
});

test('los códigos de validación del motor tienen texto en es y en', () => {
  const idx = readFileSync(new URL('../engine/escenarios/index.js', import.meta.url), 'utf8');
  const opc = readFileSync(new URL('../engine/opciones.js', import.meta.url), 'utf8');
  const delMotor = new Set([
    ...[...idx.matchAll(/mal\('([\w-]+)'/g)].map((m) => m[1]),
    ...[...opc.matchAll(/codigo: '([\w-]+)'/g)].map((m) => m[1]),
  ]);
  assert.ok(delMotor.size > 20);
  for (const c of delMotor) assert.ok(CODIGOS_VALIDACION.includes(c), `sin texto: ${c}`);
  for (const c of [...CODIGOS_VALIDACION, 'otro']) {
    assert.ok(Object.hasOwn(ES, `experimentar.validacion.${c}`), `es: ${c}`);
    assert.ok(Object.hasOwn(EN, `experimentar.validacion.${c}`), `en: ${c}`);
  }
  assert.equal(
    textoValidacion({ codigo: 'especie-cantidad', ruta: 'especies.0.cantidad' }, tr),
    'experimentar.validacion.especie-cantidad{"ruta":"especies.0.cantidad","detalle":""}',
  );
  assert.ok(
    textoValidacion({ codigo: 'rarisimo', ruta: '' }, tr).startsWith(
      'experimentar.validacion.otro',
    ),
  );
});

test('mensajeError: almacén, escenario, cuota y otros (claves que existen)', () => {
  const casos = [
    [new ErrorAlmacen('version-vieja'), 'experimentar.error.almacen.version-vieja'],
    [new ErrorAlmacen('sin-indexeddb'), 'experimentar.error.almacen.sin-indexeddb'],
    [new ErrorAlmacen('store-fuera-de-tx'), 'experimentar.error.otro'],
    [
      new ErrorEscenario('sin-adn', [{ codigo: 'sin-adn', ruta: 'especies.0', detalle: 'X' }]),
      'experimentar.error.sinAdn',
    ],
    [new ErrorEscenario('semilla'), 'experimentar.error.semilla'],
    [new ErrorEscenario('invalido'), 'experimentar.error.invalido'],
    [Object.assign(new Error('q'), { name: 'QuotaExceededError' }), 'experimentar.error.cuota'],
    ['cadena', 'experimentar.error.otro'],
    [new Error('sin escenario sopa-primordial'), 'experimentar.error.fabricaInexistente'],
    [new Error('de fábrica: laberinto'), 'experimentar.error.borrarFabrica'],
    [new Error('bots.json: 404'), 'experimentar.error.bestiario'],
    [new Error('Alga_Minimalis.txt: 500'), 'experimentar.error.bestiarioBot'],
  ];
  for (const [err, clave] of casos) {
    const m = mensajeError(err);
    assert.equal(m.clave, clave);
    assert.ok(Object.hasOwn(ES, m.clave) && Object.hasOwn(EN, m.clave), m.clave);
  }
  assert.deepEqual(mensajeError(casos[3][0]).params, { bot: 'X' });
  for (const c of CODIGOS_ALMACEN) assert.ok(Object.hasOwn(ES, `experimentar.error.almacen.${c}`));
  for (const [, c] of ERRORES_CONOCIDOS) {
    assert.ok(Object.hasOwn(ES, `experimentar.error.${c}`), c);
    assert.ok(Object.hasOwn(EN, `experimentar.error.${c}`), c);
  }
  assert.equal(codigoError('otra cosa'), '');
});

test('toda clave literal experimentar.* de la pantalla y sus partes existe en es y en', () => {
  const archivos = [
    '../src/screens/Experimentar.svelte',
    '../src/lib/experimentar/DialogoEspecie.svelte',
    '../src/lib/experimentar/DialogoEscenario.svelte',
    '../src/lib/experimentar/borrador.js',
    '../src/lib/experimentar/archivo.js',
  ];
  const faltan = [];
  let n = 0;
  for (const a of archivos) {
    const txt = readFileSync(new URL(a, import.meta.url), 'utf8');
    for (const m of txt.matchAll(/'(experimentar\.[\w.-]*[\w-])'/g)) {
      n++;
      const claves = PLURALES.includes(m[1]) ? [`${m[1]}.uno`, `${m[1]}.otros`] : [m[1]];
      for (const k of claves)
        if (!Object.hasOwn(ES, k) || !Object.hasOwn(EN, k)) faltan.push(`${k} (${a})`);
    }
  }
  assert.ok(n > 50);
  assert.deepEqual(faltan, []);
});

test('las claves armadas de la pantalla existen (grupos, objetos, origen)', () => {
  for (const o of ['fabrica', 'propio', 'borrador']) {
    assert.ok(
      Object.hasOwn(ES, `experimentar.origen.${o}`) &&
        Object.hasOwn(EN, `experimentar.origen.${o}`),
      o,
    );
  }
  for (const g of GRUPOS_BASICOS) {
    assert.ok(Object.hasOwn(ES, `experimentar.grupo.${g.id}`), g.id);
    assert.ok(Object.hasOwn(EN, `experimentar.grupo.${g.id}`), g.id);
  }
  for (const f of ['h', 'v', 'spiral', 'checker', 'polar', 'trash']) {
    assert.ok(Object.hasOwn(ES, `experimentar.laberinto.${f}`), f);
    assert.ok(Object.hasOwn(EN, `experimentar.laberinto.${f}`), f);
  }
});

test('escenarios propios en el almacén: guardar, listar, reemplazar, borrar', async () => {
  const p = crearPropios(almacenMemoria());
  assert.deepEqual(await p.listar(), { escenarios: [], invalidos: 0 });
  const b = borradorDe(fab('sopa-primordial'));
  const z = comoPropio(b, { nombre: 'Zeta' });
  const a = comoPropio(b, { nombre: 'Alfa' });
  assert.ok(z.ok && a.ok);
  await p.guardar(z.escenario);
  await p.guardar(a.escenario);
  let l = await p.listar();
  assert.deepEqual(
    l.escenarios.map((e) => e.nombre),
    ['Alfa', 'Zeta'],
  );
  const cambiado = comoPropio(escribirControl(b, ctl('luz'), 3), { nombre: 'Alfa', id: 'alfa' });
  assert.ok(cambiado.ok);
  await p.guardar(cambiado.escenario);
  l = await p.listar();
  assert.equal(l.escenarios.length, 2);
  assert.equal(l.escenarios[0].opciones.cambios['base:maxEnergy'], 3);
  assert.equal((await p.obtener('zeta'))?.nombre, 'Zeta');
  assert.equal(await p.obtener('nada'), undefined);
  await assert.rejects(p.guardar({ ...z.escenario, id: 'sopa-primordial' }), ErrorEscenario);
  await assert.rejects(p.borrar('sopa-primordial'));
  await p.borrar('alfa');
  l = await p.listar();
  assert.deepEqual(
    l.escenarios.map((e) => e.id),
    ['zeta'],
  );
});

test('listar ignora (y cuenta) registros que ya no validan', async () => {
  const alm = almacenMemoria();
  await alm.put('escenarios', { id: 'roto', formato: 99 });
  const p = crearPropios(alm);
  assert.deepEqual(await p.listar(), { escenarios: [], invalidos: 1 });
  assert.equal(await p.obtener('roto'), undefined);
});

test('la pantalla: almacén único, aplicar en un ciclo exacto y sin «Editar en el mundo»', () => {
  const leer = (/** @type {string} */ a) => readFileSync(new URL(a, import.meta.url), 'utf8');
  const estado = leer('../src/lib/experimentar/estado.svelte.js');
  assert.ok(estado.includes("from '../sim/almacen.svelte.js'"));
  assert.ok(!estado.includes('almacenIndexedDB'), 'no abre otra conexión');
  const pantalla = leer('../src/screens/Experimentar.svelte');
  assert.ok(pantalla.includes('aplicarEnCiclo(d.mensajes)'));
  assert.ok(pantalla.includes('registrarCambio(d, cicloExacto)'));
  assert.ok(pantalla.includes('estadoAlmacen'));
  assert.ok(!pantalla.includes('experimentar.objetos.editar'));
  assert.ok(!Object.hasOwn(ES, 'experimentar.objetos.editar'));
});
