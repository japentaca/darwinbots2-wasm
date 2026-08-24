// dbcore/dna.hpp — representación tokenizada del ADN (20-VM.md §1) y
// metadatos derivados (§2.6).
#pragma once

#include <vector>

#include "vb.hpp"

namespace db {

// DNA.bas:10-13 — Type block. El índice 0 del array existe (fantasma (0,0)
// que el cargador nunca escribe, salvo el corrimiento de 20-VM.md §2.3); la
// ejecución empieza en el índice 1.
struct Block {
  vb_integer tipo = 0;
  vb_integer value = 0;
  bool operator==(const Block&) const = default;
};

// Categorías de token (20-VM.md §1).
namespace tok {
inline constexpr int NUMBER = 0;    // número literal
inline constexpr int DEREF = 1;     // *número
inline constexpr int BASIC = 2;     // add..over (1-14)
inline constexpr int ADVANCED = 3;  // angle..debugbool (1-14)
inline constexpr int BITWISE = 4;   // ~..>> (1-9)
inline constexpr int CONDITION = 5; // <..<= (1-10)
inline constexpr int LOGIC = 6;     // and..overbool (1-11)
inline constexpr int STORE = 7;     // store..negstore (1-14)
inline constexpr int RESERVED = 8;  // no-op
inline constexpr int FLOW = 9;      // cond/start/else/stop (1-4)
inline constexpr int MASTER = 10;   // end (1); otros values: no-op
}  // namespace tok

// Direcciones de memoria publicadas por el motor (Robots.bas:57-62).
inline constexpr int MaxMem = 1000;     // main.frm:384, Robots.bas:376
inline constexpr int DnaLenSys = 336;
inline constexpr int GenesSys = 339;
inline constexpr int thisgene = 341;

inline bool is_end(const Block& b) { return b.tipo == 10 && b.value == 1; }

// Module1.bas:64-73 — índice del primer `end` (base 1), tope 32001 y UBound.
// Guarda del port: sobre el ADN de un archivo solo-defs (array = [end], V-07)
// el original leía dna(1) fuera de rango (error 9); aquí devuelve 1.
inline vb_long DnaLen(const std::vector<Block>& dna) {
  const vb_long ub = static_cast<vb_long>(dna.size()) - 1;
  vb_long len = 1;
  while (len < ub && len <= 32000 && !is_end(dna[len])) len += 1;
  return len;
}

// Module1.bas:294-323 — cada `cond` es un gen; cada `start`/`else` que no
// sigue a un cond es un gen; `stop` cierra. Misma numeración que currgene
// (20-VM.md §5.6).
inline vb_long CountGenes(const std::vector<Block>& dna) {
  const vb_long ub = static_cast<vb_long>(dna.size()) - 1;
  vb_long genes = 0;
  bool ingene = false;
  for (vb_long i = 1; i <= 32000 && i <= ub; ++i) {
    const Block& b = dna[i];
    if (is_end(b)) break;
    if (b.tipo == tok::FLOW && (b.value == 2 || b.value == 3)) {
      if (!ingene) genes += 1;
      ingene = false;
    }
    if (b.tipo == tok::FLOW && b.value == 1) {
      ingene = true;
      genes += 1;
    }
    if (b.tipo == tok::FLOW && b.value == 4) ingene = false;
  }
  return genes;
}

}  // namespace db
