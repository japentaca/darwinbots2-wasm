// dbcore/vm.hpp — el intérprete ExecuteDNA (DNA.bas:56-175), el flujo de
// genes (:1159-1232) y los stores (:858-1154).
// Contratos: 20-VM.md §4, §5, §7; casos dorados V-01..V-14.
#pragma once

#include <cmath>

#include "bot.hpp"
#include "dnaops.hpp"
#include "rng.hpp"

namespace db {

// SimOpts.Costs (SimOptions.bas:2-11, :104): 71 Singles; todo coste se
// multiplica por Costs(COSTMULTIPLIER). Con el default del harness (todo 0,
// 70-CASOS-DORADOS.md §0.1) la energía no cambia.
struct Costs {
  static constexpr int NUMCOST = 0;
  static constexpr int DOTNUMCOST = 1;
  static constexpr int BCCMDCOST = 2;
  static constexpr int ADCMDCOST = 3;
  static constexpr int BTCMDCOST = 4;
  static constexpr int CONDCOST = 5;
  static constexpr int LOGICCOST = 6;
  static constexpr int COSTSTORE = 7;
  static constexpr int FLOWCOST = 9;
  static constexpr int COSTMULTIPLIER = 54;

  std::array<vb_single, 71> v{};

  vb_single of(int i) const { return v[i] * v[COSTMULTIPLIER]; }
};

// Contexto de ejecución: los stacks son globales únicos del motor — no por
// bot — limpiados al entrar cada bot (DNA.bas:68-69; 20-VM.md §3).
struct VmContext {
  IntStack ints;
  BoolStack bools;
  Costs costs;
  VmDiag diag;
  RndSource* rndy = nullptr;
  vb_single xDivisor = 1.0f;  // main.frm:1252-1256; campo 32000x32000 => 1
  vb_single yDivisor = 1.0f;
  // E6 — el gate `(n = robfocus) Or Not (rob(n).console Is Nothing)` de
  // DNA.bas:75/152/1181: solo con el bot bajo observacion se puebla ga().
  // Es estado de modulo del original (robfocus + el objeto consola), asi que
  // aqui vive en el contexto del motor; ExecRobs lo fija por bot.
  bool gaTrack = false;
};

namespace detail {

// Normalización de dirección de store: Abs Mod 1000, 0 -> 1000 (DNA.bas:896).
inline vb_long normaddr(vb_long b) {
  b = (b < 0 ? -b : b) % MaxMem;
  if (b == 0) b = 1000;
  return b;
}

// DNA.bas:900-905 — solo los stores de DOS operandos marcan estos flags
// (V-12, [PROBABLE BUG] A2-6).
inline void tie_overwrite_flags(Bot& bot, vb_long b) {
  for (int k = 0; k <= 3; ++k) {
    if (b == 480 + k) bot.TieAngOverwrite[k] = true;
    if (b == 484 + k) bot.TieLenOverwrite[k] = true;
  }
}

}  // namespace detail

// ---- Stores (DNA.bas:891-1154; 20-VM.md §7) ----
// Dirección 0 = no-op sin coste. store/addstore/substore/multstore consumen
// el valor DENTRO del If (con dirección 0 el valor queda en la pila);
// divstore/ceilstore/floorstore hacen ambos pops antes (V-10).

inline void DNAstore(VmContext& vm, Bot& bot) {
  vb_long b = vm.ints.pop();
  if (b != 0) {
    b = detail::normaddr(b);
    const vb_long a = vm.ints.pop();
    detail::tie_overwrite_flags(bot, b);
    bot.mem[b] = mod32000(a);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE);
  }
}

inline void DNAinc(VmContext& vm, Bot& bot) {
  vb_long a = vm.ints.pop();
  if (a != 0) {
    a = detail::normaddr(a);
    const vb_long b = bot.mem[a] + 1;
    bot.mem[a] = mod32000(b);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 10;
  }
}

inline void DNAdec(VmContext& vm, Bot& bot) {
  vb_long a = vm.ints.pop();
  if (a != 0) {
    a = detail::normaddr(a);
    const vb_long b = bot.mem[a] - 1;
    bot.mem[a] = mod32000(b);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 10;
  }
}

