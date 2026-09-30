<script>
// @ts-check
// Lista de la cola de trabajos (decisión 10): estado, progreso, cancelar,
// reintentar, borrar; los avisos de los que terminaron y el botón para
// pedir el permiso de notificación. Genérica: `tipo` filtra (réplicas hoy;
// rondas de torneo, decisión 23, mañana). Las acciones valen en cualquier
// pestaña (C20: si otra corre la cola, se le piden a ella).
import { num, t } from '../../i18n/index.svelte.js';
import { textoError } from './textos.js';
import {
  descartarAviso,
  estadoTrabajos,
  iniciarTrabajos,
  pedirPermiso,
} from './trabajos.svelte.js';

/** @type {{ tipo?: string, seleccion?: string, titulo: string }} */
let { tipo, seleccion = $bindable(''), titulo } = $props();

const lista = $derived(
  estadoTrabajos.lista
    .filter((x) => !tipo || x.tipo === tipo)
    .slice()
    .reverse(),
);
const avisos = $derived(estadoTrabajos.avisos.filter((a) => lista.some((x) => x.id === a.id)));

/** @param {import('../../../engine/cola.js').Trabajo} x */
const hechas = (x) => x.unidades.filter((u) => u.estado === 'hecha').length;
/** @param {import('../../../engine/cola.js').Trabajo} x */
const avance = (x) => x.unidades.reduce((s, u) => s + u.progreso, 0) / x.unidades.length;

let errorAccion = $state('');

/**
 * Corre una acción de la cola y muestra su error, si falla.
 * @param {'cancelar' | 'reintentar' | 'borrar'} accion @param {string} id
 */
async function hacer(accion, id) {
  errorAccion = '';
  try {
    await iniciarTrabajos()[accion](id);
  } catch (e) {
    const x = /** @type {any} */ (e);
    errorAccion = textoError(t, x?.codigo, String(x?.message ?? x));
  }
}

/** @param {string} id */
async function borrar(id) {
  if (!confirm(t('comparar.trabajos.confirmarBorrar'))) return;
  if (seleccion === id) seleccion = '';
  descartarAviso(id);
  await hacer('borrar', id);
}
</script>

<section class="card lista">
  <h2>{titulo}</h2>
  {#each avisos as a (a.id)}
    <div class="aviso" role="status">
      <span>
        {t(a.estado === 'terminado' ? 'comparar.aviso.terminado' : 'comparar.aviso.fallido', {
  titulo: a.titulo,
})}
      </span>
      <button type="button" class="btn chico" onclick={() => (seleccion = a.id)}>
        {t('comparar.trabajos.ver')}
      </button>
      <button type="button" class="btn chico" onclick={() => descartarAviso(a.id)}>
        {t('comparar.aviso.descartar')}
      </button>
    </div>
  {/each}

  {#if !lista.length}
    <p class="nota">{t('comparar.rep.ninguno')}</p>
  {:else}
    <ul>
      {#each lista as x (x.id)}
        <li class:sel={x.id === seleccion}>
          <button type="button" class="titulo" onclick={() => (seleccion = x.id)}>
            {x.titulo || t('comparar.trabajos.sinTitulo')}
          </button>
          <span class="chip">{t(`comparar.trabajos.estado.${x.estado}`)}</span>
          <span class="mono cuenta">
            {t('comparar.trabajos.progreso', {
  hechas: num(hechas(x)),
  total: num(x.unidades.length),
})}
          </span>
          <progress max="1" value={avance(x)}></progress>
          <span class="acciones">
            {#if x.estado === 'pendiente' || x.estado === 'corriendo'}
              <button type="button" class="btn chico" onclick={() => hacer('cancelar', x.id)}>
                {t('comparar.trabajos.cancelar')}
              </button>
            {/if}
            {#if x.estado === 'fallido' || x.estado === 'cancelado'}
              <button type="button" class="btn chico" onclick={() => hacer('reintentar', x.id)}>
                {t('comparar.trabajos.reintentar')}
              </button>
            {/if}
            <button type="button" class="btn chico" onclick={() => borrar(x.id)}>
              {t('comparar.trabajos.borrar')}
            </button>
          </span>
          {#if x.error}
            <span class="error">{textoError(t, x.codigo, x.error)}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if errorAccion}
    <p class="error" role="alert">{errorAccion}</p>
  {/if}
  {#if lista.length && !estadoTrabajos.duena}
    <p class="nota">{t('comparar.trabajos.otraPestana')}</p>
  {/if}
  <p class="nota">
    {t('comparar.trabajos.reanudan')}
    {#if estadoTrabajos.permiso === 'default'}
      <button type="button" class="btn chico" onclick={pedirPermiso}>
        {t('comparar.aviso.permitir')}
      </button>
    {:else if estadoTrabajos.permiso === 'granted'}
      {t('comparar.aviso.permitido')}
    {:else if estadoTrabajos.permiso === 'denied'}
      {t('comparar.aviso.denegado')}
    {/if}
  </p>
  {#if estadoTrabajos.error}
    <p class="error">{t('comparar.trabajos.error', { detalle: estadoTrabajos.error })}</p>
  {/if}
</section>

<style>
.lista {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h2 {
  margin: 0;
  font-size: 15px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
}
li.sel {
  background: var(--hover-claro);
}
.titulo {
  font: inherit;
  font-weight: 500;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: var(--acento);
  text-align: left;
}
.cuenta {
  font-size: 12px;
  color: var(--gris);
}
progress {
  width: 120px;
}
.acciones {
  display: inline-flex;
  gap: 6px;
  margin-left: auto;
}
.btn.chico {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 13px;
}
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.error {
  color: #9b2c2c;
  font-size: 12px;
  width: 100%;
}
</style>
