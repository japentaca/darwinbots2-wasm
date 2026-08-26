// dbcore/robots.hpp — Robots.bas: las rutinas por bot del tick (Upkeep,
// Poisons, Ageing, Shooting, ManageBody/Death/Reproduction, Shock, FireTies,
// DoGeneticMemory, Reproduce, KillRobot) y UpdateBots con sus 7 pasadas en el
// orden de 10-CICLO.md §5. Las pasadas/ramas que no tocan memoria y
// pertenecen a otros milestones quedan como stubs registrados en SimDiag.
#pragma once

#include "mutations.hpp"
#include "physics.hpp"
#include "senses.hpp"
#include "shots.hpp"
#include "sim.hpp"
#include "ties.hpp"
#include "vegs.hpp"

namespace db {

// Robots.bas:1000-1038 — Upkeep (P1): costes + decaimiento de slime/poison
// x0.98 con publicación in place.
inline void Upkeep(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  auto& C = sim.vm.costs.v;

  const vb_long ageDelta =
      b.age - static_cast<vb_long>(vb_round64(C[cost::AGECOSTSTART]));
  if (ageDelta > 0 && b.age > 0) {
    vb_single Cost;
    if (C[cost::AGECOSTMAKELOG] == 1.0f)
      Cost = C[cost::AGECOST] *
             static_cast<vb_single>(std::log(static_cast<double>(ageDelta)));
    else if (C[cost::AGECOSTMAKELINEAR] == 1.0f)
      Cost = C[cost::AGECOST] +
             (static_cast<vb_single>(ageDelta) * C[cost::AGECOSTLINEARFRACTION]);
    else
      Cost = C[cost::AGECOST];
    b.nrg -= Cost * C[cost::COSTMULTIPLIER];
  }

  b.nrg -= b.body * C[cost::BODYUPKEEP] * C[cost::COSTMULTIPLIER];
  b.nrg -= (b.DnaLen - 1) * C[cost::DNACYCCOST] * C[cost::COSTMULTIPLIER];

  b.Slime *= 0.98f;
  if (b.Slime < 0.5f) b.Slime = 0.0f;
  b.mem[821] = vb_cint(b.Slime);

  b.poison *= 0.98f;
  if (b.poison < 0.5f) b.poison = 0.0f;
  b.mem[827] = vb_cint(b.poison);
}

// Robots.bas:1114-1137 — Poisons (P1): reescriben mem(Vloc)/mem(Ploc) cada
// ciclo mientras dure el contador; Vloc/Ploc = 0 escribe en mem(0) (M-03).
inline void Poisons(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.Paralyzed) b.mem[b.Vloc] = b.Vval;
  if (b.Paralyzed) {
    b.Paracount -= 1.0f;
    if (b.Paracount < 1.0f) {
      b.Paralyzed = false;
      b.Vloc = 0;
      b.Vval = 0;
    }
  }
  b.mem[837] = static_cast<vb_integer>(
      std::floor(static_cast<double>(b.Paracount)));  // Int()

  if (b.Poisoned) b.mem[b.Ploc] = b.Pval;
  if (b.Poisoned) {
    b.Poisoncount -= 1.0f;
    if (b.Poisoncount < 1.0f) {
      b.Poisoned = false;
      b.Ploc = 0;
      b.Pval = 0;
    }
  }
  b.mem[838] = static_cast<vb_integer>(
      std::floor(static_cast<double>(b.Poisoncount)));
}

// Robots.bas:1352-1360 — ManageFixed (P1): lee mem(216) (fixpos).
inline void ManageFixed(Sim& sim, int n) {
  sim.rob[n].Fixed = (sim.rob[n].mem[216] > 0);
}

inline void KillRobot(Sim& sim, int n);  // adelantada (UpdateCounters la usa)

// Shots.bas:457-500 — Decay del corpse: consume 1 RNG por pulso de decay
// (aim aleatorio) y emite el shot según DecayType.
inline void Decay(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  b.DecayTimer += 1;
  if (b.DecayTimer >= sim.opts.Decaydelay) {
    b.DecayTimer = 0;
    b.aim = sim.rnd() * 2.0f * PI;
    b.aimvector = VectorSet(
        static_cast<vb_single>(std::cos(static_cast<double>(b.aim))),
        static_cast<vb_single>(std::sin(static_cast<double>(b.aim))));
    vb_single va;
    if (b.body > sim.opts.Decay / 10.0f)
      va = sim.opts.Decay;
    else if (b.body > 0.0f)
      va = b.body;
    else
      va = 0.0f;
    if (sim.opts.DecayType == 2 && va != 0.0f) newshot(sim, n, -4, va, 1.0f);
    if (sim.opts.DecayType == 3 && va != 0.0f) newshot(sim, n, -2, va, 1.0f);
    // la resta de body del pulso pertenece a B5 (31-ENERGIA); con
    // Decay = 0 (default del harness) va = 0 y no hay efecto
    b.body -= va / 10.0f;
    if (b.body < 0.0f) b.body = 0.0f;
  }
}

// Robots.bas:1139-1172 — UpdateCounters (P2): contadores + Decay/KillRobot
// inmediato para corpses sin body.
inline void UpdateCounters(Sim& sim, int n) {
  sim.TotalRobots += 1;

  std::size_t i = SpeciesFromBot(sim, n);
  if (!sim.rob[n].Corpse) {
    if (i == sim.Specie.size())
      AddSpecie(sim, n);
    else
      sim.Specie[i].population += 1;
  }
  if (i < sim.Specie.size() && sim.Specie[i].population > 32000)
    sim.Specie[i].population = 32000;

  if (sim.rob[n].Veg) {
    sim.totvegs += 1;
  } else if (sim.rob[n].Corpse) {
    sim.totcorpse += 1;
    if (sim.rob[n].body > 0.0f)
      Decay(sim, n);
    else
      KillRobot(sim, n);  // muerte inmediata en mitad de la pasada
  } else {
    sim.totnvegs += 1;
  }
}

// Robots.bas:2010-2048 — storevenom: 1 venom por 1 nrg (tasa 1). Publica
// mem(825) con Int() = FLOOR, no CInt ([PROBABLE BUG] B5-2 / B-26: venom 1:1
// vs poison 4:1 — geometría del código). Disqualify: capa torneo ⚙, fuera.
inline void storevenom(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  constexpr vb_single venomNrgConvRate = 1.0f;
  if (b.nrg <= 0.0f) return;

  if (b.mem[824] > 32000) b.mem[824] = 32000;
  if (b.mem[824] < -32000) b.mem[824] = -32000;

  vb_single Delta = static_cast<vb_single>(b.mem[824]);
  if (std::fabs(Delta) > b.nrg / venomNrgConvRate)
    Delta = static_cast<vb_single>(vb_sgn(Delta)) * b.nrg / venomNrgConvRate;
  if (std::fabs(Delta) > 100.0f)
    Delta = static_cast<vb_single>(vb_sgn(Delta)) * 100.0f;
  if (b.venom + Delta > 32000.0f) Delta = 32000.0f - b.venom;
  if (b.venom + Delta < 0.0f) Delta = -b.venom;

  b.venom = b.venom + Delta;
  b.nrg = b.nrg - (std::fabs(Delta) * venomNrgConvRate);

  const vb_single Cost = std::fabs(Delta) * sim.vm.costs.v[cost::VENOMCOST] *
                         sim.vm.costs.v[cost::COSTMULTIPLIER];
  b.nrg = b.nrg - Cost;
  b.Waste = b.Waste + Cost;

  b.mem[824] = 0;
  b.mem[825] = static_cast<vb_integer>(
      std::floor(static_cast<double>(b.venom)));  // Int(), no CInt
}

// Robots.bas:2050-2089 — storepoison: 4 poison por 1 nrg (tasa 0.25; B-26).
inline void storepoison(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  constexpr vb_single poisonNrgConvRate = 0.25f;
  if (b.nrg <= 0.0f) return;

  if (b.mem[826] > 32000) b.mem[826] = 32000;
  if (b.mem[826] < -32000) b.mem[826] = -32000;

  vb_single Delta = static_cast<vb_single>(b.mem[826]);
  if (std::fabs(Delta) > b.nrg / poisonNrgConvRate)
    Delta = static_cast<vb_single>(vb_sgn(Delta)) * b.nrg / poisonNrgConvRate;
  if (std::fabs(Delta) > 100.0f)
    Delta = static_cast<vb_single>(vb_sgn(Delta)) * 100.0f;
  if (b.poison + Delta > 32000.0f) Delta = 32000.0f - b.poison;
  if (b.poison + Delta < 0.0f) Delta = -b.poison;

  b.poison = b.poison + Delta;
  b.nrg = b.nrg - (std::fabs(Delta) * poisonNrgConvRate);

  const vb_single Cost = std::fabs(Delta) * sim.vm.costs.v[cost::POISONCOST] *
                         sim.vm.costs.v[cost::COSTMULTIPLIER];
  b.nrg = b.nrg - Cost;
  b.Waste = b.Waste + Cost;

  b.mem[826] = 0;
  b.mem[827] = vb_cint(b.poison);
}

// Robots.bas:886-931 — makeshell: 10 shell por 1 nrg (tasa 0.1); coste de
// transacción rebajado para multibots, pero el Waste sube por el coste
// COMPLETO (literal del fuente).
inline void makeshell(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  constexpr vb_single shellNrgConvRate = 0.1f;
  if (b.nrg <= 0.0f) return;

  if (b.mem[822] > 32000) b.mem[822] = 32000;
  if (b.mem[822] < -32000) b.mem[822] = -32000;

  vb_single Delta = static_cast<vb_single>(b.mem[822]);
  if (std::fabs(Delta) > b.nrg / shellNrgConvRate)
    Delta = static_cast<vb_single>(vb_sgn(Delta)) * b.nrg / shellNrgConvRate;
  if (std::fabs(Delta) > 100.0f)
    Delta = static_cast<vb_single>(vb_sgn(Delta)) * 100.0f;
  if (b.shell + Delta > 32000.0f) Delta = 32000.0f - b.shell;
  if (b.shell + Delta < 0.0f) Delta = -b.shell;

  b.shell = b.shell + Delta;
  b.nrg = b.nrg - (std::fabs(Delta) * shellNrgConvRate);

  const vb_single Cost = std::fabs(Delta) * sim.vm.costs.v[cost::SHELLCOST] *
                         sim.vm.costs.v[cost::COSTMULTIPLIER];
  if (b.Multibot)
    b.nrg = b.nrg - Cost / ((b.numties < 0.0f ? 0.0f : b.numties) + 1.0f);
  else
    b.nrg = b.nrg - Cost;
  b.Waste = b.Waste + Cost;

  b.mem[822] = 0;
  b.mem[823] = vb_cint(b.shell);
}

