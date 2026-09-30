<script>
// @ts-check
import { BUILD_ID } from '../build.js';
import { idioma, idiomas, num, setIdioma, t } from '../i18n/index.svelte.js';
import { hashDe, SECCIONES } from '../router.js';
import { rutaAnalizar } from './analizar/ruta.js';
import { clavePlural } from './experimentar/borrador.js';
import { cicloVisible } from './sim/ciclo.js';
import { actual } from './sim/corrida.svelte.js';
import { enCola, estadoTrabajos } from './trabajos/trabajos.svelte.js';

/** @type {{ seccion: import('../router.js').Seccion }} */
let { seccion } = $props();

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
// los que terminaron. Lleva a Analizar (la pestaña Comparar tiene la lista).
const trabajos = $derived.by(() => {
  const n = enCola(estadoTrabajos.lista);
  const avisos = estadoTrabajos.avisos.length;
  if (!n && !avisos) return null;
  /** @param {string} k @param {number} x */
  const tn = (k, x) => t(clavePlural(k, x, idioma()), { n: num(x) });
  return {
    on: n > 0,
    texto: n ? tn('comparar.chip.enCurso', n) : tn('comparar.chip.avisos', avisos),
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
      >{t(`app.nav.${s}`)}</a
    >
  {/each}
  <div class="relleno"></div>
  {#if trabajos}
    <a
      class="estado trabajos"
      class:on={trabajos.on}
      class:aviso={!trabajos.on}
      href={rutaAnalizar('actual', 'comparar')}
      title={t('comparar.chip.ayuda')}
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
        onclick={() => setIdioma(cod)}
      >
        {cod.toUpperCase()}
      </button>
    {/each}
  </fieldset>
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
  color: var(--fondo);
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
