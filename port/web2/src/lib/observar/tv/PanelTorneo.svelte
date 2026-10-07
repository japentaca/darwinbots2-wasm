<script>
// @ts-check
// Pestaña «Torneo» del panel lateral de Observar (PLAN-TORNEO-EN-CURSO.md,
// TC3: T7), solo con un torneo en curso: el torneo y el progreso de la
// temporada, la pelea (PeleaTv) o lo que muestra el rótulo entre peleas (la
// próxima en la cortinilla, el campeón, el error), la tabla y los últimos
// resultados. Con la disposición Datos (`amplio`), la Tabla completa de
// Competir y la estructura del formato (cuadro, rondas, escalera…), de solo
// lectura: repetir un partido tomaría la simulación del torneo.
import { lgSeason } from '../../../../engine/league.js';
import { idioma, num, t } from '../../../i18n/index.svelte.js';
import { hashDe } from '../../../router.js';
import Estructura from '../../competir/Estructura.svelte';
import Tabla from '../../competir/Tabla.svelte';
import { est, torneos, tr } from '../../competir/torneos.svelte.js';
import { filasPartidos, filasTabla, vistaEstructura } from '../../competir/vistas.js';
import PeleaTv from './PeleaTv.svelte';
import { rotuloTV } from './rotulo.js';
import { contextoTv, tv } from './tv.svelte.js';

/** @type {{ amplio?: boolean }} */
let { amplio = false } = $props();

/** Cuántos resultados recientes (Mixta · Datos). */
const ULTIMOS = { mixta: 5, datos: 15 };

const ctx = $derived(contextoTv());
const r = $derived(rotuloTV(tv.e, ctx, tr, tv.ahora, idioma()));
const pelea = $derived(r.fase === 'lanzando' || r.fase === 'partido' || r.fase === 'resultado');

// los partidos del motor son los del torneo abierto, que es el del avance
const datos = $derived.by(() => {
  est.version; // se relee cuando cambia el modelo del motor
  const x = torneos();
  const L = x?.lg.cur;
  if (!L || L.id !== tv.liga) return null;
  const S = lgSeason(L);
  return { L, S, ms: x.lgSeasonMatches(S.no), live: x.lg.live };
});
const suizo = $derived(datos?.S.fmt.format === 'swiss');
const filas = $derived(datos ? filasTabla(datos.S, datos.ms) : []);
const ultimos = $derived(
  datos
    ? filasPartidos(datos.ms)
        .filter((m) => m.winner || m.note)
        .slice(0, amplio ? ULTIMOS.datos : ULTIMOS.mixta)
    : [],
);
const conEstructura = $derived(amplio && !!datos && !!vistaEstructura(datos.S.fmt.format));
// el par que se está jugando (lo resalta la estructura)
const jugando = $derived.by(() => {
  const m = datos?.live;
  return m && m.league === datos?.L.id && m.fighters.length === 2
    ? [m.fighters[0].name, m.fighters[1].name].sort().join('\u0001')
    : '';
});
</script>

