<script>
// @ts-check
// Pestaña Resumen de la ficha (decisión 20): descripción, capacidades y
// arquetipo (profiles.json), qué lee y qué escribe, notas, tags y, si es
// propio, sus versiones.
import { untrack } from 'svelte';
import { num, t } from '../../i18n/index.svelte.js';
import { descripcionAdn, leeYEscribe } from './adn.js';
import {
  avisar,
  avisarError,
  bib,
  bots,
  confirmar,
  infoForo,
  recargarBiblioteca,
} from './biblioteca.svelte.js';
import { adnDeEntrada } from './datos.js';
import { descCap, rotuloArquetipo, rotuloCap, rotuloDisparo, rotuloGrupoCap } from './etiquetas.js';

/**
 * @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada
 * @typedef {import('../../../engine/bots.js').BotPropio} BotPropio
 * @type {{ entrada: Entrada, registro: BotPropio | null }}
 */
let { entrada, registro } = $props();

/** @type {string | null} */
let adn = $state(null);
let adnFallo = $state(false);

// El ADN depende del bot y de su versión (id + hash), no del objeto
// entrada: cada recarga del índice arma entradas nuevas.
const claveAdn = $derived(`${entrada.id}|${entrada.hash}`);
$effect(() => {
  claveAdn;
  const e = untrack(() => entrada);
  adn = null;
  adnFallo = false;
  let vigente = true;
  adnDeEntrada(e).then(
    (x) => {
      if (vigente) adn = x ?? null;
    },
    () => {
      if (vigente) adnFallo = true;
    },
  );
  return () => {
    vigente = false;
  };
});

const descripcion = $derived(
  (registro?.descripcion ?? '').trim() || (adn ? descripcionAdn(adn) : ''),
);
const le = $derived(adn ? leeYEscribe(adn) : null);

/** Capacidades del bot por grupo de profiles.json. */
const capsGrupos = $derived.by(() => {
  const caps = entrada.perfil?.caps ?? [];
  /** @type {Map<string, string[]>} */
  const g = new Map();
  for (const c of caps) {
    const grupo = bib.perfiles?.caps?.[c]?.group ?? '';
    let l = g.get(grupo);
    if (!l) {
      l = [];
      g.set(grupo, l);
    }
    l.push(c);
  }
  return [...g.entries()];
});

const tagsTodos = $derived(
  [...new Set(bib.indice.flatMap((e) => e.marcas.tags))].sort((a, b) => a.localeCompare(b)),
);

let notas = $state('');
let tagNuevo = $state('');
/** Las notas guardadas del bot que se está editando (no es estado: no redibuja). */
let notasDe = { clave: '', guardadas: '' };

// Las notas se cargan al cambiar de bot (por id), no en cada recarga del
// índice: así lo que se está escribiendo no se pisa. Se guardan al salir
// del campo y, si quedó algo sin guardar, al pasar a otro bot o salir de
// la ficha.
$effect(() => {
  const id = entrada.id;
  untrack(() => {
    if (entrada.id !== id) return;
    notas = entrada.marcas.notas;
    notasDe = { clave: entrada.clave, guardadas: entrada.marcas.notas };
  });
  return () => {
    const texto = untrack(() => notas);
    guardarNotas(notasDe.clave, texto);
  };
});

/** @param {string} [clave] @param {string} [texto] */
async function guardarNotas(clave = notasDe.clave, texto = notas) {
  if (!clave || texto.trim() === notasDe.guardadas) return;
  if (clave === notasDe.clave) notasDe.guardadas = texto.trim();
  try {
    await bots().notas(clave, texto, infoForo);
    await recargarBiblioteca();
  } catch (e) {
    avisarError(e);
  }
}

async function agregarTag() {
  if (!tagNuevo.trim()) return;
  try {
    await bots().agregarTag([entrada.clave], tagNuevo, infoForo);
    tagNuevo = '';
    await recargarBiblioteca();
  } catch (e) {
    avisarError(e);
  }
}

/** @param {string} tag */
async function quitarTag(tag) {
  try {
    await bots().quitarTag([entrada.clave], tag);
    await recargarBiblioteca();
  } catch (e) {
    avisarError(e);
  }
}

