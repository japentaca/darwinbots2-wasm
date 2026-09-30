// @ts-check
// Datos de las vistas de un torneo (decisión 22, paso N3.5), puros: la
// Tabla (Elo, % de rondas ganadas por el tope, ciclos promedio, desempates,
// últimos resultados), la estructura según el formato (calendario del todos
// contra todos, peleas y coronas de la colina, escalera, rondas del suizo,
// grupos y cuadro de la copa), los Partidos, los enfrentamientos directos,
// el resumen de las reglas (escenario o foto de la clásica) y las
// temporadas. Todo sale de engine/league.js; aquí solo se ordena para
// mostrar.

import {
  LG_CUP_GROUP,
  LG_H2H_MAX,
  lgCupGroupsOk,
  lgCupLetter,
  lgCupSizeOk,
  lgCupState,
  lgH2H,
  lgKothEndless,
  lgKothState,
  lgLadderState,
  lgPairKey,
  lgPlayed,
  lgRrFixtures,
  lgSeasonChampion,
  lgSeasonDone,
  lgStandings,
  lgSwissState,
} from '../../../engine/league.js';
import { BASES, parametro, valoresResueltos } from '../../../engine/opciones.js';
import { reglasAOpciones } from '../../../engine/partido.js';
import {
  cambiosDeOpciones,
  esReglasEscenario,
  opcionesBaseClasica,
} from '../../../engine/rondas.js';

/**
 * @typedef {import('../../../engine/league.js').Season} Season
 * @typedef {import('../../../engine/league.js').Match} Match
 * @typedef {import('../../../engine/league.js').League} League
 */

/** Cuántos resultados recientes muestra la Tabla. */
export const ULTIMOS = 3;

/**
 * Filas de la Tabla de una temporada (lgStandings) con lo que pide el
 * boceto: puesto, puntos y Buchholz (suizo), coronas (colina), % de las
 * rondas ganadas que decidió el tope de ciclos, ciclos promedio por
 * partido, campeón y los últimos resultados ('G' | 'P', del más viejo al
 * más nuevo).
 * @param {Season} S @param {Match[]} ms  partidos de la temporada
 */
export function filasTabla(S, ms) {
  const rows = lgStandings(S, ms);
  const koth = S.fmt.format === 'koth' ? lgKothState(S, ms) : null;
  const champ = lgSeasonChampion(S, ms);
  const jugados = lgPlayed(ms)
    .slice()
    .sort((a, b) => a.no - b.no);
  return rows.map((r, i) => {
    const mios = jugados.filter((m) => m.fighters.includes(r.name));
    return {
      puesto: i + 1,
      name: r.name,
      color: r.color,
      p: r.p,
      w: r.w,
      l: r.p - r.w,
      pct: r.p ? Math.round((r.w / r.p) * 100) : null,
      pts: r.pts,
      bh: r.bh,
      byes: r.byes ?? 0,
      elo: Math.round(r.elo),
      coronas: koth ? koth.titles.get(r.name) || 0 : null,
      porTope: r.rounds ? Math.round((r.capR / r.rounds) * 100) : null,
      ciclos: r.p ? Math.round(r.cyc / r.p) : null,
      campeon: !!champ && champ.name === r.name,
      ultimos: mios.slice(-ULTIMOS).map((m) => (m.winner === r.name ? 'G' : 'P')),
    };
  });
}

/**
 * Clave del texto de desempate de la Tabla según el formato.
 * @param {Record<string, any>} f
 */
export function claveDesempate(f) {
  if (f.format === 'swiss') return 'competir.tabla.desempate.swiss';
  if (f.format === 'cup') return 'competir.tabla.desempate.cup';
  if (f.format === 'ladder') return 'competir.tabla.desempate.ladder';
  if (f.format === 'rr') return 'competir.tabla.desempate.rr';
  if (lgKothEndless(f)) return 'competir.tabla.desempate.kothSinFin';
  return 'competir.tabla.desempate.elo';
}

/**
 * Enfrentamientos directos (lgH2HHtml): null si hay menos de 2 o más de
 * LG_H2H_MAX participantes; si no, {nombres, celdas[i][j] = {a, b} | null}.
 * @param {Season} S @param {Match[]} ms
 */
