<script>
// @ts-check
// Experimentar en modo básico (paso N1.5; decisiones 12-15 de PLAN.md):
// escenarios de fábrica y propios, un borrador editable con los controles
// básicos del catálogo, las especies y el resumen de los objetos. «Aplicar a
// la actual» manda solo lo vivo del diff en un ciclo exacto
// (sesion.aplicarEnCiclo) y lo registra en ese ciclo (decisión 13: las
// réplicas lo repiten ahí); lo que requiere sim nueva se aplica con «Nueva
// simulación». Modo avanzado (paso N3.7, decisión 14): todos los parámetros
// del catálogo sobre el mismo borrador (src/lib/experimentar/Avanzado.svelte);
// el modo elegido se recuerda en localStorage.
import { untrack } from 'svelte';
import {
  ESCENARIOS_FABRICA,
  escenarioFabrica,
  esDeFabrica,
} from '../../engine/escenarios/fabrica.js';
import { diff, normalizar, textoEn, validar } from '../../engine/escenarios/index.js';
import { BASES } from '../../engine/opciones.js';
import { idioma, num, t } from '../i18n/index.svelte.js';
import Avanzado from '../lib/experimentar/Avanzado.svelte';
import {
  comoPropio,
  duplicar,
  exportarEscenario,
  importarEscenario,
  mensajeError,
  textoValidacion,
} from '../lib/experimentar/archivo.js';
import { guardarModo, leerModo } from '../lib/experimentar/avanzado.js';
import {
  agregarEspecie,
  borradorDe,
  cambiarEspecie,
  cambiosVivos,
  clavePlural,
  controlBasico,
  controlCambiado,
  controlVivo,
  escribirControl,
  especieCambiada,
  GRUPOS_BASICOS,
  leerControl,
  normalizarEntrada,
  opcionInerte,
  parsearSemilla,
  pendientes,
  quitarEspecie,
  quitarObjetos,
  resumenObjetos,
  semillaAleatoria,
  tienePendientes,
} from '../lib/experimentar/borrador.js';
import DialogoEscenario from '../lib/experimentar/DialogoEscenario.svelte';
import DialogoEspecie from '../lib/experimentar/DialogoEspecie.svelte';
import { escenariosPropios, estadoExp } from '../lib/experimentar/estado.svelte.js';
import Dialogo from '../lib/observar/Dialogo.svelte';
import { descargar, nombreArchivo } from '../lib/observar/descargas.js';
import { estadoAlmacen } from '../lib/sim/almacen.svelte.js';
import { cicloVisible } from '../lib/sim/ciclo.js';
import { actual, corrida as obtenerCorrida } from '../lib/sim/corrida.svelte.js';
import { hashDe } from '../router.js';

/**
 * @typedef {import('../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../engine/opciones.js').ControlBasico} ControlBasico
 */

/** @type {{ partes?: string[] }} */
let { partes = [] } = $props();

const idi = $derived(/** @type {'es' | 'en'} */ (idioma() === 'en' ? 'en' : 'es'));
/** @param {string} k @param {Record<string, string | number>} [p] */
const tr = (k, p) => t(k, p);
/**
 * Texto con plural (`<clave>.uno` / `<clave>.otros`, PLURALES de borrador.js).
 * @param {string} k @param {number} n @param {Record<string, string | number>} [p]
 */
const tn = (k, n, p) => t(clavePlural(k, n, idi), { ...p, n: num(n) });

// ---- Básico / avanzado -------------------------------------------------------

/** localStorage si existe y se puede leer (modo privado: null). */
function almacenLocal() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @type {import('../lib/experimentar/avanzado.js').Modo} */
let modo = $state(leerModo(almacenLocal()));

/** @param {import('../lib/experimentar/avanzado.js').Modo} m */
function ponerModo(m) {
  modo = m;
  guardarModo(almacenLocal(), m);
}

/** Números sin redondear de más (densidades de 1e-7, costos de 0,00001). @param {number} n */
const fmt = (n) => num(n, { maximumSignificantDigits: 12 });

// ---- Escenarios propios ------------------------------------------------------

/** @type {Escenario[]} */
let mios = $state.raw([]);
let invalidos = $state(0);

/** @type {{ clave: string, params?: Record<string, any>, error?: boolean } | null} */
let aviso = $state.raw(null);
/** @type {string[]} detalle del aviso (errores de validación) */
let detalleAviso = $state.raw([]);

/** @param {string} clave @param {Record<string, any>} [params] @param {string[]} [detalle] */
function avisar(clave, params, detalle = []) {
  aviso = { clave, params };
  detalleAviso = detalle;
}

