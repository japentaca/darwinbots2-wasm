// dbcore/gamemodes.hpp — E5: modos de juego. La capa ⚙ torneo/evo que corre
// DENTRO del tick, transcrita del fuente: paso 3 (hidepred/evo,
// Master.bas:52-201), paso 8 (handicap, :302-313), pasos 9/22 (avrnrg,
// :315-330 / :398-414), paso 13 (Player Bot, :347-360), paso 26 (modos
// seeding/ZeroBot/test, :483-554), el módulo F1Mode.bas (FindSpecies /
// Countpop / dreason) y sus ayudantes: calc_handycap (Evo.bas:729-739),
// calculateZB (Evo.bas:686-727) y fittest/score/InvestedEnergy
// (main.frm:2993-3090, solo tipo 0).
//
// Deslinde core/host (decisión E5): el core muta el estado de la sim
// exactamente como el fuente (conteos, handicap, reposicionados, kills,
// boosts de mutarray, rondas F1) y sustituye las acciones de UI/disco/
// proceso del original (Contest_Form, FileCopy, restarter, logevo, MsgBox,
// salvarob) por eventos en sim.events que la capa host lee y limpia. La
// "carrera" evo completa (Evo.bas: Increase/Decrease_Difficulty, Next_Stage,
// scale_mutations, staging de archivos — consume RNG en el proceso
// MORIBUNDO, irrelevante para la sim siguiente) y la orquestación de liga
// (MDIForm1.frm:2536-2790, populateladder) son capa host, fuera del core.
#pragma once

#include <array>
#include <cmath>
#include <string>

#include "memmap.hpp"
#include "robots.hpp"
#include "sim.hpp"

namespace db {

// F1Mode.bas:72/:194 — realname: FName sin los últimos 4 chars (".txt").
// Con Len(FName) < 4 el Left(s, n<0) del original lanzaría error 5
// (inalcanzable: toda especie termina en .txt); aquí se trunca a "".
inline std::string RealName(const std::string& fname) {
  return fname.size() >= 4 ? fname.substr(0, fname.size() - 4)
                           : std::string();
}

// Evo.bas:729-731 — calc_exact_handycap.
inline double calc_exact_handycap(const Sim& sim) {
  return sim.evo.energydifXP - sim.evo.energydifXP2;
}

// Evo.bas:733-739 — calc_handycap: rampa hasta hidePredCycl*8 ciclos. Con
// hidePredCycl = 0 la comparación es False y no hay división (la división
// solo corre en la rama True, con denominador > TotRunCycle >= 0).
inline double calc_handycap(const Sim& sim) {
  const vb_long denom =
      static_cast<vb_long>(sim.hidePredCycl) * static_cast<vb_long>(8);
  if (sim.opts.TotRunCycle < denom)
    return calc_exact_handycap(sim) *
           static_cast<double>(sim.opts.TotRunCycle) /
           static_cast<double>(denom);
  return calc_exact_handycap(sim);
}

// main.frm:3076-3081 — InvestedEnergy: nrg + body*10 (aritmética Single,
// ensanchada a Double al asignar). TotalOffspring/Cancer son globales del
// form en el original; aquí parámetros por referencia.
inline double InvestedEnergy(const Sim& sim, int t, vb_long& TotalOffspring,
                             bool& Cancer) {
  const double ie = static_cast<double>(sim.rob[t].nrg +
                                        sim.rob[t].body * 10.0f);
  TotalOffspring += 1;
  if (ie < 1000.0) Cancer = true;
  return ie;
}

// main.frm:3040-3074 — score, solo tipo 0: suma de InvestedEnergy sobre la
// descendencia (parent = AbsNum) hasta maxrec niveles. Los tipos 1-4
// (highlight/líneas de parentesco) son UI, fuera.
inline double score0(const Sim& sim, int r, int reclev, int maxrec,
                     vb_long& TotalOffspring, bool& Cancer) {
  double sc = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist) {
      if (sim.rob[t].parent == sim.rob[r].AbsNum) {
        if (reclev < maxrec)
          sc += score0(sim, t, reclev + 1, maxrec, TotalOffspring, Cancer);
        sc += InvestedEnergy(sim, t, TotalOffspring, Cancer);
      }
    }
  }
  return sc;
}

inline void calculateZB(Sim& sim, vb_long robid, double Mx, int bestrob);

