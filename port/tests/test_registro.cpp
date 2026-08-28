// E6 — registro y análisis (70-CASOS-DORADOS.md §13). Los tres campos de
// observación del `Type robot` que el port no había necesitado —
// `ga()` (Robots.bas:328, poblado en DNA.bas:75-82/:152/:1181), `console`
// (:288, aquí el bit `consoleOpen`) y `dbgstring` (:355, DNA.bas:545/557)— y
// `Database.bas` completo (Snapshot de los vivos + AddRecord por muerte,
// disparado desde KillRobot bajo SimOpts.DeadRobotSnp).
// Inventario RNG: E6 no consume ninguna extracción (todo corre con
// InjectedRnd vacío).
#include <string>
#include <vector>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

struct World {
  InjectedRnd rng{std::vector<vb_single>{}};
  Sim sim;

  World() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
    sim.opts.DisableMutations = true;
  }

  // Alta manual sin consumo de RNG (patrón de test_gamemodes.cpp).
  int spawn(const std::string& dnatext, const std::string& fname) {
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
    b.pos = {1000.0f, 1000.0f};
    b.aim = 0.0f;
    b.aimvector = {1.0f, 0.0f};
    b.radius = FindRadius(sim, n);
    b.BucketPos = {-2.0f, -2.0f};
    UpdateBotBucket(sim, n);
    sim.MaxAbsNum += 1;
    b.AbsNum = sim.MaxAbsNum;
    return n;
  }
};

// Dos genes: el primero con condición verdadera, el segundo con falsa.
const char* kDnaTwoGenes =
    "cond 1 1 = start 10 .up store stop "
    "cond 1 2 = start 20 .dn store stop";

}  // namespace

// ---------------------------------------------------------------------------
TEST_CASE("E6-01 ga(): el gate de DNA.bas:75 y los genes que dispararon") {
  World w;
  const int n = w.spawn(kDnaTwoGenes, "Bicho.txt");
  REQUIRE(w.sim.rob[n].genenum == 2);

  SUBCASE("sin foco ni consola el array ni se dimensiona") {
    w.sim.robfocus = 0;
    ExecRobs(w.sim);
    CHECK(w.sim.rob[n].ga.empty());
  }
  SUBCASE("con foco: solo el gen de condición verdadera queda marcado") {
    w.sim.robfocus = static_cast<vb_integer>(n);
    ExecRobs(w.sim);
    REQUIRE(w.sim.rob[n].ga.size() == 3);  // ReDim ga(genenum) => 0..2
    CHECK(w.sim.rob[n].ga[0] == false);
    CHECK(w.sim.rob[n].ga[1] == true);
    CHECK(w.sim.rob[n].ga[2] == false);
    CHECK(w.sim.rob[n].mem[addr::dirup] == 10);
    CHECK(w.sim.rob[n].mem[addr::dirdn] == 0);
  }
  SUBCASE("la consola abierta activa el mismo gate sin mover robfocus") {
    w.sim.robfocus = 0;
    w.sim.rob[n].consoleOpen = true;
    ExecRobs(w.sim);
    REQUIRE(w.sim.rob[n].ga.size() == 3);
    CHECK(w.sim.rob[n].ga[1] == true);
  }
  SUBCASE("se rehace en cada ciclo: el gen 2 se marca cuando su cond da true") {
    w.sim.robfocus = static_cast<vb_integer>(n);
    ExecRobs(w.sim);
    CHECK(w.sim.rob[n].ga[2] == false);
    // Segundo gen: `1 2 =` nunca es cierto, así que el marcado no puede
    // "quedarse pegado" de un ciclo al siguiente.
    ExecRobs(w.sim);
    CHECK(w.sim.rob[n].ga[1] == true);
    CHECK(w.sim.rob[n].ga[2] == false);
  }
}

TEST_CASE("E6-02 ga(): el cuerpo sin stores marca igual (DNA.bas:1179-1183)") {
  World w;
  // Gen 1 sin un solo store: el único marcado posible es el del epílogo de
  // `stop` — el fix de Botsareus 3/24/2012 que el fuente documenta.
  const int n = w.spawn("cond 1 1 = start stop cond 1 2 = start stop", "B.txt");
  REQUIRE(w.sim.rob[n].genenum == 2);
  w.sim.robfocus = static_cast<vb_integer>(n);
  ExecRobs(w.sim);
  REQUIRE(w.sim.rob[n].ga.size() == 3);
  CHECK(w.sim.rob[n].ga[1] == true);
  CHECK(w.sim.rob[n].ga[2] == false);
}

