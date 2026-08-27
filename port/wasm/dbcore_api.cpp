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
//  - SimGUID ausente: el original lo regeneraba con Rnd CRUDO (fuera del
//    flujo rndy); aqui queda en 0 (LoadSimulation ya lo documenta). El host
//    puede fijarlo si algun dia lo necesita; ningun sistema del core lo lee.
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
#include <new>
#include <string>

#include "dbcore/buckets.hpp"
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

// Arranque de sim: los pasos del Form_Load/startloaded de main.frm que
// preparan el mundo alrededor del core. Con seed != 0 replica startloaded
// (main.frm: `Rnd -1 : Randomize UserSeedNumber / 100`); con seed = 0 deja
// el estado del LCG como este.
DB_EXPORT void db_sim_start(void* h, double seed) {
  auto& Sh = H(h);
  db::Sim& sim = Sh.sim;
  if (seed != 0.0) {
    sim.opts.UserSeedNumber = static_cast<db::vb_long>(seed);
    Sh.rng.rnd_negative(-1.0f);
    Sh.rng.randomize(seed / 100.0);
  }
  RecomputeDivisors(sim);       // main.frm:1432-1435
  db::InitBuckets(sim);         // main.frm:1420 (fija MaxBotShotSeperation)
  sim.shotpointer = 1;          // main.frm:1460
  // main.frm:1507-1510 — la deuda inicial de la repoblacion (B-37) y los
  // contadores del primer ciclo.
  sim.cooldown = -sim.opts.RepopCooldown;
  sim.totnvegsDisplayed = -1;
  sim.totvegs = -1;
  sim.totnvegs =
      static_cast<int>(db::vb_round64(sim.vm.costs.v[53]));  // DYNAMICCOSTTARGET
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
    case 14: o.Density = f; break;
    case 15: o.Viscosity = f; break;
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
  sp.Stnrg = static_cast<db::vb_integer>(stnrg);
  sp.color = color;
  sp.qty = static_cast<db::vb_integer>(qty > 0 ? qty : 1);
  sp.Native = true;
  sim.Specie.push_back(sp);
  return static_cast<int>(sim.Specie.size()) - 1;
}

DB_EXPORT int db_sim_num_species(void* h) {
  return static_cast<int>(S(h).Specie.size());
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
    const int a = db::InsertFounder(sim, sp.dnatext, sp.Name, cfg);
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
                              (b.Corpse ? 4 : 0) | (b.Multibot ? 8 : 0));
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
        h, static_cast<int>(db::Random(
               1.0, static_cast<double>(sim.numObstacles), *sim.rndy)));
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

// Teleport.bas:60-105 — NewTeleporter(PortIn, PortOut, Height, Internet),
// transcrito: posicion sorteada con el MISMO flujo RNG (Random dos veces,
// con teleporterDefaultWidth = 300, el default de TeleportForm.frm:378),
// Width = Height * aspectRatio, color vbWhite, drift en ambos ejes. `local_`
// es el modo local del form (entrada+salida con ReSpawn en la misma sim).
// Los parametros de sondeo del inbox (botsPerPoll/pollCycles) son del form
// de Internet. Devuelve el indice o -1 con el tope de 10.
DB_EXPORT int db_sim_add_teleporter(void* h, int portIn, int portOut,
                                    float height, int internet, int local_,
                                    int teleVeggies, int teleCorpses,
                                    int botsPerPoll, int pollCycles) {
  db::Sim& sim = S(h);
  if (sim.numTeleporters + 1 > db::MAXTELEPORTERS) return -1;
  sim.numTeleporters += 1;
  db::Teleporter& t =
      sim.Teleporters[static_cast<std::size_t>(sim.numTeleporters)];
  t = db::Teleporter{};
  t.exist = true;
  const db::vb_single aspectRatio = static_cast<db::vb_single>(
      static_cast<double>(sim.opts.FieldHeight) /
      static_cast<double>(sim.opts.FieldWidth));
  constexpr double kDefaultWidth = 300.0;  // TeleportForm.frm:378
  t.pos.x = static_cast<db::vb_single>(
      db::Random(0.0, sim.opts.FieldWidth - kDefaultWidth * aspectRatio,
                 *sim.rndy));
  t.pos.y = static_cast<db::vb_single>(
      db::Random(0.0, sim.opts.FieldHeight - kDefaultWidth, *sim.rndy));
  t.Width = height * aspectRatio;
  t.Height = height;
  t.color = 0xFFFFFF;  // vbWhite
  t.In = portIn != 0;
  t.Out = portOut != 0;
  t.Internet = internet != 0;
  t.local = local_ != 0;
  t.driftHorizontal = true;
  t.driftVertical = true;
  t.teleportVeggies = teleVeggies != 0;
  t.teleportCorpses = teleCorpses != 0;
  t.BotsPerPoll = static_cast<db::vb_integer>(botsPerPoll);
  t.InboundPollCycles = static_cast<db::vb_integer>(pollCycles);
  t.PollCountDown = t.InboundPollCycles;
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

// ---------------------------------------------------------------------------
// Formatos (E/S sobre buferes en memoria; el host decide que hacer con ellos)
// ---------------------------------------------------------------------------

DB_EXPORT void db_free(void* p) { std::free(p); }

// SaveSimulation al formato binario de sim. Devuelve un bufer malloc'd
// (liberar con db_free) y su longitud en *out_len.
DB_EXPORT unsigned char* db_sim_save(void* h, int* out_len) {
  db::VbBinFile f;
  db::SaveSimulation(S(h), f);
  return CopyOut(f.data.data(), f.data.size(), out_len);
}

// LoadSimulation desde un bufer. Resetea la sim del handle y despues aplica
// el post-carga de startloaded (main.frm): divisores, Init_Buckets y
// `Rnd -1 : Randomize UserSeedNumber / 100` (incondicional en el original).
DB_EXPORT void db_sim_load(void* h, const unsigned char* data, int len) {
  auto& Sh = H(h);
  Sh.sim = db::Sim{};
  Sh.wire();
  db::VbBinFile f;
  f.data.assign(data, data + (len > 0 ? len : 0));
  db::LoadSimulation(Sh.sim, f);
  RecomputeDivisors(Sh.sim);
  db::InitBuckets(Sh.sim);
  Sh.rng.rnd_negative(-1.0f);
  Sh.rng.randomize(static_cast<double>(Sh.sim.opts.UserSeedNumber) / 100.0);
}

// SaveOrganism (.dbo) del organismo que contiene al bot `n` (celulas atadas
// incluidas). Bufer malloc'd; liberar con db_free.
DB_EXPORT unsigned char* db_sim_save_organism(void* h, int n, int* out_len) {
  db::Sim& sim = S(h);
  if (out_len) *out_len = 0;
  if (n < 1 || n > sim.MaxRobs || !sim.rob[n].exist) return nullptr;
  db::VbBinFile f;
  db::SaveOrganism(sim, f, n);
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
