// dbcore/sim.hpp — el estado del mundo: rob(), SimOpts, shots, colas rep/kil
// y los contadores del tick (Robots.bas:359-383, Master.bas, Vegs.bas:7-20).
// Las rutinas del ciclo viven en senses/ties/shots/physics/robots/master.hpp;
// todas toman Sim& (los módulos VB6 eran estado global).
#pragma once

#include <string>
#include <vector>

#include "bot.hpp"
#include "memmap.hpp"
#include "rng.hpp"
#include "sysvars.hpp"
#include "vm.hpp"

namespace db {

// CInt de VB6 (asignación a Integer): bancario. Los llamadores garantizan el
// rango (Q15); los sitios sin clamp del catálogo llevan comentario.
inline vb_integer vb_cint(double v) {
  return static_cast<vb_integer>(vb_round64(v));
}

// Robots.bas:359-365
inline constexpr int RobSize = 120;
inline constexpr int half = 60;
inline constexpr vb_long CubicTwipPerBody = 905;
inline constexpr int ROBARRAYMAX = 32000;
inline constexpr int GeneticSensitivity = 75;  // Robots.bas:377
inline constexpr int MAXNATIVESPECIES = 76;    // SimOptions.bas:47

// Índices de SimOpts.Costs (SimOptions.bas:2-38). Los de la VM ya están en
// Costs (vm.hpp); aquí los del ciclo.
namespace cost {
inline constexpr int CHLRCOST = 8;
inline constexpr int VENOMCOST = 26;
inline constexpr int POISONCOST = 27;
inline constexpr int SLIMECOST = 28;
inline constexpr int SHELLCOST = 29;
inline constexpr int MOVECOST = 20;
inline constexpr int TURNCOST = 21;
inline constexpr int TIECOST = 22;
inline constexpr int SHOTCOST = 23;
inline constexpr int DNACYCCOST = 24;
inline constexpr int DNACOPYCOST = 25;
inline constexpr int BODYUPKEEP = 30;
inline constexpr int AGECOST = 31;
inline constexpr int AGECOSTSTART = 32;
inline constexpr int AGECOSTLINEARFRACTION = 33;
inline constexpr int AGECOSTMAKELOG = 51;
inline constexpr int BOTNOCOSTLEVEL = 52;
inline constexpr int DYNAMICCOSTTARGET = 53;
inline constexpr int COSTMULTIPLIER = 54;
inline constexpr int DYNAMICCOSTSENSITIVITY = 55;
inline constexpr int USEDYNAMICCOSTS = 56;
inline constexpr int DYNAMICCOSTTARGETUPPERRANGE = 57;
inline constexpr int DYNAMICCOSTTARGETLOWERRANGE = 58;
inline constexpr int COSTXREINSTATEMENTLEVEL = 59;
inline constexpr int AGECOSTMAKELINEAR = 60;
inline constexpr int DYNAMICCOSTINCLUDEPLANTS = 61;
inline constexpr int ALLOWNEGATIVECOSTX = 62;
}  // namespace cost

// Type shot (Shots.bas:5-37).
struct Shot {
  bool exist = false;
  Vector pos{}, opos{}, velocity{};
  vb_integer parent = 0;  // ¡SLOT del tirador, no AbsNum! (inmunidad filial
                          // rota, 33-SHOTS.md / B-caso del catálogo §9)
  vb_integer age = 0;
  vb_single nrg = 0;
  vb_single Range = 0;
  vb_integer value = 0;
  vb_long color = 0;
  vb_integer shottype = 0;
  bool fromveg = false;
  std::string FromSpecie;
  vb_integer memloc = 0, Memval = 0;
  std::vector<Block> dna;
  vb_integer DnaLen = 0;
  vb_integer genenum = 0;
  bool stored = false;
  bool flash = false;
};

// Subconjunto de SimOpts (SimOptions.bas) + globales de mundo que el ciclo
// lee. Defaults del harness (70-CASOS-DORADOS.md §0.2).
struct SimOptsT {
  vb_single MaxVelocity = 40;
  vb_single PhysMoving = 0.66f;
  vb_single FieldWidth = 32000, FieldHeight = 32000;
  vb_single xDivisor = 1, yDivisor = 1;  // main.frm:1252-1256
  vb_single Density = 0, Viscosity = 0;
  vb_single Zgravity = 0, Ygravity = 0, PhysBrown = 0;
  vb_single CoefficientStatic = 0, CoefficientKinetic = 0;
  vb_single CoefficientElasticity = 0;  // OptionsForm.frm:2651 default
  vb_single Gradient = 1.02f;           // MDIForm1.frm:2486 default
  bool Daytime = true;                  // §0.2 del harness
  bool shapesAreVisable = false;
  bool shapesAreSeeThrough = false;
  bool ZeroMomentum = false;
  bool Pondmode = false, Updnconnected = false, Dxsxconnected = false;
  bool CorpseEnabled = true;
  bool DisableTies = false, DisableFixing = false, DisableTypArepro = false;
  vb_long BadWastelevel = 400;  // Robots.bas:1186: 0 se corrige a 400
  vb_single Decay = 0;
  vb_long Decaydelay = 100;
  // bodyfix (HDRoutines.bas:854, registro de Windows): umbral de la P4
  // anti-gigantes. Default 32100 > 32000 = la pasada está MUERTA (B-25).
  vb_integer bodyfix = 32100;
  // Intercambio de energía de los shots -1/-6 (MDIForm1.frm:2501-2503).
  bool EnergyExType = true;
  vb_integer EnergyFix = 200;
  vb_single EnergyProp = 1;
  int DecayType = 0;  // 0/1 sin shot, 2 waste, 3 nrg
  bool NoShotDecay = false, NoWShotDecay = false;
  bool FixedBotRadii = false;
  vb_single MaxPopulation = 100;
  vb_long MinVegs = 0;
  vb_long TotRunCycle = 0;
  vb_long TotBorn = 0;
  bool Restart = false, F1 = false;

