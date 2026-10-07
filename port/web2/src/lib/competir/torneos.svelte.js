// @ts-check
// Competir en la página (paso N3.5; decisiones 17, 21, 22 y 23): el estado
// de torneos (crearTorneos de engine/torneos.js) sobre el almacén único de
// la página, con la Biblioteca como inventario (inventarioDeBiblioteca de
// engine/rondas.js) y el lanzamiento de los partidos en la sim de la
// página (lanzamiento(plan): corrida.iniciar + los mensajes f1 + correr).
// La API que usa es la de la cabecera de engine/rondas.js.
//
// Estado visible en runes (EstadoCompetir): `version` sube con cada
// {t:'render'} del motor (el modelo del motor es JS plano: las vistas lo
// leen de nuevo cuando cambia `version`), la última nota, el registro, el
// marcador del partido en curso y el último resultado.
//
// Jugar (decisión 23): lgPlay desde el avance de Observar (tv.svelte.js) → la sim de la
// página; los f1-started/f1-note/f1-over del worker van a leagueOnMessage y
// las stats de cada frame a lgOnStats (y al marcador). Si otra cosa toma la
// sim (una corrida nueva desde Inicio, Experimentar o una carga), el
// partido se abandona (leagueAbort, como la clásica); si la corrida del
// partido recibe cambios en caliente (Experimentar, siembra, objetos), se
// abandona también, con un aviso: un resultado alterado no se registra
// (marcaPartido/vigiaPartido de juego.js). El marcador flotante
// (Marcador.svelte) se monta en el documento la primera vez: se ve también
// en Observar.
//
// Rondas en segundo plano: lgRonda → cola (TIPO_RONDA). Al terminar, el
// alTerminar de la cola (src/lib/trabajos/trabajos.svelte.js) llama a
// alTerminarRonda: la pestaña dueña de la cola registra la ronda (o la
// libera si falló); las demás solo releen los torneos.

import { mount } from 'svelte';
import { crearPaleta } from '../../../engine/adn.js';
import { entradasDe } from '../../../engine/biblioteca.js';
import { LG_SCRATCH_ID, lgIsScratch, lgSeason } from '../../../engine/league.js';
import {
  escenarioDelPartido,
  inventarioDeBiblioteca,
  lanzamiento,
  mensajesDelPlan,
  participantesDeEntradas,
  TIPO_RONDA,
} from '../../../engine/rondas.js';
import { crearTorneos, ST_TORNEOS } from '../../../engine/torneos.js';
import { num, t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { rutaAnalizar } from '../analizar/ruta.js';
import { asegurarBiblioteca, bib, ui } from '../bots/biblioteca.svelte.js';
import { adnDeEntrada, adnForo } from '../bots/datos.js';
import { esperarMigracion } from '../bots/migracion.svelte.js';
import { borradorDe } from '../experimentar/borrador.js';
import { estadoExp } from '../experimentar/estado.svelte.js';
import { descargar } from '../observar/descargas.js';
import { almacen } from '../sim/almacen.svelte.js';
import { actual, corrida } from '../sim/corrida.svelte.js';
import { especiesPrueba } from '../sim/prueba.js';
import { sesion } from '../sim/sesion.svelte.js';
import { descartarAviso, estadoTrabajos, iniciarTrabajos } from '../trabajos/trabajos.svelte.js';
import { planCreacion, reglasDeSeleccion } from './asistente.js';
import {
  adnRosterViejo,
  escenarioDeReglas,
  liberarSiCancelada,
  marcaPartido,
  presetsClasica,
  vigiaPartido,
} from './juego.js';
import Marcador from './Marcador.svelte';
import { esperarMigracionLigas } from './migracion.svelte.js';
import { nombreTorneo, textoError } from './textos.js';

/** @typedef {import('../../../engine/league.js').League} League */
/** @typedef {import('../../../engine/league.js').Match} Match */

/** Traductor para textos.js (reactivo: t y num leen el idioma). */
export const tr = { t, num: (/** @type {number} */ n) => num(n) };

class EstadoCompetir {
  listo = $state(false);
  /** @type {unknown} error al cargar (null = ninguno; se muestra con textoError) */
  error = $state.raw(null);
  /** sube con cada cambio del modelo */
  version = $state(0);
  /** @type {{clave: string, params: Record<string, any>, aviso: boolean, n: number} | null} */
  nota = $state.raw(null);
  /** @type {{texto: string, aviso: boolean} | null} un aviso de la interfaz (no del motor) */
  aviso = $state.raw(null);
  /** @type {{clave: string, params: Record<string, any>}[]} */
  registro = $state.raw([]);
  /** @type {{cycle: number, f1: any} | null} el último frame del partido en curso */
  marcador = $state.raw(null);
  /** @type {Match | null} */
  ultimo = $state.raw(null);
  /** @type {any[] | null} Salón de la fama global (null = sin leer) */
  salon = $state.raw(null);
  /** @type {any} el Hall of Fame del Canal viejo (lgOldHofFile) o null */
  hofViejo = $state.raw(null);
  /** operación en curso ('' = ninguna) */
  ocupado = $state('');
}

export const est = new EstadoCompetir();

/** @type {ReturnType<typeof crearTorneos> | null} */
let T = null;
/** @type {Promise<ReturnType<typeof crearTorneos>> | null} */
let carga = null;
let nNota = 0;

const bump = () => {
  est.version++;
};

/** localStorage como kv de torneos.js (lee las claves de la clásica; escribe las suyas). */
const kv = {
  /** @param {string} k */
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  /** @param {string} k @param {string} v */
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // sin almacenamiento: no se recuerda
    }
  },
};

