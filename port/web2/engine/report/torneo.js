// @ts-check
// Plantilla «Torneo» del informe (decisiones 11 y 22 de port/web2/PLAN.md):
// una temporada de un torneo (engine/league.js) en un .html autocontenido,
// con el mismo armazón, estilo e impresión que las otras plantillas
// (engine/report/plantilla.js).
//
//   - portada: nombre, formato, temporada, participantes y partidos;
//   - resumen por reglas (hallazgos simples; si no aplican, no escriben):
//     campeón o líder, el Elo más alto, rondas decididas por el tope de
//     ciclos, partidos nulos. Cada frase enlaza a su tabla o figura;
//   - 1. Tabla (Elo, % de rondas por el tope, ciclos promedio);
//   - 2. Estructura del formato (rondas del suizo, grupos y cuadro de la
//     copa, peleas y coronas de la colina, escalera, calendario del todos
//     contra todos); el partido único no tiene;
//   - 3. Evolución del Elo (SVG);
//   - 4. Partidos, con su semilla (para repetirlos);
//   - 5. Reglas: el mundo (escenario o foto de la clásica) y los valores
//     del partido.
// Datos embebidos: el torneo (sin el ADN), la tabla, los partidos y el Elo
// después de cada partido como series (en el CSV, la columna «ciclo» es el
// número de partido y «especie», el bot).
//
// Puro: recibe el torneo y sus partidos.

import {
  LG_ELO0,
  lgCupGroupsOk,
  lgCupSizeOk,
  lgCupState,
  lgElo,
  lgKothState,
  lgLadderState,
  lgPairKey,
  lgPlayed,
  lgRrFixtures,
  lgSeasonChampion,
  lgSeasonDone,
  lgStandings,
  lgSwissRounds,
  lgSwissState,
} from '../league.js';
import { BASES } from '../opciones.js';
import { fechaInforme, leyenda, redondo, tabla } from './comun.js';
import { seccion } from './corrida.js';
import { ANCHO_HOJA, documento, nombreArchivo } from './plantilla.js';
import { esc, lineas } from './svg.js';
import { ErrorInforme, idiomaValido, traductor } from './textos.js';

/**
 * @typedef {import('../league.js').League} League
 * @typedef {import('../league.js').Season} Season
 * @typedef {import('../league.js').Match} Match
 * @typedef {ReturnType<typeof traductor>} Traductor
 */

/**
 * Datos del informe de Torneo.
 * @typedef {object} DatosTorneo
 * @property {League} torneo           el torneo (temporadas con reglas, formato y participantes)
 * @property {Match[]} partidos        sus partidos (de cualquier temporada)
 * @property {number} [temporada]      la temporada del informe (por defecto la última)
 * @property {string} [titulo]         nombre visible del torneo (por defecto torneo.name)
 * @property {string | number | Date} [fecha]
 */

/** Series de Elo como mucho en la figura (las de mejor Elo final). */
export const MAX_ELO = 8;
const GRIS = '#8899bb';

/** Color seguro para un atributo style (solo #rrggbb). @param {unknown} c */
const color = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : GRIS);

/** @param {string} nombre @param {string} c */
const conColor = (nombre, c) =>
  `<span class="nombre"><span class="sw" style="background:${color(c)};border-radius:50%"></span>${esc(nombre)}</span>`;

/**
 * El formato en una línea.
 * @param {Record<string, any>} f @param {Traductor} tr @param {number} n
 */
export function textoFormatoInforme(f, tr, n) {
  const { tx } = tr;
  switch (f.format) {
    case 'rr':
      return tx(f.legs === 2 ? 'torneo.fmt.rr2' : 'torneo.fmt.rr');
    case 'ladder':
      return tx('torneo.fmt.ladder');
    case 'single':
      return tx('torneo.fmt.single');
    case 'swiss':
      return tx('torneo.fmt.swiss', { n: lgSwissRounds(f, Math.max(2, n)) });
    case 'cup':
      return tx(f.third ? 'torneo.fmt.cupTercero' : 'torneo.fmt.cup');
    default:
      return f.kothEnd === 'never'
        ? tx('torneo.fmt.kothSinFin', { k: f.k })
        : tx('torneo.fmt.koth', { k: f.k, n: f.retire });
  }
}

