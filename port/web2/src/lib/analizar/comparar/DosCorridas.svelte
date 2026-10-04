<script>
import { untrack } from 'svelte';
// @ts-check
// «Dos corridas»: A y B (la actual o guardadas), una métrica de los seis
// grupos superpuesta con sus bandas y las diferencias de configuración
// (escenario efectivo al arrancar, especies, objetos, semilla y cambios en
// caliente).
import { textoEn } from '../../../../engine/escenarios/index.js';
import { BASES, parametro } from '../../../../engine/opciones.js';
import { textoOrdenObjeto } from '../../../../engine/report/corrida.js';
import { traductor } from '../../../../engine/report/textos.js';
import { idioma, num, t } from '../../../i18n/index.svelte.js';
import { clavePlural } from '../../experimentar/borrador.js';
import { actual } from '../../sim/corrida.svelte.js';
import { colorEnTema } from '../../tema.js';
import { oscuro } from '../../tema.svelte.js';
import { diferenciasConfig, resumenEvento, valorParametro } from './diferencias.js';
import { ID_ACTUAL, serieBanda } from './fuentes.js';
import GraficoBandas from './GraficoBandas.svelte';
import SelectorMetrica from './SelectorMetrica.svelte';

/**
 * @type {{
 *   opciones: {id: string, nombre: string}[],
 *   inicial: string,
 *   cargar: (id: string) => Promise<import('./fuentes.js').Fuente | null>,
 *   versionActual?: unknown,
 * }}
 */
let { opciones, inicial, cargar, versionActual } = $props();

const COLOR_A = '#0f5c55';
const COLOR_B = '#c05621';

const uid = $props.id();
let idA = $state('');
let idB = $state('');
/** @type {import('./fuentes.js').Fuente | null} */
let fa = $state.raw(null);
/** @type {import('./fuentes.js').Fuente | null} */
let fb = $state.raw(null);
let metrica = $state('vivos');
let error = $state('');
let cargando = $state(0);

// Elección inicial: A = la que mira Analizar, B = otra.
let iniciado = false;
$effect(() => {
  if (iniciado || !opciones.length) return;
  iniciado = true;
  const a = opciones.some((o) => o.id === inicial) ? inicial : opciones[0].id;
  const b = opciones.find((o) => o.id !== a)?.id ?? '';
  void elegir('a', a);
  if (b) void elegir('b', b);
});

let pedidos = { a: 0, b: 0 };
/** @param {'a' | 'b'} lado @param {string} id */
async function elegir(lado, id) {
  const n = ++pedidos[lado];
  if (lado === 'a') idA = id;
  else idB = id;
  if (!id) {
    if (lado === 'a') fa = null;
    else fb = null;
    return;
  }
  cargando++;
  try {
    const f = await cargar(id);
    if (n !== pedidos[lado]) return;
    if (lado === 'a') fa = f;
    else fb = f;
    error = '';
  } catch (e) {
    if (n === pedidos[lado]) error = t('comparar.errorCarga', { detalle: String(e) });
  } finally {
    cargando--;
  }
}

// La corrida actual suma cambios en caliente (o arranca otra sim): se
// vuelve a leer el lado que la muestra.
$effect(() => {
  void versionActual;
  untrack(() => {
    if (idA === ID_ACTUAL) void elegir('a', idA);
    if (idB === ID_ACTUAL) void elegir('b', idB);
  });
});

/**
 * Texto con la forma plural de `n` (`clave.uno` / `clave.otros`).
 * @param {string} clave @param {number} n
 */
const tn = (clave, n) => t(clavePlural(clave, n, idioma()), { n: num(n) });

const series = $derived.by(() => {
  // La historia de la corrida actual crece: se vuelve a leer con cada muestra.
  const _tic = actual.corrida?.estado.muestras;
  /** @type {import('./grafico.js').SerieBanda[]} */
  const out = [];
  for (const [f, color, etq] of /** @type {const} */ ([
    [fa, COLOR_A, 'A'],
    [fb, COLOR_B, 'B'],
  ])) {
    if (!f) continue;
    out.push({ etiqueta: `${etq} · ${f.nombre}`, color, ...serieBanda(f.historia, metrica) });
  }
  return out;
});

