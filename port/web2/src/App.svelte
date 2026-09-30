<script>
// @ts-check
import { untrack } from 'svelte';
import { idioma, t } from './i18n/index.svelte.js';
import AvisoConstruccion from './lib/AvisoConstruccion.svelte';
import BarraSuperior from './lib/BarraSuperior.svelte';
import { actual } from './lib/sim/corrida.svelte.js';
import { escucharHash, parsearHash } from './router.js';
import Inicio from './screens/Inicio.svelte';

// N4.4: Inicio va en el chunk principal; las demás pantallas se cargan la
// primera vez que se abren (un chunk por pantalla, import() dinámico).
/** @type {Record<string, () => Promise<{default: any}>>} */
const CARGAS = {
  observar: () => import('./screens/Observar.svelte'),
  experimentar: () => import('./screens/Experimentar.svelte'),
  analizar: () => import('./screens/Analizar.svelte'),
  bots: () => import('./screens/Bots.svelte'),
  competir: () => import('./screens/Competir.svelte'),
};

/** Pantallas ya cargadas, por sección. */
let cargadas = $state.raw(/** @type {Record<string, any>} */ ({ inicio: Inicio }));
/** Secciones cuya carga falló (se reintenta al volver a entrar o al pulsar
 * otra vez su pestaña; tras un deploy, src/main.js ya recargó una vez). */
let fallidas = $state.raw(/** @type {Record<string, boolean>} */ ({}));
/** @type {Map<string, Promise<void>>} */
const enVuelo = new Map();

/** @param {string} seccion */
function cargar(seccion) {
  const f = CARGAS[seccion];
  if (!f || cargadas[seccion] || enVuelo.has(seccion)) return;
  const { [seccion]: _, ...resto } = fallidas;
  fallidas = resto;
  const p = f()
    .then((m) => {
      cargadas = { ...cargadas, [seccion]: m.default };
    })
    .catch((e) => {
      console.error(e);
      fallidas = { ...fallidas, [seccion]: true };
    })
    .finally(() => enVuelo.delete(seccion));
  enVuelo.set(seccion, p);
}

let ruta = $state(parsearHash(window.location.hash));

$effect(() => escucharHash((r) => (ruta = r)));

$effect(() => {
  document.documentElement.lang = idioma();
  document.title = t('app.nombre');
});

$effect(() => {
  const s = ruta.seccion;
  untrack(() => cargar(s));
});

const Actual = $derived(cargadas[ruta.seccion]);
</script>

<div class="app">
  <BarraSuperior seccion={ruta.seccion} onMismaSeccion={cargar} />
  <AvisoConstruccion />
  <main id="principal">
    {#if Actual}
      <Actual partes={ruta.partes} />
    {:else if fallidas[ruta.seccion]}
      <div class="carga" role="alert">
        <p>{t('app.errorCarga')}</p>
        {#if actual.corrida}
          <p class="nueva">{t('app.versionNueva')}</p>
        {/if}
        <button class="btn" type="button" onclick={() => window.location.reload()}>
          {t('app.recargar')}
        </button>
      </div>
    {:else}
      <div class="carga cargando" role="status" aria-live="polite">
        <span class="giro" aria-hidden="true"></span>{t('app.cargando')}
      </div>
    {/if}
  </main>
</div>

<style>
/* La app ocupa la ventana: las pantallas con mundo (Observar) llenan el alto
   y las demás hacen scroll dentro de <main>. */
.app {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}
main {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.carga {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  color: var(--gris);
  font-size: 14px;
  text-align: center;
}
.carga p {
  margin: 0;
  max-width: 480px;
}
.nueva {
  color: var(--texto);
  font-weight: 500;
}
/* Se ve solo si la carga tarda (sin parpadeo en cargas rápidas). */
.cargando {
  flex-direction: row;
  opacity: 0;
  animation: aparecer 0.2s ease 0.15s forwards;
}
.giro {
  width: 16px;
  height: 16px;
  border: 2px solid var(--borde-control);
  border-top-color: var(--acento);
  border-radius: 50%;
  animation: girar 0.8s linear infinite;
}
@keyframes aparecer {
  to {
    opacity: 1;
  }
}
@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .giro {
    animation: none;
  }
}
</style>
