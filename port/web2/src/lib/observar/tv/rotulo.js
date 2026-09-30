// @ts-check
// Modo TV (paso N3.6), lo puro: el rótulo sobre el campo para cada fase de
// la secuencia (maquina.js), con los textos por t(). Es el rótulo de la
// clásica: la cortinilla (quién contra quién, la fase de la pelea y la
// cuenta atrás), la pelea en vivo, el ganador durante el respiro y el
// campeón de la edición con la cuenta de la siguiente. En la copa la fase
// va en grande y en mayúsculas («GRUPO C · JORNADA 2 DE 3», «SEMIFINAL»,
// «FINAL»).

import { LG_HOWS } from '../../../../engine/league.js';
import { nombrePool, textoRotulo, textoTv } from '../../competir/textos.js';
import { cuenta, TV_ERRORES } from './maquina.js';

/**
 * @typedef {import('../../competir/textos.js').Tr} Tr
 * @typedef {{
 *   fase: import('./maquina.js').Fase,
 *   cabecera: string,
 *   linea: string,
 *   vs: {name: string, color: string}[],
 *   etiqueta: string,
 *   grande: boolean,
 *   ganador: string,
 *   campeon: string,
 *   como: string,
 *   pie: string,
 *   error: string,
 *   aviso: string,
 *   vivo: boolean,
 * }} Rotulo
 */

const SIN_COLOR = '#8899bb';

/**
 * Texto del error que detuvo el TV (las claves del motor y las propias).
 * @param {{clave: string, params?: Record<string, any>}} err @param {Tr} tr
 */
export function textoErrorTv(err, tr) {
  const p = err.params ?? {};
  if (TV_ERRORES.includes(err.clave))
    return tr.t(`observar.tv.error.${err.clave}`, { detalle: String(p.detalle ?? '') });
  return textoTv(err, tr, (pool) => nombrePool(pool, tr));
}

/**
 * El rótulo de un estado del TV.
 * @param {import('./maquina.js').EstadoTV} e
 * @param {{torneo: string, formato: string, sorteo?: string}} ctx nombre visible del
 *   torneo, su formato y su modo de sorteo (lgDrawOf: fixed, random, fight)
 * @param {Tr} tr @param {number} ahora (performance.now) para la cuenta atrás
 * @param {string} [idioma] para las mayúsculas de la copa
 * @returns {Rotulo}
 */
export function rotuloTV(e, ctx, tr, ahora, idioma = 'es') {
  const copa = ctx.formato === 'cup';
  const cabecera = tr.t('observar.tv.cabecera', {
    torneo: ctx.torneo,
    no: tr.num(e.temporada || 0),
  });
  const etq = e.fx ? textoRotulo(e.fx.label, tr) : '';
  /** @type {Rotulo} */
  const r = {
    fase: e.fase,
    cabecera,
    linea: '',
    vs: (e.fx?.fighters ?? []).map((f) => ({ name: f.name, color: f.color || SIN_COLOR })),
    etiqueta: copa ? etq.toLocaleUpperCase(idioma) : etq,
    grande: copa,
    ganador: '',
    campeon: '',
    como: '',
    pie: '',
    error: '',
    aviso: e.aviso
      ? tr.t('observar.tv.noArranco', {
          n: tr.num(Number(e.aviso.params.n) || 0),
          detalle: String(e.aviso.params.detalle ?? ''),
        })
      : '',
    vivo: false,
  };
  const s = tr.num(cuenta(e, ahora));
  switch (e.fase) {
    case 'edicion':
    case 'buscando':
      r.linea = tr.t('observar.tv.sorteando');
      r.vs = [];
      r.etiqueta = '';
      break;
    case 'cortinilla':
      r.linea = tr.t('observar.tv.proxima', { n: tr.num(e.pelea), s });
      break;
    case 'lanzando':
      r.linea = tr.t('observar.tv.preparando', { n: tr.num(e.pelea) });
      break;
    case 'partido':
      r.linea = tr.t('observar.tv.enVivo', { n: tr.num(e.pelea) });
      r.vivo = true;
      break;
    case 'resultado':
      r.linea = tr.t('observar.tv.jugada', { n: tr.num(e.pelea) });
      r.ganador = e.ganador
        ? tr.t('observar.tv.gana', { nombre: e.ganador })
        : tr.t('observar.tv.nula');
      break;
    case 'campeon':
      r.linea = tr.t('observar.tv.completa', { no: tr.num(e.temporada || 0) });
      r.vs = [];
      r.etiqueta = '';
      r.campeon = e.campeon?.name ?? '';
      r.como = e.campeon
        ? LG_HOWS.includes(e.campeon.how)
          ? tr.t(`competir.como.${e.campeon.how}`)
          : e.campeon.how
        : tr.t('observar.tv.sinCampeon');
      r.pie = tr.t(
        ctx.sorteo === 'fight'
          ? 'observar.tv.siguienteEdicionPelea'
          : 'observar.tv.siguienteEdicion',
        { s },
      );
      break;
    case 'error':
      r.linea = tr.t('observar.tv.apagado');
      r.error = e.error ? textoErrorTv(e.error, tr) : '';
      break;
    default:
      break;
  }
  return r;
}

/**
 * Lo que anuncia la región viva del TV (lectores de pantalla): solo los
 * cambios de fase (la próxima pelea, en vivo, el ganador, el campeón, el
 * error), sin la cuenta atrás ni el marcador, que cambian a cada rato. ''
 * en las fases de espera (sorteo, preparación).
 * @param {import('./maquina.js').EstadoTV} e @param {Tr} tr @returns {string}
 */
export function anuncioTV(e, tr) {
  const n = tr.num(e.pelea);
  const vs = (e.fx?.fighters ?? []).map((f) => f.name).join(` ${tr.t('observar.tv.contra')} `);
  switch (e.fase) {
    case 'cortinilla': {
      const etq = e.fx ? textoRotulo(e.fx.label, tr) : '';
      const base = tr.t('observar.tv.anuncio.proxima', { n, vs });
      return etq ? `${base} · ${etq}` : base;
    }
    case 'partido':
      return tr.t('observar.tv.anuncio.enVivo', { n, vs });
    case 'resultado':
      return `${tr.t('observar.tv.jugada', { n })}: ${
        e.ganador ? tr.t('observar.tv.gana', { nombre: e.ganador }) : tr.t('observar.tv.nula')
      }`;
    case 'campeon':
      return e.campeon
        ? tr.t('observar.tv.anuncio.campeon', {
            no: tr.num(e.temporada || 0),
            nombre: e.campeon.name,
          })
        : `${tr.t('observar.tv.completa', { no: tr.num(e.temporada || 0) })}: ${tr.t('observar.tv.sinCampeon')}`;
    case 'error':
      return `${tr.t('observar.tv.apagado')}: ${e.error ? textoErrorTv(e.error, tr) : ''}`;
    default:
      return '';
  }
}
