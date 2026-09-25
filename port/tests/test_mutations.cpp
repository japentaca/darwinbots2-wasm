// M7 · Mutaciones y reproducción sexual (B6): casos B-29, B-31..B-35 y
// R-09..R-11 de 70-CASOS-DORADOS.md, más los tests de transcripción de
// DNAtoInt/tablas sysvarIN-OUT/sharechloroplasts y el cierre de los stubs
// mutate_stub/sexrepro_stub/makestuff_stub (asertados a 0).
//
// ERRATAS CORREGIDAS CONTRA EL FUENTE (registradas en PROGRESO.md):
// - R-11: el hijo de padres IDÉNTICOS no pierde ningún token. La racha
//   emparejada NO se copia desde el índice 0: `upperbound = UBound(Outdna)`
//   se relee en la búsqueda de iguales (Robots.bas:633), y el Outdna(0)
//   inicial (0,0) lo recorta el "bug fix remove starting zero". Como los
//   dna(0) fantasma de ambos padres siempre se emparejan entre sí (mismo
//   nucli), el corrimiento solo puede aparecer con padres asimétricos
//   (corrección del cero inicial en un solo lado, V-06).
// - R-11/B-29 (consumo de RNG): el IIf de VB6 evalúa TODOS sus brazos — la
//   moneda de valores (Robots.bas:651) se consume en CADA token de cada
//   racha emparejada, no solo cuando ambos lados traen |value| > 999.
#include <cmath>
#include <vector>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

// Bot mínimo viable para reproducción (patrón de test_bugs3).
int addbot(Sim& sim, float x, float y) {
  const int n = posto(sim);
  Bot& b = sim.rob[n];
  b.exist = true;
  b.FName = "T.txt";
  b.pos = {x, y};
  b.aim = 0.0f;
  b.aimvector = {1.0f, 0.0f};
  b.nrg = 10000.0f;
  b.body = 1000.0f;
  b.radius = FindRadius(sim, n);
  b.BucketPos = {-2.0f, -2.0f};
  UpdateBotBucket(sim, n);
  return n;
}

// ADN "5 100 store end" con fantasma en 0 (bot de texto sin defs).
std::vector<Block> dna_5_100_store() {
  return {{0, 0}, {0, 5}, {0, 100}, {7, 1}, {10, 1}};
}

void checkStubsCerrados(const Sim& sim) {
  CHECK(sim.diag.mutate_stub == 0);
  CHECK(sim.diag.sexrepro_stub == 0);
  CHECK(sim.diag.makestuff_stub == 0);
}

}  // namespace

// ---------------------------------------------------------------------------
// Transcripción M7: DNAtoInt y la matriz (Q16).
TEST_CASE("M7 DNAtoInt: matriz de 77 comandos y compresion de numeros") {
  const SysvarTable& sv = DefaultSysvarTable();
  // Comandos: 32691 + índice; el índice máximo es 76 (end) => 32767 exacto.
  CHECK(DNAtoInt(sv, 2, 1) == 32691);   // add (primer comando sondeado)
  CHECK(DNAtoInt(sv, 10, 1) == 32767);  // end (último)
  // Con ismutating = False la matriz cuenta debugint/debugbool (tipo 3
  // llega a 14 entradas): (3,13) = debugint = índice 26.
  CHECK(DNAtoInt(sv, 3, 13) == 32717);
  // Números: -16646 + value; grandes comprimidos 512*sgn + v/2.05.
  CHECK(DNAtoInt(sv, 0, 0) == -16646);
  CHECK(DNAtoInt(sv, 0, 999) == -15647);
  CHECK(DNAtoInt(sv, 0, -999) == -17645);
  CHECK(DNAtoInt(sv, 0, 1000) == -15646);  // 512 + 487.8 -> CInt 1000
  // *números: +32729.
  CHECK(DNAtoInt(sv, 1, 5) == -16646 + 5 + 32729);
}

