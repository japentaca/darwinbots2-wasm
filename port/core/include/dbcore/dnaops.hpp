// dbcore/dnaops.hpp — handlers numéricos, de comparación y lógicos de la VM
// (DNA.bas:181-323, 329-561, 700-840; Bitwise via DNA.bas:562-660).
// Semántica exacta en 20-VM.md §6 y opcodes.yaml; casos dorados N-02..N-19.
#pragma once

#include <cmath>
#include <cstdio>
#include <string>

#include "bitwise.hpp"
#include "common.hpp"
#include "stacks.hpp"
#include "vb.hpp"

namespace db {

// Diagnóstico de divergencias con el original (sitios de error 6/9/11 que en
// el EXE truncaban el tick, 10-CICLO.md §14; el port define comportamiento
// explícito y registra la divergencia).
struct VmDiag {
  int q17_saturations = 0;  // add/sub con operando ~2^31 (N-07)
  int empty_dna_runs = 0;   // ExecuteDNA sobre ADN solo-defs (V-07: el
                            // original truncaba el tick con error 9)
  int err9_ga_index = 0;    // E6: ga(currgene) con currgene > genenum (el
                            // original desbordaba el ReDim de DNA.bas:77)
};

namespace detail {
// El "a Mod 2000000000" de DNAadd/DNASub: el operando Single se convierte a
// Long (bancario). Si desborda int32, el original lanzaba error 6 (Q17);
// decisión de port (20-VM.md §6.1, N-07): saturar el RESULTADO del operador a
// Sgn*2e9 y registrar. Devuelve true si hubo divergencia.
inline bool mod2e9_operand(vb_single v, vb_single& out, VmDiag& diag) {
  const std::int64_t i = vb_round64(static_cast<double>(v));
  if (!fits_int32(i)) {
    diag.q17_saturations += 1;
    return true;
  }
  out = static_cast<vb_single>(i % 2000000000);
  return false;
}
}  // namespace detail

// DNA.bas:220-234 — add: pops a Single (pérdida de precisión sobre 2^24),
// Mod 2e9 por operando, suma en Double, envuelve (no satura) en +-2e9.
inline void DNAadd(IntStack& s, VmDiag& diag) {
  vb_single b = static_cast<vb_single>(s.pop());
  vb_single a = static_cast<vb_single>(s.pop());
  if (detail::mod2e9_operand(a, a, diag)) {
    s.push(vb_sgn(a) * 2000000000);
    return;
  }
  if (detail::mod2e9_operand(b, b, diag)) {
    s.push(vb_sgn(b) * 2000000000);
    return;
  }
  double c = static_cast<double>(a) + static_cast<double>(b);
  if (std::fabs(c) > 2000000000.0) c = c - vb_sgn(c) * 2000000000.0;
  s.push(vb_clng(c));
}

// DNA.bas:236-251 — sub: idéntico, a - b.
inline void DNASub(IntStack& s, VmDiag& diag) {
  vb_single b = static_cast<vb_single>(s.pop());
  vb_single a = static_cast<vb_single>(s.pop());
  if (detail::mod2e9_operand(a, a, diag)) {
    s.push(vb_sgn(a) * 2000000000);
    return;
  }
  if (detail::mod2e9_operand(b, b, diag)) {
    s.push(vb_sgn(-b) * 2000000000);
    return;
  }
  double c = static_cast<double>(a) - static_cast<double>(b);
  if (std::fabs(c) > 2000000000.0) c = c - vb_sgn(c) * 2000000000.0;
  s.push(vb_clng(c));
}

// DNA.bas:253-262 — mult: pops a Long, producto en Double, SATURA en +-2e9.
inline void DNAmult(IntStack& s) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  double c = static_cast<double>(a) * static_cast<double>(b);
  if (std::fabs(c) > 2000000000.0) c = vb_sgn(c) * 2000000000.0;
  s.push(vb_clng(c));
}

// DNA.bas:264-274 — div: b=0 -> 0; división REAL con redondeo bancario.
inline void DNAdiv(IntStack& s) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  if (b != 0) {
    s.push(vb_clng(static_cast<double>(a) / static_cast<double>(b)));
  } else {
    s.push(0);
  }
}

// DNA.bas:297-307 — mod: b=0 consume a y push 0; si no, truncado con el
// signo del dividendo (el % de C++ coincide con el Mod de VB6).
inline void DNAmod(IntStack& s) {
  const vb_long b = s.pop();
  if (b == 0) {
    s.pop();
    s.push(0);
  } else {
    s.push(s.pop() % b);
  }
}

