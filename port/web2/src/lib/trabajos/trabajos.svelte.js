// @ts-check
// La cola de trabajos de la página (decisiones 10, 23 y C20): ColaCompartida
// de engine/cola.js sobre el almacén 'trabajos' de la IndexedDB darwinbots2
// (la conexión única de src/lib/sim/almacen.svelte.js), con un pool de
// workers de sim del navegador (C10: init con la base absoluta del wasm y
// BUILD_ID) y el estado visible en runes.
//
// iniciarTrabajos() se llama al arrancar la app (src/main.js): la crea la
// primera vez y, si esta pestaña consigue el lock 'darwinbots2-cola'
// (navigator.locks), REANUDA lo que quedó pendiente o a medias (las
// unidades hechas no se repiten; las interrumpidas se reinician). Con otra
// pestaña ya dueña, esta solo muestra el estado (canal
// 'darwinbots2-trabajos') y le pide sus acciones; si la dueña se cierra,
// la toma. Devuelve la ColaCompartida: encolar, cancelar, reintentar,
// borrar, marcarVisto y resultados valen en cualquier pestaña.
//
// Ciclo de vida de la página: `pagehide` detiene la cola, suelta el lock y
// cierra los workers; `pageshow` con `persisted` (volver desde el bfcache)
// la vuelve a crear y reanuda.
//
// Avisos al terminar: con la Notification API si el usuario dio permiso
// (se pide con un botón: pedirPermiso()), solo desde la pestaña que corrió
// el trabajo, y, siempre, en la interfaz de todas las pestañas
// (estadoTrabajos.avisos, hasta que se descartan: quedan marcados vistos).

import { ACTIVOS, ColaCompartida, NOMBRE_CANAL } from '../../../engine/cola.js';
import { TIPO_RONDA } from '../../../engine/rondas.js';
import { BUILD_ID, urlSitio } from '../../build.js';
import { t } from '../../i18n/index.svelte.js';
import { almacen } from '../sim/almacen.svelte.js';
import { ejecutores } from './ejecutores.js';
import { PoolWorkers, paraleloDe, TOPE_MAX } from './pool.js';

const CLAVE_TOPE = 'darwinbots2.trabajos.tope';
/** Refresco máximo de la lista visible (el progreso llega muy seguido). */
const REFRESCO_MS = 200;

/**
 * @typedef {import('../../../engine/cola.js').Trabajo} Trabajo
 * @typedef {'granted' | 'denied' | 'default' | 'sin-soporte'} Permiso
 */

export const estadoTrabajos = $state(
  /** @type {{lista: Trabajo[], avisos: {id: string, titulo: string, estado: string}[],
   *   permiso: Permiso, paralelo: number, tope: number | null, error: string,
   *   duena: boolean}} */ ({
    lista: [],
    avisos: [],
    permiso: permisoActual(),
    paralelo: 1,
    tope: leerTope(),
    error: '',
    duena: false,
  }),
);

/** Trabajos en la cola (pendientes o corriendo). @param {Trabajo[]} lista */
export const enCola = (lista) => lista.filter((x) => ACTIVOS.includes(x.estado)).length;

/** @returns {Permiso} */
function permisoActual() {
  const N = /** @type {any} */ (globalThis).Notification;
  if (!N) return 'sin-soporte';
  return N.permission;
}

/** @returns {number | null} */
function leerTope() {
  try {
    const v = Number(localStorage.getItem(CLAVE_TOPE));
    return v >= 1 ? Math.trunc(v) : null;
  } catch {
    return null;
  }
}

const nucleos = () => globalThis.navigator?.hardwareConcurrency;

/** Worker de sim del navegador, ya con su init (como la sesión, C10). */
function crearWorkerPagina() {
  const w = import.meta.env.DEV
    ? new Worker(new URL('../../../engine/worker.js', import.meta.url), { type: 'module' })
    : new Worker(new URL('../../../engine/worker.js', import.meta.url));
  w.postMessage({ t: 'init', base: urlSitio('build-wasm/'), v: BUILD_ID });
  return {
    canal: {
      enviar: (/** @type {any} */ m) => w.postMessage(m),
      on: (/** @type {(m: any) => void} */ fn) => {
        /** @param {MessageEvent} e */
        const h = (e) => fn(e.data);
        w.addEventListener('message', h);
        return () => w.removeEventListener('message', h);
      },
      alError: (/** @type {(e: any) => void} */ fn) => {
        /** @param {ErrorEvent} e */
        const h = (e) => fn(e.error ?? e.message ?? e);
        w.addEventListener('error', h);
        return () => w.removeEventListener('error', h);
      },
    },
    terminar: () => w.terminate(),
  };
}

/** @type {ColaCompartida | null} */
let cola = null;
/** @type {PoolWorkers | null} */
let pool = null;
let escuchando = false;

function alCambio() {
  if (!cola) return;
  estadoTrabajos.lista = cola.lista();
  estadoTrabajos.duena = cola.duena;
}

// Rondas de torneo (decisión 23; receta en la cabecera de engine/rondas.js,
// punto 3): Competir se carga a demanda (import dinámico: sin ciclo con
// src/lib/competir/torneos.svelte.js, que encola en esta cola). La pestaña
// dueña reconcilia las rondas con la cola al serlo y cuando una termina; las
// demás releen la liga.
/** @param {ColaCompartida} c */
function alDuenaRondas(c) {
  import('../competir/torneos.svelte.js')
    .then((m) => m.alSerDuena(/** @type {any} */ (c)))
    .catch((e) => console.error(e));
}

