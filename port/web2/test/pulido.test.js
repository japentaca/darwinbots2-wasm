// @ts-check
// N4.4 (pulido): destino del chip de trabajos, estado del marcador de
// torneo, carga perezosa de las pantallas y recarga tras un deploy.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ACTIVOS as ACTIVOS_COLA } from '../engine/cola.js';
import { TIPO_REPLICAS } from '../engine/replicas.js';
import { TIPO_RONDA as TIPO_RONDA_MOTOR } from '../engine/rondas.js';
import {
  CLAVE_PLEGADO,
  flotanteVisible,
  guardarPlegado,
  leerPlegado,
  MARGEN,
  MARGEN_DERECHO,
  plegadoInicial,
  posicionMarcador,
  resumenRonda,
} from '../src/lib/competir/marcador.js';
import { borrarMarcaRecarga, CLAVE_RECARGA, recargarTrasFallo } from '../src/lib/recarga.js';
import {
  ACTIVOS,
  DESTINO_COMPARAR,
  destinoChip,
  destinoDeTipo,
  TIPO_RONDA,
} from '../src/lib/trabajos/destino.js';

const COMPARAR = '#/analizar/actual/comparar';

const leer = (/** @type {string} */ r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');

/** @param {string} id @param {string} tipo @param {string} estado @param {string} [t] @param {any} [params] */
const trabajo = (id, tipo, estado, t = '2026-09-30T10:00:00.000Z', params = {}) => ({
  id,
  tipo,
  estado,
  creado: t,
  actualizado: t,
  params,
});

test('destino.js: las constantes coinciden con las del motor', () => {
  assert.equal(TIPO_RONDA, TIPO_RONDA_MOTOR);
  assert.deepEqual([...ACTIVOS], [...ACTIVOS_COLA]);
  assert.equal(DESTINO_COMPARAR, COMPARAR);
});

test('destinoDeTipo: rondas a Competir (con la liga si viene), el resto a Comparar', () => {
  assert.equal(destinoDeTipo(TIPO_RONDA, 'lg-1'), '#/competir/lg-1');
  assert.equal(destinoDeTipo(TIPO_RONDA, 'a b/c'), '#/competir/a%20b%2Fc');
  assert.equal(destinoDeTipo(TIPO_RONDA, undefined), '#/competir');
  assert.equal(destinoDeTipo(TIPO_RONDA, ''), '#/competir');
  assert.equal(destinoDeTipo(TIPO_RONDA, 7), '#/competir');
  assert.equal(destinoDeTipo(TIPO_REPLICAS, 'lg-1'), COMPARAR);
  assert.equal(destinoDeTipo(undefined, undefined), COMPARAR);
});

test('destinoChip: avisos solo de réplicas → Comparar', () => {
  const lista = [trabajo('r1', TIPO_REPLICAS, 'terminado')];
  assert.equal(destinoChip(lista, [{ id: 'r1' }]), COMPARAR);
});

test('destinoChip: avisos de rondas → el torneo en Competir', () => {
  const lista = [trabajo('t1', TIPO_RONDA, 'terminado', undefined, { league: 'lg-9', ronda: 2 })];
  assert.equal(destinoChip(lista, [{ id: 't1' }]), '#/competir/lg-9');
  // sin la liga en los params: Competir a secas
  const sinLiga = [trabajo('t2', TIPO_RONDA, 'fallido')];
  assert.equal(destinoChip(sinLiga, [{ id: 't2' }]), '#/competir');
});

test('destinoChip: con avisos de los dos tipos manda el más reciente (el último)', () => {
  const lista = [
    trabajo('r1', TIPO_REPLICAS, 'terminado'),
    trabajo('t1', TIPO_RONDA, 'terminado', undefined, { league: 'lg-1' }),
  ];
  assert.equal(destinoChip(lista, [{ id: 'r1' }, { id: 't1' }]), '#/competir/lg-1');
  assert.equal(destinoChip(lista, [{ id: 't1' }, { id: 'r1' }]), COMPARAR);
});

test('destinoChip: el tipo y la liga del aviso mandan; trabajo borrado → Comparar', () => {
  assert.equal(destinoChip([], [{ id: 'x', tipo: TIPO_RONDA, liga: 'lg-2' }]), '#/competir/lg-2');
  assert.equal(destinoChip([], [{ id: 'x' }]), COMPARAR);
});

test('destinoChip: sin avisos, el trabajo en cola más reciente', () => {
  const lista = [
    trabajo('r1', TIPO_REPLICAS, 'corriendo', '2026-09-30T10:00:00.000Z'),
    trabajo('t1', TIPO_RONDA, 'pendiente', '2026-09-30T11:00:00.000Z', { league: 'lg-3' }),
    // terminado y más nuevo, pero no está en cola ni tiene aviso
    trabajo('r2', TIPO_REPLICAS, 'terminado', '2026-09-30T12:00:00.000Z'),
  ];
  assert.equal(destinoChip(lista, []), '#/competir/lg-3');
  assert.equal(destinoChip(lista.slice(0, 1), []), COMPARAR);
  assert.equal(destinoChip([], []), COMPARAR);
});

test('destinoChip mixto: con trabajos en curso manda el trabajo en cola, no el aviso', () => {
  // el chip dice «1 en curso» (réplicas) aunque haya un aviso de ronda
  const lista = [
    trabajo('r1', TIPO_REPLICAS, 'corriendo'),
    trabajo('t1', TIPO_RONDA, 'terminado', undefined, { league: 'lg-1' }),
  ];
  assert.equal(destinoChip(lista, [{ id: 't1' }]), COMPARAR);
  // y al revés: ronda en curso, aviso de réplicas → el torneo
  const otra = [
    trabajo('t2', TIPO_RONDA, 'pendiente', undefined, { league: 'lg-2' }),
    trabajo('r2', TIPO_REPLICAS, 'terminado'),
  ];
  assert.equal(destinoChip(otra, [{ id: 'r2' }]), '#/competir/lg-2');
});

test('destinoChip mixto: sin trabajos en curso manda el aviso más reciente', () => {
  const lista = [
    trabajo('r1', TIPO_REPLICAS, 'terminado', '2026-09-30T12:00:00.000Z'),
    trabajo('t1', TIPO_RONDA, 'fallido', '2026-09-30T10:00:00.000Z', { league: 'lg-5' }),
  ];
  // el último aviso es la ronda aunque la réplica sea más nueva en la lista
  assert.equal(destinoChip(lista, [{ id: 'r1' }, { id: 't1' }]), '#/competir/lg-5');
  assert.equal(destinoChip(lista, [{ id: 't1' }, { id: 'r1' }]), COMPARAR);
});

test('destinoChip: entre los trabajos en curso, el creado más recientemente', () => {
  const t1 = trabajo('t1', TIPO_RONDA, 'corriendo', '2026-09-30T09:00:00.000Z', {
    league: 'lg-7',
  });
  t1.actualizado = '2026-09-30T13:00:00.000Z'; // actualizado después, creado antes
  const r1 = trabajo('r1', TIPO_REPLICAS, 'pendiente', '2026-09-30T11:00:00.000Z');
  assert.equal(destinoChip([t1, r1], []), COMPARAR);
  assert.equal(destinoChip([r1, t1], []), COMPARAR);
});

/** Almacén en memoria con la forma de localStorage. */
function memoria() {
  /** @type {Map<string, string>} */
  const m = new Map();
  return {
    m,
    getItem: (/** @type {string} */ k) => m.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => void m.set(k, v),
    removeItem: (/** @type {string} */ k) => void m.delete(k),
  };
}

test('marcador: el estado plegado se recuerda', () => {
  const a = memoria();
  assert.equal(leerPlegado(a), false, 'sin dato: desplegado');
  guardarPlegado(true, a);
  assert.equal(a.m.get(CLAVE_PLEGADO), '1');
  assert.equal(leerPlegado(a), true);
  guardarPlegado(false, a);
  assert.equal(leerPlegado(a), false);
});

test('marcador: sin almacenamiento o con uno que lanza, no falla', () => {
  assert.equal(leerPlegado(null), false);
  assert.doesNotThrow(() => guardarPlegado(true, null));
  const roto = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(leerPlegado(roto), false);
  assert.doesNotThrow(() => guardarPlegado(true, roto));
  // en node no hay localStorage: el almacén por defecto tampoco falla
  assert.equal(typeof leerPlegado(), 'boolean');
  assert.doesNotThrow(() => guardarPlegado(false));
});

test('marcador: el flotante no se ve en Competir ni con el torneo avanzando en Observar, ni sin partido', () => {
  assert.equal(flotanteVisible('#/experimentar', true), true);
  assert.equal(flotanteVisible('#/observar', true), true);
  assert.equal(flotanteVisible('', true), true);
  assert.equal(flotanteVisible('#/experimentar', false), false);
  assert.equal(flotanteVisible('#/competir', true), false);
  assert.equal(flotanteVisible('#/competir/lg-1/tabla', true), false);
  assert.equal(flotanteVisible('#/observar', true, true), false);
  assert.equal(flotanteVisible('#/observar/x', true, true), false);
  assert.equal(flotanteVisible('#/experimentar', true, true), true);
  assert.equal(flotanteVisible('#/competirx', true), true);
  assert.equal(flotanteVisible('#/observar/tv', true), true);
  // con el router: query y codificación
  assert.equal(flotanteVisible('#/competir?x=1', true), false);
  assert.equal(flotanteVisible('#/%6Fbservar', true, true), false);
});

test('marcador: arranca plegado en Observar; en el resto, lo recordado', () => {
  assert.equal(plegadoInicial('#/observar', false), true);
  assert.equal(plegadoInicial('#/observar/algo', false), true);
  assert.equal(plegadoInicial('#/experimentar', false), false);
  assert.equal(plegadoInicial('#/experimentar', true), true);
  assert.equal(plegadoInicial('', false), false);
});

test('marcador: la posición sigue al alto real de la barra y el aviso, y esquiva el panel', () => {
  // sin aviso (main a 56px) y sin panel
  assert.deepEqual(posicionMarcador({ arribaContenido: 56, anchoVentana: 1400 }), {
    top: 56 + MARGEN,
    right: MARGEN_DERECHO,
  });
  // con el aviso en dos líneas: más abajo
  assert.equal(posicionMarcador({ arribaContenido: 118.4, anchoVentana: 1400 }).top, 118 + MARGEN);
  // panel de Observar a la derecha (400px): el flotante va a su izquierda
  const lateral = { left: 1000, top: 118, width: 400 };
  assert.deepEqual(posicionMarcador({ arribaContenido: 118, anchoVentana: 1400, lateral }), {
    top: 118 + MARGEN,
    right: 400 + MARGEN_DERECHO,
  });
  // pantalla angosta: el panel va debajo del mundo y no se esquiva
  const debajo = { left: 0, top: 600, width: 800 };
  assert.equal(
    posicionMarcador({ arribaContenido: 56, anchoVentana: 800, lateral: debajo }).right,
    MARGEN_DERECHO,
  );
});

test('marcador: el resumen para lectores cambia por ronda, no por ciclo', () => {
  assert.equal(resumenRonda(null), null);
  assert.deepEqual(resumenRonda({ contests: 1, minrounds: 5 }), { fin: false, ronda: 2, de: 5 });
  // tope en la última ronda y fin
  assert.deepEqual(resumenRonda({ contests: 5, minrounds: 5 }), { fin: false, ronda: 5, de: 5 });
  assert.deepEqual(resumenRonda({ contests: 5, minrounds: 5, over: true }), { fin: true });
  // la única región viva es el resumen, no la tabla que se refresca
  const src = leer('src/lib/competir/Marcador.svelte');
  assert.equal(src.match(/aria-live=/g)?.length, 1);
  assert.match(src, /<p class="oculto" aria-live="polite">\{resumen\}<\/p>/);
});

test('recarga tras deploy: una sola vez, nunca con una corrida en memoria', () => {
  const a = memoria();
  assert.equal(recargarTrasFallo(true, a), false, 'con corrida no recarga');
  assert.equal(a.m.size, 0);
  assert.equal(recargarTrasFallo(false, a), true);
  assert.equal(a.m.get(CLAVE_RECARGA), '1');
  assert.equal(recargarTrasFallo(false, a), false, 'la segunda vez no');
  borrarMarcaRecarga(a);
  assert.equal(a.m.has(CLAVE_RECARGA), false);
  assert.equal(recargarTrasFallo(false, a), true, 'tras borrar la marca, otra vez');
  // sin almacenamiento (o si lanza) no recarga: no hay garantía de una sola vez
  assert.equal(recargarTrasFallo(false, null), false);
  const roto = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('SecurityError');
    },
  };
  assert.equal(recargarTrasFallo(false, roto), false);
  assert.doesNotThrow(() => borrarMarcaRecarga(roto));
  assert.doesNotThrow(() => borrarMarcaRecarga());
});

