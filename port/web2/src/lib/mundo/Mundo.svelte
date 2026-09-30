<script>
// @ts-check
// El mundo en un <canvas>: dibuja cada frame de la sesión (vista clásica o
// enriquecida), con cámara (rueda = zoom, arrastrar = paneo, +/−/encuadrar;
// con el lienzo enfocado, teclas + − 0 y flechas), selección por clic, seguir
// al bot con foco, rastro, tooltip y escala.
import { onMount } from 'svelte';
import { REG } from '../../../engine/protocolo.js';
import { num, t } from '../../i18n/index.svelte.js';
import { CopiaObjetos, objetoEn, siguienteObjeto } from '../observar/objetos/ordenes.js';
import { BOT, FLAG, VIS } from '../sim/frame.js';
import {
  barraEscala,
  botEn as botEnFilas,
  camaraNueva,
  centrarEn,
  cssAMundo,
  escalaBase,
  limitar,
  redimensionar,
  tolMundo,
  zoomEn,
} from './camara.js';
import { ERRORES_CARGA, tipoBot } from './claves.js';
import { RAMPA_CSS } from './color.js';
import {
  CAPAS_DEFECTO,
  dibujarBotsClasicos,
  dibujarFamilia,
  dibujarObjetos,
  dibujarVision,
} from './render-clasico.js';
import {
  ACCIONES,
  dibujarBotsRicos,
  dibujarEventos,
  EstadoRico,
  ingerirEventos,
  Rastro,
} from './render-enriquecido.js';

/**
 * @typedef {{ tipo: 'forma' | 'teleporter', n: number }} ObjetoSel
 * Modo borrar (barra «Mundo», N3.8): el clic sobre una forma o un
 * teleporter lo borra (onBorrar) en vez de seleccionar un bot; el objeto
 * bajo el puntero se resalta. Con el lienzo enfocado: N / Mayús+N recorren
 * los objetos, Supr o Intro borran el resaltado y Esc sale (onSalirBorrar).
 * onResaltar avisa el objeto resaltado (para anunciarlo) y la cantidad de
 * formas y teleporters del último frame. onBorrar devuelve false si no
 * borró (p. ej. la corrida está ocupada) o la promesa de la orden: hasta
 * que se cumple, la copia local de los objetos ya está compactada y no se
 * toman los de los frames (CopiaObjetos de ordenes.js).
 * onPunteroMundo (N4.1, Player Bot): el puntero en coordenadas de mundo en
 * cada movimiento sobre el lienzo, y null al salir.
 * @type {{ sesion: import('../sim/sesion.svelte.js').Sesion, modoBorrar?: boolean,
 *   onPunteroMundo?: (x: number | null, y?: number) => void,
 *   onBorrar?: (o: ObjetoSel) => (Promise<unknown> | false | void),
 *   onSalirBorrar?: () => void,
 *   onResaltar?: (o: ObjetoSel | null, nObs: number, nTps: number) => void }}
 */
let { sesion, modoBorrar = false, onBorrar, onSalirBorrar, onResaltar, onPunteroMundo } = $props();

const FONDO_CAMPO = '#0e0f0f';
const FONDO_AFUERA = '#080909';
/** tolerancia del clic (px de pantalla) para bots diminutos */
const TOL_CLIC = 6;
/** separación del tooltip respecto del puntero y de los bordes (px CSS) */
const TIP_SEP = 14;
const TIP_BORDE = 6;
/** paneo por tecla: fracción del lado visible */
const PASO_TECLA = 0.15;
/** @type {HTMLDivElement} */
let caja;
/** @type {HTMLCanvasElement} */
let lienzo;
/** @type {CanvasRenderingContext2D | null} */
let ctx = null;

