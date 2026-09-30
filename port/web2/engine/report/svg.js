// @ts-check
// Gráficos del informe como SVG inline (decisión 11 de port/web2/PLAN.md),
// puros y sin DOM: cada función recibe los datos y devuelve el texto del
// <svg>. Formas: líneas (con banda mín–máx opcional), áreas apiladas,
// histograma y carriles (genealogía).
//
// Tamaño: el <svg> lleva width/height y un viewBox iguales al tamaño
// pedido; todo lo que se dibuja cae dentro de ese rectángulo. Las series de
// más puntos que píxeles del área de dibujo se reducen promediando por
// columna (reducir()), así el archivo no crece con la historia.
//
// Estilo (boceto del informe): grilla y ejes recesivos, líneas de 2 px,
// 2 px de separación blanca entre áreas apiladas, marcas verticales
// punteadas con su rótulo. Los textos (ejes, rótulos) llegan ya escritos y
// se escapan acá; los colores los decide quien llama.

/** Escape para texto y atributos (XSS: nombres de bots con <, &, comillas). @param {unknown} s */
export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const TINTA = Object.freeze({
  grilla: '#e1e0d9',
  base: '#c3c2b7',
  eje: '#6b6962',
  marca: '#151513',
  fondo: '#ffffff',
});

const MARGEN = Object.freeze({ izq: 44, der: 8, arr: 8, aba: 20 });

/** @param {number} x */
const f1 = (x) => (Math.round(x * 10) / 10).toString();

/**
 * @typedef {{ancho: number, alto: number, etiqueta: string,
 *   fmtX?: (x: number) => string, fmtY?: (y: number) => string}} Marco
 * @typedef {{x: number, etiqueta?: string}} Marca
 */

/**
 * Paso «lindo» para ticks (1, 2, 2,5 o 5 × 10^k).
 * @param {number} rango @param {number} n
 */
export function pasoLindo(rango, n) {
  if (!(rango > 0)) return 1;
  const bruto = rango / Math.max(1, n);
  const p = 10 ** Math.floor(Math.log10(bruto));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= bruto) return m * p;
  return 10 * p;
}

/**
 * Promedia columnas cuando hay más puntos que `max` (NaN = hueco: una
 * columna sin valores queda en NaN). Devuelve índices representativos
 * (el primero de cada columna) y los valores promediados.
 * @param {number[]} x @param {number[][]} ys @param {number} max
 * @returns {{x: number[], ys: number[][]}}
 */
export function reducir(x, ys, max) {
  const n = x.length;
  if (n <= max || max < 2) return { x: [...x], ys: ys.map((y) => [...y]) };
  /** @type {number[]} */
  const xo = [];
  const yo = ys.map(() => /** @type {number[]} */ ([]));
  for (let b = 0; b < max; b++) {
    const i0 = Math.floor((b * n) / max);
    const i1 = Math.max(i0 + 1, Math.floor(((b + 1) * n) / max));
    xo.push(x[i0]);
    ys.forEach((y, k) => {
      let s = 0;
      let c = 0;
      for (let i = i0; i < i1; i++)
        if (Number.isFinite(y[i])) {
          s += y[i];
          c++;
        }
      yo[k].push(c ? s / c : Number.NaN);
    });
  }
  return { x: xo, ys: yo };
}

/**
 * Escalas y armazón común (grilla, ejes, ticks) de un gráfico cartesiano.
 * @param {Marco} m @param {number} x0 @param {number} x1 @param {number} y0 @param {number} y1
 */
