// dbcore/robots.hpp — Robots.bas: las rutinas por bot del tick (Upkeep,
// Poisons, Ageing, Shooting, ManageBody/Death/Reproduction, Shock, FireTies,
// DoGeneticMemory, Reproduce, KillRobot) y UpdateBots con sus 7 pasadas en el
// orden de 10-CICLO.md §5. Las pasadas/ramas que no tocan memoria y
// pertenecen a otros milestones quedan como stubs registrados en SimDiag.
#pragma once

#include "physics.hpp"
#include "senses.hpp"
#include "shots.hpp"
#include "sim.hpp"
#include "ties.hpp"

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

// Robots.bas:1174-1182 — MakeStuff (P5): los cuerpos de make*/store* son de
// B5 (31-ENERGIA, catálogo §9); los gates se transcriben para registrar el
// consumo pendiente.
inline void MakeStuff(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.mem[824] != 0 || b.mem[826] != 0 || b.mem[822] != 0 || b.mem[820] != 0)
    sim.diag.makestuff_stub += 1;
}

// Robots.bas:1184-1196 — HandleWaste (P5): publicaciones y gates; feedveg2/
// altzheimer/defacate son de B5/B7 (altzheimer consume RNG).
inline void HandleWaste(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.Waste > 0.0f && b.chloroplasts > 0.0f) sim.diag.handlewaste_stub += 1;
  if (sim.opts.BadWastelevel == 0) sim.opts.BadWastelevel = 400;
  if (sim.opts.BadWastelevel > 0 &&
      b.Pwaste + b.Waste > static_cast<vb_single>(sim.opts.BadWastelevel))
    sim.diag.handlewaste_stub += 1;  // altzheimer
  if (b.Waste > 32000.0f) sim.diag.handlewaste_stub += 1;  // defacate
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

// mutate (NeoMutations.bas): milestone B6b. Con las mutaciones del harness
// desactivadas es un no-op; cualquier invocación con mutaciones activas se
// registra.
inline void mutate(Sim& sim, int n, bool birth = false) {
  (void)n;
  (void)birth;
  sim.diag.mutate_stub += 0;  // gate: sin regímenes activos no hay consumo
}

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
  if (per <= 0) return;

  const vb_long sondist = static_cast<vb_long>(vb_round64(
      static_cast<double>(FindRadius(sim, n, per / 100.0f) +
                          FindRadius(sim, n, (100 - per) / 100.0f))));

  vb_single nnrg = (sim.rob[n].nrg / 100.0f) * static_cast<vb_single>(per);
  const vb_integer nbody =
      vb_cint((static_cast<double>(sim.rob[n].body) / 100.0) * per);

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

  c.dna = p.dna;
  c.DnaLen = p.DnaLen;
  c.genenum = p.genenum;
  // Mutables/Mutations/LastMutDetail: B6b.

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
  c.Veg = p.Veg;
  c.NoChlr = p.NoChlr;
  c.Fixed = p.Fixed;
  c.CantSee = p.CantSee;
  c.DisableDNA = p.DisableDNA;
  c.DisableMovementSysvars = p.DisableMovementSysvars;
  c.CantReproduce = p.CantReproduce;
  c.VirusImmune = p.VirusImmune;
  if (c.Fixed) c.mem[addr::Fixed] = 1;
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

  // Régimen Delta2/mrepro de mutación heredable: B6b. Mutación de nacimiento
  // con mutaciones desactivadas: no-op.
  mutate(sim, nuovo, true);

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

  // epireset: B6b (régimen de mutación acumulada).

  p.nrg -= p.DnaLen * sim.vm.costs.v[cost::DNACOPYCOST] *
           sim.vm.costs.v[cost::COSTMULTIPLIER];
  if (p.nrg < 0.0f) p.nrg = 0.0f;
}

// SexReproduce (Robots.bas:2417-2848): milestone B6a — stub registrado.
inline void SexReproduce(Sim& sim, int female) {
  (void)female;
  sim.diag.sexrepro_stub += 1;
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

// Robots.bas:1052-1112 — BotDNAManipulation (P3): virus timer, delgene y las
// publicaciones de DnaLen/genes. MakeVirus/delgene reales: B3b.
inline void BotDNAManipulation(Sim& sim, int n) {
  Bot& b = sim.rob[n];

  if (b.Vtimer > 1) b.Vtimer -= 1;
  b.mem[addr::Vtimer] = static_cast<vb_integer>(b.Vtimer);

  if (b.mem[addr::mkvirus] > 0 && b.Vtimer == 0) {
    if (b.chloroplasts == 0.0f) {
      // MakeVirus/copygene — B3b pendiente: el gate se registra y el intento
      // falla como el original cuando no puede copiar el gen.
      sim.diag.makevirus_stub += 1;
      b.Vtimer = 0;
      b.virusshot = 0;
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
    sim.diag.makevirus_stub += 1;  // delgene — B3b
    b.mem[addr::DelgeneSys] = 0;
  }

  b.mem[addr::DnaLenSys] = b.DnaLen;
  b.mem[addr::GenesSys] = static_cast<vb_integer>(b.genenum);
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

  // P0a (teleporters) — B7: sin teleporters no hay llamada. Mareas (Tides):
  // ⚙ opcional, fuera (BouyancyScaling queda en 1).

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
      if (sim.rob[t].exist && sim.rob[t].body > kBodyFix) KillRobot(sim, t);
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
