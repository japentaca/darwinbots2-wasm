<script>
// @ts-check
// El ADN como texto (decisión 18): un textarea con la capa de resaltado
// detrás (misma fuente, sin ajuste de línea, desplazamiento sincronizado),
// números de línea y autocompletado de sysvars. El textarea es el de
// siempre: escribir, seleccionar y deshacer son los del navegador; los
// cambios que vienen de afuera (reemplazar) entran como un paso deshacible.
// Teclas del autocompletado: ver autocompletar.js (Enter con el nombre ya
// completo hace el salto de línea; Tab acepta siempre).
//
// Rendimiento (ADN grandes, p. ej. 82 KB): el resaltado se recalcula como
// mucho una vez por cuadro (requestAnimationFrame junta las teclas de un
// mismo cuadro), con caché por línea (crearResaltador), y los números de
// línea solo cambian con la cantidad.
import { t } from '../../../i18n/index.svelte.js';
import { completar, esExacta, palabraEnCurso, sugerencias } from './autocompletar.js';
import { crearResaltador } from './resaltado.js';
import { reemplazarTexto } from './textarea.js';

/**
 * @type {{valor: string, soloLectura?: boolean, marcadas?: Set<string>,
 *   lineasMarcadas?: Set<number>, etiqueta?: string}}
 */
let {
  valor = $bindable(''),
  soloLectura = false,
  marcadas = new Set(),
  lineasMarcadas = new Set(),
  etiqueta = '',
} = $props();

/** @type {HTMLTextAreaElement | undefined} */
let ta = $state();
let arriba = $state(0);
let izquierda = $state(0);
/** @type {{ini: number, fin: number, prefijo: string, estrella: boolean} | null} */
let enCurso = $state(null);
let elegida = $state(0);

const resaltar = crearResaltador();
let html = $state('');
/** @type {number | null} */
let cuadro = null;
let primero = true;
$effect(() => {
  const v = valor;
  const m = marcadas;
  if (primero || typeof requestAnimationFrame !== 'function') {
    primero = false;
    html = resaltar(v, m); // el primero, en el acto
    return;
  }
  if (cuadro !== null) return; // ya hay uno pedido: toma el valor de ese momento
  cuadro = requestAnimationFrame(() => {
    cuadro = null;
    html = resaltar(valor, marcadas);
  });
});
$effect(() => () => {
  if (cuadro !== null) cancelAnimationFrame(cuadro);
});
const nLineas = $derived.by(() => {
  let n = 1;
  for (let i = valor.indexOf('\n'); i >= 0; i = valor.indexOf('\n', i + 1)) n++;
  return n;
});
const opciones = $derived(enCurso ? sugerencias(enCurso.prefijo, valor) : []);
const exacta = $derived(!!enCurso && esExacta(enCurso.prefijo, valor));
const abierto = $derived(!!enCurso && opciones.length > 0 && !soloLectura);
const idLista = `adn-sug-${Math.random().toString(36).slice(2, 8)}`;
/** @param {number} i */
const idOpcion = (i) => `${idLista}-${i}`;

/** Posición del cursor en líneas/columnas (para ubicar la lista). */
const caret = $derived.by(() => {
  if (!enCurso) return { linea: 0, col: 0 };
  const antes = valor.slice(0, enCurso.ini);
  const l = antes.split('\n');
  return { linea: l.length - 1, col: l[l.length - 1].replace(/\t/g, '    ').length };
});

function sincronizar() {
  if (!ta) return;
  arriba = ta.scrollTop;
  izquierda = ta.scrollLeft;
}

function revisarPalabra() {
  if (!ta || soloLectura) return;
  if (ta.selectionStart !== ta.selectionEnd) {
    enCurso = null;
    return;
  }
  const w = palabraEnCurso(ta.value, ta.selectionStart);
  if (!w || (enCurso && w.ini !== enCurso.ini)) elegida = 0;
  enCurso = w;
}

/** @param {string} nombre */
function aceptar(nombre) {
  if (!ta || !enCurso) return;
  const r = completar(ta.value, enCurso, nombre);
  reemplazarTexto(ta, r.texto);
  ta.setSelectionRange(r.cursor, r.cursor);
  enCurso = null;
}

/** @param {KeyboardEvent} e */
function tecla(e) {
  if (!abierto) return;
  if (e.key === 'ArrowDown') {
    elegida = (elegida + 1) % opciones.length;
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    elegida = (elegida - 1 + opciones.length) % opciones.length;
    e.preventDefault();
  } else if (e.key === 'Enter' && exacta) {
    // lo escrito ya es un nombre completo: el Enter es un salto de línea
    enCurso = null;
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    aceptar(opciones[Math.min(elegida, opciones.length - 1)].nombre);
    e.preventDefault();
  } else if (e.key === 'Escape') {
    enCurso = null;
    e.preventDefault();
  }
}

/**
 * Lleva el texto a `nuevo` como un paso deshacible (o, sin textarea, lo
 * asigna).
 * @param {string} nuevo
 */
