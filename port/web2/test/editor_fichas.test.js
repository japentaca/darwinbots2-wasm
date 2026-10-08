// @ts-check
// El modo Fichas del editor (PLAN-EDITOR E3.1), sin DOM ni wasm:
//   1. modeloFichas: tipo, gen y zona de cada línea, con un ADN a mano.
//   2. Ida y vuelta en los 684 bots: borrar una ficha y volver a insertarla
//      en su sitio devuelve el texto original, y reemplazarla por la misma
//      palabra es identidad.
//   3. insertarEn, borrarFicha, moverFicha, nuevaLineaTras y huecos.
//   4. sugerenciasFicha (src/lib/bots/editor/autocompletar.js).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  borrarFicha,
  huecos,
  insertarEn,
  modeloFichas,
  moverFicha,
  nuevaLineaTras,
  reemplazarFicha,
} from '../engine/fichas.js';
import { genesTexto, tokensTexto } from '../engine/lab.js';
import { sugerenciasFicha } from '../src/lib/bots/editor/autocompletar.js';
import { WEB } from './util/dbcore-node.js';

const BOTS = path.join(WEB, 'bots');
const bestiario = JSON.parse(fs.readFileSync(path.join(BOTS, 'bots.json'), 'utf8'));

// Un ADN a mano: una línea de apagado, una def, una vacía, un gen cond/start,
// una línea vacía dentro del gen, un else tras start (gen propio), un
// comentario de línea entera y palabras fuera de todo gen tras el stop.
const ADN = [
  "'#off cond 1 stop",
  'def paso 5',
  '',
  "cond ' comentario",
  '.up 10 >',
  '  ',
  'start',
  '  .paso store',
  'else',
  '  1 stop',
  '  2 3',
  '/ una línea entera de comentario',
  'end',
].join('\n');

test('modeloFichas: tipo, gen y zona de cada línea del ADN a mano', () => {
  const m = modeloFichas(ADN);
  assert.equal(m.length, ADN.split('\n').length, 'una entrada por línea');
  assert.deepEqual(
    m.map((l) => l.tipo),
    [
      'meta',
      'def',
      'vacia',
      'codigo',
      'codigo',
      'vacia',
      'codigo',
      'codigo',
      'codigo',
      'codigo',
      'codigo',
      'comentario',
      'codigo',
    ],
  );
  assert.deepEqual(
    m.map((l) => [l.gen, l.zona]),
    [
      [-1, 'fuera'], // apagada
      [-1, 'fuera'], // def
      [-1, 'fuera'], // vacía antes de todo
      [0, 'cond'], // cond ' comentario
      [0, 'cond'], // .up 10 >
      [0, 'cond'], // vacía dentro del gen: la de la línea de arriba
      [0, 'cuerpo'], // start
      [0, 'cuerpo'], // .paso store
      [1, 'else'], // else tras start: gen propio
      [1, 'else'], // 1 stop
      [-1, 'fuera'], // 2 3: tras el stop
      [-1, 'fuera'], // comentario
      [-1, 'fuera'], // end
    ],
  );
  assert.equal(genesTexto(ADN).length, 2, 'los genes de genesTexto son los mismos');
  assert.equal(m[3].ini, ADN.indexOf("cond '"), 'ini de la línea en el texto');
});

test('modeloFichas: las fichas llevan su posición en el texto y su clase', () => {
  const m = modeloFichas(ADN);
  const f = m[4].fichas;
  assert.deepEqual(
    f.map((x) => x.w),
    ['.up', '10', '>'],
  );
  assert.equal(ADN.slice(f[0].ini, f[0].fin), '.up');
  assert.equal(f[0].clase, 'sys', 'sysvar');
  assert.equal(f[1].clase, 'num');
  assert.equal(m[7].fichas[0].clase, 'sys', '.paso es una variable privada del def');
  assert.equal(m[7].fichas[1].clase, 'cmd', 'store es un comando');
  assert.equal(
    m[1].fichas.every((x) => x.clase === 'def'),
    true,
    'las líneas def',
  );
  assert.equal(m[6].fichas[0].clase, 'flu', 'start es de flujo');
});

test('modeloFichas: un else tras cond sin start comparte gen; el texto vacío es una línea', () => {
  const m = modeloFichas('cond 1\nelse 2 stop');
  assert.deepEqual(
    m.map((l) => [l.gen, l.zona]),
    [
      [0, 'cond'],
      [0, 'else'],
    ],
  );
  assert.equal(genesTexto('cond 1\nelse 2 stop').length, 1);
  const vacio = modeloFichas('');
  assert.equal(vacio.length, 1);
  assert.equal(vacio[0].tipo, 'vacia');
});

