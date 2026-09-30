<script>
// @ts-check
// Pestaña Sentidos: los 9 ojos del bloque de foco (dirección, ancho, alcance,
// valor visto; el abanico usa la misma cuenta que la rejilla de visión del
// mundo) con .eyeNdir/.eyeNwidth de 'eye-read', y tacto y gusto leídos de la
// memoria del bot.
import { onMount } from 'svelte';
import { num, t } from '../../i18n/index.svelte.js';
import { normalizarAngulo } from '../mundo/render-clasico.js';
import { arcoOjo } from './datos.js';
import { SENTIDOS } from './memoria.js';

/**
 * @type {{
 *   sesion: import('../sim/sesion.svelte.js').Sesion,
 *   bot: number,
 *   vivo: boolean,
 *   datos: import('./datos.js').DatosBot | null,
 *   valorDe: (nombre: string) => number | undefined,
 *   leer: (nombres: readonly string[]) => void,
 * }}
 */
let { sesion, bot, vivo, datos, valorDe, leer } = $props();

/** Relectura de la memoria y de los ojos (ms). */
const PERIODO = 500;
const LECTURAS = [...SENTIDOS.tacto, ...SENTIDOS.gusto, ...SENTIDOS.otros];

/** @type {{ dir: number[], wth: number[] } | null} */
let crudos = $state.raw(null);

onMount(() => {
  const baja = sesion.c.on('eye-vals', (m) => {
    if ((m.n | 0) === bot && Array.isArray(m.dir)) crudos = { dir: m.dir, wth: m.wth };
  });
  return baja;
});

// Otro bot: los ojos leídos eran del anterior.
$effect.pre(() => {
  bot;
  crudos = null;
});

$effect(() => {
  if (!vivo) return;
  const n = bot;
  const pedir = () => {
    sesion.c.eyeRead(n);
    leer(LECTURAS);
  };
  pedir();
  const id = setInterval(pedir, PERIODO);
  return () => clearInterval(id);
});

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

/** @param {number | undefined} v */
const fmt = (v) => (v === undefined ? '—' : num(v));
</script>

{#if datos?.ojos.length}
  <div class="card caja">
    <div class="enc"><span class="tit">{t('inspector.sentidos.ojos')}</span></div>
    <svg class="abanico" viewBox="0 0 220 220" role="img" aria-label={t('inspector.sentidos.fan')}>
      {#each arcos as arco (arco.a)}
        <path d={arco.d} class="arco" class:visto={arco.visto} class:foco={arco.foco}></path>
      {/each}
      <circle cx={C} cy={C} r="7" class="cuerpo"></circle>
      <line x1={C} y1={C} x2={aimX} y2={aimY} class="aim"></line>
    </svg>
    <table>
      <thead>
        <tr>
          <th>{t('inspector.sentidos.ojo')}</th>
          <th>{t('inspector.sentidos.visto')}</th>
          <th>{t('inspector.sentidos.dir')}</th>
          <th>{t('inspector.sentidos.ancho')}</th>
          <th>{t('inspector.sentidos.alcance')}</th>
        </tr>
      </thead>
      <tbody>
        {#each datos.ojos as ojo, a (a)}
          <tr class:foco={a === datos.ojoFoco}>
            <td class="mono">.eye{a + 1}</td>
            <td class="mono">{num(ojo.visto)}</td>
            <td class="mono" title={`.eye${a + 1}dir`}>{crudos ? num(crudos.dir[a]) : '—'}</td>
            <td class="mono" title={`.eye${a + 1}width`}>{crudos ? num(crudos.wth[a]) : '—'}</td>
            <td class="mono">{num(Math.round(ojo.alcance))}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="nota">{t('inspector.sentidos.sinFoco')}</p>
{/if}

{#each Object.entries(SENTIDOS) as [grupo, nombres] (grupo)}
  <div class="card caja">
    <div class="enc"><span class="tit">{t(`inspector.sentidos.${grupo}`)}</span></div>
    <dl>
      {#each nombres as n (n)}
        <dt class="mono">{n}</dt>
        <dd class="mono">{fmt(valorDe(n))}</dd>
      {/each}
    </dl>
  </div>
{/each}

<style>
.caja {
  padding: 12px 14px;
}
.enc {
  font-size: 13px;
  margin-bottom: 8px;
}
.tit {
  font-weight: 600;
}
.nota {
  margin: 0;
  font-size: 13px;
  color: var(--gris-claro);
}
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
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th {
  text-align: right;
  font-weight: 500;
  color: var(--gris-claro);
  padding: 2px 4px;
}
td {
  text-align: right;
  padding: 2px 4px;
  border-top: 1px solid var(--borde);
}
th:first-child,
td:first-child {
  text-align: left;
}
tr.foco td {
  color: var(--acento);
  font-weight: 600;
}
dl {
  display: grid;
  grid-template-columns: repeat(2, auto 1fr);
  gap: 4px 10px;
  margin: 0;
  font-size: 12px;
}
dt {
  color: var(--gris-claro);
}
dd {
  margin: 0;
  text-align: right;
}
</style>