inline void DNAaddstore(VmContext& vm, Bot& bot) {
  vb_long b = vm.ints.pop();
  if (b != 0) {
    b = detail::normaddr(b);
    const vb_long a = vm.ints.pop() + bot.mem[b];
    detail::tie_overwrite_flags(bot, b);
    bot.mem[b] = mod32000(a);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 5;
  }
}

inline void DNAsubstore(VmContext& vm, Bot& bot) {
  vb_long b = vm.ints.pop();
  if (b != 0) {
    b = detail::normaddr(b);
    const vb_long a = bot.mem[b] - vm.ints.pop();
    detail::tie_overwrite_flags(bot, b);
    bot.mem[b] = mod32000(a);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 5;
  }
}

// El operando se normaliza ANTES del producto para evitar overflow
// (DNA.bas:985-989; V-10: 33000 -> 1000).
inline void DNAmultstore(VmContext& vm, Bot& bot) {
  vb_long b = vm.ints.pop();
  if (b != 0) {
    b = detail::normaddr(b);
    vb_long c = vm.ints.pop();
    c = mod32000(c);
    const vb_long a = bot.mem[b] * c;
    detail::tie_overwrite_flags(bot, b);
    bot.mem[b] = mod32000(a);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 5;
  }
}

inline void DNAdivstore(VmContext& vm, Bot& bot) {
  vb_long b = vm.ints.pop();
  const vb_long c = vm.ints.pop();  // ambos pops antes del If (V-10)
  if (b != 0) {
    b = detail::normaddr(b);
    vb_long a = 0;
    if (c != 0)
      a = vb_clng(static_cast<double>(bot.mem[b]) / static_cast<double>(c));
    detail::tie_overwrite_flags(bot, b);
    bot.mem[b] = static_cast<vb_integer>(a);  // sin mod32000 (ya acotado)
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 5;
  }
}

inline void DNAceilstore(VmContext& vm, Bot& bot) {
  vb_long b = vm.ints.pop();
  const vb_long c = vm.ints.pop();
  if (b != 0) {
    b = detail::normaddr(b);
    const vb_long a = (bot.mem[b] > c) ? c : bot.mem[b];
    detail::tie_overwrite_flags(bot, b);
    bot.mem[b] = mod32000(a);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 5;
  }
}

inline void DNAfloorstore(VmContext& vm, Bot& bot) {
  vb_long b = vm.ints.pop();
  const vb_long c = vm.ints.pop();
  if (b != 0) {
    b = detail::normaddr(b);
    const vb_long a = (bot.mem[b] < c) ? c : bot.mem[b];
    detail::tie_overwrite_flags(bot, b);
    bot.mem[b] = mod32000(a);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 5;
  }
}

// Consume 1 extracción de RNG (Q01; DNA.bas:1092-1102).
inline void DNArndstore(VmContext& vm, Bot& bot) {
  vb_long a = vm.ints.pop();
  if (a != 0) {
    a = detail::normaddr(a);
    const vb_integer m = bot.mem[a];
    const vb_long b =
        Random(0, (m < 0 ? -m : m), *vm.rndy) * vb_sgn(static_cast<vb_long>(m));
    bot.mem[a] = static_cast<vb_integer>(b);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 7;
  }
}

inline void DNAsgnstore(VmContext& vm, Bot& bot) {
  vb_long a = vm.ints.pop();
  if (a != 0) {
    a = detail::normaddr(a);
    bot.mem[a] = static_cast<vb_integer>(vb_sgn(static_cast<vb_long>(bot.mem[a])));
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 7;
  }
}

inline void DNAabsstore(VmContext& vm, Bot& bot) {
  vb_long a = vm.ints.pop();
  if (a != 0) {
    a = detail::normaddr(a);
    const vb_long b = (bot.mem[a] < 0) ? -static_cast<vb_long>(bot.mem[a])
                                       : static_cast<vb_long>(bot.mem[a]);
    bot.mem[a] = static_cast<vb_integer>(b);  // -32768: sitio de error 6, solo
                                              // alcanzable desde saves crudos
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 8;
  }
}

