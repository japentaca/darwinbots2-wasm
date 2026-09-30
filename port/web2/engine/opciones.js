// @ts-check
// Catálogo declarativo de los parámetros de la sim (decisión 14 de
// port/web2/PLAN.md). Sin DOM: la interfaz arma sus controles con esto.
//
// Cada parámetro es algo que la API del motor acepta:
//   tipo 'opt'   db_sim_set_opt / db_sim_get_opt por id (tabla de ids en
//                port/wasm/dbcore_api.cpp); en vivo con {t:'setopt', id, v}.
//   tipo 'cost'  Costs(i) por índice VB6 (SimOptions.bas:2-39; 51..62 los
//                dinámicos); en vivo con {t:'setcost', i, v}.
//   tipo 'base'  las opciones nombradas del reset ({t:'reset', options}):
//                campo, economía vegetal y mutaciones. En vivo con
//                {t:'setbase', vals:{nombre: v}} (C12: los mismos exports
//                que usa el reset; la clásica solo las aplica al reiniciar).
//
// La clave de un parámetro es `${tipo}:${id}` ('opt:11', 'cost:23',
// 'base:minVegs'): los números de 'opt' y 'cost' se pisan (opt 20 ≠ cost 20).
// Los valores viajan crudos, como los espera el motor: los bool son 0/1 (o
// el valor `on` que declare el parámetro: USEDYNAMICCOSTS escribe -1, como
// la UI original).
//
// Por defecto: el valor con el que la clásica arranca (su panel de
// opciones, port/web/index.html OPT_GROUPS) y, para lo que la clásica no
// muestra, el del core (sim.hpp SimOptsT, Costs en 0).
//
// Vivo (decisión 13 y C12): true si se puede mandar a una sim corriendo.
// Solo el tamaño del campo queda en false (con las especies y los objetos
// del escenario, es lo único que requiere sim nueva).
//
// Opciones acopladas (el motor escribe más de un campo con un id):
//   opt:1   Toroidal escribe también 2 y 3. Es DERIVADO: no se edita (un
//           escenario no puede traerlo en sus cambios) y su valor efectivo
//           es 2 && 3, como TopDownCheck/RightLeftCheck del original
//           (OptionsForm.frm:4123-4131). El reset lo manda (en 1) solo si
//           los dos ejes quedan conectados, así el .dbsim lleva
//           Toroidal = True como el original.
//   opt:97  MinRounds escribe también optMinRounds (101): si el escenario
//           no fija 101, su valor efectivo es el de 97.
// diff() de engine/escenarios y los eventos de engine/corridas.js respetan
// ese orden (1 antes que 2/3, 97 antes que 101); fusionarCambios() junta
// cambios sin perderlo.
//
// Bool: `on` es el valor que se escribe al encender (1, o -1 en
// USEDYNAMICCOSTS como la UI original). `noCero` = el core toma cualquier
// valor distinto de 0 como encendido (todas las 'opt' bool: set_opt hace
// v != 0; y los costos 56 y 61, Master.bas:241 y :254), así que
// normalizarValor acepta cualquier número finito y lo lleva a 0/`on`; los
// demás costos bool se comparan con = 1 en el core (Robots.bas:1009-1011,
// Master.bas:284) y solo aceptan 0/1.
//
// Las bases (BASES) son conjuntos de valores explícitos: 'clasica' replica
// lo que manda el reinicio de la clásica con su panel sin tocar
// (collectOptions) y 'f1' le suma btnSetF1_Click (OptionsForm.frm:2579-2668,
// "Ajustes F1" de port/README.md). Solo se mandan al reset los valores que
// la base fija más los cambios del escenario: lo demás queda en el valor
// del core (mandar un default puede no ser neutro: 101 pisa el
// optMinRounds que acaba de escribir 97).

/**
 * @typedef {'opt' | 'cost' | 'base'} TipoParametro
 * @typedef {'bool' | 'int' | 'float' | 'enum'} TipoValor
 * @typedef {{es: string, en: string}} Texto
 * @typedef {{v: number, es: string, en: string}} ValorEnum
 * @typedef {{
 *   id: number | string,
 *   tipo: TipoParametro,
 *   clave: string,
 *   grupo: string,
 *   variable: string,
 *   es: string,
 *   en: string,
 *   ayuda: Texto,
 *   valor: TipoValor,
 *   valores?: ValorEnum[],
 *   on?: number,
 *   min?: number,
 *   max?: number,
 *   paso?: number,
 *   porDefecto: number,
 *   vivo: boolean,
 *   nivel: 'basico' | 'avanzado',
 *   nota?: Texto,
 *   derivado?: boolean,
 *   noCero?: boolean,
 * }} Parametro
 */

/** Grupos del modo avanzado, en orden de presentación. */
export const GRUPOS = Object.freeze([
  { id: 'campo', es: 'Campo y bordes', en: 'Field and edges' },
  { id: 'energia', es: 'Energía y vegetales', en: 'Energy and vegetables' },
  { id: 'luz', es: 'Luz y día/noche', en: 'Light and day/night' },
  { id: 'fisica', es: 'Física', en: 'Physics' },
  { id: 'muerte', es: 'Muerte y descomposición', en: 'Death and decay' },
  { id: 'restricciones', es: 'Restricciones', en: 'Restrictions' },
  { id: 'costos', es: 'Costos', en: 'Costs' },
  { id: 'costos-dinamicos', es: 'Costos dinámicos', en: 'Dynamic costs' },
  { id: 'formas', es: 'Formas (visión y deriva)', en: 'Shapes (vision and drift)' },
  { id: 'modos', es: 'Modos de juego (F1 / rondas)', en: 'Game modes (F1 / rounds)' },
  { id: 'evolucion', es: 'Modo evolución', en: 'Evolution mode' },
  { id: 'registro', es: 'Registro', en: 'Recording' },
]);

/** @type {Parametro[]} */
const lista = [];

/**
 * @param {TipoParametro} tipo @param {number | string} id @param {string} grupo
 * @param {string} variable @param {[string, string]} nombre @param {[string, string]} ayuda
 * @param {Partial<Parametro> & {valor: TipoValor, porDefecto: number}} x
 */
function def(tipo, id, grupo, variable, nombre, ayuda, x) {
  lista.push({
    id,
    tipo,
    clave: `${tipo}:${id}`,
    grupo,
    variable,
    es: nombre[0],
    en: nombre[1],
    ayuda: { es: ayuda[0], en: ayuda[1] },
    vivo: true,
    nivel: 'avanzado',
    ...(tipo === 'opt' && x.valor === 'bool' ? { noCero: true } : {}),
    ...x,
  });
}

/** @param {number} id @param {string} g @param {string} v @param {[string, string]} n @param {[string, string]} a @param {Partial<Parametro> & {valor: TipoValor, porDefecto: number}} x */
const opt = (id, g, v, n, a, x) => def('opt', id, g, v, n, a, x);
/** @param {number} id @param {string} g @param {string} v @param {[string, string]} n @param {[string, string]} a @param {Partial<Parametro> & {valor: TipoValor, porDefecto: number}} x */
const cost = (id, g, v, n, a, x) => def('cost', id, g, v, n, a, x);
/** @param {string} id @param {string} g @param {string} v @param {[string, string]} n @param {[string, string]} a @param {Partial<Parametro> & {valor: TipoValor, porDefecto: number}} x */
const base = (id, g, v, n, a, x) => def('base', id, g, v, n, a, x);

