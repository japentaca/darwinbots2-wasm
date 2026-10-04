<script>
// @ts-check
// Player Bot Mode en la pestaña Control del inspector (paso N4.1, decisión
// 15): encender sobre el bot con foco y configurar las teclas (tecla,
// memoria, valor, invertida) con presets y archivos .pbkp. El estado vive en
// jugador.svelte.js (Observar muestra el indicador y pasa el puntero).
import { tick, untrack } from 'svelte';
import { t } from '../../i18n/index.svelte.js';
import { descargar } from '../observar/descargas.js';
import { jugador } from './jugador.svelte.js';
import {
  aPbkp,
  dePbkp,
  detalleMemloc,
  leerMemloc,
  leerValor,
  nombreMemloc,
  nombreTecla,
  PRESETS_PB,
  preset,
} from './veterano.js';

/**
 * @type {{
 *   sesion: import('../sim/sesion.svelte.js').Sesion,
 *   vivo: boolean,
 * }}
 */
let { sesion, vivo } = $props();

/** @typedef {{ codigo: string, memloc: string, valor: string, invertir: boolean }} Fila */

/** @param {import('./veterano.js').TeclaPb[]} teclas @returns {Fila[]} */
const aFilas = (teclas) =>
  teclas.map((k) => ({
    codigo: k.codigo,
    memloc: nombreMemloc(k.memloc),
    valor: String(k.valor),
    invertir: k.invertir,
  }));

/** @type {Fila[]} */
let filas = $state(aFilas(jugador.teclas));
/** fila que espera una tecla (−1 = ninguna) */
let capturando = $state(-1);
/** @type {{ clave: string, params?: Record<string, any>, error?: boolean } | null} */
let nota = $state(null);
/** @type {HTMLInputElement | undefined} */
let archivo = $state();
/** @type {(HTMLButtonElement | undefined)[]} botón de tecla de cada fila */
let botonesTecla = $state([]);

const f1 = $derived(!!sesion.stats.f1);
const puede = $derived(vivo && !f1 && sesion.hayMundo);

/** @param {Fila} f */
const filaValida = (f) =>
  !!f.codigo && leerMemloc(f.memloc) !== null && leerValor(f.valor) !== null;
const todasValidas = $derived(filas.every(filaValida));

// Las filas pasan al Player Bot cuando todas valen (en cada edición; al
// montar, jugador.ponerTeclas no reenvía si son las mismas).
$effect(() => {
  JSON.stringify(filas);
  untrack(aplicarFilas);
});

function aplicarFilas() {
  if (!filas.every(filaValida)) return;
  jugador.ponerTeclas(
    filas.map((f) => ({
      codigo: f.codigo,
      memloc: /** @type {number} */ (leerMemloc(f.memloc)),
      valor: /** @type {number} */ (leerValor(f.valor)),
      invertir: f.invertir,
    })),
  );
}

/** @param {string} nombre */
function ponerPreset(nombre) {
  if (!(nombre in PRESETS_PB)) return;
  filas = aFilas(preset(/** @type {import('./veterano.js').NombrePreset} */ (nombre)));
  capturando = -1;
}

async function agregar() {
  filas = [...filas, { codigo: '', memloc: '.up', valor: '40', invertir: false }];
  const i = filas.length - 1;
  // El foco pasa al botón de la fila nueva: la próxima tecla es para ella.
  await tick();
  botonesTecla[i]?.focus();
  capturando = i;
}

/** @param {number} i */
function quitar(i) {
  filas = filas.filter((_, j) => j !== i);
  if (capturando === i) capturando = -1;
}

/** @param {KeyboardEvent} e @param {number} i */
function capturar(e, i) {
  if (capturando !== i) return;
  if (e.key === 'Tab') return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') {
    capturando = -1;
    return;
  }
  filas[i].codigo = e.code;
  capturando = -1;
}

