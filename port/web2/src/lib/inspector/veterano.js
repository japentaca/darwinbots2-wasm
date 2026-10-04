// @ts-check
// Herramientas de veterano del inspector (paso N4.1, decisión 15), sin DOM:
// Player Bot Mode (teclas, presets y archivos .pbkp), diseñador de ojos
// (conversión de texto a Integer, texto para el ADN) y los mensajes al
// worker de engine/worker.js que las usan (pb, pb-keys, pb-key, pb-mouse,
// setmem).
//
// Reproducibilidad (decisión 13): el Player Bot y lo que el diseñador de ojos
// escribe en la memoria de un bot (setmem, «Reiniciar la puntería») actúan
// sobre un individuo y no se registran como eventos de la corrida: las
// réplicas y «Repetir» no los repiten (la interfaz lo avisa). Los botones de
// «Accesibilidad» que cambian opciones (costos y movimiento browniano) sí
// son cambios en caliente registrados (aplicarCambioVivo).

import { mensajeVivo } from '../../../engine/opciones.js';
import { SYSVARS } from '../bots/editor/vocabulario.js';
import { BOT, FLAG, offBot, offVis, VIS } from '../sim/frame.js';

/** Direcciones de memoria (sysvars; tabla del core). */
export const EYE1DIR = 521;
export const EYE1WIDTH = 531;
export const SETAIM = 19;
/** Ojos por bot. */
export const N_OJOS = 9;

// ---- Player Bot: teclas ------------------------------------------------------

/**
 * Una tecla del Player Bot: mientras está apretada (o suelta, si `invertir`),
 * el motor escribe `valor` en `memloc` del bot con foco en cada ciclo.
 * `codigo` es KeyboardEvent.code ('ArrowUp', 'KeyW', 'Space'…).
 * @typedef {{ codigo: string, memloc: number, valor: number, invertir: boolean }} TeclaPb
 */

/** Rango de memloc que acepta el diálogo de teclas (enteros 1..999). */
export const MEMLOC_MIN = 1;
export const MEMLOC_MAX = 999;
/** Rango de valores (enteros −32000..32000). */
export const VALOR_MIN = -32000;
export const VALOR_MAX = 32000;

/**
 * Presets de teclas. `flechas` es el juego fijo de la interfaz clásica
 * (flechas = motor a 40, espacio = .shoot −1). Ojo con los laterales: la
 * dirección 3 (`.sx`) empuja al bot hacia su izquierda y la 4 (`.dx`) hacia
 * su derecha, aunque memmap.hpp las llame dirdx = 3 y dirsx = 4 (comprobado
 * con el core: con .aim 0, `.sx` le baja la y). Por eso → y D escriben en la
 * 4 y ← y A en la 3 (hasta el 2026-10-04 estaban al revés).
 */
export const PRESETS_PB = Object.freeze({
  flechas: Object.freeze([
    { codigo: 'ArrowUp', memloc: 1, valor: 40, invertir: false },
    { codigo: 'ArrowDown', memloc: 2, valor: 40, invertir: false },
    { codigo: 'ArrowRight', memloc: 4, valor: 40, invertir: false },
    { codigo: 'ArrowLeft', memloc: 3, valor: 40, invertir: false },
    { codigo: 'Space', memloc: 7, valor: -1, invertir: false },
  ]),
  wasd: Object.freeze([
    { codigo: 'KeyW', memloc: 1, valor: 40, invertir: false },
    { codigo: 'KeyS', memloc: 2, valor: 40, invertir: false },
    { codigo: 'KeyD', memloc: 4, valor: 40, invertir: false },
    { codigo: 'KeyA', memloc: 3, valor: 40, invertir: false },
    { codigo: 'Space', memloc: 7, valor: -1, invertir: false },
  ]),
  vacio: Object.freeze([]),
});

/** @typedef {keyof typeof PRESETS_PB} NombrePreset */

/**
 * Copia editable de un preset.
 * @param {NombrePreset} nombre
 * @returns {TeclaPb[]}
 */
export function preset(nombre) {
  const p = PRESETS_PB[nombre];
  if (!p) throw new Error(`preset desconocido: ${nombre}`);
  return p.map((k) => ({ ...k }));
}

/**
 * El preset que coincide exactamente con las teclas, o null (personalizado).
 * @param {readonly TeclaPb[]} teclas
 * @returns {NombrePreset | null}
 */
