// @ts-check
// Consola del bot en el inspector: salida con tope y historial de comandos
// (flechas arriba/abajo). Puro; el componente la envuelve en runes.

/** Comandos de la consola del motor y su sintaxis (no se traducen; la
 * explicación de cada uno está en i18n: inspector.consola.ayuda.<comando>). */
export const COMANDOS = Object.freeze({
  printeye: 'printeye',
  printtouch: 'printtouch',
  printtaste: 'printtaste',
  printmem: 'printmem (.var | n)   ? (.var | n)',
  set: 'set (.var | n) v',
  energy: 'energy e',
  cycle: 'cycle n',
  execrob: 'execrob',
  play: 'play',
  pause: 'pause',
  showdna: 'showdna',
  debug: 'debug',
});

/** Comandos que cambian la simulación (memoria, energía, ciclos, marcha):
 * con un torneo en curso la consola no los manda (PLAN-TORNEO-EN-CURSO.md,
 * T8). Los demás solo leen. */
export const MODIFICAN = Object.freeze(
  new Set(['set', 'energy', 'cycle', 'execrob', 'play', 'pause']),
);

/** Tope de caracteres de la salida (el de la consola original: 2500). */
export const TOPE_SALIDA = 2500;

export class SalidaConsola {
  /** @type {string[]} */
  lineas = [];
  #largo = 0;

  /** @param {number} [tope] */
  constructor(tope = TOPE_SALIDA) {
    this.tope = tope;
  }

  /**
   * Agrega texto (puede traer varias líneas). Descarta las más viejas si se
   * pasa del tope, pero nunca la última.
   * @param {string} texto
   */
  agregar(texto) {
    for (const l of String(texto ?? '').split(/\r?\n/)) {
      this.lineas.push(l);
      this.#largo += l.length + 1;
    }
    while (this.lineas.length > 1 && this.#largo > this.tope) {
      this.#largo -= /** @type {string} */ (this.lineas.shift()).length + 1;
    }
  }

  limpiar() {
    this.lineas = [];
    this.#largo = 0;
  }

  get texto() {
    return this.lineas.join('\n');
  }
}

export class HistorialComandos {
  /** @type {string[]} */
  comandos = [];
  pos = 0;

  /** @param {string} c */
  agregar(c) {
    const s = String(c).trim();
    if (!s) return;
    if (this.comandos[this.comandos.length - 1] !== s) this.comandos.push(s);
    if (this.comandos.length > 100) this.comandos.shift();
    this.pos = this.comandos.length;
  }

  /** Comando anterior ('' si no hay). */
  anterior() {
    if (this.pos > 0) this.pos--;
    return this.comandos[this.pos] ?? '';
  }

  /** Comando siguiente ('' al pasar el último). */
  siguiente() {
    this.pos = Math.min(this.pos + 1, this.comandos.length);
    return this.comandos[this.pos] ?? '';
  }
}

/**
 * Primera palabra del comando en minúsculas ('' si está vacío).
 * @param {string} linea
 */
export function verbo(linea) {
  return String(linea ?? '')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();
}