/** @param {number} n */
async function restaurar(n) {
  if (!registro) return;
  const ok = await confirmar(
    { clave: 'bots.confirmar.restaurar', params: { n } },
    { clave: 'bots.confirmar.restaurarSi' },
  );
  if (!ok) return;
  try {
    const b = await bots().restaurarVersion(
      registro.hash,
      n,
      t('bots.versiones.notaRestaurada', { n }),
    );
    await recargarBiblioteca();
    if (b) avisar('bots.aviso.restaurada', { n, v: b.versiones.length });
  } catch (e) {
    avisarError(e);
  }
}

/** @param {string} iso */
function fecha(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
</script>

<div class="rejilla">
  <section class="card">
    <h3>{t('bots.resumen.descripcion')}</h3>
    {#if descripcion}
      <p class="desc">{descripcion}</p>
    {:else if adnFallo}
      <p class="help">{t('bots.resumen.adnFallo')}</p>
    {:else}
      <p class="help">{adn === null ? t('bots.cargando') : t('bots.resumen.sinDescripcion')}</p>
    {/if}

    <h3>
      {t('bots.resumen.capacidades')}
      {#if entrada.perfil?.arch}
        ·
        {t('bots.resumen.arquetipo', {
  arquetipo: rotuloArquetipo(entrada.perfil.arch, bib.perfiles),
})}
      {/if}
    </h3>
    {#if capsGrupos.length}
      {#each capsGrupos as [grupo, caps] (grupo)}
        <div class="dl">
          <span class="help">{grupo ? rotuloGrupoCap(grupo) : '—'}</span>
          <span class="chips">
            {#each caps as c (c)}
              <span class="chip cap" title={descCap(c, bib.perfiles)}
                >{rotuloCap(c, bib.perfiles)}</span
              >
            {/each}
          </span>
        </div>
      {/each}
      {#if entrada.perfil?.geneCaps.length}
        <details>
          <summary class="help">
            {t('bots.resumen.porGen', { n: entrada.perfil.geneCaps.length })}
          </summary>
          {#each entrada.perfil.geneCaps as cs, i (i)}
            <div class="dl">
              <span class="help">{t('bots.resumen.gen', { n: i + 1 })}</span>
              <span class="chips">
                {#each cs as c (c)}
                  <span class="chip cap" title={descCap(c, bib.perfiles)}
                    >{rotuloCap(c, bib.perfiles)}</span
                  >
                {:else}
                  <span class="help">—</span>
                {/each}
              </span>
            </div>
          {/each}
        </details>
      {/if}
      <span class="help">{t('bots.resumen.capsAyuda')}</span>
    {:else}
      <p class="help">
        {entrada.clase === 'propio' ? t('bots.resumen.sinCapsPropio') : t('bots.resumen.sinCaps')}
      </p>
    {/if}
  </section>

  <section class="card">
    <h3>{t('bots.resumen.leeEscribe')}</h3>
    {#if le}
      <div class="le">
        <span class="help">{t('bots.resumen.lee')}</span>
        <span class="mono sv">{le.lee.length ? le.lee.map((x) => `.${x}`).join(' ') : '—'}</span>
      </div>
      <div class="le">
        <span class="help">{t('bots.resumen.escribe')}</span>
        <span class="mono sv"
          >{le.escribe.length ? le.escribe.map((x) => `.${x}`).join(' ') : '—'}</span
        >
      </div>
      {#if le.disparos.length}
        <div class="le">
          <span class="help">{t('bots.resumen.disparos')}</span>
          <span class="sv">{le.disparos.map(rotuloDisparo).join(' · ')}</span>
        </div>
      {/if}
    {:else}
      <p class="help">{adnFallo ? t('bots.resumen.adnFallo') : t('bots.cargando')}</p>
    {/if}

    <label for="bots-notas" class="h3">{t('bots.resumen.notas')}</label>
    <textarea
      id="bots-notas"
      class="notas"
      placeholder={t('bots.resumen.notasAyuda')}
      bind:value={notas}
      onblur={() => guardarNotas()}
    ></textarea>

    <span class="h3">{t('bots.resumen.tags')}</span>
    <div class="chips">
      {#each entrada.marcas.tags as tg (tg)}
        <span class="chip"
          >#{tg}<button
            type="button"
            class="x"
            aria-label={t('bots.resumen.quitarTag', { tag: tg })}
            onclick={() => quitarTag(tg)}
          >
            ×
          </button></span
        >
      {:else}
        <span class="help">{t('bots.resumen.sinTags')}</span>
      {/each}
    </div>
    <div class="fila">
      <input
        class="sel"
        type="text"
        list="bots-tags-ficha"
        placeholder={t('bots.resumen.tagNuevo')}
        aria-label={t('bots.resumen.tagNuevo')}
        bind:value={tagNuevo}
        onkeydown={(e) => {
  if (e.key === 'Enter') agregarTag();
}}
      >
      <datalist id="bots-tags-ficha">
        {#each tagsTodos as g (g)}
          <option value={g}></option>
        {/each}
      </datalist>
      <button class="btn sm" type="button" disabled={!tagNuevo.trim()} onclick={agregarTag}>
        {t('bots.resumen.agregarTag')}
      </button>
    </div>
  </section>

  {#if registro}
    <section class="card ancho">
      <h3>{t('bots.versiones.titulo')}</h3>
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col">{t('bots.versiones.version')}</th>
            <th scope="col">{t('bots.versiones.fecha')}</th>
            <th scope="col">{t('bots.versiones.nota')}</th>
            <th scope="col">{t('bots.versiones.hash')}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {#each [...registro.versiones].reverse() as v, i (v.n)}
            <tr>
              <td class="mono"><strong>v{v.n}</strong></td>
              <td>{fecha(v.fecha)}</td>
              <td>{v.nota || '—'}</td>
              <td class="mono" title={v.hash}>{v.hash.slice(0, 8)}</td>
              <td class="der">
                {#if i === 0}
                  <span class="help">{t('bots.versiones.actual')}</span>
                {:else}
                  <button class="btn sm" type="button" onclick={() => restaurar(v.n)}>
                    {t('bots.versiones.restaurar')}
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <span class="help">{t('bots.versiones.ayuda')}</span>
    </section>
  {/if}

  <section class="card ancho">
    <h3>{t('bots.resumen.datos')}</h3>
    <div class="le">
      <span class="help">{t('bots.resumen.hash')}</span>
      <span class="mono">{entrada.hash}</span>
    </div>
    {#if entrada.archivo}
      <div class="le">
        <span class="help">{t('bots.resumen.archivo')}</span>
        <span class="mono">{entrada.archivo}</span>
      </div>
    {/if}
    {#if entrada.perfil}
      <div class="le">
        <span class="help">{t('bots.resumen.genes')}</span>
        <span>{num(entrada.perfil.genes)}</span>
      </div>
    {/if}
    {#if registro}
      <div class="le">
        <span class="help">{t('bots.resumen.creado')}</span>
        <span>{fecha(registro.creado)}</span>
      </div>
    {/if}
  </section>
</div>

<style>
.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
  align-items: start;
}
.card {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.ancho {
  grid-column: 1 / -1;
}
h3,
.h3 {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 600;
}
.desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--chip-texto);
  white-space: pre-line;
}
.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
}
.dl {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  padding: 2px 0;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.chip.cap {
  background: var(--seleccion);
  color: var(--acento-hover);
}
.le {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sv {
  font-size: 12px;
  line-height: 1.6;
  color: var(--acento);
  overflow-wrap: anywhere;
}
.notas {
  font: inherit;
  font-size: 13px;
  min-height: 70px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  padding: 8px;
  resize: vertical;
  background: var(--tarjeta);
}
.x {
  font: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0 0 0 4px;
  color: inherit;
}
.fila {
  display: flex;
  gap: 6px;
}
.sel {
  font: inherit;
  font-size: 13px;
  height: 32px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
  flex: 1;
  min-width: 0;
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
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--gris-claro);
  font-weight: 600;
  text-align: left;
  padding: 6px;
  border-bottom: 1px solid var(--borde);
}
.tbl td {
  padding: 6px;
  border-bottom: 1px solid var(--chip);
  font-variant-numeric: tabular-nums;
}
.der {
  text-align: right;
}
</style>
