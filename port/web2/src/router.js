// @ts-check
// Router por hash: `#/`, `#/observar`, `#/bots/xyz`… Lo puro se exporta para los tests.

/** Secciones en el orden de la barra superior. */
export const SECCIONES = /** @type {const} */ ([
  'inicio',
  'observar',
  'experimentar',
  'analizar',
  'bots',
  'competir',
]);

/** @typedef {typeof SECCIONES[number]} Seccion */
/** @typedef {{ seccion: Seccion, partes: string[], consulta: Record<string, string> }} Ruta */

/**
 * La parte de consulta del hash (`?adn=…`) como objeto (la última valoración
 * gana, como en un formulario). Vacía si no hay `?`.
 * @param {string | null | undefined} hash
 * @returns {Record<string, string>}
 */
export function consultaDe(hash) {
  const q = String(hash ?? '')
    .replace(/^#/, '')
    .split('?')[1];
  if (!q) return {};
  return Object.fromEntries(new URLSearchParams(q));
}

/**
 * Convierte un hash (`#/bots/xyz?x`) en sección + subpartes + consulta.
 * Hash vacío, `#/` o sección desconocida → inicio sin partes.
 * @param {string | null | undefined} hash
 * @returns {Ruta}
 */
export function parsearHash(hash) {
  const consulta = consultaDe(hash);
  const limpio = String(hash ?? '')
    .replace(/^#/, '')
    .split('?')[0];
  const segmentos = limpio.split('/').filter((s) => s !== '');
  /** @type {string[]} */
  const partes = [];
  for (const s of segmentos) {
    try {
      partes.push(decodeURIComponent(s));
    } catch {
      partes.push(s);
    }
  }
  const [primera, ...resto] = partes;
  const seccion = /** @type {readonly string[]} */ (SECCIONES).includes(primera)
    ? /** @type {Seccion} */ (primera)
    : null;
  if (!seccion || (seccion === 'inicio' && resto.length === 0)) {
    return { seccion: 'inicio', partes: [], consulta };
  }
  return { seccion, partes: resto, consulta };
}

/**
 * Arma el hash de una ruta. Inicio es `#/`.
 * @param {Seccion} seccion
 * @param {...string} partes
 * @returns {string}
 */
export function hashDe(seccion, ...partes) {
  const segs = seccion === 'inicio' && partes.length === 0 ? [] : [seccion, ...partes];
  return `#/${segs.map(encodeURIComponent).join('/')}`;
}

/**
 * Hash con el que hay que reemplazar la URL, o null si la ruta es válida.
 * Una sección desconocida (`#/nada`, `#/Bots`) se corrige a `#/`; el hash
 * vacío y `#/` quedan como están.
 * @param {string | null | undefined} hash
 * @returns {string | null}
 */
export function hashCorregido(hash) {
  const limpio = String(hash ?? '')
    .replace(/^#/, '')
    .split('?')[0];
  const primero = limpio.split('/').find((s) => s !== '');
  if (primero === undefined) return null;
  let seccion = primero;
  try {
    seccion = decodeURIComponent(primero);
  } catch {
    // Mal codificado: no es ninguna sección.
  }
  return /** @type {readonly string[]} */ (SECCIONES).includes(seccion) ? null : '#/';
}

/**
 * Llama a `cb` con la ruta actual y en cada cambio del hash. Devuelve la baja.
 * Una ruta desconocida se reemplaza por `#/` sin sumar entrada al historial.
 * @param {(ruta: Ruta) => void} cb
 * @returns {() => void}
 */
export function escucharHash(cb) {
  const avisar = () => {
    const corregido = hashCorregido(window.location.hash);
    if (corregido !== null) {
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, '', `${pathname}${search}${corregido}`);
    }
    cb(parsearHash(window.location.hash));
  };
  window.addEventListener('hashchange', avisar);
  avisar();
  return () => window.removeEventListener('hashchange', avisar);
}
