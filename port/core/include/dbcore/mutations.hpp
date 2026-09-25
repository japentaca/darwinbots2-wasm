// dbcore/mutations.hpp — NeoMutations.bas completo (40-MUTACIONES.md, B6b):
// el dispatcher `mutate`, los 11 operadores, las agendas geométricas de
// Point/Point2, los suelos anti-freeze que REESCRIBEN las tasas heredables
// ([PROBABLE BUG] B6-5 / B-31), ChangeDNA/ChangeDNA2 y mutatecolors. También
// DNAtoInt/calc_dnamatrix (DNATokenizing.bas:9-56, Q16), que el crossover de
// robots.hpp consume.
//
// Decisiones de port documentadas:
// - `ismutating` no es global: se pasa explícito a los sondeos de Parse
//   (ParseDetok con ismutating=true: debugint/debugbool no existen, Max del
//   tipo 3 = 12 durante mutación, 14 en la matriz).
// - El texto de LastMutDetail replica el formato del original vía StrVB;
//   para Single (DeltaMut) se usa un %g compacto — el texto del log no es
//   contrato de ningún caso dorado (solo los contadores lo son).
// - Sitios de error 9 del original (bucles de inserción de Amplification/
//   Translocation con MakeSpace fallido, "still bugy") → registro en
//   SimDiag::err9_mutation_insert + salto a getout, como el On Error del
//   fuente (10-CICLO.md §14).
#pragma once

#include <cstdio>
#include <string>
#include <vector>

#include "formats.hpp"  // ParseDetok (sondeo del Max legal por tipo)
#include "sim.hpp"

