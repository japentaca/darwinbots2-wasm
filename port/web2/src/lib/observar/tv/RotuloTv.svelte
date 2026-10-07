<script>
// @ts-check
// Avance automático del torneo (paso N3.6; PLAN-TORNEO-EN-CURSO.md TC1):
// lo que se dibuja sobre el campo. Arriba, la cabecera (torneo y edición),
// los segundos de cortinilla, «Al terminar la pelea», «Parar» (o «Seguir»
// si ya se pidió parar), «Abandonar la pelea» con una pelea en juego y, a
// pantalla completa, el botón para salir de ella; en el centro, la
// cortinilla (quién contra quién, la fase de la pelea y la cuenta atrás),
// el campeón o el error que paró el avance; abajo a la derecha, sin panel
// lateral (disposición Campo, TC3) y durante la pelea, la tarjeta oscura
// de PeleaTv.svelte (con panel va en su pestaña «Torneo»). Con el mundo en
// miniatura (disposición Datos) no se dibuja nada: lo muestra el panel. Una
// región viva fija (siempre montada, fuera de la vista) anuncia solo los
// cambios de fase; la cuenta atrás y el marcador quedan fuera de ella.
// En pantalla angosta (TC5) la cabecera no se dibuja salvo a pantalla
// completa: tapaba medio campo y sus controles ya están en la franja.
import { idioma, t } from '../../../i18n/index.svelte.js';
import { tr } from '../../competir/torneos.svelte.js';
import { PAUSA_MAX } from './maquina.js';
import PeleaTv from './PeleaTv.svelte';
import { anuncioTV, rotuloTV } from './rotulo.js';
import {
  AL_TERMINAR,
  abandonarPelea,
  contextoTv,
  detenerTv,
  hayPelea,
  pararTv,
  ponerAlTerminar,
  ponerPausa,
  seguirTv,
  tv,
} from './tv.svelte.js';

/**
 * @type {{ completa: boolean, onPantalla: () => void, campo?: boolean, mini?: boolean }}
 * completa: a pantalla completa; onPantalla sale de ella (no toca el avance);
 * campo: sin panel lateral (la tarjeta de la pelea va sobre el campo);
 * mini: el mundo en miniatura (solo la región viva).
 */
let { completa, onPantalla, campo = false, mini = false } = $props();

const conPelea = $derived(hayPelea());

function abandonar() {
  if (confirm(t('observar.tv.abandonarSi'))) abandonarPelea();
}

const r = $derived(rotuloTV(tv.e, contextoTv(), tr, tv.ahora, idioma()));
const anuncio = $derived(anuncioTV(tv.e, tr));
// primitivo: el efecto del foco corre solo cuando aparece el error, no en cada tic
const hayError = $derived(!!r.error);
const centro = $derived(
  r.fase === 'cortinilla' ||
    r.fase === 'campeon' ||
    r.fase === 'error' ||
    r.fase === 'edicion' ||
    r.fase === 'buscando',
);

/** @type {HTMLButtonElement | undefined} */
let btnGrande = $state();

// ante un error, el foco en el botón grande
$effect(() => {
  if (hayError && btnGrande) btnGrande.focus();
});
</script>

