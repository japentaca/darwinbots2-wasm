<script>
// @ts-check
// Indicador del Player Bot sobre el mundo (paso N4.1): visible mientras el
// modo está encendido, con a quién controla (el bot con foco y los
// resaltados, que el motor también controla: los hijos nacidos bajo control),
// la salida (botón o Esc) y el aviso de que lo que se hace así no queda en la
// corrida.
import { num, t } from '../../i18n/index.svelte.js';
import { jugador } from '../inspector/jugador.svelte.js';
import { controlados } from '../inspector/veterano.js';

/** @type {{ sesion: import('../sim/sesion.svelte.js').Sesion }} */
let { sesion } = $props();

/** refresco del texto (ms): no hace falta en cada frame */
const REFRESCO = 300;

/** @type {{ foco: number, abs: number, especie: number, resaltados: number } | null} */
let info = $state.raw(null);

$effect(() => {
  if (!jugador.activo) {
    info = null;
    return;
  }
  let t0 = -Infinity;
  const baja = sesion.c.on(
    'frame',
    (/** @type {import('../sim/conexion.js').EventoFrame} */ ev) => {
      const ahora = performance.now();
      if (ahora - t0 < REFRESCO) return;
      t0 = ahora;
      info = controlados(ev.frame);
    },
  );
  sesion.redibujar();
  return baja;
});

const nombre = $derived(info && info.especie >= 0 ? sesion.nombreEspecie(info.especie) : '');
const resaltados = $derived(info?.resaltados ?? 0);

const quien = $derived.by(() => {
  if (sesion.foco > 0) {
    const bot = nombre
      ? t('observar.pb.botNombre', { nombre, abs: info?.abs ?? 0 })
      : t('observar.pb.botSlot', { n: sesion.foco });
    return resaltados
      ? t('observar.pb.controlaMas', { bot, n: num(resaltados) })
      : t('observar.pb.controla', { bot });
  }
  return resaltados
    ? t('observar.pb.soloResaltados', { n: num(resaltados) })
    : t('observar.pb.sinBot');
});
</script>

{#if jugador.activo}
  <div class="indicador" role="status" title={t('observar.pb.noReproducible')}>
    <span class="punto" aria-hidden="true"></span>
    <span class="txt">
      <strong>{t('observar.pb.activo')}</strong>
      <!-- la cuenta cambia seguido: no se anuncia en cada cambio -->
      <span aria-live="off">{quien}</span>
      <span class="sub"
        >{sesion.foco > 0 || resaltados ? t('observar.pb.conBot') : t('observar.pb.elegir')}</span
      >
    </span>
    <button
      class="btn salir"
      type="button"
      aria-keyshortcuts="Escape"
      onclick={() => jugador.desactivar()}
    >
      {t('observar.pb.salir')}
    </button>
  </div>
{/if}

<style>
.indicador {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 32px);
  padding: 8px 10px 8px 12px;
  border-radius: 8px;
  background: rgba(21, 21, 19, 0.88);
  color: #f4f3ef;
  font-size: 13px;
  z-index: 4;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.punto {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff3b30;
  flex-shrink: 0;
}
.txt {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.sub {
  font-size: 12px;
  opacity: 0.75;
}
.salir {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
  flex-shrink: 0;
}
</style>
