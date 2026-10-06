#!/usr/bin/env node
// Generador del manual de darwinbots-wasm.org (port/web2/PLAN-SITIO.md S5-S9),
// sin dependencias: lee los .md de manual/<idioma>/, la spec (sysvars.yaml,
// opcodes.yaml) y el catálogo de parámetros (engine/opciones.js), y escribe
// HTML estático (una carpeta con index.html por página), el CSS, el JS del
// buscador y su índice JSON. Un manual por idioma (S11): el español en
// <sitio>/manual/ y el inglés en <sitio>/en/manual/, con las mismas páginas
// y las mismas URLs debajo. En inglés, los datos de la spec (que está en
// español) salen de manual/en/spec.yaml; lo que falte ahí sale en español.
//
// Uso: node port/sitio/generar.mjs [--sitio <carpeta>] [--sembrar] [--lint | --sin-lint]
//   --sitio     raíz del sitio (por defecto port/sitio/salida): escribe
//               <sitio>/manual y <sitio>/en/manual, que se borran antes.
//               armar-sitio.sh le pasa la carpeta del sitio armado.
//   --sembrar   crea el .md (frontmatter y cuerpo vacío, estado pendiente)
//               de cada página del índice que no lo tenga, en cada idioma,
//               y no genera.
//   --lint      exige el wasm (port/build-wasm/dbcore.*) y pasa cada bloque
//               ```adn por db_dna_lint; por defecto lo hace solo si el wasm
//               está. --sin-lint no lo hace.
// Falla (código 1, con la lista de errores) si un enlace [[…]] no existe, si
// falta o sobra un .md, si una sysvar, un operador o un parámetro queda sin
// página, si un bloque ```adn tiene avisos del lint, o si una página
// traducida no se corresponde con la original (paridad).

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GRUPOS, PARAMETROS } from '../web2/engine/opciones.js';
import { resaltarHtml } from '../web2/src/lib/bots/editor/resaltado.js';
import {
  CAPITULOS,
  FAMILIAS_OPERADORES,
  GRUPOS_SYSVARS,
  MEMORIA_GENETICA,
  PADRE_PARAMETROS,
  SLUG_OPERADOR,
} from './indice.mjs';
import {
  anclaDe,
  enLinea,
  escapar,
  escribirFrontmatter,
  frontmatter,
  markdown,
} from './markdown.mjs';
import { IDIOMAS, TEXTOS } from './textos.mjs';
import { leerYaml } from './yaml.mjs';

/** @typedef {import('./textos.mjs').Idioma} Idioma */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const PORT = path.resolve(AQUI, '..');
export const RAIZ_REPO = path.resolve(PORT, '..');
/** @param {Idioma} idioma */
export const manualDe = (idioma) => path.join(AQUI, 'manual', idioma);
const BUILD_WASM = path.join(PORT, 'build-wasm');
const ESTADOS = ['pendiente', 'borrador', 'revisada'];
/** Carpeta de cada manual dentro del sitio. */
export const CARPETA = { es: 'manual', en: 'en/manual' };

/**
 * @typedef {'portada' | 'capitulo' | 'prosa' | 'grupo-sysvars' | 'sysvar' | 'tabla-sysvars'
 *   | 'familia' | 'operador' | 'tabla-operadores' | 'parametros'} TipoPagina
 * @typedef {{
 *   ruta: string, tipo: TipoPagina, capitulo: string, slug: string, titulo: string,
 *   padre?: string, hijos: string[], md: boolean, datos?: any,
 *   resumen: string, etiquetas: string[], estado: string, cuerpo: string, claves: string[],
 * }} Pagina
 */

// ---- Spec ---------------------------------------------------------------------

/** @param {string} raiz */
export function cargarSpec(raiz = RAIZ_REPO) {
  const sysvars = leerYaml(fs.readFileSync(path.join(raiz, 'spec', 'sysvars.yaml'), 'utf8'));
  const opcodes = leerYaml(fs.readFileSync(path.join(raiz, 'spec', 'opcodes.yaml'), 'utf8'));
  return { registros: /** @type {any[]} */ (sysvars.registros), opcodes };
}

/** Campos de la spec que se reescriben en manual/<idioma>/spec.yaml y spec/*.yaml. */
export const CAMPOS_TRADUCIBLES = {
  registros: ['escribe', 'lee', 'borra', 'rango', 'nota'],
  opcodes: ['sem', 'effect', 'value', 'cost', 'flow'],
};

/**
 * Los datos de la spec reescritos para las fichas en un idioma:
 * manual/<idioma>/spec.yaml más manual/<idioma>/spec/*.yaml, con
 * `registros: [{addr, escribe, …}]` y `opcodes: [{token, sem, …}]`. En español
 * es la versión llana (sin jerga, y con lo que hace el port); en inglés, su
 * traducción. Sin archivos = nada reescrito. Una dirección, un token o un campo
 * que no existen, o una entrada repetida, van a `errores`. `texto` reemplaza a
 * los archivos (para los tests).
 * @param {Idioma} idioma @param {{registros: any[], opcodes: any}} spec @param {string[]} errores
 * @param {string} [texto]
 */
export function cargarTraduccionSpec(idioma, spec, errores, texto) {
  /** @type {{registros: Map<number, any>, opcodes: Map<string, any>}} */
  const t = { registros: new Map(), opcodes: new Map() };
  const base = manualDe(idioma);
  const dir = path.join(base, 'spec');
  /** @type {[string, string][]} nombre → texto */
  const fuentes =
    texto !== undefined
      ? [['spec.yaml', texto]]
      : [
          ...(fs.existsSync(path.join(base, 'spec.yaml')) ? ['spec.yaml'] : []),
          ...(fs.existsSync(dir)
            ? fs
                .readdirSync(dir)
                .filter((f) => f.endsWith('.yaml'))
                .sort()
                .map((f) => `spec/${f}`)
            : []),
        ].map((f) => [f, fs.readFileSync(path.join(base, f), 'utf8')]);
  const dirs = new Set(spec.registros.map((r) => r.addr));
  const tokens = new Set(
    Object.entries(spec.opcodes)
      .filter(([k]) => k !== 'meta')
      .flatMap(([, ops]) => /** @type {any[]} */ (ops).map((o) => o.token)),
  );
  for (const [nombre, contenido] of fuentes) {
    const y = leerYaml(contenido);
    const donde = `${idioma}/${nombre}`;
    for (const [lista, clave, validas] of /** @type {const} */ ([
      ['registros', 'addr', dirs],
      ['opcodes', 'token', tokens],
    ])) {
      for (const e of y[lista] ?? []) {
        const id = e[clave];
        if (!(/** @type {Set<any>} */ (validas).has(id)))
          errores.push(`${donde}: ${lista} ${id} no está en la spec`);
        if (t[lista].has(/** @type {never} */ (id)))
          errores.push(`${donde}: ${lista} ${id} está repetido`);
        for (const k of Object.keys(e))
          if (k !== clave && !CAMPOS_TRADUCIBLES[lista].includes(k))
            errores.push(`${donde}: ${lista} ${id}: el campo ${k} no se reescribe`);
        /** @type {Map<any, any>} */ (t[lista]).set(id, e);
      }
    }
  }
  return t;
}

