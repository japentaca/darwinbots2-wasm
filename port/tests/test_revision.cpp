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

// ---------------------------------------------------------------------------
// Piloto 5 — Disparos (Shots.bas, robshoot de Robots.bas, Decay).

namespace {

// Deja un shot t dentro del bot h en t = 0 (golpe inmediato en
// NewShotCollision), disparado por otro bot (sin inmunidad filial).
void PlaceHit(RvWorld& w, vb_long t, int h, int shooter, vb_integer type) {
  w.sim.MaxBotShotSeperation = 1000.0f;
  w.sim.rob[h].age = 5;
  Shot& s = w.sim.Shots[t];
  s.exist = true;
  s.shottype = type;
  s.parent = static_cast<vb_integer>(shooter);
  s.pos = w.sim.rob[h].pos;
  s.opos = s.pos;
  s.velocity = {1.0f, 0.0f};
}

}  // namespace

// RV-10 — Shots.bas:205-206: `createshot(ByVal X As Long, ByVal Y As Long,
// ByVal vx As Integer, ByVal vy As Integer, ...)`. Los rebotes (-2 de
// releasenrg/releasebod, -5 de poison) nacen con posicion y velocidad
// redondeadas a entero (CLng/CInt, bancario). El port recibe float.
TEST_CASE("RV-10 createshot: posicion Long y velocidad Integer") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  createshot(w.sim, 123.7f, 456.5f, -40.3f, 2.5f, -2, n, 10.0f, 80.0f, 0);
  const Shot& s = w.sim.Shots[1];
  CHECK(s.pos.x == 124.0f);
  CHECK(s.pos.y == 456.0f);
  CHECK(s.velocity.x == -40.0f);
  CHECK(s.velocity.y == 2.0f);
}

// RV-11 — main.frm:390-392/1304-1305: una sim nueva arranca con
// maxshotarray = 50 (el port, 300, del codigo comentado de newshot). Y los
// tamanos usan CLng (bancario): CLng(55 * 1.1) = CLng(60.5000000000000049) =
// 61 (Shots.bas:104) y CLng(93 * 1.2) = 112 (:419); el port trunca (60, 111).
// El tamano decide en que slot cae cada shot y con ello el orden de proceso.
TEST_CASE("RV-11 array de shots: tamano inicial 50 y CLng al crecer") {
  {
    RvWorld w;
    CHECK(w.sim.maxshotarray == 50);
  }
  {
    RvWorld w;
    const int n = w.addbot(1000, 1000);
    w.sim.Shots.assign(56, Shot{});
    w.sim.maxshotarray = 55;
    for (vb_long i = 1; i <= 55; ++i) w.sim.Shots[i].exist = true;
    newshot(w.sim, n, 1, 1.0f, 1.0f);
    CHECK(w.sim.maxshotarray == 61);
  }
  {
    RvWorld w;
    w.sim.Shots.assign(151, Shot{});
    w.sim.maxshotarray = 150;
    for (vb_long i = 1; i <= 93; ++i) {
      Shot& s = w.sim.Shots[i];
      s.exist = true;
      s.shottype = -100;  // ornamental: no colisiona
      s.Range = 1000.0f;
    }
    updateshots(w.sim);
    CHECK(w.sim.maxshotarray == 112);
  }
}

// RV-11b — Shots.bas:421: tras compactar con 0 shots vivos, `shotpointer =
// numshots` = 0. El siguiente FirstSlot devuelve el slot 0, que updateshots
// (For 1 To maxshotarray) no procesa nunca: ese shot queda congelado. El port
// fuerza shotpointer = 1 (y la spec, 33-SHOTS.md §8 Q03, da por hecho >= 1).
TEST_CASE("RV-11b compactar con 0 shots deja shotpointer = 0") {
  RvWorld w;
  w.sim.Shots.assign(151, Shot{});
  w.sim.maxshotarray = 150;
  updateshots(w.sim);
  CHECK(w.sim.shotpointer == 0);
}

