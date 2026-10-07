// @ts-check
// Inspector del bot (paso N1.4): derivaciones puras de src/lib/inspector/.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { H, HEADER, REG } from '../engine/protocolo.js';
import { claseDe, resaltarAdn, tokensLinea } from '../src/lib/inspector/adn.js';
import {
  COMANDOS,
  HistorialComandos,
  MODIFICAN,
  SalidaConsola,
  verbo,
} from '../src/lib/inspector/consola.js';
import {
  arcoOjo,
  cabeceraAdn,
  datosBot,
  filaDe,
  fraccion,
  hayQueCambiarBot,
  maximosDelMundo,
  parientes,
  resumenFamilia,
} from '../src/lib/inspector/datos.js';
import {
  LectorMemoria,
  normalizarConsulta,
  parsearPrintmem,
} from '../src/lib/inspector/memoria.js';
import { SerieCiclos } from '../src/lib/inspector/serie.js';
import { PIV } from '../src/lib/mundo/render-clasico.js';
import { BOT, decodificarFrame, FLAG, FOCO, OJO, REG_OJO, VIS } from '../src/lib/sim/frame.js';

/**
 * Bots de prueba: [slot, abs, madre, nrg]. Foco en `foco` (0 = sin bloque).
 * @param {{ bots: number[][], foco?: number, rica?: boolean, cadaver?: number }} o
 */
function armar(o) {
  const nB = o.bots.length;
  const cab = new Array(HEADER).fill(0);
  cab[H.fieldW] = 1000;
  cab[H.fieldH] = 800;
  cab[H.nBots] = nB;
  cab[H.focus] = o.foco ?? 0;
  cab[H.rich] = o.rica ? 1 : 0;
  cab[H.cycle] = 10;
  const partes = [cab];
  for (const [slot, , , nrg] of o.bots) {
    const b = new Array(REG.bot).fill(0);
    b[BOT.idx] = slot;
    b[BOT.nrg] = nrg;
    b[BOT.body] = nrg / 10;
    b[BOT.venom] = slot;
    b[BOT.color] = 0x0000ff;
    b[BOT.r] = 30;
    b[BOT.flags] = slot === o.cadaver ? FLAG.corpse : 0;
    partes.push(b);
  }
  if (o.foco) {
    const f = new Array(REG.focus).fill(0);
    f[FOCO.aim] = 1;
    f[FOCO.r] = 30;
    f[FOCO.ojoFoco] = 4;
    f[FOCO.edad] = 77;
    f[FOCO.nrg] = 1234.5;
    f[FOCO.body] = 99;
    for (let a = 0; a < 9; a++) {
      f[FOCO.ojos + a * REG_OJO + OJO.esd] = 100 + a;
      f[FOCO.ojos + a * REG_OJO + OJO.visto] = a === 4 ? 25 : 0;
    }
    partes.push(f);
  }
  if (o.rica) {
    for (const [, abs, madre] of o.bots) {
      const q = new Array(REG.vis).fill(0);
      q[VIS.abs] = abs;
      q[VIS.madre] = madre;
      q[VIS.gen] = 3;
      q[VIS.mut] = 2;
      q[VIS.especie] = 1;
      partes.push(q);
    }
  }
  return decodificarFrame(new Float32Array(partes.flat()));
}

// abuela 10 (sembrada) → madre 20 → yo 30 → hijos 40 y 41; 50 es de otra rama.
const FAMILIA = [
  [1, 10, 0, 500],
  [2, 20, 10, 800],
  [3, 30, 20, 1500],
  [4, 40, 30, 200],
  [5, 41, 30, 300],
  [6, 50, 99, 3000],
];

test('filaDe y datosBot: registro, foco y vista enriquecida', () => {
  const f = armar({ bots: FAMILIA, foco: 3, rica: true });
  assert.equal(filaDe(f, 3), 2);
  assert.equal(filaDe(f, 77), -1);
  assert.equal(filaDe(f, 0), -1);
  const d = datosBot(f, 3);
  assert.ok(d);
  assert.equal(d.abs, 30);
  assert.equal(d.madre, 20);
  assert.equal(d.gen, 3);
  assert.equal(d.nrg, 1234.5, 'con foco, la energía sale del bloque de foco');
  assert.equal(d.body, 99);
  assert.equal(d.edad, 77);
  assert.equal(d.venom, 3);
  assert.equal(d.ojoFoco, 4);
  assert.equal(d.ojos.length, 9);
  assert.equal(d.ojos[4].visto, 25);
  assert.equal(d.ojos[8].alcance, 108);
  // otro bot del mismo frame: sin bloque de foco
  const otro = datosBot(f, 4);
  assert.ok(otro);
  assert.equal(otro.foco, false);
  assert.equal(otro.nrg, 200);
  assert.deepEqual(otro.ojos, []);
  assert.equal(datosBot(f, 42), null);
});

