// @ts-check
// Datos del inspector del bot (paso N1.4) sacados del frame: puro, sin DOM
// ni runes. El frame es válido solo durante el aviso de 'frame' (el búfer
// vuelve al worker), así que todo lo que sale de acá son copias.
//
// Fuentes: el registro del bot (db_sim_dump_bots), el registro de la vista
// enriquecida (db_sim_dump_bots_vis, misma fila) y el bloque del bot con
// foco (db_sim_dump_focus: 8 floats + 9 ojos × 4).

import { normalizarAngulo, PIV } from '../mundo/render-clasico.js';
import { BOT, FLAG, FOCO, N_OJOS, OJO, offBot, offVis, REG_OJO, VIS } from '../sim/frame.js';

/**
 * Fila del bot `slot` en el frame (−1 si no está).
 * @param {import('../sim/frame.js').Frame} f
 * @param {number} slot
 */
export function filaDe(f, slot) {
  if (!(slot > 0)) return -1;
  for (let i = 0; i < f.nBots; i++) if (f.v[offBot(f, i) + BOT.idx] === slot) return i;
  return -1;
}

/**
 * @typedef {object} Ojo
 * @property {number} dir     desvío respecto del aim (rad)
 * @property {number} medio   medio ancho (rad)
 * @property {number} alcance distancia de visión (EyeSightDistance)
 * @property {number} visto   valor de .eyeN
 */

/**
 * @typedef {object} DatosBot
 * @property {number} slot
 * @property {number} color    Long BGR de la especie
 * @property {number} flags    bits de FLAG
 * @property {number} nrg
 * @property {number} body
 * @property {number} venom
 * @property {number} shell
 * @property {number} waste
 * @property {number} poison
 * @property {number} slime
 * @property {number} chlr
 * @property {boolean} rica    trae el registro de la vista enriquecida
 * @property {number} abs      AbsNum (0 = sin dato)
 * @property {number} madre    AbsNum de la madre (0 = sin madre o sin dato)
 * @property {number} gen      −1 = sin dato
 * @property {number} mut      −1 = sin dato
 * @property {number} dnaLen   −1 = sin dato
 * @property {number} kills    −1 = sin dato
 * @property {number} estado   bits de ESTADO (0 sin vista enriquecida)
 * @property {number} ties     −1 = sin dato
 * @property {number} especie  índice de especie de la vista (−1 = sin dato)
 * @property {number} edad     −1 = sin dato
 * @property {boolean} foco    trae el bloque de foco (ojos, aim)
 * @property {number} aim
 * @property {number} radio
 * @property {number} ojoFoco  0..8 (−1 = sin dato)
 * @property {Ojo[]} ojos      vacío sin bloque de foco
 */

/**
 * Datos del bot `slot` en el frame, o null si no está.
 * @param {import('../sim/frame.js').Frame} f
 * @param {number} slot
 * @returns {DatosBot | null}
 */
