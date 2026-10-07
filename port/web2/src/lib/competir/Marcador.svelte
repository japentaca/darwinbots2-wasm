<script>
// @ts-check
// Marcador flotante del partido de torneo en curso (decisión 23: «Jugar y
// mirar» en Observar). Se monta una vez en el documento
// (torneos.svelte.js) y se ve en cualquier pantalla mientras hay un
// partido; en Competir no hace falta (el panel de juego ya lo muestra).
// Con `integrado` (N3.6) es la tabla sola, sin marco flotante: la usa el
// rótulo del avance automático en Observar, donde entonces el flotante no se ve.
// N4.4: el flotante se pliega a un chip (se recuerda en este navegador,
// marcador.js; en Observar arranca plegado) y va arriba a la derecha, bajo
// la barra y el aviso según su alto real (y a la izquierda del panel de
// Observar, para no tapar el inspector): abajo están las barras de acciones
// de Observar y de Experimentar. Plegar y desplegar conservan el foco. Los
// lectores de pantalla oyen solo un resumen por ronda, no la tabla.
import { tick, untrack } from 'svelte';
import { lgSeason } from '../../../engine/league.js';
import { num, t } from '../../i18n/index.svelte.js';
import { hashDe, parsearHash } from '../../router.js';
import { abandonarPelea, avanceEncendido, hayTorneoEnCurso } from '../observar/tv/tv.svelte.js';
import {
  flotanteVisible,
  guardarPlegado,
  leerPlegado,
  plegadoInicial,
  posicionMarcador,
  resumenRonda,
} from './marcador.js';
import TablaMarcador from './TablaMarcador.svelte';
import { nombreTorneo, textoRotulo } from './textos.js';
import { abandonar, est, torneos, tr } from './torneos.svelte.js';

/** @type {{ integrado?: boolean, compacto?: boolean }} compacto: ver TablaMarcador */
let { integrado = false, compacto = false } = $props();

let hash = $state(typeof window !== 'undefined' ? window.location.hash : '');
$effect(() => {
  const h = () => {
    hash = window.location.hash;
  };
  window.addEventListener('hashchange', h);
  return () => window.removeEventListener('hashchange', h);
});

const vivo = $derived.by(() => {
  est.version;
  est.marcador;
  const x = torneos();
  const m = x?.lg.live;
  if (!x || !m) return null;
  const L = x.lgFind(m.league);
  const S = L && (m.replay ? L.seasons.find((s) => s.no === m.season) : lgSeason(L));
  return {
    torneo: nombreTorneo(L, tr),
    fighters: m.fighters.map((/** @type {any} */ e) => ({ name: e.name, color: e.color })),
    label: textoRotulo(m.label, tr),
    replay: m.replay ? m.replay.no : 0,
    rounds: S?.fmt.rounds ?? 5,
    wins: S?.fmt.wins ?? 0,
    colores: new Map(m.fighters.map((/** @type {any} */ e) => [e.name, e.color])),
  };
});
const visible = $derived(!integrado && flotanteVisible(hash, !!vivo, avanceEncendido()));
const titulo = $derived(
  vivo?.replay
    ? t('competir.marcador.repitiendo', { no: vivo.replay })
    : t('competir.marcador.titulo'),
);

let plegado = $state(
  plegadoInicial(typeof window !== 'undefined' ? window.location.hash : '', leerPlegado()),
);
// Al cambiar de sección: en Observar, plegado; en las demás, lo recordado.
const seccionHash = $derived(parsearHash(hash).seccion);
$effect(() => {
  seccionHash;
  untrack(() => {
    plegado = plegadoInicial(hash, leerPlegado());
  });
});

/** @type {HTMLButtonElement | undefined} */
let botonChip = $state();
/** @type {HTMLButtonElement | undefined} */
let botonPlegar = $state();
/** Pliega o despliega; el foco pasa al botón que queda (el otro se desmonta).
 * @param {boolean} v */
async function plegar(v) {
  plegado = v;
  guardarPlegado(v);
  await tick();
  (v ? botonChip : botonPlegar)?.focus();
}

// Posición según el alto real de la barra y del aviso (el borde superior de
// <main id="principal">, App.svelte) y el panel derecho de Observar.
let pos = $state({ top: 66, right: 16 });
function medir() {
  const main = document.getElementById('principal');
  const lat = document.querySelector('section.observar aside.lateral');
  const r = lat?.getBoundingClientRect();
  pos = posicionMarcador({
    arribaContenido: main ? main.getBoundingClientRect().top : 56,
    anchoVentana: document.documentElement.clientWidth,
    lateral: r ? { left: r.left, top: r.top, width: r.width } : null,
  });
}
$effect(() => {
  if (!visible) return;
  hash;
  medir();
  const main = document.getElementById('principal');
  const ro = new ResizeObserver(medir);
  if (main) ro.observe(main);
  // la pantalla (hijo directo de main) se monta después del hashchange:
  // carga perezosa
  const mo = new MutationObserver(medir);
  if (main) mo.observe(main, { childList: true });
  window.addEventListener('resize', medir);
  return () => {
    ro.disconnect();
    mo.disconnect();
    window.removeEventListener('resize', medir);
  };
});