// Estado del dibujo (no reactivo: cambia a ritmo de frame).
const cam = camaraNueva();
let dpr = 1;
let cw = 0;
let ch = 0;
let W = 0;
let H = 0;
let s = 1;
const rico = new EstadoRico();
const rastro = new Rastro();
let ultimoFoco = 0;
let ultimaRica = false;
// Copia del último frame para el clic y el tooltip (el búfer vuelve al worker).
let copiaBots = new Float32Array(0);
let copiaVis = new Float32Array(0);
let filas = 0;
let copiaRica = false;
// Formas y teleporters del último frame (modo borrar: clic y resaltado).
const objs = new CopiaObjetos(REG.obs, REG.tp);
/** @type {ObjetoSel | null} objeto resaltado en modo borrar */
let resaltado = null;
let sobreObjeto = $state(false);
/** @type {{ x: number, y: number, ox: number, oy: number, movido: boolean, id: number } | null} */
let arrastre = null;
/** puntero sobre el lienzo (px CSS relativos a la caja) o null */
/** @type {{ x: number, y: number } | null} */
let puntero = null;

// Estado de la superposición (reactivo, se actualiza solo si cambia).
// «Seguir» vive en la sesión (sesion.siguiendo) para que el inspector también
// lo maneje.
let escala = $state({ unidades: 0, px: 0 });
let rango = $state({ min: Number.NaN, max: Number.NaN });
let especieFoco = $state('');
/** @type {{ x: number, y: number, titulo: string, lineas: string[] } | null} */
let tip = $state(null);
let arrastrando = $state(false);
// Tamaños para ajustar el tooltip a los bordes.
let cajaW = $state(0);
let cajaH = $state(0);
let tipW = $state(0);
let tipH = $state(0);

/** @param {number} a @param {number} b */
const mismo = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));

/**
 * @param {import('../sim/frame.js').Frame} f
 */
