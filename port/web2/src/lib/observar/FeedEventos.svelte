<script>
// @ts-check
// Lista de eventos de la corrida, el más nuevo arriba, con su ciclo.
import { idioma, num, t } from '../../i18n/index.svelte.js';
import { textoEvento } from './eventos.js';

/** @type {{ feed: import('./eventos.js').EventoFeed[], max?: number }} */
let { feed, max = 40 } = $props();

const filas = $derived(
  feed.slice(0, max).map((ev, i) => ({
    k: `${feed.length - i}`,
    c: num(ev.ciclo),
    texto: textoEvento(ev, t, idioma(), (n) => num(n)),
  })),
);
</script>

<div class="eventos">
  <span class="lbl">{t('observar.eventos.titulo')}</span>
  {#if filas.length}
    <ol>
      {#each filas as e (e.k)}
        <li><span class="mono ciclo">{e.c}</span><span>{e.texto}</span></li>
      {/each}
    </ol>
  {:else}
    <p class="vacio">{t('observar.eventos.vacio')}</p>
  {/if}
</div>

<style>
.eventos {
  display: flex;
  flex-direction: column;
}
.lbl {
  margin-bottom: 6px;
}
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  gap: 10px;
  padding: 7px 0;
  border-top: 1px solid var(--borde);
  font-size: 13px;
  line-height: 1.4;
}
.ciclo {
  width: 58px;
  flex-shrink: 0;
  color: var(--gris-claro);
  font-size: 12px;
}
.vacio {
  margin: 0;
  padding: 7px 0;
  border-top: 1px solid var(--borde);
  font-size: 13px;
  color: var(--gris-claro);
}
</style>
