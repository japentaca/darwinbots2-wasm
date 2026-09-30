// @ts-check
// Experimentar en modo básico (paso N1.5; decisiones 12, 13 y 14 de
// port/web2/PLAN.md): lógica pura del BORRADOR, sin DOM ni runes.
//
// El borrador es un escenario (formato de engine/escenarios/index.js) que la
// pantalla edita sin tocar la sim. Los ~10 controles básicos compuestos del
// catálogo (CONTROLES_BASICOS de engine/opciones.js) leen los valores
// efectivos del borrador y, al escribir, fusionan sus claves en
// `opciones.cambios` (fusionarCambios respeta las acopladas). Los cambios
// quedan mínimos: una clave que no cambia ningún valor efectivo respecto de
// la base se quita (volver un control a su valor deja el borrador limpio).
//
// «Cambiado» (sin aplicar) = algún valor efectivo del control difiere del
// escenario de referencia (el efectivo de la corrida actual o, sin corrida,
// el escenario elegido). Vivo / requiere nueva: C12 (solo tamaño del campo,
// siembra inicial y objetos requieren sim nueva).

import { diff, resolverOpciones } from '../../../engine/escenarios/index.js';
import { lgHash } from '../../../engine/league.js';
import {
  ajustesF1,
  BASES,
  CONTROLES_BASICOS,
  fusionarCambios,
  PARAMETROS,
  parametro,
  valorEfectivo,
  valoresResueltos,
} from '../../../engine/opciones.js';

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../../engine/escenarios/index.js').Especie} Especie
 * @typedef {import('../../../engine/escenarios/index.js').Diferencias} Diferencias
 * @typedef {import('../../../engine/opciones.js').ControlBasico} ControlBasico
 * @typedef {'es' | 'en'} Idioma
 * @typedef {(clave: string, params?: Record<string, string | number>) => string} Traductor
 */

/** Tope de la cantidad de una especie (el de validar()). */
export const CANTIDAD_MAX = 10000;
/** Semillas válidas: 1..SEMILLA_MAX (int32 positivo). */
export const SEMILLA_MAX = 2147483646;

/**
 * Tarjetas de la pantalla y qué controles básicos lleva cada una (cubren
 * CONTROLES_BASICOS una vez cada uno: lo comprueba el test).
 */
export const GRUPOS_BASICOS = Object.freeze([
  { id: 'mundo', controles: Object.freeze(['tamano', 'bordes', 'medio']) },
  { id: 'energia', controles: Object.freeze(['luz', 'dia-noche', 'costos']) },
  { id: 'vegetales', controles: Object.freeze(['vegetales', 'repoblacion']) },
  { id: 'vida', controles: Object.freeze(['mutaciones', 'cadaveres']) },
]);

/** @param {string} id @returns {ControlBasico | undefined} */
export const controlBasico = (id) => CONTROLES_BASICOS.find((c) => c.id === id);

/**
 * El control se aplica en vivo si todos sus parámetros lo hacen (C12).
 * @param {ControlBasico} c
 */
export const controlVivo = (c) => c.claves.every((k) => parametro(k)?.vivo === true);

/**
 * Lector de valores efectivos de un escenario.
 * @param {Escenario} e
 * @returns {(clave: string) => number}
 */
export function efectivos(e) {
  const r = resolverOpciones(e);
  return (clave) => valorEfectivo(r, clave);
}

/**
 * ¿Dos conjuntos de valores resueltos dan los mismos valores efectivos?
 * @param {Record<string, number>} a @param {Record<string, number>} b
 */
function mismosEfectivos(a, b) {
  return PARAMETROS.every((p) => Object.is(valorEfectivo(a, p.clave), valorEfectivo(b, p.clave)));
}

/**
 * Los cambios de un escenario son un conjunto: el reset los manda por id
 * (97 antes que 101, sea cual sea el orden en el .json). Para fusionarlos
 * como una secuencia sin perder un 101 que en el archivo va antes que 97,
 * se pone 97 primero.
 * @param {Record<string, number>} cambios
 * @returns {Record<string, number>}
 */
function ordenReset(cambios) {
  const k = Object.keys(cambios);
  const i97 = k.indexOf('opt:97');
  const i101 = k.indexOf('opt:101');
  if (i97 < 0 || i101 < 0 || i97 < i101) return cambios;
  const { 'opt:97': v97, ...resto } = cambios;
  return { 'opt:97': v97, ...resto };
}

