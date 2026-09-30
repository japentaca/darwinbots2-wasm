<script>
// @ts-check
// Líneas superpuestas con su banda (SVG propio, sin librerías): cada serie
// dibuja su media y, detrás, el área entre `bajo` y `alto` (mín–máx de los
// puntos fundidos de una corrida, o p10–p90 de las réplicas). En el barrido
// el eje X es el valor del parámetro (`xReal`: marcas sin redondear a
// enteros), con `puntos` en cada valor y el nombre del eje en `ejeX`;
// `marcasX` fija las marcas del eje X con su texto (bool y enum: solo los
// valores de la grilla).
import { num, t } from '../../../i18n/index.svelte.js';
import { ejeY, escalaX } from './grafico.js';

/**
 * @type {{ series: import('./grafico.js').SerieBanda[], titulo: string, banda: string,
 *   xReal?: boolean, puntos?: boolean, ejeX?: string,
 *   marcasX?: {v: number, texto: string}[] | null }}
 */
let {
  series,
  titulo,
  banda,
  xReal = false,
  puntos: conPuntos = false,
  ejeX = '',
  marcasX = null,
} = $props();

const W = 640;
const H = $derived(ejeX ? 280 : 260);
const L = 52;
const R = 12;
const T = 10;
const B = $derived(ejeX ? 46 : 26);
const PW = W - L - R;
const PH = $derived(H - T - B);

const dibujo = $derived.by(() => {
  const conDatos = series.filter((s) => s.t.length > 0);
  if (!conDatos.length) return null;
  const ts = conDatos.flatMap((s) => s.t);
  const vs = conDatos.flatMap((s) => [...s.bajo, ...s.alto, ...s.media]).filter(Number.isFinite);
  if (!vs.length) return null;
  const x = escalaX(Math.min(...ts), Math.max(...ts), L, PW, xReal);
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
      marcas: conPuntos
        ? s.t.flatMap((c, i) =>
            Number.isFinite(s.media[i]) ? [{ x: x.a(c), y: y.a(s.media[i]) }] : [],
          )
        : [],
    };
  });
  const xt = marcasX
    ? marcasX.map((m) => ({ x: x.a(m.v), texto: m.texto }))
    : x.marcas.map((m) => ({ x: m.x, texto: num(m.v, { maximumFractionDigits: 4 }) }));
  return { trazos, xt, yt: y.marcas };
});
</script>

<figure class="grafico">
  <figcaption>{titulo}</figcaption>
  {#if dibujo}
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={titulo}>
      {#each dibujo.yt as m, i (i)}
        <line x1={L} x2={W - R} y1={m.y} y2={m.y} class="guia" />
        <text x={L - 6} y={m.y + 4} text-anchor="end">
          {num(m.v, { maximumFractionDigits: 2 })}
        </text>
      {/each}
      {#each dibujo.xt as m, i (i)}
        <text x={m.x} y={H - B + 18} text-anchor="middle">{m.texto}</text>
      {/each}
      {#each dibujo.trazos as tr, i (i)}
        {#if tr.banda}
          <path d={tr.banda} fill={tr.color} opacity="0.18" />
        {/if}
      {/each}
      {#each dibujo.trazos as tr, i (i)}
        <path d={tr.linea} fill="none" stroke={tr.color} stroke-width="2" />
        {#each tr.marcas as p, j (j)}
          <circle cx={p.x} cy={p.y} r="3.5" fill={tr.color} />
        {/each}
      {/each}
      {#if ejeX}
        <text x={L + PW / 2} y={H - 6} text-anchor="middle" class="eje">{ejeX}</text>
      {/if}
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
.eje {
  font-family: inherit;
  font-size: 12px;
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
