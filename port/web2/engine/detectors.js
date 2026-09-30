// @ts-check
// Detectores del resumen automático (decisión 11 de port/web2/PLAN.md;
// Nivel 2: dominio, colapso, extinción y crecimiento del ADN; Nivel 4:
// sustitución de especie y oscilaciones), sin DOM.
//
// Cada detector es una función pura sobre la historia de una corrida
// (engine/history.js; basta algo con la misma forma: `t`, `serie()`,
// `alineada()`, `nombresEspecies()`) y devuelve una lista de hallazgos:
//
//   {tipo, clave, params, desde, hasta, figura, severidad}
//
//   tipo       'dominio' | 'colapso' | 'extincion' | 'adn' | 'sustitucion' |
//              'oscilacion'
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
// Nivel 4 (sustitución de especie y oscilaciones):
//
//   sustitucion.dominante    0.3    participación mínima (entre los no vegetales)
//                                    de la que lleva la delantera en un punto
//   sustitucion.ventaja      2      y al menos este múltiplo de la otra
//   sustitucion.minCiclos    3000   duración mínima de cada etapa (antes y después)
//   sustitucion.minMuestras  3      y en puntos
//   sustitucion.tolerancia   1      puntos seguidos sin ventaja clara que no cortan
//                                    una etapa
//   sustitucion.maxTransicion 10000 ciclos a lo sumo entre el último punto con A
//                                    adelante y el primero con B adelante (como
//                                    mínimo, 3 pasos de la historia en ese lugar)
//   sustitucion.minPoblacion 10     total de no vegetales mínimo en el punto
//   (con esas dos condiciones, dos especies estables cerca del 50/50 no
//   escriben nunca: ninguna llega a duplicar a la otra; si entre las dos
//   etapas una tercera lleva la delantera sobre ambas, no es una sustitución
//   del par sino una cascada)
//
//   oscilacion.minPeriodos   5      oscilaciones completas seguidas (con 3 o 4,
//                                    el ruido «rojo» —lento— da falsos ciclos)
//   oscilacion.tolPeriodo    0.3    cada período, a lo sumo este desvío relativo
//                                    de la media de los anteriores de la racha
//   oscilacion.maxCv         0.2    coeficiente de variación máximo de los períodos
//   oscilacion.minPuntosPeriodo 8  puntos (de la grilla uniforme) por período: con
//                                    menos, el ciclo no se resuelve (p. ej. dentro
//                                    de puntos fundidos) y no se informa
//   oscilacion.minAjuste     0.6    fracción de la varianza (sin la tendencia de
//                                    tres períodos) que explica una sinusoide del
//                                    período hallado
//   oscilacion.alias         1      historia fundida: la banda mediana de los puntos
//                                    (máx − mín) no puede pasar de esta fracción
//                                    de la amplitud (si no, puede ser el eco de un
//                                    ciclo más corto que los puntos); con 0,5 el
//                                    ruido de cada muestra (±20 bots) ensanchaba la
//                                    banda y descartaba oscilaciones reales; con 1
//                                    el eco (banda ≈ amplitud real, medias casi
//                                    planas) sigue sin pasar
//   oscilacion.amplitudMin   0.2    amplitud de pico a valle mínima, relativa al
//                                    nivel medio
//   oscilacion.banda         0.5    histéresis de los cruces: ± banda × desvío
//                                    de la serie sin tendencia
//   oscilacion.minPoblacion  10     nivel medio mínimo (bots)
//   oscilacion.minPuntos     20     puntos con valor de la serie
//   oscilacion.contarVegetales false  los vegetales no cuentan (su repoblación
//                                    sube y baja sola)
//   (se mide la población de no vegetales y la de cada especie no vegetal:
//   ver detectarOscilaciones)
//
// agruparHallazgos() (aparte, no cambia lo que devuelven los detectores)
// junta lo repetitivo para el resumen: extinciones simultáneas, la especie
// que desaparece y vuelve una y otra vez (con la oscilación que eso produce),
// las oscilaciones a la par (varias especies, o la población y sus especies,
// con el mismo período) y un tope de frases por tipo.

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
  sustitucion: Object.freeze({
    dominante: 0.3,
    ventaja: 2,
    minCiclos: 3000,
    minMuestras: 3,
    tolerancia: 1,
    maxTransicion: 10000,
    minPoblacion: 10,
  }),
  oscilacion: Object.freeze({
    minPeriodos: 5,
    tolPeriodo: 0.3,
    maxCv: 0.2,
    minPuntosPeriodo: 8,
    minAjuste: 0.6,
    alias: 1,
    amplitudMin: 0.2,
    banda: 0.5,
    minPoblacion: 10,
    minPuntos: 20,
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
 *   periodoOscilacion 0.25  oscilaciones que se superponen en el tiempo y cuyos
 *                        períodos difieren a lo sumo esta fracción (del menor)
 *                        van en una sola frase
 */
export const AGRUPACION = Object.freeze({
  ventanaCiclos: 2000,
  minGrupo: 3,
  minRetornos: 2,
  tope: 4,
  periodoOscilacion: 0.25,
});

/**
 * @typedef {'dominio' | 'colapso' | 'extincion' | 'adn' | 'sustitucion' | 'oscilacion'} TipoHallazgo
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
 *   sustitucion?: Partial<typeof UMBRALES.sustitucion>,
 *   oscilacion?: Partial<typeof UMBRALES.oscilacion>,
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

/** Mediana de una lista (NaN si está vacía). @param {number[]} a */
const mediana = (a) => {
  if (!a.length) return Number.NaN;
  const x = [...a].sort((p, q) => p - q);
  const m = x.length >> 1;
  return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
};

/** Redondeo a 2 cifras significativas (4.870 → 4.900). @param {number} x */
const dosCifras = (x) => {
  if (!(x > 0)) return 0;
  const e = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / e) * e;
};

/**
 * Sustitución de especie: una especie no vegetal A lleva la delantera sobre
 * otra B durante una etapa sostenida y, a continuación, B la lleva sobre A
 * durante otra: A pasa de mayoritaria a minoritaria mientras B hace lo
 * inverso. En cada punto (con al menos `minPoblacion` no vegetales) se
 * toman las participaciones pA y pB entre los no vegetales (0 si la especie
 * falta): A «lleva la delantera» si pA ≥ `dominante` y pA ≥ `ventaja` · pB
 * (y al revés). Una etapa son puntos así seguidos (con hasta `tolerancia`
 * puntos sin ventaja clara adentro) que duran `minCiclos` ciclos y
 * `minMuestras` puntos; las etapas más cortas no cuentan. Dos etapas
 * válidas seguidas y de signo contrario, a lo sumo a `maxTransicion` ciclos
 * (o 3 pasos de la historia) una de otra, son una sustitución, salvo que en
 * el tramo entre las dos una tercera especie lleve la delantera sobre ambas
 * en más de `tolerancia` puntos (en una cascada A → B → C se informan A → B
 * y B → C, no A → C). B puede no
 * existir antes (una especie nueva que desplaza a la de origen). Solo se
 * miran los pares de especies que llegan a `dominante` en `minMuestras`
 * puntos o más (las demás no pueden tener una etapa adelante). Trabaja con
 * la media de los puntos (una historia fundida sigue sirviendo: las etapas
 * duran muchos puntos). El hallazgo va del último punto con A adelante al
 * primero con B adelante; `ciclo` es el último cruce de las dos
 * participaciones en ese tramo; `antes`/`despues` son las participaciones
 * medianas de A en cada etapa (%) y `antesOtra`/`despuesOtra`, las de B.
 * @param {HistoriaLeible} h @param {Partial<typeof UMBRALES.sustitucion>} [o]
 * @returns {Hallazgo[]}
 */
export function detectarSustitucion(h, o = {}) {
  const u = { ...UMBRALES.sustitucion, ...o };
  const t = h.t;
  const G = t.length;
  if (G < 2) return [];
  const nombres = h.nombresEspecies().filter((e) => !esVegetal(h, e));
  if (nombres.length < 2) return [];
  const vivos = nombres.map((e) => h.alineada('vivos', e));
  const total = new Float64Array(G);
  for (const v of vivos) for (let g = 0; g < G; g++) if (presente(v[g])) total[g] += v[g];
  const ok = Array.from(total, (x) => x >= u.minPoblacion);
  // solo importan las especies que llegan a `dominante` en algún punto (las
  // demás no llevan nunca la delantera) y, para los pares, las que llegan en
  // al menos `minMuestras` puntos (sin este filtro el doble lazo es O(E²·G) y
  // cientos de especies efímeras lo vuelven lento)
  const minPts = Math.max(1, u.minMuestras);
  /** @type {Float64Array[]} participación entre los no vegetales (NaN: punto sin datos) */
  const partes = [];
  /** @type {number[]} */
  const relevantes = [];
  /** @type {number[]} */
  const cand = [];
  for (let k = 0; k < nombres.length; k++) {
    const v = vivos[k];
    let c = 0;
    for (let g = 0; g < G; g++) if (ok[g] && presente(v[g]) && v[g] / total[g] >= u.dominante) c++;
    if (!c) continue;
    const p = new Float64Array(G);
    for (let g = 0; g < G; g++) p[g] = ok[g] ? (presente(v[g]) ? v[g] / total[g] : 0) : Number.NaN;
    partes[k] = p;
    relevantes.push(k);
    if (c >= minPts) cand.push(k);
  }
  if (cand.length < 2) return [];
  // las tres especies con más participación en cada punto: en el tramo entre
  // las dos etapas de un par, una tercera puede llevar la delantera (cascada)
  const topId = new Int32Array(G * 3).fill(-1);
  const topVal = new Float64Array(G * 3);
  for (const k of relevantes)
    for (let g = 0; g < G; g++) {
      const p = partes[k][g];
      const b = g * 3;
      if (!(p > topVal[b + 2])) continue;
      let z = 2;
      while (z > 0 && p > topVal[b + z - 1]) {
        topId[b + z] = topId[b + z - 1];
        topVal[b + z] = topVal[b + z - 1];
        z--;
      }
      topId[b + z] = k;
      topVal[b + z] = p;
    }
  /** Mayor participación en g de una especie que no es a ni b. @param {number} g @param {number} a @param {number} b */
  const tercera = (g, a, b) => {
    for (let z = 0; z < 3; z++) {
      const k = topId[g * 3 + z];
      if (k !== a && k !== b) return k < 0 ? 0 : topVal[g * 3 + z];
    }
    return 0;
  };
  /** @type {Hallazgo[]} */
  const out = [];
  for (let ci = 0; ci < cand.length; ci++)
    for (let cj = ci + 1; cj < cand.length; cj++) {
      const i = cand[ci];
      const j = cand[cj];
      const pa = partes[i];
      const pb = partes[j];
      /** +1: A adelante; -1: B adelante; 0: ninguna. @param {number} g */
      const estado = (g) => {
        if (!ok[g]) return 0;
        if (pa[g] >= u.dominante && pa[g] >= u.ventaja * pb[g]) return 1;
        if (pb[g] >= u.dominante && pb[g] >= u.ventaja * pa[g]) return -1;
        return 0;
      };
      const est = t.map((_, g) => estado(g));
      /** @type {{s: number, ini: number, fin: number}[]} */
      const etapas = [];
      let g = 0;
      while (g < G) {
        const s = est[g];
        if (s === 0) {
          g++;
          continue;
        }
        const ini = g;
        let fin = g;
        let puntos = 1;
        let hueco = 0;
        for (g = g + 1; g < G; g++) {
          if (est[g] === s) {
            fin = g;
            puntos++;
            hueco = 0;
          } else if (est[g] === -s || ++hueco > u.tolerancia) break;
        }
        g = fin + 1;
        if (t[fin] - t[ini] >= u.minCiclos && puntos >= u.minMuestras) etapas.push({ s, ini, fin });
      }
      for (let k = 1; k < etapas.length; k++) {
        const p = etapas[k - 1];
        const q = etapas[k];
        if (p.s === q.s) continue;
        let paso = 0;
        for (let x = p.fin + 1; x <= q.ini; x++) paso = Math.max(paso, t[x] - t[x - 1]);
        if (t[q.ini] - t[p.fin] > Math.max(u.maxTransicion, 3 * paso)) continue;
        // A = la que iba adelante en la primera etapa
        const [a, b] = p.s > 0 ? [i, j] : [j, i];
        const pA = partes[a];
        const pB = partes[b];
        // cascada A → C → B: si en el tramo una tercera lleva la delantera
        // sobre las dos (más puntos que la tolerancia), B no desplazó a A
        let otraAdelante = 0;
        for (let x = p.fin + 1; x < q.ini; x++) {
          if (!ok[x]) continue;
          const pc = tercera(x, a, b);
          if (pc >= u.dominante && pc >= u.ventaja * Math.max(pA[x], pB[x])) otraAdelante++;
        }
        if (otraAdelante > u.tolerancia) continue;
        let ciclo = t[q.ini];
        let prev = -1;
        for (let x = p.fin; x <= q.ini; x++) {
          if (!ok[x]) continue;
          if (prev >= 0 && pA[prev] - pB[prev] > 0 && pA[x] - pB[x] <= 0) ciclo = t[x];
          prev = x;
        }
        /** @param {Float64Array} v @param {{ini: number, fin: number}} e */
        const med = (v, e) =>
          Math.round(
            mediana(Array.from(v.subarray(e.ini, e.fin + 1)).filter((x) => Number.isFinite(x))) *
              100,
          );
        out.push({
          tipo: 'sustitucion',
          clave: 'sustitucion',
          params: {
            especie: nombres[a],
            otra: nombres[b],
            antes: med(pA, p),
            despues: med(pA, q),
            antesOtra: med(pB, p),
            despuesOtra: med(pB, q),
            ciclo,
            desde: t[p.fin],
            hasta: t[q.ini],
          },
          desde: t[p.fin],
          hasta: t[q.ini],
          figura: FIGURAS.especies,
          severidad: 'info',
        });
      }
    }
  return out;
}

/**
 * Oscilaciones: ciclos poblacionales sostenidos (p. ej. depredador–presa)
 * en la población de no vegetales (clave 'oscilacion.total', figura de la
 * población total) y en cada especie no vegetal ('oscilacion', figura de
 * población por especie). Los vegetales no se miran: su repoblación sube y
 * baja sola. Con una sola especie no vegetal, la población total es la suya
 * y solo se informa la de la especie. `desde` y `hasta` son ciclos de
 * muestras de la historia.
 *
 * Método (oscilacionesDe): la serie (la media de cada punto; los huecos se
 * saltean y, en una especie, la ausencia entre su primera y su última
 * aparición cuenta 0) se lleva a una grilla uniforme con el paso más grueso
 * de la historia (una historia fundida tiene puntos de nivel y 2·nivel
 * muestras); se le quita la tendencia con una media móvil centrada (primero
 * de un tercio de la corrida, para estimar el período, y después del
 * período estimado, que borra el ciclo y deja la tendencia, sobre la serie
 * suavizada con un sexto del período); se cuentan los
 * cruces hacia arriba con histéresis (± `banda` desvíos: el ruido chico no
 * cruza) y se buscan rachas de al menos `minPeriodos` períodos parecidos
 * (cada uno a lo sumo `tolPeriodo` de la media de la racha). Una racha es
 * una oscilación si además: el coeficiente de variación de sus períodos es
 * ≤ `maxCv`; cada período tiene ≥ `minPuntosPeriodo` puntos; una sinusoide
 * de ese período explica ≥ `minAjuste` de la varianza de la serie sin
 * suavizar y sin la tendencia de tres períodos (el ruido, blanco o lento,
 * aun con cruces regulares por azar, no llega); el nivel
 * medio es ≥ `minPoblacion` y la amplitud de pico a valle (mediana de los
 * períodos) es ≥ `amplitudMin` del nivel medio. Una tendencia sin ciclos
 * no da cruces regulares. En una historia fundida la media de un punto
 * aplana los ciclos más cortos que unos pocos puntos (o los convierte en un
 * eco de período falso): si la banda mediana de los puntos (máx − mín)
 * pasa de `alias` × la amplitud, no se informa; el período más corto que
 * se puede informar es `minPuntosPeriodo` × el paso más grueso de la
 * historia (la amplitud sale algo menor que la real: la grilla y el
 * suavizado recortan los picos). Params: `periodo`
 * (ciclos, a 2 cifras), `periodos` (oscilaciones completas), `amplitud`
 * (bots, de pico a valle), `pct` (amplitud / nivel medio, %), `media`.
 * @param {HistoriaLeible} h @param {Partial<typeof UMBRALES.oscilacion>} [o]
 * @returns {Hallazgo[]}
 */
export function detectarOscilaciones(h, o = {}) {
  const u = { ...UMBRALES.oscilacion, ...o };
  /** @type {Hallazgo[]} */
  const out = [];
  /** @param {ReturnType<typeof oscilacionesDe>[number]} x @param {string | null} especie */
  const hallazgo = (x, especie) => ({
    tipo: /** @type {const} */ ('oscilacion'),
    clave: especie === null ? 'oscilacion.total' : 'oscilacion',
    params: {
      ...(especie === null ? {} : { especie }),
      periodo: dosCifras(x.periodo),
      periodos: x.periodos,
      amplitud: Math.round(x.amplitud),
      pct: Math.round((x.amplitud / x.media) * 100),
      media: Math.round(x.media),
      desde: x.desde,
      hasta: x.hasta,
    },
    desde: x.desde,
    hasta: x.hasta,
    figura: especie === null ? FIGURAS.total : FIGURAS.especies,
    severidad: /** @type {Severidad} */ ('info'),
  });
  /** @param {import('./history.js').Serie} s */
  const anchos = (s) => s.media.map((_, j) => (s.max[j] ?? Number.NaN) - (s.min[j] ?? Number.NaN));
  const especies = h.nombresEspecies().filter((e) => u.contarVegetales || !esVegetal(h, e));
  // con una sola especie (no vegetal) la población es la de esa especie: se
  // informa solo la de la especie (sin «…y con ella osciló Z»)
  const s = especies.length === 1 ? null : h.serie(u.contarVegetales ? 'vivos' : 'noVegetales');
  if (s) for (const x of oscilacionesDe(s.t, s.media, anchos(s), u)) out.push(hallazgo(x, null));
  const t = h.t;
  /** @type {Map<number, number>} */
  const indice = new Map(t.map((c, g) => [c, g]));
  for (const especie of especies) {
    const v = h.alineada('vivos', especie);
    let a = 0;
    while (a < v.length && !presente(v[a])) a++;
    let b = v.length - 1;
    while (b > a && !presente(v[b])) b--;
    if (b - a + 1 < u.minPuntos) continue;
    // ausente entre su primera y su última aparición: 0 bots
    const y = v.slice(a, b + 1).map((x) => (presente(x) ? x : 0));
    const ancho = new Array(y.length).fill(0);
    const se = h.serie('vivos', especie);
    if (se) {
      const w = anchos(se);
      se.t.forEach((c, j) => {
        const g = indice.get(c);
        if (g !== undefined && g >= a && g <= b) ancho[g - a] = w[j];
      });
    }
    for (const x of oscilacionesDe(t.slice(a, b + 1), y, ancho, u)) out.push(hallazgo(x, especie));
  }
  return out;
}

/**
 * Media móvil centrada de `w` puntos (truncada en los bordes).
 * @param {number[]} y @param {number} w
 */
function mediaMovil(y, w) {
  const n = y.length;
  const acum = [0];
  for (let i = 0; i < n; i++) acum.push(acum[i] + y[i]);
  const m = Math.max(0, Math.floor(w / 2));
  return y.map((_, i) => {
    const a = Math.max(0, i - m);
    const b = Math.min(n - 1, i + m);
    return (acum[b + 1] - acum[a]) / (b - a + 1);
  });
}

/**
 * Cruces hacia arriba con histéresis: índice en que la serie pasa de debajo
 * de -hb a encima de +hb.
 * @param {number[]} r @param {number} hb
 */
function crucesArriba(r, hb) {
  /** @type {number[]} */
  const out = [];
  let estado = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i] > hb) {
      if (estado < 0) out.push(i);
      estado = 1;
    } else if (r[i] < -hb) estado = -1;
  }
  return out;
}

