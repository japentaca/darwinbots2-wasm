// Casos dorados B-01..B-37 (70-CASOS-DORADOS.md §9): el catálogo de
// [PROBABLE BUG] como aserciones. Regla 4 del brief: cada bug se testea como
// comportamiento CORRECTO — el port lo replica tal cual.
//
// Bloque 1 (M6): visión de formas — CompareShapes/lookoccurrShape reales
// (B-12, B-13, B-14) + el contador shapes_vision_stub asertado a 0.
#include <cmath>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

struct BugWorld {
  Sim sim;
  VbRng rng;

  BugWorld() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
  }

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

  // Forma (obstáculo) con AABB [x, x+w] x [y, y+h].
  int addshape(float x, float y, float w, float h) {
    sim.numObstacles += 1;
    sim.Obstacles.resize(sim.numObstacles + 1);
    Obstacle& ob = sim.Obstacles[sim.numObstacles];
    ob.exist = true;
    ob.pos = {x, y};
    ob.Width = w;
    ob.Height = h;
    return sim.numObstacles;
  }
};

constexpr float k3PI2 = 3.0f * 3.14159265358979f / 2.0f;  // 3π/2

}  // namespace

// ---------------------------------------------------------------------------
// B-12 · Dentro de una forma, EYEF también va a 32000 (Quads.bas:643-653)
// [ciclo]
//
// El barrido de bots (CompareRobots3) deja un EYEF real; el camino "bot
// dentro de la forma" de CompareShapes pone los 9 ojos a 32000 y ahora
// también EYEF (el original lo dejaba rancio: corregido B2-3).
TEST_CASE("B-12 dentro de una forma, EYEF = 32000 (corregido B2-3) [ciclo]") {
  BugWorld w;
  w.sim.opts.shapesAreVisable = true;
  w.sim.opts.shapesAreSeeThrough = true;  // la oclusión B2-1 taparía al bot

  const int n = w.addbot(10000, 10000);
  const int m = w.addbot(10000, 10300);
  (void)m;
  w.sim.rob[n].aim = k3PI2;  // apuntando al bot de abajo (pantalla: +y)

  const int o = w.addshape(9000, 9000, 2000, 2000);  // el vidente DENTRO

  const int seen = BucketsProximity(w.sim, n);

  // El barrido de bots corrió primero: eye5 vio al bot (edgetoedge = 180,
  // eyedist = 1440, ev = 1/((190/1440)^2) = 57.4 -> CInt 57) y dejó EYEF.
  // CompareShapes después: los 9 ojos a 32000, lastopp/lastopptype de la
  // forma y EYEF (el original conservaba el 57 del barrido de bots).
  for (int i = 0; i <= 8; ++i)
    CHECK(w.sim.rob[n].mem[addr::EyeStart + 1 + i] == 32000);
  CHECK(w.sim.rob[n].lastopp == o);
  CHECK(w.sim.rob[n].lastopptype == 1);
  CHECK(w.sim.rob[n].mem[addr::EYEF] == 32000);
  CHECK(seen == o);

  CHECK(w.sim.diag.shapes_vision_stub == 0);  // el stub de M4 ya no existe
}

