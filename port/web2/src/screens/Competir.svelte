<script>
// @ts-check
// Competir (Nivel 3, paso N3.5; decisiones 15, 17, 21, 22 y 23): la lista
// de torneos, el partido rápido (el Scratch: sin guardar, con «Guardar como
// torneo»), el asistente «Nuevo torneo», las vistas de un torneo (Tabla,
// estructura según el formato, Partidos, Participantes, Reglas y
// Temporadas), el Salón de la fama global, importar y exportar, y el panel
// para jugar («Jugar y mirar» en Observar y la ronda en segundo plano).
// Rutas:
//   #/competir                       el torneo abierto (o el partido rápido)
//   #/competir/nuevo                 el asistente
//   #/competir/salon                 el Salón de la fama
//   #/competir/rapido                el partido rápido
//   #/competir/<id>[/<vista>]        un torneo (vista: tabla, estructura,
//                                    partidos, participantes, reglas, temporadas)
//
// Con un torneo en curso (PLAN-TORNEO-EN-CURSO.md, TC4: T8) el torneo
// abierto es el que se juega y queda de solo lectura (participantes,
// reglas, sorteos, temporada nueva, ↻, Vaciar y Borrar), con un aviso que
// remite a la franja. Los demás torneos se ven en la lista pero no se
// abren: el motor juega el torneo abierto, y abrir otro lo cortaría.
// Tampoco se crea ni se importa uno (los dos abren el nuevo).
import { onMount, untrack } from 'svelte';
import { LG_SCRATCH_ID, lgAllTime, lgIsScratch, lgSeason } from '../../engine/league.js';
import { generarInforme } from '../../engine/report/index.js';
import { TIPO_RONDA } from '../../engine/rondas.js';
import { idioma, num, t } from '../i18n/index.svelte.js';
import { datosTorneo } from '../lib/analizar/informes/datos.js';
import { guardarInforme } from '../lib/analizar/informes/guardados.js';
import Asistente from '../lib/competir/Asistente.svelte';
import Estructura from '../lib/competir/Estructura.svelte';
import {
  descartarAvisoLigas,
  lineasMigracionLigas,
  migracionLigas,
} from '../lib/competir/migracion.svelte.js';
import PanelJuego from '../lib/competir/PanelJuego.svelte';
import Participantes from '../lib/competir/Participantes.svelte';
import Partidos from '../lib/competir/Partidos.svelte';
import Reglas from '../lib/competir/Reglas.svelte';
import Salon from '../lib/competir/Salon.svelte';
import Tabla from '../lib/competir/Tabla.svelte';
import Temporadas from '../lib/competir/Temporadas.svelte';
import { nombreTorneo, textoError, textoFormato, textoNota } from '../lib/competir/textos.js';
import {
  abrir,
  asegurarTorneos,
  borrarActual,
  est,
  exportar,
  guardarScratch,
  hofViejo,
  importar,
  nuevaTemporada,
  renombrar,
  repetir,
  repetirYAnalizar,
  sincronizarRonda,
  torneos,
  tr,
} from '../lib/competir/torneos.svelte.js';
import { vistaEstructura } from '../lib/competir/vistas.js';
import { descargar } from '../lib/observar/descargas.js';
import AvisoTorneo from '../lib/observar/tv/AvisoTorneo.svelte';
import { hayTorneoEnCurso, torneoEnCurso } from '../lib/observar/tv/tv.svelte.js';
import { almacen, estadoAlmacen } from '../lib/sim/almacen.svelte.js';
import ListaTrabajos from '../lib/trabajos/ListaTrabajos.svelte';
import { estadoTrabajos } from '../lib/trabajos/trabajos.svelte.js';
import { hashDe } from '../router.js';

/** @type {{ partes?: string[] }} */
let { partes = [] } = $props();

const uid = $props.id();
const ESPECIALES = ['nuevo', 'salon', 'rapido'];
const modo = $derived(partes[0] === 'nuevo' ? 'nuevo' : partes[0] === 'salon' ? 'salon' : 'torneo');
const VISTAS = ['tabla', 'estructura', 'partidos', 'participantes', 'reglas', 'temporadas'];
const vistaRuta = $derived(
  VISTAS.includes(partes[1] ?? '') ? /** @type {string} */ (partes[1]) : '',
);
let vista = $state('tabla');
/** temporada que se mira (0 = la abierta) */
let temporadaVista = $state(0);
let confirmarBorrar = $state(false);
let nombreEditado = $state('');
/** @type {HTMLInputElement | undefined} */
let archivo = $state();