// RV-12 — error de memoria del port, sin equivalente VB6. updateshots y
// releasenrg guardan `Shot& s = sim.Shots[t]` y luego llaman a createshot,
// que puede hacer Shots.resize y reubicar el vector: las escrituras
// posteriores (flash, opos, pos, age) van a memoria liberada. En VB6
// `Shots(t)` se vuelve a indexar tras el ReDim Preserve (Shots.bas:584 lo
// comenta). Aqui el array esta lleno y un -1 golpea: releasenrg crea el -2.
TEST_CASE("RV-12 createshot reubica Shots bajo una referencia viva") {
  RvWorld w;
  const int h = w.addbot(1000, 1000);
  const int sh = w.addbot(9000, 9000);
  w.sim.rob[h].nrg = 1000.0f;
  w.sim.rob[h].body = 1000.0f;
  const vb_long M = w.sim.maxshotarray;
  for (vb_long i = 2; i <= M; ++i) {
    Shot& o = w.sim.Shots[i];
    o.exist = true;
    o.shottype = -100;
    o.Range = 1000.0f;
    o.pos = {5000.0f, 5000.0f};
    o.opos = o.pos;
  }
  PlaceHit(w, 1, h, sh, -1);
  w.sim.Shots[1].Range = 10.0f;
  w.sim.Shots[1].nrg = 40.0f;
  w.sim.Shots[1].value = 20;
  updateshots(w.sim);
  CHECK(w.sim.Shots[1].flash);          // antes del arreglo: false
  CHECK(w.sim.Shots[1].age == 1);       // antes del arreglo: 0
  CHECK(w.sim.Shots[1].pos.x == 1001.0f);
}

// RV-13 — Shots.bas:485-486: cada pulso de Decay resta `SimOpts.Decay / 10`
// al body (aunque va sea menor), sin suelo, y recalcula el radio. El port
// resta va / 10, recorta a 0 y no llama a FindRadius. Con el preset de
// corpses (Decay 75, Decaydelay 3, DecayType 3) y body = 5, el original deja
// body = -2.5 (el corpse muere en el siguiente UpdateCounters); el port deja
// 4.5 y el corpse decae geometricamente sin morir.
TEST_CASE("RV-13 Decay resta Decay/10 al body y recalcula el radio") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];
  b.Corpse = true;
  b.body = 5.0f;
  b.DecayTimer = 2;
  w.sim.opts.Decay = 75.0f;
  w.sim.opts.Decaydelay = 3;
  w.sim.opts.DecayType = 3;
  Decay(w.sim, n);
  CHECK(b.body == -2.5f);                     // antes del arreglo: 4.5
  CHECK(b.radius == FindRadius(w.sim, n));    // antes del arreglo: se queda en 60
}

// RV-14 — promociones a Double perdidas en disparos (mismo patron que RV-05).
// Shots.bas:822: `nrg / (Range * (RobSize / 3)) * value`. RobSize es Integer
// y `/` da Double (40#), asi que toda la expresion va en Double (takewaste no
// lleva el CSng de takeven/takepoison).
TEST_CASE("RV-14 takewaste: la potencia va en Double") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Shot& s = w.sim.Shots[1];
  s.nrg = 9.76221085f;
  s.Range = 5.0f;
  s.value = 409;
  w.sim.rob[n].Waste = 0.0f;
  takewaste(w.sim, n, 1);
  CHECK(w.sim.rob[n].Waste == 19.9637203f);  // antes del arreglo: 19.9637222
}

// RV-14b — Shots.bas:742: `nrg + partial * 0.95` (literal Double).
TEST_CASE("RV-14b takenrg: partial * 0.95 en Double") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Shot& s = w.sim.Shots[1];
  s.nrg = 114.059998f;
  s.Range = 1.0f;
  w.sim.rob[n].nrg = 1000.0f;
  takenrg(w.sim, n, 1);
  CHECK(w.sim.rob[n].nrg == 1108.35706f);  // antes del arreglo: 1108.35693
}

