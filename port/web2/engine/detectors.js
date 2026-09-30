// @ts-check
// Detectores del resumen automático (decisión 11 de port/web2/PLAN.md;
// Nivel 2: dominio, colapso, extinción y crecimiento del ADN), sin DOM.
//
// Cada detector es una función pura sobre la historia de una corrida
// (engine/history.js; basta algo con la misma forma: `t`, `serie()`,
// `alineada()`, `nombresEspecies()`) y devuelve una lista de hallazgos:
//
//   {tipo, clave, params, desde, hasta, figura, severidad}
//
//   tipo       'dominio' | 'colapso' | 'extincion' | 'adn'
//   clave      qué frase corresponde (el texto lo pone el informe:
//              `hallazgo.<clave>` en engine/report/textos.<idioma>.json);
//              el detector no produce texto de interfaz
//   params     valores para la frase (nombres de especie sin traducir,
//              números crudos: el informe los formatea según el idioma)
//   desde/hasta  ciclos que abarca el hallazgo
//   figura     id de la figura del informe que lo respalda (FIGURAS)
//   severidad  'info' | 'aviso' | 'alta'
//
// Si un detector no encuentra nada devuelve [] y el informe no escribe nada
// sobre él (decisión 11).
//
// Los puntos de la historia pueden venir fundidos (decisión 8): cada uno
// guarda la media de las muestras que junta, su mínimo y su máximo. Dominio,
// extinción y ADN trabajan con la media; el colapso toma el pico de la banda
// máxima y el valle de la banda mínima, y alarga su ventana al paso local
// de la historia (con puntos fundidos de miles de ciclos, una caída brusca
// queda dentro de un punto o entre dos). Las duraciones van en ciclos
// (dominio, colapso) o en puntos (extinción.muestras, colapso.sostenido,
// dominio.minMuestras), según se indica.
//
// Umbrales (UMBRALES, todos configurables con el segundo argumento):
//
//   dominio.umbral        0.5    fracción de la población que tiene que superar
//   dominio.minCiclos     5000   duración mínima del período (ciclos)
//   dominio.minMuestras   3      y en puntos
//   dominio.tolerancia    1      puntos seguidos por debajo que no cortan el período
//   dominio.minPoblacion  10     total mínimo en el punto para contarlo
//   dominio.minEspecies   2      especies presentes (con una sola, dominar es trivial)
//   dominio.contarVegetales false  los vegetales no cuentan (ni arriba ni abajo)
//   (la participación media y la máxima se calculan sobre todos los puntos
//   del período, contando 0 donde la especie falta)
//
//   colapso.caida         0.5    caída mínima desde el pico (fracción)
//   colapso.ventanaCiclos 2000   en cuántos ciclos a lo sumo tiene que ocurrir
//                                 (como mínimo, 2 pasos de la historia en ese lugar)
//   colapso.minPico       30     población mínima del pico (evita ruido)
//   colapso.relativaMax   0.2    y la caída, al menos esta fracción del máximo de la
//                                 corrida (una baja lenta hasta 0 no es un colapso)
//   colapso.sostenido     3      puntos mínimos de las ventanas que terminan en
//                                 el pico y que siguen al valle: sus medianas
//                                 también tienen que mostrar la caída y los
//                                 niveles no tocarse: percentil 90 de después
//                                 < percentil 10 de antes (un pozo de un punto
//                                 o el ruido no cuentan)
//   colapso.serie         'noVegetales'  serie global de población (los
//                                 vegetales suben y bajan con la repoblación)
//   colapso.alta          0.8    caída desde la que la severidad es 'alta'
//
//   extincion.muestras    5      puntos seguidos en 0 para confirmarla
//   extincion.ignorarRepoblacion true  un vegetal que reaparece (la repoblación
//                                 del motor) no se extinguió: solo cuenta si no
//                                 vuelve nunca
//
//   adn.cambio            0.2    cambio relativo mínimo entre el principio y el final
//   adn.r2                0.5    ajuste lineal mínimo (tendencia sostenida)
//   adn.minMuestras       10     puntos con valor
//   adn.extremos          0.1    fracción de puntos que se promedia en cada punta
//   adn.contarVegetales   false  los vegetales no cuentan
//   (el ADN se mide especie por especie: ver detectarCrecimientoAdn)
//
// agruparHallazgos() (aparte, no cambia lo que devuelven los detectores)
// junta lo repetitivo para el resumen: extinciones simultáneas, la especie
// que desaparece y vuelve una y otra vez, y un tope de frases por tipo.

