// @ts-check
// Vista enriquecida (E6.5 en port/HISTORIA.md): transcripción de
// drawRichBots / drawBotDetail / ingestRichEvents / drawRichOverlays de
// port/web/index.html. Canales: forma = vegetal (hexágono) / animal (círculo
// con nariz al rumbo); tono = color de especie; brillo = nrg (log); anillo =
// acción desde el último frame; con zoom, morfología (shell, slime, púas,
// ojos, estados); eventos de nacimiento y muerte; rastro del bot con foco.
// Todo sale de los volcados del frame: acá no se recalcula nada de la sim.

import {
  BOT,
  ESTADO,
  FLAG,
  MUERE,
  NACE,
  offBot,
  offMuere,
  offNace,
  offVis,
  VIS,
} from '../sim/frame.js';
import { colorDisparo, RAMPA, vbACss } from './color.js';
import { PIV } from './render-clasico.js';

const ANILLO_MS = 350;
const NACE_MS = 600;
const MUERE_MS = 900;
/** Niveles de detalle por radio en pantalla (px). */
const LOD_ANILLO = 1.5;
const LOD_CUERPO = 2.5;
const LOD_DETALLE = 6;
const LOD_FINO = 10;
/** Formas por path: miles de subpaths en uno solo rellenan mucho más lento. */
const TANDA = 64;

/**
 * Anillo de acción: el primer bit que aplica (en este orden) da el color; el
 * disparo toma el color de su tipo de shot. `clave` es la de i18n
 * (`mundo.accion.<clave>`).
 */
export const ANILLOS = Object.freeze([
  { bit: 1, clave: 'reproduccion', color: '#ff4fa3', pulso: true },
  { bit: 0, clave: 'disparo', color: '', pulso: true },
  { bit: 3, clave: 'tie', color: '#e0c070', pulso: false },
  { bit: 6, clave: 'veneno', color: '#8c7bff', pulso: false },
  { bit: 5, clave: 'coraza', color: '#ff9100', pulso: false },
  { bit: 8, clave: 'body', color: '#c9a0ff', pulso: false },
  { bit: 7, clave: 'gana', color: '#76ff03', pulso: false },
  { bit: 2, clave: 'fecundado', color: '#ff80c0', pulso: false },
]);

/** Nombre (clave i18n) de cada bit de acción, en orden de bit. */
export const ACCIONES = Object.freeze([
  'disparo',
  'reproduccion',
  'fecundado',
  'tie',
  'movimiento',
  'coraza',
  'veneno',
  'gana',
  'body',
]);

/**
 * Lentes de «Color por»: fuente = registro de bot o registro enriquecido.
 * @type {Readonly<Record<string, { bot?: number, vis?: number }>>}
 */
export const LENTES = Object.freeze({
  especie: {},
  nrg: { bot: BOT.nrg },
  body: { bot: BOT.body },
  gen: { vis: VIS.gen },
  mut: { vis: VIS.mut },
  edad: { vis: VIS.edad },
  adn: { vis: VIS.dnaLen },
  gendist: { vis: VIS.gendist },
});

/**
 * @typedef {object} PintaRica
 * @property {number} s
 * @property {number} LW
 * @property {[number, number, number, number]} ventana  x0, x1, y0, y1 en unidades de dibujo (mundo·s)
 * @property {number} ahora    ms (performance.now)
 * @property {string} lente
 * @property {boolean} radiosFijos  FixedBotRadii (body pasa a un núcleo claro)
 */

/** Estado entre frames de la vista enriquecida (uno por mundo dibujado). */
export class EstadoRico {
  /** @type {Map<number, { bits: number, t: number, st: number }>} AbsNum → última acción */
  acciones = new Map();
  barrido = 0;
  /** @type {{ x: number, y: number, mx: number, my: number, col: string, t: number }[]} */
  nacimientos = [];
  /** @type {{ x: number, y: number, r: number, col: string, tp: boolean, t: number }[]} */
  muertes = [];
  ultimoCiclo = -1;

