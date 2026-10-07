<script>
// @ts-check
// Diseñador de ojos en la pestaña Control del inspector (paso N4.1): los 9
// .eyeNdir/.eyeNwidth del bot con foco, leídos con eye-read al abrir (o con
// «Releer») y escritos con setmem en cada cambio, como el diseñador de
// escritorio; el abanico sale del frame, así que muestra el efecto. «Escribir
// en el ADN» da el gen que fija esos ojos al nacer (copiar, descargar o, si
// el bot es propio, abrir su ADN en el editor). «Facilidades»: costos en 0 y
// browniano apagado (cambios en caliente registrados en la corrida) y
// reiniciar la puntería (memoria del bot, no reproducible). Con un torneo en
// curso solo se leen los ojos y se arma el gen: escribir los ojos y las
// facilidades cambiarían la pelea (PLAN-TORNEO-EN-CURSO.md, T8).
import { onMount } from 'svelte';
import { crearBots } from '../../../engine/bots.js';
import { t } from '../../i18n/index.svelte.js';
import { hashDe } from '../../router.js';
import { descargar } from '../observar/descargas.js';
import { hayTorneoEnCurso } from '../observar/tv/tv.svelte.js';
import { almacen } from '../sim/almacen.svelte.js';
import Abanico from './Abanico.svelte';
import {
  ACCESIBILIDAD,
  aplicarCambioVivo,
  lineasAdnOjos,
  mensajeOjo,
  N_OJOS,
  SETAIM,
  textoAdnOjos,
  textoAEntero,
} from './veterano.js';

/**
 * @type {{
 *   sesion: import('../sim/sesion.svelte.js').Sesion,
 *   corrida: import('../sim/corrida-nucleo.js').NucleoCorrida,
 *   bot: number,
 *   vivo: boolean,
 *   datos: import('./datos.js').DatosBot | null,
 *   nombre: string,
 * }}
 */
let { sesion, corrida, bot, vivo, datos, nombre } = $props();

const OJOS = Array.from({ length: N_OJOS }, (_, i) => i);

/** @type {string[]} */
let dir = $state(Array(N_OJOS).fill(''));
/** @type {string[]} */
let ancho = $state(Array(N_OJOS).fill(''));
let leido = $state(false);
let verAdn = $state(false);
/** @type {{ clave: string, params?: Record<string, any>, error?: boolean } | null} */
let nota = $state(null);
/**
 * Clave del bot propio de la especie ('p:…'; '' = no es propio): su ADN se
 * abre en el editor por la clave (el nombre podría llevar a uno del foro
 * que se llame igual).
 */
let clavePropio = $state('');
/** bot cuya lectura se espera (0 = ninguna) */
let esperando = 0;

const f1 = $derived(!!sesion.stats.f1);
const torneo = $derived(hayTorneoEnCurso());
const puede = $derived(vivo && !f1 && !torneo);
const texto = $derived(textoAdnOjos(dir, ancho));

function releer() {
  if (!vivo) return;
  esperando = bot;
  sesion.c.eyeRead(bot);
}

onMount(() =>
  sesion.c.on('eye-vals', (m) => {
    if ((m.n | 0) !== esperando || !Array.isArray(m.dir)) return;
    esperando = 0;
    dir = m.dir.map(String);
    ancho = m.wth.map(String);
    leido = true;
  }),
);

// Otro bot: se leen sus ojos (los campos no siguen al foco solos).
$effect(() => {
  bot;
  leido = false;
  verAdn = false;
  nota = null;
  dir = Array(N_OJOS).fill('');
  ancho = Array(N_OJOS).fill('');
  if (vivo) releer();
});

// ¿El bot es propio? (su ADN se puede abrir en el editor)
$effect(() => {
  const n = nombre;
  clavePropio = '';
  if (!n) return;
  crearBots({ almacen: almacen() })
    .porNombre(n)
    .then(
      (b) => {
        if (nombre === n) clavePropio = b?.hash ?? '';
      },
      () => {},
    );
});

/** @param {'dir' | 'ancho'} campo @param {number} ojo @param {string} valor */
function escribir(campo, ojo, valor) {
  if (!puede) return;
  const m = mensajeOjo(bot, campo, ojo, valor);
  // Texto que no es un entero: no se escribe nada (el campo queda marcado).
  if (m) sesion.c.setmem(m.n, m.addr, m.v);
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(texto);
    nota = { clave: 'inspector.ojos.copiado' };
    return true;
  } catch {
    nota = { clave: 'inspector.ojos.noCopiado', error: true };
    return false;
  }
}

function bajar() {
  const crlf = `${lineasAdnOjos(dir, ancho).join('\r\n')}\r\n`;
  descargar(new Blob([crlf], { type: 'text/plain' }), 'eyes.txt');
}

async function abrirEditor() {
  await copiar();
  // id del índice de la biblioteca (bots/ruta.js): 'propio:' + clave.
  window.location.hash = hashDe('bots', `propio:${clavePropio}`, 'adn');
}

/** @param {keyof typeof ACCESIBILIDAD} cual */
async function facilidad(cual) {
  if (f1 || torneo) return;
  try {
    await aplicarCambioVivo(corrida, ACCESIBILIDAD[cual]);
    nota = { clave: `inspector.ojos.hecho.${cual}` };
  } catch {
    nota = { clave: 'inspector.ojos.noAplicado', error: true };
  }
}

function reiniciarPunteria() {
  if (!puede) return;
  sesion.c.setmem(bot, SETAIM, 0);
  nota = { clave: 'inspector.ojos.hecho.punteria' };
}
</script>

