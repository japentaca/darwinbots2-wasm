// @ts-check
// Estado de Internet Mode de la sesión (paso N3.9, decisión 16): el núcleo
// puro de nucleo.js con su estado en runes. La barra superior lo lee sin
// crear la sim (`estadoIM.e` existe desde el arranque, apagado); el núcleo se
// engancha a la sesión la primera vez que se usa (conectar, apodo en vivo):
// antes de eso Internet Mode no puede estar encendido.

import { sesion } from '../sim/sesion.svelte.js';
import { estadoInicialIM, NucleoIM } from './nucleo.js';

class EstadoInternet {
  /** @type {import('./nucleo.js').EstadoIM} */
  e = $state.raw(estadoInicialIM());
}

/** Estado visible de Internet Mode (se reemplaza entero en cada cambio). */
export const estadoIM = new EstadoInternet();

/** @type {NucleoIM | null} */
let nucleo = null;

/**
 * El núcleo de Internet Mode de la página (se engancha a la sesión la
 * primera vez que se pide).
 * @returns {NucleoIM}
 */
export function internet() {
  if (!nucleo) {
    nucleo = new NucleoIM(sesion().c, {
      publicar: (e) => {
        estadoIM.e = e;
      },
    });
  }
  return nucleo;
}
