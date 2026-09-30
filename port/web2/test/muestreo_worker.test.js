// @ts-check
// Muestreo de métricas en engine/worker.js (N2.1) con el motor real:
//   - solo lectura (decisión 6): la misma corrida con y sin muestreo (los
//     seis grupos, linaje, ADN dominante y pedidos sueltos de linaje y
//     dominante) da el mismo .dbsim byte a byte tras N ciclos, también tras
//     cargar ese .dbsim y seguir;
//   - forma de las muestras (nombres, «Corpse» fuera, ciclos múltiplos de
//     `cada`, req, acumulador vuelto a encender tras reset y carga);
//   - historia y linaje alimentados con muestras reales: tamaño medido y
//     extrapolado a 50.000 ciclos (criterio del Nivel 2), y la poda.
// Misma fecha en los workers (strSimStart va en el .dbsim).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { aplicar } from '../engine/escenarios/index.js';
import { Historia } from '../engine/history.js';
import { diffGenes, Linaje } from '../engine/lineage.js';
import {
  CAMPOS_COMPORTAMIENTO,
  GRUPOS,
  HISTOGRAMAS,
  IM,
  N_ESPECIE,
  N_LINAJE,
  N_METRICAS,
} from '../engine/metricas.js';
import { ClienteSim, workerEngine } from './util/arnes-worker.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
/** @param {{bot: string}} s */
const adnDe = (s) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};
const FECHA = Date.UTC(2026, 8, 29, 12, 0, 0);
const SKIP = { skip: hayWasm() ? false : SIN_WASM, timeout: 600000 };

const esc = (/** @type {string} */ id) => /** @type {any} */ (escenarioFabrica(id));

async function worker() {
  const c = new ClienteSim(workerEngine({ fechaFija: FECHA, semillaAzar: 3 }), {
    copiarFrames: false,
  });
  await c.wait((m) => m.t === 'ready');
  return c;
}

/** @param {ClienteSim} c @param {string} req */
async function guardar(c, req) {
  c.send({ t: 'save', req });
  const m = await c.wait((x) => x.t === 'saved' && x.req === req, 300000);
  return Buffer.from(new Uint8Array(m.bytes));
}

