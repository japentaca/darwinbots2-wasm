// @ts-check
// Editor de ADN, correcciones de la revisión (N3.3), sin DOM:
//   - autocompletado: la coincidencia exacta primero; Enter con el nombre
//     completo no acepta (esExacta);
//   - «hay cambios» y guardar versión por el texto exacto (lg), no por el
//     hash: comentarios, cabecera y sangría también se guardan;
//   - borrador por bot (sesión + localStorage, tolerante a fallos);
//   - «Probar»: base F1 por defecto o sin costos, semilla elegible, hijos
//     directos;
//   - insertarGen con `end` en la misma línea que código (y sus orígenes),
//     apagar sin duplicar el prefijo, comentarios con / y `def` como el
//     core, CRLF → LF, y el linter que no queda esperando si el wasm falla.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashAdn, lgHash } from '../engine/adn.js';
import { almacenMemoria } from '../engine/almacen.js';
import { crearBots, mismoTexto } from '../engine/bots.js';
import {
  apagarGen,
  aplicarAccion,
  bloquesAdn,
  genesTexto,
  insertarGen,
  PREFIJO_APAGADO,
  tokensTexto,
} from '../engine/lab.js';
import { genesAdn, palabrasAdn } from '../engine/lineage.js';
import { esExacta, palabraEnCurso, sugerencias } from '../src/lib/bots/editor/autocompletar.js';
import { aLf, crearBorradores } from '../src/lib/bots/editor/borrador.js';
import { crearLinter, ErrorLint } from '../src/lib/bots/editor/linter.js';
import {
  claseDe,
  crearResaltador,
  defsDe,
  resaltarHtml,
  textoDeHtml,
} from '../src/lib/bots/editor/resaltado.js';
import {
  crearParamsPrueba,
  ErrorPrueba,
  escenarioPrueba,
  POR_DEFECTO,
  resumirVersion,
  vistaPrueba,
} from '../src/lib/trabajos/prueba.js';

test('autocompletado: la coincidencia exacta va primero (sin distinguir mayúsculas)', () => {
  for (const p of ['aim', 'vel', 'refvel', 'refaim', 'trefaim', 'AIM', 'RefVel']) {
    const s = sugerencias(p, '');
    assert.equal(s[0].nombre.toLowerCase(), p.toLowerCase(), `.${p}`);
    assert.ok(esExacta(p, ''), `.${p} ya es un nombre`);
  }
  // `aimdx` antes de `aim` en la tabla del core: igual va segundo
  assert.equal(sugerencias('aim', '')[1].nombre.toLowerCase().startsWith('aim'), true);
  // def upx + .up: `up` (exacta) primero, la privada `upx` después
  const adn = 'def upx 971\ncond\n*.up';
  const s = sugerencias('up', adn);
  assert.equal(s[0].nombre, 'up');
  assert.equal(s[0].privada, false);
  assert.equal(s[1].nombre, 'upx');
  assert.equal(s[1].privada, true);
  assert.equal(esExacta('up', adn), true, 'Enter hace el salto de línea');
  assert.equal(esExacta('upx', adn), true);
  assert.equal(esExacta('upx', ''), false, 'sin el def no es un nombre');
  assert.equal(esExacta('ey', adn), false, 'a medias: Enter acepta la sugerencia');
  assert.equal(esExacta('', adn), false);
});

