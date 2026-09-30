<script>
// @ts-check
// Especies de Analizar: tabla por especie (orden por columna, sparkline de
// bots vivos) y la ficha de la elegida (números, población con su banda
// mín–máx y comportamiento reciente).
import { num, t } from '../../i18n/index.svelte.js';
import { colorEspecie, serieAlineada } from './catalogo.js';
import {
  COLUMNAS,
  comportamientoEspecie,
  filasEspecies,
  ordenarFilas,
  sparkline,
} from './especies.js';
import Grafico from './grafico/Grafico.svelte';

/**
 * @type {{
 *   fuente: import('./fuente.js').FuenteAnalisis,
 *   dominio: [number, number] | null,
 *   marca: number | null,
 *   marcaTexto: string,
 *   seleccionada: string,
 *   onSeleccionar: (nombre: string) => void,
 *   irA: (pestaña: string) => void,
 * }}
 */
let { fuente, dominio, marca, marcaTexto, seleccionada, onSeleccionar, irA } = $props();

let col = $state('vivos');
let asc = $state(false);

const SPARK_W = 110;
const SPARK_H = 22;

const todas = $derived(filasEspecies(fuente.historia, fuente.linaje));
const filas = $derived(ordenarFilas(todas, col, asc));
const sel = $derived(todas.find((f) => f.nombre === seleccionada) ?? null);

/** @param {string} c */
function ordenar(c) {
  if (col === c) asc = !asc;
  else {
    col = c;
    asc = c === 'nombre' || c === 'aparicion';
  }
}

/** @param {number | null} v @param {number} [dec] */
function n(v, dec = 0) {
  return v === null || !Number.isFinite(v) ? '—' : num(v, { maximumFractionDigits: dec });
}

const ficha = $derived.by(() => {
  if (!sel) return null;
  const h = fuente.historia;
  // alineada con h.t: la línea se corta donde la especie no estaba
  const s = serieAlineada(h, 'vivos', sel.nombre);
  const color = colorEspecie(sel.nombre, fuente.colores);
  const reg = fuente.linaje.especies.get(sel.nombre);
  let origen;
  if (reg?.madre) origen = t('analizar.esp.derivada', { madre: reg.madre, ciclo: num(reg.ciclo) });
  else if (sel.aparicion !== null)
    origen = t('analizar.esp.fundadora', { ciclo: num(sel.aparicion) });
  else origen = '';
  if (sel.extincion !== null)
    origen += ` · ${t('analizar.esp.extinguida', { ciclo: num(sel.extincion) })}`;
  const comp = comportamientoEspecie(h, sel.nombre);
  const maxComp = comp ? Math.max(1e-9, ...comp.map((c) => c.v)) : 1;
  return {
    color,
    origen,
    series: s.v.some((x) => Number.isFinite(x))
      ? [{ clave: sel.nombre, nombre: sel.nombre, color, ...s }]
      : [],
    tiles: [
      [t('analizar.col.vivos'), n(sel.vivos)],
      [
        sel.cicloMax === null
          ? t('analizar.col.max')
          : t('analizar.esp.pico', { ciclo: num(sel.cicloMax) }),
        n(sel.max),
      ],
      [t('analizar.col.genMax'), n(sel.genMax)],
      [t('analizar.col.adnMedia'), n(sel.adnMedia)],
      [t('analizar.col.mutMedia'), n(sel.mutMedia, 1)],
      [t('analizar.col.nrgMedia'), n(sel.nrgMedia)],
      [t('analizar.col.edadMedia'), n(sel.edadMedia)],
      [t('analizar.col.hijosMedia'), n(sel.hijosMedia, 1)],
    ],
    comp: comp?.map((c) => ({ ...c, w: (c.v / maxComp) * 100 })) ?? null,
  };
});
</script>

