#!/usr/bin/env node
// @ts-check
// Copia las skills del repositorio de .agents/skills/ (la fuente, formato
// abierto Agent Skills: la leen OpenCode, Codex, Gemini CLI…) a
// .claude/skills/, donde las busca Claude Code. Sin symlinks: en Windows git
// los guarda como texto (core.symlinks=false). Borra lo que sobre en el
// destino. test/skills.test.js falla si las dos carpetas difieren.
//
//   node port/web2/scripts/sincronizar-skills.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const ORIGEN = path.join(RAIZ, '.agents', 'skills');
export const DESTINO = path.join(RAIZ, '.claude', 'skills');

/**
 * Archivos de una carpeta, con la ruta relativa (con `/`) y su contenido.
 * @param {string} dir
 * @returns {Map<string, Buffer>}
 */
export function leerArbol(dir) {
  /** @type {Map<string, Buffer>} */
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue;
    const abs = path.join(e.parentPath, e.name);
    out.set(path.relative(dir, abs).split(path.sep).join('/'), fs.readFileSync(abs));
  }
  return out;
}

function main() {
  const origen = leerArbol(ORIGEN);
  fs.rmSync(DESTINO, { recursive: true, force: true });
  for (const [rel, contenido] of origen) {
    const abs = path.join(DESTINO, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contenido);
  }
  console.log(`${origen.size} archivos copiados a ${path.relative(process.cwd(), DESTINO)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