test('guardar versión por el texto exacto: comentarios, cabecera y sangría cuentan', async () => {
  const bots = crearBots({ almacen: almacenMemoria() });
  const adn = "' Mi bot\ncond\n*.eye5 0 =\nstart\n10 .up store\nstop\n";
  const b = await bots.crear({ nombre: 'Mío', adn });
  assert.equal(await bots.guardarVersion(b.hash, adn), null, 'el mismo texto: nada');
  const variantes = [
    "' Mi bot, ahora con cabecera nueva\ncond\n*.eye5 0 =\nstart\n10 .up store\nstop\n",
    "' Mi bot, ahora con cabecera nueva\ncond\n  *.eye5 0 =\nstart\n  10 .up store\nstop\n",
    "' Mi bot, ahora con cabecera nueva\ncond\n  *.eye5 0 =\n' avanza\nstart\n  10 .up store\nstop\n",
  ];
  let n = 1;
  for (const v of variantes) {
    assert.equal(hashAdn(v), hashAdn(adn), 'el hash (identidad) no cambia');
    const r = await bots.guardarVersion(b.hash, v);
    assert.ok(r, 'se guarda');
    n++;
    const ult = r.versiones[r.versiones.length - 1];
    assert.equal(ult.n, n);
    assert.equal(ult.adn, v);
    assert.equal(ult.lg, lgHash(v));
    assert.equal(ult.hash, hashAdn(adn));
  }
  assert.equal(await bots.guardarVersion(b.hash, variantes[2]), null);
  assert.equal(mismoTexto({ adn: 'a' }, 'a'), true);
  assert.equal(mismoTexto({ adn: 'a' }, 'a '), false);
  assert.equal(mismoTexto({ lg: lgHash('x y') }, 'x y'), true, 'sin adn: por lg');
});

test('borrador por bot: sobrevive a desmontar (sesión) y a recargar (localStorage)', () => {
  /** @type {Map<string, string>} */
  const disco = new Map();
  const almacen = {
    getItem: (/** @type {string} */ k) => disco.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => {
      disco.set(k, v);
    },
    removeItem: (/** @type {string} */ k) => {
      disco.delete(k);
    },
  };
  const a = crearBorradores({ almacen, mapa: new Map() });
  a.guardar('p:1', 'cond start stop', 'start stop');
  assert.equal(a.leer('p:1')?.texto, 'cond start stop');
  assert.equal(a.leer('p:1')?.base, 'start stop');
  // «recarga»: sesión nueva, mismo almacenamiento
  const b = crearBorradores({ almacen, mapa: new Map() });
  assert.equal(b.leer('p:1')?.texto, 'cond start stop');
  assert.equal(b.leer('p:2'), null);
  // igual a lo guardado: se borra
  b.guardar('p:1', 'start stop', 'start stop');
  assert.equal(b.leer('p:1'), null);
  assert.equal(disco.size, 0);
  // almacenamiento que falla (lleno, privado): queda el de la sesión
  const roto = {
    getItem: () => {
      throw new Error('no');
    },
    setItem: () => {
      throw new Error('lleno');
    },
    removeItem: () => {
      throw new Error('no');
    },
  };
  const c = crearBorradores({ almacen: roto, mapa: new Map() });
  c.guardar('p:3', 'x', 'y');
  assert.equal(c.leer('p:3')?.texto, 'x');
  c.borrar('p:3');
  assert.equal(c.leer('p:3'), null);
  // sin almacenamiento
  const d = crearBorradores({ almacen: null, mapa: new Map() });
  d.guardar('p:4', 'x', 'y');
  assert.equal(d.leer('p:4')?.texto, 'x');
  // basura en el almacenamiento: se ignora
  disco.set('dbw2.editor.borrador:p:5', '{roto');
  assert.equal(crearBorradores({ almacen, mapa: new Map() }).leer('p:5'), null);
  // CRLF → LF
  assert.equal(aLf('a\r\nb\rc\n'), 'a\nb\nc\n');
});

