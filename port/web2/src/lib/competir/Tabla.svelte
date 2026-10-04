<script>
// @ts-check
// Tabla de la temporada (decisión 22): puntos y Buchholz en el suizo,
// coronas en la colina, Elo, % de rondas ganadas por el tope de ciclos,
// ciclos promedio, últimos resultados, desempates y, hasta 14
// participantes, los enfrentamientos directos.
import { LG_H2H_MAX } from '../../../engine/league.js';
import { num, t } from '../../i18n/index.svelte.js';
import { claveDesempate, filasTabla, matrizH2H } from './vistas.js';

/** @type {{ S: import('../../../engine/league.js').Season, ms: import('../../../engine/league.js').Match[] }} */
let { S, ms } = $props();

const filas = $derived(filasTabla(S, ms));
const suizo = $derived(S.fmt.format === 'swiss');
const colina = $derived(S.fmt.format === 'koth');
const h2h = $derived(matrizH2H(S, ms));
</script>

<section class="card tabla">
  {#if !filas.length}
    <p class="vacio">{t('competir.tabla.vacia')}</p>
  {:else}
    <div class="scroll">
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" class="l">{t('competir.tabla.bot')}</th>
            {#if suizo}
              <th scope="col" title={t('competir.tabla.pts.ayuda')}>{t('competir.tabla.pts')}</th>
              <th scope="col" title={t('competir.tabla.bh.ayuda')}>{t('competir.tabla.bh')}</th>
            {/if}
            <th scope="col" title={t('competir.tabla.pj.ayuda')}>{t('competir.tabla.pj')}</th>
            <th scope="col" title={t('competir.tabla.g.ayuda')}>{t('competir.tabla.g')}</th>
            <th scope="col" title={t('competir.tabla.p.ayuda')}>{t('competir.tabla.p')}</th>
            <th scope="col">%</th>
            {#if colina}
              <th scope="col" title={t('competir.tabla.coronas.ayuda')}>👑</th>
            {/if}
            <th scope="col" title={t('competir.tabla.tope.ayuda')}>{t('competir.tabla.tope')}</th>
            <th scope="col" title={t('competir.tabla.ciclos.ayuda')}>
              {t('competir.tabla.ciclos')}
            </th>
            <th scope="col">Elo</th>
            <th scope="col">{t('competir.tabla.ultimos')}</th>
          </tr>
        </thead>
        <tbody>
          {#each filas as r (r.name)}
            <tr>
              <td>{r.puesto}</td>
              <td class="l">
                <span class="nombre">
                  <span class="sw redondo" style:background={r.color}></span>
                  {#if r.campeon}
                    <span title={t('competir.tabla.campeon')}>🏆</span>
                  {/if}
                  {r.name}
                </span>
              </td>
              {#if suizo}
                <td
                  class="fuerte"
                  title={r.byes ? t('competir.tabla.byes', { n: num(r.byes) }) : undefined}
                >
                  {r.pts === undefined ? '' : num(r.pts)}
                </td>
                <td>{r.bh === undefined ? '' : num(r.bh)}</td>
              {/if}
              <td>{num(r.p)}</td>
              <td class:fuerte={!suizo}>{num(r.w)}</td>
              <td>{num(r.l)}</td>
              <td>{r.pct === null ? '–' : num(r.pct)}</td>
              {#if colina}
                <td>{r.coronas || ''}</td>
              {/if}
              <td>{r.porTope === null ? '' : `${num(r.porTope)} %`}</td>
              <td>{r.ciclos === null ? '' : num(r.ciclos)}</td>
              <td>{num(r.elo)}</td>
              <td>
                <span class="ultimos">
                  {#each r.ultimos as u, i (i)}
                    <span
                      class="res"
                      class:gano={u === 'G'}
                      title={t(u === 'G' ? 'competir.tabla.gano' : 'competir.tabla.perdio')}
                    >
                      {t(u === 'G' ? 'competir.tabla.G' : 'competir.tabla.P')}
                    </span>
                  {/each}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="ayuda">{t(claveDesempate(S.fmt))} {t('competir.tabla.nulos')}</p>
  {/if}
</section>

{#if h2h}
  <details class="card h2h">
    <summary>{t('competir.tabla.h2h')}</summary>
    <p class="ayuda">{t('competir.tabla.h2h.ayuda')}</p>
    <div class="scroll">
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col" class="l">{t('competir.tabla.bot')}</th>
            {#each h2h.filas as _f, j (j)}
              <th scope="col">{j + 1}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each h2h.filas as f, i (f.name)}
            <tr>
              <td>{i + 1}</td>
              <td class="l">
                <span class="nombre"
                  ><span class="sw redondo" style:background={f.color}></span>{f.name}</span
                >
              </td>
              {#each h2h.celdas[i] as c, j (j)}
                {#if !c}
                  <td class="x">·</td>
                {:else if c.vacio}
                  <td class="x"></td>
                {:else}
                  <td
                    class:arriba={c.a > c.b}
                    class:abajo={c.a < c.b}
                    title={`${f.name} ${c.a}–${c.b} ${h2h.filas[j].name}`}
                  >
                    {c.a}–{c.b}
                  </td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
{:else if filas.length > LG_H2H_MAX}
  <p class="ayuda">
    {t('competir.tabla.h2h.muchos', { max: num(LG_H2H_MAX), n: num(filas.length) })}
  </p>
{/if}

<style>
.tabla,
.h2h {
  padding: 6px 16px 10px;
}
.scroll {
  overflow: auto;
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
  padding: 8px 6px;
  border-bottom: 1px solid var(--borde);
  white-space: nowrap;
}
.tbl td {
  padding: 7px 6px;
  border-bottom: 1px solid var(--chip);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.tbl .l {
  text-align: left;
}
.nombre {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.redondo {
  border-radius: 50%;
}
.fuerte {
  font-weight: 600;
}
.ultimos {
  display: inline-flex;
  gap: 3px;
}
.res {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: var(--borde);
  color: var(--chip-texto);
}
.res.gano {
  background: var(--acento);
  color: var(--sobre-acento);
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 8px 0 0;
}
.vacio {
  color: var(--gris);
  font-size: 14px;
}
summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  padding: 6px 0;
}
.x {
  color: var(--gris-claro);
  text-align: center;
}
.arriba {
  color: var(--acento);
  font-weight: 600;
}
.abajo {
  color: var(--error-texto);
}
</style>
