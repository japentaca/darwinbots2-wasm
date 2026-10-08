<script>
// @ts-check
// Marcador de un partido en curso (el contestBoard de la clásica): ronda,
// ciclo, población y victorias de cada luchador. `f1` = stats.f1 del
// worker; `colores` = nombre → color del participante. `cap`: tope de ciclos
// por ronda del torneo (0 = sin tope); con tope, una barra fina muestra
// cuánto va del ciclo (solo informativa).
import { num, t } from '../../i18n/index.svelte.js';
import { textoRegla } from './textos.js';

/** @type {{ f1: any, ciclo: number, colores: Map<string, string>, rounds: number, wins: number, cap?: number }} */
let { f1, ciclo, colores, rounds, wins, cap = 0 } = $props();

const tr = { t, num: (/** @type {number} */ n) => num(n) };
const total = $derived(
  f1.sp.reduce((/** @type {number} */ a, /** @type {any} */ s) => a + s.pop, 0) || 1,
);
const maxWins = $derived(Math.max(0, ...f1.sp.map((/** @type {any} */ s) => s.wins)));
const ronda = $derived(Math.min(f1.contests + 1, f1.minrounds));
const avance = $derived(cap > 0 ? Math.min(1, Math.max(0, ciclo / cap)) : 0);
</script>

<div class="marcador">
  <div class="linea">
    {#if f1.over}
      {t('competir.marcador.terminado', { ciclo: num(ciclo) })}
    {:else}
      {t('competir.marcador.ronda', {
  ronda: num(ronda),
  de: num(f1.minrounds),
  ciclo: num(ciclo),
})}
    {/if}
    {#if f1.restarts}
      · {t('competir.marcador.reinicios', { n: num(f1.restarts) })}
    {/if}
  </div>
  {#if cap > 0 && !f1.over}
    <div
      class="ciclos"
      role="progressbar"
      aria-label={t('competir.marcador.tope', { ciclo: num(ciclo), cap: num(cap) })}
      aria-valuemin="0"
      aria-valuemax={cap}
      aria-valuenow={Math.min(ciclo, cap)}
      title={t('competir.marcador.tope', { ciclo: num(ciclo), cap: num(cap) })}
    >
      <span style:width={`${Math.round(avance * 100)}%`}></span>
    </div>
  {/if}
  {#if !f1.over}
    <div class="regla">
      {textoRegla(f1.minrounds, wins, tr)}
      {#if f1.minrounds > rounds}
        · {t('competir.marcador.extendido', { de: num(rounds), a: num(f1.minrounds) })}
      {/if}
    </div>
  {/if}
  {#each f1.sp as s (s.name)}
    <div class="fila" class:fuera={!s.pop}>
      <span class="sw redondo" style:background={colores.get(s.name) ?? '#8899bb'}></span>
      <span class="nombre" title={s.name}>{s.name}</span>
      <span class="barra">
        <span
          style:width={`${Math.round((s.pop / total) * 100)}%`}
          style:background={colores.get(s.name) ?? '#8899bb'}
        ></span>
      </span>
      <span class="mono pop" title={t('competir.marcador.bots')}>{num(s.pop)}</span>
      <span
        class="mono gana"
        class:lider={s.wins > 0 && s.wins === maxWins}
        title={t('competir.marcador.victorias')}
      >
        {num(s.wins)}
      </span>
    </div>
  {/each}
</div>

<style>
.marcador {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
}
.linea {
  font-weight: 600;
}
.ciclos {
  height: 4px;
  border-radius: 2px;
  background: var(--chip);
  overflow: hidden;
}
.ciclos span {
  display: block;
  height: 4px;
  background: var(--acento);
}
.regla {
  font-size: 12px;
  color: var(--gris);
  line-height: 1.4;
}
.fila {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) 64px 40px 26px;
  align-items: center;
  gap: 8px;
}
.fila.fuera {
  opacity: 0.5;
}
.redondo {
  border-radius: 50%;
}
.nombre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.barra {
  height: 8px;
  border-radius: 4px;
  background: var(--chip);
  overflow: hidden;
  display: block;
}
.barra span {
  display: block;
  height: 8px;
}
.pop,
.gana {
  text-align: right;
  font-size: 12px;
}
.gana.lider {
  font-weight: 700;
  color: var(--acento);
}
</style>