const BOOL = /** @type {const} */ ({ valor: 'bool' });
/** @param {number} d */
const bool = (d) => ({ ...BOOL, porDefecto: d });
/** @param {number} d @param {number} min @param {number} max @param {number} [paso] */
const ent = (d, min, max, paso = 1) => ({
  valor: /** @type {TipoValor} */ ('int'),
  porDefecto: d,
  min,
  max,
  paso,
});
/** @param {number} d @param {number} min @param {number} max @param {number} [paso] */
const real = (d, min, max, paso) => ({
  valor: /** @type {TipoValor} */ ('float'),
  porDefecto: d,
  min,
  max,
  ...(paso ? { paso } : {}),
});
/** Costo por acción: float ≥ 0 (la clásica no pone tope). @param {number} [d] */
const costo = (d = 0) => real(d, 0, 1000, 0.001);

// ---- Campo y bordes ---------------------------------------------------------
base(
  'fieldW',
  'campo',
  'FieldWidth',
  ['Ancho del campo', 'Field width'],
  ['En twips; 32000 es el mundo por defecto.', 'In twips; 32000 is the default world.'],
  { ...ent(32000, 1000, 2304000, 1), vivo: false },
);
base(
  'fieldH',
  'campo',
  'FieldHeight',
  ['Alto del campo', 'Field height'],
  ['En twips; 32000 es el mundo por defecto.', 'In twips; 32000 is the default world.'],
  { ...ent(32000, 1000, 1728000, 1), vivo: false },
);
opt(
  1,
  'campo',
  'Toroidal',
  ['Toroidal (los dos ejes)', 'Toroidal (both axes)'],
  [
    'Conecta a la vez arriba↔abajo e izquierda↔derecha.',
    'Connects top↔bottom and left↔right at once.',
  ],
  {
    ...bool(0),
    derivado: true,
    nota: {
      es: 'Derivado: vale 1 si los dos ejes están conectados. Se edita con los ejes (o el control «Bordes»).',
      en: 'Derived: it is 1 when both axes are connected. Edit the axes (or the «Edges» control).',
    },
  },
);
opt(
  2,
  'campo',
  'Updnconnected',
  ['Arriba ↔ abajo conectados', 'Top ↔ bottom connected'],
  ['Lo que sale por abajo entra por arriba.', 'What leaves at the bottom enters at the top.'],
  { ...bool(0), nivel: 'basico' },
);
opt(
  3,
  'campo',
  'Dxsxconnected',
  ['Izquierda ↔ derecha conectados', 'Left ↔ right connected'],
  ['Lo que sale por un lado entra por el otro.', 'What leaves at one side enters at the other.'],
  { ...bool(0), nivel: 'basico' },
);

// ---- Física -----------------------------------------------------------------
opt(
  11,
  'fisica',
  'MaxVelocity',
  ['Velocidad máxima', 'Max speed'],
  ['Tope de velocidad de un bot.', 'Speed cap of a bot.'],
  real(40, 0, 1000, 1),
);
opt(
  12,
  'fisica',
  'PhysMoving',
  ['Eficiencia del motor', 'Motor efficiency'],
  [
    'Fracción del impulso pedido que se convierte en movimiento.',
    'Fraction of the requested thrust that becomes motion.',
  ],
  real(0.66, 0, 1, 0.01),
);
opt(
  13,
  'fisica',
  'PhysBrown',
  ['Movimiento browniano', 'Brownian motion'],
  ['Empujones al azar en cada ciclo.', 'Random nudges every cycle.'],
  real(0, 0, 100, 0.1),
);
opt(
  14,
  'fisica',
  'Density',
  ['Densidad del medio', 'Medium density'],
  ['Resistencia por el empuje del fluido (agua ≈ 1e-7).', 'Fluid drag (water ≈ 1e-7).'],
  { ...real(0, 0, 0.001), nivel: 'basico' },
);
opt(
  15,
  'fisica',
  'Viscosity',
  ['Viscosidad', 'Viscosity'],
  ['Resistencia viscosa del fluido (agua ≈ 0,0005).', 'Viscous drag (water ≈ 0.0005).'],
  { ...real(0, 0, 0.1), nivel: 'basico' },
);
opt(
  16,
  'fisica',
  'CoefficientStatic',
  ['Rozamiento estático', 'Static friction'],
  ['Rozamiento con el suelo para empezar a moverse.', 'Floor friction to start moving.'],
  { ...real(0, 0, 2, 0.01), nivel: 'basico' },
);
opt(
  17,
  'fisica',
  'CoefficientKinetic',
  ['Rozamiento dinámico', 'Kinetic friction'],
  ['Rozamiento con el suelo en movimiento.', 'Floor friction while moving.'],
  { ...real(0, 0, 2, 0.01), nivel: 'basico' },
);
opt(
  18,
  'fisica',
  'CoefficientElasticity',
  ['Elasticidad de los choques', 'Collision elasticity'],
  ['0 = choques blandos; 1 = rebote total.', '0 = soft collisions; 1 = full bounce.'],
  real(0, 0, 1, 0.01),
);
opt(
  19,
  'fisica',
  'Zgravity',
  ['Gravedad Z (contra el suelo)', 'Z gravity (against the floor)'],
  [
    'Aprieta los bots contra el suelo: activa el rozamiento.',
    'Presses bots against the floor: enables friction.',
  ],
  { ...real(0, 0, 100, 0.1), nivel: 'basico' },
);
opt(
  20,
  'fisica',
  'Ygravity',
  ['Gravedad Y (hacia abajo)', 'Y gravity (downwards)'],
  ['Tira de los bots hacia el borde inferior.', 'Pulls bots towards the bottom edge.'],
  real(0, 0, 100, 0.1),
);
opt(
  10,
  'fisica',
  'ZeroMomentum',
  ['Sin inercia', 'No inertia'],
  ['Los bots se frenan en seco al dejar de empujar.', 'Bots stop dead when they stop pushing.'],
  bool(0),
);
opt(
  21,
  'fisica',
  'FixedBotRadii',
  ['Radio fijo', 'Fixed bot radii'],
  [
    'Todos los bots del mismo tamaño, sin importar el cuerpo.',
    'All bots the same size, whatever their body.',
  ],
  bool(0),
);

// ---- Luz y día/noche --------------------------------------------------------
opt(
  33,
  'luz',
  'DayNight',
  ['Ciclo día/noche', 'Day/night cycle'],
  ['De noche los vegetales no reciben energía.', 'At night vegetables get no energy.'],
  { ...bool(0), nivel: 'basico' },
);
opt(
  34,
  'luz',
  'CycleLength',
  ['Medio período (ciclos)', 'Half period (cycles)'],
  ['Cuánto dura el día (y la noche).', 'How long the day (and the night) lasts.'],
  { ...ent(500, 1, 32000), nivel: 'basico' },
);
opt(
  40,
  'luz',
  'SunOnRnd',
  ['Sol al azar (clima)', 'Random sun (weather)'],
  ['La franja iluminada se mueve al azar.', 'The lit band wanders at random.'],
  bool(0),
);
opt(
  35,
  'luz',
  'SunUp',
  ['Encender el sol bajo un umbral', 'Sun ON below a threshold'],
  [
    'Sale el sol si la energía total baja del umbral.',
    'The sun rises when total energy drops below the threshold.',
  ],
  bool(0),
);
opt(
  36,
  'luz',
  'SunUpThreshold',
  ['Umbral de encendido', 'On threshold'],
  ['Energía total por debajo de la cual sale el sol.', 'Total energy below which the sun rises.'],
  ent(500000, 0, 2147483647, 1000),
);
opt(
  37,
  'luz',
  'SunDown',
  ['Apagar el sol sobre un umbral', 'Sun OFF above a threshold'],
  [
    'Se pone el sol si la energía total pasa el umbral.',
    'The sun sets when total energy exceeds the threshold.',
  ],
  bool(0),
);
opt(
  38,
  'luz',
  'SunDownThreshold',
  ['Umbral de apagado', 'Off threshold'],
  ['Energía total por encima de la cual se pone el sol.', 'Total energy above which the sun sets.'],
  ent(1000000, 0, 2147483647, 1000),
);
opt(
  39,
  'luz',
  'SunThresholdMode',
  ['Modo de los umbrales', 'Threshold mode'],
  ['Qué hace el umbral con el ciclo día/noche.', 'What the threshold does to the day/night cycle.'],
  {
    valor: 'enum',
    porDefecto: 0,
    valores: [
      { v: 0, es: 'suspende hasta el próximo ciclo', en: 'suspend until the next cycle' },
      { v: 1, es: 'suspende del todo', en: 'suspend for good' },
      { v: 2, es: 'adelanta el sol', en: 'advance the sun' },
    ],
  },
);
opt(
  30,
  'luz',
  'Pondmode',
  ['Estanque (luz por profundidad)', 'Pond mode (light by depth)'],
  ['La luz se apaga con la profundidad.', 'Light fades with depth.'],
  bool(0),
);
opt(
  31,
  'luz',
  'LightIntensity',
  ['Intensidad de la luz', 'Light intensity'],
  ['Luz en la superficie del estanque.', 'Light at the pond surface.'],
  ent(0, 0, 32000),
);
opt(
  32,
  'luz',
  'Gradient',
  ['Gradiente de profundidad', 'Depth gradient'],
  ['Cuánto se atenúa la luz al bajar.', 'How fast light fades with depth.'],
  real(1.02, 0, 10, 0.01),
);
opt(
  41,
  'luz',
  'Daytime',
  ['Es de día', 'Daytime'],
  [
    'Estado actual del ciclo (el motor lo cambia solo).',
    'Current state of the cycle (the engine flips it).',
  ],
  bool(1),
);

