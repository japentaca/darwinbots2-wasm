// @ts-check
// Laboratorio y estructura del ADN para el editor (paso N3.3 de
// port/web2/PLAN.md; decisiones 18 y 19), sin DOM.
//
// Dos partes:
//
// 1. El ADN como texto editable, gen por gen. Los genes se cuentan con la
//    regla del core (engine/lineage.js genesAdn: `cond` abre, `start`/`else`
//    abren salvo tras un `cond`, `stop` cierra, `end` termina), pero con la
//    posición de cada palabra en el texto, así el editor puede plegar,
//    apagar, reemplazar palabras sueltas o insertar genes sin tocar el resto.
//      tokensTexto(texto)      palabras con línea y posición (sin comentarios)
//      genesTexto(texto)       genes activos: rango de palabras y de líneas
//      bloquesAdn(texto)       genes activos y apagados, en orden, con nombre
//      apagarGen(texto, n)     comenta el gen n (cada línea con PREFIJO_APAGADO)
//      encenderGen(texto, k)   descomenta el apagado k
//      codigoDeLinea(linea)    lo que el core lee de una línea (sin ' ni /)
//      insertarGen(texto, codigo, cabecera?)   al final (antes de un `end`;
//        insertarGenEn además da dónde empieza lo insertado)
//      reemplazarPalabras(texto, [{i, w}])     palabras sueltas por índice
//      realinearOrigenes(viejo, nuevo, origenes, memoria?)
//        el origen de cada gen (engine/bots.js OrigenGen) tras una edición
//        libre: los genes iguales o cambiados conservan el suyo, los nuevos
//        lo buscan por texto en `memoria` (genes insertados o apagados).
//
// 2. El Laboratorio de la clásica (port/web/lab.js) como avisos del editor
//    con arreglo en un clic. Cada gen insertado desde genes.json guarda su
//    bot de origen {archivo, gen} (y, si se remapeó, `remap`: pares
//    [dirección original, nueva]).
//      analizarPartes(partes, genes, {remap?, capsDe?})
//        = labAnalyze de la clásica (paridad en test/editor_lab.test.js):
//        dependencias de memoria propia, números de gen literales,
//        colisiones de direcciones (remapeo 971-990) y avisos de capacidades.
//      textoGenRemapeado(g, remap) = labGeneText
//      avisosLab({adn, origenes, genes, capsDe?})
//        los avisos del ADN tal como está, con sus acciones:
//          dep    un gen lee memoria que en su bot escribe otro gen que no
//                 está → {tipo:'agregar-gen', archivo, gen} por escritor
//          col    dos bots usan la misma dirección propia → {tipo:'remapear'}
//                 (las de los segundos pasan a libres, 971-990 primero)
//          gl     números de gen literales en .delgene/.mkvirus que ya no
//                 apuntan al gen de su bot → {tipo:'renumerar', i} (y
//                 'agregar-gen' para los que faltan)
//          info   sin gen que reproduzca / que consiga energía (solo si
//                 todos los genes vienen del Bestiary)
//      aplicarAccion({adn, origenes, genes, nombreDe?}, accion) → {adn, origenes}

import { diffGenes } from './lineage.js';

/** Prefijo de cada línea de un gen apagado (un comentario del ADN). */
export const PREFIJO_APAGADO = "'#off ";

/**
 * @typedef {{w: string, linea: number, ini: number, fin: number}} Token
 * @typedef {{t0: number, t1: number, l0: number, l1: number, palabras: string[]}} GenTexto
 * @typedef {{tipo: 'gen' | 'apagado', n: number, l0: number, l1: number, nombre: string,
 *   palabras: string[]}} Bloque
 * @typedef {{archivo: string, gen: number, remap?: [number, number][]}
 *   | {hash: string, gen: number} | null} OrigenGen
 * @typedef {{t: string, w?: number[], r?: number[], ai?: Record<string, number[]>, gl?: number}} GenJson
 * @typedef {{version?: number, sysAddrs?: number[], bots: Record<string, GenJson[]>}} GenesJson
 */

// ---- Texto -----------------------------------------------------------------------

/**
 * La parte de código de una línea como la lee el core (loader.hpp
 * LoadDNAText): sin el \r final, cortada en la primera ' y vacía si,
 * recortada, empieza con / (la línea entera es comentario). Es un prefijo
 * de la línea: conserva las posiciones.
 * @param {string} linea
 */
export function codigoDeLinea(linea) {
  const q = linea.indexOf("'");
  const codigo = (q >= 0 ? linea.slice(0, q) : linea).replace(/\r$/, '');
  return /^\s*\//.test(codigo) ? '' : codigo;
}