export function reemplazar(nuevo) {
  if (ta && !soloLectura) {
    reemplazarTexto(ta, nuevo);
    valor = ta.value;
  } else valor = nuevo;
}

/** Pone el cursor al principio de la línea (base 1) y la muestra. @param {number} linea */
export function irALinea(linea) {
  if (!ta) return;
  const lineas = ta.value.split('\n');
  let pos = 0;
  for (let i = 0; i < Math.min(linea - 1, lineas.length); i++) pos += lineas[i].length + 1;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  const alto = ta.scrollHeight / Math.max(1, lineas.length);
  ta.scrollTop = Math.max(0, (linea - 1) * alto - ta.clientHeight / 3);
  sincronizar();
}
</script>

<div class="area">
  <div class="numeros" aria-hidden="true">
    <div style="transform: translateY({-arriba}px)">
      {#each { length: nLineas } as _, i (i)}
        <div class:marcada={lineasMarcadas.has(i + 1)}>{i + 1}</div>
      {/each}
    </div>
  </div>
  <div class="texto">
    <pre class="capa" aria-hidden="true"><code
        style="transform: translate({-izquierda}px, {-arriba}px)">{@html html}</code></pre>
    <textarea
      bind:this={ta}
      bind:value={valor}
      readonly={soloLectura}
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      aria-label={etiqueta || t('editor.texto.etiqueta')}
      role="combobox"
      aria-expanded={abierto}
      aria-controls={abierto ? idLista : undefined}
      aria-activedescendant={abierto ? idOpcion(Math.min(elegida, opciones.length - 1)) : undefined}
      aria-autocomplete="list"
      onscroll={sincronizar}
      oninput={revisarPalabra}
      onclick={revisarPalabra}
      onkeydown={tecla}
      onkeyup={(e) => {
  if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) revisarPalabra();
}}
      onblur={() => {
  enCurso = null;
}}
    ></textarea>
    {#if abierto}
      <div
        class="sug"
        id={idLista}
        role="listbox"
        aria-label={t('editor.texto.sugerencias')}
        style="top: calc({caret.linea + 1} * 1.6em + 8px - {arriba}px); left: calc({caret.col}ch + 10px - {izquierda}px)"
      >
        {#each opciones as o, i (o.nombre)}
          <div
            id={idOpcion(i)}
            role="option"
            tabindex="-1"
            aria-selected={i === elegida}
            class:on={i === elegida}
            onmousedown={(e) => {
  e.preventDefault();
  aceptar(o.nombre);
}}
          >
            <span class="mono">.{o.nombre}</span>
            <span class="dir">{o.privada ? t('editor.texto.privada') : o.dir}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
.area {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  background: #fff;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.6;
}
.numeros {
  width: 44px;
  flex-shrink: 0;
  overflow: hidden;
  padding: 8px 0;
  color: #a3a19a;
  text-align: right;
  user-select: none;
  border-right: 1px solid var(--borde);
  background: var(--tarjeta);
}
.numeros div div {
  padding-right: 8px;
}
.numeros .marcada {
  background: var(--aviso-fondo);
  color: var(--aviso-texto);
}
.texto {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.capa,
textarea {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 8px 10px;
  font: inherit;
  line-height: inherit;
  white-space: pre;
  tab-size: 4;
  border: 0;
  box-sizing: border-box;
}
.capa {
  overflow: hidden;
  pointer-events: none;
  color: var(--texto);
}
.capa code {
  display: block;
  font: inherit;
  will-change: transform;
}
textarea {
  width: 100%;
  height: 100%;
  resize: none;
  overflow: auto;
  background: transparent;
  color: transparent;
  caret-color: var(--texto);
  outline: none;
}
textarea:focus-visible {
  box-shadow: inset 0 0 0 2px var(--acento);
}
textarea::selection {
  background: rgba(15, 92, 85, 0.22);
  color: transparent;
}
.sug {
  position: absolute;
  z-index: 5;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  min-width: 200px;
  max-height: 240px;
  overflow: auto;
  background: #fff;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  font-size: 12.5px;
}
.sug [role="option"] {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 10px;
  cursor: pointer;
}
.sug .on {
  background: var(--hover-claro);
}
.sug .dir {
  color: var(--gris-claro);
}
:global(.r-com) {
  color: #8a877f;
  font-style: italic;
}
:global(.r-off) {
  color: #b3b1a9;
  text-decoration: line-through;
}
:global(.r-flu) {
  color: #0a3f3a;
  text-decoration: underline 1px rgba(10, 63, 58, 0.25);
  text-underline-offset: 3px;
}
:global(.r-sys) {
  color: #0f5c55;
}
:global(.r-num) {
  color: #9a4a12;
}
:global(.r-ref) {
  color: #7a3fa0;
}
:global(.r-cmd) {
  color: #3d3c38;
}
:global(.r-def) {
  color: #1c4f91;
}
:global(.r-err) {
  color: #9a4a12;
  text-decoration: underline wavy #c98500;
  text-underline-offset: 3px;
}
:global(.r-otra) {
  color: #151513;
}
</style>
