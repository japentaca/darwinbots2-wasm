<script>
// @ts-check
// Observar (paso N1.3): el mundo a la izquierda, el panel lateral a la
// derecha y la barra de controles abajo. La corrida actual (escenario +
// semilla + eventos) vive en src/lib/sim/corrida.svelte.js.
//
// Disposiciones y pestañas (PLAN-TORNEO-EN-CURSO.md, TC3: T6 y T7; lógica
// en src/lib/observar/disposicion.js): ▣ Campo (el mundo solo), ◧ Mixta
// (el mundo y el panel) y ▤ Datos (el panel a lo ancho y el mundo en
// miniatura en una esquina). El mundo es siempre el mismo canvas: cambiar
// de disposición solo cambia su tamaño. El panel tiene las pestañas En
// vivo, Torneo (con un torneo en curso) y Bot (el inspector).
import { untrack } from 'svelte';
import { num, t } from '../i18n/index.svelte.js';
import { inspectorVisible } from '../lib/inspector/estado.svelte.js';
import Inspector from '../lib/inspector/Inspector.svelte';
import { jugador } from '../lib/inspector/jugador.svelte.js';
import Mundo from '../lib/mundo/Mundo.svelte';
import { LENTES } from '../lib/mundo/render-enriquecido.js';
import DialogoCorridas from '../lib/observar/DialogoCorridas.svelte';
import DialogoGuardar from '../lib/observar/DialogoGuardar.svelte';
import DialogoSembrar from '../lib/observar/DialogoSembrar.svelte';
import { descargar, nombreArchivo, pngMundo } from '../lib/observar/descargas.js';
import {
  DISPOSICIONES,
  disposicionGuardada,
  guardarDisposicion,
  pestañaInicial,
  pestañasPanel,
  pestañaTras,
} from '../lib/observar/disposicion.js';
import { avisoDeError } from '../lib/observar/errores.js';
import IndicadorJugador from '../lib/observar/IndicadorJugador.svelte';
import MenuInstantanea from '../lib/observar/MenuInstantanea.svelte';
import BarraMundo from '../lib/observar/objetos/BarraMundo.svelte';
import { ordenBorrar } from '../lib/observar/objetos/ordenes.js';
import PanelVivo from '../lib/observar/PanelVivo.svelte';
import PanelTorneo from '../lib/observar/tv/PanelTorneo.svelte';
import RotuloTv from '../lib/observar/tv/RotuloTv.svelte';
import { avanceEncendido } from '../lib/observar/tv/tv.svelte.js';
import { cicloVisible } from '../lib/sim/ciclo.js';
import { corridasGuardadas, corrida as obtenerCorrida } from '../lib/sim/corrida.svelte.js';
import { VELOCIDADES } from '../lib/sim/sesion.svelte.js';
import { hashDe } from '../router.js';

/** @type {{ partes?: string[] }} */
let { partes = [] } = $props();

// Torneo en curso (decisión 23, PLAN-TORNEO-EN-CURSO.md TC1 y TC2): es un
// estado de la app (tv.svelte.js); Observar solo lo dibuja, y entrar o
// salir no lo enciende ni lo apaga. La pantalla completa (⛶ o F) es aparte:
// el campo solo, con el rótulo del torneo encima si lo hay, y no toca el
// avance.
const auto = $derived(avanceEncendido());
const bloqueado = $derived(auto ? t('observar.auto.bloqueado') : '');
let completa = $state(false);

// las rutas del modo TV de antes (#/observar/tv y #/observar/torneo)
$effect(() => {
  if (partes[0] === 'tv' || partes[0] === 'torneo') window.location.hash = hashDe('observar');
});

/** Entra o sale de la pantalla completa (en el gesto del usuario: clic o tecla). */
function alternarPantalla() {
  if (completa) {
    completa = false;
    return;
  }
  completa = true;
  const d = document.documentElement;
  if (d.requestFullscreen && !document.fullscreenElement)
    d.requestFullscreen().catch(() => {
      // sin pantalla completa del navegador: el campo ocupa la ventana igual
    });
}

