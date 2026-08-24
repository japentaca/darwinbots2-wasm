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
inline constexpr vb_integer kBodyFix = 32100;  // bodyfix (HDRoutines.bas:854):
                                               // P4 anti-gigantes muerta
                                               // (31-ENERGIA.md)

// Índices de SimOpts.Costs (SimOptions.bas:2-38). Los de la VM ya están en
// Costs (vm.hpp); aquí los del ciclo.
namespace cost {
inline constexpr int CHLRCOST = 8;
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
inline constexpr int COSTMULTIPLIER = 54;
inline constexpr int AGECOSTMAKELINEAR = 60;
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
  bool ZeroMomentum = false;
  bool Pondmode = false, Updnconnected = false, Dxsxconnected = false;
  bool CorpseEnabled = true;
  bool DisableTies = false, DisableFixing = false, DisableTypArepro = false;
  vb_long BadWastelevel = 400;  // Robots.bas:1186: 0 se corrige a 400
  vb_single Decay = 0;
  vb_long Decaydelay = 100;
  int DecayType = 0;  // 0/1 sin shot, 2 waste, 3 nrg
  bool NoShotDecay = false, NoWShotDecay = false;
  bool FixedBotRadii = false;
  vb_single MaxPopulation = 100;
  vb_long MinVegs = 0;
  vb_long TotRunCycle = 0;
  vb_long TotBorn = 0;
  bool Restart = false, F1 = false;
};

// Registro de especies mínimo (SimOpts.Specie): lo que UpdateCounters y
// WriteSenses necesitan (población por FName).
struct Specie {
  std::string Name;
  vb_long population = 0;
  bool Native = true;
};

// Contadores de stubs documentados: cada camino del fuente aún no transcrito
// que un caso dorado futuro cubrirá registra su paso por aquí (misma política
// que VmDiag, 10-CICLO.md §14).
struct SimDiag {
  int bordercolls_stub = 0;      // B1/F-*: colisiones con el borde
  int tie_force_stub = 0;        // B4/F-*: fuerzas de muelle de TieHooke
  int tietorque_stub = 0;        // B4/F-*
  int shot_feed_stub = 0;        // B3a: releasenrg/takenrg/releasebod/addgene
  int makevirus_stub = 0;        // B3b: MakeVirus/copygene
  int mutate_stub = 0;           // B6b: mutate con mutaciones activas
  int makestuff_stub = 0;        // B5: storevenom/storepoison/makeshell/makeslime
  int handlewaste_stub = 0;      // B5/B7: feedveg2/altzheimer/defacate
  int sexrepro_stub = 0;         // B6a: SexReproduce
  int vision_sweep_stub = 0;     // B2/F-*: BucketsProximity (barrido real)
  int world_stub = 0;            // B7: feedvegs/repoblación/teleporters
  int shot_collision_simplified = 0;  // F-*: NewShotCollision punto-en-círculo
  int bot_collision_simplified = 0;   // F-*: BucketsCollision por fuerza bruta
};

struct Sim {
  SimOptsT opts;
  VmContext vm;  // stacks globales + Costs + VmDiag
  SimDiag diag;
  RndSource* rndy = nullptr;
  const SysvarTable* sysvars = &DefaultSysvarTable();

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
  vb_single LightAval = 0;  // Vegs.bas:15 (el cálculo real es B7)
  vb_long AllChlr = 0;
  vb_long TotalChlr = 0;
  bool StartAnotherRound = false;

  std::vector<Specie> Specie;

  // Shots (Shots.bas:39-44). Índice 0 sin uso, como el original.
  std::vector<Shot> Shots = std::vector<Shot>(301);
  vb_long shotpointer = 1;
  vb_long maxshotarray = 300;
  vb_long numshots = 0;
  vb_long ShotsThisCycle = 0;

  Sim() { vm.xDivisor = 1.0f; vm.yDivisor = 1.0f; }

  vb_single rnd() { return (*rndy)(); }
};

// ---- utilidades compartidas del ciclo ----

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
inline void GiveAbsNum(Sim& sim, int n) {
  sim.MaxAbsNum += 1;
  sim.rob[n].AbsNum = sim.MaxAbsNum;
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
  sim.Specie.push_back({sim.rob[n].FName, 1, false});
}

}  // namespace db
