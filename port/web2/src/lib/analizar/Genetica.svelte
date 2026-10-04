<script>
// @ts-check
// Genética de Analizar: histogramas de la última muestra (todas las
// especies: los 9 kinds del motor; una especie: los vivos del linaje) y su
// evolución como mapa de calor, y el ADN dominante de una especie comparado
// gen por gen con el de su fundador (decisión 9).
import { HISTOGRAMAS } from '../../../engine/metricas.js';
import { num, t } from '../../i18n/index.svelte.js';
import { colorEspecie, especiesPorImportancia } from './catalogo.js';
import {
  finMapa,
  histogramaEspecie,
  KINDS_LINAJE,
  mapaCalor,
  mediana,
  memoComparaciones,
  pathsMapa,
  ultimoHistograma,
} from './genetica.js';
import { corto, escalaLineal, indiceCercano, ticksLindos } from './grafico/escala.js';

/**
 * @type {{
 *   fuente: import('./fuente.js').FuenteAnalisis,
 *   seleccionada: string,
 *   onSeleccionar: (nombre: string) => void,
 * }}
 */
let { fuente, seleccionada, onSeleccionar } = $props();

/** '' = todas las especies (histogramas); la comparación de ADN usa `seleccionada`. */
let ambito = $state('');
let kind = $state('adn');
/** @type {number | null} índice de la foto (null = la última) */
let foto = $state(null);
let anchoH = $state(0);
let anchoM = $state(0);

const H_ALTO = 150;
const M_ALTO = 170;
const MAX_CAMBIOS = 30;

const especies = $derived(especiesPorImportancia(fuente.historia));
const kinds = $derived(ambito ? Object.keys(KINDS_LINAJE) : [...HISTOGRAMAS]);
const kindOk = $derived(kinds.includes(kind) ? kind : kinds[0]);
const esp = $derived(seleccionada || especies[0] || '');

const hist = $derived(
  ambito
    ? histogramaEspecie(fuente.linaje, ambito, kindOk)
    : ultimoHistograma(fuente.historia, kindOk),
);

const dibujoH = $derived.by(() => {
  if (!hist?.n || anchoH <= 0) return null;
  const w = anchoH;
  const x0 = 8;
  const x1 = w - 8;
  const y0 = 6;
  const y1 = H_ALTO - 20;
  const top = Math.max(1, ...hist.bins);
  const tk = ticksLindos(0, top, 3);
  const Y = escalaLineal(0, tk.max, y1, y0);
  const b = hist.bins.length;
  const bw = (x1 - x0) / b;
  let d = '';
  hist.bins.forEach((v, i) => {
    if (!v) return;
    const x = x0 + i * bw + 1;
    d += `M${x.toFixed(1)} ${y1}V${Y(v).toFixed(1)}H${(x + bw - 2).toFixed(1)}V${y1}Z`;
  });
  const med = mediana(hist);
  const X = escalaLineal(hist.min, hist.max > hist.min ? hist.max : hist.min + 1, x0, x1);
  return {
    w,
    d,
    y1,
    x0,
    x1,
    med,
    xMed: med === null ? null : X(med),
    ticks: [hist.min, (hist.min + hist.max) / 2, hist.max],
  };
});

const mapa = $derived(ambito ? null : mapaCalor(fuente.historia, kindOk));
const dibujoM = $derived.by(() => {
  if (!mapa || anchoM <= 0) return null;
  const x0 = 44;
  const x1 = anchoM - 8;
  const y0 = 6;
  const y1 = M_ALTO - 20;
  // columnas ubicadas por ciclo, hasta el último ciclo de la historia
  const c0 = mapa.ciclos[0];
  const c1 = finMapa(mapa.ciclos, fuente.historia.ultimoCiclo);
  return {
    w: anchoM,
    capas: pathsMapa(mapa, x0, x1, y0, y1, 6, c1),
    x0,
    x1,
    y0,
    y1,
    xt: [
      { v: c0, x: x0, a: 'start' },
      { v: c1, x: x1, a: 'end' },
    ],
    yt: [
      { v: mapa.min, y: y1 },
      { v: mapa.max, y: y0 + 8 },
    ],
  };
});

// ---- ADN dominante vs fundador ------------------------------------------------

