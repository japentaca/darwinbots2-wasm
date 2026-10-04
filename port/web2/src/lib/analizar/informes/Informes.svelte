<script>
// @ts-check
// Pestaña Informes de Analizar (decisión 11, Nivel 2): elegir la plantilla
// (Corrida de la actual o de una guardada; Comparación de dos corridas;
// Réplicas de un trabajo terminado de la cola; Torneo de un torneo
// guardado, paso N3.5), el idioma del informe,
// generarlo (engine/report/), verlo (iframe con sandbox sin scripts que
// carga el .html desde una URL blob: así los enlaces #fig-… del informe
// navegan dentro de la vista previa; el .html descargado es el mismo),
// descargarlo e imprimirlo (se abre en una ventana y se llama a print).
// Los informes generados quedan en el almacén 'informes' (decisión 17) para
// volver a verlos, descargarlos o borrarlos. Aparte, «Solo datos» de la
// corrida que mira Analizar: CSV y JSON (engine/export.js) y el PNG de uno
// de los gráficos del Panel. Funciona sin corrida (corrida = null): se
// informa una guardada o un trabajo, y solo «Solo datos» queda desactivado.
import { onMount } from 'svelte';
import { csvLargo, jsonCorrida } from '../../../../engine/export.js';
import { generarInforme, TIPOS } from '../../../../engine/report/index.js';
import { idioma, idiomas, num, t } from '../../../i18n/index.svelte.js';
import { nombreTorneo } from '../../competir/textos.js';
import { clavePlural } from '../../experimentar/borrador.js';
import { descargar, nombreArchivo } from '../../observar/descargas.js';
import { almacen } from '../../sim/almacen.svelte.js';
import { actual, corridasGuardadas } from '../../sim/corrida.svelte.js';
import { estadoTrabajos, iniciarTrabajos } from '../../trabajos/trabajos.svelte.js';
import {
  CATALOGO,
  claveNombre,
  entrada,
  especiesPorImportancia,
  leerPanel,
  seriesDe,
} from '../catalogo.js';
import {
  fuenteActual as fuenteCmpActual,
  fuenteGuardada as fuenteCmpGuardada,
} from '../comparar/fuentes.js';
import { cargarGuardada, fuenteActual } from '../fuente.js';
import Grafico from '../grafico/Grafico.svelte';
import { ID_ACTUAL, rutaAnalizar } from '../ruta.js';
import {
  claveError,
  corridasPorDefecto,
  datosComparacion,
  datosCorrida,
  datosReplicas,
  datosTorneo,
  trabajosReplicas,
} from './datos.js';
import { borrarInforme, guardarInforme, leerInforme, listarInformes } from './guardados.js';
import { svgAPng } from './png.js';

/** @type {{ corrida: import('../fuente.js').FuenteAnalisis | null }} */
let { corrida } = $props();

const uid = $props.id();
/** Especies como mucho en la leyenda del PNG. */
const MAX_LEYENDA = 12;

/**
 * Texto con la forma plural de `n` (`clave.uno` / `clave.otros`).
 * @param {string} clave @param {number} n @param {Record<string, string | number>} [p]
 */
const tn = (clave, n, p = {}) => t(clavePlural(clave, n, idioma()), { ...p, n: num(n) });

/** @type {import('../../../../engine/report/index.js').TipoInforme} */
let plantilla = $state('corrida');
/** @type {import('../../../../engine/corridas.js').Corrida[]} */
let guardadas = $state.raw([]);
let origen = $state(ID_ACTUAL);
let cmpA = $state('');
let cmpB = $state('');
let trabajoSel = $state('');
/** @type {{id: string, name: string}[]} torneos guardados (plantilla Torneo) */
let torneosGuardados = $state.raw([]);
let torneoSel = $state('');
const trTorneo = { t, num: (/** @type {number} */ n) => num(n) };
let idiomaInforme = $state(idioma() === 'en' ? 'en' : 'es');
let ocupado = $state(false);
let error = $state('');
/** @type {import('./guardados.js').InformeGuardado | null} */
let generado = $state.raw(null);
/** @type {Omit<import('./guardados.js').InformeGuardado, 'html'>[]} */
let lista = $state.raw([]);

