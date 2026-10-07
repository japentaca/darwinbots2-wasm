// @ts-check
// Torneo en curso (paso N3.6, decisión 23; PLAN-TORNEO-EN-CURSO.md, TC1 y
// TC2): el estado reactivo del avance y su cableado con la página. La
// lógica (la secuencia de maquina.js, el tic, la vigilancia del partido y
// cuándo parar) está en avance.js, sin runes ni DOM; acá se le pasan el
// estado de torneos (src/lib/competir/torneos.svelte.js), la sim de la
// página, el reloj y el sessionStorage.
//
// El avance es un estado de la app, no de una pantalla: lo encienden
// «▶ Jugar» o «Mirar» en Competir (entrarTv) y «Reanudar» en la franja de
// la barra superior (FranjaTorneo.svelte); lo apagan sus propios controles
// (Parar, Abandonar la pelea) o «Al terminar la pelea». Navegar no lo toca.
// La pantalla completa es un botón de Observar que tampoco lo toca.

import { lgDrawOf, lgProgress, lgSeason } from '../../../../engine/league.js';
import { hashDe } from '../../../router.js';
import { asegurarBiblioteca } from '../../bots/biblioteca.svelte.js';
import { nombreTorneo, textoError, textoProgreso } from '../../competir/textos.js';
import {
  abandonar,
  abrir,
  asegurarTorneos,
  est,
  torneos,
  tr,
} from '../../competir/torneos.svelte.js';
import { sesion } from '../../sim/sesion.svelte.js';
import { crearAvance } from './avance.js';
import { estadoInicial, PAUSA_DEF, pausaValida } from './maquina.js';

/** Segundos de la cortinilla (la clave de la clásica se lee como valor inicial). */
const KV_PAUSA = 'darwinbots2.tv-pausa';
const KV_PAUSA_CLASICA = 'db-tv-pause';
/** A pantalla completa, la tarjeta de la pelea oculta ('1') o a la vista. */
const KV_OCULTA = 'darwinbots2.tv-tarjeta-oculta';
/** «Al terminar la pelea»: 'parar', 'temporada' o 'ediciones'. */
const KV_AL_TERMINAR = 'darwinbots2.tv-al-terminar';
/** sessionStorage: el id del torneo en curso (T9: «Reanudar» tras recargar). */
const KS_EN_CURSO = 'darwinbots2.torneo-en-curso';
export const AL_TERMINAR = /** @type {const} */ (['parar', 'temporada', 'ediciones']);
/** @typedef {(typeof AL_TERMINAR)[number]} AlTerminar */

class EstadoTv {
  /** @type {import('./maquina.js').EstadoTV} */
  e = $state.raw(estadoInicial());
  /** performance.now() del último tic (la cuenta atrás del rótulo) */
  ahora = $state(0);
  /** id del torneo del avance ('' = ninguno) */
  liga = $state('');
  /** @type {import('./avance.js').MarcadorTv | null} el último marcador de la pelea (se ve en el respiro) */
  final = $state.raw(null);
  /** a pantalla completa, la tarjeta de la pelea plegada a un chip */
  oculta = $state(leer(KV_OCULTA) === '1');
  /** @type {AlTerminar} qué hacer al terminar cada pelea */
  alTerminar = $state(alTerminarValido(leer(KV_AL_TERMINAR)));
  /** «Parar al terminar esta pelea» pedido (vale solo para esta vuelta) */
  pararTras = $state(false);
  /** id del torneo cortado por una recarga ('' = ninguno): la franja ofrece «Reanudar» */
  reanudable = $state('');
}

/** @param {any} x @returns {AlTerminar} */
function alTerminarValido(x) {
  return AL_TERMINAR.includes(x) ? x : 'temporada';
}

