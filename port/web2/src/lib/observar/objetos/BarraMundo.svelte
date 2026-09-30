<script>
// @ts-check
// Barra «Mundo» de Observar (decisión 15, paso N3.8): obstáculos, laberintos
// y teleporters editados sobre el mundo. Cada acción es una orden de objeto
// (engine/corridas.js) que la corrida manda en un ciclo exacto y registra
// como evento (decisión 13: las réplicas la repiten en el mismo ciclo).
// «Guardar en el escenario» pasa los objetos, como órdenes (C13), al
// escenario efectivo de la corrida, que es lo que muestra Experimentar.
// El modo borrar (clic sobre una forma o un teleporter) lo maneja el mundo
// (Mundo.svelte, props modoBorrar/onBorrar); acá está el interruptor.
import { idioma, num, t } from '../../../i18n/index.svelte.js';
import {
  enteroPositivo,
  fraccion,
  LABERINTOS,
  MURO_DEF,
  orden,
  PASILLO_DEF,
  TAMANO_DEF,
} from './ordenes.js';

/**
 * @typedef {import('../../../../engine/corridas.js').OrdenObjeto} OrdenObjeto
 * @type {{
 *   corrida: import('../../sim/corrida-nucleo.js').NucleoCorrida,
 *   modoBorrar: boolean,
 *   nObs: number,
 *   nTps: number,
 *   resaltado: { tipo: 'forma' | 'teleporter', n: number } | null,
 *   onCerrar: () => void,
 * }}
 */
let { corrida, modoBorrar = $bindable(false), nObs, nTps, resaltado, onCerrar } = $props();

const TOPE_TPS = 10;
const uid = $props.id();

let ancho = $state(String(TAMANO_DEF));
let alto = $state(String(TAMANO_DEF));
let pasillo = $state(String(PASILLO_DEF));
let muro = $state(String(MURO_DEF));
/** @type {'' | 'laberinto' | 'borrarTodo'} */
let menu = $state('');
/** @type {HTMLDivElement | undefined} */
let caja = $state();

const fAncho = $derived(fraccion(ancho));
const fAlto = $derived(fraccion(alto));
const tamanoOk = $derived(fAncho !== null && fAlto !== null);
const ePasillo = $derived(enteroPositivo(pasillo));
const eMuro = $derived(enteroPositivo(muro));
const laberintoOk = $derived(ePasillo !== null && eMuro !== null);

const sesion = $derived(corrida.sesion);
const hayMundo = $derived(sesion.hayMundo && !corrida.estado.ocupado);
const hayEscenario = $derived(!!corrida.estado.escenario);

/** @param {number} n */
const forma = (n) => (new Intl.PluralRules(idioma()).select(n) === 'one' ? 'uno' : 'otros');
/** @param {string} clave @param {number} n */
const tn = (clave, n) => t(`${clave}.${forma(n)}`, { n: num(n) });

/** @param {OrdenObjeto} o */
async function hacer(o) {
  menu = '';
  try {
    await corrida.aplicarObjetos(o);
  } catch {
    corrida.avisar('mundoObj.aviso.error', {}, true);
  }
}

/** @param {string} tipo */
function crear(tipo) {
  if (!tamanoOk) return;
  void hacer(orden(tipo, { ancho: fAncho, alto: fAlto }));
}

/**
 * Polar y escombros no usan pasillo ni muro: van con los valores por
 * defecto aunque los campos no valgan.
 * @param {(typeof LABERINTOS)[number]} l
 */
function laberinto(l) {
  const usa = l.pasillo || l.muro;
  if (usa && !laberintoOk) return;
  void hacer(
    orden('laberinto', {
      forma: l.forma,
      pasillo: usa ? ePasillo : PASILLO_DEF,
      muro: usa ? eMuro : MURO_DEF,
    }),
  );
}

