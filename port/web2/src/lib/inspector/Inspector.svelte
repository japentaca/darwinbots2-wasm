<script>
// @ts-check
// Inspector del bot (paso N1.4; PLAN, Nivel 1: «inspector del bot, que
// reemplaza al panel de estadísticas»). Panel lateral de ~400 px que Observar
// monta mientras haya foco o el bot recién haya muerto (estado.svelte.js).
//
// Datos: el frame con foco (bloque de db_sim_dump_focus + registro de la vista
// enriquecida) y los mensajes del worker bot-text, family, genes/activ,
// console/console-cmd/console-out, sysvar y eye-read. Nada de esto escribe en
// la sim salvo lo que el usuario escriba en la consola y la pestaña Control
// (N4.1, decisión 15: Player Bot, diseñador de ojos y sus facilidades).
import { onMount, untrack } from 'svelte';
import { num, t } from '../../i18n/index.svelte.js';
import { vbACss } from '../mundo/color.js';
import { ESTADO, FLAG } from '../sim/frame.js';
import Adn from './Adn.svelte';
import Consola from './Consola.svelte';
import ControlJugador from './ControlJugador.svelte';
import { COMANDOS, HistorialComandos, SalidaConsola, verbo } from './consola.js';
import DisenadorOjos from './DisenadorOjos.svelte';
import {
  cabeceraAdn,
  datosBot,
  hayQueCambiarBot,
  maximosDelMundo,
  parientes,
  resumenFamilia,
} from './datos.js';
import { estadoInspector } from './estado.svelte.js';
import Familia from './Familia.svelte';
import Memoria from './Memoria.svelte';
import { LectorMemoria } from './memoria.js';
import Resumen from './Resumen.svelte';
import Sentidos from './Sentidos.svelte';
import { SerieCiclos } from './serie.js';

/**
 * @type {{
 *   sesion: import('../sim/sesion.svelte.js').Sesion,
 *   corrida: import('../sim/corrida-nucleo.js').NucleoCorrida,
 *   onCerrar: () => void,
 *   siguiendo?: boolean,
 *   onSeguir?: (on: boolean) => void,
 * }}
 */
let { sesion, corrida, onCerrar, siguiendo = false, onSeguir } = $props();

const PESTANAS = /** @type {const} */ ([
  'resumen',
  'sentidos',
  'memoria',
  'adn',
  'consola',
  'control',
]);
/** Refresco del panel (ms): los frames llegan a 60 por segundo. */
const REFRESCO = 100;
/** Ventana de la sparkline de energía (ciclos). */
const VENTANA = 1000;

/** bot que muestra el panel (slot; 0 = ninguno) */
let bot = $state(0);
/** @type {(typeof PESTANAS)[number]} */
let pestana = $state('resumen');
/** @type {import('./datos.js').DatosBot | null} */
let datos = $state.raw(null);
let maximos = $state.raw({ nrg: 1, body: 1, venom: 1, shell: 1, waste: 1 });
/** @type {import('./datos.js').Parientes | null} */
let rel = $state.raw(null);
let chispa = $state('');
/** altura de la línea base (valor 0) de la sparkline */
let base = $state(59);
/** texto del ADN (null = pedido, sin respuesta) */
/** @type {string | null} */
let adn = $state(null);
/** @type {number[] | null} genes activos del último ciclo (1/0 por gen) */
let genes = $state.raw(null);
let familiaAbierta = $state(false);
/** @type {ReturnType<typeof resumenFamilia> | null} */
let familia = $state.raw(null);
/** @type {Map<number, number>} memoria leída (dirección → valor) */
let memoria = $state.raw(new Map());
let textoConsola = $state('');

const murio = $derived(estadoInspector.murio);
const vivo = $derived(bot > 0 && !murio);

const serie = new SerieCiclos(VENTANA);
const lector = new LectorMemoria((m) => sesion.c.enviar(m));
const salida = new SalidaConsola();
const historial = new HistorialComandos();
/** bots cuya consola ya mostró la cabecera */
const consolasSaludadas = new Set();

