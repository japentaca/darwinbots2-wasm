<script>
// @ts-check
import { idioma, t } from './i18n/index.svelte.js';
import AvisoConstruccion from './lib/AvisoConstruccion.svelte';
import BarraSuperior from './lib/BarraSuperior.svelte';
import { escucharHash, parsearHash } from './router.js';
import Analizar from './screens/Analizar.svelte';
import Bots from './screens/Bots.svelte';
import Competir from './screens/Competir.svelte';
import Experimentar from './screens/Experimentar.svelte';
import Inicio from './screens/Inicio.svelte';
import Observar from './screens/Observar.svelte';

const PANTALLAS = {
  inicio: Inicio,
  observar: Observar,
  experimentar: Experimentar,
  analizar: Analizar,
  bots: Bots,
  competir: Competir,
};

let ruta = $state(parsearHash(window.location.hash));

$effect(() => escucharHash((r) => (ruta = r)));

$effect(() => {
  document.documentElement.lang = idioma();
  document.title = t('app.nombre');
});

const Actual = $derived(PANTALLAS[ruta.seccion]);
</script>

<div class="app">
  <BarraSuperior seccion={ruta.seccion} />
  <AvisoConstruccion />
  <main>
    <Actual partes={ruta.partes} />
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
</style>
