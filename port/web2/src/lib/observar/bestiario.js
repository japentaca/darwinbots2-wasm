// @ts-check
// ADN de los bots del Bestiary para sembrar un escenario. Decisión C1: los
// datos se leen de `classic/bots/` (bots.json + un .txt por bot), la carpeta
// que ya publica la clásica. Se piden solo los bots que hacen falta.

/** @type {Promise<{ file: string, name: string }[]> | null} */
let indice = null;
/** @type {Map<string, Promise<string>>} */
const textos = new Map();

/** @param {string} ruta */
const url = (ruta) => new URL(`./classic/bots/${ruta}`, document.baseURI).href;

/** Índice del Bestiary (se pide una vez). */
export function indiceBestiario() {
  if (!indice) {
    indice = fetch(url('bots.json')).then((r) => {
      if (!r.ok) throw new Error(`bots.json: ${r.status}`);
      return r.json();
    });
    indice.catch(() => {
      indice = null;
    });
  }
  return indice;
}

/**
 * ADN de un bot del Bestiary por nombre exacto (undefined si no está).
 * @param {string} nombre
 * @returns {Promise<string | undefined>}
 */
export async function adnBestiario(nombre) {
  const bots = await indiceBestiario();
  const b = bots.find((x) => x.name === nombre);
  if (!b) return undefined;
  let p = textos.get(b.file);
  if (!p) {
    p = fetch(url(encodeURIComponent(b.file))).then((r) => {
      if (!r.ok) throw new Error(`${b.file}: ${r.status}`);
      return r.text();
    });
    textos.set(b.file, p);
    p.catch(() => textos.delete(b.file));
  }
  return p;
}
