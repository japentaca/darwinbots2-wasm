// E7 — Internet (70-CASOS-DORADOS.md §14). La rebanada de core de la etapa:
// los globales de proceso que SaveOrganism/SaveRobotBody/LoadRobotBody leen
// (IntOpts.IName, sunbelt, MDIForm1.SaveWithoutMutations, y_eco_im) viven en
// Sim.fmt y el TICK los pasa a CheckTeleporters (P0a) y a
// UpdateTeleporters (paso 18). Hasta E7 el tick los pasaba por defecto y el
// .dbo que sale por un teleporter llevaba siempre LastOwner = "" y
// sunbelt = False (HDRoutines.bas:232, :2211-2213).
// Inventario RNG: E7 consume 0 extracciones (E7-04).
#include <string>
#include <vector>

#include "doctest.h"
#include "dbcore/formats.hpp"
#include "dbcore/master.hpp"

using namespace db;

namespace {

struct World {
  VbRng rng;
  Sim sim;

  World() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
    sim.opts.DisableMutations = true;
  }

  // Alta manual sin consumo de RNG (patrón de test_registro.cpp).
  int spawn(const std::string& fname, float x, float y) {
    const int n = posto(sim);
    Bot& b = sim.rob[n];
    b.exist = true;
    b.FName = fname;
    b.nrg = 20000.0f;
    b.body = 1000.0f;
    REQUIRE(LoadDNAText("cond start 0 .up store stop", b, *sim.sysvars));
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
    sim.MaxAbsNum += 1;
    b.AbsNum = sim.MaxAbsNum;
    return n;
  }

  // Puerto fijo (sin deriva: 0 RNG de DriftTeleporter) centrado en (cx, cy).
  // Internet con PollCountDown = 0: expulsa en P0a del próximo tick (B7-2).
  Teleporter& port(bool internet, float cx, float cy) {
    sim.numTeleporters += 1;
    const int i = sim.numTeleporters;
    Teleporter& tp = sim.Teleporters[static_cast<std::size_t>(i)];
    tp = Teleporter{};
    tp.exist = true;
    tp.Internet = internet;
    tp.Out = !internet;
    tp.teleportVeggies = true;
    tp.teleportHeterotrophs = true;
    tp.Width = 1000.0f;
    tp.Height = 1000.0f;
    tp.pos = {cx - 500.0f, cy - 300.0f};  // center = (x + W/2, y + 0.3 H)
    tp.InboundPollCycles = 10;
    tp.BotsPerPoll = 10;
    tp.PollCountDown = 0;
    MoveTeleporter(sim, i);
    return tp;
  }

  void tick() { UpdateSim(sim); }

  int find(const std::string& fname) const {
    for (int t = 1; t <= sim.MaxRobs; ++t)
      if (sim.rob[t].exist && sim.rob[t].FName == fname) return t;
    return 0;
  }
};

// Viaje completo por el tick: el emisor expulsa en P0a y el receptor lo
// carga en el paso 18 de SU tick (Internet: posición al azar, 2 RNG).
struct Trip {
  World tx, rx;
  int cell = 0;
  std::vector<unsigned char> record;

  explicit Trip(bool internet = true) {
    cell = tx.spawn("Viajero.txt", 5000.0f, 5000.0f);
    tx.port(internet, 5000.0f, 5000.0f);
    rx.port(true, 20000.0f, 20000.0f);
  }

  // Devuelve el slot del organismo recibido (0 si no llegó).
  int go() {
    tx.tick();
    Teleporter& out = tx.sim.Teleporters[1];
    REQUIRE(out.outbox.size() == 1);
    record = out.outbox[0];
    rx.sim.Teleporters[1].inbox.push_back(record);
    rx.tick();
    return rx.find("Viajero.txt");
  }
};

}  // namespace