/** @param {unknown} e @param {string[]} [detalle] */
function avisarError(e, detalle = []) {
  const m = mensajeError(e);
  aviso = { ...m, error: true };
  detalleAviso = detalle;
}

async function recargarMios() {
  try {
    const r = await escenariosPropios().listar(idi);
    mios = r.escenarios;
    invalidos = r.invalidos;
  } catch (e) {
    avisarError(e);
  }
}

$effect(() => {
  untrack(recargarMios);
});

// ---- Corrida actual ----------------------------------------------------------

/** El escenario efectivo de la corrida actual (null: sin corrida o sin escenario). */
const escActual = $derived.by(() => {
  const c = actual.corrida;
  if (!c) return null;
  // Dependencias: el escenario y los cambios en caliente de la corrida.
  const _deps = [c.estado.escenario, c.estado.eventos];
  const e = c.escenarioEfectivo();
  return e ? borradorDe(e) : null;
});
const ocupadoCorrida = $derived(actual.corrida?.estado.ocupado ?? '');
const ciclo = $derived(cicloVisible(actual.corrida?.sesion.stats.cycle));

// ---- Borrador ----------------------------------------------------------------

/**
 * El borrador pasa a ser una copia de `e`, que queda como su foto (lo
 * «aplicado»: sin diferencias con ella, el borrador no cuenta como
 * editado). La corrida de la página en este momento queda como vista.
 * @param {Escenario} e
 */
function elegir(e) {
  const b0 = borradorDe(e);
  estadoExp.borrador = b0;
  estadoExp.foto = b0;
  estadoExp.baseId = e.id;
  estadoExp.escCorrida = untrack(() => actual.corrida?.estado.escenario ?? null);
  aviso = null;
}

/** Semilla de la corrida de la página (null sin corrida o sin semilla). */
const semillaCorrida = () => untrack(() => actual.corrida?.estado.semilla ?? null);

/** Borrador desde la corrida actual (su escenario efectivo) o el primero de fábrica. */
function inicial() {
  const e = untrack(() => escActual);
  elegir(e ?? /** @type {Escenario} */ (ESCENARIOS_FABRICA[0]));
}

if (!estadoExp.borrador) inicial();
if (!parsearSemilla(estadoExp.semilla))
  estadoExp.semilla = String(semillaCorrida() ?? semillaAleatoria());

/**
 * Empezó otra corrida desde que se armó el borrador: si el borrador no
 * tiene diferencias sin aplicar respecto de su foto, pasa a ser el
 * escenario efectivo de la nueva (y la semilla, la suya); si las tiene, se
 * conservan (la barra de pendientes muestra la diferencia con la nueva).
 */
function seguirCorrida() {
  const c = actual.corrida;
  const esc = c?.estado.escenario ?? null;
  if (!c || !esc || esc === estadoExp.escCorrida) return;
  estadoExp.escCorrida = esc;
  const ef = c.escenarioEfectivo();
  const b0 = estadoExp.borrador;
  if (!ef || (b0 && tienePendientes(b0, estadoExp.foto))) return;
  elegir(ef);
  const s = semillaCorrida();
  if (s !== null) estadoExp.semilla = String(s);
}

$effect(() => {
  const _e = actual.corrida?.estado.escenario;
  untrack(seguirCorrida);
});

/**
 * #/experimentar/<id> (Inicio, «Ajustar»): ese escenario, de fábrica o
 * propio, como base del borrador (una vez por ruta: volver no pisa lo
 * editado). Sin id: el borrador sigue.
 * @param {string} id
 */
async function abrirRuta(id) {
  if (!id) {
    estadoExp.rutaId = '';
    return;
  }
  if (id === estadoExp.rutaId) return;
  estadoExp.rutaId = id;
  const f = escenarioFabrica(id);
  if (f) {
    elegir(f);
    return;
  }
  try {
    const p = await escenariosPropios().obtener(id);
    if (p) elegir(p);
    else aviso = { clave: 'experimentar.aviso.noEncontrado', params: { id }, error: true };
  } catch (e) {
    avisarError(e);
  }
}

$effect(() => {
  const id = partes[0] ?? '';
  untrack(() => abrirRuta(id));
});