// ---- Índice de páginas --------------------------------------------------------

/**
 * Arma todas las páginas (sin leer los .md) y las tablas de búsqueda de
 * sysvars y operadores, en un idioma (los títulos del índice y de las
 * familias y grupos, del campo `en` de indice.mjs).
 * @param {{registros: any[], opcodes: any}} spec @param {Idioma} [idioma]
 */
export function armarPaginas(spec, idioma = 'es') {
  /** @type {Map<string, Pagina>} */
  const paginas = new Map();
  /** @type {string[]} */
  const errores = [];
  const T = TEXTOS[idioma];
  const es = idioma === 'es';
  /** Un objeto del índice con sus textos en el idioma. @template {{titulo: string, en: any}} O @param {O} o */
  const loc = (o) => (es ? o : { ...o, ...(typeof o.en === 'string' ? { titulo: o.en } : o.en) });
  const traduccion = cargarTraduccionSpec(idioma, spec, errores);
  // La versión llana en español: en inglés, lo que falta traducir sale de acá.
  const llano = es ? traduccion : cargarTraduccionSpec('es', spec, []);
  /** @param {Partial<Pagina> & {ruta: string, tipo: TipoPagina, titulo: string}} p */
  const agregar = (p) => {
    if (paginas.has(p.ruta)) errores.push(`página repetida: ${p.ruta}`);
    const [capitulo, slug = ''] = p.ruta.split('/');
    const pag = {
      capitulo,
      slug,
      hijos: [],
      md: true,
      resumen: '',
      etiquetas: [],
      estado: 'pendiente',
      cuerpo: '',
      claves: [],
      ...p,
    };
    paginas.set(p.ruta, pag);
    if (p.padre) paginas.get(p.padre)?.hijos.push(p.ruta);
    return pag;
  };

  agregar({ ruta: '', tipo: 'portada', titulo: T.manual, md: false, estado: '' });

  /** nombre de sysvar en minúsculas → ruta; dirección → ruta */
  const sysvarPorNombre = new Map();
  const sysvarPorDir = new Map();
  /** token u alias (los de palabra en minúsculas) → ruta */
  const operadorPorToken = new Map();

  for (const cap of CAPITULOS) {
    const capL = loc(cap);
    agregar({
      ruta: cap.slug,
      tipo: 'capitulo',
      titulo: capL.titulo,
      resumen: capL.resumen,
      md: false,
      estado: '',
    });
    for (const p of cap.paginas)
      agregar({ ruta: `${cap.slug}/${p.slug}`, tipo: 'prosa', titulo: loc(p).titulo });

    if (cap.referencia === 'sysvars') {
      const porDir = new Map(spec.registros.map((r) => [r.addr, r]));
      const vistas = new Map();
      for (const g0 of GRUPOS_SYSVARS) {
        const g = loc(g0);
        const rg = `${cap.slug}/${g.slug}`;
        agregar({ ruta: rg, tipo: 'grupo-sysvars', titulo: g.titulo, datos: g });
        for (const d of g.dirs) {
          if (vistas.has(d))
            errores.push(`la dirección ${d} está en dos grupos (${vistas.get(d)} y ${g.slug})`);
          vistas.set(d, g.slug);
          const r = porDir.get(d);
          if (!r) {
            errores.push(
              `el grupo ${g.slug} nombra la dirección ${d}, que no está en sysvars.yaml`,
            );
            continue;
          }
          const mg = MEMORIA_GENETICA.find((m) => m.dirs.includes(d));
          if (mg) {
            const rm = `${cap.slug}/${mg.slug}`;
            if (!paginas.has(rm))
              agregar({
                ruta: rm,
                tipo: 'sysvar',
                titulo: loc(mg).titulo,
                padre: rg,
                datos: { registros: mg.dirs.map((x) => porDir.get(x)).filter(Boolean), grupo: g },
              });
            sysvarPorDir.set(d, rm);
            continue;
          }
          const nombres = /** @type {string[]} */ (r.names ?? []);
          const slug = nombres.length ? nombres[0].toLowerCase() : `mem-${d}`;
          const rs = `${cap.slug}/${slug}`;
          agregar({
            ruta: rs,
            tipo: 'sysvar',
            titulo: nombres.length ? `.${nombres[0]}` : T.tituloDireccion(d),
            padre: rg,
            datos: { registros: [r], grupo: g },
          });
          sysvarPorDir.set(d, rs);
          for (const n of nombres) sysvarPorNombre.set(n.toLowerCase(), rs);
        }
      }
      for (const r of spec.registros)
        if (!vistas.has(r.addr))
          errores.push(
            `la dirección ${r.addr} (${(r.names ?? []).join(', ')}) no está en ningún grupo`,
          );
      agregar({
        ruta: `${cap.slug}/todas`,
        tipo: 'tabla-sysvars',
        titulo: T.todasSysvars,
        md: false,
        estado: '',
      });
    }

    if (cap.referencia === 'operadores') {
      const usadas = new Set();
      for (const f0 of FAMILIAS_OPERADORES) {
        const f = loc(f0);
        const rf = `${cap.slug}/${f.slug}`;
        agregar({ ruta: rf, tipo: 'familia', titulo: f.titulo, datos: f });
        for (const sec of f.secciones) {
          usadas.add(sec);
          for (const op of spec.opcodes[sec] ?? []) {
            const slug = SLUG_OPERADOR[op.token] ?? op.token;
            if (!/^[a-z0-9-]+$/.test(slug))
              errores.push(`el operador ${op.token} necesita un slug en SLUG_OPERADOR`);
            const ro = `${cap.slug}/${slug}`;
            agregar({
              ruta: ro,
              tipo: 'operador',
              titulo: op.token,
              padre: rf,
              datos: { op, familia: f, seccion: sec },
            });
            for (const t of [op.token, ...(op.aliases ?? [])]) {
              const k = /^[a-z]+$/i.test(t) ? t.toLowerCase() : t;
              operadorPorToken.set(k, ro);
            }
          }
        }
      }
      for (const sec of Object.keys(spec.opcodes))
        if (sec !== 'meta' && !usadas.has(sec))
          errores.push(`la sección ${sec} de opcodes.yaml no está en ninguna familia`);
      agregar({
        ruta: `${cap.slug}/todos`,
        tipo: 'tabla-operadores',
        titulo: T.todosOperadores,
        md: false,
        estado: '',
      });
    }
  }

  // Parámetros (S8): una página por grupo de engine/opciones.js.
  if (!paginas.has(PADRE_PARAMETROS)) errores.push(`falta la página ${PADRE_PARAMETROS}`);
  const [capParam] = PADRE_PARAMETROS.split('/');
  /** clave → ruta */
  const parametroEn = new Map();
  for (const g of GRUPOS) {
    const ruta = `${capParam}/parametros-${g.id}`;
    const lista = PARAMETROS.filter((p) => p.grupo === g.id);
    agregar({
      ruta,
      tipo: 'parametros',
      titulo: T.tituloParametros(g[idioma]),
      padre: PADRE_PARAMETROS,
      datos: { grupo: g, lista },
    });
    for (const p of lista) parametroEn.set(p.clave, ruta);
  }
  for (const p of PARAMETROS)
    if (!parametroEn.has(p.clave)) errores.push(`el parámetro ${p.clave} no tiene página`);

  return {
    idioma,
    paginas,
    errores,
    traduccion,
    llano,
    sysvarPorNombre,
    sysvarPorDir,
    operadorPorToken,
    parametroEn,
  };
}