/**
 * Elo de cada participante después de cada partido jugado (en orden),
 * como lo calcula la tabla (lgElo: 1500, K 32 repartido entre los N − 1
 * rivales). x[0] = 0 (antes del primero).
 * @param {Season} S @param {Match[]} ms
 */
export function eloPorPartido(S, ms) {
  const jugados = lgPlayed(ms)
    .slice()
    .sort((a, b) => a.no - b.no);
  /** @type {Map<string, {elo: number}>} */
  const filas = new Map();
  /** @param {string} n */
  const fila = (n) => {
    let r = filas.get(n);
    if (!r) {
      r = { elo: LG_ELO0 };
      filas.set(n, r);
    }
    return r;
  };
  for (const e of S.entrants) fila(e.name);
  for (const m of jugados) for (const n of m.fighters) fila(n);
  const nombres = [...filas.keys()];
  /** @type {Map<string, number[]>} */
  const series = new Map(nombres.map((n) => [n, [LG_ELO0]]));
  const x = [0];
  for (const [i, m] of jugados.entries()) {
    const f = m.fighters.map(fila);
    lgElo(f, fila(m.winner));
    x.push(i + 1);
    for (const n of nombres) /** @type {number[]} */ (series.get(n)).push(fila(n).elo);
  }
  return { x, series, partidos: jugados };
}

/**
 * Genera el informe de una temporada de un torneo.
 * @param {DatosTorneo} d @param {{idioma?: 'es' | 'en'}} [op]
 * @returns {{html: string, archivo: string, datos: any}}
 */
