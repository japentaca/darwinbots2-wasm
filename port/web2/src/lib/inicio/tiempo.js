// @ts-check
// Fechas de Inicio (paso N1.6): «hace 2 horas», «ayer», «24 sep». Puro: el
// idioma y el «ahora» se pasan, así los tests no dependen del reloj.

/** Desde cuántos días se muestra la fecha corta en vez del tiempo relativo. */
export const DIAS_RELATIVO = 7;

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** @type {Map<string, Intl.RelativeTimeFormat>} */
const formatos = new Map();

/** @param {string} idioma */
function rtf(idioma) {
  let f = formatos.get(idioma);
  if (!f) {
    f = new Intl.RelativeTimeFormat(idioma, { numeric: 'auto' });
    formatos.set(idioma, f);
  }
  return f;
}

/**
 * Tiempo relativo de `fecha` respecto de `ahora` («hace 5 minutos», «hace 2
 * horas», «ayer»), siempre relativo (para «guardada hace X»). '' si la fecha
 * no es válida. Una fecha futura (reloj atrasado) cuenta como «ahora».
 * @param {string | number | Date | undefined | null} fecha
 * @param {number} ahora  ms
 * @param {string} idioma 'es' | 'en'
 * @returns {string}
 */
export function haceCuanto(fecha, ahora, idioma) {
  const t = fecha instanceof Date ? fecha.getTime() : new Date(fecha ?? NaN).getTime();
  if (!Number.isFinite(t)) return '';
  const d = Math.max(0, ahora - t);
  const f = rtf(idioma);
  if (d < MIN) return f.format(0, 'second');
  if (d < HORA) return f.format(-Math.floor(d / MIN), 'minute');
  if (d < DIA) return f.format(-Math.floor(d / HORA), 'hour');
  // Días de calendario (ayer = el día anterior aunque hayan pasado 20 h).
  const dias = diasCalendario(t, ahora);
  if (dias < 30) return f.format(-Math.max(1, dias), 'day');
  if (dias < 365) return f.format(-Math.floor(dias / 30), 'month');
  return f.format(-Math.floor(dias / 365), 'year');
}

/**
 * Para una lista: «hoy», «ayer», «hace 3 días» hasta DIAS_RELATIVO; después,
 * la fecha corta («24 sep», con año si no es el de `ahora`).
 * @param {string | number | Date | undefined | null} fecha
 * @param {number} ahora
 * @param {string} idioma
 * @returns {string}
 */
export function fechaCorta(fecha, ahora, idioma) {
  const t = fecha instanceof Date ? fecha.getTime() : new Date(fecha ?? NaN).getTime();
  if (!Number.isFinite(t)) return '';
  const dias = diasCalendario(t, ahora);
  if (dias < DIAS_RELATIVO) return rtf(idioma).format(-Math.max(0, dias), 'day');
  const f = new Date(t);
  /** @type {Intl.DateTimeFormatOptions} */
  const o = { day: 'numeric', month: 'short' };
  if (f.getFullYear() !== new Date(ahora).getFullYear()) o.year = 'numeric';
  return f.toLocaleDateString(idioma, o);
}

/**
 * Días de calendario (hora local) entre t y ahora.
 * @param {number} t @param {number} ahora
 */
function diasCalendario(t, ahora) {
  const a = new Date(t);
  const b = new Date(ahora);
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DIA);
}
