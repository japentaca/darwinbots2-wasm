<script>
// @ts-check
// Gráfico SVG propio de Analizar: líneas (con banda mín–máx en los tramos
// fundidos) o áreas apiladas por especie, ejes con ticks, tooltip al pasar
// el puntero, marca de un ciclo (evento elegido) y pines de eventos
// opcionales. La geometría sale de geometria.js (pura, testeada).
import { num, t } from '../../../i18n/index.svelte.js';
import { colorEnTema } from '../../tema.js';
import { oscuro } from '../../tema.svelte.js';
import { corto } from './escala.js';
import { geometria, valoresEn } from './geometria.js';

/**
 * @type {{
 *   series: import('./geometria.js').SerieGrafico[],
 *   modo?: 'lineas' | 'apilado',
 *   alto?: number,
 *   marca?: number | null,
 *   marcaTexto?: string,
 *   dominio?: [number, number] | null,
 *   pines?: { clave: string, ciclo: number, color: string, sel: boolean, titulo: string }[],
 *   onpin?: (clave: string) => void,
 *   aria: string,
 *   vacio?: string,
 *   leyenda?: boolean,
 *   cero?: boolean,
 * }}
 */
let {
  series,
  modo = 'lineas',
  alto = 200,
  marca = null,
  marcaTexto = '',
  dominio = null,
  pines = [],
  onpin,
  aria,
  vacio = '',
  leyenda = true,
  cero = false,
} = $props();

/** Color de una serie o pin tal como se ve con el tema actual. @param {string} c */
const ct = (c) => colorEnTema(c, oscuro());

const uid = $props.id();
const clip = `analizar-clip-${uid}`;
let ancho = $state(0);
/** @type {number | null} */
let cursor = $state(null);

const g = $derived(ancho > 0 ? geometria({ series, modo, ancho, alto, dominio, cero }) : null);

/** @param {number} v */
const fmt = (v) => corto(v, (n) => num(n));

const tip = $derived.by(() => {
  if (!g || g.vacio || cursor === null || !g.X) return null;
  const c = g.X.inv(cursor);
  const r = valoresEn(series, c, [g.c0, g.c1]);
  if (!r?.filas.length) return null;
  const filas = [...r.filas].sort((a, b) => b.v - a.v).slice(0, 9);
  const total = modo === 'apilado' ? r.filas.reduce((s, f) => s + f.v, 0) : null;
  const x = g.X(r.ciclo);
  return { ciclo: r.ciclo, filas, total, x, izquierda: x > (g.x0 + g.x1) / 2 };
});

const xMarca = $derived(
  g && !g.vacio && g.X && marca !== null && marca >= g.c0 && marca <= g.c1 ? g.X(marca) : null,
);

// aria-label: nombre, último valor, mínimo y máximo en el dominio (O1).
const etiqueta = $derived.by(() => {
  const r = g?.resumen;
  if (!g || g.vacio || !r) return t('analizar.grafico.ariaVacio', { nombre: aria });
  const p = {
    nombre: aria,
    serie: r.nombre ?? '',
    n: num(r.series),
    ultimo: valor(r.ultimo),
    min: valor(r.min),
    max: valor(r.max),
    desde: num(Math.round(g.c0)),
    hasta: num(Math.round(g.c1)),
  };
  if (modo === 'apilado')
    return t(r.series > 1 ? 'analizar.grafico.ariaTotal' : 'analizar.grafico.aria', p);
  return t(r.series > 1 ? 'analizar.grafico.ariaSerie' : 'analizar.grafico.aria', p);
});

/** @param {PointerEvent} e */
function mover(e) {
  if (!g || g.vacio) return;
  const r = /** @type {SVGSVGElement} */ (e.currentTarget).getBoundingClientRect();
  const x = e.clientX - r.left;
  cursor = x >= g.x0 && x <= g.x1 ? x : null;
}

/** @param {number} v */
function valor(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  return num(v, { maximumFractionDigits: a >= 100 ? 0 : a >= 10 ? 1 : 2 });
}
</script>