/** Ids de las figuras del informe que respaldan los hallazgos. */
export const FIGURAS = Object.freeze({
  especies: 'fig-especies',
  total: 'fig-total',
  adn: 'fig-adn',
});

export const UMBRALES = Object.freeze({
  dominio: Object.freeze({
    umbral: 0.5,
    minCiclos: 5000,
    minMuestras: 3,
    tolerancia: 1,
    minPoblacion: 10,
    minEspecies: 2,
    contarVegetales: false,
  }),
  colapso: Object.freeze({
    caida: 0.5,
    ventanaCiclos: 2000,
    minPico: 30,
    relativaMax: 0.2,
    sostenido: 3,
    serie: 'noVegetales',
    alta: 0.8,
  }),
  extincion: Object.freeze({ muestras: 5, ignorarRepoblacion: true }),
  adn: Object.freeze({
    cambio: 0.2,
    r2: 0.5,
    minMuestras: 10,
    extremos: 0.1,
    contarVegetales: false,
  }),
});

/**
 * Agrupación de hallazgos para el resumen (agruparHallazgos):
 *   ventanaCiclos  2000  extinciones definitivas a lo sumo a esta distancia
 *                        (entre una y la siguiente) forman un grupo
 *   minGrupo       3     extinciones del grupo para escribir una sola frase
 *   minRetornos    2     retornos de una misma especie desde los que sus
 *                        desapariciones van en una sola frase
 *   tope           4     frases por tipo; el resto se resume en una
 */
export const AGRUPACION = Object.freeze({
  ventanaCiclos: 2000,
  minGrupo: 3,
  minRetornos: 2,
  tope: 4,
});

/**
 * @typedef {'dominio' | 'colapso' | 'extincion' | 'adn'} TipoHallazgo
 * @typedef {'info' | 'aviso' | 'alta'} Severidad
 * @typedef {{
 *   tipo: TipoHallazgo, clave: string, params: Record<string, string | number>,
 *   desde: number, hasta: number, figura: string, severidad: Severidad,
 * }} Hallazgo
 */

/**
 * Lo que los detectores usan de la historia (engine/history.js).
 * @typedef {{
 *   t: number[],
 *   serie: (nombre: string, especie?: string) => import('./history.js').Serie | null,
 *   alineada: (nombre: string, especie: string) => number[],
 *   nombresEspecies: () => string[],
 * }} HistoriaLeible
 */

/**
 * @typedef {{
 *   dominio?: Partial<typeof UMBRALES.dominio>,
 *   colapso?: Partial<typeof UMBRALES.colapso>,
 *   extincion?: Partial<typeof UMBRALES.extincion>,
 *   adn?: Partial<typeof UMBRALES.adn>,
 * }} OpcionesDetectores
 */

/** @param {number} v */
const presente = (v) => Number.isFinite(v) && v > 0;

/** Redondeo a 1 decimal (los params van crudos pero sin ruido de float32). @param {number} x */
const r1 = (x) => Math.round(x * 10) / 10;

/**
 * ¿La especie es vegetal? (la mayoría de sus puntos presentes tienen al
 * menos la mitad de sus bots vegetales).
 * @param {HistoriaLeible} h @param {string} especie
 */
export function esVegetal(h, especie) {
  const vivos = h.alineada('vivos', especie);
  const veg = h.alineada('vegetales', especie);
  let si = 0;
  let tot = 0;
  for (let g = 0; g < vivos.length; g++) {
    if (!presente(vivos[g])) continue;
    tot++;
    if (veg[g] >= vivos[g] / 2) si++;
  }
  return tot > 0 && si * 2 > tot;
}