inline void DNAsqrstore(VmContext& vm, Bot& bot) {
  vb_long a = vm.ints.pop();
  if (a != 0) {
    a = detail::normaddr(a);
    vb_long b = 0;
    if (bot.mem[a] > 0)
      b = vb_clng(std::sqrt(static_cast<double>(bot.mem[a])));
    bot.mem[a] = static_cast<vb_integer>(b);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 7;
  }
}

inline void DNAnegstore(VmContext& vm, Bot& bot) {
  vb_long a = vm.ints.pop();
  if (a != 0) {
    a = detail::normaddr(a);
    const vb_long b = -static_cast<vb_long>(bot.mem[a]);
    bot.mem[a] = static_cast<vb_integer>(b);
    bot.nrg -= vm.costs.of(Costs::COSTSTORE) / 8;
  }
}

// Despacho de stores (DNA.bas:858-889). Público: V-10/V-12 lo ejercitan
// directo con la pila precargada.
inline void ExecuteStores(VmContext& vm, Bot& bot, int n) {
  switch (n) {
    case 1: DNAstore(vm, bot); break;
    case 2: DNAinc(vm, bot); break;
    case 3: DNAdec(vm, bot); break;
    case 4: DNAaddstore(vm, bot); break;
    case 5: DNAsubstore(vm, bot); break;
    case 6: DNAmultstore(vm, bot); break;
    case 7: DNAdivstore(vm, bot); break;
    case 8: DNAceilstore(vm, bot); break;
    case 9: DNAfloorstore(vm, bot); break;
    case 10: DNArndstore(vm, bot); break;
    case 11: DNAsgnstore(vm, bot); break;
    case 12: DNAabsstore(vm, bot); break;
    case 13: DNAsqrstore(vm, bot); break;
    case 14: DNAnegstore(vm, bot); break;
    default: break;
  }
}

