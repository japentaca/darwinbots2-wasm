// @ts-check
// Lógica pura de Inicio (paso N1.6): src/lib/inicio/*.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ESCENARIOS_FABRICA, escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar, ErrorEscenario, validar } from '../engine/escenarios/index.js';
import { lgHash } from '../engine/league.js';
import { REG } from '../engine/protocolo.js';
import {
  CATEGORIAS,
  CATEGORIAS_EXTRA,
  ERRORES,
  ETIQUETAS,
  PLURALES,
} from '../src/lib/inicio/claves.js';
import { claveError, claveEtiqueta, formaPlural, separarPropios } from '../src/lib/inicio/datos.js';
import {
  CANTIDAD_BOT,
  ErrorTxt,
  escenarioDesdeTxt,
  nombreDeArchivo,
  tieneCodigo,
} from '../src/lib/inicio/desde-txt.js';
import {
  botsRecientes,
  categoriaDe,
  esNombreDeBot,
  MAX_RECIENTES,
} from '../src/lib/inicio/recientes.js';
import { fechaCorta, haceCuanto } from '../src/lib/inicio/tiempo.js';
import { generador, hashTexto, puntosDeFrame, puntosVista } from '../src/lib/inicio/vista.js';
import { ErrorCorrida } from '../src/lib/sim/corrida-nucleo.js';
import { BOT, FLAG } from '../src/lib/sim/frame.js';

const leer = (/** @type {string} */ l) =>
  JSON.parse(readFileSync(new URL(`../src/i18n/${l}/inicio.json`, import.meta.url), 'utf8'));
const DIC = { es: leer('es'), en: leer('en') };

// ---- Tiempo relativo ------------------------------------------------------------

test('haceCuanto: segundos, minutos, horas, ayer, días, meses (es y en)', () => {
  const ahora = new Date(2026, 8, 29, 18, 0, 0).getTime();
  const menos = (/** @type {number} */ ms) => new Date(ahora - ms).toISOString();
  const M = 60_000;
  assert.equal(haceCuanto(menos(10_000), ahora, 'es'), 'ahora');
  assert.equal(haceCuanto(menos(10_000), ahora, 'en'), 'now');
  assert.equal(haceCuanto(menos(5 * M), ahora, 'es'), 'hace 5 minutos');
  assert.equal(haceCuanto(menos(5 * M), ahora, 'en'), '5 minutes ago');
  assert.equal(haceCuanto(menos(2 * 60 * M + 5 * M), ahora, 'es'), 'hace 2 horas');
  assert.equal(haceCuanto(menos(2 * 60 * M), ahora, 'en'), '2 hours ago');
  // 20 h antes = el día anterior en el calendario → «ayer»
  assert.equal(haceCuanto(menos(20 * 60 * M), ahora, 'es'), 'hace 20 horas');
  assert.equal(haceCuanto(new Date(2026, 8, 28, 9, 0).toISOString(), ahora, 'es'), 'ayer');
  assert.equal(haceCuanto(new Date(2026, 8, 28, 9, 0).toISOString(), ahora, 'en'), 'yesterday');
  assert.equal(haceCuanto(new Date(2026, 8, 24, 9, 0), ahora, 'es'), 'hace 5 días');
  assert.equal(haceCuanto(new Date(2026, 6, 20, 9, 0), ahora, 'en'), '2 months ago');
  assert.equal(haceCuanto(new Date(2024, 6, 20, 9, 0), ahora, 'es'), 'hace 2 años');
  // futura (reloj atrasado) = ahora; inválida = ''
  assert.equal(haceCuanto(new Date(ahora + 3_600_000), ahora, 'es'), 'ahora');
  assert.equal(haceCuanto('no es fecha', ahora, 'es'), '');
  assert.equal(haceCuanto(undefined, ahora, 'es'), '');
});

