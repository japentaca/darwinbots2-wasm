<script>
// @ts-check
// Menú «Instantánea» de Observar (paso N4.1): la imagen del mundo (PNG, lo
// de siempre), la instantánea de los vivos (.snp y, si se pide, el
// _Mutations.txt) y el registro de muertos acumulado (encenderlo, sin
// vegetales, descargarlo y reiniciarlo). Encender el registro o quitarle los
// vegetales son opciones de la sim (111 y 112): se aplican como cambio en
// caliente y quedan en la corrida (decisión 13).
import { onMount } from 'svelte';
import { num, t } from '../../i18n/index.svelte.js';
import { ARCHIVOS_MUERTOS, aplicarCambioVivo, archivosVivos } from '../inspector/veterano.js';
import { cicloVisible } from '../sim/ciclo.js';
import { descargar, nombreArchivo } from './descargas.js';

/**
 * @type {{
 *   sesion: import('../sim/sesion.svelte.js').Sesion,
 *   corrida: import('../sim/corrida-nucleo.js').NucleoCorrida,
 *   nombre: string,
 *   onPng: () => void,
 * }}
 */
let { sesion, corrida, nombre, onPng } = $props();

const uid = $props.id();
let abierto = $state(false);
let conMutaciones = $state(true);
/** registro de muertos encendido (opción 111) y sin vegetales (112); null = sin leer */
/** @type {boolean | null} */
let registrar = $state(null);
/** @type {boolean | null} */
let sinVegetales = $state(null);
let ocupado = $state(false);
/** @type {{ clave: string, params?: Record<string, any>, error?: boolean } | null} */
let nota = $state(null);
/** @type {HTMLDivElement | undefined} */
let raiz = $state();

const muertos = $derived(Number(sesion.stats.dead) || 0);
const f1 = $derived(!!sesion.stats.f1);

/** Lee las dos opciones del registro (también en una sim cargada de archivo). */
async function leerOpciones() {
  try {
    const o = await sesion.c.getopts([111, 112]);
    registrar = 111 in o ? !!o[111] : null;
    sinVegetales = 112 in o ? !!o[112] : null;
  } catch {
    registrar = null;
    sinVegetales = null;
  }
}

function alternar() {
  abierto = !abierto;
  nota = null;
  if (abierto && sesion.hayMundo) leerOpciones();
}

onMount(() => {
  /** @param {PointerEvent} e */
  const fuera = (e) => {
    if (abierto && raiz && !raiz.contains(/** @type {Node} */ (e.target))) abierto = false;
  };
  document.addEventListener('pointerdown', fuera);
  return () => document.removeEventListener('pointerdown', fuera);
});

/** @param {KeyboardEvent} e */
function teclas(e) {
  if (e.key === 'Escape' && abierto) {
    e.stopPropagation();
    abierto = false;
  }
}

function base() {
  return nombreArchivo(`${nombre || 'darwinbots'}-${cicloVisible(sesion.stats.cycle)}`, '');
}

function png() {
  abierto = false;
  onPng();
}

async function vivos() {
  if (ocupado || !sesion.hayMundo) return;
  ocupado = true;
  nota = null;
  try {
    const r = await sesion.c.snapshot(conMutaciones);
    const a = archivosVivos(base());
    descargar(new Blob([r.snp], { type: 'text/plain' }), a.snp);
    if (conMutaciones && r.mut) descargar(new Blob([r.mut], { type: 'text/plain' }), a.mut);
    nota = { clave: 'observar.snp.vivosListo', params: { n: num(r.records) } };
  } catch {
    nota = { clave: 'observar.snp.error', error: true };
  } finally {
    ocupado = false;
  }
}

/**
 * @param {111 | 112} id
 * @param {HTMLInputElement} casilla  la que cambió (vuelve atrás si falla)
 */
async function opcion(id, casilla) {
  const on = casilla.checked;
  if (f1) {
    casilla.checked = !on;
    return;
  }
  try {
    await aplicarCambioVivo(corrida, { [`opt:${id}`]: on ? 1 : 0 });
    if (id === 111) registrar = on;
    else sinVegetales = on;
  } catch {
    nota = { clave: 'observar.snp.error', error: true };
    // El estado no cambió (checked={…} no se vuelve a escribir solo): la
    // casilla vuelve a mano al valor anterior, y se relee por las dudas.
    casilla.checked = !on;
    leerOpciones();
  }
}

