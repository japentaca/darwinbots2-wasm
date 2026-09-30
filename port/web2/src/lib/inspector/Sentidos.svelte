<script>
// @ts-check
// Pestaña Sentidos: los 9 ojos del bloque de foco (dirección, ancho, alcance,
// valor visto; el abanico usa la misma cuenta que la rejilla de visión del
// mundo) con .eyeNdir/.eyeNwidth de 'eye-read', y tacto y gusto leídos de la
// memoria del bot.
import { onMount } from 'svelte';
import { num, t } from '../../i18n/index.svelte.js';
import Abanico from './Abanico.svelte';
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

/** @param {number | undefined} v */
const fmt = (v) => (v === undefined ? '—' : num(v));
</script>

{#if datos?.ojos.length}
  <div class="card caja">
    <div class="enc"><span class="tit">{t('inspector.sentidos.ojos')}</span></div>
    <Abanico {datos} />
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
