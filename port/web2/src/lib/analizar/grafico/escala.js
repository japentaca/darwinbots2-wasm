// @ts-check
// Gráficos de Analizar (SVG propio, sin librerías): escalas, ticks, paths,
// bandas y simplificación por píxel. Todo puro (sin DOM ni runes): lo usa
// Grafico.svelte y lo prueban los tests de test/analizar_grafico.test.js.
//
// Rendimiento (N2.3): con la historia llena (2.000 puntos por serie × 20
// especies) no se dibuja cada punto. Una línea se reduce a lo sumo a 4
// vértices por columna de píxel (primero, mínimo, máximo y último de la
// columna: la forma se ve igual) y un área apilada a un valor por columna
// (la media de la columna), así el SVG tiene O(ancho) vértices por serie.

/**
 * Escala lineal [d0, d1] → [r0, r1] (con su inversa). Un dominio vacío
 * (d0 = d1) va al centro del rango.
 * @param {number} d0 @param {number} d1 @param {number} r0 @param {number} r1
 */
export function escalaLineal(d0, d1, r0, r1) {
  const span = d1 - d0;
  /** @param {number} v */
  const f = (v) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
  /** @param {number} p */
  f.inv = (p) => (r1 === r0 ? d0 : d0 + ((p - r0) / (r1 - r0)) * span);
  return f;
}

/**
 * Paso «lindo» (1, 2 o 5 × 10^k) para cubrir `rango` con unos `n` tramos.
 * @param {number} rango @param {number} n
 */
export function pasoLindo(rango, n) {
  if (!(rango > 0) || !(n > 0)) return 1;
  const crudo = rango / n;
  const p = 10 ** Math.floor(Math.log10(crudo));
  const f = crudo / p;
  const m = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return m * p;
}

/**
 * Ticks lindos entre min y max (incluye los extremos redondeados hacia
 * afuera). Devuelve {min, max, paso, ticks}.
 * @param {number} min @param {number} max @param {number} [n] tramos aproximados
 */
export function ticksLindos(min, max, n = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max))
    return { min: 0, max: 1, paso: 1, ticks: [0, 1] };
  if (max < min) [min, max] = [max, min];
  if (max === min) {
    if (max === 0) return { min: 0, max: 1, paso: 1, ticks: [0, 1] };
    const d = Math.abs(max) * 0.5;
    min -= min >= 0 && min - d < 0 ? min : d;
    max += d;
  }
  const paso = pasoLindo(max - min, n);
  const lo = Math.floor(min / paso + 1e-9) * paso;
  const hi = Math.ceil(max / paso - 1e-9) * paso;
  const ticks = [];
  for (let v = lo, i = 0; v <= hi + paso * 1e-6 && i < 100; v = lo + ++i * paso)
    ticks.push(Math.abs(v) < paso * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return { min: lo, max: hi, paso, ticks };
}

/**
 * Ticks del eje de ciclos dentro de [c0, c1] (sin extender el dominio).
 * @param {number} c0 @param {number} c1 @param {number} [n]
 */
export function ticksCiclos(c0, c1, n = 5) {
  if (!(c1 > c0)) return [c0];
  const paso = pasoLindo(c1 - c0, n);
  const out = [];
  for (let v = Math.ceil(c0 / paso) * paso; v <= c1 + 1e-9; v += paso) out.push(v);
  return out;
}

/**
 * Número corto para ejes: 48000 → «48k», 1500000 → «1,5M». `num` formatea
 * con el idioma (separador decimal).
 * @param {number} v @param {(n: number) => string} [num]
 */