// main.frm:2993-3033 — Form1.fittest: el bot con más "energía invertida" en
// sí y su descendencia, ponderada por intFindBestV2. En modos 7/8 ignora
// familias con Cancer, retroalimenta calculateZB y mueve robfocus.
inline int Fittest(Sim& sim) {
  const double sEnergy =
      static_cast<double>(sim.intFindBestV2 > 100 ? 100 : sim.intFindBestV2) /
      100.0;
  const double sPopulation =
      static_cast<double>(sim.intFindBestV2 < 100 ? 100
                                                  : 200 - sim.intFindBestV2) /
      100.0;
  int fit = 0;  // Function fittest: 0 hasta la primera asignación
  double Mx = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    const Bot& b = sim.rob[t];
    if (b.exist && !b.Veg && b.FName != "Corpse" && !BaseHidden(sim, b)) {
      vb_long TotalOffspring = 1;
      bool Cancer = false;
      // s = score(...) + .nrg + .body*10 — el primer operando es Double:
      // la cadena propaga en doble termino a termino (solo body*10 es
      // producto Single), a diferencia de InvestedEnergy (suma Single).
      double s = score0(sim, t, 1, 10, TotalOffspring, Cancer) +
                 static_cast<double>(b.nrg) +
                 static_cast<double>(b.body * 10.0f);
      if (s < 0) s = 0;
      s = std::pow(static_cast<double>(TotalOffspring), sPopulation) *
          std::pow(s, sEnergy);
      if (sim.x_restartmode == 7 || sim.x_restartmode == 8) {
        if (Cancer) s = 0;  // ignora familias cáncer en modo zerobot
      }
      if (s >= Mx) {
        Mx = s;
        fit = t;
      }
    }
  }
  // Z E R O B O T (:3027-3032): pasa el resultado a la capa evo.
  if (sim.x_restartmode == 7 || sim.x_restartmode == 8) {
    if (sim.rob[fit].FName == "Mutate.txt") {
      calculateZB(sim, sim.rob[fit].AbsNum, Mx, fit);
      sim.robfocus = static_cast<vb_integer>(fit);
    }
  }
  return fit;
}

// Evo.bas:686-727 — calculateZB: seguimiento del mejor zerobot entre
// llamadas (Statics oldid/oldMx → sim.zb_oldid/zb_oldMx). Las tres ramas
// logevo y ZBreadyforTest (staging + restarter) se sustituyen por eventos.
inline void calculateZB(Sim& sim, vb_long robid, double Mx, int bestrob) {
  if (sim.rob[bestrob].LastMut > 0) {
    const vb_long MratesMax =
        sim.NormMut ? static_cast<vb_long>(sim.rob[bestrob].DnaLen) *
                          static_cast<vb_long>(sim.valMaxNormMut)
                    : 2000000000;
    bool goodtest = false;  // no duplicate message

    if (sim.zb_oldid != robid && sim.zb_oldid != 0) {
      sim.events.zb_goodtest = true;  // logevo "'GoodTest' reason: ..."
      Bot& b = sim.rob[bestrob];      // robot is doing well, why not?
      b.Mutables.mutarray[mut::PointUP] = static_cast<vb_single>(
          static_cast<double>(b.Mutables.mutarray[mut::PointUP]) * 1.15);
      if (b.Mutables.mutarray[mut::PointUP] > static_cast<vb_single>(MratesMax))
        b.Mutables.mutarray[mut::PointUP] = static_cast<vb_single>(MratesMax);
      b.Mutables.mutarray[mut::P2UP] = static_cast<vb_single>(
          static_cast<double>(b.Mutables.mutarray[mut::P2UP]) * 1.15);
      if (b.Mutables.mutarray[mut::P2UP] > static_cast<vb_single>(MratesMax))
        b.Mutables.mutarray[mut::P2UP] = static_cast<vb_single>(MratesMax);
      goodtest = true;
    }

    if (sim.zb_oldid == robid && Mx > sim.zb_oldMx) {
      Bot& b = sim.rob[bestrob];
      b.Mutables.mutarray[mut::PointUP] = static_cast<vb_single>(
          static_cast<double>(b.Mutables.mutarray[mut::PointUP]) * 1.75);
      if (b.Mutables.mutarray[mut::PointUP] > static_cast<vb_single>(MratesMax))
        b.Mutables.mutarray[mut::PointUP] = static_cast<vb_single>(MratesMax);
      b.Mutables.mutarray[mut::P2UP] = static_cast<vb_single>(
          static_cast<double>(b.Mutables.mutarray[mut::P2UP]) * 1.75);
      if (b.Mutables.mutarray[mut::P2UP] > static_cast<vb_single>(MratesMax))
        b.Mutables.mutarray[mut::P2UP] = static_cast<vb_single>(MratesMax);
      // ZBreadyforTest bestrob → host (salvarob + staging + x_restartmode 9
      // + restarter).
      sim.events.zb_ready_for_test = true;
    } else {
      if (!goodtest) sim.events.zb_reset = true;  // logevo "'Reset' ..."
    }

    sim.zb_oldMx = Mx;
    sim.zb_oldid = robid;
  } else {  // if robot did not mutate
    sim.events.zb_reset = true;  // logevo "'Reset' reason: No mutations"
  }
}

