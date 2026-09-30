// @ts-check
// Decodificación del frame (src/lib/sim/frame.js) con un búfer armado a mano.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXTRA_SKINS, H, HEADER, REG } from '../engine/protocolo.js';
import {
  BOT,
  decodificarFrame,
  FLAG,
  FOCO,
  focoVivo,
  MUERE,
  NACE,
  OBS,
  offBot,
  offMuere,
  offNace,
  offObs,
  offShot,
  offTie,
  offTp,
  offVis,
  SHOT,
  TIE,
  TP,
  VIS,
} from '../src/lib/sim/frame.js';

/**
 * Arma un frame: 2 bots, 1 shot, 1 tie, 1 obstáculo, 1 teleporter, foco en
 * el bot 7 y (si rica) el bloque enriquecido con 1 nacimiento y 2 muertes.
 * El búfer sobra 50 floats (como los del pool).
 * @param {{ rica?: boolean, foco?: boolean, skins?: boolean }} o
 */
function armar(o) {
  const nB = 2;
  const nNac = 1;
  const nMue = 2;
  const partes = [];
  const cab = new Array(HEADER).fill(0);
  cab[H.fieldW] = 16000;
  cab[H.fieldH] = 12000;
  cab[H.nBots] = nB;
  cab[H.nShots] = 1;
  cab[H.nTies] = 1;
  cab[H.nObs] = 1;
  cab[H.nTps] = 1;
  cab[H.focus] = o.foco ? 7 : 0;
  cab[H.rich] = o.rica ? 1 : 0;
  cab[H.nBirths] = o.rica ? nNac : 0;
  cab[H.nDeaths] = o.rica ? nMue : 0;
  cab[H.cycle] = 4321;
  cab[H.extras] = o.skins ? EXTRA_SKINS : 0;
  partes.push(cab);
  for (let i = 0; i < nB; i++) {
    const b = new Array(REG.bot).fill(0);
    b[BOT.idx] = i === 0 ? 7 : 9;
    b[BOT.x] = 100 + i;
    b[BOT.y] = 200 + i;
    b[BOT.r] = 60;
    b[BOT.nrg] = 1000 * (i + 1);
    b[BOT.flags] = i === 1 ? FLAG.veg | FLAG.corpse : 0;
    partes.push(b);
  }
  partes.push([1, 2, 3, 4, 255, -1, 0, 5, 6]); // shot
  partes.push([10, 11, 12, 13, 3]); // tie dura
  partes.push([20, 21, 22, 23, 0xff00]); // obstáculo
  partes.push([30, 31, 32, 33, 0xff, 5, 2]); // teleporter
  if (o.foco) {
    const f = new Array(REG.focus).fill(0);
    f[FOCO.x] = 100;
    f[FOCO.y] = 200;
    f[FOCO.edad] = 55;
    f[FOCO.nrg] = 1000;
    f[FOCO.body] = 250;
    partes.push(f);
  }
  if (o.rica) {
    for (let i = 0; i < nB; i++) {
      const q = new Array(REG.vis).fill(0);
      q[VIS.abs] = 500 + i;
      q[VIS.especie] = i;
      q[VIS.gendist] = -1;
      partes.push(q);
    }
    partes.push([1, 2, Number.NaN, Number.NaN, 0xff, 501]);
    partes.push([3, 4, 60, 0xff, 400, 0]);
    partes.push([5, 6, 60, 0xff, 401, 1]);
  }
  if (o.skins) partes.push(new Array(nB * REG.skin).fill(1));
  const plano = partes.flat();
  const v = new Float32Array(plano.length + 50);
  v.set(plano);
  return { v, usado: plano.length };
}

test('cabecera y bloques sin foco ni vista enriquecida', () => {
  const { v, usado } = armar({});
  const f = decodificarFrame(v);
  assert.equal(f.W, 16000);
  assert.equal(f.H, 12000);
  assert.equal(f.nBots, 2);
  assert.equal(f.ciclo, 4321);
  assert.equal(f.rica, false);
  assert.equal(f.foco, 0);
  assert.equal(f.of.fin, usado);
  assert.equal(f.of.focus, -1);
  assert.equal(f.of.vis, -1);
  assert.equal(focoVivo(f), null);
  assert.equal(v[offBot(f, 0) + BOT.idx], 7);
  assert.equal(v[offBot(f, 1) + BOT.idx], 9);
  assert.ok(v[offBot(f, 1) + BOT.flags] & FLAG.corpse);
  assert.equal(v[offShot(f, 0) + SHOT.tipo], -1);
  assert.equal(v[offShot(f, 0) + SHOT.oy], 6);
  assert.equal(v[offTie(f, 0) + TIE.tipo], 3);
  assert.equal(v[offObs(f, 0) + OBS.color], 0xff00);
  assert.equal(v[offTp(f, 0) + TP.flags], 5);
  assert.equal(v[offTp(f, 0) + TP.enviados], 2);
});

test('foco, bloque enriquecido y eventos', () => {
  const { v, usado } = armar({ rica: true, foco: true });
  const f = decodificarFrame(v);
  assert.equal(f.rica, true);
  assert.equal(f.nNac, 1);
  assert.equal(f.nMue, 2);
  assert.equal(f.of.fin, usado);
  assert.deepEqual(focoVivo(f), {
    n: 7,
    x: 100,
    y: 200,
    aim: 0,
    r: 0,
    edad: 55,
    nrg: 1000,
    body: 250,
  });
  assert.equal(v[offVis(f, 0) + VIS.abs], 500);
  assert.equal(v[offVis(f, 1) + VIS.especie], 1);
  assert.ok(Number.isNaN(v[offNace(f, 0) + NACE.mx]));
  assert.equal(v[offNace(f, 0) + NACE.abs], 501);
  assert.equal(v[offMuere(f, 0) + MUERE.abs], 400);
  assert.equal(v[offMuere(f, 1) + MUERE.tp], 1);
});

test('los extras se detectan y ocupan su lugar al final', () => {
  const { v, usado } = armar({ rica: true, skins: true });
  const f = decodificarFrame(v);
  assert.equal(f.skins, true);
  assert.equal(f.monitor, false);
  assert.equal(f.of.skins, usado - 2 * REG.skin);
  assert.equal(f.of.fin, usado);
});

test('un búfer más corto que lo que declara la cabecera es un error', () => {
  const { v, usado } = armar({ rica: true });
  assert.throws(() => decodificarFrame(v.subarray(0, usado - 1)), RangeError);
  assert.throws(() => decodificarFrame(new Float32Array(3)), RangeError);
});