export function presetDe(teclas) {
  for (const [nombre, p] of Object.entries(PRESETS_PB)) {
    if (p.length !== teclas.length) continue;
    const igual = p.every(
      (k, i) =>
        k.codigo === teclas[i].codigo &&
        k.memloc === teclas[i].memloc &&
        k.valor === teclas[i].valor &&
        k.invertir === !!teclas[i].invertir,
    );
    if (igual) return /** @type {NombrePreset} */ (nombre);
  }
  return null;
}

/** Sysvar por nombre, sin el punto y sin distinguir mayúsculas (primera de la tabla). */
const PORNOMBRE = new Map();
/** Nombre de cada dirección (el primero de la tabla: sin alias). */
const PORDIR = new Map();
for (const [n, d] of SYSVARS) {
  if (!PORNOMBRE.has(n.toLowerCase())) PORNOMBRE.set(n.toLowerCase(), d);
  if (!PORDIR.has(d)) PORDIR.set(d, n);
}

/**
 * memloc de un texto: un entero (1..999) o el nombre de un sysvar, con o sin
 * punto (`.up`, `up`). null si no vale.
 * @param {string | number} texto
 * @returns {number | null}
 */
export function leerMemloc(texto) {
  const s = String(texto ?? '').trim();
  if (!s) return null;
  let d;
  if (/^[+-]?\d+$/.test(s)) d = Number(s);
  else d = PORNOMBRE.get(s.replace(/^\./, '').toLowerCase());
  if (d === undefined || !Number.isInteger(d)) return null;
  return d >= MEMLOC_MIN && d <= MEMLOC_MAX ? d : null;
}

/**
 * Nombre de sysvar de una dirección (`.up`), o el número si no tiene.
 * @param {number} memloc
 */
export function nombreMemloc(memloc) {
  const n = PORDIR.get(memloc);
  return n ? `.${n}` : String(memloc);
}

/**
 * Lo que se muestra junto al campo «Memoria» de una fila: el número de la
 * dirección cuando el texto es un sysvar ('' si ya es un número o no vale) y
 * hacia dónde empuja si es un lateral (null si no lo es): la 3 (.sx) empuja
 * al bot hacia su izquierda y la 4 (.dx) hacia su derecha.
 * @param {string | number} texto
 * @returns {{ numero: string, lateral: 'derecha' | 'izquierda' | null }}
 */
export function detalleMemloc(texto) {
  const d = leerMemloc(texto);
  if (d === null) return { numero: '', lateral: null };
  const esNumero = /^[+-]?\d+$/.test(String(texto).trim());
  const lateral = d === 3 ? 'izquierda' : d === 4 ? 'derecha' : null;
  return { numero: esNumero ? '' : String(d), lateral };
}

/**
 * ¿Las dos listas de teclas son iguales (mismo orden)?
 * @param {readonly TeclaPb[]} a @param {readonly TeclaPb[]} b
 */
export function mismasTeclas(a, b) {
  return (
    a.length === b.length &&
    a.every(
      (k, i) =>
        k.codigo === b[i].codigo &&
        k.memloc === b[i].memloc &&
        k.valor === b[i].valor &&
        !!k.invertir === !!b[i].invertir,
    )
  );
}

/** Teclas de cada modificador (KeyboardEvent.code). */
const MODIFICADORES = Object.freeze({
  ctrlKey: ['ControlLeft', 'ControlRight'],
  altKey: ['AltLeft', 'AltRight'],
  metaKey: ['MetaLeft', 'MetaRight'],
});

/**
 * ¿La pulsación lleva un modificador que no es una tecla del Player Bot?
 * (Ctrl+S, Alt+Tab… son del navegador.) Un modificador asignado a una fila
 * no cuenta: apretarlo, o apretar otra tecla del modo mientras se lo tiene
 * apretado, es jugar.
 * @param {readonly TeclaPb[]} teclas
 * @param {{ ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean }} e
 */
export function modificadorAjeno(teclas, e) {
  for (const [mod, codigos] of Object.entries(MODIFICADORES)) {
    if (!e[/** @type {keyof typeof MODIFICADORES} */ (mod)]) continue;
    if (!teclas.some((k) => codigos.includes(k.codigo))) return true;
  }
  return false;
}