/**
 * Fracción de la varianza de r[a..b) que explica c + α·cos + β·sin con
 * período `p` (en puntos), por mínimos cuadrados.
 * @param {number[]} r @param {number} a @param {number} b @param {number} p
 */
function ajusteSinusoide(r, a, b, p) {
  const w = (2 * Math.PI) / p;
  // ecuaciones normales 3×3 (1, cos, sin)
  const M = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const v = [0, 0, 0];
  for (let i = a; i < b; i++) {
    const f = [1, Math.cos(w * (i - a)), Math.sin(w * (i - a))];
    for (let x = 0; x < 3; x++) {
      v[x] += f[x] * r[i];
      for (let z = 0; z < 3; z++) M[x][z] += f[x] * f[z];
    }
  }
  /** @param {number[][]} m */
  const det = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(M);
  if (!(Math.abs(d) > 1e-12)) return 0;
  const coef = [0, 1, 2].map(
    (k) => det(M.map((fila, x) => fila.map((c, z) => (z === k ? v[x] : c)))) / d,
  );
  let media = 0;
  for (let i = a; i < b; i++) media += r[i];
  media /= b - a;
  let tot = 0;
  let res = 0;
  for (let i = a; i < b; i++) {
    const f = coef[0] + coef[1] * Math.cos(w * (i - a)) + coef[2] * Math.sin(w * (i - a));
    tot += (r[i] - media) ** 2;
    res += (r[i] - f) ** 2;
  }
  return tot > 0 ? 1 - res / tot : 0;
}

