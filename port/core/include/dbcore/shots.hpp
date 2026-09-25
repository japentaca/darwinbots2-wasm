// dbcore/shots.hpp — Shots.bas: newshot/createshot, updateshots con los
// efectos por tipo que M3 ejercita (shots de memoria con salto de 340 y
// bloqueo por poison, venom -3, poison -5, esperma -8, waste -4), Vshoot,
// robshoot (Robots.bas:1716-1864) y los efectos de alimentación
// releasenrg/takenrg/releasebod (M6: cierran B3a; el Kills sin clamp de la
// cola de releasenrg/releasebod es B-24) y la capa de virus B3b
// (MakeVirus/copygene/addgene — B-19/B-20/B-21).
// NewShotCollision es el swept-sphere exacto de Shots.bas:960-1082.
#pragma once

#include "senses.hpp"
#include "sim.hpp"

namespace db {

inline constexpr int shotdecay = 40;            // Shots.bas:45
inline constexpr int ShellEffectiveness = 20;   // :46
inline constexpr int VenumEffectivenessVSShell = 25;  // :48
inline constexpr vb_single SlimeEffectiveness = 1.0f / 20.0f;  // :46 (virus)

// Shots.bas:271-291 — FirstSlot.
inline vb_long FirstSlot(Sim& sim) {
  vb_long counter = 1;
  while (sim.Shots[sim.shotpointer].exist) {
    counter += 1;
    sim.shotpointer += 1;
    if (sim.shotpointer > sim.maxshotarray) sim.shotpointer = 1;
    if (counter > sim.maxshotarray) break;
  }
  if (counter > sim.maxshotarray) return counter;
  return sim.shotpointer;
}

inline bool copygene(Sim& sim, vb_long n, vb_integer p);  // adelantada
inline void addgene(Sim& sim, int n, vb_long p);          // adelantada

// Shots.bas:90-202 — newshot. Consume 2 RNG (Random(-2,2) y Random(-20,20),
// uno de ellos muerto: `ran` no se usa — 33-SHOTS.md). Normaliza aimshoot
// (Mod 1256) y backshot EN LA CELDA antes de consumirlos (M-11).
inline vb_long newshot(Sim& sim, int n, vb_integer shottype, vb_single val,
                       vb_single rngmultiplier, bool offset = false) {
  vb_long a = FirstSlot(sim);
  if (a > sim.maxshotarray) {
    sim.shotpointer = sim.maxshotarray;
    sim.maxshotarray = vb_clng(sim.maxshotarray * 1.1);  // CLng (RV-11)
    sim.Shots.resize(sim.maxshotarray + 1);
  }
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[a];

  if (val > 32000.0f) val = 32000.0f;
  s.exist = true;
  s.age = 0;
  s.parent = static_cast<vb_integer>(n);  // slot, no AbsNum
  s.FromSpecie = b.FName;
  s.fromveg = b.Veg;
  s.color = 0;
  s.value = static_cast<vb_integer>(std::floor(static_cast<double>(val)));

  if (shottype > 0 || shottype == -100) {
    s.shottype = shottype;
  } else {
    s.shottype = static_cast<vb_integer>(-(std::abs(shottype) % 8));
    if (s.shottype == 0) s.shottype = -8;  // múltiplos de -8 son -8
  }
  s.memloc = b.mem[835];  // vloc del tirador (se normaliza al golpear)
  s.Memval = b.mem[836];

  [[maybe_unused]] const vb_single ran =
      static_cast<vb_single>(Random(-2, 2, *sim.rndy)) / 20.0f;  // RNG muerto

  vb_single ShAngle;
  if (b.mem[addr::backshot] == 0) {
    ShAngle = b.aim;
  } else {
    ShAngle = angnorm(b.aim - PI);
    b.mem[addr::backshot] = 0;
  }
  if (b.mem[addr::aimshoot] != 0) {
    b.mem[addr::aimshoot] =
        static_cast<vb_integer>(b.mem[addr::aimshoot] % 1256);  // in place (M-11)
    // Integer / Integer es Double: se resta en Double (RV-14).
    ShAngle = static_cast<vb_single>(
        static_cast<double>(b.aim) -
        static_cast<double>(b.mem[addr::aimshoot]) / 200.0);
    b.mem[addr::aimshoot] = 0;
  }
  // Random es As Long y Long / Integer es Double (RV-14).
  ShAngle = static_cast<vb_single>(
      static_cast<double>(ShAngle) +
      static_cast<double>(Random(-20, 20, *sim.rndy)) / 200.0);

  Vector angle = VectorSet(
      static_cast<vb_single>(std::cos(static_cast<double>(ShAngle))),
      -static_cast<vb_single>(std::sin(static_cast<double>(ShAngle))));
  Vector angcopy = angle;
  s.pos = VectorAdd(b.pos, VectorScalar(angcopy, b.radius));

  if (offset) {
    s.pos = VectorSub(s.pos, b.vel);
    s.pos = VectorAdd(s.pos, b.actvel);
  }

  angcopy = angle;
  s.velocity = VectorAdd(b.actvel, VectorScalar(angcopy, 40.0f));
  s.opos = VectorSub(s.pos, s.velocity);

  if (b.vbody > 10.0f) {
    // Log(..) * 60 * rngmultiplier: todo en Double, un redondeo (RV-14).
    s.nrg = static_cast<vb_single>(
        std::log(std::fabs(static_cast<double>(b.vbody))) * 60.0 *
        static_cast<double>(rngmultiplier));
    // `\` redondea el operando ya sumado (RV-17).
    const vb_long temp =
        static_cast<vb_long>(vb_round64(static_cast<double>(s.nrg) + 40.0 + 1.0)) / 40;
    s.Range = static_cast<vb_single>(temp);
    s.nrg = static_cast<vb_single>(temp) * 40.0f;
  } else {
    s.Range = rngmultiplier;
    s.nrg = 40.0f * rngmultiplier;
  }

  vb_long result = a;

  if (shottype == -7) {  // virus: se almacena con el gen copiado a bordo
    s.genenum = s.value;
    s.stored = true;
    if (!copygene(sim, a, s.genenum)) {
      s.exist = false;
      s.stored = false;
      result = -1;
    }
    // E5 (Shots.bas:186-188) — Disqualify: el virus descalifica también
    // con Disqualify = 1 (única acción con ambos niveles).
    if ((sim.opts.F1 || sim.x_restartmode == 1) &&
        (sim.Disqualify == 1 || sim.Disqualify == 2))
      dreason(sim, sim.rob[n].FName, sim.rob[n].tag, "using a virus");
    if (!sim.opts.F1 && sim.rob[n].dq == 1 &&
        (sim.Disqualify == 1 || sim.Disqualify == 2))
      sim.rob[n].Dead = true;
  } else {
    s.stored = false;
  }

  if (shottype == -2) s.nrg = val;

  if (shottype == -8) {  // esperma: viaja con el ADN del macho
    s.dna = b.dna;
    s.DnaLen = b.DnaLen;
  }
  return result;
}

// Shots.bas:205-261 — createshot (rebotes de poison, shots de decay). En el
// fuente X/Y son ByVal Long y vx/vy ByVal Integer: la posicion y la velocidad
// llegan redondeadas (bancario) a entero (RV-10). Se reciben en float y se
// redondean aqui para que ningun llamador trunque sin querer.
// Ojo: puede reubicar sim.Shots; quien tenga un Shot& debe volver a indexar
// despues (RV-12).
inline void createshot(Sim& sim, vb_single X, vb_single Y, vb_single vx,
                       vb_single vy, vb_integer loc, int par, vb_single val,
                       vb_single Range, vb_long col) {
  const vb_long Xl = vb_clng(X), Yl = vb_clng(Y);
  const vb_integer vxi = vb_cint(vx), vyi = vb_cint(vy);
  vb_long a = FirstSlot(sim);
  if (a > sim.maxshotarray) {
    sim.shotpointer = sim.maxshotarray;
    sim.maxshotarray = vb_clng(sim.maxshotarray * 1.1);  // CLng (RV-11)
    sim.Shots.resize(sim.maxshotarray + 1);
  }
  Shot& s = sim.Shots[a];
  s.parent = static_cast<vb_integer>(par);
  s.FromSpecie = sim.rob[par].FName;
  s.fromveg = sim.rob[par].Veg;
  s.pos = VectorSet(static_cast<vb_single>(Xl), static_cast<vb_single>(Yl));
  s.velocity = VectorSet(static_cast<vb_single>(vxi), static_cast<vb_single>(vyi));
  s.opos = VectorSub(s.pos, s.velocity);
  s.age = 0;
  s.color = col;
  s.exist = true;
  s.stored = false;
  s.DnaLen = 0;

  // `\` redondea el operando ya sumado (RV-17).
  const vb_long temp =
      static_cast<vb_long>(vb_round64(static_cast<double>(Range) + 40.0 + 1.0)) / 40;
  s.nrg = Range + 40.0f + 1.0f;
  if (val > 32000.0f) val = 32000.0f;
  if (loc == -2) s.nrg = val;
  s.Range = static_cast<vb_single>(temp);
  s.value = vb_cint(val);
  if (loc > 0 || loc == -100) {
    s.shottype = loc;
  } else {
    s.shottype = static_cast<vb_integer>(-(std::abs(loc) % 8));
    if (s.shottype == 0) s.shottype = -8;
  }
  s.memloc = sim.rob[par].mem[834];  // ploc crudo; se normaliza al golpear
  if (s.shottype == -5) s.Memval = sim.rob[par].mem[839];
}

// Shots.bas:758-814 — takeven (M-03): remapeo (memloc-1) Mod 1000 + 1 con
// 340 -> 0; con memloc <= 0, Random(1,1000) con re-tirada si sale 340.
inline void takeven(Sim& sim, int n, vb_long t) {
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[t];
  if (b.Corpse) return;

  vb_single power = s.nrg / (s.Range * (RobSize / 3.0f)) * s.value;
  if (power < 1.0f) return;

  if (s.FromSpecie == b.FName) {
    b.venom += power;
    if (b.venom > 32000.0f) b.venom = 32000.0f;
    b.mem[825] = vb_cint(b.venom);
  } else {
    power *= VenumEffectivenessVSShell;
    if (power < b.shell * ShellEffectiveness) {
      b.shell -= power / ShellEffectiveness;
      b.mem[823] = vb_cint(b.shell);
      return;
    } else {
      const vb_single temp = power;
      power -= b.shell * ShellEffectiveness;
      b.shell -= temp / ShellEffectiveness;
      if (b.shell < 0.0f) b.shell = 0.0f;
      b.mem[823] = vb_cint(b.shell);
    }
    power /= VenumEffectivenessVSShell;
    if (power < 1.0f) return;

    b.Paralyzed = true;
    if (b.Paracount + power > 32000.0f)
      b.Paracount = 32000.0f;
    else
      b.Paracount += power;

    if (s.memloc > 0) {
      b.Vloc = static_cast<vb_integer>((s.memloc - 1) % 1000 + 1);
      if (b.Vloc == 340) b.Vloc = 0;  // protección delgene (mem(0), M-03)
    } else {
      do {
        b.Vloc = static_cast<vb_integer>(Random(1, 1000, *sim.rndy));
      } while (b.Vloc == 340);
    }
    b.Vval = s.Memval;
  }
}

// Shots.bas:487-503 — defacate: expulsa waste como shot -4 (200/ciclo; con
// Waste > 32000, reset a 31500 y descarga 500 — el "clamp" de P5 que cierra
// B-18). Cobra SHOTCOST rebajado por ties y consume 2 RNG (newshot).
inline void defacate(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  const vb_integer SH = -4;
  vb_single va = 200.0f;

  if (va > b.Waste) va = b.Waste;
  if (b.Waste > 32000.0f) {
    b.Waste = 31500.0f;
    va = 500.0f;
  }

  b.Waste = b.Waste - va;
  b.nrg -= (sim.vm.costs.v[cost::SHOTCOST] *
            sim.vm.costs.v[cost::COSTMULTIPLIER]) /
           ((b.numties < 0.0f ? 0.0f : b.numties) + 1.0f);
  newshot(sim, n, SH, va, 1.0f, true);
  b.Pwaste = b.Pwaste + va / 1000.0f;
}

// Shots.bas:505-597 — releasenrg: el bot n golpeado por un shot -1 devuelve
// un shot -2 de energía (o -5 si su poison supera la potencia). La llamada a
// FirstSlot del arranque es del fuente (avanza shotpointer sin usar el
// resultado — R-05). La cola mata y acredita Kills al SLOT tirador SIN
// clamp: mem(220) puede superar 32000 ([PROBABLE BUG] A3-5, B-24; con
// Kills = 32767 el original lanzaba error 6, §8).
inline void releasenrg(Sim& sim, int n, vb_long t) {
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[t];

  (void)FirstSlot(sim);  // a = FirstSlot (resultado sin uso, fiel al fuente)
  // createshot puede reubicar Shots: el tirador se lee antes (RV-12).
  const vb_integer shooter = s.parent;

  if (b.nrg <= 0.5f) return;

  Vector vel = VectorSub(b.actvel, s.velocity);
  vel = VectorAdd(vel, VectorScalar(b.actvel, 0.5f));

  vb_single power;
  if (sim.opts.EnergyExType) {
    if (s.Range == 0.0f)
      power = 0.0f;
    else
      power = static_cast<vb_single>(s.value) * s.nrg /
              (s.Range * (RobSize / 3.0f)) * sim.opts.EnergyProp;
    if (s.nrg < 0.0f) return;
  } else {
    power = static_cast<vb_single>(sim.opts.EnergyFix);
  }

  if (b.Corpse) power = power * 0.5f;

  const vb_single Range = s.Range * 2.0f;

  if (b.poison > power) {
    // Rebote de poison.
    createshot(sim, s.pos.x, s.pos.y, vel.x, vel.y, -5, n, power,
               Range * (RobSize / 3.0f), 0);
    // Literales Double: un solo redondeo (RV-14).
    b.poison = static_cast<vb_single>(static_cast<double>(b.poison) -
                                      static_cast<double>(power) * 0.9);
    if (b.poison < 0.0f) b.poison = 0.0f;
    b.mem[addr::poison] = vb_cint(b.poison);
  } else {
    // Shot de energía: 90% de nrg, 1% de body.
    vb_single EnergyLost = static_cast<vb_single>(static_cast<double>(power) * 0.9);
    if (EnergyLost > b.nrg) {
      power = b.nrg;
      b.nrg = 0.0f;
    } else {
      b.nrg = b.nrg - EnergyLost;
    }

    EnergyLost = static_cast<vb_single>(static_cast<double>(power) * 0.01);
    if (EnergyLost > b.body)
      b.body = 0.0f;
    else
      b.body = b.body - EnergyLost;

    createshot(sim, s.pos.x, s.pos.y, vel.x, vel.y, -2, n, power,
               Range * (RobSize / 3.0f), 0);
    b.radius = FindRadius(sim, n);
  }

  if (b.body <= 0.5f || b.nrg <= 0.5f) {
    b.Dead = true;
    sim.rob[shooter].Kills += 1;  // sin clamp (la vía de ties sí clampa)
    sim.rob[shooter].mem[220] =
        static_cast<vb_integer>(sim.rob[shooter].Kills);
  }
}

// Shots.bas:599-719 — releasebod: shot -6, energía directa del body (x4
// contra corpses). La shell absorbe a razón ShellEffectiveness; el shot -2
// de retorno se crea DESPUÉS del chequeo de muerte (a diferencia de -1).
inline void releasebod(Sim& sim, int n, vb_long t) {
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[t];

  if (b.body <= 0.0f) return;

  Vector vel = VectorSub(b.actvel, s.velocity);
  vel = VectorAdd(vel, VectorScalar(b.actvel, 0.5f));

  vb_single power;
  if (sim.opts.EnergyExType) {
    if (s.Range == 0.0f)
      power = 0.0f;
    else
      power = static_cast<vb_single>(s.value) * s.nrg /
              (s.Range * (RobSize / 3.0f)) * sim.opts.EnergyProp;
  } else {
    power = static_cast<vb_single>(sim.opts.EnergyFix);
  }

  if (power > 32000.0f) power = 32000.0f;

  const vb_single shell = b.shell * static_cast<vb_single>(ShellEffectiveness);

  // `/ 0.8` es Double: la comparacion y la asignacion van en Double (RV-14).
  const double techo =
      static_cast<double>(b.body) * 10.0 / 0.8 + static_cast<double>(shell);
  if (static_cast<double>(power) > techo) power = static_cast<vb_single>(techo);

  if (power < shell) {
    b.shell = b.shell - power / ShellEffectiveness;
    if (b.shell < 0.0f) b.shell = 0.0f;
    b.mem[823] = vb_cint(b.shell);
    return;
  } else {
    b.shell = b.shell - power / ShellEffectiveness;
    if (b.shell < 0.0f) b.shell = 0.0f;
    b.mem[823] = vb_cint(b.shell);
    power = power - shell;
  }

  if (power <= 0.0f) return;

  const vb_single Range = s.Range * 2.0f;

  if (b.Corpse) {
    power = power * 4.0f;
    if (power > b.body * 10.0f) power = b.body * 10.0f;
    b.body = b.body - power / 10.0f;
    b.radius = FindRadius(sim, n);
  } else {
    vb_single leftover = 0.0f;
    vb_single EnergyLost = static_cast<vb_single>(static_cast<double>(power) * 0.2);
    if (EnergyLost > b.nrg) {
      leftover = EnergyLost - b.nrg;
      b.nrg = 0.0f;
    } else {
      b.nrg = b.nrg - EnergyLost;
    }

    EnergyLost = static_cast<vb_single>(static_cast<double>(power) * 0.08);
    if (EnergyLost > b.body) {
      leftover = leftover + EnergyLost - b.body * 10.0f;  // literal: -body*10
      b.body = 0.0f;
    } else {
      b.body = b.body - EnergyLost;
    }

    if (leftover > 0.0f) {
      if (b.nrg > 0.0f && b.nrg > leftover) {
        b.nrg = b.nrg - leftover;
        leftover = 0.0f;
      } else if (b.nrg > 0.0f && b.nrg < leftover) {
        leftover = leftover - b.nrg;
        b.nrg = 0.0f;
      }
      if (b.body > 0.0f && b.body * 10.0f > leftover) {
        b.body = static_cast<vb_single>(static_cast<double>(b.body) -
                                        static_cast<double>(leftover) * 0.1);
        leftover = 0.0f;
      } else if (b.body > 0.0f && b.body * 10.0f < leftover) {
        b.body = 0.0f;
      }
    }
    b.radius = FindRadius(sim, n);
  }

  if (b.body <= 0.5f || b.nrg <= 0.5f) {
    b.Dead = true;
    sim.rob[s.parent].Kills += 1;  // sin clamp (B-24)
    sim.rob[s.parent].mem[220] =
        static_cast<vb_integer>(sim.rob[s.parent].Kills);
  }

  createshot(sim, s.pos.x, s.pos.y, vel.x, vel.y, -2, n, power,
             Range * (RobSize / 3.0f), 0);
}

// Shots.bas:721-756 — takenrg: el bot absorbe un shot -2 (95% nrg con
// desborde al body, 4% body, 1% waste). Ignora corpses.
inline void takenrg(Sim& sim, int n, vb_long t) {
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[t];
  if (b.Corpse) return;

  vb_single partial;
  vb_single overflow = 0.0f;
  if (s.Range < 0.00001f)
    partial = 0.0f;
  else
    partial = s.nrg;

  // Literales Double: comparaciones y sumas en Double, un redondeo (RV-14).
  const double p = static_cast<double>(partial);
  const double nrg95 = static_cast<double>(b.nrg) + p * 0.95;
  if (nrg95 > 32000.0) {
    overflow = static_cast<vb_single>(nrg95 - 32000.0);
    b.nrg = 32000.0f;
  } else {
    b.nrg = static_cast<vb_single>(nrg95);
  }

  const double body4 = (static_cast<double>(b.body) + p * 0.004) +
                       static_cast<double>(overflow) * 0.1;
  if (body4 > 32000.0)
    b.body = 32000.0f;
  else
    b.body = static_cast<vb_single>(body4);

  b.Waste = static_cast<vb_single>(static_cast<double>(b.Waste) + p * 0.01);

  b.radius = FindRadius(sim, n);
}

// Shots.bas:816-826 — takewaste.
inline void takewaste(Sim& sim, int n, vb_long t) {
  Shot& s = sim.Shots[t];
  // RobSize / 3 es Integer / Integer = Double y aqui no hay CSng: toda la
  // expresion va en Double y se redondea al asignar a power (RV-14).
  const vb_single power = static_cast<vb_single>(
      static_cast<double>(s.nrg) /
      (static_cast<double>(s.Range) * (RobSize / 3.0)) * s.value);
  if (power < 0.0f) return;
  sim.rob[n].Waste += power;
}

// Shots.bas:828-859 — takepoison.
inline void takepoison(Sim& sim, int n, vb_long t) {
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[t];
  if (b.Corpse) return;
  const vb_single power = s.nrg / (s.Range * (RobSize / 3.0f)) * s.value;
  if (power < 1.0f) return;
  if (s.FromSpecie == b.FName) {
    b.poison += power;
    if (b.poison > 32000.0f) b.poison = 32000.0f;
    b.mem[827] = vb_cint(b.poison);
  } else {
    b.Poisoned = true;
    b.Poisoncount = static_cast<vb_single>(static_cast<double>(b.Poisoncount) +
                                           static_cast<double>(power) / 1.5);  // RV-14
    if (b.Poisoncount > 32000.0f) b.Poisoncount = 32000.0f;
    if (s.memloc > 0) {
      b.Ploc = static_cast<vb_integer>((s.memloc - 1) % 1000 + 1);
      if (b.Ploc == 340) b.Ploc = 0;
    } else {
      do {
        b.Ploc = static_cast<vb_integer>(Random(1, 1000, *sim.rndy));
      } while (b.Ploc == 340);
    }
    b.Pval = s.Memval;
  }
}

// Shots.bas:861-890 — takesperm.
inline void takesperm(Sim& sim, int n, vb_long t) {
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[t];
  if (b.fertilized < -10) return;
  if (s.DnaLen == 0) return;
  b.fertilized = 10;
  b.mem[addr::SYSFERTILIZED] = 10;
  b.spermDNA = s.dna;
  b.spermDNAlen = s.DnaLen;
}

// Shots.bas:48-51 — MinBotRadius: si el golpe ocurre en esta fracción
// inicial del ciclo, se deja de buscar (sesgo por índice adicional, §4.4).
inline constexpr vb_single MinBotRadius = 0.2f;

// Shots.bas:921-1081 — NewShotCollision: bordes primero (toroidal envuelve;
// rígido clampa y refleja con ±Abs), búsqueda lineal sobre TODOS los bots con
// prefiltro por caja (MaxBotShotSeperation), swept-sphere con la posición del
// bot corregida a pos - vel + actvel, y recolocación del shot en el punto de
// impacto. Nota del fuente: el valor devuelto es el ÚLTIMO bot con raíces
// válidas, no el del t menor (earliestCollision solo gobierna el early-exit
// y la recolocación). El slot tirador es intocable aunque cambie de dueño.
inline int NewShotCollision(Sim& sim, vb_long shotnum) {
  Shot& sh = sim.Shots[shotnum];

  // Colisiones con los bordes del campo.
  if (sim.opts.Updnconnected) {
    if (sh.pos.y > sim.opts.FieldHeight)
      sh.pos.y = sh.pos.y - sim.opts.FieldHeight;
    else if (sh.pos.y < 0.0f)
      sh.pos.y = sh.pos.y + sim.opts.FieldHeight;
  } else {
    if (sh.pos.y > sim.opts.FieldHeight) {
      sh.pos.y = sim.opts.FieldHeight;
      sh.velocity.y = -1.0f * std::fabs(sh.velocity.y);
    } else if (sh.pos.y < 0.0f) {
      sh.pos.y = 0.0f;
      sh.velocity.y = std::fabs(sh.velocity.y);
    }
  }
  if (sim.opts.Dxsxconnected) {
    if (sh.pos.x > sim.opts.FieldWidth)
      sh.pos.x = sh.pos.x - sim.opts.FieldWidth;
    else if (sh.pos.x < 0.0f)
      sh.pos.x = sh.pos.x + sim.opts.FieldWidth;
  } else {
    if (sh.pos.x > sim.opts.FieldWidth) {
      sh.pos.x = sim.opts.FieldWidth;
      sh.velocity.x = -1.0f * std::fabs(sh.velocity.x);
    } else if (sh.pos.x < 0.0f) {
      sh.pos.x = 0.0f;
      sh.velocity.x = std::fabs(sh.velocity.x);
    }
  }

  int result = 0;
  vb_single earliestCollision = 100.0f;  // 100 = sin colisión
  vb_single hitTime = 0.0f;

  const Vector S0 = sh.pos;
  const Vector vs = sh.velocity;

  for (int robnum = 1; robnum <= sim.MaxRobs; ++robnum) {
    if (sim.rob[robnum].exist && sh.parent != robnum &&
        !BaseHidden(sim, sim.rob[robnum]) &&  // E5 (Shots.bas:998)
        std::fabs(sh.opos.x - sim.rob[robnum].pos.x) <
            sim.MaxBotShotSeperation &&
        std::fabs(sh.opos.y - sim.rob[robnum].pos.y) <
            sim.MaxBotShotSeperation) {
      const vb_single r = sim.rob[robnum].radius;

      Vector B0 = sim.rob[robnum].pos;
      B0 = VectorSub(B0, sim.rob[robnum].vel);
      B0 = VectorAdd(B0, sim.rob[robnum].actvel);

      Vector p = VectorSub(S0, B0);

      if (VectorMagnitude(p) < r) {
        // El shot ya está dentro del bot en t = 0: golpe inmediato.
        hitTime = 0.0f;
        earliestCollision = 0.0f;
        result = robnum;
        break;
      }

      const Vector vbv = sim.rob[robnum].actvel;
      Vector d = VectorSub(vs, vbv);
      const vb_single P2 = VectorMagnitudeSquare(p);
      const vb_single D2 = VectorMagnitudeSquare(d);
      if (D2 == 0.0f) continue;
      const vb_single DdotP = Dot(d, p);
      const vb_single X = -DdotP;
      vb_single Y = static_cast<vb_single>(
          std::pow(static_cast<double>(DdotP), 2.0) -
          static_cast<double>(D2) *
              (static_cast<double>(P2) -
               std::pow(static_cast<double>(r), 2.0)));

      if (Y < 0.0f) continue;  // sin colisión

      Y = static_cast<vb_single>(std::sqrt(static_cast<double>(Y)));

      const vb_single time0 = (X - Y) / D2;
      const vb_single time1 = (X + Y) / D2;

      const bool usetime0 = !(time0 <= 0.0f || time0 >= 1.0f);
      const bool usetime1 = !(time1 <= 0.0f || time1 >= 1.0f);
      if (!usetime0 && !usetime1) {
        continue;
      } else if (usetime0 && usetime1) {
        hitTime = Min(time0, time1);
        result = robnum;
      } else if (usetime0) {
        hitTime = time0;
        result = robnum;
      } else {
        hitTime = time1;
        result = robnum;
      }

      if (hitTime < earliestCollision) earliestCollision = hitTime;

      if (earliestCollision <= MinBotRadius) break;  // early-exit sesgado
    }
  }

  if (earliestCollision <= 1.0f) {
    // Recoloca el shot en el punto del impacto más temprano (los rebotes
    // salen de ahí).
    Vector vscopy = vs;
    sh.pos = VectorAdd(VectorScalar(vscopy, earliestCollision), S0);
  }
  return result;
}

// Obstacles.bas:411-432 — DoShotObstacleCollisions: shot dentro de una
// forma. Con shapesAbsorbShots muere; si no, rebota invirtiendo el eje por
// el que ENTRÓ (opos fuera del rango del eje). Un shot nacido dentro de la
// forma no invierte nada (opos también dentro).
inline void DoShotObstacleCollisions(Sim& sim, vb_long n) {
  Shot& s = sim.Shots[n];
  for (int i = 1; i <= sim.numObstacles; ++i) {
    const Obstacle& ob = sim.Obstacles[i];
    if (!ob.exist) continue;
    if (s.pos.x >= ob.pos.x && s.pos.x <= ob.pos.x + ob.Width &&
        s.pos.y >= ob.pos.y && s.pos.y <= ob.pos.y + ob.Height) {
      if (sim.opts.shapesAbsorbShots) s.exist = false;
      if (s.opos.x < ob.pos.x || s.opos.x > (ob.pos.x + ob.Width))
        s.velocity.x = -s.velocity.x;
      if (s.opos.y < ob.pos.y || s.opos.y > (ob.pos.y + ob.Height))
        s.velocity.y = -s.velocity.y;
    }
  }
}

// Shots.bas:288-425 — updateshots (tick paso 14).
inline void updateshots(Sim& sim) {
  sim.numshots = 0;
  const vb_long limit = sim.maxshotarray;  // tope cacheado como el For de VB6
  for (vb_long t = 1; t <= limit; ++t) {
    if (t > sim.maxshotarray) break;  // guard del fuente (Shots.bas:308)
    // Puntero y no referencia: createshot (rebotes) puede reubicar Shots y
    // hay que volver a indexar despues (RV-12; en VB6 Shots(t) se reindexa).
    Shot* s = &sim.Shots[t];

    if (s->flash) {
      s->exist = false;
      s->flash = false;
      s->DnaLen = 0;
    }
    if (!s->exist) continue;
    sim.numshots += 1;

    // Long + Single es Double: se redondea la suma, no el sumando (RV-16).
    if (s->shottype == -2)
      sim.TotalSimEnergy[sim.CurrentEnergyCycle] = vb_clng(
          static_cast<double>(sim.TotalSimEnergy[sim.CurrentEnergyCycle]) +
          static_cast<double>(s->nrg));

    int h;
    if (s->shottype == -100 || s->stored)
      h = 0;
    else
      h = NewShotCollision(sim, t);

    // Inmunidad filial ROTA: compara el SLOT tirador con el AbsNum del padre
    // del golpeado (Shots.bas:330; [PROBABLE BUG], catálogo §9).
    if (h > 0 && !(s->parent == sim.rob[h].parent && sim.rob[h].age <= 1)) {
      vb_single tempnum;
      if (s->Range == 0.0f)
        tempnum = static_cast<vb_single>(s->age) + 1.0f;
      else
        tempnum = static_cast<vb_single>(s->age) / s->Range;

      if (!(sim.opts.NoShotDecay && s->shottype == -2)) {
        if (!(s->shottype == -4 && sim.opts.NoWShotDecay)) {
          // Single * Atn / Atn: todo en Double, un redondeo (RV-14).
          s->nrg = static_cast<vb_single>(
              static_cast<double>(s->nrg) *
              std::atan(static_cast<double>(tempnum) * shotdecay - shotdecay) /
              std::atan(-static_cast<double>(shotdecay)));
        }
      }

      if (s->shottype > 0) {
        // shot de memoria: (tipo-1) Mod 1000 + 1, salto de 340, bloqueo por
        // poison con rebote -5 (M-09).
        s->shottype = static_cast<vb_integer>((s->shottype - 1) % 1000 + 1);
        if (s->shottype != addr::DelgeneSys) {
          if (s->nrg / 2.0f > sim.rob[h].poison || sim.rob[h].poison == 0.0f) {
            sim.rob[h].mem[s->shottype] = s->value;
          } else {
            createshot(sim, s->pos.x, s->pos.y, -s->velocity.x, -s->velocity.y, -5,
                       h, s->nrg / 2.0f, s->Range * 40.0f, 0);
            s = &sim.Shots[t];  // RV-12
            // Literales Double: un solo redondeo (RV-14).
            const double mitad = static_cast<double>(s->nrg / 2.0f);
            sim.rob[h].poison = static_cast<vb_single>(
                static_cast<double>(sim.rob[h].poison) - mitad * 0.9);
            sim.rob[h].Waste = static_cast<vb_single>(
                static_cast<double>(sim.rob[h].Waste) + mitad * 0.1);
            if (sim.rob[h].poison < 0.0f) sim.rob[h].poison = 0.0f;
            sim.rob[h].mem[addr::poison] = vb_cint(sim.rob[h].poison);
          }
        }
      } else {
        switch (s->shottype) {
          case -1: releasenrg(sim, h, t); break;
          case -2: takenrg(sim, h, t); break;
          case -6: releasebod(sim, h, t); break;
          case -7: addgene(sim, h, t); break;
          case -3: takeven(sim, h, t); break;
          case -4: takewaste(sim, h, t); break;
          case -5: takepoison(sim, h, t); break;
          case -8: takesperm(sim, h, t); break;
          default: break;
        }
        s = &sim.Shots[t];  // releasenrg/releasebod crean rebotes (RV-12)
      }
      taste(sim, h, s->opos.x, s->opos.y, s->shottype);
      s->flash = true;
    }

    if (sim.numObstacles > 0) DoShotObstacleCollisions(sim, t);

    s->opos = s->pos;
    s->pos = VectorAdd(s->pos, s->velocity);

    if ((sim.opts.NoShotDecay && s->shottype == -2) || s->stored) {
      // sin envejecimiento
    } else if (s->shottype == -4 && sim.opts.NoWShotDecay) {
      // sin envejecimiento
    } else {
      s->age += 1;
    }

    if (static_cast<vb_single>(s->age) > s->Range && !s->flash) {
      s->exist = false;
      s->DnaLen = 0;
    }
  }

  // Compactación (<70%): renumera los shots — los índices NO son estables.
  // CompactShots (Shots.bas:426-456): re-apunta rob().virusshot de los shots
  // almacenados con dueño vivo; los huérfanos se destruyen aquí (y el hueco
  // muerto se copia igualmente — quirk del fuente, replicado).
  if (sim.numshots < sim.maxshotarray * 0.7 && sim.maxshotarray > 100) {
    vb_long j = 1;
    for (vb_long i = 1; i <= sim.maxshotarray; ++i) {
      if (sim.Shots[i].exist) {
        if (sim.Shots[i].stored) {
          // E5 (Shots.bas:435): el virus almacenado de un Base oculto muere.
          if (sim.rob[sim.Shots[i].parent].exist &&
              !BaseHidden(sim, sim.rob[sim.Shots[i].parent])) {
            sim.rob[sim.Shots[i].parent].virusshot = j;
          } else {
            sim.Shots[i].exist = false;
            sim.Shots[i].stored = false;
            sim.Shots[i].DnaLen = 0;
          }
        }
        if (i != j) {
          sim.Shots[j] = sim.Shots[i];
          sim.Shots[i].exist = false;
          sim.Shots[i].stored = false;
          sim.Shots[i].DnaLen = 0;
        }
        j += 1;
      }
    }
    if (sim.numshots < 90)
      sim.maxshotarray = 100;
    else
      sim.maxshotarray = vb_clng(sim.numshots * 1.2);  // CLng (RV-11)
    sim.Shots.resize(sim.maxshotarray + 1);
    // Con 0 vivos queda en 0: el siguiente shot cae en el slot 0, que el
    // bucle (1..maxshotarray) no procesa nunca (RV-11b, fiel al fuente).
    sim.shotpointer = sim.numshots;
  }
  sim.ShotsThisCycle = sim.numshots;
}

// Shots.bas:1133-1171 — copygene: copia el gen p del TIRADOR del shot n al
// ADN del shot (virus). False si p esta fuera de los genes del padre.
inline bool copygene(Sim& sim, vb_long n, vb_integer p) {
  Shot& s = sim.Shots[n];
  const int parent = s.parent;

  if (p > sim.rob[parent].genenum || p < 1) return false;

  const vb_long GeneStart = genepos(sim.rob[parent].dna, p);
  const vb_long GeneEnding = GeneEnd(sim.rob[parent].dna, GeneStart);
  const vb_long genelen = GeneEnding - GeneStart + 1;
  if (genelen < 1) return false;

  s.dna.assign(static_cast<std::size_t>(genelen) + 1, Block{});
  for (vb_long t = 0; t <= genelen - 1; ++t)
    s.dna[t] = sim.rob[parent].dna[GeneStart + t];
  s.DnaLen = static_cast<vb_integer>(genelen);
  return true;
}

// Shots.bas:1124-1131 — MakeVirus: fabrica el shot -7 almacenado.
inline bool MakeVirus(Sim& sim, int robn, vb_integer gene) {
  sim.rob[robn].virusshot = newshot(sim, robn, -7,
                                    static_cast<vb_single>(gene), 1.0f);
  return sim.rob[robn].virusshot > 0;
}

// Shots.bas:1174-1230 — addgene: infeccion del bot n por el shot -7 p.
// [PROBABLE BUG] B3b-2 (B-19): si el virus penetra, la slime queda NEGATIVA
// antes de descontarse de power — el power resultante es MAYOR que el
// original (hoy sin reuso: la infeccion procede igual). [PROBABLE BUG]
// B3b-3 (B-20): power es proporcional a Shots().value = numero de gen.
// Consume 1 RNG (Random(0, genenum)).
inline void addgene(Sim& sim, int n, vb_long p) {
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[p];

  if (b.Corpse || b.VirusImmune) return;

  vb_single power = s.nrg / (s.Range * RobSize / 3.0f) * s.value;

  if (power < b.Slime * SlimeEffectiveness) {
    b.Slime = b.Slime - power / SlimeEffectiveness;  // absorbido
    return;
  } else {
    b.Slime = b.Slime - power / SlimeEffectiveness;  // puede quedar < 0
    power = power - b.Slime * SlimeEffectiveness;    // slime negativa AMPLIFICA
    if (b.Slime < 0.5f) b.Slime = 0.0f;
  }

  const vb_integer Position =
      static_cast<vb_integer>(Random(0, b.genenum, *sim.rndy));
  vb_long Insert;
  if (Position == 0) {
    Insert = 0;
  } else {
    Insert = GeneEnd(b.dna, genepos(b.dna, Position));
    if (Insert == b.DnaLen) Insert = b.DnaLen;  // literal del fuente (no-op)
  }

  const vb_long vlen = s.DnaLen;

  if (MakeSpace(b.dna, Insert, vlen)) {
    for (vb_long t = Insert; t <= Insert + vlen - 1; ++t)
      b.dna[t + 1] = s.dna[t - Insert];
  }

  makeoccurrlist(sim, n);
  b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));
  b.genenum = CountGenes(b.dna);
  b.mem[addr::DnaLenSys] = b.DnaLen;
  b.mem[addr::GenesSys] = static_cast<vb_integer>(b.genenum);

  b.SubSpecies = NewSubSpecies(sim, n);
  logmutation(sim, n,
              "Infected with virus of length " + StrVB(vlen) +
                  " during cycle " + StrVB(sim.opts.TotRunCycle) + " at pos " +
                  StrVB(Insert));
  b.Mutations += 1;
  b.LastMut += 1;
}

