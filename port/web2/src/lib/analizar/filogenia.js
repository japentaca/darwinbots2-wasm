// @ts-check
// Pestaña Filogenia de Analizar (puro): el árbol de especies (decisión 9)
// en carriles colapsables y los individuos podados de una especie.
//
// Sin autoespeciación (C7) el árbol suele ser plano: todas las especies son
// raíces (sembradas, llegadas por teleporter). Se dibuja igual: un carril
// por especie con su vida (aparición → extinción) y, si hay madres, el
// enlace desde el carril de la madre.

/**
 * @typedef {object} FilaArbol
 * @property {string} nombre
 * @property {number} nivel
 * @property {string | null} madre
 * @property {number} hijas        especies hijas (directas)
 * @property {boolean} colapsada
 * @property {number} desde        ciclo de aparición
 * @property {number | null} hasta último ciclo con bots si se extinguió (null = viva)
 */

/**
 * Filas del árbol de especies en orden de recorrido (madre antes que sus
 * hijas), salteando las hijas de las colapsadas. Las especies que solo
 * están en la historia (sin registro en el linaje) van como raíces.
 * @param {import('../../../engine/lineage.js').Linaje | null} lin
 * @param {import('./especies.js').FilaEspecie[]} filas  de filasEspecies (vida de cada una)
 * @param {Set<string>} colapsadas
 * @returns {FilaArbol[]}
 */
export function filasArbol(lin, filas, colapsadas) {
  const vida = new Map(filas.map((f) => [f.nombre, f]));
  /** @type {{nombre: string, ciclo: number, madre: string | null, hijas: any[]}[]} */
  const raices = lin ? /** @type {any} */ (lin.arbolEspecies()) : [];
  const vistos = new Set();
  const marcar = (/** @type {any[]} */ ns) => {
    for (const n of ns) {
      vistos.add(n.nombre);
      marcar(n.hijas);
    }
  };
  marcar(raices);
  for (const f of filas)
    if (!vistos.has(f.nombre))
      raices.push({ nombre: f.nombre, ciclo: f.aparicion ?? 0, madre: null, hijas: [] });
  raices.sort((a, b) => a.ciclo - b.ciclo || a.nombre.localeCompare(b.nombre));
  /** @type {FilaArbol[]} */
  const out = [];
  /** @param {any} n @param {number} nivel */
  const rec = (n, nivel) => {
    const f = vida.get(n.nombre);
    const col = colapsadas.has(n.nombre);
    out.push({
      nombre: n.nombre,
      nivel,
      madre: n.madre ?? null,
      hijas: n.hijas.length,
      colapsada: col && n.hijas.length > 0,
      desde: f?.aparicion ?? n.ciclo ?? 0,
      hasta: f ? f.extincion : null,
    });
    if (!col) for (const h of n.hijas) rec(h, nivel + 1);
  };
  for (const r of raices) rec(r, 0);
  return out;
}

/**
 * @typedef {object} NodoIndividuo
 * @property {number} abs
 * @property {number} parent  0 o fuera del dibujo = raíz
 * @property {number} gen
 * @property {number} nacido
 * @property {number} mut
 * @property {number} adnLen
 * @property {number} hijos
 * @property {boolean} vivo
 * @property {boolean} cortado su madre (de la misma especie) existe pero quedó fuera
 *                            del dibujo por el tope: se dibuja «…» a su izquierda
 * @property {number} y       fila (hojas consecutivas; un nodo interno, la media de sus hijos)
 */

/**
 * Individuos podados de una especie como árbol: x = generación, y = orden
 * de las hojas. Con más de `max` individuos se dibujan los vivos de
 * generación más alta con sus ancestros hasta llegar a `max` (nunca más):
 * una cadena que no entra entera se recorta desde la raíz (se conservan los
 * más cercanos al vivo) y su primer nodo queda `cortado`.
 * @param {import('../../../engine/lineage.js').Linaje} lin @param {string} especie
 * @param {number} [max]
 */
