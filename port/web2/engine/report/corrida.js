// @ts-check
// Plantilla «Corrida» del informe (decisión 11 de port/web2/PLAN.md): un
// .html autocontenido con portada (escenario, semilla, ciclos), resumen
// escrito por reglas (engine/detectors.js: cada frase enlaza a su figura; si
// un detector no encuentra nada no escribe), población por especie, los seis
// grupos de métricas (decisión 7), especies, eventos y cambios en caliente
// (decisión 13) y la genealogía resumida (decisión 9), con los datos de las
// figuras embebidos en JSON.
//
// Puro: recibe la historia (engine/history.js), el linaje
// (engine/lineage.js) y los metadatos de la corrida, y devuelve el texto
// del .html. Los textos salen de engine/report/textos.<idioma>.json.

import { agruparHallazgos, detectar, esVegetal, FIGURAS } from '../detectors.js';
import { diffGenes } from '../lineage.js';
import { HISTOGRAMAS, nombreEspecie } from '../metricas.js';
import { BASES, parametro } from '../opciones.js';
import { ANCHO_HOJA, ANCHO_MEDIO, documento, nombreArchivo } from './plantilla.js';
import { areasApiladas, carriles, esc, histograma, lineas } from './svg.js';
import { ErrorInforme, idiomaValido, traductor } from './textos.js';

/** Paleta categórica (boceto del informe; validada para daltonismo en fondo claro). */
export const PALETA = Object.freeze([
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
]);
/** Colores de reserva cuando el escenario ya usa los de la paleta. */
const PALETA_EXTRA = Object.freeze([
  '#7b5cc4',
  '#c23b3b',
  '#3a9fbf',
  '#8a6a2e',
  '#5b6f7a',
  '#a3a300',
]);
const GRIS = '#9a988f';
const GRIS_OTRAS = '#c3c2b7';
const TINTA = '#151513';
const TINTA_2 = '#898781';
const ACENTO = '#0f5c55';
/** Especies con capa propia en el gráfico apilado (el resto va en «otras»). */
const MAX_CAPAS = 6;
/** Filas del árbol de especies. */
const MAX_CARRILES = 24;

/**
 * Lo que la plantilla usa de la historia (engine/history.js).
 * @typedef {import('../detectors.js').HistoriaLeible & {
 *   intervalo: number,
 *   histogramas: {ciclo: number, bins: number, n: ArrayLike<number>, datos: ArrayLike<number>}[],
 *   eventos: any[],
 * }} HistoriaInforme
 */

/**
 * @typedef {object} DatosCorrida
 * @property {HistoriaInforme} historia
 * @property {import('../lineage.js').Linaje | null} [linaje]
 * @property {any} [escenario]        engine/escenarios (nombre, opciones, especies, objetos)
 * @property {number} [semilla]
 * @property {string} [titulo]        por defecto, el nombre del escenario
 * @property {any[]} [cambios]        eventos de la corrida (engine/corridas.js: opciones, siembra)
 * @property {any[]} [eventos]        feed de eventos ({ciclo, tipo, params}); por defecto historia.eventos
 * @property {import('../detectors.js').Hallazgo[]} [hallazgos]  por defecto, detectar(historia)
 * @property {import('../detectors.js').OpcionesDetectores} [umbrales]
 * @property {string | number | Date} [fecha]  fecha del informe (por defecto, ahora)
 */

/**
 * @typedef {{
 *   formato: 1, tipo: 'corrida', idioma: string, titulo: string, semilla: number | null,
 *   fecha: string, ciclos: {desde: number, hasta: number}, intervalo: number, t: number[],
 *   series: {metrica: string, especie?: string, t?: number[], media: (number | null)[],
 *     min?: (number | null)[], max?: (number | null)[]}[],
 *   hallazgos: import('../detectors.js').Hallazgo[], eventos: any[], cambios: any[],
 *   especies: {nombre: string, madre: string | null, desde: number, hasta: number,
 *     extinta: boolean, vegetal: boolean}[],
 *   escenario: any,
 * }} DatosEmbebidos
 */

/** @param {number} v */
const redondo = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
/** @param {number[]} a */
const ultimoFinito = (a) => {
  for (let i = a.length - 1; i >= 0; i--) if (Number.isFinite(a[i])) return a[i];
  return Number.NaN;
};
/** @param {number[]} a */
const maxFinito = (a) => {
  const m = a.reduce((x, v) => (Number.isFinite(v) && v > x ? v : x), Number.NEGATIVE_INFINITY);
  return m === Number.NEGATIVE_INFINITY ? Number.NaN : m;
};
/**
 * Genera el informe de una corrida. Devuelve el html y el nombre sugerido.
 * @param {DatosCorrida} d @param {{idioma?: 'es' | 'en'}} [op]
 * @returns {{html: string, archivo: string, datos: DatosEmbebidos}}
 */
