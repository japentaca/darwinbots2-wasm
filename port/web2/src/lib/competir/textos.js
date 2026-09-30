// @ts-check
// Textos de Competir (paso N3.5, puro): las claves que devuelven
// engine/{league,torneos,rondas,partido}.js ({clave, params}) → texto con
// t() (src/i18n/{es,en}/competir.json, prefijo `competir.`). Cada función
// recibe el traductor `tr = {t, num}` (en la página: t y num de
// src/i18n/index.svelte.js; en los tests, uno armado con los .json), así
// se puede componer (un rótulo dentro de una nota) y probar sin DOM.
//
// Listas de claves (para el test que verifica que TODAS las que puede
// devolver el motor tienen texto en es y en):
//   CLAVES_NOTA      notas de torneos.js (lgNote)
//   CLAVES_LOG       registro de torneos.js (log)
//   CLAVES_ROTULO    rótulos de las peleas (league.js ROTULOS)
//   CLAVES_PROGRESO  lgProgress
//   CLAVES_SORTEO    lgDrawHint
//   CLAVES_ERROR     ErrorLiga (league.js, partido.js, torneos.js, rondas.js) + 'bad-json'
//   CLAVES_TV        lgEdition / lgTvNext
//   LG_HOWS          cómo se ganó una temporada (league.js)
// Textos guardados en los archivos por compatibilidad (los nombres 'League',
// 'Scratch', ' (imported)', 'Tournament N' y las notas de nulo NOTA_*) se
// traducen por valor: nombreTorneo() y notaNulo().

import { LG_HOWS, LG_NOMBRES, LG_SCRATCH_ID, lgSwissRounds } from '../../../engine/league.js';
import { contestRule, NOTA_CENSO_VACIO, NOTA_UNA_ESPECIE } from '../../../engine/partido.js';

/**
 * @typedef {{t: (clave: string, params?: Record<string, string | number>) => string,
 *   num: (n: number) => string}} Tr
 * @typedef {{clave: string, params?: Record<string, any>}} Rotulo
 */

export const CLAVES_NOTA = Object.freeze([
  'preparing',
  'fixture',
  'drawing',
  'season-complete',
  'pool-short',
  'too-few',
  'cup-size',
  'cap-reached',
  'round-won',
  'match-won',
  'match-void',
  'abandoned',
  'replay-abandoned',
  'replay-missing',
  'replay-same',
  'replay-diff',
  'exported',
  'import-failed',
  'imported',
  'entrant-dup',
  'entrant-added',
  'entrants-added',
  'groups-locked',
  'groups-drawn',
  'scratch-cleared',
  'error',
  'round-running',
  'round-scratch',
  'entrant-played',
  'locked',
  'round-recorded',
]);

export const CLAVES_LOG = Object.freeze([
  'db-unavailable',
  'save-failed',
  'match-save-failed',
  'match-start',
  'match-won',
  'match-void',
  'replay-same',
  'replay-diff',
]);

export const CLAVES_ROTULO = Object.freeze([
  'single',
  'rr',
  'ladder',
  'cup-group',
  'cup-ko',
  'cup-third',
  'swiss',
  'koth',
  'replay',
]);

export const CLAVES_PROGRESO = Object.freeze([
  'complete',
  'rr',
  'ladder',
  'cup-size',
  'cup-draw',
  'cup-groups',
  'cup-ko',
  'swiss-draw',
  'swiss',
  'koth-endless',
  'koth',
  'not-played',
]);

export const CLAVES_SORTEO = Object.freeze([
  'cup',
  'next-season',
  'koth',
  'koth-endless',
  'ladder',
  'first-match',
]);

export const CLAVES_ERROR = Object.freeze([
  'not-league',
  'newer-version',
  'no-seasons',
  'season-incomplete',
  'entrant-no-dna',
  'no-dna',
  'no-options',
  'no-base-options',
  'bad-base',
  'deps-missing',
  'no-launcher',
  'match-running',
  'replay-missing',
  'rule-unknown',
  'round-bad',
  'round-running',
  'bad-json',
]);

