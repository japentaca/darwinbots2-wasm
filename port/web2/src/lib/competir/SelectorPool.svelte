<script>
// @ts-check
// Pool de sorteo (lgPool): toda la Biblioteca, favoritos, la selección de
// la Biblioteca, un tag o una selección con nombre.
import { todosLosTags } from '../../../engine/biblioteca.js';
import { t } from '../../i18n/index.svelte.js';
import { bib, ui } from '../bots/biblioteca.svelte.js';
import { nombrePool } from './textos.js';

/** @type {{ valor: string, onCambio: (p: string) => void, disabled?: boolean, etiqueta?: string }} */
let { valor, onCambio, disabled = false, etiqueta = '' } = $props();

const tr = { t, num: (/** @type {number} */ n) => String(n) };
const opciones = $derived([
  'all',
  'fav',
  ...(ui.sel.size || valor === 'sel' ? ['sel'] : []),
  ...todosLosTags(bib.indice).map(([g]) => `tag:${g}`),
  ...bib.selecciones.map((s) => `set:${s.nombre}`),
]);
// un pool guardado que ya no existe (un tag borrado) se sigue mostrando
const lista = $derived(!valor || opciones.includes(valor) ? opciones : [...opciones, valor]);
</script>

<select
  class="sel"
  value={valor}
  {disabled}
  aria-label={etiqueta || t('competir.pool.titulo')}
  onchange={(e) => onCambio(e.currentTarget.value)}
>
  {#each lista as p (p)}
    <option value={p}>{nombrePool(p, tr)}</option>
  {/each}
</select>

<style>
.sel {
  font: inherit;
  font-size: 13px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--campo);
  max-width: 100%;
}
</style>