namespace db {

// NeoMutations.bas:19 — corrección temporal de todos los suelos.
inline constexpr double overtime = 30.0;

// ---------------------------------------------------------------------------
// DNATokenizing.bas:9-56 — dnamatrix + DNAtoInt (Q16: 77 comandos, índices
// 0..76; DNAtoInt máximo 32767 exacto).

struct DnaMatrix {
  // dnamatrix(8, 13) As Byte — tipos 2..10 x values 1..14; las celdas nunca
  // asignadas quedan 0 (Byte default): un token ilegal mapea al nucli de
  // (2,1) `add`, como el original.
  unsigned char m[9][14] = {};
};

// calc_dnamatrix (DNATokenizing.bas:15-35): sondea con Parse en modo
// detokenizar, ismutating = False (los 77 comandos, debug* incluidos).
inline const DnaMatrix& GetDnaMatrix(const SysvarTable& sysvars) {
  static const DnaMatrix matrix = [&] {
    DnaMatrix t;
    unsigned char count = 0;
    for (int y_tipo = 0; y_tipo <= 8; ++y_tipo) {
      for (int y_value = 0; y_value <= 13; ++y_value) {
        const Block y{static_cast<vb_integer>(y_tipo + 2),
                      static_cast<vb_integer>(y_value + 1)};
        const std::string result =
            ParseDetok(y, nullptr, sysvars, true, false, false);
        if (!result.empty()) {
          t.m[y_tipo][y_value] = count;
          count += 1;
        }
      }
    }
    return t;
  }();
  return matrix;
}

// DNAtoInt (DNATokenizing.bas:37-56). value se sanea a ±32000; los números
// grandes se comprimen (512·sgn + v/2.05): dos números grandes que difieran
// en < ~2 colisionan en el mismo entero (por eso la moneda de valores del
// crossover, 36-REPRO.md §3.3).
inline vb_integer DNAtoInt(const SysvarTable& sysvars, vb_integer tipo,
                           vb_long value_in) {
  vb_long value = value_in;
  if (value > 32000) value = 32000;
  if (value < -32000) value = -32000;
  if (tipo < 2) {
    vb_integer r = -16646;
    if (std::abs(value) > 999)
      value = vb_cint(512.0 * vb_sgn(value) +
                      static_cast<double>(value) / 2.05);
    r = static_cast<vb_integer>(r + value);
    if (tipo == 1) r = static_cast<vb_integer>(r + 32729);
    return r;
  }
  // tipos 2..10: 32691 + índice de matriz. Un value fuera de 1..14 era
  // error 9 en el original (inalcanzable con ADN cargado/mutado legal);
  // aquí las celdas no asignadas ya devuelven 0.
  int v = value_in;
  if (v < 1) v = 1;
  if (v > 14) v = 14;
  return static_cast<vb_integer>(32691 +
                                 GetDnaMatrix(sysvars).m[tipo - 2][v - 1]);
}

// ---------------------------------------------------------------------------
// NeoMutations.bas:29-50 — MutationType (texto del log).
inline std::string MutationType(int thing) {
  switch (thing) {
    case 0: return "Point Mutation";
    case 1: return "Minor Deletion";
    case 2: return "Reversal";
    case 3: return "Insertion";
    case 4: return "Amplification";
    case 5: return "Major Deletion";
    case 6: return "Copy Error";
    case 7: return "Delta Mutation";
    default: return "";
  }
}

// DNATokenizing.bas:3285-3306 — TipoDetok: nombres para 0..7 y 9; ni 8 ni 10
// (ni `end` increable ni el tipo reservado).
inline std::string TipoDetokM(vb_long tipo) {
  switch (tipo) {
    case 0: return "number";
    case 1: return "*number";
    case 2: return "basic command";
    case 3: return "advanced command";
    case 4: return "bit command";
    case 5: return "condition";
    case 6: return "logic operator";
    case 7: return "store command";
    case 9: return "flow command";
    default: return "";
  }
}

namespace mut_detail {

// Str() de un Single para los mensajes de log (formato no normativo).
inline std::string StrVBf(vb_single v) {
  char buf[32];
  std::snprintf(buf, sizeof(buf), "%g", static_cast<double>(v));
  return (v < 0.0f) ? std::string(buf) : " " + std::string(buf);
}

// Int() de VB6 sobre Single: floor.
inline vb_long IntS(vb_single v) {
  return static_cast<vb_long>(std::floor(static_cast<double>(v)));
}

}  // namespace mut_detail

// ---------------------------------------------------------------------------
// NeoMutations.bas:685-809 — ChangeDNA: el mutador token a token.
inline void ChangeDNA(Sim& sim, int robn, vb_long nth, vb_long Length = 1,
                      vb_integer PointWhatToChange = 50,
                      int Mtype = mut::PointUP) {
  using mut_detail::IntS;
  Bot& b = sim.rob[robn];

  for (vb_long t = nth; t <= nth + Length - 1; ++t) {
    if (t >= b.DnaLen) return;        // don't mutate end either
    if (t >= static_cast<vb_long>(b.dna.size())) return;  // guarda del port
    if (b.dna[t].tipo == 10) return;  // mutations can't cross control barriers

    if (RandomI(0, 99, *sim.rndy) < PointWhatToChange) {
      // ---- muta el VALOR ----
      if (b.dna[t].value != 0 && Mtype == mut::InsertionUP) {
        // La siembra de Insertion: Gauss(500, 0) ≈ ±1000. No cuenta como
        // mutación por sí sola (el token insertado cuenta tipo+valor).
        b.dna[t].value = vb_cint(static_cast<double>(SimGauss(sim, 500, 0)));
      }

      const vb_long old = b.dna[t].value;
      if (b.dna[t].tipo == 0 || b.dna[t].tipo == 1) {  // number / *number
        do {
          if (std::abs(old) <= 1000) {
            if (IntS(sim.rnd() * 2.0f) == 0)  // 1/2 chance the mutation is large
              b.dna[t].value = vb_cint(static_cast<double>(SimGauss(
                  sim, 94, static_cast<vb_single>(b.dna[t].value))));
            else
              b.dna[t].value = vb_cint(static_cast<double>(SimGauss(
                  sim, 7, static_cast<vb_single>(b.dna[t].value))));
          } else {
            b.dna[t].value = vb_cint(static_cast<double>(
                SimGauss(sim, static_cast<vb_single>(old / 10.0),
                         static_cast<vb_single>(b.dna[t].value))));
          }
        } while (b.dna[t].value == old);

        b.Mutations += 1;
        b.LastMut += 1;
        logmutation(sim, robn,
                    MutationType(Mtype) + " changed " +
                        TipoDetokM(b.dna[t].tipo) + " from" + StrVB(old) +
                        " to" + StrVB(b.dna[t].value) + " at position" +
                        StrVB(t) + " during cycle" +
                        StrVB(sim.opts.TotRunCycle));
      } else {
        // find max legit value (sondeo con Parse, ismutating = True)
        Block bp{b.dna[t].tipo, 0};
        vb_long Max = 0;
        std::string temp;
        do {
          temp.clear();
          Max += 1;
          bp.value = static_cast<vb_integer>(Max);
          temp = ParseDetok(bp, nullptr, *sim.sysvars, true, false, true);
        } while (!temp.empty());
        Max -= 1;
        if (Max <= 1) return;  // failsafe

        do {
          b.dna[t].value = static_cast<vb_integer>(Random(1, Max, *sim.rndy));
        } while (b.dna[t].value == old);

        bp.tipo = b.dna[t].tipo;
        bp.value = static_cast<vb_integer>(old);
        const std::string Name =
            ParseDetok(b.dna[t], nullptr, *sim.sysvars, true, false, true);
        const std::string oldname =
            ParseDetok(bp, nullptr, *sim.sysvars, true, false, true);

        b.Mutations += 1;
        b.LastMut += 1;
        logmutation(sim, robn,
                    MutationType(Mtype) + " changed value of " +
                        TipoDetokM(b.dna[t].tipo) + " from " + oldname +
                        " to " + Name + " at position" + StrVB(t) +
                        " during cycle" + StrVB(sim.opts.TotRunCycle));
      }
    } else {
      // ---- muta el TIPO ----
      const Block bp = b.dna[t];
      do {
        b.dna[t].tipo = static_cast<vb_integer>(RandomI(0, 20, *sim.rndy));
      } while (b.dna[t].tipo == bp.tipo || TipoDetokM(b.dna[t].tipo).empty());
      vb_long Max = 0;
      if (b.dna[t].tipo >= 2) {
        std::string temp;
        do {
          temp.clear();
          Max += 1;
          b.dna[t].value = static_cast<vb_integer>(Max);
          temp = ParseDetok(b.dna[t], nullptr, *sim.sysvars, true, false, true);
        } while (!temp.empty());
        Max -= 1;
        if (Max <= 1) return;  // failsafe (deja el value del sondeo, como VB6)
        b.dna[t].value = static_cast<vb_integer>(
            ((std::abs(bp.value) - 1) % Max) + 1);  // Mod con signo VB6 = C++
        if (b.dna[t].value == 0) b.dna[t].value = 1;
      }
      // tipos 0/1: el value viejo queda tal cual ("it has to be in range")

      const std::string Name =
          ParseDetok(b.dna[t], nullptr, *sim.sysvars, true, false, true);
      const std::string oldname =
          ParseDetok(bp, nullptr, *sim.sysvars, true, false, true);
      b.Mutations += 1;
      b.LastMut += 1;
      logmutation(sim, robn,
                  MutationType(Mtype) + " changed the " + TipoDetokM(bp.tipo) +
                      ": " + oldname + " to the " + TipoDetokM(b.dna[t].tipo) +
                      ": " + Name + " at position" + StrVB(t) +
                      " during cycle" + StrVB(sim.opts.TotRunCycle));
    }
  }
}

// ---------------------------------------------------------------------------
// NeoMutations.bas:600-683 — ChangeDNA2: el mutador de sysvars (Point2/CE2).
inline void ChangeDNA2(Sim& sim, int robn, vb_integer nth, vb_integer DNAsize,
                       bool IsPoint = false) {
  using mut_detail::IntS;
  Bot& b = sim.rob[robn];
  const IndexedSysvarTable& OUT = DefaultSysvarOUT();
  const IndexedSysvarTable& IN = DefaultSysvarIN();

  vb_integer randomsysvar;
  do {
    randomsysvar = static_cast<vb_integer>(IntS(sim.rnd() * 256.0f));
  } while (OUT.e[randomsysvar].name.empty());

  std::string holddetail;
  bool special = false;
  if (nth < DNAsize - 2) {
    // .shoot store
    if (b.dna[nth + 1].tipo == 0 && b.dna[nth + 1].value == addr::shoot &&
        b.dna[nth + 2].tipo == 7 && b.dna[nth + 2].value == 1) {
      // Choose(Int(rndy*7)+1, -1,-2,-3,-4,-6,-8, sysvar(randomsysvar).value)
      static constexpr vb_integer opts6[6] = {-1, -2, -3, -4, -6, -8};
      const vb_long pick = IntS(sim.rnd() * 7.0f);  // 0..6
      const Var* sv = SysvarByIndex(*sim.sysvars, randomsysvar);
      b.dna[nth].value =
          (pick < 6) ? opts6[pick]
                     : static_cast<vb_integer>(sv ? sv->value : 0);
      b.dna[nth].tipo = 0;
      holddetail = " changed dna location " + std::to_string(nth) + " to " +
                   std::to_string(b.dna[nth].value);
      special = true;
    }
    // .focuseye store
    if (b.dna[nth + 1].tipo == 0 && b.dna[nth + 1].value == addr::FOCUSEYE &&
        b.dna[nth + 2].tipo == 7 && b.dna[nth + 2].value == 1) {
      b.dna[nth].value = static_cast<vb_integer>(IntS(sim.rnd() * 9.0f) - 4);
      b.dna[nth].tipo = 0;
      holddetail = " changed dna location " + std::to_string(nth) + " to " +
                   std::to_string(b.dna[nth].value);
      special = true;
    }
    // .tieloc store
    if (b.dna[nth + 1].tipo == 0 && b.dna[nth + 1].value == addr::tieloc &&
        b.dna[nth + 2].tipo == 7 && b.dna[nth + 2].value == 1) {
      static constexpr vb_integer opts4[4] = {-1, -3, -4, -6};
      const vb_long pick = IntS(sim.rnd() * 5.0f);  // 0..4
      const Var* sv = SysvarByIndex(*sim.sysvars, randomsysvar);
      b.dna[nth].value =
          (pick < 4) ? opts4[pick]
                     : static_cast<vb_integer>(sv ? sv->value : 0);
      b.dna[nth].tipo = 0;
      holddetail = " changed dna location " + std::to_string(nth) + " to " +
                   std::to_string(b.dna[nth].value);
      special = true;
    }
  }

  const std::string who = IsPoint ? "Point Mutation 2" : "Copy Error 2";
  if (special) {
    logmutation(sim, robn,
                who + holddetail + " during cycle" +
                    StrVB(sim.opts.TotRunCycle));
    b.Mutations += 1;
    b.LastMut += 1;
  } else {
    // `nth < DNAsize - 1 And Int(rndy * 3) = 0`: el And de VB6 NO
    // cortocircuita — la moneda se consume siempre.
    const bool inrange = nth < DNAsize - 1;
    const bool coin3 = IntS(sim.rnd() * 3.0f) == 0;
    if (inrange && coin3) {  // 1/3 chance functional
      b.dna[nth].tipo = 0;
      b.dna[nth].value = static_cast<vb_integer>(OUT.e[randomsysvar].value);
      holddetail = " changed dna location " + std::to_string(nth) +
                   " to number ." + OUT.e[randomsysvar].name;
      logmutation(sim, robn,
                  who + holddetail + " during cycle" +
                      StrVB(sim.opts.TotRunCycle));
      b.Mutations += 1;
      b.LastMut += 1;

      b.dna[nth + 1].tipo = 7;
      b.dna[nth + 1].value = 1;
      holddetail =
          " changed dna location " + std::to_string(nth + 1) + " to store";
      logmutation(sim, robn,
                  who + holddetail + " during cycle" +
                      StrVB(sim.opts.TotRunCycle));
      b.Mutations += 1;
      b.LastMut += 1;
    } else {  // 2/3 chance informational
      if (IntS(sim.rnd() * 5.0f) == 0) {
        // 1/5 chance large number (via un sysvar de la tabla principal)
        const Var* sv;
        do {
          randomsysvar = static_cast<vb_integer>(IntS(sim.rnd() * 1000.0f));
          sv = SysvarByIndex(*sim.sysvars, randomsysvar);
        } while (sv == nullptr || sv->name.empty());
        b.dna[nth].tipo = 0;
        b.dna[nth].value = static_cast<vb_integer>(
            sv->value + IntS(sim.rnd() * 32.0f) * 1000);
        holddetail = " changed dna location " + std::to_string(nth) +
                     " to number " + std::to_string(b.dna[nth].value);
      } else {
        do {
          randomsysvar = static_cast<vb_integer>(IntS(sim.rnd() * 256.0f));
        } while (IN.e[randomsysvar].name.empty());
        b.dna[nth].tipo = 1;
        b.dna[nth].value = static_cast<vb_integer>(IN.e[randomsysvar].value);
        holddetail = " changed dna location " + std::to_string(nth) +
                     " to *number *." + IN.e[randomsysvar].name;
      }
      logmutation(sim, robn,
                  who + holddetail + " during cycle" +
                      StrVB(sim.opts.TotRunCycle));
      b.Mutations += 1;
      b.LastMut += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Agendas geométricas.

// NeoMutations.bas:518-544 — PointMutWhereAndWhen. Todo Single hasta el CLng
// final; Long + Single promociona a Double en VB6 (la excepción documentada).
inline void PointMutWhereAndWhen(Sim& sim, vb_single randval, int robn) {
  Bot& b = sim.rob[robn];
  if (b.DnaLen == 1) return;  // avoid divide by 0

  vb_single mutation_rate =
      b.Mutables.mutarray[mut::PointUP] / sim.opts.MutCurrMult;
  if (mutation_rate < 1.0f && mutation_rate > 0.0f) mutation_rate = 1.0f;

  // 1 / (1000*rate): el `/` de VB6 con un operando entero devuelve Double.
  vb_single result = static_cast<vb_single>(
      std::log(static_cast<double>(1.0f - randval)) /
      std::log(1.0 - 1.0 / static_cast<double>(1000.0f * mutation_rate)));
  while (result > 1800000000.0f) result -= 1800000000.0f;

  b.PointMutBP = vb_clng(static_cast<double>(result)) % (b.DnaLen - 1) + 1;
  b.PointMutCycle =
      vb_clng(static_cast<double>(b.age) +
              static_cast<double>(result / static_cast<vb_single>(b.DnaLen - 1)));
}

// NeoMutations.bas:482-515 — Point2MutWhen: la tasa dividida por un Gauss de
// las longitudes de Point (>= 1) y x1.33.
inline void Point2MutWhen(Sim& sim, vb_single randval, int robn) {
  Bot& b = sim.rob[robn];
  if (b.DnaLen == 1) return;

  vb_single mutation_rate =
      b.Mutables.mutarray[mut::P2UP] / sim.opts.MutCurrMult;

  double calc_gauss = static_cast<double>(SimGauss(
      sim, b.Mutables.StdDev[mut::PointUP], b.Mutables.Mean[mut::PointUP]));
  if (calc_gauss < 1.0) calc_gauss = 1.0;

  mutation_rate = static_cast<vb_single>(
      static_cast<double>(mutation_rate) / calc_gauss);
  mutation_rate = static_cast<vb_single>(
      static_cast<double>(mutation_rate) * 1.33);  // changedna2 puede escribir 2

  if (mutation_rate < 1.0f && mutation_rate > 0.0f) mutation_rate = 1.0f;

  vb_single result = static_cast<vb_single>(
      std::log(static_cast<double>(1.0f - randval)) /
      std::log(1.0 - 1.0 / static_cast<double>(1000.0f * mutation_rate)));
  while (result > 1800000000.0f) result -= 1800000000.0f;

  b.Point2MutCycle =
      vb_clng(static_cast<double>(b.age) +
              static_cast<double>(result / static_cast<vb_single>(b.DnaLen - 1)));
}

// ---------------------------------------------------------------------------
// Operadores en vida.

// NeoMutations.bas:454-479 — PointMutation (agenda geométrica).
inline void PointMutation(Sim& sim, int robn) {
  using namespace mut;
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) *
                  static_cast<double>(b.Mutables.Mean[PointUP] +
                                      b.Mutables.StdDev[PointUP]) /
                  (400.0 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[PointUP] < floor_)
    b.Mutables.mutarray[PointUP] = static_cast<vb_single>(floor_);  // B-31

  if (b.age == 0 || b.PointMutCycle < b.age)
    PointMutWhereAndWhen(sim, sim.rnd(), robn);

  while (b.age == b.PointMutCycle && b.age > 0 && b.DnaLen > 1) {
    const vb_single temp =
        SimGauss(sim, b.Mutables.StdDev[PointUP], b.Mutables.Mean[PointUP]);
    const vb_long temp2 = mut_detail::IntS(temp) % 32000;
    ChangeDNA(sim, robn, b.PointMutBP, temp2, b.Mutables.PointWhatToChange);
    PointMutWhereAndWhen(sim, sim.rnd(), robn);
  }
}

// NeoMutations.bas:424-452 — PointMutation2 (agenda propia, ChangeDNA2 sobre
// token uniforme; no usa PointMutBP).
inline void PointMutation2(Sim& sim, int robn) {
  using namespace mut;
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) *
                  static_cast<double>(b.Mutables.Mean[PointUP] +
                                      b.Mutables.StdDev[PointUP]) /
                  (400.0 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[P2UP] < floor_)
    b.Mutables.mutarray[P2UP] = static_cast<vb_single>(floor_);

  if (b.age == 0 || b.Point2MutCycle < b.age)
    Point2MutWhen(sim, sim.rnd(), robn);

  while (b.age == b.Point2MutCycle && b.age > 0 && b.DnaLen > 1) {
    const vb_integer DNAsize = static_cast<vb_integer>(DnaLen(b.dna) - 1);
    const vb_integer randompos =
        static_cast<vb_integer>(mut_detail::IntS(sim.rnd() *
                                                 static_cast<vb_single>(DNAsize)) +
                                1);
    ChangeDNA2(sim, robn, randompos, DNAsize, true);
    Point2MutWhen(sim, sim.rnd(), robn);
  }
}

// NeoMutations.bas:546-573 — DeltaMut: muta las tasas del propio bot.
inline void DeltaMut(Sim& sim, int robn) {
  using namespace mut;
  Bot& b = sim.rob[robn];

  if (static_cast<double>(sim.rnd()) >
      1.0 - 1.0 / static_cast<double>(100.0f * b.Mutables.mutarray[DeltaUP] /
                                      sim.opts.MutCurrMult)) {
    if (b.Mutables.StdDev[DeltaUP] == 0.0f) b.Mutables.Mean[DeltaUP] = 50;
    if (b.Mutables.Mean[DeltaUP] == 0.0f) b.Mutables.Mean[DeltaUP] = 25;

    vb_integer temp;
    do {
      temp = static_cast<vb_integer>(RandomI(0, 10, *sim.rndy));
    } while (b.Mutables.mutarray[temp] <= 0.0f);

    vb_single newval;
    do {
      newval = SimGauss(sim, b.Mutables.Mean[DeltaUP], b.Mutables.mutarray[temp]);
    } while (b.Mutables.mutarray[temp] == newval || newval <= 0.0f);

    logmutation(sim, robn,
                "Delta mutations changed " + MutationType(temp) + " from 1 in" +
                    mut_detail::StrVBf(b.Mutables.mutarray[temp]) +
                    " to 1 in" + mut_detail::StrVBf(newval));
    b.Mutations += 1;
    b.LastMut += 1;
    b.Mutables.mutarray[temp] = newval;
  }
}

// ---------------------------------------------------------------------------
// Operadores de nacimiento.

// NeoMutations.bas:575-598 — CopyError.
inline void CopyError(Sim& sim, int robn) {
  using namespace mut;
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) *
                  static_cast<double>(b.Mutables.Mean[CopyErrorUP] +
                                      b.Mutables.StdDev[CopyErrorUP]) /
                  (25.0 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[CopyErrorUP] < floor_)
    b.Mutables.mutarray[CopyErrorUP] = static_cast<vb_single>(floor_);

  const vb_long limit = b.DnaLen - 1;  // el For captura el límite una vez
  for (vb_long t = 1; t <= limit; ++t) {
    if (static_cast<double>(sim.rnd()) <
        1.0 / static_cast<double>(b.Mutables.mutarray[CopyErrorUP] /
                                  sim.opts.MutCurrMult)) {
      const vb_long Length = vb_clng(static_cast<double>(SimGauss(
          sim, b.Mutables.StdDev[CopyErrorUP], b.Mutables.Mean[CopyErrorUP])));
      ChangeDNA(sim, robn, t, Length, b.Mutables.CopyErrorWhatToChange,
                CopyErrorUP);
    }
  }
}

// NeoMutations.bas:388-422 — CopyError2 (posiciones únicas via datahit).
inline void CopyError2(Sim& sim, int robn) {
  using namespace mut;
  using mut_detail::IntS;
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) *
                  static_cast<double>(b.Mutables.Mean[CopyErrorUP] +
                                      b.Mutables.StdDev[CopyErrorUP]) /
                  (5.0 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[CE2UP] < floor_)
    b.Mutables.mutarray[CE2UP] = static_cast<vb_single>(floor_);