// Robots.bas:933-980 — makeslime: 10 slime por 1 nrg; tope 200/ciclo (los
// demás topan en 100).
inline void makeslime(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  constexpr vb_single slimeNrgConvRate = 0.1f;
  if (b.nrg <= 0.0f) return;

  if (b.mem[820] > 32000) b.mem[820] = 32000;
  if (b.mem[820] < -32000) b.mem[820] = -32000;

  vb_single Delta = static_cast<vb_single>(b.mem[820]);
  if (std::fabs(Delta) > b.nrg / slimeNrgConvRate)
    Delta = static_cast<vb_single>(vb_sgn(Delta)) * b.nrg / slimeNrgConvRate;
  if (std::fabs(Delta) > 200.0f)
    Delta = static_cast<vb_single>(vb_sgn(Delta)) * 200.0f;
  if (b.Slime + Delta > 32000.0f) Delta = 32000.0f - b.Slime;
  if (b.Slime + Delta < 0.0f) Delta = -b.Slime;

  b.Slime = b.Slime + Delta;
  b.nrg = b.nrg - (std::fabs(Delta) * slimeNrgConvRate);

  const vb_single Cost = std::fabs(Delta) * sim.vm.costs.v[cost::SLIMECOST] *
                         sim.vm.costs.v[cost::COSTMULTIPLIER];
  if (b.Multibot)
    b.nrg = b.nrg - Cost / ((b.numties < 0.0f ? 0.0f : b.numties) + 1.0f);
  else
    b.nrg = b.nrg - Cost;
  b.Waste = b.Waste + Cost;

  b.mem[820] = 0;
  b.mem[821] = vb_cint(b.Slime);
}

// Robots.bas:1174-1182 — MakeStuff (P5): reales desde M6 (B-26).
// sharechloroplasts cerrado en M7 (ties.hpp): makestuff_stub queda a 0.
// (El decremento de Chlr_Share_Delay vive en feedveg2, Vegs.bas:219-221 —
// milestone de mundo.)
inline void MakeStuff(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.mem[824] != 0) storevenom(sim, n);
  if (b.mem[826] != 0) storepoison(sim, n);
  if (b.mem[822] != 0) makeshell(sim, n);
  if (b.mem[820] != 0) makeslime(sim, n);
}

// Robots.bas:983-997 — altzheimer: el waste alto escribe basura en la
// memoria. loops es Integer: (Pwaste + Waste - BadWastelevel)/4 redondea
// bancario. Por escritura: re-sortea loc hasta esquivar mkchlr/rmchlr
// (1 RNG + 1 por re-tirada) y consume 1 RNG para el valor.
inline void altzheimer(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  // La resta corre en Single (Pwaste + Waste - BadWastelevel); la división
  // /4 promociona a Double y la asignación a Integer redondea bancario.
  const vb_single excess =
      b.Pwaste + b.Waste - static_cast<vb_single>(sim.opts.BadWastelevel);
  const vb_integer loops = vb_cint(static_cast<double>(excess) / 4.0);
  for (vb_integer t = 1; t <= loops; ++t) {
    vb_integer loc;
    do {
      loc = static_cast<vb_integer>(Random(1, 1000, *sim.rndy));
    } while (!(loc != addr::mkchlr && loc != addr::rmchlr));
    const vb_integer val =
        static_cast<vb_integer>(Random(-32000, 32000, *sim.rndy));
    b.mem[loc] = val;
  }
}

// Robots.bas:1184-1196 — HandleWaste (P5): feedveg2 (digestión de waste,
// 1 RNG), altzheimer (RNG por escritura), defacate y publicaciones.
inline void HandleWaste(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.Waste > 0.0f && b.chloroplasts > 0.0f) feedveg2(sim, n);
  if (sim.opts.BadWastelevel == 0) sim.opts.BadWastelevel = 400;
  if (sim.opts.BadWastelevel > 0 &&
      b.Pwaste + b.Waste > static_cast<vb_single>(sim.opts.BadWastelevel))
    altzheimer(sim, n);
  if (b.Waste > 32000.0f) defacate(sim, n);
  if (b.Pwaste > 32000.0f) b.Pwaste = 32000.0f;
  if (b.Waste < 0.0f) b.Waste = 0.0f;
  b.mem[828] = vb_cint(b.Waste);
  b.mem[829] = vb_cint(b.Pwaste);
}

// Robots.bas:1198-1209 — Ageing (P5): edad, robage y el timer epigenético
// con su wrap manual +32000 -> -32000 (M-08).
inline void Ageing(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  b.age += 1;
  b.newage += 1;
  vb_long tempAge = b.age;
  if (tempAge > 32000) tempAge = 32000;
  b.mem[addr::robage] = static_cast<vb_integer>(tempAge);
  vb_long timerv = static_cast<vb_long>(b.mem[addr::timersys]) + 1;
  if (timerv > 32000) timerv = -32000;  // wrap manual del fuente
  b.mem[addr::timersys] = static_cast<vb_integer>(timerv);
}

// Robots.bas:1211-1215 — Shooting (P5): consume mem(shoot) SIEMPRE.
inline void Shooting(Sim& sim, int n) {
  if (sim.rob[n].mem[addr::shoot] != 0) robshoot(sim, n);
  sim.rob[n].mem[addr::shoot] = 0;
}

// Robots.bas:1236-1260 — ChangeChlr: no filtra signos una vez dentro
// ([PROBABLE BUG] A3-10).
inline void ChangeChlr(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  const vb_single tmpchlr = b.chloroplasts;
  b.chloroplasts += b.mem[addr::mkchlr];
  b.chloroplasts -= b.mem[addr::rmchlr];
  if (tmpchlr < b.chloroplasts) {
    const vb_single newnrg =
        b.nrg - (b.chloroplasts - tmpchlr) * sim.vm.costs.v[cost::CHLRCOST] *
                    sim.vm.costs.v[cost::COSTMULTIPLIER];
    if ((sim.TotalChlr > sim.opts.MaxPopulation && b.Veg) || newnrg < 100.0f)
      b.chloroplasts = tmpchlr;
    else
      b.nrg = newnrg;
  }
  b.mem[addr::mkchlr] = 0;
  b.mem[addr::rmchlr] = 0;
}

// Robots.bas:1217-1234 — ManageChlr (P5).
inline void ManageChlr(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.mem[addr::mkchlr] > 0 || b.mem[addr::rmchlr] > 0) ChangeChlr(sim, n);
  b.chloroplasts -=
      0.5f / static_cast<vb_single>(
                 std::pow(100.0, static_cast<double>(b.chloroplasts) / 16000.0));
  if (b.chloroplasts > 32000.0f) b.chloroplasts = 32000.0f;
  if (b.chloroplasts < 0.0f) b.chloroplasts = 0.0f;
  b.mem[addr::chlr] = vb_cint(b.chloroplasts);
  b.mem[addr::light] =
      vb_cint(32000.0 - static_cast<double>(sim.LightAval) * 32000.0);
  b.radius = FindRadius(sim, n);
}

// Robots.bas:1698-1705 — storebody: clamp 100 in place, consumo solo si > 0.
inline void storebody(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  if (b.mem[addr::strbody] > 100) b.mem[addr::strbody] = 100;
  b.nrg -= b.mem[addr::strbody];
  b.body += b.mem[addr::strbody] / 10.0f;
  if (b.body > 32000.0f) b.body = 32000.0f;
  b.radius = FindRadius(sim, t);
  b.mem[addr::strbody] = 0;
}

// Robots.bas:1707-1714 — feedbody.
inline void feedbody(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  if (b.mem[addr::fdbody] > 100) b.mem[addr::fdbody] = 100;
  b.nrg += b.mem[addr::fdbody];
  b.body -= static_cast<vb_single>(b.mem[addr::fdbody]) / 10.0f;
  if (b.nrg > 32000.0f) b.nrg = 32000.0f;
  b.radius = FindRadius(sim, t);
  b.mem[addr::fdbody] = 0;
}

// Robots.bas:1262-1274 — ManageBody (P5): strbody/fdbody NEGATIVOS no se
// consumen jamás ([PROBABLE BUG] A3-7, M-04).
inline void ManageBody(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.mem[addr::strbody] > 0) storebody(sim, n);
  if (b.mem[addr::fdbody] > 0) feedbody(sim, n);
  if (b.body > 32000.0f) b.body = 32000.0f;
  if (b.body < 0.0f) b.body = 0.0f;
  b.mem[addr::body] = vb_cint(b.body);
}

// Robots.bas:1281-1297 — Shock: nrg = 0 ANTES de leer nrg/10 — la conversión
// a body es código muerto ([PROBABLE BUG] A1-1).
inline void Shock(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (!b.Veg && b.nrg > 3000.0f) {
    const double temp = static_cast<double>(b.onrg) - b.nrg;
    if (temp > b.onrg / 2.0f) {
      b.nrg = 0.0f;
      b.body = b.body + (b.nrg / 10.0f);  // suma 0: bug replicado tal cual
      if (b.body > 32000.0f) b.body = 32000.0f;
      b.radius = FindRadius(sim, n);
    }
  }
}

// Robots.bas:1300-1341 — ManageDeath (P5): corpse con nrg < 15 (M-12), ojos
// borrados una única vez; encola en kil().
inline void ManageDeath(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (sim.opts.CorpseEnabled) {
    if (!b.Corpse) {
      if (b.nrg < 15.0f && b.age > 0) {
        b.Corpse = true;
        b.FName = "Corpse";
        for (int i = 0; i <= 20; ++i) b.occurr[i] = 0;  // Erase .occurr
        b.Veg = false;
        b.Fixed = false;
        b.nrg = 0.0f;
        b.DisableDNA = true;
        b.DisableMovementSysvars = true;
        b.CantSee = true;
        b.VirusImmune = true;
        b.chloroplasts = 0.0f;
        for (int i = addr::EyeStart + 1; i <= addr::EyeEnd - 1; ++i)
          b.mem[i] = 0;
        b.Bouyancy = 0.0f;
      }
    }
    if (b.body < 0.5f) b.Dead = true;
  } else if (b.nrg < 0.5f || b.body < 0.5f) {
    b.Dead = true;
  }

  if (b.Dead) {
    sim.kil[sim.kl] = n;
    sim.kl += 1;
  }
}

// Robots.bas:1343-1351 — ManageBouyancy (P5): consume setboy.
inline void ManageBouyancy(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.mem[addr::setboy] != 0) {
    b.Bouyancy += static_cast<vb_single>(b.mem[addr::setboy]) / 32000.0f;
    if (b.Bouyancy < 0.0f) b.Bouyancy = 0.0f;
    if (b.Bouyancy > 1.0f) b.Bouyancy = 1.0f;
    b.mem[addr::rdboy] = vb_cint(static_cast<double>(b.Bouyancy) * 32000.0);
    b.mem[addr::setboy] = 0;
  }
}

// Robots.bas:1363-1401 — ManageReproduction (P5): puede encolar dos veces el
// mismo bot ([PROBABLE BUG] A1-5).
inline void ManageReproduction(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.fertilized >= 0) {
    b.fertilized -= 1;
    if (b.fertilized >= 0)
      b.mem[addr::SYSFERTILIZED] = b.fertilized;
    else
      b.mem[addr::SYSFERTILIZED] = 0;
  } else {
    if (b.fertilized < -10) {
      b.fertilized += 1;
    } else {
      if (b.fertilized == -1) {
        b.spermDNA.clear();
        b.spermDNAlen = 0;
      }
      b.fertilized = -2;
    }
  }

  if ((b.mem[addr::Repro] > 0 || b.mem[addr::mrepro] > 0) && !b.CantReproduce) {
    sim.rep[sim.rp] = n;
    sim.rp += 1;
  }
  if (b.mem[addr::SEXREPRO] > 0 && b.fertilized >= 0 && !b.CantReproduce) {
    sim.rep[sim.rp] = -n;
    sim.rp += 1;
  }
}

