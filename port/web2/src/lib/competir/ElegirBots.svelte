<script>
// @ts-check
// Participantes desde la Biblioteca (decisión 22): búsqueda, origen,
// selecciones con nombre (se agregan enteras) y sorteo de N de un pool
// (lgPool). Devuelve claves de la Biblioteca; el ADN se congela al
// inscribirlos (participantesDeEntradas). Los vegetales no pelean.
import { onMount } from 'svelte';
import { entradasDe, filtrar } from '../../../engine/biblioteca.js';
import { num, t } from '../../i18n/index.svelte.js';
import { asegurarBiblioteca, bib, ui } from '../bots/biblioteca.svelte.js';
import { clavesDelPool, inventarioClaves, sortearClaves } from './asistente.js';
import SelectorPool from './SelectorPool.svelte';

/** Cuántos resultados de la búsqueda se muestran. */
const MAX_VISTOS = 60;

/**
 * @type {{ claves: string[], onCambio: (claves: string[]) => void, accion?: string,
 *   onAccion?: (claves: string[]) => void, disabled?: boolean }}
 *   Con onAccion, la lista elegida es un borrador que se confirma con el
 *   botón `accion` (Participantes de un torneo ya creado).
 */
let { claves, onCambio, accion = '', onAccion, disabled = false } = $props();

const uid = $props.id();
let q = $state('');
/** @type {'' | 'foro' | 'propio'} */
let origen = $state('');
let pool = $state('all');
let n = $state(8);
let seleccion = $state('');

onMount(() => {
  asegurarBiblioteca();
});

const elegidas = $derived(new Set(claves));
const peleadores = $derived(bib.indice.filter((e) => !e.vegetal));
const hallados = $derived(filtrar(peleadores, { q, origen }).filter((e) => !elegidas.has(e.clave)));
const vistos = $derived(hallados.slice(0, MAX_VISTOS));
const lista = $derived(entradasDe(bib.indice, claves));
const inv = $derived(
  inventarioClaves({ indice: bib.indice, sel: ui.sel, selecciones: bib.selecciones }),
);
const enPool = $derived(clavesDelPool(inv, pool));

/** @param {string} k */
const sumar = (k) => onCambio([...claves, k]);
/** @param {string} k */
const quitar = (k) => onCambio(claves.filter((x) => x !== k));

function agregarSeleccion() {
  const s = bib.selecciones.find((x) => x.nombre === seleccion);
  if (!s) return;
  const nuevas = entradasDe(bib.indice, s.claves)
    .filter((e) => !e.vegetal && !elegidas.has(e.clave))
    .map((e) => e.clave);
  onCambio([...claves, ...nuevas]);
}

function sortear() {
  onCambio([...claves, ...sortearClaves(enPool, claves, Math.trunc(Number(n)) || 0)]);
}
</script>

