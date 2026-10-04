<script>
// @ts-check
// Filogenia de Analizar (decisión 9): árbol de especies completo en
// carriles (colapsable; con C7 suele ser plano: todas raíces) e individuos
// podados de la especie elegida (x = generación).
import { num, t } from '../../i18n/index.svelte.js';
import { colorEspecie } from './catalogo.js';
import { filasEspecies } from './especies.js';
import { arbolIndividuos, enlacesIndividuos, filasArbol, vecinoIndividuo } from './filogenia.js';
import { escalaLineal, ticksCiclos } from './grafico/escala.js';

/**
 * @type {{
 *   fuente: import('./fuente.js').FuenteAnalisis,
 *   seleccionada: string,
 *   onSeleccionar: (nombre: string) => void,
 *   irA: (pestaña: string) => void,
 * }}
 */
let { fuente, seleccionada, onSeleccionar, irA } = $props();

const uid = $props.id();
/** @type {Set<string>} */
let colapsadas = $state(new Set());
/** @type {number | null} */
let individuo = $state(null);

const CARRIL = 26;
const IZQ = 230;
let anchoArbol = $state(0);
let anchoInd = $state(0);

const vida = $derived(filasEspecies(fuente.historia, fuente.linaje));
const filas = $derived(filasArbol(fuente.linaje, vida, colapsadas));
const hayMadres = $derived(filas.some((f) => f.madre));

const arbol = $derived.by(() => {
  const w = Math.max(200, anchoArbol - IZQ);
  const h = fuente.historia;
  const fin = Math.max(
    1,
    h.ultimoCiclo,
    fuente.linaje.ciclo,
    ...filas.map((f) => f.hasta ?? f.desde),
  );
  const X = escalaLineal(0, fin, 8, w - 8);
  const alto = filas.length * CARRIL;
  const fila = new Map(filas.map((f, i) => [f.nombre, i]));
  /** @param {number} i */
  const Y = (i) => i * CARRIL + CARRIL / 2;
  let enlaces = '';
  let muertes = '';
  const barras = filas.map((f, i) => {
    const x0 = X(f.desde);
    const x1 = Math.max(x0 + 2, X(f.hasta ?? fin));
    if (f.madre && fila.has(f.madre))
      enlaces += `M${x0.toFixed(1)} ${Y(/** @type {number} */ (fila.get(f.madre)))}V${Y(i)}`;
    if (f.hasta !== null) {
      const y = Y(i);
      muertes += `M${x1 - 4} ${y - 4}L${x1 + 4} ${y + 4}M${x1 + 4} ${y - 4}L${x1 - 4} ${y + 4}`;
    }
    return {
      nombre: f.nombre,
      d: `M${x0.toFixed(1)} ${Y(i)}H${x1.toFixed(1)}`,
      color: colorEspecie(f.nombre, fuente.colores),
    };
  });
  const grid = ticksCiclos(0, fin, Math.max(2, Math.floor(w / 110)));
  return { w, alto, barras, enlaces, muertes, grid: grid.map((v) => ({ v, x: X(v) })) };
});

const ind = $derived.by(() => {
  if (!seleccionada) return null;
  const a = arbolIndividuos(fuente.linaje, seleccionada);
  if (!a.nodos.length) return { ...a, vacio: true };
  const w = Math.max(200, anchoInd);
  const filasN = Math.max(1, a.filas);
  const alto = Math.min(360, Math.max(120, filasN * 6 + 40));
  const X = escalaLineal(a.genMin, Math.max(a.genMin + 1, a.genMax), 24, w - 24);
  const Y = escalaLineal(0, Math.max(1, filasN - 1), 14, alto - 26);
  const nodos = a.nodos.map((n) => ({ ...n, cx: X(n.gen), cy: Y(n.y) }));
  const ticks = ticksCiclos(a.genMin, Math.max(a.genMin + 1, a.genMax), 6)
    .filter((g) => Number.isInteger(g))
    .map((g) => ({ g, x: X(g) }));
  return {
    ...a,
    vacio: false,
    w,
    alto,
    nodos,
    enlaces: enlacesIndividuos(a.nodos, X, Y),
    ticks,
  };
});

