// @ts-check
// Historia con presupuesto (engine/history.js, decisión 8) con muestras
// armadas a mano, y el criterio de cierre del Nivel 2: una corrida de
// 50.000 ciclos (muestra cada 100, 20 especies, los seis grupos) ocupa
// ≤ 5 MB serializada.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Historia, MAX_BYTES, medirSerializada } from '../engine/history.js';
import {
  CAMPOS_COMPORTAMIENTO,
  CAMPOS_ESPECIE,
  HISTOGRAMAS,
  IE,
  IM,
  N_COMPORTAMIENTO,
  N_ESPECIE,
  N_METRICAS,
} from '../engine/metricas.js';

/**
 * Muestra con forma de {t:'muestra'}: `vivos` global y por especie.
 * @param {number} ciclo @param {number} vivos
 * @param {Record<string, number>} [especies]  nombre → vivos
 * @param {Record<string, number>} [comp]      nombre → muertes
 */
function muestra(ciclo, vivos, especies = {}, comp) {
  // (los valores se guardan en Float32Array: ver f32)
  const metrics = new Float32Array(N_METRICAS);
  metrics[IM.ciclo] = ciclo;
  metrics[IM.vivos] = vivos;
  return {
    ciclo,
    metrics,
    especies: Object.entries(especies).map(([nombre, n], i) => {
      const stats = new Float32Array(N_ESPECIE);
      stats[IE.indice] = i;
      stats[IE.vivos] = n;
      stats[IE.genMax] = n * 2;
      return { nombre, stats };
    }),
    comportamiento: comp
      ? Object.entries(comp).map(([nombre, muertes], i) => {
          const datos = new Float32Array(N_COMPORTAMIENTO);
          datos[0] = i;
          datos[CAMPOS_COMPORTAMIENTO.indexOf('muertes')] = muertes;
          return { nombre, datos };
        })
      : null,
  };
}

test('agregar: orden temporal (lo que no es posterior se ignora) y series globales', () => {
  const h = new Historia();
  assert.equal(h.agregar(muestra(0, 10)), true);
  assert.equal(h.agregar(muestra(100, 12)), true);
  assert.equal(h.agregar(muestra(100, 99)), false, 'mismo ciclo');
  assert.equal(h.agregar(muestra(50, 99)), false, 'hacia atrás');
  assert.equal(h.agregar(muestra(200, 9)), true);
  const s = /** @type {import('../engine/history.js').Serie} */ (h.serie('vivos'));
  assert.deepEqual(s.t, [0, 100, 200]);
  assert.deepEqual(s.media, [10, 12, 9]);
  assert.deepEqual(s.min, s.media);
  assert.deepEqual(s.max, s.media);
  assert.deepEqual(s.n, [1, 1, 1]);
  assert.equal(h.serie('no-existe'), null);
  assert.equal(h.valorEn('vivos', 150), 12);
  assert.equal(h.valorEn('vivos', -1), undefined);
});

