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
TEST_CASE("B-36 teleporter con un solo eje de drift no se mueve") {
  SUBCASE("solo drift X: acumula velocidad que nunca aplica") {
    InjectedRnd rng(std::vector<vb_single>(5, 0.9f));  // 1 RNG/ciclo (solo X)
    World w(rng);
    w.sim.numTeleporters = 1;
    Teleporter& tp = w.sim.Teleporters[1];
    tp.exist = true;
    tp.pos = {1000.0f, 1000.0f};
    tp.Width = 500.0f;
    tp.Height = 500.0f;
    tp.driftHorizontal = true;
    tp.driftVertical = false;

    for (int c = 0; c < 5; ++c) {
      DriftTeleporter(w.sim, 1);
      MoveTeleporter(w.sim, 1);
    }

    CHECK(rng.consumed() == 5);
    CHECK(tp.pos.x == 1000.0f);  // nunca traslada
    CHECK(tp.pos.y == 1000.0f);
    CHECK(tp.vel.x == doctest::Approx(5.0f * 0.4f));  // la deriva acumulada
    // center se recalcula igualmente: (x + W/2, y + H*0.3).
    CHECK(tp.center.x == doctest::Approx(1250.0f));
    CHECK(tp.center.y == doctest::Approx(1150.0f));
  }

  SUBCASE("ambos ejes: traslada con tope MaxVelocity/4") {
    InjectedRnd rng(std::vector<vb_single>(80, 1.0f));  // +0.5/eje/ciclo
    World w(rng);
    w.sim.numTeleporters = 1;
    Teleporter& tp = w.sim.Teleporters[1];
    tp.exist = true;
    tp.pos = {1000.0f, 1000.0f};
    tp.Width = 500.0f;
    tp.Height = 500.0f;
    tp.driftHorizontal = true;
    tp.driftVertical = true;

    for (int c = 0; c < 40; ++c) {
      DriftTeleporter(w.sim, 1);
      MoveTeleporter(w.sim, 1);
    }

    CHECK(tp.pos.x > 1000.0f);  // sí traslada
    // |vel| <= MaxVelocity/4 = 10 (con margen de un paso de re-escala).
    CHECK(VectorMagnitude(tp.vel) <= 10.001f);
  }

  SUBCASE("rebote en el borde derecho: vel.x = -10% MaxVelocity") {
    InjectedRnd rng({});
    World w(rng);
    w.sim.numTeleporters = 1;
    Teleporter& tp = w.sim.Teleporters[1];
    tp.exist = true;
    tp.pos = {31900.0f, 1000.0f};  // 31900 + 500 > 32000
    tp.Width = 500.0f;
    tp.Height = 500.0f;

    MoveTeleporter(w.sim, 1);

    CHECK(tp.pos.x == 31900.0f);  // pos.x <= FieldWidth: sin clamp
    CHECK(tp.vel.x == doctest::Approx(-4.0f));  // -40 * 0.1
  }

  SUBCASE("envoltura toroidal con Dxsxconnected") {
    InjectedRnd rng({});
    World w(rng);
    w.sim.opts.Dxsxconnected = true;
    w.sim.numTeleporters = 1;
    Teleporter& tp = w.sim.Teleporters[1];
    tp.exist = true;
    tp.pos = {-10.0f, 1000.0f};
    tp.Width = 500.0f;
    tp.Height = 500.0f;

    MoveTeleporter(w.sim, 1);

    // pos.x = -10 + 32000 - 500 = 31490.
    CHECK(tp.pos.x == doctest::Approx(31490.0f));
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("CheckTeleporters: local respawnea (2 RNG) y los filtros filtran") {
  // 6 RNG del spawn + 2 del respawn local.
  InjectedRnd rng({0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.5f, 0.25f, 0.75f});
  World w(rng);
  const int n = RobScriptLoadSim(w.sim, "stop", "T.txt");
  REQUIRE(n == 1);
  Bot& b = w.sim.rob[n];
  b.pos = {5000.0f, 5000.0f};
  b.radius = 60.0f;

  w.sim.numTeleporters = 1;
  Teleporter& tp = w.sim.Teleporters[1];
  tp.exist = true;
  tp.local = true;
  tp.teleportHeterotrophs = true;
  tp.pos = {4800.0f, 4800.0f};
  tp.Width = 600.0f;
  tp.Height = 600.0f;
  MoveTeleporter(w.sim, 1);  // publica center = (5100, 4980)

  SUBCASE("respawn a un punto uniforme del campo") {
    CheckTeleporters(w.sim, n);
    CHECK(rng.consumed() == 8);
    // (CLng(32000*0.25), CLng(32000*0.75)) = (8000, 24000), menos el
    // Sgn(dx) del ajuste por radios de ReSpawn (radiidif = 0 con una sola
    // célula): 7999/23999 (Multibots.bas:30-33).
    CHECK(b.pos.x == 7999.0f);
    CHECK(b.pos.y == 23999.0f);
    CHECK(b.exist);
    CHECK(tp.NumTeleported == 1);
  }

  SUBCASE("filtro: sin teleportHeterotrophs el no-vegetal no viaja") {
    tp.teleportHeterotrophs = false;
    CheckTeleporters(w.sim, n);
    CHECK(rng.consumed() == 6);  // solo el spawn; 0 RNG del teleporter
    CHECK(b.pos.x == 5000.0f);
    CHECK(tp.NumTeleported == 0);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("CheckTeleporters Out + TeleportInBots: el organismo viaja por el bufer") {
  VbRng rng;
  World w(rng);

  // Organismo de dos células atadas (multibot) para ejercitar el remapeo.
  const int a = RobScriptLoadSim(w.sim, "stop", "T.txt");
  const int c = RobScriptLoadSim(w.sim, "stop", "T.txt");
  REQUIRE(a == 1);
  REQUIRE(c == 2);
  w.sim.rob[a].pos = {5000.0f, 5000.0f};
  w.sim.rob[c].pos = {5100.0f, 5000.0f};
  w.sim.rob[a].radius = 60.0f;
  w.sim.rob[c].radius = 60.0f;
  w.sim.rob[a].Multibot = true;
  w.sim.rob[c].Multibot = true;
  w.sim.rob[a].Ties[1].pnt = static_cast<vb_integer>(c);
  w.sim.rob[c].Ties[1].pnt = static_cast<vb_integer>(a);
  w.sim.rob[a].mem[500] = 1234;  // marca observable

  w.sim.numTeleporters = 2;
  Teleporter& out = w.sim.Teleporters[1];
  out.exist = true;
  out.Out = true;
  out.teleportHeterotrophs = true;
  out.pos = {4800.0f, 4800.0f};
  out.Width = 600.0f;
  out.Height = 600.0f;
  MoveTeleporter(w.sim, 1);

  Teleporter& in = w.sim.Teleporters[2];
  in.exist = true;
  in.In = true;
  in.pos = {20000.0f, 20000.0f};
  in.Width = 600.0f;
  in.Height = 600.0f;
  in.InboundPollCycles = 5;
  in.BotsPerPoll = 10;
  in.PollCountDown = 0;

  // Salida: célula a toca el Out -> el organismo ENTERO se serializa y muere.
  CheckTeleporters(w.sim, a);
  CHECK(out.NumTeleported == 1);
  REQUIRE(out.outbox.size() == 1);
  CHECK(!w.sim.rob[a].exist);
  CHECK(!w.sim.rob[c].exist);

  // El registro empieza con cnum = 2 (Integer).
  CHECK(out.outbox[0][0] == 2);
  CHECK(out.outbox[0][1] == 0);

  // Entrada: el búfer viaja al inbox del In y entra en el próximo sondeo.
  in.inbox.push_back(out.outbox[0]);
  TeleportInBots(w.sim);

  CHECK(in.NumTeleportedIn == 1);
  CHECK(in.PollCountDown == 5);  // re-armado a InboundPollCycles
  CHECK(in.inbox.empty());

  int loaded = 0;
  for (int t = 1; t <= w.sim.MaxRobs; ++t)
    if (w.sim.rob[t].exist) loaded += 1;
  CHECK(loaded == 2);

  // Célula 0 recolocada al punto de entrada (x + W/2, y + H/3) y la otra
  // conserva el desplazamiento relativo (+100, 0).
  REQUIRE(w.sim.rob[1].exist);
  REQUIRE(w.sim.rob[2].exist);
  CHECK(w.sim.rob[1].pos.x == doctest::Approx(20300.0f));
  CHECK(w.sim.rob[1].pos.y == doctest::Approx(20200.0f));
  CHECK(w.sim.rob[2].pos.x == doctest::Approx(20400.0f));
  CHECK(w.sim.rob[1].mem[500] == 1234);  // la memoria viajó

  // Ties remapeadas a los slots nuevos por oldBotNum.
  CHECK(w.sim.rob[1].Ties[1].pnt == 2);
  CHECK(w.sim.rob[2].Ties[1].pnt == 1);

  // La especie desconocida se auto-registró con los defaults de red.
  REQUIRE(w.sim.Specie.size() == 1);
  CHECK(w.sim.Specie[0].Name == "T.txt");
  CHECK(w.sim.Specie[0].qty == 5);
  CHECK(w.sim.Specie[0].Stnrg == 3000);
  CHECK(!w.sim.Specie[0].Native);

  // Ciclos siguientes sin nada que sondear: el contador baja de a 1.
  TeleportInBots(w.sim);
  CHECK(in.PollCountDown == 4);
  CHECK(w.sim.diag.err9_load_organism == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("B7-2 salida a internet acoplada al contador de entrada") {
  VbRng rng;
  World w(rng);
  const int n = RobScriptLoadSim(w.sim, "stop", "T.txt");
  w.sim.rob[n].pos = {5000.0f, 5000.0f};
  w.sim.rob[n].radius = 60.0f;

  w.sim.numTeleporters = 1;
  Teleporter& tp = w.sim.Teleporters[1];
  tp.exist = true;
  tp.Internet = true;
  tp.teleportHeterotrophs = true;
  tp.pos = {4800.0f, 4800.0f};
  tp.Width = 600.0f;
  tp.Height = 600.0f;
  tp.InboundPollCycles = 5;
  tp.BotsPerPoll = 10;
  MoveTeleporter(w.sim, 1);

  // Con PollCountDown > 0 el puerto NO expulsa aunque el bot lo pise.
  tp.PollCountDown = 3;
  CheckTeleporters(w.sim, n);
  CHECK(w.sim.rob[n].exist);
  CHECK(tp.outbox.empty());

  // Con el contador vencido, expulsa.
  tp.PollCountDown = 0;
  CheckTeleporters(w.sim, n);
  CHECK(!w.sim.rob[n].exist);
  CHECK(tp.outbox.size() == 1);
}

// ---------------------------------------------------------------------------
TEST_CASE("TeleportInBots: gate global de especies (SpeciesNum > 45)") {
  VbRng rng;
  World w(rng);
  for (int i = 0; i < 46; ++i) {
    Specie sp;
    sp.Name = "S" + std::to_string(i) + ".txt";
    w.sim.Specie.push_back(sp);
  }
  w.sim.numTeleporters = 1;
  Teleporter& tp = w.sim.Teleporters[1];
  tp.exist = true;
  tp.In = true;
  tp.InboundPollCycles = 5;
  tp.PollCountDown = 0;
  tp.BotsPerPoll = 10;
  tp.inbox.push_back({2, 0});  // registro ficticio: no debe ni tocarse

  TeleportInBots(w.sim);

  CHECK(tp.inbox.size() == 1);   // suspendida toda entrada
  CHECK(tp.PollCountDown == 0);  // ni siquiera decrementa
}

// ---------------------------------------------------------------------------
TEST_CASE("DoObstacleCollisions: empuje por el borde mas cercano") {
  InjectedRnd rng({});
  World w(rng);

  SUBCASE("solapamiento parcial: clamp al borde, touch y reftype") {
    const int o = NewObstacle(w.sim, 10000.0f, 10000.0f, 1000.0f, 1000.0f);
    REQUIRE(o == 1);
    const int n = w.addbot(9990.0f, 10500.0f);
    w.sim.rob[n].radius = 60.0f;

    DoObstacleCollisions(w.sim, n);

    Bot& b = w.sim.rob[n];
    // distleft = 50 gana: pos.x = ob.x - radius; el borde toca por la
    // derecha (pos.x - radius < ob.x) => touch + ImpulseRes por velocidad.
    CHECK(b.pos.x == doctest::Approx(9940.0f));
    CHECK(b.pos.y == 10500.0f);
    CHECK(b.mem[addr::REFTYPE] == 1);  // EYEF = 0 y hubo empuje
    CHECK(w.sim.diag.obstacle_collision_stub == 0);
  }

  SUBCASE("bot hundido: ImpulseRes proporcional a la penetracion (k=0.5)") {
    NewObstacle(w.sim, 10000.0f, 10000.0f, 1000.0f, 1000.0f);
    const int n = w.addbot(10100.0f, 10500.0f);
    w.sim.rob[n].radius = 60.0f;

    DoObstacleCollisions(w.sim, n);

    Bot& b = w.sim.rob[n];
    // distleft = 160; pos.x - radius = 10040 >= ob.x: rama sin touch.
    CHECK(b.pos.x == doctest::Approx(9940.0f));
    CHECK(b.ImpulseRes.x == doctest::Approx(80.0f));  // 160 * 0.5
  }

  SUBCASE("anti-atrapamiento: 3 colisiones = salto por Sgn del ciclo") {
    // Tres formas encadenadas: el empuje de cada una mete al bot en la
    // siguiente (LastPush alterna el eje).
    NewObstacle(w.sim, 15900.0f, 5000.0f, 5000.0f, 10000.0f);
    NewObstacle(w.sim, 10000.0f, 9900.0f, 5900.0f, 8000.0f);
    NewObstacle(w.sim, 15000.0f, 9000.0f, 2000.0f, 2000.0f);
    const int n = w.addbot(16000.0f, 10000.0f);
    w.sim.rob[n].radius = 60.0f;

    DoObstacleCollisions(w.sim, n);

    Bot& b = w.sim.rob[n];
    // Empujes 1 (x: 15840) y 2 (y: 9840) y salto: TotRunCycle = 0 =>
    // Sgn(0 Mod 40 - 20) = -1, Sgn(0 Mod 50 - 25) = -1: -200 en ambos.
    CHECK(b.pos.x == doctest::Approx(15640.0f));
    CHECK(b.pos.y == doctest::Approx(9640.0f));
    CHECK(b.ImpulseRes.x == doctest::Approx(80.0f));
    CHECK(b.ImpulseRes.y == doctest::Approx(80.0f));
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("DoShotObstacleCollisions: rebote por el eje de entrada") {
  InjectedRnd rng({});
  World w(rng);
  NewObstacle(w.sim, 10000.0f, 10000.0f, 1000.0f, 1000.0f);

  w.sim.Shots[1].exist = true;
  w.sim.Shots[1].pos = {10050.0f, 10500.0f};
  w.sim.Shots[1].opos = {9950.0f, 10500.0f};  // entró por la izquierda
  w.sim.Shots[1].velocity = {100.0f, 25.0f};

  SUBCASE("rebota invirtiendo solo el eje por el que entro") {
    DoShotObstacleCollisions(w.sim, 1);
    CHECK(w.sim.Shots[1].exist);
    CHECK(w.sim.Shots[1].velocity.x == -100.0f);
    CHECK(w.sim.Shots[1].velocity.y == 25.0f);  // opos.y dentro del rango
  }

  SUBCASE("shapesAbsorbShots: la forma absorbe el shot") {
    w.sim.opts.shapesAbsorbShots = true;
    DoShotObstacleCollisions(w.sim, 1);
    CHECK(!w.sim.Shots[1].exist);
  }

  SUBCASE("shot nacido dentro: opos dentro no invierte nada") {
    w.sim.Shots[1].opos = {10500.0f, 10500.0f};
    DoShotObstacleCollisions(w.sim, 1);
    CHECK(w.sim.Shots[1].velocity.x == 100.0f);
    CHECK(w.sim.Shots[1].velocity.y == 25.0f);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("MoveObstacles/DriftObstacles: deriva, clamps y el tope invertido") {
  SUBCASE("drift horizontal: 2 RNG por forma y por eje activo") {
    InjectedRnd rng({0.9f, 0.5f});
    World w(rng);
    w.sim.opts.allowHorizontalShapeDrift = true;
    w.sim.opts.shapeDriftRate = 20;
    NewObstacle(w.sim, 10000.0f, 10000.0f, 1000.0f, 1000.0f);

    MoveObstacles(w.sim);

    CHECK(rng.consumed() == 2);
    // Random(-20,20) con 0.9 = Int(36.9)-20 = 16; *0.5*0.01 = 0.08.
    CHECK(w.sim.Obstacles[1].vel.x == doctest::Approx(0.08f));
    CHECK(w.sim.Obstacles[1].pos.x == doctest::Approx(10000.08f));
  }

  SUBCASE("clamp al campo re-arma la velocidad hacia adentro") {
    InjectedRnd rng({});
    World w(rng);
    w.sim.opts.shapeDriftRate = 20;
    NewObstacle(w.sim, 31990.0f, 10000.0f, 1000.0f, 1000.0f);
    w.sim.Obstacles[1].vel.x = 50.0f;  // 31990 + 50 = 32040 > 32000

    MoveObstacles(w.sim);

    CHECK(w.sim.Obstacles[1].pos.x == 32000.0f);
    CHECK(w.sim.Obstacles[1].vel.x == doctest::Approx(-0.2f));  // -rate*0.01
  }

  SUBCASE("el 'tope' de DriftObstacles AMPLIFICA (re-escala invertida)") {
    // Fuente: vel = VectorScalar(vel, Magnitud/MaxVelocity) cuando
    // Magnitud > MaxVelocity — multiplica por >1 en vez de acotar.
    InjectedRnd rng({0.5f, 0.5f});  // Random(-20,20) = 0: la deriva no toca
    World w(rng);
    w.sim.opts.allowHorizontalShapeDrift = true;
    w.sim.opts.shapeDriftRate = 20;
    w.sim.opts.MaxVelocity = 40.0f;
    NewObstacle(w.sim, 10000.0f, 10000.0f, 1000.0f, 1000.0f);
    w.sim.Obstacles[1].vel.x = 100.0f;

    DriftObstacles(w.sim);

    CHECK(w.sim.Obstacles[1].vel.x == doctest::Approx(250.0f));  // ×2.5
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("SaveSimulation/LoadSimulation: ida-y-vuelta completa") {
  VbRng rng;
  World w(rng);
  Sim& A = w.sim;

  // Tres bots con un hueco en el slot 2: el archivo guarda DENSO y los
  // remapeos por oldBotNum reconstruyen ties y shots.
  const int b1 = RobScriptLoadSim(A, "stop", "Alpha.txt");
  const int b2 = RobScriptLoadSim(A, "stop", "Alpha.txt");
  const int b3 = RobScriptLoadSim(A, "stop", "Alpha.txt");
  REQUIRE(b1 == 1);
  REQUIRE(b2 == 2);
  REQUIRE(b3 == 3);
  A.rob[2].exist = false;  // hueco
  A.rob[1].pos = {5000.0f, 6000.0f};
  A.rob[3].pos = {5200.0f, 6000.0f};
  A.rob[1].mem[500] = 4321;
  A.rob[1].Ties[1].pnt = 3;
  A.rob[3].Ties[1].pnt = 1;
  A.rob[1].nrg = 12345.0f;

  // Un virus almacenado apuntando al bot 3.
  A.Shots[5].exist = true;
  A.Shots[5].parent = 3;
  A.Shots[5].stored = true;
  A.Shots[5].shottype = -7;
  A.Shots[5].DnaLen = 2;
  A.Shots[5].dna.assign(3, Block{});
  A.Shots[5].dna[1] = {0, 7};
  A.Shots[5].dna[2] = {10, 1};
  A.Shots[5].FromSpecie = "Alpha.txt";

  // SimOpts distintivos.
  A.opts.SimName = "MiSim";
  A.opts.FieldWidth = 16000.0f;
  A.opts.FieldHeight = 12000.0f;
  A.opts.MaxVelocity = 60.0f;
  A.opts.RepopCooldown = 25;
  A.opts.RepopAmount = 3;
  A.opts.MinVegs = 7;
  A.opts.MaxEnergy = 150;
  A.opts.Pondmode = true;
  A.opts.LightIntensity = 14000;
  A.opts.Daytime = false;
  A.opts.SunOnRnd = true;
  A.opts.DisableMutations = true;  // el quirk lo borrará al cargar
  A.opts.BadWastelevel = 0;        // 0 se corrige a 400 al cargar
  A.vm.costs.v[cost::SHOTCOST] = 1.5f;
  A.vm.costs.v[40] = 2.25f;
  A.SunPosition = 0.625;
  A.SunRange = 0.25;
  A.SunChange = 12;
  A.evo.stagnent = true;
  A.evo.strGraphQuery1 = "nrg>100";
  A.MaxAbsNum = 99;

  // Una especie con rasgos reconocibles.
  {
    Specie sp;
    sp.Name = "Alpha.txt";
    sp.Veg = true;
    sp.Stnrg = 4000;
    sp.qty = 9;
    sp.population = 12;
    sp.Native = false;
    sp.Mutables.mutarray[3] = 777.0f;
    sp.Mutables.Mean[2] = 5.0f;
    sp.Poslf = 0.25f;
    A.Specie.push_back(sp);
  }

  // Un teleporter normal y uno Internet (que la carga borra) + una forma.
  A.numTeleporters = 2;
  A.Teleporters[1].exist = true;
  A.Teleporters[1].local = true;
  A.Teleporters[1].pos = {100.0f, 200.0f};
  A.Teleporters[1].Width = 640.0f;
  A.Teleporters[1].Height = 480.0f;
  A.Teleporters[1].InboundPollCycles = 7;
  A.Teleporters[1].BotsPerPoll = 4;
  A.Teleporters[1].PollCountDown = 2;
  A.Teleporters[1].teleportHeterotrophs = true;
  A.Teleporters[2].exist = true;
  A.Teleporters[2].Internet = true;
  A.Teleporters[2].pos = {900.0f, 900.0f};

  NewObstacle(A, 4000.0f, 4500.0f, 800.0f, 600.0f, 12345);
  A.Obstacles[1].vel = {1.5f, -2.5f};

  VbBinFile f;
  SaveSimulation(A, f);

  // Carga en una sim virgen.
  VbRng rng2;
  World w2(rng2);
  Sim& B = w2.sim;
  f.pos = 0;
  LoadSimulation(B, f);

  // Bots: densos, con ties remapeadas 1<->2 (oldBotNum 1 y 3).
  CHECK(B.MaxRobs == 2);
  REQUIRE(B.rob[1].exist);
  REQUIRE(B.rob[2].exist);
  CHECK(B.rob[1].mem[500] == 4321);
  CHECK(B.rob[1].nrg == 12345.0f);
  CHECK(B.rob[1].oldBotNum == 1);
  CHECK(B.rob[2].oldBotNum == 3);
  CHECK(B.rob[1].Ties[1].pnt == 2);
  CHECK(B.rob[2].Ties[1].pnt == 1);

  // Shots: el array entero viaja (vivos y muertos) y el virus almacenado
  // se re-engancha al slot nuevo del dueño.
  CHECK(B.maxshotarray == A.maxshotarray);
  REQUIRE(B.Shots[5].exist);
  CHECK(B.Shots[5].parent == 2);
  CHECK(B.Shots[5].stored);
  CHECK(B.rob[2].virusshot == 5);
  CHECK(B.Shots[5].DnaLen == 2);
  CHECK(B.Shots[5].dna[1].value == 7);
  CHECK(B.Shots[5].FromSpecie == "Alpha.txt");

  // SimOpts.
  CHECK(B.opts.SimName == "MiSim");
  CHECK(B.opts.FieldWidth == 16000.0f);
  CHECK(B.opts.FieldHeight == 12000.0f);
  CHECK(B.opts.MaxVelocity == 60.0f);
  CHECK(B.opts.RepopCooldown == 25);
  CHECK(B.opts.RepopAmount == 3);
  CHECK(B.opts.MinVegs == 7);
  CHECK(B.opts.MaxEnergy == 150);
  CHECK(B.opts.Pondmode);
  CHECK(B.opts.LightIntensity == 14000);
  CHECK(!B.opts.Daytime);
  CHECK(B.opts.SunOnRnd);
  CHECK(B.vm.costs.v[cost::SHOTCOST] == 1.5f);
  CHECK(B.vm.costs.v[40] == 2.25f);
  CHECK(B.MaxAbsNum == 99);

  // Quirks de carga replicados.
  CHECK(!B.opts.DisableMutations);       // CInt(True) = -1 < 0: reset
  CHECK(B.opts.BadWastelevel == 400);    // 0 -> 400
  CHECK(B.vm.costs.v[55] == 500.0f);     // DYNAMICCOSTSENSITIVITY 0 -> 500

  // Sol y evo.
  CHECK(B.SunPosition == 0.625);
  CHECK(B.SunRange == 0.25);
  CHECK(B.SunChange == 12);
  CHECK(B.evo.stagnent);
  CHECK(B.evo.strGraphQuery1 == "nrg>100");

  // Especie.
  REQUIRE(B.Specie.size() == 1);
  CHECK(B.Specie[0].Name == "Alpha.txt");
  CHECK(B.Specie[0].Veg);
  CHECK(B.Specie[0].Stnrg == 4000);
  CHECK(B.Specie[0].qty == 9);
  CHECK(B.Specie[0].population == 12);
  CHECK(!B.Specie[0].Native);
  CHECK(B.Specie[0].Mutables.mutarray[3] == 777.0f);
  CHECK(B.Specie[0].Mutables.Mean[2] == 5.0f);
  CHECK(B.Specie[0].Poslf == 0.25f);

  // Teleporters: el Internet se borra al cargar; el local sobrevive con su
  // sondeo.
  CHECK(B.numTeleporters == 1);
  CHECK(B.Teleporters[1].local);
  CHECK(B.Teleporters[1].pos.x == 100.0f);
  CHECK(B.Teleporters[1].Width == 640.0f);
  CHECK(B.Teleporters[1].InboundPollCycles == 7);
  CHECK(B.Teleporters[1].BotsPerPoll == 4);
  CHECK(B.Teleporters[1].PollCountDown == 2);

  // Obstáculo.
  CHECK(B.numObstacles == 1);
  CHECK(B.Obstacles[1].exist);
  CHECK(B.Obstacles[1].pos.x == 4000.0f);
  CHECK(B.Obstacles[1].Width == 800.0f);
  CHECK(B.Obstacles[1].color == 12345);
  CHECK(B.Obstacles[1].vel.y == -2.5f);
}

// ---------------------------------------------------------------------------
TEST_CASE("Sidecar .mrate: solo los operadores 0..10 viajan") {
  Mutationprobs mut{};
  mut.PointWhatToChange = 80;
  mut.CopyErrorWhatToChange = 90;
  for (int m = 0; m <= 20; ++m) {
    mut.mutarray[m] = static_cast<vb_single>(1000 + m);
    mut.Mean[m] = static_cast<vb_single>(m);
    mut.StdDev[m] = 0.5f;
  }
  mut.Mutations = true;  // no se persiste

  const std::string text = Save_mrates(mut);
  // Formato Write # de VB6: un valor por línea, ".5" sin cero inicial.
  CHECK(text.rfind("80\r\n90\r\n1000\r\n0\r\n.5\r\n", 0) == 0);

  const Mutationprobs back = Load_mrates(text);
  CHECK(back.PointWhatToChange == 80);
  CHECK(back.CopyErrorWhatToChange == 90);
  for (int m = 0; m <= 10; ++m) {
    CHECK(back.mutarray[m] == static_cast<vb_single>(1000 + m));
    CHECK(back.Mean[m] == static_cast<vb_single>(m));
    CHECK(back.StdDev[m] == 0.5f);
  }
  // 11..20 se pierden (compat con archivos viejos) y Mutations no viaja.
  CHECK(back.mutarray[15] == 0.0f);
  CHECK(back.Mean[15] == 0.0f);
  CHECK(!back.Mutations);
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