// Robots.bas:1404-1455 — FireTies (P5): mtie -> maketie (consume 1 RNG via
// maketie); lastopp prestado del padre o del lasttch.
inline void FireTies(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  bool resetlastopp = false;

  if (b.lastopp == 0 && b.age < 2 &&
      b.parent <= static_cast<vb_long>(sim.rob.size()) - 1) {
    // OJO: el fuente indexa rob(.parent) con parent = AbsNum del padre —
    // válido solo mientras slot == AbsNum (sims jóvenes); se replica tal cual.
    if (b.parent >= 0 && sim.rob[b.parent].exist) {
      b.lastopp = b.parent;
      resetlastopp = true;
    }
  }
  if (b.lastopp == 0 && b.lasttch != 0 &&
      b.lasttch <= static_cast<vb_long>(sim.rob.size()) - 1) {
    if (sim.rob[b.lasttch].exist) {
      b.lastopp = b.lasttch;
      resetlastopp = true;
    }
  }

  if (b.mem[addr::mtie] != 0) {
    if (b.lastopp > 0 && !sim.opts.DisableTies && b.lastopptype == 0) {
      Vector d = VectorSub(sim.rob[b.lastopp].pos, b.pos);
      const vb_single length = VectorMagnitude(d);
      const vb_single maxLength =
          RobSize * 4.0f + b.radius + sim.rob[b.lastopp].radius;
      if (length <= maxLength) {
        maketie(sim, n, static_cast<int>(b.lastopp),
                static_cast<vb_long>(b.radius + sim.rob[b.lastopp].radius +
                                     RobSize * 2),
                -20, b.mem[addr::mtie]);
      }
    }
    b.mem[addr::mtie] = 0;
  }
  if (resetlastopp) b.lastopp = 0;
}

// Robots.bas:2850-2866 — DoGeneticMemory (P3, gate age < 15): una celda por
// ciclo por la tie de nacimiento, solo si la celda sigue en 0 (M-05).
inline void DoGeneticMemory(Sim& sim, int t) {
  Bot& b = sim.rob[t];
  if (b.numties > 0.0f) {
    if (b.Ties[1].last > 0) {
      const int loc = 976 + static_cast<int>(b.age);
      if (b.mem[loc] == 0 && b.epimem[b.age] != 0) b.mem[loc] = b.epimem[b.age];
    }
  }
}

// Robots.bas:2869-2905 — simplecoll (sin obstáculos: capa B7).
inline bool simplecoll(Sim& sim, vb_long X, vb_long Y, int k) {
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist) {
      if (std::fabs(sim.rob[t].pos.x - static_cast<vb_single>(X)) <
              sim.rob[t].radius + sim.rob[k].radius &&
          std::fabs(sim.rob[t].pos.y - static_cast<vb_single>(Y)) <
              sim.rob[t].radius + sim.rob[k].radius) {
        if (k != t) return true;
      }
    }
  }
  constexpr vb_single smudgefactor = 10.0f;  // Globals.bas
  if (!sim.opts.Dxsxconnected) {
    if (static_cast<vb_single>(X) < sim.rob[k].radius + smudgefactor ||
        static_cast<vb_single>(X) + sim.rob[k].radius + smudgefactor >
            sim.opts.FieldWidth)
      return true;
  }
  if (!sim.opts.Updnconnected) {
    if (static_cast<vb_single>(Y) < sim.rob[k].radius + smudgefactor ||
        static_cast<vb_single>(Y) + sim.rob[k].radius + smudgefactor >
            sim.opts.FieldHeight)
      return true;
  }
  return false;
}

// mutate: real desde M7 (mutations.hpp — NeoMutations.bas completo).

// Robots.bas:2100-2413 — Reproduce (M-05, M-08): transcrito completo salvo
// las capas Delta2/PBM/F1 (mutación B6b; con mutaciones off no consumen RNG).
inline void Reproduce(Sim& sim, int n, vb_integer per) {
  if (sim.rob[n].body < 5.0f) return;
  if (sim.opts.DisableTypArepro && !sim.rob[n].Veg) return;

  if (sim.rob[n].body <= 2.0f || sim.rob[n].CantReproduce) return;
  if (sim.rob[n].Veg &&
      (sim.TotalChlr > sim.opts.MaxPopulation || sim.totvegsDisplayed < 0))
    return;
  if (sim.rob[n].Veg && (Random(0, 10, *sim.rndy) != 5) &&
      (sim.TotalChlr > sim.opts.MaxPopulation * 0.9f))
    return;
  if (sim.totvegsDisplayed == -1) return;

  per = static_cast<vb_integer>(per % 100);
  if (sim.reprofix && per < 3) sim.rob[n].Dead = true;  // greedy robots (⚙ evo)
  if (per <= 0) return;

  const vb_long sondist = static_cast<vb_long>(vb_round64(
      static_cast<double>(FindRadius(sim, n, per / 100.0f) +
                          FindRadius(sim, n, (100 - per) / 100.0f))));

  vb_single nnrg = (sim.rob[n].nrg / 100.0f) * static_cast<vb_single>(per);
  // nbody As Integer: la expresión es aritmética SINGLE en VB6 y el redondeo
  // bancario muerde el .5 exacto del float ([PROBABLE BUG] B6-4, B-30;
  // 501/100*50 -> 250.5f -> 250, 503/100*50 -> 251.5f -> 252). En double la
  // cuenta daría 251.4999... -> 251: la precisión Single es la spec.
  const vb_integer nbody = vb_cint(static_cast<double>(
      (sim.rob[n].body / 100.0f) * static_cast<vb_single>(per)));

  const vb_single tempnrg = sim.rob[n].nrg;
  if (tempnrg <= 0.0f) return;

  const vb_long nx = static_cast<vb_long>(vb_round64(
      static_cast<double>(sim.rob[n].pos.x +
                          absx(sim.rob[n].aim, static_cast<vb_single>(sondist),
                               0, 0, 0))));
  const vb_long ny = static_cast<vb_long>(vb_round64(
      static_cast<double>(sim.rob[n].pos.y +
                          absy(sim.rob[n].aim, static_cast<vb_single>(sondist),
                               0, 0, 0))));
  bool tests = simplecoll(sim, nx, ny, n);
  tests = tests || !sim.rob[n].exist;
  if (tests) return;

  const int nuovo = posto(sim);
  Bot& p = sim.rob[n];
  Bot& c = sim.rob[nuovo];

  sim.opts.TotBorn += 1;
  if (p.Veg) sim.totvegs += 1;

  // ReDim + copia desde el índice 1: dna(0) del hijo queda fantasma (0,0)
  // (Robots.bas:2156-2159, consistente con A2).
  c.dna.assign(p.dna.size(), Block{});
  for (std::size_t t = 1; t < p.dna.size(); ++t) c.dna[t] = p.dna[t];
  c.DnaLen = p.DnaLen;
  c.genenum = p.genenum;
  c.Mutables = p.Mutables;
  c.Mutations = p.Mutations;
  c.OldMutations = p.OldMutations;
  c.LastMut = 0;
  c.LastMutDetail = p.LastMutDetail;
  // usedvars/maxusedvars (Robots.bas:2171-2179): contadores de display
  // abandonados — el port no los modela (decisión de M3).
  c.Skin = p.Skin;

  c.mem.fill(0);   // Erase rob(nuovo).mem
  c.Ties = {};     // Erase rob(nuovo).Ties

  c.pos.x = p.pos.x + absx(p.aim, static_cast<vb_single>(sondist), 0, 0, 0);
  c.pos.y = p.pos.y + absy(p.aim, static_cast<vb_single>(sondist), 0, 0, 0);
  c.exist = true;
  c.BucketPos.x = -2;  // Robots.bas:2186-2188
  c.BucketPos.y = -2;
  UpdateBotBucket(sim, nuovo);
  c.vel = p.vel;
  c.actvel = p.actvel;
  c.color = p.color;
  c.aim = p.aim + PI;
  if (c.aim > 6.28f) c.aim -= 2.0f * PI;
  c.aimvector = VectorSet(
      static_cast<vb_single>(std::cos(static_cast<double>(c.aim))),
      static_cast<vb_single>(std::sin(static_cast<double>(c.aim))));
  c.mem[addr::SetAim] = vb_cint(static_cast<double>(c.aim) * 200.0);
  c.mem[468] = 32000;  // centinela de fixang (M-04)
  c.Corpse = false;
  c.Dead = false;
  c.NewMove = p.NewMove;
  c.generation = static_cast<vb_integer>(
      (p.generation + 1 > 32000) ? 32000 : p.generation + 1);
  c.BirthCycle = sim.opts.TotRunCycle;
  c.vnum = 1;

  nnrg = (p.nrg / 100.0f) * static_cast<vb_single>(per);
  const vb_single nwaste = p.Waste / 100.0f * static_cast<vb_single>(per);
  const vb_single npwaste = p.Pwaste / 100.0f * static_cast<vb_single>(per);
  const vb_single nchloroplasts =
      (p.chloroplasts / 100.0f) * static_cast<vb_single>(per);

  p.nrg = p.nrg - nnrg - (nnrg * 0.001f);
  p.Waste -= nwaste;
  p.Pwaste -= npwaste;
  p.body -= nbody;
  p.radius = FindRadius(sim, n);
  p.chloroplasts -= nchloroplasts;

  c.chloroplasts = nchloroplasts;
  c.body = nbody;
  c.radius = FindRadius(sim, nuovo);
  c.Waste = nwaste;
  c.Pwaste = npwaste;
  p.mem[addr::Energy] = vb_cint(p.nrg);
  p.mem[311] = vb_cint(p.body);
  p.SonNumber = static_cast<vb_integer>(
      (p.SonNumber + 1 > 32000) ? 32000 : p.SonNumber + 1);
  c.nrg = nnrg * 0.999f;
  c.onrg = nnrg * 0.999f;
  c.mem[addr::Energy] = vb_cint(c.nrg);
  c.Poisoned = false;
  c.parent = p.AbsNum;
  c.FName = p.FName;
  c.LastOwner = p.LastOwner;
  c.Veg = p.Veg;
  c.NoChlr = p.NoChlr;
  c.Fixed = p.Fixed;
  c.CantSee = p.CantSee;
  c.DisableDNA = p.DisableDNA;
  c.DisableMovementSysvars = p.DisableMovementSysvars;
  c.CantReproduce = p.CantReproduce;
  c.VirusImmune = p.VirusImmune;
  if (c.Fixed) c.mem[addr::Fixed] = 1;
  c.SubSpecies = p.SubSpecies;
  c.OldGD = p.OldGD;    // variables de distancia genética (Robots.bas:2249)
  c.GenMut = p.GenMut;
  c.tag = p.tag;
  c.Bouyancy = p.Bouyancy;
  if (p.multibot_time > 0)
    c.multibot_time = static_cast<unsigned char>(p.multibot_time / 2 + 2);
  c.dq = p.dq;

  c.Vtimer = 0;
  c.virusshot = 0;

  // Memoria genética (M-05): 5 instantáneas + 15 diferidas; el padre pierde
  // su epimem (Robots.bas:2277-2287).
  for (int i = 0; i <= 4; ++i) c.mem[971 + i] = p.mem[971 + i];
  for (int i = 0; i <= 14; ++i) c.epimem[i] = p.mem[976 + i];
  for (int i = 0; i <= 14; ++i) p.epimem[i] = 0;

  // Régimen de mutación del hijo (Robots.bas:2289-2372).
  if (sim.Delta2) {
    using namespace mut;
    const vb_long MratesMax =
        sim.NormMut ? static_cast<vb_long>(c.DnaLen) *
                          static_cast<vb_long>(sim.valMaxNormMut)
                    : 2000000000;
    // dynamic mutation overload correction
    double dmoc =
        1.0 + static_cast<double>(c.DnaLen - sim.curr_dna_size) / 500.0;
    if (dmoc < 0.01) dmoc = 0.01;
    if (!sim.y_normsize) dmoc = 1;
    // zerobot stabilization (⚙ evo)
    if (sim.x_restartmode == 7 || sim.x_restartmode == 8) {
      if (c.FName == "Mutate.txt") {
        c.Mutables.mutarray[PointUP] = static_cast<vb_single>(
            static_cast<double>(c.Mutables.mutarray[PointUP]) * 1.75);
        if (c.Mutables.mutarray[PointUP] > static_cast<vb_single>(MratesMax))
          c.Mutables.mutarray[PointUP] = static_cast<vb_single>(MratesMax);
        c.Mutables.mutarray[P2UP] = static_cast<vb_single>(
            static_cast<double>(c.Mutables.mutarray[P2UP]) * 1.75);
        if (c.Mutables.mutarray[P2UP] > static_cast<vb_single>(MratesMax))
          c.Mutables.mutarray[P2UP] = static_cast<vb_single>(MratesMax);
      }
    }
    // For mrep = 0 To (Int(3*rndy)+1) * -(mem(mrepro) > 0): la extracción
    // Int(3*rndy) se consume SIEMPRE; con mrepro el parto muta 2-4 veces.
    const vb_long mrepLimit =
        (mut_detail::IntS(sim.rnd() * 3.0f) + 1) *
        ((p.mem[addr::mrepro] > 0) ? 1 : 0);
    for (vb_long mrep = 0; mrep <= mrepLimit; ++mrep) {
      for (int t = 1; t <= 10; ++t) {
        if (t == 9) continue;  // ignore PM2 mutation here
        if (c.Mutables.mutarray[t] < 1.0f) continue;
        if (static_cast<double>(sim.rnd()) < sim.DeltaMainChance / 100.0) {
          if (sim.DeltaMainExp != 0.0f) {
            if (t == CopyErrorUP || t == TranslocationUP || t == ReversalUP ||
                t == CE2UP) {
              c.Mutables.mutarray[t] = static_cast<vb_single>(
                  static_cast<double>(c.Mutables.mutarray[t]) * (dmoc + 2) / 3);
            } else if (!(t == MinorDeletionUP || t == MajorDeletionUP)) {
              c.Mutables.mutarray[t] = static_cast<vb_single>(
                  static_cast<double>(c.Mutables.mutarray[t]) * dmoc);
            }
            c.Mutables.mutarray[t] = static_cast<vb_single>(
                static_cast<double>(c.Mutables.mutarray[t]) *
                std::pow(10.0, static_cast<double>((sim.rnd() * 2 - 1) /
                                                   sim.DeltaMainExp)));
          }
          c.Mutables.mutarray[t] =
              c.Mutables.mutarray[t] + (sim.rnd() * 2 - 1) * sim.DeltaMainLn;
          if (c.Mutables.mutarray[t] < 1.0f) c.Mutables.mutarray[t] = 1;
          if (c.Mutables.mutarray[t] > static_cast<vb_single>(MratesMax))
            c.Mutables.mutarray[t] = static_cast<vb_single>(MratesMax);
        }
        if (static_cast<double>(sim.rnd()) < sim.DeltaDevChance / 100.0) {
          if (sim.DeltaDevExp != 0.0f)
            c.Mutables.StdDev[t] = static_cast<vb_single>(
                static_cast<double>(c.Mutables.StdDev[t]) *
                std::pow(10.0, static_cast<double>((sim.rnd() * 2 - 1) /
                                                   sim.DeltaDevExp)));
          c.Mutables.StdDev[t] =
              c.Mutables.StdDev[t] + (sim.rnd() * 2 - 1) * sim.DeltaDevLn;
          if (sim.DeltaDevExp != 0.0f)
            c.Mutables.Mean[t] = static_cast<vb_single>(
                static_cast<double>(c.Mutables.Mean[t]) *
                std::pow(10.0, static_cast<double>((sim.rnd() * 2 - 1) /
                                                   sim.DeltaDevExp)));
          c.Mutables.Mean[t] =
              c.Mutables.Mean[t] + (sim.rnd() * 2 - 1) * sim.DeltaDevLn;
          // Max range is always 0 to 800
          if (c.Mutables.StdDev[t] < 0.0f) c.Mutables.StdDev[t] = 0;
          if (c.Mutables.StdDev[t] > 200.0f) c.Mutables.StdDev[t] = 200;
          if (c.Mutables.Mean[t] < 1.0f) c.Mutables.Mean[t] = 1;
          if (c.Mutables.Mean[t] > 400.0f) c.Mutables.Mean[t] = 400;
        }
      }
      c.Mutables.CopyErrorWhatToChange = vb_cint(static_cast<double>(
          static_cast<vb_single>(c.Mutables.CopyErrorWhatToChange) +
          (sim.rnd() * 2 - 1) * sim.DeltaWTC));
      if (c.Mutables.CopyErrorWhatToChange < 0)
        c.Mutables.CopyErrorWhatToChange = 0;
      if (c.Mutables.CopyErrorWhatToChange > 100)
        c.Mutables.CopyErrorWhatToChange = 100;
      mutate(sim, nuovo, true);
    }
  } else {
    if (p.mem[addr::mrepro] > 0) {
      // mrepro sin Delta2: tasas /10 (0 -> 1000) y Mutations forzado SOLO
      // para este parto (Robots.bas:2352-2366).
      const Mutationprobs temp = c.Mutables;
      c.Mutables.Mutations = true;
      for (int t = 0; t <= 20; ++t) {
        c.Mutables.mutarray[t] = static_cast<vb_single>(
            static_cast<double>(c.Mutables.mutarray[t]) / 10.0);
        if (c.Mutables.mutarray[t] == 0.0f) c.Mutables.mutarray[t] = 1000;
      }
      mutate(sim, nuovo, true);
      c.Mutables = temp;
    } else {
      mutate(sim, nuovo, true);
    }
  }

  makeoccurrlist(sim, nuovo);
  c.DnaLen = static_cast<vb_integer>(DnaLen(c.dna));
  c.genenum = CountGenes(c.dna);
  c.mem[addr::DnaLenSys] = c.DnaLen;
  c.mem[addr::GenesSys] = static_cast<vb_integer>(c.genenum);

  maketie(sim, n, nuovo, sondist, 100, 0);  // tie de nacimiento: 100 ciclos
  p.onrg = p.nrg;  // el parto no dispara Shock
  c.mass = nbody / 1000.0f + c.shell / 200.0f;
  c.mem[addr::timersys] = p.mem[addr::timersys];  // timer heredado (M-08)

  p.mem[addr::Repro] = 0;   // consumo SOLO en éxito (M-04)
  p.mem[addr::mrepro] = 0;

  // Reset epigenético acumulado (Robots.bas:2394-2406).
  if (sim.epireset) {
    c.MutEpiReset = p.MutEpiReset + std::pow(static_cast<double>(c.LastMut),
                                             static_cast<double>(sim.epiresetemp));
    if (c.MutEpiReset > sim.epiresetOP && p.MutEpiReset > 0) {
      c.MutEpiReset = 0;
      for (int i = 0; i <= 4; ++i) c.mem[971 + i] = 0;
      for (int i = 0; i <= 14; ++i) c.epimem[i] = 0;
    }
  }

  p.nrg -= p.DnaLen * sim.vm.costs.v[cost::DNACOPYCOST] *
           sim.vm.costs.v[cost::COSTMULTIPLIER];
  if (p.nrg < 0.0f) p.nrg = 0.0f;
}

