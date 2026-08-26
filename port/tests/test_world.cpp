// M8 — Mundo (B7, 50-MUNDO.md): economía vegetal. Casos dorados R-08
// (inventario de 12 extracciones de la repoblación) y B-37 (la primera
// repoblación tarda el doble), más los [unit] de feedvegs (banda solar,
// día/noche, sol variable), feedveg2 (digestión de waste) y altzheimer.
#include <cmath>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

struct World {
  Sim sim;

  explicit World(RndSource& rng) {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
    sim.opts.DisableMutations = true;  // aísla el RNG del bloque de mundo
  }

  // Registra una especie vegetal nativa con su ADN en memoria.
  std::size_t addVegSpecies(const std::string& name,
                            const std::string& dnatext = "stop") {
    Specie sp;
    sp.Name = name;
    sp.Veg = true;
    sp.Native = true;
    sp.dnatext = dnatext;
    sp.Stnrg = 3000;
    sp.population = 0;
    sim.Specie.push_back(sp);
    return sim.Specie.size() - 1;
  }

  // Bot mínimo ya posicionado (sin consumo de RNG).
  int addbot(float x, float y, float chlr = 0.0f) {
    const int n = posto(sim);
    Bot& b = sim.rob[n];
    b.exist = true;
    b.FName = "T.txt";
    b.pos = {x, y};
    b.nrg = 3000.0f;
    b.body = 1000.0f;
    b.radius = 1.0f;
    b.chloroplasts = chlr;
    b.BucketPos = {-2.0f, -2.0f};
    UpdateBotBucket(sim, n);
    return n;
  }
};

}  // namespace