// RV-14c — Shots.bas:146: `Random` devuelve Long y `Long / 200` es Double, asi
// que `ShAngle + Random(-20, 20) / 200` va en Double. Con aim = 0.0244212653
// y k = -13 el angulo es -0.0405787341 (el port: -0.0405787304).
TEST_CASE("RV-14c newshot: el jitter Random/200 se suma en Double") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  w.sim.rob[n].aim = 0.0244212653f;
  InjectedRnd inj({0.5f, 0.18f});  // Random(-2,2) muerto; Random(-20,20) = -13
  w.sim.rndy = &inj;
  const vb_long a = newshot(w.sim, n, 1, 1.0f, 1.0f);
  const float sa = static_cast<float>(0.0244212653f + -13.0 / 200.0);
  CHECK(w.sim.Shots[a].velocity.y ==
        static_cast<float>(-std::sin(static_cast<double>(sa))) * 40.0f);
}

// RV-14d — Shots.bas:345: `nrg * Atn(..) / Atn(-shotdecay)`: Single * Double
// / Double, un solo redondeo. El port redondea cada Atn a float y opera en
// float.
TEST_CASE("RV-14d updateshots: el decaimiento Atn va en Double") {
  RvWorld w;
  const int h = w.addbot(1000, 1000);
  const int sh = w.addbot(9000, 9000);
  PlaceHit(w, 1, h, sh, -4);
  Shot& s = w.sim.Shots[1];
  s.nrg = 1342.11816f;
  s.age = 3;
  s.Range = 7.0f;
  updateshots(w.sim);
  const double at = std::atan(static_cast<double>(3.0f / 7.0f) * 40 - 40);
  CHECK(w.sim.Shots[1].nrg ==
        static_cast<float>(1342.11816f * at / std::atan(-40.0)));
}

// RV-15 — Shots.bas:1100 y :1103 (Vshoot): el original resta de izquierda a
// derecha, `nrg - (tempa / 20#) - coste` (Double) y `nrg - CSng(mem) -
// coste`; el port reasocia a `nrg - (a + coste)` en float. Difiere con las
// dos lecturas de RV-03.
TEST_CASE("RV-15 Vshoot: el coste se resta en el orden del fuente") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];
  b.nrg = 102.160255f;
  b.mem[addr::VshootSys] = 77;
  w.sim.vm.costs.v[cost::SHOTCOST] = 1.0458796f;
  w.sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.0f;
  w.sim.Shots[1].exist = true;
  w.sim.Shots[1].stored = true;
  Vshoot(w.sim, n, 1);
  const double c = 1.0458796f;
  const float n1 = static_cast<float>(102.160255f - 1540.0 / 20.0 - c);
  const float n2 = static_cast<float>(n1 - 77.0 - c);  // lectura N-06
  CHECK(b.nrg == n2);
}

// RV-16 — Shots.bas:319 (y Robots.bas:1640): TotalSimEnergy es Long y
// `Long + Single` es Double, redondeado UNA vez al asignar. El port redondea
// el sumando y luego suma: con T = 1 y nrg = 2.5, CLng(3.5) = 4 frente a
// 1 + CLng(2.5) = 3. Alimenta los umbrales de SunUp/SunDown (Vegs.bas:85).
TEST_CASE("RV-16 TotalSimEnergy redondea la suma, no el sumando") {
  RvWorld w;
  w.sim.TotalSimEnergy[w.sim.CurrentEnergyCycle] = 1;
  Shot& s = w.sim.Shots[1];
  s.exist = true;
  s.shottype = -2;
  s.nrg = 2.5f;
  s.Range = 1000.0f;
  updateshots(w.sim);
  CHECK(w.sim.TotalSimEnergy[w.sim.CurrentEnergyCycle] == 4);  // antes del arreglo: 3
}

// RV-17 — Shots.bas:165 y :238: `(x + 40 + 1) \ 40`. `\` redondea el
// operando YA sumado; el port redondea x y suma 41 despues, lo que cambia la
// paridad del bancario: con x = 38.5, CLng(79.5) = 80 -> 2, frente a
// CLng(38.5) + 41 = 79 -> 1.
TEST_CASE("RV-17 createshot: (Range + 41) \\ 40 redondea la suma") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  createshot(w.sim, 0.0f, 0.0f, 0.0f, 0.0f, -2, n, 10.0f, 38.5f, 0);
  CHECK(w.sim.Shots[1].Range == 2.0f);  // antes del arreglo: 1
}

