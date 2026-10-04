// Índice del manual (port/web2/PLAN-SITIO.md, «Contenido del manual»): el
// orden de los capítulos y de sus páginas. Cada página escrita es
// manual/es/<capítulo>/<página>.md; el generador falla si falta un .md del
// índice o si sobra uno que el índice no nombra.
//
// Los capítulos `sysvars` y `operadores` son de referencia (S7): sus páginas
// salen de spec/sysvars.yaml y spec/opcodes.yaml. Acá solo se declaran los
// grupos (con las direcciones o familias de cada uno); cada sysvar u
// operador es una página hija de su grupo. Los parámetros (S8) son hijas de
// app/experimentar-avanzado, una por grupo de engine/opciones.js.

/**
 * @typedef {{slug: string, titulo: string, en: string}} PaginaIndice
 * @typedef {{slug: string, titulo: string, resumen: string,
 *   en: {titulo: string, resumen: string}, paginas: PaginaIndice[],
 *   referencia?: 'sysvars' | 'operadores'}} Capitulo
 *
 * Los textos en inglés (`en`) son los fijos de /en/manual/ (S11): los títulos
 * del índice; el resto de cada página sale de manual/en/.
 */

/** @type {Capitulo[]} */
export const CAPITULOS = [
  {
    slug: 'empezar',
    titulo: 'Empezar',
    resumen: 'Qué es DarwinBots, tu primera simulación y un recorrido por la app.',
    en: {
      titulo: 'Getting started',
      resumen: 'What DarwinBots is, your first simulation and a tour of the app.',
    },
    paginas: [
      { slug: 'que-es', titulo: 'Qué es DarwinBots', en: 'What DarwinBots is' },
      { slug: 'primera-simulacion', titulo: 'Tu primera simulación', en: 'Your first simulation' },
      { slug: 'recorrido', titulo: 'Recorrido por la app', en: 'A tour of the app' },
      { slug: 'glosario', titulo: 'Glosario', en: 'Glossary' },
      { slug: 'preguntas', titulo: 'Preguntas frecuentes', en: 'Frequently asked questions' },
    ],
  },
  {
    slug: 'app',
    titulo: 'Guía de la app',
    resumen: 'Cada pantalla de la app: observar, experimentar, analizar, bots y competir.',
    en: {
      titulo: 'App guide',
      resumen: 'Every screen of the app: observe, experiment, analyze, bots and compete.',
    },
    paginas: [
      { slug: 'inicio', titulo: 'Inicio', en: 'Home' },
      { slug: 'observar', titulo: 'Observar', en: 'Observe' },
      { slug: 'inspector', titulo: 'El inspector', en: 'The inspector' },
      { slug: 'experimentar', titulo: 'Experimentar', en: 'Experiment' },
      {
        slug: 'experimentar-avanzado',
        titulo: 'Experimentar: modo avanzado',
        en: 'Experiment: advanced mode',
      },
      { slug: 'escenarios', titulo: 'Escenarios', en: 'Scenarios' },
      { slug: 'analizar', titulo: 'Analizar', en: 'Analyze' },
      { slug: 'informes', titulo: 'Informes', en: 'Reports' },
      { slug: 'bots', titulo: 'Bots: biblioteca y ficha', en: 'Bots: library and profile' },
      { slug: 'editor', titulo: 'El editor de ADN', en: 'The DNA editor' },
      { slug: 'competir', titulo: 'Competir', en: 'Compete' },
      { slug: 'tus-datos', titulo: 'Tus datos', en: 'Your data' },
      { slug: 'clasica', titulo: 'La interfaz clásica', en: 'The classic interface' },
    ],
  },
  {
    slug: 'simulacion',
    titulo: 'La simulación',
    resumen: 'Cómo funciona el mundo: el ciclo, la energía, la física, la visión y la evolución.',
    en: {
      titulo: 'The simulation',
      resumen: 'How the world works: the cycle, energy, physics, vision and evolution.',
    },
    paginas: [
      {
        slug: 'ciclo',
        titulo: 'El ciclo y el orden de las acciones',
        en: 'The cycle and the order of actions',
      },
      { slug: 'energia', titulo: 'Energía, cuerpo y desechos', en: 'Energy, body and waste' },
      {
        slug: 'cloroplastos',
        titulo: 'Cloroplastos y vegetales',
        en: 'Chloroplasts and vegetables',
      },
      { slug: 'fisica', titulo: 'Física', en: 'Physics' },
      { slug: 'vision', titulo: 'Visión', en: 'Vision' },
      { slug: 'disparos', titulo: 'Disparos', en: 'Shots' },
      { slug: 'defensas', titulo: 'Defensas', en: 'Defenses' },
      { slug: 'lazos', titulo: 'Lazos y multicelulares', en: 'Ties and multicellular bots' },
      { slug: 'virus', titulo: 'Virus', en: 'Viruses' },
      { slug: 'reproduccion', titulo: 'Reproducción', en: 'Reproduction' },
      { slug: 'mutaciones', titulo: 'Mutaciones', en: 'Mutations' },
      { slug: 'muerte', titulo: 'Muerte y cadáveres', en: 'Death and corpses' },
      { slug: 'mundo', titulo: 'El mundo', en: 'The world' },
      { slug: 'especies', titulo: 'Especies y linaje', en: 'Species and lineage' },
    ],
  },
  {
    slug: 'adn',
    titulo: 'El lenguaje del ADN',
    resumen: 'Cómo se programa un bot: genes, pilas, memoria, operadores y costos.',
    en: {
      titulo: 'The DNA language',
      resumen: 'How to program a bot: genes, stacks, memory, operators and costs.',
    },
    paginas: [
      { slug: 'estructura', titulo: 'La estructura de un bot', en: 'The structure of a bot' },
      {
        slug: 'genes',
        titulo: 'Genes: cond, start, else y stop',
        en: 'Genes: cond, start, else and stop',
      },
      {
        slug: 'pilas',
        titulo: 'La pila entera y la booleana',
        en: 'The integer and boolean stacks',
      },
      { slug: 'numeros', titulo: 'Números y direcciones', en: 'Numbers and addresses' },
      { slug: 'stores', titulo: 'Escribir en la memoria', en: 'Writing to memory' },
      { slug: 'operadores', titulo: 'Los operadores por familia', en: 'Operators by family' },
      { slug: 'condiciones', titulo: 'Condiciones en línea', en: 'Inline conditions' },
      { slug: 'def', titulo: 'Variables con def', en: 'Variables with def' },
      { slug: 'memoria', titulo: 'Memoria libre y epigenética', en: 'Free and epigenetic memory' },
      { slug: 'ejecucion', titulo: 'Ejecución y costos', en: 'Execution and costs' },
      { slug: 'errores', titulo: 'Errores frecuentes', en: 'Common mistakes' },
      { slug: 'formato', titulo: 'El formato .txt', en: 'The .txt format' },
    ],
  },
  {
    slug: 'sysvars',
    titulo: 'Referencia de sysvars',
    resumen: 'Cada dirección de la memoria con nombre: quién la escribe, cuándo y con qué rango.',
    en: {
      titulo: 'Sysvar reference',
      resumen: 'Every named memory address: who writes it, when, and its range.',
    },
    referencia: 'sysvars',
    paginas: [],
  },
  {
    slug: 'operadores',
    titulo: 'Referencia de operadores',
    resumen: 'Cada palabra del ADN: qué saca y qué pone en las pilas, y cuánto cuesta.',
    en: {
      titulo: 'Operator reference',
      resumen: 'Every DNA word: what it pops and pushes on the stacks, and what it costs.',
    },
    referencia: 'operadores',
    paginas: [],
  },
  {
    slug: 'tutoriales',
    titulo: 'Tutoriales',
    resumen: 'Paso a paso, de un bot que se mueve a tu primer experimento de evolución.',
    en: {
      titulo: 'Tutorials',
      resumen: 'Step by step, from a bot that moves to your first evolution experiment.',
    },
    paginas: [
      { slug: 'se-mueve', titulo: 'Un bot que se mueve', en: 'A bot that moves' },
      { slug: 'busca-comida', titulo: 'Un bot que busca comida', en: 'A bot that looks for food' },
      { slug: 'dispara', titulo: 'Un bot que dispara', en: 'A bot that shoots' },
      {
        slug: 'reconoce-especie',
        titulo: 'Un bot que reconoce a su especie',
        en: 'A bot that recognizes its own species',
      },
      { slug: 'vegetal', titulo: 'Un vegetal', en: 'A vegetable' },
      { slug: 'alimentador', titulo: 'Un alimentador por lazo', en: 'A tie feeder' },
      { slug: 'multibot', titulo: 'Un multibot', en: 'A multibot' },
      {
        slug: 'evolucion',
        titulo: 'Tu primer experimento de evolución',
        en: 'Your first evolution experiment',
      },
    ],
  },
  {
    slug: 'estrategias',
    titulo: 'Estrategias',
    resumen: 'Cómo sobreviven los bots del Bestiario: caníbales, enjambres, parásitos y más.',
    en: {
      titulo: 'Strategies',
      resumen: 'How the Bestiary bots survive: cannibals, swarms, parasites and more.',
    },
    paginas: [
      { slug: 'canibales', titulo: 'Caníbales', en: 'Cannibals' },
      { slug: 'enjambres', titulo: 'Enjambres', en: 'Swarms' },
      { slug: 'defensivos', titulo: 'Defensivos', en: 'Defensive bots' },
      { slug: 'parasitos', titulo: 'Parásitos y virus', en: 'Parasites and viruses' },
      { slug: 'multibots', titulo: 'Multibots', en: 'Multibots' },
      { slug: 'torneos', titulo: 'Bots de torneo', en: 'Tournament bots' },
    ],
  },
  {
    slug: 'tecnico',
    titulo: 'Técnico',
    resumen: 'Formatos de archivo, reproducibilidad y diferencias con el original.',
    en: {
      titulo: 'Technical',
      resumen: 'File formats, reproducibility and differences from the original.',
    },
    paginas: [
      { slug: 'formatos', titulo: 'Formatos de archivo', en: 'File formats' },
      { slug: 'semillas', titulo: 'Semillas y reproducibilidad', en: 'Seeds and reproducibility' },
      {
        slug: 'diferencias',
        titulo: 'Diferencias con el 2.48.32 original',
        en: 'Differences from the original 2.48.32',
      },
      { slug: 'como-esta-hecho', titulo: 'Cómo está hecho el port', en: 'How the port is built' },
      { slug: 'creditos', titulo: 'Créditos y licencia', en: 'Credits and license' },
    ],
  },
];

