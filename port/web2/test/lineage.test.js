// @ts-check
// Genealogía (engine/lineage.js, decisión 9, C7) con árboles armados a mano:
// poda a los ancestros de los vivos, árbol de especies, fotos del ADN
// dominante y comparación gen por gen.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffGenes, genesAdn, Linaje } from '../engine/lineage.js';
import { FLAG_LINAJE, N_LINAJE } from '../engine/metricas.js';

/**
 * Filas de db_sim_dump_lineage armadas a mano.
 * @param {[abs: number, parent: number, especie: number, opciones?: {muerto?: boolean,
 *   nacido?: number, gen?: number}][]} bots
 */
function filas(bots) {
  const out = new Int32Array(bots.length * N_LINAJE);
  bots.forEach(([abs, parent, especie, o = {}], i) => {
    out.set(
      [
        abs,
        parent,
        especie,
        o.gen ?? 0,
        0,
        o.nacido ?? 0,
        10,
        o.muerto ? FLAG_LINAJE.cadaver : 0,
        0,
        0,
        1,
        0,
      ],
      i * N_LINAJE,
    );
  });
  return out;
}

const NOMBRES = ['Alga.txt', 'Animal.txt', 'Corpse'];

test('poda: quedan los vivos y sus ancestros; las ramas muertas se descartan', () => {
  const l = new Linaje();
  // 1 → 2 → 4 (vivo); 1 → 3 (muere sin hijos); 5 fundador vivo
  l.agregarLinaje(0, {
    filas: filas([
      [1, 0, 1],
      [5, 0, 0],
    ]),
    nombres: NOMBRES,
  });
  l.agregarLinaje(100, {
    // 2 y 3 nacieron; 1 ya murió y es cadáver (especie Corpse = índice 2)
    filas: filas([
      [1, 0, 2, { muerto: true }],
      [2, 1, 1, { nacido: 50 }],
      [3, 1, 1, { nacido: 60 }],
      [5, 0, 0],
    ]),
    nombres: NOMBRES,
  });
  // 4 nació y 2 murió entre muestras: el worker lo manda en `nacidos`
  l.agregarLinaje(200, {
    filas: filas([
      [4, 2, 1, { nacido: 150 }],
      [5, 0, 0],
    ]),
    nacidos: filas([[4, 2, 1, { nacido: 150 }]]),
    nombres: NOMBRES,
  });
  assert.deepEqual([...l.vivos].sort(), [4, 5]);
  assert.deepEqual([...l.individuos.keys()].sort(), [1, 2, 4, 5], '3 no es ancestro de nadie vivo');
  assert.deepEqual(
    l.ancestros(4).map((x) => x.abs),
    [4, 2, 1],
  );
  assert.equal(
    l.individuos.get(1)?.especie,
    'Animal',
    'el cadáver conserva la especie con que se lo vio vivo',
  );
  assert.deepEqual([...(l.hijos().get(1) ?? [])], [2]);
});

test('poda: un ancestro que nunca se vio deja un hueco (la cadena se corta)', () => {
  const l = new Linaje();
  l.agregarLinaje(0, { filas: filas([[10, 0, 0]]), nombres: NOMBRES });
  // 12 es nieto de 10, pero 11 (su madre) nació y murió sin que se lo viera
  l.agregarLinaje(100, { filas: filas([[12, 11, 0]]), nombres: NOMBRES });
  assert.deepEqual(
    l.ancestros(12).map((x) => x.abs),
    [12],
  );
  assert.equal(l.individuos.get(12)?.parent, 11, 'conserva el AbsNum de la madre');
  assert.ok(!l.individuos.has(10), '10 ya no es ancestro conocido de un vivo');
});