// RV-14e — Shots.bas:565: `EnergyLost = power * 0.9` (releasenrg). Con
// EnergyFix = 7 y nrg = 20: 20 - Single(6.3) = 13.6999998.
TEST_CASE("RV-14e releasenrg: power * 0.9 en Double") {
  RvWorld w;
  const int h = w.addbot(1000, 1000);
  const int sh = w.addbot(9000, 9000);
  PlaceHit(w, 1, h, sh, -1);
  w.sim.opts.EnergyExType = false;
  w.sim.opts.EnergyFix = 7;
  w.sim.rob[h].nrg = 20.0f;
  w.sim.rob[h].body = 1000.0f;
  releasenrg(w.sim, h, 1);
  CHECK(w.sim.rob[h].nrg == 13.6999998f);  // antes del arreglo: 13.7000008
}

// RV-14f — Shots.bas:634-635: el techo `(body * 10) / 0.8 + shell` es Double.
// Con body = 2.48 y shell = 0 da 31 exacto (en float, 30.9999981); el -2 de
// vuelta lleva esa potencia.
TEST_CASE("RV-14f releasebod: techo (body * 10) / 0.8 en Double") {
  RvWorld w;
  const int h = w.addbot(1000, 1000);
  const int sh = w.addbot(9000, 9000);
  PlaceHit(w, 1, h, sh, -6);
  w.sim.opts.EnergyExType = false;
  w.sim.opts.EnergyFix = 1000;
  w.sim.rob[h].nrg = 1000.0f;
  w.sim.rob[h].body = 2.48000002f;
  w.sim.rob[h].shell = 0.0f;
  releasebod(w.sim, h, 1);
  CHECK(w.sim.Shots[2].nrg == 31.0f);  // antes del arreglo: 30.9999981
}

// RV-14g — Shots.bas:845: `Poisoncount + power / 1.5` (1.5 es Double).
TEST_CASE("RV-14g takepoison: Poisoncount + power / 1.5 en Double") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Shot& s = w.sim.Shots[1];
  s.nrg = 100.0f;
  s.Range = 1.0f;
  s.value = 5;  // power = 12.5
  s.FromSpecie = "Otra.txt";
  s.memloc = 5;  // sin RNG
  w.sim.rob[n].Poisoncount = 10.0f;
  takepoison(w.sim, n, 1);
  CHECK(w.sim.rob[n].Poisoncount == 18.333334f);  // antes: 18.3333321
}

// RV-14h — Robots.bas:744-757: `Cos(aim) * upTotal + Sin(aim) * sxTotal` es
// Double (Vshoot y el nacimiento lo usan).
TEST_CASE("RV-14h absx: Cos(aim) * up en Double") {
  CHECK(absx(0.0149999997f, 40.0f, 0.0f, 0.0f, 0.0f) == 39.9954987f);  // antes: 39.9955025
}

// RV-14i — Robots.bas:1834: `Waste - value * 0.99` (robshoot -4).
TEST_CASE("RV-14i robshoot -4: Waste - value * 0.99 en Double") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];
  b.nrg = 1000.0f;
  b.Waste = 1000.0f;
  b.mem[addr::shoot] = -4;
  b.mem[addr::shootval] = 84;
  robshoot(w.sim, n);
  CHECK(b.Waste == 916.840027f);  // antes del arreglo: 916.839966
}

// RV-14j — Shots.bas:360: el rebote de poison de un shot de memoria resta
// `(nrg / 2) * 0.9` en Double.
TEST_CASE("RV-14j updateshots: rebote de poison (nrg / 2) * 0.9 en Double") {
  RvWorld w;
  const int h = w.addbot(1000, 1000);
  const int sh = w.addbot(9000, 9000);
  PlaceHit(w, 1, h, sh, 5);
  Shot& s = w.sim.Shots[1];
  s.nrg = 92.490097f;
  s.Range = 10.0f;
  s.age = 0;  // tempnum = 0: el decaimiento deja nrg igual
  w.sim.rob[h].poison = 2000.0f;
  updateshots(w.sim);
  CHECK(w.sim.rob[h].poison == 1958.37952f);  // antes del arreglo: 1958.37939
}