// El inventario (la Biblioteca) se arma de nuevo cuando cambia el índice,
// la selección o las selecciones con nombre.
const paleta = crearPaleta();
/** @type {{clave: any[], sel: Set<string>, selecciones: any[], inv: any} | null} */
let invCache = null;
function inventario() {
  if (
    !invCache ||
    invCache.clave !== bib.indice ||
    invCache.sel !== ui.sel ||
    invCache.selecciones !== bib.selecciones
  ) {
    invCache = {
      clave: bib.indice,
      sel: ui.sel,
      selecciones: bib.selecciones,
      inv: inventarioDeBiblioteca({
        indice: bib.indice,
        sel: ui.sel,
        selecciones: bib.selecciones,
        adnDe: adnDeEntrada,
        color: paleta,
      }),
    };
  }
  return invCache.inv;
}

/** @param {any} ev */
function alEvento(ev) {
  switch (ev.t) {
    case 'render':
    case 'seleccion':
      bump();
      break;
    case 'nota':
      est.nota = { clave: ev.clave, params: ev.params ?? {}, aviso: !!ev.aviso, n: ++nNota };
      break;
    case 'log':
      est.registro = [{ clave: ev.clave, params: ev.params ?? {} }, ...est.registro].slice(0, 40);
      break;
    case 'resultado':
      est.ultimo = ev.rec;
      est.marcador = null;
      bump();
      break;
    default:
      break;
  }
}

// ---- Lanzar un partido en la sim de la página -------------------------------------

/**
 * La marca del partido en curso en la sim de la página (null: ninguno):
 * corrida, eventos en caliente y opciones de la sesión al lanzarlo. Si
 * cambian, otra cosa tomó la sim o el partido se alteró (vigiaPartido).
 * @type {import('./juego.js').MarcaPartido | null}
 */
let marca = null;

/** Marca el partido recién lanzado. */
function marcar() {
  marca = marcaPartido(actual.corrida?.estado, sesion());
}
let escuchando = false;
let marcadorMontado = false;
let ultimoFrame = 0;

/** Nombre de la corrida de un partido. @param {import('../../../engine/partido.js').Plan} plan */
function nombrePartido(plan) {
  const L = T?.lg.cur;
  const vs = plan.species.map((s) => String(s.name).replace(/\.txt$/, '')).join(' · ');
  return L ? `${nombreTorneo(L, tr)} · ${vs}` : vs;
}

