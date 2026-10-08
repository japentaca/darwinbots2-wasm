// Gancho de traza de ExecuteDNA (PLAN-EDITOR.md E1.1): herramientas del editor
// de ADN. El gancho no existe en el original (DNA.bas): solo observa, y con
// `vm.trace == nullptr` ExecuteDNA tiene que ser byte a byte la misma.
#include <string>

#include "doctest.h"
#include "dbcore/loader.hpp"
#include "dbcore/vm.hpp"

using namespace db;

namespace {

// Misma fixture mínima que test_vm.cpp (copiada, no importada).
struct Sim {
  VbRng rng;
  SysvarTable sysvars;
  Bot bot;
  VmContext vm;

  Sim() { vm.rndy = &rng; }
  bool load(const std::string& text) {
    return RobScriptLoadText(text, bot, sysvars);
  }
  void run() { ExecuteDNA(vm, bot); }
};

// V-01: dos genes, con `else` pegado al `start`.
const char* kAdn = "cond *50 1 > start 7 100 store else 9 200 store stop";

// Tokens de kAdn, 1-based como bot.dna: cond *50 1 > start 7 100 store else
// 9 200 store stop.
constexpr std::size_t kTokens = 13;

}  // namespace

TEST_CASE("TR-01 con trace nulo no cambia nada") {
  // Mismo ADN, misma memoria; una corrida sin gancho y otra con él. Todo el
  // estado observable (memoria, genes disparados, energía, pilas, RNG) tiene
  // que quedar idéntico.
  SUBCASE("ADN de V-01") {
    Sim a, b;
    TraceSink sink;
    b.vm.trace = &sink;
    for (Sim* s : {&a, &b}) {
      REQUIRE(s->load(kAdn));
      s->vm.gaTrack = true;
      s->bot.mem[50] = 5;
      s->run();
    }
    CHECK(a.bot.mem == b.bot.mem);
    CHECK(a.bot.ga == b.bot.ga);
    CHECK(a.bot.nrg == b.bot.nrg);
    CHECK(a.bot.condnum == b.bot.condnum);
    CHECK(a.vm.ints.size() == b.vm.ints.size());
    CHECK(a.vm.bools.size() == b.vm.bools.size());
    for (int i = 0; i < 8; ++i) {
      CHECK(a.vm.ints.peek(i) == b.vm.ints.peek(i));
      CHECK(a.vm.bools.peek(i) == b.vm.bools.peek(i));
    }
    CHECK(a.rng.state() == b.rng.state());
    CHECK(sink.steps.size() == kTokens);
  }
  SUBCASE("ADN con rndstore y rnd (consumen RNG)") {
    Sim a, b;
    TraceSink sink;
    b.vm.trace = &sink;
    for (Sim* s : {&a, &b}) {
      REQUIRE(s->load("cond start 628 rnd 100 store 101 rndstore "
                      "1 rnd 102 inc stop"));
      s->bot.mem[101] = 500;
      s->run();
    }
    CHECK(a.bot.mem == b.bot.mem);
    CHECK(a.rng.state() == b.rng.state());
    CHECK(a.rng.state() != VbRng::kSeed0);  // sí se consumió RNG
    CHECK(a.vm.ints.size() == b.vm.ints.size());
    CHECK(a.vm.bools.size() == b.vm.bools.size());
  }
}

