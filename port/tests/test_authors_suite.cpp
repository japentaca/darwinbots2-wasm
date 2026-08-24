// Casos dorados S-01..S-07 (70-CASOS-DORADOS.md §1): la suite de los autores
// (UnitTests/TestCommon.cls) minada y corregida (S-02) contra Common.bas.
#include "doctest.h"
#include "dbcore/common.hpp"

using namespace db;

namespace {
vb_long random_with(double low, double hi, vb_single v) {
  InjectedRnd rnd({v});
  return Random(low, hi, rnd);
}
}  // namespace

TEST_CASE("S-01 Random: rangos, caso especial y hueco del extremo") {
  // Caso especial hi < low con hi = 0: la extraccion ocurre igualmente.
  {
    InjectedRnd rnd({0.5f});
    CHECK(Random(10, 0, rnd) == 0);
    CHECK(rnd.consumed() == 1);
  }
  CHECK(random_with(0, 6, 0.5f) == 3);
  CHECK(random_with(0, 6, 0.999f) == 6);
  CHECK(random_with(-2, 2, 0.5f) == 0);
  // Con hi < low y hi != 0, el rango alcanzable es [hi+1, low].
  CHECK(random_with(10, 5, 0.5f) == 8);
  CHECK(random_with(10, 5, 0.0f) == 10);
}

TEST_CASE("S-02 fRnd devuelve up+1 con rndy alto (hallazgo de la suite)") {
  {
    InjectedRnd rnd({0.97f});
    // Fuera del rango [10, 20] que asertaba el test de los autores.
    CHECK(fRnd(10, 20, rnd) == 21);
  }
  {
    InjectedRnd rnd({0.5f});
    // 0.5*11 + 10 = 15.5 -> bancario 16.
    CHECK(fRnd(10, 20, rnd) == 16);
  }
}

TEST_CASE("S-03 Vectores: Dot/Cross/VectorAdd/VectorSub") {
  const Vector p{10.4f, 20.67f}, q{5.98f, 3.25f};
  const Vector m{-100.0f, -20.7f}, n{-5.3f, -3.6f};
  const Vector u{10.1f, 20.987f}, w{-5.567f, -3.6431f};

  CHECK(Dot(p, q) == doctest::Approx(129.36949).epsilon(1e-6));
  CHECK(Dot(m, n) == doctest::Approx(604.52).epsilon(1e-6));
  CHECK(Dot(u, w) == doctest::Approx(-132.68445).epsilon(1e-6));
  CHECK(Cross(p, q) == doctest::Approx(-89.80659).epsilon(1e-6));
  CHECK(Cross(m, n) == doctest::Approx(250.29).epsilon(1e-6));
  CHECK(Cross(u, w) == doctest::Approx(80.039314).epsilon(1e-6));

  const Vector add = VectorAdd(p, q);
  CHECK(add.x == doctest::Approx(16.38).epsilon(1e-6));
  CHECK(add.y == doctest::Approx(23.92).epsilon(1e-6));
  const Vector sub = VectorSub(p, q);
  CHECK(sub.x == doctest::Approx(4.42).epsilon(1e-6));
  CHECK(sub.y == doctest::Approx(17.42).epsilon(1e-6));
}

TEST_CASE("S-04 Gauss: clamps de media y resultado") {
  // Cada fila: gasdev fresco + rndy -> [0.25, 0.75] (=> gasdev = +0.8325546).
  {
    Gasdev g;
    InjectedRnd rnd({0.25f, 0.75f});
    CHECK(Gauss(g, rnd, 45.34f, 1000000.0f) == 32000.0f);  // doble clamp
  }
  {
    Gasdev g;
    InjectedRnd rnd({0.25f, 0.75f});
    CHECK(Gauss(g, rnd, 45.34f, -1000000.0f) ==
          doctest::Approx(-31962.25).epsilon(1e-6));
  }
  {
    Gasdev g;
    InjectedRnd rnd({0.25f, 0.75f});
    CHECK(Gauss(g, rnd, 10.0f, 100.0f) ==
          doctest::Approx(108.325546).epsilon(1e-6));
  }
  {
    // |StdDev| < 1e-7 y != 0: la desviacion se IGNORA.
    Gasdev g;
    InjectedRnd rnd({0.25f, 0.75f});
    CHECK(Gauss(g, rnd, 0.00000005f, 100.0f) ==
          doctest::Approx(100.8325546).epsilon(1e-6));
  }
  {
    // |StdDev| > 32000: mismo camino.
    Gasdev g;
    InjectedRnd rnd({0.25f, 0.75f});
    CHECK(Gauss(g, rnd, 50000.0f, 100.0f) ==
          doctest::Approx(100.8325546).epsilon(1e-6));
  }
  {
    // StdDev = 0 no entra en la guarda: consume las 2 extracciones igualmente.
    Gasdev g;
    InjectedRnd rnd({0.25f, 0.75f});
    CHECK(Gauss(g, rnd, 0.0f, 100.0f) == 100.0f);
    CHECK(rnd.consumed() == 2);
  }
}

TEST_CASE("S-05 nextlowestmultof2 (+ decision de port del sitio de error 6)") {
  CHECK(nextlowestmultof2(0) == 1);
  CHECK(nextlowestmultof2(1) == 1);
  CHECK(nextlowestmultof2(2) == 2);
  CHECK(nextlowestmultof2(512) == 512);
  CHECK(nextlowestmultof2(513) == 512);
  CHECK(nextlowestmultof2(1023) == 512);
  CHECK(nextlowestmultof2(-512) == 1);
  CHECK(nextlowestmultof2(-513) == 1);
  CHECK(nextlowestmultof2(-1023) == 1);
  // value >= 16384: el original desbordaba Integer (error 6); decision de
  // port S-05: resultado saturado 16384.
  CHECK(nextlowestmultof2(16384) == 16384);
  CHECK(nextlowestmultof2(32767) == 16384);
  CHECK(nextlowestmultof2(16383) == 8192);
}

TEST_CASE("S-06 Max/Min de Single") {
  CHECK(Max(0.0005f, 0.0001f) == 0.0005f);
  CHECK(Max(-0.0005f, 0.0001f) == 0.0001f);
  CHECK(Max(2000.0f, 2000.0f) == 2000.0f);
  CHECK(Min(0.0005f, 0.0001f) == 0.0001f);
  CHECK(Min(-0.0005f, 0.0001f) == -0.0005f);
  CHECK(Min(2000.0f, 2000.0f) == 2000.0f);
}

TEST_CASE("S-07 rndy es Rnd con UseIntRnd = False") {
  // rndy() == Rnd a secas: la interfaz RndSource sobre VbRng ES rndy; hereda
  // los casos de R-01. El modo UseIntRnd = True queda fuera del port (Q02).
  VbRng r;
  RndSource& rndy = r;
  CHECK(rndy() == doctest::Approx(0.7055475).epsilon(1e-7));
}