test('árbol de especies: raíces, hijas con profundidad, madre completada con los individuos', () => {
  const l = new Linaje();
  const nombres = ['A', 'B', 'C', 'D'];
  // origen: [índice, ciclo, primerAbs, madreAbs, especieMadre]
  l.agregarLinaje(0, {
    filas: filas([
      [1, 0, 0],
      [2, 1, 0],
    ]),
    origen: Int32Array.from([0, 0, 1, 0, -1]),
    nombres,
  });
  l.agregarLinaje(100, {
    filas: filas([
      [1, 0, 0],
      [3, 1, 1],
    ]),
    origen: Int32Array.from([0, 0, 1, 0, -1, 1, 80, 3, 1, 0]),
    nombres,
  });
  // C nace de un B (abs 3) que ya murió: el core no sabe la especie madre (-1),
  // pero el linaje conoce a 3 (especie B).
  l.agregarLinaje(200, {
    filas: filas([
      [1, 0, 0],
      [3, 1, 1],
      [4, 3, 2],
    ]),
    origen: Int32Array.from([0, 0, 1, 0, -1, 1, 80, 3, 1, 0, 2, 150, 4, 3, -1, 3, 160, 9, 0, -1]),
    nombres,
  });
  const arbol = l.arbolEspecies();
  assert.deepEqual(
    arbol.map((r) => r.nombre),
    ['A', 'D'],
  );
  const a = arbol[0];
  assert.deepEqual(
    a.hijas.map((/** @type {any} */ h) => h.nombre),
    ['B'],
  );
  assert.deepEqual(
    a.hijas[0].hijas.map((/** @type {any} */ h) => h.nombre),
    ['C'],
  );
  assert.equal(l.especies.get('C')?.madre, 'B');
  assert.equal(l.especies.get('B')?.ciclo, 80);
  // una madre que formaría un ciclo no se acepta
  l.agregarOrigen(Int32Array.from([0, 0, 1, 0, 2]), nombres);
  assert.equal(l.especies.get('A')?.madre, null);
});

test('sin autoespeciación (C7): todas las especies son raíces', () => {
  const l = new Linaje();
  l.agregarLinaje(0, {
    filas: filas([
      [1, 0, 0],
      [2, 0, 1],
    ]),
    origen: Int32Array.from([0, 0, 1, 0, -1, 1, 0, 2, 0, -1]),
    nombres: NOMBRES,
  });
  assert.deepEqual(
    l.arbolEspecies().map((e) => [e.nombre, e.hijas.length]),
    [
      ['Alga', 0],
      ['Animal', 0],
    ],
  );
});

test('fotos del ADN dominante: solo cuando cambia; la del fundador se conserva', () => {
  const l = new Linaje({ maxFotos: 4 });
  const d = (/** @type {number} */ h) => [
    { nombre: 'X.txt', hash: h, copias: 3, adnLen: 5, abs: 1, adn: `' ${h}\nend` },
  ];
  l.agregarDominantes(0, d(1));
  l.agregarDominantes(100, d(1));
  l.agregarDominantes(200, [{ nombre: 'X', hash: 2, copias: 1, adnLen: 5, abs: 2 }]); // sin texto: no hay foto
  assert.equal(l.fotos.get('X')?.length, 1);
  for (let h = 2; h <= 7; h++) l.agregarDominantes(h * 100, d(h));
  const fs = /** @type {any[]} */ (l.fotos.get('X'));
  assert.ok(fs.length <= 4);
  assert.equal(fs[0].hash, 1, 'fundador');
  assert.equal(fs.at(-1).hash, 7, 'la última');
  const { fundador, actual } = l.fundadorYActual('X.txt');
  assert.equal(fundador?.ciclo, 0);
  assert.equal(actual?.hash, 7);
});

test('recortar y serializar: el linaje vuelve igual', () => {
  const l = new Linaje();
  l.agregarLinaje(0, {
    filas: filas([
      [1, 0, 0],
      [2, 1, 0, { nacido: 0 }],
    ]),
    origen: Int32Array.from([0, 0, 1, 0, -1]),
    nombres: NOMBRES,
  });
  l.agregarLinaje(300, {
    filas: filas([
      [2, 1, 0],
      [7, 2, 1, { nacido: 250 }],
    ]),
    origen: Int32Array.from([0, 0, 1, 0, -1, 1, 250, 7, 2, 0]),
    nombres: NOMBRES,
  });
  l.agregarDominantes(300, [
    { nombre: 'Alga', hash: 5, copias: 1, adnLen: 3, abs: 2, adn: 'cond start stop' },
  ]);
  const o = structuredClone(l.serializar());
  assert.ok(o.individuos instanceof Int32Array);
  const g = Linaje.deserializar(o);
  assert.deepEqual([...g.individuos.entries()], [...l.individuos.entries()]);
  assert.deepEqual([...g.especies.entries()], [...l.especies.entries()]);
  assert.deepEqual([...g.vivos], [...l.vivos]);
  assert.deepEqual([...g.fotos.entries()], [...l.fotos.entries()]);
  g.recortar(200);
  assert.ok(!g.individuos.has(7), 'nacido después');
  assert.ok(!g.especies.has('Animal'), 'registrada después');
  assert.equal(g.fotos.size, 0);
});

