<script>
// @ts-check
// Reglas de un torneo (paso 3 del asistente y pestaña Reglas mientras la
// temporada no tiene partidos; decisión 21): el mundo es un escenario sin
// especies (base F1, sin costos o uno de Experimentar: de fábrica, propio o
// el borrador) y los valores del partido.
import { textoEn } from '../../../engine/escenarios/index.js';
import { idioma, num, t } from '../../i18n/index.svelte.js';
import { rangoCampo } from './asistente.js';
import { textoRegla } from './textos.js';

/**
 * @typedef {{id: string, origen: 'fabrica' | 'propio' | 'borrador', escenario: any}} OpcionEscenario
 * @type {{ fmt: Record<string, any>, tipo: string, escenarioId?: string,
 *   escenarios: OpcionEscenario[], bloqueado?: boolean,
 *   onFmt: (k: string, v: any) => void,
 *   onReglas: (sel: {tipo: 'f1' | 'sincostos' | 'escenario', escenario?: any, id?: string}) => void }}
 */
let { fmt, tipo, escenarioId = '', escenarios, bloqueado = false, onFmt, onReglas } = $props();

const uid = $props.id();
const tr = { t, num: (/** @type {number} */ x) => num(x) };
const NUMEROS = ['qty', 'nrg', 'rounds', 'wins', 'cap', 'popCap'];

/** @param {OpcionEscenario} o */
const nombreOpcion = (o) =>
  o.origen === 'borrador'
    ? t('competir.reglas.borrador')
    : `${textoEn(o.escenario.nombre, idioma() === 'en' ? 'en' : 'es')}${o.origen === 'propio' ? ` · ${t('competir.reglas.propio')}` : ''}`;

let elegido = $state('');
$effect(() => {
  if (escenarioId && escenarios.some((o) => o.id === escenarioId)) elegido = escenarioId;
  else if (!elegido || !escenarios.some((o) => o.id === elegido)) elegido = escenarios[0]?.id ?? '';
});

function usarEscenario() {
  const o = escenarios.find((x) => x.id === elegido);
  if (o) onReglas({ tipo: 'escenario', escenario: o.escenario, id: o.id });
}
</script>

<fieldset class="bloque" disabled={bloqueado}>
  <legend class="lbl">{t('competir.reglas.mundo')}</legend>
  <label class="opcion">
    <input
      type="radio"
      name={`${uid}-r`}
      checked={tipo === 'f1'}
      onchange={() => onReglas({ tipo: 'f1' })}
    >
    <span
      ><strong>{t('competir.reglas.f1')}</strong>
      <span class="ayuda">{t('competir.reglas.f1.desc')}</span></span
    >
  </label>
  <label class="opcion">
    <input
      type="radio"
      name={`${uid}-r`}
      checked={tipo === 'sincostos'}
      onchange={() => onReglas({ tipo: 'sincostos' })}
    >
    <span
      ><strong>{t('competir.reglas.sincostos')}</strong>
      <span class="ayuda">{t('competir.reglas.sincostos.desc')}</span></span
    >
  </label>
  <div class="opcion">
    <input
      type="radio"
      name={`${uid}-r`}
      checked={tipo === 'escenario'}
      disabled={!escenarios.length}
      onchange={usarEscenario}
      aria-label={t('competir.reglas.escenario')}
    >
    <span class="col">
      <strong>{t('competir.reglas.escenario')}</strong>
      <span class="ayuda">{t('competir.reglas.escenario.desc')}</span>
      {#if escenarios.length}
        <select
          class="sel"
          bind:value={elegido}
          onchange={() => {
  if (tipo === 'escenario') usarEscenario();
}}
          aria-label={t('competir.reglas.elegirEscenario')}
        >
          {#each escenarios as o (o.id)}
            <option value={o.id}>{nombreOpcion(o)}</option>
          {/each}
        </select>
      {:else}
        <span class="ayuda">{t('competir.reglas.sinEscenarios')}</span>
      {/if}
    </span>
  </div>
  {#if tipo === 'clasica'}
    <p class="ayuda">{t('competir.reglas.clasica')}</p>
  {/if}
</fieldset>

<fieldset class="bloque" disabled={bloqueado}>
  <legend class="lbl">{t('competir.reglas.valores')}</legend>
  <div class="campos">
    {#each NUMEROS as k (k)}
      <label class="campo" title={t(`competir.campo.${k}.ayuda`)}>
        {t(`competir.campo.${k}`)}
        <input
          class="mono"
          type="number"
          min={rangoCampo(k, fmt)?.[0]}
          max={rangoCampo(k, fmt)?.[1]}
          value={fmt[k] ?? 0}
          onchange={(e) => onFmt(k, e.currentTarget.value)}
        >
      </label>
      {#if k === 'cap'}
        <label class="campo" title={t('competir.campo.capMode.ayuda')}>
          {t('competir.campo.capMode')}
          <select
            value={fmt.capMode === 'nrg' ? 'nrg' : 'pop'}
            onchange={(e) => onFmt('capMode', e.currentTarget.value)}
          >
            <option value="pop">{t('competir.campo.capMode.pop')}</option>
            <option value="nrg">{t('competir.campo.capMode.nrg')}</option>
          </select>
        </label>
      {/if}
    {/each}
  </div>
  <p class="ayuda">{textoRegla(Number(fmt.rounds) || 1, Number(fmt.wins) || 0, tr)}</p>
</fieldset>

<style>
.bloque {
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--tarjeta);
  padding: 12px 16px 14px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.bloque legend {
  padding: 0 4px;
}
.opcion {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 14px;
  line-height: 1.45;
}
.opcion input {
  margin-top: 4px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.sel,
.campo input,
.campo select {
  font: inherit;
  font-size: 13px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: #fff;
  max-width: 100%;
}
.campos {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--chip-texto);
  width: 170px;
}
</style>
