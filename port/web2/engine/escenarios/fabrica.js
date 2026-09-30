// @ts-check
// Escenarios de fábrica (decisión 12): de solo lectura, en
// engine/escenarios/fabrica/*.json. Se importan como JSON (Vite y node los
// resuelven igual) y se normalizan al cargar el módulo: si alguno no valida,
// el import falla (y el test lo muestra antes).

import archipielago from './fabrica/archipielago.json' with { type: 'json' };
import depredadorYPresa from './fabrica/depredador-y-presa.json' with { type: 'json' };
import diaYNoche from './fabrica/dia-y-noche.json' with { type: 'json' };
import laberinto from './fabrica/laberinto.json' with { type: 'json' };
import oceano from './fabrica/oceano.json' with { type: 'json' };
import partidoF1 from './fabrica/partido-f1.json' with { type: 'json' };
import sopaPrimordial from './fabrica/sopa-primordial.json' with { type: 'json' };
import { normalizar, validar } from './index.js';

/** Los JSON tal cual (para exportar o comparar). */
export const FABRICA_CRUDA = Object.freeze([
  sopaPrimordial,
  depredadorYPresa,
  partidoF1,
  diaYNoche,
  laberinto,
  oceano,
  archipielago,
]);

/** @type {ReadonlyArray<import('./index.js').Escenario>} */
export const ESCENARIOS_FABRICA = Object.freeze(
  FABRICA_CRUDA.map((x) => Object.freeze(normalizar(x))),
);

/** @param {string} id */
export const esDeFabrica = (id) => ESCENARIOS_FABRICA.some((e) => e.id === id);

/** @param {string} id */
export const escenarioFabrica = (id) => ESCENARIOS_FABRICA.find((e) => e.id === id);

/** Ids de los escenarios de fábrica (reservados: uno propio no los usa). */
export const IDS_FABRICA = Object.freeze(ESCENARIOS_FABRICA.map((e) => e.id));

/**
 * Validación de un escenario propio (importado o editado): la de
 * ./index.js más el id, que no puede ser el de uno de fábrica.
 * @param {unknown} x
 */
export const validarPropio = (x) => validar(x, { reservados: IDS_FABRICA });

/**
 * normalizar() de un escenario propio (lanza ErrorEscenario con
 * 'id-reservado' si usa el id de uno de fábrica).
 * @param {unknown} x
 */
export const normalizarPropio = (x) => normalizar(x, { reservados: IDS_FABRICA });