  const vb_integer DNAsize = static_cast<vb_integer>(DnaLen(b.dna) - 1);
  std::vector<bool> datahit(static_cast<std::size_t>(DNAsize) + 1, false);
  for (vb_integer e = 1; e <= DNAsize; ++e) {
    // el Gauss del ajuste de longitudes se consume ANTES del sorteo
    double calc_gauss = static_cast<double>(SimGauss(
        sim, b.Mutables.StdDev[CopyErrorUP], b.Mutables.Mean[CopyErrorUP]));
    if (calc_gauss < 1.0) calc_gauss = 1.0;

    if (sim.rnd() <
        0.75 / (b.Mutables.mutarray[CE2UP] /
                (sim.opts.MutCurrMult * calc_gauss))) {
      vb_integer e2;
      do {
        e2 = static_cast<vb_integer>(
            IntS(sim.rnd() * static_cast<vb_single>(DNAsize)) + 1);
      } while (datahit[e2]);
      datahit[e2] = true;
      ChangeDNA2(sim, robn, e2, DNAsize);
    }
  }
}

// NeoMutations.bas:811-843 — Insertion: cada token insertado cuenta 2
// mutaciones (tipos con PWTC 0 + valores con PWTC 100) — B-33.
inline void Insertion(Sim& sim, int robn) {
  using namespace mut;
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) *
                  static_cast<double>(b.Mutables.Mean[InsertionUP] +
                                      b.Mutables.StdDev[InsertionUP]) /
                  (5.0 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[InsertionUP] < floor_)
    b.Mutables.mutarray[InsertionUP] = static_cast<vb_single>(floor_);

  vb_long accum = 0;
  const vb_long limit = b.DnaLen - 1;
  for (vb_long t = 1; t <= limit; ++t) {
    if (static_cast<double>(sim.rnd()) <
        1.0 / static_cast<double>(b.Mutables.mutarray[InsertionUP] /
                                  sim.opts.MutCurrMult)) {
      if (b.Mutables.Mean[InsertionUP] == 0.0f)
        b.Mutables.Mean[InsertionUP] = 1;
      vb_integer Length;  // Integer en el original
      do {
        Length = vb_cint(static_cast<double>(SimGauss(
            sim, b.Mutables.StdDev[InsertionUP], b.Mutables.Mean[InsertionUP])));
      } while (Length <= 0);

      if (static_cast<vb_long>(b.DnaLen) + Length > 32000) return;

      MakeSpace(b.dna, t + accum, Length, b.DnaLen);
      b.DnaLen = static_cast<vb_integer>(b.DnaLen + Length);
      ChangeDNA(sim, robn, t + 1 + accum, Length, 0, InsertionUP);
      ChangeDNA(sim, robn, t + 1 + accum, Length, 100, InsertionUP);
      accum = Length + accum;
    }
  }
}

