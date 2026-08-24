// Casos dorados R-01..R-03 (70-CASOS-DORADOS.md §6): el LCG de VB6 y gasdev.
#include "doctest.h"
#include "dbcore/rng.hpp"

using namespace db;

TEST_CASE("R-01 LCG de VB6: primeras 6 extracciones desde proceso fresco") {
  VbRng r;
  const std::uint32_t states[6] = {0xB49EC3, 0x888E7A, 0x945B55,
                                   0x4A20C4, 0x4D4C77, 0xC6555E};
  const double values[6] = {0.7055475,  0.53342402, 0.57951862,
                            0.28956246, 0.30194801, 0.7747401};
  for (int i = 0; i < 6; ++i) {
    const vb_single v = r();
    CHECK(r.state() == states[i]);
    CHECK(v == doctest::Approx(values[i]).epsilon(1e-7));
    // El retorno es exactamente CSng(seed)/2^24.
    CHECK(v == static_cast<vb_single>(states[i]) / 16777216.0f);
  }
}

TEST_CASE("R-01 Rnd(0) repite el ultimo valor sin avanzar") {
  VbRng r;
  const vb_single v = r();
  CHECK(r.rnd0() == v);
  CHECK(r.rnd0() == v);
  const std::uint32_t s = r.state();
  CHECK(r.state() == s);
}

TEST_CASE("R-01 Randomize 12.34 sobre proceso fresco => estado 0xEE3C00") {
  VbRng r;
  r.randomize(12.34);
  CHECK(r.state() == 0xEE3C00);
  CHECK(r() == doctest::Approx(0.90983218).epsilon(1e-7));
  CHECK(r() == doctest::Approx(0.10807002).epsilon(1e-7));
  CHECK(r() == doctest::Approx(0.29308063).epsilon(1e-7));
}

TEST_CASE("R-02 gasdev: par de extracciones, cache y re-tirada") {
  Gasdev g;

  SUBCASE("par valido y cache sin RNG") {
    InjectedRnd rnd({0.25f, 0.75f});
    const vb_single first = g.next(rnd);
    CHECK(first == doctest::Approx(0.8325546).epsilon(1e-6));
    CHECK(rnd.consumed() == 2);
    // Segunda llamada: cache, sin consumir RNG (la secuencia esta agotada:
    // cualquier extraccion lanzaria).
    const vb_single second = g.next(rnd);
    CHECK(second == doctest::Approx(-0.8325546).epsilon(1e-6));
    CHECK(rnd.consumed() == 2);
    // Tercera llamada: vuelve a consumir 2+.
    InjectedRnd rnd2({0.25f, 0.75f});
    CHECK(g.next(rnd2) == doctest::Approx(0.8325546).epsilon(1e-6));
    CHECK(rnd2.consumed() == 2);
  }

  SUBCASE("rsq >= 1 re-tira el par completo (consumo 2k)") {
    InjectedRnd rnd({0.99f, 0.99f, 0.25f, 0.75f});
    CHECK(g.next(rnd) == doctest::Approx(0.8325546).epsilon(1e-6));
    CHECK(rnd.consumed() == 4);
  }

  SUBCASE("rsq = 0 tambien re-tira") {
    InjectedRnd rnd({0.5f, 0.5f, 0.25f, 0.75f});
    CHECK(g.next(rnd) == doctest::Approx(0.8325546).epsilon(1e-6));
    CHECK(rnd.consumed() == 4);
  }
}
