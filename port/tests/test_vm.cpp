// Casos dorados V-01..V-14 (70-CASOS-DORADOS.md §3): VM y flujo.
// Ejecutan ExecuteDNA sobre ADN cargado con el cargador de texto o
// construido token a token.
#include <string>

#include "doctest.h"
#include "dbcore/loader.hpp"
#include "dbcore/vm.hpp"

using namespace db;

namespace {

struct Sim {
  VbRng rng;
  SysvarTable sysvars;
  Bot bot;
  VmContext vm;

  Sim() {
    vm.rndy = &rng;
    sysvars.entries.push_back({"nrg", 310});  // para V-09 (sombreado)
  }
  bool load(const std::string& text) {
    return RobScriptLoadText(text, bot, sysvars);
  }
  void run() { ExecuteDNA(vm, bot); }
};

}  // namespace

TEST_CASE("V-01 el else tras start esta muerto") {
  SUBCASE("condicion falsa: ni cuerpo ni else") {
    Sim s;
    REQUIRE(s.load("cond *50 1 > start 7 100 store else 9 200 store stop"));
    s.run();
    CHECK(s.bot.mem[100] == 0);
    CHECK(s.bot.mem[200] == 0);
  }
  SUBCASE("condicion cierta: cuerpo si, else no") {
    Sim s;
    REQUIRE(s.load("cond *50 1 > start 7 100 store else 9 200 store stop"));
    s.bot.mem[50] = 5;
    s.run();
    CHECK(s.bot.mem[100] == 7);
    CHECK(s.bot.mem[200] == 0);
  }
}

TEST_CASE("V-02 el else pegado a las condiciones si vive") {
  {
    Sim s;
    REQUIRE(s.load("cond 1 2 > else 9 200 store stop"));
    s.run();
    CHECK(s.bot.mem[200] == 9);
  }
  {
    Sim s;
    REQUIRE(s.load("cond 2 1 > else 9 200 store stop"));
    s.run();
    CHECK(s.bot.mem[200] == 0);
  }
}

TEST_CASE("V-03 condiciones inline gobiernan los stores sin consumirse") {
  Sim s;
  REQUIRE(s.load(
      "start 5 100 store 1 2 > 6 101 store 7 102 store dropbool 8 103 store stop"));
  s.run();
  CHECK(s.bot.mem[100] == 5);
  CHECK(s.bot.mem[101] == 0);
  CHECK(s.bot.mem[102] == 0);
  CHECK(s.bot.mem[103] == 8);
}

TEST_CASE("V-04 cond vacio = True; AddupCond es un AND que vacia") {
  auto mem100 = [](const char* dna) {
    Sim s;
    REQUIRE(s.load(dna));
    s.run();
    return s.bot.mem[100];
  };
  CHECK(mem100("cond start 5 100 store stop") == 5);            // True vacuo
  CHECK(mem100("cond 1 1 = 2 3 < start 5 100 store stop") == 5);  // AND(T,T)
  CHECK(mem100("cond 1 1 = 3 2 < start 5 100 store stop") == 0);  // AND(T,F)
  // El or combina en el stack ANTES del AddupCond.
  CHECK(mem100("cond 1 1 = 3 2 < or start 5 100 store stop") == 5);
}

TEST_CASE("V-05 numeracion de genes y thisgene") {
  Sim s;
  REQUIRE(s.load("cond start 1 100 store stop start 2 101 store stop "
                 "cond 1 2 > start 3 102 store stop"));
  CHECK(s.bot.mem[GenesSys] == 3);  // CountGenes al cargar
  s.run();
  CHECK(s.bot.mem[100] == 1);
  CHECK(s.bot.mem[101] == 2);
  CHECK(s.bot.mem[102] == 0);
  CHECK(s.bot.mem[thisgene] == 3);
}

TEST_CASE("V-06 la correccion del cero inicial desplaza el ADN con defs") {
  Sim con_def;
  REQUIRE(con_def.load("def mivar 100\n"
                       "5 .mivar store\n"
                       "start 7 200 store stop\n"));
  // El array quedo corrido: el primer token (0,5) esta en el indice 0,
  // invisible para la ejecucion.
  CHECK(con_def.bot.dna[0] == Block{0, 5});
  con_def.run();
  CHECK(con_def.bot.mem[100] == 0);
  CHECK(con_def.bot.mem[200] == 7);

  // Control: el mismo archivo sin def no se corre y DnaLen conserva el token.
  Sim sin_def;
  REQUIRE(sin_def.load("5 100 store\n"
                       "start 7 200 store stop\n"));
  CHECK(sin_def.bot.dna[0] == Block{0, 0});  // fantasma intacto
  CHECK(DnaLen(sin_def.bot.dna) == DnaLen(con_def.bot.dna) + 1);
  sin_def.run();
  CHECK(sin_def.bot.mem[100] == 0);  // los tokens pre-flujo no ejecutan igual
  CHECK(sin_def.bot.mem[200] == 7);
}

