// @ts-check
// Competir: rondas en segundo plano, el lanzamiento de un partido y
// «Repetir y analizar» (paso N3.4 de port/web2/PLAN.md; decisiones 1, 10,
// 17, 21, 22 y 23; C15, C19 y C20). Sin DOM ni texto de interfaz: lo que
// ve el usuario son claves ({clave, params}) que la interfaz traduce.
//
// ============================================================================
// API PARA LA INTERFAZ DE COMPETIR (N3.5)
// ============================================================================
// El estado vive en crearTorneos (engine/torneos.js, nombres de la clásica);
// este módulo pone lo puro que falta y el ejecutor de la cola vive en
// src/lib/trabajos/partido.js. Todo lo que sigue opera sobre el torneo
// abierto (T.lg.cur) salvo que se diga otra cosa.
//
// 0. Arranque (una vez, antes de T.lgLoadAll()):
//      migrarLigas(almacen)                    engine/migracion.js: copia
//        `darwinbots-ligas` de la clásica (una sola vez; la clásica no se
//        toca) → {nueva, resumen: {existia, version?, torneos, partidos,
//        yaEstaban, partidosReasignados, invalidos}} para el aviso (decisión 17).
//      const T = crearTorneos({almacen, inventario, reglasBase, kv, lanzar,
//        alEvento}); await T.lgLoadAll();
//      reglasBase = () => reglasDeEscenario(escenario de fábrica 'partido-f1'
//        sin especies) — las reglas de un torneo nuevo (decisión 21).
//
// 1. Crear torneo (asistente de 3 pasos, decisión 22):
//      paso 1 · formato:   L = await T.lgCreate(reglas); await T.lgSetFmt(k, v)…
//        (campos: LG_FMT_FIELDS de league.js; format ∈ LG_FORMATS). El
//        esquema de cada formato sale de las funciones de estado de
//        league.js (lgRrFixtures, lgCupState, lgSwissRounds…).
//      paso 2 · participantes (ADN congelado desde la Biblioteca):
//        const ps = participantesDeEntradas(entradasDe(indice, claves), adnDe)
//        for (const p of ps) await T.lgAdd(p)     // el ADN queda en la temporada
//        (entradasDe de engine/biblioteca.js; adnDe(entrada) → texto del .txt
//        para los del foro, entrada.adn para los propios). Sorteo desde un
//        pool: inventarioDeBiblioteca(…) como `inventario` de crearTorneos.
//      paso 3 · reglas:    await T.lgSetRules(reglasDeEscenario(escenario))
//        La temporada queda bloqueada desde su primer partido:
//        reglasBloqueadas(S, ms) → true; lgSetRules y lgSetFmt devuelven
//        false y avisan 'locked' (nota). Temporada nueva: T.lgNewSeason(L).
//      Partido rápido sin guardar: el Scratch (T.lgScratch(), formato
//        single) y «Guardar como torneo»: T.lgScratchSave(nombre).
//
// 2. Jugar el siguiente («Jugar y mirar», en Observar):
//      await T.lgPlayNext()  → llama deps.lanzar(plan). El anfitrión:
//        lanzamiento(plan) → {escenario, semilla, f1}; corrida.iniciar(
//          escenario, semilla); for (m of f1) sesion.c.enviar(m);
//          sesion.correr(true)
//        y reenvía a T.leagueOnMessage(msg) los f1-started, f1-note y
//        f1-over del worker, y a T.lgOnStats(stats) el stats de cada frame.
//        (Sin corrida: mandar mensajesDelPlan(plan) tal cual al worker.)
//      El resultado llega como alEvento {t:'resultado', rec}.
//
// 3. Jugar la ronda en segundo plano (decisión 23):
//      const r = await T.lgRonda()  → null (con nota: season-complete,
//        pool-short, too-few, cup-size, round-running, round-scratch,
//        match-running) o {params, n}: los partidos que el formato permite
//        jugar ya (partidosDeRonda), cada uno con su semilla; params
//        compactos (crearParamsRonda: ADN y reglas una vez; el ejecutor arma
//        cada plan con planDeRonda). El Scratch no juega rondas
//        ('round-scratch': no se guarda, su ronda no se podría registrar).
//        La temporada queda marcada (S.ronda) y, hasta registrar o cancelar
//        la ronda, no se puede (nota 'round-running'): jugar a mano (lgPlayNext;
//        lgPlay lanza ErrorLiga 'round-running' salvo las repeticiones),
//        otra ronda, lgAdd, lgAddItems, lgSetDraw, lgRedraw, lgCupRedraw,
//        lgEntrantRemove, lgEntrantSet, lgNewSeason, lgSetFmt ni lgSetRules
//        ('locked'); lgEdition/lgTvNext devuelven clave 'round-running'.
//        La interfaz deshabilita esos controles si lgSeason(L).ronda.
//      const id = await cola.encolar({tipo: TIPO_RONDA, params: r.params,
//        unidades: r.n, titulo: r.params.nombre})  (engine/cola.js)
//      Si encolar falla: T.lgRondaCancelar(r.params.ronda).
//      REGISTRO: lo hace SOLO la pestaña dueña de la cola (C20; `propia` en
//      el alTerminar de ColaCompartida), con una sola función que mira la
//      cola y el almacén (no la memoria):
//        T.lgReconciliarRondas(cola) → {registradas, canceladas, enCurso}
//        por cada temporada guardada con S.ronda: trabajo terminado →
//        lgRegistrarRonda(t.params, cola.resultados(t.id)); cancelado,
//        fallido o ausente (borrado; con RONDA_GRACIA_MS de margen para uno
//        recién encolado desde otra pestaña) → lgRondaCancelar; pendiente o
//        corriendo → nada. Llamarla en src/lib/trabajos/trabajos.svelte.js:
//          alDuena: () => { alCambio(); torneos.lgReconciliarRondas(cola) }
//            (al arrancar la dueña, tras reanudar: rondas huérfanas de una
//            recarga o de otra pestaña que se cerró)
//          alTerminar(t, propia): if (t.tipo === TIPO_RONDA)
//            propia ? torneos.lgReconciliarRondas(cola)
//                   : torneos.lgRefrescar(t.params.league)
//          y después de cancelar o borrar un trabajo de ronda desde la
//          interfaz: en la dueña, lgReconciliarRondas(cola) (la cola no
//          llama alTerminar al cancelar ni al borrar); en otra pestaña,
//          lgRefrescar(league) un momento después (lo hace la dueña).
//        lgRegistrarRonda → {registrados, nulos, descartados, previos, ya,
//        error?}: una transacción sobre la liga guardada; registra solo si la
//        temporada guardada tiene la marca de ESA ronda (una cancelada y
//        vuelta a pedir, o jugada a mano después, no duplica nada);
//        idempotente por partido (rec.ronda + rec.rondaI), también entre
//        pestañas; en serie por liga dentro de la pestaña. Nota
//        'round-recorded'. Lo ya jugado de una ronda cancelada se pierde: se
//        pide otra ronda, con semillas nuevas.
//      Reintentar: el ejecutor es `reintentable: false`; la cola rechaza
//        reintentar(id) de una ronda con ErrorCola 'no-reintentable' (la
//        interfaz no ofrece «Reintentar» si t.tipo === TIPO_RONDA).
//      Otras pestañas: su memoria de la liga queda vieja cuando la dueña
//        registra; T.lgRefrescar(leagueId) la vuelve a leer del almacén.
//      El ejecutor: ejecutorRonda({pool}) de src/lib/trabajos/partido.js
//        (registro: {[TIPO_RONDA]: ejecutorRonda({pool})} junto a los de
//        src/lib/trabajos/ejecutores.js).
//
// 4. Repetir:
//      ↻ repetir y comparar con lo registrado: T.lgReplay(id) (como la clásica).
//      «Repetir y analizar» (decisión 22): repeticionDe(L, m) (o
//        T.lgRepeticion(id) sobre el torneo abierto) → {escenario, semilla,
//        f1, plan}. La interfaz: corrida.iniciar(escenario, semilla); for (m
//        of f1) sesion.c.enviar(m); sesion.correr(true); y abre Analizar.
//        Lanza ErrorLiga 'replay-missing' {no, season} si falta un
//        participante y ErrorEscenario si las reglas no caben en un
//        escenario (valores fuera del tipo del core).
//
// 5. Tablas, Elo y Salón de la fama:
//      lgStandings(S, ms) (tabla de la temporada, con Elo), lgAllTime(L, ms)
//      (histórico del torneo), lgSwissState/lgCupState/lgKothState/
//      lgLadderState (estructura por formato) de league.js, y el Salón de la
//      fama global: await T.lgSalon() (todos los torneos guardados; pura:
//      lgSalonGlobal(ligas, partidos) de torneos.js).
//
// 6. Exportar / importar: T.lgExport(L) → {obj, fileName} (la interfaz baja
//      JSON.stringify(obj)); T.lgImport(texto) acepta los archivos v1 y v2 de
//      la clásica y los de la nueva (las reglas-escenario viajan dentro de
//      rules). La clásica, al importar un torneo con reglas-escenario, juega
//      con su panel (no conoce `rules.escenario`).
// ============================================================================
//
// REGLAS DEL MUNDO (decisión 21). S.rules es una de dos cosas:
//   - foto del panel de la clásica ({'o-11': '180', 'o-shape': 'tor', …}):
//     los torneos migrados o importados de la clásica (lgF1Rules,
//     lgCaptureRules…). Las opciones del reset son reglasAOpciones(rules,
//     opcionesBaseClasica()) (el panel de la clásica sin tocar debajo).
//   - reglas-escenario {escenario}: un escenario de engine/escenarios SIN
//     especies (opciones y objetos). Las de la nueva.
// En los dos casos el partido es un ESCENARIO EFECTIVO (escenarioDelPartido):
// las reglas + el alga de arranque de la clásica + los luchadores con su ADN
// congelado + el modo F1 (91, 97, 98, 99 y 100) en los cambios. Así el
// partido de la cola, el de «Jugar y mirar» y el de «Repetir y analizar» son
// la misma secuencia: aplicar(escenario, semilla) (reset limpio, C15) y los
// mensajes de F1 (topes y f1start). test/rondas_worker.test.js verifica que,
// con una foto de la clásica, da lo mismo que los mensajes de la clásica
// (mensajesPartido). Si la foto no cabe en un escenario (un valor fuera del
// tipo del core, C23), el lanzamiento cae a mensajesPartido con reset limpio
// y ese partido no se puede abrir en Analizar.
//
// RONDA (decisión 23): los partidos que el formato deja jugar ahora sin
// depender de otros resultados, en el orden del calendario:
//   rr          todos los cruces pendientes del calendario            (libre)
//   cup grupos  todos los partidos de grupo pendientes                 (libre)
//   cup cuadro  los cruces pendientes de la ronda del cuadro; el 3.er
//               puesto va solo (la final se juega en la ronda siguiente) (estricto)
//   swiss       los cruces pendientes de la ronda suiza en curso       (estricto)
//   single, koth, ladder: el partido siguiente (dependen del anterior)
// Cada partido lleva su semilla, sacada del azar del torneo en el mismo orden
// que lgPlay (Math.floor(azar() · 100000)): sin nulos, la ronda juega los
// mismos cruces con las mismas semillas que jugándolos uno por uno, y el
// resultado de cada partido es el mismo (test obligatorio de la decisión 23,
// test/rondas_worker.test.js).
// Registro (lgRegistrarRonda): en el orden del calendario. En 'estricto' cada
// partido tiene que ser el siguiente del formato en ese momento (un nulo se
// repite: los que venían después se descartan y se vuelven a jugar en la
// ronda siguiente, con otra semilla); en 'libre', cualquiera que siga
// pendiente (el nulo se repite en la ronda siguiente en vez de enseguida).
//
// Errores (ErrorLiga, tabla de league.js): replay-missing {no, season}
// (repeticionDe); rule-unknown {clave} (cambiosDeOpciones: una opción de la
// foto que el catálogo de engine/opciones.js no tiene). ErrorEscenario de
// engine/escenarios si las reglas no caben en un escenario. round-bad {i}
// (planDeRonda: el partido i o uno de sus participantes no está en los
// params) y round-running {} (lgPlay con una ronda en curso), sin texto en
// la clásica.