TEST_CASE("M7 tablas sysvarIN/sysvarOUT extraidas de LoadSysVars") {
  const IndexedSysvarTable& IN = DefaultSysvarIN();
  const IndexedSysvarTable& OUT = DefaultSysvarOUT();
  // Entradas activas espejo del fuente.
  CHECK(IN.e[11].name == "robage");
  CHECK(IN.e[11].value == 9);
  CHECK(OUT.e[255].name == "sharechlr");
  CHECK(OUT.e[255].value == 924);
  // Los huecos (líneas comentadas del fuente) quedan sin nombre.
  CHECK(IN.e[0].name.empty());
  CHECK(IN.e[1].name.empty());   // 'sysvarIN(1) "up" está comentada
  CHECK(OUT.e[0].name.empty());
  // Acceso indexado a la tabla principal: sysvar(9) = shoot/7.
  const Var* s9 = SysvarByIndex(DefaultSysvarTable(), 9);
  REQUIRE(s9 != nullptr);
  CHECK(s9->name == "shoot");
  CHECK(s9->value == 7);
  CHECK(SysvarByIndex(DefaultSysvarTable(), 0) == nullptr);
  CHECK(SysvarByIndex(DefaultSysvarTable(), 256) == nullptr);
}

// ---------------------------------------------------------------------------
// B-31 · Los suelos anti-freeze reescriben las tasas heredables [ciclo]
TEST_CASE("B-31 el suelo anti-freeze reescribe mutarray en el bot [PROBABLE BUG] B6-5") {
  SUBCASE("tasa heredada por debajo del suelo: queda reescrita") {
    Sim sim;
    InjectedRnd rnd({0.5f});  // 1 extracción: la agenda de PointMutation
    sim.rndy = &rnd;
    const int n = addbot(sim, 16000, 16000);
    Bot& b = sim.rob[n];
    b.dna = {{0, 0}, {0, 5}, {10, 1}};
    b.DnaLen = 1200;  // ADN grande (el suelo escala con DnaLen)
    b.Mutables.Mutations = true;
    b.Mutables.Mean[mut::PointUP] = 3;
    b.Mutables.StdDev[mut::PointUP] = 1;
    b.Mutables.mutarray[mut::PointUP] = 0.2f;

    mutate(sim, n);  // en vida

    // floor = 1200*(3+1)/(400*30)*1 = 0.4 > 0.2 => escrito en el bot,
    // permanente y heredable.
    CHECK(b.Mutables.mutarray[mut::PointUP] == 0.4f);
    CHECK(rnd.exhausted());
  }
  SUBCASE("tasa default 5000: sin cambio") {
    Sim sim;
    InjectedRnd rnd({0.5f});
    sim.rndy = &rnd;
    const int n = addbot(sim, 16000, 16000);
    Bot& b = sim.rob[n];
    b.dna = {{0, 0}, {0, 5}, {10, 1}};
    b.DnaLen = 1200;
    b.Mutables.Mutations = true;
    b.Mutables.Mean[mut::PointUP] = 3;
    b.Mutables.StdDev[mut::PointUP] = 1;
    b.Mutables.mutarray[mut::PointUP] = 5000;

    mutate(sim, n);
    CHECK(b.Mutables.mutarray[mut::PointUP] == 5000.0f);
  }
}

