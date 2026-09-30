// @ts-check
// Estado de la biblioteca de Bots en la página (paso N3.2): el índice
// (engine/biblioteca.js construirIndice) sobre el almacén único de la
// página (src/lib/sim/almacen.svelte.js) y los datos del foro (C1); los
// filtros, la vista y la selección (src/lib/bots/estado.js) en runes, para
// que sobrevivan al cambiar de pantalla; avisos y confirmaciones.
//
// Otras partes de Bots (el editor de ADN) llaman a recargarBiblioteca()
// después de guardar, para que la lista y la ficha se actualicen.

import { construirIndice } from '../../../engine/biblioteca.js';
import { crearBots } from '../../../engine/bots.js';
import { almacen } from '../sim/almacen.svelte.js';
import { cargarForo, nombresForo } from './datos.js';
import { filtroInicial, podarSeleccion, vistaInicial } from './estado.js';
import { mensajeError } from './textos.js';

/**
 * @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada
 * @typedef {import('../../../engine/biblioteca.js').Perfiles} Perfiles
 * @typedef {import('../../../engine/biblioteca.js').Filtro} Filtro
 * @typedef {import('../../../engine/bots.js').RegistroBot} RegistroBot
 * @typedef {import('../../../engine/bots.js').Seleccion} Seleccion
 * @typedef {import('./textos.js').Mensaje} Mensaje
 */

class EstadoBiblioteca {
  /** @type {Entrada[]} */
  indice = $state.raw([]);
  /** @type {RegistroBot[]} */
  registros = $state.raw([]);
  /** @type {Perfiles | null} */
  perfiles = $state.raw(null);
  /** @type {Seleccion[]} */
  selecciones = $state.raw([]);
  listo = $state(false);
  cargando = $state(false);
  /** @type {Mensaje | null} error al cargar (ni el foro ni el almacén) */
  error = $state.raw(null);
  /** @type {Mensaje | null} el almacén falló: la biblioteca sigue sin los propios ni las marcas */
  errorAlmacen = $state.raw(null);
  /** @type {Mensaje | null} el foro falló: la biblioteca sigue con los propios */
  errorForo = $state.raw(null);
  /** @type {(Mensaje & {error?: boolean, lineas?: Mensaje[]}) | null} */
  aviso = $state.raw(null);
  /** @type {{texto: Mensaje, confirmar: Mensaje, resolver: (ok: boolean) => void} | null} */
  confirmacion = $state.raw(null);
}

class EstadoUi {
  /** @type {Required<Filtro>} */
  filtro = $state.raw(filtroInicial());
  vista = $state.raw(vistaInicial());
  /** @type {Set<string>} claves elegidas */
  sel = $state.raw(new Set());
  /** @type {Set<string>} ids de grupo plegados */
  plegados = $state.raw(new Set());
  verFiltros = $state(false);
}

export const bib = new EstadoBiblioteca();
export const ui = new EstadoUi();

/** @type {ReturnType<typeof crearBots> | null} */
let api = null;

/** Operaciones sobre los bots del usuario (engine/bots.js) en el almacén de la página. */
export function bots() {
  api ??= crearBots({ almacen: almacen(), nombresForo });
  return api;
}

/** @type {Promise<void> | null} */
let enCurso = null;

/**
 * Vuelve a leer el foro (la primera vez) y el almacén, y rearma el índice.
 * Las dos fuentes se cargan aparte: el foro solo alcanza para mostrar la
 * biblioteca (sin los propios ni las marcas) mientras el almacén no
 * responde (p. ej. bloqueado por otra pestaña: estadoAlmacen.bloqueado) y
 * si falla (bib.errorAlmacen; se conservan los registros que ya había). Sin
 * el foro, quedan los propios (bib.errorForo). Solo si fallan las dos no
 * hay índice (bib.error).
 * @returns {Promise<void>}
 */