export function corto(v, num = String) {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}${num(Math.round(a / 1e8) / 10)}G`;
  if (a >= 1e6) return `${s}${num(Math.round(a / 1e5) / 10)}M`;
  if (a >= 1e4) return `${s}${num(Math.round(a / 1e3))}k`;
  if (a >= 1e3) return `${s}${num(Math.round(a / 100) / 10)}k`;
  if (a >= 10 || a === 0) return `${s}${num(Math.round(a))}`;
  if (a >= 1) return `${s}${num(Math.round(a * 10) / 10)}`;
  return `${s}${num(Number(a.toPrecision(2)))}`;
}

/** @param {number} v */
const f1 = (v) => (Math.round(v * 10) / 10).toString();

/**
 * Reduce una polilínea (coordenadas de píxel, x creciente) a lo sumo a 4
 * vértices por columna de píxel: primero, mínimo, máximo y último. Los
 * puntos no finitos cortan la línea (devuelve varios tramos).
 * @param {ArrayLike<number>} xs @param {ArrayLike<number>} ys
 * @returns {[number, number][][]} tramos
 */
export function simplificarLinea(xs, ys) {
  /** @type {[number, number][][]} */
  const tramos = [];
  /** @type {[number, number][]} */
  let cur = [];
  let col = Number.NaN;
  /** @type {[number, number] | null} */
  let pri = null;
  /** @type {[number, number] | null} */
  let mn = null;
  /** @type {[number, number] | null} */
  let mx = null;
  /** @type {[number, number] | null} */
  let ult = null;
  const volcar = () => {
    if (!pri || !mn || !mx || !ult) return;
    /** @type {[number, number][]} */
    const cand = [pri];
    const medio = mn[0] <= mx[0] ? [mn, mx] : [mx, mn];
    for (const p of medio) if (p !== cand[cand.length - 1]) cand.push(p);
    if (ult !== cand[cand.length - 1]) cand.push(ult);
    for (const p of cand) cur.push(p);
    pri = mn = mx = ult = null;
  };
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      volcar();
      if (cur.length) tramos.push(cur);
      cur = [];
      col = Number.NaN;
      continue;
    }
    const c = Math.floor(x);
    if (c !== col) {
      volcar();
      col = c;
    }
    /** @type {[number, number]} */
    const p = [x, y];
    if (!pri) pri = p;
    if (!mn || y < mn[1]) mn = p;
    if (!mx || y > mx[1]) mx = p;
    ult = p;
  }
  volcar();
  if (cur.length) tramos.push(cur);
  return tramos;
}

/** Radio del círculo que representa un tramo de un solo punto (px). */
export const RADIO_PUNTO = 1.6;

/**
 * Path SVG de un círculo chico centrado en (x, y) (dos arcos; se ve con
 * trazo y sin relleno, como el resto de la línea).
 * @param {number} x @param {number} y @param {number} [r]
 */
export function pathPunto(x, y, r = RADIO_PUNTO) {
  return `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

/**
 * Path SVG de una línea (ya en píxeles), simplificada por píxel. Un tramo
 * de un solo punto (un valor aislado entre ausencias) se dibuja como un
 * círculo chico: un «M» suelto no se ve.
 * @param {ArrayLike<number>} xs @param {ArrayLike<number>} ys
 */
export function pathLinea(xs, ys) {
  return simplificarLinea(xs, ys)
    .map((tr) =>
      tr.length === 1
        ? pathPunto(tr[0][0], tr[0][1])
        : `M${tr.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`,
    )
    .join('');
}

/**
 * Banda mín–máx de los tramos fundidos: polígonos sobre las corridas de
 * puntos con n > 1 (el punto fundido junta varias muestras). Simplificada
 * por píxel (en cada columna, el menor mínimo y el mayor máximo).
 * @param {ArrayLike<number>} xs @param {ArrayLike<number>} yMin @param {ArrayLike<number>} yMax
 * @param {ArrayLike<number>} n
 */
export function pathBanda(xs, yMin, yMax, n) {
  let d = '';
  /** @type {{x: number, lo: number, hi: number}[]} */
  let run = [];
  const cerrar = () => {
    if (run.length >= 2) {
      d += `M${run.map((p) => `${f1(p.x)} ${f1(p.hi)}`).join('L')}`;
      d += `L${run
        .map((p) => `${f1(p.x)} ${f1(p.lo)}`)
        .reverse()
        .join('L')}Z`;
    }
    run = [];
  };
  for (let i = 0; i < xs.length; i++) {
    const ok = n[i] > 1 && Number.isFinite(yMin[i]) && Number.isFinite(yMax[i]);
    if (!ok) {
      cerrar();
      continue;
    }
    const x = xs[i];
    // en píxeles y crece hacia abajo: «lo» (el mínimo) es la y mayor
    const lo = Math.max(yMin[i], yMax[i]);
    const hi = Math.min(yMin[i], yMax[i]);
    const u = run[run.length - 1];
    if (u && Math.floor(u.x) === Math.floor(x)) {
      u.lo = Math.max(u.lo, lo);
      u.hi = Math.min(u.hi, hi);
    } else run.push({ x, lo, hi });
  }
  cerrar();
  return d;
}

/**
 * Reduce capas alineadas (mismo eje de x en píxeles) a una columna por
 * píxel: x = la del primer punto de la columna, valor = la media de la
 * columna. NaN cuenta como 0 (especie ausente).
 * @param {ArrayLike<number>} xs @param {ArrayLike<number>[]} capas
 * @returns {{xs: number[], capas: number[][]}}
 */