function escuchar() {
  if (escuchando) return;
  escuchando = true;
  const s = sesion();
  for (const tipo of ['f1-started', 'f1-note', 'f1-over'])
    s.c.on(tipo, (/** @type {any} */ m) => {
      if (T?.lg.live) T.leagueOnMessage(m);
    });
  s.c.on('frame', (/** @type {any} */ ev) => {
    if (!T?.lg.live) return;
    // otra cosa tomó la sim, o la corrida del partido recibió cambios en
    // caliente: el partido se abandona sin registrarse
    const v = marca ? vigiaPartido(marca, actual.corrida?.estado, sesion()) : 'sigue';
    if (v !== 'sigue') {
      marca = null;
      T.leagueAbort();
      est.marcador = null;
      if (v === 'alterada') avisar('competir.jugar.alterado', {}, true);
      return;
    }
    T.lgOnStats(ev.stats);
    const ahora = performance.now();
    if (ev.stats?.f1 && ahora - ultimoFrame > 200) {
      ultimoFrame = ahora;
      est.marcador = { cycle: ev.stats.cycle, f1: ev.stats.f1 };
    }
  });
  if (!marcadorMontado && typeof document !== 'undefined') {
    marcadorMontado = true;
    mount(Marcador, { target: document.body });
  }
}

/**
 * lanzar(plan) de crearTorneos: el partido en la sim de la página (no
 * cambia de pantalla; «Jugar y mirar» abre Observar después).
 * @param {import('../../../engine/partido.js').Plan} plan
 */
async function lanzar(plan) {
  escuchar();
  const s = sesion();
  const nombre = nombrePartido(plan);
  est.marcador = null;
  marca = null;
  const l = lanzamiento(plan, { nombre });
  if (l) {
    const c = corrida();
    if (!(await c.iniciar(l.escenario, l.semilla, { nombre })))
      throw new Error(t('competir.error.ocupado'));
    for (const m of l.f1) s.c.enviar(m);
    marcar();
    s.correr(true);
    return;
  }
  // Reglas de la clásica que no caben en un escenario: la corrida de la
  // página arranca con el escenario del partido sin esas reglas (nombre,
  // semilla y luchadores: Observar muestra el partido y no la corrida
  // anterior) y encima van los mensajes del plan tal cual (su reset es
  // limpio: el mundo es el de mensajesDelPlan, C15). La marca sale después.
  const aprox = escenarioDelPartido({ ...plan, rules: {} }, { nombre });
  if (!(await corrida().iniciar(aprox, plan.seed, { nombre })))
    throw new Error(t('competir.error.ocupado'));
  for (const m of mensajesDelPlan(plan)) {
    if (m.t === 'reset') {
      const { t: _t, ...r } = m;
      s.reset(r);
    } else if (m.t !== 'run') s.c.enviar(m);
  }
  marcar();
  s.correr(true);
}

// ---- Carga ------------------------------------------------------------------------------

/**
 * ADN de un renglón del roster del Contest viejo (contestDna de la
 * clásica, adnRosterViejo de juego.js): los del foro por su archivo; los
 * híbridos, por nombre entre los propios (la migración de Bots los pasó a
 * propios: se la espera antes); los presets, el suyo; 'form', el que trae.
 * @param {any} r
 */
function adnRoster(r) {
  return adnRosterViejo(r, {
    foro: adnForo,
    propios: async () => {
      await asegurarBiblioteca();
      return bib.indice;
    },
    presets: presetsClasica(especiesPrueba()[0].dna),
  });
}

/**
 * Los torneos de la página (la primera vez: espera la migración, crea el
 * estado, pasa el roster del Contest viejo al Scratch y carga todo).
 */
export function asegurarTorneos() {
  carga ??= (async () => {
    await esperarMigracionLigas();
    const x = crearTorneos({
      almacen: almacen(),
      get inventario() {
        return inventario();
      },
      reglasBase: () => reglasDeSeleccion({ tipo: 'f1' }),
      kv,
      lanzar,
      alEvento,
    });
    T = x;
    try {
      x.lgScratch();
      // los híbridos del roster están entre los propios que trae la migración de Bots
      await esperarMigracion();
      const r = await x.lgMigrateRoster(x.lgScratch(), adnRoster);
      await x.lgLoadAll();
      if (r?.added) avisar('competir.migracion.roster', { n: r.added, perdidos: r.lost });
      est.hofViejo = x.lgOldHofFile();
      est.listo = true;
      bump();
    } catch (e) {
      est.error = e ?? new Error('?');
    }
    return x;
  })();
  return carga;
}