test('Probar: base F1 por defecto o sin costos, semilla elegible, hijos directos', () => {
  const adn = 'cond start 10 .up store stop';
  const base = { clave: 'p:1', nombre: 'x', adn, modo: 'solo' };
  const p = crearParamsPrueba(base);
  assert.equal(POR_DEFECTO.base, 'f1');
  assert.equal(p.base, 'f1');
  assert.equal(escenarioPrueba(p, adn).opciones.base, 'f1');
  const sc = crearParamsPrueba({ ...base, base: 'clasica', semilla: 777, semillas: 3 });
  assert.equal(sc.base, 'clasica');
  assert.equal(escenarioPrueba(sc, adn).opciones.base, 'clasica');
  assert.equal(sc.semillas[0], 777, 'la semilla elegida es la primera');
  assert.equal(sc.semillas.length, 3);
  assert.equal(vistaPrueba(sc).base, 'clasica');
  // trabajos guardados antes de poder elegir: sin base = clásica
  const viejo = /** @type {any} */ ({ ...p, base: undefined });
  assert.equal(escenarioPrueba(viejo, adn).opciones.base, 'clasica');
  assert.equal(vistaPrueba(viejo).base, 'clasica');
  /** @param {string} c */
  const con = (c) => (/** @type {any} */ e) => e instanceof ErrorPrueba && e.codigo === c;
  assert.throws(() => crearParamsPrueba({ ...base, base: 'otra' }), con('base'));
  assert.throws(() => crearParamsPrueba({ ...base, semilla: 0 }), con('semilla'));
  assert.throws(() => crearParamsPrueba({ ...base, semilla: 2 ** 31 }), con('semilla'));
  // hijos por copia = hijos directos de las fundadoras (los nietos no)
  const r = resumirVersion(
    /** @type {any[]} */ ([
      { fundadores: 4, fundadoresVivos: 4, nacidos: 20, hijosDirectos: 8, vivos: 24, nrg: 2400 },
    ]),
    4,
  );
  assert.equal(r?.hijosPorCopia, 2);
  assert.equal(r?.nacidosPorCopia, 5);
});

test('insertarGen con `end` en la misma línea que código: parte la línea; orígenes correctos', () => {
  const adn =
    "' dos genes\nstart 1 .up store stop\ncond *.eye5 0 = start 2 .dx store stop end ' fin";
  const n = insertarGen(adn, 'cond\n1 1 =\nstart\n.repro inc\nstop', 'Otro #1');
  assert.deepEqual(
    genesAdn(n).genes.map((g) => g.join(' ')),
    [
      'start 1 .up store stop',
      'cond *.eye5 0 = start 2 .dx store stop',
      'cond 1 1 = start .repro inc stop',
    ],
    'el gen nuevo queda antes del end y después de los demás',
  );
  assert.ok(
    n.endsWith("stop\n' Otro #1\ncond\n1 1 =\nstart\n.repro inc\nstop\nend ' fin"),
    JSON.stringify(n),
  );
  // un gen de genes.json con su origen: queda en el lugar del gen nuevo
  const genes = {
    bots: { 'a.txt': [{ t: 'cond\n1 1 =\nstart\n.repro inc\nstop' }] },
  };
  /** @type {any[]} */
  const og = [{ hash: '0123456789abcdef', gen: 0 }, null];
  const r = aplicarAccion(
    { adn, origenes: og, genes, nombreDe: () => 'A' },
    { tipo: 'agregar-gen', archivo: 'a.txt', gen: 0 },
  );
  assert.equal(genesTexto(r.adn).length, 3);
  assert.deepEqual(r.origenes, [og[0], null, { archivo: 'a.txt', gen: 0 }]);
  // todo en una línea, con el end al final
  const una = 'start 1 .up store stop end';
  const r2 = aplicarAccion(
    { adn: una, origenes: [null], genes, nombreDe: () => 'A' },
    { tipo: 'agregar-gen', archivo: 'a.txt', gen: 0 },
  );
  assert.deepEqual(
    genesAdn(r2.adn).genes.map((g) => g[0]),
    ['start', 'cond'],
  );
  assert.deepEqual(r2.origenes, [null, { archivo: 'a.txt', gen: 0 }]);
  // con sangría: el end conserva la de su línea
  assert.ok(insertarGen('  start stop end', 'start 2 stop').endsWith('start 2 stop\n  end'));
});

test('apagar un gen que envuelve líneas ya apagadas no duplica el prefijo', () => {
  const adn = [
    'cond',
    `${PREFIJO_APAGADO}start 1 .up store stop`,
    '*.eye5 0 =',
    'start',
    '.shoot inc',
    'stop',
  ].join('\n');
  assert.equal(genesTexto(adn).length, 1);
  const off = apagarGen(adn, 0);
  assert.ok(!off.includes(`${PREFIJO_APAGADO}${PREFIJO_APAGADO}`), off);
  assert.equal(genesTexto(off).length, 0);
  assert.equal(off.split('\n').filter((l) => l.startsWith(PREFIJO_APAGADO)).length, 6);
  assert.ok(bloquesAdn(off).every((b) => b.tipo === 'apagado'));
});

