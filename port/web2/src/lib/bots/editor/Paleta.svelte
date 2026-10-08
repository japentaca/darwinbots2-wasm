<script>
import { idioma, t } from '../../../i18n/index.svelte.js';
// @ts-check
// Paleta del modo Fichas (PLAN-EDITOR E3.4): las palabras que se ponen en el
// ADN, agrupadas y plegables. Clic en una palabra → `oninsertar(palabra)`
// (Editor.svelte la pone en el último hueco tocado, o al final del texto).
// Arrastrar una palabra a un «+» de Fichas la pone ahí: el arrastre es el
// compartido de arrastre.js que crea Editor.svelte y que también usa Fichas.
//
// Grupos: las sysvars de GRUPOS_MEMORIA (cada una como `.x` y `*.x`), los
// operadores de COMANDOS agrupados (flujo, aritmética y comparación, lógica,
// pila, stores) y las variables privadas del ADN (`defs`). Al pasar el cursor
// por una palabra, la tarjeta del manual (TarjetaManual, E1.5).
import { GRUPOS_MEMORIA } from '../../inspector/memoria.js';
import { urlManual, vocabularioManual } from '../../manual.js';
import { entradaDe } from './hover.js';
import { claseDe } from './resaltado.js';
import TarjetaManual from './TarjetaManual.svelte';
import { COMANDOS } from './vocabulario.js';

/** Operadores de pila (con sus variantes int y bool) van en su grupo, no en el de aritmética. */
const ES_PILA = /^(dup|drop|clear|swap|over)/;
/** Los operadores del core, agrupados para la paleta (clave i18n `editor.paleta.grupo.*`). */
const OPERADORES = /** @type {[string, string[]][]} */ ([
  ['flujo', [...COMANDOS.flujo, ...COMANDOS.fin]],
  [
    'aritmetica',
    [...COMANDOS.basico, ...COMANDOS.avanzado, ...COMANDOS.bits, ...COMANDOS.condicion].filter(
      (w) => !ES_PILA.test(w),
    ),
  ],
  ['logica', COMANDOS.logica.filter((w) => !ES_PILA.test(w))],
  ['pila', [...COMANDOS.basico, ...COMANDOS.logica].filter((w) => ES_PILA.test(w))],
  ['stores', [...COMANDOS.store]],
]);

/**
 * @type {{defs: string[], oninsertar: (palabra: string) => void,
 *   arrastre?: ReturnType<typeof import('./arrastre.js').crearArrastre>,
 *   soloLectura?: boolean}}
 */
let { defs = [], oninsertar, arrastre, soloLectura = false } = $props();

/** Consulta del buscador: filtra las palabras de todos los grupos. */
let consulta = $state('');

const grupos = $derived([
  ...GRUPOS_MEMORIA.map((g) => ({
    titulo: `inspector.memoria.grupo.${g.grupo}`,
    palabras: g.sysvars.flatMap((s) => [s, `*${s}`]),
  })),
  ...OPERADORES.map(([k, palabras]) => ({ titulo: `editor.paleta.grupo.${k}`, palabras })),
  {
    titulo: 'editor.paleta.tusDef',
    palabras: defs.flatMap((d) => [`.${d}`, `*.${d}`]),
  },
]);

const filtrados = $derived.by(() => {
  const q = consulta.trim().toLowerCase();
  return grupos
    .map((g) => ({
      ...g,
      palabras: q ? g.palabras.filter((p) => p.toLowerCase().includes(q)) : g.palabras,
    }))
    .filter((g) => g.palabras.length > 0);
});

const defsSet = $derived(new Set(defs));

// ---- Tarjeta del manual al pasar por una palabra (como PanelPila) ------------------

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

/** @param {Event} e @param {string} palabra */
function sobre(e, palabra) {
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
function salir(e) {
  if (e.relatedTarget && tipEl?.contains(/** @type {Node} */ (e.relatedTarget))) return;
  tip = null;
}

// ---- Clic y arrastre -------------------------------------------------------------

/** Un arrastre que acaba de soltarse no cuenta como clic (lo dispara el navegador). */
let ignorarClic = false;

/** @param {PointerEvent} e @param {string} palabra */
function bajar(e, palabra) {
  if (soloLectura || !arrastre) return;
  ignorarClic = false;
  arrastre.alEmpezar(e, { tipo: 'palabra', palabra });
  /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
}

/** @param {string} palabra */
function clic(palabra) {
  if (ignorarClic) {
    ignorarClic = false;
    return;
  }
  if (!soloLectura) oninsertar(palabra);
}

/** @param {PointerEvent} e */
function soltar(e) {
  if (arrastre?.alSoltar(e)) ignorarClic = true;
}
</script>

<section
  class="card panel"
  bind:this={caja}
  aria-label={t('editor.paleta.titulo')}
  onmouseleave={() => (tip = null)}
  onpointermove={(e) => arrastre?.alMover(e)}
  onpointerup={soltar}
  onpointercancel={() => arrastre?.alCancelar()}
>
  <span class="lbl">{t('editor.paleta.titulo')}</span>
  <input
    class="sel buscar"
    type="search"
    bind:value={consulta}
    placeholder={t('editor.paleta.buscar')}
    aria-label={t('editor.paleta.buscar')}
  >
  <p class="help">{t('editor.paleta.ayuda')}</p>

  {#if filtrados.length === 0}
    <p class="help">{t('editor.paleta.sinResultados')}</p>
  {/if}

  {#each filtrados as g (g.titulo)}
    <details open>
      <summary>{t(g.titulo)}</summary>
      <div class="entradas">
        {#each g.palabras as p (p)}
          <button
            type="button"
            class="entrada mono r-{claseDe(p, defsSet, new Set())}"
            disabled={soloLectura}
            onpointerdown={(e) => bajar(e, p)}
            onclick={() => clic(p)}
            onmouseenter={(e) => sobre(e, p)}
            onmouseleave={salir}
            onfocus={(e) => sobre(e, p)}
            onblur={salir}
          >
            {p}
          </button>
        {/each}
      </div>
    </details>
  {/each}

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
.panel p {
  margin: 0;
}
.buscar {
  width: 100%;
}
details {
  border-top: 1px solid var(--borde);
  padding-top: 4px;
}
summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--gris);
  padding: 2px 0;
}
.entradas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0 6px;
}
.entrada {
  padding: 2px 7px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  color: var(--texto);
  font-size: 12.5px;
  line-height: 1.5;
  cursor: pointer;
  /* arrastrar una palabra no desplaza la paleta; fuera de las palabras, sí (E3.3) */
  touch-action: none;
}
.entrada:hover {
  background: var(--hover-claro);
}
.entrada:disabled {
  opacity: 0.5;
  cursor: default;
}
/* Las clases r-* son las del resaltado del texto (AreaAdn). */
.entrada.r-flu {
  color: var(--codigo-flu);
}
.entrada.r-cmd {
  color: var(--chip-texto);
}
.entrada.r-sys {
  color: var(--acento);
}
.entrada.r-num {
  color: var(--codigo-num);
}
.entrada.r-ref {
  color: var(--codigo-ref);
}
</style>
