// @ts-check
// Replica en desarrollo y en `vite preview` el layout de Pages (decisión C2):
// `/build-wasm/*` sale de port/build-wasm/ y `/classic/*` de port/web/.

import { Buffer } from 'node:buffer';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = fileURLToPath(new URL('.', import.meta.url));

/** Prefijo de URL → carpeta en disco. */
export const MONTAJES = [
  { prefijo: '/build-wasm/', carpeta: resolve(aqui, '../build-wasm') },
  { prefijo: '/classic/', carpeta: resolve(aqui, '../web') },
];

/** @type {Record<string, string>} */
const TIPOS = {
  '.wasm': 'application/wasm',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/**
 * Tipo de contenido según la extensión.
 * @param {string} ruta
 * @returns {string}
 */
export function tipoDe(ruta) {
  return TIPOS[extname(ruta).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Resuelve una URL contra una carpeta sin salir de ella.
 * Devuelve null si la ruta escapa (`..`, rutas absolutas, bytes nulos).
 * @param {string} carpeta carpeta raíz absoluta
 * @param {string} resto parte de la URL tras el prefijo, sin query
 * @returns {string | null}
 */
export function resolverSeguro(carpeta, resto) {
  let rel;
  try {
    rel = decodeURIComponent(resto);
  } catch {
    return null;
  }
  if (rel.includes('\0')) return null;
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const raiz = resolve(carpeta);
  const destino = resolve(join(raiz, rel));
  if (destino !== raiz && !destino.startsWith(raiz + sep)) return null;
  return destino;
}

/**
 * Responde un texto plano con su código y largo.
 * @param {import('node:http').ServerResponse} res
 * @param {number} codigo
 * @param {string} texto
 */
function responderTexto(res, codigo, texto) {
  res.statusCode = codigo;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(texto));
  res.end(texto);
}

/** @typedef {{ prefijo: string, carpeta: string }} Montaje */

/**
 * Middleware connect que sirve los montajes dados (solo GET y HEAD).
 * @param {Montaje[]} montajes
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void}
 */
export const crearMiddleware = (montajes) => (req, res, next) => {
  const url = (req.url ?? '').split(/[?#]/)[0];
  const montaje = montajes.find((m) => url.startsWith(m.prefijo) || url === m.prefijo.slice(0, -1));
  if (!montaje) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    responderTexto(res, 405, '405');
    return;
  }
  if (url === montaje.prefijo.slice(0, -1)) {
    res.statusCode = 301;
    res.setHeader('Location', montaje.prefijo);
    res.setHeader('Content-Length', 0);
    res.end();
    return;
  }
  const archivo = resolverSeguro(montaje.carpeta, url.slice(montaje.prefijo.length));
  /** @type {import('node:fs').Stats | null} */
  let info = null;
  if (archivo) {
    try {
      info = statSync(archivo);
    } catch {
      info = null;
    }
  }
  if (!archivo || !info?.isFile()) {
    responderTexto(res, 404, '404');
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', tipoDe(archivo));
  res.setHeader('Content-Length', info.size);
  res.setHeader('Cache-Control', 'no-cache');
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const flujo = createReadStream(archivo);
  flujo.on('error', () => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.removeHeader('Cache-Control');
    responderTexto(res, 500, '500');
  });
  flujo.pipe(res);
};

const middleware = crearMiddleware(MONTAJES);

/** @returns {import('vite').Plugin} */
export default function sitio() {
  return {
    name: 'darwinbots-sitio',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