// ---------------------------------------------------------------------------
// B-32 · Minor y MajorDeletion son el mismo operador [unit]
TEST_CASE("B-32 Minor = MajorDeletion con Mean/StdDev igualados [PROBABLE BUG] B6-6") {
  // Mismo ADN, mismas tasas, misma secuencia RNG (VbRng fresco en cada sim):
  // resultado idéntico token a token (el código solo difiere en el índice).
  auto build = [](Sim& sim, VbRng& rng, int idx) {
    sim.rndy = &rng;
    const int n = addbot(sim, 16000, 16000);
    Bot& b = sim.rob[n];
    b.dna = {{0, 0}};
    for (vb_integer v = 1; v <= 19; ++v) b.dna.push_back({0, v});
    b.dna.push_back({10, 1});
    b.DnaLen = 20;
    b.Mutables.mutarray[idx] = 1;  // dispara en cada token
    b.Mutables.Mean[idx] = 2;
    b.Mutables.StdDev[idx] = 1;
    return n;
  };
  Sim s1, s2;
  VbRng r1, r2;
  const int n1 = build(s1, r1, mut::MinorDeletionUP);
  const int n2 = build(s2, r2, mut::MajorDeletionUP);

  MinorDeletion(s1, n1);
  MajorDeletion(s2, n2);

  CHECK(s1.rob[n1].Mutations == s2.rob[n2].Mutations);
  CHECK(s1.rob[n1].Mutations > 0);  // algo pasó (rate 1 = siempre)
  CHECK(s1.rob[n1].DnaLen == s2.rob[n2].DnaLen);
  REQUIRE(s1.rob[n1].dna.size() == s2.rob[n2].dna.size());
  for (std::size_t t = 0; t < s1.rob[n1].dna.size(); ++t) {
    CHECK(s1.rob[n1].dna[t].tipo == s2.rob[n2].dna[t].tipo);
    CHECK(s1.rob[n1].dna[t].value == s2.rob[n2].dna[t].value);
  }
  CHECK(r1.state() == r2.state());  // mismo consumo de RNG
}

// ---------------------------------------------------------------------------
// B-33 · Insertion cuenta 2 mutaciones por token [ciclo]
TEST_CASE("B-33 una insercion de Length=3 sube Mutations en 6 [PROBABLE BUG] B6-7") {
  Sim sim;
  VbRng rng;
  sim.rndy = &rng;
  const int n = addbot(sim, 16000, 16000);
  Bot& b = sim.rob[n];
  b.dna = {{0, 0}, {0, 5}, {10, 1}};  // "5 end": un solo token mutable
  b.DnaLen = 2;
  b.Mutables.Mutations = true;
  b.Mutables.mutarray[mut::InsertionUP] = 1;  // dispara en t=1
  b.Mutables.Mean[mut::InsertionUP] = 3;      // Length = Gauss(0,3) = 3
  b.Mutables.StdDev[mut::InsertionUP] = 0;

  mutate(sim, n, true);  // nacimiento

  // 3 tokens insertados x (tipo con PWTC=0 + valor con PWTC=100) = 6.
  CHECK(b.Mutations == 6);
  CHECK(b.LastMut == 6);
  CHECK(b.DnaLen == 5);
  CHECK(is_end(b.dna[5]));
  for (int t = 2; t <= 4; ++t) {
    CHECK(b.dna[t].tipo != 10);                    // end increable
    CHECK(!TipoDetokM(b.dna[t].tipo).empty());     // tipo con nombre
  }
  CHECK(b.mem[336] == 5);  // re-publicado por mutate
}

TEST_CASE("B-33b insercion de 1 token guionada: siembra Gauss(500,0)") {
  // Secuencia integra de una insercion minima sobre "5 end" con Mean=1:
  // [chance t=1, gasdev x2 (Length=1), Random(0,99) pase de tipos,
  //  Random(0,20)->tipo 0, Random(0,99) pase de valores, moneda salto fino,
  //  gasdev x2 (Gauss(7)), 4 extracciones de mutatecolors].
  Sim sim;
  InjectedRnd rnd({0.9f, 0.25f, 0.75f, 0.5f, 0.01f, 0.5f, 0.9f, 0.25f, 0.75f,
                   0.0f, 0.0f, 0.0f, 0.0f});
  sim.rndy = &rnd;
  const int n = addbot(sim, 16000, 16000);
  Bot& b = sim.rob[n];
  b.dna = {{0, 0}, {0, 5}, {10, 1}};
  b.DnaLen = 2;
  b.color = 0;
  b.Mutables.Mutations = true;
  b.Mutables.mutarray[mut::InsertionUP] = 1;
  b.Mutables.Mean[mut::InsertionUP] = 1;
  b.Mutables.StdDev[mut::InsertionUP] = 0;

  mutate(sim, n, true);

  // Pase de tipos: el hueco (-1,-1) se vuelve numero (tipo 0), value queda -1.
  // Pase de valores: siembra Gauss(500,0) con el gasdev cacheado
  // (gset = -0.8325546) => CInt(-416.277) = -416; luego salto fino
  // Gauss(7,-416) con el par (0.25,0.75) => CInt(-410.172) = -410.
  CHECK(b.Mutations == 2);  // 1 token = 2 mutaciones
  CHECK(b.LastMut == 2);
  CHECK(b.DnaLen == 3);
  CHECK(b.dna[2].tipo == 0);
  CHECK(b.dna[2].value == -410);
  CHECK(is_end(b.dna[3]));
  CHECK(b.color == 0);  // ambos canales clampados a 0 con las extracciones 0.0
  CHECK(rnd.exhausted());
}