<div class="especies">
  <section class="card tabla">
    {#if filas.length}
      <div class="scroll">
        <table class="tbl">
          <thead>
            <tr>
              {#each COLUMNAS as c (c)}
                <th scope="col" aria-sort={col === c ? (asc ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" class="orden" onclick={() => ordenar(c)}>
                    {t(`analizar.col.${c}`)}
                    {#if col === c}
                      <span aria-hidden="true">{asc ? ' ↑' : ' ↓'}</span>
                    {/if}
                  </button>
                </th>
              {/each}
              <th scope="col">{t('analizar.col.spark')}</th>
            </tr>
          </thead>
          <tbody>
            {#each filas as f (f.nombre)}
              <tr class:sel={f.nombre === seleccionada} class:extinta={f.extincion !== null}>
                <td>
                  <button
                    type="button"
                    class="nombre"
                    aria-pressed={f.nombre === seleccionada}
                    onclick={() => onSeleccionar(f.nombre)}
                  >
                    <span
                      class="sw"
                      style:background={colorEspecie(f.nombre, fuente.colores)}
                    ></span>
                    <span class="txt">{f.nombre}</span>
                  </button>
                </td>
                <td class="mono">{n(f.vivos)}</td>
                <td class="mono">{n(f.max)}</td>
                <td class="mono">{n(f.aparicion)}</td>
                <td class="mono">
                  {f.extincion === null ? t('analizar.esp.viva') : n(f.extincion)}
                </td>
                <td class="mono">{n(f.genMax)}</td>
                <td class="mono">{n(f.mutMedia, 1)}</td>
                <td class="mono">{n(f.adnMedia)}</td>
                <td class="mono">{n(f.nrgMedia)}</td>
                <td class="mono">{n(f.edadMedia)}</td>
                <td class="mono">{n(f.hijosMedia, 1)}</td>
                <td>
                  <svg width={SPARK_W} height={SPARK_H} aria-hidden="true">
                    <path
                      d={sparkline(fuente.historia.t, f.spark, SPARK_W, SPARK_H)}
                      fill="none"
                      stroke={colorEspecie(f.nombre, fuente.colores)}
                      stroke-width="1.5"
                    ></path>
                  </svg>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="sub vacio">{t('analizar.sinEspecies')}</p>
    {/if}
  </section>

  {#if sel && ficha}
    <section class="card ficha">
      <div class="ficha-cab">
        <span class="sw grande" style:background={ficha.color}></span>
        <div class="ficha-tit">
          <h2>{sel.nombre}</h2>
          {#if ficha.origen}
            <div class="sub">{ficha.origen}</div>
          {/if}
        </div>
        <button class="btn sm" type="button" onclick={() => irA('filogenia')}>
          {t('analizar.esp.verFilogenia')}
        </button>
        <button class="btn sm" type="button" onclick={() => irA('genetica')}>
          {t('analizar.esp.verAdn')}
        </button>
      </div>
      <div class="tiles">
        {#each ficha.tiles as [l, v] (l)}
          <div class="tile"><b class="mono">{v}</b><span>{l}</span></div>
        {/each}
      </div>
      <div class="ficha-graf">
        <div class="bloque">
          <div class="cab">
            <h3 class="h2">{t('analizar.esp.poblacion')}</h3>
            <span class="sub">{t('analizar.esp.poblacionSub')}</span>
          </div>
          <Grafico
            series={ficha.series}
            alto={230}
            {marca}
            {marcaTexto}
            {dominio}
            cero
            aria={t('analizar.esp.poblacion')}
          />
        </div>
        <div class="bloque">
          <div class="cab">
            <h3 class="h2">{t('analizar.esp.comportamiento')}</h3>
            <span class="sub">{t('analizar.esp.comportamientoSub')}</span>
          </div>
          {#if ficha.comp}
            {#each ficha.comp as c (c.col)}
              <div class="barra-fila">
                <span>{t(`analizar.m.c.${c.col}`)}</span>
                <div class="bar">
                  <div style:width={`${c.w.toFixed(0)}%`} style:background={ficha.color}></div>
                </div>
                <span class="mono">{n(c.v, 1)}</span>
              </div>
            {/each}
          {:else}
            <p class="sub">{t('analizar.esp.sinComportamiento')}</p>
          {/if}
        </div>
      </div>
    </section>
  {/if}
</div>

<style>
.especies {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tabla {
  padding: 6px 10px;
}
.scroll {
  overflow-x: auto;
}
.orden {
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}
tr.sel td {
  background: #e3eeec;
  font-weight: 600;
}
tr.extinta td {
  color: var(--gris-claro);
}
.nombre {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  max-width: 220px;
  text-align: left;
}
.txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nombre:hover .txt {
  text-decoration: underline;
}
.vacio {
  padding: 12px 6px;
}
.ficha {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ficha-cab {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ficha-tit {
  flex: 1;
  min-width: 200px;
}
.ficha-tit h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.sw.grande {
  width: 18px;
  height: 18px;
  border-radius: 5px;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}
.ficha-graf {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 18px;
}
.bloque {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}
.barra-fila {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.barra-fila .mono {
  text-align: right;
}
.bar {
  height: 8px;
  border-radius: 4px;
  background: var(--chip);
  overflow: hidden;
}
.bar > div {
  height: 8px;
  border-radius: 4px;
}
@media (max-width: 1000px) {
  .ficha-graf {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
