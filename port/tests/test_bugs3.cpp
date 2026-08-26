// Casos dorados B-* (70-CASOS-DORADOS.md §9), bloque 3 de M6: shots
// (inmunidad filial, slot tirador, sesgo del early-exit, takewaste, Kills
// sin clamp), sharing de ties, tieportcom, el slot fantasma de TieTorque y
// la capa de energía alcanzable (P4 muerta, venom/poison, suelo de MOVECOST).
#include <cmath>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

struct ShotWorld {
  Sim sim;
  VbRng rng;

  ShotWorld() {
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

  // Shot manual en vuelo hacia +x (los campos que updateshots/NewShotCollision
  // leen).
  vb_long addshot(vb_integer shottype, int parentslot, float x, float y,
                  float vx, float vy, float nrg, float range,
                  vb_integer value) {
    Shot& s = sim.Shots[1];
    s.exist = true;
    s.shottype = shottype;
    s.parent = static_cast<vb_integer>(parentslot);
    s.pos = {x, y};
    s.opos = {x, y};
    s.velocity = {vx, vy};
    s.nrg = nrg;
    s.Range = range;
    s.value = value;
    s.age = 0;
    s.FromSpecie = "X.txt";
    return 1;
  }
};

}  // namespace

// ---------------------------------------------------------------------------
// B-15 · La inmunidad filial está rota (Shots.bas:330) [ciclo]
TEST_CASE("B-15 inmunidad filial: slot del tirador vs AbsNum del padre [PROBABLE BUG] B3-1") {
  SUBCASE("sim divergida: el shot del padre GOLPEA a su hijo") {
    ShotWorld w;
    const int shooter = w.addbot(5000, 5000);
    const int child = w.addbot(10000, 10000);
    w.sim.rob[shooter].AbsNum = 250;   // slots y AbsNum ya divergieron
    w.sim.rob[child].parent = 250;     // hijo del tirador (por AbsNum)
    w.sim.rob[child].age = 0;          // recién nacido

    w.addshot(-4, shooter, 9800, 10000, 400, 0, 2000, 10, 100);
    updateshots(w.sim);

    // s.parent (slot 1) != rob(h).parent (AbsNum 250): la comparación es
    // slot-vs-AbsNum y falla => el hijo recibe el waste (power = 500).
    CHECK(w.sim.rob[child].Waste == 500.0f);
  }

  SUBCASE("contra-caso, sim recién sembrada (slot = AbsNum): inmune") {
    ShotWorld w;
    const int shooter = w.addbot(5000, 5000);
    const int child = w.addbot(10000, 10000);
    CHECK(w.sim.rob[shooter].AbsNum == 1);  // slot 1 = AbsNum 1
    w.sim.rob[child].parent = 1;
    w.sim.rob[child].age = 0;

    w.addshot(-4, shooter, 9800, 10000, 400, 0, 2000, 10, 100);
    updateshots(w.sim);

    CHECK(w.sim.rob[child].Waste == 0.0f);       // no lo tocó
    CHECK(w.sim.Shots[1].flash == false);        // el shot sigue volando
  }
}

// ---------------------------------------------------------------------------
// B-16 · El slot tirador es intocable aunque cambie de dueño (Shots.bas:998)
// [ciclo]
TEST_CASE("B-16 el nuevo ocupante del slot tirador nunca es golpeado [PROBABLE BUG] B3-2") {
  ShotWorld w;
  const int occupant = w.addbot(10000, 10000);  // recién nacido en el slot 1
  w.addshot(-2, occupant, 9800, 10000, 400, 0, 2000, 10, 100);

  // El shot lo disparó el ANTERIOR dueño del slot 1 (ya muerto): la
  // comparación por slot lo protege igualmente.
  CHECK(NewShotCollision(w.sim, 1) == 0);

  // Contra-caso: con otro parent el mismo shot sí lo golpea.
  w.sim.Shots[1].parent = 99;
  w.sim.Shots[1].pos = {9800.0f, 10000.0f};  // reposicionado por la llamada
  CHECK(NewShotCollision(w.sim, 1) == occupant);
}