/**
 * Orden de lectura: capítulos en orden, cada página seguida de sus hijas.
 * @param {Map<string, Pagina>} paginas
 */
export function ordenLectura(paginas) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} r */
  const visitar = (r) => {
    out.push(r);
    for (const h of paginas.get(r)?.hijos ?? []) visitar(h);
  };
  for (const cap of CAPITULOS) {
    out.push(cap.slug);
    for (const p of paginas.values())
      if (p.capitulo === cap.slug && p.tipo !== 'capitulo' && !p.padre) visitar(p.ruta);
  }
  return out;
}

// ---- Los .md --------------------------------------------------------------------

/** @param {Pagina} p @param {Idioma} idioma */
const archivoMd = (p, idioma) => path.join(manualDe(idioma), p.capitulo, `${p.slug}.md`);

/** Lista los .md que hay en disco, como rutas `cap/slug`. @param {Idioma} idioma */
function mdEnDisco(idioma) {
  /** @type {string[]} */
  const out = [];
  const dir = manualDe(idioma);
  if (!fs.existsSync(dir)) return out;
  for (const cap of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!cap.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(dir, cap.name)))
      if (f.endsWith('.md')) out.push(`${cap.name}/${f.slice(0, -3)}`);
  }
  return out;
}

/**
 * Lee el .md de cada página (frontmatter y cuerpo). Faltantes y sobrantes
 * van a `errores`.
 * @param {Map<string, Pagina>} paginas @param {string[]} errores @param {Idioma} [idioma]
 */
export function leerMd(paginas, errores, idioma = 'es') {
  for (const p of paginas.values()) {
    if (!p.md) continue;
    const f = archivoMd(p, idioma);
    if (!fs.existsSync(f)) {
      errores.push(
        `falta ${path.relative(RAIZ_REPO, f).replaceAll(path.sep, '/')} (node port/sitio/generar.mjs --sembrar lo crea)`,
      );
      continue;
    }
    const { datos, cuerpo } = frontmatter(fs.readFileSync(f, 'utf8'));
    if (typeof datos.titulo === 'string' && datos.titulo) p.titulo = datos.titulo;
    p.resumen = typeof datos.resumen === 'string' ? datos.resumen : '';
    p.etiquetas = Array.isArray(datos.etiquetas) ? datos.etiquetas : [];
    p.estado = typeof datos.estado === 'string' ? datos.estado : '';
    if (!ESTADOS.includes(p.estado))
      errores.push(
        `${prefijoError(idioma)}${p.ruta}: estado «${p.estado}» (vale ${ESTADOS.join(', ')})`,
      );
    p.cuerpo = cuerpo;
  }
  for (const r of mdEnDisco(idioma)) {
    const p = paginas.get(r);
    if (!p?.md)
      errores.push(
        `sobra port/sitio/manual/${idioma}/${r}.md: no está en el índice (port/sitio/indice.mjs)`,
      );
  }
}

/** Los errores de una página en inglés llevan `en:` delante. @param {Idioma} idioma */
const prefijoError = (idioma) => (idioma === 'es' ? '' : `${idioma}:`);

/**
 * Crea el .md de cada página que no lo tenga. Devuelve cuántos creó. Las
 * claves del frontmatter y los valores de `estado` son los mismos en todos
 * los idiomas; el título sembrado es el del índice en ese idioma.
 * @param {Map<string, Pagina>} paginas @param {Idioma} [idioma]
 */
export function sembrar(paginas, idioma = 'es') {
  let n = 0;
  for (const p of paginas.values()) {
    if (!p.md) continue;
    const f = archivoMd(p, idioma);
    if (fs.existsSync(f)) continue;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const cabeza = escribirFrontmatter({
      titulo: p.titulo,
      resumen: '',
      etiquetas: [],
      estado: 'pendiente',
    });
    fs.writeFileSync(f, cabeza);
    n++;
  }
  return n;
}

// ---- Render -----------------------------------------------------------------------

/** Prefijo relativo desde una página hasta la raíz del manual. @param {string} ruta */
const prefijo = (ruta) => (ruta ? '../'.repeat(ruta.split('/').length) : '');

/** Href de `destino` (ruta de página, '' = portada) visto desde `desde`. @param {string} desde @param {string} destino */
const href = (desde, destino) =>
  `${prefijo(desde) || './'}${destino ? `${destino}/` : ''}`.replace(/^\.\/(?=.)/, '');

/** @param {any} v */
const txt = (v) => (v === null || v === undefined ? '' : String(v));

