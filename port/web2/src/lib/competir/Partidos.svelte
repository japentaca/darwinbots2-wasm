<script>
// @ts-check
// Partidos de la temporada (decisión 22): cada uno con su resumen y su
// semilla; ↻ lo repite y compara con lo registrado (avisa si no
// coincide); «Repetir y analizar» lo vuelve a correr con su semilla y lo
// abre en Analizar.
import { num, t } from '../../i18n/index.svelte.js';
import { notaNulo } from './textos.js';
import { filasPartidos } from './vistas.js';

/**
 * @type {{ ms: import('../../../engine/league.js').Match[], checked: Map<number, string>,
 *   ocupado: boolean, onRepetir: (id: number) => void, onAnalizar: (id: number) => void }}
 */
let { ms, checked, ocupado, onRepetir, onAnalizar } = $props();

const PAGINA = 100;
let cuantos = $state(PAGINA);
const tr = { t, num: (/** @type {number} */ n) => num(n) };
const filas = $derived(filasPartidos(ms));
</script>

<section class="card bloque">
  {#if !filas.length}
    <p class="vacio">{t('competir.partidos.vacio')}</p>
  {:else}
    <div class="scroll">
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col" class="l">#</th>
            <th scope="col" class="l">{t('competir.partidos.partido')}</th>
            <th scope="col" class="l">{t('competir.partidos.ganador')}</th>
            <th scope="col">{t('competir.partidos.ciclos')}</th>
            <th scope="col" title={t('competir.partidos.porTope.ayuda')}>
              {t('competir.partidos.porTope')}
            </th>
            <th scope="col">{t('competir.partidos.semilla')}</th>
            <th scope="col"><span class="oculto">{t('competir.partidos.acciones')}</span></th>
          </tr>
        </thead>
        <tbody>
          {#each filas.slice(0, cuantos) as m (m.id ?? `${m.season}-${m.no}`)}
            <tr>
              <td class="l mono">
                {m.no}
                {#if checked.get(/** @type {number} */ (m.id)) === 'same'}
                  <span class="ok" title={t('competir.partidos.coincide')}>✓</span>
                {:else if checked.get(/** @type {number} */ (m.id)) === 'diff'}
                  <span class="mal" title={t('competir.partidos.difiere')}>≠</span>
                {/if}
              </td>
              <td class="l">
                {#each m.fighters as n, i (i)}
                  {#if i > 0}
                    <span class="vs"> – </span>
                  {/if}
                  <span class:gano={n === m.winner}>{n}</span>
                  {#if m.wins[i]}
                    <span class="mono gris"> {m.wins[i]}</span>
                  {/if}
                {/each}
              </td>
              <td class="l fuerte">
                {#if m.winner}
                  {m.winner}
                {:else}
                  <span class="gris" title={notaNulo(m.note, tr)}
                    >{t('competir.partidos.nulo')}</span
                  >
                {/if}
              </td>
              <td>{num(m.cycles)}</td>
              <td>
                {m.rounds ? t('competir.partidos.deRondas', { n: num(m.capRounds), de: num(m.rounds) }) : ''}
              </td>
              <td class="mono">{m.seed ?? ''}</td>
              <td>
                {#if m.id !== undefined}
                  <span class="acciones">
                    <button
                      class="link"
                      type="button"
                      disabled={ocupado}
                      onclick={() => onRepetir(/** @type {number} */ (m.id))}
                    >
                      ↻ {t('competir.partidos.repetir')}
                    </button>
                    <button
                      class="link"
                      type="button"
                      disabled={ocupado}
                      onclick={() => onAnalizar(/** @type {number} */ (m.id))}
                    >
                      {t('competir.partidos.analizar')}
                    </button>
                  </span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if filas.length > cuantos}
      <button class="btn chico" type="button" onclick={() => (cuantos += PAGINA)}>
        {t('competir.partidos.mas', { n: num(filas.length - cuantos) })}
      </button>
    {/if}
    <p class="ayuda">{t('competir.partidos.ayuda')}</p>
  {/if}
</section>

<style>
.bloque {
  padding: 6px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.scroll {
  overflow: auto;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--gris-claro);
  font-weight: 600;
  text-align: right;
  padding: 8px 6px;
  border-bottom: 1px solid var(--borde);
  white-space: nowrap;
}
.tbl td {
  padding: 7px 6px;
  border-bottom: 1px solid var(--chip);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.tbl .l {
  text-align: left;
}
.fuerte,
.gano {
  font-weight: 600;
}
.gris,
.vs {
  color: var(--gris-claro);
}
.ok {
  color: var(--acento);
  font-weight: 700;
}
.mal {
  color: var(--error-texto);
  font-weight: 700;
}
.acciones {
  display: inline-flex;
  gap: 10px;
  white-space: nowrap;
}
.link {
  font: inherit;
  font-size: 13px;
  border: 0;
  background: transparent;
  color: var(--acento);
  cursor: pointer;
  padding: 0;
}
.link:disabled {
  color: var(--gris-claro);
  cursor: default;
}
.ayuda {
  font-size: 12px;
  line-height: 1.45;
  color: var(--gris);
  margin: 0;
}
.vacio {
  color: var(--gris);
  font-size: 14px;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.btn.chico {
  height: 32px;
  font-size: 13px;
  align-self: flex-start;
}
</style>