// Shots.bas:1084-1122 — Vshoot: normaliza mem(338) EN LA CELDA (M-11, con la
// corrección de dirección: el sysvar vshoot es 338, no 836 — el fuente manda)
// y lanza el virus almacenado. Consume 1 RNG (Random(1,1256)).
inline void Vshoot(Sim& sim, int n, vb_long thisshot) {
  Bot& b = sim.rob[n];
  Shot& s = sim.Shots[thisshot];
  if (!s.exist) return;
  if (!s.stored) return;

  if (b.mem[addr::VshootSys] < 0) b.mem[addr::VshootSys] = 1;

  vb_single tempa = static_cast<vb_single>(b.mem[addr::VshootSys]) * 20.0f;
  if (tempa > 32000.0f) tempa = 32000.0f;
  if (tempa < 0.0f) tempa = 0.0f;

  s.nrg = tempa;
  // Se resta de izquierda a derecha, como el fuente (RV-15): `nrg - (tempa /
  // 20#) - coste` es Double, y `nrg - CSng(mem) - coste` va en precision
  // extendida (N-06); el producto de costes, dentro de la expresion.
  const double shotcost =
      static_cast<double>(sim.vm.costs.v[cost::SHOTCOST]) *
      static_cast<double>(sim.vm.costs.v[cost::COSTMULTIPLIER]);
  b.nrg = static_cast<vb_single>(static_cast<double>(b.nrg) -
                                 static_cast<double>(tempa) / 20.0 - shotcost);

  s.Range = 11.0f + static_cast<vb_single>(
                        vb_cint(static_cast<double>(b.mem[addr::VshootSys]) / 2.0));
  b.nrg = static_cast<vb_single>(static_cast<double>(b.nrg) -
                                 static_cast<double>(b.mem[addr::VshootSys]) - shotcost);

  const vb_single ShAngle =
      static_cast<vb_single>(Random(1, 1256, *sim.rndy)) / 200.0f;
  s.stored = false;
  // Single + Cos(..) * Single: en Double, un redondeo (RV-14).
  s.pos.x = static_cast<vb_single>(
      static_cast<double>(b.pos.x) +
      std::cos(static_cast<double>(ShAngle)) * static_cast<double>(b.radius));
  s.pos.y = static_cast<vb_single>(
      static_cast<double>(b.pos.y) -
      std::sin(static_cast<double>(ShAngle)) * static_cast<double>(b.radius));
  s.velocity.x = absx(ShAngle, RobSize / 3.0f, 0, 0, 0);
  s.velocity.y = absy(ShAngle, RobSize / 3.0f, 0, 0, 0);
  s.velocity.x += b.actvel.x;
  s.velocity.y += b.actvel.y;
  s.opos.x = s.pos.x - s.velocity.x;
  s.opos.y = s.pos.y - s.velocity.y;
}

