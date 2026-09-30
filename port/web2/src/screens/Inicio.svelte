<script>
// @ts-check
// Inicio (paso N1.6, Nivel 1 de port/web2/PLAN.md): la última corrida, la
// galería de escenarios (de fábrica y propios, decisión 12), las corridas
// guardadas y los bots recientes. La lógica pura vive en src/lib/inicio/.
//
// Contratos con otras pantallas:
//   Ajustar   → #/experimentar/<id del escenario> (de fábrica o propio)
//   Competir  → #/competir (escenarios con destino 'competir')
//   Bots      → #/bots/<nombre exacto del bot> (y #/bots para la biblioteca)
import { onMount } from 'svelte';
import { ESCENARIOS_FABRICA } from '../../engine/escenarios/fabrica.js';
import { textoEn } from '../../engine/escenarios/index.js';
import { idioma, num, t } from '../i18n/index.svelte.js';
import {
  claveError,
  claveEtiqueta,
  formaPlural,
  listarPropios,
  semillaNueva,
} from '../lib/inicio/datos.js';
import { escenarioDesdeTxt } from '../lib/inicio/desde-txt.js';
import MiniaturaMundo from '../lib/inicio/MiniaturaMundo.svelte';
import { botsRecientes } from '../lib/inicio/recientes.js';
import { fechaCorta, haceCuanto } from '../lib/inicio/tiempo.js';
import VistaEscenario from '../lib/inicio/VistaEscenario.svelte';
import { indiceBestiario } from '../lib/observar/bestiario.js';
import { cicloVisible } from '../lib/sim/ciclo.js';
import { actual, corridasGuardadas, corrida as obtenerCorrida } from '../lib/sim/corrida.svelte.js';
import { hashDe } from '../router.js';

/** @type {{ partes?: string[] }} */
let { partes: _partes = [] } = $props();

/**
 * @typedef {import('../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../engine/corridas.js').Corrida} Corrida
 */

/** Corridas del lateral antes de «Ver todas». */
const CORRIDAS_LATERAL = 4;

const lang = $derived(idioma() === 'en' ? 'en' : 'es');
let ahora = $state(Date.now());

/** @type {Corrida[]} */
let corridas = $state.raw([]);
let cargandoCorridas = $state(true);
/** @type {Escenario[]} */
let propios = $state.raw([]);
/** @type {{ name: string, board?: string, veg?: boolean }[] | null} */
let bestiario = $state.raw(null);
/** @type {{ clave: string, params?: Record<string, string | number> }[]} */
let avisos = $state.raw([]);
let verTodas = $state(false);
/** acción en curso ('' = ninguna): id del escenario o de la corrida */
let ocupado = $state('');
/** @type {HTMLInputElement | undefined} */
let inputArchivo = $state();
/** @type {HTMLInputElement | undefined} */
let inputDbsim = $state();

/** @param {{ clave: string, params?: Record<string, string | number> }} a */
function avisar(a) {
  avisos = [...avisos.filter((x) => x.clave !== a.clave), a];
}

async function cargarCorridas() {
  try {
    corridas = await corridasGuardadas().listar();
  } catch (e) {
    avisar(claveError(e, 'corridas'));
  } finally {
    cargandoCorridas = false;
  }
}

async function cargarPropios() {
  try {
    const r = await listarPropios(lang);
    propios = r.validos;
    if (r.invalidos)
      avisar({
        clave: plural('inicio.error.propiosInvalidos', r.invalidos),
        params: { n: num(r.invalidos) },
      });
  } catch (e) {
    avisar(claveError(e, 'escenarios'));
  }
}

async function cargarBestiario() {
  try {
    bestiario = await indiceBestiario();
  } catch (e) {
    avisar(claveError(e, 'bestiario'));
  }
}

onMount(() => {
  cargarCorridas();
  cargarPropios();
  cargarBestiario();
  const id = setInterval(() => (ahora = Date.now()), 30_000);
  return () => clearInterval(id);
});

