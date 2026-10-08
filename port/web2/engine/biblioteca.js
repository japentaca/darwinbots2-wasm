// @ts-check
// Biblioteca de bots (paso N3.1 de port/web2/PLAN.md; decisión 20), sin DOM:
// el índice unificado de los bots del foro (el Bestiary) y los propios, con
// la búsqueda, los filtros, la agrupación y el orden de la clásica
// (port/web/inventory.js: invMatches, invGroupsOf, invSorted), la siembra
// en lote (invSeed) y el historial del bot (corridas, torneos y pruebas
// cruzados por hash).
//
// Datos del foro (C1): la interfaz baja classic/bots/bots.json y
// profiles.json y los pasa ya parseados.
//
// Claves (engine/bots.js): cada entrada tiene una `clave`, la de sus marcas
// y selecciones. En un bot del foro es el hash de identidad de profiles.json
// (el de la clásica) o 'file:<archivo>' sin perfil; varios archivos del foro
// comparten ADN (571 archivos, 552 hashes) y comparten marcas (como en la
// clásica: marcar uno marca los que tienen el mismo ADN). En un propio es su
// id 'p:<16 hex>', independiente del ADN: dos propios con el mismo ADN, o un
// propio duplicado de uno del foro, son entradas distintas.
// `hash` es siempre el hash de identidad del ADN (hashAdn): en los del foro
// el de profiles.json (= clave), en los propios el de su última versión.
// Ids del índice: 'foro:<archivo>' y 'propio:<clave>'.
//
// Entrada del índice:
//   {id, clase: 'foro'|'propio', clave, hash, nombre, archivo?, foro (el
//    board del foro; null en los propios), vegetal, url?, soloLectura (los
//    del foro, decisión 18), perfil: {genes, tokens?, caps[], arch, size,
//    geneCaps[]} | null, marcas: {fav, tags[], notas}, adn? y lgs[] (solo
//    propios)}
//
// API:
//   construirIndice({bestiario, perfiles, registros}) → Entrada[]
//   todosLosTags(indice), foros(indice), cuentaCaps(indice)
//   coincide(e, filtro, seleccion?), filtrar(indice, filtro, seleccion?)
//     (seleccion = Set de claves)
//   ordenar(lista, 'nombre'|'genes'|'caps'), gruposDe(e, como), agrupar(lista, como)
//   entradasDe(indice, claves) → una entrada por clave, en el orden del índice
//   especiesLote(entradas, {cantidad?, cantidadVeg?, energia?, paleta?})
//   historialBot(almacen, entrada, {lgs?}) → {corridas, torneos, pruebas}
// Los propios no tienen perfil de capacidades (lo genera
// tools/bestiary/analyze_bots.js con el core): caps [] y arch null; genes y
// tamaño salen de su ADN (regla del core, engine/lineage.js).
//
// Grupos: {tipo, valor} en vez de rótulos (el texto lo pone la interfaz):
//   'foro'       valor = board (null = propios)     orden de aparición
//   'arquetipo'  valor = clave de profiles.archetypes (null = sin perfil)
//   'capacidad'  valor = clave de cap (null = solo las básicas, CAP_COMUNES)
//   'tag'        valor = tag (null = sin tags)
//   'tamano'     valor = 'S'|'M'|'L'|'XL' (null = sin perfil)
//   'fav'        valor = true|false
//   'origen'     valor = 'foro'|'propio'
//   'ninguno'    valor = null
// Salvo 'foro', los grupos van por cantidad (desc) y después por valor.

import { crearPaleta, hashAdn, lgHash } from './adn.js';
import { resumenPropio } from './bots.js';
import { lgIsScratch } from './league.js';