export const CLAVES_TV = Object.freeze([
  'tv-pool-short',
  'tv-pool-few',
  'tv-cup-size',
  'tv-pool-fight',
  'round-running',
]);

/** Códigos de ErrorCola (engine/cola.js) con texto propio en Competir. */
export const CODIGOS_COLA = Object.freeze(['no-reintentable']);

/**
 * Códigos de ErrorAlmacen (engine/almacen.js) e ErrorInforme
 * (engine/report/) con texto propio en Competir (`competir.error.cod.<codigo>`).
 */
export const CODIGOS_ERROR = Object.freeze([
  'sin-indexeddb',
  'version-vieja',
  'store-fuera-de-tx',
  'falta-torneo',
  'tipo',
  'texto',
]);

/** Códigos de ErrorEscenario (engine/escenarios/index.js): `competir.error.escenario.<codigo>`. */
export const CODIGOS_ESCENARIO = Object.freeze(['invalido', 'semilla', 'sin-adn']);

/** Campos de compararRepeticion (partido.js). */
export const CAMPOS_DIFF = Object.freeze(['winner', 'wins', 'cycles']);

/** Formatos en el orden de la interfaz. */
export const FORMATOS = Object.freeze(['single', 'koth', 'rr', 'ladder', 'cup', 'swiss']);

export { LG_HOWS };

// ---- Nombres guardados ---------------------------------------------------------------

/**
 * Nombre visible de un torneo: el Scratch y los nombres por defecto de los
 * datos ('League', 'Tournament N', el sufijo ' (imported)') traducidos; el
 * resto tal cual (lo escribió el usuario).
 * @param {{id?: string, name?: string} | null | undefined} L @param {Tr} tr
 */
export function nombreTorneo(L, tr) {
  if (!L) return '';
  if (L.id === LG_SCRATCH_ID) return tr.t('competir.rapido.titulo');
  let n = String(L.name ?? '');
  let importado = false;
  while (n.endsWith(LG_NOMBRES.imported)) {
    n = n.slice(0, -LG_NOMBRES.imported.length);
    importado = true;
  }
  const m = /^(.*?)(?: (\d+))?$/.exec(n);
  let base = n;
  if (m) {
    const [, raiz, k] = m;
    if (raiz === LG_NOMBRES.league) base = tr.t('competir.nombre.league');
    else if (raiz === LG_NOMBRES.tournament && k)
      base = tr.t('competir.nombre.tournament', { n: k });
    else if (raiz === LG_NOMBRES.tournament) base = tr.t('competir.nombre.tournamentSolo');
    else base = n;
    if (raiz === LG_NOMBRES.league && k) base = `${base} ${k}`;
  }
  return importado ? tr.t('competir.nombre.importado', { nombre: base }) : base;
}

/**
 * Nota de un partido nulo (rec.note, guardada con el texto de la clásica
 * por compatibilidad): traducida por valor; otra nota, tal cual.
 * @param {string | undefined} nota @param {Tr} tr
 */
export function notaNulo(nota, tr) {
  if (nota === NOTA_CENSO_VACIO) return tr.t('competir.nulo.censo');
  if (nota === NOTA_UNA_ESPECIE) return tr.t('competir.nulo.una');
  return String(nota ?? '');
}

// ---- Rótulos ----------------------------------------------------------------------------

/**
 * Nombre de la ronda del cuadro con n cruces (cup-ko sin el número de partido).
 * @param {number} ties @param {Tr} tr
 */
export function nombreRondaCopa(ties, tr) {
  if (ties === 1) return tr.t('competir.rotulo.cup-ko.final');
  if (ties === 2) return tr.t('competir.rotulo.cup-ko.semi');
  if (ties === 4) return tr.t('competir.rotulo.cup-ko.cuartos');
  return tr.t('competir.rotulo.cup-ko.ronda', { n: tr.num(2 * ties) });
}

