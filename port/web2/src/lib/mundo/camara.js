// @ts-check
// Cámara del mundo (pura, sin DOM). Coordenadas:
//   mundo    = unidades de la sim (twips), el campo va de (0,0) a (W,H);
//   lienzo   = píxeles del canvas (ya multiplicados por devicePixelRatio).
//   lienzo = mundo · s · z + (ox, oy), con s = escalaBase(W, H, cw, ch).
// Con z = 1 el campo entero entra y queda centrado (el encuadre de siempre).

/** @typedef {{ z: number, ox: number, oy: number }} Camara */

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 64;

/** @returns {Camara} */
export function camaraNueva() {
  return { z: 1, ox: 0, oy: 0 };
}

/**
 * Píxeles de lienzo por unidad de mundo con zoom 1 (el campo entra entero).
 * @param {number} W @param {number} H @param {number} cw @param {number} ch
 */
export function escalaBase(W, H, cw, ch) {
  if (!(W > 0) || !(H > 0) || !(cw > 0) || !(ch > 0)) return 1;
  return Math.min(cw / W, ch / H);
}

/**
 * Deja la cámara en rango: zoom entre los topes y, en cada eje, el campo
 * centrado si entra o sin mostrar afuera del campo si no entra.
 * @param {Camara} cam @param {number} s @param {number} W @param {number} H
 * @param {number} cw @param {number} ch
 * @returns {Camara}
 */
export function limitar(cam, s, W, H, cw, ch) {
  cam.z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.z));
  const fw = W * s * cam.z;
  const fh = H * s * cam.z;
  cam.ox = fw <= cw ? (cw - fw) / 2 : Math.min(0, Math.max(cw - fw, cam.ox));
  cam.oy = fh <= ch ? (ch - fh) / 2 : Math.min(0, Math.max(ch - fh, cam.oy));
  return cam;
}

/**
 * Mundo → lienzo.
 * @param {Camara} cam @param {number} s @param {number} wx @param {number} wy
 * @returns {[number, number]}
 */
export function aLienzo(cam, s, wx, wy) {
  return [wx * s * cam.z + cam.ox, wy * s * cam.z + cam.oy];
}

/**
 * Lienzo → mundo.
 * @param {Camara} cam @param {number} s @param {number} px @param {number} py
 * @returns {[number, number]}
 */
export function aMundo(cam, s, px, py) {
  const k = s * cam.z;
  return [(px - cam.ox) / k, (py - cam.oy) / k];
}

/**
 * Multiplica el zoom por `factor` dejando fijo el punto (px, py) del lienzo.
 * No limita: llamar a `limitar` después.
 * @param {Camara} cam @param {number} px @param {number} py @param {number} factor
 * @returns {Camara}
 */
export function zoomEn(cam, px, py, factor) {
  const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.z * factor));
  const kx = (px - cam.ox) / cam.z;
  const ky = (py - cam.oy) / cam.z;
  cam.z = nz;
  cam.ox = px - kx * nz;
  cam.oy = py - ky * nz;
  return cam;
}

/**
 * Centra el punto de mundo (wx, wy) en el lienzo. No limita.
 * @param {Camara} cam @param {number} s @param {number} wx @param {number} wy
 * @param {number} cw @param {number} ch
 * @returns {Camara}
 */
export function centrarEn(cam, s, wx, wy, cw, ch) {
  cam.ox = cw / 2 - wx * s * cam.z;
  cam.oy = ch / 2 - wy * s * cam.z;
  return cam;
}

/**
 * Rectángulo de mundo visible: [x0, x1, y0, y1].
 * @param {Camara} cam @param {number} s @param {number} cw @param {number} ch
 * @returns {[number, number, number, number]}
 */
export function visible(cam, s, cw, ch) {
  const [x0, y0] = aMundo(cam, s, 0, 0);
  const [x1, y1] = aMundo(cam, s, cw, ch);
  return [x0, x1, y0, y1];
}

