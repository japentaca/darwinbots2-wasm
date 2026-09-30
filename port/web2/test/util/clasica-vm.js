// @ts-check
// La clásica (port/web/, congelada) en un vm de node, para las pruebas de
// paridad: web/league.js, contest.js y tournament.js más las piezas de
// web/index.html que hacen falta, extraídas del fuente tal cual (el panel
// de opciones, su recolección —collectOptions—, applyF1Settings y el
// reinicio), sobre un DOM mínimo: elementos con id, dataset, value/checked
// (con el saneamiento del navegador: un <input type="number"> descarta lo
// que no es un número; un <select>, lo que no es una opción), 'change' y
// querySelectorAll para los selectores que usan esas funciones.
//
// clasica() → {ctx, ev, tocar, semilla, enviados}: `ev(js)` evalúa en el vm
// (p. ej. ev('collectOptions()')), `tocar([[id, valor], …])` cambia
// controles como el usuario y `enviados` junta lo que la página le manda al
// worker. Extraído de test/paridad_reglas.test.js (que lo usa igual).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
export const WEB = path.resolve(here, '..', '..', '..', 'web');
export const HTML = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');

export const MULBERRY = `(seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }`;
/** @type {(seed: number) => () => number} */
export const rng = new Function(`return ${MULBERRY}`)();

// ---- Piezas de web/index.html, extraídas del fuente ----------------------------------
// Desde `inicio` hasta el cierre de su primer bloque {…} o […] (sin contar
// paréntesis: la firma de una función no abre bloque).
/** @param {string} inicio */
function pieza(inicio) {
  const a = HTML.indexOf(inicio);
  assert.ok(a >= 0, `no está en index.html: ${inicio}`);
  let i = a + inicio.length - 1;
  while (HTML[i] !== '{' && HTML[i] !== '[') i++;
  let d = 0;
  for (; i < HTML.length; i++) {
    const ch = HTML[i];
    if (ch === '{' || ch === '[') d++;
    else if (ch === '}' || ch === ']') d--;
    if (d === 0) break;
  }
  return `${HTML.slice(a, i + 1)};\n`;
}
const PIEZAS = [
  'const PRESETS = {',
  'function cssToVbColor(',
  'const OPT_GROUPS = [',
  'const PHYS_PRESETS = {',
  'function fieldSizeDims(',
  'function buildOptsPanel(',
  'function costValue(',
  'function optValue(',
  'function shapeToOpts(',
  'function collectOptions(',
  'function newSim(',
  'function setRunning(',
  'const F1_COSTS = {',
  'const F1_OPTS = {',
  'const F1_KEYS = {',
  'function setInput(',
  'function applyF1Settings(',
  "document.getElementById('btn-reset').onclick = () => {",
]
  .map(pieza)
  .join('\n');

// ---- DOM mínimo ------------------------------------------------------------------------
const FLOAT = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/; // saneamiento de type=number
/** @param {string} s */
function atributos(s) {
  /** @type {Record<string, string>} */
  const a = {};
  for (const m of s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) a[m[1]] = m[2] ?? '';
  return a;
}

class El {
  /** @param {string} tag @param {Record<string, string>} at @param {string[]} [opciones] @param {number} [sel] */
  constructor(tag, at, opciones = [], sel = 0) {
    this.tag = tag;
    this.id = at.id || '';
    this.type = tag === 'select' ? 'select-one' : at.type || 'text';
    /** @type {Record<string, string>} */
    this.dataset = {};
    for (const k of Object.keys(at)) if (k.startsWith('data-')) this.dataset[k.slice(5)] = at[k];
    this.opciones = opciones;
    this.sel = sel;
    this.crudo = '';
    this.checked = 'checked' in at;
    /** @type {Array<(e: any) => void>} */
    this.oyentes = [];
    /** @type {((e: any) => void) | null} */
    this.onchange = null;
    /** @type {((e: any) => void) | null} */
    this.onclick = null;
    this.textContent = '';
    this.panel = false;
    this.enAside = false;
    this.orden = 0;
    if (at.value !== undefined) this.value = at.value;
  }
  get value() {
    return this.tag === 'select' ? (this.opciones[this.sel] ?? '') : this.crudo;
  }
  set value(v) {
    if (this.tag === 'select') this.sel = this.opciones.indexOf(String(v));
    else if (this.type === 'number') {
      const t = v === null ? '' : String(v);
      this.crudo = FLOAT.test(t) ? t : '';
    } else this.crudo = v === null ? '' : String(v);
  }
  /** @param {string} _t @param {(e: any) => void} f */
  addEventListener(_t, f) {
    this.oyentes.push(f);
  }
  /** @param {{type: string}} ev */
  dispatchEvent(ev) {
    const e = { type: ev.type, target: this };
    if (ev.type === 'change') {
      this.onchange?.(e);
      for (const f of this.oyentes) f(e);
    }
    return true;
  }
  click() {
    this.onclick?.({ target: this });
  }
  /** @param {string} sel */
  querySelectorAll(sel) {
    const d = /^\[data-(\w+)\]$/.exec(sel);
    assert.ok(d, sel);
    return this.doc.lista().filter((el) => el.panel && el.dataset[d[1]] !== undefined);
  }
  /** @param {string} html */
  set innerHTML(html) {
    this.doc.cargarPanel(html);
  }
}

