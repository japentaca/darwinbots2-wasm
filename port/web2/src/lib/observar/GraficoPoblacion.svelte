<script>
// @ts-check
// Población por especie: área apilada en SVG propio (sin librerías) sobre
// las muestras de la corrida, con leyenda (color, nombre, bots ahora).
import { num, t } from '../../i18n/index.svelte.js';
import { capasApiladas, topeEje } from './metricas.js';

/**
 * @type {{
 *   muestras: import('./metricas.js').Muestra[],
 *   colores: Record<string, string>,
 *   intervalo: number,
 *   actuales: Record<string, number>,
 * }}
 */
let { muestras, colores, intervalo, actuales } = $props();

const W = 358;
const H = 150;
const L = 34;
const B = 18;
const T = 6;
const R = 6;
const PW = W - L - R;
const PH = H - T - B;
const OTRAS = 'var(--grafico-otras)';

const capas = $derived(capasApiladas(muestras));

const dibujo = $derived.by(() => {
  const n = muestras.length;
  if (n < 2) return null;
  const c0 = muestras[0].ciclo;
  const c1 = muestras[n - 1].ciclo;
  const span = Math.max(1, c1 - c0);
  /** @param {number} i */
  const X = (i) => L + (PW * (muestras[i].ciclo - c0)) / span;
  let abajo = new Array(n).fill(0);
  const bandas = capas.map((cp) => {
    const arriba = abajo.map((a, i) => a + cp.valores[i]);
    const b = { cp, abajo, arriba };
    abajo = arriba;
    return b;
  });
  const tope = topeEje(Math.max(1, ...abajo));
  /** @param {number} v */
  const Y = (v) => T + PH * (1 - v / tope);
  const paths = bandas.map(({ cp, abajo: a, arriba: b }) => {
    const ida = b.map((v, i) => `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('L');
    const vuelta = a
      .map((v, i) => `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`)
      .reverse()
      .join('L');
    return {
      d: `M${ida}L${vuelta}Z`,
      color: cp.nombre === null ? OTRAS : (colores[cp.nombre] ?? OTRAS),
      clave: cp.nombre ?? '\u0000otras',
    };
  });
  const yt = [0, 0.5, 1].map((k) => ({ v: tope * k, y: Y(tope * k) }));
  const xt = [0, 0.5, 1].map((k) => ({ v: c0 + span * k, x: L + PW * k, k }));
  return { paths, yt, xt, span };
});

/** 48000 → 48k @param {number} c */
function corto(c) {
  if (c >= 1e6) return `${num(Math.round(c / 1e5) / 10)}M`;
  if (c >= 1e4) return `${num(Math.round(c / 1e3))}k`;
  if (c >= 1e3) return `${num(Math.round(c / 100) / 10)}k`;
  return num(Math.round(c));
}

const leyenda = $derived(
  capas.map((cp) => {
    if (cp.nombre === null) {
      const nombres = new Set(capas.map((c) => c.nombre));
      let n = 0;
      for (const [k, v] of Object.entries(actuales)) if (!nombres.has(k)) n += v;
      return { clave: '\u0000otras', nombre: t('observar.grafico.otras'), n, color: OTRAS };
    }
    return {
      clave: cp.nombre,
      nombre: cp.nombre,
      n: actuales[cp.nombre] ?? 0,
      color: colores[cp.nombre] ?? OTRAS,
    };
  }),
);
</script>

<div class="card grafico">
  <div class="cab">
    <span class="tit">{t('observar.grafico.titulo')}</span>
    {#if dibujo}
      <span class="rango">{t('observar.grafico.rango', { n: corto(dibujo.span) })}</span>
    {/if}
  </div>
  {#if dibujo}
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('observar.grafico.aria')}>
      <path
        d={`M${L} ${dibujo.yt[1].y.toFixed(1)}H${W - R}M${L} ${dibujo.yt[2].y.toFixed(1)}H${W - R}`}
        style:stroke="var(--grafico-rejilla)"
        stroke-width="1"
        fill="none"
      ></path>
      {#each dibujo.paths as p (p.clave)}
        <path d={p.d} style:fill={p.color} style:stroke="var(--tarjeta)" stroke-width="1"></path>
      {/each}
      <path
        d={`M${L} ${T + PH}H${W - R}`}
        style:stroke="var(--grafico-eje)"
        stroke-width="1"
        fill="none"
      ></path>
      {#each dibujo.yt as tk (tk.v)}
        <text class="tick" x={L - 6} y={tk.y + 3} text-anchor="end">{corto(tk.v)}</text>
      {/each}
      {#each dibujo.xt as tk (tk.k)}
        <text
          class="tick"
          x={tk.x}
          y={H - 4}
          text-anchor={tk.k === 0 ? 'start' : tk.k === 1 ? 'end' : 'middle'}
        >
          {corto(tk.v)}
        </text>
      {/each}
    </svg>
  {:else}
    <p class="vacio">{t('observar.grafico.vacio', { n: num(intervalo) })}</p>
  {/if}
  {#if leyenda.length}
    <div class="leyenda">
      {#each leyenda as s (s.clave)}
        <span class="item">
          <span class="sw" style:background={s.color}></span>
          <span class="nombre" title={s.nombre}>{s.nombre}</span>
          <span class="mono n">{num(s.n)}</span>
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
.grafico {
  padding: 14px 14px 12px;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
  gap: 8px;
}
.tit {
  font-size: 14px;
  font-weight: 600;
}
.rango {
  font-size: 12px;
  color: var(--gris-claro);
}
svg {
  display: block;
  width: 100%;
  height: auto;
}
.tick {
  font-family: var(--mono);
  font-size: 10px;
  fill: var(--gris-claro);
  font-variant-numeric: tabular-nums;
}
.vacio {
  margin: 0;
  font-size: 13px;
  color: var(--gris-claro);
}
.leyenda {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
  margin-top: 10px;
}
.item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--chip-texto);
  min-width: 0;
}
.nombre {
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.n {
  color: var(--gris);
}
</style>