/** Último cálculo del frame, publicado con REFRESCO. */
/** @type {{ d: import('./datos.js').DatosBot, max: typeof maximos, rel: import('./datos.js').Parientes | null } | null} */
let paquete = null;
let tPublicado = 0;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let temporizador;
let memoriaAgendada = false;

function publicar() {
  temporizador = undefined;
  tPublicado = performance.now();
  if (!paquete) return;
  datos = paquete.d;
  maximos = paquete.max;
  rel = paquete.rel;
  chispa = serie.camino(330, 60);
  base = serie.lineaBase(60);
}

/** @param {number} n */
function cambiarBot(n) {
  if (familiaAbierta) sesion.quitarFamilia();
  familiaAbierta = false;
  familia = null;
  bot = n;
  estadoInspector.murio = false;
  datos = null;
  rel = null;
  paquete = null;
  genes = null;
  chispa = '';
  serie.limpiar();
  lector.bot = n;
  memoria = new Map();
  salida.limpiar();
  textoConsola = '';
  pedirAdn();
  // Con la sim en pausa hace falta un frame para llenar el panel.
  sesion.redibujar();
}

function pedirAdn() {
  const n = bot;
  adn = null;
  sesion.adnDe(n).then((texto) => {
    if (bot === n) adn = texto;
  });
}

function morir() {
  estadoInspector.murio = true;
  clearTimeout(temporizador);
  publicar();
  if (familiaAbierta) sesion.quitarFamilia();
  familiaAbierta = false;
  if (pestana === 'consola') anotar(t('inspector.consola.cerrada'));
}

// El foco de la sesión manda: otro bot = otro panel; foco 0 sin muerte =
// deselección (Observar desmonta el panel).
$effect(() => {
  const n = sesion.foco;
  untrack(() => {
    // El mismo slot tras una muerte es otro bot (el motor reutiliza slots).
    if (hayQueCambiarBot(n, bot, estadoInspector.murio)) cambiarBot(n);
    else if (n === 0 && !estadoInspector.murio) bot = 0;
  });
});

onMount(() => {
  const c = sesion.c;
  const bajas = [
    c.on('frame', (/** @type {import('../sim/conexion.js').EventoFrame} */ ev) => {
      if (!bot || estadoInspector.murio || !ev.seqVigente) return;
      const f = ev.frame;
      // La sesión ya soltó el foco en este mismo frame: el bot murió.
      if (!(f.foco > 0)) {
        if (sesion.foco === 0) morir();
        return;
      }
      if (f.foco !== bot) return;
      const d = datosBot(f, bot);
      if (!d) return;
      serie.agregar(ev.stats.cycle, d.nrg);
      paquete = { d, max: maximosDelMundo(f), rel: d.rica ? parientes(f, d.abs) : null };
      const espera = REFRESCO - (performance.now() - tPublicado);
      if (espera <= 0) publicar();
      else if (temporizador === undefined) temporizador = setTimeout(publicar, espera);
    }),
    c.on('genes', (m) => {
      if ((m.n | 0) === bot && Array.isArray(m.ga)) genes = m.ga;
    }),
    c.on('family', (m) => {
      if (familiaAbierta && (m.n | 0) === bot) familia = resumenFamilia(m);
    }),
    c.on('bot-text', (m) => {
      if ((m.n | 0) === bot && !estadoInspector.murio) adn = String(m.text ?? '');
    }),
    c.on('sysvar', (m) => {
      if (lector.alSysvar(m)) agendarMemoria();
    }),
    c.on('console-out', (m) => {
      if ((m.n | 0) !== bot) return;
      if (lector.alConsola(m)) {
        agendarMemoria();
        return;
      }
      // Se anota aunque la pestaña visible no sea Consola (p. ej. la salida
      // de un comando que llega después de cambiar de pestaña).
      anotar(String(m.text ?? ''));
    }),
    c.on('console-open', (m) => {
      const n = m.n | 0;
      if (n !== bot || consolasSaludadas.has(n)) return;
      consolasSaludadas.add(n);
      anotar(
        t('inspector.consola.abierta', {
          abs: m.absnum,
          nombre: String(m.name ?? '').replace(/\.txt$/i, ''),
          genes: m.genenum,
        }),
      );
      anotar(t('inspector.consola.ayudaCorta'));
    }),
  ];
  sesion.redibujar();
  return () => {
    for (const baja of bajas) baja();
    clearTimeout(temporizador);
    if (familiaAbierta) sesion.quitarFamilia();
    estadoInspector.murio = false;
  };
});

