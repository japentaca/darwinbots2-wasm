<script>
// @ts-check
// Vista previa sintética de un escenario (puntos deterministas por sus
// especies y colores, y las siluetas de sus objetos).
import { puntosVista } from './vista.js';

/** @type {{ escenario: import('../../../engine/escenarios/index.js').Escenario }} */
let { escenario } = $props();

const W = 292;
const H = 96;
const vista = $derived(puntosVista(escenario, W, H));

/** Hexágono (vegetal) centrado en x, y. @param {number} x @param {number} y @param {number} r */
const hex = (x, y, r) =>
  [
    [-0.5, -0.9],
    [0.5, -0.9],
    [1, 0],
    [0.5, 0.9],
    [-0.5, 0.9],
    [-1, 0],
  ]
    .map(([a, b]) => `${(x + a * r).toFixed(1)},${(y + b * r).toFixed(1)}`)
    .join(' ');
</script>

<svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  {#each vista.muros as m, i (i)}
    <rect x={m.x} y={m.y} width={m.w} height={m.h} fill="#3a3b38"></rect>
  {/each}
  {#each vista.portales as p, i (i)}
    <circle
      cx={p.x}
      cy={p.y}
      r={p.r}
      fill="none"
      stroke="#6fd3c5"
      stroke-width="1.5"
      opacity="0.7"
    ></circle>
  {/each}
  {#each vista.puntos as d, i (i)}
    {#if d.veg}
      <polygon points={hex(d.x, d.y, d.r)} fill={d.color} opacity="0.85"></polygon>
    {:else}
      <circle cx={d.x} cy={d.y} r={d.r} fill={d.color}></circle>
    {/if}
  {/each}
</svg>

<style>
svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