test('fusión de a dos: media ponderada por muestras, mínimo y máximo; rondas que siguen donde quedaron', () => {
  const h = new Historia({ maxPuntos: 8, maxBytes: Number.POSITIVE_INFINITY });
  const vals = [1, 3, 5, 7, 2, 4, 6, 8, 10];
  vals.forEach((v, i) => {
    h.agregar(muestra(i * 100, v));
  });
  // 9 > 8 puntos: se funden de una vez los pares que hacen falta para bajar
  // al 90 % (7 puntos): (0,1) y (2,3)
  const s = /** @type {any} */ (h.serie('vivos'));
  assert.deepEqual(s.t, [0, 200, 400, 500, 600, 700, 800]);
  assert.deepEqual(s.n, [2, 2, 1, 1, 1, 1, 1]);
  assert.deepEqual(s.media, [2, 6, 2, 4, 6, 8, 10]);
  assert.deepEqual(s.min, [1, 5, 2, 4, 6, 8, 10]);
  assert.deepEqual(s.max, [3, 7, 2, 4, 6, 8, 10]);
  // la fusión siguiente sigue a continuación (no vuelve a fundir los ya fundidos)
  h.agregar(muestra(900, 1));
  h.agregar(muestra(1000, 1));
  const s2 = /** @type {any} */ (h.serie('vivos'));
  assert.deepEqual(s2.n, [2, 2, 2, 2, 1, 1, 1]);
  assert.deepEqual(s2.t, [0, 200, 400, 600, 800, 900, 1000]);
  assert.deepEqual(s2.media, [2, 6, 3, 7, 10, 1, 1]);
  assert.equal(h.nivel, 1);
  // sin argumento termina la ronda: el último par, y el nivel pasa a 2
  assert.equal(h.fundir(), 1);
  assert.equal(h.nivel, 2);
  assert.deepEqual(/** @type {any} */ (h.serie('vivos')).n, [2, 2, 2, 2, 2, 1]);
  // el último punto es siempre la última muestra, sola; con la siguiente
  // pasa al punto en curso (el anterior) mientras éste no junte `nivel`
  assert.equal(h.agregar(muestra(1100, 3)), true);
  assert.equal(h.ultimoCiclo, 1100);
  assert.equal(h.agregar(muestra(1100, 3)), false, 'misma muestra');
  let s3 = /** @type {any} */ (h.serie('vivos'));
  assert.deepEqual(s3.n, [2, 2, 2, 2, 2, 1, 1]);
  assert.deepEqual([s3.t.at(-1), s3.media.at(-1)], [1100, 3]);
  h.agregar(muestra(1200, 5));
  s3 = /** @type {any} */ (h.serie('vivos'));
  assert.deepEqual(s3.n, [2, 2, 2, 2, 2, 2, 1]);
  assert.deepEqual([s3.t.at(-2), s3.media.at(-2), s3.min.at(-2), s3.max.at(-2)], [1000, 2, 1, 3]);
  assert.deepEqual([s3.t.at(-1), s3.media.at(-1), s3.n.at(-1)], [1200, 5, 1]);
  assert.equal(h.valorEn('vivos', 1200), 5, 'el último valor es el de la última muestra');
  assert.equal(h.fundir(), 3);
  assert.equal(h.nivel, 4);
  s3 = /** @type {any} */ (h.serie('vivos'));
  assert.deepEqual(s3.t, [0, 400, 800, 1200]);
  assert.deepEqual(s3.n, [4, 4, 4, 1]);
  assert.equal(s3.media[0], (1 + 3 + 5 + 7) / 4, 'dos puntos de n = 2: media ponderada');
  assert.deepEqual([s3.min[0], s3.max[0]], [1, 7]);
  assert.equal(s3.media[2], (10 + 1 + 1 + 3) / 4);
  const suma = s3.media.reduce(
    (/** @type {number} */ a, /** @type {number} */ m, /** @type {number} */ i) => a + m * s3.n[i],
    0,
  );
  assert.equal(
    suma,
    1 + 3 + 5 + 7 + 2 + 4 + 6 + 8 + 10 + 1 + 1 + 3 + 5,
    'la suma ponderada se conserva',
  );
  // pesos distintos: [media 2 de 2 muestras] + [5 de 1 muestra] = 3
  const h2 = new Historia({ maxPuntos: 64, maxBytes: Number.POSITIVE_INFINITY });
  for (const v of [1, 3, 5, 7]) h2.agregar(muestra(h2.puntos * 100, v));
  assert.equal(h2.fundir(), 1); // (1,3) → 2; el 5 queda suelto (en curso) y el 7 es el último
  assert.equal(h2.fundir(), 1); // nivel 2: (2 de 2) con (5 de 1)
  const s4 = /** @type {any} */ (h2.serie('vivos'));
  assert.deepEqual(s4.n, [3, 1]);
  assert.equal(s4.media[0], 3);
  assert.deepEqual([s4.min[0], s4.max[0]], [1, 5]);
  assert.equal(s4.media[1], 7, 'el último no se funde');
  assert.equal(h2.fundir(), 0, 'con un punto y el último no hay pares');
});

test('resolución pareja: tras muchas fusiones ningún punto dura más del doble que el más corto', () => {
  for (const [maxPuntos, muestras] of [
    [64, 600],
    [64, 5000],
    [100, 1234],
    [2000, 9000],
  ]) {
    const h = new Historia({ maxPuntos, maxBytes: Number.POSITIVE_INFINITY });
    for (let i = 0; i < muestras; i++) h.agregar(muestra(i * 100, i, i % 3 ? { A: i } : {}));
    assert.ok(h.puntos <= maxPuntos);
    const s = /** @type {any} */ (h.serie('vivos'));
    const dur = s.t.slice(1).map((/** @type {number} */ t, /** @type {number} */ i) => t - s.t[i]);
    // sin el punto en curso (el penúltimo) ni el último (la última muestra, sola)
    const completos = dur.slice(0, -1);
    const min = Math.min(...completos);
    const max = Math.max(...completos);
    assert.ok(max <= 2 * min, `${maxPuntos}/${muestras}: duraciones ${min}..${max}`);
    // el primer punto no se come la corrida
    assert.ok(s.t[1] - s.t[0] <= 2 * min);
    // n = muestras de cada punto; el en curso a lo sumo 2·nivel; el último, 1
    for (let i = 0; i < s.n.length - 1; i++) assert.equal(s.n[i] * 100, dur[i]);
    assert.ok(s.n.at(-2) <= 2 * h.nivel);
    assert.equal(s.n.at(-1), 1);
    assert.equal(s.t.at(-1), (muestras - 1) * 100);
    assert.equal(s.media.at(-1), muestras - 1, 'el último punto es la última muestra');
    const a = /** @type {any} */ (h.serie('vivos', 'A'));
    let presentes = 0;
    for (let i = 0; i < muestras; i++) if (i % 3) presentes++;
    assert.equal(
      a.n.reduce((/** @type {number} */ x, /** @type {number} */ y) => x + y, 0),
      presentes,
    );
    for (const t of a.t) assert.ok(h.t.includes(t));
    assert.equal(
      s.n.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0),
      muestras,
    );
  }
  // el caso que encontró la revisión: maxPuntos 64 y 600 muestras
  const h = new Historia({ maxPuntos: 64, maxBytes: Number.POSITIVE_INFINITY });
  for (let i = 0; i < 600; i++) h.agregar(muestra(i * 100, i));
  const t = h.t;
  assert.ok(t[1] - t[0] <= 2000, `primer punto: ${t[0]}–${t[1]}`);
});

