<script>
// @ts-check
// Eventos de Analizar: población total con los eventos como pines y la
// lista filtrable por tipo. Elegir un evento marca su ciclo aquí y en todos
// los gráficos del Panel (y de Especies).
import { idioma, num, t } from '../../i18n/index.svelte.js';
import { textoEvento } from '../observar/eventos.js';
import { COLOR_GLOBAL } from './catalogo.js';
import { colorEvento, cuentas, FILTROS, filtrarEventos } from './eventos.js';
import Grafico from './grafico/Grafico.svelte';

/**
 * @typedef {{ clave: string, ciclo: number, texto: string }} EventoMarcado
 */

/**
 * @type {{
 *   fuente: import('./fuente.js').FuenteAnalisis,
 *   dominio: [number, number] | null,
 *   marcado: EventoMarcado | null,
 *   onMarcar: (e: EventoMarcado | null) => void,
 * }}
 */
let { fuente, dominio, marcado, onMarcar } = $props();

let filtro = $state('todos');
const MAX_PINES = 300;

const todos = $derived(
  /** @type {import('./eventos.js').EventoAnalizar[]} */ (fuente.historia.eventos),
);
const n = $derived(cuentas(todos));
const lista = $derived(
  filtrarEventos(todos, filtro, fuente.historia.eventosDescartados).map((e) => ({
    clave: `ev:${e.i}`,
    ciclo: e.ciclo,
    tipo: e.tipo,
    texto: textoEvento(/** @type {any} */ (e), t, idioma(), (x) => num(x)),
  })),
);

const serie = $derived.by(() => {
  const s = fuente.historia.serie('vivos');
  if (!s) return [];
  return [
    {
      clave: 'vivos',
      nombre: t('analizar.m.g.vivos'),
      color: COLOR_GLOBAL,
      t: s.t,
      v: s.media,
      min: s.min,
      max: s.max,
      n: s.n,
    },
  ];
});

const pines = $derived(
  lista.slice(-MAX_PINES).map((e) => ({
    clave: e.clave,
    ciclo: e.ciclo,
    color: colorEvento(e.tipo),
    sel: marcado?.clave === e.clave,
    titulo: `${num(e.ciclo)} · ${e.texto}`,
  })),
);

/** @param {string} clave */
function elegir(clave) {
  if (marcado?.clave === clave) {
    onMarcar(null);
    return;
  }
  const e = lista.find((x) => x.clave === clave);
  if (e) onMarcar({ clave, ciclo: e.ciclo, texto: e.texto });
}
</script>

<div class="eventos">
  <section class="card bloque">
    <div class="cab">
      <h2 class="h2">{t('analizar.ev.titulo')}</h2>
      <span class="sub">{t('analizar.ev.ayuda')}</span>
    </div>
    <Grafico
      series={serie}
      alto={180}
      marca={marcado?.ciclo ?? null}
      {dominio}
      cero
      {pines}
      onpin={elegir}
      aria={t('analizar.ev.titulo')}
      leyenda={false}
    />
  </section>

  <div class="barra">
    <fieldset class="seg">
      <legend class="oculto">{t('analizar.ev.filtro')}</legend>
      {#each Object.keys(FILTROS) as f (f)}
        <button
          type="button"
          class:on={filtro === f}
          aria-pressed={filtro === f}
          onclick={() => (filtro = f)}
        >
          {t(`analizar.ev.f.${f}`)}
          ({num(n[f] ?? 0)})
        </button>
      {/each}
    </fieldset>
    {#if marcado}
      <button class="btn sm" type="button" onclick={() => onMarcar(null)}>
        {t('analizar.ev.quitarMarca')}
      </button>
    {/if}
  </div>

  <section class="card lista">
    {#if lista.length}
      {#each lista as e (e.clave)}
        <button
          type="button"
          class="row"
          class:on={marcado?.clave === e.clave}
          aria-pressed={marcado?.clave === e.clave}
          onclick={() => elegir(e.clave)}
        >
          <span class="mono ciclo">{num(e.ciclo)}</span>
          <span
            ><span class="chip tipo" style:border-color={colorEvento(e.tipo)}
              ><span class="sw" style:background={colorEvento(e.tipo)}></span>
              {t(`analizar.ev.tipo.${e.tipo}`)}</span
            ></span
          >
          <span class="texto">{e.texto}</span>
        </button>
      {/each}
    {:else}
      <p class="sub vacio">{t('analizar.ev.vacio')}</p>
    {/if}
  </section>
</div>

<style>
.eventos {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bloque {
  padding: 14px 16px;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.barra {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.seg {
  flex-wrap: wrap;
}
.lista {
  padding: 0 6px;
  max-height: 520px;
  overflow: auto;
}
.row {
  display: grid;
  grid-template-columns: 80px 150px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  font: inherit;
  font-size: 13px;
  text-align: left;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--chip);
  padding: 9px 10px;
  cursor: pointer;
  color: var(--texto);
}
.row:first-child {
  border-top: 0;
}
.row:hover {
  background: #f1f0eb;
}
.row.on {
  background: #e3eeec;
  font-weight: 600;
}
.ciclo {
  text-align: right;
}
.tipo {
  background: transparent;
  border: 1px solid;
}
.vacio {
  padding: 12px 8px;
}
</style>
