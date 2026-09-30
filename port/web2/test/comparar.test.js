// @ts-check
// Comparar (N2.4): diferencias de configuración entre dos corridas,
// escalas del gráfico, fuentes, pool de workers (con dobles) y claves de
// i18n armadas con plantilla.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ESTADOS } from '../engine/cola.js';
import { registrarCambio, registrarSiembra } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { FORMAS_LABERINTO } from '../engine/escenarios/index.js';
import { Historia } from '../engine/history.js';
import { METRICAS } from '../engine/metricas.js';
import { GRUPOS_COMPARAR, vistaParams } from '../engine/replicas.js';
import {
  diferenciasConfig,
  objetoTexto,
  resumenEvento,
  valorParametro,
} from '../src/lib/analizar/comparar/diferencias.js';
import { fuenteActual, fuenteGuardada, serieBanda } from '../src/lib/analizar/comparar/fuentes.js';
import { ejeY, escalaX, pasoRedondo } from '../src/lib/analizar/comparar/grafico.js';
import { PoolWorkers, paraleloDe, TOPE_MAX, TOPE_POR_DEFECTO } from '../src/lib/trabajos/pool.js';
import { detalleError, textoError } from '../src/lib/trabajos/textos.js';

const SOPA = /** @type {any} */ (escenarioFabrica('sopa-primordial'));

test('diferenciasConfig: misma corrida = sin diferencias', () => {
  const c = { escenario: SOPA, semilla: 5, eventos: [] };
  const d = diferenciasConfig(c, structuredClone(c));
  assert.equal(d.total, 0);
  assert.deepEqual(d.opciones, []);
  assert.ok(d.opcionesIguales > 100);
  assert.ok(d.especies.every((e) => e.igual));
});

test('diferenciasConfig: opciones efectivas, especies, objetos, semilla y eventos', () => {
  const b = structuredClone(SOPA);
  b.opciones.cambios = { 'base:minVegs': 30, 'opt:2': 1, 'opt:3': 1 };
  b.especies[0].cantidad = 20;
  b.especies.push({ ...b.especies[1], bot: 'Otro' });
  b.objetos.teleporters.push({ tipo: 'local' });
  b.objetos.obstaculos.push({ tipo: 'laberinto', forma: 'spiral', pasillo: 3, muro: 2 });
  const cb = /** @type {any} */ ({ eventos: [] });
  registrarCambio(cb, 300, { 'opt:14': 0 });
  registrarSiembra(cb, 400, {
    nombre: 'X',
    adn: 'cond start stop',
    cantidad: 2,
    color: '#112233',
    vegetal: false,
    energia: 100,
  });
  const d = diferenciasConfig(
    { escenario: SOPA, semilla: 5, eventos: [] },
    { escenario: b, semilla: 6, eventos: cb.eventos },
  );
  const claves = d.opciones.map((o) => o.clave);
  assert.ok(claves.includes('base:minVegs'));
  assert.ok(claves.includes('opt:2') && claves.includes('opt:3'));
  assert.ok(!claves.includes('opt:1'), 'opt:1 es derivado: no se lista');
  const mv = d.opciones.find((o) => o.clave === 'base:minVegs');
  assert.equal(mv?.b, 30);
  assert.equal(d.semilla.igual, false);
  assert.equal(d.escenario.igual, true);
  const alga = d.especies.find((e) => e.bot === SOPA.especies[0].bot);
  assert.equal(alga?.igual, false);
  assert.equal(alga?.b?.cantidad, 20);
  assert.deepEqual(d.especies.find((e) => e.bot === 'Otro')?.a, null);
  assert.deepEqual(d.objetos.b, ['laberinto:spiral:3:2', 'teleporter']);
  assert.equal(d.eventos.igual, false);
  assert.equal(d.total, 1 + d.opciones.length + d.especies.filter((e) => !e.igual).length + 1 + 1);
  assert.deepEqual(resumenEvento(cb.eventos[1]), {
    ciclo: 400,
    tipo: 'siembra',
    especie: 'X',
    cantidad: 2,
  });
  assert.deepEqual(resumenEvento(cb.eventos[0]), {
    ciclo: 300,
    tipo: 'opciones',
    cambios: [['opt:14', 0]],
  });
  // orden de objeto en caliente (barra «Mundo»): sin parámetros, con la orden
  const orden = { tipo: 'laberinto', forma: 'spiral', pasillo: 300, muro: 100 };
  assert.deepEqual(resumenEvento({ ciclo: 500, tipo: 'objetos', orden }), {
    ciclo: 500,
    tipo: 'objetos',
    orden,
    cambios: [],
  });
});

