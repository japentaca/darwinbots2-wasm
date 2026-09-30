// @ts-check
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { crearMiddleware, resolverSeguro, tipoDe } from '../vite-plugin-sitio.js';

const raiz = resolve('/sitio/web');

test('resolverSeguro no sale de la carpeta', () => {
  assert.equal(resolverSeguro(raiz, 'worker.js'), resolve(raiz, 'worker.js'));
  assert.equal(resolverSeguro(raiz, ''), resolve(raiz, 'index.html'));
  assert.equal(resolverSeguro(raiz, 'bots/'), resolve(raiz, 'bots', 'index.html'));
  assert.equal(resolverSeguro(raiz, '../secreto'), null);
  assert.equal(resolverSeguro(raiz, '..%2f..%2fsecreto'), null);
  assert.equal(resolverSeguro(raiz, '%2e%2e/x'), null);
  assert.equal(resolverSeguro(raiz, 'a\0b'), null);
  assert.equal(resolverSeguro(raiz, '%E0%A4%A'), null);
  const r = resolverSeguro(raiz, 'bots/../index.html');
  assert.ok(r?.startsWith(raiz + sep));
});

test('tipoDe', () => {
  assert.equal(tipoDe('a.wasm'), 'application/wasm');
  assert.match(tipoDe('a.js'), /^text\/javascript/);
  assert.match(tipoDe('a.json'), /^application\/json/);
  assert.match(tipoDe('a.html'), /^text\/html/);
  assert.match(tipoDe('a.txt'), /^text\/plain/);
});

test('middleware: métodos, largo, 404 y 301', async (t) => {
  const carpeta = mkdtempSync(join(tmpdir(), 'web2-sitio-'));
  t.after(() => rmSync(carpeta, { recursive: true, force: true }));
  writeFileSync(join(carpeta, 'dbcore.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  const mw = crearMiddleware([{ prefijo: '/build-wasm/', carpeta }]);
  const servidor = createServer((req, res) =>
    mw(req, res, () => {
      res.statusCode = 418;
      res.end();
    }),
  );
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
  t.after(() => servidor.close());
  const dir = servidor.address();
  assert.ok(dir && typeof dir === 'object');
  const base = `http://127.0.0.1:${dir.port}`;

  let r = await fetch(`${base}/build-wasm/dbcore.wasm?v=abc`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/wasm');
  assert.equal(r.headers.get('content-length'), '8');
  assert.equal((await r.arrayBuffer()).byteLength, 8);

  r = await fetch(`${base}/build-wasm/dbcore.wasm`, { method: 'HEAD' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-length'), '8');

  r = await fetch(`${base}/build-wasm/dbcore.wasm`, { method: 'POST', body: 'x' });
  assert.equal(r.status, 405);
  assert.equal(r.headers.get('allow'), 'GET, HEAD');
  await r.arrayBuffer();

  r = await fetch(`${base}/build-wasm/nada.js`);
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('content-length'), '3');
  await r.arrayBuffer();

  r = await fetch(`${base}/build-wasm`, { redirect: 'manual' });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/build-wasm/');

  r = await fetch(`${base}/otra/cosa`, { method: 'POST' });
  assert.equal(r.status, 418, 'fuera de los montajes pasa al siguiente');
});
