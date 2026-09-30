<script>
// @ts-check
// Miniatura de la corrida en memoria: un lienzo chico con los bots del
// último frame (a lo sumo uno por segundo). Con la sim en pausa pide un
// frame fresco al montar. Mientras no llegó ningún frame, la miniatura
// guardada (si la hay); un frame sin bots es un mundo vacío, no la vieja.
import { untrack } from 'svelte';
import { puntosDeFrame } from './vista.js';

/**
 * @type {{
 *   sesion: import('../sim/sesion.svelte.js').Sesion,
 *   respaldo?: string | null,
 *   alt: string,
 * }}
 */
let { sesion, respaldo = null, alt } = $props();

const ANCHO = 300;
const ALTO = 150;
const PERIODO_MS = 1000;

/** null = todavía no llegó ningún frame @type {import('./vista.js').Punto[] | null} */
let puntos = $state.raw(null);
/** @type {HTMLCanvasElement | undefined} */
let lienzo = $state();

$effect(() => {
  let ultimo = -Infinity;
  const baja = sesion.c.on('frame', (/** @type {any} */ ev) => {
    const ahora = performance.now();
    if (ahora - ultimo < PERIODO_MS) return;
    ultimo = ahora;
    try {
      puntos = puntosDeFrame(ev.frame);
    } catch {
      // Un frame raro no rompe Inicio: queda la miniatura anterior.
    }
  });
  untrack(() => {
    if (!sesion.corriendo) sesion.redibujar();
  });
  return baja;
});

$effect(() => {
  const c = lienzo;
  if (!c) return;
  const dpr = globalThis.devicePixelRatio || 1;
  c.width = Math.round(ANCHO * dpr);
  c.height = Math.round(ALTO * dpr);
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0e0f0f';
  ctx.fillRect(0, 0, ANCHO, ALTO);
  for (const p of puntos ?? []) {
    const r = Math.max(1.2, Math.min(5, p.r * ALTO));
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.veg ? 0.85 : 1;
    ctx.beginPath();
    ctx.arc(p.x * ANCHO, p.y * ALTO, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
});
</script>

{#if puntos === null && respaldo}
  <img src={respaldo} {alt}>
{:else}
  <div class="lienzo" role="img" aria-label={alt}>
    <canvas bind:this={lienzo}></canvas>
  </div>
{/if}

<style>
.lienzo,
canvas,
img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