test('una fusión nunca agranda la historia (primera ronda, rondas siguientes, especies y comportamiento)', () => {
  const r = lcg(11);
  const h = new Historia({ maxPuntos: 100000, maxBytes: Number.POSITIVE_INFINITY });
  let fusiones = 0;
  for (let i = 0; i < 400; i++) {
    const esp = /** @type {Record<string, number>} */ ({});
    const comp = /** @type {Record<string, number>} */ ({});
    for (let k = 0; k < 6; k++)
      if ((i + k * 37) % 90 < 60) {
        esp[`E${k}`] = Math.floor(r() * 100);
        comp[`E${k}`] = Math.floor(r() * 5);
      }
    h.agregar(muestra(i * 100, i, esp, comp));
    if (i % 23 === 22 || i === 399) {
      const todas = i % 92 === 91 ? [Number.POSITIVE_INFINITY] : [];
      for (const pares of [1, 2, ...todas]) {
        const antes = h.tamaño();
        const estAntes = h.bytesEstimados();
        const hechos = h.fundir(pares);
        if (!hechos) continue;
        fusiones++;
        const despues = h.tamaño();
        assert.ok(despues < antes, `fundir(${pares}) en ${i}: ${antes} → ${despues}`);
        assert.ok(h.bytesEstimados() < estAntes);
        assert.ok(h.bytesEstimados() >= despues, 'la estimación es cota del tamaño real');
      }
    }
  }
  assert.ok(fusiones > 30 && h.nivel >= 4, `${fusiones} fusiones, nivel ${h.nivel}`);
  // también la historia de la v1 leída y fundida
  const v1 = historiaV1();
  const g = Historia.deserializar(v1);
  const antes = g.tamaño();
  assert.ok(g.fundir(1) === 1 && g.tamaño() < antes);
});

test('punto en curso: una especie que aparece en la última muestra pasa con ella al punto en curso', () => {
  const h = new Historia({ maxPuntos: 64, maxBytes: Number.POSITIVE_INFINITY });
  for (let i = 0; i < 5; i++) h.agregar(muestra(i * 100, i, { A: 1 }));
  h.fundir(); // [2, 2, 1(400)] nivel 2
  assert.equal(h.nivel, 2);
  h.agregar(muestra(500, 5, { A: 1, B: 7 })); // [2, 2, 1, 1(500)]: 400 en curso
  assert.deepEqual(/** @type {any} */ (h.serie('vivos', 'B')).t, [500]);
  h.agregar(muestra(600, 6, { A: 1 })); // 500 pasa al punto de 400
  const b = /** @type {any} */ (h.serie('vivos', 'B'));
  assert.deepEqual([b.t, b.n, b.media], [[400], [1], [7]]);
  const v = /** @type {any} */ (h.serie('vivos'));
  assert.deepEqual(
    [v.t, v.n, v.media],
    [
      [0, 200, 400, 600],
      [2, 2, 2, 1],
      [0.5, 2.5, 4.5, 6],
    ],
  );
  assert.deepEqual(
    h.alineada('vivos', 'B').map((x) => (Number.isNaN(x) ? null : x)),
    [null, null, 7, null],
  );
  // B sigue en la muestra siguiente: su pista crece en el eje global
  h.agregar(muestra(700, 7, { A: 1, B: 9 }));
  h.agregar(muestra(800, 8, { A: 1, B: 11 }));
  const b2 = /** @type {any} */ (h.serie('vivos', 'B'));
  // (en 600 B no estaba: el punto de 600 junta 600 y 700, B solo en 700)
  assert.deepEqual(
    [b2.t, b2.n, b2.media],
    [
      [400, 600, 800],
      [1, 1, 1],
      [7, 9, 11],
    ],
  );
  assert.deepEqual(/** @type {any} */ (h.serie('vivos')).n, [2, 2, 2, 2, 1]);
});

