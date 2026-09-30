<script>
// @ts-check
// La estructura según el formato (decisión 22): Rondas del suizo (con el
// bye), Grupos y cuadro de la copa, Peleas y coronas de la colina,
// Escalera y Calendario del todos contra todos. Cada partido jugado tiene
// ↻ (repetir con su semilla y comparar).
import { LG_ELO0, lgPairKey } from '../../../engine/league.js';
import { num, t } from '../../i18n/index.svelte.js';
import { nombreRondaCopa } from './textos.js';
import { calendarioRr, copa, escalera, peleasColina, rondasSuizo } from './vistas.js';

/**
 * @type {{ S: import('../../../engine/league.js').Season, ms: import('../../../engine/league.js').Match[],
 *   jugando: string, enCola: Set<string>, ocupado: boolean, onRepetir: (id: number) => void,
 *   eloHistorico?: Map<string, number> }}
 *   jugando: clave del par (lgPairKey) del partido en curso; enCola: pares de la ronda en segundo plano;
 *   eloHistorico: Elo de la tabla histórica del torneo (los bombos de la copa antes de jugar)
 */
let { S, ms, jugando, enCola, ocupado, onRepetir, eloHistorico = new Map() } = $props();

const tr = { t, num: (/** @type {number} */ n) => num(n) };
const f = $derived(S.fmt.format);
const colores = $derived(new Map(S.entrants.map((e) => [e.name, e.color])));
const suizo = $derived(f === 'swiss' ? rondasSuizo(S, ms) : null);
const cup = $derived(f === 'cup' ? copa(S, ms) : null);
// Copa sorteada y sin partidos: los grupos por bombo con el Elo histórico
// (con el que se arman los bombos), como el Setup de la clásica.
const bombos = $derived(
  cup?.grupos && !ms.length && Array.isArray(S.groups)
    ? /** @type {string[][]} */ (S.groups).map((g) =>
        g.map((n, p) => ({
          name: n,
          bombo: p + 1,
          elo: Math.round(eloHistorico.get(n) ?? LG_ELO0),
        })),
      )
    : null,
);
const colina = $derived(f === 'koth' ? peleasColina(S, ms) : null);
const lad = $derived(f === 'ladder' ? escalera(S, ms) : null);
const cal = $derived(f === 'rr' ? calendarioRr(S, ms) : null);

let rondaVista = $state(0);
const rondaMostrada = $derived(
  suizo?.historia.length
    ? (suizo.historia.find((r) => r.no === rondaVista) ?? suizo.historia[suizo.historia.length - 1])
    : null,
);

/** Estado de un cruce sin jugar. @param {string} a @param {string} b */
const pendiente = (a, b) => {
  const k = lgPairKey(a, b);
  if (k === jugando) return t('competir.estructura.jugando');
  if (enCola.has(k)) return t('competir.estructura.enCola');
  return t('competir.estructura.pendiente');
};
</script>

