// @ts-check
// Render de la vista clásica y de lo que comparten las dos vistas
// (obstáculos, teleporters, ties, shots, rejilla de visión, familia).
// Transcripción del draw() de port/web/index.html; quedan afuera las skins,
// el monitor RGB y la imagen de fondo (PLAN, decisión 5). Puro: recibe el
// contexto 2D y el frame decodificado; no toca el DOM.

import {
  BOT,
  FLAG,
  FOCO,
  N_OJOS,
  OBS,
  OJO,
  offBot,
  offObs,
  offShot,
  offTie,
  offTp,
  REG_OJO,
  SHOT,
  TIE,
  TIE_DURA,
  TP,
  TP_FLAG,
} from '../sim/frame.js';
import { FLASH, vbACss } from './color.js';

/** PI del original (Single): la geometría de la rejilla usa la misma constante. */
// biome-ignore lint/suspicious/noApproximativeNumericConstant: es el PI (Single) del original, Common.bas:19.
export const PIV = 3.14159265;

/**
 * Lleva un ángulo a una vuelta, como los `while (x > 2π) x -= 2π` /
 * `while (x < 0) x += 2π` del original pero con módulo, así que termina
 * siempre: lo que ya está en [0, periodo] queda igual, lo mayor cae en
 * (0, periodo] y lo negativo en [0, periodo). No finito (NaN, ±Infinity)
 * da 0 (con los bucles la pestaña se colgaba).
 * @param {number} x
 * @param {number} [periodo] una vuelta (por defecto 2·PIV)
 * @returns {number}
 */
export function normalizarAngulo(x, periodo = PIV * 2) {
  if (!Number.isFinite(x)) return 0;
  if (x >= 0 && x <= periodo) return x;
  const r = ((x % periodo) + periodo) % periodo;
  return x > periodo && r === 0 ? periodo : r;
}

/**
 * @typedef {object} Capas
 * @property {boolean} impactos    destello de impacto de los shots
 * @property {boolean} vision      rejilla de visión del bot con foco
 * @property {boolean} vectores    flechas de movimiento (vista clásica)
 * @property {boolean} indicadores anillos de recursos (vista clásica)
 * @property {boolean} resaltarTps círculo por tipo de teleporter
 */

/** Capas encendidas por defecto (las de la clásica). @type {Capas} */
export const CAPAS_DEFECTO = Object.freeze({
  impactos: true,
  vision: true,
  vectores: true,
  indicadores: true,
  resaltarTps: true,
});

/**
 * @typedef {object} Pinta
 * @property {number} s     píxeles de lienzo por unidad de mundo con zoom 1
 * @property {number} z     zoom de la cámara
 * @property {number} LW    un píxel de pantalla en unidades de dibujo
 * @property {boolean} rica vista enriquecida
 * @property {Capas} capas
 */

/**
 * Anillos de recursos (DrawRobPer): [campo del bot, radio relativo, color].
 * @type {[number, number, string][]}
 */
const INDICADORES = [
  [BOT.nrg, 0.95, '#ffffff'],
  [BOT.body, 0.9, '#ff00ff'],
  [BOT.waste, 0.85, '#00ff00'],
  [BOT.venom, 0.8, '#0000ff'],
  [BOT.shell, 0.75, '#ff0000'],
  [BOT.slime, 0.7, '#000000'],
  [BOT.poison, 0.65, '#ffff00'],
  [BOT.vtimer, 0.6, '#00ffff'],
  [BOT.chlr, 0.55, '#00ff00'],
];

/**
 * Obstáculos, teleporters, ties y shots (debajo de los bots).
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../sim/frame.js').Frame} f
 * @param {Pinta} p
 */
