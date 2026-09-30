<script>
// @ts-check
// Reglas de la temporada (decisiones 21 y 22): el mundo (el escenario sin
// especies, o la foto del panel de la clásica en los torneos migrados) y
// los valores del partido. Formato, valores y reglas se editan solo
// mientras la temporada no tiene partidos (ni una ronda en curso).
import { onMount } from 'svelte';
import { ESCENARIOS_FABRICA } from '../../../engine/escenarios/fabrica.js';
import { textoEn } from '../../../engine/escenarios/index.js';
import { idioma, num, t } from '../../i18n/index.svelte.js';
import { escenariosPropios, estadoExp } from '../experimentar/estado.svelte.js';
import { CAMPOS_PARTIDO, ID_F1, ID_SIN_COSTOS, tipoDeReglas } from './asistente.js';
import EditorFormato from './EditorFormato.svelte';
import EditorPartido from './EditorPartido.svelte';
import { textoError, textoFormato, textoRegla } from './textos.js';
import { abrirReglasEnExperimentar, cambiarFormato, cambiarReglas, est } from './torneos.svelte.js';
import { nombreBase, parametroVisible, resumenReglas } from './vistas.js';

/**
 * @type {{ S: import('../../../engine/league.js').Season, editable: boolean, motivo: string }}
 *   motivo: por qué no se puede editar (clave de competir.json; '' si se puede)
 */
let { S, editable, motivo } = $props();

const tr = { t, num: (/** @type {number} */ n) => num(n) };
const idi = $derived(idioma() === 'en' ? 'en' : 'es');
const r = $derived(resumenReglas(S.rules));
const tipo = $derived(tipoDeReglas(S.rules));
const filasCambios = $derived(
  r.cambios.map(([clave, v]) => ({ clave, ...parametroVisible(clave, Number(v), idi) })),
);

/** @type {any[]} */
let propios = $state.raw([]);
onMount(() => {
  escenariosPropios()
    .listar()
    .then((x) => {
      propios = x.escenarios;
    })
    .catch(() => {});
});
const opciones = $derived([
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
const idElegido = $derived(
  tipo === 'escenario'
    ? (opciones.find((o) => o.escenario.id === r.id && o.origen !== 'borrador')?.id ?? '')
    : '',
);

const nombreMundo = $derived(
  r.origen === 'clasica'
    ? t('competir.reglas.fotoClasica')
    : r.id === ID_F1 && !r.cambios.length
      ? t('competir.reglas.f1')
      : r.id === ID_SIN_COSTOS
        ? t('competir.reglas.sincostos')
        : textoEn(r.nombre, idi),
);

/** @param {string} k */
function valorFmt(k) {
  const v = S.fmt[k];
  if (k === 'capMode')
    return t(v === 'nrg' ? 'competir.campo.capMode.nrg' : 'competir.campo.capMode.pop');
  if ((k === 'cap' || k === 'popCap') && !v) return t('competir.reglas.sinTope');
  return num(Number(v) || 0);
}
</script>

<div class="reglas">
  <section class="card bloque">
    <h2 class="h2">{t('competir.reglas.mundoDe', { nombre: nombreMundo })}</h2>
    {#if r.error}
      <p class="error">{textoError({ clave: r.error, params: r.errorParams }, tr)}</p>
    {/if}
    <p class="ayuda">
      {t('competir.reglas.base', { base: nombreBase(r.base, idi) })}
      {r.cambios.length
  ? t('competir.reglas.cambios', { n: num(r.cambios.length) })
  : t('competir.reglas.sinCambios')}
      {#if r.obstaculos || r.teleporters}
        {t('competir.reglas.objetos', { obstaculos: num(r.obstaculos), teleporters: num(r.teleporters) })}
      {/if}
    </p>
    {#if r.cambios.length}
      <details>
        <summary>{t('competir.reglas.verCambios')}</summary>
        <table class="tbl">
          <tbody>
            {#each filasCambios as p (p.clave)}
              <tr>
                <td class="l">{p.nombre}</td>
                <td class="mono">
                  {p.bool ? t(p.valor === 'si' ? 'competir.si' : 'competir.no') : p.valor}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </details>
    {/if}
    <div>
      <button
        class="btn chico"
        type="button"
        title={t('competir.reglas.experimentar.ayuda')}
        disabled={!!r.error || !!est.ocupado}
        onclick={() => abrirReglasEnExperimentar(S)}
      >
        {t('competir.reglas.experimentar')}
      </button>
    </div>
  </section>

  <section class="card bloque">
    <h2 class="h2">{t('competir.reglas.valores')}</h2>
    <p class="ayuda">{textoFormato(S.fmt, tr, S.entrants.length)}</p>
    <table class="tbl">
      <tbody>
        {#each CAMPOS_PARTIDO as k (k)}
          <tr>
            <td class="l">{t(`competir.campo.${k}`)}</td>
            <td class="mono">{valorFmt(k)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="ayuda">{textoRegla(S.fmt.rounds, S.fmt.wins, tr)}</p>
  </section>
</div>

{#if editable}
  <section class="editar">
    <h2 class="h2">{t('competir.reglas.editar')}</h2>
    <p class="ayuda">{t('competir.reglas.editar.ayuda')}</p>
    <EditorFormato fmt={S.fmt} n={S.entrants.length} onCambio={cambiarFormato} />
    <EditorPartido
      fmt={S.fmt}
      {tipo}
      escenarioId={idElegido}
      escenarios={opciones}
      onFmt={cambiarFormato}
      onReglas={(sel) =>
  cambiarReglas(
    sel.tipo === 'escenario' ? { tipo: 'escenario', escenario: sel.escenario } : { tipo: sel.tipo },
  )}
    />
  </section>
{:else if motivo}
  <p class="lock">🔒 {t(motivo)}</p>
{/if}

<style>
.reglas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.bloque {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.error {
  font-size: 13px;
  color: var(--error-texto, #8a2b12);
  margin: 0;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--chip);
  text-align: right;
}
.tbl td.l {
  text-align: left;
}
summary {
  cursor: pointer;
  font-size: 13px;
  color: var(--acento);
}
.editar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}
.lock {
  font-size: 13px;
  color: var(--gris);
  margin: 4px 0;
}
@media (max-width: 1100px) {
  .reglas {
    grid-template-columns: 1fr;
  }
}
</style>
