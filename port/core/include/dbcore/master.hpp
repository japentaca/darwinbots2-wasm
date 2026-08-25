// dbcore/master.hpp — el tick (Master.bas:23 UpdateSim) reducido al núcleo
// ecológico de 10-CICLO.md §2: pasos 2, 10 (ExecRobs), 12 (EraseSenses),
// 14 (updateshots), 15 (opos), 16 (UpdateBots), 17 (actvel) y la contabilidad
// de cloroplastos del paso 19. Los pasos ⚙ (UI/torneo/evo/autosave) y los de
// mundo (repoblación, feedvegs, teleporters, obstáculos — B7) quedan fuera o
// como stub registrado. También: la carga de bots a la simulación
// (RobScriptLoad, Module1.bas:8-26; preparerob :29-55) y la siembra de
// fundadores de loadrobs (main.frm:1516-1570) que M-08 ejercita.
#pragma once

#include "loader.hpp"
#include "robots.hpp"
#include "sim.hpp"

namespace db {

// DNA.bas:1245-1262 — ExecRobs (paso 10): ADN de todos los bots en orden de
// índice. Gate: exist, no corpse, no DisableDNA (hidepred: capa torneo ⚙).
inline void ExecRobs(Sim& sim) {
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist && !sim.rob[t].Corpse && !sim.rob[t].DisableDNA)
      ExecuteDNA(sim.vm, sim.rob[t]);
  }
}

// Master.bas:23-554 — UpdateSim, núcleo. La numeración de pasos es la de
// 10-CICLO.md §2.
// Master.bas:429-465 — "Kill some robots to prevent out of memory": con
// totlen > 4e6 mata maxdel+1 veces al vivo más pobre en nrg + body*10 bajo
// 320000. selectrobot es un local que ARRANCA EN 0 y no se resetea entre
// iteraciones: sin candidato bajo el umbral, KillRobot(0) "mata" el slot 0
// fantasma y ningún vivo muere ([PROBABLE BUG] A1-3, B-02). Con
// totlen > 3e6 borra LastMutDetail de TODOS los slots (exist o no).
inline void MemoryPressureKill(Sim& sim) {
  vb_long totlen = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t)
    if (sim.rob[t].exist) totlen += sim.rob[t].DnaLen;

  if (totlen > 4000000) {
    vb_integer selectrobot = 0;  // Dim local: 0 hasta la primera asignación
    const vb_long maxdel = static_cast<vb_long>(vb_round64(
        1500.0 * (static_cast<double>(sim.TotalRobotsDisplayed) * 425.0 /
                  static_cast<double>(totlen))));

    for (vb_long i = 0; i <= maxdel; ++i) {
      vb_single calcminenergy = 320000.0f;
      for (int t = 1; t <= sim.MaxRobs; ++t) {
        if (sim.rob[t].exist) {
          if (sim.rob[t].nrg + sim.rob[t].body * 10.0f < calcminenergy) {
            calcminenergy = sim.rob[t].nrg + sim.rob[t].body * 10.0f;
            selectrobot = static_cast<vb_integer>(t);
          }
        }
      }
      KillRobot(sim, selectrobot);
    }
  }
  if (totlen > 3000000) {
    for (int t = 1; t <= sim.MaxRobs; ++t) sim.rob[t].LastMutDetail.clear();
  }
}