// ---------------------------------------------------------------------------
// Sección de crossover (Robots.bas:385-694) + SexReproduce (:2417-2847).

// Robots.bas:385-394 — Type block2 / block3.
struct Block2 {
  vb_integer tipo = 0;
  vb_integer value = 0;
  vb_integer match = 0;
};
struct Block3 {
  vb_integer nucli = 0;
  vb_integer match = 0;
};

// Robots.bas:397-407 — scanfromn: primer índice desde n cuya capa difiere de
// `layer`; actualiza layer ByRef. (En crossover, la llamada del lado 1 pasa
// un literal 0: VB6 crea un temporal y el writeback se pierde — se replica
// pasando un dummy.)
inline vb_long scanfromn(const std::vector<Block2>& rb, vb_long n,
                         vb_integer& layer) {
  const vb_long ub = static_cast<vb_long>(rb.size()) - 1;
  for (vb_long a = n; a <= ub; ++a) {
    if (rb[a].match != layer) {
      layer = rb[a].match;
      return a;
    }
  }
  return ub + 1;
}

// Robots.bas:409-422 — GeneticDistance: no-emparejados / total.
inline vb_single GeneticDistance(const std::vector<Block3>& rob1,
                                 const std::vector<Block3>& rob2) {
  vb_long diffcount = 0;
  for (const Block3& e : rob1)
    if (e.match == 0) diffcount += 1;
  for (const Block3& e : rob2)
    if (e.match == 0) diffcount += 1;
  const vb_long ub1 = static_cast<vb_long>(rob1.size()) - 1;
  const vb_long ub2 = static_cast<vb_long>(rob2.size()) - 1;
  return static_cast<vb_single>(static_cast<double>(diffcount) /
                                static_cast<double>(ub1 + ub2 + 2));
}

// Robots.bas:424-532 — simplematch: emparejador greedy por listas con
// contador de seguridad patch > 16000^2. Sitio de error 9 (ver SimDiag):
// el reposicionamiento loopold+laststartmatch puede rebasar el array cuando
// un lado se clampa en su tope — registrar y cortar el matching.
inline void simplematch(Sim& sim, std::vector<Block3>& r1,
                        std::vector<Block3>& r2) {
  vb_long patch = 0;
  bool newmatch = false;
  vb_integer inc = 0;

  const vb_long ei1 = static_cast<vb_long>(r1.size()) - 1;
  const vb_long ei2 = static_cast<vb_long>(r2.size()) - 1;

  std::vector<vb_integer> matchlist1(1, 0);
  std::vector<vb_integer> matchlist2(1, 0);
  vb_long count = 0;

  vb_long loopr1 = 0, loopr2 = 0, loopold = 0;
  vb_long laststartmatch1 = 0, laststartmatch2 = 0;

  do {
    // keep building until both sides max out
    if (loopr1 > ei1) loopr1 = ei1;
    if (loopr2 > ei2) loopr2 = ei2;

    matchlist1[count] = r1[loopr1].nucli;
    matchlist2[count] = r2[loopr2].nucli;
    count += 1;
    matchlist1.resize(count + 1);  // ReDim Preserve
    matchlist2.resize(count + 1);

    bool match = false;
    bool matchr2 = false;
    for (loopold = 0; loopold <= count - 1; ++loopold) {
      if (r2[loopr2].nucli == matchlist1[loopold]) {
        matchr2 = true;
        match = true;
        break;
      }
      if (r1[loopr1].nucli == matchlist2[loopold]) {
        matchr2 = false;
        match = true;
        break;
      }
      patch += 1;
    }

    if (match) {
      if (matchr2)
        loopr1 = loopold + laststartmatch1;
      else
        loopr2 = loopold + laststartmatch2;

      if (loopr1 > ei1 || loopr2 > ei2 || loopr1 < 0 || loopr2 < 0) {
        sim.diag.err9_simplematch += 1;  // error 9 del original
        return;
      }

      // start matching
      do {
        if (r2[loopr2].nucli == r1[loopr1].nucli) {
          if (!newmatch) inc += 1;  // increment only in newmatch
          newmatch = true;
          r1[loopr1].match = inc;
          r2[loopr2].match = inc;
        } else {
          newmatch = false;
          laststartmatch1 = loopr1;
          laststartmatch2 = loopr2;
          loopr1 -= 1;
          loopr2 -= 1;
          break;
        }
        loopr1 += 1;
        loopr2 += 1;
        patch += 1;
      } while (!(loopr1 > ei1 || loopr2 > ei2));

      // reset match list so it will not get too long
      matchlist1.assign(1, 0);
      matchlist2.assign(1, 0);
      count = 0;
    }

    loopr1 += 1;
    loopr2 += 1;
    patch += 1;
  } while (!((loopr1 > ei1 && loopr2 > ei2) || patch > 256000000));
}