/** @type {HTMLElement | undefined} */
let raiz = $state();

/**
 * El resto de la app, inerte mientras dura el TV: los hermanos de `el` y
 * de cada ancestro hasta el body. Devuelve cómo deshacerlo.
 * @param {HTMLElement} el
 */
function inertizarResto(el) {
  /** @type {HTMLElement[]} */
  const puestos = [];
  for (let n = el; n.parentElement && n !== document.body; n = n.parentElement)
    for (const h of n.parentElement.children)
      if (h !== n && h instanceof HTMLElement && !h.inert) {
        h.inert = true;
        puestos.push(h);
      }
  return () => {
    for (const h of puestos) h.inert = false;
  };
}

// A pantalla completa: el resto de la app inerte; Esc (o cerrar la pantalla
// completa desde el navegador) vuelve a la vista con paneles.
$effect(() => {
  if (!completa) return;
  const el = untrack(() => raiz);
  const desinertizar = el ? inertizarResto(el) : () => {};
  let delNavegador = !!document.fullscreenElement;
  const alCambiar = () => {
    if (delNavegador && !document.fullscreenElement) completa = false;
    delNavegador = !!document.fullscreenElement;
  };
  /** @param {KeyboardEvent} e */
  const alTecla = (e) => {
    if (e.key === 'Escape') completa = false;
  };
  document.addEventListener('fullscreenchange', alCambiar);
  window.addEventListener('keydown', alTecla);
  return () => {
    document.removeEventListener('fullscreenchange', alCambiar);
    window.removeEventListener('keydown', alTecla);
    desinertizar();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
});

// F: pantalla completa (no mientras se escribe ni con un diálogo abierto)
$effect(() => {
  /** @param {KeyboardEvent} e */
  const alTecla = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.key !== 'f' && e.key !== 'F')) return;
    const el = /** @type {HTMLElement | null} */ (e.target);
    if (el?.closest?.('input, textarea, select, [contenteditable], dialog')) return;
    e.preventDefault();
    alternarPantalla();
  };
  window.addEventListener('keydown', alTecla);
  return () => window.removeEventListener('keydown', alTecla);
});

const corrida = obtenerCorrida();
const sesion = corrida.sesion;
const estado = corrida.estado;

// Sin sim todavía: el escenario de fábrica «Sopa primordial» (o la de prueba).
$effect(() => {
  if (!sesion.hayMundo && !auto) untrack(() => corrida.arrancarPorDefecto());
});

const lentes = Object.keys(LENTES);

// Disposición (T6): se recuerda en este navegador; la pantalla completa la
// conserva.
let disposicion = $state(disposicionGuardada());
/** @param {import('../lib/observar/disposicion.js').Disposicion} d */
function ponerDisposicion(d) {
  disposicion = d;
  guardarDisposicion(d);
}
const conPanel = $derived(disposicion !== 'campo');
const mini = $derived(disposicion === 'datos');

// Pestañas del panel (T7): empieza el torneo → Torneo; se elige un bot →
// Bot; se suelta el bot o termina el torneo → la que corresponda.
const conBot = $derived(inspectorVisible(sesion));
const pestañas = $derived(pestañasPanel(auto));
let pestaña = $state(untrack(() => pestañaInicial(auto, conBot)));
let antes = { torneo: untrack(() => auto), bot: untrack(() => conBot) };
$effect(() => {
  const ahora = { torneo: auto, bot: conBot };
  untrack(() => {
    pestaña = pestañaTras(pestaña, antes, ahora);
    antes = ahora;
  });
});

const uid = $props.id();

/**
 * Pestañas con el teclado (patrón tablist): flechas, Inicio y Fin.
 * @param {KeyboardEvent} e
 */
function teclaPestaña(e) {
  const i = pestañas.indexOf(pestaña);
  const n = pestañas.length;
  const j =
    e.key === 'ArrowRight'
      ? (i + 1) % n
      : e.key === 'ArrowLeft'
        ? (i - 1 + n) % n
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? n - 1
            : -1;
  if (j < 0) return;
  e.preventDefault();
  pestaña = pestañas[j];
  document.getElementById(`${uid}-tab-${pestañas[j]}`)?.focus();
}

