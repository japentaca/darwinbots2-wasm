// @ts-check
// Exportación CSV/JSON (engine/export.js; decisiones 5 y 11).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aBytes,
  campoCsv,
  csvLargo,
  csvSerie,
  desdeJson,
  jsonCorrida,
  limpio,
} from '../engine/export.js';
import { Historia } from '../engine/history.js';
import { Linaje } from '../engine/lineage.js';
import { ciclos, historiaDe } from './util/historia-sintetica.js';

/** @param {number} n @param {(i: number) => number | null} f */
const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/** Parser CSV mínimo (comillas dobles) para verificar. @param {string} s */
function leerCsv(s) {
  /** @type {string[][]} */
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comillas) {
      if (c === '"' && s[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  return filas;
}

const RARO = 'Bot "raro", con\ncoma';

function historia() {
  const n = 30;
  return historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 12), [RARO]: serie(n, (i) => (i < 10 ? 5 : null)) },
    adn: serie(n, (i) => 100 + i),
    comportamiento: true,
    bins: 8,
  });
}

test('campoCsv: comillas, comas, saltos y NaN', () => {
  assert.equal(campoCsv('a'), 'a');
  assert.equal(campoCsv('a,b'), '"a,b"');
  assert.equal(campoCsv('di "hola"'), '"di ""hola"""');
  assert.equal(campoCsv('x\ny'), '"x\ny"');
  assert.equal(campoCsv(Number.NaN), '');
  assert.equal(campoCsv(null), '');
  assert.equal(campoCsv(1.5), '1.5');
});

test('csvSerie: una tabla por serie (global y de especie)', () => {
  const h = historia();
  const filas = leerCsv(csvSerie(h, 'adnMedia'));
  assert.deepEqual(filas[0], ['ciclo', 'media', 'min', 'max', 'n']);
  assert.equal(filas.length, 31);
  assert.deepEqual(filas[1], ['0', '100', '100', '100', '1']);
  const esp = leerCsv(csvSerie(h, 'vivos', RARO));
  assert.equal(esp.length, 11, 'solo los puntos presentes');
  assert.equal(leerCsv(csvSerie(h, 'no-existe')).length, 1, 'solo cabecera');
});

test('csvLargo: todas las series, nombres escapados, filtros', () => {
  const h = historia();
  const texto = csvLargo(h);
  assert.ok(texto.endsWith('\n'));
  const filas = leerCsv(texto);
  assert.deepEqual(filas[0], ['ciclo', 'metrica', 'especie', 'media', 'min', 'max', 'n']);
  assert.ok(
    filas.every((f) => f.length === 7),
    'todas las filas con 7 campos',
  );
  assert.ok(
    filas.some((f) => f[2] === RARO && f[1] === 'vivos'),
    'el nombre raro vuelve intacto',
  );
  const cols = Historia.columnas;
  const globales = filas.filter((f) => f[2] === '').length;
  assert.equal(globales, cols.global.length * 30);
  const solo = leerCsv(csvLargo(h, { metricas: ['vivos'], especies: ['A'], globales: false }));
  assert.equal(solo.length, 31);
  assert.ok(solo.slice(1).every((f) => f[1] === 'vivos' && f[2] === 'A'));
});

