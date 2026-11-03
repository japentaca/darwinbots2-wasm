// @ts-check
// Analítica (PLAN-SITIO.md S13). El script de Umami (index.html) cuenta la
// carga y los cambios por history.pushState/replaceState, pero la app navega
// cambiando location.hash y eso no lo ve: acá cada cambio de hash se avisa
// como una vista más, con la URL anterior de referente (como hace el script
// con pushState). Sin Umami (bloqueado, en local o sin red) no hace nada.

/**
 * @typedef {{ track: (datos: (p: Record<string, unknown>) => Record<string, unknown>) => unknown }} Umami
 */

let anterior = window.location.href;

function avisarVista() {
  const url = window.location.href;
  if (url === anterior) return;
  const referente = anterior;
  anterior = url;
  const umami = /** @type {{ umami?: Umami }} */ (/** @type {unknown} */ (window)).umami;
  if (!umami) return;
  const origen = window.location.origin;
  umami.track((p) => ({
    ...p,
    url,
    referrer: referente.startsWith(origen) ? referente.slice(origen.length) : referente,
  }));
}

export function iniciarAnalitica() {
  window.addEventListener('hashchange', avisarVista);
}