export function datosBot(f, slot) {
  const i = filaDe(f, slot);
  if (i < 0) return null;
  const v = f.v;
  const b = offBot(f, i);
  const rica = f.rica && f.of.vis >= 0;
  const q = rica ? offVis(f, i) : -1;
  const conFoco = f.foco === slot && f.of.focus >= 0;
  const o = f.of.focus;
  /** @type {Ojo[]} */
  const ojos = [];
  if (conFoco) {
    for (let a = 0; a < N_OJOS; a++) {
      const e = o + FOCO.ojos + a * REG_OJO;
      ojos.push({
        dir: v[e + OJO.dir],
        medio: v[e + OJO.medio],
        alcance: v[e + OJO.esd],
        visto: v[e + OJO.visto],
      });
    }
  }
  return {
    slot,
    color: v[b + BOT.color],
    flags: v[b + BOT.flags],
    nrg: conFoco ? v[o + FOCO.nrg] : v[b + BOT.nrg],
    body: conFoco ? v[o + FOCO.body] : v[b + BOT.body],
    venom: v[b + BOT.venom],
    shell: v[b + BOT.shell],
    waste: v[b + BOT.waste],
    poison: v[b + BOT.poison],
    slime: v[b + BOT.slime],
    chlr: v[b + BOT.chlr],
    rica,
    abs: rica ? v[q + VIS.abs] : 0,
    madre: rica ? v[q + VIS.madre] : 0,
    gen: rica ? v[q + VIS.gen] : -1,
    mut: rica ? v[q + VIS.mut] : -1,
    dnaLen: rica ? v[q + VIS.dnaLen] : -1,
    kills: rica ? v[q + VIS.kills] : -1,
    estado: rica ? v[q + VIS.estado] : 0,
    ties: rica ? v[q + VIS.ties] : -1,
    especie: rica ? v[q + VIS.especie] : -1,
    edad: conFoco ? v[o + FOCO.edad] : rica ? v[q + VIS.edad] : -1,
    foco: conFoco,
    aim: conFoco ? v[o + FOCO.aim] : 0,
    radio: conFoco ? v[o + FOCO.r] : v[b + BOT.r],
    ojoFoco: conFoco ? v[o + FOCO.ojoFoco] : -1,
    ojos,
  };
}

/** Recursos que el inspector muestra como barras (campo de DatosBot). */
export const RECURSOS = /** @type {const} */ (['nrg', 'body', 'venom', 'shell', 'waste']);

/** Campo del registro de bot de cada recurso. */
const CAMPO_BOT = {
  nrg: BOT.nrg,
  body: BOT.body,
  venom: BOT.venom,
  shell: BOT.shell,
  waste: BOT.waste,
};

/**
 * Máximo de cada recurso entre los bots vivos del frame (sin cadáveres), para
 * que las barras sean relativas al mundo. Nunca menos de 1.
 * @param {import('../sim/frame.js').Frame} f
 * @returns {Record<(typeof RECURSOS)[number], number>}
 */
export function maximosDelMundo(f) {
  const max = { nrg: 1, body: 1, venom: 1, shell: 1, waste: 1 };
  const v = f.v;
  for (let i = 0; i < f.nBots; i++) {
    const b = offBot(f, i);
    if (v[b + BOT.flags] & FLAG.corpse) continue;
    for (const k of RECURSOS) {
      const x = v[b + CAMPO_BOT[k]];
      if (x > max[k]) max[k] = x;
    }
  }
  return max;
}

/**
 * Fracción 0..1 de una barra (valor negativo o sin máximo = 0).
 * @param {number} valor
 * @param {number} max
 */
export function fraccion(valor, max) {
  if (!(valor > 0) || !(max > 0)) return 0;
  return Math.min(1, valor / max);
}

/**
 * @typedef {object} Pariente
 * @property {number} abs
 * @property {number} slot   0 = no está vivo
 */

/**
 * @typedef {object} Parientes
 * @property {Pariente | null} madre      null = sin madre registrada (AbsNum 0)
 * @property {Pariente[]} hijos            hijos vivos
 * @property {Pariente[]} ancestros        madre, abuela… mientras estén vivas
 * @property {Pariente | null} fundador   el ancestro vivo más viejo, si es un
 *                                         bot sembrado (sin madre); null si la
 *                                         cadena se corta antes
 */

/**
 * Parientes del bot `abs` entre los vivos del frame. Necesita la vista
 * enriquecida (AbsNum y madre de cada bot); sin ella devuelve null.
 * @param {import('../sim/frame.js').Frame} f
 * @param {number} abs
 * @returns {Parientes | null}
 */