// ---- Muerte y descomposición ------------------------------------------------
opt(
  50,
  'muerte',
  'CorpseEnabled',
  ['Cadáveres', 'Corpses'],
  ['Los bots muertos quedan como comida.', 'Dead bots remain as food.'],
  { ...bool(1), nivel: 'basico' },
);
opt(
  51,
  'muerte',
  'Decay',
  ['Descomposición por ciclo', 'Body decay per cycle'],
  ['Cuerpo que pierde un cadáver en cada paso.', 'Body a corpse loses at each step.'],
  real(0, 0, 1000, 0.1),
);
opt(
  52,
  'muerte',
  'Decaydelay',
  ['Pausa de descomposición (ciclos)', 'Decay delay (cycles)'],
  ['Ciclos entre dos pasos de descomposición.', 'Cycles between two decay steps.'],
  ent(100, 1, 32000),
);
opt(
  53,
  'muerte',
  'DecayType',
  ['Tipo de descomposición', 'Decay type'],
  ['Qué suelta el cadáver al descomponerse.', 'What the corpse releases as it decays.'],
  {
    valor: 'enum',
    porDefecto: 0,
    valores: [
      { v: 0, es: 'sin disparo', en: 'no shot' },
      { v: 2, es: 'disparo de residuos', en: 'waste shot' },
      { v: 3, es: 'disparo de energía', en: 'energy shot' },
    ],
  },
);
opt(
  54,
  'muerte',
  'NoShotDecay',
  ['Los disparos de energía no se gastan', 'Energy shots do not decay'],
  ['Los disparos de energía conservan su valor.', 'Energy shots keep their value.'],
  bool(0),
);
opt(
  55,
  'muerte',
  'NoWShotDecay',
  ['Los disparos de residuos no se gastan', 'Waste shots do not decay'],
  ['Los disparos de residuos conservan su valor.', 'Waste shots keep their value.'],
  bool(0),
);
opt(
  56,
  'muerte',
  'BadWastelevel',
  ['Los residuos son tóxicos desde', 'Waste is toxic from'],
  ['Residuos acumulados a partir de los que dañan.', 'Accumulated waste from which it hurts.'],
  ent(400, 0, 2147483647),
);

// ---- Energía y vegetales ----------------------------------------------------
base(
  'maxEnergy',
  'energia',
  'MaxEnergy',
  ['Energía solar por ciclo', 'Solar share per cycle'],
  ['Energía que se reparten los vegetales cada ciclo.', 'Energy shared by vegetables each cycle.'],
  { ...ent(10, 0, 100000), nivel: 'basico' },
);
base(
  'minVegs',
  'energia',
  'MinVegs',
  ['Repoblar por debajo de (cloroplastos)', 'Repopulate below (chloroplasts)'],
  [
    'Si los vegetales caen por debajo, se siembran más.',
    'If vegetables drop below this, more are seeded.',
  ],
  { ...ent(15, 0, 100000), nivel: 'basico' },
);
base(
  'maxPopulation',
  'energia',
  'MaxPopulation',
  ['Tope de vegetales', 'Vegetable cap'],
  [
    'Máximo de vegetales (en unidades de 16000 cloroplastos).',
    'Vegetable cap (in units of 16000 chloroplasts).',
  ],
  { ...ent(100, 0, 32000), nivel: 'basico' },
);
base(
  'repopAmount',
  'energia',
  'RepopAmount',
  ['Vegetales por repoblación', 'Vegetables per repopulation'],
  ['Cuántos se siembran en cada repoblación.', 'How many are seeded per repopulation.'],
  ent(10, 0, 1000),
);
base(
  'repopCooldown',
  'energia',
  'RepopCooldown',
  ['Ciclos entre repoblaciones', 'Cycles between repopulations'],
  ['Espera mínima entre dos repoblaciones.', 'Minimum wait between two repopulations.'],
  ent(10, 0, 32000),
);
base(
  'startChlr',
  'energia',
  'StartChlr',
  ['Cloroplastos iniciales', 'Starting chloroplasts'],
  ['Cloroplastos de cada vegetal sembrado.', 'Chloroplasts of each seeded vegetable.'],
  ent(16000, 0, 32000),
);
base(
  'mutations',
  'energia',
  'DisableMutations',
  ['Mutaciones', 'Mutations'],
  ['Apagadas, los hijos son copias exactas.', 'When off, offspring are exact copies.'],
  {
    ...bool(1),
    nivel: 'basico',
    noCero: true,
    nota: {
      es: 'Es la negación de DisableMutations.',
      en: 'It is the negation of DisableMutations.',
    },
  },
);
opt(
  60,
  'energia',
  'EnergyExType',
  ['Intercambio de energía', 'Energy exchange'],
  ['Cómo se calcula lo que roba un disparo.', 'How a shot’s energy take is computed.'],
  {
    valor: 'enum',
    porDefecto: 1,
    valores: [
      { v: 1, es: 'proporcional', en: 'proportional' },
      { v: 0, es: 'fijo', en: 'fixed' },
    ],
  },
);
opt(
  61,
  'energia',
  'EnergyFix',
  ['Cantidad fija', 'Fixed amount'],
  ['Energía por disparo con intercambio fijo.', 'Energy per shot with fixed exchange.'],
  ent(200, 0, 32000),
);
opt(
  62,
  'energia',
  'EnergyProp',
  ['Proporción', 'Proportion'],
  ['Factor del intercambio proporcional.', 'Factor of the proportional exchange.'],
  real(1, 0, 100, 0.01),
);
opt(
  63,
  'energia',
  'VegFeedingToBody',
  ['Comer vegetales: fracción al cuerpo', 'Eating vegetables: fraction to body'],
  ['El resto va a energía.', 'The rest goes to energy.'],
  real(0.75, 0, 1, 0.01),
);
opt(
  64,
  'energia',
  'Tides',
  ['Mareas (ciclos; 0 = no)', 'Tides (cycles; 0 = off)'],
  ['Período de las mareas del alimento vegetal.', 'Period of the vegetable feeding tides.'],
  ent(0, 0, 32000),
);

