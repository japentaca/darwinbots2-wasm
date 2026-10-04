<script>
// @ts-check
// Pestaña ADN: el texto del bot (bot-text: ADN detokenizado con su cabecera)
// con resaltado simple y copia al portapapeles.
import { num, t } from '../../i18n/index.svelte.js';
import { resaltarAdn } from './adn.js';

/**
 * @type {{
 *   texto: string | null,
 *   vivo: boolean,
 *   onReleer: () => void,
 * }}
 */
let { texto, vivo, onReleer } = $props();

const lineas = $derived(texto ? resaltarAdn(texto) : []);
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
  {#if lineas.length}
    <span class="nota">{t('inspector.adn.lineas', { n: num(lineas.length) })}</span>
  {/if}
</div>

{#if texto === null}
  <p class="nota">{t('inspector.adn.cargando')}</p>
{:else if texto === ''}
  <p class="nota">{t('inspector.adn.vacio')}</p>
{:else}
  <section aria-label={t('inspector.adn.aria')}>
    <pre class="mono adn">{#each lineas as l, i (i)}{#each l as tok, j (j)}{#if tok.c}<span
            class={tok.c}>{tok.s}</span
          >{:else}{tok.s}{/if}{/each}{'\n'}{/each}</pre>
  </section>
{/if}

<style>
.barra {
  display: flex;
  align-items: center;
  gap: 8px;
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
.adn {
  margin: 0;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.5;
  background: var(--tarjeta);
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  overflow: auto;
  max-height: 60vh;
  white-space: pre;
}
.adn :global(.com) {
  color: var(--gris-claro);
  font-style: italic;
}
.adn :global(.clave) {
  color: var(--adn-clave);
  font-weight: 600;
}
.adn :global(.sysvar) {
  color: var(--acento);
}
.adn :global(.num) {
  color: var(--adn-num);
}
.adn :global(.op) {
  color: var(--adn-op);
  font-weight: 500;
}
</style>
