<script>
// @ts-check
// «Réplicas» (decisión 10): N semillas del escenario de una corrida, con sus
// cambios en caliente en el mismo ciclo (decisión 13), sin dibujar, a
// máxima velocidad y en varios workers (la cola de src/lib/trabajos/).
// Resultado: media y banda p10–p90 por ciclo de la métrica elegida y la
// tabla de medias y desvíos del valor final (la última muestra cruda de
// cada réplica). Con réplicas a medias se muestra lo que ya terminó
// (resultado parcial).
import {
  agregarReplicas,
  METRICAS_CLAVE,
  TIPO_REPLICAS,
  tablaReplicas,
} from '../../../../engine/replicas.js';
import { idioma, num, t } from '../../../i18n/index.svelte.js';
import { clavePlural } from '../../experimentar/borrador.js';
import ListaTrabajos from '../../trabajos/ListaTrabajos.svelte';
import { paraleloDe } from '../../trabajos/pool.js';
import { textoError } from '../../trabajos/textos.js';
import {
  estadoTrabajos,
  fijarTope,
  iniciarTrabajos,
  paraleloMaximo,
} from '../../trabajos/trabajos.svelte.js';
import { ID_ACTUAL } from './fuentes.js';
import GraficoBandas from './GraficoBandas.svelte';
import { lanzarReplicas } from './lanzar.js';
import SelectorMetrica from './SelectorMetrica.svelte';

/**
 * @type {{
 *   opciones: {id: string, nombre: string}[],
 *   inicial: string,
 *   cargar: (id: string) => Promise<import('./fuentes.js').Fuente | null>,
 * }}
 */
let { opciones, inicial, cargar } = $props();

const uid = $props.id();
const COLOR = '#0f5c55';

let origen = $state('');
/** @type {import('./fuentes.js').Fuente | null} */
let fuente = $state.raw(null);
let n = $state(8);
let ciclos = $state(5000);
let metricaNueva = $state('vivos');
let lanzando = $state(false);
let error = $state('');
let avisoAdn = $state('');
let seleccion = $state('');
let tope = $state(estadoTrabajos.paralelo);

/**
 * Texto con la forma plural de `n` (`clave.uno` / `clave.otros`).
 * @param {string} clave @param {number} n @param {Record<string, string | number>} [p]
 */
const tn = (clave, n, p = {}) => t(clavePlural(clave, n, idioma()), { ...p, n: num(n) });

// Origen inicial: la corrida que mira Analizar.
let iniciado = false;
$effect(() => {
  if (iniciado || !opciones.length) return;
  iniciado = true;
  void elegirOrigen(opciones.some((o) => o.id === inicial) ? inicial : opciones[0].id);
});

let pedido = 0;
/** @param {string} id */
async function elegirOrigen(id) {
  const k = ++pedido;
  origen = id;
  fuente = null;
  if (!id) return;
  try {
    const f = await cargar(id);
    if (k === pedido) fuente = f;
  } catch (e) {
    if (k === pedido) error = t('comparar.errorCarga', { detalle: String(e) });
  }
}

async function lanzar() {
  if (!fuente) return;
  lanzando = true;
  error = '';
  avisoAdn = '';
  try {
    // La corrida actual pudo sumar cambios en caliente desde que se eligió.
    const f = origen === ID_ACTUAL ? ((await cargar(origen)) ?? fuente) : fuente;
    const titulo = tn('comparar.rep.titulo', n, { nombre: f.nombre, ciclos: num(ciclos) });
    const r = await lanzarReplicas(iniciarTrabajos(), f, {
      n,
      ciclos,
      metrica: metricaNueva,
      titulo,
    });
    seleccion = r.id;
    if (r.avisosAdn.length) avisoAdn = t('comparar.rep.avisoAdn', { bots: r.avisosAdn.join(', ') });
  } catch (e) {
    const x = /** @type {any} */ (e);
    error = x?.codigo
      ? textoError(t, x.codigo, String(x.message ?? ''))
      : t('comparar.error.otro', { detalle: String(e) });
  } finally {
    lanzando = false;
  }
}