function armazon(m, x0, x1, y0, y1) {
  const L = MARGEN.izq;
  const R = m.ancho - MARGEN.der;
  const T = MARGEN.arr;
  const B = m.alto - MARGEN.aba;
  const pasoY = pasoLindo(y1 - y0, 4);
  const yMax = Math.max(y0 + pasoY, Math.ceil(y1 / pasoY) * pasoY);
  const yMin = y0;
  const dx = x1 > x0 ? x1 - x0 : 1;
  /** @param {number} x */
  const X = (x) => L + ((Math.min(Math.max(x, x0), x1 > x0 ? x1 : x0) - x0) / dx) * (R - L);
  /** @param {number} y */
  const Y = (y) => B - ((Math.min(Math.max(y, yMin), yMax) - yMin) / (yMax - yMin)) * (B - T);
  const fx = m.fmtX ?? ((/** @type {number} */ x) => String(Math.round(x)));
  const fy = m.fmtY ?? ((/** @type {number} */ y) => String(Math.round(y)));
  const partes = [];
  let grilla = '';
  for (let y = yMin + pasoY; y <= yMax + 1e-9; y += pasoY) grilla += `M${L} ${f1(Y(y))}H${R}`;
  if (grilla)
    partes.push(`<path d="${grilla}" stroke="${TINTA.grilla}" stroke-width="1" fill="none"/>`);
  partes.push(`<path d="M${L} ${B}H${R}" stroke="${TINTA.base}" stroke-width="1" fill="none"/>`);
  const ticks = [];
  for (let y = yMin; y <= yMax + 1e-9; y += pasoY)
    ticks.push(`<text x="${L - 6}" y="${f1(Y(y) + 3.5)}" text-anchor="end">${esc(fy(y))}</text>`);
  if (x1 > x0) {
    const pasoX = pasoLindo(x1 - x0, Math.max(2, Math.floor((R - L) / 90)));
    for (let x = Math.ceil(x0 / pasoX) * pasoX; x <= x1 + 1e-9; x += pasoX) {
      const px = X(x);
      const anchor = px < L + 12 ? 'start' : px > R - 12 ? 'end' : 'middle';
      ticks.push(
        `<text x="${f1(px)}" y="${m.alto - 6}" text-anchor="${anchor}">${esc(fx(x))}</text>`,
      );
    }
  }
  partes.push(`<g class="tick" fill="${TINTA.eje}" font-size="10">${ticks.join('')}</g>`);
  return { X, Y, L, R, T, B, partes };
}

/**
 * Marcas verticales punteadas con rótulo.
 * @param {Marca[]} marcas @param {(x: number) => number} X @param {number} T @param {number} B
 * @param {number} R
 */
function dibujarMarcas(marcas, X, T, B, R) {
  const out = [];
  marcas.forEach((mk, i) => {
    const px = X(mk.x);
    out.push(
      `<path d="M${f1(px)} ${T}V${B}" stroke="${TINTA.marca}" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>`,
    );
    if (mk.etiqueta) {
      const der = px > R - 120;
      out.push(
        `<text x="${f1(der ? px - 4 : px + 4)}" y="${T + 10 + (i % 3) * 13}" font-size="10" text-anchor="${der ? 'end' : 'start'}" fill="${TINTA.marca}" class="rotulo">${esc(recortar(mk.etiqueta, 180))}</text>`,
      );
    }
  });
  return out.join('');
}

/** @param {Marco} m @param {string} cuerpo */
function envolver(m, cuerpo) {
  return (
    `<svg width="${m.ancho}" height="${m.alto}" viewBox="0 0 ${m.ancho} ${m.alto}" role="img" aria-label="${esc(m.etiqueta)}" font-family="inherit">` +
    `<title>${esc(m.etiqueta)}</title>${cuerpo}</svg>`
  );
}

/**
 * Tramos de una polilínea (NaN corta la línea).
 * @param {number[]} x @param {number[]} y @param {(x: number) => number} X
 * @param {(y: number) => number} Y
 */
function trazo(x, y, X, Y) {
  let d = '';
  let abierto = false;
  for (let i = 0; i < x.length; i++) {
    if (!Number.isFinite(y[i])) {
      abierto = false;
      continue;
    }
    d += `${abierto ? 'L' : 'M'}${f1(X(x[i]))} ${f1(Y(y[i]))}`;
    abierto = true;
  }
  return d;
}

/**
 * @typedef {{valores: number[], min?: number[], max?: number[], color: string,
 *   discontinua?: boolean, x?: number[]}} SerieLinea
 *   `x`: ciclos propios de la serie (por defecto, los del gráfico); así se
 *   superponen corridas con muestras en ciclos distintos.
 */

/**
 * Gráfico de líneas (un solo eje Y). Con `min`/`max` dibuja además la banda
 * entre ambos (puntos fundidos de la historia) si alguna vez difieren de la
 * media.
 * @param {Marco & {x: number[], series: SerieLinea[], marcas?: Marca[], yCero?: boolean}} o
 */
