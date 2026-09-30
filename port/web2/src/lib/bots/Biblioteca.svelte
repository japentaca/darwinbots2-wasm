<script>
// @ts-check
// Biblioteca de Bots (decisión 20): los del foro y los propios, con la
// búsqueda, los filtros, la agrupación y el orden de la clásica; favoritos
// y tags (de a uno o sobre la selección), selecciones con nombre, siembra
// en lote, bot nuevo, import/export e «Importar desde la clásica».
import {
  cuentaCaps,
  entradasDe,
  foros,
  TAMANOS,
  todosLosTags,
} from '../../../engine/biblioteca.js';
import { num, t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { descargar } from '../observar/descargas.js';
import {
  avisar,
  avisarError,
  bib,
  bots,
  confirmar,
  conNombreDelForo,
  infoForo,
  recargarBiblioteca,
  ui,
} from './biblioteca.svelte.js';
import DialogoBot from './DialogoBot.svelte';
import DialogoLote from './DialogoLote.svelte';
import DialogoNombre from './DialogoNombre.svelte';
import * as E from './estado.js';
import {
  ARQUETIPOS,
  capsPorGrupo,
  descCap,
  rotuloArquetipo,
  rotuloCap,
  rotuloGrupoCap,
  rotuloTamano,
  tituloGrupo,
} from './etiquetas.js';
import { importarDesdeClasica, importarTexto, migracion, textoExport } from './migracion.svelte.js';
import { claveDe } from './ruta.js';
import { lineasImport } from './textos.js';

/** @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada */

/** @type {{ actual: Entrada | null }} */
let { actual } = $props();

const vista = $derived(E.armarVista(bib.indice, ui.filtro, ui.vista, ui.sel, ui.plegados));
const tags = $derived(todosLosTags(bib.indice));
const listaForos = $derived(foros(bib.indice));
const nCaps = $derived(cuentaCaps(bib.indice));
const gruposCap = $derived(capsPorGrupo(bib.perfiles));
const arquetipos = $derived(
  bib.perfiles ? Object.keys(bib.perfiles.archetypes ?? {}) : [...ARQUETIPOS],
);
const elegidas = $derived(entradasDe(bib.indice, ui.sel));
const nClaves = $derived(new Set(bib.indice.map((e) => e.clave)).size);
const modo = $derived(E.modoRapido(ui.filtro));
const nAvanzados = $derived(E.filtrosAvanzados(ui.filtro));

let verLote = $state(false);
/** @type {Entrada[]} */
let loteDe = $state.raw([]);
let verGuardarSel = $state(false);
let verNuevo = $state(false);
let tagSel = $state('');
/** @type {HTMLInputElement | undefined} */
let archivo = $state();
/** @type {HTMLDetailsElement | undefined} */
let menu = $state();
let verMismoAdn = $state(false);

/** @param {Partial<import('../../../engine/biblioteca.js').Filtro>} c */
function filtrar(c) {
  ui.filtro = { ...ui.filtro, ...c };
}

/** @param {Entrada} e */
const hrefDe = (e) => hrefs.get(e.id) ?? hashDe('bots', e.id);

/** Enlace de cada ficha (por nombre si no es ambiguo), una vez por índice. */
const hrefs = $derived(
  new Map(bib.indice.map((e) => [e.id, hashDe('bots', claveDe(e, bib.indice))])),
);

/** @param {Entrada} e */
function meta(e) {
  if (e.clase === 'propio') {
    const n = bib.registros.find((r) => r.hash === e.clave);
    const v = n && n.clase === 'propio' ? n.versiones.length : 1;
    return t('bots.fila.propio', { v, genes: e.perfil?.genes ?? 0 });
  }
  return e.perfil
    ? t('bots.fila.foro', { foro: e.foro ?? '', genes: e.perfil.genes })
    : String(e.foro ?? '');
}

/** @param {Entrada} e */
async function alternarFav(e) {
  try {
    await bots().favorito([e.clave], !e.marcas.fav, infoForo);
    await recargarBiblioteca();
  } catch (err) {
    avisarError(err);
  }
}

// ---- Selección --------------------------------------------------------------

function elegirVisibles() {
  ui.sel = E.agregarClaves(ui.sel, E.clavesDe(vista.visibles));
}

/** @param {boolean} agregar */
async function tagASeleccion(agregar) {
  const tag = tagSel.trim();
  if (!tag || !ui.sel.size) return;
  try {
    if (agregar) await bots().agregarTag([...ui.sel], tag, infoForo);
    else await bots().quitarTag([...ui.sel], tag);
    await recargarBiblioteca();
    if (agregar) tagSel = '';
  } catch (err) {
    avisarError(err);
  }
}

async function favASeleccion() {
  if (!ui.sel.size) return;
  try {
    await bots().favorito([...ui.sel], true, infoForo);
    await recargarBiblioteca();
  } catch (err) {
    avisarError(err);
  }
}

/** @param {string} nombre */
async function guardarSeleccion(nombre) {
  try {
    const ya = bib.selecciones.some((s) => s.nombre === nombre);
    if (
      ya &&
      !(await confirmar(
        { clave: 'bots.confirmar.pisarSeleccion', params: { nombre } },
        { clave: 'bots.confirmar.reemplazar' },
      ))
    )
      return false;
    await bots().guardarSeleccion(nombre, [...ui.sel]);
    await recargarBiblioteca();
    avisar('bots.aviso.seleccionGuardada', { nombre, n: ui.sel.size });
    return true;
  } catch (err) {
    avisarError(err);
    return false;
  }
}

/** @param {import('../../../engine/bots.js').Seleccion} s */
function cargarSeleccion(s) {
  ui.sel = E.seleccionDesde(s, bib.indice);
}

/** @param {import('../../../engine/bots.js').Seleccion} s */
async function borrarSeleccion(s) {
  const ok = await confirmar(
    { clave: 'bots.confirmar.borrarSeleccion', params: { nombre: s.nombre } },
    { clave: 'bots.confirmar.borrar' },
  );
  if (!ok) return;
  try {
    await bots().borrarSeleccion(s.nombre);
    await recargarBiblioteca();
  } catch (err) {
    avisarError(err);
  }
}

function abrirLote() {
  loteDe = elegidas;
  if (loteDe.length) verLote = true;
}

// ---- Bot nuevo, import/export -----------------------------------------------------

/** @param {{nombre: string, vegetal: boolean, descripcion: string, adn: string}} d */
async function crearNuevo(d) {
  try {
    const b = await conNombreDelForo((op) =>
      bots().crear(
        { nombre: d.nombre, adn: d.adn, vegetal: d.vegetal, descripcion: d.descripcion },
        op,
      ),
    );
    if (!b) return false;
    await recargarBiblioteca();
    avisar('bots.aviso.creado', { nombre: b.nombre });
    const e = bib.indice.find((x) => x.clave === b.hash);
    if (e) location.hash = hashDe('bots', claveDe(e, bib.indice), 'adn');
    return true;
  } catch (err) {
    avisarError(err);
    return false;
  }
}

function cerrarMenu() {
  if (menu) menu.open = false;
}

/** Escape cierra el menu y devuelve el foco a su boton. @param {KeyboardEvent} ev */
function teclaMenu(ev) {
  if (ev.key !== 'Escape' || !menu?.open) return;
  ev.preventDefault();
  menu.open = false;
  menu.querySelector('summary')?.focus();
}

async function exportar() {
  cerrarMenu();
  try {
    const texto = await textoExport();
    descargar(new Blob([texto], { type: 'application/json' }), 'darwinbots2-biblioteca.json');
  } catch (err) {
    avisarError(err);
  }
}

/** @param {Event} ev */
async function importar(ev) {
  const input = /** @type {HTMLInputElement} */ (ev.currentTarget);
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  try {
    const r = await importarTexto(await f.text());
    await recargarBiblioteca();
    avisar('bots.aviso.importado', { archivo: f.name }, { lineas: lineasImport(r) });
  } catch (err) {
    avisarError(err);
  }
}

async function desdeClasica() {
  cerrarMenu();
  try {
    await importarDesdeClasica();
    await recargarBiblioteca();
  } catch (err) {
    avisarError(err);
  }
}
</script>

<svelte:window onkeydown={teclaMenu} />

<aside class="bib" aria-label={t('bots.biblioteca')}>
  <div class="cabeza">
    <div class="titulo">
      <h1>{t('bots.biblioteca')}</h1>
      <div class="acciones">
        <button class="btn sm" type="button" onclick={() => (verNuevo = true)}>
          {t('bots.nuevo')}
        </button>
        <details class="menu" bind:this={menu}>
          <summary class="btn sm" aria-label={t('bots.menu.titulo')} title={t('bots.menu.titulo')}>
            ⋯
          </summary>
          <div class="menu-lista">
            <button
              type="button"
              onclick={() => {
  cerrarMenu();
  archivo?.click();
}}
            >
              {t('bots.menu.importar')}
            </button>
            <button type="button" onclick={exportar}>
              {t('bots.menu.exportar')}
            </button>
            <button type="button" disabled={migracion.corriendo} onclick={desdeClasica}>
              {t('bots.menu.clasica')}
            </button>
          </div>
        </details>
        <input
          bind:this={archivo}
          type="file"
          accept=".json,application/json"
          hidden
          onchange={importar}
        >
      </div>
    </div>
    {#if migracion.corriendo}
      <p class="help" role="status">{t('bots.migracion.enCurso')}</p>
    {/if}
    <label for="bots-q" class="oculto">{t('bots.buscar')}</label>
    <input
      id="bots-q"
      class="sel buscar"
      type="search"
      placeholder={t('bots.buscarAyuda')}
      value={ui.filtro.q}
      oninput={(e) => filtrar({ q: e.currentTarget.value })}
    >
    <div class="fila">
      <fieldset class="seg">
        <legend class="oculto">{t('bots.modo.titulo')}</legend>
        {#each /** @type {const} */ (['todos', 'favoritos', 'propios']) as m (m)}
          <button
            type="button"
            class:on={modo === m}
            aria-pressed={modo === m}
            onclick={() => (ui.filtro = E.conModoRapido(ui.filtro, m))}
          >
            {t(`bots.modo.${m}`)}
          </button>
        {/each}
      </fieldset>
      <select
        class="sel crece"
        aria-label={t('bots.agrupar.titulo')}
        value={ui.vista.agrupar}
        onchange={(e) => (ui.vista = E.normalizarVista({ ...ui.vista, agrupar: e.currentTarget.value }))}
      >
        {#each /** @type {const} */ ([
   'arquetipo',
   'foro',
   'capacidad',
   'tag',
   'tamano',
   'fav',
   'origen',
   'ninguno',
 ]) as g (g)}
          <option value={g}>{t(`bots.agrupar.${g}`)}</option>
        {/each}
      </select>
    </div>
    <button
      class="plegar"
      type="button"
      aria-expanded={ui.verFiltros}
      onclick={() => (ui.verFiltros = !ui.verFiltros)}
    >
      {ui.verFiltros ? '▾' : '▸'}
      {nAvanzados ? t('bots.filtros.conN', { n: nAvanzados }) : t('bots.filtros.titulo')}
    </button>
    {#if ui.verFiltros}
      <div class="filtros">
        <div class="rejilla">
          <select
            class="sel"
            aria-label={t('bots.filtros.foro')}
            value={ui.filtro.foro}
            onchange={(e) => filtrar({ foro: e.currentTarget.value })}
          >
            <option value="">{t('bots.filtros.foroTodos')}</option>
            {#each listaForos as f (f)}
              <option value={f}>{f}</option>
            {/each}
          </select>
          <select
            class="sel"
            aria-label={t('bots.filtros.arquetipo')}
            value={ui.filtro.arquetipo}
            onchange={(e) => filtrar({ arquetipo: e.currentTarget.value })}
          >
            <option value="">{t('bots.filtros.arquetipoTodos')}</option>
            {#each arquetipos as a (a)}
              <option value={a}>{rotuloArquetipo(a, bib.perfiles)}</option>
            {/each}
          </select>
          <select
            class="sel"
            aria-label={t('bots.filtros.tamano')}
            value={ui.filtro.tamano}
            onchange={(e) => filtrar({ tamano: e.currentTarget.value })}
          >
            <option value="">{t('bots.filtros.tamanoTodos')}</option>
            {#each TAMANOS as s (s)}
              <option value={s}>{rotuloTamano(s)}</option>
            {/each}
          </select>
          <select
            class="sel"
            aria-label={t('bots.filtros.tag')}
            value={E.selectorDeTag(ui.filtro.tag)}
            onchange={(e) => filtrar({ tag: E.tagDeSelector(e.currentTarget.value) })}
          >
            <option value="">{t('bots.filtros.tagTodos')}</option>
            <option value={E.TAG_SIN}>{t('bots.filtros.sinTags')}</option>
            {#each tags as [g, n] (g)}
              <option value={g}>#{g} ({n})</option>
            {/each}
          </select>
          <select
            class="sel"
            aria-label={t('bots.orden.titulo')}
            value={ui.vista.orden}
            onchange={(e) => (ui.vista = E.normalizarVista({ ...ui.vista, orden: e.currentTarget.value }))}
          >
            {#each /** @type {const} */ (['nombre', 'genes', 'caps']) as o (o)}
              <option value={o}>{t(`bots.orden.${o}`)}</option>
            {/each}
          </select>
          <label class="tgl"
            ><input
              type="checkbox"
              checked={ui.filtro.soloSeleccion}
              onchange={(e) => filtrar({ soloSeleccion: e.currentTarget.checked })}
            >{t('bots.filtros.soloSeleccion')}</label
          >
        </div>
        {#if gruposCap.length}
          <div class="caps" title={t('bots.filtros.capsAyuda')}>
            <span class="help">{t('bots.filtros.caps')}</span>
            {#each gruposCap as [grupo, caps] (grupo)}
              <span class="capg">{rotuloGrupoCap(grupo)}</span>
              {#each caps as c (c)}
                <button
                  type="button"
                  class="chip cap"
                  class:req={ui.filtro.caps[c] === 1}
                  class:excl={ui.filtro.caps[c] === -1}
                  title={descCap(c, bib.perfiles)}
                  aria-pressed={ui.filtro.caps[c] === 1 ? 'true' : ui.filtro.caps[c] === -1 ? 'mixed' : 'false'}
                  onclick={() => filtrar({ caps: E.ciclarCap(ui.filtro.caps, c) })}
                >
                  {ui.filtro.caps[c] === -1 ? '−' : ui.filtro.caps[c] === 1 ? '+' : ''}{rotuloCap(c, bib.perfiles)}
                  <small>{nCaps[c] ?? 0}</small>
                </button>
              {/each}
            {/each}
          </div>
        {/if}
        {#if E.hayFiltro(ui.filtro)}
          <button class="enlace" type="button" onclick={() => (ui.filtro = E.filtroInicial())}>
            {t('bots.filtros.limpiar')}
          </button>
        {/if}
      </div>
    {/if}
    <div class="sels">
      <span class="help">{t('bots.selecciones')}</span>
      {#each bib.selecciones as s (s.nombre)}
        <span class="chip selchip">
          <button
            type="button"
            class="sin"
            title={t('bots.seleccion.cargar')}
            onclick={() => cargarSeleccion(s)}
          >
            {s.nombre}
            · {s.claves.length}
          </button>
          <button
            type="button"
            class="sin x"
            aria-label={t('bots.seleccion.borrar', { nombre: s.nombre })}
            onclick={() => borrarSeleccion(s)}
          >
            ×
          </button>
        </span>
      {:else}
        <span class="help">{t('bots.seleccion.ninguna')}</span>
      {/each}
    </div>
  </div>

  <div class="lista">
    {#if !bib.listo}
      <p class="vacio">{bib.error ? t(bib.error.clave, bib.error.params) : t('bots.cargando')}</p>
    {:else if !vista.visibles.length}
      <p class="vacio">{t('bots.ninguno')}</p>
    {:else}
      {#each vista.grupos as g (g.id)}
        <div class="grupo">
          <div class="gh">
            <input
              type="checkbox"
              checked={g.estado === 'todos'}
              indeterminate={g.estado === 'algunos'}
              aria-label={t('bots.grupo.elegir', { grupo: tituloGrupo(g.clave, bib.perfiles) })}
              onchange={() => (ui.sel = E.alternarGrupo(ui.sel, g.entradas))}
            >
            <button
              type="button"
              class="sin gt"
              aria-expanded={!g.plegado}
              onclick={() => (ui.plegados = E.alternarPlegado(ui.plegados, g.id))}
            >
              <span class="tw">{g.plegado ? '▸' : '▾'}</span>
              <span class="lbl">{tituloGrupo(g.clave, bib.perfiles)}</span>
              <span class="n"
                >{num(g.entradas.length)}{g.nSel ? ` · ${t('bots.grupo.nSel', { n: g.nSel })}` : ''}</span
              >
            </button>
          </div>
          {#if !g.plegado}
            <ul class="filas" aria-label={tituloGrupo(g.clave, bib.perfiles)}>
              {#each g.entradas as e (e.id)}
                <li class="li" class:on={actual?.id === e.id}>
                  <input
                    type="checkbox"
                    checked={ui.sel.has(e.clave)}
                    aria-label={t('bots.fila.elegir', { nombre: e.nombre })}
                    onchange={() => (ui.sel = E.alternar(ui.sel, e.clave))}
                  >
                  <button
                    type="button"
                    class="sin estrella"
                    class:fav={e.marcas.fav}
                    aria-pressed={e.marcas.fav}
                    aria-label={t('bots.favoritoDe', { nombre: e.nombre })}
                    title={t('bots.favoritoDe', { nombre: e.nombre })}
                    onclick={() => alternarFav(e)}
                  >
                    {e.marcas.fav ? '★' : '☆'}
                  </button>
                  <a
                    class="nombre"
                    href={hrefDe(e)}
                    aria-current={actual?.id === e.id ? 'page' : undefined}
                  >
                    <span class="n1"
                      >{e.nombre}
                      {#if e.vegetal}
                        <i class="veg"> · {t('bots.vegetal')}</i>
                      {/if}</span
                    >
                    <span class="n2"
                      >{meta(e)}
                      {#each e.marcas.tags as tg (tg)}
                        <span class="tag">#{tg}</span>
                      {/each}</span
                    >
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <div class="pie">
    <div class="cuenta help">
      {t('bots.cuenta', { n: num(vista.visibles.length), total: num(bib.indice.length) })}
      ·
      {t('bots.elegidos', { n: ui.sel.size })}
      {#if nClaves !== bib.indice.length}
        <button
          type="button"
          class="sin info"
          aria-label={t('bots.mismoAdnTitulo')}
          aria-expanded={verMismoAdn}
          title={t('bots.mismoAdnAyuda')}
          onclick={() => (verMismoAdn = !verMismoAdn)}
        >
          ⓘ
        </button>
      {/if}
    </div>
    {#if verMismoAdn && nClaves !== bib.indice.length}
      <p class="help">{t('bots.mismoAdnAyuda')}</p>
    {/if}
    <div class="fila">
      <button class="btn sm" type="button" onclick={elegirVisibles}>
        {t('bots.sel.visibles')}
      </button>
      <button
        class="btn sm"
        type="button"
        disabled={!ui.sel.size}
        onclick={() => (ui.sel = new Set())}
      >
        {t('bots.sel.ninguno')}
      </button>
      <button
        class="btn sm"
        type="button"
        disabled={!ui.sel.size}
        title={t('bots.sel.favAyuda')}
        onclick={favASeleccion}
      >
        ★
      </button>
    </div>
    <div class="fila">
      <input
        class="sel crece"
        type="text"
        list="bots-tags"
        placeholder={t('bots.sel.tag')}
        aria-label={t('bots.sel.tag')}
        bind:value={tagSel}
      >
      <datalist id="bots-tags">
        {#each tags as [g] (g)}
          <option value={g}></option>
        {/each}
      </datalist>
      <button
        class="btn sm"
        type="button"
        disabled={!ui.sel.size || !tagSel.trim()}
        title={t('bots.sel.tagAgregar')}
        onclick={() => tagASeleccion(true)}
      >
        {t('bots.sel.tagMas')}
      </button>
      <button
        class="btn sm"
        type="button"
        disabled={!ui.sel.size || !tagSel.trim()}
        title={t('bots.sel.tagQuitar')}
        onclick={() => tagASeleccion(false)}
      >
        {t('bots.sel.tagMenos')}
      </button>
    </div>
    <div class="fila">
      <button class="btn sm pri" type="button" disabled={!ui.sel.size} onclick={abrirLote}>
        {t('bots.sel.sembrar')}
      </button>
      <button
        class="btn sm"
        type="button"
        disabled={!ui.sel.size}
        onclick={() => (verGuardarSel = true)}
      >
        {t('bots.sel.guardar')}
      </button>
    </div>
  </div>
</aside>

<DialogoLote bind:abierto={verLote} entradas={loteDe} />
<DialogoNombre
  bind:abierto={verGuardarSel}
  titulo={t('bots.seleccion.titulo')}
  etiqueta={t('bots.seleccion.nombre')}
  ayuda={t('bots.seleccion.ayuda', { n: ui.sel.size })}
  aceptar={t('bots.seleccion.guardar')}
  onAceptar={guardarSeleccion}
/>
<DialogoBot bind:abierto={verNuevo} modo="nuevo" onAceptar={crearNuevo} />

<style>
.bib {
  border-right: 1px solid var(--borde);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--fondo);
}
.cabeza {
  padding: 16px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--borde);
}
.titulo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.acciones {
  display: flex;
  gap: 6px;
  align-items: center;
}
.btn.sm {
  height: 32px;
  font-size: 13px;
  padding: 0 10px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.sel {
  font: inherit;
  font-size: 13px;
  height: 34px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
  color: var(--texto);
  box-sizing: border-box;
  min-width: 0;
}
.buscar {
  width: 100%;
  height: 38px;
  font-size: 14px;
  padding: 0 12px;
}
.fila {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.crece {
  flex: 1;
}
fieldset.seg {
  margin: 0;
  padding: 0;
  min-inline-size: 0;
}
.seg button {
  height: 32px;
}
.oculto {
  position: absolute;
  left: -9999px;
}
.menu {
  position: relative;
}
.menu summary {
  list-style: none;
}
.menu summary::-webkit-details-marker {
  display: none;
}
.menu-lista {
  position: absolute;
  right: 0;
  top: 36px;
  z-index: 5;
  background: var(--tarjeta);
  border: 1px solid var(--borde);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(21, 21, 19, 0.12);
  display: flex;
  flex-direction: column;
  min-width: 220px;
  padding: 4px;
}
.menu-lista button {
  font: inherit;
  font-size: 13px;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--texto);
}
.menu-lista button:hover {
  background: var(--hover-claro);
}
.menu-lista button:disabled {
  opacity: 0.5;
  cursor: default;
}
.filas {
  list-style: none;
  margin: 0;
  padding: 0;
}
.info {
  padding: 0 2px;
  color: var(--acento);
}
.plegar,
.enlace {
  font: inherit;
  font-size: 13px;
  border: 0;
  background: transparent;
  color: var(--acento);
  cursor: pointer;
  padding: 2px 0;
  text-align: left;
}
.filtros {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rejilla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.tgl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--chip-texto);
}
.tgl input {
  width: 16px;
  height: 16px;
  accent-color: var(--acento);
  margin: 0;
}
.caps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  max-height: 180px;
  overflow: auto;
}
.capg {
  font-size: 11px;
  font-weight: 600;
  color: var(--gris-claro);
  margin: 4px 2px 0 6px;
}
.chip.cap {
  border: 1px solid transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.chip.cap small {
  color: var(--gris-claro);
}
.chip.cap.req {
  background: #e3ecea;
  color: #0a3f3a;
  border-color: #9cc5bf;
}
.chip.cap.excl {
  background: #f8e6e1;
  color: #8a2b12;
  border-color: #e3b3a5;
  text-decoration: line-through;
}
.sels {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.selchip {
  padding: 0 4px 0 9px;
  gap: 2px;
}
.sin {
  font: inherit;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 3px 2px;
}
.x {
  font-size: 14px;
  line-height: 1;
  padding: 0 4px;
}
.help {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
}
.lista {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
.vacio {
  padding: 16px;
  font-size: 13px;
  color: var(--gris);
}
.gh {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 4px;
  position: sticky;
  top: 0;
  background: var(--fondo);
  z-index: 1;
}
.gh input,
.li input {
  width: 16px;
  height: 16px;
  accent-color: var(--acento);
  margin: 0;
  flex-shrink: 0;
}
.gt {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: 1;
  text-align: left;
  min-width: 0;
}
.tw {
  color: var(--gris-claro);
  font-size: 11px;
}
.n {
  font-size: 12px;
  color: var(--gris-claro);
  margin-left: auto;
}
.li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--chip);
}
.li:hover {
  background: var(--hover-claro);
}
.li.on {
  background: #e3ecea;
}
.estrella {
  font-size: 16px;
  line-height: 1;
  color: var(--gris-claro);
  flex-shrink: 0;
}
.estrella.fav {
  color: #c98500;
}
.nombre {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  text-decoration: none;
  color: var(--texto);
}
.nombre:hover {
  color: var(--texto);
}
.n1 {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.veg {
  font-weight: 400;
  color: #2f7d32;
}
.n2 {
  font-size: 12px;
  color: var(--gris-claro);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag {
  margin-left: 6px;
  color: var(--acento);
}
.pie {
  padding: 10px 16px;
  border-top: 1px solid var(--borde);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--tarjeta);
}
</style>
