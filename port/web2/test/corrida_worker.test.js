// @ts-check
// La corrida de la interfaz (src/lib/sim/corrida-nucleo.js) contra
// engine/worker.js REAL (paso N1.7):
//   - C15 de punta a punta: iniciar(escenario, semilla) en una sesión que ya
//     corrió otra cosa da el mismo .dbsim que en una sesión nueva (antes el
//     núcleo perdía `limpio` al reenviar el reset).
//   - Retomar tras recargar la página (RV-40): guardar, abrir una sesión
//     nueva (worker recién creado, sin el ADN de nada), cargar y seguir N
//     ciclos da lo mismo que cargar y seguir en la sesión original. La
//     diferencia entre las dos es el ADN de las especies, que el .dbsim no
//     trae: la sesión nueva lo recibe por dna-missing → dna-lib. Control:
//     sin responder el dna-missing, la sesión nueva diverge.
// Misma fecha en los workers (strSimStart va en el .dbsim) y distinto
// Math.random.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { almacenMemoria } from '../engine/almacen.js';
import { crearCorridas } from '../engine/corridas.js';
import { escenarioFabrica } from '../engine/escenarios/fabrica.js';
import { estadoVacio, NucleoCorrida } from '../src/lib/sim/corrida-nucleo.js';
import { hayWasm, SIN_WASM, WEB } from './util/dbcore-node.js';
import { sesionNode } from './util/sesion-node.js';

const BOTS = JSON.parse(fs.readFileSync(path.join(WEB, 'bots', 'bots.json'), 'utf8'));
/** @param {{bot: string}} s */
const adnBestiario = async (s) => {
  const b = BOTS.find((/** @type {any} */ x) => x.name === s.bot);
  return b ? fs.readFileSync(path.join(WEB, 'bots', b.file), 'utf8') : undefined;
};

const FECHA = Date.UTC(2026, 2, 3, 9, 30, 0);
const SKIP = { skip: hayWasm() ? false : SIN_WASM, timeout: 300000 };

/** @param {Awaited<ReturnType<typeof sesionNode>>} sesion @param {ReturnType<typeof crearCorridas>} corridas */
function nucleo(sesion, corridas) {
  return new NucleoCorrida({
    sesion: /** @type {any} */ (sesion),
    corridas,
    estado: estadoVacio(),
    idioma: () => 'es',
    adnDe: adnBestiario,
  });
}

/** @param {Awaited<ReturnType<typeof sesionNode>>} s @param {number} n */
async function seguir(s, n) {
  s.pasos(n);
  const { bytes } = await s.guardarConCiclo();
  return Buffer.from(bytes);
}