onMount(() => {
  asegurarTorneos();
});

// La ruta manda: abre el torneo pedido (o el partido rápido). Con un
// torneo en curso, otro no se abre: la ruta vuelve al que se juega.
$effect(() => {
  if (!est.listo) return;
  const p0 = partes[0];
  untrack(async () => {
    const id = p0 === 'rapido' ? LG_SCRATCH_ID : p0 && !ESPECIALES.includes(p0) ? p0 : '';
    if (!id || (await abrir(id))) return;
    const enCurso = torneoEnCurso();
    if (enCurso) {
      const h =
        enCurso === LG_SCRATCH_ID ? hashDe('competir', 'rapido') : hashDe('competir', enCurso);
      window.history.replaceState(window.history.state, '', h);
    }
  });
});

// Con un torneo en curso, el abierto es ese y queda de solo lectura.
const congelado = $derived(hayTorneoEnCurso());
/** ¿El torneo `id` de la lista no se puede abrir (otro está en curso)? @param {string} id */
const otroBloqueado = (id) => congelado && snap?.L?.id !== id;
$effect(() => {
  if (vistaRuta) vista = vistaRuta;
});

// Una ronda cancelada desde la lista de trabajos libera la temporada.
$effect(() => {
  estadoTrabajos.lista;
  if (est.listo) untrack(() => sincronizarRonda());
});

const snap = $derived.by(() => {
  const v = est.version;
  const x = torneos();
  if (!x || !est.listo) return null;
  const L = x.lg.cur;
  const lista = x.lg.list.map((y) => ({
    id: y.id,
    name: y.name,
    fmt: lgSeason(y).fmt,
    S: lgSeason(y),
  }));
  if (!L) return { v, L: null, lista };
  const cur = /** @type {any} */ (lgSeason(L));
  const S = L.seasons.find((s) => s.no === temporadaVista) ?? cur;
  const todos = x.lg.matches.slice();
  const msCur = x.lgSeasonMatches(cur.no);
  return {
    v,
    lista,
    L,
    cur,
    S,
    actual: S === cur,
    ms: x.lgSeasonMatches(S.no),
    msCur,
    todos,
    live: x.lg.live,
    checked: new Map(x.lg.checked),
    bloqueada: msCur.length > 0,
    ronda: !!cur.ronda,
    scratch: lgIsScratch(L),
  };
});

// Otro torneo abierto: se mira su temporada actual.
let idAbierto = '';
$effect(() => {
  const id = snap?.L?.id ?? '';
  untrack(() => {
    if (id === idAbierto) return;
    idAbierto = id;
    temporadaVista = 0;
    confirmarBorrar = false;
  });
});

const estructura = $derived(snap?.L ? vistaEstructura(snap.S.fmt.format) : null);
const pestañas = $derived([
  'tabla',
  ...(estructura ? ['estructura'] : []),
  'partidos',
  'participantes',
  'reglas',
  'temporadas',
]);
$effect(() => {
  if (!pestañas.includes(vista)) vista = 'tabla';
});

const jugando = $derived.by(() => {
  const m = snap?.live;
  return m && m.league === snap?.L?.id && m.fighters.length === 2
    ? [m.fighters[0].name, m.fighters[1].name].sort().join('\u0001')
    : '';
});
const enCola = $derived.by(() => {
  const r = snap?.cur?.ronda;
  if (!r) return new Set();
  const tr0 = estadoTrabajos.lista.find((x) => x.params?.ronda === r.id);
  const set = new Set();
  for (const p of tr0?.params?.partidos ?? [])
    if (p.fighters.length === 2) set.add([...p.fighters].sort().join('\u0001'));
  return set;
});

/**
 * Meta de un torneo en la lista: formato · bots · temporada (el avance no:
 * solo el torneo abierto tiene sus partidos en memoria).
 * @param {any} y
 */
function metaDe(y) {
  return [
    t(`competir.formato.${y.fmt.format}`),
    t('competir.torneo.bots', { n: num(y.S.entrants.length) }),
    t('competir.lista.temporada', { no: num(y.S.no) }),
  ].join(' · ');
}

/** @param {string} v */
function irVista(v) {
  vista = v;
  if (snap?.L && !snap.scratch) {
    const h = hashDe('competir', snap.L.id, v);
    if (window.location.hash !== h) window.history.replaceState(window.history.state, '', h);
  }
}