/** Aclaración de la dirección de una fila (título del número). @param {string} texto */
function tituloDireccion(texto) {
  const d = detalleMemloc(texto);
  if (d.lateral) return t(`inspector.pb.memoria.${d.lateral}`);
  return t('inspector.pb.memoria.direccion', { n: d.numero });
}

/**
 * Lo que se ve bajo el campo: el número de la dirección si se escribió un
 * sysvar y, en los laterales, hacia dónde empuja (la 3 a la derecha, la 4 a
 * la izquierda). '' = nada.
 * @param {string} texto
 */
function textoDireccion(texto) {
  const d = detalleMemloc(texto);
  const flecha = d.lateral === 'derecha' ? '→' : d.lateral === 'izquierda' ? '←' : '';
  return [d.numero, flecha].filter(Boolean).join(' ');
}

function alternar() {
  if (!jugador.alternar(sesion)) nota = { clave: 'inspector.pb.noSePuede', error: true };
  else nota = null;
}

function guardarPbkp() {
  const r = aPbkp(jugador.teclas);
  if (!r.texto) {
    nota = { clave: 'inspector.pb.nadaQueGuardar', error: true };
    return;
  }
  descargar(new Blob([r.texto], { type: 'text/plain' }), t('inspector.pb.archivo'));
  nota = r.omitidas.length
    ? {
        clave: 'inspector.pb.omitidas',
        params: { teclas: r.omitidas.map((k) => nombreTecla(k.codigo)).join(', ') },
      }
    : null;
}

/** @param {Event} e */
async function cargarPbkp(e) {
  const input = /** @type {HTMLInputElement} */ (e.currentTarget);
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  try {
    const { teclas, omitidas } = dePbkp(await f.text());
    filas = aFilas(teclas);
    capturando = -1;
    nota = omitidas.length
      ? {
          clave: 'inspector.pb.cargadoOmitidas',
          params: { n: teclas.length, m: omitidas.length, codigos: omitidas.join(', ') },
        }
      : { clave: 'inspector.pb.cargado', params: { n: teclas.length } };
  } catch {
    nota = { clave: 'inspector.pb.archivoInvalido', error: true };
  }
}
</script>