test('datosBot sin vista enriquecida marca lo que falta', () => {
  const f = armar({ bots: FAMILIA, foco: 3 });
  const d = datosBot(f, 3);
  assert.ok(d);
  assert.equal(d.rica, false);
  assert.equal(d.abs, 0);
  assert.equal(d.gen, -1);
  assert.equal(d.mut, -1);
  assert.equal(d.especie, -1);
  assert.equal(d.edad, 77);
  assert.equal(parientes(f, 30), null);
});

test('maximosDelMundo ignora cadáveres; fraccion acota', () => {
  const f = armar({ bots: FAMILIA, cadaver: 6 });
  const m = maximosDelMundo(f);
  assert.equal(m.nrg, 1500);
  assert.equal(m.venom, 5);
  assert.equal(m.shell, 1, 'nunca menos de 1');
  assert.equal(fraccion(750, 1500), 0.5);
  assert.equal(fraccion(3000, 1500), 1);
  assert.equal(fraccion(-5, 10), 0);
  assert.equal(fraccion(5, 0), 0);
});

test('parientes: madre, hijos vivos, ancestros y fundador', () => {
  const f = armar({ bots: FAMILIA, rica: true });
  const p = parientes(f, 30);
  assert.ok(p);
  assert.deepEqual(p.madre, { abs: 20, slot: 2 });
  assert.deepEqual(p.hijos, [
    { abs: 40, slot: 4 },
    { abs: 41, slot: 5 },
  ]);
  assert.deepEqual(p.ancestros, [
    { abs: 20, slot: 2 },
    { abs: 10, slot: 1 },
  ]);
  assert.deepEqual(p.fundador, { abs: 10, slot: 1 });
  // madre muerta: se nombra sin enlace y la cadena se corta (sin fundador)
  const q = parientes(f, 50);
  assert.ok(q);
  assert.deepEqual(q.madre, { abs: 99, slot: 0 });
  assert.deepEqual(q.ancestros, []);
  assert.equal(q.fundador, null);
  // un bot sembrado no tiene madre ni fundador
  const r = parientes(f, 10);
  assert.ok(r);
  assert.equal(r.madre, null);
  assert.equal(r.fundador, null);
  assert.equal(parientes(f, 12345), null);
});

test('parientes no se cuelga con un ciclo de madres', () => {
  const f = armar({
    bots: [
      [1, 1, 2, 10],
      [2, 2, 1, 10],
    ],
    rica: true,
  });
  const p = parientes(f, 1);
  assert.ok(p);
  assert.deepEqual(
    p.ancestros.map((a) => a.abs),
    [2],
  );
});

test('resumenFamilia lee la respuesta de family', () => {
  assert.deepEqual(resumenFamilia({ n: 3, total: 12, highlighted: 13, lines: new Array(21) }), {
    n: 3,
    total: 12,
    resaltados: 13,
    enlaces: 3,
  });
  assert.deepEqual(resumenFamilia({ n: 0, total: 0, highlighted: 0, lines: null }), {
    n: 0,
    total: 0,
    resaltados: 0,
    enlaces: 0,
  });
  assert.deepEqual(resumenFamilia(undefined), { n: 0, total: 0, resaltados: 0, enlaces: 0 });
});

test('cabeceraAdn lee generación y mutaciones del texto del bot', () => {
  const txt = "'#generation: 14\r\n'#mutations: 7\r\ncond\r\nstart\r\nstop\r\n";
  assert.deepEqual(cabeceraAdn(txt), { gen: 14, mut: 7 });
  assert.deepEqual(cabeceraAdn('cond start stop'), { gen: -1, mut: -1 });
});