// Los genes activos llegan tras cada frame mientras «activ» está encendido.
$effect(() => {
  if (pestana !== 'resumen' || !vivo) return;
  const n = bot;
  sesion.c.activ(true);
  sesion.c.genes(n);
  return () => sesion.c.activ(false);
});

// La consola del bot está abierta mientras se ve su pestaña.
$effect(() => {
  if (pestana !== 'consola' || !vivo) return;
  const n = bot;
  sesion.c.console(n, true);
  return () => sesion.c.console(n, false);
});

/**
 * Las consultas de memoria sin respuesta se olvidan al cambiar de pestaña
 * (con una barrera: sus respuestas tardías no llegan a la consola).
 * @param {(typeof PESTANAS)[number]} p
 */
function irAPestana(p) {
  if (p === pestana) return;
  lector.olvidarPendientes();
  pestana = p;
}

// Pestañas con el patrón WAI-ARIA: tabindex móvil, flechas, Inicio y Fin.
const idBase = $props.id();
/** @type {HTMLButtonElement[]} */
const botonesPestana = [];

/** @param {KeyboardEvent} e */
function teclasPestanas(e) {
  const i = PESTANAS.indexOf(pestana);
  let j = -1;
  if (e.key === 'ArrowRight') j = (i + 1) % PESTANAS.length;
  else if (e.key === 'ArrowLeft') j = (i - 1 + PESTANAS.length) % PESTANAS.length;
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = PESTANAS.length - 1;
  if (j < 0) return;
  e.preventDefault();
  irAPestana(PESTANAS[j]);
  botonesPestana[j]?.focus();
}

function agendarMemoria() {
  if (memoriaAgendada) return;
  memoriaAgendada = true;
  queueMicrotask(() => {
    memoriaAgendada = false;
    memoria = lector.valores;
  });
}

/**
 * Valor leído de un sysvar (reactivo: depende de `memoria`).
 * @param {string} nombre
 * @returns {number | undefined}
 */
function valorDe(nombre) {
  const m = memoria;
  const d = lector.direccion(nombre);
  return d ? m.get(d) : undefined;
}

/**
 * Dirección de un sysvar (reactivo: se renueva con `memoria`).
 * @param {string} nombre
 * @returns {number | undefined}
 */
function direccionDe(nombre) {
  return memoria ? lector.direccion(nombre) : undefined;
}

/** @param {readonly string[]} nombres */
function leerMemoria(nombres) {
  if (vivo) lector.leer(nombres);
}

/** @param {string} texto */
function anotar(texto) {
  salida.agregar(texto);
  textoConsola = salida.texto;
}

/** @param {string} linea */
function comando(linea) {
  const l = linea.trim();
  if (!l) return;
  historial.agregar(l);
  anotar(`> ${l}`);
  const v = verbo(l);
  if (v === 'clear') {
    salida.limpiar();
    textoConsola = '';
    return;
  }
  if (v === 'help') {
    anotar(t('inspector.consola.ayuda.intro'));
    anotar(t('inspector.consola.ayuda.titulo'));
    for (const [c, sintaxis] of Object.entries(COMANDOS))
      anotar(`  ${sintaxis} — ${t(`inspector.consola.ayuda.${c}`)}`);
    anotar(`  help — ${t('inspector.consola.ayuda.help')}`);
    anotar(`  clear — ${t('inspector.consola.ayuda.clear')}`);
    return;
  }
  if (!vivo) return;
  sesion.c.consoleCmd(bot, l);
  if (v === 'showdna') anotar(t('inspector.consola.adnEnPestana'));
  sesion.c.genes(bot);
}

