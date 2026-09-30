// @ts-check
// Torneos con estado: la lista, el torneo abierto, sus partidos, el Scratch,
// el partido en curso y la persistencia. Sin DOM: todo lo de afuera entra
// por dependencias (crearTorneos) y todo lo que la clásica escribía en la
// ventana sale como eventos con clave y parámetros (el texto lo pone la
// interfaz con t()).
//
// Origen (paso E1.2 de port/web2/PLAN.md, decisiones 1, 17, 21 y 23): las
// funciones con estado de port/web/league.js, con los mismos nombres y la
// misma lógica, y las acciones de la ventana de port/web/tournament.js que
// cambian el modelo:
//   lg, lgFind, lgSeasonMatches, lgNextFixture ...... league.js 74-82, 130-135, 755
//   lgCupEnsure, lgSwissEnsure ...................... league.js 440-442, 705-707
//   lgLoadAll, lgSelect, lgSave, lgCreate ........... league.js 911-974
//   lgScratch, lgScratchSave, lgDelete .............. league.js 994-1030
//   lgNewSeason, lgLiveOn, lgLiveSync ............... league.js 1044-1078
//   lgEnrollOne, lgLiveFill, lgRedraw ............... league.js 1082-1137
//   lgExport, lgImport .............................. league.js 1219-1222, 1277-1289 (sin archivo:
//                                                     devuelven/reciben el objeto o el texto)
//   lgMigrateRoster, lgOldHofFile/Discard ........... league.js 1237-1275 (kv en vez de localStorage;
//                                                     leen las claves de la clásica sin borrarlas)
//   lgAddEntrant, lgEnroll, lgDrawRandom, lgPool .... league.js 1301-1355 (con el Inventario inyectado)
//   lgPlayNext, lgPlay, lgReplay, lgReplayCheck ..... league.js 1358-1449 (lanzar(plan) en vez de
//                                                     lgApplyRules + contestLaunch)
//   leagueAbort, lgRecord, leagueOnMessage .......... league.js 1452-1517
//   lgOnStats ....................................... tournament.js 422-427 (tnOnStats, sin marcador)
//   lgAdd, lgAddItems, lgSetDraw, lgCupRedraw ....... tournament.js 662-676, 700-707, 208-219
//   lgSetFmt, lgSetRules, lgRename, lgEntrant* ...... tournament.js 861-953 (los onchange de Setup)
//   lgClearScratch, lgDeleteCurrent ................. tournament.js 832-841 (el botón 🗑)
//   lgEdition, lgTvNext ............................. tournament.js 264-318 (tvEdition y tvNext, sin
//                                                     temporizadores ni rótulos)
//
// Dependencias de crearTorneos(deps) (* = obligatoria: sin ella, ErrorLiga
// 'deps-missing' {dep}; no hay valores por defecto escondidos):
//   almacen*    Almacen de engine/torneos-db.js (almacenes 'torneos' y 'partidos').
//   inventario* {items, sel, sets, userRec(key), fetchDna(b), color()} — se lee
//               en cada uso (inv, userRec, invFetchDna e invColor de la clásica);
//               color() es obligatorio (el color de reserva de un participante).
//   reglasBase* () → reglas del Scratch nuevo (la clásica: las F1, lgF1Rules).
//   kv          {get(k), set(k, v)} — lo que la clásica guardaba en localStorage.
//               La nueva ESCRIBE solo claves de su espacio de nombres
//               (KV_PREFIJO 'darwinbots2.': el torneo abierto y las marcas de
//               migración) y las de la clásica (LG_OLD_*) solo las LEE: la
//               clásica no se toca (decisión 17). Puede ser localStorage tal
//               cual (mismo origen en Pages). Sin kv: nada se recuerda.
//   lanzar      async (plan) → lanza el partido (plan de partido.js: el
//               anfitrión arma las opciones con reglasAOpciones(plan.rules, base)
//               y manda mensajesPartido). Sin lanzar: ErrorLiga 'no-launcher' al jugar.
//   azar        generador en [0, 1) de los sorteos y la semilla (Math.random).
//   nuevoId     () → id de torneo nuevo (lgNewId).
//   nombres     {league?, scratch?, imported?, tournament?} — nombres que se
//               guardan en los datos (league.js LG_NOMBRES; por defecto los de
//               la clásica, por compatibilidad de archivos).
//   alEvento    (ev) → avisos a la interfaz:
//     {t: 'render'}                       algo cambió (lgRender)
//     {t: 'seleccion', L}                 cambió el torneo abierto (la clásica apagaba el TV)
//     {t: 'repeticion'}                   una repetición toma la sim (idem)
//     {t: 'resultado', rec}               partido registrado (tnOnResult)
//     {t: 'nota', clave, params, aviso}   la línea de estado (lgNote/tnNote)
//     {t: 'log', clave, params}           el registro de la página (log)
//
// Claves de nota (texto de la clásica):
//   preparing {}                  "Preparing…"
//   fixture {label}               el rótulo de la pelea (ver league.js, ROTULOS)
//   drawing {}                    "Drawing from the pool…"
//   season-complete {}            "The season is complete."
//   pool-short {}                 "The draw pool has too few readable bots for the next fight."
//   too-few {}                    "A tournament needs at least 2 entrants."
//   cup-size {n}                  "A World cup needs 8, 16 or 32 entrants (this one has {n})."
//   cap-reached {capMode}         "Cycle cap reached: the round goes to the most numerous species."
//                                 ('nrg': "…to the species with the most energy.")
//   round-won {round, winner}     "Round {round} goes to {winner}."
//   match-won {winner}            "🏆 {winner} wins the match."
//   match-void {note}             la nota del nulo (NOTA_* de partido.js)
//   abandoned {}                  "Match abandoned: not recorded."
//   replay-abandoned {no}         "Replay of match #{no} abandoned."
//   replay-missing {no, season}   "Match #{no} cannot be replayed: an entrant is no longer in season {season}."
//   replay-same {no, winner, wins, cycles, full}
//                                 "✓ Replay of match #{no} matches: {winner|void}, {wins}, {cycles} cycles"
//                                 + (full ? "." : " (only the winner was recorded).")
//   replay-diff {no, diffs}       "⚠ Replay of match #{no} differs: …" (diffs de compararRepeticion)
//   exported {fileName}           "Exported to {fileName}."
//   import-failed {clave, params} "Import failed: …" (el error de lgImportObj)
//   imported {name, seasons, matches}  "Imported "{name}": {seasons} seasons, {matches} matches."
//   entrant-dup {name}            "{name} is already in (same DNA)."
//   entrant-added {name}          "{name} added."
//   entrants-added {added, failed, already}
//                                 "{added} entrants added · {failed} unreadable · {already} already in."
//   groups-locked {}              "This season has matches: the groups are locked."
//   groups-drawn {}               "Groups drawn."
//   scratch-cleared {}            "Scratch cleared."
//   error {clave?, params?, message?}  un error del lanzamiento (ErrorLiga o Error)
// Claves de log: db-unavailable {message}, save-failed {message},
//   match-save-failed {}, match-start {league, fighters}, match-won {winner,
//   rounds, cycles}, match-void {note}, replay-same {no}, replay-diff {no, diffs}.
// Errores (ErrorLiga {clave, params}; la tabla completa, con los de
// partido.js y lgImportObj, en la cabecera de league.js): deps-missing {dep}
// (crearTorneos), no-launcher {} y match-running {} (lgPlay). 'error' de nota
// lleva {message} solo si el anfitrión lanza un Error que no es ErrorLiga.

