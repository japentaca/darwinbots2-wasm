<script>
// @ts-check
// «Nuevo torneo» (decisión 22): asistente de 3 pasos. 1 · formato (con su
// esquema), 2 · participantes desde la Biblioteca (lista fija, sorteo en
// cada temporada o en cada pelea), 3 · reglas (un escenario sin especies)
// y valores del partido. El estado y las validaciones son de asistente.js.
import { onMount } from 'svelte';
import { ESCENARIOS_FABRICA } from '../../../engine/escenarios/fabrica.js';
import { num, t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { bib, ui } from '../bots/biblioteca.svelte.js';
import { escenariosPropios, estadoExp } from '../experimentar/estado.svelte.js';
import {
  clavesDelPool,
  conFormato,
  erroresDelPaso,
  fmtCon,
  inventarioClaves,
  mover,
  nuevoAsistente,
  validarParticipantes,
} from './asistente.js';
import EditorFormato from './EditorFormato.svelte';
import EditorPartido from './EditorPartido.svelte';
import ElegirBots from './ElegirBots.svelte';
import SelectorPool from './SelectorPool.svelte';
import { crearTorneo, est } from './torneos.svelte.js';

/** @type {{ onCancelar: () => void }} */
let { onCancelar } = $props();

const uid = $props.id();
let a = $state(nuevoAsistente());
/** @type {string} id de la opción de escenario elegida en el paso 3 */
let escenarioId = $state('');
/** @type {any[]} */
let propios = $state.raw([]);

onMount(() => {
  escenariosPropios()
    .listar()
    .then((r) => {
      propios = r.escenarios;
    })
    .catch(() => {
      propios = [];
    });
});

const opcionesEscenario = $derived([
  ...(estadoExp.borrador
    ? [{ id: 'borrador', origen: /** @type {const} */ ('borrador'), escenario: estadoExp.borrador }]
    : []),
  ...ESCENARIOS_FABRICA.map((e) => ({
    id: `f:${e.id}`,
    origen: /** @type {const} */ ('fabrica'),
    escenario: e,
  })),
  ...propios.map((e) => ({
    id: `p:${e.id}`,
    origen: /** @type {const} */ ('propio'),
    escenario: e,
  })),
]);

const tamPool = $derived(
  clavesDelPool(
    inventarioClaves({ indice: bib.indice, sel: ui.sel, selecciones: bib.selecciones }),
    a.pool,
  ).length,
);
const ctx = $derived({ tamPool });
const errores = $derived(erroresDelPaso(a, ctx));
const avisos = $derived(a.paso === 2 ? validarParticipantes(a, ctx).avisos : []);
const nParticipantes = $derived(
  a.modo === 'fixed' ? a.claves.length : Math.min(Number(a.n) || 0, tamPool),
);

const PASOS = /** @type {const} */ ([1, 2, 3]);

async function crear() {
  if (errores.length || est.ocupado) return;
  const L = await crearTorneo($state.snapshot(a));
  if (L) window.location.hash = hashDe('competir', L.id);
}
</script>

<div class="asistente">
  <div class="cab">
    <h1>{t('competir.nuevo.titulo')}</h1>
    <ol class="pasos" aria-label={t('competir.nuevo.pasos')}>
      {#each PASOS as p (p)}
        <li class="chip" class:on={a.paso === p} aria-current={a.paso === p ? 'step' : undefined}>
          {t(`competir.nuevo.paso${p}`)}
        </li>
      {/each}
    </ol>
  </div>

  {#if a.paso === 1}
    <p class="ayuda">{t('competir.nuevo.paso1.ayuda')}</p>
    <EditorFormato
      fmt={a.fmt}
      n={nParticipantes}
      onCambio={(k, v) => (a = k === 'format' ? conFormato(a, v) : { ...a, fmt: fmtCon(a.fmt, k, v) })}
    />
  {:else if a.paso === 2}
    <p class="ayuda">{t('competir.nuevo.paso2.ayuda')}</p>
    <fieldset class="modos">
      <legend class="lbl">{t('competir.entrantes.modo')}</legend>
      {#each ['fixed', 'random', 'fight'] as m (m)}
        <label class="modo">
          <input
            type="radio"
            name={`${uid}-modo`}
            checked={a.modo === m}
            onchange={() => (a = { ...a, modo: /** @type {any} */ (m) })}
          >
          <span
            ><strong>{t(`competir.entrantes.${m}`)}</strong>
            <span class="ayuda">{t(`competir.entrantes.${m}.desc`)}</span></span
          >
        </label>
      {/each}
    </fieldset>
    {#if a.modo === 'fixed'}
      <ElegirBots claves={a.claves} onCambio={(c) => (a = { ...a, claves: c })} />
    {:else}
      <div class="sorteo">
        <label for={`${uid}-n`}>{t('competir.entrantes.cuantos')}</label>
        <input id={`${uid}-n`} class="num mono" type="number" min="2" bind:value={a.n}>
        <span>{t('competir.elegir.de')}</span>
        <SelectorPool valor={a.pool} onCambio={(p) => (a = { ...a, pool: p })} />
        <span class="ayuda">{t('competir.elegir.enPool', { n: num(tamPool) })}</span>
      </div>
      <p class="ayuda">
        {t(a.modo === 'fight' ? 'competir.entrantes.fight.ayuda' : 'competir.entrantes.random.ayuda')}
      </p>
    {/if}
  {:else}
    <p class="ayuda">{t('competir.nuevo.paso3.ayuda')}</p>
    <label class="nombre" for={`${uid}-nombre`}>
      {t('competir.nuevo.nombre')}
      <input
        id={`${uid}-nombre`}
        type="text"
        bind:value={a.nombre}
        placeholder={t('competir.nuevo.nombre.ayuda')}
        maxlength="80"
      >
    </label>
    <EditorPartido
      fmt={a.fmt}
      tipo={a.reglas.tipo}
      {escenarioId}
      escenarios={opcionesEscenario}
      onFmt={(k, v) => (a = { ...a, fmt: fmtCon(a.fmt, k, v) })}
      onReglas={(sel) => {
  escenarioId = sel.id ?? '';
  a = {
    ...a,
    reglas:
      sel.tipo === 'escenario'
        ? { tipo: 'escenario', escenario: $state.snapshot(sel.escenario) }
        : { tipo: sel.tipo },
  };
}}
    />
    <p class="lock">🔒 {t('competir.nuevo.bloqueo')}</p>
  {/if}

  {#each errores as e, i (i)}
    <p class="error" role="alert">{t(e.clave, /** @type {any} */ (e.params))}</p>
  {/each}
  {#each avisos as e, i (i)}
    <p class="aviso">{t(e.clave, /** @type {any} */ (e.params))}</p>
  {/each}

  <div class="acciones">
    <button class="btn" type="button" onclick={onCancelar}>{t('competir.nuevo.cancelar')}</button>
    {#if a.paso > 1}
      <button class="btn" type="button" onclick={() => (a = mover(a, -1, ctx))}>
        {t('competir.nuevo.atras')}
      </button>
    {/if}
    {#if a.paso < 3}
      <button
        class="btn pri"
        type="button"
        disabled={errores.length > 0}
        onclick={() => (a = mover(a, 1, ctx))}
      >
        {t(a.paso === 1 ? 'competir.nuevo.aParticipantes' : 'competir.nuevo.aReglas')}
      </button>
    {:else}
      <button
        class="btn pri"
        type="button"
        disabled={errores.length > 0 || !!est.ocupado}
        onclick={crear}
      >
        {t('competir.nuevo.crear')}
      </button>
    {/if}
  </div>
</div>

<style>
.asistente {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.cab {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  flex-grow: 1;
}
.pasos {
  display: flex;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
}
.chip.on {
  background: var(--texto);
  color: #fff;
}
.ayuda {
  font-size: 13px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.modos {
  border: 0;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.modo {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 14px;
}
.modo input {
  margin-top: 4px;
}
.sorteo {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 13px;
}
.num,
.nombre input {
  font: inherit;
  font-size: 13px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: #fff;
}
.num {
  width: 80px;
}
.nombre {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  max-width: 420px;
}
.lock {
  font-size: 12px;
  color: var(--gris);
  margin: 0;
}
.error {
  margin: 0;
  font-size: 13px;
  color: var(--error-texto, #8a2b12);
}
.aviso {
  margin: 0;
  font-size: 13px;
  color: var(--aviso-texto);
}
.acciones {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-bottom: 16px;
}
</style>
