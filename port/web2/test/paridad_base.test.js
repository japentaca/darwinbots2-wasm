// @ts-check
// Paridad de las bases de escenario con la clásica (port/web/, congelada):
//  - base 'clasica' = collectOptions() de la clásica con el panel sin tocar,
//    el objeto ENTERO (nombradas, opts, costs y campo) con deepStrictEqual;
//  - base 'f1' = collectOptions() tras applyF1Settings(), salvo las dos
//    diferencias documentadas en engine/opciones.js: opt:1 (Toroidal = True
//    del original, que la clásica no escribe) y los costos que el panel no
//    muestra (la clásica los manda en vivo con setcost antes del reinicio:
//    se comprueba que son esos, con los mismos valores);
//  - el .dbsim: la clásica (port/web/worker.js) reiniciada con su
//    collectOptions y una especie, contra engine/worker.js con aplicar() del
//    escenario equivalente (base clásica + la misma especie), 300 ciclos:
//    byte a byte.
// La clásica corre en un vm (test/util/clasica-vm.js).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aplicar, normalizar } from '../engine/escenarios/index.js';
import { opcionesReset, valoresResueltos } from '../engine/opciones.js';
import { cssToVbColor } from '../engine/partido.js';
import { ClienteSim, workerEngine, workerWeb } from './util/arnes-worker.js';
import { clasica, plano } from './util/clasica-vm.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';

test('base clásica = collectOptions() de la clásica con el panel sin tocar (objeto entero)', () => {
  const c = clasica();
  assert.deepStrictEqual(
    plano(opcionesReset(valoresResueltos('clasica'))),
    plano(c.ev('collectOptions()')),
  );
});

test('base F1 = applyF1Settings() + collectOptions(), salvo las diferencias documentadas', () => {
  const c = clasica();
  c.ev('applyF1Settings()');
  const clas = plano(c.ev('collectOptions()'));
  const nueva = plano(opcionesReset(valoresResueltos('f1')));
  // 1) Toroidal = True (OptionsForm.frm:2621): la nueva lo manda, la clásica no
  assert.equal(nueva.opts[1], 1);
  assert.equal(clas.opts[1], undefined);
  delete nueva.opts[1];
  // 2) los costos 1..70 que el panel no muestra: la clásica los manda en vivo
  const envivo = new Map(
    c.enviados.filter((m) => m.t === 'setcost').map((m) => [String(m.i), m.v]),
  );
  for (const i of Object.keys(nueva.costs))
    if (!(i in clas.costs)) {
      assert.equal(envivo.get(i), nueva.costs[i], `costo ${i}: el setcost en vivo de la clásica`);
      delete nueva.costs[i];
    }
  assert.deepStrictEqual(nueva, clas);
});

test('.dbsim idéntico: clásica vs aplicar() con base clásica, 300 ciclos', {
  skip: !hayWasm() && SIN_WASM,
  timeout: 300000,
}, async () => {
  process.chdir(WEB); // workerWeb resuelve ../build-wasm/ contra el cwd
  const c = clasica();
  const alga = plano(c.ev('PRESETS.alga'));
  const det = { fechaFija: Date.UTC(2026, 0, 15, 13, 2, 3), semillaAzar: 12345 };
  const SEED = 777;
  const esc = normalizar({
    formato: 1,
    id: 'x',
    nombre: 'x',
    opciones: { base: 'clasica' },
    especies: [
      {
        bot: alga.name.replace(/\.txt$/, ''),
        adn: alga.dna,
        cantidad: alga.qty,
        color: alga.color,
        vegetal: alga.veg,
        energia: alga.nrg,
      },
    ],
  });
  const nuevos = aplicar(esc, SEED);
  const viejos = [
    {
      t: 'reset',
      seed: SEED,
      quietF1: false,
      options: plano(c.ev('collectOptions()')),
      species: [
        {
          dna: alga.dna,
          name: alga.name.endsWith('.txt') ? alga.name : `${alga.name}.txt`,
          veg: alga.veg,
          qty: alga.qty,
          nrg: alga.nrg,
          color: cssToVbColor(alga.color),
        },
      ],
    },
  ];
  assert.deepStrictEqual(
    { ...nuevos[1], limpio: undefined, quietF1: false },
    { ...viejos[0], limpio: undefined },
    'mismo reset salvo el indicador limpio',
  );
  const web = new ClienteSim(workerWeb(det));
  const eng = new ClienteSim(workerEngine(det));
  try {
    await Promise.all([web.wait((m) => m.t === 'ready'), eng.wait((m) => m.t === 'ready')]);
    /** @param {ClienteSim} cli @param {any[]} msgs */
    const correr = async (cli, msgs) => {
      for (const m of msgs) cli.send(m);
      for (let i = 0; i < 300; i++) cli.send({ t: 'step' });
      await cli.sync();
      await cli.sync();
      cli.send({ t: 'save' });
      const m = await cli.wait((x) => x.t === 'saved', 120000);
      return Buffer.from(new Uint8Array(m.bytes));
    };
    const [a, b] = await Promise.all([correr(web, viejos), correr(eng, nuevos)]);
    assert.ok(a.length > 1000);
    assert.ok(a.equals(b), `.dbsim distinto (${a.length} vs ${b.length})`);
  } finally {
    await Promise.all([web.stop(), eng.stop()]);
  }
});