  // --- mutación (SimOptions.bas; defaults de constants.yaml §globales) ---
  vb_single MutCurrMult = 1;      // OptionsForm.frm:4890: <= 0 se corrige a 1
  bool DisableMutations = false;
  bool MutOscill = false;         // paso 4 del tick (Master.bas:203-233)
  bool MutOscillSine = false;
  vb_long MutCycMax = 0, MutCycMin = 0;
  bool EnableAutoSpeciation = false;
  vb_integer SpeciationGeneticDistance = 0;
  vb_long SpeciationForkInterval = 0;

  // --- mundo B7 (50-MUNDO.md; defaults de constants.yaml §mdiform salvo
  // los que el harness fija en otro valor) ---
  vb_integer RepopAmount = 10;      // MDIForm defaults
  vb_integer RepopCooldown = 10;
  vb_long MaxEnergy = 100;
  vb_integer LightIntensity = 0;    // pondmode
  bool DayNight = false;
  vb_integer CycleLength = 0;
  vb_long DayNightCycleCounter = 0;
  bool SunUp = false, SunDown = false;
  vb_long SunUpThreshold = 500000;
  vb_long SunDownThreshold = 1000000;
  vb_integer SunThresholdMode = 0;
  bool SunOnRnd = false;
  vb_single VegFeedingToBody = 0.75f;
  vb_integer Tides = 0, TidesOf = 0;

  // Formas (SimOptions.bas:171-179).
  bool allowVerticalShapeDrift = false;
  bool allowHorizontalShapeDrift = false;
  bool shapesAbsorbShots = false;
  vb_integer shapeDriftRate = 0;
  bool makeAllShapesTransparent = false;
  bool makeAllShapesBlack = false;