// ---- Restricciones ----------------------------------------------------------
opt(
  70,
  'restricciones',
  'DisableTies',
  ['Sin ataduras', 'Disable ties'],
  ['Nadie puede atarse a otro bot.', 'Nobody can tie to another bot.'],
  bool(0),
);
opt(
  71,
  'restricciones',
  'DisableTypArepro',
  ['Sin reproducción asexual (no repobladores)', 'No asexual repro (non-repopulating)'],
  ['Solo los vegetales repobladores se clonan.', 'Only repopulating vegetables clone.'],
  bool(0),
);
opt(
  72,
  'restricciones',
  'DisableFixing',
  ['Nadie se puede fijar', 'Nobody can fix position'],
  ['Desactiva .fixpos para todos.', 'Disables .fixpos for everyone.'],
  bool(0),
);

// ---- Costos (CostsForm; índices de SimOptions.bas) --------------------------
cost(
  0,
  'costos',
  'NUMCOST',
  ['Número', 'Number'],
  ['Por cada número del ADN que se ejecuta.', 'Per DNA number executed.'],
  costo(),
);
cost(
  1,
  'costos',
  'DOTNUMCOST',
  ['Lectura *.número', '*.number read'],
  ['Por cada lectura de memoria (*.x).', 'Per memory read (*.x).'],
  costo(),
);
cost(
  2,
  'costos',
  'BCCMDCOST',
  ['Comando básico', 'Basic command'],
  ['add, sub, mult…', 'add, sub, mult…'],
  costo(),
);
cost(
  3,
  'costos',
  'ADCMDCOST',
  ['Comando avanzado', 'Advanced command'],
  ['angle, dist, sqr…', 'angle, dist, sqr…'],
  costo(),
);
cost(
  4,
  'costos',
  'BTCMDCOST',
  ['Comando de bits', 'Bitwise command'],
  ['Operaciones de bits.', 'Bitwise operations.'],
  costo(),
);
cost(
  5,
  'costos',
  'CONDCOST',
  ['Condición', 'Condition'],
  ['Por cada comparación.', 'Per comparison.'],
  costo(),
);
cost(6, 'costos', 'LOGICCOST', ['Lógica', 'Logic'], ['and, or, not…', 'and, or, not…'], costo());
cost(
  7,
  'costos',
  'COSTSTORE',
  ['Store', 'Store'],
  ['Por cada escritura en memoria.', 'Per memory write.'],
  costo(),
);
cost(
  8,
  'costos',
  'CHLRCOST',
  ['Cloroplasto nuevo', 'New chloroplast'],
  ['Por cada cloroplasto que fabrica un bot.', 'Per chloroplast a bot builds.'],
  costo(),
);
cost(
  9,
  'costos',
  'FLOWCOST',
  ['Control de flujo', 'Flow control'],
  ['cond, start, stop…', 'cond, start, stop…'],
  costo(),
);
cost(
  20,
  'costos',
  'MOVECOST',
  ['Mover', 'Move'],
  ['Por unidad de empuje.', 'Per unit of thrust.'],
  costo(),
);
cost(
  21,
  'costos',
  'TURNCOST',
  ['Girar', 'Turn'],
  ['Por unidad de giro.', 'Per unit of turn.'],
  costo(),
);
cost(22, 'costos', 'TIECOST', ['Atar', 'Tie'], ['Por cada atadura.', 'Per tie.'], costo());
cost(23, 'costos', 'SHOTCOST', ['Disparar', 'Shoot'], ['Por cada disparo.', 'Per shot.'], costo());
cost(
  24,
  'costos',
  'DNACYCCOST',
  ['ADN por ciclo', 'DNA per cycle'],
  ['Por ciclo y por largo del ADN.', 'Per cycle and DNA length.'],
  costo(),
);
cost(
  25,
  'costos',
  'DNACOPYCOST',
  ['Copia del ADN', 'DNA copy'],
  ['Al reproducirse, por largo del ADN.', 'On reproduction, per DNA length.'],
  costo(),
);
cost(
  26,
  'costos',
  'VENOMCOST',
  ['Veneno', 'Venom'],
  ['Por unidad de veneno fabricada.', 'Per unit of venom made.'],
  costo(),
);
cost(
  27,
  'costos',
  'POISONCOST',
  ['Ponzoña', 'Poison'],
  ['Por unidad de ponzoña fabricada.', 'Per unit of poison made.'],
  costo(),
);
cost(
  28,
  'costos',
  'SLIMECOST',
  ['Baba', 'Slime'],
  ['Por unidad de baba fabricada.', 'Per unit of slime made.'],
  costo(),
);
cost(
  29,
  'costos',
  'SHELLCOST',
  ['Caparazón', 'Shell'],
  ['Por unidad de caparazón fabricada.', 'Per unit of shell made.'],
  costo(),
);
cost(
  30,
  'costos',
  'BODYUPKEEP',
  ['Mantenimiento del cuerpo', 'Body upkeep'],
  ['Por ciclo y por unidad de cuerpo.', 'Per cycle and body unit.'],
  costo(),
);
cost(
  31,
  'costos',
  'AGECOST',
  ['Costo por edad', 'Age cost'],
  ['Por ciclo, a partir de la edad de inicio.', 'Per cycle, from the starting age.'],
  costo(),
);
cost(
  32,
  'costos',
  'AGECOSTSTART',
  ['Edad de inicio del costo', 'Age at which the cost starts'],
  ['Ciclos de vida antes de cobrar por edad.', 'Cycles of life before the age cost applies.'],
  ent(0, 0, 2147483647),
);
cost(
  33,
  'costos',
  'AGECOSTLINEARFRACTION',
  ['Fracción lineal del costo por edad', 'Age cost linear fraction'],
  ['Pendiente del costo por edad lineal.', 'Slope of the linear age cost.'],
  costo(),
);
cost(
  51,
  'costos',
  'AGECOSTMAKELOG',
  ['Costo por edad logarítmico', 'Logarithmic age cost'],
  ['Crece con el logaritmo de la edad.', 'Grows with the logarithm of age.'],
  bool(0),
);
cost(
  60,
  'costos',
  'AGECOSTMAKELINEAR',
  ['Costo por edad lineal', 'Linear age cost'],
  ['Crece en línea recta con la edad.', 'Grows linearly with age.'],
  bool(0),
);