// NeoMutations.bas:845-897 — Reversal.
inline void Reversal(Sim& sim, int robn) {
  using namespace mut;
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) *
                  static_cast<double>(b.Mutables.Mean[ReversalUP] +
                                      b.Mutables.StdDev[ReversalUP]) /
                  (105.0 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[ReversalUP] < floor_)
    b.Mutables.mutarray[ReversalUP] = static_cast<vb_single>(floor_);

  const vb_long limit = b.DnaLen - 1;
  for (vb_long t = 1; t <= limit; ++t) {
    if (static_cast<double>(sim.rnd()) <
        1.0 / static_cast<double>(b.Mutables.mutarray[ReversalUP] /
                                  sim.opts.MutCurrMult)) {
      if (b.Mutables.Mean[ReversalUP] < 2.0f) b.Mutables.Mean[ReversalUP] = 2;

      vb_long Length;
      do {
        Length = vb_clng(static_cast<double>(SimGauss(
            sim, b.Mutables.StdDev[ReversalUP], b.Mutables.Mean[ReversalUP])));
      } while (Length <= 0);

      Length = Length / 2;  // \2: ida y vuelta simétricas

      if (t - Length < 1) Length = t - 1;
      if (t + Length > b.DnaLen - 1) Length = b.DnaLen - 1 - t;
      if (Length > 0) {
        vb_long second = 0;
        for (vb_long counter = t - Length; counter <= t - 1; ++counter) {
          const Block tempblock = b.dna[counter];
          b.dna[counter] = b.dna[t + Length - second];
          b.dna[t + Length - second] = tempblock;
          second += 1;
        }
        b.Mutations += 1;
        b.LastMut += 1;
        logmutation(sim, robn,
                    "Reversal of" + StrVB(Length * 2 + 1) +
                        "bps centered at " + StrVB(t) + " during cycle" +
                        StrVB(sim.opts.TotRunCycle));
      }
    }
  }
}

