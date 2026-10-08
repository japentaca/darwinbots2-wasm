<script>
// @ts-check
// Pestaña ADN del inspector (PLAN-EDITOR E2.3): el texto del bot (bot-text) con
// los genes que dispararon en el último ciclo, la pila de un gen al hacer clic,
// controles de paso, una línea de tiempo y el paso al editor. Lo que se ve sale
// del motor (`genes` y `traza`); acá no se evalúa nada.
import { pasosDeGen } from '../../../engine/pila.js';
import { num, t } from '../../i18n/index.svelte.js';
import PanelPila from '../bots/editor/PanelPila.svelte';
import { alineadosDeTraza, claseDeGen, segmentosAdn } from './adn.js';
import LineaTiempoGenes from './LineaTiempoGenes.svelte';

/**
 * @type {{
 *   texto: string | null,
 *   vivo: boolean,
 *   corriendo: boolean,
 *   genes: number[] | null,
 *   historialGa: (number[] | null)[],
 *   traza: string,
 *   onReleer: () => void,
 *   onPausar: () => void,
 *   onPaso: (k: number) => void,
 *   onAbrirEditor: () => void,
 * }}
 */
let {
  texto,
  vivo,
  corriendo,
  genes,
  historialGa,
  traza,
  onReleer,
  onPausar,
  onPaso,
  onAbrirEditor,
} = $props();

const segmentos = $derived(texto ? segmentosAdn(texto) : []);
const genesTxt = $derived(segmentos.filter((s) => s.gen));
const nLineas = $derived(segmentos.reduce((a, s) => a + s.lineas.length, 0));
const alineados = $derived(texto ? alineadosDeTraza(texto, traza) : []);
/** Pasos de cada gen (clave: su número base 0). */
const pasosDe = $derived(
  new Map(genesTxt.map((g) => [g.n, texto ? pasosDeGen(alineados, texto, g.n) : []])),
);
/** Estado de cada gen en el último ciclo: '' | 'disparo' | 'evaluado'. */
const estadoDe = $derived(
  new Map(genesTxt.map((g) => [g.n, claseDeGen(pasosDe.get(g.n) ?? [], genes?.[g.n] === 1)])),
);
const cuenta = $derived(genes ? genes.reduce((a, g) => a + (g ? 1 : 0), 0) : 0);
/** Estado del visor de pila de un gen con la traza actual. */
const estadoPila = $derived(alineados.length ? 'ok' : 'sinDatos');

/** Gen desplegado (null = ninguno), con el texto al que corresponde. */
/** @type {{n: number, texto: string | null} | null} */
let abierto = $state(null);
const genAbierto = $derived(abierto && abierto.texto === texto ? abierto.n : -1);

/** @param {number} n */
function alternarGen(n) {
  const cerrar = abierto && abierto.texto === texto && abierto.n === n;
  abierto = cerrar ? null : { n, texto };
}

/** '' | 'ok' | 'error' */
let copia = $state('');
/** @type {ReturnType<typeof setTimeout> | undefined} */
let borrar;

async function copiar() {
  if (!texto) return;
  try {
    await navigator.clipboard.writeText(texto.replaceAll('\0', ''));
    copia = 'ok';
  } catch {
    copia = 'error';
  }
  clearTimeout(borrar);
  borrar = setTimeout(() => {
    copia = '';
  }, 2000);
}

$effect(() => () => clearTimeout(borrar));
</script>

