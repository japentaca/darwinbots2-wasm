<script>
// @ts-check
// Jugar (decisión 23): el siguiente partido y «Jugar y mirar» (en
// Observar), el avance automático (con paneles o en modo TV), la ronda en segundo plano (la cola: progreso, workers y aviso
// al terminar), el marcador del partido en curso y el último partido
// (↻ repetir, «Repetir y analizar»).
import {
  LG_SCRATCH_ID,
  lgCupSizeOk,
  lgDrawOf,
  lgFixture,
  lgProgress,
  lgSeasonChampion,
  lgSeasonDone,
} from '../../../engine/league.js';
import { num, t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { entrarTv } from '../observar/tv/tv.svelte.js';
import { estadoTrabajos } from '../trabajos/trabajos.svelte.js';
import TablaMarcador from './TablaMarcador.svelte';
import { notaNulo, textoCampeon, textoProgreso, textoRotulo } from './textos.js';
import {
  abandonar,
  est,
  jugarYMirar,
  liberarRonda,
  nuevaTemporada,
  repetir,
  repetirYAnalizar,
  rondaEnSegundoPlano,
  tr,
  trabajoDeRonda,
} from './torneos.svelte.js';

/**
 * @type {{ L: import('../../../engine/league.js').League, S: import('../../../engine/league.js').Season & {ronda?: {id: string, n: number}},
 *   ms: import('../../../engine/league.js').Match[], todos: import('../../../engine/league.js').Match[],
 *   live: any }}
 *   S y ms: la temporada abierta (la que se juega) y sus partidos.
 */
let { L, S, ms, todos, live } = $props();

// el Scratch no juega rondas en segundo plano (no se guarda: 'round-scratch')
const scratch = $derived(L.id === LG_SCRATCH_ID);

const terminada = $derived(lgSeasonDone(S, ms));
const campeon = $derived(terminada ? lgSeasonChampion(S, ms) : null);
const progreso = $derived(textoProgreso(lgProgress(S, ms), tr));
// sin sortear (rnd fijo): en la colina los retadores se sortean al jugar
const fx = $derived(lgFixture(S, ms, () => 0));
const colina = $derived(S.fmt.format === 'koth' && !S.live);
const faltaCopa = $derived(S.fmt.format === 'cup' && S.entrants.length >= 2 && !lgCupSizeOk(S));
const ronda = $derived(S.ronda ?? null);
const trabajo = $derived(ronda ? trabajoDeRonda(ronda.id) : undefined);
const hechas = $derived(trabajo ? trabajo.unidades.filter((u) => u.estado === 'hecha').length : 0);
const avance = $derived(
  trabajo?.unidades.length
    ? trabajo.unidades.reduce((a, u) => a + (u.estado === 'hecha' ? 1 : u.progreso || 0), 0) /
        trabajo.unidades.length
    : 0,
);
const activa = $derived(
  !!trabajo && (trabajo.estado === 'pendiente' || trabajo.estado === 'corriendo'),
);
const ultimo = $derived.by(() => {
  let u = null;
  for (const m of todos)
    if (!u || m.season > u.season || (m.season === u.season && m.no > u.no)) u = m;
  return u;
});
const aqui = $derived(!!live && live.league === L.id);
const colores = $derived(
  new Map((live?.fighters ?? []).map((/** @type {any} */ e) => [e.name, e.color])),
);
const puedeJugar = $derived(!live && !ronda && !terminada && !est.ocupado);
// «Empezar la temporada N»: se confirma (como en Temporadas); con sorteo si
// los participantes se vuelven a sortear
const conSorteo = $derived(lgDrawOf(L).mode !== 'fixed');
let confirmarTemporada = $state(false);
</script>

<section class="card bloque">
  {#if aqui}
    <span class="lbl"
      >{live.replay
  ? t('competir.marcador.repitiendo', { no: live.replay.no })
  : t('competir.jugar.enJuego')}</span
    >
    <div class="sub">{textoRotulo(live.label, tr)}</div>
    {#if est.marcador?.f1}
      <TablaMarcador
        f1={est.marcador.f1}
        ciclo={est.marcador.cycle}
        {colores}
        rounds={S.fmt.rounds}
        wins={S.fmt.wins}
      />
    {:else}
      <div class="sub">
        {live.fighters.map((/** @type {any} */ e) => e.name).join(' · ')}
        · {t('competir.nota.preparing')}
      </div>
    {/if}
    <div class="fila">
      <a class="btn pri" href={hashDe('observar')}>{t('competir.jugar.mirar')}</a>
      <button class="btn" type="button" onclick={abandonar}>{t('competir.jugar.abandonar')}</button>
    </div>
  {:else}
    <span class="lbl">{progreso || t('competir.jugar.siguiente')}</span>
    {#if terminada}
      <p class="campeon">🏁 {textoCampeon(campeon, tr)}</p>
      {#if confirmarTemporada}
        <div class="fila">
          <button
            class="btn pri"
            type="button"
            disabled={!!est.ocupado || !!ronda || !!live}
            onclick={() => {
  confirmarTemporada = false;
  nuevaTemporada();
}}
          >
            {t('competir.temporadas.nuevaSi', { no: num(S.no + 1) })}
          </button>
          <button class="btn" type="button" onclick={() => (confirmarTemporada = false)}>
            {t('competir.nuevo.cancelar')}
          </button>
        </div>
      {:else}
        <button
          class="btn pri"
          type="button"
          disabled={!!est.ocupado || !!ronda || !!live}
          onclick={() => (confirmarTemporada = true)}
        >
          {t(conSorteo ? 'competir.temporada.nuevaBotonSorteo' : 'competir.temporada.nuevaBoton', {
  no: num(S.no + 1),
})}
        </button>
      {/if}
    {:else if fx}
      <div class="sub">{textoRotulo(fx.label, tr)}</div>
      <div class="vs">
        {#if colina}
          {#if fx.label.params?.champ}
            <span class="luchador"
              ><span
                class="sw redondo"
                style:background={S.entrants.find((e) => e.name === fx.label.params?.champ)?.color}
              ></span>{fx.label.params.champ}</span
            >
          {/if}
          <span class="gris"
            >{t('competir.jugar.retadores', { n: num(Math.max(1, S.fmt.k - (fx.label.params?.champ ? 1 : 0))) })}</span
          >
        {:else}
          {#each fx.fighters as e (e.name)}
            <span class="luchador"
              ><span class="sw redondo" style:background={e.color}></span>{e.name}</span
            >
          {/each}
        {/if}
      </div>
    {:else if S.live}
      <p class="sub">{t('competir.jugar.delPool')}</p>
    {:else if S.entrants.length < 2}
      <p class="sub">{t('competir.jugar.faltan')}</p>
    {:else if faltaCopa}
      <p class="sub">{t('competir.nota.cup-size', { n: num(S.entrants.length) })}</p>
    {:else if S.fmt.format === 'cup' || S.fmt.format === 'swiss'}
      <p class="sub">{t('competir.jugar.alEmpezar')}</p>
    {/if}
    {#if !terminada}
      <button
        class="btn pri"
        type="button"
        disabled={!puedeJugar || faltaCopa}
        onclick={jugarYMirar}
      >
        {t('competir.jugar.jugarYMirar')}
      </button>
      {#if scratch}
        <p class="ayuda">{t('competir.nota.round-scratch')}</p>
      {:else}
        <button
          class="btn"
          type="button"
          disabled={!puedeJugar || faltaCopa}
          onclick={rondaEnSegundoPlano}
        >
          {t('competir.jugar.ronda')}
        </button>
        <p class="ayuda">{t('competir.jugar.ronda.ayuda', { n: num(estadoTrabajos.paralelo) })}</p>
      {/if}
    {/if}
    {#if live && !aqui}
      <p class="ayuda">{t('competir.jugar.otroEnJuego')}</p>
    {/if}
  {/if}
  <div class="fila">
    <button
      class="btn"
      type="button"
      title={t('competir.jugar.auto.ayuda')}
      disabled={!!ronda || !!est.ocupado}
      onclick={() => entrarTv(L.id, { completa: false })}
    >
      ⏩ {t('competir.jugar.auto')}
    </button>
    <button
      class="btn"
      type="button"
      title={t('competir.jugar.tv.ayuda')}
      disabled={!!ronda || !!est.ocupado}
      onclick={() => entrarTv(L.id)}
    >
      📺 {t('competir.jugar.tv')}
    </button>
  </div>

  {#if ronda}
    <div class="ronda">
      <div class="linea">
        <span>{t('competir.jugar.rondaEnCurso', { n: num(estadoTrabajos.paralelo) })}</span>
        <span class="mono">{num(hechas)} / {num(ronda.n)}</span>
      </div>
      <div class="barra"><div style:width={`${Math.round(avance * 100)}%`}></div></div>
      {#if trabajo && !activa}
        <p class="ayuda">{t(`competir.jugar.rondaEstado.${trabajo.estado}`)}</p>
      {:else if !trabajo}
        <p class="ayuda">{t('competir.jugar.rondaSinTrabajo')}</p>
      {/if}
      <p class="ayuda">{t('competir.jugar.rondaBloquea')}</p>
      <button class="btn chico" type="button" disabled={!!est.ocupado} onclick={liberarRonda}>
        {activa ? t('competir.jugar.cancelarRonda') : t('competir.jugar.liberarRonda')}
      </button>
    </div>
  {/if}
</section>

{#if ultimo}
  <section class="card bloque">
    <div class="linea">
      <strong>{t('competir.jugar.ultimo')}</strong>
      <span class="mono gris"
        >{t('competir.jugar.semilla', { semilla: String(ultimo.seed ?? '') })}</span
      >
    </div>
    <p class="sub">
      {#if ultimo.winner}
        {t('competir.jugar.ultimoGano', {
  ganador: ultimo.winner,
  rivales: ultimo.fighters.filter((n) => n !== ultimo?.winner).join(', '),
  ciclos: num(ultimo.cycles || 0),
})}
      {:else}
        {t('competir.jugar.ultimoNulo', { nota: notaNulo(ultimo.note, tr) })}
      {/if}
    </p>
    {#if ultimo.wins?.length}
      <p class="mono gris">
        {ultimo.fighters.map((n, i) => `${n} ${ultimo?.wins?.[i] ?? 0}`).join(' · ')}
      </p>
    {/if}
    {#if ultimo.id !== undefined}
      <div class="fila">
        <button
          class="link"
          type="button"
          disabled={!!live || !!est.ocupado}
          onclick={() => repetir(/** @type {number} */ (ultimo?.id))}
        >
          ↻ {t('competir.partidos.repetir')}
        </button>
        <button
          class="link"
          type="button"
          disabled={!!live || !!est.ocupado}
          onclick={() => repetirYAnalizar(/** @type {number} */ (ultimo?.id))}
        >
          {t('competir.partidos.analizar')}
        </button>
      </div>
    {/if}
  </section>
{/if}

<style>
.bloque {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sub {
  font-size: 13px;
  color: var(--chip-texto);
  margin: 0;
  line-height: 1.45;
}
.vs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 14px;
  font-weight: 600;
}
.luchador {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.redondo {
  border-radius: 50%;
}
.gris {
  color: var(--gris-claro);
  font-size: 12px;
  font-weight: 400;
}
.campeon {
  margin: 0;
  font-size: 14px;
}
.fila {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.linea {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}
.ronda {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--chip);
}
.barra {
  height: 8px;
  border-radius: 4px;
  background: var(--chip);
  overflow: hidden;
}
.barra div {
  height: 8px;
  background: var(--acento);
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.link {
  font: inherit;
  font-size: 13px;
  border: 0;
  background: transparent;
  color: var(--acento);
  cursor: pointer;
  padding: 0;
}
.link:disabled {
  color: var(--gris-claro);
  cursor: default;
}
.btn {
  justify-content: center;
}
.btn.chico {
  height: 32px;
  font-size: 13px;
  align-self: flex-start;
}
</style>
