<script>
// @ts-check
// «Probar» (decisión 18): N copias del ADN × X ciclos sin dibujar, en la
// cola de trabajos (ejecutor 'prueba', src/lib/trabajos/prueba.js), con la
// versión anterior corrida con las mismas semillas. La tarjeta muestra la
// última prueba de este bot (sigue en la cola aunque se cierre el editor).
// Reglas: F1 (por defecto) o sin costos (bases de engine/opciones.js); la
// semilla se elige (la primera; las demás salen de ella). El aviso para
// lectores de pantalla solo cambia con el estado (no con cada % de avance).
import { t } from '../../../i18n/index.svelte.js';
import { adnBestiario } from '../../observar/bestiario.js';
import {
  ALGA,
  BASES_PRUEBA,
  crearParamsPrueba,
  LIMITES,
  POR_DEFECTO,
  TIPO_PRUEBA,
  unidadesPrueba,
} from '../../trabajos/prueba.js';
import { textoError } from '../../trabajos/textos.js';
import { estadoTrabajos, iniciarTrabajos } from '../../trabajos/trabajos.svelte.js';
import { aLf } from './borrador.js';

/**
 * @type {{clave: string, nombre: string, vegetal: boolean, texto: string,
 *   versiones: import('../../../../engine/bots.js').Version[]}}
 */
let { clave, nombre, vegetal, texto, versiones } = $props();

let copias = $state(POR_DEFECTO.copias);
let ciclos = $state(POR_DEFECTO.ciclos);
let semillas = $state(POR_DEFECTO.semillas);
let modo = $state(POR_DEFECTO.modo);
let base = $state(POR_DEFECTO.base);
let semilla = $state(POR_DEFECTO.semilla);
let error = $state('');
let lanzando = $state(false);

/** Qué se prueba y contra qué. */
const plan = $derived.by(() => {
  const ult = versiones[versiones.length - 1];
  if (!ult) return { version: null, anterior: null };
  if (texto === aLf(ult.adn))
    return { version: ult.n, anterior: versiones[versiones.length - 2] ?? null };
  return { version: null, anterior: ult };
});

/** Nombre de las reglas. @param {string | undefined} b */
const nombreBase = (b) => t(`editor.probar.base.${b ?? 'clasica'}`);

const ultima = $derived(
  estadoTrabajos.lista
    .filter((x) => x.tipo === TIPO_PRUEBA && x.params?.clave === clave)
    .sort((a, b) => b.creado.localeCompare(a.creado))[0] ?? null,
);
const progreso = $derived(
  ultima?.unidades?.length
    ? ultima.unidades.reduce((a, u) => a + (u.estado === 'hecha' ? 1 : u.progreso || 0), 0) /
        ultima.unidades.length
    : 0,
);

/** @param {number | null} n */
const etiquetaVersion = (n) =>
  n !== null ? `v${n}` : versiones.length ? t('editor.probar.cambios') : t('editor.probar.esteAdn');

async function probar() {
  error = '';
  lanzando = true;
  try {
    const adnAlga = modo === 'algas' ? await adnBestiario(ALGA) : null;
    const p = crearParamsPrueba({
      clave,
      nombre,
      vegetal,
      adn: texto,
      version: plan.version,
      anterior: plan.anterior ? { adn: plan.anterior.adn, version: plan.anterior.n } : null,
      modo,
      base,
      semilla,
      copias,
      ciclos,
      semillas,
      adnAlga,
    });
    await iniciarTrabajos().encolar({
      tipo: TIPO_PRUEBA,
      params: p,
      unidades: unidadesPrueba(p),
      titulo: t('editor.probar.tituloTrabajo', { nombre, version: etiquetaVersion(plan.version) }),
    });
  } catch (e) {
    const codigo = /** @type {any} */ (e)?.codigo;
    const s = codigo ? t(`editor.probar.error.${codigo}`) : '';
    error =
      s && s !== `editor.probar.error.${codigo}` ? s : String(/** @type {any} */ (e)?.message ?? e);
  } finally {
    lanzando = false;
  }
}

/** Aviso para lectores de pantalla: cambia solo con el estado. */
const anuncio = $derived.by(() => {
  if (!ultima) return '';
  if (ultima.estado === 'pendiente' || ultima.estado === 'corriendo')
    return t('editor.probar.anuncio.corriendo');
  if (ultima.estado === 'terminado') return t('editor.probar.anuncio.terminada');
  if (ultima.estado === 'cancelado') return t('editor.probar.cancelada');
  return textoError(t, ultima.codigo, ultima.error);
});

/** @param {number} v @param {number} [dec] */
const num = (v, dec = 1) =>
  Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: dec }) : '—';