/**
 * Texto de un rótulo de pelea (lgFixture, lgCupState, lgSwissState,
 * partidosDeRonda, lgReplay).
 * @param {Rotulo | null | undefined} r @param {Tr} tr
 */
export function textoRotulo(r, tr) {
  if (!r) return '';
  const p = r.params ?? {};
  const n = (/** @type {any} */ x) => tr.num(Number(x) || 0);
  switch (r.clave) {
    case 'single':
      return p.total > p.n
        ? tr.t('competir.rotulo.single.parte', { n: n(p.n), total: n(p.total) })
        : tr.t('competir.rotulo.single', { n: n(p.n) });
    case 'rr':
      return tr.t('competir.rotulo.rr', { no: n(p.no), total: n(p.total) });
    case 'ladder':
      return tr.t('competir.rotulo.ladder', {
        challenger: String(p.challenger ?? ''),
        rung: n(p.rung),
        entrant: n(p.entrant),
        total: n(p.total),
      });
    case 'cup-group':
      return tr.t('competir.rotulo.cup-group', {
        group: String(p.group ?? ''),
        day: n(p.day),
        days: n(p.days),
      });
    case 'cup-ko': {
      const ronda = nombreRondaCopa(Number(p.ties) || 1, tr);
      return p.match > 0
        ? tr.t('competir.rotulo.cup-ko.partido', { ronda, match: n(p.match), ties: n(p.ties) })
        : ronda;
    }
    case 'cup-third':
      return tr.t('competir.rotulo.cup-third');
    case 'swiss': {
      const base = tr.t('competir.rotulo.swiss', {
        round: n(p.round),
        rounds: n(p.rounds),
        match: n(p.match),
        matches: n(p.matches),
      });
      return p.bye ? tr.t('competir.rotulo.swiss.bye', { base, bye: String(p.bye) }) : base;
    }
    case 'koth': {
      const quien = p.champ
        ? tr.t('competir.rotulo.koth.defiende', { champ: String(p.champ) })
        : tr.t('competir.rotulo.koth.abierta');
      return p.cap === null || p.cap === undefined
        ? tr.t('competir.rotulo.koth.pelea', { quien, fight: n(p.fight) })
        : tr.t('competir.rotulo.koth.peleaTope', { quien, fight: n(p.fight), cap: n(p.cap) });
    }
    case 'replay':
      return tr.t('competir.rotulo.replay', {
        no: n(p.no),
        season: n(p.season),
        seed: String(p.seed),
      });
    default:
      return r.clave;
  }
}

// ---- Errores ----------------------------------------------------------------------------

/**
 * Texto de un error: ErrorLiga ({clave, params}), ErrorEscenario (codigo y
 * errores), ErrorCola, ErrorAlmacen o ErrorInforme (codigo) o cualquier
 * Error (su mensaje: lo que no tiene código).
 * @param {any} e @param {Tr} tr
 */
export function textoError(e, tr) {
  if (!e) return '';
  if (typeof e.clave === 'string' && CLAVES_ERROR.includes(e.clave)) {
    const p = e.params ?? {};
    // una opción desconocida sin nombre: sin «()» vacío
    if (e.clave === 'rule-unknown' && !p.clave) return tr.t('competir.error.rule-unknown.sin');
    /** @type {Record<string, string | number>} */
    const q = {};
    for (const [k, v] of Object.entries(p)) q[k] = typeof v === 'number' ? tr.num(v) : String(v);
    return tr.t(`competir.error.${e.clave}`, q);
  }
  if (typeof e.codigo === 'string' && CODIGOS_COLA.includes(e.codigo))
    return tr.t(`competir.error.${e.codigo}`);
  if (e.name === 'ErrorEscenario' || (Array.isArray(e.errores) && typeof e.codigo === 'string')) {
    const errores = Array.isArray(e.errores) ? e.errores : [];
    const detalle = errores.map((/** @type {any} */ x) => String(x?.ruta ?? '')).join(', ');
    return CODIGOS_ESCENARIO.includes(e.codigo)
      ? tr.t(`competir.error.escenario.${e.codigo}`, { n: tr.num(errores.length), detalle })
      : tr.t('competir.error.escenario', { detalle: String(e.message ?? '') });
  }
  if (typeof e.codigo === 'string' && CODIGOS_ERROR.includes(e.codigo))
    return tr.t(`competir.error.cod.${e.codigo}`);
  return String(e.message ?? e);
}