<div class="barra">
  {#if corriendo}
    <button class="btn chico" type="button" disabled={!vivo} onclick={onPausar}>
      {t('inspector.adn.pausar')}
    </button>
  {/if}
  <button class="btn chico" type="button" disabled={!vivo} onclick={() => onPaso(1)}>
    {t('inspector.adn.unCiclo')}
  </button>
  <button class="btn chico" type="button" disabled={!vivo} onclick={() => onPaso(10)}>
    {t('inspector.adn.diezCiclos')}
  </button>
  <button class="btn chico" type="button" disabled={!texto} onclick={copiar}>
    {copia === 'ok'
  ? t('inspector.adn.copiado')
  : copia === 'error'
    ? t('inspector.adn.copiarError')
    : t('inspector.adn.copiar')}
  </button>
  <button
    class="btn chico"
    type="button"
    disabled={!vivo}
    title={t('inspector.adn.releer.ayuda')}
    onclick={onReleer}
  >
    {t('inspector.adn.releer')}
  </button>
  <button class="btn chico" type="button" disabled={!vivo || !texto} onclick={onAbrirEditor}>
    {t('inspector.adn.abrirEditor')}
  </button>
</div>
<div class="barra notas">
  {#if texto && nLineas}
    <span class="nota">{t('inspector.adn.lineas', { n: num(nLineas) })}</span>
  {/if}
  {#if genes}
    <span class="nota">{t('inspector.genes.cuenta', { on: cuenta, total: genes.length })}</span>
  {/if}
  {#if vivo && texto && !traza}
    <span class="nota">{t('inspector.adn.sinTraza')}</span>
  {/if}
</div>

{#if texto === null}
  <p class="nota">{t('inspector.adn.cargando')}</p>
{:else if texto === ''}
  <p class="nota">{t('inspector.adn.vacio')}</p>
{:else}
  <section class="cuerpo-adn" aria-label={t('inspector.adn.aria')}>
    {#each segmentos as seg, s (s)}
      {#if seg.gen}
        <div class="bloque-gen {estadoDe.get(seg.n) ?? ''}">
          <button
            class="cab-gen"
            type="button"
            aria-expanded={genAbierto === seg.n}
            onclick={() => alternarGen(seg.n)}
          >
            <span class="mono">{t('editor.pila.gen', { n: seg.n + 1 })}</span>
            {#if estadoDe.get(seg.n)}
              <span class="chip">{t(`inspector.adn.${estadoDe.get(seg.n)}`)}</span>
            {/if}
          </button>
          <pre
            class="mono codigo gen-codigo"
          >{#each seg.lineas as linea, i (i)}{#each linea as tok, j (j)}{#if tok.c}<span class={tok.c}>{tok.s}</span>{:else}{tok.s}{/if}{/each}{#if i < seg.lineas.length - 1}{'\n'}{/if}{/each}</pre>
          {#if genAbierto === seg.n}
            <PanelPila
              pasos={pasosDe.get(seg.n) ?? []}
              gen={seg.n}
              valores={new Map()}
              sysvars={[]}
              estado={estadoPila}
              soloLectura
              modo="trazador"
            />
          {/if}
        </div>
      {:else}
        <pre
          class="mono codigo"
        >{#each seg.lineas as linea, i (i)}{#each linea as tok, j (j)}{#if tok.c}<span class={tok.c}>{tok.s}</span>{:else}{tok.s}{/if}{/each}{#if i < seg.lineas.length - 1}{'\n'}{/if}{/each}</pre>
      {/if}
    {/each}
  </section>
  <LineaTiempoGenes {historialGa} cantidad={genesTxt.length} />
{/if}

<style>
.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.notas {
  gap: 12px;
}
.chico {
  height: 36px;
  padding: 0 12px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
}
.cuerpo-adn {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.codigo {
  margin: 0;
  padding: 8px 14px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
  overflow: auto;
  background: var(--tarjeta);
  border: 1px solid var(--borde);
  border-radius: var(--radio);
}
.bloque-gen {
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--tarjeta);
  overflow: hidden;
}
.bloque-gen.disparo {
  border-color: var(--acento);
  background: color-mix(in srgb, var(--acento) 14%, var(--tarjeta));
}
.bloque-gen.evaluado {
  border-style: dashed;
}
.cab-gen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 0 12px;
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.gen-codigo {
  border: 0;
  border-radius: 0;
  background: none;
  padding-top: 0;
}
.codigo :global(.com) {
  color: var(--gris-claro);
  font-style: italic;
}
.codigo :global(.clave) {
  color: var(--adn-clave);
  font-weight: 600;
}
.codigo :global(.sysvar) {
  color: var(--acento);
}
.codigo :global(.num) {
  color: var(--adn-num);
}
.codigo :global(.op) {
  color: var(--adn-op);
  font-weight: 500;
}
</style>
