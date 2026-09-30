// @ts-check
// Genealogía de una corrida (decisión 9 de port/web2/PLAN.md, C7), sin DOM.
//
//   - Árbol de especies COMPLETO: cada especie con su madre (la especie de
//     la madre del primer bot visto, de db_sim_species_origin; si el core no
//     la sabe —madre ya muerta al registrarla— se completa con los
//     individuos conocidos). Sin autoespeciación (C7) queda casi plano: las
//     sembradas y las llegadas por teleporter son raíces; el formato admite
//     cualquier profundidad (un .dbsim con autoespeciación encendida).
//   - Individuos PODADOS a los ancestros de los vivos: cada AbsNum con su
//     madre, especie, generación, nacimiento… a partir de db_sim_dump_lineage
//     (las filas de ahora y los nacidos entre muestras que junta el worker);
//     tras cada muestra se descarta todo lo que no sea un vivo o ancestro de
//     un vivo. Un ancestro que el worker no llegó a ver (sin `linaje` en el
//     muestreo, o de antes de cargar la corrida) queda como hueco: su hijo
//     conserva `parent` y la cadena se corta ahí.
//   - Fotos del ADN dominante de cada especie: una cada vez que cambia (el
//     worker manda el texto solo cuando cambia su hash). La primera es la del
//     fundador; diffGenes compara dos fotos gen por gen. Se conservan
//     `maxFotos` por especie (la primera siempre) y, entre todas, a lo sumo
//     `maxBytesFotos` de ADN (1 MB; el ADN de un bot ronda 1-10 KB): al
//     pasarse, la especie con más fotos pierde una de cada dos intermedias
//     (quedan la del fundador y la última); si todas tienen dos o menos, la
//     que más ocupa pierde la última. La del fundador no se descarta nunca
//     (con miles de especies, las de los fundadores solas pueden pasar el
//     tope). Medido con el motor (test/muestreo_worker.test.js): 2.000
//     ciclos de depredador y presa, ~300 individuos y 2 especies, ~20 KB.
//
// Los nombres de especie van sin «.txt»; «Corpse» no es especie (un bot que
// muere pasa a llamarse así: se conserva la especie con que se lo vio vivo).

import { esCadaver, FLAG_LINAJE, N_LINAJE, N_ORIGEN, nombreEspecie } from './metricas.js';

export const MAX_FOTOS = 50;
/** Tope del ADN de todas las fotos juntas (caracteres ≈ bytes: el ADN es ASCII). */
export const MAX_BYTES_FOTOS = 1024 * 1024;
const VERSION = 1;

/**
 * @typedef {object} Individuo
 * @property {number} abs
 * @property {number} parent   AbsNum de la madre (0 = fundador)
 * @property {string} especie
 * @property {number} gen
 * @property {number} mut
 * @property {number} nacido   BirthCycle
 * @property {number} adnLen
 * @property {number} hijos
 * @property {boolean} veg
 */

/**
 * @typedef {object} Especie
 * @property {string} nombre
 * @property {number} ciclo      ciclo en que se registró por primera vez
 * @property {number} primerAbs
 * @property {number} madreAbs   AbsNum de la madre del primer bot (0 = fundador)
 * @property {string | null} madre  especie madre (null = raíz)
 */

/**
 * @typedef {object} Foto
 * @property {number} ciclo
 * @property {number} hash
 * @property {number} copias
 * @property {number} adnLen
 * @property {number} abs
 * @property {string} adn
 */

export class Linaje {
  /** @type {Map<string, Especie>} */
  especies = new Map();
  /** @type {Map<number, Individuo>} */
  individuos = new Map();
  /** @type {Set<number>} vivos de la última muestra */
  vivos = new Set();
  /** @type {Map<string, Foto[]>} */
  fotos = new Map();
  maxFotos;
  maxBytesFotos;
  /** ciclo de la última muestra con linaje (−1 = ninguna) */
  ciclo = -1;

  /** @param {{maxFotos?: number, maxBytesFotos?: number}} [o] */
  constructor(o = {}) {
    this.maxFotos = Math.max(2, o.maxFotos ?? MAX_FOTOS);
    this.maxBytesFotos = Math.max(1024, o.maxBytesFotos ?? MAX_BYTES_FOTOS);
  }