test('especies que aparecen, desaparecen y vuelven: alineadas con el eje global', () => {
  const h = new Historia();
  h.agregar(muestra(0, 5, { A: 5 }));
  h.agregar(muestra(100, 8, { A: 5, B: 3 }));
  h.agregar(muestra(200, 5, { A: 5 })); // B se extingue
  h.agregar(muestra(300, 5, { A: 5 }));
  h.agregar(muestra(400, 7, { A: 5, B: 2 })); // B vuelve (p. ej. por teleporter)
  const b = /** @type {any} */ (h.serie('vivos', 'B'));
  assert.deepEqual(b.t, [100, 400]);
  assert.deepEqual(b.media, [3, 2]);
  assert.deepEqual(
    h.alineada('vivos', 'B').map((x) => (Number.isNaN(x) ? null : x)),
    [null, 3, null, null, 2],
  );
  assert.equal(/** @type {any} */ (h.serie('genMax', 'A')).media[0], 10);
  assert.deepEqual(h.nombresEspecies(), ['A', 'B']);
  assert.equal(h.serie('vivos', 'C'), null);
  // nombres con .txt y la fila Corpse: se normalizan / se ignoran
  h.agregar(muestra(500, 1, { 'A.txt': 1, Corpse: 9 }));
  assert.deepEqual(h.nombresEspecies(), ['A', 'B']);
  assert.equal(/** @type {any} */ (h.serie('vivos', 'A.txt')).media.at(-1), 1);
});

test('fusión con especies ausentes: la media pondera solo las muestras presentes', () => {
  const h = new Historia({ maxPuntos: 8, maxBytes: Number.POSITIVE_INFINITY });
  h.agregar(muestra(0, 1, { A: 4 }));
  h.agregar(muestra(100, 1, {})); // A ausente
  h.agregar(muestra(200, 1, { A: 6 }));
  h.agregar(muestra(300, 1, { A: 10, B: 1 }));
  for (let c = 400; c <= 800; c += 100) h.agregar(muestra(c, 1, { A: 1 }));
  const a = /** @type {any} */ (h.serie('vivos', 'A'));
  // (0,100) → solo la de 0: media 4, n 1; (200,300) → 6 y 10: media 8
  assert.deepEqual(a.t.slice(0, 2), [0, 200]);
  assert.deepEqual(a.n.slice(0, 2), [1, 2]);
  assert.deepEqual(a.media.slice(0, 2), [4, 8]);
  assert.deepEqual([a.min[1], a.max[1]], [6, 10]);
  const b = /** @type {any} */ (h.serie('vivos', 'B'));
  assert.deepEqual(b.t, [200], 'B apareció en 300: su punto fundido empieza en 200');
});

test('comportamiento: especie viva sin actividad = 0; la que murió en el intervalo también se guarda', () => {
  const h = new Historia();
  h.agregar(muestra(0, 3, { A: 2, B: 1 }, {}));
  h.agregar(muestra(100, 2, { A: 2 }, { B: 1 })); // B murió: fila de comportamiento sin stats
  const ma = /** @type {any} */ (h.serie('muertes', 'A'));
  assert.deepEqual(ma.media, [0, 0]);
  const mb = /** @type {any} */ (h.serie('muertes', 'B'));
  assert.deepEqual(mb.t, [0, 100]);
  assert.deepEqual(mb.media, [0, 1]);
  assert.deepEqual(/** @type {any} */ (h.serie('vivos', 'B')).t, [0]);
});

test('recortar: descarta lo posterior (puntos, especies, histogramas, eventos)', () => {
  const h = new Historia();
  for (let c = 0; c <= 500; c += 100) h.agregar(muestra(c, c, c >= 300 ? { N: 1 } : { V: 1 }));
  h.evento({ ciclo: 250, tipo: 'x' });
  h.evento({ ciclo: 450, tipo: 'y' });
  h.recortar(250);
  assert.deepEqual(h.t, [0, 100, 200]);
  assert.deepEqual(h.nombresEspecies(), ['V']);
  assert.deepEqual(
    h.eventos.map((e) => e.tipo),
    ['x'],
  );
  assert.equal(h.agregar(muestra(300, 1)), true, 'sigue desde ahí');
});