/** @param {'formas' | 'teleporters'} que */
function borrarTodo(que) {
  const n = que === 'formas' ? nObs : nTps;
  menu = '';
  if (!confirm(t(`mundoObj.confirmar.${que}`, { n: num(n) }))) return;
  void hacer(orden(que === 'formas' ? 'borrar-formas' : 'borrar-teleporters'));
}

function guardar() {
  const r = corrida.guardarObjetosEnEscenario();
  if (!r) {
    corrida.avisar('mundoObj.guardar.sinEscenario', {}, true);
    return;
  }
  const n = r.objetos.obstaculos.length + r.objetos.teleporters.length;
  if (n === 0) corrida.avisar('mundoObj.aviso.vacio');
  else
    corrida.avisar(`mundoObj.aviso.${r.aproximado ? 'aproximado' : 'guardado'}.${forma(n)}`, {
      n: num(n),
    });
}

/** @param {'laberinto' | 'borrarTodo'} m */
function alternarMenu(m) {
  menu = menu === m ? '' : m;
}

// Menús: se cierran con Esc o con un clic afuera; al abrir, el foco va al
// primer control del menú.
$effect(() => {
  if (!menu) return;
  const id = menu;
  queueMicrotask(() => {
    /** @type {HTMLElement | null | undefined} */
    const primero = caja?.querySelector(`[data-menu="${id}"] input, [data-menu="${id}"] button`);
    primero?.focus();
  });
  /** @param {PointerEvent} e */
  const fuera = (e) => {
    const el = /** @type {Element | null} */ (e.target);
    if (!el?.closest?.(`[data-grupo="${id}"]`)) menu = '';
  };
  window.addEventListener('pointerdown', fuera, true);
  return () => window.removeEventListener('pointerdown', fuera, true);
});

/** @param {KeyboardEvent} e */
function alTeclear(e) {
  if (e.key !== 'Escape') return;
  if (menu) {
    const id = menu;
    menu = '';
    /** @type {HTMLElement | null | undefined} */ (
      caja?.querySelector(`[data-grupo="${id}"] > button`)
    )?.focus();
    e.stopPropagation();
  } else if (modoBorrar) {
    modoBorrar = false;
    e.stopPropagation();
  }
}

const textoResaltado = $derived.by(() => {
  if (!resaltado) return t('mundoObj.resaltado.ninguno');
  const total = resaltado.tipo === 'teleporter' ? nTps : nObs;
  return t(`mundoObj.resaltado.${resaltado.tipo}`, { n: num(resaltado.n), total: num(total) });
});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="barra-mundo"
  role="toolbar"
  aria-label={t('mundoObj.aria')}
  tabindex="-1"
  bind:this={caja}
  onkeydown={alTeclear}
