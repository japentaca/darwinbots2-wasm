// @ts-check
// ADN de los bots, sin DOM (paso N3.1 de port/web2/PLAN.md; decisiones 17,
// 18, 19 y 20): identidad por hash, genes, composición de híbridos del
// Laboratorio y la paleta de colores de la siembra.
//
// Dos hashes, para dos cosas distintas:
//
//   hashAdn(texto)  IDENTIDAD de un bot en la biblioteca (16 hex). Es el
//                   «hash del ADN canónico» del inventario de la clásica:
//                   SHA-1 de canonico(texto), primeros 16 hex
//                   (tools/bestiary/analyze_bots.js, `canonical` y
//                   `crypto.createHash('sha1')…slice(0, 16)`). La clásica NO
//                   lo calcula en el navegador: lo lee de profiles.json
//                   (inventory.js invLoad: `key = p.hash`), donde el
//                   analizador lo sacó del texto que DECOMPILA el core
//                   (db_sim_bot_text del fundador sembrado). Por eso:
//                   - bots del foro: la biblioteca usa el hash de
//                     profiles.json tal cual (idéntico al de la clásica: la
//                     migración de favoritos, tags, notas y selecciones cruza
//                     sin pérdida);
//                   - bots propios: hashAdn del texto tal como lo guarda el
//                     usuario (la clásica nunca los hasheó: sus híbridos iban
//                     por nombre). Aplicado al texto decompilado da el mismo
//                     valor que profiles.json (test/bots.test.js lo verifica
//                     con el core).
//                   Ignora espacios al borde de las líneas, líneas vacías y
//                   líneas que son solo comentario.
//
//   lgHash(texto)   FNV-1a de 32 bits (8 hex) del texto EXACTO
//                   (engine/league.js). Congela el ADN de un participante de
//                   torneo (Entrant.hash) y de una especie de escenario
//                   (Especie.hash, engine/escenarios/index.js). Cambia con
//                   cualquier espacio o comentario. Cada versión de un bot
//                   propio guarda los dos (`hash` y `lg`), y el historial
//                   (engine/biblioteca.js) cruza corridas y torneos por `lg`.
//
// API:
//   canonico(texto) → string
//   sha1Hex(texto)  → 40 hex (UTF-8), síncrono y sin dependencias
//   hashAdn(texto)  → 16 hex
//   lgHash          (reexportado de engine/league.js)
//   contarGenes(adn), tamanoDe(nGenes) → 'S'|'M'|'L'|'XL' (umbrales de la clásica)
//   componerHibrido(h, ctx) → {adn, origenes, faltan}: el ADN de un híbrido
//                   guardado por el Laboratorio de la clásica (lab.js
//                   labAnalyze + labGeneText + labCompose)
//   crearPaleta(azar) → () => '#rrggbb' (inventory.js invColor)

import { lgHash } from './league.js';
import { genesAdn } from './lineage.js';

export { lgHash };

/**
 * Texto canónico del ADN (analyze_bots.js `canonical`): líneas recortadas,
 * sin las vacías ni las que empiezan con comentario, unidas con '\n'.
 * @param {string} texto
 */
export function canonico(texto) {
  return String(texto ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l[0] !== "'")
    .join('\n');
}

/**
 * SHA-1 (FIPS 180-4) del texto en UTF-8, en hexadecimal.
 * @param {string} texto
 */