const b = $derived(/** @type {Escenario} */ (estadoExp.borrador));
const baseEsc = $derived(
  ESCENARIOS_FABRICA.find((e) => e.id === estadoExp.baseId) ??
    mios.find((e) => e.id === estadoExp.baseId) ??
    null,
);
const tipoBase = $derived(
  esDeFabrica(estadoExp.baseId)
    ? 'fabrica'
    : mios.some((e) => e.id === estadoExp.baseId)
      ? 'propio'
      : 'borrador',
);
/** Contra qué se marca «cambiado»: la sim actual o, sin ella, el escenario elegido. */
const ref = $derived(escActual ?? baseEsc);
const pend = $derived(escActual ? pendientes(b, escActual, idi, tr) : null);
const errores = $derived(validar(b));
const objetos = $derived(resumenObjetos(b));
const semillaOk = $derived(parsearSemilla(estadoExp.semilla) !== null);

/** @param {ControlBasico} c @param {any} v */
function poner(c, v) {
  estadoExp.borrador = escribirControl(b, c, v);
}

/** @param {ControlBasico} c @param {string} valor */
function ponerOpcion(c, valor) {
  const o = c.opciones?.find((x) => String(x.v) === valor);
  if (o) poner(c, o.v);
}

/** @param {ControlBasico} c @param {HTMLInputElement} el @param {number} actualV */
function ponerNumero(c, el, actualV) {
  const n = normalizarEntrada(c, el.value);
  if (n === null) {
    el.value = String(actualV);
    return;
  }
  el.value = String(n);
  poner(c, n);
}

/** @param {number} i @param {{ cantidad?: unknown, color?: string }} cambio */
function ponerEspecie(i, cambio) {
  estadoExp.borrador = cambiarEspecie(b, i, cambio);
}

/** @param {number} i @param {HTMLInputElement} el */
function ponerCantidad(i, el) {
  ponerEspecie(i, { cantidad: el.value });
  el.value = String(estadoExp.borrador?.especies[i]?.cantidad ?? '');
}

/** Las tarjetas de controles básicos con el valor de cada control en el borrador. */
const tarjetas = $derived(
  GRUPOS_BASICOS.map((g) => ({
    id: g.id,
    controles: g.controles.flatMap((id) => {
      const c = controlBasico(id);
      return c
        ? [{ c, v: leerControl(c, b), vivo: controlVivo(c), chg: controlCambiado(c, b, ref) }]
        : [];
    }),
  })),
);

/** Especies con cambios sin aplicar (por bot y hash, contra la referencia). */
const cambiadas = $derived(b.especies.map((s) => especieCambiada(s, ref)));

/** @param {string} forma */
const nombreLaberinto = (forma) => t(`experimentar.laberinto.${forma}`);

// ---- Aplicar y nueva simulación ----------------------------------------------

let aplicando = $state(false);

async function aplicarActual() {
  const c = actual.corrida;
  if (!c || !escActual || !pend || aplicando) return;
  const esc = c.estado.escenario;
  const d = diff(b, escActual);
  if (!d.mensajes.length) return;
  const n = cambiosVivos(pend);
  const parcial = d.requiereNueva;
  aplicando = true;
  try {
    if (!c.sesion.aplicarEnCiclo) return;
    const cicloExacto = await c.sesion.aplicarEnCiclo(d.mensajes);
    // Otra sim empezó mientras se esperaba el ciclo: el cambio no es de ella.
    if (actual.corrida !== c || c.estado.escenario !== esc) return;
    c.registrarCambio(d, cicloExacto);
    const ef = c.escenarioEfectivo();
    if (ef) estadoExp.foto = borradorDe(ef);
    avisar(
      clavePlural(
        parcial ? 'experimentar.aviso.aplicadoParcial' : 'experimentar.aviso.aplicado',
        n,
        idi,
      ),
      { n: num(n), ciclo: num(cicloVisible(cicloExacto)) },
    );
  } catch (e) {
    avisarError(e);
  } finally {
    aplicando = false;
  }
}

function descartar() {
  if (!escActual) return;
  elegir(escActual);
}

let iniciando = $state(false);

async function nuevaSim() {
  const semilla = parsearSemilla(estadoExp.semilla);
  if (semilla === null) {
    avisar('experimentar.error.semilla');
    return;
  }
  /** @type {Escenario} */
  let esc;
  try {
    esc = normalizar(b);
  } catch (e) {
    avisarError(
      e,
      errores.map((x) => textoValidacion(x, tr)),
    );
    return;
  }
  iniciando = true;
  try {
    const c = obtenerCorrida();
    if (!(await c.iniciar(esc, semilla))) return;
    // El borrador es lo que se inició: su foto pasa a ser el efectivo de la nueva.
    estadoExp.escCorrida = c.estado.escenario;
    const ef = c.escenarioEfectivo();
    if (ef) estadoExp.foto = borradorDe(ef);
    c.sesion.correr(true);
    window.location.hash = hashDe('observar');
  } catch (e) {
    avisarError(e);
  } finally {
    iniciando = false;
  }
}

