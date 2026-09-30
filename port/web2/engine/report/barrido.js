// @ts-check
// Plantilla «Barrido» del informe (Nivel 4; decisiones 10 y 11 de
// port/web2/PLAN.md): un trabajo de barrido de parámetros de la cola
// (engine/barrido.js) en un .html autocontenido, con el estilo del de
// Réplicas.
//
//   - portada: parámetro, valores, semillas y ciclos; resumen por reglas
//     (con qué valor la métrica principal termina más alta y más baja);
//   - valor final de cada métrica contra el valor del parámetro: media y
//     banda p10–p90 sobre las semillas (agregarBarrido);
//   - la serie media por ciclo de la métrica principal, una línea por valor
//     (seriesBarrido);
//   - tabla por valor y métrica (media, desvío, p10, p90, n).
// Con unidades sin terminar (resultado null) el informe es parcial y lo dice.
// Las unidades con la ronda reiniciada no entran en curvas, series ni tabla
// (agregarBarrido): se listan en la sección 1 y la tabla las cuenta aparte.
// Con bool y enum, el eje X solo rotula los valores de la grilla, con su
// texto (valorParametro).
//
// Puro: recibe los parámetros del trabajo y sus resultados.

import {
  agregarBarrido,
  colorValor,
  escritasPor,
  reescritosBarrido,
  reiniciosBarrido,
  seriesBarrido,
  unidadDe,
  valoresOrigen,
} from '../barrido.js';
import { nombreEspecie } from '../metricas.js';
import { BASES, parametro } from '../opciones.js';
import {
  fechaInforme,
  figuras,
  formatosEje,
  leyenda,
  nombreEscenario,
  nombreMetrica,
  redondo,
  tabla,
} from './comun.js';
import { seccion, valorParametro } from './corrida.js';
import { ANCHO_HOJA, ANCHO_MEDIO, documento, nombreArchivo } from './plantilla.js';
import { esc, lineas } from './svg.js';
import { ErrorInforme, idiomaValido, traductor } from './textos.js';

const COLOR = '#0f5c55';

/**
 * Un trabajo de barrido: sus parámetros (ParamsBarrido de engine/barrido.js;
 * el ADN no hace falta) y lo que devolvió cada unidad (null = sin terminar).
 * @typedef {object} DatosBarrido
 * @property {any} escenario
 * @property {string} clave
 * @property {number[]} valores
 * @property {number[]} semillas
 * @property {number} ciclos
 * @property {number} [cada]
 * @property {string[]} metricas     la primera es la principal
 * @property {{nombre: string, id?: string | null}} [origen]
 * @property {any[]} [eventos]
 * @property {any[]} resultados      uno por unidad (unidadDe de engine/barrido.js)
 * @property {string} [titulo]
 * @property {string | number | Date} [fecha]
 */

/**
 * Genera el informe de un barrido.
 * @param {DatosBarrido} d @param {{idioma?: 'es' | 'en'}} [op]
 * @returns {{html: string, archivo: string, datos: any}}
 */
