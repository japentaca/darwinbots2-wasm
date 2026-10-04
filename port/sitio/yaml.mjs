// Lector del subconjunto de YAML que usan spec/sysvars.yaml y
// spec/opcodes.yaml, sin dependencias (decisión 3 de port/web2/PLAN.md):
// mapas y listas por sangría, colecciones en línea {…} y […] (pueden
// ocupar varias líneas), cadenas entre comillas dobles, escalares planos,
// comentarios con #. `true`/`false`/`null` y los números se convierten; todo
// lo demás queda como texto (incluido `no`: YAML 1.2). Ante algo que no
// entiende, lanza un error con el número de línea.

/** @typedef {{n: number, sangria: number, texto: string}} Linea */

/**
 * Quita el comentario de una línea (un # al principio o tras un espacio,
 * fuera de comillas) y devuelve también el balance de corchetes y llaves.
 * @param {string} s
 */
function limpiar(s) {
  let dentro = false;
  let balance = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (dentro) {
      if (c === '\\') i++;
      else if (c === '"') dentro = false;
    } else if (c === '"') dentro = true;
    else if (c === '#' && (i === 0 || s[i - 1] === ' ' || s[i - 1] === '\t'))
      return { texto: s.slice(0, i).trimEnd(), balance };
    else if (c === '{' || c === '[') balance++;
    else if (c === '}' || c === ']') balance--;
  }
  return { texto: s.trimEnd(), balance };
}

/** @param {string} fuente @returns {Linea[]} */
function lineasLogicas(fuente) {
  const fis = fuente.replace(/\r/g, '').split('\n');
  /** @type {Linea[]} */
  const out = [];
  for (let i = 0; i < fis.length; i++) {
    let { texto, balance } = limpiar(fis[i]);
    if (!texto.trim()) continue;
    const n = i + 1;
    while (balance > 0 && i + 1 < fis.length) {
      const sig = limpiar(fis[++i]);
      texto += ` ${sig.texto.trim()}`;
      balance += sig.balance;
    }
    if (balance !== 0) throw new Error(`yaml: corchetes sin cerrar (línea ${n})`);
    const sangria = texto.length - texto.trimStart().length;
    out.push({ n, sangria, texto: texto.trim() });
  }
  return out;
}

/** @param {string} s */
function escalarPlano(s) {
  const t = s.trim();
  if (t === '' || t === 'null' || t === '~') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) return Number(t);
  return t;
}

/**
 * Lee un valor en línea desde s[i]: {…}, […], "…" o plano hasta `fin`.
 * @param {string} s @param {number} i @param {string} fin caracteres que cortan un plano
 * @param {number} n línea, para los errores
 * @returns {[any, number]}
 */
function valorEnLinea(s, i, fin, n) {
  while (s[i] === ' ') i++;
  const c = s[i];
  if (c === '"') {
    let j = i + 1;
    let r = '';
    while (j < s.length && s[j] !== '"') {
      if (s[j] === '\\') {
        const e = s[++j];
        r += e === 'n' ? '\n' : e === 't' ? '\t' : e;
      } else r += s[j];
      j++;
    }
    if (s[j] !== '"') throw new Error(`yaml: comillas sin cerrar (línea ${n})`);
    return [r, j + 1];
  }
  if (c === '[') {
    const lista = [];
    i++;
    for (;;) {
      while (s[i] === ' ') i++;
      if (s[i] === ']') return [lista, i + 1];
      const [v, j] = valorEnLinea(s, i, ',]', n);
      lista.push(v);
      i = j;
      while (s[i] === ' ') i++;
      if (s[i] === ',') i++;
      else if (s[i] !== ']') throw new Error(`yaml: se esperaba , o ] (línea ${n})`);
    }
  }
  if (c === '{') {
    /** @type {Record<string, any>} */
    const mapa = {};
    i++;
    for (;;) {
      while (s[i] === ' ') i++;
      if (s[i] === '}') return [mapa, i + 1];
      let clave;
      if (s[i] === '"') [clave, i] = valorEnLinea(s, i, '', n);
      else {
        const k = s.indexOf(':', i);
        if (k < 0) throw new Error(`yaml: falta : en un mapa en línea (línea ${n})`);
        clave = s.slice(i, k).trim();
        i = k;
      }
      while (s[i] === ' ') i++;
      if (s[i] !== ':') throw new Error(`yaml: falta : tras ${clave} (línea ${n})`);
      const [v, j] = valorEnLinea(s, i + 1, ',}', n);
      mapa[String(clave)] = v;
      i = j;
      while (s[i] === ' ') i++;
      if (s[i] === ',') i++;
      else if (s[i] !== '}') throw new Error(`yaml: se esperaba , o } (línea ${n})`);
    }
  }
  let j = i;
  while (j < s.length && !fin.includes(s[j])) j++;
  return [escalarPlano(s.slice(i, j)), j];
}