// Master.bas:52-201 — paso 3 del tick: lógica hidepred/evo. Solo corre en
// modo evo (usehidepred = x_restartmode 4/5). Consume RNG únicamente al
// cambiar de modo (1 rndy en :198). El GoTo Mode de :103 se modela con el
// while: con LFOR en el tope (150) y Mutate por debajo de Base, resta 100
// y reevalúa hasta caer bajo el umbral (y entonces NO alterna).
inline void HidePredStep(Sim& sim, bool usehidepred) {
  if (!usehidepred) return;
  auto& E = sim.evo;

  // Conteo de especies para el fin del evo (:66-73).
  vb_integer Base_count = 0, Mutate_count = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist) {
      if (sim.rob[t].FName == "Base.txt")
        Base_count = static_cast<vb_integer>(Base_count + 1);
      if (sim.rob[t].FName == "Mutate.txt")
        Mutate_count = static_cast<vb_integer>(Mutate_count + 1);
    }
  }
  if (Base_count > Mutate_count) E.stagnent = false;

  // Fin del evo (:76-88). El original apaga la sim (Form1.Active = False) y
  // llama UpdateLostEvo/UpdateWonEvo (Evo.bas: archivos + restarter — el
  // tick ACTUAL continúa; restarter solo lanza el proceso nuevo). Aquí:
  // eventos. stopflag evita que la derrota dispare también la victoria.
  if (Mutate_count == 0) {
    sim.events.sim_stop_requested = true;
    sim.stopflag = true;  // bug fix de Spork22 (:80)
    sim.events.evo_lost = true;
  }
  if (Base_count == 0 && !sim.stopflag) {
    sim.events.sim_stop_requested = true;
    sim.events.evo_won = true;
    sim.events.evo_won_best = static_cast<vb_integer>(Fittest(sim));
  }
  // Prevents simulation from running too long (:90).
  if (sim.opts.TotRunCycle == 1000000) E.stagnent = true;

  // Mode: (:98-200).
  while (static_cast<double>(E.ModeChangeCycles) >
         (static_cast<double>(sim.hidePredCycl) / 1.2 +
          static_cast<double>(E.hidePredOffset))) {
    if (sim.LFOR == 150.0f && Mutate_count < Base_count && E.hidepred) {
      E.ModeChangeCycles -= 100;
      continue;  // GoTo Mode (:103)
    }

    // calculate new energy handycap (:106-120). ModeChangeCycles > 0 aquí
    // (el paso 2 lo incrementó y solo este bloque lo resetea): la división
    // no puede ser /0 salvo estado inyectado — semántica IEEE si ocurre.
    E.energydif2 =
        E.energydif2 + E.energydif / static_cast<double>(E.ModeChangeCycles);
    if (E.hidepred) {
      const double holdXP =
          (E.energydifX -
           (E.energydif / static_cast<double>(E.ModeChangeCycles))) /
          static_cast<double>(sim.LFOR);
      if (holdXP < E.energydifXP)
        E.energydifXP = holdXP;
      else
        E.energydifXP = (E.energydifXP * 9 + holdXP) / 10;

      // inverse handycap
      E.energydifXP2 =
          (E.energydifX2 - E.energydif2) / static_cast<double>(sim.LFOR);
      if (E.energydifXP2 > 0) E.energydifXP2 = 0;
      if ((E.energydifXP - E.energydifXP2) > 0.1)
        E.energydifXP2 = E.energydifXP - 0.1;
      E.energydifX2 = E.energydif2;
      E.energydif2 = 0;
    }
    E.energydifX = E.energydif / static_cast<double>(E.ModeChangeCycles);
    E.energydif = 0;

    // An attempt to get rid of 'chasers' without using any reposition code
    // (:122-195).
    if (E.hidepred) {
      // Erase offensive shots (:125-132).
      for (vb_long t = 1; t <= sim.maxshotarray; ++t) {
        Shot& sh = sim.Shots[static_cast<std::size_t>(t)];
        if (sh.shottype == -1 || sh.shottype == -6) {
          sh.exist = false;
          sh.flash = false;
        }
      }

      // Reposition robots the safe way (:135-193).
      vb_long k2 = 0;
      vb_long k;  // robots moved last attempt
      do {
        k = 0;
        for (int t = 1; t <= sim.MaxRobs; ++t) {
          if (sim.rob[t].exist && sim.rob[t].FName == "Base.txt") {
            for (int i = 1; i <= sim.MaxRobs; ++i) {
              if (sim.rob[i].exist && sim.rob[i].FName == "Mutate.txt") {
                // calculate ingagment distance (:144-157). Log natural
                // (VB6 Log), cadena Double, asignación a Single.
                vb_single ingdist;
                if (sim.rob[t].body > sim.rob[i].body) {
                  if (sim.rob[t].body > 10.0f)
                    ingdist = static_cast<vb_single>(
                        std::log(static_cast<double>(sim.rob[t].body)) * 60 +
                        41);
                  else
                    ingdist = 40.0f;
                } else {
                  if (sim.rob[i].body > 10.0f)
                    ingdist = static_cast<vb_single>(
                        std::log(static_cast<double>(sim.rob[i].body)) * 60 +
                        41);
                  else
                    ingdist = 40.0f;
                }
                // both radii plus shot dist plus offset 1 shot travel dist
                ingdist = sim.rob[t].radius + sim.rob[i].radius + ingdist +
                          40.0f;

                Vector posdif = VectorSub(sim.rob[t].pos, sim.rob[i].pos);
                if (VectorMagnitude(posdif) < ingdist) {
                  Bot& bi = sim.rob[i];
                  // ingdist becomes offset dist
                  ingdist = ingdist - VectorMagnitude(posdif);
                  // offset the multibot by ingagment distance. VectorScalar
                  // clampa ByRef su primer argumento — aquí el temporal de
                  // VectorUnit, como en el fuente (:164).
                  Vector unit = VectorUnit(posdif);
                  const Vector newpoz =
                      VectorSub(bi.pos, VectorScalar(unit, ingdist));
                  Vector pozdif;
                  pozdif.x = newpoz.x - bi.pos.x;
                  pozdif.y = newpoz.y - bi.pos.y;
                  if (bi.numties > 0) {
                    std::array<vb_integer, 51> clist{};
                    clist[0] = static_cast<vb_integer>(i);
                    ListCells(sim, clist);
                    // move multibot — solo la propia especie (:176)
                    int tk = 1;
                    while (clist[tk] > 0) {
                      if (sim.rob[clist[tk]].FName == "Mutate.txt") {
                        sim.rob[clist[tk]].pos.x =
                            sim.rob[clist[tk]].pos.x + pozdif.x;
                        sim.rob[clist[tk]].pos.y =
                            sim.rob[clist[tk]].pos.y + pozdif.y;
                      }
                      tk = tk + 1;
                    }
                  }
                  bi.pos.x = bi.pos.x + pozdif.x;
                  bi.pos.y = bi.pos.y + pozdif.y;
                  k = k + 1;
                  k2 = k2 + 1;
                }
              }
            }
          }
        }
        // Scales as mutate_count scales (:193): Long > Double.
      } while (!(k == 0 ||
                 static_cast<double>(k2) >
                     (3200 + static_cast<double>(Mutate_count) * 0.9)));
    }

    // change hide pred (:196-199). 1 rndy; asignación Double→Integer con
    // redondeo bancario.
    E.hidepred = !E.hidepred;
    E.hidePredOffset = static_cast<vb_integer>(
        vb_round64(static_cast<double>(sim.hidePredCycl) / 3 *
                   static_cast<double>(sim.rnd())));
    E.ModeChangeCycles = 0;
    break;  // el If del fuente no repite tras ejecutar el cuerpo
  }
}

