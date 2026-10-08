<script>
// @ts-check
// Pestaña Historial de la ficha (decisión 20): corridas, torneos y pruebas
// donde participó el bot, cruzados por el hash del ADN (engine/biblioteca.js
// historialBot), con enlaces a Analizar y Competir.
import { untrack } from 'svelte';
import { lgHash } from '../../../engine/adn.js';
import { historialBot } from '../../../engine/biblioteca.js';
import { num, t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { rutaAnalizar } from '../analizar/ruta.js';
import { almacen } from '../sim/almacen.svelte.js';
import { adnForo } from './datos.js';
import { mensajeError } from './textos.js';

/**
 * @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada
 * @type {{ entrada: Entrada }}
 */
let { entrada } = $props();

/** @type {Awaited<ReturnType<typeof historialBot>> | null} */
let datos = $state.raw(null);
/** @type {import('./textos.js').Mensaje | null} */
let error = $state.raw(null);

// Se recarga al cambiar de bot o de versión (id + hash), no con cada
// recarga del índice (que arma entradas nuevas).
const claveBot = $derived(`${entrada.id}|${entrada.hash}`);
$effect(() => {
  claveBot;
  const e = untrack(() => entrada);
  let vigente = true;
  datos = null;
  error = null;
  (async () => {
    /** @type {string[]} */
    const lgs = [];
    if (e.clase === 'foro' && e.archivo) {
      try {
        lgs.push(lgHash(await adnForo(e.archivo)));
      } catch {
        // sin el .txt se cruza solo por nombre y archivo
      }
    }
    const h = await historialBot(almacen(), e, { lgs });
    if (vigente) datos = h;
  })().catch((err) => {
    if (vigente) error = mensajeError(err);
  });
  return () => {
    vigente = false;
  };
});

/** @param {string | undefined} iso */
function fecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** @param {{partidos: Array<{gano: boolean}>}} x */
const ganados = (x) => x.partidos.filter((p) => p.gano).length;

/** @param {string} estado */
const textoEstado = (estado) =>
  ['pendiente', 'corriendo', 'terminado', 'fallido', 'cancelado'].includes(estado)
    ? t(`bots.historial.estado.${estado}`)
    : estado;
</script>

{#if error}
  <p class="help" role="alert">{t(error.clave, error.params)}</p>
{:else if !datos}
  <p class="help">{t('bots.cargando')}</p>
{:else}
  <section class="card">
    <h3>{t('bots.historial.corridas')}</h3>
    {#if datos.corridas.length}
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col">{t('bots.historial.corrida')}</th>
            <th scope="col">{t('bots.historial.fecha')}</th>
            <th scope="col">{t('bots.historial.especies')}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {#each datos.corridas as c (c.id)}
            <tr>
              <td>{c.nombre}</td>
              <td>{fecha(c.fecha)}</td>
              <td>{c.especies.join(', ')}</td>
              <td class="der"><a href={rutaAnalizar(c.id)}>{t('bots.historial.analizar')}</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="help">{t('bots.historial.sinCorridas')}</p>
    {/if}
  </section>

  <section class="card">
    <h3>{t('bots.historial.torneos')}</h3>
    {#if datos.torneos.length}
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col">{t('bots.historial.torneo')}</th>
            <th scope="col">{t('bots.historial.participante')}</th>
            <th scope="col">{t('bots.historial.resultado')}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {#each datos.torneos as x (x.id)}
            <tr>
              <td>
                {x.nombre}
                {#if x.scratch}
                  <span class="chip">{t('bots.historial.rapido')}</span>
                {/if}
              </td>
              <td>{[...new Set(x.temporadas.map((s) => s.participante))].join(', ')}</td>
              <td>
                {t('bots.historial.partidos', {
  n: num(x.partidos.length),
  ganados: num(ganados(x)),
  temporadas: num(x.temporadas.length),
})}
              </td>
              <td class="der"><a href={hashDe('competir', x.id)}>{t('bots.historial.ver')}</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="help">{t('bots.historial.sinTorneos')}</p>
    {/if}
  </section>

  <section class="card">
    <h3>{t('bots.historial.pruebas')}</h3>
    {#if datos.pruebas.length}
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col">{t('bots.historial.cuando')}</th>
            <th scope="col">{t('bots.historial.prueba')}</th>
            <th scope="col">{t('bots.historial.estado')}</th>
          </tr>
        </thead>
        <tbody>
          {#each datos.pruebas as p (p.id)}
            <tr>
              <td>{fecha(p.creado)}</td>
              <td>
                {p.titulo}
                {#if p.tipo === 'evolucion'}
                  <span class="chip">{t('bots.historial.evolucion')}</span>
                {/if}
              </td>
              <td>{textoEstado(p.estado)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="help">{t('bots.historial.sinPruebas')}</p>
    {/if}
  </section>
  <p class="help">{t('bots.historial.ayuda')}</p>
{/if}

<style>
.card {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--gris-claro);
  font-weight: 600;
  text-align: left;
  padding: 6px;
  border-bottom: 1px solid var(--borde);
}
.tbl td {
  padding: 8px 6px;
  border-bottom: 1px solid var(--chip);
  font-variant-numeric: tabular-nums;
}
.der {
  text-align: right;
}
.chip {
  margin-left: 6px;
}
</style>
