// @ts-check
// Detector del feed de Observar (sin DOM, N4.5: aparte de eventos.js para
// que la corrida no arrastre engine/report al chunk principal). Detecta,
// sobre las muestras de la historia (una cada 100 ciclos), extinciones,
// picos de población y generaciones récord; sobre la tabla de especies, las
// especies que aparecen sin haberse sembrado (llegadas por teleporter).
// Los textos los arma eventos.js (textoEvento).

/**
 * @typedef {'extincion' | 'pico' | 'generacion' | 'llegada' | 'especieNueva' | 'cambio'
 *   | 'sembrado' | 'guardada' | 'cargada' | 'importada' | 'inicio' | 'objetos'} TipoEvento
 * @typedef {{ ciclo: number, tipo: TipoEvento, params: Record<string, any> }} EventoFeed
 */

/** Caída (fracción del pico) que confirma un pico de población. */
export const CAIDA_PICO = 0.1;
/** Un pico nuevo tiene que superar al último informado en esta fracción. */
export const MEJORA_PICO = 0.1;
/** Picos de menos bots no se informan. */
export const MIN_PICO = 10;

/**
 * Próxima generación récord que merece un evento: de a 1 hasta 10, de a 5
 * hasta 50 y de a 10 después.
 * @param {number} ultima última informada (−1 = ninguna)
 */
export function hitoGeneracion(ultima) {
  if (ultima < 10) return Math.max(1, Math.floor(ultima) + 1);
  if (ultima < 50) return (Math.floor(ultima / 5) + 1) * 5;
  return (Math.floor(ultima / 10) + 1) * 10;
}

export class DetectorEventos {
  /** especies con bots en la muestra anterior */
  #vivas = new Set();
  #primera = true;
  #maxTotal = 0;
  #cicloMax = 0;
  #ultimoPico = 0;
  #genRecord = -1;
  #genInformada = -1;

  reiniciar() {
    this.#vivas = new Set();
    this.#primera = true;
    this.#maxTotal = 0;
    this.#cicloMax = 0;
    this.#ultimoPico = 0;
    this.#genRecord = -1;
    this.#genInformada = -1;
  }

  /**
   * Procesa una muestra. La primera (tras crear o reiniciar) solo fija la
   * base: una sim cargada no anuncia lo que ya traía.
   * @param {{ ciclo: number, total: number, especies: Record<string, number>,
   *   genMax?: number, genEspecie?: string }} m
   * @returns {EventoFeed[]}
   */
  muestra(m) {
    /** @type {EventoFeed[]} */
    const out = [];
    const ahora = new Set(Object.keys(m.especies).filter((k) => m.especies[k] > 0));
    const gen = Number.isFinite(m.genMax) ? /** @type {number} */ (m.genMax) : -1;

    if (this.#primera) {
      this.#primera = false;
      this.#vivas = ahora;
      this.#maxTotal = m.total;
      this.#cicloMax = m.ciclo;
      this.#ultimoPico = m.total;
      this.#genRecord = gen;
      this.#genInformada = gen;
      return out;
    }

    // Extinción: tenía bots en la muestra anterior y ahora no.
    for (const k of this.#vivas) {
      if (!ahora.has(k)) out.push({ ciclo: m.ciclo, tipo: 'extincion', params: { especie: k } });
    }
    this.#vivas = ahora;

    // Pico: máximo que supera al último informado y se confirma con una caída.
    if (m.total > this.#maxTotal) {
      this.#maxTotal = m.total;
      this.#cicloMax = m.ciclo;
    } else if (
      this.#maxTotal >= MIN_PICO &&
      this.#maxTotal > this.#ultimoPico * (1 + MEJORA_PICO) &&
      m.total <= this.#maxTotal * (1 - CAIDA_PICO)
    ) {
      out.push({ ciclo: this.#cicloMax, tipo: 'pico', params: { n: this.#maxTotal } });
      this.#ultimoPico = this.#maxTotal;
      this.#maxTotal = m.total;
      this.#cicloMax = m.ciclo;
    }

    // Generación récord (por hitos, para no llenar el feed).
    if (gen > this.#genRecord) {
      this.#genRecord = gen;
      if (gen >= hitoGeneracion(this.#genInformada)) {
        out.push({
          ciclo: m.ciclo,
          tipo: 'generacion',
          params: { n: gen, especie: m.genEspecie ?? '' },
        });
        this.#genInformada = gen;
      }
    }
    return out;
  }
}

/**
 * Especies de la tabla que nadie sembró: si hay teleporters, llegaron por
 * uno; si no, son especies nuevas (p. ej. de un `.dbsim` con
 * autoespeciación). Agrega las nuevas a `conocidas`.
 * @param {Set<string>} conocidas  nombres sin `.txt`
 * @param {string[]} nombres       tabla de la vista (sin `.txt`)
 * @param {boolean} hayTeleporter
 * @param {number} ciclo
 * @returns {EventoFeed[]}
 */
export function especiesNuevas(conocidas, nombres, hayTeleporter, ciclo) {
  /** @type {EventoFeed[]} */
  const out = [];
  for (const n of nombres) {
    if (!n || /^corpse$/i.test(n) || conocidas.has(n)) continue;
    conocidas.add(n);
    out.push({ ciclo, tipo: hayTeleporter ? 'llegada' : 'especieNueva', params: { especie: n } });
  }
  return out;
}
