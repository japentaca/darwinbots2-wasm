// @ts-check
// engine/cola.js: cola genérica de trabajos persistente (decisiones 10 y 23)
// con ejecutores de mentira y el almacén en memoria; ColaCompartida (C20)
// con dos pestañas sobre el mismo almacén, un lock y un canal simulados.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import {
  Cola,
  ColaCompartida,
  crearTrabajo,
  ErrorCola,
  idResultado,
  NOMBRE_LOCK,
  ST_TRABAJOS,
} from '../engine/cola.js';

/**
 * Ejecutor controlable: cada unidad espera a que el test la libere (o
 * termina sola con `auto`). Registra cada arranque.
 * @param {{auto?: boolean, falla?: (i: number) => boolean}} [o]
 */
function ejecutorManual(o = {}) {
  /** @type {{id: string, i: number, ctx: any, liberar: (v?: any) => void, fallar: (e: Error) => void}[]} */
  const corriendo = [];
  /** @type {string[]} */
  const arranques = [];
  return {
    corriendo,
    arranques,
    ej: {
      /** @param {any} t @param {number} i @param {any} ctx */
      unidad(t, i, ctx) {
        arranques.push(`${t.id}#${i}`);
        if (o.falla?.(i)) return Promise.reject(new Error(`falla ${i}`));
        if (o.auto) {
          ctx.progreso(0.5);
          return Promise.resolve({ i, v: t.params.base + i });
        }
        return new Promise((res, rej) => {
          const r = {
            id: t.id,
            i,
            ctx,
            liberar: (/** @type {any} */ v) => res(v ?? { i, v: t.params.base + i }),
            fallar: rej,
          };
          corriendo.push(r);
          ctx.senal.addEventListener('abort', () => rej(new Error('abortada')));
        });
      },
      /** @param {any} _t @param {any[]} datos */
      final: (_t, datos) => ({ suma: datos.reduce((s, d) => s + d.v, 0) }),
    },
  };
}

