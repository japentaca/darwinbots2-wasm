<script>
// @ts-check
// Panel «En vivo» de Observar: ciclo, cuatro tarjetas, población por
// especie y el feed de eventos. Vivos, vegetales y energía salen del frame
// (metricas.js); especies, extinciones y generación, del frame con la vista
// enriquecida o de las muestras del worker con cualquier vista (N2.1), y el
// gráfico, de la historia de la corrida (engine/history.js).
import { num, t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { cicloVisible } from '../sim/ciclo.js';
import FeedEventos from './FeedEventos.svelte';
import GraficoPoblacion from './GraficoPoblacion.svelte';

/**
 * @type {{ corrida: import('../sim/corrida-nucleo.js').NucleoCorrida, amplio?: boolean }}
 * amplio: disposición Datos de Observar (TC3): el gráfico a la derecha.
 */
let { corrida, amplio = false } = $props();

const e = $derived(corrida.estado);
const vivo = $derived(e.vivo);
const VENTANA = 1000;

/** @param {number} d */
const conSigno = (d) => (d > 0 ? `+${num(d)}` : d < 0 ? `−${num(-d)}` : '±0');

const tarjetas = $derived.by(() => {
  if (!vivo) return [];
  const ext = vivo.extinguidas;
  return [
    {
      k: 'vivos',
      l: t('observar.tarjeta.vivos'),
      v: num(vivo.vivos),
      d:
        vivo.variacion === null
          ? t('observar.tarjeta.vivos.sinVariacion', { ventana: num(VENTANA) })
          : t('observar.tarjeta.vivos.variacion', {
              d: conSigno(vivo.variacion),
              ventana: num(VENTANA),
            }),
    },
    {
      k: 'especies',
      l: t('observar.tarjeta.especies'),
      v: num(vivo.especies.length),
      d:
        ext === null
          ? t('observar.tarjeta.especies.soloRica')
          : ext === 0
            ? t('observar.tarjeta.especies.ninguna')
            : ext === 1
              ? t('observar.tarjeta.especies.una')
              : t('observar.tarjeta.especies.varias', { n: num(ext) }),
    },
    {
      k: 'nrg',
      l: t('observar.tarjeta.nrg'),
      v: num(Math.round(vivo.nrgMedia)),
      d: t('observar.tarjeta.nrg.detalle'),
    },
    {
      k: 'gen',
      l: t('observar.tarjeta.gen'),
      v: vivo.porEspecie && Number.isFinite(vivo.genMax) ? num(vivo.genMax) : '—',
      d: vivo.porEspecie ? vivo.genEspecie || '—' : t('observar.tarjeta.gen.soloRica'),
    },
  ];
});

const actuales = $derived(Object.fromEntries((vivo?.especies ?? []).map((s) => [s.nombre, s.n])));
</script>

<div class="panel" class:amplio={amplio}>
  <div class="cab">
    <span class="lbl">{t('observar.panel.titulo')}</span>
    {#if vivo}
      <span class="mono ciclo"
        >{t('observar.panel.ciclo', { n: num(cicloVisible(vivo.ciclo)) })}</span
      >
    {/if}
  </div>
  {#if vivo}
    <div class="tarjetas">
      {#each tarjetas as c (c.k)}
        <div class="card tarjeta">
          <span class="l">{c.l}</span>
          <span class="v">{c.v}</span>
          <span class="d" title={c.d}>{c.d}</span>
        </div>
      {/each}
    </div>
    {#if !vivo.porEspecie}
      <p class="nota">{t('observar.tarjeta.clasica')}</p>
    {/if}
  {:else}
    <p class="nota">{t('observar.panel.esperando')}</p>
  {/if}
  <div class="grafico">
    <GraficoPoblacion
      muestras={e.muestras}
      colores={e.colores}
      intervalo={e.intervalo}
      {actuales}
    />
  </div>
  <FeedEventos feed={e.feed} />
  <a class="analisis" href={hashDe('analizar')}>{t('observar.analisis')}</a>
</div>

<style>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.ciclo {
  font-size: 13px;
  color: var(--gris);
}
.tarjetas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.tarjeta {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.l {
  font-size: 12px;
  color: var(--gris);
}
.v {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.d {
  font-size: 12px;
  color: var(--gris-claro);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nota {
  margin: -6px 0 0;
  font-size: 12px;
  color: var(--gris-claro);
}
.analisis {
  font-size: 14px;
  font-weight: 500;
}
/* Datos: dos columnas, el gráfico a la derecha */
.panel.amplio {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
}
.amplio > * {
  grid-column: 1;
}
.amplio > .cab {
  grid-column: 1 / -1;
}
.amplio > .grafico {
  grid-column: 2;
  grid-row: 2 / span 4;
}
@media (max-width: 900px) {
  .panel.amplio {
    display: flex;
  }
}
</style>
