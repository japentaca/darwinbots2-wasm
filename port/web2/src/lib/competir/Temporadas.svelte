<script>
// @ts-check
// Historial de temporadas del torneo (con su campeón) y su tabla histórica
// (el Hall of Fame del torneo: el Elo sigue de una temporada a otra).
import { lgAllTime, lgDrawOf } from '../../../engine/league.js';
import { num, t } from '../../i18n/index.svelte.js';
import { textoCampeon, textoFormato } from './textos.js';
import { temporadas } from './vistas.js';

/**
 * @type {{ L: import('../../../engine/league.js').League, todos: import('../../../engine/league.js').Match[],
 *   vista: number, onVer: (no: number) => void, puedeNueva: boolean, onNueva: () => void }}
 *   puedeNueva: la temporada abierta tiene partidos y no hay partido ni ronda en curso
 */
let { L, todos, vista, onVer, puedeNueva, onNueva } = $props();

let confirmar = $state(false);

const tr = { t, num: (/** @type {number} */ n) => num(n) };
const lista = $derived(temporadas(L, todos));
const historica = $derived(lgAllTime(L, todos));
const completas = $derived(lista.filter((x) => x.terminada).length);
// los participantes se vuelven a sortear en la temporada nueva
const conSorteo = $derived(lgDrawOf(L).mode !== 'fixed');
</script>

<section class="card bloque">
  <div class="cab">
    <h2 class="h2">{t('competir.temporadas.titulo')}</h2>
    {#if confirmar}
      <button
        class="btn chico pri"
        type="button"
        onclick={() => {
  confirmar = false;
  onNueva();
}}
      >
        {t('competir.temporadas.nuevaSi', { no: num(L.seasons.length + 1) })}
      </button>
      <button class="btn chico" type="button" onclick={() => (confirmar = false)}>
        {t('competir.nuevo.cancelar')}
      </button>
    {:else}
      <button
        class="btn chico"
        type="button"
        disabled={!puedeNueva}
        onclick={() => (confirmar = true)}
      >
        {t(conSorteo ? 'competir.temporadas.nuevaSorteo' : 'competir.temporadas.nueva')}
      </button>
    {/if}
  </div>
  <p class="ayuda">{t('competir.temporadas.nueva.ayuda')}</p>
  <table class="tbl">
    <thead>
      <tr>
        <th scope="col" class="l">{t('competir.temporadas.no')}</th>
        <th scope="col" class="l">{t('competir.temporadas.formato')}</th>
        <th scope="col">{t('competir.temporadas.bots')}</th>
        <th scope="col">{t('competir.temporadas.partidos')}</th>
        <th scope="col" class="l">{t('competir.temporadas.resultado')}</th>
        <th scope="col"><span class="oculto">{t('competir.temporadas.ver')}</span></th>
      </tr>
    </thead>
    <tbody>
      {#each lista as s (s.no)}
        <tr class:on={s.no === vista}>
          <td class="l mono">{s.no}</td>
          <td class="l">{textoFormato(s.fmt, tr, s.entrants)}</td>
          <td>{num(s.entrants)}</td>
          <td>{num(s.partidos)}{s.nulos ? ` (+${num(s.nulos)})` : ''}</td>
          <td class="l">
            {s.terminada ? textoCampeon(s.campeon, tr) : t('competir.temporadas.enJuego')}
          </td>
          <td>
            <button
              class="link"
              type="button"
              disabled={s.no === vista}
              onclick={() => onVer(s.no)}
            >
              {t('competir.temporadas.ver')}
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<section class="card bloque">
  <h2 class="h2">{t('competir.temporadas.historica')}</h2>
  <p class="ayuda">
    {t('competir.temporadas.historica.ayuda', { n: num(lista.length), completas: num(completas) })}
  </p>
  {#if historica.length}
    <table class="tbl">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col" class="l">{t('competir.tabla.bot')}</th>
          <th scope="col" title={t('competir.temporadas.titulos.ayuda')}>🏆</th>
          <th scope="col" title={t('competir.temporadas.jugadas.ayuda')}>
            {t('competir.temporadas.jugadas')}
          </th>
          <th scope="col">{t('competir.tabla.pj')}</th>
          <th scope="col">{t('competir.tabla.g')}</th>
          <th scope="col">%</th>
          <th scope="col">Elo</th>
        </tr>
      </thead>
      <tbody>
        {#each historica.slice(0, 50) as r, i (r.name)}
          <tr>
            <td>{i + 1}</td>
            <td class="l">
              <span class="nombre"
                ><span class="sw redondo" style:background={r.color}></span>{r.name}</span
              >
            </td>
            <td>{r.titles || ''}</td>
            <td>{num(r.seasons)}</td>
            <td>{num(r.p)}</td>
            <td>{num(r.w)}</td>
            <td>{num(Math.round((r.w / r.p) * 100))}</td>
            <td>{num(Math.round(r.elo))}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="ayuda">{t('competir.partidos.vacio')}</p>
  {/if}
</section>

<style>
.bloque {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cab {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.btn.chico {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
}
.h2 {
  flex-grow: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--gris-claro);
  font-weight: 600;
  text-align: right;
  padding: 6px;
  border-bottom: 1px solid var(--borde);
}
.tbl td {
  padding: 6px;
  border-bottom: 1px solid var(--chip);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.tbl .l {
  text-align: left;
}
tr.on td {
  background: var(--seleccion);
}
.nombre {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.redondo {
  border-radius: 50%;
}
.link {
  font: inherit;
  font-size: 13px;
  border: 0;
  background: transparent;
  color: var(--acento);
  cursor: pointer;
}
.link:disabled {
  color: var(--gris-claro);
  cursor: default;
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
