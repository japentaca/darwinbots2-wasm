<script>
// @ts-check
// Abanico de los 9 ojos del bot con foco (bloque de foco del frame; la misma
// cuenta que la rejilla de visión del mundo). Lo usan Sentidos y el
// diseñador de ojos (pestaña Control): se actualiza con cada frame.
import { t } from '../../i18n/index.svelte.js';
import { normalizarAngulo } from '../mundo/render-clasico.js';
import { arcoOjo } from './datos.js';

/** @type {{ datos: import('./datos.js').DatosBot }} */
let { datos } = $props();

const C = 110; // centro del abanico
const R = 96; // radio del ojo más largo

/** Arcos del abanico en coordenadas de pantalla (y hacia abajo). */
const arcos = $derived.by(() => {
  if (!datos?.ojos.length) return [];
  const d = datos;
  const crudo = d.ojos.map((o, a) => arcoOjo(d.aim, a, o, d.radio));
  const max = Math.max(1, ...crudo.map((c) => c.largo));
  return crudo.map((c, a) => {
    const r = Math.max(6, (c.largo / max) * R);
    const p = (/** @type {number} */ ang) =>
      `${(C + r * Math.cos(ang)).toFixed(1)} ${(C - r * Math.sin(ang)).toFixed(1)}`;
    const barrido = c.hi - c.lo < 0 ? normalizarAngulo(c.hi - c.lo, Math.PI * 2) : c.hi - c.lo;
    const grande = barrido > Math.PI ? 1 : 0;
    return {
      a,
      d: `M${C} ${C}L${p(c.lo)}A${r.toFixed(1)} ${r.toFixed(1)} 0 ${grande} 0 ${p(c.hi)}Z`,
      visto: d.ojos[a].visto > 0,
      foco: a === d.ojoFoco,
    };
  });
});

const aimX = $derived(datos ? C + 18 * Math.cos(datos.aim) : C);
const aimY = $derived(datos ? C - 18 * Math.sin(datos.aim) : C);
</script>

<svg class="abanico" viewBox="0 0 220 220" role="img" aria-label={t('inspector.sentidos.fan')}>
  {#each arcos as arco (arco.a)}
    <path d={arco.d} class="arco" class:visto={arco.visto} class:foco={arco.foco}></path>
  {/each}
  <circle cx={C} cy={C} r="7" class="cuerpo"></circle>
  <line x1={C} y1={C} x2={aimX} y2={aimY} class="aim"></line>
</svg>

<style>
.abanico {
  display: block;
  width: 220px;
  height: 220px;
  margin: 0 auto 8px;
  background: var(--mundo);
  border-radius: 8px;
}
.arco {
  fill: rgba(0, 255, 255, 0.06);
  stroke: rgba(0, 255, 255, 0.35);
  stroke-width: 1;
}
.arco.visto {
  fill: rgba(0, 255, 255, 0.16);
  stroke: #00ffff;
  stroke-width: 1.5;
}
.arco.foco {
  stroke: #ff3b30;
  stroke-width: 2;
}
.cuerpo {
  fill: #f4f3ef;
}
.aim {
  stroke: #f4f3ef;
  stroke-width: 2;
}
</style>
