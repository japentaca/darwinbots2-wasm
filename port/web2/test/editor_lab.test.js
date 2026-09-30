// @ts-check
// Laboratorio del editor de ADN (decisión 19; engine/lab.js):
//   1. Paridad con la clásica: analizarPartes = labAnalyze y
//      textoGenRemapeado = labGeneText de port/web/lab.js, cargado en un vm
//      con inventory.js (como test/biblioteca.test.js), en cientos de
//      híbridos al azar con y sin remapeo.
//   2. Los avisos del editor y su arreglo en un clic: «+ gen N» resuelve una
//      dependencia, «Remapear» deja los genes como los armaba el Laboratorio
//      de la clásica (componerHibrido de engine/adn.js, ya en paridad) y
//      «Renumerar» corrige los números de gen literales.
//   3. El panel «Genes»: búsqueda por capacidad y por bot.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { componerHibrido } from '../engine/adn.js';
import {
  analizarPartes,
  aplicarAccion,
  avisosLab,
  buscarGenes,
  genesTexto,
  insertarGen,
  literalesGen,
  reemplazarPalabras,
  textoGenRemapeado,
} from '../engine/lab.js';
import { genesAdn } from '../engine/lineage.js';
import { rng } from './util/clasica-vm.js';
import { WEB } from './util/dbcore-node.js';

const BOTS = path.join(WEB, 'bots');
/** @param {string} f */
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(BOTS, f), 'utf8'));
const bestiario = leerJson('bots.json');
const perfiles = leerJson('profiles.json');
/** @type {import('../engine/lab.js').GenesJson} */
const genes = leerJson('genes.json');
/** @param {string} f @param {number} gi */
const capsDe = (f, gi) => perfiles.bots[f]?.geneCaps?.[gi] ?? [];
const nombreDe = new Map(bestiario.map((/** @type {any} */ b) => [b.file, b.name]));

async function clasica() {
  /** @type {any} */
  const ctx = {
    BESTIARY: structuredClone(bestiario),
    log: () => {},
    console,
    fetch: async () => ({ ok: true, json: async () => structuredClone(perfiles) }),
  };
  vm.createContext(ctx);
  for (const f of ['inventory.js', 'lab.js'])
    vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), ctx, { filename: f });
  await vm.runInContext('invLoad()', ctx);
  ctx.__genes = genes;
  vm.runInContext('lab.genes = __genes; lab.sys = new Set(__genes.sysAddrs || []);', ctx);
  return { ctx, ev: (/** @type {string} */ js) => vm.runInContext(js, ctx) };
}

/** Avisos de la clásica en la forma de analizarPartes. @param {any} w */
function deClasica(w) {
  switch (w.kind) {
    case 'dep':
      return { tipo: 'dep', archivo: w.file, gen: w.gi, dir: w.addr, escritores: [...w.writers] };
    case 'gl':
      return { tipo: 'gl', archivo: w.file, gen: w.gi };
    case 'col':
      return { tipo: 'col', dir: w.addr };
    case 'remap':
      return { tipo: 'remap', dir: w.addr };
    default:
      return {
        tipo: 'info',
        motivo: /reproduces/.test(w.text) ? 'sin-repro' : 'sin-energia',
      };
  }
}

/** @param {any} a */
const sinExtras = (a) => {
  if (a.tipo === 'col' || a.tipo === 'remap') return { tipo: a.tipo, dir: a.dir };
  return a;
};

/** Archivos con genes de memoria propia (los que chocan y dependen). */
const conMemoria = Object.keys(genes.bots).filter((f) => genes.bots[f].some((g) => g.w || g.r));
const conGl = Object.keys(genes.bots).filter((f) => genes.bots[f].some((g) => g.gl));

/** Híbrido al azar: 1-4 bots, 1-4 genes de cada uno. @param {() => number} r */
function hibridoAzar(r) {
  const n = 1 + Math.floor(r() * 4);
  /** @type {{file: string, gi: number}[]} */
  const partes = [];
  for (let k = 0; k < n; k++) {
    const lista = r() < 0.2 ? conGl : conMemoria;
    const file = lista[Math.floor(r() * lista.length)];
    const gs = genes.bots[file];
    const m = 1 + Math.floor(r() * Math.min(4, gs.length));
    for (let j = 0; j < m; j++) partes.push({ file, gi: Math.floor(r() * gs.length) });
  }
  // mezclar el orden
  for (let i = partes.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [partes[i], partes[j]] = [partes[j], partes[i]];
  }
  return partes;
}

