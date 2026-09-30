// @ts-check
// Vistas previas de Inicio (paso N1.6). Puro:
//   puntosVista(escenario, W, H)  puntos sintéticos deterministas por
//                                 escenario (sus especies, cantidades y
//                                 colores) y las siluetas de sus objetos
//   puntosDeFrame(frame, max)     los bots de un frame real, en fracciones
//                                 del campo (copia: el búfer vuelve al worker)

import { vbACss } from '../mundo/color.js';
import { BOT, FLAG, offBot } from '../sim/frame.js';

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {{ x: number, y: number, r: number, color: string, veg: boolean }} Punto
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{ puntos: Punto[], muros: Rect[], portales: { x: number, y: number, r: number }[] }} Vista
 */

/** Puntos que reparte la vista previa entre todas las especies. */
export const PUNTOS_VISTA = 40;

/**
 * FNV-1a de 32 bits (la semilla de la vista sale del id del escenario).
 * @param {string} s
 */
export function hashTexto(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Generador de Park-Miller (el del boceto) con semilla en [1, 2^31-2].
 * @param {number} semilla
 * @returns {() => number} en [0, 1)
 */
export function generador(semilla) {
  let s = (Math.abs(Math.trunc(semilla)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** @param {number} v @param {number} a @param {number} b */
const entre = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Siluetas de los objetos del escenario (en unidades de la vista).
 * @param {Escenario} e @param {number} W @param {number} H @param {() => number} r
 * @returns {{ muros: Rect[], portales: { x: number, y: number, r: number }[] }}
 */
function objetosVista(e, W, H, r) {
  /** @type {Rect[]} */
  const muros = [];
  const g = Math.max(1.5, H / 40);
  for (const o of e.objetos?.obstaculos ?? []) {
    if (o.tipo === 'laberinto') {
      if (o.forma === 'h')
        for (let i = 1; i < 4; i++)
          muros.push({ x: i % 2 ? 0 : W * 0.2, y: (H * i) / 4, w: W * 0.8, h: g });
      else if (o.forma === 'v')
        for (let i = 1; i < 6; i++)
          muros.push({ x: (W * i) / 6, y: i % 2 ? 0 : H * 0.2, w: g, h: H * 0.8 });
      else if (o.forma === 'spiral') {
        // Anillos concéntricos abiertos, como una espiral vista de lejos.
        for (let k = 0; k < 3; k++) {
          const m = (k + 1) * Math.min(W, H) * 0.14;
          const x0 = m * (W / H);
          muros.push({ x: x0, y: m, w: W - 2 * x0, h: g });
          muros.push({ x: x0, y: H - m, w: (W - 2 * x0) * 0.7, h: g });
          muros.push({ x: x0, y: m, w: g, h: H - 2 * m });
          muros.push({ x: W - x0, y: m, w: g, h: (H - 2 * m) * 0.8 });
        }
      } else
        for (let i = 1; i < 5; i++)
          for (let j = 1; j < 3; j++)
            if ((i + j) % 2) muros.push({ x: (W * i) / 5, y: (H * j) / 3, w: W / 8, h: g });
    } else {
      const n = o.tipo === 'formas' ? 10 : 1;
      for (let i = 0; i < n; i++) {
        const w = Math.max(g, o.ancho * W);
        const h = Math.max(g, o.alto * H);
        muros.push({ x: r() * (W - w), y: r() * (H - h), w, h });
      }
    }
  }
  const portales = (e.objetos?.teleporters ?? []).map(() => ({
    x: W * (0.1 + 0.8 * r()),
    y: H * (0.15 + 0.7 * r()),
    r: H / 10,
  }));
  return { muros, portales };
}

/**
 * Vista previa determinista de un escenario: ~PUNTOS_VISTA puntos repartidos
 * según la cantidad de cada especie (al menos 2 por especie), los vegetales
 * dispersos por todo el campo y los animales agrupados en franjas; más las
 * siluetas de obstáculos y teleporters. Mismo escenario → misma vista.
 * @param {Escenario} e @param {number} W @param {number} H
 * @returns {Vista}
 */
export function puntosVista(e, W, H) {
  const r = generador(hashTexto(e.id));
  const esp = e.especies ?? [];
  const total = esp.reduce((a, s) => a + s.cantidad, 0) || 1;
  const animales = esp.filter((s) => !s.vegetal);
  /** @type {Punto[]} */
  const puntos = [];
  const radio = Math.max(1.5, H / 32);
  for (const s of esp) {
    const n = entre(Math.round((s.cantidad * PUNTOS_VISTA) / total), 2, 30);
    const k = animales.indexOf(s);
    const cx = s.vegetal ? 0.5 : (k + 1) / (animales.length + 1);
    const cy = s.vegetal ? 0.5 : 0.35 + 0.3 * r();
    const sd = s.vegetal ? 0.6 : 0.3;
    for (let i = 0; i < n; i++) {
      const x = entre((cx + (r() + r() + r() - 1.5) * sd) * W, radio, W - radio);
      const y = entre((cy + (r() + r() + r() - 1.5) * sd) * H, radio, H - radio);
      puntos.push({
        x,
        y,
        r: s.vegetal ? radio : radio * (0.8 + 0.5 * r()),
        color: s.color,
        veg: s.vegetal,
      });
    }
  }
  return { puntos, ...objetosVista(e, W, H, r) };
}

/**
 * Los bots de un frame en fracciones del campo (x, y en [0,1]; r relativo
 * al alto), a lo sumo `max` (muestreo parejo). Los cadáveres no cuentan.
 * @param {import('../sim/frame.js').Frame} f @param {number} [max]
 * @returns {Punto[]}
 */
export function puntosDeFrame(f, max = 600) {
  const n = f.nBots | 0;
  if (!(n > 0) || !(f.W > 0) || !(f.H > 0)) return [];
  const paso = Math.max(1, n / max);
  /** @type {Punto[]} */
  const out = [];
  for (let k = 0; k < n && out.length < max; k += paso) {
    const o = offBot(f, Math.floor(k));
    const flags = f.v[o + BOT.flags];
    if (flags & FLAG.corpse) continue;
    out.push({
      x: f.v[o + BOT.x] / f.W,
      y: f.v[o + BOT.y] / f.H,
      r: f.v[o + BOT.r] / f.H,
      color: vbACss(f.v[o + BOT.color]),
      veg: (flags & FLAG.veg) !== 0,
    });
  }
  return out;
}
