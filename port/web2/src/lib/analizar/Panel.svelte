<script>
// @ts-check
// Panel de Analizar: 4 gráficos elegidos de un catálogo agrupado por los 6
// grupos (decisión 7); la elección se recuerda en este navegador. La marca
// del evento elegido en Eventos (o del hallazgo elegido en la tarjeta
// Hallazgos) se ve en los cuatro.
import { onDestroy } from 'svelte';
import { idioma, num, t } from '../../i18n/index.svelte.js';
import {
  CATALOGO,
  COLOR_GLOBAL,
  claveNombre,
  colorEspecie,
  entrada,
  especiesPorImportancia,
  guardarPanel,
  leerPanel,
  porGrupo,
  seriesDe,
} from './catalogo.js';
import { filasEspecies, ordenarFilas } from './especies.js';
import Grafico from './grafico/Grafico.svelte';
import { claveHallazgo, esperaHallazgos, hallazgosTarjeta, textoHallazgo } from './hallazgos.js';

/**
 * @type {{
 *   fuente: import('./fuente.js').FuenteAnalisis,
 *   dominio: [number, number] | null,
 *   marca: number | null,
 *   marcaTexto: string,
 *   marcaClave: string | null,
 *   onMarcar: (m: { clave: string, ciclo: number, texto: string } | null) => void,
 *   onEspecie: (nombre: string) => void,
 *   irA: (pestaña: string) => void,
 * }}
 */
let { fuente, dominio, marca, marcaTexto, marcaClave, onMarcar, onEspecie, irA } = $props();

/** @returns {Storage | null} */
function almacen() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

let elegidos = $state(leerPanel(almacen()));
/** @type {number | null} gráfico cuyo catálogo está abierto */
let eligiendo = $state(null);

const importancia = $derived(especiesPorImportancia(fuente.historia));

const graficos = $derived(
  elegidos.map((id, i) => {
    const e = entrada(id) ?? CATALOGO[0];
    const nombre = t(claveNombre(e));
    return {
      i,
      e,
      nombre,
      sub: `${t(`analizar.grupo.${e.grupo}`)} · ${t(e.fuente === 'g' ? 'analizar.panel.total' : 'analizar.panel.porEspecie')}`,
      series: seriesDe(fuente.historia, e, {
        colores: fuente.colores,
        nombreGlobal: nombre,
        otras: t('analizar.otras'),
        especies: importancia,
      }),
    };
  }),
);

const resumen = $derived(
  ordenarFilas(filasEspecies(fuente.historia, null), 'vivos', false).slice(0, 6),
);
const nEspecies = $derived(fuente.historia.nombresEspecies().length);

// ---- Hallazgos (detectores sobre la historia de la fuente) --------------------
// Agrupados como en el resumen del informe (no repite frases: extinciones
// simultáneas en una, tope por tipo). Con la corrida actual en vivo se
// recalculan a lo sumo cada pocos segundos.

/** @type {import('../../../engine/detectors.js').HallazgoAgrupado[]} */
let hallazgos = $state.raw([]);
let ultimoCalculo = { id: '', en: Number.NEGATIVE_INFINITY };
/** @type {ReturnType<typeof setTimeout> | null} */
let plazoH = null;

/** @param {import('./fuente.js').FuenteAnalisis} f */
const idDe = (f) => `${f.tipo}:${f.id ?? ''}:${f.historia.t[0] ?? ''}`;

/** @param {import('./fuente.js').FuenteAnalisis} f */
function calcularHallazgos(f) {
  ultimoCalculo = { id: idDe(f), en: performance.now() };
  hallazgos = hallazgosTarjeta(f.historia);
}

$effect(() => {
  const f = fuente;
  const espera = esperaHallazgos(ultimoCalculo, idDe(f), f.tipo === 'actual', performance.now());
  if (espera === 0) calcularHallazgos(f);
  else if (Number.isFinite(espera) && !plazoH)
    plazoH = setTimeout(() => {
      plazoH = null;
      calcularHallazgos(fuente);
    }, espera);
});

onDestroy(() => {
  if (plazoH) clearTimeout(plazoH);
});

const filasHallazgos = $derived(
  hallazgos.map((x) => {
    const esp = typeof x.params.especie === 'string' ? x.params.especie : null;
    return {
      clave: claveHallazgo(x),
      ciclo: x.desde,
      tipo: x.tipo,
      color: esp ? colorEspecie(esp, fuente.colores) : COLOR_GLOBAL,
      texto: textoHallazgo(x, idioma()),
    };
  }),
);

/** @param {{clave: string, ciclo: number, tipo: string}} h */
function marcarHallazgo(h) {
  if (marcaClave === h.clave) onMarcar(null);
  else onMarcar({ clave: h.clave, ciclo: h.ciclo, texto: t(`analizar.hallazgos.tipo.${h.tipo}`) });
}

/** @param {number} i @param {string} id */
function elegir(i, id) {
  elegidos[i] = id;
  guardarPanel(almacen(), [...elegidos]);
  eligiendo = null;
}

/** @param {KeyboardEvent} e */
function teclado(e) {
  if (e.key === 'Escape') eligiendo = null;
}
</script>

<svelte:window onkeydown={teclado} />