import {
  ErrorLiga,
  LG_FMT_DEFAULT,
  LG_MAX_FIGHTERS,
  LG_NOMBRES,
  LG_OLD_HOF_KEY,
  LG_OLD_ROSTER_KEY,
  LG_SCRATCH_ID,
  lgAddEntrant as lgAddEntrantPuro,
  lgCupDraw,
  lgCupSizeOk,
  lgDrawClean,
  lgDrawOf,
  lgExportObj,
  lgFileName,
  lgFixture,
  lgFmtSet,
  lgFought,
  lgHash,
  lgImportObj,
  lgIsScratch,
  lgKothState,
  lgLadderState,
  lgLaunchList,
  lgMigrate,
  lgNewId,
  lgNewLeague,
  lgNextName,
  lgOldHofFile as lgOldHofFilePuro,
  lgPool as lgPoolPuro,
  lgPromote,
  lgScratchNew,
  lgSeason,
  lgSeasonChampion,
  lgSeasonDone,
  lgSeasonNext,
  lgShuffle,
  lgSwissDraw,
  lgUniqueName,
} from './league.js';
import {
  alFrame,
  compararRepeticion,
  interpretarMensaje,
  marcadorFinal,
  nuevoVivo,
  planPartido,
} from './partido.js';

/** @typedef {import('./league.js').League} League */
/** @typedef {import('./league.js').Season} Season */
/** @typedef {import('./league.js').Match} Match */
/** @typedef {import('./torneos-db.js').Almacen} Almacen */

// Almacenes (engine/torneos-db.js) y las claves de la nueva en kv (su
// espacio de nombres; ver Dependencias).
export const ST_TORNEOS = 'torneos';
export const ST_PARTIDOS = 'partidos';
export const KV_PREFIJO = 'darwinbots2.';
export const LG_CUR_KEY = `${KV_PREFIJO}torneo-actual`;
// Marcas de la migración (la clásica borraba sus claves; la nueva las deja y
// anota aquí que ya las tomó).
export const KV_ROSTER_MIGRADO = `${KV_PREFIJO}migrado.contest-roster`;
export const KV_HOF_DESCARTADO = `${KV_PREFIJO}descartado.channel-hof`;

/**
 * @param {{
 *   almacen: Almacen,
 *   inventario: any,
 *   reglasBase: () => Record<string, any>,
 *   kv?: {get: (k: string) => string | null, set?: (k: string, v: string) => void},
 *   lanzar?: (plan: import('./partido.js').Plan) => Promise<void> | void,
 *   azar?: () => number,
 *   nuevoId?: () => string,
 *   nombres?: Partial<import('./league.js').Nombres>,
 *   alEvento?: (ev: any) => void,
 * }} deps
 */
