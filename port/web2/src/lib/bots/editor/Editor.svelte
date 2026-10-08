<script>
// @ts-check
// Editor de ADN de la ficha del bot, pestaña ADN (paso N3.3; decisiones 18,
// 19 y 20). Props (las monta src/screens/Bots.svelte):
//   bot          la Entrada de la biblioteca (engine/biblioteca.js)
//   registro     el registro propio (engine/bots.js BotPropio) o null
//   soloLectura  sin editar (los del foro siempre: se editan duplicándolos)
//   oncambio?    (registro) tras guardar o restaurar una versión
//   onduplicado? (registro) tras duplicar uno del foro; sin él, navega a la
//                ficha del duplicado (#/bots/propio:<clave>/adn)
//
// Texto con resaltado y autocompletado (AreaAdn) o vista por genes
// (VistaGenes); lint del core con debounce en un worker propio (linter.js);
// avisos del lint y del Laboratorio con arreglo en un clic; panel «Genes»
// (PanelGenes), «Probar» (PanelProbar) y versiones (PanelVersiones,
// DiffGenes). El origen de cada gen (decisión 19) se sigue con
// engine/lab.js realinearOrigenes y se guarda con cada versión.
//
// «Sin guardar» compara el TEXTO exacto con el de la última versión (un
// cambio de comentarios, cabecera o sangría también cuenta y se guarda;
// engine/bots.js guardarVersion). El editor trabaja en LF: el ADN se
// normaliza al cargarlo.
//
// Lo editado y sin guardar no se pierde (borrador.js): un borrador por bot
// que sobrevive a desmontar el editor (y a recargar, en localStorage); al
// volver se recupera con aviso. Con cambios sin guardar, cerrar o recargar
// la página pide confirmación (beforeunload) y restaurar una versión
// también (el reemplazo pasa por el deshacer en el modo texto).
import { onDestroy, untrack } from 'svelte';
import { hashAdn } from '../../../../engine/adn.js';
import { crearBots, diffVersiones, ErrorBots } from '../../../../engine/bots.js';
import {
  apagarGen,
  aplicarAccion,
  avisosLab,
  bloquesAdn,
  claveGen,
  encenderGen,
  genesTexto,
  origenesParaGuardar,
  realinearOrigenes,
} from '../../../../engine/lab.js';
import {
  alinear as alinearPila,
  memoriaDe,
  parsearTraza,
  pasosDeGen,
  sysvarsLeidos,
  tokensEjecutables,
} from '../../../../engine/pila.js';
import { t } from '../../../i18n/index.svelte.js';
import { hashDe } from '../../../router.js';
import { CLAVE_PILA_PENDIENTE, valoresDePendiente } from '../../inspector/adn.js';
import { almacen } from '../../sim/almacen.svelte.js';
import AreaAdn from './AreaAdn.svelte';
import { aLf, borradores } from './borrador.js';
import DiffGenes from './DiffGenes.svelte';
import { adnForo, bestiario, genesJson, perfiles } from './datos.js';
import { ejemplos } from './ejemplos.js';
import { aplicarArreglo, describirLint, palabrasMarcadas } from './lint.js';
import { crearLinter } from './linter.js';
import PanelGenes from './PanelGenes.svelte';
import PanelPila from './PanelPila.svelte';
import PanelProbar from './PanelProbar.svelte';
import PanelVersiones from './PanelVersiones.svelte';
import VistaGenes from './VistaGenes.svelte';
import { SYSVARS } from './vocabulario.js';

/** Semilla fija del visor de pila: rnd da siempre lo mismo (PLAN-EDITOR E1.5). */
const SEMILLA_PILA = 1234;
/** Dirección de cada sysvar del vocabulario (sin el punto del nombre). */
const DIRECCION = new Map(SYSVARS);
/** @param {string} nombre `.eye5` → dirección, o undefined. */
const direccionDe = (nombre) => DIRECCION.get(nombre.replace(/^\./, ''));

/**
 * @typedef {import('../../../../engine/bots.js').BotPropio} BotPropio
 * @typedef {import('../../../../engine/lab.js').OrigenGen} OrigenGen
 */

/**
 * @type {{bot: import('../../../../engine/biblioteca.js').Entrada, registro: BotPropio | null,
 *   soloLectura?: boolean, oncambio?: (r: BotPropio) => void, onduplicado?: (r: BotPropio) => void}}
 */
let { bot, registro, soloLectura = false, oncambio, onduplicado } = $props();

const DEBOUNCE_MS = 350;