// Master.bas:302-313 — paso 8: inyección del handicap a los Mutate.txt.
// OJO: a diferencia de los pasos 9/22 este bucle NO está gateado por
// usehidepred — solo por hidepred dentro (que únicamente el modo evo
// alterna, pero una sim guardada con hidepred = True lo activaría).
// calc_handycap se evalúa por bot, como la llamada del fuente.
inline void HandicapStep(Sim& sim) {
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    Bot& b = sim.rob[t];
    if (b.exist) {
      if (b.FName == "Mutate.txt" && sim.evo.hidepred) {
        if (b.LastMut > 0)  // handicap freshly mutated robots more
          b.nrg = static_cast<vb_single>(static_cast<double>(b.nrg) +
                                         calc_handycap(sim));
        else
          b.nrg = static_cast<vb_single>(static_cast<double>(b.nrg) +
                                         calc_handycap(sim) / 2);
      }
    }
  }
}

// Master.bas:315-330 — paso 9: media de nrg de los Mutate.txt frescos
// (LastMut > 0) ANTES del update. El llamador gatea por usehidepred.
inline double AvrnrgStartStep(const Sim& sim) {
  double avrnrgStart = 0;
  vb_integer i = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    const Bot& b = sim.rob[t];
    if (b.FName == "Mutate.txt" && b.exist) {
      if (b.LastMut > 0) {
        i = static_cast<vb_integer>(i + 1);
        avrnrgStart = avrnrgStart + static_cast<double>(b.nrg);
      }
    }
  }
  if (i > 0) avrnrgStart = avrnrgStart / i;
  return avrnrgStart;
}

