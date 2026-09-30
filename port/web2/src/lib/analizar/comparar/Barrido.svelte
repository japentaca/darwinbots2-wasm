<script>
// @ts-check
// «Barrido» (Nivel 4, decisión 10): el escenario de una corrida con UN
// parámetro del catálogo en k valores × N semillas, en la cola de trabajos
// (engine/barrido.js; cada unidad corre como una réplica). Resultado: el
// valor final de la métrica contra el valor del parámetro (media y banda
// p10–p90 sobre las semillas), la tabla por valor, la serie media de cada
// valor superpuesta y la exportación (CSV e informe .html). Con unidades a
// medias se muestra lo que ya terminó.
//
// Resultados: LectorBarrido (engine/barrido.js) los guarda por unidad y lee
// del almacén solo las que terminan; las series de cada unidad se extraen
// una vez, y las superpuestas se calculan solo con su gráfico a la vista.
// Las unidades con la ronda reiniciada no entran en la tabla ni en los
// gráficos: se listan aparte y se marcan en la grilla de estado.
import {
  agregarBarrido,
  colorValor,
  csvBarrido,
  csvBarridoUnidades,
  escritasPor,
  grilla,
  LectorBarrido,
  listaDeTexto,
  MAX_SEMILLAS,
  MAX_UNIDADES,
  MAX_VALORES,
  reescritosBarrido,
  reiniciada,
  reiniciosBarrido,
  seriesBarrido,
  TIPO_BARRIDO,
  unidadDe,
  valoresOrigen,
} from '../../../../engine/barrido.js';
import { idResultado, ST_TRABAJOS } from '../../../../engine/cola.js';
import { PARAMETROS, parametro } from '../../../../engine/opciones.js';
import { METRICAS_CLAVE } from '../../../../engine/replicas.js';
import { generarInforme } from '../../../../engine/report/index.js';
import { idioma, num, t } from '../../../i18n/index.svelte.js';
import { coincideBusqueda } from '../../experimentar/avanzado.js';
import { clavePlural } from '../../experimentar/borrador.js';
import { descargar, nombreArchivo } from '../../observar/descargas.js';
import { almacen } from '../../sim/almacen.svelte.js';
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
import { lanzarBarrido } from './lanzar.js';
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
const BARRIBLES = PARAMETROS.filter((p) => !p.derivado);
const MAX_LISTA = 60;

let origen = $state('');
/** @type {import('./fuentes.js').Fuente | null} */
let fuente = $state.raw(null);
let busqueda = $state('');
let clave = $state('base:maxEnergy');
let modo = $state(/** @type {'lineal' | 'lista'} */ ('lineal'));
let desde = $state(5);
let hasta = $state(20);
let pasos = $state(4);
let listaTexto = $state('');
let n = $state(4);
let ciclos = $state(3000);
let metricaNueva = $state('vivos');
let lanzando = $state(false);
let error = $state('');
let avisoAdn = $state('');
let seleccion = $state('');
let tope = $state(estadoTrabajos.paralelo);

/**
 * Texto con la forma plural de `n` (`clave.uno` / `clave.otros`).
 * @param {string} c @param {number} n @param {Record<string, string | number>} [p]
 */
const tn = (c, n, p = {}) => t(clavePlural(c, n, idioma()), { ...p, n: num(n) });

/** Nombre de un parámetro en el idioma de la interfaz. @param {string} c */
const nombrePar = (c) => {
  const p = parametro(c);
  return p ? (idioma() === 'en' ? p.en : p.es) : c;
};

/** @param {number} v */
const fmt = (v) => (Number.isFinite(v) ? num(v, { maximumFractionDigits: 4 }) : '—');

/** Valor de un parámetro para mostrar (enum → su texto; bool → sí/no). @param {string} c @param {number} v */
function valorTexto(c, v) {
  const p = parametro(c);
  if (p?.valor === 'enum') {
    const e = p.valores?.find((o) => o.v === v);
    if (e) return idioma() === 'en' ? e.en : e.es;
  }
  if (p?.valor === 'bool') return v ? t('comparar.dif.si') : t('comparar.dif.no');
  return fmt(v);
}

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
    if (k === pedido) {
      fuente = f;
      rangoPorDefecto(clave);
    }
  } catch (e) {
    if (k === pedido) error = t('comparar.errorCarga', { detalle: String(e) });
  }
}