// ---------------------------------------------------------------------------
// B-13 · lastopppos se captura para el ojo con foco (Quads.bas:807, 825-831)
// [ciclo]
//
// Con focuseye = 2 (foco en eye7, índice a = 6) la forma se ve, EYEF se carga
// y los refvars de posición son los de la forma. El original solo capturaba
// lastopppos con a = 4 y los dejaba en (0,0) (corregido B2-4).
TEST_CASE("B-13 lastopppos del ojo con foco (corregido B2-4) [ciclo]") {
  // Forma-astilla al sur del bot: pie de perpendicular en (10000, 10500).
  // Ojo apuntado exactamente al pie; anchuras de ojo 0 (hw formas = 35/400).
  SUBCASE("focuseye = 2: eye7 ve y refxpos/refypos son los de la forma") {
    BugWorld w;
    w.sim.opts.shapesAreVisable = true;
    const int n = w.addbot(10000, 10000);
    w.addshape(9999.8f, 10500.0f, 0.4f, 200.0f);
    // eye7 (a = 6): eyeaim = aim - 2*(PI/18); lo apuntamos al pie.
    w.sim.rob[n].aim = k3PI2 + 2.0f * (3.14159265f / 18.0f);
    w.sim.rob[n].mem[addr::FOCUSEYE] = 2;  // Abs(2+4) Mod 9 = 6 -> eye7
    w.sim.Specie.push_back([]{ Specie sp; sp.Name = "T.txt"; sp.population = 1; sp.Native = false; return sp; }());

    WriteSenses(w.sim, n);

    Bot& b = w.sim.rob[n];
    // eye7 = mem(507): pd = (500-60+10)/1440 = 0.3125 -> ev = 10.24 -> 10.
    CHECK(b.mem[507] == 10);
    CHECK(b.mem[505] == 0);  // eye5 no la ve
    CHECK(b.mem[addr::EYEF] == 10);
    CHECK(b.lastopptype == 1);
    CHECK(b.mem[addr::REFTYPE] == 1);
    // La forma está en (10000, 10500): el original daba (0,0).
    CHECK(b.mem[addr::refxpos] == 10000);
    CHECK(b.mem[addr::refypos] == 10500);
    CHECK(w.sim.diag.shapes_vision_stub == 0);
  }

  SUBCASE("contra-caso focuseye = 0: eye5 captura lastopppos") {
    BugWorld w;
    w.sim.opts.shapesAreVisable = true;
    const int n = w.addbot(10000, 10000);
    w.addshape(9999.8f, 10500.0f, 0.4f, 200.0f);
    w.sim.rob[n].aim = k3PI2;  // eye5 al pie
    w.sim.rob[n].mem[addr::FOCUSEYE] = 0;
    w.sim.Specie.push_back([]{ Specie sp; sp.Name = "T.txt"; sp.population = 1; sp.Native = false; return sp; }());

    WriteSenses(w.sim, n);

    Bot& b = w.sim.rob[n];
    CHECK(b.mem[505] == 10);
    CHECK(b.mem[addr::EYEF] == 10);
    // a = 4 capturó el pie de perpendicular (10000, 10500).
    CHECK(b.mem[addr::refxpos] == 10000);
    CHECK(b.mem[addr::refypos] == 10500);
  }
}

// ---------------------------------------------------------------------------
// B-14 · Anchura de ojo: la misma fórmula para bots y formas (Quads.bas:534-535
// vs 736-738) [unit]
//
// eyeXwidth = 1300: el semiancho es (1300 Mod 1256)/400 + PI/36 = 0.1972665
// rad contra bots y contra formas. El original usaba para formas
// (1300+35)/400 = 3.3375 normalizado a [0, PI] = 0.1959073 rad, y un objetivo
// a 0.1970 rad del eje era visible como BOT e invisible como FORMA
// (corregido B2-5).
//
// Geometría: objetivo a 500 twips; forma-astilla de 0.4 twips de ancho (los
// rayos de borde del ojo fallan con delta > hw + atan(0.2/500) = 0.19631);
// bot-objetivo de radio 0.1 (umbral bots = 0.19727 + 0.0002).
TEST_CASE("B-14 anchura de ojo igual para bots y formas (corregido B2-5) [unit]") {
  auto shape_seen = [](float delta) {
    BugWorld w;
    w.sim.opts.shapesAreVisable = true;
    const int n = w.addbot(10000, 10000);
    w.addshape(9999.8f, 10500.0f, 0.4f, 200.0f);
    w.sim.rob[n].mem[addr::EYE1WIDTH + 4] = 1300;
    w.sim.rob[n].aim = k3PI2 + delta;
    BucketsProximity(w.sim, n);
    return w.sim.rob[n].mem[505];
  };
  auto bot_seen = [](float delta) {
    BugWorld w;
    const int n = w.addbot(10000, 10000);
    w.addbot(10000, 10500, 0.1f);
    w.sim.rob[n].mem[addr::EYE1WIDTH + 4] = 1300;
    w.sim.rob[n].aim = k3PI2 + delta;
    BucketsProximity(w.sim, n);
    return w.sim.rob[n].mem[505];
  };

  // delta = 0.1950: dentro de ambos campos.
  // Forma: lowestDist = 500, eyedist = 1440*(1-ln(79/35)/4) = 1146.93,
  // pd = (500-60+10)/1146.93 = 0.39235 -> ev = 6.496 -> CInt 6.
  CHECK(shape_seen(0.1950f) == 6);
  CHECK(bot_seen(0.1950f) > 0);

  // delta = 0.1970: dentro de ambos campos (0.19727); el original no veía la
  // forma.
  CHECK(shape_seen(0.1970f) > 0);
  CHECK(bot_seen(0.1970f) > 0);

  // delta = 0.1990: fuera de ambos.
  CHECK(shape_seen(0.1990f) == 0);
  CHECK(bot_seen(0.1990f) == 0);
}
