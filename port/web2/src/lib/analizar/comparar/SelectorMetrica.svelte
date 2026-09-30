<script>
// @ts-check
// Grupo (los seis de la decisión 7) y métrica global a graficar. Los
// nombres son los del catálogo de Analizar (analizar.grupo.*, analizar.m.g.*).
import { GRUPOS_COMPARAR, grupoDe } from '../../../../engine/replicas.js';
import { t } from '../../../i18n/index.svelte.js';

/** @type {{ metrica: string }} */
let { metrica = $bindable('vivos') } = $props();

const uid = $props.id();
const grupo = $derived(grupoDe(metrica) ?? 'poblacion');

/** @param {string} g */
function elegirGrupo(g) {
  metrica = GRUPOS_COMPARAR[g][0];
}
</script>

<div class="selector">
  <label for={`${uid}-g`}>{t('comparar.grupo')}</label>
  <select
    id={`${uid}-g`}
    value={grupo}
    onchange={(e) => elegirGrupo(/** @type {HTMLSelectElement} */ (e.currentTarget).value)}
  >
    {#each Object.keys(GRUPOS_COMPARAR) as g (g)}
      <option value={g}>{t(`analizar.grupo.${g}`)}</option>
    {/each}
  </select>
  <label for={`${uid}-m`}>{t('comparar.metrica')}</label>
  <select id={`${uid}-m`} bind:value={metrica}>
    {#each GRUPOS_COMPARAR[grupo] as m (m)}
      <option value={m}>{t(`analizar.m.g.${m}`)}</option>
    {/each}
  </select>
</div>

<style>
.selector {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
select {
  font: inherit;
  height: 34px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
}
</style>
