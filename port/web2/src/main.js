// @ts-check
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { borrarMarcaRecarga, ESPERA_BORRAR_MARCA, recargarTrasFallo } from './lib/recarga.js';
import { actual } from './lib/sim/corrida.svelte.js';

// Fallo de import() tras un deploy (N4.4, lib/recarga.js): antes de los
// import() dinámicos, recarga UNA vez; si no (ya recargó o hay una corrida
// en memoria), el error sigue y App muestra la sección con Recargar.
window.addEventListener('vite:preloadError', (ev) => {
  if (!recargarTrasFallo(!!actual.corrida)) return;
  ev.preventDefault();
  window.location.reload();
});

const destino = document.getElementById('app');
if (!destino) throw new Error('#app');
// Si la carga tardó y ya se mostró el aviso de index.html, se quita.
destino.replaceChildren();

const app = mount(App, { target: destino });
setTimeout(() => borrarMarcaRecarga(), ESPERA_BORRAR_MARCA);

// Lo que arranca en segundo plano se carga aparte (import dinámico, N4.4):
// no va en el chunk principal ni demora la primera pantalla.
//
// La cola de trabajos (réplicas, rondas) se reanuda al arrancar la app, no
// al abrir Comparar (C20: la corre una sola pestaña).
import('./lib/trabajos/trabajos.svelte.js')
  .then((m) => m.iniciarTrabajos())
  .catch((e) => console.error(e));

// La primera vez, copia los bots, marcas y selecciones de la clásica
// (decisión 17); Bots avisa qué importó. Lo mismo con los torneos
// (darwinbots-ligas); Competir avisa y espera a que termine (si Competir
// se abre antes, la lanza él: iniciar y esperar son idempotentes).
import('./lib/bots/migracion.svelte.js')
  .then((m) => m.iniciarMigracion())
  .catch((e) => console.error(e));
import('./lib/competir/migracion.svelte.js')
  .then((m) => m.iniciarMigracionLigas())
  .catch((e) => console.error(e));

export default app;
