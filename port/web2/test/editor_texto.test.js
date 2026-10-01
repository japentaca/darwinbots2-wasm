// @ts-check
// Editor de ADN (decisión 18), la parte de texto, sin DOM:
//   - genesTexto cuenta los genes igual que el core (engine/lineage.js
//     genesAdn) en los 569 bots del Bestiary;
//   - resaltado: clases por palabra y el HTML conserva el texto exacto;
//   - plegado/apagado: el texto que resulta de apagar y encender genes;
//   - orígenes por gen tras editar, insertar y apagar;
//   - autocompletado de sysvars, avisos del lint y sus arreglos, y el
//     tramo mínimo de un cambio (deshacer del navegador).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  apagarGen,
  bloquesAdn,
  encenderGen,
  genesTexto,
  insertarGen,
  PREFIJO_APAGADO,
  realinearOrigenes,
  reemplazarPalabras,
  tokensTexto,
} from '../engine/lab.js';
import { genesAdn } from '../engine/lineage.js';
import { completar, palabraEnCurso, sugerencias } from '../src/lib/bots/editor/autocompletar.js';
import { aplicarArreglo, describirLint, palabrasMarcadas } from '../src/lib/bots/editor/lint.js';
import { claseDe, resaltarHtml, textoDeHtml } from '../src/lib/bots/editor/resaltado.js';
import { diferencia } from '../src/lib/bots/editor/textarea.js';
import { WEB } from './util/dbcore-node.js';

const BOTS = path.join(WEB, 'bots');
const bestiario = JSON.parse(fs.readFileSync(path.join(BOTS, 'bots.json'), 'utf8'));

const ADN = [
  "' Mi bot",
  'def paso 971',
  '',
  "' avanzar",
  'cond',
  '*.eye5 0 =',
  'start',
  '10 .up store',
  'stop',
  '',
  "' disparar 'con comillas",
  'cond *.eye5 40 > start -1 .shoot store stop',
  '',
  "' contar",
  'start',
  '*.paso 1 add .paso store',
  'stop',
  'end',
  "' esto no corre",
  '',
].join('\n');

test('genesTexto = genesAdn del core en los 569 bots del Bestiary', () => {
  let n = 0;
  for (const b of bestiario) {
    const t = fs.readFileSync(path.join(BOTS, b.file), 'utf8');
    const a = genesAdn(t).genes.map((g) => g.join(' '));
    const c = genesTexto(t).map((g) => g.palabras.join(' '));
    assert.deepEqual(c, a, b.file);
    n++;
  }
  assert.equal(n, 569);
  const gs = genesTexto(ADN);
  assert.equal(gs.length, 3);
  assert.deepEqual(
    gs.map((g) => [g.l0, g.l1]),
    [
      [4, 8],
      [11, 11],
      [14, 16],
    ],
  );
  // las posiciones apuntan al texto
  const { tokens } = tokensTexto(ADN);
  for (const k of tokens) assert.equal(ADN.slice(k.ini, k.fin), k.w);
});

