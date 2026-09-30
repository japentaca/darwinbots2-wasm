<script>
// @ts-check
// Guardar la corrida en IndexedDB con un nombre (sobrescribiendo la que ya
// estaba guardada o como una nueva), o descargar el .dbsim.
import { t } from '../../i18n/index.svelte.js';
import Dialogo from './Dialogo.svelte';

/**
 * @type {{
 *   abierto: boolean,
 *   nombreInicial: string,
 *   ocupado: boolean,
 *   yaGuardada?: boolean,
 *   onGuardar: (nombre: string, comoNueva: boolean) => void,
 *   onDescargar: () => void,
 * }}
 */
let {
  abierto = $bindable(false),
  nombreInicial,
  ocupado,
  yaGuardada = false,
  onGuardar,
  onDescargar,
} = $props();

let nombre = $state('');

$effect(() => {
  if (abierto) nombre = nombreInicial;
});

/** @param {boolean} [comoNueva] */
function guardar(comoNueva = false) {
  if (ocupado || !nombre.trim()) return;
  onGuardar(nombre.trim(), comoNueva);
  abierto = false;
}
</script>

<Dialogo bind:abierto titulo={t('observar.guardar.titulo')}>
  <label class="campo"
    >{t('observar.guardar.nombre')}
    <input
      class="txt"
      type="text"
      bind:value={nombre}
      maxlength="80"
      onkeydown={(e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    guardar();
  }
}}
    ></label
  >
  <p class="nota">
    {yaGuardada ? t('observar.guardar.explicaGuardada') : t('observar.guardar.explica')}
  </p>
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (abierto = false)}>
      {t('observar.cancelar')}
    </button>
    <button
      class="btn"
      type="button"
      disabled={ocupado}
      onclick={() => {
  onDescargar();
  abierto = false;
}}
    >
      {t('observar.guardar.descargar')}
    </button>
    {#if yaGuardada}
      <button
        class="btn"
        type="button"
        title={t('observar.guardar.comoNueva.ayuda')}
        disabled={ocupado || !nombre.trim()}
        onclick={() => guardar(true)}
      >
        {t('observar.guardar.comoNueva')}
      </button>
    {/if}
    <button
      class="btn pri"
      type="button"
      disabled={ocupado || !nombre.trim()}
      onclick={() => guardar()}
    >
      {yaGuardada ? t('observar.guardar.sobrescribir') : t('observar.guardar.aceptar')}
    </button>
  {/snippet}
</Dialogo>

<style>
.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--gris);
}
.txt {
  font: inherit;
  font-size: 14px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  color: var(--texto);
  padding: 8px;
}
.nota {
  margin: 0;
  font-size: 13px;
  color: var(--gris-claro);
  line-height: 1.45;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