import { aplicar, normalizar } from './escenarios/index.js';
import {
  ErrorLiga,
  LG_NO_COLOR,
  lgCupRound,
  lgCupState,
  lgFixture,
  lgHash,
  lgLaunchList,
  lgPairKey,
  lgPlayed,
  lgRrFixtures,
  lgSeasonDone,
  lgSwissState,
} from './league.js';
import { fusionarCambios, opcionesReset, parametro, valoresResueltos } from './opciones.js';
import {
  ALGA_ARRANQUE,
  fijarModoF1,
  mensajesPartido,
  mensajesTopes,
  planPartido,
  reglasAOpciones,
  siembraArranque,
} from './partido.js';

/**
 * @typedef {import('./league.js').League} League
 * @typedef {import('./league.js').Season} Season
 * @typedef {import('./league.js').Match} Match
 * @typedef {import('./league.js').Entrant} Entrant
 * @typedef {import('./league.js').Rotulo} Rotulo
 * @typedef {import('./partido.js').Plan} Plan
 * @typedef {import('./escenarios/index.js').Escenario} Escenario
 * @typedef {{fighters: Entrant[], label: Rotulo}} PartidoRonda
 * @typedef {{orden: 'libre' | 'estricto', partidos: PartidoRonda[]}} Ronda
 * @typedef {{fighters: string[], seed: number, label: Rotulo, plan?: Plan}} PartidoParams
 *   plan: solo en los params de formato 1 (el plan entero por partido); desde
 *   el formato 2 lo arma planDeRonda.
 * @typedef {{name: string, dna: string, color: string, qty?: number}} ParticipanteRonda
 * @typedef {{formato: number, league: string, nombre: string, season: number, ronda: string,
 *   formatoTorneo: string, orden: 'libre' | 'estricto', fmt?: import('./league.js').Fmt,
 *   rules?: Record<string, any>, participantes?: ParticipanteRonda[],
 *   partidos: PartidoParams[]}} ParamsRonda
 * @typedef {{winner: string, note: string, f1: any, cycles: number, capRounds: number,
 *   wins: number[], capWins: number[], fighters: string[], seed: number}} ResultadoPartido
 */

