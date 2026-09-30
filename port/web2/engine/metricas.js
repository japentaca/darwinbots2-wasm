// @ts-check
// Catálogo de las métricas de solo lectura de E2 (decisión 7 de
// port/web2/PLAN.md; exports de port/wasm/dbcore_api.cpp, ver «Notas para el
// Nivel 2» en PROGRESO.md). Sin DOM: lo usan el worker (engine/sim.js, para
// armar la muestra), la historia (engine/history.js) y la interfaz.
//
// Los nombres de columna son claves estables (se guardan con la historia);
// el texto visible sale de i18n en la interfaz. El orden de cada lista es el
// del volcado del core: el índice de la lista es la columna del export.

/** Los seis grupos de la decisión 7. */
export const GRUPOS = Object.freeze([
  'poblacion',
  'evolucion',
  'genetica',
  'comportamiento',
  'energia',
  'entorno',
]);

/**
 * db_sim_metrics: 56 floats (grupo de cada uno según la cabecera del export).
 * @type {ReadonlyArray<{clave: string, grupo: string}>}
 */
export const METRICAS = Object.freeze(
  [
    ['ciclo', 'poblacion'],
    ['bots', 'poblacion'],
    ['vivos', 'poblacion'],
    ['vegetales', 'poblacion'],
    ['noVegetales', 'poblacion'],
    ['cadaveres', 'poblacion'],
    ['especiesVivas', 'poblacion'],
    ['especiesRegistradas', 'poblacion'],
    ['maxAbsNum', 'poblacion'],
    ['multibots', 'poblacion'],
    ['genMedia', 'evolucion'],
    ['genMax', 'evolucion'],
    ['mutMedia', 'evolucion'],
    ['mutMax', 'evolucion'],
    ['adnMedia', 'evolucion'],
    ['adnMin', 'evolucion'],
    ['adnMax', 'evolucion'],
    ['genesMedia', 'evolucion'],
    ['edadMedia', 'evolucion'],
    ['edadMax', 'evolucion'],
    ['hijosMedia', 'evolucion'],
    ['nrgTotal', 'energia'],
    ['nrgMedia', 'energia'],
    ['nrgVegetales', 'energia'],
    ['nrgNoVegetales', 'energia'],
    ['bodyTotal', 'energia'],
    ['wasteTotal', 'energia'],
    ['cloroplastosTotal', 'energia'],
    ['shellTotal', 'energia'],
    ['slimeTotal', 'energia'],
    ['venomTotal', 'energia'],
    ['poisonTotal', 'energia'],
    ['nrgCadaveres', 'energia'],
    ['bodyCadaveres', 'energia'],
    ['energiaSim', 'energia'],
    ['disparosEnVuelo', 'comportamiento'],
    ['disparosCiclo', 'comportamiento'],
    ['extremosLazo', 'comportamiento'],
    ['conLazos', 'comportamiento'],
    ['paralizados', 'comportamiento'],
    ['envenenados', 'comportamiento'],
    ['conVirus', 'comportamiento'],
    ['fertilizados', 'comportamiento'],
    ['killsTotal', 'comportamiento'],
    ['campoAncho', 'entorno'],
    ['campoAlto', 'entorno'],
    ['obstaculos', 'entorno'],
    ['teleporters', 'entorno'],
    ['luz', 'entorno'],
    ['solPosicion', 'entorno'],
    ['solRango', 'entorno'],
    ['dia', 'entorno'],
    ['cloroTotal', 'entorno'],
    ['cloroTodos', 'entorno'],
    ['costX', 'entorno'],
    ['maxRobs', 'entorno'],
  ].map(([clave, grupo]) => Object.freeze({ clave, grupo })),
);
export const N_METRICAS = 56;

/** Índice de una métrica global por clave. @type {Readonly<Record<string, number>>} */
export const IM = Object.freeze(Object.fromEntries(METRICAS.map((m, i) => [m.clave, i])));

