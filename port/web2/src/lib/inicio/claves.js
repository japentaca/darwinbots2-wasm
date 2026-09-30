// @ts-check
// Claves de i18n que Inicio arma con plantilla (paso N1.6). Los tests
// comprueban que cada una existe en es y en.

/**
 * Etiquetas de los escenarios de fábrica con traducción
 * (`inicio.etiqueta.<clave>`). Las que no están se muestran tal cual (las
 * de un escenario propio las escribe el usuario).
 * @type {Readonly<Record<string, string>>}
 */
export const ETIQUETAS = Object.freeze({
  básico: 'basico',
  evolución: 'evolucion',
  ecología: 'ecologia',
  depredación: 'depredacion',
  competición: 'competicion',
  F1: 'f1',
  ambiente: 'ambiente',
  ciclos: 'ciclos',
  obstáculos: 'obstaculos',
  movimiento: 'movimiento',
  física: 'fisica',
  teleporters: 'teleporters',
});

/**
 * Categoría de un bot según el tablero del Bestiary (`board` de
 * bots.json) → sufijo de `inicio.categoria.<sufijo>`.
 * @type {Readonly<Record<string, string>>}
 */
export const CATEGORIAS = Object.freeze({
  'F1 bots': 'f1',
  'F2 bots': 'f2',
  'F3 bots': 'f3',
  'Short bots': 'cortos',
  'Multi-Bots': 'multibot',
  Veggies: 'vegetal',
  'Interesting behaviour bots': 'curiosos',
  'EcoSim Bots': 'ecosim',
  Mutations: 'mutaciones',
  'The Starting Gate': 'inicial',
  'Single store': 'unStore',
  'Untagged bots': 'sinEtiqueta',
  'House bots': 'casa',
});

/** Sufijos extra de `inicio.categoria.` (sin tablero). */
export const CATEGORIAS_EXTRA = Object.freeze(['propio']);

/**
 * Sufijos de los errores de `inicio.error.<sufijo>`.
 */
export const ERRORES = Object.freeze([
  'corridas',
  'escenarios',
  'bestiario',
  'iniciar',
  'sinAdn',
  'retomar',
  'archivo',
  'txtVacio',
  'sinAlga',
  'versionVieja',
]);

/**
 * Claves con plural (`<clave>.uno` y `<clave>.otros`, con {n}); la forma la
 * elige formaPlural (datos.js) con Intl.PluralRules.
 */
export const PLURALES = Object.freeze([
  'inicio.n.bots',
  'inicio.n.especies',
  'inicio.error.propiosInvalidos',
]);
