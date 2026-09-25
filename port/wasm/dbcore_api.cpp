// M10 — API WASM del core hacia la capa de presentacion web (PROGRESO.md
// "Siguiente" M10, sobre la semilla de M9). Contrato de fidelidad intacto:
// esta capa solo llama a funciones del core y copia bytes/floats hacia el
// host; no recalcula fisica ni consume RNG por su cuenta (las unicas
// extracciones de RNG que origina — posicion de fundadores, posicion de
// teleporters nuevos, Randomize, y desde E3 las posiciones/aperturas de
// formas y mazes — son las mismas que hacia la UI de VB6 en loadrobs /
// NewTeleporter / startloaded / Obstacles.bas, transcritas y citadas).
//
// Decisiones de capa host (fuera del contrato de fidelidad, M10 punto 3):
//  - Teleporters: el original movia archivos .dbo por disco entre sims
//    (50-MUNDO.md); aqui el core opera sobre sim.Teleporters[i].outbox/inbox
//    en memoria y el host mueve los registros con db_sim_tp_outbox_take /
//    db_sim_tp_inbox_push. Un "archivo" = un registro SaveOrganism (.dbo).
//  - SimGUID: el original lo regeneraba con `CLng(Rnd)` en el preludio de
//    StartSimul; aqui queda en 0 salvo con SunOnRnd, donde db_sim_start
//    replica el preludio entero (RV-32). Ningun sistema del core lo lee.
//  - Colores con Rnd crudo (Q01): los colores de especies los decide la
//    pagina (paleta propia); el core recibe el Long BGR ya decidido, igual
//    que NewObstacle. El unico color heredado del original es el vbWhite de
//    NewTeleporter (transcrito).
//  - El sidecar .mrate no se exporta: es un archivo de conveniencia de la UI
//    original para tasas de mutacion; la pagina no lo necesita (las tasas
//    viajan dentro del formato de sim).
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <cctype>
#include <array>
#include <cmath>
#include <algorithm>
#include <functional>
#include <memory>
#include <new>
#include <string>
#include <unordered_map>
#include <vector>

#include "dbcore/buckets.hpp"
#include "dbcore/database.hpp"
#include "dbcore/formats.hpp"
#include "dbcore/master.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define DB_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define DB_EXPORT
#endif

namespace {

// El puñado sim + RNG real de VB6: Sim no posee su RndSource (los tests
// inyectan secuencias), asi que el handle agrupa ambos y cablea los punteros
// igual que el harness de tests (sim.rndy y sim.vm.rndy al mismo LCG).
struct SimHandle {
  db::VbRng rng;
  db::Sim sim;
  // E6 — resultado de la ultima corrida de CalcStats/FeedGraph: los nombres
  // de serie (nomi) sobreviven a la llamada para que JS los lea uno a uno.
  std::vector<std::string> graphNames;
  db::SnapshotResult lastSnapshot;  // db_sim_snapshot_run

  // E6.5 — estado de la vista enriquecida (solo host: nunca se escribe en
  // la sim). Una foto por slot del tick anterior para sacar por diferencia
  // lo que cada bot hizo; ver db_sim_vis_observe.
  struct Vis {
    bool primed = false;
    std::vector<db::vb_long> abs;          // AbsNum por slot (0 = vacío)
    std::vector<std::uint32_t> actions;    // bits acumulados desde el volcado
    std::vector<float> shotType;           // último shottype disparado
    std::vector<std::uint8_t> born;        // nacido desde el último volcado
    std::vector<float> shell, slime, venom, poison, body, nrg, aim;
    std::vector<float> px, py, pr, pcol;   // última posición/radio/color
    std::vector<db::vb_long> kills;
    std::vector<int> tieMask, fert;
    std::vector<std::uint8_t> shotExist;   // por slot de shot
    std::vector<int> shotAge, shotParent;
    std::vector<float> births;             // 6 floats por evento
    std::vector<float> deaths;             // 6 floats por evento
    std::vector<std::string> species;      // índice → FName
    std::unordered_map<std::string, int> speciesIdx;
    int speciesVersion = 0;
    std::vector<float> gdist;              // lente de distancia, por slot
    std::vector<db::vb_long> gdistAbs;     // AbsNum al que vale gdist
    int gdistRef = 0;                      // slot de referencia
    db::vb_long gdistRefAbs = 0;
    int gdistCursor = 1;
  } vis;

  // E8 — campos de render del Type robot que el core no modela (ver la
  // seccion E8 al final). Un slot cuyo AbsNum cambio es un bot nuevo: su
  // registro nacio de `rob(posto) = blank` (Robots.bas:2962-2963), asi que
  // vale 0.
  struct E8 {
    std::vector<db::vb_long> monAbs;                  // monitor_r/g/b
    std::vector<std::array<db::vb_integer, 3>> mon;
    std::vector<db::vb_long> skinAbs;                 // oaim / OSkin
    std::vector<db::vb_single> oaim;
    std::vector<std::array<db::vb_integer, 8>> oskin;
  } e8;

  SimHandle() { wire(); }
  void wire() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
  }
};

db::Sim& S(void* h) { return static_cast<SimHandle*>(h)->sim; }
SimHandle& H(void* h) { return *static_cast<SimHandle*>(h); }

// main.frm:1432-1435 — xDivisor/yDivisor: 1 salvo campo > 32000.
void RecomputeDivisors(db::Sim& sim) {
  sim.opts.xDivisor = 1;
  sim.opts.yDivisor = 1;
  if (sim.opts.FieldWidth > 32000.0f)
    sim.opts.xDivisor = sim.opts.FieldWidth / 32000.0f;
  if (sim.opts.FieldHeight > 32000.0f)
    sim.opts.yDivisor = sim.opts.FieldHeight / 32000.0f;
  sim.vm.xDivisor = sim.opts.xDivisor;
  sim.vm.yDivisor = sim.opts.yDivisor;
}

// Copia un bloque a memoria malloc'd para entregarlo a JS (libera db_free).
unsigned char* CopyOut(const unsigned char* src, std::size_t n, int* out_len) {
  unsigned char* p = static_cast<unsigned char*>(std::malloc(n ? n : 1));
  if (!p) {
    if (out_len) *out_len = 0;
    return nullptr;
  }
  std::memcpy(p, src, n);
  if (out_len) *out_len = static_cast<int>(n);
  return p;
}

// RV-39: globales del proceso original que ni LoadSimulation ni startloaded
// tocan (HDRoutines.bas:1073-1540, main.frm:1374-1515), así que sobreviven a
// la carga: los del gset (LoadGlobalSettings, HDRoutines.bas:852-1069:
// StartChlr, Disqualify, x_restartmode, intFindBestV2, hidePredCycl, LFOR y
// los de mutación), los de módulo de F1Mode.bas:18-32, los flags de guardado
// y el apodo IM (Sim::fmt), el Player Bot de MDIForm1 y el
// DeadRobots.snp de disco. Los Static internos (Gauss, calculateZB,
// totnrgnvegs, stopflag) siguen la decisión de la Sim limpia.
void CarryProcessGlobals(db::Sim& d, const db::Sim& o) {
  d.StartChlr = o.StartChlr;
  d.reprofix = o.reprofix;
  d.epireset = o.epireset;
  d.epiresetemp = o.epiresetemp;
  d.epiresetOP = o.epiresetOP;
  d.sunbelt = o.sunbelt;
  d.fmt = o.fmt;
  d.Delta2 = o.Delta2;
  d.DeltaPM = o.DeltaPM;
  d.DeltaMainExp = o.DeltaMainExp;
  d.DeltaMainLn = o.DeltaMainLn;
  d.DeltaDevExp = o.DeltaDevExp;
  d.DeltaDevLn = o.DeltaDevLn;
  d.DeltaWTC = o.DeltaWTC;
  d.DeltaMainChance = o.DeltaMainChance;
  d.DeltaDevChance = o.DeltaDevChance;
  d.NormMut = o.NormMut;
  d.valNormMut = o.valNormMut;
  d.valMaxNormMut = o.valMaxNormMut;
  d.x_restartmode = o.x_restartmode;
  d.y_normsize = o.y_normsize;
  d.curr_dna_size = o.curr_dna_size;
  d.hidePredCycl = o.hidePredCycl;
  d.LFOR = o.LFOR;
  d.intFindBestV2 = o.intFindBestV2;
  d.Disqualify = o.Disqualify;
  d.f1 = o.f1;
  d.pb = o.pb;
  d.deadSnp = o.deadSnp;
}

}  // namespace

