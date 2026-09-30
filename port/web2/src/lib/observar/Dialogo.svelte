<script>
// @ts-check
// Diálogo modal (<dialog>) con título y pie de botones.
/**
 * @type {{
 *   abierto: boolean,
 *   titulo: string,
 *   ancho?: number,
 *   children: import('svelte').Snippet,
 *   pie?: import('svelte').Snippet,
 * }}
 */
let { abierto = $bindable(false), titulo, ancho = 460, children, pie } = $props();

const uid = $props.id();
const idTitulo = `${uid}-titulo`;

/** @type {HTMLDialogElement} */
let dlg;

$effect(() => {
  if (abierto && !dlg.open) dlg.showModal();
  else if (!abierto && dlg.open) dlg.close();
});
</script>

<dialog
  bind:this={dlg}
  aria-labelledby={idTitulo}
  style:width={`min(${ancho}px, calc(100vw - 32px))`}
  onclose={() => (abierto = false)}
>
  <h2 id={idTitulo}>{titulo}</h2>
  <div class="cuerpo">{@render children()}</div>
  {#if pie}
    <div class="pie">{@render pie()}</div>
  {/if}
</dialog>

<style>
dialog {
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  background: var(--fondo);
  color: var(--texto);
  padding: 20px;
  box-sizing: border-box;
  max-height: calc(100dvh - 48px);
}
dialog::backdrop {
  background: rgba(21, 21, 19, 0.45);
}
h2 {
  margin: 0 0 14px;
  font-size: 18px;
  font-weight: 600;
}
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pie {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
</style>
