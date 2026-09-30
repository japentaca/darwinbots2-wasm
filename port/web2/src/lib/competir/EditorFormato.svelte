<script>
// @ts-check
// Formato de un torneo (paso 1 del asistente y pestaña Reglas mientras la
// temporada no tiene partidos): las 6 tarjetas con su esquema y los
// valores propios del formato elegido (decisión 22).
import { lgSwissRounds } from '../../../engine/league.js';
import { num, t } from '../../i18n/index.svelte.js';
import { CAMPOS_FORMATO, esquemaFormato, rangoCampo } from './asistente.js';
import { FORMATOS, textoColina } from './textos.js';

/**
 * @type {{ fmt: Record<string, any>, n?: number, bloqueado?: boolean,
 *   onCambio: (k: string, v: any) => void }}
 */
let { fmt, n = 0, bloqueado = false, onCambio } = $props();

const uid = $props.id();
const tr = { t, num: (/** @type {number} */ x) => num(x) };
const campos = $derived(
  CAMPOS_FORMATO[/** @type {keyof typeof CAMPOS_FORMATO} */ (fmt.format)] ?? [],
);
</script>

<fieldset class="formatos">
  <legend class="oculto">{t('competir.formato.titulo')}</legend>
  {#each FORMATOS as f (f)}
    <button
      type="button"
      class="fmt"
      class:on={fmt.format === f}
      aria-pressed={fmt.format === f}
      disabled={bloqueado}
      onclick={() => onCambio('format', f)}
    >
      <strong>{t(`competir.formato.${f}`)}</strong>
      <span class="desc">{t(`competir.formato.${f}.desc`)}</span>
      <span class="mono esquema"
        >{esquemaFormato({ ...fmt, format: f }, n, t('competir.formato.cup.tercero')).join('\n')}</span
      >
      <span class="ayuda">{t(`competir.formato.${f}.nota`)}</span>
    </button>
  {/each}
</fieldset>

{#if campos.length}
  <div class="campos">
    {#each campos as k (k)}
      {#if k === 'kothEnd'}
        <label class="campo" for={`${uid}-${k}`}>
          {t('competir.campo.kothEnd')}
          <select
            id={`${uid}-${k}`}
            value={fmt.kothEnd}
            disabled={bloqueado}
            onchange={(e) => onCambio(k, e.currentTarget.value)}
          >
            <option value="retire">{t('competir.campo.kothEnd.retire')}</option>
            <option value="never">{t('competir.campo.kothEnd.never')}</option>
          </select>
        </label>
      {:else if k === 'pots'}
        <label class="campo" for={`${uid}-${k}`}>
          {t('competir.campo.pots')}
          <select
            id={`${uid}-${k}`}
            value={fmt.pots === 'random' ? 'random' : 'elo'}
            disabled={bloqueado}
            onchange={(e) => onCambio(k, e.currentTarget.value)}
          >
            <option value="elo">{t('competir.campo.pots.elo')}</option>
            <option value="random">{t('competir.campo.pots.random')}</option>
          </select>
        </label>
      {:else if k === 'legs' || k === 'groupLegs'}
        <label class="campo" for={`${uid}-${k}`}>
          {t(`competir.campo.${k}`)}
          <select
            id={`${uid}-${k}`}
            value={String(fmt[k] === 2 ? 2 : 1)}
            disabled={bloqueado}
            onchange={(e) => onCambio(k, Number(e.currentTarget.value))}
          >
            <option value="1">{t('competir.campo.vueltas.una')}</option>
            <option value="2">{t('competir.campo.vueltas.dos')}</option>
          </select>
        </label>
      {:else if k === 'third' || k === 'noRepeat'}
        <label class="campo check" title={t(`competir.campo.${k}.ayuda`)}>
          <input
            type="checkbox"
            checked={!!fmt[k]}
            disabled={bloqueado}
            onchange={(e) => onCambio(k, e.currentTarget.checked)}
          >
          {t(`competir.campo.${k}`)}
        </label>
      {:else}
        <label class="campo" for={`${uid}-${k}`} title={t(`competir.campo.${k}.ayuda`)}>
          {t(`competir.campo.${k}`)}
          <input
            id={`${uid}-${k}`}
            class="mono"
            type="number"
            min={rangoCampo(k, fmt)?.[0]}
            max={rangoCampo(k, fmt)?.[1]}
            value={fmt[k]}
            disabled={bloqueado}
            onchange={(e) => onCambio(k, e.currentTarget.value)}
          >
        </label>
      {/if}
    {/each}
  </div>
  {#if fmt.format === 'koth'}
    <p class="ayuda">{textoColina(fmt, tr)}</p>
  {:else if fmt.format === 'swiss'}
    <p class="ayuda">
      {t('competir.formato.swiss.explica', {
  n: num(lgSwissRounds(fmt, Math.max(2, n || 16))),
  bots: num(Math.max(2, n || 16)),
})}
    </p>
  {:else if fmt.format === 'cup'}
    <p class="ayuda">{t('competir.formato.cup.explica')}</p>
  {/if}
{:else if fmt.format === 'single'}
  <p class="ayuda">{t('competir.formato.single.explica')}</p>
{:else if fmt.format === 'ladder'}
  <p class="ayuda">{t('competir.formato.ladder.explica')}</p>
{/if}

<style>
.formatos {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.fmt {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  font: inherit;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--borde-control);
  background: var(--tarjeta);
  cursor: pointer;
  color: var(--texto);
}
.fmt:disabled {
  cursor: default;
  opacity: 0.7;
}
.fmt.on {
  border-color: var(--acento);
  box-shadow: inset 0 0 0 1px var(--acento);
  background: #eef5f4;
  opacity: 1;
}
.fmt strong {
  font-size: 15px;
}
.desc {
  font-size: 13px;
  line-height: 1.45;
  color: var(--chip-texto);
}
.esquema {
  font-size: 12px;
  color: var(--acento);
  white-space: pre;
  line-height: 1.35;
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.campos {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 4px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--chip-texto);
}
.campo.check {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  align-self: flex-end;
  height: 34px;
}
.campo input[type="number"],
.campo select {
  font: inherit;
  font-size: 13px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: #fff;
  min-width: 110px;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
@media (max-width: 1100px) {
  .formatos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
