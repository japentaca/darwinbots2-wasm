// @ts-check
// Plantilla «Comparación» del informe (decisiones 10 y 11 de
// port/web2/PLAN.md): dos corridas en un .html autocontenido.
//
//   - portada con las dos configuraciones lado a lado y sus diferencias
//     (escenario, semilla, base, opciones efectivas al arrancar, especies,
//     objetos y cambios en caliente);
//   - resumen por reglas de cada corrida (engine/detectors.js agrupado con
//     agruparHallazgos): cada frase enlaza a la figura superpuesta que la
//     respalda; si los detectores no encuentran nada en una corrida, no
//     escribe nada de ella;
//   - gráficos superpuestos de las métricas principales de los seis grupos
//     (decisión 7): A en línea continua, B en discontinua, cada una con su
//     banda mín–máx donde la historia fundió puntos;
//   - tabla de valores finales (último punto de cada historia, que es la
//     última muestra sin fundir: C21) con la diferencia B − A.
//
// Puro: recibe las dos corridas (historia + metadatos, como la plantilla
// Corrida) y devuelve el texto del .html.

import { agruparHallazgos, detectar, FIGURAS } from '../detectors.js';
import { resolverOpciones } from '../escenarios/index.js';
import { lgHash } from '../league.js';
import { nombreEspecie } from '../metricas.js';
import { BASES, PARAMETROS, parametro, valorEfectivo } from '../opciones.js';
import { METRICAS_CLAVE } from '../replicas.js';
import {
  fechaInforme,
  figuras,
  formatosEje,
  leyenda,
  nombreEscenario,
  nombreMetrica,
  redondo,
  tabla,
  ultimoFinito,
} from './comun.js';
import { seccion, valorParametro } from './corrida.js';
import { ANCHO_MEDIO, documento, nombreArchivo } from './plantilla.js';
import { esc, lineas } from './svg.js';
import { idiomaValido, traductor } from './textos.js';

/** Colores de A y B (los mismos de Comparar en la interfaz). */
export const COLOR_A = '#0f5c55';
export const COLOR_B = '#c05621';

/**
 * Métricas superpuestas por grupo (decisión 7). Genética usa las métricas
 * del ADN (las series globales no traen histogramas).
 */
export const GRUPOS_CMP = Object.freeze([
  ['poblacion', ['vivos', 'noVegetales', 'especiesVivas']],
  ['evolucion', ['genMax', 'mutMedia']],
  ['genetica', ['adnMedia', 'genesMedia']],
  ['comportamiento', ['disparosCiclo', 'killsTotal']],
  ['energia', ['nrgTotal', 'bodyTotal']],
  ['entorno', ['luz', 'cloroTotal']],
]);

/** Id de la figura superpuesta de una métrica. @param {string} m */
export const idFigura = (m) => `fig-c-${m}`;

/** Figura que respalda cada tipo de hallazgo en la comparación. */
const FIGURA_HALLAZGO = Object.freeze({
  [FIGURAS.especies]: idFigura('especiesVivas'),
  [FIGURAS.total]: idFigura('noVegetales'),
  [FIGURAS.adn]: idFigura('adnMedia'),
});

/**
 * Una de las dos corridas (lo mismo que la plantilla Corrida; el linaje no
 * se usa).
 * @typedef {object} CorridaComparada
 * @property {import('./corrida.js').HistoriaInforme} historia
 * @property {any} [escenario]
 * @property {number | null} [semilla]
 * @property {string} [titulo]       nombre de la corrida (por defecto, el del escenario)
 * @property {any[]} [cambios]       cambios en caliente y siembras (engine/corridas.js)
 * @property {import('../detectors.js').Hallazgo[]} [hallazgos]  por defecto, detectar(historia)
 */

/**
 * @typedef {object} DatosComparacion
 * @property {CorridaComparada} a
 * @property {CorridaComparada} b
 * @property {string} [titulo]
 * @property {string | number | Date} [fecha]
 */

/**
 * Una diferencia de configuración: `clave` estable (escenario, semilla,
 * base, objetos, caliente, `opcion:<clave>` o `especie:<bot>`) y los dos
 * valores ya escritos para mostrar.
 * @typedef {{clave: string, aspecto: string, a: string, b: string}} Diferencia
 */