/**
 * Dominio: una especie supera `umbral` de la población durante al menos
 * `minCiclos` ciclos (y `minMuestras` puntos). Un hallazgo por período.
 * @param {HistoriaLeible} h @param {Partial<typeof UMBRALES.dominio>} [o]
 * @returns {Hallazgo[]}
 */
export function detectarDominio(h, o = {}) {
  const u = { ...UMBRALES.dominio, ...o };
  const t = h.t;
  const G = t.length;
  if (G < 1) return [];
  const nombres = h.nombresEspecies().filter((e) => u.contarVegetales || !esVegetal(h, e));
  if (nombres.length < u.minEspecies) return [];
  const vivos = nombres.map((e) => h.alineada('vivos', e));
  const total = new Array(G).fill(0);
  const presentes = new Array(G).fill(0);
  for (const v of vivos)
    for (let g = 0; g < G; g++)
      if (presente(v[g])) {
        total[g] += v[g];
        presentes[g]++;
      }
  /** @type {Hallazgo[]} */
  const out = [];
  nombres.forEach((especie, k) => {
    const v = vivos[k];
    /** @param {number} g */
    const domina = (g) =>
      presentes[g] >= u.minEspecies &&
      total[g] >= u.minPoblacion &&
      presente(v[g]) &&
      v[g] / total[g] > u.umbral;
    let g = 0;
    while (g < G) {
      if (!domina(g)) {
        g++;
        continue;
      }
      const ini = g;
      let fin = g;
      let hueco = 0;
      for (g = g + 1; g < G; g++) {
        if (domina(g)) {
          fin = g;
          hueco = 0;
        } else if (++hueco > u.tolerancia) break;
      }
      g = fin + 1;
      // participación sobre todos los puntos del período (los huecos
      // tolerados cuentan con lo que la especie tuvo, 0 si faltaba)
      let puntos = 0;
      let conDatos = 0;
      let max = 0;
      let suma = 0;
      for (let x = ini; x <= fin; x++) {
        if (domina(x)) puntos++;
        if (!(total[x] > 0)) continue;
        conDatos++;
        const c = presente(v[x]) ? v[x] / total[x] : 0;
        max = Math.max(max, c);
        suma += c;
      }
      if (t[fin] - t[ini] < u.minCiclos || puntos < u.minMuestras) continue;
      const media = conDatos ? suma / conDatos : 0;
      out.push({
        tipo: 'dominio',
        clave: 'dominio',
        params: {
          especie,
          umbral: Math.round(u.umbral * 100),
          max: Math.round(max * 100),
          media: Math.round(media * 100),
          desde: t[ini],
          hasta: t[fin],
        },
        desde: t[ini],
        hasta: t[fin],
        figura: FIGURAS.especies,
        severidad: 'info',
      });
    }
  });
  return out;
}

/**
 * Colapso: la población (por defecto, la de no vegetales) cae al menos
 * `caida` desde un pico de al menos `minPico` bots en a lo sumo
 * `ventanaCiclos` ciclos (o dos pasos de la historia, si los puntos están
 * más separados), la caída es al menos `relativaMax` del máximo de la
 * corrida y se sostiene: entre la ventana que termina en el pico y la que
 * sigue al valle (cada una de al menos `sostenido` puntos) la mediana
 * también cae al menos `caida` y los niveles no se tocan (el percentil 90
 * de después, debajo del percentil 10 de antes): un pozo de un punto
 * o el ruido de una población chica no cuentan; si la corrida termina
 * antes de confirmarla, no escribe. El pico
 * sale de la banda máxima de los puntos y el valle de la mínima (en una
 * historia fundida la caída puede quedar dentro de un punto). El hallazgo va
 * del pico (el último punto más alto antes de la caída) al valle (que se
 * extiende mientras siga bajando).
 * @param {HistoriaLeible} h @param {Partial<typeof UMBRALES.colapso>} [o]
 * @returns {Hallazgo[]}
 */
