// Casos dorados F-01..F-15 (70-CASOS-DORADOS.md §5): física y visión
// deterministas. Corren como [unit] sobre las rutinas reales de M4:
// CalcMass/FindRadius/iceil/UpdatePosition, TieHooke/TieTorque, Repel3,
// angle/angnorm/AngDiff, la visión de Quads.bas y los sectores de touch.
//
// Erratas de la spec corregidas contra el fuente (el fuente manda):
//  - F-07: angle(0,0,-10,10) = atan(+1)+PI = 3.926991 (la tabla decía
//    2.356194, arrastrando el atan(-1) de la fila anterior).
//  - F-10: edgetoedgedist = 0 da 32000 (el test del fuente es `<= 0`,
//    Quads.bas:566; la tabla decía 20736).
#include <cmath>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

struct PhysWorld {
  Sim sim;
  VbRng rng;

  PhysWorld() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
  }

  // Bot mínimo con radio dado (sin RNG), registrado en su bucket.
  int addbot(float x, float y, float radius = 60.0f, float mass = 1.0f) {
    const int n = posto(sim);
    Bot& b = sim.rob[n];
    b.exist = true;
    b.FName = "T.txt";
    b.pos = {x, y};
    b.aim = 0.0f;
    b.aimvector = {1.0f, 0.0f};
    b.radius = radius;
    b.mass = mass;
    b.nrg = 20000.0f;
    b.body = 1000.0f;
    b.BucketPos = {-2.0f, -2.0f};
    UpdateBotBucket(sim, n);
    return n;
  }
};

}  // namespace

// ---------------------------------------------------------------------------
TEST_CASE("F-01 CalcMass: masa con cloroplastos, clamp [1, 32000]") {
  PhysWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];

  auto mass = [&](float body, float shell, float chlr) {
    b.body = body;
    b.shell = shell;
    b.chloroplasts = chlr;
    CalcMass(w.sim, n);
    return b.mass;
  };

  CHECK(mass(1000, 0, 0) == 1.0f);       // justo el clamp inferior
  CHECK(mass(5000, 200, 0) == 6.0f);
  CHECK(mass(100, 0, 0) == 1.0f);        // 0.1 -> clamp
  CHECK(mass(1000, 0, 16000) == 15841.0f);
  CHECK(mass(32000, 32000, 32000) == 31872.0f);  // máximo alcanzable
}

// ---------------------------------------------------------------------------
TEST_CASE("F-02 FindRadius [FP·Q07]") {
  PhysWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];

  auto radius = [&](float body, float chlr) {
    b.body = body;
    b.chloroplasts = chlr;
    return FindRadius(w.sim, n);
  };

  CHECK(radius(1000, 0) == doctest::Approx(114.2788).epsilon(1e-5));
  CHECK(radius(5000, 0) == doctest::Approx(209.5441).epsilon(1e-5));
  CHECK(radius(32000, 0) == doctest::Approx(415.4751).epsilon(1e-5));
  CHECK(radius(1000, 16000) == doctest::Approx(264.6394).epsilon(1e-5));
  CHECK(radius(1, 0) == 1.0f);  // Log(1) = 0 => suelo

  w.sim.opts.FixedBotRadii = true;
  CHECK(radius(1000, 0) == 60.0f);  // half
}

// ---------------------------------------------------------------------------
TEST_CASE("F-03 iceil: clamp ±32000 + CInt bancario") {
  CHECK(iceil(5.5f) == 6);
  CHECK(iceil(4.5f) == 4);
  CHECK(iceil(32000.7f) == 32000);
  CHECK(iceil(40000.0f) == 32000);
  CHECK(iceil(-40000.0f) == -32000);
  CHECK(iceil(-5.5f) == -6);
}