TEST_CASE("TR-02 pasos del gen con la condicion cierta") {
  Sim s;
  TraceSink sink;
  s.vm.trace = &sink;
  REQUIRE(s.load(kAdn));
  s.bot.mem[50] = 5;
  s.run();

  // Un paso por token de bot.dna, sin el fantasma 0 ni el `end`.
  REQUIRE(sink.steps.size() == kTokens);
  REQUIRE(sink.steps.size() == s.bot.dna.size() - 2);
  for (std::size_t k = 0; k < kTokens; ++k) {
    CHECK(sink.steps[k].idx == static_cast<vb_long>(k + 1));
    CHECK(sink.steps[k].tipo == s.bot.dna[k + 1].tipo);
    CHECK(sink.steps[k].value == s.bot.dna[k + 1].value);
  }

  const auto& p = sink.steps;
  // cond: abre el gen 1, flujo COND.
  CHECK(p[0].tipo == tok::FLOW);
  CHECK(p[0].ejec);
  CHECK(p[0].flow == 1);
  CHECK(p[0].gen == 1);
  // *50: apila mem[50].
  CHECK(p[1].ejec);
  CHECK(p[1].nInts == 1);
  CHECK(p[1].ints[0] == 5);
  // 1: encima del anterior.
  CHECK(p[2].nInts == 2);
  CHECK(p[2].ints[0] == 5);
  CHECK(p[2].ints[1] == 1);
  // >: consume los dos enteros y deja un booleano verdadero.
  CHECK(p[3].nInts == 0);
  CHECK(p[3].nBools == 1);
  CHECK(p[3].bools[0] == -1);
  // start: cuerpo (flujo BODY), mismo gen.
  CHECK(p[4].ejec);
  CHECK(p[4].flow == 2);
  CHECK(p[4].gen == 1);
  // 7 100: corren; el store escribe 7 en 100.
  CHECK(p[5].ejec);
  CHECK(p[5].storeAddr == 0);
  CHECK(p[6].nInts == 2);
  CHECK(p[7].tipo == tok::STORE);
  CHECK(p[7].ejec);
  CHECK(p[7].nInts == 0);
  CHECK(p[7].storeAddr == 100);
  CHECK(p[7].storeVal == 7);
  CHECK(s.bot.mem[100] == 7);
  // else: abre el gen 2 y deja el flujo en CLEAR (la condición fue cierta).
  CHECK(p[8].tipo == tok::FLOW);
  CHECK(p[8].ejec);
  CHECK(p[8].flow == 0);
  CHECK(p[8].gen == 2);
  // La rama else no corre: 9 200 store.
  for (int k = 9; k <= 11; ++k) {
    CHECK_FALSE(p[k].ejec);
    CHECK(p[k].nInts == 0);
    CHECK(p[k].storeAddr == 0);
    CHECK(p[k].storeVal == 0);
  }
  CHECK(s.bot.mem[200] == 0);
  // stop: los tokens de flujo siempre corren.
  CHECK(p[12].ejec);
  CHECK(p[12].flow == 0);
}

TEST_CASE("TR-03 condicion falsa: corre la rama else") {
  Sim s;
  TraceSink sink;
  s.vm.trace = &sink;
  REQUIRE(s.load(kAdn));
  s.bot.mem[50] = 0;
  s.run();

  REQUIRE(sink.steps.size() == kTokens);
  const auto& p = sink.steps;
  // *50 1 > con mem[50]=0: booleano falso.
  CHECK(p[3].nBools == 1);
  CHECK(p[3].bools[0] == 0);
  // start: condición falsa, flujo CLEAR.
  CHECK(p[4].ejec);
  CHECK(p[4].flow == 0);
  // Cuerpo: 7 100 store no corren.
  CHECK_FALSE(p[5].ejec);
  CHECK_FALSE(p[6].ejec);
  CHECK_FALSE(p[7].ejec);
  CHECK(p[7].storeAddr == 0);
  CHECK(p[7].storeVal == 0);
  CHECK(s.bot.mem[100] == 0);
  // else: flujo ELSEBODY, gen 2.
  CHECK(p[8].ejec);
  CHECK(p[8].flow == 3);
  CHECK(p[8].gen == 2);
  // La rama else corre y escribe 9 en 200.
  CHECK(p[9].ejec);
  CHECK(p[10].ejec);
  CHECK(p[11].tipo == tok::STORE);
  CHECK(p[11].ejec);
  CHECK(p[11].storeAddr == 200);
  CHECK(p[11].storeVal == 9);
  CHECK(s.bot.mem[200] == 9);
  CHECK(p[12].ejec);
}

