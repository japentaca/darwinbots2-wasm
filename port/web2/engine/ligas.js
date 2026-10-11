// @ts-check
// Catálogo de ligas (PLAN-LIGAS.md, paso L2.1): las siete que se eligen al
// crear un torneo (F1, F2, F3, MB, SB, SS y la nueva F4). Puro: sin DOM ni
// wasm.
//
// Cada liga tiene tres capas (PLAN-LIGAS.md, tabla inicial): el mundo, que es
// su escenario de fábrica `partido-<id>` (D1); las reglas de combate, la DQ
// (opción 93), que viajan dentro de ese mismo escenario; y la admisión, que
// son los boards y los avisos de D7 y los consumen engine/admision.js y la UI.

/** @typedef {'f1'|'f2'|'f3'|'mb'|'sb'|'ss'|'f4'} IdLiga */

/**
 * @typedef {object} Liga
 * @property {IdLiga} id
 * @property {string} escenario id del escenario de fábrica de la liga
 * @property {string[] | null} boards categorías (`board` de bots.json) que
 *   admite la liga; null = cualquier bot no vegetal
 * @property {string[]} etiquetas etiquetas de nombre que también cuentan como
 *   categoría (`(F2)`, `(F3)`…); la comparación no distingue mayúsculas
 * @property {string[]} avisos acciones prohibidas que el análisis avisa (claves
 *   de CAPS, src/lib/bots/textos.js)
 * @property {{maxGenes?: number, maxStores?: number} | null} forma forma exacta
 *   del ADN: pasarse es error al inscribir
 * @property {{capMode: string, popCap: number} | null} fmt formato que el
 *   asistente propone al elegir la liga (D3); null = no propone nada
 */

/** @param {Liga} l @returns {Liga} */
const congelar = (l) =>
  Object.freeze({
    ...l,
    boards: l.boards && Object.freeze([...l.boards]),
    etiquetas: Object.freeze([...l.etiquetas]),
    avisos: Object.freeze([...l.avisos]),
    forma: l.forma && Object.freeze({ ...l.forma }),
    fmt: l.fmt && Object.freeze({ ...l.fmt }),
  });

/** Las ligas, en el orden del selector (F1 primero, F4 al final). */
export const LIGAS = Object.freeze(
  /** @type {Liga[]} */ ([
    {
      id: 'f1',
      escenario: 'partido-f1',
      boards: null,
      etiquetas: [],
      avisos: [],
      forma: null,
      fmt: null,
    },
    {
      id: 'f2',
      escenario: 'partido-f2',
      boards: ['F2 bots', 'F3 bots'],
      etiquetas: ['F2', 'F3'],
      avisos: ['come-lazo', 'virus', 'repro-sex'],
      forma: null,
      fmt: null,
    },
    {
      id: 'f3',
      escenario: 'partido-f3',
      boards: ['F3 bots'],
      etiquetas: ['F3'],
      avisos: [
        'lazos',
        'come-lazo',
        'virus',
        'dispara-info',
        'veneno',
        'toxina',
        'limo',
        'caparazon',
        'autoedita',
        'repro-sex',
      ],
      forma: null,
      fmt: null,
    },
    {
      id: 'mb',
      escenario: 'partido-mb',
      boards: ['Multi-Bots'],
      etiquetas: ['MB'],
      avisos: [],
      forma: null,
      fmt: null,
    },
    {
      id: 'sb',
      escenario: 'partido-sb',
      boards: ['Short bots', 'Single store'],
      etiquetas: ['SB', 'SS'],
      avisos: [],
      forma: { maxGenes: 6 },
      fmt: null,
    },
    {
      id: 'ss',
      escenario: 'partido-ss',
      boards: ['Single store'],
      etiquetas: ['SS'],
      avisos: [],
      forma: { maxStores: 1 },
      fmt: null,
    },
    {
      id: 'f4',
      escenario: 'partido-f4',
      boards: null,
      etiquetas: [],
      avisos: [],
      forma: null,
      fmt: { capMode: 'nrg', popCap: 100 },
    },
  ]).map(congelar),
);

/**
 * La liga con ese id, o null si no existe.
 * @param {string} id
 * @returns {Liga | null}
 */
export const ligaPorId = (id) => LIGAS.find((l) => l.id === id) ?? null;

/**
 * La liga que usa ese escenario de fábrica, o null (escenario propio o de
 * fábrica sin liga, como la sopa primordial).
 * @param {string} escenarioId
 * @returns {Liga | null}
 */
export const ligaDeEscenario = (escenarioId) =>
  LIGAS.find((l) => l.escenario === escenarioId) ?? null;

/**
 * La liga de unas reglas de temporada (D6): `rules.liga` si viene; si no,
 * se deduce del id del escenario (las reglas viejas, `partido-f1` → f1). Un
 * escenario propio, sin liga, da null.
 * @param {{liga?: string | null, escenario?: {id?: string} | null} | null | undefined} rules
 * @returns {Liga | null}
 */
export const ligaDeReglas = (rules) => {
  if (!rules) return null;
  if (rules.liga != null) return ligaPorId(rules.liga);
  const id = rules.escenario?.id;
  return id ? ligaDeEscenario(id) : null;
};