/**
 * Cambios sin opt:1 (derivado: se reparte en 2 y 3) y sin claves que no
 * cambian ningún valor efectivo respecto de la base. `cambios` se lee como
 * los de un escenario (97 antes que 101, como el reset).
 * @param {string} base @param {Record<string, number>} cambios
 * @returns {Record<string, number>}
 */
export function limpiarCambios(base, cambios) {
  let out = fusionarCambios({}, ordenReset(cambios));
  for (const k of Object.keys(out)) {
    const sin = { ...out };
    delete sin[k];
    if (mismosEfectivos(valoresResueltos(base, out), valoresResueltos(base, sin))) out = sin;
  }
  return out;
}

/**
 * Borrador editable a partir de un escenario (copia; cambios limpios).
 * @param {Escenario} e
 * @returns {Escenario}
 */
export function borradorDe(e) {
  const b = structuredClone(e);
  b.opciones.cambios = limpiarCambios(b.opciones.base, b.opciones.cambios || {});
  return b;
}

/**
 * Valor del control en el escenario.
 * @param {ControlBasico} c @param {Escenario} e
 */
export const leerControl = (c, e) => c.lee(efectivos(e));

/**
 * Borrador con esos valores escritos encima (en orden, como mensajes a la
 * sim: fusionarCambios) y los cambios limpios. Las especies y los objetos
 * no cambian.
 * @param {Escenario} b @param {Record<string, number>} nuevos
 * @returns {Escenario}
 */
export function escribirCambios(b, nuevos) {
  const cambios = limpiarCambios(
    b.opciones.base,
    fusionarCambios(ordenReset(b.opciones.cambios), nuevos),
  );
  return { ...b, opciones: { ...b.opciones, cambios } };
}

/**
 * Borrador con el control puesto en `v` (el mismo objeto si el valor no
 * escribe nada, p. ej. «Personalizados» en Costos).
 * @param {Escenario} b @param {ControlBasico} c @param {any} v
 * @returns {Escenario}
 */
export function escribirControl(b, c, v) {
  const nuevos = c.escribe(v);
  if (!Object.keys(nuevos).length) return b;
  return escribirCambios(b, nuevos);
}

/**
 * «Ajustes F1» sobre el borrador, como el botón de la clásica
 * (applyF1Settings): costos, opciones de liga, campo 9237×6928 toroidal,
 * economía vegetal y mutaciones apagadas encima de lo que haya; lo demás,
 * las especies y los objetos quedan.
 * @param {Escenario} b
 * @returns {Escenario}
 */
export const conAjustesF1 = (b) => escribirCambios(b, ajustesF1());

/**
 * Borrador sobre otra base: los parámetros que esa base fija toman sus
 * valores y los cambios del borrador en parámetros que la base no fija
 * siguen (como conjunto, igual que en un escenario: un 101 propio no se
 * pierde porque la base fije 97). Especies y objetos quedan.
 * @param {Escenario} b @param {string} base
 * @returns {Escenario}
 */
export function cambiarBase(b, base) {
  const nb = BASES[base];
  if (!nb || base === b.opciones.base) return b;
  /** @type {Record<string, number>} */
  const resto = {};
  for (const [k, v] of Object.entries(b.opciones.cambios))
    if (!Object.hasOwn(nb.valores, k)) resto[k] = v;
  return { ...b, opciones: { ...b.opciones, base, cambios: limpiarCambios(base, resto) } };
}

/**
 * Opción que no escribe nada («Personalizados» en Costos, «Personalizado» en
 * Medio o en el tamaño): en el modo básico solo se muestra si ya es el valor.
 * @param {ControlBasico} c @param {string | number} v
 */
export const opcionInerte = (c, v) => Object.keys(c.escribe(v)).length === 0;

/**
 * ¿El control tiene en `b` algún valor efectivo distinto que en `ref`?
 * @param {ControlBasico} c @param {Escenario} b @param {Escenario | null} ref
 */
export function controlCambiado(c, b, ref) {
  if (!ref) return false;
  const eb = efectivos(b);
  const er = efectivos(ref);
  return c.claves.some((k) => !Object.is(eb(k), er(k)));
}

