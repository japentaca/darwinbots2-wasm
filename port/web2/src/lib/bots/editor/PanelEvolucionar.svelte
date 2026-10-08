<script>
// @ts-check
// «Evolucionar» (PLAN-EDITOR E4.4): de la base (el ADN del editor) saca hasta k
// variantes con las mutaciones del motor (worker 'variantes', linter.js) y las
// prueba con las mismas semillas, en la cola de trabajos (TIPO_EVOLUCION,
// src/lib/trabajos/evolucion.js). La tabla muestra el último trabajo de este
// bot. «Adoptar» injerta los genes cambiados de una variante en el texto del
// editor (sin guardar versión); «Otra ronda desde esta» genera de nuevo con esa
// variante como base, sin adoptarla. Solo se monta para bots propios.
import { injertar } from '../../../../engine/variantes.js';
import { t } from '../../../i18n/index.svelte.js';
import { adnBestiario } from '../../observar/bestiario.js';
import {
  crearParamsEvolucion,
  LIMITES_EVOLUCION,
  POR_DEFECTO_EVOLUCION,
  TIPO_EVOLUCION,
  unidadesEvolucion,
} from '../../trabajos/evolucion.js';
import { ALGA, LIMITES, POR_DEFECTO } from '../../trabajos/prueba.js';
import { textoError } from '../../trabajos/textos.js';
import { estadoTrabajos, iniciarTrabajos } from '../../trabajos/trabajos.svelte.js';
import DiffGenes from './DiffGenes.svelte';
import {
  adaptarDiff,
  claveError,
  comprobarRonda,
  INTENSIDADES,
  notaAdopcion,
  progresoTrabajo,
  semillaAleatoria,
  TIPOS_MUTACION,
  ultimoTrabajo,
} from './evolucion.js';

/**
 * @type {{clave: string, nombre: string, vegetal: boolean, texto: string,
 *   soloLectura: boolean,
 *   linter: ReturnType<typeof import('./linter.js').crearLinter>,
 *   onadoptar: (texto: string, nota: string) => void}}
 */
let { clave, nombre, vegetal, texto, soloLectura, linter, onadoptar } = $props();

let k = $state(POR_DEFECTO_EVOLUCION.k);
let factor = $state(POR_DEFECTO_EVOLUCION.factor);
let mutaciones = $state(POR_DEFECTO_EVOLUCION.mutaciones);
let copias = $state(POR_DEFECTO.copias);
let ciclos = $state(POR_DEFECTO.ciclos);
let error = $state('');
let lanzando = $state(false);
/** Ronda que sale de una variante («Otra ronda»): el id del trabajo y el número de la variante. */
/** @type {{id: string, n: number} | null} */
let desde = $state(null);
/** Variante cuyo diff se muestra (su `i`, base 0), o null. */
/** @type {number | null} */
let verDiff = $state(null);

/** El último trabajo de evolución de este bot (sigue en la cola aunque se cierre el editor). */
const ultima = $derived(ultimoTrabajo(estadoTrabajos.lista, clave));
const progreso = $derived(progresoTrabajo(ultima));
const resumen = $derived(ultima?.estado === 'terminado' ? ultima.resumen : null);
/** La semilla de la ronda: la primera de sus semillas de prueba. */
const semillaUltima = $derived(ultima?.params?.semillas?.[0] ?? null);
/** El número de la variante de la que sale esta ronda, si es «Otra ronda» (1..). */
const vaDesde = $derived(desde && ultima && ultima.id === desde.id ? desde.n : null);
/** El diff de la variante abierta, contra el texto actual del editor. */
const diffAbierto = $derived.by(() => {
  if (verDiff === null) return null;
  const v = resumen?.variantes.find((/** @type {{i: number}} */ x) => x.i === verDiff);
  return v ? { v, diff: adaptarDiff(texto, v.texto) } : null;
});

/**
 * El mensaje de un error: de parámetros (evolución o prueba), del control del
 * ADN (linter) o el texto crudo.
 * @param {any} e
 */
function textoDe(e) {
  const clave = claveError(e?.codigo);
  if (clave) return t(clave);
  if (e?.codigo === 'lint-no-disponible')
    return t('editor.lint.noDisponible', { detalle: String(e.message) });
  return String(e?.message ?? e);
}

/**
 * Una ronda sobre `adn`: pide las variantes al worker, las encola como trabajo
 * de evolución y recuerda de qué variante sale (si sale de una).
 * @param {string} adn
 * @param {number | null} [de] número (desde 1) de la variante de la ronda anterior
 */
