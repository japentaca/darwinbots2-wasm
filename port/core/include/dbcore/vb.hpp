// dbcore/vb.hpp — tipos y conversiones del runtime VB6.
// Spec: PLAN.md salvaguardas 1-3; 70-CASOS-DORADOS.md §0.4-0.5, N-01.
#pragma once

#include <cstdint>
#include <cmath>

namespace db {

// Tipos VB6 (70-CASOS-DORADOS.md §0.5): mem() es Integer (16 bits),
// los stacks son Long, la física es Single.
using vb_integer = std::int16_t;
using vb_long    = std::int32_t;
using vb_single  = float;
using vb_double  = double;

// Common.bas:19 — Public Const PI As Single = 3.14159265
inline constexpr vb_single PI = 3.14159265f;

// Redondeo bancario (salvaguarda 3 de PLAN.md): la conversión VB6 float->entero
// (CLng/CInt/asignación a campo entero) redondea al par más cercano.
// std::llrint usa el modo de redondeo FP por defecto (nearest-even) — no se
// cambia el modo en ningún punto del port.
inline std::int64_t vb_round64(double v) { return std::llrint(v); }

// CLng con el rango garantizado por el llamador. Los sitios donde el original
// podía desbordar (error 6) usan vb_round64 + chequeo explícito de rango
// (decisión de port por sitio, 10-CICLO.md §14).
inline vb_long vb_clng(double v) { return static_cast<vb_long>(vb_round64(v)); }

// Sgn de VB6.
inline int vb_sgn(double v) { return (v > 0.0) - (v < 0.0); }
inline vb_long vb_sgn(vb_long v) { return (v > 0) - (v < 0); }

// Rango de int32 para los chequeos de sitio de error (Q17 / N-07).
inline bool fits_int32(std::int64_t v) {
  return v >= INT32_MIN && v <= INT32_MAX;
}

}  // namespace db
