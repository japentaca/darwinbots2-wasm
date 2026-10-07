<script>
// @ts-check
// Aviso de los bloqueos con torneo (PLAN-TORNEO-EN-CURSO.md, TC4: T8): por
// qué lo de al lado no se puede usar y un botón que lleva a la franja del
// torneo (Parar, Abandonar). Solo se muestra con un torneo en curso.
import { t } from '../../../i18n/index.svelte.js';
import { AVISO_EN_CURSO, hayTorneoEnCurso, irAFranja } from './tv.svelte.js';

/** @type {{ clave?: string }} clave: otro texto (clave de i18n) en vez del de la simulación */
let { clave = AVISO_EN_CURSO } = $props();
</script>

{#if hayTorneoEnCurso()}
  <div class="aviso-torneo" role="status">
    <span>🏆 {t(clave)}</span>
    <button class="btn" type="button" title={t('observar.tv.enCurso.ir.ayuda')} onclick={irAFranja}>
      {t('observar.tv.enCurso.ir')}
    </button>
  </div>
{/if}

<style>
.aviso-torneo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border: 1px solid var(--borde);
  border-left: 3px solid #e05a4f;
  border-radius: 8px;
  background: var(--tarjeta);
  color: var(--texto);
  font-size: 13px;
}
.btn {
  height: 30px;
  padding: 0 12px;
  font-size: 13px;
}
.aviso-torneo span {
  flex: 1 1 220px;
}
</style>
