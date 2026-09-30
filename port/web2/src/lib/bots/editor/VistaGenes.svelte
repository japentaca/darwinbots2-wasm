<script>
// @ts-check
// Vista por genes del editor (decisión 18): un renglón por gen, activo o
// apagado, con su nombre (el comentario de arriba), el comienzo del código
// y el bot de origen (decisión 19). Se pliega y despliega de a uno o todos;
// «Activo» apaga el gen (lo comenta, engine/lab.js apagarGen) o lo vuelve a
// encender.
//
// Lo desplegado se recuerda por una clave estable (las palabras del gen y
// cuántos iguales hay antes), no por la posición: apagar, encender o
// agregar genes no cambia qué queda abierto. `abiertos` es bindable para
// que el editor lo conserve al pasar al modo texto y volver.
import { t } from '../../../i18n/index.svelte.js';

/**
 * @type {{texto: string, bloques: import('../../../../engine/lab.js').Bloque[],
 *   origenes: import('../../../../engine/lab.js').OrigenGen[],
 *   nombreDe: (archivo: string) => string, avisos: Map<number, number>,
 *   soloLectura?: boolean, onapagar: (n: number) => void, onencender: (k: number) => void,
 *   abiertos?: Set<string>}}
 */
let {
  texto,
  bloques,
  origenes,
  nombreDe,
  avisos,
  soloLectura = false,
  onapagar,
  onencender,
  abiertos = $bindable(new Set()),
} = $props();

const lineas = $derived(texto.split('\n'));

/** Clave estable de cada bloque (mismo orden que `bloques`). */
const claves = $derived.by(() => {
  /** @type {Map<string, number>} */
  const vistos = new Map();
  return bloques.map((b) => {
    const p = b.palabras.join(' ');
    const k = vistos.get(p) ?? 0;
    vistos.set(p, k + 1);
    return `${k}:${p}`;
  });
});

/** ¿Hay alguno desplegado (de los que existen hoy)? */
const hayAbiertos = $derived(claves.some((k) => abiertos.has(k)));

/**
 * Etiqueta del botón de plegar, distinta por gen (activo o apagado).
 * @param {import('../../../../engine/lab.js').Bloque} b @param {string} k
 */
function etiquetaPlegar(b, k) {
  const abierto = abiertos.has(k);
  if (b.tipo === 'gen')
    return t(abierto ? 'editor.genes.plegarDe' : 'editor.genes.desplegarDe', { n: b.n + 1 });
  return t(abierto ? 'editor.genes.plegarApagado' : 'editor.genes.desplegarApagado', {
    n: b.n + 1,
  });
}

/** @param {string} k */
function alternar(k) {
  const s = new Set(abiertos);
  if (s.has(k)) s.delete(k);
  else s.add(k);
  abiertos = s;
}

/** @param {import('../../../../engine/lab.js').Bloque} b */
function origenDe(b) {
  if (b.tipo !== 'gen') return '';
  const o = origenes[b.n];
  if (!o) return '';
  if ('archivo' in o)
    return t('editor.genes.origenForo', { bot: nombreDe(o.archivo), gen: o.gen + 1 });
  return t('editor.genes.origenPropio', { gen: o.gen + 1 });
}

/** @param {string[]} p */
const resumen = (p) => {
  const s = p.slice(0, 12).join(' ');
  return p.length > 12 ? `${s} …` : s;
};
</script>

<div class="vista">
  <div class="fila cab">
    <button
      type="button"
      class="plegar"
      aria-label={hayAbiertos ? t('editor.genes.plegarTodos') : t('editor.genes.desplegarTodos')}
      title={hayAbiertos ? t('editor.genes.plegarTodos') : t('editor.genes.desplegarTodos')}
      onclick={() => {
  abiertos = hayAbiertos ? new Set() : new Set(claves);
}}
    >
      {hayAbiertos ? '▾' : '▸'}
    </button>
    <span class="lbl">{t('editor.genes.gen')}</span>
    <span class="lbl">{t('editor.genes.nombre')}</span>
    <span class="lbl">{t('editor.genes.origen')}</span>
    <span class="lbl">{t('editor.genes.activo')}</span>
  </div>
  {#each bloques as b, i (claves[i])}
    <div
      class="fila"
      class:apagado={b.tipo === 'apagado'}
      class:aviso={b.tipo === 'gen' && avisos.has(b.n)}
    >
      <button
        type="button"
        class="plegar"
        aria-expanded={abiertos.has(claves[i])}
        aria-label={etiquetaPlegar(b, claves[i])}
        onclick={() => alternar(claves[i])}
      >
        {abiertos.has(claves[i]) ? '▾' : '▸'}
      </button>
      <span class="mono num">{b.tipo === 'gen' ? b.n + 1 : '—'}</span>
      <span class="nombre">
        <span class="n">{b.nombre || t('editor.genes.sinNombre')}</span>
        <span class="mono cod">{resumen(b.palabras)}</span>
      </span>
      <span class="origen">{origenDe(b)}</span>
      <label class="tgl">
        <input
          type="checkbox"
          checked={b.tipo === 'gen'}
          disabled={soloLectura}
          aria-label={b.tipo === 'gen'
  ? t('editor.genes.activoDe', { n: b.n + 1 })
  : t('editor.genes.activoApagado', { n: b.n + 1 })}
          onchange={() => (b.tipo === 'gen' ? onapagar(b.n) : onencender(b.n))}
        >
        {b.tipo === 'gen' ? t('editor.genes.si') : t('editor.genes.no')}
      </label>
    </div>
    {#if abiertos.has(claves[i])}
      <pre class="codigo mono">{lineas.slice(b.l0, b.l1 + 1).join('\n')}</pre>
    {/if}
  {:else}
    <p class="vacio">{t('editor.genes.vacio')}</p>
  {/each}
</div>

<style>
.vista {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #fff;
}
.fila {
  display: grid;
  grid-template-columns: 22px 34px minmax(0, 1fr) 170px 64px;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid #ebe9e2;
  font-size: 13px;
}
.cab {
  position: sticky;
  top: 0;
  background: var(--tarjeta);
  z-index: 1;
}
.fila.apagado {
  background: #f4f3ef;
  color: #9a988f;
}
.fila.aviso {
  background: var(--aviso-fondo);
}
.plegar {
  border: 0;
  background: none;
  color: var(--gris-claro);
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}
.num {
  color: var(--gris-claro);
}
.nombre {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.n {
  font-weight: 500;
}
.cod {
  font-size: 11px;
  color: var(--gris);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.origen {
  font-size: 12px;
  color: var(--gris);
}
.tgl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.tgl input {
  width: 16px;
  height: 16px;
  accent-color: var(--acento);
  margin: 0;
}
.codigo {
  margin: 0;
  padding: 6px 12px 8px 76px;
  font-size: 12px;
  line-height: 1.5;
  background: #fcfcfb;
  border-bottom: 1px solid #ebe9e2;
  white-space: pre;
  overflow-x: auto;
}
.vacio {
  padding: 16px;
  color: var(--gris-claro);
}
</style>