  /** Caracteres de ADN de todas las fotos. */
  bytesFotos() {
    let b = 0;
    for (const fs of this.fotos.values()) for (const f of fs) b += f.adn.length;
    return b;
  }

  /** Aplica maxBytesFotos (ver la cabecera). */
  #topeFotos() {
    let total = this.bytesFotos();
    while (total > this.maxBytesFotos) {
      /** @type {Foto[] | null} */
      let mas = null;
      for (const fs of this.fotos.values()) if (!mas || fs.length > mas.length) mas = fs;
      if (!mas || mas.length <= 1) return;
      if (mas.length > 2) {
        const medio = mas.slice(1, -1).filter((_, i) => i % 2 === 1);
        mas.splice(0, mas.length, mas[0], ...medio, mas[mas.length - 1]);
      } else {
        // todas con dos o menos: la última de la que más ocupa
        let peor = mas;
        let bytes = -1;
        for (const fs of this.fotos.values()) {
          const b = fs.length > 1 ? fs[1].adn.length : -1;
          if (b > bytes) {
            bytes = b;
            peor = fs;
          }
        }
        if (bytes < 0) return;
        peor.length = 1;
      }
      total = this.bytesFotos();
    }
  }

  /**
   * Suma una muestra del worker: `linaje` (filas, nacidos, origen, nombres)
   * y `dominante`. Cualquiera de los dos puede faltar.
   * @param {{ciclo: number, linaje?: {filas: ArrayLike<number>, nacidos?: ArrayLike<number>,
   *   origen?: ArrayLike<number>, nombres: string[]} | null,
   *   dominante?: {nombre: string, hash: number, copias: number, adnLen: number, abs: number,
   *   adn?: string}[] | null}} m
   */
  agregar(m) {
    if (m.linaje) this.agregarLinaje(m.ciclo, m.linaje);
    if (m.dominante) this.agregarDominantes(m.ciclo, m.dominante);
  }

  /**
   * @param {number} ciclo
   * @param {{filas: ArrayLike<number>, nacidos?: ArrayLike<number>, origen?: ArrayLike<number>,
   *   nombres: string[]}} l
   */
  agregarLinaje(ciclo, l) {
    const nombres = l.nombres.map(nombreEspecie);
    /** @param {number} i */
    const nombre = (i) => nombres[i] ?? '';
    /**
     * @param {ArrayLike<number>} f @param {number} o
     * @returns {Individuo}
     */
    const leer = (f, o) => ({
      abs: f[o],
      parent: f[o + 1],
      especie: nombre(f[o + 2]),
      gen: f[o + 3],
      mut: f[o + 4],
      nacido: f[o + 5],
      adnLen: f[o + 6],
      hijos: f[o + 8],
      veg: (f[o + 7] & FLAG_LINAJE.veg) !== 0,
    });
    /** @param {Individuo} x */
    const guardar = (x) => {
      const ya = this.individuos.get(x.abs);
      if (esCadaver(x.especie)) {
        // de cadáver no se sabe la especie: la de cuando se lo vio vivo
        if (ya) return;
        x.especie = '';
      } else if (ya) {
        // se lo conocía: lo que cambia en vida
        ya.hijos = Math.max(ya.hijos, x.hijos);
        ya.mut = x.mut;
        if (!ya.especie) ya.especie = x.especie;
        return;
      }
      this.individuos.set(x.abs, x);
    };
    const nac = l.nacidos ?? [];
    for (let o = 0; o + N_LINAJE <= nac.length; o += N_LINAJE) guardar(leer(nac, o));
    /** @type {Set<number>} */
    const vivos = new Set();
    for (let o = 0; o + N_LINAJE <= l.filas.length; o += N_LINAJE) {
      const x = leer(l.filas, o);
      guardar(x);
      if (!(l.filas[o + 7] & FLAG_LINAJE.cadaver)) vivos.add(x.abs);
    }
    this.vivos = vivos;
    this.ciclo = ciclo;
    if (l.origen) this.agregarOrigen(l.origen, nombres);
    this.podar();
  }

  /**
   * Filas de db_sim_species_origin (índices de `nombres`, sin «.txt»). La
   * primera vez que se ve una especie queda su origen; después solo se
   * completa la madre que faltaba.
   * @param {ArrayLike<number>} o @param {string[]} nombres
   */
  agregarOrigen(o, nombres) {
    for (let r = 0; r + N_ORIGEN <= o.length; r += N_ORIGEN) {
      const nombre = nombres[o[r]] ?? '';
      if (!nombre || esCadaver(nombre)) continue;
      const madreIdx = o[r + 4];
      let madre = madreIdx >= 0 ? (nombres[madreIdx] ?? null) : null;
      if (!madre && o[r + 3]) {
        const mi = this.individuos.get(o[r + 3]);
        if (mi?.especie && mi.especie !== nombre) madre = mi.especie;
      }
      if (madre && (esCadaver(madre) || madre === nombre)) madre = null;
      const ya = this.especies.get(nombre);
      if (ya) {
        if (!ya.madre && madre && !this.#esAncestroDe(nombre, madre)) ya.madre = madre;
        continue;
      }
      this.especies.set(nombre, {
        nombre,
        ciclo: o[r + 1],
        primerAbs: o[r + 2],
        madreAbs: o[r + 3],
        madre: madre && !this.#esAncestroDe(nombre, madre) ? madre : null,
      });
    }
  }

  /** ¿`a` es ancestro de `b` (o `b` mismo) en el árbol de especies? (evita ciclos) */
  #esAncestroDe(/** @type {string} */ a, /** @type {string} */ b) {
    /** @type {string | null} */
    let x = b;
    const vistos = new Set();
    while (x && !vistos.has(x)) {
      if (x === a) return true;
      vistos.add(x);
      x = this.especies.get(x)?.madre ?? null;
    }
    return false;
  }

  /** Deja solo los vivos y sus ancestros conocidos. Devuelve cuántos descartó. */
  podar() {
    /** @type {Set<number>} */
    const quedan = new Set();
    for (const v of this.vivos) {
      let a = v;
      while (a && !quedan.has(a)) {
        const x = this.individuos.get(a);
        if (!x) break;
        quedan.add(a);
        a = x.parent;
      }
    }
    let n = 0;
    for (const abs of [...this.individuos.keys()])
      if (!quedan.has(abs)) {
        this.individuos.delete(abs);
        n++;
      }
    return n;
  }

  /**
   * Fotos del ADN dominante: una nueva cuando el hash de la especie cambia
   * (el texto llega solo en ese caso; sin texto no hay foto).
   * @param {number} ciclo
   * @param {{nombre: string, hash: number, copias: number, adnLen: number, abs: number,
   *   adn?: string}[]} lista
   */
  agregarDominantes(ciclo, lista) {
    for (const d of lista) {
      const nombre = nombreEspecie(d.nombre);
      if (!nombre || esCadaver(nombre) || typeof d.adn !== 'string') continue;
      const fs = this.fotos.get(nombre) ?? [];
      const ult = fs[fs.length - 1];
      if (ult && ult.hash === d.hash) continue;
      fs.push({ ciclo, hash: d.hash, copias: d.copias, adnLen: d.adnLen, abs: d.abs, adn: d.adn });
      if (fs.length > this.maxFotos) {
        // la primera (fundador) y la última siempre; del resto, una de cada dos
        const medio = fs.slice(1, -1).filter((_, i) => i % 2 === 1);
        fs.splice(0, fs.length, fs[0], ...medio, fs[fs.length - 1]);
      }
      this.fotos.set(nombre, fs);
    }
    this.#topeFotos();
  }

  /** La primera foto de la especie (el fundador) y la última. @param {string} especie */
  fundadorYActual(especie) {
    const fs = this.fotos.get(nombreEspecie(especie)) ?? [];
    return { fundador: fs[0] ?? null, actual: fs[fs.length - 1] ?? null };
  }

  /**
   * Árbol de especies: raíces con sus hijas (orden de registro).
   * @returns {(Especie & {hijas: any[]})[]}
   */
  arbolEspecies() {
    /** @type {Map<string, Especie & {hijas: any[]}>} */
    const nodos = new Map();
    const orden = [...this.especies.values()].sort((a, b) => a.ciclo - b.ciclo);
    for (const e of orden) nodos.set(e.nombre, { ...e, hijas: [] });
    const raices = [];
    for (const n of nodos.values()) {
      const m = n.madre ? nodos.get(n.madre) : undefined;
      if (m) m.hijas.push(n);
      else raices.push(n);
    }
    return raices;
  }

  /**
   * Cadena de ancestros conocidos de un individuo (él primero, el más viejo
   * al final).
   * @param {number} abs
   */
  ancestros(abs) {
    const out = [];
    const vistos = new Set();
    let a = abs;
    while (a && !vistos.has(a)) {
      const x = this.individuos.get(a);
      if (!x) break;
      vistos.add(a);
      out.push(x);
      a = x.parent;
    }
    return out;
  }

  /** Hijos conocidos de cada individuo (para dibujar el árbol). */
  hijos() {
    /** @type {Map<number, number[]>} */
    const out = new Map();
    for (const x of this.individuos.values()) {
      if (!x.parent || !this.individuos.has(x.parent)) continue;
      const l = out.get(x.parent) ?? [];
      l.push(x.abs);
      out.set(x.parent, l);
    }
    return out;
  }

  /**
   * Descarta lo posterior al ciclo c (retomar una corrida en c): especies
   * registradas después, individuos nacidos después y fotos posteriores.
   * @param {number} c
   */
  recortar(c) {
    for (const [k, e] of this.especies) if (e.ciclo > c) this.especies.delete(k);
    for (const e of this.especies.values())
      if (e.madre && !this.especies.has(e.madre)) e.madre = null;
    for (const [abs, x] of this.individuos) if (x.nacido > c) this.individuos.delete(abs);
    for (const v of [...this.vivos]) if (!this.individuos.has(v)) this.vivos.delete(v);
    for (const [k, fs] of this.fotos) {
      const q = fs.filter((f) => f.ciclo <= c);
      if (q.length) this.fotos.set(k, q);
      else this.fotos.delete(k);
    }
    if (this.ciclo > c) this.ciclo = c;
  }

  /** Forma compacta para IndexedDB: individuos en un Int32Array. */
  serializar() {
    const nombres = [...new Set([...this.individuos.values()].map((x) => x.especie))];
    const idx = new Map(nombres.map((n, i) => [n, i]));
    const xs = [...this.individuos.values()];
    const K = 8;
    const ind = new Int32Array(xs.length * K);
    xs.forEach((x, i) => {
      ind.set(
        [
          x.abs,
          x.parent,
          /** @type {number} */ (idx.get(x.especie)),
          x.gen,
          x.mut,
          x.nacido,
          x.adnLen,
          (x.hijos << 1) | (x.veg ? 1 : 0),
        ],
        i * K,
      );
    });
    return {
      v: VERSION,
      ciclo: this.ciclo,
      maxFotos: this.maxFotos,
      maxBytesFotos: this.maxBytesFotos,
      especies: [...this.especies.values()].map((e) => ({ ...e })),
      nombres,
      individuos: ind,
      vivos: Int32Array.from(this.vivos),
      fotos: [...this.fotos].map(([nombre, fs]) => ({ nombre, fotos: fs.map((f) => ({ ...f })) })),
    };
  }

  /** @param {any} o */
  static deserializar(o) {
    const l = new Linaje({ maxFotos: o?.maxFotos, maxBytesFotos: o?.maxBytesFotos });
    if (!o || typeof o !== 'object') return l;
    l.ciclo = o.ciclo ?? -1;
    for (const e of o.especies ?? []) l.especies.set(e.nombre, { ...e });
    const K = 8;
    const ind = o.individuos ?? [];
    for (let i = 0; i + K <= ind.length; i += K)
      l.individuos.set(ind[i], {
        abs: ind[i],
        parent: ind[i + 1],
        especie: o.nombres?.[ind[i + 2]] ?? '',
        gen: ind[i + 3],
        mut: ind[i + 4],
        nacido: ind[i + 5],
        adnLen: ind[i + 6],
        hijos: ind[i + 7] >> 1,
        veg: (ind[i + 7] & 1) === 1,
      });
    l.vivos = new Set(Array.from(o.vivos ?? []));
    for (const f of o.fotos ?? [])
      l.fotos.set(
        f.nombre,
        f.fotos.map((x) => ({ ...x })),
      );
    return l;
  }
}