namespace detail {

// DNA.bas:280-295 — deref (`*`): normaliza SIEMPRE (a diferencia del token
// tipo 1, que solo normaliza fuera de rango).
inline void DNAderef(VmContext& vm, Bot& bot) {
  vb_long b = vm.ints.pop();
  b = normaddr(b);
  vm.ints.push(bot.mem[b]);
}

// DNA.bas:385-397 — findang: ángulo hasta (bx,by) en unidades sysvar (x200).
inline void findang(VmContext& vm, Bot& bot) {
  const vb_single b = static_cast<vb_single>(vm.ints.pop());
  const vb_single a = static_cast<vb_single>(vm.ints.pop());
  const vb_single c = bot.pos.x / vm.xDivisor;
  const vb_single d = bot.pos.y / vm.yDivisor;
  const vb_single e = angnorm(vb_angle(c, d, a, b)) * 200.0f;
  vm.ints.push(vb_clng(static_cast<double>(e)));
}

// DNA.bas:400-415 — finddist: multiplica los argumentos por los divisores
// (asimetría con angle, que divide la posición); saturado a 2e9.
inline void finddist(VmContext& vm, Bot& bot) {
  const vb_single b = static_cast<vb_single>(vm.ints.pop()) * vm.yDivisor;
  const vb_single a = static_cast<vb_single>(vm.ints.pop()) * vm.xDivisor;
  const vb_single c = bot.pos.x;
  const vb_single d = bot.pos.y;
  vb_single e = static_cast<vb_single>(
      std::sqrt(std::pow(static_cast<double>(c - a), 2.0) +
                std::pow(static_cast<double>(d - b), 2.0)));
  if (std::fabs(e) > 2000000000.0f)
    e = static_cast<vb_single>(vb_sgn(e)) * 2000000000.0f;
  vm.ints.push(vb_clng(static_cast<double>(e)));
}

// DNA.bas:181-218
inline void ExecuteBasicCommand(VmContext& vm, Bot& bot, int n) {
  bot.nrg -= vm.costs.of(Costs::BCCMDCOST);
  switch (n) {
    case 1: DNAadd(vm.ints, vm.diag); break;
    case 2: DNASub(vm.ints, vm.diag); break;
    case 3: DNAmult(vm.ints); break;
    case 4: DNAdiv(vm.ints); break;
    case 5: DNArnd(vm.ints, *vm.rndy); break;
    case 6: DNAderef(vm, bot); break;
    case 7: DNAmod(vm.ints); break;
    case 8: DNAsgn(vm.ints); break;
    case 9: DNAabs(vm.ints); break;
    case 10: DNAdup(vm.ints); break;  // sin guarda: vacío apila dos ceros
    case 11: vm.ints.pop(); break;    // drop
    case 12: vm.ints.clear(); break;
    case 13: vm.ints.swap(); break;
    case 14: vm.ints.over(); break;
    default: break;
  }
}

// DNA.bas:329-363 — el coste exime debugint/debugbool (value >= 13).
// at_position es `a`, el indice del token en el ADN (DNA.bas:119): solo lo
// usa la traza dbgstring de debugint/debugbool.
inline void ExecuteAdvancedCommand(VmContext& vm, Bot& bot, int n,
                                   vb_long at_position = 0) {
  if (n < 13) bot.nrg -= vm.costs.of(Costs::ADCMDCOST);
  switch (n) {
    case 1: findang(vm, bot); break;
    case 2: finddist(vm, bot); break;
    case 3: DNAceil(vm.ints); break;
    case 4: DNAfloor(vm.ints); break;
    case 5: DNASqr(vm.ints); break;
    case 6: DNApow(vm.ints); break;
    case 7: DNApyth(vm.ints); break;
    case 8: DNAanglecmp(vm.ints); break;
    case 9: DNAroot(vm.ints); break;
    case 10: DNAlogx(vm.ints); break;
    case 11: DNAsin(vm.ints); break;
    case 12: DNAcos(vm.ints); break;
    case 13: DNAdebugint(vm.ints, &bot.dbgstring, at_position); break;
    case 14: DNAdebugbool(vm.bools, &bot.dbgstring, at_position); break;
    default: break;
  }
}

// DNA.bas:568-592
inline void ExecuteBitwiseCommand(VmContext& vm, Bot& bot, int n) {
  bot.nrg -= vm.costs.of(Costs::BTCMDCOST);
  switch (n) {
    case 1: DNABitwiseCompliment(vm.ints); break;
    case 2: DNABitwiseAND(vm.ints); break;
    case 3: DNABitwiseOR(vm.ints); break;
    case 4: DNABitwiseXOR(vm.ints); break;
    case 5: DNABitwiseINC(vm.ints); break;
    case 6: DNABitwiseDEC(vm.ints); break;
    case 7: DNAnegate(vm.ints); break;
    case 8: DNABitwiseShiftLeft(vm.ints); break;
    case 9: DNABitwiseShiftRight(vm.ints); break;
    default: break;
  }
}

// DNA.bas:696-722
inline void ExecuteConditions(VmContext& vm, Bot& bot, int n) {
  bot.nrg -= vm.costs.of(Costs::CONDCOST);
  switch (n) {
    case 1: DNAless(vm.ints, vm.bools); break;
    case 2: DNAgreater(vm.ints, vm.bools); break;
    case 3: DNAequal(vm.ints, vm.bools); break;
    case 4: DNAnotequal(vm.ints, vm.bools); break;
    case 5: DNAcequa(vm.ints, vm.bools); break;
    case 6: DNAcdiff(vm.ints, vm.bools); break;
    case 7: DNAcustomcequa(vm.ints, vm.bools); break;
    case 8: DNAcustomcdiff(vm.ints, vm.bools); break;
    case 9: DNAgreaterequal(vm.ints, vm.bools); break;
    case 10: DNAlessequal(vm.ints, vm.bools); break;
    default: break;
  }
}

// DNA.bas:798-852
inline void ExecuteLogic(VmContext& vm, Bot& bot, int n) {
  bot.nrg -= vm.costs.of(Costs::LOGICCOST);
  switch (n) {
    case 1: DNAand(vm.bools); break;
    case 2: DNAor(vm.bools); break;
    case 3: DNAxor(vm.bools); break;
    case 4: DNAnot(vm.bools); break;
    case 5: vm.bools.push(true); break;
    case 6: vm.bools.push(false); break;
    case 7: vm.bools.pop(); break;  // dropbool
    case 8: vm.bools.clear(); break;
    case 9: vm.bools.dup(); break;   // no-op sobre vacío (≠ dup entero)
    case 10: vm.bools.swap(); break;
    case 11: vm.bools.over(); break;
    default: break;
  }
}

// DNA.bas:1205-1216 — AND de todo el stack booleano, vaciándolo; vacío = True.
inline bool AddupCond(BoolStack& c) {
  bool r = true;
  int a = c.pop();
  while (a != BOOL_EMPTY) {
    r = r && (a != 0);
    a = c.pop();
  }
  return r;
}

// DNA.bas:1219-1232 — mira el tope SIN consumir (pop + push de vuelta);
// vacío = True. Gobierna todos los stores siguientes del cuerpo (V-03).
inline bool CondStateIsTrue(BoolStack& c) {
  const int a = c.pop();
  if (a == BOOL_EMPTY) return true;
  c.push(a != 0);
  return a != 0;
}

// Estado de flujo de un ExecuteDNA (variables de módulo en el original,
// reseteadas al salir de cada bot — equivalen a locals por invocación).
struct FlowState {
  enum : unsigned char { CLEAR = 0, COND = 1, BODY = 2, ELSEBODY = 3 };
  unsigned char flow = CLEAR;
  bool condflag = true;  // NEXTBODY
  bool ingene = false;
  vb_long currgene = 0;
};

// E6 — `rob(n).ga(currgene) = True` (DNA.bas:152 y :1181). El array se
// dimensiona a genenum y currgene lo cuenta el flujo: si el ADN abre mas
// genes de los que CountGenes vio, el original indexaba fuera de rango
// (error 9 -> truncamiento del tick, 10-CICLO.md §14). Decision de port:
// registrar y no escribir — la traza es observacion, nunca puede cambiar la
// simulacion.
inline void MarkGeneActive(VmContext& vm, Bot& bot, vb_long currgene) {
  if (!vm.gaTrack) return;
  if (currgene < 0 || currgene >= static_cast<vb_long>(bot.ga.size())) {
    vm.diag.err9_ga_index += 1;
    return;
  }
  bot.ga[static_cast<std::size_t>(currgene)] = true;
}

// DNA.bas:1159-1203 — devuelve false si fue `cond` (el llamador cuenta
// condnum). El bug del else canónico (V-01) vive en el paso "Not ingene"
// que fuerza NEXTBODY antes de que el caso else consulte el flag.
inline bool ExecuteFlowCommands(VmContext& vm, Bot& bot, FlowState& f, int n) {
  bot.nrg -= vm.costs.of(Costs::FLOWCOST);
  bool ret = false;
  switch (n) {
    case 1:  // cond
      f.flow = FlowState::COND;
      f.currgene += 1;
      vm.bools.clear();
      f.ingene = true;
      break;
    case 2:
    case 3:
    case 4:
      ret = true;
      if (f.flow == FlowState::COND) f.condflag = AddupCond(vm.bools);
      if (!f.ingene) f.condflag = true;  // NEXTBODY — mata al else tras start
      // DNA.bas:1179-1183 (E6): el cuerpo sin stores tambien cuenta como
      // gen disparado; se lee el flow ANTES del CLEAR de la linea siguiente.
      if (f.condflag &&
          (f.flow == FlowState::ELSEBODY || f.flow == FlowState::BODY))
        MarkGeneActive(vm, bot, f.currgene);
      f.flow = FlowState::CLEAR;
      switch (n) {
        case 2:  // start
          if (!f.ingene) f.currgene += 1;
          f.ingene = false;
          if (f.condflag) f.flow = FlowState::BODY;
          break;
        case 3:  // else
          if (!f.condflag) f.flow = FlowState::ELSEBODY;
          if (!f.ingene) f.currgene += 1;
          f.ingene = false;
          break;
        case 4:  // stop
          f.ingene = false;
          f.flow = FlowState::CLEAR;
          break;
      }
      break;
    default:
      break;  // value fuera de 1-4 (p.ej. el "cross" muerto): no-op, ret=false
  }
  return ret;
}

}  // namespace detail