test('comentarios con / y `def` como el core (resaltado, palabras, genes, privadas)', () => {
  const adn = [
    '/ comentario de línea: start stop',
    '  /otro 1 2 3',
    'def uno 5',
    'Def dos 6',
    'defensa 50',
    'cond',
    '*.uno 1 = 4 5 / 6',
    'start',
    '.uno inc',
    'stop',
  ].join('\n');
  // palabras: sin las líneas /; «4 5 / 6» (una / en medio) sí cuenta
  const pal = palabrasAdn(adn);
  assert.ok(!pal.includes('comentario') && !pal.includes('/otro'));
  assert.ok(pal.includes('/'));
  assert.deepEqual(
    tokensTexto(adn).tokens.map((k) => k.w),
    pal,
  );
  assert.deepEqual(
    genesTexto(adn).map((g) => g.palabras.join(' ')),
    genesAdn(adn).genes.map((g) => g.join(' ')),
  );
  assert.equal(genesAdn(adn).genes.length, 1, 'el start stop de la línea / no es un gen');
  // privadas: `def` en minúsculas; «defensa 50» define `nsa` (insertvar)
  assert.deepEqual([...defsDe(adn)], ['uno', 'nsa']);
  assert.equal(claseDe('.dos', defsDe(adn), new Set()), 'otra', '`Def` no define');
  const html = resaltarHtml(adn);
  assert.equal(textoDeHtml(html), `${adn}\n`, 'el HTML conserva el texto');
  // con caché por línea: el mismo HTML, también tras editar o cambiar un def
  const r = crearResaltador();
  assert.equal(r(adn), html);
  for (const otro of [`${adn} .uno`, adn.replace('def uno', 'def once'), adn])
    assert.equal(r(otro), resaltarHtml(otro));
  const lineas = html.split('\n');
  assert.ok(lineas[0].startsWith('<span class="r-com">/ comentario'), lineas[0]);
  assert.ok(lineas[1].startsWith('<span class="r-com">  /otro'), lineas[1]);
  assert.ok(lineas[2].startsWith('<span class="r-def">'));
  assert.ok(!lineas[3].includes('r-def'), '`Def` no es una línea def');
  assert.ok(lineas[4].startsWith('<span class="r-def">'));
  assert.equal(palabraEnCurso('/ *.ey', 6), null, 'no en una línea /');
});

test('el linter no queda esperando si el worker no carga', async () => {
  /** @type {((m: any) => void)[]} */
  const oyentes = [];
  let creados = 0;
  let terminados = 0;
  const linter = crearLinter({
    plazoMs: 50,
    crear: () => {
      creados++;
      return {
        enviar: () => {
          // el worker falla al cargar el wasm
          queueMicrotask(() => {
            for (const f of oyentes) f({ t: 'error', clave: 'carga', msg: 'sin wasm' });
          });
        },
        on: (fn) => {
          oyentes.push(fn);
          return () => {};
        },
        terminar: () => {
          terminados++;
        },
      };
    },
  });
  await assert.rejects(
    linter.lint('start stop'),
    (e) => e instanceof ErrorLint && e.message === 'sin wasm',
  );
  assert.equal(terminados, 1, 'el worker caído se descarta');
  await assert.rejects(linter.lint('start stop'), ErrorLint);
  assert.equal(creados, 2, 'el pedido siguiente prueba con uno nuevo');
  // un worker que nunca contesta: vence el plazo
  const mudo = crearLinter({
    plazoMs: 30,
    crear: () => ({ enviar: () => {}, on: () => () => {}, terminar: () => {} }),
  });
  await assert.rejects(mudo.lint('start stop'), ErrorLint);
  linter.cerrar();
  mudo.cerrar();
});
