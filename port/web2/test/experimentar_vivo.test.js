// @ts-check
// Experimentar contra el motor (engine/sim.js con el wasm, en el mismo
// proceso; se saltea si falta port/build-wasm): «Aplicar a la actual» deja
// la sim igual que un reset con el borrador. Para cada escenario de fábrica
// y cada control básico (con varios valores), y para todos a la vez y
// encadenados: se mandan los mensajes vivos del diff como lo hace
// sesion.aplicarEnCiclo (pedido del ciclo y los mensajes crudos) y se
// compara con una sim nueva del borrador (lo que no es vivo, el tamaño,
// queda como en la actual): opciones, costos, opciones base y el .dbsim
// byte a byte. Además, tras registrar el cambio, el borrador no tiene nada
// pendiente ni marcado como «cambiado» contra el efectivo de la corrida.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nuevaCorrida, registrarCambio } from '../engine/corridas.js';
import { ESCENARIOS_FABRICA } from '../engine/escenarios/fabrica.js';
import { diff, normalizar } from '../engine/escenarios/index.js';
import {
  CONTROLES_BASICOS,
  fusionarCambios,
  opcionesReset,
  PARAMETROS,
  valoresResueltos,
} from '../engine/opciones.js';
import { crearSim } from '../engine/sim.js';
import {
  borradorDe,
  controlCambiado,
  controlVivo,
  escribirControl,
  opcionInerte,
} from '../src/lib/experimentar/borrador.js';
import { cargarDbCore, hayWasm, SIN_WASM } from './util/dbcore-node.js';

/**
 * @typedef {import('../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../engine/opciones.js').ControlBasico} ControlBasico
 */

const SKIP = { skip: !hayWasm() && SIN_WASM, timeout: 60_000 };

const OPT_IDS = PARAMETROS.filter((p) => p.tipo === 'opt').map((p) => /** @type {number} */ (p.id));

/** @param {any} Mod */
function nuevaSim(Mod) {
  /** @type {number[]} */
  const handles = [];
  const espia = Object.create(Mod);
  espia.cwrap = (/** @type {string} */ nm, /** @type {any} */ r, /** @type {any} */ a) => {
    const f = Mod.cwrap(nm, r, a);
    if (nm !== 'db_sim_create') return f;
    return () => {
      const h = f();
      handles.push(h);
      return h;
    };
  };
  /** @type {any[]} */
  const msgs = [];
  const sim = crearSim({
    Module: espia,
    post: (/** @type {any} */ m) => {
      msgs.push(m);
      if (m.t === 'frame') queueMicrotask(() => sim.handle({ t: 'ack', buf: m.buf }));
    },
    fecha: () => new Date(Date.UTC(2026, 0, 15, 13, 2, 3)),
    azar: () => 0.5,
  });
  return { handle: sim.handle, msgs, h: () => handles[handles.length - 1] };
}

/** @param {Escenario} e */
const reset = (e) => ({
  t: 'reset',
  seed: 4242,
  options: opcionesReset(valoresResueltos(e.opciones.base, e.opciones.cambios)),
  species: [],
  limpio: true,
});

/** @param {ControlBasico} c @returns {any[]} */
function valoresDe(c) {
  if (c.valor === 'bool') return [false, true];
  if (c.opciones) return c.opciones.map((o) => o.v);
  return [c.min ?? 0, 1, 7, 250, c.max ?? 1000];
}

/** Sin especies ni objetos: el reset solo mide las opciones. @param {Escenario} e */
const sinSiembra = (e) => ({
  ...structuredClone(e),
  especies: [],
  objetos: { obstaculos: [], teleporters: [] },
});

/**
 * El efectivo tras registrar el cambio (como NucleoCorrida.escenarioEfectivo).
 * @param {Escenario} actual @param {ReturnType<typeof diff>} d
 */
function efectivoTras(actual, d) {
  const corr = nuevaCorrida({ escenario: actual, semilla: 1 });
  for (const c of d.vivo) registrarCambio(corr, 5, { [c.clave]: c.despues });
  const out = structuredClone(actual);
  for (const ev of corr.eventos)
    if (ev.tipo === 'opciones')
      out.opciones.cambios = fusionarCambios(out.opciones.cambios, ev.cambios);
  return out;
}