<div class="card caja">
  <div class="enc">
    <span class="tit">{t('inspector.ojos.titulo')}</span>
    <button class="btn chico" type="button" disabled={!vivo} onclick={releer}>
      {t('inspector.ojos.releer')}
    </button>
  </div>
  <p class="ayuda">{t('inspector.ojos.ayuda')}</p>
  <!-- con torneo en curso ya lo explica AvisoTorneo, arriba (Inspector) -->
  {#if f1 && !torneo}
    <p class="aviso">{t('inspector.ojos.f1')}</p>
  {/if}

  {#if datos?.ojos.length}
    <Abanico {datos} />
  {/if}

  <div class="rejilla">
    <span></span>
    <span class="col">{t('inspector.sentidos.dir')}</span>
    <span class="col">{t('inspector.sentidos.ancho')}</span>
    {#each OJOS as i (i)}
      <span class="mono ojo">.eye{i + 1}</span>
      <input
        class="mono"
        type="text"
        inputmode="numeric"
        bind:value={dir[i]}
        disabled={!puede || !leido}
        aria-invalid={leido && textoAEntero(dir[i]) === null}
        aria-label={`.eye${i + 1}dir`}
        title={`.eye${i + 1}dir`}
        autocomplete="off"
        oninput={(e) => escribir('dir', i, e.currentTarget.value)}
      >
      <input
        class="mono"
        type="text"
        inputmode="numeric"
        bind:value={ancho[i]}
        disabled={!puede || !leido}
        aria-invalid={leido && textoAEntero(ancho[i]) === null}
        aria-label={`.eye${i + 1}width`}
        title={`.eye${i + 1}width`}
        autocomplete="off"
        oninput={(e) => escribir('ancho', i, e.currentTarget.value)}
      >
    {/each}
  </div>
  <p class="aviso">{t('inspector.noReproducible')}</p>

  <div class="botones">
    <button
      class="btn chico"
      class:on={verAdn}
      type="button"
      aria-expanded={verAdn}
      disabled={!leido}
      onclick={() => (verAdn = !verAdn)}
    >
      {t('inspector.ojos.escribirAdn')}
    </button>
  </div>
  {#if verAdn}
    <p class="ayuda">{t('inspector.ojos.adnAyuda')}</p>
    <textarea
      class="mono adn"
      readonly
      rows="8"
      value={texto}
      aria-label={t('inspector.ojos.adnTexto')}
      onfocus={(e) => e.currentTarget.select()}
    ></textarea>
    <div class="botones">
      <button class="btn chico" type="button" onclick={copiar}>{t('inspector.ojos.copiar')}</button>
      <button class="btn chico" type="button" onclick={bajar}>
        {t('inspector.ojos.descargar')}
      </button>
      {#if clavePropio}
        <button
          class="btn chico"
          type="button"
          title={t('inspector.ojos.abrirAyuda')}
          onclick={abrirEditor}
        >
          {t('inspector.ojos.abrir', { nombre })}
        </button>
      {/if}
    </div>
  {/if}

  <fieldset class="facil">
    <legend>{t('inspector.ojos.facilidades')}</legend>
    <div class="botones">
      <button
        class="btn chico"
        type="button"
        disabled={f1 || torneo || !sesion.hayMundo}
        title={t('inspector.ojos.sinCostos.ayuda')}
        onclick={() => facilidad('sinCostos')}
      >
        {t('inspector.ojos.sinCostos')}
      </button>
      <button
        class="btn chico"
        type="button"
        disabled={!puede}
        title={t('inspector.ojos.punteria.ayuda')}
        onclick={reiniciarPunteria}
      >
        {t('inspector.ojos.punteria')}
      </button>
      <button
        class="btn chico"
        type="button"
        disabled={f1 || torneo || !sesion.hayMundo}
        title={t('inspector.ojos.sinBrowniano.ayuda')}
        onclick={() => facilidad('sinBrowniano')}
      >
        {t('inspector.ojos.sinBrowniano')}
      </button>
    </div>
  </fieldset>
  {#if nota}
    <p class="nota" class:error={nota.error} role="status">{t(nota.clave, nota.params)}</p>
  {/if}
</div>

<style>
.caja {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.enc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.tit {
  font-weight: 600;
}
.ayuda,
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris);
}
.nota.error {
  color: var(--error-texto);
}
.aviso {
  margin: 0;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 6px;
  background: var(--aviso-fondo);
  border: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
}
.chico {
  height: 34px;
  padding: 0 12px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn.on {
  background: var(--activo-fondo);
  border-color: var(--activo-fondo);
  color: var(--activo-texto);
}
.rejilla {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  gap: 4px 8px;
  align-items: center;
  font-size: 12px;
}
.col {
  color: var(--gris-claro);
  font-weight: 500;
}
.ojo {
  color: var(--gris);
}
.rejilla input {
  min-width: 0;
  height: 30px;
  font-size: 12px;
  text-align: right;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 6px;
  color: var(--texto);
}
.rejilla input[aria-invalid="true"] {
  border-color: #c0392b;
}
.rejilla input:disabled {
  opacity: 0.6;
}
.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.adn {
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  color: var(--texto);
  padding: 6px 8px;
  resize: vertical;
}
.facil {
  margin: 0;
  padding: 8px 10px 10px;
  border: 1px solid var(--borde);
  border-radius: 8px;
}
.facil legend {
  font-size: 12px;
  color: var(--gris);
  padding: 0 4px;
}
</style>