// ---------------------------------------------------------------------------
// B-17 · Early-exit de la colisión de shots: sesgo por índice
// (Shots.bas:1061) [ciclo]
TEST_CASE("B-17 con t <= 0.2 la búsqueda se detiene: gana el slot bajo [PROBABLE BUG] B3-5") {
  SUBCASE("t_A = 0.15 <= MinBotRadius: golpea A aunque B estaba antes") {
    ShotWorld w;
    const int A = w.addbot(1200, 1000, 50);  // slot 1, impacto en t = 0.15
    const int B = w.addbot(1150, 1000, 50);  // slot 2, impacto en t = 0.10
    (void)B;
    w.sim.MaxBotShotSeperation = 10000.0f;
    w.addshot(-2, 0, 1000, 1000, 1000, 0, 100, 10, 100);

    CHECK(NewShotCollision(w.sim, 1) == A);  // sesgo por orden de slots
  }

  SUBCASE("t_A = 0.3 > 0.2: la búsqueda continúa y gana B (t menor)") {
    ShotWorld w;
    const int A = w.addbot(1350, 1000, 50);  // slot 1, impacto en t = 0.30
    const int B = w.addbot(1150, 1000, 50);  // slot 2, impacto en t = 0.10
    (void)A;
    w.sim.MaxBotShotSeperation = 10000.0f;
    w.addshot(-2, 0, 1000, 1000, 1000, 0, 100, 10, 100);

    CHECK(NewShotCollision(w.sim, 1) == B);
  }
}

// ---------------------------------------------------------------------------
// B-18 · takewaste sin techo inmediato (Shots.bas:816-827) [ciclo]
TEST_CASE("B-18 waste 32400 visible hasta que defacate lo baja en P5 [PROBABLE BUG] B3-6") {
  ShotWorld w;
  const int shooter = w.addbot(5000, 5000);
  const int victim = w.addbot(10000, 10000);
  w.sim.rob[victim].Waste = 31900.0f;

  w.addshot(-4, shooter, 9800, 10000, 400, 0, 2000, 10, 100);  // power = 500
  updateshots(w.sim);

  // Sin clamp en takewaste: 32400 queda visible el resto del paso 14 y
  // P1-P4 (gates de defacate/altzheimer del mismo tick lo ven).
  CHECK(w.sim.rob[victim].Waste == 32400.0f);

  // P5: HandleWaste -> defacate con Waste > 32000: reset a 31500 y descarga
  // de 500 => 31000; Pwaste sube 0.5.
  HandleWaste(w.sim, victim);
  CHECK(w.sim.rob[victim].Waste == 31000.0f);
  CHECK(w.sim.rob[victim].Pwaste == 0.5f);
  CHECK(w.sim.rob[victim].mem[828] == 31000);
}

// ---------------------------------------------------------------------------
// B-24 · Kills 32001 sobre mem(220) sin clamp (Shots.bas:594-595) [ciclo]
TEST_CASE("B-24 matar por shot no clampa Kills: mem(220) = 32001 [PROBABLE BUG] A3-5") {
  ShotWorld w;
  const int shooter = w.addbot(5000, 5000);
  const int victim = w.addbot(10000, 10000);
  w.sim.rob[shooter].Kills = 32000;  // estado inyectado (caso teórico)
  w.sim.rob[victim].nrg = 100.0f;    // morirá por el drenaje del -1

  w.addshot(-1, shooter, 9800, 10000, 400, 0, 2000, 10, 100);  // power = 500
  updateshots(w.sim);

  // releasenrg: EnergyLost 450 > nrg 100 => nrg = 0 => Dead; el tirador
  // acredita el kill SIN clamp (la vía de ties sí clampa, Ties.bas:419-421).
  CHECK(w.sim.rob[victim].Dead);
  CHECK(w.sim.rob[victim].nrg == 0.0f);
  CHECK(w.sim.rob[shooter].Kills == 32001);
  CHECK(w.sim.rob[shooter].mem[220] == 32001);  // 32000 < x < 32768 en mem
}

// ---------------------------------------------------------------------------
// B-22 · El sharing con caps destruye recursos (Robots.bas:1894-1910) [ciclo]
TEST_CASE("B-22 shareslime 90%: 25600 de slime destruidos en silencio [PROBABLE BUG] B4-2") {
  ShotWorld w;
  const int a = w.addbot(10000, 10000);
  const int b = w.addbot(10100, 10000);
  REQUIRE(maketie(w.sim, a, b, 1000, 0, 0));
  w.sim.rob[a].Slime = 32000.0f;
  w.sim.rob[b].Slime = 32000.0f;
  w.sim.rob[a].mem[833] = 90;

  shareslime(w.sim, a, 1);

  // tot = 64000; lado A = 57600 -> cap 32000; lado B = 6400. El total cae
  // de 64000 a 38400: 25600 destruidos.
  CHECK(w.sim.rob[a].Slime == 32000.0f);
  CHECK(w.sim.rob[b].Slime == doctest::Approx(6400.0));
  CHECK(w.sim.rob[a].Slime + w.sim.rob[b].Slime == doctest::Approx(38400.0));
}