// ---- Parámetro y grilla ----------------------------------------------------
const candidatos = $derived(
  BARRIBLES.filter((p) => coincideBusqueda(p, busqueda)).slice(0, MAX_LISTA),
);
const par = $derived(parametro(clave));

/**
 * Valor del parámetro en la corrida de origen: al arrancar y tras sus
 * cambios en caliente (NaN si no hay). @param {string} c
 */
const valorOrigenDe = (c) => valoresOrigen(fuente?.escenario, fuente?.eventos ?? [], c);
const valorOrigen = $derived(valorOrigenDe(clave));
/** Cambios en caliente de la corrida que escriben el parámetro (se reescriben). */
const reescritos = $derived(reescritosBarrido(fuente?.eventos ?? [], clave));
/** Otros parámetros que fija el barrido (97 → 101). */
const arrastra = $derived(escritasPor(clave).filter((c) => c !== clave));

/**
 * Rango inicial: bool y enum, de su mínimo a su máximo; si no, de la mitad
 * al doble del valor de origen (o de 0 a 10). @param {string} c
 */
function rangoPorDefecto(c) {
  const p = parametro(c);
  if (p?.valor === 'bool') {
    desde = 0;
    hasta = p.on ?? 1;
    return;
  }
  if (p?.valor === 'enum' && p.valores?.length) {
    const vs = p.valores.map((x) => x.v);
    desde = Math.min(...vs);
    hasta = Math.max(...vs);
    return;
  }
  const v = valorOrigenDe(c).inicio;
  const ent = p?.valor === 'int';
  if (Number.isFinite(v) && v > 0) {
    desde = ent ? Math.max(0, Math.round(v / 2)) : v / 2;
    hasta = ent ? Math.round(v * 2) : v * 2;
  } else {
    desde = 0;
    hasta = 10;
  }
}

/** @param {string} c */
function elegirParametro(c) {
  clave = c;
  rangoPorDefecto(c);
}

const espec = $derived.by(() => {
  if (modo === 'lineal')
    return { modo, desde: Number(desde), hasta: Number(hasta), pasos: Number(pasos) };
  return { modo, valores: listaDeTexto(listaTexto) ?? [Number.NaN] };
});

