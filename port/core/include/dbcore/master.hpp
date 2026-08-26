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
#include "vegs.hpp"

namespace db {

inline void VegsRepopulate(Sim& sim);  // definida tras RobScriptLoadSim

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

  // Paso 5 (contabilidad de energía, Master.bas:236-238): el display toma
  // la celda del ciclo ANTERIOR (el índice aún no rotó) y después rota y
  // pone a cero la celda nueva. feedvegs decide día/noche con este display.
  sim.TotalSimEnergyDisplayed = sim.TotalSimEnergy[sim.CurrentEnergyCycle];
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

  // Paso 18: obstáculos/teleporters (Master.bas:382-383) — bloques 2/3 de M8.

  // Paso 19 (Master.bas:384-390): suma de cloroplastos. AllChlr es Long y
  // la suma Long + Single se redondea bancario EN CADA iteración (la
  // asignación a Long ocurre por vuelta del For).
  sim.AllChlr = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t)
    if (sim.rob[t].exist)
      sim.AllChlr = static_cast<vb_long>(vb_round64(
          static_cast<double>(sim.AllChlr) +
          static_cast<double>(sim.rob[t].chloroplasts)));
  sim.TotalChlr =
      static_cast<vb_long>(vb_round64(sim.AllChlr / 16000.0));

  // Paso 20 (Master.bas:392-394): repoblación, gateada por cloroplastos
  // (no por vegetales) y por el primer ciclo tras cargar (totvegsDisplayed
  // = -1 evita el pico).
  if (sim.TotalChlr < sim.opts.MinVegs) {
    if (sim.totvegsDisplayed != -1) VegsRepopulate(sim);
  }

  // Paso 21 (Master.bas:396): el sol.
  feedvegs(sim, sim.opts.MaxEnergy);

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