export function recargarBiblioteca() {
  if (enCurso) return enCurso.then(() => recargarBiblioteca());
  bib.cargando = true;
  enCurso = (async () => {
    /** @type {{bestiario: import('../../../engine/biblioteca.js').BotForo[], perfiles: Perfiles | null} | null} */
    let foro = null;
    let almacenListo = false;
    const deAlmacen = Promise.all([bots().todos(), bots().selecciones()]).finally(() => {
      almacenListo = true;
    });
    // que el rechazo no quede sin atender mientras se espera el foro
    deAlmacen.catch(() => {});
    const publicar = () => {
      bib.indice = construirIndice({
        bestiario: foro?.bestiario ?? [],
        perfiles: foro?.perfiles ?? null,
        registros: bib.registros,
      });
      bib.perfiles = foro?.perfiles ?? null;
      ui.sel = podarSeleccion(ui.sel, bib.indice);
      bib.error = null;
      bib.listo = true;
    };
    try {
      try {
        foro = await cargarForo();
        bib.errorForo = null;
      } catch (e) {
        bib.errorForo = mensajeError(e);
      }
      // el almacén todavía no respondió: la biblioteca del foro, ya
      if (foro && !almacenListo && !bib.listo) publicar();
      try {
        const [registros, selecciones] = await deAlmacen;
        bib.registros = registros;
        bib.selecciones = selecciones;
        bib.errorAlmacen = null;
      } catch (e) {
        bib.errorAlmacen = mensajeError(e);
        if (!foro) {
          bib.error = bib.errorForo ?? bib.errorAlmacen;
          return;
        }
      }
      publicar();
    } finally {
      bib.cargando = false;
      enCurso = null;
    }
  })();
  return enCurso;
}

/** Carga la biblioteca si todavía no se cargó. */
export function asegurarBiblioteca() {
  if (!bib.listo && !bib.cargando) return recargarBiblioteca();
  return enCurso ?? Promise.resolve();
}

/**
 * Aviso en la barra de la biblioteca.
 * @param {string} clave @param {Record<string, string | number>} [params]
 * @param {{error?: boolean, lineas?: Mensaje[]}} [o]
 */
export function avisar(clave, params, o = {}) {
  bib.aviso = { clave, params, ...o };
}

/** Aviso con el texto de un error. @param {unknown} e */
export function avisarError(e) {
  const m = mensajeError(e);
  bib.aviso = { ...m, error: true };
}

/**
 * Pide confirmación (diálogo en la pantalla). Resuelve true si se acepta.
 * @param {Mensaje} texto @param {Mensaje} confirmar texto del botón
 * @returns {Promise<boolean>}
 */
export function confirmar(texto, confirmar) {
  bib.confirmacion?.resolver(false);
  return new Promise((resolver) => {
    bib.confirmacion = {
      texto,
      confirmar,
      resolver: (ok) => {
        bib.confirmacion = null;
        resolver(ok);
      },
    };
  });
}

/**
 * Corre una operación que puede chocar con un nombre del Bestiary
 * ('nombre-del-foro'): pregunta y, si se acepta, la repite con
 * permitirNombreForo. Devuelve el resultado, o null si se canceló.
 * @template T
 * @param {(op: {permitirNombreForo?: boolean}) => Promise<T>} fn
 * @returns {Promise<T | null>}
 */
export async function conNombreDelForo(fn) {
  try {
    return await fn({});
  } catch (e) {
    const x = /** @type {any} */ (e);
    if (x?.codigo !== 'nombre-del-foro') throw e;
    const ok = await confirmar(
      { clave: 'bots.confirmar.nombreForo', params: { nombre: String(x.params?.nombre ?? '') } },
      { clave: 'bots.confirmar.usarIgual' },
    );
    if (!ok) return null;
    return fn({ permitirNombreForo: true });
  }
}

/**
 * Info de un bot del foro por clave (nombre y archivo), para las marcas.
 * @param {string} clave
 */
export function infoForo(clave) {
  const e = bib.indice.find((x) => x.clave === clave && x.clase === 'foro');
  return e ? { nombre: e.nombre, archivo: e.archivo } : undefined;
}