export function matrizH2H(S, ms) {
  const rows = lgStandings(S, ms);
  if (rows.length < 2 || rows.length > LG_H2H_MAX) return null;
  const w = lgH2H(ms);
  return {
    filas: rows.map((r) => ({ name: r.name, color: r.color })),
    celdas: rows.map((a) =>
      rows.map((b) => {
        if (a === b) return null;
        const x = w(a.name, b.name);
        const y = w(b.name, a.name);
        return x || y ? { a: x, b: y } : { a: 0, b: 0, vacio: true };
      }),
    ),
  };
}

/**
 * Filas de Partidos (del más nuevo al más viejo): lo que guarda cada uno.
 * @param {Match[]} ms
 */
export function filasPartidos(ms) {
  return ms
    .slice()
    .sort((a, b) => b.season - a.season || b.no - a.no)
    .map((m) => ({
      id: m.id,
      no: m.no,
      season: m.season,
      fighters: m.fighters,
      wins: m.wins ?? [],
      winner: m.winner,
      cycles: m.cycles || 0,
      capRounds: m.capRounds || 0,
      rounds: m.rounds || (m.wins ?? []).reduce((a, b) => a + b, 0),
      seed: m.seed,
      note: m.note || '',
      ronda: /** @type {any} */ (m).ronda ?? null,
    }));
}

/**
 * Calendario del todos contra todos por jornadas (método del círculo):
 * [{jornada, partidos: [{a, b, leg, winner, id, no}]}].
 * @param {Season} S @param {Match[]} ms
 */
export function calendarioRr(S, ms) {
  const E = S.entrants;
  const n = E.length;
  if (n < 2) return [];
  const fx = lgRrFixtures(n, S.fmt.legs);
  // cada jornada del círculo tiene floor(n/2) partidos reales (con n impar, uno descansa)
  const enDia = Math.max(1, Math.floor(n / 2));
  // los partidos jugados de cada par, en orden, para repartirlos por vuelta
  /** @type {Map<string, Match[]>} */
  const jugados = new Map();
  for (const m of lgPlayed(ms)
    .slice()
    .sort((a, b) => a.no - b.no)) {
    if (m.fighters.length !== 2) continue;
    const k = lgPairKey(m.fighters[0], m.fighters[1]);
    const l = jugados.get(k) ?? [];
    l.push(m);
    jugados.set(k, l);
  }
  /** @type {{jornada: number, partidos: any[]}[]} */
  const dias = [];
  fx.forEach((f, i) => {
    const d = Math.floor(i / enDia);
    if (!dias[d]) dias[d] = { jornada: d + 1, partidos: [] };
    const a = E[f.pair[0]].name;
    const b = E[f.pair[1]].name;
    const m = (jugados.get(lgPairKey(a, b)) ?? [])[f.leg - 1];
    dias[d].partidos.push({ a, b, leg: f.leg, winner: m?.winner ?? '', id: m?.id, no: m?.no });
  });
  return dias;
}

/**
 * Peleas de la colina en orden con el rey y su racha después de cada una,
 * y las coronas (retiros invictos).
 * @param {Season} S @param {Match[]} ms
 */
export function peleasColina(S, ms) {
  /** @type {string | null} */
  let champ = null;
  let streak = 0;
  const peleas = [];
  for (const m of ms.slice().sort((a, b) => a.no - b.no)) {
    let corona = false;
    if (m.winner) {
      if (champ === m.winner) streak++;
      else {
        champ = m.winner;
        streak = 1;
      }
      if (S.fmt.retire > 0 && streak >= S.fmt.retire) {
        corona = true;
      }
    }
    peleas.push({
      id: m.id,
      no: m.no,
      fighters: m.fighters,
      winner: m.winner,
      racha: m.winner ? streak : 0,
      corona,
      note: m.note || '',
    });
    if (corona) {
      champ = null;
      streak = 0;
    }
  }
  const st = lgKothState(S, ms);
  return {
    peleas: peleas.reverse(),
    rey: st.champ,
    racha: st.streak,
    coronas: [...st.titles.entries()].sort((a, b) => b[1] - a[1]),
    primero: st.first,
  };
}

/**
 * La escalera: peldaños (del 1 hacia abajo), el próximo desafío y los que
 * todavía no entraron.
 * @param {Season} S @param {Match[]} ms
 */
