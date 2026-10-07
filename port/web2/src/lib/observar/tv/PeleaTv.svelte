<script>
// @ts-check
// La pelea en curso del avance automático: la fase, el ganador y el
// marcador; quién pelea solo hasta que llega el marcador, que ya trae los
// nombres. Con panel lateral va en su pestaña «Torneo» (PanelTorneo), sin
// el ciclo (ya está en «En vivo»). Sin panel (disposición Campo; `completa`,
// desde RotuloTv.svelte) es una tarjeta oscura abajo a la derecha del
// campo, con el ciclo, que se pliega a un chip (botón o tecla M; se
// recuerda en este navegador) para ver la pelea sin nada encima.
import { idioma, t } from '../../../i18n/index.svelte.js';
import Marcador from '../../competir/Marcador.svelte';
import TablaMarcador from '../../competir/TablaMarcador.svelte';
import { est, tr } from '../../competir/torneos.svelte.js';
import { rotuloTV } from './rotulo.js';
import { alternarTarjeta, contextoTv, tv } from './tv.svelte.js';

/** @type {{ completa?: boolean }} */
let { completa = false } = $props();

const r = $derived(rotuloTV(tv.e, contextoTv(), tr, tv.ahora, idioma()));
const pelea = $derived(r.fase === 'lanzando' || r.fase === 'partido' || r.fase === 'resultado');
const hayTabla = $derived(r.fase === 'resultado' ? !!tv.final : !!est.marcador?.f1);
const plegada = $derived(completa && tv.oculta);

// M pliega y despliega (no mientras se escribe, p. ej. en la cortinilla)
$effect(() => {
  if (!completa) return;
  /** @param {KeyboardEvent} e */
  const alTecla = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.key !== 'm' && e.key !== 'M')) return;
    const el = /** @type {HTMLElement | null} */ (e.target);
    if (el?.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    alternarTarjeta();
  };
  window.addEventListener('keydown', alTecla);
  return () => window.removeEventListener('keydown', alTecla);
});
</script>

{#if pelea && plegada}
  <button
    class="chip"
    type="button"
    title={t('observar.tv.mostrar.ayuda')}
    aria-expanded="false"
    onclick={alternarTarjeta}
  >
    {#if r.vivo}
      <span class="punto"></span>
    {/if}
    <span class="texto">{r.linea}{r.ganador ? ` · 🏆 ${r.ganador}` : ''}</span>
    <span class="flecha" aria-hidden="true">▴</span>
  </button>
{:else if pelea}
  <section
    class="pelea"
    class:card={!completa}
    class:oscura={completa}
    aria-label={t('observar.tv.aria')}
  >
    <div class="linea">
      {#if r.vivo}
        <span class="punto"></span>
      {/if}
      <span class="texto">{r.linea}</span>
      {#if completa}
        <button
          class="plegar"
          type="button"
          title={t('observar.tv.ocultar.ayuda')}
          aria-label={t('observar.tv.ocultar.ayuda')}
          aria-expanded="true"
          onclick={alternarTarjeta}
        >
          ▾
        </button>
      {/if}
    </div>
    {#if !hayTabla}
      <div class="vs">
        {#each r.vs as f, i (f.name)}
          {#if i > 0}
            <span class="contra">{t('observar.tv.contra')}</span>
          {/if}
          <span class="luchador"><span class="sw" style:background={f.color}></span>{f.name}</span>
        {/each}
      </div>
    {/if}
    {#if r.etiqueta}
      <div class="etiqueta" class:grande={r.grande}>{r.etiqueta}</div>
    {/if}
    {#if r.ganador}
      <div class="ganador">🏆 {r.ganador}</div>
    {/if}
    {#if r.aviso}
      <div class="aviso">{r.aviso}</div>
    {/if}
    {#if r.fase === 'resultado'}
      {#if tv.final}
        <div class="tabla">
          {#if completa}
            <div class="final">{t('observar.tv.final')}</div>
          {/if}
          <TablaMarcador
            f1={tv.final.f1}
            ciclo={tv.final.ciclo}
            colores={tv.final.colores}
            rounds={tv.final.rounds}
            wins={tv.final.wins}
            compacto={!completa}
          />
        </div>
      {/if}
    {:else}
      <div class="tabla"><Marcador integrado compacto={!completa} /></div>
    {/if}
  </section>
{/if}

<style>
.pelea {
  padding: 12px 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.linea {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--gris);
  display: flex;
  align-items: center;
  gap: 6px;
}
.texto {
  flex: 1;
  min-width: 0;
}
.punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e5484d;
}
.vs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: 14px;
  font-weight: 600;
}
.contra {
  font-size: 12px;
  font-weight: 400;
  color: var(--gris-claro);
}
.luchador {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow-wrap: anywhere;
}
.sw {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.etiqueta {
  font-size: 13px;
  color: var(--chip-texto);
}
.etiqueta.grande {
  font-weight: 700;
  letter-spacing: 0.06em;
}
.ganador {
  font-size: 15px;
  font-weight: 700;
}
.aviso {
  font-size: 12px;
  color: var(--gris);
}
.tabla {
  padding-top: 8px;
  border-top: 1px solid var(--chip);
}
.tabla:empty {
  display: none;
}
.final {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}

/* pantalla completa: tarjeta oscura (de noche no encandila) sobre el campo;
   los tokens se redefinen aquí para que el marcador también sea oscuro */
.oscura,
.chip {
  --texto: #f4f3ef;
  --gris: #c9c7bf;
  --gris-claro: #a4a29a;
  --chip: #3a3a36;
  --chip-texto: #e1e0d9;
  --acento: #6fd0c4;
  color: var(--texto);
  background: rgba(14, 15, 15, 0.82);
  backdrop-filter: blur(6px);
  border: 1px solid #3a3a36;
  border-radius: 10px;
  pointer-events: auto;
}
.oscura {
  width: 360px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  margin: 0;
}
.oscura .etiqueta.grande {
  color: #f2c14e;
}
.oscura .ganador {
  color: #f2c14e;
}
.plegar {
  font: inherit;
  font-size: 14px;
  line-height: 1;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #52514e;
  background: transparent;
  color: var(--texto);
  cursor: pointer;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(420px, calc(100vw - 32px));
  font: inherit;
  font-size: 13px;
  padding: 8px 12px;
  cursor: pointer;
}
.chip .texto {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plegar:focus-visible,
.chip:focus-visible {
  outline: 2px solid var(--acento);
  outline-offset: 2px;
}
</style>
