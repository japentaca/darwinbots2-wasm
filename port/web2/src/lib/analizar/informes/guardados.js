// @ts-check
// Informes generados (decisión 17: almacén 'informes' de la IndexedDB
// darwinbots2). Cada informe se guarda con su .html entero, así se puede
// volver a descargar o imprimir sin regenerarlo (aunque la corrida ya no
// exista). Se conservan los MAX_INFORMES más recientes. Puro: el almacén
// (engine/almacen.js) se inyecta.

export const ST_INFORMES = 'informes';
export const MAX_INFORMES = 30;

/**
 * @typedef {{
 *   id: string, tipo: 'corrida' | 'comparacion' | 'replicas', titulo: string,
 *   archivo: string, idioma: string, fecha: string, corrida?: string,
 *   bytes: number, html: string,
 * }} InformeGuardado
 * `corrida`: id de la corrida guardada de la que sale (índice 'corrida');
 * sin él si viene de la actual, de dos corridas o de un trabajo.
 */

/** @param {InformeGuardado} a @param {InformeGuardado} b */
const porFecha = (a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id);

const idNuevo = () => `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Guarda un informe generado y poda los más viejos. Devuelve el registro.
 * @param {import('../../../../engine/almacen.js').Almacen} almacen
 * @param {{tipo: InformeGuardado['tipo'], titulo: string, archivo: string, idioma: string,
 *   html: string, corrida?: string | null}} o
 * @param {{id?: string, fecha?: Date}} [op]
 * @returns {Promise<InformeGuardado>}
 */
export async function guardarInforme(almacen, o, op = {}) {
  /** @type {InformeGuardado} */
  const r = {
    id: op.id ?? idNuevo(),
    tipo: o.tipo,
    titulo: o.titulo,
    archivo: o.archivo,
    idioma: o.idioma,
    fecha: (op.fecha ?? new Date()).toISOString(),
    bytes: new TextEncoder().encode(o.html).length,
    html: o.html,
  };
  if (o.corrida) r.corrida = o.corrida;
  await almacen.tx([ST_INFORMES], async (t) => {
    await t.put(ST_INFORMES, r);
    const todos = /** @type {InformeGuardado[]} */ (await t.list(ST_INFORMES)).sort(porFecha);
    for (const viejo of todos.slice(MAX_INFORMES)) await t.delete(ST_INFORMES, viejo.id);
  });
  return r;
}

/**
 * Los informes guardados, el más reciente primero, sin el html (para la lista).
 * @param {import('../../../../engine/almacen.js').Almacen} almacen
 * @returns {Promise<Omit<InformeGuardado, 'html'>[]>}
 */
export async function listarInformes(almacen) {
  const todos = /** @type {InformeGuardado[]} */ (await almacen.list(ST_INFORMES));
  return todos.sort(porFecha).map(({ html: _h, ...resto }) => resto);
}

/**
 * Un informe guardado con su html (null si no existe).
 * @param {import('../../../../engine/almacen.js').Almacen} almacen @param {string} id
 * @returns {Promise<InformeGuardado | null>}
 */
export async function leerInforme(almacen, id) {
  return (await almacen.get(ST_INFORMES, id)) ?? null;
}

/**
 * Borra un informe guardado.
 * @param {import('../../../../engine/almacen.js').Almacen} almacen @param {string} id
 */
export function borrarInforme(almacen, id) {
  return almacen.delete(ST_INFORMES, id);
}