test('fechaCorta: hoy, ayer, días y fecha corta después de una semana', () => {
  const ahora = new Date(2026, 8, 29, 18, 0, 0).getTime();
  assert.equal(fechaCorta(new Date(2026, 8, 29, 1, 0), ahora, 'es'), 'hoy');
  assert.equal(fechaCorta(new Date(2026, 8, 29, 1, 0), ahora, 'en'), 'today');
  assert.equal(fechaCorta(new Date(2026, 8, 28, 23, 0), ahora, 'es'), 'ayer');
  assert.equal(fechaCorta(new Date(2026, 8, 26, 12, 0), ahora, 'en'), '3 days ago');
  // La abreviatura depende de la versión de ICU («sep» o «sept»).
  assert.match(fechaCorta(new Date(2026, 8, 19, 12, 0), ahora, 'es'), /^19 sept?\.?$/);
  assert.equal(fechaCorta(new Date(2026, 8, 19, 12, 0), ahora, 'en'), 'Sep 19');
  assert.match(fechaCorta(new Date(2025, 11, 3, 12, 0), ahora, 'en'), /2025/);
  assert.equal(fechaCorta(null, ahora, 'es'), '');
});

// ---- Bots recientes -------------------------------------------------------------

const BESTIARIO = [
  { name: 'Zebedee V2.1 (F2)(Jez)-26.07.06', board: 'F2 bots', veg: false },
  { name: 'Alga minimalis 3.0', board: 'Veggies', veg: true },
  { name: 'Animal Minimalis (4G)(Numsgil)-10.03.05', board: 'F1 bots', veg: false },
  { name: 'Raro', board: 'Tablero nuevo', veg: false },
];

test('botsRecientes: actual primero, animales antes que vegetales, sin repetir, tope 4', () => {
  const r = botsRecientes({
    actual: {
      escenario: /** @type {any} */ (escenarioFabrica('depredador-y-presa')),
      especies: ['Zebedee V2.1 (F2)(Jez)-26.07.06', 'Mutante'],
      colores: { Mutante: '#123456' },
    },
    corridas: [
      /** @type {any} */ ({
        escenario: escenarioFabrica('sopa-primordial'),
        especies: ['Corpse', 'Otro'],
      }),
      /** @type {any} */ ({ escenario: null, especies: ['Quinto'] }),
    ],
    bestiario: BESTIARIO,
  });
  assert.deepEqual(
    r.map((b) => b.nombre),
    [
      'Zebedee V2.1 (F2)(Jez)-26.07.06',
      'Alga minimalis 3.0',
      'Mutante',
      'Animal Minimalis (4G)(Numsgil)-10.03.05',
    ],
  );
  assert.equal(r.length, MAX_RECIENTES);
  assert.deepEqual(r[0], {
    nombre: 'Zebedee V2.1 (F2)(Jez)-26.07.06',
    color: '#ff8c1a',
    vegetal: false,
    categoria: 'f2',
  });
  assert.equal(r[1].categoria, 'vegetal');
  assert.equal(r[1].vegetal, true);
  assert.equal(r[2].color, '#123456');
  assert.equal(r[2].categoria, null);
  assert.equal(r[3].categoria, 'f1');
});

test('botsRecientes: sin corridas ni actual da vacío; completa colores de otra fuente', () => {
  assert.deepEqual(botsRecientes({}), []);
  const r = botsRecientes({
    actual: { especies: ['X'] },
    corridas: [
      /** @type {any} */ ({
        escenario: {
          especies: [{ bot: 'X', color: '#abcdef', vegetal: false, origen: 'propio', cantidad: 1 }],
        },
      }),
    ],
  });
  assert.deepEqual(r, [{ nombre: 'X', color: '#abcdef', vegetal: false, categoria: null }]);
});

test('botsRecientes: sin especies falsas (?, grupos por color #…, Corpse)', () => {
  const r = botsRecientes({
    actual: { especies: ['#ff0000', '?', 'Corpse', '', 'Real'] },
    corridas: [/** @type {any} */ ({ escenario: null, especies: ['#00ff00', 'Otro'] })],
  });
  assert.deepEqual(
    r.map((b) => b.nombre),
    ['Real', 'Otro'],
  );
  assert.equal(esNombreDeBot('Zebedee'), true);
  for (const n of ['?', '#123456', 'Corpse', '', null]) assert.equal(esNombreDeBot(n), false);
});