test('serializar → deserializar: typed arrays, bandas cuantizadas hacia afuera; tamaño = lo medido', () => {
  const h = new Historia({ maxPuntos: 16, maxBytes: Number.POSITIVE_INFINITY });
  for (let c = 0; c < 40; c++)
    h.agregar({
      ...muestra(c * 100, c * 1.37, { A: c, B: 40 - c }, { A: c % 3 }),
      histogramas: {
        bins: 4,
        n: new Int32Array(HISTOGRAMAS.length).fill(c),
        datos: new Float32Array(HISTOGRAMAS.length * 6).fill(c),
      },
    });
  h.evento({ ciclo: 10, tipo: 'inicio', params: { nombre: 'x' } });
  const o = h.serializar();
  assert.equal(o.v, 2);
  assert.ok(o.t instanceof Float64Array);
  assert.ok(o.global.media instanceof Float32Array);
  assert.ok(o.global.lo instanceof Uint8Array && o.global.escala instanceof Float32Array);
  assert.ok(o.global.kf > 0, 'bandas del prefijo fundido');
  assert.equal(o.global.lo.length, o.global.kf * Historia.columnas.global.length);
  assert.equal(o.comportamiento[0].lo, undefined, 'el comportamiento no guarda bandas');
  // pasa por structuredClone (IndexedDB)
  const g = Historia.deserializar(structuredClone(o));
  assert.equal(g.nivel, h.nivel);
  assert.equal(g.ultimoCiclo, h.ultimoCiclo);
  for (const [nombre, esp] of [
    ['vivos', undefined],
    ['vivos', 'A'],
    ['vivos', 'B'],
    ['muertes', 'A'],
  ]) {
    const a = /** @type {any} */ (h.serie(/** @type {string} */ (nombre), esp));
    const b = /** @type {any} */ (g.serie(/** @type {string} */ (nombre), esp));
    assert.deepEqual([b.t, b.n], [a.t, a.n], `${nombre} ${esp}`);
    assert.deepEqual(b.media, f32(a).media);
    // la banda guardada contiene a la verdadera y se pasa a lo sumo 1/255 de la más ancha
    const ancho = Math.max(
      ...a.max.map((/** @type {number} */ x, /** @type {number} */ k) => x - a.min[k]),
    );
    for (let k = 0; k < a.t.length; k++) {
      assert.ok(b.min[k] <= a.min[k] + 1e-4 && b.max[k] >= a.max[k] - 1e-4, `${nombre} ${k}`);
      assert.ok(
        a.min[k] - b.min[k] <= ancho / 255 + 1e-4 && b.max[k] - a.max[k] <= ancho / 255 + 1e-4,
      );
    }
  }
  const m = /** @type {any} */ (g.serie('muertes', 'A'));
  assert.deepEqual(m.min, m.media);
  assert.deepEqual(m.max, m.media);
  assert.equal(g.histogramas.length, h.histogramas.length);
  assert.deepEqual(g.histogramas.at(-1)?.n, h.histogramas.at(-1)?.n);
  assert.deepEqual(g.eventos, h.eventos);
  assert.equal(h.tamaño(), medirSerializada(o));
  assert.ok(h.bytesEstimados() >= h.tamaño(), 'la estimación es cota');
  // guardar y leer otra vez no corre las bandas
  const o2 = g.serializar();
  assert.deepEqual([...o2.global.lo], [...o.global.lo]);
  assert.deepEqual([...o2.global.hi], [...o.global.hi]);
  assert.equal(Historia.deserializar(o2).tamaño(), g.tamaño());
  // sigue agregando después de restaurar
  assert.equal(g.agregar(muestra(4000, 1, { A: 1 })), true);
});

test('lee la historia serializada v1 (mín/máx Float32, también en el comportamiento)', () => {
  const g = Historia.deserializar(structuredClone(historiaV1()));
  assert.deepEqual(g.t, [0, 200, 400, 500]);
  const v = /** @type {any} */ (g.serie('vivos'));
  assert.deepEqual(v.n, [2, 2, 1, 1]);
  assert.deepEqual(v.media, [2, 6, 2, 4]);
  assert.deepEqual(v.min, [1, 5, 2, 4]);
  assert.deepEqual(v.max, [3, 7, 2, 4]);
  const a = /** @type {any} */ (g.serie('vivos', 'A'));
  assert.deepEqual(
    [a.t, a.n, a.media, a.min, a.max],
    [
      [200, 400, 500],
      [2, 1, 1],
      [5, 1, 2],
      [4, 1, 2],
      [6, 1, 2],
    ],
  );
  const c = /** @type {any} */ (g.serie('muertes', 'A'));
  assert.deepEqual(
    [c.media, c.min, c.max],
    [
      [3, 1, 1],
      [3, 1, 1],
      [3, 1, 1],
    ],
    'sin bandas',
  );
  assert.equal(g.ultimoCiclo, 500);
  assert.equal(g.nivel, 1);
  assert.equal(g.agregar(muestra(600, 9, { A: 3 })), true);
  assert.deepEqual(/** @type {any} */ (g.serie('vivos')).media.at(-1), 9);
});

