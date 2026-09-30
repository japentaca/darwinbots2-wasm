<script>
// @ts-check
// Aviso descartable con lo que se importó de la clásica (decisión 17).
import { t } from '../../i18n/index.svelte.js';
import { descartarAviso, migracion } from './migracion.svelte.js';
import { lineasMigracion } from './textos.js';

const lineas = $derived(migracion.resumen ? lineasMigracion(migracion.resumen) : []);
</script>

{#if migracion.visible && migracion.resumen}
  <div class="aviso" role="status">
    <div class="txt">
      <strong>{t('bots.migracion.titulo')}</strong>
      <ul>
        {#each lineas as l, i (i)}
          <li>{t(l.clave, l.params)}</li>
        {/each}
      </ul>
    </div>
    <button class="cerrar" type="button" aria-label={t('bots.cerrar')} onclick={descartarAviso}>
      ×
    </button>
  </div>
{/if}

<style>
.aviso {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 13px;
  line-height: 1.45;
}
.txt {
  flex: 1;
}
ul {
  margin: 4px 0 0;
  padding-left: 18px;
}
.cerrar {
  font: inherit;
  font-size: 18px;
  line-height: 1;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
</style>
