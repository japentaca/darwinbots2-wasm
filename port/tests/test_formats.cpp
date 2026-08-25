// Casos dorados FM-01..FM-07 (70-CASOS-DORADOS.md §7): formatos
// ida-y-vuelta. E/S sobre búferes en memoria (formats.hpp): la fidelidad
// exigida es la del formato de bytes/texto, no la de archivos.
#include <string>

#include "doctest.h"
#include "dbcore/formats.hpp"
#include "dbcore/master.hpp"

using namespace db;

namespace {

// Mismo mundo mínimo que test_memory.cpp.
struct World {
  Sim sim;
  VbRng rng;

  World() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
  }

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

  void tick() { UpdateSim(sim); }
};

}  // namespace

// ---------------------------------------------------------------------------
TEST_CASE("FM-01 FileContinue: el centinela 254x3") {
  SUBCASE("primer byte != 254 -> True, posicion restaurada") {
    VbBinFile f;
    f.data = {7, 1, 2};
    CHECK(FileContinue(f) == true);
    CHECK(f.pos == 0);
  }
  SUBCASE("254 254 254 -> False (fin de registro)") {
    VbBinFile f;
    f.data = {254, 254, 254};
    CHECK(FileContinue(f) == false);
    CHECK(f.pos == 0);
  }
  SUBCASE("254 254 9 -> True (el tercer byte corta)") {
    VbBinFile f;
    f.data = {254, 254, 9};
    CHECK(FileContinue(f) == true);
    CHECK(f.pos == 0);
  }
  SUBCASE("EOF -> False") {
    VbBinFile f;
    f.data = {1, 2};
    f.pos = 2;
    CHECK(FileContinue(f) == false);
    CHECK(f.pos == 2);
  }
  SUBCASE("en mitad del bufer, posicion restaurada") {
    VbBinFile f;
    f.data = {1, 254, 254, 254, 9};
    f.pos = 1;
    CHECK(FileContinue(f) == false);
    CHECK(f.pos == 1);
    f.pos = 4;
    CHECK(FileContinue(f) == true);
    CHECK(f.pos == 4);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("FM-02 sint: Mod, no clamp — [PROBABLE BUG] B8-2") {
  CHECK(sint(33000) == 1000);
  CHECK(sint(32000) == 0);  // multiplo de 32000 -> 0, no +-32000 (vs N-02)
  CHECK(sint(31999) == 31999);
  CHECK(sint(-33000) == -1000);
  CHECK(sint(64000) == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("FM-03 el gen epigenetico autodestructivo") {
  World w;
  const int n = w.spawn("start 5 555 store stop", "Epi.txt", 1000, 1000);
  w.sim.rob[n].mem[975] = 7;
  w.sim.rob[n].mem[980] = -3;

  FormatGlobals g;
  g.UseEpiGene = true;
  const std::string text = SalvarobText(w.sim, n, g);

  // El gen serializado, antepuesto al ADN propio (una linea por celda != 0).
  const std::string epigene =
      "start\r\n7 975 store\r\n-3 980 store\r\n*.thisgene .delgene store\r\n"
      "stop";
  const std::size_t at = text.find(epigene);
  REQUIRE(at != std::string::npos);
  CHECK(at < text.find(" start"));  // antes del ADN destokenizado

  // Recarga por la vía de siembra (InsertFounder: body = 1000, como
  // loadrobs): el epigene es el gen 1; el ADN original queda como gen 2.
  World w2;
  const int m = InsertFounder(w2.sim, text, "Epi.txt");
  REQUIRE(m > 0);
  Bot& b = w2.sim.rob[m];
  CHECK(b.genenum == 2);
  CHECK(b.mem[975] == 0);  // aun no ejecutado

  // Ciclo 1: el gen 1 restaura las celdas y se borra a si mismo via delgene.
  w2.tick();
  CHECK(b.mem[975] == 7);
  CHECK(b.mem[980] == -3);
  CHECK(b.mem[addr::DelgeneSys] == 0);  // consumido en P3
  CHECK(b.genenum == 1);                // el gen se borro a si mismo
  CHECK(b.mem[addr::GenesSys] == 1);
  CHECK(b.mem[addr::DnaLenSys] == b.DnaLen);
  CHECK(b.mem[555] == 5);  // el ADN original tambien corrio

  // Ciclo 2: el ADN ya sin el gen; la memoria epigenetica sobrevivio.
  b.mem[555] = 0;
  w2.tick();
  CHECK(b.mem[555] == 5);
  CHECK(b.mem[975] == 7);
  CHECK(b.genenum == 1);
}

// ---------------------------------------------------------------------------
TEST_CASE("FM-04 Hash: valor concreto y verificacion al cargar") {
  SUBCASE("Hash(\"abc\", 20)") {
    std::string s = "abc";
    std::string expected = "!%#\"";
    expected += std::string(16, '!');
    CHECK(Hash(s, 20) == expected);
  }
  SUBCASE("Trim y recorte de CrLf finales (contrato de entrada)") {
    std::string s1 = "abc";
    std::string s2 = "  abc\r\n\r\n";
    std::string h1 = Hash(s1, 20);
    CHECK(Hash(s2, 20) == h1);
    CHECK(s2 == "abc");  // ByRef: el llamador queda mutado, como el original
  }
  SUBCASE("ida-y-vuelta: el hash cuadra y preserva generation/mutations") {
    World w;
    const int n = w.spawn("start 1 550 store stop", "H.txt", 1000, 1000);
    w.sim.rob[n].generation = 7;
    w.sim.rob[n].Mutations = 41;
    const std::string text = SalvarobText(w.sim, n);
    REQUIRE(text.find("'#hash: ") != std::string::npos);

    World w2;
    const int m = RobScriptLoadSim(w2.sim, text, "H.txt");
    REQUIRE(m > 0);
    CHECK(w2.sim.rob[m].generation == 7);
    CHECK(w2.sim.rob[m].OldMutations == 41);  // '#mutations -> OldMutations
  }
  SUBCASE("archivo manipulado: generation y OldMutations a 0") {
    World w;
    const int n = w.spawn("start 1 550 store stop", "H.txt", 1000, 1000);
    w.sim.rob[n].generation = 7;
    w.sim.rob[n].Mutations = 41;
    std::string text = SalvarobText(w.sim, n);

    const std::size_t p = text.find(" 550 ");
    REQUIRE(p != std::string::npos);
    text[p + 1] = '6';  // 550 -> 650: el contenido cambia, el hash no cuadra

    World w2;
    const int m = RobScriptLoadSim(w2.sim, text, "H.txt");
    REQUIRE(m > 0);  // el archivo NO se rechaza: solo se resetean los campos
    CHECK(w2.sim.rob[m].generation == 0);
    CHECK(w2.sim.rob[m].OldMutations == 0);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("FM-05 registro binario: solo 50 vars y mem crudo") {
  World w;
  // 60 defs (direcciones 601..660, libres de sysvars) + ADN que usa v50/v60.
  std::string dnatext;
  for (int i = 1; i <= 60; ++i)
    dnatext +=
        "def v" + std::to_string(i) + " " + std::to_string(600 + i) + "\n";
  dnatext += "start *.v50 998 store *.v60 999 store stop\n";
  const int n = w.spawn(dnatext, "Vars.txt", 1000, 1000);
  Bot& src = w.sim.rob[n];
  REQUIRE(src.vnum == 61);
  REQUIRE(src.AbsNum != 0);

  src.mem[500] = -32768;  // solo alcanzable via save previo (21-MEMORIA §7)
  src.mem[0] = 123;       // mem(0) tambien se persiste crudo
  // Campos muertos de la tie 3 (34-TIES §4.4): van y vuelven.
  src.Ties[3].ln = 77;
  src.Ties[3].shrink = 5;
  src.Ties[3].stat = true;
  src.Ties[3].mem = 42;
  src.Ties[3].Port = 9;
  src.LastOwner = "Tester";
  src.LastMutDetail = "detalle";
  const vb_long absnum = src.AbsNum;
  const vb_integer dnalen = src.DnaLen;

  VbBinFile f;
  SaveRobotBody(w.sim, n, f);
  CHECK(f.data.size() >= 3);
  CHECK(f.data[f.data.size() - 1] == 254);  // terminador 254x3
  CHECK(f.data[f.data.size() - 2] == 254);
  CHECK(f.data[f.data.size() - 3] == 254);

  f.pos = 0;
  const int m = posto(w.sim);
  LoadRobot(w.sim, m, f);
  CHECK(f.pos == f.data.size());  // el registro se consume entero
  Bot& dst = w.sim.rob[m];

  // 1. Solo vars(1..50) sobreviven; vnum viaja crudo (61).
  CHECK(dst.vars.size() == 51);
  CHECK(dst.vars[1].name == "v1");
  CHECK(dst.vars[1].value == 601);
  CHECK(dst.vars[50].name == "v50");
  CHECK(dst.vars[50].value == 650);
  CHECK(dst.vnum == 61);

  // Visible al re-exportar: v50 se resuelve, v60 (perdida) queda numerica.
  const std::string retext =
      DetokenizeDNA(dst, *w.sim.sysvars, 0, /*savingtofile=*/false);
  CHECK(retext.find("*.v50") != std::string::npos);
  CHECK(retext.find("*660") != std::string::npos);

  // 2. mem() crudo: las 1001 celdas, mem(0) y el -32768 incluidos.
  CHECK(dst.mem[500] == -32768);
  CHECK(dst.mem[0] == 123);

  // 3. dna(0) fantasma no viaja; end forzado en el ultimo token.
  CHECK(dst.dna[0] == Block{0, 0});
  CHECK(dst.DnaLen == dnalen);
  CHECK(is_end(dst.dna[dst.DnaLen]));

  // 4. AbsNum se conserva (GiveAbsNum solo si venia 0).
  CHECK(dst.AbsNum == absnum);

  // 5. Los campos muertos de las ties van y vuelven.
  CHECK(dst.Ties[3].ln == 77);
  CHECK(dst.Ties[3].shrink == 5);
  CHECK(dst.Ties[3].stat == true);
  CHECK(dst.Ties[3].mem == 42);
  CHECK(dst.Ties[3].Port == 9);

  // Extras del registro: oldBotNum = slot al guardar; LastOwner/detalle.
  CHECK(dst.oldBotNum == n);
  CHECK(dst.LastOwner == "Tester");
  CHECK(dst.LastMutDetail == "detalle");
  CHECK(dst.nrg == src.nrg);
}

// ---------------------------------------------------------------------------
TEST_CASE("FM-06 ida-y-vuelta de texto inestable para ADN degenerado") {
  World w;
  const int n = w.spawn("start 1 999 store stop", "Void.txt", 1000, 1000);
  Bot& b = w.sim.rob[n];
  REQUIRE(b.dna[2] == Block{0, 1});  // el numero 1
  b.dna[2] = Block{8, 0};            // token tipo 8 (dejado por mutacion)

  // Emision: tipo 8 no tiene texto -> VOID (DNATokenizing.bas:3261).
  const std::string text =
      DetokenizeDNA(b, *w.sim.sysvars, 0, /*savingtofile=*/true);
  CHECK(text.find("VOID") != std::string::npos);

  // Recarga: VOID es palabra desconocida -> (0, 0). El round-trip CAMBIO el
  // ADN (tipo 8 -> numero 0): solo el ADN canonico es estable.
  Bot reloaded;
  REQUIRE(LoadDNAText(text, reloaded, *w.sim.sysvars));
  CHECK(reloaded.dna[2] == Block{0, 0});
  CHECK(DnaLen(reloaded.dna) == DnaLen(b.dna));
}

// ---------------------------------------------------------------------------
TEST_CASE("FM-07 SaveRobHeader: cap del contador") {
  Bot b;
  b.generation = 7;

  // Errata de spec corregida contra el fuente: con Mutations = 1.5e9 y
  // OldMutations = 1e9 la suma Long del original desbordaba (error 6, EXE
  // con chequeos) ANTES del cap. El caso del cap real: suma 2.1e9 <= 2^31-1.
  b.Mutations = 1500000000;
  b.OldMutations = 600000000;
  CHECK(SaveRobHeader(b) ==
        "'#generation: 7\r\n'#mutations: 2000000000\r\n");

  // Decision de port para la suma desbordada (los valores de la spec): la
  // suma en 64 bits cae en el mismo cap.
  b.OldMutations = 1000000000;
  CHECK(SaveRobHeader(b) ==
        "'#generation: 7\r\n'#mutations: 2000000000\r\n");

  // Sin cap: la suma se emite tal cual. Contraste con FM-02: el texto capa,
  // el binario envuelve.
  b.Mutations = 33000;
  b.OldMutations = 0;
  CHECK(SaveRobHeader(b) == "'#generation: 7\r\n'#mutations: 33000\r\n");
  CHECK(sint(33000) == 1000);
}