<div class="panel">
  <div class="rejilla">
    {#each graficos as g (g.i)}
      <section class="card graf">
        <div class="cab">
          <h2 class="h2">{g.nombre}</h2>
          <span class="acciones">
            <span class="sub">{g.sub}</span>
            <button
              class="lnk"
              type="button"
              aria-expanded={eligiendo === g.i}
              onclick={() => (eligiendo = eligiendo === g.i ? null : g.i)}
            >
              {t('analizar.panel.cambiar')}
            </button>
          </span>
        </div>
        {#if eligiendo === g.i}
          <div class="catalogo" role="dialog" aria-label={t('analizar.panel.catalogo')}>
            <div class="cat-cab">
              <span class="lbl">{t('analizar.panel.catalogo')}</span>
              <button class="lnk" type="button" onclick={() => (eligiendo = null)}>
                {t('analizar.cerrar')}
              </button>
            </div>
            {#each porGrupo() as gr (gr.grupo)}
              <div class="cat-grupo">
                <span class="cat-titulo">{t(`analizar.grupo.${gr.grupo}`)}</span>
                <div class="cat-lista">
                  {#each gr.entradas as en (en.id)}
                    <button
                      type="button"
                      class="cat-item"
                      class:on={en.id === g.e.id}
                      aria-pressed={en.id === g.e.id}
                      onclick={() => elegir(g.i, en.id)}
                    >
                      {t(claveNombre(en))}
                      {#if en.fuente !== 'g'}
                        <span class="por">{t('analizar.panel.porEspecieCorto')}</span>
                      {/if}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
        <Grafico
          series={g.series}
          modo={g.e.modo}
          alto={200}
          {marca}
          {marcaTexto}
          {dominio}
          cero={g.e.cero}
          aria={g.nombre}
          vacio={t('analizar.grafico.sinDatos')}
        />
      </section>
    {/each}
    <p class="nota">{t('analizar.panel.nota')}</p>
  </div>

  <aside>
    <section class="card lado">
      <div class="lado-cab">
        <h2 class="h2">{t('analizar.hallazgos.titulo')}</h2>
        <span class="sub">{t('analizar.hallazgos.sub')}</span>
      </div>
      {#each filasHallazgos as h (h.clave)}
        <div class="find">
          <span class="sw find-sw" style:background={h.color}></span>
          <span class="find-txt">{h.texto}</span>
          <button
            class="lnk"
            type="button"
            aria-pressed={marcaClave === h.clave}
            aria-label={t('analizar.hallazgos.marcarAria', { ciclo: num(h.ciclo) })}
            onclick={() => marcarHallazgo(h)}
          >
            {t('analizar.hallazgos.marcar', { ciclo: num(h.ciclo) })}
          </button>
        </div>
      {:else}
        <p class="sub">{t('analizar.hallazgos.ninguno')}</p>
      {/each}
    </section>
    <section class="card lado">
      <h2 class="h2">{t('analizar.panel.especies')}</h2>
      {#if resumen.length}
        <table class="tbl">
          <thead>
            <tr>
              <th scope="col">{t('analizar.col.nombre')}</th>
              <th scope="col">{t('analizar.col.vivos')}</th>
              <th scope="col">{t('analizar.col.max')}</th>
              <th scope="col">{t('analizar.col.genMax')}</th>
            </tr>
          </thead>
          <tbody>
            {#each resumen as f (f.nombre)}
              <tr>
                <td>
                  <button class="nombre" type="button" onclick={() => onEspecie(f.nombre)}>
                    <span
                      class="sw"
                      style:background={colorEspecie(f.nombre, fuente.colores)}
                    ></span>
                    <span class="txt">{f.nombre}</span>
                  </button>
                </td>
                <td class="mono">{num(f.vivos)}</td>
                <td class="mono">{num(f.max)}</td>
                <td class="mono">{f.genMax === null ? '—' : num(f.genMax)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <button class="lnk mas" type="button" onclick={() => irA('especies')}>
          {t('analizar.panel.todas', { n: num(nEspecies) })}
        </button>
      {:else}
        <p class="sub">{t('analizar.sinEspecies')}</p>
      {/if}
    </section>
  </aside>
</div>

<style>
.panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
}
.rejilla {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-content: start;
}
.graf {
  padding: 14px 16px;
  position: relative;
  min-width: 0;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}
.acciones {
  display: flex;
  gap: 10px;
  align-items: baseline;
  flex-shrink: 0;
}
.catalogo {
  position: absolute;
  z-index: 5;
  left: 8px;
  right: 8px;
  top: 44px;
  max-height: 420px;
  overflow: auto;
  background: var(--tarjeta);
  border: 1px solid var(--borde-control);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  padding: 10px 12px;
}
.cat-cab {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.cat-grupo {
  padding: 6px 0;
  border-top: 1px solid var(--borde);
}
.cat-titulo {
  font-size: 12px;
  font-weight: 600;
  color: var(--gris);
}
.cat-lista {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.cat-item {
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--borde-control);
  background: #ffffff;
  border-radius: 999px;
  padding: 3px 9px;
  cursor: pointer;
  color: var(--texto);
}
.cat-item:hover {
  background: var(--hover-claro);
}
.cat-item.on {
  background: var(--texto);
  border-color: var(--texto);
  color: #ffffff;
}
.por {
  opacity: 0.7;
  margin-left: 4px;
}
.nota {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
}
aside {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.lado {
  padding: 14px 16px;
}
.lado .h2 {
  margin-bottom: 8px;
}
.lado-cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}
.lado-cab .h2 {
  margin-bottom: 4px;
}
.find {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
  line-height: 1.45;
  padding: 8px 0;
  border-top: 1px solid #ebe9e2;
}
.find-sw {
  flex-shrink: 0;
  margin-top: 5px;
}
.find-txt {
  flex-grow: 1;
  min-width: 0;
}
.nombre {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  color: var(--texto);
  max-width: 150px;
  text-align: left;
}
.txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nombre:hover .txt {
  text-decoration: underline;
}
.mas {
  margin-top: 8px;
  font-size: 13px;
}
@media (max-width: 1100px) {
  .panel {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 760px) {
  .rejilla {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