TEST_CASE("E6-03 dbgstring: la traza de debugint/debugbool") {
  World w;

  SUBCASE("debugint: valor y posición del token") {
    const int n = w.spawn("start 5 debugint drop stop", "D.txt");
    ExecRobs(w.sim);
    CHECK(w.sim.rob[n].dbgstring == "\r\n5 at position 3");
  }
  SUBCASE("debugbool: True/False, no -1/0") {
    const int n = w.spawn("start 1 1 = debugbool stop", "D.txt");
    ExecRobs(w.sim);
    CHECK(w.sim.rob[n].dbgstring == "\r\nTrue at position 5");
  }
  SUBCASE("se acumula dentro del ciclo y se vacía al empezar el siguiente") {
    const int n = w.spawn("start 5 debugint 7 debugint drop drop stop",
                          "D.txt");
    ExecRobs(w.sim);
    const std::string first = w.sim.rob[n].dbgstring;
    CHECK(first == "\r\n5 at position 3\r\n7 at position 5");
    ExecRobs(w.sim);
    CHECK(w.sim.rob[n].dbgstring == first);  // DNA.bas:86 limpia y rehace
  }
  SUBCASE("la traza no depende del gate de ga(): siempre se escribe") {
    const int n = w.spawn("start 5 debugint drop stop", "D.txt");
    w.sim.robfocus = 0;
    ExecRobs(w.sim);
    CHECK(w.sim.rob[n].dbgstring == "\r\n5 at position 3");
    CHECK(w.sim.rob[n].ga.empty());
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E6-04 AddRecord: el snapshot de los muertos que dispara KillRobot") {
  World w;
  const int a = w.spawn("cond 1 1 = start 10 .up store stop", "Presa.txt");
  const int v = w.spawn("cond 1 1 = start 10 .up store stop", "Alga.txt");
  w.sim.rob[v].Veg = true;

  SUBCASE("con DeadRobotSnp apagado no se registra nada") {
    KillRobot(w.sim, a);
    CHECK(w.sim.deadSnp.records == 0);
    CHECK(w.sim.deadSnp.snp.empty());
    CHECK(w.sim.deadSnp.started == false);
  }

  SUBCASE("cabeceras una sola vez y un registro por muerte") {
    w.sim.opts.DeadRobotSnp = true;
    KillRobot(w.sim, a);
    REQUIRE(w.sim.deadSnp.records == 1);
    const std::string head =
        "Rob id,Parent id,Founder name,Generation,Birth cycle,Age,Mutations,"
        "New mutations,Dna length,Offspring number,kills,Fitness,Energy,"
        "Chloroplasts\r\n";
    CHECK(w.sim.deadSnp.snp.compare(0, head.size(), head) == 0);
    CHECK(w.sim.deadSnp.mut.compare(0, 25, "Rob id,Mutation History\r\n") == 0);
    // El registro arranca con dos saltos y las 11 primeras columnas.
    const std::string body = w.sim.deadSnp.snp.substr(head.size());
    const std::string id = std::to_string(w.sim.rob[a].AbsNum);
    CHECK(body.compare(0, 4, "\r\n\r\n") == 0);
    CHECK(body.find("\r\n\r\n" + id + ",0,Presa.txt,0,0,0,0,0,10,0,0,") == 0);
    // Fitness = Energía = nrg + body*10 = 30000; cloroplastos 0.
    CHECK(body.find(",0,0,30000,30000,0\r\n") != std::string::npos);
    // El ADN detokenizado cierra el registro.
    CHECK(body.find("cond") != std::string::npos);
    CHECK(body.find("store") != std::string::npos);

    KillRobot(w.sim, v);  // sin SnpExcludeVegs el vegetal también entra
    CHECK(w.sim.deadSnp.records == 2);
    // La cabecera no se repite (`If Dir(path) = ""` del fuente).
    CHECK(w.sim.deadSnp.snp.find(head, 1) == std::string::npos);
  }

  SUBCASE("SnpExcludeVegs excluye a los vegetales") {
    w.sim.opts.DeadRobotSnp = true;
    w.sim.opts.SnpExcludeVegs = true;
    KillRobot(w.sim, v);
    CHECK(w.sim.deadSnp.records == 0);
    CHECK(w.sim.deadSnp.started == false);  // ni se abrieron los "archivos"
    KillRobot(w.sim, a);
    CHECK(w.sim.deadSnp.records == 1);
  }

  SUBCASE("DnaLen = 1 crea las cabeceras pero no deja registro") {
    // Botsareus 6/16/2016: la guarda corre DESPUÉS de abrir los archivos.
    w.sim.opts.DeadRobotSnp = true;
    const int e = posto(w.sim);
    w.sim.rob[e].exist = true;
    w.sim.rob[e].FName = "Vacio.txt";
    w.sim.rob[e].DnaLen = 1;
    KillRobot(w.sim, e);
    CHECK(w.sim.deadSnp.started == true);
    CHECK(w.sim.deadSnp.records == 0);
    CHECK(w.sim.deadSnp.snp.find("Vacio.txt") == std::string::npos);
  }

  SUBCASE("el slot fantasma 0 de MemoryPressureKill también deja registro") {
    // KillRobot(0) del [PROBABLE BUG] A1-3/B-02: rob(0) tiene DnaLen 0, así
    // que la guarda `If .DnaLen = 1` no lo salva y el original escribe la
    // fila. Su Fitness suma la descendencia de todo bot con parent = 0.
    w.sim.opts.DeadRobotSnp = true;
    KillRobot(w.sim, 0);
    CHECK(w.sim.deadSnp.records == 1);
    CHECK(w.sim.deadSnp.snp.find("\r\n\r\n0,0,,0,0,0,0,0,0,0,0,") !=
          std::string::npos);
  }

  SUBCASE("drain() vacía el texto pero el archivo sigue existiendo") {
    w.sim.opts.DeadRobotSnp = true;
    KillRobot(w.sim, a);
    w.sim.deadSnp.drain();
    KillRobot(w.sim, v);
    CHECK(w.sim.deadSnp.snp.find("Rob id,Parent id") == std::string::npos);
    CHECK(w.sim.deadSnp.snp.find("Alga.txt") != std::string::npos);
  }
}

TEST_CASE("E6-05 Snapshot: el censo de los vivos (Database.bas:19-87)") {
  World w;
  const int a = w.spawn("cond 1 1 = start 10 .up store stop", "Uno.txt");
  const int b = w.spawn("cond 1 1 = start 10 .up store stop", "Dos.txt");
  w.sim.rob[b].generation = 3;
  w.sim.rob[b].SonNumber = 2;
  w.sim.rob[b].Kills = 7;
  w.sim.rob[b].LastMutDetail = "punto en 12";

  SnapshotResult r = Snapshot(w.sim, /*withMutations=*/true);
  CHECK(r.records == 2);
  CHECK(r.snp.compare(0, 21, "Rob id,Parent id,Foun") == 0);
  CHECK(r.mut.compare(0, 25, "Rob id,Mutation History\r\n") == 0);
  const std::string ida = std::to_string(w.sim.rob[a].AbsNum);
  const std::string idb = std::to_string(w.sim.rob[b].AbsNum);
  CHECK(r.snp.find("\r\n\r\n" + ida + ",0,Uno.txt,0,0,0,0,0,10,0,0,") !=
        std::string::npos);
  // Dos.txt: generación 3, 2 hijos, 7 kills en sus columnas.
  CHECK(r.snp.find("\r\n\r\n" + idb + ",0,Dos.txt,3,0,0,0,0,10,2,7,") !=
        std::string::npos);
  CHECK(r.mut.find("punto en 12") != std::string::npos);

  SUBCASE("sin historial de mutaciones el .snp es idéntico") {
    SnapshotResult r2 = Snapshot(w.sim, /*withMutations=*/false);
    CHECK(r2.snp == r.snp);
    CHECK(r2.mut.empty());
  }
  SUBCASE("los muertos y los de ADN vacío no entran") {
    KillRobot(w.sim, a);
    SnapshotResult r2 = Snapshot(w.sim);
    CHECK(r2.records == 1);
    CHECK(r2.snp.find("Uno.txt") == std::string::npos);
  }
}

TEST_CASE("E6-06 la columna Fitness del snapshot es la de fittest") {
  World w;
  const int p = w.spawn("cond 1 1 = start 10 .up store stop", "Padre.txt");
  const int h = w.spawn("cond 1 1 = start 10 .up store stop", "Padre.txt");
  w.sim.rob[h].parent = w.sim.rob[p].AbsNum;
  w.sim.rob[h].nrg = 5000.0f;
  w.sim.rob[h].body = 100.0f;

  // main.frm:2996-3003 con intFindBestV2 = 100: sEnergy = sPopulation = 1.
  // TotalOffspring arranca en 1 y el hijo lo sube a 2; s = (nrg_h + body_h*10)
  // + nrg_p + body_p*10.
  const double s = (5000.0 + 1000.0) + 20000.0 + 10000.0;
  CHECK(database_detail::SnapshotFitness(w.sim, p) ==
        doctest::Approx(2.0 * s));
  // El hijo no tiene descendencia: TotalOffspring queda en 1.
  CHECK(database_detail::SnapshotFitness(w.sim, h) ==
        doctest::Approx(5000.0 + 1000.0));

  SUBCASE("intFindBestV2 pondera igual que en fittest") {
    w.sim.intFindBestV2 = 20;  // sEnergy 0.2, sPopulation 1
    CHECK(database_detail::SnapshotFitness(w.sim, p) ==
          doctest::Approx(2.0 * std::pow(s, 0.2)));
  }
}