// ---- Corrida en memoria --------------------------------------------------------

const cor = $derived(actual.corrida);
const hayActual = $derived(!!cor && cor.sesion.hayMundo);
const guardadaActual = $derived(
  cor?.estado.id ? (corridas.find((c) => c.id === cor.estado.id) ?? null) : null,
);
// Del resumen vivo del núcleo (se refresca a lo sumo cada REFRESCO_MS), no de
// sesion.stats, que cambia en cada frame: la tarjeta no se redibuja por frame.
// sesion.stats solo se lee (y se sigue) mientras no hay resumen.
const vivo = $derived(cor?.estado.vivo ?? null);
const cicloActual = $derived(cicloVisible(vivo ? vivo.ciclo : cor?.sesion.stats.cycle));
const botsActual = $derived(vivo ? vivo.vivos : (cor?.sesion.stats.bots ?? 0));
/** Especies con nombre: con la vista clásica el resumen agrupa por color (null). */
const especiesActual = $derived(vivo?.rica ? vivo.especies : null);
const ultimaGuardada = $derived(corridas[0] ?? null);

/**
 * ¿Se puede reemplazar la sim en memoria? Pregunta si el núcleo dice que
 * hay algo sin guardar (sinGuardar(): avanzó o tuvo eventos desde el último
 * guardado).
 */
function puedeReemplazar() {
  if (!hayActual || !cor?.sinGuardar()) return true;
  return confirm(t('inicio.confirmar.reemplazar'));
}

const ir = (/** @type {string} */ h) => {
  window.location.hash = h;
};

/**
 * Corre una operación que reemplaza la sim. `fn` devuelve si terminó bien
 * (false/null = otra operación la reemplazó): recién entonces se navega a
 * `destino`, y solo si el usuario sigue en Inicio (no se fue a otra
 * pantalla mientras esperaba). Un error se avisa acá y en el aviso de la
 * corrida (lo muestra Observar).
 * @param {string} id @param {() => Promise<unknown>} fn @param {string} destino
 * @param {Parameters<typeof claveError>[1]} contexto
 */
async function accion(id, fn, destino, contexto) {
  if (ocupado) return;
  ocupado = id;
  const hashInicio = window.location.hash;
  try {
    const ok = await fn();
    if (ok && window.location.hash === hashInicio) ir(destino);
  } catch (e) {
    const a = claveError(e, contexto);
    avisar(a);
    actual.corrida?.avisar?.(a.clave, a.params, true);
  } finally {
    ocupado = '';
  }
}

/** @param {Escenario} e */
function iniciar(e) {
  if (e.destino === 'competir') {
    ir(hashDe('competir'));
    return;
  }
  if (!puedeReemplazar()) return;
  accion(
    e.id,
    async () => {
      const c = obtenerCorrida();
      if (!(await c.iniciar(e, semillaNueva()))) return false;
      c.sesion.correr(true);
      return true;
    },
    hashDe('observar'),
    'iniciar',
  );
}

/** @param {Corrida} c */
function retomar(c) {
  const id = /** @type {string} */ (c.id);
  // La corrida en memoria ya es esa: seguirla (cargar volvería al guardado).
  if (hayActual && cor?.estado.id === id) {
    ir(hashDe('observar'));
    return;
  }
  if (!puedeReemplazar()) return;
  accion(
    id,
    async () => (await obtenerCorrida().cargar(id)) !== null,
    hashDe('observar'),
    'retomar',
  );
}

/** @param {File} f */
function abrirArchivo(f) {
  if (!puedeReemplazar()) return;
  accion(
    'archivo',
    async () => {
      const c = obtenerCorrida();
      if (/\.txt$/i.test(f.name)) {
        const texto = await f.text();
        const e = escenarioDesdeTxt(texto, f.name);
        const bot = e.especies[e.especies.length - 1].bot;
        const nombre = t('inicio.archivo.nombreTxt', { bot });
        if (!(await c.iniciar(e, semillaNueva(), { nombre }))) return false;
        c.sesion.correr(true);
        return true;
      }
      return c.importarDbsim(new Uint8Array(await f.arrayBuffer()), f.name);
    },
    hashDe('observar'),
    'archivo',
  );
}