export function lineas(o) {
  const x = o.x;
  const ancho = o.ancho - MARGEN.izq - MARGEN.der;
  const todas = o.series.flatMap((s) => [s.valores, s.min ?? [], s.max ?? []]);
  const vals = todas.flat().filter(Number.isFinite);
  const yMin = o.yCero === false && vals.length ? Math.min(...vals) : 0;
  const yMax = vals.length ? Math.max(...vals) : 1;
  const xs = [x, ...o.series.map((s) => s.x ?? [])].filter((v) => v.length);
  const x0 = xs.length ? Math.min(...xs.map((v) => v[0])) : 0;
  const x1 = xs.length ? Math.max(...xs.map((v) => v[v.length - 1])) : 1;
  const a = armazon(o, x0, x1, yMin > 0 ? pasoAbajo(yMin, yMax) : Math.min(0, yMin), yMax);
  const partes = [...a.partes];
  for (const s of o.series) {
    const sx = s.x ?? x;
    const conBanda =
      s.min && s.max && s.min.some((v, i) => Number.isFinite(v) && v !== s.valores[i]);
    const r = reducir(
      sx,
      conBanda
        ? [s.valores, /** @type {number[]} */ (s.min), /** @type {number[]} */ (s.max)]
        : [s.valores],
      ancho,
    );
    if (conBanda) {
      const [, lo, hi] = r.ys;
      let d = '';
      let tramo = /** @type {number[]} */ ([]);
      const cerrar = () => {
        if (tramo.length) {
          d += `M${tramo.map((i) => `${f1(a.X(r.x[i]))} ${f1(a.Y(hi[i]))}`).join('L')}L${tramo
            .map((i) => `${f1(a.X(r.x[i]))} ${f1(a.Y(lo[i]))}`)
            .reverse()
            .join('L')}Z`;
        }
        tramo = [];
      };
      for (let i = 0; i < r.x.length; i++) {
        if (Number.isFinite(lo[i]) && Number.isFinite(hi[i])) tramo.push(i);
        else cerrar();
      }
      cerrar();
      if (d) partes.push(`<path d="${d}" fill="${s.color}" fill-opacity="0.18" stroke="none"/>`);
    }
    const d = trazo(r.x, r.ys[0], a.X, a.Y);
    if (d)
      partes.push(
        `<path d="${d}" stroke="${s.color}" stroke-width="2" fill="none" stroke-linejoin="round"${s.discontinua ? ' stroke-dasharray="5 4"' : ''}/>`,
      );
  }
  partes.push(dibujarMarcas(o.marcas ?? [], a.X, a.T, a.B, a.R));
  return envolver(o, partes.join(''));
}

/** Un piso redondo por debajo del mínimo (ejes que no arrancan en 0). @param {number} y0 @param {number} y1 */
function pasoAbajo(y0, y1) {
  const p = pasoLindo(y1 - y0 || y1, 4);
  return Math.max(0, Math.floor(y0 / p) * p);
}

/**
 * Áreas apiladas (NaN cuenta 0), con 2 px de separación entre capas.
 * @param {Marco & {x: number[], capas: {valores: number[], color: string}[], marcas?: Marca[]}} o
 */
export function areasApiladas(o) {
  const ancho = o.ancho - MARGEN.izq - MARGEN.der;
  const r = reducir(
    o.x,
    o.capas.map((c) => c.valores.map((v) => (Number.isFinite(v) ? v : 0))),
    ancho,
  );
  const n = r.x.length;
  let prev = new Array(n).fill(0);
  const bandas = r.ys.map((y) => {
    const arriba = prev.map((p, i) => p + Math.max(0, y[i] || 0));
    const b = [prev, arriba];
    prev = arriba;
    return b;
  });
  const yMax = n ? Math.max(1, ...prev) : 1;
  const x0 = n ? r.x[0] : 0;
  const x1 = n ? r.x[n - 1] : 1;
  const a = armazon(o, x0, x1, 0, yMax);
  const partes = [...a.partes];
  if (n >= 1)
    bandas.forEach(([lo, hi], k) => {
      if (hi.every((v, i) => v === lo[i])) return;
      const pt = (/** @type {number} */ v, /** @type {number} */ i) =>
        `${f1(a.X(r.x[i]))} ${f1(a.Y(v))}`;
      const d = `M${hi.map(pt).join('L')}L${lo.map(pt).reverse().join('L')}Z`;
      partes.push(
        `<path d="${d}" fill="${o.capas[k].color}" stroke="${TINTA.fondo}" stroke-width="1" stroke-linejoin="round"/>`,
      );
    });
  partes.push(dibujarMarcas(o.marcas ?? [], a.X, a.T, a.B, a.R));
  return envolver(o, partes.join(''));
}

/**
 * Histograma: `cuentas` en columnas iguales entre `min` y `max`.
 * @param {Marco & {min: number, max: number, cuentas: number[], color: string}} o
 */