  limpiar() {
    this.acciones.clear();
    this.nacimientos.length = 0;
    this.muertes.length = 0;
    this.ultimoCiclo = -1;
  }

  /** ¿Queda algún efecto que se apaga solo (hace falta otro frame)? @param {number} ahora */
  efectosActivos(ahora) {
    if (this.nacimientos.length || this.muertes.length) return true;
    for (const m of this.acciones.values()) if (ahora - m.t < ANILLO_MS) return true;
    return false;
  }
}

/** Rastro del bot con foco (se corta en los saltos del toroide). */
export class Rastro {
  /** @type {([number, number] | null)[]} */
  puntos = [];

  limpiar() {
    this.puntos.length = 0;
  }

  /** @param {number} x @param {number} y @param {number} W */
  agregar(x, y, W) {
    const p = this.puntos;
    const ult = p[p.length - 1];
    if (ult && ult[0] === x && ult[1] === y) return;
    if (ult && Math.hypot(x - ult[0], y - ult[1]) > W / 3) p.push(null);
    p.push([x, y]);
    if (p.length > 160) p.splice(0, p.length - 160);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx @param {number} s @param {number} LW
   * @param {string} [color] color del bot (por defecto blanco)
   */
  dibujar(ctx, s, LW, color = '255,255,255') {
    const p = this.puntos;
    const n = p.length;
    ctx.lineWidth = 1.5 * LW;
    for (let banda = 0; banda < 4; banda++) {
      ctx.strokeStyle = `rgba(${color},${(0.12 + banda * 0.18).toFixed(2)})`;
      ctx.beginPath();
      let pluma = false;
      const fin = Math.min(n, Math.floor(((banda + 1) * n) / 4) + 1);
      for (let i = Math.floor((banda * n) / 4); i < fin; i++) {
        const q = p[i];
        if (!q) {
          pluma = false;
          continue;
        }
        if (pluma) ctx.lineTo(q[0] * s, q[1] * s);
        else {
          ctx.moveTo(q[0] * s, q[1] * s);
          pluma = true;
        }
      }
      ctx.stroke();
    }
    ctx.lineWidth = LW;
  }
}

// ---- Color de relleno: especie × brillo (nrg) × tinte (cloroplastos) --------
/** @type {Map<number, string>} */
const cacheRelleno = new Map();
/** @param {number} col @param {number} nivel @param {number} tinte */
function relleno(col, nivel, tinte) {
  const clave = col * 64 + nivel * 4 + tinte;
  let css = cacheRelleno.get(clave);
  if (css === undefined) {
    const c = col | 0;
    let r = c & 255;
    let g = (c >> 8) & 255;
    let b = (c >> 16) & 255;
    const k = 0.3 + 0.7 * (nivel / 15);
    r = 40 + (r - 40) * k;
    g = 40 + (g - 40) * k;
    b = 40 + (b - 40) * k;
    const t = tinte * 0.15;
    r = r * (1 - t) + 50 * t;
    g = g * (1 - t) + 205 * t;
    b = b * (1 - t) + 70 * t;
    css = `rgb(${r | 0},${g | 0},${b | 0})`;
    if (cacheRelleno.size > 20000) cacheRelleno.clear();
    cacheRelleno.set(clave, css);
  }
  return css;
}
const LOG_NRG = Math.log(32001);
/** @param {number} nrg */
const nivelNrg = (nrg) =>
  nrg > 0 ? Math.min(15, Math.floor((15 * Math.log(1 + nrg)) / LOG_NRG)) : 0;

const HEX_C = [1, 2, 3, 4, 5].map((k) => Math.cos((k * PIV) / 3));
const HEX_S = [1, 2, 3, 4, 5].map((k) => Math.sin((k * PIV) / 3));

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} filas @param {(i: number) => void} agregar @param {() => void} pintar
 */