/** @param {Event & { currentTarget: HTMLInputElement }} ev */
function alElegir(ev) {
  const f = ev.currentTarget.files?.[0];
  ev.currentTarget.value = '';
  if (f) abrirArchivo(f);
}

// ---- Textos -------------------------------------------------------------------

/** @param {Escenario} e */
const nombreEsc = (e) => textoEn(e.nombre, lang);
/** @param {Escenario} e */
const descEsc = (e) => (e.descripcion ? textoEn(e.descripcion, lang) : '');

/** @param {string} etiqueta */
function etiqueta(etiqueta) {
  const k = claveEtiqueta(etiqueta);
  return k ? t(`inicio.etiqueta.${k}`) : etiqueta;
}

/**
 * Clave con plural (PLURALES de claves.js) para n.
 * @param {string} clave @param {number} n
 */
function plural(clave, n) {
  return `${clave}.${formaPlural(n, lang)}`;
}

/** «3 bots», «1 especie»… @param {'bots' | 'especies'} que @param {number} n */
const cuantos = (que, n) => t(plural(`inicio.n.${que}`, n), { n: num(n) });

/** @param {Escenario} e */
function chips(e) {
  return [...e.etiquetas.map(etiqueta), cuantos('especies', e.especies.length)];
}

/** @param {string | undefined} fecha */
const guardadaHace = (fecha) =>
  t('inicio.ultima.guardada', { hace: haceCuanto(fecha, ahora, lang) });

const escenarios = $derived([...ESCENARIOS_FABRICA, ...propios]);
const esPropio = (/** @type {Escenario} */ e) => propios.includes(e);

const corridasVisibles = $derived(verTodas ? corridas : corridas.slice(0, CORRIDAS_LATERAL));

const recientes = $derived(
  botsRecientes({
    actual:
      hayActual && cor
        ? {
            escenario: cor.estado.escenario,
            especies: especiesActual?.map((e) => e.nombre) ?? [],
            colores: cor.estado.colores,
          }
        : null,
    corridas,
    bestiario,
  }),
);
</script>

