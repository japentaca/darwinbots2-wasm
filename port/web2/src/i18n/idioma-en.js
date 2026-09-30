// @ts-check
// Textos de la interfaz en 'en': todas las áreas (./en/*.json, decisión C9)
// en un solo chunk que index.svelte.js carga por demanda (N4.5).

/** @type {Record<string, Record<string, string>>} */
export const archivos = import.meta.glob('./en/*.json', { eager: true, import: 'default' });