export function dibujarObjetos(ctx, f, p) {
  const v = f.v;
  const { s, LW, rica, capas } = p;
  ctx.lineWidth = LW;

  ctx.globalAlpha = 0.6;
  for (let i = 0; i < f.nObs; i++) {
    const o = offObs(f, i);
    ctx.fillStyle = vbACss(v[o + OBS.color]);
    ctx.fillRect(v[o + OBS.x] * s, v[o + OBS.y] * s, v[o + OBS.w] * s, v[o + OBS.h] * s);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < f.nTps; i++) {
    const o = offTp(f, i);
    const x = v[o + TP.x];
    const y = v[o + TP.y];
    const w = v[o + TP.w];
    const h = v[o + TP.h];
    ctx.strokeStyle = vbACss(v[o + TP.color]);
    ctx.setLineDash([4 * LW, 3 * LW]);
    ctx.strokeRect(x * s, y * s, w * s, h * s);
    ctx.setLineDash([]);
    if (capas.resaltarTps) {
      // DrawTeleporters: el último tipo que aplica gana.
      const fl = v[o + TP.flags];
      let col = '#00ff00';
      if (fl & TP_FLAG.salida) col = '#ff0000';
      if (fl & TP_FLAG.local) col = '#ffff00';
      if (fl & TP_FLAG.internet) col = '#0000ff';
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc((x + w / 2) * s, (y + h / 3) * s, w * 0.6 * s, 0, PIV * 2);
      ctx.stroke();
    }
  }

  for (let i = 0; i < f.nTies; i++) {
    const o = offTie(f, i);
    const dura = v[o + TIE.tipo] === TIE_DURA;
    if (rica) {
      ctx.strokeStyle = dura ? '#e0c070' : '#8fa6cf';
      ctx.lineWidth = (dura ? 3 : 2) * LW;
    } else {
      ctx.strokeStyle = dura ? '#c8b060' : '#4a5a78';
      ctx.lineWidth = (dura ? 1.5 : 1) * LW;
    }
    ctx.beginPath();
    ctx.moveTo(v[o + TIE.x1] * s, v[o + TIE.y1] * s);
    ctx.lineTo(v[o + TIE.x2] * s, v[o + TIE.y2] * s);
    ctx.stroke();
  }
  ctx.lineWidth = LW;

  // DrawShots: con flash, destello de un frame en opos; si no, el trazo.
  for (let i = 0; i < f.nShots; i++) {
    const o = offShot(f, i);
    if (v[o + SHOT.flash] && capas.impactos) {
      const st = v[o + SHOT.tipo];
      ctx.fillStyle = st < 0 && st >= -7 ? FLASH[st] : '#000000';
      ctx.beginPath();
      ctx.arc(v[o + SHOT.ox] * s, v[o + SHOT.oy] * s, Math.max(20 * s, 2 * LW), 0, PIV * 2);
      ctx.fill();
    } else {
      const x = v[o + SHOT.x];
      const y = v[o + SHOT.y];
      ctx.strokeStyle = vbACss(v[o + SHOT.color]);
      ctx.beginPath();
      ctx.moveTo(x * s, y * s);
      ctx.lineTo((x - v[o + SHOT.vx] * 0.6) * s, (y - v[o + SHOT.vy] * 0.6) * s);
      ctx.stroke();
    }
  }
}

/**
 * Flecha de vector de movimiento (DrawRobAim).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} bx @param {number} by @param {number} dx @param {number} dy
 * @param {number} mag @param {number} px @param {number} py @param {number} s
 */
function flecha(ctx, bx, by, dx, dy, mag, px, py, s) {
  const vx = bx + dx * mag;
  const vy = by + dy * mag;
  const tx = vx + dx * 15;
  const ty = vy + dy * 15;
  const a1x = vx + px * 10;
  const a1y = vy + py * 10;
  const a2x = vx - px * 10;
  const a2y = vy - py * 10;
  ctx.beginPath();
  ctx.moveTo(bx * s, by * s);
  ctx.lineTo(vx * s, vy * s);
  ctx.moveTo(a1x * s, a1y * s);
  ctx.lineTo(tx * s, ty * s);
  ctx.lineTo(a2x * s, a2y * s);
  ctx.lineTo(a1x * s, a1y * s);
  ctx.stroke();
}

/** @param {number} n */
const tope = (n) => Math.max(-1000, Math.min(1000, n));

/**
 * Bots de la vista clásica (DrawRobPer / DrawRobAim).
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../sim/frame.js').Frame} f
 * @param {Pinta} p
 */