/**
 * Pestañas con el teclado (patrón tablist): flechas, Inicio y Fin mueven
 * la selección y el foco.
 * @param {KeyboardEvent} e
 */
function teclaPestaña(e) {
  const i = pestañas.indexOf(vista);
  const n = pestañas.length;
  const j =
    e.key === 'ArrowRight'
      ? (i + 1) % n
      : e.key === 'ArrowLeft'
        ? (i - 1 + n) % n
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? n - 1
            : -1;
  if (j < 0) return;
  e.preventDefault();
  irVista(pestañas[j]);
  document.getElementById(`${uid}-tab-${pestañas[j]}`)?.focus();
}

// Rondas de torneo en la cola (se listan en el panel de juego).
const hayRondas = $derived(estadoTrabajos.lista.some((x) => x.tipo === TIPO_RONDA));
// Elo histórico (Hall of Fame del torneo) para los bombos de la copa.
const eloHistorico = $derived(
  snap?.L && snap.S.fmt.format === 'cup'
    ? new Map(lgAllTime(snap.L, snap.todos).map((r) => [r.name, r.elo]))
    : new Map(),
);

async function alImportar() {
  const f = archivo?.files?.[0];
  if (archivo) archivo.value = '';
  if (!f) return;
  const L = await importar(await f.text());
  if (L) window.location.hash = hashDe('competir', L.id);
}

async function guardarComo() {
  const L = await guardarScratch(nombreEditado.trim());
  nombreEditado = '';
  if (L) window.location.hash = hashDe('competir', L.id);
}

async function borrar() {
  confirmarBorrar = false;
  await borrarActual();
  window.location.hash = hashDe('competir');
}

/** Informe de Torneo de la temporada que se mira: se guarda en Informes y se descarga. */
async function informe() {
  if (!snap?.L) return;
  try {
    const inf = generarInforme(
      'torneo',
      datosTorneo(snap.L, snap.todos, { temporada: snap.S.no, titulo: nombreTorneo(snap.L, tr) }),
      { idioma: idioma() === 'en' ? 'en' : 'es' },
    );
    descargar(new Blob([inf.html], { type: 'text/html;charset=utf-8' }), inf.archivo);
    await guardarInforme(almacen(), {
      tipo: 'torneo',
      titulo: String(/** @type {any} */ (inf.datos).titulo ?? inf.archivo),
      archivo: inf.archivo,
      idioma: idioma(),
      html: inf.html,
    });
    est.aviso = { texto: t('competir.informe.listo', { archivo: inf.archivo }), aviso: false };
  } catch (e) {
    est.aviso = {
      texto: t('competir.informe.error', { detalle: textoError(e, tr) }),
      aviso: true,
    };
  }
}

const lineasMigracion = $derived(
  migracionLigas.resumen ? lineasMigracionLigas(migracionLigas.resumen) : [],
);
</script>