test('diferenciasConfig compara el ADN propio por su texto (y el del Bestiary por hash)', () => {
  const a = structuredClone(SOPA);
  a.especies[0] = { ...a.especies[0], origen: 'propio', adn: 'cond start *.nrg 1 stop' };
  const b = structuredClone(a);
  b.especies[0].adn = 'cond start *.nrg 2 stop';
  const d = diferenciasConfig(
    { escenario: a, semilla: 1, eventos: [] },
    { escenario: b, semilla: 1, eventos: [] },
  );
  const e = d.especies.find((x) => x.bot === a.especies[0].bot);
  assert.equal(e?.igual, false, 'mismo bot, otro ADN');
  assert.equal(e?.a?.propio, true);
  assert.notEqual(e?.a?.hash, e?.b?.hash);
  assert.equal(d.total, 1);
  const igual = diferenciasConfig(
    { escenario: a, semilla: 1, eventos: [] },
    { escenario: structuredClone(a), semilla: 1, eventos: [] },
  );
  assert.equal(igual.total, 0);
  // Sin ADN propio: el hash guardado.
  const c = structuredClone(SOPA);
  c.especies[1] = { ...c.especies[1], hash: 'deadbeef' };
  const dc = diferenciasConfig(
    { escenario: SOPA, semilla: 1, eventos: [] },
    { escenario: c, semilla: 1, eventos: [] },
  );
  assert.equal(dc.especies.find((x) => x.bot === c.especies[1].bot)?.b?.hash, 'deadbeef');
});