/** @param {number} slot */
function irA(slot) {
  if (slot > 0 && vivo) sesion.seleccionar(slot);
}

function alternarFamilia() {
  if (!vivo) return;
  if (familiaAbierta) {
    familiaAbierta = false;
    familia = null;
    sesion.quitarFamilia();
  } else {
    familiaAbierta = true;
    familia = null;
    sesion.familiaDe(bot);
  }
}

const gendistOn = $derived(sesion.rica && sesion.lente === 'gendist');

function alternarGendist() {
  if (!vivo) return;
  if (gendistOn) sesion.ponerLente('especie');
  else {
    if (!sesion.rica) sesion.ponerVista(true);
    sesion.ponerLente('gendist');
  }
}

// Cerrar = lo que decida la pantalla (Observar deselecciona el bot).
function cerrar() {
  estadoInspector.murio = false;
  onCerrar();
}

// ---- Cabecera ----------------------------------------------------------------

const deAdn = $derived(adn ? cabeceraAdn(adn) : { gen: -1, mut: -1 });
const nombre = $derived(datos?.rica ? sesion.nombreEspecie(datos.especie) : '');
const gen = $derived(datos && datos.gen >= 0 ? datos.gen : deAdn.gen);
const mut = $derived(datos && datos.mut >= 0 ? datos.mut : deAdn.mut);
const edad = $derived(datos ? datos.edad : (sesion.focoVivo?.edad ?? -1));

const subtitulo = $derived.by(() => {
  const partes = [];
  if (datos?.abs) partes.push(`#${datos.abs}`);
  if (gen >= 0) partes.push(t('inspector.gen', { n: num(gen) }));
  if (mut >= 0)
    partes.push(mut === 1 ? t('inspector.mut.una') : t('inspector.mut.otras', { n: num(mut) }));
  if (edad >= 0) partes.push(t('inspector.edad', { n: num(edad) }));
  return partes.join(' · ');
});

const estados = $derived.by(() => {
  if (!datos) return [];
  const e = datos.estado;
  const out = [];
  if (datos.flags & FLAG.veg) out.push('vegetal');
  if (datos.flags & FLAG.fixed) out.push('fijo');
  if (e & ESTADO.paralizado) out.push('paralizado');
  if (e & ESTADO.envenenado) out.push('envenenado');
  if (e & ESTADO.virus) out.push('virus');
  if (e & ESTADO.fertilizado) out.push('fertilizado');
  return out;
});
</script>