test('genesAdn: como CountGenes/GeneEnd del core (cond absorbe el primer start/else; stop cierra)', () => {
  const adn = `' comentario
def x 50
cond
*.eye5 0 >
start
10 .up store
else
20 .dn store
stop
start
1 .shoot store
cond *.nrg 100 < start 5 .dx store stop
suelto
end
cond nunca`;
  const { genes, fuera } = genesAdn(adn);
  assert.deepEqual(
    genes.map((g) => g.join(' ')),
    [
      'cond *.eye5 0 > start 10 .up store',
      'else 20 .dn store stop',
      'start 1 .shoot store',
      'cond *.nrg 100 < start 5 .dx store stop',
    ],
  );
  assert.deepEqual(fuera, ['def', 'x', '50', 'suelto']);
});

test('diffGenes: iguales, cambiados, agregados y quitados, en orden', () => {
  const fundador = `cond a start 1 stop
cond b start 2 stop
cond c start 3 stop
end`;
  const hoy = `cond a start 1 stop
cond b start 99 stop
cond nuevo start 7 stop
cond c start 3 stop
cond d start 4 stop
end`;
  const d = diffGenes(fundador, hoy);
  assert.deepEqual(
    d.cambios.map((c) => [c.tipo, c.a, c.b]),
    [
      ['igual', 0, 0],
      ['cambiado', 1, 1],
      ['agregado', null, 2],
      ['igual', 2, 3],
      ['agregado', null, 4],
    ],
  );
  assert.deepEqual([d.iguales, d.cambiados, d.agregados, d.quitados], [2, 1, 2, 0]);
  const inversa = diffGenes(hoy, fundador);
  assert.deepEqual(
    [inversa.iguales, inversa.cambiados, inversa.agregados, inversa.quitados],
    [2, 1, 0, 2],
  );
  const mismo = diffGenes(fundador, `' otro comentario\n${fundador}`);
  assert.equal(mismo.iguales, 3, 'los comentarios no cuentan');
  assert.equal(mismo.cambios.length, 3);
});

test('fotos: tope de bytes de ADN entre todas las especies (el fundador se conserva siempre)', () => {
  const l = new Linaje({ maxBytesFotos: 20000 });
  const adn = (/** @type {number} */ h, /** @type {number} */ n) => `${h} `.padEnd(n, 'x');
  // 4 especies × 30 cambios de 500 B = 60 KB sin tope
  for (let c = 0; c < 30; c++)
    l.agregarDominantes(
      c * 100,
      ['A', 'B', 'C', 'D'].map((nombre, i) => ({
        nombre,
        hash: c * 10 + i + 1,
        copias: 1,
        adnLen: 1,
        abs: 1,
        adn: adn(c * 10 + i + 1, 500),
      })),
    );
  assert.ok(l.bytesFotos() <= 20000, `${l.bytesFotos()}`);
  for (const nombre of ['A', 'B', 'C', 'D']) {
    const { fundador, actual } = l.fundadorYActual(nombre);
    assert.equal(fundador?.ciclo, 0, `${nombre}: fundador`);
    assert.equal(actual?.ciclo, 2900, `${nombre}: la última`);
  }
  // serializa el tope
  assert.equal(Linaje.deserializar(structuredClone(l.serializar())).maxBytesFotos, 20000);
  // muchas especies de dos fotos: pierden la última; los fundadores quedan
  const m = new Linaje({ maxBytesFotos: 4096 });
  for (const c of [0, 100])
    m.agregarDominantes(
      c,
      Array.from({ length: 10 }, (_, i) => ({
        nombre: `E${i}`,
        hash: c + i + 1,
        copias: 1,
        adnLen: 1,
        abs: 1,
        adn: adn(c + i, 300),
      })),
    );
  assert.ok(m.bytesFotos() <= 4096);
  for (let i = 0; i < 10; i++) assert.equal(m.fundadorYActual(`E${i}`).fundador?.ciclo, 0);
  // solo fundadores que ya pasan el tope: se quedan todos
  const f = new Linaje({ maxBytesFotos: 1024 });
  f.agregarDominantes(
    0,
    Array.from({ length: 5 }, (_, i) => ({
      nombre: `F${i}`,
      hash: i + 1,
      copias: 1,
      adnLen: 1,
      abs: 1,
      adn: adn(i, 400),
    })),
  );
  assert.equal(f.fotos.size, 5);
  assert.equal(f.bytesFotos(), 2000);
});