export function sha1Hex(texto) {
  const datos = new TextEncoder().encode(texto);
  const largo = datos.length;
  const nBloques = ((largo + 8) >>> 6) + 1;
  const m = new Uint8Array(nBloques * 64);
  m.set(datos);
  m[largo] = 0x80;
  const bits = largo * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(m.length - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(m.length - 4, bits >>> 0);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let o = 0; o < m.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f;
      let k;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/**
 * Hash de identidad del ADN (16 hex): el del inventario de la clásica.
 * @param {string} texto
 */
export const hashAdn = (texto) => sha1Hex(canonico(texto)).slice(0, 16);

/** ¿Parece un hash de identidad? @param {unknown} h */
export const esHash = (h) => typeof h === 'string' && /^[0-9a-f]{16}$/.test(h);

/**
 * Genes del ADN según la regla del core (engine/lineage.js genesAdn).
 * @param {string} adn
 */
export const contarGenes = (adn) => genesAdn(adn).genes.length;

/**
 * Tamaño como lo agrupa la clásica (analyze_bots.js: S ≤ 5 genes, M ≤ 20,
 * L ≤ 60, XL más).
 * @param {number} n
 * @returns {'S' | 'M' | 'L' | 'XL'}
 */
export const tamanoDe = (n) => (n <= 5 ? 'S' : n <= 20 ? 'M' : n <= 60 ? 'L' : 'XL');

// ---- Híbridos del Laboratorio de la clásica ---------------------------------

/**
 * @typedef {{t: string, w?: number[], r?: number[], ai?: Record<string, number[]>, gl?: number}} GenJson
 * @typedef {{version?: number, sysAddrs?: number[], bots: Record<string, GenJson[]>}} GenesJson
 * @typedef {{file: string, gi: number}} Parte
 * @typedef {{name: string, veg?: boolean, remap?: boolean, parts: Parte[], updated?: string}} HibridoViejo
 * @typedef {{archivo: string, gen: number}} OrigenGen  gen en base 0 (el `gi` de la clásica)
 */

/**
 * Remapeo de memoria propia de un híbrido (lab.js labAnalyze, solo la parte
 * de colisiones: los avisos son del editor). Devuelve archivo → (dirección →
 * nueva).
 * @param {Parte[]} partes @param {GenesJson} genes
 * @returns {Map<string, Map<number, number>>}
 */
function remapeos(partes, genes) {
  /** @type {Map<string, Set<number>>} */
  const porArchivo = new Map();
  for (const p of partes) {
    let s = porArchivo.get(p.file);
    if (!s) {
      s = new Set();
      porArchivo.set(p.file, s);
    }
    s.add(p.gi);
  }
  /** @type {Map<number, string[]>} */
  const usos = new Map();
  for (const [file, incl] of porArchivo)
    for (const gi of incl) {
      const g = genes.bots[file][gi];
      for (const a of [...(g.w || []), ...(g.r || [])]) {
        let l = usos.get(a);
        if (!l) {
          l = [];
          usos.set(a, l);
        }
        if (!l.includes(file)) l.push(file);
      }
    }
  const sys = new Set(genes.sysAddrs || []);
  const tomadas = new Set(usos.keys());
  /** @type {number[]} */
  const pozo = [];
  for (let a = 971; a <= 990; a++) pozo.push(a);
  for (let a = 1; a <= 1000; a++) if (a < 971 || a > 990) pozo.push(a);
  const libre = () => {
    const a = pozo.find((x) => !tomadas.has(x) && !sys.has(x));
    if (a !== undefined) tomadas.add(a);
    return a;
  };
  /** @type {Map<string, Map<number, number>>} */
  const out = new Map();
  for (const [a, files] of usos) {
    if (files.length < 2) continue;
    for (const f of files.slice(1)) {
      const b = libre();
      if (b === undefined) break;
      let m = out.get(f);
      if (!m) {
        m = new Map();
        out.set(f, m);
      }
      m.set(a, b);
    }
  }
  return out;
}

/**
 * Texto del gen con las direcciones remapeadas (lab.js labGeneText).
 * @param {GenJson} g @param {Map<number, number> | undefined} remap
 */
function textoGen(g, remap) {
  if (!remap || !g.ai) return g.t;
  /** @type {Map<number, number>} */
  const en = new Map();
  for (const [a, idxs] of Object.entries(g.ai)) {
    const n = remap.get(+a);
    if (n !== undefined) for (const i of idxs) en.set(i, n);
  }
  if (!en.size) return g.t;
  let i = 0;
  return g.t
    .split('\n')
    .map((linea) =>
      linea
        .split(/\s+/)
        .map((tok) => {
          const n = en.get(i++);
          if (n === undefined) return tok;
          return tok[0] === '*' ? `*${n}` : String(n);
        })
        .join(' '),
    )
    .join('\n');
}

/**
 * ADN de un híbrido guardado por el Laboratorio de la clásica (store
 * 'hybrids' de darwinbots-inventario), idéntico al que armaba lab.js
 * (labLoadHybrid + labCompose), con la fecha de `h.updated` en la cabecera
 * (la clásica ponía la del día en que se sembraba). Las partes cuyo gen ya
 * no está en genes.json se descartan (labLoadHybrid) y se cuentan en
 * `faltan`. `origenes` tiene una entrada por parte, en orden (decisión 19:
 * cada gen guarda su bot de origen).
 * @param {HibridoViejo} h
 * @param {{genes: GenesJson, nombreDe?: (archivo: string) => string | undefined, fecha?: string}} ctx
 * @returns {{adn: string, origenes: OrigenGen[], faltan: number}}
 */
export function componerHibrido(h, ctx) {
  const { genes } = ctx;
  const todas = Array.isArray(h.parts) ? h.parts : [];
  const partes = todas.filter(
    (p) => p && typeof p.file === 'string' && genes.bots[p.file]?.[p.gi] !== undefined,
  );
  const rm = h.remap !== false ? remapeos(partes, genes) : new Map();
  const nombre = (/** @type {string} */ f) => ctx.nombreDe?.(f) ?? f;
  const fecha = (ctx.fecha || h.updated || '').slice(0, 10);
  const cabeza = [
    `' Hybrid: ${h.name}`,
    `' Built in the Hybrid lab (${fecha})`,
    "' Genes:",
    ...partes.map((p, k) => `'  ${k + 1}. ${nombre(p.file)} · gene ${p.gi + 1}`),
  ];
  const cuerpo = partes.map(
    (p, k) =>
      `' --- ${k + 1}. ${nombre(p.file)} · gene ${p.gi + 1} ---\n` +
      textoGen(genes.bots[p.file][p.gi], rm.get(p.file)),
  );
  return {
    adn: `${cabeza.join('\n')}\n\n${cuerpo.join('\n\n')}\n`,
    origenes: partes.map((p) => ({ archivo: p.file, gen: p.gi })),
    faltan: todas.length - partes.length,
  };
}

// ---- Paleta de la siembra ----------------------------------------------------

/**
 * Colores de especie como los de la clásica (inventory.js invColor): el tono
 * avanza por el ángulo áureo con un poco de ruido; saturación 65-90 %,
 * luminosidad 55-68 % y luminancia percibida ≥ 0,2 (el campo es casi
 * negro). Con el mismo `azar` da la misma secuencia que la clásica (el
 * primer valor fija el tono de partida, como su `invHue` al cargar).
 * @param {() => number} [azar]
 * @returns {() => string}
 */
export function crearPaleta(azar = Math.random) {
  let tono = azar() * 360;
  return () => {
    tono = (tono + 137.508 + (azar() - 0.5) * 40 + 360) % 360;
    const h = tono;
    const s = 0.65 + azar() * 0.25;
    const rgb = (/** @type {number} */ l) =>
      [0, 8, 4].map((n) => {
        const k = (n + h / 30) % 12;
        return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      });
    const lum = (/** @type {number[]} */ c) =>
      c
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    let l = 0.55 + azar() * 0.13;
    while (lum(rgb(l)) < 0.2 && l < 0.85) l += 0.02;
    return `#${rgb(l)
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`;
  };
}
