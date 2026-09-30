<script>
// @ts-check
// Observar (paso N1.3): el mundo a la izquierda, el panel lateral a la
// derecha («En vivo» o, con un bot seleccionado, el inspector) y la barra
// de controles abajo. La corrida actual (escenario + semilla + eventos)
// vive en src/lib/sim/corrida.svelte.js.
import { untrack } from 'svelte';
import { num, t } from '../i18n/index.svelte.js';
import { inspectorVisible } from '../lib/inspector/estado.svelte.js';
import Inspector from '../lib/inspector/Inspector.svelte';
import Mundo from '../lib/mundo/Mundo.svelte';
import { LENTES } from '../lib/mundo/render-enriquecido.js';
import DialogoCorridas from '../lib/observar/DialogoCorridas.svelte';
import DialogoGuardar from '../lib/observar/DialogoGuardar.svelte';
import DialogoSembrar from '../lib/observar/DialogoSembrar.svelte';
import { descargar, nombreArchivo, pngMundo } from '../lib/observar/descargas.js';
import { avisoDeError } from '../lib/observar/errores.js';
import BarraMundo from '../lib/observar/objetos/BarraMundo.svelte';
import { ordenBorrar } from '../lib/observar/objetos/ordenes.js';
import PanelVivo from '../lib/observar/PanelVivo.svelte';
import { cicloVisible } from '../lib/sim/ciclo.js';
import { corridasGuardadas, corrida as obtenerCorrida } from '../lib/sim/corrida.svelte.js';
import { VELOCIDADES } from '../lib/sim/sesion.svelte.js';

/** @type {{ partes?: string[] }} */
let { partes: _partes = [] } = $props();

const corrida = obtenerCorrida();
const sesion = corrida.sesion;
const estado = corrida.estado;

// Sin sim todavía: el escenario de fábrica «Sopa primordial» (o la de prueba).
$effect(() => {
  if (!sesion.hayMundo) untrack(() => corrida.arrancarPorDefecto());
});

const lentes = Object.keys(LENTES);

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

/** @param {{ tipo: 'forma' | 'teleporter', n: number }} o */
function borrarObjeto(o) {
  corrida.aplicarObjetos(ordenBorrar(o)).catch(() => {
    corrida.avisar('mundoObj.aviso.error', {}, true);
  });
}

function cerrarMundo() {
  verMundo = false;
  modoBorrar = false;
}

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

<section class="observar">
  <div class="cuerpo">
    <div class="lienzo">
      <Mundo
        {sesion}
        modoBorrar={verMundo && modoBorrar}
        onBorrar={borrarObjeto}
        onSalirBorrar={() => (modoBorrar = false)}
        onResaltar={(o, no, nt) => {
  resaltado = o;
  nObs = no;
  nTps = nt;
}}
      />
      {#if verMundo}
        <BarraMundo {corrida} bind:modoBorrar {nObs} {nTps} {resaltado} onCerrar={cerrarMundo} />
      {/if}
    </div>
    <aside class="lateral" aria-label={t('observar.lateral.aria')}>
      {#if inspectorVisible(sesion)}
        <Inspector
          {sesion}
          onCerrar={() => sesion.seleccionar(0)}
          siguiendo={sesion.siguiendo}
          onSeguir={(on) => sesion.seguir(on)}
        />
      {:else}
        <PanelVivo {corrida} />
      {/if}
    </aside>
  </div>

  {#if estado.aviso}
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
          <rect x="2" y="1" width="3.5" height="12" rx="1" fill="#ffffff"></rect>
          <rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="#ffffff"></rect>
        </svg>{t('mundo.pausar')}
      {:else}
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 1.5v11l9-5.5z" fill="#ffffff"></path>
        </svg>{t('mundo.iniciar')}
      {/if}
    </button>
    <button class="btn" type="button" disabled={!sesion.hayMundo} onclick={() => sesion.unCiclo()}>
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
      title={t('observar.sembrar.ayuda')}
      disabled={!sesion.hayMundo}
      onclick={() => (verSembrar = true)}
    >
      {t('observar.sembrar')}
    </button>
    <button
      class="btn"
      class:activo={verMundo}
      type="button"
      title={t('mundoObj.boton.ayuda')}
      aria-pressed={verMundo}
      disabled={!sesion.hayMundo && !verMundo}
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
      title={t('observar.instantanea.ayuda')}
      disabled={!sesion.hayMundo}
      onclick={instantanea}
    >
      {t('observar.instantanea')}
    </button>
    <button
      class="btn"
      type="button"
      title={t('observar.corridas.ayuda')}
      disabled={!!estado.ocupado}
      onclick={() => (verCorridas = true)}
    >
      {t('observar.corridas')}
    </button>
    <div class="relleno"></div>
    <span class="mono dato" title={t('observar.ritmo.ayuda')}
      >{t('observar.ritmo', { tps: num(sesion.stats.tps), fps: num(sesion.fps) })}</span
    >
    <label class="campo"
      >{t('mundo.vista')}
      <select
        class="sel"
        value={sesion.rica ? 'rica' : 'clasica'}
        onchange={(e) => sesion.ponerVista(e.currentTarget.value === 'rica')}
      >
        <option value="rica">{t('mundo.vista.rica.corta')}</option>
        <option value="clasica">{t('mundo.vista.clasica.corta')}</option>
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  z-index: 3;
}
.aviso.error {
  border-color: #d9a39a;
  background: #fbeeec;
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
.velocidad {
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