  // Campos persistidos por SaveSimulation sin consumidor en el core (el
  // formato binario de sim los serializa; 60-FORMATOS.md §4).
  std::string SimName;
  vb_integer FieldSize = 0;
  vb_long TotRunTime = 0;
  vb_long UserSeedNumber = 0;
  bool Toroidal = false;
  bool KillDistVegs = false, BlockedVegs = false;
  bool DeadRobotSnp = false, SnpExcludeVegs = false;
  vb_single CostExecCond = 0;
  vb_integer PopLimMethod = 0;
  vb_single PhysSwim = 0;
  bool PlanetEaters = false;
  vb_single PlanetEatersG = 0;
  vb_integer chartingInterval = 200;
  vb_integer FluidSolidCustom = 2;
  vb_integer CostRadioSetting = 2;
  vb_single oldCostX = 0;
  vb_integer EGridWidth = 0;
  bool EGridEnabled = false;
  vb_long SimGUID = 0;
  vb_integer SpeciationGenerationalDistance = 0;
  vb_integer SpeciationMinimumPopulation = 0;
};

// Type datispecie (varspecie.bas:15-58) sin la capa de UI (DisplayImage).
// Los cuatro primeros campos conservan el orden del registro mínimo de M3
// (los tests inicializan {Name, population, Native, SubSpeciesCounter}).
// `dnatext` es del port: el contenido del archivo de robot en memoria (el
// original guarda `path` y relee del disco en RobScriptLoad; decisión M5:
// el core no toca disco). `path` se conserva como dato persistido y por el
// centinela "Invalid Path" de aggiungirob (Globals.bas:428-433).
struct Specie {
  std::string Name;
  vb_long population = 0;            // Integer en el fuente; Long desde M3
  bool Native = true;
  vb_integer SubSpeciesCounter = 0;  // NeoMutations.bas:108-116
  std::array<vb_integer, 14> Skin{};
  std::string path;
  std::string dnatext;               // port: sustituto en memoria del disco
  vb_integer Stnrg = 3000;
  bool Veg = false;
  bool NoChlr = false;
  bool Fixed = false;
  vb_long color = 0;
  vb_integer Colind = 0;
  vb_single Postp = 0, Poslf = 0, Posdn = 1, Posrg = 1;
  vb_integer qty = 5;
  std::string Comment;
  Mutationprobs Mutables{};
  bool CantSee = false;
  bool DisableDNA = false;
  bool DisableMovementSysvars = false;
  bool CantReproduce = false;
  bool VirusImmune = false;
  bool kill_mb = false;
  bool dq_kill = false;
};

// Type Teleporter (Teleport.bas:23-51). La E/S de disco del original
// (path/intInPath/intOutPath + archivos .dbo) se sustituye por búferes en
// memoria: `outbox` acumula los organismos serializados que salen y `inbox`
// es la cola de registros .dbo pendientes de entrar (decisión de M5: el
// core no toca disco; la capa host mueve los búferes). El [PROBABLE BUG]
// B7-4 (MsgBox modal ante un archivo no-dbo) queda en la capa host: el
// inbox solo contiene registros dbo por construcción.
struct Teleporter {
  bool exist = false;
  Vector pos{};
  vb_single Width = 0, Height = 0;
  vb_long color = 0;
  Vector vel{};
  std::string path;  // persistido por el formato de sim
  bool In = false, Out = false, local = false, Internet = false;
  bool driftHorizontal = false, driftVertical = false;
  bool highlight = false;
  bool teleportVeggies = false, teleportCorpses = false;
  bool RespectShapes = false;
  vb_long NumTeleported = 0;
  vb_long NumTeleportedIn = 0;
  Vector center{};
  bool teleportHeterotrophs = false;
  vb_integer InboundPollCycles = 0;
  vb_integer BotsPerPoll = 0;
  vb_integer PollCountDown = 0;
  vb_integer BackFlowLimit = 0;  // sin consumidores vivos

  // Port: sustitutos en memoria del directorio de disco.
  std::vector<std::vector<unsigned char>> outbox;  // .dbo salientes
  std::vector<std::vector<unsigned char>> inbox;   // .dbo pendientes de entrar
};

inline constexpr int MAXTELEPORTERS = 10;

// Obstacles.bas — el subconjunto de Type Obstacle que la física/visión toca
// (AABB en pos/Width/Height; vel para los refvars de lookoccurrShape). Con
// numObstacles = 0 (default del harness) ninguna rutina de formas se ejecuta.
struct Obstacle {
  bool exist = false;
  Vector pos{};
  vb_single Width = 0, Height = 0;
  vb_long color = 0;  // el original lo sortea con Rnd CRUDO (setup, B7-5)
  Vector vel{};
};

// Quads.bas:12-18 — Type BucketType: array empaquetado terminado en -1
// (crece de a 5, se encoge de a 50) + lista precalculada de adyacentes
// (adjBucket(1..8), .x = -1 = sin más adyacentes).
struct BucketType {
  std::vector<vb_integer> arr = std::vector<vb_integer>(1, 0);  // arr(0) sin uso
  vb_integer size = 0;
  std::array<Vector, 9> adjBucket{};
};

// Quads.bas:6 — celdas de 4000x4000 twips (la visión máxima 3348 + 2 radios
// cabe en una celda).
inline constexpr vb_long BucketSize = 4000;

// Contadores de stubs documentados: cada camino del fuente aún no transcrito
// que un caso dorado futuro cubrirá registra su paso por aquí (misma política
// que VmDiag, 10-CICLO.md §14).
struct SimDiag {
  // Cerrados en M4 (física y visión): estos contadores ya no se incrementan
  // en ningún camino — un test los asserta a 0 como señal del reemplazo.
  int bordercolls_stub = 0;      // M4: bordercolls/SphereDrag/Gravity reales
  int tie_force_stub = 0;        // M4: TieHooke real
  int tietorque_stub = 0;        // M4: TieTorque real
  int vision_sweep_stub = 0;     // M4: BucketsProximity real
  int shot_collision_simplified = 0;  // M4: NewShotCollision swept-sphere
  int bot_collision_simplified = 0;   // M4: BucketsCollision/Repel3 reales