// Player Bot (N4.1): se apaga al cambiar la sim, con un contest F1, con el
// avance automático del torneo y al salir de Observar.
const hayF1 = $derived(!!sesion.stats.f1);
$effect(() => {
  sesion.mundo;
  hayF1;
  if (auto) untrack(() => jugador.desactivar());
  else untrack(() => jugador.vigilar(sesion));
});
$effect(() => () => jugador.desactivar());

/** «Buscar el mejor» (N4.1): el foco pasa al bot más apto. */
async function buscarMejor() {
  const n = await sesion.buscarMejor();
  if (n === 0) corrida.avisar('observar.mejor.ninguno', {});
}

// Los avisos que no son errores se van solos.
$effect(() => {
  const a = estado.aviso;
  if (!a || a.error) return;
  const id = setTimeout(() => {
    if (estado.aviso === a) estado.aviso = null;
  }, 6000);
  return () => clearTimeout(id);
});

let verSembrar = $state(false);
let verGuardar = $state(false);
let verCorridas = $state(false);

// Barra «Mundo» (N3.8, decisión 15): objetos editados sobre el mundo.
let verMundo = $state(false);
let modoBorrar = $state(false);
let nObs = $state(0);
let nTps = $state(0);
/** @type {{ tipo: 'forma' | 'teleporter', n: number } | null} */
let resaltado = $state(null);

/**
 * Borrado desde el mundo (modo borrar). Con la corrida ocupada (iniciando,
 * guardando, cargando) no se borra, como los botones de la barra: false.
 * @param {{ tipo: 'forma' | 'teleporter', n: number }} o
 */
function borrarObjeto(o) {
  if (estado.ocupado || !sesion.hayMundo) return false;
  return corrida.aplicarObjetos(ordenBorrar(o)).catch(() => {
    corrida.avisar('mundoObj.aviso.error', {}, true);
  });
}

function cerrarMundo() {
  verMundo = false;
  modoBorrar = false;
}

// con el avance automático la barra «Mundo» no se usa
$effect(() => {
  if (auto) untrack(cerrarMundo);
});

function alternarMundo() {
  if (verMundo) cerrarMundo();
  else verMundo = true;
}

/** @param {() => Promise<void>} fn */
async function intentar(fn) {
  try {
    await fn();
  } catch (e) {
    // Sin textos técnicos: la clave sale del tipo de error (errores.js).
    const a = avisoDeError(e);
    corrida.avisar(a.clave, a.params, true);
  }
}

/**
 * Reemplazar la sim descarta lo que no se guardó: se pregunta antes.
 * @returns {boolean} se puede seguir
 */
function puedeDescartar() {
  if (!corrida.sinGuardar()) return true;
  return confirm(t('observar.confirmar.descartar', { nombre: nombreVisible }));
}

/** @param {string} nombre @param {boolean} comoNueva */
function guardar(nombre, comoNueva) {
  intentar(async () => {
    const r = await corrida.guardar(nombre, { comoNueva });
    if (r.borradas.length)
      corrida.avisar('observar.aviso.podadas', { nombre, n: r.borradas.length });
    else corrida.avisar('observar.aviso.guardada', { nombre });
  });
}

/** @param {string} id */
function cargar(id) {
  // También la misma corrida: volver a lo guardado descarta lo que siguió.
  if (!puedeDescartar()) return;
  intentar(async () => {
    const c = await corrida.cargar(id);
    if (c) corrida.avisar('observar.aviso.cargada', { nombre: c.nombre });
  });
}

/** @param {File} f */
function abrirArchivo(f) {
  if (!puedeDescartar()) return;
  intentar(async () => {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (await corrida.importarDbsim(bytes, f.name))
      corrida.avisar('observar.aviso.importada', { nombre: f.name });
  });
}