extern "C" {

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

// Crea una sim con las opciones por defecto y el LCG en seed0 (&H50000).
DB_EXPORT void* db_sim_create() { return new (std::nothrow) SimHandle(); }

DB_EXPORT void db_sim_destroy(void* h) { delete static_cast<SimHandle*>(h); }

// Randomize n de VB6 (solo reemplaza los bytes medios del estado, Q02/R-01).
DB_EXPORT void db_sim_randomize(void* h, double n) { H(h).rng.randomize(n); }

// Estado de 24 bits del LCG (solo lectura; los smokes cuentan extracciones).
DB_EXPORT int db_sim_rng_state(void* h) {
  return static_cast<int>(H(h).rng.state());
}

// Arranque de una sim NUEVA: StartNew_Click + StartSimul (OptionsForm.frm,
// main.frm:1182-1368), los pasos que preparan el mundo alrededor del core.
// La ronda nueva usa el mismo arranque y despues db_sim_round_carry.
//  - UserSeedNumber es Long: el form lo asigna con CLng bancario
//    (OptionsForm.frm:4115-4116), y StartSimul hace SIEMPRE `Rnd -1 :
//    Randomize UserSeedNumber / 100` (main.frm:1197-1198), tambien con 0
//    (RV-34). Decision de host: el port modela chseedstartnew = False (la
//    semilla es la del usuario, no Timer * 100, OptionsForm.frm:4720).
//  - TotRunCycle = -1 (OptionsForm.frm:4752): el primer tick es el ciclo 0
//    (RV-35).
//  - El sol (main.frm:1227-1234, RV-32). Con SunOnRnd el preludio se
//    replica entero (skin 3 Rnd descartados, sol 3, SimGUID 1) para que la
//    banda salga sorteada como en el original; sin SunOnRnd no hay RNG y
//    esos Rnd crudos siguen omitidos (B7-5/Q01).
//  - La deuda de la repoblacion y los contadores del primer ciclo NO son de
//    StartSimul sino de startloaded (main.frm:1507-1510): viven en
//    db_sim_load (RV-33). En una sim nueva valen lo del proceso (0 en frio).
DB_EXPORT void db_sim_start(void* h, double seed) {
  auto& Sh = H(h);
  db::Sim& sim = Sh.sim;
  const std::int64_t s = db::vb_round64(seed);
  sim.opts.UserSeedNumber = static_cast<db::vb_long>(
      s < INT32_MIN ? INT32_MIN : (s > INT32_MAX ? INT32_MAX : s));
  sim.opts.TotRunCycle = -1;
  Sh.rng.rnd_negative(-1.0f);
  Sh.rng.randomize(static_cast<double>(sim.opts.UserSeedNumber) / 100.0);
  if (sim.opts.SunOnRnd) {
    for (int i = 0; i < 3; ++i) Sh.rng();  // skin de la sim (main.frm:1211-1213)
    sim.SunRange = 0.5;
    // Int(Rnd * 3) + Int(Rnd * 2) * 10: Single, de izquierda a derecha.
    const db::vb_single a = std::floor(Sh.rng() * 3.0f);
    const db::vb_single b = std::floor(Sh.rng() * 2.0f);
    sim.SunChange = static_cast<unsigned char>(a + b * 10.0f);
    sim.SunPosition = static_cast<double>(Sh.rng());
    sim.opts.SimGUID = db::vb_clng(static_cast<double>(Sh.rng()));
  } else {
    sim.SunPosition = 0.5;
    sim.SunRange = 1;
  }
  RecomputeDivisors(sim);       // main.frm:1252-1256
  db::InitBuckets(sim);         // main.frm:1291 (fija MaxBotShotSeperation)
  sim.shotpointer = 1;          // main.frm:1305
}

// Ronda nueva (StartAnotherRound): el original vuelve a StartSimul en el
// mismo proceso, y StartSimul no toca el contador de ciclos ni la
// repoblacion. El port arma la ronda en un handle nuevo, asi que el host
// traspasa esto tras db_sim_start (RV-33, RV-35). La ronda de F1 ya dejo
// TotRunCycle = 0 en la sim vieja (F1Mode.bas:435).
DB_EXPORT void db_sim_round_carry(void* dst, void* src) {
  db::Sim& d = S(dst);
  const db::Sim& o = S(src);
  d.opts.TotRunCycle = o.opts.TotRunCycle;
  d.cooldown = o.cooldown;
  d.totvegs = o.totvegs;
  d.totvegsDisplayed = o.totvegsDisplayed;
  d.totnvegs = o.totnvegs;
  d.totnvegsDisplayed = o.totnvegsDisplayed;
  // RV-39: los globales de proceso tampoco los toca StartSimul
  // (main.frm:1182-1368).
  CarryProcessGlobals(d, o);
}

// Opciones base que el host fija fuera de la tabla de ids. La ronda las lee
// de la sim que termina: StartSimul arranca con los SimOpts en vivo, que tras
// una carga son los del archivo (RV-38).
//   0 MinVegs · 1 RepopAmount · 2 RepopCooldown · 3 MaxEnergy
//   4 StartChlr (global del gset, RV-39) · 5 mutaciones (Not DisableMutations)
DB_EXPORT double db_sim_get_base(void* h, int k) {
  const db::Sim& sim = S(h);
  switch (k) {
    case 0: return static_cast<double>(sim.opts.MinVegs);
    case 1: return sim.opts.RepopAmount;
    case 2: return sim.opts.RepopCooldown;
    case 3: return static_cast<double>(sim.opts.MaxEnergy);
    case 4: return sim.StartChlr;
    case 5: return sim.opts.DisableMutations ? 0 : 1;
    default: return 0;
  }
}

// Ronda nueva: loadrobs siembra SimOpts.Specie tal como quedo en la sim que
// termina (main.frm:1523-1573; RemoveExtinctSpecies ya borro las no nativas
// sin poblacion, Robots.bas:1461-1473), con su skin, sus tasas y su marca de
// archivo. El host siembra despues cada indice con db_sim_seed_species
// (RV-38).
DB_EXPORT void db_sim_round_species(void* dst, void* src) {
  S(dst).Specie = S(src).Specie;
  S(dst).SpecieSpare = S(src).SpecieSpare;
}

// Semilla de la ronda siguiente: `SimOpts.UserSeedNumber = Rnd *
// 2147483647` con el LCG de la sim que termina (OptionsForm.frm:4809,
// MDIForm1.frm:2168; Single * Long = Double, CLng bancario). RV-34.
DB_EXPORT double db_sim_round_seed(void* h) {
  const double r = static_cast<double>(H(h).rng());
  return static_cast<double>(db::vb_clng(r * 2147483647.0));
}

// OptionsForm.frm:4620-4624 — al aplicar el dialogo de opciones con
// SunOnRnd apagado, el sol vuelve al campo entero (RV-32). El host lo llama
// despues de cada cambio que pasa por OptionsForm.
DB_EXPORT void db_sim_options_ok(void* h) {
  db::Sim& sim = S(h);
  if (!sim.opts.SunOnRnd) {
    sim.SunPosition = 0.5;
    sim.SunRange = 1;
  }
}

// Un ciclo completo de UpdateSim (los 19 pasos del tick, 10-CICLO.md §2).
DB_EXPORT void db_sim_tick(void* h) { db::UpdateSim(S(h)); }

// ---------------------------------------------------------------------------
// Opciones de sim (SimOpts esenciales, M10 punto 1)
// ---------------------------------------------------------------------------

DB_EXPORT void db_sim_set_field(void* h, double w, double hgt) {
  db::Sim& sim = S(h);
  sim.opts.FieldWidth = static_cast<db::vb_single>(w);
  sim.opts.FieldHeight = static_cast<db::vb_single>(hgt);
  RecomputeDivisors(sim);
  // La rejilla se redimensiona sola en el proximo tick (EnsureBuckets).
}

DB_EXPORT int db_sim_field_width(void* h) {
  return static_cast<int>(S(h).opts.FieldWidth);
}
DB_EXPORT int db_sim_field_height(void* h) {
  return static_cast<int>(S(h).opts.FieldHeight);
}

// Costs(0..70) de SimOptions.bas (indices en vm.hpp/sim.hpp; 54 es el
// multiplicador global COSTMULTIPLIER).
DB_EXPORT void db_sim_set_cost(void* h, int i, float v) {
  if (i >= 0 && i <= 70) S(h).vm.costs.v[i] = v;
}
DB_EXPORT float db_sim_get_cost(void* h, int i) {
  return (i >= 0 && i <= 70) ? S(h).vm.costs.v[i] : 0.0f;
}

DB_EXPORT void db_sim_set_minvegs(void* h, int v) { S(h).opts.MinVegs = v; }
DB_EXPORT void db_sim_set_repop(void* h, int amount, int cooldown) {
  S(h).opts.RepopAmount = static_cast<db::vb_integer>(amount);
  S(h).opts.RepopCooldown = static_cast<db::vb_integer>(cooldown);
}
DB_EXPORT void db_sim_set_maxpop(void* h, float v) {
  S(h).opts.MaxPopulation = v;
}
// MaxEnergy: reparto de nrg por ciclo de la economia vegetal (feedvegs).
DB_EXPORT void db_sim_set_max_energy(void* h, int v) {
  S(h).opts.MaxEnergy = v;
}
DB_EXPORT void db_sim_set_mutations(void* h, int enabled) {
  S(h).opts.DisableMutations = (enabled == 0);
}
// StartChlr: cloroplastos iniciales de vegetales sembrados/repoblados
// (Globals.bas:94; el default de la UI del original era 16000 via .gset).
DB_EXPORT void db_sim_set_start_chlr(void* h, int v) {
  S(h).StartChlr = static_cast<db::vb_integer>(v);
}

// ---------------------------------------------------------------------------
// Opciones E1 por id estable (spec/PLAN-EXTENSIONES.md, etapa E1)
// ---------------------------------------------------------------------------
// Un solo par set/get genérico: double transporta todos los tipos VB6 en
// juego y los bool viajan como 0/1. La tabla de ids es contrato con la
// página (web/index.html la replica); ids nuevos se añaden al final de su
// bloque, nunca se renumeran. Solo se exponen opciones CON consumidor real
// en el core (verificado 2026-08-26; TidesOf/KillDistVegs/BlockedVegs/
// Diffuse/makeAllShapes* quedan fuera por no tener consumidor).
//
//   Forma del campo   1 Toroidal (escribe también los dos ejes)
//                     2 Updnconnected · 3 Dxsxconnected
//   Física           10 ZeroMomentum · 11 MaxVelocity · 12 PhysMoving
//                    13 PhysBrown · 14 Density · 15 Viscosity
//                    16 CoefficientStatic · 17 CoefficientKinetic
//                    18 CoefficientElasticity · 19 Zgravity · 20 Ygravity
//                    21 FixedBotRadii
//   Luz y ciclo      30 Pondmode · 31 LightIntensity · 32 Gradient
//                    33 DayNight · 34 CycleLength · 35 SunUp
//                    36 SunUpThreshold · 37 SunDown · 38 SunDownThreshold
//                    39 SunThresholdMode · 40 SunOnRnd · 41 Daytime
//   Muerte y decay   50 CorpseEnabled · 51 Decay · 52 Decaydelay
//                    53 DecayType (0/1 sin shot, 2 waste, 3 nrg)
//                    54 NoShotDecay · 55 NoWShotDecay · 56 BadWastelevel
//   Energía          60 EnergyExType · 61 EnergyFix · 62 EnergyProp
//                    63 VegFeedingToBody · 64 Tides (feedvegs; ciclos)
//   Restricciones    70 DisableTies · 71 DisableTypArepro · 72 DisableFixing
//   Formas           80 shapesAreVisable · 81 shapesAreSeeThrough
//                    82 shapesAbsorbShots · 83 allowVerticalShapeDrift
//                    84 allowHorizontalShapeDrift · 85 shapeDriftRate

DB_EXPORT void db_sim_set_opt(void* h, int id, double v) {
  db::Sim& s = S(h);
  auto& o = s.opts;
  const bool b = (v != 0.0);
  const auto f = static_cast<db::vb_single>(v);
  const auto i16 = static_cast<db::vb_integer>(v);
  const auto i32 = static_cast<db::vb_long>(v);
  switch (id) {
    case 1: o.Toroidal = b; o.Updnconnected = b; o.Dxsxconnected = b; break;
    case 2: o.Updnconnected = b; break;
    case 3: o.Dxsxconnected = b; break;
    case 10: o.ZeroMomentum = b; break;
    case 11: o.MaxVelocity = f; break;
    case 12: o.PhysMoving = f; break;
    case 13: o.PhysBrown = f; break;
    case 14: o.Density = v; break;    // Double en el original (RV-06)
    case 15: o.Viscosity = v; break;
    case 16: o.CoefficientStatic = f; break;
    case 17: o.CoefficientKinetic = f; break;
    case 18: o.CoefficientElasticity = f; break;
    case 19: o.Zgravity = f; break;
    case 20: o.Ygravity = f; break;
    case 21: o.FixedBotRadii = b; break;
    case 30: o.Pondmode = b; break;
    case 31: o.LightIntensity = i16; break;
    case 32: o.Gradient = f; break;
    case 33: o.DayNight = b; break;
    case 34: o.CycleLength = i16; break;
    case 35: o.SunUp = b; break;
    case 36: o.SunUpThreshold = i32; break;
    case 37: o.SunDown = b; break;
    case 38: o.SunDownThreshold = i32; break;
    case 39: o.SunThresholdMode = i16; break;
    case 40: o.SunOnRnd = b; break;
    case 41: o.Daytime = b; break;
    case 50: o.CorpseEnabled = b; break;
    case 51: o.Decay = f; break;
    case 52: o.Decaydelay = i32; break;
    case 53: o.DecayType = static_cast<int>(v); break;
    case 54: o.NoShotDecay = b; break;
    case 55: o.NoWShotDecay = b; break;
    case 56: o.BadWastelevel = i32; break;
    case 60: o.EnergyExType = b; break;
    case 61: o.EnergyFix = i16; break;
    case 62: o.EnergyProp = f; break;
    case 63: o.VegFeedingToBody = f; break;
    case 64: o.Tides = i16; break;
    case 70: o.DisableTies = b; break;
    case 71: o.DisableTypArepro = b; break;
    case 72: o.DisableFixing = b; break;
    case 80: o.shapesAreVisable = b; break;
    case 81: o.shapesAreSeeThrough = b; break;
    case 82: o.shapesAbsorbShots = b; break;
    case 83: o.allowVerticalShapeDrift = b; break;
    case 84: o.allowHorizontalShapeDrift = b; break;
    case 85: o.shapeDriftRate = i16; break;
    // E5 - modos de juego (F1Mode.bas / gset / evo). El id 97 replica a
    // OptionsForm.frm:2770 (optMinRounds = MinRounds al aplicar).
    case 90: o.Restart = b; break;
    case 91: o.F1 = b; break;
    case 92: s.x_restartmode = static_cast<unsigned char>(v); break;
    case 93: s.Disqualify = static_cast<unsigned char>(v); break;
    case 94: s.hidePredCycl = i16; break;
    case 95: s.LFOR = f; break;
    case 96: s.intFindBestV2 = i16; break;
    case 97: s.f1.MinRounds = i16; s.f1.optMinRounds = i16; break;
    case 98: s.f1.Maxrounds = i16; break;
    case 99: s.f1.MaxCycles = i32; break;
    case 100: s.f1.MaxPop = i16; break;
    case 101: s.f1.optMinRounds = i16; break;
    // E6 - registro y analisis (OptionsForm "Recording"/ChartInterval y el
    // menu Recording de MDIForm1.frm:1650-1662).
    case 110: o.chartingInterval = i16; break;
    case 111: o.DeadRobotSnp = b; break;
    case 112: o.SnpExcludeVegs = b; break;
    default: break;  // id desconocido: no-op (contrato tolerante)
  }
}

DB_EXPORT double db_sim_get_opt(void* h, int id) {
  const db::Sim& s = S(h);
  const auto& o = s.opts;
  switch (id) {
    case 1: return (o.Updnconnected && o.Dxsxconnected) ? 1 : 0;
    case 2: return o.Updnconnected ? 1 : 0;
    case 3: return o.Dxsxconnected ? 1 : 0;
    case 10: return o.ZeroMomentum ? 1 : 0;
    case 11: return o.MaxVelocity;
    case 12: return o.PhysMoving;
    case 13: return o.PhysBrown;
    case 14: return o.Density;
    case 15: return o.Viscosity;
    case 16: return o.CoefficientStatic;
    case 17: return o.CoefficientKinetic;
    case 18: return o.CoefficientElasticity;
    case 19: return o.Zgravity;
    case 20: return o.Ygravity;
    case 21: return o.FixedBotRadii ? 1 : 0;
    case 30: return o.Pondmode ? 1 : 0;
    case 31: return o.LightIntensity;
    case 32: return o.Gradient;
    case 33: return o.DayNight ? 1 : 0;
    case 34: return o.CycleLength;
    case 35: return o.SunUp ? 1 : 0;
    case 36: return static_cast<double>(o.SunUpThreshold);
    case 37: return o.SunDown ? 1 : 0;
    case 38: return static_cast<double>(o.SunDownThreshold);
    case 39: return o.SunThresholdMode;
    case 40: return o.SunOnRnd ? 1 : 0;
    case 41: return o.Daytime ? 1 : 0;
    case 50: return o.CorpseEnabled ? 1 : 0;
    case 51: return o.Decay;
    case 52: return static_cast<double>(o.Decaydelay);
    case 53: return o.DecayType;
    case 54: return o.NoShotDecay ? 1 : 0;
    case 55: return o.NoWShotDecay ? 1 : 0;
    case 56: return static_cast<double>(o.BadWastelevel);
    case 60: return o.EnergyExType ? 1 : 0;
    case 61: return o.EnergyFix;
    case 62: return o.EnergyProp;
    case 63: return o.VegFeedingToBody;
    case 64: return o.Tides;
    case 70: return o.DisableTies ? 1 : 0;
    case 71: return o.DisableTypArepro ? 1 : 0;
    case 72: return o.DisableFixing ? 1 : 0;
    case 80: return o.shapesAreVisable ? 1 : 0;
    case 81: return o.shapesAreSeeThrough ? 1 : 0;
    case 82: return o.shapesAbsorbShots ? 1 : 0;
    case 83: return o.allowVerticalShapeDrift ? 1 : 0;
    case 84: return o.allowHorizontalShapeDrift ? 1 : 0;
    case 85: return o.shapeDriftRate;
    case 90: return o.Restart ? 1 : 0;
    case 91: return o.F1 ? 1 : 0;
    case 92: return s.x_restartmode;
    case 93: return s.Disqualify;
    case 94: return s.hidePredCycl;
    case 95: return s.LFOR;
    case 96: return s.intFindBestV2;
    case 97: return s.f1.MinRounds;
    case 98: return s.f1.Maxrounds;
    case 99: return static_cast<double>(s.f1.MaxCycles);
    case 100: return s.f1.MaxPop;
    case 101: return s.f1.optMinRounds;
    case 110: return o.chartingInterval;
    case 111: return o.DeadRobotSnp ? 1 : 0;
    case 112: return o.SnpExcludeVegs ? 1 : 0;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Especies y siembra
// ---------------------------------------------------------------------------

// Alta de especie con su ADN en memoria. color es el Long BGR de VB6 ya
// decidido por el host (Q01: la paleta es de la pagina). Devuelve el indice.
DB_EXPORT int db_sim_add_species(void* h, const char* dnatext,
                                 const char* name, int veg, int fixed,
                                 float stnrg, int color, int qty) {
  db::Sim& sim = S(h);
  db::Specie sp;
  sp.Name = name ? name : "bot.txt";
  sp.dnatext = dnatext ? dnatext : "";
  sp.Veg = veg != 0;
  sp.Fixed = fixed != 0;
  // Stnrg = val(SpecNrg.text) Mod 32000 (OptionsForm.frm:3582): Mod redondea
  // el operando a Long (bancario) y conserva el signo del dividendo (RV-37).
  sp.Stnrg = static_cast<db::vb_integer>(
      db::vb_round64(static_cast<double>(stnrg)) % 32000);
  sp.color = color;
  sp.qty = static_cast<db::vb_integer>(qty > 0 ? qty : 1);
  sp.Native = true;
  sim.Specie.push_back(sp);
  return static_cast<int>(sim.Specie.size()) - 1;
}

DB_EXPORT int db_sim_num_species(void* h) {
  return static_cast<int>(S(h).Specie.size());
}

// Nombre de la especie `idx` (string malloc'd; db_free).
DB_EXPORT char* db_sim_species_name(void* h, int idx) {
  const db::Sim& sim = S(h);
  static const std::string empty;
  const std::string& v =
      (idx >= 0 && static_cast<std::size_t>(idx) < sim.Specie.size())
          ? sim.Specie[static_cast<std::size_t>(idx)].Name
          : empty;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(v.c_str()), v.size() + 1,
      nullptr));
}

// RV-40: 1 si la especie no tiene .txt que la respalde (sim cargada o
// AddSpecie). El host busca el ADN por nombre, como RobScriptLoad en la
// carpeta comun Robots (DNATokenizing.bas:180-186), y lo fija con
// db_sim_species_set_dna.
DB_EXPORT int db_sim_species_missing(void* h, int idx) {
  const db::Sim& sim = S(h);
  if (idx < 0 || static_cast<std::size_t>(idx) >= sim.Specie.size()) return 0;
  return sim.Specie[static_cast<std::size_t>(idx)].dnaMissing ? 1 : 0;
}
DB_EXPORT void db_sim_species_set_dna(void* h, int idx, const char* dnatext) {
  db::Sim& sim = S(h);
  if (idx < 0 || static_cast<std::size_t>(idx) >= sim.Specie.size()) return;
  db::Specie& sp = sim.Specie[static_cast<std::size_t>(idx)];
  sp.dnatext = dnatext ? dnatext : "";
  sp.dnaMissing = false;
}

// Siembra `count` fundadores de la especie `idx` (count <= 0 => sp.qty),
// como loadrobs (main.frm:1517-1573): InsertFounder + los campos que la
// especie aporta (color, NoChlr, StartChlr, Mutables, Skin, GenMut). Si el
// ADN se rechaza, la especie deja de ser Native (bypassThisSpecies).
// Devuelve cuantos bots inserto.
DB_EXPORT int db_sim_seed_species(void* h, int idx, int count) {
  db::Sim& sim = S(h);
  if (idx < 0 || static_cast<std::size_t>(idx) >= sim.Specie.size()) return 0;
  db::Specie& sp = sim.Specie[static_cast<std::size_t>(idx)];
  const int qty = count > 0 ? count : sp.qty;

  db::SpecieCfg cfg;
  cfg.Veg = sp.Veg;
  cfg.Fixed = sp.Fixed;
  cfg.Stnrg = static_cast<db::vb_single>(sp.Stnrg);
  cfg.Poslf = sp.Poslf;
  cfg.Posrg = sp.Posrg;
  cfg.Postp = sp.Postp;
  cfg.Posdn = sp.Posdn;
  cfg.CantSee = sp.CantSee;
  cfg.DisableDNA = sp.DisableDNA;
  cfg.DisableMovementSysvars = sp.DisableMovementSysvars;
  cfg.CantReproduce = sp.CantReproduce;
  cfg.VirusImmune = sp.VirusImmune;

  int inserted = 0;
  for (int t = 1; t <= qty; ++t) {
    const int a = db::InsertFounder(sim, sp.dnatext, sp.Name, cfg,
                                    sp.dnaMissing);
    if (a < 0) {
      sp.Native = false;  // main.frm:1528-1531
      break;
    }
    sp.Native = true;
    db::Bot& b = sim.rob[a];
    // main.frm:1535-1556 — lo que loadrobs toma de la especie y el
    // InsertFounder generico no cubre.
    b.NoChlr = sp.NoChlr;
    if (b.Veg)
      b.chloroplasts = static_cast<db::vb_single>(sim.StartChlr);
    b.Mutables = sp.Mutables;
    for (int i = 0; i <= 7; ++i) b.Skin[i] = sp.Skin[i];
    b.color = sp.color;
    // GenMut = DnaLen / GeneticSensitivity (division real de VB6)
    b.GenMut = static_cast<db::vb_single>(
        static_cast<double>(b.DnaLen) / db::GeneticSensitivity);
    b.multibot_time = sp.kill_mb ? 210 : 0;
    b.dq = sp.dq_kill ? 1 : 0;
    ++inserted;
  }
  return inserted;
}

// Siembra un fundador suelto desde texto de ADN (compat con la semilla M9).
// Devuelve el indice de bot (>0) o negativo si el cargador rechaza el ADN.
DB_EXPORT int db_sim_insert_founder(void* h, const char* dnatext,
                                    const char* name, int veg, int fixed,
                                    float stnrg) {
  db::SpecieCfg cfg;
  cfg.Veg = veg != 0;
  cfg.Fixed = fixed != 0;
  cfg.Stnrg = stnrg;
  return db::InsertFounder(S(h), dnatext ? dnatext : "",
                           name ? name : "bot.txt", cfg);
}

// ---------------------------------------------------------------------------
// Contadores y capacidades
// ---------------------------------------------------------------------------

DB_EXPORT int db_sim_cycle(void* h) {
  return static_cast<int>(S(h).opts.TotRunCycle);
}
DB_EXPORT int db_sim_total_robots(void* h) { return S(h).TotalRobots; }
DB_EXPORT int db_sim_max_robs(void* h) { return S(h).MaxRobs; }
DB_EXPORT int db_sim_totvegs(void* h) { return S(h).totvegs; }
DB_EXPORT int db_sim_shots_capacity(void* h) {
  return static_cast<int>(S(h).maxshotarray);
}
DB_EXPORT int db_sim_num_obstacles(void* h) { return S(h).numObstacles; }
DB_EXPORT int db_sim_num_teleporters(void* h) { return S(h).numTeleporters; }

// ---------------------------------------------------------------------------
// Volcados de estado para render (el JS solo presenta; nunca recalcula)
// ---------------------------------------------------------------------------

// 20 floats por bot existente (E2 amplia los 8 de M10 con los recursos de
// los gauges de DrawRobPer, main.frm:624-712, y los last* de los vectores de
// movimiento de DrawRobAim, main.frm:758-829):
//   [indice, pos.x, pos.y, radius, aim, nrg, color RGB (Long BGR), flags,
//    body, waste, venom, shell, slime, poison, Vtimer, chloroplasts,
//    lastup, lastdown, lastleft, lastright]
// flags: bit0 = Veg, bit1 = Fixed, bit2 = Corpse, bit3 = Multibot.
// Devuelve cuantos bots escribio (como maximo max_bots).
DB_EXPORT int db_sim_dump_bots(void* h, float* out, int max_bots) {
  const db::Sim& sim = S(h);
  int written = 0;
  for (int n = 1; n <= sim.MaxRobs && written < max_bots; ++n) {
    const db::Bot& b = sim.rob[n];
    if (!b.exist) continue;
    float* r = out + written * 20;
    r[0] = static_cast<float>(n);
    r[1] = b.pos.x;
    r[2] = b.pos.y;
    r[3] = b.radius;
    r[4] = b.aim;
    r[5] = b.nrg;
    r[6] = static_cast<float>(b.color);
    r[7] = static_cast<float>((b.Veg ? 1 : 0) | (b.Fixed ? 2 : 0) |
                              (b.Corpse ? 4 : 0) | (b.Multibot ? 8 : 0) |
                              (b.highlight ? 16 : 0));  // E6: familia/PB
    r[8] = b.body;
    r[9] = b.Waste;
    r[10] = b.venom;
    r[11] = b.shell;
    r[12] = b.Slime;
    r[13] = b.poison;
    r[14] = static_cast<float>(b.Vtimer);
    r[15] = b.chloroplasts;
    r[16] = static_cast<float>(b.lastup);
    r[17] = static_cast<float>(b.lastdown);
    r[18] = static_cast<float>(b.lastleft);
    r[19] = static_cast<float>(b.lastright);
    ++written;
  }
  return written;
}

// 9 floats por shot: [x, y, vel.x, vel.y, color, shottype, flash, opos.x,
// opos.y]. El criterio de inclusion es el de DrawShots (main.frm:953-971):
// un shot con flash sale SIEMPRE (el destello de impacto se pinta en opos un
// frame, hasta que updateshots lo limpie al tick siguiente); si no, sale si
// existe y no esta almacenado (stored = virus guardado: invisible).
DB_EXPORT int db_sim_dump_shots(void* h, float* out, int max_shots) {
  const db::Sim& sim = S(h);
  int written = 0;
  for (db::vb_long n = 1; n <= sim.maxshotarray && written < max_shots; ++n) {
    const db::Shot& s = sim.Shots[static_cast<std::size_t>(n)];
    if (!s.flash && !(s.exist && !s.stored)) continue;
    float* r = out + written * 9;
    r[0] = s.pos.x;
    r[1] = s.pos.y;
    r[2] = s.velocity.x;
    r[3] = s.velocity.y;
    r[4] = static_cast<float>(s.color);
    r[5] = static_cast<float>(s.shottype);
    r[6] = s.flash ? 1.0f : 0.0f;
    r[7] = s.opos.x;
    r[8] = s.opos.y;
    ++written;
  }
  return written;
}

// E2 — volcado del bot con foco (robfocus): inspector + rejilla de vision de
// main.frm:1017-1060. 8 floats de cabecera + 9 ojos x 4 = 44 floats:
//   cabecera: [pos.x, pos.y, aim, radius, focusEyeIdx, age, nrg, body]
//   por ojo a = 0..8: [dirOffset, halfeyewidth, esd, seen]
//     dirOffset    = (mem(EYE1DIR+a) Mod 1256) / 200        (main.frm:1030)
//     halfeyewidth = (mem(EYE1WIDTH+a) Mod 1256) / 400, normalizado con los
//                    While de main.frm:1027-1029
//     esd  = EyeSightDistance(AbsoluteEyeWidth(mem(EYE1WIDTH+a)), n) — la
//            matematica de vision (eyestrength: pondmode/daytime) es del core
//     seen = mem(EyeStart + a + 1) (el valor visto por el ojo a+1)
//   focusEyeIdx = Abs(mem(FOCUSEYE) + 4) Mod 9 (FocusEyeIndex del core).
// La pagina compone hi/low/longitud con la formula literal del fuente
// (geometria de dibujo); aqui NO se recalcula nada que el core ya sepa.
// Devuelve 1 si el bot existe (0: el foco murio — la pagina deselecciona).
DB_EXPORT int db_sim_dump_focus(void* h, int n, float* out) {
  db::Sim& sim = S(h);
  if (n < 1 || n > sim.MaxRobs || !sim.rob[n].exist) return 0;
  db::Bot& b = sim.rob[n];
  out[0] = b.pos.x;
  out[1] = b.pos.y;
  out[2] = b.aim;
  out[3] = b.radius;
  out[4] = static_cast<float>(db::FocusEyeIndex(b.mem[db::addr::FOCUSEYE]));
  out[5] = static_cast<float>(b.age);
  out[6] = b.nrg;
  out[7] = b.body;
  const double kPi = static_cast<double>(db::PI);  // Common.bas:19 (Single)
  for (int a = 0; a <= 8; ++a) {
    float* e = out + 8 + a * 4;
    double halfeye =
        static_cast<double>(b.mem[db::addr::EYE1WIDTH + a] % 1256) / 400.0;
    while (halfeye > kPi - kPi / 36.0) halfeye -= kPi;
    while (halfeye < -kPi / 36.0) halfeye += kPi;
    e[0] = static_cast<float>(
        static_cast<double>(b.mem[db::addr::EYE1DIR + a] % 1256) / 200.0);
    e[1] = static_cast<float>(halfeye);
    e[2] = db::EyeSightDistance(
        sim, db::AbsoluteEyeWidth(b.mem[db::addr::EYE1WIDTH + a]), n);
    e[3] = static_cast<float>(b.mem[db::addr::EyeStart + 1 + a]);
  }
  return 1;
}

// 5 floats por tie: [x1, y1, x2, y2, type] (type 0 = elastica, 3 = dura).
// Se listan los slots 1..9 con pnt valido de cada bot; la tie espejo del
// otro extremo tambien sale (el render dibuja lineas: sobredibujar es
// inocuo y no depender de la simetria evita perder ties a medio crear).
DB_EXPORT int db_sim_dump_ties(void* h, float* out, int max_ties) {
  const db::Sim& sim = S(h);
  int written = 0;
  for (int n = 1; n <= sim.MaxRobs && written < max_ties; ++n) {
    const db::Bot& b = sim.rob[n];
    if (!b.exist) continue;
    for (int k = 1; k <= db::MAXTIES - 1 && written < max_ties; ++k) {
      const db::Tie& t = b.Ties[static_cast<std::size_t>(k)];
      if (t.pnt <= 0 || t.pnt > sim.MaxRobs) continue;
      const db::Bot& o = sim.rob[t.pnt];
      if (!o.exist) continue;
      float* r = out + written * 5;
      r[0] = b.pos.x;
      r[1] = b.pos.y;
      r[2] = o.pos.x;
      r[3] = o.pos.y;
      r[4] = static_cast<float>(t.type);
      ++written;
    }
  }
  return written;
}

// 5 floats por obstaculo: [x, y, width, height, color].
DB_EXPORT int db_sim_dump_obstacles(void* h, float* out, int max_obs) {
  const db::Sim& sim = S(h);
  int written = 0;
  for (int n = 1; n <= sim.numObstacles && written < max_obs; ++n) {
    const db::Obstacle& o = sim.Obstacles[static_cast<std::size_t>(n)];
    if (!o.exist) continue;
    float* r = out + written * 5;
    r[0] = o.pos.x;
    r[1] = o.pos.y;
    r[2] = o.Width;
    r[3] = o.Height;
    r[4] = static_cast<float>(o.color);
    ++written;
  }
  return written;
}

// 7 floats por teleporter: [x, y, width, height, color, flags, teleported].
// flags: bit0 = In, bit1 = Out, bit2 = local, bit3 = Internet.
DB_EXPORT int db_sim_dump_teleporters(void* h, float* out, int max_tp) {
  const db::Sim& sim = S(h);
  int written = 0;
  for (int n = 1; n <= sim.numTeleporters && written < max_tp; ++n) {
    const db::Teleporter& t = sim.Teleporters[static_cast<std::size_t>(n)];
    if (!t.exist) continue;
    float* r = out + written * 7;
    r[0] = t.pos.x;
    r[1] = t.pos.y;
    r[2] = t.Width;
    r[3] = t.Height;
    r[4] = static_cast<float>(t.color);
    r[5] = static_cast<float>((t.In ? 1 : 0) | (t.Out ? 2 : 0) |
                              (t.local ? 4 : 0) | (t.Internet ? 8 : 0));
    r[6] = static_cast<float>(t.NumTeleported);
    ++written;
  }
  return written;
}

// ---------------------------------------------------------------------------
// E6.5 — Vista enriquecida (decisión de capa host, fuera de la fidelidad)
// ---------------------------------------------------------------------------
// Segunda forma de mirar la misma sim (spec/PLAN-EXTENSIONES.md §E6.5). Todo
// es LECTURA del Sim: el estado vive en SimHandle::vis y nada consume RNG.
//
// Los comandos de mem se consumen dentro del ciclo (21-MEMORIA.md), así que
// tras el tick no queda qué "ejecutó" un bot. La vista define acción como el
// EFECTO observable del tick, por diferencia contra el tick anterior:
//   bit 0 disparo      shot nuevo en su slot (no existía, age reiniciado o
//                      parent distinto) con parent = el bot
//   bit 1 reproducción hijo nuevo cuyo parent es el AbsNum del bot
//   bit 2 sexual       fertilized pasa a > 0
//   bit 3 tie          un slot Ties(1..9) pasa de vacío a ocupado
//   bit 4 movimiento   algún last* != 0 o aim cambió
//   bit 5 shell/slime  shell o Slime suben
//   bit 6 venom/poison venom o poison suben
//   bit 7 gana nrg     Kills sube, o nrg sube en un no-vegetal
//   bit 8 body         body cambia en un no-vegetal (strbody/fdbody; en
//                      los vegetales el body se mueve solo cada tick)
// Un slot cuyo AbsNum cambió es otro bot: su foto se reinicia sin acciones.
}  // extern "C"

