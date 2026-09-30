// @ts-check
// Colores del render (mismos valores que la vista clásica, port/web/index.html).

/**
 * Long BGR (el color de VB6: r + g·256 + b·65536) → CSS.
 * @param {number} c
 * @returns {string}
 */
export function vbACss(c) {
  const n = c | 0;
  return `rgb(${n & 0xff},${(n >> 8) & 0xff},${(n >> 16) & 0xff})`;
}

/**
 * CSS `#rrggbb` → Long BGR.
 * @param {string} css
 * @returns {number}
 */
export function cssAVb(css) {
  const r = Number.parseInt(css.slice(1, 3), 16);
  const g = Number.parseInt(css.slice(3, 5), 16);
  const b = Number.parseInt(css.slice(5, 7), 16);
  return r + g * 256 + b * 65536;
}

/** Destello por tipo de shot (paleta FlashColor). */
/** @type {Record<number, string>} */
export const FLASH = {
  [-1]: '#ff0000', // robo de nrg
  [-2]: '#ffffff', // shot de nrg
  [-3]: '#0000ff', // venom
  [-4]: '#00ff00', // waste
  [-5]: '#ffff00', // poison
  [-6]: '#ff00ff', // robo de body
  [-7]: '#00ffff', // virus
};

/**
 * Color del anillo de disparo según el tipo de shot.
 * @param {number} tipo
 */
export function colorDisparo(tipo) {
  if (tipo < 0 && tipo >= -7) return FLASH[tipo];
  if (tipo === -8) return '#ff80c0'; // esperma
  return '#b0b8c8'; // shot de información (tipo > 0)
}

/** Rampa tipo viridis de 32 niveles para las lentes numéricas. */
export const RAMPA = (() => {
  const paradas = [
    [0x2c, 0x1e, 0x6b],
    [0x2f, 0x5f, 0xa8],
    [0x1f, 0xa1, 0x87],
    [0x8f, 0xd1, 0x4f],
    [0xfd, 0xe7, 0x25],
  ];
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < 32; i++) {
    const x = (i / 31) * (paradas.length - 1);
    const k = Math.min(paradas.length - 2, Math.floor(x));
    const f = x - k;
    const c = paradas[k].map((a, j) => Math.round(a + (paradas[k + 1][j] - a) * f));
    out.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
  return out;
})();

/** Degradé CSS de la rampa (para la leyenda). */
export const RAMPA_CSS = `linear-gradient(90deg, ${RAMPA.filter((_, i) => i % 4 === 0 || i === 31).join(', ')})`;