const fotos = $derived(fuente.linaje.fotos.get(esp) ?? []);
const iFoto = $derived(foto !== null && foto > 0 && foto < fotos.length ? foto : fotos.length - 1);

// La comparación se memoriza por par de hashes de fotos: en vivo el Panel
// se refresca cada segundo, pero el ADN de una foto no cambia.
const comparar = memoComparaciones();

const comp = $derived.by(() => {
  if (fotos.length < 1) return null;
  const a = fotos[0];
  const b = fotos[iFoto];
  const r = comparar(a, b, MAX_CAMBIOS);
  const h = fuente.historia;
  const i = indiceCercano(h.t, b.ciclo);
  const vivos = i >= 0 ? h.alineada('vivos', esp)[i] : Number.NaN;
  return {
    ...r,
    a,
    b,
    fraccion: Number.isFinite(vivos) && vivos > 0 ? Math.min(1, b.copias / vivos) : null,
  };
});

/** @param {number} v */
const fmt = (v) => corto(v, (n) => num(n));

/** @param {Event} e */
function elegirEspecie(e) {
  foto = null;
  onSeleccionar(/** @type {HTMLSelectElement} */ (e.currentTarget).value);
}
</script>

<div class="genetica">
  <div class="izq">
    <label class="campo">
      {t('analizar.gen.ambito')}
      <select class="sel" bind:value={ambito}>
        <option value="">{t('analizar.gen.todas')}</option>
        {#each especies as e (e)}
          <option value={e}>{e}</option>
        {/each}
      </select>
    </label>
    <fieldset class="kinds">
      <legend class="oculto">{t('analizar.gen.kinds')}</legend>
      {#each kinds as k (k)}
        <button
          type="button"
          class="kind"
          class:on={k === kindOk}
          aria-pressed={k === kindOk}
          onclick={() => (kind = k)}
        >
          {t(`analizar.hist.${k}`)}
        </button>
      {/each}
    </fieldset>

    <section class="card bloque">
      <div class="cab">
        <h2 class="h2">{t(`analizar.hist.${kindOk}`)}</h2>
        {#if hist?.n}
          <span class="sub"
            >{t('analizar.gen.histSub', { n: num(hist.n), ciclo: num(Math.max(0, hist.ciclo)) })}</span
          >
        {/if}
      </div>
      <div class="hist" bind:clientWidth={anchoH} style:height={`${H_ALTO}px`}>
        {#if dibujoH && hist}
          <svg
            width={dibujoH.w}
            height={H_ALTO}
            role="img"
            aria-label={t('analizar.gen.histAria', { kind: t(`analizar.hist.${kindOk}`) })}
          >
            <path
              d={dibujoH.d}
              style:fill={ambito ? colorEspecie(ambito, fuente.colores) : 'var(--acento)'}
              fill-opacity="0.85"
            ></path>
            <path
              d={`M${dibujoH.x0} ${dibujoH.y1}H${dibujoH.x1}`}
              style:stroke="var(--grafico-eje)"
              fill="none"
            ></path>
            {#if dibujoH.xMed !== null}
              <path
                d={`M${dibujoH.xMed.toFixed(1)} 4V${dibujoH.y1}`}
                style:stroke="var(--texto)"
                stroke-width="1.5"
                stroke-dasharray="4 3"
                fill="none"
              ></path>
            {/if}
            {#each dibujoH.ticks as v, i (i)}
              <text
                class="tick"
                x={i === 0 ? dibujoH.x0 : i === 2 ? dibujoH.x1 : (dibujoH.x0 + dibujoH.x1) / 2}
                y={H_ALTO - 5}
                text-anchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
              >
                {fmt(v)}
              </text>
            {/each}
          </svg>
          {#if dibujoH.xMed !== null && dibujoH.med !== null}
            <span
              class="chip med"
              style:left={`${dibujoH.xMed > dibujoH.w * 0.6 ? dibujoH.xMed - 6 : dibujoH.xMed + 6}px`}
              style:transform={dibujoH.xMed > dibujoH.w * 0.6 ? 'translateX(-100%)' : 'none'}
              >{t('analizar.gen.mediana', { v: fmt(dibujoH.med) })}</span
            >
          {/if}
        {:else}
          <p class="sub">{t('analizar.gen.sinHist')}</p>
        {/if}
      </div>
    </section>

    {#if !ambito}
      <section class="card bloque">
        <div class="cab">
          <h2 class="h2">{t('analizar.gen.evolucion')}</h2>
          <span class="sub">{t('analizar.gen.evolucionSub')}</span>
        </div>
        <div class="hist" bind:clientWidth={anchoM} style:height={`${M_ALTO}px`}>
          {#if dibujoM}
            <svg
              width={dibujoM.w}
              height={M_ALTO}
              role="img"
              aria-label={t('analizar.gen.evolucionAria', { kind: t(`analizar.hist.${kindOk}`) })}
            >
              <rect
                x={dibujoM.x0}
                y={dibujoM.y0}
                width={dibujoM.x1 - dibujoM.x0}
                height={dibujoM.y1 - dibujoM.y0}
                style:fill="var(--fondo)"
              ></rect>
              {#each dibujoM.capas as c (c.op)}
                <path d={c.d} style:fill="var(--acento)" fill-opacity={c.op}></path>
              {/each}
              {#each dibujoM.xt as tk (tk.a)}
                <text class="tick" x={tk.x} y={M_ALTO - 5} text-anchor={tk.a}>{fmt(tk.v)}</text>
              {/each}
              {#each dibujoM.yt as tk, i (i)}
                <text class="tick" x={dibujoM.x0 - 6} y={tk.y} text-anchor="end">{fmt(tk.v)}</text>
              {/each}
            </svg>
          {:else}
            <p class="sub">{t('analizar.gen.sinEvolucion')}</p>
          {/if}
        </div>
      </section>
    {/if}
  </div>

  <section class="card adn">
    <div class="adn-cab">
      <h2 class="h2">{t('analizar.gen.dominante', { especie: esp || '—' })}</h2>
      <label class="campo">
        {t('analizar.gen.especie')}
        <select class="sel" value={esp} onchange={elegirEspecie}>
          {#each especies as e (e)}
            <option value={e}>{e}</option>
          {/each}
        </select>
      </label>
      {#if fotos.length > 1}
        <label class="campo">
          {t('analizar.gen.foto')}
          <select
            class="sel"
            value={iFoto}
            onchange={(e) => (foto = Number(/** @type {HTMLSelectElement} */ (e.currentTarget).value))}
          >
            {#each fotos as f, i (i)}
              {#if i > 0}
                <option value={i}>{t('analizar.gen.fotoCiclo', { ciclo: num(f.ciclo) })}</option>
              {/if}
            {/each}
          </select>
        </label>
      {/if}
    </div>
    {#if !comp}
      <p class="sub">{t('analizar.gen.sinFotos')}</p>
    {:else}
      <div class="tiles">
        <div class="tile">
          <b class="mono"
            >{t('analizar.gen.deN', { a: num(comp.distintos), b: num(comp.d.cambios.length) })}</b
          ><span>{t('analizar.gen.genesCambiaron')}</span>
        </div>
        <div class="tile">
          <b class="mono">{num(comp.a.adnLen)} → {num(comp.b.adnLen)}</b
          ><span>{t('analizar.gen.instrucciones')}</span>
        </div>
        <div class="tile">
          <b class="mono">{num(comp.distancia * 100, { maximumFractionDigits: 1 })} %</b
          ><span>{t('analizar.gen.distancia')}</span>
        </div>
        <div class="tile">
          <b class="mono"
            >{comp.fraccion === null
  ? num(comp.b.copias)
  : `${num(comp.fraccion * 100, { maximumFractionDigits: 0 })} %`}</b
          ><span>{t(comp.fraccion === null ? 'analizar.gen.copias' : 'analizar.gen.llevan')}</span>
        </div>
      </div>
      <p class="sub">
        {t('analizar.gen.fundadorVs', { a: num(comp.a.ciclo), b: num(comp.b.ciclo) })}
      </p>
      <ul class="celdas" aria-label={t('analizar.gen.genes')}>
        {#each comp.celdas as c (c.k)}
          <li class={`gcell ${c.tipo}`} title={t(`analizar.gen.tipo.${c.tipo}`, { n: c.n })}>
            {c.n}
          </li>
        {/each}
      </ul>
      <div class="leyenda">
        {#each ['igual', 'cambiado', 'agregado', 'quitado'] as tp (tp)}
          <span><span class={`sw ${tp}`}></span>{t(`analizar.gen.ley.${tp}`)}</span>
        {/each}
      </div>
      {#if comp.cambios.length}
        <div class="cambios">
          {#each comp.cambios as c (c.k)}
            <div class="cambio">
              <div class="cambio-cab">
                <span class="mono"
                  >{t(c.fundador ? 'analizar.gen.genFundador' : 'analizar.gen.gen', { n: c.n })}</span
                >
                <span class={`chip ${c.tipo}`}>{t(`analizar.gen.ley.${c.tipo}`)}</span>
              </div>
              {#if c.antes}
                <div class="diff menos">
                  <span class="signo">−</span>
                  {#each c.antes as p, i (i)}
                    <span class:dif={p.cambio}>{p.w}</span>{' '}
                  {/each}
                </div>
              {/if}
              {#if c.despues}
                <div class="diff mas">
                  <span class="signo">+</span>
                  {#each c.despues as p, i (i)}
                    <span class:dif={p.cambio}>{p.w}</span>{' '}
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
          {#if comp.resto}
            <p class="sub">{t('analizar.gen.masCambios', { n: num(comp.resto) })}</p>
          {/if}
        </div>
      {:else}
        <p class="sub">{t('analizar.gen.sinCambios')}</p>
      {/if}
      <details>
        <summary>{t('analizar.gen.adnCompleto', { ciclo: num(comp.b.ciclo) })}</summary>
        <pre class="mono">{comp.b.adn}</pre>
      </details>
    {/if}
  </section>
</div>

<style>
.genetica {
  display: grid;
  grid-template-columns: minmax(0, 520px) minmax(0, 1fr);
  gap: 24px;
}
.izq {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.campo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--gris);
}
.campo .sel {
  flex: 1;
  min-width: 0;
}
.kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.kind {
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--borde-control);
  background: var(--tarjeta);
  border-radius: 999px;
  padding: 4px 10px;
  cursor: pointer;
  color: var(--texto);
}
.kind.on {
  background: var(--activo-fondo);
  border-color: var(--activo-fondo);
  color: var(--activo-texto);
}
.bloque {
  padding: 12px 16px;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}
.hist {
  position: relative;
  width: 100%;
}
svg {
  display: block;
}
.tick {
  font-family: var(--mono);
  font-size: 10px;
  fill: var(--gris-claro);
}
.med {
  position: absolute;
  top: 2px;
  background: var(--texto);
  color: var(--fondo);
  pointer-events: none;
}
.adn {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.adn-cab {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.adn-cab .h2 {
  flex: 1;
  min-width: 220px;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}
.celdas {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.gcell {
  width: 30px;
  height: 30px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 11px;
}
.gcell.igual,
.sw.igual {
  background: var(--chip);
  color: var(--gris);
  border: 1px solid var(--borde-control);
  box-sizing: border-box;
}
.gcell.cambiado,
.sw.cambiado,
.chip.cambiado {
  background: #2a78d6;
  color: #ffffff;
}
.gcell.agregado,
.sw.agregado,
.chip.agregado {
  background: #0f5c55;
  color: #ffffff;
}
.gcell.quitado,
.sw.quitado,
.chip.quitado {
  background: #eb6834;
  color: #151513;
}
.gcell.quitado {
  text-decoration: line-through;
}
.leyenda {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--chip-texto);
  flex-wrap: wrap;
}
.leyenda > span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cambios {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 460px;
  overflow: auto;
}
.cambio {
  border-top: 1px solid var(--borde);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cambio-cab {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.diff {
  font-family: var(--mono);
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}
.diff.menos {
  background: var(--diff-menos-fondo);
  color: var(--diff-menos-texto);
}
.diff.mas {
  background: var(--diff-mas-fondo);
  color: var(--diff-mas-texto);
}
.diff .dif {
  font-weight: 600;
  text-decoration: underline;
}
.signo {
  margin-right: 6px;
}
details summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--acento);
}
pre {
  font-size: 12px;
  line-height: 1.5;
  background: var(--fondo);
  border-radius: 6px;
  padding: 10px;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
}
@media (max-width: 1000px) {
  .genetica {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