// ---- Notas y registro ------------------------------------------------------------------

/** @param {any} v @param {Tr} tr */
const valorDiff = (v, tr) =>
  Array.isArray(v)
    ? v.map((x) => tr.num(Number(x) || 0)).join('–')
    : typeof v === 'number'
      ? tr.num(v)
      : v
        ? String(v)
        : tr.t('competir.nulo');

/**
 * Texto de una nota ({t:'nota', clave, params}) de torneos.js.
 * @param {{clave: string, params?: Record<string, any>}} ev @param {Tr} tr
 */
export function textoNota(ev, tr) {
  const p = ev.params ?? {};
  const n = (/** @type {any} */ x) => tr.num(Number(x) || 0);
  switch (ev.clave) {
    case 'fixture':
      return tr.t('competir.nota.fixture', { label: textoRotulo(p.label, tr) });
    case 'cup-size':
      return tr.t('competir.nota.cup-size', { n: n(p.n) });
    case 'cap-reached':
      return tr.t(
        p.capMode === 'nrg' ? 'competir.nota.cap-reached.nrg' : 'competir.nota.cap-reached',
      );
    case 'round-won':
      return tr.t('competir.nota.round-won', { round: n(p.round), winner: String(p.winner ?? '') });
    case 'match-won':
      return tr.t('competir.nota.match-won', { winner: String(p.winner ?? '') });
    case 'match-void':
      return tr.t('competir.nota.match-void', { note: notaNulo(p.note, tr) });
    case 'replay-abandoned':
      return tr.t('competir.nota.replay-abandoned', { no: n(p.no) });
    case 'replay-missing':
      return tr.t('competir.nota.replay-missing', { no: n(p.no), season: n(p.season) });
    case 'replay-same':
      return tr.t(p.full ? 'competir.nota.replay-same' : 'competir.nota.replay-same.ganador', {
        no: n(p.no),
        winner: p.winner ? String(p.winner) : tr.t('competir.nulo'),
        wins: valorDiff(p.wins ?? [], tr),
        cycles: n(p.cycles),
      });
    case 'replay-diff':
      return tr.t('competir.nota.replay-diff', {
        no: n(p.no),
        diffs: (p.diffs ?? [])
          .map((/** @type {any} */ d) =>
            tr.t(`competir.diff.${CAMPOS_DIFF.includes(d.field) ? d.field : 'winner'}`, {
              got: valorDiff(d.got, tr),
              was: valorDiff(d.was, tr),
            }),
          )
          .join(' · '),
      });
    case 'exported':
      return tr.t('competir.nota.exported', { fileName: String(p.fileName ?? '') });
    case 'import-failed':
      return tr.t('competir.nota.import-failed', {
        detalle:
          p.clave === 'bad-json'
            ? tr.t('competir.error.bad-json', { message: String(p.params?.message ?? '') })
            : textoError({ clave: p.clave, params: p.params }, tr),
      });
    case 'imported':
      return tr.t('competir.nota.imported', {
        name: nombreTorneo({ name: p.name }, tr),
        seasons: n(p.seasons),
        matches: n(p.matches),
      });
    case 'entrant-dup':
    case 'entrant-added':
    case 'entrant-played':
      return tr.t(`competir.nota.${ev.clave}`, { name: String(p.name ?? '') });
    case 'entrants-added':
      return tr.t('competir.nota.entrants-added', {
        added: n(p.added),
        failed: n(p.failed),
        already: n(p.already),
      });
    case 'error':
      return tr.t('competir.nota.error', {
        detalle: p.clave
          ? textoError({ clave: p.clave, params: p.params }, tr)
          : String(p.message ?? ''),
      });
    case 'round-recorded':
      return tr.t(p.ya ? 'competir.nota.round-recorded.ya' : 'competir.nota.round-recorded', {
        registrados: n(p.registrados),
        nulos: n(p.nulos),
        descartados: n(p.descartados),
        previos: n(p.previos),
        league: nombreTorneo({ name: p.league }, tr),
      });
    default:
      return CLAVES_NOTA.includes(ev.clave) ? tr.t(`competir.nota.${ev.clave}`) : ev.clave;
  }
}