// ---------------------------------------------------------------------------
// B-34 · Amplification nunca centra en el token 1 [ciclo]
TEST_CASE("B-34 Amplification: t arranca en 2 [PROBABLE BUG] B6-8") {
  SUBCASE("inventario de extracciones: t = 2..UBound-1 (nunca 1)") {
    // dna: fantasma + 4 numeros + end (UBound=5). Con Mean=1 la Gauss da
    // Length=(1-1)\2=0: nada muta, pero cada t consume su sorteo. Si t
    // arrancara en 1 habria 4 iteraciones; son 3 (t=2,3,4):
    // [chance+gasdev x2, chance (cache), chance+gasdev x2] = 7 exactas.
    Sim sim;
    InjectedRnd rnd({0.5f, 0.25f, 0.75f, 0.5f, 0.5f, 0.25f, 0.75f});
    sim.rndy = &rnd;
    const int n = addbot(sim, 16000, 16000);
    Bot& b = sim.rob[n];
    b.dna = {{0, 0}, {0, 10}, {0, 20}, {0, 30}, {0, 40}, {10, 1}};
    b.DnaLen = 5;
    b.Mutables.mutarray[mut::AmplificationUP] = 1;  // p = 1 en cada t
    b.Mutables.Mean[mut::AmplificationUP] = 1;
    b.Mutables.StdDev[mut::AmplificationUP] = 0;

    Amplification(sim, n);

    CHECK(b.Mutations == 0);
    CHECK(b.DnaLen == 5);
    CHECK(rnd.exhausted());  // 7 y solo 7: el token 1 nunca fue candidato
  }
  SUBCASE("amplificacion guionada centrada en t=2") {
    // Mean=3 => Length=1: copia dna[1..3] e inserta tras start=1.
    Sim sim;
    InjectedRnd rnd({0.3f, 0.25f, 0.75f, 0.0f, 0.9f, 0.9f, 0.9f, 0.9f, 0.9f});
    sim.rndy = &rnd;
    const int n = addbot(sim, 16000, 16000);
    Bot& b = sim.rob[n];
    b.dna = {{0, 0}, {0, 10}, {0, 20}, {0, 30}, {0, 40}, {10, 1}};
    b.DnaLen = 5;
    b.Mutables.mutarray[mut::AmplificationUP] = 2;  // p = 1/2
    b.Mutables.Mean[mut::AmplificationUP] = 3;
    b.Mutables.StdDev[mut::AmplificationUP] = 0;

    Amplification(sim, n);

    const std::vector<Block> want = {{0, 0},  {0, 10}, {0, 10},
                                     {0, 20}, {0, 30}, {0, 20},
                                     {0, 30}, {0, 40}, {10, 1}};
    REQUIRE(b.dna.size() == want.size());
    for (std::size_t t = 0; t < want.size(); ++t) {
      CHECK(b.dna[t].tipo == want[t].tipo);
      CHECK(b.dna[t].value == want[t].value);
    }
    CHECK(b.DnaLen == 8);
    CHECK(b.Mutations == 1);
    CHECK(rnd.exhausted());
  }
}