export function histograma(o) {
  const k = o.cuentas.length;
  const tope = Math.max(1, ...o.cuentas.filter(Number.isFinite));
  const x1 = o.max > o.min ? o.max : o.min + 1;
  const a = armazon(o, o.min, x1, 0, tope);
  const partes = [...a.partes];
  const w = (a.R - a.L) / Math.max(1, k);
  const hueco = w > 4 ? 1 : 0;
  let d = '';
  o.cuentas.forEach((c, i) => {
    if (!(c > 0)) return;
    const xa = a.L + i * w + hueco;
    const ancho = Math.max(0.5, w - 2 * hueco);
    const ya = a.Y(c);
    d += `M${f1(xa)} ${f1(a.B)}V${f1(ya)}H${f1(xa + ancho)}V${f1(a.B)}Z`;
  });
  if (d) partes.push(`<path d="${d}" fill="${o.color}" stroke="none"/>`);
  return envolver(o, partes.join(''));
}

/**
 * Carriles de genealogía: una fila por especie con su barra de vida (del
 * ciclo en que apareció al último en que tuvo bots), el enlace con la madre
 * y una × si se extinguió.
 * @param {Marco & {x0: number, x1: number, filas: {nombre: string, color: string,
 *   desde: number, hasta: number, madre: number | null, extinta: boolean}[]}} o
 *   `madre`: índice de la fila madre (null = raíz)
 */
export function carriles(o) {
  const izqNombres = Math.min(200, Math.round(o.ancho * 0.3));
  const L = izqNombres + 8;
  const R = o.ancho - 12;
  const FILA = 20;
  const B = o.alto - MARGEN.aba;
  const dx = o.x1 > o.x0 ? o.x1 - o.x0 : 1;
  /** @param {number} x */
  const X = (x) => L + ((Math.min(Math.max(x, o.x0), o.x0 + dx) - o.x0) / dx) * (R - L);
  /** @param {number} i */
  const Y = (i) => i * FILA + FILA / 2 + 2;
  const fx = o.fmtX ?? ((/** @type {number} */ x) => String(Math.round(x)));
  const partes = [];
  const pasoX = pasoLindo(dx, Math.max(2, Math.floor((R - L) / 90)));
  let grilla = '';
  const ticks = [];
  for (let x = Math.ceil(o.x0 / pasoX) * pasoX; x <= o.x1 + 1e-9; x += pasoX) {
    grilla += `M${f1(X(x))} 0V${B}`;
    const px = X(x);
    const anchor = px > R - 12 ? 'end' : px < L + 12 ? 'start' : 'middle';
    ticks.push(
      `<text x="${f1(px)}" y="${o.alto - 6}" text-anchor="${anchor}">${esc(fx(x))}</text>`,
    );
  }
  if (grilla)
    partes.push(`<path d="${grilla}" stroke="${TINTA.grilla}" stroke-width="1" fill="none"/>`);
  partes.push(`<g class="tick" fill="${TINTA.eje}" font-size="10">${ticks.join('')}</g>`);
  let enlaces = '';
  let cruces = '';
  const nombres = [];
  const visibles = Math.max(0, Math.floor(B / FILA));
  o.filas.slice(0, visibles).forEach((f, i) => {
    const y = Y(i);
    nombres.push(
      `<text x="16" y="${f1(y + 4)}" font-size="11"${f.extinta ? ` fill="${TINTA.eje}"` : ''}>${esc(recortar(f.nombre, izqNombres))}</text>` +
        `<rect x="2" y="${f1(y - 5)}" width="10" height="10" rx="3" fill="${f.color}"/>`,
    );
    if (f.madre !== null && f.madre < i) enlaces += `M${f1(X(f.desde))} ${f1(Y(f.madre))}V${f1(y)}`;
    const xa = X(f.desde);
    const xb = Math.max(xa + 1, X(f.hasta));
    partes.push(
      `<path d="M${f1(xa)} ${f1(y)}H${f1(xb)}" stroke="${f.color}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
    );
    if (f.extinta) {
      const cx = Math.min(R - 4, xb + 8);
      cruces += `M${f1(cx - 4)} ${f1(y - 4)}L${f1(cx + 4)} ${f1(y + 4)}M${f1(cx + 4)} ${f1(y - 4)}L${f1(cx - 4)} ${f1(y + 4)}`;
    }
  });
  if (enlaces)
    partes.push(`<path d="${enlaces}" stroke="#898781" stroke-width="1.5" fill="none"/>`);
  if (cruces)
    partes.push(`<path d="${cruces}" stroke="${TINTA.marca}" stroke-width="2" fill="none"/>`);
  partes.push(nombres.join(''));
  return envolver(o, partes.join(''));
}

/** Recorta un nombre a lo que entra (aprox. 6,2 px por carácter a 11 px). @param {string} s @param {number} px */
function recortar(s, px) {
  const max = Math.max(4, Math.floor(px / 6.2));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
