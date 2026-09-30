// @ts-check
// Comprobaciones comunes de los informes (engine/report/): HTML válido en lo
// básico y autocontenido, ids únicos y enlaces internos resueltos, datos
// embebidos parseables y figuras dentro de su tamaño.
import assert from 'node:assert/strict';

/** Comprobaciones básicas de un informe. @param {string} html */
export function validar(html) {
  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(html.match(/<html[\s>]/g)?.length, 1, 'una sola etiqueta html');
  assert.equal(html.match(/<\/html>/g)?.length, 1);
  assert.equal(html.match(/<head>/g)?.length, 1);
  assert.equal(html.match(/<body[\s>]/g)?.length, 1);
  assert.doesNotMatch(html, /https?:\/\//i, 'sin URLs externas');
  assert.doesNotMatch(html, /<[^>]+\ssrc\s*=/i, 'ninguna etiqueta con src=');
  assert.doesNotMatch(html, /<link[\s>]/i, 'sin hojas de estilo externas');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  assert.doesNotMatch(css, /@import|url\(/i, 'sin recursos desde el CSS');
  assert.doesNotMatch(html, /\boriginal\b/i);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  assert.equal(ids.size, [...html.matchAll(/\sid="([^"]+)"/g)].length, 'ids únicos');
  for (const m of html.matchAll(/href="#([^"]*)"/g)) assert.ok(ids.has(m[1]), `#${m[1]} existe`);
  const datos = html.match(
    /<script type="application\/json" id="datos-informe">([\s\S]*?)<\/script>/,
  );
  assert.ok(datos, 'datos embebidos');
  assert.doesNotMatch(datos[1], /</, 'el JSON embebido no trae <');
  // los <script> se cierran donde deben: 2 aperturas, 2 cierres
  assert.equal(html.match(/<script[\s>]/g)?.length, 2);
  assert.equal(html.match(/<\/script>/g)?.length, 2);
  return JSON.parse(datos[1]);
}

/**
 * Cada <svg> tiene width/height = viewBox y todas las coordenadas de sus
 * trazos, rectángulos y textos caen dentro.
 * @param {string} html
 */
export function figurasEnTamaño(html) {
  let n = 0;
  for (const m of html.matchAll(
    /<svg width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"[^>]*>([\s\S]*?)<\/svg>/g,
  )) {
    n++;
    const [W, H, VW, VH] = [m[1], m[2], m[3], m[4]].map(Number);
    assert.equal(W, VW);
    assert.equal(H, VH);
    const cuerpo = m[5];
    for (const d of cuerpo.matchAll(/ d="([^"]+)"/g)) {
      // pares absolutos (M/L x y) y comandos H/V
      for (const p of d[1].matchAll(/([MLHV])([-\d.]+)(?: ([-\d.]+))?/g)) {
        const a = Number(p[2]);
        const b = p[3] === undefined ? null : Number(p[3]);
        if (p[1] === 'H') assert.ok(a >= 0 && a <= W, `H ${a} en [0, ${W}]`);
        else if (p[1] === 'V') assert.ok(a >= 0 && a <= H, `V ${a} en [0, ${H}]`);
        else {
          assert.ok(a >= 0 && a <= W, `x ${a} en [0, ${W}]`);
          assert.ok(b !== null && b >= 0 && b <= H, `y ${b} en [0, ${H}]`);
        }
      }
    }
    for (const t of cuerpo.matchAll(/<(?:text|rect) x="([-\d.]+)" y="([-\d.]+)"/g)) {
      assert.ok(Number(t[1]) >= 0 && Number(t[1]) <= W, `text x ${t[1]}`);
      assert.ok(Number(t[2]) >= 0 && Number(t[2]) <= H, `text y ${t[2]}`);
    }
  }
  return n;
}