/** @param {Event} e */
function cambiarTope(e) {
  const v = Math.trunc(Number(/** @type {HTMLInputElement} */ (e.currentTarget).value));
  tope = paraleloDe(1 + paraleloMaximo(), v);
  fijarTope(tope);
}

// ---- Trabajo elegido -------------------------------------------------------
const trabajo = $derived(estadoTrabajos.lista.find((x) => x.id === seleccion) ?? null);
const hechas = $derived(trabajo ? trabajo.unidades.filter((u) => u.estado === 'hecha').length : 0);
let metricaVer = $state('vivos');
/** @type {any[]} */
let resultados = $state.raw([]);

// La métrica del trabajo al elegirlo.
let visto = '';
$effect(() => {
  if (!trabajo || trabajo.id === visto) return;
  visto = trabajo.id;
  metricaVer = trabajo.params?.metrica ?? 'vivos';
  resultados = [];
});

// Resultados: se leen de nuevo cada vez que termina una réplica (solo
// entonces: el trabajo en sí cambia con cada progreso).
const idTrabajo = $derived(trabajo?.id ?? '');
let lectura = 0;
$effect(() => {
  const id = idTrabajo;
  const k = ++lectura;
  void hechas;
  if (!id) return;
  iniciarTrabajos()
    .resultados(id)
    .then((r) => {
      if (k === lectura) resultados = r;
    })
    .catch(() => {});
});

const agregado = $derived(agregarReplicas(resultados, metricaVer));
const series = $derived(
  agregado.t.length
    ? [
        {
          etiqueta: tn('comparar.rep.grafico', Math.max(0, ...agregado.n), {
            metrica: t(`analizar.m.g.${metricaVer}`),
          }),
          color: COLOR,
          t: agregado.t,
          media: agregado.media,
          bajo: agregado.p10,
          alto: agregado.p90,
        },
      ]
    : [],
);
const tabla = $derived(tablaReplicas(resultados, METRICAS_CLAVE));
const cicloTabla = $derived(tabla.find((f) => f.n > 0)?.ciclo ?? Number.NaN);

/** @param {number} v */
const fmt = (v) => (Number.isFinite(v) ? num(v, { maximumFractionDigits: 2 }) : '—');

/** Réplicas cuya ronda se reinició (terminaron antes del objetivo). */
const reinicios = $derived(
  resultados.flatMap((r, i) => (r?.reinicio ? [{ n: i + 1, ciclo: r.reinicio.ciclo }] : [])),
);
</script>