/**
 * Datos de una especie sembrada para comparar.
 * @param {any} s
 */
function datosEspecie(s) {
  const hash = typeof s?.adn === 'string' && s.adn ? lgHash(s.adn) : (s?.hash ?? '');
  return {
    cantidad: Number(s?.cantidad ?? 0),
    vegetal: !!s?.vegetal,
    energia: Number(s?.energia ?? Number.NaN),
    hash: String(hash ?? ''),
  };
}

/** @param {any} e */
const conteoObjetos = (e) => ({
  obstaculos: e?.objetos?.obstaculos?.length ?? 0,
  teleporters: e?.objetos?.teleporters?.length ?? 0,
});

/** @param {any[] | undefined} c */
const enCaliente = (c) => (c ?? []).filter((e) => e && Number.isFinite(e.ciclo));

/**
 * Diferencias de configuración entre dos corridas, ya escritas en el idioma.
 * Las opciones se comparan por su valor EFECTIVO al arrancar (base + cambios
 * del escenario).
 * @param {CorridaComparada} a @param {CorridaComparada} b
 * @param {ReturnType<typeof traductor>} tr
 * @returns {Diferencia[]}
 */
export function diferenciasComparacion(a, b, tr) {
  const { tx, num, idioma } = tr;
  /** @type {Diferencia[]} */
  const out = [];
  const ea = a.escenario ?? null;
  const eb = b.escenario ?? null;
  const nada = '—';
  const na = nombreEscenario(ea, idioma) || nada;
  const nb = nombreEscenario(eb, idioma) || nada;
  if ((ea?.id ?? null) !== (eb?.id ?? null) || na !== nb)
    out.push({ clave: 'escenario', aspecto: tx('cmp.escenario'), a: na, b: nb });
  const sa = Number.isFinite(a.semilla) ? String(a.semilla) : nada;
  const sb = Number.isFinite(b.semilla) ? String(b.semilla) : nada;
  if (sa !== sb) out.push({ clave: 'semilla', aspecto: tx('cmp.semilla'), a: sa, b: sb });
  /** @param {any} e */
  const base = (e) => {
    const id = e?.opciones?.base;
    return id ? String(/** @type {any} */ (BASES)[id]?.[idioma] ?? id) : nada;
  };
  if (base(ea) !== base(eb))
    out.push({ clave: 'base', aspecto: tx('cmp.base'), a: base(ea), b: base(eb) });
  /** @param {any} e */
  const resueltos = (e) => {
    try {
      return e?.opciones?.base ? resolverOpciones(e) : null;
    } catch {
      return null;
    }
  };
  const ra = resueltos(ea);
  const rb = resueltos(eb);
  if (ra || rb)
    for (const p of PARAMETROS) {
      if (p.derivado) continue;
      const va = ra ? valorEfectivo(ra, p.clave) : undefined;
      const vb = rb ? valorEfectivo(rb, p.clave) : undefined;
      if (Object.is(va, vb)) continue;
      /** @param {number | undefined} v */
      const txt = (v) => (v === undefined ? nada : valorParametro(p.clave, v, idioma, num, tx));
      out.push({
        clave: `opcion:${p.clave}`,
        aspecto: String(parametro(p.clave)?.[idioma] ?? p.clave),
        a: txt(va),
        b: txt(vb),
      });
    }
  /** @param {any} e */
  const especies = (e) =>
    new Map(
      (e?.especies ?? []).map((/** @type {any} */ s) => [
        nombreEspecie(s?.bot ?? ''),
        datosEspecie(s),
      ]),
    );
  const pa = especies(ea);
  const pb = especies(eb);
  /** @param {ReturnType<typeof datosEspecie> | undefined} d @param {ReturnType<typeof datosEspecie> | undefined} otra */
  const txtEspecie = (d, otra) => {
    if (!d) return tx('cmp.ausente');
    const partes = [tx('cmp.especieBots', { n: d.cantidad })];
    if (d.vegetal) partes.push(tx('vegetalMarca'));
    if (Number.isFinite(d.energia)) partes.push(tx('cmp.energia', { n: d.energia }));
    if (otra && d.hash && otra.hash && d.hash !== otra.hash)
      partes.push(tx('cmp.adn', { hash: d.hash.slice(0, 8) }));
    return partes.join(' · ');
  };
  for (const bot of new Set([...pa.keys(), ...pb.keys()])) {
    const da = pa.get(bot);
    const db = pb.get(bot);
    if (JSON.stringify(da) === JSON.stringify(db)) continue;
    out.push({
      clave: `especie:${bot}`,
      aspecto: tx('cmp.especie', { bot }),
      a: txtEspecie(da, db),
      b: txtEspecie(db, da),
    });
  }
  const oa = conteoObjetos(ea);
  const ob = conteoObjetos(eb);
  const objA = JSON.stringify(ea?.objetos ?? null);
  const objB = JSON.stringify(eb?.objetos ?? null);
  if (objA !== objB)
    out.push({
      clave: 'objetos',
      aspecto: tx('cmp.objetos'),
      a: tx('cmp.objetosValor', oa),
      b: tx('cmp.objetosValor', ob),
    });
  const ca = enCaliente(a.cambios);
  const cb = enCaliente(b.cambios);
  if (JSON.stringify(ca) !== JSON.stringify(cb))
    out.push({
      clave: 'caliente',
      aspecto: tx('cmp.caliente'),
      a: tx('cmp.calienteValor', { n: ca.length }),
      b: tx('cmp.calienteValor', { n: cb.length }),
    });
  return out;
}

