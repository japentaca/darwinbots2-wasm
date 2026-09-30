<script>
// @ts-check
// Experimentar en modo avanzado (paso N3.7; decisión 14 y C12 de PLAN.md):
// todos los parámetros del catálogo por grupo, con buscador, variable del
// core, marca de «cambiado» respecto de la base, vuelta a la base por
// parámetro y por grupo, y vivo / requiere nueva. Edita el mismo borrador que
// el modo básico (la lógica está en avanzado.js).
import { BASES } from '../../../engine/opciones.js';
import { idioma, num, t } from '../../i18n/index.svelte.js';
import {
  clavesDeGrupo,
  escribirParametro,
  gruposAvanzado,
  numeroDeTexto,
  resumenGrupos,
  volverABase,
} from './avanzado.js';

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../../engine/opciones.js').Parametro} Parametro
 */

/**
 * @type {{
 *   borrador: Escenario,
 *   referencia: Escenario | null,
 *   onCambiar: (b: Escenario) => void,
 * }}
 */
let { borrador, referencia, onCambiar } = $props();

const idi = $derived(/** @type {'es' | 'en'} */ (idioma() === 'en' ? 'en' : 'es'));

let grupo = $state('todos');
let q = $state('');
let soloCambiados = $state(false);
/** @type {Record<string, string>} código de error de la última entrada inválida, por clave */
let errores = $state({});

const lista = $derived(resumenGrupos(borrador));
const totalCambiados = $derived(lista.reduce((n, g) => n + g.cambiados, 0));
const totalParametros = $derived(lista.reduce((n, g) => n + g.total, 0));
const grupos = $derived(gruposAvanzado(borrador, referencia, { grupo, q, soloCambiados }));
const nombreBase = $derived(BASES[borrador.opciones.base]?.[idi] ?? borrador.opciones.base);

/** id del control de un parámetro. @param {Parametro} p */
const idDe = (p) => `av-${p.clave.replace(':', '-')}`;

/** @param {number} v */
const fmt = (v) => num(v, { maximumSignificantDigits: 12 });

/** Texto de un valor según el tipo del parámetro. @param {Parametro} p @param {number} v */
function texto(p, v) {
  if (p.valor === 'bool') return t(v ? 'experimentar.valor.si' : 'experimentar.valor.no');
  if (p.valor === 'enum') {
    const o = p.valores?.find((x) => x.v === v);
    if (o) return o[idi];
  }
  return fmt(v);
}

/** @param {string} clave @param {unknown} v */
function escribir(clave, v) {
  const r = escribirParametro(borrador, clave, v);
  if (!r.ok) {
    errores = { ...errores, [clave]: r.codigo };
    return;
  }
  if (errores[clave]) {
    const { [clave]: _x, ...resto } = errores;
    errores = resto;
  }
  onCambiar(r.borrador);
}

/** @param {Parametro} p @param {HTMLInputElement} el */
function escribirNumero(p, el) {
  const n = numeroDeTexto(el.value);
  escribir(p.clave, n === null ? el.value : n);
}

/** @param {string[]} claves */
function aBase(claves) {
  const e = { ...errores };
  for (const k of claves) delete e[k];
  errores = e;
  onCambiar(volverABase(borrador, claves));
}

/** @param {Parametro} p @param {string} codigo */
function textoError(p, codigo) {
  if (codigo === 'valor-rango')
    return t('experimentar.avanzado.error.rango', { min: fmt(p.min ?? 0), max: fmt(p.max ?? 0) });
  if (codigo === 'valor-tipo')
    return t(
      p.valor === 'int'
        ? 'experimentar.avanzado.error.entero'
        : 'experimentar.avanzado.error.numero',
    );
  return t('experimentar.avanzado.error.otro');
}
</script>