<div class="competir">
  <aside class="lista">
    <a
      class="btn pri"
      href={congelado ? undefined : hashDe('competir', 'nuevo')}
      aria-disabled={congelado ? 'true' : undefined}
      title={congelado ? t('competir.enCurso.bloqueo') : undefined}
      >{t('competir.lista.nuevo')}</a
    >
    <a
      class="li rapido"
      class:on={modo === 'torneo' && !!snap?.scratch}
      class:off={congelado && !snap?.scratch}
      href={congelado && !snap?.scratch ? undefined : hashDe('competir', 'rapido')}
      aria-disabled={congelado && !snap?.scratch ? 'true' : undefined}
      title={congelado && !snap?.scratch ? t('competir.enCurso.otro') : undefined}
      aria-current={modo === 'torneo' && snap?.scratch ? 'page' : undefined}
    >
      <span class="col">
        <span class="n">⚡ {t('competir.rapido.titulo')}</span>
        <span class="m">{t('competir.rapido.desc')}</span>
      </span>
    </a>
    <span class="lbl sep">{t('competir.lista.mios')}</span>
    {#if snap}
      {#each snap.lista as y (y.id)}
        <a
          class="li"
          class:on={modo === 'torneo' && snap.L?.id === y.id}
          class:off={otroBloqueado(y.id)}
          href={otroBloqueado(y.id) ? undefined : hashDe('competir', y.id)}
          aria-disabled={otroBloqueado(y.id) ? 'true' : undefined}
          title={otroBloqueado(y.id) ? t('competir.enCurso.otro') : undefined}
          aria-current={modo === 'torneo' && snap.L?.id === y.id ? 'page' : undefined}
        >
          <span class="col">
            <span class="n">{nombreTorneo(y, tr)}</span>
            <span class="m">{metaDe(y)}</span>
          </span>
        </a>
      {:else}
        <p class="vacio">{t('competir.lista.vacia')}</p>
      {/each}
    {:else}
      <p class="vacio">{t('competir.cargando')}</p>
    {/if}
    <span class="lbl sep">{t('competir.lista.global')}</span>
    <a
      class="li"
      class:on={modo === 'salon'}
      href={hashDe('competir', 'salon')}
      aria-current={modo === 'salon' ? 'page' : undefined}
      >{t('competir.salon.titulo')}</a
    >
    <div class="relleno"></div>
    <div class="archivos">
      <button
        class="btn chico"
        type="button"
        disabled={congelado}
        title={congelado ? t('competir.enCurso.bloqueo') : undefined}
        onclick={() => archivo?.click()}
      >
        {t('competir.lista.importar')}
      </button>
      <button
        class="btn chico"
        type="button"
        disabled={!snap?.L || snap.scratch}
        onclick={exportar}
      >
        {t('competir.lista.exportar')}
      </button>
      <input
        bind:this={archivo}
        type="file"
        accept=".json,application/json"
        hidden
        onchange={alImportar}
      >
    </div>
    <p class="ayuda">{t('competir.lista.archivos')}</p>
  </aside>

  <section class="principal">
    {#if estadoAlmacen.versionVieja}
      <div class="aviso error" role="alert">{t('competir.almacen.versionVieja')}</div>
    {:else if estadoAlmacen.bloqueado}
      <div class="aviso error" role="alert">{t('competir.almacen.bloqueado')}</div>
    {/if}
    {#if migracionLigas.visible && migracionLigas.resumen}
      <div class="aviso" role="status">
        <div class="txt">
          <strong>{t('competir.migracion.titulo')}</strong>
          <ul>
            {#each lineasMigracion as l, i (i)}
              <li>{t(l.clave, l.params)}</li>
            {/each}
          </ul>
        </div>
        <button
          class="cerrar"
          type="button"
          aria-label={t('competir.cerrar')}
          onclick={descartarAvisoLigas}
        >
          ×
        </button>
      </div>
    {/if}
    {#if est.hofViejo}
      <div class="aviso" role="status">
        <div class="txt">{t('competir.hofViejo.texto')}</div>
        <button class="btn chico" type="button" onclick={() => hofViejo(true)}>
          {t('competir.hofViejo.bajar')}
        </button>
        <button class="btn chico" type="button" onclick={() => hofViejo(false)}>
          {t('competir.hofViejo.descartar')}
        </button>
      </div>
    {/if}
    {#if est.aviso}
      <div class="aviso" class:error={est.aviso.aviso} role="status">
        <div class="txt">{est.aviso.texto}</div>
        <button
          class="cerrar"
          type="button"
          aria-label={t('competir.cerrar')}
          onclick={() => (est.aviso = null)}
        >
          ×
        </button>
      </div>
    {/if}
    {#if est.nota}
      <div class="nota" class:alerta={est.nota.aviso} role="status" aria-live="polite">
        {textoNota(est.nota, tr)}
      </div>
    {/if}

    {#if est.error}
      <p class="vacio" role="alert">
        {t('competir.error.carga', { detalle: textoError(est.error, tr) })}
      </p>
    {:else if modo === 'nuevo' && congelado}
      <AvisoTorneo clave="competir.enCurso.bloqueo" />
    {:else if modo === 'nuevo'}
      <Asistente onCancelar={() => (window.location.hash = hashDe('competir'))} />
    {:else if modo === 'salon'}
      <Salon />
    {:else if !snap}
      <p class="vacio">{t('competir.cargando')}</p>
    {:else if !snap.L}
      <p class="vacio">{t('competir.lista.vacia')}</p>
    {:else}
      <div class="cab">
        <div class="titulo">
          {#if snap.scratch}
            <h1>⚡ {t('competir.rapido.titulo')}</h1>
          {:else}
            <input
              class="nombre"
              value={nombreTorneo(snap.L, tr)}
              readonly={congelado}
              aria-label={t('competir.torneo.nombre')}
              onchange={(e) => renombrar(e.currentTarget.value)}
            >
          {/if}
          <div class="meta">
            <span>{textoFormato(snap.S.fmt, tr, snap.S.entrants.length)}</span>
            <span>· {t('competir.torneo.bots', { n: num(snap.S.entrants.length) })}</span>
            <span
              >·
              {t('competir.torneo.temporada', { no: num(snap.S.no), de: num(snap.L.seasons.length) })}</span
            >
            {#if !snap.actual}
              <button class="link" type="button" onclick={() => (temporadaVista = 0)}>
                {t('competir.torneo.verActual')}
              </button>
            {/if}
            {#if congelado}
              <span class="lock">🔒 {t('competir.torneo.enCurso')}</span>
            {:else if snap.actual && (snap.bloqueada || snap.ronda)}
              <span class="lock"
                >🔒
                {t(snap.ronda ? 'competir.torneo.rondaBloquea' : 'competir.torneo.bloqueada')}</span
              >
            {/if}
          </div>
        </div>
        <div class="acciones">
          {#if snap.scratch}
            <input
              class="guardar"
              type="text"
              bind:value={nombreEditado}
              placeholder={t('competir.rapido.nombre')}
              aria-label={t('competir.rapido.nombre')}
              maxlength="80"
            >
            <button
              class="btn chico pri"
              type="button"
              disabled={!!est.ocupado || congelado}
              onclick={guardarComo}
            >
              {t('competir.rapido.guardar')}
            </button>
          {:else}
            <button class="btn chico" type="button" onclick={informe}>
              {t('competir.informe.boton')}
            </button>
          {/if}
          {#if confirmarBorrar}
            <button class="btn chico peligro" type="button" onclick={borrar}>
              {t(snap.scratch ? 'competir.torneo.vaciarSi' : 'competir.torneo.borrarSi')}
            </button>
            <button class="btn chico" type="button" onclick={() => (confirmarBorrar = false)}>
              {t('competir.nuevo.cancelar')}
            </button>
          {:else}
            <button
              class="btn chico"
              type="button"
              disabled={snap.ronda || congelado}
              onclick={() => (confirmarBorrar = true)}
            >
              {t(snap.scratch ? 'competir.torneo.vaciar' : 'competir.torneo.borrar')}
            </button>
          {/if}
        </div>
      </div>
      {#if snap.scratch}
        <p class="ayuda">{t('competir.rapido.ayuda')}</p>
      {/if}
      <AvisoTorneo clave="competir.enCurso.aviso" />

      <div class="seg" role="tablist" aria-label={t('competir.torneo.vistas')}>
        {#each pestañas as p (p)}
          <button
            type="button"
            role="tab"
            id={`${uid}-tab-${p}`}
            class:on={vista === p}
            aria-selected={vista === p}
            aria-controls={`${uid}-panel`}
            tabindex={vista === p ? 0 : -1}
            onclick={() => irVista(p)}
            onkeydown={teclaPestaña}
          >
            {p === 'estructura' ? t(`competir.vista.estructura.${estructura}`) : t(`competir.vista.${p}`)}
          </button>
        {/each}
      </div>

      <div
        class="contenido"
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${vista}`}
      >
        {#if vista === 'tabla'}
          <Tabla S={snap.S} ms={snap.ms} />
        {:else if vista === 'estructura'}
          <Estructura
            S={snap.S}
            ms={snap.ms}
            {eloHistorico}
            {jugando}
            {enCola}
            ocupado={!!snap.live || !!est.ocupado || congelado}
            onRepetir={repetir}
          />
        {:else if vista === 'partidos'}
          <Partidos
            ms={snap.ms}
            checked={snap.checked}
            ocupado={!!snap.live || !!est.ocupado || congelado}
            onRepetir={repetir}
            onAnalizar={repetirYAnalizar}
          />
        {:else if vista === 'participantes'}
          <Participantes
            L={snap.L}
            S={snap.S}
            ms={snap.ms}
            actual={snap.actual}
            bloqueada={snap.bloqueada}
            ronda={snap.ronda || congelado}
          />
        {:else if vista === 'reglas'}
          <Reglas
            S={snap.S}
            editable={snap.actual && !snap.bloqueada && !snap.ronda && !congelado}
            motivo={!snap.actual
  ? 'competir.reglas.pasada'
  : congelado
    ? 'competir.torneo.enCurso'
    : snap.ronda
      ? 'competir.torneo.rondaBloquea'
      : snap.bloqueada
        ? 'competir.torneo.bloqueada'
        : ''}
          />
        {:else if vista === 'temporadas'}
          <Temporadas
            L={snap.L}
            todos={snap.todos}
            vista={snap.S.no}
            onVer={(no) => (temporadaVista = no === snap?.cur.no ? 0 : no)}
            puedeNueva={snap.bloqueada && !snap.ronda && !snap.live && !est.ocupado && !congelado}
            onNueva={() => {
  temporadaVista = 0;
  nuevaTemporada();
}}
          />
        {/if}
      </div>
    {/if}
  </section>

  <aside class="juego">
    {#if modo === 'torneo' && snap?.L}
      <PanelJuego L={snap.L} S={snap.cur} ms={snap.msCur} todos={snap.todos} live={snap.live} />
    {:else}
      <section class="card bloque">
        <span class="lbl">{t('competir.jugar.titulo')}</span>
        <p class="ayuda">{t('competir.jugar.elegir')}</p>
      </section>
    {/if}
    {#if hayRondas}
      <ListaTrabajos tipo={TIPO_RONDA} ver={false} titulo={t('competir.jugar.rondas')} />
    {/if}
  </aside>
</div>

<style>
.competir {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 350px;
  height: 100%;
  min-height: 0;
}
.lista {
  border-right: 1px solid var(--borde);
  padding: 18px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}
.lista > .btn.pri {
  margin: 0 4px 6px;
  justify-content: center;
}
.btn:disabled,
.lista > .btn.pri[aria-disabled="true"] {
  opacity: 0.55;
  cursor: not-allowed;
}
.li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--texto);
  font-size: 14px;
}
.li:hover {
  background: var(--hover-claro);
  color: var(--texto);
}
.li.on {
  background: var(--seleccion);
}
.li.rapido {
  border: 1px solid var(--borde);
  background: var(--tarjeta);
}
.li.rapido.on {
  background: var(--seleccion);
}
/* con un torneo en curso, los demás no se abren (TC4) */
.li.off {
  opacity: 0.55;
  cursor: not-allowed;
}
.li.off:hover {
  background: transparent;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.n {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.m {
  font-size: 12px;
  color: var(--gris-claro);
}
.sep {
  padding: 12px 8px 2px;
}
.relleno {
  flex-grow: 1;
}
.archivos {
  display: flex;
  gap: 6px;
  padding: 0 4px;
}
.archivos .btn {
  flex-grow: 1;
  justify-content: center;
}
.principal {
  padding: 20px 26px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  overflow: auto;
}
.juego {
  border-left: 1px solid var(--borde);
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}
.cab {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.titulo {
  flex-grow: 1;
  min-width: 0;
}
h1 {
  margin: 0;
  font-size: 23px;
  font-weight: 600;
}
.nombre {
  font: inherit;
  font-size: 23px;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  padding: 0 4px;
  margin-left: -5px;
  width: 100%;
  max-width: 560px;
}
.nombre:hover,
.nombre:focus {
  border-color: var(--borde-control);
  background: var(--campo);
}
.meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 4px;
  font-size: 13px;
  color: var(--gris);
}
.lock {
  font-size: 12px;
  color: var(--gris);
}
.acciones {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.guardar {
  font: inherit;
  font-size: 13px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--campo);
  width: 180px;
}
.btn.chico {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
}
.btn.peligro {
  border-color: var(--error-borde);
  color: var(--error-texto);
}
.seg {
  align-self: flex-start;
  flex-wrap: wrap;
}
.contenido {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.aviso {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 13px;
  line-height: 1.45;
}
.aviso.error {
  background: var(--error-fondo);
  border-color: var(--error-borde);
  color: var(--error-texto);
}
.txt {
  flex: 1;
}
ul {
  margin: 4px 0 0;
  padding-left: 18px;
}
.cerrar {
  font: inherit;
  font-size: 18px;
  line-height: 1;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.nota {
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--seleccion-suave);
  color: var(--acento-hover);
}
.nota.alerta {
  background: var(--aviso-fondo);
  color: var(--aviso-texto);
}
.vacio {
  color: var(--gris);
  font-size: 14px;
  padding: 0 8px;
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
}
.bloque {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
@media (max-width: 1200px) {
  .competir {
    grid-template-columns: 240px minmax(0, 1fr);
  }
  .juego {
    grid-column: 1 / -1;
    border-left: 0;
    border-top: 1px solid var(--borde);
  }
}
@media (max-width: 800px) {
  .competir {
    grid-template-columns: 1fr;
    height: auto;
  }
  .lista {
    border-right: 0;
  }
}
</style>