/** @param {Buffer} a @param {Buffer} b */
function primeraDiferencia(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

const esc = (/** @type {string} */ id) =>
  /** @type {import('../engine/escenarios/index.js').Escenario} */ (escenarioFabrica(id));

test('iniciar(escenario, semilla) en una sesión usada = en una sesión nueva', SKIP, async () => {
  const [usada, nueva] = await Promise.all([
    sesionNode({ fechaFija: FECHA, semillaAzar: 99 }),
    sesionNode({ fechaFija: FECHA, semillaAzar: 1 }),
  ]);
  try {
    const corridas = crearCorridas({ almacen: almacenMemoria() });
    const nu = nucleo(usada, corridas);
    const nn = nucleo(nueva, corridas);
    // la sesión usada: otro escenario, formas, teleporter, un rato de sim
    await nu.iniciar(esc('archipielago'), 5);
    usada.c.enviar({ t: 'shape', dw: 0.1, dh: 0.1 });
    usada.c.enviar({ t: 'teleporter' });
    usada.c.enviar({ t: 'f1-popcap', n: 3 });
    await seguir(usada, 80);
    const [okU, okN] = await Promise.all([
      nu.iniciar(esc('laberinto'), 777),
      nn.iniciar(esc('laberinto'), 777),
    ]);
    assert.ok(okU && okN);
    const [a, b] = await Promise.all([seguir(usada, 200), seguir(nueva, 200)]);
    assert.ok(a.length > 1000);
    assert.equal(primeraDiferencia(a, b), -1, `.dbsim distinto (${a.length} vs ${b.length})`);
  } finally {
    usada.cerrar();
    nueva.cerrar();
  }
});

test(
  'retomar en una sesión nueva: el ADN llega por dna-missing y la corrida sigue igual',
  SKIP,
  async () => {
    const corridas = crearCorridas({ almacen: almacenMemoria() });
    const original = await sesionNode({ fechaFija: FECHA, semillaAzar: 3 });
    let nueva = await sesionNode({ fechaFija: FECHA, semillaAzar: 4 });
    let control = await sesionNode({ fechaFija: FECHA, semillaAzar: 5 });
    try {
      const no = nucleo(original, corridas);
      await no.iniciar(esc('sopa-primordial'), 2024);
      await no.sembrar({
        nombre: 'Sembrada en caliente',
        adn: /** @type {string} */ (
          await adnBestiario({ bot: 'Animal Minimalis (4G)(Numsgil)-10.03.05' })
        ),
        cantidad: 3,
        color: '#b04aff',
        vegetal: false,
      });
      original.pasos(300);
      const { id } = await no.guardar('Para retomar');
      const guardada = /** @type {any} */ (await corridas.cargar(id));
      assert.ok(guardada.corrida.ciclo > 0);

      // «recargar la página»: worker nuevo, núcleo nuevo, mismo almacén
      const nn = nucleo(nueva, corridas);
      /** @type {string[]} */
      let pedidas = [];
      nueva.c.on('dna-missing', (m) => {
        pedidas = m.names;
      });
      const r = await nn.cargar(id);
      assert.ok(r);
      assert.ok(pedidas.includes('Sembrada en caliente.txt'), `pedidas: ${pedidas}`);
      assert.ok(pedidas.includes('Alga minimalis 3.0.txt'), `pedidas: ${pedidas}`);
      // Muchos vegetales de piso: la repoblación siembra desde el ADN de la
      // especie (lo que el .dbsim no trae), así el ADN pesa en lo que sigue.
      nueva.c.setbase({ minVegs: 150 });
      const retomada = await seguir(nueva, 400);

      // la sesión original carga lo mismo (ya conoce el ADN) y sigue igual
      await no.cargar(id);
      original.c.setbase({ minVegs: 150 });
      const enOriginal = await seguir(original, 400);
      assert.equal(
        primeraDiferencia(retomada, enOriginal),
        -1,
        `.dbsim distinto (${retomada.length} vs ${enOriginal.length})`,
      );

      // control: la misma carga sin responder el dna-missing diverge
      await control.cargar(/** @type {ArrayBuffer} */ (guardada.dbsim));
      control.c.setbase({ minVegs: 150 });
      const sinAdn = await seguir(control, 400);
      assert.notEqual(primeraDiferencia(sinAdn, enOriginal), -1, 'el ADN tiene que importar');
    } finally {
      original.cerrar();
      nueva.cerrar();
      control.cerrar();
      nueva = control = /** @type {any} */ (null);
    }
  },
);

test(
  'decisión 13: cambios y siembras en caliente con la sim corriendo; la réplica los repite en el mismo ciclo',
  SKIP,
  async () => {
    const corridas = crearCorridas({ almacen: almacenMemoria() });
    const [a, b] = await Promise.all([
      sesionNode({ fechaFija: FECHA, semillaAzar: 11 }),
      sesionNode({ fechaFija: FECHA, semillaAzar: 12 }),
    ]);
    try {
      const n = nucleo(a, corridas);
      await n.iniciar(esc('sopa-primordial'), 4321);
      // Espera a que la sim, corriendo, avance hasta pasar `n` ciclos más
      // (sin depender del tiempo: la máquina puede estar cargada).
      const avanzar = async (/** @type {number} */ n) => {
        const meta = (await a.c.ciclo()) + n;
        while (a.stats.cycle < meta) await new Promise((r) => setTimeout(r, 5));
      };
      a.c.speed(5);
      a.correr(true);
      await avanzar(40);
      // un cambio en caliente con la sim corriendo, registrado en su ciclo exacto
      const c1 = await a.aplicarEnCiclo([{ t: 'setopt', id: 33, v: 1 }]);
      n.registrarCambio({ 'opt:33': 1 }, c1);
      await avanzar(25);
      await n.sembrar({
        nombre: 'Tardía',
        adn: /** @type {string} */ (await adnBestiario({ bot: 'Alga minimalis 3.0' })),
        cantidad: 4,
        color: '#e0b020',
        vegetal: true,
      });
      await avanzar(25);
      const c3 = await a.aplicarEnCiclo([{ t: 'setbase', vals: { minVegs: 40 } }]);
      n.registrarCambio({ 'base:minVegs': 40 }, c3);
      a.correr(false);
      const fin = (await a.c.ciclo()) + 50;
      a.pasos(fin - (await a.c.ciclo()));
      const original = Buffer.from((await a.guardarConCiclo()).bytes);
      const eventos = n.mensajesEventos();
      assert.equal(eventos.length, 3);
      const ciclos = eventos.map((e) => e.ciclo);
      assert.ok(
        ciclos[0] > 0 && ciclos[0] < ciclos[1] && ciclos[1] < ciclos[2],
        `ciclos ${ciclos}`,
      );

      // réplica: mismo escenario y semilla; cada evento en su ciclo
      const r = nucleo(b, corridas);
      await r.iniciar(esc('sopa-primordial'), 4321);
      for (const ev of eventos) {
        b.pasos(ev.ciclo - (await b.c.ciclo()));
        for (const m of ev.mensajes) b.c.enviar(m);
      }
      b.pasos(fin - (await b.c.ciclo()));
      const replica = Buffer.from((await b.guardarConCiclo()).bytes);
      assert.equal(primeraDiferencia(original, replica), -1, 'la réplica no dio lo mismo');
    } finally {
      a.cerrar();
      b.cerrar();
    }
  },
);