<div class="elegir">
  <div class="buscar">
    <input
      class="q"
      type="search"
      bind:value={q}
      placeholder={t('competir.elegir.buscar')}
      aria-label={t('competir.elegir.buscar')}
      {disabled}
    >
    <select class="sel" bind:value={origen} aria-label={t('competir.elegir.origen')} {disabled}>
      <option value="">{t('competir.elegir.origen.todos')}</option>
      <option value="foro">{t('competir.elegir.origen.foro')}</option>
      <option value="propio">{t('competir.elegir.origen.propio')}</option>
    </select>
  </div>

  {#if !bib.listo}
    <p class="ayuda">{t('competir.elegir.cargando')}</p>
  {:else}
    <ul class="hallados" aria-label={t('competir.elegir.resultados')}>
      {#each vistos as e (e.clave)}
        <li>
          <button
            type="button"
            class="hit"
            onclick={() => sumar(e.clave)}
            {disabled}
            title={e.archivo ?? e.nombre}
          >
            <span class="mas">+</span>
            <span class="nom">{e.nombre}</span>
            <span class="org"
              >{e.clase === 'propio' ? t('competir.elegir.origen.propioCorto') : e.foro}</span
            >
          </button>
        </li>
      {:else}
        <li class="ayuda">{t('competir.elegir.nada')}</li>
      {/each}
    </ul>
    {#if hallados.length > MAX_VISTOS}
      <p class="ayuda">{t('competir.elegir.mas', { n: num(hallados.length - MAX_VISTOS) })}</p>
    {/if}

    <div class="fila">
      {#if bib.selecciones.length}
        <select
          class="sel"
          bind:value={seleccion}
          aria-label={t('competir.elegir.seleccion')}
          {disabled}
        >
          <option value="">{t('competir.elegir.seleccion')}</option>
          {#each bib.selecciones as s (s.nombre)}
            <option value={s.nombre}>{s.nombre} ({num(s.claves.length)})</option>
          {/each}
        </select>
        <button
          class="btn chico"
          type="button"
          disabled={disabled || !seleccion}
          onclick={agregarSeleccion}
        >
          {t('competir.elegir.agregarSeleccion')}
        </button>
      {/if}
    </div>
    <div class="fila">
      <label class="n" for={`${uid}-n`}>{t('competir.elegir.sortear')}</label>
      <input
        id={`${uid}-n`}
        class="num mono"
        type="number"
        min="1"
        max="500"
        bind:value={n}
        {disabled}
      >
      <span class="ayuda">{t('competir.elegir.de')}</span>
      <SelectorPool valor={pool} onCambio={(p) => (pool = p)} {disabled} />
      <button
        class="btn chico"
        type="button"
        disabled={disabled || !enPool.length}
        onclick={sortear}
      >
        {t('competir.elegir.sortearBoton')}
      </button>
      <span class="ayuda">{t('competir.elegir.enPool', { n: num(enPool.length) })}</span>
    </div>
  {/if}

  <div class="elegidos">
    <div class="cab">
      <span class="lbl">{t('competir.elegir.elegidos', { n: num(lista.length) })}</span>
      {#if lista.length}
        <button class="link" type="button" onclick={() => onCambio([])} {disabled}>
          {t('competir.elegir.vaciar')}
        </button>
      {/if}
    </div>
    {#if lista.length}
      <ul>
        {#each lista as e (e.clave)}
          <li>
            <span class="nom">{e.nombre}</span>
            <button
              class="x"
              type="button"
              aria-label={t('competir.elegir.quitar', { nombre: e.nombre })}
              onclick={() => quitar(e.clave)}
              {disabled}
            >
              ×
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="ayuda">{t('competir.elegir.vacio')}</p>
    {/if}
    {#if onAccion}
      <button
        class="btn pri chico"
        type="button"
        disabled={disabled || !lista.length}
        onclick={() => onAccion(claves)}
      >
        {accion}
      </button>
    {/if}
  </div>
</div>

<style>
.elegir {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.buscar,
.fila {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.q {
  flex: 1;
  min-width: 180px;
}
.q,
.sel,
.num {
  font: inherit;
  font-size: 13px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--campo);
}
.num {
  width: 70px;
}
.hallados {
  list-style: none;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
  padding: 2px;
}
.hit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--borde-control);
  background: var(--tarjeta);
  cursor: pointer;
  color: var(--texto);
  max-width: 100%;
}
.hit:hover {
  background: var(--hover-claro);
}
.mas {
  color: var(--acento);
  font-weight: 700;
}
.nom {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.org {
  color: var(--gris-claro);
  font-size: 11px;
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.n {
  font-size: 13px;
}
.elegidos {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--borde);
  padding-top: 10px;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.elegidos ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.elegidos li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 3px 4px 3px 9px;
  border-radius: 999px;
  background: var(--chip);
  color: var(--chip-texto);
  max-width: 100%;
}
.x,
.link {
  font: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--gris);
}
.x {
  font-size: 15px;
  line-height: 1;
  padding: 0 4px;
}
.link {
  font-size: 12px;
  color: var(--acento);
}
.btn.chico {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
}
.btn.pri.chico {
  align-self: flex-start;
}
</style>
