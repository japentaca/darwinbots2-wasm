// @ts-check
// PNG de un gráfico de Analizar (decisión 11: export PNG): el <svg> que
// dibuja Grafico.svelte se clona con sus estilos calculados escritos en
// cada elemento (las clases y variables CSS de la página no viajan con el
// SVG suelto), se serializa, se dibuja en un canvas con fondo blanco, el
// título arriba y la leyenda abajo, y sale como Blob PNG. Necesita el DOM
// (solo en el navegador); lo puro (medidas del lienzo y partir la leyenda
// en filas) se exporta aparte y se prueba en node.

/** Propiedades que se copian de los estilos calculados. */
const PROPIEDADES = Object.freeze([
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'visibility',
]);

const NS_SVG = 'http://www.w3.org/2000/svg';
const MARGEN = 16;
const ALTO_TITULO = 28;
const ALTO_FILA_LEYENDA = 20;
const FUENTE = "13px 'IBM Plex Sans', system-ui, sans-serif";

/**
 * Filas de la leyenda: reparte los elementos en filas de a lo sumo `ancho`
 * px (cada uno mide `medir(nombre) + 26` px: muestra de color y separación).
 * @param {{nombre: string, color: string}[]} items @param {number} ancho
 * @param {(s: string) => number} medir
 * @returns {{nombre: string, color: string, x: number}[][]}
 */
export function filasLeyenda(items, ancho, medir) {
  /** @type {{nombre: string, color: string, x: number}[][]} */
  const filas = [];
  let fila = /** @type {{nombre: string, color: string, x: number}[]} */ ([]);
  let x = 0;
  for (const it of items) {
    const w = medir(it.nombre) + 26;
    if (fila.length && x + w > ancho) {
      filas.push(fila);
      fila = [];
      x = 0;
    }
    fila.push({ ...it, x });
    x += w;
  }
  if (fila.length) filas.push(fila);
  return filas;
}

/**
 * Medidas del lienzo (sin escalar): márgenes, título arriba y las filas de
 * la leyenda abajo.
 * @param {number} ancho @param {number} alto @param {number} filas
 */
export function medidasLienzo(ancho, alto, filas) {
  return {
    ancho: Math.ceil(ancho + 2 * MARGEN),
    alto: Math.ceil(
      MARGEN + ALTO_TITULO + alto + (filas ? 8 + filas * ALTO_FILA_LEYENDA : 0) + MARGEN,
    ),
    xSvg: MARGEN,
    ySvg: MARGEN + ALTO_TITULO,
  };
}

/**
 * Copia en línea los estilos calculados de `orig` (y sus descendientes) al
 * clon, y quita los elementos transitorios (el cursor del tooltip).
 * @param {SVGSVGElement} orig @param {SVGSVGElement} clon
 */
function estilosEnLinea(orig, clon) {
  const a = [orig, ...orig.querySelectorAll('*')];
  const b = [clon, ...clon.querySelectorAll('*')];
  a.forEach((el, i) => {
    const c = /** @type {Element} */ (b[i]);
    const cs = getComputedStyle(el);
    const partes = [];
    for (const p of PROPIEDADES) {
      const v = cs.getPropertyValue(p);
      if (v) partes.push(`${p}:${v}`);
    }
    c.setAttribute('style', partes.join(';'));
    c.removeAttribute('class');
  });
  for (const el of clon.querySelectorAll('[data-png="no"]')) el.remove();
}

/**
 * PNG de un <svg> con título y leyenda.
 * @param {SVGSVGElement} svg
 * @param {{titulo: string, leyenda?: {nombre: string, color: string}[], escala?: number}} o
 * @returns {Promise<Blob>}
 */
export async function svgAPng(svg, o) {
  const escala = o.escala ?? 2;
  const caja = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(caja.width));
  const h = Math.max(1, Math.round(caja.height));
  // el cursor del tooltip (si el puntero estaba encima) no va en la imagen
  for (const el of svg.querySelectorAll('path')) {
    if (el.classList.contains('cursor')) el.setAttribute('data-png', 'no');
  }
  const clon = /** @type {SVGSVGElement} */ (svg.cloneNode(true));
  estilosEnLinea(svg, clon);
  for (const el of svg.querySelectorAll('[data-png]')) el.removeAttribute('data-png');
  clon.setAttribute('xmlns', NS_SVG);
  clon.setAttribute('width', String(w));
  clon.setAttribute('height', String(h));
  const texto = new XMLSerializer().serializeToString(clon);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`;
  await img.decode();

  const lienzo = document.createElement('canvas');
  const ctx = /** @type {CanvasRenderingContext2D} */ (lienzo.getContext('2d'));
  ctx.font = FUENTE;
  const filas = filasLeyenda(o.leyenda ?? [], w, (s) => ctx.measureText(s).width);
  const m = medidasLienzo(w, h, filas.length);
  lienzo.width = m.ancho * escala;
  lienzo.height = m.alto * escala;
  ctx.scale(escala, escala);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, m.ancho, m.alto);
  ctx.fillStyle = '#151513';
  ctx.font = `600 15px 'IBM Plex Sans', system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(o.titulo, m.xSvg, MARGEN + ALTO_TITULO / 2 - 4, w);
  ctx.drawImage(img, m.xSvg, m.ySvg, w, h);
  ctx.font = FUENTE;
  filas.forEach((fila, k) => {
    const y = m.ySvg + h + 8 + k * ALTO_FILA_LEYENDA + ALTO_FILA_LEYENDA / 2;
    for (const it of fila) {
      ctx.fillStyle = it.color;
      ctx.fillRect(m.xSvg + it.x, y - 5, 10, 10);
      ctx.fillStyle = '#3d3c38';
      ctx.fillText(it.nombre, m.xSvg + it.x + 16, y);
    }
  });
  return new Promise((ok, mal) =>
    lienzo.toBlob(
      (b) => (b ? ok(b) : mal(new Error('png: el navegador no generó la imagen'))),
      'image/png',
    ),
  );
}
