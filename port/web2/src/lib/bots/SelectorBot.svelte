<script>
// @ts-check
// Selector de un bot de la biblioteca (foro y propios), con búsqueda; lo
// usan los diálogos de siembra de Observar y de especie de Experimentar.
// Carga la biblioteca si hace falta (asegurarBiblioteca); la búsqueda está
// en ./selector.js.
import { onMount } from 'svelte';
import { num, t } from '../../i18n/index.svelte.js';
import { asegurarBiblioteca, bib } from './biblioteca.svelte.js';
import { buscarBots } from './selector.js';

/**
 * @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada
 * @type {{
 *   onElegir: (e: Entrada) => void,
 *   elegida?: Entrada | null,
 *   etiqueta?: string,
 * }}
 */
let { onElegir, elegida = null, etiqueta = '' } = $props();

const uid = $props.id();
let q = $state('');

const res = $derived(buscarBots(bib.indice, q));

onMount(() => {
  asegurarBiblioteca();
});

/** @param {Entrada} e */
function detalle(e) {
  /** @type {string[]} */
  const p = [e.clase === 'propio' ? t('bots.selector.propio') : (e.foro ?? '')];
  if (e.vegetal) p.push(t('bots.vegetal'));
  return p.filter(Boolean).join(' · ');
}
</script>

<div class="selector">
  <label class="campo" for="{uid}-q">{etiqueta || t('bots.selector.etiqueta')}</label>
  <input
    id="{uid}-q"
    class="txt"
    type="search"
    placeholder={t('bots.selector.buscar')}
    aria-controls="{uid}-lista"
    bind:value={q}
  >
  {#if !bib.listo}
    <p class="nota" role={bib.error ? 'alert' : 'status'}>
      {bib.error ? t(bib.error.clave, bib.error.params) : t('bots.cargando')}
    </p>
  {:else}
    <ul id="{uid}-lista" class="lista" aria-label={t('bots.selector.resultados')}>
      {#each res.lista as e (e.id)}
        <li>
          <button
            type="button"
            class="op"
            class:on={elegida?.id === e.id}
            aria-pressed={elegida?.id === e.id}
            onclick={() => onElegir(e)}
          >
            <span class="n1">{e.marcas.fav ? '★ ' : ''}{e.nombre}</span>
            <span class="n2">{detalle(e)}</span>
          </button>
        </li>
      {:else}
        <li class="nota">{t('bots.ninguno')}</li>
      {/each}
    </ul>
    <p class="nota" aria-live="polite">
      {res.total > res.lista.length
  ? t('bots.selector.algunos', { n: num(res.lista.length), total: num(res.total) })
  : t('bots.selector.todos', { n: num(res.total) })}
    </p>
  {/if}
</div>

<style>
.selector {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.campo {
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
.lista {
  list-style: none;
  margin: 0;
  padding: 2px;
  max-height: 190px;
  overflow: auto;
  border: 1px solid var(--borde);
  border-radius: 6px;
  background: var(--tarjeta);
}
.op {
  font: inherit;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  text-align: left;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--texto);
  padding: 5px 8px;
  cursor: pointer;
}
.op:hover {
  background: var(--hover-claro);
}
.op.on {
  background: var(--chip);
  box-shadow: inset 3px 0 0 var(--acento);
}
.n1 {
  font-size: 14px;
}
.n2 {
  font-size: 12px;
  color: var(--gris-claro);
}
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
  padding: 4px 8px;
}
</style>