/** Tipo de trabajo de la cola (engine/cola.js) de una ronda de torneo. */
export const TIPO_RONDA = 'ronda';
/**
 * Versión del formato de ParamsRonda (lo que guarda la cola). 2: compactos
 * (el ADN de cada participante y las reglas una sola vez; el ejecutor arma
 * el plan de cada partido con planDeRonda). 1: el plan entero en cada
 * partido (se siguen aceptando).
 */
export const FORMATO_RONDA = 2;
/** Id del escenario efectivo de un partido (escenarioDelPartido). */
export const ID_ESCENARIO_PARTIDO = 'partido-torneo';
/** Nombre del alga de arranque como especie de escenario (`${bot}.txt` = ALGA_ARRANQUE.name). */
export const BOT_ALGA = ALGA_ARRANQUE.name.replace(/\.txt$/, '');

// ---- Reglas ------------------------------------------------------------------------

/**
 * Las opciones del panel de la clásica sin tocar (la base de reglasAOpciones
 * para las fotos de la clásica: 'clasica' de engine/opciones.js replica su
 * collectOptions).
 */
export const opcionesBaseClasica = () => opcionesReset(valoresResueltos('clasica'));

/** ¿Son reglas-escenario (de la nueva)? @param {any} rules */
export const esReglasEscenario = (rules) =>
  !!rules && typeof rules === 'object' && !!rules.escenario && typeof rules.escenario === 'object';

