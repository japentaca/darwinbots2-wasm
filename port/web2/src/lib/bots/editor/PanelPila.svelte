<script>
import { resumenPaso } from '../../../../engine/pila.js';
// @ts-check
// Visor de pila del editor (PLAN-EDITOR E1.5): el gen con el cursor, paso a
// paso. Una fila por token: la palabra, la pila de enteros y la de booleanos
// que dejó el motor (db_dna_trace, vía linter.trazar), y una nota corta. Los
// valores los calcula el motor; este panel solo los presenta (engine/pila.js
// los alinea con las palabras del texto).
//
// En modo 'editor' muestra, arriba, los valores de ejemplo de las sysvars que
// lee el gen: cambiarlos cambia la condición, y con ella qué filas corren. La
// semilla de rnd es fija (1234): en el visor, rnd da siempre lo mismo.
import { idioma, t } from '../../../i18n/index.svelte.js';
import { urlManual, vocabularioManual } from '../../manual.js';
import { entradaDe } from './hover.js';
import { claseDe } from './resaltado.js';
import TarjetaManual from './TarjetaManual.svelte';
import { SYSVARS } from './vocabulario.js';

/**
 * @typedef {import('../../../../engine/pila.js').PasoAlineado} PasoAlineado
 */

/**
 * @type {{pasos: PasoAlineado[], gen: number, nombreGen: string,
 *   valores: Map<string, number>, sysvars: string[],
 *   estado: 'sinGen' | 'sinDatos' | 'cargando' | 'ok', soloLectura?: boolean,
 *   modo?: 'editor' | 'trazador', onvalor?: (nombre: string, valor: number) => void}}
 */
let {
  pasos = [],
  gen = -1,
  nombreGen = '',
  valores = new Map(),
  sysvars = [],
  estado = 'sinGen',
  soloLectura = false,
  modo = 'editor',
  onvalor,
} = $props();

/** Nombre de la sysvar de una dirección (la primera de la tabla), o null. @param {number} dir */
function nombreDe(dir) {
  return SYSVARS.find(([, d]) => d === dir)?.[0] ?? null;
}

const inicio = $derived(pasos.find((p) => p.palabra.toLowerCase() === 'start') ?? null);
const hayElse = $derived(pasos.some((p) => p.palabra.toLowerCase() === 'else'));
/** La condición del gen según el paso del start: flujo 2 (BODY) = verdadera. */
const condicion = $derived(inicio ? (inicio.flujo === 2 ? 'verdadera' : 'falsa') : null);
const rama = $derived(
  condicion && hayElse
    ? condicion === 'verdadera'
      ? 'editor.pila.ramaStart'
      : 'editor.pila.ramaElse'
    : null,
);

/** Las filas con su nota: «no corre» en la primera de cada bloque omitido, y la escritura. */
const filas = $derived.by(() => {
  let enOmitidos = false;
  return pasos.map((p) => {
    const primera = !p.ejec && !enOmitidos;
    enOmitidos = !p.ejec;
    /** @type {string[]} */
    const partes = [];
    if (primera) partes.push(t('editor.pila.noCorre'));
    if (p.dir !== 0 && resumenPaso(p).tipo === 'escribe')
      partes.push(
        t('editor.pila.escribe', {
          dir: p.dir,
          nombre: nombreDe(p.dir) ?? String(p.dir),
          val: p.val,
        }),
      );
    return { p, nota: partes.join(' · ') };
  });
});

// ---- Tarjeta del manual al pasar por una palabra (como AreaAdn) -------------------

const IDIOMA = () => /** @type {'es' | 'en'} */ (idioma() === 'en' ? 'en' : 'es');
/** @type {import('../../manual.js').Vocabulario | null} */
let vocab = $state(null);
let vocabIdioma = '';
/** @type {{y: number, t: string, r: string, href: string} | null} */
let tip = $state(null);
/** @type {HTMLElement | undefined} */
let caja = $state();
/** @type {HTMLDivElement | undefined} */
let tipEl = $state();
const estiloTip = $derived(tip ? `top: ${tip.y + 4}px; left: 0` : '');

/** Baja el vocabulario del manual del idioma actual (una vez por idioma). */
function pedirVocabulario() {
  const idi = IDIOMA();
  if (vocabIdioma === idi) return;
  vocabIdioma = idi;
  vocabularioManual(idi).then((v) => {
    if (IDIOMA() === idi) vocab = v;
  });
}

/** @param {MouseEvent} e @param {string} palabra */
function sobrePalabra(e, palabra) {
  if (!vocab) {
    pedirVocabulario();
    return;
  }
  const en = entradaDe(palabra, vocab);
  if (!en || !caja || !(e.currentTarget instanceof HTMLElement)) {
    tip = null;
    return;
  }
  const r = e.currentTarget.getBoundingClientRect();
  const c = caja.getBoundingClientRect();
  tip = { y: r.bottom - c.top, t: en.t, r: en.r, href: urlManual(IDIOMA(), en.u) };
}

/** @param {{relatedTarget: EventTarget | null}} e */
function salirPalabra(e) {
  if (e.relatedTarget && tipEl?.contains(/** @type {Node} */ (e.relatedTarget))) return;
  tip = null;
}

