// M10 — API WASM del core hacia la capa de presentacion web (PROGRESO.md
// "Siguiente" M10, sobre la semilla de M9). Contrato de fidelidad intacto:
// esta capa solo llama a funciones del core y copia bytes/floats hacia el
// host; no recalcula fisica ni consume RNG por su cuenta (las unicas
// extracciones de RNG que origina — posicion de fundadores, posicion de
// teleporters nuevos, Randomize — son las mismas que hacia la UI de VB6 en
// loadrobs / NewTeleporter / startloaded, transcritas y citadas).
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
  auto& o = S(h).opts;
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
    default: break;  // id desconocido: no-op (contrato tolerante)
  }
}

DB_EXPORT double db_sim_get_opt(void* h, int id) {
  const auto& o = S(h).opts;
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

// 8 floats por bot existente:
//   [indice, pos.x, pos.y, radius, aim, nrg, color RGB (Long BGR), flags]
// flags: bit0 = Veg, bit1 = Fixed, bit2 = Corpse, bit3 = Multibot.
// Devuelve cuantos bots escribio (como maximo max_bots).
DB_EXPORT int db_sim_dump_bots(void* h, float* out, int max_bots) {
  const db::Sim& sim = S(h);
  int written = 0;
  for (int n = 1; n <= sim.MaxRobs && written < max_bots; ++n) {
    const db::Bot& b = sim.rob[n];
    if (!b.exist) continue;
    float* r = out + written * 8;
    r[0] = static_cast<float>(n);
    r[1] = b.pos.x;
    r[2] = b.pos.y;
    r[3] = b.radius;
    r[4] = b.aim;
    r[5] = b.nrg;
    r[6] = static_cast<float>(b.color);
    r[7] = static_cast<float>((b.Veg ? 1 : 0) | (b.Fixed ? 2 : 0) |
                              (b.Corpse ? 4 : 0) | (b.Multibot ? 8 : 0));
    ++written;
  }
  return written;
}

// 6 floats por shot vivo: [x, y, vel.x, vel.y, color, shottype].
DB_EXPORT int db_sim_dump_shots(void* h, float* out, int max_shots) {
  const db::Sim& sim = S(h);
  int written = 0;
  for (db::vb_long n = 1; n <= sim.maxshotarray && written < max_shots; ++n) {
    const db::Shot& s = sim.Shots[static_cast<std::size_t>(n)];
    if (!s.exist) continue;
    float* r = out + written * 6;
    r[0] = s.pos.x;
    r[1] = s.pos.y;
    r[2] = s.velocity.x;
    r[3] = s.velocity.y;
    r[4] = static_cast<float>(s.color);
    r[5] = static_cast<float>(s.shottype);
    ++written;
  }
  return written;
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

}  // extern "C"