// Globals.bas:395-505 — aggiungirob: añade un robot cargando el script de
// la especie r; con r = -1 (repoblación) re-sortea especie vegetal y
// posición, DESCARTANDO las coordenadas del llamador ([PROBABLE BUG] B7-1:
// los dos Random de VegsRepopulate son puro consumo de RNG). Después PISA
// lo que el cargador sembró: Erase mem, body = 1000, nrg = Stnrg, aim
// aleatorio, generation 0… El timer epigenético queda en 0 (a diferencia de
// los fundadores de loadrobs). Consumo con r = -1 y una sola tirada de
// especie: 1 especie [+1 por re-tirada] + 2 posición (fRnd) + 6 preparerob
// + 1 aim = 10 (12 con los 2 descartados del llamador; R-08).
inline void aggiungirob(Sim& sim, vb_integer r, vb_single x, vb_single y) {
  if (r == -1) {
    // Primera pasada: ¿hay alguna especie vegetal elegible?
    bool anyvegy = false;
    for (std::size_t i = 0; i < sim.Specie.size(); ++i) {
      if (checkvegstatus(sim, static_cast<int>(i))) {
        anyvegy = true;
        break;
      }
    }
    if (!anyvegy) return;

    do {
      r = static_cast<vb_integer>(Random(
          0, static_cast<double>(sim.Specie.size()) - 1.0, *sim.rndy));
    } while (!checkvegstatus(sim, r));

    // fRnd toma Long ByVal: los productos Single se redondean bancario en
    // la llamada. La posición real la decide el área de la especie (la fuga
    // up+1 de fRnd puede salirse 1 twip, S-02).
    const Specie& sp = sim.Specie[static_cast<std::size_t>(r)];
    x = static_cast<vb_single>(
        fRnd(vb_clng(static_cast<double>(
                 sp.Poslf * (sim.opts.FieldWidth - 60.0f))),
             vb_clng(static_cast<double>(
                 sp.Posrg * (sim.opts.FieldWidth - 60.0f))),
             *sim.rndy));
    y = static_cast<vb_single>(
        fRnd(vb_clng(static_cast<double>(
                 sp.Postp * (sim.opts.FieldHeight - 60.0f))),
             vb_clng(static_cast<double>(
                 sp.Posdn * (sim.opts.FieldHeight - 60.0f))),
             *sim.rndy));
  }

  Specie& sp = sim.Specie[static_cast<std::size_t>(r)];
  if (sp.Name.empty() || sp.path == "Invalid Path") return;

  const int a = RobScriptLoadSim(sim, sp.dnatext, sp.Name);
  if (a < 0) {
    sp.Native = false;  // Globals.bas:421-424
    return;
  }
  // El chequeo `Not rob(a).exist` -> path = "Invalid Path" del original
  // (:428-433) es inalcanzable aquí: RobScriptLoadSim devuelve -1 en ese
  // caso. Se documenta y no se replica.

  Bot& b = sim.rob[a];
  b.Veg = sp.Veg;
  if (b.Veg) b.chloroplasts = static_cast<vb_single>(sim.StartChlr);
  b.Fixed = sp.Fixed;
  b.CantSee = sp.CantSee;
  b.DisableDNA = sp.DisableDNA;
  b.DisableMovementSysvars = sp.DisableMovementSysvars;
  b.CantReproduce = sp.CantReproduce;
  b.VirusImmune = sp.VirusImmune;
  b.Corpse = false;
  b.Dead = false;
  b.body = 1000.0f;
  b.radius = FindRadius(sim, a);
  b.Mutations = 0;
  b.OldMutations = 0;
  b.LastMut = 0;
  b.generation = 0;
  b.SonNumber = 0;
  b.parent = 0;
  b.mem.fill(0);  // Erase rob(a).mem (borra mem(336)/mem(339) incluidos)
  if (b.Fixed) b.mem[216] = 1;
  b.pos.x = x;
  b.pos.y = y;

  b.aim = sim.rnd() * static_cast<vb_single>(PI) * 2.0f;  // pisa preparerob
  b.mem[addr::SetAim] = vb_cint(static_cast<double>(b.aim * 200.0f));

  UpdateBotBucket(sim, a);
  b.nrg = static_cast<vb_single>(sp.Stnrg);
  b.Mutables = sp.Mutables;

  b.Vtimer = 0;
  b.virusshot = 0;
  b.genenum = CountGenes(b.dna);

  b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));
  b.GenMut = static_cast<vb_single>(static_cast<double>(b.DnaLen) /
                                    GeneticSensitivity);

  b.mem[addr::DnaLenSys] = b.DnaLen;
  b.mem[addr::GenesSys] = static_cast<vb_integer>(b.genenum);

  b.multibot_time = sp.kill_mb ? 210 : 0;
  b.dq = sp.dq_kill ? 1 : 0;
  b.NoChlr = sp.NoChlr;

  for (int i = 0; i <= 7; ++i) b.Skin[i] = sp.Skin[i];
  b.color = sp.color;
  makeoccurrlist(sim, a);
}

// Vegs.bas:23-38 — VegsRepopulate (paso 20): acumulador con deuda. Las dos
// coordenadas del llamador se sortean y se descartan (B7-1); totvegs cuenta
// el intento aunque aggiungirob falle en silencio.
inline void VegsRepopulate(Sim& sim) {
  sim.cooldown += 1;
  if (sim.cooldown >= sim.opts.RepopCooldown) {
    for (vb_integer t = 1; t <= sim.opts.RepopAmount; ++t) {
      // VB6 evalúa los argumentos de izquierda a derecha: x antes que y.
      const vb_single Rx = static_cast<vb_single>(Random(
          60, static_cast<double>(sim.opts.FieldWidth) - 60.0, *sim.rndy));
      const vb_single Ry = static_cast<vb_single>(Random(
          60, static_cast<double>(sim.opts.FieldHeight) - 60.0, *sim.rndy));
      aggiungirob(sim, -1, Rx, Ry);
      sim.totvegs += 1;
    }
    sim.cooldown -= sim.opts.RepopCooldown;
  }
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
