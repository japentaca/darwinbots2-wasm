// E5 — modos de juego (70-CASOS-DORADOS.md §11): paso 3 (hidepred/evo,
// Master.bas:52-201), pasos 8-9/22 (handicap/avrnrg), paso 13 (Player Bot),
// paso 26 (modos 1/7/8/9), F1Mode.bas (FindSpecies/Countpop/dreason),
// fittest/calculateZB y auto-forking. Casos E5-01..E5-15.
// Inventario RNG: el ÚNICO consumo de los pasos E5 es 1 rndy al alternar
// hidepred (Master.bas:198); todo lo demás corre con InjectedRnd vacío.
#include <cmath>
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

  // Alta manual sin consumo de RNG (patrón de test_dynamiccosts.cpp).
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
    sim.MaxAbsNum += 1;
    b.AbsNum = sim.MaxAbsNum;
    return n;
  }
};

const char* kDnaIdle = "start stop";

}  // namespace

// ---------------------------------------------------------------------------
TEST_CASE("E5-01 calc_handycap: rampa hasta hidePredCycl*8") {
  World w;
  w.sim.evo.energydifXP = 5.0;
  w.sim.evo.energydifXP2 = -3.0;  // exacto = 8.0

  SUBCASE("antes del umbral: proporcional a TotRunCycle") {
    w.sim.hidePredCycl = 100;  // denominador 800
    w.sim.opts.TotRunCycle = 200;
    CHECK(calc_handycap(w.sim) == doctest::Approx(8.0 * 200.0 / 800.0));
  }
  SUBCASE("en o sobre el umbral: el handicap exacto") {
    w.sim.hidePredCycl = 100;
    w.sim.opts.TotRunCycle = 800;
    CHECK(calc_handycap(w.sim) == 8.0);
  }
  SUBCASE("hidePredCycl = 0: la comparacion es False, sin division") {
    w.sim.hidePredCycl = 0;
    w.sim.opts.TotRunCycle = 0;
    CHECK(calc_handycap(w.sim) == 8.0);
  }
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-02 paso 3: fuera del modo evo es no-op (y paso 2 cuenta)") {
  World w;
  w.sim.x_restartmode = 0;
  w.sim.evo.ModeChangeCycles = 99999;  // sobre cualquier umbral
  w.sim.evo.hidepred = false;
  UpdateSim(w.sim);
  CHECK(w.sim.evo.ModeChangeCycles == 100000);  // paso 2 SÍ incrementa
  CHECK(w.sim.evo.hidepred == false);           // paso 3 no corre
  CHECK(w.sim.events.evo_lost == false);
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-03 paso 3: conteo Base/Mutate y fin de evo") {
  World w;
  w.sim.x_restartmode = 4;
  w.sim.hidePredCycl = 30000;  // umbral inalcanzable: sin cambio de modo

  SUBCASE("Mutate_count = 0: evo perdido + stopflag") {
    w.spawn(kDnaIdle, "Base.txt", 1000, 1000);
    HidePredStep(w.sim, true);
    CHECK(w.sim.events.evo_lost);
    CHECK(w.sim.stopflag);
    CHECK(w.sim.events.sim_stop_requested);
    // ...y con stopflag puesto, Base_count = 0 NO dispara la victoria
    // (Master.bas:83: And Not stopflag).
    w.sim.rob[1].exist = false;
    w.sim.events.evo_lost = false;
    HidePredStep(w.sim, true);
    CHECK(w.sim.events.evo_won == false);
    CHECK(w.sim.events.evo_lost);  // Mutate sigue en 0: vuelve a avisar
  }

  SUBCASE("Base_count = 0 sin stopflag: evo ganado con el fittest") {
    const int m = w.spawn(kDnaIdle, "Mutate.txt", 1000, 1000);
    HidePredStep(w.sim, true);
    CHECK(w.sim.events.evo_won);
    CHECK(w.sim.events.evo_won_best == m);
    CHECK(w.sim.events.evo_lost == false);
  }

  SUBCASE("stagnent: reset con Base > Mutate y set en el ciclo 1000000") {
    w.spawn(kDnaIdle, "Base.txt", 1000, 1000);
    w.spawn(kDnaIdle, "Mutate.txt", 2000, 2000);
    w.sim.evo.stagnent = true;
    w.spawn(kDnaIdle, "Base.txt", 3000, 3000);  // Base 2 > Mutate 1
    HidePredStep(w.sim, true);
    CHECK(w.sim.evo.stagnent == false);
    // En el ciclo 1000000 el set corre DESPUÉS del reset por conteo
    // (Master.bas:74 vs :90): stagnent queda True aunque Base > Mutate.
    w.sim.opts.TotRunCycle = 1000000;
    HidePredStep(w.sim, true);
    CHECK(w.sim.evo.stagnent == true);
    // Al ciclo siguiente (sin el set), Base > Mutate vuelve a resetear.
    w.sim.opts.TotRunCycle = 1000001;
    HidePredStep(w.sim, true);
    CHECK(w.sim.evo.stagnent == false);
  }
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-04 paso 3: alternancia de hidepred y aritmetica del handicap") {
  World w;
  w.sim.x_restartmode = 4;
  w.sim.hidePredCycl = 120;   // umbral = 120/1.2 + offset = 100
  w.sim.evo.hidePredOffset = 0;
  w.sim.LFOR = 10.0f;
  w.spawn(kDnaIdle, "Base.txt", 1000, 1000);
  w.spawn(kDnaIdle, "Mutate.txt", 20000, 20000);

  SUBCASE("bajo el umbral: nada, 0 RNG") {
    w.sim.evo.ModeChangeCycles = 100;  // 100 > 100 es falso
    HidePredStep(w.sim, true);
    CHECK(w.sim.evo.hidepred == false);
    CHECK(w.rng.consumed() == 0);
  }

  SUBCASE("cruce con hidepred = False: energydifX y toggle, 1 rndy") {
    w.rng = InjectedRnd{std::vector<vb_single>{0.5f}};
    w.sim.evo.ModeChangeCycles = 150;
    w.sim.evo.energydif = 300.0;
    w.sim.evo.energydif2 = 7.0;
    HidePredStep(w.sim, true);
    // energydif2 += 300/150 = 9; energydifX = 300/150 = 2; energydif = 0.
    CHECK(w.sim.evo.energydif2 == 9.0);
    CHECK(w.sim.evo.energydifX == 2.0);
    CHECK(w.sim.evo.energydif == 0.0);
    CHECK(w.sim.evo.hidepred == true);
    // hidePredOffset = CInt(120/3 * 0.5) = 20; MCC = 0. 1 rndy exacto.
    CHECK(w.sim.evo.hidePredOffset == 20);
    CHECK(w.sim.evo.ModeChangeCycles == 0);
    CHECK(w.rng.consumed() == 1);
  }

  SUBCASE("cruce con hidepred = True: holdXP/XP2 y el clamp 0.1") {
    w.rng = InjectedRnd{std::vector<vb_single>{0.25f}};
    w.sim.evo.hidepred = true;
    w.sim.evo.ModeChangeCycles = 200;
    w.sim.evo.energydif = 400.0;    // energydif/MCC = 2
    w.sim.evo.energydif2 = 10.0;    // -> 12
    w.sim.evo.energydifX = 52.0;
    w.sim.evo.energydifXP = 100.0;  // holdXP = (52-2)/10 = 5 < 100
    w.sim.evo.energydifX2 = 62.0;   // XP2 = (62-12)/10 = 5 > 0 -> 0
    HidePredStep(w.sim, true);
    // holdXP = 5 < energydifXP -> energydifXP = 5. XP2 = 0; luego el clamp
    // (5 - 0) > 0.1 -> XP2 = 5 - 0.1 = 4.9. X2 = 12, energydif2 = 0.
    CHECK(w.sim.evo.energydifXP == 5.0);
    CHECK(w.sim.evo.energydifXP2 == 4.9);
    CHECK(w.sim.evo.energydifX2 == 12.0);
    CHECK(w.sim.evo.energydif2 == 0.0);
    CHECK(w.sim.evo.energydifX == 2.0);
    CHECK(w.sim.evo.hidepred == false);  // toggle
    CHECK(w.rng.consumed() == 1);
  }

  SUBCASE("cruce con hidepred = True: holdXP >= XP usa la media 9:1") {
    w.rng = InjectedRnd{std::vector<vb_single>{0.25f}};
    w.sim.evo.hidepred = true;
    w.sim.evo.ModeChangeCycles = 200;
    w.sim.evo.energydif = 400.0;   // /200 = 2
    w.sim.evo.energydifX = 102.0;  // holdXP = (102-2)/10 = 10
    w.sim.evo.energydifXP = 4.0;   // 10 < 4 es falso -> media (4*9+10)/10
    w.sim.evo.energydifX2 = 0.0;   // XP2 = (0-2)/10 = -0.2 (queda)
    HidePredStep(w.sim, true);
    CHECK(w.sim.evo.energydifXP == doctest::Approx((4.0 * 9 + 10.0) / 10));
    // clamp: 4.6 - (-0.2) > 0.1 -> XP2 = 4.6 - 0.1.
    CHECK(w.sim.evo.energydifXP2 == doctest::Approx(4.5));
    CHECK(w.rng.consumed() == 1);
  }

  SUBCASE("GoTo Mode: LFOR = 150 con Mutate < Base y hidepred estanca") {
    w.sim.LFOR = 150.0f;
    w.sim.evo.hidepred = true;
    w.spawn(kDnaIdle, "Base.txt", 5000, 5000);  // Base 2 > Mutate 1
    w.sim.evo.ModeChangeCycles = 450;
    HidePredStep(w.sim, true);
    // 450 -> 350 -> 250 -> 150 -> 50 <= 100: sin toggle, 0 RNG.
    CHECK(w.sim.evo.ModeChangeCycles == 50);
    CHECK(w.sim.evo.hidepred == true);
    CHECK(w.rng.consumed() == 0);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-05 paso 3: shots ofensivos borrados y chasers reposicionados") {
  World w;
  w.sim.x_restartmode = 5;  // el par del modo 4
  w.sim.hidePredCycl = 120;
  w.sim.evo.hidePredOffset = 0;
  w.sim.evo.hidepred = true;
  w.sim.evo.ModeChangeCycles = 150;
  w.sim.LFOR = 10.0f;
  w.rng = InjectedRnd{std::vector<vb_single>{0.0f}};

  const int base = w.spawn(kDnaIdle, "Base.txt", 10000, 10000);
  const int mut = w.spawn(kDnaIdle, "Mutate.txt", 10000 + 300, 10000);

  // Shots: uno ofensivo (-1), uno de body (-6) y uno de nrg positivo (205).
  w.sim.Shots.assign(4, Shot{});
  w.sim.maxshotarray = 3;
  w.sim.Shots[1].exist = true;
  w.sim.Shots[1].shottype = -1;
  w.sim.Shots[1].flash = true;
  w.sim.Shots[2].exist = true;
  w.sim.Shots[2].shottype = -6;
  w.sim.Shots[3].exist = true;
  w.sim.Shots[3].shottype = 205;

  // Distancia de enganche esperada (Master.bas:144-157), con la aritmetica
  // del fuente: ambos body = 1000 -> rama else (body iguales usa rob(i)).
  const vb_single ing0 =
      static_cast<vb_single>(std::log(1000.0) * 60 + 41);
  const vb_single ingdist = w.sim.rob[base].radius + w.sim.rob[mut].radius +
                            ing0 + 40.0f;
  REQUIRE(300.0f < ingdist);  // el Mutate esta "enganchado"

  HidePredStep(w.sim, true);

  CHECK(w.sim.Shots[1].exist == false);
  CHECK(w.sim.Shots[1].flash == false);
  CHECK(w.sim.Shots[2].exist == false);
  CHECK(w.sim.Shots[3].exist == true);  // los shots de memoria sobreviven

  // El Base no se mueve; el Mutate quedo alejado al menos a ingdist.
  CHECK(w.sim.rob[base].pos.x == 10000.0f);
  const vb_single dx = w.sim.rob[base].pos.x - w.sim.rob[mut].pos.x;
  const vb_single dy = w.sim.rob[base].pos.y - w.sim.rob[mut].pos.y;
  CHECK(std::sqrt(static_cast<double>(dx) * dx +
                  static_cast<double>(dy) * dy) >=
        static_cast<double>(ingdist) - 0.5);
  // El desplazamiento fue sobre el eje x (posdif apunta en -x).
  CHECK(w.sim.rob[mut].pos.y == 10000.0f);
  CHECK(w.sim.rob[mut].pos.x > 10000.0f);

  CHECK(w.sim.evo.hidepred == false);  // toggle tras reposicionar
  CHECK(w.rng.consumed() == 1);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-06 pasos 8/9/22: handicap y avrnrg") {
  World w;
  w.sim.evo.energydifXP = 10.0;
  w.sim.evo.energydifXP2 = 4.0;  // handicap exacto = 6
  w.sim.hidePredCycl = 1;        // TotRunCycle 8 >= 8: sin rampa
  w.sim.opts.TotRunCycle = 8;

  const int fresh = w.spawn(kDnaIdle, "Mutate.txt", 1000, 1000);
  const int stale = w.spawn(kDnaIdle, "Mutate.txt", 2000, 2000);
  const int other = w.spawn(kDnaIdle, "Animal.txt", 3000, 3000);
  w.sim.rob[fresh].LastMut = 3;
  w.sim.rob[stale].LastMut = 0;

  SUBCASE("paso 8: gateado por hidepred BOT A BOT, no por usehidepred") {
    // x_restartmode = 0 pero hidepred = true (p. ej. sim cargada): el
    // handicap SE INYECTA igual (Master.bas:302-313 corre siempre).
    w.sim.x_restartmode = 0;
    w.sim.evo.hidepred = true;
    HandicapStep(w.sim);
    CHECK(w.sim.rob[fresh].nrg == 20006.0f);  // + handicap completo
    CHECK(w.sim.rob[stale].nrg == 20003.0f);  // + handicap/2
    CHECK(w.sim.rob[other].nrg == 20000.0f);  // solo Mutate.txt

    w.sim.evo.hidepred = false;
    HandicapStep(w.sim);
    CHECK(w.sim.rob[fresh].nrg == 20006.0f);  // sin hidepred, nada
  }

  SUBCASE("pasos 9/22: media de los Mutate frescos y energydif") {
    w.sim.rob[fresh].nrg = 100.0f;
    const double start = AvrnrgStartStep(w.sim);
    CHECK(start == 100.0);  // solo LastMut > 0 entra en la media
    w.sim.rob[fresh].nrg = 250.0f;
    w.sim.evo.energydif = 5.0;
    AvrnrgEndStep(w.sim, start);
    CHECK(w.sim.evo.energydif == 5.0 - 100.0 + 250.0);
  }

  SUBCASE("paso 22 sin muestras: energydif intacto") {
    w.sim.rob[fresh].LastMut = 0;
    w.sim.evo.energydif = 7.0;
    AvrnrgEndStep(w.sim, 123.0);
    CHECK(w.sim.evo.energydif == 7.0);
  }
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-07 guardas hidepred: el Base oculto queda congelado") {
  World w;
  // Escribe la celda genetica 971 (nadie la consume durante el tick).
  const char* dnaWriter = "start 5 971 store stop";
  const int base = w.spawn(dnaWriter, "Base.txt", 5000, 5000);
  const int anim = w.spawn(dnaWriter, "Animal.txt", 20000, 20000);
  w.sim.evo.hidepred = true;

  UpdateSim(w.sim);

  // El ADN del Base oculto NO corre; el del resto si.
  CHECK(w.sim.rob[base].mem[971] == 0);
  CHECK(w.sim.rob[anim].mem[971] == 5);
  // No envejece ni entra en los contadores del ciclo (P2/P5).
  CHECK(w.sim.rob[base].age == 0);
  CHECK(w.sim.rob[anim].age == 1);
  CHECK(w.sim.totnvegs == 1);  // el Base no cuenta
  // opos (paso 15) no se actualiza para el Base.
  CHECK(w.sim.rob[base].opos.x == 0.0f);
  CHECK(w.sim.rob[anim].opos.x == 20000.0f);

  // Vision: CompareRobots3 sale de una si el objetivo es el Base oculto.
  w.sim.rob[anim].pos = {5400.0f, 5000.0f};  // pegado al Base
  EraseSenses(w.sim, anim);
  CompareRobots3(w.sim, anim, base);
  vb_integer eyesum = 0;
  for (int e = addr::EyeStart + 1; e <= addr::EyeEnd; ++e)
    eyesum = static_cast<vb_integer>(eyesum + w.sim.rob[anim].mem[e]);
  CHECK(eyesum == 0);

  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-08 paso 26: modo 1 (seeding) y modo 9 (test)") {
  World w;

  SUBCASE("modo 1: evento unico en el ciclo 2000") {
    w.sim.x_restartmode = 1;
    w.sim.opts.TotRunCycle = 1999;
    RestartModesStep(w.sim);
    CHECK(w.sim.events.seed_round_done == false);
    w.sim.opts.TotRunCycle = 2000;
    RestartModesStep(w.sim);
    CHECK(w.sim.events.seed_round_done == true);
  }

  SUBCASE("modo 9: totnrgnvegs es Static y ACUMULA; pass/fail en 8000") {
    w.sim.x_restartmode = 9;
    const int t1 = w.spawn(kDnaIdle, "Test.txt", 1000, 1000);
    w.spawn(kDnaIdle, "Other.txt", 2000, 2000);  // no cuenta
    w.sim.rob[t1].nrg = 100.0f;
    w.sim.rob[t1].body = 10.0f;  // 100 + 100 = 200

    w.sim.opts.TotRunCycle = 1;
    RestartModesStep(w.sim);
    CHECK(w.sim.totnrgnvegs == 200.0);
    RestartModesStep(w.sim);  // el Static acumula si el ciclo 1 se repite
    CHECK(w.sim.totnrgnvegs == 400.0);

    w.sim.opts.TotRunCycle = 8000;
    SUBCASE("fail: energia no duplicada o poblacion <= 10") {
      w.sim.totnvegsDisplayed = 50;
      w.sim.rob[t1].nrg = 700.0f;  // 700+100 = 800 <= 400*2
      RestartModesStep(w.sim);
      CHECK(w.sim.events.zb_failed);
      CHECK(w.sim.events.zb_passed == false);
      CHECK(w.sim.events.sim_stop_requested);
    }
    SUBCASE("pass: poblacion > 10 y energia x2") {
      w.sim.totnvegsDisplayed = 11;
      w.sim.rob[t1].nrg = 750.0f;  // 750+100 = 850 > 800
      RestartModesStep(w.sim);
      CHECK(w.sim.events.zb_passed);
      CHECK(w.sim.events.zb_failed == false);
    }
  }
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-09 paso 26 modos 7/8: fittest + calculateZB + restart") {
  World w;
  w.sim.x_restartmode = 7;

  SUBCASE("fittest: energia invertida propia + descendencia") {
    // intFindBestV2 = 100 (default): sPopulation = 1, sEnergy = 1 ->
    // s = TotalOffspring * (score + nrg + body*10).
    const int rich = w.spawn(kDnaIdle, "Mutate.txt", 1000, 1000);
    const int parent = w.spawn(kDnaIdle, "Mutate.txt", 2000, 2000);
    const int child = w.spawn(kDnaIdle, "Mutate.txt", 3000, 3000);
    w.sim.rob[rich].nrg = 25000.0f;   // s = 1*(25000+10000) = 35000
    w.sim.rob[parent].nrg = 10000.0f;
    w.sim.rob[child].nrg = 10000.0f;
    w.sim.rob[child].parent = w.sim.rob[parent].AbsNum;
    // parent: s = 2 * ((10000+10000) + (10000+10000)) = 80000 -> gana
    w.sim.rob[parent].LastMut = 1;  // para que calculateZB corra
    const int fit = Fittest(w.sim);
    CHECK(fit == parent);
    CHECK(w.sim.robfocus == parent);        // ZB mueve el foco
    CHECK(w.sim.zb_oldid == w.sim.rob[parent].AbsNum);
    CHECK(w.sim.events.zb_reset == true);   // primera llamada: oldid era 0
  }

  SUBCASE("fittest ignora familias cancer en modo ZB") {
    const int a = w.spawn(kDnaIdle, "Mutate.txt", 1000, 1000);
    const int b = w.spawn(kDnaIdle, "Mutate.txt", 2000, 2000);
    const int c = w.spawn(kDnaIdle, "Mutate.txt", 3000, 3000);
    w.sim.rob[a].nrg = 100.0f;
    w.sim.rob[a].body = 10.0f;   // s propio 200
    w.sim.rob[b].nrg = 30000.0f;
    w.sim.rob[c].parent = w.sim.rob[b].AbsNum;
    w.sim.rob[c].nrg = 10.0f;
    w.sim.rob[c].body = 1.0f;    // hijo con < 1000: Cancer -> s = 0
    CHECK(Fittest(w.sim) == a);
  }

  SUBCASE("calculateZB: goodtest x1.15, ready x1.75, reset sin mutacion") {
    const int m = w.spawn(kDnaIdle, "Mutate.txt", 1000, 1000);
    Bot& b = w.sim.rob[m];
    b.LastMut = 1;
    b.Mutables.mutarray[mut::PointUP] = 1000.0f;
    b.Mutables.mutarray[mut::P2UP] = 2000.0f;

    // 1a llamada: oldid = 0 -> solo reset + statics.
    calculateZB(w.sim, 7, 50.0, m);
    CHECK(w.sim.events.zb_reset);
    CHECK(b.Mutables.mutarray[mut::PointUP] == 1000.0f);
    CHECK(w.sim.zb_oldid == 7);
    CHECK(w.sim.zb_oldMx == 50.0);

    // 2a: otro id -> goodtest (x1.15) y, como oldid != robid, no ready.
    w.sim.events.zb_reset = false;
    calculateZB(w.sim, 9, 40.0, m);
    CHECK(w.sim.events.zb_goodtest);
    CHECK(b.Mutables.mutarray[mut::PointUP] == 1150.0f);
    CHECK(b.Mutables.mutarray[mut::P2UP] == 2300.0f);
    CHECK(w.sim.events.zb_ready_for_test == false);
    CHECK(w.sim.events.zb_reset == false);  // goodtest suprime el reset

    // 3a: mismo id y Mx mayor -> x1.75 + ready.
    calculateZB(w.sim, 9, 60.0, m);
    CHECK(w.sim.events.zb_ready_for_test);
    CHECK(b.Mutables.mutarray[mut::PointUP] == doctest::Approx(2012.5f));

    // Con NormMut el tope es DnaLen * valMaxNormMut ("start stop":
    // DnaLen = 3 -> tope 300).
    w.sim.NormMut = true;
    w.sim.valMaxNormMut = 100;
    b.Mutables.mutarray[mut::PointUP] = 190.0f;
    calculateZB(w.sim, 9, 100.0, m);
    CHECK(b.Mutables.mutarray[mut::PointUP] == 300.0f);  // 332.5 -> tope

    // LastMut = 0: solo reset.
    w.sim.events.zb_reset = false;
    b.LastMut = 0;
    calculateZB(w.sim, 11, 1.0, m);
    CHECK(w.sim.events.zb_reset);
    CHECK(w.sim.zb_oldid == 9);  // los statics NO se tocan
  }

  SUBCASE("Mutate_count = 0 -> zb_restart") {
    w.spawn(kDnaIdle, "Base.txt", 1000, 1000);
    w.sim.opts.TotRunCycle = 7;  // Mod 50 <> 0: sin fittest
    RestartModesStep(w.sim);
    CHECK(w.sim.events.zb_restart);
    CHECK(w.sim.events.sim_stop_requested);
  }
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-10 dreason/Disqualify: descalificacion de especie") {
  World w;
  const int a = w.spawn(kDnaIdle, "Cheater.txt", 1000, 1000);
  const int a2 = w.spawn(kDnaIdle, "Cheater.txt", 2000, 2000);
  const int c = w.spawn(kDnaIdle, "Clean.txt", 3000, 3000);

  SUBCASE("dreason mata a toda la especie y formatea la linea") {
    dreason(w.sim, "Cheater.txt", w.sim.rob[a].tag, "making shell");
    CHECK(w.sim.rob[a].exist == false);
    CHECK(w.sim.rob[a2].exist == false);
    CHECK(w.sim.rob[c].exist == true);
    REQUIRE(w.sim.events.dq_log.size() == 1);
    // tag jamas asignado (Chr(0) x 50): se omite.
    CHECK(w.sim.events.dq_log[0] ==
          "Robot \"Cheater.txt\" has been disqualified for making shell.");
  }

  SUBCASE("tag asignado por la UI: '(tag)' con relleno de espacios") {
    std::string tag = "champ";
    tag.resize(50, ' ');  // como la asignacion a String * 50
    dreason(w.sim, "Cheater.txt", tag, "using a virus");
    CHECK(w.sim.events.dq_log[0] ==
          "Robot \"Cheater.txt\"(champ) has been disqualified for using a "
          "virus.");
    // Quirk: tag asignado VACIO (50 espacios) produce "()".
    dreason(w.sim, "Clean.txt", std::string(50, ' '), "making slime");
    CHECK(w.sim.events.dq_log[1] ==
          "Robot \"Clean.txt\"() has been disqualified for making slime.");
  }

  SUBCASE("makeshell dispara el epilogo bajo F1 + Disqualify 2") {
    w.sim.opts.F1 = true;
    w.sim.Disqualify = 2;
    w.sim.rob[a].mem[822] = 100;  // .mkshell
    makeshell(w.sim, a);
    CHECK(w.sim.rob[a].exist == false);   // especie descalificada
    CHECK(w.sim.rob[a2].exist == false);
    CHECK(w.sim.events.dq_log.size() == 1);
  }

  SUBCASE("epilogo en getout: tambien con nrg <= 0 (GoTo, no Exit Sub)") {
    w.sim.opts.F1 = true;
    w.sim.Disqualify = 2;
    w.sim.rob[a].nrg = 0.0f;
    makeshell(w.sim, a);  // el cuerpo no corre, el epilogo si
    CHECK(w.sim.events.dq_log.size() == 1);
  }

  SUBCASE("dq = 1 fuera de F1: safe kill sin dreason") {
    w.sim.opts.F1 = false;
    w.sim.Disqualify = 2;
    w.sim.rob[a].dq = 1;
    w.sim.rob[a].mem[822] = 100;
    makeshell(w.sim, a);
    CHECK(w.sim.rob[a].Dead == true);
    CHECK(w.sim.rob[a2].exist == true);  // sin descalificacion de especie
    CHECK(w.sim.events.dq_log.empty());
  }

  SUBCASE("Disqualify = 0 (default): nada de nada") {
    w.sim.opts.F1 = true;
    w.sim.rob[a].mem[822] = 100;
    makeshell(w.sim, a);
    CHECK(w.sim.rob[a].exist == true);
    CHECK(w.sim.events.dq_log.empty());
  }
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-11 F1: FindSpecies y las rondas de Countpop") {
  World w;
  w.sim.f1.ContestMode = true;
  w.sim.f1.MinRounds = 2;
  w.sim.f1.optMinRounds = 2;

  SUBCASE("FindSpecies: censo por realname (sin .txt)") {
    w.spawn(kDnaIdle, "Alpha.txt", 1000, 1000);
    w.spawn(kDnaIdle, "Alpha.txt", 2000, 2000);
    w.spawn(kDnaIdle, "Beta.txt", 3000, 3000);
    FindSpecies(w.sim);
    CHECK(w.sim.f1.TotSpecies == 2);
    CHECK(w.sim.f1.PopArray[1].SpName == "Alpha");
    CHECK(w.sim.f1.PopArray[1].population == 2);
    CHECK(w.sim.f1.PopArray[2].SpName == "Beta");
    CHECK(w.sim.f1.optMaxCycles == 0);  // MaxCycles = 0
  }

  SUBCASE("FindSpecies: una sola especie desactiva el contest") {
    w.spawn(kDnaIdle, "Alpha.txt", 1000, 1000);
    FindSpecies(w.sim);
    CHECK(w.sim.f1.ContestMode == false);
    CHECK(w.sim.events.f1_single_species);
  }

  SUBCASE("FindSpecies: > 2 especies con limites los desactiva") {
    w.spawn(kDnaIdle, "A.txt", 1000, 1000);
    w.spawn(kDnaIdle, "B.txt", 2000, 2000);
    w.spawn(kDnaIdle, "C.txt", 3000, 3000);
    w.sim.f1.MaxCycles = 5000;
    w.sim.f1.MaxPop = 50;
    FindSpecies(w.sim);
    CHECK(w.sim.f1.optMaxCycles == 0);
    CHECK(w.sim.f1.MaxPop == 0);
    CHECK(w.sim.events.f1_limits_disabled);
  }

  SUBCASE("Countpop: victoria de ronda, extension por empate y ganador") {
    w.spawn(kDnaIdle, "Alpha.txt", 1000, 1000);
    const int b1 = w.spawn(kDnaIdle, "Beta.txt", 3000, 3000);
    FindSpecies(w.sim);
    REQUIRE(w.sim.f1.TotSpecies == 2);

    // Beta muere: SpeciesLeft = 1, Contests+1 (1) <= MinRounds (2):
    // Alpha suma 1 win y arranca otra ronda.
    w.sim.rob[b1].exist = false;
    w.sim.opts.TotRunCycle = 500;
    Countpop(w.sim);
    CHECK(w.sim.f1.PopArray[1].Wins == 1);
    CHECK(w.sim.f1.Contests == 1);
    CHECK(w.sim.StartAnotherRound == true);
    CHECK(w.sim.opts.TotRunCycle == 0);  // reset de ronda
    CHECK(w.sim.f1.Over == false);

    // Ultima ronda (Contests+1 = MinRounds): Wins = Sqr(2)+1 = 2.41;
    // Alpha con 2 wins NO supera -> "Statistical Draw", MinRounds 3 y
    // OTRA ronda.
    w.sim.StartAnotherRound = false;
    Countpop(w.sim);  // el increment natural deja Wins = 2 < 2.414
    CHECK(w.sim.f1.MinRounds == 3);
    CHECK(w.sim.f1.Contests == 2);
    CHECK(w.sim.StartAnotherRound == true);
    CHECK(w.sim.events.f1_round_over == false);

    // Ronda final real: 4 wins > Sqr(3)+1.5 = 3.23 -> ganador.
    w.sim.f1.PopArray[1].Wins = 4;
    w.sim.f1.Contests = 2;  // Contests+1 = 3 = MinRounds
    Countpop(w.sim);
    CHECK(w.sim.f1.Over == true);
    CHECK(w.sim.events.f1_round_over == true);
    CHECK(w.sim.events.f1_winner == "Alpha");
    CHECK(w.sim.events.sim_stop_requested);
    CHECK(w.sim.f1.MinRounds == w.sim.f1.optMinRounds);  // Case 0
  }

  SUBCASE("Countpop: Maxrounds gana por la via del GoTo won") {
    w.spawn(kDnaIdle, "Alpha.txt", 1000, 1000);
    w.spawn(kDnaIdle, "Beta.txt", 3000, 3000);
    FindSpecies(w.sim);
    w.sim.f1.Maxrounds = 3;
    w.sim.f1.PopArray[2].Wins = 3;  // > Maxrounds - 1
    Countpop(w.sim);
    CHECK(w.sim.f1.Over == true);
    CHECK(w.sim.events.f1_winner == "Beta");
  }

  SUBCASE("Countpop: ambos muertos -> otra ronda sin ganador") {
    w.spawn(kDnaIdle, "Alpha.txt", 1000, 1000);
    w.spawn(kDnaIdle, "Beta.txt", 3000, 3000);
    FindSpecies(w.sim);
    w.sim.rob[1].exist = false;
    w.sim.rob[2].exist = false;
    Countpop(w.sim);
    CHECK(w.sim.StartAnotherRound == true);
    CHECK(w.sim.f1.Over == false);
  }
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-12 F1: MaxPop mata a los mas pobres (con el patron B-02)") {
  World w;
  w.sim.f1.ContestMode = true;
  // 4 Alpha (nrg escalonada) vs 1 Beta; MaxPop = 2.
  const int a1 = w.spawn(kDnaIdle, "Alpha.txt", 1000, 1000);
  const int a2 = w.spawn(kDnaIdle, "Alpha.txt", 2000, 2000);
  const int a3 = w.spawn(kDnaIdle, "Alpha.txt", 3000, 3000);
  const int a4 = w.spawn(kDnaIdle, "Alpha.txt", 4000, 4000);
  const int b1 = w.spawn(kDnaIdle, "Beta.txt", 5000, 5000);
  FindSpecies(w.sim);
  w.sim.f1.MaxPop = 2;
  w.sim.f1.MinRounds = 30000;  // lejos del cierre de ronda
  w.sim.rob[a1].nrg = 100.0f;
  w.sim.rob[a2].nrg = 200.0f;
  w.sim.rob[a3].nrg = 300.0f;
  w.sim.rob[a4].nrg = 400.0f;

  // erase1 = 2 - 4 = -2; erase2 = CInt(-2 * 1/4) = CInt(-0.5) = 0 (bancario).
  // Bucle 1: l = 0..2 -> 3 kills en Alpha (los 3 mas pobres).
  // Bucle 2: l = 0..0 -> 1 "kill" mas: sin candidato bajo 320000 en Beta?
  // Si hay (b1, nrg 20000+10000 = 30000 < 320000) -> Beta pierde su unico
  // bot. Igual que el original.
  Countpop(w.sim);
  CHECK(w.sim.rob[a1].exist == false);
  CHECK(w.sim.rob[a2].exist == false);
  CHECK(w.sim.rob[a3].exist == false);
  CHECK(w.sim.rob[a4].exist == true);
  CHECK(w.sim.rob[b1].exist == false);  // victima del For 0 To 0 con erase2=0
  CHECK(w.rng.consumed() == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-13 Restart: sin heterotrofos arranca otra ronda") {
  World w;
  w.sim.opts.Restart = true;
  const int v = w.spawn(kDnaIdle, "Alga.txt", 1000, 1000);
  w.sim.rob[v].Veg = true;
  w.sim.rob[v].chloroplasts = 16000.0f;

  UpdateBots(w.sim);
  CHECK(w.sim.StartAnotherRound == true);
  CHECK(w.sim.f1.ReStarts == 1);

  // Con F1 los restarts los maneja Countpop: la via directa no corre.
  w.sim.StartAnotherRound = false;
  w.sim.opts.F1 = true;
  UpdateBots(w.sim);
  CHECK(w.sim.StartAnotherRound == false);
  CHECK(w.sim.f1.ReStarts == 1);
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-14 paso 13: Player Bot Mode") {
  World w;
  const int foco = w.spawn(kDnaIdle, "Animal.txt", 1000.0f, 1000.0f);
  const int resaltado = w.spawn(kDnaIdle, "Animal.txt", 2000.0f, 2000.0f);
  const int libre = w.spawn(kDnaIdle, "Animal.txt", 3000.0f, 3000.0f);
  w.sim.rob[resaltado].highlight = true;
  w.sim.robfocus = static_cast<vb_integer>(foco);

  SUBCASE("apagado: no toca nada") {
    w.sim.pb.Mouse_loc = {500.0f, 500.0f};
    PlayerBotStep(w.sim);
    CHECK(w.sim.rob[foco].mem[addr::SetAim] == 0);
  }

  SUBCASE("mem(SetAim) = angnorm(angle)*200 para foco y resaltados") {
    w.sim.pb.on = true;
    w.sim.pb.Mouse_loc = {1000.0f, 2000.0f};  // debajo del foco
    PlayerBotStep(w.sim);
    const vb_integer esperado_foco = static_cast<vb_integer>(vb_round64(
        static_cast<double>(angnorm(vb_angle(1000.0f, 1000.0f, 1000.0f,
                                             2000.0f)) *
                            200.0f)));
    CHECK(w.sim.rob[foco].mem[addr::SetAim] == esperado_foco);
    CHECK(w.sim.rob[resaltado].mem[addr::SetAim] != 0);
    CHECK(w.sim.rob[libre].mem[addr::SetAim] == 0);
  }

  SUBCASE("raton en (0,0): sin overwrite de aim; teclas Active<>Invert") {
    w.sim.pb.on = true;
    w.sim.pb.Mouse_loc = {0.0f, 0.0f};
    w.sim.pb.keys.push_back({addr::shoot, -1, true, false});   // activa
    w.sim.pb.keys.push_back({addr::dirup, 40, false, false});  // inactiva
    w.sim.pb.keys.push_back({addr::dirdn, 40, true, true});    // invertida
    w.sim.pb.keys.push_back({addr::dirsx, 30, false, true});   // Invert sin
                                                               // tecla: corre
    PlayerBotStep(w.sim);
    CHECK(w.sim.rob[foco].mem[addr::SetAim] == 0);
    CHECK(w.sim.rob[foco].mem[addr::shoot] == -1);
    CHECK(w.sim.rob[foco].mem[addr::dirup] == 0);
    CHECK(w.sim.rob[foco].mem[addr::dirdn] == 0);
    CHECK(w.sim.rob[foco].mem[addr::dirsx] == 30);
    CHECK(w.sim.rob[libre].mem[addr::shoot] == 0);
  }

  SUBCASE("memloc fuera de mem(0..1000): sitio de error 9 registrado") {
    w.sim.pb.on = true;
    w.sim.pb.keys.push_back({1001, 5, true, false});
    PlayerBotStep(w.sim);
    CHECK(w.sim.diag.err9_pb_memloc == 2);  // foco + resaltado
  }

  SUBCASE("KillRobot con foco: el foco pasa al ULTIMO resaltado") {
    w.sim.pb.on = true;
    w.sim.rob[libre].highlight = true;  // dos resaltados: 2 y 3
    KillRobot(w.sim, foco);
    CHECK(w.sim.robfocus == libre);  // el bucle no corta: gana el ultimo
  }

  SUBCASE("Reproduce hereda el highlight bajo pbOn") {
    // Reproduce consume 2 rndy SIEMPRE: la loteria vegetal (el And de VB6
    // no cortocircuita, RV-21) y el tope del For de mutación de parto,
    // Int(3*rndy), que se extrae aunque mrepro sea 0.
    w.rng = InjectedRnd{std::vector<vb_single>{0.5f, 0.0f}};
    w.sim.pb.on = true;
    w.sim.rob[resaltado].nrg = 20000.0f;
    Reproduce(w.sim, resaltado, 50);
    int hijo = 0;
    for (int t = 1; t <= w.sim.MaxRobs; ++t)
      if (t != foco && t != resaltado && t != libre && w.sim.rob[t].exist)
        hijo = t;
    REQUIRE(hijo != 0);
    CHECK(w.sim.rob[hijo].highlight == true);
    CHECK(w.rng.consumed() == 2);
  }
}

// ---------------------------------------------------------------------------
// Los cinco hallazgos de la revision de la rama e5-modos-de-juego.
TEST_CASE("E5-16 revision: sitios que la primera pasada de E5 dejo fuera") {
  World w;

  SUBCASE("info shot: Disqualify = 2 descalifica (Robots.bas:1791)") {
    const int a = w.spawn(kDnaIdle, "Cheater.txt", 1000, 1000);
    const int a2 = w.spawn(kDnaIdle, "Cheater.txt", 2000, 2000);
    const int c = w.spawn(kDnaIdle, "Clean.txt", 3000, 3000);
    // newshot de memoria puede extraer RNG: secuencia holgada.
    w.rng = InjectedRnd{std::vector<vb_single>(8, 0.5f)};
    w.sim.opts.F1 = true;
    w.sim.Disqualify = 2;
    w.sim.rob[a].mem[addr::shoot] = 5;      // shtype >= 0: shot de memoria
    w.sim.rob[a].mem[addr::shootval] = 10;
    robshoot(w.sim, a);
    CHECK(w.sim.rob[a].exist == false);   // especie descalificada entera
    CHECK(w.sim.rob[a2].exist == false);
    CHECK(w.sim.rob[c].exist == true);
    REQUIRE(w.sim.events.dq_log.size() == 1);
    CHECK(w.sim.events.dq_log[0].find("firing an info shot") !=
          std::string::npos);
  }

  SUBCASE("KillRobot sin sucesor apaga robfocus (Robots.bas:3011)") {
    const int foco = w.spawn(kDnaIdle, "Animal.txt", 1000, 1000);
    const int otro = w.spawn(kDnaIdle, "Animal.txt", 2000, 2000);
    w.sim.pb.on = true;
    w.sim.robfocus = static_cast<vb_integer>(foco);
    CHECK(w.sim.rob[otro].highlight == false);  // no hay resaltado vivo
    KillRobot(w.sim, foco);
    CHECK(w.sim.robfocus == 0);  // sin esto, el slot reciclado heredaria
                                 // los overwrites del paso 13
    // Con sucesor resaltado el traspaso gana y NO se apaga.
    const int f2 = w.spawn(kDnaIdle, "Animal.txt", 3000, 3000);
    w.sim.rob[otro].highlight = true;
    w.sim.robfocus = static_cast<vb_integer>(f2);
    KillRobot(w.sim, f2);
    CHECK(w.sim.robfocus == otro);
  }

  SUBCASE("ZBreadyforTest apaga la sim (Evo.bas:610-618)") {
    w.sim.x_restartmode = 7;
    const int m = w.spawn(kDnaIdle, "Mutate.txt", 1000, 1000);
    w.sim.rob[m].LastMut = 1;
    calculateZB(w.sim, 5, 10.0, m);   // 1a: fija los statics
    w.sim.events = GameEvents{};
    calculateZB(w.sim, 5, 20.0, m);   // mismo id, Mx mayor -> ready
    CHECK(w.sim.events.zb_ready_for_test);
    CHECK(w.sim.events.sim_stop_requested);
  }

  SUBCASE("LFOR = 0: sitio de error 11 registrado, sin NaN") {
    w.rng = InjectedRnd{std::vector<vb_single>{0.5f}};
    w.sim.x_restartmode = 4;
    w.sim.hidePredCycl = 0;        // umbral 0: el While entra en el tick 1
    w.sim.LFOR = 0.0f;             // default: solo el gset de evo lo puebla
    w.sim.evo.hidepred = true;
    w.sim.evo.ModeChangeCycles = 1;
    w.sim.evo.energydifX = 50.0;
    w.sim.evo.energydifXP = 3.0;
    w.spawn(kDnaIdle, "Base.txt", 1000, 1000);
    const int m = w.spawn(kDnaIdle, "Mutate.txt", 20000, 20000);
    w.sim.rob[m].LastMut = 1;

    HidePredStep(w.sim, true);

    CHECK(w.sim.diag.err11_lfor_zero == 1);
    CHECK(w.sim.evo.energydifXP == 3.0);   // el bloque no corrio
    CHECK(w.sim.evo.energydifXP2 == 0.0);
    CHECK(!std::isnan(w.sim.evo.energydifXP));
    CHECK(w.sim.evo.hidepred == false);    // el resto del paso 3 SI corre
    // ...y sin NaN el handicap del paso 8 sigue siendo un numero.
    w.sim.evo.hidepred = true;
    HandicapStep(w.sim);
    CHECK(!std::isnan(w.sim.rob[m].nrg));
  }

  SUBCASE("clist vive por INVOCACION: el 2o organismo arrastra al 1o") {
    // maketie extrae 1 rndy por llamada; el toggle de hidepred, 1 mas.
    w.rng = InjectedRnd{std::vector<vb_single>(8, 0.5f)};
    w.sim.x_restartmode = 4;
    w.sim.hidePredCycl = 120;      // umbral 100
    w.sim.evo.hidePredOffset = 0;
    w.sim.evo.hidepred = true;
    w.sim.evo.ModeChangeCycles = 150;
    w.sim.LFOR = 10.0f;

    const int base = w.spawn(kDnaIdle, "Base.txt", 10000, 10000);
    // Organismo A: enganchado por el eje X (se desplazara en +x).
    // Los "partner" quedan atados (maketie exige Length <= c*1.5) pero
    // FUERA de la distancia de enganche (~724 con body 1000): solo entran
    // al reposicionado arrastrados por su organismo.
    const int aLead = w.spawn(kDnaIdle, "Mutate.txt", 10300, 10000);
    const int aPart = w.spawn(kDnaIdle, "Mutate.txt", 10300, 11500);
    // Organismo B: enganchado por el eje Y (se desplazara en +y).
    const int bLead = w.spawn(kDnaIdle, "Mutate.txt", 10000, 10300);
    const int bPart = w.spawn(kDnaIdle, "Mutate.txt", 11500, 10300);
    REQUIRE(maketie(w.sim, aLead, aPart, 2000, 0, 0));
    REQUIRE(maketie(w.sim, bLead, bPart, 2000, 0, 0));
    for (int t : {aLead, aPart, bLead, bPart}) w.sim.rob[t].Multibot = true;
    (void)base;

    HidePredStep(w.sim, true);

    // A se aparta en +x (su propio pozdif)...
    CHECK(w.sim.rob[aLead].pos.x > 10300.0f);
    // ...y ADEMAS recibe el pozdif de B (+y) porque clist llego con las
    // celulas de A dentro: el While de Master.bas:174 las desplaza otra vez.
    CHECK(w.sim.rob[aLead].pos.y > 10000.0f);
    CHECK(w.sim.rob[aPart].pos.y > 11500.0f);
    // El desplazamiento parasito es EL MISMO para las dos celulas de A.
    CHECK(w.sim.rob[aLead].pos.y - 10000.0f ==
          doctest::Approx(w.sim.rob[aPart].pos.y - 11500.0f));
    // B se aparta en +y como corresponde.
    CHECK(w.sim.rob[bLead].pos.y > 10300.0f);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("E5-15 auto-forking: SpeciationForkInterval es un CONTADOR") {
  World w;
  // mutate() sale de una con DisableMutations o sin Mutables.Mutations
  // (NeoMutations.bas): para llegar al auto-fork hay que habilitar y dejar
  // los 11 operadores a 0 (cero RNG).
  w.sim.opts.DisableMutations = false;
  w.sim.opts.EnableAutoSpeciation = true;
  w.sim.opts.SpeciationGeneticDistance = 10;   // umbral = DnaLen * 0.10
  w.sim.opts.SpeciationForkInterval = 5000;    // el default del formato
  const int m = w.spawn(kDnaIdle, "Animal.txt", 1000, 1000);
  w.sim.rob[m].Mutables.Mutations = true;
  for (int i = 0; i <= 10; ++i) w.sim.rob[m].Mutables.mutarray[i] = 0.0f;
  w.sim.Specie.resize(1);
  w.sim.Specie[0].Name = "Animal.txt";
  w.sim.rob[m].Mutations = 1000;  // 1000 > 2*0.10

  mutate(w.sim, m);

  CHECK(w.sim.opts.SpeciationForkInterval == 5001);
  CHECK(w.sim.rob[m].FName == "(5001)Animal.txt");
  CHECK(w.sim.rob[m].Mutations == 0);
  CHECK(w.sim.Specie.size() == 2);  // AddSpecie

  // El nick anterior se desanuda: (5001)Animal.txt -> (5002)Animal.txt.
  w.sim.rob[m].Mutations = 1000;
  mutate(w.sim, m);
  CHECK(w.sim.rob[m].FName == "(5002)Animal.txt");

  // Con el registro lleno (>= 49) el contador se revierte.
  w.sim.Specie.resize(49);
  w.sim.rob[m].Mutations = 1000;
  mutate(w.sim, m);
  CHECK(w.sim.opts.SpeciationForkInterval == 5002);  // rollback
  CHECK(w.sim.rob[m].FName == "(5002)Animal.txt");   // sin cambio
  CHECK(w.rng.consumed() == 0);
}