// Master.bas:398-414 — paso 22: media DESPUÉS del update y acumulación de
// energydif (solo si hubo muestras). El llamador gatea por usehidepred.
inline void AvrnrgEndStep(Sim& sim, double avrnrgStart) {
  double avrnrgEnd = 0;
  vb_integer i = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    const Bot& b = sim.rob[t];
    if (b.FName == "Mutate.txt" && b.exist) {
      if (b.LastMut > 0) {
        i = static_cast<vb_integer>(i + 1);
        avrnrgEnd = avrnrgEnd + static_cast<double>(b.nrg);
      }
    }
  }
  if (i > 0) {
    avrnrgEnd = avrnrgEnd / i;
    sim.evo.energydif = sim.evo.energydif - avrnrgStart + avrnrgEnd;
  }
}

// Master.bas:347-360 — paso 13: sobrescrituras del Player Bot Mode sobre el
// bot con foco y los resaltados. El ángulo hacia el ratón pisa mem(SetAim)
// (angnorm(angle)*200, Single→Integer con redondeo bancario); cada tecla
// activa pisa mem(memloc) = value. Sitio de error 9: memloc fuera de
// 0..1000 (frmPBMode no valida) — decisión: registrar y no escribir.
inline void PlayerBotStep(Sim& sim) {
  if (!sim.pb.on) return;
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    Bot& b = sim.rob[t];
    if (b.exist) {
      if (t == sim.robfocus || b.highlight) {
        if (!(sim.pb.Mouse_loc.x == 0.0f && sim.pb.Mouse_loc.y == 0.0f))
          b.mem[addr::SetAim] = static_cast<vb_integer>(vb_round64(
              static_cast<double>(angnorm(vb_angle(b.pos.x, b.pos.y,
                                                   sim.pb.Mouse_loc.x,
                                                   sim.pb.Mouse_loc.y)) *
                                  200.0f)));
        for (const PBKey& key : sim.pb.keys) {
          if (key.Active != key.Invert) {
            if (key.memloc >= 0 && key.memloc <= 1000)
              b.mem[key.memloc] = key.value;
            else
              sim.diag.err9_pb_memloc += 1;
          }
        }
      }
    }
  }
}

// Master.bas:483-554 — paso 26: modos restart. Las acciones (FileCopy,
// restarter, MsgBox, logevo) son host: aquí condiciones + estado + eventos.
inline void RestartModesStep(Sim& sim) {
  // R E S T A R T  N E X T — seeding (:485-497): el host copia Test.txt a
  // league\seeded\<totnvegsDisplayed>.txt y reinicia.
  if (sim.x_restartmode == 1) {
    if (sim.opts.TotRunCycle == 2000) sim.events.seed_round_done = true;
  }

  // Z E R O B O T (:501-528).
  if (sim.x_restartmode == 7 || sim.x_restartmode == 8) {
    if (sim.opts.TotRunCycle % 50 == 0 && sim.opts.TotRunCycle > 0)
      (void)Fittest(sim);  // Form1.fittest como sentencia: efectos ZB
    vb_integer Mutate_count = 0;
    for (int t = 1; t <= sim.MaxRobs; ++t) {
      if (sim.rob[t].exist) {
        if (sim.rob[t].FName == "Mutate.txt")
          Mutate_count = static_cast<vb_integer>(Mutate_count + 1);
      }
    }
    if (Mutate_count == 0) {
      // logevo "A restart is needed." + stop + restarter → host.
      sim.events.zb_restart = true;
      sim.events.sim_stop_requested = true;
    }
  }

  // test mode (:530-554). totnrgnvegs es Static: acumula y JAMÁS se
  // resetea dentro del proceso (sim.totnrgnvegs).
  if (sim.x_restartmode == 9) {
    if (sim.opts.TotRunCycle == 1) {  // record starting energy
      for (int t = 1; t <= sim.MaxRobs; ++t) {
        const Bot& b = sim.rob[t];
        if (b.exist) {
          if (b.FName == "Test.txt")
            sim.totnrgnvegs = sim.totnrgnvegs + static_cast<double>(b.nrg) +
                              static_cast<double>(b.body * 10.0f);
        }
      }
    }
    if (sim.opts.TotRunCycle == 8000) {  // ending energy must be more
      double cmptotnrgnvegs = 0;
      for (int t = 1; t <= sim.MaxRobs; ++t) {
        const Bot& b = sim.rob[t];
        if (b.exist) {
          if (b.FName == "Test.txt")
            cmptotnrgnvegs = cmptotnrgnvegs + static_cast<double>(b.nrg) +
                             static_cast<double>(b.body * 10.0f);
        }
      }
      // did population and energy x2? ZBpassedtest para la sim (MsgBox);
      // ZBfailedtest reinicia la evolución — ambos host.
      if (sim.totnvegsDisplayed > 10 &&
          cmptotnrgnvegs > sim.totnrgnvegs * 2) {
        sim.events.zb_passed = true;
      } else {
        sim.events.zb_failed = true;
      }
      sim.events.sim_stop_requested = true;
    }
  }
}