test('resaltado: una clase por palabra y el HTML conserva el texto exacto', () => {
  for (const t of [ADN, 'a\r\nb\t c', '<x> & "y"', '', `${PREFIJO_APAGADO}cond\n`]) {
    assert.equal(textoDeHtml(resaltarHtml(t)), `${t}\n`, JSON.stringify(t));
  }
  const defs = new Set(['paso']);
  const vacio = new Set();
  assert.equal(claseDe('cond', defs, vacio), 'flu');
  assert.equal(claseDe('END', defs, vacio), 'flu');
  assert.equal(claseDe('store', defs, vacio), 'cmd');
  assert.equal(claseDe('!%=', defs, vacio), 'cmd');
  assert.equal(claseDe('*.eye5', defs, vacio), 'sys');
  assert.equal(claseDe('.Up', defs, vacio), 'sys', 'sysvars sin distinguir mayúsculas');
  assert.equal(claseDe('.paso', defs, vacio), 'sys', 'variable privada');
  assert.equal(claseDe('.nada', defs, vacio), 'otra');
  assert.equal(claseDe('-12', defs, vacio), 'num');
  assert.equal(claseDe('*971', defs, vacio), 'ref');
  assert.equal(claseDe('.nada', defs, new Set(['.nada'])), 'err');
  const h = resaltarHtml(ADN, { marcadas: new Set(['.shoot']) });
  assert.match(h, /<span class="r-com">' Mi bot<\/span>/);
  assert.match(h, /<span class="r-def">def paso 971<\/span>/);
  assert.match(h, /<span class="r-sys">\*\.eye5<\/span>/);
  assert.match(h, /<span class="r-err">\.shoot<\/span>/);
  assert.match(h, /<span class="r-com">' disparar 'con comillas<\/span>/);
  assert.match(resaltarHtml(`${PREFIJO_APAGADO}cond`), /^<span class="r-off">/);
});

test('apagar y encender genes: el texto resultante', () => {
  const off = apagarGen(ADN, 0);
  assert.equal(
    off,
    ADN.replace(
      'cond\n*.eye5 0 =\nstart\n10 .up store\nstop',
      [`cond`, '*.eye5 0 =', 'start', '10 .up store', 'stop']
        .map((l) => PREFIJO_APAGADO + l)
        .join('\n'),
    ),
  );
  assert.equal(genesTexto(off).length, 2);
  assert.equal(encenderGen(off, 0), ADN, 'encender devuelve el texto exacto');
  // un gen que comparte línea con otro se aísla antes de comentarlo
  const t = 'cond *.a 1 = start 1 .up store stop cond *.b 2 = start 2 .dn store stop';
  const off2 = apagarGen(t, 1);
  assert.equal(
    off2,
    `cond *.a 1 = start 1 .up store stop\n${PREFIJO_APAGADO}cond *.b 2 = start 2 .dn store stop`,
  );
  assert.deepEqual(
    genesAdn(off2).genes.map((g) => g.join(' ')),
    ['cond *.a 1 = start 1 .up store stop'],
  );
  const on = encenderGen(off2, 0);
  assert.deepEqual(
    genesAdn(on).genes.map((g) => g.join(' ')),
    genesAdn(t).genes.map((g) => g.join(' ')),
  );
  // el gen del medio de una línea: se parte en tres
  const t3 = 'start 1 .up store stop start 2 .dn store stop start 3 .sx store stop';
  assert.equal(
    apagarGen(t3, 1),
    `start 1 .up store stop\n${PREFIJO_APAGADO}start 2 .dn store stop\nstart 3 .sx store stop`,
  );
  // índice inexistente: sin cambios
  assert.equal(apagarGen(ADN, 9), ADN);
  assert.equal(encenderGen(ADN, 0), ADN);
});

test('bloques para la vista por genes: activos y apagados en orden, con su nombre', () => {
  const off = apagarGen(ADN, 1);
  const b = bloquesAdn(off);
  assert.deepEqual(
    b.map((x) => [x.tipo, x.n, x.nombre]),
    [
      ['gen', 0, 'avanzar'],
      ['apagado', 0, "disparar 'con comillas"],
      ['gen', 1, 'contar'],
    ],
  );
  assert.deepEqual(b[1].palabras, [
    'cond',
    '*.eye5',
    '40',
    '>',
    'start',
    '-1',
    '.shoot',
    'store',
    'stop',
  ]);
  // sin comentario arriba: sin nombre
  assert.equal(bloquesAdn('cond 1 1 = start stop')[0].nombre, '');
});

test('insertar un gen: al final, antes del end, con su cabecera', () => {
  const n = insertarGen(ADN, 'cond\n1 1 =\nstart\n.repro inc\nstop', 'Otro bot #3');
  const gs = genesAdn(n).genes.map((g) => g.join(' '));
  assert.equal(gs.length, 4);
  assert.equal(gs[3], 'cond 1 1 = start .repro inc stop');
  assert.ok(n.includes("' Otro bot #3\ncond\n1 1 =\nstart\n.repro inc\nstop\nend\n"));
  assert.equal(insertarGen('', 'start stop'), 'start stop\n');
  assert.equal(insertarGen('start stop', 'start 1 stop'), 'start stop\n\nstart 1 stop\n');
});

test('orígenes por gen: se conservan al editar, al apagar y al volver a encender', () => {
  /** @type {any[]} */
  const og = [{ archivo: 'a.txt', gen: 2 }, null, { hash: '0123456789abcdef', gen: 0 }];
  // editar el gen 0 (cambiado): conserva el origen
  const ed = ADN.replace('10 .up store', '20 .up store');
  assert.deepEqual(realinearOrigenes(ADN, ed, og), og);
  // agregar un gen al principio: los demás corren un lugar
  const mas = `start 5 .dx store stop\n${ADN}`;
  assert.deepEqual(realinearOrigenes(ADN, mas, og), [null, ...og]);
  // apagar el primero y volver a encenderlo: la memoria le devuelve el origen
  const memoria = new Map([
    ['cond *.eye5 0 = start 10 .up store stop', { archivo: 'a.txt', gen: 2 }],
  ]);
  const off = apagarGen(ADN, 0);
  const og2 = realinearOrigenes(ADN, off, og);
  assert.deepEqual(og2, [null, og[2]]);
  assert.deepEqual(realinearOrigenes(off, ADN, og2, /** @type {any} */ (memoria)), og);
});

test('reemplazar palabras sueltas conserva espacios y comentarios', () => {
  const t = "cond  *.a 1 = ' comentario .a\nstart 971 .x store stop";
  const { tokens } = tokensTexto(t);
  const i = tokens.findIndex((k) => k.w === '971');
  assert.equal(reemplazarPalabras(t, [{ i, w: '972' }]), t.replace('971', '972'));
});

test('autocompletado de sysvars: palabra en curso, sugerencias del core y privadas', () => {
  const t = 'def mia 971\ncond\n*.ey';
  const w = palabraEnCurso(t, t.length);
  assert.deepEqual(w, { ini: t.length - 4, fin: t.length, prefijo: 'ey', estrella: true });
  const s = sugerencias('ey', t).map((x) => x.nombre);
  assert.ok(s.length > 5 && s.every((n) => n.toLowerCase().includes('ey')));
  assert.ok(
    s.slice(0, 3).every((n) => n.toLowerCase().startsWith('ey')),
    'primero las que empiezan igual',
  );
  assert.equal(sugerencias('mi', t)[0].nombre, 'mia');
  assert.equal(sugerencias('mi', t)[0].privada, true);
  const up = sugerencias('up', '').find((x) => x.nombre === 'up');
  assert.equal(up?.dir, 1);
  assert.equal(palabraEnCurso("' *.ey", 6), null, 'no dentro de un comentario');
  assert.equal(palabraEnCurso('store', 5), null);
  const r = completar(t, /** @type {any} */ (w), 'eye5');
  assert.equal(r.texto, 'def mia 971\ncond\n*.eye5');
  assert.equal(r.cursor, r.texto.length);
});

test('avisos del lint: código estable y arreglo de un clic', () => {
  const casos = [
    [
      { kind: 'nombre', token: '*.refshel', count: 2, line: 7, hint: 'did you mean .refshell?' },
      'nombre-parecido',
      { de: '*.refshel', a: '*.refshell' },
    ],
    [
      {
        kind: 'nombre',
        token: '.971',
        count: 1,
        line: 2,
        hint: 'did you mean address 971? Addresses go without a dot: 971',
      },
      'nombre-direccion',
      { de: '.971', a: '971' },
    ],
    [
      { kind: 'nombre', token: '.xx', count: 1, line: 2, hint: 'its def is further down; …' },
      'nombre-def-abajo',
      null,
    ],
    [
      {
        kind: 'nombre',
        token: '.Paso',
        count: 1,
        line: 2,
        hint: 'private variables are case-sensitive',
      },
      'nombre-mayusculas',
      null,
    ],
    [
      { kind: 'nombre', token: '.qqq', count: 1, line: 2, hint: 'not a sysvar and has no def (…)' },
      'nombre-desconocido',
      null,
    ],
    [
      { kind: 'palabra', token: 'up', count: 1, line: 3, hint: 'missing dot? .up' },
      'palabra-sin-punto',
      { de: 'up', a: '.up' },
    ],
    [
      { kind: 'palabra', token: 'stor', count: 1, line: 3, hint: 'did you mean store?' },
      'palabra-parecida',
      { de: 'stor', a: 'store' },
    ],
    [
      { kind: 'palabra', token: 'hola', count: 1, line: 3, hint: 'not a command or a number (…)' },
      'palabra-desconocida',
      null,
    ],
    [
      {
        kind: 'pegado',
        token: '12ab',
        count: 1,
        line: 4,
        hint: 'reads as 12; "ab" is lost (missing space?)',
      },
      'pegado',
      { de: '12ab', a: '12 ab' },
    ],
    [{ kind: 'primero', token: 'x', count: 1, line: 0, hint: '…' }, 'primero', null],
    [{ kind: 'sombra', token: 'def up', count: 1, line: 1, hint: '…' }, 'sombra', null],
    [{ kind: 'error', token: 'error 6', count: 1, line: 0, hint: '…' }, 'error', null],
  ];
  for (const [h, codigo, arreglo] of casos) {
    const a = describirLint(/** @type {any} */ (h));
    assert.equal(a.codigo, codigo, JSON.stringify(h));
    assert.deepEqual(a.arreglo, arreglo, JSON.stringify(h));
  }
  assert.equal(describirLint(/** @type {any} */ (casos[10][0])).params.nombre, 'up');
  assert.equal(describirLint(/** @type {any} */ (casos[11][0])).params.codigo, '6');
  const t = "cond *.refshel 5 < ' *.refshel\nstart *.refshel .x store stop";
  assert.equal(
    aplicarArreglo(t, { de: '*.refshel', a: '*.refshell' }),
    "cond *.refshell 5 < ' *.refshel\nstart *.refshell .x store stop",
    'todas las apariciones fuera de comentarios',
  );
  assert.deepEqual(
    [...palabrasMarcadas(/** @type {any} */ (casos.map((c) => c[0])))].sort(),
    ['*.refshel', '.971', '.Paso', '.qqq', '.xx', '12ab', 'hola', 'stor', 'up'].sort(),
  );
});

test('tramo mínimo de un cambio (un solo paso de deshacer)', () => {
  assert.deepEqual(diferencia('abcdef', 'abXYef'), { ini: 2, fin: 4, texto: 'XY' });
  assert.deepEqual(diferencia('abc', 'abc'), { ini: 3, fin: 3, texto: '' });
  assert.deepEqual(diferencia('aaa', 'aaaa'), { ini: 3, fin: 3, texto: 'a' });
  assert.deepEqual(diferencia('abc', ''), { ini: 0, fin: 3, texto: '' });
  for (const [a, b] of [
    [ADN, apagarGen(ADN, 1)],
    ['x', 'yxz'],
  ]) {
    const d = diferencia(a, b);
    assert.equal(a.slice(0, d.ini) + d.texto + a.slice(d.fin), b);
  }
});
