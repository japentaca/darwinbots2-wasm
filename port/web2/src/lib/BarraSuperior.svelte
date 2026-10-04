<script>
// @ts-check
import { BUILD_ID } from '../build.js';
import { idioma, idiomas, num, setIdioma, t } from '../i18n/index.svelte.js';
import { hashDe, SECCIONES } from '../router.js';
import { clavePlural } from './experimentar/borrador.js';
import { cicloVisible } from './sim/ciclo.js';
import { actual } from './sim/corrida.svelte.js';
import { TEMAS } from './tema.js';
import { setTema, tema } from './tema.svelte.js';
import { ACTIVOS, DESTINO_COMPARAR, destinoChip } from './trabajos/destino.js';

/**
 * `onMismaSeccion`: al pulsar la pestaña de la sección en la que ya se está
 * (sin hashchange); App reintenta la carga si falló.
 * @type {{ seccion: import('../router.js').Seccion,
 *   onMismaSeccion?: (s: import('../router.js').Seccion) => void }}
 */
let { seccion, onMismaSeccion } = $props();

// Estado de la corrida (N1.3): solo si ya existe (no crea la sim).
const estadoSim = $derived.by(() => {
  const c = actual.corrida;
  if (!c) return null;
  if (!c.sesion.hayMundo || c.estado.ocupado === 'iniciando')
    return { on: false, texto: t('observar.estado.preparando') };
  if (c.sesion.corriendo)
    return {
      on: true,
      texto: t('observar.estado.corriendo', { nombre: c.estado.nombre || t('observar.sinNombre') }),
    };
  return {
    on: false,
    texto: t('observar.estado.pausa', { n: num(cicloVisible(c.sesion.stats.cycle)) }),
  };
});

// Trabajos en segundo plano (réplicas, decisión 10): en curso y avisos de
// los que terminaron. Lleva a Analizar › Comparar (réplicas) o a Competir
// (rondas de torneo): trabajos/destino.js; el destino y el title siguen al
// texto (en curso → el trabajo en cola; si no, el último aviso). La cola se carga aparte
// (import dinámico, como en src/main.js: no va en el chunk principal).
/** @type {typeof import('./trabajos/trabajos.svelte.js').estadoTrabajos | null} */
let estadoTrabajos = $state.raw(null);
import('./trabajos/trabajos.svelte.js')
  .then((m) => {
    estadoTrabajos = m.estadoTrabajos;
  })
  .catch((e) => console.error(e));

// Selector de idioma (N4.5): si el idioma elegido no baja (sin red, deploy
// nuevo) y no se recargó la página (hay una corrida en memoria o ya recargó
// una vez), aviso visible y anunciado; la región viva está siempre, vacía
// sin aviso, para que el lector la anuncie al llenarse.
/** @type {string | null} */
let idiomaFallido = $state(null);

/** @param {string} cod */
async function elegirIdioma(cod) {
  idiomaFallido = null;
  if (!(await setIdioma(cod, { hayCorrida: !!actual.corrida }))) idiomaFallido = cod;
}

const trabajos = $derived.by(() => {
  const et = estadoTrabajos;
  if (!et) return null;
  const n = et.lista.filter((x) => ACTIVOS.includes(x.estado)).length;
  const avisos = et.avisos.length;
  if (!n && !avisos) return null;
  const destino = destinoChip(et.lista, et.avisos);
  /** @param {string} k @param {number} x */
  const tn = (k, x) => t(clavePlural(k, x, idioma()), { n: num(x) });
  return {
    on: n > 0,
    texto: n ? tn('comparar.chip.enCurso', n) : tn('comparar.chip.avisos', avisos),
    destino,
    ayuda:
      destino === DESTINO_COMPARAR ? t('comparar.chip.ayuda') : t('app.trabajos.ayudaCompetir'),
  };
});
</script>

