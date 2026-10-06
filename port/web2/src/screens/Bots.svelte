<script>
// @ts-check
// Bots (Nivel 3, paso N3.2; decisiones 17-20): la biblioteca a la izquierda
// y la ficha del bot elegido. Rutas (src/lib/bots/ruta.js):
//   #/bots                       la biblioteca
//   #/bots/nuevo[?adn=…]         bot nuevo (con ese ADN; «Abrir en la app»
//                                del manual, S10 de PLAN-SITIO.md)
//   #/bots/<nombre|clave>        la ficha (Resumen)
//   #/bots/<nombre|clave>/adn    ADN (editor)   …/historial  Historial
import { onMount } from 'svelte';
import { t } from '../i18n/index.svelte.js';
import AvisoMigracion from '../lib/bots/AvisoMigracion.svelte';
import Biblioteca from '../lib/bots/Biblioteca.svelte';
import { asegurarBiblioteca, bib } from '../lib/bots/biblioteca.svelte.js';
import DialogoConfirmar from '../lib/bots/DialogoConfirmar.svelte';
import Ficha from '../lib/bots/Ficha.svelte';
import { leerRuta, resolverClave } from '../lib/bots/ruta.js';
import { estadoAlmacen } from '../lib/sim/almacen.svelte.js';
import { hashDe } from '../router.js';

/** @type {{ partes?: string[], consulta?: Record<string, string> }} */
let { partes = [], consulta = {} } = $props();

const ruta = $derived(leerRuta(partes));
// `nuevo` es una palabra reservada de la ruta: nunca busca un bot así
// llamado; abre el diálogo de bot nuevo con el ADN de la consulta.
const esNuevo = $derived(ruta.clave === 'nuevo');
const entrada = $derived(esNuevo ? null : resolverClave(bib.indice, ruta.clave));

onMount(() => {
  asegurarBiblioteca();
});
</script>

<div class="bots">
  <Biblioteca actual={entrada} abrirNuevo={esNuevo ? (consulta.adn ?? '') : undefined} />
  <section class="principal">
    {#if estadoAlmacen.versionVieja}
      <div class="aviso error" role="alert">{t('bots.error.almacen.version-vieja')}</div>
    {:else if estadoAlmacen.bloqueado}
      <div class="aviso error" role="alert">{t('bots.almacen.bloqueado')}</div>
    {:else if bib.errorAlmacen}
      <div class="aviso error" role="alert">
        {t('bots.almacen.fallo', { detalle: t(bib.errorAlmacen.clave, bib.errorAlmacen.params) })}
      </div>
    {/if}
    {#if bib.errorForo && bib.listo}
      <div class="aviso error" role="alert">
        {t('bots.foro.fallo', { detalle: t(bib.errorForo.clave, bib.errorForo.params) })}
      </div>
    {/if}
    <AvisoMigracion />
    {#if bib.aviso}
      <div class="aviso" class:error={bib.aviso.error} role="status">
        <div class="txt">
          <span>{t(bib.aviso.clave, bib.aviso.params)}</span>
          {#if bib.aviso.lineas?.length}
            <ul>
              {#each bib.aviso.lineas as l, i (i)}
                <li>{t(l.clave, l.params)}</li>
              {/each}
            </ul>
          {/if}
        </div>
        <button
          class="cerrar"
          type="button"
          aria-label={t('bots.cerrar')}
          onclick={() => (bib.aviso = null)}
        >
          ×
        </button>
      </div>
    {/if}
    {#if entrada}
      <Ficha {entrada} pestana={ruta.pestaña} />
    {:else if esNuevo}
      <div class="vacio">
        <h2>{t('bots.nuevoRuta.titulo')}</h2>
        <p>{t('bots.nuevoRuta.texto')}</p>
      </div>
    {:else if bib.error}
      <p class="vacio" role="alert">{t(bib.error.clave, bib.error.params)}</p>
    {:else if !bib.listo}
      <p class="vacio">{t('bots.cargando')}</p>
    {:else if ruta.clave}
      <div class="vacio">
        <p>{t('bots.ficha.noEncontrado', { clave: ruta.clave })}</p>
        <a href={hashDe('bots')}>{t('bots.ficha.volver')}</a>
      </div>
    {:else}
      <div class="vacio">
        <h2>{t('bots.inicio.titulo')}</h2>
        <p>{t('bots.inicio.texto')}</p>
      </div>
    {/if}
  </section>
</div>
<DialogoConfirmar />

<style>
.bots {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}
.principal {
  padding: 18px 26px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.aviso {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 13px;
  line-height: 1.45;
}
.aviso.error {
  background: var(--error-fondo);
  border-color: var(--error-borde);
  color: var(--error-texto);
}
.txt {
  flex: 1;
}
ul {
  margin: 4px 0 0;
  padding-left: 18px;
}
.cerrar {
  font: inherit;
  font-size: 18px;
  line-height: 1;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.vacio {
  color: var(--gris);
  font-size: 14px;
  line-height: 1.5;
  max-width: 560px;
}
.vacio h2 {
  color: var(--texto);
  font-size: 20px;
  margin: 8px 0 4px;
}
@media (max-width: 800px) {
  .bots {
    grid-template-columns: 1fr;
    height: auto;
  }
  .principal {
    overflow: visible;
    padding: 16px;
  }
}
</style>