let texto = $state('');
/** Texto ya procesado (lint, orígenes, avisos): el de hace DEBOUNCE_MS. */
let estable = $state('');
/** @type {OrigenGen[]} */
let origenes = $state([]);
let cargando = $state(true);
let errorCarga = $state('');
let modo = $state(/** @type {'texto' | 'genes'} */ ('texto'));
let lab = $state(false);
/** @type {import('./lint.js').HallazgoLint[]} */
let hallazgos = $state([]);
/** @type {{genes: any, perfiles: any, bestiario: {file: string, name: string}[]} | null} */
let datosLab = $state(null);
/** @type {{file: string, name: string}[]} */
let foro = $state([]);
/** @type {{diff: any, a: number, b: number} | null} */
let diff = $state(null);
let nota = $state('');
let mensaje = $state('');
let ocupado = $state(false);
/** @type {BotPropio | null} */
let reg = $state(null);
let duplicando = $state(false);
let nombreDup = $state('');
let confirmarForo = $state(false);
/** @type {AreaAdn | undefined} */
let area = $state();
/** Error del lint (el worker o el wasm no cargaron), o ''. */
let errorLint = $state('');
/** Borrador de otra versión que se puede recuperar (o null). */
/** @type {import('./borrador.js').Borrador | null} */
let borradorAjeno = $state(null);
/** Se recuperó un borrador al cargar (aviso con «Descartar»). */
let borradorRecuperado = $state(false);
/** Versión a restaurar que espera confirmación (hay cambios sin guardar). */
/** @type {number | null} */
let confirmarRestaurar = $state(null);
/** Genes desplegados de la vista por genes (se conservan al cambiar de modo). */
/** @type {Set<string>} */
let abiertos = $state(new Set());
// Visor de pila (PLAN-EDITOR E1.5): encendido (la preferencia va a localStorage),
// la línea del cursor (modo texto), el gen desplegado (modo genes), los valores
// de ejemplo del bot y la última traza pedida, con el texto al que corresponde.
let pila = $state(leerPila());
let lineaCursor = $state(1);
let genAbierto = $state(-1);
/** @type {Map<string, number>} */
let valoresEjemplo = $state(new Map());
/** @type {{texto: string, tsv: string} | null} */
let traza = $state(null);

/** Texto con el que se alinearon los orígenes por última vez. */
let alineado = '';
/** Palabras de un gen → su origen (genes insertados, apagados, de otras versiones). */
const memoria = new Map();
const linter = crearLinter();
/** Contador de cargas: una carga vieja (cambio rápido de bot) se descarta. */
let nCarga = 0;
/** Bot (clave) del texto en pantalla: el del borrador. */
let claveCargada = '';
/** Texto guardado del bot en pantalla (base del borrador); null = no editable. */
/** @type {string | null} */
let baseCargada = null;

const esPropio = $derived(reg?.clase === 'propio');
const lectura = $derived(soloLectura || !esPropio);
const versiones = $derived(esPropio && reg ? reg.versiones : []);
const ultima = $derived(versiones[versiones.length - 1] ?? null);
/** El texto guardado (la última versión) en LF. */
const guardado = $derived(ultima ? aLf(ultima.adn) : null);
const sinGuardar = $derived(guardado !== null && !cargando && !errorCarga && texto !== guardado);

/** Guarda (o borra) el borrador del bot en pantalla. */
function guardarBorrador() {
  if (!claveCargada || baseCargada === null || cargando || errorCarga) return;
  // un borrador de otra versión sin decidir no se pisa hasta que se edite
  if (borradorAjeno && texto === baseCargada) return;
  borradores.guardar(claveCargada, texto, baseCargada);
}

onDestroy(() => {
  guardarBorrador();
  linter.cerrar();
});