// NeoMutations.bas:311-386 — Translocation ("still bugy, but I want them").
inline void Translocation(Sim& sim, int robn) {
  using namespace mut;
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) *
                  static_cast<double>(b.Mutables.Mean[TranslocationUP] +
                                      b.Mutables.StdDev[TranslocationUP]) /
                  (360.0 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[TranslocationUP] < floor_)
    b.Mutables.mutarray[TranslocationUP] = static_cast<vb_single>(floor_);

  const vb_long limit = static_cast<vb_long>(b.dna.size()) - 1 - 1;  // UBound-1
  for (vb_long t = 1; t <= limit; ++t) {
    if (static_cast<double>(sim.rnd()) <
        1.0 / static_cast<double>(b.Mutables.mutarray[TranslocationUP] /
                                  sim.opts.MutCurrMult)) {
      vb_long Length = vb_clng(static_cast<double>(
          SimGauss(sim, b.Mutables.StdDev[TranslocationUP],
                   b.Mutables.Mean[TranslocationUP])));
      Length = Length % (static_cast<vb_long>(b.dna.size()) - 1);
      if (Length < 1) Length = 1;
      Length = (Length - 1) / 2;

      if (t - Length < 1) continue;
      if (t + Length > static_cast<vb_long>(b.dna.size()) - 1 - 1) continue;

      if (Length > 0) {
        std::vector<Block> tempDNA(static_cast<std::size_t>(Length) * 2 + 1);
        vb_long second = 0;
        for (vb_long counter = t - Length; counter <= t + Length; ++counter) {
          tempDNA[second] = b.dna[counter];
          second += 1;
        }
        NmDelete(b.dna, t - Length, Length * 2 + 1);

        const vb_long start =
            Random(1, static_cast<double>(b.dna.size()) - 1 - 2, *sim.rndy);
        MakeSpace(b.dna, start, static_cast<vb_long>(tempDNA.size()));

        for (vb_long counter = start + 1;
             counter <= start + static_cast<vb_long>(tempDNA.size());
             ++counter) {
          if (counter > static_cast<vb_long>(b.dna.size()) - 1 ||
              counter < 0) {
            sim.diag.err9_mutation_insert += 1;  // error 9 -> getout
            return;  // sin re-estampar el end (como el On Error del fuente)
          }
          b.dna[counter] = tempDNA[counter - start - 1];
        }

        b.Mutations += 1;
        b.LastMut += 1;
        logmutation(sim, robn,
                    "Translocation moved a series at" + StrVB(t) +
                        StrVB(Length * 2 + 1) + "bps long to " + StrVB(start) +
                        " during cycle" + StrVB(sim.opts.TotRunCycle));
      }
    }
  }
  // add "end" to end of the DNA (el original no recalcula DnaLen aquí)
  b.dna[b.dna.size() - 1] = Block{10, 1};
}