export function reducirColumnas(xs, capas) {
  /** @type {number[]} */
  const ox = [];
  const oc = capas.map(() => /** @type {number[]} */ ([]));
  let col = Number.NaN;
  let k = 0;
  const suma = new Float64Array(capas.length);
  const volcar = () => {
    if (!k) return;
    for (let c = 0; c < capas.length; c++) oc[c].push(suma[c] / k);
    suma.fill(0);
    k = 0;
  };
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (!Number.isFinite(x)) continue;
    const c = Math.floor(x);
    if (c !== col) {
      volcar();
      col = c;
      ox.push(x);
    }
    for (let j = 0; j < capas.length; j++) {
      const v = capas[j][i];
      suma[j] += Number.isFinite(v) ? v : 0;
    }
    k++;
  }
  volcar();
  return { xs: ox, capas: oc };
}

/**
 * Áreas apiladas: capas ya reducidas (valores, no píxeles) → paths. `Y`
 * pasa de valor a píxel. Devuelve un path por capa. Con una sola columna
 * (una sola muestra en el dominio) se dibuja una franja de 3 px centrada en
 * ella: un área de ancho 0 no se ve.
 * @param {number[]} xs @param {number[][]} capas @param {(v: number) => number} Y
 */
export function pathsApilados(xs, capas, Y) {
  if (xs.length === 1) {
    xs = [xs[0] - 1.5, xs[0] + 1.5];
    capas = capas.map((cp) => [cp[0], cp[0]]);
  }
  let abajo = xs.map(() => 0);
  return capas.map((cp) => {
    const arriba = abajo.map((a, i) => a + Math.max(0, cp[i] || 0));
    const ida = arriba.map((v, i) => `${f1(xs[i])} ${f1(Y(v))}`).join('L');
    const vuelta = abajo
      .map((v, i) => `${f1(xs[i])} ${f1(Y(v))}`)
      .reverse()
      .join('L');
    abajo = arriba;
    return xs.length ? `M${ida}L${vuelta}Z` : '';
  });
}

/** Suma por columna de capas (el tope de un apilado). @param {ArrayLike<number>[]} capas @param {number} len */
export function sumaCapas(capas, len) {
  const out = new Array(len).fill(0);
  for (const cp of capas)
    for (let i = 0; i < len; i++) {
      const v = cp[i];
      if (Number.isFinite(v) && v > 0) out[i] += v;
    }
  return out;
}

/**
 * Índice del punto de `t` (creciente) más cercano a `c` (−1 si está vacío).
 * @param {ArrayLike<number>} t @param {number} c
 */
export function indiceCercano(t, c) {
  const n = t.length;
  if (!n) return -1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (t[m] < c) lo = m + 1;
    else hi = m;
  }
  if (lo > 0 && Math.abs(t[lo - 1] - c) <= Math.abs(t[lo] - c)) return lo - 1;
  return lo;
}

/**
 * Primer índice con t > c (n si ninguno).
 * @param {ArrayLike<number>} t @param {number} c
 */
export function primeroDespues(t, c) {
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (t[m] <= c) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/**
 * Ticks del eje Y de un gráfico de líneas. Desde 0 si `cero` (conteos) o si
 * hay negativos/el rango es amplio; si todos los valores son positivos y el
 * rango es chico (hi − lo ≤ la mitad de hi), el eje se ajusta a los datos
 * con un margen del 10 % y ticks lindos (sin bajar de 0).
 * @param {number} lo @param {number} hi @param {boolean} cero @param {number} [n]
 */
export function ticksEjeY(lo, hi, cero, n = 4) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return ticksLindos(0, 1, n);
  if (lo < 0) return ticksLindos(lo, hi, n);
  if (cero || hi - lo > hi * 0.5) return ticksLindos(0, hi, n);
  const pad = Math.max((hi - lo) * 0.1, Math.abs(hi) * 0.01, 1e-9);
  return ticksLindos(Math.max(0, lo - pad), hi + pad, n);
}

/**
 * Primer índice con t ≥ c (n si ninguno).
 * @param {ArrayLike<number>} t @param {number} c
 */
export function primeroDesde(t, c) {
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (t[m] < c) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/** Cuenta los vértices de un path (M/L; para medir la simplificación). @param {string} d */
export function vertices(d) {
  return (d.match(/[ML]/g) ?? []).length;
}