test('analizarPartes = labAnalyze y textoGenRemapeado = labGeneText (clásica en vm)', async () => {
  const { ctx, ev } = await clasica();
  const r = rng(20260930);
  let conRemap = 0;
  let conDep = 0;
  let conGlAviso = 0;
  for (let caso = 0; caso < 300; caso++) {
    const partes = hibridoAzar(r);
    for (const remap of [true, false]) {
      ctx.__parts = partes;
      ctx.__remap = remap;
      const c = ev(`(() => {
        lab.parts = __parts.map((p) => ({ ...p }));
        lab.remap = __remap;
        const x = labAnalyze();
        return {
          remaps: [...x.remaps].map(([f, m]) => [f, [...m]]),
          warns: x.warns,
          caps: [...x.caps].sort(),
        };
      })()`);
      const m = analizarPartes(partes, genes, { remap, capsDe });
      const donde = `caso ${caso} remap ${remap}`;
      assert.deepEqual(
        [...m.remaps].map(([f, mm]) => [f, [...mm]]),
        JSON.parse(JSON.stringify(c.remaps)),
        donde,
      );
      assert.deepEqual(
        m.avisos.map(sinExtras),
        JSON.parse(JSON.stringify(c.warns.map(deClasica))),
        donde,
      );
      assert.deepEqual([...m.caps].sort(), JSON.parse(JSON.stringify(c.caps)), donde);
      if (m.remaps.size) conRemap++;
      if (m.avisos.some((a) => a.tipo === 'dep')) conDep++;
      if (m.avisos.some((a) => a.tipo === 'gl')) conGlAviso++;
      // el texto de cada gen con el remapeo de su bot
      if (remap)
        for (const p of partes) {
          ctx.__rm = m.remaps.get(p.file) ?? null;
          const esperado = ev(`labGeneText(${JSON.stringify(p.file)}, ${p.gi}, __rm)`);
          assert.equal(textoGenRemapeado(genes.bots[p.file][p.gi], m.remaps.get(p.file)), esperado);
        }
    }
  }
  assert.ok(conRemap > 20 && conDep > 50 && conGlAviso > 10, `${conRemap} ${conDep} ${conGlAviso}`);
});

/** ADN armado insertando genes de genes.json uno por uno (sin remapear). @param {{file: string, gi: number}[]} partes */
function armar(partes) {
  let adn = '';
  /** @type {any[]} */
  let origenes = [];
  for (const p of partes) {
    const r = aplicarAccion(
      { adn, origenes, genes, nombreDe: (f) => nombreDe.get(f) },
      { tipo: 'agregar-gen', archivo: p.file, gen: p.gi },
    );
    adn = r.adn;
    origenes = r.origenes;
  }
  return { adn, origenes };
}

/** @param {string} adn */
const genesDe = (adn) => genesAdn(adn).genes.map((g) => g.join(' '));

