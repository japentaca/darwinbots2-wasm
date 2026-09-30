<script>
// @ts-check
// Confirmación de Bots (bib.confirmacion, ver confirmar() en
// biblioteca.svelte.js): borrar, usar un nombre del foro…
import { t } from '../../i18n/index.svelte.js';
import Dialogo from '../observar/Dialogo.svelte';
import { bib } from './biblioteca.svelte.js';

/** Cerrar con Esc o el fondo cuenta como «no». @param {boolean} v */
function poner(v) {
  if (!v) bib.confirmacion?.resolver(false);
}
</script>

<Dialogo bind:abierto={() => !!bib.confirmacion, poner} titulo={t('bots.confirmar.titulo')}>
  {#if bib.confirmacion}
    <p class="texto">{t(bib.confirmacion.texto.clave, bib.confirmacion.texto.params)}</p>
  {/if}
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => bib.confirmacion?.resolver(false)}>
      {t('bots.cancelar')}
    </button>
    <button class="btn pri" type="button" onclick={() => bib.confirmacion?.resolver(true)}>
      {bib.confirmacion ? t(bib.confirmacion.confirmar.clave, bib.confirmacion.confirmar.params) : ''}
    </button>
  {/snippet}
</Dialogo>

<style>
.texto {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}
</style>