// ---------------------------------------------------------------------------
// B-23 · tieportcom y el puerto 0 de la tie de nacimiento (Ties.bas:56-70)
// [ciclo]
TEST_CASE("B-23 la tie de nacimiento es unidireccional inversa [PROBABLE BUG] B4-3") {
  ShotWorld w;
  const int p = w.addbot(10000, 10000);
  const int c = w.addbot(10100, 10000);
  // Tie de nacimiento: puerto del padre = 0, puerto del hijo = su slot de
  // tie (>= 1) — Ties.bas:924,943 / maketie(n, nuovo, sondist, 100, 0).
  REQUIRE(maketie(w.sim, p, c, 1000, 100, 0));
  CHECK(w.sim.rob[p].Ties[1].Port == 0);
  CHECK(w.sim.rob[c].Ties[1].Port == 1);

  // El padre no puede: con tienum = 0 el gate mem(455) != 0 corta...
  w.sim.rob[p].mem[addr::TIENUM] = 0;
  w.sim.rob[p].mem[addr::tieloc] = 900;
  w.sim.rob[p].mem[addr::tieval] = 42;
  tieportcom(w.sim, p);
  CHECK(w.sim.rob[c].mem[900] == 0);
  CHECK(w.sim.rob[p].mem[addr::tieloc] == 900);  // ni se consume

  // ...y con tienum != 0 su puerto 0 nunca matchea.
  w.sim.rob[p].mem[addr::TIENUM] = 5;
  tieportcom(w.sim, p);
  CHECK(w.sim.rob[c].mem[900] == 0);
  CHECK(w.sim.rob[p].mem[addr::tieloc] == 900);

  // El hijo sí (su puerto es 1).
  w.sim.rob[c].mem[addr::TIENUM] = 1;
  w.sim.rob[c].mem[addr::tieloc] = 901;
  w.sim.rob[c].mem[addr::tieval] = 77;
  tieportcom(w.sim, c);
  CHECK(w.sim.rob[p].mem[901] == 77);
  CHECK(w.sim.rob[c].mem[addr::tieloc] == 0);  // consumido en el éxito
}

// ---------------------------------------------------------------------------
// B-27 · El slot fantasma Ties(numties+1) y su .ang heredable
// (Physics.bas:705-712; Ties.bas:883-958) [ciclo]
TEST_CASE("B-27 TieTorque escribe .ang en el slot vacío; maketie no lo inicializa [PROBABLE BUG] B1-2/B4-1") {
  ShotWorld w;
  const int T = w.addbot(10000, 10000);
  const int b1 = w.addbot(10300, 9700);
  const int b2 = w.addbot(10300, 9700);
  const int b3 = w.addbot(10300, 9700);

  // 3 ties con ángulo fijado y desviación ~2.9 rad cada una: mt acumula
  // |mt| = 3*(2.9 - slack) = 8.44 > 2*PI.
  Bot& t = w.sim.rob[T];
  t.numties = 3.0f;
  const int partners[3] = {b1, b2, b3};
  for (int k = 1; k <= 3; ++k) {
    t.Ties[k].pnt = static_cast<vb_integer>(partners[k - 1]);
    t.Ties[k].angreg = true;
    t.Ties[k].ang = 3.6854f;
    t.Ties[k].bend = 0.0f;
  }

  TieTorque(w.sim, T);

  // dlo = AngDiff(angle(T, b3), aim 0) = PI/4; escrito en el slot 4 VACÍO.
  CHECK(t.Ties[4].pnt == 0);
  CHECK(t.Ties[4].ang == doctest::Approx(0.7853982).epsilon(1e-4));
  CHECK(w.sim.diag.err9_ties_slot11 == 0);  // j = 4 <= 10: sin sitio de error

  // Una tie posterior ocupa el slot 4 por creación: maketie NO inicializa
  // .ang => hereda el valor rancio hasta que regang lo pise.
  const int b4 = w.addbot(10100, 10000);
  REQUIRE(maketie(w.sim, T, b4, 1000, 0, 0));
  CHECK(t.Ties[4].pnt == b4);
  CHECK(t.Ties[4].ang == doctest::Approx(0.7853982).epsilon(1e-4));
}