// DNA.bas:276-278 — rnd: pop n -> push Random(0, n). Consume 1 extracción.
inline void DNArnd(IntStack& s, RndSource& rndy) {
  const vb_long n = s.pop();
  s.push(Random(0.0, static_cast<double>(n), rndy));
}

// DNA.bas:309-311
inline void DNAsgn(IntStack& s) { s.push(vb_sgn(s.pop())); }

// DNA.bas:313-315 — Abs de Long (con -2^31 el original daría error 6;
// inalcanzable: ningún camino produce -2^31 en la pila, N-18).
inline void DNAabs(IntStack& s) {
  const vb_long a = s.pop();
  s.push(a < 0 ? -a : a);
}

// DNA.bas:317-323 — dup de la VM: pop + push*2 SIN guarda; sobre vacío apila
// dos ceros (N-16; no usa DupIntStack de Module1).
inline void DNAdup(IntStack& s) {
  const vb_long b = s.pop();
  s.push(b);
  s.push(b);
}

// DNA.bas:419-427 — ceil (= mínimo): compara en Single.
inline void DNAceil(IntStack& s) {
  const vb_single b = static_cast<vb_single>(s.pop());
  const vb_single a = static_cast<vb_single>(s.pop());
  s.push(vb_clng(static_cast<double>((a > b) ? b : a)));
}

// DNA.bas:430-438 — floor (= máximo): compara en Long (asimetría, N-13).
inline void DNAfloor(IntStack& s) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  s.push((a < b) ? b : a);
}

// DNA.bas:441-453 — sqr: a > 0 -> Sqr(a); si no 0.
inline void DNASqr(IntStack& s) {
  const vb_single a = static_cast<vb_single>(s.pop());
  vb_single b = 0;
  if (a > 0) b = static_cast<vb_single>(std::sqrt(static_cast<double>(a)));
  s.push(vb_clng(static_cast<double>(b)));
}

// DNA.bas:455-462 — sin: Sin(a/200)*32000, sin normalizar el argumento.
inline void DNAsin(IntStack& s) {
  const vb_single a = static_cast<vb_single>(s.pop());
  const vb_single b = static_cast<vb_single>(
      std::sin(static_cast<double>(a / 200.0f)) * 32000.0);
  s.push(vb_clng(static_cast<double>(b)));
}

// DNA.bas:464-472 — cos.
inline void DNAcos(IntStack& s) {
  const vb_single a = static_cast<vb_single>(s.pop());
  const vb_single b = static_cast<vb_single>(
      std::cos(static_cast<double>(a / 200.0f)) * 32000.0);
  s.push(vb_clng(static_cast<double>(b)));
}

// DNA.bas:476-492 — pow: b saturado a +-10; a=0 -> 0; satura +-2e9.
inline void DNApow(IntStack& s) {
  double b = static_cast<double>(s.pop());
  const double a = static_cast<double>(s.pop());
  if (std::fabs(b) > 10.0) b = 10.0 * vb_sgn(b);
  double c = 0.0;
  if (a != 0.0) c = std::pow(a, b);
  if (std::fabs(c) > 2000000000.0) c = vb_sgn(c) * 2000000000.0;
  s.push(vb_clng(c));
}

// DNA.bas:495-508 — root: absolutos; b=0 -> 0; a^(1/b).
inline void DNAroot(IntStack& s) {
  const double b = std::fabs(static_cast<double>(s.pop()));
  const double a = std::fabs(static_cast<double>(s.pop()));
  double c = 0.0;
  if (b != 0.0) c = std::pow(a, 1.0 / b);
  s.push(vb_clng(c));
}

// DNA.bas:510-523 — logx: absolutos; b<2 o a=0 -> 0; Log(a)/Log(b).
inline void DNAlogx(IntStack& s) {
  const double b = std::fabs(static_cast<double>(s.pop()));
  const double a = std::fabs(static_cast<double>(s.pop()));
  double c = 0.0;
  if (!(b < 2.0 || a == 0.0)) c = std::log(a) / std::log(b);
  s.push(vb_clng(c));
}

// DNA.bas:525-537 — pyth: Sqr(a*a + b*b) todo Single, saturado.
inline void DNApyth(IntStack& s) {
  const vb_single b = static_cast<vb_single>(s.pop());
  const vb_single a = static_cast<vb_single>(s.pop());
  vb_single c = static_cast<vb_single>(
      std::sqrt(static_cast<double>(a * a + b * b)));
  if (std::fabs(c) > 2000000000.0f)
    c = static_cast<vb_single>(vb_sgn(c)) * 2000000000.0f;
  s.push(vb_clng(static_cast<double>(c)));
}