// Robots.bas:534-560 — DoGeneticDistance: el pipeline sin crossover
// (consumidores: sharechloroplasts con umbral 0.25 y la campaña GenMut).
inline vb_single DoGeneticDistance(Sim& sim, int r1, int r2) {
  std::vector<Block3> ndna1(sim.rob[r1].dna.size());
  std::vector<Block3> ndna2(sim.rob[r2].dna.size());
  for (std::size_t t = 0; t < ndna1.size(); ++t)
    ndna1[t].nucli = DNAtoInt(*sim.sysvars, sim.rob[r1].dna[t].tipo,
                              sim.rob[r1].dna[t].value);
  for (std::size_t t = 0; t < ndna2.size(); ++t)
    ndna2[t].nucli = DNAtoInt(*sim.sysvars, sim.rob[r2].dna[t].tipo,
                              sim.rob[r2].dna[t].value);
  simplematch(sim, ndna1, ndna2);
  return GeneticDistance(ndna1, ndna2);
}

// Robots.bas:562-694 — crossover. Consumo de RNG por el fuente:
// 1 moneda por par/tramo no emparejado (un tramo presente en un solo lado
// se PIERDE con p = 1/2, [PROBABLE BUG] B6-3 / B-29), 1 moneda de lado por
// racha emparejada y — porque el IIf de VB6 evalúa TODOS sus brazos — 1
// moneda MÁS por CADA token de cada racha emparejada, se use o no (la
// moneda de valores solo gobierna cuando ambos lados traen |value| > 999 y
// el mismo tipo). Errata corregida en 70-CASOS-DORADOS.md R-11 (decía "sin
// monedas de valor"): el fuente manda.
inline void crossover(Sim& sim, std::vector<Block2>& rob1,
                      std::vector<Block2>& rob2, std::vector<Block>& Outdna) {
  using mut_detail::IntS;
  vb_integer i = 0;
  vb_long n1 = 0, n2 = 0, nn = 0;
  vb_long res1 = 0, res2 = 0, resn = 0;
  vb_long upperbound = 0;
  bool nfirst = false;

  const vb_long ub2 = static_cast<vb_long>(rob2.size()) - 1;

  for (;;) {
    // diff search
    n1 = res1 + resn - nn;
    n2 = res2 + resn - nn;

    i = 0;
    if (nfirst) {
      upperbound = static_cast<vb_long>(Outdna.size()) - 1;
    } else {
      nfirst = true;
      upperbound = -1;
    }

    vb_integer dummy = 0;  // el literal 0 ByRef del fuente (writeback perdido)
    res1 = scanfromn(rob1, n1, dummy);
    res2 = scanfromn(rob2, n2, i);

    // subloop
    if (res1 - n1 > 0 && res2 - n2 > 0) {  // run both sides
      if (IntS(sim.rnd() * 2.0f) == 0) {   // which side?
        Outdna.resize(upperbound + (res1 - n1) + 1);
        for (vb_long a = n1; a <= res1 - 1; ++a) {
          Outdna[upperbound + 1 + a - n1].tipo = rob1[a].tipo;
          Outdna[upperbound + 1 + a - n1].value = rob1[a].value;
        }
      } else {
        Outdna.resize(upperbound + (res2 - n2) + 1);
        for (vb_long a = n2; a <= res2 - 1; ++a) {
          Outdna[upperbound + 1 + a - n2].tipo = rob2[a].tipo;
          Outdna[upperbound + 1 + a - n2].value = rob2[a].value;
        }
      }
    } else if (res1 - n1 > 0) {  // run one side
      if (IntS(sim.rnd() * 2.0f) == 0) {
        Outdna.resize(upperbound + (res1 - n1) + 1);
        for (vb_long a = n1; a <= res1 - 1; ++a) {
          Outdna[upperbound + 1 + a - n1].tipo = rob1[a].tipo;
          Outdna[upperbound + 1 + a - n1].value = rob1[a].value;
        }
      }  // moneda perdedora: el tramo se descarta (B-29)
    } else if (res2 - n2 > 0) {  // run other side
      if (IntS(sim.rnd() * 2.0f) == 0) {
        Outdna.resize(upperbound + (res2 - n2) + 1);
        for (vb_long a = n2; a <= res2 - 1; ++a) {
          Outdna[upperbound + 1 + a - n2].tipo = rob2[a].tipo;
          Outdna[upperbound + 1 + a - n2].value = rob2[a].value;
        }
      }
    }

    // same search
    if (i == 0) return;
    upperbound = static_cast<vb_long>(Outdna.size()) - 1;
    nn = res1;
    resn = scanfromn(rob1, nn, i);
    Outdna.resize(upperbound + (resn - nn) + 1);

    const bool whatside = IntS(sim.rnd() * 2.0f) == 0;

    for (vb_long a = nn; a <= resn - 1; ++a) {
      if (a - nn + res2 > ub2) {  // error 9 del original (capas desincronizadas)
        sim.diag.err9_simplematch += 1;
        return;
      }
      const Block2& L = rob1[a];
      const Block2& R = rob2[a - nn + res2];
      Outdna[upperbound + 1 + a - nn].tipo = whatside ? L.tipo : R.tipo;
      // IIf eager: la moneda de valores se consume en cada token.
      const bool coin = IntS(sim.rnd() * 2.0f) == 0;
      const bool bigpair = L.tipo == R.tipo && std::abs(L.value) > 999 &&
                           std::abs(R.value) > 999;
      const bool takeleft = bigpair ? coin : whatside;
      Outdna[upperbound + 1 + a - nn].value = takeleft ? L.value : R.value;
    }
  }
}

