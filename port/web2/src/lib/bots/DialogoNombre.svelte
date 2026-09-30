<script>
// @ts-check
// Pide un nombre (guardar la selección, duplicar un bot). `onAceptar`
// devuelve true si el diálogo se puede cerrar.
import { t } from '../../i18n/index.svelte.js';
import Dialogo from '../observar/Dialogo.svelte';

/**
 * @type {{
 *   abierto: boolean,
 *   titulo: string,
 *   etiqueta: string,
 *   ayuda?: string,
 *   inicial?: string,
 *   vacioOk?: boolean,
 *   aceptar: string,
 *   onAceptar: (nombre: string) => Promise<boolean> | boolean,
 * }}
 */
let {
  abierto = $bindable(false),
  titulo,
  etiqueta,
  ayuda = '',
  inicial = '',
  vacioOk = false,
  aceptar,
  onAceptar,
} = $props();

let nombre = $state('');
let ocupado = $state(false);

$effect(() => {
  if (abierto) nombre = inicial;
});

const valido = $derived(vacioOk || nombre.trim() !== '');

async function ok() {
  if (!valido || ocupado) return;
  ocupado = true;
  try {
    if (await onAceptar(nombre.trim())) abierto = false;
  } finally {
    ocupado = false;
  }
}
</script>

<Dialogo bind:abierto {titulo}>
  <label class="campo"
    >{etiqueta}
    <input
      class="txt"
      type="text"
      maxlength="80"
      bind:value={nombre}
      onkeydown={(e) => {
  if (e.key === 'Enter') ok();
}}
    ></label
  >
  {#if ayuda}
    <p class="help">{ayuda}</p>
  {/if}
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (abierto = false)}>
      {t('bots.cancelar')}
    </button>
    <button class="btn pri" type="button" disabled={!valido || ocupado} onclick={ok}>
      {aceptar}
    </button>
  {/snippet}
</Dialogo>

<style>
.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--gris);
}
.txt {
  font: inherit;
  font-size: 14px;
  height: 36px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 10px;
  color: var(--texto);
}
.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