// ---- Costos dinámicos -------------------------------------------------------
cost(
  56,
  'costos-dinamicos',
  'USEDYNAMICCOSTS',
  ['Ajuste dinámico de costos', 'Dynamic cost adjustment'],
  [
    'Sube o baja el multiplicador para llevar la población al objetivo.',
    'Raises or lowers the multiplier to steer the population to the target.',
  ],
  { ...bool(0), on: -1, noCero: true },
);
cost(
  53,
  'costos-dinamicos',
  'DYNAMICCOSTTARGET',
  ['Población objetivo', 'Target population'],
  ['Población a la que apunta el ajuste.', 'Population the adjustment aims at.'],
  ent(0, 0, 32000),
);
cost(
  55,
  'costos-dinamicos',
  'DYNAMICCOSTSENSITIVITY',
  ['Sensibilidad', 'Sensitivity'],
  ['Qué tan rápido reacciona el ajuste.', 'How fast the adjustment reacts.'],
  real(50, 0, 1000, 1),
);
cost(
  57,
  'costos-dinamicos',
  'DYNAMICCOSTTARGETUPPERRANGE',
  ['Margen superior (% del objetivo)', 'Upper range (% of target)'],
  ['Banda sin ajuste por encima del objetivo.', 'No-adjust band above the target.'],
  real(0, 0, 1000, 1),
);
cost(
  58,
  'costos-dinamicos',
  'DYNAMICCOSTTARGETLOWERRANGE',
  ['Margen inferior (% del objetivo)', 'Lower range (% of target)'],
  ['Banda sin ajuste por debajo del objetivo.', 'No-adjust band below the target.'],
  real(0, 0, 1000, 1),
);
cost(
  61,
  'costos-dinamicos',
  'DYNAMICCOSTINCLUDEPLANTS',
  ['Contar también los vegetales', 'Count vegetables too'],
  ['La población objetivo incluye vegetales.', 'The target population includes vegetables.'],
  { ...bool(0), noCero: true },
);
cost(
  54,
  'costos-dinamicos',
  'COSTMULTIPLIER',
  ['Multiplicador de costos', 'Cost multiplier'],
  ['Multiplica todos los costos (0 = gratis).', 'Multiplies every cost (0 = free).'],
  real(1, -1000, 1000, 0.01),
);
cost(
  62,
  'costos-dinamicos',
  'ALLOWNEGATIVECOSTX',
  ['Permitir multiplicador negativo', 'Allow a negative multiplier'],
  ['El ajuste puede llevarlo por debajo de 0.', 'The adjustment may push it below 0.'],
  bool(0),
);
cost(
  52,
  'costos-dinamicos',
  'BOTNOCOSTLEVEL',
  ['Costos en cero bajo la población', 'Zero costs below population'],
  [
    'Con menos bots que esto, nada cuesta (-1 = no).',
    'Below this many bots nothing costs (-1 = off).',
  ],
  ent(-1, -1, 32000),
);
cost(
  59,
  'costos-dinamicos',
  'COSTXREINSTATEMENTLEVEL',
  ['Reponer costos sobre la población', 'Reinstate above population'],
  ['Vuelven los costos al superar esta población.', 'Costs return above this population.'],
  ent(0, 0, 32000),
);

// ---- Formas -----------------------------------------------------------------
opt(
  80,
  'formas',
  'shapesAreVisable',
  ['Los bots ven las formas', 'Bots see the shapes'],
  ['Los ojos detectan los obstáculos.', 'Eyes detect the obstacles.'],
  bool(0),
);
opt(
  81,
  'formas',
  'shapesAreSeeThrough',
  ['Transparentes a la vista', 'Transparent to vision'],
  ['Se ve a través de las formas.', 'Vision goes through shapes.'],
  bool(0),
);
opt(
  82,
  'formas',
  'shapesAbsorbShots',
  ['Absorben disparos', 'Absorb shots'],
  ['Los disparos mueren al tocar una forma.', 'Shots die when they hit a shape.'],
  bool(0),
);
opt(
  84,
  'formas',
  'allowHorizontalShapeDrift',
  ['Deriva horizontal', 'Horizontal drift'],
  ['Las formas se desplazan de lado.', 'Shapes drift sideways.'],
  bool(0),
);
opt(
  83,
  'formas',
  'allowVerticalShapeDrift',
  ['Deriva vertical', 'Vertical drift'],
  ['Las formas se desplazan arriba y abajo.', 'Shapes drift up and down.'],
  bool(0),
);
opt(
  85,
  'formas',
  'shapeDriftRate',
  ['Velocidad de deriva', 'Shape drift rate'],
  ['Cuánto se mueven las formas.', 'How much shapes move.'],
  ent(0, 0, 32000),
);

// ---- Modos de juego (F1 / rondas) -------------------------------------------
opt(
  90,
  'modos',
  'Restart',
  ['Reiniciar la ronda sin heterótrofos', 'Restart round with no heterotrophs'],
  [
    'Si solo quedan vegetales, empieza otra ronda.',
    'If only vegetables remain, a new round starts.',
  ],
  bool(0),
);
opt(
  91,
  'modos',
  'F1',
  ['Modo F1 (concurso de especies)', 'F1 mode (species contest)'],
  ['Rondas hasta que una especie gane.', 'Rounds until one species wins.'],
  {
    ...bool(0),
    nota: {
      es: 'En una sim corriendo hace falta además arrancar el concurso (censo de especies).',
      en: 'On a running sim the contest must also be started (species census).',
    },
  },
);
opt(
  97,
  'modos',
  'MinRounds',
  ['Rondas mínimas', 'Minimum rounds'],
  [
    'Rondas del concurso (escribe también optMinRounds).',
    'Contest rounds (also writes optMinRounds).',
  ],
  ent(5, 1, 32000),
);
opt(
  98,
  'modos',
  'Maxrounds',
  ['Tope de rondas ganadas (0 = no)', 'Rounds-won cap (0 = off)'],
  ['Gana quien llegue a tantas victorias.', 'Whoever reaches this many wins takes it.'],
  ent(0, 0, 32000),
);
opt(
  99,
  'modos',
  'MaxCycles',
  ['Tope de ciclos por ronda (0 = no)', 'Cycle cap per round (0 = off)'],
  ['Corta la ronda a los N ciclos.', 'Ends the round after N cycles.'],
  ent(0, 0, 2147483647),
);
opt(
  100,
  'modos',
  'MaxPop',
  ['Población máxima por especie (0 = no)', 'Max population per species (0 = off)'],
  ['Tope de bots de cada especie en el concurso.', 'Bot cap per species in the contest.'],
  ent(0, 0, 32000),
);
opt(
  93,
  'modos',
  'Disqualify',
  ['Descalificación', 'Disqualification'],
  ['Qué acciones descalifican en el concurso.', 'Which actions disqualify in the contest.'],
  {
    valor: 'enum',
    porDefecto: 0,
    valores: [
      { v: 0, es: 'no', en: 'off' },
      { v: 1, es: 'nivel 1 (ataduras/virus)', en: 'level 1 (ties/virus)' },
      { v: 2, es: 'nivel 2 (todo)', en: 'level 2 (everything)' },
    ],
  },
);
opt(
  101,
  'modos',
  'optMinRounds',
  ['Rondas mínimas configuradas', 'Configured minimum rounds'],
  [
    'Valor al que vuelve MinRounds en cada concurso nuevo.',
    'Value MinRounds goes back to in each new contest.',
  ],
  ent(0, 0, 32000),
);

// ---- Modo evolución ---------------------------------------------------------
opt(
  92,
  'evolucion',
  'x_restartmode',
  ['Modo de reinicio', 'Restart mode'],
  [
    'Modo del ciclo de evolución (0 = normal; 4/5 = depredador oculto).',
    'Evolution loop mode (0 = normal; 4/5 = hidden predator).',
  ],
  ent(0, 0, 9),
);
opt(
  94,
  'evolucion',
  'hidePredCycl',
  ['Ciclos del depredador oculto', 'Hidden predator cycles'],
  ['Rampa del depredador oculto.', 'Ramp of the hidden predator.'],
  ent(0, 0, 32000),
);
opt(
  95,
  'evolucion',
  'LFOR',
  ['Factor de energía (LFOR)', 'Energy factor (LFOR)'],
  ['Divisor de la energía del depredador oculto.', 'Divisor of the hidden predator energy.'],
  real(0, 0, 150, 0.1),
);
opt(
  96,
  'evolucion',
  'intFindBestV2',
  ['Peso de la descendencia', 'Offspring weight'],
  [
    'Para elegir el mejor bot: 100 = equilibrio entre el bot y sus hijos.',
    'To pick the best bot: 100 = balance between the bot and its offspring.',
  ],
  ent(100, 0, 200),
);

