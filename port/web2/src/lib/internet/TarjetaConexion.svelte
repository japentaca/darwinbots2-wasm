<script>
// @ts-check
// Tarjeta «Conexión» de Experimentar (paso N3.9, decisión 16): Internet Mode
// de la sim actual. Apodo (vacío = la sim sortea «Newbie N»), transporte
// (pestañas de este navegador o relay WebSocket), sala, conectar/desconectar
// y el estado del cliente. El apodo cambia en vivo; transporte y sala, al
// reconectar.
import { idioma, num, t } from '../../i18n/index.svelte.js';
import { clavePlural } from '../experimentar/borrador.js';
import { actual } from '../sim/corrida.svelte.js';
import { estadoIM, internet } from './estado.svelte.js';
import {
  APODO_MAX,
  claveEstado,
  guardarPrefs,
  leerPrefs,
  normalizarApodo,
  SALA_MAX,
  urlPorDefecto,
  validarFormulario,
} from './tarjeta.js';
import { textoError } from './textos.js';

const loc = globalThis.location;
const protocolo = loc?.protocol ?? '';
/** @returns {Storage | null} */
function almacen() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const inicial = leerPrefs(almacen(), urlPorDefecto(loc));
let apodo = $state(inicial.apodo);
/** @type {'bc' | 'ws'} */
let tipo = $state(inicial.tipo);
let url = $state(inicial.url);
let sala = $state(inicial.sala);
/** se intentó conectar con errores: se muestran */
let intento = $state(false);

const e = $derived(estadoIM.e);
const hayMundo = $derived(!!actual.corrida?.sesion.hayMundo);
const validacion = $derived(validarFormulario({ apodo, tipo, url, sala }, protocolo));
/** @param {'apodo' | 'url' | 'sala'} campo */
const errorDe = (campo) =>
  validacion.ok ? '' : (validacion.errores.find((x) => x.campo === campo)?.clave ?? '');
const verErrores = $derived(intento || !validacion.ok);
/** transporte o sala distintos de los de la conexión activa */
const difiere = $derived(
  e.activo &&
    validacion.ok &&
    (validacion.cfg.tipo !== e.tipo ||
      validacion.cfg.sala !== e.sala ||
      (validacion.cfg.tipo === 'ws' && validacion.cfg.url !== e.url)),
);

/** @param {string} k @param {number} n @param {Record<string, string | number>} [p] */
const tn = (k, n, p) => t(clavePlural(k, n, idioma()), { ...p, n: num(n) });

function guardar() {
  guardarPrefs(almacen(), { apodo: normalizarApodo(apodo), tipo, url: url.trim(), sala: sala.trim() });
}

// El «Newbie N» que sorteó la sim vuelve al campo (y a las preferencias).
$effect(() => {
  const n = e.nombre;
  if (e.activo && n && !normalizarApodo(apodo)) {
    apodo = n;
    guardar();
  }
});

function conectar() {
  intento = true;
  if (!validacion.ok) return;
  guardar();
  internet().conectar(validacion.cfg);
}

function desconectar() {
  internet().desconectar();
}

function alCambiarApodo() {
  if (errorApodoActual) return;
  guardar();
  if (e.activo) {
    const n = normalizarApodo(apodo);
    // Vacío con la conexión activa: sigue el apodo actual (el sorteo es al conectar).
    if (n && n !== e.nombre) internet().ponerApodo(n);
  }
}
const errorApodoActual = $derived(errorDe('apodo'));

/** @param {'bc' | 'ws'} x */
function ponerTipo(x) {
  tipo = x;
  guardar();
}

const estadoTexto = $derived(t(claveEstado(e)));
</script>