/**
 * A quién controla el Player Bot en un frame: el bot con foco (slot, AbsNum y
 * especie si la vista es la enriquecida) y cuántos resaltados más (hijos
 * nacidos bajo control y familia marcada: el motor los controla también).
 * @param {import('../sim/frame.js').Frame} f
 * @returns {{ foco: number, abs: number, especie: number, resaltados: number }}
 */
export function controlados(f) {
  const foco = f.foco > 0 ? f.foco : 0;
  const rica = f.rica && f.of.vis >= 0;
  let abs = 0;
  let especie = -1;
  let resaltados = 0;
  for (let i = 0; i < f.nBots; i++) {
    const o = offBot(f, i);
    const slot = f.v[o + BOT.idx];
    if (foco && slot === foco) {
      if (rica) {
        abs = f.v[offVis(f, i) + VIS.abs];
        especie = f.v[offVis(f, i) + VIS.especie];
      }
    } else if ((f.v[o + BOT.flags] | 0) & FLAG.highlight) {
      resaltados++;
    }
  }
  return { foco, abs, especie, resaltados };
}

/**
 * Valor de una tecla: entero en −32000..32000. null si no vale.
 * @param {string | number} texto
 * @returns {number | null}
 */
export function leerValor(texto) {
  const s = String(texto ?? '').trim();
  if (!/^[+-]?\d+$/.test(s)) return null;
  const v = Number(s);
  return v >= VALOR_MIN && v <= VALOR_MAX ? v : null;
}

/**
 * Mensaje {t:'pb-keys'} con las teclas en orden: el índice de cada una es
 * el `idx` de sus {t:'pb-key'}.
 * @param {readonly TeclaPb[]} teclas
 */
export function mensajeTeclas(teclas) {
  return {
    t: 'pb-keys',
    keys: teclas.map((k) => ({ memloc: k.memloc | 0, value: k.valor | 0, invert: !!k.invertir })),
  };
}

/**
 * Índices de las teclas que responden a `codigo` (puede haber varias).
 * @param {readonly TeclaPb[]} teclas @param {string} codigo
 * @returns {number[]}
 */
export function indicesDe(teclas, codigo) {
  const out = [];
  for (let i = 0; i < teclas.length; i++) if (teclas[i].codigo === codigo) out.push(i);
  return out;
}

/**
 * Estado de las teclas apretadas: traduce keydown/keyup en mensajes pb-key
 * (sin repetir mientras la tecla sigue apretada) y los suelta todos al
 * perder el foco la ventana. Puro: el envío se inyecta.
 */
export class TecladoPb {
  /** @type {Set<string>} */
  #apretadas = new Set();
  /** @type {readonly TeclaPb[]} */
  #teclas = [];
  #enviar;

  /** @param {(msg: any) => void} enviar */
  constructor(enviar) {
    this.#enviar = enviar;
  }

  /**
   * Teclas nuevas (las apretadas se olvidan: el pb-keys nuevo las deja
   * inactivas en el motor).
   * @param {readonly TeclaPb[]} teclas
   */
  ponerTeclas(teclas) {
    this.#teclas = teclas.map((k) => ({ ...k }));
    this.#apretadas.clear();
  }

