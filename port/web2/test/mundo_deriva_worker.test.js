// @ts-check
// Laberinto polar y deriva de las formas (N3.8b) contra engine/worker.js
// REAL. El laberinto polar enciende la deriva (opciones 83–85, los valores
// de db_sim_maze_polar_ice: DERIVA_POLAR). Se comprueba que:
//   - el escenario efectivo (plegarObjetos, lo que usa escenarioEfectivo)
//     tiene las mismas 83–85 que la sim de la corrida, con los cambios
//     posteriores sobre 83–85 respetados;
//   - una sim nueva armada con aplicar() desde ese escenario (tras
//     «Guardar en el escenario») queda con esas mismas 83–85, también si el
//     laberinto las pisa (reenvío nocap tras los objetos) y tras «Borrar
//     todas las formas»;
//   - un escenario con polar de arranque y 83–85 propias queda con las
//     suyas, y sin ellas con las del laberinto (resolverOpciones lo dice).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { mensajesEvento } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar, DERIVA_POLAR, diff, resolverOpciones } from '../engine/escenarios/index.js';
import { valorEfectivo } from '../engine/opciones.js';
import { plegarObjetos } from '../src/lib/observar/objetos/ordenes.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const SKIP = { skip: hayWasm() ? false : SIN_WASM, timeout: 300000 };
const IDS = [83, 84, 85];

const BOTS = hayWasm()
  ? JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'))
  : [];
/** @param {{bot: string}} s */
const adnDe = (s) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};

const ESC = /** @type {import('../engine/escenarios/index.js').Escenario} */ (
  escenarioFabrica('laberinto')
);

/** @param {number} ciclo @param {any} orden @returns {any} */
const obj = (ciclo, orden) => ({ ciclo, tipo: 'objetos', orden });
/** @param {number} ciclo @param {Record<string, number>} cambios @returns {any} */
const opc = (ciclo, cambios) => ({ ciclo, tipo: 'opciones', cambios });
const POLAR = { tipo: 'laberinto', forma: 'polar', pasillo: 500, muro: 50 };

/**
 * Arma el escenario en un worker, repite los eventos en su ciclo (steps de
 * a uno) y lee las opciones 83–85 al final.
 * @param {import('../engine/escenarios/index.js').Escenario} esc @param {any[]} eventos
 */
async function correr(esc, eventos) {
  const c = new ClienteSim(workerEngine({ fechaFija: 0, semillaAzar: 1 }), {
    copiarFrames: false,
  });
  try {
    await c.wait((m) => m.t === 'ready');
    for (const m of aplicar(esc, 42, adnDe)) c.send(m);
    let ciclo = -1;
    for (const ev of eventos) {
      for (; ciclo < ev.ciclo; ciclo++) c.send({ t: 'step' });
      for (const m of mensajesEvento(ev)) c.send(m);
    }
    for (; ciclo < 8; ciclo++) c.send({ t: 'step' });
    /** @type {Record<number, number>} */
    const out = {};
    for (const id of IDS) {
      c.send({ t: 'getopt', id, req: `r${id}` });
      out[id] = (await c.wait((m) => m.t === 'opt' && m.id === id)).v;
    }
    return out;
  } finally {
    await c.stop();
  }
}

/**
 * El escenario efectivo tras «Guardar en el escenario» (escenarioEfectivo
 * con objetosEscenario = los objetos plegados).
 * @param {import('../engine/escenarios/index.js').Escenario} esc @param {any[]} eventos
 */
function efectivoGuardado(esc, eventos) {
  const p = plegarObjetos(esc.objetos, eventos, esc.opciones.cambios);
  const ef = structuredClone(esc);
  ef.opciones.cambios = p.cambios;
  ef.objetos = p.objetos;
  return ef;
}

/** 83–85 según resolverOpciones. @param {import('../engine/escenarios/index.js').Escenario} e */
const resueltas = (e) => {
  const r = resolverOpciones(e);
  return Object.fromEntries(IDS.map((id) => [id, valorEfectivo(r, `opt:${id}`)]));
};