// ---------------------------------------------------------------------------
TEST_CASE("E7-01 LastOwner: el tick estampa IntOpts.IName al expulsar") {
  SUBCASE("con apodo: el receptor ve el apodo del emisor") {
    Trip t;
    t.tx.sim.fmt.IName = "Pepe";
    const int n = t.go();
    REQUIRE(n > 0);
    CHECK(t.rx.sim.rob[n].LastOwner == "Pepe");
    // El emisor estampa la célula ANTES de serializarla y matarla
    // (HDRoutines.bas:232): el campo queda escrito en el slot muerto.
    CHECK(!t.tx.sim.rob[t.cell].exist);
    CHECK(t.tx.sim.rob[t.cell].LastOwner == "Pepe");
  }
  SUBCASE("sin apodo: \"\" y el cargador lo convierte en \"Local\"") {
    Trip t;
    const int n = t.go();
    REQUIRE(n > 0);
    CHECK(t.rx.sim.rob[n].LastOwner == "Local");
  }
  SUBCASE("el puerto Out local también estampa (SaveOrganism es común)") {
    Trip t(false);
    t.tx.sim.fmt.IName = "Pepe";
    const int n = t.go();
    REQUIRE(n > 0);
    CHECK(t.rx.sim.rob[n].LastOwner == "Pepe");
  }
  SUBCASE("el apodo del RECEPTOR no pisa el del emisor al cargar") {
    Trip t;
    t.tx.sim.fmt.IName = "Pepe";
    t.rx.sim.fmt.IName = "Otro";
    const int n = t.go();
    REQUIRE(n > 0);
    CHECK(t.rx.sim.rob[n].LastOwner == "Pepe");
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E7-02 sunbelt: el registro del tick lleva el global de la sim") {
  // SaveRobotBody escribe el Boolean global `sunbelt` (HDRoutines.bas:2211-2213)
  // y LoadRobotBody pone a 0 las 4 tasas sunbelt si el registro dice False
  // (:1884, :1968-1975). El port tiene un solo global: sim.sunbelt.
  SUBCASE("sunbelt encendido: las tasas viajan") {
    Trip t;
    t.tx.sim.sunbelt = true;
    t.tx.sim.rob[t.cell].Mutables.mutarray[mut::P2UP] = 7.0f;
    t.tx.sim.rob[t.cell].Mutables.mutarray[mut::CE2UP] = 3.0f;
    const int n = t.go();
    REQUIRE(n > 0);
    CHECK(t.rx.sim.rob[n].Mutables.mutarray[mut::P2UP] == 7.0f);
    CHECK(t.rx.sim.rob[n].Mutables.mutarray[mut::CE2UP] == 3.0f);
  }
  SUBCASE("sunbelt apagado: el cargador las borra") {
    Trip t;
    t.tx.sim.rob[t.cell].Mutables.mutarray[mut::P2UP] = 7.0f;
    const int n = t.go();
    REQUIRE(n > 0);
    CHECK(t.rx.sim.rob[n].Mutables.mutarray[mut::P2UP] == 0.0f);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E7-03 SaveWithoutMutations: el registro del tick lo respeta") {
  // HDRoutines.bas:2112-2116: con la opción del menú el detalle de
  // mutaciones se reemplaza por el texto fijo.
  Trip t;
  t.tx.sim.fmt.SaveWithoutMutations = true;
  t.tx.sim.rob[t.cell].LastMutDetail = "detalle largo";
  const int n = t.go();
  REQUIRE(n > 0);
  CHECK(t.rx.sim.rob[n].LastMutDetail ==
        "Mutation Details removed in last save.");

  Trip u;
  u.tx.sim.rob[u.cell].LastMutDetail = "detalle largo";
  const int m = u.go();
  REQUIRE(m > 0);
  CHECK(u.rx.sim.rob[m].LastMutDetail == "detalle largo");
}

// ---------------------------------------------------------------------------
TEST_CASE("E7-04 inventario: 0 RNG y Sim.fmt no se persiste") {
  SUBCASE("mismo flujo RNG con y sin globales") {
    Trip a, b;
    b.tx.sim.fmt.IName = "Pepe";
    b.tx.sim.sunbelt = true;
    b.tx.sim.fmt.SaveWithoutMutations = true;
    b.rx.sim.fmt.IName = "Otro";
    REQUIRE(a.go() > 0);
    REQUIRE(b.go() > 0);
    CHECK(a.tx.rng() == b.tx.rng());
    CHECK(a.rx.rng() == b.rx.rng());
    // El receptor quedó igual salvo el LastOwner.
    const int na = a.rx.find("Viajero.txt");
    const int nb = b.rx.find("Viajero.txt");
    CHECK(a.rx.sim.rob[na].pos.x == b.rx.sim.rob[nb].pos.x);
    CHECK(a.rx.sim.rob[na].pos.y == b.rx.sim.rob[nb].pos.y);
  }
  SUBCASE("SaveSimulation no escribe Sim.fmt") {
    World a, b;
    a.spawn("X.txt", 3000.0f, 3000.0f);
    b.spawn("X.txt", 3000.0f, 3000.0f);
    b.sim.fmt.IName = "Pepe";
    b.sim.fmt.y_eco_im = 1;
    VbBinFile fa, fb;
    SaveSimulation(a.sim, fa);
    SaveSimulation(b.sim, fb);
    CHECK(fa.data == fb.data);
  }
}
