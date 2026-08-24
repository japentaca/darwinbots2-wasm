// dbcore/bitwise.hpp — port de Bitwise.bas (complemento a dos de 32 bits con
// la excepción del patrón 0x80000000). Casos dorados N-18.
#pragma once

#include <cstdint>

#include "vb.hpp"

namespace db {

// El DoubleWord del original (32 Booleanos) se representa como uint32_t; los
// algoritmos bit a bit de Bitwise.bas equivalen a estas operaciones enteras.
using DoubleWord = std::uint32_t;

// Bitwise.bas:17-41 — magnitud en bits 0..30, negativos por invertir+1.
// El resultado es el patrón complemento a dos del valor. Nota: con
// value = -2^31 el original haría -value con error 6; ese valor es
// inalcanzable en juego (N-18: BitToNumber nunca lo produce).
inline DoubleWord NumberToBit(vb_long value) {
  return static_cast<DoubleWord>(value);
}

// Bitwise.bas:44-64 — si bit31: resta 1, invierte; después suma SOLO los bits
// 0..30. El patrón 0x80000000 decodifica a 0 y -2^31 es irrepresentable.
inline vb_long BitToNumber(DoubleWord bits) {
  bool negative = false;
  if (bits & 0x80000000u) {
    negative = true;
    bits -= 1;   // DecBits
    bits = ~bits;  // InvertBits
  }
  vb_long result = static_cast<vb_long>(bits & 0x7FFFFFFFu);  // bits 0..30
  return negative ? -result : result;
}

// Bitwise.bas:66-72
inline DoubleWord InvertBits(DoubleWord bits) { return ~bits; }
// Bitwise.bas:75-87 — acarreo hasta desbordar en silencio (wrap uint32).
inline DoubleWord IncBits(DoubleWord bits) { return bits + 1; }
// Bitwise.bas:90-102 — préstamo hasta el bit 31 (wrap uint32).
inline DoubleWord DecBits(DoubleWord bits) { return bits - 1; }
// Bitwise.bas:105-113 — shift lógico a la izquierda.
inline DoubleWord BitShiftLeft(DoubleWord bits) { return bits << 1; }
// Bitwise.bas:116-127 — aritmético: el bit 31 se conserva Y se copia.
inline DoubleWord BitShiftRight(DoubleWord bits) {
  return (bits >> 1) | (bits & 0x80000000u);
}

}  // namespace db
