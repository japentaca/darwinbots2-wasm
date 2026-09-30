// @ts-check
// Textos de Bots por código (paso N3.2, puro): errores de engine/bots.js,
// engine/migracion.js y engine/almacen.js, y las líneas del resumen de la
// migración de la clásica y del import de la biblioteca. Devuelven
// {clave, params} para t() (src/i18n/{es,en}/bots.json); nunca texto.

/**
 * @typedef {{clave: string, params?: Record<string, string | number>}} Mensaje
 */

/** Códigos de ErrorBots (engine/bots.js y engine/migracion.js) con texto: bots.error.<código>. */
export const CODIGOS_ERROR = Object.freeze([
  'adn-vacio',
  'nombre-vacio',
  'nombre-repetido',
  'nombre-del-foro',
  'no-existe',
  'no-es-propio',
  'version-inexistente',
  'json-invalido',
  'formato-desconocido',
  'version-nueva',
  'lectura',
]);

/** Códigos de ErrorAlmacen con texto: bots.error.almacen.<código>. */
export const CODIGOS_ALMACEN = Object.freeze(['version-vieja', 'sin-indexeddb']);

/**
 * Clave y parámetros del texto de un error cualquiera.
 * @param {unknown} err @returns {Mensaje}
 */
export function mensajeError(err) {
  const e = /** @type {any} */ (err);
  if (e && e.name === 'QuotaExceededError') return { clave: 'bots.error.cuota' };
  if (e && typeof e.codigo === 'string') {
    // los códigos de ErrorBots y de ErrorAlmacen no se pisan
    if (CODIGOS_ERROR.includes(e.codigo)) {
      /** @type {Record<string, string | number>} */
      const params = {};
      for (const [k, v] of Object.entries(e.params ?? {}))
        if (typeof v === 'string' || typeof v === 'number') params[k] = v;
      return { clave: `bots.error.${e.codigo}`, params };
    }
    if (CODIGOS_ALMACEN.includes(e.codigo)) return { clave: `bots.error.almacen.${e.codigo}` };
  }
  const detalle = e instanceof Error ? e.message : String(err);
  return { clave: 'bots.error.otro', params: { detalle } };
}

/**
 * ¿La migración trajo algo? (para mostrar o no el aviso).
 * @param {any} r resumen de migrarInventario
 */
export const migracionTrajoAlgo = (r) =>
  !!r?.existia &&
  ((r.marcas ?? 0) > 0 ||
    (r.selecciones ?? 0) > 0 ||
    (r.hibridos ?? 0) > 0 ||
    (r.hibridosDescartados?.length ?? 0) > 0);

/**
 * Líneas del aviso de la migración (resumen de migrarInventario). Solo las
 * que tienen algo; una sola línea si la clásica no tenía datos.
 * @param {any} r @returns {Mensaje[]}
 */
export function lineasMigracion(r) {
  if (!r?.existia) return [{ clave: 'bots.migracion.nada' }];
  /** @type {Mensaje[]} */
  const out = [];
  /** @param {string} clave @param {number | undefined} n @param {Record<string, string | number>} [extra] */
  const si = (clave, n, extra) => {
    if (n) out.push({ clave, params: { n, ...extra } });
  };
  si('bots.migracion.marcas', r.marcas, {
    favoritos: r.favoritos ?? 0,
    tags: r.conTags ?? 0,
    notas: r.conNotas ?? 0,
  });
  si('bots.migracion.huerfanas', r.huerfanas);
  si('bots.migracion.selecciones', r.seleccionesEscritas);
  si('bots.migracion.seleccionesOmitidas', r.seleccionesOmitidas);
  si('bots.migracion.hibridos', r.propiosEscritos);
  si('bots.migracion.hibridosYa', r.yaEstaban);
  si('bots.migracion.renombrados', r.renombrados);
  for (const h of r.hibridosIncompletos ?? [])
    out.push({ clave: 'bots.migracion.incompleto', params: { nombre: h.nombre, n: h.faltan } });
  for (const h of r.hibridosDescartados ?? [])
    out.push({
      clave: h.motivo === 'sin-genes' ? 'bots.migracion.sinGenes' : 'bots.migracion.vacio',
      params: { nombre: h.nombre },
    });
  si('bots.migracion.invalidos', r.invalidos);
  if (!out.length) out.push({ clave: 'bots.migracion.vacia' });
  return out;
}

/**
 * Líneas del resumen de importarBiblioteca.
 * @param {any} r @returns {Mensaje[]}
 */