// ---- corridas y trabajos para elegir ---------------------------------------
const opciones = $derived([
  ...(actual.corrida ? [{ id: ID_ACTUAL, nombre: t('informes.actual') }] : []),
  ...guardadas.map((c) => ({
    id: /** @type {string} */ (c.id),
    nombre: `${c.nombre || t('informes.sinNombre')} · ${t('analizar.meta.ciclo', { n: num(c.ciclo) })}`,
  })),
]);
const trabajos = $derived(trabajosReplicas(estadoTrabajos.lista));

onMount(() => {
  corridasGuardadas()
    .listar()
    .then((l) => {
      guardadas = l;
    })
    .catch(() => {
      guardadas = [];
    });
  void refrescarLista();
  almacen()
    .list('torneos')
    .then((l) => {
      torneosGuardados = l
        .map((x) => ({
          id: String(x.id),
          name: nombreTorneo(x, trTorneo),
          created: String(x.created ?? ''),
        }))
        .sort((a, b) => b.created.localeCompare(a.created));
    })
    .catch(() => {
      torneosGuardados = [];
    });
});
$effect(() => {
  const ids = torneosGuardados.map((x) => x.id);
  if (!ids.includes(torneoSel)) torneoSel = ids[0] ?? '';
});

// Valores por defecto (se recalculan al cargar las guardadas o al cambiar
// la corrida que mira Analizar, mientras el usuario no tocó el selector):
// origen y A = la corrida que mira Analizar (la actual o una guardada); B =
// la actual si A es una guardada, si no la guardada más reciente. Si un
// valor elegido deja de existir, vuelve al de por defecto. El trabajo: el
// más reciente que se puede informar.
let tocadoOrigen = $state(false);
let tocadoCmp = $state(false);
const propia = $derived(corrida?.tipo === 'actual' ? ID_ACTUAL : (corrida?.id ?? ''));
$effect(() => {
  const ids = opciones.map((o) => o.id);
  const d = corridasPorDefecto(ids, propia, ID_ACTUAL);
  if (!tocadoOrigen || !ids.includes(origen)) origen = d.origen;
  if (!tocadoCmp || !ids.includes(cmpA) || !ids.includes(cmpB)) {
    cmpA = d.a;
    cmpB = d.b;
  }
});
$effect(() => {
  const ids = trabajos.listos.map((x) => x.id);
  if (!ids.includes(trabajoSel)) trabajoSel = ids[0] ?? '';
});

async function refrescarLista() {
  try {
    lista = await listarInformes(almacen());
  } catch {
    lista = [];
  }
}

/** Texto de un error: el traducido si trae código, si no su mensaje. @param {unknown} e */
const detalle = (e) => {
  const clave = claveError(e);
  if (clave) return t(clave);
  return e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
};

// ---- fuentes -----------------------------------------------------------------

/** Eventos (cambios en caliente) de una corrida. @param {string} id */
function cambiosDe(id) {
  if (id === ID_ACTUAL) return actual.corrida?.estado.eventos ?? [];
  return guardadas.find((c) => c.id === id)?.eventos ?? [];
}

/**
 * La corrida del informe «Corrida»: la que mira Analizar si es esa, o se
 * carga (la actual, en vivo; una guardada, solo lectura).
 * @param {string} id
 */
async function fuenteCorrida(id) {
  if (corrida && id === propia) return corrida;
  if (id === ID_ACTUAL)
    return actual.corrida ? fuenteActual(/** @type {any} */ (actual.corrida)) : null;
  return cargarGuardada(corridasGuardadas(), id);
}

/** Una corrida de la Comparación (con sus eventos). @param {string} id */
function fuenteComparar(id) {
  if (id === ID_ACTUAL)
    return Promise.resolve(fuenteCmpActual(actual.corrida, t('informes.actual')));
  return fuenteCmpGuardada(corridasGuardadas(), id);
}

const listo = $derived(
  plantilla === 'corrida'
    ? !!origen
    : plantilla === 'comparacion'
      ? !!cmpA && !!cmpB
      : plantilla === 'torneo'
        ? !!torneoSel
        : !!trabajoSel,
);