/** Valor de un ejemplo: entero; vacío o no numérico, 0. @param {Event} e @param {string} nombre */
function cambiar(e, nombre) {
  const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value);
  onvalor?.(nombre, Number.isFinite(v) ? Math.trunc(v) : 0);
}
</script>

<section
  class="card panel"
  bind:this={caja}
  onmouseleave={() => (tip = null)}
  aria-label={t('editor.pila.titulo')}
>
  <span class="lbl">{t('editor.pila.titulo')}</span>

  {#if estado === 'sinGen'}
    <p class="help">{t('editor.pila.sinGen')}</p>
  {:else if estado === 'cargando'}
    <p class="help">{t('editor.cargando')}</p>
  {:else if estado === 'sinDatos'}
    <p class="help">{t('editor.pila.sinDatos')}</p>
  {:else}
    <div class="cab">
      <span class="mono nombre"
        >{t('editor.pila.gen', { n: gen + 1 })}{nombreGen ? ` · ${nombreGen}` : ''}</span
      >
      {#if condicion}
        <span class="chip">
          {t(condicion === 'verdadera' ? 'editor.pila.condVerdadera' : 'editor.pila.condFalsa')}
        </span>
      {/if}
      {#if rama}
        <span class="chip">{t(rama)}</span>
      {/if}
    </div>

    {#if modo === 'editor' && sysvars.length}
      <div class="ejemplo">
        <span class="lbl">{t('editor.pila.ejemplo')}</span>
        <p class="help">{t('editor.pila.ejemploAyuda')}</p>
        <div class="vals">
          {#each sysvars as nombre (nombre)}
            <label class="val">
              <span class="mono">{nombre}</span>
              <input
                type="number"
                class="sel"
                step="1"
                value={valores.get(nombre) ?? 0}
                disabled={soloLectura}
                onchange={(e) => cambiar(e, nombre)}
              >
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <table class="tabla">
      <thead>
        <tr>
          <th scope="col">{t('editor.pila.colPalabra')}</th>
          <th scope="col">{t('editor.pila.colEnteros')}</th>
          <th scope="col">{t('editor.pila.colBools')}</th>
          <th scope="col">{t('editor.pila.colNota')}</th>
        </tr>
      </thead>
      <tbody>
        {#each filas as { p, nota } (p.idx)}
          <tr class:omitido={!p.ejec}>
            <td>
              <button
                type="button"
                class="mono palabra r-{claseDe(p.palabra, new Set(), new Set())}"
                onmouseenter={(e) => sobrePalabra(e, p.palabra)}
                onmouseleave={salirPalabra}
                onfocus={(e) => sobrePalabra(e, p.palabra)}
                onblur={salirPalabra}
              >
                {p.palabra}
              </button>
            </td>
            <td class="pila">
              {#each p.ints as v, j (j)}
                <span class="chip mono">{v}</span>
              {/each}
              {#if p.nInts > p.ints.length}
                <span class="chip mono"
                  >{t('editor.pila.mas', { n: p.nInts - p.ints.length })}</span
                >
              {/if}
            </td>
            <td class="pila">
              {#each p.bools as b, j (j)}
                <span class="bool" class:falso={b === 0}>{b === 0 ? '✗' : '✓'}</span>
              {/each}
              {#if p.nBools > p.bools.length}
                <span class="chip mono"
                  >{t('editor.pila.mas', { n: p.nBools - p.bools.length })}</span
                >
              {/if}
            </td>
            <td class="nota">{nota}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="help">{t('editor.pila.semillaFija')}</p>
  {/if}

  <TarjetaManual {tip} bind:ref={tipEl} estilo={estiloTip} />
</section>

<style>
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  font-size: 13px;
}
.cab {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.nombre {
  font-weight: 500;
}
.ejemplo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ejemplo p {
  margin: 0;
}
.vals {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 6px;
}
.val {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}
.val input {
  width: 72px;
}
.tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.tabla th {
  text-align: left;
  font-weight: 500;
  color: var(--gris);
  border-bottom: 1px solid var(--borde);
  padding: 4px 4px;
}
.tabla td {
  padding: 4px;
  vertical-align: top;
  border-bottom: 1px solid var(--borde);
}
.omitido td {
  color: var(--gris-claro);
  background: var(--fondo);
}
.palabra {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: default;
}
.pila {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.bool {
  color: var(--acento);
}
.bool.falso {
  color: var(--gris-claro);
}
.nota {
  color: var(--gris);
  font-size: 11.5px;
}
/* Las clases r-* son las del resaltado del texto (AreaAdn). */
:global(.r-flu) {
  color: var(--codigo-flu);
}
:global(.r-cmd) {
  color: var(--chip-texto);
}
:global(.r-sys) {
  color: var(--acento);
}
:global(.r-num) {
  color: var(--codigo-num);
}
:global(.r-ref) {
  color: var(--codigo-ref);
}
:global(.r-err) {
  color: var(--codigo-num);
  text-decoration: underline wavy var(--ambar);
  text-underline-offset: 3px;
}
:global(.r-otra) {
  color: var(--texto);
}
</style>
