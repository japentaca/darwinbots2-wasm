#!/usr/bin/env node
import fs from 'node:fs';
import { createRequire } from 'node:module';
// Corre un ADN unos ciclos sin dibujar (core wasm) y muestra memoria y estado.
//
//   node probar-adn.mjs bot.txt [opciones]
//   node probar-adn.mjs --adn "cond start 10 .up store stop" [opciones]
//
// Opciones:
//   --ciclos N     ciclos a correr (10)
//   --cada K       imprime cada K ciclos (1)
//   --mem a,b,c    direcciones a mostrar: nombre de sysvar (up o .up) o número
//   --qty N        bots de la especie (1)
//   --otro f.txt   segunda especie (1 bot), para probar visión, disparos, lazos
//   --vegs N       mínimo de vegetales (0: sin comida)
//   --nrg E        energía inicial (3000)
//   --semilla S    semilla del RNG (1)
//   --campo WxH    tamaño del mundo (4000x3000)
//   --set a=v,...  escribe memoria del bot 1 antes del primer ciclo
//   --cost i=v,... fija costos por índice (db_sim_set_cost); si no, valen 0
// Sin mutaciones. Imprime los avisos de db_dna_lint y, por ciclo, de cada bot
// vivo de la primera especie (hasta 4): slot, x, y, nrg, body y las --mem.
//
// Herramienta de los redactores del manual (PLAN-SITIO.md, S12): comprueba que
// un ejemplo que dice «hace X» hace X. Necesita port/build-wasm/dbcore.{js,wasm}.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'build-wasm');
const a = process.argv.slice(2);
const op = (k, d) => {
  const i = a.indexOf(k);
  if (i < 0) return d;
  const v = a[i + 1];
  a.splice(i, 2);
  return v;
};
const ciclos = +op('--ciclos', 10);
const cada = +op('--cada', 1);
const memArg = op('--mem', '');
const qty = +op('--qty', 1);
const otro = op('--otro', '');
const vegs = +op('--vegs', 0);
const nrg = +op('--nrg', 3000);
const semilla = +op('--semilla', 1);
const [cw, ch] = op('--campo', '4000x3000').split('x').map(Number);
const setArg = op('--set', '');
const costArg = op('--cost', '');
let adn = op('--adn', null);
if (adn == null) {
  if (!a[0]) {
    console.error('uso: node probar-adn.mjs bot.txt | --adn "texto" [opciones]');
    process.exit(2);
  }
  adn = fs.readFileSync(a[0], 'utf8');
}

const require = createRequire(import.meta.url);
const M = await require(path.join(BW, 'dbcore.js'))({ locateFile: (f) => path.join(BW, f) });
const C = (n, r, t) => M.cwrap(n, r, t);
const api = {
  create: C('db_sim_create', 'number', []),
  start: C('db_sim_start', null, ['number', 'number']),
  setField: C('db_sim_set_field', null, ['number', 'number', 'number']),
  tick: C('db_sim_tick', null, ['number']),
  addSpecies: C('db_sim_add_species', 'number', [
    'number',
    'string',
    'string',
    'number',
    'number',
    'number',
    'number',
    'number',
  ]),
  seed: C('db_sim_seed_species', 'number', ['number', 'number', 'number']),
  dumpBots: C('db_sim_dump_bots', 'number', ['number', 'number', 'number']),
  mem: C('db_sim_bot_mem', 'number', ['number', 'number', 'number']),
  setMem: C('db_sim_bot_set_mem', null, ['number', 'number', 'number', 'number']),
  tok0: C('db_sim_sysvar_tok0', 'number', ['number', 'string']),
  setCost: C('db_sim_set_cost', null, ['number', 'number', 'number']),
  mut: C('db_sim_set_mutations', null, ['number', 'number']),
  minvegs: C('db_sim_set_minvegs', null, ['number', 'number']),
  lint: C('db_dna_lint', 'number', ['string']),
  free: C('db_free', null, ['number']),
};

const p = api.lint(adn);
const avisos = p ? M.UTF8ToString(p) : '';
if (p) api.free(p);
console.log(avisos.trim() ? `lint:\n${avisos.trim()}` : 'lint: sin avisos');

const h = api.create();
api.setField(h, cw, ch);
api.mut(h, 0);
api.minvegs(h, vegs);
api.start(h, semilla);
for (const kv of costArg ? costArg.split(',') : []) {
  const [i, v] = kv.split('=');
  api.setCost(h, +i, +v);
}
const sp = api.addSpecies(h, adn, 'prueba', 0, 0, nrg, 0x3080ff, qty);
let sp2 = -1;
if (otro) sp2 = api.addSpecies(h, fs.readFileSync(otro, 'utf8'), 'otro', 0, 0, nrg, 0xff4040, 1);
api.seed(h, sp, 0);
if (sp2 >= 0) api.seed(h, sp2, 0);

const dir = (s) => {
  if (/^-?[0-9]+$/.test(s)) return +s;
  const n = s.startsWith('.') ? s : `.${s}`;
  const t = api.tok0(h, n);
  if (!t) throw new Error(`sysvar desconocida: ${s}`);
  return t;
};
const mems = memArg ? memArg.split(',').map((s) => [s, dir(s)]) : [];

const cap = 256;
const buf = M._malloc(cap * 20 * 4);
const F = (i) => M.HEAPF32[(buf >> 2) + i];
const vivos = () => {
  const n = api.dumpBots(h, buf, cap);
  const r = [];
  for (let i = 0; i < n; i++) {
    const o = i * 20;
    r.push({
      slot: F(o) | 0,
      x: F(o + 1),
      y: F(o + 2),
      nrg: F(o + 5),
      body: F(o + 8),
      flags: F(o + 7) | 0,
    });
  }
  return r;
};
if (setArg)
  for (const kv of setArg.split(',')) {
    const [k, v] = kv.split('=');
    const b = vivos()[0];
    if (b) api.setMem(h, b.slot, dir(k), +v);
  }
const fila = (c) => {
  const v = vivos();
  console.log(`ciclo ${c}: ${v.length} bots`);
  for (const b of v.slice(0, 4 + (sp2 >= 0 ? 1 : 0))) {
    const m = mems.map(([s, d]) => `${s}=${api.mem(h, b.slot, d)}`).join(' ');
    console.log(
      `  #${b.slot} x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} nrg=${b.nrg.toFixed(2)} body=${b.body.toFixed(2)}${b.flags & 4 ? ' cadáver' : ''} ${m}`,
    );
  }
};
fila(0);
for (let c = 1; c <= ciclos; c++) {
  api.tick(h);
  if (c % cada === 0 || c === ciclos) fila(c);
}