// RV-14k — Shots.bas:1108: `pos.X + Cos(ShAngle) * radius` en Double. Con
// Random(1, 1256) = 26 y radius 60.
TEST_CASE("RV-14k Vshoot: pos + Cos(ShAngle) * radius en Double") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  w.sim.rob[n].mem[addr::VshootSys] = 1;
  w.sim.rob[n].nrg = 1000.0f;
  InjectedRnd inj({25.5f / 1256.0f});  // Random(1, 1256) = 26
  w.sim.rndy = &inj;
  w.sim.Shots[1].exist = true;
  w.sim.Shots[1].stored = true;
  Vshoot(w.sim, n, 1);
  CHECK(w.sim.Shots[1].pos.x == 1059.49377f);  // antes del arreglo: 1059.49365
}

// RV-15b — Robots.bas:1761: `Cost = multiplier * Costs(SHOTCOST) *
// Costs(COSTMULTIPLIER)` de izquierda a derecha. Con shootval = 10 (Cost =
// 10 * c1 * c2), c1 = 0.526000023 y c2 = 1.70000005: 8.94200039 frente a
// 8.94200134 con el producto de costes precalculado en float.
TEST_CASE("RV-15b robshoot: Cost = multiplier * c1 * c2 en el orden del fuente") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];
  b.nrg = 9.5f;
  b.mem[addr::shoot] = -1;
  b.mem[addr::shootval] = 10;
  w.sim.vm.costs.v[cost::SHOTCOST] = 0.526000023f;
  w.sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.70000005f;
  robshoot(w.sim, n);
  CHECK(b.nrg == 9.5f - 8.94200039f);  // antes del arreglo: 9.5 - 8.94200134
}

// ---------------------------------------------------------------------------
// Piloto 6 — Ties (Ties.bas, share* de Robots.bas).

namespace {

// Tie endurecida (type 3) entre a y c por el puerto 1, vista desde a.
void HardTie(RvWorld& w, int a, int c) {
  Bot& ba = w.sim.rob[a];
  Bot& bc = w.sim.rob[c];
  ba.Ties[1].pnt = static_cast<vb_integer>(c);
  ba.Ties[1].ptt = 1;
  ba.Ties[1].Port = 1;
  ba.Ties[1].type = 3;
  bc.Ties[1].pnt = static_cast<vb_integer>(a);
  bc.Ties[1].ptt = 1;
  bc.Ties[1].Port = 1;
  bc.Ties[1].type = 3;
  bc.Ties[1].back = true;
  ba.Multibot = true;
  ba.numties = 1.0f;
  bc.numties = 1.0f;
  ba.mem[addr::TIENUM] = 1;
  ba.mem[addr::FIXANG] = 32000;
}

}  // namespace

// RV-18 — Ties.bas:891, 904, 921: en maketie `Dim Length As Long`, asi que
// `Length = VectorMagnitude(..)` redondea (CLng) y la NaturalLength de toda
// tie nueva es entera. El port guarda la distancia en float sin redondear.
TEST_CASE("RV-18 maketie: Length es Long") {
  RvWorld w;
  const int a = w.addbot(1000.0f, 1000.0f);
  const int c = w.addbot(1123.6f, 1000.0f);
  InjectedRnd inj({0.5f});  // deflect = Random(2, 92)
  w.sim.rndy = &inj;
  REQUIRE(maketie(w.sim, a, c, 1000, 0, 1));
  CHECK(w.sim.rob[a].Ties[1].NaturalLength == 124.0f);  // antes del arreglo: 123.6
  CHECK(w.sim.rob[c].Ties[1].NaturalLength == 124.0f);
}