// NeoMutations.bas:238-308 — Amplification: t arranca en 2 (el incremento
// corre antes del test — [PROBABLE BUG] B6-8 / B-34).
inline void Amplification(Sim& sim, int robn) {
  using namespace mut;
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) *
                  static_cast<double>(b.Mutables.Mean[AmplificationUP] +
                                      b.Mutables.StdDev[AmplificationUP]) /
                  (1200.0 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[AmplificationUP] < floor_)
    b.Mutables.mutarray[AmplificationUP] = static_cast<vb_single>(floor_);

  bool err = false;
  vb_long t = 1;
  do {
    t += 1;
    if (static_cast<double>(sim.rnd()) <
        1.0 / static_cast<double>(b.Mutables.mutarray[AmplificationUP] /
                                  sim.opts.MutCurrMult)) {
      vb_long Length = vb_clng(static_cast<double>(
          SimGauss(sim, b.Mutables.StdDev[AmplificationUP],
                   b.Mutables.Mean[AmplificationUP])));
      Length = Length % (static_cast<vb_long>(b.dna.size()) - 1);
      if (Length < 1) Length = 1;
      Length = (Length - 1) / 2;
      if (t - Length < 1) continue;
      if (t + Length > b.DnaLen - 1) continue;
      if (static_cast<vb_long>(b.dna.size()) - 1 + Length * 2 > 32000)
        continue;  // size limit

      if (Length > 0) {
        std::vector<Block> tempDNA(static_cast<std::size_t>(Length) * 2 + 1);
        vb_long second = 0;
        for (vb_long counter = t - Length; counter <= t + Length; ++counter) {
          tempDNA[second] = b.dna[counter];
          second += 1;
        }
        const vb_long start =
            Random(1, static_cast<double>(b.dna.size()) - 1 - 2, *sim.rndy);
        MakeSpace(b.dna, start, static_cast<vb_long>(tempDNA.size()));

        for (vb_long counter = start + 1;
             counter <= start + static_cast<vb_long>(tempDNA.size());
             ++counter) {
          if (counter > static_cast<vb_long>(b.dna.size()) - 1 ||
              counter < 0) {
            sim.diag.err9_mutation_insert += 1;  // error 9 -> getout
            err = true;
            break;
          }
          b.dna[counter] = tempDNA[counter - start - 1];
        }
        if (err) break;

        b.Mutations += 1;
        b.LastMut += 1;
        logmutation(sim, robn,
                    "Amplification copied a series at" + StrVB(t) +
                        StrVB(Length * 2 + 1) + "bps long to " + StrVB(start) +
                        " during cycle" + StrVB(sim.opts.TotRunCycle));
      }
    }
  } while (!err && t < static_cast<vb_long>(b.dna.size()) - 1 - 1);

  if (!err) {
    // add "end" to end of the DNA
    b.dna[b.dna.size() - 1] = Block{10, 1};
  }
  // getout: (el recalculo corre también en el camino de error, :307)
  b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));
}