test('arcoOjo: largo sin ver y viendo, ángulos en [0, 2π)', () => {
  const ojo = { dir: 0, medio: 0.1, alcance: 1000, visto: 0 };
  const a = arcoOjo(0, 4, ojo, 30);
  assert.equal(a.largo, 1060);
  assert.ok(a.hi >= 0 && a.hi < 2 * Math.PI + 1e-6);
  assert.ok(a.lo >= 0 && a.lo < 2 * Math.PI + 1e-6);
  const viendo = arcoOjo(0, 4, { ...ojo, visto: 100 }, 30);
  assert.ok(Math.abs(viendo.largo - (0.1 * 1030 + 30)) < 1e-9);
  // el centro del arco del ojo a es aim + π/4 − a·π/18 − π/36 + dir
  const b = arcoOjo(1, 4, ojo, 30);
  const centro = (b.hi + b.lo) / 2;
  assert.ok(Math.abs(centro - (1 + PIV / 4 - (PIV / 18) * 4 - PIV / 36)) < 1e-6);
});

test('SerieCiclos: ventana, mismo ciclo, retroceso y camino', () => {
  const s = new SerieCiclos(100);
  assert.equal(s.camino(330, 60), '');
  s.agregar(0, 10);
  s.agregar(50, 20);
  s.agregar(50, 30); // pausa: reemplaza
  assert.deepEqual(s.valores, [10, 30]);
  s.agregar(120, 40); // el ciclo 0 queda fuera de la ventana [20, 120]
  assert.deepEqual(s.ciclos, [50, 120]);
  s.agregar(Number.NaN, 5);
  assert.equal(s.largo, 2);
  const c = s.camino(100, 42);
  assert.match(c, /^M\d+(\.\d)? [\d.]+L100\.0 1\.0$/);
  assert.ok(c.startsWith('M30.0 '), 'x = (50 − 20) / 100 · 100');
  s.agregar(5, 1); // sim nueva: el ciclo retrocede
  assert.deepEqual(s.ciclos, [5]);
  s.limpiar();
  assert.equal(s.largo, 0);
});

test('SerieCiclos: valores negativos llevan el piso por debajo de 0', () => {
  const s = new SerieCiclos(10);
  s.agregar(1, -10);
  s.agregar(2, 10);
  assert.equal(s.camino(10, 22), 'M9.0 21.0L10.0 1.0', 'la ventana termina en el último ciclo');
});

test('resaltado del ADN: clases y texto intacto', () => {
  assert.equal(claseDe('cond'), 'clave');
  assert.equal(claseDe('STOP'), 'clave');
  assert.equal(claseDe('*.eye5'), 'sysvar');
  assert.equal(claseDe('.shoot'), 'sysvar');
  assert.equal(claseDe('-1'), 'num');
  assert.equal(claseDe('*310'), 'num');
  assert.equal(claseDe('store'), 'op');
  assert.equal(claseDe('add'), '');
  assert.equal(claseDe('.50'), '', '.50 no es un sysvar ni un número');
  const linea = "  *.eye5 45 >= 'mira al frente";
  const toks = tokensLinea(linea);
  assert.equal(toks.map((x) => x.s).join(''), linea);
  assert.deepEqual(
    toks.filter((x) => x.c).map((x) => x.c),
    ['sysvar', 'num', 'com'],
  );
  const lineas = resaltarAdn(
    "'#generation: 2\r\ncond\r\n*.nrg 100 >\r\nstart\r\n-1 .shoot store\r\nstop\r\n\r\n\0\0",
  );
  assert.equal(lineas.length, 6, 'sin las líneas vacías del final ni los NUL');
  assert.deepEqual(lineas[0], [{ c: 'com', s: "'#generation: 2" }]);
  assert.deepEqual(
    lineas[4].filter((x) => x.c).map((x) => x.c),
    ['num', 'sysvar', 'op'],
  );
});

test('printmem y consultas de memoria', () => {
  assert.deepEqual(parsearPrintmem(' 310-> 1234'), { dir: 310, valor: 1234 });
  assert.deepEqual(parsearPrintmem(' 7-> -3'), { dir: 7, valor: -3 });
  assert.equal(parsearPrintmem('Up: 0 Dn: 0'), null);
  assert.equal(parsearPrintmem(undefined), null);
  assert.equal(normalizarConsulta('nrg'), '.nrg');
  assert.equal(normalizarConsulta(' *.Eye5 '), '.Eye5', 'respeta mayúsculas (privadas)');
  assert.equal(normalizarConsulta('310'), '310');
  assert.equal(normalizarConsulta('1000'), '');
  assert.equal(normalizarConsulta('0'), '');
  assert.equal(normalizarConsulta('.a b'), '');
});