export function informeBarrido(d, op = {}) {
  if (
    !d ||
    !Array.isArray(d.valores) ||
    !Array.isArray(d.semillas) ||
    !Array.isArray(d.resultados) ||
    !d.valores.length ||
    !d.semillas.length
  )
    throw new ErrorInforme('falta-barrido');
  const idioma = idiomaValido(op.idioma);
  const tr = traductor(idioma);
  const { tx, num } = tr;
  const f = fechaInforme(d.fecha, idioma);
  const par = parametro(d.clave);
  const nombrePar = par?.[idioma] ?? d.clave;
  const total = d.valores.length * d.semillas.length;
  const hechas = d.resultados.filter((r) => r != null).length;
  const nombreEsc =
    nombreEscenario(d.escenario, idioma) || d.origen?.nombre || tx('informe.sinTitulo');
  const titulo = d.titulo || tx('barrido.titulo', { parametro: nombrePar, nombre: nombreEsc });
  const archivo = nombreArchivo(titulo, f.fecha);
  const metricas = d.metricas?.length ? [...d.metricas] : ['vivos'];
  const principal = metricas[0];
  const p = { valores: d.valores, semillas: d.semillas, metricas };
  const filas = agregarBarrido(p, d.resultados, metricas);
  /** @param {number} v */
  const val = (v) => valorParametro(d.clave, v, idioma, num, tx);
  const { numeros, figura } = figuras(tr);
  /** @param {number} x */
  const fmtNum = (x) => num(x, Math.abs(x) < 10 ? 3 : 1);
  // bool y enum: solo los valores de la grilla, con su texto
  const discreto = par?.valor === 'bool' || par?.valor === 'enum';
  /** @param {number} x */
  const fmtV = discreto ? (x) => (d.valores.includes(x) ? val(x) : '') : fmtNum;
  const reinicios = reiniciosBarrido(p, d.resultados);
  /** @param {number} y */
  const fmtY = (y) => num(y, Math.abs(y) < 10 ? 2 : 0);

  // ---- figuras: valor final vs. valor del parámetro ----
  /** @type {any[]} */
  const embebidas = [];
  const figs = metricas
    .map((m) => {
      const media = filas.map((x) => x.metricas[m].media);
      if (!media.some(Number.isFinite)) return '';
      const p10 = filas.map((x) => x.metricas[m].p10);
      const p90 = filas.map((x) => x.metricas[m].p90);
      embebidas.push({
        metrica: m,
        valores: [...d.valores],
        media: media.map(redondo),
        p10: p10.map(redondo),
        p90: p90.map(redondo),
        n: filas.map((x) => x.metricas[m].n),
      });
      // n real: con resultados parciales o reinicios, no todas las semillas
      const ns = filas.map((x) => x.metricas[m].n).filter((n) => n > 0);
      const nMax = Math.max(...ns);
      const cap = tx(ns.every((n) => n === nMax) ? 'barrido.fig' : 'barrido.figHasta', {
        metrica: nombreMetrica(tr, m),
        parametro: nombrePar,
        n: nMax,
      });
      const svg = lineas({
        ancho: ANCHO_MEDIO,
        alto: 170,
        etiqueta: cap,
        fmtX: fmtV,
        fmtY,
        x: d.valores,
        yCero: m !== 'adnMedia',
        series: [{ valores: media, min: p10, max: p90, color: COLOR }],
      });
      return figura(`fig-b-${m}`, svg, cap);
    })
    .filter(Boolean);

  // ---- serie media por valor (métrica principal) ----
  // Van embebidas como `series` (una por valor, con el valor en `corrida`):
  // así el botón «Datos · CSV» del informe baja ciclo, valor, métrica, media,
  // p10, p90 y n.
  let figSeries = '';
  /** @type {any[]} */
  const seriesEmb = [];
  {
    const ss = seriesBarrido(p, d.resultados, principal).filter((s) => s.agregado.t.length);
    for (const s of ss)
      seriesEmb.push({
        corrida: `${d.clave}=${s.valor}`,
        metrica: principal,
        t: s.agregado.t,
        media: s.agregado.media.map(redondo),
        p10: s.agregado.p10.map(redondo),
        p90: s.agregado.p90.map(redondo),
        n: s.agregado.n,
      });
    if (ss.length) {
      const items = ss.map((s) => ({
        nombre: `${nombrePar} = ${val(s.valor)}`,
        color: colorValor(d.valores.indexOf(s.valor), d.valores.length),
      }));
      const cap = tx('barrido.figSeries', { metrica: nombreMetrica(tr, principal) });
      const { fmtX } = formatosEje(tr, Number(d.ciclos) || 0);
      const svg = lineas({
        ancho: ANCHO_HOJA,
        alto: 220,
        etiqueta: cap,
        fmtX,
        fmtY,
        x: ss[0].agregado.t,
        yCero: principal !== 'adnMedia',
        series: ss.map((s, i) => ({
          valores: s.agregado.media,
          x: s.agregado.t,
          color: items[i].color,
        })),
      });
      figSeries = figura('fig-b-series', svg, cap, leyenda(items));
    }
  }

  // ---- portada ----
  const cab = [];
  const meta = [
    tx('barrido.meta', {
      k: d.valores.length,
      n: d.semillas.length,
      ciclos: Number(d.ciclos) || 0,
    }),
  ];
  if (f.texto) meta.push(tx('meta.generado', { fecha: f.texto }));
  cab.push(
    `<header class="cab"><span class="kicker">${esc(tx('barrido.informe'))}</span><h1>${esc(titulo)}</h1><div class="meta">${esc(meta.join(' · '))}</div></header>`,
  );
  if (hechas < total)
    cab.push(`<p class="p"><strong>${esc(tx('barrido.parcial', { hechas, total }))}</strong></p>`);
  {
    const conDatos = filas.filter((x) => Number.isFinite(x.metricas[principal].media));
    const fig = `fig-b-${principal}`;
    if (conDatos.length >= 2 && numeros.has(fig)) {
      const alto = conDatos.reduce((a, b) =>
        b.metricas[principal].media > a.metricas[principal].media ? b : a,
      );
      const bajo = conDatos.reduce((a, b) =>
        b.metricas[principal].media < a.metricas[principal].media ? b : a,
      );
      cab.push(
        `<section class="resumen"><span class="kicker">${esc(tx('resumen.titulo'))}</span><p class="find"><span class="sw" style="background:${COLOR}"></span><span>${esc(
          tx('barrido.frase', {
            metrica: nombreMetrica(tr, principal),
            parametro: nombrePar,
            alto: val(alto.valor),
            mAlto: num(alto.metricas[principal].media, 1),
            bajo: val(bajo.valor),
            mBajo: num(bajo.metricas[principal].media, 1),
          }),
        )} <a href="#${fig}">${esc(tx('fig.ref', { n: numeros.get(fig) }))}</a></span></p><p class="cap">${esc(tx('barrido.notaResumen'))}</p></section>`,
      );
    }
  }
  cab.push(
    `<section class="kpis">${[
      [num(d.valores.length, 0), tx('barrido.kpiValores', { n: d.valores.length })],
      [num(d.semillas.length, 0), tx('barrido.kpiSemillas', { n: d.semillas.length })],
      [num(hechas, 0), tx('barrido.kpiHechas', { n: hechas, total })],
      [num(Number(d.ciclos) || 0, 0), tx('kpi.ciclos')],
    ]
      .map(([v, l]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`)
      .join('')}</section>`,
  );

  // ---- 1. Parámetro, escenario y semillas ----
  const secciones = [];
  {
    const e = d.escenario ?? null;
    const partes = [];
    partes.push(
      `<p class="p">${esc(tx('barrido.parametro', { parametro: nombrePar, variable: par?.variable ?? '', clave: d.clave }))}</p>`,
    );
    partes.push(
      `<p class="p">${esc(tx('barrido.valores', { lista: d.valores.map(val).join(' · ') }))}</p>`,
    );
    const otras = escritasPor(d.clave).filter((c) => c !== d.clave);
    if (otras.length)
      partes.push(
        `<p class="p">${esc(tx('barrido.arrastra', { parametro: nombrePar, otros: otras.map((c) => parametro(c)?.[idioma] ?? c).join(', ') }))}</p>`,
      );
    {
      const o = valoresOrigen(e, d.eventos ?? [], d.clave);
      if (Number.isFinite(o.inicio))
        partes.push(
          `<p class="p">${esc(
            Number.isFinite(o.fin) && o.fin !== o.inicio
              ? tx('barrido.valorOrigenCambia', { inicio: val(o.inicio), fin: val(o.fin) })
              : tx('barrido.valorOrigen', { valor: val(o.inicio) }),
          )}</p>`,
        );
    }
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
    const nEv = (d.eventos ?? []).length;
    const nRe = reescritosBarrido(d.eventos ?? [], d.clave);
    partes.push(
      `<p class="p">${esc(
        nEv
          ? `${tx('barrido.caliente', { n: nEv })} ${nRe ? tx('barrido.reescritos', { n: nRe, parametro: nombrePar }) : tx('barrido.sinReescritos')}`
          : tx('barrido.sinCaliente'),
      )}</p>`,
    );
    partes.push(`<h3>${esc(tx('barrido.semillas'))}</h3>`);
    partes.push(
      tabla(
        ['#', tx('barrido.semilla'), tx('barrido.colHechas')],
        d.semillas.map((s, i) => {
          const n = d.valores.filter((_, v) => d.resultados[unidadDe(p, v, i)] != null).length;
          return [
            esc(num(i + 1, 0)),
            `<span class="mono">${esc(String(s))}</span>${i === 0 ? ` <span class="cap">${esc(tx('barrido.semillaOrigen'))}</span>` : ''}`,
            esc(tx('kpi.deTotal', { a: n, b: d.valores.length })),
          ];
        }),
        [1],
      ),
    );
    if (reinicios.length)
      partes.push(
        `<h3>${esc(tx('barrido.reinicios'))}</h3><p class="cap">${esc(tx('barrido.reiniciosNota'))}</p>${tabla(
          [nombrePar, tx('barrido.semilla'), tx('barrido.colReinicio')],
          reinicios.map((r) => [
            esc(val(d.valores[r.v])),
            `<span class="mono">${esc(String(d.semillas[r.s]))}</span>`,
            esc(num(r.ciclo, 0)),
          ]),
          [1],
        )}`,
      );
    secciones.push(seccion(tx('barrido.secParametro'), partes.join(''), 1));
  }

  // ---- 2. Valor final vs. parámetro ----
  secciones.push(
    seccion(
      tx('barrido.secCurvas'),
      figs.length
        ? `<p class="cap">${esc(tx('barrido.curvasNota', { parametro: nombrePar }))}</p><div class="dos">${figs.join('')}</div>`
        : `<p class="cap">${esc(tx('barrido.sinResultados'))}</p>`,
      2,
      true,
    ),
  );

  // ---- 3. Series medias por valor ----
  secciones.push(
    seccion(
      tx('barrido.secSeries'),
      figSeries
        ? `<p class="cap">${esc(tx('barrido.seriesNota'))}</p>${figSeries}`
        : `<p class="cap">${esc(tx('barrido.sinResultados'))}</p>`,
      3,
    ),
  );

  // ---- 4. Tabla ----
  {
    const cuerpo = metricas
      .map((m) => {
        const fs = filas.filter((x) => x.metricas[m].n > 0);
        if (!fs.length) return '';
        return `<h3>${esc(nombreMetrica(tr, m))}</h3>${tabla(
          [
            nombrePar,
            tx('col.media'),
            tx('col.desvio'),
            'p10',
            'p90',
            tx('col.min'),
            tx('col.max'),
            tx('barrido.colN'),
            ...(reinicios.length ? [tx('barrido.colReiniciadas')] : []),
          ],
          fs.map((x) => {
            const s = x.metricas[m];
            return [
              esc(val(x.valor)),
              esc(num(s.media, 2)),
              esc(s.n < 2 ? '—' : num(s.desvio, 2)),
              esc(num(s.p10, 2)),
              esc(num(s.p90, 2)),
              esc(num(s.min, 2)),
              esc(num(s.max, 2)),
              esc(num(s.n, 0)),
              ...(reinicios.length ? [esc(num(x.reiniciadas, 0))] : []),
            ];
          }),
        )}`;
      })
      .filter(Boolean);
    secciones.push(
      seccion(
        tx('barrido.secTabla'),
        cuerpo.length
          ? `<p class="cap">${esc(tx('barrido.tablaNota'))}</p>${cuerpo.join('')}`
          : `<p class="cap">${esc(tx('barrido.sinResultados'))}</p>`,
        4,
      ),
    );
  }

  const pie = `<footer class="pie"><span>${esc(tx('barrido.pie', { series: embebidas.length, n: hechas }))}</span><span class="mono">${esc(tx('pie.firma', { fecha: f.texto }))}</span></footer>`;

  const datos = {
    formato: 1,
    tipo: 'barrido',
    idioma,
    titulo,
    fecha: f.iso,
    escenario: d.escenario ?? null,
    origen: d.origen ?? null,
    parametro: d.clave,
    valores: [...d.valores],
    semillas: [...d.semillas],
    ciclos: Number(d.ciclos) || 0,
    cada: Number(d.cada) || 0,
    hechas,
    eventos: d.eventos ?? [],
    reescritos: reescritosBarrido(d.eventos ?? [], d.clave),
    reinicios: reinicios.map((r) => ({
      valor: d.valores[r.v],
      semilla: d.semillas[r.s],
      ciclo: r.ciclo,
    })),
    curvas: embebidas,
    series: seriesEmb,
    tabla: filas.map((x) => ({
      valor: x.valor,
      n: x.n,
      reiniciadas: x.reiniciadas,
      metricas: Object.fromEntries(
        Object.entries(x.metricas).map(([k, s]) => [
          k,
          {
            media: redondo(s.media),
            desvio: redondo(s.desvio),
            p10: redondo(s.p10),
            p90: redondo(s.p90),
            min: redondo(s.min),
            max: redondo(s.max),
            n: s.n,
          },
        ]),
      ),
    })),
  };
  const html = documento({
    idioma,
    titulo: `${tx('barrido.informe')} · ${titulo}`,
    archivo,
    cuerpo: [...cab, ...secciones, pie].join('\n'),
    datos,
    barra: { imprimir: tx('barra.imprimir'), json: tx('barra.json'), csv: tx('barra.csv') },
  });
  return { html, archivo, datos };
}