/** @param {Trabajo} tr @param {boolean} propia */
function alTerminarRonda(tr, propia) {
  const c = cola;
  if (!c) return;
  import('../competir/torneos.svelte.js')
    .then((m) => m.alTerminarRonda(tr, propia, /** @type {any} */ (c)))
    .catch((e) => console.error(e));
}

/** @param {Trabajo} tr @param {boolean} propia */
function alTerminar(tr, propia) {
  alCambio();
  if (tr.tipo === TIPO_RONDA) alTerminarRonda(tr, propia);
  const titulo = tr.titulo || t('comparar.trabajos.sinTitulo');
  const clave = tr.estado === 'terminado' ? 'comparar.aviso.terminado' : 'comparar.aviso.fallido';
  const texto = t(clave, { titulo });
  const N = /** @type {any} */ (globalThis).Notification;
  if (propia && N && N.permission === 'granted') {
    try {
      new N(t('comparar.aviso.tituloNotificacion'), { body: texto, tag: tr.id });
    } catch {
      // algunos navegadores solo notifican desde un service worker
    }
  }
  estadoTrabajos.avisos = [
    ...estadoTrabajos.avisos.filter((a) => a.id !== tr.id),
    { id: tr.id, titulo, estado: tr.estado },
  ];
}

/** Canal entre pestañas (null sin BroadcastChannel). */
function canalPestanas() {
  const B = /** @type {any} */ (globalThis).BroadcastChannel;
  return B ? new B(NOMBRE_CANAL) : null;
}

/** Deja la cola de esta pestaña quieta (se va la página o entra al bfcache). */
function cerrar() {
  cola?.detener();
  pool?.cerrarTodos();
  cola = null;
  pool = null;
  estadoTrabajos.duena = false;
}

function escucharPagina() {
  if (escuchando || !globalThis.addEventListener) return;
  escuchando = true;
  globalThis.addEventListener('pagehide', cerrar);
  globalThis.addEventListener('pageshow', (/** @type {PageTransitionEvent} */ e) => {
    if (e.persisted && !cola) iniciarTrabajos();
  });
  // El tope elegido en otra pestaña (localStorage es del origen).
  globalThis.addEventListener('storage', (/** @type {StorageEvent} */ e) => {
    if (e.key !== CLAVE_TOPE) return;
    estadoTrabajos.tope = leerTope();
    estadoTrabajos.paralelo = paraleloDe(nucleos(), estadoTrabajos.tope);
    if (cola) cola.paralelo = estadoTrabajos.paralelo;
  });
}

/**
 * La cola de la página; la primera vez la crea, pide el lock y (si es la
 * dueña) reanuda lo pendiente.
 * @returns {ColaCompartida}
 */
export function iniciarTrabajos() {
  if (cola) return cola;
  escucharPagina();
  const p = new PoolWorkers({ crear: crearWorkerPagina });
  pool = p;
  estadoTrabajos.paralelo = paraleloDe(nucleos(), estadoTrabajos.tope);
  const c = new ColaCompartida({
    almacen: almacen(),
    ejecutores: ejecutores({ pool: p }),
    locks: /** @type {any} */ (globalThis.navigator)?.locks ?? null,
    canal: canalPestanas,
    paralelo: estadoTrabajos.paralelo,
    refrescoMs: REFRESCO_MS,
    alCambio,
    alTerminar,
    alDuena: () => {
      alCambio();
      alDuenaRondas(c);
    },
  });
  cola = c;
  c.iniciar().then(
    () => {
      if (cola === c) alCambio();
    },
    (e) => {
      estadoTrabajos.error = String(e?.message ?? e);
    },
  );
  return c;
}

/**
 * Tope de workers en paralelo (null = el de por defecto, hasta 8). Se
 * recuerda en este navegador.
 * @param {number | null} tope
 */
export function fijarTope(tope) {
  const v = tope && tope >= 1 ? Math.trunc(tope) : null;
  estadoTrabajos.tope = v;
  try {
    if (v) localStorage.setItem(CLAVE_TOPE, String(v));
    else localStorage.removeItem(CLAVE_TOPE);
  } catch {
    // sin almacenamiento: vale solo para esta sesión
  }
  estadoTrabajos.paralelo = paraleloDe(nucleos(), v);
  if (cola) cola.paralelo = estadoTrabajos.paralelo;
}

/** Máximo que tiene sentido ofrecer (núcleos − 1, hasta TOPE_MAX). */
export const paraleloMaximo = () => paraleloDe(nucleos(), TOPE_MAX);

/** Pide permiso para notificar (con un gesto del usuario: un botón). */
export async function pedirPermiso() {
  const N = /** @type {any} */ (globalThis).Notification;
  if (!N) return;
  try {
    estadoTrabajos.permiso = await N.requestPermission();
  } catch {
    estadoTrabajos.permiso = N.permission;
  }
}

/** Descarta el aviso de un trabajo y lo marca visto. @param {string} id */
export function descartarAviso(id) {
  estadoTrabajos.avisos = estadoTrabajos.avisos.filter((a) => a.id !== id);
  cola?.marcarVisto(id).catch((e) => console.error(e));
}