<div class="inicio">
  <div class="principal">
    <h1 class="solo-lector">{t('inicio.titulo')}</h1>
    {#if avisos.length}
      <div class="avisos">
        {#each avisos as a (a.clave)}
          <div class="aviso" role="alert">
            <span>{t(a.clave, a.params)}</span>
            <button
              type="button"
              class="x"
              aria-label={t('inicio.aviso.cerrar')}
              title={t('inicio.aviso.cerrar')}
              onclick={() => (avisos = avisos.filter((x) => x !== a))}
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Última corrida -->
    <div class="card ultima">
      {#if hayActual && cor}
        <div class="mini">
          <MiniaturaMundo
            sesion={cor.sesion}
            respaldo={guardadaActual?.miniatura ?? null}
            alt={t('inicio.ultima.miniatura')}
          />
        </div>
        <div class="datos">
          <span class="lbl">{t('inicio.ultima.titulo')}</span>
          <h2>{cor.estado.nombre || t('inicio.ultima.sinNombre')}</h2>
          <div class="mono meta">
            {especiesActual
  ? t('inicio.ultima.meta', {
      ciclo: num(cicloActual),
      bots: cuantos('bots', botsActual),
      especies: cuantos('especies', especiesActual.length),
    })
  : t('inicio.corridas.meta', { ciclo: num(cicloActual), bots: cuantos('bots', botsActual) })}
            ·
            {guardadaActual ? guardadaHace(guardadaActual.fecha) : t('inicio.ultima.sinGuardar')}
          </div>
          <div class="botones">
            <a class="btn pri" href={hashDe('observar')}>{t('inicio.ultima.continuar')}</a>
            <a class="btn" href={hashDe('analizar')}>{t('inicio.ultima.analisis')}</a>
          </div>
        </div>
      {:else if ultimaGuardada}
        <div class="mini">
          {#if ultimaGuardada.miniatura}
            <img src={ultimaGuardada.miniatura} alt={t('inicio.ultima.miniatura')}>
          {/if}
        </div>
        <div class="datos">
          <span class="lbl">{t('inicio.ultima.tituloGuardada')}</span>
          <h2>{ultimaGuardada.nombre}</h2>
          <div class="mono meta">
            {ultimaGuardada.especies?.length
  ? t('inicio.ultima.meta', {
      ciclo: num(ultimaGuardada.ciclo),
      bots: cuantos('bots', ultimaGuardada.bots),
      especies: cuantos('especies', ultimaGuardada.especies.length),
    })
  : t('inicio.corridas.meta', {
      ciclo: num(ultimaGuardada.ciclo),
      bots: cuantos('bots', ultimaGuardada.bots),
    })}
            ·
            {guardadaHace(ultimaGuardada.fecha)}
          </div>
          <div class="botones">
            <button
              class="btn pri"
              type="button"
              disabled={!!ocupado}
              onclick={() => retomar(ultimaGuardada)}
            >
              {ocupado === ultimaGuardada.id ? t('inicio.cargandoCorrida') : t('inicio.ultima.retomar')}
            </button>
          </div>
        </div>
      {:else if cargandoCorridas}
        <div class="mini"></div>
        <div class="datos">
          <span class="lbl">{t('inicio.ultima.titulo')}</span>
          <p class="gris">{t('inicio.cargando')}</p>
        </div>
      {:else}
        <div class="mini vacia">
          <svg
            aria-hidden="true"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6fd3c5"
            stroke-width="1.5"
          >
            <circle cx="12" cy="12" r="8"></circle>
            <circle cx="15" cy="10" r="1.6"></circle>
            <path d="M12 4v3"></path>
          </svg>
        </div>
        <div class="datos">
          <span class="lbl">{t('inicio.ultima.titulo')}</span>
          <h2>{t('inicio.vacio.titulo')}</h2>
          <p class="gris">{t('inicio.vacio.texto')}</p>
          <div class="botones">
            <!-- Un href="#escenarios" lo corregiría el router a #/: se desplaza a mano. -->
            <button
              class="btn pri"
              type="button"
              onclick={() => document.getElementById('escenarios')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t('inicio.vacio.elegir')}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Escenarios -->
    <div class="cabecera" id="escenarios">
      <div>
        <h2 class="seccion">{t('inicio.escenarios.titulo')}</h2>
        <p class="gris">{t('inicio.escenarios.desc')}</p>
      </div>
      <a href={hashDe('experimentar')}>{t('inicio.escenarios.propia')}</a>
    </div>

    <div class="galeria">
      {#each escenarios as e (e.id)}
        <div class="card escenario">
          <div class="vista"><VistaEscenario escenario={e} /></div>
          <div class="cuerpo">
            <div class="nombre">{nombreEsc(e)}</div>
            <div class="desc">{descEsc(e)}</div>
            <div class="chips">
              {#if esPropio(e)}
                <span class="chip propio">{t('inicio.chip.propio')}</span>
              {/if}
              {#each chips(e) as c, i (i)}
                <span class="chip">{c}</span>
              {/each}
            </div>
            <div class="botones">
              <button class="btn pri" type="button" disabled={!!ocupado} onclick={() => iniciar(e)}>
                {#if ocupado === e.id}
                  {t('inicio.escenarios.iniciando')}
                {:else if e.destino === 'competir'}
                  {t('inicio.escenarios.elegirBots')}
                {:else}
                  {t('inicio.escenarios.iniciar')}
                {/if}
              </button>
              <!-- Sin href mientras hay una operación en curso: no navega. -->
              <a
                class="btn"
                href={ocupado ? undefined : hashDe('experimentar', e.id)}
                aria-disabled={ocupado ? 'true' : undefined}
                >{t('inicio.escenarios.ajustar')}</a
              >
            </div>
          </div>
        </div>
      {/each}

      <div class="card escenario">
        <div class="vista archivo">
          <svg
            aria-hidden="true"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b6962"
            stroke-width="1.5"
          >
            <path d="M6 3h8l4 4v14H6z"></path>
            <path d="M14 3v4h4"></path>
            <path d="M12 11v6M9 14l3-3 3 3"></path>
          </svg>
        </div>
        <div class="cuerpo">
          <div class="nombre">{t('inicio.archivo.titulo')}</div>
          <div class="desc">{t('inicio.archivo.desc')}</div>
          <div class="chips">
            <span class="chip">.dbsim</span>
            <span class="chip">.txt</span>
          </div>
          <div class="botones">
            <button
              class="btn pri"
              type="button"
              disabled={!!ocupado}
              onclick={() => inputArchivo?.click()}
            >
              {ocupado === 'archivo' ? t('inicio.cargandoCorrida') : t('inicio.archivo.elegir')}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <aside class="lateral" aria-label={t('inicio.lateral.aria')}>
    <div class="card panel">
      <div class="lbl titulo">{t('inicio.corridas.titulo')}</div>
      {#if cargandoCorridas}
        <p class="gris chico">{t('inicio.cargando')}</p>
      {:else if !corridas.length}
        <p class="gris chico">{t('inicio.corridas.vacio')}</p>
      {/if}
      {#each corridasVisibles as c (c.id)}
        <button
          type="button"
          class="fila"
          disabled={!!ocupado}
          title={t('inicio.corridas.retomar', { nombre: c.nombre })}
          onclick={() => retomar(c)}
        >
          <span class="col">
            <span class="fnombre">
              {c.nombre}
              {#if hayActual && cor?.estado.id === c.id}
                <span class="chip actual">{t('inicio.corridas.actual')}</span>
              {/if}
            </span>
            <span class="mono fmeta"
              >{t('inicio.corridas.meta', { ciclo: num(c.ciclo), bots: cuantos('bots', c.bots) })}</span
            >
          </span>
          <span class="fecha">{fechaCorta(c.fecha, ahora, lang)}</span>
        </button>
      {/each}
      <div class="enlaces">
        {#if corridas.length > CORRIDAS_LATERAL}
          <button type="button" class="enlace" onclick={() => (verTodas = !verTodas)}>
            {verTodas
  ? t('inicio.corridas.verMenos')
  : t('inicio.corridas.verTodas', { n: num(corridas.length) })}
          </button>
        {/if}
        <button
          type="button"
          class="enlace"
          disabled={!!ocupado}
          onclick={() => inputDbsim?.click()}
        >
          {t('inicio.corridas.importar')}
        </button>
      </div>
    </div>

    <div class="card panel">
      <div class="lbl titulo">{t('inicio.bots.titulo')}</div>
      {#if !recientes.length}
        <p class="gris chico">{t('inicio.bots.vacio')}</p>
      {/if}
      {#each recientes as b (b.nombre)}
        <a class="fila bot" href={hashDe('bots', b.nombre)}>
          <span class="sw" style:background={b.color ?? 'var(--gris-claro)'}></span>
          <span class="bnombre">{b.nombre}</span>
          <span class="fecha">{b.categoria ? t(`inicio.categoria.${b.categoria}`) : ''}</span>
        </a>
      {/each}
      <div class="enlaces">
        <a href={hashDe('bots')}>
          {bestiario
  ? t('inicio.bots.biblioteca', { bots: cuantos('bots', bestiario.length) })
  : t('inicio.bots.bibliotecaSinN')}
        </a>
      </div>
    </div>

    <p class="nota">{t('inicio.nota')}</p>
  </aside>

  <input
    bind:this={inputArchivo}
    class="oculto"
    type="file"
    accept=".dbsim,.txt,text/plain,application/octet-stream"
    onchange={alElegir}
  >
  <input
    bind:this={inputDbsim}
    class="oculto"
    type="file"
    accept=".dbsim,application/octet-stream"
    onchange={alElegir}
  >
</div>

<style>
.inicio {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 32px;
  padding: 32px 56px;
  box-sizing: border-box;
  max-width: 1600px;
}
.principal {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.gris {
  margin: 0;
  font-size: 14px;
  color: var(--gris);
}
.chico {
  font-size: 13px;
  color: var(--gris-claro);
  padding: 4px 0 8px;
}
.avisos {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.aviso {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 14px;
}
.aviso span {
  flex: 1;
}
.x {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 2px 6px;
}

/* Última corrida */
.ultima {
  display: flex;
  gap: 24px;
  padding: 16px;
  align-items: center;
}
.mini {
  position: relative;
  width: 300px;
  height: 150px;
  border-radius: 8px;
  background: var(--mundo);
  overflow: hidden;
  flex-shrink: 0;
}
.mini img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mini.vacia {
  display: flex;
  align-items: center;
  justify-content: center;
}
.datos {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-grow: 1;
  min-width: 0;
}
h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.meta {
  font-size: 13px;
  color: var(--gris);
}
.botones {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.btn:disabled,
.btn[aria-disabled="true"] {
  opacity: 0.6;
  cursor: default;
}

/* Escenarios */
.cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}
h2.seccion {
  font-size: 22px;
}
.solo-lector {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.cabecera p {
  margin-top: 4px;
}
.cabecera a {
  font-size: 14px;
  white-space: nowrap;
}
.galeria {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.escenario {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.vista {
  position: relative;
  height: 96px;
  background: var(--mundo);
  overflow: hidden;
}
.vista.archivo {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--chip);
}
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 16px;
  flex-grow: 1;
}
.nombre {
  font-size: 16px;
  font-weight: 600;
}
.desc {
  font-size: 13px;
  line-height: 1.45;
  color: var(--gris);
  flex-grow: 1;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chip.propio {
  background: var(--barra-activa);
  color: #ffffff;
}
.cuerpo .botones {
  gap: 8px;
  margin-top: 4px;
}
.cuerpo .btn {
  height: 36px;
}

/* Lateral */
.lateral {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.panel {
  padding: 18px 20px;
}
.titulo {
  margin-bottom: 12px;
}
.fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 0;
  border: 0;
  border-top: 1px solid var(--chip);
  background: transparent;
  font: inherit;
  text-align: left;
  color: var(--texto);
  text-decoration: none;
  cursor: pointer;
}
.fila:disabled {
  cursor: default;
  opacity: 0.6;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.fnombre {
  font-size: 14px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.chip.actual {
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 11px;
}
.fmeta {
  font-size: 12px;
  color: var(--gris-claro);
}
.fecha {
  font-size: 12px;
  color: var(--gris-claro);
  white-space: nowrap;
}
.bot {
  justify-content: flex-start;
  gap: 10px;
  padding: 9px 0;
  font-size: 14px;
}
.bnombre {
  flex-grow: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.fila:hover .fnombre,
.fila:hover .bnombre {
  color: var(--acento);
}
.enlaces {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  font-size: 13px;
}
.enlace {
  border: 0;
  background: transparent;
  padding: 0;
  font: inherit;
  color: var(--acento);
  text-decoration: underline;
  cursor: pointer;
}
.enlace:hover {
  color: var(--acento-hover);
}
.enlace:disabled {
  opacity: 0.6;
  cursor: default;
}
.nota {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--gris-claro);
}
.oculto {
  display: none;
}

@media (max-width: 1300px) {
  .galeria {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 1050px) {
  .inicio {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 700px) {
  .inicio {
    padding: 24px 16px;
  }
  .galeria {
    grid-template-columns: minmax(0, 1fr);
  }
  .ultima {
    flex-direction: column;
    align-items: stretch;
  }
  .mini {
    width: 100%;
  }
}
</style>