<nav class="nav" aria-label={t('app.nav.aria')}>
  <a
    class="logo"
    href={hashDe('inicio')}
    title={`${t('app.inicio')} · ${t('app.version', { v: BUILD_ID })}`}
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6fd3c5"
      stroke-width="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8"></circle>
      <circle cx="15" cy="10" r="1.6"></circle>
      <path d="M12 4v3"></path>
    </svg>
    {t('app.nombre')}
  </a>
  {#each SECCIONES as s (s)}
    <a
      class="tab"
      class:on={s === seccion}
      href={hashDe(s)}
      aria-current={s === seccion ? 'page' : undefined}
      onclick={() => {
  if (s === seccion) onMismaSeccion?.(s);
}}
      >{t(`app.nav.${s}`)}</a
    >
  {/each}
  <div class="relleno"></div>
  {#if trabajos}
    <a
      class="estado trabajos"
      class:on={trabajos.on}
      class:aviso={!trabajos.on}
      href={trabajos.destino}
      title={trabajos.ayuda}
      ><span class="punto"></span>{trabajos.texto}</a
    >
  {/if}
  {#if estadoSim}
    <a class="estado" class:on={estadoSim.on} href={hashDe('observar')}
      ><span class="punto"></span>{estadoSim.texto}</a
    >
  {/if}
  <fieldset class="idiomas">
    <legend class="oculto">{t('app.idioma.aria')}</legend>
    {#each idiomas as cod (cod)}
      <button
        class="lang"
        class:on={idioma() === cod}
        type="button"
        lang={cod}
        title={t(`app.idioma.${cod}`)}
        aria-pressed={idioma() === cod}
        onclick={() => elegirIdioma(cod)}
      >
        {cod.toUpperCase()}
      </button>
    {/each}
  </fieldset>
  <fieldset class="temas">
    <legend class="oculto">{t('app.tema.aria')}</legend>
    {#each TEMAS as tm (tm)}
      <button
        class="tema"
        class:on={tema() === tm}
        type="button"
        title={t(`app.tema.${tm}`)}
        aria-label={t(`app.tema.${tm}`)}
        aria-pressed={tema() === tm}
        onclick={() => setTema(tm)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          {#if tm === 'auto'}
            <circle cx="8" cy="8" r="5.5"></circle>
            <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"></path>
          {:else if tm === 'claro'}
            <circle cx="8" cy="8" r="3"></circle>
            <path
              d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"
            ></path>
          {:else}
            <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"></path>
          {/if}
        </svg>
      </button>
    {/each}
  </fieldset>
  <span class="aviso-idioma" role="status" aria-live="polite"
    >{idiomaFallido ? t('app.idioma.error', { idioma: t(`app.idioma.${idiomaFallido}`) }) : ''}</span
  >
  <a class="clasica" href="./classic/">{t('app.clasica.enlace')}</a>
</nav>

<style>
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 56px;
  padding: 0 24px;
  background: var(--barra);
  border-bottom: 1px solid var(--barra-borde);
  color: var(--barra-texto);
  box-sizing: border-box;
  overflow-x: auto;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ffffff;
  text-decoration: none;
  font-weight: 700;
  font-size: 16px;
  margin-right: 20px;
  flex-shrink: 0;
}
.logo:hover {
  color: #ffffff;
}
.tab {
  color: var(--barra-texto);
  text-decoration: none;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}
.tab:hover {
  color: #ffffff;
  background: var(--barra-hover);
}
.tab.on {
  color: #ffffff;
  background: var(--barra-activa);
}
.relleno {
  flex-grow: 1;
}
.estado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  background: #2a2a27;
  color: var(--barra-texto);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
  flex-shrink: 1;
  min-width: 0;
}
.estado:hover {
  color: #ffffff;
}
.estado.on {
  background: #23302e;
  color: #bfe9e2;
}
.punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8a887f;
  flex-shrink: 0;
}
.estado.on .punto {
  background: #6fd3c5;
}
.trabajos {
  margin-right: 8px;
}
.trabajos.aviso .punto {
  background: #e0b050;
}
.idiomas {
  display: flex;
  margin: 0 0 0 16px;
  padding: 0;
  border: 0;
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
.lang {
  font: inherit;
  font-size: 13px;
  background: transparent;
  border: 0;
  color: var(--barra-texto);
  padding: 8px 6px;
  cursor: pointer;
}
.lang:hover {
  color: #ffffff;
}
.lang.on {
  color: #ffffff;
  font-weight: 600;
}
.temas {
  display: flex;
  margin: 0 0 0 12px;
  padding: 0;
  border: 0;
  min-width: 0;
}
.tema {
  display: inline-flex;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--barra-texto);
  padding: 6px;
  cursor: pointer;
}
.tema:hover {
  color: #ffffff;
  background: var(--barra-hover);
}
.tema.on {
  color: #ffffff;
  background: var(--barra-activa);
}
.aviso-idioma {
  color: #e0b050;
  font-size: 12px;
  margin-left: 6px;
}
.aviso-idioma:empty {
  display: none;
}
.clasica {
  color: var(--barra-texto);
  font-size: 13px;
  margin-left: 12px;
  flex-shrink: 0;
}
.clasica:hover {
  color: #ffffff;
}
</style>