export function dibujarBotsClasicos(ctx, f, p) {
  const v = f.v;
  const { s, LW, capas } = p;
  const foco = f.foco;
  ctx.lineWidth = LW;
  for (let i = 0; i < f.nBots; i++) {
    const o = offBot(f, i);
    const x = v[o + BOT.x] * s;
    const y = v[o + BOT.y] * s;
    const r = Math.max(v[o + BOT.r] * s, 1.2 * LW);
    const flags = v[o + BOT.flags];
    const cadaver = flags & FLAG.corpse;
    const esFoco = v[o + BOT.idx] === foco;

    if (flags & FLAG.highlight && !esFoco) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.35, 0, PIV * 2);
      ctx.strokeStyle = '#e8b04b';
      ctx.stroke();
    }
    if (esFoco) {
      ctx.beginPath();
      ctx.arc(x, y, r * 1.2, 0, PIV * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = cadaver ? '#555' : vbACss(v[o + BOT.color]);
    ctx.fill();
    ctx.strokeStyle = cadaver ? '#777' : 'rgba(255,255,255,0.55)';
    ctx.stroke();
    // rumbo: y de mundo hacia abajo, aim antihorario
    const aim = v[o + BOT.aim];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(aim) * r, y - Math.sin(aim) * r);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();

    if (capas.indicadores) {
      for (const [campo, rr, col] of INDICADORES) {
        const val = v[o + campo];
        let pct;
        if (campo === BOT.vtimer) {
          if (!(val > 0)) continue;
          pct = Math.min(val / 100, 0.99);
        } else if (campo === BOT.chlr) {
          if (!(val > 0)) continue;
          pct = Math.min(val / 32000, 0.98);
        } else {
          if (!(val > 0.5)) continue;
          pct = Math.min(Math.min(val / 32000, 1), 0.99);
        }
        ctx.beginPath();
        ctx.arc(x, y, Math.max(r * rr, 0.5 * LW), 0, -pct * PIV * 2, true);
        ctx.strokeStyle = col;
        ctx.stroke();
      }
    }
  }

  if (!capas.vectores) return;
  for (let i = 0; i < f.nBots; i++) {
    const o = offBot(f, i);
    if (v[o + BOT.flags] & FLAG.corpse) continue;
    const wx = v[o + BOT.x];
    const wy = v[o + BOT.y];
    const wr = v[o + BOT.r];
    const aim = v[o + BOT.aim];
    const up = tope(v[o + BOT.lastup]);
    const down = tope(v[o + BOT.lastdown]);
    const left = tope(v[o + BOT.lastleft]);
    const right = tope(v[o + BOT.lastright]);
    if (up === 0 && down === 0 && left === 0 && right === 0) continue;
    ctx.strokeStyle = vbACss(v[o + BOT.color]);
    const dfx = Math.cos(aim);
    const dfy = -Math.sin(aim);
    const dlx = Math.cos(aim - PIV / 2);
    const dly = -Math.sin(aim - PIV / 2);
    const drx = Math.cos(aim + PIV / 2);
    const dry = -Math.sin(aim + PIV / 2);
    if (up !== 0) flecha(ctx, wx + dfx * wr, wy + dfy * wr, dfx, dfy, up, dlx, dly, s);
    if (down !== 0) flecha(ctx, wx - dfx * wr, wy - dfy * wr, -dfx, -dfy, down, dlx, dly, s);
    if (left !== 0) flecha(ctx, wx + dlx * wr, wy + dly * wr, dlx, dly, left, dfx, dfy, s);
    if (right !== 0) flecha(ctx, wx + drx * wr, wy + dry * wr, drx, dry, right, dfx, dfy, s);
  }
}

/**
 * Rejilla de visión del bot con foco (showVisionGrid): 9 arcos cian, el ojo
 * con foco en rojo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../sim/frame.js').Frame} f
 * @param {Pinta} p
 */
export function dibujarVision(ctx, f, p) {
  if (f.of.focus < 0) return;
  const v = f.v;
  const { s, LW } = p;
  const b = f.of.focus;
  const x = v[b + FOCO.x] * s;
  const y = v[b + FOCO.y] * s;
  const aim = v[b + FOCO.aim];
  const radio = v[b + FOCO.r];
  const ojoFoco = v[b + FOCO.ojoFoco];
  const alto = aim + PIV / 4;
  for (let a = 0; a < N_OJOS; a++) {
    const e = b + FOCO.ojos + a * REG_OJO;
    const medio = v[e + OJO.medio];
    const esd = v[e + OJO.esd];
    const visto = v[e + OJO.visto];
    const crudoHi = alto - (PIV / 18) * a + v[e + OJO.dir] + medio;
    const lo = normalizarAngulo(crudoHi - PIV / 18 - 2 * medio);
    const hi = normalizarAngulo(crudoHi);
    let largo;
    if (visto > 0) {
      largo = Math.max(0, (1 / Math.sqrt(visto)) * (esd + radio) + radio);
    } else {
      largo = esd + radio + radio;
    }
    const rr = Math.max(largo * s, 0.001);
    ctx.strokeStyle = visto > 0 ? '#00ffff' : 'rgba(0,255,255,0.35)';
    ctx.lineWidth = (visto > 0 ? 1.5 : 1) * LW;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, rr, -lo, -hi, true);
    ctx.closePath();
    ctx.stroke();
    if (a === ojoFoco) {
      ctx.strokeStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(x, y, rr, -lo, -hi, true);
      ctx.stroke();
    }
  }
  ctx.lineWidth = LW;
}

/**
 * Árbol de parentesco (respuesta de 'family' con lines): 7 floats por enlace
 * [x hijo, y hijo, x medio, y medio, x padre, y padre, 1 = blanco del lado hijo].
 * @param {CanvasRenderingContext2D} ctx
 * @param {ArrayLike<number>} l
 * @param {Pinta} p
 */
export function dibujarFamilia(ctx, l, p) {
  const { s, LW } = p;
  ctx.lineWidth = LW;
  for (let i = 0; i + 6 < l.length; i += 7) {
    const blanco = l[i + 6] === 1;
    ctx.strokeStyle = blanco ? '#ffffff' : '#808080';
    ctx.beginPath();
    ctx.moveTo(l[i] * s, l[i + 1] * s);
    ctx.lineTo(l[i + 2] * s, l[i + 3] * s);
    ctx.stroke();
    ctx.strokeStyle = blanco ? '#808080' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(l[i + 2] * s, l[i + 3] * s);
    ctx.lineTo(l[i + 4] * s, l[i + 5] * s);
    ctx.stroke();
  }
}
