<script>
// @ts-check
// Avance automático con paneles (#/observar/torneo): la pelea en curso
// arriba del panel derecho, en lugar del rótulo de abajo del campo (el que
// se ve a pantalla completa, RotuloTv.svelte). Quién pelea, la fase, el
// ganador y las rondas ganadas; el ciclo y los bots de cada especie ya
// están en el panel «En vivo» (el marcador va compacto).
import { idioma, t } from '../../../i18n/index.svelte.js';
import Marcador from '../../competir/Marcador.svelte';
import TablaMarcador from '../../competir/TablaMarcador.svelte';
import { tr } from '../../competir/torneos.svelte.js';
import { rotuloTV } from './rotulo.js';
import { contextoTv, tv } from './tv.svelte.js';

const r = $derived(rotuloTV(tv.e, contextoTv(), tr, tv.ahora, idioma()));
const pelea = $derived(r.fase === 'lanzando' || r.fase === 'partido' || r.fase === 'resultado');
</script>

{#if pelea}
  <section class="card pelea" aria-label={t('observar.tv.aria')}>
    <div class="linea">
      {#if r.vivo}
        <span class="punto"></span>
      {/if}
      {r.linea}
    </div>
    <div class="vs">
      {#each r.vs as f, i (f.name)}
        {#if i > 0}
          <span class="contra">{t('observar.tv.contra')}</span>
        {/if}
        <span class="luchador"><span class="sw" style:background={f.color}></span>{f.name}</span>
      {/each}
    </div>
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
          <TablaMarcador
            f1={tv.final.f1}
            ciclo={tv.final.ciclo}
            colores={tv.final.colores}
            rounds={tv.final.rounds}
            wins={tv.final.wins}
            compacto
          />
        </div>
      {/if}
    {:else}
      <div class="tabla"><Marcador integrado compacto /></div>
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
</style>