// Resumen para lectores de pantalla: una vez por ronda.
const resumen = $derived.by(() => {
  if (!vivo) return '';
  const r = resumenRonda(est.marcador?.f1);
  if (!r) return '';
  if (r.fin) return t('competir.marcador.resumenFin', { torneo: vivo.torneo });
  return t('competir.marcador.resumen', {
    torneo: vivo.torneo,
    ronda: num(r.ronda),
    de: num(r.de),
  });
});

// Con un torneo en curso, la pelea se corta como en la franja (TC4):
// abandonarPelea apaga el avance, con confirmación.
function cortar() {
  if (!hayTorneoEnCurso()) abandonar();
  else if (confirm(t('observar.tv.abandonarSi'))) abandonarPelea();
}
</script>

{#if integrado}
  {#if vivo && est.marcador?.f1}
    <div class="integrado">
      <TablaMarcador
        f1={est.marcador.f1}
        ciclo={est.marcador.cycle}
        colores={vivo.colores}
        rounds={vivo.rounds}
        wins={vivo.wins}
        {compacto}
      />
    </div>
  {/if}
{:else if visible && vivo}
  <p class="oculto" aria-live="polite">{resumen}</p>
  {#if plegado}
    <button
      bind:this={botonChip}
      class="chip"
      style:top={`${pos.top}px`}
      style:right={`${pos.right}px`}
      type="button"
      aria-expanded="false"
      title={t('competir.marcador.chipAyuda')}
      onclick={() => plegar(false)}
    >
      <span class="punto" aria-hidden="true"></span>
      <span class="chip-txt">{titulo} · {vivo.label}</span>
    </button>
  {:else}
    <aside
      id="marcador-torneo"
      class="flotante card"
      style:top={`${pos.top}px`}
      style:right={`${pos.right}px`}
      style:max-height={`calc(100dvh - ${pos.top + 16}px)`}
      aria-label={t('competir.marcador.titulo')}
    >
      <div class="cab">
        <strong>{titulo}</strong>
        <button
          bind:this={botonPlegar}
          class="mini"
          type="button"
          aria-expanded="true"
          aria-controls="marcador-torneo"
          onclick={() => plegar(true)}
        >
          {t('competir.marcador.plegar')}
        </button>
      </div>
      <div class="sub">{vivo.torneo} · {vivo.label}</div>
      {#if est.marcador?.f1}
        <TablaMarcador
          f1={est.marcador.f1}
          ciclo={est.marcador.cycle}
          colores={vivo.colores}
          rounds={vivo.rounds}
          wins={vivo.wins}
        />
      {:else}
        <div class="sub">
          {vivo.fighters.map((/** @type {any} */ f) => f.name).join(' · ')}
          · {t('competir.nota.preparing')}
        </div>
      {/if}
      <div class="acciones">
        <a class="btn chico" href={hashDe('competir')}>{t('competir.marcador.irCompetir')}</a>
        <button class="btn chico" type="button" onclick={cortar}>
          {t('competir.jugar.abandonar')}
        </button>
      </div>
    </aside>
  {/if}
{/if}

<style>
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.integrado {
  min-width: 280px;
  max-width: 420px;
}
/* Arriba a la derecha, bajo la barra superior y el aviso: top y right se
   calculan (posicionMarcador); estos son los valores de partida. */
.flotante,
.chip {
  position: fixed;
  top: 66px;
  right: 16px;
  z-index: 50;
  box-shadow: 0 4px 18px var(--sombra);
}
.flotante {
  width: 340px;
  max-width: calc(100vw - 32px);
  overflow: auto;
  box-sizing: border-box;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(320px, calc(100vw - 32px));
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--borde-control);
  background: var(--tarjeta);
  color: var(--texto);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.chip:hover {
  border-color: var(--acento);
}
.chip-txt {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--acento);
  flex-shrink: 0;
}
.cab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
}
.sub {
  font-size: 12px;
  color: var(--gris);
}
.mini {
  font: inherit;
  font-size: 12px;
  border: 0;
  background: transparent;
  color: var(--acento);
  cursor: pointer;
}
.acciones {
  display: flex;
  gap: 8px;
}
.btn.chico {
  height: 30px;
  font-size: 12px;
  padding: 0 10px;
}
</style>