/**
 * Reglas de torneo desde un escenario (decisión 21): el escenario sin
 * especies, normalizado (lanza ErrorEscenario si no valida). Lo que se
 * guarda en S.rules.
 * @param {any} e
 * @returns {{escenario: Escenario}}
 */
export function reglasDeEscenario(e) {
  const n = normalizar({ ...e, especies: [] });
  return { escenario: { ...n, especies: [] } };
}

/**
 * ¿Están bloqueadas las reglas y el formato de la temporada? Desde su primer
 * partido (también un nulo), como la clásica (tournament.js: locked).
 * @param {Season} S @param {Match[]} ms  partidos del torneo (se filtran por temporada)
 */
export const reglasBloqueadas = (S, ms) => ms.some((m) => m.season === S.no);

// ---- El escenario efectivo de un partido -----------------------------------------

/** Long BGR de VB6 → "#rrggbb" (inversa de cssToVbColor). @param {number} c */
export function vbColorACss(c) {
  const n = Math.trunc(Number(c)) >>> 0;
  const h = (/** @type {number} */ x) => (x & 255).toString(16).padStart(2, '0');
  return `#${h(n)}${h(n >> 8)}${h(n >> 16)}`;
}

/**
 * Opciones del reset (forma de collectOptions) → cambios de escenario sobre
 * la base 'clasica' ({'opt:11': 180, 'cost:30': 0.1, 'base:fieldW': …}).
 * opt:1 (Toroidal) es derivado: no va (opcionesReset lo manda si 2 y 3
 * quedan conectados; en el core solo cambia el campo Toroidal del .dbsim).
 * Lanza ErrorLiga('rule-unknown', {clave}) si una opción no está en el
 * catálogo.
 * @param {any} o
 * @returns {Record<string, number>}
 */
export function cambiosDeOpciones(o) {
  /** @type {Record<string, number>} */
  const c = {};
  /** @param {string} clave @param {any} v */
  const pon = (clave, v) => {
    if (!parametro(clave)) throw new ErrorLiga('rule-unknown', { clave });
    c[clave] = typeof v === 'boolean' ? (v ? 1 : 0) : Number(v);
  };
  for (const [k, v] of Object.entries(o)) {
    if (k === 'opts' || k === 'costs') continue;
    pon(`base:${k}`, v);
  }
  for (const [id, v] of Object.entries(o.opts || {})) if (id !== '1') pon(`opt:${id}`, v);
  for (const [i, v] of Object.entries(o.costs || {})) pon(`cost:${i}`, v);
  return c;
}