<div class="oculto" aria-live="polite" aria-atomic="true">{anuncio}</div>
{#if !mini}
  <section class="tv" aria-label={t('observar.tv.aria')}>
    <div class="cab" class:completa>
      <span class="titulo">🏆 {r.cabecera}</span>
      <label class="pausa" title={t('observar.tv.pausa.ayuda')}
        >{t('observar.tv.pausa')}
        <input
          type="number"
          min="0"
          max={PAUSA_MAX}
          value={tv.e.pausa}
          onchange={(e) => ponerPausa(e.currentTarget.value)}
        ></label
      >
      <label class="pausa" title={t('observar.tv.alTerminar.ayuda')}
        >{t('observar.tv.alTerminar')}
        <select value={tv.alTerminar} onchange={(e) => ponerAlTerminar(e.currentTarget.value)}>
          {#each AL_TERMINAR as k (k)}
            <option value={k}>{t(`observar.tv.alTerminar.${k}`)}</option>
          {/each}
        </select></label
      >
      {#if tv.pararTras}
        <span class="parara">{t('observar.tv.parara')}</span>
        <button
          class="salir"
          type="button"
          title={t('observar.tv.seguir.ayuda')}
          onclick={seguirTv}
        >
          {t('observar.tv.seguir')}
        </button>
      {:else}
        <button
          class="salir"
          type="button"
          title={t(conPelea ? 'observar.tv.pararTras.ayuda' : 'observar.tv.parar.ayuda')}
          onclick={pararTv}
        >
          ⏹ {t(conPelea ? 'observar.tv.pararTras' : 'observar.tv.parar')}
        </button>
      {/if}
      {#if conPelea}
        <button
          class="salir"
          type="button"
          title={t('observar.tv.abandonar.ayuda')}
          onclick={abandonar}
        >
          {t('observar.tv.abandonar')}
        </button>
      {/if}
      {#if completa}
        <button
          class="salir"
          type="button"
          title={t('observar.pantalla.salir.ayuda')}
          onclick={onPantalla}
        >
          {t('observar.pantalla.salir')}
        </button>
      {/if}
    </div>

    {#if centro}
      <div class="centro">
        <div class="linea">{r.linea}</div>
        {#if r.vs.length}
          <div class="vs">
            {#each r.vs as f, i (f.name)}
              {#if i > 0}
                <span class="contra">{t('observar.tv.contra')}</span>
              {/if}
              <span class="luchador"
                ><span class="sw" style:background={f.color}></span>{f.name}</span
              >
            {/each}
          </div>
        {/if}
        {#if r.etiqueta}
          <div class="etiqueta" class:grande={r.grande}>{r.etiqueta}</div>
        {/if}
        {#if r.campeon}
          <div class="campeon">🏆 {r.campeon}</div>
        {/if}
        {#if r.como}
          <div class="como">{r.como}</div>
        {/if}
        {#if r.pie}
          <div class="pie">{r.pie}</div>
        {/if}
        {#if r.error}
          <div class="error">{r.error}</div>
          <button class="salir grande" type="button" onclick={detenerTv} bind:this={btnGrande}>
            {t('observar.tv.cerrar')}
          </button>
        {/if}
        {#if r.aviso}
          <div class="aviso">{r.aviso}</div>
        {/if}
      </div>
    {:else if campo}
      <div class="tercio"><PeleaTv completa /></div>
    {/if}
  </section>
{/if}

<style>
.tv {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #f4f3ef;
  font-family: var(--sans);
  z-index: 4;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* la franja no toma el ratón (los chips del mundo quedan debajo): solo sus
   controles; va bajo los chips de arriba a la izquierda (top 16px, ~28px de
   alto) y a la izquierda de los botones de zoom (right 16px, 40px de ancho) */
.cab {
  pointer-events: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 52px 72px 10px 16px;
  background: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0));
  font-size: 14px;
}
.titulo {
  flex: 1;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pausa {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #c9c7bf;
  pointer-events: auto;
}
.pausa select {
  font: inherit;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid #52514e;
  background: #151513;
  color: #f4f3ef;
}
.parara {
  font-size: 13px;
  color: #f2c14e;
}
.pausa input {
  width: 56px;
  font: inherit;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid #52514e;
  background: #151513;
  color: #f4f3ef;
}
.salir {
  font: inherit;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #6b6962;
  background: rgba(21, 21, 19, 0.85);
  color: #f4f3ef;
  cursor: pointer;
  pointer-events: auto;
}
.salir.grande {
  align-self: center;
  margin-top: 8px;
}
.centro {
  align-self: center;
  margin: auto;
  max-width: min(760px, calc(100% - 32px));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 36px;
  border-radius: 14px;
  background: rgba(14, 15, 15, 0.82);
  text-align: center;
  pointer-events: auto;
}
.linea {
  font-size: 15px;
  letter-spacing: 0.04em;
  color: #c9c7bf;
  display: flex;
  align-items: center;
  gap: 8px;
}
.vs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px 16px;
  font-size: 28px;
  font-weight: 700;
}
.contra {
  font-size: 0.6em;
  font-weight: 400;
  color: #a4a29a;
}
.luchador {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  overflow-wrap: anywhere;
}
.sw {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}
.etiqueta {
  font-size: 16px;
  color: #e1e0d9;
}
.etiqueta.grande {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #f2c14e;
}
.campeon {
  font-size: 30px;
  font-weight: 700;
  color: #f2c14e;
}
.como,
.pie {
  font-size: 15px;
  color: #c9c7bf;
}
.error {
  font-size: 15px;
  color: #f3b2a6;
}
.aviso {
  font-size: 13px;
  color: #f2c14e;
}
.tercio {
  display: flex;
  justify-content: flex-end;
  padding: 16px;
}
@media (max-width: 640px) {
  .cab:not(.completa) {
    display: none;
  }
}
@media (max-width: 700px) {
  .vs {
    font-size: 20px;
  }
  .etiqueta.grande,
  .campeon {
    font-size: 22px;
  }
}
</style>