export function detectarColapso(h, o = {}) {
  const u = { ...UMBRALES.colapso, ...o };
  const s = h.serie(u.serie) ?? (o.serie === undefined ? h.serie('vivos') : null);
  if (!s) return [];
  /** @type {number[]} */
  const t = [];
  /** @type {number[]} */
  const v = [];
  /** @type {number[]} */
  const alto = [];
  /** @type {number[]} */
  const bajo = [];
  /** @type {number[]} muestras que junta cada punto */
  const nn = [];
  s.t.forEach((x, j) => {
    const m = s.media[j];
    if (!Number.isFinite(m)) return;
    t.push(x);
    nn.push(s.n?.[j] ?? 1);
    v.push(m);
    alto.push(Number.isFinite(s.max[j]) ? Math.max(m, s.max[j]) : m);
    bajo.push(Number.isFinite(s.min[j]) ? Math.min(m, s.min[j]) : m);
  });
  const k = Math.max(1, Math.floor(u.sostenido));
  /**
   * Percentiles 10, 50 y 90 de v[a..b] (interpolación lineal).
   * @param {number} a @param {number} b
   */
  const niveles = (a, b) => {
    const x = v.slice(a, b + 1).sort((p, q) => p - q);
    /** @param {number} f */
    const q = (f) => {
      const r = f * (x.length - 1);
      const j = Math.floor(r);
      return j + 1 < x.length ? x[j] + (x[j + 1] - x[j]) * (r - j) : x[j];
    };
    return { p10: q(0.1), mediana: q(0.5), p90: q(0.9) };
  };
  /** Último ciclo que junta el punto j (su primera muestra si no está fundido). @param {number} j */
  const finDe = (j) =>
    nn[j] > 1 && j + 1 < t.length
      ? Math.round(t[j] + ((t[j + 1] - t[j]) * (nn[j] - 1)) / nn[j])
      : t[j];
  /** @type {Hallazgo[]} */
  const out = [];
  const maxCorrida = alto.reduce((m, x) => Math.max(m, x), 0);
  let i = 0;
  while (i < v.length) {
    if (!(alto[i] >= u.minPico)) {
      i++;
      continue;
    }
    // el mínimo dentro de la ventana (al menos dos pasos de la historia)
    const paso = i + 1 < t.length ? t[i + 1] - t[i] : 0;
    const ventana = Math.max(u.ventanaCiclos, 2 * paso);
    let jmin = -1;
    for (let j = i + 1; j < v.length && t[j] - t[i] <= ventana; j++)
      if (jmin < 0 || bajo[j] < bajo[jmin]) jmin = j;
    if (
      jmin < 0 ||
      (alto[i] - bajo[jmin]) / alto[i] < u.caida ||
      alto[i] - bajo[jmin] < u.relativaMax * maxCorrida
    ) {
      i++;
      continue;
    }
    // el pico real: el máximo antes del valle (desde i)
    let pico = i;
    for (let j = i; j < jmin; j++) if (alto[j] >= alto[pico]) pico = j;
    let valle = jmin;
    while (valle + 1 < v.length && bajo[valle + 1] < bajo[valle]) valle++;
    // sostenida: el nivel de antes (la ventana que termina en el pico, al
    // menos k puntos) y el de después (la que sigue al valle, al menos k
    // puntos): la mediana cae `caida` y los dos niveles no se tocan (el
    // percentil 90 de después queda debajo del percentil 10 de antes)
    if (valle + k >= v.length) {
      i++;
      continue;
    }
    let a0 = pico;
    while (a0 > 0 && (t[pico] - t[a0 - 1] <= ventana || pico - a0 + 1 < k)) a0--;
    let b1 = valle + k;
    while (b1 + 1 < v.length && t[b1 + 1] - t[valle] <= ventana) b1++;
    if (pico - a0 + 1 < k) {
      i++;
      continue;
    }
    const antes = niveles(a0, pico);
    const despues = niveles(valle + 1, b1);
    if (
      !(antes.mediana > 0) ||
      (antes.mediana - despues.mediana) / antes.mediana < u.caida ||
      despues.p90 >= antes.p10
    ) {
      i++;
      continue;
    }
    // si la caída quedó dentro de un punto fundido, el hallazgo llega al
    // final de ese punto
    const hasta = bajo[valle] < v[valle] ? finDe(valle) : t[valle];
    const caida = (alto[pico] - bajo[valle]) / alto[pico];
    out.push({
      tipo: 'colapso',
      clave: 'colapso',
      params: {
        de: Math.round(alto[pico]),
        a: Math.round(bajo[valle]),
        caida: Math.round(caida * 100),
        desde: t[pico],
        hasta,
      },
      desde: t[pico],
      hasta,
      figura: FIGURAS.total,
      severidad: caida >= u.alta ? 'alta' : 'aviso',
    });
    i = valle + 1;
  }
  return out;
}

