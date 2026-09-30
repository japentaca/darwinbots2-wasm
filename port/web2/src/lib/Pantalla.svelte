<script>
// @ts-check
// Cáscara común de una sección: título, descripción y contenido opcional.
import { t } from '../i18n/index.svelte.js';

/** @type {{ titulo: string, desc: string, children?: import('svelte').Snippet }} */
let { titulo, desc, children } = $props();
</script>

<section class="pantalla">
  <h1>{titulo}</h1>
  <p class="desc">{desc}</p>
  {#if children}
    {@render children()}
  {:else}
    <div class="card vacia">{t('app.pantalla.pronto')}</div>
  {/if}
</section>

<style>
.pantalla {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 32px 56px;
  max-width: 1440px;
  box-sizing: border-box;
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}
.desc {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--gris);
}
.vacia {
  padding: 24px;
  font-size: 14px;
  color: var(--gris-claro);
}
@media (max-width: 700px) {
  .pantalla {
    padding: 24px 16px;
  }
}
</style>
