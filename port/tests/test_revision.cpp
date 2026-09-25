// Revision del port contra el fuente VB6 (spec/REVISION-PORT.md).
// Cada caso afirma el comportamiento del ORIGINAL y reproduce una divergencia
// confirmada del port. Van con doctest::should_fail(): la suite sigue verde
// mientras la divergencia exista; al corregirla el caso pasa a rojo y hay que
// quitar el decorador (y mover el caso a su familia definitiva).
#include <string>

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
TEST_CASE("RV-01 ~= / !~= comparan en Double, no en Single") {
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
TEST_CASE("RV-02 rndstore: Random con hi Integer calcula en Single") {
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
TEST_CASE("RV-02b Random(1, 1000) con literales Integer calcula en Single") {
  InjectedRnd inj({855638.0f / 16777216.0f});
  CHECK(RandomI(1, 1000, inj) == 52);  // Random (Double) devuelve 51
}

// RV-02c — si `hi - low` desborda Integer (Robots.bas:994 y main.frm:1556,
// Random(-32000, 32000)), el Variant pasa a Long y la cadena va por
// Long * Single -> Double. Con r = 262/2^24 la ruta Single daria -31999.
TEST_CASE("RV-02c RandomI(-32000, 32000) desborda Integer y va en Double") {
  InjectedRnd inj({262.0f / 16777216.0f});
  CHECK(RandomI(-32000, 32000, inj) == -32000);
}

// RV-02d — main.frm:1537: los argumentos son `Single * CSng(...)` (Single) y
// Random calcula en Single. FieldWidth = 9237, Poslf = 0.1 y Posrg = 0.9:
// Random(917.7, 8259.3) con r = 12110/2^24 da 923 en Single y 922 en Double.
TEST_CASE("RV-02d InsertFounder: Random con argumentos Single calcula en "
          "Single") {
  Sim sim;
  sim.opts.FieldWidth = 9237;
  std::vector<vb_single> seq(9, 0.5f);
  seq[6] = 12110.0f / 16777216.0f;  // pos.x (tras las 6 de preparerob)
  InjectedRnd rng(seq);
  sim.rndy = &rng;
  sim.vm.rndy = &rng;
  SpecieCfg cfg;
  cfg.Poslf = 0.1f;
  cfg.Posrg = 0.9f;
  const int a = InsertFounder(sim, "stop", "F.txt", cfg);
  REQUIRE(a == 1);
  CHECK(sim.rob[a].pos.x == 923.0f);  // Random (Double): 922
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

  // Alta con ADN (patron de test_bugs2.cpp), para Reproduce/SexReproduce.
  int spawn(const std::string& dnatext, float x, float y) {
    const int n = posto(sim);
    Bot& b = sim.rob[n];
    b.exist = true;
    b.FName = "A.txt";
    b.nrg = 20000.0f;
    b.body = 1000.0f;
    REQUIRE(LoadDNAText(dnatext, b, *sim.sysvars));
    makeoccurrlist(sim, n);
    b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));
    b.genenum = CountGenes(b.dna);
    b.pos = {x, y};
    b.aim = 0.0f;
    b.aimvector = {1.0f, 0.0f};
    b.radius = FindRadius(sim, n);
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
          "setaim") {
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

// RV-07b — el mismo patron en Robots.bas:788: `Round((.aim * 200 -
// .mem(SetAim)) / 1256, 0)` redondea el Single. Con aim = 3.14f y SetAim = 0
// el cociente es 0.5000000167, que en Single es 0.5 -> Round = 0 (bancario);
// en double seria 1 y diff2 = +-1256. Se ve en el coste de giro.
TEST_CASE("RV-07b SetAimFunc: Round((aim*200 - setaim)/1256) sobre Single") {
  RvWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];
  b.aim = 3.14f;
  b.ma = 0.0f;
  b.nrg = 0.0f;
  b.mem[addr::SetAim] = 0;
  b.mem[addr::aimsx] = 0;
  b.mem[addr::aimdx] = 0;
  w.sim.vm.costs.v[cost::TURNCOST] = 1.0f;
  w.sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.0f;
  SetAimFunc(w.sim, n);
  CHECK(b.nrg == -3.14f);  // diff2 = 0: solo el giro de 628
}

// RV-08 — Robots.bas:792: `Round(x, 3)` devuelve un Variant Single y los dos
// productos por Costs son aritmetica Variant (VarMul R4 x R4 -> R4, redondeo
// real a Single en cada paso). El port multiplica en double. Solo cuenta con
// TURNCOST <> 0 (por defecto es 0).
TEST_CASE("RV-08 SetAimFunc: coste de giro en Single (Variant)") {
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
TEST_CASE("RV-09 ReSpawn: Min es Single y cambia la celula elegida") {
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

// ---------------------------------------------------------------------------
// Piloto 7 — Reproduccion y energia (Robots.bas, Vegs.bas, Teleport.bas).

// RV-21 — Robots.bas:2129 y :2456: `If rob(n).Veg = True And (Random(0, 10)
// <> 5) And (...)`. El And de VB6 no cortocircuita: Random se evalua SIEMPRE,
// tambien para los animales. El port usa && y solo tira el dado con Veg. Con
// per = 100, `per Mod 100 = 0` sale justo despues de la loteria.
TEST_CASE("RV-21 Reproduce: la loteria vegetal consume RNG tambien en animales") {
  RvWorld w;
  const int n = w.addbot(5000.0f, 5000.0f);
  w.sim.rob[n].body = 1000.0f;
  w.sim.rob[n].nrg = 1000.0f;
  InjectedRnd inj({0.5f});
  w.sim.rndy = &inj;
  Reproduce(w.sim, n, 100);
  CHECK(inj.consumed() == 1);  // antes del arreglo: 0
}

TEST_CASE("RV-21b SexReproduce: la loteria vegetal consume RNG tambien en animales") {
  RvWorld w;
  const int n = w.addbot(5000.0f, 5000.0f);
  w.sim.rob[n].body = 1000.0f;
  w.sim.rob[n].nrg = 1000.0f;
  w.sim.rob[n].spermDNA.assign(2, Block{});
  w.sim.rob[n].mem[addr::SEXREPRO] = 100;
  InjectedRnd inj({0.5f});
  w.sim.rndy = &inj;
  SexReproduce(w.sim, n);
  CHECK(inj.consumed() == 1);  // antes del arreglo: 0
}

// RV-22 — Robots.bas:2887-2894: simplecoll impide nacer dentro o a traves de
// una forma (AABB entre el padre y el punto de parto). El port omite el bucle
// de obstaculos ("capa B7"), aunque las formas ya estan portadas.
TEST_CASE("RV-22 simplecoll: una forma entre padre e hijo bloquea el parto") {
  RvWorld w;
  const int k = w.addbot(1000.0f, 1000.0f);
  w.sim.Obstacles.resize(2);
  w.sim.Obstacles[1].exist = true;
  w.sim.Obstacles[1].pos = {1150.0f, 900.0f};
  w.sim.Obstacles[1].Width = 100.0f;
  w.sim.Obstacles[1].Height = 200.0f;
  w.sim.numObstacles = 1;
  CHECK(simplecoll(w.sim, 1400, 1000, k));
}

// RV-23 — Robots.bas:2139-2140, 2209-2230 (y :2466-2467, 2658-2688 en la
// sexual): `(nrg / 100#) * CSng(per)` es Double (100# es literal Double), y
// tambien `nnrg * 0.001` y `nnrg * 0.999`; se redondea una vez al asignar.
// nbody (Integer) hace CInt del Double: 501/100#*50 = 250.5 exacto -> 250.
// El caso dorado B-30 de la spec supuso Single estricto (-> 251).
TEST_CASE("RV-23 Reproduce: el reparto /100# va en Double") {
  auto run = [](float body, float nrg, vb_integer per, float& child_body,
                float& child_nrg, float& parent_nrg) {
    RvWorld w;
    const int p = w.spawn("stop", 10000.0f, 10000.0f);
    w.sim.rob[p].body = body;
    w.sim.rob[p].nrg = nrg;
    Reproduce(w.sim, p, per);
    REQUIRE(w.sim.rob[2].exist);
    child_body = w.sim.rob[2].body;
    child_nrg = w.sim.rob[2].nrg;
    parent_nrg = w.sim.rob[p].nrg;
  };
  float cb, cn, pn;
  run(501.0f, 20000.0f, 50, cb, cn, pn);
  CHECK(cb == 250.0f);  // antes del arreglo: 251
  run(1000.0f, 25829.0879f, 80, cb, cn, pn);
  CHECK(cn == 20642.6055f);  // antes del arreglo: 20642.6094
  CHECK(pn == 5145.15527f);  // antes del arreglo: 5145.15332
}

// RV-24 — Robots.bas:2257 y :2715: `multibot_time / 2 + 2` es Byte / Integer
// -> Double y la asignacion al Byte redondea bancario: 107 / 2 + 2 = 55.5 ->
// 56. El port divide en entero (53 + 2 = 55). Difiere con x = 3 (mod 4).
TEST_CASE("RV-24 Reproduce: multibot_time / 2 + 2 redondea bancario") {
  RvWorld w;
  const int p = w.spawn("stop", 10000.0f, 10000.0f);
  w.sim.rob[p].multibot_time = 107;
  Reproduce(w.sim, p, 50);
  REQUIRE(w.sim.rob[2].exist);
  CHECK(w.sim.rob[2].multibot_time == 56);  // antes del arreglo: 55
}

// RV-25 — Robots.bas:1435 y Ties.bas:883: maketie recibe `c As Long` ByRef,
// asi que `radius + radius + RobSize * 2` (Single) llega con CLng (bancario)
// al temporal. El port hace static_cast (trunca): 60.3 + 60.3 + 240 = 360.6
// da c = 361 en el original y 360 en el port; el umbral c * 1.5 pasa de
// 541.5 a 540 y una tie a 541 ya no se forma.
TEST_CASE("RV-25 FireTies: c de maketie es CLng de la suma") {
  RvWorld w;
  const int a = w.addbot(1000.0f, 1000.0f, 60.3f);
  const int c = w.addbot(1541.2f, 1000.0f, 60.3f);
  Bot& b = w.sim.rob[a];
  b.age = 5;
  b.lastopp = c;
  b.lastopptype = 0;
  b.mem[addr::mtie] = 1;
  FireTies(w.sim, a);
  CHECK(w.sim.rob[a].Ties[1].pnt == c);  // antes del arreglo: sin tie
}

// RV-26 — promociones a Double perdidas en el mantenimiento por bot (familia
// RV-05). Robots.bas:1028: `.Slime = .Slime * 0.98`.
TEST_CASE("RV-26 Upkeep: Slime * 0.98 en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  w.sim.rob[n].Slime = 6546.32666f;
  Upkeep(w.sim, n);
  CHECK(w.sim.rob[n].Slime == 6415.3999f);  // antes del arreglo: 6415.40039
}

// RV-26b — Robots.bas:1010: `Costs(AGECOST) * Math.Log(ageDelta)` es
// Single * Double.
TEST_CASE("RV-26b Upkeep: coste de edad logaritmico en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  auto& C = w.sim.vm.costs.v;
  C[cost::AGECOSTMAKELOG] = 1.0f;
  C[cost::AGECOST] = 0.01f;
  C[cost::COSTMULTIPLIER] = 1.0f;
  w.sim.rob[n].age = 3;
  w.sim.rob[n].nrg = 0.0f;
  w.sim.rob[n].body = 0.0f;
  Upkeep(w.sim, n);
  CHECK(w.sim.rob[n].nrg == -0.0109861223f);  // antes del arreglo: -0.0109861232
}

// RV-26c — Robots.bas:1701: `.body + .mem(strbody) / 10` (Integer / Integer
// -> Double). Con body pequeno (5-80) difiere en el 4 %.
TEST_CASE("RV-26c storebody: body + mem / 10 en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  w.sim.rob[n].body = 5.00010014f;
  w.sim.rob[n].nrg = 1000.0f;
  w.sim.rob[n].mem[addr::strbody] = 31;
  storebody(w.sim, n);
  CHECK(w.sim.rob[n].body == 8.10010052f);  // antes del arreglo: 8.10009956
}

// RV-26d — Robots.bas:1345: `.Bouyancy + .mem(setboy) / 32000` (Integer /
// Integer -> Double).
TEST_CASE("RV-26d ManageBouyancy: mem / 32000 en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  w.sim.rob[n].Bouyancy = 0.25f;
  w.sim.rob[n].mem[addr::setboy] = 263;
  ManageBouyancy(w.sim, n);
  CHECK(w.sim.rob[n].Bouyancy == 0.258218735f);  // antes del arreglo: 0.258218765
}

// RV-26e — Robots.bas:1222: `.chloroplasts - 0.5 / (100 ^ (..))`: `^` da
// Double y la resta se redondea una vez.
TEST_CASE("RV-26e ManageChlr: decaimiento de cloroplastos en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  w.sim.rob[n].chloroplasts = 5.217731f;
  ManageChlr(w.sim, n);
  CHECK(w.sim.rob[n].chloroplasts == 4.71848154f);  // antes del arreglo: 4.71848106
}

// RV-27 — Robots.bas:1523-1530: con Tides > 0 UpdateBots calcula la marea
// (BouyancyScaling, Ygravity, PhysBrown). El port no la calcula
// (BouyancyScaling queda en 1) pero carga Tides del .sim, y feedvegs
// (Vegs.bas:253) multiplica el sol por 1 - BouyancyScaling = 0.
// Ciclo 0: (1 + Sin(0)) / 2 = 0.5 -> Sqr -> 0.707106769.
TEST_CASE("RV-27 UpdateBots: mareas con Tides > 0") {
  RvWorld w;
  w.sim.opts.Tides = 100;
  w.sim.opts.TidesOf = 0;
  w.sim.opts.TotRunCycle = 0;
  w.sim.opts.PhysBrown = 7.0f;
  UpdateBots(w.sim);
  CHECK(w.sim.BouyancyScaling == 0.707106769f);  // antes del arreglo: 1
  CHECK(w.sim.opts.Ygravity == 1.17157292f);     // antes del arreglo: 0
  CHECK(w.sim.opts.PhysBrown == 0.0f);           // antes del arreglo: 7
}

// RV-26f — Robots.bas:1033: `.poison * 0.98` (mismo patron que el slime).
TEST_CASE("RV-26f Upkeep: poison * 0.98 en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  w.sim.rob[n].poison = 6546.32666f;
  Upkeep(w.sim, n);
  CHECK(w.sim.rob[n].poison == 6415.3999f);  // antes del arreglo: 6415.40039
}

// RV-26g — Robots.bas:1012: `AGECOST + (ageDelta * FRACTION)`: Long * Single
// es Double.
TEST_CASE("RV-26g Upkeep: coste de edad lineal en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  auto& C = w.sim.vm.costs.v;
  C[cost::AGECOSTMAKELINEAR] = 1.0f;
  C[cost::AGECOST] = 0.01f;
  C[cost::AGECOSTLINEARFRACTION] = 0.01f;
  C[cost::COSTMULTIPLIER] = 1.0f;
  w.sim.rob[n].age = 5;
  w.sim.rob[n].nrg = 0.0f;
  w.sim.rob[n].body = 0.0f;
  Upkeep(w.sim, n);
  CHECK(w.sim.rob[n].nrg == -0.0599999987f);  // antes del arreglo: -0.0599999949
}

// RV-26h — Robots.bas:1710: `.body - CSng(mem) / 10#` (feedbody).
TEST_CASE("RV-26h feedbody: body - mem / 10# en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  w.sim.rob[n].body = 5.0f;
  w.sim.rob[n].nrg = 1000.0f;
  w.sim.rob[n].mem[addr::fdbody] = 31;
  feedbody(w.sim, n);
  CHECK(w.sim.rob[n].body == 1.89999998f);  // antes del arreglo: 1.9000001
}

// RV-26i — Teleport.bas:324, 335: el centro `pos.y + Height * 0.3` y el
// rebote `MaxVelocity * 0.1` son Double.
TEST_CASE("RV-26i MoveTeleporter: Height * 0.3 y MaxVelocity * 0.1 en Double") {
  RvWorld w;
  Teleporter& tp = w.sim.Teleporters[1];
  tp.exist = true;
  tp.pos = {-5.0f, 10.0f};
  tp.Width = 100.0f;
  tp.Height = 101.0f;
  w.sim.opts.MaxVelocity = 9.0f;
  w.sim.opts.Dxsxconnected = false;
  MoveTeleporter(w.sim, 1);
  CHECK(tp.center.y == 40.2999992f);  // antes del arreglo: 40.3000031
  CHECK(tp.vel.x == 0.899999976f);    // antes del arreglo: 0.900000036
}

// ---------------------------------------------------------------------------
// Piloto 8 — Vision y sentidos (Senses.bas, Quads.bas:174-963).

// RV-28 — Senses.bas:21: `touch(ByVal a As Long, ByVal X As Long, ByVal Y As
// Long)`. Los llamadores (Physics.bas:964-965, Obstacles.bas:479-517) pasan
// posiciones Single, que llegan redondeadas con CLng. El port las pasa en
// float y el angulo del impacto cambia: aqui el golpe cae en hitdn en el
// original y en hitdx en el port.
TEST_CASE("RV-28 touch: X e Y son Long (CLng de la posicion)") {
  RvWorld w;
  const int a = w.addbot(1347.8092f, 3585.77612f);
  w.sim.rob[a].aim = 2.27662539f;
  touch(w.sim, a, 1457.92285f, 3594.95947f);
  CHECK(w.sim.rob[a].mem[addr::hitdn] == 1);  // antes del arreglo: 0
  CHECK(w.sim.rob[a].mem[addr::hitdx] == 0);  // antes del arreglo: 1
}

// RV-29 — promociones a Double perdidas en vision y sentidos (familia RV-05).
// Senses.bas:70-87: `aim = 6.28 - .aim`, `ang - 3.14` y `dang + 6.28` son
// Single +/- Double; el port usa los literales float. Cambia .shang.
TEST_CASE("RV-29 taste: los sumandos 6.28 y 3.14 van en Double") {
  RvWorld w;
  const int a = w.addbot(12516.0f, 3238.0f);
  w.sim.rob[a].aim = 0.87248832f;
  taste(w.sim, a, 12405.3984f, 3160.69653f, 1);
  CHECK(w.sim.rob[a].mem[209] == 924);  // antes del arreglo: 925
}

// RV-29b — Quads.bas:393: `eyestrength * 0.8` (de noche) es Single * Double.
TEST_CASE("RV-29b eyestrength: * 0.8 en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 3999.11011f);
  w.sim.opts.Pondmode = true;
  w.sim.opts.Daytime = false;
  w.sim.opts.FieldHeight = 12000.0f;
  w.sim.opts.Gradient = 1.02f;
  CHECK(eyestrength(w.sim, n) == 0.999807239f);  // antes del arreglo: 0.999807298
}

// RV-29c — Senses.bas:309: `vel.X * Cos(aim) + vel.Y * Sin(aim) * -1 -
// mem(velup)` va en Double y se redondea una vez a X (Single): 49.5 -> CInt
// 50. El port opera en float, da 49.4999962 y publica 49.
TEST_CASE("RV-29c lookoccurr: velocidad relativa en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  const int o = w.addbot(1200.0f, 1000.0f);
  w.sim.rob[n].aim = 1.315f;
  w.sim.rob[o].vel = {0.546f, -51.022f};
  lookoccurr(w.sim, n, o);
  CHECK(w.sim.rob[n].mem[addr::refvelup] == 50);  // antes del arreglo: 49
}

// RV-29d — Quads.bas:482: `theta = Atn(ad.y / ad.x) + PI` (Double + Single, un
// redondeo). Aqui el theta del original (2.68183064) cae justo en el borde
// derecho del ojo 5 (aim - PI/36) y el bot se ve; con el redondeo previo a
// float (2.68183041) quedaba un ulp fuera.
TEST_CASE("RV-29d CompareRobots3: Atn + PI en Double") {
  RvWorld w;
  const int n1 = w.addbot(5000.0f, 5000.0f);
  const int n2 = w.addbot(4789.1875f, 4830.25f);
  w.sim.rob[n1].aim = 2.76909709f;
  CompareRobots3(w.sim, n1, n2);
  CHECK(w.sim.rob[n1].mem[addr::EyeStart + 5] == 80);  // antes del arreglo: 0
  CHECK(w.sim.rob[n1].lastopp == n2);
}

// RV-29e — Senses.bas:431: en lookoccurrShape la velocidad relativa es Double
// de punta a punta y CInt la redondea sin pasar por Single: 59.4999960 -> 59.
TEST_CASE("RV-29e lookoccurrShape: velocidad relativa en Double") {
  RvWorld w;
  const int n = w.addbot(1000.0f, 1000.0f);
  w.sim.rob[n].aim = 2.1f;
  w.sim.Obstacles.resize(2);
  w.sim.Obstacles[1].exist = true;
  w.sim.Obstacles[1].vel = {-54.684f, -36.947f};
  w.sim.numObstacles = 1;
  lookoccurrShape(w.sim, n, 1);
  CHECK(w.sim.rob[n].mem[addr::refvelup] == 59);  // antes del arreglo: 60
}