  int shot_feed_stub = 0;        // M6: releasenrg/takenrg/releasebod y
                                 //   addgene reales; asertado a 0
  int makevirus_stub = 0;        // M6: MakeVirus/copygene reales; asertado a 0
  int mutate_stub = 0;           // M7: mutate real (NeoMutations completo);
                                 //   asertado a 0
  int makestuff_stub = 0;        // M7: sharechloroplasts real (el resto de
                                 //   MakeStuff era real desde M6); asertado a 0
  int handlewaste_stub = 0;      // M8: feedveg2/altzheimer reales;
                                 //   asertado a 0
  int sexrepro_stub = 0;         // M7: SexReproduce/crossover reales;
                                 //   asertado a 0
  int world_stub = 0;            // M8: repoblación/feedvegs/teleporters
                                 //   reales; asertado a 0
  int shapes_vision_stub = 0;    // M6: CompareShapes/lookoccurrShape reales
                                 //   (B-12/B-13/B-14); asertado a 0
  int obstacle_collision_stub = 0;  // M8: DoObstacleCollisions /
                                    //   DoShotObstacleCollisions reales;
                                    //   asertado a 0
  int err9_ties_slot11 = 0;      // sitio de error 9: TieTorque con j > 10
                                 //   (inalcanzable con el máximo de 9 ties;
                                 //   decisión de port: registrar y no escribir)
  int err11_gravity_physmoving0 = 0;  // sitio de error 11: GravityForces con
                                      //   PhysMoving = 0 (30-FISICA.md §8;
                                      //   decisión: registrar y no cobrar)
  int err9_mutation_insert = 0;  // sitio de error 9: el bucle de inserción de
                                 //   Amplification/Translocation escribe más
                                 //   allá del array cuando MakeSpace falló
                                 //   (NeoMutations.bas:286-288,362-364, "still
                                 //   bugy"; On Error GoTo getout). Decisión:
                                 //   registrar y saltar a getout como el
                                 //   original (resto de la pasada perdido).
  int err9_load_organism = 0;    // sitio de error 9: LoadOrganism con
                                 //   cnum > 51 desbordaría clist(50)
                                 //   (HDRoutines.bas:296-346; el On Error
                                 //   deshacía el bot a medias). Decisión:
                                 //   registrar, deshacer el último bot y
                                 //   devolver -1, como el handler original.
  int err9_simplematch = 0;      // sitio de error 9: simplematch relee r1/r2
                                 //   fuera de rango cuando el reposicionamiento
                                 //   loopold+laststartmatch rebasa el array
                                 //   (Robots.bas:492-500 con listas clampadas).
                                 //   Decisión: registrar y cortar el matching.
};

struct Sim {
  SimOptsT opts;
  VmContext vm;  // stacks globales + Costs + VmDiag
  SimDiag diag;
  RndSource* rndy = nullptr;
  Gasdev gasdev;  // caché Static de Gauss (Common.bas:82-100, R-02/R-03)
  const SysvarTable* sysvars = &DefaultSysvarTable();

  // Globales de mutación de Globals.bas (defaults de constants.yaml
  // §globales; los Boolean de Global.gset — sunbelt/epireset — nacen False).
  bool reprofix = false;
  bool epireset = false;
  vb_single epiresetemp = 1.3f;
  vb_integer epiresetOP = 17;
  bool sunbelt = false;
  bool Delta2 = false;
  vb_integer DeltaPM = 3000;
  vb_single DeltaMainExp = 1, DeltaMainLn = 0;
  vb_single DeltaDevExp = 7, DeltaDevLn = 1;
  unsigned char DeltaWTC = 15;
  unsigned char DeltaMainChance = 100, DeltaDevChance = 30;
  bool NormMut = false;
  vb_integer valNormMut = 1071, valMaxNormMut = 1071;
  unsigned char x_restartmode = 0;
  bool y_normsize = false;
  vb_integer curr_dna_size = 0;

