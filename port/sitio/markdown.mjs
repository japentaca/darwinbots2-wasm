// Markdown propio del manual (PLAN-SITIO.md S5 y S6), sin dependencias.
//
// Bloques: títulos # a ####  (`## Título {#ancla}` fija el ancla), párrafos,
// listas con `- ` o `1. ` (anidadas con dos espacios más), tablas con |,
// citas con `> `, `---`, bloques ``` (```adn se colorea; ```adn sin-lint
// no pasa el lint: para mostrar errores a propósito), y contenedores
// `:::nota`, `:::cuidado` o `:::<tipo> <argumento>` hasta `:::`. Los
// comentarios <!-- … --> (las citas del revisor, S12) no salen.
//
// En línea: `código`, **negrita**, _cursiva_ (con guion bajo: el asterisco
// es del ADN, `*.eye5`), [texto](url) y las extensiones [[…]] que resuelve
// quien llama (`enlace`). Todo lo demás se escapa: no pasa HTML crudo.

/** @param {string} s */
export const escapar = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Ancla a partir de un texto: minúsculas, sin acentos, con guiones. @param {string} s */
export const anclaDe = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * @typedef {{href: string, html: string}} Enlace
 * @typedef {{
 *   enlace: (destino: string) => Enlace,
 *   codigo?: (lenguaje: string, texto: string, opciones: string[]) => string,
 *   contenedor?: (tipo: string, argumento: string, html: string) => string,
 * }} Opciones
 * @typedef {{nivel: number, texto: string, ancla: string}} Titulo
 */

/**
 * Inline: código, extensiones, enlaces, negrita y cursiva.
 * @param {string} s @param {Opciones} o
 */
export function enLinea(s, o) {
  /** @type {string[]} */
  const guardado = [];
  let t = procesar(s, o, guardado);
  while (MARCA.test(t)) t = t.replace(MARCAS, (_, i) => guardado[Number(i)]);
  return t;
}

// Marca de lo ya convertido (código, enlaces) mientras se procesa el resto:
// caracteres de uso privado, que no aparecen en el texto.
const A = String.fromCharCode(0xe000);
const B = String.fromCharCode(0xe001);
const MARCA = new RegExp(`${A}[0-9]+${B}`);
const MARCAS = new RegExp(`${A}([0-9]+)${B}`, 'g');

/**
 * enLinea sin restaurar lo guardado (código y enlaces quedan como marcas).
 * @param {string} s @param {Opciones} o @param {string[]} guardado
 */
function procesar(s, o, guardado) {
  const guardar = (/** @type {string} */ html) => `${A}${guardado.push(html) - 1}${B}`;
  let t = s.replace(/`([^`]+)`/g, (_, c) => guardar(`<code>${escapar(c)}</code>`));
  t = t.replace(/\[\[(.+?)\]\](?!\])/g, (_, d) => {
    const e = o.enlace(d.trim());
    return guardar(`<a href="${escapar(e.href)}">${e.html}</a>`);
  });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) =>
    guardar(`<a href="${escapar(url)}">${procesar(txt, o, guardado)}</a>`),
  );
  t = escapar(t);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return t.replace(/(^|[^\w])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, '$1<em>$2</em>');
}

/**
 * Celdas de una fila de tabla: corta en cada | que no esté escapado (\|)
 * ni dentro de `código` (el operador | del ADN).
 * @param {string} fila
 */
function partirFila(fila) {
  const out = [''];
  let enCodigo = false;
  let enEnlace = false; // el | de [[destino|texto]] no corta la celda
  for (let i = 0; i < fila.length; i++) {
    const c = fila[i];
    if (c === '\\' && fila[i + 1] === '|') {
      out[out.length - 1] += '|';
      i++;
    } else if (c === '|' && !enCodigo && !enEnlace) out.push('');
    else {
      if (c === '`' && !enEnlace) enCodigo = !enCodigo;
      if (!enCodigo && fila.startsWith('[[', i)) enEnlace = true;
      if (enEnlace && fila.startsWith(']]', i)) enEnlace = false;
      out[out.length - 1] += c;
    }
  }
  return out;
}

/** @param {string} l */
const esLista = (l) => /^(\s*)(- |\d+\. )/.exec(l);

/**
 * Bloques de un texto Markdown a HTML.
 * @param {string} fuente @param {Opciones} o
 * @returns {{html: string, titulos: Titulo[]}}
 */
