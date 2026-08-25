// Casos dorados B-* (70-CASOS-DORADOS.md §9), bloque 2 de M6: bugs sobre las
// capas ya portadas — ciclo, ties, shots y física. Regla 4: cada bug se
// asierta como comportamiento correcto.
#include <cmath>
#include <string>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

struct BugWorld2 {
  Sim sim;
  VbRng rng;

  BugWorld2() {
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

  // Alta con ADN (mismo patrón que test_memory.cpp).
  int spawn(const std::string& dnatext, const std::string& fname, float x,
            float y) {
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
};

}  // namespace

// ---------------------------------------------------------------------------
// B-01 · Shock destruye la energía (Robots.bas:1281-1297) [ciclo]
TEST_CASE("B-01 Shock: nrg = 0 y el body extra nunca aparece [PROBABLE BUG] A1-1") {
  BugWorld2 w;
  const int n = w.addbot(10000, 10000);
  Bot& b = w.sim.rob[n];
  b.Veg = false;
  b.body = 100.0f;

  // Pérdida de 4500 sobre onrg 8000: nrg 3500 > 3000 y 4500 > onrg/2 = 4000.
  b.onrg = 8000.0f;
  b.nrg = 3500.0f;
  Shock(w.sim, n);
  CHECK(b.nrg == 0.0f);
  CHECK(b.body == 100.0f);  // body += nrg/10 corre DESPUÉS de nrg = 0: suma 0

  // Contra-caso: pérdida bajo la mitad no dispara.
  b.onrg = 6000.0f;
  b.nrg = 3500.0f;
  b.body = 100.0f;
  Shock(w.sim, n);
  CHECK(b.nrg == 3500.0f);

  // Contra-caso: nrg = 3000 exacto no pasa la guarda nrg > 3000.
  b.onrg = 8000.0f;
  b.nrg = 3000.0f;
  Shock(w.sim, n);
  CHECK(b.nrg == 3000.0f);
}

// ---------------------------------------------------------------------------
// B-02 · KillRobot(0) desde la matanza por presión (Master.bas:429-465)
// [integración]
TEST_CASE("B-02 matanza por presión sin candidato: KillRobot(0) [PROBABLE BUG] A1-3") {
  BugWorld2 w;
  // 126 bots ricos: totlen = 126*32000 = 4.032e6 > 4e6; nrg + body*10 =
  // 321000, ninguno bajo el umbral 320000 (estricto).
  for (int i = 0; i < 126; ++i) {
    const int n = w.addbot(500.0f + 200.0f * (i % 60),
                           500.0f + 200.0f * (i / 60));
    w.sim.rob[n].DnaLen = 32000;
    w.sim.rob[n].body = 32000.0f;
    w.sim.rob[n].nrg = 1000.0f;
  }
  w.sim.TotalRobotsDisplayed = 126;
  w.sim.rob[1].LastMutDetail = "punto en 5";

  MemoryPressureKill(w.sim);

  // Ningún vivo murió: selectrobot quedó en 0 y el slot 0 fantasma recibió
  // las 21 "muertes" (maxdel = CLng(1500*126*425/4.032e6) = 20; For 0..20).
  for (int t = 1; t <= 126; ++t) CHECK(w.sim.rob[t].exist);
  CHECK(!w.sim.rob[0].exist);
  // totlen > 3e6 también borra LastMutDetail de todos los slots.
  CHECK(w.sim.rob[1].LastMutDetail.empty());

  SUBCASE("contra-caso: un pobre bajo el umbral muere") {
    const int poor = w.addbot(30000, 30000);
    w.sim.rob[poor].DnaLen = 100;
    w.sim.rob[poor].nrg = 100.0f;
    w.sim.rob[poor].body = 10.0f;  // 200 < 320000
    MemoryPressureKill(w.sim);
    CHECK(!w.sim.rob[poor].exist);
    for (int t = 1; t <= 126; ++t) CHECK(w.sim.rob[t].exist);
  }
}

// ---------------------------------------------------------------------------
// B-03 · UpdateTieAngles sobre slots vacíos: sin efecto (Ties.bas:79-120)
// [ciclo] — aserción de PARIDAD (Q11): la pasada escribe mem(450)=mem(451)=0
// del slot muerto y posto lo borra entero al reutilizarlo.
TEST_CASE("B-03 UpdateTieAngles sobre slot vacío no tiene efecto observable [PROBABLE BUG] A1-6") {
  BugWorld2 w;
  const int n = w.addbot(10000, 10000);
  KillRobot(w.sim, n);
  CHECK(!w.sim.rob[n].exist);

  // Residuos en el slot muerto.
  w.sim.rob[n].mem[addr::TIEANG] = 77;
  w.sim.rob[n].mem[addr::TIELEN] = 88;

  UpdateTieAngles(w.sim, n);  // P5 la llama sin chequear exist
  CHECK(w.sim.rob[n].mem[addr::TIEANG] == 0);
  CHECK(w.sim.rob[n].mem[addr::TIELEN] == 0);

  // posto reutiliza el slot y lo deja en blanco: el residuo muere ahí.
  w.sim.rob[n].mem[addr::TIEANG] = 55;
  const int reused = posto(w.sim);
  CHECK(reused == n);
  CHECK(w.sim.rob[n].mem[addr::TIEANG] == 0);
}

// ---------------------------------------------------------------------------
// B-04 · Reproducirse y morir en el mismo ciclo (Robots.bas:1659-1696)
// [ciclo]
TEST_CASE("B-04 encolado doble: primero nace el hijo, después muere el padre [PROBABLE BUG] A1-7") {
  BugWorld2 w;
  const int p = w.spawn("stop", "A.txt", 10000, 10000);
  const int hole = w.spawn("stop", "B.txt", 20000, 20000);
  KillRobot(w.sim, hole);  // slot libre de un ciclo anterior

  const vb_long pabs = w.sim.rob[p].AbsNum;
  w.sim.rob[p].mem[addr::Repro] = 50;

  // Ambos encolados en el mismo ciclo (repro + muerte por veneno letal).
  w.sim.rep[1] = p;
  w.sim.rp = 2;
  w.sim.kil[1] = p;
  w.sim.kl = 2;

  ReproduceAndKill(w.sim);

  // El hijo nació en el slot libre (nunca el del padre) y el padre murió
  // DESPUÉS de reproducirse.
  CHECK(w.sim.rob[hole].exist);
  CHECK(w.sim.rob[hole].parent == pabs);
  CHECK(!w.sim.rob[p].exist);
}

// ---------------------------------------------------------------------------
// B-30 · nbody As Integer: el body del hijo redondea bancario en SINGLE
// (Robots.bas:2108,2140) [ciclo]
TEST_CASE("B-30 reparto de body con redondeo bancario de Single [PROBABLE BUG] B6-4") {
  // Errata de spec corregida contra el fuente (2026-08-25): con Single
  // ESTRICTO por operacion (Q07/premisa del EXE), 501/100*50 = 250.500015
  // (un ULP sobre .5) -> 251 y 503 -> 252: no hay empate. Los empates
  // exactos existen cuando body/100 es representable: 525 -> 262.5 -> 262
  // (par, baja) y 475 -> 237.5 -> 238 (par, sube).
  auto child_body = [](float body) {
    BugWorld2 w;
    const int p = w.spawn("stop", "A.txt", 10000, 10000);
    w.sim.rob[p].body = body;
    Reproduce(w.sim, p, 50);
    REQUIRE(w.sim.rob[2].exist);
    // El padre pierde exactamente nbody.
    CHECK(w.sim.rob[p].body == body - w.sim.rob[2].body);
    return w.sim.rob[2].body;
  };

  CHECK(child_body(501.0f) == 251.0f);  // 250.500015f: sin empate, sube
  CHECK(child_body(503.0f) == 252.0f);  // 251.500015f: sin empate, sube
  CHECK(child_body(525.0f) == 262.0f);  // 262.5f EXACTO: bancario al par
  CHECK(child_body(475.0f) == 238.0f);  // 237.5f EXACTO: bancario al par
}

// ---------------------------------------------------------------------------
// B-05 · trefnrg congelado a 32000 (Ties.bas:721-723) [ciclo]
TEST_CASE("B-05 socio a tope de energía es invisible en trefnrg [PROBABLE BUG] A3-3") {
  BugWorld2 w;
  const int a = w.addbot(10000, 10000);
  const int b = w.addbot(10100, 10000);
  w.sim.rob[b].nrg = 32000.0f;
  REQUIRE(maketie(w.sim, a, b, 1000, 0, 0));

  // La celda trae el valor de otro socio anterior: se conserva.
  w.sim.rob[a].mem[464] = 1234;
  ReadTRefVars(w.sim, a, 1);
  CHECK(w.sim.rob[a].mem[464] == 1234);

  // Con 31999 sí se actualiza (guarda < 32000 estricta).
  w.sim.rob[b].nrg = 31999.0f;
  ReadTRefVars(w.sim, a, 1);
  CHECK(w.sim.rob[a].mem[464] == 31999);
}

// ---------------------------------------------------------------------------
// B-06 · El espionaje de ojos por tie mira mem(479) (Ties.bas:756-758)
// [ciclo]
TEST_CASE("B-06 View se decide con trefaim, no con tmemloc [PROBABLE BUG] A3-4") {
  BugWorld2 w;
  const int a = w.addbot(10000, 10000);
  const int b = w.addbot(10100, 10000);
  w.sim.rob[b].mem[addr::AimSys] = 400;  // aim publicado fuera de 501..509
  REQUIRE(maketie(w.sim, a, b, 1000, 0, 0));  // ReadTRefVars deja mem(479)=400
  CHECK(w.sim.rob[a].mem[479] == 400);

  // A espía el ojo 505 de B: el View de B NO se marca (chequea mem(479)).
  w.sim.rob[b].mem[505] = 4321;
  w.sim.rob[a].mem[476] = 505;
  ReadTRefVars(w.sim, a, 1);
  CHECK(w.sim.rob[a].mem[475] == 4321);  // la lectura sí funciona
  CHECK(!w.sim.rob[b].View);             // el flag no se marca: bug

  // Contra-caso: el aim publicado de B cae en 501..509 => View espurio,
  // aunque tmemloc apunte a una celda que no es un ojo.
  w.sim.rob[b].mem[addr::AimSys] = 505;  // aim ~2.525 rad publicado
  ReadTRefVars(w.sim, a, 1);             // deja mem(479) = 505
  CHECK(!w.sim.rob[b].View);             // el chequeo fue antes de la escritura
  w.sim.rob[a].mem[476] = 100;           // celda espiada: NO es un ojo
  ReadTRefVars(w.sim, a, 1);
  CHECK(w.sim.rob[b].View);              // marcado espurio via mem(479)
}

// ---------------------------------------------------------------------------
// B-07 · hitang (mem 221) no tiene escritor (21-MEMORIA.md §9.6) [ciclo]
TEST_CASE("B-07 hitang es memoria libre con nombre [PROBABLE BUG] A3-6") {
  BugWorld2 w;
  const int n = w.addbot(10000, 10000);
  const int m = w.addbot(10060, 10000);
  Bot& b = w.sim.rob[n];
  b.mem[221] = 123;

  // Golpes por los cuatro flancos + sabor + colisión completa.
  touch(w.sim, n, 10100, 10000);
  touch(w.sim, n, 9900, 10000);
  touch(w.sim, n, 10000, 10100);
  touch(w.sim, n, 10000, 9900);
  taste(w.sim, n, 10100, 10000, -2);
  BucketsCollision(w.sim, n);
  (void)m;

  CHECK(b.mem[addr::hit] == 1);
  CHECK(b.mem[221] == 123);  // intacta: ningún camino del motor la escribe
}

// ---------------------------------------------------------------------------
// B-08 · ChangeChlr suma signos (Robots.bas:1236-1260) [ciclo]
TEST_CASE("B-08 ChangeChlr: mkchlr 1 y rmchlr -100 COMPRAN 101 [PROBABLE BUG] A3-10") {
  BugWorld2 w;
  w.sim.vm.costs.v[cost::CHLRCOST] = 0.2f;
  w.sim.vm.costs.v[cost::COSTMULTIPLIER] = 1.0f;

  const int n = w.addbot(10000, 10000);
  Bot& b = w.sim.rob[n];
  b.Veg = false;
  b.chloroplasts = 100.0f;
  b.nrg = 5000.0f;
  b.mem[addr::mkchlr] = 1;
  b.mem[addr::rmchlr] = -100;

  ChangeChlr(w.sim, n);
  CHECK(b.chloroplasts == 201.0f);  // 100 + 1 - (-100)
  CHECK(b.nrg == doctest::Approx(4979.8).epsilon(1e-5));  // cobra 101*0.2
  CHECK(b.mem[addr::mkchlr] == 0);
  CHECK(b.mem[addr::rmchlr] == 0);

  SUBCASE("contra-caso: la compra que arruina se anula sin cobrar") {
    b.chloroplasts = 100.0f;
    b.nrg = 110.0f;
    b.mem[addr::mkchlr] = 1;
    b.mem[addr::rmchlr] = -100;
    ChangeChlr(w.sim, n);
    CHECK(b.chloroplasts == 100.0f);  // newnrg 89.8 < 100 => anulada
    CHECK(b.nrg == 110.0f);
    CHECK(b.mem[addr::mkchlr] == 0);
  }
}

// ---------------------------------------------------------------------------
// B-09 · ReSpawn toroidal traslada el organismo entero (Physics.bas:774-841;
// Multibots.bas:9-49) [integración]
TEST_CASE("B-09 multibot que cruza el borde toroidal: las 3 células saltan juntas [PROBABLE BUG] B1-4") {
  BugWorld2 w;
  w.sim.opts.Dxsxconnected = true;

  const int a = w.addbot(30, 5000);    // cruzando el borde izquierdo
  const int b = w.addbot(330, 5000);
  const int c = w.addbot(630, 5000);
  REQUIRE(maketie(w.sim, a, b, 1000, 0, 0));
  REQUIRE(maketie(w.sim, b, c, 1000, 0, 0));
  w.sim.rob[a].Multibot = true;
  w.sim.rob[b].Multibot = true;
  w.sim.rob[c].Multibot = true;

  bordercolls(w.sim, a);

  // El objetivo es FieldWidth - smudge = 31890; nmin = la célula más cercana
  // (c, en 630): dx = (31890 - 630) - 1 = 31259 aplicado a las TRES células.
  CHECK(w.sim.rob[a].pos.x == doctest::Approx(31289.0));
  CHECK(w.sim.rob[b].pos.x == doctest::Approx(31589.0));
  CHECK(w.sim.rob[c].pos.x == doctest::Approx(31889.0));
  // Geometría relativa idéntica.
  CHECK(w.sim.rob[b].pos.x - w.sim.rob[a].pos.x == doctest::Approx(300.0));
  CHECK(w.sim.rob[c].pos.x - w.sim.rob[b].pos.x == doctest::Approx(300.0));
  // opos sincronizado: actvel no registrará el salto (paso 17).
  for (int t : {a, b, c}) {
    CHECK(w.sim.rob[t].opos.x == w.sim.rob[t].pos.x);
    CHECK(w.sim.rob[t].opos.y == w.sim.rob[t].pos.y);
  }
}

// ---------------------------------------------------------------------------
// B-10 · Los corpses colisionan y se ven (Quads.bas:223-271,401-592) [ciclo]
TEST_CASE("B-10 corpse: visible, colisiona, da touch y refvars [PROBABLE BUG] B1-5") {
  BugWorld2 w;
  const int L = w.addbot(10000, 10000);
  const int C = w.addbot(10060, 10000);
  Bot& corpse = w.sim.rob[C];
  corpse.Corpse = true;
  corpse.FName = "Corpse";
  corpse.nrg = 0.0f;
  corpse.body = 1000.0f;
  corpse.CantSee = true;
  corpse.DisableDNA = true;
  corpse.mem[addr::REFTYPE] = 55;  // residuo para detectar escrituras

  // (c) El corpse es visible para los ojos (sin filtro en CompareRobots3).
  BucketsProximity(w.sim, L);
  CHECK(w.sim.rob[L].mem[505] == 32000);  // solapados
  CHECK(w.sim.rob[L].lastopp == C);

  // (a) La colisión ocurre y el vivo recibe touch + refvars del corpse.
  BucketsCollision(w.sim, L);
  CHECK(w.sim.rob[L].mem[addr::hit] == 1);
  CHECK(w.sim.rob[L].mem[addr::hitup] == 1);
  CHECK(w.sim.rob[L].mem[addr::REFTYPE] == 0);
  CHECK(w.sim.rob[L].mem[addr::occurrstart + 9] == 0);     // refnrg 0
  CHECK(w.sim.rob[L].mem[addr::refbody] == 1000);          // refbody REAL
  for (int i = 1; i <= 8; ++i)
    CHECK(w.sim.rob[L].mem[addr::occurrstart + i] == 0);   // occurr borrado

  // (b) El corpse recibe touch, pero su lookoccurr de vidente no corre.
  CHECK(corpse.mem[addr::hit] == 1);
  CHECK(corpse.mem[addr::REFTYPE] == 55);  // lookoccurr salió por Corpse
}

// ---------------------------------------------------------------------------
// B-11 · Bots fuera del campo colisionan en el borde de la rejilla
// (Quads.bas:80-91) [ciclo]
TEST_CASE("B-11 bucket-clamp: pos.x = -5000 vive en la celda 0 [PROBABLE BUG] B1-6") {
  BugWorld2 w;
  const int a = w.addbot(-5000, 1000);
  const int b = w.addbot(-4900, 1000);

  CHECK(w.sim.rob[a].BucketPos.x == 0.0f);
  CHECK(w.sim.rob[a].BucketPos.y == 0.0f);
  CHECK(w.sim.rob[b].BucketPos.x == 0.0f);

  // Sigue viendo...
  BucketsProximity(w.sim, a);
  CHECK(w.sim.rob[a].lastopp == b);
  CHECK(w.sim.rob[a].mem[505] == 32000);  // 100 twips, radios 60: solapan

  // ...y colisionando como si estuviera en el borde.
  BucketsCollision(w.sim, a);
  CHECK(w.sim.rob[a].mem[addr::hit] == 1);
  CHECK(w.sim.rob[b].mem[addr::hit] == 1);
}