test('ida y vuelta en los 684 bots: quitar una ficha y volver a ponerla devuelve el texto', () => {
  assert.equal(bestiario.length, 684);
  let fichas = 0;
  for (const b of bestiario) {
    const t = fs.readFileSync(path.join(BOTS, b.file), 'utf8');
    const m = modeloFichas(t);
    assert.equal(
      m.reduce((a, l) => a + l.fichas.length, 0),
      tokensTexto(t).tokens.length,
      `${b.file}: fichas = tokens`,
    );
    for (const l of m)
      for (const f of l.fichas) {
        fichas++;
        const quitada = borrarFicha(t, f);
        assert.equal(insertarEn(quitada.texto, quitada.cursor, f.w).texto, t, `${b.file}: ${f.w}`);
        assert.equal(reemplazarFicha(t, f, f.w).texto, t, `${b.file}: reemplazar por lo mismo`);
      }
  }
  assert.ok(fichas > 300000, `se recorrieron ${fichas} fichas`);
});

test('insertarEn: pone los espacios que faltan y deja el cursor tras la palabra', () => {
  assert.deepEqual(insertarEn('1 2', 1, 'x'), { texto: '1 x 2', cursor: 3 }, 'en medio');
  assert.equal(insertarEn('1 2', 0, 'x').texto, 'x 1 2', 'al inicio');
  assert.equal(insertarEn('1 2', 3, 'x').texto, '1 2 x', 'al final');
  assert.equal(insertarEn('1 2', 2, 'x').texto, '1 x 2', 'después de un espacio: no se duplica');
  assert.equal(insertarEn("a'c", 1, 'x').texto, "a x'c", 'antes de un comentario no va espacio');
});

test('borrarFicha: quita la ficha y un espacio; en una línea sola no toca los saltos', () => {
  assert.deepEqual(borrarFicha('1 2 3', { w: '2', ini: 2, fin: 3, clase: 'num' }), {
    texto: '1 3',
    cursor: 2,
  });
  assert.equal(borrarFicha('1 2 3', { w: '3', ini: 4, fin: 5, clase: 'num' }).texto, '1 2');
  assert.equal(borrarFicha('x\ny', { w: 'x', ini: 0, fin: 1, clase: 'otra' }).texto, '\ny');
  assert.equal(
    borrarFicha('1\t2', { w: '1', ini: 0, fin: 1, clase: 'num' }).texto,
    '\t2',
    'un tabulador se deja',
  );
});

test('moverFicha: lleva la ficha al hueco de delante, y al final si se corre', () => {
  const t = 'a b c';
  const c = { w: 'c', ini: 4, fin: 5, clase: 'otra' };
  assert.equal(moverFicha(t, c, 0).texto, 'c a b');
  const a = { w: 'a', ini: 0, fin: 1, clase: 'otra' };
  assert.equal(moverFicha(t, a, 5).texto, 'b c a');
});

test('nuevaLineaTras: un salto al final de la línea, con su sangría', () => {
  const r = nuevaLineaTras('  cond 1\nstop', 0);
  assert.equal(r.texto, '  cond 1\n  \nstop');
  assert.equal(r.cursor, '  cond 1\n  '.length, 'el cursor queda tras la sangría');
});

test('huecos: antes y después de cada ficha en una línea de código; ninguno en las demás', () => {
  const m = modeloFichas("cond 1 stop\n\n  \n' un comentario\ndef x 1");
  // cond 0..4, 1 5..6, stop 7..11
  assert.deepEqual(huecos(m[0]), [0, 4, 6, 11]);
  assert.deepEqual(huecos(m[1]), [m[1].ini], 'una línea vacía: su inicio');
  assert.deepEqual(huecos(m[3]), [], 'comentario');
  assert.deepEqual(huecos(m[4]), [], 'def');
});

test('sugerenciasFicha: sysvars y privadas con punto, comandos sin punto, vacío sin prefijo', () => {
  const sys = sugerenciasFicha('.up', []);
  assert.equal(sys[0].palabra, '.up', 'la exacta primero');
  assert.equal(sys[0].tipo, 'sysvar');
  assert.equal(sys[0].dir, 1);
  const priv = sugerenciasFicha('.pa', ['paso']);
  assert.ok(
    priv.some((s) => s.palabra === '.paso' && s.tipo === 'privada'),
    'la variable privada del ADN',
  );
  const estrella = sugerenciasFicha('*.up', []);
  assert.ok(
    estrella.some((s) => s.palabra === '*.up'),
    'con la estrella',
  );
  const cmd = sugerenciasFicha('st', []).map((s) => s.palabra);
  assert.ok(cmd.includes('store') && cmd.includes('start') && cmd.includes('stop'));
  assert.ok(sugerenciasFicha('st', []).every((s) => s.tipo === 'comando' && s.dir === null));
  assert.deepEqual(sugerenciasFicha('', []), []);
});