inline void UpdateSim(Sim& sim) {
  // Rejilla de buckets al día (Init_Buckets corre al (re)crear el mundo en
  // el original, main.frm:1302; decisión de port en buckets.hpp).
  EnsureBuckets(sim);

  // Paso 2: contadores de ciclo.
  sim.opts.TotRunCycle += 1;

  // Paso 5 (contabilidad de energía): rotación de la celda del ciclo.
  sim.CurrentEnergyCycle = sim.opts.TotRunCycle % 100;
  sim.TotalSimEnergy[sim.CurrentEnergyCycle] = 0;

  // Pasos 3, 6-9: torneo/costes dinámicos — ⚙.

  // Paso 4 (Master.bas:203-233): oscilación de MutCurrMult, senoidal
  // (20^Sin) o escalón (16 / 1/16). Off por default (MutOscill = False).
  if (sim.opts.MutOscill) {
    if (sim.opts.MutCycMax + sim.opts.MutCycMin > 0) {
      const vb_long fullrange =
          sim.opts.TotRunCycle % (sim.opts.MutCycMax + sim.opts.MutCycMin);
      if (sim.opts.MutOscillSine) {
        // fullrange / MutCycMax es división Double en VB6; PI es el Single
        // de Common.bas promovido.
        if (fullrange < sim.opts.MutCycMax)
          sim.opts.MutCurrMult = static_cast<vb_single>(std::pow(
              20.0, std::sin(static_cast<double>(fullrange) /
                             static_cast<double>(sim.opts.MutCycMax) *
                             static_cast<double>(PI))));
        else
          sim.opts.MutCurrMult = static_cast<vb_single>(std::pow(
              20.0, -std::sin(static_cast<double>(fullrange -
                                                  sim.opts.MutCycMax) /
                              static_cast<double>(sim.opts.MutCycMin) *
                              static_cast<double>(PI))));
      } else {
        sim.opts.MutCurrMult =
            (fullrange < sim.opts.MutCycMax) ? 16.0f : 1.0f / 16.0f;
      }
    }
  }

  // Paso 10: el ADN.
  ExecRobs(sim);

  // Paso 12: borrado de sentidos (salta DisableDNA: los corpses conservan
  // sus últimos sentidos congelados, M-12).
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist && !sim.rob[t].DisableDNA) EraseSenses(sim, t);
  }

  // Paso 13: Player Bot Mode — ⚙.

  // Paso 14: shots.
  updateshots(sim);

  // Paso 15: opos = pos.
  for (int t = 1; t <= sim.MaxRobs; ++t)
    if (sim.rob[t].exist) sim.rob[t].opos = sim.rob[t].pos;

  // Paso 16: UpdateBots (7 pasadas).
  UpdateBots(sim);

  // Paso 17: actvel (protege a los recién nacidos con opos = (0,0)).
  for (int t = 1; t <= sim.MaxRobs; ++t) {
    if (sim.rob[t].exist) {
      if (!(sim.rob[t].opos.x == 0.0f && sim.rob[t].opos.y == 0.0f))
        sim.rob[t].actvel = VectorSub(sim.rob[t].pos, sim.rob[t].opos);
    }
  }

  // Paso 18: obstáculos/teleporters — B7.

  // Paso 19: suma de cloroplastos (división real -> Long: bancario).
  sim.AllChlr = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t)
    if (sim.rob[t].exist)
      sim.AllChlr += static_cast<vb_long>(
          vb_round64(static_cast<double>(sim.rob[t].chloroplasts)));
  sim.TotalChlr =
      static_cast<vb_long>(vb_round64(sim.AllChlr / 16000.0));

  // Pasos 20-21: VegsRepopulate/feedvegs — B7 (consumen RNG y E/S).
  if (sim.TotalChlr < sim.opts.MinVegs && sim.totvegsDisplayed != -1)
    sim.diag.world_stub += 1;

  // Pasos 22-25: torneo/UI/autosave — ⚙, fuera del core.

  // Master.bas:429-465 — matanza por presión de memoria (paso 26).
  MemoryPressureKill(sim);
}

// Module1.bas:29-55 — preparerob: 6 extracciones de RNG (pos x/y, aim,
// color x3) y nrg = 20000. El ancho/alto de pantalla del original
// (Form1.ScaleWidth) se sustituye por el campo: el VALOR es irrelevante (la
// posición la pisa loadrobs), el CONSUMO de RNG no.
inline void preparerob(Sim& sim, int t, const std::string& fname) {
  Bot& b = sim.rob[t];
  b.pos.x = static_cast<vb_single>(
      Random(50, static_cast<double>(sim.opts.FieldWidth), *sim.rndy));
  b.pos.y = static_cast<vb_single>(
      Random(50, static_cast<double>(sim.opts.FieldHeight), *sim.rndy));
  b.aim = static_cast<vb_single>(Random(0, 628, *sim.rndy)) / 100.0f;
  b.aimvector = VectorSet(
      static_cast<vb_single>(std::cos(static_cast<double>(b.aim))),
      static_cast<vb_single>(std::sin(static_cast<double>(b.aim))));
  b.exist = true;
  b.BucketPos.x = -2;  // Module1.bas:37-39
  b.BucketPos.y = -2;
  UpdateBotBucket(sim, t);
  Random(50, 255, *sim.rndy);  // col1
  Random(50, 255, *sim.rndy);  // col2
  Random(50, 255, *sim.rndy);  // col3
  b.vnum = 1;
  b.nrg = 20000.0f;
  b.Veg = false;
  b.FName = fname;
}