async function generar() {
  if (ocupado || !listo) return;
  ocupado = true;
  error = '';
  try {
    /** @type {any} */
    let datos;
    /** @type {string | null} */
    let idCorrida = null;
    if (plantilla === 'corrida') {
      const f = await fuenteCorrida(origen);
      if (!f) throw new Error(t('informes.error.sinCorrida'));
      datos = datosCorrida(f, cambiosDe(origen));
      idCorrida = origen === ID_ACTUAL ? null : origen;
    } else if (plantilla === 'comparacion') {
      const [fa, fb] = await Promise.all([fuenteComparar(cmpA), fuenteComparar(cmpB)]);
      if (!fa || !fb) throw new Error(t('informes.error.sinCorrida'));
      datos = datosComparacion(fa, fb);
    } else if (plantilla === 'torneo') {
      const L = await almacen().get('torneos', torneoSel);
      if (!L) throw new Error(t('competir.informe.sinTorneo'));
      const partidos = await almacen().porIndice('partidos', 'league', torneoSel);
      datos = datosTorneo(L, partidos, { titulo: nombreTorneo(L, trTorneo) });
    } else {
      const reg = await almacen().get('trabajos', trabajoSel);
      if (!reg) throw new Error(t('informes.error.sinTrabajo'));
      const res = await iniciarTrabajos().resultados(trabajoSel);
      datos = datosReplicas(reg, res);
    }
    const inf = generarInforme(plantilla, datos, {
      idioma: idiomaInforme === 'en' ? 'en' : 'es',
    });
    const titulo = String(/** @type {any} */ (inf.datos).titulo ?? inf.archivo);
    generado = await guardarInforme(almacen(), {
      tipo: plantilla,
      titulo,
      archivo: inf.archivo,
      idioma: idiomaInforme,
      html: inf.html,
      corrida: idCorrida,
    });
    await refrescarLista();
  } catch (e) {
    error = t('informes.error.generar', { detalle: detalle(e) });
  } finally {
    ocupado = false;
  }
}

// Vista previa desde una URL blob (se revoca al cambiar de informe o al
// desmontar): con srcdoc la URL base del documento sería la de la app y los
// enlaces #fig-… navegarían el iframe fuera del informe.
const urlVista = $derived(
  generado
    ? URL.createObjectURL(new Blob([generado.html], { type: 'text/html;charset=utf-8' }))
    : '',
);
$effect(() => {
  const u = urlVista;
  return () => {
    if (u) URL.revokeObjectURL(u);
  };
});

/** @param {{html: string, archivo: string}} inf */
function bajarHtml(inf) {
  descargar(new Blob([inf.html], { type: 'text/html;charset=utf-8' }), inf.archivo);
}

/**
 * Abre el informe en una ventana propia (es el mismo .html autocontenido) y
 * llama a print() cuando cargó.
 * @param {{html: string}} inf
 */
function imprimir(inf) {
  error = '';
  const url = URL.createObjectURL(new Blob([inf.html], { type: 'text/html;charset=utf-8' }));
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    error = t('informes.error.ventana');
    return;
  }
  // la ventana es del mismo origen (URL blob): se espera a que cargue
  w.addEventListener(
    'load',
    () => {
      w.focus();
      w.print();
    },
    { once: true },
  );
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** @param {string} id @param {(inf: import('./guardados.js').InformeGuardado) => void} fn */
async function conGuardado(id, fn) {
  error = '';
  try {
    const r = await leerInforme(almacen(), id);
    if (!r) {
      error = t('informes.error.inexistente');
      await refrescarLista();
      return;
    }
    fn(r);
  } catch (e) {
    error = t('informes.error.almacen', { detalle: detalle(e) });
  }
}

/** @param {string} id */
async function borrar(id) {
  error = '';
  try {
    await borrarInforme(almacen(), id);
    if (generado?.id === id) generado = null;
    await refrescarLista();
  } catch (e) {
    error = t('informes.error.almacen', { detalle: detalle(e) });
  }
}

const fechaCorta = $derived(
  new Intl.DateTimeFormat(idioma(), { dateStyle: 'medium', timeStyle: 'short' }),
);
/** @param {string} iso */
const fecha = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fechaCorta.format(d);
};
/** @param {number} b */
const tamaño = (b) => t('informes.kb', { n: num(Math.max(1, Math.round(b / 1024))) });

// ---- solo datos de la corrida que mira Analizar ------------------------------
const base = $derived(
  nombreArchivo(`datos_${corrida?.nombre || t('informes.sinNombre')}`, '').replace(/\.$/, ''),
);