TEST_CASE("V-07 archivo solo-defs: no-op registrado (decision de port)") {
  Sim s;
  REQUIRE(s.load("def x 100"));  // el original: error 9 cada ciclo
  REQUIRE(s.bot.dna.size() == 1);  // el corrimiento dejo solo [end]
  s.run();
  s.run();
  CHECK(s.vm.diag.empty_dna_runs == 2);
  CHECK(s.bot.mem[DnaLenSys] == 1);  // metadato publicado al cargar
  CHECK(s.bot.mem[GenesSys] == 0);
  for (int i = 1; i <= MaxMem; ++i)
    if (i != DnaLenSys && i != GenesSys) CHECK(s.bot.mem[i] == 0);
}

TEST_CASE("V-08 el tokenizador no rechaza nada") {
  Sim s;
  REQUIRE(s.load("hola *qwerty // .noexiste *.noexiste 12.5"));
  REQUIRE(s.bot.dna.size() == 8);  // fantasma + 6 tokens + end
  CHECK(s.bot.dna[1] == Block{0, 0});   // hola -> val() = 0
  CHECK(s.bot.dna[2] == Block{1, 0});   // *qwerty -> *0 (lee mem(1000))
  CHECK(s.bot.dna[3] == Block{0, 0});   // // en medio no comenta: palabra
  CHECK(s.bot.dna[4] == Block{0, 0});   // .noexiste -> 0
  CHECK(s.bot.dna[5] == Block{1, 0});   // *.noexiste -> *0
  CHECK(s.bot.dna[6] == Block{0, 12});  // val("12.5") = 12.5 -> bancario 12
  CHECK(s.bot.dna[7] == Block{10, 1});

  // "defensa 50" ES un def: define la variable `nsa` (Right recorta 4).
  Sim d;
  REQUIRE(d.load("defensa 50\nstart 1 .nsa store stop"));
  REQUIRE(d.bot.vars.size() == 2);
  CHECK(d.bot.vars[1].name == "nsa");
  CHECK(d.bot.vars[1].value == 50);
  d.run();
  CHECK(d.bot.mem[50] == 1);
}

TEST_CASE("V-09 que rechaza el cargador") {
  SUBCASE("literal fuera de +-32767: no carga") {
    Sim s;
    CHECK_FALSE(s.load("start 40000 100 store stop"));
    Sim s2;
    CHECK_FALSE(s2.load("start -40000 100 store stop"));
    Sim s3;
    CHECK_FALSE(s3.load("def x 40000\nstart stop"));
  }
  SUBCASE("1001 defs: no carga (vars(1000) desbordado)") {
    std::string text;
    for (int i = 1; i <= 1001; ++i)
      text += "def v" + std::to_string(i) + " 1\n";
    text += "start stop\n";
    Sim s;
    CHECK_FALSE(s.load(text));
    // 1000 defs justos si cargan.
    std::string ok_text;
    for (int i = 1; i <= 1000; ++i)
      ok_text += "def v" + std::to_string(i) + " 1\n";
    ok_text += "start stop\n";
    Sim s2;
    CHECK(s2.load(ok_text));
  }
  SUBCASE("def duplicado: gana el ultimo") {
    Sim s;
    REQUIRE(s.load("def x 5\ndef x 9\nstart 1 .x store stop"));
    s.run();
    CHECK(s.bot.mem[9] == 1);
    CHECK(s.bot.mem[5] == 0);
  }
  SUBCASE("def NRG sombrea a la sysvar; .nrg minusculas no") {
    Sim s;
    REQUIRE(s.load("def NRG 970\nstart 1 .NRG store 2 .nrg store stop"));
    s.run();
    CHECK(s.bot.mem[970] == 1);  // privada case-sensitive gana
    CHECK(s.bot.mem[310] == 2);  // sysvar intacta
  }
  SUBCASE("genes sin stop: carga y ejecuta") {
    Sim s;
    REQUIRE(s.load("start 5 100 store"));
    s.run();
    CHECK(s.bot.mem[100] == 5);
  }
}