/** El estado de torneos (null hasta que asegurarTorneos termine). */
export const torneos = () => T;

/** @param {string} clave @param {Record<string, any>} [params] @param {boolean} [error] */
function avisar(clave, params = {}, error = false) {
  est.aviso = { texto: t(clave, params), aviso: error };
}

/** @param {unknown} e */
function avisarError(e) {
  est.aviso = { texto: t('competir.error.accion', { detalle: textoError(e, tr) }), aviso: true };
}

/**
 * Corre una acción marcando `ocupado` y convirtiendo sus errores en aviso.
 * @template R @param {string} que @param {() => Promise<R>} fn
 * @returns {Promise<R | undefined>}
 */
async function accion(que, fn) {
  await asegurarTorneos();
  est.ocupado = que;
  try {
    return await fn();
  } catch (e) {
    avisarError(e);
    return undefined;
  } finally {
    est.ocupado = '';
    bump();
  }
}

// ---- Selección, lista y archivos ---------------------------------------------------

/** Abre un torneo (o el Scratch) por id. @param {string} id */
export function abrir(id) {
  return accion('abrir', async () => {
    const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
    const L = id === LG_SCRATCH_ID ? x.lgScratch() : x.lg.list.find((y) => y.id === id);
    if (L && L !== x.lg.cur) await x.lgSelect(L);
    return !!L;
  });
}

/** Exporta el torneo abierto como .json (v2, el de la clásica). */
export function exportar() {
  return accion('exportar', async () => {
    const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
    const L = x.lg.cur;
    if (!L || lgIsScratch(L)) return;
    const { obj, fileName } = x.lgExport(L);
    descargar(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }), fileName);
  });
}

/** Importa un .json de torneo (v1/v2 de la clásica o de la nueva). @param {string} texto */
export function importar(texto) {
  return accion('importar', () => /** @type {any} */ (T).lgImport(texto));
}

/** Guarda el Scratch como torneo. @param {string} nombre */
export function guardarScratch(nombre) {
  return accion('guardar', () => /** @type {any} */ (T).lgScratchSave(nombre));
}

/** Borra el torneo abierto o vacía el Scratch. */
export function borrarActual() {
  return accion('borrar', () => /** @type {any} */ (T).lgDeleteCurrent());
}

/** @param {string} nombre */
export function renombrar(nombre) {
  return accion('renombrar', () => /** @type {any} */ (T).lgRename(nombre));
}

/** El Hall of Fame del Canal viejo: bajarlo (y descartarlo) o solo descartarlo. @param {boolean} bajar */
export function hofViejo(bajar) {
  const x = T;
  if (!x) return;
  const f = x.lgOldHofFile();
  if (bajar && f)
    descargar(
      new Blob([JSON.stringify(f, null, 1)], { type: 'application/json' }),
      'channel_hall_of_fame.json',
    );
  x.lgOldHofDiscard();
  est.hofViejo = null;
}

/** Lee el Salón de la fama global. */
export function leerSalon() {
  return accion('salon', async () => {
    est.salon = await /** @type {any} */ (T).lgSalon();
  });
}

// ---- Crear (asistente) ------------------------------------------------------------------

/**
 * Crea el torneo del asistente (decisión 22): reglas (el escenario sin
 * especies), formato y valores, sorteo y participantes con el ADN
 * congelado ahora. Devuelve el torneo o null.
 * @param {import('./asistente.js').Asistente} a
 */
export function crearTorneo(a) {
  return accion('crear', async () => {
    const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
    await asegurarBiblioteca();
    const plan = planCreacion(a);
    const L = await x.lgCreate(plan.reglas);
    if (a.nombre.trim()) await x.lgRename(a.nombre);
    for (const [k, v] of plan.fmt) await x.lgSetFmt(k, v);
    await x.lgSetDraw(plan.draw);
    if (plan.llenar === 'lista') {
      const r = await agregarClaves(a.claves);
      if (r.sinAdn.length)
        avisar('competir.participantes.sinAdn', { nombres: r.sinAdn.join(', ') }, true);
    } else if (plan.llenar === 'sorteo') {
      const r = await x.lgRedraw(L);
      if (r)
        avisar('competir.participantes.sorteados', { n: r.added, fallidos: r.failed }, r.added < 2);
    }
    return L;
  });
}