function bajarCsv() {
  if (!corrida) return;
  descargar(
    new Blob([csvLargo(corrida.historia)], { type: 'text/csv;charset=utf-8' }),
    `${base}.csv`,
  );
}

function bajarJson() {
  if (!corrida) return;
  const id = corrida.tipo === 'actual' ? ID_ACTUAL : (corrida.id ?? '');
  const texto = jsonCorrida({
    historia: corrida.historia,
    linaje: corrida.linaje,
    eventos: cambiosDe(id),
    meta: { nombre: corrida.nombre, semilla: corrida.semilla, escenario: corrida.escenario },
  });
  descargar(new Blob([texto], { type: 'application/json' }), `${base}.json`);
}

// PNG: uno de los gráficos del Panel (los que eligió el usuario).
/** @returns {Storage | null} */
function almacenLocal() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
const graficosPanel = leerPanel(almacenLocal());
let graficoPng = $state(graficosPanel[0] ?? CATALOGO[0].id);
const entradaPng = $derived(entrada(graficoPng) ?? CATALOGO[0]);
const nombrePng = $derived(t(claveNombre(entradaPng)));
const seriesPng = $derived(
  corrida
    ? seriesDe(corrida.historia, entradaPng, {
        colores: corrida.colores,
        nombreGlobal: nombrePng,
        otras: t('analizar.otras'),
        especies: especiesPorImportancia(corrida.historia),
      })
    : [],
);
/** La leyenda del PNG se corta en MAX_LEYENDA series (se avisa). */
const leyendaCortada = $derived(seriesPng.length > MAX_LEYENDA);
/** @type {HTMLDivElement | undefined} */
let cajaPng = $state();
let haciendoPng = $state(false);

async function bajarPng() {
  const svg = cajaPng?.querySelector('svg');
  if (!svg) {
    error = t('informes.error.png', { detalle: t('analizar.grafico.sinDatos') });
    return;
  }
  haciendoPng = true;
  error = '';
  try {
    const blob = await svgAPng(/** @type {SVGSVGElement} */ (svg), {
      titulo: `${nombrePng} · ${corrida?.nombre ?? ''}`,
      leyenda:
        seriesPng.length > 1
          ? seriesPng.slice(0, MAX_LEYENDA).map((s) => ({ nombre: s.nombre, color: s.color }))
          : [],
    });
    descargar(blob, `${base}_${nombreArchivo(nombrePng, '.png')}`);
  } catch (e) {
    error = t('informes.error.png', { detalle: detalle(e) });
  } finally {
    haciendoPng = false;
  }
}
</script>

