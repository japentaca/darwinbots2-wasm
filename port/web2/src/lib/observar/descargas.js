// @ts-check
// Descargas e imágenes del mundo (DOM).

/**
 * Descarga un Blob con ese nombre de archivo.
 * @param {Blob} blob @param {string} nombre
 */
export function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Nombre de archivo seguro a partir de un texto.
 * @param {string} texto @param {string} ext con el punto
 */
export function nombreArchivo(texto, ext) {
  const base =
    String(texto ?? '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'darwinbots';
  return `${base}${ext}`;
}

/** El lienzo del mundo en pantalla (null si Observar no está a la vista). */
export function lienzoMundo() {
  return /** @type {HTMLCanvasElement | null} */ (document.querySelector('.mundo canvas'));
}

/**
 * Miniatura PNG (data URL) del mundo, de `ancho` px (undefined si no hay lienzo).
 * @param {number} [ancho]
 */
export function miniaturaMundo(ancho = 160) {
  const c = lienzoMundo();
  if (!c?.width || !c.height) return undefined;
  const alto = Math.max(1, Math.round((ancho * c.height) / c.width));
  const m = document.createElement('canvas');
  m.width = ancho;
  m.height = alto;
  const ctx = m.getContext('2d');
  if (!ctx) return undefined;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, ancho, alto);
  return m.toDataURL('image/png');
}

/**
 * PNG del mundo a tamaño completo.
 * @returns {Promise<Blob | null>}
 */
export function pngMundo() {
  const c = lienzoMundo();
  if (!c) return Promise.resolve(null);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