// DNA.bas:365-383 — anglecmp: ambos Mod 1256 llevados a [0,1255];
// AngDiff(a/200, b/200)*200 con coerción a Single en el paso de parámetros.
inline void DNAanglecmp(IntStack& s) {
  std::int64_t b = s.pop();
  std::int64_t a = s.pop();
  b %= 1256;
  if (b < 0) b += 1256;
  a %= 1256;
  if (a < 0) a += 1256;
  const vb_single fa = static_cast<vb_single>(static_cast<double>(a) / 200.0);
  const vb_single fb = static_cast<vb_single>(static_cast<double>(b) / 200.0);
  const double c = static_cast<double>(AngDiff(fa, fb)) * 200.0;
  s.push(vb_clng(c));
}

// ---- Bitwise (DNA.bas:562-660 via Bitwise.bas) ----

inline void DNABitwiseCompliment(IntStack& s) {
  s.push(BitToNumber(InvertBits(NumberToBit(s.pop()))));
}
inline void DNABitwiseAND(IntStack& s) {
  const DoubleWord b = NumberToBit(s.pop());
  const DoubleWord a = NumberToBit(s.pop());
  s.push(BitToNumber(a & b));
}
inline void DNABitwiseOR(IntStack& s) {
  const DoubleWord b = NumberToBit(s.pop());
  const DoubleWord a = NumberToBit(s.pop());
  s.push(BitToNumber(a | b));
}
inline void DNABitwiseXOR(IntStack& s) {
  const DoubleWord b = NumberToBit(s.pop());
  const DoubleWord a = NumberToBit(s.pop());
  s.push(BitToNumber(a ^ b));
}
inline void DNABitwiseINC(IntStack& s) {
  s.push(BitToNumber(IncBits(NumberToBit(s.pop()))));
}
inline void DNABitwiseDEC(IntStack& s) {
  s.push(BitToNumber(DecBits(NumberToBit(s.pop()))));
}
// negate (DNA.bas:585-586): negación Long directa, sin pasar por bits.
inline void DNAnegate(IntStack& s) { s.push(-s.pop()); }
inline void DNABitwiseShiftLeft(IntStack& s) {
  s.push(BitToNumber(BitShiftLeft(NumberToBit(s.pop()))));
}
inline void DNABitwiseShiftRight(IntStack& s) {
  s.push(BitToNumber(BitShiftRight(NumberToBit(s.pop()))));
}

// ---- Comparaciones (DNA.bas:724-792): pop b, pop a, push bool ----

// '<' (DNA.bas:724-726): PushBoolStack (PopIntStack > PopIntStack) = b > a.
inline void DNAless(IntStack& s, BoolStack& c) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  c.push(b > a);
}
// '>' (DNA.bas:728-730)
inline void DNAgreater(IntStack& s, BoolStack& c) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  c.push(b < a);
}
// '=' (DNA.bas:732-734)
inline void DNAequal(IntStack& s, BoolStack& c) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  c.push(b == a);
}
// '!=' (DNA.bas:736-738)
inline void DNAnotequal(IntStack& s, BoolStack& c) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  c.push(b != a);
}
// '>=' (DNA.bas:786-788): PushBoolStack (PopIntStack <= PopIntStack) = b <= a.
inline void DNAgreaterequal(IntStack& s, BoolStack& c) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  c.push(b <= a);
}
// '<=' (DNA.bas:790-792)
inline void DNAlessequal(IntStack& s, BoolStack& c) {
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  c.push(b >= a);
}