const filas = $derived.by(() => {
  const r = ultima?.estado === 'terminado' ? ultima.resumen : null;
  if (!r?.actual) return [];
  const a = r.actual;
  const b = r.anterior;
  const c = a.copias;
  return [
    {
      m: t('editor.probar.sobreviven'),
      a: b ? `${num(b.sobreviven)}/${c}` : '',
      b: `${num(a.sobreviven)}/${c}`,
    },
    {
      m: t('editor.probar.hijos'),
      ayuda: t('editor.probar.hijosAyuda'),
      a: b ? num(b.hijosPorCopia, 2) : '',
      b: num(a.hijosPorCopia, 2),
    },
    {
      m: t('editor.probar.nacidos'),
      a: b ? num(b.nacidosPorCopia ?? b.hijosPorCopia, 2) : '',
      b: num(a.nacidosPorCopia ?? a.hijosPorCopia, 2),
    },
    { m: t('editor.probar.vivos'), a: b ? num(b.vivos) : '', b: num(a.vivos) },
    {
      m: t('editor.probar.energia'),
      a: b ? num(b.energiaMedia, 0) : '',
      b: num(a.energiaMedia, 0),
    },
    {
      m: t('editor.probar.extinciones'),
      a: b ? `${b.extinciones}/${b.n}` : '',
      b: `${a.extinciones}/${a.n}`,
    },
  ];
});
</script>

<section class="card panel" aria-label={t('editor.probar.titulo')}>
  <span class="lbl">{t('editor.probar.titulo')}</span>
  <div class="grilla">
    <label>
      {t('editor.probar.copias')}
      <input
        class="sel mono"
        type="number"
        min={LIMITES.copias[0]}
        max={LIMITES.copias[1]}
        bind:value={copias}
      >
    </label>
    <label>
      {t('editor.probar.ciclos')}
      <input
        class="sel mono"
        type="number"
        min={LIMITES.ciclos[0]}
        max={LIMITES.ciclos[1]}
        step="100"
        bind:value={ciclos}
      >
    </label>
    <label>
      {t('editor.probar.semillas')}
      <input
        class="sel mono"
        type="number"
        min={LIMITES.semillas[0]}
        max={LIMITES.semillas[1]}
        bind:value={semillas}
      >
    </label>
    <label>
      {t('editor.probar.base')}
      <select class="sel" bind:value={base}>
        {#each BASES_PRUEBA as b (b)}
          <option value={b}>{nombreBase(b)}</option>
        {/each}
      </select>
    </label>
    <label>
      {t('editor.probar.semilla')}
      <input
        class="sel mono"
        type="number"
        min={LIMITES.semilla[0]}
        max={LIMITES.semilla[1]}
        bind:value={semilla}
      >
    </label>
    <label>
      {t('editor.probar.escenario')}
      <select class="sel" bind:value={modo}>
        <option value="algas">{t('editor.probar.modo.algas')}</option>
        <option value="solo">{t('editor.probar.modo.solo')}</option>
      </select>
    </label>
  </div>
  <button type="button" class="btn pri" disabled={lanzando || !texto.trim()} onclick={probar}>
    {t('editor.probar.boton', { version: etiquetaVersion(plan.version) })}
  </button>
  <span class="help">
    {plan.anterior
  ? t('editor.probar.contra', { version: `v${plan.anterior.n}` })
  : t('editor.probar.sinAnterior')}
  </span>
  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <p class="oculto" aria-live="polite">{anuncio}</p>
  {#if ultima}
    <div class="resultado">
      <span class="help">
        {t('editor.probar.ultima', {
  base: nombreBase(ultima.params?.base),
  semillas: ultima.params?.semillas?.length ?? 0,
  ciclos: num(ultima.params?.ciclos ?? 0, 0),
})}
      </span>
      {#if ultima.estado === 'pendiente' || ultima.estado === 'corriendo'}
        <div
          class="barra"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progreso * 100)}
        >
          <div style="width: {Math.round(progreso * 100)}%"></div>
        </div>
        <div class="fila">
          <span class="help"
            >{t('editor.probar.corriendo', { p: Math.round(progreso * 100) })}</span
          >
          <button
            type="button"
            class="btn sm"
            onclick={() => iniciarTrabajos().cancelar(ultima.id)}
          >
            {t('editor.probar.cancelar')}
          </button>
        </div>
      {:else if ultima.estado === 'terminado'}
        <div class="tabla">
          <span></span>
          <span class="col"
            >{ultima.resumen?.anterior ? etiquetaVersion(ultima.resumen.versionAnterior) : ''}</span
          >
          <span class="col">{etiquetaVersion(ultima.resumen?.version ?? null)}</span>
          {#each filas as f (f.m)}
            <span title={f.ayuda}>{f.m}</span>
            <span class="mono val viejo">{f.a}</span>
            <span class="mono val">{f.b}</span>
          {/each}
        </div>
      {:else}
        <p class="error">
          {ultima.estado === 'cancelado'
  ? t('editor.probar.cancelada')
  : textoError(t, ultima.codigo, ultima.error)}
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
.panel {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.grilla {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.grilla label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--gris);
}
.resultado {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--borde);
  padding-top: 8px;
}
.tabla {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 64px;
  gap: 4px 6px;
  font-size: 13px;
}
.col {
  text-align: right;
  font-size: 11px;
  color: var(--gris-claro);
}
.val {
  text-align: right;
  font-weight: 600;
}
.viejo {
  font-weight: 400;
  color: var(--gris-claro);
}
.barra {
  height: 6px;
  background: var(--chip);
  border-radius: 3px;
  overflow: hidden;
}
.barra div {
  height: 100%;
  background: var(--acento);
}
.fila {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.error {
  margin: 0;
  color: var(--error-texto);
  font-size: 13px;
}
</style>