test('LectorMemoria: pide la dirección, consulta y consume solo lo suyo', () => {
  /** @type {any[]} */
  const enviados = [];
  const l = new LectorMemoria((m) => enviados.push(m));
  l.leer(['.nrg']);
  assert.equal(enviados.length, 0, 'sin bot no pide nada');
  l.bot = 3;
  l.leer(['.nrg', '.nada', '12']);
  l.leer(['.nrg', '12']); // la dirección ya está pedida y el 12 en camino: no se repiten
  assert.deepEqual(enviados, [
    { t: 'sysvar', id: 'inspector:.nrg', name: '.nrg' },
    { t: 'sysvar', id: 'inspector:.nada', name: '.nada' },
    { t: 'console-cmd', n: 3, line: '? 12' },
  ]);
  enviados.length = 0;
  assert.equal(l.alSysvar({ t: 'sysvar', id: 7, v: 1 }), false, 'id ajeno');
  assert.equal(l.alSysvar({ t: 'sysvar', id: 'inspector:.nrg', v: 310 }), true);
  assert.deepEqual(enviados, [{ t: 'console-cmd', n: 3, line: '? 310' }]);
  assert.equal(l.valor('.nrg'), undefined);
  assert.equal(l.alConsola({ n: 4, text: ' 310-> 55' }), false, 'otro bot');
  assert.equal(l.alConsola({ n: 3, text: ' 311-> 55' }), false, 'no la pidió');
  assert.equal(l.alConsola({ n: 3, text: ' 310-> 55' }), true);
  assert.equal(l.valor('.nrg'), 55);
  assert.equal(l.alConsola({ n: 3, text: ' 310-> 56' }), false, 'ya respondida');
  assert.equal(l.alConsola({ n: 3, text: ' 12-> 9' }), true);
  assert.deepEqual(
    [...l.valores],
    [
      [310, 55],
      [12, 9],
    ],
  );
  // respondida, se puede volver a pedir
  enviados.length = 0;
  l.leer(['.nrg']);
  assert.deepEqual(enviados, [{ t: 'console-cmd', n: 3, line: '? 310' }]);
  assert.equal(l.alConsola({ n: 3, text: ' 310-> 57' }), true);
  // otro bot: los valores se olvidan, las direcciones de sysvars no
  l.bot = 4;
  assert.equal(l.valor('.nrg'), undefined);
  assert.equal(l.direccion('.nrg'), 310);
});

test('LectorMemoria: privadas del bot con `? .nombre` y su barrera', () => {
  /** @type {any[]} */
  const enviados = [];
  const l = new LectorMemoria((m) => enviados.push(m));
  l.bot = 5;
  l.leer(['.Contador', '.nada']);
  enviados.length = 0;
  // no son sysvars (SysvarTok sin bot da 0): se consultan por nombre, tal cual
  l.alSysvar({ t: 'sysvar', id: 'inspector:.Contador', v: 0 });
  l.alSysvar({ t: 'sysvar', id: 'inspector:.nada', v: 0 });
  assert.deepEqual(enviados, [
    { t: 'console-cmd', n: 5, line: '? .Contador' },
    { t: 'sysvar', id: 'inspector:tras:1', name: '' },
    { t: 'console-cmd', n: 5, line: '? .nada' },
    { t: 'sysvar', id: 'inspector:tras:2', name: '' },
  ]);
  assert.equal(l.direccion('.Contador'), undefined, 'todavía no se sabe');
  // .Contador responde antes de su barrera; .nada no responde
  assert.equal(l.alConsola({ n: 5, text: ' 971-> 42' }), true);
  assert.equal(l.alSysvar({ t: 'sysvar', id: 'inspector:tras:1', v: 0 }), true);
  assert.equal(l.alSysvar({ t: 'sysvar', id: 'inspector:tras:2', v: 0 }), true);
  assert.equal(l.direccion('.Contador'), 971);
  assert.equal(l.valor('.Contador'), 42);
  assert.equal(l.direccion('.nada'), 0, 'el bot no la tiene');
  // la segunda vez va por dirección; la inexistente no se vuelve a pedir
  enviados.length = 0;
  l.leer(['.Contador', '.nada']);
  assert.deepEqual(enviados, [{ t: 'console-cmd', n: 5, line: '? 971' }]);
  // otro bot: las privadas se vuelven a averiguar
  l.bot = 6;
  assert.equal(l.direccion('.Contador'), undefined);
});