/**
 * Número de una entrada de texto para un control numérico: redondeado si es
 * entero y llevado al rango que admite el core (`min`/`max`; fuera del
 * rango habitual se acepta con aviso: fueraDeLoUsual); null si no es un
 * número.
 * @param {ControlBasico | {valor: string, min?: number, max?: number}} c @param {unknown} texto
 * @returns {number | null}
 */
export function normalizarEntrada(c, texto) {
  const s = String(texto ?? '')
    .trim()
    .replace(',', '.');
  if (s === '') return null;
  let n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (c.valor === 'int') n = Math.round(n);
  if (c.min !== undefined && n < c.min) n = c.min;
  if (c.max !== undefined && n > c.max) n = c.max;
  return n;
}

/**
 * Texto de un valor de control para mostrar (opción en el idioma, sí/no o
 * el número).
 * @param {ControlBasico} c @param {any} v @param {Idioma} idioma @param {Traductor} tr
 */
export function textoValor(c, v, idioma, tr) {
  if (c.valor === 'bool') return tr(v ? 'experimentar.valor.si' : 'experimentar.valor.no');
  if (c.opciones) {
    const o = c.opciones.find((x) => x.v === v);
    if (o) return o[idioma];
  }
  return String(v);
}

/**
 * @typedef {{id: string, nombre: string, antes: string, despues: string, vivo: boolean}} CambioControl
 * @typedef {{clave: string, nombre: string, variable: string, antes: number, despues: number,
 *   vivo: boolean}} CambioOtro
 * @typedef {{
 *   diff: Diferencias,
 *   controles: CambioControl[],
 *   otros: CambioOtro[],
 *   especies: boolean,
 *   objetos: boolean,
 *   total: number,
 *   hayVivo: boolean,
 *   requiereNueva: boolean,
 * }} Pendientes
 */

/**
 * Lo que el borrador cambia respecto de la sim actual, para la barra de
 * «cambios sin aplicar»: por control básico (con sus textos), los
 * parámetros fuera de los controles básicos y si cambian especies u
 * objetos. `diff` es el de engine/escenarios (sus `mensajes` son lo que
 * manda «Aplicar a la actual»).
 * @param {Escenario} b @param {Escenario} actual @param {Idioma} idioma @param {Traductor} tr
 * @returns {Pendientes}
 */
export function pendientes(b, actual, idioma, tr) {
  const d = diff(b, actual);
  const eb = efectivos(b);
  const ea = efectivos(actual);
  const distinto = (/** @type {string} */ k) => !Object.is(eb(k), ea(k));
  /** @type {CambioControl[]} */
  const controles = [];
  const cubiertas = new Set();
  for (const c of CONTROLES_BASICOS) {
    for (const k of c.claves) cubiertas.add(k);
    if (!c.claves.some(distinto)) continue;
    controles.push({
      id: c.id,
      nombre: c[idioma],
      antes: textoValor(c, c.lee(ea), idioma, tr),
      despues: textoValor(c, c.lee(eb), idioma, tr),
      vivo: controlVivo(c),
    });
  }
  /** @type {CambioOtro[]} */
  const otros = [];
  for (const p of PARAMETROS) {
    if (p.derivado || cubiertas.has(p.clave) || !distinto(p.clave)) continue;
    otros.push({
      clave: p.clave,
      nombre: p[idioma],
      variable: p.variable,
      antes: ea(p.clave),
      despues: eb(p.clave),
      vivo: p.vivo,
    });
  }
  const especies = d.nueva.some((x) => x.que === 'especies');
  const objetos = d.nueva.some((x) => x.que === 'objetos');
  return {
    diff: d,
    controles,
    otros,
    especies,
    objetos,
    total: controles.length + otros.length + (especies ? 1 : 0) + (objetos ? 1 : 0),
    hayVivo: d.mensajes.length > 0,
    requiereNueva: d.requiereNueva,
  };
}

/**
 * Cuántos de los cambios que muestra la barra de pendientes se aplican en
 * vivo (lo que manda «Aplicar a la actual»): el número del aviso.
 * @param {Pendientes} p
 */
export const cambiosVivos = (p) =>
  p.controles.filter((c) => c.vivo).length + p.otros.filter((o) => o.vivo).length;

