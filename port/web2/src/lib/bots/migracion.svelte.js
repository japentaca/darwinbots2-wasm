// @ts-check
// Migración de los datos de la clásica (decisión 17; engine/migracion.js)
// e import/export de la biblioteca propia, en la página.
//
// Al primer arranque (src/main.js) se copia darwinbots-inventario una sola
// vez. Si trajo algo, queda un aviso descartable (en Bots) hasta que el
// usuario lo cierra; la marca de «aviso pendiente» va en localStorage (es
// una comodidad de este navegador: si se pierde, el aviso no vuelve, pero
// los datos ya están migrados). «Importar desde la clásica» es la misma
// migración forzada.
//
// Los datos del foro (perfiles para pasar las claves 'file:' al hash y
// genes.json para armar los híbridos) se piden solo si la base vieja existe.

import {
  exportarBiblioteca,
  INV_NOMBRE,
  INV_STORES,
  importarBiblioteca,
  leerBaseVieja,
  migrarInventario,
} from '../../../engine/migracion.js';
import { almacen } from '../sim/almacen.svelte.js';
import { bib, recargarBiblioteca } from './biblioteca.svelte.js';
import { cargarForo, cargarGenes } from './datos.js';
import { migracionTrajoAlgo } from './textos.js';

const CLAVE_AVISO = 'darwinbots2.bots.avisoMigracion';

export const migracion = $state({
  /** @type {any} resumen de la última migración (o null) */
  resumen: null,
  visible: false,
  corriendo: false,
});

/** @param {boolean} si */
function marcarAviso(si) {
  try {
    if (si) localStorage.setItem(CLAVE_AVISO, '1');
    else localStorage.removeItem(CLAVE_AVISO);
  } catch {
    // sin almacenamiento: el aviso vale solo para esta sesión
  }
}

function avisoPendiente() {
  try {
    return localStorage.getItem(CLAVE_AVISO) === '1';
  } catch {
    return false;
  }
}

/**
 * Contexto de la migración: lee la base vieja y, si existe, trae los datos
 * del foro que hacen falta para transformarla.
 * @param {boolean} forzar
 */
function contexto(forzar) {
  /** @type {import('../../../engine/migracion.js').Contexto & {forzar: boolean,
   *   leer: () => Promise<import('../../../engine/migracion.js').BaseLeida | null>}} */
  const o = {
    forzar,
    leer: async () => {
      const leida = await leerBaseVieja({ nombre: INV_NOMBRE, stores: INV_STORES });
      if (leida) {
        try {
          const f = await cargarForo();
          o.bestiario = f.bestiario;
          o.perfiles = f.perfiles;
        } catch {
          // sin el foro, las claves 'file:' quedan como están
        }
        if (leida.stores.hybrids?.length) o.genes = await cargarGenes();
      }
      return leida;
    },
  };
  return o;
}

/** @type {Promise<void> | null} la migración del arranque (una vez) */
let enCurso = null;

/**
 * La migración automática del primer arranque (una vez por página: la
 * segunda llamada devuelve la misma promesa). No lanza: un fallo deja la
 * marca sin escribir y se reintenta en el próximo arranque.
 * @returns {Promise<void>}
 */
export function iniciarMigracion() {
  enCurso ??= migrarAlArrancar();
  return enCurso;
}

/**
 * Espera la migración del arranque (Competir: el roster del Contest viejo
 * busca los híbridos entre los propios que ella trae). Si no se lanzó, la
 * lanza.
 */
export const esperarMigracion = () => enCurso ?? iniciarMigracion();

/** @returns {Promise<void>} */
async function migrarAlArrancar() {
  try {
    migracion.corriendo = true;
    const r = await migrarInventario(almacen(), contexto(false));
    migracion.resumen = r.resumen;
    if (r.nueva && migracionTrajoAlgo(r.resumen)) marcarAviso(true);
    // sin localStorage, el aviso de una migración nueva se ve igual (en esta sesión)
    migracion.visible = (r.nueva || avisoPendiente()) && migracionTrajoAlgo(r.resumen);
    // si Bots ya estaba abierta, que muestre lo migrado
    if (r.nueva && (bib.listo || bib.cargando)) await recargarBiblioteca();
  } catch {
    // se reintenta al próximo arranque
  } finally {
    migracion.corriendo = false;
  }
}

/**
 * «Importar desde la clásica»: la migración forzada. Devuelve el resumen
 * (lanza los errores del almacén o de la lectura).
 */
export async function importarDesdeClasica() {
  migracion.corriendo = true;
  try {
    const r = await migrarInventario(almacen(), contexto(true));
    migracion.resumen = r.resumen;
    migracion.visible = true;
    return r.resumen;
  } finally {
    migracion.corriendo = false;
  }
}

/** Cierra el aviso de la migración (no vuelve a aparecer). */
export function descartarAviso() {
  migracion.visible = false;
  marcarAviso(false);
}

/** La biblioteca propia como texto JSON (para bajarla). */
export async function textoExport() {
  const doc = await exportarBiblioteca(almacen());
  return JSON.stringify(doc, null, 1);
}

/**
 * Importa un .json de la biblioteca (de la nueva o el Export del inventario
 * de la clásica). Lanza ErrorBots con código (json-invalido,
 * formato-desconocido, version-nueva).
 * @param {string} texto
 */
export async function importarTexto(texto) {
  /** @type {import('../../../engine/migracion.js').Contexto} */
  const ctx = {};
  try {
    const f = await cargarForo();
    ctx.bestiario = f.bestiario;
    ctx.perfiles = f.perfiles;
  } catch {
    // sin el foro se importa igual
  }
  if (/"hybrids"\s*:\s*\[\s*\{/.test(texto)) ctx.genes = await cargarGenes();
  return importarBiblioteca(almacen(), texto, ctx);
}
