// @ts-check
// Historial de deshacer del modo Fichas del editor (PLAN-EDITOR E3.2).
//
// El modo texto sigue con el deshacer del navegador (decisión 18). Este
// historial es propio de Fichas: sus acciones son reemplazos de rango
// programáticos que no entran en esa pila. Guarda textos completos; el ADN
// de un bot pesa poco y así deshacer no depende de adivinar qué cambió.
//
// Modelo «foto después del cambio»: `anotar(texto)` registra el texto
// vigente. El editor lo llama al cargar el texto (base) y después de cada
// acción. `deshacer()` y `rehacer()` devuelven el texto al que hay que
// volver, y el editor lo asigna. Así el historial sabe siempre qué texto
// mandar a la otra pila sin que nadie se lo pase de nuevo.
//
// Anotar el texto que ya está vigente no hace nada (no descarta la rama de
// rehacer). Anotar un texto distinto descarta la rama de rehacer.

/**
 * @param {number} [tope] cantidad máxima de estados anteriores que se guardan.
 */
export function crearHistorial(tope = 100) {
  /** @type {string[]} */
  let pasado = [];
  /** @type {string[]} */
  let futuro = [];
  /** @type {string | null} */
  let vigente = null;

  return {
    /** @param {string} texto el texto vigente tras la acción (o el de carga) */
    anotar(texto) {
      if (texto === vigente) return;
      if (vigente !== null) {
        pasado.push(vigente);
        if (pasado.length > tope) pasado.shift();
      }
      futuro = [];
      vigente = texto;
    },
    /** @returns {string | null} el texto anterior, o null si no hay ninguno */
    deshacer() {
      if (vigente === null || pasado.length === 0) return null;
      const previo = /** @type {string} */ (pasado.pop());
      futuro.push(vigente);
      vigente = previo;
      return previo;
    },
    /** @returns {string | null} el texto que se deshizo, o null si no hay ninguno */
    rehacer() {
      if (vigente === null || futuro.length === 0) return null;
      const siguiente = /** @type {string} */ (futuro.pop());
      pasado.push(vigente);
      vigente = siguiente;
      return siguiente;
    },
    /** Vacía el historial (al cambiar de modo o de bot). */
    limpiar() {
      pasado = [];
      futuro = [];
      vigente = null;
    },
  };
}
