// @ts-check
import { mount } from 'svelte';
import App from './App.svelte';
import { iniciarTrabajos } from './lib/trabajos/trabajos.svelte.js';
import './app.css';

const destino = document.getElementById('app');
if (!destino) throw new Error('#app');
// Si la carga tardó y ya se mostró el aviso de index.html, se quita.
destino.replaceChildren();

const app = mount(App, { target: destino });

// La cola de trabajos (réplicas) se reanuda al arrancar la app, no al abrir
// Comparar (C20: la corre una sola pestaña).
iniciarTrabajos();

export default app;