// ---- Registro ---------------------------------------------------------------
opt(
  110,
  'registro',
  'chartingInterval',
  ['Intervalo de los gráficos (ciclos)', 'Charting interval (cycles)'],
  ['Cada cuántos ciclos se toma un punto.', 'How often a data point is taken.'],
  ent(200, 1, 32000),
);
opt(
  111,
  'registro',
  'DeadRobotSnp',
  ['Registrar los muertos', 'Record dead bots'],
  ['Guarda una ficha de cada bot que muere.', 'Keeps a record of each bot that dies.'],
  bool(0),
);
opt(
  112,
  'registro',
  'SnpExcludeVegs',
  ['Sin vegetales en el registro', 'Exclude vegetables'],
  ['El registro de muertos ignora vegetales.', 'The death record ignores vegetables.'],
  bool(0),
);

/** Todos los parámetros, en el orden de sus grupos. */
export const PARAMETROS = Object.freeze(
  GRUPOS.flatMap((g) => lista.filter((p) => p.grupo === g.id)).map((p) => Object.freeze(p)),
);

/** @type {Map<string, Parametro>} */
const porClave = new Map(PARAMETROS.map((p) => [p.clave, p]));

/** @param {string} clave @returns {Parametro | undefined} */
export const parametro = (clave) => porClave.get(clave);

/** @param {TipoParametro} tipo @param {number | string} id */
export const claveDe = (tipo, id) => `${tipo}:${id}`;

// ---- Valores ----------------------------------------------------------------

/**
 * Valor válido para el parámetro, o un código de error.
 * Acepta true/false en los bool (se guardan como 0/`on`).
 * @param {Parametro} p @param {unknown} v
 * @returns {{ok: true, v: number} | {ok: false, codigo: string}}
 */