test('jsonCorrida / desdeJson: ida y vuelta con historia, eventos y linaje', () => {
  const h = historia();
  h.evento({ ciclo: 500, tipo: 'pico', params: { n: 17 } });
  const l = new Linaje();
  l.agregarLinaje(1000, {
    filas: Int32Array.from([
      7, 3, 0, 2, 0, 900, 120, 0, 0, 100, 10, 0, 3, 0, 0, 1, 0, 10, 110, 0, 1, 900, 9, 0,
    ]),
    nombres: ['A.txt'],
  });
  l.agregarDominantes(1000, [
    { nombre: 'A', hash: 5, copias: 2, adnLen: 120, abs: 7, adn: 'cond start stop' },
  ]);
  const texto = jsonCorrida({
    historia: h,
    linaje: l,
    eventos: [{ ciclo: 900, tipo: 'opciones', cambios: { 'opt:11': 1 } }],
    meta: { semilla: 7 },
  });
  const o = JSON.parse(texto);
  assert.equal(o.formato, 1);
  assert.equal(o.meta.semilla, 7);
  assert.ok(Array.isArray(o.historia.t), 'typed arrays como arreglos');
  const r = desdeJson(texto);
  assert.deepEqual(r.historia.serie('adnMedia'), h.serie('adnMedia'));
  assert.deepEqual(r.historia.serie('vivos', RARO), h.serie('vivos', RARO));
  assert.deepEqual(r.historia.serie('nacimientos', 'A'), h.serie('nacimientos', 'A'));
  assert.equal(r.historia.histogramas.length, h.histogramas.length);
  assert.deepEqual(r.historia.eventos, h.eventos);
  assert.deepEqual(r.eventos, [{ ciclo: 900, tipo: 'opciones', cambios: { 'opt:11': 1 } }]);
  assert.deepEqual(
    [...(r.linaje?.individuos.keys() ?? [])].sort(),
    [...l.individuos.keys()].sort(),
  );
  assert.equal(r.linaje?.fotos.get('A')?.[0].adn, 'cond start stop');
  assert.throws(() => desdeJson('{"tipo":"otra"}'), /no es un JSON de corrida/);
});

test('aBytes: UTF-8', () => {
  const b = aBytes('ñ');
  assert.ok(b instanceof Uint8Array);
  assert.equal(b.length, 2);
});

test('campoCsv: los textos que una planilla tomaría como fórmula llevan apóstrofo', () => {
  assert.equal(campoCsv('=SUM(A1:A9)'), "'=SUM(A1:A9)");
  assert.equal(campoCsv('+cmd'), "'+cmd");
  assert.equal(campoCsv('-bot'), "'-bot");
  assert.equal(campoCsv('@x'), "'@x");
  assert.equal(campoCsv('=HYPERLINK("x","y")'), '"\'=HYPERLINK(""x"",""y"")"');
  assert.equal(campoCsv(-5), '-5', 'los números negativos no se tocan');
  assert.equal(campoCsv('Bot-5'), 'Bot-5');
  const n = 5;
  const h = historiaDe({ t: ciclos(n), especies: { '=1+2': serie(n, () => 3) } });
  const filas = leerCsv(csvLargo(h, { metricas: ['vivos'], globales: false }));
  assert.ok(filas.slice(1).every((f) => f[2] === "'=1+2"));
});

test('limpio: la escritura más corta que vuelve al mismo float32', () => {
  const f = Math.fround(0.1);
  assert.equal(limpio(f), 0.1);
  assert.equal(Math.fround(limpio(f)), f);
  assert.equal(limpio(Math.fround(123.456)), 123.456);
  assert.equal(limpio(Math.fround(16777217)), 16777216);
  assert.equal(limpio(110.33333333333333), 110.3333, 'un valor que no es float32: 7 cifras');
  assert.ok(Number.isNaN(limpio(Number.NaN)));
  for (let i = 0; i < 2000; i++) {
    const x = Math.fround((i * 7.31) / 3 - 900);
    assert.equal(Math.fround(limpio(x)), x);
  }
});

test('jsonCorrida: los float32 salen sin ruido y vuelven idénticos', () => {
  const n = 30;
  const h = historiaDe({
    t: ciclos(n),
    especies: { A: serie(n, () => 12) },
    adn: serie(n, (i) => 100 + i * 0.1),
    metricas: { luz: 0.3 },
  });
  const texto = jsonCorrida({ historia: h });
  assert.doesNotMatch(texto, /\d\.\d*(?:0000|9999)\d/, 'sin colas de float32');
  assert.match(texto, /100\.1,/);
  const r = desdeJson(texto);
  assert.deepEqual(r.historia.serie('adnMedia'), h.serie('adnMedia'));
  assert.deepEqual(r.historia.serie('luz'), h.serie('luz'));
});
