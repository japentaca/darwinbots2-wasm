<script>
// @ts-check
// Franja del torneo en curso (PLAN-TORNEO-EN-CURSO.md, TC2: T3 y T9): bajo
// la barra superior, en todas las pantallas, mientras el avance está
// encendido. Muestra el torneo, la edición, el progreso de la temporada y
// el estado de la pelea (franjaTV de rotulo.js), con «Ver» (lleva a
// Observar), «Al terminar la pelea» y Parar o Abandonar la pelea (los
// mismos controles que el rótulo de Observar). Tras una recarga, si había
// un torneo en curso, ofrece «Reanudar» (no arranca solo). La región viva
// que anuncia las fases es la del rótulo de Observar: acá no se repite.
// BarraSuperior la carga con import dinámico (como la cola de trabajos).
// Los avisos de los bloqueos (TC4, AvisoTorneo.svelte) llevan el foco acá
// (irAFranja) y la franja se ilumina un momento.
import { idioma, t } from '../../../i18n/index.svelte.js';
import { hashDe } from '../../../router.js';
import { tr } from '../../competir/torneos.svelte.js';
import { franjaTV } from './rotulo.js';
import {
  AL_TERMINAR,
  abandonarPelea,
  avanceEncendido,
  contextoTv,
  descartarReanudar,
  detenerTv,
  hayPelea,
  ID_FRANJA,
  pararTv,
  ponerAlTerminar,
  reanudarTv,
  seguirTv,
  tv,
} from './tv.svelte.js';

/** @type {{ seccion: import('../../../router.js').Seccion }} */
let { seccion } = $props();

const encendido = $derived(avanceEncendido());
const conPelea = $derived(hayPelea());
const f = $derived.by(() => {
  idioma();
  return encendido ? franjaTV(tv.e, contextoTv(), tr, tv.ahora, tv.pararTras) : null;
});
const cortado = $derived(!encendido && tv.reanudable ? contextoTv(tv.reanudable).torneo : '');

function abandonar() {
  if (confirm(t('observar.tv.abandonarSi'))) abandonarPelea();
}
</script>

{#if f}
  <section
    class="franja"
    class:vivo={f.vivo}
    class:error={f.error}
    id={ID_FRANJA}
    tabindex="-1"
    aria-label={t('observar.tv.aria')}
  >
    <span class="punto" aria-hidden="true"></span>
    <span class="texto" title={`${f.titulo} · ${f.estado}`}
      ><strong>🏆 {f.titulo}</strong>
      · {f.estado}</span
    >
    {#if seccion !== 'observar'}
      <a class="btn" href={hashDe('observar')} title={t('observar.tv.franja.ver.ayuda')}
        >{t('observar.tv.franja.ver')}</a
      >
    {/if}
    {#if f.error}
      <button class="btn" type="button" onclick={detenerTv}>{t('observar.tv.cerrar')}</button>
    {:else}
      <label class="campo" title={t('observar.tv.alTerminar.ayuda')}
        ><span class="lbl">{t('observar.tv.alTerminar')}</span>
        <select value={tv.alTerminar} onchange={(e) => ponerAlTerminar(e.currentTarget.value)}>
          {#each AL_TERMINAR as k (k)}
            <option value={k}>{t(`observar.tv.alTerminar.${k}`)}</option>
          {/each}
        </select></label
      >
      {#if tv.pararTras}
        <button class="btn" type="button" title={t('observar.tv.seguir.ayuda')} onclick={seguirTv}>
          {t('observar.tv.seguir')}
        </button>
      {:else}
        <button
          class="btn"
          type="button"
          title={t(conPelea ? 'observar.tv.pararTras.ayuda' : 'observar.tv.parar.ayuda')}
          onclick={pararTv}
        >
          ⏹ {t(conPelea ? 'observar.tv.pararTras' : 'observar.tv.parar')}
        </button>
      {/if}
      {#if conPelea}
        <button
          class="btn"
          type="button"
          title={t('observar.tv.abandonar.ayuda')}
          onclick={abandonar}
        >
          {t('observar.tv.abandonar')}
        </button>
      {/if}
    {/if}
  </section>
{:else if cortado}
  <section class="franja" aria-label={t('observar.tv.aria')}>
    <span class="punto" aria-hidden="true"></span>
    <span class="texto">🏆 {t('observar.tv.franja.cortado', { torneo: cortado })}</span>
    <button
      class="btn pri"
      type="button"
      title={t('observar.tv.franja.reanudar.ayuda')}
      onclick={reanudarTv}
    >
      ▶ {t('observar.tv.franja.reanudar')}
    </button>
    <button class="btn" type="button" onclick={descartarReanudar}>
      {t('observar.tv.franja.descartar')}
    </button>
  </section>
{/if}

<style>
.franja {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 4px 24px;
  background: #1c2624;
  border-bottom: 1px solid var(--barra-borde);
  color: #bfe9e2;
  font-size: 13px;
  box-sizing: border-box;
  flex-wrap: wrap;
}
/* los avisos de los bloqueos (AvisoTorneo) llevan acá: la franja se ilumina */
.franja:focus {
  outline: none;
}
.franja:global(.llamada) {
  animation: llamada 1.2s ease-out;
}
@keyframes llamada {
  from {
    box-shadow: inset 0 0 0 2px #e0b050;
    background: #2e3a2a;
  }
  to {
    box-shadow: inset 0 0 0 2px transparent;
  }
}
.punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8a887f;
  flex-shrink: 0;
}
.vivo .punto {
  background: #e05a4f;
}
.error .punto {
  background: #e0b050;
}
.texto {
  flex: 1 1 240px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.texto strong {
  color: #ffffff;
  font-weight: 600;
}
.btn {
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #3a4a47;
  background: transparent;
  color: #e6f4f1;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover {
  background: #2a3a37;
  color: #ffffff;
}
.btn.pri {
  background: #2e4f4b;
}
.campo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.campo select {
  font: inherit;
  font-size: 12px;
  max-width: 220px;
  background: #151b1a;
  color: #e6f4f1;
  border: 1px solid #3a4a47;
  border-radius: 6px;
  padding: 2px 4px;
}
@media (max-width: 640px) {
  .franja {
    padding: 4px 16px;
  }
  /* sin espacio, el rótulo queda solo para el lector de pantalla */
  .campo .lbl {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