async function ronda(adn, de = null) {
  error = '';
  verDiff = null;
  lanzando = true;
  try {
    const c = comprobarRonda({ k, factor, mutaciones });
    const semilla = semillaAleatoria();
    const r = await linter.variantes({
      adn,
      k: c.k,
      modo: c.mutaciones,
      factor: c.factor,
      semilla,
    });
    if (!r) return; // lo reemplazó otro pedido
    if (r.error) {
      error = t('editor.evolucion.errorAdn');
      return;
    }
    if (!r.textos.length) {
      error = t('editor.evolucion.sinVariantes');
      return;
    }
    const adnAlga = await adnBestiario(ALGA);
    const p = crearParamsEvolucion({
      clave,
      nombre,
      vegetal,
      adn,
      textos: r.textos,
      k: c.k,
      mutaciones: c.mutaciones,
      factor: c.factor,
      modo: POR_DEFECTO.modo,
      base: POR_DEFECTO.base,
      copias,
      ciclos,
      semillas: POR_DEFECTO.semillas,
      semilla,
      adnAlga,
    });
    const id = await iniciarTrabajos().encolar({
      tipo: TIPO_EVOLUCION,
      params: p,
      unidades: unidadesEvolucion(p).length,
      titulo: t('editor.evolucion.tituloTrabajo', { nombre, n: r.textos.length }),
    });
    desde = de === null ? null : { id, n: de };
  } catch (e) {
    error = textoDe(e);
  } finally {
    lanzando = false;
  }
}

/** @param {{i: number, texto: string}} v */
function adoptar(v) {
  const nota = notaAdopcion(t, {
    i: v.i,
    semilla: semillaUltima ?? 0,
    factor: ultima?.params?.factor ?? 1,
  });
  onadoptar(injertar(texto, v.texto), nota);
}

/** @param {{i: number, texto: string}} v */
function otraRonda(v) {
  ronda(injertar(texto, v.texto), v.i + 1);
}

/** @param {number} i */
function alternarDiff(i) {
  verDiff = verDiff === i ? null : i;
}

/** Aviso para lectores de pantalla: cambia solo con el estado. */
const anuncio = $derived.by(() => {
  if (!ultima) return '';
  if (ultima.estado === 'pendiente' || ultima.estado === 'corriendo')
    return t('editor.evolucion.anuncio.corriendo');
  if (ultima.estado === 'terminado') return t('editor.evolucion.anuncio.terminada');
  if (ultima.estado === 'cancelado') return t('editor.evolucion.cancelada');
  return textoError(t, ultima.codigo, ultima.error);
});

/** @param {number | undefined | null} v @param {number} [dec] */
const num = (v, dec = 1) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString(undefined, { maximumFractionDigits: dec })
    : '—';

/** «sobreviven de las copias» de una versión. @param {any} r */
const sobreviven = (r) => (r ? `${num(r.sobreviven)}/${r.copias}` : '—');
</script>