TEST_CASE("TR-04 la pila de enteros se recorta a las 8 entradas superiores") {
  Sim s;
  TraceSink sink;
  s.vm.trace = &sink;
  REQUIRE(s.load("cond start 1 2 3 4 5 6 7 8 9 10 11 12 stop"));
  s.run();

  REQUIRE(sink.steps.size() == 15);
  const auto& last = sink.steps.back();  // stop: no toca las pilas
  CHECK(last.nInts == 12);
  const vb_long esperado[8] = {5, 6, 7, 8, 9, 10, 11, 12};
  for (int i = 0; i < 8; ++i) CHECK(last.ints[i] == esperado[i]);
  // Con 3 entradas, el resto del arreglo queda en cero.
  const auto& tres = sink.steps[4];  // el `3` (cond start 1 2 3)
  CHECK(tres.nInts == 3);
  CHECK(tres.ints[0] == 1);
  CHECK(tres.ints[2] == 3);
  CHECK(tres.ints[3] == 0);
}

TEST_CASE("TR-05 stores de un operando, direccion cero y normalizada") {
  SUBCASE("inc") {
    Sim s;
    TraceSink sink;
    s.vm.trace = &sink;
    REQUIRE(s.load("cond start 100 inc 100 inc stop"));
    s.run();
    REQUIRE(sink.steps.size() == 7);
    CHECK(sink.steps[3].storeAddr == 100);
    CHECK(sink.steps[3].storeVal == 1);
    CHECK(sink.steps[5].storeAddr == 100);
    CHECK(sink.steps[5].storeVal == 2);
  }
  SUBCASE("direccion 0: corre pero no escribe, el valor queda en la pila") {
    Sim s;
    TraceSink sink;
    s.vm.trace = &sink;
    REQUIRE(s.load("cond start 5 0 store stop"));
    s.run();
    REQUIRE(sink.steps.size() == 6);
    const auto& st = sink.steps[4];
    CHECK(st.tipo == tok::STORE);
    CHECK(st.ejec);
    CHECK(st.storeAddr == 0);
    CHECK(st.storeVal == 0);
    CHECK(st.nInts == 1);
    CHECK(st.ints[0] == 5);
  }
  SUBCASE("direccion fuera de rango: se anota la normalizada") {
    Sim s;
    TraceSink sink;
    s.vm.trace = &sink;
    // -1005 -> |.| mod 1000 = 5; 2000 -> 0 -> 1000.
    REQUIRE(s.load("cond start 3 -1005 store 4 2000 store stop"));
    s.run();
    REQUIRE(sink.steps.size() == 9);
    CHECK(sink.steps[4].storeAddr == 5);
    CHECK(sink.steps[4].storeVal == 3);
    CHECK(sink.steps[7].storeAddr == 1000);
    CHECK(sink.steps[7].storeVal == 4);
    CHECK(s.bot.mem[5] == 3);
    CHECK(s.bot.mem[1000] == 4);
  }
}

TEST_CASE("TR-06 la traza se reinicia en cada ciclo y el ADN vacio no anota") {
  SUBCASE("dos ciclos con el mismo sink") {
    Sim s;
    TraceSink sink;
    s.vm.trace = &sink;
    REQUIRE(s.load(kAdn));
    s.run();
    s.run();
    CHECK(sink.steps.size() == kTokens);  // no se acumula
  }
  SUBCASE("archivo solo-defs (V-07)") {
    Sim s;
    TraceSink sink;
    sink.steps.resize(3);  // basura previa: se limpia igual
    s.vm.trace = &sink;
    REQUIRE(s.load("def x 100"));
    s.run();
    CHECK(sink.steps.empty());
    CHECK(s.vm.diag.empty_dna_runs == 1);
  }
}
