<script>
// @ts-check
// Línea de tiempo de genes de la pestaña ADN (PLAN-EDITOR E2.3): una fila por
// gen y una celda por ciclo de los últimos 200 (la más nueva, a la derecha). La
// celda se enciende si el gen disparó en ese ciclo. Sin SVG: una cuadrícula de
// spans, que en un teléfono se recorre con desplazamiento horizontal.
import { t } from '../../i18n/index.svelte.js';
import { cuadriculaGen } from './adn.js';

/**
 * @type {{
 *   historialGa: (number[] | null)[],
 *   cantidad: number,
 * }}
 */
let { historialGa, cantidad } = $props();

const filas = $derived(Array.from({ length: cantidad }, (_, n) => cuadriculaGen(historialGa, n)));
</script>

{#if cantidad > 0}
  <section class="linea">
    <span class="tit">{t('inspector.adn.lineaTiempo')}</span>
    <p class="nota">{t('inspector.adn.lineaTiempoAyuda')}</p>
    <div class="scroll">
      {#each filas as celdas, n (n)}
        <div class="fila">
          <span class="etq mono">{n + 1}</span>
          <div class="celdas" aria-hidden="true">
            {#each celdas as on, k (k)}
              <span class="celda" class:on></span>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
.linea {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tit {
  font-size: 12px;
  font-weight: 600;
}
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
}
.scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}
.fila {
  display: flex;
  align-items: center;
  gap: 6px;
}
.etq {
  min-width: 2.5em;
  text-align: right;
  font-size: 11px;
  color: var(--gris);
}
.celdas {
  display: grid;
  grid-template-columns: repeat(200, 3px);
  gap: 0;
}
.celda {
  width: 3px;
  height: 10px;
  background: var(--borde);
}
.celda.on {
  background: var(--acento);
}
</style>