<div class="rep">
  <section class="card bloque">
    <div class="fila">
      <label for={`${uid}-o`}>{t('comparar.rep.origen')}</label>
      <select
        id={`${uid}-o`}
        value={origen}
        onchange={(e) => elegirOrigen(/** @type {HTMLSelectElement} */ (e.currentTarget).value)}
      >
        {#each opciones as o (o.id)}
          <option value={o.id}>{o.nombre}</option>
        {/each}
      </select>
    </div>
    <p class="nota">{t('comparar.rep.origenAyuda')}</p>
    {#if fuente && !fuente.escenario}
      <p class="error">{t('comparar.rep.sinEscenario')}</p>
    {/if}
    <div class="fila">
      <label for={`${uid}-n`}>{t('comparar.rep.n')}</label>
      <input id={`${uid}-n`} type="number" min="1" max="64" bind:value={n}>
      <label for={`${uid}-c`}>{t('comparar.rep.ciclos')}</label>
      <input id={`${uid}-c`} type="number" min="1" step="100" bind:value={ciclos}>
      <label for={`${uid}-w`}>{t('comparar.rep.tope')}</label>
      <input
        id={`${uid}-w`}
        type="number"
        min="1"
        max={paraleloMaximo()}
        value={tope}
        onchange={cambiarTope}
        title={t('comparar.rep.topeAyuda', { max: num(paraleloMaximo()) })}
      >
    </div>
    <SelectorMetrica bind:metrica={metricaNueva} />
    <div class="fila">
      <button
        type="button"
        class="btn pri"
        disabled={!fuente?.escenario || lanzando}
        onclick={lanzar}
      >
        {lanzando ? t('comparar.rep.lanzando') : t('comparar.rep.lanzar')}
      </button>
    </div>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    {#if avisoAdn}
      <p class="aviso" role="status">{avisoAdn}</p>
    {/if}
  </section>

  <ListaTrabajos tipo={TIPO_REPLICAS} bind:seleccion titulo={t('comparar.rep.trabajos')} />

  {#if trabajo}
    <section class="card bloque">
      <h2>{trabajo.titulo || t('comparar.trabajos.sinTitulo')}</h2>
      <ol class="unidades">
        {#each trabajo.unidades as u, i (i)}
          <li>
            <span>{t('comparar.rep.replica', { n: num(i + 1) })}</span>
            <span class="mono sem">
              {t('comparar.rep.semilla', { n: String(trabajo.params?.semillas?.[i] ?? '') })}
            </span>
            <progress max="1" value={u.progreso}></progress>
            <span class="est">{t(`comparar.trabajos.unidad.${u.estado}`)}</span>
            {#if u.estado === 'fallida' && u.error}
              <span class="error">{textoError(t, u.codigo, u.error)}</span>
            {/if}
          </li>
        {/each}
      </ol>
      {#if !hechas}
        <p class="nota">{t('comparar.rep.sinResultados')}</p>
      {:else}
        {#if hechas < trabajo.unidades.length}
          <p class="nota">
            {t('comparar.rep.parcial', {
  hechas: num(hechas),
  total: num(trabajo.unidades.length),
})}
          </p>
        {/if}
        <SelectorMetrica bind:metrica={metricaVer} />
        <GraficoBandas
          {series}
          titulo={t(`analizar.m.g.${metricaVer}`)}
          banda={t('comparar.grafico.bandaReplicas')}
        />
        {#each reinicios as r (r.n)}
          <p class="nota">
            {t('comparar.rep.reinicio', { n: num(r.n), ciclo: num(r.ciclo) })}
          </p>
        {/each}
        <h3>{t('comparar.rep.tabla', { ciclo: num(cicloTabla) })}</h3>
        <table>
          <thead>
            <tr>
              <th>{t('comparar.rep.col.metrica')}</th>
              <th>{t('comparar.rep.col.media')}</th>
              <th>{t('comparar.rep.col.desvio')}</th>
              <th>{t('comparar.rep.col.min')}</th>
              <th>{t('comparar.rep.col.max')}</th>
              <th>{t('comparar.rep.col.n')}</th>
            </tr>
          </thead>
          <tbody>
            {#each tabla as f (f.clave)}
              <tr>
                <th>{t(`analizar.m.g.${f.clave}`)}</th>
                <td class="mono">{fmt(f.media)}</td>
                <td class="mono">{f.n < 2 ? t('comparar.rep.desvioUna') : fmt(f.desvio)}</td>
                <td class="mono">{fmt(f.min)}</td>
                <td class="mono">{fmt(f.max)}</td>
                <td class="mono">{num(f.n)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  {/if}
</div>

<style>
.rep {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.bloque {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-x: auto;
}
.fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 13px;
}
select,
input {
  font: inherit;
  height: 34px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
  box-sizing: border-box;
}
input[type="number"] {
  width: 96px;
}
h2 {
  margin: 0;
  font-size: 15px;
}
h3 {
  margin: 8px 0 0;
  font-size: 13px;
}
.unidades {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 4px 16px;
  font-size: 12px;
}
.unidades li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.unidades progress {
  flex: 1;
  min-width: 60px;
}
.sem,
.est {
  color: var(--gris-claro);
}
table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}
th,
td {
  text-align: left;
  padding: 5px 8px;
  border-bottom: 1px solid var(--borde);
}
tbody th {
  font-weight: 500;
}
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
}
.error {
  color: #9b2c2c;
  font-size: 13px;
  margin: 0;
}
.unidades .error {
  font-size: 12px;
}
.aviso {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 13px;
}
</style>