// Robots.bas:2417-2847 — SexReproduce: el "macho" es un shot -8 ya absorbido
// (spermDNA en la madre); todos los recursos salen de la madre. El hijo
// pierde su primer token (Outdna arranca en el índice 0 — [PROBABLE BUG]
// B6-1 / R-11) salvo que sea exactamente (0,0).
inline void SexReproduce(Sim& sim, int female) {
  if (sim.rob[female].body < 5.0f) return;

  if (!sim.rob[female].exist) return;         // bot must exist
  if (sim.rob[female].Corpse) return;         // no sex with corpses
  if (sim.rob[female].CantReproduce) return;
  if (sim.rob[female].body <= 2.0f) return;
  if (sim.rob[female].spermDNA.empty()) return;  // IsRobDNABounded

  vb_single per = static_cast<vb_single>(sim.rob[female].mem[addr::SEXREPRO]);

  if (sim.rob[female].Veg &&
      (sim.TotalChlr > sim.opts.MaxPopulation || sim.totvegsDisplayed < 0))
    return;
  // Lotería vegetal sexual: Random(0, 9) <> 5 — 1/10, no 1/11 como la
  // asexual ([PROBABLE BUG] B6-2 / R-10).
  if (sim.rob[female].Veg && (Random(0, 9, *sim.rndy) != 5) &&
      (sim.TotalChlr > sim.opts.MaxPopulation * 0.9f))
    return;
  if (sim.totvegsDisplayed == -1) return;

  per = static_cast<vb_single>(static_cast<vb_long>(per) % 100);  // per Mod 100
  if (sim.reprofix && per < 3.0f) sim.rob[female].Dead = true;
  if (per <= 0.0f) return;

  const vb_long sondist = static_cast<vb_long>(vb_round64(static_cast<double>(
      FindRadius(sim, female, static_cast<vb_single>(per / 100.0)) +
      FindRadius(sim, female,
                 static_cast<vb_single>((100.0f - per) / 100.0)))));

  vb_single nnrg = (sim.rob[female].nrg / 100.0f) * per;
  // nbody As Integer en aritmética Single estricta (B-30, misma decisión que
  // la asexual).
  const vb_integer nbody =
      vb_cint(static_cast<double>((sim.rob[female].body / 100.0f) * per));

  const vb_single tempnrg = sim.rob[female].nrg;
  if (tempnrg <= 0.0f) return;

  const vb_long nx = static_cast<vb_long>(vb_round64(static_cast<double>(
      sim.rob[female].pos.x + absx(sim.rob[female].aim,
                                   static_cast<vb_single>(sondist), 0, 0, 0))));
  const vb_long ny = static_cast<vb_long>(vb_round64(static_cast<double>(
      sim.rob[female].pos.y + absy(sim.rob[female].aim,
                                   static_cast<vb_single>(sondist), 0, 0, 0))));
  bool tests = simplecoll(sim, nx, ny, female);
  tests = tests || !sim.rob[female].exist;
  if (tests) return;
  // dreason/dq (Disqualify): capa torneo ⚙, fuera del core.

  // Step1: ambos ADN a block2 (el índice 0 INCLUIDO en ambos lados).
  std::vector<Block2> dna1(sim.rob[female].dna.size());
  for (std::size_t t = 0; t < dna1.size(); ++t) {
    dna1[t].tipo = sim.rob[female].dna[t].tipo;
    dna1[t].value = sim.rob[female].dna[t].value;
  }
  std::vector<Block2> dna2(sim.rob[female].spermDNA.size());
  for (std::size_t t = 0; t < dna2.size(); ++t) {
    dna2[t].tipo = sim.rob[female].spermDNA[t].tipo;
    dna2[t].value = sim.rob[female].spermDNA[t].value;
  }

  // Step2: map nucli.
  std::vector<Block3> ndna1(dna1.size());
  std::vector<Block3> ndna2(dna2.size());
  for (std::size_t t = 0; t < dna1.size(); ++t)
    ndna1[t].nucli = DNAtoInt(*sim.sysvars, dna1[t].tipo, dna1[t].value);
  for (std::size_t t = 0; t < dna2.size(); ++t)
    ndna2[t].nucli = DNAtoInt(*sim.sysvars, dna2[t].tipo, dna2[t].value);

  // Step3: rachas comunes.
  simplematch(sim, ndna1, ndna2);

  // Umbral 0.6: sin hijo y bloqueo ~8 ciclos; el esperma NO se descarta.
  if (static_cast<double>(GeneticDistance(ndna1, ndna2)) > 0.6) {
    sim.rob[female].fertilized = -18;
    return;
  }

  // Step4: map back.
  for (std::size_t t = 0; t < dna1.size(); ++t) dna1[t].match = ndna1[t].match;
  for (std::size_t t = 0; t < dna2.size(); ++t) dna2[t].match = ndna2[t].match;

  // Step5: crossover.
  std::vector<Block> Outdna(1);  // ReDim Outdna(0)
  crossover(sim, dna1, dna2, Outdna);

  // Bug fix remove starting zero (solo si dna(0) es exactamente (0,0)).
  if (Outdna[0].value == 0 && Outdna[0].tipo == 0) {
    if (Outdna.size() == 1) {
      // ReDim Preserve Outdna(-1): error 9 del original (crossover vacío,
      // solo alcanzable si simplematch se cortó). Registrar y abortar.
      sim.diag.err9_simplematch += 1;
      return;
    }
    for (std::size_t t = 1; t < Outdna.size(); ++t) Outdna[t - 1] = Outdna[t];
    Outdna.resize(Outdna.size() - 1);
  }

  const int nuovo = posto(sim);
  Bot& p = sim.rob[female];  // refs tras posto (el array pudo crecer)
  Bot& c = sim.rob[nuovo];

  sim.opts.TotBorn += 1;
  if (p.Veg) sim.totvegs += 1;

  c.dna = Outdna;
  c.DnaLen = static_cast<vb_integer>(DnaLen(c.dna));
  c.dna.resize(static_cast<std::size_t>(c.DnaLen) + 1);  // actual = virtual
  c.genenum = CountGenes(c.dna);
  c.Mutables = p.Mutables;
  c.Mutations = p.Mutations;
  c.OldMutations = p.OldMutations;
  c.LastMut = 0;
  c.LastMutDetail = p.LastMutDetail;
  // usedvars/maxusedvars: no modelados (decisión M3).
  c.Skin = p.Skin;
  c.mem.fill(0);  // Erase rob(nuovo).mem
  c.Ties = {};    // Erase rob(nuovo).Ties

  c.pos.x = p.pos.x + absx(p.aim, static_cast<vb_single>(sondist), 0, 0, 0);
  c.pos.y = p.pos.y + absy(p.aim, static_cast<vb_single>(sondist), 0, 0, 0);
  c.exist = true;
  c.BucketPos.x = -2;
  c.BucketPos.y = -2;
  UpdateBotBucket(sim, nuovo);

  c.vel = p.vel;
  c.actvel = p.actvel;
  c.color = p.color;
  c.aim = p.aim + PI;
  if (c.aim > 6.28f) c.aim -= 2.0f * PI;
  c.aimvector = VectorSet(
      static_cast<vb_single>(std::cos(static_cast<double>(c.aim))),
      static_cast<vb_single>(std::sin(static_cast<double>(c.aim))));
  c.mem[addr::SetAim] = vb_cint(static_cast<double>(c.aim) * 200.0);
  c.mem[468] = 32000;
  c.Corpse = false;
  c.Dead = false;
  c.NewMove = p.NewMove;
  c.generation = static_cast<vb_integer>(
      (p.generation + 1 > 32000) ? 32000 : p.generation + 1);
  c.BirthCycle = sim.opts.TotRunCycle;
  c.vnum = 1;

  nnrg = (p.nrg / 100.0f) * per;
  const vb_single nwaste = p.Waste / 100.0f * per;
  const vb_single npwaste = p.Pwaste / 100.0f * per;
  const vb_single nchloroplasts = (p.chloroplasts / 100.0f) * per;

  p.nrg = p.nrg - nnrg - (nnrg * 0.001f);  // 0.1% para la madre
  // El macho pagó el coste del disparo y nada más.
  p.Waste -= nwaste;
  p.Pwaste -= npwaste;
  p.body -= nbody;
  p.radius = FindRadius(sim, female);
  p.chloroplasts -= nchloroplasts;

  c.chloroplasts = nchloroplasts;
  c.body = nbody;
  c.radius = FindRadius(sim, nuovo);
  c.Waste = nwaste;
  c.Pwaste = npwaste;
  p.mem[addr::Energy] = vb_cint(p.nrg);
  p.mem[311] = vb_cint(p.body);
  p.SonNumber = static_cast<vb_integer>(
      (p.SonNumber + 1 > 32000) ? 32000 : p.SonNumber + 1);
  // El SonNumber/parent del macho no se actualizan (linaje matrilineal).

  c.nrg = nnrg * 0.999f;  // 1% para el hijo
  c.onrg = nnrg * 0.999f;
  c.mem[addr::Energy] = vb_cint(c.nrg);
  c.Poisoned = false;
  c.parent = p.AbsNum;
  c.FName = p.FName;
  c.LastOwner = p.LastOwner;
  c.Veg = p.Veg;
  c.NoChlr = p.NoChlr;
  c.Fixed = p.Fixed;
  c.CantSee = p.CantSee;
  c.DisableDNA = p.DisableDNA;
  c.DisableMovementSysvars = p.DisableMovementSysvars;
  c.CantReproduce = p.CantReproduce;
  c.VirusImmune = p.VirusImmune;
  if (c.Fixed) c.mem[addr::Fixed] = 1;
  c.SubSpecies = p.SubSpecies;

  c.OldGD = p.OldGD;
  c.GenMut = p.GenMut;
  c.tag = p.tag;
  c.Bouyancy = p.Bouyancy;

  if (p.multibot_time > 0)
    c.multibot_time = static_cast<unsigned char>(p.multibot_time / 2 + 2);
  c.dq = p.dq;

  c.Vtimer = 0;
  c.virusshot = 0;

  // Memoria genética: 5 instantáneas + 15 diferidas; la madre pierde epimem.
  for (int i = 0; i <= 4; ++i) c.mem[971 + i] = p.mem[971 + i];
  for (int i = 0; i <= 14; ++i) c.epimem[i] = p.mem[976 + i];
  for (int i = 0; i <= 14; ++i) p.epimem[i] = 0;

  logmutation(sim, nuovo,
              "Female DNA len " + StrVB(p.DnaLen) + " and male DNA len " +
                  StrVB(static_cast<vb_long>(p.spermDNA.size()) - 1) +
                  " had offspring DNA len " + StrVB(c.DnaLen) +
                  " during cycle " + StrVB(sim.opts.TotRunCycle));

  // Régimen Delta2 (una sola pasada — sin el multiplicador x2-4 de mrepro).
  if (sim.Delta2) {
    using namespace mut;
    const vb_long MratesMax =
        sim.NormMut ? static_cast<vb_long>(c.DnaLen) *
                          static_cast<vb_long>(sim.valMaxNormMut)
                    : 2000000000;
    double dmoc =
        1.0 + static_cast<double>(c.DnaLen - sim.curr_dna_size) / 500.0;
    if (dmoc < 0.01) dmoc = 0.01;
    if (!sim.y_normsize) dmoc = 1;
    if (sim.x_restartmode == 7 || sim.x_restartmode == 8) {
      if (c.FName == "Mutate.txt") {
        c.Mutables.mutarray[PointUP] = static_cast<vb_single>(
            static_cast<double>(c.Mutables.mutarray[PointUP]) * 1.75);
        if (c.Mutables.mutarray[PointUP] > static_cast<vb_single>(MratesMax))
          c.Mutables.mutarray[PointUP] = static_cast<vb_single>(MratesMax);
        c.Mutables.mutarray[P2UP] = static_cast<vb_single>(
            static_cast<double>(c.Mutables.mutarray[P2UP]) * 1.75);
        if (c.Mutables.mutarray[P2UP] > static_cast<vb_single>(MratesMax))
          c.Mutables.mutarray[P2UP] = static_cast<vb_single>(MratesMax);
      }
    }
    for (int t = 1; t <= 10; ++t) {
      if (t == 9) continue;  // ignore PM2 mutation here
      if (c.Mutables.mutarray[t] < 1.0f) continue;
      if (static_cast<double>(sim.rnd()) < sim.DeltaMainChance / 100.0) {
        if (sim.DeltaMainExp != 0.0f) {
          if (t == CopyErrorUP || t == TranslocationUP || t == ReversalUP ||
              t == CE2UP) {
            c.Mutables.mutarray[t] = static_cast<vb_single>(
                static_cast<double>(c.Mutables.mutarray[t]) * (dmoc + 2) / 3);
          } else if (!(t == MinorDeletionUP || t == MajorDeletionUP)) {
            c.Mutables.mutarray[t] = static_cast<vb_single>(
                static_cast<double>(c.Mutables.mutarray[t]) * dmoc);
          }
          c.Mutables.mutarray[t] = static_cast<vb_single>(
              static_cast<double>(c.Mutables.mutarray[t]) *
              std::pow(10.0, static_cast<double>((sim.rnd() * 2 - 1) /
                                                 sim.DeltaMainExp)));
        }
        c.Mutables.mutarray[t] =
            c.Mutables.mutarray[t] + (sim.rnd() * 2 - 1) * sim.DeltaMainLn;
        if (c.Mutables.mutarray[t] < 1.0f) c.Mutables.mutarray[t] = 1;
        if (c.Mutables.mutarray[t] > static_cast<vb_single>(MratesMax))
          c.Mutables.mutarray[t] = static_cast<vb_single>(MratesMax);
      }
      if (static_cast<double>(sim.rnd()) < sim.DeltaDevChance / 100.0) {
        if (sim.DeltaDevExp != 0.0f)
          c.Mutables.StdDev[t] = static_cast<vb_single>(
              static_cast<double>(c.Mutables.StdDev[t]) *
              std::pow(10.0, static_cast<double>((sim.rnd() * 2 - 1) /
                                                 sim.DeltaDevExp)));
        c.Mutables.StdDev[t] =
            c.Mutables.StdDev[t] + (sim.rnd() * 2 - 1) * sim.DeltaDevLn;
        if (sim.DeltaDevExp != 0.0f)
          c.Mutables.Mean[t] = static_cast<vb_single>(
              static_cast<double>(c.Mutables.Mean[t]) *
              std::pow(10.0, static_cast<double>((sim.rnd() * 2 - 1) /
                                                 sim.DeltaDevExp)));
        c.Mutables.Mean[t] =
            c.Mutables.Mean[t] + (sim.rnd() * 2 - 1) * sim.DeltaDevLn;
        if (c.Mutables.StdDev[t] < 0.0f) c.Mutables.StdDev[t] = 0;
        if (c.Mutables.StdDev[t] > 200.0f) c.Mutables.StdDev[t] = 200;
        if (c.Mutables.Mean[t] < 1.0f) c.Mutables.Mean[t] = 1;
        if (c.Mutables.Mean[t] > 400.0f) c.Mutables.Mean[t] = 400;
      }
    }
    c.Mutables.CopyErrorWhatToChange = vb_cint(static_cast<double>(
        static_cast<vb_single>(c.Mutables.CopyErrorWhatToChange) +
        (sim.rnd() * 2 - 1) * sim.DeltaWTC));
    if (c.Mutables.CopyErrorWhatToChange < 0)
      c.Mutables.CopyErrorWhatToChange = 0;
    if (c.Mutables.CopyErrorWhatToChange > 100)
      c.Mutables.CopyErrorWhatToChange = 100;
    mutate(sim, nuovo, true);
  } else {
    mutate(sim, nuovo, true);
  }

  makeoccurrlist(sim, nuovo);
  c.DnaLen = static_cast<vb_integer>(DnaLen(c.dna));
  c.genenum = CountGenes(c.dna);
  c.mem[addr::DnaLenSys] = c.DnaLen;
  c.mem[addr::GenesSys] = static_cast<vb_integer>(c.genenum);

  maketie(sim, female, nuovo, sondist, 100, 0);  // birth ties last 100 cycles
  p.onrg = p.nrg;  // saves mother from dying from shock
  c.mass = nbody / 1000.0f + c.shell / 200.0f;
  c.mem[addr::timersys] = p.mem[addr::timersys];  // epigenetic timer

  p.mem[addr::SEXREPRO] = 0;        // sucessfully reproduced
  p.fertilized = -1;                // spermDNA se recupera el próximo ciclo
  p.mem[addr::SYSFERTILIZED] = 0;   // el esperma vale para un solo parto

  if (sim.epireset) {
    c.MutEpiReset =
        p.MutEpiReset + std::pow(static_cast<double>(c.LastMut),
                                 static_cast<double>(sim.epiresetemp));
    if (c.MutEpiReset > sim.epiresetOP && p.MutEpiReset > 0) {
      c.MutEpiReset = 0;
      for (int i = 0; i <= 4; ++i) c.mem[971 + i] = 0;
      for (int i = 0; i <= 14; ++i) c.epimem[i] = 0;
    }
  }

  p.nrg -= p.DnaLen * sim.vm.costs.v[cost::DNACOPYCOST] *
           sim.vm.costs.v[cost::COSTMULTIPLIER];
  if (p.nrg < 0.0f) p.nrg = 0.0f;
}