/** Página de la que cuelgan los grupos de parámetros (S8). */
export const PADRE_PARAMETROS = 'app/experimentar-avanzado';

/** @param {number} a @param {number} b */
const de = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/**
 * Grupos de sysvars: cada dirección de spec/sysvars.yaml va en uno solo
 * (el generador lo comprueba). La memoria genética (971-990) no tiene
 * nombres: va en dos páginas por rango (MEMORIA_GENETICA).
 * @type {{slug: string, titulo: string, en: string, dirs: number[]}[]}
 */
export const GRUPOS_SYSVARS = [
  {
    slug: 'movimiento',
    titulo: 'Movimiento',
    en: 'Movement',
    dirs: [...de(1, 6), 11, 18, 19, ...de(196, 200), 215, 216],
  },
  {
    slug: 'posicion',
    titulo: 'Posición y entorno',
    en: 'Position and surroundings',
    dirs: [214, 217, 218, 219, 400, 401, 402],
  },
  {
    slug: 'contacto',
    titulo: 'Choques y golpes',
    en: 'Collisions and hits',
    dirs: [201, ...de(205, 208), 221],
  },
  {
    slug: 'ganancias',
    titulo: 'Ganancias y pérdidas',
    en: 'Gains and losses',
    dirs: [194, 195, 203, 204],
  },
  {
    slug: 'cuerpo',
    titulo: 'Cuerpo, energía y estado',
    en: 'Body, energy and state',
    dirs: [9, 10, 12, 220, ...de(310, 315), 828, 829],
  },
  {
    slug: 'ojos',
    titulo: 'Ojos',
    en: 'Eyes',
    dirs: [...de(501, 511), ...de(521, 529), ...de(531, 539)],
  },
  {
    slug: 'ref',
    titulo: 'Lo que se ve (ref*)',
    en: 'What it sees (ref*)',
    dirs: [477, ...de(685, 690), ...de(695, 699), ...de(701, 715)],
  },
  {
    slug: 'my',
    titulo: 'La firma propia (my*)',
    en: 'Its own signature (my*)',
    dirs: de(721, 731),
  },
  {
    slug: 'disparos',
    titulo: 'Disparos',
    en: 'Shots',
    dirs: [7, 8, 202, ...de(209, 213), 900, 901],
  },
  {
    slug: 'defensas',
    titulo: 'Defensas',
    en: 'Defenses',
    dirs: [...de(820, 827), ...de(834, 839)],
  },
  {
    slug: 'cloroplastos',
    titulo: 'Cloroplastos y luz',
    en: 'Chloroplasts and light',
    dirs: de(920, 924),
  },
  { slug: 'reproduccion', titulo: 'Reproducción', en: 'Reproduction', dirs: de(300, 303) },
  {
    slug: 'lazos',
    titulo: 'Lazos',
    en: 'Ties',
    dirs: [330, 331, ...de(450, 455), ...de(466, 471), ...de(480, 487), ...de(830, 833)],
  },
  {
    slug: 'tref',
    titulo: 'Lo que se siente por un lazo (tref*)',
    en: 'What it feels through a tie (tref*)',
    dirs: [...de(437, 449), ...de(456, 465), 478, 479],
  },
  { slug: 'adn-y-virus', titulo: 'ADN y virus', en: 'DNA and viruses', dirs: de(335, 341) },
  {
    slug: 'entradas-salidas',
    titulo: 'Entradas y salidas',
    en: 'Inputs and outputs',
    dirs: [...de(410, 429), ...de(800, 819)],
  },
  {
    slug: 'memoria',
    titulo: 'Memoria (memloc, memval y genética)',
    en: 'Memory (memloc, memval and genetic)',
    dirs: [0, ...de(473, 476), ...de(971, 990)],
  },
];