// Un solo punto de tabulación en el árbol de individuos: el elegido o, si
// no hay, el primer vivo (o el primer nodo); las flechas mueven el foco.
const foco = $derived.by(() => {
  if (!ind || ind.vacio) return null;
  const ns = ind.nodos;
  if (individuo !== null && ns.some((n) => n.abs === individuo)) return individuo;
  return (ns.find((n) => n.vivo) ?? ns[0])?.abs ?? null;
});

/** @param {KeyboardEvent} e @param {number} abs */
function teclaNodo(e, abs) {
  if (!ind || ind.vacio) return;
  const otro = vecinoIndividuo(ind.nodos, abs, e.key);
  if (otro === null) return;
  e.preventDefault();
  individuo = otro;
  document.getElementById(`${uid}-bot-${otro}`)?.focus();
}

const elegido = $derived(
  individuo === null ? null : (fuente.linaje.individuos.get(individuo) ?? null),
);

const selInfo = $derived.by(() => {
  const f = vida.find((x) => x.nombre === seleccionada);
  if (!f) return null;
  const reg = fuente.linaje.especies.get(seleccionada);
  const hijas = filas.filter((x) => x.madre === seleccionada).map((x) => x.nombre);
  let origen = reg?.madre
    ? t('analizar.esp.derivada', { madre: reg.madre, ciclo: num(reg.ciclo) })
    : f.aparicion !== null
      ? t('analizar.esp.fundadora', { ciclo: num(f.aparicion) })
      : '';
  if (f.extincion !== null)
    origen += ` · ${t('analizar.esp.extinguida', { ciclo: num(f.extincion) })}`;
  return { origen, hijas };
});

/** @param {string} nombre */
function alternar(nombre) {
  const s = new Set(colapsadas);
  if (s.has(nombre)) s.delete(nombre);
  else s.add(nombre);
  colapsadas = s;
}

/** @param {string} nombre */
function elegirEspecie(nombre) {
  individuo = null;
  onSeleccionar(nombre);
}
</script>