// '%=' (DNA.bas:740-747, cequa): c = a/10 en Single; con a<0 ningún b pasa
// (intervalo invertido, N-19).
inline void DNAcequa(IntStack& s, BoolStack& cs) {
  const vb_single b = static_cast<vb_single>(s.pop());
  const vb_single a = static_cast<vb_single>(s.pop());
  const vb_single c = a / 10.0f;
  cs.push((a - c <= b) && (a + c >= b));
}
// '!%=' (DNA.bas:749-757, cdiff): la negación exacta.
inline void DNAcdiff(IntStack& s, BoolStack& cs) {
  const vb_single b = static_cast<vb_single>(s.pop());
  const vb_single a = static_cast<vb_single>(s.pop());
  const vb_single c = a / 10.0f;
  cs.push(!((a + c >= b) && (a - c <= b)));
}
// '~=' (DNA.bas:758-770, customcequa): pila a b d; c = a/100*d en Single.
inline void DNAcustomcequa(IntStack& s, BoolStack& cs) {
  const vb_long d = s.pop();
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  const vb_single c = static_cast<vb_single>(
      static_cast<double>(a) / 100.0 * static_cast<double>(d));
  cs.push((static_cast<vb_single>(a) - c <= static_cast<vb_single>(b)) &&
          (static_cast<vb_single>(a) + c >= static_cast<vb_single>(b)));
}
// '!~=' (DNA.bas:772-784, customcdiff): con saturación de c.
inline void DNAcustomcdiff(IntStack& s, BoolStack& cs) {
  const vb_long d = s.pop();
  const vb_long b = s.pop();
  const vb_long a = s.pop();
  vb_single c = static_cast<vb_single>(
      static_cast<double>(a) / 100.0 * static_cast<double>(d));
  if (std::fabs(c) > 2000000000.0f)
    c = static_cast<vb_single>(vb_sgn(c)) * 2000000000.0f;
  cs.push(!((static_cast<vb_single>(a) + c >= static_cast<vb_single>(b)) &&
            (static_cast<vb_single>(a) - c <= static_cast<vb_single>(b))));
}

// ---- Lógica (DNA.bas:799-840): centinela -5 = "vacío es true" (N-16) ----

inline void DNAand(BoolStack& c) {
  int b = c.pop();
  if (b == BOOL_EMPTY) b = VB_TRUE;
  const int a = c.pop();
  if (a != BOOL_EMPTY) {
    c.push((a & b) != 0);  // And bitwise de VB6 sobre -1/0
  } else {
    c.push(b != 0);
  }
}
inline void DNAor(BoolStack& c) {
  int b = c.pop();
  if (b == BOOL_EMPTY) b = VB_TRUE;
  const int a = c.pop();
  if (a != BOOL_EMPTY) {
    c.push((a | b) != 0);
  } else {
    c.push(true);
  }
}
inline void DNAxor(BoolStack& c) {
  int b = c.pop();
  if (b == BOOL_EMPTY) b = VB_TRUE;
  const int a = c.pop();
  if (a != BOOL_EMPTY) {
    c.push((a ^ b) != 0);
  } else {
    c.push(b == 0);  // Not b
  }
}
inline void DNAnot(BoolStack& c) {
  int b = c.pop();
  if (b == BOOL_EMPTY) b = VB_TRUE;
  c.push(b == 0);  // Not b
}

// E6 — `dbgstring & vbCrLf & a & " at position " & at_position` de
// DNA.bas:545/557. El `&` de VB6 concatena con CStr(): sin espacio inicial
// (a diferencia de Str$), 7 digitos significativos para Single y
// "True"/"False" para Boolean. Misma aproximacion documentada que el CStr
// del tag de eco-IM en formats.hpp (%.7G).
inline std::string vb_cstr_single(vb_single v) {
  char buf[32];
  std::snprintf(buf, sizeof buf, "%.7G", static_cast<double>(v));
  return std::string(buf);
}

// debugbool (DNA.bas:552-561): pop coercionado a Boolean (CBool(-5) = True) y
// re-push. La traza a dbgstring es observacion pura (E6): ningun sistema del
// core la lee.
inline void DNAdebugbool(BoolStack& c, std::string* dbg = nullptr,
                         vb_long at_position = 0) {
  const int a = c.pop();
  const bool b = (a != 0);
  if (dbg)
    *dbg += "\r\n" + std::string(b ? "True" : "False") + " at position " +
            std::to_string(at_position);
  c.push(b);
}

// debugint (DNA.bas:539-550): pop a Single y re-push (bancario).
inline void DNAdebugint(IntStack& s, std::string* dbg = nullptr,
                        vb_long at_position = 0) {
  const vb_single a = static_cast<vb_single>(s.pop());
  if (dbg)
    *dbg += "\r\n" + vb_cstr_single(a) + " at position " +
            std::to_string(at_position);
  s.push(vb_clng(static_cast<double>(a)));
}

// DNA.bas:1078-1090 — mod32000: normalización de escritura a mem(); múltiplos
// no nulos de 32000 -> +-32000 (N-02). Un store solo escribe 0 si el valor
// era exactamente 0.
inline vb_integer mod32000(vb_long a) {
  if (a > 0) {
    a = a % 32000;
    if (a == 0) a = 32000;
  } else if (a < 0) {
    a = a % 32000;
    if (a == 0) a = -32000;
  }
  return static_cast<vb_integer>(a);
}

}  // namespace db
