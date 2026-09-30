<script>
// @ts-check
import { t } from '../i18n/index.svelte.js';
</script>

<div class="aviso" role="status">
  <span>{t('app.aviso.construccion')}</span>
  <a href="./classic/">{t('app.aviso.enlace')}</a>
</div>

<style>
.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  padding: 10px 24px;
  background: var(--aviso-fondo);
  border-bottom: 1px solid var(--aviso-borde);
  color: var(--aviso-texto);
  font-size: 14px;
}
a {
  font-weight: 500;
}
</style>