/** @param {string} k */
function leer(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** sessionStorage tolerante (sin almacenamiento: no se ofrece reanudar). */
const sesionKv = {
  leer() {
    try {
      return sessionStorage.getItem(KS_EN_CURSO) ?? '';
    } catch {
      return '';
    }
  },
  /** @param {string} id */
  guardar(id) {
    try {
      sessionStorage.setItem(KS_EN_CURSO, id);
    } catch {
      // sin almacenamiento: no se ofrece reanudar
    }
  },
  borrar() {
    try {
      sessionStorage.removeItem(KS_EN_CURSO);
    } catch {
      // sin almacenamiento
    }
  },
};

export const tv = new EstadoTv();

// Las dependencias de torneos.svelte.js van en funciones: el ciclo de
// imports torneos → Marcador → tv → torneos evalúa este módulo antes que
// aquél, y sus exports todavía no existen.
const avance = crearAvance({
  estado: tv,
  torneos: () => torneos(),
  asegurarTorneos: () => asegurarTorneos(),
  abrir: (id) => abrir(id),
  abandonar: () => abandonar(),
  asegurarBiblioteca: () => asegurarBiblioteca(),
  est: () => est,
  // la sim pudo quedar en pausa (se pausó en Observar): la pelea sigue
  reanudarSim() {
    const s = sesion();
    if (!s.corriendo) s.correr(true);
  },
  ahora: () => performance.now(),
  reloj: { poner: (fn, ms) => setInterval(fn, ms), quitar: (h) => clearInterval(h) },
  enCurso: sesionKv,
  textoError: (e) => textoError(e, tr),
});

// Tras una recarga: el torneo que estaba en curso se ofrece para reanudar
// (no arranca solo); si ya no existe, la oferta se descarta. Se mira
// después de cargar los módulos (por el ciclo de imports de arriba).
{
  const id = sesionKv.leer();
  if (id) {
    tv.reanudable = id;
    setTimeout(() => {
      asegurarTorneos()
        .then((x) => {
          if (tv.reanudable === id && !x.lgFind(id)) descartarReanudar();
        })
        .catch(() => {});
    }, 0);
  }
}

/** Segundos de cortinilla guardados (5 si no hay). */
export function pausaGuardada() {
  return pausaValida(leer(KV_PAUSA) ?? leer(KV_PAUSA_CLASICA) ?? PAUSA_DEF);
}

/** Cambia los segundos de cortinilla (valen desde la próxima pelea). @param {any} x */
export function ponerPausa(x) {
  const p = pausaValida(x);
  try {
    localStorage.setItem(KV_PAUSA, String(p));
  } catch {
    // sin almacenamiento: no se recuerda
  }
  tv.e = { ...tv.e, pausa: p };
}

/** Cambia «Al terminar la pelea» y lo recuerda. @param {any} x */
export function ponerAlTerminar(x) {
  tv.alTerminar = alTerminarValido(x);
  try {
    localStorage.setItem(KV_AL_TERMINAR, tv.alTerminar);
  } catch {
    // sin almacenamiento: no se recuerda
  }
}

/** Pliega o despliega la tarjeta de la pelea (pantalla completa) y lo recuerda. */
export function alternarTarjeta() {
  tv.oculta = !tv.oculta;
  try {
    localStorage.setItem(KV_OCULTA, tv.oculta ? '1' : '0');
  } catch {
    // sin almacenamiento: no se recuerda
  }
}

/** ¿Hay una pelea lanzada o en juego? */
export const hayPelea = () => avance.hayPelea();

/** «Parar»: con una pelea en juego, al terminarla (se registra); si no, ya. */
export const pararTv = () => avance.parar();

/** Cancela el «Parar al terminar esta pelea» pedido. */
export const seguirTv = () => avance.seguir();

/** Corta la pelea en juego sin registrarla y apaga el avance. */
export const abandonarPelea = () => avance.abandonarPelea();

/** Apaga el avance (el partido en curso sigue y se registra al terminar). */
export const detenerTv = () => avance.detener();

/** ¿El avance está encendido (o mostrando el error que lo paró)? */
export const avanceEncendido = () => tv.e.fase !== 'apagado';

/**
 * Enciende el avance con el torneo `id` (o el abierto). Con una pelea de
 * ese torneo en juego, la toma.
 * @param {string} [id]
 */
export function iniciarTv(id = '') {
  tv.reanudable = '';
  return avance.iniciar({ id, pausa: pausaGuardada() });
}

/**
 * Desde Competir, en el clic: enciende el avance con el torneo `id` y abre
 * Observar para mirarlo.
 * @param {string} id
 */
export function entrarTv(id) {
  void iniciarTv(id);
  window.location.hash = hashDe('observar');
}

/** «Reanudar» de la franja: el torneo cortado por la recarga, sin cambiar de pantalla. */
export function reanudarTv() {
  const id = tv.reanudable;
  if (id) void iniciarTv(id);
}

/** Descarta la oferta de reanudar. */
export function descartarReanudar() {
  tv.reanudable = '';
  sesionKv.borrar();
}

/**
 * Nombre visible, formato, modo de sorteo y progreso de la temporada del
 * torneo del avance (para el rótulo y la franja). `id` para otro torneo
 * (el que se ofrece reanudar).
 * @param {string} [id]
 */
export function contextoTv(id = tv.liga) {
  est.version; // se relee cuando cambia el modelo del motor
  const x = torneos();
  const L = x?.lgFind(id);
  if (!L) return { torneo: '', formato: '', sorteo: '', progreso: '' };
  const S = lgSeason(L);
  return {
    torneo: nombreTorneo(L, tr),
    formato: S.fmt.format,
    sorteo: lgDrawOf(L).mode,
    // los partidos del motor son los del torneo abierto
    progreso:
      x.lg.cur?.id === L.id ? textoProgreso(lgProgress(S, x.lgSeasonMatches(S.no)), tr) : '',
  };
}
