<script>
import {
  borrarFicha,
  huecos,
  insertarEn,
  modeloFichas,
  nuevaLineaTras,
  reemplazarFicha,
} from '../../../../engine/fichas.js';
// @ts-check
// Vista «Fichas» del editor de ADN (PLAN-EDITOR E3.4): el texto como fichas
// (una por palabra), agrupado por gen como la vista Genes. Cada edición sale
// como un texto nuevo por `onaplicar(nuevo, cursor)`: el texto sigue siendo la
// fuente y nada se regenera desde el modelo. El modelo y las acciones viven en
// engine/fichas.js; las sugerencias, en autocompletar.js.
//
// Props:
//   texto                 el ADN en pantalla
//   soloLectura           sin editar (los del foro)
//   marcadas, lineasMarcadas  lo que marca el lint: la ficha o la línea van en `.err`
//   pasos                 la traza alineada (engine/pila.js): al pasar por una
//                         ficha se muestran las pilas después de su token
//   origenes, nombreDe    la cabecera de cada gen, como VistaGenes
//   arrastre              el arrastre compartido con la paleta (lo crea Editor)
//   marcado               el hueco marcado mientras dura un arrastre, o null
//   onaplicar(nuevo, cursor), onhueco(pos), ondeshacer(), onrehacer()
//
// Gestos: clic en una ficha la edita (Enter/Tab aplica, Esc cancela, Supr con
// el campo vacío la borra, ↑/↓ eligen una sugerencia); clic en un «+» (un
// hueco) inserta ahí; Enter en la última ficha de una línea abre una línea
// nueva; arrastrar una ficha a un hueco la mueve; una línea de comentario,
// `def` o `'#` se edita entera con un clic. Ctrl+Z y Ctrl+Y van a
// ondeshacer/onrehacer (el historial vive en Editor.svelte).
import { bloquesAdn } from '../../../../engine/lab.js';
import { t } from '../../../i18n/index.svelte.js';
import { sugerenciasFicha } from './autocompletar.js';
import { defsDe } from './resaltado.js';

/**
 * @typedef {import('../../../../engine/fichas.js').LineaFichas} LineaFichas
 * @typedef {import('../../../../engine/fichas.js').Ficha} Ficha
 * @typedef {import('../../../../engine/pila.js').PasoAlineado} PasoAlineado
 * @typedef {{tipo: 'hueco', pos: number} | {tipo: 'ficha', f: Ficha, k: number}} Item
 * @typedef {{tipo: 'ficha', ficha: Ficha, n: number, ultima: boolean}
 *   | {tipo: 'hueco', pos: number} | {tipo: 'linea', n: number}} Edicion
 */

/**
 * @type {{texto: string, soloLectura?: boolean, marcadas?: Set<string>,
 *   lineasMarcadas?: Set<number>, pasos?: PasoAlineado[],
 *   origenes?: (import('../../../../engine/lab.js').OrigenGen | null | undefined)[],
 *   nombreDe?: (archivo: string) => string,
 *   arrastre?: ReturnType<typeof import('./arrastre.js').crearArrastre>,
 *   marcado?: number | null,
 *   onaplicar: (nuevo: string, cursor: number) => void,
 *   onhueco?: (pos: number) => void, ondeshacer?: () => void, onrehacer?: () => void}}
 */
let {
  texto,
  soloLectura = false,
  marcadas = new Set(),
  lineasMarcadas = new Set(),
  pasos = [],
  origenes = [],
  nombreDe = (/** @type {string} */ archivo) => archivo,
  arrastre,
  marcado = null,
  onaplicar,
  onhueco,
  ondeshacer,
  onrehacer,
} = $props();

const modelo = $derived(modeloFichas(texto));
const bloques = $derived(bloquesAdn(texto));
const defs = $derived(defsDe(texto));
const pasoPorIni = $derived(new Map(pasos.map((p) => [p.ini, p])));

/**
 * Los huecos de una línea, en orden, con las fichas entre ellos. Una línea
 * vacía tiene un hueco tras su sangría (ahí cae el cursor de nuevaLineaTras).
 * @param {LineaFichas} l
 * @returns {Item[]}
 */
