<script>
// @ts-check
// Líneas superpuestas con su banda (SVG propio, sin librerías): cada serie
// dibuja su media y, detrás, el área entre `bajo` y `alto` (mín–máx de los
// puntos fundidos de una corrida, o p10–p90 de las réplicas).
import { num, t } from '../../../i18n/index.svelte.js';
import { ejeY, escalaX } from './grafico.js';

/** @type {{ series: import('./grafico.js').SerieBanda[], titulo: string, banda: string }} */
let { series, titulo, banda } = $props();

const W = 640;
const H = 260;
const L = 52;
const R = 12;
const T = 10;
const B = 26;
const PW = W - L - R;
const PH = H - T - B;

const dibujo = $derived.by(() => {
  const conDatos = series.filter((s) => s.t.length > 0);
  if (!conDatos.length) return null;
  const ts = conDatos.flatMap((s) => s.t);
  const vs = conDatos.flatMap((s) => [...s.bajo, ...s.alto, ...s.media]).filter(Number.isFinite);
  if (!vs.length) return null;
  const x = escalaX(Math.min(...ts), Math.max(...ts), L, PW);
  const y = ejeY(Math.min(...vs), Math.max(...vs), T, PH);
  /** @param {number[]} tt @param {number[]} vv */
  const puntos = (tt, vv) =>
    tt
      .map((c, i) =>
        Number.isFinite(vv[i]) ? `${x.a(c).toFixed(1)} ${y.a(vv[i]).toFixed(1)}` : '',
      )
      .filter(Boolean);
  const trazos = conDatos.map((s) => {
    const alto = puntos(s.t, s.alto);
    const bajo = puntos(s.t, s.bajo).reverse();
    return {
      etiqueta: s.etiqueta,
      color: s.color,
      banda: alto.length && bajo.length ? `M${alto.join('L')}L${bajo.join('L')}Z` : '',
      linea: puntos(s.t, s.media).length ? `M${puntos(s.t, s.media).join('L')}` : '',
    };
  });
  return { trazos, xt: x.marcas, yt: y.marcas };
});
</script>

<figure class="grafico">
  <figcaption>{titulo}</figcaption>
  {#if dibujo}
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={titulo}>
      {#each dibujo.yt as m (m.v)}
        <line x1={L} x2={W - R} y1={m.y} y2={m.y} class="guia" />
        <text x={L - 6} y={m.y + 4} text-anchor="end">
          {num(m.v, { maximumFractionDigits: 2 })}
        </text>
      {/each}
      {#each dibujo.xt as m (m.v)}
        <text x={m.x} y={H - 8} text-anchor="middle">{num(m.v)}</text>
      {/each}
      {#each dibujo.trazos as tr, i (i)}
        {#if tr.banda}
          <path d={tr.banda} fill={tr.color} opacity="0.18" />
        {/if}
      {/each}
      {#each dibujo.trazos as tr, i (i)}
        <path d={tr.linea} fill="none" stroke={tr.color} stroke-width="2" />
      {/each}
    </svg>
    <ul class="leyenda">
      {#each dibujo.trazos as tr, i (i)}
        <li><span class="sw" style:background={tr.color}></span>{tr.etiqueta}</li>
      {/each}
      <li class="nota">{banda}</li>
    </ul>
  {:else}
    <p class="vacio">{t('comparar.grafico.sinDatos')}</p>
  {/if}
</figure>

<style>
.grafico {
  margin: 0;
}
figcaption {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
svg {
  width: 100%;
  height: auto;
  display: block;
}
text {
  font-size: 11px;
  fill: var(--gris-claro);
  font-family: var(--mono);
}
.guia {
  stroke: var(--borde);
  stroke-width: 1;
}
.leyenda {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding: 0;
  margin: 6px 0 0;
  font-size: 12px;
}
.leyenda li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.nota {
  color: var(--gris-claro);
}
.vacio {
  font-size: 13px;
  color: var(--gris-claro);
}
</style>
