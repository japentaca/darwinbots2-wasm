// E4 — costes dinámicos del tick (70-CASOS-DORADOS.md §11): pasos 6-7 de
// 10-CICLO.md §2, transcritos de Master.bas:240-300. Casos E4-01..E4-07.
// Inventario RNG: los pasos 6-7 no consumen rndy — todos los casos corren
// con InjectedRnd vacío (cualquier extracción lanzaría y rompería el caso).
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

  // Alta manual sin consumo de RNG (patrón de test_memory.cpp).
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

// El delta del ajuste con la aritmética EXACTA del fuente (E4-03): literal
// 0.0000001 Double, cadena en doble con el orden de factores de
// Master.bas:283, suma en doble, asignación a Single.
inline vb_single adjusted(vb_single old54, vb_single corr, int sgn,
                          vb_single c55) {
  return static_cast<vb_single>(
      static_cast<double>(old54) +
      (0.0000001 * static_cast<double>(corr) * sgn *
       static_cast<double>(c55)));
}

}  // namespace

// ---------------------------------------------------------------------------
TEST_CASE("E4-01 paso 6: poblacion y historial cada 10 ciclos") {
  World w;
  w.sim.totnvegsDisplayed = 7;
  w.sim.totvegsDisplayed = 5;
  for (int i = 1; i <= 10; ++i)
    w.sim.PopulationLast10Cycles[i] = static_cast<vb_integer>(i);

  SUBCASE("TotRunCycle Mod 10 <> 0: historial intacto") {
    w.sim.opts.TotRunCycle = 15;
    DynamicCostsStep(w.sim);
    for (int i = 1; i <= 10; ++i)
      CHECK(w.sim.PopulationLast10Cycles[i] == i);
  }

  SUBCASE("Mod 10 = 0 sin plantas: P(1) = totnvegsDisplayed, resto corre") {
    w.sim.opts.TotRunCycle = 20;
    DynamicCostsStep(w.sim);
    CHECK(w.sim.PopulationLast10Cycles[1] == 7);
    for (int i = 2; i <= 10; ++i)
      CHECK(w.sim.PopulationLast10Cycles[i] == i - 1);  // el 10 viejo cae
  }

  SUBCASE("Mod 10 = 0 con DYNAMICCOSTINCLUDEPLANTS <> 0: suma vegetales") {
    w.sim.vm.costs.v[61] = 1.0f;  // DYNAMICCOSTINCLUDEPLANTS
    w.sim.opts.TotRunCycle = 20;
    DynamicCostsStep(w.sim);
    CHECK(w.sim.PopulationLast10Cycles[1] == 12);
  }

  CHECK(w.rng.consumed() == 0);  // inventario RNG: cero extracciones
}