/**
 * Barra de escala: el largo "redondo" (1, 2 o 5 × 10^k unidades) cuyo largo
 * en pantalla queda más cerca de `objetivo` píxeles.
 * @param {number} pxPorUnidad píxeles de pantalla (CSS) por unidad de mundo
 * @param {number} [objetivo]
 * @returns {{ unidades: number, px: number }}
 */
export function barraEscala(pxPorUnidad, objetivo = 80) {
  if (!(pxPorUnidad > 0)) return { unidades: 0, px: 0 };
  const crudo = objetivo / pxPorUnidad;
  const k = 10 ** Math.floor(Math.log10(crudo));
  let mejor = k;
  for (const m of [1, 2, 5, 10]) {
    if (Math.abs(Math.log((m * k) / crudo)) < Math.abs(Math.log(mejor / crudo))) mejor = m * k;
  }
  return { unidades: mejor, px: mejor * pxPorUnidad };
}

/**
 * El lienzo cambió de tamaño (ventana, panel o devicePixelRatio): conserva en
 * el centro el punto de mundo que estaba en el centro, con el mismo zoom, y
 * limita. Devuelve la escala base nueva.
 * @param {Camara} cam @param {number} W @param {number} H
 * @param {number} cw0 @param {number} ch0  tamaño anterior (0 = no había)
 * @param {number} cw @param {number} ch    tamaño nuevo
 * @returns {number}
 */
export function redimensionar(cam, W, H, cw0, ch0, cw, ch) {
  const s0 = escalaBase(W, H, cw0, ch0);
  const s = escalaBase(W, H, cw, ch);
  if (cw0 > 0 && ch0 > 0 && W > 0 && H > 0) {
    const [wx, wy] = aMundo(cam, s0, cw0 / 2, ch0 / 2);
    centrarEn(cam, s, wx, wy, cw, ch);
  }
  limitar(cam, s, W, H, cw, ch);
  return s;
}

/**
 * Pantalla → mundo: (x, y) en px CSS relativos al lienzo (clientX − rect.left).
 * El lienzo mide `css · dpr` píxeles, así que primero se pasa a px de lienzo;
 * vale igual con dpr < 1 (zoom del navegador por debajo del 100 %).
 * @param {Camara} cam @param {number} s @param {number} dpr
 * @param {number} x @param {number} y
 * @returns {[number, number]}
 */
export function cssAMundo(cam, s, dpr, x, y) {
  return aMundo(cam, s, x * dpr, y * dpr);
}

/**
 * Tolerancia del clic en unidades de mundo: `px` píxeles de pantalla (CSS).
 * @param {number} px @param {number} dpr @param {number} s @param {number} z
 */
export function tolMundo(px, dpr, s, z) {
  return (px * dpr) / (s * z);
}

/**
 * Hit test (whichrob): candidato si el punto cae en la caja |dx| < r ∧ |dy| < r
 * (r = máx(radio, tol)); gana el de menor distancia al centro. Devuelve el
 * índice del bot (campo `idx` del registro) o 0 si no hay ninguno.
 * @param {Float32Array} bots  registros de bot contiguos
 * @param {number} filas       cantidad de registros válidos
 * @param {number} paso        floats por registro
 * @param {{ idx: number, x: number, y: number, r: number }} campos offsets
 * @param {number} wx @param {number} wy punto en mundo
 * @param {number} tol         radio mínimo en mundo
 */
export function botEn(bots, filas, paso, campos, wx, wy, tol) {
  let mejor = 0;
  let dist = Infinity;
  for (let i = 0; i < filas; i++) {
    const o = i * paso;
    const r = Math.max(bots[o + campos.r], tol);
    const dx = Math.abs(bots[o + campos.x] - wx);
    const dy = Math.abs(bots[o + campos.y] - wy);
    if (dx < r && dy < r) {
      const d2 = dx * dx + dy * dy;
      if (d2 < dist) {
        dist = d2;
        mejor = bots[o + campos.idx];
      }
    }
  }
  return mejor;
}
