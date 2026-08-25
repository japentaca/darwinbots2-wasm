// dbcore/shots.hpp — Shots.bas: newshot/createshot, updateshots con los
// efectos por tipo que M3 ejercita (shots de memoria con salto de 340 y
// bloqueo por poison, venom -3, poison -5, esperma -8, waste -4), Vshoot y
// robshoot (Robots.bas:1716-1864). Los efectos de alimentación
// (releasenrg/takenrg/releasebod) y addgene son de B3a/B3b: stubs registrados.
// La colisión swept-sphere exacta (NewShotCollision, Shots.bas:960-1082) es
// de F-*: aquí punto-en-círculo con la regla "slot del tirador intocable".
#pragma once

#include "senses.hpp"
#include "sim.hpp"

namespace db {

inline constexpr int shotdecay = 40;            // Shots.bas:45
inline constexpr int ShellEffectiveness = 20;   // :46
inline constexpr int VenumEffectivenessVSShell = 25;  // :48

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

// Shots.bas:90-202 — newshot. Consume 2 RNG (Random(-2,2) y Random(-20,20),
// uno de ellos muerto: `ran` no se usa — 33-SHOTS.md). Normaliza aimshoot
// (Mod 1256) y backshot EN LA CELDA antes de consumirlos (M-11).
inline vb_long newshot(Sim& sim, int n, vb_integer shottype, vb_single val,
                       vb_single rngmultiplier, bool offset = false) {
  vb_long a = FirstSlot(sim);
  if (a > sim.maxshotarray) {
    sim.shotpointer = sim.maxshotarray;
    sim.maxshotarray = static_cast<vb_long>(sim.maxshotarray * 1.1);
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
    ShAngle = b.aim - static_cast<vb_single>(b.mem[addr::aimshoot]) / 200.0f;
    b.mem[addr::aimshoot] = 0;
  }
  ShAngle += static_cast<vb_single>(Random(-20, 20, *sim.rndy)) / 200.0f;

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
    s.nrg = static_cast<vb_single>(
                std::log(std::fabs(static_cast<double>(b.vbody)))) *
            60.0f * rngmultiplier;
    const vb_long temp =
        static_cast<vb_long>(vb_round64(static_cast<double>(s.nrg)) + 40 + 1) / 40;
    s.Range = static_cast<vb_single>(temp);
    s.nrg = static_cast<vb_single>(temp) * 40.0f;
  } else {
    s.Range = rngmultiplier;
    s.nrg = 40.0f * rngmultiplier;
  }

  vb_long result = a;