/**
 * Palabras del ADN con su línea (base 0) y su posición [ini, fin) en el
 * texto. Los comentarios (de ' al fin de la línea, o la línea entera si
 * empieza con /) no cuentan; acepta CRLF. Mismas palabras que
 * engine/lineage.js palabrasAdn.
 * @param {string} texto
 * @returns {{lineas: string[], tokens: Token[]}}
 */
export function tokensTexto(texto) {
  const s = String(texto ?? '');
  const lineas = s.split('\n');
  /** @type {Token[]} */
  const tokens = [];
  let off = 0;
  for (let l = 0; l < lineas.length; l++) {
    const linea = lineas[l];
    const codigo = codigoDeLinea(linea);
    for (const m of codigo.matchAll(/[^\s\0]+/g)) {
      const ini = off + /** @type {number} */ (m.index);
      tokens.push({ w: m[0], linea: l, ini, fin: ini + m[0].length });
    }
    off += linea.length + 1;
  }
  return { lineas, tokens };
}

/**
 * Genes activos con la regla del core (la de genesAdn), con el rango de
 * palabras [t0, t1] y de líneas [l0, l1].
 * @param {string | {lineas: string[], tokens: Token[]}} x texto o tokensTexto(texto)
 * @returns {GenTexto[]}
 */
export function genesTexto(x) {
  const { tokens } = typeof x === 'string' ? tokensTexto(x) : x;
  /** @type {GenTexto[]} */
  const genes = [];
  let t0 = -1;
  let condgene = false;
  /** @param {number} t1 */
  const cerrar = (t1) => {
    if (t0 >= 0 && t1 >= t0)
      genes.push({
        t0,
        t1,
        l0: tokens[t0].linea,
        l1: tokens[t1].linea,
        palabras: tokens.slice(t0, t1 + 1).map((k) => k.w),
      });
    t0 = -1;
    condgene = false;
  };
  let i = 0;
  for (; i < tokens.length; i++) {
    const x = tokens[i].w.toLowerCase();
    if (x === 'end') break;
    if (x === 'cond') {
      cerrar(i - 1);
      t0 = i;
      condgene = true;
    } else if (x === 'start' || x === 'else') {
      if (t0 >= 0 && condgene) condgene = false;
      else {
        cerrar(i - 1);
        t0 = i;
      }
    } else if (x === 'stop') {
      if (t0 >= 0) cerrar(i);
    }
  }
  cerrar(i - 1);
  return genes;
}

