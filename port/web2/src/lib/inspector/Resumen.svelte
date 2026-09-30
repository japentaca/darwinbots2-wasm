<script>
// @ts-check
// Pestaña Resumen del inspector: recursos, energía reciente, visión, genes
// activos y linaje (lo que no llegue en los datos no se muestra).
import { num, t } from '../../i18n/index.svelte.js';
import { vbACss } from '../mundo/color.js';
import { fraccion, RECURSOS } from './datos.js';

/**
 * @type {{
 *   datos: import('./datos.js').DatosBot | null,
 *   maximos: Record<string, number>,
 *   chispa: string,
 *   base?: number,
 *   ventana: number,
 *   genes: number[] | null,
 *   rel: import('./datos.js').Parientes | null,
 *   onIr: (slot: number) => void,
 * }}
 */
let { datos, maximos, chispa, base = 59, ventana, genes, rel, onIr } = $props();

/** Sysvar de cada recurso (no se traduce). */
const SYSVAR = { nrg: '.nrg', body: '.body', venom: '.venom', shell: '.shell', waste: '.waste' };

const activos = $derived(genes ? genes.reduce((a, g) => a + (g ? 1 : 0), 0) : 0);
const colorEspecie = $derived(datos ? vbACss(datos.color) : 'var(--acento)');
/** Alto máximo de las barras de visión (px). */
const ALTO_OJO = 48;
</script>

{#if datos}
  <div class="card caja barras">
    {#each RECURSOS as k (k)}
      <div
        class="barra"
        title={t('inspector.recursos.ayuda', { sysvar: SYSVAR[k], max: num(Math.round(maximos[k])) })}
      >
        <span class="nombre">{t(`inspector.recurso.${k}`)}</span>
        <span class="pista"
          ><span
            class="lleno"
            style:width={`${fraccion(datos[k], maximos[k]) * 100}%`}
          ></span></span
        >
        <span class="mono valor">{num(Math.round(datos[k]))}</span>
      </div>
    {/each}
  </div>

  <div class="card caja">
    <div class="enc">
      <span class="tit">{t('inspector.energia')}</span>
      <span class="nota">{t('inspector.energia.ventana', { n: num(ventana) })}</span>
    </div>
    {#if chispa}
      <svg class="chispa" viewBox="0 0 330 60" preserveAspectRatio="none" aria-hidden="true">
        <path
          d={`M0 ${base.toFixed(1)}H330`}
          stroke="#c3c2b7"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        ></path>
        <path
          d={chispa}
          stroke={colorEspecie}
          stroke-width="2"
          fill="none"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        ></path>
      </svg>
    {:else}
      <p class="nota">{t('inspector.energia.sinDatos')}</p>
    {/if}
  </div>

  {#if datos.ojos.length}
    <div class="card caja">
      <div class="enc">
        <span class="tit">{t('inspector.vision')}</span>
        <span class="mono nota">.eye1 … .eye9</span>
      </div>
      <div class="ojos">
        {#each datos.ojos as ojo, a (a)}
          <div
            class="ojo"
            title={t(a === datos.ojoFoco ? 'inspector.vision.ojoFoco' : 'inspector.vision.ojo', {
  sysvar: `.eye${a + 1}`,
  v: num(ojo.visto),
})}
          >
            <span
              class="col"
              class:foco={a === datos.ojoFoco}
              style:height={`${Math.max(2, (Math.min(Math.max(ojo.visto, 0), 100) / 100) * ALTO_OJO)}px`}
            ></span>
            <span class="mono num" class:foco={a === datos.ojoFoco}>{a + 1}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="card caja">
    <div class="enc">
      <span class="tit">{t('inspector.genes')}</span>
      {#if genes}
        <span class="mono nota"
          >{t('inspector.genes.cuenta', { on: activos, total: genes.length })}</span
        >
      {/if}
    </div>
    {#if genes?.length}
      <div class="genes">
        {#each genes as g, i (i)}
          <span
            class="gen"
            class:on={g}
            title={t(g ? 'inspector.genes.activo' : 'inspector.genes.inactivo', { n: i + 1 })}
          ></span>
        {/each}
      </div>
    {:else}
      <p class="nota">{t('inspector.genes.sinDatos')}</p>
    {/if}
  </div>

  {#if rel}
    <p class="linaje">
      {#if rel.madre}
        {t('inspector.linaje.madre')}
        {@render enlace(rel.madre)}
        ·
      {/if}
      {#if rel.hijos.length === 0}
        {t('inspector.linaje.hijos.ninguno')}
      {:else if rel.hijos.length === 1}
        {t('inspector.linaje.hijos.uno')}
      {:else}
        {t('inspector.linaje.hijos.otros', { n: num(rel.hijos.length) })}
      {/if}
      {#if rel.fundador}
        · {t('inspector.linaje.fundador')}
        {@render enlace(rel.fundador)}
      {/if}
    </p>
  {/if}
{/if}

{#snippet enlace(
  /** @type {import('./datos.js').Pariente} */ p,
)}
  {#if p.slot}
    <button
      type="button"
      class="enlace mono"
      title={t('inspector.linaje.ir', { n: p.abs })}
      onclick={() => onIr(p.slot)}
    >
      #{p.abs}
    </button>
  {:else}
    <span class="mono" title={t('inspector.linaje.noVive')}>#{p.abs}</span>
  {/if}
{/snippet}

<style>
.caja {
  padding: 12px 14px;
}
.barras {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.barra {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.nombre {
  width: 84px;
  color: var(--chip-texto);
}
.pista {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--chip);
  overflow: hidden;
}
.lleno {
  display: block;
  height: 100%;
  background: var(--acento);
}
.valor {
  width: 60px;
  text-align: right;
  font-size: 12px;
}
.enc {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  margin-bottom: 8px;
}
.tit {
  font-weight: 600;
}
.nota {
  color: var(--gris-claro);
  font-size: 12px;
  margin: 0;
}
.chispa {
  display: block;
  width: 100%;
  height: 60px;
}
.ojos {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 64px;
}
.ojo {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  height: 100%;
}
.col {
  display: block;
  width: 100%;
  border-radius: 3px 3px 0 0;
  background: #9fbfbb;
}
.col.foco {
  background: var(--acento);
}
.num {
  font-size: 10px;
  color: var(--gris-claro);
}
.num.foco {
  color: var(--acento);
  font-weight: 600;
}
.genes {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px;
}
.gen {
  display: block;
  height: 14px;
  border-radius: 3px;
  background: var(--borde);
}
.gen.on {
  background: var(--acento);
}
.linaje {
  margin: 0;
  font-size: 13px;
  color: var(--gris);
  line-height: 1.5;
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