/**
 * El valor de `tt` (creciente) más cercano a `c`.
 * @param {number[]} tt @param {number} c
 */
function cicloCercano(tt, c) {
  let lo = 0;
  let hi = tt.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (tt[m] <= c) lo = m;
    else hi = m;
  }
  return Math.abs(tt[hi] - c) < Math.abs(c - tt[lo]) ? tt[hi] : tt[lo];
}

/**
 * Oscilaciones de una serie (ver detectarOscilaciones). Los valores no
 * finitos se saltean. `ancho0` es el ancho de la banda de cada punto
 * (máximo − mínimo de las muestras que junta; 0 si no está fundido).
 * @param {number[]} t0 @param {number[]} v0 @param {number[]} ancho0
 * @param {typeof UMBRALES.oscilacion} u
 * @returns {{desde: number, hasta: number, periodo: number, periodos: number, amplitud: number, media: number}[]}
 */
function oscilacionesDe(t0, v0, ancho0, u) {
  /** @type {number[]} */
  const tt = [];
  /** @type {number[]} */
  const vv = [];
  /** @type {number[]} */
  const aa = [];
  t0.forEach((c, j) => {
    if (Number.isFinite(v0[j]) && Number.isFinite(c)) {
      tt.push(c);
      vv.push(v0[j]);
      aa.push(Number.isFinite(ancho0[j]) ? Math.max(0, ancho0[j]) : 0);
    }
  });
  if (tt.length < Math.max(4, u.minPuntos)) return [];
  const pasos = tt.slice(1).map((c, j) => c - tt[j]);
  const pm = mediana(pasos);
  if (!(pm > 0)) return [];
  // el paso más grueso (sin contar los huecos, que se interpolan)
  const span = tt[tt.length - 1] - tt[0];
  const dt = Math.max(...pasos.filter((p) => p <= 3 * pm), span / 8000);
  const N = Math.floor(span / dt) + 1;
  if (N < u.minPuntos) return [];
  /** @type {number[]} */
  const y = [];
  let j = 0;
  for (let i = 0; i < N; i++) {
    const c = tt[0] + i * dt;
    while (j + 1 < tt.length - 1 && tt[j + 1] <= c) j++;
    const k = Math.min(j + 1, tt.length - 1);
    const f = tt[k] > tt[j] ? Math.min(1, Math.max(0, (c - tt[j]) / (tt[k] - tt[j]))) : 0;
    y.push(vv[j] + (vv[k] - vv[j]) * f);
  }
  /**
   * Residuo sin tendencia con una media móvil de `w` puntos.
   * @param {number[]} z @param {number} w
   */
  const sinTendencia = (z, w) => {
    const tend = mediaMovil(z, w);
    const r = z.map((x, i) => x - tend[i]);
    const sd = Math.sqrt(r.reduce((s, x) => s + x * x, 0) / r.length);
    return { tend, r, sd };
  };
  // 1. período aproximado con una tendencia de un tercio de la corrida
  const p1 = sinTendencia(y, Math.max(3, Math.round(N / 3)));
  if (!(p1.sd > 0)) return [];
  const c1 = crucesArriba(p1.r, u.banda * p1.sd);
  if (c1.length < 3) return [];
  const P1 = mediana(c1.slice(1).map((c, k) => c - c1[k]));
  // 2. suavizada (un sexto del período: el ruido de punto a punto no parte
  // los cruces) y con la tendencia de un período (borra el ciclo y deja la
  // tendencia)
  const ys = mediaMovil(y, Math.round(P1 / 6));
  const { tend, r, sd } = sinTendencia(ys, Math.max(3, Math.round(P1)));
  if (!(sd > 0)) return [];
  const cr = crucesArriba(r, u.banda * sd);
  const per = cr.slice(1).map((c, k) => c - cr[k]);
  /** @type {ReturnType<typeof oscilacionesDe>} */
  const out = [];
  let k = 0;
  while (k < per.length) {
    let m = per[k];
    let fin = k + 1;
    while (fin < per.length && Math.abs(per[fin] - m) <= u.tolPeriodo * m) {
      m = (m * (fin - k) + per[fin]) / (fin - k + 1);
      fin++;
    }
    const racha = per.slice(k, fin);
    const ini = k;
    k = fin;
    if (racha.length < u.minPeriodos) continue;
    const P = racha.reduce((s, x) => s + x, 0) / racha.length;
    const cv = Math.sqrt(racha.reduce((s, x) => s + (x - P) ** 2, 0) / racha.length) / P;
    if (cv > u.maxCv || P < u.minPuntosPeriodo) continue;
    const a = cr[ini];
    const b = cr[fin];
    // el ajuste, sobre la serie sin suavizar y sin la tendencia de tres
    // períodos: al ruido «rojo» (lento) no le alcanza con una sinusoide
    if (ajusteSinusoide(sinTendencia(y, Math.round(3 * P)).r, a, b, P) < u.minAjuste) continue;
    let media = 0;
    for (let i = a; i < b; i++) media += tend[i];
    media /= b - a;
    if (!(media >= u.minPoblacion)) continue;
    const amplitudes = [];
    for (let x = ini; x < fin; x++) {
      let lo = Number.POSITIVE_INFINITY;
      let hi = Number.NEGATIVE_INFINITY;
      for (let i = cr[x]; i < cr[x + 1]; i++) {
        lo = Math.min(lo, r[i]);
        hi = Math.max(hi, r[i]);
      }
      amplitudes.push(hi - lo);
    }
    const amplitud = mediana(amplitudes);
    if (amplitud < u.amplitudMin * media) continue;
    // de la grilla uniforme al ciclo de la muestra más cercana
    const desde = cicloCercano(tt, tt[0] + a * dt);
    const hasta = cicloCercano(tt, tt[0] + b * dt);
    // historia fundida: si cada punto ya junta una variación comparable a la
    // oscilación de las medias, ésta puede ser el eco (aliasing) de un ciclo
    // más corto que los puntos: no se informa
    const bandas = aa.filter((_, x) => tt[x] >= desde && tt[x] <= hasta);
    if (bandas.length && mediana(bandas) > u.alias * amplitud) continue;
    out.push({
      desde,
      hasta,
      periodo: P * dt,
      periodos: racha.length,
      amplitud,
      media,
    });
  }
  return out;
}