namespace {

using Vis = SimHandle::Vis;

template <class T>
void Grow(std::vector<T>& v, std::size_t n) {
  if (v.size() < n) v.resize(n, T{});
}

int TieMask(const db::Bot& b) {
  int m = 0;
  for (int k = 1; k <= db::MAXTIES - 1; ++k)
    if (b.Ties[static_cast<std::size_t>(k)].pnt > 0) m |= 1 << k;
  return m;
}

void VisTake(Vis& v, int n, const db::Bot& b) {
  const std::size_t i = static_cast<std::size_t>(n);
  v.abs[i] = b.AbsNum;
  v.shell[i] = b.shell;
  v.slime[i] = b.Slime;
  v.venom[i] = b.venom;
  v.poison[i] = b.poison;
  v.body[i] = b.body;
  v.nrg[i] = b.nrg;
  v.aim[i] = b.aim;
  v.kills[i] = b.Kills;
  v.tieMask[i] = TieMask(b);
  v.fert[i] = b.fertilized;
  v.px[i] = b.pos.x;   // última posición conocida: el evento de muerte
  v.py[i] = b.pos.y;   // se dibuja donde se lo vio por última vez
  v.pr[i] = b.radius;
  v.pcol[i] = static_cast<float>(b.color);
}

bool InsideTeleporter(const db::Sim& sim, float x, float y, float r) {
  for (int t = 1; t <= sim.numTeleporters; ++t) {
    const db::Teleporter& tp = sim.Teleporters[static_cast<std::size_t>(t)];
    if (!tp.exist || !(tp.Out || tp.Internet)) continue;
    if (x >= tp.pos.x - r && x <= tp.pos.x + tp.Width + r &&
        y >= tp.pos.y - r && y <= tp.pos.y + tp.Height + r)
      return true;
  }
  return false;
}

void VisResize(Vis& v, const db::Sim& sim) {
  const std::size_t n = static_cast<std::size_t>(sim.MaxRobs) + 1;
  Grow(v.abs, n); Grow(v.actions, n); Grow(v.shotType, n); Grow(v.born, n);
  Grow(v.shell, n); Grow(v.slime, n); Grow(v.venom, n); Grow(v.poison, n);
  Grow(v.body, n); Grow(v.nrg, n); Grow(v.aim, n); Grow(v.kills, n);
  Grow(v.tieMask, n); Grow(v.fert, n); Grow(v.px, n); Grow(v.py, n);
  Grow(v.pr, n); Grow(v.pcol, n); Grow(v.gdist, n); Grow(v.gdistAbs, n);
  const std::size_t ns = static_cast<std::size_t>(sim.maxshotarray) + 1;
  Grow(v.shotExist, ns); Grow(v.shotAge, ns); Grow(v.shotParent, ns);
}

// Un shot "vivo" para la foto: existe o está en su frame de destello.
bool ShotAlive(const db::Shot& s) { return (s.exist && !s.stored) || s.flash; }

constexpr std::size_t kMaxEvents = 2000;  // por volcado (6 floats cada uno)

}  // namespace