/** Espera a que se cumpla una condición (microtareas y timers). @param {() => boolean} f */
async function hasta(f) {
  for (let k = 0; k < 200; k++) {
    if (f()) return;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error('no se cumplió');
}

let n = 0;
const nuevoId = () => `t${++n}`;

test('encolar, correr en paralelo con tope, resultados, resumen y aviso al terminar', async () => {
  const almacen = almacenMemoria();
  const m = ejecutorManual();
  /** @type {any[]} */
  const terminados = [];
  /** @type {any[][]} */
  const cambios = [];
  const cola = new Cola({
    almacen,
    ejecutores: { x: m.ej },
    paralelo: 2,
    nuevoId,
    guardarCadaMs: 0,
    alTerminar: (t) => terminados.push(t),
    alCambio: () => cambios.push(cola.lista()),
  });
  await assert.rejects(cola.encolar({ tipo: 'nada', params: {}, unidades: 1 }), ErrorCola);
  await assert.rejects(cola.encolar({ tipo: 'x', params: {}, unidades: 0 }), ErrorCola);
  const id = await cola.encolar({ tipo: 'x', params: { base: 10 }, unidades: 3, titulo: 'T' });
  await hasta(() => m.corriendo.length === 2);
  assert.equal(cola.enCurso, 2);
  assert.equal(cola.trabajo(id)?.estado, 'corriendo');
  m.corriendo[0].ctx.progreso(0.25);
  assert.equal(cola.trabajo(id)?.unidades[0].progreso, 0.25);
  await cola.sincronizar();
  const guardado = await almacen.get(ST_TRABAJOS, id);
  assert.equal(guardado.unidades[0].progreso, 0.25, 'progreso persistido');
  m.corriendo[1].liberar();
  await hasta(() => m.corriendo.length === 3);
  assert.deepEqual(await cola.resultados(id), [null, { i: 1, v: 11 }, null]);
  m.corriendo[0].liberar();
  m.corriendo[2].liberar();
  const fin = await cola.esperar(id);
  assert.equal(fin?.estado, 'terminado', fin?.error);
  assert.deepEqual(fin?.resumen, { suma: 33 });
  assert.equal(terminados.length, 1);
  assert.equal(terminados[0].id, id);
  assert.ok(cambios.length > 3);
  // El índice 'estado' lista trabajos, no resultados.
  const r = await almacen.porIndice(ST_TRABAJOS, 'estado', 'terminado');
  assert.deepEqual(
    r.map((x) => x.id),
    [id],
  );
  assert.equal((await almacen.get(ST_TRABAJOS, idResultado(id, 2))).datos.v, 12);
  await cola.marcarVisto(id);
  assert.equal(cola.trabajo(id)?.visto, 1);
});

test('FIFO entre trabajos y tope total de unidades', async () => {
  const m = ejecutorManual();
  const cola = new Cola({
    almacen: almacenMemoria(),
    ejecutores: { x: m.ej },
    paralelo: 3,
    nuevoId,
  });
  const a = await cola.encolar({ tipo: 'x', params: { base: 0 }, unidades: 2 });
  const b = await cola.encolar({ tipo: 'x', params: { base: 0 }, unidades: 2 });
  await hasta(() => m.corriendo.length === 3);
  assert.deepEqual(m.arranques, [`${a}#0`, `${a}#1`, `${b}#0`]);
  cola.paralelo = 4;
  await hasta(() => m.corriendo.length === 4);
  for (const r of m.corriendo) r.liberar();
  await Promise.all([cola.esperar(a), cola.esperar(b)]);
});

test('sobrevive a una recarga: no repite lo hecho y reinicia lo interrumpido desde cero', async () => {
  const almacen = almacenMemoria();
  const m1 = ejecutorManual();
  const cola1 = new Cola({
    almacen,
    ejecutores: { x: m1.ej },
    paralelo: 2,
    nuevoId,
    guardarCadaMs: 0,
  });
  const id = await cola1.encolar({ tipo: 'x', params: { base: 100 }, unidades: 4 });
  await hasta(() => m1.corriendo.length === 2);
  m1.corriendo[0].ctx.progreso(0.7);
  m1.corriendo[0].liberar(); // unidad 0 hecha
  await hasta(() => m1.corriendo.length === 3);
  m1.corriendo[1].ctx.progreso(0.9); // unidad 1 a medias
  await cola1.sincronizar();
  // «Recarga»: la página muere (nada más se escribe) y otra cola abre el mismo almacén.
  cola1.detener();
  const antes = await almacen.get(ST_TRABAJOS, id);
  assert.equal(antes.unidades[0].estado, 'hecha');
  assert.equal(antes.unidades[1].estado, 'corriendo');

  const m2 = ejecutorManual({ auto: true });
  /** @type {any[]} */
  const terminados = [];
  const cola2 = new Cola({
    almacen,
    ejecutores: { x: m2.ej },
    paralelo: 2,
    nuevoId,
    alTerminar: (t) => terminados.push(t),
  });
  await cola2.reanudar();
  await cola2.reanudar(); // idempotente
  const fin = await cola2.esperar(id);
  assert.equal(fin?.estado, 'terminado');
  assert.deepEqual(m2.arranques.sort(), [`${id}#1`, `${id}#2`, `${id}#3`], 'la hecha no se repite');
  assert.deepEqual(fin?.resumen, { suma: 100 + 101 + 102 + 103 });
  assert.equal(terminados.length, 1);
});

test('cancelar, reintentar y borrar', async () => {
  const almacen = almacenMemoria();
  const m = ejecutorManual();
  const cola = new Cola({ almacen, ejecutores: { x: m.ej }, paralelo: 1, nuevoId });
  const id = await cola.encolar({ tipo: 'x', params: { base: 1 }, unidades: 2 });
  await hasta(() => m.corriendo.length === 1);
  m.corriendo[0].liberar();
  await hasta(() => m.corriendo.length === 2);
  assert.equal(await cola.cancelar(id), true);
  assert.equal(await cola.cancelar(id), false);
  const c = cola.trabajo(id);
  assert.equal(c?.estado, 'cancelado');
  assert.deepEqual(
    c?.unidades.map((u) => u.estado),
    ['hecha', 'pendiente'],
  );
  assert.equal(cola.enCurso, 0);
  // Una respuesta tardía de la unidad abortada no cuenta.
  m.corriendo[1].liberar({ i: 1, v: 999 });
  await hasta(async () => true);
  assert.equal(cola.trabajo(id)?.unidades[1].estado, 'pendiente');
  assert.equal(await cola.reintentar(id), true);
  await hasta(() => m.corriendo.length === 3);
  assert.equal(m.corriendo[2].i, 1);
  m.corriendo[2].liberar();
  const fin = await cola.esperar(id);
  assert.deepEqual(fin?.resumen, { suma: 1 + 2 });
  assert.equal(await cola.reintentar(id), false);
  await cola.borrar(id);
  assert.equal(cola.trabajo(id), undefined);
  assert.equal(await almacen.get(ST_TRABAJOS, id), undefined);
  assert.equal(await almacen.get(ST_TRABAJOS, idResultado(id, 0)), undefined);
});

test('una unidad que falla deja el trabajo fallido; reintentar repite solo lo que falta', async () => {
  const almacen = almacenMemoria();
  const m = ejecutorManual();
  /** @type {any[]} */
  const terminados = [];
  const cola = new Cola({
    almacen,
    ejecutores: { x: m.ej },
    paralelo: 3,
    nuevoId,
    alTerminar: (t) => terminados.push(t),
  });
  const id = await cola.encolar({ tipo: 'x', params: { base: 0 }, unidades: 3 });
  await hasta(() => m.corriendo.length === 3);
  m.corriendo[0].liberar();
  await hasta(() => cola.trabajo(id)?.unidades[0].estado === 'hecha');
  m.corriendo[2].fallar(new Error('falla 2'));
  const f = await cola.esperar(id);
  assert.equal(f?.estado, 'fallido');
  assert.match(String(f?.error), /falla 2/);
  assert.deepEqual(
    f?.unidades.map((u) => u.estado),
    ['hecha', 'pendiente', 'fallida'],
    'la otra en curso se abortó y vuelve a pendiente',
  );
  assert.equal(terminados.length, 1);
  assert.equal(cola.enCurso, 0);
  await cola.reintentar(id);
  await hasta(() => m.corriendo.length === 5);
  assert.deepEqual(m.arranques.slice(3).sort(), [`${id}#1`, `${id}#2`]);
  m.corriendo[3].liberar();
  m.corriendo[4].liberar();
  const fin = await cola.esperar(id);
  assert.equal(fin?.estado, 'terminado');
  assert.equal(terminados.length, 2);
});

test('un ejecutor que falla al arrancar deja el trabajo fallido', async () => {
  const m = ejecutorManual({ falla: (i) => i === 0 });
  const cola = new Cola({ almacen: almacenMemoria(), ejecutores: { x: m.ej }, nuevoId });
  const id = await cola.encolar({ tipo: 'x', params: { base: 0 }, unidades: 2 });
  const f = await cola.esperar(id);
  assert.equal(f?.estado, 'fallido');
  assert.equal(f?.unidades[0].estado, 'fallida');
});

test('la copia del trabajo se arma dentro de la escritura: dos unidades que terminan juntas no se pisan', async () => {
  const base = almacenMemoria();
  // tx lenta: la primera escritura tarda y la segunda unidad termina mientras tanto.
  /** @type {any} */
  const almacen = {
    ...base,
    tx: async (/** @type {any} */ st, /** @type {any} */ fn) => {
      await new Promise((r) => setTimeout(r, 15));
      return base.tx(st, fn);
    },
  };
  const m = ejecutorManual();
  const cola = new Cola({ almacen, ejecutores: { x: m.ej }, paralelo: 2, nuevoId });
  const id = await cola.encolar({ tipo: 'x', params: { base: 0 }, unidades: 3 });
  await hasta(() => m.corriendo.length === 2);
  m.corriendo[0].liberar();
  m.corriendo[1].liberar();
  await hasta(() => m.corriendo.length === 3);
  await hasta(() => cola.trabajo(id)?.unidades[1].estado === 'hecha');
  await cola.sincronizar();
  const g = await base.get(ST_TRABAJOS, id);
  assert.deepEqual(
    g.unidades.slice(0, 2).map((/** @type {any} */ u) => u.estado),
    ['hecha', 'hecha'],
    'la segunda escritura no pisa la primera',
  );
  cola.detener();
});

test('si no se puede escribir un resultado: el trabajo falla (código escritura) y se abortan las demás', async () => {
  const base = almacenMemoria();
  let fallar = false;
  /** @type {any} */
  const almacen = {
    ...base,
    tx: (/** @type {any} */ st, /** @type {any} */ fn) =>
      fallar ? Promise.reject(new Error('disco lleno')) : base.tx(st, fn),
  };
  const m = ejecutorManual();
  /** @type {any[]} */
  const terminados = [];
  const cola = new Cola({
    almacen,
    ejecutores: { x: m.ej },
    paralelo: 2,
    nuevoId,
    alTerminar: (t) => terminados.push(t),
  });
  const id = await cola.encolar({ tipo: 'x', params: { base: 0 }, unidades: 3 });
  await hasta(() => m.corriendo.length === 2);
  fallar = true;
  m.corriendo[0].liberar();
  const f = await cola.esperar(id);
  assert.equal(f?.estado, 'fallido');
  assert.equal(f?.codigo, 'escritura');
  assert.match(String(f?.error), /disco lleno/);
  assert.deepEqual(
    f?.unidades.map((u) => u.estado),
    ['fallida', 'pendiente', 'pendiente'],
  );
  assert.equal(f?.unidades[0].codigo, 'escritura');
  assert.equal(cola.enCurso, 0, 'la otra unidad se abortó');
  assert.equal(terminados.length, 1);
  assert.equal((await base.get(ST_TRABAJOS, id)).estado, 'fallido');
});

test('el código del error de una unidad se guarda (la interfaz lo traduce)', async () => {
  const cola = new Cola({
    almacen: almacenMemoria(),
    ejecutores: {
      x: {
        unidad: () => Promise.reject(Object.assign(new Error('tiempo'), { codigo: 'tiempo' })),
      },
    },
    nuevoId,
  });
  const id = await cola.encolar({ tipo: 'x', params: {}, unidades: 1 });
  const f = await cola.esperar(id);
  assert.equal(f?.codigo, 'tiempo');
  assert.equal(f?.unidades[0].codigo, 'tiempo');
  await cola.cancelar(id);
  cola.detener();
});

test('se guardan como mucho maxGuardados trabajos cerrados (y todos los activos)', async () => {
  const almacen = almacenMemoria();
  let reloj = Date.UTC(2026, 0, 1);
  const m = ejecutorManual({ auto: true });
  const cola = new Cola({
    almacen,
    ejecutores: { x: m.ej },
    nuevoId,
    maxGuardados: 2,
    reloj: () => {
      reloj += 1000;
      return new Date(reloj);
    },
  });
  /** @type {string[]} */
  const ids = [];
  for (let k = 0; k < 4; k++) {
    const id = await cola.encolar({ tipo: 'x', params: { base: k }, unidades: 2 });
    await cola.esperar(id);
    ids.push(id);
  }
  await cola.sincronizar();
  await hasta(() => cola.lista().length === 2);
  assert.deepEqual(
    cola.lista().map((t) => t.id),
    ids.slice(2),
    'quedan los dos más recientes',
  );
  for (const id of ids.slice(0, 2)) {
    assert.equal(await almacen.get(ST_TRABAJOS, id), undefined);
    assert.equal(await almacen.get(ST_TRABAJOS, idResultado(id, 0)), undefined);
  }
  // Uno activo no cuenta ni se borra.
  const m2 = ejecutorManual();
  const cola2 = new Cola({ almacen, ejecutores: { x: m2.ej }, nuevoId, maxGuardados: 0 });
  const activo = await cola2.encolar({ tipo: 'x', params: { base: 0 }, unidades: 1 });
  await cola2.sincronizar();
  assert.deepEqual(
    cola2.lista().map((t) => t.id),
    [activo],
  );
  cola2.detener();
});

test('lista() usa la vista del ejecutor (sin el ADN) y trabajo() da la copia completa', async () => {
  const m = ejecutorManual();
  const ej = { ...m.ej, vista: (/** @type {any} */ p) => ({ base: p.base }) };
  const cola = new Cola({ almacen: almacenMemoria(), ejecutores: { x: ej }, nuevoId });
  const id = await cola.encolar({
    tipo: 'x',
    params: { base: 1, adn: ['x'.repeat(10000)] },
    unidades: 1,
  });
  assert.deepEqual(cola.lista()[0].params, { base: 1 });
  assert.equal(cola.trabajo(id)?.params.adn[0].length, 10000);
  cola.detener();
});

test('adoptar: toma un trabajo escrito por otra pestaña; uno borrado no vuelve', async () => {
  const almacen = almacenMemoria();
  const m = ejecutorManual({ auto: true });
  const cola = new Cola({ almacen, ejecutores: { x: m.ej }, nuevoId });
  await cola.reanudar();
  const t = crearTrabajo(
    { tipo: 'x', params: { base: 5 }, unidades: 2 },
    { ejecutores: { x: m.ej }, nuevoId },
  );
  await almacen.put(ST_TRABAJOS, t);
  assert.equal(await cola.adoptar(t.id), true);
  assert.equal(await cola.adoptar(t.id), false, 'una sola vez');
  const fin = await cola.esperar(t.id);
  assert.deepEqual(fin?.resumen, { suma: 11 });
  await cola.borrar(t.id);
  // Otra pestaña lo vuelve a escribir (una copia vieja): no resucita.
  await almacen.put(ST_TRABAJOS, t);
  assert.equal(await cola.adoptar(t.id), false);
  assert.equal(cola.trabajo(t.id), undefined);
  assert.throws(
    () => crearTrabajo({ tipo: 'y', params: {}, unidades: 1 }, { ejecutores: {} }),
    ErrorCola,
  );
});

// ---- Varias pestañas (C20) ------------------------------------------------------

/** Canal de difusión en memoria (como BroadcastChannel: no se entrega a sí mismo). */
function hubDifusion() {
  /** @type {Set<any>} */
  const canales = new Set();
  return () => {
    /** @type {Set<(e: {data: any}) => void>} */
    const oyentes = new Set();
    const c = {
      /** @param {any} m */
      postMessage(m) {
        const data = structuredClone(m);
        for (const otro of canales) if (otro !== c) setTimeout(() => otro.entregar(data), 0);
      },
      /** @param {'message'} _t @param {(e: {data: any}) => void} h */
      addEventListener(_t, h) {
        oyentes.add(h);
      },
      /** @param {any} data */
      entregar(data) {
        if (canales.has(c)) for (const h of oyentes) h({ data });
      },
      close() {
        canales.delete(c);
      },
    };
    canales.add(c);
    return c;
  };
}

/** navigator.locks simulado: un lock exclusivo por nombre, en orden de pedido. */
function locksSimulados() {
  /** @type {Map<string, {ocupado: boolean, espera: (() => void)[]}>} */
  const locks = new Map();
  return {
    /** @param {string} nombre @param {(l: any) => Promise<any>} fn */
    request(nombre, fn) {
      let l = locks.get(nombre);
      if (!l) {
        l = { ocupado: false, espera: [] };
        locks.set(nombre, l);
      }
      const lock = l;
      return new Promise((res, rej) => {
        const correr = () => {
          lock.ocupado = true;
          Promise.resolve()
            .then(() => fn({ name: nombre }))
            .then(res, rej)
            .finally(() => {
              lock.ocupado = false;
              lock.espera.shift()?.();
            });
        };
        if (lock.ocupado) lock.espera.push(correr);
        else correr();
      });
    },
  };
}

/**
 * Una pestaña: ColaCompartida con su ejecutor manual.
 * @param {any} almacen @param {any} locks @param {() => any} canal @param {string} nombre
 */
function pestana(almacen, locks, canal, nombre) {
  const m = ejecutorManual();
  /** @type {{t: any, propia: boolean}[]} */
  const terminados = [];
  const c = new ColaCompartida({
    almacen,
    ejecutores: { x: { ...m.ej, vista: (/** @type {any} */ p) => ({ base: p.base }) } },
    locks,
    canal,
    paralelo: 2,
    nuevoId: () => `${nombre}${++n}`,
    guardarCadaMs: 0,
    refrescoMs: 0,
    plazoMs: 300,
    alTerminar: (t, propia) => terminados.push({ t, propia }),
  });
  return { c, m, terminados };
}

test('C20: una sola pestaña ejecuta la cola; la otra ve el estado y le manda sus acciones', async () => {
  const almacen = almacenMemoria();
  const locks = locksSimulados();
  const canal = hubDifusion();
  const A = pestana(almacen, locks, canal, 'a');
  const B = pestana(almacen, locks, canal, 'b');
  await A.c.iniciar();
  await A.c.esperarDuena();
  await B.c.iniciar();
  assert.equal(A.c.duena, true);
  assert.equal(B.c.duena, false);

  // B encola: lo corre A (el ejecutor de B nunca arranca).
  const id = await B.c.encolar({ tipo: 'x', params: { base: 10, adn: ['largo'] }, unidades: 3 });
  await hasta(() => A.m.corriendo.length === 2);
  assert.equal(B.m.arranques.length, 0);
  await hasta(() => B.c.lista().find((t) => t.id === id)?.estado === 'corriendo');
  assert.deepEqual(B.c.lista()[0].params, { base: 10 }, 'lista liviana');

  // B cancela y reintenta: lo hace A.
  assert.equal(await B.c.cancelar(id), true);
  assert.equal(A.c.cola?.trabajo(id)?.estado, 'cancelado');
  await hasta(() => B.c.lista()[0]?.estado === 'cancelado');
  assert.equal(await B.c.reintentar(id), true);
  await hasta(() => A.m.corriendo.length === 4);
  A.m.corriendo[2].liberar();
  A.m.corriendo[3].liberar();
  await hasta(() => A.m.corriendo.length === 5);
  A.m.corriendo[4].liberar();
  await hasta(() => B.terminados.length === 1);
  assert.equal(B.terminados[0].propia, false, 'la otra pestaña no notifica');
  assert.equal(A.terminados[0].propia, true);
  assert.equal(B.terminados[0].t.estado, 'terminado');
  // Los resultados los lee cualquiera del almacén.
  await hasta(() => !!B.c.lista()[0]?.unidades.every((u) => u.estado === 'hecha'));
  assert.deepEqual(
    (await B.c.resultados(id)).map((d) => d.v),
    [10, 11, 12],
  );
  assert.equal(await B.c.marcarVisto(id), true);
  assert.equal(A.c.cola?.trabajo(id)?.visto, 1);

  // Borrar desde B: no resucita aunque llegue tarde el resultado de una unidad.
  const id2 = await B.c.encolar({ tipo: 'x', params: { base: 0 }, unidades: 1 });
  await hasta(() => A.m.corriendo.length === 6);
  await B.c.borrar(id2);
  A.m.corriendo[5].liberar();
  await new Promise((r) => setTimeout(r, 20));
  await A.c.cola?.sincronizar();
  assert.equal(await almacen.get(ST_TRABAJOS, id2), undefined);
  assert.equal(A.c.cola?.trabajo(id2), undefined);
  await hasta(() => !B.c.lista().some((t) => t.id === id2));
  // Un aviso «nuevo» viejo del mismo id tampoco lo trae.
  assert.equal(await A.c.cola?.adoptar(id2), false);

  A.c.detener();
  B.c.detener();
});

test('C20: si la dueña se va, la otra pestaña toma la cola y la reanuda desde el almacén', async () => {
  const almacen = almacenMemoria();
  const locks = locksSimulados();
  const canal = hubDifusion();
  const A = pestana(almacen, locks, canal, 'a');
  const B = pestana(almacen, locks, canal, 'b');
  await A.c.iniciar();
  await A.c.esperarDuena();
  await B.c.iniciar();
  const id = await A.c.encolar({ tipo: 'x', params: { base: 1 }, unidades: 3 });
  await hasta(() => A.m.corriendo.length === 2);
  A.m.corriendo[0].liberar();
  await hasta(() => A.c.cola?.trabajo(id)?.unidades[0].estado === 'hecha');
  // Se cierra A (pagehide): suelta el lock al terminar sus escrituras.
  A.c.detener();
  await B.c.esperarDuena();
  assert.equal(B.c.duena, true);
  await hasta(() => B.m.corriendo.length === 2);
  assert.deepEqual(B.m.arranques.sort(), [`${id}#1`, `${id}#2`], 'la hecha no se repite');
  // A ya no escribe: su unidad en vuelo termina tarde y no pisa nada.
  A.m.corriendo[1].liberar();
  for (const r of B.m.corriendo) r.liberar();
  const fin = await B.c.cola?.esperar(id);
  assert.equal(fin?.estado, 'terminado');
  assert.deepEqual(fin?.resumen, { suma: 1 + 2 + 3 });
  B.c.detener();
});

test('C20: una acción sin dueña que conteste falla con sin-duena; sin locks, ejecuta igual', async () => {
  const almacen = almacenMemoria();
  const canal = hubDifusion();
  // Una «dueña» colgada: tiene el lock y no contesta.
  const locks = locksSimulados();
  void locks.request(NOMBRE_LOCK, () => new Promise(() => {}));
  const B = pestana(almacen, locks, canal, 'b');
  await B.c.iniciar();
  assert.equal(B.c.duena, false);
  await assert.rejects(B.c.cancelar('nada'), (e) => /** @type {any} */ (e).codigo === 'sin-duena');
  // Encolar no necesita a la dueña: queda en el almacén para la próxima.
  const id = await B.c.encolar({ tipo: 'x', params: { base: 0 }, unidades: 1 });
  assert.equal((await almacen.get(ST_TRABAJOS, id)).estado, 'pendiente');
  B.c.detener();

  const C = pestana(almacen, null, canal, 'c');
  await C.c.iniciar();
  assert.equal(C.c.duena, true, 'sin locks: ejecuta igual');
  await hasta(() => C.m.corriendo.length === 1);
  assert.equal(C.m.arranques[0], `${id}#0`, 'retoma lo que quedó en el almacén');
  C.c.detener();
});
