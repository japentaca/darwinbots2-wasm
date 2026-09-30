// @ts-check
// Cambios programáticos en el textarea del editor (apagar un gen, insertar
// uno del Laboratorio, un arreglo del lint, completar una sysvar) SIN
// romper el deshacer del navegador (decisión 18): en vez de reescribir
// `value`, se selecciona el tramo que cambia y se reemplaza con
// execCommand('insertText'), que entra en la pila de deshacer como si lo
// hubiera escrito el usuario. Si el navegador no lo soporta, setRangeText
// (sin deshacer) y un evento 'input'.

/**
 * El tramo mínimo que cambia de `viejo` a `nuevo`: [ini, fin) de `viejo`
 * se reemplaza por `texto`.
 * @param {string} viejo @param {string} nuevo
 * @returns {{ini: number, fin: number, texto: string}}
 */
export function diferencia(viejo, nuevo) {
  let a = 0;
  const n = Math.min(viejo.length, nuevo.length);
  while (a < n && viejo[a] === nuevo[a]) a++;
  let b = 0;
  while (b < n - a && viejo[viejo.length - 1 - b] === nuevo[nuevo.length - 1 - b]) b++;
  return { ini: a, fin: viejo.length - b, texto: nuevo.slice(a, nuevo.length - b) };
}

/**
 * Lleva el textarea a `nuevo` con un solo paso deshacible.
 * @param {HTMLTextAreaElement} ta @param {string} nuevo
 */
export function reemplazarTexto(ta, nuevo) {
  const d = diferencia(ta.value, nuevo);
  if (d.ini === d.fin && !d.texto) return;
  ta.focus();
  ta.setSelectionRange(d.ini, d.fin);
  let ok = false;
  try {
    ok = d.texto
      ? document.execCommand('insertText', false, d.texto)
      : document.execCommand('delete', false);
  } catch {
    ok = false;
  }
  if (!ok) ta.setRangeText(d.texto, d.ini, d.fin, 'end');
  else if (ta.value !== nuevo)
    ta.value = nuevo; // no debería pasar: manda el texto pedido
  else return; // execCommand ya disparó 'input'
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