function enTandas(ctx, filas, agregar, pintar) {
  for (let a = 0; a < filas.length; a += TANDA) {
    ctx.beginPath();
    const b = Math.min(filas.length, a + TANDA);
    for (let j = a; j < b; j++) agregar(filas[j]);
    pintar();
  }
}

/** @template K @param {Map<K, number[]>} m @param {K} k @param {number} i */
function aCubo(m, k, i) {
  let a = m.get(k);
  if (!a) {
    a = [];
    m.set(k, a);
  }
  a.push(i);
}

/**
 * Bots de la vista enriquecida. Devuelve los extremos de la lente sobre los
 * bots presentes (NaN si la lente es «especie» o no hay datos).
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../sim/frame.js').Frame} f
 * @param {EstadoRico} est
 * @param {PintaRica} p
 * @returns {{ min: number, max: number }}
 */
export function dibujarBotsRicos(ctx, f, est, p) {
  const v = f.v;
  const { s, LW, ahora } = p;
  const [vx0, vx1, vy0, vy1] = p.ventana;
  const lente = LENTES[p.lente] ?? LENTES.especie;
  const deBot = lente.bot;
  const deVis = lente.vis;
  const conValor = deBot !== undefined || deVis !== undefined;
  const esGendist = p.lente === 'gendist';
  const nB = f.nBots;
  /** @param {number} i */
  const valor = (i) =>
    deBot !== undefined ? v[offBot(f, i) + deBot] : v[offVis(f, i) + /** @type {number} */ (deVis)];

  let mn = Infinity;
  let mx = -Infinity;
  if (conValor) {
    for (let i = 0; i < nB; i++) {
      if (v[offBot(f, i) + BOT.flags] & FLAG.corpse) continue;
      const val = valor(i);
      if (esGendist && val < 0) continue;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
  }
  const rango = mx > mn ? mx - mn : 1;

  /** @type {Map<string, number[]>} */
  const rellenos = new Map();
  /** @type {Map<string, number[]>} */
  const anillos = new Map();
  /** @type {number[]} */
  const halos = [];
  /** @type {number[]} */
  const detalle = [];
  /** @type {number[]} */
  const contornos = [];
  /** @type {number[]} */
  const narices = [];
  /** @type {number[]} */
  const resaltados = [];
  let filaFoco = -1;
  if (++est.barrido > 120) {
    est.barrido = 0;
    for (const [k, m] of est.acciones) if (ahora - m.t > 1000) est.acciones.delete(k);
  }

  for (let i = 0; i < nB; i++) {
    const o = offBot(f, i);
    const q = offVis(f, i);
    const abs = v[q + VIS.abs];
    const acts = v[q + VIS.acciones];
    if (acts) est.acciones.set(abs, { bits: acts, t: ahora, st: v[q + VIS.shotTipo] });

    const x = v[o + BOT.x] * s;
    const y = v[o + BOT.y] * s;
    const r = Math.max(v[o + BOT.r] * s, 1.2 * LW);
    if (x + r * 2 < vx0 || x - r * 2 > vx1 || y + r * 2 < vy0 || y - r * 2 > vy1) continue;
    const pr = r / LW; // radio en px de pantalla
    const flags = v[o + BOT.flags];
    const cadaver = flags & FLAG.corpse;

    let css;
    if (cadaver) css = '#555';
    else if (conValor) {
      const val = valor(i);
      css =
        esGendist && val < 0
          ? '#3a3f4a'
          : RAMPA[Math.max(0, Math.min(31, Math.round(((val - mn) / rango) * 31)))];
    } else {
      const chl = v[o + BOT.chlr];
      css = relleno(
        v[o + BOT.color],
        nivelNrg(v[o + BOT.nrg]),
        chl > 0 ? Math.min(3, 1 + Math.floor(chl / 8000)) : 0,
      );
    }
    aCubo(rellenos, css, i);

    if (v[o + BOT.idx] === f.foco) filaFoco = i;
    else if (flags & FLAG.highlight) resaltados.push(i);
    if (cadaver) continue;

    if (pr >= LOD_ANILLO) {
      const m = est.acciones.get(abs);
      if (m && ahora - m.t < ANILLO_MS) {
        for (const a of ANILLOS) {
          if (!(m.bits & (1 << a.bit))) continue;
          const nivel = 2 - Math.min(2, Math.floor((3 * (ahora - m.t)) / ANILLO_MS));
          const col = a.color || colorDisparo(m.st);
          aCubo(anillos, `${col}|${nivel}${a.pulso ? '|p' : ''}`, i);
          break;
        }
      }
    }
    if (pr >= LOD_CUERPO) {
      contornos.push(i);
      if (!(flags & FLAG.veg)) narices.push(i);
    }
    if (pr >= LOD_DETALLE) {
      detalle.push(i);
      if (v[o + BOT.slime] > 0.5) halos.push(i);
    }
  }

  /** @param {number} i @returns {[number, number, number]} */
  const geo = (i) => {
    const o = offBot(f, i);
    return [v[o + BOT.x] * s, v[o + BOT.y] * s, Math.max(v[o + BOT.r] * s, 1.2 * LW)];
  };
  const rellenar = () => ctx.fill();
  const trazar = () => ctx.stroke();

  if (halos.length) {
    ctx.fillStyle = 'rgba(170,215,255,0.16)';
    enTandas(
      ctx,
      halos,
      (i) => {
        const [x, y, r] = geo(i);
        const rr = r * (1.3 + Math.min(0.5, v[offBot(f, i) + BOT.slime] / 8000));
        ctx.moveTo(x + rr, y);
        ctx.arc(x, y, rr, 0, PIV * 2);
      },
      rellenar,
    );
  }

  for (const [css, filas] of rellenos) {
    ctx.fillStyle = css;
    enTandas(
      ctx,
      filas,
      (i) => {
        const [x, y, r] = geo(i);
        if (v[offBot(f, i) + BOT.flags] & FLAG.veg) {
          const rr = r * 1.08;
          ctx.moveTo(x + rr, y);
          for (let k = 0; k < 5; k++) ctx.lineTo(x + rr * HEX_C[k], y + rr * HEX_S[k]);
          ctx.closePath();
        } else {
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, PIV * 2);
        }
      },
      rellenar,
    );
  }

  if (contornos.length) {
    ctx.lineWidth = LW;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    enTandas(
      ctx,
      contornos,
      (i) => {
        if (v[offBot(f, i) + BOT.flags] & FLAG.veg) return;
        const [x, y, r] = geo(i);
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, PIV * 2);
      },
      trazar,
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5 * LW;
    enTandas(
      ctx,
      narices,
      (i) => {
        const [x, y, r] = geo(i);
        const aim = v[offBot(f, i) + BOT.aim];
        ctx.moveTo(x + Math.cos(aim) * r * 0.35, y - Math.sin(aim) * r * 0.35);
        ctx.lineTo(x + Math.cos(aim) * r * 1.25, y - Math.sin(aim) * r * 1.25);
      },
      trazar,
    );
  }

  for (const i of detalle) detalleBot(ctx, f, i, p);

  ctx.lineWidth = 1.5 * LW;
  for (const [clave, filas] of anillos) {
    const [col, nivel, pulso] = clave.split('|');
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.35 + 0.3 * Number(nivel);
    enTandas(
      ctx,
      filas,
      (i) => {
        const [x, y, r] = geo(i);
        let rr = r + Math.max(r * 0.45, 2 * LW);
        if (pulso) rr *= 1 + 0.12 * Math.sin(ahora * 0.025 + i);
        ctx.moveTo(x + rr, y);
        ctx.arc(x, y, rr, 0, PIV * 2);
      },
      trazar,
    );
  }
  ctx.globalAlpha = 1;

  ctx.lineWidth = LW;
  if (resaltados.length) {
    ctx.strokeStyle = '#e8b04b';
    enTandas(
      ctx,
      resaltados,
      (i) => {
        const [x, y, r] = geo(i);
        ctx.moveTo(x + r * 1.35, y);
        ctx.arc(x, y, r * 1.35, 0, PIV * 2);
      },
      trazar,
    );
  }
  if (filaFoco >= 0) {
    const [x, y, r] = geo(filaFoco);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * LW;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.2 + 2 * LW, 0, PIV * 2);
    ctx.stroke();
    ctx.lineWidth = LW;
  }
  return conValor && mn <= mx ? { min: mn, max: mx } : { min: Number.NaN, max: Number.NaN };
}