/** db_sim_species_stats: 27 floats por especie viva. */
export const CAMPOS_ESPECIE = Object.freeze([
  'indice',
  'vivos',
  'vegetales',
  'nrgTotal',
  'bodyTotal',
  'genMedia',
  'genMin',
  'genMax',
  'mutMedia',
  'mutMax',
  'adnMedia',
  'adnMin',
  'adnMax',
  'edadMedia',
  'edadMax',
  'hijosMedia',
  'genesMedia',
  'kills',
  'waste',
  'shell',
  'slime',
  'venom',
  'poison',
  'cloroplastos',
  'color',
  'registro',
  'multibots',
]);
export const N_ESPECIE = 27;
/** Índice de un campo de especie. @type {Readonly<Record<string, number>>} */
export const IE = Object.freeze(Object.fromEntries(CAMPOS_ESPECIE.map((c, i) => [c, i])));

/**
 * Columnas de especie que guarda la historia: todas menos el índice de la
 * tabla (cambia tras una carga), el color y el índice en sim.Specie (que se
 * corre al podar extintas).
 */
export const GUARDADOS_ESPECIE = Object.freeze(
  CAMPOS_ESPECIE.map((_, i) => i).filter((i) => ![0, 24, 25].includes(i)),
);

/** db_sim_behavior_take: 26 floats por especie con actividad (desde la última lectura). */
export const CAMPOS_COMPORTAMIENTO = Object.freeze([
  'indice',
  'disparosNrg',
  'disparosCedida',
  'disparosVenom',
  'disparosWaste',
  'disparosPoison',
  'disparosBody',
  'disparosVirus',
  'disparosEsperma',
  'disparosInfo',
  'disparosOtros',
  'reproducciones',
  'nacimientos',
  'fertilizaciones',
  'lazosNuevos',
  'subidasShell',
  'shellGanado',
  'subidasSlime',
  'slimeGanado',
  'subidasVenom',
  'venomGanado',
  'subidasPoison',
  'poisonGanado',
  'muertes',
  'killsSumados',
  'ticks',
]);
export const N_COMPORTAMIENTO = 26;
/** Columnas de comportamiento que guarda la historia: todas menos el índice. */
export const GUARDADOS_COMPORTAMIENTO = Object.freeze(
  CAMPOS_COMPORTAMIENTO.map((_, i) => i).slice(1),
);

/** Kinds de db_sim_histogram, en orden (kind = índice). */
export const HISTOGRAMAS = Object.freeze([
  'adn',
  'gen',
  'mut',
  'edad',
  'nrg',
  'body',
  'genes',
  'hijos',
  'kills',
]);

/** db_sim_dump_lineage: 12 int32 por bot existente. */
export const CAMPOS_LINAJE = Object.freeze([
  'abs',
  'parent',
  'especie',
  'gen',
  'mut',
  'nacido',
  'adnLen',
  'flags',
  'hijos',
  'edad',
  'genes',
  'ultMut',
]);
export const N_LINAJE = 12;
/** Bits de CAMPOS_LINAJE.flags. */
export const FLAG_LINAJE = Object.freeze({ veg: 1, cadaver: 2, fijo: 4, multibot: 8 });
/** db_sim_species_origin: 5 int32 por especie de la tabla (sin «Corpse»). */
export const N_ORIGEN = 5;
/** db_sim_species_dominant: 6 int32 por especie viva. */
export const N_DOMINANTE = 6;

/** Nombre de especie sin la extensión del archivo (la interfaz no la muestra). @param {string} n */
export const nombreEspecie = (n) => String(n ?? '').replace(/\.txt$/i, '');

/** La fila «Corpse» de la tabla de la vista no es una especie. @param {string} n */
export const esCadaver = (n) => /^corpse$/i.test(String(n ?? ''));

/**
 * Grupos pedidos, normalizados (sin repetir, solo los conocidos). Sin lista,
 * los seis.
 * @param {unknown} g
 * @returns {string[]}
 */
export function gruposValidos(g) {
  if (!Array.isArray(g)) return [...GRUPOS];
  return GRUPOS.filter((x) => g.includes(x));
}