// ---------------------------------------------------------------------------
// B-35 · Las mutaciones en vida no refrescan la firma [ciclo]
TEST_CASE("B-35 mutacion en vida: occurr rancio, mem(336/339) re-publicados [PROBABLE BUG] B6-9") {
  Sim sim;
  // [gasdev x2 (longitud de rafaga), Random(0,99), moneda salto fino,
  //  re-agenda, mutatecolors x2]
  InjectedRnd rnd({0.25f, 0.75f, 0.5f, 0.9f, 0.5f, 0.0f, 0.0f});
  sim.rndy = &rnd;
  const int n = addbot(sim, 16000, 16000);
  Bot& b = sim.rob[n];
  // "50 .shoot store end": la firma anuncia un store a .shoot (occurr 7).
  b.dna = {{0, 0}, {0, 50}, {0, 7}, {7, 1}, {10, 1}};
  b.DnaLen = 4;
  makeoccurrlist(sim, n);
  REQUIRE(b.occurr[7] == 1);
  REQUIRE(b.mem[727] == 1);  // myshoot

  // Mutacion puntual agendada sobre el token 2 (el (0,7) de la direccion).
  b.age = 5;
  b.PointMutCycle = 5;
  b.PointMutBP = 2;
  b.Mutables.Mutations = true;
  b.Mutables.mutarray[mut::PointUP] = 5000;
  b.Mutables.Mean[mut::PointUP] = 1;
  b.Mutables.StdDev[mut::PointUP] = 0;
  b.Mutables.PointWhatToChange = 100;  // muta el valor
  b.mem[336] = 0;   // para probar la re-publicacion
  b.mem[339] = 77;

  mutate(sim, n);  // en vida

  // El token ya no apunta a .shoot (Gauss(7,7) con gset cacheado => 1)...
  CHECK(b.dna[2].value == 1);
  CHECK(b.Mutations == 1);
  // ...pero la firma sigue anunciando el store a .shoot (sin makeoccurrlist):
  CHECK(b.occurr[7] == 1);
  CHECK(b.mem[727] == 1);
  // mem(336)/mem(339) en cambio SI se re-publican:
  CHECK(b.mem[336] == 4);
  CHECK(b.mem[339] == 0);
  CHECK(rnd.exhausted());

  // El proximo evento con makeoccurrlist (parto/virus/carga) la refresca:
  makeoccurrlist(sim, n);
  CHECK(b.occurr[7] == 0);
  CHECK(b.mem[727] == 0);
  CHECK(b.occurr[1] == 1);  // el nuevo (0,1) + store anuncia occurr 1
  CHECK(b.mem[721] == 1);
}

// ---------------------------------------------------------------------------
// B-29 · El crossover pierde tramos [integración] (RNG-parametrizado)
TEST_CASE("B-29 el tramo C presente solo en la madre vive o muere por moneda [PROBABLE BUG] B6-3") {
  // Madre A B C D end, esperma A B D end (nucli distintos por valor).
  // Monedas: [loteria vegetal (se tira siempre, RV-21), w1 racha inicial,
  // 3 monedas de valor (IIf eager), moneda del tramo C, w2 racha final,
  // 2 monedas de valor, deflect de maketie].
  auto run = [](vb_single segcoin, std::vector<Block>& childOut,
                Sim& sim) -> int {
    InjectedRnd rnd({0.5f, 0.3f, 0.3f, 0.3f, 0.3f, segcoin, 0.3f, 0.3f, 0.3f, 0.5f});
    sim.rndy = &rnd;
    const int mother = addbot(sim, 16000, 16000);
    Bot& m = sim.rob[mother];
    m.dna = {{0, 0}, {0, 1}, {0, 2}, {0, 3}, {0, 4}, {10, 1}};
    m.DnaLen = 5;
    m.spermDNA = {{0, 0}, {0, 1}, {0, 2}, {0, 4}, {10, 1}};
    m.spermDNAlen = 4;
    m.fertilized = 3;
    m.mem[addr::SEXREPRO] = 50;

    SexReproduce(sim, mother);
    CHECK(rnd.exhausted());
    sim.rndy = nullptr;

    const int child = mother + 1;
    childOut = sim.rob[child].dna;
    return child;
  };

  SUBCASE("moneda 0.4: C se conserva (hijo = ADN de la madre)") {
    Sim sim;
    std::vector<Block> child;
    const int c = run(0.4f, child, sim);
    const std::vector<Block> want = {{0, 0}, {0, 1}, {0, 2},
                                     {0, 3}, {0, 4}, {10, 1}};
    REQUIRE(child.size() == want.size());
    for (std::size_t t = 0; t < want.size(); ++t) {
      CHECK(child[t].tipo == want[t].tipo);
      CHECK(child[t].value == want[t].value);
    }
    CHECK(sim.rob[c].DnaLen == 5);
    checkStubsCerrados(sim);
  }
  SUBCASE("moneda 0.6: C se pierde (hijo mas corto que la madre)") {
    Sim sim;
    std::vector<Block> child;
    const int c = run(0.6f, child, sim);
    const std::vector<Block> want = {{0, 0}, {0, 1}, {0, 2}, {0, 4}, {10, 1}};
    REQUIRE(child.size() == want.size());
    for (std::size_t t = 0; t < want.size(); ++t) {
      CHECK(child[t].tipo == want[t].tipo);
      CHECK(child[t].value == want[t].value);
    }
    CHECK(sim.rob[c].DnaLen == 4);
  }
}