const previa = $derived.by(() => {
  try {
    const g = grilla(clave, /** @type {any} */ (espec));
    return { ...g, error: '' };
  } catch (e) {
    const x = /** @type {any} */ (e);
    return {
      valores: /** @type {number[]} */ ([]),
      avisos: [],
      error: textoError(t, x?.codigo, String(x?.message ?? x)),
    };
  }
});
const unidades = $derived(previa.valores.length * Math.max(0, Math.trunc(n) || 0));
const avisosGrilla = $derived.by(() => {
  const out = [];
  const vistos = new Set();
  for (const a of previa.avisos) {
    if (a.codigo === 'repetido') continue;
    const k = `${a.codigo}|${a.valor}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(t(`comparar.bar.aviso.${a.codigo}`, { valor: valorTexto(clave, a.valor) }));
  }
  const juntados = previa.avisos.filter((a) => a.codigo === 'repetido').length;
  if (juntados) out.push(tn('comparar.bar.aviso.juntados', juntados));
  return out;
});

async function lanzar() {
  if (!fuente || previa.error) return;
  lanzando = true;
  error = '';
  avisoAdn = '';
  try {
    const f = origen === ID_ACTUAL ? ((await cargar(origen)) ?? fuente) : fuente;
    const titulo = tn('comparar.bar.titulo', n, {
      nombre: f.nombre,
      parametro: nombrePar(clave),
      k: num(previa.valores.length),
      ciclos: num(ciclos),
    });
    const metricas = [metricaNueva, ...METRICAS_CLAVE.filter((m) => m !== metricaNueva)];
    const r = await lanzarBarrido(iniciarTrabajos(), f, {
      clave,
      grilla: /** @type {any} */ (espec),
      n,
      ciclos,
      metricas,
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
/** Parámetros livianos del trabajo (vistaBarrido). */
const vp = $derived(
  /** @type {{clave: string, valores: number[], semillas: number[], metricas: string[],
   *   ciclos: number} | null} */ (trabajo?.params?.valores ? trabajo.params : null),
);
const hechas = $derived(trabajo ? trabajo.unidades.filter((u) => u.estado === 'hecha').length : 0);
let metricaVer = $state('vivos');
/** @type {any[]} */
let resultados = $state.raw([]);

/**
 * Caché de resultados de un trabajo (lee solo las unidades nuevas).
 * @param {string} id
 */
const nuevoLector = (id) =>
  new LectorBarrido((i) =>
    almacen()
      .get(ST_TRABAJOS, idResultado(id, i))
      .then((r) => r?.datos ?? null),
  );
/** @type {LectorBarrido | null} */
let lector = null;

let visto = '';
$effect(() => {
  if (!trabajo || trabajo.id === visto) return;
  visto = trabajo.id;
  metricaVer = trabajo.params?.metrica ?? 'vivos';
  resultados = [];
  lector = nuevoLector(trabajo.id);
});

// Resultados: al cambiar el estado de las unidades se leen las nuevas.
$effect(() => {
  const tr = trabajo;
  void hechas;
  const l = lector;
  if (!tr || !l || tr.id !== visto) return;
  l.actualizar(tr.unidades).then(
    (cambio) => {
      if (cambio && l === lector) resultados = l.resultados;
    },
    () => {},
  );
});

const filas = $derived(vp ? agregarBarrido(vp, resultados, [metricaVer]) : []);
const reinicios = $derived(vp ? reiniciosBarrido(vp, resultados) : []);
const hayReinicios = $derived(reinicios.length > 0);
/** Marcas del eje X con su texto: bool y enum, solo los valores de la grilla. */
const marcasX = $derived.by(() => {
  const p = vp ? parametro(vp.clave) : null;
  if (!vp || (p?.valor !== 'bool' && p?.valor !== 'enum')) return null;
  return vp.valores.map((v) => ({ v, texto: valorTexto(vp.clave, v) }));
});
const curva = $derived.by(() => {
  const ok = filas.filter((f) => Number.isFinite(f.metricas[metricaVer]?.media));
  if (!ok.length || !vp) return [];
  const nMax = Math.max(...ok.map((f) => f.n));
  return [
    {
      etiqueta: tn('comparar.bar.curva', nMax, { metrica: t(`analizar.m.g.${metricaVer}`) }),
      color: COLOR,
      t: ok.map((f) => f.valor),
      media: ok.map((f) => f.metricas[metricaVer].media),
      bajo: ok.map((f) => f.metricas[metricaVer].p10),
      alto: ok.map((f) => f.metricas[metricaVer].p90),
    },
  ];
});
// Las series superpuestas solo se calculan con su gráfico a la vista.
let seriesVisible = $state(false);
/** @param {HTMLElement} nodo */
function alVerse(nodo) {
  if (typeof IntersectionObserver === 'undefined') {
    seriesVisible = true;
    return;
  }
  const io = new IntersectionObserver((es) => {
    seriesVisible = es.some((e) => e.isIntersecting);
  });
  io.observe(nodo);
  return { destroy: () => io.disconnect() };
}
const superpuestas = $derived.by(() => {
  if (!vp || !seriesVisible) return [];
  const k = vp.valores.length;
  const l = lector;
  const m = metricaVer;
  return seriesBarrido(vp, resultados, m, l ? (i) => l.serie(i, m) : undefined)
    .map((s, i) => ({
      etiqueta: `${nombrePar(vp.clave)} = ${valorTexto(vp.clave, s.valor)}`,
      color: colorValor(i, k),
      t: s.agregado.t,
      media: s.agregado.media,
      bajo: s.agregado.media,
      alto: s.agregado.media,
    }))
    .filter((s) => s.t.length);
});

/** Estado de la unidad (valor v, semilla s). @param {number} v @param {number} s */
function unidad(v, s) {
  if (!trabajo || !vp) return null;
  return trabajo.unidades[unidadDe(vp, v, s)] ?? null;
}

// ---- Exportar --------------------------------------------------------------
let errorExportar = $state('');

/** Base de los nombres de archivo. */
const baseArchivo = $derived(nombreArchivo(trabajo?.titulo || t('comparar.bar.archivo'), ''));

/** @param {'resumen' | 'unidades'} cual */
function bajarCsv(cual) {
  if (!vp) return;
  const p = /** @type {any} */ (vp);
  const texto = cual === 'resumen' ? csvBarrido(p, resultados) : csvBarridoUnidades(p, resultados);
  descargar(
    new Blob([texto], { type: 'text/csv;charset=utf-8' }),
    `${baseArchivo}_${cual === 'resumen' ? 'resumen' : 'semillas'}.csv`,
  );
}

async function bajarInforme() {
  errorExportar = '';
  try {
    const reg = await almacen().get(ST_TRABAJOS, seleccion);
    if (!reg) throw new Error(t('comparar.bar.sinTrabajo'));
    // de la caché si es la del trabajo (lee solo lo que falte)
    const l = lector && visto === seleccion ? lector : nuevoLector(seleccion);
    await l.actualizar(reg.unidades ?? []);
    const res = l.resultados;
    const p = reg.params ?? {};
    const inf = generarInforme(
      'barrido',
      {
        escenario: p.escenario ?? null,
        clave: p.clave,
        valores: p.valores ?? [],
        semillas: p.semillas ?? [],
        ciclos: p.ciclos,
        cada: p.cada,
        metricas: [
          metricaVer,
          ...(p.metricas ?? []).filter((/** @type {string} */ m) => m !== metricaVer),
        ],
        origen: p.origen,
        eventos: p.eventos ?? [],
        resultados: Array.from(
          { length: (p.valores?.length ?? 0) * (p.semillas?.length ?? 0) },
          (_, i) => res?.[i] ?? null,
        ),
        titulo: reg.titulo || undefined,
        fecha: Date.now(),
      },
      { idioma: idioma() === 'en' ? 'en' : 'es' },
    );
    descargar(new Blob([inf.html], { type: 'text/html;charset=utf-8' }), inf.archivo);
  } catch (e) {
    const x = /** @type {any} */ (e);
    errorExportar =
      x?.codigo === 'falta-barrido'
        ? t('comparar.bar.error.falta-barrido')
        : t('comparar.bar.errorInforme', { detalle: String(x?.message ?? e) });
  }
}
</script>

<div class="bar">
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
    <p class="nota">{t('comparar.bar.origenAyuda')}</p>
    {#if fuente && !fuente.escenario}
      <p class="error">{t('comparar.rep.sinEscenario')}</p>
    {/if}

    <h3>{t('comparar.bar.parametro')}</h3>
    <div class="fila">
      <label for={`${uid}-b`}>{t('comparar.bar.buscar')}</label>
      <input
        id={`${uid}-b`}
        type="search"
        class="buscar"
        bind:value={busqueda}
        placeholder={t('comparar.bar.buscarAyuda')}
      >
      <select
        aria-label={t('comparar.bar.parametro')}
        value={clave}
        onchange={(e) => elegirParametro(/** @type {HTMLSelectElement} */ (e.currentTarget).value)}
      >
        {#if !candidatos.some((p) => p.clave === clave)}
          <option value={clave}>{nombrePar(clave)} · {clave}</option>
        {/if}
        {#each candidatos as p (p.clave)}
          <option value={p.clave}>{nombrePar(p.clave)} · {p.variable} · {p.clave}</option>
        {/each}
      </select>
    </div>
    {#if par}
      <p class="nota">
        {idioma() === 'en' ? par.ayuda.en : par.ayuda.es}
        {#if Number.isFinite(valorOrigen.inicio)}
          {Number.isFinite(valorOrigen.fin) && valorOrigen.fin !== valorOrigen.inicio
  ? t('comparar.bar.valorOrigenCambia', {
      inicio: valorTexto(clave, valorOrigen.inicio),
      fin: valorTexto(clave, valorOrigen.fin),
    })
  : t('comparar.bar.valorOrigen', { valor: valorTexto(clave, valorOrigen.inicio) })}
        {/if}
        {#if par.sugerido}
          {t('comparar.bar.sugerido', { min: fmt(par.sugerido.min), max: fmt(par.sugerido.max) })}
        {/if}
      </p>
      {#if arrastra.length}
        <p class="nota">
          {t('comparar.bar.arrastra', {
  parametro: nombrePar(clave),
  otros: arrastra.map(nombrePar).join(', '),
})}
        </p>
      {/if}
      {#if reescritos}
        <p class="nota">{tn('comparar.bar.reescritos', reescritos)}</p>
      {/if}
    {/if}

    <div class="fila" role="radiogroup" aria-label={t('comparar.bar.modo')}>
      <label
        ><input type="radio" bind:group={modo} value="lineal"> {t('comparar.bar.lineal')}</label
      >
      <label><input type="radio" bind:group={modo} value="lista"> {t('comparar.bar.lista')}</label>
    </div>
    {#if modo === 'lineal'}
      <div class="fila">
        <label for={`${uid}-d`}>{t('comparar.bar.desde')}</label>
        <input id={`${uid}-d`} type="number" step="any" bind:value={desde}>
        <label for={`${uid}-h`}>{t('comparar.bar.hasta')}</label>
        <input id={`${uid}-h`} type="number" step="any" bind:value={hasta}>
        <label for={`${uid}-k`}>{t('comparar.bar.pasos')}</label>
        <input id={`${uid}-k`} type="number" min="2" max={MAX_VALORES} bind:value={pasos}>
      </div>
    {:else}
      <div class="fila">
        <label for={`${uid}-l`}>{t('comparar.bar.valoresLista')}</label>
        <input
          id={`${uid}-l`}
          type="text"
          class="lista"
          bind:value={listaTexto}
          placeholder={t('comparar.bar.listaAyuda')}
        >
      </div>
      {#if par?.valor === 'int'}
        <p class="nota">{t('comparar.bar.listaEntera')}</p>
      {/if}
    {/if}
    {#if modo === 'lineal' && par?.valor === 'int'}
      <p class="nota">{t('comparar.bar.linealEntera')}</p>
    {/if}
    {#if previa.error}
      <p class="error">{previa.error}</p>
    {:else}
      <p class="nota mono">
        {t('comparar.bar.previa', {
  lista: previa.valores.map((v) => valorTexto(clave, v)).join(' · '),
})}
      </p>
    {/if}
    {#each avisosGrilla as a, i (i)}
      <p class="nota">{a}</p>
    {/each}

    <div class="fila">
      <label for={`${uid}-n`}>{t('comparar.bar.semillas')}</label>
      <input id={`${uid}-n`} type="number" min="1" max={MAX_SEMILLAS} bind:value={n}>
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
    <p class="nota">
      {t('comparar.bar.unidades', { n: num(unidades), max: num(MAX_UNIDADES) })}
    </p>
    <div class="fila">
      <button
        type="button"
        class="btn pri"
        disabled={!fuente?.escenario || lanzando || !!previa.error || unidades > MAX_UNIDADES}
        onclick={lanzar}
      >
        {lanzando ? t('comparar.rep.lanzando') : t('comparar.bar.lanzar')}
      </button>
    </div>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    {#if avisoAdn}
      <p class="aviso" role="status">{avisoAdn}</p>
    {/if}
  </section>

  <ListaTrabajos tipo={TIPO_BARRIDO} bind:seleccion titulo={t('comparar.bar.trabajos')} />

  {#if trabajo && vp}
    <section class="card bloque">
      <h2>{trabajo.titulo || t('comparar.trabajos.sinTitulo')}</h2>
      <table class="rejilla">
        <thead>
          <tr>
            <th>{nombrePar(vp.clave)}</th>
            {#each vp.semillas as s (s)}
              <th class="mono" title={t('comparar.rep.semilla', { n: String(s) })}>{s}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each vp.valores as v, iv (iv)}
            <tr>
              <th class="mono">{valorTexto(vp.clave, v)}</th>
              {#each vp.semillas as _s, is (is)}
                {@render celda(unidad(iv, is), reiniciada(resultados[unidadDe(vp, iv, is)]))}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
      {#if !hechas}
        <p class="nota">{t('comparar.bar.sinResultados')}</p>
      {:else}
        {#if hayReinicios}
          <div class="aviso" role="status">
            <p>{tn('comparar.bar.reinicios', reinicios.length)}</p>
            <ul>
              {#each reinicios as r (r.i)}
                <li>
                  {t('comparar.bar.reinicio', {
  parametro: nombrePar(vp.clave),
  valor: valorTexto(vp.clave, vp.valores[r.v]),
  semilla: String(vp.semillas[r.s]),
  ciclo: num(r.ciclo),
})}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if hechas < trabajo.unidades.length}
          <p class="nota">
            {t('comparar.bar.parcial', {
  hechas: num(hechas),
  total: num(trabajo.unidades.length),
})}
          </p>
        {/if}
        <SelectorMetrica bind:metrica={metricaVer} />
        <GraficoBandas
          series={curva}
          titulo={t('comparar.bar.graficoFinal', {
  metrica: t(`analizar.m.g.${metricaVer}`),
  parametro: nombrePar(vp.clave),
})}
          banda={t('comparar.bar.banda')}
          xReal
          puntos
          ejeX={nombrePar(vp.clave)}
          {marcasX}
        />
        <h3>{t('comparar.bar.tabla', { metrica: t(`analizar.m.g.${metricaVer}`) })}</h3>
        <table>
          <thead>
            <tr>
              <th>{nombrePar(vp.clave)}</th>
              <th>{t('comparar.rep.col.media')}</th>
              <th>{t('comparar.rep.col.desvio')}</th>
              <th>p10</th>
              <th>p90</th>
              <th>{t('comparar.rep.col.min')}</th>
              <th>{t('comparar.rep.col.max')}</th>
              <th>{t('comparar.bar.col.n')}</th>
              {#if hayReinicios}
                <th>{t('comparar.bar.col.reiniciadas')}</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each filas as f (f.valor)}
              <tr>
                <th class="mono">{valorTexto(vp.clave, f.valor)}</th>
                <td class="mono">{fmt(f.metricas[metricaVer].media)}</td>
                <td class="mono">
                  {f.metricas[metricaVer].n < 2 ? t('comparar.rep.desvioUna') : fmt(f.metricas[metricaVer].desvio)}
                </td>
                <td class="mono">{fmt(f.metricas[metricaVer].p10)}</td>
                <td class="mono">{fmt(f.metricas[metricaVer].p90)}</td>
                <td class="mono">{fmt(f.metricas[metricaVer].min)}</td>
                <td class="mono">{fmt(f.metricas[metricaVer].max)}</td>
                <td class="mono">{num(f.metricas[metricaVer].n)}</td>
                {#if hayReinicios}
                  <td class="mono">{num(f.reiniciadas)}</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
        <div use:alVerse>
          <GraficoBandas
            series={superpuestas}
            titulo={t('comparar.bar.graficoSeries', { metrica: t(`analizar.m.g.${metricaVer}`) })}
            banda={t('comparar.bar.bandaSeries')}
          />
        </div>
        <div class="fila">
          <button type="button" class="btn" onclick={() => bajarCsv('resumen')}>
            {t('comparar.bar.csvResumen')}
          </button>
          <button type="button" class="btn" onclick={() => bajarCsv('unidades')}>
            {t('comparar.bar.csvSemillas')}
          </button>
          <button type="button" class="btn" onclick={bajarInforme}>
            {t('comparar.bar.informe')}
          </button>
        </div>
        {#if errorExportar}
          <p class="error" role="alert">{errorExportar}</p>
        {/if}
      {/if}
    </section>
  {/if}
</div>

{#snippet celda(
  /** @type {import('../../../../engine/cola.js').Unidad | null} */ u,
  /** @type {boolean} */ reinicio,
)}
  <td
    class="celda"
    title={u
  ? `${t(`comparar.trabajos.unidad.${u.estado}`)}${u.error ? ` · ${textoError(t, u.codigo, u.error)}` : ''}${reinicio ? ` · ${t('comparar.bar.celdaReinicio')}` : ''}`
  : ''}
  >
    <span
      class={`est ${u?.estado ?? 'pendiente'}${reinicio ? ' reiniciada' : ''}`}
      style:--p={u?.progreso ?? 0}
    ></span>
  </td>
{/snippet}

<style>
.bar {
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
input:not([type="radio"]) {
  font: inherit;
  height: 34px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
  box-sizing: border-box;
}
select {
  max-width: 100%;
}
input[type="number"] {
  width: 110px;
}
.buscar {
  width: 220px;
}
.lista {
  width: min(420px, 100%);
}
h2 {
  margin: 0;
  font-size: 15px;
}
h3 {
  margin: 8px 0 0;
  font-size: 13px;
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
.rejilla {
  width: auto;
  font-size: 11px;
}
.rejilla th,
.rejilla td {
  padding: 3px 6px;
}
.celda .est {
  display: block;
  width: 22px;
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--acento, #0f5c55) calc(var(--p) * 100%),
    var(--borde) calc(var(--p) * 100%)
  );
}
.celda .est.hecha {
  background: var(--acento, #0f5c55);
}
.celda .est.reiniciada {
  background: repeating-linear-gradient(45deg, var(--acento, #0f5c55) 0 3px, var(--borde) 3px 6px);
}
.celda .est.fallida {
  background: #9b2c2c;
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
.aviso {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 13px;
}
.aviso p,
.aviso ul {
  margin: 0;
}
.aviso ul {
  padding-left: 18px;
}
</style>