extern "C" {

// Toma la foto de referencia sin generar acciones ni eventos: al encender
// la vista, tras un reset o tras una siembra/carga que no son "nacimientos".
DB_EXPORT void db_sim_vis_reset(void* h) {
  Vis& v = H(h).vis;
  const db::Sim& sim = S(h);
  VisResize(v, sim);
  for (int n = 1; n <= sim.MaxRobs; ++n) {
    const db::Bot& b = sim.rob[n];
    const std::size_t i = static_cast<std::size_t>(n);
    v.actions[i] = 0;
    v.born[i] = 0;
    if (b.exist) VisTake(v, n, b);
    else v.abs[i] = 0;
  }
  for (db::vb_long k = 1; k <= sim.maxshotarray; ++k) {
    const db::Shot& s = sim.Shots[static_cast<std::size_t>(k)];
    const std::size_t i = static_cast<std::size_t>(k);
    v.shotExist[i] = ShotAlive(s) ? 1 : 0;
    v.shotAge[i] = s.age;
    v.shotParent[i] = s.parent;
  }
  v.births.clear();
  v.deaths.clear();
  v.primed = true;
}

// Tras cada db_sim_tick (solo con la vista encendida): acumula acciones y
// eventos del tick. O(MaxRobs + maxshotarray), solo lectura del Sim.
DB_EXPORT void db_sim_vis_observe(void* h) {
  Vis& v = H(h).vis;
  const db::Sim& sim = S(h);
  if (!v.primed) { db_sim_vis_reset(h); return; }
  VisResize(v, sim);

  // Muertes primero (el slot pudo reusarse en el mismo tick), luego bots.
  std::vector<int> newborn;  // slots con bot nuevo ESTE tick
  for (int n = 1; n <= sim.MaxRobs; ++n) {
    const db::Bot& b = sim.rob[n];
    const std::size_t i = static_cast<std::size_t>(n);
    const bool same = b.exist && v.abs[i] == b.AbsNum;
    if (v.abs[i] != 0 && !same && v.deaths.size() < kMaxEvents * 6) {
      const bool tp = InsideTeleporter(sim, v.px[i], v.py[i], v.pr[i]);
      v.deaths.insert(v.deaths.end(),
                      {v.px[i], v.py[i], v.pr[i], v.pcol[i],
                       static_cast<float>(v.abs[i]), tp ? 1.0f : 0.0f});
    }
    if (!b.exist) { v.abs[i] = 0; v.actions[i] = 0; continue; }
    if (!same) {
      // Otro bot en el slot: nacido (o sembrado/teletransportado) este tick.
      v.actions[i] = 0;
      v.born[i] = 1;
      v.shotType[i] = 0;
      VisTake(v, n, b);
      if (b.parent != 0) newborn.push_back(n);
      continue;
    }
    std::uint32_t a = 0;
    if (b.fertilized > 0 && v.fert[i] <= 0) a |= 1u << 2;
    const int tm = TieMask(b);
    if (tm & ~v.tieMask[i]) a |= 1u << 3;
    if (b.lastup || b.lastdown || b.lastleft || b.lastright ||
        b.aim != v.aim[i])
      a |= 1u << 4;
    if (b.shell > v.shell[i] || b.Slime > v.slime[i]) a |= 1u << 5;
    if (b.venom > v.venom[i] || b.poison > v.poison[i]) a |= 1u << 6;
    if (b.Kills > v.kills[i] || (!b.Veg && b.nrg > v.nrg[i])) a |= 1u << 7;
    if (!b.Veg && b.body != v.body[i]) a |= 1u << 8;
    v.actions[i] |= a;
    VisTake(v, n, b);
  }

  // Nacimientos: el bit de reproducción de la madre y el evento con línea.
  if (!newborn.empty()) {
    std::unordered_map<db::vb_long, int> slotOf;  // AbsNum → slot
    for (int m = 1; m <= sim.MaxRobs; ++m)
      if (sim.rob[m].exist) slotOf.emplace(sim.rob[m].AbsNum, m);
    for (const int n : newborn) {
      const db::Bot& b = sim.rob[n];
      float mx = std::nanf(""), my = std::nanf("");
      const auto it = slotOf.find(b.parent);
      if (it != slotOf.end()) {
        const db::Bot& o = sim.rob[it->second];
        mx = o.pos.x;
        my = o.pos.y;
        v.actions[static_cast<std::size_t>(it->second)] |= 1u << 1;
      }
      if (v.births.size() < kMaxEvents * 6)
        v.births.insert(v.births.end(),
                        {b.pos.x, b.pos.y, mx, my, static_cast<float>(b.color),
                         static_cast<float>(b.AbsNum)});
    }
  }

  // Disparos: slot de shot recién ocupado → acción del tirador (parent es
  // el SLOT del tirador, sim.hpp:68).
  for (db::vb_long k = 1; k <= sim.maxshotarray; ++k) {
    const db::Shot& s = sim.Shots[static_cast<std::size_t>(k)];
    const std::size_t i = static_cast<std::size_t>(k);
    const bool alive = ShotAlive(s);
    if (alive && (!v.shotExist[i] || s.age < v.shotAge[i] ||
                  s.parent != v.shotParent[i])) {
      const int p = s.parent;
      if (p >= 1 && p <= sim.MaxRobs && sim.rob[p].exist) {
        v.actions[static_cast<std::size_t>(p)] |= 1u;
        v.shotType[static_cast<std::size_t>(p)] = static_cast<float>(s.shottype);
      }
    }
    v.shotExist[i] = alive ? 1 : 0;
    v.shotAge[i] = s.age;
    v.shotParent[i] = s.parent;
  }
}

// Registro extendido, 24 floats por bot, en el MISMO orden que
// db_sim_dump_bots (slots 1..MaxRobs existentes) — la página los empareja
// por fila:
//   [0] AbsNum          [1] AbsNum de la madre   [2] generation
//   [3] Mutations       [4] age                  [5] DnaLen
//   [6] Kills           [7] acciones (bits, ver arriba; se limpian aquí)
//   [8] estado: bit0 Paralyzed, bit1 Poisoned, bit2 virus (Vtimer > 0),
//       bit3 fertilized > 0, bit4 nacido desde el último volcado
//   [9] ojos que ven (bit a = mem(EyeStart + a + 1) > 0)
//   [10] índice de especie (tabla por FName; db_sim_vis_species_*)
//   [11] numties        [12..20] dirección de cada ojo, la misma cuenta que
//        db_sim_dump_focus: (mem(EYE1DIR + a) Mod 1256) / 200
//   [21] distancia genética al bot de referencia (−1 = sin dato)
//   [22] último shottype disparado  [23] reservado
DB_EXPORT int db_sim_dump_bots_vis(void* h, float* out, int max_bots) {
  Vis& v = H(h).vis;
  const db::Sim& sim = S(h);
  VisResize(v, sim);
  int written = 0;
  for (int n = 1; n <= sim.MaxRobs && written < max_bots; ++n) {
    const db::Bot& b = sim.rob[n];
    if (!b.exist) continue;
    const std::size_t i = static_cast<std::size_t>(n);
    float* r = out + written * 24;
    r[0] = static_cast<float>(b.AbsNum);
    r[1] = static_cast<float>(b.parent);
    r[2] = static_cast<float>(b.generation);
    r[3] = static_cast<float>(b.Mutations);
    r[4] = static_cast<float>(b.age);
    r[5] = static_cast<float>(b.DnaLen);
    r[6] = static_cast<float>(b.Kills);
    const bool mine = v.abs[i] == b.AbsNum;
    r[7] = mine ? static_cast<float>(v.actions[i]) : 0.0f;
    r[8] = static_cast<float>((b.Paralyzed ? 1 : 0) | (b.Poisoned ? 2 : 0) |
                              (b.Vtimer > 0 ? 4 : 0) |
                              (b.fertilized > 0 ? 8 : 0) |
                              (mine && v.born[i] ? 16 : 0));
    int seen = 0;
    for (int a = 0; a <= 8; ++a)
      if (b.mem[db::addr::EyeStart + 1 + a] > 0) seen |= 1 << a;
    r[9] = static_cast<float>(seen);
    auto it = v.speciesIdx.find(b.FName);
    if (it == v.speciesIdx.end()) {
      it = v.speciesIdx.emplace(b.FName, static_cast<int>(v.species.size()))
               .first;
      v.species.push_back(b.FName);
      ++v.speciesVersion;
    }
    const int sp = it->second;
    r[10] = static_cast<float>(sp);
    r[11] = b.numties;
    for (int a = 0; a <= 8; ++a)
      r[12 + a] = static_cast<float>(
          static_cast<double>(b.mem[db::addr::EYE1DIR + a] % 1256) / 200.0);
    r[21] = (v.gdistRef > 0 && v.gdistAbs[i] == b.AbsNum) ? v.gdist[i] : -1.0f;
    r[22] = mine ? v.shotType[i] : 0.0f;
    r[23] = 0.0f;
    if (mine) { v.actions[i] = 0; v.born[i] = 0; }
    ++written;
  }
  return written;
}

// Eventos acumulados desde el último volcado; kind 0 = nacimientos
// [x, y, madre.x, madre.y (NaN si no está), color, AbsNum], kind 1 = muertes
// [x, y, radio, color, AbsNum, 1 si salió por un teleporter]. Copia hasta
// `max` eventos, vacía la lista y devuelve cuántos copió.
DB_EXPORT int db_sim_vis_events(void* h, int kind, float* out, int max) {
  std::vector<float>& ev = kind == 0 ? H(h).vis.births : H(h).vis.deaths;
  const int n = std::min(static_cast<int>(ev.size() / 6), max);
  if (n > 0) std::memcpy(out, ev.data(), static_cast<std::size_t>(n) * 6 * 4);
  ev.clear();
  return n;
}

// Tabla de especies de la vista (FName por índice). La versión cambia cuando
// aparece un nombre nuevo (mutación con auto-especiación, carga, siembra).
DB_EXPORT int db_sim_vis_species_version(void* h) {
  return H(h).vis.speciesVersion;
}
DB_EXPORT int db_sim_vis_species_count(void* h) {
  return static_cast<int>(H(h).vis.species.size());
}
DB_EXPORT char* db_sim_vis_species_name(void* h, int i) {
  const auto& sp = H(h).vis.species;
  const std::string s = (i >= 0 && static_cast<std::size_t>(i) < sp.size())
                            ? sp[static_cast<std::size_t>(i)] : std::string();
  char* p = static_cast<char*>(std::malloc(s.size() + 1));
  if (p) std::memcpy(p, s.c_str(), s.size() + 1);
  return p;
}

// Lente "distancia genética": fija el bot de referencia (0 = apagada) y
// reinicia el recorrido.
DB_EXPORT void db_sim_vis_gendist_ref(void* h, int ref) {
  Vis& v = H(h).vis;
  const db::Sim& sim = S(h);
  VisResize(v, sim);
  v.gdistRef = (ref >= 1 && ref <= sim.MaxRobs && sim.rob[ref].exist) ? ref : 0;
  v.gdistRefAbs = v.gdistRef ? sim.rob[v.gdistRef].AbsNum : 0;
  v.gdistCursor = 1;
  std::fill(v.gdistAbs.begin(), v.gdistAbs.end(), 0);
}

// Avanza el recorrido hasta `pairs` pares (ref, n) con DoGeneticDistance
// (Robots.bas:534-560, O(DnaLen²)). Devuelve 1 al completar una vuelta
// (el cursor vuelve a 1), 0 si queda trabajo, −1 si la referencia murió.
// El único efecto del core fuera de su resultado es el contador de
// diagnóstico err9_simplematch: se guarda y se restaura (la vista no puede
// dejar rastro en la sim, ni siquiera en SimDiag).
DB_EXPORT int db_sim_vis_gendist_step(void* h, int pairs) {
  Vis& v = H(h).vis;
  db::Sim& sim = S(h);
  VisResize(v, sim);
  const int ref = v.gdistRef;
  if (!ref) return -1;
  if (!sim.rob[ref].exist || sim.rob[ref].AbsNum != v.gdistRefAbs) {
    v.gdistRef = 0;
    return -1;
  }
  const auto saved = sim.diag.err9_simplematch;
  int done = 0;
  while (done < pairs && v.gdistCursor <= sim.MaxRobs) {
    const int n = v.gdistCursor++;
    const db::Bot& b = sim.rob[n];
    if (!b.exist) continue;
    const std::size_t i = static_cast<std::size_t>(n);
    v.gdist[i] = n == ref ? 0.0f : db::DoGeneticDistance(sim, ref, n);
    v.gdistAbs[i] = b.AbsNum;
    ++done;
  }
  sim.diag.err9_simplematch = saved;
  if (v.gdistCursor > sim.MaxRobs) { v.gdistCursor = 1; return 1; }
  return 0;
}

// ---------------------------------------------------------------------------
// Obstaculos y teleporters (altas; la capa host decide donde y de que color)
// ---------------------------------------------------------------------------

// Obstacles.bas:190-212 — NewObstacle (el color viene decidido del host,
// como en el port del core). Devuelve el indice o -1 si el tope de 1000.
DB_EXPORT int db_sim_add_obstacle(void* h, float x, float y, float w,
                                  float hgt, int color) {
  return db::NewObstacle(S(h), x, y, w, hgt, color);
}

// ---------------------------------------------------------------------------
// E3 — menu Objects (spec/PLAN-EXTENSIONES.md §E3): formas, mazes y borrado
// de teleporters. Transcripciones de Obstacles.bas / ObstacleForm.frm /
// Teleport.bas. El RNG de posiciones y aperturas consume el MISMO flujo del
// LCG de la sim que consumia la UI del original (igual que la posicion de
// db_sim_add_teleporter); los colores siguen siendo decision del host (B7-5,
// Q01): estos exports crean con color 0 y la pagina recolorea con
// db_sim_obstacle_set_color.
// ---------------------------------------------------------------------------

// ChangeAllObstacleColor escribia el color directo (Obstacles.bas:298-308);
// aqui por indice: la paleta la decide la pagina tras cada alta.
DB_EXPORT void db_sim_obstacle_set_color(void* h, int i, int color) {
  db::Sim& sim = S(h);
  if (i < 1 || i > sim.numObstacles) return;
  sim.Obstacles[static_cast<std::size_t>(i)].color = color;
}

// ObstacleForm.frm:457-465 — MakeShape_Click ("New Shape..."): posicion
// sorteada con Random (2 extracciones), tamano = fraccion del campo
// (defaultWidth/defaultHeight; main.frm:1321-1322 los inicia en 0.2).
DB_EXPORT int db_sim_make_shape(void* h, float defaultWidth,
                                float defaultHeight) {
  db::Sim& sim = S(h);
  const db::vb_single FW = sim.opts.FieldWidth, FH = sim.opts.FieldHeight;
  const db::vb_single randomX =
      static_cast<db::vb_single>(
          db::Random(0.0, static_cast<double>(FW), *sim.rndy)) -
      FW * (defaultWidth / 2.0f);
  const db::vb_single randomy =
      static_cast<db::vb_single>(
          db::Random(0.0, static_cast<double>(FH), *sim.rndy)) -
      FH * (defaultHeight / 2.0f);
  return db::NewObstacle(sim, randomX, randomy, FW * defaultWidth,
                         FH * defaultHeight);
}

// Obstacles.bas:229-268 — AddRandomObstacles(n) ("Add Ten Random Shapes"
// llama con 10, MDIForm1.frm:1115-1117): 4 extracciones Rnd crudas por
// forma (posicion y tamano), desplazamiento a izquierda/arriba y recorte al
// campo. Devuelve 0 o -1 (tope de 1000), como el original.
DB_EXPORT int db_sim_add_random_obstacles(void* h, int n, float defaultWidth,
                                          float defaultHeight) {
  db::Sim& sim = S(h);
  if (n < 1) return -1;
  auto& rnd = *sim.rndy;
  const db::vb_single FW = sim.opts.FieldWidth, FH = sim.opts.FieldHeight;
  int i = 0;
  while (i != -1 && n > 0) {
    db::vb_single randomX = rnd() * FW;
    db::vb_single randomy = rnd() * FH;
    db::vb_single RandomWidth = rnd() * FW * defaultWidth;
    db::vb_single RandomHeight = rnd() * FH * defaultHeight;
    randomX = randomX - FW * (defaultWidth / 2.0f);
    randomy = randomy - FH * (defaultHeight / 2.0f);
    if (randomX < 0.0f) randomX = 0.0f;
    if (randomy < 0.0f) randomy = 0.0f;
    if (randomX + RandomWidth > FW) RandomWidth = FW - randomX;
    if (randomy + RandomHeight > FH) RandomHeight = FH - randomy;
    i = db::NewObstacle(sim, randomX, randomy, RandomWidth, RandomHeight);
    n = n - 1;
  }
  return (i == -1 || n != 0) ? -1 : 0;
}

// Obstacles.bas:286-296 — DeleteObstacle: desplaza el resto una posicion
// hacia abajo. El original lee Obstacles(numObstacles+1) — un registro en
// blanco del array fijo de 1000; aqui se garantiza el hueco. Los indices del
// compactador (leftCompactor/rightCompactor) NO se ajustan, como en el
// original (quedan apuntando a registros movidos o borrados).
DB_EXPORT void db_sim_delete_obstacle(void* h, int i) {
  db::Sim& sim = S(h);
  if (i < 1 || i > sim.numObstacles || sim.numObstacles == 0) return;
  if (static_cast<int>(sim.Obstacles.size()) <= sim.numObstacles + 1)
    sim.Obstacles.resize(static_cast<std::size_t>(sim.numObstacles) + 2);
  for (int j = i; j <= sim.numObstacles; ++j)
    sim.Obstacles[static_cast<std::size_t>(j)] =
        sim.Obstacles[static_cast<std::size_t>(j) + 1];
  sim.Obstacles[static_cast<std::size_t>(sim.numObstacles)].exist = false;
  sim.numObstacles -= 1;
}

// Obstacles.bas:277-284 — DeleteAllObstacles. leftCompactor/rightCompactor
// quedan como esten (el original tampoco los limpia; MoveObstacles seguiria
// moviendo los registros apagados si eran compactors — replicado tal cual).
DB_EXPORT void db_sim_delete_all_obstacles(void* h) {
  db::Sim& sim = S(h);
  for (int i = 1; i <= sim.numObstacles; ++i)
    sim.Obstacles[static_cast<std::size_t>(i)].exist = false;
  sim.numObstacles = 0;
}

// Obstacles.bas:310-320 — DeleteTenRandomObstacles: 10 sorteos Random(1,
// numObstacles) SIEMPRE que hubiera al menos una forma al entrar (si se
// vacia a mitad, los sorteos restantes consumen RNG y DeleteObstacle los
// descarta, como en el original).
DB_EXPORT void db_sim_delete_ten_random_obstacles(void* h) {
  db::Sim& sim = S(h);
  if (sim.numObstacles <= 0) return;
  for (int i = 1; i <= 10; ++i)
    db_sim_delete_obstacle(
        h, static_cast<int>(db::RandomI(
               1, static_cast<db::vb_integer>(sim.numObstacles), *sim.rndy)));
}

// --- Mazes (Obstacles.bas:45-181). corridor/wall = mazeCorridorWidth /
// mazeWallThickness, estado de la UI del original (defaults 500 y 50,
// MDIForm1.frm:2464-2465) que aqui viaja como parametro desde la pagina.
// Cada export devuelve cuantas formas creo.

// Obstacles.bas:45-59 — DrawHorizontalMaze: lineas de muros verticales con
// una apertura sorteada (Random, 1 extraccion por linea).
DB_EXPORT int db_sim_maze_horizontal(void* h, int corridor, int wall) {
  db::Sim& sim = S(h);
  const int before = sim.numObstacles;
  const db::vb_single FW = sim.opts.FieldWidth, FH = sim.opts.FieldHeight;
  const db::vb_single cw = static_cast<db::vb_single>(corridor);
  const db::vb_single wt = static_cast<db::vb_single>(wall);
  const int numOfLines =
      static_cast<int>(db::vb_round64(static_cast<double>(
          FW / static_cast<db::vb_single>(corridor + wall)))) -
      1;
  for (int i = 1; i <= numOfLines; ++i) {
    const db::vb_long Opening =
        db::Random(0.0, static_cast<double>(FH - cw), *sim.rndy);
    db::NewObstacle(sim, static_cast<db::vb_single>(i) * (cw + wt), -100.0f,
                    wt, static_cast<db::vb_single>(Opening));
    if (static_cast<double>(Opening) + corridor <
        static_cast<double>(FH) + 100.0)
      db::NewObstacle(sim, static_cast<db::vb_single>(i) * (cw + wt),
                      static_cast<db::vb_single>(Opening) + cw, wt,
                      FH + 100.0f - static_cast<db::vb_single>(Opening) - cw);
  }
  return sim.numObstacles - before;
}

// Obstacles.bas:61-75 — DrawVerticalMaze (simetrico al horizontal).
DB_EXPORT int db_sim_maze_vertical(void* h, int corridor, int wall) {
  db::Sim& sim = S(h);
  const int before = sim.numObstacles;
  const db::vb_single FW = sim.opts.FieldWidth, FH = sim.opts.FieldHeight;
  const db::vb_single cw = static_cast<db::vb_single>(corridor);
  const db::vb_single wt = static_cast<db::vb_single>(wall);
  const int numOfLines =
      static_cast<int>(db::vb_round64(static_cast<double>(
          FH / static_cast<db::vb_single>(corridor + wall)))) -
      1;
  for (int i = 1; i <= numOfLines; ++i) {
    const db::vb_long Opening =
        db::Random(0.0, static_cast<double>(FW - cw), *sim.rndy);
    db::NewObstacle(sim, -100.0f, static_cast<db::vb_single>(i) * (cw + wt),
                    static_cast<db::vb_single>(Opening), wt);
    if (static_cast<double>(Opening) + corridor <
        static_cast<double>(FW) + 100.0)
      db::NewObstacle(sim, static_cast<db::vb_single>(Opening) + cw,
                      static_cast<db::vb_single>(i) * (cw + wt),
                      FW + 100.0f - static_cast<db::vb_single>(Opening) - cw,
                      wt);
  }
  return sim.numObstacles - before;
}

// Obstacles.bas:78-108 — DrawCheckerboardMaze: rejilla de bloques cuadrados
// centrada en el campo. Sin RNG. Solo usa mazeCorridorWidth.
DB_EXPORT int db_sim_maze_checkerboard(void* h, int corridor) {
  db::Sim& sim = S(h);
  const int before = sim.numObstacles;
  const db::vb_single FW = sim.opts.FieldWidth, FH = sim.opts.FieldHeight;
  const db::vb_single cw = static_cast<db::vb_single>(corridor);
  const db::vb_single blockWidth = db::Min(5000.0f, FW / 10.0f);
  const db::vb_single numBlocksAcross =
      std::floor(FW / (blockWidth + cw));  // Int() sobre Single
  const db::vb_single acrossGap =
      (numBlocksAcross * (blockWidth + cw) + cw - FW) / 2.0f;
  const db::vb_single numBlocksDown = std::floor(FH / (blockWidth + cw));
  const db::vb_single downGap =
      (numBlocksDown * (blockWidth + cw) + cw - FH) / 2.0f;
  for (int i = 0; i <= static_cast<int>(numBlocksAcross) - 1; ++i)
    for (int j = 0; j <= static_cast<int>(numBlocksDown) - 1; ++j) {
      const db::vb_single x = static_cast<db::vb_single>(i) * blockWidth +
                              static_cast<db::vb_single>(i + 1) * cw -
                              acrossGap;
      const db::vb_single y = static_cast<db::vb_single>(j) * blockWidth +
                              static_cast<db::vb_single>(j + 1) * cw - downGap;
      db::NewObstacle(sim, x, y, blockWidth, blockWidth);
    }
  return sim.numObstacles - before;
}

// Obstacles.bas:110-127 — DrawPolarIceMaze: 9 bloques identicos apilados
// (medio campo, centrados) y ENCIENDE la deriva en ambos ejes con
// shapeDriftRate = 20 (la pagina relee los ids 83/84/85 tras llamar).
DB_EXPORT int db_sim_maze_polar_ice(void* h) {
  db::Sim& sim = S(h);
  const int before = sim.numObstacles;
  const db::vb_single blockWidth = sim.opts.FieldWidth / 2.0f;
  const db::vb_single blockHeight = sim.opts.FieldHeight / 2.0f;
  for (int i = 0; i <= 8; ++i)
    db::NewObstacle(sim, blockWidth / 2.0f, blockHeight / 2.0f, blockWidth,
                    blockHeight);
  sim.opts.allowHorizontalShapeDrift = true;
  sim.opts.allowVerticalShapeDrift = true;
  sim.opts.shapeDriftRate = 20;
  return sim.numObstacles - before;
}

// Obstacles.bas:129-144 — InitTrashCompactorMaze: dos muros laterales que
// avanzan con vel.x = ±shapeDriftRate*0.1 (TrashCompactorMove del core los
// rebota). Si el array esta lleno el original indexaba Obstacles(-1) —
// error 9 que abortaba el handler; aqui la asignacion de vel se omite para
// el indice invalido (decision de capa host, sin efecto en el core).
DB_EXPORT int db_sim_maze_trash_compactor(void* h) {
  db::Sim& sim = S(h);
  const int before = sim.numObstacles;
  const db::vb_single blockWidth = 1000.0f;
  const db::vb_single blockHeight =
      static_cast<db::vb_single>(static_cast<double>(sim.opts.FieldHeight) * 1.2);
  sim.leftCompactor = db::NewObstacle(
      sim, -blockWidth + 1.0f,
      static_cast<db::vb_single>(static_cast<double>(sim.opts.FieldHeight) * -0.1),
      blockWidth, blockHeight);
  sim.rightCompactor = db::NewObstacle(
      sim, sim.opts.FieldWidth - 1.0f,
      static_cast<db::vb_single>(static_cast<double>(sim.opts.FieldHeight) * -0.1),
      blockWidth, blockHeight);
  if (sim.leftCompactor > 0)
    sim.Obstacles[static_cast<std::size_t>(sim.leftCompactor)].vel.x =
        static_cast<db::vb_single>(sim.opts.shapeDriftRate * 0.1);
  if (sim.rightCompactor > 0)
    sim.Obstacles[static_cast<std::size_t>(sim.rightCompactor)].vel.x =
        static_cast<db::vb_single>(-(sim.opts.shapeDriftRate * 0.1));
  return sim.numObstacles - before;
}

// Obstacles.bas:158-181 — DrawSpiral: anillos concentricos rectangulares
// con la boca desplazada (4 muros por vuelta). Sin RNG.
DB_EXPORT int db_sim_maze_spiral(void* h, int corridor, int wall) {
  db::Sim& sim = S(h);
  const int before = sim.numObstacles;
  const db::vb_single FW = sim.opts.FieldWidth, FH = sim.opts.FieldHeight;
  const db::vb_single cw = static_cast<db::vb_single>(corridor);
  const db::vb_single wt = static_cast<db::vb_single>(wall);
  const int numOfHorzLines =
      static_cast<int>(db::vb_round64(static_cast<double>(
          FH / static_cast<db::vb_single>(corridor + wall)))) -
      1;
  const int numOfVertLines =
      static_cast<int>(db::vb_round64(static_cast<double>(
          FW / static_cast<db::vb_single>(corridor + wall)))) -
      1;
  int numOfLines =
      numOfHorzLines < numOfVertLines ? numOfHorzLines : numOfVertLines;
  if ((numOfLines % 2) != 0) numOfLines = numOfLines - 1;
  for (int i = 1; i <= numOfLines / 2; ++i) {
    const db::vb_single fi = static_cast<db::vb_single>(i);
    db::NewObstacle(sim, static_cast<db::vb_single>(i - 1) * cw, fi * cw,
                    FW - cw * static_cast<db::vb_single>(2 * (i - 1) + 1), wt);
    db::NewObstacle(
        sim, fi * cw, FH - cw * fi,
        static_cast<db::vb_single>(
            static_cast<double>(FW) -
            (static_cast<double>(cw) * 2.0 * static_cast<double>(fi) -
             static_cast<double>(wt))),
        wt);
    db::NewObstacle(sim, FW - cw * fi, fi * cw, wt,
                    FH - cw * static_cast<db::vb_single>(2 * i));
    db::NewObstacle(sim, fi * cw, static_cast<db::vb_single>(i + 1) * cw, wt,
                    FH - cw * static_cast<db::vb_single>(2 * i + 1));
  }
  return sim.numObstacles - before;
}

// Teleport.bas:146-155 — DeleteTeleporter: desplaza el resto una posicion;
// el ultimo slot conserva sus datos con exist = False, como el original. El
// guard de rango es de capa host (el original delegaba en el llamador).
DB_EXPORT void db_sim_delete_teleporter(void* h, int i) {
  db::Sim& sim = S(h);
  if (sim.numTeleporters <= 0) return;
  if (i < 1 || i > sim.numTeleporters) return;
  for (int x = i + 1; x <= sim.numTeleporters; ++x)
    sim.Teleporters[static_cast<std::size_t>(x) - 1] =
        sim.Teleporters[static_cast<std::size_t>(x)];
  sim.Teleporters[static_cast<std::size_t>(sim.numTeleporters)].exist = false;
  sim.numTeleporters -= 1;
}

// Teleport.bas:137-145 — DeleteAllTeleporters.
DB_EXPORT void db_sim_delete_all_teleporters(void* h) {
  db::Sim& sim = S(h);
  for (int i = 1; i <= sim.numTeleporters; ++i)
    sim.Teleporters[static_cast<std::size_t>(i)].exist = false;
  sim.numTeleporters = 0;
}

// Teleport.bas:60-105 — NewTeleporter(PortIn, PortOut, Height, Internet) +
// TeleportForm.OKButton_Click (:415-465), transcrito. `height` es el valor
// del slider de tamano (100..1000, default 300, :245-246 y :378-379): el
// Change del slider lo copia tambien a teleporterDefaultWidth (:470-472), el
// ancho con que NewTeleporter sortea la posicion con el MISMO flujo RNG
// (Random dos veces, RV-36). Width = Height * aspectRatio, color vbWhite,
// drift en ambos ejes. `local_` es el modo local del form (entrada+salida
// con ReSpawn en la misma sim). Sondeo del inbox: CInt(val Mod 32000) y
// PollCountDown = BotsPerPoll (:459-461). Devuelve el indice o -1 con el
// tope de 10.
DB_EXPORT int db_sim_add_teleporter(void* h, int portIn, int portOut,
                                    float height, int internet, int local_,
                                    int teleVeggies, int teleCorpses,
                                    int botsPerPoll, int pollCycles) {
  db::Sim& sim = S(h);
  if (sim.numTeleporters + 1 > db::MAXTELEPORTERS) return -1;
  sim.numTeleporters += 1;
  db::Teleporter& t =
      sim.Teleporters[static_cast<std::size_t>(sim.numTeleporters)];
  // E7: como en db_sim_im_enable, NewTeleporter + OKButton_Click no
  // reinician el slot (highlight/center/BackFlowLimit sobreviven).
  t.outbox.clear();
  t.inbox.clear();
  t.vel = {0.0f, 0.0f};   // Teleport.bas:79
  t.NumTeleported = 0;
  t.NumTeleportedIn = 0;
  t.RespectShapes = false;  // RespectShapesCheck default 0 (TeleportForm:386)
  t.teleportHeterotrophs = true;  // TeleportForm.frm:385
  t.exist = true;
  const db::vb_single aspectRatio = static_cast<db::vb_single>(
      static_cast<double>(sim.opts.FieldHeight) /
      static_cast<double>(sim.opts.FieldWidth));
  // teleporterDefaultWidth (Integer) = valor del slider.
  const db::vb_integer tdw = db::vb_cint(static_cast<double>(height));
  t.pos.x = static_cast<db::vb_single>(db::Random(
      0.0,
      static_cast<double>(sim.opts.FieldWidth) -
          static_cast<double>(static_cast<db::vb_single>(tdw * aspectRatio)),
      *sim.rndy));
  t.pos.y = static_cast<db::vb_single>(db::Random(
      0.0, static_cast<double>(sim.opts.FieldHeight) - tdw, *sim.rndy));
  t.Width = static_cast<db::vb_single>(tdw) * aspectRatio;
  t.Height = static_cast<db::vb_single>(tdw);
  t.color = 0xFFFFFF;  // vbWhite
  t.In = portIn != 0;
  t.Out = portOut != 0;
  t.Internet = internet != 0;
  t.local = local_ != 0;
  t.driftHorizontal = true;
  t.driftVertical = true;
  t.teleportVeggies = teleVeggies != 0;
  t.teleportCorpses = teleCorpses != 0;
  t.InboundPollCycles = static_cast<db::vb_integer>(pollCycles % 32000);
  t.BotsPerPoll = static_cast<db::vb_integer>(botsPerPoll % 32000);
  t.PollCountDown = t.BotsPerPoll;
  // center la publica MoveTeleporter en el paso 18 del proximo tick.
  return sim.numTeleporters;
}

// E/S de los buferes de teleporter (el host mueve los "archivos" .dbo):
DB_EXPORT int db_sim_tp_outbox_count(void* h, int t) {
  db::Sim& sim = S(h);
  if (t < 1 || t > sim.numTeleporters) return 0;
  return static_cast<int>(
      sim.Teleporters[static_cast<std::size_t>(t)].outbox.size());
}

// Saca el registro mas viejo del outbox del teleporter t (o nullptr).
DB_EXPORT unsigned char* db_sim_tp_outbox_take(void* h, int t, int* out_len) {
  db::Sim& sim = S(h);
  if (out_len) *out_len = 0;
  if (t < 1 || t > sim.numTeleporters) return nullptr;
  auto& box = sim.Teleporters[static_cast<std::size_t>(t)].outbox;
  if (box.empty()) return nullptr;
  unsigned char* p = CopyOut(box.front().data(), box.front().size(), out_len);
  box.erase(box.begin());
  return p;
}

DB_EXPORT void db_sim_tp_inbox_push(void* h, int t, const unsigned char* data,
                                    int len) {
  db::Sim& sim = S(h);
  if (t < 1 || t > sim.numTeleporters || !data || len <= 0) return;
  sim.Teleporters[static_cast<std::size_t>(t)].inbox.emplace_back(
      data, data + len);
}

// E7 — ronda nueva (StartAnotherRound): el original sigue en el mismo
// proceso y StartSimul NO toca Teleporters() (solo LoadSimulation los
// reinicia, HDRoutines.bas:1332); el port reconstruye la ronda en un handle
// nuevo, asi que la capa host copia cada teleporter tal cual (posicion,
// deriva, contadores, buzones) sin consumir RNG. Devuelve el indice nuevo
// o -1.
DB_EXPORT int db_sim_tp_copy(void* dst, void* src, int i) {
  db::Sim& d = S(dst);
  const db::Sim& o = S(src);
  if (i < 1 || i > o.numTeleporters) return -1;
  if (d.numTeleporters + 1 > db::MAXTELEPORTERS) return -1;
  d.numTeleporters += 1;
  d.Teleporters[static_cast<std::size_t>(d.numTeleporters)] =
      o.Teleporters[static_cast<std::size_t>(i)];
  return d.numTeleporters;
}

// PP-03 — las formas de la ronda/sim nueva (spec/PROGRESO.md, fila PP-03).
// En el original Obstacles() es un array global fijo y xObstacle() una copia
// global de proceso en coordenadas relativas al campo: la captura
// OptionsForm.ObsRepop (OptionsForm.frm:4550-4563) cada vez que se activa el
// dialogo de opciones con la sim visible (:4546), y StartSimul la vuelve a
// crear escalada al campo de la sim que arranca (main.frm:1357-1365) — en
// cada StartSimul, es decir en sim nueva Y en ronda nueva. El port arma cada
// sim en un handle nuevo: xObstacle vive aqui (global del modulo, como
// Sim::fmt) y el array de formas se traspasa con db_sim_obs_carry.
// Arranca vacia, como el ReDim xObstacle(0) de PaintObstacles (:4580)
// (el original la cargaba ademas del .set de settings; el port no tiene).
namespace {
std::vector<db::Obstacle> g_xObstacle;
}

// OptionsForm.frm:4550-4563 — ObsRepop (el worker la llama en "Nueva sim" y
// en cada cambio del panel de opciones: los dos pasan por activar
// OptionsForm): copia el array entero (tambien los
// registros apagados, como `xObstacle = Obstacles.Obstacles`) y pasa a
// fraccion del campo los que existen (Single / Single en el port: mismo
// resultado que el Double de VB6 asignado a Single).
DB_EXPORT void db_sim_obs_repop(void* h) {
  const db::Sim& sim = S(h);
  g_xObstacle = sim.Obstacles;
  for (std::size_t o = 1; o < g_xObstacle.size(); ++o) {
    db::Obstacle& x = g_xObstacle[o];
    if (!x.exist) continue;
    x.pos.x = x.pos.x / sim.opts.FieldWidth;
    x.pos.y = x.pos.y / sim.opts.FieldHeight;
    x.Width = x.Width / sim.opts.FieldWidth;
    x.Height = x.Height / sim.opts.FieldHeight;
  }
}

// Formas guardadas en xObstacle (las que existen), para el host y el smoke.
DB_EXPORT int db_xobs_count() {
  int n = 0;
  for (std::size_t o = 1; o < g_xObstacle.size(); ++o)
    if (g_xObstacle[o].exist) ++n;
  return n;
}

// StartSimul sobre el array global (main.frm:1313-1316): apaga los 1000
// registros (exist = False) y numObstacles = 0, pero el resto de cada
// registro sobrevive. leftCompactor/rightCompactor (Obstacles.bas:42-43) son
// globales que nada reinicia: siguen apuntando a los mismos indices, que tras
// la regeneracion son las formas re-creadas en ese orden (o registros
// apagados). El handle nuevo recibe el array viejo asi, sin RNG.
DB_EXPORT void db_sim_obs_carry(void* dst, void* src) {
  db::Sim& d = S(dst);
  const db::Sim& o = S(src);
  d.Obstacles = o.Obstacles;
  for (auto& r : d.Obstacles) r.exist = false;
  d.numObstacles = 0;
  d.leftCompactor = o.leftCompactor;
  d.rightCompactor = o.rightCompactor;
  // TrashCompactorMove indexa sin chequear: el array fijo del original
  // siempre tenia esos registros.
  const int top = std::max(d.leftCompactor, d.rightCompactor);
  if (top >= static_cast<int>(d.Obstacles.size()))
    d.Obstacles.resize(static_cast<std::size_t>(top) + 1);
}

// main.frm:1357-1365 — la regeneracion de formas de StartSimul (despues de
// loadrobs y FindSpecies): NewObstacle escalado al campo actual y despues
// color y vel de xObstacle. En el original NewObstacle sortea el color con
// `Rnd * 65536 + Rnd * 255 + Rnd` (Obstacles.bas:201; 3 extracciones salvo
// makeAllShapesBlack) aunque aqui el color se pise. No se replican: son Rnd
// crudo de arranque, la misma clase que el port ya omite por decision
// (colores de las formas de E3, B7-5/Q01; y en el preludio de StartSimul la
// skin de la sim, SunOnRnd y SimGUID, main.frm:1210-1236). Con esas
// omisiones el LCG del arranque ya no va a la par del original; replicar
// solo estas 3 no lo alinearia. Devuelve cuantas formas creo.
DB_EXPORT int db_sim_obs_regen(void* h) {
  db::Sim& sim = S(h);
  int made = 0;
  for (std::size_t o = 1; o < g_xObstacle.size(); ++o) {
    const db::Obstacle& x = g_xObstacle[o];
    if (!x.exist) continue;
    const int oo = db::NewObstacle(sim, x.pos.x * sim.opts.FieldWidth,
                                   x.pos.y * sim.opts.FieldHeight,
                                   x.Width * sim.opts.FieldWidth,
                                   x.Height * sim.opts.FieldHeight);
    // oo = -1 solo con mas de 1000 formas guardadas (un .set editado): en
    // el original, error 9 en Obstacles(-1) dentro de StartSimul.
    // Inalcanzable aqui (xObstacle sale de un array de a lo sumo 1000).
    if (oo < 1) continue;
    sim.Obstacles[static_cast<std::size_t>(oo)].color = x.color;
    sim.Obstacles[static_cast<std::size_t>(oo)].vel = x.vel;
    ++made;
  }
  return made;
}

// Campos sueltos de un teleporter (1..numTeleporters), para la capa host:
// 0 In, 1 Out, 2 local, 3 Internet, 4 teleportVeggies, 5 teleportCorpses,
// 6 teleportHeterotrophs, 7 RespectShapes, 8 InboundPollCycles,
// 9 BotsPerPoll, 10 PollCountDown, 11 NumTeleported, 12 NumTeleportedIn,
// 13 registros en el inbox (solo lectura), 14 driftHorizontal,
// 15 driftVertical. E7: el form de TeleportForm.frm:455 fija
// teleportHeterotrophs, que db_sim_add_teleporter no recibe.
DB_EXPORT double db_sim_tp_get(void* h, int t, int field) {
  db::Sim& sim = S(h);
  if (t < 1 || t > sim.numTeleporters) return 0;
  const db::Teleporter& tp = sim.Teleporters[static_cast<std::size_t>(t)];
  switch (field) {
    case 0: return tp.In;
    case 1: return tp.Out;
    case 2: return tp.local;
    case 3: return tp.Internet;
    case 4: return tp.teleportVeggies;
    case 5: return tp.teleportCorpses;
    case 6: return tp.teleportHeterotrophs;
    case 7: return tp.RespectShapes;
    case 8: return tp.InboundPollCycles;
    case 9: return tp.BotsPerPoll;
    case 10: return tp.PollCountDown;
    case 11: return static_cast<double>(tp.NumTeleported);
    case 12: return static_cast<double>(tp.NumTeleportedIn);
    case 13: return static_cast<double>(tp.inbox.size());
    case 14: return tp.driftHorizontal;
    case 15: return tp.driftVertical;
    default: return 0;
  }
}

DB_EXPORT void db_sim_tp_set(void* h, int t, int field, double v) {
  db::Sim& sim = S(h);
  if (t < 1 || t > sim.numTeleporters) return;
  db::Teleporter& tp = sim.Teleporters[static_cast<std::size_t>(t)];
  const bool b = v != 0.0;
  const auto i16 = static_cast<db::vb_integer>(
      v < -32768.0 ? -32768.0 : (v > 32767.0 ? 32767.0 : v));
  switch (field) {
    case 0: tp.In = b; break;
    case 1: tp.Out = b; break;
    case 2: tp.local = b; break;
    case 3: tp.Internet = b; break;
    case 4: tp.teleportVeggies = b; break;
    case 5: tp.teleportCorpses = b; break;
    case 6: tp.teleportHeterotrophs = b; break;
    case 7: tp.RespectShapes = b; break;
    case 8: tp.InboundPollCycles = i16; break;
    case 9: tp.BotsPerPoll = i16; break;
    case 10: tp.PollCountDown = i16; break;
    case 14: tp.driftHorizontal = b; break;
    case 15: tp.driftVertical = b; break;
    default: break;
  }
}

// ---------------------------------------------------------------------------
// E7 — Internet Mode (spec/PLAN-EXTENSIONES.md §E7). Capa host: el "cliente
// IM" (web/imnet.js, en el worker) mueve los .dbo del outbox/inbox del
// teleporter Internet entre navegadores; aqui viven las transcripciones de
// la parte que corria en el EXE — el toggle F1Internet_Click
// (MDIForm1.frm:1259-1380) y writeIMdata (main.frm:3113-3181) — y el
// apodo IntOpts.IName, que el tick estampa como LastOwner (Sim::fmt, E7-01).
// ---------------------------------------------------------------------------

// IntOpts.IName (provvisorio.bas:5). Global de proceso: la capa host lo
// vuelve a fijar tras cada reset/carga (Sim::fmt no se persiste).
DB_EXPORT void db_sim_set_iname(void* h, const char* name) {
  S(h).fmt.IName = name ? name : "";
}
DB_EXPORT char* db_sim_get_iname(void* h) {
  const std::string& v = S(h).fmt.IName;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(v.c_str()), v.size() + 1,
      nullptr));
}

