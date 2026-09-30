<script>
// @ts-check
// Analizar (Nivel 2): la corrida actual (en vivo) o una guardada (solo
// lectura: su historia y su linaje, sin tocar la sim) en siete pestañas:
// Panel, Especies, Filogenia, Genética, Eventos, Comparar e Informes.
// Rutas (src/lib/analizar/ruta.js): `#/analizar/<id>` abre la corrida
// guardada con ese id y `#/analizar/<id>/<pestaña>` (o
// `#/analizar/actual/<pestaña>` para la actual) la abre además en esa
// pestaña; así otras pantallas llevan directo a Comparar o a Informes (el
// chip de trabajos de la barra usa `#/analizar/actual/comparar`;
// `#/analizar/<pestaña>` es la actual en esa pestaña). Al cambiar de
// pestaña o de corrida el hash se reescribe (sin sumar entradas al
// historial), así recargar o copiar la dirección deja donde se estaba.
// Comparar e Informes se abren también sin corrida (sin actual ni guardada
// elegida): trabajan con las guardadas y los trabajos de la cola.
import { onDestroy, untrack } from 'svelte';
import { num, t } from '../i18n/index.svelte.js';
import { especiesPorImportancia } from '../lib/analizar/catalogo.js';
import Comparar from '../lib/analizar/comparar/Comparar.svelte';
import Especies from '../lib/analizar/Especies.svelte';
import Eventos from '../lib/analizar/Eventos.svelte';
import Filogenia from '../lib/analizar/Filogenia.svelte';
import { cargarGuardada, fuenteActual } from '../lib/analizar/fuente.js';
import Genetica from '../lib/analizar/Genetica.svelte';
import Informes from '../lib/analizar/informes/Informes.svelte';
import Panel from '../lib/analizar/Panel.svelte';
import { hashAnalizar, leerRuta, PESTAÑAS } from '../lib/analizar/ruta.js';
import { actual, corridasGuardadas } from '../lib/sim/corrida.svelte.js';

/** @type {{ partes?: string[] }} */
let { partes = [] } = $props();

const RANGOS = /** @type {const} */ ([
  ['todo', 0],
  ['r10k', 10000],
  ['r1k', 1000],
]);
/** Con la sim corriendo, como mucho un redibujo por segundo. */
const REFRESCO_MS = 1000;

/** @type {string} 'actual' o el id de una guardada */
let sel = $state('actual');
/** @type {import('../../engine/corridas.js').Corrida[]} */
let guardadas = $state.raw([]);
/** @type {import('../lib/analizar/fuente.js').FuenteAnalisis | null} */
let fuente = $state.raw(null);
let cargando = $state(false);
let error = $state('');
/** @type {typeof PESTAÑAS[number]} */
let pestaña = $state('panel');
let rango = $state('todo');
/** @type {{ clave: string, ciclo: number, texto: string } | null} */
let marcado = $state(null);
let especie = $state('');

// La ruta manda: `#/analizar/<id>` abre esa guardada (sin id, la actual) y
// `…/<pestaña>` elige la pestaña.
$effect(() => {
  const r = leerRuta(partes);
  sel = r.sel;
  if (r.pestaña) pestaña = r.pestaña;
});

