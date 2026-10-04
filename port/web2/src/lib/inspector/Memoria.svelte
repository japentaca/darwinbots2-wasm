<script>
// @ts-check
// Pestaña Memoria: sysvars relevantes del bot con su dirección y su valor,
// releídos cada medio segundo (LectorMemoria, memoria.js), más consultas
// propias por nombre o dirección. Los nombres de sysvar no se traducen.
import { num, t } from '../../i18n/index.svelte.js';
import { GRUPOS_MEMORIA, normalizarConsulta } from './memoria.js';

/**
 * @type {{
 *   vivo: boolean,
 *   valorDe: (nombre: string) => number | undefined,
 *   direccion: (nombre: string) => number | undefined,
 *   leer: (nombres: readonly string[]) => void,
 * }}
 */
let { vivo, valorDe, direccion, leer } = $props();

const PERIODO = 500;

/** @type {string[]} consultas propias (sysvar o dirección) */
let consultas = $state([]);
let entrada = $state('');
let invalida = $state(false);

const todos = $derived([...consultas, ...GRUPOS_MEMORIA.flatMap((g) => g.sysvars)]);

$effect(() => {
  if (!vivo) return;
  const nombres = todos;
  leer(nombres);
  const id = setInterval(() => leer(nombres), PERIODO);
  return () => clearInterval(id);
});

/** @param {SubmitEvent} e */
function consultar(e) {
  e.preventDefault();
  const c = normalizarConsulta(entrada);
  invalida = !c;
  if (!c) return;
  if (!consultas.includes(c)) consultas = [c, ...consultas];
  entrada = '';
}

/** @param {string} n */
function quitar(n) {
  consultas = consultas.filter((c) => c !== n);
}

/** @param {string} n */
function textoDir(n) {
  const d = direccion(n);
  return d === undefined ? '' : d === 0 ? '—' : String(d);
}

/** @param {string} n */
function textoValor(n) {
  if (direccion(n) === 0) return t('inspector.memoria.noExiste');
  const v = valorDe(n);
  return v === undefined ? '—' : num(v);
}
</script>

<p class="nota">{t('inspector.memoria.ayuda')}</p>

<form class="consulta" onsubmit={consultar}>
  <input
    class="mono"
    type="text"
    bind:value={entrada}
    placeholder={t('inspector.memoria.consultar.placeholder')}
    aria-label={t('inspector.memoria.consultar')}
    aria-invalid={invalida}
    spellcheck="false"
    autocomplete="off"
  >
  <button class="btn chico" type="submit" disabled={!vivo}>
    {t('inspector.memoria.consultar')}
  </button>
</form>
{#if invalida}
  <p class="error">{t('inspector.memoria.invalida')}</p>
{/if}

{#snippet tabla(
  /** @type {string} */ titulo,
  /** @type {readonly string[]} */ nombres,
  /** @type {boolean} */ quitables,
)}
  <div class="card caja">
    <div class="enc">{titulo}</div>
    <table>
      <thead>
        <tr>
          <th>{t('inspector.memoria.sysvar')}</th>
          <th>{t('inspector.memoria.dir')}</th>
          <th>{t('inspector.memoria.valor')}</th>
          {#if quitables}
            <th></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each nombres as n (n)}
          <tr>
            <td class="mono">{n}</td>
            <td class="mono dir">{textoDir(n)}</td>
            <td class="mono">{textoValor(n)}</td>
            {#if quitables}
              <td>
                <button
                  type="button"
                  class="quitar"
                  aria-label={t('inspector.memoria.quitar', { n })}
                  title={t('inspector.memoria.quitar', { n })}
                  onclick={() => quitar(n)}
                >
                  ×
                </button>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

{#if consultas.length}
  {@render tabla(t('inspector.memoria.grupo.consultas'), consultas, true)}
{/if}
{#each GRUPOS_MEMORIA as g (g.grupo)}
  {@render tabla(t(`inspector.memoria.grupo.${g.grupo}`), g.sysvars, false)}
{/each}

<style>
.nota {
  margin: 0;
  font-size: 12px;
  color: var(--gris-claro);
}
.consulta {
  display: flex;
  gap: 8px;
}
.consulta input {
  flex: 1;
  min-width: 0;
  height: 36px;
  font-size: 13px;
  border: 1px solid var(--borde-control);
  border-radius: 6px;
  background: var(--tarjeta);
  padding: 0 10px;
  color: var(--texto);
}
.chico {
  height: 36px;
  padding: 0 12px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.error {
  margin: 0;
  font-size: 12px;
  color: var(--error-texto);
}
.caja {
  padding: 12px 14px;
}
.enc {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th {
  text-align: right;
  font-weight: 500;
  color: var(--gris-claro);
  padding: 2px 4px;
}
td {
  text-align: right;
  padding: 2px 4px;
  border-top: 1px solid var(--borde);
}
th:first-child,
td:first-child {
  text-align: left;
}
.dir {
  color: var(--gris-claro);
}
.quitar {
  border: 0;
  background: none;
  cursor: pointer;
  color: var(--gris-claro);
  font-size: 14px;
  padding: 0 4px;
}
</style>