{#snippet lado(
  n,
  ganador,
  ph,
)}
  {#if n}
    <span
      class="lado"
      class:gano={ganador === n}
      class:perdio={!!ganador && ganador !== n}
      title={n}
    >
      <span class="sw redondo" style:background={colores.get(n) ?? '#8899bb'}></span>{n}
    </span>
  {:else}
    <span class="lado tbd">{ph || '—'}</span>
  {/if}
{/snippet}

{#snippet rep(
  id,
  no,
)}
  {#if id !== undefined}
    <button
      class="rep"
      type="button"
      disabled={ocupado}
      aria-label={t('competir.partidos.repetirNo', { no: num(no ?? 0) })}
      title={t('competir.partidos.repetirNo', { no: num(no ?? 0) })}
      onclick={() => onRepetir(id)}
    >
      ↻
    </button>
  {:else}
    <span class="rep vacio"></span>
  {/if}
{/snippet}

{#if suizo}
  <section class="card bloque">
    {#if suizo.fase === 'draw'}
      <p class="ayuda">{t('competir.estructura.suizoSinSorteo')}</p>
    {:else if rondaMostrada}
      <div class="cab">
        <h2 class="h2">
          {t('competir.estructura.suizoRonda', { no: num(rondaMostrada.no), de: num(suizo.rondas) })}
        </h2>
        <div class="seg" role="tablist" aria-label={t('competir.estructura.rondas')}>
          {#each suizo.historia as r (r.no)}
            <button
              type="button"
              role="tab"
              class:on={r.no === rondaMostrada.no}
              aria-selected={r.no === rondaMostrada.no}
              onclick={() => (rondaVista = r.no)}
            >
              {r.no}
            </button>
          {/each}
        </div>
      </div>
      {#each rondaMostrada.pares as p, k (k)}
        <div class="par">
          <span class="mono gris">{k + 1}</span>
          {@render lado(p.a, p.winner, '')}
          <span class="vs">{t('competir.estructura.vs')}</span>
          {@render lado(p.b, p.winner, '')}
          <span class="estado"
            >{p.winner ? t('competir.estructura.gana', { nombre: p.winner }) : pendiente(p.a, p.b)}</span
          >
          {@render rep(p.id, p.no)}
        </div>
      {/each}
      {#if rondaMostrada.bye}
        <p class="ayuda">{t('competir.estructura.bye', { nombre: rondaMostrada.bye })}</p>
      {/if}
      {#if suizo.esperan > 0}
        <p class="ayuda">{t('competir.estructura.suizoEsperan', { n: num(suizo.esperan) })}</p>
      {/if}
      <p class="ayuda">{t('competir.estructura.suizoAyuda')}</p>
    {/if}
  </section>
{:else if cup}
  <section class="card bloque">
    {#if cup.estado === 'tamano'}
      <p class="ayuda">{t('competir.nota.cup-size', { n: num(cup.n ?? 0) })}</p>
    {:else if cup.estado === 'sinSorteo'}
      <p class="ayuda">{t('competir.estructura.copaSinSorteo')}</p>
    {:else}
      <h2 class="h2">{t('competir.estructura.grupos')}</h2>
      <div class="grupos">
        {#each cup.grupos ?? [] as g, gi (g.nombre)}
          <div class="grupo">
            <div class="lbl">{t('competir.estructura.grupo', { g: g.nombre })}</div>
            <table class="mini">
              <tbody>
                {#if bombos}
                  {#each bombos[gi] ?? [] as r (r.name)}
                    <tr>
                      <td class="bombo" title={t('competir.estructura.bombo', { n: num(r.bombo) })}>
                        {r.bombo}
                      </td>
                      <td class="l">{@render lado(r.name, '', '')}</td>
                      <td title={t('competir.estructura.eloHistorico')}>{num(r.elo)}</td>
                    </tr>
                  {/each}
                {:else}
                  {#each g.filas as r, i (r.name)}
                    <tr class:pasa={i < 2}>
                      <td>{i + 1}</td>
                      <td class="l">{@render lado(r.name, '', '')}</td>
                      <td title={t('competir.tabla.pj.ayuda')}>{num(r.p)}</td>
                      <td title={t('competir.tabla.g.ayuda')}>{num(r.w)}</td>
                      <td title="Elo">{num(r.elo)}</td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
            {#each g.partidos as p, k (k)}
              <div
                class="par chico"
                class:sigue={!p.winner && lgPairKey(p.a, p.b) === cup.siguiente}
              >
                <span class="mono gris" title={t('competir.estructura.jornada', { n: num(p.day) })}
                  >{p.day}</span
                >
                {@render lado(p.a, p.winner, '')}
                {@render lado(p.b, p.winner, '')}
                {@render rep(p.id, p.no)}
              </div>
            {/each}
          </div>
        {/each}
      </div>
      {#if bombos}
        <p class="ayuda">
          {t(S.fmt.pots === 'random' ? 'competir.estructura.bombosAzar' : 'competir.estructura.bombosElo', {
  elo: num(LG_ELO0),
})}
        </p>
      {/if}
      <p class="ayuda">{t('competir.estructura.gruposAyuda')}</p>
      <h2 class="h2">{t('competir.estructura.cuadro')}</h2>
      <div class="cuadro">
        {#each cup.cuadro ?? [] as ronda, r (r)}
          <div class="columna">
            <div class="lbl">{nombreRondaCopa(ronda.length, tr)}</div>
            {#each ronda as c, k (k)}
              <div
                class="cruce"
                class:sigue={!!c.a && !!c.b && !c.winner && lgPairKey(c.a, c.b) === cup.siguiente}
              >
                {@render lado(c.a, c.winner, c.pa)}
                {@render lado(c.b, c.winner, c.pb)}
                {@render rep(c.id, c.no)}
              </div>
            {/each}
            {#if ronda.length === 1 && cup.tercero}
              <div class="lbl">{t('competir.rotulo.cup-third')}</div>
              <div class="cruce">
                {@render lado(cup.tercero.a, cup.tercero.winner, '')}
                {@render lado(cup.tercero.b, cup.tercero.winner, '')}
                {@render rep(cup.tercero.id, cup.tercero.no)}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>
{:else if colina}
  <section class="card bloque">
    <div class="cab">
      <h2 class="h2">
        {colina.rey
  ? t('competir.estructura.rey', {
      nombre: colina.rey,
      n: num(colina.racha),
      de: num(S.fmt.retire),
    })
  : t('competir.estructura.sinRey')}
      </h2>
    </div>
    {#if colina.coronas.length}
      <div class="coronas">
        <span class="lbl">{t('competir.estructura.coronas')}</span>
        {#each colina.coronas as [n, c] (n)}
          <span class="chip">{@render lado(n, '', '')} 👑 {num(c)}</span>
        {/each}
      </div>
    {/if}
    {#each colina.peleas as p (p.no)}
      <div class="pelea">
        <span class="mono gris">#{p.no}</span>
        <span class="luchadores">
          {#each p.fighters as n (n)}
            {@render lado(n, p.winner, '')}
          {/each}
        </span>
        <span class="estado">
          {#if p.winner}
            {t('competir.estructura.racha', { n: num(p.racha) })}{p.corona ? ' · 👑' : ''}
          {:else}
            {t('competir.partidos.nulo')}
          {/if}
        </span>
        {@render rep(p.id, p.no)}
      </div>
    {:else}
      <p class="ayuda">{t('competir.estructura.sinPeleas')}</p>
    {/each}
  </section>
{:else if lad}
  <section class="card bloque">
    <h2 class="h2">
      {t('competir.estructura.escalera', { n: num(lad.colocados), de: num(lad.total) })}
    </h2>
    <ol class="peldanos">
      {#each lad.peldaños as n, i (n)}
        <li class:desafio={lad.siguiente?.rival === n}>
          <span class="mono gris">{i + 1}</span>
          {@render lado(n, '', '')}
          {#if lad.siguiente?.rival === n}
            <span class="estado"
              >{t('competir.estructura.desafia', { nombre: lad.siguiente.aspirante })}</span
            >
          {/if}
        </li>
      {/each}
    </ol>
    {#if lad.esperan.length}
      <p class="ayuda">
        {t('competir.estructura.esperanEscalera', { nombres: lad.esperan.join(', ') })}
      </p>
    {/if}
    <p class="ayuda">{t('competir.formato.ladder.explica')}</p>
  </section>
{:else if cal}
  <section class="card bloque">
    {#each cal as d (d.jornada)}
      <div class="lbl">{t('competir.estructura.jornada', { n: num(d.jornada) })}</div>
      {#each d.partidos as p, k (k)}
        <div class="par chico">
          <span class="mono gris">{p.leg > 1 ? '↔' : ''}</span>
          {@render lado(p.a, p.winner, '')}
          <span class="vs">{t('competir.estructura.vs')}</span>
          {@render lado(p.b, p.winner, '')}
          <span class="estado"
            >{p.winner ? t('competir.estructura.gana', { nombre: p.winner }) : pendiente(p.a, p.b)}</span
          >
          {@render rep(p.id, p.no)}
        </div>
      {/each}
    {:else}
      <p class="ayuda">{t('competir.tabla.vacia')}</p>
    {/each}
  </section>
{/if}

<style>
.bloque {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}
.cab {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.h2 {
  margin: 4px 0;
  font-size: 15px;
  font-weight: 600;
  flex-grow: 1;
}
.seg button {
  height: 30px;
}
.par {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 24px minmax(0, 1fr) 160px 30px;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-top: 1px solid var(--chip);
  font-size: 13px;
}
.par.chico {
  grid-template-columns: 22px minmax(0, 1fr) minmax(0, 1fr) 28px;
}
.bloque > .par.chico {
  grid-template-columns: 22px minmax(0, 1fr) 24px minmax(0, 1fr) 150px 28px;
}
.par.sigue,
.cruce.sigue {
  outline: 1px solid var(--acento);
  border-radius: 6px;
}
.lado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lado.gano {
  font-weight: 600;
}
.lado.perdio {
  color: var(--gris-claro);
}
.lado.tbd {
  color: var(--gris-claro);
  font-style: italic;
}
.redondo {
  border-radius: 50%;
}
.vs {
  font-size: 12px;
  color: var(--gris);
  text-align: center;
}
.gris {
  color: var(--gris-claro);
  font-size: 12px;
}
.estado {
  font-size: 12px;
  color: var(--gris);
}
.rep {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--borde-control);
  background: var(--tarjeta);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 14px;
}
.rep:disabled {
  cursor: default;
  opacity: 0.5;
}
.rep.vacio {
  border: 0;
  background: transparent;
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 4px 0 0;
}
.grupos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.grupo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--borde);
  border-radius: 8px;
  padding: 8px;
}
.mini {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.mini td {
  padding: 3px 4px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.mini td.l {
  text-align: left;
}
.mini td.bombo {
  color: var(--gris);
  font-variant-numeric: tabular-nums;
}
.mini tr.pasa td {
  font-weight: 600;
}
.cuadro {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.columna {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: space-around;
  min-width: 190px;
}
.cruce {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  grid-template-rows: auto auto;
  gap: 2px 6px;
  border: 1px solid var(--borde);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}
.cruce .rep,
.cruce .rep.vacio {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
}
.coronas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.pelea {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 120px 30px;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-top: 1px solid var(--chip);
  font-size: 13px;
}
.luchadores {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  min-width: 0;
}
.peldanos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.peldanos li {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  padding: 4px;
  border-radius: 6px;
}
.peldanos li.desafio {
  outline: 1px solid var(--acento);
}
</style>