// ---------------------------------------------------------------------------
// B-25 · La pasada anti-gigantes está muerta (Robots.bas:1613-1617;
// bodyfix = 32100) [ciclo]
TEST_CASE("B-25 P4 no mata ni al maximo asesino con bodyfix default [PROBABLE BUG] B5-1") {
  ShotWorld w;
  const int n = w.addbot(10000, 10000);
  w.sim.rob[n].body = 32000.0f;  // máximo alcanzable (clamp de ManageBody)
  w.sim.rob[n].chloroplasts = 0.0f;
  w.sim.rob[n].Kills = 100;

  UpdateBots(w.sim);
  CHECK(w.sim.rob[n].exist);  // 32000 > 32100 nunca: la regla no opera

  SUBCASE("contra-caso de control: con bodyfix = 1000 configurado, P4 mata") {
    w.sim.opts.bodyfix = 1000;
    UpdateBots(w.sim);
    CHECK(!w.sim.rob[n].exist);
  }
}

// ---------------------------------------------------------------------------
// B-26 · Venom 1:1, poison 4:1 (Robots.bas:2010-2089) [ciclo]
TEST_CASE("B-26 el poison es 4x mas barato que el venom [PROBABLE BUG] B5-2") {
  ShotWorld w;  // costes de transacción 0: solo la conversión implícita
  const int v = w.addbot(10000, 10000);
  const int p = w.addbot(11000, 10000);
  w.sim.rob[v].nrg = 1000.0f;
  w.sim.rob[p].nrg = 1000.0f;
  w.sim.rob[v].mem[824] = 100;  // mkvenom
  w.sim.rob[p].mem[826] = 100;  // mkpoison

  MakeStuff(w.sim, v);
  MakeStuff(w.sim, p);

  CHECK(w.sim.rob[v].venom == 100.0f);
  CHECK(w.sim.rob[v].nrg == 900.0f);   // 100 nrg por 100 venom (1:1)
  CHECK(w.sim.rob[v].mem[825] == 100);
  CHECK(w.sim.rob[p].poison == 100.0f);
  CHECK(w.sim.rob[p].nrg == 975.0f);   // 25 nrg por 100 poison (4:1)
  CHECK(w.sim.rob[p].mem[827] == 100);

  SUBCASE("cap de +100 por ciclo") {
    const int c = w.addbot(12000, 10000);
    w.sim.rob[c].nrg = 1000.0f;
    w.sim.rob[c].mem[824] = 500;
    MakeStuff(w.sim, c);
    CHECK(w.sim.rob[c].venom == 100.0f);
    CHECK(w.sim.rob[c].nrg == 900.0f);
  }
}

// ---------------------------------------------------------------------------
// B-28 · El suelo -1000 del coste de movimiento (Physics.bas:452-458) [ciclo]
TEST_CASE("B-28 MOVECOST negativo regala nrg con suelo -1000 [PROBABLE BUG] B5-3") {
  ShotWorld w;
  w.sim.vm.costs.v[cost::MOVECOST] = -10.0f;
  w.sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.0f;
  const int n = w.addbot(10000, 10000);
  Bot& b = w.sim.rob[n];

  // Magnitud 40 (= MaxVelocity, sin clamp): gana 400.
  b.nrg = 5000.0f;
  b.mem[addr::dirup] = 40;
  VoluntaryForces(w.sim, n);
  CHECK(b.nrg == 5400.0f);

  // Magnitud 200 con MaxVelocity 200: coste crudo -2000 -> suelo -1000.
  w.sim.opts.MaxVelocity = 200.0f;
  b.nrg = 5000.0f;
  b.mem[addr::dirup] = 200;
  b.ImpulseInd = {0.0f, 0.0f};
  VoluntaryForces(w.sim, n);
  CHECK(b.nrg == 6000.0f);

  // El techo simétrico: EnergyCost > nrg se recorta a nrg (queda en 0).
  w.sim.vm.costs.v[cost::MOVECOST] = 10.0f;
  b.nrg = 100.0f;
  b.mem[addr::dirup] = 40;
  b.ImpulseInd = {0.0f, 0.0f};
  VoluntaryForces(w.sim, n);
  CHECK(b.nrg == 0.0f);
}

// ===========================================================================
// Capa de virus B3b (transcrita en M6): B-19, B-20, B-21.
// ===========================================================================

