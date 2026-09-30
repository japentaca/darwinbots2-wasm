<script>
// @ts-check
// Datos de un bot propio: nuevo (nombre, vegetal, descripción y ADN) o
// editar (nombre, vegetal y descripción; el ADN se edita en la pestaña
// ADN). `onAceptar` devuelve true si el diálogo se puede cerrar.
import { t } from '../../i18n/index.svelte.js';
import Dialogo from '../observar/Dialogo.svelte';
import { ADN_NUEVO } from './adn.js';

/**
 * @typedef {{nombre: string, vegetal: boolean, descripcion: string, adn: string}} DatosBot
 * @type {{
 *   abierto: boolean,
 *   modo: 'nuevo' | 'editar',
 *   inicial?: Partial<DatosBot>,
 *   onAceptar: (d: DatosBot) => Promise<boolean> | boolean,
 * }}
 */
let { abierto = $bindable(false), modo, inicial = {}, onAceptar } = $props();

let nombre = $state('');
let vegetal = $state(false);
let descripcion = $state('');
let adn = $state('');
let ocupado = $state(false);

$effect(() => {
  if (!abierto) return;
  nombre = inicial.nombre ?? '';
  vegetal = !!inicial.vegetal;
  descripcion = inicial.descripcion ?? '';
  adn = inicial.adn ?? ADN_NUEVO;
});

const valido = $derived(nombre.trim() !== '' && (modo === 'editar' || adn.trim() !== ''));

async function ok() {
  if (!valido || ocupado) return;
  ocupado = true;
  try {
    if (await onAceptar({ nombre: nombre.trim(), vegetal, descripcion: descripcion.trim(), adn }))
      abierto = false;
  } finally {
    ocupado = false;
  }
}
</script>

<Dialogo
  bind:abierto
  titulo={modo === 'nuevo' ? t('bots.datos.tituloNuevo') : t('bots.datos.tituloEditar')}
  ancho={560}
>
  <label class="campo"
    >{t('bots.datos.nombre')}
    <input class="txt" type="text" maxlength="80" bind:value={nombre}></label
  >
  <label class="tgl"><input type="checkbox" bind:checked={vegetal}>{t('bots.datos.vegetal')}</label>
  <label class="campo"
    >{t('bots.datos.descripcion')}
    <textarea class="txt area" rows="3" bind:value={descripcion}></textarea></label
  >
  {#if modo === 'nuevo'}
    <label class="campo"
      >{t('bots.datos.adn')}
      <textarea
        class="txt area mono"
        rows="8"
        spellcheck="false"
        bind:value={adn}
      ></textarea></label
    >
    <p class="help">{t('bots.datos.adnAyuda')}</p>
  {/if}
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (abierto = false)}>
      {t('bots.cancelar')}
    </button>
    <button class="btn pri" type="button" disabled={!valido || ocupado} onclick={ok}>
      {modo === 'nuevo' ? t('bots.datos.crear') : t('bots.datos.guardar')}
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
  min-height: 36px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 10px;
  color: var(--texto);
}
.area {
  padding: 8px 10px;
  resize: vertical;
}
.area.mono {
  font-family: var(--mono);
  font-size: 12.5px;
}
.tgl {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.tgl input {
  width: 16px;
  height: 16px;
  accent-color: var(--acento);
  margin: 0;
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