<div class="informes">
  <div class="principal">
    <section class="card bloque">
      <h2 class="h2">{t('informes.paso.plantilla')}</h2>
      <fieldset class="plantillas">
        <legend class="oculto">{t('informes.paso.plantilla')}</legend>
        {#each TIPOS as p (p)}
          <button
            type="button"
            class="tpl"
            class:on={plantilla === p}
            aria-pressed={plantilla === p}
            onclick={() => (plantilla = p)}
          >
            <strong>{p === 'torneo' ? t('competir.informe.tpl') : t(`informes.tpl.${p}`)}</strong>
            <span class="desc"
              >{p === 'torneo' ? t('competir.informe.tpl.desc') : t(`informes.tpl.${p}.desc`)}</span
            >
            <span class="mono src">
              {#if p === 'torneo'}
                {t('competir.informe.tpl.src', { n: num(torneosGuardados.length) })}
              {:else if p === 'corrida'}
                {corrida ? corrida.nombre || t('informes.actual') : t('informes.tpl.corrida.src')}
              {:else if p === 'comparacion'}
                {t('informes.tpl.comparacion.src')}
              {:else}
                {tn('informes.tpl.replicas.src', trabajos.listos.length)}
              {/if}
            </span>
          </button>
        {/each}
      </fieldset>
    </section>

    <section class="card bloque">
      <h2 class="h2">{t('informes.paso.opciones')}</h2>
      {#if plantilla === 'torneo'}
        {#if torneosGuardados.length}
          <label class="campo">
            {t('competir.informe.torneo')}
            <select class="sel" bind:value={torneoSel}>
              {#each torneosGuardados as x (x.id)}
                <option value={x.id}>{x.name}</option>
              {/each}
            </select>
          </label>
          <p class="sub">{t('competir.informe.temporadaNota')}</p>
        {:else}
          <p class="sub">
            {t('competir.informe.sinTorneos')}
            <a href="#/competir">{t('competir.informe.irCompetir')}</a>
          </p>
        {/if}
      {:else if plantilla !== 'replicas' && !opciones.length}
        <p class="sub">{t('informes.sinCorridas')}</p>
      {:else if plantilla === 'corrida'}
        <label class="campo">
          {t('informes.corrida')}
          <select class="sel" bind:value={origen} onchange={() => (tocadoOrigen = true)}>
            {#each opciones as o (o.id)}
              <option value={o.id}>{o.nombre}</option>
            {/each}
          </select>
        </label>
      {:else if plantilla === 'comparacion'}
        <div class="dos">
          <label class="campo">
            {t('informes.corridaA')}
            <select class="sel" bind:value={cmpA} onchange={() => (tocadoCmp = true)}>
              {#each opciones as o (o.id)}
                <option value={o.id}>{o.nombre}</option>
              {/each}
            </select>
          </label>
          <label class="campo">
            {t('informes.corridaB')}
            <select class="sel" bind:value={cmpB} onchange={() => (tocadoCmp = true)}>
              {#each opciones as o (o.id)}
                <option value={o.id}>{o.nombre}</option>
              {/each}
            </select>
          </label>
        </div>
        {#if opciones.length < 2}
          <p class="sub">{t('informes.faltanCorridas')}</p>
        {:else if cmpA === cmpB}
          <p class="sub">{t('informes.mismaCorrida')}</p>
        {/if}
      {:else if trabajos.listos.length}
        <label class="campo">
          {t('informes.trabajo')}
          <select class="sel" bind:value={trabajoSel}>
            {#each trabajos.listos as x (x.id)}
              <option value={x.id}>
                {x.parcial
  ? t('informes.trabajoParcial', {
      titulo: x.titulo || t('comparar.trabajos.sinTitulo'),
      hechas: num(x.hechas),
      n: num(x.n),
    })
  : x.titulo || t('comparar.trabajos.sinTitulo')}
              </option>
            {/each}
          </select>
        </label>
      {:else}
        <p class="sub">
          {trabajos.enCola ? tn('informes.sinTrabajosEnCola', trabajos.enCola) : t('informes.sinTrabajos')}
          <a href={rutaAnalizar(ID_ACTUAL, 'comparar')}>{t('informes.irComparar')}</a>
        </p>
      {/if}
      <label class="campo">
        {t('informes.idioma')}
        <select class="sel" bind:value={idiomaInforme}>
          {#each idiomas as l (l)}
            <option value={l}>{t(`informes.idioma.${l}`)}</option>
          {/each}
        </select>
      </label>
      <p class="sub">{t('informes.resumenNota')}</p>
      <div class="acciones">
        <button class="btn pri" type="button" disabled={!listo || ocupado} onclick={generar}>
          {ocupado ? t('informes.generando') : t('informes.generar')}
        </button>
        <button
          class="btn"
          type="button"
          disabled={!generado}
          onclick={() => generado && bajarHtml(generado)}
        >
          {t('informes.descargar')}
        </button>
        <button
          class="btn"
          type="button"
          disabled={!generado}
          onclick={() => generado && imprimir(generado)}
        >
          {t('informes.imprimir')}
        </button>
      </div>
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
    </section>

    <section class="card bloque">
      <h2 class="h2">{t('informes.datos')}</h2>
      <p class="sub">
        {corrida
  ? t('informes.datos.sub', { nombre: corrida.nombre || t('informes.actual') })
  : t('informes.datos.sinCorrida')}
      </p>
      <div class="acciones">
        <button class="btn sm" type="button" disabled={!corrida} onclick={bajarCsv}>
          {t('informes.datos.csv')}
        </button>
        <button class="btn sm" type="button" disabled={!corrida} onclick={bajarJson}>
          {t('informes.datos.json')}
        </button>
      </div>
      <div class="png">
        <label class="campo">
          {t('informes.png.grafico')}
          <select class="sel" bind:value={graficoPng}>
            {#each graficosPanel as id, i (`${i}:${id}`)}
              <option value={id}>{t(claveNombre(entrada(id) ?? CATALOGO[0]))}</option>
            {/each}
          </select>
        </label>
        <div class="png-vista" bind:this={cajaPng}>
          <Grafico
            series={seriesPng}
            modo={entradaPng.modo}
            alto={180}
            cero={entradaPng.cero}
            aria={nombrePng}
            vacio={t('analizar.grafico.sinDatos')}
          />
        </div>
        <button
          class="btn sm"
          type="button"
          disabled={!corrida || haciendoPng || !seriesPng.length}
          onclick={bajarPng}
        >
          {t('informes.png.bajar')}
        </button>
        {#if corrida && leyendaCortada}
          <p class="sub">
            {t('informes.png.leyendaCortada', { max: num(MAX_LEYENDA), n: num(seriesPng.length) })}
          </p>
        {/if}
      </div>
    </section>
  </div>

  <aside>
    <section class="card bloque">
      <h2 class="h2" id={`${uid}-vista`}>{t('informes.vista')}</h2>
      {#if generado}
        <div class="vista-cab">
          <span class="nombre-inf">{generado.titulo}</span>
          <span class="sub mono">{generado.archivo}</span>
        </div>
        <iframe
          class="vista"
          title={t('informes.vistaTitulo', { titulo: generado.titulo })}
          sandbox=""
          src={urlVista}
        ></iframe>
      {:else}
        <p class="sub">{t('informes.vistaVacia')}</p>
      {/if}
      <p class="sub">{t('informes.vistaNota')}</p>
    </section>

    <section class="card bloque">
      <h2 class="h2">{t('informes.generados')}</h2>
      {#each lista as x (x.id)}
        <div class="fila" class:on={generado?.id === x.id}>
          <span class="fila-txt">
            <span class="nombre-inf">{x.titulo}</span>
            <span class="sub">
              {x.tipo === 'torneo' ? t('competir.informe.tpl') : t(`informes.tpl.${x.tipo}`)}
              · {x.idioma.toUpperCase()} · {fecha(x.fecha)} · {tamaño(x.bytes)}
            </span>
          </span>
          <span class="fila-acc">
            <button
              class="lnk"
              type="button"
              onclick={() => conGuardado(x.id, (r) => (generado = r))}
            >
              {t('informes.ver')}
            </button>
            <button class="lnk" type="button" onclick={() => conGuardado(x.id, bajarHtml)}>
              {t('informes.bajar')}
            </button>
            <button
              class="lnk"
              type="button"
              aria-label={t('informes.borrarAria', { titulo: x.titulo })}
              onclick={() => borrar(x.id)}
            >
              {t('informes.borrar')}
            </button>
          </span>
        </div>
      {:else}
        <p class="sub">{t('informes.ninguno')}</p>
      {/each}
    </section>
  </aside>
</div>

<style>
.informes {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 440px;
  gap: 24px;
  align-items: start;
}
.principal,
aside {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.bloque {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.plantillas {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.tpl {
  font: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--borde-control);
  border-radius: 8px;
  background: var(--tarjeta);
  color: var(--texto);
  cursor: pointer;
}
.tpl strong {
  font-size: 15px;
}
.tpl.on {
  border-color: var(--acento);
  box-shadow: inset 0 0 0 1px var(--acento);
  background: var(--seleccion-suave);
}
.desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
}
.src {
  font-size: 11px;
  color: var(--gris-claro);
  overflow-wrap: anywhere;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--gris);
}
.dos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.error {
  margin: 0;
  font-size: 13px;
  color: var(--error-texto);
}
.sub {
  margin: 0;
}
.png {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--borde);
}
.png-vista {
  min-width: 0;
}
.vista-cab {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.vista {
  width: 100%;
  height: 560px;
  border: 1px solid var(--borde);
  border-radius: 8px;
  background: var(--chip);
}
.nombre-inf {
  font-weight: 500;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.fila {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid var(--borde);
  font-size: 13px;
}
.fila.on .nombre-inf {
  color: var(--acento);
}
.fila-txt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.fila-acc {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  flex-shrink: 0;
}
@media (max-width: 1100px) {
  .informes {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 700px) {
  .plantillas,
  .dos {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