test('recarga tras deploy: main.js escucha vite:preloadError antes de los import()', () => {
  const main = leer('src/main.js');
  const escucha = main.indexOf("addEventListener('vite:preloadError'");
  assert.ok(escucha > 0);
  assert.ok(escucha < main.indexOf("\nimport('"), 'antes del primer import()');
  assert.match(main, /setTimeout\(\(\) => borrarMarcaRecarga\(\), ESPERA_BORRAR_MARCA\)/);
  // App: aviso de versión nueva con corrida y reintento con la misma pestaña
  const app = leer('src/App.svelte');
  assert.match(app, /t\('app\.versionNueva'\)/);
  assert.match(app, /onMismaSeccion=\{cargar\}/);
  // sin .catch vacíos
  for (const r of [
    'src/main.js',
    'src/lib/BarraSuperior.svelte',
    'src/lib/trabajos/trabajos.svelte.js',
  ])
    assert.doesNotMatch(leer(r), /\.catch\(\(\) => \{\}\)/, r);
});

test('carga perezosa: solo Inicio va estático en App.svelte', () => {
  const app = leer('src/App.svelte');
  const estaticas = [...app.matchAll(/^import\s+\w+\s+from\s+'\.\/screens\/(\w+)\.svelte';/gm)].map(
    (m) => m[1],
  );
  assert.deepEqual(estaticas, ['Inicio']);
  for (const p of ['Observar', 'Experimentar', 'Analizar', 'Bots', 'Competir'])
    assert.match(app, new RegExp(`import\\('\\./screens/${p}\\.svelte'\\)`));
});