/** Los <input> y <select> con id de un trozo de HTML, en orden. @param {string} html */
function controles(html) {
  const out = [];
  for (const m of html.matchAll(/<(input|select)\b([^>]*)>/g)) {
    const at = atributos(m[2]);
    if (!at.id) continue;
    /** @type {string[]} */
    const opciones = [];
    let sel = 0;
    if (m[1] === 'select') {
      const fin = html.indexOf('</select>', m.index);
      const cuerpo = html.slice(m.index, fin);
      for (const o of cuerpo.matchAll(/<option\s+value="([^"]*)"([^>]*)>/g)) {
        if (/\bselected\b/.test(o[2])) sel = opciones.length;
        opciones.push(o[1]);
      }
    }
    out.push({ el: new El(m[1], at, opciones, sel), pos: /** @type {number} */ (m.index) });
  }
  return out;
}

function documento() {
  const cuerpo = HTML.slice(0, HTML.indexOf('<script'));
  const aside = [cuerpo.indexOf('<aside>'), cuerpo.indexOf('</aside>')];
  const posPanel = cuerpo.indexOf('<div id="opts-panel">');
  /** @type {Map<string, El>} */
  const porId = new Map();
  /** @type {El[]} */
  let todos = [];
  const doc = {
    fullscreenElement: null,
    lista: () => todos,
    /** @param {string} id */
    getElementById: (id) => porId.get(id) || null,
    /** @param {string} sel */
    querySelectorAll(sel) {
      const partes = sel.split(',').map((p) => {
        const m = /^(aside|#opts-panel) \[data-(\w+)\]$/.exec(p.trim());
        assert.ok(m, p);
        return m;
      });
      return todos.filter((el) =>
        partes.some(
          (m) => el.dataset[m[2]] !== undefined && (m[1] === 'aside' ? el.enAside : el.panel),
        ),
      );
    },
    querySelector: () => null,
    /** @param {string} html */
    cargarPanel(html) {
      for (const el of todos) if (el.panel) porId.delete(el.id);
      todos = todos.filter((el) => !el.panel);
      controles(html).forEach(({ el }, i) => {
        el.panel = true;
        el.enAside = true;
        el.orden = posPanel + i / 1e4;
        todos.push(el);
      });
      todos.sort((a, b) => a.orden - b.orden);
      for (const el of todos) if (el.panel) porId.set(el.id, el);
    },
  };
  for (const { el, pos } of controles(cuerpo)) {
    el.enAside = pos > aside[0] && pos < aside[1];
    el.orden = pos;
    todos.push(el);
    porId.set(el.id, el);
  }
  const panel = new El('div', { id: 'opts-panel' });
  const reset = new El('button', { id: 'btn-reset' });
  for (const el of [...todos, panel, reset]) /** @type {any} */ (el).doc = doc;
  porId.set('opts-panel', panel);
  porId.set('btn-reset', reset);
  return doc;
}

// ---- La clásica ------------------------------------------------------------------------
export function clasica() {
  const store = new Map();
  /** @type {any[]} */
  const enviados = [];
  /** @type {any} */
  const ctx = {
    indexedDB: null,
    document: documento(),
    Event: class {
      /** @param {string} type */
      constructor(type) {
        this.type = type;
      }
    },
    console,
    log: () => {},
    invColor: () => '#rnd',
    localStorage: {
      getItem: (/** @type {string} */ k) => (store.has(k) ? store.get(k) : null),
      setItem: (/** @type {string} */ k, /** @type {any} */ v) => store.set(k, String(v)),
      removeItem: (/** @type {string} */ k) => store.delete(k),
    },
    inv: { items: [], sel: new Set(), sets: new Map() },
    userRec: () => ({ fav: false, tags: [] }),
    invFetchDna: async () => {
      throw new Error('no');
    },
    worker: { postMessage: (/** @type {any} */ m) => enviados.push(JSON.parse(JSON.stringify(m))) },
    running: false,
    btnRun: { textContent: '' },
    quietF1Census: false,
    clearRichState: () => {},
    bgOnSimStart: () => {},
    setObsSelection: () => {},
    setTpSelection: () => {},
  };
  // Los elementos del DOM se crean en el reino principal: el vm los ve igual.
  vm.createContext(ctx);
  for (const f of ['league.js', 'contest.js', 'tournament.js'])
    vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
  vm.runInContext(PIEZAS, ctx, { filename: 'index.html (piezas)' });
  vm.runInContext('buildOptsPanel();', ctx);
  /** @param {string} js */
  const ev = (js) => vm.runInContext(js, ctx);
  /** Un control cambiado por el usuario (setInput + 'change'). @param {[string, any][]} cambios */
  const tocar = (cambios) => {
    for (const [id, v] of cambios) {
      const el = ctx.document.getElementById(id);
      assert.ok(el, id);
      ev('setInput')(el, v);
      el.dispatchEvent({ type: 'change' });
    }
  };
  /** @param {number} seed */
  const semilla = (seed) => {
    ctx.__seed = seed;
    ev(`Math.random = (${MULBERRY})(__seed);`);
  };
  return { ctx, ev, tocar, semilla, enviados };
}

/** Del reino del vm al principal. @param {any} x */
export const plano = (x) => JSON.parse(JSON.stringify(x));