/**
 * El escenario efectivo de un partido: las reglas (foto de la clásica sobre
 * su panel sin tocar, o reglas-escenario) con el modo F1 del partido en los
 * cambios, y como especies el alga de arranque y los luchadores del plan
 * (ADN congelado, `${nombre}.txt` en la sim como en mensajesPartido).
 * Normalizado: lanza ErrorEscenario si no valida.
 * @param {Plan} plan @param {{nombre?: string}} [o]  nombre del escenario (dato; por defecto los luchadores)
 * @returns {Escenario}
 */
export function escenarioDelPartido(plan, o = {}) {
  /** @type {any} */
  let opciones;
  /** @type {any} */
  let objetos = { obstaculos: [], teleporters: [] };
  const f1 = fijarModoF1({}, plan);
  const cambiosF1 = Object.fromEntries(Object.entries(f1).map(([id, v]) => [`opt:${id}`, v]));
  if (esReglasEscenario(plan.rules)) {
    const e = plan.rules.escenario;
    opciones = { base: e.opciones.base, cambios: fusionarCambios(e.opciones.cambios, cambiosF1) };
    objetos = e.objetos ?? objetos;
  } else {
    const r = reglasAOpciones(plan.rules || {}, opcionesBaseClasica());
    fijarModoF1(r.opts, plan);
    opciones = { base: 'clasica', cambios: cambiosDeOpciones(r) };
  }
  const alga = siembraArranque()[0];
  const especies = [alga, ...plan.species].map((sp) => ({
    bot: String(sp.name).replace(/\.txt$/, ''),
    origen: 'propio',
    hash: lgHash(sp.dna),
    adn: sp.dna,
    cantidad: sp.qty,
    color: vbColorACss(sp.color),
    vegetal: !!sp.veg,
    energia: sp.nrg,
  }));
  const nombre =
    o.nombre || plan.species.map((sp) => String(sp.name).replace(/\.txt$/, '')).join(' · ') || '·';
  return normalizar({
    formato: 1,
    id: ID_ESCENARIO_PARTIDO,
    nombre,
    destino: 'competir',
    opciones,
    especies,
    objetos,
  });
}

/**
 * Lo que va DESPUÉS del escenario (corrida.iniciar o aplicar): los topes del
 * Canal y el censo del contest. Tras un reset limpio: los topes no
 * sobreviven al reset (C15), por eso van después. No arranca la sim.
 * @param {Plan} plan
 */
export const mensajesF1 = (plan) => [...mensajesTopes(plan), { t: 'f1start' }];

/**
 * Cómo lanzar el partido con una corrida (Observar: «Jugar y mirar» y
 * «Repetir y analizar»): corrida.iniciar(escenario, semilla), después los
 * mensajes `f1` y correr. null si las reglas no caben en un escenario (el
 * anfitrión manda mensajesDelPlan(plan) al worker sin corrida).
 * @param {Plan} plan @param {{nombre?: string}} [o]
 * @returns {{escenario: Escenario, semilla: number, f1: any[]} | null}
 */
export function lanzamiento(plan, o = {}) {
  let escenario;
  try {
    escenario = escenarioDelPartido(plan, o);
  } catch (e) {
    if (esReglasEscenario(plan.rules)) throw e;
    return null;
  }
  return { escenario, semilla: plan.seed, f1: mensajesF1(plan) };
}

/**
 * La secuencia completa de un partido para un worker (la cola; o la página
 * sin corrida): el escenario efectivo con aplicar() (reset limpio, C15) +
 * mensajesF1 + correr. Si una foto de la clásica no cabe en un escenario,
 * mensajesPartido de la clásica con reset limpio (mismo resultado: ver la
 * cabecera).
 * @param {Plan} plan
 * @returns {any[]}
 */
export function mensajesDelPlan(plan) {
  const l = lanzamiento(plan);
  if (!l)
    return mensajesPartido(
      plan,
      reglasAOpciones(plan.rules || {}, opcionesBaseClasica()),
      undefined,
      {
        limpio: true,
      },
    );
  return [
    ...aplicar(l.escenario, l.semilla).map((m) => (m.t === 'reset' ? { ...m, quietF1: true } : m)),
    ...l.f1,
    { t: 'run', running: true },
  ];
}