test('formaPlural: uno y otros en es y en', () => {
  assert.equal(formaPlural(1, 'es'), 'uno');
  assert.equal(formaPlural(0, 'es'), 'otros');
  assert.equal(formaPlural(2, 'es'), 'otros');
  assert.equal(formaPlural(1, 'en'), 'uno');
  assert.equal(formaPlural(1000, 'en'), 'otros');
  for (const l of /** @type {const} */ (['es', 'en']))
    for (const p of PLURALES) {
      assert.match(DIC[l][`${p}.uno`], /\{n\}/, `${l}: ${p}.uno sin {n}`);
      assert.match(DIC[l][`${p}.otros`], /\{n\}/, `${l}: ${p}.otros sin {n}`);
    }
});

test('categoriaDe: tablero, vegetal sin tablero conocido, propio, nada', () => {
  assert.equal(categoriaDe({ name: 'a', board: 'Multi-Bots' }, undefined), 'multibot');
  assert.equal(categoriaDe({ name: 'a', board: 'Otro', veg: true }, undefined), 'vegetal');
  assert.equal(categoriaDe(undefined, 'propio'), 'propio');
  assert.equal(categoriaDe({ name: 'a', board: 'Otro' }, 'bestiario'), null);
});

// ---- Vistas previas -------------------------------------------------------------

test('puntosVista: determinista, dentro del campo y con los colores de sus especies', () => {
  for (const e of ESCENARIOS_FABRICA) {
    const a = puntosVista(e, 292, 96);
    const b = puntosVista(e, 292, 96);
    assert.deepEqual(a, b, `${e.id}: no determinista`);
    const colores = new Set(e.especies.map((s) => s.color));
    assert.ok(a.puntos.length >= 2 * e.especies.length, e.id);
    for (const p of a.puntos) {
      assert.ok(p.x >= 0 && p.x <= 292 && p.y >= 0 && p.y <= 96, `${e.id}: fuera`);
      assert.ok(colores.has(p.color), `${e.id}: color ajeno ${p.color}`);
    }
    for (const s of e.especies)
      assert.ok(
        a.puntos.some((p) => p.color === s.color && p.veg === s.vegetal),
        `${e.id}: falta ${s.bot}`,
      );
  }
  // Escenarios distintos → vistas distintas.
  const s = puntosVista(/** @type {any} */ (escenarioFabrica('sopa-primordial')), 292, 96);
  const d = puntosVista(/** @type {any} */ (escenarioFabrica('dia-y-noche')), 292, 96);
  assert.notDeepEqual(s.puntos, d.puntos);
});

test('puntosVista: objetos → muros y portales; sin objetos, nada', () => {
  const lab = puntosVista(/** @type {any} */ (escenarioFabrica('laberinto')), 292, 96);
  assert.ok(lab.muros.length > 0);
  assert.equal(lab.portales.length, 0);
  const arch = puntosVista(/** @type {any} */ (escenarioFabrica('archipielago')), 292, 96);
  assert.equal(arch.muros.length, 10);
  assert.equal(arch.portales.length, 2);
  const sopa = puntosVista(/** @type {any} */ (escenarioFabrica('sopa-primordial')), 292, 96);
  assert.deepEqual([sopa.muros, sopa.portales], [[], []]);
});

test('generador y hashTexto: estables', () => {
  assert.equal(hashTexto(''), 0x811c9dc5);
  assert.equal(hashTexto('abc').toString(16), lgHash('abc').replace(/^0+/, ''));
  const r1 = generador(42);
  const r2 = generador(42);
  const xs = Array.from({ length: 50 }, () => r1());
  assert.deepEqual(
    xs,
    Array.from({ length: 50 }, () => r2()),
  );
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  // Semillas límite no se clavan en 0.
  const r0 = generador(0);
  assert.notEqual(r0(), r0());
});

/**
 * Frame mínimo con los campos que usa puntosDeFrame.
 * @param {{ x: number, y: number, r: number, color: number, flags: number }[]} bots
 */
function frameDe(bots) {
  const v = new Float32Array(bots.length * REG.bot);
  bots.forEach((b, i) => {
    const o = i * REG.bot;
    v[o + BOT.x] = b.x;
    v[o + BOT.y] = b.y;
    v[o + BOT.r] = b.r;
    v[o + BOT.color] = b.color;
    v[o + BOT.flags] = b.flags;
  });
  return /** @type {any} */ ({ v, W: 1000, H: 500, nBots: bots.length, of: { bots: 0 } });
}