<section class="card grupo conexion" aria-labelledby="im-titulo">
  <div class="lh">
    <h2 id="im-titulo">{t('internet.titulo')}</h2>
    <span class="live">{t('internet.vivo')}</span>
  </div>
  <p class="help">{t('internet.ayuda')}</p>

  <div class="campo">
    <label for="im-apodo">{t('internet.apodo')}</label>
    <input
      id="im-apodo"
      class="inp"
      class:mal={verErrores && !!errorApodoActual}
      type="text"
      maxlength={APODO_MAX}
      placeholder={t('internet.apodo.vacio')}
      bind:value={apodo}
      onchange={alCambiarApodo}
    >
    {#if verErrores && errorApodoActual}
      <span class="err">{textoError({ clave: errorApodoActual }, t)}</span>
    {:else}
      <span class="help">{t('internet.apodo.ayuda')}</span>
    {/if}
  </div>

  <div class="campo">
    <span id="im-tipo-n">{t('internet.transporte')}</span>
    <fieldset class="seg" aria-labelledby="im-tipo-n">
      <button type="button" class:on={tipo === 'bc'} aria-pressed={tipo === 'bc'} onclick={() => ponerTipo('bc')}>
        {t('internet.transporte.pestanas')}
      </button>
      <button type="button" class:on={tipo === 'ws'} aria-pressed={tipo === 'ws'} onclick={() => ponerTipo('ws')}>
        {t('internet.transporte.relay')}
      </button>
    </fieldset>
    <span class="help"
      >{t(tipo === 'ws' ? 'internet.transporte.relay.ayuda' : 'internet.transporte.pestanas.ayuda')}</span
    >
  </div>

  {#if tipo === 'ws'}
    <div class="campo">
      <label for="im-url">{t('internet.url')}</label>
      <input
        id="im-url"
        class="inp mono"
        class:mal={verErrores && !!errorDe('url')}
        type="text"
        spellcheck="false"
        autocomplete="off"
        bind:value={url}
        onchange={guardar}
      >
      {#if verErrores && errorDe('url')}
        <span class="err">{textoError({ clave: errorDe('url') }, t)}</span>
      {:else}
        <span class="help">{t('internet.url.ayuda', { url: urlPorDefecto(loc) })}</span>
      {/if}
    </div>
  {/if}

  <div class="campo">
    <label for="im-sala">{t('internet.sala')}</label>
    <input
      id="im-sala"
      class="inp"
      class:mal={verErrores && !!errorDe('sala')}
      type="text"
      maxlength={SALA_MAX}
      placeholder="public"
      bind:value={sala}
      onchange={guardar}
    >
    {#if verErrores && errorDe('sala')}
      <span class="err">{textoError({ clave: errorDe('sala') }, t)}</span>
    {:else}
      <span class="help">{t('internet.sala.ayuda')}</span>
    {/if}
  </div>

  <div class="estado" role="status">
    <span class="punto" class:on={e.activo && e.paresVivos > 0} class:act={e.activo}></span>
    <span>
      <strong>{estadoTexto}</strong>
      {#if e.activo}
        · {tn('internet.pares.vivos', e.paresVivos)}
        {#if e.puerto}
          · {t('internet.puerto', { n: num(e.puerto) })}
        {/if}
      {/if}
    </span>
  </div>
  {#if e.activo}
    <p class="help">
      {t('internet.como', { nombre: e.nombre, sala: e.sala })}
      {#if e.enlace === 'error' && e.detalle}
        <span class="mono">({e.detalle})</span>
      {/if}
    </p>
    <p class="help">
      {t('internet.totales', {
        salieron: num(e.totales.salieron),
        llegaron: num(e.totales.llegaron),
        confirmados: num(e.totales.confirmados),
      })}
      {#if e.colas.esperan}
        · {tn('internet.colas.esperan', e.colas.esperan)}
      {/if}
      {#if e.colas.bandeja}
        · {t('internet.colas.bandeja', { n: num(e.colas.bandeja) })}
      {/if}
      {#if e.totales.descartados}
        · {t('internet.colas.descartados', { n: num(e.totales.descartados) })}
      {/if}
    </p>
  {/if}
  {#if e.sinPuerto}
    <p class="nota" role="alert">{t('internet.sinPuerto')}</p>
  {/if}
  {#if e.error}
    <p class="err" role="alert">{textoError(e.error, t)}</p>
  {/if}
  {#if !e.activo && e.apagadoPor === 'simNueva'}
    <p class="nota">{t('internet.apagado.simNueva')}</p>
  {:else if !e.activo && e.apagadoPor === 'externo'}
    <p class="nota">{t('internet.apagado.externo')}</p>
  {/if}
  {#if difiere}
    <p class="nota">{t('internet.difiere')}</p>
  {/if}

  <div class="par">
    {#if e.activo}
      <button class="btn sm" type="button" onclick={desconectar}>{t('internet.desconectar')}</button>
      {#if e.sinPuerto || difiere}
        <button class="btn sm pri" type="button" disabled={!hayMundo} onclick={conectar}>
          {t('internet.reconectar')}
        </button>
      {/if}
    {:else}
      <button
        class="btn sm pri"
        type="button"
        disabled={!hayMundo || e.pedido}
        onclick={conectar}
      >
        {e.pedido ? t('internet.conectando') : t('internet.conectar')}
      </button>
    {/if}
  </div>
  {#if !hayMundo && !e.activo}
    <p class="help">{t('internet.sinSim')}</p>
  {/if}
</section>

<style>
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
.lh {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}
.live {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  white-space: nowrap;
  color: #0a3f3a;
}
.live::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--acento);
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 5px;
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
  min-width: 0;
}
.inp.mono {
  font-family: var(--mono);
  font-size: 13px;
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
.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--gris);
}
.err {
  margin: 0;
  font-size: 12px;
  color: #a5281b;
}
.nota {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
}
.estado {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #b9b7ae;
  flex-shrink: 0;
}
.punto.act {
  background: #e0b050;
}
.punto.on {
  background: var(--acento);
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
</style>