/**
 * ¿El borrador tiene diferencias sin aplicar respecto de la foto (el
 * escenario efectivo de la corrida del que salió, o el escenario elegido)?
 * Es lo que cuenta como «editado»: sin diferencias, cuando empieza otra
 * corrida el borrador pasa a ser el efectivo de la nueva.
 * @param {Escenario} b @param {Escenario | null} foto
 */
export function tienePendientes(b, foto) {
  if (!foto) return true;
  const d = diff(b, foto);
  return d.vivo.length > 0 || d.nueva.length > 0;
}

// ---- Especies -----------------------------------------------------------------

/**
 * @param {Escenario} b @param {Especie[]} especies
 * @returns {Escenario}
 */
const conEspecies = (b, especies) => ({ ...b, especies });

/** @param {unknown} v */
export function normalizarCantidad(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 1;
  return Math.min(CANTIDAD_MAX, Math.max(1, n));
}

/** @param {unknown} c */
export const colorValido = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

/**
 * Borrador con la especie i cambiada (cantidad y color, lo editable en el
 * modo básico).
 * @param {Escenario} b @param {number} i @param {{cantidad?: unknown, color?: string}} cambio
 * @returns {Escenario}
 */
export function cambiarEspecie(b, i, cambio) {
  const s = b.especies[i];
  if (!s) return b;
  const n = { ...s };
  if (cambio.cantidad !== undefined) n.cantidad = normalizarCantidad(cambio.cantidad);
  if (cambio.color !== undefined && colorValido(cambio.color)) n.color = cambio.color.toLowerCase();
  return conEspecies(
    b,
    b.especies.map((x, j) => (j === i ? n : x)),
  );
}

/** @param {Escenario} b @param {number} i @returns {Escenario} */
export const quitarEspecie = (b, i) =>
  conEspecies(
    b,
    b.especies.filter((_, j) => j !== i),
  );

/**
 * Especie lista para el escenario. Con `adn` es un bot sin lugar en el
 * Bestiary (preset o ADN pegado): origen 'propio' con el ADN dentro y su
 * hash. Del Bestiary basta el nombre (el hash, si se pasa el ADN leído).
 * @param {{bot: string, cantidad: unknown, color: string, vegetal: boolean,
 *   adn?: string, adnBestiario?: string}} o
 * @returns {Especie}
 */
export function especieNueva(o) {
  /** @type {Especie} */
  const s = {
    bot: String(o.bot).trim(),
    origen: o.adn ? 'propio' : 'bestiario',
    cantidad: normalizarCantidad(o.cantidad),
    color: colorValido(o.color) ? o.color.toLowerCase() : '#808080',
    vegetal: !!o.vegetal,
    energia: 3000,
  };
  if (o.adn) {
    s.adn = o.adn;
    s.hash = lgHash(o.adn);
  } else if (o.adnBestiario) s.hash = lgHash(o.adnBestiario);
  return s;
}

/** @param {Escenario} b @param {Especie} s @returns {Escenario} */
export const agregarEspecie = (b, s) => conEspecies(b, [...b.especies, s]);

/**
 * ¿La especie difiere de la de la referencia con el mismo bot y el mismo
 * hash del ADN (no por posición: quitar una no marca a las siguientes)?
 * Sin esa especie en la referencia, es nueva: cambiada.
 * @param {Especie} s @param {Escenario | null} ref
 */
export function especieCambiada(s, ref) {
  if (!ref) return false;
  const r = ref.especies.find((x) => x.bot === s.bot && x.hash === s.hash);
  return !r || JSON.stringify(r) !== JSON.stringify(s);
}

/**
 * Chequeo mínimo de sintaxis de un ADN pegado: sin los comentarios (desde
 * `'` hasta el fin de la línea), tiene que haber al menos un gen (un
 * `cond`, `start` o `else`). El worker no tiene un mensaje de solo lint
 * (db_dna_lint corre al sembrar), así que se valida acá.
 * @param {unknown} texto
 * @returns {'' | 'vacio' | 'sin-gen'} '' si sirve
 */
