<script>
// @ts-check
// La tarjeta del manual del editor (S10 de PLAN-SITIO.md): el resumen de una
// sysvar o un operador y el enlace a su página. La muestran AreaAdn (al pasar
// el cursor por el texto) y PanelPila (al pasar por la pila, PLAN-EDITOR E1.5).
// Quien la muestra calcula la posición (estilo) y se queda con la referencia
// al elemento (ref) para no cerrarla al entrar en ella.
import { t } from '../../../i18n/index.svelte.js';

/**
 * @type {{tip: {t: string, r: string, href: string} | null,
 *   ref?: HTMLDivElement | undefined, estilo: string}}
 */
let { tip, ref = $bindable(), estilo } = $props();
</script>

{#if tip}
  <div bind:this={ref} class="tip" role="tooltip" style={estilo}>
    <span class="mono tit">{tip.t}</span>
    <p>{tip.r}</p>
    <a href={tip.href} target="_blank" rel="noopener">{t('editor.texto.manual')}</a>
  </div>
{/if}

<style>
.tip {
  position: absolute;
  z-index: 6;
  max-width: 320px;
  padding: 8px 12px;
  background: var(--tarjeta);
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  box-shadow: 0 6px 18px var(--sombra);
  font-size: 12px;
  line-height: 1.45;
}
.tip .tit {
  display: block;
  color: var(--acento);
  font-size: 12.5px;
  margin-bottom: 2px;
}
.tip p {
  margin: 0 0 6px;
  color: var(--texto);
}
.tip a {
  color: var(--acento);
  font-size: 12px;
}
</style>
