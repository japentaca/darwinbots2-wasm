// @ts-check
// Errores de Observar → clave de aviso (C9: ningún texto técnico en la
// interfaz). Se decide por la clase/código del error, nunca por su mensaje:
//   ErrorCorrida (corrida-nucleo.js)   observar.aviso.error.<clave>
//   ErrorConexion (conexion.js)        observar.aviso.error.conexion.<clave>
//   ErrorAlmacen (engine/almacen.js)   observar.aviso.error.almacen.<codigo>
//   DOMException de IndexedDB          cuota (QuotaExceededError) o almacen
//   ErrorEscenario (sin ADN)           observar.aviso.error.sinAdn {bot}
//   cualquier otro                     observar.aviso.error.desconocido
// Puro, sin DOM.

/** Claves de ErrorConexion con texto propio. */
const CONEXION = new Set(['tiempo', 'worker', 'carga', 'terminada', 'sin-respuesta', 'save-empty']);
/** Códigos de ErrorAlmacen con texto propio. */
const ALMACEN = new Set(['version-vieja', 'sin-indexeddb']);
/** Nombres de DOMException que IndexedDB puede dar. */
const IDB = new Set([
  'AbortError',
  'ConstraintError',
  'DataCloneError',
  'DataError',
  'InvalidStateError',
  'NotFoundError',
  'ReadOnlyError',
  'TransactionInactiveError',
  'UnknownError',
  'VersionError',
]);

/** camelCase de una clave con guiones ('sin-respuesta' → 'sinRespuesta'). @param {string} s */
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Aviso para un error.
 * @param {unknown} e
 * @returns {{ clave: string, params?: Record<string, any> }}
 */
export function avisoDeError(e) {
  const x = /** @type {any} */ (e);
  if (!x || typeof x !== 'object') return { clave: 'observar.aviso.error.desconocido' };
  if (x.name === 'ErrorCorrida' && typeof x.clave === 'string')
    return { clave: `observar.aviso.error.${x.clave}` };
  if (x.name === 'ErrorConexion' && typeof x.clave === 'string')
    return {
      clave: CONEXION.has(x.clave)
        ? `observar.aviso.error.conexion.${camel(x.clave)}`
        : 'observar.aviso.error.conexion.otro',
    };
  if (typeof x.codigo === 'string' && ALMACEN.has(x.codigo))
    return { clave: `observar.aviso.error.almacen.${camel(x.codigo)}` };
  if (x.codigo === 'sin-adn') {
    const bot = x.errores?.[0]?.detalle;
    return { clave: 'observar.aviso.error.sinAdn', params: { bot: String(bot ?? '') } };
  }
  if (x.name === 'QuotaExceededError') return { clave: 'observar.aviso.error.cuota' };
  if (IDB.has(x.name) || x.name === 'ErrorAlmacen')
    return { clave: 'observar.aviso.error.almacen.otro' };
  return { clave: 'observar.aviso.error.desconocido' };
}

/** Todas las claves que puede dar avisoDeError (para el test de claves). */
export const CLAVES_ERROR = Object.freeze([
  'observar.aviso.error.desconocido',
  'observar.aviso.error.inexistente',
  'observar.aviso.error.sinDbsim',
  'observar.aviso.error.dbsimInvalido',
  ...[...CONEXION].map((c) => `observar.aviso.error.conexion.${camel(c)}`),
  'observar.aviso.error.conexion.otro',
  ...[...ALMACEN].map((c) => `observar.aviso.error.almacen.${camel(c)}`),
  'observar.aviso.error.almacen.otro',
  'observar.aviso.error.sinAdn',
  'observar.aviso.error.cuota',
]);
