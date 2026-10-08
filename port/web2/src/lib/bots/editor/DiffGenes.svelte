<script>
// @ts-check
// Diff gen por gen entre dos versiones (engine/bots.js diffVersiones): los
// genes iguales se resumen, los cambiados se muestran lado a lado, y cada
// gen lleva su bot de origen si lo tiene (decisión 19). Sirve también para
// comparar una variante de la evolución (PLAN-EDITOR E4.4): ahí el diff es el
// de diffGenes con los orígenes en null (adaptarDiff, evolucion.js) y los
// lados se rotulan con etiquetaA/etiquetaB («Base», «Variante 2»).
import { t } from '../../../i18n/index.svelte.js';

/**
 * @type {{diff: ReturnType<typeof import('../../../../engine/bots.js').diffVersiones>,
 *   a: number, b: number, nombreDe: (archivo: string) => string, oncerrar: () => void,
 *   etiquetaA?: string | null, etiquetaB?: string | null}}
 */
let { diff, a, b, nombreDe, oncerrar, etiquetaA = null, etiquetaB = null } = $props();
/** Rótulo de cada lado: la versión («v3») salvo que el padre pase otro. */
const ea = $derived(etiquetaA ?? `v${a}`);
const eb = $derived(etiquetaB ?? `v${b}`);

/** Tramos: los iguales seguidos se juntan en uno. */
const tramos = $derived.by(() => {
  /** @type {({tipo: 'iguales', n: number} | import('../../../../engine/lineage.js').CambioGen)[]} */
  const out = [];
  for (const c of diff.cambios) {
    const ult = out[out.length - 1];
    if (c.tipo === 'igual') {
      if (ult?.tipo === 'iguales') ult.n++;
      else out.push({ tipo: 'iguales', n: 1 });
    } else out.push(c);
  }
  return out;
});

/** @param {any} o */
function origen(o) {
  if (!o) return '';
  if ('archivo' in o)
    return t('editor.genes.origenForo', { bot: nombreDe(o.archivo), gen: o.gen + 1 });
  return t('editor.genes.origenPropio', { gen: o.gen + 1 });
}
</script>

<div class="diff">
  <div class="cab">
    <strong>{t('editor.diff.titulo', { a: ea, b: eb })}</strong>
    <span class="help">
      {t('editor.diff.resumen', {
  iguales: diff.iguales,
  cambiados: diff.cambiados,
  agregados: diff.agregados,
  quitados: diff.quitados,
})}
    </span>
    <span class="crece"></span>
    <button type="button" class="btn sm" onclick={oncerrar}>{t('editor.cerrar')}</button>
  </div>
  <div class="cuerpo">
    {#each tramos as x, i (i)}
      {#if x.tipo === 'iguales'}
        <div class="iguales">{t('editor.diff.iguales', { n: x.n })}</div>
      {:else}
        <div class="cambio {x.tipo}">
          <div class="rot">
            {t(`editor.diff.${x.tipo}`)}
            {#if x.a !== null}
              <span class="mono">{ea} · {t('editor.diff.gen', { n: x.a + 1 })}</span>
            {/if}
            {#if x.b !== null}
              <span class="mono">{eb} · {t('editor.diff.gen', { n: x.b + 1 })}</span>
            {/if}
          </div>
          <div class="lados">
            <div>
              {#if x.a !== null}
                <pre class="mono">{diff.genesA[x.a]}</pre>
                <span class="help">{origen(diff.origenesA?.[x.a])}</span>
              {/if}
            </div>
            <div>
              {#if x.b !== null}
                <pre class="mono">{diff.genesB[x.b]}</pre>
                <span class="help">{origen(diff.origenesB?.[x.b])}</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    {:else}
      <p class="help">{t('editor.diff.vacio')}</p>
    {/each}
  </div>
</div>

<style>
.diff {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--campo);
}
.cab {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--borde);
}
.crece {
  flex: 1;
}
.cuerpo {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.iguales {
  font-size: 12px;
  color: var(--gris-claro);
  padding: 2px 0;
  border-top: 1px dashed var(--borde);
}
.cambio {
  border-left: 3px solid var(--borde-control);
  padding-left: 8px;
}
.cambio.cambiado {
  border-color: var(--codigo-def);
}
.cambio.agregado {
  border-color: var(--acento);
}
.cambio.quitado {
  border-color: var(--codigo-num);
}
.rot {
  display: flex;
  gap: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--gris);
}
.rot .mono {
  font-weight: 400;
}
.lados {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
pre {
  margin: 4px 0 2px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  background: var(--tarjeta);
  border: 1px solid var(--borde);
  border-radius: 6px;
  padding: 4px 6px;
}
</style>