// Cerrar o recargar la página con cambios sin guardar pide confirmación.
$effect(() => {
  if (!sinGuardar || typeof window === 'undefined') return;
  /** @param {BeforeUnloadEvent} e */
  const h = (e) => {
    guardarBorrador();
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', h);
  return () => window.removeEventListener('beforeunload', h);
});
const nombresArchivo = $derived(new Map(foro.map((b) => [b.file, b.name])));
/** @param {string} archivo */
const nombreDe = (archivo) => nombresArchivo.get(archivo) ?? archivo;

$effect(() => {
  reg = registro?.clase === 'propio' ? registro : null;
});

// Cargar el ADN al cambiar de bot (o cuando llega el registro propio: trae
// los orígenes de la última versión).
let cargadoPara = '';
$effect(() => {
  const clave = `${bot?.clave ?? ''}|${registro?.clase === 'propio' ? 'p' : ''}`;
  if (clave === cargadoPara) return;
  cargadoPara = clave;
  untrack(() => cargar());
});

async function cargar() {
  // lo escrito en el bot anterior queda como su borrador
  guardarBorrador();
  const mia = ++nCarga;
  cargando = true;
  errorCarga = '';
  diff = null;
  mensaje = '';
  borradorAjeno = null;
  borradorRecuperado = false;
  confirmarRestaurar = null;
  abiertos = new Set();
  claveCargada = '';
  baseCargada = null;
  memoria.clear();
  genAbierto = -1;
  try {
    const r = registro?.clase === 'propio' ? registro : null;
    let adn = r?.adn ?? bot.adn ?? '';
    if (!r && bot.archivo) adn = await adnForo(bot.archivo);
    if (mia !== nCarga) return; // otro bot se pidió mientras tanto
    adn = aLf(adn);
    const ult = r?.versiones[r.versiones.length - 1];
    for (const v of r?.versiones ?? []) recordar(aLf(v.adn), v.origenes ?? []);
    const og = /** @type {OrigenGen[]} */ (structuredClone($state.snapshot(ult?.origenes) ?? []));
    const n = genesTexto(adn).length;
    origenes = Array.from({ length: n }, (_, i) => og[i] ?? null);
    alineado = adn;
    texto = adn;
    estable = adn;
    claveCargada = bot.clave;
    valoresEjemplo = ejemplos.leer(bot.clave);
    // un borrador de este bot: sobre el mismo texto, se recupera; sobre
    // otro (el bot cambió por otro lado), se ofrece
    const b = r && !soloLectura ? borradores.leer(bot.clave) : null;
    const baseTxt = ult ? aLf(ult.adn) : adn;
    if (r && !soloLectura) baseCargada = baseTxt;
    if (b && b.texto !== adn) {
      if (b.base === baseTxt) {
        texto = b.texto;
        borradorRecuperado = true;
      } else borradorAjeno = b;
    } else if (b) borradores.borrar(bot.clave);
    adoptarPendiente(texto);
    if (origenes.some((o) => o && 'archivo' in o)) cargarLab();
  } catch (e) {
    if (mia !== nCarga) return;
    errorCarga = String(/** @type {any} */ (e)?.message ?? e);
  } finally {
    if (mia === nCarga) cargando = false;
  }
}

/** Trae el borrador escrito sobre otra versión. */
function recuperarAjeno() {
  const b = borradorAjeno;
  if (!b || lectura) return;
  borradorAjeno = null;
  borradorRecuperado = true;
  aplicarTexto(b.texto);
}

/** Descarta el borrador: vuelve al texto guardado. */
function descartarBorrador() {
  borradorAjeno = null;
  borradorRecuperado = false;
  borradores.borrar(claveCargada);
  if (baseCargada !== null && texto !== baseCargada) aplicarTexto(baseCargada);
}

bestiario().then(
  (b) => {
    foro = b;
  },
  () => {},
);

async function cargarLab() {
  if (datosLab) return;
  try {
    const [g, p, b] = await Promise.all([genesJson(), perfiles(), bestiario()]);
    datosLab = { genes: g, perfiles: p, bestiario: b };
  } catch (e) {
    mensaje = t('editor.lab.errorCarga', { detalle: String(/** @type {any} */ (e)?.message ?? e) });
  }
}

/** Anota en la memoria el origen de cada gen de un ADN. @param {string} adn @param {(OrigenGen | undefined)[]} og */
function recordar(adn, og) {
  for (const [i, g] of genesTexto(adn).entries()) {
    const o = og[i];
    if (o) memoria.set(claveGen(g.palabras), structuredClone($state.snapshot(o)));
  }
}

/** Alinea los orígenes con el texto actual (tras una edición libre). */
function alinear() {
  if (texto === alineado) return;
  recordar(alineado, origenes);
  origenes = realinearOrigenes(alineado, texto, $state.snapshot(origenes), memoria);
  alineado = texto;
}

// Debounce: orígenes, lint y avisos sobre el texto quieto.
$effect(() => {
  const x = texto;
  if (cargando) return;
  const id = setTimeout(() => {
    alinear();
    estable = x;
    guardarBorrador();
    linter.lint(x).then(
      (r) => {
        if (r && x === texto) {
          hallazgos = r;
          errorLint = '';
        }
      },
      (e) => {
        if (x !== texto) return;
        hallazgos = [];
        errorLint = String(/** @type {any} */ (e)?.message ?? e);
      },
    );
  }, DEBOUNCE_MS);
  return () => clearTimeout(id);
});

const genesEstables = $derived(genesTexto(estable));
/** Gen activo (base 0) que contiene la línea (base 1), o −1. @param {number} linea */
const genDeLinea = (linea) =>
  genesEstables.findIndex((g) => g.l0 <= linea - 1 && linea - 1 <= g.l1);
const avisosLint = $derived(hallazgos.map(describirLint));
const marcadas = $derived(palabrasMarcadas(hallazgos));
const lineasMarcadas = $derived(new Set(avisosLint.map((a) => a.linea).filter((l) => l > 0)));
const lab2 = $derived.by(() => {
  if (!datosLab) return null;
  const p = datosLab.perfiles;
  return avisosLab({
    adn: estable,
    origenes: $state.snapshot(origenes),
    genes: datosLab.genes,
    capsDe: (f, gi) => p.bots[f]?.geneCaps?.[gi] ?? [],
  });
});
const avisosDelLab = $derived(lab2?.avisos ?? []);
const nAvisos = $derived(avisosLint.length + avisosDelLab.filter((a) => a.tipo !== 'info').length);
const bloques = $derived(modo === 'genes' ? bloquesAdn(texto) : []);
/** Avisos por gen (para marcar renglones en la vista por genes). */
const avisosPorGen = $derived.by(() => {
  const m = new Map();
  for (const a of avisosLint) {
    const g = genDeLinea(a.linea);
    if (g >= 0) m.set(g, (m.get(g) ?? 0) + 1);
  }
  for (const a of avisosDelLab) if ('i' in a) m.set(a.i, (m.get(a.i) ?? 0) + 1);
  return m;
});

// ---- Visor de pila (PLAN-EDITOR E1.5) ---------------------------------------------

/** La preferencia «Pila» guardada en este navegador (apagada si no hay). */
function leerPila() {
  try {
    return globalThis.localStorage?.getItem('dbw2.editor.pila') === '1';
  } catch {
    return false;
  }
}

function alternarPila() {
  pila = !pila;
  try {
    globalThis.localStorage?.setItem('dbw2.editor.pila', pila ? '1' : '0');
  } catch {
    // sin almacenamiento: vale por esta sesión
  }
}

/**
 * Los valores de la memoria que dejó el inspector («Abrir en el editor», PLAN-EDITOR
 * E2.3) para este ADN: si su hash coincide, se adoptan como valores de ejemplo, se
 * enciende el visor y se borra la clave. Sin almacenamiento, no pasa nada.
 * @param {string} adn
 */
function adoptarPendiente(adn) {
  try {
    const crudo = globalThis.sessionStorage?.getItem(CLAVE_PILA_PENDIENTE);
    if (!crudo) return;
    const m = valoresDePendiente(crudo, hashAdn(adn));
    if (!m) return;
    globalThis.sessionStorage?.removeItem(CLAVE_PILA_PENDIENTE);
    valoresEjemplo = m;
    pila = true;
  } catch {
    // sin almacenamiento: el editor abre con los valores de siempre
  }
}

/** @param {string} nombre @param {number} valor */
function cambiarValor(nombre, valor) {
  const m = new Map(valoresEjemplo);
  m.set(nombre, valor);
  valoresEjemplo = m;
  ejemplos.guardar(bot.clave, m);
}

const tokensPila = $derived(tokensEjecutables(estable));
/* Solo los sysvars del vocabulario tienen dirección: las variables de `def`
   (`*.paso`) no entran, porque el visor no conoce la que les asigna el motor. */
const sysvarsPila = $derived(
  sysvarsLeidos(tokensPila).filter((nombre) => direccionDe(nombre) !== undefined),
);
/** El gen del visor: el del cursor (modo texto) o el desplegado (modo genes). */
const genCursor = $derived(modo === 'texto' ? genDeLinea(lineaCursor) : genAbierto);
/** Pasos con su palabra; vacíos si la traza no es la del texto actual. */
const alineados = $derived(
  pila && traza && traza.texto === estable
    ? alinearPila(tokensPila, parsearTraza(traza.tsv).pasos)
    : [],
);
const pasosGen = $derived(pila ? pasosDeGen(alineados, estable, genCursor) : []);
const nombreGen = $derived(
  pila && genCursor >= 0
    ? (bloquesAdn(estable).find((b) => b.tipo === 'gen' && b.n === genCursor)?.nombre ?? '')
    : '',
);
const estadoPila = $derived(
  genCursor < 0
    ? 'sinGen'
    : !traza || traza.texto !== estable
      ? 'cargando'
      : alineados.length === 0
        ? 'sinDatos'
        : 'ok',
);

// Pedido de traza: con el visor encendido, al quedar quieto el ADN o cambiar un
// valor de ejemplo. Solo la respuesta al último pedido cuenta (linter.js).
$effect(() => {
  const x = estable;
  const vals = valoresEjemplo;
  if (!pila || lab || cargando || errorCarga) return;
  linter.trazar(x, memoriaDe(vals, direccionDe), SEMILLA_PILA).then(
    (tsv) => {
      if (tsv !== null) traza = { texto: x, tsv };
    },
    () => {
      traza = { texto: x, tsv: '' };
    },
  );
});

/**
 * Lleva el ADN a `nuevo` (en el textarea, como un paso deshacible) y, si
 * vienen, fija los orígenes que corresponden a ese texto.
 * @param {string} nuevo @param {OrigenGen[]} [og]
 */
function aplicarTexto(nuevo, og) {
  if (lectura) return;
  alinear();
  recordar(texto, $state.snapshot(origenes));
  if (og) {
    recordar(nuevo, og);
    origenes = og;
    alineado = nuevo;
  }
  if (modo === 'texto' && area) area.reemplazar(nuevo);
  else texto = nuevo;
}

/** @param {number} n */
function apagar(n) {
  alinear();
  const og = $state.snapshot(origenes);
  aplicarTexto(
    apagarGen(texto, n),
    og.filter((_, i) => i !== n),
  );
}

/** @param {number} k */
function encender(k) {
  alinear();
  const nuevo = encenderGen(texto, k);
  aplicarTexto(nuevo, realinearOrigenes(texto, nuevo, $state.snapshot(origenes), memoria));
}

/** @param {import('../../../../engine/lab.js').AccionLab} accion */
function accionLab(accion) {
  if (!datosLab) return;
  alinear();
  const r = aplicarAccion(
    { adn: texto, origenes: $state.snapshot(origenes), genes: datosLab.genes, nombreDe },
    accion,
  );
  aplicarTexto(r.adn, r.origenes);
}

/** @param {import('./lint.js').Arreglo} a */
function arreglar(a) {
  aplicarTexto(aplicarArreglo(texto, a));
}

/** @param {number} linea */
function irA(linea) {
  if (linea <= 0) return;
  modo = 'texto';
  queueMicrotask(() => area?.irALinea(linea));
}

function bots() {
  return crearBots({ almacen: almacen(), nombresForo: () => foro.map((b) => b.name) });
}

async function guardar() {
  if (!reg || lectura) return;
  mensaje = '';
  if (texto === guardado) {
    mensaje = t('editor.guardar.sinCambios');
    return;
  }
  ocupado = true;
  try {
    alinear();
    const r = await bots().guardarVersion(reg.hash, texto, {
      nota: nota.trim(),
      origenes: origenesParaGuardar($state.snapshot(origenes)),
    });
    if (!r) mensaje = t('editor.guardar.sinCambios');
    else {
      reg = r;
      nota = '';
      borradores.borrar(claveCargada);
      baseCargada = aLf(r.versiones[r.versiones.length - 1].adn);
      borradorRecuperado = false;
      borradorAjeno = null;
      mensaje = t('editor.guardar.hecho', { n: r.versiones[r.versiones.length - 1].n });
      oncambio?.(r);
    }
  } catch (e) {
    mensaje = textoErrorBots(e);
  } finally {
    ocupado = false;
  }
}

/**
 * Restaurar la versión n: con cambios sin guardar, primero pide
 * confirmación (se reemplazan; en el modo texto quedan en el deshacer).
 * @param {number} n
 */
function pedirRestaurar(n) {
  if (sinGuardar) confirmarRestaurar = n;
  else restaurar(n);
}

/** @param {number} n */
async function restaurar(n) {
  if (!reg) return;
  confirmarRestaurar = null;
  ocupado = true;
  mensaje = '';
  try {
    const r = await bots().restaurarVersion(
      reg.hash,
      n,
      t('editor.versiones.notaRestaurada', { n }),
    );
    if (!r) mensaje = t('editor.versiones.yaActual');
    else {
      reg = r;
      const ult = r.versiones[r.versiones.length - 1];
      const adn = aLf(ult.adn);
      recordar(adn, ult.origenes ?? []);
      const og = structuredClone(ult.origenes ?? []);
      // en el modo texto, un paso deshacible (Ctrl+Z trae lo que había)
      aplicarTexto(
        adn,
        genesTexto(adn).map((_, i) => og[i] ?? null),
      );
      borradores.borrar(claveCargada);
      baseCargada = adn;
      borradorRecuperado = false;
      borradorAjeno = null;
      mensaje = t('editor.versiones.restaurada', { n, nueva: ult.n });
      oncambio?.(r);
    }
  } catch (e) {
    mensaje = textoErrorBots(e);
  } finally {
    ocupado = false;
  }
}

/** @param {number} a @param {number} b */
function comparar(a, b) {
  if (!reg) return;
  diff = { diff: diffVersiones($state.snapshot(reg), a, b), a, b };
}

/** @param {unknown} e */
function textoErrorBots(e) {
  if (e instanceof ErrorBots) {
    const s = t(`editor.error.${e.codigo}`, e.params);
    if (s !== `editor.error.${e.codigo}`) return s;
  }
  return t('editor.error.otro', { detalle: String(/** @type {any} */ (e)?.message ?? e) });
}

async function duplicar() {
  ocupado = true;
  mensaje = '';
  try {
    const nombre = nombreDup.trim();
    const nuevo = await bots().duplicar(
      {
        clase: bot.clase,
        clave: bot.clave,
        nombre: bot.nombre,
        archivo: bot.archivo,
        vegetal: bot.vegetal,
      },
      texto,
      { nombre: nombre || undefined, permitirNombreForo: confirmarForo },
    );
    duplicando = false;
    confirmarForo = false;
    nombreDup = '';
    if (onduplicado) onduplicado(nuevo);
    else location.hash = hashDe('bots', `propio:${nuevo.hash}`, 'adn');
  } catch (e) {
    if (e instanceof ErrorBots && e.codigo === 'nombre-del-foro') confirmarForo = true;
    mensaje = textoErrorBots(e);
  } finally {
    ocupado = false;
  }
}

/** @param {import('../../../../engine/lab.js').AccionLab} a */
function textoAccion(a) {
  if (a.tipo === 'agregar-gen') return t('editor.lab.accion.agregar', { gen: a.gen + 1 });
  if (a.tipo === 'remapear') return t('editor.lab.accion.remapear');
  return t('editor.lab.accion.renumerar');
}

/** @param {import('../../../../engine/lab.js').AvisoLab} a */
function textoAvisoLab(a) {
  switch (a.tipo) {
    case 'dep':
      return t('editor.lab.aviso.dep', {
        gen: a.i + 1,
        bot: nombreDe(a.archivo),
        dir: a.dir,
        escritores: a.escritores.map((j) => j + 1).join(', '),
      });
    case 'col':
      return t('editor.lab.aviso.col', { dir: a.dir, bots: a.archivos.map(nombreDe).join(', ') });
    case 'gl':
      return t('editor.lab.aviso.gl', { gen: a.i + 1, bot: nombreDe(a.archivo) });
    default:
      return t(`editor.lab.aviso.${a.motivo}`);
  }
}
</script>

<div class="editor">
  <section class="card principal">
    <div class="barra">
      <fieldset class="seg">
        <legend class="oculto">{t('editor.modo')}</legend>
        <button type="button" class:on={modo === 'texto'} onclick={() => (modo = 'texto')}>
          {t('editor.modoTexto')}
        </button>
        <button type="button" class:on={modo === 'genes'} onclick={() => (modo = 'genes')}>
          {t('editor.modoGenes')}
        </button>
      </fieldset>
      {#if ultima}
        <span class="chip mono">v{ultima.n}</span>
      {/if}
      {#if sinGuardar}
        <span class="chip aviso">{t('editor.sinGuardar')}</span>
      {/if}
      {#if nAvisos}
        <span class="chip aviso">{t('editor.avisos', { n: nAvisos })}</span>
      {/if}
      <span class="crece"></span>
      <button
        type="button"
        class="btn sm"
        class:on={pila}
        aria-pressed={pila}
        onclick={alternarPila}
      >
        {t('editor.pila')}
      </button>
      <button
        type="button"
        class="btn sm"
        class:on={lab}
        aria-pressed={lab}
        onclick={() => {
  lab = !lab;
  if (lab) cargarLab();
}}
      >
        {t('editor.laboratorio')}
      </button>
      {#if esPropio && !soloLectura}
        <input
          class="sel nota"
          type="text"
          bind:value={nota}
          placeholder={t('editor.guardar.nota')}
          aria-label={t('editor.guardar.nota')}
        >
        <button type="button" class="btn sm pri" disabled={ocupado || cargando} onclick={guardar}>
          {t('editor.guardar.boton', { n: (ultima?.n ?? 0) + 1 })}
        </button>
      {:else if !esPropio}
        <button
          type="button"
          class="btn sm pri"
          disabled={cargando}
          onclick={() => (duplicando = !duplicando)}
        >
          {t('editor.duplicar.boton')}
        </button>
      {/if}
    </div>

    {#if !esPropio}
      <p class="nota-foro">{t('editor.duplicar.soloLectura')}</p>
    {/if}
    {#if duplicando}
      <div class="duplicar">
        <label>
          {t('editor.duplicar.nombre')}
          <input
            class="sel"
            type="text"
            bind:value={nombreDup}
            placeholder={t('editor.duplicar.automatico')}
          >
        </label>
        {#if confirmarForo}
          <span class="help">{t('editor.duplicar.confirmarForo')}</span>
        {/if}
        <button type="button" class="btn sm pri" disabled={ocupado} onclick={duplicar}>
          {confirmarForo ? t('editor.duplicar.usarIgual') : t('editor.duplicar.crear')}
        </button>
        <button
          type="button"
          class="btn sm"
          onclick={() => {
  duplicando = false;
  confirmarForo = false;
}}
        >
          {t('editor.cancelar')}
        </button>
      </div>
    {/if}
    {#if mensaje}
      <p class="mensaje" role="status">{mensaje}</p>
    {/if}
    {#if borradorRecuperado && sinGuardar}
      <div class="mensaje fila-aviso" role="status">
        <span>{t('editor.borrador.restaurado')}</span>
        <button type="button" class="btn sm" onclick={descartarBorrador}>
          {t('editor.borrador.descartar')}
        </button>
      </div>
    {:else if borradorAjeno}
      <div class="mensaje fila-aviso" role="status">
        <span>{t('editor.borrador.otraBase')}</span>
        <button type="button" class="btn sm" onclick={recuperarAjeno}>
          {t('editor.borrador.recuperar')}
        </button>
        <button type="button" class="btn sm" onclick={descartarBorrador}>
          {t('editor.borrador.descartar')}
        </button>
      </div>
    {/if}
    {#if confirmarRestaurar !== null}
      <div class="mensaje fila-aviso" role="alert">
        <span>{t('editor.versiones.confirmarRestaurar', { n: confirmarRestaurar })}</span>
        <button
          type="button"
          class="btn sm"
          disabled={ocupado}
          onclick={() => confirmarRestaurar !== null && restaurar(confirmarRestaurar)}
        >
          {t('editor.versiones.restaurarIgual')}
        </button>
        <button type="button" class="btn sm" onclick={() => (confirmarRestaurar = null)}>
          {t('editor.cancelar')}
        </button>
      </div>
    {/if}
    {#if errorLint && !lectura}
      <p class="mensaje" role="alert">{t('editor.lint.noDisponible', { detalle: errorLint })}</p>
    {/if}

    {#if cargando}
      <p class="help relleno">{t('editor.cargando')}</p>
    {:else if errorCarga}
      <p class="mensaje relleno" role="alert">{t('editor.errorCarga', { detalle: errorCarga })}</p>
    {:else if diff}
      <DiffGenes diff={diff.diff} a={diff.a} b={diff.b} {nombreDe} oncerrar={() => (diff = null)} />
    {:else if modo === 'texto'}
      <AreaAdn
        bind:this={area}
        bind:valor={texto}
        soloLectura={lectura}
        {marcadas}
        {lineasMarcadas}
        etiqueta={t('editor.texto.etiquetaDe', { nombre: bot.nombre })}
        oncursor={(linea) => (lineaCursor = linea)}
      />
    {:else}
      <VistaGenes
        {texto}
        {bloques}
        {origenes}
        {nombreDe}
        avisos={avisosPorGen}
        soloLectura={lectura}
        onapagar={apagar}
        onencender={encender}
        onabrir={(n) => (genAbierto = n)}
        bind:abiertos
      />
    {/if}

    {#if avisosLint.length || avisosDelLab.length}
      <ul class="avisos" aria-label={t('editor.avisosTitulo')}>
        {#each avisosLint as a, i (`l${i}`)}
          <li class="aviso-l">
            <button
              type="button"
              class="donde"
              disabled={a.linea <= 0}
              onclick={() => irA(a.linea)}
            >
              {a.linea > 0
  ? genDeLinea(a.linea) >= 0
    ? t('editor.lint.dondeGen', { linea: a.linea, gen: genDeLinea(a.linea) + 1 })
    : t('editor.lint.donde', { linea: a.linea })
  : t('editor.lint.archivo')}
            </button>
            <span class="que">
              {t(`editor.lint.${a.codigo}`, a.params)}
              {#if a.veces > 1}
                <span class="help">{t('editor.lint.veces', { n: a.veces })}</span>
              {/if}
            </span>
            {#if a.arreglo && !lectura}
              <button type="button" class="btn sm" onclick={() => a.arreglo && arreglar(a.arreglo)}>
                {t('editor.lint.corregir')}
              </button>
            {/if}
          </li>
        {/each}
        {#each avisosDelLab as a, i (`a${i}`)}
          <li class="aviso-l" class:info={a.tipo === 'info'}>
            <span class="donde">{a.tipo === 'info' ? 'ℹ' : t('editor.lab.laboratorio')}</span>
            <span class="que">{textoAvisoLab(a)}</span>
            {#if !lectura}
              {#each a.acciones as x, k (k)}
                <button type="button" class="btn sm" onclick={() => accionLab(x)}>
                  {textoAccion(x)}
                </button>
              {/each}
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <aside class="lado">
    {#if lab}
      {#if datosLab}
        <PanelGenes
          datos={datosLab}
          soloLectura={lectura}
          oninsertar={(archivo, gen) => accionLab({ tipo: 'agregar-gen', archivo, gen })}
        />
      {:else}
        <p class="help">{t('editor.lab.cargando')}</p>
      {/if}
    {:else}
      {#if pila && !cargando && !errorCarga}
        <PanelPila
          pasos={pasosGen}
          gen={genCursor}
          {nombreGen}
          valores={valoresEjemplo}
          sysvars={sysvarsPila}
          estado={estadoPila}
          modo="editor"
          onvalor={cambiarValor}
        />
      {/if}
      {#if !cargando && !errorCarga}
        <PanelProbar
          clave={bot.clave}
          nombre={bot.nombre}
          vegetal={!!bot.vegetal}
          {texto}
          {versiones}
        />
      {/if}
      {#if esPropio}
        <PanelVersiones
          {versiones}
          soloLectura={lectura}
          onrestaurar={pedirRestaurar}
          oncomparar={comparar}
        />
      {/if}
    {/if}
  </aside>
</div>

<style>
.editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  min-height: 0;
  height: 100%;
}
.principal {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  overflow: hidden;
}
.barra {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--borde);
  flex-wrap: wrap;
}
.crece {
  flex: 1;
}
fieldset.seg {
  margin: 0;
  padding: 0;
  min-width: 0;
}
fieldset.seg legend + button {
  border-left: 0;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.chip.aviso {
  background: var(--aviso-fondo);
  color: var(--aviso-texto);
}
.nota {
  width: 180px;
}
.lado {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
}
.nota-foro,
.mensaje {
  margin: 0;
  padding: 6px 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--borde);
}
.nota-foro {
  color: var(--gris);
}
.mensaje {
  background: var(--aviso-fondo);
  color: var(--aviso-texto);
}
.relleno {
  padding: 16px;
}
.fila-aviso {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fila-aviso span {
  flex: 1;
}
.duplicar {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 8px 12px;
  border-bottom: 1px solid var(--borde);
  flex-wrap: wrap;
}
.duplicar label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--gris);
}
.avisos {
  list-style: none;
  margin: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--borde);
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow: auto;
}
.aviso-l {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 13px;
}
.aviso-l.info {
  background: var(--tarjeta);
  border-color: var(--borde);
  color: var(--gris);
}
.donde {
  white-space: nowrap;
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
}
.donde:disabled {
  cursor: default;
}
.que {
  flex: 1;
}
.editor :global(.btn.sm) {
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
}
.editor :global(.btn.on) {
  background: var(--activo-fondo);
  color: var(--activo-texto);
}
.editor :global(.btn:disabled) {
  opacity: 0.5;
  cursor: default;
}
.editor :global(.sel) {
  height: 30px;
  box-sizing: border-box;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--campo);
  font: inherit;
  font-size: 13px;
  padding: 0 8px;
  color: var(--texto);
  min-width: 0;
}
.editor :global(.help) {
  font-size: 12px;
  color: var(--gris-claro);
}
@media (max-width: 900px) {
  .editor {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