test('textos de error con código (y el genérico si no hay clave)', () => {
  /** @type {Record<string, string>} */
  const dic = {
    'comparar.error.tiempo': 'no respondió',
    'comparar.error.escritura': 'no se guardó: {detalle}',
    'comparar.trabajos.error': 'Error: {detalle}',
  };
  const t = (/** @type {string} */ k, /** @type {any} */ p = {}) =>
    (dic[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(p[n] ?? ''));
  assert.equal(textoError(t, 'tiempo', 'tiempo'), 'no respondió');
  assert.equal(textoError(t, 'escritura', 'escritura: disco lleno'), 'no se guardó: disco lleno');
  assert.equal(textoError(t, 'rara', 'rara: x'), 'Error: rara: x');
  assert.equal(textoError(t, undefined, 'boom'), 'Error: boom');
  assert.equal(detalleError('desfase: 5 ≠ 6', 'desfase'), '5 ≠ 6');
});

test('vistaParams: lo necesario para listar, sin ADN ni escenario', () => {
  const v = vistaParams(
    /** @type {any} */ ({
      escenario: SOPA,
      adn: ['x'],
      semillas: [1, 2],
      eventos: [{ ciclo: 1 }],
      ciclos: 10,
      cada: 5,
      metrica: 'vivos',
      maxPuntos: 500,
      origen: { nombre: 'o', id: 'c' },
    }),
  );
  assert.deepEqual(v, {
    semillas: [1, 2],
    ciclos: 10,
    cada: 5,
    metrica: 'vivos',
    origen: { nombre: 'o', id: 'c' },
  });
});

test('diferenciasConfig con una corrida sin escenario (.dbsim importado)', () => {
  const d = diferenciasConfig(
    { escenario: SOPA, semilla: 5, eventos: [] },
    { escenario: null, semilla: null, eventos: [] },
  );
  assert.equal(d.escenario.igual, false);
  assert.ok(d.opciones.length > 100);
  assert.ok(d.opciones.every((o) => o.b === undefined));
  assert.ok(d.especies.every((e) => e.b === null));
});

test('valorParametro y objetoTexto', () => {
  assert.deepEqual(valorParametro('opt:2', 1), { tipo: 'bool', on: true });
  assert.deepEqual(valorParametro('base:minVegs', 12), { tipo: 'num', v: 12 });
  assert.deepEqual(valorParametro('base:minVegs', undefined), { tipo: 'nada' });
  assert.equal(objetoTexto({ tipo: 'forma', ancho: 0.2, alto: 0.1 }), 'forma:0.2:0.1');
  assert.equal(objetoTexto({ tipo: 'formas', ancho: 0.2, alto: 0.1 }), 'formas:0.2:0.1');
});

test('escalas del gráfico', () => {
  assert.equal(pasoRedondo(100), 50);
  assert.equal(pasoRedondo(7), 2);
  assert.equal(pasoRedondo(0), 1);
  const y = ejeY(3, 97, 10, 200);
  assert.equal(y.lo, 0);
  assert.equal(y.hi, 100);
  assert.equal(y.a(100), 10);
  assert.equal(y.a(0), 210);
  assert.deepEqual(
    y.marcas.map((m) => m.v),
    [0, 50, 100],
  );
  const yn = ejeY(-5, 5, 0, 100);
  assert.ok(yn.lo <= -5 && yn.hi >= 5);
  assert.equal(ejeY(4, 4, 0, 10).hi, 4);
  assert.equal(ejeY(0, 0, 0, 10).hi > 0, true, 'serie plana en 0');
  const x = escalaX(0, 1000, 50, 500);
  assert.equal(x.a(500), 300);
  assert.equal(x.marcas.length, 3);
  assert.equal(escalaX(7, 7, 0, 10).marcas.length, 1);
});

test('fuentes: actual, guardada y serie con banda', async () => {
  const h = new Historia();
  const metrics = new Float32Array(METRICAS.length);
  metrics[2] = 9;
  h.agregar({ ciclo: 0, metrics });
  const nucleo = {
    estado: { escenario: SOPA, semilla: 3, nombre: '', eventos: [{ ciclo: 1 }] },
    historia: h,
  };
  const fa = /** @type {any} */ (fuenteActual(/** @type {any} */ (nucleo), 'Actual'));
  assert.equal(fa.nombre, 'Actual');
  assert.equal(fa.historia, h);
  assert.deepEqual(fa.eventos, [{ ciclo: 1 }]);
  assert.equal(fuenteActual(null, 'x'), null);
  const corridas = {
    cargar: async (/** @type {string} */ id) =>
      id === 'c1'
        ? {
            corrida: { nombre: 'G', escenario: SOPA, semilla: 8, eventos: [] },
            extra: { historia: h.serializar() },
          }
        : null,
  };
  const fg = await fuenteGuardada(corridas, 'c1');
  assert.equal(fg?.semilla, 8);
  assert.deepEqual(serieBanda(/** @type {any} */ (fg).historia, 'vivos').media, [9]);
  assert.equal(await fuenteGuardada(corridas, 'no'), null);
  assert.deepEqual(serieBanda(h, 'nada'), { t: [], media: [], bajo: [], alto: [] });
});

test('paraleloDe: núcleos − 1, al menos 1, con tope (por defecto 8)', () => {
  assert.equal(paraleloDe(8), 7);
  assert.equal(paraleloDe(8, 3), 3);
  assert.equal(paraleloDe(8, 20), 7);
  assert.equal(paraleloDe(1), 1);
  assert.equal(paraleloDe(undefined), 1);
  assert.equal(paraleloDe(16), TOPE_POR_DEFECTO);
  assert.equal(paraleloDe(128), TOPE_POR_DEFECTO);
  assert.equal(paraleloDe(128, 20), 20, 'configurable por encima del de por defecto');
  assert.equal(paraleloDe(128, 999), TOPE_MAX);
  assert.equal(paraleloDe(8, 0), 7);
});

/** Worker de mentira: contesta ready (o error) al crearse. @param {'ready' | 'error'} [como] */
function falso(como = 'ready') {
  /** @type {Set<(m: any) => void>} */
  const oyentes = new Set();
  const w = {
    terminado: false,
    canal: {
      enviar: () => {},
      on: (/** @type {(m: any) => void} */ fn) => {
        oyentes.add(fn);
        return () => oyentes.delete(fn);
      },
    },
    terminar: () => {
      w.terminado = true;
    },
  };
  setTimeout(() => {
    for (const fn of [...oyentes]) fn(como === 'ready' ? { t: 'ready' } : { t: 'error', msg: 'x' });
  }, 1);
  return w;
}

test('pool: crea a pedido, reutiliza, descarta y cierra los ociosos', async () => {
  /** @type {any[]} */
  const creados = [];
  const pool = new PoolWorkers({
    crear: () => {
      const w = falso();
      creados.push(w);
      return w;
    },
    ociosoMs: 20,
  });
  const a = await pool.tomar();
  const b = await pool.tomar();
  assert.equal(creados.length, 2);
  pool.soltar(a);
  const c = await pool.tomar();
  assert.equal(c, a, 'reutiliza el libre');
  pool.descartar(b);
  assert.equal(creados[1].terminado, true);
  pool.soltar(c);
  assert.equal(pool.tamaño, 1);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(pool.tamaño, 0, 'cerró el ocioso');
  assert.equal(creados[0].terminado, true);

  const malo = new PoolWorkers({ crear: () => falso('error'), ociosoMs: 0 });
  await assert.rejects(malo.tomar(), (e) => /** @type {any} */ (e).codigo === 'carga');
  assert.equal(malo.tamaño, 0);
  const ctl = new AbortController();
  ctl.abort();
  await assert.rejects(pool.tomar(ctl.signal), (e) => /** @type {any} */ (e).codigo === 'abortada');
});

test('claves de i18n armadas con plantilla en Comparar y la lista de trabajos', () => {
  for (const l of ['es', 'en']) {
    const c = JSON.parse(
      readFileSync(new URL(`../src/i18n/${l}/comparar.json`, import.meta.url), 'utf8'),
    );
    const a = JSON.parse(
      readFileSync(new URL(`../src/i18n/${l}/analizar.json`, import.meta.url), 'utf8'),
    );
    const x = JSON.parse(
      readFileSync(new URL(`../src/i18n/${l}/experimentar.json`, import.meta.url), 'utf8'),
    );
    const faltan = [];
    for (const e of ESTADOS) if (!c[`comparar.trabajos.estado.${e}`]) faltan.push(e);
    for (const u of ['pendiente', 'corriendo', 'hecha', 'fallida'])
      if (!c[`comparar.trabajos.unidad.${u}`]) faltan.push(u);
    // Los códigos de ErrorReplicas, ErrorReplica (src/lib/trabajos/replica.js)
    // y ErrorCola que llegan a la interfaz.
    for (const k of [
      'sin-escenario',
      'n',
      'ciclos',
      'cada',
      'sin-adn',
      'metrica',
      'semilla',
      'carga',
      'worker',
      'tiempo',
      'desfase',
      'abortada',
      'escritura',
      'tipo',
      'unidades',
      'orden-eventos',
      'indice',
      'sin-duena',
      'detenida',
      'accion',
    ])
      if (!c[`comparar.error.${k}`]) faltan.push(k);
    // Claves con plural (clavePlural: .uno / .otros).
    for (const k of [
      'comparar.dif.cuantas',
      'comparar.dif.opcionesIguales',
      'comparar.rep.titulo',
      'comparar.rep.grafico',
      'comparar.chip.enCurso',
      'comparar.chip.avisos',
    ])
      for (const f of ['uno', 'otros']) if (!c[`${k}.${f}`]) faltan.push(`${k}.${f}`);
    for (const f of FORMAS_LABERINTO)
      if (!x[`experimentar.laberinto.${f}`]) faltan.push(`laberinto.${f}`);
    for (const [g, ms] of Object.entries(GRUPOS_COMPARAR)) {
      if (!a[`analizar.grupo.${g}`]) faltan.push(g);
      for (const m of ms) if (!a[`analizar.m.g.${m}`]) faltan.push(m);
    }
    assert.deepEqual(faltan, [], l);
  }
});
