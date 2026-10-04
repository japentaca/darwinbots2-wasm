<script>
// @ts-check
// Agregar una especie al borrador: un bot de la biblioteca (los del foro
// van por nombre, C1; los propios, con su ADN dentro), con
// src/lib/bots/SelectorBot.svelte; un preset (Animal/Alga Minimalis) o ADN
// pegado.
import { untrack } from 'svelte';
import { t } from '../../i18n/index.svelte.js';
import { adnDeEntrada } from '../bots/datos.js';
import SelectorBot from '../bots/SelectorBot.svelte';
import Dialogo from '../observar/Dialogo.svelte';
import { especiesPrueba } from '../sim/prueba.js';
import { mensajeError } from './archivo.js';
import { colorLibre, especieNueva, validarAdn, vbAHex } from './borrador.js';

/**
 * @type {{
 *   abierto: boolean,
 *   onAgregar: (s: import('../../../engine/escenarios/index.js').Especie) => void,
 *   usados?: string[],
 * }}
 */
let { abierto = $bindable(false), onAgregar, usados = [] } = $props();

const [ANIMAL, ALGA] = especiesPrueba();
const PRESETS = { animal: ANIMAL, alga: ALGA };

/** @type {'bestiario' | 'animal' | 'alga' | 'pegar'} */
let fuente = $state('bestiario');
let nombre = $state('');
let adn = $state('');
let cantidad = $state(5);
let color = $state('#2a78d6');
let vegetal = $state(false);
let ocupado = $state(false);
/** @type {{ clave: string, params?: Record<string, any> } | null} */
let error = $state.raw(null);
/** @type {import('../../../engine/biblioteca.js').Entrada | null} */
let elegida = $state.raw(null);

/** Textos de los avisos del ADN pegado (validarAdn). */
const CLAVE_ADN = {
  vacio: 'experimentar.especie.adnVacio',
  'sin-gen': 'experimentar.especie.adnSinGen',
};

/** Cada vez que se abre: el formulario vacío y un color de la paleta que no esté usado. */
function reiniciar() {
  fuente = 'bestiario';
  elegida = null;
  nombre = '';
  adn = '';
  cantidad = 5;
  vegetal = false;
  error = null;
  ocupado = false;
  color = colorLibre(usados);
}

$effect(() => {
  if (abierto) untrack(reiniciar);
});

/** @param {'bestiario' | 'animal' | 'alga' | 'pegar'} f */
function elegir(f) {
  fuente = f;
  error = null;
  if (f === 'animal' || f === 'alga') {
    const s = PRESETS[f];
    nombre = s.name.replace(/\.txt$/i, '');
    color = vbAHex(s.color);
    vegetal = s.veg;
    cantidad = s.qty;
  } else {
    nombre = f === 'bestiario' && elegida ? elegida.nombre : '';
  }
}

/**
 * Un bot de la biblioteca: su nombre y su marca de vegetal.
 * @param {import('../../../engine/biblioteca.js').Entrada} e
 */
function elegirBot(e) {
  elegida = e;
  nombre = e.nombre;
  vegetal = e.vegetal;
  error = null;
}

const valido = $derived(
  nombre.trim() !== '' &&
    cantidad >= 1 &&
    (fuente !== 'pegar' || adn.trim() !== '') &&
    (fuente !== 'bestiario' || !!elegida),
);

async function agregar() {
  if (!valido || ocupado) return;
  error = null;
  ocupado = true;
  try {
    /** @type {import('../../../engine/escenarios/index.js').Especie} */
    let s;
    if (fuente === 'bestiario') {
      const e = elegida;
      if (!e) return;
      const texto = await adnDeEntrada(e);
      if (!texto) {
        error = { clave: 'bots.lote.sinAdn', params: { nombre: e.nombre } };
        return;
      }
      // los del foro, por nombre (con el hash de su .txt); los propios, con su ADN
      s =
        e.clase === 'propio'
          ? especieNueva({ bot: e.nombre, cantidad, color, vegetal, adn: texto })
          : especieNueva({ bot: e.nombre, cantidad, color, vegetal, adnBestiario: texto });
    } else {
      if (fuente === 'pegar') {
        const mal = validarAdn(adn);
        if (mal) {
          error = { clave: CLAVE_ADN[mal] };
          return;
        }
      }
      const texto = fuente === 'pegar' ? adn : PRESETS[fuente].dna;
      s = especieNueva({ bot: nombre, cantidad, color, vegetal, adn: texto });
    }
    onAgregar(s);
    abierto = false;
  } catch (e) {
    error = mensajeError(e);
  } finally {
    ocupado = false;
  }
}
</script>

<Dialogo bind:abierto titulo={t('experimentar.especie.titulo')} ancho={520}>
  <label class="campo"
    >{t('experimentar.especie.fuente')}
    <select
      class="txt"
      value={fuente}
      onchange={(e) => elegir(/** @type {any} */ (e.currentTarget.value))}
    >
      <option value="bestiario">{t('experimentar.especie.fuente.bestiario')}</option>
      <option value="animal">{t('experimentar.especie.fuente.animal')}</option>
      <option value="alga">{t('experimentar.especie.fuente.alga')}</option>
      <option value="pegar">{t('experimentar.especie.fuente.pegar')}</option>
    </select></label
  >
  {#if fuente === 'bestiario'}
    <SelectorBot {elegida} onElegir={elegirBot} />
  {:else}
    <label class="campo"
      >{t('experimentar.especie.nombre')}
      <input class="txt" type="text" bind:value={nombre} maxlength="60"></label
    >
  {/if}
  {#if fuente === 'pegar'}
    <label class="campo"
      >{t('experimentar.especie.adn')}
      <textarea class="txt mono" rows="8" bind:value={adn} spellcheck="false"></textarea></label
    >
  {/if}
  <div class="fila">
    <label class="campo"
      >{t('experimentar.especie.cantidad')}
      <input class="txt" type="number" min="1" max="10000" bind:value={cantidad}></label
    >
    <label class="campo"
      >{t('experimentar.especie.color')}
      <input class="color" type="color" bind:value={color}></label
    >
  </div>
  <label class="check"
    ><input type="checkbox" bind:checked={vegetal}>{t('experimentar.especie.vegetal')}</label
  >
  {#if error}
    <p class="nota error" role="alert">{t(error.clave, error.params)}</p>
  {/if}
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (abierto = false)}>
      {t('experimentar.cancelar')}
    </button>
    <button class="btn pri" type="button" disabled={!valido || ocupado} onclick={agregar}>
      {t('experimentar.especie.aceptar')}
    </button>
  {/snippet}
</Dialogo>

<style>
.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--gris);
  flex: 1;
  min-width: 0;
}
.fila {
  display: flex;
  gap: 12px;
}
.txt {
  font: inherit;
  font-size: 14px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  color: var(--texto);
  padding: 8px;
  box-sizing: border-box;
  width: 100%;
}
textarea.txt {
  font-family: var(--mono);
  font-size: 12px;
  resize: vertical;
}
.color {
  height: 38px;
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
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
}
.error {
  color: var(--error-texto);
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
