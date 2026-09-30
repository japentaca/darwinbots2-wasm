<script>
// @ts-check
// Corridas guardadas (menú mínimo de Observar; la lista completa vive en
// Inicio): retomar, borrar y abrir un .dbsim desde un archivo.
import { idioma, num, t } from '../../i18n/index.svelte.js';
import Dialogo from './Dialogo.svelte';
import { avisoDeError } from './errores.js';

/**
 * @type {{
 *   abierto: boolean,
 *   idActual: string | null,
 *   listar: () => Promise<import('../../../engine/corridas.js').Corrida[]>,
 *   onCargar: (id: string) => void,
 *   onBorrar: (id: string) => Promise<void>,
 *   onArchivo: (f: File) => void,
 * }}
 */
let { abierto = $bindable(false), idActual, listar, onCargar, onBorrar, onArchivo } = $props();

/** @type {import('../../../engine/corridas.js').Corrida[]} */
let lista = $state.raw([]);
let cargando = $state(false);
/** @type {{ clave: string, params?: Record<string, any> } | null} fallo de IndexedDB */
let fallo = $state.raw(null);
/** @type {HTMLInputElement} */
let archivo;

async function refrescar() {
  cargando = true;
  try {
    lista = await listar();
    fallo = null;
  } catch (e) {
    lista = [];
    fallo = avisoDeError(e);
  } finally {
    cargando = false;
  }
}

$effect(() => {
  if (abierto) refrescar();
});

/** @param {string | undefined} iso */
function fecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(idioma(), { dateStyle: 'short', timeStyle: 'short' });
}

/** @param {import('../../../engine/corridas.js').Corrida} c */
async function borrar(c) {
  if (!confirm(t('observar.corridas.borrar.confirmar', { nombre: c.nombre }))) return;
  try {
    await onBorrar(/** @type {string} */ (c.id));
  } catch (e) {
    fallo = avisoDeError(e);
    return;
  }
  await refrescar();
}
</script>

<Dialogo bind:abierto titulo={t('observar.corridas.titulo')} ancho={560}>
  {#if fallo}
    <p class="fallo" role="alert">
      {t('observar.corridas.fallo')}
      {t(fallo.clave, fallo.params)}
    </p>
  {:else if !cargando && !lista.length}
    <p class="vacio">{t('observar.corridas.vacio')}</p>
  {/if}
  <ul>
    {#each lista as c (c.id)}
      <li>
        {#if c.miniatura}
          <img src={c.miniatura} alt={t('observar.corridas.miniatura', { nombre: c.nombre })}>
        {:else}
          <span class="sinimg"></span>
        {/if}
        <div class="info">
          <b>{c.nombre}</b>
          {#if c.id === idActual}
            <span class="chip">{t('observar.corridas.actual')}</span>
          {/if}
          <span class="det mono"
            >{t('observar.corridas.detalle', { ciclo: num(c.ciclo), bots: num(c.bots), fecha: fecha(c.fecha) })}</span
          >
        </div>
        <button
          class="btn pri"
          type="button"
          onclick={() => {
  onCargar(/** @type {string} */ (c.id));
  abierto = false;
}}
        >
          {t('observar.corridas.cargar')}
        </button>
        <button class="btn" type="button" onclick={() => borrar(c)}>
          {t('observar.corridas.borrar')}
        </button>
      </li>
    {/each}
  </ul>
  <input
    bind:this={archivo}
    class="oculto"
    type="file"
    accept=".dbsim,application/octet-stream"
    onchange={(e) => {
  const f = e.currentTarget.files?.[0];
  e.currentTarget.value = '';
  if (f) {
    onArchivo(f);
    abierto = false;
  }
}}
  >
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => archivo.click()}>
      {t('observar.corridas.abrir')}
    </button>
    <button class="btn" type="button" onclick={() => (abierto = false)}>
      {t('observar.cerrar')}
    </button>
  {/snippet}
</Dialogo>

<style>
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 60dvh;
  overflow: auto;
}
li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid var(--borde);
  border-radius: 8px;
  background: var(--tarjeta);
}
img,
.sinimg {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--mundo);
  flex-shrink: 0;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip {
  align-self: flex-start;
}
.det {
  font-size: 11px;
  color: var(--gris-claro);
}
.fallo {
  margin: 0;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #d9a39a;
  background: #fbeeec;
}
.vacio {
  margin: 0;
  color: var(--gris-claro);
  font-size: 14px;
}
.oculto {
  display: none;
}
</style>