// Robots.bas:1659-1696 — ReproduceAndKill (P6): primero TODOS los
// nacimientos, después todas las muertes; con repro y mrepro a la vez decide
// rndy > 0.5 (consume RNG).
inline void ReproduceAndKill(Sim& sim) {
  int t = 1;
  while (t < sim.rp) {
    if (sim.rep[t] > 0) {
      vb_integer temp = 0;
      const int who = sim.rep[t];
      if (sim.rob[who].mem[addr::mrepro] > 0 &&
          sim.rob[who].mem[addr::Repro] > 0) {
        if (sim.rnd() > 0.5f)
          temp = sim.rob[who].mem[addr::Repro];
        else
          temp = sim.rob[who].mem[addr::mrepro];
      } else {
        if (sim.rob[who].mem[addr::mrepro] > 0)
          temp = sim.rob[who].mem[addr::mrepro];
        if (sim.rob[who].mem[addr::Repro] > 0)
          temp = sim.rob[who].mem[addr::Repro];
      }
      Reproduce(sim, who, temp);
    } else if (sim.rep[t] < 0) {
      SexReproduce(sim, -sim.rep[t]);
    }
    t += 1;
  }
  t = 1;
  while (t < sim.kl) {
    KillRobot(sim, sim.kil[t]);
    t += 1;
  }
}

// Robots.bas:2970-3056 — KillRobot: por slot, sin compactación, sin chequear
// exist. El encogimiento del array con ReDim (sitio de error 9,
// 10-CICLO.md §11.2) no se replica: decisión de port, el array no encoge.
inline void KillRobot(Sim& sim, int n) {
  if (n < 0 || n > static_cast<int>(sim.rob.size()) - 1) return;
  delallties(sim, n);
  sim.rob[n].exist = false;  // después de borrar las ties (Robots.bas:3006)
  UpdateBotBucket(sim, n);   // Robots.bas:3007 — lo saca del bucket
  // makepoff: ornamental (render) — fuera del core.
  if (sim.rob[n].virusshot > 0 &&
      sim.rob[n].virusshot <= sim.maxshotarray) {
    sim.Shots[sim.rob[n].virusshot].exist = false;
    sim.rob[n].virusshot = 0;
  }
  sim.rob[n].spermDNA.clear();
  if (n == sim.MaxRobs) {
    while (sim.MaxRobs > 0 && !sim.rob[sim.MaxRobs].exist) sim.MaxRobs -= 1;
  }
}

// NeoMutations.bas:1007-1022 — delgene: borra el gen g, recalcula
// DnaLen/genenum con publicación inmediata y rehace la firma occurr.
// Las ramas de descalificación (Disqualify = 2, F1/x_restartmode) son de la
// capa torneo ⚙ y no entran al core (Disqualify nace en 0).
inline bool delgene(Sim& sim, int n, vb_long g) {
  Bot& b = sim.rob[n];
  const vb_long k = b.genenum;
  if (g > 0 && g <= k) {
    DeleteSpecificGene(b.dna, g);
    b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));
    b.genenum = CountGenes(b.dna);
    b.mem[addr::DnaLenSys] = b.DnaLen;
    b.mem[addr::GenesSys] = static_cast<vb_integer>(b.genenum);
    makeoccurrlist(sim, n);
    return true;
  }
  return false;
}

// Robots.bas:1040-1047 — genelength: longitud del gen p del bot n.
inline vb_long genelength(Sim& sim, int n, vb_integer p) {
  const vb_long pos = genepos(sim.rob[n].dna, p);
  return GeneEnd(sim.rob[n].dna, pos) - pos + 1;
}

// Robots.bas:1052-1112 — BotDNAManipulation (P3): virus timer, MakeVirus
// (real desde M6, B-21), Vshoot, delgene y las publicaciones de DnaLen/genes.
inline void BotDNAManipulation(Sim& sim, int n) {
  Bot& b = sim.rob[n];

  if (b.Vtimer > 1) b.Vtimer -= 1;
  b.mem[addr::Vtimer] = static_cast<vb_integer>(b.Vtimer);

  if (b.mem[addr::mkvirus] > 0 && b.Vtimer == 0) {
    if (b.chloroplasts == 0.0f) {
      // Fabricación real (M6, B-21): un solo cobro (gate Vtimer = 0) y
      // Vtimer = 2 x longitud del gen; mem(mkvirus) NO se consume aquí.
      if (MakeVirus(sim, n, b.mem[addr::mkvirus])) {
        const vb_long length = genelength(sim, n, b.mem[addr::mkvirus]) * 2;
        b.nrg -= static_cast<vb_single>(length) / 2.0f *
                 sim.vm.costs.v[cost::DNACOPYCOST] *
                 sim.vm.costs.v[cost::COSTMULTIPLIER];
        if (length < 32000)
          b.Vtimer = length;
        else
          b.Vtimer = 32000;
      } else {
        b.Vtimer = 0;
        b.virusshot = 0;
      }
    } else {
      b.chloroplasts = 0.0f;
      b.radius = FindRadius(sim, n);
    }
  }

  if (b.mem[addr::VshootSys] != 0 && b.Vtimer == 1) {
    if (b.virusshot <= sim.maxshotarray && b.virusshot > 0)
      Vshoot(sim, n, b.virusshot);
    b.mem[addr::VshootSys] = 0;
    b.mem[addr::Vtimer] = 0;
    b.mem[addr::mkvirus] = 0;
    b.Vtimer = 0;
    b.virusshot = 0;
  }

  if (b.mem[addr::DelgeneSys] > 0) {
    delgene(sim, n, b.mem[addr::DelgeneSys]);
    b.mem[addr::DelgeneSys] = 0;
  }

  b.mem[addr::DnaLenSys] = b.DnaLen;
  b.mem[addr::GenesSys] = static_cast<vb_integer>(b.genenum);
}

// ---------------------------------------------------------------------------
// Teleport.bas (50-MUNDO.md §3, Q10). La E/S de disco del original se
// sustituye por los búferes outbox/inbox del Teleporter (sim.hpp); el
// nombre de archivo <fecha><hora><FName>… es infra y no se replica.
// NewTeleporter (:60-105) es creación de UI (2 RNG de setup); los tests
// construyen los teleporters directamente.

// Multibots.bas:52-65 — KillOrganism: mata todas las células. El juego de
// nopoff (suprime los poffs ornamentales) es render, fuera del core.
inline void KillOrganism(Sim& sim, int n) {
  std::array<vb_integer, 51> clist{};
  clist[0] = static_cast<vb_integer>(n);
  ListCells(sim, clist);
  int t = 0;
  while (clist[t] > 0) {
    KillRobot(sim, clist[t]);
    t += 1;
  }
}

// Teleport.bas:198-210 — TeleportCollision: círculo Width/2 + radius sobre
// el CENTRO del teleporter (center se calcula en MoveTeleporter con el
// desplazamiento 0.3·Height del sprite).
inline bool TeleportCollision(Sim& sim, int n, int t) {
  return VectorMagnitude(VectorSub(sim.rob[n].pos,
                                   sim.Teleporters[t].center)) <
         sim.Teleporters[t].Width / 2.0f + sim.rob[n].radius;
}

// Teleport.bas:162-195 — CheckTeleporters (P0a de UpdateBots): salida.
// [PROBABLE BUG] B7-2: los puertos Internet solo expulsan cuando
// PollCountDown <= 0 (la tasa de salida queda ligada al sondeo de entrada).
// dq > 1 fuerza el teleport (capa torneo) saltando los filtros.
inline void CheckTeleporters(Sim& sim, int n, const FormatGlobals& g = {}) {
  for (int i = 1; i <= sim.numTeleporters; ++i) {
    Teleporter& tp = sim.Teleporters[i];
    if (!(tp.Out || tp.local || (tp.Internet && tp.PollCountDown <= 0)))
      continue;
    if (!((TeleportCollision(sim, n, i) || sim.rob[n].dq > 1) &&
          sim.rob[n].exist))
      continue;

    if (tp.Out || tp.Internet) {
      const bool force = sim.rob[n].dq > 1;  // GoTo forceteleport
      const bool filtered =
          (sim.rob[n].Veg && !tp.teleportVeggies) ||
          (sim.rob[n].Corpse && !tp.teleportCorpses) ||
          (!sim.rob[n].Veg && !tp.teleportHeterotrophs);
      if (force || !filtered) {
        tp.NumTeleported += 1;
        // If Out Then SaveOrganism path…; If Internet Then SaveOrganism
        // intOutPath…: un puerto con ambos flags serializa DOS archivos.
        if (tp.Out) {
          VbBinFile f;
          SaveOrganism(sim, f, n, g);
          tp.outbox.push_back(std::move(f.data));
        }
        if (tp.Internet) {
          VbBinFile f;
          SaveOrganism(sim, f, n, g);
          tp.outbox.push_back(std::move(f.data));
        }
        KillOrganism(sim, n);
      }
    } else if (tp.local) {
      const bool filtered =
          (sim.rob[n].Veg && !tp.teleportVeggies) ||
          (sim.rob[n].Corpse && !tp.teleportCorpses) ||
          (!sim.rob[n].Veg && !tp.teleportHeterotrophs);
      if (!filtered) {
        if (tp.local) tp.NumTeleported += 1;
        // 2 RNG (x, y); la línea de visualize es render.
        const vb_single rx = static_cast<vb_single>(
            static_cast<double>(sim.opts.FieldWidth) * sim.rnd());
        const vb_single ry = static_cast<vb_single>(
            static_cast<double>(sim.opts.FieldHeight) * sim.rnd());
        ReSpawn(sim, n, static_cast<vb_single>(vb_clng(rx)),
                static_cast<vb_single>(vb_clng(ry)));
      }
    }
  }
}

// Teleport.bas:299-313 — DriftTeleporter: 1 RNG por eje con drift activo;
// tope MaxVelocity/4 re-escalando el vector (VectorScalar con su clamp).
inline void DriftTeleporter(Sim& sim, int i) {
  Teleporter& tp = sim.Teleporters[i];
  const vb_single vel =
      static_cast<vb_single>(static_cast<double>(sim.opts.MaxVelocity) / 4.0);
  if (tp.driftHorizontal)
    tp.vel.x = static_cast<vb_single>(static_cast<double>(tp.vel.x) +
                                      (static_cast<double>(sim.rnd()) - 0.5));
  if (tp.driftVertical)
    tp.vel.y = static_cast<vb_single>(static_cast<double>(tp.vel.y) +
                                      (static_cast<double>(sim.rnd()) - 0.5));
  if (VectorMagnitude(tp.vel) > vel)
    tp.vel = VectorScalar(tp.vel, vel / VectorMagnitude(tp.vel));
}

