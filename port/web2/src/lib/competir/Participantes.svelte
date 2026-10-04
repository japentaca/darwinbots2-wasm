<script>
// @ts-check
// Participantes de la temporada: la lista (con el ADN congelado al
// inscribirse), su cantidad y su color; inscribir más desde la Biblioteca;
// el sorteo (lista fija, sorteo en cada temporada o en cada pelea) y, en la
// copa, los grupos. Todo lo de la clásica (Setup → Entrants).
import {
  LG_MAX_FIGHTERS,
  lgCupGroupsOk,
  lgCupSizeOk,
  lgDrawHint,
  lgDrawOf,
  lgPool,
  lgRrWarn,
} from '../../../engine/league.js';
import { num, t } from '../../i18n/index.svelte.js';
import { bib, ui } from '../bots/biblioteca.svelte.js';
import { inventarioClaves } from './asistente.js';
import ElegirBots from './ElegirBots.svelte';
import SelectorPool from './SelectorPool.svelte';
import { textoSorteo } from './textos.js';
import {
  agregarParticipantes,
  cambiarParticipante,
  cambiarSorteo,
  est,
  quitarParticipante,
  sortear,
  sortearGrupos,
} from './torneos.svelte.js';

/**
 * @type {{ L: import('../../../engine/league.js').League, S: import('../../../engine/league.js').Season,
 *   ms: import('../../../engine/league.js').Match[], actual: boolean, bloqueada: boolean, ronda: boolean }}
 */
let { L, S, ms, actual, bloqueada, ronda } = $props();

const uid = $props.id();
const tr = { t, num: (/** @type {number} */ n) => num(n) };
let nuevos = $state(/** @type {string[]} */ ([]));
let agregando = $state(false);

const editable = $derived(actual && !ronda);
const jugaron = $derived(new Set(ms.flatMap((m) => m.fighters)));
const dr = $derived(lgDrawOf(L));
const inv = $derived(
  inventarioClaves({ indice: bib.indice, sel: ui.sel, selecciones: bib.selecciones }),
);
const tamPool = $derived(lgPool(inv, dr.pool).length);
const pista = $derived(
  [
    textoSorteo(lgDrawHint(dr, S, bloqueada), tr),
    lgRrWarn(S, Math.min(dr.n, tamPool))
      ? t('competir.val.rrLargo', { n: num(lgRrWarn(S, Math.min(dr.n, tamPool))) })
      : '',
  ]
    .filter(Boolean)
    .join(' '),
);
const avisoCantidad = $derived(
  S.fmt.format === 'single' && S.entrants.length > LG_MAX_FIGHTERS
    ? t('competir.val.single', { max: LG_MAX_FIGHTERS, n: S.entrants.length })
    : S.fmt.format === 'cup' && S.entrants.length >= 2 && !lgCupSizeOk(S)
      ? t('competir.nota.cup-size', { n: num(S.entrants.length) })
      : lgRrWarn(S, S.entrants.length)
        ? t('competir.val.rrLargo', { n: num(lgRrWarn(S, S.entrants.length)) })
        : '',
);

async function inscribir() {
  const c = nuevos;
  nuevos = [];
  agregando = false;
  await agregarParticipantes(c);
}
</script>