  /**
   * Una tecla bajó o subió. Devuelve true si es una tecla del Player Bot (el
   * llamador evita entonces su efecto por defecto).
   * @param {string} codigo @param {boolean} abajo
   */
  tecla(codigo, abajo) {
    const idx = indicesDe(this.#teclas, codigo);
    if (!idx.length) return false;
    const antes = this.#apretadas.has(codigo);
    if (abajo === antes) return true; // repetición del teclado
    if (abajo) this.#apretadas.add(codigo);
    else this.#apretadas.delete(codigo);
    for (const i of idx) this.#enviar({ t: 'pb-key', idx: i, active: abajo });
    return true;
  }

  /** Suelta todas las apretadas (la ventana perdió el foco, salir del modo). */
  soltarTodas() {
    for (const c of [...this.#apretadas]) this.tecla(c, false);
  }

  get apretadas() {
    return new Set(this.#apretadas);
  }
}

// ---- Presets en archivo (.pbkp) ----------------------------------------------
// Formato del diálogo de teclas de escritorio: por tecla, cuatro líneas
// (código de tecla virtual, memloc, valor, invertido True/False).

/** KeyboardEvent.code → código de tecla virtual (y la vuelta). */
const VK = new Map([
  ['Backspace', 8],
  ['Tab', 9],
  ['Enter', 13],
  ['ShiftLeft', 16],
  ['ControlLeft', 17],
  ['AltLeft', 18],
  ['Space', 32],
  ['PageUp', 33],
  ['PageDown', 34],
  ['End', 35],
  ['Home', 36],
  ['ArrowLeft', 37],
  ['ArrowUp', 38],
  ['ArrowRight', 39],
  ['ArrowDown', 40],
  ['Insert', 45],
  ['Delete', 46],
  ['NumpadMultiply', 106],
  ['NumpadAdd', 107],
  ['NumpadSubtract', 109],
  ['NumpadDecimal', 110],
  ['NumpadDivide', 111],
]);
for (let i = 0; i < 10; i++) {
  VK.set(`Digit${i}`, 48 + i);
  VK.set(`Numpad${i}`, 96 + i);
}
for (let i = 0; i < 26; i++) VK.set(`Key${String.fromCharCode(65 + i)}`, 65 + i);
for (let i = 1; i <= 12; i++) VK.set(`F${i}`, 111 + i);
const DE_VK = new Map([...VK].map(([c, v]) => [v, c]));
// Los de la derecha comparten código virtual con los de la izquierda.
VK.set('ShiftRight', 16);
VK.set('ControlRight', 17);
VK.set('AltRight', 18);
VK.set('NumpadEnter', 13);

/** @param {string} codigo */
export const codigoVirtual = (codigo) => VK.get(codigo) ?? null;

/**
 * Texto .pbkp de las teclas. Las que no tienen código virtual se omiten y
 * vuelven en `omitidas`.
 * @param {readonly TeclaPb[]} teclas
 * @returns {{ texto: string, omitidas: TeclaPb[] }}
 */
export function aPbkp(teclas) {
  const lineas = [];
  const omitidas = [];
  for (const k of teclas) {
    const vk = VK.get(k.codigo);
    if (vk === undefined) {
      omitidas.push(k);
      continue;
    }
    lineas.push(String(vk), String(k.memloc), String(k.valor), k.invertir ? 'True' : 'False');
  }
  return { texto: lineas.length ? `${lineas.join('\r\n')}\r\n` : '', omitidas };
}

/**
 * Teclas de un texto .pbkp. Las de un código de tecla virtual que esta
 * interfaz no conoce (fuera de la tabla) se omiten y vuelven en `omitidas`
 * (sus códigos). Lanza Error('pbkp') si el archivo no tiene la forma
 * esperada (grupos de cuatro líneas válidas).
 * @param {string} texto
 * @returns {{ teclas: TeclaPb[], omitidas: number[] }}
 */
export function dePbkp(texto) {
  const l = String(texto ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim());
  while (l.length && l[l.length - 1] === '') l.pop();
  if (l.length % 4 !== 0) throw new Error('pbkp');
  /** @type {TeclaPb[]} */
  const out = [];
  /** @type {number[]} */
  const omitidas = [];
  for (let i = 0; i < l.length; i += 4) {
    if (!/^\d+$/.test(l[i])) throw new Error('pbkp');
    const vk = Number(l[i]);
    const codigo = DE_VK.get(vk);
    const memloc = leerMemloc(l[i + 1]);
    const valor = leerValor(l[i + 2]);
    const inv = l[i + 3].toLowerCase();
    if (memloc === null || valor === null) throw new Error('pbkp');
    if (!['true', 'false', '-1', '0', '#true#', '#false#'].includes(inv)) throw new Error('pbkp');
    if (!codigo) {
      omitidas.push(vk);
      continue;
    }
    out.push({
      codigo,
      memloc,
      valor,
      invertir: inv === 'true' || inv === '-1' || inv === '#true#',
    });
  }
  return { teclas: out, omitidas };
}

/**
 * Nombre legible de una tecla (sin traducir: son nombres de teclas).
 * @param {string} codigo
 */
export function nombreTecla(codigo) {
  const flechas = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (codigo in flechas) return flechas[/** @type {keyof typeof flechas} */ (codigo)];
  if (/^Key[A-Z]$/.test(codigo)) return codigo.slice(3);
  if (/^Digit\d$/.test(codigo)) return codigo.slice(5);
  return codigo;
}

// ---- Diseñador de ojos -------------------------------------------------------

/** Redondeo bancario (CInt). @param {number} x */
function redondeoBancario(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * Texto de un campo → Integer (−32768..32767), como asignar el texto de un
 * campo a un entero de 16 bits: número decimal o científico (redondeo
 * bancario), &H hexadecimal o &O octal. null si no es un número o se sale
 * del rango (no se escribe nada).
 * @param {string} texto
 * @returns {number | null}
 */
export function textoAEntero(texto) {
  const t = String(texto).trim();
  let x;
  const hex = /^&H([0-9A-F]+)&?$/i.exec(t);
  const oct = /^&O?([0-7]+)&?$/i.exec(t);
  if (hex) {
    x = parseInt(hex[1], 16);
    if (hex[1].length <= 4 && x > 0x7fff) x -= 0x10000; // &HFFFF = −1
  } else if (oct && t[0] === '&') {
    x = parseInt(oct[1], 8);
  } else if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
    x = redondeoBancario(parseFloat(t));
  } else {
    return null;
  }
  return x < -32768 || x > 32767 ? null : x;
}

/**
 * Líneas del gen que fija los ojos al nacer (el botón «Escribir en el ADN»):
 * los textos de los campos tal cual.
 * @param {readonly (string | number)[]} dir  9 textos de .eyeNdir
 * @param {readonly (string | number)[]} wth  9 textos de .eyeNwidth
 * @returns {string[]}
 */
export function lineasAdnOjos(dir, wth) {
  const l = ['Cond', '*.robage 0 =', 'Start'];
  for (let i = 0; i < N_OJOS; i++) {
    l.push(`${dir[i]} .eye${i + 1}dir store`);
    l.push(`${wth[i]} .eye${i + 1}width store`);
    l.push("'");
  }
  l.push('Stop');
  return l;
}

/**
 * Texto para agregar al ADN (líneas con \n y salto final).
 * @param {readonly (string | number)[]} dir @param {readonly (string | number)[]} wth
 */
export const textoAdnOjos = (dir, wth) => `${lineasAdnOjos(dir, wth).join('\n')}\n`;

/**
 * Mensaje setmem de un campo del diseñador (null si el texto no es un
 * entero válido o no hay bot).
 * @param {number} n bot @param {'dir' | 'ancho'} campo @param {number} ojo 0..8
 * @param {string} texto
 */
export function mensajeOjo(n, campo, ojo, texto) {
  const v = textoAEntero(texto);
  if (v === null || !(n > 0) || !(ojo >= 0 && ojo < N_OJOS)) return null;
  return { t: 'setmem', n: n | 0, addr: (campo === 'dir' ? EYE1DIR : EYE1WIDTH) + ojo, v };
}

/**
 * «Accesibilidad»: los cambios de opciones de los botones del diseñador
 * (costos en 0 con el multiplicador; movimiento browniano apagado).
 */
export const ACCESIBILIDAD = Object.freeze({
  sinCostos: Object.freeze({ 'cost:54': 0 }),
  sinBrowniano: Object.freeze({ 'opt:13': 0 }),
});

/**
 * Aplica cambios de opciones en vivo en un ciclo exacto y los registra como
 * evento de la corrida (decisión 13), como «Aplicar a la actual» de
 * Experimentar.
 * @param {{ sesion: { aplicarEnCiclo?: (m: any[]) => Promise<number> },
 *   registrarCambio: (cambios: Record<string, number>, ciclo?: number) => any }} corrida
 * @param {Readonly<Record<string, number>>} cambios
 */
export async function aplicarCambioVivo(corrida, cambios) {
  const mensajes = Object.entries(cambios).map(([k, v]) => {
    const m = mensajeVivo(k, v);
    if (!m) throw new Error(`requiere sim nueva: ${k}`);
    return m;
  });
  if (!corrida.sesion.aplicarEnCiclo) throw new Error('sin aplicarEnCiclo');
  const ciclo = await corrida.sesion.aplicarEnCiclo(mensajes);
  return corrida.registrarCambio({ ...cambios }, ciclo);
}

// ---- Instantáneas ------------------------------------------------------------

/** Nombres de archivo del registro de muertos (los de escritorio). */
export const ARCHIVOS_MUERTOS = Object.freeze({
  snp: 'DeadRobots.snp',
  mut: 'DeadRobots_Mutations.txt',
});

/**
 * Nombres de los archivos de una instantánea de los vivos a partir de una
 * base ya saneada (sin extensión).
 * @param {string} base
 */
export const archivosVivos = (base) => ({ snp: `${base}.snp`, mut: `${base}_Mutations.txt` });