<div class="filo">
  <div class="principal">
    <section class="card bloque">
      <div class="cab">
        <h2 class="h2">{t('analizar.filo.arbol')}</h2>
        <span class="sub"
          >{t(hayMadres ? 'analizar.filo.arbolSub' : 'analizar.filo.arbolPlano')}</span
        >
      </div>
      {#if filas.length}
        <div class="arbol" bind:clientWidth={anchoArbol}>
          <div class="carriles" style:width={`${IZQ}px`}>
            {#each filas as f (f.nombre)}
              <div class="carril" style:padding-left={`${4 + f.nivel * 14}px`}>
                {#if f.hijas}
                  <button
                    type="button"
                    class="plegar"
                    aria-expanded={!f.colapsada}
                    aria-label={t(f.colapsada ? 'analizar.filo.desplegar' : 'analizar.filo.plegar', {
  especie: f.nombre,
})}
                    onclick={() => alternar(f.nombre)}
                  >
                    {f.colapsada ? '▸' : '▾'}
                  </button>
                {/if}
                <button
                  type="button"
                  class="lane"
                  class:on={f.nombre === seleccionada}
                  class:extinta={f.hasta !== null}
                  aria-pressed={f.nombre === seleccionada}
                  onclick={() => elegirEspecie(f.nombre)}
                >
                  <span class="sw" style:background={colorEspecie(f.nombre, fuente.colores)}></span>
                  <span class="txt">{f.nombre}</span>
                  {#if f.colapsada}
                    <span class="chip mini">+{f.hijas}</span>
                  {/if}
                </button>
              </div>
            {/each}
          </div>
          <svg width={arbol.w} height={arbol.alto + 20} aria-hidden="true">
            <path
              d={arbol.grid.map((g) => `M${g.x.toFixed(1)} 0V${arbol.alto}`).join('')}
              style:stroke="var(--grafico-rejilla)"
              fill="none"
            ></path>
            <path d={arbol.enlaces} stroke="#898781" stroke-width="1.5" fill="none"></path>
            {#each arbol.barras as b (b.nombre)}
              <path
                d={b.d}
                stroke={b.color}
                stroke-width="8"
                stroke-linecap="round"
                fill="none"
                opacity={b.nombre === seleccionada || !seleccionada ? 1 : 0.55}
              ></path>
            {/each}
            <path d={arbol.muertes} style:stroke="var(--texto)" stroke-width="2" fill="none"></path>
            {#each arbol.grid as g (g.v)}
              <text class="tick" x={g.x} y={arbol.alto + 14} text-anchor="middle">{num(g.v)}</text>
            {/each}
          </svg>
        </div>
      {:else}
        <p class="sub">{t('analizar.sinEspecies')}</p>
      {/if}
    </section>

    <section class="card bloque">
      <div class="cab">
        <h2 class="h2">{t('analizar.filo.individuos', { especie: seleccionada || '—' })}</h2>
        {#if ind && !ind.vacio}
          <span class="sub"
            >{t('analizar.filo.individuosSub', {
  n: num(ind.mostrados),
  total: num(ind.total),
})}{ind.nodos.some((n) => n.cortado) ? ` · ${t('analizar.filo.cortadas')}` : ''}</span
          >
        {/if}
      </div>
      <div class="ind" bind:clientWidth={anchoInd}>
        {#if !ind || ind.vacio}
          <p class="sub">
            {t(fuente.linaje.ciclo < 0 ? 'analizar.filo.sinLinaje' : 'analizar.filo.sinIndividuos')}
          </p>
        {:else}
          <svg width={ind.w} height={ind.alto} aria-hidden="true">
            <path d={ind.enlaces} stroke="#898781" stroke-width="1.2" fill="none"></path>
            {#each ind.nodos as n (n.abs)}
              {#if n.cortado}
                <text class="corte" x={n.cx - 7} y={n.cy + 3} text-anchor="end">…</text>
              {/if}
            {/each}
            {#each ind.ticks as tk (tk.g)}
              <text class="tick" x={tk.x} y={ind.alto - 6} text-anchor="middle">
                {t('analizar.filo.gen', { n: num(tk.g) })}
              </text>
            {/each}
          </svg>
          <p class="oculto" id={`${uid}-ayuda`}>{t('analizar.filo.aria')}</p>
          {#each ind.nodos as n (n.abs)}
            <button
              type="button"
              id={`${uid}-bot-${n.abs}`}
              class="nodo"
              class:vivo={n.vivo}
              class:on={individuo === n.abs}
              style:left={`${n.cx}px`}
              style:top={`${n.cy}px`}
              style:background={n.vivo ? colorEspecie(seleccionada, fuente.colores) : 'var(--texto)'}
              tabindex={foco === n.abs ? 0 : -1}
              aria-pressed={individuo === n.abs}
              aria-describedby={`${uid}-ayuda`}
              aria-label={t('analizar.filo.botNodo', {
  abs: num(n.abs),
  gen: num(n.gen),
  estado: t(n.vivo ? 'analizar.filo.vivo' : 'analizar.filo.ancestro'),
})}
              onclick={() => (individuo = n.abs)}
              onkeydown={(e) => teclaNodo(e, n.abs)}
            ></button>
          {/each}
        {/if}
      </div>
    </section>
  </div>

  <aside>
    {#if selInfo}
      <section class="card lado">
        <span class="lbl">{t('analizar.filo.especie')}</span>
        <div class="nombre">
          <span class="sw" style:background={colorEspecie(seleccionada, fuente.colores)}></span>
          <strong>{seleccionada}</strong>
        </div>
        {#if selInfo.origen}
          <div class="sub">{selInfo.origen}</div>
        {/if}
        <div class="sub">
          {selInfo.hijas.length
  ? t('analizar.filo.hijas', { lista: selInfo.hijas.join(', ') })
  : t('analizar.filo.sinHijas')}
        </div>
        <button class="btn sm" type="button" onclick={() => irA('especies')}>
          {t('analizar.filo.abrirFicha')}
        </button>
      </section>
    {/if}
    <section class="card lado">
      <span class="lbl">{t('analizar.filo.marcado')}</span>
      {#if elegido}
        <strong class="mono abs">#{num(elegido.abs)}</strong>
        <table class="tbl">
          <tbody>
            <tr>
              <td>{t('analizar.filo.generacion')}</td>
              <td class="mono">{num(elegido.gen)}</td>
            </tr>
            <tr>
              <td>{t('analizar.filo.nacido')}</td>
              <td class="mono">{num(elegido.nacido)}</td>
            </tr>
            <tr>
              <td>{t('analizar.filo.madre')}</td>
              <td class="mono">{elegido.parent ? `#${num(elegido.parent)}` : '—'}</td>
            </tr>
            <tr>
              <td>{t('analizar.filo.mutaciones')}</td>
              <td class="mono">{num(elegido.mut)}</td>
            </tr>
            <tr>
              <td>{t('analizar.filo.adn')}</td>
              <td class="mono">{num(elegido.adnLen)}</td>
            </tr>
            <tr>
              <td>{t('analizar.filo.hijos')}</td>
              <td class="mono">{num(elegido.hijos)}</td>
            </tr>
            <tr>
              <td>{t('analizar.filo.estado')}</td>
              <td>
                {t(fuente.linaje.vivos.has(elegido.abs) ? 'analizar.filo.vivo' : 'analizar.filo.ancestro')}
              </td>
            </tr>
          </tbody>
        </table>
        <button class="btn sm" type="button" onclick={() => irA('genetica')}>
          {t('analizar.filo.verAdn')}
        </button>
      {:else}
        <p class="sub">{t('analizar.filo.elegirBot')}</p>
      {/if}
    </section>
    <p class="nota">{t('analizar.filo.nota')}</p>
  </aside>
</div>

<style>
.filo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
}
.principal {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.bloque {
  padding: 14px 16px;
  min-width: 0;
}
.cab {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.arbol {
  display: flex;
  max-height: 420px;
  overflow: auto;
}
.carriles {
  flex-shrink: 0;
}
.carril {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 26px;
  box-sizing: border-box;
}
.plegar {
  font: inherit;
  font-size: 12px;
  width: 18px;
  height: 22px;
  border: 0;
  background: none;
  cursor: pointer;
  color: var(--gris);
  padding: 0;
}
.lane {
  flex: 1;
  min-width: 0;
  height: 24px;
  border: 0;
  border-radius: 4px;
  font: inherit;
  font-size: 12px;
  text-align: left;
  padding: 0 8px;
  cursor: pointer;
  color: var(--texto);
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
}
.lane:hover {
  background: var(--hover-claro);
}
.lane.on {
  background: var(--seleccion);
  font-weight: 600;
}
.txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lane.extinta .txt {
  color: var(--gris-claro);
}
.mini {
  font-size: 10px;
  padding: 0 6px;
}
svg {
  display: block;
  flex-shrink: 0;
}
.tick {
  font-family: var(--mono);
  font-size: 10px;
  fill: var(--gris-claro);
}
.ind {
  min-width: 0;
}
.corte {
  font-size: 12px;
  fill: var(--gris);
}
.ind {
  position: relative;
}
.nodo {
  position: absolute;
  width: 6px;
  height: 6px;
  margin: -3px 0 0 -3px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.nodo.vivo {
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border: 1px solid var(--tarjeta);
}
.nodo.on {
  box-shadow: 0 0 0 2px var(--texto);
}
.nodo:focus-visible {
  outline: 2px solid var(--acento);
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  margin: 0;
}
aside {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.lado {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lado .btn {
  align-self: flex-start;
}
.nombre {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}
.abs {
  font-size: 16px;
}
.nota {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--gris-claro);
}
@media (max-width: 1000px) {
  .filo {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