// ---- Genes -------------------------------------------------------------------

/**
 * Palabras del ADN en texto (sin comentarios: desde ' hasta el fin de la
 * línea, y la línea entera si recortada empieza con /, como el core;
 * acepta CRLF y descarta los NUL de relleno).
 * @param {string} adn
 */
export function palabrasAdn(adn) {
  const out = [];
  for (const linea of String(adn ?? '')
    .replaceAll('\0', '')
    .split(/\r?\n/)) {
    const q = linea.indexOf("'");
    const codigo = q >= 0 ? linea.slice(0, q) : linea;
    // una línea que, recortada, empieza con / es comentario (loader.hpp)
    if (/^\s*\//.test(codigo)) continue;
    for (const w of codigo.split(/\s+/)) if (w) out.push(w);
  }
  return out;
}

/**
 * Genes del ADN como los cuenta el core (dna.hpp: CountGenes/GeneEnd): cada
 * `cond` empieza un gen; un `start`/`else` empieza uno salvo el primero que
 * sigue a un `cond` (lo absorbe); `stop` se incluye y cierra el gen; `end`
 * termina el ADN. Lo que queda fuera de los genes (definiciones, palabras
 * tras un `stop`) va en `fuera`.
 * @param {string} adn
 * @returns {{genes: string[][], fuera: string[]}}
 */
export function genesAdn(adn) {
  /** @type {string[][]} */
  const genes = [];
  /** @type {string[]} */
  const fuera = [];
  /** @type {string[] | null} */
  let cur = null;
  let condgene = false;
  const cerrar = () => {
    if (cur) genes.push(cur);
    cur = null;
    condgene = false;
  };
  for (const w of palabrasAdn(adn)) {
    const x = w.toLowerCase();
    if (x === 'end') break;
    if (x === 'cond') {
      cerrar();
      cur = [w];
      condgene = true;
    } else if (x === 'start' || x === 'else') {
      if (cur && condgene) {
        cur.push(w);
        condgene = false;
      } else {
        cerrar();
        cur = [w];
      }
    } else if (x === 'stop') {
      if (cur) {
        cur.push(w);
        cerrar();
      } else fuera.push(w);
    } else if (cur) cur.push(w);
    else fuera.push(w);
  }
  cerrar();
  return { genes, fuera };
}

/**
 * @typedef {{tipo: 'igual' | 'cambiado' | 'agregado' | 'quitado', a: number | null,
 *   b: number | null}} CambioGen
 */

/**
 * Compara dos ADN gen por gen (p. ej. el fundador y el dominante de hoy).
 * Empareja los genes idénticos por subsecuencia común más larga; entre dos
 * genes iguales, los distintos se emparejan en orden como «cambiado» y lo
 * que sobra es «agregado» (solo en B) o «quitado» (solo en A). Los índices
 * son de `genesA`/`genesB` (base 0).
 * @param {string} adnA @param {string} adnB
 * @returns {{genesA: string[], genesB: string[], cambios: CambioGen[],
 *   iguales: number, cambiados: number, agregados: number, quitados: number}}
 */
export function diffGenes(adnA, adnB) {
  const ga = genesAdn(adnA).genes.map((g) => g.join(' '));
  const gb = genesAdn(adnB).genes.map((g) => g.join(' '));
  const n = ga.length;
  const m = gb.length;
  // LCS por programación dinámica (los bots tienen decenas de genes)
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = ga[i] === gb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  /** @type {CambioGen[]} */
  const cambios = [];
  /** @type {number[]} */
  let pa = [];
  /** @type {number[]} */
  let pb = [];
  const vaciar = () => {
    const k = Math.min(pa.length, pb.length);
    for (let x = 0; x < k; x++) cambios.push({ tipo: 'cambiado', a: pa[x], b: pb[x] });
    for (let x = k; x < pa.length; x++) cambios.push({ tipo: 'quitado', a: pa[x], b: null });
    for (let x = k; x < pb.length; x++) cambios.push({ tipo: 'agregado', a: null, b: pb[x] });
    pa = [];
    pb = [];
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && ga[i] === gb[j]) {
      vaciar();
      cambios.push({ tipo: 'igual', a: i, b: j });
      i++;
      j++;
    } else if (j >= m || (i < n && L[i + 1][j] >= L[i][j + 1])) pa.push(i++);
    else pb.push(j++);
  }
  vaciar();
  const cuenta = (/** @type {string} */ t) => cambios.filter((c) => c.tipo === t).length;
  return {
    genesA: ga,
    genesB: gb,
    cambios,
    iguales: cuenta('igual'),
    cambiados: cuenta('cambiado'),
    agregados: cuenta('agregado'),
    quitados: cuenta('quitado'),
  };
}