<div class="card caja">
  <div class="enc">
    <span class="tit">{t('inspector.pb.titulo')}</span>
    <button
      class="btn chico"
      class:pri={jugador.activo}
      type="button"
      aria-pressed={jugador.activo}
      disabled={!jugador.activo && !puede}
      onclick={alternar}
    >
      {jugador.activo ? t('inspector.pb.salir') : t('inspector.pb.activar')}
    </button>
  </div>
  <p class="ayuda">{t('inspector.pb.ayuda')}</p>
  {#if f1}
    <p class="aviso">{t('inspector.pb.f1')}</p>
  {/if}
  <p class="aviso">{t('inspector.noReproducible')}</p>

  <div class="fila-preset">
    <label class="campo"
      >{t('inspector.pb.preset')}
      <select
        class="sel"
        value={jugador.presetActual ?? ''}
        onchange={(e) => ponerPreset(e.currentTarget.value)}
      >
        {#if !jugador.presetActual}
          <option value="">{t('inspector.pb.preset.propio')}</option>
        {/if}
        {#each Object.keys(PRESETS_PB) as p (p)}
          <option value={p}>{t(`inspector.pb.preset.${p}`)}</option>
        {/each}
      </select></label
    >
  </div>

  <table>
    <thead>
      <tr>
        <th>{t('inspector.pb.tecla')}</th>
        <th>{t('inspector.pb.memoria')}</th>
        <th>{t('inspector.pb.valor')}</th>
        <th>{t('inspector.pb.invertida')}</th>
        <th><span class="oculto">{t('inspector.pb.quitar')}</span></th>
      </tr>
    </thead>
    <tbody>
      {#each filas as f, i (i)}
        <tr>
          <td>
            <button
              bind:this={botonesTecla[i]}
              class="btn tecla mono"
              class:esperando={capturando === i}
              type="button"
              data-captura-tecla
              aria-label={t('inspector.pb.cambiarTeclaDe', {
  tecla: f.codigo ? nombreTecla(f.codigo) : t('inspector.pb.sinTecla'),
})}
              title={t('inspector.pb.cambiarTecla')}
              onclick={() => (capturando = capturando === i ? -1 : i)}
              onkeydown={(e) => capturar(e, i)}
              onblur={() => {
  if (capturando === i) capturando = -1;
}}
            >
              {capturando === i
  ? t('inspector.pb.pulsa')
  : f.codigo
    ? nombreTecla(f.codigo)
    : t('inspector.pb.sinTecla')}
            </button>
          </td>
          <td>
            <input
              class="mono"
              type="text"
              bind:value={f.memloc}
              aria-invalid={leerMemloc(f.memloc) === null}
              aria-label={t('inspector.pb.memoria')}
              title={t('inspector.pb.memoria.ayuda')}
              spellcheck="false"
              autocomplete="off"
            >
            {#if textoDireccion(f.memloc)}
              <span class="dir mono" title={tituloDireccion(f.memloc)}>
                {textoDireccion(f.memloc)}
                <span class="oculto">{tituloDireccion(f.memloc)}</span>
              </span>
            {/if}
          </td>
          <td>
            <input
              class="mono num"
              type="text"
              inputmode="numeric"
              bind:value={f.valor}
              aria-invalid={leerValor(f.valor) === null}
              aria-label={t('inspector.pb.valor')}
              title={t('inspector.pb.valor.ayuda')}
              autocomplete="off"
            >
          </td>
          <td class="centro">
            <input
              type="checkbox"
              bind:checked={f.invertir}
              aria-label={t('inspector.pb.invertida')}
              title={t('inspector.pb.invertida.ayuda')}
            >
          </td>
          <td>
            <button
              class="btn x"
              type="button"
              aria-label={t('inspector.pb.quitar')}
              title={t('inspector.pb.quitar')}
              onclick={() => quitar(i)}
            >
              ×
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if !todasValidas}
    <p class="aviso" role="status">{t('inspector.pb.invalidas')}</p>
  {/if}

  <div class="botones">
    <button class="btn chico" type="button" onclick={agregar}>{t('inspector.pb.agregar')}</button>
    <button class="btn chico" type="button" onclick={() => archivo?.click()}>
      {t('inspector.pb.cargar')}
    </button>
    <button class="btn chico" type="button" onclick={guardarPbkp}>
      {t('inspector.pb.guardar')}
    </button>
    <input
      bind:this={archivo}
      class="oculto"
      type="file"
      accept=".pbkp,text/plain"
      tabindex="-1"
      aria-hidden="true"
      onchange={cargarPbkp}
    >
  </div>
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
.campo {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--gris);
}
.sel {
  font: inherit;
  font-size: 13px;
  height: 34px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 8px;
  color: var(--texto);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th {
  text-align: left;
  font-weight: 500;
  color: var(--gris-claro);
  padding: 2px 4px;
}
td {
  padding: 3px 4px;
  border-top: 1px solid var(--borde);
}
.centro {
  text-align: center;
}
td input[type="text"] {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  height: 30px;
  font-size: 12px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 6px;
  color: var(--texto);
}
.dir {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--gris-claro);
  white-space: nowrap;
}
td input[aria-invalid="true"] {
  border-color: #c0392b;
}
.num {
  text-align: right;
}
.tecla {
  height: 30px;
  min-width: 64px;
  padding: 0 8px;
  font-size: 12px;
  justify-content: center;
}
.tecla.esperando {
  border-color: var(--acento);
  color: var(--acento);
}
.x {
  height: 30px;
  width: 30px;
  padding: 0;
  justify-content: center;
}
.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
