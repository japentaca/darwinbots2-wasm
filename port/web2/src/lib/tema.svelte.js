// @ts-check
// Tema elegido por el usuario (Auto / Claro / Oscuro, barra superior). La
// preferencia va en localStorage (comodidad de este navegador: si falta, se
// sigue al sistema). index.html ya puso data-tema antes de montar la app;
// aquí solo se lee y se cambia. `oscuro()` sirve a quien pinte con JS
// (canvas, SVG con colores calculados) y deba seguir el tema.

import { CLAVE_TEMA, normalizarTema, temaEfectivo } from './tema.js';

/** @returns {import('./tema.js').Tema} */
function temaGuardado() {
  try {
    return normalizarTema(localStorage.getItem(CLAVE_TEMA));
  } catch {
    return 'auto';
  }
}

const consulta = globalThis.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

const estado = $state({
  preferencia: temaGuardado(),
  sistemaOscuro: consulta?.matches ?? false,
});

consulta?.addEventListener('change', (e) => {
  estado.sistemaOscuro = e.matches;
});

/** @returns {import('./tema.js').Tema} */
export function tema() {
  return estado.preferencia;
}

/** @returns {boolean} si lo que se ve es el tema oscuro */
export function oscuro() {
  return temaEfectivo(estado.preferencia, estado.sistemaOscuro) === 'oscuro';
}

/** @param {import('./tema.js').Tema} t */
export function setTema(t) {
  estado.preferencia = t;
  const raiz = document.documentElement;
  if (t === 'auto') delete raiz.dataset.tema;
  else raiz.dataset.tema = t;
  try {
    if (t === 'auto') localStorage.removeItem(CLAVE_TEMA);
    else localStorage.setItem(CLAVE_TEMA, t);
  } catch {
    // Sin almacenamiento: vale para esta visita.
  }
}
