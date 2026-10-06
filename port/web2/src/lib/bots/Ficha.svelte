<script>
// @ts-check
// Ficha del bot (decisión 20): cabecera con acciones (sembrar, duplicar,
// datos, borrar, favorito) y las pestañas Resumen, ADN (editor de
// src/lib/bots/editor/, decisión 18: los del foro son de solo lectura y se
// editan duplicándolos) e Historial.
import { LG_SCRATCH_ID, lgSeason } from '../../../engine/league.js';
import { idioma, num, t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { nombreTorneo, textoNota } from '../competir/textos.js';
import {
  abrir as abrirTorneo,
  asegurarTorneos,
  est as estCompetir,
  inscribirEn,
  torneos,
  tr as trCompetir,
} from '../competir/torneos.svelte.js';
import { urlManual } from '../manual.js';
import Dialogo from '../observar/Dialogo.svelte';
import {
  avisar,
  avisarError,
  bib,
  bots,
  confirmar,
  conNombreDelForo,
  infoForo,
  recargarBiblioteca,
} from './biblioteca.svelte.js';
import DialogoBot from './DialogoBot.svelte';
import DialogoLote from './DialogoLote.svelte';
import DialogoNombre from './DialogoNombre.svelte';
import { adnDeEntrada } from './datos.js';
import Editor from './editor/Editor.svelte';
import { rotuloArquetipo } from './etiquetas.js';
import Historial from './Historial.svelte';
import Resumen from './Resumen.svelte';
import { PESTAÑAS, rutaFicha } from './ruta.js';

/**
 * @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada
 * @typedef {import('../../../engine/bots.js').BotPropio} BotPropio
 * @type {{ entrada: Entrada, pestana: import('./ruta.js').Pestaña }}
 */
let { entrada, pestana } = $props();

const registro = $derived(
  entrada.clase === 'propio'
    ? /** @type {BotPropio | null} */ (
        bib.registros.find((r) => r.clase === 'propio' && r.hash === entrada.clave) ?? null
      )
    : null,
);

const origen = $derived.by(() => {
  const o = registro?.origen;
  if (!o) return '';
  if ((o.tipo === 'foro' || o.tipo === 'propio') && o.nombre)
    return t('bots.ficha.copiaDe', { nombre: o.nombre });
  if (o.tipo === 'hibrido') return t('bots.ficha.hibrido', { nombre: o.nombre ?? '' });
  if (o.tipo === 'importado') return t('bots.ficha.importado');
  return '';
});

const sub = $derived.by(() => {
  const p = entrada.perfil;
  /** @type {string[]} */
  const partes = [];
  if (entrada.clase === 'propio') {
    partes.push(t('bots.ficha.propio'));
    if (origen) partes.push(origen);
  } else if (entrada.foro) partes.push(entrada.foro);
  if (entrada.vegetal) partes.push(t('bots.vegetal'));
  if (p?.arch) partes.push(rotuloArquetipo(p.arch, bib.perfiles));
  if (p) partes.push(t('bots.ficha.genes', { n: num(p.genes) }));
  if (p?.tokens) partes.push(t('bots.ficha.tokens', { n: num(p.tokens) }));
  if (registro) partes.push(t('bots.ficha.version', { n: registro.versiones.length }));
  return partes.join(' · ');
});

let verLote = $state(false);
let verDuplicar = $state(false);
let verDatos = $state(false);

async function alternarFav() {
  try {
    await bots().favorito([entrada.clave], !entrada.marcas.fav, infoForo);
    await recargarBiblioteca();
  } catch (e) {
    avisarError(e);
  }
}

/**
 * Tras crear o renombrar un propio: recarga y va a su ficha.
 * @param {string} clave @param {import('./ruta.js').Pestaña} [p]
 */
async function irAPropio(clave, p = 'resumen') {
  await recargarBiblioteca();
  const e = bib.indice.find((x) => x.clase === 'propio' && x.clave === clave);
  if (e) location.hash = rutaFicha(e, bib.indice, p);
}

/** @param {string} nombre vacío = automático («<nombre> 2»…) */
async function duplicar(nombre) {
  try {
    const adn = await adnDeEntrada(entrada);
    if (!adn) throw new Error(entrada.archivo ?? entrada.nombre);
    const b = await conNombreDelForo((op) =>
      bots().duplicar(entrada, adn, nombre ? { nombre, ...op } : {}),
    );
    if (!b) return false;
    avisar('bots.aviso.duplicado', { nombre: b.nombre });
    await irAPropio(b.hash, 'adn');
    return true;
  } catch (e) {
    avisarError(e);
    return false;
  }
}

/** @param {{nombre: string, vegetal: boolean, descripcion: string}} d */
async function guardarDatos(d) {
  try {
    const b = await conNombreDelForo((op) =>
      bots().cambiarDatos(
        entrada.clave,
        { nombre: d.nombre, vegetal: d.vegetal, descripcion: d.descripcion },
        op,
      ),
    );
    if (!b) return false;
    await irAPropio(b.hash, pestana);
    return true;
  } catch (e) {
    avisarError(e);
    return false;
  }
}

// ---- Inscribir en torneo (N3.6): el partido rápido o un torneo guardado ----
let verInscribir = $state(false);
let destino = $state(LG_SCRATCH_ID);
let inscribiendo = $state(false);
/** @type {{id: string, nombre: string, temporada: number, n: number, ronda: boolean}[]} */
let destinos = $state.raw([]);
const elegido = $derived(destinos.find((d) => d.id === destino) ?? null);

async function abrirInscribir() {
  verInscribir = true;
  destinos = [];
  let x;
  try {
    x = await asegurarTorneos();
  } catch (e) {
    verInscribir = false;
    avisarError(e);
    return;
  }
  const lista = [x.lgScratch(), ...x.lg.list.filter((L) => L.id !== LG_SCRATCH_ID)];
  destinos = lista.map((L) => {
    const S = /** @type {any} */ (lgSeason(L));
    return {
      id: L.id,
      nombre: nombreTorneo(L, trCompetir),
      temporada: S.no,
      n: S.entrants.length,
      ronda: !!S.ronda,
    };
  });
  const cur = x.lg.cur?.id;
  destino = destinos.some((d) => d.id === cur) ? /** @type {string} */ (cur) : LG_SCRATCH_ID;
}

async function inscribir() {
  const d = elegido;
  if (!d || d.ronda || inscribiendo) return;
  inscribiendo = true;
  try {
    // abrir primero para ver los bloqueos de la temporada con sus partidos
    // (sin el aviso de antes: si falla, el que queda es el de este intento)
    estCompetir.aviso = null;
    if (!(await abrirTorneo(d.id))) {
      const detalle = estCompetir.aviso?.texto ?? '';
      avisar(
        detalle ? 'bots.inscribir.falloDetalle' : 'bots.inscribir.fallo',
        { torneo: d.nombre, detalle },
        { error: true },
      );
      return;
    }
    const x = torneos();
    const L = x?.lg.cur;
    if (!x || !L) return;
    const S = /** @type {any} */ (lgSeason(L));
    const bloqueada = x.lgSeasonMatches(S.no).length > 0;
    if (S.ronda) {
      avisar('bots.inscribir.bloqueo', { nota: t('competir.nota.round-running') }, { error: true });
      verInscribir = false;
      return;
    }
    if (bloqueada && S.fmt.format === 'cup') {
      avisar('bots.inscribir.bloqueo', { nota: t('competir.nota.groups-locked') }, { error: true });
      verInscribir = false;
      return;
    }
    estCompetir.aviso = null;
    const notaAntes = estCompetir.nota?.n ?? 0;
    await inscribirEn(d.id, [entrada.clave]);
    const a = estCompetir.aviso;
    // no se inscribió (ya estaba, mismo ADN): la nota del motor lo explica
    const n = estCompetir.nota;
    const dup = n && n.n > notaAntes && n.clave === 'entrant-dup' ? textoNota(n, trCompetir) : '';
    const nota = bloqueada ? ` ${t('competir.nota.locked')}` : '';
    avisar(
      'bots.inscribir.hecho',
      { torneo: d.nombre, detalle: `${dup || a?.texto || ''}${nota}`.trim() },
      { error: !!a?.aviso || !!dup },
    );
    verInscribir = false;
  } catch (e) {
    avisarError(e);
  } finally {
    inscribiendo = false;
  }
}

async function borrar() {
  const ok = await confirmar(
    { clave: 'bots.confirmar.borrarBot', params: { nombre: entrada.nombre } },
    { clave: 'bots.confirmar.borrar' },
  );
  if (!ok) return;
  try {
    const nombre = entrada.nombre;
    await bots().borrar(entrada.clave);
    await recargarBiblioteca();
    avisar('bots.aviso.borrado', { nombre });
    location.hash = hashDe('bots');
  } catch (e) {
    avisarError(e);
  }
}
</script>

<div class="ficha">
  <header class="cab">
    <div class="tit">
      <h2>{entrada.nombre}</h2>
      <div class="sub">
        {sub}
        {#if entrada.url}
          · <a href={entrada.url} target="_blank" rel="noopener">{t('bots.ficha.foroEnlace')}</a>
        {/if}
      </div>
    </div>
    <div class="acc">
      <button class="btn pri" type="button" onclick={() => (verLote = true)}>
        {t('bots.ficha.sembrar')}
      </button>
      <button class="btn" type="button" onclick={() => (verDuplicar = true)}>
        {entrada.soloLectura ? t('bots.ficha.duplicarEditar') : t('bots.ficha.duplicar')}
      </button>
      <button
        class="btn"
        type="button"
        disabled={entrada.vegetal}
        title={entrada.vegetal ? t('bots.inscribir.vegetal') : t('bots.inscribir.ayuda')}
        onclick={abrirInscribir}
      >
        {t('bots.inscribir.boton')}
      </button>
      {#if registro}
        <button class="btn" type="button" onclick={() => (verDatos = true)}>
          {t('bots.ficha.datos')}
        </button>
        <button class="btn" type="button" onclick={borrar}>{t('bots.ficha.borrar')}</button>
      {/if}
      <button
        class="btn estrella"
        class:fav={entrada.marcas.fav}
        type="button"
        aria-pressed={entrada.marcas.fav}
        aria-label={t('bots.favoritoDe', { nombre: entrada.nombre })}
        title={t('bots.favoritoDe', { nombre: entrada.nombre })}
        onclick={alternarFav}
      >
        {entrada.marcas.fav ? '★' : '☆'}
      </button>
    </div>
  </header>

  <nav class="tabs" aria-label={t('bots.ficha.pestanas')}>
    {#each PESTAÑAS as p (p)}
      <a
        href={rutaFicha(entrada, bib.indice, p)}
        class:on={pestana === p}
        aria-current={pestana === p ? 'page' : undefined}
        >{t(`bots.pestana.${p}`)}</a
      >
    {/each}
    <a
      class="manual"
      href={urlManual(idioma() === 'en' ? 'en' : 'es', pestana === 'adn' ? 'app/editor/' : 'app/bots/')}
      title={t('bots.ficha.ayuda')}
      aria-label={t('bots.ficha.ayuda')}
      >?</a
    >
  </nav>

  <div class="cuerpo" class:adn={pestana === 'adn'}>
    {#if pestana === 'resumen'}
      <Resumen {entrada} {registro} />
    {:else if pestana === 'adn'}
      <!-- el aviso de solo lectura y «Duplicar para editar» los muestra el Editor -->
      <Editor
        bot={entrada}
        {registro}
        soloLectura={entrada.soloLectura}
        oncambio={() => recargarBiblioteca()}
        onduplicado={(r) => irAPropio(r.hash, 'adn')}
      />
    {:else}
      <Historial {entrada} />
    {/if}
  </div>
</div>

<DialogoLote bind:abierto={verLote} entradas={[entrada]} />
<Dialogo
  bind:abierto={verInscribir}
  titulo={t('bots.inscribir.titulo', { nombre: entrada.nombre })}
>
  {#if !destinos.length}
    <p class="help">{t('bots.inscribir.cargando')}</p>
  {:else}
    <fieldset class="destinos">
      <legend class="help">{t('bots.inscribir.destino')}</legend>
      {#each destinos as d (d.id)}
        <label class="destino" class:off={d.ronda}>
          <input type="radio" name="destino" value={d.id} bind:group={destino} disabled={d.ronda}>
          <span>
            <strong>{d.nombre}</strong>
            <span class="help"
              >{t('bots.inscribir.temporada', { no: num(d.temporada), n: num(d.n) })}</span
            >
          </span>
        </label>
      {/each}
    </fieldset>
    {#if elegido?.ronda}
      <p class="help">{t('competir.nota.round-running')}</p>
    {/if}
    <p class="help">{t('bots.inscribir.congelado')}</p>
    <p class="help">{t('bots.inscribir.abre')}</p>
  {/if}
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (verInscribir = false)}>
      {t('bots.cancelar')}
    </button>
    <button
      class="btn pri"
      type="button"
      disabled={!elegido || elegido.ronda || inscribiendo}
      onclick={inscribir}
    >
      {t('bots.inscribir.aceptar')}
    </button>
  {/snippet}
</Dialogo>
<DialogoNombre
  bind:abierto={verDuplicar}
  titulo={t('bots.duplicar.titulo', { nombre: entrada.nombre })}
  etiqueta={t('bots.duplicar.nombre')}
  ayuda={t('bots.duplicar.ayuda')}
  vacioOk
  aceptar={t('bots.duplicar.aceptar')}
  onAceptar={duplicar}
/>
{#if registro}
  <DialogoBot
    bind:abierto={verDatos}
    modo="editar"
    inicial={{
  nombre: registro.nombre,
  vegetal: registro.vegetal,
  descripcion: registro.descripcion,
}}
    onAceptar={guardarDatos}
  />
{/if}

<style>
.ficha {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}
.cab {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.tit {
  flex: 1;
  min-width: 220px;
}
h2 {
  margin: 0;
  font-size: 23px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.sub {
  font-size: 13px;
  color: var(--gris);
  margin-top: 2px;
}
.acc {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn {
  height: 38px;
  padding: 0 14px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.destinos {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.destino {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}
.destino span {
  display: flex;
  flex-direction: column;
}
.destino.off {
  opacity: 0.55;
  cursor: default;
}
.help {
  font-size: 12px;
  color: var(--gris);
  margin: 0;
}
.estrella {
  font-size: 18px;
  color: var(--gris-claro);
}
.estrella.fav {
  color: var(--ambar);
}
.tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--borde);
}
.tabs a {
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  padding: 8px 14px;
  color: var(--gris);
  text-decoration: none;
  margin-bottom: -1px;
}
.tabs a.on {
  color: var(--texto);
  border-bottom-color: var(--acento);
}
.tabs a.manual {
  margin-left: auto;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  margin-right: 8px;
  border: 1px solid var(--borde-control);
  border-radius: 50%;
  color: var(--gris);
  font-weight: 600;
}
.tabs a.manual:hover {
  color: var(--texto);
  background: var(--hover-claro);
}
.cuerpo {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 18px;
}
</style>