TEST_CASE("V-10 direccionamiento de stores y el no-op de direccion 0") {
  VbRng rng;
  Bot bot;
  VmContext vm;
  vm.rndy = &rng;

  SUBCASE("5 0 store: no escribe y el 5 queda en la pila") {
    vm.ints.push(5);
    vm.ints.push(0);
    ExecuteStores(vm, bot, 1);
    CHECK(vm.ints.size() == 1);
    CHECK(vm.ints.pop() == 5);
  }
  SUBCASE("5 0 divstore: no escribe y el 5 se consume") {
    vm.ints.push(5);
    vm.ints.push(0);
    ExecuteStores(vm, bot, 7);
    CHECK(vm.ints.size() == 0);
  }
  SUBCASE("normalizacion de direccion") {
    vm.ints.push(7);
    vm.ints.push(2000);
    ExecuteStores(vm, bot, 1);
    CHECK(bot.mem[1000] == 7);  // Abs(2000) Mod 1000 = 0 -> 1000
    vm.ints.push(7);
    vm.ints.push(-5);
    ExecuteStores(vm, bot, 1);
    CHECK(bot.mem[5] == 7);
    vm.ints.push(8);
    vm.ints.push(1005);
    ExecuteStores(vm, bot, 1);
    CHECK(bot.mem[5] == 8);
  }
  SUBCASE("deref con el mismo mapeo (0 * lee mem(1000))") {
    Sim s;
    REQUIRE(s.load("start 0 * 55 store 1005 * 56 store stop"));
    s.bot.mem[1000] = 42;
    s.bot.mem[5] = 7;
    s.run();
    CHECK(s.bot.mem[55] == 42);
    CHECK(s.bot.mem[56] == 7);
  }
  SUBCASE("multstore normaliza el operando ANTES") {
    bot.mem[7] = 100;
    vm.ints.push(33000);
    vm.ints.push(7);
    ExecuteStores(vm, bot, 6);
    // mod32000(33000) = 1000; 100*1000 = 100000; mod32000 -> 4000.
    CHECK(bot.mem[7] == 4000);
  }
  SUBCASE("divstore: division real con redondeo bancario") {
    bot.mem[7] = 9;
    vm.ints.push(2);
    vm.ints.push(7);
    ExecuteStores(vm, bot, 7);
    CHECK(bot.mem[7] == 4);  // 9/2 = 4.5 -> 4
  }
  SUBCASE("rndstore con mem negativa") {
    InjectedRnd inj({0.5f});
    vm.rndy = &inj;
    bot.mem[7] = -9;
    vm.ints.push(7);
    ExecuteStores(vm, bot, 10);
    CHECK(bot.mem[7] == -5);  // Int(10*0.5)*Sgn(-9)
    CHECK(inj.consumed() == 1);
  }
}

TEST_CASE("V-11 stores inmediatos entre genes del mismo ciclo") {
  Sim s;
  REQUIRE(s.load("start 7 50 store stop cond *50 7 = start 1 51 store stop"));
  s.run();
  CHECK(s.bot.mem[50] == 7);
  CHECK(s.bot.mem[51] == 1);  // el gen 2 ve lo que el gen 1 escribio
}

TEST_CASE("V-12 flags TieAngOverwrite/TieLenOverwrite") {
  VbRng rng;
  Bot bot;
  VmContext vm;
  vm.rndy = &rng;

  vm.ints.push(100);
  vm.ints.push(481);
  ExecuteStores(vm, bot, 1);  // store
  CHECK(bot.TieAngOverwrite[1]);

  vm.ints.push(100);
  vm.ints.push(485);
  ExecuteStores(vm, bot, 4);  // addstore
  CHECK(bot.TieLenOverwrite[1]);

  Bot bot2;
  vm.ints.push(481);
  ExecuteStores(vm, bot2, 2);  // inc: 1 operando, NO marca
  CHECK(bot2.mem[481] == 1);
  CHECK_FALSE(bot2.TieAngOverwrite[1]);
  vm.ints.push(481);
  ExecuteStores(vm, bot2, 14);  // negstore: idem
  CHECK(bot2.mem[481] == -1);
  CHECK_FALSE(bot2.TieAngOverwrite[1]);
}

TEST_CASE("V-13 debugint altera el tope sobre 2^24") {
  IntStack s;
  s.push(16777217);
  DNAdebugint(s);
  CHECK(s.pop() == 16777216);  // round-trip por Single

  // Bajo ismutating, el texto debugint ni siquiera tokeniza.
  Bot bot;
  SysvarTable sysvars;
  CHECK(ParseToken("debugint", bot, sysvars, false) == Block{3, 13});
  CHECK(ParseToken("debugint", bot, sysvars, true) == Block{0, 0});
  CHECK(ParseToken("debugbool", bot, sysvars, true) == Block{0, 0});
}

TEST_CASE("V-14 end interior y tokens tras end") {
  Sim s;
  REQUIRE(s.load(
      "start 5 100 store stop end start 9 200 store stop"));
  s.run();
  CHECK(s.bot.mem[100] == 5);
  CHECK(s.bot.mem[200] == 0);  // la ejecucion para en el primer (10,1)
  CHECK(s.bot.mem[DnaLenSys] == DnaLen(s.bot.dna));

  // Variante: (10,2) dejado por una mutacion NO termina (Case 10 no-op).
  Sim v;
  REQUIRE(v.load("start 5 100 store stop end start 9 200 store stop"));
  for (auto& b : v.bot.dna) {
    if (is_end(b)) {
      b = Block{10, 2};  // solo el primero (el interior)
      break;
    }
  }
  v.run();
  CHECK(v.bot.mem[100] == 5);
  CHECK(v.bot.mem[200] == 9);
}