/** Claves que pueden salir de los detectores (el informe tiene texto para cada una). */
export const CLAVES_HALLAZGO = Object.freeze([
  'dominio',
  'colapso',
  'extincion',
  'extincion.retorno',
  'adn.crecimiento',
  'adn.reduccion',
  'sustitucion',
  'oscilacion',
  'oscilacion.total',
]);

/**
 * Todos los detectores, en orden de ciclo (a igual ciclo, en el orden
 * dominio, colapso, extinción, ADN, sustitución, oscilaciones).
 * @param {HistoriaLeible} h @param {OpcionesDetectores} [o]
 * @returns {Hallazgo[]}
 */
export function detectar(h, o = {}) {
  const todos = [
    ...detectarDominio(h, o.dominio),
    ...detectarColapso(h, o.colapso),
    ...detectarExtincion(h, o.extincion),
    ...detectarCrecimientoAdn(h, o.adn),
    ...detectarSustitucion(h, o.sustitucion),
    ...detectarOscilaciones(h, o.oscilacion),
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
  'oscilacion.grupo',
  'oscilacion.grupoTotal',
  'resto.sustitucion',
  'resto.oscilacion',
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
 *   - oscilaciones que se superponen en el tiempo con períodos parecidos
 *     (a lo sumo `periodoOscilacion` de diferencia) van en una frase:
 *     'oscilacion.grupoTotal' si una es la de la población de no vegetales
 *     (con las especies que oscilan con ella), si no 'oscilacion.grupo'
 *     (`n` especies, hasta tres en `ejemplos`, las de mayor amplitud;
 *     `periodo`, la mediana);
 *   - la oscilación de una especie que desaparece y vuelve (la frase de las
 *     idas y vueltas) no escribe otra frase: va en los `hallazgos` de ésa,
 *     igual que la de la población total si solo oscila a la par con ella;
 *   - cada tipo escribe a lo sumo `tope` frases: las `tope - 1` más
 *     importantes (severidad y magnitud: en la sustitución, |antes − después|;
 *     en la oscilación, `pct`) y una más que resume el resto
 *     ('resto.<tipo>', con `n` = hallazgos de ese tipo que resume).
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
  // 3. oscilaciones a la par
  /** @param {Hallazgo} a @param {Hallazgo} b */
  const aLaPar = (a, b) => {
    const pa = Number(a.params.periodo);
    const pb = Number(b.params.periodo);
    return (
      a.desde <= b.hasta &&
      b.desde <= a.hasta &&
      Math.abs(pa - pb) <= u.periodoOscilacion * Math.min(pa, pb)
    );
  };
  // la especie que desaparece y vuelve con regularidad también «oscila»: esa
  // oscilación va dentro de su frase de idas y vueltas (no otra frase), y la
  // de la población total también si solo la acompaña ella
  const todasOsc = hallazgos.filter((x) => x.tipo === 'oscilacion');
  /** @type {Set<Hallazgo>} */
  const absorbidas = new Set();
  for (const r of enLugarDe.values()) {
    if (r.clave !== 'extincion.intermitente' && r.clave !== 'extincion.intermitenteFin') continue;
    const especie = r.params.especie;
    const propias = todasOsc.filter(
      (x) =>
        x.clave === 'oscilacion' &&
        x.params.especie === especie &&
        x.desde <= r.hasta &&
        r.desde <= x.hasta,
    );
    if (!propias.length) continue;
    for (const x of propias) absorbidas.add(x);
    r.hallazgos = [...(r.hallazgos ?? []), ...propias];
  }
  for (const x of todasOsc) {
    if (x.clave !== 'oscilacion.total' || !absorbidas.size) continue;
    const pares = todasOsc.filter((y) => y !== x && y.clave === 'oscilacion' && aLaPar(x, y));
    if (!pares.length || !pares.every((y) => absorbidas.has(y))) continue;
    absorbidas.add(x);
    const r = [...enLugarDe.values()].find((g) => g.hallazgos?.includes(pares[0]));
    if (r) r.hallazgos = [...(r.hallazgos ?? []), x];
  }
  for (const x of absorbidas) usados.add(x);
  const osc = todasOsc.filter((x) => !absorbidas.has(x)).sort((a, b) => a.desde - b.desde);
  /** @type {Hallazgo[][]} */
  const grupOsc = [];
  for (const x of osc) {
    const g = grupOsc.find((g) => g.some((y) => aLaPar(x, y)));
    if (g) g.push(x);
    else grupOsc.push([x]);
  }
  for (const g of grupOsc) {
    if (g.length < 2) continue;
    const total = g.find((x) => x.clave === 'oscilacion.total');
    const esp = g.filter((x) => x.clave === 'oscilacion');
    // la misma especie dos veces no es «a la par»: basta que haya dos distintas
    const nombres = [
      ...new Set(
        [...esp]
          .sort((a, b) => Number(b.params.amplitud) - Number(a.params.amplitud))
          .map((x) => String(x.params.especie)),
      ),
    ];
    if (!total && nombres.length < 2) continue;
    if (total && !nombres.length) continue;
    for (const x of g) usados.add(x);
    const desde = Math.min(...g.map((x) => x.desde));
    const hasta = Math.max(...g.map((x) => x.hasta));
    const periodo = dosCifras(mediana(g.map((x) => Number(x.params.periodo))));
    const ejemplos = nombres.slice(0, 3).join(', ') + (nombres.length > 3 ? ', …' : '');
    enLugarDe.set(g[0], {
      tipo: 'oscilacion',
      clave: total ? 'oscilacion.grupoTotal' : 'oscilacion.grupo',
      params: { n: nombres.length, ejemplos, periodo, desde, hasta },
      desde,
      hasta,
      figura: total ? total.figura : g[0].figura,
      severidad: 'info',
      hallazgos: g,
    });
  }
  for (const x of hallazgos) {
    const r = enLugarDe.get(x);
    if (r) lista.push(r);
    else if (!usados.has(x)) lista.push(x);
  }
  // 4. tope de frases por tipo
  const tope = Math.max(1, Math.floor(u.tope));
  /** @param {HallazgoAgrupado} x */
  const magnitud = (x) => {
    // sustitución: cuánto cambió la participación de la desplazada;
    // oscilación: la amplitud relativa (en un grupo, la mayor)
    if (x.tipo === 'sustitucion')
      return Math.abs(Number(x.params.antes) - Number(x.params.despues)) || 0;
    if (x.tipo === 'oscilacion')
      return Math.max(0, ...(x.hallazgos ?? [x]).map((y) => Number(y.params.pct) || 0));
    return (
      Number(
        x.params.n ?? x.params.veces ?? x.params.pico ?? x.params.caida ?? x.params.max ?? 0,
      ) || 0
    );
  };
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
      params: { n: todos.filter((y) => y.tipo === tipo).length, desde, hasta: ultimo },
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