// strSimStart (Globals.bas:150): main.frm:1351 lo fija al arrancar una sim
// nueva con Replace(Replace(Now, ":", "-"), "/", "-"); lo persiste el
// formato de sim (HDRoutines.bas:796). `Now` es del reloj del host: la
// pagina manda el texto ya armado.
DB_EXPORT void db_sim_set_sim_start(void* h, const char* s) {
  S(h).evo.strSimStart = s ? s : "";
}

// MDIForm1.frm:1259-1358 — F1Internet_Click, rama de encendido. Devuelve el
// indice del teleporter Internet nuevo, o:
//   -100 - x_restartmode  si el modo de reinicio lo prohibe (:1264-1296;
//                         4/5 solo con y_eco_im = 0, siempre en el port)
//   -1                    tope de 10 teleporters (NewTeleporter = -1: el
//                         original seguia con Teleporters(-1) y caia en
//                         error 9 fuera del tick; aqui no se toca nada)
// `defaultWidth` es el global de proceso teleporterDefaultWidth
// (Teleport.bas:56): 0 hasta que se abre TeleportForm (:378 lo pone en 300)
// y entra al sorteo de la posicion. Consumo de RNG: 1 Random si el apodo
// esta vacio ("Newbie " & Random(1, 10000), :1310-1312) + los 2 de
// NewTeleporter. El lblSafeMode de :1260 no existe en el port.
DB_EXPORT int db_sim_im_enable(void* h, int defaultWidth) {
  db::Sim& sim = S(h);
  const int mode = sim.x_restartmode;
  if (mode >= 1 && mode <= 10) return -100 - mode;

  if (sim.fmt.IName.empty())
    sim.fmt.IName =
        "Newbie " + std::to_string(db::RandomI(1, 10000, *sim.rndy));

  // NewTeleporter(False, False, (SimOpts.FieldHeight ^ 0.5) * 10, True)
  if (sim.numTeleporters + 1 > db::MAXTELEPORTERS) return -1;
  sim.numTeleporters += 1;
  const int i = sim.numTeleporters;
  db::Teleporter& t = sim.Teleporters[static_cast<std::size_t>(i)];
  // NewTeleporter asigna SOLO sus campos: lo demas del slot sobrevive del
  // teleporter que lo ocupo antes (DeleteTeleporter solo baja .exist,
  // Teleport.bas:153). Replicado: un `local` viejo convierte al puerto
  // Internet en expulsor permanente (Teleport.bas:164). Los buzones son del
  // port (sustituyen a la carpeta, que era propia de cada teleporter).
  t.outbox.clear();
  t.inbox.clear();
  t.exist = true;
  const db::vb_single aspectRatio = static_cast<db::vb_single>(
      static_cast<double>(sim.opts.FieldHeight) /
      static_cast<double>(sim.opts.FieldWidth));
  const double w = static_cast<double>(static_cast<db::vb_integer>(defaultWidth));
  t.pos.x = static_cast<db::vb_single>(db::Random(
      0.0,
      static_cast<double>(sim.opts.FieldWidth) -
          static_cast<double>(static_cast<db::vb_single>(w * aspectRatio)),
      *sim.rndy));
  t.pos.y = static_cast<db::vb_single>(
      db::Random(0.0, static_cast<double>(sim.opts.FieldHeight) - w,
                 *sim.rndy));
  const db::vb_single height = static_cast<db::vb_single>(
      std::pow(static_cast<double>(sim.opts.FieldHeight), 0.5) * 10.0);
  t.Width = height * aspectRatio;
  t.Height = height;
  t.color = 0xFFFFFF;  // vbWhite
  t.In = false;
  t.Out = false;
  t.Internet = true;
  t.driftHorizontal = true;
  t.driftVertical = true;
  t.NumTeleported = 0;
  t.NumTeleportedIn = 0;
  // :1326-1334 — propiedades del puerto Internet.
  t.vel = {0.0f, 0.0f};
  t.teleportVeggies = true;
  t.teleportCorpses = false;
  t.teleportHeterotrophs = true;
  t.RespectShapes = false;
  t.InboundPollCycles = 10;
  t.BotsPerPoll = 10;
  t.PollCountDown = 10;
  return i;
}

// MDIForm1.frm:1359-1372 — rama de apagado: borra los teleporters Internet
// con el bucle literal (hasta MAXTELEPORTERS, re-mirando el indice tras
// cada DeleteTeleporter). CloseWindow(pid) es del cliente IM (host).
// Devuelve cuantos borro.
DB_EXPORT int db_sim_im_disable(void* h) {
  db::Sim& sim = S(h);
  int deleted = 0;
  for (int i = 1; i <= db::MAXTELEPORTERS; ++i) {
    const db::Teleporter& tp = sim.Teleporters[static_cast<std::size_t>(i)];
    if (tp.Internet && tp.exist) {
      if (sim.numTeleporters <= 0) break;  // DeleteTeleporter sale sin tocar
      for (int x = i + 1; x <= sim.numTeleporters; ++x)
        sim.Teleporters[static_cast<std::size_t>(x) - 1] =
            sim.Teleporters[static_cast<std::size_t>(x)];
      sim.Teleporters[static_cast<std::size_t>(sim.numTeleporters)].exist =
          false;
      sim.numTeleporters -= 1;
      deleted += 1;
      i -= 1;
    }
  }
  return deleted;
}

}  // extern "C" (los helpers de IMgetname son C++ con enlace normal)

namespace {

// stringops.bas:35-50 — extractexactname: "Corpse" tal cual; si no, todo
// menos el ultimo tramo separado por "." (sin punto => "").
std::string ExtractExactName(const std::string& name) {
  if (name == "Corpse") return "Corpse";
  std::vector<std::string> sp(1);
  for (char c : name) {
    if (c == '.') sp.emplace_back();
    else sp.back() += c;
  }
  std::string t;
  const int ub = static_cast<int>(sp.size()) - 1;
  for (int i = 0; i <= ub - 1; ++i) {
    t += sp[static_cast<std::size_t>(i)];
    if (i != ub - 1) t += '.';
  }
  return t;
}

// VB6 Trim: solo espacios.
std::string VbTrim(const std::string& s) {
  std::size_t a = 0, b = s.size();
  while (a < b && s[a] == ' ') ++a;
  while (b > a && s[b - 1] == ' ') --b;
  return s.substr(a, b - a);
}

// Tag de 50 como String * 50 (los fijos de VB6 nacen con Chr(0)).
std::string Fixed50(const std::string& s) {
  std::string t = s.substr(0, std::min<std::size_t>(s.size(), 50));
  t.resize(50, '\0');
  return t;
}

// main.frm:3113-3124 — IMgetname.
std::string IMgetname(const db::Sim& sim, int i) {
  const db::Bot& b = sim.rob[static_cast<std::size_t>(i)];
  const std::string tag45 = Fixed50(b.tag).substr(0, 45);
  std::string name = ExtractExactName(b.FName);
  if (sim.fmt.y_eco_im > 0) name += "(" + VbTrim(tag45) + ")";
  if (tag45 == std::string(45, '\0')) name = ExtractExactName(b.FName);
  std::string out;
  for (char c : name)
    if (c != '[' && c != ']' && c != '{' && c != '}' && c != ',') out += c;
  return out;
}

}  // namespace

extern "C" {

// main.frm:3126-3181 — writeIMdata. Devuelve "<archivo>\n<json>": el
// nombre es el del original (TotRunCycle & UserSeedNumber & ".stats") y el
// JSON sale byte a byte como lo armaba el fuente, sin escapar comillas en
// los nombres (el fuente tampoco). El loop lo llama cada 200 ciclos con
// InternetMode.Visible (main.frm:2109-2111); ese gate es del host.
DB_EXPORT char* db_sim_im_stats(void* h) {
  const db::Sim& sim = S(h);
  struct IMbots { std::string Name; bool vegy = false; int pop = 0; };
  std::vector<IMbots> simpop(1);  // ReDim simpopulations(0), base 1
  auto L = [](double v) { return std::to_string(static_cast<long long>(v)); };

  std::string simdata = "{\"cycle\":" + L(sim.opts.TotRunCycle) +
                        ",\"simId\":\"" + sim.evo.strSimStart +
                        "\",\"width\":" + L(sim.opts.FieldWidth) +
                        ",\"height\":" + L(sim.opts.FieldHeight) +
                        ",\"population\":[";
  // calculate species (orden de primera aparicion por slot)
  for (int i = 1; i <= sim.MaxRobs; ++i) {
    const db::Bot& b = sim.rob[static_cast<std::size_t>(i)];
    if (!b.exist) continue;
    const std::string nm = IMgetname(sim, i);
    bool hit = false;
    for (std::size_t k = 1; k < simpop.size(); ++k)
      if (simpop[k].Name == nm && simpop[k].vegy == b.Veg) { hit = true; break; }
    if (!hit) simpop.push_back({nm, b.Veg, 0});
  }
  // calculate populations
  for (int i = 1; i <= sim.MaxRobs; ++i) {
    const db::Bot& b = sim.rob[static_cast<std::size_t>(i)];
    if (!b.exist) continue;
    const std::string nm = IMgetname(sim, i);
    for (std::size_t k = 1; k < simpop.size(); ++k)
      if (simpop[k].Name == nm && simpop[k].vegy == b.Veg) simpop[k].pop += 1;
  }
  for (std::size_t k = 1; k < simpop.size(); ++k) {
    simdata += "{\"botName\":\"" + simpop[k].Name + "\",\"count\":" +
               std::to_string(simpop[k].pop) +
               (simpop[k].vegy ? ",\"repopulating\":true" : "") + "}";
    if (k < simpop.size() - 1) simdata += ",";
  }
  simdata += "]}";
  simdata += "\r\n";  // Print #299 termina la linea con vbCrLf

  const std::string file = L(sim.opts.TotRunCycle) +
                           L(sim.opts.UserSeedNumber) + ".stats";
  const std::string out = file + "\n" + simdata;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(out.c_str()), out.size() + 1,
      nullptr));
}

// Especies de la sim con color (el esquema de SaveSimPopulation,
// HDRoutines.bas:445-490 — muerto en el original, pero es el formato que
// "aggregating the population stats from multiple connected sims" pensaba
// usar). Una linea por especie con poblacion > 0:
//   nombre \t poblacion \t Veg(0/1) \t color
// Alimenta InternetSpecies (provvisorio.bas:21) en los pares.
DB_EXPORT char* db_sim_im_species(void* h) {
  const db::Sim& sim = S(h);
  std::string out;
  for (const auto& sp : sim.Specie) {
    if (sp.population <= 0) continue;
    out += sp.Name + "\t" + std::to_string(sp.population) + "\t" +
           (sp.Veg ? "1" : "0") + "\t" + std::to_string(sp.color) + "\n";
  }
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(out.c_str()), out.size() + 1,
      nullptr));
}

// Lectura de un registro .dbo SIN tocar ninguna sim del usuario: se carga
// con el lector real del core (LoadOrganism, sin recolocar: X = Y = -1, 0
// RNG) en una sim desechable. Devuelve
//   cnum \t FName \t LastOwner \t Veg \t color \t nrg \t generation
// de la primera celula, o "" si el registro no carga. Solo para los avisos
// de llegada/salida de la capa host.
DB_EXPORT char* db_dbo_peek(const unsigned char* data, int len) {
  std::string out;
  if (data && len > 2) {
    // Una sola sim desechable, vaciada tras cada lectura (crear un Sim por
    // registro cuesta megas de heap a velocidad max).
    static std::unique_ptr<SimHandle> scratch;
    if (!scratch) scratch = std::make_unique<SimHandle>();
    db::VbBinFile f;
    f.data.assign(data, data + len);
    const db::vb_integer cnum = f.get_i16();
    f.pos = 0;
    const int last = db::LoadOrganism(scratch->sim, f, -1.0f, -1.0f);
    if (last > 0) {
      const db::Bot* b = nullptr;
      for (int t = 1; t <= scratch->sim.MaxRobs; ++t)
        if (scratch->sim.rob[static_cast<std::size_t>(t)].exist) {
          b = &scratch->sim.rob[static_cast<std::size_t>(t)];
          break;
        }
      if (b) {
        char nrg[32];
        std::snprintf(nrg, sizeof nrg, "%.7g", static_cast<double>(b->nrg));
        out = std::to_string(cnum) + "\t" + b->FName + "\t" + b->LastOwner +
              "\t" + (b->Veg ? "1" : "0") + "\t" + std::to_string(b->color) +
              "\t" + nrg + "\t" + std::to_string(b->generation);
      }
    }
    for (int t = 1; t <= scratch->sim.MaxRobs; ++t)
      scratch->sim.rob[static_cast<std::size_t>(t)].exist = false;
    scratch->sim.MaxRobs = 0;
    scratch->sim.Specie.clear();
  }
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(out.c_str()), out.size() + 1,
      nullptr));
}

// ---------------------------------------------------------------------------
// Formatos (E/S sobre buferes en memoria; el host decide que hacer con ellos)
// ---------------------------------------------------------------------------

DB_EXPORT void db_free(void* p) { std::free(p); }

// SaveSimulation al formato binario de sim. Devuelve un bufer malloc'd
// (liberar con db_free) y su longitud en *out_len.
// E7: con los globales de proceso (Sim::fmt + sunbelt), y el cartel
// lblSaving visible como durante el guardado del original
// (HDRoutines.bas:541): SaveRobotBody escribe el sunbelt real y respeta
// SaveWithoutMutations.
DB_EXPORT unsigned char* db_sim_save(void* h, int* out_len) {
  db::VbBinFile f;
  db::FormatGlobals g = db::TickFormatGlobals(S(h));
  g.lblSaving_visible = true;
  db::SaveSimulation(S(h), f, g);
  return CopyOut(f.data.data(), f.data.size(), out_len);
}

// LoadSimulation desde un bufer. Resetea la sim del handle y despues aplica
// el post-carga de startloaded (main.frm:1374-1515): divisores,
// Init_Buckets, `Rnd -1 : Randomize UserSeedNumber / 100` (incondicional en
// el original) y la deuda de la repoblacion con los contadores del primer
// ciclo (main.frm:1507-1510, RV-33). Decision de host: la semilla es la del
// archivo; el original usaba tmpseed (Timer * 100 con chseedloadsim, o la
// de la sesion anterior, MDIForm1.frm:2093-2094 y main.frm:1377-1380).
DB_EXPORT void db_sim_load(void* h, const unsigned char* data, int len) {
  auto& Sh = H(h);
  // PP-03 (revision): Obstacles() y leftCompactor/rightCompactor son
  // globales del original; LoadSimulation solo pone numObstacles = 0 y
  // reescribe 1..n (HDRoutines.bas:1347-1352) y startloaded tiene comentado
  // el apagado (main.frm:1471-1473): los registros por encima de n conservan
  // su exist (invisibles: todo recorre 1..numObstacles, pero ObsRepop los
  // ve) y los indices del compactador siguen. El loader del port solo
  // agranda el vector.
  std::vector<db::Obstacle> obs = std::move(Sh.sim.Obstacles);
  const int lc = Sh.sim.leftCompactor, rc = Sh.sim.rightCompactor;
  db::Sim prev = std::move(Sh.sim);
  Sh.sim = db::Sim{};
  CarryProcessGlobals(Sh.sim, prev);  // RV-39
  if (!obs.empty()) Sh.sim.Obstacles = std::move(obs);
  Sh.sim.leftCompactor = lc;
  Sh.sim.rightCompactor = rc;
  Sh.wire();
  db::VbBinFile f;
  f.data.assign(data, data + (len > 0 ? len : 0));
  Sh.vis = SimHandle::Vis{};  // E6.5: los slots de antes no valen
  Sh.e8 = SimHandle::E8{};    // E8: el formato no persiste monitor ni OSkin
  db::LoadSimulation(Sh.sim, f);
  RecomputeDivisors(Sh.sim);
  db::InitBuckets(Sh.sim);
  Sh.rng.rnd_negative(-1.0f);
  Sh.rng.randomize(static_cast<double>(Sh.sim.opts.UserSeedNumber) / 100.0);
  db::Sim& sim = Sh.sim;
  sim.cooldown = -sim.opts.RepopCooldown;
  sim.totnvegsDisplayed = -1;
  sim.totvegs = -1;
  sim.totnvegs =
      static_cast<int>(db::vb_round64(sim.vm.costs.v[53]));  // DYNAMICCOSTTARGET
}

// SaveOrganism (.dbo) del organismo que contiene al bot `n` (celulas atadas
// incluidas). Bufer malloc'd; liberar con db_free.
DB_EXPORT unsigned char* db_sim_save_organism(void* h, int n, int* out_len) {
  db::Sim& sim = S(h);
  if (out_len) *out_len = 0;
  if (n < 1 || n > sim.MaxRobs || !sim.rob[n].exist) return nullptr;
  db::VbBinFile f;
  // E7: SaveOrganism estampa LastOwner = IntOpts.IName (HDRoutines.bas:232).
  db::SaveOrganism(sim, f, n, db::TickFormatGlobals(sim));
  return CopyOut(f.data.data(), f.data.size(), out_len);
}

// LoadOrganism (.dbo) en (x, y). Devuelve el slot de la ultima celula
// cargada o -1 (mismo contrato que el original).
DB_EXPORT int db_sim_load_organism(void* h, const unsigned char* data, int len,
                                   float x, float y) {
  if (!data || len <= 0) return -1;
  db::VbBinFile f;
  f.data.assign(data, data + len);
  return db::LoadOrganism(S(h), f, x, y);
}

// El bot `n` como texto de robot (SalvarobText: ADN detokenizado + gen
// epigenetico + metadatos '#). String malloc'd NUL-terminada; db_free.
DB_EXPORT char* db_sim_bot_text(void* h, int n) {
  db::Sim& sim = S(h);
  if (n < 1 || n > sim.MaxRobs || !sim.rob[n].exist) return nullptr;
  const std::string s = db::SalvarobText(sim, n);
  char* p = static_cast<char*>(std::malloc(s.size() + 1));
  if (p) std::memcpy(p, s.c_str(), s.size() + 1);
  return p;
}

// ---------------------------------------------------------------------------
// E5 - modos de juego: F1/rondas, eventos y Player Bot
// ---------------------------------------------------------------------------

// Arranque de contest: lo que StartSimul hace alrededor del core
// (OptionsForm.frm:4778 ContestMode = TmpOpts.F1; main.frm:1337-1340
// FindSpecies + F1count = 0 si ContestMode). Devuelve TotSpecies (0 si el
// modo no quedo activo).
DB_EXPORT int db_sim_f1_start(void* h) {
  db::Sim& sim = S(h);
  sim.f1.ContestMode = sim.opts.F1;
  if (sim.f1.ContestMode) {
    db::FindSpecies(sim);
    sim.f1.F1count = 0;
    // Adaptacion de host: con CERO especies de combate el original entraria
    // en un loop de rondas vacias (Countpop:364 con SpeciesLeft = 0); aqui
    // el contest no arranca hasta que haya censo.
    if (sim.f1.TotSpecies == 0) sim.f1.ContestMode = false;
    return sim.f1.TotSpecies;
  }
  return 0;
}

DB_EXPORT int db_sim_f1_contests(void* h) { return S(h).f1.Contests; }
DB_EXPORT int db_sim_f1_totspecies(void* h) { return S(h).f1.TotSpecies; }
DB_EXPORT int db_sim_f1_over(void* h) { return S(h).f1.Over ? 1 : 0; }
DB_EXPORT int db_sim_f1_pop(void* h, int i) {
  return (i >= 1 && i <= 20) ? S(h).f1.PopArray[i].population : 0;
}
DB_EXPORT int db_sim_f1_wins(void* h, int i) {
  return (i >= 1 && i <= 20) ? S(h).f1.PopArray[i].Wins : 0;
}
// Nombre (realname) del slot i de PopArray. String malloc'd; db_free.
DB_EXPORT char* db_sim_f1_name(void* h, int i) {
  if (i < 1 || i > 20) return nullptr;
  const std::string& s = S(h).f1.PopArray[i].SpName;
  char* p = static_cast<char*>(std::malloc(s.size() + 1));
  if (p) std::memcpy(p, s.c_str(), s.size() + 1);
  return p;
}
DB_EXPORT int db_sim_restarts_count(void* h) {
  return static_cast<int>(S(h).f1.ReStarts);
}

// El gate del loop del original (main.frm:2081 / OptionsForm:4805-4809):
// el host lo lee, arranca otra ronda y lo limpia.
DB_EXPORT int db_sim_start_another_round(void* h) {
  return S(h).StartAnotherRound ? 1 : 0;
}
DB_EXPORT void db_sim_clear_start_another_round(void* h) {
  S(h).StartAnotherRound = false;
}