export function informeCorrida(d, op = {}) {
  if (!d?.historia?.t) throw new ErrorInforme('falta-historia');
  const idioma = idiomaValido(op.idioma);
  const { tx, num } = traductor(idioma);
  const h = d.historia;
  const t = [...h.t];
  const fecha = new Date(d.fecha ?? Date.now());
  const fechaTexto = Number.isNaN(fecha.getTime())
    ? ''
    : new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(fecha);
  const esc0 = d.escenario ?? null;
  const nombreEsc = esc0?.nombre;
  const titulo =
    d.titulo ||
    (typeof nombreEsc === 'string' ? nombreEsc : nombreEsc?.[idioma] || nombreEsc?.es) ||
    tx('informe.sinTitulo');
  const archivo = nombreArchivo(titulo, fecha);
  const hallazgos = d.hallazgos ?? detectar(h, d.umbrales);
  // lo que escribe el resumen: los hallazgos con lo repetitivo agrupado
  const resumen = agruparHallazgos(hallazgos);
  const feed = d.eventos ?? h.eventos ?? [];
  const cambios = d.cambios ?? [];
  const cicloFin = t.length ? t[t.length - 1] : 0;
  const cicloIni = t.length ? t[0] : 0;
  /** @param {number} x */
  const fmtX = (x) => (cicloFin >= 10000 ? `${num(x / 1000, 1)}k` : num(x, 0));
  /** @param {number} y */
  const fmtY = (y) => num(y, Math.abs(y) < 10 ? 2 : 0);

  // ---- especies y colores (el color sigue a la especie en todas las figuras) ----
  const nombres = h.nombresEspecies();
  const vivosDe = new Map(nombres.map((n) => [n, h.alineada('vivos', n)]));
  /** @param {string} n suma de sus bots en todos los puntos */
  const sumaVivos = (n) =>
    /** @type {number[]} */ (vivosDe.get(n) ?? []).reduce(
      (s, v) => s + (Number.isFinite(v) ? v : 0),
      0,
    );
  /** Especies por peso (suma de bots), de mayor a menor; las MAX_CAPAS primeras tienen capa propia. */
  const porPeso = [...nombres].sort((a, b) => sumaVivos(b) - sumaVivos(a));
  const colores = asignarColores(porPeso, esc0?.especies ?? []);
  /** @param {string} n */
  const colorDe = (n) => colores.get(n) ?? GRIS;
  /** @param {string} n */
  const vegetal = (n) => esVegetal(h, n);
  const ultimo = t.length - 1;
  /** @param {string} n */
  const vivaAlFinal = (n) => {
    const v = /** @type {number[]} */ (vivosDe.get(n) ?? []);
    return ultimo >= 0 && Number.isFinite(v[ultimo]) && v[ultimo] > 0;
  };
  /** @param {string} n */
  const rango = (n) => {
    const v = /** @type {number[]} */ (vivosDe.get(n) ?? []);
    let a = -1;
    let b = -1;
    v.forEach((x, i) => {
      if (Number.isFinite(x) && x > 0) {
        if (a < 0) a = i;
        b = i;
      }
    });
    return a < 0 ? null : { desde: t[a], hasta: t[b] };
  };

  // ---- figuras (numeradas en orden de aparición) ----
  /** @type {Map<string, number>} */
  const numeros = new Map();
  /** @param {string} id @param {string} contenido @param {string} texto @param {string} [extra] */
  const figura = (id, contenido, texto, extra = '') => {
    const n = numeros.size + 1;
    numeros.set(id, n);
    return `<figure id="${esc(id)}">${contenido}${extra}<figcaption class="cap"><strong>${esc(tx('fig.titulo', { n }))}</strong> ${esc(texto)}</figcaption></figure>`;
  };
  /** @param {{nombre: string, color: string, discontinua?: boolean}[]} items */
  const leyenda = (items) =>
    items.length < 2
      ? ''
      : `<div class="leyenda">${items
          .map(
            (s) =>
              `<span><span class="sw" style="background:${s.color}${s.discontinua ? ';opacity:.6' : ''}"></span>${esc(s.nombre)}</span>`,
          )
          .join('')}</div>`;

  /** @type {DatosEmbebidos['series']} */
  const embebidas = [];
  /** @type {Set<string>} */
  const yaEmbebidas = new Set();
  /** @param {string} metrica @param {string} [especie] */
  const embeber = (metrica, especie) => {
    const k = `${metrica}\n${especie ?? ''}`;
    if (yaEmbebidas.has(k)) return;
    const s = h.serie(metrica, especie);
    if (!s?.t.length) return;
    yaEmbebidas.add(k);
    const fundida =
      s.min.some((v, i) => v !== s.media[i]) || s.max.some((v, i) => v !== s.media[i]);
    embebidas.push({
      metrica,
      ...(especie !== undefined ? { especie, t: s.t } : {}),
      media: s.media.map(redondo),
      ...(fundida ? { min: s.min.map(redondo), max: s.max.map(redondo) } : {}),
    });
  };

  /**
   * Serie global alineada con t (media, mín, máx; NaN donde falta).
   * @param {string} nombre
   */
  const global = (nombre) => {
    const s = h.serie(nombre);
    const idx = new Map(t.map((c, i) => [c, i]));
    const media = new Array(t.length).fill(Number.NaN);
    const min = new Array(t.length).fill(Number.NaN);
    const max = new Array(t.length).fill(Number.NaN);
    if (s)
      s.t.forEach((c, j) => {
        const i = idx.get(c);
        if (i === undefined) return;
        media[i] = s.media[j];
        min[i] = s.min[j];
        max[i] = s.max[j];
      });
    if (s) embeber(nombre);
    return { media, min, max, hay: media.some(Number.isFinite) };
  };

  /**
   * Figura de líneas de series globales (un solo eje).
   * @param {string} id @param {string} caption
   * @param {{clave: string, color: string, discontinua?: boolean, banda?: boolean}[]} defs
   * @param {{ancho?: number, alto?: number, marcas?: import('./svg.js').Marca[], yCero?: boolean}} [o]
   */
  const figLineas = (id, caption, defs, o = {}) => {
    const series = defs
      .map((x) => ({ x, s: global(x.clave) }))
      .filter((p) => p.s.hay || id === FIGURAS.total || id === FIGURAS.adn);
    if (!series.length) return '';
    const banda = series.some((p) => p.x.banda && p.s.min.some((v, i) => v !== p.s.media[i]));
    const svg = lineas({
      ancho: o.ancho ?? ANCHO_MEDIO,
      alto: o.alto ?? 170,
      etiqueta: caption,
      fmtX,
      fmtY,
      x: t,
      yCero: o.yCero,
      marcas: o.marcas,
      series: series.map((p) => ({
        valores: p.s.media,
        ...(p.x.banda ? { min: p.s.min, max: p.s.max } : {}),
        color: p.x.color,
        discontinua: p.x.discontinua,
      })),
    });
    return figura(
      id,
      svg,
      caption + (banda ? ` ${tx('banda')}` : ''),
      leyenda(
        series.map((p) => ({
          nombre: tx(`serie.${p.x.clave}`),
          color: p.x.color,
          discontinua: p.x.discontinua,
        })),
      ),
    );
  };

  // ---- marcas de los hallazgos sobre sus figuras ----
  /** @param {string} fig */
  const marcasDe = (fig) =>
    resumen
      .filter((x) => x.figura === fig && !x.clave.startsWith('resto.'))
      .slice(0, 6)
      .map((x) => ({
        // la sustitución se marca en el cruce de las dos especies
        x:
          x.tipo === 'sustitucion' && Number.isFinite(x.params.ciclo)
            ? Number(x.params.ciclo)
            : x.desde,
        ...(x.tipo === 'sustitucion' ? { detalle: tx('marca.sustitucion.detalle', x.params) } : {}),
        etiqueta:
          x.tipo === 'dominio'
            ? tx('marca.dominio', { especie: x.params.especie })
            : x.clave === 'extincion.grupo' || x.clave === 'extincion.grupoCiclo'
              ? tx('marca.extinciones', { n: x.params.n })
              : x.tipo === 'extincion'
                ? tx('marca.extincion', { especie: x.params.especie })
                : x.tipo === 'colapso'
                  ? tx('marca.colapso')
                  : x.tipo === 'sustitucion'
                    ? tx('marca.sustitucion', x.params)
                    : x.tipo === 'oscilacion'
                      ? tx('marca.oscilacion')
                      : '',
      }));

  // ================= secciones =================
  const secciones = [];

  // 1. Configuración
  {
    const partes = [];
    const baseId = esc0?.opciones?.base;
    const base = baseId ? /** @type {any} */ (BASES[baseId]?.[idioma] ?? String(baseId)) : '';
    const cambiosConf = Object.entries(esc0?.opciones?.cambios ?? {});
    if (base) partes.push(`<p class="p">${esc(tx('conf.base', { base }))}</p>`);
    partes.push(
      `<p class="p">${esc(
        cambiosConf.length === 0
          ? tx('conf.sinCambios')
          : tx('conf.cambios', { n: cambiosConf.length }),
      )}</p>`,
    );
    if (cambiosConf.length)
      partes.push(
        `<table class="tbl"><thead><tr><th scope="col">${esc(tx('conf.parametro'))}</th><th scope="col" class="izq">${esc(tx('conf.variable'))}</th><th scope="col">${esc(tx('conf.valor'))}</th></tr></thead><tbody>${cambiosConf
          .map(([clave, v]) => {
            const p = parametro(clave);
            return `<tr><td>${esc(p?.[idioma] ?? clave)}</td><td class="izq mono">${esc(p?.variable ?? '')}</td><td>${esc(valorParametro(clave, v, idioma, num, tx))}</td></tr>`;
          })
          .join('')}</tbody></table>`,
      );
    const sembradas = esc0?.especies ?? [];
    if (sembradas.length)
      partes.push(
        `<h3>${esc(tx('conf.especies'))}</h3><table class="tbl"><thead><tr><th scope="col">${esc(tx('col.bot'))}</th><th scope="col">${esc(tx('col.cantidad'))}</th><th scope="col">${esc(tx('col.vegetal'))}</th></tr></thead><tbody>${sembradas
          .map(
            (/** @type {any} */ e) =>
              `<tr><td><span class="nombre"><span class="sw" style="background:${colorDe(nombreEspecie(e.bot))}"></span>${esc(nombreEspecie(e.bot))}</span></td><td>${esc(num(Number(e.cantidad), 0))}</td><td>${esc(e.vegetal ? tx('si') : tx('no'))}</td></tr>`,
          )
          .join('')}</tbody></table>`,
      );
    const obs = esc0?.objetos?.obstaculos?.length ?? 0;
    const tel = esc0?.objetos?.teleporters?.length ?? 0;
    if (obs || tel)
      partes.push(
        `<p class="p">${esc(tx('conf.objetos', { obstaculos: obs, teleporters: tel }))}</p>`,
      );
    secciones.push(seccion(tx('sec.configuracion'), partes.join(''), 1));
  }

  // 2. Población por especie (figura de los hallazgos de especies)
  {
    const propias = porPeso.slice(0, MAX_CAPAS);
    const resto = porPeso.slice(MAX_CAPAS);
    const capas = propias.map((n) => ({
      valores: /** @type {number[]} */ (vivosDe.get(n)),
      color: colorDe(n),
      nombre: n,
    }));
    if (resto.length)
      capas.push({
        valores: t.map((_, i) =>
          resto.reduce((s, n) => {
            const v = /** @type {number[]} */ (vivosDe.get(n))[i];
            return s + (Number.isFinite(v) ? v : 0);
          }, 0),
        ),
        color: GRIS_OTRAS,
        nombre: tx('otras'),
      });
    for (const n of nombres) embeber('vivos', n);
    const caption = resto.length
      ? tx('fig.especiesOtras', { n: propias.length })
      : tx('fig.especies', { n: propias.length });
    const svg = areasApiladas({
      ancho: ANCHO_HOJA,
      alto: 230,
      etiqueta: caption,
      fmtX,
      fmtY,
      x: t,
      capas,
      marcas: marcasDe(FIGURAS.especies),
    });
    secciones.push(
      seccion(tx('sec.poblacion'), figura(FIGURAS.especies, svg, caption, leyenda(capas)), 2),
    );
  }

  // 3. Los seis grupos de métricas
  {
    const g = [];
    const intervalo = h.intervalo;
    // Población
    g.push(
      grupo(
        tx('grupo.poblacion'),
        `<div class="dos">${figLineas(
          FIGURAS.total,
          tx('fig.total'),
          [
            { clave: 'vivos', color: TINTA, banda: true },
            { clave: 'vegetales', color: PALETA[2] },
            { clave: 'noVegetales', color: PALETA[0], discontinua: true },
          ],
          { marcas: marcasDe(FIGURAS.total) },
        )}${figLineas('fig-nespecies', tx('fig.nespecies'), [{ clave: 'especiesVivas', color: ACENTO }])}</div>`,
      ),
    );
    // Evolución
    g.push(
      grupo(
        tx('grupo.evolucion'),
        `<div class="dos">${figLineas('fig-gen', tx('fig.gen'), [
          { clave: 'genMedia', color: TINTA },
          { clave: 'genMax', color: TINTA_2, discontinua: true },
        ])}${figLineas(
          FIGURAS.adn,
          tx('fig.adn'),
          [{ clave: 'adnMedia', color: ACENTO, banda: true }],
          { yCero: false, marcas: marcasDe(FIGURAS.adn) },
        )}${figLineas('fig-mut', tx('fig.mut'), [{ clave: 'mutMedia', color: PALETA[1] }])}</div>`,
      ),
    );
    // Genética: la última foto de los histogramas
    {
      const hs = h.histogramas ?? [];
      const ult = hs[hs.length - 1];
      let cont = '';
      if (ult) {
        const b = ult.bins;
        const paneles = ['adn', 'gen', 'mut', 'edad']
          .map((clave) => {
            const k = HISTOGRAMAS.indexOf(clave);
            const o = k * (b + 2);
            const n = Number(ult.n[k] ?? 0);
            if (!(n > 0)) return '';
            const cuentas = Array.from({ length: b }, (_, i) => Number(ult.datos[o + 2 + i]));
            const etiqueta = tx(`hist.${clave}`, { n });
            return `<div><div class="cap">${esc(etiqueta)}</div>${histograma({
              ancho: ANCHO_MEDIO,
              alto: 140,
              etiqueta,
              fmtX: (x) => num(x, 0),
              fmtY,
              min: Number(ult.datos[o]),
              max: Number(ult.datos[o + 1]),
              cuentas,
              color: ACENTO,
            })}</div>`;
          })
          .filter(Boolean);
        if (paneles.length)
          cont = figura(
            'fig-histogramas',
            `<div class="dos">${paneles.join('')}</div>`,
            tx('fig.histogramas', { ciclo: ult.ciclo }),
          );
      }
      g.push(grupo(tx('grupo.genetica'), cont));
    }
    // Comportamiento: suma de las especies (o la serie global)
    {
      const sumar = (/** @type {string} */ campo) => {
        const out = new Array(t.length).fill(Number.NaN);
        for (const n of nombres) {
          const a = h.alineada(campo, n);
          a.forEach((v, i) => {
            if (Number.isFinite(v)) out[i] = (Number.isFinite(out[i]) ? out[i] : 0) + v;
          });
        }
        return out;
      };
      const nac = sumar('nacimientos');
      const hayComp = nac.some(Number.isFinite);
      let cont = '';
      if (hayComp) {
        const mue = sumar('muertes');
        const cap1 = tx('fig.nacimientos', { intervalo });
        const f1 = figura(
          'fig-nacimientos',
          lineas({
            ancho: ANCHO_MEDIO,
            alto: 170,
            etiqueta: cap1,
            fmtX,
            fmtY,
            x: t,
            series: [
              { valores: nac, color: TINTA },
              { valores: mue, color: TINTA_2, discontinua: true },
            ],
          }),
          cap1,
          leyenda([
            { nombre: tx('serie.nacimientos'), color: TINTA },
            { nombre: tx('serie.muertes'), color: TINTA_2, discontinua: true },
          ]),
        );
        const tipos = [
          'disparosNrg',
          'disparosVenom',
          'disparosWaste',
          'disparosPoison',
          'disparosBody',
          'disparosVirus',
          'disparosEsperma',
          'disparosInfo',
          'disparosCedida',
          'disparosOtros',
        ].map((c) => ({ c, v: sumar(c) }));
        const tot = (/** @type {number[]} */ a) =>
          a.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
        const usados = tipos.filter((x) => tot(x.v) > 0).sort((a, b) => tot(b.v) - tot(a.v));
        const propios = usados.slice(0, PALETA.length - 1);
        const resto = usados.slice(PALETA.length - 1);
        const capas = propios.map((x, i) => ({
          valores: x.v,
          color: PALETA[i],
          nombre: tx(`disparo.${x.c}`),
        }));
        if (resto.length)
          capas.push({
            valores: t.map((_, i) =>
              resto.reduce((s, x) => s + (Number.isFinite(x.v[i]) ? x.v[i] : 0), 0),
            ),
            color: GRIS_OTRAS,
            nombre: tx('otras'),
          });
        const cap2 = tx('fig.disparos', { intervalo });
        const f2 = capas.length
          ? figura(
              'fig-disparos',
              areasApiladas({
                ancho: ANCHO_MEDIO,
                alto: 170,
                etiqueta: cap2,
                fmtX,
                fmtY,
                x: t,
                capas,
              }),
              cap2,
              leyenda(capas),
            )
          : '';
        cont = `<div class="dos">${f1}${f2}</div>`;
      } else {
        cont = figLineas('fig-disparos', tx('fig.disparosGlobal'), [
          { clave: 'disparosCiclo', color: TINTA },
        ]);
      }
      g.push(grupo(tx('grupo.comportamiento'), cont));
    }
    // Energía
    g.push(
      grupo(
        tx('grupo.energia'),
        `<div class="dos">${figLineas('fig-energia', tx('fig.energia'), [
          { clave: 'nrgTotal', color: TINTA, banda: true },
          { clave: 'nrgVegetales', color: PALETA[2] },
          { clave: 'nrgNoVegetales', color: PALETA[0], discontinua: true },
        ])}${figLineas('fig-materia', tx('fig.materia'), [
          { clave: 'bodyTotal', color: PALETA[1] },
          { clave: 'wasteTotal', color: TINTA_2, discontinua: true },
        ])}</div>`,
      ),
    );
    // Entorno
    g.push(
      grupo(
        tx('grupo.entorno'),
        `<div class="dos">${figLineas('fig-luz', tx('fig.luz'), [
          { clave: 'luz', color: PALETA[3] },
        ])}${figLineas('fig-cloro', tx('fig.cloro'), [{ clave: 'cloroTotal', color: PALETA[2] }])}</div>`,
      ),
    );
    secciones.push(seccion(tx('sec.metricas'), g.join(''), 3, true));

    /** @param {string} titulo @param {string} cuerpo */
    function grupo(titulo, cuerpo) {
      const vacio = !cuerpo.replace(/<div class="dos"><\/div>/g, '').trim();
      return `<h3>${esc(titulo)}</h3>${vacio ? `<p class="cap">${esc(tx('grupo.sinDatos'))}</p>` : cuerpo}`;
    }
  }

  // 4. Especies
  const extinciones = hallazgos.filter((x) => x.tipo === 'extincion');
  /** @param {string} n */
  const estadoDe = (n) => {
    if (vivaAlFinal(n)) return tx('estado.viva');
    const ex = extinciones.filter((x) => x.params.especie === n && x.clave === 'extincion');
    if (ex.length) return tx('estado.extinta', { ciclo: Number(ex[ex.length - 1].params.ciclo) });
    return tx('estado.sinBots');
  };
  {
    const filas = nombres.map((n) => {
      const v = /** @type {number[]} */ (vivosDe.get(n));
      const s = h.serie('vivos', n);
      const pico = s ? maxFinito(s.max) : Number.NaN;
      const gm = h.serie('genMax', n);
      const adn = h.alineada('adnMedia', n);
      embeber('adnMedia', n);
      embeber('genMax', n);
      const fin = ultimo >= 0 && Number.isFinite(v[ultimo]) ? v[ultimo] : 0;
      return `<tr><td><span class="nombre"><span class="sw" style="background:${colorDe(n)}"></span>${esc(n)}${vegetal(n) ? ` <span class="cap">· ${esc(tx('vegetalMarca'))}</span>` : ''}</span></td><td>${esc(num(fin, 0))}</td><td>${esc(num(pico, 0))}</td><td>${esc(num(gm ? maxFinito(gm.max) : Number.NaN, 0))}</td><td>${esc(num(ultimoFinito(adn), 0))}</td><td>${esc(estadoDe(n))}</td></tr>`;
    });
    const tabla = filas.length
      ? `<table class="tbl"><thead><tr><th scope="col">${esc(tx('col.especie'))}</th><th scope="col">${esc(tx('col.final'))}</th><th scope="col">${esc(tx('col.pico'))}</th><th scope="col">${esc(tx('col.genMax'))}</th><th scope="col">${esc(tx('col.adn'))}</th><th scope="col">${esc(tx('col.estado'))}</th></tr></thead><tbody>${filas.join('')}</tbody></table>`
      : `<p class="cap">${esc(tx('grupo.sinDatos'))}</p>`;
    secciones.push(seccion(tx('sec.especies'), tabla, 4, true));
  }

  // 5. Eventos y cambios en caliente
  {
    /**
     * ¿La especie tiene bots en algún punto posterior al ciclo c?
     * @param {unknown} especie @param {number} c
     */
    const vuelveDespues = (especie, c) => {
      if (typeof especie !== 'string') return false;
      const v = vivosDe.get(nombreEspecie(especie));
      if (!v) return false;
      for (let i = 0; i < t.length; i++)
        if (t[i] > c && Number.isFinite(v[i]) && v[i] > 0) return true;
      return false;
    };
    const sinDuplicar = cambios.length
      ? feed.filter((e) => e?.tipo !== 'cambio' && e?.tipo !== 'sembrado')
      : feed;
    const filas = sinDuplicar
      .filter((e) => e && Number.isFinite(e.ciclo))
      .map((e) => {
        const tipo = String(e.tipo ?? '');
        // sin bots pero vuelve después (un vegetal que se repone, una
        // llegada): no se extinguió, igual que en la tabla de Especies
        const sinBots = tipo === 'extincion' && vuelveDespues(e.params?.especie, e.ciclo);
        const conocido = [
          'inicio',
          'extincion',
          'pico',
          'generacion',
          'llegada',
          'especieNueva',
          'cambio',
          'sembrado',
          'guardada',
          'cargada',
          'importada',
        ].includes(tipo);
        const chip = sinBots
          ? `<span class="chip">${esc(tx('chip.sinBots'))}</span>`
          : `<span class="chip ${conocido ? tipo : ''}">${esc(tx(conocido ? `chip.${tipo}` : 'chip.otro'))}</span>`;
        const detalle = sinBots
          ? tx(
              vegetal(String(e.params.especie))
                ? 'evento.extincionVegetal'
                : 'evento.extincionVuelve',
              {
                especie: e.params.especie,
              },
            )
          : textoEvento(e, tx, idioma, num);
        return `<tr><td class="mono">${esc(num(e.ciclo, 0))}</td><td class="izq">${chip}</td><td class="izq">${esc(detalle)}</td></tr>`;
      });
    const partes = [
      filas.length
        ? `<table class="tbl"><thead><tr><th scope="col">${esc(tx('col.ciclo'))}</th><th scope="col" class="izq">${esc(tx('col.tipo'))}</th><th scope="col" class="izq">${esc(tx('col.detalle'))}</th></tr></thead><tbody>${filas.join('')}</tbody></table>`
        : `<p class="cap">${esc(tx('eventos.sin'))}</p>`,
    ];
    partes.push(`<h3>${esc(tx('eventos.cambios'))}</h3>`);
    const filasC = cambios
      .filter((e) => e && Number.isFinite(e.ciclo))
      .map(
        (e) =>
          `<tr><td class="mono">${esc(num(e.ciclo, 0))}</td><td class="izq">${esc(textoCambio(e, tx, idioma, num))}</td></tr>`,
      );
    partes.push(
      filasC.length
        ? `<table class="tbl"><thead><tr><th scope="col">${esc(tx('col.ciclo'))}</th><th scope="col" class="izq">${esc(tx('col.detalle'))}</th></tr></thead><tbody>${filasC.join('')}</tbody></table>`
        : `<p class="cap">${esc(tx('eventos.sinCambios'))}</p>`,
    );
    secciones.push(seccion(tx('sec.eventos'), partes.join(''), 5, true));
  }

  // 6. Genealogía resumida
  /** @type {DatosEmbebidos['especies']} */
  const arbol = [];
  {
    const lin = d.linaje ?? null;
    /** @type {{nombre: string, madre: string | null, ciclo: number | null}[]} */
    const orden = [];
    const vistos = new Set();
    /** @param {any} nodo */
    const recorrer = (nodo) => {
      if (vistos.has(nodo.nombre)) return;
      vistos.add(nodo.nombre);
      orden.push({
        nombre: nodo.nombre,
        madre: nodo.madre ?? null,
        ciclo: Number.isFinite(nodo.ciclo) ? nodo.ciclo : null,
      });
      for (const x of nodo.hijas ?? []) recorrer(x);
    };
    for (const r of lin ? lin.arbolEspecies() : []) recorrer(r);
    for (const n of nombres)
      if (!vistos.has(n)) {
        vistos.add(n);
        orden.push({ nombre: n, madre: null, ciclo: rango(n)?.desde ?? cicloIni });
      }
    for (const e of orden) {
      const r = rango(e.nombre);
      // sin ciclo de aparición (linaje incompleto): el primero con bots
      const desde =
        e.ciclo === null ? (r?.desde ?? cicloIni) : Math.min(e.ciclo, r?.desde ?? e.ciclo);
      arbol.push({
        nombre: e.nombre,
        madre: e.madre,
        desde,
        hasta: r ? r.hasta : desde,
        extinta: !vivaAlFinal(e.nombre),
        vegetal: vivosDe.has(e.nombre) ? vegetal(e.nombre) : false,
      });
    }
    const partes = [];
    if (arbol.length) {
      const raices = arbol.filter((e) => !e.madre).length;
      partes.push(
        `<p class="p">${esc(tx('gen.resumen', { n: arbol.length, raices, hijas: arbol.length - raices }))}</p>`,
      );
      const filas = arbol.slice(0, MAX_CARRILES);
      const pos = new Map(filas.map((e, i) => [e.nombre, i]));
      const cap = tx('fig.genealogia');
      const svg = carriles({
        ancho: ANCHO_HOJA,
        alto: filas.length * 20 + 28,
        etiqueta: cap,
        fmtX,
        x0: cicloIni,
        x1: Math.max(cicloFin, cicloIni + 1),
        filas: filas.map((e) => ({
          nombre: e.nombre,
          color: colorDe(e.nombre),
          desde: e.desde,
          hasta: e.extinta ? e.hasta : cicloFin,
          madre: e.madre !== null ? (pos.get(e.madre) ?? null) : null,
          extinta: e.extinta,
        })),
      });
      partes.push(figura('fig-genealogia', svg, cap));
    }
    // ADN dominante frente al fundador
    const fotos = [];
    if (lin)
      for (const [nombre, fs] of lin.fotos) {
        if (fs.length < 2) continue;
        const a = fs[0];
        const b = fs[fs.length - 1];
        const df = diffGenes(a.adn, b.adn);
        fotos.push(
          `<tr><td><span class="nombre"><span class="sw" style="background:${colorDe(nombre)}"></span>${esc(nombre)}</span></td><td>${esc(num(df.iguales, 0))}</td><td>${esc(num(df.cambiados, 0))}</td><td>${esc(num(df.agregados, 0))}</td><td>${esc(num(df.quitados, 0))}</td><td>${esc(`${num(a.adnLen, 0)} → ${num(b.adnLen, 0)}`)}</td></tr>`,
        );
      }
    if (fotos.length)
      partes.push(
        `<h3>${esc(tx('gen.fotos'))}</h3><p class="cap">${esc(tx('gen.fotosNota'))}</p><table class="tbl"><thead><tr><th scope="col">${esc(tx('col.especie'))}</th><th scope="col">${esc(tx('col.iguales'))}</th><th scope="col">${esc(tx('col.cambiados'))}</th><th scope="col">${esc(tx('col.agregados'))}</th><th scope="col">${esc(tx('col.quitados'))}</th><th scope="col">${esc(tx('col.longitud'))}</th></tr></thead><tbody>${fotos.join('')}</tbody></table>`,
      );
    if (partes.length) secciones.push(seccion(tx('sec.genealogia'), partes.join(''), 6, true));
  }

  // ================= portada, resumen y cifras =================
  const cab = [];
  const meta = [tx('meta.ciclos', { desde: cicloIni, hasta: cicloFin })];
  if (Number.isFinite(d.semilla)) meta.push(tx('meta.semilla', { semilla: String(d.semilla) }));
  {
    const baseId = esc0?.opciones?.base;
    if (baseId) {
      const base = /** @type {any} */ (BASES)[baseId]?.[idioma] ?? String(baseId);
      // como en Configuración: solo los cambios del escenario sobre la base
      const n = Object.keys(esc0?.opciones?.cambios ?? {}).length;
      meta.push(n === 0 ? tx('meta.base', { base }) : tx('meta.baseCambios', { base, n }));
    }
    const enCaliente = cambios.filter((e) => e && Number.isFinite(e.ciclo)).length;
    if (enCaliente) meta.push(tx('meta.caliente', { n: enCaliente }));
  }
  if (fechaTexto) meta.push(tx('meta.generado', { fecha: fechaTexto }));
  cab.push(
    `<header class="cab"><span class="kicker">${esc(tx('informe.corrida'))}</span><h1>${esc(titulo)}</h1><div class="meta">${esc(meta.join(' · '))}</div></header>`,
  );

  const frases = resumen
    .filter((x) => numeros.has(x.figura))
    .map((x) => {
      const n = /** @type {number} */ (numeros.get(x.figura));
      const esp = typeof x.params.especie === 'string' ? x.params.especie : null;
      const color = esp ? colorDe(esp) : x.tipo === 'colapso' ? TINTA : ACENTO;
      return `<p class="find"><span class="sw" style="background:${color}"></span><span>${esc(tx(`hallazgo.${x.clave}`, x.params))} <a href="#${esc(x.figura)}">${esc(tx('fig.ref', { n }))}</a></span></p>`;
    });
  if (frases.length)
    cab.push(
      `<section class="resumen"><span class="kicker">${esc(tx('resumen.titulo'))}</span>${frases.join('')}<p class="cap">${esc(tx('resumen.nota'))}</p></section>`,
    );

  {
    const vivos = global('vivos');
    const tiles = [];
    const fin = ultimoFinito(vivos.media);
    if (Number.isFinite(fin)) tiles.push([num(fin, 0), tx('kpi.botsFinal')]);
    let ip = -1;
    vivos.max.forEach((v, i) => {
      if (Number.isFinite(v) && (ip < 0 || v > vivos.max[ip])) ip = i;
    });
    if (ip >= 0) tiles.push([num(vivos.max[ip], 0), tx('kpi.pico', { ciclo: t[ip] })]);
    if (nombres.length)
      tiles.push([
        tx('kpi.deTotal', { a: nombres.filter(vivaAlFinal).length, b: nombres.length }),
        tx('kpi.especiesVivas'),
      ]);
    tiles.push([
      num(extinciones.filter((x) => x.clave === 'extincion').length, 0),
      tx('kpi.extinciones'),
    ]);
    const gm = maxFinito(global('genMax').max);
    if (Number.isFinite(gm)) tiles.push([num(gm, 0), tx('kpi.genMax')]);
    const adn = ultimoFinito(global('adnMedia').media);
    if (Number.isFinite(adn)) tiles.push([num(adn, 0), tx('kpi.adnFinal')]);
    let nac = 0;
    let hayNac = false;
    for (const n of nombres) {
      const s = h.serie('nacimientos', n);
      if (!s) continue;
      hayNac = true;
      s.media.forEach((v, i) => {
        if (Number.isFinite(v)) nac += v * s.n[i];
      });
    }
    if (hayNac) tiles.push([num(nac, 0), tx('kpi.nacimientos')]);
    tiles.push([num(cicloFin, 0), tx('kpi.ciclos')]);
    cab.push(
      `<section class="kpis">${tiles
        .slice(0, 8)
        .map(([v, l]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`)
        .join('')}</section>`,
    );
  }

  // ================= datos embebidos y pie =================
  const puntos = t.length;
  const nSeries = embebidas.length;
  const pie = `<footer class="pie"><span>${esc(tx('pie.datos', { puntos, series: nSeries, eventos: feed.length + cambios.length }))}</span><span class="mono">${esc(tx('pie.firma', { fecha: fechaTexto }))}</span></footer>`;

  /** @type {DatosEmbebidos} */
  const datos = {
    formato: 1,
    tipo: 'corrida',
    idioma,
    titulo,
    semilla: Number.isFinite(d.semilla) ? /** @type {number} */ (d.semilla) : null,
    fecha: Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString(),
    ciclos: { desde: cicloIni, hasta: cicloFin },
    intervalo: h.intervalo,
    t,
    series: embebidas,
    hallazgos,
    eventos: feed,
    cambios,
    especies: arbol,
    escenario: esc0,
  };

  const cuerpo = [...cab, ...secciones, pie].join('\n');
  const html = documento({
    idioma,
    titulo: `${tx('informe.corrida')} · ${titulo}`,
    archivo,
    cuerpo,
    datos,
    barra: { imprimir: tx('barra.imprimir'), json: tx('barra.json'), csv: tx('barra.csv') },
  });
  return { html, archivo, datos };
}

/**
 * Colores de las especies, atados a la especie en todas las figuras:
 *   1. las `maxCapas` principales (por peso: `porPeso` va de mayor a menor)
 *      que traen color del escenario lo conservan, salvo que otra más
 *      pesada ya lo tenga;
 *   2. las principales que quedan sin color toman la paleta, sin los
 *      colores del escenario (PALETA, después PALETA_EXTRA y, si todo está
 *      tomado, tonos generados), así dos capas nunca comparten color;
 *   3. las demás (van en «otras») conservan su color del escenario si nadie
 *      lo usa; si no, gris. Lo mismo las sembradas que nunca tuvieron bots.
 * @param {string[]} porPeso @param {any[]} sembradas especies del escenario
 * @param {number} [maxCapas]
 * @returns {Map<string, string>}
 */
export function asignarColores(porPeso, sembradas, maxCapas = MAX_CAPAS) {
  /** @type {Map<string, string>} */
  const delEscenario = new Map();
  for (const e of sembradas) {
    const n = nombreEspecie(e?.bot ?? '');
    if (
      n &&
      typeof e?.color === 'string' &&
      /^#[0-9a-f]{6}$/i.test(e.color) &&
      !delEscenario.has(n)
    )
      delEscenario.set(n, e.color.toLowerCase());
  }
  const reservados = new Set([...delEscenario.values(), GRIS, GRIS_OTRAS]);
  /** @type {Set<string>} */
  const usados = new Set([GRIS, GRIS_OTRAS]);
  /** @type {Map<string, string>} */
  const colores = new Map();
  const principales = porPeso.slice(0, maxCapas);
  for (const n of principales) {
    const c = delEscenario.get(n);
    if (c && !usados.has(c)) {
      colores.set(n, c);
      usados.add(c);
    }
  }
  const libres = [...PALETA, ...PALETA_EXTRA].filter((c) => !reservados.has(c));
  let k = 0;
  let tono = 0;
  for (const n of principales) {
    if (colores.has(n)) continue;
    let c = libres[k++];
    while (!c || usados.has(c)) c = tonoGenerado(tono++);
    colores.set(n, c);
    usados.add(c);
  }
  const demas = [...porPeso.slice(maxCapas), ...delEscenario.keys()];
  for (const n of demas) {
    if (colores.has(n)) continue;
    const c = delEscenario.get(n);
    if (c && !usados.has(c)) {
      colores.set(n, c);
      usados.add(c);
    } else colores.set(n, GRIS);
  }
  return colores;
}

/** Tono de reserva k (ángulo áureo, saturación y luz medias). @param {number} k */
function tonoGenerado(k) {
  const h = (k * 137.508 + 20) % 360;
  const s = 0.55;
  const l = 0.45;
  const f = (/** @type {number} */ n) => {
    const q = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(q - 3, 9 - q, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Sección numerada; `salto` empieza página nueva al imprimir.
 * @param {string} titulo @param {string} cuerpo @param {number} n @param {boolean} [salto]
 */
export function seccion(titulo, cuerpo, n, salto = false) {
  return `<section class="sec${salto ? ' salto' : ''}"><h2>${n}. ${esc(titulo)}</h2>${cuerpo}</section>`;
}

/**
 * Valor de un parámetro para mostrar (enum → su texto; bool → sí/no).
 * @param {string} clave @param {unknown} v @param {'es' | 'en'} idioma
 * @param {(x: number, dec?: number) => string} num
 * @param {(c: string, p?: Record<string, unknown>) => string} tx
 */
export function valorParametro(clave, v, idioma, num, tx) {
  const p = parametro(clave);
  const x = Number(v);
  if (p?.valor === 'enum') {
    const e = p.valores?.find((o) => o.v === x);
    if (e) return e[idioma];
  }
  if (p?.valor === 'bool') return x ? tx('si') : tx('no');
  return Number.isFinite(x) ? num(x, 4) : String(v);
}

/**
 * Lista «Parámetro = valor» de un conjunto de cambios.
 * @param {Record<string, unknown>} cambios @param {'es' | 'en'} idioma
 * @param {(x: number, dec?: number) => string} num
 * @param {(c: string, p?: Record<string, unknown>) => string} tx
 */
function listaCambios(cambios, idioma, num, tx) {
  return Object.entries(cambios ?? {})
    .map(([k, v]) => `${parametro(k)?.[idioma] ?? k} = ${valorParametro(k, v, idioma, num, tx)}`)
    .join(', ');
}

/**
 * Texto de un evento del feed ({ciclo, tipo, params}).
 * @param {any} e @param {(c: string, p?: Record<string, unknown>) => string} tx
 * @param {'es' | 'en'} idioma @param {(x: number, dec?: number) => string} num
 */
function textoEvento(e, tx, idioma, num) {
  const p = { ...(e.params ?? {}) };
  switch (e.tipo) {
    case 'generacion':
      return p.especie ? tx('evento.generacion', p) : tx('evento.generacionSin', p);
    case 'cambio':
      return tx('evento.cambio', { lista: listaCambios(p.cambios, idioma, num, tx) });
    case 'inicio':
      return tx('evento.inicio', { ...p, semilla: String(p.semilla ?? '') });
    case 'extincion':
    case 'pico':
    case 'llegada':
    case 'especieNueva':
    case 'sembrado':
    case 'guardada':
    case 'cargada':
    case 'importada':
      return tx(`evento.${e.tipo}`, p);
    default:
      return tx('evento.otro', { tipo: String(e.tipo ?? '') });
  }
}

/**
 * Texto de un cambio en caliente de la corrida (engine/corridas.js).
 * @param {any} e @param {(c: string, p?: Record<string, unknown>) => string} tx
 * @param {'es' | 'en'} idioma @param {(x: number, dec?: number) => string} num
 */
export function textoCambio(e, tx, idioma, num) {
  if (e.tipo === 'siembra')
    return tx('cambio.siembra', {
      n: Number(e.especie?.cantidad ?? 0),
      especie: nombreEspecie(e.especie?.nombre ?? ''),
    });
  if (e.tipo === 'objetos') return textoOrdenObjeto(e.orden, tx, num);
  return listaCambios(e.cambios ?? {}, idioma, num, tx);
}

/** Órdenes de objeto con texto propio (ORDENES_OBJETO de engine/corridas.js). */
const ORDENES_CON_TEXTO = Object.freeze([
  'forma',
  'formas',
  'laberinto',
  'teleporter',
  'borrar-forma',
  'borrar-formas10',
  'borrar-formas',
  'borrar-teleporter',
  'borrar-teleporters',
]);
const FORMAS_CON_TEXTO = Object.freeze(['h', 'v', 'spiral', 'checker', 'polar', 'trash']);

/**
 * Texto de una orden de objeto en caliente (evento 'objetos' de
 * engine/corridas.js: obstáculos al azar, laberinto, teleporter, borrados).
 * Las medidas de las formas son fracciones del campo: se muestran en %.
 * @param {any} o @param {(c: string, p?: Record<string, unknown>) => string} tx
 * @param {(x: number, dec?: number) => string} num
 */
export function textoOrdenObjeto(o, tx, num) {
  const tipo = String(o?.tipo ?? '');
  if (!ORDENES_CON_TEXTO.includes(tipo)) return tx('objeto.otro', { tipo });
  /** @param {unknown} f */
  const pct = (f) => num(Number(f) * 100, 1);
  const forma = FORMAS_CON_TEXTO.includes(o.forma)
    ? tx(`laberinto.${o.forma}`)
    : String(o.forma ?? '');
  return tx(`objeto.${tipo}`, {
    ancho: pct(o.ancho),
    alto: pct(o.alto),
    forma,
    pasillo: Number(o.pasillo),
    muro: Number(o.muro),
    n: Number(o.n),
  });
}