// Module1.bas:8-26 — RobScriptLoad sobre texto en memoria: posto + preparerob
// + LoadDNA + makeoccurrlist + publicaciones (M-10). Devuelve -1 si el ADN se
// rechaza ("no valid robot").
inline int RobScriptLoadSim(Sim& sim, const std::string& text,
                            const std::string& fname) {
  const int n = posto(sim);
  preparerob(sim, n, fname);
  if (LoadDNAText(text, sim.rob[n], *sim.sysvars)) {
    // insertsysvars/ScanUsedVars: contadores de display, sin efecto en mem.
    makeoccurrlist(sim, n);
    sim.rob[n].DnaLen = static_cast<vb_integer>(DnaLen(sim.rob[n].dna));
    sim.rob[n].genenum = CountGenes(sim.rob[n].dna);
    sim.rob[n].mem[addr::DnaLenSys] = sim.rob[n].DnaLen;
    sim.rob[n].mem[addr::GenesSys] =
        static_cast<vb_integer>(sim.rob[n].genenum);
    return n;
  }
  sim.rob[n].exist = false;
  UpdateBotBucket(sim, n);  // Module1.bas:23
  return -1;
}

// Configuración de especie para la siembra de fundadores (subconjunto de
// SimOpts.Specie que loadrobs usa).
struct SpecieCfg {
  bool Veg = false;
  bool Fixed = false;
  vb_single Stnrg = 3000;
  vb_single Poslf = 0, Posrg = 1, Postp = 0, Posdn = 1;
  bool CantSee = false, DisableDNA = false, DisableMovementSysvars = false;
  bool CantReproduce = false, VirusImmune = false;
};

// main.frm:1516-1570 — la siembra por fundador de loadrobs. Consumo de RNG
// por fundador: 6 (preparerob) + 2 (posición) + 1 (timer) = 9 (M-08).
inline int InsertFounder(Sim& sim, const std::string& text,
                         const std::string& fname, const SpecieCfg& cfg = {}) {
  const int a = RobScriptLoadSim(sim, text, fname);
  if (a < 0) return a;
  Bot& b = sim.rob[a];
  b.Veg = cfg.Veg;
  b.Fixed = cfg.Fixed;
  if (b.Fixed) b.mem[216] = 1;
  b.pos.x = static_cast<vb_single>(
      Random(cfg.Poslf * (sim.opts.FieldWidth - 60.0f),
             cfg.Posrg * (sim.opts.FieldWidth - 60.0f), *sim.rndy));
  b.pos.y = static_cast<vb_single>(
      Random(cfg.Postp * (sim.opts.FieldHeight - 60.0f),
             cfg.Posdn * (sim.opts.FieldHeight - 60.0f), *sim.rndy));
  b.nrg = cfg.Stnrg;
  b.body = 1000.0f;
  b.radius = FindRadius(sim, a);
  b.mem[addr::SetAim] = vb_cint(static_cast<double>(b.aim) * 200.0);
  b.Dead = false;
  b.mem[addr::timersys] =
      static_cast<vb_integer>(Random(-32000, 32000, *sim.rndy));  // M-08(b)
  b.CantSee = cfg.CantSee;
  b.DisableDNA = cfg.DisableDNA;
  b.DisableMovementSysvars = cfg.DisableMovementSysvars;
  b.CantReproduce = cfg.CantReproduce;
  b.VirusImmune = cfg.VirusImmune;
  b.virusshot = 0;
  b.Vtimer = 0;
  b.genenum = CountGenes(b.dna);
  b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));
  b.mem[addr::DnaLenSys] = b.DnaLen;
  b.mem[addr::GenesSys] = static_cast<vb_integer>(b.genenum);
  return a;
}

}  // namespace db
