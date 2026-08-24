// dbcore/common.hpp — port de Common.bas (utilidades del motor).
// Casos dorados: S-01..S-07 (suite de los autores), R-03 (Gauss determinista).
#pragma once

#include <cmath>

#include "rng.hpp"
#include "vb.hpp"

namespace db {

struct Vector {
  vb_single x = 0;
  vb_single y = 0;
};

// Common.bas:98-123 — todo Single.
inline vb_single Dot(const Vector& v1, const Vector& v2) {
  return v1.x * v2.x + v1.y * v2.y;
}
inline vb_single Cross(const Vector& v1, const Vector& v2) {
  return v1.x * v2.y - v1.y * v2.x;
}
inline Vector VectorAdd(const Vector& v1, const Vector& v2) {
  return {v1.x + v2.x, v1.y + v2.y};
}
inline Vector VectorSub(const Vector& v1, const Vector& v2) {
  return {v1.x - v2.x, v1.y - v2.y};
}

// Common.bas:193-206 — Max/Min de Single.
inline vb_single Max(vb_single x, vb_single y) { return (x > y) ? x : y; }
inline vb_single Min(vb_single x, vb_single y) { return (x < y) ? x : y; }

// Common.bas:29-36. El original opera en Integer y con value >= 16384 el
// doblado 16384*2 = 32768 desborda (error 6) — S-05, capa torneo. Decisión de
// port (S-05): resultado saturado 16384.
inline vb_long nextlowestmultof2(vb_integer value) {
  std::int32_t a = 1;
  do {
    a *= 2;
    if (a > 32767) return 16384;  // sitio de error 6 del original, saturado
  } while (a <= value);
  return a / 2;
}

// Common.bas:53-56 — Random opera en Variant/Double; Int() trunca hacia -inf.
// La extracción de rndy ocurre ANTES del caso especial (S-01).
inline vb_long Random(double low, double hi, RndSource& rndy) {
  const double v = rndy();
  vb_long result = static_cast<vb_long>(std::floor((hi - low + 1.0) * v + low));
  if (hi < low && hi == 0.0) result = 0;
  return result;
}

// Common.bas:58-60 — fRnd = CLng(rndy*(up-low+1) + low): la aritmética es
// Single (rndy Single x Long -> Single) y el CLng redondea bancario. Puede
// devolver up+1 (S-02, hallazgo: el test de los autores fallaba).
inline vb_long fRnd(vb_long low, vb_long up, RndSource& rndy) {
  const vb_single t =
      rndy() * static_cast<vb_single>(up - low + 1) + static_cast<vb_single>(low);
  return vb_clng(static_cast<double>(t));
}

// Common.bas:62-80 — Gauss(StdDev, Mean): clamps de media (antes) y de
// resultado (después); StdDev degenerada ignora la desviación (S-04).
inline vb_single Gauss(Gasdev& gasdev, RndSource& rndy, vb_single stddev,
                       vb_single mean = 0.0f) {
  if (mean < -32000.0f) mean = -32000.0f;
  if (mean > 32000.0f) mean = 32000.0f;

  vb_single result;
  if ((std::fabs(stddev) < 0.0000001f && stddev != 0.0f) ||
      std::fabs(stddev) > 32000.0f) {
    result = mean + gasdev.next(rndy);
  } else {
    result = gasdev.next(rndy) * stddev + mean;
  }

  if (result > 32000.0f) result = 32000.0f;
  if (result < -32000.0f) result = -32000.0f;
  return result;
}

// Physics.bas:638-648 — diferencia de ángulos en (-PI, PI], todo Single.
inline vb_single AngDiff(vb_single a1, vb_single a2) {
  vb_single r = a1 - a2;
  if (r > PI) r = -(2 * PI - r);
  if (r < -PI) r = r + 2 * PI;
  return r;
}

}  // namespace db