test('puntosDeFrame: fracciones del campo, color CSS, sin cadáveres, con tope', () => {
  const f = frameDe([
    { x: 500, y: 250, r: 50, color: 0x0000ff, flags: 0 },
    { x: 100, y: 400, r: 25, color: 0x00ff00, flags: FLAG.veg },
    { x: 1, y: 1, r: 1, color: 0, flags: FLAG.corpse },
  ]);
  assert.deepEqual(puntosDeFrame(f), [
    { x: 0.5, y: 0.5, r: 0.1, color: 'rgb(255,0,0)', veg: false },
    { x: 0.1, y: 0.8, r: 0.05, color: 'rgb(0,255,0)', veg: true },
  ]);
  const muchos = frameDe(
    Array.from({ length: 1000 }, (_, i) => ({ x: i, y: 1, r: 1, color: 0, flags: 0 })),
  );
  assert.equal(puntosDeFrame(muchos, 100).length, 100);
  assert.deepEqual(puntosDeFrame(frameDe([])), []);
});

// ---- Escenario desde un .txt ----------------------------------------------------

const ADN = "' mi bot\r\ncond\n*.eye5 0 >\nstart\n10 .up store\nstop\n";

test('escenarioDesdeTxt: una especie + el alga, base clásica, ADN y hash', () => {
  const e = escenarioDesdeTxt(`\uFEFF${ADN}`, 'C:\\bots\\Mi Bot.txt');
  const adn = ADN.replace(/\r\n/g, '\n');
  assert.equal(e.nombre, 'Mi Bot');
  assert.equal(e.opciones.base, 'clasica');
  assert.deepEqual(e.opciones.cambios, {});
  assert.equal(e.destino, 'observar');
  assert.equal(e.especies.length, 2);
  const alga = /** @type {any} */ (escenarioFabrica('sopa-primordial')).especies[0];
  assert.equal(e.especies[0].bot, alga.bot);
  assert.equal(e.especies[0].vegetal, true);
  const b = e.especies[1];
  assert.equal(b.bot, 'Mi Bot');
  assert.equal(b.origen, 'propio');
  assert.equal(b.adn, adn);
  assert.equal(b.hash, lgHash(adn));
  assert.equal(b.cantidad, CANTIDAD_BOT);
  assert.equal(b.vegetal, false);
  assert.equal(e.id, `txt-${lgHash(adn)}`);
  assert.deepEqual(validar(e), []);
  // Se puede aplicar: el ADN del bot va embebido, el del alga lo da adnDe.
  const msgs = aplicar(e, 7, (s) => (s.bot === alga.bot ? 'alga' : undefined));
  const reset = msgs.find((m) => m.t === 'reset');
  assert.equal(reset.limpio, true);
  assert.deepEqual(
    reset.species.map((/** @type {any} */ s) => [s.name, s.dna]),
    [
      [`${alga.bot}.txt`, 'alga'],
      ['Mi Bot.txt', adn],
    ],
  );
  // Nombre y descripción visibles los pone quien llama.
  const con = escenarioDesdeTxt(ADN, 'x.txt', { nombre: 'x con algas', descripcion: 'd' });
  assert.equal(con.nombre, 'x con algas');
  assert.equal(con.descripcion, 'd');
  // Mismo ADN → mismo escenario.
  assert.deepEqual(escenarioDesdeTxt(ADN, 'Mi Bot.txt'), escenarioDesdeTxt(ADN, 'Mi Bot.txt'));
});

test('escenarioDesdeTxt: sin código lanza ErrorTxt con el archivo; un bot homónimo del alga la reemplaza', () => {
  assert.throws(
    () => escenarioDesdeTxt("' solo comentarios\n\n   \n", 'C:\\bots\\vacio.txt'),
    (/** @type {any} */ e) =>
      e instanceof ErrorTxt && e.clave === 'txtVacio' && e.archivo === 'vacio.txt',
  );
  assert.throws(() => escenarioDesdeTxt('', 'nada.txt'), ErrorTxt);
  const alga = /** @type {any} */ (escenarioFabrica('sopa-primordial')).especies[0];
  const e = escenarioDesdeTxt(ADN, `${alga.bot}.txt`);
  assert.equal(e.especies.length, 1);
  assert.equal(e.especies[0].origen, 'propio');
});