/**
 * Extinción: una especie que tuvo bots llega a 0 y no vuelve en `muestras`
 * puntos seguidos. Si después reaparece (llegada por teleporter, siembra),
 * el hallazgo lo dice (clave 'extincion.retorno'). Un vegetal que reaparece
 * es la repoblación del motor: con `ignorarRepoblacion` solo cuenta si no
 * vuelve nunca. Una especie que aparece tarde no está extinta antes de
 * aparecer.
 * @param {HistoriaLeible} h @param {Partial<typeof UMBRALES.extincion>} [o]
 * @returns {Hallazgo[]}
 */
export function detectarExtincion(h, o = {}) {
  const u = { ...UMBRALES.extincion, ...o };
  const t = h.t;
  const G = t.length;
  /** @type {Hallazgo[]} */
  const out = [];
  for (const especie of h.nombresEspecies()) {
    const v = h.alineada('vivos', especie);
    const veg = u.ignorarRepoblacion && esVegetal(h, especie);
    let pico = 0;
    let cicloPico = 0;
    let visto = false;
    let g = 0;
    while (g < G) {
      if (presente(v[g])) {
        visto = true;
        if (v[g] > pico) {
          pico = v[g];
          cicloPico = t[g];
        }
        g++;
        continue;
      }
      if (!visto) {
        g++;
        continue;
      }
      const ini = g;
      while (g < G && !presente(v[g])) g++;
      const largo = g - ini;
      const vuelve = g < G;
      if (largo < u.muestras || (veg && vuelve)) continue;
      out.push({
        tipo: 'extincion',
        clave: vuelve ? 'extincion.retorno' : 'extincion',
        params: {
          especie,
          ciclo: t[ini],
          pico: Math.round(pico),
          cicloPico,
          ...(vuelve ? { vuelve: t[g] } : {}),
        },
        desde: t[ini],
        hasta: t[g - 1],
        figura: FIGURAS.especies,
        severidad: 'aviso',
      });
    }
  }
  return out;
}

/**
 * Crecimiento (o reducción) del ADN: tendencia sostenida de la longitud del
 * ADN, medida especie por especie para que un cambio de composición (una
 * especie de ADN largo que reemplaza a una de ADN corto, o que pasa a ser
 * mayoría) no parezca crecimiento. Entre cada punto y el anterior se toma el
 * cambio relativo de `adnMedia` de cada especie no vegetal presente en los
 * dos (media geométrica ponderada por sus bots) y se encadena en un índice
 * (1 al principio). Compara la media del índice en los primeros y los
 * últimos puntos (`extremos`) y exige un ajuste lineal con r² ≥ `r2` y la
 * misma dirección. `de` es la longitud media (ponderada por bots) de las
 * especies al principio y `a`, esa longitud con el cambio del índice.
 * Sin series por especie (una historia vieja) usa la serie global adnMedia.
 * @param {HistoriaLeible} h @param {Partial<typeof UMBRALES.adn>} [o]
 * @returns {Hallazgo[]}
 */
