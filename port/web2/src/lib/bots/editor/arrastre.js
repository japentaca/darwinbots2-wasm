// @ts-check
// Arrastre sin dependencias para el modo Fichas del editor (PLAN-EDITOR
// E3.3). Lo usan Fichas.svelte (una ficha → un hueco) y Paleta.svelte (una
// entrada de la paleta → un hueco), así que la API no sabe qué se arrastra:
// el dato viaja opaco desde `alEmpezar` hasta `alSoltar`.
//
// Puro, sin DOM: la máquina de estados recibe eventos de puntero (objetos
// con clientX, clientY y pointerId) y una función `elementoEn(x, y)` que
// devuelve el elemento con `data-hueco` bajo el punto, o null. En el
// navegador el valor por defecto usa document.elementFromPoint; en los
// tests se inyecta un mapa.
//
// Dos gestos:
//   - Arrastre: alEmpezar en el puntero abajo; cuando el puntero se aleja
//     más de `umbral` px de ese punto empieza el arrastre y se marca el
//     hueco bajo el puntero; al soltar, `alSoltar(dato, hueco)`. Si el
//     puntero no se movió lo bastante es un toque: no pasa nada aquí y el
//     clic normal sigue su curso.
//   - Táctil: `seleccionar(dato)` guarda una ficha; el siguiente toque
//     (pointerup sin arrastre) sobre un hueco la suelta ahí.

/** @typedef {{clientX: number, clientY: number, pointerId: number}} EventoPuntero */
/** @typedef {{dataset?: Record<string, string | undefined>}} ElementoHueco */

/**
 * El elemento con `data-hueco` bajo el punto (el valor por defecto en el
 * navegador), o null.
 * @param {number} x @param {number} y
 * @returns {ElementoHueco | null}
 */
function elementoBajoPuntero(x, y) {
  const doc = globalThis.document;
  if (!doc) return null;
  return doc.elementFromPoint(x, y)?.closest('[data-hueco]') ?? null;
}

/**
 * @param {{
 *   umbral?: number,
 *   elementoEn?: (x: number, y: number) => ElementoHueco | null,
 *   alSoltar?: (dato: unknown, hueco: number | null) => void,
 *   alMarcar?: (hueco: number | null) => void,
 * }} [opciones]
 *   umbral: px que tiene que alejarse el puntero para empezar el arrastre.
 *   elementoEn: devuelve el elemento con `data-hueco` bajo (x, y), o null.
 *   alSoltar: se llama al terminar un arrastre o al tocar con una ficha
 *     seleccionada. `hueco` es la posición (número) o null si el puntero
 *     soltó fuera de todo hueco; el que llama decide qué hacer con null.
 *   alMarcar: se llama cada vez que cambia el hueco marcado durante el
 *     arrastre (número o null), para resaltarlo en la vista.
 */
export function crearArrastre({
  umbral = 6,
  elementoEn = elementoBajoPuntero,
  alSoltar = () => {},
  alMarcar = () => {},
} = {}) {
  /**
   * El puntero apretado: `activo` pasa a true cuando supera el umbral.
   * @type {{id: number, x: number, y: number, dato: unknown, activo: boolean} | null}
   */
  let pendiente = null;
  /** @type {number | null} */
  let marcado = null;
  /** @type {unknown} */
  let seleccionado = null;

  /**
   * La posición del hueco bajo el puntero, o null. `data-hueco="0"` es un
   * hueco válido: se compara contra la cadena vacía y no contra la
   * falsedad del valor.
   * @param {EventoPuntero} ev
   * @returns {number | null}
   */
  function huecoEn(ev) {
    const el = elementoEn(ev.clientX, ev.clientY);
    const crudo = el?.dataset?.hueco;
    if (crudo === undefined || crudo === '') return null;
    const n = Number(crudo);
    return Number.isFinite(n) ? n : null;
  }

  /** @param {number | null} nuevo */
  function marcar(nuevo) {
    if (nuevo === marcado) return;
    marcado = nuevo;
    alMarcar(marcado);
  }

  return {
    /**
     * Puntero abajo sobre algo arrastrable.
     * @param {EventoPuntero} ev @param {unknown} dato
     */
    alEmpezar(ev, dato) {
      pendiente = {
        id: ev.pointerId,
        x: ev.clientX,
        y: ev.clientY,
        dato,
        activo: false,
      };
    },

    /**
     * Puntero movido: decide si el arrastre empieza y marca el hueco bajo
     * el puntero mientras dura.
     * @param {EventoPuntero} ev
     */
    alMover(ev) {
      const p = pendiente;
      if (!p || ev.pointerId !== p.id) return;
      if (!p.activo) {
        if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) <= umbral) return;
        p.activo = true;
      }
      marcar(huecoEn(ev));
    },

    /**
     * Puntero soltado. Si había un arrastre, llama `alSoltar(dato, hueco)`.
     * Si había un toque con una ficha seleccionada sobre un hueco, la suelta
     * ahí y limpia la selección. Devuelve true si consumió el gesto (hubo
     * arrastre o toque-soltar): el clic que el navegador dispara después
     * hay que ignorarlo. Devuelve false si fue un toque normal.
     * @param {EventoPuntero} ev
     * @returns {boolean}
     */
    alSoltar(ev) {
      const p = pendiente;
      if (p && ev.pointerId !== p.id) return false;
      pendiente = null;
      if (p?.activo) {
        const hueco = huecoEn(ev);
        marcar(null);
        alSoltar(p.dato, hueco);
        return true;
      }
      if (seleccionado !== null) {
        const hueco = huecoEn(ev);
        if (hueco !== null) {
          const dato = seleccionado;
          seleccionado = null;
          alSoltar(dato, hueco);
          return true;
        }
      }
      return false;
    },

    /** Cancela el arrastre en curso sin soltar nada (Escape, pointercancel). */
    alCancelar() {
      pendiente = null;
      marcar(null);
    },

    /**
     * Modo táctil: guarda la ficha que el siguiente toque sobre un hueco va
     * a soltar. `null` quita la selección.
     * @param {unknown} dato
     */
    seleccionar(dato) {
      seleccionado = dato ?? null;
    },

    /** Foto del estado, para que la vista la lea sin llevar la cuenta. */
    estado() {
      return {
        arrastrando: pendiente?.activo === true,
        dato: pendiente?.activo ? pendiente.dato : null,
        hueco: marcado,
        seleccionado,
      };
    },
  };
}