function itemsDe(l) {
  if (l.tipo === 'vacia') {
    const sangria = /^[ \t]*/.exec(l.texto)?.[0].length ?? 0;
    return [{ tipo: 'hueco', pos: l.ini + sangria }];
  }
  if (l.tipo !== 'codigo') return [];
  const hs = huecos(l);
  /** @type {Item[]} */
  const out = [];
  l.fichas.forEach((f, k) => {
    out.push({ tipo: 'hueco', pos: hs[k] }, { tipo: 'ficha', f, k });
  });
  out.push({ tipo: 'hueco', pos: hs[hs.length - 1] });
  return out;
}

/**
 * La vista por bloques: cada gen (activo o apagado) con sus líneas, y la
 * etiqueta de zona donde cambia (cond, cuerpo, else). Las líneas fuera de todo
 * gen van aparte.
 */
const vista = $derived.by(() => {
  /** @type {Set<number>} */
  const dentro = new Set();
  const gens = bloques.map((b) => {
    /** @type {{l: LineaFichas, zona: string | null, items: Item[]}[]} */
    const ls = [];
    let previa = '';
    for (let n = b.l0; n <= b.l1; n++) {
      const l = modelo[n];
      if (!l) continue;
      dentro.add(n);
      let zona = null;
      if (l.tipo === 'codigo') {
        if (l.zona !== previa) zona = l.zona;
        previa = l.zona;
      }
      ls.push({ l, zona, items: itemsDe(l) });
    }
    return { b, ls };
  });
  const fuera = modelo
    .filter((l) => !dentro.has(l.n))
    .map((l) => ({ l, zona: /** @type {string | null} */ (null), items: itemsDe(l) }));
  return { gens, fuera };
});

/** @param {number} n índice del gen en el texto (base 0) */
function origenDe(n) {
  const o = origenes[n];
  if (!o) return '';
  if ('archivo' in o)
    return t('editor.genes.origenForo', { bot: nombreDe(o.archivo), gen: o.gen + 1 });
  return t('editor.genes.origenPropio', { gen: o.gen + 1 });
}

/** @param {Ficha} f @param {LineaFichas} l */
const esErr = (f, l) => marcadas.has(f.w) || lineasMarcadas.has(l.n + 1);
/** @param {LineaFichas} l */
const esErrLinea = (l) => lineasMarcadas.has(l.n + 1);

/** @param {LineaFichas} l */
function claseTexto(l) {
  if (l.tipo === 'comentario') return 'r-com';
  if (l.tipo === 'def') return 'r-def';
  if (l.tipo === 'meta') return 'r-off';
  return '';
}

// ---- Edición ---------------------------------------------------------------

/** @type {Edicion | null} */
let editando = $state(null);
let valor = $state('');
/** Sugerencia elegida con ↑/↓ (−1: ninguna, se aplica lo escrito). */
let sel = $state(-1);
/** Tarjeta de la pila al pasar por una ficha, o null. */
/** @type {{x: number, y: number, paso: PasoAlineado, palabra: string} | null} */
let tip = $state(null);
/** @type {HTMLDivElement | undefined} */
let raiz = $state();
/**
 * Tras soltar un arrastre, el clic que el navegador dispara encima se ignora.
 * Un plano (no estado): nadie lo pinta.
 */
let ignorarClic = false;

const sugs = $derived(editando && editando.tipo !== 'linea' ? sugerenciasFicha(valor, defs) : []);

function cerrar() {
  editando = null;
  valor = '';
  sel = -1;
}

/** @param {{texto: string, cursor: number}} r */
function emitir(r) {
  onaplicar(r.texto, r.cursor);
}

/** @param {LineaFichas} l @param {number} k */
function editarFicha(l, k) {
  if (soloLectura) return;
  if (ignorarClic) {
    ignorarClic = false;
    return;
  }
  tip = null;
  const f = l.fichas[k];
  editando = { tipo: 'ficha', ficha: f, n: l.n, ultima: k === l.fichas.length - 1 };
  valor = f.w;
  sel = -1;
}

/** @param {number} pos */
function editarHueco(pos) {
  if (soloLectura) return;
  if (ignorarClic) {
    ignorarClic = false;
    return;
  }
  onhueco?.(pos);
  editando = { tipo: 'hueco', pos };
  valor = '';
  sel = -1;
}

/** @param {LineaFichas} l */
function editarLinea(l) {
  if (soloLectura) return;
  if (ignorarClic) {
    ignorarClic = false;
    return;
  }
  editando = { tipo: 'linea', n: l.n };
  valor = l.texto;
  sel = -1;
}