<div class="av">
  <nav class="side card" aria-label={t('experimentar.avanzado.grupos')}>
    <button
      type="button"
      class:on={grupo === 'todos'}
      aria-current={grupo === 'todos' ? 'true' : undefined}
      onclick={() => (grupo = 'todos')}
    >
      <span>{t('experimentar.avanzado.todos')}</span>
      <span class="k">{totalCambiados ? `${totalCambiados}/` : ''}{totalParametros}</span>
    </button>
    {#each lista as g (g.id)}
      <button
        type="button"
        class:on={grupo === g.id}
        aria-current={grupo === g.id ? 'true' : undefined}
        onclick={() => (grupo = g.id)}
      >
        <span>{g[idi]}</span>
        <span class="k" class:hay={g.cambiados > 0}
          >{g.cambiados ? `${g.cambiados}/` : ''}{g.total}</span
        >
      </button>
    {/each}
    <p class="help pad">{t('experimentar.avanzado.cuenta')}</p>
  </nav>

  <section class="card tabla">
    <div class="filtros">
      <label class="buscar">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M20 20l-4-4"></path>
        </svg>
        <input
          type="search"
          bind:value={q}
          aria-label={t('experimentar.avanzado.buscar')}
          placeholder={t('experimentar.avanzado.buscar.placeholder')}
        >
      </label>
      <label class="solo">
        <input type="checkbox" bind:checked={soloCambiados}>
        {t('experimentar.avanzado.soloCambiados')}
      </label>
    </div>

    {#each grupos as g (g.id)}
      <div class="prow cabecera">
        <span class="lbl">{g[idi]} · {g.total}</span>
        <span class="lbl">{t('experimentar.avanzado.valor')}</span>
        <span class="lbl">{t('experimentar.avanzado.base', { base: nombreBase })}</span>
        {#if g.cambiados}
          <button
            class="reset"
            type="button"
            title={t('experimentar.avanzado.baseGrupo', { grupo: g[idi] })}
            aria-label={t('experimentar.avanzado.baseGrupo', { grupo: g[idi] })}
            onclick={() => aBase(clavesDeGrupo(g.id))}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M4 12a8 8 0 1 0 3-6.2"></path>
              <path d="M4 4v5h5"></path>
            </svg>
          </button>
        {:else}
          <span></span>
        {/if}
      </div>
      {#each g.filas as { p, valor, base, cambiado, sinAplicar, editable } (p.clave)}
        <div class="prow" class:chg={sinAplicar} data-clave={p.clave}>
          <span class="nombre">
            <span class="linea">
              <label for={idDe(p)}>{p[idi]}</label>
              <span class="var">{p.variable}</span>
              {#if cambiado}
                <span class="marca">{t('experimentar.avanzado.cambiado')}</span>
              {/if}
              {#if sinAplicar}
                <span class="sr-only">{t('experimentar.cambiado.sr')}</span>
              {/if}
            </span>
            <span class="help">{p.ayuda[idi]}</span>
            {#if p.nota}
              <span class="help nota">{p.nota[idi]}</span>
            {/if}
            {#if errores[p.clave]}
              <span class="help error" role="alert">{textoError(p, errores[p.clave])}</span>
            {/if}
          </span>
          <span class="editor">
            {#if p.valor === 'bool'}
              <input
                id={idDe(p)}
                type="checkbox"
                checked={valor !== 0}
                disabled={!editable}
                onchange={(e) => escribir(p.clave, e.currentTarget.checked)}
              >
              <span class="bool-txt">{texto(p, valor)}</span>
            {:else if p.valor === 'enum'}
              <select
                id={idDe(p)}
                class="inp"
                value={String(valor)}
                disabled={!editable}
                onchange={(e) => escribir(p.clave, Number(e.currentTarget.value))}
              >
                {#each p.valores ?? [] as o (o.v)}
                  <option value={String(o.v)}>{o[idi]}</option>
                {/each}
              </select>
            {:else}
              <input
                id={idDe(p)}
                class="inp mono"
                class:mal={!!errores[p.clave]}
                type="number"
                value={valor}
                min={p.min}
                max={p.max}
                step={p.paso ?? 'any'}
                disabled={!editable}
                aria-invalid={errores[p.clave] ? 'true' : undefined}
                onchange={(e) => escribirNumero(p, e.currentTarget)}
              >
            {/if}
          </span>
          <span class="basecol">
            <span class="mono">{texto(p, base)}</span>
            {#if !editable}
              <span class="der">{t('experimentar.avanzado.derivado')}</span>
            {:else}
              <span class={p.vivo ? 'live' : 'new'}
                >{t(p.vivo ? 'experimentar.vivo' : 'experimentar.nueva')}</span
              >
            {/if}
          </span>
          {#if cambiado && editable}
            <button
              class="reset"
              type="button"
              title={t('experimentar.avanzado.aBase', { valor: texto(p, base) })}
              aria-label={t('experimentar.avanzado.aBaseDe', { nombre: p[idi], valor: texto(p, base) })}
              onclick={() => aBase([p.clave])}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M4 12a8 8 0 1 0 3-6.2"></path>
                <path d="M4 4v5h5"></path>
              </svg>
            </button>
          {:else}
            <span></span>
          {/if}
        </div>
      {/each}
    {:else}
      <p class="help vacio">{t('experimentar.avanzado.ninguno')}</p>
    {/each}
  </section>
</div>

<style>
.av {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.side {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  position: sticky;
  top: 0;
}
.side button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  color: var(--texto);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.side button:hover {
  background: var(--hover-claro);
}
.side button.on {
  background: #e3ecea;
  font-weight: 600;
}
.k {
  font-size: 12px;
  color: var(--gris-claro);
  font-weight: 400;
  white-space: nowrap;
}
.k.hay {
  color: #8a5a00;
}
.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--gris);
}
.pad {
  padding: 8px 12px 4px;
}
.tabla {
  padding: 12px 6px 6px;
  min-width: 0;
}
.filtros {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px 10px;
  flex-wrap: wrap;
}
.buscar {
  flex: 1 1 240px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: #ffffff;
  padding: 0 10px;
  height: 36px;
  color: var(--gris-claro);
}
.buscar input {
  border: 0;
  outline: 0;
  font: inherit;
  font-size: 14px;
  flex-grow: 1;
  min-width: 0;
  background: transparent;
  color: var(--texto);
}
.solo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--chip-texto);
}
.solo input,
.editor input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--acento);
}
.prow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px 130px 34px;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-top: 1px solid #ebe9e2;
}
.prow.cabecera {
  border-top: 0;
  padding-top: 14px;
}
.prow.chg {
  background: #fff7e6;
}
.nombre {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.linea {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: baseline;
  font-size: 14px;
}
.var {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--gris-claro);
}
.marca {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 999px;
  background: #f3e3bd;
  color: #5a4a12;
}
.nota {
  font-style: italic;
}
.error {
  color: #9b2c1f;
}
.editor {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.bool-txt {
  font-size: 13px;
  color: var(--gris);
}
.inp {
  font: inherit;
  font-size: 14px;
  height: 32px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: #ffffff;
  padding: 0 8px;
  color: var(--texto);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}
.inp.mono {
  font-family: var(--mono);
  font-size: 13px;
}
.inp.mal {
  border-color: #c0392b;
}
.inp:disabled {
  background: var(--hover-claro);
}
.basecol {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.basecol .mono {
  font-size: 12px;
  color: var(--gris);
  overflow-wrap: anywhere;
}
.live,
.new,
.der {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  white-space: nowrap;
}
.live {
  color: #0a3f3a;
}
.live::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--acento);
}
.new,
.der {
  color: var(--gris-claro);
}
.new::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid #898781;
  box-sizing: border-box;
}
.reset {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--borde-control);
  background: var(--tarjeta);
  color: var(--chip-texto);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.reset:hover {
  background: var(--hover-claro);
}
.vacio {
  padding: 12px 10px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 1100px) {
  .av {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .prow {
    grid-template-columns: minmax(0, 1fr) 120px 90px 34px;
    gap: 8px;
  }
}
</style>