async function bajarMuertos() {
  if (ocupado || !sesion.hayMundo) return;
  ocupado = true;
  nota = null;
  try {
    const r = await sesion.c.deadTake(false);
    if (!r.records) {
      nota = { clave: 'observar.snp.sinMuertos' };
      return;
    }
    descargar(new Blob([r.snp], { type: 'text/plain' }), ARCHIVOS_MUERTOS.snp);
    descargar(new Blob([r.mut], { type: 'text/plain' }), ARCHIVOS_MUERTOS.mut);
    nota = { clave: 'observar.snp.muertosListo', params: { n: num(r.records) } };
  } catch {
    nota = { clave: 'observar.snp.error', error: true };
  } finally {
    ocupado = false;
  }
}

function reiniciar() {
  if (!sesion.hayMundo) return;
  if (!confirm(t('observar.snp.confirmarReinicio', { n: num(muertos) }))) return;
  sesion.c.deadReset();
  sesion.redibujar();
  nota = { clave: 'observar.snp.reiniciado' };
}
</script>

<svelte:window onkeydown={teclas} />

<div class="menu" bind:this={raiz}>
  <button
    class="btn"
    type="button"
    title={t('observar.instantanea.ayuda')}
    aria-expanded={abierto}
    aria-controls={`${uid}-panel`}
    disabled={!sesion.hayMundo}
    onclick={alternar}
  >
    {t('observar.instantanea')} <span aria-hidden="true">▾</span>
  </button>
  {#if abierto}
    <div class="panel" id={`${uid}-panel`}>
      <button class="btn item" type="button" onclick={png}>{t('observar.snp.png')}</button>
      <div class="sep"></div>
      <div class="grupo">
        <button
          class="btn item"
          type="button"
          disabled={ocupado}
          title={t('observar.snp.vivos.ayuda')}
          onclick={vivos}
        >
          {t('observar.snp.vivos')}
        </button>
        <label class="chk"
          ><input type="checkbox" bind:checked={conMutaciones}>
          {t('observar.snp.conMutaciones')}</label
        >
      </div>
      <div class="sep"></div>
      <div class="grupo">
        <div class="tit">{t('observar.snp.muertos')}</div>
        <label class="chk" title={t('observar.snp.registrar.ayuda')}
          ><input
            type="checkbox"
            checked={!!registrar}
            disabled={registrar === null || f1}
            onchange={(e) => opcion(111, e.currentTarget)}
          >
          {t('observar.snp.registrar')}</label
        >
        <label class="chk" title={t('observar.snp.sinVegetales.ayuda')}
          ><input
            type="checkbox"
            checked={!!sinVegetales}
            disabled={sinVegetales === null || f1}
            onchange={(e) => opcion(112, e.currentTarget)}
          >
          {t('observar.snp.sinVegetales')}</label
        >
        <div class="mono cuenta">{t('observar.snp.registros', { n: num(muertos) })}</div>
        <div class="fila">
          <button
            class="btn item"
            type="button"
            disabled={ocupado || !muertos}
            onclick={bajarMuertos}
          >
            {t('observar.snp.descargarMuertos')}
          </button>
          <button class="btn item" type="button" disabled={!muertos} onclick={reiniciar}>
            {t('observar.snp.reiniciar')}
          </button>
        </div>
      </div>
      {#if nota}
        <p class="nota" class:error={nota.error} role="status">{t(nota.clave, nota.params)}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
.menu {
  position: relative;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.panel {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 5;
  width: 290px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--tarjeta);
  border: 1px solid var(--borde-control);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  font-size: 13px;
}
.item {
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
}
.grupo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fila {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tit {
  font-weight: 600;
}
.chk {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--gris);
}
.cuenta {
  font-size: 12px;
  color: var(--gris);
}
.sep {
  height: 1px;
  background: var(--borde);
}
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris);
}
.nota.error {
  color: #9b2c1f;
}
</style>