// Restauracion del estado de modulo F1Mode entre rondas: en el original los
// globales del modulo sobreviven al restart del mundo (StartSimul no los
// toca; ResetContest solo corre con Contests = 0; FindSpecies preserva los
// Wins por SLOT). El host del port reconstruye la sim por ronda y repone
// esto antes de db_sim_f1_start.
DB_EXPORT void db_sim_f1_restore(void* h, int contests, int minrounds,
                                 int optminrounds, int over, int restarts) {
  db::Sim& sim = S(h);
  sim.f1.Contests = static_cast<db::vb_integer>(contests);
  sim.f1.MinRounds = static_cast<db::vb_integer>(minrounds);
  sim.f1.optMinRounds = static_cast<db::vb_integer>(optminrounds);
  sim.f1.Over = (over != 0);
  sim.f1.ReStarts = restarts;
}
DB_EXPORT void db_sim_f1_set_wins(void* h, int i, int wins) {
  if (i >= 1 && i <= 20)
    S(h).f1.PopArray[i].Wins = static_cast<db::vb_integer>(wins);
}

// Eventos del tick (GameEvents, sim.hpp): bitmask + ganador + lineas DQ.
// El host los lee y los limpia con db_sim_events_clear.
DB_EXPORT int db_sim_events(void* h) {
  const db::GameEvents& e = S(h).events;
  int m = 0;
  if (e.sim_stop_requested) m |= 1 << 0;
  if (e.evo_lost) m |= 1 << 1;
  if (e.evo_won) m |= 1 << 2;
  if (e.seed_round_done) m |= 1 << 3;
  if (e.zb_restart) m |= 1 << 4;
  if (e.zb_goodtest) m |= 1 << 5;
  if (e.zb_ready_for_test) m |= 1 << 6;
  if (e.zb_reset) m |= 1 << 7;
  if (e.zb_passed) m |= 1 << 8;
  if (e.zb_failed) m |= 1 << 9;
  if (e.f1_round_over) m |= 1 << 10;
  if (e.f1_single_species) m |= 1 << 11;
  if (e.f1_limits_disabled) m |= 1 << 12;
  if (!e.dq_log.empty()) m |= 1 << 13;
  return m;
}
DB_EXPORT char* db_sim_events_winner(void* h) {
  const std::string& s = S(h).events.f1_winner;
  char* p = static_cast<char*>(std::malloc(s.size() + 1));
  if (p) std::memcpy(p, s.c_str(), s.size() + 1);
  return p;
}
// Drena las lineas de Disqualifications.txt acumuladas (una por linea).
DB_EXPORT char* db_sim_events_dq(void* h) {
  db::GameEvents& e = S(h).events;
  std::string all;
  for (const std::string& line : e.dq_log) {
    all += line;
    all += '\n';
  }
  e.dq_log.clear();
  char* p = static_cast<char*>(std::malloc(all.size() + 1));
  if (p) std::memcpy(p, all.c_str(), all.size() + 1);
  return p;
}
DB_EXPORT void db_sim_events_clear(void* h) {
  db::GameEvents& e = S(h).events;
  std::vector<std::string> dq = std::move(e.dq_log);  // se drena aparte
  e = db::GameEvents{};
  e.dq_log = std::move(dq);
}

// Player Bot Mode (paso 13). El estado (raton, teclas) lo alimenta el host;
// el campo `key` (tecla fisica) de frmPBMode es mapeo de host y no viaja.
DB_EXPORT void db_sim_pb_on(void* h, int on) { S(h).pb.on = (on != 0); }
DB_EXPORT void db_sim_pb_mouse(void* h, float x, float y) {
  S(h).pb.Mouse_loc.x = x;
  S(h).pb.Mouse_loc.y = y;
}
DB_EXPORT void db_sim_pb_clear_keys(void* h) { S(h).pb.keys.clear(); }
DB_EXPORT int db_sim_pb_add_key(void* h, int memloc, int value, int invert) {
  S(h).pb.keys.push_back({static_cast<db::vb_integer>(memloc),
                          static_cast<db::vb_integer>(value), false,
                          invert != 0});
  return static_cast<int>(S(h).pb.keys.size()) - 1;
}
DB_EXPORT void db_sim_pb_key_active(void* h, int idx, int active) {
  auto& keys = S(h).pb.keys;
  if (idx >= 0 && idx < static_cast<int>(keys.size()))
    keys[static_cast<std::size_t>(idx)].Active = (active != 0);
}

// robfocus ahora vive en el core (lo consumen el paso 13 y KillRobot).
DB_EXPORT void db_sim_set_focus(void* h, int n) {
  S(h).robfocus = static_cast<db::vb_integer>(n);
}
DB_EXPORT int db_sim_get_focus(void* h) { return S(h).robfocus; }

}  // extern "C"

// ===========================================================================
// E6 — Registro y analisis (capa host)
//
// Todo lo de aqui es codigo de la UI del original transcrito, igual que los
// mazes de E3: `CalcStats`/`FeedGraph`/`NewGraph` viven en `main.frm` (el
// form) y el chart entero en `grafico.frm`. El core no se toca; lo unico que
// esta seccion hace es leer la sim y componer numeros/strings para JS.
//
// Excepcion documentada: `CalcStats` MUTA `rob(t).GenMut` y `rob(t).OldGD`
// al calcular la distancia genetica (main.frm:2836/2855). Es asi en el
// fuente — el grafico consume una "moneda" de mutaciones para no recalcular
// cada vez. Ningun sistema de la simulacion lee esos dos campos (solo
// `mutate` decrementa GenMut, NeoMutations.bas:224), asi que abrir el
// grafico no cambia la trayectoria de la sim; si cambia lo que un
// `SaveSimulation` posterior escriba (los dos campos se persisten).
//
// Decision de capa host: los "archivos" del original salen como descargas
// del navegador — el .snp/_Mutations.txt de los snapshots (Database.bas) y
// el .gsave del chart (grafico.frm:4089). El core nunca toca disco.
namespace {

// Globals.bas:127-151
enum {
  POPULATION_GRAPH = 1, MUTATIONS_GRAPH = 2, AVGAGE_GRAPH = 3,
  OFFSPRING_GRAPH = 4, ENERGY_GRAPH = 5, DNALENGTH_GRAPH = 6,
  DNACOND_GRAPH = 7, MUT_DNALENGTH_GRAPH = 8, ENERGY_SPECIES_GRAPH = 9,
  DYNAMICCOSTS_GRAPH = 10, SPECIESDIVERSITY_GRAPH = 11, AVGCHLR_GRAPH = 12,
  GENETIC_DIST_GRAPH = 13, GENERATION_DIST_GRAPH = 14,
  GENETIC_SIMPLE_GRAPH = 15, CUSTOM_1_GRAPH = 16, CUSTOM_2_GRAPH = 17,
  CUSTOM_3_GRAPH = 18, NUMGRAPHS = 18
};
constexpr int kMaxSpecies = 500;        // SimOptions.bas:46 MAXSPECIES
constexpr int kMaxNativeSpecies = 76;   // SimOptions.bas:47

// VB6 Round(v, digits): redondeo bancario a `digits` decimales.
double vb_round_dec(double v, int digits) {
  double f = 1.0;
  for (int i = 0; i < digits; ++i) f *= 10.0;
  return static_cast<double>(db::vb_round64(v * f)) / f;
}

// Flex.bas:28-40 — Position: busca la clave o el primer hueco y la fija.
// Con el array lleno (k = u) y clave distinta devuelve 0: dati(0, *) hace de
// sumidero, como en el original.
int FlexPosition(const std::string& key, std::vector<std::string>& keys) {
  const int u = kMaxSpecies;  // UBound(nomi)
  int k = 1;
  while (keys[static_cast<std::size_t>(k)] != key &&
         !keys[static_cast<std::size_t>(k)].empty() && k < u)
    k += 1;
  if (keys[static_cast<std::size_t>(k)] == key || k < u) {
    keys[static_cast<std::size_t>(k)] = key;
    return k;
  }
  return 0;
}

// Flex.bas:64-76 — last: el ultimo indice ocupado, con tope
// MAXNATIVESPECIES (76) aunque el array tenga 500.
int FlexLast(const std::vector<std::string>& keys) {
  int k = 1;
  while (!keys[static_cast<std::size_t>(k)].empty()) {
    k += 1;
    if (k > kMaxNativeSpecies) return k - 1;
  }
  return k - 1;
}

// main.frm:3040-3074 — score, los tipos que el core no tiene (el 0 es
// score0 de gamemodes.hpp). Tipo 4: la profundidad maxima de la
// descendencia (FindGenerationalDistance, main.frm:2965-2969). Tipo 1:
// marca la familia con highlight (menu Robot -> parentele).
void ScoreDepth(const db::Sim& sim, int r, int reclev, int maxrec,
                int& p_reclev) {
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist && sim.rob[t].parent == sim.rob[r].AbsNum) {
      if (reclev < maxrec) ScoreDepth(sim, t, reclev + 1, maxrec, p_reclev);
      if (reclev > p_reclev) p_reclev = reclev;
    }
  }
}
void ScoreHighlight(db::Sim& sim, int r, int reclev, int maxrec) {
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist && sim.rob[t].parent == sim.rob[r].AbsNum) {
      if (reclev < maxrec) ScoreHighlight(sim, t, reclev + 1, maxrec);
      sim.rob[t].highlight = true;
    }
  }
}

// main.frm:2277-2367 — la pila de los graficos custom. Doubles con topes de
// 2e9 por operador (el autor los puso para frenar overflows de VB6).
struct QStack {
  double val[102] = {0};
  int pos = 0;
  void push(double v) {
    if (pos >= 101) {  // el proximo push desborda
      for (int a = 0; a <= 99; ++a) val[a] = val[a + 1];
      val[100] = 0;
      pos = 100;
    }
    val[pos] = v;
    pos += 1;
  }
  double pop() {
    pos -= 1;
    if (pos == -1) { pos = 0; val[0] = 0; }
    return val[pos];
  }
  void clear() { pos = 0; val[0] = 0; }
  static double sgn(double v) { return v > 0 ? 1.0 : (v < 0 ? -1.0 : 0.0); }
  void qadd() {
    double b = pop(), a = pop();
    if (a > 2e9) a = std::fmod(a, 2e9);
    if (b > 2e9) b = std::fmod(b, 2e9);
    double c = a + b;
    if (std::fabs(c) > 2e9) c -= sgn(c) * 2e9;
    push(c);
  }
  void qsub() {
    double b = pop(), a = pop();
    if (a > 2e9) a = std::fmod(a, 2e9);
    if (b > 2e9) b = std::fmod(b, 2e9);
    double c = a - b;
    if (std::fabs(c) > 2e9) c -= sgn(c) * 2e9;
    push(c);
  }
  void qmult() {
    double b = pop(), a = pop(), c = a * b;
    if (std::fabs(c) > 2e9) c = sgn(c) * 2e9;
    push(c);
  }
  void qdiv() {
    double b = pop(), a = pop();
    push(b != 0 ? a / b : 0.0);
  }
  void qpow() {
    double b = pop(), a = pop(), c;
    if (std::fabs(b) > 10) b = 10 * sgn(b);
    c = (a == 0) ? 0 : std::pow(a, b);
    if (std::fabs(c) > 2e9) c = sgn(c) * 2e9;
    push(c);
  }
};

// VB6 Val(): valor numerico del prefijo de la cadena (0 si no arranca en
// numero). Solo se usa para el test `splt(q) = CStr(val(splt(q)))`.
double vb_val(const std::string& s) {
  try {
    std::size_t used = 0;
    const double v = std::stod(s, &used);
    return used == 0 ? 0.0 : v;
  } catch (...) {
    return 0.0;
  }
}

// El resultado de una corrida de CalcStats: dati(0..500, 0..18) en Single.
struct Dati {
  std::vector<std::array<db::vb_single, NUMGRAPHS + 1>> d;
  Dati() : d(static_cast<std::size_t>(kMaxSpecies) + 1) {
    for (auto& row : d) row.fill(0.0f);
  }
  db::vb_single& at(int p, int g) {
    return d[static_cast<std::size_t>(p)][static_cast<std::size_t>(g)];
  }
};

// main.frm:2381-2900 — CalcStats. `graphNum` 0 y los tres CUSTOM comparten
// la rama que calcula TODOS los graficos base; el resto tiene su rama propia
// (la separacion por rendimiento de EricL en 2.42.5).
void CalcStats(db::Sim& sim, std::vector<std::string>& nomi, Dati& dati,
               int graphNum) {
  // ListOSubSpecies(500, 10000) / speciesListIndex(500) del fuente.
  std::vector<std::vector<db::vb_integer>> ListOSubSpecies(
      static_cast<std::size_t>(kMaxSpecies) + 1);
  std::vector<int> speciesListIndex(static_cast<std::size_t>(kMaxSpecies) + 1,
                                    0);
  int p = 0, t = 0, i = 0;
  const db::vb_long population = sim.TotalRobotsDisplayed;
  const auto& C = sim.vm.costs;

  auto avg = [&](int g, int last) {
    for (int q = 1; q <= last; ++q) {
      if (dati.at(q, POPULATION_GRAPH) != 0)
        dati.at(q, g) = static_cast<db::vb_single>(vb_round_dec(
            static_cast<double>(dati.at(q, g) / dati.at(q, POPULATION_GRAPH)),
            1));
    }
  };
  // El bucle "acumular X por especie" que comparten 7 ramas.
  auto accumulate = [&](int g, auto value) {
    for (int n = 1; n <= sim.MaxRobs; ++n) {
      const db::Bot& b = sim.rob[n];
      if (!b.exist) continue;
      p = FlexPosition(b.FName, nomi);
      dati.at(p, POPULATION_GRAPH) += 1;
      dati.at(p, g) = static_cast<db::vb_single>(
          static_cast<double>(dati.at(p, g)) + value(b));
    }
    avg(g, FlexLast(nomi));
  };
  // Los cinco valores de la rama DYNAMICCOSTS (main.frm:2464-2479 y
  // :2752-2766). El `Round(..., 4)` solo existe en la rama de un grafico.
  auto dynamicCosts = [&](bool rounded) {
    dati.at(1, DYNAMICCOSTS_GRAPH) =
        rounded ? static_cast<db::vb_single>(vb_round_dec(
                      static_cast<double>(C.v[db::cost::COSTMULTIPLIER]), 4))
                : C.v[db::cost::COSTMULTIPLIER];
    if (C.v[db::cost::DYNAMICCOSTTARGET] == 0) {  // proteccion /0 del fuente
      dati.at(2, DYNAMICCOSTS_GRAPH) = static_cast<db::vb_single>(population);
      dati.at(5, DYNAMICCOSTS_GRAPH) = C.v[db::cost::BOTNOCOSTLEVEL];
      dati.at(6, DYNAMICCOSTS_GRAPH) = C.v[db::cost::COSTXREINSTATEMENTLEVEL];
    } else {
      dati.at(2, DYNAMICCOSTS_GRAPH) = static_cast<db::vb_single>(
          population / C.v[db::cost::DYNAMICCOSTTARGET]);
      dati.at(5, DYNAMICCOSTS_GRAPH) =
          C.v[db::cost::BOTNOCOSTLEVEL] / C.v[db::cost::DYNAMICCOSTTARGET];
      dati.at(6, DYNAMICCOSTS_GRAPH) = C.v[db::cost::COSTXREINSTATEMENTLEVEL] /
                                       C.v[db::cost::DYNAMICCOSTTARGET];
    }
    dati.at(3, DYNAMICCOSTS_GRAPH) = static_cast<db::vb_single>(
        1 + (C.v[db::cost::DYNAMICCOSTTARGETUPPERRANGE] * 0.01));
    dati.at(4, DYNAMICCOSTS_GRAPH) = static_cast<db::vb_single>(
        1 - (C.v[db::cost::DYNAMICCOSTTARGETLOWERRANGE] * 0.01));
  };
  // La distancia genetica "selectiva" (main.frm:2497-2540 y :2810-2871). OJO:
  // consume la moneda GenMut y cachea en OldGD — muta el bot.
  // OJO con `Dim l, ll As Long` (main.frm:2387): en VB6 eso declara `l` como
  // VARIANT y solo `ll` como Long. `l` guarda el Single con su parte
  // decimal — no truncar. `copyl` si es Single (:2513; su Dim dentro del
  // bucle no importa: el fuente le asigna 0 antes de usarlo).
  auto geneticDistance = [&](int g) {
    const int last0 = FlexLast(nomi);
    for (int q = 1; q <= last0; ++q) dati.at(q, g) = 0;
    for (int n = 1; n <= sim.MaxRobs; ++n) {
      db::Bot& b = sim.rob[n];
      if (!(b.exist && !b.Corpse)) continue;
      p = FlexPosition(b.FName, nomi);
      if (b.GenMut > 0) {
        const db::vb_single l = b.OldGD;
        if (l > dati.at(p, g)) dati.at(p, g) = l;
      } else {
        b.GenMut = static_cast<db::vb_single>(
            static_cast<double>(b.DnaLen) / db::GeneticSensitivity);
        db::vb_single copyl = 0;
        for (int x = n + 1; x <= sim.MaxRobs; ++x) {
          const db::Bot& o = sim.rob[x];
          if (o.exist && !o.Corpse && o.FName == b.FName && o.GenMut == 0) {
            const db::vb_single l = db::DoGeneticDistance(sim, n, x) * 1000.0f;
            if (l > copyl) copyl = l;
          }
        }
        if (copyl > dati.at(p, g)) dati.at(p, g) = copyl;
        b.OldGD = copyl;
      }
    }
  };

  switch (graphNum) {
    case 0:
    case CUSTOM_1_GRAPH:
    case CUSTOM_2_GRAPH:
    case CUSTOM_3_GRAPH: {
      for (t = 1; t <= sim.MaxRobs; ++t) {
        const db::Bot& b = sim.rob[t];
        if (!b.exist) continue;
        p = FlexPosition(b.FName, nomi);
        dati.at(p, POPULATION_GRAPH) += 1;
        dati.at(p, MUTATIONS_GRAPH) = static_cast<db::vb_single>(
            static_cast<double>(dati.at(p, MUTATIONS_GRAPH)) + b.LastMut +
            b.Mutations);
        dati.at(p, AVGAGE_GRAPH) = static_cast<db::vb_single>(
            static_cast<double>(dati.at(p, AVGAGE_GRAPH)) + b.age / 100.0);
        dati.at(p, OFFSPRING_GRAPH) += b.SonNumber;
        dati.at(p, ENERGY_GRAPH) += b.nrg;
        dati.at(p, DNALENGTH_GRAPH) += b.DnaLen;
        dati.at(p, DNACOND_GRAPH) =
            static_cast<db::vb_single>(dati.at(p, DNACOND_GRAPH) + b.condnum);
        // El fuente divide por .DnaLen sin guarda: con DnaLen = 0 lanzaba
        // error 11 y truncaba el redibujo. Decision de port: saltar el
        // sumando (es texto de grafico, nunca simulacion).
        if (b.DnaLen != 0)
          dati.at(p, MUT_DNALENGTH_GRAPH) = static_cast<db::vb_single>(
              static_cast<double>(dati.at(p, MUT_DNALENGTH_GRAPH)) +
              static_cast<double>(b.LastMut + b.Mutations) / b.DnaLen * 1000);
        dati.at(p, ENERGY_SPECIES_GRAPH) =
            static_cast<db::vb_single>(vb_round_dec(
                static_cast<double>(dati.at(p, ENERGY_SPECIES_GRAPH)) +
                    static_cast<double>(b.nrg + b.body * 10.0f) * 0.001,
                2));
        // Diversidad: subespecies distintas vistas por especie.
        i = 0;
        while (i < speciesListIndex[static_cast<std::size_t>(p)] &&
               b.SubSpecies !=
                   ListOSubSpecies[static_cast<std::size_t>(p)]
                                  [static_cast<std::size_t>(i)])
          i += 1;
        if (i == speciesListIndex[static_cast<std::size_t>(p)]) {
          ListOSubSpecies[static_cast<std::size_t>(p)].push_back(b.SubSpecies);
          speciesListIndex[static_cast<std::size_t>(p)] += 1;
          dati.at(p, SPECIESDIVERSITY_GRAPH) += 1;
        }
        if (!b.Corpse) {
          // El fuente calcula aqui `SubSpeciesNumber` (main.frm:2432-2437) y
          // no lo usa nadie: codigo muerto, no se transcribe.
          int p_reclev = 0;  // FindGenerationalDistance
          ScoreDepth(sim, t, 1, 500, p_reclev);
          if (p_reclev > dati.at(p, GENERATION_DIST_GRAPH))
            dati.at(p, GENERATION_DIST_GRAPH) =
                static_cast<db::vb_single>(p_reclev);
        }
      }
      t = FlexLast(nomi);
      // [PROBABLE BUG E6-A] la guarda usa el `p` que quedo del bucle de bots
      // (la ultima especie vista), no el `p` del bucle de promedios. Con al
      // menos un bot vivo siempre es != 0, asi que en la practica no cambia
      // nada; con la sim vacia p = 0 y el bloque se salta entero.
      if (dati.at(p, POPULATION_GRAPH) != 0) {
        for (p = 1; p <= t; ++p) {
          for (int g : {MUTATIONS_GRAPH, AVGAGE_GRAPH, OFFSPRING_GRAPH,
                        ENERGY_GRAPH, DNALENGTH_GRAPH, DNACOND_GRAPH,
                        MUT_DNALENGTH_GRAPH})
            dati.at(p, g) = static_cast<db::vb_single>(vb_round_dec(
                static_cast<double>(dati.at(p, g) /
                                    dati.at(p, POPULATION_GRAPH)),
                1));
        }
      }
      dynamicCosts(/*rounded=*/false);

      std::string myquery;
      if (graphNum == CUSTOM_1_GRAPH) myquery = sim.evo.strGraphQuery1;
      if (graphNum == CUSTOM_2_GRAPH) myquery = sim.evo.strGraphQuery2;
      if (graphNum == CUSTOM_3_GRAPH) myquery = sim.evo.strGraphQuery3;
      if (myquery.find("simpgenetic") != std::string::npos)
        geneticDistance(GENETIC_DIST_GRAPH);

      if (graphNum > 0) {
        for (p = 1; p <= t; ++p) {
          QStack q;
          q.clear();
          std::size_t from = 0;
          while (from <= myquery.size()) {
            std::size_t sp = myquery.find(' ', from);
            std::string w = myquery.substr(
                from, sp == std::string::npos ? std::string::npos : sp - from);
            from = (sp == std::string::npos) ? myquery.size() + 1 : sp + 1;
            for (auto& ch : w) ch = static_cast<char>(std::tolower(ch));
            char buf[64];
            std::snprintf(buf, sizeof buf, "%.15G", vb_val(w));
            if (w == buf) {
              q.push(vb_val(w));
            } else if (w == "pop") q.push(dati.at(p, POPULATION_GRAPH));
            else if (w == "avgmut") q.push(dati.at(p, MUTATIONS_GRAPH));
            else if (w == "avgage") q.push(dati.at(p, AVGAGE_GRAPH));
            else if (w == "avgsons") q.push(dati.at(p, OFFSPRING_GRAPH));
            else if (w == "avgnrg") q.push(dati.at(p, ENERGY_GRAPH));
            else if (w == "avglen") q.push(dati.at(p, DNALENGTH_GRAPH));
            else if (w == "avgcond") q.push(dati.at(p, DNACOND_GRAPH));
            else if (w == "simnrg") q.push(dati.at(p, ENERGY_SPECIES_GRAPH));
            else if (w == "specidiv") q.push(dati.at(p, SPECIESDIVERSITY_GRAPH));
            else if (w == "maxgd") q.push(dati.at(p, GENERATION_DIST_GRAPH));
            else if (w == "simpgenetic") q.push(dati.at(p, GENETIC_DIST_GRAPH));
            else if (w == "add") q.qadd();
            else if (w == "sub") q.qsub();
            else if (w == "mult") q.qmult();
            else if (w == "div") q.qdiv();
            else if (w == "pow") q.qpow();
          }
          double hold = q.pop();
          if (hold < 0) hold = 0;
          dati.at(p, graphNum) = static_cast<db::vb_single>(hold);
        }
      }
      break;
    }
    case POPULATION_GRAPH:
      for (t = 1; t <= sim.MaxRobs; ++t) {
        if (!sim.rob[t].exist) continue;
        p = FlexPosition(sim.rob[t].FName, nomi);
        dati.at(p, POPULATION_GRAPH) += 1;
      }
      break;
    case MUTATIONS_GRAPH:
      accumulate(MUTATIONS_GRAPH, [](const db::Bot& b) {
        return static_cast<double>(b.LastMut + b.Mutations);
      });
      break;
    case AVGAGE_GRAPH:  // EricL: la edad va en centenas de ciclos
      accumulate(AVGAGE_GRAPH,
                 [](const db::Bot& b) { return b.age / 100.0; });
      break;
    case OFFSPRING_GRAPH:
      accumulate(OFFSPRING_GRAPH,
                 [](const db::Bot& b) { return static_cast<double>(b.SonNumber); });
      break;
    case ENERGY_GRAPH:
      accumulate(ENERGY_GRAPH,
                 [](const db::Bot& b) { return static_cast<double>(b.nrg); });
      break;
    case DNALENGTH_GRAPH:
      accumulate(DNALENGTH_GRAPH,
                 [](const db::Bot& b) { return static_cast<double>(b.DnaLen); });
      break;
    case DNACOND_GRAPH:
      accumulate(DNACOND_GRAPH,
                 [](const db::Bot& b) { return static_cast<double>(b.condnum); });
      break;
    case MUT_DNALENGTH_GRAPH:
      accumulate(MUT_DNALENGTH_GRAPH, [](const db::Bot& b) {
        return b.DnaLen == 0
                   ? 0.0
                   : static_cast<double>(b.LastMut + b.Mutations) / b.DnaLen *
                         1000;
      });
      break;
    case ENERGY_SPECIES_GRAPH:
      // Sin Round ni promedio: es la suma cruda (a diferencia de la rama 0,
      // que redondea a 2 decimales en cada bot). Quirk del fuente.
      for (t = 1; t <= sim.MaxRobs; ++t) {
        const db::Bot& b = sim.rob[t];
        if (!b.exist) continue;
        p = FlexPosition(b.FName, nomi);
        dati.at(p, ENERGY_SPECIES_GRAPH) = static_cast<db::vb_single>(
            static_cast<double>(dati.at(p, ENERGY_SPECIES_GRAPH)) +
            static_cast<double>(b.nrg + b.body * 10.0f) * 0.001);
      }
      break;
    case DYNAMICCOSTS_GRAPH:
      dynamicCosts(/*rounded=*/true);
      break;
    case SPECIESDIVERSITY_GRAPH:
      for (t = 1; t <= sim.MaxRobs; ++t) {
        const db::Bot& b = sim.rob[t];
        if (!b.exist) continue;
        p = FlexPosition(b.FName, nomi);
        i = 0;
        while (i < speciesListIndex[static_cast<std::size_t>(p)] &&
               b.SubSpecies !=
                   ListOSubSpecies[static_cast<std::size_t>(p)]
                                  [static_cast<std::size_t>(i)])
          i += 1;
        if (i == speciesListIndex[static_cast<std::size_t>(p)]) {
          ListOSubSpecies[static_cast<std::size_t>(p)].push_back(b.SubSpecies);
          speciesListIndex[static_cast<std::size_t>(p)] += 1;
          dati.at(p, SPECIESDIVERSITY_GRAPH) += 1;
        }
      }
      break;
    case AVGCHLR_GRAPH:
      accumulate(AVGCHLR_GRAPH, [](const db::Bot& b) {
        return static_cast<double>(b.chloroplasts);
      });
      break;
    case GENETIC_DIST_GRAPH:
      geneticDistance(GENETIC_DIST_GRAPH);
      break;
    case GENERATION_DIST_GRAPH: {
      const int last0 = FlexLast(nomi);
      for (int q = 1; q <= last0; ++q) dati.at(q, GENERATION_DIST_GRAPH) = 0;
      for (t = 1; t <= sim.MaxRobs; ++t) {
        const db::Bot& b = sim.rob[t];
        if (!(b.exist && !b.Corpse)) continue;
        p = FlexPosition(b.FName, nomi);
        int p_reclev = 0;
        ScoreDepth(sim, t, 1, 500, p_reclev);
        if (p_reclev > dati.at(p, GENERATION_DIST_GRAPH))
          dati.at(p, GENERATION_DIST_GRAPH) =
              static_cast<db::vb_single>(p_reclev);
      }
      break;
    }
    case GENETIC_SIMPLE_GRAPH: {
      // Sin la moneda GenMut: compara TODOS los pares de la misma especie.
      const int last0 = FlexLast(nomi);
      for (int q = 1; q <= last0; ++q) dati.at(q, GENETIC_SIMPLE_GRAPH) = 0;
      for (t = 1; t <= sim.MaxRobs; ++t) {
        if (!(sim.rob[t].exist && !sim.rob[t].Corpse)) continue;
        p = FlexPosition(sim.rob[t].FName, nomi);
        for (int x = t + 1; x <= sim.MaxRobs; ++x) {
          if (sim.rob[x].exist && !sim.rob[x].Corpse &&
              sim.rob[x].FName == sim.rob[t].FName) {
            // `l` es Variant (main.frm:2387): conserva la parte decimal.
            const db::vb_single l =
                db::DoGeneticDistance(sim, t, x) * 1000.0f;
            if (l > dati.at(p, GENETIC_SIMPLE_GRAPH))
              dati.at(p, GENETIC_SIMPLE_GRAPH) = l;
          }
        }
      }
      break;
    }
    default:
      break;
  }
}