// ---------------------------------------------------------------------------
TEST_CASE("R-08 repoblacion vegetal: inventario de 12 extracciones") {
  SUBCASE("una especie valida, una tirada: 12 exactas y coordenadas pisadas") {
    InjectedRnd rng(std::vector<vb_single>(12, 0.5f));
    World w(rng);
    w.addVegSpecies("Veg.txt");
    w.sim.StartChlr = 16000;
    w.sim.opts.RepopCooldown = 25;
    w.sim.opts.RepopAmount = 1;
    w.sim.cooldown = 24;  // vence en esta llamada

    VegsRepopulate(w.sim);

    CHECK(rng.consumed() == 12);
    CHECK(rng.exhausted());
    CHECK(w.sim.totvegs == 1);
    CHECK(w.sim.cooldown == 0);  // 25 - RepopCooldown

    REQUIRE(w.sim.rob[1].exist);
    const Bot& b = w.sim.rob[1];
    CHECK(b.Veg);
    CHECK(b.chloroplasts == 16000.0f);
    CHECK(b.nrg == 3000.0f);   // Stnrg de la especie (pisa el 20000)
    CHECK(b.body == 1000.0f);
    CHECK(b.generation == 0);
    CHECK(b.parent == 0);
    // Coordenadas: las del llamador (16000, extracciones 1-2) se DESCARTAN;
    // la posición real sale de fRnd(0, 31940) = CLng(15970.5) = 15970
    // (bancario: empate al par).
    CHECK(b.pos.x == 15970.0f);
    CHECK(b.pos.y == 15970.0f);
    // aim = rndy*2*PI = PI pisa el de preparerob; SetAim = CInt(PI*200).
    CHECK(b.aim == doctest::Approx(3.14159265f));
    CHECK(b.mem[addr::SetAim] == 628);
    // El timer epigenético queda en 0 (a diferencia de loadrobs).
    CHECK(b.mem[addr::timersys] == 0);
  }

  SUBCASE("re-tirada de especie: +1 extraccion") {
    // Especie 0 NO vegetal, especie 1 vegetal: Random(0,1) = 0 falla la
    // primera vez y re-sortea (13 extracciones en total).
    std::vector<vb_single> seq(13, 0.5f);
    seq[2] = 0.3f;  // primera tirada de especie -> 0 (no veg)
    seq[3] = 0.6f;  // re-tirada -> 1 (veg)
    InjectedRnd rng(seq);
    World w(rng);
    {
      Specie carn;
      carn.Name = "Carn.txt";
      carn.dnatext = "stop";
      w.sim.Specie.push_back(carn);
    }
    w.addVegSpecies("Veg.txt");
    w.sim.opts.RepopCooldown = 1;
    w.sim.opts.RepopAmount = 1;
    w.sim.cooldown = 0;

    VegsRepopulate(w.sim);

    CHECK(rng.consumed() == 13);
    CHECK(rng.exhausted());
    REQUIRE(w.sim.rob[1].exist);
    CHECK(w.sim.rob[1].FName == "Veg.txt");
  }

  SUBCASE("sin especie vegetal elegible: 3 extracciones y ningun bot") {
    // Los dos Random del llamador + nada: aggiungirob sale en el chequeo
    // anyvegy ANTES de sortear especie/posición.
    InjectedRnd rng(std::vector<vb_single>(2, 0.5f));
    World w(rng);
    {
      Specie carn;
      carn.Name = "Carn.txt";
      carn.dnatext = "stop";
      w.sim.Specie.push_back(carn);
    }
    w.sim.opts.RepopCooldown = 1;
    w.sim.opts.RepopAmount = 1;

    VegsRepopulate(w.sim);

    CHECK(rng.consumed() == 2);  // solo las coordenadas descartadas
    CHECK(w.sim.MaxRobs == 0);
    CHECK(w.sim.totvegs == 1);  // el contador cuenta el intento igualmente
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("B-37 la primera repoblacion tarda el doble (cooldown = -25)") {
  VbRng rng;
  World w(rng);
  w.addVegSpecies("Veg.txt");
  w.sim.StartChlr = 16000;
  w.sim.opts.RepopCooldown = 25;
  w.sim.opts.RepopAmount = 1;
  w.sim.opts.MinVegs = 100;  // el gate de cloroplastos queda abierto
  w.sim.cooldown = -w.sim.opts.RepopCooldown;  // main.frm:1507

  auto vegcount = [&] {
    int c = 0;
    for (int t = 1; t <= w.sim.MaxRobs; ++t)
      if (w.sim.rob[t].exist) c += 1;
    return c;
  };

  // 49 ciclos elegibles: nada (el acumulador va de -25 a 24).
  for (int i = 1; i <= 49; ++i) UpdateSim(w.sim);
  CHECK(vegcount() == 0);

  // Ciclo 50: primera tanda.
  UpdateSim(w.sim);
  CHECK(vegcount() == 1);
  CHECK(w.sim.cooldown == 0);

  // Las siguientes cada 25 (repoblación con deuda: el resto se conserva).
  for (int i = 1; i <= 24; ++i) UpdateSim(w.sim);
  CHECK(vegcount() == 1);
  UpdateSim(w.sim);
  CHECK(vegcount() == 2);
}

// ---------------------------------------------------------------------------
TEST_CASE("feedvegs: banda solar, reparto y mem(218)") {
  InjectedRnd rng({});  // sin SunOnRnd, feedvegs no consume RNG
  World w(rng);
  w.sim.SunPosition = 0.5;  // banda [12000, 20000] con SunRange = 0
  w.sim.SunRange = 0.0;
  w.sim.opts.VegFeedingToBody = 0.0f;

  // radio 1: LightAval = pi/1.024e9 y AreaCorrection redondea a 4.0f exacto.
  const int in_band = w.addbot(16000, 16000, 16000.0f);
  const int out_band = w.addbot(25000, 16000, 16000.0f);
  const int no_chlr = w.addbot(13000, 16000, 0.0f);
  w.sim.rob[out_band].age = 10000;

  feedvegs(w.sim, 140);  // tok = 140/3.5 = 40

  CHECK(rng.consumed() == 0);

  // Dentro de banda: acttok = (4*1.25 - 0.25)*40 = 190, todo a nrg.
  CHECK(w.sim.rob[in_band].mem[218] == 1);
  CHECK(w.sim.rob[in_band].nrg == doctest::Approx(3190.0f));
  CHECK(w.sim.rob[in_band].body == 1000.0f);
  // radius re-publicado por FindRadius (deja de ser el 1.0 artificial).
  CHECK(w.sim.rob[in_band].radius > 100.0f);

  // Fuera de banda: mem(218) queda en 0 (GoTo nextrob salta la publicación)
  // pero el impuesto por edad corre igual: age*chlr/1e9 = 0.16.
  CHECK(w.sim.rob[out_band].mem[218] == 0);
  CHECK(w.sim.rob[out_band].nrg == doctest::Approx(3000.0f - 0.16f));

  // Sin cloroplastos: solo mem(218) = 1.
  CHECK(w.sim.rob[no_chlr].mem[218] == 1);
  CHECK(w.sim.rob[no_chlr].nrg == 3000.0f);
  CHECK(w.sim.rob[no_chlr].radius == 1.0f);  // sin FindRadius

  SUBCASE("de noche: mem(218) = 0 para todos y nadie come") {
    w.sim.opts.Daytime = false;
    const float nrg_before = w.sim.rob[in_band].nrg;
    feedvegs(w.sim, 140);
    CHECK(w.sim.rob[in_band].mem[218] == 0);
    CHECK(w.sim.rob[no_chlr].mem[218] == 0);
    CHECK(w.sim.rob[in_band].nrg == nrg_before);
  }

  SUBCASE("banda con envoltura: sunstart negativo alcanza el borde derecho") {
    // SunPosition = 0: banda [-4000, 4000]; la envoltura habilita
    // [28000, 32000] como segunda banda.
    w.sim.SunPosition = 0.0;
    const int wrapped = w.addbot(30000, 16000, 16000.0f);
    const float nrg0 = w.sim.rob[wrapped].nrg;
    feedvegs(w.sim, 140);
    CHECK(w.sim.rob[wrapped].mem[218] == 1);
    CHECK(w.sim.rob[wrapped].nrg > nrg0);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("feedvegs: pondmode (profundidad) y umbrales de energia") {
  SUBCASE("pondmode: tok = LightIntensity / depth^Gradient") {
    InjectedRnd rng({});
    World w(rng);
    w.sim.SunPosition = 0.5;
    w.sim.opts.Pondmode = true;
    w.sim.opts.LightIntensity = 14000;
    w.sim.opts.Gradient = 1.0f;
    w.sim.opts.VegFeedingToBody = 0.0f;

    // depth = CLng(16000/2000 + 1) = 9 -> tok = (14000/9)/3.5 = 444.4
    const int n = w.addbot(16000, 16000, 16000.0f);
    feedvegs(w.sim, 999);  // totnrg ignorado en pondmode
    // acttok = (4*1.25 - 0.25) * 444.4444 = 2111.1
    CHECK(w.sim.rob[n].nrg ==
          doctest::Approx(3000.0f + 4.75f * (14000.0f / 9.0f / 3.5f))
              .epsilon(1e-5));
  }

  SUBCASE("PERMSUNSUSPEND bascula entre umbrales") {
    InjectedRnd rng({});
    World w(rng);
    w.sim.opts.SunUp = true;
    w.sim.opts.SunDown = true;
    w.sim.opts.SunThresholdMode = PERMSUNSUSPEND;
    w.sim.opts.SunUpThreshold = 500000;
    w.sim.opts.SunDownThreshold = 1000000;
    w.sim.opts.Daytime = false;
    const int n = w.addbot(16000, 16000, 0.0f);

    // Energía baja: amanece a la fuerza.
    w.sim.TotalSimEnergyDisplayed = 400000;
    feedvegs(w.sim, 140);
    CHECK(w.sim.opts.Daytime);
    CHECK(w.sim.rob[n].mem[218] == 1);

    // Energía alta: anochece a la fuerza.
    w.sim.TotalSimEnergyDisplayed = 1100000;
    feedvegs(w.sim, 140);
    CHECK(!w.sim.opts.Daytime);
    CHECK(w.sim.rob[n].mem[218] == 0);
  }

  SUBCASE("reloj dia/noche: bascula al superar CycleLength") {
    InjectedRnd rng({});
    World w(rng);
    w.sim.opts.DayNight = true;
    w.sim.opts.CycleLength = 2;
    w.sim.opts.Daytime = true;

    feedvegs(w.sim, 140);  // counter 1
    CHECK(w.sim.opts.Daytime);
    feedvegs(w.sim, 140);  // counter 2
    CHECK(w.sim.opts.Daytime);
    feedvegs(w.sim, 140);  // counter 3 > 2: bascula y resetea
    CHECK(!w.sim.opts.Daytime);
    CHECK(w.sim.opts.DayNightCycleCounter == 0);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("feedvegs: sol variable SunOnRnd (2 RNG/ciclo + 1 condicional)") {
  SUBCASE("camino comun: 2 extracciones, deriva por rebote en los limites") {
    InjectedRnd rng({0.9f, 0.9f});
    World w(rng);
    w.sim.opts.SunOnRnd = true;
    // SunChange = 0: Sposition 0, Srange 0. SunRange 0 - 0.0005 <= 0 =>
    // Srange = 1; SunPosition 0 - 0.0005 <= 0 => Sposition = 2 => 12.
    feedvegs(w.sim, 140);
    CHECK(rng.consumed() == 2);
    CHECK(w.sim.SunChange == 12);
    CHECK(w.sim.SunRange == doctest::Approx(-0.0005));
    CHECK(w.sim.SunPosition == doctest::Approx(-0.0005));
  }

  SUBCASE("la segunda moneda 1/2000 acierta: 3 extracciones") {
    InjectedRnd rng({0.9f, 0.0004f, 0.7f});
    World w(rng);
    w.sim.opts.SunOnRnd = true;
    feedvegs(w.sim, 140);
    CHECK(rng.consumed() == 3);
    // Sposition = Int(0.7*3) = 2 (y el rebote <= 0 lo confirma en 2).
    CHECK(w.sim.SunChange % 10 == 2);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("feedveg2: digestion de waste, 1 RNG decide el orden") {
  SUBCASE("nrg primero (moneda 0)") {
    InjectedRnd rng({0.4f});  // Int(0.8) = 0
    World w(rng);
    w.sim.opts.VegFeedingToBody = 0.5f;
    const int n = w.addbot(16000, 16000, 32000.0f);
    Bot& b = w.sim.rob[n];
    b.Waste = 10.0f;

    feedveg2(w.sim, n);

    CHECK(rng.consumed() == 1);
    // Energy = 32000/64000*0.5 = 0.25; body = 32000/64000*0.5/10 = 0.025.
    // Cada mitad descuenta chlr/32000*0.5 = 0.5 de waste.
    CHECK(b.nrg == doctest::Approx(3000.25f));
    CHECK(b.body == doctest::Approx(1000.025f));
    CHECK(b.Waste == doctest::Approx(9.0f));
  }

  SUBCASE("body primero (moneda 1) con nrg al tope: solo convierte body") {
    InjectedRnd rng({0.6f});  // Int(1.2) = 1
    World w(rng);
    w.sim.opts.VegFeedingToBody = 0.5f;
    const int n = w.addbot(16000, 16000, 32000.0f);
    Bot& b = w.sim.rob[n];
    b.nrg = 31999.9f;
    b.Waste = 10.0f;

    feedveg2(w.sim, n);

    // body convierte (waste -0.5); nrg no (31999.9 + 0.25 >= 32000) pero
    // el waste ya quedó reducido por la primera mitad.
    CHECK(b.body == doctest::Approx(1000.025f));
    CHECK(b.nrg == 31999.9f);
    CHECK(b.Waste == doctest::Approx(9.5f));
  }

  SUBCASE("el waste se agota en la primera mitad: la segunda no corre") {
    InjectedRnd rng({0.4f});  // nrg primero
    World w(rng);
    w.sim.opts.VegFeedingToBody = 0.5f;
    const int n = w.addbot(16000, 16000, 32000.0f);
    Bot& b = w.sim.rob[n];
    b.Waste = 0.3f;

    feedveg2(w.sim, n);

    CHECK(b.nrg == doctest::Approx(3000.25f));
    CHECK(b.Waste == 0.0f);       // 0.3 - 0.5 clampado a 0
    CHECK(b.body == 1000.0f);     // la mitad de body ya no vio waste
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("altzheimer: waste alto escribe basura en memoria (via HandleWaste)") {
  SUBCASE("loops = (Pwaste+Waste-BadWastelevel)/4; 2 RNG por escritura") {
    InjectedRnd rng({0.25f, 0.25f});
    World w(rng);
    w.sim.opts.BadWastelevel = 400;
    const int n = w.addbot(16000, 16000, 0.0f);  // sin chlr: sin feedveg2
    Bot& b = w.sim.rob[n];
    b.Waste = 404.0f;  // loops = 4/4 = 1

    HandleWaste(w.sim, n);

    CHECK(rng.consumed() == 2);
    // loc = Int(1000*0.25)+1 = 251; val = Int(64001*0.25)-32000 = -16000.
    CHECK(b.mem[251] == -16000);
    CHECK(b.mem[828] == 404);  // publicación de waste intacta
    CHECK(w.sim.diag.handlewaste_stub == 0);
  }

  SUBCASE("re-sortea si toca mkchlr(921)/rmchlr(922)") {
    InjectedRnd rng({0.9205f, 0.25f, 0.25f});
    World w(rng);
    w.sim.opts.BadWastelevel = 400;
    const int n = w.addbot(16000, 16000, 0.0f);
    Bot& b = w.sim.rob[n];
    b.Waste = 404.0f;

    HandleWaste(w.sim, n);

    CHECK(rng.consumed() == 3);  // 921 re-sorteado
    CHECK(b.mem[addr::mkchlr] == 0);
    CHECK(b.mem[251] == -16000);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("checkvegstatus: nick de subespecie y regla de campo vacio") {
  InjectedRnd rng({});
  World w(rng);
  const std::size_t r = w.addVegSpecies("Veg.txt");

  SUBCASE("bot con chlr y nick (n)Nombre cuenta como la especie") {
    const int n = w.addbot(1000, 1000, 5000.0f);
    w.sim.rob[n].FName = "(3)Veg.txt";
    CHECK(checkvegstatus(w.sim, static_cast<int>(r)));
  }

  SUBCASE("sin nadie con chlr pero con un vegetal vivo age>0: no elegible") {
    const int n = w.addbot(1000, 1000, 0.0f);
    w.sim.rob[n].Veg = true;
    w.sim.rob[n].age = 5;
    CHECK(!checkvegstatus(w.sim, static_cast<int>(r)));
  }

  SUBCASE("campo sin vegetales activos: elegible (repop everything)") {
    CHECK(checkvegstatus(w.sim, static_cast<int>(r)));
  }

  SUBCASE("especie no vegetal o no nativa: nunca") {
    w.sim.Specie[r].Native = false;
    CHECK(!checkvegstatus(w.sim, static_cast<int>(r)));
  }
}