// Y al revés: la pestaña y la corrida elegidas quedan en el hash.
$effect(() => {
  const h = hashAnalizar(sel, pestaña);
  if (window.location.hash === h) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${h}`);
});

// Lista de corridas guardadas (para el selector).
$effect(() => {
  let vigente = true;
  corridasGuardadas()
    .listar()
    .then((l) => {
      if (vigente) guardadas = l;
    })
    .catch(() => {
      if (vigente) guardadas = [];
    });
  return () => {
    vigente = false;
  };
});

// Corrida actual en vivo: se relee con cada muestra publicada (a lo sumo una
// vez por segundo).
/** @type {ReturnType<typeof setTimeout> | null} */
let plazo = null;
let ultimoRefresco = 0;

/** @param {import('../lib/sim/corrida-nucleo.js').NucleoCorrida} n */
function refrescar(n) {
  ultimoRefresco = performance.now();
  fuente = fuenteActual(/** @type {any} */ (n));
}

$effect(() => {
  if (sel !== 'actual') return;
  const n = actual.corrida;
  error = '';
  if (!n) {
    fuente = null;
    return;
  }
  // dependencias: cada muestra publicada y los colores de la corrida
  const _muestras = n.estado.muestras;
  const _colores = n.estado.colores;
  const _nombre = n.estado.nombre;
  const espera = REFRESCO_MS - (performance.now() - ultimoRefresco);
  const vieja = untrack(() => fuente?.tipo !== 'actual');
  if (vieja || espera <= 0) refrescar(n);
  else if (!plazo)
    plazo = setTimeout(() => {
      plazo = null;
      if (sel === 'actual' && actual.corrida) refrescar(actual.corrida);
    }, espera);
});

// Corrida guardada: se lee una vez (solo lectura). Al cambiar de corrida la
// limpieza invalida el pedido en curso: una carga lenta que termina después
// no pisa la fuente nueva (ni deja «cargando» colgado).
let pedido = 0;
$effect(() => {
  if (sel === 'actual') return;
  const id = sel;
  const mio = ++pedido;
  cargando = true;
  error = '';
  fuente = null;
  cargarGuardada(corridasGuardadas(), id)
    .then((f) => {
      if (mio !== pedido) return;
      if (!f) error = t('analizar.error.inexistente');
      fuente = f;
    })
    .catch(() => {
      if (mio === pedido) error = t('analizar.error.carga');
    })
    .finally(() => {
      if (mio === pedido) cargando = false;
    });
  return () => {
    pedido++;
    cargando = false;
  };
});

onDestroy(() => {
  if (plazo) clearTimeout(plazo);
});

// Al cambiar de corrida: sin marca y la especie más importante.
let idFuente = '';
$effect(() => {
  const clave = fuente ? `${fuente.tipo}:${fuente.id ?? ''}:${fuente.historia.t[0] ?? ''}` : '';
  if (clave !== idFuente) {
    idFuente = clave;
    marcado = null;
  }
  if (fuente && !fuente.historia.nombresEspecies().includes(especie))
    especie = especiesPorImportancia(fuente.historia)[0] ?? '';
});

// Dominio común de todos los gráficos (Panel, Especies, Eventos): en «Todo»
// va del primer punto de la historia a su último ciclo; en los otros, los
// últimos N ciclos (sin empezar antes del primer punto). Así los gráficos
// quedan alineados aunque alguna serie empiece más tarde.
const dominio = $derived.by(() => {
  const h = fuente?.historia;
  if (!h?.t.length || h.ultimoCiclo < 0) return null;
  const r = RANGOS.find(([k]) => k === rango)?.[1] ?? 0;
  const ult = Math.max(h.ultimoCiclo, h.t[h.t.length - 1]);
  const ini = r ? Math.max(h.t[0], ult - r) : h.t[0];
  return /** @type {[number, number]} */ ([ini, ult]);
});

const meta = $derived.by(() => {
  if (!fuente) return '';
  const h = fuente.historia;
  const trozos = [
    t(fuente.tipo === 'actual' ? 'analizar.meta.actual' : 'analizar.meta.guardada'),
    t('analizar.meta.ciclo', { n: num(Math.max(0, h.ultimoCiclo)) }),
  ];
  if (fuente.semilla !== null) trozos.push(t('analizar.meta.semilla', { n: fuente.semilla }));
  trozos.push(t('analizar.meta.muestra', { n: num(h.intervalo) }));
  return trozos.join(' · ');
});

const titulo = $derived(
  fuente?.nombre ? t('analizar.titulo', { nombre: fuente.nombre }) : t('analizar.tituloSolo'),
);

/** @param {string} p */
function irA(p) {
  if (/** @type {readonly string[]} */ (PESTAÑAS).includes(p))
    pestaña = /** @type {typeof PESTAÑAS[number]} */ (p);
}

/** @param {string} nombre */
function verEspecie(nombre) {
  especie = nombre;
  pestaña = 'especies';
}

/** @param {KeyboardEvent} e */
function teclaPestañas(e) {
  const i = PESTAÑAS.indexOf(pestaña);
  let j = -1;
  if (e.key === 'ArrowRight') j = (i + 1) % PESTAÑAS.length;
  else if (e.key === 'ArrowLeft') j = (i - 1 + PESTAÑAS.length) % PESTAÑAS.length;
  if (j < 0) return;
  e.preventDefault();
  pestaña = PESTAÑAS[j];
  document.getElementById(`analizar-tab-${pestaña}`)?.focus();
}
</script>

<section class="analizar">
  <div class="encabezado">
    <div class="titulos">
      <h1>{titulo}</h1>
      {#if meta}
        <div class="mono meta">{meta}</div>
      {/if}
    </div>
    <fieldset class="seg">
      <legend class="oculto">{t('analizar.rango')}</legend>
      {#each RANGOS as [k] (k)}
        <button
          type="button"
          class:on={rango === k}
          aria-pressed={rango === k}
          onclick={() => (rango = k)}
        >
          {t(`analizar.rango.${k}`)}
        </button>
      {/each}
    </fieldset>
    <label class="elegir">
      {t('analizar.corrida')}
      <select class="sel" bind:value={sel}>
        <option value="actual">{t('analizar.corridaActual')}</option>
        {#each guardadas as g (g.id)}
          <option value={g.id}>{g.nombre} · {t('analizar.meta.ciclo', { n: num(g.ciclo) })}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="seg pestañas" role="tablist" aria-label={t('analizar.pestanas')}>
    {#each PESTAÑAS as p (p)}
      <button
        type="button"
        role="tab"
        id={`analizar-tab-${p}`}
        class:on={pestaña === p}
        aria-selected={pestaña === p}
        aria-controls="analizar-contenido"
        tabindex={pestaña === p ? 0 : -1}
        onclick={() => (pestaña = p)}
        onkeydown={teclaPestañas}
      >
        {t(`analizar.tab.${p}`)}
      </button>
    {/each}
  </div>

  <div id="analizar-contenido" role="tabpanel" aria-labelledby={`analizar-tab-${pestaña}`}>
    {#if error}
      <p class="card aviso" role="alert">{error}</p>
    {:else if cargando}
      <p class="card aviso">{t('analizar.cargando')}</p>
    {:else if pestaña === 'comparar'}
      <Comparar corrida={fuente} />
    {:else if pestaña === 'informes'}
      <Informes corrida={fuente} />
    {:else if !fuente}
      <div class="card aviso">
        <p>{t('analizar.sinCorrida')}</p>
        <a class="btn pri" href="#/observar">{t('analizar.irObservar')}</a>
      </div>
    {:else if fuente.historia.puntos < 1}
      <p class="card aviso">{t('analizar.sinHistoria', { n: num(fuente.historia.intervalo) })}</p>
    {:else if pestaña === 'panel'}
      <Panel
        {fuente}
        {dominio}
        marca={marcado?.ciclo ?? null}
        marcaTexto={marcado?.texto ?? ''}
        marcaClave={marcado?.clave ?? null}
        onMarcar={(e) => (marcado = e)}
        onEspecie={verEspecie}
        {irA}
      />
    {:else if pestaña === 'especies'}
      <Especies
        {fuente}
        {dominio}
        marca={marcado?.ciclo ?? null}
        marcaTexto={marcado?.texto ?? ''}
        seleccionada={especie}
        onSeleccionar={(n) => (especie = n)}
        {irA}
      />
    {:else if pestaña === 'filogenia'}
      <Filogenia {fuente} seleccionada={especie} onSeleccionar={(n) => (especie = n)} {irA} />
    {:else if pestaña === 'genetica'}
      <Genetica {fuente} seleccionada={especie} onSeleccionar={(n) => (especie = n)} />
    {:else if pestaña === 'eventos'}
      <Eventos {fuente} {dominio} {marcado} onMarcar={(e) => (marcado = e)} />
    {/if}
  </div>
</section>

<style>
.analizar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 32px 28px;
  max-width: 1440px;
  box-sizing: border-box;
}
.encabezado {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.titulos {
  flex: 1;
  min-width: 240px;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}
.meta {
  font-size: 12px;
  color: var(--gris);
  margin-top: 2px;
}
.elegir {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--gris);
}
.elegir .sel {
  max-width: 320px;
}
.pestañas {
  align-self: flex-start;
  flex-wrap: wrap;
}
.aviso {
  margin: 0;
  padding: 20px 24px;
  font-size: 14px;
  color: var(--gris);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.aviso p {
  margin: 0;
}

/* Clases compartidas por las pestañas (tomadas del boceto). */
.analizar :global(fieldset) {
  margin: 0;
  padding: 0;
  min-inline-size: 0;
}
.analizar :global(fieldset:not(.seg)) {
  border: 0;
}
.analizar :global(.oculto) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.analizar :global(.h2) {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.analizar :global(.sub) {
  font-size: 12px;
  color: var(--gris-claro);
}
.analizar :global(.lnk) {
  font: inherit;
  font-size: 12px;
  background: transparent;
  border: 0;
  padding: 0;
  color: var(--acento);
  text-decoration: underline;
  cursor: pointer;
  white-space: nowrap;
}
.analizar :global(.sel) {
  font: inherit;
  font-size: 13px;
  height: 38px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
  color: var(--texto);
}
.analizar :global(.btn.sm) {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
}
.analizar :global(.tbl) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.analizar :global(.tbl th) {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--gris-claro);
  font-weight: 600;
  text-align: right;
  padding: 6px 4px;
  border-bottom: 1px solid var(--borde);
}
.analizar :global(.tbl th:first-child),
.analizar :global(.tbl td:first-child) {
  text-align: left;
}
.analizar :global(.tbl td) {
  padding: 7px 4px;
  border-bottom: 1px solid var(--chip);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.analizar :global(.tile) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--borde);
  border-radius: 8px;
  background: #ffffff;
  min-width: 0;
}
.analizar :global(.tile b) {
  font-size: 17px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.analizar :global(.tile span) {
  font-size: 12px;
  color: var(--gris-claro);
}
@media (max-width: 700px) {
  .analizar {
    padding: 16px;
  }
}
</style>