/** Nombre de un gen: el comentario de la línea de arriba, si la hay. */
function nombreArriba(
  /** @type {string[]} */ lineas,
  /** @type {number} */ l,
  /** @type {number} */ tope,
) {
  const a = l - 1;
  if (a < 0 || a <= tope) return '';
  const s = lineas[a].replace(/\r$/, '').trim();
  if (!s.startsWith("'") || s.startsWith(PREFIJO_APAGADO.trim())) return '';
  return s
    .replace(/^'+/, '')
    .replace(/^[\s-]+|[\s-]+$/g, '')
    .trim();
}

/** @param {string} linea */
const esApagada = (linea) => linea.startsWith(PREFIJO_APAGADO);

/**
 * Los genes del ADN en orden, activos y apagados (líneas con
 * PREFIJO_APAGADO), para la vista por genes. `n` es el índice del gen entre
 * los activos (base 0) o entre los apagados. `nombre`: el comentario de la
 * línea de arriba (si la hay).
 * @param {string} texto
 * @returns {Bloque[]}
 */
export function bloquesAdn(texto) {
  const tt = tokensTexto(texto);
  const { lineas } = tt;
  /** @type {Bloque[]} */
  const out = [];
  let ult = -1;
  for (const [n, g] of genesTexto(tt).entries()) {
    out.push({ tipo: 'gen', n, l0: g.l0, l1: g.l1, nombre: '', palabras: g.palabras });
  }
  // Apagados: tramos de líneas con el prefijo, leídos como ADN.
  let k = 0;
  for (let l = 0; l < lineas.length; l++) {
    if (!esApagada(lineas[l])) continue;
    let f = l;
    while (f + 1 < lineas.length && esApagada(lineas[f + 1])) f++;
    const tramo = lineas
      .slice(l, f + 1)
      .map((x) => x.slice(PREFIJO_APAGADO.length))
      .join('\n');
    for (const g of genesTexto(tramo))
      out.push({
        tipo: 'apagado',
        n: k++,
        l0: l + g.l0,
        l1: l + g.l1,
        nombre: '',
        palabras: g.palabras,
      });
    l = f;
  }
  out.sort((a, b) => a.l0 - b.l0 || (a.tipo === 'gen' ? -1 : 1));
  for (const b of out) {
    b.nombre = nombreArriba(lineas, b.l0, ult);
    ult = b.l1;
  }
  return out;
}

/**
 * Inserta saltos de línea para que las palabras [t0, t1] no compartan línea
 * con otras palabras.
 * @param {string} texto @param {number} t0 @param {number} t1
 */
function aislar(texto, t0, t1) {
  const { tokens } = tokensTexto(texto);
  let s = texto;
  const b = tokens[t1];
  const d = tokens[t1 + 1];
  if (d && d.linea === b.linea)
    s = `${s.slice(0, b.fin)}\n${s.slice(b.fin).replace(/^[ \t]+/, '')}`;
  const a = tokens[t0];
  const p = tokens[t0 - 1];
  if (p && p.linea === a.linea) s = `${s.slice(0, p.fin)}\n${s.slice(a.ini)}`;
  return s;
}

/**
 * Apaga el gen activo n: lo deja solo en sus líneas y comenta cada una con
 * PREFIJO_APAGADO (el motor lo ignora; encenderGen lo devuelve). Las líneas
 * que ya estaban apagadas (un gen apagado dentro de su rango) no se vuelven
 * a prefijar. El texto no cambia si n no existe.
 * @param {string} texto @param {number} n
 */
export function apagarGen(texto, n) {
  const g0 = genesTexto(texto)[n];
  if (!g0) return texto;
  const s = aislar(texto, g0.t0, g0.t1);
  const tt = tokensTexto(s);
  const g = genesTexto(tt)[n];
  const lineas = tt.lineas.slice();
  for (let l = g.l0; l <= g.l1; l++)
    if (!esApagada(lineas[l])) lineas[l] = PREFIJO_APAGADO + lineas[l];
  return lineas.join('\n');
}

/**
 * Enciende el gen apagado k (quita el prefijo de sus líneas).
 * @param {string} texto @param {number} k
 */
export function encenderGen(texto, k) {
  const b = bloquesAdn(texto).find((x) => x.tipo === 'apagado' && x.n === k);
  if (!b) return texto;
  const lineas = texto.split('\n');
  for (let l = b.l0; l <= b.l1; l++)
    if (esApagada(lineas[l])) lineas[l] = lineas[l].slice(PREFIJO_APAGADO.length);
  return lineas.join('\n');
}

/**
 * Agrega un gen al final del ADN (antes del `end`, si hay uno: lo que sigue
 * al `end` no se ejecuta), con una línea de comentario opcional arriba. Si
 * el `end` comparte línea con código, la línea se parte: el código queda
 * arriba y el `end` pasa a su propia línea, debajo del gen nuevo.
 * @param {string} texto @param {string} codigo @param {string} [cabecera]
 */
export function insertarGen(texto, codigo, cabecera) {
  return insertarGenEn(texto, codigo, cabecera).adn;
}

/**
 * insertarGen más la posición del texto donde empieza lo insertado (para
 * saber cuál es el gen nuevo).
 * @param {string} texto @param {string} codigo @param {string} [cabecera]
 * @returns {{adn: string, pos: number}}
 */
export function insertarGenEn(texto, codigo, cabecera) {
  const bloque = `${cabecera ? `' ${cabecera}\n` : ''}${codigo.replace(/\n+$/, '')}\n`;
  const { tokens } = tokensTexto(texto);
  const k = tokens.findIndex((x) => x.w.toLowerCase() === 'end');
  if (k >= 0) {
    const fin = tokens[k];
    const ini = texto.lastIndexOf('\n', fin.ini - 1) + 1;
    const antes = tokens[k - 1];
    if (antes && antes.linea === fin.linea) {
      // código y end en la misma línea: se parte delante del end
      const arriba = texto.slice(0, antes.fin);
      const sangria = /^[ \t]*/.exec(texto.slice(ini))?.[0] ?? '';
      return {
        adn: `${arriba}\n${bloque}${sangria}${texto.slice(fin.ini)}`,
        pos: arriba.length + 1,
      };
    }
    return { adn: `${texto.slice(0, ini)}${bloque}${texto.slice(ini)}`, pos: ini };
  }
  if (!texto.trim()) return { adn: bloque, pos: 0 };
  const arriba = `${texto.replace(/\n*$/, '')}\n\n`;
  return { adn: `${arriba}${bloque}`, pos: arriba.length };
}

/**
 * Reemplaza palabras sueltas del texto (índice de tokensTexto → palabra
 * nueva); el resto del texto (espacios, comentarios) queda igual.
 * @param {string} texto @param {{i: number, w: string}[]} cambios
 */
export function reemplazarPalabras(texto, cambios) {
  const { tokens } = tokensTexto(texto);
  let s = texto;
  for (const c of [...cambios].sort((a, b) => b.i - a.i)) {
    const k = tokens[c.i];
    if (k) s = s.slice(0, k.ini) + c.w + s.slice(k.fin);
  }
  return s;
}

/** Clave de un gen para la memoria de orígenes: sus palabras. @param {string[]} p */
export const claveGen = (p) => p.join(' ');

/**
 * El origen de cada gen activo de `nuevo` a partir de los de `viejo`
 * (diffGenes de engine/lineage.js): un gen igual o cambiado conserva el suyo;
 * uno agregado lo toma de `memoria` (palabras del gen → origen) o queda en
 * null. Devuelve una entrada por gen.
 * @param {string} viejo @param {string} nuevo
 * @param {(OrigenGen | undefined)[] | null | undefined} origenes
 * @param {Map<string, OrigenGen>} [memoria]
 * @returns {OrigenGen[]}
 */
export function realinearOrigenes(viejo, nuevo, origenes, memoria) {
  const d = diffGenes(viejo, nuevo);
  /** @type {OrigenGen[]} */
  const out = d.genesB.map(() => null);
  for (const c of d.cambios) {
    if (c.b === null) continue;
    if (c.a !== null) out[c.b] = origenes?.[c.a] ?? null;
    else out[c.b] = memoria?.get(d.genesB[c.b]) ?? null;
  }
  return out.map((o) => (o ? structuredClone(o) : null));
}

/**
 * Orígenes para guardar (engine/bots.js guardarVersion): undefined si
 * ningún gen tiene origen.
 * @param {OrigenGen[] | null | undefined} origenes
 */
export const origenesParaGuardar = (origenes) =>
  origenes?.some(Boolean) ? origenes.map((o) => (o ? structuredClone(o) : null)) : undefined;

// ---- Laboratorio (port/web/lab.js) ---------------------------------------------

/**
 * @typedef {{file: string, gi: number}} Parte
 * @typedef {{tipo: 'dep', archivo: string, gen: number, dir: number, escritores: number[]}
 *   | {tipo: 'gl', archivo: string, gen: number}
 *   | {tipo: 'col', dir: number, archivos: string[]}
 *   | {tipo: 'remap', dir: number, archivos: string[], movidos: {archivo: string, a: number}[]}
 *   | {tipo: 'info', motivo: 'sin-repro' | 'sin-energia'}} AvisoPartes
 */

const CAPS_ENERGIA = ['caza-nrg', 'caza-cuerpo', 'dispara', 'come-lazo', 'fotosintesis'];

/** Pozo de direcciones libres: 971-990 primero (la zona de costumbre), después 1-1000. */
function pozoDirecciones() {
  /** @type {number[]} */
  const pozo = [];
  for (let a = 971; a <= 990; a++) pozo.push(a);
  for (let a = 1; a <= 1000; a++) if (a < 971 || a > 990) pozo.push(a);
  return pozo;
}

/**
 * Análisis de un híbrido de partes de genes.json, igual que labAnalyze de
 * la clásica: dependencias y números de gen literales por bot de origen,
 * colisiones de memoria propia entre bots (con `remap`, las de los bots
 * que no son el primero pasan a direcciones libres) y avisos de
 * capacidades. `direcciones(parte)` permite usar las direcciones ya
 * remapeadas de cada parte en las colisiones (el editor); por defecto, las
 * de genes.json.
 * @param {Parte[]} partes
 * @param {GenesJson} genes
 * @param {{remap?: boolean, capsDe?: (file: string, gi: number) => string[],
 *   direcciones?: (p: Parte, g: GenJson) => {w: number[], r: number[]}}} [o]
 * @returns {{remaps: Map<string, Map<number, number>>, avisos: AvisoPartes[], caps: Set<string>}}
 */
export function analizarPartes(partes, genes, o = {}) {
  const remap = o.remap !== false;
  /** @type {AvisoPartes[]} */
  const avisos = [];
  /** @type {Set<string>} */
  const caps = new Set();
  /** @type {Map<string, Set<number>>} */
  const porArchivo = new Map();
  for (const p of partes) {
    let s = porArchivo.get(p.file);
    if (!s) {
      s = new Set();
      porArchivo.set(p.file, s);
    }
    s.add(p.gi);
    for (const c of o.capsDe?.(p.file, p.gi) ?? []) caps.add(c);
  }

  for (const [file, incl] of porArchivo) {
    const todos = genes.bots[file] || [];
    for (const gi of incl) {
      const g = todos[gi];
      for (const a of g.r || []) {
        if ([...incl].some((j) => (todos[j].w || []).includes(a))) continue;
        const escritores = todos
          .map((x, j) => ((x.w || []).includes(a) ? j : -1))
          .filter((j) => j >= 0);
        if (escritores.length)
          avisos.push({ tipo: 'dep', archivo: file, gen: gi, dir: a, escritores });
      }
      if (g.gl) avisos.push({ tipo: 'gl', archivo: file, gen: gi });
    }
  }

  /** @type {Map<number, string[]>} */
  const usos = new Map();
  for (const [file, incl] of porArchivo)
    for (const gi of incl) {
      const g = genes.bots[file][gi];
      const d = o.direcciones ? o.direcciones({ file, gi }, g) : { w: g.w || [], r: g.r || [] };
      for (const a of [...d.w, ...d.r]) {
        let l = usos.get(a);
        if (!l) {
          l = [];
          usos.set(a, l);
        }
        if (!l.includes(file)) l.push(file);
      }
    }
  /** @type {Map<string, Map<number, number>>} */
  const remaps = new Map();
  const tomadas = new Set(usos.keys());
  const sys = new Set(genes.sysAddrs || []);
  const pozo = pozoDirecciones();
  const libre = () => {
    const a = pozo.find((x) => !tomadas.has(x) && !sys.has(x));
    if (a !== undefined) tomadas.add(a);
    return a;
  };
  for (const [a, files] of usos) {
    if (files.length < 2) continue;
    if (!remap) {
      avisos.push({ tipo: 'col', dir: a, archivos: [...files] });
      continue;
    }
    /** @type {{archivo: string, a: number}[]} */
    const movidos = [];
    for (const f of files.slice(1)) {
      const b = libre();
      if (b === undefined) break;
      let m = remaps.get(f);
      if (!m) {
        m = new Map();
        remaps.set(f, m);
      }
      m.set(a, b);
      movidos.push({ archivo: f, a: b });
    }
    avisos.push({ tipo: 'remap', dir: a, archivos: [...files], movidos });
  }

  if (partes.length) {
    if (!caps.has('repro-asex') && !caps.has('repro-sex'))
      avisos.push({ tipo: 'info', motivo: 'sin-repro' });
    if (!CAPS_ENERGIA.some((c) => caps.has(c)))
      avisos.push({ tipo: 'info', motivo: 'sin-energia' });
  }
  return { remaps, avisos, caps };
}

/**
 * Texto del gen con las direcciones literales remapeadas (labGeneText de
 * la clásica: solo los tokens que el analizador marcó como dirección).
 * @param {GenJson} g @param {Map<number, number> | null | undefined} remap
 */
export function textoGenRemapeado(g, remap) {
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

/** @param {string} t */
const palabras = (t) => t.split(/\s+/).filter(Boolean);

/**
 * Posiciones (índice de palabra del gen) de los números de gen literales:
 * `N .delgene store` / `N .mkvirus store` con N > 0.
 * @param {string[]} p
 * @returns {{k: number, n: number}[]}
 */
export function literalesGen(p) {
  const out = [];
  for (let k = 0; k + 2 < p.length; k++) {
    if (!/^\d+$/.test(p[k])) continue;
    const op = p[k + 1].toLowerCase();
    if ((op === '.delgene' || op === '.mkvirus') && p[k + 2].toLowerCase() === 'store' && +p[k] > 0)
      out.push({ k, n: +p[k] });
  }
  return out;
}

/** @param {OrigenGen | undefined} o @returns {Map<number, number> | null} */
const remapDe = (o) => (o && 'archivo' in o && o.remap?.length ? new Map(o.remap) : null);

/**
 * @typedef {{tipo: 'agregar-gen', archivo: string, gen: number}
 *   | {tipo: 'remapear'} | {tipo: 'renumerar', i: number}} AccionLab
 * @typedef {{tipo: 'dep', i: number, archivo: string, gen: number, dir: number,
 *     escritores: number[], acciones: AccionLab[]}
 *   | {tipo: 'col', dir: number, archivos: string[], acciones: AccionLab[]}
 *   | {tipo: 'gl', i: number, archivo: string, gen: number, faltan: number[], acciones: AccionLab[]}
 *   | {tipo: 'info', motivo: 'sin-repro' | 'sin-energia', acciones: AccionLab[]}} AvisoLab
 * @typedef {{i: number, archivo: string, gen: number, g: GenJson, remap: Map<number, number> | null,
 *   gt: GenTexto}} ParteEditor
 */

/**
 * Las partes del ADN que vienen de genes.json (origen {archivo, gen} con el
 * gen todavía en genes.json).
 * @param {string} adn @param {(OrigenGen | undefined)[] | null | undefined} origenes
 * @param {GenesJson} genes
 */
function partesEditor(adn, origenes, genes) {
  const tt = tokensTexto(adn);
  const gs = genesTexto(tt);
  /** @type {ParteEditor[]} */
  const partes = [];
  for (const [i, gt] of gs.entries()) {
    const o = origenes?.[i];
    if (!o || !('archivo' in o)) continue;
    const g = genes.bots[o.archivo]?.[o.gen];
    if (g) partes.push({ i, archivo: o.archivo, gen: o.gen, g, remap: remapDe(o), gt });
  }
  return { tt, gs, partes };
}

/**
 * ¿El gen del editor sigue siendo el de genes.json (con su remapeo)? Se
 * ignoran las posiciones de los números de gen literales (se renumeran).
 * @param {ParteEditor} p
 */
function intacta(p) {
  const esperado = palabras(textoGenRemapeado(p.g, p.remap));
  if (esperado.length !== p.gt.palabras.length) return false;
  const lit = new Set(p.g.gl ? literalesGen(esperado).map((x) => x.k) : []);
  return esperado.every((w, k) => lit.has(k) || w === p.gt.palabras[k]);
}

/**
 * Los avisos del Laboratorio para el ADN del editor (ver la cabecera), con
 * sus acciones de un clic.
 * @param {{adn: string, origenes: (OrigenGen | undefined)[] | null | undefined, genes: GenesJson,
 *   capsDe?: (file: string, gi: number) => string[]}} o
 * @returns {{avisos: AvisoLab[], caps: Set<string>}}
 */
export function avisosLab(o) {
  const { gs, partes } = partesEditor(o.adn, o.origenes, o.genes);
  /** @type {Parte[]} */
  const lista = partes.map((p) => ({ file: p.archivo, gi: p.gen }));
  /** @type {Map<string, ParteEditor>} */
  const primera = new Map();
  for (const p of partes) {
    const k = `${p.archivo}#${p.gen}`;
    if (!primera.has(k)) primera.set(k, p);
  }
  const { avisos: base, caps } = analizarPartes(lista, o.genes, {
    remap: false,
    capsDe: o.capsDe,
    direcciones: (x, g) => {
      const m = primera.get(`${x.file}#${x.gi}`)?.remap;
      const f = (/** @type {number} */ a) => m?.get(a) ?? a;
      return { w: (g.w || []).map(f), r: (g.r || []).map(f) };
    },
  });
  /** @type {AvisoLab[]} */
  const avisos = [];
  /** Posición en el editor del gen `gen` de `archivo` (o −1). */
  const posicion = (/** @type {string} */ archivo, /** @type {number} */ gen) =>
    partes.find((p) => p.archivo === archivo && p.gen === gen)?.i ?? -1;
  let colisiones = false;
  for (const a of base) {
    if (a.tipo === 'dep') {
      const p = /** @type {ParteEditor} */ (primera.get(`${a.archivo}#${a.gen}`));
      avisos.push({
        ...a,
        i: p.i,
        acciones: a.escritores.map((gen) => ({ tipo: 'agregar-gen', archivo: a.archivo, gen })),
      });
    } else if (a.tipo === 'gl') {
      for (const p of partes) {
        if (p.archivo !== a.archivo || p.gen !== a.gen) continue;
        const esperado = palabras(textoGenRemapeado(p.g, p.remap));
        const lits = literalesGen(esperado);
        /** @type {number[]} */
        const faltan = [];
        let mal = false;
        for (const x of lits) {
          const pos = posicion(p.archivo, x.n - 1);
          if (pos < 0) {
            if (!faltan.includes(x.n - 1)) faltan.push(x.n - 1);
          } else if (p.gt.palabras[x.k] !== String(pos + 1)) mal = true;
        }
        if (!mal && !faltan.length) continue;
        /** @type {AccionLab[]} */
        const acciones = [];
        if (mal && intacta(p)) acciones.push({ tipo: 'renumerar', i: p.i });
        for (const gen of faltan) acciones.push({ tipo: 'agregar-gen', archivo: p.archivo, gen });
        avisos.push({ tipo: 'gl', i: p.i, archivo: p.archivo, gen: p.gen, faltan, acciones });
      }
    } else if (a.tipo === 'col') {
      colisiones = true;
      avisos.push({ ...a, acciones: [] });
    } else if (a.tipo === 'info') {
      // Solo si todo el ADN es de genes del Bestiary: de los genes escritos
      // a mano no se conocen las capacidades.
      if (partes.length === gs.length) avisos.push({ ...a, acciones: [] });
    }
  }
  if (colisiones && planRemapeo(partes, o.genes)) {
    for (const a of avisos) if (a.tipo === 'col') a.acciones = [{ tipo: 'remapear' }];
  }
  return { avisos, caps };
}

/**
 * Remapeo de las colisiones (el de labAnalyze sobre las direcciones que
 * tiene hoy cada parte), o null si alguna parte a remapear ya no es el gen
 * de genes.json (editado a mano: no se sabe qué palabra es una dirección).
 * Devuelve el remapeo nuevo de cada archivo (dirección ORIGINAL → nueva).
 * @param {ParteEditor[]} partes @param {GenesJson} genes
 * @returns {Map<string, Map<number, number>> | null}
 */
function planRemapeo(partes, genes) {
  /** @type {Map<string, Map<number, number>>} */
  const actual = new Map();
  for (const p of partes) if (p.remap && !actual.has(p.archivo)) actual.set(p.archivo, p.remap);
  const efectiva = (/** @type {string} */ f, /** @type {number} */ a) => actual.get(f)?.get(a) ?? a;
  const { remaps } = analizarPartes(
    partes.map((p) => ({ file: p.archivo, gi: p.gen })),
    genes,
    {
      remap: true,
      direcciones: (x, g) => ({
        w: (g.w || []).map((a) => efectiva(x.file, a)),
        r: (g.r || []).map((a) => efectiva(x.file, a)),
      }),
    },
  );
  if (!remaps.size) return null;
  /** @type {Map<string, Map<number, number>>} */
  const out = new Map();
  for (const [f, mov] of remaps) {
    if (partes.some((p) => p.archivo === f && !intacta(p))) return null;
    // compone: original → efectiva → nueva
    const m = new Map(actual.get(f) ?? []);
    const dirs = new Set();
    for (const p of partes)
      if (p.archivo === f) for (const a of [...(p.g.w || []), ...(p.g.r || [])]) dirs.add(a);
    for (const a of dirs) {
      const e = efectiva(f, a);
      const n = mov.get(e);
      if (n !== undefined) m.set(a, n);
    }
    out.set(f, m);
  }
  return out;
}

/**
 * Aplica una acción de un aviso del Laboratorio. `agregar-gen` inserta el
 * gen de genes.json al final (con el remapeo que ya tenga su bot en el
 * ADN) y le guarda el origen; `remapear` reescribe las direcciones de los
 * genes que chocan; `renumerar` corrige los números de gen literales del
 * gen i para que apunten a la posición actual de los genes de su bot.
 * @param {{adn: string, origenes: (OrigenGen | undefined)[] | null | undefined, genes: GenesJson,
 *   nombreDe?: (archivo: string) => string | undefined}} o
 * @param {AccionLab} accion
 * @returns {{adn: string, origenes: OrigenGen[]}}
 */
export function aplicarAccion(o, accion) {
  const { tt, gs, partes } = partesEditor(o.adn, o.origenes, o.genes);
  /** @type {OrigenGen[]} */
  const origenes = gs.map((_, i) => (o.origenes?.[i] ? structuredClone(o.origenes[i]) : null));
  if (accion.tipo === 'agregar-gen') {
    const g = o.genes.bots[accion.archivo]?.[accion.gen];
    if (!g) return { adn: o.adn, origenes };
    const remap = partes.find((p) => p.archivo === accion.archivo && p.remap)?.remap ?? null;
    const nombre = o.nombreDe?.(accion.archivo) ?? accion.archivo;
    const { adn, pos } = insertarGenEn(
      o.adn,
      textoGenRemapeado(g, remap),
      `${nombre} #${accion.gen + 1}`,
    );
    /** @type {OrigenGen} */
    const og = { archivo: accion.archivo, gen: accion.gen };
    if (remap) og.remap = [...remap];
    // el gen nuevo es el primero que empieza en lo insertado: los de antes
    // conservan su origen y los de después (si los hubiera) corren un lugar
    const tn = tokensTexto(adn);
    const gn = genesTexto(tn);
    let k = gn.findIndex((x) => tn.tokens[x.t0].ini >= pos);
    if (k < 0) k = gn.length - 1;
    /** @type {OrigenGen[]} */
    const out = [];
    for (let i = 0; i < gn.length; i++)
      out.push(i < k ? (origenes[i] ?? null) : i === k ? og : (origenes[i - 1] ?? null));
    return { adn, origenes: out };
  }
  if (accion.tipo === 'remapear') {
    const plan = planRemapeo(partes, o.genes);
    if (!plan) return { adn: o.adn, origenes };
    /** @type {{i: number, w: string}[]} */
    const cambios = [];
    for (const p of partes) {
      const m = plan.get(p.archivo);
      if (!m) continue;
      const nuevas = palabras(textoGenRemapeado(p.g, m));
      const lit = new Set(p.g.gl ? literalesGen(nuevas).map((x) => x.k) : []);
      nuevas.forEach((w, k) => {
        if (!lit.has(k) && w !== p.gt.palabras[k]) cambios.push({ i: p.gt.t0 + k, w });
      });
      const og = /** @type {{archivo: string, gen: number, remap?: [number, number][]}} */ (
        origenes[p.i]
      );
      og.remap = [...m].sort((a, b) => a[0] - b[0]);
    }
    return { adn: reemplazarPalabras(o.adn, cambios), origenes };
  }
  // renumerar
  const p = partes.find((x) => x.i === accion.i);
  if (!p || !intacta(p)) return { adn: o.adn, origenes };
  /** @type {{i: number, w: string}[]} */
  const cambios = [];
  for (const x of literalesGen(palabras(textoGenRemapeado(p.g, p.remap)))) {
    const pos = partes.find((q) => q.archivo === p.archivo && q.gen === x.n - 1)?.i;
    if (pos !== undefined && tt.tokens[p.gt.t0 + x.k].w !== String(pos + 1))
      cambios.push({ i: p.gt.t0 + x.k, w: String(pos + 1) });
  }
  return { adn: reemplazarPalabras(o.adn, cambios), origenes };
}

/**
 * Genes de genes.json para el panel «Genes»: por capacidad (todo el
 * Bestiary, de menos a más palabras) o de un bot (en orden). `perfiles`:
 * profiles.json (geneCaps por archivo); `q` filtra por nombre del bot;
 * `autonomos`: sin memoria propia (se trasplantan sin dependencias ni
 * colisiones). Como labRenderSource de la clásica.
 * @param {{genes: GenesJson, perfiles: {bots: Record<string, {geneCaps: string[][]}>},
 *   bestiario: {file: string, name: string}[]}} datos
 * @param {{modo: 'cap' | 'bot', cap?: string, archivo?: string, q?: string, autonomos?: boolean}} f
 * @returns {{archivo: string, gen: number, nombre: string, palabras: number, caps: string[],
 *   memoria: boolean}[]}
 */
export function buscarGenes(datos, f) {
  const out = [];
  const q = (f.q ?? '').trim().toLowerCase();
  /** @param {string} archivo @param {string} nombre @param {number} gen */
  const agregar = (archivo, nombre, gen) => {
    const g = datos.genes.bots[archivo][gen];
    const memoria = !!(g.w || g.r);
    if (f.autonomos && memoria) return;
    out.push({
      archivo,
      gen,
      nombre,
      palabras: g.t.split(/\s+/).length,
      caps: datos.perfiles.bots[archivo]?.geneCaps?.[gen] ?? [],
      memoria,
    });
  };
  if (f.modo === 'cap') {
    for (const b of datos.bestiario) {
      const p = datos.perfiles.bots[b.file];
      if (!p || !datos.genes.bots[b.file]) continue;
      if (q && !b.name.toLowerCase().includes(q)) continue;
      p.geneCaps.forEach((cs, gi) => {
        if (f.cap && cs.includes(f.cap)) agregar(b.file, b.name, gi);
      });
    }
    out.sort((a, b) => a.palabras - b.palabras);
  } else if (f.archivo) {
    const nombre = datos.bestiario.find((b) => b.file === f.archivo)?.name ?? f.archivo;
    (datos.genes.bots[f.archivo] || []).forEach((_, gi) => {
      agregar(/** @type {string} */ (f.archivo), nombre, gi);
    });
  }
  return out;
}