// ---- Guardar, duplicar, borrar, exportar, importar ---------------------------

let verGuardar = $state(false);
let verEspecie = $state(false);
let verBorrar = $state(false);
/** @type {string[]} */
let erroresGuardar = $state.raw([]);

const idsMios = $derived(mios.map((e) => e.id));

function abrirGuardar() {
  erroresGuardar = [];
  verGuardar = true;
}

/**
 * Guardado como escenario propio: pasa a ser la base del borrador, pero la
 * foto (lo aplicado a la corrida) no cambia.
 * @param {Escenario} g
 */
function tomarGuardado(g) {
  const foto = estadoExp.foto;
  const esc = estadoExp.escCorrida;
  elegir(g);
  estadoExp.foto = foto;
  estadoExp.escCorrida = esc;
}

/** @param {{ nombre: string, descripcion: string, etiquetas: string[], reemplazar: boolean }} m */
async function guardar(m) {
  const r = comoPropio(
    b,
    {
      nombre: m.nombre,
      descripcion: m.descripcion,
      etiquetas: m.etiquetas,
      id: m.reemplazar ? estadoExp.baseId : undefined,
    },
    idsMios,
  );
  if (!r.ok) {
    erroresGuardar = r.errores.map((x) => textoValidacion(x, tr));
    return;
  }
  try {
    const g = await escenariosPropios().guardar(r.escenario);
    await recargarMios();
    tomarGuardado(g);
    verGuardar = false;
    avisar('experimentar.aviso.guardado', { nombre: m.nombre });
  } catch (e) {
    const x = mensajeError(e);
    erroresGuardar = [t(x.clave, x.params)];
  }
}

async function duplicarFabrica() {
  if (!baseEsc || tipoBase !== 'fabrica') return;
  try {
    const d = duplicar(baseEsc, idi, t('experimentar.copia'), idsMios);
    const g = await escenariosPropios().guardar(d);
    await recargarMios();
    elegir(g);
    avisar('experimentar.aviso.duplicado', { nombre: textoEn(g.nombre, idi) });
  } catch (e) {
    avisarError(e);
  }
}

async function borrar() {
  verBorrar = false;
  if (tipoBase !== 'propio' || !baseEsc) return;
  const nombre = textoEn(baseEsc.nombre, idi);
  try {
    await escenariosPropios().borrar(estadoExp.baseId);
    estadoExp.baseId = '';
    await recargarMios();
    avisar('experimentar.aviso.borrado', { nombre });
  } catch (e) {
    avisarError(e);
  }
}

function exportar() {
  const blob = new Blob([exportarEscenario(b)], { type: 'application/json' });
  descargar(blob, nombreArchivo(textoEn(b.nombre, idi), '.json'));
}

/** @type {HTMLInputElement} */
let archivo;

async function importar() {
  const f = archivo.files?.[0];
  archivo.value = '';
  if (!f) return;
  try {
    const r = importarEscenario(await f.text(), idsMios);
    if (!r.ok) {
      aviso = {
        clave: 'experimentar.aviso.importarError',
        params: { archivo: f.name },
        error: true,
      };
      detalleAviso = r.errores.slice(0, 8).map((x) => textoValidacion(x, tr));
      return;
    }
    const g = await escenariosPropios().guardar(r.escenario);
    await recargarMios();
    elegir(g);
    avisar(
      r.renombrado ? 'experimentar.aviso.importadoRenombrado' : 'experimentar.aviso.importado',
      {
        nombre: textoEn(g.nombre, idi),
        id: g.id,
      },
    );
  } catch (e) {
    avisarError(e);
  }
}

const nombreBorrador = $derived(textoEn(b.nombre, idi));
const descBorrador = $derived(b.descripcion ? textoEn(b.descripcion, idi) : '');
</script>