<section class="card panel" aria-label={t('editor.evolucion.titulo')}>
  <span class="lbl">{t('editor.evolucion.titulo')}</span>
  <p class="help ayuda">{t('editor.evolucion.ayuda')}</p>
  <div class="grilla">
    <label>
      {t('editor.evolucion.variantes')}
      <input
        class="sel mono"
        type="number"
        min={LIMITES_EVOLUCION.k[0]}
        max={LIMITES_EVOLUCION.k[1]}
        bind:value={k}
      >
    </label>
    <label>
      {t('editor.evolucion.intensidad')}
      <select class="sel" bind:value={factor}>
        {#each INTENSIDADES as f (f)}
          <option value={f}>{t('editor.evolucion.factor', { f })}</option>
        {/each}
      </select>
    </label>
    <label class="ancho">
      {t('editor.evolucion.tipo')}
      <select class="sel" bind:value={mutaciones}>
        {#each TIPOS_MUTACION as tm (tm.valor)}
          <option value={tm.valor}>{t(`editor.evolucion.tipo.${tm.clave}`)}</option>
        {/each}
      </select>
    </label>
    <label>
      {t('editor.probar.copias')}
      <input
        class="sel mono"
        type="number"
        min={LIMITES.copias[0]}
        max={LIMITES.copias[1]}
        bind:value={copias}
      >
    </label>
    <label>
      {t('editor.probar.ciclos')}
      <input
        class="sel mono"
        type="number"
        min={LIMITES.ciclos[0]}
        max={LIMITES.ciclos[1]}
        step="100"
        bind:value={ciclos}
      >
    </label>
  </div>
  <button
    type="button"
    class="btn pri"
    disabled={lanzando || soloLectura || !texto.trim()}
    onclick={() => ronda(texto)}
  >
    {lanzando ? t('editor.evolucion.generando') : t('editor.evolucion.generar')}
  </button>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <p class="oculto" aria-live="polite">{anuncio}</p>
  {#if ultima}
    <div class="resultado">
      <span class="help">
        {t('editor.evolucion.ultima', {
          semilla: semillaUltima ?? '—',
          factor: t('editor.evolucion.factor', { f: ultima.params?.factor ?? 1 }),
        })}
      </span>
      {#if vaDesde !== null}
        <span class="help">{t('editor.evolucion.desdeVariante', { n: vaDesde })}</span>
      {/if}
      {#if ultima.estado === 'pendiente' || ultima.estado === 'corriendo'}
        <div
          class="barra"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progreso * 100)}
        >
          <div style="width: {Math.round(progreso * 100)}%"></div>
        </div>
        <div class="fila">
          <span class="help"
            >{t('editor.evolucion.corriendo', { p: Math.round(progreso * 100) })}</span
          >
          <button
            type="button"
            class="btn sm"
            onclick={() => iniciarTrabajos().cancelar(ultima.id)}
          >
            {t('editor.evolucion.cancelar')}
          </button>
        </div>
      {:else if resumen}
        <table class="tabla">
          <thead>
            <tr>
              <th scope="col">{t('editor.evolucion.num')}</th>
              <th scope="col">{t('editor.evolucion.genesCambiados')}</th>
              <th scope="col">{t('editor.probar.sobreviven')}</th>
              <th scope="col">{t('editor.probar.hijos')}</th>
              <th scope="col">{t('editor.probar.energia')}</th>
            </tr>
          </thead>
          <tbody>
            {#if resumen.base}
              <tr class="base">
                <th scope="row">{t('editor.evolucion.base')}</th>
                <td>—</td>
                <td class="mono">{sobreviven(resumen.base)}</td>
                <td class="mono">{num(resumen.base.hijosPorCopia, 2)}</td>
                <td class="mono">{num(resumen.base.energiaMedia, 0)}</td>
              </tr>
            {/if}
            {#each resumen.variantes as v (v.i)}
              <tr>
                <th scope="row">{t('editor.evolucion.variante', { n: v.i + 1 })}</th>
                <td class="mono">{v.genesCambiados}</td>
                <td class="mono">{sobreviven(v.resumen)}</td>
                <td class="mono">{num(v.resumen?.hijosPorCopia, 2)}</td>
                <td class="mono">{num(v.resumen?.energiaMedia, 0)}</td>
              </tr>
              <tr class="acciones">
                <td colspan="5">
                  <button
                    type="button"
                    class="btn sm"
                    aria-pressed={verDiff === v.i}
                    onclick={() => alternarDiff(v.i)}
                  >
                    {t('editor.evolucion.verDiff')}
                  </button>
                  <button type="button" class="btn sm" onclick={() => adoptar(v)}>
                    {t('editor.evolucion.adoptar')}
                  </button>
                  <button type="button" class="btn sm" onclick={() => otraRonda(v)}>
                    {t('editor.evolucion.otraRonda')}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="error">
          {ultima.estado === 'cancelado'
            ? t('editor.evolucion.cancelada')
            : textoError(t, ultima.codigo, ultima.error)}
        </p>
      {/if}
    </div>
  {/if}

  {#if diffAbierto}
    <div class="caja-diff">
      <DiffGenes
        diff={diffAbierto.diff}
        a={-1}
        b={diffAbierto.v.i}
        etiquetaA={t('editor.evolucion.base')}
        etiquetaB={t('editor.evolucion.variante', { n: diffAbierto.v.i + 1 })}
        nombreDe={(archivo) => archivo}
        oncerrar={() => (verDiff = null)}
      />
    </div>
  {/if}
</section>

<style>
.panel {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ayuda {
  margin: 0;
}
.grilla {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.grilla label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--gris);
}
.ancho {
  grid-column: 1 / -1;
}
.resultado {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--borde);
  padding-top: 8px;
}
.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tabla th,
.tabla td {
  padding: 3px 4px;
  text-align: right;
  font-weight: 400;
}
.tabla th[scope="row"] {
  text-align: left;
}
.tabla thead th {
  font-size: 11px;
  color: var(--gris-claro);
}
.tabla .base th,
.tabla .base td {
  font-weight: 600;
  background: var(--chip);
}
.tabla .acciones td {
  text-align: left;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--borde);
}
.caja-diff {
  height: 300px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--borde);
  border-radius: 6px;
  overflow: hidden;
}
.barra {
  height: 6px;
  background: var(--chip);
  border-radius: 3px;
  overflow: hidden;
}
.barra div {
  height: 100%;
  background: var(--acento);
}
.fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.error {
  margin: 0;
  color: var(--error-texto);
  font-size: 13px;
}
</style>
