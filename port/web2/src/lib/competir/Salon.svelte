<script>
// @ts-check
// Salón de la fama global (decisión 22): todos los torneos guardados, un
// renglón por ADN congelado (lgSalonGlobal): títulos, victorias y un Elo
// único sobre todos los partidos en orden de fecha.
import { onMount } from 'svelte';
import { num, t } from '../../i18n/index.svelte.js';
import { est, leerSalon } from './torneos.svelte.js';

onMount(() => {
  leerSalon();
});
</script>

<div class="salon">
  <div class="cab">
    <h1>{t('competir.salon.titulo')}</h1>
    <button class="btn chico" type="button" disabled={!!est.ocupado} onclick={leerSalon}>
      {t('competir.salon.actualizar')}
    </button>
  </div>
  <p class="ayuda">{t('competir.salon.ayuda')}</p>
  <section class="card bloque">
    {#if est.salon === null}
      <p class="ayuda">{t('competir.cargando')}</p>
    {:else if !est.salon.length}
      <p class="ayuda">{t('competir.salon.vacio')}</p>
    {:else}
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" class="l">{t('competir.tabla.bot')}</th>
            <th scope="col" title={t('competir.temporadas.titulos.ayuda')}>🏆</th>
            <th scope="col">{t('competir.salon.torneos')}</th>
            <th scope="col">{t('competir.temporadas.jugadas')}</th>
            <th scope="col">{t('competir.tabla.pj')}</th>
            <th scope="col">{t('competir.tabla.g')}</th>
            <th scope="col">%</th>
            <th scope="col">Elo</th>
          </tr>
        </thead>
        <tbody>
          {#each est.salon.slice(0, 200) as r, i (r.hash)}
            <tr>
              <td>{i + 1}</td>
              <td class="l">
                <span
                  class="nombre"
                  title={r.names.length > 1 ? t('competir.salon.alias', { nombres: r.names.join(', ') }) : undefined}
                >
                  <span class="sw redondo" style:background={r.color}></span>{r.name}
                  {#if r.names.length > 1}
                    <span class="gris">+{r.names.length - 1}</span>
                  {/if}
                </span>
              </td>
              <td>{r.titles || ''}</td>
              <td>{num(r.torneos)}</td>
              <td>{num(r.seasons)}</td>
              <td>{num(r.p)}</td>
              <td>{num(r.w)}</td>
              <td>{r.p ? num(Math.round((r.w / r.p) * 100)) : '–'}</td>
              <td>{num(Math.round(r.elo))}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</div>

<style>
.salon {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cab {
  display: flex;
  align-items: center;
  gap: 12px;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  flex-grow: 1;
}
.bloque {
  padding: 8px 16px;
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
.gris {
  color: var(--gris-claro);
  font-size: 12px;
}
.ayuda {
  font-size: 13px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.btn.chico {
  height: 32px;
  font-size: 13px;
}
</style>