// RV-19 — Ties.bas:257 y :290: `Length = Abs(.mem(FIXLEN)) + .radius +
// rob(..).radius` es Single y se asigna a un Long (CLng de la SUMA). El port
// trunca cada radio a vb_long por separado: 100 + 60.7 + 60.7 da 221 en el
// original y 220 en el port.
TEST_CASE("RV-19 fixlen: CLng de la suma, no truncar cada radio") {
  RvWorld w;
  const int a = w.addbot(1000.0f, 1000.0f, 60.7f);
  const int c = w.addbot(1300.0f, 1000.0f, 60.7f);
  HardTie(w, a, c);
  w.sim.rob[a].mem[addr::FIXLEN] = 100;
  Update_Ties(w.sim, a);
  CHECK(w.sim.rob[a].Ties[1].NaturalLength == 221.0f);  // antes del arreglo: 220
  CHECK(w.sim.rob[c].Ties[1].NaturalLength == 221.0f);
}

// RV-20 — promociones a Double en ties (familia RV-05). Ties.bas:268:
// `.b = 0.005 * .mem(stifftie)` es Double * Integer: con 5 da Single(0.025)
// = 0.0250000004 (en float, 0.0249999985).
TEST_CASE("RV-20 stifftie: 0.005 * mem en Double") {
  RvWorld w;
  const int a = w.addbot(1000.0f, 1000.0f);
  const int c = w.addbot(1300.0f, 1000.0f);
  HardTie(w, a, c);
  w.sim.rob[a].mem[addr::stifftie] = 5;
  Update_Ties(w.sim, a);
  CHECK(w.sim.rob[a].Ties[1].b == 0.0250000004f);
}

// RV-20b — Ties.bas:361: `rob(..).nrg + l * 0.7` (tie feeding) en Double.
TEST_CASE("RV-20b tie feeding: nrg + l * 0.7 en Double") {
  RvWorld w;
  const int a = w.addbot(1000.0f, 1000.0f);
  const int c = w.addbot(1300.0f, 1000.0f);
  HardTie(w, a, c);
  Bot& b = w.sim.rob[a];
  b.nrg = 5000.0f;
  b.body = 1000.0f;
  b.age = 5;
  b.mem[addr::tieport1 + 2] = -1;
  b.mem[addr::tieport1 + 3] = 623;
  w.sim.rob[c].nrg = 313.556946f;
  Update_Ties(w.sim, a);
  CHECK(w.sim.rob[c].nrg == 749.656921f);  // antes del arreglo: 749.656982
}

// RV-20c — Robots.bas:1897-1900: `totslime * (CSng(.mem(833)) / 100#)` es
// Single * Double (lo mismo en sharewaste/shareshell/sharechloroplasts y el
// portionThatsMine de sharenrg).
TEST_CASE("RV-20c shareslime: tot * (m / 100#) en Double") {
  RvWorld w;
  const int a = w.addbot(1000.0f, 1000.0f);
  const int c = w.addbot(1300.0f, 1000.0f);
  HardTie(w, a, c);
  w.sim.rob[a].Slime = 11162.7051f;
  w.sim.rob[c].Slime = 0.0f;
  w.sim.rob[a].mem[833] = 3;
  shareslime(w.sim, a, 1);
  CHECK(w.sim.rob[a].Slime == 334.881165f);  // antes del arreglo: 334.881134
}

// RV-19b — Ties.bas:290: la misma suma en la ruta de `tielen1` (mem 484 con
// el flag de overwrite).
TEST_CASE("RV-19b tielen1: CLng de la suma, no truncar cada radio") {
  RvWorld w;
  const int a = w.addbot(1000.0f, 1000.0f, 60.7f);
  const int c = w.addbot(1300.0f, 1000.0f, 60.7f);
  HardTie(w, a, c);
  w.sim.rob[a].mem[484] = 100;
  w.sim.rob[a].TieLenOverwrite[0] = true;
  Update_Ties(w.sim, a);
  CHECK(w.sim.rob[a].Ties[1].NaturalLength == 221.0f);  // antes del arreglo: 220
}