// ---------------------------------------------------------------------------
// R-09 · Doble encolado asexual: la moneda [ciclo]
TEST_CASE("R-09 repro y mrepro activos: 1 moneda decide el porcentaje") {
  auto run = [](std::vector<vb_single> seq, Sim& sim) {
    InjectedRnd rnd(std::move(seq));
    sim.rndy = &rnd;
    const int n = addbot(sim, 16000, 16000);
    Bot& b = sim.rob[n];
    b.dna = {{0, 0}, {0, 5}, {10, 1}};
    b.DnaLen = 2;
    b.mem[addr::Repro] = 30;
    b.mem[addr::mrepro] = 60;
    sim.rep[1] = n;
    sim.rp = 2;
    ReproduceAndKill(sim);
    CHECK(rnd.exhausted());
    sim.rndy = nullptr;
    return n;
  };

  SUBCASE("rndy 0.6 > 0.5: manda repro (30%)") {
    Sim sim;
    // [moneda, loteria vegetal (siempre, RV-21), 5 sorteos de operadores del
    //  regimen mrepro (rates 1000), deflect de maketie]
    const int n = run({0.6f, 0.5f, 0.9f, 0.9f, 0.9f, 0.9f, 0.9f, 0.5f}, sim);
    const int child = n + 1;
    CHECK(sim.rob[child].nrg == (10000.0f / 100.0f) * 30.0f * 0.999f);
    CHECK(sim.rob[child].body == 300.0f);
    CHECK(sim.rob[n].mem[addr::Repro] == 0);   // consumidos en el exito
    CHECK(sim.rob[n].mem[addr::mrepro] == 0);
  }
  SUBCASE("rndy 0.4 <= 0.5: manda mrepro (60%)") {
    Sim sim;
    const int n = run({0.4f, 0.5f, 0.9f, 0.9f, 0.9f, 0.9f, 0.9f, 0.5f}, sim);
    const int child = n + 1;
    CHECK(sim.rob[child].nrg == (10000.0f / 100.0f) * 60.0f * 0.999f);
    CHECK(sim.rob[child].body == 600.0f);
  }
  SUBCASE("un solo comando activo: cero extracciones en la eleccion") {
    Sim sim;
    InjectedRnd rnd({0.5f, 0.5f});  // loteria vegetal (RV-21) + deflect de maketie
    sim.rndy = &rnd;
    const int n = addbot(sim, 16000, 16000);
    Bot& b = sim.rob[n];
    b.dna = {{0, 0}, {0, 5}, {10, 1}};
    b.DnaLen = 2;
    b.mem[addr::Repro] = 30;  // sin mrepro
    sim.rep[1] = n;
    sim.rp = 2;
    ReproduceAndKill(sim);
    CHECK(rnd.exhausted());
    CHECK(sim.rob[n + 1].body == 300.0f);
  }
}