export function informeTorneo(d, op = {}) {
  const L = d?.torneo;
  if (!L || !Array.isArray(L.seasons) || !L.seasons.length || !Array.isArray(d.partidos))
    throw new ErrorInforme('falta-torneo');
  const S = L.seasons.find((s) => s.no === d.temporada) ?? L.seasons[L.seasons.length - 1];
  const idioma = idiomaValido(op.idioma);
  const tr = traductor(idioma);
  const { tx, num } = tr;
  const f = fechaInforme(d.fecha, idioma);
  const ms = d.partidos.filter((m) => m.season === S.no).sort((a, b) => a.no - b.no);
  const jugados = lgPlayed(ms);
  const nulos = ms.length - jugados.length;
  const nombreTorneo = d.titulo || String(L.name || '') || tx('torneo.sinNombre');
  const titulo = tx('torneo.titulo', { nombre: nombreTorneo, no: S.no });
  const archivo = nombreArchivo(titulo, f.fecha);
  const fmt = S.fmt;
  const colores = new Map(S.entrants.map((e) => [e.name, e.color]));
  const col = (/** @type {string} */ n) => color(colores.get(n));
  const filas = lgStandings(S, ms);
  const terminada = lgSeasonDone(S, ms);
  const campeon = terminada ? lgSeasonChampion(S, ms) : null;
  const koth = fmt.format === 'koth' ? lgKothState(S, ms) : null;
  const suizo = fmt.format === 'swiss';

  // ---- Elo ----
  const elo = eloPorPartido(S, ms);
  const mejores = [...elo.series.entries()]
    .sort((a, b) => b[1][b[1].length - 1] - a[1][a[1].length - 1])
    .slice(0, MAX_ELO);
  const figElo =
    elo.x.length > 1
      ? `<figure id="fig-elo">${lineas({
          ancho: ANCHO_HOJA,
          alto: 220,
          etiqueta: tx('torneo.fig.elo'),
          fmtX: (x) => num(x, 0),
          fmtY: (y) => num(y, 0),
          x: elo.x,
          yCero: false,
          series: mejores.map(([n, v]) => ({ valores: v, color: col(n) })),
        })}${leyenda(mejores.map(([n]) => ({ nombre: n, color: col(n) })))}<figcaption class="cap"><strong>${esc(
          tx('fig.titulo', { n: 1 }),
        )}</strong> ${esc(tx('torneo.fig.eloCap', { n: mejores.length, total: elo.series.size }))}</figcaption></figure>`
      : '';

  // ---- resumen (hallazgos simples) ----
  const frases = [];
  /** @param {string} texto @param {string} destino @param {string} ref @param {string} c */
  const frase = (texto, destino, ref, c) =>
    `<p class="find"><span class="sw" style="background:${color(c)}"></span><span>${esc(texto)} <a href="#${destino}">${esc(ref)}</a></span></p>`;
  if (campeon) {
    frases.push(
      frase(
        tx('torneo.hallazgo.campeon', {
          nombre: campeon.name,
          como: tx(`torneo.como.${campeon.how}`),
        }),
        'tabla',
        tx('torneo.ref.tabla'),
        col(campeon.name),
      ),
    );
  } else if (filas.length && filas[0].p > 0) {
    frases.push(
      frase(
        tx('torneo.hallazgo.lider', { nombre: filas[0].name, w: filas[0].w, p: filas[0].p }),
        'tabla',
        tx('torneo.ref.tabla'),
        col(filas[0].name),
      ),
    );
  }
  if (figElo && mejores.length) {
    const [n, v] = mejores[0];
    const lider = campeon?.name ?? (filas[0]?.p > 0 ? filas[0].name : '');
    if (n !== lider && v[v.length - 1] !== LG_ELO0)
      frases.push(
        frase(
          tx('torneo.hallazgo.elo', { nombre: n, elo: Math.round(v[v.length - 1]) }),
          'fig-elo',
          tx('fig.ref', { n: 1 }),
          col(n),
        ),
      );
  }
  const rondas = jugados.reduce(
    (a, m) => a + (m.rounds || (m.wins ?? []).reduce((x, y) => x + y, 0)),
    0,
  );
  const porTope = jugados.reduce((a, m) => a + (m.capRounds || 0), 0);
  if (rondas > 0 && porTope / rondas >= 0.25)
    frases.push(
      frase(
        tx('torneo.hallazgo.tope', {
          pct: Math.round((porTope / rondas) * 100),
          n: porTope,
          rondas,
        }),
        'partidos',
        tx('torneo.ref.partidos'),
        '#6b6962',
      ),
    );
  if (nulos > 0)
    frases.push(
      frase(
        tx('torneo.hallazgo.nulos', { n: nulos }),
        'partidos',
        tx('torneo.ref.partidos'),
        '#6b6962',
      ),
    );

  // ---- portada ----
  const cab = [];
  const meta = [
    textoFormatoInforme(fmt, tr, S.entrants.length),
    tx('torneo.meta.temporada', { no: S.no, de: L.seasons.length }),
    tx('torneo.meta.participantes', { n: S.entrants.length }),
  ];
  if (f.texto) meta.push(tx('meta.generado', { fecha: f.texto }));
  cab.push(
    `<header class="cab"><span class="kicker">${esc(tx('informe.torneo'))}</span><h1>${esc(titulo)}</h1><div class="meta">${esc(meta.join(' · '))}</div></header>`,
  );
  if (frases.length)
    cab.push(
      `<section class="resumen"><span class="kicker">${esc(tx('resumen.titulo'))}</span>${frases.join('')}<p class="cap">${esc(tx('torneo.resumenNota'))}</p></section>`,
    );
  const ciclosProm = jugados.length
    ? jugados.reduce((a, m) => a + (m.cycles || 0), 0) / jugados.length
    : Number.NaN;
  cab.push(
    `<section class="kpis">${[
      [num(S.entrants.length, 0), tx('torneo.kpi.participantes', { n: S.entrants.length })],
      [num(jugados.length, 0), tx('torneo.kpi.partidos', { n: jugados.length })],
      [num(nulos, 0), tx('torneo.kpi.nulos', { n: nulos })],
      [Number.isFinite(ciclosProm) ? num(ciclosProm, 0) : '—', tx('torneo.kpi.ciclos')],
    ]
      .map(([v, l]) => `<div class="tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`)
      .join('')}</section>`,
  );

  const secciones = [];
  let nSec = 0;

  // ---- 1. Tabla ----
  {
    const cabT = [
      '#',
      tx('col.bot'),
      ...(suizo ? [tx('torneo.col.pts'), tx('torneo.col.bh')] : []),
      tx('torneo.col.pj'),
      tx('torneo.col.g'),
      tx('torneo.col.p'),
      '%',
      ...(koth ? ['👑'] : []),
      tx('torneo.col.tope'),
      tx('torneo.col.ciclos'),
      'Elo',
    ];
    const cuerpo = filas.length
      ? tabla(
          cabT,
          filas.map((r, i) => [
            esc(num(i + 1, 0)),
            `${campeon?.name === r.name ? '🏆 ' : ''}${conColor(r.name, r.color)}`,
            ...(suizo
              ? [
                  esc(r.pts === undefined ? '' : num(r.pts, 1)),
                  esc(r.bh === undefined ? '' : num(r.bh, 1)),
                ]
              : []),
            esc(num(r.p, 0)),
            esc(num(r.w, 0)),
            esc(num(r.p - r.w, 0)),
            esc(r.p ? num(Math.round((r.w / r.p) * 100), 0) : '–'),
            ...(koth ? [esc(String(koth.titles.get(r.name) || ''))] : []),
            esc(r.rounds ? `${num(Math.round((r.capR / r.rounds) * 100), 0)} %` : ''),
            esc(r.p ? num(Math.round(r.cyc / r.p), 0) : ''),
            esc(num(Math.round(r.elo), 0)),
          ]),
        )
      : `<p class="cap">${esc(tx('torneo.sinParticipantes'))}</p>`;
    secciones.push(
      seccion(
        tx('torneo.sec.tabla'),
        `<div id="tabla">${cuerpo}</div><p class="cap">${esc(tx(`torneo.desempate.${suizo ? 'swiss' : fmt.format === 'cup' ? 'cup' : fmt.format === 'ladder' ? 'ladder' : fmt.format === 'rr' ? 'rr' : 'elo'}`))}</p>`,
        ++nSec,
      ),
    );
  }

  // ---- 2. Estructura del formato ----
  {
    const partes = [];
    /** @param {string} a @param {string} b @param {string} w */
    const cruce = (a, b, w) => [
      a ? conColor(a, col(a)) : '—',
      b ? conColor(b, col(b)) : '—',
      w ? esc(w) : esc(tx('torneo.pendiente')),
    ];
    if (suizo) {
      const st = lgSwissState(S, ms);
      if (st.phase === 'draw')
        partes.push(`<p class="cap">${esc(tx('torneo.suizoSinSorteo'))}</p>`);
      for (const rd of st.history) {
        partes.push(`<h3>${esc(tx('torneo.suizoRonda', { no: rd.no, de: st.rounds }))}</h3>`);
        partes.push(
          tabla(
            [tx('torneo.col.a'), tx('torneo.col.b'), tx('torneo.col.ganador')],
            rd.pairs.map((/** @type {any} */ t) => cruce(t.a, t.b, t.winner ?? '')),
            [1, 2],
          ),
        );
        if (rd.bye) partes.push(`<p class="cap">${esc(tx('torneo.bye', { nombre: rd.bye }))}</p>`);
      }
    } else if (fmt.format === 'cup') {
      if (!lgCupSizeOk(S))
        partes.push(`<p class="cap">${esc(tx('torneo.copaTamano', { n: S.entrants.length }))}</p>`);
      else if (!lgCupGroupsOk(S))
        partes.push(`<p class="cap">${esc(tx('torneo.copaSinSorteo'))}</p>`);
      else {
        const st = lgCupState(S, ms);
        partes.push(`<h3>${esc(tx('torneo.grupos'))}</h3><div class="dos">`);
        for (const g of st.groups)
          partes.push(
            `<div><p class="p"><strong>${esc(tx('torneo.grupo', { g: g.name }))}</strong></p>${tabla(
              ['#', tx('col.bot'), tx('torneo.col.pj'), tx('torneo.col.g'), 'Elo'],
              g.rows.map((/** @type {any} */ r, /** @type {number} */ i) => [
                esc(num(i + 1, 0)),
                conColor(r.name, r.color),
                esc(num(r.p, 0)),
                esc(num(r.w, 0)),
                esc(num(Math.round(r.elo), 0)),
              ]),
            )}</div>`,
          );
        partes.push('</div>');
        if (st.bracket.length) {
          partes.push(`<h3>${esc(tx('torneo.cuadro'))}</h3>`);
          const filasC = [];
          for (const ties of st.bracket)
            for (const t of ties)
              filasC.push([esc(nombreRonda(ties.length, tr)), ...cruce(t.a, t.b, t.winner ?? '')]);
          if (st.third)
            filasC.push([
              esc(tx('torneo.tercero')),
              ...cruce(st.third.a, st.third.b, st.third.winner ?? ''),
            ]);
          partes.push(
            tabla(
              [
                tx('torneo.col.ronda'),
                tx('torneo.col.a'),
                tx('torneo.col.b'),
                tx('torneo.col.ganador'),
              ],
              filasC,
              [1, 2, 3],
            ),
          );
        }
      }
    } else if (fmt.format === 'koth' && koth) {
      const coronas = [...koth.titles.entries()].sort((a, b) => b[1] - a[1]);
      partes.push(
        `<p class="p">${esc(
          koth.champ
            ? tx('torneo.rey', { nombre: koth.champ, n: koth.streak })
            : tx('torneo.sinRey'),
        )}</p>`,
      );
      if (coronas.length)
        partes.push(
          tabla(
            [tx('col.bot'), tx('torneo.col.coronas')],
            coronas.map(([n, c]) => [conColor(n, col(n)), esc(num(c, 0))]),
          ),
        );
    } else if (fmt.format === 'ladder') {
      const st = lgLadderState(S, ms);
      partes.push(
        tabla(
          [tx('torneo.col.peldano'), tx('col.bot')],
          st.ladder.map((n, i) => [esc(num(i + 1, 0)), conColor(n, col(n))]),
        ),
      );
      if (st.next)
        partes.push(
          `<p class="cap">${esc(tx('torneo.escaleraSigue', { aspirante: st.next[1].name, rival: st.next[0].name }))}</p>`,
        );
    } else if (fmt.format === 'rr' && S.entrants.length >= 2) {
      const E = S.entrants;
      const enDia = Math.max(1, Math.floor(E.length / 2));
      /** @type {Map<string, Match[]>} */
      const porPar = new Map();
      for (const m of jugados) {
        if (m.fighters.length !== 2) continue;
        const k = lgPairKey(m.fighters[0], m.fighters[1]);
        porPar.set(k, [...(porPar.get(k) ?? []), m]);
      }
      partes.push(
        tabla(
          [
            tx('torneo.col.jornada'),
            tx('torneo.col.a'),
            tx('torneo.col.b'),
            tx('torneo.col.ganador'),
          ],
          lgRrFixtures(E.length, fmt.legs).map((x, i) => {
            const a = E[x.pair[0]].name;
            const b = E[x.pair[1]].name;
            const m = (porPar.get(lgPairKey(a, b)) ?? [])[x.leg - 1];
            return [esc(num(Math.floor(i / enDia) + 1, 0)), ...cruce(a, b, m?.winner ?? '')];
          }),
          [1, 2, 3],
        ),
      );
    }
    if (partes.length)
      secciones.push(seccion(tx(`torneo.sec.estructura.${fmt.format}`), partes.join(''), ++nSec));
  }

  // ---- 3. Elo ----
  secciones.push(
    seccion(
      tx('torneo.sec.elo'),
      figElo || `<p class="cap">${esc(tx('torneo.sinPartidos'))}</p>`,
      ++nSec,
      true,
    ),
  );

  // ---- 4. Partidos ----
  {
    const cuerpo = ms.length
      ? tabla(
          [
            '#',
            tx('torneo.col.luchadores'),
            tx('torneo.col.ganador'),
            tx('torneo.col.ciclos'),
            tx('torneo.col.tope'),
            tx('torneo.col.semilla'),
          ],
          ms.map((m) => [
            esc(num(m.no, 0)),
            m.fighters
              .map(
                (n, i) =>
                  `${conColor(n, col(n))}${m.wins?.[i] ? ` <span class="mono">${esc(num(m.wins[i], 0))}</span>` : ''}`,
              )
              .join(' · '),
            m.winner ? esc(m.winner) : esc(tx('torneo.nulo')),
            esc(num(m.cycles || 0, 0)),
            esc(m.capRounds ? num(m.capRounds, 0) : ''),
            `<span class="mono">${esc(String(m.seed ?? ''))}</span>`,
          ]),
          [1, 2],
        )
      : `<p class="cap">${esc(tx('torneo.sinPartidos'))}</p>`;
    secciones.push(
      seccion(
        tx('torneo.sec.partidos'),
        `<div id="partidos">${cuerpo}</div><p class="cap">${esc(tx('torneo.partidosNota'))}</p>`,
        ++nSec,
      ),
    );
  }

  // ---- 5. Reglas ----
  {
    const r = /** @type {any} */ (S.rules);
    const partes = [];
    if (r?.escenario && typeof r.escenario === 'object') {
      const e = r.escenario;
      const nombre =
        typeof e.nombre === 'string' ? e.nombre : String(e.nombre?.[idioma] || e.nombre?.es || '');
      const base = String(
        /** @type {any} */ (BASES)[e.opciones?.base]?.[idioma] ?? e.opciones?.base ?? '',
      );
      const nc = Object.keys(e.opciones?.cambios ?? {}).length;
      partes.push(`<p class="p">${esc(tx('torneo.reglas.escenario', { nombre }))}</p>`);
      partes.push(
        `<p class="p">${esc(`${tx('conf.base', { base })} ${nc ? tx('conf.cambios', { n: nc }) : tx('conf.sinCambios')}`)}</p>`,
      );
    } else partes.push(`<p class="p">${esc(tx('torneo.reglas.clasica'))}</p>`);
    const valores = [
      [tx('torneo.val.qty'), num(fmt.qty, 0)],
      [tx('torneo.val.nrg'), num(fmt.nrg, 0)],
      [tx('torneo.val.rounds'), num(fmt.rounds, 0)],
      [tx('torneo.val.wins'), fmt.wins ? num(fmt.wins, 0) : tx('torneo.val.apagado')],
      [
        tx('torneo.val.cap'),
        fmt.cap
          ? `${num(fmt.cap, 0)} · ${tx(fmt.capMode === 'nrg' ? 'torneo.val.capNrg' : 'torneo.val.capPop')}`
          : tx('torneo.val.apagado'),
      ],
      [tx('torneo.val.popCap'), fmt.popCap ? num(fmt.popCap, 0) : tx('torneo.val.apagado')],
    ];
    partes.push(
      tabla(
        [tx('torneo.col.valor'), ''],
        valores.map(([a, b]) => [esc(a), esc(b)]),
      ),
    );
    secciones.push(seccion(tx('torneo.sec.reglas'), partes.join(''), ++nSec));
  }

  const pie = `<footer class="pie"><span>${esc(tx('pie.torneo', { partidos: ms.length, series: elo.series.size }))}</span><span class="mono">${esc(tx('pie.firma', { fecha: f.texto }))}</span></footer>`;

  const datos = {
    formato: 1,
    tipo: 'torneo',
    idioma,
    titulo,
    fecha: f.iso,
    torneo: {
      nombre: nombreTorneo,
      temporada: S.no,
      temporadas: L.seasons.length,
      formato: { ...fmt },
      reglas: S.rules ?? null,
      participantes: S.entrants.map((e) => ({
        name: e.name,
        hash: e.hash,
        color: color(e.color),
        src: e.src,
        ...(e.qty ? { qty: e.qty } : {}),
      })),
      terminada,
      campeon: campeon ?? null,
    },
    tabla: filas.map((r) => ({
      name: r.name,
      p: r.p,
      w: r.w,
      elo: redondo(r.elo),
      ciclos: r.cyc,
      rondasTope: r.capR,
      rondas: r.rounds,
      ...(suizo ? { pts: r.pts ?? null, bh: r.bh ?? null } : {}),
    })),
    partidos: ms.map((m) => ({
      no: m.no,
      fighters: m.fighters,
      winner: m.winner,
      wins: m.wins ?? [],
      cycles: m.cycles ?? 0,
      capRounds: m.capRounds ?? 0,
      seed: m.seed ?? null,
      note: m.note ?? '',
      date: m.date ?? '',
    })),
    t: elo.x,
    series: [...elo.series.entries()].map(([n, v]) => ({
      metrica: 'elo',
      especie: n,
      media: v.map(redondo),
    })),
  };
  const html = documento({
    idioma,
    titulo: `${tx('informe.torneo')} · ${titulo}`,
    archivo,
    cuerpo: [...cab, ...secciones, pie].join('\n'),
    datos,
    barra: { imprimir: tx('barra.imprimir'), json: tx('barra.json'), csv: tx('barra.csv') },
  });
  return { html, archivo, datos };
}

/** Nombre de la ronda del cuadro con n cruces. @param {number} n @param {Traductor} tr */
function nombreRonda(n, tr) {
  if (n === 1) return tr.tx('torneo.final');
  if (n === 2) return tr.tx('torneo.semi');
  if (n === 4) return tr.tx('torneo.cuartos');
  return tr.tx('torneo.rondaDe', { n: 2 * n });
}