export function arbolIndividuos(lin, especie, max = 400) {
  const propios = [...lin.individuos.values()].filter((x) => x.especie === especie);
  const total = propios.length;
  /** @type {Set<number>} */
  let elegidos;
  if (total <= max) elegidos = new Set(propios.map((x) => x.abs));
  else {
    elegidos = new Set();
    const vivos = propios
      .filter((x) => lin.vivos.has(x.abs))
      .sort((a, b) => b.gen - a.gen || a.abs - b.abs);
    for (const v of vivos) {
      if (elegidos.size >= max) break;
      for (const a of lin.ancestros(v.abs)) {
        if (elegidos.size >= max || a.especie !== especie || elegidos.has(a.abs)) break;
        elegidos.add(a.abs);
      }
    }
  }
  const por = new Map(propios.filter((x) => elegidos.has(x.abs)).map((x) => [x.abs, x]));
  const deLaEspecie = new Set(propios.map((x) => x.abs));
  /** @type {Map<number, number[]>} */
  const hijos = new Map();
  /** @type {number[]} */
  const raices = [];
  for (const x of por.values()) {
    if (x.parent && por.has(x.parent)) {
      const l = hijos.get(x.parent) ?? [];
      l.push(x.abs);
      hijos.set(x.parent, l);
    } else raices.push(x.abs);
  }
  const orden = (/** @type {number[]} */ l) =>
    l.sort((a, b) => (por.get(a)?.nacido ?? 0) - (por.get(b)?.nacido ?? 0) || a - b);
  orden(raices);
  for (const l of hijos.values()) orden(l);
  /** @type {NodoIndividuo[]} */
  const nodos = [];
  let fila = 0;
  // recorrido iterativo (las cadenas pueden ser largas)
  /** @type {Map<number, number>} */
  const yDe = new Map();
  for (const r of raices) {
    /** @type {{abs: number, i: number}[]} */
    const pila = [{ abs: r, i: 0 }];
    while (pila.length) {
      const top = pila[pila.length - 1];
      const hs = hijos.get(top.abs) ?? [];
      if (top.i < hs.length) {
        pila.push({ abs: hs[top.i++], i: 0 });
        continue;
      }
      pila.pop();
      const y = hs.length ? hs.reduce((s, h) => s + (yDe.get(h) ?? 0), 0) / hs.length : fila++;
      yDe.set(top.abs, y);
      const x = /** @type {import('../../../engine/lineage.js').Individuo} */ (por.get(top.abs));
      nodos.push({
        abs: x.abs,
        parent: x.parent && por.has(x.parent) ? x.parent : 0,
        gen: x.gen,
        nacido: x.nacido,
        mut: x.mut,
        adnLen: x.adnLen,
        hijos: x.hijos,
        vivo: lin.vivos.has(x.abs),
        cortado: !!x.parent && !por.has(x.parent) && deLaEspecie.has(x.parent),
        y,
      });
    }
  }
  let genMin = Number.POSITIVE_INFINITY;
  let genMax = Number.NEGATIVE_INFINITY;
  for (const x of nodos) {
    genMin = Math.min(genMin, x.gen);
    genMax = Math.max(genMax, x.gen);
  }
  return {
    nodos,
    total,
    mostrados: nodos.length,
    filas: fila,
    genMin: Number.isFinite(genMin) ? genMin : 0,
    genMax: Number.isFinite(genMax) ? genMax : 0,
  };
}

/**
 * Path de los enlaces madre → hija (codo: vertical en la x de la madre y
 * horizontal hasta la hija), en píxeles.
 * @param {NodoIndividuo[]} nodos @param {(g: number) => number} X @param {(y: number) => number} Y
 */
export function enlacesIndividuos(nodos, X, Y) {
  const por = new Map(nodos.map((n) => [n.abs, n]));
  let d = '';
  for (const n of nodos) {
    const p = n.parent ? por.get(n.parent) : undefined;
    if (!p) continue;
    const px = X(p.gen).toFixed(1);
    d += `M${px} ${Y(p.y).toFixed(1)}V${Y(n.y).toFixed(1)}H${X(n.gen).toFixed(1)}`;
  }
  return d;
}

/**
 * Navegación por teclado del árbol de individuos (un solo punto de
 * tabulación; las flechas mueven el foco): ← la madre, → el primer hijo
 * dibujado, ↑/↓ el nodo anterior/siguiente en vertical (a igual fila, por
 * generación), Inicio/Fin el primero/último. null si la tecla no aplica o
 * no hay adónde ir.
 * @param {NodoIndividuo[]} nodos @param {number} abs @param {string} tecla
 * @returns {number | null}
 */
export function vecinoIndividuo(nodos, abs, tecla) {
  const actual = nodos.find((n) => n.abs === abs);
  if (!actual || !nodos.length) return null;
  const orden = [...nodos].sort((a, b) => a.y - b.y || a.gen - b.gen || a.abs - b.abs);
  const i = orden.indexOf(actual);
  switch (tecla) {
    case 'ArrowLeft':
      return actual.parent || null;
    case 'ArrowRight': {
      const hijos = nodos.filter((n) => n.parent === abs).sort((a, b) => a.y - b.y);
      return hijos[0]?.abs ?? null;
    }
    case 'ArrowUp':
      return i > 0 ? orden[i - 1].abs : null;
    case 'ArrowDown':
      return i < orden.length - 1 ? orden[i + 1].abs : null;
    case 'Home':
      return orden[0].abs;
    case 'End':
      return orden[orden.length - 1].abs;
    default:
      return null;
  }
}