// DNA.bas:56-175 — un ciclo de ADN de un bot. Los stacks se limpian a la
// entrada; CurrentFlow queda CLEAR al salir (aquí es local, mismo efecto).
inline void ExecuteDNA(VmContext& vm, Bot& bot) {
  using detail::FlowState;
  FlowState f;

  vm.ints.clear();
  vm.bools.clear();
  // E6 — DNA.bas:75-82: el ReDim de ga() solo corre para el bot observado
  // (foco o consola abierta); el resto de los bots ni siquiera lo dimensiona.
  if (vm.gaTrack) {
    bot.ga.assign(static_cast<std::size_t>(bot.genenum) + 1, false);
  }
  bot.condnum = 0;
  bot.dbgstring.clear();  // DNA.bas:86

  const vb_long ub = static_cast<vb_long>(bot.dna.size()) - 1;
  if (ub < 1) {
    // ADN sin tokens ejecutables (archivo solo-defs, V-07): el original leía
    // dna(1) fuera de rango — error 9 y truncamiento de tick cada ciclo.
    // Decisión de port: no-op registrado.
    vm.diag.empty_dna_runs += 1;
    return;
  }

  for (vb_long a = 1; a < ub && a <= 32000 && !is_end(bot.dna[a]); ++a) {
    const Block& t = bot.dna[a];
    switch (t.tipo) {
      case tok::NUMBER:
        if (f.flow != FlowState::CLEAR) {
          vm.ints.push(t.value);
          bot.nrg -= vm.costs.of(Costs::NUMCOST);
        }
        break;
      case tok::DEREF:
        if (f.flow != FlowState::CLEAR) {
          vb_long b = t.value;
          if (b > MaxMem || b < 1) {
            b = (t.value < 0 ? -static_cast<vb_long>(t.value)
                             : static_cast<vb_long>(t.value)) %
                MaxMem;
            if (b == 0) b = 1000;
          }
          vm.ints.push(bot.mem[b]);
          bot.nrg -= vm.costs.of(Costs::DOTNUMCOST);
        }
        break;
      case tok::BASIC:
        if (f.flow != FlowState::CLEAR)
          detail::ExecuteBasicCommand(vm, bot, t.value);
        break;
      case tok::ADVANCED:
        if (f.flow != FlowState::CLEAR)
          detail::ExecuteAdvancedCommand(vm, bot, t.value, a);
        break;
      case tok::BITWISE:
        if (f.flow != FlowState::CLEAR)
          detail::ExecuteBitwiseCommand(vm, bot, t.value);
        break;
      case tok::CONDITION:
        if (f.flow != FlowState::CLEAR)  // COND, body o ELSEBODY
          detail::ExecuteConditions(vm, bot, t.value);
        break;
      case tok::LOGIC:
        if (f.flow != FlowState::CLEAR)
          detail::ExecuteLogic(vm, bot, t.value);
        break;
      case tok::STORE:
        if (f.flow == FlowState::BODY || f.flow == FlowState::ELSEBODY) {
          if (detail::CondStateIsTrue(vm.bools)) {
            ExecuteStores(vm, bot, t.value);
            detail::MarkGeneActive(vm, bot, f.currgene);  // DNA.bas:152 (E6)
          }
        }
        break;
      case tok::RESERVED:
        break;
      case tok::FLOW:
        if (!detail::ExecuteFlowCommands(vm, bot, f, t.value))
          bot.condnum += 1;
        bot.mem[thisgene] = static_cast<vb_integer>(f.currgene);
        break;
      case tok::MASTER:
        break;  // value != 1 es no-op (V-14); value == 1 corta el bucle
      default:
        break;
    }
  }
}

}  // namespace db