test('la historia vieja de N1 ({intervalo, max, muestras}) se lee como historia nueva (lo que no medía, NaN)', () => {
  const vieja = {
    intervalo: 100,
    max: 240,
    muestras: [
      { ciclo: 0, total: 20, especies: { Alga: 15, Animal: 5 } },
      { ciclo: 100, total: 21, especies: { Alga: 16, Animal: 5 } },
      { ciclo: 200, total: 13, especies: {} },
    ],
  };
  const h = Historia.deserializar(vieja);
  assert.deepEqual(h.t, [0, 100, 200]);
  assert.deepEqual(/** @type {any} */ (h.serie('vivos')).media, [20, 21, 13]);
  assert.deepEqual(/** @type {any} */ (h.serie('ciclo')).media, [0, 100, 200]);
  assert.deepEqual(/** @type {any} */ (h.serie('vivos', 'Alga')).media, [15, 16]);
  // métricas que N1 no medía: hueco (NaN), no 0
  for (const m of ['vegetales', 'genMax', 'bots'])
    assert.ok(/** @type {any} */ (h.serie(m)).media.every(Number.isNaN), m);
  assert.ok(/** @type {any} */ (h.serie('genMax', 'Alga')).media.every(Number.isNaN));
  assert.equal(h.valorEn('vegetales', 100), Number.NaN);
});

test('eventos: cuentan en el tamaño y tienen su tope propio (se descartan los más viejos)', () => {
  const h = new Historia({ maxBytesEventos: 4096 });
  h.agregar(muestra(0, 1));
  const base = h.tamaño();
  for (let i = 0; i < 200; i++)
    h.evento({ ciclo: i, tipo: 'especieNueva', params: { especie: `E${i}` } });
  assert.ok(h.eventosDescartados > 0);
  assert.equal(h.eventos.length + h.eventosDescartados, 200);
  assert.equal(h.eventos.at(-1).ciclo, 199, 'quedan los más nuevos');
  const json = new TextEncoder().encode(JSON.stringify(h.eventos)).length;
  assert.ok(json <= 4096);
  assert.ok(h.tamaño() >= base + json - 10, 'los eventos cuentan en el tamaño');
  assert.ok(h.bytesEstimados() >= h.tamaño());
  const g = Historia.deserializar(h.serializar());
  assert.equal(g.eventosDescartados, h.eventosDescartados);
  assert.deepEqual(g.eventos, h.eventos);
  // y el tope total cuenta los eventos: con muchos eventos la serie se funde antes
  const r = lcg(3);
  const sin = new Historia({ maxBytes: 600 * 1024 });
  const con = new Historia({ maxBytes: 600 * 1024 });
  for (let i = 0; i < 3000; i++)
    con.evento({ ciclo: 0, tipo: 'x', params: { relleno: 'y'.repeat(60) } });
  for (let c = 0; c <= 30000; c += 100) {
    const m = muestraRealista(r, c, 10);
    sin.agregar(m);
    con.agregar(m);
  }
  assert.ok(con.tamaño() <= 600 * 1024 && sin.tamaño() <= 600 * 1024);
  assert.ok(con.puntos < sin.puntos, `${con.puntos} < ${sin.puntos}`);
});

test('tope de puntos: nunca más de maxPuntos y todas las series alineadas', () => {
  const h = new Historia({ maxPuntos: 100, maxBytes: Number.POSITIVE_INFINITY });
  for (let c = 0; c < 1000; c++) h.agregar(muestra(c * 100, c, c % 7 ? { A: c } : { B: c }));
  assert.ok(h.puntos <= 100);
  const s = /** @type {any} */ (h.serie('vivos'));
  assert.equal(
    s.n.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0),
    1000,
  );
  // media global = media de 0..999
  const tot = s.media.reduce(
    (/** @type {number} */ a, /** @type {number} */ m, /** @type {number} */ i) => a + m * s.n[i],
    0,
  );
  assert.ok(Math.abs(tot - (999 * 1000) / 2) < 1e-6 * tot);
  const a = /** @type {any} */ (h.serie('vivos', 'A'));
  const b = /** @type {any} */ (h.serie('vivos', 'B'));
  assert.equal(
    a.n.reduce((/** @type {number} */ x, /** @type {number} */ y) => x + y, 0) +
      b.n.reduce((/** @type {number} */ x, /** @type {number} */ y) => x + y, 0),
    1000,
  );
  for (const t of [...a.t, ...b.t]) assert.ok(h.t.includes(t), 'mismos ciclos que el eje global');
});

// ---- Criterio de cierre del Nivel 2 ----------------------------------------------