/**
 * Genera el informe de comparación de dos corridas.
 * @param {DatosComparacion} d @param {{idioma?: 'es' | 'en'}} [op]
 * @returns {{html: string, archivo: string, datos: any}}
 */
export function informeComparacion(d, op = {}) {
  if (!d?.a?.historia || !d?.b?.historia)
    throw new Error('informe «comparacion»: faltan las dos corridas');
  const idioma = idiomaValido(op.idioma);
  const tr = traductor(idioma);
  const { tx, num } = tr;
  const f = fechaInforme(d.fecha, idioma);
  /** @param {CorridaComparada} x */
  const nombre = (x) => x.titulo || nombreEscenario(x.escenario, idioma) || tx('informe.sinTitulo');
  let na = nombre(d.a);
  let nb = nombre(d.b);
  if (na === nb) {
    na = `${na} (A)`;
    nb = `${nb} (B)`;
  }
  const titulo = d.titulo || tx('cmp.titulo', { a: na, b: nb });
  const archivo = nombreArchivo(titulo, f.fecha);
  const lados = /** @type {const} */ ([
    { lado: 'A', c: d.a, nombre: na, color: COLOR_A, discontinua: false },
    { lado: 'B', c: d.b, nombre: nb, color: COLOR_B, discontinua: true },
  ]);
  const rangos = lados.map(({ c }) => {
    const t = [...c.historia.t];
    return { desde: t.length ? t[0] : 0, hasta: t.length ? t[t.length - 1] : 0 };
  });
  const cicloFin = Math.max(rangos[0].hasta, rangos[1].hasta);
  const { fmtX, fmtY } = formatosEje(tr, cicloFin);
  const { numeros, figura } = figuras(tr);
  const etiqueta = (/** @type {{lado: string, nombre: string}} */ l) =>
    tx('cmp.lado', { lado: l.lado, nombre: l.nombre });

  /** @type {any[]} */
  const embebidas = [];

  // ---- 2. Métricas: figuras superpuestas (se arman antes para numerarlas en orden) ----
  const grupos = GRUPOS_CMP.map(([grupo, metricas]) => {
    const figs = metricas
      .map((m) => {
        const series = lados.map((l) => ({ l, s: l.c.historia.serie(m) }));
        const hay = series.filter((x) => x.s?.media.some(Number.isFinite));
        if (!hay.length) return '';
        for (const x of hay) {
          const s = /** @type {import('../history.js').Serie} */ (x.s);
          const fundida =
            s.min.some((v, i) => v !== s.media[i]) || s.max.some((v, i) => v !== s.media[i]);
          embebidas.push({
            corrida: x.l.lado,
            metrica: m,
            t: [...s.t],
            media: Array.from(s.media, redondo),
            ...(fundida
              ? { min: Array.from(s.min, redondo), max: Array.from(s.max, redondo) }
              : {}),
          });
        }
        const banda = hay.some((x) =>
          x.s?.min.some((v, i) => v !== /** @type {any} */ (x.s).media[i]),
        );
        const cap =
          tx('fig.cmp', { metrica: nombreMetrica(tr, m) }) + (banda ? ` ${tx('banda')}` : '');
        const svg = lineas({
          ancho: ANCHO_MEDIO,
          alto: 170,
          etiqueta: cap,
          fmtX,
          fmtY,
          x: [],
          yCero: m !== 'adnMedia' && m !== 'genesMedia',
          series: hay.map((x) => {
            const s = /** @type {import('../history.js').Serie} */ (x.s);
            return {
              x: [...s.t],
              valores: [...s.media],
              min: [...s.min],
              max: [...s.max],
              color: x.l.color,
              discontinua: x.l.discontinua,
            };
          }),
        });
        return figura(
          idFigura(m),
          svg,
          cap,
          leyenda(
            hay.map((x) => ({
              nombre: etiqueta(x.l),
              color: x.l.color,
              discontinua: x.l.discontinua,
            })),
          ),
        );
      })
      .filter(Boolean);
    const cuerpo = figs.length
      ? `<div class="dos">${figs.join('')}</div>`
      : `<p class="cap">${esc(tx('grupo.sinDatos'))}</p>`;
    return `<h3>${esc(tx(`grupo.${grupo}`))}</h3>${cuerpo}`;
  });

  // ---- portada ----
  const cab = [];
  const meta = lados.map((l, i) =>
    tx('cmp.metaLado', { lado: l.lado, desde: rangos[i].desde, hasta: rangos[i].hasta }),
  );
  if (f.texto) meta.push(tx('meta.generado', { fecha: f.texto }));
  cab.push(
    `<header class="cab"><span class="kicker">${esc(tx('informe.comparacion'))}</span><h1>${esc(titulo)}</h1><div class="meta">${esc(meta.join(' · '))}</div></header>`,
  );

  // resumen: los hallazgos de cada corrida, enlazados a su figura superpuesta
  const hallazgos = lados.map((l) => {
    try {
      return l.c.hallazgos ?? detectar(l.c.historia);
    } catch {
      return [];
    }
  });
  const bloques = lados
    .map((l, i) => {
      const frases = agruparHallazgos(hallazgos[i])
        .map((x) => ({ x, fig: /** @type {Record<string, string>} */ (FIGURA_HALLAZGO)[x.figura] }))
        .filter((p) => p.fig && numeros.has(p.fig))
        .map(
          ({ x, fig }) =>
            `<p class="find"><span class="sw" style="background:${l.color}"></span><span>${esc(tx(`hallazgo.${x.clave}`, x.params))} <a href="#${esc(fig)}">${esc(tx('fig.ref', { n: numeros.get(fig) }))}</a></span></p>`,
        );
      return frases.length ? `<h3>${esc(etiqueta(l))}</h3>${frases.join('')}` : '';
    })
    .filter(Boolean);
  if (bloques.length)
    cab.push(
      `<section class="resumen"><span class="kicker">${esc(tx('resumen.titulo'))}</span>${bloques.join('')}<p class="cap">${esc(tx('resumen.notaCmp'))}</p></section>`,
    );

  // ---- 1. Configuraciones lado a lado y diferencias ----
  const difs = diferenciasComparacion(d.a, d.b, tr);
  {
    const nada = '—';
    /** @param {CorridaComparada} c @param {number} i */
    const columna = (c, i) => {
      const e = c.escenario ?? null;
      const baseId = e?.opciones?.base;
      const nCambios = Object.keys(e?.opciones?.cambios ?? {}).length;
      const sembradas = (e?.especies ?? [])
        .map(
          (/** @type {any} */ s) =>
            `${nombreEspecie(s?.bot ?? '')} × ${num(Number(s?.cantidad ?? 0), 0)}`,
        )
        .join(', ');
      return [
        nombreEscenario(e, idioma) || nada,
        Number.isFinite(c.semilla) ? String(c.semilla) : nada,
        baseId ? String(/** @type {any} */ (BASES)[baseId]?.[idioma] ?? baseId) : nada,
        e ? tx('cmp.parametrosValor', { n: nCambios }) : nada,
        sembradas || nada,
        e ? tx('cmp.objetosValor', conteoObjetos(e)) : nada,
        tx('cmp.calienteValor', { n: enCaliente(c.cambios).length }),
        tx('cmp.ciclosValor', { desde: rangos[i].desde, hasta: rangos[i].hasta }),
      ];
    };
    const ca = columna(d.a, 0);
    const cbb = columna(d.b, 1);
    const aspectos = [
      'cmp.escenario',
      'cmp.semilla',
      'cmp.base',
      'cmp.parametros',
      'cmp.especies',
      'cmp.objetos',
      'cmp.caliente',
      'cmp.ciclos',
    ];
    const cabLados = lados.map((l) => etiqueta(l));
    const partes = [
      tabla(
        [tx('cmp.aspecto'), ...cabLados],
        aspectos.map((k, i) => [esc(tx(k)), esc(ca[i]), esc(cbb[i])]),
        [1, 2],
      ),
      `<h3>${esc(tx('cmp.diferencias'))}</h3>`,
      `<p class="p">${esc(difs.length ? tx('cmp.nDiferencias', { n: difs.length }) : tx('cmp.sinDiferencias'))}</p>`,
    ];
    if (difs.length)
      partes.push(
        tabla(
          [tx('cmp.aspecto'), ...cabLados],
          difs.map((x) => [esc(x.aspecto), esc(x.a), esc(x.b)]),
          [1, 2],
        ),
      );
    cab.push(seccion(tx('sec.configuraciones'), partes.join(''), 1));
  }

  const secciones = [seccion(tx('sec.metricas'), grupos.join(''), 2, true)];

  // ---- 3. Valores finales ----
  {
    const finales = lados.map((l) => {
      /** @type {Map<string, number>} */
      const m = new Map();
      for (const k of METRICAS_CLAVE) {
        const s = l.c.historia.serie(k);
        m.set(k, s ? ultimoFinito(s.media) : Number.NaN);
      }
      return m;
    });
    const filas = METRICAS_CLAVE.filter(
      (k) => Number.isFinite(finales[0].get(k)) || Number.isFinite(finales[1].get(k)),
    ).map((k) => {
      const va = /** @type {number} */ (finales[0].get(k));
      const vb = /** @type {number} */ (finales[1].get(k));
      const dif = vb - va;
      const pct = Number.isFinite(dif) && va !== 0 ? (dif / Math.abs(va)) * 100 : Number.NaN;
      const signo = (/** @type {number} */ x) => (x > 0 ? '+' : '');
      return [
        esc(nombreMetrica(tr, k)),
        esc(num(va, 2)),
        esc(num(vb, 2)),
        esc(Number.isFinite(dif) ? `${signo(dif)}${num(dif, 2)}` : '—'),
        esc(Number.isFinite(pct) ? `${signo(pct)}${num(pct, 1)} %` : '—'),
      ];
    });
    const partes = [
      `<p class="cap">${esc(tx('cmp.finalesNota', { a: rangos[0].hasta, b: rangos[1].hasta }))}</p>`,
      filas.length
        ? tabla(
            [
              tx('col.metrica'),
              ...lados.map((l) => l.lado),
              tx('col.diferencia'),
              tx('col.cambio'),
            ],
            filas,
          )
        : `<p class="cap">${esc(tx('grupo.sinDatos'))}</p>`,
    ];
    secciones.push(seccion(tx('sec.finales'), partes.join(''), 3));
  }

  const pie = `<footer class="pie"><span>${esc(tx('pie.cmp', { series: embebidas.length }))}</span><span class="mono">${esc(tx('pie.firma', { fecha: f.texto }))}</span></footer>`;

  const datos = {
    formato: 1,
    tipo: 'comparacion',
    idioma,
    titulo,
    fecha: f.iso,
    corridas: lados.map((l, i) => ({
      lado: l.lado,
      nombre: l.nombre,
      semilla: Number.isFinite(l.c.semilla) ? l.c.semilla : null,
      ciclos: rangos[i],
      escenario: l.c.escenario ?? null,
      cambios: l.c.cambios ?? [],
      hallazgos: hallazgos[i],
    })),
    diferencias: difs,
    series: embebidas,
  };
  const html = documento({
    idioma,
    titulo: `${tx('informe.comparacion')} · ${titulo}`,
    archivo,
    cuerpo: [...cab, ...secciones, pie].join('\n'),
    datos,
    barra: { imprimir: tx('barra.imprimir'), json: tx('barra.json'), csv: tx('barra.csv') },
  });
  return { html, archivo, datos };
}