// Teleport.bas:315-368 — MoveTeleporter. [PROBABLE BUG] B7-3 / B-36: SOLO
// traslada si AMBOS flags de drift están activos, aunque DriftTeleporter
// haya acumulado velocidad con uno solo. El center usado para la colisión
// vive en (x + W/2, y + H·0.3) — el 0.3 responde al dibujo del sprite.
// Bordes: envoltura si el eje está conectado, si no rebote ±10% MaxVelocity.
inline void MoveTeleporter(Sim& sim, int i) {
  Teleporter& tp = sim.Teleporters[i];

  if (tp.driftHorizontal && tp.driftVertical)
    tp.pos = VectorAdd(tp.pos, tp.vel);
  tp.center = VectorSet(tp.pos.x + tp.Width * 0.5f,
                        tp.pos.y + tp.Height * 0.3f);

  if (tp.pos.x < 0.0f) {
    if (tp.pos.x + tp.Width < 0.0f) tp.pos.x = 0.0f;
    if (sim.opts.Dxsxconnected)
      tp.pos.x = tp.pos.x + sim.opts.FieldWidth - tp.Width;
    else
      tp.vel.x = sim.opts.MaxVelocity * 0.1f;
  }
  if (tp.pos.y < 0.0f) {
    if (tp.pos.y + tp.Height < 0.0f) tp.pos.y = 0.0f;
    if (sim.opts.Updnconnected)
      tp.pos.y = tp.pos.y + sim.opts.FieldHeight - tp.Height;
    else
      tp.vel.y = sim.opts.MaxVelocity * 0.1f;
  }
  if (tp.pos.x + tp.Width > sim.opts.FieldWidth) {
    if (tp.pos.x > sim.opts.FieldWidth)
      tp.pos.x = sim.opts.FieldWidth - tp.Width;
    if (sim.opts.Dxsxconnected)
      tp.pos.x = tp.pos.x - (sim.opts.FieldWidth - tp.Width);
    else
      tp.vel.x = -sim.opts.MaxVelocity * 0.1f;
  }
  if (tp.pos.y + tp.Height > sim.opts.FieldHeight) {
    if (tp.pos.y > sim.opts.FieldHeight)
      tp.pos.y = sim.opts.FieldHeight - tp.Height;
    if (sim.opts.Updnconnected)
      tp.pos.y = tp.pos.y - (sim.opts.FieldHeight - tp.Height);
    else
      tp.vel.y = -sim.opts.MaxVelocity * 0.1f;
  }
}

// Teleport.bas:371-455 — TeleportInBots (paso 18): cada InboundPollCycles
// ciclos carga hasta BotsPerPoll organismos del inbox (borrándolos); los
// Internet entran en posición aleatoria (2 RNG/organismo). Gate global:
// SpeciesNum > 45 suspende toda entrada. El MsgBox del archivo no-dbo y el
// On Error GoTo abandonthiscycle son E/S de disco: en el port el inbox solo
// contiene registros dbo y la lectura de búfer no falla.
inline void TeleportInBots(Sim& sim, const FormatGlobals& g = {}) {
  if (static_cast<vb_integer>(sim.Specie.size()) > 45) return;

  for (int i = 1; i <= sim.numTeleporters; ++i) {
    Teleporter& tp = sim.Teleporters[i];
    if (tp.In) {
      if (tp.PollCountDown <= 0) {
        tp.PollCountDown = tp.InboundPollCycles;
        vb_integer maxbots = tp.BotsPerPoll;
        while (!tp.inbox.empty() && maxbots > 0) {
          VbBinFile f;
          f.data = std::move(tp.inbox.front());
          tp.inbox.erase(tp.inbox.begin());
          LoadOrganism(sim, f, tp.pos.x + tp.Width / 2.0f,
                       tp.pos.y + tp.Height / 3.0f, g);
          tp.NumTeleportedIn += 1;
          maxbots -= 1;
        }
      } else {
        tp.PollCountDown -= 1;
      }
    }
    if (tp.Internet) {
      if (tp.PollCountDown <= 0) {
        tp.PollCountDown = tp.InboundPollCycles;
        vb_integer maxbots = tp.BotsPerPoll;
        while (!tp.inbox.empty() && maxbots > 0) {
          const vb_single rx = static_cast<vb_single>(
              static_cast<double>(sim.opts.FieldWidth) * sim.rnd());
          const vb_single ry = static_cast<vb_single>(
              static_cast<double>(sim.opts.FieldHeight) * sim.rnd());
          VbBinFile f;
          f.data = std::move(tp.inbox.front());
          tp.inbox.erase(tp.inbox.begin());
          LoadOrganism(sim, f, rx, ry, g);
          tp.NumTeleportedIn += 1;
          maxbots -= 1;
        }
      } else {
        tp.PollCountDown -= 1;
      }
    }
  }
}

// Teleport.bas:458-468 — UpdateTeleporters (paso 18 del tick).
inline void UpdateTeleporters(Sim& sim, const FormatGlobals& g = {}) {
  for (int i = 1; i <= sim.numTeleporters; ++i) {
    if (sim.opts.TotRunCycle >= 0) {
      DriftTeleporter(sim, i);
      MoveTeleporter(sim, i);
    }
  }
  TeleportInBots(sim, g);
}

// Robots.bas:1476-1656 — UpdateBots: 7 pasadas en orden (10-CICLO.md §5).
inline void UpdateBots(Sim& sim) {
  sim.rp = 1;
  sim.kl = 1;
  sim.kil[1] = 0;
  sim.rep[1] = 0;
  sim.TotalEnergy = 0;
  sim.totwalls = 0;
  sim.totcorpse = 0;
  sim.TotalRobotsDisplayed = sim.TotalRobots;
  sim.TotalRobots = 0;
  sim.totnvegsDisplayed = sim.totnvegs;
  sim.totnvegs = 0;
  sim.totvegsDisplayed = sim.totvegs;
  sim.totvegs = 0;

  // P0a — teleporters (Robots.bas:1505-1512): la salida corre ANTES que
  // ninguna otra pasada (NetForces puede tocar bots más adelante). Mareas
  // (Tides): ⚙ opcional, fuera (BouyancyScaling queda en 1).
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist) {
      if (sim.numTeleporters > 0) CheckTeleporters(sim, t);
    }
  }

  // P0b — AddedMass, solo si el medio tiene densidad (Robots.bas:1516-1520).
  if (sim.opts.Density != 0.0f) {
    for (int t = 1; t <= sim.MaxRobs; ++t)
      if (sim.rob[t].exist) AddedMass(sim, t);
  }

  // P1 — pre update.
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (!sim.rob[t].exist) continue;
    if (!sim.rob[t].Corpse) Upkeep(sim, t);
    if (!sim.rob[t].Corpse && !sim.rob[t].DisableDNA) Poisons(sim, t);
    if (!sim.opts.DisableFixing) ManageFixed(sim, t);
    CalcMass(sim, t);
    // DoObstacleCollisions (Obstacles.bas:434-553): B7 — solo con formas;
    // stub registrado.
    if (sim.numObstacles > 0) sim.diag.obstacle_collision_stub += 1;
    bordercolls(sim, t);
    TieHooke(sim, t);
    if (!sim.rob[t].Corpse && !sim.rob[t].DisableDNA) TieTorque(sim, t);
    if (!sim.rob[t].Fixed) NetForces(sim, t);
    BucketsCollision(sim, t);
    if (sim.rob[t].ImpulseStatic > 0.0f &&
        (sim.rob[t].ImpulseInd.x != 0.0f || sim.rob[t].ImpulseInd.y != 0.0f)) {
      vb_single staticV;
      if (sim.rob[t].vel.x == 0.0f && sim.rob[t].vel.y == 0.0f) {
        staticV = sim.rob[t].ImpulseStatic;
      } else {
        staticV = sim.rob[t].ImpulseStatic *
                  std::fabs(Cross(VectorUnit(sim.rob[t].vel),
                                  VectorUnit(sim.rob[t].ImpulseInd)));
      }
      if (staticV > VectorMagnitude(sim.rob[t].ImpulseInd))
        sim.rob[t].ImpulseInd = VectorSet(0.0f, 0.0f);
    }
    sim.rob[t].ImpulseInd =
        VectorSub(sim.rob[t].ImpulseInd, sim.rob[t].ImpulseRes);
    if (!sim.rob[t].Corpse && !sim.rob[t].DisableDNA) tieportcom(sim, t);
    if (!sim.rob[t].Corpse && !sim.rob[t].DisableDNA) readtie(sim, t);
  }

  // P2 — contadores.
  for (auto& sp : sim.Specie) sp.population = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t)
    if (sim.rob[t].exist) UpdateCounters(sim, t);

  // P3 — movimiento.
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (!sim.rob[t].exist) continue;
    Update_Ties(sim, t);
    if (sim.rob[t].age < 15) DoGeneticMemory(sim, t);
    if (!sim.rob[t].Corpse && !sim.rob[t].DisableDNA) SetAimFunc(sim, t);
    if (!sim.rob[t].Corpse && !sim.rob[t].DisableDNA)
      BotDNAManipulation(sim, t);
    UpdatePosition(sim, t);
    if (sim.rob[t].nrg > 32000.0f) sim.rob[t].nrg = 32000.0f;
    if (sim.rob[t].nrg < -32000.0f) sim.rob[t].nrg = -32000.0f;
    if (sim.rob[t].poison > 32000.0f) sim.rob[t].poison = 32000.0f;
    if (sim.rob[t].poison < 0.0f) sim.rob[t].poison = 0.0f;
    if (sim.rob[t].venom > 32000.0f) sim.rob[t].venom = 32000.0f;
    if (sim.rob[t].venom < 0.0f) sim.rob[t].venom = 0.0f;
    if (sim.rob[t].Waste > 32000.0f) sim.rob[t].Waste = 32000.0f;
    if (sim.rob[t].Waste < 0.0f) sim.rob[t].Waste = 0.0f;
  }

  // P4 — anti-gigantes (muerta con bodyfix = 32100, 31-ENERGIA.md).
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].chloroplasts < sim.rob[t].body / 2.0f ||
        sim.rob[t].Kills > 5) {
      if (sim.rob[t].exist && sim.rob[t].body > sim.opts.bodyfix)
        KillRobot(sim, t);
    }
  }

  // P5 — acciones.
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    UpdateTieAngles(sim, t);  // sin chequear exist (Q11)
    if (!sim.rob[t].Corpse && !sim.rob[t].DisableDNA && sim.rob[t].exist) {
      mutate(sim, t);
      MakeStuff(sim, t);
      HandleWaste(sim, t);
      Shooting(sim, t);
      if (!sim.rob[t].NoChlr) ManageChlr(sim, t);
      ManageBody(sim, t);
      ManageBouyancy(sim, t);
      ManageReproduction(sim, t);
      Shock(sim, t);
      WriteSenses(sim, t);
      FireTies(sim, t);
    }
    if (!sim.rob[t].Corpse && sim.rob[t].exist) {
      Ageing(sim, t);
      ManageDeath(sim, t);
    }
    if (sim.rob[t].exist)
      sim.TotalSimEnergy[sim.CurrentEnergyCycle] += static_cast<vb_long>(
          vb_round64(static_cast<double>(sim.rob[t].nrg) +
                     static_cast<double>(sim.rob[t].body) * 10.0));
  }

  // P6 — nacimientos y muertes.
  ReproduceAndKill(sim);
  // RemoveExtinctSpecies: mantenimiento del registro ⚙; sin efecto en mem().

  if (sim.totnvegs == 0 && sim.opts.Restart && !sim.opts.F1)
    sim.StartAnotherRound = true;
}

}  // namespace db
