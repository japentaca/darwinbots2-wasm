// @ts-check
// Lógica pura de la tarjeta «Conexión» (paso N3.9, decisión 16): apodo,
// transporte, relay y sala; validación, preferencias y el relay propuesto.

/** Largo máximo del apodo (viaja como dueño de cada organismo que sale). */
export const APODO_MAX = 40;
/** Largo máximo del nombre de la sala. */
export const SALA_MAX = 64;
/** Sala por defecto. */
export const SALA_POR_DEFECTO = 'public';
/** Puerto del relay de port/tools/imrelay/relay.mjs. */
export const PUERTO_RELAY = '8060';
/** Relay local por defecto. */
export const RELAY_LOCAL = `ws://localhost:${PUERTO_RELAY}/im`;
/** Preferencias de esta interfaz (la clásica usa otra clave). */
export const CLAVE_PREFS = 'darwinbots2.internet';

/**
 * @typedef {{ apodo: string, tipo: 'bc' | 'ws', url: string, sala: string }} PrefsIM
 * @typedef {{ campo: 'apodo' | 'url' | 'sala', clave: string }} ErrorCampo
 */

/**
 * Apodo limpio: sin caracteres de control (el apodo viaja dentro del
 * organismo), sin espacios en los bordes y con el largo máximo. Vacío = la
 * sim sortea «Newbie N».
 * @param {unknown} texto
 * @returns {string}
 */
export function normalizarApodo(texto) {
  return (
    String(texto ?? '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: se quitan a propósito
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, APODO_MAX)
      .trim()
  );
}

/**
 * Error del apodo tal como se escribió ('' = válido).
 * @param {unknown} texto
 * @returns {string}
 */
export function errorApodo(texto) {
  const s = String(texto ?? '');
  // biome-ignore lint/suspicious/noControlCharactersInRegex: se detectan a propósito
  if (/[\u0000-\u001f\u007f]/.test(s)) return 'apodoCaracteres';
  if (s.trim().length > APODO_MAX) return 'apodoLargo';
  return '';
}

/**
 * Sala limpia (vacía = la pública).
 * @param {unknown} texto
 * @returns {string}
 */
export function normalizarSala(texto) {
  const s = String(texto ?? '').trim();
  return s ? s.slice(0, SALA_MAX) : SALA_POR_DEFECTO;
}

/**
 * Error de la sala ('' = válida).
 * @param {unknown} texto
 * @returns {string}
 */
export function errorSala(texto) {
  return String(texto ?? '').trim().length > SALA_MAX ? 'salaLarga' : '';
}

/** @param {string} host */
const esLocal = (host) =>
  host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');

/**
 * Error de la URL del relay ('' = válida). `protocoloPagina` = el de la
 * página: desde una página https el navegador bloquea un ws:// que no sea
 * local.
 * @param {unknown} texto
 * @param {string} [protocoloPagina]
 * @returns {string}
 */
export function errorUrl(texto, protocoloPagina = '') {
  const s = String(texto ?? '').trim();
  if (!s) return 'urlVacia';
  /** @type {URL} */
  let u;
  try {
    u = new URL(s);
  } catch {
    return 'urlFormato';
  }
  if (u.protocol !== 'ws:' && u.protocol !== 'wss:') return 'urlProtocolo';
  if (!u.hostname) return 'urlFormato';
  if (u.hash) return 'urlFormato';
  if (protocoloPagina === 'https:' && u.protocol === 'ws:' && !esLocal(u.hostname))
    return 'urlInsegura';
  return '';
}

/**
 * Relay propuesto: si la página la sirve el relay (su puerto), el mismo
 * host en /im; si no, el relay local.
 * @param {{ protocol?: string, host?: string, port?: string } | null | undefined} loc
 * @returns {string}
 */
export function urlPorDefecto(loc) {
  if (loc?.port === PUERTO_RELAY && loc.host) {
    return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}/im`;
  }
  return RELAY_LOCAL;
}

/**
 * Preferencias guardadas (o las de fábrica).
 * @param {{ getItem: (k: string) => string | null } | null | undefined} almacen
 * @param {string} urlDefecto
 * @returns {PrefsIM}
 */
export function leerPrefs(almacen, urlDefecto) {
  /** @type {any} */
  let p = {};
  try {
    p = JSON.parse(almacen?.getItem(CLAVE_PREFS) ?? '{}') ?? {};
  } catch {
    p = {};
  }
  return {
    apodo: normalizarApodo(p.apodo),
    tipo: p.tipo === 'ws' ? 'ws' : 'bc',
    url: typeof p.url === 'string' && p.url.trim() ? p.url.trim() : urlDefecto,
    sala: typeof p.sala === 'string' && p.sala.trim() ? p.sala.trim().slice(0, SALA_MAX) : SALA_POR_DEFECTO,
  };
}

/**
 * Guarda las preferencias (sin almacenamiento, no pasa nada).
 * @param {{ setItem: (k: string, v: string) => void } | null | undefined} almacen
 * @param {PrefsIM} p
 */
export function guardarPrefs(almacen, p) {
  try {
    almacen?.setItem(
      CLAVE_PREFS,
      JSON.stringify({ apodo: p.apodo, tipo: p.tipo, url: p.url, sala: p.sala }),
    );
  } catch {
    // Sin almacenamiento: vale para esta sesión.
  }
}

/**
 * Valida lo escrito y arma la configuración para conectar.
 * @param {{ apodo: string, tipo: 'bc' | 'ws', url: string, sala: string }} f
 * @param {string} [protocoloPagina]
 * @returns {{ ok: true, cfg: PrefsIM } | { ok: false, errores: ErrorCampo[] }}
 */
export function validarFormulario(f, protocoloPagina = '') {
  /** @type {ErrorCampo[]} */
  const errores = [];
  const ea = errorApodo(f.apodo);
  if (ea) errores.push({ campo: 'apodo', clave: ea });
  if (f.tipo === 'ws') {
    const eu = errorUrl(f.url, protocoloPagina);
    if (eu) errores.push({ campo: 'url', clave: eu });
  }
  const es = errorSala(f.sala);
  if (es) errores.push({ campo: 'sala', clave: es });
  if (errores.length) return { ok: false, errores };
  return {
    ok: true,
    cfg: {
      apodo: normalizarApodo(f.apodo),
      tipo: f.tipo === 'ws' ? 'ws' : 'bc',
      url: f.tipo === 'ws' ? String(f.url).trim() : '',
      sala: normalizarSala(f.sala),
    },
  };
}

/**
 * Clave del texto del estado del enlace (internet.enlace.<x>).
 * @param {import('./nucleo.js').EstadoIM} e
 * @returns {string}
 */
export function claveEstado(e) {
  if (e.pedido && !e.activo) return 'internet.enlace.pidiendo';
  if (!e.activo) return 'internet.enlace.apagado';
  return `internet.enlace.${e.enlace}`;
}

/** Sufijos de `internet.enlace.` que puede armar claveEstado. */
export const ENLACES = Object.freeze([
  'pidiendo',
  'apagado',
  'conectando',
  'conectado',
  'pestanas',
  'sinRelay',
  'error',
]);
