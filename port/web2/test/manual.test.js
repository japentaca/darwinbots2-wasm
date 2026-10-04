// @ts-check
// Manual de darwinbots-wasm.org (port/sitio/generar.mjs; PLAN-SITIO.md S-B y S-E):
// cobertura de sysvars, operadores y parámetros, enlaces internos, el
// Markdown propio, el lint de los bloques ```adn y el manual en inglés.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  anclaParam,
  armarPaginas,
  cargarSpec,
  cargarTraduccionSpec,
  generar,
  generarTodo,
  hayWasm,
  leerMd,
  lintWasm,
  tokensApp,
} from '../../sitio/generar.mjs';
import { frontmatter, markdown } from '../../sitio/markdown.mjs';
import { leerYaml } from '../../sitio/yaml.mjs';
import { PARAMETROS } from '../engine/opciones.js';
import { COMANDOS, SYSVARS } from '../src/lib/bots/editor/vocabulario.js';

const spec = cargarSpec();

/** El manual con los .md del repo. */
async function manualReal() {
  const m = armarPaginas(spec);
  leerMd(m.paginas, m.errores);
  const r = await generar(m);
  return { m, r };
}

test('yaml: el subconjunto de la spec', () => {
  assert.deepEqual(
    leerYaml(
      'a: 1\nb: [x, "y z", 3]\nc:\n  - {k: no, v: null, w: "a:b"}\n  - d: true\n    e: -2.5\n',
    ),
    {
      a: 1,
      b: ['x', 'y z', 3],
      c: [
        { k: 'no', v: null, w: 'a:b' },
        { d: true, e: -2.5 },
      ],
    },
  );
  assert.equal(leerYaml('x: {a: 1,\n  b: 2}  # comentario\n').x.b, 2);
  assert.throws(() => leerYaml('x: {a: 1\n'), /corchetes/);
  assert.equal(spec.registros.length, 268);
  assert.ok(spec.opcodes.stores.length >= 14);
});

test('cada sysvar del vocabulario del editor tiene su página, con la dirección de la spec', () => {
  const m = armarPaginas(spec);
  assert.deepEqual(m.errores, []);
  for (const [nombre, dir] of SYSVARS) {
    const ruta = m.sysvarPorNombre.get(nombre.toLowerCase());
    assert.ok(ruta, `.${nombre} sin página`);
    const p = m.paginas.get(ruta);
    assert.ok(
      p?.datos.registros.some((/** @type {any} */ r) => r.addr === dir),
      `.${nombre}: ${dir}`,
    );
  }
  // Las 268 direcciones de la spec, en algún grupo y con página.
  for (const r of spec.registros) assert.ok(m.sysvarPorDir.has(r.addr), `dirección ${r.addr}`);
});

test('cada operador del vocabulario del editor tiene su página', () => {
  const m = armarPaginas(spec);
  for (const palabras of Object.values(COMANDOS))
    for (const w of palabras)
      assert.ok(m.operadorPorToken.get(/^[a-z]+$/i.test(w) ? w.toLowerCase() : w), w);
});

test('el manual del repo se genera sin errores y cubre todos los parámetros', async () => {
  const { m, r } = await manualReal();
  assert.deepEqual(r.errores, []);
  const html = [...r.archivos.entries()].filter(([f]) => f.endsWith('.html'));
  assert.equal(html.length, m.paginas.size);
  for (const p of PARAMETROS) {
    const ruta = m.parametroEn.get(p.clave);
    assert.ok(ruta, p.clave);
    assert.match(
      String(r.archivos.get(`${ruta}/index.html`)),
      new RegExp(`id="${anclaParam(p.clave)}"`),
      p.clave,
    );
  }
  const busqueda = JSON.parse(String(r.archivos.get('buscar.json')));
  assert.equal(busqueda.length, m.paginas.size - 1);
  assert.ok(busqueda.some((/** @type {any} */ e) => e.t === '.shoot' && e.k.includes('7')));
});

