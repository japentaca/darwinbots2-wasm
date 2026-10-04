<script>
// @ts-check
// Sembrar una especie en la sim que corre: un bot de la biblioteca (foro
// o propio, con src/lib/bots/SelectorBot.svelte), un preset (Animal/Alga
// Minimalis) o ADN pegado; cantidad, energía, color y vegetal.
import { t } from '../../i18n/index.svelte.js';
import { adnDeEntrada } from '../bots/datos.js';
import SelectorBot from '../bots/SelectorBot.svelte';
import { colorLibre } from '../experimentar/borrador.js';
import { cssAVb } from '../mundo/color.js';
import { actual } from '../sim/corrida.svelte.js';
import { especiesPrueba } from '../sim/prueba.js';
import Dialogo from './Dialogo.svelte';
import { vbAHex } from './metricas.js';

/**
 * @type {{
 *   abierto: boolean,
 *   onSembrar: (sp: { nombre: string, adn: string, cantidad: number, color: string,
 *     vegetal: boolean, energia: number }) => void,
 * }}
 */
let { abierto = $bindable(false), onSembrar } = $props();

// Colores propios: distintos de los del escenario por defecto (Sopa
// primordial, #ff4040 y #30d030), así lo sembrado no se confunde con lo que
// ya estaba.
const [ANIMAL, ALGA] = especiesPrueba();
const PRESETS = {
  animal: { ...ANIMAL, color: cssAVb('#b04aff') },
  alga: { ...ALGA, color: cssAVb('#e0b020') },
};

/** @type {'biblioteca' | 'animal' | 'alga' | 'pegar'} */
let preset = $state('animal');
/** @type {import('../../../engine/biblioteca.js').Entrada | null} */
let elegida = $state.raw(null);
/** ADN del bot elegido de la biblioteca (vacío: todavía no, o no se pudo leer) */
let adnBib = $state('');
let leyendo = $state(false);
let falloBib = $state(false);
let nombre = $state('Animal_Minimalis');
let adn = $state('');
let cantidad = $state(5);
let energia = $state(3000);
let color = $state(vbAHex(PRESETS.animal.color));
let vegetal = $state(false);

/** @param {'biblioteca' | 'animal' | 'alga' | 'pegar'} p */
function elegir(p) {
  preset = p;
  if (p === 'pegar' || p === 'biblioteca') {
    nombre = elegida && p === 'biblioteca' ? elegida.nombre : '';
    return;
  }
  const s = PRESETS[p];
  nombre = s.name.replace(/\.txt$/i, '');
  color = vbAHex(s.color);
  vegetal = s.veg;
  cantidad = s.qty;
  energia = s.nrg;
}

/**
 * Un bot de la biblioteca: su ADN, su nombre, si es vegetal y los valores
 * de la clásica (5 bots, 15 si es vegetal; 3000 de energía) con un color
 * que no esté en la corrida.
 * @param {import('../../../engine/biblioteca.js').Entrada} e
 */
async function elegirBot(e) {
  elegida = e;
  adnBib = '';
  falloBib = false;
  leyendo = true;
  nombre = e.nombre;
  vegetal = e.vegetal;
  cantidad = e.vegetal ? 15 : 5;
  energia = 3000;
  color = colorLibre(Object.values(actual.corrida?.estado.colores ?? {}));
  try {
    const x = await adnDeEntrada(e);
    if (elegida !== e) return;
    adnBib = x ?? '';
    falloBib = !x;
  } catch {
    if (elegida === e) falloBib = true;
  } finally {
    if (elegida === e) leyendo = false;
  }
}

const adnFinal = $derived(
  preset === 'pegar' ? adn : preset === 'biblioteca' ? adnBib : PRESETS[preset].dna,
);
const valido = $derived(adnFinal.trim() !== '' && nombre.trim() !== '' && cantidad >= 1);

function sembrar() {
  if (!valido) return;
  onSembrar({
    nombre: nombre.trim(),
    adn: adnFinal,
    cantidad: Math.min(500, Math.max(1, Math.trunc(cantidad))),
    color,
    vegetal,
    energia: Math.max(1, Math.trunc(energia) || 3000),
  });
  abierto = false;
}
</script>

<Dialogo bind:abierto titulo={t('observar.sembrar.titulo')}>
  <label class="campo"
    >{t('observar.sembrar.preset')}
    <select
      class="sel"
      value={preset}
      onchange={(e) => elegir(/** @type {any} */ (e.currentTarget.value))}
    >
      <option value="biblioteca">{t('bots.selector.opcion')}</option>
      <option value="animal">{t('observar.sembrar.preset.animal')}</option>
      <option value="alga">{t('observar.sembrar.preset.alga')}</option>
      <option value="pegar">{t('observar.sembrar.preset.pegar')}</option>
    </select></label
  >
  {#if preset === 'biblioteca'}
    <SelectorBot {elegida} onElegir={elegirBot} />
    {#if leyendo}
      <p class="nota" role="status">{t('bots.cargando')}</p>
    {:else if falloBib && elegida}
      <p class="nota error" role="alert">{t('bots.lote.sinAdn', { nombre: elegida.nombre })}</p>
    {/if}
  {/if}
  <label class="campo"
    >{t('observar.sembrar.nombre')}
    <input class="txt" type="text" bind:value={nombre} maxlength="60"></label
  >
  {#if preset === 'pegar'}
    <label class="campo"
      >{t('observar.sembrar.adn')}
      <textarea class="txt mono" rows="8" bind:value={adn} spellcheck="false"></textarea></label
    >
  {/if}
  <div class="fila">
    <label class="campo"
      >{t('observar.sembrar.cantidad')}
      <input class="txt" type="number" min="1" max="500" bind:value={cantidad}></label
    >
    <label class="campo"
      >{t('observar.sembrar.energia')}
      <input class="txt" type="number" min="1" step="100" bind:value={energia}></label
    >
    <label class="campo"
      >{t('observar.sembrar.color')}
      <input class="color" type="color" bind:value={color}></label
    >
  </div>
  <label class="check"
    ><input type="checkbox" bind:checked={vegetal}>{t('observar.sembrar.vegetal')}</label
  >
  {#snippet pie()}
    <button class="btn" type="button" onclick={() => (abierto = false)}>
      {t('observar.cancelar')}
    </button>
    <button class="btn pri" type="button" disabled={!valido} onclick={sembrar}>
      {t('observar.sembrar.aceptar')}
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
.txt,
.sel {
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