<div class="grafico" bind:clientWidth={ancho} style:height={`${alto}px`}>
  {#if g?.vacio}
    <p class="vacio">{vacio || t('analizar.grafico.vacio')}</p>
  {:else if g}
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={etiqueta}
      onpointermove={mover}
      onpointerleave={() => (cursor = null)}
    >
      <defs>
        <clipPath id={clip}>
          <rect x={g.x0} y={g.y0 - 2} width={g.x1 - g.x0} height={g.y1 - g.y0 + 4}></rect>
        </clipPath>
      </defs>
      <path
        d={g.yt.map((tk) => `M${g.x0} ${tk.y.toFixed(1)}H${g.x1}`).join('')}
        class="rejilla"
      ></path>
      <g clip-path={`url(#${clip})`}>
        {#each g.capas as c (c.clave)}
          {#if c.banda}
            <path d={c.banda} fill={ct(c.color)} fill-opacity="0.16" stroke="none"></path>
          {/if}
        {/each}
        {#each g.capas as c (c.clave)}
          {#if modo === 'apilado'}
            <path d={c.d} fill={ct(c.color)} style:stroke="var(--tarjeta)" stroke-width="1"></path>
          {:else}
            <path
              d={c.d}
              fill="none"
              stroke={ct(c.color)}
              stroke-width="1.8"
              stroke-linejoin="round"
            ></path>
          {/if}
        {/each}
      </g>
      <path d={`M${g.x0} ${g.y1}H${g.x1}`} class="base"></path>
      {#each g.yt as tk (tk.v)}
        <text class="tick" x={g.x0 - 6} y={tk.y + 3} text-anchor="end">{fmt(tk.v)}</text>
      {/each}
      {#each g.xt as tk (tk.v)}
        <text class="tick" x={tk.x} y={alto - 5} text-anchor="middle">{fmt(tk.v)}</text>
      {/each}
      {#if xMarca !== null}
        <path d={`M${xMarca.toFixed(1)} ${g.y0}V${g.y1}`} class="marca"></path>
      {/if}
      {#if tip}
        <path d={`M${tip.x.toFixed(1)} ${g.y0}V${g.y1}`} class="cursor"></path>
      {/if}
    </svg>
    {#if xMarca !== null && marcaTexto}
      <span
        class="chip marca-chip"
        style:left={`${xMarca > ancho * 0.6 ? xMarca - 6 : xMarca + 6}px`}
        style:transform={xMarca > ancho * 0.6 ? 'translateX(-100%)' : 'none'}
        style:top={`${g.y0 + 2}px`}
        >{marcaTexto}</span
      >
    {/if}
    {#if g.X}
      {#each pines as p (p.clave)}
        {#if p.ciclo >= g.c0 && p.ciclo <= g.c1}
          <button
            type="button"
            class="pin"
            class:sel={p.sel}
            style:left={`${g.X(p.ciclo)}px`}
            style:top={`${g.y0 + 4}px`}
            style:background={ct(p.color)}
            title={p.titulo}
            aria-label={p.titulo}
            aria-pressed={p.sel}
            onclick={() => onpin?.(p.clave)}
          ></button>
        {/if}
      {/each}
    {/if}
    {#if tip}
      <div
        class="tip"
        style:left={`${tip.izquierda ? tip.x - 10 : tip.x + 10}px`}
        style:transform={tip.izquierda ? 'translateX(-100%)' : 'none'}
        style:top={`${g.y0}px`}
      >
        <div class="mono tip-ciclo">{t('analizar.grafico.ciclo', { n: num(tip.ciclo) })}</div>
        {#each tip.filas as f (f.clave)}
          <div class="tip-fila">
            <span class="sw" style:background={ct(f.color)}></span>
            <span class="tip-nombre">{f.nombre}</span>
            <span class="mono">{valor(f.v)}</span>
            {#if f.min !== null && f.max !== null}
              <span class="mono rango">{valor(f.min)}–{valor(f.max)}</span>
            {/if}
          </div>
        {/each}
        {#if tip.total !== null}
          <div class="tip-fila total">
            <span class="tip-nombre">{t('analizar.grafico.total')}</span>
            <span class="mono">{valor(tip.total)}</span>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
{#if leyenda && g && !g.vacio && series.length > 1}
  <div class="leyenda">
    {#each series as s (s.clave)}
      <span><span class="sw" style:background={ct(s.color)}></span>{s.nombre}</span>
    {/each}
  </div>
{/if}

<style>
.grafico {
  position: relative;
  width: 100%;
  min-width: 0;
}
svg {
  display: block;
  touch-action: pan-y;
}
.rejilla {
  stroke: var(--grafico-rejilla);
  stroke-width: 1;
  fill: none;
}
.base {
  stroke: var(--grafico-eje);
  stroke-width: 1;
  fill: none;
}
.marca {
  stroke: var(--texto);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  fill: none;
}
.cursor {
  stroke: #898781;
  stroke-width: 1;
  fill: none;
}
.tick {
  font-family: var(--mono);
  font-size: 10px;
  fill: var(--gris-claro);
  font-variant-numeric: tabular-nums;
}
.vacio {
  margin: 0;
  padding: 24px 8px;
  font-size: 13px;
  color: var(--gris-claro);
}
.marca-chip {
  position: absolute;
  background: var(--texto);
  color: var(--fondo);
  pointer-events: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pin {
  position: absolute;
  width: 11px;
  height: 11px;
  margin-left: -5.5px;
  border-radius: 50%;
  border: 1.5px solid var(--tarjeta);
  padding: 0;
  cursor: pointer;
}
.pin.sel {
  width: 15px;
  height: 15px;
  margin-left: -7.5px;
  margin-top: -2px;
  box-shadow: 0 0 0 2px var(--texto);
}
.tip {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  background: var(--tarjeta);
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  box-shadow: 0 2px 10px var(--sombra);
  padding: 6px 8px;
  font-size: 12px;
  min-width: 140px;
  max-width: 280px;
}
.tip-ciclo {
  font-size: 11px;
  color: var(--gris-claro);
  margin-bottom: 4px;
}
.tip-fila {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 0;
}
.tip-fila.total {
  border-top: 1px solid var(--borde);
  margin-top: 3px;
  padding-top: 3px;
  font-weight: 600;
}
.tip-nombre {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rango {
  color: var(--gris-claro);
  font-size: 11px;
}
.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--chip-texto);
}
.leyenda > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