/**
 * Morfología de un bot grande en pantalla.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../sim/frame.js').Frame} f
 * @param {number} i
 * @param {PintaRica} p
 */
function detalleBot(ctx, f, i, p) {
  const v = f.v;
  const o = offBot(f, i);
  const q = offVis(f, i);
  const { s, LW, ahora } = p;
  const x = v[o + BOT.x] * s;
  const y = v[o + BOT.y] * s;
  const r = v[o + BOT.r] * s;
  const pr = r / LW;
  const aim = v[o + BOT.aim];
  const shell = v[o + BOT.shell];

  if (p.radiosFijos && v[o + BOT.body] > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, v[o + BOT.body] / 10000).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, PIV * 2);
    ctx.fill();
  }
  if (shell > 0.5) {
    ctx.strokeStyle = '#d6deec';
    ctx.lineWidth = LW * (1 + 4 * Math.min(1, shell / 5000));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PIV * 2);
    ctx.stroke();
  }
  /** @param {number} cant @param {string} color @param {number} fase */
  const puas = (cant, color, fase) => {
    if (!(cant > 0.5)) return;
    const n = 3 + Math.min(3, Math.floor(cant / 1000));
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = aim + fase + k * ((PIV * 2) / n);
      const w = 0.22;
      ctx.moveTo(x + Math.cos(a - w) * r, y - Math.sin(a - w) * r);
      ctx.lineTo(x + Math.cos(a) * r * 1.45, y - Math.sin(a) * r * 1.45);
      ctx.lineTo(x + Math.cos(a + w) * r, y - Math.sin(a + w) * r);
      ctx.closePath();
    }
    ctx.fill();
  };
  puas(v[o + BOT.venom], '#4d7dff', PIV / 6);
  puas(v[o + BOT.poison], '#ffe03a', PIV / 2);
  if (v[o + BOT.flags] & FLAG.multibot) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = LW;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, PIV * 2);
    ctx.stroke();
  }
  if (pr < LOD_FINO) return;
  const ven = v[q + VIS.ojosVen];
  const er = Math.max(r * 0.085, 1.2 * LW);
  for (const quiero of [1, 0]) {
    ctx.fillStyle = quiero ? '#ffffff' : 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    for (let a = 0; a <= 8; a++) {
      if (((ven >> a) & 1) !== quiero) continue;
      const ang = aim + PIV / 4 - PIV / 36 - a * (PIV / 18) + v[q + VIS.dirOjos + a];
      const ex = x + Math.cos(ang) * r * 0.78;
      const ey = y - Math.sin(ang) * r * 0.78;
      ctx.moveTo(ex + er, ey);
      ctx.arc(ex, ey, er, 0, PIV * 2);
    }
    ctx.fill();
  }
  const st = v[q + VIS.estado];
  if (st & ESTADO.paralizado) {
    ctx.strokeStyle = '#9ad0ff';
    ctx.lineWidth = LW;
    ctx.setLineDash([3 * LW, 3 * LW]);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.12, 0, PIV * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (st & ESTADO.envenenado) {
    ctx.strokeStyle = 'rgba(255,224,58,0.7)';
    ctx.lineWidth = 1.5 * LW;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.18, 0, PIV * 2);
    ctx.stroke();
  }
  if (st & ESTADO.virus) {
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = ahora * 0.003 + k * ((PIV * 2) / 3);
      const cx = x + Math.cos(a) * r * 0.45;
      const cy = y - Math.sin(a) * r * 0.45;
      ctx.moveTo(cx + r * 0.08, cy);
      ctx.arc(cx, cy, r * 0.08, 0, PIV * 2);
    }
    ctx.fill();
  }
}