export function parientes(f, abs) {
  if (!f.rica || f.of.vis < 0 || !(abs > 0)) return null;
  const v = f.v;
  /** @type {Map<number, { slot: number, madre: number }>} */
  const vivos = new Map();
  /** @type {Pariente[]} */
  const hijos = [];
  for (let i = 0; i < f.nBots; i++) {
    const q = offVis(f, i);
    const a = v[q + VIS.abs];
    const m = v[q + VIS.madre];
    const slot = v[offBot(f, i) + BOT.idx];
    vivos.set(a, { slot, madre: m });
    if (m === abs && a !== abs) hijos.push({ abs: a, slot });
  }
  const yo = vivos.get(abs);
  if (!yo) return null;
  hijos.sort((x, y) => x.abs - y.abs);
  const madre = yo.madre > 0 ? { abs: yo.madre, slot: vivos.get(yo.madre)?.slot ?? 0 } : null;
  /** @type {Pariente[]} */
  const ancestros = [];
  /** @type {Pariente | null} */
  let fundador = null;
  let m = yo.madre;
  const vistos = new Set([abs]);
  while (m > 0 && !vistos.has(m)) {
    const r = vivos.get(m);
    if (!r) break;
    vistos.add(m);
    ancestros.push({ abs: m, slot: r.slot });
    if (!(r.madre > 0)) fundador = { abs: m, slot: r.slot };
    m = r.madre;
  }
  return { madre, hijos, ancestros, fundador };
}

/**
 * Resumen del mensaje 'family' del worker ({n, total, highlighted, lines}):
 * `lines` trae 7 floats por enlace del árbol (solo posiciones).
 * @param {any} msg
 * @returns {{ n: number, total: number, resaltados: number, enlaces: number }}
 */
export function resumenFamilia(msg) {
  const lineas = msg?.lines;
  const largo = lineas && typeof lineas.length === 'number' ? lineas.length : 0;
  return {
    n: msg?.n | 0,
    total: Math.max(0, msg?.total | 0),
    resaltados: Math.max(0, msg?.highlighted | 0),
    enlaces: Math.floor(largo / 7),
  };
}

/**
 * Generación y mutaciones del encabezado del texto del bot (SalvarobText:
 * `'#generation: N` y `'#mutations: M`). Sirve sin la vista enriquecida.
 * @param {string} texto
 * @returns {{ gen: number, mut: number }}  −1 = no está
 */
export function cabeceraAdn(texto) {
  const g = /^'#generation:\s*(-?\d+)/m.exec(texto);
  const m = /^'#mutations:\s*(-?\d+)/m.exec(texto);
  return { gen: g ? Number(g[1]) : -1, mut: m ? Number(m[1]) : -1 };
}

/**
 * Arco de un ojo, relativo al bot (misma cuenta que la rejilla de visión del
 * mundo, render-clasico.js: dibujarVision). Ángulos en el sistema del core
 * (y hacia arriba); para dibujar en pantalla se niegan.
 * @param {number} aim
 * @param {number} a     índice del ojo 0..8
 * @param {Ojo} ojo
 * @param {number} radio radio del bot
 * @returns {{ hi: number, lo: number, largo: number }}
 */
export function arcoOjo(aim, a, ojo, radio) {
  const crudoHi = aim + PIV / 4 - (PIV / 18) * a + ojo.dir + ojo.medio;
  const lo = normalizarAngulo(crudoHi - PIV / 18 - 2 * ojo.medio);
  const hi = normalizarAngulo(crudoHi);
  const largo =
    ojo.visto > 0
      ? Math.max(0, (1 / Math.sqrt(ojo.visto)) * (ojo.alcance + radio) + radio)
      : ojo.alcance + 2 * radio;
  return { hi, lo, largo };
}

/**
 * El inspector tiene que pasar a mostrar el bot `foco`: es otro slot, o el
 * mismo slot tras la muerte del que mostraba (el motor reutiliza los slots:
 * un bot nuevo puede nacer donde murió el anterior).
 * @param {number} foco  foco de la sesión (0 = ninguno)
 * @param {number} bot   slot que muestra el panel
 * @param {boolean} murio el bot del panel murió
 */
export const hayQueCambiarBot = (foco, bot, murio) => foco > 0 && (foco !== bot || murio);