const dif = $derived(
  fa && fb
    ? diferenciasConfig(
        { escenario: fa.escenario, semilla: fa.semilla, eventos: fa.eventos },
        { escenario: fb.escenario, semilla: fb.semilla, eventos: fb.eventos },
      )
    : null,
);

const lang = $derived(idioma() === 'en' ? 'en' : 'es');
/** Textos de los informes (órdenes de objetos). */
const tr = $derived(traductor(lang));

/** @param {string} clave @param {number | undefined} v */
function valor(clave, v) {
  const x = valorParametro(clave, v);
  if (x.tipo === 'nada') return t('comparar.dif.noEsta');
  if (x.tipo === 'bool') return t(x.on ? 'comparar.dif.si' : 'comparar.dif.no');
  if (x.tipo === 'enum') return x.texto[lang];
  return num(x.v, { maximumFractionDigits: 6 });
}

/** @param {any} e */
const nombreEsc = (e) => (e ? textoEn(e.nombre, lang) : t('comparar.dif.sinEscenario'));

/** @param {string | undefined} b */
const nombreBase = (b) => (b && BASES[b] ? BASES[b][lang] : t('comparar.dif.noEsta'));

/** @param {import('./diferencias.js').DatosEspecie | null} d */
function especie(d) {
  if (!d) return t('comparar.dif.noEsta');
  const s = t('comparar.dif.especie', {
    cantidad: num(d.cantidad),
    color: d.color,
    energia: num(d.energia),
  });
  const partes = [s];
  if (d.vegetal) partes.push(t('comparar.dif.vegetal'));
  if (d.hash)
    partes.push(t(d.propio ? 'comparar.dif.adnPropio' : 'comparar.dif.adn', { hash: d.hash }));
  return partes.join(', ');
}

/** Fracción del campo como porcentaje. @param {string} v */
const fraccion = (v) => num(Number(v), { style: 'percent', maximumFractionDigits: 1 });

/** Texto de un objeto descrito por objetoTexto() de diferencias.js. @param {string} o */
function objeto(o) {
  const [tipo, a, b, c] = o.split(':');
  if (tipo === 'teleporter') return t('comparar.obj.teleporter');
  if (tipo === 'laberinto')
    return t('comparar.obj.laberinto', {
      forma: t(`experimentar.laberinto.${a}`),
      pasillo: num(Number(b)),
      muro: num(Number(c)),
    });
  return t(tipo === 'formas' ? 'comparar.obj.formas' : 'comparar.obj.forma', {
    ancho: fraccion(a),
    alto: fraccion(b ?? ''),
  });
}

/** @param {string[]} l */
const objetos = (l) => (l.length ? l.map(objeto).join(', ') : t('comparar.dif.sinObjetos'));

/** @param {import('../../../../engine/corridas.js').EventoCorrida[]} evs */
function eventos(evs) {
  if (!evs.length) return [t('comparar.dif.sinEventos')];
  return evs.map((ev) => {
    const r = resumenEvento(ev);
    const ciclo = t('comparar.dif.ciclo', { n: num(r.ciclo) });
    if (r.tipo === 'siembra')
      return `${ciclo}: ${t('comparar.dif.siembra', { especie: r.especie ?? '', n: num(r.cantidad ?? 0) })}`;
    // Orden de la barra «Mundo»: el mismo texto que los informes.
    if (r.tipo === 'objetos')
      return `${ciclo}: ${t('comparar.dif.objetosOrden', { orden: textoOrdenObjeto(r.orden, tr.tx, tr.num) })}`;
    const cambios = (r.cambios ?? [])
      .map(([k, v]) => `${parametro(k)?.[lang] ?? k} = ${valor(k, v)}`)
      .join('; ');
    return `${ciclo}: ${cambios}`;
  });
}
</script>

