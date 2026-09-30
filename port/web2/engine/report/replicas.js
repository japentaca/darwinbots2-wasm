// @ts-check
// Plantilla «Réplicas» del informe (decisiones 10 y 11 de port/web2/PLAN.md):
// un trabajo de réplicas de la cola (engine/replicas.js) en un .html
// autocontenido.
//
//   - portada: escenario, corrida de origen, N, ciclos y la lista de
//     semillas (la primera es la de la corrida de origen); si al elegirlas se
//     descartaron semillas que repetían un mundo del motor, una nota (C19);
//   - resumen por reglas: el valor final de las métricas principales (media
//     ± desvío, mínimo y máximo), cada frase enlazada a su figura;
//   - media y banda p10–p90 por ciclo de cada métrica clave
//     (agregarReplicas);
//   - tabla de medias y desvíos del valor final (tablaReplicas: la última
//     muestra cruda de cada réplica).
// Con réplicas sin terminar (resultado null) el informe es parcial y lo dice.
//
// Puro: recibe los parámetros del trabajo y sus resultados.

import { nombreEspecie } from '../metricas.js';
import { BASES } from '../opciones.js';
import {
  agregarReplicas,
  estadoSemilla,
  finalDe,
  historiaDe,
  METRICAS_CLAVE,
  MUNDOS_DISTINTOS,
  SEMILLA_MAX,
  tablaReplicas,
} from '../replicas.js';
import {
  fechaInforme,
  figuras,
  formatosEje,
  nombreEscenario,
  nombreMetrica,
  redondo,
  tabla,
} from './comun.js';
import { seccion } from './corrida.js';
import { ANCHO_MEDIO, documento, nombreArchivo } from './plantilla.js';
import { esc, lineas } from './svg.js';
import { idiomaValido, traductor } from './textos.js';

const COLOR = '#0f5c55';
/** Métricas que escribe el resumen (si tienen datos). */
const RESUMEN = Object.freeze(['vivos', 'especiesVivas', 'adnMedia']);

/**
 * Un trabajo de réplicas: los parámetros de la cola (ParamsReplicas de
 * engine/replicas.js; el ADN no hace falta) y lo que devolvió cada réplica
 * (null = sin terminar).
 * @typedef {object} DatosReplicas
 * @property {any} escenario
 * @property {number[]} semillas
 * @property {number} ciclos
 * @property {number} [cada]
 * @property {string} [metrica]      la que se eligió al lanzar (se agrega a las clave)
 * @property {{nombre: string, id?: string | null}} [origen]
 * @property {any[]} [eventos]       cambios en caliente que repite cada réplica
 * @property {any[]} resultados
 * @property {string} [titulo]
 * @property {string | number | Date} [fecha]
 */

/**
 * Semillas que semillasReplicas (engine/replicas.js) descartó al elegir
 * estas por repetir un mundo del motor (C19). Repite su generador: si las
 * semillas no son las que da ese generador (un trabajo armado de otra
 * forma), devuelve 0.
 * @param {number[]} semillas
 * @returns {number}
 */
export function semillasDescartadas(semillas) {
  if (semillas.length < 2) return 0;
  const primera = semillas[0];
  const mundos = new Set([estadoSemilla(primera).mezcla]);
  let x = Math.trunc(primera) >>> 0 || 1;
  let descartadas = 0;
  let k = 1;
  // tope de intentos: nunca más que los mundos distintos por semilla pedida
  for (let intentos = 0; k < semillas.length && intentos < MUNDOS_DISTINTOS * 4; intentos++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const s = 1 + (x % SEMILLA_MAX);
    const m = estadoSemilla(s).mezcla;
    if (mundos.has(m)) {
      descartadas++;
      continue;
    }
    if (s !== semillas[k]) return 0;
    mundos.add(m);
    k++;
  }
  return k === semillas.length ? descartadas : 0;
}

/**
 * Genera el informe de un trabajo de réplicas.
 * @param {DatosReplicas} d @param {{idioma?: 'es' | 'en'}} [op]
 * @returns {{html: string, archivo: string, datos: any}}
 */