/**
 * Guarda los nacimientos y muertes del frame (se dibujan unos cientos de ms).
 * @param {import('../sim/frame.js').Frame} f
 * @param {EstadoRico} est
 * @param {number} ahora
 */
export function ingerirEventos(f, est, ahora) {
  if (f.ciclo < est.ultimoCiclo) est.limpiar(); // sim nueva o cargada
  est.ultimoCiclo = f.ciclo;
  const v = f.v;
  for (let i = 0; i < f.nNac; i++) {
    const o = offNace(f, i);
    est.nacimientos.push({
      x: v[o + NACE.x],
      y: v[o + NACE.y],
      mx: v[o + NACE.mx],
      my: v[o + NACE.my],
      col: vbACss(v[o + NACE.color]),
      t: ahora,
    });
  }
  for (let i = 0; i < f.nMue; i++) {
    const o = offMuere(f, i);
    est.muertes.push({
      x: v[o + MUERE.x],
      y: v[o + MUERE.y],
      r: v[o + MUERE.r],
      col: vbACss(v[o + MUERE.color]),
      tp: v[o + MUERE.tp] === 1,
      t: ahora,
    });
  }
  if (est.nacimientos.length > 600) est.nacimientos.splice(0, est.nacimientos.length - 600);
  if (est.muertes.length > 600) est.muertes.splice(0, est.muertes.length - 600);
}

