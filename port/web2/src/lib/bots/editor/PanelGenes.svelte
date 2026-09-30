<script>
// @ts-check
// Panel «Genes» del editor (decisión 19; el Laboratorio de la clásica):
// busca en genes.json por capacidad (todo el Bestiary) o los genes de un
// bot, y los inserta en el ADN guardando su bot de origen. Los avisos de
// la mezcla (dependencias, colisiones, números de gen literales) son avisos
// del editor, con su arreglo.
import { buscarGenes } from '../../../../engine/lab.js';
import { t } from '../../../i18n/index.svelte.js';

/**
 * @type {{datos: {genes: import('../../../../engine/lab.js').GenesJson,
 *   perfiles: import('../../../../engine/biblioteca.js').Perfiles,
 *   bestiario: {file: string, name: string}[]},
 *   soloLectura?: boolean, oninsertar: (archivo: string, gen: number) => void}}
 */
let { datos, soloLectura = false, oninsertar } = $props();

const MAX = 200;
let modo = $state(/** @type {'cap' | 'bot'} */ ('cap'));
let cap = $state('veneno');
let botNombre = $state('');
let q = $state('');
let autonomos = $state(false);
/** @type {{archivo: string, gen: number} | null} */
let vista = $state(null);
const idLista = `genes-bots-${Math.random().toString(36).slice(2, 8)}`;

const caps = $derived(Object.keys(datos.perfiles.caps ?? {}));
const archivoBot = $derived(datos.bestiario.find((b) => b.name === botNombre.trim())?.file ?? '');
const filas = $derived(
  buscarGenes(datos, { modo, cap, archivo: archivoBot, q: modo === 'cap' ? q : '', autonomos }),
);
const textoVista = $derived(vista ? (datos.genes.bots[vista.archivo]?.[vista.gen]?.t ?? '') : '');
/** @param {string} k */
const nombreCap = (k) => {
  const s = t(`editor.cap.${k}`);
  return s === `editor.cap.${k}` ? k : s;
};
</script>

<section class="card panel" aria-label={t('editor.lab.titulo')}>
  <div class="cab">
    <span class="lbl">{t('editor.lab.titulo')}</span>
    <span class="help">{t('editor.lab.bots', { n: Object.keys(datos.genes.bots).length })}</span>
  </div>
  <div class="fila">
    <select class="sel" bind:value={modo} aria-label={t('editor.lab.modo')}>
      <option value="cap">{t('editor.lab.porCapacidad')}</option>
      <option value="bot">{t('editor.lab.porBot')}</option>
    </select>
    {#if modo === 'cap'}
      <select class="sel crece" bind:value={cap} aria-label={t('editor.lab.capacidad')}>
        {#each caps as k (k)}
          <option value={k}>{nombreCap(k)}</option>
        {/each}
      </select>
    {/if}
  </div>
  <div class="fila">
    {#if modo === 'cap'}
      <input
        class="sel crece"
        type="search"
        bind:value={q}
        placeholder={t('editor.lab.filtrarBot')}
        aria-label={t('editor.lab.filtrarBot')}
      >
    {:else}
      <input
        class="sel crece"
        type="search"
        list={idLista}
        bind:value={botNombre}
        placeholder={t('editor.lab.elegirBot')}
        aria-label={t('editor.lab.elegirBot')}
      >
      <datalist id={idLista}>
        {#each datos.bestiario as b (b.file)}
          <option value={b.name}></option>
        {/each}
      </datalist>
    {/if}
  </div>
  <label class="chk" title={t('editor.lab.autonomosAyuda')}>
    <input type="checkbox" bind:checked={autonomos}>
    {t('editor.lab.autonomos')}
  </label>
  <span class="help">
    {filas.length > MAX
  ? t('editor.lab.cuantosMax', { n: filas.length, max: MAX })
  : t('editor.lab.cuantos', { n: filas.length })}
  </span>
  <ul class="lista">
    {#each filas.slice(0, MAX) as g (`${g.archivo}#${g.gen}`)}
      <li class="gi">
        <button
          type="button"
          class="ver"
          onclick={() => {
  vista = vista?.archivo === g.archivo && vista.gen === g.gen ? null : g;
}}
          aria-label={t('editor.lab.verCodigoDe', { bot: g.nombre, gen: g.gen + 1 })}
          aria-expanded={vista?.archivo === g.archivo && vista.gen === g.gen}
        >
          <span class="n">{t('editor.lab.genDe', { bot: g.nombre, gen: g.gen + 1 })}</span>
          <span class="help">
            {t('editor.lab.palabras', { n: g.palabras })}
            {#if g.memoria}
              · {t('editor.lab.memoria')}
            {/if}
            {#if g.caps.length}
              · {g.caps.map(nombreCap).join(', ')}
            {/if}
          </span>
        </button>
        <button
          type="button"
          class="add"
          disabled={soloLectura}
          aria-label={t('editor.lab.agregarDe', { bot: g.nombre, gen: g.gen + 1 })}
          title={t('editor.lab.agregar')}
          onclick={() => oninsertar(g.archivo, g.gen)}
        >
          +
        </button>
      </li>
    {:else}
      <li class="help vacio">{t('editor.lab.ninguno')}</li>
    {/each}
  </ul>
  {#if vista}
    <div class="vista">
      <div class="cab">
        <span class="n">
          {t('editor.lab.genDe', {
  bot: datos.bestiario.find((b) => b.file === vista?.archivo)?.name ?? vista.archivo,
  gen: vista.gen + 1,
})}
        </span>
        <button type="button" class="btn sm" onclick={() => (vista = null)}>
          {t('editor.cerrar')}
        </button>
      </div>
      <pre class="mono">{textoVista}</pre>
    </div>
  {/if}
  <span class="help">{t('editor.lab.ayuda')}</span>
</section>

<style>
.panel {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.fila {
  display: flex;
  gap: 6px;
}
.crece {
  flex: 1;
  min-width: 0;
}
.chk {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  min-height: 80px;
  flex: 1;
  border-top: 1px solid #ebe9e2;
}
.gi {
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid #ebe9e2;
}
.ver {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  text-align: left;
  background: none;
  border: 0;
  padding: 6px 2px;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.ver:hover {
  background: var(--hover-claro);
}
.n {
  font-weight: 500;
  font-size: 13px;
}
.add {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--borde-control);
  background: #fff;
  cursor: pointer;
  font-size: 15px;
}
.vista pre {
  margin: 4px 0 0;
  max-height: 180px;
  overflow: auto;
  font-size: 12px;
  background: #fff;
  border: 1px solid var(--borde);
  border-radius: 6px;
  padding: 6px 8px;
}
.vacio {
  padding: 8px 2px;
}
</style>