// ---------------------------------------------------------------------------
TEST_CASE("E4-02 paso 7: DynamicCountdown con suelo -10") {
  World w;
  w.sim.opts.TotRunCycle = 1;  // sin shift del historial
  w.sim.vm.costs.v[56] = -1.0f;  // USEDYNAMICCOSTS (la UI escribe -1)
  w.sim.vm.costs.v[53] = 30.0f;  // target = pop: dentro del rango, sin ajuste
  w.sim.totnvegsDisplayed = 30;
  w.sim.PopulationLast10Cycles[10] = 30;

  SUBCASE("pop = P(10): decrementa hasta el suelo") {
    w.sim.DynamicCountdown = -9;
    DynamicCostsStep(w.sim);
    CHECK(w.sim.DynamicCountdown == -10);
    DynamicCostsStep(w.sim);
    CHECK(w.sim.DynamicCountdown == -10);  // suelo
  }

  SUBCASE("pop <> P(10): resetea a 10") {
    w.sim.totnvegsDisplayed = 31;
    w.sim.vm.costs.v[53] = 31.0f;
    w.sim.DynamicCountdown = -4;
    DynamicCostsStep(w.sim);
    CHECK(w.sim.DynamicCountdown == 10);
  }

  SUBCASE("USEDYNAMICCOSTS = 0: el countdown no se toca") {
    w.sim.vm.costs.v[56] = 0.0f;
    w.sim.DynamicCountdown = 3;
    DynamicCostsStep(w.sim);
    CHECK(w.sim.DynamicCountdown == 3);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E4-03 paso 7: ajuste del multiplicador, aritmetica exacta") {
  World w;
  w.sim.opts.TotRunCycle = 1;
  auto& C = w.sim.vm.costs.v;
  C[53] = 100.0f;  // DYNAMICCOSTTARGET
  C[55] = 50.0f;   // DYNAMICCOSTSENSITIVITY
  C[56] = -1.0f;   // USEDYNAMICCOSTS
  C[57] = 10.0f;   // UPPERRANGE %
  C[58] = 10.0f;   // LOWERRANGE %
  C[54] = 1.0f;    // COSTMULTIPLIER

  SUBCASE("rama alta: pop sobre el rango y subiendo") {
    w.sim.totnvegsDisplayed = 120;
    w.sim.PopulationLast10Cycles[10] = 110;
    DynamicCostsStep(w.sim);
    // UpperRange = CSng(10 * 0.01 * 100) = 10; AmountOff = 20; Corr = 10.
    CHECK(C[54] == adjusted(1.0f, 10.0f, +1, 50.0f));
    CHECK(w.sim.DynamicCountdown == 10);
  }

  SUBCASE("rama baja: pop bajo el rango y cayendo") {
    w.sim.totnvegsDisplayed = 80;
    w.sim.PopulationLast10Cycles[10] = 90;
    DynamicCostsStep(w.sim);
    // AmountOff = -20 < -10; Corr = Abs(-20) - 10 = 10; Sgn = -1.
    CHECK(C[54] == adjusted(1.0f, 10.0f, -1, 50.0f));
  }

  SUBCASE("dentro del rango: intacto bit a bit") {
    w.sim.totnvegsDisplayed = 105;
    w.sim.PopulationLast10Cycles[10] = 90;
    DynamicCostsStep(w.sim);
    CHECK(C[54] == 1.0f);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E4-04 paso 7: la puerta del countdown en el estancamiento") {
  World w;
  w.sim.opts.TotRunCycle = 1;
  auto& C = w.sim.vm.costs.v;
  C[53] = 100.0f;
  C[55] = 50.0f;
  C[56] = -1.0f;
  C[57] = 10.0f;
  C[58] = 10.0f;
  C[54] = 1.0f;

  SUBCASE("poblacion clavada fuera de rango: ajusta al abrirse la puerta") {
    w.sim.totnvegsDisplayed = 40;
    w.sim.PopulationLast10Cycles[10] = 40;  // clavada
    w.sim.DynamicCountdown = 2;

    DynamicCostsStep(w.sim);  // countdown 2 -> 1; 1 > 0: sin ajuste
    CHECK(C[54] == 1.0f);
    CHECK(w.sim.DynamicCountdown == 1);

    DynamicCostsStep(w.sim);  // countdown 1 -> 0; puerta abierta: ajusta
    // AmountOff = -60; Corr = Abs(-60) - 10 = 50; Sgn = -1.
    const vb_single after = adjusted(1.0f, 50.0f, -1, 50.0f);
    CHECK(C[54] == after);
    CHECK(w.sim.DynamicCountdown == 10);  // reseteado por el ajuste

    DynamicCostsStep(w.sim);  // countdown 10 -> 9; sin ajuste
    CHECK(C[54] == after);
    CHECK(w.sim.DynamicCountdown == 9);
  }

  SUBCASE("recuperandose (P(10) < pop) con countdown > 0: sin ajuste") {
    w.sim.totnvegsDisplayed = 40;
    w.sim.PopulationLast10Cycles[10] = 35;
    w.sim.DynamicCountdown = 5;
    DynamicCostsStep(w.sim);
    CHECK(C[54] == 1.0f);
    CHECK(w.sim.DynamicCountdown == 10);  // pop <> P(10): reset
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E4-05 paso 7: suelo en 0 salvo ALLOWNEGATIVECOSTX = 1 exacto") {
  World w;
  w.sim.opts.TotRunCycle = 1;
  auto& C = w.sim.vm.costs.v;
  C[53] = 100.0f;
  C[55] = 50.0f;
  C[56] = -1.0f;
  C[57] = 10.0f;
  C[58] = 10.0f;
  // Poblacion clavada bajo el rango con puerta abierta: ajuste a la baja.
  w.sim.totnvegsDisplayed = 40;
  w.sim.PopulationLast10Cycles[10] = 40;
  w.sim.DynamicCountdown = 0;

  SUBCASE("Costs(62) = 0: clampa a 0") {
    C[54] = 0.00001f;
    C[62] = 0.0f;
    DynamicCostsStep(w.sim);
    CHECK(C[54] == 0.0f);
  }

  SUBCASE("Costs(62) = 1: conserva el negativo exacto") {
    C[54] = 0.00001f;
    C[62] = 1.0f;
    DynamicCostsStep(w.sim);
    CHECK(C[54] == adjusted(0.00001f, 50.0f, -1, 50.0f));
    CHECK(C[54] < 0.0f);
  }

  SUBCASE("Costs(62) = 0.5 (<> 1): tambien clampa") {
    C[54] = 0.00001f;
    C[62] = 0.5f;
    DynamicCostsStep(w.sim);
    CHECK(C[54] == 0.0f);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E4-06 cero-costes de emergencia y reinstauracion") {
  World w;
  w.sim.opts.TotRunCycle = 1;
  auto& C = w.sim.vm.costs.v;
  C[52] = 50.0f;  // BOTNOCOSTLEVEL
  C[59] = 80.0f;  // COSTXREINSTATEMENTLEVEL
  C[54] = 1.5f;
  C[56] = 0.0f;   // sin costes dinamicos: el bloque corre igual

  SUBCASE("zeroed, sin re-zeroed, reinstauracion estricta") {
    w.sim.totnvegsDisplayed = 40;
    DynamicCostsStep(w.sim);
    CHECK(w.sim.CostsWereZeroed);
    CHECK(w.sim.opts.oldCostX == 1.5f);
    CHECK(C[54] == 0.0f);

    DynamicCostsStep(w.sim);  // mult ya 0: no pisa oldCostX
    CHECK(w.sim.opts.oldCostX == 1.5f);
    CHECK(C[54] == 0.0f);

    w.sim.totnvegsDisplayed = 80;  // no estricto: 80 > 80 falso
    DynamicCostsStep(w.sim);
    CHECK(C[54] == 0.0f);
    CHECK(w.sim.CostsWereZeroed);

    w.sim.totnvegsDisplayed = 81;
    DynamicCostsStep(w.sim);
    CHECK(C[54] == 1.5f);
    CHECK(!w.sim.CostsWereZeroed);
  }

  SUBCASE("default MDIForm Costs(52) = -1: nunca dispara") {
    C[52] = -1.0f;
    w.sim.totnvegsDisplayed = 0;
    DynamicCostsStep(w.sim);
    CHECK(C[54] == 1.5f);
    CHECK(!w.sim.CostsWereZeroed);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E4-07 integracion: el tick usa el multiplicador ajustado") {
  World w;
  auto& C = w.sim.vm.costs.v;
  C[0] = 1.0f;        // NUMCOST: 1 nrg por token numerico
  C[54] = 1.0f;       // COSTMULTIPLIER
  C[53] = 0.0f;       // target 0: AmountOff = pop
  C[55] = 100000.0f;  // sensibilidad grande para un delta visible
  C[56] = -1.0f;      // USEDYNAMICCOSTS
  C[57] = 0.0f;       // rangos 0: cualquier desvio dispara
  C[58] = 0.0f;

  // Fundador no-vegetal: 2 tokens numericos por tick ("5" y "900").
  const int n = w.spawn("start 5 900 store stop", "R.txt", 2000.0f, 2000.0f);
  REQUIRE(n == 1);

  // Tick 1: totnvegsDisplayed = 0 (el publish corre al COMIENZO de
  // UpdateBots con el conteo de las pasadas del tick anterior,
  // Robots.bas:1497-1500 — el paso 6 del tick N ve el conteo del N-2).
  // Los 2 numeros cobran 1 * 1 cada uno.
  UpdateSim(w.sim);
  CHECK(C[54] == 1.0f);
  const vb_single nrg1 = (20000.0f - 1.0f) - 1.0f;
  CHECK(w.sim.rob[n].nrg == nrg1);
  CHECK(w.sim.totnvegsDisplayed == 0);

  // Tick 2: el paso 6 corre antes del publish de este tick -> pop aun 0,
  // sin ajuste; al cerrar el tick el Displayed ya es 1.
  UpdateSim(w.sim);
  CHECK(C[54] == 1.0f);
  const vb_single nrg2 = (nrg1 - 1.0f) - 1.0f;
  CHECK(w.sim.rob[n].nrg == nrg2);
  CHECK(w.sim.totnvegsDisplayed == 1);

  // Tick 3: pop = 1 > 0 y P(10) = 0 < 1 -> ajusta ANTES de ExecRobs:
  // delta = 0.0000001 * 1 * 1 * 100000 = 0.01 (en doble); el cargo del
  // MISMO tick ya escala por el multiplicador nuevo.
  UpdateSim(w.sim);
  const vb_single m2 = adjusted(1.0f, 1.0f, +1, 100000.0f);
  CHECK(C[54] == m2);
  const vb_single tok2 = 1.0f * m2;  // Costs.of(NUMCOST) en Single
  CHECK(w.sim.rob[n].nrg == (nrg2 - tok2) - tok2);

  // El historial se desplaza exactamente en los ticks Mod 10 = 0.
  for (int i = 4; i <= 9; ++i) UpdateSim(w.sim);
  CHECK(w.sim.opts.TotRunCycle == 9);
  CHECK(w.sim.PopulationLast10Cycles[1] == 0);  // aun virgen
  UpdateSim(w.sim);  // TotRunCycle = 10
  CHECK(w.sim.PopulationLast10Cycles[1] == 1);

  CHECK(w.rng.consumed() == 0);  // inventario RNG de los pasos 6-7: cero
}
