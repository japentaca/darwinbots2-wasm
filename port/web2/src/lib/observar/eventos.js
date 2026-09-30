// @ts-check
// Textos del feed de eventos de Observar (textoEvento). El detector
// (extinciones, picos, generaciones récord, llegadas) está en
// detector-eventos.js; los cambios en caliente (decisión 13), la siembra,
// las órdenes de objetos (barra «Mundo») y guardar/cargar los agrega la
// corrida. El texto sale de t() con la clave `observar.evento.<tipo>`; los
// nombres de bots van como parámetro, sin traducir.

import { parametro } from '../../../engine/opciones.js';
import { textoOrdenObjeto } from '../../../engine/report/corrida.js';
import { traductor } from '../../../engine/report/textos.js';

// El detector vive en detector-eventos.js (lo usa la corrida desde el
// chunk principal); se reexporta para los que ya lo importaban de acá.
export {
  CAIDA_PICO,
  DetectorEventos,
  especiesNuevas,
  hitoGeneracion,
  MEJORA_PICO,
  MIN_PICO,
} from './detector-eventos.js';

/**
 * @typedef {import('./detector-eventos.js').TipoEvento} TipoEvento
 * @typedef {import('./detector-eventos.js').EventoFeed} EventoFeed
 */

/** @type {Map<string, ReturnType<typeof traductor>>} */
const traductores = new Map();
/** @param {string} idioma */
function traductorDe(idioma) {
  const l = idioma === 'en' ? 'en' : 'es';
  let tr = traductores.get(l);
  if (!tr) {
    tr = traductor(l);
    traductores.set(l, tr);
  }
  return tr;
}

/**
 * Texto de un evento.
 * @param {EventoFeed} ev
 * @param {(clave: string, params?: Record<string, string | number>) => string} t
 * @param {string} idioma
 * @param {(n: number) => string} [num]
 */
export function textoEvento(ev, t, idioma, num = String) {
  const p = ev.params ?? {};
  switch (ev.tipo) {
    case 'cambio': {
      const lista = Object.entries(p.cambios ?? {})
        .map(([k, v]) => {
          const par = parametro(k);
          const nombre = par ? (idioma === 'en' ? par.en : par.es) : k;
          return `${nombre} = ${num(Number(v))}`;
        })
        .join(' · ');
      return t('observar.evento.cambio', { lista });
    }
    case 'pico':
      return t('observar.evento.pico', { n: num(p.n) });
    case 'generacion':
      return p.especie
        ? t('observar.evento.generacion', { n: num(p.n), especie: p.especie })
        : t('observar.evento.generacionSin', { n: num(p.n) });
    case 'sembrado':
      return t('observar.evento.sembrado', { n: num(p.n), especie: p.especie });
    case 'inicio':
      return t('observar.evento.inicio', { nombre: p.nombre, semilla: p.semilla });
    case 'objetos': {
      // La orden con el mismo texto que los informes (engine/report).
      const tr = traductorDe(idioma);
      return t('observar.evento.objetos', { orden: textoOrdenObjeto(p.orden, tr.tx, tr.num) });
    }
    default:
      return t(`observar.evento.${ev.tipo}`, { ...p });
  }
}