export function validarAdn(texto) {
  const tokens = String(texto ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/'.*$/, ''))
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return 'vacio';
  return tokens.some((x) => x === 'cond' || x === 'start' || x === 'else') ? '' : 'sin-gen';
}

/** Colores que se proponen al agregar especies (se rotan). */
export const PALETA = Object.freeze([
  '#2a78d6',
  '#d64f2a',
  '#2aa84f',
  '#b02ad6',
  '#d6a12a',
  '#2ab5c4',
  '#d62a7e',
  '#6b6b6b',
]);

/**
 * Color para una especie nueva: el primero de la paleta que no esté en
 * `usados`; si están todos, rota por la cantidad de especies.
 * @param {string[]} usados
 */
export function colorLibre(usados) {
  const u = new Set(usados.map((c) => c.toLowerCase()));
  return PALETA.find((c) => !u.has(c)) ?? PALETA[usados.length % PALETA.length];
}

/**
 * Long BGR de VB6 → `#rrggbb`.
 * @param {number} c
 */
export function vbAHex(c) {
  const n = c | 0;
  /** @param {number} x */
  const h = (x) => x.toString(16).padStart(2, '0');
  return `#${h(n & 0xff)}${h((n >> 8) & 0xff)}${h((n >> 16) & 0xff)}`;
}

// ---- Objetos ------------------------------------------------------------------

/**
 * Resumen de los objetos del escenario (decisión 15: se editan sobre el
 * mundo; Experimentar solo los muestra).
 * @param {Escenario} e
 * @returns {{forma: number, formas: number, laberintos: string[], teleporters: number, vacio: boolean}}
 */
export function resumenObjetos(e) {
  const obs = e.objetos?.obstaculos ?? [];
  const tps = e.objetos?.teleporters ?? [];
  const r = {
    forma: obs.filter((o) => o.tipo === 'forma').length,
    formas: obs.filter((o) => o.tipo === 'formas').length,
    laberintos: obs.flatMap((o) => (o.tipo === 'laberinto' ? [o.forma] : [])),
    teleporters: tps.length,
    vacio: false,
  };
  r.vacio = obs.length === 0 && tps.length === 0;
  return r;
}

/** @param {Escenario} b @returns {Escenario} */
export const quitarObjetos = (b) => ({ ...b, objetos: { obstaculos: [], teleporters: [] } });

// ---- Plurales -----------------------------------------------------------------

/**
 * Claves con plural (`<clave>.uno` y `<clave>.otros`, con {n}); la forma la
 * elige formaPlural con Intl.PluralRules (como en src/lib/inicio).
 */
export const PLURALES = Object.freeze([
  'experimentar.mios.invalidos',
  'experimentar.cambiosBase',
  'experimentar.objetos.forma',
  'experimentar.objetos.formas',
  'experimentar.objetos.teleporters',
  'experimentar.pendientes.titulo',
  'experimentar.aviso.aplicado',
  'experimentar.aviso.aplicadoParcial',
  'experimentar.especie.bestiario.nota',
  'experimentar.avanzado.resultados',
]);

/** @type {Map<string, Intl.PluralRules>} */
const reglasPlural = new Map();

/**
 * Forma plural de `n` en el idioma: 'uno' o 'otros' (es y en solo
 * distinguen «one» de «other»).
 * @param {number} n @param {string} idioma
 * @returns {'uno' | 'otros'}
 */
export function formaPlural(n, idioma) {
  let r = reglasPlural.get(idioma);
  if (!r) {
    r = new Intl.PluralRules(idioma);
    reglasPlural.set(idioma, r);
  }
  return r.select(n) === 'one' ? 'uno' : 'otros';
}

/**
 * Clave con la forma plural de `n` (`experimentar.x` → `experimentar.x.uno`).
 * @param {string} clave @param {number} n @param {string} idioma
 */
export const clavePlural = (clave, n, idioma) => `${clave}.${formaPlural(n, idioma)}`;

// ---- Semilla ------------------------------------------------------------------

/** @param {() => number} [rnd] */
export const semillaAleatoria = (rnd = Math.random) => 1 + Math.floor(rnd() * SEMILLA_MAX);

/**
 * Semilla escrita por el usuario (entero 1..SEMILLA_MAX) o null.
 * @param {unknown} texto
 */
export function parsearSemilla(texto) {
  const s = String(texto ?? '').trim();
  if (!/^\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= SEMILLA_MAX ? n : null;
}