export function escalera(S, ms) {
  const st = lgLadderState(S, ms);
  const dentro = new Set(st.ladder);
  return {
    peldaños: st.ladder,
    siguiente: st.next
      ? { rival: st.next[0].name, aspirante: st.next[1].name, peldaño: st.rung }
      : null,
    esperan: S.entrants.filter((e) => !dentro.has(e.name)).map((e) => e.name),
    colocados: st.placed,
    total: st.total,
  };
}

/**
 * Rondas del suizo (lgSwissState): la historia en orden, con el número de
 * la ronda en curso y el cruce que sigue.
 * @param {Season} S @param {Match[]} ms
 */
export function rondasSuizo(S, ms) {
  const st = lgSwissState(S, ms);
  return {
    fase: st.phase,
    ronda: st.round,
    rondas: st.rounds,
    historia: st.history.map((/** @type {any} */ rd) => ({
      no: rd.no,
      bye: rd.bye,
      pares: rd.pairs.map((/** @type {any} */ t) => ({
        a: t.a,
        b: t.b,
        winner: t.winner ?? '',
        id: t.id,
        no: t.no,
      })),
    })),
    siguiente: st.next ? lgPairKey(st.next[0].name, st.next[1].name) : '',
    esperan: S.entrants.length - st.field.length,
  };
}

/**
 * La copa (lgCupState): grupos con su tabla y sus partidos por jornada y el
 * cuadro con las rondas por jugar (puestos 1A, 2B… mientras no se sabe y
 * los ganadores que ya se conocen), como el cuadro de la clásica.
 * @param {Season} S @param {Match[]} ms
 */
export function copa(S, ms) {
  if (!lgCupSizeOk(S)) return { estado: 'tamano', n: S.entrants.length };
  if (!lgCupGroupsOk(S)) return { estado: 'sinSorteo' };
  const st = lgCupState(S, ms);
  const G = /** @type {string[][]} */ (S.groups).length;
  const primera = st.bracket[0] || [];
  /** @type {any[]} */
  let ronda = [];
  for (let k = 0; k < G; k++) {
    const arriba = k < G / 2;
    const gi = 2 * (arriba ? k : k - G / 2);
    const [a, b] = arriba ? [gi, gi + 1] : [gi + 1, gi];
    ronda.push(primera[k] || { pa: `1${lgCupLetter(a)}`, pb: `2${lgCupLetter(b)}` });
  }
  const rondas = [ronda];
  while (ronda.length > 1) {
    const r = rondas.length;
    const nx = [];
    for (let k = 0; k < ronda.length; k += 2)
      nx.push(st.bracket[r]?.[k / 2] || { a: ronda[k].winner, b: ronda[k + 1].winner });
    rondas.push(nx);
    ronda = nx;
  }
  const sig = st.next ? lgPairKey(st.next[0].name, st.next[1].name) : '';
  return {
    estado: st.phase,
    grupos: st.groups.map((/** @type {any} */ g, /** @type {number} */ gi) => ({
      nombre: g.name,
      filas: g.rows.map((/** @type {any} */ r) => ({
        name: r.name,
        color: r.color,
        p: r.p,
        w: r.w,
        elo: Math.round(r.elo),
      })),
      partidos: st.fixtures
        .filter((/** @type {any} */ f) => f.gi === gi)
        .map((/** @type {any} */ f) => ({
          day: f.day,
          a: f.a,
          b: f.b,
          winner: f.winner ?? '',
          id: f.id,
          no: f.no,
        })),
    })),
    cuadro: rondas.map((r) =>
      r.map((/** @type {any} */ t) => ({
        a: t.a ?? '',
        b: t.b ?? '',
        pa: t.pa ?? '',
        pb: t.pb ?? '',
        winner: t.winner ?? '',
        id: t.id,
        no: t.no,
      })),
    ),
    tercero: S.fmt.third
      ? {
          a: st.third?.a ?? '',
          b: st.third?.b ?? '',
          winner: st.third?.winner ?? '',
          id: st.third?.id,
          no: st.third?.no,
        }
      : null,
    siguiente: sig,
    campeon: st.champion,
    porGrupo: LG_CUP_GROUP,
  };
}

/**
 * Nombre de la vista de estructura del formato (null: el partido único no tiene).
 * @param {string} formato
 */