/**
 * Inscribe entradas de la Biblioteca en la temporada abierta (ADN congelado).
 * @param {string[]} claves
 */
async function agregarClaves(claves) {
  const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
  const { participantes, sinAdn } = await participantesDeEntradas(
    entradasDe(bib.indice, claves),
    adnDeEntrada,
  );
  let n = 0;
  for (const p of participantes) if (await x.lgAdd(p)) n++;
  return { n, sinAdn };
}

// ---- Participantes, formato y reglas del torneo abierto ------------------------------

/** @param {string[]} claves */
export function agregarParticipantes(claves) {
  return accion('agregar', async () => {
    await asegurarBiblioteca();
    const r = await agregarClaves(claves);
    if (r.sinAdn.length)
      avisar('competir.participantes.sinAdn', { nombres: r.sinAdn.join(', ') }, true);
    else avisar('competir.participantes.agregados', { n: r.n });
  });
}

/**
 * «Inscribir en torneo» desde otra pantalla (la ficha de un bot): abre el
 * torneo `id` (o el partido rápido con LG_SCRATCH_ID) e inscribe esas
 * entradas de la Biblioteca con el ADN congelado ahora. Devuelve false si
 * el torneo no existe.
 * @param {string} id @param {string[]} claves
 */
export async function inscribirEn(id, claves) {
  await asegurarTorneos();
  if (!(await abrir(id))) return false;
  await agregarParticipantes(claves);
  return true;
}

/** @param {number} i */
export function quitarParticipante(i) {
  return accion('quitar', () => /** @type {any} */ (T).lgEntrantRemove(i));
}

/** @param {number} i @param {{qty?: any, color?: string}} patch */
export function cambiarParticipante(i, patch) {
  return accion('participante', () => /** @type {any} */ (T).lgEntrantSet(i, patch));
}

/** @param {Record<string, any>} patch */
export function cambiarSorteo(patch) {
  return accion('sorteo', async () => {
    await asegurarBiblioteca();
    await /** @type {any} */ (T).lgSetDraw(patch);
  });
}

/** Vuelve a sortear los participantes de la temporada abierta. */
export function sortear() {
  return accion('sortear', async () => {
    const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
    await asegurarBiblioteca();
    const L = x.lg.cur;
    if (!L) return;
    const r = await x.lgRedraw(L);
    if (!r) avisar('competir.participantes.sorteoBloqueado', {}, true);
    else
      avisar('competir.participantes.sorteados', { n: r.added, fallidos: r.failed }, r.added < 2);
  });
}

export function sortearGrupos() {
  return accion('grupos', () => /** @type {any} */ (T).lgCupRedraw());
}

/** @param {string} k @param {any} v */
export function cambiarFormato(k, v) {
  return accion('formato', () => /** @type {any} */ (T).lgSetFmt(k, v));
}

/** @param {import('./asistente.js').SeleccionReglas} sel */
export function cambiarReglas(sel) {
  return accion('reglas', () => /** @type {any} */ (T).lgSetRules(reglasDeSeleccion(sel)));
}

/** Temporada nueva del torneo abierto. */
export function nuevaTemporada() {
  return accion('temporada', async () => {
    const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
    await asegurarBiblioteca();
    const L = x.lg.cur;
    if (!L) return;
    const r = await x.lgNewSeason(L);
    avisar(r ? 'competir.temporada.nuevaSorteo' : 'competir.temporada.nueva', {
      no: lgSeason(L).no,
      n: r?.added ?? 0,
    });
  });
}

/**
 * «Abrir en Experimentar» (la clásica: «Load into the panel»): el mundo de
 * las reglas de la temporada `S` (escenarioDeReglas: sin especies ni modo
 * F1) pasa a ser el borrador de Experimentar —sin guardarse como escenario
 * propio: se guarda desde allí si se quiere— y se abre Experimentar. Si
 * las reglas no caben en un escenario, avisa.
 * @param {import('../../../engine/league.js').Season} S
 */