  // rob(): el índice 0 existe y no se puebla (10-CICLO.md §8). Arranca con
  // UBound=500 y crece de a 100 (posto, Robots.bas:2925-2948).
  std::vector<Bot> rob = std::vector<Bot>(501);
  int MaxRobs = 0;
  vb_long MaxAbsNum = 0;

  // Colas de reproducción y muerte (Robots.bas:367-370).
  std::vector<int> rep = std::vector<int>(ROBARRAYMAX + 1, 0);
  std::vector<int> kil = std::vector<int>(ROBARRAYMAX + 1, 0);
  int rp = 1, kl = 1;

  // Contadores (Robots.bas:372-379, Vegs.bas).
  int TotalRobots = 0, TotalRobotsDisplayed = 0;
  int totvegs = 0, totvegsDisplayed = 0;
  int totnvegs = 0, totnvegsDisplayed = 0;
  int totcorpse = 0, totwalls = 0;
  vb_long TotalEnergy = 0;
  std::array<vb_long, 101> TotalSimEnergy{};  // Vegs.bas:11
  int CurrentEnergyCycle = 0;
  vb_long TotalSimEnergyDisplayed = 0;  // Vegs.bas:13 (paso 5 del tick)

  // E4 (Master.bas:3-5) — estado de los costes dinámicos (pasos 6-7 del
  // tick). Globales de módulo en el original: arrancan en cero con el
  // proceso, SaveSimulation no los persiste y LoadSimulation no los resetea
  // (HDRoutines.bas solo guarda SimOpts.oldCostX, :776/:1443). Decisión de
  // port (70-CASOS-DORADOS.md §11): viven en Sim; una carga en el port
  // arranca con este estado limpio.
  vb_integer DynamicCountdown = 0;
  bool CostsWereZeroed = false;
  std::array<vb_integer, 11> PopulationLast10Cycles{};  // (10): 0 sin uso
  double LightAval = 0;  // Vegs.bas:15 (Double; lo calcula feedvegs)
  vb_long AllChlr = 0;

  // Vegs.bas:9 — acumulador de la repoblación. Al iniciar una sim arranca
  // en -RepopCooldown (main.frm:1507): la primera tanda tarda el doble
  // (B-37). El default 0 es el estado VB6 recién cargado; el arranque de
  // sim lo fija el harness/StartNewSimCounters.
  vb_long cooldown = 0;

  // Vegs.bas:17-20 — sol variable (SunOnRnd). SunChange codifica posición
  // (0/1/2) + rango*10 (0/10) en un byte.
  double SunPosition = 0, SunRange = 0;
  unsigned char SunChange = 0;

  // Globales evo/torneo/gráficas que el FORMATO de sim persiste
  // (HDRoutines.bas:794-841; Master.bas:9-21, Globals.bas:96-156). Sus
  // mecánicas son capa ⚙ (50-MUNDO.md §5): en el core solo viajan por el
  // archivo. hidepred siempre-False anula los filtros del torneo.
  struct EvoGlobals {
    double energydif = 0, energydifX = 0, energydifXP = 0;
    vb_long ModeChangeCycles = 0;
    vb_integer hidePredOffset = 0;
    bool hidepred = false;
    double energydif2 = 0, energydifX2 = 0, energydifXP2 = 0;
    bool stagnent = false;
    std::string strGraphQuery1, strGraphQuery2, strGraphQuery3;
    std::string strSimStart;
    std::array<vb_long, 19> graphfilecounter{};   // NUMGRAPHS = 18, 1-based
    std::array<bool, 19> graphvisible{};
    std::array<vb_long, 19> graphleft{};
    std::array<vb_long, 19> graphtop{};
    std::array<bool, 19> graphsave{};
  } evo;

  // Globals.bas:94 — StartChlr: cloroplastos iniciales de los vegetales
  // repoblados. Sin Global.gset el original arranca en 0 (default de
  // Integer); el default de la UI de gset es 16000 (constants.yaml §ui,
  // [SIN VERIFICAR] el .gset distribuido). Aquí 0 = fiel al sin-archivo.
  vb_integer StartChlr = 0;
  vb_long TotalChlr = 0;
  bool StartAnotherRound = false;

