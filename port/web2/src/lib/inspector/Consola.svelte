<script>
// @ts-check
// Pestaña Consola: la consola del bot del motor (console/console-cmd →
// console-out). La salida y el historial viven en el inspector, así no se
// pierden al cambiar de pestaña. Los comandos no se traducen.
import { tick } from 'svelte';
import { t } from '../../i18n/index.svelte.js';

/**
 * @type {{
 *   texto: string,
 *   vivo: boolean,
 *   historial: import('./consola.js').HistorialComandos,
 *   onComando: (linea: string) => void,
 * }}
 */
let { texto, vivo, historial, onComando } = $props();

/** Atajos (comandos del motor, sin traducir). */
const ATAJOS = ['printeye', 'printtouch', 'printtaste', 'debug', 'help'];

let entrada = $state('');
/** @type {HTMLPreElement | undefined} */
let caja = $state();

// La salida sigue al final.
$effect(() => {
  texto;
  tick().then(() => {
    if (caja) caja.scrollTop = caja.scrollHeight;
  });
});

/** @param {SubmitEvent} e */
function enviar(e) {
  e.preventDefault();
  if (!entrada.trim()) return;
  onComando(entrada);
  entrada = '';
}

/** @param {KeyboardEvent} e */
function teclas(e) {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    entrada = historial.anterior();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    entrada = historial.siguiente();
  }
}
</script>

<div class="atajos">
  {#each ATAJOS as a (a)}
    <button
      class="btn mini mono"
      type="button"
      disabled={!vivo && a !== 'help'}
      onclick={() => onComando(a)}
    >
      {a}
    </button>
  {/each}
  <button class="btn mini" type="button" onclick={() => onComando('clear')}>
    {t('inspector.consola.limpiar')}
  </button>
</div>

<pre
  class="mono salida"
  bind:this={caja}
  role="log"
  aria-label={t('inspector.consola.aria')}
>{texto}</pre>

<form class="linea" onsubmit={enviar}>
  <input
    class="mono"
    type="text"
    bind:value={entrada}
    onkeydown={teclas}
    placeholder={t('inspector.consola.placeholder')}
    aria-label={t('inspector.consola.entrada')}
    spellcheck="false"
    autocomplete="off"
  >
  <button class="btn chico" type="submit">{t('inspector.consola.enviar')}</button>
</form>

<style>
.atajos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mini {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.salida {
  margin: 0;
  min-height: 240px;
  max-height: 50vh;
  overflow: auto;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--mundo);
  color: #d8d6ce;
  border-radius: var(--radio);
}
.linea {
  display: flex;
  gap: 8px;
}
.linea input {
  flex: 1;
  min-width: 0;
  height: 36px;
  font-size: 13px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 10px;
  color: var(--texto);
}
.chico {
  height: 36px;
  padding: 0 12px;
}
</style>