/**
 * Texto de una línea del registro ({t:'log', clave, params}) de torneos.js.
 * @param {{clave: string, params?: Record<string, any>}} ev @param {Tr} tr
 */
export function textoLog(ev, tr) {
  const p = ev.params ?? {};
  const n = (/** @type {any} */ x) => tr.num(Number(x) || 0);
  switch (ev.clave) {
    case 'db-unavailable':
    case 'save-failed':
      return tr.t(`competir.log.${ev.clave}`, { message: String(p.message ?? '') });
    case 'match-start':
      return tr.t('competir.log.match-start', {
        league: nombreTorneo({ name: p.league }, tr),
        fighters: (p.fighters ?? []).join(' · '),
      });
    case 'match-won':
      return tr.t('competir.log.match-won', {
        winner: String(p.winner ?? ''),
        rounds: n(p.rounds),
        cycles: n(p.cycles),
      });
    case 'match-void':
      return tr.t('competir.log.match-void', { note: notaNulo(p.note, tr) });
    case 'replay-same':
      return tr.t('competir.log.replay-same', { no: n(p.no) });
    case 'replay-diff':
      return tr.t('competir.log.replay-diff', { no: n(p.no), n: n((p.diffs ?? []).length) });
    default:
      return CLAVES_LOG.includes(ev.clave) ? tr.t(`competir.log.${ev.clave}`) : ev.clave;
  }
}

// ---- Avance, sorteo, campeón ----------------------------------------------------------

/**
 * Texto del avance de la temporada (lgProgress).
 * @param {Rotulo | null} r @param {Tr} tr
 */
export function textoProgreso(r, tr) {
  if (!r) return '';
  const p = r.params ?? {};
  const n = (/** @type {any} */ x) => tr.num(Number(x) || 0);
  switch (r.clave) {
    case 'rr':
    case 'cup-groups':
      return tr.t(`competir.progreso.${r.clave}`, { played: n(p.played), total: n(p.total) });
    case 'ladder':
      return tr.t('competir.progreso.ladder', { placed: n(p.placed), n: n(p.n) });
    case 'cup-size':
      return tr.t('competir.progreso.cup-size', { n: n(p.n) });
    case 'cup-ko':
      return tr.t('competir.progreso.cup-ko', { label: textoRotulo(p.label, tr) });
    case 'swiss': {
      const base = tr.t('competir.progreso.swiss', {
        round: n(p.round),
        rounds: n(p.rounds),
        done: n(p.done),
        matches: n(p.matches),
      });
      return p.waiting > 0
        ? tr.t('competir.progreso.swiss.esperan', { base, waiting: n(p.waiting) })
        : base;
    }
    case 'koth-endless': {
      let s = tr.t('competir.progreso.koth-endless', { played: n(p.played) });
      if (p.retire > 0) s = tr.t('competir.progreso.coronas', { base: s, crowns: n(p.crowns) });
      if (p.champ)
        s = tr.t(
          p.retire > 0 ? 'competir.progreso.enColina' : 'competir.progreso.enColinaSeguidas',
          {
            base: s,
            champ: String(p.champ),
            streak: n(p.streak),
            retire: n(p.retire),
          },
        );
      return s;
    }
    case 'koth': {
      const s = tr.t('competir.progreso.koth', { played: n(p.played), cap: n(p.cap) });
      return p.champ
        ? tr.t('competir.progreso.rey', {
            base: s,
            champ: String(p.champ),
            streak: n(p.streak),
            retire: n(p.retire),
          })
        : s;
    }
    default:
      return CLAVES_PROGRESO.includes(r.clave) ? tr.t(`competir.progreso.${r.clave}`) : r.clave;
  }
}