// ---- Repetir y analizar -------------------------------------------------------------

/**
 * El plan de un partido guardado: su temporada (reglas y valores), sus
 * participantes (ADN congelado, en el orden de siembra) y su semilla.
 * Lanza ErrorLiga('replay-missing', {no, season}) si falta alguno.
 * @param {League} L @param {Match} m
 * @returns {Plan}
 */
export function planDePartido(L, m) {
  const S = L.seasons.find((s) => s.no === m.season);
  const fighters = m.fighters.map((n) => S?.entrants.find((e) => e.name === n));
  if (!S || fighters.some((e) => !e))
    throw new ErrorLiga('replay-missing', { no: m.no, season: m.season });
  const f = S.fmt;
  return planPartido(
    lgLaunchList(f, /** @type {Entrant[]} */ (fighters)),
    valoresDePartido(f),
    parseFloat(String(m.seed)) || 0,
    S.rules,
  );
}

/**
 * Los valores del partido de una temporada (los que lgPlay le pasa a
 * planPartido).
 * @param {import('./league.js').Fmt} f
 */
export const valoresDePartido = (f) => ({
  nrg: f.nrg,
  rounds: f.rounds,
  wins: f.wins,
  cap: f.cap,
  capMode: f.capMode,
  popCap: f.popCap || 0,
});

/**
 * «Repetir y analizar» (decisión 22): el escenario efectivo y la semilla del
 * partido para correrlo de nuevo con dibujo y abrirlo en Analizar. La
 * interfaz: corrida.iniciar(escenario, semilla) + los mensajes `f1` +
 * correr. Lanza ErrorLiga('replay-missing') o ErrorEscenario.
 * @param {League} L @param {Match} m @param {{nombre?: string}} [o]
 */
export function repeticionDe(L, m, o = {}) {
  const plan = planDePartido(L, m);
  const escenario = escenarioDelPartido(plan, o);
  return { escenario, semilla: plan.seed, f1: mensajesF1(plan), plan };
}

// ---- Ronda --------------------------------------------------------------------------

/** @param {string} clave @param {Record<string, any>} [params] @returns {Rotulo} */
const rotulo = (clave, params = {}) => ({ clave, params });

/**
 * Los partidos de la ronda (ver la cabecera): los que el formato deja jugar
 * ahora, en el orden del calendario, con el mismo rótulo que tendrían
 * jugándolos uno por uno. El primero es siempre lgFixture(S, ms, rnd). rnd
 * solo lo usa el rey de la colina (el sorteo de los retadores, como
 * lgFixture). ms: los partidos de la temporada.
 * @param {Season} S @param {Match[]} ms @param {() => number} [rnd]
 * @returns {Ronda}
 */
