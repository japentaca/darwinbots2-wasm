<script>
// @ts-check
// Siembra en lote (decisión 20): los bots elegidos → «Sembrar en la corrida
// actual» (corrida.sembrar: cada especie queda como evento de la corrida) o
// «Nuevo escenario con estos» (escenario propio en 'escenarios', que se abre
// en Experimentar). Con un solo bot se eligen además el nombre de la
// especie, el color y si es vegetal (como «To the form» de la clásica). Lo
// puro está en ./lote.js.
import { untrack } from 'svelte';
import { num, t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { textoValidacion } from '../experimentar/archivo.js';
import { colorLibre } from '../experimentar/borrador.js';
import { crearPropios } from '../experimentar/propios.js';
import Dialogo from '../observar/Dialogo.svelte';
import { almacen } from '../sim/almacen.svelte.js';
import { actual } from '../sim/corrida.svelte.js';
import { avisar, avisarError } from './biblioteca.svelte.js';
import { adnDeEntrada } from './datos.js';
import {
  CANTIDAD_AVISO,
  CANTIDAD_MAX,
  cantidadAlta,
  conCampos,
  ENERGIA_MAX,
  entradasUnicas,
  escenarioLote,
  especiesConAdn,
  especiesEscenario,
  LOTE_INICIAL,
  nombresUnicos,
  normalizarLote,
  paletaLibre,
  siembrasDe,
} from './lote.js';

/**
 * @type {{
 *   abierto: boolean,
 *   entradas: import('../../../engine/biblioteca.js').Entrada[],
 * }}
 */
let { abierto = $bindable(false), entradas } = $props();

let cantidad = $state(LOTE_INICIAL.cantidad);
let cantidadVeg = $state(LOTE_INICIAL.cantidadVeg);
let energia = $state(LOTE_INICIAL.energia);
let nombreEsc = $state('');
let ocupado = $state(false);
/** @type {string[]} */
let errores = $state([]);

// Un solo bot: los campos de la especie.
let nombreUno = $state('');
let colorUno = $state('#2a78d6');
let vegetalUno = $state(false);
let cantidadUno = $state(LOTE_INICIAL.cantidad);

const unicas = $derived(entradasUnicas(entradas));
const uno = $derived(unicas.length === 1 ? unicas[0] : null);
const hayVeg = $derived(unicas.some((e) => e.vegetal));
const hayAnimal = $derived(unicas.some((e) => !e.vegetal));
const hayMundo = $derived(!!actual.corrida?.sesion.hayMundo && !actual.corrida?.estado.ocupado);

/** Colores de las especies que ya están en la corrida abierta. */
const coloresCorrida = () => Object.values(actual.corrida?.estado.colores ?? {});

// Los valores por defecto se ponen solo al abrir (untrack): después el
// nombre del escenario se puede vaciar y no vuelve solo, y una recarga de
// la biblioteca no pisa lo que se está escribiendo.
$effect(() => {
  if (!abierto) return;
  untrack(() => {
    errores = [];
    nombreEsc =
      unicas.length === 1
        ? t('bots.lote.nombreUno', { nombre: unicas[0].nombre })
        : t('bots.lote.nombreVarios', { n: unicas.length });
    if (uno) {
      nombreUno = uno.nombre;
      vegetalUno = uno.vegetal;
      cantidadUno = uno.vegetal ? LOTE_INICIAL.cantidadVeg : LOTE_INICIAL.cantidad;
      colorUno = colorLibre(coloresCorrida());
    }
  });
});

const lote = $derived(normalizarLote({ cantidad, cantidadVeg, energia }));
const mucho = $derived(
  uno
    ? cantidadAlta(cantidadUno)
    : (hayAnimal && cantidadAlta(cantidad)) || (hayVeg && cantidadAlta(cantidadVeg)),
);

/**
 * Las especies del lote con su ADN; con un solo bot, con los campos elegidos.
 * @param {string[]} usados colores a evitar
 */
async function preparar(usados) {
  const r = await especiesConAdn(unicas, lote, adnDeEntrada, paletaLibre(usados));
  if (uno)
    r.especies = r.especies.map((x) =>
      conCampos(x, {
        nombre: nombreUno,
        color: colorUno,
        vegetal: vegetalUno,
        cantidad: cantidadUno,
        energia,
      }),
    );
  return r;
}

/**
 * Líneas del aviso: los que no tienen ADN y los renombrados por repetidos.
 * @param {string[]} sinAdn @param {Array<{de: string, a: string}>} renombrados
 */
const lineas = (sinAdn, renombrados) => [
  ...sinAdn.map((nombre) => ({ clave: 'bots.lote.sinAdn', params: { nombre } })),
  ...renombrados.map(({ de, a }) => ({ clave: 'bots.lote.renombrado', params: { de, a } })),
];

async function sembrarActual() {
  const c = actual.corrida;
  if (!c || ocupado) return;
  ocupado = true;
  try {
    const { especies, sinAdn } = await preparar(coloresCorrida());
    const { renombrados } = nombresUnicos(especies);
    for (const s of siembrasDe(especies)) await c.sembrar(s);
    avisar(
      'bots.lote.sembradas',
      { n: especies.length },
      { lineas: lineas(sinAdn, renombrados), error: especies.length === 0 },
    );
    abierto = false;
  } catch (e) {
    avisarError(e);
  } finally {
    ocupado = false;
  }
}

async function nuevoEscenario() {
  if (ocupado) return;
  ocupado = true;
  errores = [];
  try {
    const { especies, sinAdn } = await preparar([]);
    if (!especies.length) {
      errores = sinAdn.map((nombre) => t('bots.lote.sinAdn', { nombre }));
      return;
    }
    const { renombrados } = nombresUnicos(especies);
    const propios = crearPropios(almacen());
    const { escenarios } = await propios.listar();
    const r = escenarioLote(
      especiesEscenario(especies),
      { nombre: nombreEsc },
      escenarios.map((e) => e.id),
    );
    if (!r.ok) {
      errores = r.errores.map((x) => textoValidacion(x, t));
      return;
    }
    const g = await propios.guardar(r.escenario);
    avisar(
      'bots.lote.escenario',
      { nombre: nombreEsc.trim() },
      { lineas: lineas(sinAdn, renombrados) },
    );
    abierto = false;
    location.hash = hashDe('experimentar', g.id);
  } catch (e) {
    avisarError(e);
  } finally {
    ocupado = false;
  }
}
</script>

<Dialogo
  bind:abierto
  titulo={uno ? t('bots.lote.tituloUno', { nombre: uno.nombre }) : t('bots.lote.titulo', { n: unicas.length })}
  ancho={520}
>
  {#if uno}
    <div class="fila">
      <label class="campo ancho"
        >{t('bots.lote.nombreEspecie')}
        <input class="txt" type="text" maxlength="60" bind:value={nombreUno}></label
      >
      <label class="campo angosto"
        >{t('bots.lote.color')}
        <input class="color" type="color" bind:value={colorUno}></label
      >
    </div>
    <div class="fila">
      <label class="campo"
        >{t('bots.lote.cantidadUno')}
        <input class="txt" type="number" min="1" max={CANTIDAD_MAX} bind:value={cantidadUno}></label
      >
      <label class="campo"
        >{t('bots.lote.energia')}
        <input class="txt" type="number" min="1" max={ENERGIA_MAX} bind:value={energia}></label
      >
    </div>
    <label class="check"
      ><input type="checkbox" bind:checked={vegetalUno}>{t('bots.lote.vegetal')}</label
    >
  {:else}
    <ul class="nombres" aria-label={t('bots.lote.elegidos')}>
      {#each unicas as e (e.clave)}
        <li class="chip">{e.nombre}</li>
      {/each}
    </ul>
    <div class="fila">
      {#if hayAnimal}
        <label class="campo"
          >{t('bots.lote.cantidad')}
          <input class="txt" type="number" min="1" max={CANTIDAD_MAX} bind:value={cantidad}></label
        >
      {/if}
      {#if hayVeg}
        <label class="campo"
          >{t('bots.lote.cantidadVeg')}
          <input
            class="txt"
            type="number"
            min="1"
            max={CANTIDAD_MAX}
            bind:value={cantidadVeg}
          ></label
        >
      {/if}
      <label class="campo"
        >{t('bots.lote.energia')}
        <input class="txt" type="number" min="1" max={ENERGIA_MAX} bind:value={energia}></label
      >
    </div>
  {/if}
  {#if mucho}
    <p class="mucho" role="status">{t('bots.lote.mucho', { n: num(CANTIDAD_AVISO) })}</p>
  {/if}

  <section class="op">
    <h3>{t('bots.lote.actual')}</h3>
    <p class="help">
      {hayMundo ? t('bots.lote.actualAyuda') : t('bots.lote.sinCorrida')}
    </p>
    <div>
      <button
        class="btn pri"
        type="button"
        disabled={!hayMundo || ocupado || !unicas.length}
        onclick={sembrarActual}
      >
        {t('bots.lote.sembrar')}
      </button>
      {#if !hayMundo}
        <a class="enlace" href={hashDe('observar')}>{t('bots.lote.irObservar')}</a>
      {/if}
    </div>
  </section>

  <section class="op">
    <h3>{t('bots.lote.nuevo')}</h3>
    <p class="help">{t('bots.lote.nuevoAyuda')}</p>
    <label class="campo"
      >{t('bots.lote.nombreEscenario')}
      <input class="txt" type="text" maxlength="80" bind:value={nombreEsc}></label
    >
    <div>
      <button
        class="btn"
        type="button"
        disabled={ocupado || !nombreEsc.trim() || !unicas.length}
        onclick={nuevoEscenario}
      >
        {t('bots.lote.crearEscenario')}
      </button>
    </div>
    {#if errores.length}
      <ul class="errores" role="alert">
        {#each errores as e, i (i)}
          <li>{e}</li>
        {/each}
      </ul>
    {/if}
  </section>

  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (abierto = false)}>{t('bots.cerrar')}</button>
  {/snippet}
</Dialogo>

<style>
.nombres {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 96px;
  overflow: auto;
}
.fila {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--gris);
  flex: 1;
  min-width: 120px;
}
.ancho {
  flex: 3;
}
.angosto {
  flex: 0 0 auto;
  min-width: 0;
}
.txt {
  font: inherit;
  font-size: 14px;
  height: 36px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 10px;
  color: var(--texto);
  box-sizing: border-box;
  width: 100%;
}
.color {
  height: 36px;
  width: 64px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.mucho {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
}
.op {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--borde);
  padding-top: 10px;
}
h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.help {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
}
.enlace {
  margin-left: 10px;
  font-size: 13px;
}
.errores {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--error-texto, #8a2b12);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