/**
 * Qué hace el sorteo en cada pelea (lgDrawHint).
 * @param {Rotulo | null} r @param {Tr} tr
 */
export function textoSorteo(r, tr) {
  if (!r) return '';
  const p = r.params ?? {};
  const n = (/** @type {any} */ x) => tr.num(Number(x) || 0);
  if (r.clave === 'cup' || r.clave === 'next-season') return tr.t(`competir.sorteo.${r.clave}`);
  const texto =
    r.clave === 'koth'
      ? tr.t('competir.sorteo.koth', { cap: n(p.cap), n: n(p.n) })
      : CLAVES_SORTEO.includes(r.clave)
        ? tr.t(`competir.sorteo.${r.clave}`, { n: n(p.n) })
        : r.clave;
  return p.locked ? tr.t('competir.sorteo.estaTemporada', { texto }) : texto;
}

/**
 * «Campeón: X, cómo» de una temporada terminada.
 * @param {{name: string, how: string} | null} c @param {Tr} tr
 */
export function textoCampeon(c, tr) {
  if (!c) return tr.t('competir.temporada.completa');
  return tr.t('competir.temporada.campeon', {
    name: c.name,
    como: LG_HOWS.includes(c.how) ? tr.t(`competir.como.${c.how}`) : c.how,
  });
}

/**
 * Error del modo TV (lgEdition / lgTvNext).
 * @param {{clave: string, params?: Record<string, any>}} r @param {Tr} tr @param {(pool: string) => string} pool
 */
export function textoTv(r, tr, pool) {
  const p = r.params ?? {};
  if (r.clave === 'tv-cup-size')
    return tr.t('competir.tv.tv-cup-size', { n: tr.num(Number(p.n) || 0) });
  if (r.clave === 'tv-pool-fight' || r.clave === 'round-running')
    return tr.t(`competir.tv.${r.clave}`);
  return tr.t(`competir.tv.${r.clave}`, { pool: pool(String(p.pool ?? 'all')) });
}

// ---- Formato, regla y pools -------------------------------------------------------------

/**
 * El formato en una línea (tnFmtText de la clásica).
 * @param {Record<string, any>} f @param {Tr} tr @param {number} [n] participantes (rondas del suizo)
 */
export function textoFormato(f, tr, n = 0) {
  const x = (/** @type {number} */ v) => tr.num(v);
  switch (f.format) {
    case 'rr':
      return tr.t(f.legs === 2 ? 'competir.fmt.rr.dos' : 'competir.fmt.rr.una');
    case 'ladder':
      return tr.t('competir.fmt.ladder');
    case 'single':
      return tr.t('competir.fmt.single');
    case 'swiss':
      return f.swissRounds > 0
        ? tr.t('competir.fmt.swiss.rondas', { n: x(f.swissRounds) })
        : n >= 2
          ? tr.t('competir.fmt.swiss.auto', { n: x(lgSwissRounds(f, n)) })
          : tr.t('competir.fmt.swiss');
    case 'cup': {
      const partes = [tr.t('competir.fmt.cup')];
      if (f.groupLegs === 2) partes.push(tr.t('competir.fmt.cup.dosVueltas'));
      partes.push(tr.t(f.pots === 'random' ? 'competir.fmt.cup.azar' : 'competir.fmt.cup.elo'));
      if (f.third) partes.push(tr.t('competir.fmt.cup.tercero'));
      return partes.join(', ');
    }
    default: {
      const partes = [tr.t('competir.fmt.koth', { k: x(f.k) })];
      if (f.kothEnd === 'never')
        partes.push(
          f.retire > 0
            ? tr.t('competir.fmt.koth.sinFinRetiro', { n: x(f.retire) })
            : tr.t('competir.fmt.koth.sinFin'),
        );
      else partes.push(tr.t('competir.fmt.koth.retiro', { n: x(f.retire) }));
      if (f.noRepeat) partes.push(tr.t('competir.fmt.koth.sinRepetir'));
      return partes.join(', ');
    }
  }
}