/** Generador determinista. @param {number} semilla */
function lcg(semilla) {
  let x = semilla >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/**
 * Muestra «realista» completa (los seis grupos): 56 métricas, stats de las
 * especies vivas, comportamiento y 9 histogramas de 20 barras. Las especies
 * aparecen y se extinguen a lo largo de la corrida.
 * @param {() => number} r @param {number} ciclo @param {number} nEspecies
 */
function muestraRealista(r, ciclo, nEspecies, fase = ciclo) {
  const metrics = new Float32Array(N_METRICAS).map(() => r() * 1000);
  metrics[IM.ciclo] = ciclo;
  const especies = [];
  const comportamiento = [];
  for (let i = 0; i < nEspecies; i++) {
    // cada especie vive una ventana larga (algunas desde el principio)
    const nace = (i % 5) * 8000;
    const muere = nace + 30000 + (i % 3) * 10000;
    if (fase < nace || fase > muere) continue;
    const nombre = `Especie número ${i} (F1)(Autor)-01.01.01.txt`;
    const stats = new Float32Array(N_ESPECIE).map(() => r() * 5000);
    stats[IE.indice] = i;
    especies.push({ nombre, indice: i, stats });
    const datos = new Float32Array(N_COMPORTAMIENTO).map(() => Math.floor(r() * 50));
    datos[0] = i;
    comportamiento.push({ nombre, indice: i, datos });
  }
  const bins = 20;
  return {
    ciclo,
    metrics,
    especies,
    comportamiento,
    histogramas: {
      bins,
      n: new Int32Array(HISTOGRAMAS.length).map(() => Math.floor(r() * 500)),
      datos: new Float32Array(HISTOGRAMAS.length * (bins + 2)).map(() => Math.floor(r() * 100)),
    },
  };
}

test('CIERRE N2: 50.000 ciclos, muestra cada 100, 20 especies, seis grupos → ≤ 5 MB serializada', () => {
  const r = lcg(2026);
  const h = new Historia({ intervalo: 100 });
  for (let c = 0; c <= 50000; c += 100) assert.ok(h.agregar(muestraRealista(r, c, 20)));
  const o = h.serializar();
  const bytes = medirSerializada(structuredClone(o));
  console.log(
    `# historia 50.000 ciclos, 20 especies: ${h.puntos} puntos, ${(bytes / 1048576).toFixed(2)} MB`,
  );
  assert.equal(h.puntos, 501, 'sin fundir: 501 puntos < 2.000');
  assert.ok(bytes <= 5 * 1024 * 1024, `${bytes} bytes > 5 MB`);
  assert.equal(h.tamaño(), bytes);
  // y se puede seguir leyendo tal cual
  const g = Historia.deserializar(o);
  assert.equal(g.puntos, 501);
  assert.equal(g.nombresEspecies().length, 20);
});

test('presupuesto: una corrida muy larga con 20 especies no pasa de maxBytes (funde antes de 2.000)', () => {
  const r = lcg(7);
  const h = new Historia({ intervalo: 100 });
  let maxVisto = 0;
  for (let c = 0; c <= 400000; c += 100) {
    // el patrón de especies se repite cada 60.000 ciclos
    assert.ok(h.agregar(muestraRealista(r, c, 20, c % 60000)));
    if (c % 20000 === 0) maxVisto = Math.max(maxVisto, h.tamaño());
  }
  const bytes = h.tamaño();
  console.log(
    `# historia 400.000 ciclos, 20 especies: ${h.puntos} puntos, ${(bytes / 1048576).toFixed(2)} MB`,
  );
  assert.ok(bytes <= MAX_BYTES, `${bytes} > presupuesto`);
  assert.ok(maxVisto <= MAX_BYTES);
  assert.ok(h.puntos <= 2000);
  const s = /** @type {any} */ (h.serie('vivos'));
  assert.equal(
    s.n.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0),
    4001,
    'ninguna muestra se pierde: todas quedan en algún punto',
  );
});

/**
 * Muestra con `nEspecies` especies presentes siempre, los seis grupos e
 * histogramas de 20 barras.
 * @param {() => number} r @param {number} ciclo @param {number} nEspecies
 */
function muestraCompleta(r, ciclo, nEspecies) {
  const m = muestraRealista(r, ciclo, 0);
  for (let i = 0; i < nEspecies; i++) {
    const nombre = `Especie número ${i} (F1)(Autor)-01.01.01.txt`;
    const stats = new Float32Array(N_ESPECIE).map(() => r() * 5000);
    m.especies.push({ nombre, indice: i, stats });
    const datos = new Float32Array(N_COMPORTAMIENTO).map(() => Math.floor(r() * 50));
    m.comportamiento.push({ nombre, indice: i, datos });
  }
  return m;
}