/** La palabra que aplica Enter o Tab: la sugerencia elegida, o lo escrito. */
function palabraElegida() {
  const s = sugs[sel];
  return sel >= 0 && s ? s.palabra : valor.trim();
}

/**
 * Aplica la edición en curso. `nuevaLinea`: Enter en la última ficha de su
 * línea abre una línea nueva con el foco en su hueco.
 * @param {boolean} nuevaLinea
 */
function confirmar(nuevaLinea) {
  const ed = editando;
  if (!ed || soloLectura) return;
  if (ed.tipo === 'linea') {
    const l = modelo[ed.n];
    const nuevo = valor;
    cerrar();
    if (!l || nuevo === l.texto) return;
    emitir({
      texto: texto.slice(0, l.ini) + nuevo + texto.slice(l.ini + l.texto.length),
      cursor: l.ini + nuevo.length,
    });
    return;
  }
  const palabra = palabraElegida();
  if (!palabra) {
    cerrar();
    return;
  }
  if (ed.tipo === 'hueco') {
    cerrar();
    emitir(insertarEn(texto, ed.pos, palabra));
    return;
  }
  const r = reemplazarFicha(texto, ed.ficha, palabra);
  cerrar();
  if (nuevaLinea && ed.ultima) {
    const nl = nuevaLineaTras(r.texto, ed.n);
    editando = { tipo: 'hueco', pos: nl.cursor };
    emitir(nl);
    return;
  }
  emitir(r);
}

/** Supr en una ficha con el campo vacío: la quita. */
function borrar() {
  const ed = editando;
  if (ed?.tipo !== 'ficha' || soloLectura) return;
  cerrar();
  emitir(borrarFicha(texto, ed.ficha));
}

/** @param {number} i */
function elegir(i) {
  sel = i;
  confirmar(false);
}

/** @param {KeyboardEvent} e */
function teclaCampo(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    cerrar();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    confirmar(true);
  } else if (e.key === 'Tab') {
    e.preventDefault();
    confirmar(false);
  } else if (e.key === 'Delete' && valor === '' && editando?.tipo === 'ficha') {
    e.preventDefault();
    borrar();
  } else if (e.key === 'ArrowDown' && sugs.length) {
    e.preventDefault();
    sel = (sel + 1) % sugs.length;
  } else if (e.key === 'ArrowUp' && sugs.length) {
    e.preventDefault();
    sel = sel <= 0 ? sugs.length - 1 : sel - 1;
  }
}

/** @param {KeyboardEvent} e */
function teclaLinea(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    cerrar();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    confirmar(false);
  }
}

/** @param {HTMLInputElement} el */
function enfocar(el) {
  el.focus();
}

// ---- Arrastre (arrastre.js) ----------------------------------------------------

/**
 * Puntero abajo sobre una ficha: empieza el arrastre (si lo hay) y captura el
 * puntero para seguirlo aunque salga de la ficha.
 * @param {PointerEvent} e @param {{tipo: 'ficha', ficha: Ficha}} dato
 */
function bajar(e, dato) {
  if (soloLectura || !arrastre) return;
  ignorarClic = false;
  arrastre.alEmpezar(e, dato);
  /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
}

/** @param {PointerEvent} e */
function alSoltar(e) {
  if (arrastre?.alSoltar(e)) ignorarClic = true;
}

// ---- Pila al pasar por una ficha --------------------------------------------------

/** @param {MouseEvent} e @param {Ficha} f */
function verPila(e, f) {
  const paso = pasoPorIni.get(f.ini);
  if (!paso || editando || !raiz || !(e.currentTarget instanceof HTMLElement)) {
    tip = null;
    return;
  }
  const r = e.currentTarget.getBoundingClientRect();
  const c = raiz.getBoundingClientRect();
  tip = { x: r.left - c.left, y: r.bottom - c.top + 4, paso, palabra: f.w };
}

/** Ctrl+Z y Ctrl+Y, con el foco en esta vista (no dentro de un campo). @param {KeyboardEvent} e */
function teclas(e) {
  if (editando || !(e.ctrlKey || e.metaKey)) return;
  const destino = /** @type {Node | null} */ (e.target);
  if (destino && destino !== document.body && !raiz?.contains(destino)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) {
    e.preventDefault();
    ondeshacer?.();
  } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
    e.preventDefault();
    onrehacer?.();
  }
}
</script>