<div class="dos">
  <div class="elegir">
    {#each /** @type {const} */ (['a', 'b']) as lado (lado)}
      <div class="lado">
        <span
          class="sw"
          style:background={colorEnTema(lado === 'a' ? COLOR_A : COLOR_B, oscuro())}
        ></span>
        <label for={`${uid}-${lado}`}>
          {t(lado === 'a' ? 'comparar.corridaA' : 'comparar.corridaB')}
        </label>
        <select
          id={`${uid}-${lado}`}
          value={lado === 'a' ? idA : idB}
          onchange={(e) => elegir(lado, /** @type {HTMLSelectElement} */ (e.currentTarget).value)}
        >
          <option value="">{t('comparar.elegir')}</option>
          {#each opciones as o (o.id)}
            <option value={o.id}>{o.nombre}</option>
          {/each}
        </select>
      </div>
    {/each}
    {#if cargando}
      <span class="chip">{t('comparar.cargando')}</span>
    {/if}
  </div>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <section class="card bloque">
    <SelectorMetrica bind:metrica />
    <GraficoBandas
      {series}
      titulo={t(`analizar.m.g.${metrica}`)}
      banda={t('comparar.grafico.bandaCorridas')}
    />
  </section>

  {#if dif}
    <section class="card bloque">
      <h2>
        {t('comparar.dif.titulo')}
        <span class="chip">
          {dif.total ? tn('comparar.dif.cuantas', dif.total) : t('comparar.dif.ninguna')}
        </span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>{t('comparar.dif.que')}</th>
            <th>A · {fa?.nombre}</th>
            <th>B · {fb?.nombre}</th>
          </tr>
        </thead>
        <tbody>
          <tr class:distinto={!dif.escenario.igual}>
            <th>{t('comparar.dif.escenario')}</th>
            <td>{nombreEsc(dif.escenario.a)}</td>
            <td>{nombreEsc(dif.escenario.b)}</td>
          </tr>
          <tr class:distinto={!dif.semilla.igual}>
            <th>{t('comparar.dif.semilla')}</th>
            <td class="mono">{dif.semilla.a ?? t('comparar.dif.noEsta')}</td>
            <td class="mono">{dif.semilla.b ?? t('comparar.dif.noEsta')}</td>
          </tr>
          <tr class:distinto={!dif.base.igual}>
            <th>{t('comparar.dif.base')}</th>
            <td>{nombreBase(dif.base.a)}</td>
            <td>{nombreBase(dif.base.b)}</td>
          </tr>
          <tr class="grupo">
            <th colspan="3">
              {t('comparar.dif.opciones')}
              <span class="nota">{tn('comparar.dif.opcionesIguales', dif.opcionesIguales)}</span>
            </th>
          </tr>
          {#each dif.opciones as o (o.clave)}
            <tr class="distinto">
              <th>
                {parametro(o.clave)?.[lang] ?? o.clave}
                <span class="mono var">{parametro(o.clave)?.variable ?? ''}</span>
              </th>
              <td>{valor(o.clave, o.a)}</td>
              <td>{valor(o.clave, o.b)}</td>
            </tr>
          {/each}
          <tr class="grupo">
            <th colspan="3">{t('comparar.dif.especies')}</th>
          </tr>
          {#each dif.especies as e (e.bot)}
            <tr class:distinto={!e.igual}>
              <th>{e.bot}</th>
              <td>{especie(e.a)}</td>
              <td>{especie(e.b)}</td>
            </tr>
          {/each}
          <tr class:distinto={!dif.objetos.igual}>
            <th>{t('comparar.dif.objetos')}</th>
            <td>{objetos(dif.objetos.a)}</td>
            <td>{objetos(dif.objetos.b)}</td>
          </tr>
          <tr class:distinto={!dif.eventos.igual}>
            <th>{t('comparar.dif.eventos')}</th>
            <td>
              {#each eventos(dif.eventos.a) as l, i (i)}
                <div>{l}</div>
              {/each}
            </td>
            <td>
              {#each eventos(dif.eventos.b) as l, i (i)}
                <div>{l}</div>
              {/each}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  {/if}
</div>

<style>
.dos {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.elegir {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  align-items: center;
  font-size: 13px;
}
.lado {
  display: flex;
  align-items: center;
  gap: 8px;
}
select {
  font: inherit;
  height: 34px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
  max-width: 260px;
}
.bloque {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: auto;
}
h2 {
  margin: 0;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}
table {
  border-collapse: collapse;
  font-size: 13px;
  width: 100%;
}
th,
td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--borde);
  vertical-align: top;
}
tbody th {
  font-weight: 500;
}
.grupo th {
  padding-top: 14px;
  font-weight: 600;
  color: var(--gris);
}
.distinto td {
  background: var(--aviso-fondo);
}
.var,
.nota {
  font-size: 11px;
  color: var(--gris-claro);
  margin-left: 6px;
  font-weight: 400;
}
.error {
  color: var(--error-texto);
  font-size: 13px;
  margin: 0;
}
</style>