test('presupuesto con 20, 30, 50 y 100 especies siempre presentes: 50.000 y 400.000 ciclos ≤ 5 MB', () => {
  /** @type {string[]} */
  const filas = [];
  for (const nEsp of [20, 30, 50, 100])
    for (const ciclos of [50000, 400000]) {
      const r = lcg(nEsp * 31 + ciclos);
      const h = new Historia();
      let maxVisto = 0;
      for (let c = 0; c <= ciclos; c += 100) {
        assert.ok(h.agregar(muestraCompleta(r, c, nEsp)));
        if (c % 25000 === 0) {
          const b = h.tamaño();
          maxVisto = Math.max(maxVisto, b);
          assert.ok(h.bytesEstimados() >= b, 'la estimación es cota');
        }
      }
      const bytes = h.tamaño();
      filas.push(
        `#   ${String(nEsp).padStart(3)} especies, ${String(ciclos).padStart(6)} ciclos: ` +
          `${String(h.puntos).padStart(4)} puntos (nivel ${h.nivel}), ${(bytes / 1048576).toFixed(2)} MB`,
      );
      assert.ok(bytes <= MAX_BYTES && maxVisto <= MAX_BYTES, `${nEsp}/${ciclos}: ${bytes}`);
      assert.equal(h.nombresEspecies().length, nEsp);
      const s = /** @type {any} */ (h.serie('vivos', 'Especie número 7 (F1)(Autor)-01.01.01'));
      assert.equal(
        s.n.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0),
        ciclos / 100 + 1,
      );
      if (nEsp <= 30 && ciclos === 50000) assert.equal(h.puntos, 501, 'sin fundir');
    }
  console.log('# historia con especies siempre presentes:');
  for (const f of filas) console.log(f);
});

test('columnas: la historia guarda todas las métricas y los campos de especie con sentido', () => {
  const c = Historia.columnas;
  assert.equal(c.global.length, N_METRICAS);
  assert.ok(!c.especie.includes('indice') && !c.especie.includes('color'));
  assert.ok(c.especie.includes('vivos') && c.especie.includes('genMax'));
  assert.equal(c.especie.length, CAMPOS_ESPECIE.length - 3);
  assert.equal(c.comportamiento.length, CAMPOS_COMPORTAMIENTO.length - 1);
});

/**
 * Una serie con sus valores redondeados a float32 (lo que guarda la forma
 * serializada).
 * @param {any} s
 */
function f32(s) {
  if (!s) return s;
  const r = (/** @type {number[]} */ a) => a.map((x) => Math.fround(x));
  return { ...s, media: r(s.media), min: r(s.min), max: r(s.max) };
}

/**
 * Una historia serializada con el formato v1 (mín/máx Float32 del prefijo
 * fundido, también en el comportamiento): t = 0, 200, 400, 500 con
 * n = 2, 2, 1, 1; vivos 2 [1–3], 6 [5–7], 2, 4; especie A desde el punto 1.
 */
function historiaV1() {
  const cg = Historia.columnas.global;
  const ce = Historia.columnas.especie;
  const cc = Historia.columnas.comportamiento;
  /** @param {string[]} cols @param {string} col @param {number} desde @param {number[]} n
   *  @param {number[]} media @param {number[]} min @param {number[]} max */
  const pista = (cols, col, desde, n, media, min, max) => {
    const len = n.length;
    const kf = min.length;
    const m = new Float32Array(cols.length * len);
    const lo = new Float32Array(cols.length * kf);
    const hi = new Float32Array(cols.length * kf);
    const c = cols.indexOf(col);
    m.set(media, c * len);
    lo.set(min, c * kf);
    hi.set(max, c * kf);
    return { desde, kf, n: Uint32Array.from(n), media: m, min: lo, max: hi };
  };
  return {
    v: 1,
    intervalo: 100,
    maxPuntos: 2000,
    maxBytes: MAX_BYTES,
    maxHistogramas: 200,
    columnas: { global: cg, especie: ce, comportamiento: cc },
    t: Float64Array.from([0, 200, 400, 500]),
    global: pista(cg, 'vivos', 0, [2, 2, 1, 1], [2, 6, 2, 4], [1, 5], [3, 7]),
    especies: [{ nombre: 'A', ...pista(ce, 'vivos', 1, [2, 1, 1], [5, 1, 2], [4], [6]) }],
    comportamiento: [{ nombre: 'A', ...pista(cc, 'muertes', 1, [2, 1, 1], [3, 1, 1], [2], [4]) }],
    histogramas: {
      bins: 0,
      ciclos: new Float64Array(0),
      n: new Float32Array(0),
      datos: new Float32Array(0),
    },
    eventos: [{ ciclo: 0, tipo: 'inicio' }],
  };
}