export function vistaEstructura(formato) {
  return (
    /** @type {Record<string, string>} */ ({
      swiss: 'rondas',
      cup: 'copa',
      koth: 'colina',
      ladder: 'escalera',
      rr: 'calendario',
    })[formato] ?? null
  );
}

/**
 * Resumen de las reglas del mundo de una temporada: la base y los cambios
 * sobre ella (en las reglas-escenario, los del escenario; en una foto de
 * la clásica, lo que difiere de su panel sin tocar, sin el modo de juego
 * que fija el partido). error: clave del error si la foto no se puede leer.
 * @param {any} rules
 */
export function resumenReglas(rules) {
  const MODO_F1 = new Set(['opt:90', 'opt:91', 'opt:97', 'opt:98', 'opt:99', 'opt:100', 'opt:101']);
  if (esReglasEscenario(rules)) {
    const e = rules.escenario;
    return {
      origen: 'escenario',
      id: e.id,
      nombre: e.nombre,
      base: e.opciones?.base ?? 'f1',
      cambios: Object.entries(e.opciones?.cambios ?? {}),
      obstaculos: e.objetos?.obstaculos?.length ?? 0,
      teleporters: e.objetos?.teleporters?.length ?? 0,
      error: '',
      errorParams: {},
    };
  }
  try {
    const todo = cambiosDeOpciones(reglasAOpciones(rules || {}, opcionesBaseClasica()));
    const base = valoresResueltos('clasica');
    const cambios = Object.entries(todo).filter(
      ([k, v]) =>
        !MODO_F1.has(k) && k in base && Number(/** @type {any} */ (base)[k]) !== Number(v),
    );
    return {
      origen: 'clasica',
      id: '',
      nombre: '',
      base: 'clasica',
      cambios,
      obstaculos: 0,
      teleporters: 0,
      error: '',
      errorParams: {},
    };
  } catch (e) {
    return {
      origen: 'clasica',
      id: '',
      nombre: '',
      base: 'clasica',
      cambios: [],
      obstaculos: 0,
      teleporters: 0,
      error: String(/** @type {any} */ (e)?.clave ?? 'rule-unknown'),
      errorParams: /** @type {any} */ (e)?.params ?? {},
    };
  }
}

/**
 * Nombre y valor de un parámetro para el resumen de reglas (catálogo de
 * engine/opciones.js: el nombre y los enum son datos es/en del catálogo).
 * @param {string} clave @param {number} v @param {'es' | 'en'} idioma
 */
export function parametroVisible(clave, v, idioma) {
  const p = parametro(clave);
  const nombre = p ? p[idioma] : clave;
  let valor = String(v);
  if (p?.valor === 'enum') {
    const e = p.valores?.find((o) => o.v === Number(v));
    if (e) valor = e[idioma];
  } else if (p?.valor === 'bool') valor = Number(v) ? 'si' : 'no';
  return { nombre, valor, bool: p?.valor === 'bool', variable: p?.variable ?? '' };
}

/** Nombre de una base de opciones en el idioma. @param {string} id @param {'es' | 'en'} idioma */
export const nombreBase = (id, idioma) => /** @type {any} */ (BASES)[id]?.[idioma] ?? id;

/**
 * Las temporadas de un torneo para el historial: número, formato, partidos
 * jugados, participantes, si terminó y su campeón.
 * @param {League} L @param {Match[]} matches  partidos del torneo
 */
export function temporadas(L, matches) {
  return L.seasons
    .map((S) => {
      const ms = matches.filter((m) => m.season === S.no).sort((a, b) => a.no - b.no);
      return {
        no: S.no,
        fmt: S.fmt,
        started: S.started ?? '',
        entrants: S.entrants.length,
        partidos: lgPlayed(ms).length,
        nulos: ms.length - lgPlayed(ms).length,
        terminada: lgSeasonDone(S, ms),
        campeon: lgSeasonChampion(S, ms),
      };
    })
    .reverse();
}

/**
 * El último partido jugado (el de número más alto de la temporada más nueva).
 * @param {Match[]} ms
 */
export function ultimoPartido(ms) {
  let u = null;
  for (const m of ms)
    if (!u || m.season > u.season || (m.season === u.season && m.no > u.no)) u = m;
  return u;
}
