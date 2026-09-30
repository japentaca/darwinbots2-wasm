<script>
// @ts-check
// Guardar el borrador como escenario propio: nombre, descripción y
// etiquetas (separadas por comas). Con `reemplazable`, se puede elegir
// reemplazar el propio del que salió el borrador en vez de crear otro.
import { t } from '../../i18n/index.svelte.js';
import Dialogo from '../observar/Dialogo.svelte';
import { parsearEtiquetas } from './archivo.js';

/**
 * @type {{
 *   abierto: boolean,
 *   nombreInicial: string,
 *   descripcionInicial: string,
 *   etiquetasIniciales: string[],
 *   reemplazable: string,
 *   errores: string[],
 *   onGuardar: (m: { nombre: string, descripcion: string, etiquetas: string[],
 *     reemplazar: boolean }) => void,
 * }}
 */
let {
  abierto = $bindable(false),
  nombreInicial,
  descripcionInicial,
  etiquetasIniciales,
  reemplazable,
  errores,
  onGuardar,
} = $props();

let nombre = $state('');
let descripcion = $state('');
let etiquetas = $state('');
let reemplazar = $state(false);

$effect(() => {
  if (!abierto) return;
  nombre = nombreInicial;
  descripcion = descripcionInicial;
  etiquetas = etiquetasIniciales.join(', ');
  reemplazar = reemplazable !== '';
});

const valido = $derived(nombre.trim() !== '');
const textoReemplazar = $derived(t('experimentar.guardar.reemplazar', { nombre: reemplazable }));

function guardar() {
  if (!valido) return;
  onGuardar({
    nombre: nombre.trim(),
    descripcion: descripcion.trim(),
    etiquetas: parsearEtiquetas(etiquetas),
    reemplazar: reemplazable !== '' && reemplazar,
  });
}
</script>

<Dialogo bind:abierto titulo={t('experimentar.guardar.titulo')} ancho={480}>
  <label class="campo"
    >{t('experimentar.guardar.nombre')}
    <input class="txt" type="text" bind:value={nombre} maxlength="80"></label
  >
  <label class="campo"
    >{t('experimentar.guardar.descripcion')}
    <textarea class="txt" rows="3" bind:value={descripcion} maxlength="400"></textarea></label
  >
  <label class="campo"
    >{t('experimentar.guardar.etiquetas')}
    <input
      class="txt"
      type="text"
      bind:value={etiquetas}
      placeholder={t('experimentar.guardar.etiquetas.placeholder')}
    ></label
  >
  {#if reemplazable}
    <label class="check"><input type="checkbox" bind:checked={reemplazar}>{textoReemplazar}</label>
  {/if}
  {#if errores.length}
    <ul class="errores" role="alert">
      {#each errores as e, i (i)}
        <li>{e}</li>
      {/each}
    </ul>
  {/if}
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (abierto = false)}>
      {t('experimentar.cancelar')}
    </button>
    <button class="btn pri" type="button" disabled={!valido} onclick={guardar}>
      {t('experimentar.guardar.aceptar')}
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
  box-sizing: border-box;
  width: 100%;
}
textarea.txt {
  resize: vertical;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.errores {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #9b2c1f;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
