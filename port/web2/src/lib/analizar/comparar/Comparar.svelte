<script>
// @ts-check
// Pestaña Comparar de Analizar (decisión 10, Niveles 2 y 4): tres sub-vistas.
//   «Dos corridas»  gráficos superpuestos de una métrica con sus bandas y
//                   la tabla de diferencias de configuración.
//   «Réplicas»      N semillas del mismo escenario en la cola de trabajos
//                   (src/lib/trabajos/), con media, banda p10–p90 y tabla.
//   «Barrido»       un parámetro en k valores × N semillas en la misma cola:
//                   valor final contra el valor del parámetro (Nivel 4).
// `corrida` es la fuente que mira Analizar (src/lib/analizar/fuente.js): es
// la corrida A por defecto y el origen por defecto de las réplicas. La cola
// de trabajos ya arrancó con la app (src/main.js).
import { onMount } from 'svelte';
import { t } from '../../../i18n/index.svelte.js';
import { actual, corridasGuardadas } from '../../sim/corrida.svelte.js';
import Barrido from './Barrido.svelte';
import DosCorridas from './DosCorridas.svelte';
import { fuenteActual, fuenteGuardada, ID_ACTUAL } from './fuentes.js';
import Replicas from './Replicas.svelte';

/** @type {{ corrida: import('../fuente.js').FuenteAnalisis | null }} */
let { corrida } = $props();

let vista = $state(/** @type {'dos' | 'replicas' | 'barrido'} */ ('dos'));
/** @type {import('../../../../engine/corridas.js').Corrida[]} */
let guardadas = $state.raw([]);

onMount(() => {
  corridasGuardadas()
    .listar()
    .then((l) => {
      guardadas = l;
    })
    .catch(() => {
      guardadas = [];
    });
});

const opciones = $derived([
  ...(actual.corrida ? [{ id: ID_ACTUAL, nombre: t('comparar.actual') }] : []),
  ...guardadas.map((c) => ({
    id: /** @type {string} */ (c.id),
    nombre: c.nombre || t('comparar.sinNombre'),
  })),
]);

// Cambia cuando la corrida actual suma eventos o arranca otra sim: la
// fuente «actual» de Dos corridas se vuelve a leer.
const versionActual = $derived.by(() => {
  const c = actual.corrida;
  if (!c) return null;
  const e = c.estado;
  return [c, e.eventos, e.escenario, e.semilla, e.nombre];
});

const inicial = $derived(
  corrida?.tipo === 'actual' ? ID_ACTUAL : (corrida?.id ?? opciones[0]?.id ?? ''),
);

/**
 * La corrida elegida con su escenario, eventos e historia.
 * @param {string} id
 * @returns {Promise<import('./fuentes.js').Fuente | null>}
 */
function cargar(id) {
  if (id === ID_ACTUAL) return Promise.resolve(fuenteActual(actual.corrida, t('comparar.actual')));
  return fuenteGuardada(corridasGuardadas(), id);
}
</script>

<div class="comparar">
  <div class="seg" role="tablist">
    <button
      type="button"
      role="tab"
      aria-selected={vista === 'dos'}
      class:on={vista === 'dos'}
      onclick={() => (vista = 'dos')}
    >
      {t('comparar.vista.dos')}
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={vista === 'replicas'}
      class:on={vista === 'replicas'}
      onclick={() => (vista = 'replicas')}
    >
      {t('comparar.vista.replicas')}
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={vista === 'barrido'}
      class:on={vista === 'barrido'}
      onclick={() => (vista = 'barrido')}
    >
      {t('comparar.vista.barrido')}
    </button>
  </div>

  {#if !opciones.length}
    <p class="card vacia">{t('comparar.sinCorridas')}</p>
  {:else if vista === 'dos'}
    <DosCorridas {opciones} {inicial} {cargar} {versionActual} />
  {:else if vista === 'replicas'}
    <Replicas {opciones} {inicial} {cargar} />
  {:else}
    <Barrido {opciones} {inicial} {cargar} />
  {/if}
</div>

<style>
.comparar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.seg {
  align-self: flex-start;
}
.vacia {
  padding: 24px;
  margin: 0;
  font-size: 14px;
  color: var(--gris-claro);
}
</style>