export function normalizarValor(p, v) {
  if (p.valor === 'bool') {
    const on = p.on ?? 1;
    if (v === true) return { ok: true, v: on };
    if (v === false) return { ok: true, v: 0 };
    if (v === 0 || v === on) return { ok: true, v: /** @type {number} */ (v) };
    // Cualquier otro número: vale lo que el core entiende (distinto de 0 =
    // encendido) si el parámetro lo lee así; si no, es un error.
    if (p.noCero && typeof v === 'number' && Number.isFinite(v)) return { ok: true, v: on };
    return { ok: false, codigo: 'valor-tipo' };
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return { ok: false, codigo: 'valor-tipo' };
  if (p.valor === 'enum') {
    if (!(p.valores || []).some((x) => x.v === v)) return { ok: false, codigo: 'valor-enum' };
    return { ok: true, v };
  }
  if (p.valor === 'int' && !Number.isInteger(v)) return { ok: false, codigo: 'valor-tipo' };
  if ((p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max))
    return { ok: false, codigo: 'valor-rango' };
  return { ok: true, v };
}

// ---- Bases ------------------------------------------------------------------

// Tamaños del slider del original (OptionsForm.frm:4075-4099); el 1 es el
// campo de liga F1.
/** @param {number} n @returns {[number, number]} */
export function dimensionesCampo(n) {
  if (n === 1) return [9237, 6928];
  if (n <= 12) return [8000 * n, 6000 * n];
  return [8000 * 12 * (n - 12) * 2, 6000 * 12 * (n - 12) * 2];
}

// Lo que manda el reinicio de la clásica con el panel sin tocar
// (collectOptions de port/web/index.html): todas las opciones del panel
// (incluidas 110-112 del panel de gráficos y los bordes 2/3), los costos
// que muestra y las nombradas. Las opciones que la clásica no muestra (1,
// 39, 41, 92, 94-96, 101) y los costos ocultos quedan en el valor del core.
const IDS_CLASICA = [
  2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 30, 31, 32, 33, 34, 35, 36, 37, 38, 40, 50,
  51, 52, 53, 54, 55, 56, 60, 61, 62, 63, 64, 70, 71, 72, 80, 81, 82, 83, 84, 85, 90, 91, 93, 97,
  98, 99, 100, 110, 111, 112,
];
const COSTOS_CLASICA = [
  5, 7, 8, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 52, 53, 54, 55, 56, 57, 58, 59, 61,
  62,
];
const NOMBRADAS = [
  'fieldW',
  'fieldH',
  'maxEnergy',
  'minVegs',
  'maxPopulation',
  'repopAmount',
  'repopCooldown',
  'startChlr',
  'mutations',
];

/** @returns {Record<string, number>} */
function valoresClasica() {
  /** @type {Record<string, number>} */
  const v = {};
  const pon = (/** @type {string} */ k) => {
    const p = /** @type {Parametro} */ (porClave.get(k));
    v[k] = p.porDefecto;
  };
  for (const k of NOMBRADAS) pon(`base:${k}`);
  for (const id of IDS_CLASICA) pon(`opt:${id}`);
  for (const i of COSTOS_CLASICA) pon(`cost:${i}`);
  return v;
}

// btnSetF1_Click (OptionsForm.frm:2579-2668) tal como lo replica
// applyF1Settings de la clásica: costos de liga (el resto de 1..70 en 0,
// incluido DynamicCosts), física de superficie metálica, luz, vegetales,
// campo 9237×6928 toroidal y mutaciones apagadas. Una diferencia con la
// clásica, a favor del original: como los dos ejes quedan conectados, el
// reset manda también opt:1 (TmpOpts.Toroidal = True, :2621), que la
// clásica no escribe; solo cambia la marca Toroidal del .dbsim (el core no
// la lee para simular). Lo que btnSetF1 hace por especie (qty = 5, sin
// mutar, nada fijo) va en las especies del escenario.
export const F1_COSTOS = Object.freeze({
  23: 2,
  7: 0.04,
  5: 0.004,
  20: 0.05,
  22: 2,
  26: 0.01,
  27: 0.01,
  28: 0.1,
  29: 0.1,
  54: 1,
  30: 0.00001,
  31: 0.01,
  8: 0.2,
});
const F1_OPTS = {
  50: 0,
  33: 0,
  40: 1,
  30: 0,
  13: 0,
  56: 10000,
  21: 0,
  54: 0,
  55: 0,
  70: 0,
  71: 0,
  72: 0,
  11: 180,
  63: 0.5,
  35: 0,
  37: 0,
  18: 0,
  20: 0,
  19: 2,
  16: 0.6,
  17: 0.4,
  15: 0,
  14: 0,
  62: 1,
  60: 1,
  2: 1,
  3: 1,
};
const F1_NOMBRADAS = {
  fieldW: 9237,
  fieldH: 6928,
  maxEnergy: 40,
  maxPopulation: 25,
  minVegs: 10,
  repopAmount: 10,
  repopCooldown: 25,
  mutations: 0,
};

/**
 * Los costos que escribe «Costos F1»: For t = 1 To 70 en 0 y después los de
 * liga (solo los índices con consumidor en el core: los demás no existen
 * como parámetro y valen 0 en toda sim nueva).
 * @returns {Record<string, number>}
 */
export function costosF1() {
  /** @type {Record<string, number>} */
  const v = {};
  for (const p of PARAMETROS)
    if (p.tipo === 'cost' && /** @type {number} */ (p.id) >= 1)
      v[p.clave] =
        /** @type {Record<number, number>} */ (F1_COSTOS)[/** @type {number} */ (p.id)] ?? 0;
  return v;
}

/** «Sin costos»: todos los costos con el valor de la clásica (0, y los dinámicos por defecto). */
export function costosNinguno() {
  /** @type {Record<string, number>} */
  const v = {};
  for (const p of PARAMETROS) if (p.tipo === 'cost') v[p.clave] = p.porDefecto;
  return v;
}

/** @returns {Record<string, number>} */
function valoresF1() {
  const v = { ...valoresClasica(), ...costosF1() };
  for (const [id, x] of Object.entries(F1_OPTS)) v[`opt:${id}`] = x;
  for (const [k, x] of Object.entries(F1_NOMBRADAS)) v[`base:${k}`] = x;
  return v;
}

/**
 * Bases de escenario: valores explícitos que el reset manda siempre.
 * @type {Readonly<Record<string, {es: string, en: string, ayuda: Texto, valores: Readonly<Record<string, number>>}>>}
 */
export const BASES = Object.freeze({
  clasica: {
    es: 'Clásica',
    en: 'Classic',
    ayuda: {
      es: 'Los valores con los que arranca la interfaz clásica: sin costos, campo 32000².',
      en: 'The values the classic interface starts with: no costs, 32000² field.',
    },
    valores: Object.freeze(valoresClasica()),
  },
  f1: {
    es: 'Liga F1',
    en: 'F1 league',
    ayuda: {
      es: 'Ajustes de liga F1: costos, física y campo 9237×6928 toroidal.',
      en: 'F1 league settings: costs, physics and a 9237×6928 toroidal field.',
    },
    valores: Object.freeze(valoresF1()),
  },
});

/**
 * Valores que se mandan al reset: los de la base más los cambios.
 * @param {string} baseId @param {Record<string, number>} [cambios]
 * @returns {Record<string, number>}
 */
export function valoresResueltos(baseId, cambios = {}) {
  const b = BASES[baseId];
  if (!b) throw new Error(`base desconocida: ${baseId}`);
  return { ...b.valores, ...cambios };
}

/**
 * Valor efectivo de un parámetro (lo que tendrá la sim tras el reset): el
 * resuelto o, si nadie lo fija, el del core. Acoplados: opt:1 = 2 && 3
 * (derivado: un valor propio se ignora) y opt:101 sin fijar = el de 97.
 * @param {Record<string, number>} resueltos @param {string} clave
 * @returns {number}
 */
export function valorEfectivo(resueltos, clave) {
  const p = porClave.get(clave);
  if (!p) throw new Error(`parámetro desconocido: ${clave}`);
  if (clave === 'opt:1')
    return valorEfectivo(resueltos, 'opt:2') && valorEfectivo(resueltos, 'opt:3') ? 1 : 0;
  if (Object.hasOwn(resueltos, clave)) return resueltos[clave];
  if (clave === 'opt:101' && Object.hasOwn(resueltos, 'opt:97')) return resueltos['opt:97'];
  return p.porDefecto;
}

/**
 * Lo que escribe en el motor mandar `clave` = v (las acopladas escriben
 * más de un campo): {clave: valor} de cada parámetro afectado.
 * @param {string} clave @param {number} v
 * @returns {Record<string, number>}
 */
export function efectosDe(clave, v) {
  if (clave === 'opt:1') return { 'opt:1': v ? 1 : 0, 'opt:2': v ? 1 : 0, 'opt:3': v ? 1 : 0 };
  if (clave === 'opt:97') return { 'opt:97': v, 'opt:101': v };
  return { [clave]: v };
}

/**
 * Junta cambios nuevos a los de un escenario (p. ej. el «actual» de una
 * corrida tras sus cambios en caliente) sin perder el efecto de las
 * acopladas: opt:1 se reparte en 2 y 3 (es derivado) y fijar 97 suelta un
 * 101 anterior (97 lo escribe). El resultado sirve como `cambios` de un
 * escenario válido y da los mismos valores efectivos que la sim.
 * @param {Record<string, number>} cambios @param {Record<string, number>} nuevos
 * @returns {Record<string, number>}
 */
export function fusionarCambios(cambios, nuevos) {
  const out = { ...cambios };
  delete out['opt:1'];
  for (const [k, v] of Object.entries(nuevos)) {
    if (k === 'opt:1') {
      delete out['opt:2'];
      delete out['opt:3'];
      out['opt:2'] = v ? 1 : 0;
      out['opt:3'] = v ? 1 : 0;
      continue;
    }
    if (k === 'opt:97') delete out['opt:101'];
    delete out[k];
    out[k] = v;
  }
  return out;
}

/**
 * Las opciones del mensaje {t:'reset'} (forma de collectOptions de la
 * clásica: nombradas + opts + costs + fieldW/fieldH).
 * @param {Record<string, number>} resueltos
 */
export function opcionesReset(resueltos) {
  /** @type {Record<string, any>} */
  const o = { opts: {}, costs: {} };
  // Toroidal (derivado): solo si los dos ejes quedan conectados; va primero
  // (id 1) y escribe 2 y 3 con el mismo valor que les toca después.
  if (valorEfectivo(resueltos, 'opt:1')) o.opts[1] = 1;
  for (const [clave, v] of Object.entries(resueltos)) {
    const p = porClave.get(clave);
    if (!p) throw new Error(`parámetro desconocido: ${clave}`);
    if (p.derivado) continue;
    if (p.tipo === 'opt') o.opts[p.id] = v;
    else if (p.tipo === 'cost') o.costs[p.id] = v;
    else o[/** @type {string} */ (p.id)] = p.id === 'mutations' ? !!v : v;
  }
  // El worker lee siempre estas (sin dato serían undefined → 0 en el core).
  for (const k of NOMBRADAS) {
    if (o[k] === undefined) {
      const p = /** @type {Parametro} */ (porClave.get(`base:${k}`));
      o[k] = k === 'mutations' ? !!p.porDefecto : p.porDefecto;
    }
  }
  return o;
}

/**
 * Mensaje en vivo para un parámetro (null si requiere sim nueva): setopt,
 * setcost o setbase (C12).
 * @param {string} clave @param {number} v
 */
export function mensajeVivo(clave, v) {
  const p = porClave.get(clave);
  if (!p) throw new Error(`parámetro desconocido: ${clave}`);
  if (!p.vivo) return null;
  if (p.tipo === 'opt') return { t: 'setopt', id: /** @type {number} */ (p.id), v };
  if (p.tipo === 'base') return { t: 'setbase', vals: { [/** @type {string} */ (p.id)]: v } };
  return { t: 'setcost', i: /** @type {number} */ (p.id), v };
}

// ---- Controles básicos (decisión 14) ----------------------------------------
// Diez controles, algunos compuestos. Criterio: lo que más cambia la
// ecología y se entiende sin conocer el motor — quién paga por vivir
// (costos), si hay evolución (mutaciones), cuánto mundo y cómo son sus
// bordes, cuánta comida entra (energía solar, tope y repoblación de
// vegetales, día y noche), el medio (fluido/sólido/espacio) y si los
// muertos alimentan (cadáveres). La energía inicial es de cada especie y se
// edita en la lista de especies, no aquí.
//
// escribe(valor) → {clave: valor} con los parámetros que cambia;
// lee(valores efectivos) → el valor del control (o 'personalizado').

/** @typedef {{v: string | number, es: string, en: string}} OpcionControl */
/**
 * @typedef {{
 *   id: string, es: string, en: string, ayuda: Texto,
 *   valor: TipoValor, opciones?: OpcionControl[], min?: number, max?: number, paso?: number,
 *   claves: string[],
 *   escribe: (v: any) => Record<string, number>,
 *   lee: (ef: (clave: string) => number) => any,
 * }} ControlBasico
 */

/** @param {Record<string, number>} a @param {(clave: string) => number} ef */
const coincide = (a, ef) => Object.entries(a).every(([k, v]) => ef(k) === v);

// Presets de medio con los valores EXACTOS de los combos del original
// (OptionsForm.frm:4406-4453): Density, Viscosity, Static, Kinetic, Zgravity.
export const MEDIOS = Object.freeze({
  fluido: { 'opt:14': 1e-7, 'opt:15': 0.0005, 'opt:16': 0, 'opt:17': 0, 'opt:19': 0 },
  solido: { 'opt:14': 0, 'opt:15': 0, 'opt:16': 0.6, 'opt:17': 0.4, 'opt:19': 2 },
  espacio: { 'opt:14': 0, 'opt:15': 0, 'opt:16': 0, 'opt:17': 0, 'opt:19': 0 },
});

const BORDES = Object.freeze({
  paredes: { 'opt:2': 0, 'opt:3': 0 },
  toroidal: { 'opt:2': 1, 'opt:3': 1 },
  'cilindro-h': { 'opt:2': 0, 'opt:3': 1 },
  'cilindro-v': { 'opt:2': 1, 'opt:3': 0 },
});

/** @param {string} clave @param {string} id @param {[string, string]} nombre @param {[string, string]} ayuda */
function simple(clave, id, nombre, ayuda) {
  const p = /** @type {Parametro} */ (porClave.get(clave));
  return {
    id,
    es: nombre[0],
    en: nombre[1],
    ayuda: { es: ayuda[0], en: ayuda[1] },
    valor: p.valor,
    ...(p.min !== undefined ? { min: p.min } : {}),
    ...(p.max !== undefined ? { max: p.max } : {}),
    ...(p.paso !== undefined ? { paso: p.paso } : {}),
    claves: [clave],
    escribe: (/** @type {any} */ v) => ({
      [clave]: p.valor === 'bool' ? (v ? (p.on ?? 1) : 0) : Number(v),
    }),
    lee: (/** @type {(c: string) => number} */ ef) =>
      p.valor === 'bool' ? ef(clave) !== 0 : ef(clave),
  };
}

/** @type {readonly ControlBasico[]} */
export const CONTROLES_BASICOS = Object.freeze([
  {
    id: 'costos',
    es: 'Costos',
    en: 'Costs',
    ayuda: {
      es: 'Cuánto gasta un bot por vivir y actuar. F1 = los de la liga; sin costos = todo gratis.',
      en: 'What a bot pays to live and act. F1 = league costs; no costs = everything free.',
    },
    valor: 'enum',
    opciones: [
      { v: 'f1', es: 'F1', en: 'F1' },
      { v: 'ninguno', es: 'Sin costos', en: 'No costs' },
      { v: 'personalizado', es: 'Personalizados', en: 'Custom' },
    ],
    claves: PARAMETROS.filter((p) => p.tipo === 'cost').map((p) => p.clave),
    escribe: (v) => (v === 'f1' ? costosF1() : v === 'ninguno' ? costosNinguno() : {}),
    lee: (ef) =>
      coincide(costosF1(), ef) ? 'f1' : coincide(costosNinguno(), ef) ? 'ninguno' : 'personalizado',
  },
  simple(
    'base:mutations',
    'mutaciones',
    ['Mutaciones', 'Mutations'],
    [
      'Con mutaciones los hijos cambian y las especies evolucionan.',
      'With mutations offspring change and species evolve.',
    ],
  ),
  {
    id: 'tamano',
    es: 'Tamaño del campo',
    en: 'Field size',
    ayuda: {
      es: 'Tamaños clásicos del campo (1 = campo F1). Requiere sim nueva.',
      en: 'Classic field sizes (1 = F1 field). Needs a new sim.',
    },
    valor: 'enum',
    opciones: Array.from({ length: 15 }, (_, i) => {
      const [w, h] = dimensionesCampo(i + 1);
      return { v: i + 1, es: `${i + 1} · ${w}×${h}`, en: `${i + 1} · ${w}×${h}` };
    }).concat([{ v: 0, es: 'Personalizado', en: 'Custom' }]),
    claves: ['base:fieldW', 'base:fieldH'],
    escribe: (v) => {
      const n = Number(v);
      if (!(n >= 1 && n <= 15)) return {};
      const [w, h] = dimensionesCampo(n);
      return { 'base:fieldW': w, 'base:fieldH': h };
    },
    lee: (ef) => {
      for (let n = 1; n <= 15; n++) {
        const [w, h] = dimensionesCampo(n);
        if (ef('base:fieldW') === w && ef('base:fieldH') === h) return n;
      }
      return 0;
    },
  },
  {
    id: 'bordes',
    es: 'Bordes',
    en: 'Edges',
    ayuda: {
      es: 'Paredes, o lados conectados (lo que sale por uno entra por el otro).',
      en: 'Walls, or connected sides (what leaves one side enters the other).',
    },
    valor: 'enum',
    opciones: [
      { v: 'paredes', es: 'Paredes', en: 'Walls' },
      { v: 'toroidal', es: 'Toroidal', en: 'Toroidal' },
      { v: 'cilindro-h', es: 'Cilindro (izquierda↔derecha)', en: 'Cylinder (left↔right)' },
      { v: 'cilindro-v', es: 'Cilindro (arriba↔abajo)', en: 'Cylinder (top↔bottom)' },
    ],
    claves: ['opt:2', 'opt:3'],
    escribe: (v) => ({ .../** @type {Record<string, Record<string, number>>} */ (BORDES)[v] }),
    lee: (ef) => {
      for (const [k, a] of Object.entries(BORDES)) if (coincide(a, ef)) return k;
      return 'paredes';
    },
  },
  simple(
    'base:maxEnergy',
    'luz',
    ['Energía solar', 'Solar energy'],
    [
      'Energía que reciben los vegetales en cada ciclo: la comida que entra al mundo.',
      'Energy vegetables receive each cycle: the food entering the world.',
    ],
  ),
  simple(
    'base:maxPopulation',
    'vegetales',
    ['Tope de vegetales', 'Vegetable cap'],
    ['Cuántos vegetales puede haber como máximo.', 'How many vegetables there can be at most.'],
  ),
  simple(
    'base:minVegs',
    'repoblacion',
    ['Repoblación de vegetales', 'Vegetable repopulation'],
    [
      'Si los vegetales bajan de este nivel, se siembran más (0 = nunca).',
      'If vegetables drop below this level, more are seeded (0 = never).',
    ],
  ),
  {
    id: 'dia-noche',
    es: 'Día y noche',
    en: 'Day and night',
    ayuda: {
      es: 'Ciclos que dura el día (y la noche); 0 = siempre de día.',
      en: 'Cycles the day (and the night) lasts; 0 = always day.',
    },
    valor: 'int',
    min: 0,
    max: 32000,
    paso: 50,
    claves: ['opt:33', 'opt:34'],
    escribe: (v) => {
      const n = Math.max(0, Math.round(Number(v) || 0));
      return n > 0 ? { 'opt:33': 1, 'opt:34': n } : { 'opt:33': 0 };
    },
    lee: (ef) => (ef('opt:33') ? ef('opt:34') : 0),
  },
  {
    id: 'medio',
    es: 'Medio',
    en: 'Medium',
    ayuda: {
      es: 'Fluido (agua), sólido (superficie con rozamiento) o espacio (nada frena).',
      en: 'Fluid (water), solid (surface with friction) or space (nothing slows down).',
    },
    valor: 'enum',
    opciones: [
      { v: 'espacio', es: 'Espacio', en: 'Space' },
      { v: 'fluido', es: 'Fluido', en: 'Fluid' },
      { v: 'solido', es: 'Sólido', en: 'Solid' },
      { v: 'personalizado', es: 'Personalizado', en: 'Custom' },
    ],
    claves: ['opt:14', 'opt:15', 'opt:16', 'opt:17', 'opt:19'],
    escribe: (v) => ({ .../** @type {Record<string, Record<string, number>>} */ (MEDIOS)[v] }),
    lee: (ef) => {
      for (const [k, a] of Object.entries(MEDIOS)) if (coincide(a, ef)) return k;
      return 'personalizado';
    },
  },
  simple(
    'opt:50',
    'cadaveres',
    ['Cadáveres', 'Corpses'],
    ['Los bots muertos quedan como comida.', 'Dead bots remain as food.'],
  ),
]);