// NeoMutations.bas:899-932 / 934-965 — Minor/MajorDeletion: código idéntico
// salvo el índice de mutarray/Mean; comparten suelo K = 2.5 SIN factor Mean
// ([PROBABLE BUG] B6-6 / B-32).
inline void DeletionOp(Sim& sim, int robn, int idx, const char* logname) {
  Bot& b = sim.rob[robn];

  double floor_ = static_cast<double>(b.DnaLen) / (2.5 * overtime);
  floor_ *= sim.opts.MutCurrMult;
  if (b.Mutables.mutarray[idx] < floor_)
    b.Mutables.mutarray[idx] = static_cast<vb_single>(floor_);

  if (b.Mutables.Mean[idx] < 1.0f) b.Mutables.Mean[idx] = 1;
  const vb_long limit = b.DnaLen - 1;
  for (vb_long t = 1; t <= limit; ++t) {
    if (static_cast<double>(sim.rnd()) <
        1.0 / static_cast<double>(b.Mutables.mutarray[idx] /
                                  sim.opts.MutCurrMult)) {
      vb_long Length;
      do {
        Length = vb_clng(static_cast<double>(
            SimGauss(sim, b.Mutables.StdDev[idx], b.Mutables.Mean[idx])));
      } while (Length <= 0);

      if (t + Length > b.DnaLen) Length = b.DnaLen - t;  // no tocar el end
      if (Length <= 0) return;

      NmDelete(b.dna, t, Length, b.DnaLen);
      b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));

      b.Mutations += 1;
      b.LastMut += 1;
      logmutation(sim, robn,
                  std::string(logname) + " deleted a run of" + StrVB(Length) +
                      " bps at position" + StrVB(t) + " during cycle" +
                      StrVB(sim.opts.TotRunCycle));
    }
  }
}

inline void MinorDeletion(Sim& sim, int robn) {
  DeletionOp(sim, robn, mut::MinorDeletionUP, "Minor Deletion");
}
inline void MajorDeletion(Sim& sim, int robn) {
  DeletionOp(sim, robn, mut::MajorDeletionUP, "Major Deletion");
}

// ---------------------------------------------------------------------------
// NeoMutations.bas:969-1001 — mutatecolors: 1 canal ±20 por mutación
// acumulada, 2 RNG por iteración ([PROBABLE BUG] B6 §6.5).
inline void mutatecolors(Sim& sim, int n, vb_long a) {
  const vb_long color = sim.rob[n].color;
  vb_long bb = color / 65536;
  vb_long g = color / 256 - bb * 256;
  vb_long r = color - bb * 65536 - g * 256;

  for (vb_long counter = 1; counter <= a; ++counter) {
    switch (RandomI(1, 3, *sim.rndy)) {
      case 1: bb += (RandomI(0, 1, *sim.rndy) * 2 - 1) * 20; break;
      case 2: g += (RandomI(0, 1, *sim.rndy) * 2 - 1) * 20; break;
      case 3: r += (RandomI(0, 1, *sim.rndy) * 2 - 1) * 20; break;
    }
    if (r > 255) r = 255;
    if (r < 0) r = 0;
    if (g > 255) g = 255;
    if (g < 0) g = 0;
    if (bb > 255) bb = 255;
    if (bb < 0) bb = 0;
  }
  sim.rob[n].color = bb * 65536 + g * 256 + r;
}

// IsNumeric de VB6 reducido a lo que el renombrado de especies necesita
// (dígitos, signo opcional). Decisión de port: los FName reales son nombres
// de archivo; los formatos numéricos exóticos de IsNumeric no aparecen.
inline bool IsNumericVB(const std::string& s) {
  if (s.empty()) return false;
  std::size_t i = (s[0] == '+' || s[0] == '-') ? 1 : 0;
  if (i >= s.size()) return false;
  for (; i < s.size(); ++i)
    if (s[i] < '0' || s[i] > '9') return false;
  return true;
}