/**
 * La regla del partido (contestRuleHint de la clásica).
 * @param {number} rounds @param {number} wins @param {Tr} tr
 */
export function textoRegla(rounds, wins, tr) {
  const r = contestRule(rounds, wins);
  if (r.wins)
    return tr.t('competir.regla.tope', {
      wins: tr.num(r.wins),
      rounds: tr.num(rounds),
      need: tr.num(r.need),
    });
  return r.min > rounds
    ? tr.t('competir.regla.minimo', {
        need: tr.num(r.need),
        rounds: tr.num(rounds),
        min: tr.num(r.min),
      })
    : tr.t('competir.regla.normal', { need: tr.num(r.need) });
}

/**
 * Explicación del rey de la colina (lgKothHint de la clásica).
 * @param {Record<string, any>} f @param {Tr} tr
 */
export function textoColina(f, tr) {
  const base =
    f.kothEnd !== 'never'
      ? tr.t('competir.colina.retiro', { n: tr.num(f.retire) })
      : f.retire > 0
        ? tr.t('competir.colina.sinFinCoronas', { n: tr.num(f.retire) })
        : tr.t('competir.colina.sinFin');
  return f.noRepeat ? `${base} ${tr.t('competir.colina.sinRepetir')}` : base;
}

/**
 * Nombre de un pool de sorteo (lgPool: 'all', 'fav', 'sel', 'tag:…', 'set:…').
 * @param {string} p @param {Tr} tr
 */
export function nombrePool(p, tr) {
  if (p === 'all') return tr.t('competir.pool.all');
  if (p === 'fav') return tr.t('competir.pool.fav');
  if (p === 'sel') return tr.t('competir.pool.sel');
  if (p.startsWith('tag:')) return tr.t('competir.pool.tag', { tag: p.slice(4) });
  if (p.startsWith('set:')) return tr.t('competir.pool.set', { nombre: p.slice(4) });
  return p;
}

// ---- Migración de los torneos de la clásica (el aviso) ------------------------------

/**
 * ¿La migración trajo algo? (para mostrar o no el aviso).
 * @param {any} r resumen de migrarLigas
 */
export const ligasTrajoAlgo = (r) =>
  !!r?.existia && ((r.torneos ?? 0) > 0 || (r.invalidos ?? 0) > 0 || (r.huerfanos ?? 0) > 0);

/**
 * Líneas del aviso ({clave, params} de competir.json).
 * @param {any} r
 * @returns {{clave: string, params?: Record<string, string | number>}[]}
 */
export function lineasMigracionLigas(r) {
  if (!r?.existia) return [{ clave: 'competir.migracion.nada' }];
  const out = [];
  if (r.torneos)
    out.push({
      clave: 'competir.migracion.torneos',
      params: { n: r.torneos, partidos: r.partidos ?? 0 },
    });
  if (r.yaEstaban) out.push({ clave: 'competir.migracion.yaEstaban', params: { n: r.yaEstaban } });
  if (r.partidosReasignados)
    out.push({ clave: 'competir.migracion.reasignados', params: { n: r.partidosReasignados } });
  if (r.invalidos) out.push({ clave: 'competir.migracion.invalidos', params: { n: r.invalidos } });
  if (r.huerfanos) out.push({ clave: 'competir.migracion.huerfanos', params: { n: r.huerfanos } });
  if (!out.length) out.push({ clave: 'competir.migracion.nada' });
  return out;
}