// ---------------------------------------------------------------------------
TEST_CASE("F-04 UpdatePosition: integración, clamp y publicaciones") {
  PhysWorld w;
  const int n = w.addbot(1000, 1000);
  Bot& b = w.sim.rob[n];
  b.mass = 1.0f;
  b.AddedMass = 0.0f;

  SUBCASE("impulso (3,4): integra y publica") {
    b.ImpulseInd = {3.0f, 4.0f};
    UpdatePosition(w.sim, n);
    CHECK(b.vel.x == 3.0f);
    CHECK(b.vel.y == 4.0f);
    CHECK(b.pos.x == 1003.0f);
    CHECK(b.pos.y == 1004.0f);
    CHECK(b.mem[addr::velscalar] == 5);  // iceil(sqrt(25))
    CHECK(b.mem[addr::vel] == 3);
    CHECK(b.mem[addr::veldn] == -3);
    CHECK(b.mem[addr::veldx] == 4);
    CHECK(b.mem[addr::velsx] == -4);
    CHECK(b.mem[addr::masssys] == 1);
    CHECK(b.mem[addr::maxvelsys] == 40);
    // Siempre: los impulsos quedan a 0 al salir.
    CHECK(b.ImpulseInd.x == 0.0f);
    CHECK(b.ImpulseInd.y == 0.0f);
    CHECK(b.ImpulseRes.x == 0.0f);
    CHECK(b.ImpulseStatic == 0.0f);
  }
  SUBCASE("impulso (0,100): satura a MaxVelocity") {
    b.ImpulseInd = {0.0f, 100.0f};
    UpdatePosition(w.sim, n);
    CHECK(b.vel.x == doctest::Approx(0.0));
    CHECK(b.vel.y == doctest::Approx(40.0).epsilon(1e-6));
    CHECK(b.pos.y == doctest::Approx(1040.0).epsilon(1e-6));
  }
  SUBCASE("Fixed: velocidad a 0, posición intacta") {
    b.Fixed = true;
    b.ImpulseInd = {3.0f, 4.0f};
    UpdatePosition(w.sim, n);
    CHECK(b.vel.x == 0.0f);
    CHECK(b.vel.y == 0.0f);
    CHECK(b.pos.x == 1000.0f);
    CHECK(b.ImpulseInd.x == 0.0f);
  }
  SUBCASE("clamp lateral B-24: vel entrante ±32000/eje in place") {
    b.vel = {50000.0f, 0.0f};
    UpdatePosition(w.sim, n);
    // VectorMagnitudeSquare clampó vel.x a 32000 antes de medir; después el
    // clamp de velocidad la deja en MaxVelocity.
    CHECK(b.vel.x == doctest::Approx(40.0).epsilon(1e-6));
    CHECK(b.pos.x == doctest::Approx(1040.0).epsilon(1e-6));
    CHECK(b.mem[addr::velscalar] == 40);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("F-05 muelle de tie con zona muerta") {
  PhysWorld w;
  const int n = w.addbot(1130, 1000, 10.0f);
  const int m = w.addbot(1000, 1000, 10.0f);
  REQUIRE(maketie(w.sim, n, m, 300, 0, 1));
  w.sim.rob[n].Ties[1].NaturalLength = 100.0f;  // el caso fija 100
  w.sim.rob[m].Ties[1].NaturalLength = 100.0f;

  Bot& bn = w.sim.rob[n];

  SUBCASE("length 130: recorte a -10, tira de n hacia m") {
    TieHooke(w.sim, n);
    CHECK(bn.ImpulseInd.x == doctest::Approx(-0.1).epsilon(1e-5));
    CHECK(bn.ImpulseInd.y == doctest::Approx(0.0));
    // El otro extremo recibe su mitad en SU pasada, no aquí.
    CHECK(w.sim.rob[m].ImpulseInd.x == 0.0f);
  }
  SUBCASE("length 110 y 85: zona muerta, cero fuerza") {
    bn.pos.x = 1110.0f;
    TieHooke(w.sim, n);
    CHECK(bn.ImpulseInd.x == 0.0f);
    bn.pos.x = 1085.0f;
    TieHooke(w.sim, n);
    CHECK(bn.ImpulseInd.x == 0.0f);
  }
  SUBCASE("length 70: recorte a +10, empuja n alejándose") {
    bn.pos.x = 1070.0f;
    TieHooke(w.sim, n);
    CHECK(bn.ImpulseInd.x == doctest::Approx(0.1).epsilon(1e-5));
  }
  SUBCASE("amortiguación -bv") {
    bn.vel = {2.0f, 0.0f};
    TieHooke(w.sim, n);
    CHECK(bn.ImpulseInd.x == doctest::Approx(-0.14).epsilon(1e-5));
  }
  SUBCASE("reloj: last 100 decrementa; last -20 incrementa") {
    bn.Ties[1].last = 100;
    TieHooke(w.sim, n);
    CHECK(bn.Ties[1].last == 99);
    bn.Ties[1].last = -20;
    TieHooke(w.sim, n);
    CHECK(bn.Ties[1].last == -19);
  }
  SUBCASE("last -1 dispara regang (endurecimiento)") {
    // El incremento del reloj corre ANTES del chequeo == -1
    // (Physics.bas:522,529): se entra con -2 y regang dispara al llegar a -1.
    bn.Ties[1].last = -2;
    TieHooke(w.sim, n);
    CHECK(bn.Ties[1].last == -1);
    CHECK(bn.Ties[1].type == 3);
    CHECK(bn.Ties[1].k == 0.05f);
    CHECK(bn.Ties[1].b == 0.1f);
    CHECK(bn.Multibot);
  }
  SUBCASE("last llega a 1: DeleteTie") {
    bn.Ties[1].last = 2;
    TieHooke(w.sim, n);
    CHECK(bn.Ties[1].pnt == 0);
    CHECK(bn.numties == 0.0f);
    CHECK(w.sim.rob[m].numties == 0.0f);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("F-06 Repel3 con masas dadas") {
  PhysWorld w;
  const int r1 = w.addbot(1000, 1000, 60.0f, 1.0f);
  const int r2 = w.addbot(1100, 1000, 60.0f, 3.0f);
  Bot& b1 = w.sim.rob[r1];
  Bot& b2 = w.sim.rob[r2];
  b1.vel = {10.0f, 0.0f};
  b2.vel = {-5.0f, 0.0f};
  b2.nrg = 5000.0f;  // para ver refvars poblados en b1

  SUBCASE("caso central: separación por masas invertidas + impulso 1-D") {
    Repel3(w.sim, r1, r2);
    // Separación: 20/(1+55^0.3) = 4.6218; el ligero retrocede más (3/4).
    CHECK(b1.pos.x == doctest::Approx(996.53).epsilon(1e-4));
    CHECK(b2.pos.x == doctest::Approx(1101.16).epsilon(1e-4));
    // Velocidades del choque 1-D con e = 0.
    CHECK(b1.vel.x == doctest::Approx(-1.1375).epsilon(1e-5));
    CHECK(b2.vel.x == doctest::Approx(-1.2875).epsilon(1e-5));
    // Momento conservado: 10*1 - 5*3 = -5.
    CHECK(b1.vel.x * 1.0f + b2.vel.x * 3.0f ==
          doctest::Approx(-5.0).epsilon(1e-4));
    // Efectos sensoriales inmediatos en ambos.
    CHECK(b1.mem[addr::hit] == 1);
    CHECK(b2.mem[addr::hit] == 1);
    CHECK(b1.mem[addr::hitup] == 1);  // contacto de frente (aim 0)
    CHECK(b2.mem[addr::hitdn] == 1);  // contacto por detrás
    CHECK(b1.lasttch == r2);
    CHECK(b2.lasttch == r1);
    CHECK(b1.mem[addr::occurrstart + 9] == 5000);  // refnrg del tocado
  }
  SUBCASE("variante Fixed: masa 32000 y vel intacta") {
    b2.Fixed = true;
    Repel3(w.sim, r1, r2);
    // El intermedio V2*(e+1)*M2 = -158400 supera ±32000 y el clamp ByRef de
    // VectorScalar (B-24 / 30-FISICA.md §0.3) lo recorta a -32000 ANTES de
    // dividir: V1f = -32000/32001 = -0.999969; 10 - 9.9 + V1f = -0.899969.
    CHECK(b1.vel.x == doctest::Approx(-0.899969).epsilon(1e-4));
    CHECK(b2.vel.x == -5.0f);  // no se toca
  }
  SUBCASE("ambos quietos: mitad y mitad sin masas") {
    b1.vel = {0.0f, 0.0f};
    b2.vel = {0.0f, 0.0f};
    Repel3(w.sim, r1, r2);
    CHECK(b1.pos.x == doctest::Approx(990.0).epsilon(1e-5));
    CHECK(b2.pos.x == doctest::Approx(1110.0).epsilon(1e-5));
    CHECK(std::fabs(b1.vel.x) < 1e-5f);  // solo los pisos ±1e-6
    CHECK(std::fabs(b2.vel.x) < 1e-5f);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("F-07 angle/angnorm/AngDiff [FP·Q07]") {
  CHECK(vb_angle(0, 0, 10, 0) == doctest::Approx(0.0));
  CHECK(vb_angle(0, 0, 0, 10) == doctest::Approx(4.712389).epsilon(1e-6));
  CHECK(vb_angle(0, 0, 0, -10) == doctest::Approx(1.570796).epsilon(1e-6));
  CHECK(vb_angle(0, 0, 10, 10) == doctest::Approx(-0.785398).epsilon(1e-6));
  CHECK(angnorm(vb_angle(0, 0, 10, 10)) ==
        doctest::Approx(5.497787).epsilon(1e-6));
  // Errata de la spec: dy = -10, dx = -10 => atan(+1) + PI = 3.926991
  // (la tabla de F-07 decía 2.356194).
  CHECK(vb_angle(0, 0, -10, 10) == doctest::Approx(3.926991).epsilon(1e-6));
  CHECK(angnorm(-0.5f) == doctest::Approx(5.783185).epsilon(1e-6));
  CHECK(angnorm(7.0f) == doctest::Approx(0.716815).epsilon(1e-5));
  CHECK(AngDiff(0.5f, 6.0f) == doctest::Approx(0.783185).epsilon(1e-5));
  CHECK(AngDiff(6.0f, 0.5f) == doctest::Approx(-0.783185).epsilon(1e-5));
}

// ---------------------------------------------------------------------------
TEST_CASE("F-08 AbsoluteEyeWidth y NarrowestEye") {
  CHECK(AbsoluteEyeWidth(0) == 35);
  CHECK(AbsoluteEyeWidth(100) == 135);
  CHECK(AbsoluteEyeWidth(1256) == 35);
  CHECK(AbsoluteEyeWidth(-100) == 1191);
  CHECK(AbsoluteEyeWidth(1221) == 1256);  // máximo alcanzable
  CHECK(AbsoluteEyeWidth(-35) == 1256);

  PhysWorld w;
  const int n = w.addbot(1000, 1000);
  CHECK(NarrowestEye(w.sim, n) == 35);  // las 9 anchuras a 0
}

// ---------------------------------------------------------------------------
TEST_CASE("F-09 EyeSightDistance y eyestrength [FP·Q07]") {
  PhysWorld w;
  const int n = w.addbot(1000, 1000);

  CHECK(EyeSightDistance(w.sim, 35, n) == 1440.0f);
  CHECK(EyeSightDistance(w.sim, 70, n) ==
        doctest::Approx(1190.467).epsilon(1e-5));
  CHECK(EyeSightDistance(w.sim, 1256, n) ==
        doctest::Approx(151.0779).epsilon(1e-4));

  w.sim.opts.Daytime = false;  // x0.8, nunca amplifica
  CHECK(EyeSightDistance(w.sim, 35, n) == doctest::Approx(1152.0));
}

// ---------------------------------------------------------------------------
TEST_CASE("F-10 eyevalue y el ojo con foco") {
  CHECK(eyevalue_from_dist(350, 1440) == doctest::Approx(16.0).epsilon(1e-5));
  CHECK(eyevalue_from_dist(110, 1440) == doctest::Approx(144.0).epsilon(1e-5));
  // Errata de la spec: el fuente testea `<= 0` (Quads.bas:566) => 32000
  // también con distancia borde-a-borde exactamente 0 (la tabla decía 20736).
  CHECK(eyevalue_from_dist(0, 1440) == 32000.0f);
  CHECK(eyevalue_from_dist(-5, 1440) == 32000.0f);

  // Abs(focuseye + 4) Mod 9: plegado no monótono de negativos.
  CHECK(FocusEyeIndex(0) == 4);    // eye5
  CHECK(FocusEyeIndex(-4) == 0);   // eye1
  CHECK(FocusEyeIndex(4) == 8);    // eye9
  CHECK(FocusEyeIndex(5) == 0);
  CHECK(FocusEyeIndex(-13) == 0);
  CHECK(FocusEyeIndex(-5) == 1);
  CHECK(FocusEyeIndex(-3) == 1);   // -5 y -3 dan el mismo ojo
}

// ---------------------------------------------------------------------------
TEST_CASE("F-11 anchura negativa => ojo panorámico [PROBABLE BUG] B2-2") {
  PhysWorld w;
  // Observador con aim 0; objetivo a 110° (fuera de todo ojo normal) a
  // distancia 200 (el ojo negativo ve ~274 twips: 891 de anchura absoluta).
  const int obs = w.addbot(5000, 5000, 1.0f);
  const int tgt = w.addbot(4931.596f, 4812.062f, 1.0f);

  SUBCASE("con eye5width = -400 el ojo casi panorámico lo ve") {
    w.sim.rob[obs].mem[addr::EYE1WIDTH + 4] = -400;
    CompareRobots3(w.sim, obs, tgt);
    CHECK(w.sim.rob[obs].mem[505] == 2);  // eyevalue ~1.74 -> CInt 2
    CHECK(w.sim.rob[obs].lastopp == tgt);  // eye5 tiene el foco
    CHECK(w.sim.rob[obs].mem[addr::EYEF] == w.sim.rob[obs].mem[505]);
    for (int cell = 501; cell <= 509; ++cell)
      if (cell != 505) CHECK(w.sim.rob[obs].mem[cell] == 0);
  }
  SUBCASE("control: con anchuras por defecto no lo ve ningún ojo") {
    CompareRobots3(w.sim, obs, tgt);
    for (int cell = 501; cell <= 509; ++cell)
      CHECK(w.sim.rob[obs].mem[cell] == 0);
    CHECK(w.sim.rob[obs].lastopp == 0);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("F-12 TieTorque: clamp de nay con Sgn(nax) [PROBABLE BUG] B1-1") {
  PhysWorld w;
  const vb_single slack = 5.0f * 2.0f * PI / 360.0f;

  SUBCASE("nax = -150, nay = 130 crudos => (-100, -100)") {
    const int t = w.addbot(10000, 10000, 10.0f);
    const int n = w.addbot(3500, 2500, 10.0f);
    Bot& bt = w.sim.rob[t];
    bt.aim = vb_angle(10000, 10000, 3500, 2500);  // dlo = 0
    bt.numties = 1;
    bt.Ties[1].pnt = static_cast<vb_integer>(n);
    bt.Ties[1].angreg = true;
    bt.Ties[1].ang = -(2.0f + slack);  // mm = 2.0 tras la holgura
    bt.Ties[1].bend = 0.0f;

    TieTorque(w.sim, t);

    // Crudos: nax = -150, nay = +130; clamps: nax -> -100,
    // nay -> 100*Sgn(nax) = -100 (el componente Y invierte su signo).
    CHECK(bt.ImpulseInd.x == doctest::Approx(-100.0));
    CHECK(bt.ImpulseInd.y == doctest::Approx(-100.0));
    CHECK(w.sim.rob[n].ImpulseInd.x == doctest::Approx(100.0));
    CHECK(w.sim.rob[n].ImpulseInd.y == doctest::Approx(100.0));
    // mt = 2.0 >= PI/4 => ma saturado a PI/4.
    CHECK(bt.ma == doctest::Approx(PI / 4).epsilon(1e-6));
    CHECK(bt.Ties[1].bend == 0.0f);  // .tieang consumido
  }
  SUBCASE("control: |nay| <= 100 no se toca") {
    const int t = w.addbot(10000, 10000, 10.0f);
    const int n = w.addbot(6000, 2500, 10.0f);
    Bot& bt = w.sim.rob[t];
    bt.aim = vb_angle(10000, 10000, 6000, 2500);
    bt.numties = 1;
    bt.Ties[1].pnt = static_cast<vb_integer>(n);
    bt.Ties[1].angreg = true;
    bt.Ties[1].ang = -(2.0f + slack);

    TieTorque(w.sim, t);

    // Crudos: nax = -150 -> -100; nay = +80 se conserva.
    CHECK(bt.ImpulseInd.x == doctest::Approx(-100.0));
    CHECK(bt.ImpulseInd.y == doctest::Approx(80.0).epsilon(1e-3));
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("F-13 la librería de vectores muta sus argumentos [PROBABLE BUG] B1-3") {
  {
    Vector V = {40000.0f, 2.0f};
    Vector r = VectorScalar(V, 3.0f);
    CHECK(r.x == 96000.0f);
    CHECK(r.y == 6.0f);
    CHECK(V.x == 32000.0f);  // clampado in place
    CHECK(V.y == 2.0f);
  }
  {
    Vector V = {50000.0f, 0.0f};
    const vb_single r = VectorMagnitudeSquare(V);
    CHECK(r == 32000.0f * 32000.0f);
    CHECK(V.x == 32000.0f);  // clampado in place
  }
  CHECK(VectorMagnitude({3.0f, 4.0f}) == doctest::Approx(5.0));
  CHECK(VectorMagnitude({1e-6f, 0.0f}) == 0.0f);  // guarda 0.00001
  CHECK(VectorInvMagnitude({0.0f, 0.0f}) == -1.0f);  // centinela
}

// ---------------------------------------------------------------------------
TEST_CASE("F-14 oclusión por formas rota: transposición + Or [PROBABLE BUG] B2-1") {
  PhysWorld w;
  w.sim.Obstacles.push_back({true, {1000.0f, 1000.0f}, 400.0f, 100.0f});
  w.sim.numObstacles = 1;
  const int n1 = w.addbot(955, 1035, 10.0f);
  const int n2 = w.addbot(1035, 955, 10.0f);

  // La línea de visión NO cruza el rectángulo real; la versión transpuesta
  // con `useT Or useS` la declara bloqueada igualmente.
  CHECK(ShapeBlocksBot(w.sim, n1, n2, 1));
  CHECK(AnyShapeBlocksBot(w.sim, n1, n2));

  // Control: ambos bots a la izquierda del AABB => el weed-out (correcto)
  // deja pasar la visión.
  const int n3 = w.addbot(900, 1035, 10.0f);
  const int n4 = w.addbot(950, 955, 10.0f);
  CHECK(!ShapeBlocksBot(w.sim, n3, n4, 1));
}

// ---------------------------------------------------------------------------
TEST_CASE("F-15 touch: sectores del contacto") {
  PhysWorld w;
  const int n = w.addbot(0, 0, 10.0f);
  Bot& b = w.sim.rob[n];

  auto reset = [&] {
    for (int i = 202; i <= 207; ++i) b.mem[i] = 0;
    b.mem[addr::hitup] = b.mem[addr::hitdn] = 0;
    b.mem[addr::hitdx] = b.mem[addr::hitsx] = 0;
    b.mem[addr::hit] = 0;
  };

  reset();
  touch(w.sim, n, 10, 0);  // dang = 0 => frente
  CHECK(b.mem[addr::hitup] == 1);
  CHECK(b.mem[addr::hit] == 1);
  CHECK(b.mem[addr::hitdx] == 0);

  reset();
  touch(w.sim, n, -10, 0);  // dang = 3.14 => atrás
  CHECK(b.mem[addr::hitdn] == 1);

  reset();
  touch(w.sim, n, 0, 10);  // dang = 1.57 => derecha
  CHECK(b.mem[addr::hitdx] == 1);

  reset();
  touch(w.sim, n, 0, -10);  // dang = 4.71 => izquierda
  CHECK(b.mem[addr::hitsx] == 1);

  // touch recibe X/Y como Long (Senses.bas:21, RV-28): 10*tan(0.775) = 9.79
  // llega como 10 y el contacto cae a 45 grados => derecha.
  reset();
  touch(w.sim, n, 10.0f, 10.0f * std::tan(0.775f));
  CHECK(b.mem[addr::hitup] == 0);
  CHECK(b.mem[addr::hitdx] == 1);

  // Umbral 0.78 (literal Double): comparadores estrictos. Los umbrales finos
  // se prueban con taste, que recibe Single y comparte la geometría. Justo
  // debajo marca frente y justo encima marca derecha.
  auto reset_sh = [&] {
    for (int i = 209; i <= 213; ++i) b.mem[i] = 0;
  };
  reset_sh();
  taste(w.sim, n, 10.0f, 10.0f * std::tan(0.775f), 1);
  CHECK(b.mem[addr::shup] == 1);
  CHECK(b.mem[addr::shdx] == 0);

  reset_sh();
  taste(w.sim, n, 10.0f, 10.0f * std::tan(0.785f), 1);
  CHECK(b.mem[addr::shup] == 0);
  CHECK(b.mem[addr::shdx] == 1);

  {
    // Búsqueda del dang exacto 0.78f alrededor de 10*tan(0.78). El Single
    // 0.78f (0.779999971) es MENOR que el Double 0.78: marca frente.
    float dy = 10.0f * std::tan(0.78f);
    for (int i = 0; i < 600; ++i)
      dy = std::nextafter(dy, 0.0f);
    bool found = false;
    for (int i = 0; i < 1200 && !found; ++i) {
      if (senses_detail::impact_dang(b, 10.0f, dy) == 0.78f) found = true;
      else dy = std::nextafter(dy, 100.0f);
    }
    if (found) {
      reset_sh();
      taste(w.sim, n, 10.0f, dy, 1);
      CHECK(b.mem[addr::shup] == 1);
      CHECK(b.mem[addr::shdx] == 0);
    }
  }

  // taste replica la geometría escribiendo el tipo y shang = dang*200. De
  // frente con aim = 0: `6.28 - aim` se redondea a 6.28f y la vuelta
  // `dang + 6.28` (Double) deja dang = 6.27999973, no 0 => shang = 1256.
  reset_sh();
  taste(w.sim, n, 10, 0, -2);
  CHECK(b.mem[addr::shup] == -2);
  CHECK(b.mem[addr::shflav] == -2);
  CHECK(b.mem[209] == 1256);
}

// ---------------------------------------------------------------------------
// Señal del reemplazo de los stubs de M3 (README/PROGRESO): tras un tick con
// colisión, tie, disparo y visión, los contadores reemplazados siguen a 0.
TEST_CASE("M4: los contadores de stub reemplazados quedan a 0") {
  PhysWorld w;
  const int a = w.addbot(1000, 1000);   // solapa con b => Repel3
  const int b = w.addbot(1060, 1000);
  REQUIRE(LoadDNAText("stop", w.sim.rob[a], *w.sim.sysvars));
  REQUIRE(LoadDNAText("stop", w.sim.rob[b], *w.sim.sysvars));
  REQUIRE(maketie(w.sim, a, b, 300, 0, 1));
  w.sim.rob[a].mem[addr::shoot] = -1;   // dispara en P5
  for (int i = 0; i < 3; ++i) UpdateSim(w.sim);

  CHECK(w.sim.diag.bordercolls_stub == 0);
  CHECK(w.sim.diag.tie_force_stub == 0);
  CHECK(w.sim.diag.tietorque_stub == 0);
  CHECK(w.sim.diag.vision_sweep_stub == 0);
  CHECK(w.sim.diag.shot_collision_simplified == 0);
  CHECK(w.sim.diag.bot_collision_simplified == 0);
  // Y los sitios de error de M4 no se alcanzaron.
  CHECK(w.sim.diag.err9_ties_slot11 == 0);
  CHECK(w.sim.diag.err11_gravity_physmoving0 == 0);
}