/**
 * @typedef {import('./bots.js').RegistroBot} RegistroBot
 * @typedef {import('./bots.js').BotPropio} BotPropio
 * @typedef {import('./bots.js').Marcas} Marcas
 * @typedef {{file: string, name: string, board: string, veg: boolean, url?: string}} BotForo
 * @typedef {{hash: string, genes: number, tokens: number, caps: string[], arch: string,
 *   size: string, geneCaps: string[][]}} PerfilForo
 * @typedef {{version?: number, caps: Record<string, {label: string, group: string, desc: string}>,
 *   archetypes: Record<string, string>, bots: Record<string, PerfilForo>}} Perfiles
 * @typedef {{genes: number, tokens?: number, caps: string[], arch: string | null, size: string,
 *   geneCaps: string[][]}} Perfil
 * @typedef {{id: string, clase: 'foro' | 'propio', clave: string, hash: string, nombre: string,
 *   archivo?: string,
 *   foro: string | null, vegetal: boolean, url?: string, soloLectura: boolean,
 *   perfil: Perfil | null, marcas: Marcas, adn?: string, lgs?: string[]}} Entrada
 * @typedef {{q?: string, foro?: string, arquetipo?: string, tamano?: string, tag?: string | null,
 *   fav?: boolean, soloSeleccion?: boolean, origen?: '' | 'foro' | 'propio',
 *   caps?: Record<string, 1 | -1>}} Filtro
 *   tag: '' o undefined = todos; null = sin tags; texto = ese tag.
 *   caps: cap → 1 (requerida) | -1 (excluida).
 * @typedef {'foro' | 'arquetipo' | 'capacidad' | 'tag' | 'tamano' | 'fav' | 'origen' | 'ninguno'} Agrupacion
 * @typedef {{tipo: Agrupacion, valor: string | boolean | null}} ClaveGrupo
 */

/** Capacidades que casi todos tienen: no agrupan (inventory.js CAP_COMMON). */
export const CAP_COMUNES = Object.freeze(['mueve', 'gira', 'vision', 'repro-asex']);
export const AGRUPACIONES = Object.freeze([
  'foro',
  'arquetipo',
  'capacidad',
  'tag',
  'tamano',
  'fav',
  'origen',
  'ninguno',
]);
export const ORDENES = Object.freeze(['nombre', 'genes', 'caps']);
export const TAMANOS = Object.freeze(['S', 'M', 'L', 'XL']);

/**
 * Índice unificado: primero los del foro en el orden de bots.json, después
 * los propios por nombre. `registros` = el almacén 'bots' (engine/bots.js):
 * los propios (con sus marcas) y las marcas de los del foro por clave.
 * @param {{bestiario?: BotForo[], perfiles?: Perfiles | null, registros?: RegistroBot[]}} o
 * @returns {Entrada[]}
 */
