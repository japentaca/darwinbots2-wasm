// @ts-check
// «Probar» del editor de ADN (decisión 18; src/lib/trabajos/prueba.js) con
// el worker real (engine/worker.js en worker_threads) y la cola
// (engine/cola.js + ejecutor 'prueba' + pool):
//
//   1. Determinista: el mismo trabajo dos veces da los mismos resultados.
//   2. Las dos versiones corren con LAS MISMAS semillas: si la «anterior»
//      es el mismo ADN, cada semilla da lo mismo en las dos.
//   3. Mide lo que dice: las copias fundadoras son N, los vivos y la
//      energía salen de la especie de la prueba, y un bot que no se mueve ni
//      come (solo) se extingue antes que uno que se reproduce.
//   4. El trabajo guardado trae {clave, hash, lg, adn} y el historial del
//      bot (engine/biblioteca.js historialBot) lo encuentra.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { hashAdn, lgHash } from '../engine/adn.js';
import { almacenMemoria } from '../engine/almacen.js';
import { historialBot } from '../engine/biblioteca.js';
import { Cola, leerResultados } from '../engine/cola.js';
import { ejecutores } from '../src/lib/trabajos/ejecutores.js';
import { PoolWorkers } from '../src/lib/trabajos/pool.js';
import {
  ALGA,
  crearParamsPrueba,
  ErrorPrueba,
  escenarioPrueba,
  resumenPrueba,
  TIPO_PRUEBA,
  unidadesPrueba,
  unidadPrueba,
  vistaPrueba,
} from '../src/lib/trabajos/prueba.js';
import { workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
/** @param {string} nombre */
const adnDe = (nombre) =>
  fs.readFileSync(
    path.join(WEB, 'bots', BOTS.find((/** @type {any} */ b) => b.name === nombre).file),
    'utf8',
  );
const ANIMAL = adnDe('Animal Minimalis (4G)(Numsgil)-10.03.05');
const ALGA_ADN = adnDe(ALGA);
// uno que se reproduce en cuanto puede
const REPRO = "' repro\ncond\n*.robage 20 >\nstart\n50 .repro store\nstop\n";
// un bot que no hace nada: vive de la energía inicial
const QUIETO = "' quieto\ncond\n*.nrg 0 <\nstart\n1 .up store\nstop\n";

function workerTrabajo() {
  const w = workerEngine();
  return {
    canal: {
      enviar: (/** @type {any} */ m) => w.postMessage(m),
      on: (/** @type {(m: any) => void} */ fn) => {
        w.on('message', fn);
        return () => {
          w.off('message', fn);
        };
      },
      alError: (/** @type {(e: any) => void} */ fn) => {
        w.on('error', fn);
        return () => {
          w.off('error', fn);
        };
      },
    },
    terminar: () => {
      void w.terminate();
    },
  };
}

test('parámetros de la prueba: unidades, semillas compartidas, vista sin ADN y errores', () => {
  const p = crearParamsPrueba({
    clave: 'p:0123456789abcdef',
    nombre: 'Mi bot',
    adn: ANIMAL,
    version: 3,
    anterior: { adn: QUIETO, version: 2 },
    copias: 5,
    ciclos: 250,
    semillas: 3,
    adnAlga: ALGA_ADN,
  });
  assert.equal(p.hash, hashAdn(ANIMAL));
  assert.equal(p.lg, lgHash(ANIMAL));
  assert.equal(unidadesPrueba(p), 6);
  for (let i = 0; i < 3; i++) {
    assert.equal(unidadPrueba(p, i).version, 'actual');
    assert.equal(unidadPrueba(p, i + 3).version, 'anterior');
    assert.equal(unidadPrueba(p, i).semilla, unidadPrueba(p, i + 3).semilla, 'mismas semillas');
  }
  assert.equal(new Set(p.semillas).size, 3);
  const v = vistaPrueba(p);
  assert.ok(!JSON.stringify(v).includes('.up store'), 'la vista no copia el ADN');
  assert.equal(v.anterior?.version, 2);
  const esc = escenarioPrueba(p, ANIMAL);
  assert.deepEqual(
    esc.especies.map((s) => [s.bot, s.cantidad, s.vegetal]),
    [
      [ALGA, 15, true],
      ['prueba', 5, false],
    ],
  );
  assert.equal(esc.opciones.base, 'f1', 'F1 por defecto');
  assert.equal(v.base, 'f1', 'la base queda en la vista (historial)');
  const solo = crearParamsPrueba({ clave: 'x', nombre: 'x', adn: ANIMAL, modo: 'solo' });
  assert.equal(solo.alga, null);
  assert.equal(unidadesPrueba(solo), 3);
  assert.equal(escenarioPrueba(solo, ANIMAL).especies.length, 1);
  /** @param {string} c */
  const con = (c) => (/** @type {any} */ e) => e instanceof ErrorPrueba && e.codigo === c;
  assert.throws(() => crearParamsPrueba({ clave: 'x', nombre: 'x', adn: ' ' }), con('adn'));
  assert.throws(() => crearParamsPrueba({ clave: 'x', nombre: 'x', adn: ANIMAL }), con('alga'));
  assert.throws(
    () => crearParamsPrueba({ clave: 'x', nombre: 'x', adn: ANIMAL, modo: 'solo', copias: 0 }),
    con('copias'),
  );
  assert.throws(
    () => crearParamsPrueba({ clave: 'x', nombre: 'x', adn: ANIMAL, modo: 'otro' }),
    con('modo'),
  );
  // resumen: medias por versión
  const r = resumenPrueba(p, [
    /** @type {any} */ ({
      version: 'actual',
      fundadores: 5,
      fundadoresVivos: 4,
      nacidos: 10,
      hijosDirectos: 5,
      vivos: 12,
      nrg: 1200,
    }),
    /** @type {any} */ ({
      version: 'actual',
      fundadores: 5,
      fundadoresVivos: 2,
      nacidos: 0,
      vivos: 0,
      nrg: 0,
    }),
    /** @type {any} */ ({
      version: 'anterior',
      fundadores: 5,
      fundadoresVivos: 5,
      nacidos: 5,
      vivos: 5,
      nrg: 500,
    }),
    null,
  ]);
  assert.deepEqual(r.actual, {
    n: 2,
    copias: 5,
    sobreviven: 3,
    hijosPorCopia: 0.5,
    nacidosPorCopia: 1,
    vivos: 6,
    energiaMedia: 100,
    extinciones: 1,
  });
  assert.equal(r.anterior?.hijosPorCopia, 1, 'sin hijosDirectos (trabajos viejos): los nacidos');
  assert.equal(r.version, 3);
  assert.equal(r.versionAnterior, 2);
});

/** Corre un trabajo de prueba en una cola nueva y devuelve {fin, res, almacen}. @param {any} p */
async function correr(p) {
  const almacen = almacenMemoria();
  const pool = new PoolWorkers({ crear: workerTrabajo, ociosoMs: 0 });
  const cola = new Cola({ almacen, ejecutores: ejecutores({ pool }), paralelo: 2 });
  try {
    const id = await cola.encolar({ tipo: TIPO_PRUEBA, params: p, unidades: unidadesPrueba(p) });
    const fin = await cola.esperar(id);
    assert.equal(fin?.estado, 'terminado', fin?.error);
    const res = await leerResultados(almacen, /** @type {any} */ (fin));
    return { fin, res, almacen, id };
  } finally {
    cola.detener();
    pool.cerrarTodos();
  }
}

test('Probar con el worker real: determinista, mismas semillas en las dos versiones, historial', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const p = crearParamsPrueba({
    clave: 'p:00112233445566ff',
    nombre: 'Mi animal',
    adn: ANIMAL,
    version: 2,
    anterior: { adn: ANIMAL, version: 1 },
    copias: 6,
    ciclos: 400,
    semillas: 2,
    semilla: 4242,
    adnAlga: ALGA_ADN,
  });
  const a = await correr(p);
  const b = await correr(p);
  assert.deepEqual(a.res, b.res, 'determinista');
  assert.deepEqual(a.fin?.resumen, b.fin?.resumen);
  for (const r of a.res) {
    assert.equal(r.fundadores, 6, 'las copias fundadoras');
    assert.equal(r.ciclo, 400, 'termina en el objetivo');
    assert.equal(r.serie[r.serie.length - 1][0], 400);
    assert.ok(r.vivos > 0 && r.nrg > 0);
    assert.ok(r.fundadoresVivos <= r.fundadores);
    assert.ok(r.hijosDirectos <= r.nacidos, 'los hijos directos son parte de los nacidos');
  }
  // misma semilla, mismo ADN: la anterior da lo mismo que la actual
  for (let i = 0; i < 2; i++) {
    const { version: _a, ...x } = a.res[i];
    const { version: _b, ...y } = a.res[i + 2];
    assert.deepEqual(x, y, `semilla ${p.semillas[i]} igual en las dos versiones`);
  }
  assert.deepEqual(a.fin?.resumen.actual, a.fin?.resumen.anterior);
  // semillas distintas, mundos distintos
  assert.notDeepEqual(a.res[0].serie, a.res[1].serie);

  // El trabajo guardado lleva {clave, hash, lg, adn}: el historial lo encuentra.
  const t = await a.almacen.get('trabajos', a.id);
  assert.equal(t.params.hash, hashAdn(ANIMAL));
  assert.equal(t.params.lg, lgHash(ANIMAL));
  assert.equal(t.params.adn, ANIMAL);
  const h = await historialBot(a.almacen, {
    clase: 'propio',
    clave: 'p:00112233445566ff',
    nombre: 'Mi animal',
    lgs: [],
  });
  assert.deepEqual(
    h.pruebas.map((x) => x.id),
    [a.id],
  );
  const hLg = await historialBot(a.almacen, {
    clase: 'foro',
    clave: 'ffffffffffffffff',
    nombre: 'otro',
    lgs: [lgHash(ANIMAL)],
  });
  assert.equal(hLg.pruebas.length, 1, 'también por lgHash del ADN');
});

test('Probar distingue versiones: un bot quieto no deja hijos y uno que se reproduce sí', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 600000,
}, async () => {
  const p = crearParamsPrueba({
    clave: 'p:0000000000000001',
    nombre: 'Quieto',
    adn: QUIETO,
    anterior: { adn: REPRO, version: 1 },
    copias: 4,
    ciclos: 1000,
    semillas: 1,
    adnAlga: ALGA_ADN,
  });
  const { res, fin } = await correr(p);
  assert.equal(res[0].version, 'actual');
  assert.equal(res[0].nacidos, 0, 'el quieto no se reproduce');
  assert.equal(res[0].fundadores, 4);
  assert.equal(res[1].version, 'anterior');
  assert.equal(res[1].semilla, res[0].semilla);
  assert.ok(res[1].nacidos > 0, 'el que se reproduce deja hijos con la misma semilla');
  assert.ok(res[1].hijosDirectos > 0 && res[1].hijosDirectos <= res[1].nacidos);
  assert.equal(res[0].hijosDirectos, 0);
  assert.ok(res[1].vivos > res[0].vivos);
  assert.equal(fin?.resumen.actual.hijosPorCopia, 0);
  assert.ok(fin?.resumen.anterior.hijosPorCopia > 0);
});