// F1Mode.bas:509-528 — dreason: descalifica una especie entera (F1 o modo
// seeding). La línea de Disqualifications.txt se acumula en events.dq_log
// (el host la escribe). Formateo del tag (:512-513): `Dim blank As
// String * 50` son 50 Chr(0) — un tag jamás asignado (nace en Chr(0)×50,
// bot.hpp) compara igual y se omite; un tag ASIGNADO por la UI queda
// relleno con ESPACIOS a 50 y nunca iguala al blank (incluso vacío: el
// original produce "()" — quirk replicado). Trim quita solo espacios.
inline void dreason(Sim& sim, std::string Name, std::string tag,
                    const std::string& reason) {
  std::string first45 = tag.substr(0, 45);
  first45.resize(45, '\0');  // String * 50: relleno Chr(0)
  if (first45 == std::string(45, '\0')) {
    tag.clear();
  } else {
    // Trim(Left(tag, 45)) — Trim("   ") = "" (el tag asignado vacío
    // produce "()", quirk del fuente).
    std::string t = tag.substr(0, 45);
    const auto b = t.find_first_not_of(' ');
    const auto e = t.find_last_not_of(' ');
    tag = "(" +
          (b == std::string::npos ? std::string() : t.substr(b, e - b + 1)) +
          ")";
  }

  sim.events.dq_log.push_back("Robot \"" + Name + "\"" + tag +
                              " has been disqualified for " + reason + ".");

  // kill species (:523-527).
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (!sim.rob[t].Veg && !sim.rob[t].Corpse && sim.rob[t].exist) {
      if (sim.rob[t].FName == Name) KillRobot(sim, t);
    }
  }
}

// F1Mode.bas:38-48 — ResetContest (las captions de Contest_Form son host).
inline void ResetContest(Sim& sim) {
  sim.f1.Contests = 0;
  for (int t = 1; t <= 5; ++t) {
    sim.f1.PopArray[t].SpName.clear();
    sim.f1.PopArray[t].population = 0;
    sim.f1.PopArray[t].Wins = 0;
  }
}

// F1Mode.bas:50-169 — FindSpecies: censo de especies al arrancar la ronda
// (StartSimul → main.frm:1338, si ContestMode). robcol y las captions de
// Contest_Form son UI. El bucle arranca en el slot 0 ("A little mod here").
inline void FindSpecies(Sim& sim) {
  auto& F = sim.f1;
  F.TotSpecies = 0;
  if (F.Contests == 0) ResetContest(sim);

  for (int t = 1; t <= 20; ++t) {
    F.PopArray[t].SpName.clear();
    F.PopArray[t].population = 0;
  }

  for (int t = 0; t <= sim.MaxRobs; ++t) {
    const Bot& b = sim.rob[t];
    if (!b.Veg && !b.Corpse && b.exist) {
      for (int sp = 1; sp <= 20; ++sp) {
        const std::string realname = RealName(b.FName);
        if (realname == F.PopArray[sp].SpName) {
          F.PopArray[sp].population =
              static_cast<vb_integer>(F.PopArray[sp].population + 1);
          break;
        }
        if (F.PopArray[sp].SpName.empty()) {
          F.TotSpecies = static_cast<vb_integer>(F.TotSpecies + 1);
          F.PopArray[sp].SpName = realname;
          F.PopArray[sp].population =
              static_cast<vb_integer>(F.PopArray[sp].population + 1);
          break;
        }
      }
    }
  }

  if (F.TotSpecies == 1) {
    // MsgBox "You have only selected one species... F1 mode disabled".
    F.ContestMode = false;
    sim.events.f1_single_species = true;
    return;  // GoTo getout
  }
  // reset time limit and stuff (:96-102).
  if (F.TotSpecies > 2 && (F.MaxCycles > 0 || F.MaxPop > 0)) {
    F.optMaxCycles = 0;
    F.MaxPop = 0;
    // MsgBox "...Cycle limit and max population disabled".
    sim.events.f1_limits_disabled = true;
  } else {
    F.optMaxCycles = F.MaxCycles;
  }
}