// ---------------------------------------------------------------------------
// NeoMutations.bas:122-236 — mutate: el dispatcher.
inline void mutate(Sim& sim, int robn, bool reproducing = false) {
  using namespace mut;
  Bot& b = sim.rob[robn];
  if (!b.Mutables.Mutations || sim.opts.DisableMutations) return;

  vb_long Delta = b.LastMut;

  // ismutating = True: implícito (los sondeos de Parse van con true).
  if (!reproducing) {
    if (b.Mutables.mutarray[PointUP] > 0.0f) PointMutation(sim, robn);
    if (b.Mutables.mutarray[DeltaUP] > 0.0f && !sim.Delta2) DeltaMut(sim, robn);
    if (b.Mutables.mutarray[P2UP] > 0.0f && sim.sunbelt)
      PointMutation2(sim, robn);

    // special case update epigenetic reset
    if (b.LastMut - Delta > 0 && sim.epireset)
      b.MutEpiReset += std::pow(static_cast<double>(b.LastMut - Delta),
                                static_cast<double>(sim.epiresetemp));

    // Delta2 point mutation change (deriva en vida de Point/Point2)
    if (sim.Delta2 && sim.DeltaPM > 0) {
      if (b.age % sim.DeltaPM == 0 && b.age > 0) {
        const vb_long MratesMax =
            sim.NormMut ? static_cast<vb_long>(b.DnaLen) *
                              static_cast<vb_long>(sim.valMaxNormMut)
                        : 2000000000;
        for (int t = 0; t <= 9; t += 9) {  // Point y Point2
          if (b.Mutables.mutarray[t] < 1.0f) continue;
          if (static_cast<double>(sim.rnd()) < sim.DeltaMainChance / 100.0) {
            if (sim.DeltaMainExp != 0.0f)
              b.Mutables.mutarray[t] = static_cast<vb_single>(
                  static_cast<double>(b.Mutables.mutarray[t]) *
                  std::pow(10.0, static_cast<double>(
                                     (sim.rnd() * 2 - 1) / sim.DeltaMainExp)));
            b.Mutables.mutarray[t] =
                b.Mutables.mutarray[t] + (sim.rnd() * 2 - 1) * sim.DeltaMainLn;
            if (b.Mutables.mutarray[t] < 1.0f) b.Mutables.mutarray[t] = 1;
            if (b.Mutables.mutarray[t] > static_cast<vb_single>(MratesMax))
              b.Mutables.mutarray[t] = static_cast<vb_single>(MratesMax);
          }
          if (static_cast<double>(sim.rnd()) < sim.DeltaDevChance / 100.0) {
            if (sim.DeltaDevExp != 0.0f)
              b.Mutables.StdDev[t] = static_cast<vb_single>(
                  static_cast<double>(b.Mutables.StdDev[t]) *
                  std::pow(10.0, static_cast<double>(
                                     (sim.rnd() * 2 - 1) / sim.DeltaDevExp)));
            b.Mutables.StdDev[t] =
                b.Mutables.StdDev[t] + (sim.rnd() * 2 - 1) * sim.DeltaDevLn;
            if (sim.DeltaDevExp != 0.0f)
              b.Mutables.Mean[t] = static_cast<vb_single>(
                  static_cast<double>(b.Mutables.Mean[t]) *
                  std::pow(10.0, static_cast<double>(
                                     (sim.rnd() * 2 - 1) / sim.DeltaDevExp)));
            b.Mutables.Mean[t] =
                b.Mutables.Mean[t] + (sim.rnd() * 2 - 1) * sim.DeltaDevLn;
            // Max range is always 0 to 800
            if (b.Mutables.StdDev[t] < 0.0f) b.Mutables.StdDev[t] = 0;
            if (b.Mutables.StdDev[t] > 200.0f) b.Mutables.StdDev[t] = 200;
            if (b.Mutables.Mean[t] < 1.0f) b.Mutables.Mean[t] = 1;
            if (b.Mutables.Mean[t] > 400.0f) b.Mutables.Mean[t] = 400;
          }
        }
        b.Mutables.PointWhatToChange = vb_cint(static_cast<double>(
            static_cast<vb_single>(b.Mutables.PointWhatToChange) +
            (sim.rnd() * 2 - 1) * sim.DeltaWTC));
        if (b.Mutables.PointWhatToChange < 0) b.Mutables.PointWhatToChange = 0;
        if (b.Mutables.PointWhatToChange > 100)
          b.Mutables.PointWhatToChange = 100;
        b.Point2MutCycle = 0;
        b.PointMutCycle = 0;
      }
    }
  } else {
    if (b.Mutables.mutarray[CopyErrorUP] > 0.0f) CopyError(sim, robn);
    if (b.Mutables.mutarray[CE2UP] > 0.0f && sim.sunbelt) CopyError2(sim, robn);
    if (b.Mutables.mutarray[InsertionUP] > 0.0f) Insertion(sim, robn);
    if (b.Mutables.mutarray[ReversalUP] > 0.0f) Reversal(sim, robn);
    if (b.Mutables.mutarray[TranslocationUP] > 0.0f && sim.sunbelt)
      Translocation(sim, robn);
    if (b.Mutables.mutarray[AmplificationUP] > 0.0f && sim.sunbelt)
      Amplification(sim, robn);
    if (b.Mutables.mutarray[MajorDeletionUP] > 0.0f) MajorDeletion(sim, robn);
    if (b.Mutables.mutarray[MinorDeletionUP] > 0.0f) MinorDeletion(sim, robn);
  }
  // ismutating = False

  Delta = b.LastMut - Delta;

  // auto forking (36-REPRO.md §4). SpeciesNum del original = tamaño del
  // registro mínimo del port (decisión documentada en sim.hpp).
  if (sim.opts.EnableAutoSpeciation) {
    if (static_cast<double>(b.Mutations) >
        static_cast<double>(b.DnaLen) *
            (static_cast<double>(sim.opts.SpeciationGeneticDistance) / 100.0)) {
      sim.opts.SpeciationForkInterval += 1;
      // Split(.FName, ")") y des-anidado del nick "(k)Nombre"
      const std::size_t pos = b.FName.find(')');
      const std::string part0 =
          (pos == std::string::npos) ? b.FName : b.FName.substr(0, pos);
      std::string robname;
      if (!part0.empty() && part0[0] == '(' && IsNumericVB(part0.substr(1))) {
        const std::size_t pos2 = b.FName.find(')', pos + 1);
        robname = (pos2 == std::string::npos)
                      ? b.FName.substr(pos + 1)
                      : b.FName.substr(pos + 1, pos2 - pos - 1);
      } else {
        robname = b.FName;
      }
      robname = "(" + std::to_string(sim.opts.SpeciationForkInterval) + ")" +
                robname;
      if (static_cast<vb_long>(sim.Specie.size()) < 49) {
        b.FName = robname;
        b.Mutations = 0;
        AddSpecieFromFile(sim, robn, false);  // E7-06
      } else {
        sim.opts.SpeciationForkInterval -= 1;
      }
    }
  }

  if (b.Mutations > 32000) b.Mutations = 32000;
  if (b.LastMut > 32000) b.LastMut = 32000;

  if (Delta > 0) {  // The bot has mutated.
    b.GenMut = static_cast<vb_single>(static_cast<double>(b.GenMut) -
                                      static_cast<double>(b.LastMut));
    if (b.GenMut < 0.0f) b.GenMut = 0;

    mutatecolors(sim, robn, Delta);
    b.SubSpecies = NewSubSpecies(sim, robn);
    b.genenum = CountGenes(b.dna);
    b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));
    b.mem[DnaLenSys] = b.DnaLen;
    b.mem[GenesSys] = static_cast<vb_integer>(b.genenum);
    // SIN makeoccurrlist: la firma occurr/my* queda rancia hasta el próximo
    // parto/virus/carga ([PROBABLE BUG] B6-9 / B-35).
  }
}

}  // namespace db