test(
  'polar en caliente: el escenario efectivo y una sim nueva desde él tienen la deriva de la corrida',
  SKIP,
  async () => {
    const casos = [
      // el polar y después un cambio sobre la velocidad: manda el cambio
      [obj(3, POLAR), opc(5, { 'opt:85': 5 })],
      // un cambio antes del polar: el polar lo pisa
      [opc(1, { 'opt:85': 7, 'opt:83': 0 }), obj(3, POLAR)],
      // apagar un eje después del polar
      [obj(2, POLAR), opc(4, { 'opt:84': 0 })],
      // borrar todas las formas no apaga la deriva
      [obj(2, POLAR), obj(4, { tipo: 'borrar-formas' })],
    ];
    for (const evs of casos) {
      const corrida = await correr(ESC, evs);
      const ef = efectivoGuardado(ESC, evs);
      assert.deepEqual(resueltas(ef), corrida, `efectivo = corrida (${JSON.stringify(evs)})`);
      const nueva = await correr(ef, []);
      assert.deepEqual(nueva, corrida, `sim nueva = corrida (${JSON.stringify(evs)})`);
    }
    // Experimentar sobre el efectivo: apagar la deriva tras el polar ya no es
    // «sin cambios» (antes el efectivo decía 0 y el diff salía vacío).
    const ef = efectivoGuardado(ESC, [obj(3, POLAR)]);
    const b = structuredClone(ef);
    b.opciones.cambios = { ...b.opciones.cambios, 'opt:83': 0, 'opt:84': 0 };
    assert.deepEqual(diff(b, ef).mensajes, [
      { t: 'setopt', id: 83, v: 0 },
      { t: 'setopt', id: 84, v: 0 },
    ]);
  },
);

test(
  'polar de arranque: aplicar() respeta las 83–85 del escenario y, sin ellas, deja las del laberinto',
  SKIP,
  async () => {
    const conPolar = structuredClone(ESC);
    conPolar.objetos.obstaculos.push({ tipo: 'laberinto', forma: 'polar', pasillo: 500, muro: 50 });
    // Sin 83–85 propias: la deriva del laberinto, sin reenvíos.
    assert.equal(
      aplicar(conPolar, 42, adnDe).some((m) => m.t === 'setopt'),
      false,
    );
    const sinPropias = await correr(conPolar, []);
    assert.deepEqual(sinPropias, { 83: 1, 84: 1, 85: 20 });
    assert.deepEqual(resueltas(conPolar), sinPropias);
    // Con 83–85 propias: se reenvían tras los objetos (solo las que el
    // laberinto pisa) y la sim queda con las del escenario.
    const propias = structuredClone(conPolar);
    propias.opciones.cambios = {
      ...propias.opciones.cambios,
      'opt:84': 0,
      'opt:85': 3,
      'opt:83': 1,
    };
    const msgs = aplicar(propias, 42, adnDe);
    assert.deepEqual(msgs.slice(-2), [
      { t: 'setopt', id: 84, v: 0, nocap: true },
      { t: 'setopt', id: 85, v: 3, nocap: true },
    ]);
    const conPropias = await correr(propias, []);
    assert.deepEqual(conPropias, { 83: 1, 84: 0, 85: 3 });
    assert.deepEqual(resueltas(propias), conPropias);
    // Borrar todas las formas y guardar: la deriva sigue en el escenario.
    const evs = [obj(2, { tipo: 'borrar-formas' })];
    const corrida = await correr(conPolar, evs);
    const ef = efectivoGuardado(conPolar, evs);
    assert.deepEqual(ef.objetos.obstaculos, []);
    assert.deepEqual(await correr(ef, []), corrida);
    assert.deepEqual(corrida, { 83: DERIVA_POLAR['opt:83'], 84: 1, 85: 20 });
  },
);