test('carga perezosa: la cola y las migraciones no van en el chunk principal', () => {
  const main = leer('src/main.js');
  const barra = leer('src/lib/BarraSuperior.svelte');
  for (const src of [main, barra]) {
    assert.doesNotMatch(src, /^import .*trabajos\.svelte\.js';/m);
    assert.doesNotMatch(src, /^import .*migracion\.svelte\.js';/m);
  }
  assert.match(main, /import\('\.\/lib\/trabajos\/trabajos\.svelte\.js'\)/);
});

// N4.5: el chunk principal (lo que se carga al arrancar) por debajo de
// 500 kB. Se recorre el grafo de imports ESTÁTICOS desde src/main.js (los
// import() dinámicos cortan) y se verifica que no entra lo pesado:
// detectores, informes y los textos de la interfaz (un chunk por idioma).
// Los escenarios de fábrica (JSON chicos) sí van: los muestra Inicio.

/**
 * Especificadores de los import/export estáticos de un archivo (en un
 * .svelte, solo los de sus <script>). Los import() y los @typedef
 * {import(...)} no cuentan.
 * @param {string} ruta relativa a port/web2
 */
function importsEstaticos(ruta) {
  let src = leer(ruta);
  if (ruta.endsWith('.svelte'))
    src = [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  return [...src.matchAll(/^\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(
    (m) => m[1],
  );
}

/** Archivos alcanzables por imports estáticos desde `entrada` (relativos a port/web2). */
function grafoEstatico(entrada = 'src/main.js') {
  const vistos = new Set();
  const pila = [entrada];
  while (pila.length) {
    const r = /** @type {string} */ (pila.pop());
    if (vistos.has(r)) continue;
    vistos.add(r);
    if (!/\.(js|svelte)$/.test(r)) continue; // json, css: hojas
    for (const esp of importsEstaticos(r)) {
      if (!esp.startsWith('.')) continue; // svelte, node:…
      const destino = new URL(esp, new URL(`../${r}`, import.meta.url));
      const rel = decodeURIComponent(destino.pathname).split('/port/web2/')[1];
      assert.ok(rel, `${r}: import fuera de port/web2 (${esp})`);
      assert.doesNotThrow(() => readFileSync(destino), `${r}: no existe ${esp}`);
      pila.push(rel);
    }
  }
  return vistos;
}

test('chunk principal: el grafo estático desde main.js no arrastra detectores, informes ni textos', () => {
  const g = grafoEstatico();
  // el recorrido funciona: lo que la corrida necesita al arrancar sí está
  for (const r of [
    'src/App.svelte',
    'src/screens/Inicio.svelte',
    'src/lib/BarraSuperior.svelte',
    'src/lib/sim/corrida-nucleo.js',
    'src/lib/observar/detector-eventos.js',
    'engine/history.js',
    'src/i18n/index.svelte.js',
  ])
    assert.ok(g.has(r), `falta ${r} en el grafo`);
  const pesados = [...g].filter(
    (r) =>
      r === 'engine/detectors.js' ||
      r.startsWith('engine/report/') ||
      r === 'src/lib/observar/eventos.js' ||
      /^src\/i18n\/idioma-/.test(r) ||
      (r.startsWith('src/i18n/') && r.endsWith('.json')),
  );
  assert.deepEqual(pesados, [], 'módulos pesados en el chunk principal');
  // ningún módulo del arranque junta archivos con un glob eager
  for (const r of g)
    if (/\.(js|svelte)$/.test(r))
      assert.doesNotMatch(leer(r), /import\.meta\.glob\([^)]*eager:\s*true/, r);
});

test('i18n: un chunk por idioma, el inicial se espera antes de montar', () => {
  const i18n = leer('src/i18n/index.svelte.js');
  assert.match(i18n, /es: \(\) => import\('\.\/idioma-es\.js'\)/);
  assert.match(i18n, /en: \(\) => import\('\.\/idioma-en\.js'\)/);
  // await de nivel superior: main.js no monta sin textos. Fuera de toda
  // función (a lo sumo dentro de un try), sin depender del formato: se
  // quitan comentarios y cadenas y se mira qué abre cada llave previa.
  const codigo = i18n
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    .replace(/'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, "''");
  const i = codigo.indexOf('await cargarIdioma(');
  assert.ok(i > 0, 'falta el await de cargarIdioma');
  /** @type {boolean[]} por cada llave abierta: ¿es la de un try? */
  const pila = [];
  for (const m of codigo.slice(0, i).matchAll(/[{}]/g)) {
    if (m[0] === '{') pila.push(/\btry\s*$/.test(codigo.slice(0, m.index)));
    else pila.pop();
  }
  assert.ok(pila.length <= 1 && pila.every(Boolean), 'el await va a nivel de módulo');
  assert.match(codigo.slice(i), /^await cargarIdioma\(\s*inicial\s*\)/);
  for (const l of ['es', 'en']) {
    const src = leer(`src/i18n/idioma-${l}.js`);
    assert.ok(src.includes(`import.meta.glob('./${l}/*.json', { eager: true`), l);
  }
});

test('i18n: si el idioma no baja, aviso en vez de recargas repetidas', () => {
  const i18n = leer('src/i18n/index.svelte.js');
  // idioma inicial: recarga una vez; si no puede, el aviso de index.html ya
  const arranque = i18n.slice(i18n.indexOf('await cargarIdioma('));
  const recarga = arranque.indexOf('recargarTrasFallo(false)');
  const aviso = arranque.indexOf('.__avisoCarga?.()');
  assert.ok(recarga > 0 && aviso > recarga, 'aviso tras intentar recargar');
  assert.ok(aviso < arranque.indexOf('throw e;'), 'aviso antes de seguir el error');
  const html = leer('index.html');
  assert.match(html, /window\.__avisoCarga = \(\) => \{/);
  assert.match(html, /setTimeout\(\(\) => window\.__avisoCarga\(\), 8000\)/);
  assert.match(html, /app\.childElementCount > 0\) return;/, 'idempotente');
  // setIdioma: devuelve boolean y recarga solo sin corrida y con su propia
  // marca (la de lib/recarga.js se borra al montar: habría una recarga por
  // clic sin red); si no, false
  const fn = i18n.slice(i18n.indexOf('export async function setIdioma('));
  assert.match(fn, /^export async function setIdioma\(codigo, \{ hayCorrida = true \} = \{\}\)/);
  assert.match(i18n, /@returns \{Promise<boolean>\}/);
  assert.match(fn, /if \(recargarPorIdioma\(hayCorrida\)\) \{/);
  assert.match(fn, /return false;/);
  assert.match(i18n, /if \(hayCorrida \|\| !a\) return false;/);
  assert.match(i18n, /if \(a\.getItem\(CLAVE_RECARGA_IDIOMA\)\) return false;/);
  assert.notEqual(/CLAVE_RECARGA_IDIOMA = '([^']+)'/.exec(i18n)?.[1], CLAVE_RECARGA);
  // barra: dice si hay corrida y avisa con t() en una región viva fija
  const barra = leer('src/lib/BarraSuperior.svelte');
  assert.match(barra, /await setIdioma\(cod, \{ hayCorrida: !!actual\.corrida \}\)/);
  assert.match(barra, /onclick=\{\(\) => elegirIdioma\(cod\)\}/);
  assert.match(
    barra,
    /<span class="aviso-idioma" role="status" aria-live="polite"\s*>\{idiomaFallido \? t\('app\.idioma\.error'/,
  );
});

test('eventos: el detector vive aparte y eventos.js lo reexporta sin copiarlo', async () => {
  assert.deepEqual(importsEstaticos('src/lib/observar/detector-eventos.js'), []);
  assert.match(
    leer('src/lib/sim/corrida-nucleo.js'),
    /^import \{ DetectorEventos, especiesNuevas \} from '\.\.\/observar\/detector-eventos\.js';$/m,
  );
  const ev = await import('../src/lib/observar/eventos.js');
  const det = await import('../src/lib/observar/detector-eventos.js');
  for (const k of [
    'CAIDA_PICO',
    'MEJORA_PICO',
    'MIN_PICO',
    'hitoGeneracion',
    'DetectorEventos',
    'especiesNuevas',
  ])
    assert.equal(/** @type {any} */ (ev)[k], /** @type {any} */ (det)[k], k);
});