<svelte:window onkeydown={teclas} />

{#snippet campo()}
  <span class="campo">
    <input
      class="sel edit"
      type="text"
      bind:value={valor}
      use:enfocar
      onkeydown={teclaCampo}
      aria-label={t('editor.fichas.escribir')}
    >
    {#if sugs.length}
      <ul class="sugs" aria-label={t('editor.texto.sugerencias')}>
        {#each sugs as s, i (s.palabra)}
          <li>
            <button
              type="button"
              class="sug"
              class:on={i === sel}
              onmousedown={(e) => e.preventDefault()}
              onclick={() => elegir(i)}
            >
              <span class="mono">{s.palabra}</span>
              <span class="tipo">{t(`editor.fichas.tipo.${s.tipo}`)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </span>
{/snippet}

{#snippet linea({
  l,
  zona,
  items,
})}
  <div class="linea {l.tipo}" class:err={esErrLinea(l)}>
    <span class="zona">{zona ? t(`editor.fichas.zona.${zona}`) : ''}</span>
    <div class="items">
      {#if editando?.tipo === 'linea' && editando.n === l.n}
        <input
          class="sel edit linea-edit"
          type="text"
          bind:value={valor}
          use:enfocar
          onkeydown={teclaLinea}
          aria-label={t('editor.fichas.editarLinea')}
        >
      {:else if l.tipo === 'codigo' || l.tipo === 'vacia'}
        {#each items as it, i (i)}
          {#if it.tipo === 'hueco'}
            {#if editando?.tipo === 'hueco' && editando.pos === it.pos}
              {@render campo()}
            {:else}
              <button
                type="button"
                class="hueco"
                class:marcado={marcado === it.pos}
                data-hueco={it.pos}
                title={marcado === it.pos ? t('editor.fichas.soltarAqui') : t('editor.fichas.insertar')}
                aria-label={t('editor.fichas.insertar')}
                onclick={() => editarHueco(it.pos)}
              >
                +
              </button>
            {/if}
          {:else if editando?.tipo === 'ficha' && editando.ficha.ini === it.f.ini}
            {@render campo()}
          {:else}
            <button
              type="button"
              class="ficha r-{it.f.clase}"
              class:err={esErr(it.f, l)}
              onpointerdown={(e) => bajar(e, { tipo: 'ficha', ficha: it.f })}
              onclick={() => editarFicha(l, it.k)}
              onmouseenter={(e) => verPila(e, it.f)}
              onmouseleave={() => (tip = null)}
            >
              {it.f.w}
            </button>
          {/if}
        {/each}
      {:else}
        <button type="button" class="texto {claseTexto(l)}" onclick={() => editarLinea(l)}>
          {l.texto || ' '}
        </button>
      {/if}
    </div>
  </div>
{/snippet}

<section
  class="fichas"
  bind:this={raiz}
  aria-label={t('editor.fichas.titulo')}
  onpointermove={(e) => arrastre?.alMover(e)}
  onpointerup={alSoltar}
  onpointercancel={() => arrastre?.alCancelar()}
>
  <p class="help ayuda">{t('editor.fichas.ayuda')}</p>

  {#each vista.gens as { b, ls } (`${b.tipo}${b.l0}`)}
    <section class="gen" class:apagado={b.tipo === 'apagado'}>
      <header class="cab">
        <span class="mono num">{b.tipo === 'gen' ? b.n + 1 : '—'}</span>
        <span class="nombre">{b.nombre || t('editor.genes.sinNombre')}</span>
        <span class="origen">{b.tipo === 'gen' ? origenDe(b.n) : ''}</span>
      </header>
      {#each ls as x (x.l.n)}
        {@render linea(x)}
      {/each}
    </section>
  {/each}

  {#if vista.fuera.length}
    <section class="gen fuera">
      <header class="cab">
        <span class="nombre">{t('editor.fichas.fueraDeGenes')}</span>
      </header>
      {#each vista.fuera as x (x.l.n)}
        {@render linea(x)}
      {/each}
    </section>
  {/if}

  {#if tip}
    <div class="tip" role="tooltip" style="left: {tip.x}px; top: {tip.y}px">
      <span class="mono tit">{t('editor.fichas.pilaTras', { palabra: tip.palabra })}</span>
      <div class="pila">
        {#each tip.paso.ints as v, j (j)}
          <span class="chip mono">{v}</span>
        {/each}
        {#if tip.paso.nInts > tip.paso.ints.length}
          <span class="chip mono"
            >{t('editor.pila.mas', { n: tip.paso.nInts - tip.paso.ints.length })}</span
          >
        {/if}
      </div>
      <div class="pila">
        {#each tip.paso.bools as b, j (j)}
          <span class="bool" class:falso={b === 0}>{b === 0 ? '✗' : '✓'}</span>
        {/each}
        {#if tip.paso.nBools > tip.paso.bools.length}
          <span class="chip mono"
            >{t('editor.pila.mas', { n: tip.paso.nBools - tip.paso.bools.length })}</span
          >
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
.fichas {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--campo);
}
.ayuda {
  margin: 0;
}
.gen {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--borde);
  border-radius: 8px;
  background: var(--tarjeta);
}
.gen.apagado {
  opacity: 0.6;
}
.gen.fuera {
  border-style: dashed;
}
.cab {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
}
.num {
  color: var(--gris-claro);
}
.nombre {
  font-weight: 500;
  min-width: 0;
}
.origen {
  font-size: 12px;
  color: var(--gris);
}
.linea {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
}
.zona {
  flex: none;
  width: 64px;
  text-align: right;
  font-size: 11px;
  color: var(--gris-claro);
}
.items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.ficha {
  padding: 2px 7px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  color: var(--texto);
  font-family: var(--mono, monospace);
  font-size: 13px;
  line-height: 1.5;
  cursor: grab;
  /* arrastrar una ficha no desplaza la lista; fuera de las fichas, sí (E3.3) */
  touch-action: none;
}
.ficha.r-flu {
  color: var(--codigo-flu);
}
.ficha.r-cmd {
  color: var(--chip-texto);
}
.ficha.r-sys {
  color: var(--acento);
}
.ficha.r-num {
  color: var(--codigo-num);
}
.ficha.r-ref {
  color: var(--codigo-ref);
}
.ficha.r-def {
  color: var(--codigo-def);
}
.ficha.err {
  color: var(--codigo-num);
  text-decoration: underline wavy var(--ambar);
  text-underline-offset: 3px;
}
.hueco {
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--gris-claro);
  font-family: var(--mono, monospace);
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.25;
  cursor: pointer;
}
.hueco.marcado {
  opacity: 1;
  background: var(--activo-fondo);
  color: var(--activo-texto);
}
.linea:hover .hueco,
.linea:focus-within .hueco {
  opacity: 1;
}
@media (hover: none) {
  .hueco {
    opacity: 0.7;
  }
}
.texto {
  padding: 2px 4px;
  border: 0;
  background: none;
  color: var(--texto);
  font-family: var(--mono, monospace);
  font-size: 13px;
  text-align: left;
  white-space: pre;
  cursor: text;
}
.texto.r-com {
  color: var(--codigo-com);
  font-style: italic;
}
.texto.r-def {
  color: var(--codigo-def);
}
.texto.r-off {
  color: var(--codigo-off);
  text-decoration: line-through;
}
.linea.err .texto {
  text-decoration: underline wavy var(--ambar);
}
.campo {
  position: relative;
  display: inline-block;
}
.edit {
  width: 10ch;
  font-family: var(--mono, monospace);
}
.linea-edit {
  width: 100%;
}
.sugs {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 4;
  min-width: 200px;
  max-height: 220px;
  overflow: auto;
  margin: 2px 0 0;
  padding: 4px;
  list-style: none;
  background: var(--tarjeta);
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  box-shadow: 0 6px 18px var(--sombra);
}
.sug {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 3px 6px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--texto);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.sug:hover {
  background: var(--hover-claro);
}
.sug.on {
  background: var(--activo-fondo);
  color: var(--activo-texto);
}
.tipo {
  font-size: 11px;
  color: var(--gris-claro);
}
.sug.on .tipo {
  color: inherit;
}
.tip {
  position: absolute;
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 320px;
  padding: 6px 10px;
  background: var(--tarjeta);
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  box-shadow: 0 6px 18px var(--sombra);
  font-size: 12px;
  pointer-events: none;
}
.tit {
  color: var(--acento);
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
</style>