// F1Mode.bas:170-441 — Countpop: censo periódico del contest (lo llama
// UpdateBots cuando F1count alcanza SampFreq, Robots.bas:1503-1505). Las
// captions y startnovid son host; el Select Case x_restartmode del ganador
// (:380-418, liga/archivos/restarter) se sustituye por el evento
// f1_round_over + f1_winner (el efecto de estado del Case 0 — restaurar
// MinRounds — sí corre aquí). El GoTo won del chequeo Maxrounds (:352-359)
// se modela con declareWinner + return (ambos caminos salen del Sub).
inline void Countpop(Sim& sim) {
  auto& F = sim.f1;
  std::string Winner;

  for (int t = 1; t <= 20; ++t) {
    F.PopArray[t].population = 0;
    F.PopArray[t].exist = 0;
  }
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    const Bot& b = sim.rob[t];
    if (!b.Veg && !b.Corpse && b.exist) {
      for (int sp = 1; sp <= F.TotSpecies; ++sp) {
        if (RealName(b.FName) == F.PopArray[sp].SpName) {
          F.PopArray[sp].population =
              static_cast<vb_integer>(F.PopArray[sp].population + 1);
          F.PopArray[sp].exist = 1;
          break;
        }
      }
    }
  }
  // Captions Contests/Maxrounds (:203-206): host.

  vb_integer SpeciesLeft = 0;
  for (int p = 1; p <= F.TotSpecies; ++p)
    SpeciesLeft = static_cast<vb_integer>(SpeciesLeft + F.PopArray[p].exist);

  if (SpeciesLeft == 1 && F.Contests + 1 <= F.MinRounds && F.Over == false) {
    for (int t = 1; t <= F.TotSpecies; ++t) {
      if (F.PopArray[t].population != 0)
        F.PopArray[t].Wins = static_cast<vb_integer>(F.PopArray[t].Wins + 1);
    }
  }
  // Captions de población (:218-263): host.

  // Population control (:266-312). erase1/erase2 son NEGATIVOS (For 0 To
  // -eraseN); selectrobot es un Dim que NO se resetea entre vueltas: sin
  // candidato bajo 320000 repite el último (o mata el slot 0 fantasma,
  // patrón B-02). El cociente popA/popB es división Double; la asignación
  // a Integer redondea bancario.
  if (F.MaxPop > 0) {
    if (F.PopArray[1].population > F.MaxPop ||
        F.PopArray[2].population > F.MaxPop) {
      vb_integer erase1, erase2;
      if (F.PopArray[1].population > F.PopArray[2].population) {
        erase1 = static_cast<vb_integer>(F.MaxPop -
                                         F.PopArray[1].population);
        erase2 = static_cast<vb_integer>(vb_round64(
            static_cast<double>(erase1) *
            (static_cast<double>(F.PopArray[2].population) /
             static_cast<double>(F.PopArray[1].population))));
      } else {
        erase2 = static_cast<vb_integer>(F.MaxPop -
                                         F.PopArray[2].population);
        erase1 = static_cast<vb_integer>(vb_round64(
            static_cast<double>(erase2) *
            (static_cast<double>(F.PopArray[1].population) /
             static_cast<double>(F.PopArray[2].population))));
      }
      vb_single calcminenergy;
      vb_integer selectrobot = 0;

      for (vb_integer l = 0; l <= -erase1; ++l) {
        calcminenergy = 320000.0f;  // only erase robots with lowest energy
        for (int t = 1; t <= sim.MaxRobs; ++t) {
          if (sim.rob[t].exist) {
            if (RealName(sim.rob[t].FName) == F.PopArray[1].SpName) {
              if (sim.rob[t].nrg + sim.rob[t].body * 10.0f < calcminenergy) {
                calcminenergy = sim.rob[t].nrg + sim.rob[t].body * 10.0f;
                selectrobot = static_cast<vb_integer>(t);
              }
            }
          }
        }
        KillRobot(sim, selectrobot);
      }

      for (vb_integer l = 0; l <= -erase2; ++l) {
        calcminenergy = 320000.0f;
        for (int t = 1; t <= sim.MaxRobs; ++t) {
          if (sim.rob[t].exist) {
            if (RealName(sim.rob[t].FName) == F.PopArray[2].SpName) {
              if (sim.rob[t].nrg + sim.rob[t].body * 10.0f < calcminenergy) {
                calcminenergy = sim.rob[t].nrg + sim.rob[t].body * 10.0f;
                selectrobot = static_cast<vb_integer>(t);
              }
            }
          }
        }
        KillRobot(sim, selectrobot);
      }
    }
  }

  // The max cycles code (:314-349). Comparte ModeChangeCycles con el modo
  // evo (aquí es el reloj de la extensión adaptativa del límite).
  if (F.optMaxCycles > 0) {
    if (sim.opts.TotRunCycle < 500 && !F.setoldpop) {  // reset old pop
      if (F.PopArray[1].population > 0 && F.PopArray[2].population > 0) {
        F.oldpop1 = F.PopArray[1].population;
        F.oldpop2 = F.PopArray[2].population;
        F.setoldpop = true;
      }
    }
    if (sim.evo.ModeChangeCycles > 1000) {
      if (F.PopArray[1].population > F.PopArray[2].population) {
        if ((F.PopArray[1].population - F.oldpop1) <
                (F.PopArray[2].population - F.oldpop2) &&
            F.PopArray[2].population > 10)
          F.optMaxCycles = static_cast<vb_long>(vb_round64(
              static_cast<double>(F.optMaxCycles) +
              1000.0 /
                  (1.0 / (static_cast<double>(F.PopArray[1].population) /
                              static_cast<double>(F.PopArray[2].population) -
                          1.0) +
                   1.0)));
      }
      if (F.PopArray[2].population > F.PopArray[1].population) {
        if ((F.PopArray[2].population - F.oldpop2) <
                (F.PopArray[1].population - F.oldpop1) &&
            F.PopArray[1].population > 10)
          F.optMaxCycles = static_cast<vb_long>(vb_round64(
              static_cast<double>(F.optMaxCycles) +
              1000.0 /
                  (1.0 / (static_cast<double>(F.PopArray[2].population) /
                              static_cast<double>(F.PopArray[1].population) -
                          1.0) +
                   1.0)));
      }
      F.oldpop1 = F.PopArray[1].population;
      F.oldpop2 = F.PopArray[2].population;
      sim.evo.ModeChangeCycles = 0;
    }
    if (sim.opts.TotRunCycle > F.optMaxCycles) {  // kill losing species
      if (F.PopArray[1].population > F.PopArray[2].population) {
        for (int t = 1; t <= sim.MaxRobs; ++t) {
          if (sim.rob[t].exist) {
            if (RealName(sim.rob[t].FName) == F.PopArray[2].SpName)
              KillRobot(sim, t);
          }
        }
      }
      if (F.PopArray[2].population > F.PopArray[1].population) {
        for (int t = 1; t <= sim.MaxRobs; ++t) {
          if (sim.rob[t].exist) {
            if (RealName(sim.rob[t].FName) == F.PopArray[1].SpName)
              KillRobot(sim, t);
          }
        }
      }
    }
  }

  // El ganador (Over = True) para la sim y dispara la capa de liga del
  // host; el Case 0 además restaura MinRounds (:394-396).
  const auto declareWinner = [&sim, &F](const std::string& w) {
    F.Over = true;
    sim.events.sim_stop_requested = true;
    sim.events.f1_round_over = true;
    sim.events.f1_winner = w;
    if (sim.x_restartmode == 0) F.MinRounds = F.optMinRounds;
  };

  // check here for max per contestent (:352-359) — GoTo won.
  if (F.Maxrounds > 0) {
    for (int t = 1; t <= F.TotSpecies; ++t) {
      if (F.PopArray[t].Wins > F.Maxrounds - 1) {
        declareWinner(F.PopArray[t].SpName);
        return;
      }
    }
  }

  F.F1count = 0;
  // Wins es Single: Sqr + división Double, redondeado al asignar (:362).
  const vb_single Wins = static_cast<vb_single>(
      std::sqrt(static_cast<double>(F.MinRounds)) +
      (static_cast<double>(F.MinRounds) / 2));

  // in very rear cases both robots are dead when checking (:364-367).
  if (SpeciesLeft == 0) {
    sim.StartAnotherRound = true;
    // startnovid = loadstartnovid: host (vídeo).
  }

  if (SpeciesLeft == 1 && F.Contests + 1 <= F.MinRounds) {
    if (F.Contests + 1 == F.MinRounds && F.Over == false) {  // over now
      for (int t = 1; t <= F.TotSpecies; ++t) {
        if (static_cast<vb_single>(F.PopArray[t].Wins) > Wins) {
          declareWinner(F.PopArray[t].SpName);
          return;  // won: ... Exit Sub
        } else {
          Winner = "Statistical Draw. Extending contest.";
        }
      }
      // Captions Winner/Winner1 (:424-426): host.
      if (Winner == "Statistical Draw. Extending contest.")
        F.MinRounds = static_cast<vb_integer>(F.MinRounds + 1);
    }
    if (F.Contests + 1 <= F.MinRounds && F.Over == false) {
      F.Contests = static_cast<vb_integer>(F.Contests + 1);
      sim.StartAnotherRound = true;
      // startnovid: host.
      sim.opts.TotRunCycle = 0;
      F.setoldpop = false;
    } else {
      sim.StartAnotherRound = false;
    }
  }
}

}  // namespace db