// ---------------------------------------------------------------------------
// R-10 · Loterías vegetales asimétricas [ciclo] · [PROBABLE BUG] B6-2
TEST_CASE("R-10 gate vegetal: 1/11 asexual vs 1/10 sexual [PROBABLE BUG] B6-2") {
  auto vegmother = [](Sim& sim, bool sexual) {
    sim.TotalChlr = 95;  // > 90% del techo (100) y <= techo: loteria activa
    sim.totvegsDisplayed = 1;
    const int n = addbot(sim, 16000, 16000);
    Bot& b = sim.rob[n];
    b.Veg = true;
    b.dna = dna_5_100_store();
    b.DnaLen = 4;
    if (sexual) {
      b.spermDNA = dna_5_100_store();
      b.spermDNAlen = 4;
      b.fertilized = 5;
      b.mem[addr::SEXREPRO] = 50;
    }
    return n;
  };

  SUBCASE("asexual con 0.5: Int(11*0.5) = 5 => pasa") {
    Sim sim;
    InjectedRnd rnd({0.5f, 0.5f});  // loteria + deflect maketie
    sim.rndy = &rnd;
    const int n = vegmother(sim, false);
    Reproduce(sim, n, 50);
    CHECK(sim.opts.TotBorn == 1);
    CHECK(rnd.exhausted());
  }
  SUBCASE("asexual con 0.46: Int(5.06) = 5 => TAMBIEN pasa") {
    Sim sim;
    InjectedRnd rnd({0.46f, 0.5f});
    sim.rndy = &rnd;
    const int n = vegmother(sim, false);
    Reproduce(sim, n, 50);
    CHECK(sim.opts.TotBorn == 1);
    CHECK(rnd.exhausted());
  }
  SUBCASE("asexual con 0.7: Int(7.7) = 7 => no pasa") {
    Sim sim;
    InjectedRnd rnd({0.7f});
    sim.rndy = &rnd;
    const int n = vegmother(sim, false);
    Reproduce(sim, n, 50);
    CHECK(sim.opts.TotBorn == 0);
    CHECK(rnd.exhausted());
  }
  SUBCASE("sexual con 0.5: Int(10*0.5) = 5 => pasa") {
    Sim sim;
    // [loteria, whatside, 5 monedas de valor (IIf eager), deflect]
    InjectedRnd rnd({0.5f, 0.3f, 0.3f, 0.3f, 0.3f, 0.3f, 0.3f, 0.5f});
    sim.rndy = &rnd;
    const int n = vegmother(sim, true);
    SexReproduce(sim, n);
    CHECK(sim.opts.TotBorn == 1);
    CHECK(sim.rob[n].fertilized == -1);
    CHECK(rnd.exhausted());
  }
  SUBCASE("sexual con 0.46: Int(4.6) = 4 => NO pasa (asimetria 1/11 vs 1/10)") {
    Sim sim;
    InjectedRnd rnd({0.46f});
    sim.rndy = &rnd;
    const int n = vegmother(sim, true);
    SexReproduce(sim, n);
    CHECK(sim.opts.TotBorn == 0);
    CHECK(sim.rob[n].mem[addr::SEXREPRO] == 50);  // orden no consumida
    CHECK(sim.rob[n].fertilized == 5);
    CHECK(rnd.exhausted());
  }
}

