// @ts-check
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_WASM, BUILD_ID, urlWasm } from '../src/build.js';

test('fuera de Vite el id es dev', () => {
  assert.equal(BUILD_ID, 'dev');
});

test('urlWasm versiona con el id del build', () => {
  assert.equal(BASE_WASM, './build-wasm/');
  assert.equal(urlWasm('dbcore.wasm'), './build-wasm/dbcore.wasm?v=dev');
  assert.equal(urlWasm('dbcore.js'), './build-wasm/dbcore.js?v=dev');
});
