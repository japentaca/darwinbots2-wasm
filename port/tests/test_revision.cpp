// Revision del port contra el fuente VB6 (spec/REVISION-PORT.md).
// Cada caso afirma el comportamiento del ORIGINAL y reproduce una divergencia
// confirmada del port. Van con doctest::should_fail(): la suite sigue verde
// mientras la divergencia exista; al corregirla el caso pasa a rojo y hay que
// quitar el decorador (y mover el caso a su familia definitiva).
#include "doctest.h"
#include "dbcore/master.hpp"
#include "dbcore/vm.hpp"

using namespace db;

namespace {

bool customcequa(vb_long a, vb_long b, vb_long d) {
  IntStack s;
  BoolStack c;
  s.push(a);
  s.push(b);
  s.push(d);
  DNAcustomcequa(s, c);
  return c.pop() == VB_TRUE;
}

bool customcdiff(vb_long a, vb_long b, vb_long d) {
  IntStack s;
  BoolStack c;
  s.push(a);
  s.push(b);
  s.push(d);
  DNAcustomcdiff(s, c);
  return c.pop() == VB_TRUE;
}

}  // namespace

// RV-01 — DNA.bas:760-769: a, b, d son Long y c es Single. `a - c` es
// Long - Single, que VB6 evalua en Double (regla del operador: Single con
// Long -> Double), y la comparacion con b (Long) tambien es en Double. El
// port convierte a y b a Single y pierde precision sobre 2^24.
TEST_CASE("RV-01 ~= / !~= comparan en Double, no en Single" *
          doctest::should_fail()) {
  // Con d = 0, c = 0: ~= es igualdad exacta. 16777217 no es 16777216.
  CHECK_FALSE(customcequa(16777217, 16777216, 0));
  CHECK(customcdiff(16777217, 16777216, 0));
}

// RV-02 — Common.bas:53-56: `Random(low, hi)` tiene parametros Variant y el
// tipo de `(hi - low + 1) * rndy + low` depende del subtipo que llega:
// Integer * Single -> Single, Long * Single -> Double. En DNArndstore
// (DNA.bas:1098) hi = Abs(mem(a)) es Integer, asi que el original calcula en
// Single; el port siempre en double.
// r = 855638 / 2^24 (estado alcanzable: el LCG recorre los 2^24 estados).
TEST_CASE("RV-02 rndstore: Random con hi Integer calcula en Single" *
          doctest::should_fail()) {
  const vb_single r = 855638.0f / 16777216.0f;
  // Original: Single(1000 * r) = 51.0 exacto tras redondear -> Int = 51.
  // Port: 1000 * r en double = 50.99999... -> 50.
  InjectedRnd inj({r});
  VmContext vm;
  vm.rndy = &inj;
  Bot bot;
  bot.mem[50] = 999;
  vm.ints.push(50);
  ExecuteStores(vm, bot, 10);  // rndstore
  CHECK(bot.mem[50] == 51);
}

// RV-02b — la misma regla en las llamadas con literales Integer del resto del
// motor (Random(1, 1000) de Vloc/Ploc en Shots.bas:807/852, Ties.bas:399...;
// Random(0, 99) de NeoMutations.bas:703; etc.). Aqui la suma `+ low` tambien
// es Single.
TEST_CASE("RV-02b Random(1, 1000) con literales Integer calcula en Single" *
          doctest::should_fail()) {
  InjectedRnd inj({855638.0f / 16777216.0f});
  CHECK(Random(1, 1000, inj) == 52);  // original 52; el port devuelve 51
}

// ---------------------------------------------------------------------------
// Piloto 4 — Fisica (Physics.bas, Common.bas vectores, SetAimFunc/ReSpawn).

namespace {

struct RvWorld {
  Sim sim;
  VbRng rng;

  RvWorld() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
  }

  int addbot(float x, float y, float radius = 60.0f) {
    const int n = posto(sim);
    Bot& b = sim.rob[n];
    b.exist = true;
    b.FName = "T.txt";
    b.pos = {x, y};
    b.aim = 0.0f;
    b.aimvector = {1.0f, 0.0f};
    b.radius = radius;
    b.mass = 1.0f;
    b.BucketPos = {-2.0f, -2.0f};
    UpdateBotBucket(sim, n);
    return n;
  }
};

}  // namespace

// RV-05 — Common.bas:155: `maxVal * Sqr(1 + (minVal / maxVal) ^ 2)`. Sqr
// devuelve Double, asi que Single * Double se evalua en Double y se redondea
// UNA vez al asignar a Single. El port redondea Sqr a float y multiplica en
// float (doble redondeo). Difiere en ~31 % de los vectores de velocidad.
TEST_CASE("RV-05 VectorMagnitude multiplica por Sqr en Double") {
  const Vector v{23.5094757f, -8.68048954f};
  CHECK(VectorMagnitude(v) == 25.0608521f);  // antes del arreglo: 25.060854
}

// RV-05b — Physics.bas:116: `Cos(RandomAngle) * Impulse` es Double * Single
// -> Double, redondeado una vez al pasar a VectorSet (ByVal Single). El port
// redondea Cos a float antes de multiplicar.
TEST_CASE("RV-05b BrownianForces: Cos(angulo) * Impulse en Double") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  InjectedRnd inj({8000000.0f / 16777216.0f, 3000000.0f / 16777216.0f, 0.5f});
  w.sim.rndy = &inj;
  w.sim.opts.PhysBrown = 7.0f;
  w.sim.rob[n].ImpulseInd = {0.0f, 0.0f};
  BrownianForces(w.sim, n);
  CHECK(w.sim.rob[n].ImpulseInd.x == 0.721829653f);  // antes: 0.721829593
}