// Robots.bas:1716-1864 — robshoot: shoot/shootval -> shots. Siempre borra
// mem(shoot) y mem(shootval) al salir (regímenes de M-04/M-09).
inline void robshoot(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.nrg <= 0.0f) {
    b.mem[addr::shoot] = 0;
    b.mem[addr::shootval] = 0;
    return;
  }

  vb_integer shtype = b.mem[addr::shoot];
  vb_single value = b.mem[addr::shootval];
  vb_single multiplier = 0.0f, rngmultiplier = 0.0f, Cost = 0.0f;
  bool valmode = false;
  // shotcost en float: donde el producto entra en aritmetica Variant (el
  // IIf de numties) o se asigna a un Single, VB6 lo redondea a Single.
  // costx(x): el mismo producto dentro de una expresion (lectura N-06), en
  // el orden del fuente `x * c1 * c2` (RV-15).
  const vb_single shotcost =
      sim.vm.costs.v[cost::SHOTCOST] * sim.vm.costs.v[cost::COSTMULTIPLIER];
  const auto costx = [&](double x) {
    return x * static_cast<double>(sim.vm.costs.v[cost::SHOTCOST]) *
           static_cast<double>(sim.vm.costs.v[cost::COSTMULTIPLIER]);
  };
  const vb_single nt = (b.numties < 0.0f) ? 0.0f : b.numties;

  if (shtype == -1 || shtype == -6) {
    if (value < 0.0f) {
      multiplier = 1.0f;
      rngmultiplier = -value;
    }
    if (value > 0.0f) {
      multiplier = value;
      rngmultiplier = 1.0f;
      valmode = true;
    }
    if (value == 0.0f) {
      multiplier = 1.0f;
      rngmultiplier = 1.0f;
    }
    if (rngmultiplier > 4.0f) {
      Cost = static_cast<vb_single>(costx(rngmultiplier));
      rngmultiplier = static_cast<vb_single>(
          std::log(static_cast<double>(rngmultiplier) / 2.0) / std::log(2.0));
    } else if (!valmode) {
      rngmultiplier = 1.0f;
      Cost = shotcost / (nt + 1.0f);
    }
    if (multiplier > 4.0f) {
      Cost = static_cast<vb_single>(costx(multiplier));
      multiplier = static_cast<vb_single>(
          std::log(static_cast<double>(multiplier) / 2.0) / std::log(2.0));
    } else if (valmode) {
      multiplier = 1.0f;
      Cost = shotcost / (nt + 1.0f);
    }
    if (Cost > b.nrg && Cost > 2.0f && b.nrg > 2.0f && valmode) {
      Cost = b.nrg;
      multiplier = static_cast<vb_single>(
          std::log(static_cast<double>(b.nrg) / costx(1.0)) / std::log(2.0));
    }
    if (Cost > b.nrg && Cost > 2.0f && b.nrg > 2.0f && !valmode) {
      Cost = b.nrg;
      rngmultiplier = static_cast<vb_single>(
          std::log(static_cast<double>(b.nrg) / costx(1.0)) / std::log(2.0));
    }
  }

  if (shtype >= 0) {  // shot de memoria: Mod MaxMem (1205 -> 205, M-09)
    shtype = static_cast<vb_integer>(shtype % MaxMem);
    Cost = shotcost;
    if (b.nrg < Cost) Cost = b.nrg;
    b.nrg -= Cost;
    newshot(sim, n, shtype, value, 1.0f, true);
    // E5 (Robots.bas:1791-1792) — Disqualify: disparar un shot de memoria
    // (info shot) descalifica bajo Disqualify = 2.
    DisqualifyAction(sim, n, "firing an info shot");
  } else {
    switch (shtype) {
      case -1: {
        if (b.Multibot)
          value = 20.0f + (b.body / 5.0f) * (nt + 1.0f);
        else
          value = 20.0f + (b.body / 5.0f);
        value *= multiplier;
        if (b.nrg < Cost) Cost = b.nrg;
        b.nrg -= Cost;
        newshot(sim, n, shtype, value, rngmultiplier, true);
        break;
      }
      case -2: {
        value = std::fabs(value);
        if (b.nrg < value) value = b.nrg;
        if (value == 0.0f) value = b.nrg / 100.0f;
        const vb_single EnergyLost = value + shotcost / (nt + 1.0f);
        if (EnergyLost > b.nrg)
          b.nrg = 0.0f;
        else
          b.nrg -= EnergyLost;
        newshot(sim, n, shtype, value, 1.0f, true);
        break;
      }
      case -3: {  // venom (M-03)
        value = std::fabs(value);
        if (value > b.venom) value = b.venom;
        if (value == 0.0f) value = b.venom / 20.0f;
        b.venom -= value;
        b.mem[825] = vb_cint(b.venom);
        const vb_single EnergyLost = shotcost / (nt + 1.0f);
        if (EnergyLost > b.nrg)
          b.nrg = 0.0f;
        else
          b.nrg -= EnergyLost;
        newshot(sim, n, shtype, value, 1.0f, true);
        break;
      }
      case -4: {
        value = std::fabs(value);
        if (value == 0.0f) value = b.Waste / 20.0f;
        if (value > b.Waste) value = b.Waste;
        b.Waste = static_cast<vb_single>(static_cast<double>(b.Waste) -
                                         static_cast<double>(value) * 0.99);  // RV-14
        b.Pwaste += value / 100.0f;
        const vb_single EnergyLost = shotcost / (nt + 1.0f);
        if (EnergyLost > b.nrg)
          b.nrg = 0.0f;
        else
          b.nrg -= EnergyLost;
        newshot(sim, n, shtype, value, 1.0f, true);
        break;
      }
      case -6: {
        if (b.Multibot)
          value = 10.0f + (b.body / 2.0f) * (nt + 1.0f);
        else
          value = 10.0f + std::fabs(b.body) / 2.0f;
        if (b.nrg < Cost) Cost = b.nrg;
        b.nrg -= Cost;
        value *= multiplier;
        newshot(sim, n, shtype, value, rngmultiplier, true);
        break;
      }
      case -8: {
        Cost = shotcost;
        if (b.nrg < Cost) Cost = b.nrg;
        b.nrg -= Cost;
        newshot(sim, n, shtype, value, 1.0f, true);
        break;
      }
      default:
        break;  // -5 y -7 no se disparan desde robshoot
    }
  }

  b.mem[addr::shoot] = 0;
  b.mem[addr::shootval] = 0;
}

}  // namespace db