test('todo enlace interno del HTML generado apunta a un archivo generado', async () => {
  for (const { r } of await generarTodo(spec)) {
    const existe = new Set(r.archivos.keys());
    for (const [archivo, contenido] of r.archivos) {
      if (!archivo.endsWith('.html')) continue;
      const dir = archivo.split('/').slice(0, -1);
      for (const m of contenido.matchAll(/(?:href|src)="([^"#?]*)[^"]*"/g)) {
        const url = m[1];
        if (!url || /^(https?:|data:|mailto:)/.test(url)) continue;
        const partes = [...dir];
        for (const s of url.split('/')) {
          if (s === '..') partes.pop();
          else if (s && s !== '.') partes.push(s);
        }
        const destino = partes.join('/');
        // Fuera del manual (la portada, la app): lo arma armar-sitio.sh.
        if (partes.length && dir.length < url.split('/').filter((s) => s === '..').length) continue;
        const f =
          url.endsWith('/') || !url.includes('.')
            ? `${destino ? `${destino}/` : ''}index.html`
            : destino;
        assert.ok(existe.has(f), `${archivo}: ${url} → ${f}`);
      }
    }
  }
});

test('inglés: las mismas páginas, con los textos fijos en inglés y enlazadas al español', async () => {
  const [es, en] = await generarTodo(spec);
  assert.equal(en.idioma, 'en');
  assert.deepEqual(en.r.errores, []);
  assert.deepEqual([...en.r.archivos.keys()].sort(), [...es.r.archivos.keys()].sort());
  for (const p of en.m.paginas.values()) {
    assert.ok(p.titulo, `${p.ruta}: sin título`);
    const html = String(en.r.archivos.get(p.ruta ? `${p.ruta}/index.html` : 'index.html'));
    assert.match(html, /<html lang="en">/);
    // El enlace al otro idioma lleva a la misma página: subir hasta la raíz
    // del sitio (en/manual/<ruta>) y bajar a manual/<ruta>.
    const sube = '../'.repeat(p.ruta ? p.ruta.split('/').length + 2 : 2);
    assert.ok(
      html.includes(`class="idioma" href="${sube}manual/${p.ruta ? `${p.ruta}/` : ''}"`),
      p.ruta,
    );
  }
  const shoot = String(en.r.archivos.get('sysvars/shoot/index.html'));
  assert.match(shoot, /Open the app/);
  assert.match(shoot, /<dt>Address<\/dt>/);
  // Los datos de la spec sin traducir salen en español, marcados.
  assert.match(shoot, /<dd><span lang="es">/);
  assert.match(
    String(en.r.archivos.get('app/parametros-fisica/index.html')),
    /Parameters: Physics/,
  );
  const esShoot = String(es.r.archivos.get('sysvars/shoot/index.html'));
  assert.match(esShoot, /class="idioma" href="\.\.\/\.\.\/\.\.\/en\/manual\/sysvars\/shoot\/"/);
  assert.doesNotMatch(esShoot, /<span lang="es">/);
});

test('inglés: spec.yaml traduce campos de la spec y rechaza lo que no existe', async () => {
  /** @type {string[]} */
  const errores = [];
  const t = cargarTraduccionSpec(
    'en',
    spec,
    errores,
    'registros:\n  - {addr: 7, lee: "Shooting"}\n  - {addr: 5000, lee: x}\n  - {addr: 8, cite: x}\nopcodes:\n  - {token: add, sem: "a+b"}\n  - {token: nada, sem: x}\n',
  );
  assert.equal(t.registros.get(7).lee, 'Shooting');
  assert.equal(errores.length, 3, errores.join('\n'));
  const m = armarPaginas(spec, 'en');
  m.traduccion = t;
  leerMd(m.paginas, m.errores, 'en');
  const r = await generar(m);
  assert.match(
    String(r.archivos.get('sysvars/shoot/index.html')),
    /<dt>Read by<\/dt><dd>Shooting<\/dd>/,
  );
  assert.match(String(r.archivos.get('operadores/add/index.html')), /<dd>a\+b<\/dd>/);
});

test('inglés: paridad con el original y aviso de página sin traducir', async () => {
  const es = armarPaginas(spec);
  const en = armarPaginas(spec, 'en');
  const pe = /** @type {any} */ (es.paginas.get('adn/genes'));
  pe.estado = 'borrador';
  pe.cuerpo = 'Texto.\n\n```adn\nstart\nstop\n```\n';
  const pp = /** @type {any} */ (es.paginas.get('adn/pilas'));
  pp.estado = 'borrador';
  pp.cuerpo = 'Texto.\n';
  // Traducida sin el bloque adn del original, y traducida con el original pendiente.
  const ge = /** @type {any} */ (en.paginas.get('adn/genes'));
  ge.estado = 'borrador';
  ge.cuerpo = 'Text.\n';
  const ee = /** @type {any} */ (en.paginas.get('adn/estructura'));
  ee.estado = 'borrador';
  ee.cuerpo = 'Text.\n';
  const r = await generar(en, { original: es.paginas });
  assert.deepEqual(r.errores.sort(), [
    'en:adn/estructura: está traducida pero el original sigue pendiente',
    'en:adn/genes: 0 bloques adn y el original tiene 1',
  ]);
  const pilas = String(r.archivos.get('adn/pilas/index.html'));
  assert.match(
    pilas,
    /This page has not been translated yet\. <a href="\.\.\/\.\.\/\.\.\/\.\.\/manual\/adn\/pilas\/"/,
  );
  assert.match(
    String(r.archivos.get('adn/numeros/index.html')),
    /This page has not been written yet\./,
  );
});

test('extensiones: sysvars, operadores, parámetros, páginas y anclas; los rotos fallan', async () => {
  const m = armarPaginas(spec);
  const p = /** @type {any} */ (m.paginas.get('adn/genes'));
  p.cuerpo = [
    '## Uno',
    'Ver [[.shoot]], [[.aimright]], [[.7]], [[op:store]], [[op:dupint]], [[op:!=]], [[param:opt:11]],',
    '[[adn/pilas]], [[adn/pilas|las pilas]], [[adn/genes#uno]] y [[sysvars/todas]].',
    '',
    'Rotos: [[.noexiste]], [[op:nada]], [[param:opt:99999]], [[adn/nada]], [[adn/pilas#nada]].',
  ].join('\n');
  const r = await generar(m);
  const html = String(r.archivos.get('adn/genes/index.html'));
  assert.match(html, /href="\.\.\/\.\.\/sysvars\/shoot\/"><code>\.shoot<\/code>/);
  assert.match(html, /href="\.\.\/\.\.\/sysvars\/aimdx\/"><code>\.aimright<\/code>/);
  assert.match(html, /href="\.\.\/\.\.\/operadores\/dup\/"/);
  assert.match(html, /href="\.\.\/\.\.\/operadores\/distinto\/"><code>!=<\/code>/);
  assert.match(html, /href="\.\.\/\.\.\/app\/parametros-fisica\/#p-opt-11">Velocidad máxima</);
  assert.match(html, />las pilas</);
  const rotos = r.errores.filter((e) => e.startsWith('adn/genes:'));
  assert.equal(rotos.length, 5, rotos.join('\n'));
});

test('markdown: bloques, en línea y escape', () => {
  const enlace = (/** @type {string} */ d) => ({ href: `#${d}`, html: d });
  const { html, titulos } = markdown(
    [
      '# Título {#t}',
      '<!-- cita: 20-VM §5 -->',
      'Un `*.eye5` con **negrita**, _cursiva_, snake_case y <b>.',
      '',
      '- uno',
      '  - dos',
      '1. a',
      '',
      '| op | qué |',
      '|---|---|',
      '| `|` | o bit a bit |',
      '',
      ':::cuidado',
      'Ojo.',
      ':::',
    ].join('\n'),
    { enlace },
  );
  assert.deepEqual(titulos, [{ nivel: 1, texto: 'Título', ancla: 't' }]);
  assert.doesNotMatch(html, /cita/);
  assert.match(
    html,
    /<code>\*\.eye5<\/code> con <strong>negrita<\/strong>, <em>cursiva<\/em>, snake_case y &lt;b&gt;/,
  );
  assert.match(html, /<ul><li>uno<ul><li>dos<\/li><\/ul><\/li><\/ul>/);
  assert.match(html, /<ol><li>a<\/li><\/ol>/);
  assert.match(html, /<td><code>\|<\/code><\/td><td>o bit a bit<\/td>/);
  assert.match(html, /<aside class="aviso cuidado"><p>Ojo\.<\/p><\/aside>/);
  assert.deepEqual(
    frontmatter('---\ntitulo: X\nresumen: ""\netiquetas: [a, b]\n---\ncuerpo').datos,
    {
      titulo: 'X',
      resumen: '',
      etiquetas: ['a', 'b'],
    },
  );
});

test('bloques adn: coloreados, con Copiar, y al lint salvo sin-lint', async () => {
  const m = armarPaginas(spec);
  const p = /** @type {any} */ (m.paginas.get('adn/estructura'));
  p.cuerpo =
    '```adn\ncond\n*.eye5 0 >\nstart\n-1 .shoot store\nstop\n```\n\n```adn sin-lint\n.shot\n```\n';
  /** @type {any[]} */
  let vistos = [];
  const r = await generar(m, {
    lint: async (b) => {
      vistos = b;
      return [];
    },
  });
  assert.equal(vistos.length, 1);
  assert.equal(vistos[0].ruta, 'adn/estructura');
  const html = String(r.archivos.get('adn/estructura/index.html'));
  assert.match(html, /<span class="r-flu">cond<\/span>/);
  assert.match(html, /<span class="r-sys">\*\.eye5<\/span>/);
  assert.match(html, /class="copiar" data-texto="cond\n\*\.eye5 0 &gt;/);
});

test('lint de los bloques adn con el wasm', { skip: !hayWasm() && 'falta el wasm' }, async () => {
  const errores = await lintWasm([
    { ruta: 'a/b', texto: 'cond\n*.eye5 0 >\nstart\n-1 .shoot store\nstop\n' },
    { ruta: 'a/c', texto: 'start\n-1 .shot store\nstop\n' },
  ]);
  assert.equal(errores.length, 1, errores.join('\n'));
  assert.match(errores[0], /^a\/c: .*shot/);
});

test('el CSS del manual lleva los tokens de tema de la app', () => {
  const t = tokensApp();
  assert.match(t, /--acento:/);
  assert.match(t, /prefers-color-scheme: dark/);
  assert.match(t, /\[data-tema="oscuro"\]/);
});