export function construirIndice(o) {
  const perfiles = o.perfiles?.bots ?? {};
  /** @type {Map<string, RegistroBot>} */
  const porClave = new Map(
    (o.registros ?? []).filter((r) => r.clase === 'foro').map((r) => [r.hash, r]),
  );
  const marcas = (/** @type {RegistroBot | undefined} */ r) => ({
    fav: !!r?.fav,
    tags: [...(r?.tags ?? [])],
    notas: r?.notas ?? '',
  });
  /** @type {Entrada[]} */
  const out = [];
  for (const b of o.bestiario ?? []) {
    const p = perfiles[b.file];
    // sin perfil, la clave de la clásica es 'file:<archivo>'
    const hash = p ? p.hash : `file:${b.file}`;
    /** @type {Entrada} */
    const e = {
      id: `foro:${b.file}`,
      clase: 'foro',
      clave: hash,
      hash,
      nombre: b.name,
      archivo: b.file,
      foro: b.board,
      vegetal: !!b.veg,
      soloLectura: true,
      perfil: p
        ? {
            genes: p.genes,
            tokens: p.tokens,
            caps: [...p.caps],
            arch: p.arch,
            size: p.size,
            geneCaps: p.geneCaps.map((g) => [...g]),
          }
        : null,
      marcas: marcas(porClave.get(hash)),
    };
    if (/^https?:\/\//.test(b.url || '')) e.url = b.url;
    out.push(e);
  }
  const propios = /** @type {BotPropio[]} */ (
    (o.registros ?? []).filter((r) => r.clase === 'propio')
  ).sort((a, b) => a.nombre.localeCompare(b.nombre) || a.hash.localeCompare(b.hash));
  for (const b of propios) {
    const r = resumenPropio(b);
    out.push({
      id: `propio:${b.hash}`,
      clase: 'propio',
      clave: b.hash,
      hash: b.versiones[b.versiones.length - 1]?.hash ?? hashAdn(b.adn),
      nombre: b.nombre,
      foro: null,
      vegetal: !!b.vegetal,
      soloLectura: false,
      perfil: { genes: r.genes, caps: [], arch: null, size: r.tamano, geneCaps: [] },
      marcas: marcas(b),
      adn: b.adn,
      lgs: r.lgs,
    });
  }
  return out;
}

/** Los tags usados, con su cantidad de bots, por nombre (allTags). @param {Entrada[]} indice */
export function todosLosTags(indice) {
  /** @type {Map<string, number>} */
  const t = new Map();
  const vistos = new Set();
  for (const e of indice) {
    if (vistos.has(e.clave)) continue;
    vistos.add(e.clave);
    for (const g of e.marcas.tags) t.set(g, (t.get(g) || 0) + 1);
  }
  return [...t.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Los boards del foro, en orden de aparición. @param {Entrada[]} indice */
export const foros = (indice) => [
  ...new Set(indice.filter((e) => e.foro !== null).map((e) => /** @type {string} */ (e.foro))),
];

/** Cuántos bots tienen cada capacidad (para los chips del filtro). @param {Entrada[]} indice */
export function cuentaCaps(indice) {
  /** @type {Record<string, number>} */
  const n = {};
  for (const e of indice) if (e.perfil) for (const c of e.perfil.caps) n[c] = (n[c] || 0) + 1;
  return n;
}

/**
 * ¿La entrada pasa el filtro? (invMatches). La búsqueda mira nombre,
 * archivo, tags y notas; todas las palabras tienen que estar.
 * @param {Entrada} e @param {Filtro} f @param {Set<string>} [seleccion] claves
 */
export function coincide(e, f, seleccion) {
  const m = e.marcas;
  if (f.foro && e.foro !== f.foro) return false;
  if (f.origen && e.clase !== f.origen) return false;
  if (f.arquetipo && (!e.perfil || e.perfil.arch !== f.arquetipo)) return false;
  if (f.tamano && (!e.perfil || e.perfil.size !== f.tamano)) return false;
  if (f.fav && !m.fav) return false;
  if (f.soloSeleccion && !seleccion?.has(e.clave)) return false;
  if (f.tag === null && m.tags.length) return false;
  if (f.tag && !m.tags.includes(f.tag)) return false;
  for (const [cap, modo] of Object.entries(f.caps ?? {})) {
    const tiene = !!e.perfil?.caps.includes(cap);
    if (modo > 0 && !tiene) return false;
    if (modo < 0 && tiene) return false;
  }
  const q = String(f.q ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (q.length) {
    const hay = `${e.nombre} ${e.archivo ?? ''} ${m.tags.join(' ')} ${m.notas}`.toLowerCase();
    if (!q.every((w) => hay.includes(w))) return false;
  }
  return true;
}

/**
 * Las entradas que pasan el filtro.
 * @param {Entrada[]} indice @param {Filtro} f @param {Set<string>} [seleccion]
 */
export const filtrar = (indice, f, seleccion) => indice.filter((e) => coincide(e, f, seleccion));

/**
 * Ordena (invSorted): 'nombre', 'genes' (más primero) o 'caps' (más
 * capacidades primero), con el nombre de desempate. Devuelve una copia.
 * @param {Entrada[]} lista @param {string} [como]
 */
export function ordenar(lista, como = 'nombre') {
  const porNombre = (/** @type {Entrada} */ a, /** @type {Entrada} */ b) =>
    a.nombre.localeCompare(b.nombre);
  const l = [...lista];
  if (como === 'genes')
    return l.sort((a, b) => (b.perfil?.genes ?? 0) - (a.perfil?.genes ?? 0) || porNombre(a, b));
  if (como === 'caps')
    return l.sort(
      (a, b) => (b.perfil?.caps.length ?? 0) - (a.perfil?.caps.length ?? 0) || porNombre(a, b),
    );
  return l.sort(porNombre);
}

/**
 * Los grupos de una entrada (invGroupsOf): puede estar en varios (tags,
 * capacidades).
 * @param {Entrada} e @param {Agrupacion} como
 * @returns {Array<string | boolean | null>}
 */
export function gruposDe(e, como) {
  switch (como) {
    case 'foro':
      return [e.foro];
    case 'arquetipo':
      return [e.perfil?.arch || null];
    case 'tamano':
      return [e.perfil ? e.perfil.size : null];
    case 'fav':
      return [e.marcas.fav];
    case 'origen':
      return [e.clase];
    case 'tag':
      return e.marcas.tags.length ? [...e.marcas.tags] : [null];
    case 'capacidad': {
      const cs = e.perfil ? e.perfil.caps.filter((c) => !CAP_COMUNES.includes(c)) : [];
      return cs.length ? cs : [null];
    }
    default:
      return [null];
  }
}

/**
 * Agrupa una lista ya filtrada y ordenada (invRenderList). 'foro' conserva
 * el orden de aparición; el resto va por cantidad y después por valor.
 * @param {Entrada[]} lista @param {Agrupacion} como
 * @returns {Array<{clave: ClaveGrupo, entradas: Entrada[]}>}
 */
export function agrupar(lista, como) {
  /** @type {Map<string | boolean | null, Entrada[]>} */
  const g = new Map();
  for (const e of lista)
    for (const v of gruposDe(e, como)) {
      let l = g.get(v);
      if (!l) {
        l = [];
        g.set(v, l);
      }
      l.push(e);
    }
  const grupos = [...g.entries()].map(([valor, entradas]) => ({
    clave: /** @type {ClaveGrupo} */ ({ tipo: como, valor }),
    entradas,
  }));
  if (como !== 'foro')
    grupos.sort(
      (a, b) =>
        b.entradas.length - a.entradas.length ||
        String(a.clave.valor).localeCompare(String(b.clave.valor)),
    );
  return grupos;
}

/**
 * Las entradas de una selección (claves), una por clave (en los del foro,
 * la primera del índice con ese ADN), en el orden del índice.
 * @param {Entrada[]} indice @param {Iterable<string>} claves
 */
export function entradasDe(indice, claves) {
  const quiero = new Set(claves);
  const vistos = new Set();
  return indice.filter((e) => {
    if (!quiero.has(e.clave) || vistos.has(e.clave)) return false;
    vistos.add(e.clave);
    return true;
  });
}

/** Paleta de la siembra que persiste entre lotes (como invHue de la clásica). */
let paletaModulo = /** @type {(() => string) | null} */ (null);

/**
 * Siembra en lote (invSeed): una especie por clave (los archivos del foro
 * con el mismo ADN, una sola; dos propios, aunque tengan el mismo ADN, dos),
 * con `cantidad` bots (los vegetales, `cantidadVeg`), `energia` y un color
 * por especie de la paleta de la clásica (engine/adn.js crearPaleta). La
 * paleta persiste entre lotes: `paleta` (o su alias `color`) es un
 * generador que el llamador conserva (crearPaleta()); sin él, una del
 * módulo que dura lo que la página, como invHue en la clásica. Salen en el
 * formato de especie de los escenarios (engine/escenarios/index.js): los
 * del foro con origen 'bestiario', por nombre (la interfaz trae su .txt);
 * los propios con origen 'propio', su ADN y su lgHash.
 * @param {Entrada[]} entradas
 * @param {{cantidad?: number, cantidadVeg?: number, energia?: number,
 *   paleta?: () => string, color?: () => string}} [o]
 */
export function especiesLote(entradas, o = {}) {
  if (!paletaModulo) paletaModulo = crearPaleta();
  const color = o.paleta ?? o.color ?? paletaModulo;
  const cant = Math.max(1, Math.trunc(o.cantidad ?? 5) || 5);
  const cantVeg = Math.max(1, Math.trunc(o.cantidadVeg ?? 15) || 15);
  const energia = o.energia && o.energia > 0 ? o.energia : 3000;
  const vistos = new Set();
  const out = [];
  for (const e of entradas) {
    if (vistos.has(e.clave)) continue;
    vistos.add(e.clave);
    /** @type {Record<string, any>} */
    const s = {
      bot: e.nombre,
      origen: e.clase === 'propio' ? 'propio' : 'bestiario',
      cantidad: e.vegetal ? cantVeg : cant,
      color: color(),
      vegetal: e.vegetal,
      energia,
    };
    if (e.clase === 'propio' && e.adn) {
      s.adn = e.adn;
      s.hash = lgHash(e.adn);
    }
    out.push(s);
  }
  return out;
}

// ---- Historial del bot -------------------------------------------------------

/**
 * @typedef {{id: string, nombre: string, fecha?: string, especies: string[]}} CorridaDelBot
 * @typedef {{id: string, nombre: string, scratch: boolean,
 *   temporadas: Array<{no: number, participante: string}>,
 *   partidos: Array<{id: number, temporada: number, no: number, gano: boolean, fecha?: string}>}} TorneoDelBot
 * @typedef {{id: string, titulo: string, estado: string, creado: string, tipo: string}} PruebaDelBot
 */

/**
 * Corridas, torneos y pruebas donde participó un bot (decisión 20), con sus
 * ids para enlazarlos. Se cruza:
 *   - por lgHash (el hash de los escenarios y torneos, engine/adn.js): los
 *     de todas las versiones de un propio (`entrada.lgs`) más `o.lgs` (para
 *     uno del foro, la interfaz pasa el lgHash de su .txt);
 *   - por nombre y origen, en las especies de escenario sin ADN ni hash
 *     (las del foro se guardan por nombre), en las de origen 'bestiario'
 *     cuyo hash no coincide (el .txt cambió desde entonces) y en las
 *     siembras en caliente;
 *   - por archivo, en los participantes de torneo del foro
 *     (src 'bestiary', file).
 * Corridas: almacén 'corridas' (engine/corridas.js: escenario.especies y
 * eventos 'siembra'). Torneos: 'torneos' (temporadas → participantes con el
 * ADN congelado) y 'partidos' (por índice 'league'; el participante va por
 * nombre en fighters). Pruebas: trabajos de tipo 'prueba' (y 'evolucion') de la cola
 * (engine/cola.js) cuyo params trae la clave del bot (`clave`, o `hash`
 * como en N3.1), lg o adn.
 * @param {import('./almacen.js').OperacionesAlmacen} almacen
 * @param {{clase: 'foro' | 'propio', clave: string, nombre: string, archivo?: string,
 *   lgs?: string[]}} entrada
 * @param {{lgs?: string[]}} [o]
 * @returns {Promise<{corridas: CorridaDelBot[], torneos: TorneoDelBot[], pruebas: PruebaDelBot[]}>}
 */
export async function historialBot(almacen, entrada, o = {}) {
  const lgs = new Set([...(entrada.lgs ?? []), ...(o.lgs ?? [])]);
  const origen = entrada.clase === 'propio' ? 'propio' : 'bestiario';

  /** @param {any} s especie de escenario */
  const esEspecie = (s) => {
    if (!s) return false;
    const de = s.origen || 'bestiario';
    const lg = typeof s.adn === 'string' && s.adn ? lgHash(s.adn) : s.hash;
    if (lg) {
      if (lgs.has(lg)) return true;
      // uno del foro cuyo .txt cambió (o sin lgs): cae al cruce por nombre
      if (de !== 'bestiario') return false;
    }
    return de === origen && s.bot === entrada.nombre;
  };
  /** @param {any} s especie de una siembra en caliente */
  const esSiembra = (s) =>
    !!s &&
    ((typeof s.adn === 'string' && lgs.has(lgHash(s.adn))) ||
      (origen === 'bestiario' && s.nombre === entrada.nombre));

  /** @type {CorridaDelBot[]} */
  const corridas = [];
  for (const c of await almacen.list('corridas')) {
    /** @type {Set<string>} */
    const nombres = new Set();
    for (const s of c.escenario?.especies ?? []) if (esEspecie(s)) nombres.add(s.bot);
    for (const ev of c.eventos ?? [])
      if (ev?.tipo === 'siembra' && esSiembra(ev.especie)) nombres.add(ev.especie.nombre);
    if (nombres.size)
      corridas.push({ id: c.id, nombre: c.nombre, fecha: c.fecha, especies: [...nombres] });
  }
  corridas.sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));

  /** @param {any} e participante */
  const esParticipante = (e) =>
    !!e &&
    (lgs.has(e.hash) ||
      (typeof e.dna === 'string' && lgs.has(lgHash(e.dna))) ||
      (origen === 'bestiario' &&
        e.src === 'bestiary' &&
        !!entrada.archivo &&
        e.file === entrada.archivo));

  /** @type {TorneoDelBot[]} */
  const torneos = [];
  for (const L of await almacen.list('torneos')) {
    const temporadas = [];
    for (const S of L.seasons ?? []) {
      const e = (S.entrants ?? []).find(esParticipante);
      if (e) temporadas.push({ no: S.no, participante: e.name });
    }
    if (!temporadas.length) continue;
    const partidos = [];
    const porTemporada = new Map(temporadas.map((t) => [t.no, t.participante]));
    for (const m of await almacen.porIndice('partidos', 'league', L.id)) {
      const nombre = porTemporada.get(m.season);
      if (nombre === undefined || !(m.fighters ?? []).includes(nombre)) continue;
      /** @type {TorneoDelBot['partidos'][number]} */
      const p = { id: m.id, temporada: m.season, no: m.no, gano: m.winner === nombre };
      if (m.date) p.fecha = m.date;
      partidos.push(p);
    }
    partidos.sort((a, b) => a.temporada - b.temporada || a.no - b.no);
    torneos.push({ id: L.id, nombre: L.name, scratch: lgIsScratch(L), temporadas, partidos });
  }

  /** @type {PruebaDelBot[]} */
  const pruebas = [];
  for (const t of await almacen.list('trabajos')) {
    // 'evolucion' (PLAN-EDITOR E4.3) corre las mismas pruebas, con otros textos
    if (t?.clase !== 'trabajo' || (t.tipo !== 'prueba' && t.tipo !== 'evolucion')) continue;
    const p = t.params ?? {};
    const es =
      (p.clave ?? p.hash) === entrada.clave ||
      (typeof p.lg === 'string' && lgs.has(p.lg)) ||
      (typeof p.adn === 'string' && lgs.has(lgHash(p.adn)));
    if (es)
      pruebas.push({
        id: t.id,
        titulo: t.titulo,
        estado: t.estado,
        creado: t.creado,
        tipo: t.tipo,
      });
  }
  pruebas.sort((a, b) => b.creado.localeCompare(a.creado));

  return { corridas, torneos, pruebas };
}