<section class="card bloque">
  <div class="cab">
    <h2 class="h2">{t('competir.participantes.titulo', { n: num(S.entrants.length) })}</h2>
    {#if editable}
      <button
        class="btn chico"
        type="button"
        onclick={() => (agregando = !agregando)}
        aria-expanded={agregando}
      >
        {agregando ? t('competir.participantes.cerrar') : t('competir.participantes.agregar')}
      </button>
    {/if}
  </div>
  {#if avisoCantidad}
    <p class="aviso">{avisoCantidad}</p>
  {/if}
  {#if agregando && editable}
    <div class="agregar">
      <ElegirBots
        claves={nuevos}
        onCambio={(c) => (nuevos = c)}
        accion={t('competir.participantes.inscribir', { n: num(nuevos.length) })}
        onAccion={inscribir}
        disabled={!!est.ocupado}
      />
      <p class="ayuda">{t('competir.participantes.congelado')}</p>
    </div>
  {/if}
  {#if S.entrants.length}
    <table class="tbl">
      <thead>
        <tr>
          <th scope="col">{t('competir.participantes.color')}</th>
          <th scope="col" class="l">{t('competir.tabla.bot')}</th>
          <th scope="col" class="l">{t('competir.participantes.origen')}</th>
          <th scope="col" title={t('competir.participantes.cantidad.ayuda', { n: num(S.fmt.qty) })}>
            {t('competir.participantes.cantidad')}
          </th>
          <th scope="col" class="l">{t('competir.participantes.adn')}</th>
          <th scope="col"><span class="oculto">{t('competir.participantes.quitar')}</span></th>
        </tr>
      </thead>
      <tbody>
        {#each S.entrants as e, i (e.hash)}
          <tr>
            <td>
              <input
                type="color"
                value={e.color}
                disabled={!editable || bloqueada}
                aria-label={t('competir.participantes.colorDe', { nombre: e.name })}
                onchange={(ev) => cambiarParticipante(i, { color: ev.currentTarget.value })}
              >
            </td>
            <td class="l">{e.name}</td>
            <td class="l gris">
              {t(
  `competir.participantes.src.${['bestiary', 'hybrid', 'form', 'preset'].includes(e.src) ? e.src : 'form'}`,
)}
            </td>
            <td>
              <input
                class="num mono"
                type="number"
                min="1"
                max="200"
                value={e.qty ?? ''}
                placeholder={String(S.fmt.qty)}
                disabled={!editable || bloqueada}
                aria-label={t('competir.participantes.cantidadDe', { nombre: e.name })}
                onchange={(ev) => cambiarParticipante(i, { qty: ev.currentTarget.value })}
              >
            </td>
            <td class="l mono gris" title={t('competir.participantes.hash')}>{e.hash}</td>
            <td>
              {#if editable}
                <button
                  class="x"
                  type="button"
                  disabled={jugaron.has(e.name)}
                  title={jugaron.has(e.name) ? t('competir.participantes.yaJugo') : t('competir.participantes.quitar')}
                  aria-label={t('competir.participantes.quitarA', { nombre: e.name })}
                  onclick={() => quitarParticipante(i)}
                >
                  ×
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="ayuda">
      {S.live ? t('competir.participantes.vivos') : t('competir.participantes.vacio')}
    </p>
  {/if}
  <p class="ayuda">{t('competir.participantes.congelado')}</p>
</section>

{#if actual}
  <section class="card bloque">
    <h2 class="h2">{t('competir.entrantes.modo')}</h2>
    <div class="fila">
      <select
        class="sel"
        value={dr.mode}
        disabled={ronda}
        aria-label={t('competir.entrantes.modo')}
        onchange={(e) => cambiarSorteo({ mode: e.currentTarget.value })}
      >
        <option value="fixed">{t('competir.entrantes.fixed')}</option>
        <option value="random">{t('competir.entrantes.random')}</option>
        <option value="fight">{t('competir.entrantes.fight')}</option>
      </select>
      <label for={`${uid}-n`}>{t('competir.entrantes.cuantos')}</label>
      <input
        id={`${uid}-n`}
        class="num mono"
        type="number"
        min="2"
        max={Math.max(2, tamPool)}
        value={dr.n}
        disabled={ronda}
        onchange={(e) => cambiarSorteo({ n: e.currentTarget.value })}
      >
      <span>{t('competir.elegir.de')}</span>
      <SelectorPool valor={dr.pool} disabled={ronda} onCambio={(p) => cambiarSorteo({ pool: p })} />
      <button
        class="btn chico"
        type="button"
        disabled={bloqueada || ronda || !!est.ocupado}
        title={bloqueada ? t('competir.participantes.sorteoBloqueado') : t('competir.participantes.sortear.ayuda')}
        onclick={sortear}
      >
        🎲 {t('competir.participantes.sortear')}
      </button>
    </div>
    <p class="ayuda">{t('competir.elegir.enPool', { n: num(tamPool) })} {pista}</p>
  </section>

  {#if S.fmt.format === 'cup'}
    <section class="card bloque">
      <h2 class="h2">{t('competir.estructura.grupos')}</h2>
      <p class="ayuda">
        {lgCupGroupsOk(S)
  ? t(
      S.fmt.pots === 'random'
        ? 'competir.participantes.gruposAzar'
        : 'competir.participantes.gruposElo',
    )
  : t('competir.estructura.copaSinSorteo')}
      </p>
      <button
        class="btn chico"
        type="button"
        disabled={bloqueada || ronda || !lgCupSizeOk(S) || !!est.ocupado}
        onclick={sortearGrupos}
      >
        🎲
        {t(
  lgCupGroupsOk(S)
    ? 'competir.participantes.resortearGrupos'
    : 'competir.participantes.sortearGrupos',
)}
      </button>
    </section>
  {/if}
{/if}

<style>
.bloque {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.agregar {
  border: 1px solid var(--borde);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  padding: 4px 6px;
  border-bottom: 1px solid var(--chip);
  text-align: right;
}
.tbl .l {
  text-align: left;
}
.gris {
  color: var(--gris-claro);
}
.num,
.sel {
  font: inherit;
  font-size: 13px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--campo);
}
.num {
  width: 70px;
}
input[type="color"] {
  width: 30px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--borde-control);
  border-radius: 4px;
  background: none;
}
.x {
  font: inherit;
  font-size: 16px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--gris);
}
.x:disabled {
  cursor: default;
  opacity: 0.4;
}
.fila {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 13px;
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.aviso {
  font-size: 13px;
  color: var(--aviso-texto);
  margin: 0;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.btn.chico {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
}
</style>
