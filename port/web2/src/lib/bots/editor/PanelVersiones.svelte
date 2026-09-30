<script>
// @ts-check
// Versiones de un bot propio (decisión 18): la lista con su nota, el diff
// gen por gen entre dos (engine/bots.js diffVersiones) y restaurar una
// anterior (se guarda como versión nueva: no se pierde la historia).
import { t } from '../../../i18n/index.svelte.js';

/**
 * @type {{versiones: import('../../../../engine/bots.js').Version[], soloLectura?: boolean,
 *   onrestaurar: (n: number) => void, oncomparar: (a: number, b: number) => void}}
 */
let { versiones, soloLectura = false, onrestaurar, oncomparar } = $props();

const orden = $derived([...versiones].reverse());
const ultima = $derived(versiones[versiones.length - 1]?.n ?? 0);
let a = $state(0);
let b = $state(0);
$effect(() => {
  // por defecto: la anterior contra la última
  const n = versiones.length;
  if (!versiones.some((v) => v.n === a)) a = versiones[Math.max(0, n - 2)]?.n ?? 0;
  if (!versiones.some((v) => v.n === b)) b = versiones[n - 1]?.n ?? 0;
});

/** @param {string} iso */
const fecha = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(+d)
    ? iso
    : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
};
</script>

<section class="card panel" aria-label={t('editor.versiones.titulo')}>
  <span class="lbl">{t('editor.versiones.titulo')}</span>
  <ul class="lista">
    {#each orden as v (v.n)}
      <li>
        <span class="txt">
          <strong class="mono">v{v.n}</strong>
          {v.nota || t('editor.versiones.sinNota')}
        </span>
        <span class="der">
          <span class="help">{fecha(v.fecha)}</span>
          {#if v.n !== ultima && !soloLectura}
            <button
              type="button"
              class="btn sm"
              title={t('editor.versiones.restaurarAyuda', { n: v.n })}
              onclick={() => onrestaurar(v.n)}
            >
              {t('editor.versiones.restaurar')}
            </button>
          {/if}
        </span>
      </li>
    {/each}
  </ul>
  {#if versiones.length > 1}
    <div class="comparar">
      <select class="sel" bind:value={a} aria-label={t('editor.versiones.desde')}>
        {#each orden as v (v.n)}
          <option value={v.n}>v{v.n}</option>
        {/each}
      </select>
      <span aria-hidden="true">→</span>
      <select class="sel" bind:value={b} aria-label={t('editor.versiones.hasta')}>
        {#each orden as v (v.n)}
          <option value={v.n}>v{v.n}</option>
        {/each}
      </select>
      <button type="button" class="btn sm" disabled={a === b} onclick={() => oncomparar(a, b)}>
        {t('editor.versiones.comparar')}
      </button>
    </div>
  {/if}
</section>

<style>
.panel {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow: auto;
}
.lista li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  padding: 4px 0;
  border-top: 1px solid #ebe9e2;
}
.txt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.der {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}
.comparar {
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>