// ---------------------------------------------------------------------------
// R-11 · Crossover con padres idénticos [integración] · CORREGIDO CONTRA EL
// FUENTE (ver cabecera del archivo): el hijo NO pierde su primer token — la
// racha emparejada copia desde UBound(Outdna)+1 (:633) y el (0,0) inicial lo
// recorta el bug fix. El consumo de RNG es 1 loteria vegetal (se tira
// siempre, RV-21) + 1 whatside + 5 monedas de valor (IIf eager) + 1 deflect
// de maketie.
TEST_CASE("R-11 padres identicos: hijo identico; 6 extracciones de crossover") {
  Sim sim;
  InjectedRnd rnd({0.5f, 0.3f, 0.3f, 0.3f, 0.3f, 0.3f, 0.3f, 0.5f});
  sim.rndy = &rnd;
  const int mother = addbot(sim, 16000, 16000);
  Bot& m = sim.rob[mother];
  m.dna = dna_5_100_store();
  m.DnaLen = 4;
  m.spermDNA = dna_5_100_store();
  m.spermDNAlen = 4;
  m.fertilized = 3;
  m.mem[addr::SEXREPRO] = 50;

  SexReproduce(sim, mother);

  const int child = mother + 1;
  const Bot& c = sim.rob[child];
  const std::vector<Block> want = dna_5_100_store();
  REQUIRE(c.dna.size() == want.size());
  for (std::size_t t = 0; t < want.size(); ++t) {
    CHECK(c.dna[t].tipo == want[t].tipo);
    CHECK(c.dna[t].value == want[t].value);
  }
  CHECK(c.dna[0].tipo == 0);
  CHECK(c.dna[0].value == 0);  // el fantasma sobrevive: sin corrimiento
  CHECK(c.DnaLen == 4);
  CHECK(sim.rob[mother].mem[addr::SEXREPRO] == 0);
  CHECK(sim.rob[mother].fertilized == -1);
  CHECK(sim.rob[mother].mem[addr::SYSFERTILIZED] == 0);
  CHECK(c.nrg == (10000.0f / 100.0f) * 50.0f * 0.999f);
  CHECK(rnd.exhausted());
  checkStubsCerrados(sim);
}

// ---------------------------------------------------------------------------
// M7 · sharechloroplasts (cierra makestuff_stub)
TEST_CASE("M7 sharechloroplasts: umbral 0.25 de distancia genetica") {
  SUBCASE("ADN identico (distancia 0): reparte segun mem(sharechlr)") {
    Sim sim;
    VbRng rng;
    sim.rndy = &rng;
    const int a = addbot(sim, 16000, 16000);
    const int b2 = addbot(sim, 16500, 16000);
    sim.rob[a].dna = {{0, 0}, {0, 5}, {10, 1}};
    sim.rob[b2].dna = {{0, 0}, {0, 5}, {10, 1}};
    sim.rob[a].chloroplasts = 1000;
    sim.rob[b2].chloroplasts = 3000;
    sim.rob[a].Ties[1].pnt = static_cast<vb_integer>(b2);
    sim.rob[a].mem[addr::sharechlr] = 25;

    CHECK(DoGeneticDistance(sim, a, b2) == 0.0f);
    sharechloroplasts(sim, a, 1);
    CHECK(sim.rob[a].chloroplasts == 1000.0f);   // 4000 * 0.25
    CHECK(sim.rob[b2].chloroplasts == 3000.0f);  // 4000 * 0.75
    CHECK(sim.rob[a].Chlr_Share_Delay == 0);
    checkStubsCerrados(sim);
  }
  SUBCASE("ADN distinto (distancia 2/3): delay 8 y sin reparto") {
    Sim sim;
    VbRng rng;
    sim.rndy = &rng;
    const int a = addbot(sim, 16000, 16000);
    const int b2 = addbot(sim, 16500, 16000);
    sim.rob[a].dna = {{0, 0}, {0, 1}, {0, 2}, {0, 3}, {0, 4}, {10, 1}};
    sim.rob[b2].dna = {{0, 0}, {0, 11}, {0, 12}, {0, 13}, {0, 14}, {10, 1}};
    sim.rob[a].chloroplasts = 1000;
    sim.rob[b2].chloroplasts = 3000;
    sim.rob[a].Ties[1].pnt = static_cast<vb_integer>(b2);
    sim.rob[a].mem[addr::sharechlr] = 25;

    // fantasmas y end emparejan; los 4 numeros de cada lado no: 8/12.
    CHECK(DoGeneticDistance(sim, a, b2) ==
          static_cast<vb_single>(8.0 / 12.0));
    sharechloroplasts(sim, a, 1);
    CHECK(sim.rob[a].chloroplasts == 1000.0f);
    CHECK(sim.rob[b2].chloroplasts == 3000.0f);
    CHECK(sim.rob[a].Chlr_Share_Delay == 8);
  }
}