// main.frm:2224-2273 — FeedGraph para UN grafico: CalcStats y luego un
// SetValues por serie. El grafico 10 no usa especies sino 6 series fijas.
const char* kDynCostSeries[6] = {"Cost Multiplier", "Population / Target",
                                 "Upper Range",     "Lower Range",
                                 "Zero Level",      "Reinstatement Level"};

}  // namespace

extern "C" {

// ---------------------------------------------------------------------------
// E6 · Graficas (main.frm NewGraph/FeedGraph/CalcStats + grafico.frm)

// strGraphQuery1..3 (Globals.bas:146-148; los persiste el formato de sim).
DB_EXPORT void db_sim_graph_set_query(void* h, int which, const char* q) {
  db::Sim& s = S(h);
  const std::string v = q ? q : "";
  if (which == 1) s.evo.strGraphQuery1 = v;
  if (which == 2) s.evo.strGraphQuery2 = v;
  if (which == 3) s.evo.strGraphQuery3 = v;
}
DB_EXPORT char* db_sim_graph_get_query(void* h, int which) {
  db::Sim& s = S(h);
  const std::string& v = which == 1   ? s.evo.strGraphQuery1
                         : which == 2 ? s.evo.strGraphQuery2
                                      : s.evo.strGraphQuery3;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(v.c_str()), v.size() + 1,
      nullptr));
}

// Los cinco campos por grafico que el formato de sim persiste
// (HDRoutines.bas:798-806 / :1476-1481): 0 visible, 1 save, 2 left, 3 top,
// 4 filecounter.
DB_EXPORT double db_sim_graph_get(void* h, int n, int field) {
  db::Sim& s = S(h);
  if (n < 1 || n > NUMGRAPHS) return 0;
  const auto i = static_cast<std::size_t>(n);
  switch (field) {
    case 0: return s.evo.graphvisible[i] ? 1 : 0;
    case 1: return s.evo.graphsave[i] ? 1 : 0;
    case 2: return static_cast<double>(s.evo.graphleft[i]);
    case 3: return static_cast<double>(s.evo.graphtop[i]);
    case 4: return static_cast<double>(s.evo.graphfilecounter[i]);
    default: return 0;
  }
}
DB_EXPORT void db_sim_graph_set(void* h, int n, int field, double v) {
  db::Sim& s = S(h);
  if (n < 1 || n > NUMGRAPHS) return;
  const auto i = static_cast<std::size_t>(n);
  switch (field) {
    case 0: s.evo.graphvisible[i] = (v != 0); break;
    case 1: s.evo.graphsave[i] = (v != 0); break;
    case 2: s.evo.graphleft[i] = static_cast<db::vb_long>(v); break;
    case 3: s.evo.graphtop[i] = static_cast<db::vb_long>(v); break;
    case 4: s.evo.graphfilecounter[i] = static_cast<db::vb_long>(v); break;
    default: break;
  }
}

// FeedGraph de un solo grafico: corre CalcStats y deja 2 floats por serie
// ([valor, color BGR] — el color es −1 si la especie no esta en la lista, y
// entonces lo sortea la pagina como hace AddSeries con RGB(Random...)).
// Devuelve el numero de series: Flex.last(nomi), o 6 fijas para el 10.
DB_EXPORT int db_sim_graph_feed(void* h, int graphNum, float* out, int max) {
  SimHandle& H0 = H(h);
  db::Sim& s = H0.sim;
  H0.graphNames.assign(1, std::string());  // indice 0 sin usar
  if (graphNum < 1 || graphNum > NUMGRAPHS) return 0;

  std::vector<std::string> nomi(static_cast<std::size_t>(kMaxSpecies) + 2);
  Dati dati;
  CalcStats(s, nomi, dati, graphNum);

  if (graphNum == DYNAMICCOSTS_GRAPH) {
    const int n = (6 < max) ? 6 : max;
    for (int i = 0; i < n; ++i) {
      out[i * 2] = dati.at(i + 1, DYNAMICCOSTS_GRAPH);
      out[i * 2 + 1] = -1.0f;
      H0.graphNames.push_back(kDynCostSeries[i]);
    }
    return n;
  }
  int t = FlexLast(nomi);
  if (t > max) t = max;
  for (int p = 1; p <= t; ++p) {
    out[(p - 1) * 2] = dati.at(p, graphNum);
    // grafico.frm:3745-3755 — el color de la serie es el de la especie.
    float color = -1.0f;
    for (const auto& sp : s.Specie)
      if (sp.Name == nomi[static_cast<std::size_t>(p)]) {
        color = static_cast<float>(sp.color);
        break;
      }
    out[(p - 1) * 2 + 1] = color;
    H0.graphNames.push_back(nomi[static_cast<std::size_t>(p)]);
  }
  return t;
}

// Nombre (1-based) de la serie i del ultimo db_sim_graph_feed.
DB_EXPORT char* db_sim_graph_series_name(void* h, int i) {
  SimHandle& H0 = H(h);
  static const std::string empty;
  const std::string& v =
      (i >= 1 && i < static_cast<int>(H0.graphNames.size()))
          ? H0.graphNames[static_cast<std::size_t>(i)]
          : empty;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(v.c_str()), v.size() + 1,
      nullptr));
}

// ---------------------------------------------------------------------------
// E6 · Snapshots (Database.bas, ya en el core: database.hpp)

DB_EXPORT int db_sim_snapshot_run(void* h, int withMutations) {
  SimHandle& H0 = H(h);
  H0.lastSnapshot = db::Snapshot(H0.sim, withMutations != 0);
  return static_cast<int>(H0.lastSnapshot.records);
}
DB_EXPORT char* db_sim_snapshot_take(void* h, int which) {
  SimHandle& H0 = H(h);
  const std::string& v = which == 0 ? H0.lastSnapshot.snp : H0.lastSnapshot.mut;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(v.c_str()), v.size() + 1,
      nullptr));
}

DB_EXPORT int db_sim_dead_records(void* h) {
  return static_cast<int>(S(h).deadSnp.records);
}
DB_EXPORT int db_sim_dead_pending(void* h) {
  return static_cast<int>(S(h).deadSnp.snp.size());
}
DB_EXPORT char* db_sim_dead_take(void* h, int which) {
  const db::DeadSnapshot& d = S(h).deadSnp;
  const std::string& v = which == 0 ? d.snp : d.mut;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(v.c_str()), v.size() + 1,
      nullptr));
}
// drain: el texto ya entregado se va, el "archivo" sigue existiendo (no se
// repiten las cabeceras). reset: equivale a borrar los .snp del Autosave.
DB_EXPORT void db_sim_dead_drain(void* h) { S(h).deadSnp.drain(); }
DB_EXPORT void db_sim_dead_reset(void* h) { S(h).deadSnp.reset(); }

// ---------------------------------------------------------------------------
// E6 · Menu Robot: Find Best y Philogeny (parentele.frm)

// MDIForm1.frm:1398-1400 — `robfocus = Form1.fittest`.
DB_EXPORT int db_sim_fittest(void* h) {
  db::Sim& s = S(h);
  const int f = db::Fittest(s);
  s.robfocus = static_cast<db::vb_integer>(f);
  return f;
}

// parentele.frm:206-216 (calcolo): TotalOffspring arranca en 0 aqui — no en
// 1 como en fittest — y `score` tipo 0 lo incrementa por descendiente.
DB_EXPORT int db_sim_offspring(void* h, int n, int maxrec) {
  db::Sim& s = S(h);
  if (n < 1 || n > s.MaxRobs) return 0;
  db::vb_long TotalOffspring = 0;
  bool Cancer = false;
  db::score0(s, n, 1, maxrec > 0 ? maxrec : 1000, TotalOffspring, Cancer);
  return static_cast<int>(TotalOffspring);
}

// parentele.frm:180-188 (Command1): `score(robfocus, 1, maxrec, 1)` marca la
// descendencia con highlight. El original repinta con Form1.Cls + DrawAllRobs;
// aqui el bit viaja en el volcado de bots y lo dibuja la pagina.
DB_EXPORT int db_sim_highlight_family(void* h, int n, int maxrec) {
  db::Sim& s = S(h);
  if (n < 1 || n > s.MaxRobs) return 0;
  ScoreHighlight(s, n, 1, maxrec > 0 ? maxrec : 1000);
  int c = 0;
  for (int t = 1; t <= s.MaxRobs; ++t)
    if (s.rob[t].exist && s.rob[t].highlight) ++c;
  return c;
}
// main.frm:2155-2161 — unfocus: apaga el highlight de todos.
DB_EXPORT void db_sim_clear_highlight(void* h) {
  db::Sim& s = S(h);
  for (int t = 1; t <= s.MaxRobs; ++t) s.rob[t].highlight = false;
}

// parentele.frm:190-192 (Command2) -> score tipo 2 = plines + tipo 3: sube al
// ancestro mas viejo y dibuja el arbol. 7 floats por enlace:
// [hijo.x, hijo.y, medio.x, medio.y, padre.x, padre.y, ctBlanco]
// (main.frm:3059-3070: el tramo hijo->medio va en `ct` y medio->padre en
// `cr`; el blanco va del lado del AbsNum mayor).
DB_EXPORT int db_sim_family_lines(void* h, int n, float* out, int max) {
  db::Sim& s = S(h);
  if (n < 1 || n > s.MaxRobs) return 0;
  // plines (main.frm:3085-3094): parent() busca por AbsNum entre los vivos.
  auto parent_of = [&](int r) {
    int found = 0;
    for (int t = 1; t <= s.MaxRobs; ++t)
      if (s.rob[t].AbsNum == s.rob[r].parent && s.rob[t].exist) found = t;
    return found;
  };
  int t0 = n, p0 = parent_of(n);
  while (p0 > 0) { t0 = p0; p0 = parent_of(t0); }
  int written = 0;
  // score tipo 3, recursivo hasta 1000 niveles.
  std::function<void(int, int)> walk = [&](int r, int reclev) {
    for (int t = 1; t <= s.MaxRobs; ++t) {
      if (!s.rob[t].exist || s.rob[t].parent != s.rob[r].AbsNum) continue;
      if (reclev < 1000) walk(t, reclev + 1);
      if (written >= max) continue;
      const float dx = (s.rob[r].pos.x - s.rob[t].pos.x) / 2.0f;
      const float dy = (s.rob[r].pos.y - s.rob[t].pos.y) / 2.0f;
      float* o = out + written * 7;
      o[0] = s.rob[t].pos.x;
      o[1] = s.rob[t].pos.y;
      o[2] = s.rob[t].pos.x + dx;
      o[3] = s.rob[t].pos.y + dy;
      o[4] = s.rob[r].pos.x;
      o[5] = s.rob[r].pos.y;
      o[6] = (s.rob[r].AbsNum > s.rob[t].AbsNum) ? 0.0f : 1.0f;  // ct blanco
      ++written;
    }
  };
  walk(t0, 1);
  return written;
}

// ---------------------------------------------------------------------------
// E6 · Consola del bot (console.frm)

// `Set rob(n).console = New Consoleform` / `= Nothing`. El bit abre el gate
// de ga() en ExecRobs igual que robfocus.
DB_EXPORT void db_sim_console_open(void* h, int n, int on) {
  db::Sim& s = S(h);
  if (n >= 1 && n < static_cast<int>(s.rob.size()))
    s.rob[n].consoleOpen = (on != 0);
}

// DNA.bas:1254-1263 / ActivForm.DrawGrid: los genes que dispararon el ultimo
// ciclo. Devuelve genenum y escribe un 0/1 por gen (indices 1..genenum).
DB_EXPORT int db_sim_bot_ga(void* h, int n, int* out, int max) {
  db::Sim& s = S(h);
  if (n < 1 || n >= static_cast<int>(s.rob.size())) return 0;
  const db::Bot& b = s.rob[n];
  int c = 0;
  for (int g = 1; g < static_cast<int>(b.ga.size()) && c < max; ++g)
    out[c++] = b.ga[static_cast<std::size_t>(g)] ? 1 : 0;
  return c;
}

// console.frm:433-436 — printdebug.
DB_EXPORT char* db_sim_bot_dbg(void* h, int n) {
  db::Sim& s = S(h);
  static const std::string empty;
  const std::string& v =
      (n >= 1 && n < static_cast<int>(s.rob.size())) ? s.rob[n].dbgstring
                                                     : empty;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(v.c_str()), v.size() + 1,
      nullptr));
}

// console.frm:395-405 — printmem / set. El original acota `set` a |v| < 32001
// y `printmem` a 0 < v < 1000 (la pagina replica los mensajes).
DB_EXPORT int db_sim_bot_mem(void* h, int n, int addr) {
  db::Sim& s = S(h);
  if (n < 1 || n >= static_cast<int>(s.rob.size())) return 0;
  if (addr < 0 || addr > db::MaxMem) return 0;
  return s.rob[n].mem[static_cast<std::size_t>(addr)];
}
DB_EXPORT void db_sim_bot_set_mem(void* h, int n, int addr, int v) {
  db::Sim& s = S(h);
  if (n < 1 || n >= static_cast<int>(s.rob.size())) return;
  if (addr < 0 || addr > db::MaxMem) return;
  s.rob[n].mem[static_cast<std::size_t>(addr)] =
      static_cast<db::vb_integer>(v);
}
// SysvarTok (DNATokenizing.bas:320-338): nombre -> direccion, con las
// privadas del bot incluidas. 0 = no reconocido.
DB_EXPORT int db_sim_sysvar_tok(void* h, int n, const char* name) {
  db::Sim& s = S(h);
  if (n < 1 || n >= static_cast<int>(s.rob.size()) || !name) return 0;
  // El token viaja TAL CUAL, con su punto: sin prefijo `.` el original cae en
  // val() con CInt bancario (el `set` de console.frm:362 llama aqui con la
  // direccion numerica). Fuera de Integer el original daba error 6 y se
  // caia; aqui devuelve -1 (direccion invalida: el host no escribe nada).
  try {
    return db::loader_detail::SysvarTok(name, s.rob[n], *s.sysvars);
  } catch (const db::loader_detail::VbError&) {
    return -1;
  }
}
// ---- Lint de ADN al sembrar (decisión de capa host, fuera de la fidelidad) --
// El cargador no rechaza nada (V-08): todo token que no reconoce acaba en
// SysvarTok y vale 0 sin aviso — `.aimshot store` escribe en mem(1000), un
// `stop` con un byte invisible no cierra el gen, `.50` no es la dirección 50.
// El original se comportaba igual (el port es fiel), pero el autor del bot
// quería otra cosa. db_dna_lint recorre el texto con las MISMAS reglas de
// línea de LoadDNAText y las MISMAS tablas de tokens y sysvars del core, y
// devuelve esos tokens para que la página avise. No toca ninguna sim ni
// consume RNG. Salida: una línea por hallazgo, campos separados por TAB:
//   tipo \t token \t veces \t primera_linea \t pista
// tipos: nombre | palabra | pegado | primero | sombra | error
}  // extern "C" (los helpers del lint son C++ con enlace normal)

namespace lint_detail {

int EditDistance(const std::string& a, const std::string& b) {
  std::vector<int> prev(b.size() + 1), cur(b.size() + 1);
  for (std::size_t j = 0; j <= b.size(); ++j) prev[j] = static_cast<int>(j);
  for (std::size_t i = 1; i <= a.size(); ++i) {
    cur[0] = static_cast<int>(i);
    for (std::size_t j = 1; j <= b.size(); ++j)
      cur[j] = std::min({prev[j] + 1, cur[j - 1] + 1,
                         prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1)});
    std::swap(prev, cur);
  }
  return prev[b.size()];
}

// ¿Lo reconoce alguna tabla de comandos de Parse (sin ismutating)?
bool IsCommand(const std::string& lc) {
  using namespace db::loader_detail;
  return BasicCommandTok(lc).value || AdvancedCommandTok(lc, false).value ||
         BitwiseCommandTok(lc).value || ConditionsTok(lc).value ||
         LogicTok(lc).value || StoresTok(lc).value || FlowTok(lc).value ||
         MasterFlowTok(lc).value;
}