/** Valor de un escalar o colección que ocupa el resto de una línea. @param {string} s @param {number} n */
function valorDeLinea(s, n) {
  const t = s.trim();
  if (t[0] === '{' || t[0] === '[' || t[0] === '"') {
    const [v, j] = valorEnLinea(t, 0, '', n);
    if (t.slice(j).trim()) throw new Error(`yaml: sobra texto tras el valor (línea ${n})`);
    return v;
  }
  return escalarPlano(t);
}

/**
 * Separa `clave: valor` (o `clave:`). Devuelve null si no es un par.
 * @param {string} t
 */
function par(t) {
  let clave;
  let resto;
  if (t[0] === '"') {
    const [k, j] = valorEnLinea(t, 0, '', 0);
    if (t[j] !== ':') return null;
    clave = k;
    resto = t.slice(j + 1);
  } else {
    const m = /^([^\s:{}[\],"][^:]*?):(\s|$)/.exec(t);
    if (!m) return null;
    clave = m[1];
    resto = t.slice(m[0].length - m[2].length);
  }
  return { clave: String(clave), resto: resto.trim() };
}

/**
 * @param {Linea[]} ls @param {{i: number}} pos @param {number} sangria
 * @returns {any}
 */
function bloque(ls, pos, sangria) {
  const primera = ls[pos.i];
  if (primera.texto.startsWith('- ') || primera.texto === '-') return lista(ls, pos, sangria);
  return mapa(ls, pos, sangria);
}

/** @param {Linea[]} ls @param {{i: number}} pos @param {number} sangria */
function lista(ls, pos, sangria) {
  const out = [];
  while (pos.i < ls.length && ls[pos.i].sangria === sangria && /^-( |$)/.test(ls[pos.i].texto)) {
    const l = ls[pos.i];
    const resto = l.texto.slice(1).trim();
    if (!resto) {
      pos.i++;
      out.push(
        pos.i < ls.length && ls[pos.i].sangria > sangria
          ? bloque(ls, pos, ls[pos.i].sangria)
          : null,
      );
      continue;
    }
    const p = resto[0] === '{' || resto[0] === '[' ? null : par(resto);
    if (!p) {
      out.push(valorDeLinea(resto, l.n));
      pos.i++;
      continue;
    }
    // `- clave: valor` abre un mapa con la sangría del texto tras el guion.
    const sub = l.sangria + (l.texto.length - resto.length);
    ls[pos.i] = { n: l.n, sangria: sub, texto: resto };
    out.push(mapa(ls, pos, sub));
  }
  return out;
}

/** @param {Linea[]} ls @param {{i: number}} pos @param {number} sangria */
function mapa(ls, pos, sangria) {
  /** @type {Record<string, any>} */
  const out = {};
  while (pos.i < ls.length && ls[pos.i].sangria === sangria) {
    const l = ls[pos.i];
    if (l.texto.startsWith('- ')) break;
    const p = par(l.texto);
    if (!p) throw new Error(`yaml: se esperaba clave: valor (línea ${l.n})`);
    pos.i++;
    if (p.resto) out[p.clave] = valorDeLinea(p.resto, l.n);
    else if (pos.i < ls.length && ls[pos.i].sangria > sangria)
      out[p.clave] = bloque(ls, pos, ls[pos.i].sangria);
    else if (pos.i < ls.length && ls[pos.i].sangria === sangria && /^-( |$)/.test(ls[pos.i].texto))
      out[p.clave] = lista(ls, pos, sangria);
    else out[p.clave] = null;
  }
  if (pos.i < ls.length && ls[pos.i].sangria > sangria)
    throw new Error(`yaml: sangría inesperada (línea ${ls[pos.i].n})`);
  return out;
}

/**
 * @param {string} fuente
 * @returns {any}
 */
export function leerYaml(fuente) {
  const ls = lineasLogicas(fuente);
  if (!ls.length) return null;
  const pos = { i: 0 };
  const v = bloque(ls, pos, ls[0].sangria);
  if (pos.i < ls.length) throw new Error(`yaml: no se pudo leer desde la línea ${ls[pos.i].n}`);
  return v;
}