export function abrirReglasEnExperimentar(S) {
  return accion('experimentar', async () => {
    const L = /** @type {ReturnType<typeof crearTorneos>} */ (T).lg.cur;
    const nombre = t('competir.reglas.experimentarNombre', {
      torneo: nombreTorneo(L, tr),
      no: num(S.no),
    });
    const e = escenarioDeReglas(S.rules, { es: nombre, en: nombre });
    const b0 = borradorDe(e);
    estadoExp.borrador = b0;
    estadoExp.foto = b0;
    estadoExp.baseId = e.id;
    estadoExp.rutaId = '';
    estadoExp.escCorrida = actual.corrida?.estado.escenario ?? null;
    window.location.hash = hashDe('experimentar');
  });
}

// ---- Jugar ------------------------------------------------------------------------------

/** Abandona el partido en curso (no se registra). */
export function abandonar() {
  T?.leagueAbort();
  est.marcador = null;
  marca = null;
}

/** ↻ Repite un partido con su semilla y compara con lo registrado. @param {number} id */
export function repetir(id) {
  return accion('repetir', async () => {
    await /** @type {any} */ (T).lgReplay(id);
  });
}

/**
 * «Repetir y analizar» (decisión 22): el partido otra vez, con su semilla,
 * como corrida de la página, y abre Analizar. No se registra.
 * @param {number} id
 */
export function repetirYAnalizar(id) {
  return accion('analizar', async () => {
    const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
    if (x.lg.live) abandonar();
    const L = x.lg.cur;
    const m = x.lg.matches.find((y) => y.id === id);
    const nombre = t('competir.partidos.repeticion', {
      torneo: nombreTorneo(L, tr),
      no: m?.no ?? 0,
      semilla: String(m?.seed ?? ''),
    });
    const r = x.lgRepeticion(id, { nombre });
    const s = sesion();
    if (!(await corrida().iniciar(r.escenario, r.semilla, { nombre })))
      throw new Error(t('competir.error.ocupado'));
    for (const msg of r.f1) s.c.enviar(msg);
    s.correr(true);
    window.location.hash = rutaAnalizar();
  });
}

// ---- Rondas en segundo plano (decisión 23) ------------------------------------------

/** La ronda del torneo abierto a la cola. */
export function rondaEnSegundoPlano() {
  return accion('ronda', async () => {
    const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
    await asegurarBiblioteca();
    const r = await x.lgRonda();
    if (!r) return;
    try {
      await iniciarTrabajos().encolar({
        tipo: TIPO_RONDA,
        params: r.params,
        unidades: r.n,
        titulo: t('competir.ronda.titulo', {
          torneo: nombreTorneo({ id: r.params.league, name: r.params.nombre }, tr),
          n: r.n,
        }),
      });
      avisar('competir.ronda.encolada', { n: r.n });
    } catch (e) {
      await x.lgRondaCancelar(r.params.ronda);
      throw e;
    }
  });
}

/**
 * El trabajo de la cola de una ronda (por su id de ronda), o undefined.
 * @param {string} ronda
 */
export const trabajoDeRonda = (ronda) =>
  estadoTrabajos.lista.find((x) => x.tipo === TIPO_RONDA && x.params?.ronda === ronda);

/**
 * La cola de la página para lgReconciliarRondas ({lista, resultados}).
 * @returns {{lista: () => any[], resultados: (id: string) => Promise<any[]>}}
 */
const colaPagina = () => /** @type {any} */ (iniciarTrabajos());

/**
 * Después de cancelar (o de ver cancelado) un trabajo de ronda (la cola no
 * llama a alTerminar al cancelar ni al borrar): si el trabajo quedó
 * cancelado, fallido o ya no existe —su estado FRESCO: la cola local en la
 * dueña o el almacén en las demás, no la lista en caché—, esta pestaña
 * libera la temporada (lgRondaCancelar escribe en el almacén: vale en
 * cualquiera). Si no, la dueña reconcilia y las demás releen la liga.
 * @param {string} league @param {string} ronda @param {string | undefined} trabajo
 */