/** @param {Buffer} a @param {Buffer} b */
function primeraDiferencia(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/** @param {ClienteSim} c */
const muestras = (c) => c.msgs.filter((m) => m.t === 'muestra');

/** Ciclo de la sim en este punto de la cola. @param {ClienteSim} c @param {string} req */
async function cicloDe(c, req) {
  c.send({ t: 'ciclo', req });
  const m = await c.wait((x) => x.t === 'ciclo' && x.req === req, 300000);
  return m.cycle;
}

/** @param {number} ms */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un tramo con run en «Máx.» (speed 0) en los dos workers y después pasos
 * sueltos al que quedó atrás hasta igualar el ciclo. Devuelve el ciclo.
 * @param {ClienteSim[]} cs @param {number} ms @param {string} req
 */
async function tramoMax(cs, ms, req) {
  for (const c of cs) {
    c.send({ t: 'speed', n: 0 });
    c.send({ t: 'run', running: true });
  }
  await esperar(ms);
  for (const c of cs) c.send({ t: 'run', running: false });
  const ciclos = await Promise.all(cs.map((c, i) => cicloDe(c, `${req}${i}`)));
  const fin = Math.max(...ciclos);
  cs.forEach((c, i) => {
    for (let k = ciclos[i]; k < fin; k++) c.send({ t: 'step' });
  });
  const iguales = await Promise.all(cs.map((c, i) => cicloDe(c, `${req}=${i}`)));
  assert.ok(
    iguales.every((x) => x === fin),
    `ciclos ${iguales.join(', ')}`,
  );
  return { antes: Math.min(...ciclos), fin };
}

for (const [id, ciclos] of /** @type {[string, number][]} */ ([
  ['depredador-y-presa', 1200],
  ['archipielago', 800],
])) {
  test(
    `solo lectura: ${id} con y sin muestreo (seis grupos, linaje, dominante) → mismo .dbsim`,
    SKIP,
    async () => {
      const [con, sin] = await Promise.all([worker(), worker()]);
      try {
        const msgs = aplicar(esc(id), 4242, adnDe);
        for (const c of [con, sin]) {
          for (const m of msgs) c.send(m);
          c.send({ t: 'view', rich: false }); // el acumulador anda sin la vista enriquecida
        }
        con.send({ t: 'muestreo', cada: 10, linaje: true, dominante: 3, bins: 16, req: 'a' });
        for (let i = 0; i < ciclos; i++) {
          for (const c of [con, sin]) c.send({ t: 'step' });
          if (i % 97 === 0) {
            con.send({ t: 'linaje', req: i });
            con.send({ t: 'dominante', req: i });
          }
          if (i === ciclos >> 1) con.send({ t: 'view', rich: true }); // vista y acumulador juntos
        }
        // un tramo con run en «Máx.» (el loop de rebanadas, otro camino que step)
        const c0 = await cicloDe(con, 'c0');
        const antesMax = muestras(con).length;
        const { antes, fin } = await tramoMax([con, sin], 1500, 'max');
        assert.ok(antes > c0, `el run avanzó (${c0} → ${antes})`);
        assert.ok(
          muestras(con).length >= antesMax + Math.floor((fin - c0) / 10) - 1,
          'muestreó en Máx.',
        );
        const [a, b] = await Promise.all([guardar(con, 'x'), guardar(sin, 'x')]);
        assert.equal(primeraDiferencia(a, b), -1, `.dbsim distinto (${a.length} vs ${b.length})`);
        assert.ok(muestras(con).length >= ciclos / 10, 'hubo muestras');
        assert.equal(muestras(sin).length, 0);

        // cargar ese .dbsim en los dos y seguir (el muestreo sigue encendido en `con`)
        for (const c of [con, sin]) {
          const copia = new Uint8Array(a).slice();
          c.send({ t: 'load', bytes: copia.buffer, req: 'l' }, [copia.buffer]);
        }
        await Promise.all([con, sin].map((c) => c.wait((m) => m.t === 'loaded' && m.req === 'l')));
        con.send({ t: 'muestreo', cada: 10, linaje: true, dominante: 3, req: 'b' });
        for (let i = 0; i < 300; i++) for (const c of [con, sin]) c.send({ t: 'step' });
        const [a2, b2] = await Promise.all([guardar(con, 'y'), guardar(sin, 'y')]);
        assert.equal(primeraDiferencia(a2, b2), -1, 'tras cargar y seguir');
        assert.ok(!con.error && !sin.error, String(con.error ?? sin.error));
      } finally {
        await Promise.all([con.stop(), sin.stop()]);
      }
    },
  );
}

test(
  'forma de las muestras: nombres, sin Corpse, ciclos, req, acumulador tras reset y carga',
  SKIP,
  async () => {
    const c = await worker();
    try {
      for (const m of aplicar(esc('depredador-y-presa'), 7, adnDe)) c.send(m);
      c.send({ t: 'muestreo', cada: 50, dominante: 2, req: 'r1' });
      for (let i = 0; i < 400; i++) c.send({ t: 'step' });
      await c.sync();
      const ms = muestras(c);
      assert.ok(ms.length >= 8);
      for (const m of ms) {
        assert.equal(m.req, 'r1');
        assert.ok(m.ciclo === ms[0].ciclo || m.ciclo % 50 === 0, `ciclo ${m.ciclo}`);
        assert.ok(m.metrics instanceof Float32Array && m.metrics.length === N_METRICAS);
        assert.equal(m.metrics[IM.ciclo], m.ciclo);
        assert.deepEqual(m.grupos, [...GRUPOS]);
        assert.ok(m.especies.length > 0);
        for (const e of m.especies) {
          assert.ok(e.nombre && !/^corpse$/i.test(e.nombre));
          assert.equal(e.stats.length, N_ESPECIE);
        }
        const vivos = m.especies.reduce(
          (/** @type {number} */ s, /** @type {any} */ e) => s + e.stats[1],
          0,
        );
        assert.equal(vivos, m.metrics[IM.vivos], 'vivos por especie = vivos global');
        assert.equal(m.histogramas.n.length, HISTOGRAMAS.length);
        assert.equal(m.histogramas.datos.length, HISTOGRAMAS.length * 22);
        assert.ok(Array.isArray(m.comportamiento));
        assert.equal(m.linaje, null);
      }
      for (let i = 1; i < ms.length; i++) assert.ok(ms[i].ciclo > ms[i - 1].ciclo);
      // comportamiento: ticks observados entre muestras = `cada`
      const conBeh = ms.slice(1).flatMap((m) => m.comportamiento);
      assert.ok(conBeh.length > 0, 'hubo actividad');
      const iTicks = CAMPOS_COMPORTAMIENTO.indexOf('ticks');
      for (const r of conBeh) assert.equal(r.datos[iTicks], 50);
      // dominante cada 2 muestras; el texto solo cuando cambia
      const dom = ms.filter((m) => m.dominante);
      assert.ok(dom.length >= 4);
      assert.ok(
        dom[0].dominante.every(
          (/** @type {any} */ d) => typeof d.adn === 'string' && d.adn.length > 0,
        ),
      );

      // reset (limpio) con el muestreo encendido: sigue, con el acumulador rearmado
      c.msgs.length = 0;
      for (const m of aplicar(esc('sopa-primordial'), 8, adnDe)) c.send(m);
      for (let i = 0; i < 120; i++) c.send({ t: 'step' });
      await c.sync();
      const tras = muestras(c);
      assert.ok(tras.length >= 2);
      assert.ok(tras.every((m) => m.req === 'r1'));
      assert.ok(
        tras.at(-1).especies.some((/** @type {any} */ e) => /Alga minimalis/.test(e.nombre)),
      );
      assert.ok(
        tras.slice(1).some((m) => m.comportamiento.length > 0),
        'acumulador encendido en el handle nuevo',
      );

      // carga: la tabla de especies se reinicia; el acumulador sigue encendido
      const bytes = await guardar(c, 'g');
      c.msgs.length = 0;
      c.send({
        t: 'load',
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
      });
      for (let i = 0; i < 120; i++) c.send({ t: 'step' });
      await c.sync();
      const trasCarga = muestras(c);
      assert.ok(trasCarga.length >= 2);
      assert.ok(
        trasCarga.at(-1).especies.some((/** @type {any} */ e) => /Alga minimalis/.test(e.nombre)),
      );
      assert.ok(
        trasCarga.slice(1).some((m) => m.comportamiento.length > 0),
        'acumulador tras la carga',
      );

      // apagar
      c.send({ t: 'muestreo', cada: 0 });
      c.msgs.length = 0;
      for (let i = 0; i < 120; i++) c.send({ t: 'step' });
      await c.sync();
      assert.equal(muestras(c).length, 0);

      // pedidos sueltos
      c.send({ t: 'linaje', req: 'L' });
      const l = await c.wait((m) => m.t === 'linaje' && m.req === 'L');
      assert.ok(
        l.filas instanceof Int32Array && l.filas.length % N_LINAJE === 0 && l.filas.length > 0,
      );
      assert.ok(l.origen.length > 0 && Array.isArray(l.nombres));
      c.send({ t: 'dominante', req: 'D' });
      const d = await c.wait((m) => m.t === 'dominante' && m.req === 'D');
      assert.ok(d.especies.length > 0 && d.especies.every((/** @type {any} */ e) => e.adn));
    } finally {
      await c.stop();
    }
  },
);

test(
  'dominante: un pedido suelto entre dos muestras no le quita a la muestra siguiente la foto nueva',
  SKIP,
  async () => {
    const c = await worker();
    try {
      const msgs = aplicar(esc('sopa-primordial'), 5, adnDe);
      for (const m of msgs) c.send(m);
      c.send({ t: 'muestreo', cada: 20, dominante: 1, req: 'd' });
      // el alga con un gen más, sembrada en mayoría a mitad de camino: el
      // ADN dominante de la especie cambia entre dos muestras
      const alga = /** @type {any} */ (msgs.find((m) => m.t === 'reset')).species.find(
        (/** @type {any} */ e) => e.veg,
      );
      // un pedido suelto después de CADA paso: ve todos los cambios antes que la muestra
      for (let i = 0; i < 120; i++) {
        if (i === 50)
          c.send({
            t: 'seed-species',
            sp: {
              ...alga,
              qty: 60,
              dna: `cond
*.nrg 0 >
start
1 .up store
stop
${alga.dna}`,
            },
          });
        c.send({ t: 'step' });
        c.send({ t: 'dominante', req: `s${i}` });
      }
      await c.sync();
      const ms = muestras(c).filter((m) => m.dominante);
      assert.ok(ms.length >= 6);
      const l = new Linaje();
      /** @type {Map<string, number>} */
      const ultimo = new Map();
      let cambios = 0;
      for (const m of ms) {
        l.agregar(m);
        for (const d of m.dominante) {
          if (ultimo.has(d.nombre) && ultimo.get(d.nombre) !== d.hash) cambios++;
          if (ultimo.get(d.nombre) !== d.hash)
            assert.equal(typeof d.adn, 'string', `${d.nombre} en ${m.ciclo}: hash nuevo sin ADN`);
          ultimo.set(d.nombre, d.hash);
        }
      }
      assert.ok(cambios > 0, 'el dominante cambió en la corrida');
      // la foto de cada especie en la corrida es la del último dominante
      for (const [nombre, hash] of ultimo)
        assert.equal(l.fundadorYActual(nombre).actual?.hash, hash, nombre);
      // y los pedidos sueltos siguen trayendo el texto siempre
      const sueltos = c.msgs.filter((m) => m.t === 'dominante');
      assert.equal(sueltos.length, 120);
      assert.ok(sueltos.every((m) => m.especies.every((/** @type {any} */ e) => e.adn)));
    } finally {
      await c.stop();
    }
  },
);

test(
  'consola «cycle N»: muestrea (y junta los nacidos) en cada tick, igual que N pasos',
  SKIP,
  async () => {
    const [a, b] = await Promise.all([worker(), worker()]);
    try {
      for (const c of [a, b]) {
        for (const m of aplicar(esc('sopa-primordial'), 21, adnDe)) c.send(m);
        c.send({ t: 'muestreo', cada: 10, linaje: true, dominante: 2, req: 'k' });
        for (let i = 0; i < 5; i++) c.send({ t: 'step' });
      }
      for (let i = 0; i < 237; i++) a.send({ t: 'step' });
      b.send({ t: 'console-cmd', n: 1, line: 'cycle 237' });
      await Promise.all([a.sync(), b.sync()]);
      const [ma, mb] = [muestras(a), muestras(b)];
      assert.ok(ma.length >= 24);
      assert.deepEqual(
        mb.map((m) => m.ciclo),
        ma.map((m) => m.ciclo),
        'las mismas muestras',
      );
      for (let i = 0; i < ma.length; i++) {
        assert.deepEqual(mb[i].metrics, ma[i].metrics, `métricas en ${ma[i].ciclo}`);
        assert.deepEqual(mb[i].linaje?.nacidos, ma[i].linaje?.nacidos, `nacidos en ${ma[i].ciclo}`);
      }
      assert.ok(
        ma.some((m) => m.linaje?.nacidos.length > 0),
        'hubo nacidos entre muestras',
      );
      const [da, db] = await Promise.all([guardar(a, 'x'), guardar(b, 'x')]);
      assert.equal(primeraDiferencia(da, db), -1, 'el mismo .dbsim');
    } finally {
      await Promise.all([a.stop(), b.stop()]);
    }
  },
);

test(
  'historia y linaje con el motor real: tamaño medido y extrapolado a 50.000 ciclos; poda',
  SKIP,
  async () => {
    const c = await worker();
    try {
      for (const m of aplicar(esc('depredador-y-presa'), 99, adnDe)) c.send(m);
      // cada 10 ciclos: 200 muestras en 2.000 ciclos (= 20.000 ciclos a 100)
      c.send({ t: 'muestreo', cada: 10, linaje: true, dominante: 10, req: 'h' });
      const CICLOS = 2000;
      for (let i = 0; i < CICLOS; i++) c.send({ t: 'step' });
      await c.sync();
      const h = new Historia({ intervalo: 10 });
      const l = new Linaje();
      for (const m of muestras(c)) {
        h.agregar(m);
        l.agregar(m);
      }
      const bytes = h.tamaño();
      const porPunto = bytes / h.puntos;
      const a50k = porPunto * 501;
      console.log(
        `# motor real: ${h.puntos} muestras, ${h.nombresEspecies().length} especies, ` +
          `${(bytes / 1024).toFixed(0)} KB; extrapolado a 501 muestras (50.000 ciclos a 100): ` +
          `${(a50k / 1048576).toFixed(2)} MB; linaje ${l.individuos.size} individuos, ` +
          `${(serializadoBytes(l.serializar()) / 1024).toFixed(0)} KB (fotos de ADN ${(l.bytesFotos() / 1024).toFixed(0)} KB)`,
      );
      assert.ok(h.puntos >= 190);
      assert.ok(a50k <= 5 * 1024 * 1024);
      assert.ok(l.bytesFotos() <= l.maxBytesFotos);
      // linaje: todo vivo está, y su cadena de ancestros termina en un fundador o en un hueco
      const ult = muestras(c).at(-1);
      let conCadena = 0;
      for (const v of l.vivos) {
        assert.ok(l.individuos.has(v));
        const a = l.ancestros(v);
        if (a.length > 1) conCadena++;
        for (let i = 1; i < a.length; i++) assert.equal(a[i - 1].parent, a[i].abs);
      }
      assert.ok(conCadena > 0, 'hay descendientes con ancestros');
      assert.equal(l.vivos.size, ult.metrics[IM.vivos]);
      // podado: ningún individuo muerto sin descendencia viva
      const hijos = l.hijos();
      for (const [abs] of l.individuos)
        assert.ok(l.vivos.has(abs) || hijos.has(abs), `sobra ${abs}`);
      // especies: raíces (sin autoespeciación, C7) y fotos del fundador
      assert.ok(l.arbolEspecies().length >= 2);
      for (const [nombre, fs] of l.fotos) {
        const d = diffGenes(fs[0].adn, fs.at(-1).adn);
        assert.ok(d.genesA.length > 0, `${nombre}: genes del fundador`);
      }
    } finally {
      await c.stop();
    }
  },
);

/** @param {any} o */
function serializadoBytes(o) {
  let b = 0;
  const j = JSON.stringify(o, (_k, v) => {
    if (ArrayBuffer.isView(v)) {
      b += v.byteLength;
      return 0;
    }
    return v;
  });
  return b + j.length;
}