test('LectorMemoria: la barrera al cambiar de pestaña tapa las respuestas tardías', () => {
  /** @type {any[]} */
  const enviados = [];
  const l = new LectorMemoria((m) => enviados.push(m));
  l.bot = 3;
  l.olvidarPendientes();
  assert.equal(enviados.length, 0, 'sin consultas en camino no hace falta barrera');
  l.leer(['12', '13']);
  enviados.length = 0;
  l.olvidarPendientes();
  assert.deepEqual(enviados, [{ t: 'sysvar', id: 'inspector:barrera:1', name: '' }]);
  assert.equal(l.enBarrera, true);
  // antes de la barrera: todo lo que parece printmem es del inspector
  assert.equal(l.alConsola({ n: 3, text: ' 12-> 1' }), true);
  assert.equal(l.alConsola({ n: 3, text: ' 13-> 2' }), true);
  assert.equal(l.alConsola({ n: 3, text: 'EyeN: 0 0 0' }), false, 'otra salida pasa');
  assert.equal(l.valor('12'), undefined, 'olvidada: no se guarda');
  assert.equal(l.alSysvar({ t: 'sysvar', id: 'inspector:barrera:1', v: 0 }), true);
  assert.equal(l.enBarrera, false);
  // después de la barrera: un `? 12` del usuario va a la consola
  assert.equal(l.alConsola({ n: 3, text: ' 12-> 1' }), false);
});

test('consola: salida con tope, historial y verbo', () => {
  const s = new SalidaConsola(20);
  s.agregar('0123456789');
  s.agregar('abcdefghij');
  assert.deepEqual(s.lineas, ['abcdefghij'], 'se descartan las viejas');
  s.agregar('x\ny');
  assert.equal(s.texto, 'abcdefghij\nx\ny');
  s.agregar('una línea mucho más larga que el tope');
  assert.equal(s.lineas.length, 1, 'la última nunca se descarta');
  s.limpiar();
  assert.equal(s.texto, '');

  const h = new HistorialComandos();
  assert.equal(h.anterior(), '');
  h.agregar('printeye');
  h.agregar('printeye'); // repetido seguido: una vez
  h.agregar('  ');
  h.agregar('? .nrg');
  assert.deepEqual(h.comandos, ['printeye', '? .nrg']);
  assert.equal(h.anterior(), '? .nrg');
  assert.equal(h.anterior(), 'printeye');
  assert.equal(h.anterior(), 'printeye');
  assert.equal(h.siguiente(), '? .nrg');
  assert.equal(h.siguiente(), '');

  assert.equal(verbo('  Help me'), 'help');
  assert.equal(verbo(''), '');
});

test('consola: con torneo en curso solo pasan los comandos que leen (T8)', () => {
  for (const v of MODIFICAN) assert.ok(v in COMANDOS, v);
  assert.deepEqual([...MODIFICAN].sort(), ['cycle', 'energy', 'execrob', 'pause', 'play', 'set']);
  for (const v of ['printeye', 'printtouch', 'printtaste', 'printmem', '?', 'showdna', 'debug'])
    assert.equal(MODIFICAN.has(v), false, v);
});

test('hayQueCambiarBot: otro slot, o el mismo slot después de una muerte', () => {
  assert.equal(hayQueCambiarBot(7, 3, false), true);
  assert.equal(hayQueCambiarBot(3, 3, false), false, 'el mismo bot vivo');
  assert.equal(hayQueCambiarBot(3, 3, true), true, 'slot reutilizado: no queda en «murió»');
  assert.equal(hayQueCambiarBot(0, 3, true), false, 'sin foco se queda mostrando la muerte');
});

test('SerieCiclos.lineaBase: el 0 abajo sin negativos, adentro con negativos', () => {
  const s = new SerieCiclos(1000);
  s.agregar(0, 10);
  s.agregar(10, 20);
  assert.equal(s.lineaBase(60), 59);
  const ys = [...s.camino(330, 60).matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...ys) <= 59, 'el trazo no pasa la línea base');
  s.agregar(20, -20);
  const b = s.lineaBase(60);
  assert.ok(b > 1 && b < 59, `base ${b}`);
  assert.equal(b, 1 + 58 - (20 / 40) * 58);
});
