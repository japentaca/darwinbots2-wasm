// @ts-check
// Migración de los torneos de la clásica (decisión 17; paso N3.5): al
// arrancar la app (src/main.js) se copia `darwinbots-ligas` a darwinbots2
// una sola vez (engine/migracion.js migrarLigas; la clásica no se toca).
// Si trajo algo, Competir muestra un aviso descartable hasta que el usuario
// lo cierra (la marca de «aviso pendiente» va en localStorage, como en
// Bots). Competir espera a que termine antes de leer los torneos
// (esperarMigracionLigas).

import { migrarLigas } from '../../../engine/migracion.js';
import { almacen } from '../sim/almacen.svelte.js';
import { ligasTrajoAlgo } from './textos.js';

export { ligasTrajoAlgo, lineasMigracionLigas } from './textos.js';

const CLAVE_AVISO = 'darwinbots2.competir.avisoMigracion';

export const migracionLigas = $state({
  /** @type {any} resumen de migrarLigas (o null) */
  resumen: null,
  visible: false,
});

/** @type {Promise<void> | null} */
let enCurso = null;

/** @param {boolean} si */
function marcar(si) {
  try {
    if (si) localStorage.setItem(CLAVE_AVISO, '1');
    else localStorage.removeItem(CLAVE_AVISO);
  } catch {
    // sin almacenamiento: el aviso vale solo para esta sesión
  }
}

function pendiente() {
  try {
    return localStorage.getItem(CLAVE_AVISO) === '1';
  } catch {
    return false;
  }
}

/**
 * La migración automática del arranque. No lanza: un fallo deja la marca
 * sin escribir y se reintenta en el próximo arranque.
 * @returns {Promise<void>}
 */
export function iniciarMigracionLigas() {
  enCurso ??= (async () => {
    try {
      const r = await migrarLigas(almacen());
      migracionLigas.resumen = r.resumen;
      if (r.nueva && ligasTrajoAlgo(r.resumen)) marcar(true);
      migracionLigas.visible = (r.nueva || pendiente()) && ligasTrajoAlgo(r.resumen);
    } catch {
      // se reintenta al próximo arranque
    }
  })();
  return enCurso;
}

/** Competir espera la migración (si se lanzó) antes de leer los torneos. */
export const esperarMigracionLigas = () => enCurso ?? iniciarMigracionLigas();

/** Cierra el aviso (no vuelve a aparecer). */
export function descartarAvisoLigas() {
  migracionLigas.visible = false;
  marcar(false);
}