function dibujar(f) {
  if (!ctx || cw <= 0 || ch <= 0) return;
  const ahora = performance.now();
  W = f.W;
  H = f.H;
  s = escalaBase(W, H, cw, ch);
  const rica = f.rica && sesion.rica;
  if (rica !== ultimaRica) {
    rico.limpiar();
    ultimaRica = rica;
  }
  if (f.foco !== ultimoFoco) {
    rastro.limpiar();
    ultimoFoco = f.foco;
  }
  const fv = f.of.focus >= 0 ? f.of.focus : -1;
  if (sesion.siguiendo && fv >= 0) centrarEn(cam, s, f.v[fv], f.v[fv + 1], cw, ch);
  limitar(cam, s, W, H, cw, ch);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = FONDO_AFUERA;
  ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(cam.z, 0, 0, cam.z, cam.ox, cam.oy);
  const LW = dpr / cam.z;
  ctx.fillStyle = FONDO_CAMPO;
  ctx.fillRect(0, 0, W * s, H * s);

  const p = { s, z: cam.z, LW, rica, contorno: sesion.contorno, capas: CAPAS_DEFECTO };
  dibujarObjetos(ctx, f, p);
  copiarObjetos(f);
  if (modoBorrar) dibujarResaltado(ctx, LW);
  if (rica) {
    const r = dibujarBotsRicos(ctx, f, rico, {
      s,
      LW,
      ahora,
      lente: sesion.lente,
      radiosFijos: !!sesion.opciones?.opts?.[21],
      ventana: [-cam.ox / cam.z, (cw - cam.ox) / cam.z, -cam.oy / cam.z, (ch - cam.oy) / cam.z],
    });
    if (!mismo(r.min, rango.min) || !mismo(r.max, rango.max)) rango = r;
  } else {
    dibujarBotsClasicos(ctx, f, p);
  }
  if (sesion.familia) dibujarFamilia(ctx, sesion.familia, p);
  if (rica) {
    ingerirEventos(f, rico, ahora);
    dibujarEventos(ctx, rico, { s, LW, ahora });
  }
  if (fv >= 0) {
    rastro.agregar(f.v[fv], f.v[fv + 1], W);
    rastro.dibujar(ctx, s, LW);
    if (CAPAS_DEFECTO.vision) dibujarVision(ctx, f, p);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  copiar(f, rica);
  actualizarSuperposicion(f);
  if (rica && rico.efectosActivos(ahora)) sesion.redibujar();
}

/**
 * @param {import('../sim/frame.js').Frame} f
 * @param {boolean} rica
 */
function copiar(f, rica) {
  const nB = f.nBots;
  if (copiaBots.length < nB * REG.bot) copiaBots = new Float32Array(nB * REG.bot + 2048);
  copiaBots.set(f.v.subarray(f.of.bots, f.of.bots + nB * REG.bot));
  copiaRica = rica && f.of.vis >= 0;
  if (copiaRica) {
    if (copiaVis.length < nB * REG.vis) copiaVis = new Float32Array(nB * REG.vis + 2048);
    copiaVis.set(f.v.subarray(f.of.vis, f.of.vis + nB * REG.vis));
  }
  filas = nB;
}

/**
 * Formas y teleporters del frame a la copia local (salvo con un borrado
 * sin confirmar) y el resaltado al día: con el puntero sobre el mundo se
 * recalcula en cada frame (las formas derivan, los índices se corren); sin
 * puntero (recorrido por teclado), un cambio en la cantidad lo quita.
 * @param {import('../sim/frame.js').Frame} f
 */
function copiarObjetos(f) {
  const cambio = objs.tomar(f.v, f.of.obs, f.nObs, f.of.tps, f.nTps);
  if (modoBorrar && puntero && !arrastre) {
    const [wx, wy] = mundoDe(puntero.x, puntero.y);
    if (!ponerResaltado(objetoBajo(wx, wy), false) && cambio)
      onResaltar?.(resaltado, objs.nObs, objs.nTps);
  } else if (resaltado && cambio) ponerResaltado(null, false);
  else if (cambio) onResaltar?.(resaltado, objs.nObs, objs.nTps);
}

/**
 * Borra el objeto: avisa a quien maneja la corrida y, si lo aceptó,
 * compacta la copia local hasta que el worker confirme.
 * @param {ObjetoSel} o
 */
function borrar(o) {
  ponerResaltado(null);
  const r = onBorrar?.(o);
  if (r === false || !objs.borrar(o)) return;
  onResaltar?.(resaltado, objs.nObs, objs.nTps);
  const listo = () => objs.confirmar();
  if (r && typeof r.then === 'function') r.then(listo, listo);
  else listo();
}

/**
 * Modo borrar: el objeto resaltado (de la copia local), con un borde
 * grueso y un velo.
 * @param {CanvasRenderingContext2D} c @param {number} LW
 */
function dibujarResaltado(c, LW) {
  if (!resaltado) return;
  const tp = resaltado.tipo === 'teleporter';
  const i = resaltado.n - 1;
  if (i < 0 || i >= (tp ? objs.nTps : objs.nObs)) return;
  const o = tp ? i * REG.tp : i * REG.obs;
  const v = tp ? objs.tps : objs.obs;
  const x = v[o] * s;
  const y = v[o + 1] * s;
  const w = v[o + 2] * s;
  const h = v[o + 3] * s;
  c.fillStyle = 'rgba(255, 90, 70, 0.25)';
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#ff5a46';
  c.lineWidth = 3 * LW;
  c.setLineDash([]);
  c.strokeRect(x, y, w, h);
  c.lineWidth = LW;
}

/**
 * @param {ObjetoSel | null} o @param {boolean} [pintar] pedir un frame (no
 *   hace falta mientras se dibuja uno)
 * @returns {boolean} cambió (y se avisó con onResaltar)
 */
function ponerResaltado(o, pintar = true) {
  const igual =
    (o === null && resaltado === null) ||
    (o !== null && resaltado !== null && o.tipo === resaltado.tipo && o.n === resaltado.n);
  resaltado = o;
  sobreObjeto = !!o;
  if (igual) return false;
  onResaltar?.(o, objs.nObs, objs.nTps);
  if (pintar) repintar();
  return true;
}

/**
 * Forma o teleporter bajo el punto de mundo (con TOL_CLIC px de pantalla de
 * margen para las formas finas de un laberinto).
 * @param {number} x @param {number} y
 */
function objetoBajo(x, y) {
  return objetoEn(
    objs.obs,
    objs.nObs,
    REG.obs,
    objs.tps,
    objs.nTps,
    REG.tp,
    x,
    y,
    tolMundo(TOL_CLIC / 2, dpr, s, cam.z),
  );
}

// Al salir del modo borrar, nada queda resaltado.
$effect(() => {
  if (!modoBorrar && resaltado) ponerResaltado(null);
});

/** @param {import('../sim/frame.js').Frame} f */
function actualizarSuperposicion(f) {
  const e = barraEscala((s * cam.z) / dpr, 80);
  if (e.unidades !== escala.unidades || Math.abs(e.px - escala.px) > 0.5) escala = e;
  let esp = '';
  if (f.foco > 0 && copiaRica) {
    const fila = filaDe(f.foco);
    if (fila >= 0) esp = sesion.nombreEspecie(copiaVis[fila * REG.vis + VIS.especie]);
  }
  if (esp !== especieFoco) especieFoco = esp;
  if (puntero && !arrastre) actualizarTip();
  else if (tip && !puntero) tip = null;
}

/** @param {number} n */
function filaDe(n) {
  for (let i = 0; i < filas; i++) if (copiaBots[i * REG.bot + BOT.idx] === n) return i;
  return -1;
}

/**
 * Bot bajo el punto de mundo (whichrob, ver camara.js), con un radio mínimo
 * de TOL_CLIC px de pantalla para bots diminutos.
 * @param {number} x @param {number} y
 */
function botEn(x, y) {
  return botEnFilas(copiaBots, filas, REG.bot, BOT, x, y, tolMundo(TOL_CLIC, dpr, s, cam.z));
}

/** @param {number} x @param {number} y px CSS relativos a la caja */
function mundoDe(x, y) {
  return cssAMundo(cam, s, dpr, x, y);
}

function actualizarTip() {
  if (!puntero || !copiaRica || !filas) {
    tip = null;
    return;
  }
  const [wx, wy] = mundoDe(puntero.x, puntero.y);
  const n = botEn(wx, wy);
  const fila = n ? filaDe(n) : -1;
  if (fila < 0) {
    tip = null;
    return;
  }
  const b = fila * REG.bot;
  const q = fila * REG.vis;
  const flags = copiaBots[b + BOT.flags];
  const tipo = tipoBot(flags);
  const m = rico.acciones.get(copiaVis[q + VIS.abs]);
  const acts =
    m && performance.now() - m.t < 1000
      ? ACCIONES.filter((_, k) => m.bits & (1 << k))
          .map((a) => t(`mundo.accion.${a}`))
          .join(', ')
      : '—';
  const lineas = [
    `#${n} · ${t(`mundo.tipo.${tipo}`)}${flags & FLAG.multibot ? ` · ${t('mundo.tipo.multibot')}` : ''}`,
    t('mundo.tip.recursos', {
      nrg: num(Math.round(copiaBots[b + BOT.nrg])),
      body: num(Math.round(copiaBots[b + BOT.body])),
      edad: num(copiaVis[q + VIS.edad]),
    }),
    t('mundo.tip.genetica', {
      gen: num(copiaVis[q + VIS.gen]),
      mut: num(copiaVis[q + VIS.mut]),
      adn: num(copiaVis[q + VIS.dnaLen]),
      kills: num(copiaVis[q + VIS.kills]),
      ties: num(copiaVis[q + VIS.ties]),
    }),
  ];
  const gd = copiaVis[q + VIS.gendist];
  if (gd >= 0) lineas.push(t('mundo.tip.gendist', { d: gd.toFixed(3) }));
  lineas.push(t('mundo.tip.acciones', { a: acts }));
  tip = {
    x: puntero.x,
    y: puntero.y,
    titulo: sesion.nombreEspecie(copiaVis[q + VIS.especie]) || '?',
    lineas,
  };
}

/** Repinta tras mover la cámara (con la sim en pausa hay que pedir el frame). */
function repintar() {
  sesion.redibujar();
}

/** @param {number} factor @param {number} [x] @param {number} [y] px de lienzo */
function zoom(factor, x = cw / 2, y = ch / 2) {
  zoomEn(cam, x, y, factor);
  limitar(cam, s, W, H, cw, ch);
  repintar();
}

function encuadrar() {
  cam.z = 1;
  if (sesion.siguiendo) sesion.seguir(false);
  limitar(cam, s, W, H, cw, ch);
  repintar();
}

/** @param {boolean} on */
function ponerSeguir(on) {
  sesion.seguir(on);
}

// Al empezar a seguir (desde acá o desde el inspector), acercar si hace falta.
let seguiaAntes = false;
$effect(() => {
  const on = sesion.siguiendo;
  if (on && !seguiaAntes && cam.z < 2) {
    cam.z = 4;
    repintar();
  }
  seguiaAntes = on;
});

/** @param {PointerEvent} e */
function local(e) {
  const r = lienzo.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

/** @param {PointerEvent} e */
function alBajar(e) {
  if (e.button !== 0) return;
  const p = local(e);
  arrastre = { x: p.x, y: p.y, ox: cam.ox, oy: cam.oy, movido: false, id: e.pointerId };
  lienzo.setPointerCapture(e.pointerId);
}

/** @param {PointerEvent} e */
function alMover(e) {
  const p = local(e);
  puntero = p;
  if (onPunteroMundo) {
    const [wx, wy] = mundoDe(p.x, p.y);
    onPunteroMundo(wx, wy);
  }
  if (!arrastre) {
    if (modoBorrar) {
      tip = null;
      const [wx, wy] = mundoDe(p.x, p.y);
      ponerResaltado(objetoBajo(wx, wy));
      return;
    }
    actualizarTip();
    return;
  }
  if (!arrastre.movido && Math.hypot(p.x - arrastre.x, p.y - arrastre.y) < 4) return;
  if (!arrastre.movido && cam.z <= 1) return; // sin zoom no hay paneo
  arrastre.movido = true;
  arrastrando = true;
  tip = null;
  if (sesion.siguiendo) sesion.seguir(false);
  cam.ox = arrastre.ox + (p.x - arrastre.x) * dpr;
  cam.oy = arrastre.oy + (p.y - arrastre.y) * dpr;
  limitar(cam, s, W, H, cw, ch);
  repintar();
}

/** @param {PointerEvent} e */
function alSoltar(e) {
  if (!arrastre) return;
  const clic = !arrastre.movido;
  arrastre = null;
  arrastrando = false;
  if (lienzo.hasPointerCapture(e.pointerId)) lienzo.releasePointerCapture(e.pointerId);
  if (!clic) return;
  const p = local(e);
  const [wx, wy] = mundoDe(p.x, p.y);
  if (modoBorrar) {
    const o = objetoBajo(wx, wy);
    if (o) borrar(o);
    return;
  }
  const n = botEn(wx, wy);
  if (n !== sesion.foco) {
    rastro.limpiar();
  }
  sesion.seleccionar(n);
}

/**
 * Cancelado por el sistema (gesto, pérdida de captura): solo limpia el
 * arrastre, sin seleccionar.
 * @param {PointerEvent} e
 */
function alCancelar(e) {
  if (!arrastre) return;
  arrastre = null;
  arrastrando = false;
  if (lienzo.hasPointerCapture(e.pointerId)) lienzo.releasePointerCapture(e.pointerId);
}

function alSalir() {
  puntero = null;
  onPunteroMundo?.(null);
  tip = null;
  if (modoBorrar) ponerResaltado(null);
}

/**
 * Modo borrar por teclado: N / Mayús+N recorren los objetos (la cámara no
 * se mueve), Supr / Retroceso / Intro borran el resaltado, Esc sale.
 * @param {KeyboardEvent} e
 * @returns {boolean} la tecla se usó
 */
function teclaBorrar(e) {
  switch (e.key) {
    case 'n':
    case 'N':
      ponerResaltado(siguienteObjeto(resaltado, objs.nObs, objs.nTps, e.shiftKey ? -1 : 1));
      return true;
    case 'Delete':
    case 'Backspace':
    case 'Enter':
      if (!resaltado) return false;
      borrar(resaltado);
      return true;
    case 'Escape':
      ponerResaltado(null);
      onSalirBorrar?.();
      return true;
    default:
      return false;
  }
}

/** @param {KeyboardEvent} e */
function alTeclear(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (modoBorrar && teclaBorrar(e)) {
    e.preventDefault();
    return;
  }
  const dx = cw * PASO_TECLA;
  const dy = ch * PASO_TECLA;
  switch (e.key) {
    case '+':
    case '=':
      zoom(1.5);
      break;
    case '-':
    case '_':
      zoom(1 / 1.5);
      break;
    case '0':
      encuadrar();
      break;
    case 'ArrowLeft':
      panear(dx, 0);
      break;
    case 'ArrowRight':
      panear(-dx, 0);
      break;
    case 'ArrowUp':
      panear(0, dy);
      break;
    case 'ArrowDown':
      panear(0, -dy);
      break;
    default:
      return;
  }
  e.preventDefault();
}

/** @param {number} dx @param {number} dy px de lienzo */
function panear(dx, dy) {
  if (sesion.siguiendo) sesion.seguir(false);
  cam.ox += dx;
  cam.oy += dy;
  limitar(cam, s, W, H, cw, ch);
  repintar();
}

/** @param {WheelEvent} e */
function alRodar(e) {
  e.preventDefault();
  const p = local(/** @type {any} */ (e));
  zoom(Math.exp(-e.deltaY * 0.0015), p.x * dpr, p.y * dpr);
}

function medir() {
  dpr = window.devicePixelRatio || 1;
  const r = caja.getBoundingClientRect();
  cajaW = r.width;
  cajaH = r.height;
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (w === cw && h === ch) return;
  // El punto de mundo del centro sigue en el centro tras redimensionar.
  s = redimensionar(cam, W, H, cw, ch, w, h);
  cw = w;
  ch = h;
  lienzo.width = w;
  lienzo.height = h;
  repintar();
}

/**
 * Vigila el devicePixelRatio (zoom del navegador, pasar a otra pantalla):
 * la consulta vale para el dpr actual y se rearma en cada cambio.
 * @returns {() => void} baja
 */
function vigilarDpr() {
  /** @type {MediaQueryList | null} */
  let mq = null;
  const alCambiar = () => {
    medir();
    armar();
  };
  const armar = () => {
    mq?.removeEventListener('change', alCambiar);
    mq = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
    mq?.addEventListener('change', alCambiar);
  };
  armar();
  return () => mq?.removeEventListener('change', alCambiar);
}

onMount(() => {
  ctx = lienzo.getContext('2d', { alpha: false });
  medir();
  const ro = new ResizeObserver(medir);
  ro.observe(caja);
  const bajaDpr = vigilarDpr();
  lienzo.addEventListener('wheel', alRodar, { passive: false });
  sesion.c.ponerDibujante(dibujar);
  repintar();
  return () => {
    sesion.c.quitarDibujante(dibujar);
    ro.disconnect();
    bajaDpr();
    lienzo.removeEventListener('wheel', alRodar);
  };
});

/** «Especie» → «especie», pero «DNA length» queda igual. @param {string} x */
const minuscula = (x) => (/^\p{Lu}\p{Ll}/u.test(x) ? x[0].toLowerCase() + x.slice(1) : x);

/** Posición del tooltip: al lado del puntero, del otro lado si no entra. */
const tipPos = $derived.by(() => {
  if (!tip) return { x: 0, y: 0 };
  let x = tip.x + TIP_SEP;
  let y = tip.y + TIP_SEP;
  if (x + tipW > cajaW - TIP_BORDE) x = tip.x - TIP_SEP - tipW;
  if (y + tipH > cajaH - TIP_BORDE) y = tip.y - TIP_SEP - tipH;
  x = Math.max(TIP_BORDE, Math.min(x, cajaW - tipW - TIP_BORDE));
  y = Math.max(TIP_BORDE, Math.min(y, cajaH - tipH - TIP_BORDE));
  return { x, y };
});

/** Texto del fallo de carga: por clave, con el genérico de respaldo. */
const textoErrorCarga = $derived.by(() => {
  const e = sesion.errorCarga;
  if (!e) return '';
  if (ERRORES_CARGA.includes(e.clave)) return t(`mundo.errorCarga.${e.clave}`, e.params);
  return t('mundo.error', { msg: e.msg || e.clave });
});

const textoVista = $derived(
  sesion.rica
    ? `${t('mundo.vista.rica')} · ${t('mundo.colorPor', { lente: minuscula(t(`mundo.lente.${sesion.lente}`)) })}`
    : t(sesion.contorno ? 'mundo.vista.contorno' : 'mundo.vista.clasica'),
);
</script>

<div class="mundo" bind:this={caja}>
  <canvas
    bind:this={lienzo}
    class:paneo={arrastrando}
    class:borrar={modoBorrar}
    class:sobre={modoBorrar && sobreObjeto}
    aria-keyshortcuts={modoBorrar ? 'N Shift+N Delete Escape' : undefined}
    tabindex="0"
    aria-label={t('mundo.aria')}
    onpointerdown={alBajar}
    onpointermove={alMover}
    onpointerup={alSoltar}
    onpointercancel={alCancelar}
    onpointerleave={alSalir}
    onkeydown={alTeclear}
  ></canvas>

  <div class="arriba-izq">
    <span class="chip oscuro texto">{textoVista}</span>
    {#if sesion.foco > 0}
      <span class="chip oscuro foco">
        <span class="mono">#{sesion.foco}</span>
        {#if especieFoco}
          <span>· {especieFoco}</span>
        {/if}
        <button
          type="button"
          class="mini"
          class:on={sesion.siguiendo}
          aria-pressed={sesion.siguiendo}
          onclick={() => ponerSeguir(!sesion.siguiendo)}
        >
          {sesion.siguiendo ? t('mundo.soltar') : t('mundo.seguir')}
        </button>
        <button
          type="button"
          class="mini"
          aria-label={t('mundo.deseleccionar')}
          title={t('mundo.deseleccionar')}
          onclick={() => sesion.seleccionar(0)}
        >
          ×
        </button>
      </span>
    {:else if sesion.listo && !modoBorrar}
      <span class="chip oscuro texto">{t('mundo.ayuda.clic')}</span>
    {/if}
  </div>

  {#if sesion.rica && sesion.lente !== 'especie'}
    <div class="leyenda">
      <div class="rampa" style:background={RAMPA_CSS}></div>
      <div class="extremos mono">
        <span>{num(rango.min, { maximumFractionDigits: 3 })}</span>
        <span>{num(rango.max, { maximumFractionDigits: 3 })}</span>
      </div>
      {#if sesion.lente === 'gendist' && sesion.sinReferencia}
        <div class="nota">{t('mundo.lente.sinReferencia')}</div>
      {/if}
    </div>
  {/if}

  <div class="arriba-der">
    <button
      class="wbtn"
      type="button"
      aria-label={t('mundo.acercar')}
      title={t('mundo.acercar')}
      onclick={() => zoom(1.5)}
    >
      +
    </button>
    <button
      class="wbtn"
      type="button"
      aria-label={t('mundo.alejar')}
      title={t('mundo.alejar')}
      onclick={() => zoom(1 / 1.5)}
    >
      −
    </button>
    <button
      class="wbtn chico"
      type="button"
      aria-label={t('mundo.encuadrar')}
      title={t('mundo.encuadrar')}
      onclick={encuadrar}
    >
      [ ]
    </button>
  </div>

  {#if escala.unidades > 0 && sesion.campo.W > 0}
    <div class="escala mono">
      <span class="barra" style:width={`${escala.px}px`}></span>
      {t('mundo.escala', {
  u: num(escala.unidades),
  w: num(sesion.campo.W),
  h: num(sesion.campo.H),
})}
    </div>
  {/if}

  {#if tip}
    <div
      class="tip"
      bind:offsetWidth={tipW}
      bind:offsetHeight={tipH}
      style:left={`${tipPos.x}px`}
      style:top={`${tipPos.y}px`}
    >
      <b>{tip.titulo}</b>
      {#each tip.lineas as l, i (i)}
        <div>{l}</div>
      {/each}
    </div>
  {/if}

  {#if sesion.errorCarga}
    <div class="estado error" role="alert">{textoErrorCarga}</div>
  {:else if !sesion.listo}
    <div class="estado" role="status">{t('mundo.cargando')}</div>
  {/if}

  {#if sesion.avisoError}
    <div class="aviso-error" role="alert">
      <span>{t('mundo.avisoError', { msg: sesion.avisoError })}</span>
      <button
        type="button"
        class="mini"
        aria-label={t('mundo.avisoError.cerrar')}
        title={t('mundo.avisoError.cerrar')}
        onclick={() => sesion.descartarAviso()}
      >
        ×
      </button>
    </div>
  {/if}
</div>

<style>
.mundo {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 240px;
  background: var(--mundo);
  overflow: hidden;
  user-select: none;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
  touch-action: none;
}
canvas.paneo {
  cursor: grabbing;
}
/* modo borrar (barra «Mundo»): puntero de acción sobre una forma o teleporter */
canvas.borrar {
  cursor: cell;
}
canvas.borrar.sobre {
  cursor: pointer;
}
canvas.borrar:focus-visible {
  outline-color: #ff5a46;
}
canvas:focus-visible {
  outline: 2px solid #4c7c76;
  outline-offset: -2px;
}
.arriba-izq {
  position: absolute;
  left: 16px;
  top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: calc(100% - 100px);
  pointer-events: none;
}
.chip.oscuro {
  background: #1b1c1b;
  color: #d8d6ce;
  border: 1px solid #33332f;
  pointer-events: auto;
}
/* solo texto: no tapa el clic sobre los bots de abajo */
.chip.oscuro.texto {
  pointer-events: none;
}
.foco {
  gap: 6px;
}
.mini {
  font: inherit;
  font-size: 12px;
  border: 1px solid #45453f;
  background: #262724;
  color: #e8e6df;
  border-radius: 999px;
  padding: 1px 8px;
  cursor: pointer;
}
.mini:hover {
  background: #33342f;
}
.mini.on {
  background: #2e4f4b;
  border-color: #4c7c76;
}
.arriba-der {
  position: absolute;
  right: 16px;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wbtn {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid #33332f;
  background: #1b1c1b;
  color: #e8e6df;
  font: inherit;
  font-size: 18px;
  cursor: pointer;
}
.wbtn:hover {
  background: #2a2a27;
}
.wbtn.chico {
  font-size: 13px;
}
.leyenda {
  position: absolute;
  left: 16px;
  top: 56px;
  width: 200px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(27, 28, 27, 0.9);
  border: 1px solid #33332f;
  color: #d8d6ce;
  font-size: 11px;
  pointer-events: none;
}
.rampa {
  height: 8px;
  border-radius: 4px;
}
.extremos {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}
.nota {
  margin-top: 6px;
  color: #e8c46b;
}
.escala {
  position: absolute;
  left: 16px;
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #a9a79f;
  pointer-events: none;
}
.barra {
  display: inline-block;
  height: 1px;
  background: #a9a79f;
}
.tip {
  position: absolute;
  z-index: 2;
  max-width: 280px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(21, 21, 19, 0.95);
  border: 1px solid #45453f;
  color: #e8e6df;
  font-size: 12px;
  line-height: 1.45;
  pointer-events: none;
}
.estado {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d8d6ce;
  font-size: 14px;
  /* cargando: no tapa ni bloquea el lienzo */
  pointer-events: none;
}
.estado.error {
  /* el motor no cargó: esto sí bloquea */
  pointer-events: auto;
  background: rgba(8, 9, 9, 0.85);
  color: #ffb4a8;
  padding: 24px;
  text-align: center;
}
.aviso-error {
  position: absolute;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(560px, calc(100% - 32px));
  padding: 8px 10px 8px 14px;
  border-radius: 8px;
  background: rgba(58, 29, 25, 0.95);
  border: 1px solid #7a3b32;
  color: #ffd6cf;
  font-size: 12px;
  line-height: 1.4;
}
.aviso-error span {
  overflow-wrap: anywhere;
}
</style>
