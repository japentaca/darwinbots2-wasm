// Casos dorados R-01..R-03 y R-05..R-07 (70-CASOS-DORADOS.md §6): el LCG de
// VB6, gasdev y el consumo de RNG de shots/ties (M4: sus rutinas quedaron
// completas).
#include "doctest.h"
#include "dbcore/master.hpp"
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

namespace {

// Bot mínimo para los casos R de subsistemas (sin consumo de RNG propio).
int rng_addbot(Sim& sim, float x, float y, float radius) {
  const int n = posto(sim);
  Bot& b = sim.rob[n];
  b.exist = true;
  b.FName = "R.txt";
  b.pos = {x, y};
  b.aim = 0.0f;
  b.aimvector = {1.0f, 0.0f};
  b.radius = radius;
  b.mass = 1.0f;
  b.nrg = 10000.0f;
  b.body = 1000.0f;
  b.BucketPos = {-2.0f, -2.0f};
  UpdateBotBucket(sim, n);
  return n;
}

}  // namespace

TEST_CASE("R-05 newshot: dos extracciones, una muerta [PROBABLE BUG] B3-4") {
  SUBCASE("rndy [0.9, 0.5]: jitter 0, el shot sale en la direccion del aim") {
    Sim sim;
    InjectedRnd rng({0.9f, 0.5f});
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
    const int n = rng_addbot(sim, 1000, 1000, 100.0f);

    const vb_long a = newshot(sim, n, -4, 10.0f, 1.0f);

    // ran = Random(-2,2) = 2 se calcula y DESCARTA; el jitter real es
    // Random(-20,20)/200 = 0.
    CHECK(rng.consumed() == 2);
    CHECK(rng.exhausted());
    CHECK(sim.Shots[a].velocity.x == doctest::Approx(40.0));
    CHECK(sim.Shots[a].velocity.y == doctest::Approx(0.0));
    CHECK(sim.Shots[a].pos.x == doctest::Approx(1100.0));  // perimetro
    CHECK(sim.Shots[a].pos.y == doctest::Approx(1000.0));
  }
  SUBCASE("rndy [0.9, 0.9]: jitter = 16/200 = 0.08 rad") {
    Sim sim;
    InjectedRnd rng({0.9f, 0.9f});
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
    const int n = rng_addbot(sim, 1000, 1000, 100.0f);

    const vb_long a = newshot(sim, n, -4, 10.0f, 1.0f);

    CHECK(rng.consumed() == 2);
    CHECK(sim.Shots[a].velocity.x ==
          doctest::Approx(40.0 * std::cos(0.08)).epsilon(1e-5));
    CHECK(sim.Shots[a].velocity.y ==
          doctest::Approx(-40.0 * std::sin(0.08)).epsilon(1e-5));
  }
}

TEST_CASE("R-06 Vshoot: doble cobro y direccion aleatoria [PROBABLE BUG] B3b-1") {
  Sim sim;
  InjectedRnd rng({0.5f});
  sim.rndy = &rng;
  sim.vm.rndy = &rng;
  const int n = rng_addbot(sim, 1000, 1000, 100.0f);
  REQUIRE(LoadDNAText("stop", sim.rob[n], *sim.sysvars));

  sim.vm.costs.v[cost::SHOTCOST] = 2.0f;
  sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.0f;

  // Virus incubado en el slot 5, listo para disparar este ciclo.
  sim.Shots[5].exist = true;
  sim.Shots[5].stored = true;
  sim.Shots[5].shottype = -7;
  sim.Shots[5].parent = static_cast<vb_integer>(n);  // dueño vivo: la
                                                     // compactacion re-apunta
  sim.rob[n].virusshot = 5;
  sim.rob[n].Vtimer = 1;
  sim.rob[n].mem[addr::VshootSys] = 50;

  UpdateSim(sim);

  Bot& b = sim.rob[n];
  // La compactacion del paso 14 (ocupacion < 70%) movio el shot almacenado
  // al slot 1 re-apuntando rob().virusshot (Shots.bas:436) — Vshoot lo
  // dispara desde ahi en P3.
  Shot& sh = sim.Shots[1];
  // Cargo 1: tempa/20 = 50 + SHOTCOST; cargo 2: mem(vshoot) = 50 + SHOTCOST
  // (el precio es doble): 10000 - 104 = 9896.
  CHECK(b.nrg == doctest::Approx(9896.0));
  CHECK(sh.nrg == 1000.0f);          // 50*20
  CHECK(sh.Range == 36.0f);          // 11 + CInt(50/2)
  CHECK(!sh.stored);
  // Direccion: Random(1,1256)/200 = 629/200 = 3.145 rad — ignora el aim.
  CHECK(rng.consumed() == 1);
  CHECK(rng.exhausted());
  CHECK(sh.velocity.x ==
        doctest::Approx(std::cos(3.145) * 40.0).epsilon(1e-4));
  // Resets.
  CHECK(b.mem[addr::VshootSys] == 0);
  CHECK(b.mem[addr::Vtimer] == 0);
  CHECK(b.mem[addr::mkvirus] == 0);
  CHECK(b.Vtimer == 0);
  CHECK(b.virusshot == 0);
}

TEST_CASE("R-07 maketie: deflect por slime, 1 extraccion por intento") {
  Sim sim;
  VbRng dummy;  // se reemplaza por la inyectada en cada subcaso
  sim.rndy = &dummy;
  sim.vm.rndy = &dummy;
  const int a = rng_addbot(sim, 1000, 1000, 100.0f);
  const int b = rng_addbot(sim, 1100, 1000, 100.0f);
  sim.rob[b].Slime = 50.0f;
  sim.vm.costs.v[cost::TIECOST] = 2.0f;
  sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.0f;

  SUBCASE("deflect = 2 < slime 50: no hay tie, pero se cobra igual") {
    InjectedRnd rng({0.0f});
    sim.rndy = &rng;
    CHECK(!maketie(sim, a, b, 300, -20, 330));
    CHECK(rng.consumed() == 1);
    CHECK(sim.rob[a].numties == 0.0f);
    CHECK(sim.rob[b].Slime == 30.0f);                    // -20
    CHECK(sim.rob[a].nrg == doctest::Approx(9998.0));    // TIECOST/(0+1)
  }
  SUBCASE("deflect = 92 >= slime 50: tie creada") {
    InjectedRnd rng({0.99f});
    sim.rndy = &rng;
    CHECK(maketie(sim, a, b, 300, -20, 330));
    CHECK(rng.consumed() == 1);
    CHECK(sim.rob[a].Ties[1].pnt == b);
    CHECK(sim.rob[a].Ties[1].last == -20);
    CHECK(sim.rob[a].Ties[1].Port == 330);
    CHECK(sim.rob[b].Ties[1].Port == 1);                 // su nº de slot
    CHECK(sim.rob[b].Slime == 30.0f);
    CHECK(sim.rob[a].nrg == doctest::Approx(9999.0));    // TIECOST/(1+1)
  }
}