function instantanea() {
  intentar(async () => {
    const png = await pngMundo();
    if (!png) return;
    const base = `${estado.nombre || 'darwinbots'}-${cicloVisible(sesion.stats.cycle)}`;
    descargar(png, nombreArchivo(base, '.png'));
  });
}

const nombreVisible = $derived(estado.nombre || t('observar.sinNombre'));
</script>

<section class="observar" class:tv={completa} bind:this={raiz}>
  <div class="cuerpo" class:datos={mini}>
    <div class="lienzo">
      <Mundo
        {sesion}
        modoBorrar={verMundo && modoBorrar}
        onBorrar={borrarObjeto}
        onSalirBorrar={() => (modoBorrar = false)}
        onPunteroMundo={(x, y) => jugador.puntero(x, y)}
        onResaltar={(o, no, nt) => {
  resaltado = o;
  nObs = no;
  nTps = nt;
}}
      />
      {#if !auto}
        <IndicadorJugador {sesion} />
      {/if}
      {#if auto}
        <RotuloTv {completa} onPantalla={alternarPantalla} campo={!conPanel} {mini} />
      {:else if verMundo && !completa}
        <BarraMundo {corrida} bind:modoBorrar {nObs} {nTps} {resaltado} onCerrar={cerrarMundo} />
      {/if}
    </div>
    {#if conPanel}
      <aside class="lateral" aria-label={t('observar.lateral.aria')}>
        <div class="seg pestañas" role="tablist" aria-label={t('observar.lateral.pestanas')}>
          {#each pestañas as p (p)}
            <button
              type="button"
              role="tab"
              id={`${uid}-tab-${p}`}
              class:on={pestaña === p}
              aria-selected={pestaña === p}
              aria-controls={`${uid}-panel`}
              tabindex={pestaña === p ? 0 : -1}
              onclick={() => (pestaña = p)}
              onkeydown={teclaPestaña}
            >
              {t(`observar.lateral.${p}`)}
            </button>
          {/each}
        </div>
        <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${pestaña}`}>
          {#if pestaña === 'torneo' && auto}
            <PanelTorneo amplio={mini} />
          {:else if pestaña === 'bot'}
            {#if conBot}
              <Inspector
                {sesion}
                {corrida}
                onCerrar={() => sesion.seleccionar(0)}
                siguiendo={sesion.siguiendo}
                onSeguir={(on) => sesion.seguir(on)}
              />
            {:else}
              <p class="vacio">{t('observar.bot.vacio')}</p>
            {/if}
          {:else}
            <PanelVivo {corrida} amplio={mini} />
          {/if}
        </div>
      </aside>
    {/if}
  </div>

  {#if completa && (!auto || mini)}
    <button
      class="salirPantalla"
      type="button"
      title={t('observar.pantalla.salir.ayuda')}
      onclick={alternarPantalla}
    >
      {t('observar.pantalla.salir')}
    </button>
  {/if}

  {#if estado.aviso && !completa}
    <div
      class="aviso"
      class:error={estado.aviso.error}
      role={estado.aviso.error ? 'alert' : 'status'}
    >
      <span>{t(estado.aviso.clave, estado.aviso.params)}</span>
      <button
        type="button"
        class="x"
        aria-label={t('observar.aviso.cerrar')}
        title={t('observar.aviso.cerrar')}
        onclick={() => (estado.aviso = null)}
      >
        ✕
      </button>
    </div>
  {/if}

  {#if !completa}
    <div class="barra">
      <button
        class="btn pri"
        type="button"
        style="width: 112px"
        disabled={!sesion.hayMundo || !!estado.ocupado}
        onclick={() => sesion.correr(!sesion.corriendo)}
      >
        {#if sesion.corriendo}
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor"></rect>
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"></rect>
          </svg>{t('mundo.pausar')}
        {:else}
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 1.5v11l9-5.5z" fill="currentColor"></path>
          </svg>{t('mundo.iniciar')}
        {/if}
      </button>
      <button
        class="btn"
        type="button"
        disabled={!sesion.hayMundo}
        onclick={() => sesion.unCiclo()}
      >
        {t('mundo.unCiclo')}
      </button>
      <fieldset class="seg velocidad">
        <legend class="oculto">{t('mundo.velocidad')}</legend>
        {#each VELOCIDADES as v (v)}
          <button
            type="button"
            class:on={sesion.velocidad === v}
            aria-pressed={sesion.velocidad === v}
            title={v === 0 ? t('mundo.velocidad.maxAyuda') : t('mundo.velocidad.ayuda', { n: v })}
            onclick={() => sesion.ponerVelocidad(v)}
          >
            {v === 0 ? t('mundo.velocidad.max') : `× ${v}`}
          </button>
        {/each}
      </fieldset>
      <div class="sep"></div>
      <button
        class="btn"
        type="button"
        title={bloqueado || t('observar.sembrar.ayuda')}
        disabled={!sesion.hayMundo || auto}
        onclick={() => (verSembrar = true)}
      >
        {t('observar.sembrar')}
      </button>
      <button
        class="btn"
        class:activo={verMundo}
        type="button"
        title={bloqueado || t('mundoObj.boton.ayuda')}
        aria-pressed={verMundo}
        disabled={(!sesion.hayMundo && !verMundo) || auto}
        onclick={alternarMundo}
      >
        {t('mundoObj.boton')}
      </button>
      <button
        class="btn"
        type="button"
        title={t('observar.guardar.ayuda')}
        disabled={!sesion.hayMundo || !!estado.ocupado}
        onclick={() => (verGuardar = true)}
      >
        {t('observar.guardar')}
      </button>
      <button
        class="btn"
        type="button"
        title={t('observar.mejor.ayuda')}
        disabled={!sesion.hayMundo}
        onclick={buscarMejor}
      >
        {t('observar.mejor')}
      </button>
      <MenuInstantanea {sesion} {corrida} nombre={estado.nombre} onPng={instantanea} />
      <button
        class="btn"
        type="button"
        title={bloqueado || t('observar.corridas.ayuda')}
        disabled={!!estado.ocupado || auto}
        onclick={() => (verCorridas = true)}
      >
        {t('observar.corridas')}
      </button>
      <div class="relleno"></div>
      <fieldset class="seg disposicion">
        <legend class="oculto">{t('observar.disposicion')}</legend>
        {#each DISPOSICIONES as d (d)}
          <button
            type="button"
            class:on={disposicion === d}
            aria-pressed={disposicion === d}
            title={t(`observar.disposicion.${d}.ayuda`)}
            onclick={() => ponerDisposicion(d)}
          >
            {t(`observar.disposicion.${d}`)}
          </button>
        {/each}
      </fieldset>
      <button
        class="btn"
        type="button"
        title={t('observar.pantalla.ayuda')}
        aria-label={t('observar.pantalla')}
        onclick={alternarPantalla}
      >
        ⛶
      </button>
      <span class="mono dato" title={t('observar.ritmo.ayuda')}
        >{t('observar.ritmo', { tps: num(sesion.stats.tps), fps: num(sesion.fps) })}</span
      >
      <label class="campo"
        >{t('mundo.vista')}
        <select
          class="sel"
          value={sesion.rica ? 'rica' : sesion.contorno ? 'contorno' : 'clasica'}
          onchange={(e) => sesion.ponerVista(e.currentTarget.value === 'rica', e.currentTarget.value === 'contorno')}
        >
          <option value="rica">{t('mundo.vista.rica.corta')}</option>
          <option value="clasica">{t('mundo.vista.clasica.corta')}</option>
          <option value="contorno">{t('mundo.vista.contorno.corta')}</option>
        </select></label
      >
      <label class="campo" title={sesion.rica ? '' : t('mundo.colorPor.soloRica')}
        >{t('mundo.colorPor.etiqueta')}
        <select
          class="sel"
          value={sesion.lente}
          disabled={!sesion.rica}
          onchange={(e) => sesion.ponerLente(e.currentTarget.value)}
        >
          {#each lentes as l (l)}
            <option value={l}>{t(`mundo.lente.${l}`)}</option>
          {/each}
        </select></label
      >
    </div>
  {/if}
</section>

<DialogoSembrar bind:abierto={verSembrar} onSembrar={(sp) => corrida.sembrar(sp)} />
<DialogoGuardar
  bind:abierto={verGuardar}
  nombreInicial={nombreVisible}
  ocupado={!!estado.ocupado}
  yaGuardada={!!estado.id}
  onGuardar={guardar}
  onDescargar={() => intentar(async () => void (await corrida.exportarDbsim()))}
/>
<DialogoCorridas
  bind:abierto={verCorridas}
  idActual={estado.id}
  listar={() => corridasGuardadas().listar()}
  onCargar={cargar}
  onBorrar={(id) => corridasGuardadas().borrar(id)}
  onArchivo={abrirArchivo}
/>

<style>
.observar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}
/* pantalla completa: el campo ocupa la ventana (aunque el navegador no la dé) */
.observar.tv {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--mundo);
}
.cuerpo {
  flex: 1;
  min-height: 0;
  display: flex;
}
.lienzo {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
}
.salirPantalla {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 6;
  font: inherit;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #6b6962;
  background: rgba(21, 21, 19, 0.85);
  color: #f4f3ef;
  cursor: pointer;
}
.btn.activo {
  background: var(--chip);
  border-color: var(--acento);
}
.lateral {
  width: 400px;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 18px 20px;
  overflow-y: auto;
  border-left: 1px solid var(--borde);
  background: var(--fondo);
}
.pestañas {
  margin-bottom: 16px;
}
.pestañas button {
  flex: 1;
}
.vacio {
  margin: 0;
  font-size: 13px;
  color: var(--gris);
}
/* Datos: el panel a lo ancho y el mundo (el mismo canvas) en una esquina */
.cuerpo.datos {
  position: relative;
}
.datos .lateral {
  flex: 1;
  width: auto;
  min-width: 0;
  border-left: 0;
  padding-bottom: 272px;
}
.datos .lienzo {
  position: absolute;
  right: 20px;
  bottom: 16px;
  z-index: 5;
  width: min(380px, 40%);
  height: 240px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--borde-control);
  box-shadow: 0 6px 20px var(--sombra);
}
@media (max-width: 900px) {
  .cuerpo {
    flex-direction: column;
    overflow-y: auto;
  }
  .lienzo {
    flex: none;
    height: 60vh;
  }
  .lateral {
    width: auto;
    overflow: visible;
    border-left: 0;
    border-top: 1px solid var(--borde);
  }
  /* en el teléfono la miniatura va arriba, en la columna, más baja */
  .datos .lienzo {
    position: relative;
    right: auto;
    bottom: auto;
    width: auto;
    height: 30vh;
    border-radius: 0;
    border: 0;
    box-shadow: none;
  }
  .datos .lateral {
    flex: none;
    padding-bottom: 18px;
  }
}
.aviso {
  position: absolute;
  left: 16px;
  bottom: 80px;
  max-width: min(560px, calc(100% - 32px));
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--tarjeta);
  border: 1px solid var(--borde-control);
  box-shadow: 0 4px 16px var(--sombra);
  font-size: 13px;
  z-index: 3;
}
.aviso.error {
  border-color: var(--error-borde);
  background: var(--error-fondo);
}
.x {
  font: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--gris);
}
.barra {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-height: 64px;
  padding: 12px 20px;
  background: var(--tarjeta);
  border-top: 1px solid var(--borde);
  box-sizing: border-box;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.velocidad,
.disposicion {
  margin: 0;
  padding: 0;
  min-width: 0;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.sep {
  width: 1px;
  height: 32px;
  background: var(--borde);
}
.relleno {
  flex-grow: 1;
}
.dato {
  font-size: 12px;
  color: var(--gris);
  white-space: nowrap;
}
.campo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--gris);
}
.sel {
  font: inherit;
  font-size: 13px;
  height: 38px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
  color: var(--texto);
}
.sel:disabled {
  opacity: 0.5;
}
</style>