namespace {

// Alta con ADN (patrón de test_memory.cpp) para los casos de virus.
int vspawn(Sim& sim, const std::string& dnatext, const std::string& fname,
           float x, float y) {
  const int n = posto(sim);
  Bot& b = sim.rob[n];
  b.exist = true;
  b.FName = fname;
  b.nrg = 20000.0f;
  b.body = 1000.0f;
  REQUIRE(LoadDNAText(dnatext, b, *sim.sysvars));
  makeoccurrlist(sim, n);
  b.DnaLen = static_cast<vb_integer>(DnaLen(b.dna));
  b.genenum = CountGenes(b.dna);
  b.mem[addr::DnaLenSys] = b.DnaLen;
  b.mem[addr::GenesSys] = static_cast<vb_integer>(b.genenum);
  b.pos = {x, y};
  b.aim = 0.0f;
  b.aimvector = {1.0f, 0.0f};
  b.radius = FindRadius(sim, n);
  b.BucketPos = {-2.0f, -2.0f};
  UpdateBotBucket(sim, n);
  return n;
}

}  // namespace

// ---------------------------------------------------------------------------
// B-19 · La slime penetrada amplifica power (Shots.bas:1183-1191) [ciclo]
TEST_CASE("B-19 slime penetrada: queda negativa y AMPLIFICA antes del reset [PROBABLE BUG] B3b-2") {
  ShotWorld w;
  w.sim.opts.TotRunCycle = 5;
  w.sim.TotalRobotsDisplayed = 1;

  SUBCASE("power 10 >= umbral 5: penetra, slime final 0, infección ocurre") {
    const int v = vspawn(w.sim, "start 1 900 store stop", "V.txt", 10000, 10000);
    w.sim.Specie.push_back([]{ Specie sp; sp.Name = "V.txt"; sp.population = 1; sp.Native = false; return sp; }());
    Bot& b = w.sim.rob[v];
    b.Slime = 100.0f;
    const vb_integer olddna = b.DnaLen;

    Shot& s = w.sim.Shots[1];
    s.exist = true;
    s.shottype = -7;
    s.nrg = 400.0f;
    s.Range = 1.0f;
    s.value = 1;  // power = 400/(1*40)*1 = 10
    s.dna.assign(4, Block{0, 1});
    s.DnaLen = 3;

    addgene(w.sim, v, 1);

    // slime = 100 - 10*20 = -100 -> power = 10 - (-100)*0.05 = 15 (mayor
    // que el original; hoy sin reuso) -> slime normalizada a 0.
    CHECK(b.Slime == 0.0f);
    CHECK(b.DnaLen == olddna + 3);  // la infección SÍ ocurre
    CHECK(b.Mutations == 1);
    CHECK(b.LastMut == 1);
    CHECK(b.SubSpecies == 1);
    CHECK(b.LastMutDetail.find("Infected with virus of length  3") !=
          std::string::npos);
  }

  SUBCASE("contra-caso: power 4 < umbral 5: absorbido, slime 20, sin infección") {
    const int v = vspawn(w.sim, "start 1 900 store stop", "V.txt", 10000, 10000);
    Bot& b = w.sim.rob[v];
    b.Slime = 100.0f;
    const vb_integer olddna = b.DnaLen;

    Shot& s = w.sim.Shots[1];
    s.exist = true;
    s.shottype = -7;
    s.nrg = 160.0f;
    s.Range = 1.0f;
    s.value = 1;  // power = 4
    s.dna.assign(4, Block{0, 1});
    s.DnaLen = 3;

    addgene(w.sim, v, 1);

    CHECK(b.Slime == doctest::Approx(20.0));  // 100 - 4*20
    CHECK(b.DnaLen == olddna);
    CHECK(b.Mutations == 0);
  }
}

