// @ts-check
// Humo de los módulos de render con un contexto 2D falso: recorren un frame
// armado a mano (las dos vistas, foco, eventos) sin romperse y dibujan algo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { H, HEADER, REG } from '../engine/protocolo.js';
import { cssAVb, vbACss } from '../src/lib/mundo/color.js';
import {
  CAPAS_DEFECTO,
  dibujarBotsClasicos,
  dibujarObjetos,
  dibujarVision,
} from '../src/lib/mundo/render-clasico.js';
import {
  dibujarBotsRicos,
  dibujarEventos,
  EstadoRico,
  ingerirEventos,
  LENTES,
  Rastro,
} from '../src/lib/mundo/render-enriquecido.js';
import { BOT, decodificarFrame, FLAG, FOCO, VIS } from '../src/lib/sim/frame.js';

/** Contexto falso: cuenta las llamadas y acepta cualquier propiedad. */
function ctxFalso() {
  /** @type {Record<string, number>} */
  const llamadas = {};
  const ctx = new Proxy(
    {},
    {
      get(obj, k) {
        if (k in obj) return /** @type {any} */ (obj)[k];
        return (/** @type {any[]} */ ..._a) => {
          llamadas[String(k)] = (llamadas[String(k)] ?? 0) + 1;
        };
      },
      set(obj, k, v) {
        /** @type {any} */ (obj)[k] = v;
        return true;
      },
    },
  );
  return { ctx: /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (ctx)), llamadas };
}

function frameRico() {
  const nB = 3;
  const cab = new Array(HEADER).fill(0);
  Object.assign(cab, {
    [H.fieldW]: 1000,
    [H.fieldH]: 1000,
    [H.nBots]: nB,
    [H.nShots]: 2,
    [H.nTies]: 1,
    [H.nObs]: 1,
    [H.nTps]: 1,
    [H.focus]: 2,
    [H.rich]: 1,
    [H.nBirths]: 1,
    [H.nDeaths]: 1,
    [H.cycle]: 10,
  });
  const partes = [cab];
  for (let i = 0; i < nB; i++) {
    const b = new Array(REG.bot).fill(0);
    b[BOT.idx] = i + 1;
    b[BOT.x] = 100 + 300 * i;
    b[BOT.y] = 500;
    b[BOT.r] = 60;
    b[BOT.nrg] = 5000 * i;
    b[BOT.color] = cssAVb('#ff4040');
    b[BOT.flags] = [0, FLAG.veg, FLAG.corpse][i];
    b[BOT.shell] = 100;
    b[BOT.slime] = 100;
    b[BOT.venom] = 2000;
    b[BOT.lastup] = 30;
    partes.push(b);
  }
  partes.push([1, 2, 3, 4, 255, -1, 1, 5, 6], [1, 2, 3, 4, 255, 3, 0, 5, 6]);
  partes.push([100, 500, 400, 500, 3]);
  partes.push([0, 0, 100, 100, 0xff00]);
  partes.push([900, 900, 50, 50, 0xff, 3, 0]);
  const foco = new Array(REG.focus).fill(0);
  foco[FOCO.x] = 400;
  foco[FOCO.y] = 500;
  foco[FOCO.r] = 60;
  foco[FOCO.ojos + 3] = 5; // el ojo 0 ve algo
  partes.push(foco);
  for (let i = 0; i < nB; i++) {
    const q = new Array(REG.vis).fill(0);
    q[VIS.abs] = 100 + i;
    q[VIS.acciones] = i === 0 ? 0b11 : 0;
    q[VIS.estado] = 7;
    q[VIS.ojosVen] = 0b101;
    q[VIS.gendist] = i === 0 ? -1 : 0.25 * i;
    partes.push(q);
  }
  partes.push([10, 20, Number.NaN, Number.NaN, 0xff, 200]);
  partes.push([30, 40, 60, 0xff, 50, 1]);
  return decodificarFrame(Float32Array.from(partes.flat()));
}

test('colores', () => {
  assert.equal(vbACss(cssAVb('#102030')), 'rgb(16,32,48)');
});

test('vista clásica: objetos, bots y rejilla de visión', () => {
  const f = frameRico();
  const { ctx, llamadas } = ctxFalso();
  const p = { s: 0.5, z: 1, LW: 1, rica: false, capas: CAPAS_DEFECTO };
  dibujarObjetos(ctx, f, p);
  dibujarBotsClasicos(ctx, f, p);
  dibujarVision(ctx, f, p);
  assert.ok(llamadas.arc > 10);
  assert.ok(llamadas.fillRect >= 1);
  assert.ok(llamadas.strokeRect >= 1);
});

test('rejilla de visión: ángulos no finitos o enormes no cuelgan y dan arcos finitos', () => {
  // Float32: 1e300 ya llega como Infinity; 3e38 es el mayor finito.
  for (const aim of [Infinity, -Infinity, Number.NaN, 3e38, -3e38, -1e6, 1e6]) {
    const f = frameRico();
    f.v[f.of.focus + FOCO.aim] = aim;
    /** @type {number[]} */
    const angulos = [];
    const { ctx } = ctxFalso();
    /** @type {any} */ (ctx).arc = (/** @type {number[]} */ ...a) => angulos.push(a[3], a[4]);
    dibujarVision(ctx, f, { s: 0.5, z: 1, LW: 1, rica: false, capas: CAPAS_DEFECTO });
    assert.ok(angulos.length > 0, `aim ${aim}`);
    assert.ok(
      angulos.every((x) => Number.isFinite(x) && x <= 0 && x >= -2 * Math.PI),
      `aim ${aim}`,
    );
  }
});

test('vista enriquecida con todas las lentes, zoom grande y eventos', () => {
  const f = frameRico();
  const est = new EstadoRico();
  for (const lente of Object.keys(LENTES)) {
    const { ctx, llamadas } = ctxFalso();
    const r = dibujarBotsRicos(ctx, f, est, {
      s: 0.5,
      LW: 0.05, // zoom 20: entra el detalle fino
      ahora: 1000,
      lente,
      radiosFijos: true,
      ventana: [0, 500, 0, 500],
    });
    assert.ok(llamadas.fill > 0, lente);
    if (lente === 'especie') assert.ok(Number.isNaN(r.min));
    if (lente === 'gendist') assert.deepEqual(r, { min: 0.25, max: 0.25 });
  }
  assert.ok(est.acciones.has(100));
  ingerirEventos(f, est, 1000);
  assert.equal(est.nacimientos.length, 1);
  assert.equal(est.muertes.length, 1);
  assert.ok(est.efectosActivos(1100));
  const { ctx } = ctxFalso();
  dibujarEventos(ctx, est, { s: 0.5, LW: 1, ahora: 1100 });
  dibujarEventos(ctx, est, { s: 0.5, LW: 1, ahora: 5000 });
  assert.equal(est.nacimientos.length + est.muertes.length, 0, 'los eventos se apagan');
  // un ciclo menor = sim nueva: se limpia el estado
  ingerirEventos({ ...f, ciclo: 1, nNac: 0, nMue: 0 }, est, 6000);
  assert.equal(est.acciones.size, 0);
});

test('rastro: se corta en los saltos del toroide', () => {
  const r = new Rastro();
  r.agregar(10, 10, 1000);
  r.agregar(10, 10, 1000);
  r.agregar(20, 10, 1000);
  r.agregar(990, 10, 1000);
  assert.deepEqual(r.puntos, [[10, 10], [20, 10], null, [990, 10]]);
  const { ctx, llamadas } = ctxFalso();
  r.dibujar(ctx, 1, 1);
  assert.equal(llamadas.stroke, 4);
});