<section class="inspector" aria-label={t('inspector.aria')}>
  <header class="cab">
    <span
      class="punto"
      style:background={datos ? vbACss(datos.color) : 'var(--borde-control)'}
    ></span>
    <div class="titulo">
      <h2>{nombre || t('inspector.sinNombre')}</h2>
      <div class="mono sub">{subtitulo}</div>
      {#if estados.length}
        <div class="estados">
          {#each estados as e (e)}
            <span class="chip">{t(`inspector.estado.${e}`)}</span>
          {/each}
        </div>
      {/if}
    </div>
    <button
      class="btn x"
      type="button"
      aria-label={t('inspector.cerrar')}
      title={t('inspector.cerrar')}
      onclick={cerrar}
    >
      ×
    </button>
  </header>

  {#if murio}
    <div class="murio" role="status">
      <div>
        <strong>{t('inspector.murio')}</strong>
        <div class="detalle">{t('inspector.murio.detalle')}</div>
      </div>
      <button class="btn" type="button" onclick={cerrar}>{t('inspector.murio.cerrar')}</button>
    </div>
  {/if}

  <div class="acciones">
    <button
      class="btn chico"
      class:pri={siguiendo}
      type="button"
      disabled={!vivo || !onSeguir}
      aria-pressed={siguiendo}
      title={onSeguir ? t('inspector.seguir.ayuda') : t('inspector.seguir.noDisponible')}
      onclick={() => onSeguir?.(!siguiendo)}
    >
      {siguiendo ? t('inspector.dejarSeguir') : t('inspector.seguir')}
    </button>
    <button
      class="btn chico"
      class:on={familiaAbierta}
      type="button"
      disabled={!vivo}
      aria-pressed={familiaAbierta}
      title={t('inspector.familia.ayuda')}
      onclick={alternarFamilia}
    >
      {t('inspector.familia')}
    </button>
    <button
      class="btn chico"
      class:on={gendistOn}
      type="button"
      disabled={!vivo}
      aria-pressed={gendistOn}
      title={t('inspector.gendist.ayuda')}
      onclick={alternarGendist}
    >
      {t('inspector.gendist')}
    </button>
  </div>

  {#if datos && !datos.rica && !murio}
    <div class="aviso">
      <span>{t('inspector.sinVistaRica')}</span>
      <button class="btn chico" type="button" onclick={() => sesion.ponerVista(true)}>
        {t('inspector.activarRica')}
      </button>
    </div>
  {/if}

  {#if familiaAbierta}
    <Familia {familia} {rel} onIr={irA} onCerrar={alternarFamilia} />
  {/if}

  <div
    class="seg pestanas"
    role="tablist"
    tabindex="-1"
    aria-label={t('inspector.pestanas')}
    onkeydown={teclasPestanas}
  >
    {#each PESTANAS as p, i (p)}
      <button
        bind:this={botonesPestana[i]}
        type="button"
        role="tab"
        id={`${idBase}-tab-${p}`}
        aria-controls={`${idBase}-panel`}
        tabindex={pestana === p ? 0 : -1}
        class:on={pestana === p}
        aria-selected={pestana === p}
        onclick={() => irAPestana(p)}
      >
        {t(`inspector.tab.${p}`)}
      </button>
    {/each}
  </div>

  <div
    class="cuerpo"
    role="tabpanel"
    id={`${idBase}-panel`}
    aria-labelledby={`${idBase}-tab-${pestana}`}
  >
    {#if pestana === 'resumen'}
      <Resumen {datos} {maximos} {chispa} {base} ventana={VENTANA} {genes} {rel} onIr={irA} />
    {:else if pestana === 'sentidos'}
      <Sentidos {sesion} {bot} {vivo} {datos} {valorDe} leer={leerMemoria} />
    {:else if pestana === 'memoria'}
      <Memoria {vivo} {valorDe} direccion={direccionDe} leer={leerMemoria} />
    {:else if pestana === 'adn'}
      <Adn texto={adn} {vivo} onReleer={pedirAdn} />
    {:else if pestana === 'consola'}
      <Consola texto={textoConsola} {vivo} {historial} onComando={comando} />
    {:else}
      <ControlJugador {sesion} {vivo} />
      <DisenadorOjos {sesion} {corrida} {bot} {vivo} {datos} {nombre} />
    {/if}
  </div>
</section>

<style>
.inspector {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  min-height: 0;
  padding: 18px 20px;
  box-sizing: border-box;
  overflow-y: auto;
  background: var(--fondo);
}
.cab {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.punto {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}
.titulo {
  flex: 1;
  min-width: 0;
}
h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.sub {
  font-size: 12px;
  color: var(--gris);
  margin-top: 2px;
}
.estados {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.x {
  width: 40px;
  padding: 0;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chico {
  height: 36px;
  padding: 0 12px;
}
.btn.on {
  background: var(--activo-fondo);
  border-color: var(--activo-fondo);
  color: var(--activo-texto);
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.murio,
.aviso {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radio);
  font-size: 13px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
}
.detalle {
  margin-top: 2px;
}
.pestanas button {
  flex: 1;
  min-width: 0;
  padding: 0 4px;
}
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
</style>