export function markdown(fuente, o) {
  /** @type {Titulo[]} */
  const titulos = [];
  const html = bloques(
    fuente
      .replace(/\r/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .split('\n'),
    o,
    titulos,
  );
  return { html, titulos };
}

/**
 * @param {string[]} ls @param {Opciones} o @param {Titulo[]} titulos
 * @returns {string}
 */
function bloques(ls, o, titulos) {
  const out = [];
  let i = 0;
  while (i < ls.length) {
    const l = ls[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    // Bloque de código.
    const f = /^```\s*(\S*)\s*(.*)$/.exec(l);
    if (f) {
      const cuerpo = [];
      i++;
      while (i < ls.length && !/^```\s*$/.test(ls[i])) cuerpo.push(ls[i++]);
      if (i >= ls.length) throw new Error('bloque ``` sin cerrar');
      i++;
      const lenguaje = f[1];
      const opciones = f[2].split(/\s+/).filter(Boolean);
      const texto = cuerpo.join('\n');
      out.push(
        o.codigo
          ? o.codigo(lenguaje, texto, opciones)
          : `<pre><code>${escapar(texto)}</code></pre>`,
      );
      continue;
    }
    // Contenedor :::tipo argumento … :::
    const c = /^:::\s*([a-z-]+)\s*(.*)$/.exec(l);
    if (c) {
      const cuerpo = [];
      let prof = 1;
      i++;
      while (i < ls.length) {
        if (/^:::\s*[a-z-]+/.test(ls[i])) prof++;
        else if (/^:::\s*$/.test(ls[i]) && --prof === 0) break;
        cuerpo.push(ls[i++]);
      }
      if (i >= ls.length) throw new Error(`contenedor :::${c[1]} sin cerrar`);
      i++;
      const interno = bloques(cuerpo, o, titulos);
      if (o.contenedor && c[1] !== 'nota' && c[1] !== 'cuidado')
        out.push(o.contenedor(c[1], c[2].trim(), interno));
      else if (c[1] === 'nota' || c[1] === 'cuidado')
        out.push(`<aside class="aviso ${c[1]}">${interno}</aside>`);
      else throw new Error(`contenedor desconocido :::${c[1]}`);
      continue;
    }
    // Título.
    const h = /^(#{1,4})\s+(.*?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/.exec(l);
    if (h) {
      const nivel = h[1].length;
      const ancla = h[3] ?? anclaDe(h[2]);
      titulos.push({ nivel, texto: h[2], ancla });
      out.push(`<h${nivel} id="${ancla}">${enLinea(h[2], o)}</h${nivel}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(l)) {
      out.push('<hr>');
      i++;
      continue;
    }
    // Cita.
    if (l.startsWith('>')) {
      const cuerpo = [];
      while (i < ls.length && ls[i].startsWith('>')) cuerpo.push(ls[i++].replace(/^> ?/, ''));
      out.push(`<blockquote>${bloques(cuerpo, o, titulos)}</blockquote>`);
      continue;
    }
    // Tabla.
    if (l.startsWith('|') && i + 1 < ls.length && /^\|[\s:|-]+\|\s*$/.test(ls[i + 1])) {
      const celdas = (/** @type {string} */ x) =>
        partirFila(x.trim().replace(/^\||\|$/g, '')).map((y) => enLinea(y.trim(), o));
      const cab = celdas(l);
      const filas = [];
      i += 2;
      while (i < ls.length && ls[i].startsWith('|')) filas.push(celdas(ls[i++]));
      out.push(
        `<div class="tabla"><table><thead><tr>${cab.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${filas
          .map((f) => `<tr>${f.map((x) => `<td>${x}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    // Lista.
    const m = esLista(l);
    if (m) {
      const base = m[1].length;
      const ordenada = /\d/.test(m[2]);
      const items = [];
      while (i < ls.length) {
        const mi = esLista(ls[i]);
        if (!mi || mi[1].length !== base || /\d/.test(mi[2]) !== ordenada) break;
        const item = [ls[i].slice(mi[0].length)];
        i++;
        while (
          i < ls.length &&
          ls[i].trim() &&
          !(esLista(ls[i]) && esLista(ls[i])?.[1].length === base)
        ) {
          const sang = ls[i].length - ls[i].trimStart().length;
          if (sang <= base && !esLista(ls[i])) break;
          // Continuación del texto del ítem (antes de cualquier sublista).
          if (item.length === 1 && !esLista(ls[i])) item[0] += ` ${ls[i].trim()}`;
          else item.push(ls[i].slice(Math.min(sang, base + 2)));
          i++;
        }
        // Una línea en blanco entre ítems no corta la lista.
        if (i + 1 < ls.length && !ls[i]?.trim() && esLista(ls[i + 1])?.[1].length === base) i++;
        items.push(item);
      }
      const li = items.map((it) => {
        const [primera, ...resto] = it;
        const sub = resto.length ? bloques(resto, o, titulos) : '';
        return `<li>${enLinea(primera, o)}${sub}</li>`;
      });
      out.push(ordenada ? `<ol>${li.join('')}</ol>` : `<ul>${li.join('')}</ul>`);
      continue;
    }
    // Párrafo.
    const p = [];
    while (
      i < ls.length &&
      ls[i].trim() &&
      !/^(```|:::|#{1,4}\s|>|---+\s*$)/.test(ls[i]) &&
      !(ls[i].startsWith('|') && p.length === 0) &&
      !esLista(ls[i])
    )
      p.push(ls[i++].trim());
    if (!p.length) throw new Error(`no se pudo leer: ${l}`);
    out.push(`<p>${enLinea(p.join(' '), o)}</p>`);
  }
  return out.join('\n');
}

/**
 * Separa el frontmatter (`---` … `---` al principio) del cuerpo. Valores:
 * texto, o una lista `[a, b]`.
 * @param {string} fuente
 * @returns {{datos: Record<string, string | string[]>, cuerpo: string}}
 */
export function frontmatter(fuente) {
  const t = fuente.replace(/\r/g, '');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  if (!m) return { datos: {}, cuerpo: t };
  /** @type {Record<string, string | string[]>} */
  const datos = {};
  for (const l of m[1].split('\n')) {
    if (!l.trim()) continue;
    const k = /^([a-z_]+):\s*(.*)$/.exec(l);
    if (!k) throw new Error(`frontmatter: no se entiende «${l}»`);
    const v = k[2].trim();
    datos[k[1]] = v.startsWith('[')
      ? v
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : v.startsWith('"')
        ? JSON.parse(v)
        : v;
  }
  return { datos, cuerpo: t.slice(m[0].length) };
}

/**
 * Frontmatter de vuelta a texto (para sembrar los .md).
 * @param {Record<string, string | string[]>} datos
 */
export function escribirFrontmatter(datos) {
  const ls = Object.entries(datos).map(([k, v]) =>
    Array.isArray(v)
      ? `${k}: [${v.join(', ')}]`
      : `${k}: ${v === '' || /[:#"]|^\s|\s$/.test(v) ? JSON.stringify(v) : v}`,
  );
  return `---\n${ls.join('\n')}\n---\n`;
}