export function partidosDeRonda(S, ms, rnd = Math.random) {
  /** @type {Ronda} */
  const vacia = { orden: 'estricto', partidos: [] };
  if (S.entrants.length < 2 || lgSeasonDone(S, ms)) return vacia;
  const f = S.fmt.format;
  if (f === 'rr') {
    const E = S.entrants;
    const fx = lgRrFixtures(E.length, S.fmt.legs);
    const cnt = new Map();
    for (const m of lgPlayed(ms)) {
      if (m.fighters.length !== 2) continue;
      const k = lgPairKey(m.fighters[0], m.fighters[1]);
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    /** @type {Entrant[][]} */
    const pendientes = [];
    let played = 0;
    for (const x of fx) {
      const [a, b] = x.pair;
      if ((cnt.get(lgPairKey(E[a].name, E[b].name)) || 0) >= x.leg) played++;
      else pendientes.push([E[a], E[b]]);
    }
    return {
      orden: 'libre',
      partidos: pendientes.map((fighters, k) => ({
        fighters,
        label: rotulo('rr', { no: played + k + 1, total: fx.length }),
      })),
    };
  }
  if (f === 'swiss') {
    const st = lgSwissState(S, ms);
    if (st.phase !== 'play') return vacia;
    const rd = st.history[st.history.length - 1];
    const E = new Map(S.entrants.map((e) => [e.name, e]));
    /** @type {PartidoRonda[]} */
    const partidos = [];
    rd.pairs.forEach((/** @type {any} */ t, /** @type {number} */ k) => {
      if (t.winner) return;
      partidos.push({
        fighters: [/** @type {Entrant} */ (E.get(t.a)), /** @type {Entrant} */ (E.get(t.b))],
        label: rotulo('swiss', {
          round: rd.no,
          rounds: st.rounds,
          match: k + 1,
          matches: rd.pairs.length,
          bye: rd.bye,
        }),
      });
    });
    return { orden: 'estricto', partidos };
  }
  if (f === 'cup') {
    const st = lgCupState(S, ms);
    const E = new Map(S.entrants.map((e) => [e.name, e]));
    /** @param {string} a @param {string} b */
    const par = (a, b) => [/** @type {Entrant} */ (E.get(a)), /** @type {Entrant} */ (E.get(b))];
    if (st.phase === 'groups') {
      const days = Math.max(...st.fixtures.map((/** @type {any} */ x) => x.day));
      /** @type {PartidoRonda[]} */
      const partidos = st.fixtures
        .filter((/** @type {any} */ x) => !x.winner)
        .map((/** @type {any} */ x) => ({
          fighters: par(x.a, x.b),
          label: rotulo('cup-group', { group: String.fromCharCode(65 + x.gi), day: x.day, days }),
        }));
      return { orden: 'libre', partidos };
    }
    if (st.phase === 'ko') {
      if (st.third && !st.third.winner)
        return {
          orden: 'estricto',
          partidos: [{ fighters: par(st.third.a, st.third.b), label: rotulo('cup-third') }],
        };
      const ties = st.bracket[st.bracket.length - 1];
      /** @type {PartidoRonda[]} */
      const partidos = [];
      ties.forEach((/** @type {any} */ t, /** @type {number} */ k) => {
        if (!t.winner)
          partidos.push({
            fighters: par(t.a, t.b),
            label: lgCupRound(ties.length, ties.length > 1 ? k + 1 : 0),
          });
      });
      return { orden: 'estricto', partidos };
    }
    return vacia;
  }
  // single, koth y ladder: el siguiente (depende del resultado del anterior).
  const fx = lgFixture(S, ms, rnd);
  return fx ? { orden: 'estricto', partidos: [fx] } : vacia;
}

/**
 * ¿Coincide un partido de la ronda con uno pendiente? Mismos nombres en el
 * mismo orden de siembra.
 * @param {{fighters: {name: string}[]}} a @param {string[]} nombres
 */
export const mismoCruce = (a, nombres) =>
  a.fighters.length === nombres.length && a.fighters.every((e, i) => e.name === nombres[i]);

/**
 * Los parámetros de un trabajo de ronda (formato 2). Autocontenidos, para
 * reanudar tras una recarga sin pedir nada, pero compactos: el ADN de cada
 * participante y las reglas van UNA vez (un rr de 30 ida y vuelta son 870
 * partidos: con el plan entero en cada uno eran ~5,9 MB, copiados en cada
 * unidad). Cada partido lleva sus nombres, su semilla y su rótulo; el
 * ejecutor arma su plan con planDeRonda (el mismo que lgPlay).
 * @param {{league: League, season: Season, ronda: string, orden: 'libre' | 'estricto',
 *   partidos: {fighters: Entrant[], label: Rotulo, seed: number}[]}} o
 * @returns {ParamsRonda}
 */
export function crearParamsRonda(o) {
  /** @type {Map<string, ParticipanteRonda>} */
  const participantes = new Map();
  for (const p of o.partidos)
    for (const e of p.fighters)
      if (!participantes.has(e.name))
        participantes.set(e.name, {
          name: e.name,
          dna: e.dna,
          color: e.color,
          ...(e.qty ? { qty: e.qty } : {}),
        });
  return {
    formato: FORMATO_RONDA,
    league: o.league.id,
    nombre: o.league.name,
    season: o.season.no,
    ronda: o.ronda,
    formatoTorneo: o.season.fmt.format,
    orden: o.orden,
    fmt: structuredClone(o.season.fmt),
    rules: structuredClone(o.season.rules),
    participantes: [...participantes.values()],
    partidos: o.partidos.map((p) => ({
      fighters: p.fighters.map((e) => e.name),
      seed: p.seed,
      label: p.label,
    })),
  };
}

/**
 * El plan del partido i de la ronda (lo que lgPlay lanzaría con esa
 * semilla): planPartido(lgLaunchList(fmt, luchadores), valoresDePartido(fmt),
 * semilla, reglas). Params de formato 1: el plan guardado. Lanza
 * ErrorLiga('no-dna') si falta un ADN y ErrorLiga('round-bad', {i}) si el
 * partido o un participante no está.
 * @param {ParamsRonda} p @param {number} i
 * @returns {Plan}
 */
export function planDeRonda(p, i) {
  const x = p.partidos[i];
  if (!x) throw new ErrorLiga('round-bad', { i });
  if (x.plan) return x.plan;
  const fmt = /** @type {import('./league.js').Fmt} */ (p.fmt);
  const fighters = x.fighters.map((n) => p.participantes?.find((e) => e.name === n));
  if (!fmt || fighters.some((e) => !e)) throw new ErrorLiga('round-bad', { i });
  return planPartido(
    lgLaunchList(fmt, /** @type {any[]} */ (fighters)),
    valoresDePartido(fmt),
    x.seed,
    p.rules,
  );
}

/**
 * Los params sin el ADN ni las reglas (la lista de la cola): quedan los
 * datos de la ronda y los partidos (nombres, semilla y rótulo), lo que
 * lgRegistrarRonda y lgReconciliarRondas necesitan.
 * @param {ParamsRonda} p
 */
export function vistaParamsRonda(p) {
  const { partidos, participantes: _pa, rules: _r, ...resto } = p;
  return {
    ...structuredClone(resto),
    partidos: partidos.map(({ plan: _p, ...x }) => structuredClone(x)),
  };
}

/**
 * Resumen de la ronda para la cola (t.resumen): lo que dio cada partido, sin
 * el marcador por ronda.
 * @param {ParamsRonda} p @param {(ResultadoPartido | null)[]} datos
 */
export function resumenRonda(p, datos) {
  return {
    ronda: p.ronda,
    partidos: p.partidos.map((x, i) => {
      const r = datos[i];
      return r
        ? { fighters: x.fighters, seed: x.seed, winner: r.winner, wins: r.wins, cycles: r.cycles }
        : null;
    }),
  };
}

// ---- Participantes desde la Biblioteca ----------------------------------------------

/**
 * Entradas de la Biblioteca (engine/biblioteca.js: entradasDe(indice, claves))
 * → participantes para T.lgAdd / lgAddEntrant, con el ADN congelado ahora.
 * adnDe(entrada) → texto del ADN (los del foro: su .txt; los propios:
 * entrada.adn). Los vegetales no pelean (como lgPool). Los que no tienen
 * ADN se devuelven aparte.
 * @param {{clase: string, nombre: string, archivo?: string, vegetal: boolean, adn?: string}[]} entradas
 * @param {(e: any) => Promise<string | undefined> | string | undefined} adnDe
 */
export async function participantesDeEntradas(entradas, adnDe) {
  const participantes = [];
  const sinAdn = [];
  for (const e of entradas) {
    if (e.vegetal) continue;
    let dna;
    try {
      dna = e.clase === 'propio' && e.adn ? e.adn : await adnDe(e);
    } catch {
      dna = undefined;
    }
    if (!dna) {
      sinAdn.push(e.nombre);
      continue;
    }
    participantes.push({
      name: e.nombre,
      dna,
      src: e.clase === 'propio' ? 'form' : 'bestiary',
      file: e.archivo || '',
    });
  }
  return { participantes, sinAdn };
}

/**
 * El `inventario` de crearTorneos sobre la Biblioteca (sorteos del pool:
 * lgPool 'all', 'fav', 'sel', 'tag:…', 'set:…'). items: una por entrada
 * ({key: clave, b: {name, file, veg, entrada}}); sel: claves elegidas;
 * sets: nombre → {keys} (selecciones con nombre de engine/bots.js);
 * adnDe(entrada) como en participantesDeEntradas; color(): el de reserva.
 * @param {{indice: any[], sel?: Iterable<string>, selecciones?: {nombre: string, claves: string[]}[],
 *   adnDe: (e: any) => Promise<string | undefined> | string | undefined, color?: () => string}} o
 */
export function inventarioDeBiblioteca(o) {
  const porClave = new Map(o.indice.map((e) => [e.clave, e]));
  return {
    items: o.indice.map((e) => ({
      key: e.clave,
      b: { name: e.nombre, file: e.archivo || '', veg: !!e.vegetal, entrada: e },
    })),
    sel: new Set(o.sel ?? []),
    sets: new Map((o.selecciones ?? []).map((s) => [s.nombre, { keys: s.claves }])),
    /** @param {string} key */
    userRec: (key) => {
      const m = porClave.get(key)?.marcas;
      return { fav: !!m?.fav, tags: m?.tags ?? [] };
    },
    /** @param {any} b */
    fetchDna: async (b) => {
      const e = b.entrada;
      const dna = e.clase === 'propio' && e.adn ? e.adn : await o.adnDe(e);
      if (!dna) throw new Error('no-dna');
      return dna;
    },
    color: o.color ?? (() => LG_NO_COLOR),
  };
}