<div class="panel" class:amplio>
  <div class="cab">
    <span class="nombre">🏆 {ctx.torneo}</span>
    {#if ctx.progreso}
      <span class="progreso">{ctx.progreso}</span>
    {/if}
  </div>

  {#if pelea}
    <PeleaTv />
  {:else if r.linea}
    <section class="card estado" aria-label={t('observar.tv.aria')}>
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
        <div class="etiqueta">{r.etiqueta}</div>
      {/if}
      {#if r.campeon}
        <div class="campeon">🏆 {r.campeon}</div>
      {/if}
      {#if r.como}
        <div class="nota">{r.como}</div>
      {/if}
      {#if r.error}
        <div class="error">{r.error}</div>
      {/if}
      {#if r.aviso}
        <div class="nota">{r.aviso}</div>
      {/if}
    </section>
  {/if}

  {#if !datos}
    <p class="nota">{t('observar.torneo.cargando')}</p>
  {:else}
    <div class="bloques">
      <section class="bloque">
        <h3 class="lbl">{t('observar.torneo.tabla')}</h3>
        {#if amplio}
          <Tabla S={datos.S} ms={datos.ms} />
        {:else if !filas.length}
          <p class="nota">{t('competir.tabla.vacia')}</p>
        {:else}
          <table class="tbl corta">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" class="l">{t('competir.tabla.bot')}</th>
                {#if suizo}
                  <th scope="col" title={t('competir.tabla.pts.ayuda')}>
                    {t('competir.tabla.pts')}
                  </th>
                {/if}
                <th scope="col" title={t('competir.tabla.pj.ayuda')}>{t('competir.tabla.pj')}</th>
                <th scope="col" title={t('competir.tabla.g.ayuda')}>{t('competir.tabla.g')}</th>
                <th scope="col">%</th>
              </tr>
            </thead>
            <tbody>
              {#each filas as f (f.name)}
                <tr>
                  <td>{f.puesto}</td>
                  <td class="l">
                    <span class="bot">
                      <span class="sw" style:background={f.color}></span>
                      {#if f.campeon}
                        <span title={t('competir.tabla.campeon')}>🏆</span>
                      {/if}
                      <span class="n">{f.name}</span>
                    </span>
                  </td>
                  {#if suizo}
                    <td class="mono">{num(f.pts ?? 0)}</td>
                  {/if}
                  <td class="mono">{num(f.p)}</td>
                  <td class="mono">{num(f.w)}</td>
                  <td class="mono">{f.pct === null ? '—' : num(f.pct)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>

      <section class="bloque">
        <h3 class="lbl">{t('observar.torneo.ultimos')}</h3>
        {#if !ultimos.length}
          <p class="nota">{t('observar.torneo.sinPartidos')}</p>
        {:else}
          <ol class="ultimos">
            {#each ultimos as m (m.id ?? `${m.season}-${m.no}`)}
              <li>
                <span class="mono gris">{t('observar.torneo.pelea', { n: num(m.no) })}</span>
                <span class="vsCorto">
                  {#each m.fighters as n, i (i)}
                    {#if i > 0}
                      <span class="gris"> – </span>
                    {/if}
                    <span class:gano={n === m.winner}>{n}</span>
                  {/each}
                </span>
                {#if !m.winner}
                  <span class="gris">{t('observar.tv.nula')}</span>
                {/if}
              </li>
            {/each}
          </ol>
        {/if}
      </section>
    </div>

    {#if conEstructura}
      <section class="bloque">
        <h3 class="lbl">{t('observar.torneo.estructura')}</h3>
        <Estructura
          S={datos.S}
          ms={datos.ms}
          {jugando}
          enCola={new Set()}
          ocupado
          onRepetir={() => {}}
        />
      </section>
    {/if}

    <a class="competir" href={hashDe('competir', datos.L.id)}>{t('observar.torneo.competir')}</a>
  {/if}
</div>

<style>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.cab {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 12px;
}
.nombre {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.progreso {
  font-size: 13px;
  color: var(--gris);
}
.estado {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.linea {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--gris);
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
.luchador,
.bot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow-wrap: anywhere;
  min-width: 0;
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
.campeon {
  font-size: 15px;
  font-weight: 700;
}
.error {
  font-size: 13px;
  color: var(--error-texto, var(--texto));
}
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
}
.bloques {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* Datos: la tabla y los últimos resultados lado a lado si hay lugar */
.amplio .bloques {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  align-items: start;
}
@media (max-width: 900px) {
  .amplio .bloques {
    grid-template-columns: minmax(0, 1fr);
  }
}
.bloque {
  min-width: 0;
}
h3.lbl {
  margin: 0 0 6px;
}
.corta {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.corta th {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--gris-claro);
  font-weight: 600;
  text-align: right;
  padding: 6px 4px;
  border-bottom: 1px solid var(--borde);
  white-space: nowrap;
}
.corta td {
  padding: 5px 4px;
  border-bottom: 1px solid var(--chip);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.corta .l {
  text-align: left;
}
.corta .n {
  overflow: hidden;
  text-overflow: ellipsis;
}
.ultimos {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.ultimos li {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
}
.vsCorto {
  overflow-wrap: anywhere;
}
.gano {
  font-weight: 600;
}
.gris {
  color: var(--gris);
}
.competir {
  font-size: 14px;
  font-weight: 500;
}
</style>
