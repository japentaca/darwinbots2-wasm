<script>
// @ts-check
// Tarjeta «Familia» del inspector: lo que devuelve 'family' (descendientes
// y resaltados en el mundo) más los parientes vivos del frame, con enlaces
// que los seleccionan.
import { num, t } from '../../i18n/index.svelte.js';

/**
 * @type {{
 *   familia: { total: number, resaltados: number } | null,
 *   rel: import('./datos.js').Parientes | null,
 *   onIr: (slot: number) => void,
 *   onCerrar: () => void,
 * }}
 */
let { familia, rel, onIr, onCerrar } = $props();

/** Enlaces que se muestran por lista antes de «y N más». */
const TOPE = 12;
</script>

{#snippet lista(
  /** @type {import('./datos.js').Pariente[]} */ ps,
)}
  {#if ps.length === 0}
    <span class="nada">{t('inspector.familia.ninguno')}</span>
  {:else}
    {#each ps.slice(0, TOPE) as p (p.abs)}
      {#if p.slot}
        <button
          type="button"
          class="enlace"
          title={t('inspector.linaje.ir', { n: p.abs })}
          onclick={() => onIr(p.slot)}
        >
          #{p.abs}
        </button>
      {:else}
        <span class="mono" title={t('inspector.linaje.noVive')}>#{p.abs}</span>
      {/if}
    {/each}
    {#if ps.length > TOPE}
      <span class="nada">{t('inspector.familia.mas', { n: num(ps.length - TOPE) })}</span>
    {/if}
  {/if}
{/snippet}

<div class="card familia">
  <div class="enc">
    <span class="tit">{t('inspector.familia.titulo')}</span>
    <button type="button" class="btn chico" onclick={onCerrar}>
      {t('inspector.familia.quitar')}
    </button>
  </div>
  <p class="resumen">
    {#if familia}
      {t('inspector.familia.descendientes', {
  n: num(familia.total),
  m: num(familia.resaltados),
})}
    {:else}
      {t('inspector.familia.cargando')}
    {/if}
  </p>
  {#if rel}
    <dl>
      <dt>{t('inspector.familia.madre')}</dt>
      <dd>{@render lista(rel.madre ? [rel.madre] : [])}</dd>
      <dt>{t('inspector.familia.hijos')}</dt>
      <dd>{@render lista(rel.hijos)}</dd>
      <dt>{t('inspector.familia.ancestros')}</dt>
      <dd>{@render lista(rel.ancestros)}</dd>
    </dl>
  {/if}
</div>

<style>
.familia {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}
.enc {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.tit {
  font-weight: 600;
}
.chico {
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
}
.resumen {
  margin: 0;
  color: var(--gris);
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin: 0;
}
dt {
  color: var(--gris-claro);
}
dd {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.nada {
  color: var(--gris-claro);
}
.enlace {
  font: inherit;
  font-family: var(--mono);
  border: 0;
  padding: 0;
  background: none;
  color: var(--acento);
  text-decoration: underline;
  cursor: pointer;
}
.enlace:hover {
  color: var(--acento-hover);
}
</style>