export function informeReplicas(d, op = {}) {
  if (!d || !Array.isArray(d.semillas) || !Array.isArray(d.resultados))
    throw new Error('informe «replicas»: faltan las semillas o los resultados');
  const idioma = idiomaValido(op.idioma);
  const tr = traductor(idioma);
  const { tx, num } = tr;
  const f = fechaInforme(d.fecha, idioma);
  const n = d.semillas.length;
  const hechas = d.resultados.filter((r) => r != null).length;
  const nombreEsc =
    nombreEscenario(d.escenario, idioma) || d.origen?.nombre || tx('informe.sinTitulo');
  const titulo = d.titulo || tx('rep.titulo', { nombre: nombreEsc, n });
  const archivo = nombreArchivo(titulo, f.fecha);
  const metricas = [...METRICAS_CLAVE];
  if (d.metrica && !metricas.includes(d.metrica)) metricas.unshift(d.metrica);
  const { numeros, figura } = figuras(tr);
  const { fmtX, fmtY } = formatosEje(tr, Number(d.ciclos) || 0);

  // ---- figuras: media y banda p10–p90 ----
  /** @type {any[]} */
  const embebidas = [];
  const figs = metricas
    .map((m) => {
      const a = agregarReplicas(d.resultados, m);
      if (!a.t.length || !a.media.some(Number.isFinite)) return '';
      embebidas.push({
        metrica: m,
        t: a.t,
        media: a.media.map(redondo),
        p10: a.p10.map(redondo),
        p90: a.p90.map(redondo),
        min: a.min.map(redondo),
        max: a.max.map(redondo),
        n: a.n,
      });
      const cap = tx('fig.rep', { metrica: nombreMetrica(tr, m), n: Math.max(...a.n) });
      const svg = lineas({
        ancho: ANCHO_MEDIO,
        alto: 170,
        etiqueta: cap,
        fmtX,
        fmtY,
        x: a.t,
        yCero: m !== 'adnMedia',
        series: [{ valores: a.media, min: a.p10, max: a.p90, color: COLOR }],
      });
      return figura(`fig-r-${m}`, svg, cap);
    })
    .filter(Boolean);

  // ---- tabla final ----
  const filasTabla = tablaReplicas(d.resultados, metricas);

  // ---- portada ----
  const cab = [];
  const meta = [tx('rep.meta', { n, ciclos: Number(d.ciclos) || 0, cada: Number(d.cada) || 0 })];
  if (f.texto) meta.push(tx('meta.generado', { fecha: f.texto }));
  cab.push(
    `<header class="cab"><span class="kicker">${esc(tx('informe.replicas'))}</span><h1>${esc(titulo)}</h1><div class="meta">${esc(meta.join(' · '))}</div></header>`,
  );
  if (hechas < n)
    cab.push(`<p class="p"><strong>${esc(tx('rep.parcial', { hechas, n }))}</strong></p>`);
  {
    const frases = RESUMEN.map((m) => {
      const fila = filasTabla.find((x) => x.clave === m);
      const fig = `fig-r-${m}`;
      if (!fila || !(fila.n > 0) || !numeros.has(fig)) return '';
      return `<p class="find"><span class="sw" style="background:${COLOR}"></span><span>${esc(
        tx('rep.frase', {
          metrica: nombreMetrica(tr, m),
          media: num(fila.media, 1),
          desvio: num(fila.desvio, 1),
          min: num(fila.min, 1),
          max: num(fila.max, 1),
          n: fila.n,
        }),
      )} <a href="#${fig}">${esc(tx('fig.ref', { n: numeros.get(fig) }))}</a></span></p>`;
    }).filter(Boolean);
    if (frases.length)
      cab.push(
        `<section class="resumen"><span class="kicker">${esc(tx('resumen.titulo'))}</span>${frases.join('')}<p class="cap">${esc(tx('resumen.notaRep'))}</p></section>`,
      );
  }
  cab.push(
    `<section class="kpis">${[
      [num(n, 0), tx('rep.kpiReplicas', { n })],
      [num(hechas, 0), tx('rep.kpiHechas', { n: hechas })],
      [num(Number(d.ciclos) || 0, 0), tx('kpi.ciclos')],
      [num((d.eventos ?? []).length, 0), tx('rep.kpiCaliente', { n: (d.eventos ?? []).length })],
    ]
      .map(([v, l]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`)
      .join('')}</section>`,
  );

  // ---- 1. Escenario y semillas ----
  const secciones = [];
  {
    const e = d.escenario ?? null;
    const partes = [];
    partes.push(`<p class="p">${esc(tx('rep.escenario', { nombre: nombreEsc }))}</p>`);
    if (d.origen?.nombre)
      partes.push(`<p class="p">${esc(tx('rep.origen', { nombre: d.origen.nombre }))}</p>`);
    const baseId = e?.opciones?.base;
    if (baseId) {
      const base = String(/** @type {any} */ (BASES)[baseId]?.[idioma] ?? baseId);
      const nc = Object.keys(e?.opciones?.cambios ?? {}).length;
      partes.push(
        `<p class="p">${esc(`${tx('conf.base', { base })} ${nc ? tx('conf.cambios', { n: nc }) : tx('conf.sinCambios')}`)}</p>`,
      );
    }
    const sembradas = e?.especies ?? [];
    if (sembradas.length)
      partes.push(
        `<h3>${esc(tx('conf.especies'))}</h3>${tabla(
          [tx('col.bot'), tx('col.cantidad'), tx('col.vegetal')],
          sembradas.map((/** @type {any} */ s) => [
            esc(nombreEspecie(s?.bot ?? '')),
            esc(num(Number(s?.cantidad ?? 0), 0)),
            esc(s?.vegetal ? tx('si') : tx('no')),
          ]),
        )}`,
      );
    const obs = e?.objetos?.obstaculos?.length ?? 0;
    const tel = e?.objetos?.teleporters?.length ?? 0;
    if (obs || tel)
      partes.push(
        `<p class="p">${esc(tx('conf.objetos', { obstaculos: obs, teleporters: tel }))}</p>`,
      );
    const nEv = (d.eventos ?? []).length;
    partes.push(
      `<p class="p">${esc(nEv ? tx('rep.caliente', { n: nEv }) : tx('rep.sinCaliente'))}</p>`,
    );
    partes.push(`<h3>${esc(tx('rep.semillas'))}</h3>`);
    const descartadas = semillasDescartadas(d.semillas);
    if (descartadas > 0)
      partes.push(`<p class="cap">${esc(tx('rep.c19', { n: descartadas }))}</p>`);
    partes.push(
      tabla(
        ['#', tx('rep.semilla'), tx('col.estado'), tx('rep.cicloFinal')],
        d.semillas.map((s, i) => {
          const r = d.resultados[i];
          const fin = r != null ? finalDe(r) : null;
          let ciclo = fin?.ciclo;
          if (r != null && ciclo === undefined) {
            try {
              ciclo = historiaDe(r).ultimoCiclo;
            } catch {
              ciclo = undefined;
            }
          }
          return [
            esc(num(i + 1, 0)),
            `<span class="mono">${esc(String(s))}</span>${i === 0 ? ` <span class="cap">${esc(tx('rep.semillaOrigen'))}</span>` : ''}`,
            esc(r != null ? tx('rep.hecha') : tx('rep.pendiente')),
            esc(Number.isFinite(ciclo) ? num(/** @type {number} */ (ciclo), 0) : '—'),
          ];
        }),
        [2],
      ),
    );
    secciones.push(seccion(tx('sec.escenarioRep'), partes.join(''), 1));
  }

  // ---- 2. Bandas ----
  secciones.push(
    seccion(
      tx('sec.bandas'),
      figs.length
        ? `<p class="cap">${esc(tx('rep.bandasNota'))}</p><div class="dos">${figs.join('')}</div>`
        : `<p class="cap">${esc(tx('rep.sinResultados'))}</p>`,
      2,
      true,
    ),
  );

  // ---- 3. Medias y desvíos ----
  {
    const filas = filasTabla
      .filter((x) => x.n > 0)
      .map((x) => [
        esc(nombreMetrica(tr, x.clave)),
        esc(num(x.media, 2)),
        esc(num(x.desvio, 2)),
        esc(num(x.min, 2)),
        esc(num(x.max, 2)),
        esc(num(x.n, 0)),
      ]);
    const ciclo = filasTabla.find((x) => x.n > 0)?.ciclo;
    const cuerpo = filas.length
      ? `<p class="cap">${esc(tx('rep.tablaNota', { ciclo: Number.isFinite(ciclo) ? /** @type {number} */ (ciclo) : 0 }))}</p>${tabla(
          [
            tx('col.metrica'),
            tx('col.media'),
            tx('col.desvio'),
            tx('col.min'),
            tx('col.max'),
            tx('col.n'),
          ],
          filas,
        )}`
      : `<p class="cap">${esc(tx('rep.sinResultados'))}</p>`;
    secciones.push(seccion(tx('sec.tablaRep'), cuerpo, 3));
  }

  const pie = `<footer class="pie"><span>${esc(tx('pie.rep', { series: embebidas.length, n }))}</span><span class="mono">${esc(tx('pie.firma', { fecha: f.texto }))}</span></footer>`;

  const datos = {
    formato: 1,
    tipo: 'replicas',
    idioma,
    titulo,
    fecha: f.iso,
    escenario: d.escenario ?? null,
    origen: d.origen ?? null,
    semillas: [...d.semillas],
    semillasDescartadas: semillasDescartadas(d.semillas),
    ciclos: Number(d.ciclos) || 0,
    cada: Number(d.cada) || 0,
    hechas,
    eventos: d.eventos ?? [],
    series: embebidas,
    tabla: filasTabla.map((x) => ({
      ...x,
      media: redondo(x.media),
      desvio: redondo(x.desvio),
      min: redondo(x.min),
      max: redondo(x.max),
      ciclo: Number.isFinite(x.ciclo) ? x.ciclo : null,
    })),
  };
  const html = documento({
    idioma,
    titulo: `${tx('informe.replicas')} · ${titulo}`,
    archivo,
    cuerpo: [...cab, ...secciones, pie].join('\n'),
    datos,
    barra: { imprimir: tx('barra.imprimir'), json: tx('barra.json'), csv: tx('barra.csv') },
  });
  return { html, archivo, datos };
}
