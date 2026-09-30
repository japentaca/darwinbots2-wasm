// @ts-check
// Serie por ciclo con ventana fija (la sparkline de energía del inspector):
// un punto por frame, se descartan los de más de `ventana` ciclos atrás. Si
// el ciclo retrocede (sim nueva o carga) la serie empieza de nuevo. Puro.

export class SerieCiclos {
  /** @type {number[]} */
  ciclos = [];
  /** @type {number[]} */
  valores = [];

  /** @param {number} [ventana] ciclos que se conservan */
  constructor(ventana = 1000) {
    this.ventana = ventana;
  }

  get largo() {
    return this.ciclos.length;
  }

  limpiar() {
    this.ciclos.length = 0;
    this.valores.length = 0;
  }

  /**
   * Agrega un punto. El mismo ciclo reemplaza al último (sim en pausa).
   * @param {number} ciclo
   * @param {number} valor
   */
  agregar(ciclo, valor) {
    if (!Number.isFinite(ciclo) || !Number.isFinite(valor)) return;
    const n = this.ciclos.length;
    if (n) {
      const ultimo = this.ciclos[n - 1];
      if (ciclo < ultimo) this.limpiar();
      else if (ciclo === ultimo) {
        this.valores[n - 1] = valor;
        return;
      }
    }
    this.ciclos.push(ciclo);
    this.valores.push(valor);
    const desde = ciclo - this.ventana;
    let k = 0;
    while (k < this.ciclos.length && this.ciclos[k] < desde) k++;
    if (k) {
      this.ciclos.splice(0, k);
      this.valores.splice(0, k);
    }
  }

  /**
   * Camino SVG (`M x y L …`) en una caja de ancho × alto. El eje x es la
   * ventana entera que termina en el último ciclo (el trazo crece desde la
   * derecha); el eje y va de min(0, mínimo) al máximo. '' con menos de 2 puntos.
   * @param {number} ancho
   * @param {number} alto
   * @returns {string}
   */
  camino(ancho, alto) {
    const n = this.ciclos.length;
    if (n < 2) return '';
    const fin = this.ciclos[n - 1];
    const ini = fin - this.ventana;
    const { min, rango, m, h } = this.#escala(alto);
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = ((this.ciclos[i] - ini) / this.ventana) * ancho;
      const y = m + h - ((this.valores[i] - min) / rango) * h;
      s += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return s;
  }

  /**
   * Altura (en la misma caja que camino()) del valor 0: la línea base de la
   * sparkline. Abajo de todo si no hay valores negativos.
   * @param {number} alto
   */
  lineaBase(alto) {
    const { min, rango, m, h } = this.#escala(alto);
    return m + h - ((0 - min) / rango) * h;
  }

  /** @param {number} alto */
  #escala(alto) {
    let min = 0;
    let max = 0;
    for (const x of this.valores) {
      if (x < min) min = x;
      if (x > max) max = x;
    }
    const m = 1; // margen para que el trazo no se corte arriba y abajo
    return { min, rango: max - min || 1, m, h: alto - 2 * m };
  }
}