  // Tipo calificado: el miembro sombrea al struct (gcc >= 15 lo rechaza
  // sin calificar, -Wchanges-meaning). El nombre viene del original
  // (Dim Specie() As Specie) y se conserva.
  std::vector<db::Specie> Specie;

  // Shots (Shots.bas:39-44). Índice 0 sin uso, como el original.
  std::vector<Shot> Shots = std::vector<Shot>(301);
  vb_long shotpointer = 1;
  vb_long maxshotarray = 300;
  vb_long numshots = 0;
  vb_long ShotsThisCycle = 0;
  // main.frm:1291 — prefiltro por caja del swept-sphere; se calcula en
  // InitBuckets (mismo camino de arranque que en main.frm).
  vb_single MaxBotShotSeperation = 0;

  // Obstacles.bas — índice 0 sin uso, como los demás arrays.
  std::vector<Obstacle> Obstacles = std::vector<Obstacle>(1);
  int numObstacles = 0;
  // Obstacles.bas:42-43 — índices del compactador (0 = sin compactador).
  int leftCompactor = 0, rightCompactor = 0;

  // Teleport.bas:53-58 — Teleporters(10), índice 0 sin uso.
  std::array<Teleporter, MAXTELEPORTERS + 1> Teleporters{};
  int numTeleporters = 0;

  // Quads.bas — la rejilla de buckets (fila mayor: índice x + y*NumXBuckets).
  std::vector<BucketType> Buckets;
  int NumXBuckets = 0, NumYBuckets = 0;

  // Physics.bas:21 — global de mareas; 1 sin Tides (capa ⚙).
  vb_single BouyancyScaling = 1.0f;

  Sim() { vm.xDivisor = 1.0f; vm.yDivisor = 1.0f; }

