// dbcore/senses.hpp — Senses.bas: touch/taste, EraseSenses, lookoccurr y su
// borrado, WriteSenses (con el barrido real de BucketsProximity, vision.hpp)
// y makeoccurrlist. Contratos: 21-MEMORIA.md §3 (régimen A: latencia 1
// ciclo), 32-VISION.md; casos M-01, M-06, M-12, F-08..F-11, F-15.
#pragma once

#include "sim.hpp"
#include "vision.hpp"

namespace db {

// Senses.bas:12-17 — LandMark: mem(400) = 1 si aim apunta "arriba".
inline void LandMark(Sim& sim, int i) {
  sim.rob[i].mem[addr::LandM] = 0;
  if (sim.rob[i].aim > 1.39f && sim.rob[i].aim < 1.75f)
    sim.rob[i].mem[addr::LandM] = 1;
}

namespace senses_detail {
// El núcleo angular compartido de touch/taste (Senses.bas:21-55): ángulo del
// impacto relativo a 6.28 - aim, normalizado a [0, 6.28] con las constantes
// truncadas del fuente (6.28/3.14/1.57, no PI).
inline vb_single impact_dang(const Bot& b, vb_single X, vb_single Y) {
  const vb_single aim = 6.28f - b.aim;
  const vb_single dx = X - b.pos.x;
  const vb_single dy = Y - b.pos.y;
  vb_single ang;
  if (dx != 0.0f) {
    const vb_single tn = dy / dx;
    ang = static_cast<vb_single>(std::atan(static_cast<double>(tn)));
    if (dx < 0.0f) ang = ang - 3.14f;
  } else {
    ang = 1.57f * static_cast<vb_single>(vb_sgn(dy));
  }
  vb_single dang = ang - aim;
  while (dang < 0.0f) dang = dang + 6.28f;
  while (dang > 6.28f) dang = dang - 6.28f;
  return dang;
}
}  // namespace senses_detail

// Senses.bas:21-56 — touch (colisión bot-bot; escrito desde Repel3 en P1).
inline void touch(Sim& sim, int a, vb_single X, vb_single Y) {
  Bot& b = sim.rob[a];
  const vb_single dang = senses_detail::impact_dang(b, X, Y);
  if (dang > 5.49f || dang < 0.78f) b.mem[addr::hitup] = 1;
  if (dang > 2.36f && dang < 3.92f) b.mem[addr::hitdn] = 1;
  if (dang > 0.78f && dang < 2.36f) b.mem[addr::hitdx] = 1;
  if (dang > 3.92f && dang < 5.49f) b.mem[addr::hitsx] = 1;
  b.mem[addr::hit] = 1;
}

// Senses.bas:61-96 — taste (sabor de shot; escrito desde updateshots, paso 14).
inline void taste(Sim& sim, int a, vb_single X, vb_single Y, vb_integer value) {
  Bot& b = sim.rob[a];
  const vb_single dang = senses_detail::impact_dang(b, X, Y);
  if (dang > 5.49f || dang < 0.78f) b.mem[addr::shup] = value;
  if (dang > 2.36f && dang < 3.92f) b.mem[addr::shdn] = value;
  if (dang > 0.78f && dang < 2.36f) b.mem[addr::shdx] = value;
  if (dang > 3.92f && dang < 5.49f) b.mem[addr::shsx] = value;
  b.mem[209] = vb_cint(dang * 200.0f);  // .shang
  b.mem[addr::shflav] = value;
}

// Senses.bas:350-393 — EraseLookOccurr. Salta a los corpses (M-12).
inline void EraseLookOccurr(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  if (b.Corpse) return;
  b.mem[addr::REFTYPE] = 0;
  for (int t = 1; t <= 10; ++t) b.mem[addr::occurrstart + t] = 0;
  for (int t = 0; t < 10; ++t) b.mem[addr::in1 + t] = 0;
  b.mem[711] = 0;  // refaim
  b.mem[712] = 0;  // reftie
  b.mem[addr::refshell] = 0;
  b.mem[addr::refbody] = 0;
  b.mem[addr::refypos] = 0;
  b.mem[addr::refxpos] = 0;
  b.mem[addr::refvelup] = 0;
  b.mem[addr::refveldn] = 0;
  b.mem[addr::refveldx] = 0;
  b.mem[addr::refvelsx] = 0;
  b.mem[addr::refvelscalar] = 0;
  b.mem[713] = 0;  // refpoison
  b.mem[714] = 0;  // refvenom
  b.mem[715] = 0;  // refkills
  b.mem[addr::refmulti] = 0;
  b.mem[473] = 0;
  b.mem[477] = 0;
}

// Senses.bas:98-125 — EraseSenses (tick paso 12; el llamador salta DisableDNA).
inline void EraseSenses(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  b.lasttch = 0;
  b.mem[addr::hitup] = 0;
  b.mem[addr::hitdn] = 0;
  b.mem[addr::hitdx] = 0;
  b.mem[addr::hitsx] = 0;
  b.mem[addr::hit] = 0;
  b.mem[addr::shflav] = 0;
  b.mem[209] = 0;  // .shang
  b.mem[addr::shup] = 0;
  b.mem[addr::shdn] = 0;
  b.mem[addr::shdx] = 0;
  b.mem[addr::shsx] = 0;
  b.mem[214] = 0;  // edge
  EraseLookOccurr(sim, n);
}

// Senses.bas:222-349 — lookoccurr: copia la firma del visto (o) en los
// refvars del vidente (n). Sin fudge (FudgeEyes/FudgeAll = modos evo ⚙, con
// RNG; quedan para el milestone de mutaciones/evo).
// [PROBABLE BUG] A3-1 (M-06): refvelsx se niega a sí misma => siempre 0.
inline void lookoccurr(Sim& sim, int n, int o) {
  if (sim.rob[n].Corpse) return;
  Bot& vn = sim.rob[n];
  Bot& vo = sim.rob[o];

  vn.mem[addr::REFTYPE] = 0;
  for (int t = 1; t <= 8; ++t)
    vn.mem[addr::occurrstart + t] = vo.occurr[t];

  if (vo.nrg < 0.0f)
    vn.mem[addr::occurrstart + 9] = 0;
  else if (vo.nrg < 32001.0f)
    vn.mem[addr::occurrstart + 9] = vb_cint(vo.nrg);
  else
    vn.mem[addr::occurrstart + 9] = 32000;
  if (vo.age < 32001)
    vn.mem[addr::occurrstart + 10] = static_cast<vb_integer>(vo.age);
  else
    vn.mem[addr::occurrstart + 10] = 32000;

  for (int t = 0; t < 10; ++t) vn.mem[addr::in1 + t] = vo.mem[addr::out1 + t];

  vn.mem[711] = vo.mem[18];      // refaim
  vn.mem[712] = vo.occurr[9];    // reftie
  vn.mem[addr::refshell] = vb_cint(vo.shell);
  vn.mem[addr::refbody] = vb_cint(vo.body);
  vn.mem[addr::refypos] = vo.mem[217];
  vn.mem[addr::refxpos] = vo.mem[219];

  // Velocidades relativas en el marco del vidente (Senses.bas:311-319).
  vb_single X = (vo.vel.x * static_cast<vb_single>(std::cos(static_cast<double>(vn.aim))) +
                 vo.vel.y * static_cast<vb_single>(std::sin(static_cast<double>(vn.aim))) * -1.0f) -
                vn.mem[addr::velup];
  vb_single Y = (vo.vel.y * static_cast<vb_single>(std::cos(static_cast<double>(vn.aim))) +
                 vo.vel.x * static_cast<vb_single>(std::sin(static_cast<double>(vn.aim)))) -
                vn.mem[addr::veldx];
  if (X > 32000.0f) X = 32000.0f;
  if (X < -32000.0f) X = -32000.0f;
  if (Y > 32000.0f) Y = 32000.0f;
  if (Y < -32000.0f) Y = -32000.0f;

  vn.mem[addr::refvelup] = vb_cint(X);
  vn.mem[addr::refveldn] = static_cast<vb_integer>(-vn.mem[addr::refvelup]);
  vn.mem[addr::refveldx] = vb_cint(Y);
  vn.mem[addr::refvelsx] =
      static_cast<vb_integer>(-vn.mem[addr::refvelsx]);  // [PROBABLE BUG] A3-1:
                                                         // se niega a sí misma
                                                         // (Senses.bas:319)
  vb_single temp = static_cast<vb_single>(std::sqrt(
      std::pow(static_cast<double>(vn.mem[addr::refvelup]), 2.0) +
      std::pow(static_cast<double>(vn.mem[addr::refveldx]), 2.0)));
  if (temp > 32000.0f) temp = 32000.0f;
  vn.mem[addr::refvelscalar] = vb_cint(temp);

  vn.mem[713] = vo.mem[827];  // refpoison
  vn.mem[714] = vo.mem[825];  // refvenom
  vn.mem[715] = static_cast<vb_integer>(vo.Kills);  // refkills — SIN clamp
                                                    // ([PROBABLE BUG] A3-5;
                                                    // sitio de error 6 con
                                                    // >32767 kills, Q15)
  vn.mem[addr::refmulti] = vo.Multibot ? 1 : 0;
  if (vn.mem[474] > 0 && vn.mem[474] <= 1000) {  // memloc/readmem
    vn.mem[473] = vo.mem[vn.mem[474]];
    if (vn.mem[474] > addr::EyeStart && vn.mem[474] < addr::EyeEnd)
      vo.View = true;
  }
  vn.mem[477] = vo.Fixed ? 1 : 0;  // reffixed
}

// Senses.bas:395-458 — lookoccurrShape: refvars cuando el ojo con foco ve
// una forma (lastopptype = 1). Casi todo se pone a 0 (las formas no tienen
// firma); la posición sale de lastopppos — capturado SOLO por el ojo frontal
// (B-13) — y las velocidades relativas de Obstacles(o).vel.
// [PROBABLE BUG] A3-1 otra vez: refvelsx se niega a sí misma.
inline void lookoccurrShape(Sim& sim, int n, int o) {
  if (sim.rob[n].Corpse) return;
  Bot& vn = sim.rob[n];
  const Obstacle& ob = sim.Obstacles[o];

  vn.mem[addr::REFTYPE] = 1;

  for (int t = 1; t <= 8; ++t) vn.mem[addr::occurrstart + t] = 0;
  vn.mem[addr::occurrstart + 9] = 0;   // refnrg
  vn.mem[addr::occurrstart + 10] = 0;  // refage

  for (int t = 0; t < 10; ++t) vn.mem[addr::in1 + t] = 0;

  vn.mem[711] = 0;  // refaim
  vn.mem[712] = 0;  // reftie
  vn.mem[addr::refshell] = 0;
  vn.mem[addr::refbody] = 0;

  // CInt((lastopppos / Divisor) Mod 32000): el Mod de VB6 redondea el
  // operando Single a Long (bancario) antes de la división entera.
  vn.mem[addr::refxpos] = static_cast<vb_integer>(
      vb_round64(static_cast<double>(vn.lastopppos.x) /
                 static_cast<double>(sim.opts.xDivisor)) %
      32000);
  vn.mem[addr::refypos] = static_cast<vb_integer>(
      vb_round64(static_cast<double>(vn.lastopppos.y) /
                 static_cast<double>(sim.opts.yDivisor)) %
      32000);

  // Velocidades relativas en el marco del vidente (sin clamp previo, a
  // diferencia de lookoccurr: las velocidades de forma son pequeñas).
  vn.mem[addr::refvelup] = vb_cint(
      static_cast<double>(
          ob.vel.x * static_cast<vb_single>(std::cos(static_cast<double>(vn.aim))) +
          ob.vel.y * static_cast<vb_single>(std::sin(static_cast<double>(vn.aim))) *
              -1.0f) -
      static_cast<double>(vn.mem[addr::velup]));
  vn.mem[addr::refveldn] = static_cast<vb_integer>(-vn.mem[addr::refvelup]);
  vn.mem[addr::refveldx] = vb_cint(
      static_cast<double>(
          ob.vel.y * static_cast<vb_single>(std::cos(static_cast<double>(vn.aim))) +
          ob.vel.x * static_cast<vb_single>(std::sin(static_cast<double>(vn.aim)))) -
      static_cast<double>(vn.mem[addr::veldx]));
  vn.mem[addr::refvelsx] =
      static_cast<vb_integer>(-vn.mem[addr::refvelsx]);  // [PROBABLE BUG] A3-1

  vb_single temp = static_cast<vb_single>(std::sqrt(
      static_cast<double>(
          static_cast<vb_long>(std::pow(
              static_cast<double>(vn.mem[addr::refvelup]), 2.0))) +
      static_cast<double>(static_cast<vb_long>(std::pow(
          static_cast<double>(vn.mem[addr::refveldx]), 2.0)))));
  if (temp > 32000.0f) temp = 32000.0f;
  vn.mem[addr::refvelscalar] = vb_cint(temp);

  vn.mem[713] = 0;  // refpoison
  vn.mem[714] = 0;  // refvenom
  vn.mem[715] = 0;  // refkills
  vn.mem[addr::refmulti] = 0;
  vn.mem[473] = 0;  // readmem

  vn.mem[477] = (ob.vel.x == 0.0f && ob.vel.y == 0.0f) ? 1 : 0;  // reffixed
}

// Senses.bas:462-517 — makeoccurrlist: la firma occurr(1..12) desde el ADN,
// y las publicaciones 721-731 (myup..myvenom).
inline void makeoccurrlist(Sim& sim, int n) {
  Bot& b = sim.rob[n];
  for (int t = 1; t <= 12; ++t) b.occurr[t] = 0;
  const vb_long ub = static_cast<vb_long>(b.dna.size()) - 1;
  vb_long t = 1;
  while (t < ub && t <= 32000 && !is_end(b.dna[t])) {
    if (b.dna[t].tipo == 0) {
      if (t + 1 <= ub && b.dna[t + 1].tipo == 7) {
        if (b.dna[t].value < 8 && b.dna[t].value > 0)
          b.occurr[b.dna[t].value] += 1;
        if (b.dna[t].value == 826) b.occurr[10] += 1;  // .strpoison
        if (b.dna[t].value == 824) b.occurr[11] += 1;  // .strvenom
      }
      if (b.dna[t].value == 330) b.occurr[9] += 1;  // .tie
    }
    if (b.dna[t].tipo == 1) {
      if (b.dna[t].value > 500 && b.dna[t].value < 510)
        b.occurr[8] += 1;  // ojos
    }
    t += 1;
  }
  for (int i = 1; i <= 8; ++i) b.mem[720 + i] = b.occurr[i];
  b.mem[728] = b.occurr[8];
  b.mem[729] = b.occurr[9];
  b.mem[730] = b.occurr[10];
  b.mem[731] = b.occurr[11];
}

// Senses.bas:169-218 — WriteSenses (P5): totales, visión, pain/pleas,
// publicaciones de nrg/fixed/posición.
inline void WriteSenses(Sim& sim, int n) {
  LandMark(sim, n);
  Bot& b = sim.rob[n];

  b.mem[addr::TotalBots] = static_cast<vb_integer>(sim.TotalRobots);
  {
    const std::size_t sp = SpeciesFromBot(sim, n);
    b.mem[addr::TOTALMYSPECIES] =
        (sp < sim.Specie.size())
            ? static_cast<vb_integer>(sim.Specie[sp].population)
            : 0;
  }

  if (!b.CantSee && !b.Corpse) {
    if (BucketsProximity(sim, n) > 0) {
      if (b.lastopptype == 0) lookoccurr(sim, n, static_cast<int>(b.lastopp));
      if (b.lastopptype == 1)
        lookoccurrShape(sim, n, static_cast<int>(b.lastopp));
    }
  }

  if (b.nrg > 32000.0f) b.nrg = 32000.0f;
  if (b.onrg < 0.0f) b.onrg = 0.0f;
  if (b.obody < 0.0f) b.obody = 0.0f;
  if (b.nrg < 0.0f) b.nrg = 0.0f;

  b.mem[addr::pain] = vb_cint(static_cast<double>(b.onrg) - b.nrg);
  b.mem[addr::pleas] = vb_cint(static_cast<double>(b.nrg) - b.onrg);
  b.mem[addr::bodloss] = vb_cint(static_cast<double>(b.obody) - b.body);
  b.mem[addr::bodgain] = vb_cint(static_cast<double>(b.body) - b.obody);

  b.onrg = b.nrg;
  b.obody = b.body;
  b.mem[addr::Energy] = vb_cint(b.nrg);
  if (b.age == 0 && b.mem[addr::body] == 0) b.mem[addr::body] = vb_cint(b.body);
  b.mem[215] = b.Fixed ? 1 : 0;

  if (b.pos.y < 0.0f) b.pos.y = 0.0f;
  vb_single temp = static_cast<vb_single>(
      std::floor((b.pos.y / sim.opts.yDivisor) / 32000.0));
  temp = (b.pos.y / sim.opts.yDivisor) - (temp * 32000.0f);
  b.mem[217] = static_cast<vb_integer>(vb_round64(temp) % 32000);
  if (b.pos.x < 0.0f) b.pos.x = 0.0f;
  temp = static_cast<vb_single>(
      std::floor((b.pos.x / sim.opts.xDivisor) / 32000.0));
  temp = (b.pos.x / sim.opts.xDivisor) - (temp * 32000.0f);
  b.mem[219] = static_cast<vb_integer>(vb_round64(temp) % 32000);
}

}  // namespace db