// RV-05c — Physics.bas:916-934: `Dot(vel, unit) * 0.99` va en Double. Con
// Dot = 14.9415531 la proyeccion es 14.7921371 (en float daba 14.7921381).
// Se comprueba por la velocidad que recibe el bot 2 (quieto, e = 0, masas 1).
TEST_CASE("RV-05c Repel3: Dot * 0.99 en Double") {
  RvWorld w;
  const int a = w.addbot(1000, 1000);
  const int c = w.addbot(1100, 1000);
  w.sim.opts.CoefficientElasticity = 0.0f;
  w.sim.rob[a].vel = {14.9415531f, 0.0f};
  w.sim.rob[c].vel = {0.0f, 0.0f};
  Repel3(w.sim, a, c);
  const float p = 14.7921371f;  // Single(14.9415531 * 0.99#)
  const float v2f = (p * 1.0f + -0.000001f * 1.0f) * 0.5f;
  CHECK(w.sim.rob[c].vel.x == (0.0f - -0.000001f) + v2f);
}

// RV-05d — Obstacles.bas:334-336: `shapeDriftRate * 0.01` es Integer * Double.
// Con rate = 5 da Single(0.05) = 0.0500000007; en float daba 0.049999997.
TEST_CASE("RV-05d MoveObstacles: shapeDriftRate * 0.01 en Double") {
  RvWorld w;
  w.sim.opts.shapeDriftRate = 5;
  const int o = NewObstacle(w.sim, -300.0f, 1000.0f, 100.0f, 100.0f);
  MoveObstacles(w.sim);
  CHECK(w.sim.Obstacles[o].vel.x == static_cast<float>(5 * 0.01));
}

// RV-06 — SimOptions.bas:134-135: Density y Viscosity son Double. El port
// las guarda en float (sim.hpp:93, y formats.hpp:1706-1707 las estrecha al
// cargar), y con ello toda expresion que las usa pasa de Double a float.
// Physics.bas:67: 0.5 * Density * 4.18879 * r^3 va en Double.
TEST_CASE("RV-06 AddedMass: Density es Double (preset 1e-7)") {
  RvWorld w;
  const int n = w.addbot(1000, 1000, 39.2897873f);
  w.sim.opts.Density = 0.0000001;
  AddedMass(w.sim, n);
  CHECK(w.sim.rob[n].AddedMass == 0.0127027463f);  // antes: 0.0127027472
}

// RV-07 — Robots.bas:781 frente a :819. `Round(.aim * 200, 0)` recibe un
// Variant: el producto se guarda como Single de verdad (VT_R4). `CInt(.aim *
// 200)` se evalua dentro de la expresion (lectura adoptada en RV-03). Con
// aim = 3.75250006: Single(aim*200) = 750.5 -> Round = 750 (bancario), pero
// CInt(750.500011) = 751. Como mem(SetAim) = 751 <> 750, el original entra en
// la rama de setaim y deja aim = 751/200. El port calcula las dos cosas en
// double, no ve diferencia y deja aim = 750/200.
TEST_CASE("RV-07 SetAimFunc: Round(aim*200) sobre Single dispara la rama "
          "setaim" *
          doctest::should_fail()) {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];
  b.aim = 3.75250006f;
  b.ma = 0.0f;
  b.mem[addr::aimsx] = 0;
  b.mem[addr::aimdx] = 0;
  b.mem[addr::SetAim] = 751;  // lo que dejo CInt(aim*200) el ciclo anterior
  SetAimFunc(w.sim, n);
  CHECK(b.aim == 751.0f / 200.0f);  // port: 750/200
}

// RV-08 — Robots.bas:792: `Round(x, 3)` devuelve un Variant Single y los dos
// productos por Costs son aritmetica Variant (VarMul R4 x R4 -> R4, redondeo
// real a Single en cada paso). El port multiplica en double. Solo cuenta con
// TURNCOST <> 0 (por defecto es 0).
TEST_CASE("RV-08 SetAimFunc: coste de giro en Single (Variant)" *
          doctest::should_fail()) {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];
  b.aim = 0.0f;
  b.ma = 0.0f;
  b.nrg = 0.0f;
  b.mem[addr::SetAim] = 0;
  b.mem[addr::aimsx] = 9;  // diff = 9 -> Round(9/200, 3) = 0.045
  b.mem[addr::aimdx] = 0;
  w.sim.vm.costs.v[cost::TURNCOST] = 0.001f;
  w.sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.0f;
  SetAimFunc(w.sim, n);
  CHECK(b.nrg == -4.50000043e-05f);  // port: -4.50000007e-05
}

// RV-09 — Multibots.bas:10,17-19: `Min` es Single. La distancia al cuadrado
// (Double) se compara con el Min redondeado a Single. Con dos celulas a
// distancias^2 25000003.24 y 25000004, el primer Min queda en 25000004 y la
// segunda celula tambien pasa el `<=`: el original elige la MAS LEJANA. El
// port guarda Min en double y elige la primera.
TEST_CASE("RV-09 ReSpawn: Min es Single y cambia la celula elegida" *
          doctest::should_fail()) {
  RvWorld w;
  const int a = w.addbot(5000.0f, 1.8f);
  const int c = w.addbot(5000.0f, 2.0f);
  w.sim.rob[a].Multibot = true;
  w.sim.rob[a].Ties[1].pnt = static_cast<vb_integer>(c);
  ReSpawn(w.sim, a, 0.0f, 0.0f);
  // Original: nmin = c, dy = (0 - 2) + 1 = -1  -> pos.y = 1.8 - 1.
  CHECK(w.sim.rob[a].pos.y == 1.8f + -1.0f);  // port: 1.0
}