  vb_single rnd() { return (*rndy)(); }
};

// ---- utilidades compartidas del ciclo ----

// Gauss sobre el gasdev global del motor (los operadores de mutación y las
// derivas Delta2 consumen por aquí; la caché Static vive en sim.gasdev).
inline vb_single SimGauss(Sim& sim, vb_single stddev, vb_single mean = 0.0f) {
  return Gauss(sim.gasdev, *sim.rndy, stddev, mean);
}

// Robots.bas:883-886 — clamp a ±32000 y CInt bancario.
inline vb_integer iceil(vb_single x) {
  if (std::fabs(x) > 32000.0f)
    x = static_cast<vb_single>(vb_sgn(x)) * 32000.0f;
  return vb_cint(static_cast<double>(x));
}

// Robots.bas:716-740 — FindRadius.
inline vb_single FindRadius(Sim& sim, int n, vb_single mult = 1.0f) {
  vb_single bodypoints, chlr;
  if (mult == -1.0f) {
    bodypoints = 32000.0f;
    chlr = 0.0f;
  } else {
    bodypoints = sim.rob[n].body * mult;
    chlr = sim.rob[n].chloroplasts * mult;
  }
  if (bodypoints < 1.0f) bodypoints = 1.0f;
  if (sim.opts.FixedBotRadii) return static_cast<vb_single>(half);
  vb_single r = static_cast<vb_single>(
      std::pow(std::log(static_cast<double>(bodypoints)) *
                   static_cast<double>(bodypoints) * CubicTwipPerBody * 3.0 *
                   0.25 / static_cast<double>(PI),
               1.0 / 3.0));
  r = r + (415.0f - r) * chlr / 32000.0f;
  if (r < 1.0f) r = 1.0f;
  return r;
}

// Robots.bas:744-771 — absx/absy (nótese la Y invertida en absy).
inline vb_single absx(vb_single aim, vb_single up, vb_single dn, vb_single sx,
                      vb_single dx) {
  vb_single upTotal = up - dn, sxTotal = sx - dx;
  if (upTotal > 32000.0f) upTotal = 32000.0f;
  if (upTotal < -32000.0f) upTotal = -32000.0f;
  if (sxTotal > 32000.0f) sxTotal = 32000.0f;
  if (sxTotal < -32000.0f) sxTotal = -32000.0f;
  return static_cast<vb_single>(std::cos(static_cast<double>(aim))) * upTotal +
         static_cast<vb_single>(std::sin(static_cast<double>(aim))) * sxTotal;
}
inline vb_single absy(vb_single aim, vb_single up, vb_single dn, vb_single sx,
                      vb_single dx) {
  vb_single upTotal = up - dn, sxTotal = sx - dx;
  if (upTotal > 32000.0f) upTotal = 32000.0f;
  if (upTotal < -32000.0f) upTotal = -32000.0f;
  if (sxTotal > 32000.0f) sxTotal = 32000.0f;
  if (sxTotal < -32000.0f) sxTotal = -32000.0f;
  return -static_cast<vb_single>(std::sin(static_cast<double>(aim))) * upTotal +
         static_cast<vb_single>(std::cos(static_cast<double>(aim))) * sxTotal;
}

// HDRoutines.bas:1587-1599 — GiveAbsNum (Q14: no se publica en memoria).
// La guardia AbsNum = 0 es del original (:1595): un bot cargado de archivo
// conserva su AbsNum (FM-05; AbsNum importados sin deduplicar, B8-6).
inline void GiveAbsNum(Sim& sim, int n) {
  if (sim.rob[n].AbsNum == 0) {
    sim.MaxAbsNum += 1;
    sim.rob[n].AbsNum = sim.MaxAbsNum;
  }
}

// Robots.bas:2908-2967 — posto: primer slot libre desde 1; crece de a 100.
inline int posto(Sim& sim) {
  int t = 1;
  bool foundone = false;
  while (!foundone && t <= sim.MaxRobs) {
    if (!sim.rob[t].exist)
      foundone = true;
    else
      t += 1;
  }
  if (t > sim.MaxRobs) sim.MaxRobs = t;
  vb_long newsize = static_cast<vb_long>(sim.rob.size()) - 1;
  if (sim.MaxRobs > newsize) {
    newsize += 100;
    sim.rob.resize(newsize + 1);
  }
  sim.rob[t] = Bot{};  // rob(posto) = blank
  GiveAbsNum(sim, t);
  return t;
}

// SpeciesFromBot (Senses.bas:155-165) sobre el registro mínimo.
inline std::size_t SpeciesFromBot(Sim& sim, int n) {
  std::size_t i = 0;
  while (i < sim.Specie.size() && sim.Specie[i].Name != sim.rob[n].FName) ++i;
  return i;
}

inline void AddSpecie(Sim& sim, int n) {
  Specie sp;
  sp.Name = sim.rob[n].FName;
  sp.population = 1;
  sp.Native = false;
  sim.Specie.push_back(sp);
}

// NeoMutations.bas:108-116 — NewSubSpecies: contador por especie con wrap
// manual +32000 -> -32000. Especie no registrada: el original indexaria
// Specie(SpeciesNum) (el ultimo slot); aqui 0 con el mismo patron defensivo
// de WriteSenses.
inline vb_integer NewSubSpecies(Sim& sim, int n) {
  const std::size_t i = SpeciesFromBot(sim, n);
  if (i >= sim.Specie.size()) return 0;
  vb_long c = static_cast<vb_long>(sim.Specie[i].SubSpeciesCounter) + 1;
  if (c > 32000) c = -32000;
  sim.Specie[i].SubSpeciesCounter = static_cast<vb_integer>(c);
  return sim.Specie[i].SubSpeciesCounter;
}

// Str() de VB6: espacio inicial para no negativos (duplicado local de
// formats_detail::vb_str para no invertir el orden de includes).
inline std::string StrVB(vb_long v) {
  return (v < 0) ? std::to_string(v) : " " + std::to_string(v);
}

// NeoMutations.bas:21-27 — logmutation: prepende con vbCrLf. El guard de
// longitud divide por TotalRobotsDisplayed: con 0, el original lanzaba
// error 11; aqui la division flotante da inf y el reset simplemente no
// ocurre (decision de port, sitio inalcanzable con TotRunCycle > 0 normal).
inline void logmutation(Sim& sim, int n, const std::string& strmut) {
  if (sim.opts.TotRunCycle == 0) return;
  Bot& b = sim.rob[n];
  const double cap = 100000000.0 / static_cast<double>(sim.TotalRobotsDisplayed);
  if (static_cast<double>(b.LastMutDetail.size()) > cap) b.LastMutDetail.clear();
  b.LastMutDetail = strmut + "\r\n" + b.LastMutDetail;
}

}  // namespace db