<div class="exp">
  <aside class="lateral" aria-label={t('experimentar.escenarios.aria')}>
    <span class="lbl">{t('experimentar.fabrica')}</span>
    <div class="lista">
      {#each ESCENARIOS_FABRICA as e (e.id)}
        <button
          type="button"
          class:on={e.id === estadoExp.baseId}
          aria-current={e.id === estadoExp.baseId ? 'true' : undefined}
          onclick={() => elegir(e)}
        >
          <span>{textoEn(e.nombre, idi)}</span>
          <span class="k">{e.opciones.base === 'f1' ? 'F1' : ''}</span>
        </button>
      {/each}
    </div>
    <span class="lbl sep">{t('experimentar.mios')}</span>
    <div class="lista">
      {#each mios as e (e.id)}
        <button
          type="button"
          class:on={e.id === estadoExp.baseId}
          aria-current={e.id === estadoExp.baseId ? 'true' : undefined}
          onclick={() => elegir(e)}
        >
          <span>{textoEn(e.nombre, idi)}</span>
          <span class="k">{e.opciones.base === 'f1' ? 'F1' : ''}</span>
        </button>
      {:else}
        <p class="help pad">{t('experimentar.mios.vacio')}</p>
      {/each}
      {#if invalidos}
        <p class="help pad">{tn('experimentar.mios.invalidos', invalidos)}</p>
      {/if}
    </div>
    <div class="acciones">
      <button class="btn sm" type="button" onclick={abrirGuardar}>
        {t('experimentar.guardarComo')}
      </button>
      {#if tipoBase === 'fabrica'}
        <button class="btn sm" type="button" onclick={duplicarFabrica}>
          {t('experimentar.duplicar')}
        </button>
      {:else if tipoBase === 'propio'}
        <button class="btn sm" type="button" onclick={() => (verBorrar = true)}>
          {t('experimentar.borrar')}
        </button>
      {/if}
      <div class="par">
        <button class="btn sm" type="button" onclick={() => archivo.click()}>
          {t('experimentar.importar')}
        </button>
        <button class="btn sm" type="button" onclick={exportar}>
          {t('experimentar.exportar')}
        </button>
      </div>
      <input
        bind:this={archivo}
        type="file"
        accept=".json,application/json"
        hidden
        onchange={importar}
      >
    </div>
    <p class="help pad">{t('experimentar.escenarios.ayuda')}</p>
  </aside>

  <section class="centro">
    <header class="cab">
      <div class="titulo">
        <h1>{nombreBorrador}</h1>
        <p class="help">
          {t(`experimentar.origen.${tipoBase}`)}
          ·
          {t('experimentar.base', { base: BASES[b.opciones.base]?.[idi] ?? b.opciones.base })}
          ·
          <span class="mono"
            >{tn('experimentar.cambiosBase', Object.keys(b.opciones.cambios).length)}</span
          >
        </p>
        {#if descBorrador}
          <p class="desc">{descBorrador}</p>
        {/if}
      </div>
      <fieldset class="seg modo" aria-label={t('experimentar.modo.aria')}>
        <button
          type="button"
          class:on={modo === 'basico'}
          aria-pressed={modo === 'basico'}
          onclick={() => ponerModo('basico')}
        >
          {t('experimentar.modo.basico')}
        </button>
        <button
          type="button"
          class:on={modo === 'avanzado'}
          aria-pressed={modo === 'avanzado'}
          onclick={() => ponerModo('avanzado')}
        >
          {t('experimentar.modo.avanzado')}
        </button>
      </fieldset>
    </header>

    <div class="leyenda">
      <span class="live">{t('experimentar.leyenda.vivo')}</span>
      <span class="new">{t('experimentar.leyenda.nueva')}</span>
      <span class="ley-chg"
        ><span class="sw chg-sw"></span>{t('experimentar.leyenda.cambiado')}</span
      >
    </div>

    {#if estadoAlmacen.versionVieja}
      <div class="aviso error" role="alert">{t('experimentar.error.almacen.version-vieja')}</div>
    {:else if estadoAlmacen.bloqueado}
      <div class="aviso error" role="alert">{t('experimentar.error.almacenBloqueado')}</div>
    {/if}
    {#if aviso}
      <div class="aviso" class:error={aviso.error} role={aviso.error ? 'alert' : 'status'}>
        <div class="aviso-txt">
          <span>{t(aviso.clave, aviso.params)}</span>
          {#if detalleAviso.length}
            <ul>
              {#each detalleAviso as d, i (i)}
                <li>{d}</li>
              {/each}
            </ul>
          {/if}
        </div>
        <button
          class="cerrar"
          type="button"
          aria-label={t('experimentar.cerrar')}
          onclick={() => (aviso = null)}
        >
          ×
        </button>
      </div>
    {/if}

    {#if modo === 'avanzado'}
      <Avanzado borrador={b} referencia={ref} onCambiar={(nb) => (estadoExp.borrador = nb)} />
    {:else}
      <div class="tarjetas">
        {#each tarjetas as g (g.id)}
          <section class="card grupo">
            <h2>{t(`experimentar.grupo.${g.id}`)}</h2>
            {#each g.controles as { c, v, vivo, chg } (c.id)}
              <div class="control" class:chg>
                <div class="lh">
                  {#if c.valor === 'bool'}
                    <span id={`exp-${c.id}-n`}>{c[idi]}</span>
                  {:else}
                    <label for={`exp-${c.id}`}>{c[idi]}</label>
                  {/if}
                  <span class={vivo ? 'live' : 'new'}
                    >{t(vivo ? 'experimentar.vivo' : 'experimentar.nueva')}</span
                  >
                  {#if chg}
                    <span class="sr-only">{t('experimentar.cambiado.sr')}</span>
                  {/if}
                </div>
                {#if c.valor === 'bool'}
                  <fieldset class="seg" aria-labelledby={`exp-${c.id}-n`}>
                    <button
                      type="button"
                      class:on={!v}
                      aria-pressed={!v}
                      onclick={() => poner(c, false)}
                    >
                      {t('experimentar.valor.no')}
                    </button>
                    <button
                      type="button"
                      class:on={!!v}
                      aria-pressed={!!v}
                      onclick={() => poner(c, true)}
                    >
                      {t('experimentar.valor.si')}
                    </button>
                  </fieldset>
                {:else if c.opciones}
                  <select
                    id={`exp-${c.id}`}
                    class="inp"
                    value={String(v)}
                    onchange={(e) => ponerOpcion(c, e.currentTarget.value)}
                  >
                    {#each c.opciones as o (o.v)}
                      {#if !opcionInerte(c, o.v) || o.v === v}
                        <option value={String(o.v)}>{o[idi]}</option>
                      {/if}
                    {/each}
                  </select>
                {:else}
                  <input
                    id={`exp-${c.id}`}
                    class="inp"
                    type="number"
                    value={v}
                    min={c.min}
                    max={c.max}
                    step={c.paso ?? 1}
                    onchange={(e) => ponerNumero(c, e.currentTarget, v)}
                  >
                {/if}
                <p class="help">{c.ayuda[idi]}</p>
              </div>
            {/each}
          </section>
        {/each}

        <section class="card grupo">
          <div class="lh">
            <h2>{t('experimentar.objetos')}</h2>
            <span class="new">{t('experimentar.nueva')}</span>
          </div>
          {#if objetos.vacio}
            <p class="help">{t('experimentar.objetos.ninguno')}</p>
          {:else}
            <div class="chips">
              {#if objetos.forma}
                <span class="chip">{tn('experimentar.objetos.forma', objetos.forma)}</span>
              {/if}
              {#if objetos.formas}
                <span class="chip">{tn('experimentar.objetos.formas', objetos.formas * 10)}</span>
              {/if}
              {#each objetos.laberintos as f, i (i)}
                <span class="chip"
                  >{t('experimentar.objetos.laberinto', { forma: nombreLaberinto(f) })}</span
                >
              {/each}
              {#if objetos.teleporters}
                <span class="chip"
                  >{tn('experimentar.objetos.teleporters', objetos.teleporters)}</span
                >
              {/if}
            </div>
          {/if}
          <div class="par">
            <!-- «Editar en el mundo» (decisión 15) llega con el Nivel 3. -->
            <button
              class="btn sm"
              type="button"
              disabled={objetos.vacio}
              onclick={() => (estadoExp.borrador = quitarObjetos(b))}
            >
              {t('experimentar.objetos.quitar')}
            </button>
          </div>
          <p class="help">{t('experimentar.objetos.ayuda')}</p>
        </section>
      </div>
    {/if}

    {#if pend?.total}
      <div class="pendientes" role="status">
        <div class="pend-txt">
          <strong>{tn('experimentar.pendientes.titulo', pend.total)}</strong>
          {#each pend.controles as c (c.id)}
            <span class="item"
              >{c.nombre}: {c.antes} →
              {c.despues}
              {#if !c.vivo}
                <span class="new">{t('experimentar.nueva')}</span>
              {/if}</span
            >
          {/each}
          {#each pend.otros as o (o.clave)}
            <span class="item"
              >{o.nombre} <span class="var">{o.variable}</span>: {fmt(o.antes)} →
              {fmt(o.despues)}</span
            >
          {/each}
          {#if pend.especies}
            <span class="item">{t('experimentar.pendientes.especies')}</span>
          {/if}
          {#if pend.objetos}
            <span class="item">{t('experimentar.pendientes.objetos')}</span>
          {/if}
          {#if pend.requiereNueva}
            <span class="nota">{t('experimentar.pendientes.requiereNueva')}</span>
          {/if}
        </div>
        <div class="pend-acc">
          <button class="btn sm" type="button" onclick={descartar}>
            {t('experimentar.descartar')}
          </button>
          {#if pend.requiereNueva}
            <button
              class="btn sm"
              type="button"
              disabled={iniciando || !!ocupadoCorrida || errores.length > 0 || !semillaOk}
              onclick={nuevaSim}
            >
              {t('experimentar.nuevaSim')}
            </button>
          {/if}
          <button
            class="btn sm pri"
            type="button"
            disabled={!pend.hayVivo || !!ocupadoCorrida || aplicando}
            onclick={aplicarActual}
          >
            {t('experimentar.aplicar', { ciclo: num(ciclo) })}
          </button>
        </div>
      </div>
    {:else if !escActual}
      <p class="help sin">
        {t(actual.corrida ? 'experimentar.sinEscenario' : 'experimentar.sinCorrida')}
      </p>
    {/if}
  </section>

  <aside class="derecha" aria-label={t('experimentar.especies')}>
    <div class="lh">
      <span class="lbl">{t('experimentar.especies')}</span>
      <span class="new">{t('experimentar.nueva')}</span>
    </div>
    {#each b.especies as s, i (i)}
      <div class="card esp" class:chg={cambiadas[i]}>
        <input
          class="color"
          type="color"
          value={s.color}
          aria-label={t('experimentar.especie.colorDe', { bot: s.bot })}
          onchange={(e) => ponerEspecie(i, { color: e.currentTarget.value })}
        >
        <span class="nom">
          <span class="bot">{s.bot}</span>
          <span class="sub"
            >{t(s.vegetal ? 'experimentar.especie.esVegetal' : 'experimentar.especie.esAnimal')}
            {#if s.origen === 'propio'}
              · {t('experimentar.especie.adnPropio')}
            {/if}
            {#if cambiadas[i]}
              <span class="sr-only">{t('experimentar.cambiado.sr')}</span>
            {/if}</span
          >
        </span>
        <label class="cant"
          >{t('experimentar.especie.cant')}
          <input
            class="inp"
            type="number"
            min="1"
            max="10000"
            value={s.cantidad}
            onchange={(e) => ponerCantidad(i, e.currentTarget)}
          ></label
        >
        <button
          class="quitar"
          type="button"
          aria-label={t('experimentar.especie.quitar', { bot: s.bot })}
          title={t('experimentar.especie.quitar', { bot: s.bot })}
          onclick={() => (estadoExp.borrador = quitarEspecie(b, i))}
        >
          ×
        </button>
      </div>
    {:else}
      <p class="help">{t('experimentar.especies.ninguna')}</p>
    {/each}
    <button class="btn sm" type="button" onclick={() => (verEspecie = true)}>
      {t('experimentar.especies.agregar')}
    </button>

    <div class="relleno"></div>

    <div class="semilla">
      <label for="exp-semilla">{t('experimentar.semilla')}</label>
      <div class="par">
        <input
          id="exp-semilla"
          class="inp mono"
          class:mal={!semillaOk}
          type="text"
          inputmode="numeric"
          bind:value={estadoExp.semilla}
        >
        <button
          class="btn sm"
          type="button"
          title={t('experimentar.semilla.otra')}
          aria-label={t('experimentar.semilla.otra')}
          onclick={() => (estadoExp.semilla = String(semillaAleatoria()))}
        >
          🎲
        </button>
      </div>
      <span class="help"
        >{semillaOk ? t('experimentar.semilla.ayuda') : t('experimentar.error.semilla')}</span
      >
    </div>
    {#if errores.length}
      <ul class="errores" role="alert">
        {#each errores.slice(0, 6) as x, i (i)}
          <li>{textoValidacion(x, tr)}</li>
        {/each}
      </ul>
    {/if}
    <button
      class="btn pri"
      type="button"
      disabled={iniciando || !!ocupadoCorrida || errores.length > 0 || !semillaOk}
      onclick={nuevaSim}
    >
      {iniciando ? t('experimentar.iniciando') : t('experimentar.nuevaSim')}
    </button>
    <span class="help">{t('experimentar.nuevaSim.ayuda')}</span>
  </aside>
</div>

<DialogoEspecie
  bind:abierto={verEspecie}
  usados={b.especies.map((s) => s.color)}
  onAgregar={(s) => (estadoExp.borrador = agregarEspecie(b, s))}
/>
<DialogoEscenario
  bind:abierto={verGuardar}
  nombreInicial={tipoBase === 'propio' ? nombreBorrador : `${nombreBorrador}${t('experimentar.copia')}`}
  descripcionInicial={descBorrador}
  etiquetasIniciales={b.etiquetas}
  reemplazable={tipoBase === 'propio' && baseEsc ? textoEn(baseEsc.nombre, idi) : ''}
  errores={erroresGuardar}
  onGuardar={guardar}
/>
<Dialogo bind:abierto={verBorrar} titulo={t('experimentar.borrar.titulo')}>
  <p class="confirmar">
    {t('experimentar.borrar.pregunta', { nombre: baseEsc ? textoEn(baseEsc.nombre, idi) : '' })}
  </p>
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (verBorrar = false)}>
      {t('experimentar.cancelar')}
    </button>
    <button class="btn pri" type="button" onclick={borrar}>{t('experimentar.borrar')}</button>
  {/snippet}
</Dialogo>

<style>
.exp {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 320px;
  min-height: 100%;
}
.lateral {
  padding: 20px 14px;
  border-right: 1px solid var(--borde);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lateral .lbl {
  padding: 0 12px 6px;
}
.lateral .sep {
  padding-top: 14px;
}
.lista {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.lista button {
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
.lista button:hover {
  background: var(--hover-claro);
}
.lista button.on {
  background: #e3ecea;
  font-weight: 600;
}
.k {
  font-size: 12px;
  color: var(--gris-claro);
  font-weight: 400;
}
.acciones {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 12px 0;
}
.par {
  display: flex;
  gap: 6px;
}
.par > * {
  flex-grow: 1;
}
.btn.sm {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
  justify-content: center;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--gris);
}
.pad {
  padding: 8px 12px 0;
}
.centro {
  padding: 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.cab {
  display: flex;
  align-items: center;
  gap: 14px;
}
.titulo {
  flex-grow: 1;
  min-width: 0;
}
.cab h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}
.cab .help {
  margin-top: 2px;
}
.desc {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--gris);
}
.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--chip-texto);
}
.ley-chg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chg-sw {
  background: #fff7e6;
  border: 1px solid #e8c77a;
}
.live,
.new {
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
.new {
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
.tarjetas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-content: start;
}
.grupo {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.grupo h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.control {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px 8px;
  margin: -6px -8px;
  border-radius: 8px;
  border: 1px solid transparent;
}
.control.chg,
.esp.chg {
  background: #fff7e6;
  border-color: #e8c77a;
}
.lh {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}
.inp {
  font: inherit;
  font-size: 14px;
  height: 34px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: #ffffff;
  padding: 0 10px;
  color: var(--texto);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}
.inp.mal {
  border-color: #c0392b;
}
fieldset.seg {
  margin: 0;
  padding: 0;
  min-width: 0;
}
.seg button {
  flex: 1;
  height: 32px;
}
.seg.modo {
  flex-shrink: 0;
}
.seg.modo button {
  padding: 0 14px;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #e3ecea;
  font-size: 14px;
}
.aviso.error {
  background: #fbe9e6;
  color: #7a2317;
}
.aviso-txt {
  flex-grow: 1;
}
.aviso ul,
.errores {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 12px;
}
.errores {
  color: #9b2c1f;
}
.cerrar {
  border: 0;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: inherit;
}
.pendientes {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 -28px -20px;
  padding: 12px 28px;
  background: #fff7e6;
  border-top: 1px solid #e8c77a;
}
.pend-txt {
  flex: 1 1 320px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 14px;
  align-items: baseline;
}
.pend-txt .item {
  display: inline-flex;
  gap: 6px;
  align-items: baseline;
}
.pend-txt .nota {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--gris);
}
.pend-acc {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.var {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--gris-claro);
}
.sin {
  padding: 4px 0;
}
.derecha {
  padding: 20px 18px;
  border-left: 1px solid var(--borde);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.esp {
  padding: 9px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.color {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--borde-control);
  border-radius: 4px;
  background: transparent;
  flex-shrink: 0;
  cursor: pointer;
}
.nom {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.bot {
  font-size: 14px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.sub {
  font-size: 12px;
  color: var(--gris-claro);
}
.cant {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--gris);
}
.cant .inp {
  width: 72px;
}
.quitar {
  border: 1px solid var(--borde-control);
  background: var(--tarjeta);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}
.relleno {
  flex-grow: 1;
  min-height: 12px;
}
.semilla {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 14px;
}
.semilla .par > .btn {
  flex-grow: 0;
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
.confirmar {
  margin: 0;
  font-size: 14px;
}
@media (max-width: 1100px) {
  .exp {
    grid-template-columns: minmax(0, 1fr);
  }
  .lateral,
  .derecha {
    border: 0;
    border-bottom: 1px solid var(--borde);
  }
  .tarjetas {
    grid-template-columns: minmax(0, 1fr);
  }
  .pendientes {
    margin: 0 -16px;
    padding: 12px 16px;
  }
  .centro {
    padding: 20px 16px;
  }
}
</style>