test('«Remapear» deja los genes como los armaba el Laboratorio de la clásica', () => {
  /** @type {Map<number, {file: string, gi: number}[]>} */
  const usos = new Map();
  for (const [file, gs] of Object.entries(genes.bots))
    gs.forEach((g, gi) => {
      if (!g.ai) return;
      for (const a of g.w || []) {
        const l = usos.get(a) ?? [];
        if (!l.some((x) => x.file === file)) l.push({ file, gi });
        usos.set(a, l);
      }
    });
  let probados = 0;
  for (const choque of [...usos.values()].filter((l) => l.length >= 3).slice(0, 12)) {
    const partes = choque.slice(0, 3);
    const h = armar(partes);
    assert.deepEqual(
      h.origenes,
      partes.map((p) => ({ archivo: p.file, gen: p.gi })),
      'cada gen guarda su bot de origen',
    );
    const a = avisosLab({ adn: h.adn, origenes: h.origenes, genes, capsDe });
    const col = a.avisos.filter((x) => x.tipo === 'col');
    assert.ok(col.length, 'hay colisión');
    assert.deepEqual(col[0].acciones, [{ tipo: 'remapear' }]);
    const r = aplicarAccion({ adn: h.adn, origenes: h.origenes, genes }, { tipo: 'remapear' });
    const esperado = componerHibrido({ name: 'x', remap: true, parts: partes }, { genes }).adn;
    assert.deepEqual(genesDe(r.adn), genesDe(esperado), 'mismos genes que componerHibrido');
    const despues = avisosLab({ adn: r.adn, origenes: r.origenes, genes, capsDe });
    assert.equal(despues.avisos.filter((x) => x.tipo === 'col').length, 0, 'sin colisiones');
    // un gen más del mismo bot hereda su remapeo
    const movido = r.origenes.find((o) => o && 'remap' in o && o.remap?.length);
    if (movido && 'archivo' in movido) {
      const otro = genes.bots[movido.archivo].findIndex((g, gi) => gi !== movido.gen && g.ai);
      if (otro >= 0) {
        const r2 = aplicarAccion(
          { adn: r.adn, origenes: r.origenes, genes },
          { tipo: 'agregar-gen', archivo: movido.archivo, gen: otro },
        );
        const ult = /** @type {any} */ (r2.origenes[r2.origenes.length - 1]);
        assert.deepEqual(ult.remap, /** @type {any} */ (movido).remap);
      }
    }
    // un gen de los que se mueven, editado a mano: ya no se sabe qué palabra
    // es una dirección → el aviso queda, sin arreglo
    const g1 = genesTexto(h.adn)[2];
    const editado = reemplazarPalabras(h.adn, [{ i: g1.t0 + 1, w: `${g1.palabras[1]}0` }]);
    const ed = avisosLab({ adn: editado, origenes: h.origenes, genes, capsDe });
    const c2 = ed.avisos.filter((x) => x.tipo === 'col');
    assert.ok(c2.length, 'la colisión sigue');
    assert.ok(
      c2.every((x) => !x.acciones.length),
      'sin «Remapear»',
    );
    assert.equal(
      aplicarAccion({ adn: editado, origenes: h.origenes, genes }, { tipo: 'remapear' }).adn,
      editado,
    );
    probados++;
  }
  assert.ok(probados >= 5, `${probados}`);
});

test('dependencias: «+ gen N» agrega el gen que escribe la memoria', () => {
  let probados = 0;
  for (const file of conMemoria) {
    const gs = genes.bots[file];
    const lector = gs.findIndex((g, gi) =>
      (g.r || []).some((a) => gs.some((x, j) => j !== gi && (x.w || []).includes(a))),
    );
    if (lector < 0) continue;
    const h = armar([{ file, gi: lector }]);
    const a = avisosLab({ adn: h.adn, origenes: h.origenes, genes, capsDe });
    const dep = a.avisos.find((x) => x.tipo === 'dep');
    if (dep?.tipo !== 'dep') continue;
    assert.equal(dep.i, 0);
    assert.ok(dep.acciones.length >= 1);
    let adn = h.adn;
    /** @type {any[]} */
    let og = h.origenes;
    for (const x of dep.acciones) {
      const r = aplicarAccion({ adn, origenes: og, genes }, x);
      adn = r.adn;
      og = r.origenes;
    }
    const despues = avisosLab({ adn, origenes: og, genes, capsDe });
    assert.ok(
      !despues.avisos.some((x) => x.tipo === 'dep' && x.i === 0 && x.dir === dep.dir),
      `${file}: la dependencia de ${dep.dir} quedó resuelta`,
    );
    if (++probados >= 20) break;
  }
  assert.ok(probados >= 10, `${probados}`);
});

