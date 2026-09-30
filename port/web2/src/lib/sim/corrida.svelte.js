// @ts-check
// La corrida actual de la página (decisión 12): el núcleo puro de
// corrida-nucleo.js con su estado en runes, sobre la sesión de sim, el
// almacén IndexedDB `darwinbots2` (decisión 17, C14) y el Bestiary (C1).
// Se crea la primera vez que se pide (Observar) y vive lo que vive la página.
// Pide al worker el muestreo de métricas (MUESTREO_CORRIDA): la historia, el
// linaje y las especies del panel salen de ahí con cualquier vista.

import { crearCorridas } from '../../../engine/corridas.js';
import { idioma, t } from '../../i18n/index.svelte.js';
import { adnBestiario } from '../observar/bestiario.js';
import { descargar, miniaturaMundo, nombreArchivo } from '../observar/descargas.js';
import { almacen as almacenPagina } from './almacen.svelte.js';
import { NucleoCorrida } from './corrida-nucleo.js';
import { MUESTREO_CORRIDA } from './metricas.js';
import { sesion } from './sesion.svelte.js';

/** Estado visible de la corrida (campos de EstadoCorrida en runes). */
class EstadoCorrida {
  /** @type {import('./corrida-nucleo.js').Escenario | null} */
  escenario = $state.raw(null);
  /** @type {number | null} */
  semilla = $state(null);
  nombre = $state('');
  /** @type {string | null} */
  id = $state(null);
  /** @type {import('./corrida-nucleo.js').EventoCorrida[]} */
  eventos = $state.raw([]);
  /** @type {import('./corrida-nucleo.js').EventoFeed[]} */
  feed = $state.raw([]);
  /** @type {import('./corrida-nucleo.js').Vivo | null} */
  vivo = $state.raw(null);
  /** @type {import('./corrida-nucleo.js').Muestra[]} */
  muestras = $state.raw([]);
  intervalo = $state(100);
  /** @type {Record<string, string>} */
  colores = $state.raw({});
  /** @type {'' | 'iniciando' | 'guardando' | 'cargando'} */
  ocupado = $state('');
  /** @type {{ clave: string, params?: Record<string, any>, error?: boolean } | null} */
  aviso = $state.raw(null);
}

/** La corrida de la página, si ya se creó (la barra superior la mira sin crearla). */
export const actual = $state(/** @type {{ corrida: NucleoCorrida | null }} */ ({ corrida: null }));

/** @type {ReturnType<typeof crearCorridas> | null} */
let almacenCorridas = null;

/** Corridas guardadas (IndexedDB darwinbots2, la conexión única de almacen.svelte.js). */
export function corridasGuardadas() {
  if (!almacenCorridas) {
    const almacen = almacenPagina();
    almacenCorridas = crearCorridas({ almacen });
    adnPropio = async (hash) => {
      const b = await almacen.get('bots', hash);
      return b ? (b.adn ?? b.dna) : undefined;
    };
  }
  return almacenCorridas;
}

/** @type {(hash: string) => Promise<string | undefined>} */
let adnPropio = async () => undefined;

/**
 * La corrida de la página (se crea la primera vez que se pide).
 * @returns {NucleoCorrida}
 */
export function corrida() {
  if (!actual.corrida) {
    const corridas = corridasGuardadas();
    actual.corrida = new NucleoCorrida({
      sesion: /** @type {any} */ (sesion()),
      corridas,
      estado: new EstadoCorrida(),
      idioma,
      adnDe: (s) => (s.origen === 'propio' && s.hash ? adnPropio(s.hash) : adnBestiario(s.bot)),
      miniatura: () => miniaturaMundo(160),
      nombrePorDefecto: () => t('observar.sinNombre'),
      // N2.1: historia y linaje con las muestras del worker (decisiones 7-9)
      muestreo: MUESTREO_CORRIDA,
      descargar: (bytes, nombre) =>
        descargar(
          new Blob([/** @type {Uint8Array<ArrayBuffer>} */ (bytes)], {
            type: 'application/octet-stream',
          }),
          nombreArchivo(nombre, '.dbsim'),
        ),
    });
  }
  return actual.corrida;
}