>
  <div class="fila">
    <span class="grupo" title={t('mundoObj.tamano.ayuda')}>
      <span class="etq">{t('mundoObj.tamano')}</span>
      <input
        class="num"
        type="number"
        min="0.01"
        max="1"
        step="0.05"
        bind:value={ancho}
        aria-label={t('mundoObj.ancho')}
        aria-invalid={fAncho === null}
      >
      <span aria-hidden="true">×</span>
      <input
        class="num"
        type="number"
        min="0.01"
        max="1"
        step="0.05"
        bind:value={alto}
        aria-label={t('mundoObj.alto')}
        aria-invalid={fAlto === null}
      >
    </span>
    <button
      type="button"
      class="b"
      title={tamanoOk ? t('mundoObj.forma.ayuda') : t('mundoObj.tamano.invalido')}
      disabled={!hayMundo || !tamanoOk}
      onclick={() => crear('forma')}
    >
      {t('mundoObj.forma')}
    </button>
    <button
      type="button"
      class="b"
      title={tamanoOk ? t('mundoObj.formas10.ayuda') : t('mundoObj.tamano.invalido')}
      disabled={!hayMundo || !tamanoOk}
      onclick={() => crear('formas')}
    >
      {t('mundoObj.formas10')}
    </button>
    <button
      type="button"
      class="b"
      title={t('mundoObj.borrar10.ayuda')}
      disabled={!hayMundo || nObs === 0}
      onclick={() => void hacer(orden('borrar-formas10'))}
    >
      {t('mundoObj.borrar10')}
    </button>

    <span class="sep" aria-hidden="true"></span>

    <span class="menu-grupo" data-grupo="laberinto">
      <button
        type="button"
        class="b"
        title={t('mundoObj.laberinto.ayuda')}
        aria-haspopup="true"
        aria-expanded={menu === 'laberinto'}
        aria-controls={`${uid}-laberinto`}
        disabled={!hayMundo}
        onclick={() => alternarMenu('laberinto')}
      >
        {t('mundoObj.laberinto')}
        ▾
      </button>
      {#if menu === 'laberinto'}
        <fieldset
          class="menu"
          id={`${uid}-laberinto`}
          data-menu="laberinto"
          aria-label={t('mundoObj.laberinto.menu')}
        >
          <div class="medidas">
            <label title={t('mundoObj.pasillo.ayuda')}
              >{t('mundoObj.pasillo')}
              <input
                class="num ancho"
                type="number"
                min="1"
                step="50"
                bind:value={pasillo}
                aria-invalid={ePasillo === null}
              ></label
            >
            <label title={t('mundoObj.muro.ayuda')}
              >{t('mundoObj.muro')}
              <input
                class="num ancho"
                type="number"
                min="1"
                step="10"
                bind:value={muro}
                aria-invalid={eMuro === null}
              ></label
            >
          </div>
          {#if !laberintoOk}
            <p class="invalido">{t('mundoObj.laberinto.invalido')}</p>
          {/if}
          <div class="tipos">
            {#each LABERINTOS as l (l.forma)}
              <button
                type="button"
                class="item"
                title={t(`mundoObj.laberinto.${l.forma}.ayuda`)}
                disabled={!laberintoOk && (l.pasillo || l.muro)}
                onclick={() => laberinto(l)}
              >
                {t(`mundoObj.laberinto.${l.forma}`)}
              </button>
            {/each}
          </div>
        </fieldset>
      {/if}
    </span>

    <button
      type="button"
      class="b"
      title={nTps >= TOPE_TPS ? t('mundoObj.teleporter.tope') : t('mundoObj.teleporter.ayuda')}
      disabled={!hayMundo || nTps >= TOPE_TPS}
      onclick={() => void hacer(orden('teleporter'))}
    >
      {t('mundoObj.teleporter')}
    </button>

    <span class="sep" aria-hidden="true"></span>

    <button
      type="button"
      class="b"
      class:on={modoBorrar}
      aria-pressed={modoBorrar}
      title={t('mundoObj.borrar.ayuda')}
      disabled={!hayMundo && !modoBorrar}
      onclick={() => (modoBorrar = !modoBorrar)}
    >
      {t('mundoObj.borrar')}
    </button>
    <span class="menu-grupo" data-grupo="borrarTodo">
      <button
        type="button"
        class="b"
        aria-haspopup="true"
        aria-expanded={menu === 'borrarTodo'}
        aria-controls={`${uid}-borrar`}
        disabled={!hayMundo || (nObs === 0 && nTps === 0)}
        onclick={() => alternarMenu('borrarTodo')}
      >
        {t('mundoObj.borrarTodo')}
        ▾
      </button>
      {#if menu === 'borrarTodo'}
        <fieldset
          class="menu"
          id={`${uid}-borrar`}
          data-menu="borrarTodo"
          aria-label={t('mundoObj.borrarTodo.menu')}
        >
          <button
            type="button"
            class="item"
            disabled={nObs === 0}
            onclick={() => borrarTodo('formas')}
          >
            {t('mundoObj.borrarTodo.formas')}
            ({num(nObs)})
          </button>
          <button
            type="button"
            class="item"
            disabled={nTps === 0}
            onclick={() => borrarTodo('teleporters')}
          >
            {t('mundoObj.borrarTodo.teleporters')}
            ({num(nTps)})
          </button>
        </fieldset>
      {/if}
    </span>

    <span class="sep" aria-hidden="true"></span>

    <button
      type="button"
      class="b"
      title={hayEscenario ? t('mundoObj.guardar.ayuda') : t('mundoObj.guardar.sinEscenario')}
      disabled={!hayMundo || !hayEscenario}
      onclick={guardar}
    >
      {t('mundoObj.guardar')}
    </button>

    <span class="relleno"></span>
    <span class="cuenta mono" aria-live="polite">
      {tn('mundoObj.cuenta.formas', nObs)}
      · {tn('mundoObj.cuenta.teleporters', nTps)}
    </span>
    <button
      type="button"
      class="x"
      aria-label={t('mundoObj.cerrar')}
      title={t('mundoObj.cerrar')}
      onclick={onCerrar}
    >
      ✕
    </button>
  </div>
  {#if !tamanoOk}
    <p class="invalido" role="alert">{t('mundoObj.tamano.invalido')}</p>
  {/if}
  {#if modoBorrar}
    <p class="ayuda-borrar">{t('mundoObj.modoBorrar')}</p>
    <p class="oculto" aria-live="polite">{textoResaltado}</p>
  {/if}
</div>

<style>
.barra-mundo {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 36px;
  z-index: 2;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(27, 28, 27, 0.94);
  border: 1px solid #33332f;
  color: #e8e6df;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
.barra-mundo:focus {
  outline: none;
}
.fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}
.grupo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.etq {
  color: #a9a79f;
  margin-right: 2px;
}
.num {
  width: 64px;
  height: 30px;
  box-sizing: border-box;
  font: inherit;
  font-size: 13px;
  border: 1px solid #45453f;
  border-radius: 6px;
  background: #262724;
  color: #e8e6df;
  padding: 0 6px;
}
.num.ancho {
  width: 80px;
}
.num[aria-invalid="true"] {
  border-color: #d9776a;
}
.b,
.item {
  font: inherit;
  font-size: 13px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #45453f;
  border-radius: 6px;
  background: #262724;
  color: #e8e6df;
  cursor: pointer;
  white-space: nowrap;
}
.b:hover:not(:disabled),
.item:hover:not(:disabled) {
  background: #33342f;
}
.b:disabled,
.item:disabled {
  opacity: 0.45;
  cursor: default;
}
.b.on {
  background: #6b2a22;
  border-color: #ff5a46;
}
.b:focus-visible,
.item:focus-visible,
.num:focus-visible,
.x:focus-visible {
  outline: 2px solid #4c7c76;
  outline-offset: 1px;
}
.sep {
  width: 1px;
  height: 22px;
  background: #45453f;
}
.relleno {
  flex-grow: 1;
}
.cuenta {
  font-size: 12px;
  color: #a9a79f;
  white-space: nowrap;
}
.x {
  font: inherit;
  border: 0;
  background: transparent;
  color: #a9a79f;
  cursor: pointer;
  padding: 2px 6px;
}
.menu-grupo {
  position: relative;
}
.menu {
  margin: 0;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 3;
  min-width: 220px;
  padding: 8px;
  border-radius: 8px;
  background: #1b1c1b;
  border: 1px solid #45453f;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.medidas {
  display: flex;
  gap: 10px;
}
.medidas label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #a9a79f;
}
.tipos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.item {
  text-align: left;
}
.invalido {
  margin: 6px 0 0;
  font-size: 12px;
  color: #ffb4a8;
}
.ayuda-borrar {
  margin: 6px 0 0;
  font-size: 12px;
  color: #ffcfc8;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  margin: 0;
}
</style>