test('nombreDeArchivo y tieneCodigo', () => {
  assert.equal(nombreDeArchivo('a/b/Zeb.TXT'), 'Zeb');
  assert.equal(nombreDeArchivo('.txt'), 'bot');
  assert.equal(tieneCodigo("' x\n  ' y"), false);
  assert.equal(tieneCodigo("' x\nstart"), true);
});

// ---- Escenarios propios y errores -----------------------------------------------

test('separarPropios: normaliza los válidos, cuenta los inválidos y los que usan un id de fábrica', () => {
  const bueno = {
    formato: 1,
    id: 'mio',
    nombre: { es: 'Zeta', en: 'Zeta' },
    opciones: { base: 'clasica' },
    especies: [{ bot: 'X', cantidad: 3, color: '#112233', vegetal: false }],
  };
  const otro = { ...bueno, id: 'mio-2', nombre: 'Alfa' };
  const r = separarPropios([bueno, { id: 'roto' }, { ...bueno, id: 'sopa-primordial' }, otro]);
  assert.equal(r.invalidos, 2);
  assert.deepEqual(
    r.validos.map((e) => e.id),
    ['mio-2', 'mio'],
  );
  assert.equal(r.validos[1].destino, 'observar');
});

test('claveError: códigos conocidos y contexto', () => {
  assert.deepEqual(
    claveError(Object.assign(new Error('x'), { codigo: 'version-vieja' }), 'corridas'),
    {
      clave: 'inicio.error.versionVieja',
      params: {},
    },
  );
  const sinAdn = new ErrorEscenario('sin-adn', [{ codigo: 'sin-adn', ruta: '', detalle: 'Zeb' }]);
  assert.deepEqual(claveError(sinAdn, 'iniciar'), {
    clave: 'inicio.error.sinAdn',
    params: { bot: 'Zeb' },
  });
  // Al sembrar un .txt el único ADN que se busca es el del alga de base.
  assert.deepEqual(claveError(sinAdn, 'archivo'), { clave: 'inicio.error.sinAlga', params: {} });
  assert.deepEqual(claveError(new ErrorTxt('txtVacio', 'Mi Bot.txt'), 'archivo'), {
    clave: 'inicio.error.txtVacio',
    params: { archivo: 'Mi Bot.txt' },
  });
  assert.deepEqual(claveError(new Error('boom'), 'retomar'), {
    clave: 'inicio.error.retomar',
    params: { msg: 'boom' },
  });
  // ErrorCorrida del núcleo: las claves de Observar (texto sin detalles técnicos).
  for (const k of ['inexistente', 'sinDbsim', 'dbsimInvalido'])
    assert.deepEqual(claveError(new ErrorCorrida(k, 'x'), 'retomar'), {
      clave: `observar.aviso.error.${k}`,
      params: {},
    });
  // Una clave de ErrorCorrida sin texto propio cae en la del contexto.
  assert.equal(claveError(new ErrorCorrida('otraCosa'), 'archivo').clave, 'inicio.error.archivo');
  const conexion = Object.assign(new Error('t'), { name: 'ErrorConexion', clave: 'tiempo' });
  assert.equal(claveError(conexion, 'iniciar').clave, 'observar.aviso.error.conexion.tiempo');
  assert.equal(claveEtiqueta('básico'), 'basico');
  assert.equal(claveEtiqueta('inventada'), null);
});

// ---- Claves armadas con plantilla -----------------------------------------------

test('las claves armadas de inicio (etiquetas, categorías, errores) existen en es y en', () => {
  const faltan = [];
  const claves = [
    ...Object.values(ETIQUETAS).map((s) => `inicio.etiqueta.${s}`),
    ...[...Object.values(CATEGORIAS), ...CATEGORIAS_EXTRA].map((s) => `inicio.categoria.${s}`),
    ...ERRORES.map((s) => `inicio.error.${s}`),
    ...PLURALES.flatMap((p) => [`${p}.uno`, `${p}.otros`]),
  ];
  for (const l of /** @type {const} */ (['es', 'en']))
    for (const k of claves) if (!Object.hasOwn(DIC[l], k)) faltan.push(`${l}: ${k}`);
  assert.deepEqual(faltan, []);
  // Todas las etiquetas de los escenarios de fábrica tienen traducción.
  for (const e of ESCENARIOS_FABRICA)
    for (const et of e.etiquetas) assert.ok(claveEtiqueta(et), `${e.id}: etiqueta ${et}`);
});