// ---------------------------------------------------------------------------
// B-20 · Potencia del virus proporcional al número de gen
// (Shots.bas:1124,1183) [ciclo]
TEST_CASE("B-20 el virus del gen 7 lleva 7x la potencia contra la slime [PROBABLE BUG] B3b-3") {
  ShotWorld w;
  w.sim.opts.TotRunCycle = 5;
  w.sim.TotalRobotsDisplayed = 1;
  const std::string genes7 =
      "start 1 900 store stop start 1 900 store stop start 1 900 store stop "
      "start 1 900 store stop start 1 900 store stop start 1 900 store stop "
      "start 1 900 store stop";

  const int m1 = vspawn(w.sim, genes7, "M.txt", 5000, 5000);
  const int m2 = vspawn(w.sim, genes7, "M.txt", 6000, 6000);
  REQUIRE(w.sim.rob[m1].genenum == 7);

  // Bots idénticos fabrican virus del gen 1 y del gen 7: Shots().value = el
  // número de gen (geometría del código).
  REQUIRE(MakeVirus(w.sim, m1, 1));
  REQUIRE(MakeVirus(w.sim, m2, 7));
  const vb_long s1 = w.sim.rob[m1].virusshot;
  const vb_long s2 = w.sim.rob[m2].virusshot;
  CHECK(w.sim.Shots[s1].value == 1);
  CHECK(w.sim.Shots[s2].value == 7);
  // Con vbody = 0, nrg/Range = 40 => power = value exacto al golpear.

  // Misma slime 100 (umbral de absorción 5): el gen-1 (power 1) es
  // absorbido; el gen-7 (power 7) penetra e infecta.
  const int v1 = vspawn(w.sim, "start 1 900 store stop", "V.txt", 10000, 10000);
  const int v2 = vspawn(w.sim, "start 1 900 store stop", "V.txt", 11000, 10000);
  w.sim.Specie.push_back([]{ Specie sp; sp.Name = "V.txt"; sp.population = 2; sp.Native = false; return sp; }());
  w.sim.rob[v1].Slime = 100.0f;
  w.sim.rob[v2].Slime = 100.0f;
  const vb_integer dna1 = w.sim.rob[v1].DnaLen;
  const vb_integer dna2 = w.sim.rob[v2].DnaLen;

  addgene(w.sim, v1, s1);
  CHECK(w.sim.rob[v1].Slime == doctest::Approx(80.0));  // absorbido
  CHECK(w.sim.rob[v1].DnaLen == dna1);

  addgene(w.sim, v2, s2);
  CHECK(w.sim.rob[v2].Slime == 0.0f);  // penetrada (y amplificada, B-19)
  CHECK(w.sim.rob[v2].DnaLen > dna2);  // infectado

  CHECK(w.sim.diag.makevirus_stub == 0);  // la capa B3b ya es real
  CHECK(w.sim.diag.shot_feed_stub == 0);
}

// ---------------------------------------------------------------------------
// B-21 · mem(mkvirus) persistente refabrica (Robots.bas:1049-1112) [ciclo]
TEST_CASE("B-21 un write de mkvirus: un virus incubado indefinidamente, un solo cobro [PROBABLE BUG] B3b-4") {
  ShotWorld w;
  w.sim.vm.costs.v[cost::DNACOPYCOST] = 1.0f;
  w.sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.0f;

  const int n = vspawn(w.sim, "start 1 900 store stop start 2 901 store stop",
                       "M.txt", 10000, 10000);
  Bot& b = w.sim.rob[n];
  REQUIRE(b.genenum == 2);
  REQUIRE(b.chloroplasts == 0.0f);
  const vb_long glen = genelength(w.sim, n, 2);

  // Un solo write de mkvirus; nunca vshoot.
  b.mem[addr::mkvirus] = 2;
  BotDNAManipulation(w.sim, n);

  // Fabricó: Vtimer = 2*genelength, cobro genelength*DNACOPYCOST una vez.
  CHECK(b.virusshot == 1);
  CHECK(w.sim.Shots[1].stored);
  CHECK(w.sim.Shots[1].value == 2);
  CHECK(b.Vtimer == 2 * glen);
  CHECK(b.nrg == 20000.0f - static_cast<float>(glen));
  CHECK(b.mem[addr::mkvirus] == 2);  // NO se consume hasta el disparo

  // Vtimer baja hasta 1 y ESPERA; sin refabricación ni nuevos cobros.
  for (int i = 0; i < 30; ++i) BotDNAManipulation(w.sim, n);
  CHECK(b.Vtimer == 1);
  CHECK(b.mem[addr::Vtimer] == 1);
  CHECK(b.mem[addr::mkvirus] == 2);
  CHECK(b.nrg == 20000.0f - static_cast<float>(glen));

  // El disparo resetea mkvirus; una re-escritura refabrica (nuevo cobro).
  b.mem[addr::VshootSys] = 1;
  BotDNAManipulation(w.sim, n);
  CHECK(b.mem[addr::mkvirus] == 0);
  CHECK(b.virusshot == 0);
  CHECK(b.Vtimer == 0);
  CHECK(w.sim.Shots[1].exist);
  CHECK(!w.sim.Shots[1].stored);  // volando

  const float after_shot = b.nrg;
  b.mem[addr::mkvirus] = 2;
  BotDNAManipulation(w.sim, n);
  CHECK(b.nrg == after_shot - static_cast<float>(glen));  // segundo cobro
  CHECK(b.Vtimer == 2 * glen);
}