async function trasCancelar(league, ronda, trabajo) {
  const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
  const cola = iniciarTrabajos();
  const liberada = await liberarSiCancelada({
    torneos: x,
    cola,
    almacen: almacen(),
    trabajo,
    ronda,
    league,
  });
  if (liberada) return;
  if (cola.duena) await x.lgReconciliarRondas(colaPagina());
  else await x.lgRefrescar(league);
}

/**
 * «Cancelar la ronda» / «Liberar la ronda» de la temporada abierta: cancela
 * su trabajo si sigue en la cola y libera la marca (lo ya jugado se pierde;
 * la ronda se vuelve a pedir con semillas nuevas). Sin trabajo en la cola
 * (borrado), la libera enseguida.
 */
export function liberarRonda() {
  return accion('liberar', async () => {
    const x = /** @type {ReturnType<typeof crearTorneos>} */ (T);
    const L = x.lg.cur;
    const S = L && /** @type {any} */ (lgSeason(L));
    if (!L || !S?.ronda) return;
    const tr0 = trabajoDeRonda(S.ronda.id);
    if (!tr0) {
      await x.lgRondaCancelar(S.ronda.id, L.id);
      return;
    }
    if (tr0.estado === 'pendiente' || tr0.estado === 'corriendo')
      await iniciarTrabajos().cancelar(tr0.id);
    await trasCancelar(L.id, S.ronda.id, tr0.id);
  });
}

/**
 * Una ronda cancelada desde la lista de trabajos (la cola no avisa al
 * cancelar): lo llama Competir cuando cambia la lista de la cola.
 */
export async function sincronizarRonda() {
  const x = T;
  const L = x?.lg.cur;
  const S = L && /** @type {any} */ (lgSeason(L));
  if (!x || !L || !S?.ronda) return;
  const tr0 = trabajoDeRonda(S.ronda.id);
  if ((tr0?.estado === 'cancelado' || tr0?.estado === 'fallido') && !vistas.has(tr0.id)) {
    vistas.add(tr0.id);
    await trasCancelar(L.id, S.ronda.id, tr0.id);
  }
}
/** trabajos de ronda cancelados o fallidos ya atendidos por sincronizarRonda */
const vistas = new Set();

/**
 * alTerminar de la cola para un trabajo de ronda (terminado o fallido;
 * paso 3 de la cabecera de engine/rondas.js): la pestaña dueña de la cola
 * (propia) reconcilia las rondas con la cola (registra la terminada o
 * libera la fallida); las demás releen la liga del almacén.
 * @param {import('../../../engine/cola.js').Trabajo} tr0 @param {boolean} propia
 * @param {{lista: () => any[], resultados: (id: string) => Promise<any[]>}} cola
 */
export async function alTerminarRonda(tr0, propia, cola) {
  const x = await asegurarTorneos();
  if (propia) await x.lgReconciliarRondas(cola);
  else await x.lgRefrescar(tr0.params?.league);
  // Registrada: la nota de Competir lo cuenta y el aviso de la cola sobra
  // (la fallida conserva el suyo: se ve en la lista de rondas de Competir).
  if (tr0.estado === 'terminado' && !(await rondaPendiente(tr0.params?.league, tr0.params?.ronda)))
    descartarAviso(tr0.id);
  bump();
}

/**
 * ¿La temporada guardada sigue marcada con esa ronda (sin registrar)?
 * @param {string} league @param {string} ronda
 */
async function rondaPendiente(league, ronda) {
  try {
    const L = await almacen().get(ST_TORNEOS, league);
    return !!L?.seasons?.some((/** @type {any} */ S) => S.ronda?.id === ronda);
  } catch {
    return true;
  }
}

/**
 * La pestaña pasó a ser la dueña de la cola (al arrancar, tras reanudar):
 * rondas huérfanas de una recarga o de otra pestaña que se cerró.
 * @param {{lista: () => any[], resultados: (id: string) => Promise<any[]>}} cola
 */
export async function alSerDuena(cola) {
  const x = await asegurarTorneos();
  await x.lgReconciliarRondas(cola);
  bump();
}
