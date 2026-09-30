// @ts-check
// Textos de la cola de trabajos que dependen de datos (puro: `t` llega como
// parámetro, así se prueba en node).
//
// Los errores guardados traen su texto y, si lo tienen, un `codigo` estable
// (ErrorReplica, ErrorReplicas, ErrorCola): se muestran con
// t('comparar.error.<codigo>', {detalle}) y, si no hay clave para ese
// código, con el genérico t('comparar.trabajos.error', {detalle}).

/**
 * El detalle de un mensaje de error `codigo: detalle` ('' si es solo el
 * código).
 * @param {string | undefined} mensaje @param {string | undefined} codigo
 */
export function detalleError(mensaje, codigo) {
  const m = mensaje ?? '';
  if (!codigo) return m;
  if (m === codigo) return '';
  return m.startsWith(`${codigo}: `) ? m.slice(codigo.length + 2) : m;
}

/**
 * Texto de un error con código.
 * @param {(clave: string, params?: Record<string, string | number>) => string} t
 * @param {string | undefined} codigo @param {string | undefined} mensaje
 */
export function textoError(t, codigo, mensaje) {
  const detalle = detalleError(mensaje, codigo);
  if (codigo) {
    const clave = `comparar.error.${codigo}`;
    const s = t(clave, { detalle });
    if (s !== clave) return s;
  }
  return t('comparar.trabajos.error', { detalle: mensaje ?? '' });
}