test('aplicar cada control básico en vivo = reset con el borrador', SKIP, async () => {
  const Mod = await cargarDbCore();
  const n = 'number';
  const getOpt = Mod.cwrap('db_sim_get_opt', n, [n, n]);
  const getCost = Mod.cwrap('db_sim_get_cost', n, [n, n]);
  const getBase = Mod.cwrap('db_sim_get_base', n, [n, n]);

  /** @param {ReturnType<typeof nuevaSim>} s */
  function foto(s) {
    const h = s.h();
    /** @type {Record<string, number>} */
    const o = {};
    for (const id of OPT_IDS) o[`opt:${id}`] = getOpt(h, id);
    for (let i = 0; i <= 70; i++) o[`cost:${i}`] = getCost(h, i);
    for (let k = 0; k <= 6; k++) o[`base#${k}`] = getBase(h, k);
    s.handle({ t: 'save', req: 'v' });
    const m = s.msgs.findLast((x) => x.t === 'saved' && x.req === 'v');
    s.msgs.length = 0;
    return { o, bytes: Buffer.from(new Uint8Array(m.bytes)).toString('base64') };
  }

  /** @type {string[]} */
  const fallos = [];
  let casos = 0;
  /** @param {string} etq @param {Escenario} actual @param {Escenario} borrador */
  function comparar(etq, actual, borrador) {
    const d = diff(borrador, actual);
    const a = nuevaSim(Mod);
    a.handle(reset(actual));
    // Como sesion.aplicarEnCiclo: pide el ciclo y manda los mensajes crudos.
    // (Una sim recién reseteada, sin ticks, contesta -1: TotRunCycle del
    // core; registrarCambio lo lleva a 0.)
    a.handle({ t: 'ciclo', req: 'c' });
    for (const m of d.mensajes) a.handle(m);
    const cic = a.msgs.find((m) => m.t === 'ciclo' && m.req === 'c');
    if (!Number.isInteger(cic?.cycle)) fallos.push(`${etq}: sin ciclo exacto`);
    // Sim nueva con el borrador; lo que no es vivo (el tamaño) queda como en la actual.
    const esperado = { ...borrador, opciones: { ...borrador.opciones } };
    if (d.requiereNueva) {
      const c = { ...borrador.opciones.cambios };
      for (const x of d.nueva) if (x.que === 'parametro') c[x.clave] = x.antes;
      esperado.opciones.cambios = c;
    }
    const b = nuevaSim(Mod);
    b.handle(reset(esperado));
    const fa = foto(a);
    const fb = foto(b);
    casos++;
    const dif = Object.keys(fa.o).filter((k) => !Object.is(fa.o[k], fb.o[k]));
    if (dif.length || fa.bytes !== fb.bytes)
      fallos.push(
        `${etq}: ${dif.map((k) => `${k} vivo=${fa.o[k]} nueva=${fb.o[k]}`).join('; ')}${
          fa.bytes !== fb.bytes ? ' [.dbsim distinto]' : ''
        }`,
      );
    // Tras aplicar y registrar: nada pendiente en vivo ni marcado «cambiado».
    const ef = borradorDe(efectivoTras(actual, d));
    if (diff(borrador, ef).mensajes.length) fallos.push(`${etq}: quedan mensajes pendientes`);
    for (const c of CONTROLES_BASICOS)
      if (controlVivo(c) && controlCambiado(c, borrador, ef))
        fallos.push(`${etq}: ${c.id} sigue cambiado`);
  }

  for (const f of ESCENARIOS_FABRICA) {
    const actual = borradorDe(sinSiembra(f));
    for (const c of CONTROLES_BASICOS)
      for (const v of valoresDe(c))
        comparar(`${f.id}/${c.id}=${v}`, actual, escribirControl(actual, c, v));
  }
  // Todos a la vez, y encadenados (el segundo parte del efectivo del primero).
  for (const f of ESCENARIOS_FABRICA) {
    let actual = borradorDe(sinSiembra(f));
    for (const extremo of [0, 1]) {
      let b = actual;
      for (const c of CONTROLES_BASICOS) {
        const vs = valoresDe(c).filter((x) => !opcionInerte(c, x));
        b = escribirControl(b, c, vs[(vs.length - 1) * extremo]);
      }
      comparar(`${f.id}/todos#${extremo}`, actual, b);
      actual = normalizar(efectivoTras(actual, diff(b, actual)));
    }
  }
  assert.ok(casos > 100, `casos: ${casos}`);
  assert.deepEqual(fallos.slice(0, 20), []);
});