test('números de gen literales: «Renumerar» y «+ gen N»', () => {
  let probados = 0;
  for (const file of conGl) {
    const gs = genes.bots[file];
    const gi = gs.findIndex((g) => {
      if (!g.gl) return false;
      const lits = literalesGen(g.t.split(/\s+/));
      return lits.length > 0 && lits.every((x) => x.n - 1 < gs.length && x.n - 1 !== gs.indexOf(g));
    });
    if (gi < 0) continue;
    const g = gs[gi];
    const lits = literalesGen(g.t.split(/\s+/));
    const refs = [...new Set(lits.map((x) => x.n - 1))];
    // solo el gen: faltan sus referidos
    const solo = armar([{ file, gi }]);
    const a1 = avisosLab({ adn: solo.adn, origenes: solo.origenes, genes, capsDe });
    const gl1 = a1.avisos.find((x) => x.tipo === 'gl');
    assert.ok(gl1 && gl1.tipo === 'gl', file);
    assert.deepEqual([...gl1.faltan].sort(), [...refs].sort());
    // con los referidos después (otra numeración): se renumera
    const h = armar([{ file, gi }, ...refs.map((r) => ({ file, gi: r }))]);
    const a2 = avisosLab({ adn: h.adn, origenes: h.origenes, genes, capsDe });
    const gl2 = a2.avisos.find((x) => x.tipo === 'gl');
    const hace = lits.some((x) => x.n !== 2 + refs.indexOf(x.n - 1));
    if (!hace) continue;
    assert.ok(gl2 && gl2.tipo === 'gl', `${file}: numeración vieja`);
    assert.deepEqual(gl2.acciones, [{ tipo: 'renumerar', i: 0 }]);
    const r = aplicarAccion({ adn: h.adn, origenes: h.origenes, genes }, gl2.acciones[0]);
    const g0 = genesTexto(r.adn)[0].palabras;
    for (const x of lits) assert.equal(g0[x.k], String(2 + refs.indexOf(x.n - 1)));
    const a3 = avisosLab({ adn: r.adn, origenes: r.origenes, genes, capsDe });
    // (los referidos pueden tener sus propios literales: ahora están en otra posición)
    assert.ok(!a3.avisos.some((x) => x.tipo === 'gl' && x.i === 0), `${file}: ya apunta bien`);
    probados++;
  }
  assert.ok(probados >= 3, `${probados}`);
});

test('avisos de capacidades solo con todo el ADN del Bestiary', () => {
  const file = conMemoria.find((f) => capsDe(f, 0).length && !capsDe(f, 0).includes('repro-asex'));
  assert.ok(file);
  const h = armar([{ file, gi: 0 }]);
  const a = avisosLab({ adn: h.adn, origenes: h.origenes, genes, capsDe });
  assert.ok(a.avisos.some((x) => x.tipo === 'info' && x.motivo === 'sin-repro'));
  const mano = insertarGen(h.adn, 'cond\n*.nrg 5000 >\nstart\n50 .repro store\nstop');
  const b = avisosLab({ adn: mano, origenes: [...h.origenes, null], genes, capsDe });
  assert.ok(!b.avisos.some((x) => x.tipo === 'info'), 'con un gen escrito a mano, no se sabe');
  // un ADN sin orígenes: sin avisos del Laboratorio
  assert.deepEqual(avisosLab({ adn: mano, origenes: [], genes, capsDe }).avisos, []);
});

test('panel «Genes»: por capacidad (de menos a más palabras) y de un bot', () => {
  const datos = { genes, perfiles, bestiario };
  const v = buscarGenes(datos, { modo: 'cap', cap: 'veneno' });
  assert.ok(v.length > 20);
  assert.ok(v.every((g) => g.caps.includes('veneno')));
  for (let i = 1; i < v.length; i++) assert.ok(v[i - 1].palabras <= v[i].palabras);
  const auto = buscarGenes(datos, { modo: 'cap', cap: 'veneno', autonomos: true });
  assert.ok(auto.length < v.length && auto.every((g) => !g.memoria));
  const q = buscarGenes(datos, { modo: 'cap', cap: 'veneno', q: 'zebedee' });
  assert.ok(q.length > 0 && q.every((g) => g.nombre.toLowerCase().includes('zebedee')));
  const uno = buscarGenes(datos, { modo: 'bot', archivo: '1.txt' });
  assert.equal(uno.length, genes.bots['1.txt'].length);
  assert.deepEqual(
    uno.map((g) => g.gen),
    genes.bots['1.txt'].map((_, i) => i),
  );
  assert.deepEqual(buscarGenes(datos, { modo: 'bot', archivo: '' }), []);
});