/** Las direcciones sin nombre que van juntas en una página. */
export const MEMORIA_GENETICA = [
  {
    slug: 'mem-971-975',
    titulo: 'Memoria genética instantánea (971-975)',
    en: 'Instant genetic memory (971-975)',
    dirs: de(971, 975),
  },
  {
    slug: 'mem-976-990',
    titulo: 'Memoria genética diferida (976-990)',
    en: 'Deferred genetic memory (976-990)',
    dirs: de(976, 990),
  },
];

/**
 * Familias de operadores: la sección de spec/opcodes.yaml de cada una, y el
 * costo y el momento en que se ejecutan (spec/20-VM.md §1, tabla de tipos).
 * El costo va con enlaces a sus parámetros ([[param:cost:N]]); todos se
 * multiplican por el multiplicador de costos (cost:54).
 */
const DENTRO_DEL_GEN = 'dentro de un gen: en la condición (cond) y en el cuerpo (start o else)';
const INSIDE_A_GENE = 'inside a gene: in the condition (cond) and in the body (start or else)';
export const FAMILIAS_OPERADORES = [
  {
    slug: 'literales',
    titulo: 'Números y lecturas',
    secciones: ['pseudo_tokens'],
    costo: '[[param:cost:0]] el número, [[param:cost:1]] la lectura',
    cuando: DENTRO_DEL_GEN,
    en: {
      titulo: 'Numbers and reads',
      costo: '[[param:cost:0]] for the number, [[param:cost:1]] for the read',
      cuando: INSIDE_A_GENE,
    },
  },
  {
    slug: 'basicos',
    titulo: 'Básicos',
    secciones: ['basicos'],
    costo: '[[param:cost:2]]',
    cuando: DENTRO_DEL_GEN,
    en: {
      titulo: 'Basic',
      costo: '[[param:cost:2]]',
      cuando: INSIDE_A_GENE,
    },
  },
  {
    slug: 'avanzados',
    titulo: 'Avanzados',
    secciones: ['avanzados'],
    costo: '[[param:cost:3]]; debugint y debugbool no cuestan',
    cuando: DENTRO_DEL_GEN,
    en: {
      titulo: 'Advanced',
      costo: '[[param:cost:3]]; debugint and debugbool are free',
      cuando: INSIDE_A_GENE,
    },
  },
  {
    slug: 'bits',
    titulo: 'Bit a bit',
    secciones: ['bitwise'],
    costo: '[[param:cost:4]]',
    cuando: DENTRO_DEL_GEN,
    en: {
      titulo: 'Bitwise',
      costo: '[[param:cost:4]]',
      cuando: INSIDE_A_GENE,
    },
  },
  {
    slug: 'comparaciones',
    titulo: 'Comparaciones',
    secciones: ['condiciones'],
    costo: '[[param:cost:5]]',
    cuando: DENTRO_DEL_GEN,
    en: {
      titulo: 'Comparisons',
      costo: '[[param:cost:5]]',
      cuando: INSIDE_A_GENE,
    },
  },
  {
    slug: 'logicos',
    titulo: 'Lógicos',
    secciones: ['logicos'],
    costo: '[[param:cost:6]]',
    cuando: DENTRO_DEL_GEN,
    en: {
      titulo: 'Logic',
      costo: '[[param:cost:6]]',
      cuando: INSIDE_A_GENE,
    },
  },
  {
    slug: 'escritura',
    titulo: 'Escritura en memoria',
    secciones: ['stores'],
    costo: '[[param:cost:7]] dividido por el divisor de cada uno, solo si escribe',
    cuando:
      'en el cuerpo de un gen (start o else) y solo si el tope de la pila booleana es verdadero o está vacía',
    en: {
      titulo: 'Writing to memory',
      costo: '[[param:cost:7]] divided by the divisor of each one, only if it writes',
      cuando:
        'in the body of a gene (start or else), and only if the top of the boolean stack is true or the stack is empty',
    },
  },
  {
    slug: 'flujo',
    titulo: 'Flujo',
    secciones: ['flujo', 'flujo_maestro'],
    costo: '[[param:cost:9]]; end no cuesta',
    cuando: 'siempre',
    en: {
      titulo: 'Flow',
      costo: '[[param:cost:9]]; end is free',
      cuando: 'always',
    },
  },
];

/**
 * Página de cada operador cuyo token no sirve de nombre de archivo o de URL.
 * El resto usa el token tal cual.
 * @type {Record<string, string>}
 */
export const SLUG_OPERADOR = {
  '<numero>': 'numero',
  '*<numero> | *.<sysvar>': 'lectura',
  '*': 'estrella',
  '~': 'bit-not',
  '&': 'bit-and',
  '|': 'bit-or',
  '^': 'bit-xor',
  '++': 'bit-inc',
  '--': 'bit-dec',
  '-': 'negar',
  '<<': 'shift-izq',
  '>>': 'shift-der',
  '<': 'menor',
  '>': 'mayor',
  '=': 'igual',
  '!=': 'distinto',
  '%=': 'casi-igual',
  '!%=': 'no-casi-igual',
  '~=': 'aprox',
  '!~=': 'no-aprox',
  '>=': 'mayor-igual',
  '<=': 'menor-igual',
};