const char* const kCommandWords[] = {
    "add", "sub", "mult", "div", "rnd", "mod", "sgn", "abs", "dup", "drop",
    "clear", "swap", "over", "angle", "dist", "ceil", "floor", "sqr", "pow",
    "pyth", "anglecmp", "root", "logx", "sin", "cos", "and", "or", "xor",
    "not", "true", "false", "dropbool", "clearbool", "dupbool", "swapbool",
    "overbool", "store", "inc", "dec", "addstore", "substore", "multstore",
    "divstore", "ceilstore", "floorstore", "rndstore", "sgnstore", "absstore",
    "sqrstore", "negstore", "cond", "start", "else", "stop", "end"};

bool IsSysvarName(const std::string& lc, const db::SysvarTable& sv) {
  for (const db::Var& v : sv.entries)
    if (db::loader_detail::lcase(v.name) == lc) return true;
  return false;
}

// Sysvar más parecida o "": distancia 1 para nombres de hasta 4 letras,
// hasta 2 para los más largos (con menos, cualquier palabra corta "se parece").
std::string NearestSysvar(const std::string& lc, const db::SysvarTable& sv) {
  if (lc.size() < 3) return "";
  std::string best;
  int bestD = lc.size() <= 4 ? 2 : 3;
  for (const db::Var& v : sv.entries) {
    const std::string n = db::loader_detail::lcase(v.name);
    const int d = EditDistance(lc, n);
    if (d < bestD) { bestD = d; best = v.name; }
  }
  return best;
}

// Longitud del prefijo que consume Val() (mismo autómata que vb_val).
std::size_t ValPrefix(const std::string& s, bool& digits) {
  std::size_t i = 0, n = s.size(), dg = 0;
  if (i < n && (s[i] == '+' || s[i] == '-')) ++i;
  while (i < n && std::isdigit(static_cast<unsigned char>(s[i]))) ++i, ++dg;
  if (i < n && s[i] == '.') {
    ++i;
    while (i < n && std::isdigit(static_cast<unsigned char>(s[i]))) ++i, ++dg;
  }
  digits = dg > 0;
  if (!digits) return 0;
  if (i < n && (s[i] == 'e' || s[i] == 'E' || s[i] == 'd' || s[i] == 'D')) {
    std::size_t j = i + 1, ed = 0;
    if (j < n && (s[j] == '+' || s[j] == '-')) ++j;
    while (j < n && std::isdigit(static_cast<unsigned char>(s[j]))) ++j, ++ed;
    if (ed > 0) i = j;
  }
  return i;
}

bool HasNonAscii(const std::string& s) {
  for (char ch : s) {
    const unsigned char u = static_cast<unsigned char>(ch);
    if (u < 32 || u >= 127) return true;
  }
  return false;
}

std::string StripNonAscii(const std::string& s) {
  std::string r;
  for (char ch : s) {
    const unsigned char u = static_cast<unsigned char>(ch);
    if (u >= 32 && u < 127) r += ch;
  }
  return r;
}

struct Finding {
  std::string kind, token, hint;
  int count = 0, line = 0;
};

class Report {
 public:
  void add(const std::string& kind, const std::string& token, int line,
           const std::string& hint) {
    for (Finding& f : items_)
      if (f.kind == kind && f.token == token) { ++f.count; return; }
    items_.push_back(Finding{kind, token, hint, 1, line});
  }
  std::string text() const {
    std::string out;
    for (const Finding& f : items_)
      out += f.kind + '\t' + f.token + '\t' + std::to_string(f.count) + '\t' +
             std::to_string(f.line) + '\t' + f.hint + '\n';
    return out;
  }
 private:
  std::vector<Finding> items_;
};

std::string Lint(const std::string& text) {
  using namespace db::loader_detail;
  const db::SysvarTable& sv = db::DefaultSysvarTable();
  Report report;
  auto bot = std::make_unique<db::Bot>();
  bot->vars.assign(1, db::Var{});
  bot->vnum = 1;

  // Líneas ya normalizadas como en LoadDNAText (:92-93 y trim)
  std::vector<std::string> lines;
  for (std::size_t start = 0; start <= text.size();) {
    std::size_t nl = text.find('\n', start);
    if (nl == std::string::npos) nl = text.size();
    std::string a = text.substr(start, nl - start);
    start = nl + 1;
    if (!a.empty() && a.back() == '\r') a.pop_back();
    const std::size_t q = a.find('\'');
    if (q != std::string::npos && q > 0) a = a.substr(0, q);
    for (char& ch : a)
      if (ch == '\t') ch = ' ';
    const std::size_t b0 = a.find_first_not_of(' ');
    const std::size_t b1 = a.find_last_not_of(' ');
    lines.push_back(b0 == std::string::npos ? "" : a.substr(b0, b1 - b0 + 1));
    if (nl == text.size()) break;
  }

  // Todas las privadas del archivo, para detectar las usadas antes de su def
  std::vector<std::string> allDefs;
  for (const std::string& a : lines)
    if (a.compare(0, 3, "def") == 0 && a.size() > 4) {
      const std::string rest = a.substr(4);
      allDefs.push_back(rest.substr(0, rest.find(' ')));
    }

  bool useref = false;
  std::string firstToken;
  try {
    for (std::size_t li = 0; li < lines.size(); ++li) {
      const std::string& a = lines[li];
      const int lineNo = static_cast<int>(li) + 1;
      if (a.empty() || a[0] == '\'' || a[0] == '/') continue;

      if (a.compare(0, 3, "def") == 0) {
        insertvar(*bot, a);
        useref = true;
        const std::string& name = bot->vars.back().name;
        if (IsSysvarName(lcase(name), sv))
          report.add("sombra", "def " + name, lineNo,
                     "la variable propia tapa a la sysvar ." + name +
                         " en todo el bot");
        continue;
      }

      std::size_t wpos = 0;
      while (wpos < a.size()) {
        const std::size_t wend = a.find(' ', wpos);
        const std::string word = a.substr(
            wpos, (wend == std::string::npos ? a.size() : wend) - wpos);
        wpos = (wend == std::string::npos) ? a.size() : wend + 1;
        if (word.empty()) continue;
        if (firstToken.empty()) firstToken = word;

        const std::string lc = lcase(word);
        if (IsCommand(lc)) continue;
        const std::string operand = word[0] == '*' ? word.substr(1) : word;

        if (!operand.empty() && operand[0] == '.') {
          const std::string name = operand.substr(1);
          bool found = IsSysvarName(lcase(name), sv);
          for (std::size_t t = 1; !found && t < bot->vars.size(); ++t)
            found = bot->vars[t].name == name;
          if (found) continue;

          std::string hint;
          bool digitsOnly = !name.empty();
          for (char ch : name)
            digitsOnly = digitsOnly && std::isdigit(static_cast<unsigned char>(ch));
          bool definedLater = false, otherCase = false;
          for (const std::string& d : allDefs) {
            if (d == name) definedLater = true;
            else if (lcase(d) == lcase(name)) otherCase = true;
          }
          if (digitsOnly)
            hint = "¿la dirección " + name + "? va sin punto: " + name;
          else if (definedLater)
            hint = "su def está más abajo; el cargador resuelve al leer: sube el def";
          else if (otherCase)
            hint = "las variables propias distinguen mayúsculas";
          else if (!(hint = NearestSysvar(lcase(name), sv)).empty())
            hint = "¿." + hint + "?";
          else
            hint = "no es una sysvar ni tiene def (¿de otra versión de DB?)";
          report.add("nombre", word, lineNo, hint);
          continue;
        }

        bool digits = false;
        const std::size_t used = ValPrefix(operand, digits);
        if (!digits) {
          std::string hint;
          const std::string clean = lcase(StripNonAscii(operand));
          if (HasNonAscii(operand) && IsCommand(clean))
            hint = "'" + clean + "' con un carácter invisible: no se reconoce";
          else if (HasNonAscii(operand))
            hint = "caracteres invisibles o de codificación";
          else if (IsSysvarName(lcase(operand), sv))
            hint = "¿falta el punto? ." + operand;
          else {
            std::string near;
            for (const char* c : kCommandWords)
              if (EditDistance(lc, c) == 1 && lc.size() >= 4) near = c;
            hint = near.empty() ? "no es comando ni número (¿texto sin ' de comentario?)"
                                : "¿" + near + "?";
          }
          report.add("palabra", word, lineNo, hint);
          continue;
        }
        to_vb_integer(db::loader_detail::vb_val(operand));  // fuera de +-32767: error 6
        if (used < operand.size())
          report.add("pegado", word, lineNo,
                     "se lee como " + operand.substr(0, used) + "; \"" +
                         operand.substr(used) + "\" se pierde (¿falta un espacio?)");
      }
    }
  } catch (const VbError& e) {
    report.add("error", "error " + std::to_string(e.number), 0,
               "el cargador rechaza el archivo (literal fuera de ±32767 o def mal formado)");
    return report.text();
  }

  // [PROBABLE BUG] A2-2 (V-06): con defs y primer token no-flujo, el primer
  // token queda fuera del rango ejecutable.
  if (useref && !firstToken.empty() &&
      FlowTok(lcase(firstToken)).value == 0)
    report.add("primero", firstToken, 0,
               "con def, el primer token que no es de flujo se pierde (bug A2-2 del original)");
  return report.text();
}

}  // namespace lint_detail

extern "C" {

DB_EXPORT char* db_dna_lint(const char* text) {
  const std::string s = lint_detail::Lint(text ? text : "");
  char* p = static_cast<char*>(std::malloc(s.size() + 1));
  if (p) std::memcpy(p, s.c_str(), s.size() + 1);
  return p;
}

// console.frm:369 — `energy e`.
DB_EXPORT void db_sim_bot_set_nrg(void* h, int n, float v) {
  db::Sim& s = S(h);
  if (n >= 1 && n < static_cast<int>(s.rob.size())) s.rob[n].nrg = v;
}
// console.frm:381 — `execrob`: ejecuta el ADN de todos sin avanzar el ciclo.
DB_EXPORT void db_sim_exec_robs(void* h) { db::ExecRobs(S(h)); }

DB_EXPORT int db_sim_bot_genenum(void* h, int n) {
  db::Sim& s = S(h);
  if (n < 1 || n >= static_cast<int>(s.rob.size())) return 0;
  return static_cast<int>(s.rob[n].genenum);
}
// Identidad del bot para el titulo de la consola (AbsNum + nombre).
DB_EXPORT int db_sim_bot_absnum(void* h, int n) {
  db::Sim& s = S(h);
  if (n < 1 || n >= static_cast<int>(s.rob.size())) return 0;
  return static_cast<int>(s.rob[n].AbsNum);
}
DB_EXPORT char* db_sim_bot_name(void* h, int n) {
  db::Sim& s = S(h);
  static const std::string empty;
  const std::string& v =
      (n >= 1 && n < static_cast<int>(s.rob.size())) ? s.rob[n].FName : empty;
  return reinterpret_cast<char*>(CopyOut(
      reinterpret_cast<const unsigned char*>(v.c_str()), v.size() + 1,
      nullptr));
}

}  // extern "C"

// ===========================================================================
// E8 — extras de menor valor (capa host; spec/PLAN-EXTENSIONES.md §E8)
//
// Dos campos de render del Type robot que el core no tiene porque ningun
// sistema de la simulacion los lee: monitor_r/g/b (Robots.bas:347-349) y
// oaim/OSkin (Robots.bas:211, :316). Viven aqui, por slot, con la regla de
// siempre: nada de esto escribe en la sim ni consume RNG.
// ===========================================================================

namespace {

void E8Resize(SimHandle::E8& e, const db::Sim& sim) {
  const std::size_t n = static_cast<std::size_t>(sim.MaxRobs) + 1;
  if (e.monAbs.size() < n) {
    e.monAbs.resize(n, 0);
    e.mon.resize(n, {0, 0, 0});
    e.skinAbs.resize(n, 0);
    e.oaim.resize(n, 0.0f);
    e.oskin.resize(n, {});
  }
}

// CInt de una asignacion a Integer con su error 6 (fuera de -32768..32767).
bool E8CInt(double v, db::vb_integer& out) {
  const std::int64_t r = db::vb_round64(v);
  if (r < -32768 || r > 32767) return false;
  out = static_cast<db::vb_integer>(r);
  return true;
}

}  // namespace

extern "C" {

// Paso 23 del tick (Master.bas:416-427): `If MDIForm1.MonitorOn Then` copia
// mem(Monitor_mem_r/g/b) a rob(t).monitor_r/g/b de cada bot vivo. El worker
// lo llama tras CADA tick con el monitor encendido: los pasos 24-26 no tocan
// mem() ni crean bots (Master.bas:429-554), asi que despues de UpdateSim es
// el mismo instante. Las direcciones llegan validadas 1..999 (LostFocus de
// frmMonitorSet.frm:413-425); fuera de 0..MaxMem no se copia.
DB_EXPORT void db_sim_monitor_capture(void* h, int memR, int memG, int memB) {
  auto& Sh = H(h);
  const db::Sim& sim = Sh.sim;
  auto& e = Sh.e8;
  E8Resize(e, sim);
  const int m[3] = {memR, memG, memB};
  for (int c = 0; c < 3; ++c)
    if (m[c] < 0 || m[c] > db::MaxMem) return;
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    const db::Bot& b = sim.rob[t];
    if (!b.exist) continue;
    const auto i = static_cast<std::size_t>(t);
    e.monAbs[i] = b.AbsNum;
    for (int c = 0; c < 3; ++c)
      e.mon[i][static_cast<std::size_t>(c)] =
          b.mem[static_cast<std::size_t>(m[c])];
  }
}

// 3 floats por bot existente, misma fila que db_sim_dump_bots:
// [monitor_r, monitor_g, monitor_b]. Un bot que nunca paso por el paso 23
// con el monitor encendido (o que ocupa un slot nuevo) vale 0.
DB_EXPORT int db_sim_dump_monitor(void* h, float* out, int max_bots) {
  auto& Sh = H(h);
  const db::Sim& sim = Sh.sim;
  auto& e = Sh.e8;
  E8Resize(e, sim);
  int written = 0;
  for (int n = 1; n <= sim.MaxRobs && written < max_bots; ++n) {
    const db::Bot& b = sim.rob[n];
    if (!b.exist) continue;
    const auto i = static_cast<std::size_t>(n);
    float* r = out + written * 3;
    const bool same = e.monAbs[i] == b.AbsNum;
    for (int c = 0; c < 3; ++c)
      r[c] = same ? static_cast<float>(e.mon[i][static_cast<std::size_t>(c)])
                  : 0.0f;
    ++written;
  }
  return written;
}

// DrawRobSkin (main.frm:838-866): 9 floats por bot existente, misma fila
// que db_sim_dump_bots: [estado, OSkin(0..7)] con estado 1 = dibujar la
// polilinea (pos + OSkin(0,1)) -> (pos + OSkin(2,3)) -> ... -> (6,7),
// 0 = cadaver (el Sub sale sin tocar nada) y -1 = error 6 al asignar un
// OSkin (Integer): en el original aborta el Redraw entero (la pagina corta
// el pase). OSkin solo se recalcula cuando `oaim <> aim` — con skin o radio
// nuevos y el mismo aim se sigue dibujando la forma vieja, como el fuente.
// Decision de host: la cache se actualiza en cada volcado para todos los
// bots, no solo los visibles (el original solo la toca al dibujarlos).
DB_EXPORT int db_sim_dump_skins(void* h, float* out, int max_bots) {
  auto& Sh = H(h);
  const db::Sim& sim = Sh.sim;
  auto& e = Sh.e8;
  E8Resize(e, sim);
  int written = 0;
  for (int n = 1; n <= sim.MaxRobs && written < max_bots; ++n) {
    const db::Bot& b = sim.rob[n];
    if (!b.exist) continue;
    const auto i = static_cast<std::size_t>(n);
    float* r = out + written * 9;
    ++written;
    if (e.skinAbs[i] != b.AbsNum) {       // rob(posto) = blank
      e.skinAbs[i] = b.AbsNum;
      e.oaim[i] = 0.0f;
      e.oskin[i] = {};
    }
    if (b.Corpse) {
      r[0] = 0.0f;
      continue;
    }
    auto& os = e.oskin[i];
    bool ok = true;
    if (e.oaim[i] != b.aim) {
      // .OSkin(t) = (Cos(.Skin(t+1) / 100 - .aim) * .Skin(t)) * .radius / 60
      // (Integer / 100 es Double; aim y radius son Single promovidos).
      for (int t = 0; t <= 6 && ok; t += 2) {
        const double ang = static_cast<double>(b.Skin[t + 1]) / 100.0 -
                           static_cast<double>(b.aim);
        const double k = static_cast<double>(b.Skin[t]);
        const double rad = static_cast<double>(b.radius);
        ok = E8CInt(std::cos(ang) * k * rad / 60.0, os[t]) &&
             E8CInt(std::sin(ang) * k * rad / 60.0, os[t + 1]);
      }
      if (ok) e.oaim[i] = b.aim;          // .oaim = .aim tras el bucle
    }
    r[0] = ok ? 1.0f : -1.0f;
    for (int c = 0; c < 8; ++c) r[1 + c] = static_cast<float>(os[c]);
  }
  return written;
}

}  // extern "C"

extern "C" {
// SysvarTok(a) sin bot (DNATokenizing.bas:320-338, n = 0): lo usa el
// LostFocus de frmMonitorSet (:413-418) con "." & texto. Sin privadas.
DB_EXPORT int db_sim_sysvar_tok0(void* h, const char* name) {
  static const db::Bot none{};
  if (!name) return 0;
  return db::loader_detail::SysvarTok(name, none, *S(h).sysvars);
}
}  // extern "C"

extern "C" {
// Skin(i) del bot n (solo lectura; lo usa el smoke de E8 para verificar
// OSkin contra la formula de DrawRobSkin).
DB_EXPORT int db_sim_bot_skin(void* h, int n, int i) {
  const db::Sim& s = S(h);
  if (n < 1 || n >= static_cast<int>(s.rob.size()) || i < 0 || i > 13) return 0;
  return s.rob[n].Skin[static_cast<std::size_t>(i)];
}
DB_EXPORT float db_sim_bot_aim(void* h, int n) {
  const db::Sim& s = S(h);
  if (n < 1 || n >= static_cast<int>(s.rob.size())) return 0.0f;
  return s.rob[n].aim;
}
}  // extern "C"

// ---------------------------------------------------------------------------
// E8 — AssignSkin (OptionsForm.frm:3411-3472): la skin de una especie, que
// el original genera al agregarla en el formulario de opciones (:3301) y
// loadrobs copia a cada fundador (main.frm:1552). Determinista por nombre y
// ADN tokenizado (Rnd con argumento negativo re-siembra), salvo el Randomize
// final (Timer) que decide Skin(6). Decision de host: corre sobre un LCG
// propio, no el de la sim — en el original usaba el global, pero antes de
// una sim nueva eso lo borra el `Rnd -1 : Randomize seed/100` de
// startloaded; con la sim en marcha, re-sembraba su RNG con el reloj (no se
// replica: el port no toca el RNG de la sim desde la UI).
// ---------------------------------------------------------------------------
namespace {

// Rnd(number) de VB6: < 0 re-siembra, = 0 repite el ultimo, > 0 avanza.
db::vb_single RndArg(db::VbRng& r, db::vb_single n) {
  if (n < 0.0f) return r.rnd_negative(n);
  if (n == 0.0f) return r.rnd0();
  return r();
}

}  // namespace

extern "C" {

DB_EXPORT void db_sim_species_assign_skin(void* h, int idx, double timer) {
  db::Sim& sim = S(h);
  if (idx < 0 || static_cast<std::size_t>(idx) >= sim.Specie.size()) return;
  db::Specie& sp = sim.Specie[static_cast<std::size_t>(idx)];
  db::VbRng rng;
  rng.randomize(0.0);                                   // Randomize 0

  // robname = Replace(Name, ".txt", "") — todas las apariciones.
  std::string robname = sp.Name;
  for (std::size_t p; (p = robname.find(".txt")) != std::string::npos;)
    robname.erase(p, 4);

  double newR = 0.0, nextR = 0.0;
  // ReDim dbls(Len - 1): con nombre vacio el original daria error 9; aqui
  // se saltea el tramo del nombre.
  std::vector<double> dbls;
  for (unsigned char c : robname)                       // pre seeds
    dbls.push_back(RndArg(rng, -static_cast<db::vb_single>(c)));
  for (double d : dbls) {                               // randomize by name
    newR = d;
    nextR = RndArg(rng, -db::vb_angle(0.0f, 0.0f,
                                      static_cast<db::vb_single>(nextR - 0.5),
                                      static_cast<db::vb_single>(newR - 0.5)));
  }
  const double nameR = nextR;
  newR = 0.0;
  nextR = 0.0;

  db::Bot tmp;                                          // rob(0)
  if (db::LoadDNAText(sp.dnatext, tmp, *sim.sysvars)) {
    rng.randomize(0.0);
    dbls.assign(tmp.dna.size(), 0.0);
    for (std::size_t x = 0; x < tmp.dna.size(); ++x) {  // pre seeds
      // Los argumentos de angle() se evaluan de izquierda a derecha.
      const db::vb_single a = RndArg(
          rng, -static_cast<db::vb_single>(tmp.dna[x].value));
      const db::vb_single b = RndArg(
          rng, -static_cast<db::vb_single>(tmp.dna[x].tipo));
      dbls[x] = RndArg(rng, -db::vb_angle(0.0f, 0.0f, a - 0.5f, b - 0.5f));
    }
    for (double d : dbls) {                             // randomize by dna
      newR = d;
      nextR = RndArg(rng, -db::vb_angle(0.0f, 0.0f,
                                        static_cast<db::vb_single>(nextR - 0.5),
                                        static_cast<db::vb_single>(newR - 0.5)));
    }
  }

  rng.randomize(nextR * 1000.0);
  // Int(Rnd * (half + 1)) / Int(Rnd * 629): Single * Integer = Single.
  for (int i = 0; i <= 7; i += 2) {
    sp.Skin[static_cast<std::size_t>(i)] =
        static_cast<db::vb_integer>(std::floor(rng() * 61.0f));
    if (i == 4) rng.randomize(nameR * 1000.0);
    sp.Skin[static_cast<std::size_t>(i + 1)] =
        static_cast<db::vb_integer>(std::floor(rng() * 629.0f));
  }
  rng.randomize(static_cast<double>(static_cast<db::vb_single>(timer)));
  // (Skin(6) + Int(Rnd * 61) * 2) / 3 → Integer (bancario).
  const float r6 = std::floor(rng() * 61.0f) * 2.0f;
  sp.Skin[6] = db::vb_cint(
      static_cast<double>(static_cast<float>(sp.Skin[6]) + r6) / 3.0);
}

}  // extern "C"