/** Bloques ```adn y claves de :::parametro de un cuerpo (paridad). @param {string} cuerpo */
const huella = (cuerpo) => ({
  adn: (cuerpo.match(/^```adn/gm) ?? []).length,
  parametros: [...cuerpo.matchAll(/^:::parametro\s+(\S+)/gm)]
    .map((x) => x[1])
    .sort()
    .join(' '),
});

/**
 * @param {ReturnType<typeof armarPaginas>} m
 * @param {{lint?: (bloques: {ruta: string, texto: string}[]) => Promise<string[]>,
 *   original?: Map<string, Pagina>}} [o] `original`: las páginas en español
 *   (con sus .md leídos) cuando `m` es una traducción; da el aviso «sin
 *   traducir» y la paridad: una página traducida tiene su original escrita,
 *   los mismos bloques ```adn y los mismos :::parametro.
 */
export async function generar(m, o = {}) {
  const { paginas, errores, sysvarPorNombre, sysvarPorDir, operadorPorToken, parametroEn } = m;
  const idioma = m.idioma ?? 'es';
  const T = TEXTOS[idioma];
  const pe = prefijoError(idioma);
  const orden = ordenLectura(paginas);
  /** @type {Map<string, string>} ruta → html del cuerpo */
  const cuerpos = new Map();
  /** @type {Map<string, Set<string>>} ruta → anclas */
  const anclas = new Map();
  /** @type {{desde: string, ruta: string, ancla: string}[]} */
  const anclasPedidas = [];
  /** @type {{ruta: string, texto: string}[]} */
  const bloquesAdn = [];
  /** @type {Map<string, string[]>} ruta → texto plano (buscador) */

  for (const r of orden) {
    const p = /** @type {Pagina} */ (paginas.get(r));
    const desde = r;
    const prosaParam = new Map();
    /** @param {string} d */
    const enlace = (/** @type {string} */ todo) => {
      // [[destino|otro texto]] vale para los cuatro tipos de destino. El | de
      // [[op:|]] (or bit a bit) es parte del token, no un separador.
      const corte = todo.startsWith('op:') ? todo.indexOf('|', 4) : todo.indexOf('|');
      const d = (corte < 0 ? todo : todo.slice(0, corte)).trim();
      const texto = corte < 0 ? '' : todo.slice(corte + 1).trim();
      const propio = texto ? enLinea(texto, { enlace }) : '';
      const fallar = (/** @type {string} */ msg) => {
        errores.push(`${pe}${r || 'portada'}: ${msg}`);
        return { href: '#', html: escapar(todo) };
      };
      if (d.startsWith('.')) {
        const n = d.slice(1);
        const ruta = /^\d+$/.test(n)
          ? sysvarPorDir.get(Number(n))
          : sysvarPorNombre.get(n.toLowerCase());
        if (!ruta) return fallar(`no existe la sysvar ${d}`);
        return { href: href(desde, ruta), html: propio || `<code>${escapar(d)}</code>` };
      }
      if (d.startsWith('op:')) {
        const t = d.slice(3);
        const ruta = operadorPorToken.get(/^[a-z]+$/i.test(t) ? t.toLowerCase() : t);
        if (!ruta) return fallar(`no existe el operador ${t}`);
        return { href: href(desde, ruta), html: propio || `<code>${escapar(t)}</code>` };
      }
      if (d.startsWith('param:')) {
        const clave = d.slice(6);
        const ruta = parametroEn.get(clave);
        const par = PARAMETROS.find((x) => x.clave === clave);
        if (!ruta || !par) return fallar(`no existe el parámetro ${clave}`);
        return {
          href: `${href(desde, ruta)}#${anclaParam(clave)}`,
          html: propio || escapar(par[idioma]),
        };
      }
      const [ruta, ancla] = d.split('#');
      const dest = paginas.get(ruta);
      if (!dest || dest.tipo === 'portada') return fallar(`no existe la página ${ruta}`);
      if (ancla) anclasPedidas.push({ desde: `${pe}${r}`, ruta, ancla });
      return {
        href: `${href(desde, ruta)}${ancla ? `#${ancla}` : ''}`,
        html: propio || enLinea(dest.titulo, { enlace }),
      };
    };
    /** @param {string} lenguaje @param {string} texto @param {string[]} opciones */
    const codigo = (lenguaje, texto, opciones) => {
      if (lenguaje === 'adn') {
        if (!opciones.includes('sin-lint')) bloquesAdn.push({ ruta: `${pe}${r}`, texto });
        const html = resaltarHtml(texto).replace(/\n$/, '');
        // «Abrir en la app» (S6): la ruta #/bots/nuevo?adn=… abre el editor
        // con ese ADN; la URL es relativa a la raíz del sitio.
        const abrir = `${prefijo(desde)}${RAIZ_SITIO[idioma]}app/#/bots/nuevo?adn=${encodeURIComponent(texto)}`;
        return `<div class="adn"><pre><code>${html}</code></pre><div class="acciones"><a class="abrir-app" href="${abrir}">${T.abrirEnApp}</a><button type="button" class="copiar" data-texto="${escapar(texto)}">${T.copiar}</button></div></div>`;
      }
      return `<pre><code>${escapar(texto)}</code></pre>`;
    };
    /** @param {string} tipo @param {string} arg @param {string} html */
    const contenedor = (tipo, arg, html) => {
      if (tipo === 'parametro' && p.tipo === 'parametros') {
        if (!p.datos.lista.some((/** @type {any} */ x) => x.clave === arg))
          errores.push(`${pe}${r}: :::parametro ${arg} no es un parámetro de este grupo`);
        prosaParam.set(arg, html);
        return '';
      }
      errores.push(`${pe}${r}: contenedor :::${tipo} desconocido`);
      return '';
    };
    let prosa = '';
    let titulos = [];
    try {
      const res = markdown(p.cuerpo, { enlace, codigo, contenedor });
      prosa = res.html;
      titulos = res.titulos;
    } catch (e) {
      errores.push(`${pe}${r}: ${/** @type {Error} */ (e).message}`);
    }
    const datos = htmlDatos(p, {
      paginas,
      desde,
      enlace,
      prosaParam,
      sysvarPorDir,
      operadorPorToken,
      idioma,
      traduccion: m.traduccion,
      llano: m.llano,
    });
    const orig = o.original?.get(r);
    if (orig?.md && p.estado !== 'pendiente') {
      const [a, b] = [huella(p.cuerpo), huella(orig.cuerpo)];
      if (orig.estado === 'pendiente')
        errores.push(`${pe}${r}: está traducida pero el original sigue pendiente`);
      if (a.adn !== b.adn)
        errores.push(`${pe}${r}: ${a.adn} bloques adn y el original tiene ${b.adn}`);
      if (a.parametros !== b.parametros)
        errores.push(`${pe}${r}: los :::parametro no son los del original`);
    }
    let pendiente = '';
    if (p.md && p.estado === 'pendiente' && !p.cuerpo.trim()) {
      const escrita = orig && orig.estado !== 'pendiente';
      const leer = escrita
        ? ` <a href="${prefijo(r)}${RAIZ_OTRO[idioma]}${r}/" hreflang="es" lang="es">${T.leerEnOtro}</a>`
        : '';
      pendiente = `<aside class="aviso pendiente"><p>${escrita ? T.sinTraducir : T.sinEscribir}${leer}</p></aside>`;
    }
    const html = [
      p.tipo === 'parametros' ? '' : datos,
      pendiente,
      prosa,
      p.tipo === 'parametros' ? datos : '',
    ]
      .filter(Boolean)
      .join('\n');
    cuerpos.set(r, html);
    anclas.set(
      r,
      new Set([
        ...titulos.map((t) => t.ancla),
        ...(p.tipo === 'parametros'
          ? p.datos.lista.map((/** @type {any} */ x) => anclaParam(x.clave))
          : []),
      ]),
    );
  }

  for (const a of anclasPedidas)
    if (!anclas.get(a.ruta)?.has(a.ancla))
      errores.push(`${a.desde}: la página ${a.ruta} no tiene el ancla #${a.ancla}`);

  if (o.lint) for (const e of await o.lint(bloquesAdn)) errores.push(e);

  const css = cssManual();
  const js = JS_MANUAL;
  const version = createHash('sha256').update(css).update(js).digest('hex').slice(0, 10);

  /** @type {Map<string, string>} ruta de archivo (relativa al destino) → contenido */
  const archivos = new Map();
  archivos.set('manual.css', css);
  archivos.set('manual.js', js);
  /** @type {any[]} */
  const busqueda = [];
  orden.unshift('');
  for (let i = 0; i < orden.length; i++) {
    const r = orden[i];
    const p = /** @type {Pagina} */ (paginas.get(r));
    const ant = i > 0 ? paginas.get(orden[i - 1]) : undefined;
    const sig = i + 1 < orden.length ? paginas.get(orden[i + 1]) : undefined;
    archivos.set(
      r ? `${r}/index.html` : 'index.html',
      plantilla(p, cuerpos.get(r) ?? htmlPortada(paginas, r, idioma), {
        paginas,
        ant,
        sig,
        version,
        idioma,
      }),
    );
    if (r) busqueda.push(entradaBusqueda(p, idioma));
  }
  archivos.set('buscar.json', JSON.stringify(busqueda));
  // El vocabulario del manual para la app (S10): la página y el resumen de
  // cada sysvar (por nombre y por dirección) y de cada operador (por token y
  // alias). Lo baja el editor de ADN y el inspector para enlazar cada
  // palabra con su página.
  const vocab = { sysvars: {}, direcciones: {}, operadores: {} };
  for (const p of paginas.values()) {
    const item = { u: `${p.ruta}/`, t: p.titulo, r: p.resumen || resumenGenerado(p, idioma) || '' };
    if (p.tipo === 'sysvar')
      for (const reg of p.datos.registros) {
        vocab.direcciones[String(reg.addr)] = item;
        for (const n of reg.names ?? []) vocab.sysvars[n.toLowerCase()] = item;
      }
    else if (p.tipo === 'operador')
      for (const w of [p.datos.op.token, ...(p.datos.op.aliases ?? [])])
        vocab.operadores[/^[a-z]+$/i.test(w) ? w.toLowerCase() : w] = item;
  }
  archivos.set('vocabulario.json', JSON.stringify(vocab));
  return { archivos, errores, bloquesAdn, orden };
}

/** @param {string} clave */
export const anclaParam = (clave) => `p-${clave.replace(/:/g, '-')}`;

/** @param {Pagina} p @param {Idioma} idioma */
function entradaBusqueda(p, idioma) {
  /** @type {string[]} */
  const extra = [...p.etiquetas];
  if (p.tipo === 'sysvar')
    for (const reg of p.datos.registros)
      extra.push(String(reg.addr), ...(reg.names ?? []).map((/** @type {string} */ n) => `.${n}`));
  if (p.tipo === 'operador') extra.push(...(p.datos.op.aliases ?? []));
  if (p.tipo === 'parametros') for (const x of p.datos.lista) extra.push(x[idioma], x.variable);
  return {
    t: p.titulo,
    u: `${p.ruta}/`,
    r: p.resumen || resumenGenerado(p, idioma),
    c: tituloCapitulo(p.capitulo, idioma),
    k: extra.join(' '),
  };
}

/** @param {string} slug @param {Idioma} idioma */
function tituloCapitulo(slug, idioma) {
  const cap = CAPITULOS.find((c) => c.slug === slug);
  if (!cap) return '';
  return idioma === 'es' ? cap.titulo : cap.en.titulo;
}

/**
 * Desde la raíz de un manual, la del manual en el otro idioma (el sitio
 * tiene solo dos: el español en /manual/ y el inglés en /en/manual/).
 */
const RAIZ_OTRO = { es: '../en/manual/', en: '../../manual/' };
/** Desde la raíz de un manual, la del sitio (la portada en cada idioma es `../`). */
const RAIZ_SITIO = { es: '../', en: '../../' };

/** Resumen de una página de referencia sin resumen escrito. @param {Pagina} p @param {Idioma} idioma */
function resumenGenerado(p, idioma) {
  const T = TEXTOS[idioma];
  if (p.tipo === 'sysvar') {
    const regs = p.datos.registros;
    const dirs = regs.length > 1 ? `${regs[0].addr}-${regs.at(-1).addr}` : regs[0].addr;
    return `${T.direccion} ${dirs} · ${sentido(regs[0].sentido, idioma)?.[0] ?? ''}`;
  }
  if (p.tipo === 'operador') return T.resumenOperador(p.datos.familia.titulo);
  return '';
}

/** @param {string} s @param {Idioma} idioma @returns {string[] | undefined} */
const sentido = (s, idioma) =>
  TEXTOS[idioma].sentidos[/** @type {keyof typeof TEXTOS.es.sentidos} */ (s)];

// ---- Datos generados de cada tipo de página ----------------------------------------------

/**
 * @param {Pagina} p
 * @param {{paginas: Map<string, Pagina>, desde: string, enlace: (d: string) => {href: string, html: string},
 *   prosaParam: Map<string, string>, sysvarPorDir: Map<number, string>, operadorPorToken: Map<string, string>,
 *   idioma: Idioma, traduccion: ReturnType<typeof cargarTraduccionSpec>,
 *   llano: ReturnType<typeof cargarTraduccionSpec>}} c
 */
function htmlDatos(p, c) {
  const { idioma } = c;
  const T = TEXTOS[idioma];
  const a = (/** @type {string} */ ruta, /** @type {string} */ html) =>
    `<a href="${href(c.desde, ruta)}">${html}</a>`;
  const filaDl = (/** @type {string} */ k, /** @type {string} */ v) =>
    v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  /**
   * Un campo de la spec en el idioma: de la traducción si está; si no, el
   * texto de la spec marcado como español.
   * @param {'registros' | 'opcodes'} lista @param {any} obj @param {string} campo
   */
  const dato = (lista, obj, campo) => {
    const id = lista === 'registros' ? obj.addr : obj.token;
    const de = (/** @type {any} */ t) => /** @type {Map<any, any>} */ (t[lista]).get(id)?.[campo];
    const md = (/** @type {any} */ v) => enLinea(txt(v), { enlace: c.enlace });
    // En español, la versión llana (un "" la oculta); si no hay, el dato de la spec.
    const llano = de(c.llano);
    const es =
      llano !== undefined
        ? llano === ''
          ? ''
          : md(llano)
        : obj[campo] === null || obj[campo] === undefined || obj[campo] === ''
          ? ''
          : escapar(txt(obj[campo]));
    if (idioma === 'es' || !es) return es;
    const tr = de(c.traduccion);
    return tr !== undefined ? md(tr) : `<span lang="es">${es}</span>`;
  };
  switch (p.tipo) {
    case 'sysvar': {
      const regs = p.datos.registros;
      if (regs.length > 1) {
        const filas = regs
          .map(
            (/** @type {any} */ r) =>
              `<tr><td class="num">${r.addr}</td><td>${dato('registros', r, 'escribe')}</td><td>${dato('registros', r, 'borra')}</td></tr>`,
          )
          .join('');
        return `<div class="ficha"><p class="ficha-tit">${T.datosSpec}</p><div class="tabla"><table><thead><tr><th>${T.direccion}</th><th>${T.escribe}</th><th>${T.borra}</th></tr></thead><tbody>${filas}</tbody></table></div></div>`;
      }
      const r = regs[0];
      const nombres = (r.names ?? [])
        .map((/** @type {string} */ n) => `<code>.${escapar(n)}</code>`)
        .join(', ');
      const s = sentido(r.sentido, idioma);
      const mut = [r.in ? T.comoLectura : '', r.out ? T.comoDestino : ''].filter(Boolean).join(T.y);
      return `<div class="ficha"><p class="ficha-tit">${T.datosSpec}</p><dl>${[
        filaDl(T.direccion, `<span class="num">${r.addr}</span>`),
        filaDl(r.names?.length > 1 ? T.nombres : T.nombre, nombres),
        filaDl(T.tipo, s ? `${s[0]}: ${s[1]}` : escapar(txt(r.sentido))),
        filaDl(T.grupo, a(`sysvars/${p.datos.grupo.slug}`, escapar(p.datos.grupo.titulo))),
        filaDl(T.escribe, dato('registros', r, 'escribe')),
        filaDl(T.lee, dato('registros', r, 'lee')),
        filaDl(T.borra, dato('registros', r, 'borra')),
        filaDl(T.rango, dato('registros', r, 'rango')),
        filaDl(T.nota, dato('registros', r, 'nota')),
        filaDl(T.mutaciones, mut ? T.laEligen(mut) : T.noLaEligen),
      ].join('')}</dl></div>`;
    }
    case 'grupo-sysvars':
    case 'tabla-sysvars': {
      const rutas =
        p.tipo === 'grupo-sysvars'
          ? p.hijos
          : [
              ...new Set(
                [...c.sysvarPorDir.entries()].sort((x, y) => x[0] - y[0]).map(([, r]) => r),
              ),
            ];
      const filas = rutas
        .map((ruta) => {
          const h = /** @type {Pagina} */ (c.paginas.get(ruta));
          const regs = h.datos.registros;
          const dir = regs.length > 1 ? `${regs[0].addr}-${regs.at(-1).addr}` : `${regs[0].addr}`;
          const s = sentido(regs[0].sentido, idioma)?.[0] ?? '';
          const alias =
            regs.length === 1
              ? (regs[0].names ?? [])
                  .slice(1)
                  .map((/** @type {string} */ n) => `.${n}`)
                  .join(', ')
              : '';
          const grupo =
            p.tipo === 'tabla-sysvars'
              ? `<td>${a(`sysvars/${h.datos.grupo.slug}`, escapar(h.datos.grupo.titulo))}</td>`
              : '';
          return `<tr><td class="num">${dir}</td><td>${a(ruta, `<code>${escapar(h.titulo)}</code>`)}${alias ? ` <span class="alias">${escapar(alias)}</span>` : ''}</td><td>${s}</td>${grupo}<td>${escapar(h.resumen)}</td></tr>`;
        })
        .join('');
      const grupoTh = p.tipo === 'tabla-sysvars' ? `<th>${T.grupo}</th>` : '';
      return `<div class="tabla"><table class="lista-ref"><thead><tr><th>${T.direccion}</th><th>${T.sysvar}</th><th>${T.tipo}</th>${grupoTh}<th>${T.resumen}</th></tr></thead><tbody>${filas}</tbody></table></div>`;
    }
    case 'operador': {
      const { op, familia } = p.datos;
      const pila = (/** @type {any} */ saca, /** @type {any} */ pone) =>
        saca === undefined && pone === undefined
          ? ''
          : T.sacaPone(saca === 'all' ? T.todo : String(saca ?? 0), String(pone ?? 0));
      return `<div class="ficha"><p class="ficha-tit">${T.datosSpec}</p><dl>${[
        filaDl(T.palabra, `<code>${escapar(op.token)}</code>`),
        filaDl(
          T.alias,
          (op.aliases ?? [])
            .map((/** @type {string} */ x) => `<code>${escapar(x)}</code>`)
            .join(', '),
        ),
        filaDl(T.familia, a(`operadores/${familia.slug}`, escapar(familia.titulo))),
        filaDl(T.pilaEntera, pila(op.pops_i, op.pushes_i)),
        filaDl(T.pilaBooleana, pila(op.pops_b, op.pushes_b)),
        filaDl(T.queHace, dato('opcodes', op, op.sem !== undefined ? 'sem' : 'effect')),
        filaDl(T.valor, op.tipo !== undefined ? dato('opcodes', op, 'value') : ''),
        filaDl(
          T.costo,
          dato('opcodes', op, 'cost') || enLinea(txt(familia.costo), { enlace: c.enlace }),
        ),
        filaDl(T.divisionCosto, op.cost_div !== undefined ? `÷ ${escapar(txt(op.cost_div))}` : ''),
        filaDl(T.seEjecuta, dato('opcodes', op, 'flow') || escapar(txt(familia.cuando))),
        filaDl(T.marcaLazos, op.flags_tie === undefined ? '' : op.flags_tie ? T.si : T.no),
      ].join('')}</dl></div>`;
    }
    case 'familia':
    case 'tabla-operadores': {
      const rutas =
        p.tipo === 'familia'
          ? p.hijos
          : [...c.paginas.values()].filter((x) => x.tipo === 'operador').map((x) => x.ruta);
      const filas = rutas
        .map((ruta) => {
          const h = /** @type {Pagina} */ (c.paginas.get(ruta));
          const op = h.datos.op;
          const fam =
            p.tipo === 'tabla-operadores'
              ? `<td>${a(`operadores/${h.datos.familia.slug}`, escapar(h.datos.familia.titulo))}</td>`
              : '';
          const que = h.resumen
            ? escapar(h.resumen)
            : dato('opcodes', op, op.sem !== undefined ? 'sem' : 'effect');
          return `<tr><td>${a(ruta, `<code>${escapar(h.titulo)}</code>`)}</td>${fam}<td>${que}</td></tr>`;
        })
        .join('');
      const famTh = p.tipo === 'tabla-operadores' ? `<th>${T.familia}</th>` : '';
      const costo =
        p.tipo === 'familia'
          ? `<p class="cita">${T.costo}: ${enLinea(p.datos.costo, { enlace: c.enlace })}</p>`
          : '';
      return `${costo}<div class="tabla"><table class="lista-ref"><thead><tr><th>${T.operador}</th>${famTh}<th>${T.queHace}</th></tr></thead><tbody>${filas}</tbody></table></div>`;
    }
    case 'parametros': {
      return p.datos.lista
        .map((/** @type {any} */ x) => {
          const rango =
            x.valor === 'bool'
              ? T.siNo
              : x.valores
                ? x.valores
                    .map((/** @type {any} */ v) => `${v.v} = ${escapar(v[idioma])}`)
                    .join(' · ')
                : x.sugerido
                  ? T.deA(x.sugerido.min, x.sugerido.max)
                  : '';
          const pd = x.valor === 'bool' ? (x.porDefecto ? T.si : T.no) : String(x.porDefecto);
          return `<section class="param" id="${anclaParam(x.clave)}"><h2>${escapar(x[idioma])}</h2><p class="ayuda">${escapar(x.ayuda[idioma])}</p><dl>${[
            filaDl(T.porDefecto, escapar(pd)),
            filaDl(x.valores ? T.valores : T.rangoHabitual, rango),
            filaDl(T.variable, `<code>${escapar(x.variable)}</code>`),
            filaDl(T.clave, `<code>${escapar(x.clave)}</code>`),
            filaDl(T.enVivo, x.vivo ? T.vivoSi : T.vivoNo),
            filaDl(T.modo, x.nivel === 'basico' ? T.modoBasico : T.modoAvanzado),
            filaDl(T.nota, x.nota ? escapar(x.nota[idioma]) : ''),
          ].join('')}</dl>${c.prosaParam.get(x.clave) ?? ''}</section>`;
        })
        .join('\n');
    }
    case 'capitulo':
      return htmlPortada(c.paginas, p.ruta, idioma);
    default:
      return '';
  }
}

/**
 * Índice de un capítulo o del manual entero.
 * @param {Map<string, Pagina>} paginas @param {string} ruta @param {Idioma} idioma
 */
function htmlPortada(paginas, ruta, idioma) {
  const T = TEXTOS[idioma];
  if (!ruta) {
    const caps = CAPITULOS.map((c) => {
      const cap = /** @type {Pagina} */ (paginas.get(c.slug));
      return `<li><a href="${href('', c.slug)}">${escapar(cap.titulo)}</a><span>${escapar(cap.resumen)}</span></li>`;
    }).join('');
    return `<p class="bajada">${escapar(T.bajada)}</p><ul class="indice-caps">${caps}</ul>`;
  }
  const items = [...paginas.values()]
    .filter((p) => p.capitulo === ruta && p.tipo !== 'capitulo' && !p.padre)
    .map(
      (p) =>
        `<li><a href="${href(ruta, p.ruta)}">${escapar(p.titulo)}</a>${p.resumen ? `<span>${escapar(p.resumen)}</span>` : ''}${estadoChip(p, idioma)}</li>`,
    )
    .join('');
  return `<ul class="indice-caps">${items}</ul>`;
}

/** @param {Pagina} p @param {Idioma} idioma */
const estadoChip = (p, idioma) =>
  p.md && p.estado === 'pendiente'
    ? `<em class="chip-estado">${TEXTOS[idioma].pendiente}</em>`
    : '';

// ---- Plantilla ---------------------------------------------------------------------------

/**
 * @param {Pagina} p @param {string} cuerpo
 * @param {{paginas: Map<string, Pagina>, ant?: Pagina, sig?: Pagina, version: string,
 *   idioma: Idioma}} c
 */
function plantilla(p, cuerpo, c) {
  const { idioma } = c;
  const T = TEXTOS[idioma];
  const otro = idioma === 'es' ? 'en' : 'es';
  const r = p.ruta;
  const pre = prefijo(r);
  const cap = c.paginas.get(p.capitulo);
  /** @type {string[]} */
  const migas = [`<a href="${href(r, '')}">${T.manual}</a>`];
  if (cap && p.tipo !== 'capitulo' && p.tipo !== 'portada')
    migas.push(`<a href="${href(r, cap.ruta)}">${escapar(cap.titulo)}</a>`);
  if (p.padre) {
    const padre = c.paginas.get(p.padre);
    if (padre) migas.push(`<a href="${href(r, padre.ruta)}">${escapar(padre.titulo)}</a>`);
  }
  const titulo = p.tipo === 'portada' ? T.tituloManual : p.titulo;
  const enOtro = `${pre}${RAIZ_OTRO[idioma]}${r ? `${r}/` : ''}`;
  const sitio = `${pre}${RAIZ_SITIO[idioma]}`;
  const navLink = (
    /** @type {Pagina | undefined} */ x,
    /** @type {string} */ cls,
    /** @type {string} */ et,
  ) =>
    x
      ? `<a class="${cls}" href="${href(r, x.ruta)}"><small>${et}</small>${escapar(x.tipo === 'portada' ? T.manual : x.titulo)}</a>`
      : '<span></span>';
  const desc = p.resumen || resumenGenerado(p, idioma) || cap?.resumen || T.descripcion;
  return `<!doctype html>
<html lang="${idioma}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.tipo === 'portada' ? escapar(titulo) : `${escapar(titulo)} · ${T.tituloManual}`}</title>
<meta name="description" content="${escapar(desc)}">
<link rel="icon" href="data:,">
<link rel="alternate" hreflang="${otro}" href="${enOtro}">
<script>try{const t=localStorage.getItem('darwinbots2.tema');if(t==='claro'||t==='oscuro')document.documentElement.dataset.tema=t;}catch{}</script>
<link rel="stylesheet" href="${pre}manual.css?v=${c.version}">
<script src="${pre}manual.js?v=${c.version}" defer></script>
</head>
<body data-raiz="${pre}">
<header class="barra">
  <button type="button" class="menu" aria-controls="lateral" aria-expanded="false">${T.indice}</button>
  <a class="marca" href="${pre}../">DarwinBots</a><a class="marca-manual" href="${href(r, '')}">${T.manual}</a>
  <div class="buscador"><input type="search" placeholder="${T.buscar}" aria-label="${T.buscar}" autocomplete="off"><ol class="resultados" hidden></ol></div>
  <a class="ir-app" href="${sitio}app/">${T.abrirApp}</a>
  <a class="idioma" href="${enOtro}" hreflang="${otro}" lang="${otro}" title="${T.otroIdiomaTitulo}"><span class="largo">${T.otroIdioma}</span><span class="corto">${otro.toUpperCase()}</span></a>
  <button type="button" class="tema" title="${T.temaTitulo}">${T.tema}</button>
</header>
<div class="cuerpo">
<nav class="lateral" id="lateral" aria-label="${T.indiceAria}">${lateral(c.paginas, r)}</nav>
<main>
<nav class="migas" aria-label="${T.migas}">${p.tipo === 'portada' ? '' : migas.join(' › ')}</nav>
<h1>${escapar(titulo)}</h1>
${p.resumen && p.tipo !== 'capitulo' ? `<p class="resumen">${escapar(p.resumen)}</p>` : ''}
${cuerpo}
<nav class="pasos">${navLink(c.ant, 'ant', T.anterior)}${navLink(c.sig, 'sig', T.siguiente)}</nav>
</main>
</div>
<footer><p>${T.pie} · <a href="https://github.com/japentaca/darwinbots2-wasm">${T.codigo}</a></p></footer>
</body>
</html>
`;
}

/**
 * Índice lateral: los capítulos; el actual, abierto con sus páginas; las
 * hijas, solo bajo la página abierta (o su padre).
 * @param {Map<string, Pagina>} paginas @param {string} actual
 */
function lateral(paginas, actual) {
  const pa = paginas.get(actual);
  const abierta = new Set([actual, pa?.padre ?? '']);
  const li = (/** @type {Pagina} */ p) => {
    const hijos =
      p.hijos.length && abierta.has(p.ruta)
        ? `<ul>${p.hijos.map((h) => li(/** @type {Pagina} */ (paginas.get(h)))).join('')}</ul>`
        : '';
    const cls = p.ruta === actual ? ' aria-current="page"' : '';
    return `<li><a href="${href(actual, p.ruta)}"${cls}>${escapar(p.titulo)}</a>${hijos}</li>`;
  };
  return `<ul>${CAPITULOS.map((cap) => {
    const dentro = cap.slug === pa?.capitulo;
    const paginasCap = dentro
      ? `<ul>${[...paginas.values()]
          .filter((p) => p.capitulo === cap.slug && p.tipo !== 'capitulo' && !p.padre)
          .map(li)
          .join('')}</ul>`
      : '';
    const cls = cap.slug === actual ? ' aria-current="page"' : '';
    return `<li class="cap${dentro ? ' abierto' : ''}"><a href="${href(actual, cap.slug)}"${cls}>${escapar(paginas.get(cap.slug)?.titulo ?? cap.titulo)}</a>${paginasCap}</li>`;
  }).join('')}</ul>`;
}

// ---- CSS y JS ----------------------------------------------------------------------------

/** Los tokens de tema de la app (decisión 24): todo lo de app.css antes de `body {`. */
export function tokensApp() {
  const css = fs.readFileSync(path.join(PORT, 'web2', 'src', 'app.css'), 'utf8').replace(/\r/g, '');
  const fin = css.indexOf('\nbody {');
  if (fin < 0) throw new Error('app.css: no encuentro el fin de los tokens (body {)');
  return css.slice(0, fin).trim();
}

function cssManual() {
  return `/* Manual de darwinbots-wasm.org (generado por port/sitio/generar.mjs). */
/* Tokens de tema copiados de port/web2/src/app.css: */
${tokensApp()}

${CSS_MANUAL}`;
}

const CSS_MANUAL = fs
  .readFileSync(path.join(AQUI, 'plantilla', 'manual.css'), 'utf8')
  .replace(/\r/g, '');
const JS_MANUAL = fs
  .readFileSync(path.join(AQUI, 'plantilla', 'manual.js'), 'utf8')
  .replace(/\r/g, '');

// ---- Lint de los bloques adn ------------------------------------------------------------

export const hayWasm = () =>
  fs.existsSync(path.join(BUILD_WASM, 'dbcore.js')) &&
  fs.existsSync(path.join(BUILD_WASM, 'dbcore.wasm'));

/**
 * Lint con db_dna_lint: un error por cada aviso de cada bloque.
 * @param {{ruta: string, texto: string}[]} bloques
 */
export async function lintWasm(bloques) {
  if (!bloques.length) return [];
  const require = createRequire(import.meta.url);
  const crear = require(path.join(BUILD_WASM, 'dbcore.js'));
  const M = await crear({ locateFile: (/** @type {string} */ f) => path.join(BUILD_WASM, f) });
  const lint = M.cwrap('db_dna_lint', 'number', ['string']);
  const liberar = M.cwrap('db_free', null, ['number']);
  /** @type {string[]} */
  const errores = [];
  for (const b of bloques) {
    const ptr = lint(b.texto);
    const s = ptr ? M.UTF8ToString(ptr) : '';
    if (ptr) liberar(ptr);
    for (const fila of s.split('\n').filter(Boolean)) {
      const [kind, token, , linea, pista] = fila.split('\t');
      errores.push(
        `${b.ruta}: bloque adn, línea ${linea}: ${kind} «${token}» (${pista}); si es a propósito, \`\`\`adn sin-lint`,
      );
    }
  }
  return errores;
}

// ---- Escritura -----------------------------------------------------------------------------

/**
 * @param {string} destino @param {Map<string, string>} archivos
 */
export function escribir(destino, archivos) {
  const abs = path.resolve(destino);
  if (abs === path.parse(abs).root || abs === PORT || abs === RAIZ_REPO || abs === AQUI)
    throw new Error(`destino inválido: ${destino}`);
  fs.rmSync(abs, { recursive: true, force: true });
  for (const [rel, contenido] of archivos) {
    const f = path.join(abs, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, contenido);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--sitio');
  const sitio = i >= 0 ? args[i + 1] : path.join(AQUI, 'salida');
  const spec = cargarSpec();
  if (args.includes('--sembrar')) {
    for (const idioma of IDIOMAS) {
      const m = armarPaginas(spec, idioma);
      if (m.errores.length) throw new Error(m.errores.join('\n'));
      console.log(
        `sembradas ${sembrar(m.paginas, idioma)} páginas en ${path.relative(process.cwd(), manualDe(idioma))}`,
      );
    }
    return;
  }
  let lint;
  if (args.includes('--lint')) {
    if (!hayWasm()) throw new Error('--lint: falta port/build-wasm/dbcore.{js,wasm}');
    lint = lintWasm;
  } else if (!args.includes('--sin-lint') && hayWasm()) lint = lintWasm;
  else console.warn('aviso: sin lint de los bloques adn');
  const res = await generarTodo(spec, { lint });
  const errores = res.flatMap((x) => x.r.errores);
  if (errores.length) {
    console.error(`${errores.length} errores:\n${errores.map((e) => `  ${e}`).join('\n')}`);
    process.exit(1);
  }
  for (const { idioma, m, r } of res) {
    const destino = path.join(sitio, CARPETA[idioma]);
    escribir(destino, r.archivos);
    const pend = [...m.paginas.values()].filter((p) => p.md && p.estado === 'pendiente').length;
    console.log(
      `manual (${idioma}) generado en ${destino}: ${r.orden.length} páginas, ${r.bloquesAdn.length} bloques adn, ${pend} pendientes`,
    );
  }
}

/**
 * Arma, lee y genera el manual en cada idioma; las traducciones, contra el
 * español (aviso «sin traducir» y paridad).
 * @param {{registros: any[], opcodes: any}} spec
 * @param {Parameters<typeof generar>[1]} [o]
 */
export async function generarTodo(spec, o = {}) {
  /** @type {Map<string, Pagina> | undefined} */
  let original;
  const out = [];
  for (const idioma of IDIOMAS) {
    const m = armarPaginas(spec, idioma);
    leerMd(m.paginas, m.errores, idioma);
    const r = await generar(m, { ...o, original });
    if (idioma === 'es') original = m.paginas;
    out.push({ idioma, m, r });
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}

export { anclaDe };