export function lineasImport(r) {
  /** @type {Mensaje[]} */
  const out = [
    {
      clave: r?.formato === 'clasica' ? 'bots.importar.formatoClasica' : 'bots.importar.formato',
    },
  ];
  /** @param {string} clave @param {number | undefined} n */
  const si = (clave, n) => {
    if (n) out.push({ clave, params: { n } });
  };
  si('bots.importar.propios', r?.propiosEscritos);
  si('bots.importar.actualizados', r?.actualizados);
  si('bots.importar.yaEstaban', r?.yaEstaban);
  si('bots.importar.renombrados', r?.renombrados);
  si('bots.importar.marcas', r?.marcasEscritas);
  si('bots.importar.notasPisadas', r?.notasPisadas);
  si('bots.importar.selecciones', r?.seleccionesEscritas);
  si('bots.importar.seleccionesPisadas', r?.seleccionesPisadas);
  si('bots.importar.seleccionesOmitidas', r?.seleccionesOmitidas);
  for (const c of r?.conflictos ?? [])
    out.push({
      clave: 'bots.importar.conflicto',
      params: { nombre: c.nombre, nuevo: c.nombreNuevo },
    });
  for (const h of r?.hibridosDescartados ?? [])
    out.push({
      clave: h.motivo === 'sin-genes' ? 'bots.migracion.sinGenes' : 'bots.migracion.vacio',
      params: { nombre: h.nombre },
    });
  si('bots.importar.invalidos', r?.invalidos);
  if (out.length === 1) out.push({ clave: 'bots.importar.nada' });
  return out;
}

/** Capacidades de profiles.json con rótulo en bots.json (bots.cap.<clave>). */
export const CAPS = Object.freeze([
  'mueve',
  'gira',
  'ancla',
  'caza-nrg',
  'caza-cuerpo',
  'dispara',
  'veneno',
  'toxina',
  'virus',
  'residuos',
  'dona-nrg',
  'dispara-info',
  'caparazon',
  'limo',
  'fotosintesis',
  'cuerpo',
  'repro-asex',
  'repro-sex',
  'lazos',
  'come-lazo',
  'estructura',
  'comparte',
  'comunica',
  'lee-memoria',
  'vision',
  'ojos',
  'reconoce',
  'reacciona',
  'luz',
  'autoedita',
]);
/** Grupos de capacidades de profiles.json (bots.capGrupo.<grupo>). */
export const GRUPOS_CAP = Object.freeze([
  'Movement',
  'Attack',
  'Defense',
  'Energy',
  'Social',
  'Reproduction',
  'Multicellular',
  'Senses',
  'Genome',
]);
/** Arquetipos de profiles.json (bots.arquetipo.<clave>). */
export const ARQUETIPOS = Object.freeze([
  'multicelular',
  'vegetal',
  'depredador',
  'defensivo',
  'pasivo',
]);

/** Claves armadas con plantilla (para el test de claves): prefijo → sufijos. */
export const CLAVES_ARMADAS = Object.freeze([
  { prefijo: 'bots.error.', sufijos: [...CODIGOS_ERROR, 'otro', 'cuota'] },
  { prefijo: 'bots.error.almacen.', sufijos: [...CODIGOS_ALMACEN] },
  { prefijo: 'bots.cap.', sufijos: [...CAPS] },
  { prefijo: 'bots.capGrupo.', sufijos: [...GRUPOS_CAP] },
  { prefijo: 'bots.arquetipo.', sufijos: [...ARQUETIPOS, 'ninguno'] },
  { prefijo: 'bots.tamano.', sufijos: ['S', 'M', 'L', 'XL'] },
  { prefijo: 'bots.disparo.', sufijos: ['1', '2', '3', '4', '6', '8'] },
  {
    prefijo: 'bots.agrupar.',
    sufijos: ['arquetipo', 'foro', 'capacidad', 'tag', 'tamano', 'fav', 'origen', 'ninguno'],
  },
  { prefijo: 'bots.orden.', sufijos: ['nombre', 'genes', 'caps'] },
  { prefijo: 'bots.modo.', sufijos: ['todos', 'favoritos', 'propios'] },
  { prefijo: 'bots.pestana.', sufijos: ['resumen', 'adn', 'historial'] },
  {
    prefijo: 'bots.historial.estado.',
    sufijos: ['pendiente', 'corriendo', 'terminado', 'fallido', 'cancelado'],
  },
]);