export function crearTorneos(deps) {
  if (!deps?.almacen) throw new ErrorLiga('deps-missing', { dep: 'almacen' });
  if (!deps.inventario) throw new ErrorLiga('deps-missing', { dep: 'inventario' });
  if (typeof deps.inventario.color !== 'function')
    throw new ErrorLiga('deps-missing', { dep: 'inventario.color' });
  if (typeof deps.reglasBase !== 'function')
    throw new ErrorLiga('deps-missing', { dep: 'reglasBase' });
  const almacen = deps.almacen;
  const inv = () => deps.inventario;
  const kv = deps.kv || { get: () => null, set: () => {} };
  const azar = deps.azar || Math.random;
  const nuevoId = deps.nuevoId || lgNewId;
  const reglasBase = deps.reglasBase;
  const nombres = { ...LG_NOMBRES, ...(deps.nombres || {}) };
  const alEvento = deps.alEvento || (() => {});
  const lanzar =
    deps.lanzar ||
    (async () => {
      throw new ErrorLiga('no-launcher');
    });

  // ---- Estado ---------------------------------------------------------------------
  const lg = {
    list: /** @type {League[]} */ ([]), // ligas
    cur: /** @type {League | null} */ (null), // liga abierta
    matches: /** @type {Match[]} */ ([]), // partidos de la liga abierta (todas las temporadas)
    live: /** @type {import('./partido.js').Vivo | null} */ (null), // partido en curso; live.replay = repetición
    checked: new Map(), // id del partido → 'same' | 'diff' (repeticiones de esta sesión)
    scratch: /** @type {{L: League, matches: Match[], seq: number} | null} */ (null), // torneo Scratch
  };

  /** @param {string} clave @param {Record<string, any>} [params] @param {boolean} [aviso] */
  const lgNote = (clave, params = {}, aviso = false) =>
    alEvento({ t: 'nota', clave, params, aviso: !!aviso });
  /** @param {string} clave @param {Record<string, any>} [params] */
  const log = (clave, params = {}) => alEvento({ t: 'log', clave, params });
  const lgRender = () => alEvento({ t: 'render' });
  /** @param {any} e */
  const noteError = (e) =>
    e instanceof ErrorLiga
      ? lgNote('error', { clave: e.clave, params: e.params }, true)
      : lgNote('error', { message: e?.message }, true);
  /** @param {string} k */
  const storeGet = (k) => {
    try {
      return kv.get(k);
    } catch (_e) {
      return null;
    }
  };
  /** @param {string} k @param {string} v */
  const storeSet = (k, v) => {
    try {
      kv.set?.(k, v);
    } catch (_e) {
      /* nada */
    }
  };

  /** @param {number} no */
  const lgSeasonMatches = (no) =>
    lg.matches.filter((m) => m.season === no).sort((a, b) => a.no - b.no);
  // Liga por id: la de la lista o el Scratch.
  /** @param {string} id */
  const lgFind = (id) => (id === LG_SCRATCH_ID ? lg.scratch?.L : lg.list.find((L) => L.id === id));
  // Próxima pelea de la temporada abierta de L (lee lg.matches).
  /** @param {League} L */
  const lgNextFixture = (L) => lgFixture(lgSeason(L), lgSeasonMatches(lgSeason(L).no), azar);

  /** @param {League} L */
  async function lgCupEnsure(L) {
    if (lgCupDraw(L, lg.matches, azar)) await lgSave(L);
  }
  /** @param {League} L */
  async function lgSwissEnsure(L) {
    if (lgSwissDraw(L, lg.matches, azar)) await lgSave(L);
  }

  // ---- Persistencia ---------------------------------------------------------------
  async function lgLoadAll() {
    try {
      lg.list = (await almacen.list(ST_TORNEOS)).sort((a, b) => a.created.localeCompare(b.created));
    } catch (e) {
      lg.list = [];
      log('db-unavailable', { message: /** @type {any} */ (e).message });
    }
    for (const L of lg.list) if (lgMigrate(L)) await lgSave(L);
    const id = storeGet(LG_CUR_KEY) || '';
    // E11: sin torneo recordado (o el Scratch), el Scratch.
    await lgSelect(lg.list.find((L) => L.id === id) || lgScratch());
  }

  /** @param {League | null} L */
  async function lgSelect(L) {
    // El TV mode juega el torneo abierto: cambiar de torneo lo apaga (la interfaz).
    if (lg.cur !== L) alEvento({ t: 'seleccion', L });
    lg.cur = L;
    lg.matches = [];
    if (L && lgIsScratch(L))
      lg.matches = /** @type {any} */ (lg.scratch).matches; // el mismo arreglo: lgRecord lo llena
    else if (L) {
      try {
        lg.matches = (await almacen.list(ST_PARTIDOS)).filter((m) => m.league === L.id);
      } catch (_e) {
        /* nada */
      }
    }
    if (L) storeSet(LG_CUR_KEY, L.id);
    lgRender();
  }

  // El Scratch no se guarda (vive en memoria hasta "Save as tournament").
  /** @param {League} L */
  async function lgSave(L) {
    if (lgIsScratch(L)) return;
    try {
      await almacen.put(ST_TORNEOS, L);
    } catch (e) {
      log('save-failed', { message: /** @type {any} */ (e).message });
    }
  }

  // Torneo nuevo con estas reglas (la clásica las sacaba del panel: F1, sin
  // costes o el panel tal cual). prefix: el del nombre ("Tournament N").
  /** @param {Record<string, any>} rules @param {string} [prefix] */
  async function lgCreate(rules, prefix = nombres.tournament) {
    const L = lgNewLeague({ id: nuevoId(), name: lgNextName(prefix, lg.list), rules }, nombres);
    lg.list.push(L);
    await lgSave(L);
    await lgSelect(L);
    return L;
  }

  // ---- Scratch ------------------------------------------------------------------------
  // El Scratch, creado la primera vez con las reglas base (las F1 en la clásica).
  function lgScratch() {
    if (!lg.scratch) lg.scratch = lgScratchNew(null, reglasBase(), nombres);
    return lg.scratch.L;
  }

  /** @param {string} [name] @param {string} [prefix] */
  async function lgScratchSave(name, prefix = nombres.tournament) {
    const sc = lg.scratch;
    if (!sc) return null;
    if (lg.live && lg.live.league === LG_SCRATCH_ID) leagueAbort();
    const names = new Set(lg.list.map((L) => L.name));
    const r = lgPromote(
      sc.L,
      sc.matches,
      nuevoId(),
      lgUniqueName((name || '').trim() || lgNextName(prefix, lg.list), names),
      nombres,
    );
    await lgSave(r.L);
    for (const m of r.matches) {
      try {
        await almacen.put(ST_PARTIDOS, m);
      } catch (_e) {
        log('match-save-failed');
      }
    }
    lg.list.push(r.L);
    lg.scratch = lgScratchNew(sc.L, undefined, nombres);
    await lgSelect(r.L);
    return r.L;
  }

  /** @param {League} L */
  async function lgDelete(L) {
    if (lgIsScratch(L)) return;
    if (lg.live && lg.live.league === L.id) leagueAbort();
    try {
      // El torneo y sus partidos (delMatches de la clásica) en una sola
      // transacción: o se borra todo o nada.
      await almacen.tx([ST_TORNEOS, ST_PARTIDOS], async (t) => {
        await t.delete(ST_TORNEOS, L.id);
        for (const m of await t.porIndice(ST_PARTIDOS, 'league', L.id))
          await t.delete(ST_PARTIDOS, m.id);
      });
    } catch (_e) {
      /* nada */
    }
    lg.list = lg.list.filter((x) => x !== L);
    await lgSelect(lg.list[lg.list.length - 1] || null);
  }

  // ---- Temporadas y sorteos ---------------------------------------------------------
  // Temporada nueva. Con el sorteo de la liga en 'random' (o o.draw, el TV
  // mode, que sortea siempre) los participantes salen de n del pool; en
  // 'fight' empieza vacía y se sortea al jugar (lgLiveFill).
  // Devuelve el resultado del sorteo ({added, failed}) o null.
  /** @param {League} L @param {{draw?: boolean}} [o] */
  async function lgNewSeason(L, o = {}) {
    if (lg.live && lg.live.league === L.id) leagueAbort();
    const d = lgDrawOf(L);
    const fresh = !!o.draw || d.mode !== 'fixed';
    L.seasons.push(lgSeasonNext(lgSeason(L), fresh));
    lgLiveSync(L);
    let r = null;
    if (fresh && !lgSeason(L).live) r = await lgDrawRandom(L, lgPool(d.pool), d.n);
    else await lgSave(L);
    lgRender();
    return r;
  }

  // Sorteo en cada pelea (ver web/league.js 1054-1062): la temporada lleva
  // S.live = {pool, n}, la foto del sorteo que se congela con su primer
  // partido, y los participantes se inscriben a medida que hacen falta.
  /** @param {League} L */
  const lgLiveOn = (L) => lgDrawOf(L).mode === 'fight' && lgSeason(L).fmt.format !== 'cup';

  // Pone S.live al día con el sorteo de la liga mientras la temporada abierta
  // (la de lg.cur) no tiene partidos. true si cambió.
  /** @param {League} L */
  function lgLiveSync(L) {
    const S = lgSeason(L);
    if (lgSeasonMatches(S.no).length) return false;
    const d = lgDrawOf(L);
    // n no pasa del pool: el tope del rey de la colina (3 × n) sale de aquí.
    const live = lgLiveOn(L)
      ? { pool: d.pool, n: Math.min(d.n, Math.max(2, lgPool(d.pool).length)) }
      : undefined;
    if (JSON.stringify(live) === JSON.stringify(S.live)) return false;
    if (live) S.live = live;
    else delete S.live;
    delete S.next;
    delete S.dry;
    return true;
  }

  // Un bot del pool como participante: el que ya tiene su ADN o uno nuevo.
  // null si su ADN no se puede leer.
  /** @param {Season} S @param {any} it */
  async function lgEnrollOne(S, it) {
    let dna;
    try {
      dna = await inv().fetchDna(it.b);
    } catch (_e) {
      return null;
    }
    const hash = lgHash(dna);
    const have = S.entrants.find((x) => x.hash === hash);
    if (have) return have;
    lgAddEntrant(S, { name: it.b.name, dna, src: 'bestiary', file: it.b.file });
    return S.entrants[S.entrants.length - 1];
  }

  // Inscribe lo que la próxima pelea de la temporada abierta de L (lg.cur)
  // necesita del pool; nada si no sortea en cada pelea. Con el pool corto, la
  // escalera termina con los que hay y los demás formatos juegan con menos.
  /** @param {League} L */
  async function lgLiveFill(L) {
    const S = lgSeason(L);
    const live = S.live;
    if (!live) return;
    const ms = lgSeasonMatches(S.no);
    delete S.dry; // sin repetir: se vuelve a mirar el pool
    if (lgSeasonDone(S, ms)) return;
    const f = S.fmt.format;
    if (f === 'koth') {
      if (lgFixture(S, ms, azar)) return; // ya sorteada (p. ej. tras abandonarla)
      const { champ } = lgKothState(S, ms);
      const need = Math.min(Math.max(2, S.fmt.k), LG_MAX_FIGHTERS) - (champ ? 1 : 0);
      const fought = S.fmt.noRepeat ? lgFought(ms) : new Set();
      /** @type {string[]} */
      const names = [];
      for (const it of lgShuffle(lgPool(live.pool), azar)) {
        if (names.length >= need) break;
        if (it.b.name === champ || fought.has(it.b.name)) continue;
        const e = await lgEnrollOne(S, it);
        if (e && e.name !== champ && !fought.has(e.name) && !names.includes(e.name))
          names.push(e.name);
      }
      // Sin repetir y sin retadores nuevos suficientes: la temporada termina.
      if (S.fmt.noRepeat && names.length < (champ ? 1 : 2)) S.dry = ms.length;
      S.next = { at: ms.length, names };
      await lgSave(L);
    } else if (f === 'ladder') {
      const want = Math.min(live.n, Math.max(2, lgLadderState(S, ms).placed + 1));
      if (S.entrants.length < want)
        await lgDrawRandom(L, lgPool(live.pool), want - S.entrants.length);
      if (S.entrants.length < want) {
        live.n = S.entrants.length;
        await lgSave(L);
      }
    } else if (!ms.length && S.entrants.length < live.n) {
      await lgDrawRandom(L, lgPool(live.pool), live.n - S.entrants.length);
    }
  }

  // Vuelve a sortear los participantes de la temporada abierta (solo si aún no
  // tiene partidos).
  /** @param {League} L */
  async function lgRedraw(L) {
    const S = lgSeason(L);
    if (lg.matches.some((m) => m.league === L.id && m.season === S.no)) return null;
    const d = lgDrawOf(L);
    S.entrants = [];
    const r = await lgDrawRandom(L, lgPool(d.pool), d.n);
    lgRender();
    return r;
  }

  // ---- Compartir ----------------------------------------------------------------------
  // El archivo del torneo (la interfaz lo descarga como fileName).
  /** @param {League} L */
  function lgExport(L) {
    const r = { obj: lgExportObj(L, lg.matches), fileName: lgFileName(L) };
    lgNote('exported', { fileName: r.fileName });
    return r;
  }

  // Importa el texto de un archivo como torneo nuevo. Devuelve la liga o null.
  /** @param {string} text */
  async function lgImport(text) {
    let r;
    try {
      r = lgImportObj(JSON.parse(text), new Set(lg.list.map((L) => L.name)), nuevoId(), nombres);
    } catch (e) {
      const x = /** @type {any} */ (e);
      lgNote(
        'import-failed',
        x instanceof ErrorLiga
          ? { clave: x.clave, params: x.params }
          : { clave: 'bad-json', params: { message: x.message } },
        true,
      );
      return null;
    }
    await lgSave(r.L);
    for (const m of r.matches) {
      try {
        await almacen.put(ST_PARTIDOS, m);
      } catch (_e) {
        log('match-save-failed');
      }
    }
    lg.list.push(r.L);
    await lgSelect(r.L);
    lgNote('imported', {
      name: r.L.name,
      seasons: r.L.seasons.length,
      matches: r.matches.length,
    });
    return r.L;
  }

  // ---- Migración de lo que guardaban el Contest y el Canal (E11) -----------------
  // El roster del Contest pasa a los participantes del Scratch (el ADN se lee
  // ahora y queda congelado; los de 'form' no guardaban ADN y se pierden).
  // dnaOf(r) → ADN del renglón (contestDna). Mismo resultado que la clásica,
  // pero SIN borrar sus claves (decisión 17: la clásica no se toca): se leen,
  // se copian y la nueva anota en su espacio de nombres (KV_ROSTER_MIGRADO)
  // que ya migró, así la segunda vez devuelve null como la clásica. La config
  // del Canal (LG_OLD_CHCFG_KEY), que la clásica descartaba, se ignora.
  /** @param {League} L @param {(r: any) => Promise<string>} dnaOf */
  async function lgMigrateRoster(L, dnaOf) {
    if (storeGet(KV_ROSTER_MIGRADO)) return null;
    const raw = storeGet(LG_OLD_ROSTER_KEY);
    if (raw === null || raw === undefined) return null;
    let list = [];
    try {
      list = JSON.parse(raw) || [];
    } catch (_e) {
      list = [];
    }
    const S = lgSeason(L);
    let added = 0;
    let lost = 0;
    for (const r of Array.isArray(list) ? list : []) {
      if (!r?.name) continue;
      try {
        const dna = await dnaOf(r);
        if (
          lgAddEntrant(S, {
            name: r.name,
            dna,
            src: r.src === 'hybrid' ? 'hybrid' : r.src === 'bestiary' ? 'bestiary' : 'form',
            file: r.file,
            qty: r.qty,
            color: r.color,
          })
        )
          added++;
      } catch (_e) {
        lost++;
      }
    }
    storeSet(KV_ROSTER_MIGRADO, new Date().toISOString());
    await lgSave(L);
    return { added, lost };
  }

  // El Hall of Fame del Canal viejo como archivo, o null si no hay (o si ya
  // se descartó). Descartarlo no borra la clave de la clásica: lo anota en
  // la nueva (KV_HOF_DESCARTADO).
  const lgOldHofFile = () =>
    storeGet(KV_HOF_DESCARTADO) ? null : lgOldHofFilePuro(storeGet(LG_OLD_HOF_KEY));
  const lgOldHofDiscard = () => storeSet(KV_HOF_DESCARTADO, new Date().toISOString());

  // ---- Participantes ---------------------------------------------------------------
  /** @param {Season} S @param {any} e */
  const lgAddEntrant = (S, e) => lgAddEntrantPuro(S, e, () => inv().color());

  // Inscribe bots del Inventario (lee su ADN). Con `max`, para al llegar a
  // esa cantidad de altas (el sorteo salta los ilegibles y los repetidos).
  /** @param {League} L @param {any[]} items @param {number} [max] */
  async function lgEnroll(L, items, max = Infinity) {
    const S = lgSeason(L);
    let added = 0;
    let failed = 0;
    for (const it of items) {
      if (added >= max) break;
      try {
        const dna = await inv().fetchDna(it.b);
        if (lgAddEntrant(S, { name: it.b.name, dna, src: 'bestiary', file: it.b.file })) added++;
      } catch (_e) {
        failed++;
      }
    }
    await lgSave(L);
    return { added, failed };
  }

  // Sorteo de n participantes de un pool. Los que ya están en la temporada no cuentan.
  /** @param {League} L @param {any[]} pool @param {number} n */
  async function lgDrawRandom(L, pool, n) {
    const have = new Set(lgSeason(L).entrants.map((e) => e.name));
    return lgEnroll(
      L,
      lgShuffle(
        pool.filter((it) => !have.has(it.b.name)),
        azar,
      ),
      n,
    );
  }

  /** @param {string} filter */
  const lgPool = (filter) => lgPoolPuro(inv(), filter);

  // ---- Partidos -------------------------------------------------------------------
  async function lgPlayNext() {
    const L = lg.cur;
    if (!L || lg.live) return;
    const S = lgSeason(L);
    if (S.fmt.format === 'cup' && !lgCupSizeOk(S)) {
      lgNote('cup-size', { n: S.entrants.length }, true);
      return;
    }
    await lgCupEnsure(L);
    if (lgLiveSync(L)) await lgSave(L);
    if (S.live) lgNote('drawing');
    await lgLiveFill(L);
    await lgSwissEnsure(L); // suizo: el orden de la ronda 1
    const fx = lgNextFixture(L);
    if (!fx) {
      lgNote(
        lgSeasonDone(S, lgSeasonMatches(S.no))
          ? 'season-complete'
          : S.live
            ? 'pool-short'
            : 'too-few',
        {},
        true,
      );
      lgRender();
      return;
    }
    try {
      await lgPlay(L, fx);
    } catch (e) {
      noteError(e);
    }
  }

  // Juega una pelea de la liga: abre lg.live y lanza el partido con las
  // reglas y los valores de la temporada. Lanza excepción si algún ADN no se
  // puede sembrar (sin partido abierto). o.replay = partido del historial a
  // repetir (su temporada y su semilla; no se registra, se compara). La
  // semilla queda en lg.live antes de lanzar (la clásica la leía del campo
  // después; el valor es el mismo).
  /** @param {League} L @param {{fighters: any[], label: any}} fx @param {{replay?: any}} [o] */
  async function lgPlay(L, fx, o = {}) {
    if (lg.live) throw new ErrorLiga('match-running');
    const S = /** @type {Season} */ (
      o.replay ? L.seasons.find((s) => s.no === o.replay.season) : lgSeason(L)
    );
    const f = S.fmt;
    const live = nuevoVivo({
      league: L.id,
      season: S.no,
      fighters: fx.fighters,
      label: fx.label,
      replay: o.replay,
    });
    lg.live = live;
    lgNote('preparing');
    const seed = parseFloat(String(o.replay ? o.replay.seed : Math.floor(azar() * 100000))) || 0;
    live.seed = seed;
    try {
      const plan = planPartido(
        lgLaunchList(f, fx.fighters),
        {
          nrg: f.nrg,
          rounds: f.rounds,
          wins: f.wins,
          cap: f.cap,
          capMode: f.capMode,
          popCap: f.popCap || 0,
        },
        seed,
        S.rules,
      );
      await lanzar(plan);
    } catch (e) {
      if (lg.live === live) lg.live = null;
      lgRender();
      throw e;
    }
    log('match-start', { league: L.name, fighters: fx.fighters.map((e) => e.name) });
    lgNote('fixture', { label: fx.label });
    lgRender();
  }

  // Repite un partido del historial: las reglas y el formato de SU temporada,
  // los mismos participantes (el ADN congelado) en el mismo orden de siembra y
  // la misma semilla. El core es determinista: debe salir lo mismo.
  /** @param {number} id */
  async function lgReplay(id) {
    const L = lg.cur;
    const m = L && lg.matches.find((x) => x.id === id);
    if (!L || !m || lg.live) return;
    const S = L.seasons.find((s) => s.no === m.season);
    const fighters = m.fighters.map((n) => S?.entrants.find((e) => e.name === n));
    if (!S || fighters.some((e) => !e)) {
      lgNote('replay-missing', { no: m.no, season: m.season }, true);
      return;
    }
    alEvento({ t: 'repeticion' }); // la repetición toma la sim
    try {
      await lgPlay(
        L,
        {
          fighters,
          label: { clave: 'replay', params: { no: m.no, season: m.season, seed: m.seed } },
        },
        { replay: m },
      );
    } catch (e) {
      noteError(e);
    }
  }

  // Compara la repetición con lo registrado (compararRepeticion).
  /** @param {any} m @param {{winner: string, wins: number[], cycles: number}} got */
  function lgReplayCheck(m, got) {
    const { diffs, full } = compararRepeticion(m, got);
    lg.checked.set(m.id, diffs.length ? 'diff' : 'same');
    if (diffs.length) {
      log('replay-diff', { no: m.no, diffs });
      lgNote('replay-diff', { no: m.no, diffs }, true);
    } else {
      log('replay-same', { no: m.no });
      lgNote('replay-same', {
        no: m.no,
        winner: got.winner,
        wins: got.wins,
        cycles: got.cycles,
        full,
      });
    }
    lgRender();
  }

  // Abandona el partido en curso sin registrarlo (otro torneo toma la sim).
  function leagueAbort() {
    if (!lg.live) return;
    const replay = lg.live.replay;
    lg.live = null;
    if (replay) lgNote('replay-abandoned', { no: replay.no }, true);
    else lgNote('abandoned', {}, true);
    lgRender();
  }

  /** @param {string} winner @param {string} [note] */
  async function lgRecord(winner, note) {
    const m = lg.live;
    if (!m) return;
    lg.live = null;
    const L = lgFind(m.league);
    const { wins, capWins } = marcadorFinal(m);
    if (m.replay) {
      lgReplayCheck(m.replay, { winner: winner || '', wins, cycles: m.cycles || 0 });
      return;
    }
    // Los partidos del Scratch quedan en memoria (con id negativo); los demás,
    // en la base y, si es la liga abierta, en lg.matches.
    const scratch = m.league === LG_SCRATCH_ID;
    const bucket = scratch
      ? lg.scratch?.matches
      : lg.cur && lg.cur.id === m.league
        ? lg.matches
        : null;
    const no =
      Math.max(
        0,
        ...(bucket || [])
          .filter((x) => x.league === m.league && x.season === m.season)
          .map((x) => x.no),
      ) + 1;
    /** @type {Match} */
    const rec = {
      league: m.league,
      season: m.season,
      no,
      date: new Date().toISOString(),
      format: L ? lgSeason(L).fmt.format : '',
      fighters: m.fighters.map((e) => e.name),
      seed: m.seed,
      winner: winner || '',
      wins,
      capWins,
      rounds: wins.reduce((a, b) => a + b, 0),
      cycles: m.cycles || 0,
      capRounds: m.capRounds,
      note: note || '',
    };
    if (scratch && lg.scratch) rec.id = -++lg.scratch.seq;
    else
      try {
        rec.id = await almacen.put(ST_PARTIDOS, rec);
      } catch (_e) {
        log('match-save-failed');
      }
    if (bucket) bucket.push(rec);
    if (winner) {
      log('match-won', { winner, rounds: rec.rounds, cycles: rec.cycles });
      lgNote('match-won', { winner });
    } else {
      log('match-void', { note });
      lgNote('match-void', { note }, true);
    }
    lgRender();
    alEvento({ t: 'resultado', rec });
  }

  // Un mensaje del worker (el anfitrión reenvía f1-started, f1-note y f1-over).
  /** @param {any} msg */
  function leagueOnMessage(msg) {
    const m = lg.live;
    if (!m) return;
    const r = interpretarMensaje(m, msg);
    if (!r) return;
    if (r.t === 'registrar') return lgRecord(r.winner, r.note);
    if (r.t === 'tope') {
      const L = lgFind(m.league);
      const f = L ? lgSeason(L).fmt : LG_FMT_DEFAULT;
      lgNote('cap-reached', { capMode: f.capMode });
    }
  }

  // Las stats de un frame (tnOnStats sin el marcador, que es de la interfaz).
  /** @param {any} st */
  function lgOnStats(st) {
    const r = alFrame(lg.live, st);
    if (r?.roundWinner) lgNote('round-won', { round: r.round, winner: r.roundWinner });
    return r;
  }

  // ---- Acciones de la ventana (tournament.js) ----------------------------------------
  /** @param {any} e */
  async function lgAdd(e) {
    const L = lg.cur;
    if (!L) return false;
    const ok = lgAddEntrant(lgSeason(L), e);
    lgNote(ok ? 'entrant-added' : 'entrant-dup', { name: e.name });
    await lgSave(L);
    lgRender();
    return ok;
  }

  /** @param {any[]} items */
  async function lgAddItems(items) {
    if (!lg.cur) return null;
    const { added, failed } = await lgEnroll(lg.cur, items);
    lgNote('entrants-added', { added, failed, already: items.length - added - failed });
    lgRender();
    return { added, failed };
  }

  /** @param {Record<string, any>} patch */
  async function lgSetDraw(patch) {
    const L = lg.cur;
    if (!L) return;
    L.draw = lgDrawClean({ ...lgDrawOf(L), ...patch });
    lgLiveSync(L);
    await lgSave(L);
    lgRender();
  }

  async function lgCupRedraw() {
    const L = lg.cur;
    if (!L) return false;
    const S = lgSeason(L);
    if (lgSeasonMatches(S.no).length) {
      lgNote('groups-locked', {}, true);
      return false;
    }
    if (!lgCupSizeOk(S)) {
      lgNote('cup-size', { n: S.entrants.length }, true);
      return false;
    }
    delete S.groups;
    lgCupDraw(L, lg.matches, azar);
    await lgSave(L);
    lgNote('groups-drawn');
    lgRender();
    return true;
  }

  /** @param {string} k @param {any} v */
  async function lgSetFmt(k, v) {
    if (!lg.cur) return false;
    if (!lgFmtSet(lgSeason(lg.cur), k, v)) return false;
    lgLiveSync(lg.cur); // la copa no sortea en cada pelea
    await lgSave(lg.cur);
    lgRender();
    return true;
  }

  /** @param {Record<string, any>} rules */
  async function lgSetRules(rules) {
    if (!lg.cur) return;
    lgSeason(lg.cur).rules = rules;
    await lgSave(lg.cur);
    lgRender();
  }

  /** @param {string} name */
  async function lgRename(name) {
    const v = String(name || '').trim();
    if (!lg.cur || !v || lgIsScratch(lg.cur)) return;
    lg.cur.name = v;
    await lgSave(lg.cur);
    lgRender();
  }

  /** @param {number} i */
  async function lgEntrantRemove(i) {
    if (!lg.cur) return;
    lgSeason(lg.cur).entrants.splice(i, 1);
    await lgSave(lg.cur);
    lgRender();
  }

  /** @param {number} i @param {{qty?: any, color?: string}} patch */
  async function lgEntrantSet(i, patch) {
    if (!lg.cur) return;
    const x = lgSeason(lg.cur).entrants[i];
    if (!x) return;
    if ('qty' in patch) {
      const q = parseInt(patch.qty, 10);
      if (q > 0) x.qty = Math.min(200, q);
      else delete x.qty;
    }
    if (patch.color !== undefined) x.color = patch.color;
    await lgSave(lg.cur);
    lgRender();
  }

  async function lgClearScratch() {
    if (lg.live && lg.live.league === LG_SCRATCH_ID) leagueAbort();
    lg.scratch = lgScratchNew(null, reglasBase(), nombres);
    await lgSelect(lg.scratch.L);
    lgNote('scratch-cleared');
  }

  // El botón 🗑: vacía el Scratch o borra el torneo abierto.
  async function lgDeleteCurrent() {
    if (!lg.cur) return;
    if (lgIsScratch(lg.cur)) await lgClearScratch();
    else await lgDelete(lg.cur);
    if (!lg.cur) await lgSelect(lgScratch());
  }

  // ---- TV mode (la lógica de tvEdition y tvNext) ------------------------------------
  // Una edición: la temporada abierta si está a medias; si no tiene partidos,
  // se vuelve a sortear; si terminó, temporada nueva con sorteo nuevo. Con el
  // sorteo en cada pelea no se sortea nada aquí: lo hace lgTvNext.
  // Devuelve {ok: true, drawn, season, live, n} o {ok: false, clave, params}:
  //   tv-pool-short {pool}  "The draw pool ({pool}) has fewer than 2 bots: TV mode off."
  //   tv-pool-few {pool}    "The draw pool ({pool}) has fewer than 2 readable bots: TV mode off."
  //   tv-cup-size {n}       "A World cup needs 8, 16 or 32 entrants; this edition drew {n}: TV mode off."
  /** @param {League} L */
  async function lgEdition(L) {
    const S = lgSeason(L);
    const ms = lgSeasonMatches(S.no);
    let r = null;
    if (!ms.length) {
      if (lgLiveSync(L)) await lgSave(L);
      if (!S.live) r = await lgRedraw(L);
    } else if (lgSeasonDone(S, ms)) r = await lgNewSeason(L, { draw: true });
    const cur = lgSeason(L);
    if (cur.live) {
      if (lgPool(cur.live.pool).length < 2)
        return { ok: false, clave: 'tv-pool-short', params: { pool: cur.live.pool } };
    } else if (cur.entrants.length < 2) {
      return { ok: false, clave: 'tv-pool-few', params: { pool: lgDrawOf(L).pool } };
    }
    if (cur.fmt.format === 'cup' && !lgCupSizeOk(cur))
      return { ok: false, clave: 'tv-cup-size', params: { n: cur.entrants.length } };
    await lgCupEnsure(L); // copa: los grupos de la edición
    return { ok: true, drawn: r, season: cur.no, live: !!cur.live, n: cur.entrants.length };
  }

  // La pelea siguiente del TV mode: {t: 'pelea', fx} · {t: 'fin', champ} ·
  // {t: 'error', clave: 'tv-pool-fight'} ("The draw pool has too few readable
  // bots for the next fight: TV mode off.").
  /** @param {League} L */
  async function lgTvNext(L) {
    await lgLiveFill(L); // sorteo en cada pelea: los de esta
    await lgSwissEnsure(L); // suizo: el orden de la ronda 1
    const S = lgSeason(L);
    const fx = lgNextFixture(L);
    if (!fx && !lgSeasonDone(S, lgSeasonMatches(S.no)))
      return { t: 'error', clave: 'tv-pool-fight' };
    if (!fx) return { t: 'fin', champ: lgSeasonChampion(S, lgSeasonMatches(S.no)) };
    return { t: 'pelea', fx };
  }

  return {
    lg,
    lgFind,
    lgSeasonMatches,
    lgNextFixture,
    lgCupEnsure,
    lgSwissEnsure,
    lgLoadAll,
    lgSelect,
    lgSave,
    lgCreate,
    lgScratch,
    lgScratchSave,
    lgDelete,
    lgNewSeason,
    lgLiveOn,
    lgLiveSync,
    lgEnrollOne,
    lgLiveFill,
    lgRedraw,
    lgExport,
    lgImport,
    lgMigrateRoster,
    lgOldHofFile,
    lgOldHofDiscard,
    lgAddEntrant,
    lgEnroll,
    lgDrawRandom,
    lgPool,
    lgPlayNext,
    lgPlay,
    lgReplay,
    lgReplayCheck,
    leagueAbort,
    lgRecord,
    leagueOnMessage,
    lgOnStats,
    lgAdd,
    lgAddItems,
    lgSetDraw,
    lgCupRedraw,
    lgSetFmt,
    lgSetRules,
    lgRename,
    lgEntrantRemove,
    lgEntrantSet,
    lgClearScratch,
    lgDeleteCurrent,
    lgEdition,
    lgTvNext,
  };
}