export function detectarCrecimientoAdn(h, o = {}) {
  const u = { ...UMBRALES.adn, ...o };
  const puntos = indiceAdn(h, u.contarVegetales);
  if (!puntos) return [];
  const { x, y, nivel } = puntos;
  const n = x.length;
  if (n < Math.max(2, u.minMuestras)) return [];
  const k = Math.max(1, Math.floor(n * u.extremos));
  const prom = (/** @type {number[]} */ a) => a.reduce((p, q) => p + q, 0) / a.length;
  const i0 = prom(y.slice(0, k));
  const i1 = prom(y.slice(n - k));
  const cambio = (i1 - i0) / i0;
  if (!(Math.abs(cambio) >= u.cambio)) return [];
  const mx = prom(x);
  const my = prom(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (!(sxx > 0 && syy > 0)) return [];
  const r2 = (sxy * sxy) / (sxx * syy);
  if (r2 < u.r2 || Math.sign(sxy) !== Math.sign(cambio)) return [];
  const de = prom(nivel.slice(0, k));
  return [
    {
      tipo: 'adn',
      clave: cambio > 0 ? 'adn.crecimiento' : 'adn.reduccion',
      params: {
        de: r1(de),
        a: r1(de * (1 + cambio)),
        cambio: Math.round(Math.abs(cambio) * 100),
        r2: Math.round(r2 * 100) / 100,
        desde: x[0],
        hasta: x[n - 1],
      },
      desde: x[0],
      hasta: x[n - 1],
      figura: FIGURAS.adn,
      severidad: 'info',
    },
  ];
}

/**
 * Índice encadenado del ADN por especie (ver detectarCrecimientoAdn): en
 * cada punto con alguna especie medida, el ciclo (`x`), el índice (`y`) y
 * la longitud media ponderada por bots (`nivel`). null si no hay datos.
 * @param {HistoriaLeible} h @param {boolean} contarVegetales
 * @returns {{x: number[], y: number[], nivel: number[]} | null}
 */
function indiceAdn(h, contarVegetales) {
  const t = h.t;
  const especies = h
    .nombresEspecies()
    .filter((e) => contarVegetales || !esVegetal(h, e))
    .map((e) => ({ vivos: h.alineada('vivos', e), adn: h.alineada('adnMedia', e) }))
    .filter((e) => e.adn.some((v, g) => presente(v) && presente(e.vivos[g])));
  /** @type {number[]} */
  const x = [];
  /** @type {number[]} */
  const y = [];
  /** @type {number[]} */
  const nivel = [];
  if (!especies.length) {
    // sin series por especie: la global
    if (h.nombresEspecies().length) return null;
    const s = h.serie('adnMedia');
    if (!s) return null;
    s.t.forEach((c, j) => {
      if (presente(s.media[j])) {
        x.push(c);
        nivel.push(s.media[j]);
      }
    });
    if (!x.length) return null;
    return { x, y: nivel.map((v) => v / nivel[0]), nivel };
  }
  let indice = 1;
  let previo = -1;
  for (let g = 0; g < t.length; g++) {
    let pesos = 0;
    let suma = 0;
    let pesosLog = 0;
    let sumaLog = 0;
    for (const e of especies) {
      const b = e.vivos[g];
      const a = e.adn[g];
      if (!presente(b) || !presente(a)) continue;
      pesos += b;
      suma += b * a;
      if (previo >= 0 && presente(e.vivos[previo]) && presente(e.adn[previo])) {
        const w = (b + e.vivos[previo]) / 2;
        pesosLog += w;
        sumaLog += w * Math.log(a / e.adn[previo]);
      }
    }
    if (!(pesos > 0)) continue;
    if (pesosLog > 0) indice *= Math.exp(sumaLog / pesosLog);
    x.push(t[g]);
    y.push(indice);
    nivel.push(suma / pesos);
    previo = g;
  }
  return x.length ? { x, y, nivel } : null;
}

/** Claves que pueden salir de los detectores (el informe tiene texto para cada una). */
export const CLAVES_HALLAZGO = Object.freeze([
  'dominio',
  'colapso',
  'extincion',
  'extincion.retorno',
  'adn.crecimiento',
  'adn.reduccion',
]);

/**
 * Todos los detectores del Nivel 2, en orden de ciclo (a igual ciclo, en
 * el orden dominio, colapso, extinción, ADN).
 * @param {HistoriaLeible} h @param {OpcionesDetectores} [o]
 * @returns {Hallazgo[]}
 */
export function detectar(h, o = {}) {
  const todos = [
    ...detectarDominio(h, o.dominio),
    ...detectarColapso(h, o.colapso),
    ...detectarExtincion(h, o.extincion),
    ...detectarCrecimientoAdn(h, o.adn),
  ];
  return todos
    .map((x, i) => ({ x, i }))
    .sort((p, q) => p.x.desde - q.x.desde || p.i - q.i)
    .map((p) => p.x);
}

/** Claves que puede agregar agruparHallazgos (el informe tiene texto para cada una). */
export const CLAVES_AGRUPADAS = Object.freeze([
  'extincion.grupo',
  'extincion.grupoCiclo',
  'extincion.intermitente',
  'extincion.intermitenteFin',
  'resto.dominio',
  'resto.colapso',
  'resto.extincion',
  'resto.adn',
]);

/**
 * Hallazgo del resumen: uno de los detectores tal cual o un grupo con la
 * misma forma (`tipo`, `clave`, `params`, `desde`, `hasta`, `figura`,
 * `severidad`) y además `hallazgos`, los que junta.
 * @typedef {Hallazgo & {hallazgos?: Hallazgo[]}} HallazgoAgrupado
 */

const RANGO_SEVERIDAD = { alta: 2, aviso: 1, info: 0 };

/**
 * Junta los hallazgos repetitivos para el resumen (no cambia la salida de
 * los detectores: es un paso aparte que usa el informe):
 *
 *   - una especie que desaparece y vuelve `minRetornos` veces o más va en
 *     una sola frase ('extincion.intermitente', o 'extincion.intermitenteFin'
 *     si al final se extinguió), en vez de una por vuelta;
 *   - `minGrupo` extinciones definitivas o más, cada una a lo sumo a
 *     `ventanaCiclos` de la anterior, van en una frase ('extincion.grupo', o
 *     'extincion.grupoCiclo' si fueron en el mismo ciclo), con hasta tres
 *     nombres (las de pico más alto) en `ejemplos`;
 *   - cada tipo escribe a lo sumo `tope` frases: las `tope - 1` más
 *     importantes (severidad y magnitud) y una más que resume el resto
 *     ('resto.<tipo>', con `n` = hallazgos que resume).
 *
 * Devuelve la lista en orden de ciclo. Los que no se agrupan salen tal cual.
 * @param {Hallazgo[]} hallazgos @param {Partial<typeof AGRUPACION>} [o]
 * @returns {HallazgoAgrupado[]}
 */
export function agruparHallazgos(hallazgos, o = {}) {
  const u = { ...AGRUPACION, ...o };
  /** @type {HallazgoAgrupado[]} */
  let lista = [];
  // 1. la especie que va y vuelve
  /** @type {Map<string, Hallazgo[]>} */
  const porEspecie = new Map();
  for (const x of hallazgos)
    if (x.tipo === 'extincion') {
      const e = String(x.params.especie);
      porEspecie.set(e, [...(porEspecie.get(e) ?? []), x]);
    }
  /** @type {Set<Hallazgo>} */
  const usados = new Set();
  /** @type {Map<Hallazgo, HallazgoAgrupado>} */
  const enLugarDe = new Map();
  for (const [especie, xs] of porEspecie) {
    const retornos = xs.filter((x) => x.clave === 'extincion.retorno');
    if (retornos.length < Math.max(1, u.minRetornos)) continue;
    const final = xs.find((x) => x.clave === 'extincion');
    const desde = Math.min(...xs.map((x) => x.desde));
    const hasta = final
      ? Number(final.params.ciclo)
      : Math.max(...retornos.map((x) => Number(x.params.vuelve)));
    for (const x of xs) usados.add(x);
    enLugarDe.set(xs[0], {
      tipo: 'extincion',
      clave: final ? 'extincion.intermitenteFin' : 'extincion.intermitente',
      params: { especie, veces: retornos.length, desde, hasta },
      desde,
      hasta: Math.max(...xs.map((x) => x.hasta)),
      figura: xs[0].figura,
      severidad: final ? 'aviso' : 'info',
      hallazgos: xs,
    });
  }
  // 2. extinciones definitivas cercanas
  const definitivas = hallazgos
    .filter((x) => x.clave === 'extincion' && !usados.has(x))
    .sort((a, b) => a.desde - b.desde);
  /** @type {Hallazgo[][]} */
  const grupos = [];
  for (const x of definitivas) {
    const g = grupos[grupos.length - 1];
    if (g && x.desde - g[g.length - 1].desde <= u.ventanaCiclos) g.push(x);
    else grupos.push([x]);
  }
  for (const g of grupos) {
    if (g.length < Math.max(2, u.minGrupo)) continue;
    for (const x of g) usados.add(x);
    const desde = g[0].desde;
    const ultimo = g[g.length - 1].desde;
    const nombres = [...g]
      .sort((a, b) => Number(b.params.pico) - Number(a.params.pico))
      .map((x) => String(x.params.especie));
    const ejemplos = nombres.slice(0, 3).join(', ') + (nombres.length > 3 ? ', …' : '');
    enLugarDe.set(g[0], {
      tipo: 'extincion',
      clave: desde === ultimo ? 'extincion.grupoCiclo' : 'extincion.grupo',
      params:
        desde === ultimo
          ? { n: g.length, ciclo: desde, ejemplos }
          : { n: g.length, desde, hasta: ultimo, ejemplos },
      desde,
      hasta: Math.max(...g.map((x) => x.hasta)),
      figura: g[0].figura,
      severidad: 'aviso',
      hallazgos: g,
    });
  }
  for (const x of hallazgos) {
    const r = enLugarDe.get(x);
    if (r) lista.push(r);
    else if (!usados.has(x)) lista.push(x);
  }
  // 3. tope de frases por tipo
  const tope = Math.max(1, Math.floor(u.tope));
  /** @param {HallazgoAgrupado} x */
  const magnitud = (x) =>
    Number(x.params.n ?? x.params.veces ?? x.params.pico ?? x.params.caida ?? x.params.max ?? 0) ||
    0;
  /** @type {Set<HallazgoAgrupado>} */
  const fuera = new Set();
  /** @type {HallazgoAgrupado[]} */
  const restos = [];
  for (const tipo of new Set(lista.map((x) => x.tipo))) {
    const deTipo = lista.filter((x) => x.tipo === tipo);
    if (deTipo.length <= tope) continue;
    const orden = [...deTipo].sort(
      (a, b) =>
        RANGO_SEVERIDAD[b.severidad] - RANGO_SEVERIDAD[a.severidad] ||
        magnitud(b) - magnitud(a) ||
        a.desde - b.desde,
    );
    const resto = orden.slice(tope - 1);
    for (const x of resto) fuera.add(x);
    const todos = resto.flatMap((x) => x.hallazgos ?? [x]);
    const desde = Math.min(...resto.map((x) => x.desde));
    const hasta = Math.max(...resto.map((x) => x.hasta));
    // una extinción «ocurre» en su desde (su hasta es el final de la ausencia)
    const ultimo = tipo === 'extincion' ? Math.max(...resto.map((x) => x.desde)) : hasta;
    restos.push({
      tipo,
      clave: `resto.${tipo}`,
      params: { n: todos.length, desde, hasta: ultimo },
      desde,
      hasta,
      figura: resto[0].figura,
      severidad: 'info',
      hallazgos: todos,
    });
  }
  lista = [...lista.filter((x) => !fuera.has(x)), ...restos];
  return lista
    .map((x, i) => ({ x, i }))
    .sort((p, q) => p.x.desde - q.x.desde || p.i - q.i)
    .map((p) => p.x);
}