/**
 * Nacimientos (destello + línea a la madre) y muertes (se encoge y apaga;
 * anillo cian si salió por un teleporter).
 * @param {CanvasRenderingContext2D} ctx
 * @param {EstadoRico} est
 * @param {{ s: number, LW: number, ahora: number }} p
 */
export function dibujarEventos(ctx, est, p) {
  const { s, LW, ahora } = p;
  let k = 0;
  for (const b of est.nacimientos) {
    const a = (ahora - b.t) / NACE_MS;
    if (a >= 1) continue;
    est.nacimientos[k++] = b;
    ctx.globalAlpha = 1 - a;
    ctx.strokeStyle = b.col;
    ctx.lineWidth = 1.5 * LW;
    ctx.beginPath();
    ctx.arc(b.x * s, b.y * s, (40 + 160 * a) * s + 2 * LW, 0, PIV * 2);
    if (!Number.isNaN(b.mx)) {
      ctx.moveTo(b.x * s, b.y * s);
      ctx.lineTo(b.mx * s, b.my * s);
    }
    ctx.stroke();
  }
  est.nacimientos.length = k;
  k = 0;
  for (const d of est.muertes) {
    const a = (ahora - d.t) / MUERE_MS;
    if (a >= 1) continue;
    est.muertes[k++] = d;
    ctx.globalAlpha = (1 - a) * 0.8;
    if (d.tp) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1.5 * LW;
      ctx.beginPath();
      ctx.arc(d.x * s, d.y * s, d.r * s * (1 + 2 * a), 0, PIV * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = d.col;
      ctx.beginPath();
      ctx.arc(d.x * s, d.y * s, Math.max(d.r * s * (1 - a), 0.8 * LW), 0, PIV * 2);
      ctx.fill();
    }
  }
  est.muertes.length = k;
  ctx.globalAlpha = 1;
  ctx.lineWidth = LW;
}