  if (shottype == -7) {  // virus (MakeVirus): copygene — B3b pendiente
    sim.diag.makevirus_stub += 1;
    s.exist = false;
    s.stored = false;
    result = -1;
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

// Shots.bas:206-268 — createshot (rebotes de poison, shots de decay).
inline void createshot(Sim& sim, vb_single X, vb_single Y, vb_single vx,
                       vb_single vy, vb_integer loc, int par, vb_single val,
                       vb_single Range, vb_long col) {
  vb_long a = FirstSlot(sim);
  if (a > sim.maxshotarray) {
    sim.shotpointer = sim.maxshotarray;
    sim.maxshotarray = static_cast<vb_long>(sim.maxshotarray * 1.1);
    sim.Shots.resize(sim.maxshotarray + 1);
  }
  Shot& s = sim.Shots[a];
  s.parent = static_cast<vb_integer>(par);
  s.FromSpecie = sim.rob[par].FName;
  s.fromveg = sim.rob[par].Veg;
  s.pos = VectorSet(X, Y);
  s.velocity = VectorSet(vx, vy);
  s.opos = VectorSub(s.pos, s.velocity);
  s.age = 0;
  s.color = col;
  s.exist = true;
  s.stored = false;
  s.DnaLen = 0;

  const vb_long temp =
      (static_cast<vb_long>(vb_round64(static_cast<double>(Range))) + 40 + 1) / 40;
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

// Shots.bas:816-826 — takewaste.
inline void takewaste(Sim& sim, int n, vb_long t) {
  Shot& s = sim.Shots[t];
  const vb_single power = s.nrg / (s.Range * (RobSize / 3.0f)) * s.value;
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
    b.Poisoncount += power / 1.5f;
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
    // hidepred: capa torneo ⚙, fuera.
    if (sim.rob[robnum].exist && sh.parent != robnum &&
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

// Shots.bas:288-425 — updateshots (tick paso 14).
inline void updateshots(Sim& sim) {
  sim.numshots = 0;
  const vb_long limit = sim.maxshotarray;  // tope cacheado como el For de VB6
  for (vb_long t = 1; t <= limit; ++t) {
    if (t > sim.maxshotarray) break;  // guard del fuente (Shots.bas:308)
    Shot& s = sim.Shots[t];

    if (s.flash) {
      s.exist = false;
      s.flash = false;
      s.DnaLen = 0;
    }
    if (!s.exist) continue;
    sim.numshots += 1;

    if (s.shottype == -2)
      sim.TotalSimEnergy[sim.CurrentEnergyCycle] +=
          static_cast<vb_long>(vb_round64(static_cast<double>(s.nrg)));

    int h;
    if (s.shottype == -100 || s.stored)
      h = 0;
    else
      h = NewShotCollision(sim, t);

    // Inmunidad filial ROTA: compara el SLOT tirador con el AbsNum del padre
    // del golpeado (Shots.bas:330; [PROBABLE BUG], catálogo §9).
    if (h > 0 && !(s.parent == sim.rob[h].parent && sim.rob[h].age <= 1)) {
      vb_single tempnum;
      if (s.Range == 0.0f)
        tempnum = static_cast<vb_single>(s.age) + 1.0f;
      else
        tempnum = static_cast<vb_single>(s.age) / s.Range;

      if (!(sim.opts.NoShotDecay && s.shottype == -2)) {
        if (!(s.shottype == -4 && sim.opts.NoWShotDecay)) {
          s.nrg = s.nrg *
                  static_cast<vb_single>(
                      std::atan(static_cast<double>(tempnum) * shotdecay -
                                shotdecay)) /
                  static_cast<vb_single>(std::atan(-static_cast<double>(shotdecay)));
        }
      }

      if (s.shottype > 0) {
        // shot de memoria: (tipo-1) Mod 1000 + 1, salto de 340, bloqueo por
        // poison con rebote -5 (M-09).
        s.shottype = static_cast<vb_integer>((s.shottype - 1) % 1000 + 1);
        if (s.shottype != addr::DelgeneSys) {
          if (s.nrg / 2.0f > sim.rob[h].poison || sim.rob[h].poison == 0.0f) {
            sim.rob[h].mem[s.shottype] = s.value;
          } else {
            createshot(sim, s.pos.x, s.pos.y, -s.velocity.x, -s.velocity.y, -5,
                       h, s.nrg / 2.0f, s.Range * 40.0f, 0);
            sim.rob[h].poison -= (s.nrg / 2.0f) * 0.9f;
            sim.rob[h].Waste += (s.nrg / 2.0f) * 0.1f;
            if (sim.rob[h].poison < 0.0f) sim.rob[h].poison = 0.0f;
            sim.rob[h].mem[addr::poison] = vb_cint(sim.rob[h].poison);
          }
        }
      } else {
        switch (s.shottype) {
          case -1:  // releasenrg — B3a (31-ENERGIA)
          case -2:  // takenrg
          case -6:  // releasebod
          case -7:  // addgene — B3b
            sim.diag.shot_feed_stub += 1;
            break;
          case -3: takeven(sim, h, t); break;
          case -4: takewaste(sim, h, t); break;
          case -5: takepoison(sim, h, t); break;
          case -8: takesperm(sim, h, t); break;
          default: break;
        }
      }
      taste(sim, h, s.opos.x, s.opos.y, s.shottype);
      s.flash = true;
    }

    // DoShotObstacleCollisions (Obstacles.bas:411-432): B7 — solo puede
    // actuar con formas en el campo; stub registrado.
    if (sim.numObstacles > 0) sim.diag.obstacle_collision_stub += 1;

    s.opos = s.pos;
    s.pos = VectorAdd(s.pos, s.velocity);

    if ((sim.opts.NoShotDecay && s.shottype == -2) || s.stored) {
      // sin envejecimiento
    } else if (s.shottype == -4 && sim.opts.NoWShotDecay) {
      // sin envejecimiento
    } else {
      s.age += 1;
    }

    if (static_cast<vb_single>(s.age) > s.Range && !s.flash) {
      s.exist = false;
      s.DnaLen = 0;
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
          if (sim.rob[sim.Shots[i].parent].exist) {  // hidepred: capa ⚙
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
      sim.maxshotarray = static_cast<vb_long>(sim.numshots * 1.2);
    sim.Shots.resize(sim.maxshotarray + 1);
    sim.shotpointer = sim.numshots > 0 ? sim.numshots : 1;
  }
  sim.ShotsThisCycle = sim.numshots;
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
  b.nrg -= (tempa / 20.0f) + sim.vm.costs.v[cost::SHOTCOST] *
                                 sim.vm.costs.v[cost::COSTMULTIPLIER];

  s.Range = 11.0f + static_cast<vb_single>(
                        vb_cint(static_cast<double>(b.mem[addr::VshootSys]) / 2.0));
  b.nrg -= static_cast<vb_single>(b.mem[addr::VshootSys]) +
           sim.vm.costs.v[cost::SHOTCOST] * sim.vm.costs.v[cost::COSTMULTIPLIER];

  const vb_single ShAngle =
      static_cast<vb_single>(Random(1, 1256, *sim.rndy)) / 200.0f;
  s.stored = false;
  s.pos.x = b.pos.x + static_cast<vb_single>(std::cos(static_cast<double>(ShAngle))) * b.radius;
  s.pos.y = b.pos.y - static_cast<vb_single>(std::sin(static_cast<double>(ShAngle))) * b.radius;
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
  const vb_single shotcost =
      sim.vm.costs.v[cost::SHOTCOST] * sim.vm.costs.v[cost::COSTMULTIPLIER];
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
      Cost = rngmultiplier * shotcost;
      rngmultiplier = static_cast<vb_single>(
          std::log(static_cast<double>(rngmultiplier) / 2.0) / std::log(2.0));
    } else if (!valmode) {
      rngmultiplier = 1.0f;
      Cost = shotcost / (nt + 1.0f);
    }
    if (multiplier > 4.0f) {
      Cost = multiplier * shotcost;
      multiplier = static_cast<vb_single>(
          std::log(static_cast<double>(multiplier) / 2.0) / std::log(2.0));
    } else if (valmode) {
      multiplier = 1.0f;
      Cost = shotcost / (nt + 1.0f);
    }
    if (Cost > b.nrg && Cost > 2.0f && b.nrg > 2.0f && valmode) {
      Cost = b.nrg;
      multiplier = static_cast<vb_single>(
          std::log(static_cast<double>(b.nrg) / shotcost) / std::log(2.0));
    }
    if (Cost > b.nrg && Cost > 2.0f && b.nrg > 2.0f && !valmode) {
      Cost = b.nrg;
      rngmultiplier = static_cast<vb_single>(
          std::log(static_cast<double>(b.nrg) / shotcost) / std::log(2.0));
    }
  }

  if (shtype >= 0) {  // shot de memoria: Mod MaxMem (1205 -> 205, M-09)
    shtype = static_cast<vb_integer>(shtype % MaxMem);
    Cost = shotcost;
    if (b.nrg < Cost) Cost = b.nrg;
    b.nrg -= Cost;
    newshot(sim, n, shtype, value, 1.0f, true);
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
        b.Waste -= value * 0.99f;
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
