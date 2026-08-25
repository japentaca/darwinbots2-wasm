// Casos dorados M-01..M-12 (70-CASOS-DORADOS.md §4): memoria y ciclo.
// Corren sobre el esqueleto del tick (master.hpp): pasos 10/12/14/15/16/17 de
// 10-CICLO.md §2 y las 7 pasadas de UpdateBots.
#include <string>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

// Mundo mínimo con RNG del motor (los valores no afectan las aserciones salvo
// donde se inyecta secuencia).
struct World {
  Sim sim;
  VbRng rng;

  World() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
  }

  // Alta manual de un bot SIN consumo de RNG (la vía con preparerob, que
  // consume 6, se ejercita en M-08/M-10): estado equivalente al fundador ya
  // sembrado.
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
    b.BucketPos = {-2.0f, -2.0f};  // como preparerob (Module1.bas:37-39)
    UpdateBotBucket(sim, n);
    return n;
  }

  void tick() { UpdateSim(sim); }
};

}  // namespace

// ---------------------------------------------------------------------------
TEST_CASE("M-01 latencia de 1 ciclo de los sentidos") {
  World w;
  // Bots solapados: radio(body 1000) ~ 114, separacion 60 -> colision.
  const int a = w.spawn("start *205 900 store stop", "A.txt", 1000, 1000);
  const int b = w.spawn("stop", "B.txt", 1060, 1000);

  // Tick N: el ADN corre ANTES del contacto (paso 10 vs P1).
  w.tick();
  CHECK(w.sim.rob[a].mem[addr::hitup] == 1);
  CHECK(w.sim.rob[a].mem[addr::hit] == 1);
  CHECK(w.sim.rob[a].mem[900] == 0);  // el ADN leyo el 0 previo al contacto

  // Los bots ya no se tocan en N+1.
  w.sim.rob[b].pos = {10000.0f, 10000.0f};

  // Tick N+1: el ADN lee el contacto de N; el paso 12 lo borra despues.
  w.tick();
  CHECK(w.sim.rob[a].mem[900] == 1);
  CHECK(w.sim.rob[a].mem[addr::hitup] == 0);
  CHECK(w.sim.rob[a].mem[addr::hit] == 0);

  // Tick N+2: sin contacto nuevo, el ADN lee 0.
  w.tick();
  CHECK(w.sim.rob[a].mem[900] == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("M-02 comandos consumidos en el mismo ciclo: dir*") {
  World w;
  const int a = w.spawn("start 100 1 store stop", "A.txt", 1000, 1000);

  w.tick();

  Bot& b = w.sim.rob[a];
  // El comando se consumio en P3 tras aplicarse en P1 (VoluntaryForces).
  CHECK(b.mem[addr::dirup] == 0);
  CHECK(b.lastup == 100);
  // masa 1 (body 1000); |dir| = 100 > MaxVelocity 40 => escala a 40;
  // ImpulseInd = 40 * PhysMoving(0.66) = 26.4; vel = 26.4.
  CHECK(b.vel.x == doctest::Approx(26.4).epsilon(1e-5));
  CHECK(b.vel.y == doctest::Approx(0.0));
  CHECK(b.pos.x == doctest::Approx(1026.4).epsilon(1e-5));
  // Publicaciones (iceil = CInt bancario): 26.4 -> 26.
  CHECK(b.mem[addr::velscalar] == 26);
  CHECK(b.mem[addr::vel] == 26);
  CHECK(b.mem[addr::veldn] == -26);
  CHECK(b.mem[addr::veldx] == 0);
  CHECK(b.mem[addr::velsx] == 0);
  CHECK(b.mem[addr::masssys] == 1);
  CHECK(b.mem[addr::maxvelsys] == 40);
}

// ---------------------------------------------------------------------------
TEST_CASE("M-03 mem(0) es el sumidero del remapeo de 340") {
  World w;
  const int c = w.spawn("stop", "C.txt", 1000, 1000);  // atacante
  const int d = w.spawn("stop", "D.txt", 1400, 1000);  // victima

  w.sim.rob[c].venom = 100.0f;
  w.sim.rob[c].mem[835] = 340;  // vloc = 340 (delgene)
  w.sim.rob[c].mem[836] = 44;   // venval
  w.sim.rob[c].mem[addr::shoot] = -3;

  // El shot nace en el tick 1 y navega ~5 ticks hasta la victima; Poisons
  // escribe al ciclo siguiente del impacto.
  for (int i = 0; i < 12 && !w.sim.rob[d].Paralyzed; ++i) w.tick();
  REQUIRE(w.sim.rob[d].Paralyzed);
  CHECK(w.sim.rob[d].Vloc == 0);      // 340 -> 0 (Shots.bas:802-809)
  CHECK(w.sim.rob[d].Vval == 44);
  w.tick();                            // P1: Poisons
  CHECK(w.sim.rob[d].mem[0] == 44);   // el sumidero
  CHECK(w.sim.rob[d].mem[340] == 0);  // delgene jamas tocado
}

// ---------------------------------------------------------------------------
TEST_CASE("M-04 regimen C: comandos que NO se consumen") {
  SUBCASE("strbody negativo persiste para siempre") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    w.sim.rob[a].mem[addr::strbody] = -50;
    w.tick();
    w.tick();
    CHECK(w.sim.rob[a].mem[addr::strbody] == -50);
  }
  SUBCASE("repro fallido reintenta: la guarda body <= 2 sale antes del reset") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    w.sim.rob[a].body = 1.0f;
    w.sim.rob[a].radius = FindRadius(w.sim, a);
    w.sim.rob[a].mem[addr::Repro] = 50;
    w.tick();
    CHECK(w.sim.rob[a].mem[addr::Repro] == 50);
    CHECK(w.sim.MaxRobs == 1);  // no nacio nadie
  }
  SUBCASE("shootval sin shoot persiste") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    w.sim.rob[a].mem[addr::shootval] = 10;
    w.tick();
    w.tick();
    CHECK(w.sim.rob[a].mem[addr::shootval] == 10);
  }
  SUBCASE("fixang sin ties persiste (el reset esta tras el gate tienum/tiepres)") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    w.sim.rob[a].mem[addr::FIXANG] = 100;
    w.tick();
    CHECK(w.sim.rob[a].mem[addr::FIXANG] == 100);
  }
  SUBCASE("fixang con tie seleccionada resetea al centinela 32000, no a 0") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    const int b = w.spawn("stop", "B.txt", 1250, 1000);
    REQUIRE(maketie(w.sim, a, b, 300, 100, 3));  // port 3 -> tiepres = 3
    w.sim.rob[a].mem[addr::FIXANG] = 100;
    w.tick();
    CHECK(w.sim.rob[a].mem[addr::FIXANG] == 32000);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("M-05 memoria genetica: instantanea y diferida") {
  World w;
  const int p = w.spawn("stop", "P.txt", 1000, 1000);
  w.sim.rob[p].nrg = 10000.0f;
  w.sim.rob[p].mem[971] = 11;
  w.sim.rob[p].mem[975] = 55;
  w.sim.rob[p].mem[976] = 100;
  w.sim.rob[p].mem[977] = 200;
  w.sim.rob[p].mem[990] = 900;
  w.sim.rob[p].mem[addr::timersys] = 123;  // M-08(a): herencia del timer
  w.sim.rob[p].mem[addr::Repro] = 50;

  w.tick();  // P6: nace el hijo
  REQUIRE(w.sim.MaxRobs == 2);
  const int c = 2;
  REQUIRE(w.sim.rob[c].exist);

  // 1. instantaneas al nacer; diferidas en epimem; el padre pierde epimem.
  CHECK(w.sim.rob[c].mem[971] == 11);
  CHECK(w.sim.rob[c].mem[975] == 55);
  CHECK(w.sim.rob[c].mem[976] == 0);
  CHECK(w.sim.rob[c].epimem[0] == 100);
  CHECK(w.sim.rob[c].epimem[14] == 900);
  CHECK(w.sim.rob[p].epimem[0] == 0);
  // M-08(a): el hijo hereda el timer DEL MISMO tick: Ageing (P5) ya lo subio
  // a 124 antes de ReproduceAndKill (P6) — orden de 10-CICLO.md §5.
  CHECK(w.sim.rob[c].mem[addr::timersys] == 124);
  CHECK(w.sim.rob[p].mem[addr::Repro] == 0);        // consumo en exito (M-04)
  CHECK(w.sim.rob[c].Ties[1].last > 0);             // tie de nacimiento

  SUBCASE("entrega de una celda por ciclo hasta age = 14") {
    w.tick();  // hijo con age 0: entrega mem(976)
    CHECK(w.sim.rob[c].mem[976] == 100);
    CHECK(w.sim.rob[c].mem[990] == 0);
    for (int i = 0; i < 14; ++i) w.tick();  // hasta age = 14 incluido
    CHECK(w.sim.rob[c].mem[977] == 200);
    CHECK(w.sim.rob[c].mem[990] == 900);
  }
  SUBCASE("cortar la tie de nacimiento cancela las entregas restantes") {
    w.tick();  // entrega mem(976)
    DeleteTie(w.sim, p, c);
    for (int i = 0; i < 16; ++i) w.tick();
    CHECK(w.sim.rob[c].mem[976] == 100);
    CHECK(w.sim.rob[c].mem[977] == 0);
    CHECK(w.sim.rob[c].mem[990] == 0);
  }
  SUBCASE("escribir la celda antes de la entrega la cancela (celda != 0)") {
    w.sim.rob[c].mem[977] = 7;  // el hijo pisa su celda antes de age = 1
    for (int i = 0; i < 4; ++i) w.tick();
    CHECK(w.sim.rob[c].mem[977] == 7);  // la entrega de 200 no ocurrio
    CHECK(w.sim.rob[c].mem[976] == 100);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("M-06 refvelsx vale 0 siempre [PROBABLE BUG] A3-1") {
  World w;
  // B delante de A (aim 0, ojo frontal con foco), sin solape (radios ~114,
  // separacion 300): el barrido real de M4 puebla lastopp.
  const int a = w.spawn("stop", "A.txt", 1000, 1000);
  const int b = w.spawn("stop", "B.txt", 1300, 1000);
  w.sim.rob[b].vel = {0.0f, 20.0f};  // velocidad lateral respecto de A (aim 0)

  w.tick();
  REQUIRE(w.sim.rob[a].lastopp == b);  // visto por el ojo con foco (eye5)

  CHECK(w.sim.rob[a].mem[addr::refveldx] == 20);  // funcional
  CHECK(w.sim.rob[a].mem[addr::refvelsx] == 0);   // muerta: se niega a si misma
  CHECK(w.sim.rob[a].mem[addr::refvelscalar] == 20);
}

// ---------------------------------------------------------------------------
TEST_CASE("M-07 trefshell sobrevive a EraseTRefVars [PROBABLE BUG] A3-2") {
  World w;
  const int a = w.spawn("stop", "A.txt", 1000, 1000);
  const int b = w.spawn("stop", "B.txt", 1250, 1000);
  w.sim.rob[b].shell = 120.0f;
  REQUIRE(maketie(w.sim, a, b, 300, 100, 0));
  // maketie ya cargo los trefvars del creador (Ties.bas:930).
  CHECK(w.sim.rob[a].mem[addr::trefshell] == 120);

  w.tick();  // newage 1
  w.tick();  // newage 2
  w.tick();  // readtie P1 refresca trefvars
  CHECK(w.sim.rob[a].mem[addr::trefshell] == 120);
  CHECK(w.sim.rob[a].mem[addr::trefbody] == 1000);

  DeleteTie(w.sim, a, b);
  w.tick();  // readtie: numties = 0 -> EraseTRefVars

  CHECK(w.sim.rob[a].mem[addr::trefshell] == 120);  // 449 sobrevive
  CHECK(w.sim.rob[a].mem[addr::trefbody] == 0);     // 437 borrada
  CHECK(w.sim.rob[a].mem[addr::trefxpos] == 0);     // 438 borrada
  CHECK(w.sim.rob[a].mem[456] == 0);
  CHECK(w.sim.rob[a].mem[465] == 0);
}

// ---------------------------------------------------------------------------
TEST_CASE("M-08 siembra del fundador: 9 extracciones y timer Random") {
  Sim sim;
  InjectedRnd rng(std::vector<vb_single>(9, 0.5f));
  sim.rndy = &rng;
  sim.vm.rndy = &rng;

  const int a = InsertFounder(sim, "stop", "F.txt");
  REQUIRE(a == 1);
  // 6 de preparerob + 2 de posicion + 1 del timer = 9 exactas (M-08b, Q01).
  CHECK(rng.consumed() == 9);
  CHECK(rng.exhausted());
  // Random(-32000, 32000) con rndy = 0.5: Int(64001*0.5) - 32000 = 0.
  CHECK(sim.rob[a].mem[addr::timersys] == 0);
  CHECK(sim.rob[a].nrg == 3000.0f);  // Stnrg default de la especie
  CHECK(sim.rob[a].body == 1000.0f);
}

// ---------------------------------------------------------------------------
namespace {
// Harness de M-09: tirador en (1000,1000) mirando a la victima en (1400,1000);
// corre hasta que el shot golpea (sabor escrito) o se agota el plazo.
struct ShotDuel {
  World w;
  int s, v;
  ShotDuel() {
    s = w.spawn("stop", "S.txt", 1000, 1000);
    v = w.spawn("stop", "V.txt", 1400, 1000);
  }
  bool run_until_hit(int maxticks = 12) {
    for (int i = 0; i < maxticks; ++i) {
      w.tick();
      if (w.sim.rob[v].mem[addr::shflav] != 0) return true;
    }
    return false;
  }
};
}  // namespace

TEST_CASE("M-09 shots de memoria: direccion, salto de 340 y bloqueo por poison") {
  SUBCASE(".shoot 205 escribe directo") {
    ShotDuel d;
    d.w.sim.rob[d.s].mem[addr::shoot] = 205;
    d.w.sim.rob[d.s].mem[addr::shootval] = 7;
    REQUIRE(d.run_until_hit());
    CHECK(d.w.sim.rob[d.v].mem[205] == 7);
    CHECK(d.w.sim.rob[d.v].mem[addr::shflav] == 205);
  }
  SUBCASE(".shoot 1205: robshoot hace Mod 1000") {
    ShotDuel d;
    d.w.sim.rob[d.s].mem[addr::shoot] = 1205;
    d.w.sim.rob[d.s].mem[addr::shootval] = 7;
    REQUIRE(d.run_until_hit());
    CHECK(d.w.sim.rob[d.v].mem[205] == 7);
  }
  SUBCASE(".shoot 340: el shot golpea pero no escribe (salto de delgene)") {
    ShotDuel d;
    d.w.sim.rob[d.s].mem[addr::shoot] = 340;
    d.w.sim.rob[d.s].mem[addr::shootval] = 7;
    REQUIRE(d.run_until_hit());
    CHECK(d.w.sim.rob[d.v].mem[340] == 0);
    CHECK(d.w.sim.rob[d.v].mem[addr::shflav] == 340);  // el sabor si llega
  }
  SUBCASE(".shoot 2000: Mod 1000 = 0, newshot convierte 0 -> -8 (esperma)") {
    ShotDuel d;
    d.w.sim.rob[d.s].mem[addr::shoot] = 2000;
    d.w.sim.rob[d.s].mem[addr::shootval] = 7;
    REQUIRE(d.run_until_hit());
    CHECK(d.w.sim.rob[d.v].mem[addr::shflav] == -8);
    // El parametro de newshot era 0, no -8: el ADN del esperma NO viaja
    // (Shots.bas:197-201) y takesperm sale por DnaLen = 0.
    CHECK(d.w.sim.rob[d.v].fertilized <= 0);
    CHECK(d.w.sim.rob[d.v].mem[addr::SYSFERTILIZED] == 0);
  }
  SUBCASE("victima con poison >= nrg/2: bloqueo y rebote -5") {
    ShotDuel d;
    d.w.sim.rob[d.s].mem[addr::shoot] = 205;
    d.w.sim.rob[d.s].mem[addr::shootval] = 7;
    d.w.sim.rob[d.v].poison = 32000.0f;
    REQUIRE(d.run_until_hit());
    CHECK(d.w.sim.rob[d.v].mem[205] == 0);           // bloqueado
    CHECK(d.w.sim.rob[d.v].poison < 32000.0f);       // pago 90% de nrg/2
    bool rebote = false;
    for (vb_long i = 1; i <= d.w.sim.maxshotarray; ++i)
      if (d.w.sim.Shots[i].exist && d.w.sim.Shots[i].shottype == -5 &&
          d.w.sim.Shots[i].parent == d.v)
        rebote = true;
    CHECK(rebote);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("M-10 publicaciones al cargar: DnaLen y genenum") {
  World w;
  const int a = RobScriptLoadSim(
      w.sim,
      "cond start 1 100 store stop start 2 101 store stop "
      "cond 1 2 > start 3 102 store stop",
      "V05.txt");
  REQUIRE(a > 0);
  CHECK(w.sim.rob[a].mem[addr::DnaLenSys] == 21);  // indice del primer end
                                                   // (20 tokens + end)
  CHECK(w.sim.rob[a].mem[addr::DnaLenSys] == w.sim.rob[a].DnaLen);
  CHECK(w.sim.rob[a].mem[addr::GenesSys] == 3);
}

// ---------------------------------------------------------------------------
TEST_CASE("M-11 normalizacion in place de comandos") {
  SUBCASE("sharenrg: Mod 100 en la celda; 0 -> 100") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    const int b = w.spawn("stop", "B.txt", 1250, 1000);
    REQUIRE(maketie(w.sim, a, b, 300, 100, 1));
    w.sim.rob[a].nrg = 1000.0f;
    w.sim.rob[b].nrg = 1000.0f;

    w.sim.rob[a].mem[830] = 250;
    sharenrg(w.sim, a, 1);
    CHECK(w.sim.rob[a].mem[830] == 50);  // 250 Mod 100

    w.sim.rob[a].mem[830] = 300;
    sharenrg(w.sim, a, 1);
    CHECK(w.sim.rob[a].mem[830] == 100);  // 300 Mod 100 = 0 -> 100
    CHECK(w.sim.rob[a].nrg ==
          doctest::Approx(1990.0));  // se llevo todo menos el 1% del traspaso
    CHECK(w.sim.rob[b].nrg == doctest::Approx(0.0));
  }
  SUBCASE("en el tick, Update_Ties consume las celdas de sharing (830 = 0)") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    const int b = w.spawn("stop", "B.txt", 1250, 1000);
    REQUIRE(maketie(w.sim, a, b, 300, 100, 1));
    w.sim.rob[a].Multibot = true;
    w.sim.rob[a].mem[830] = 250;
    w.tick();
    CHECK(w.sim.rob[a].mem[830] == 0);
  }
  SUBCASE("shareslime: clamp a 0..99 en la celda") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    const int b = w.spawn("stop", "B.txt", 1250, 1000);
    REQUIRE(maketie(w.sim, a, b, 300, 100, 1));
    w.sim.rob[a].mem[833] = 250;
    shareslime(w.sim, a, 1);
    CHECK(w.sim.rob[a].mem[833] == 99);
  }
  SUBCASE("aimshoot: Mod 1256 al disparar y consumo") {
    Sim sim;
    InjectedRnd rng({0.5f, 0.5f});  // Random(-2,2) y Random(-20,20) -> 0
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
    sim.rob[1].exist = true;
    sim.rob[1].nrg = 1000.0f;
    sim.rob[1].body = 1000.0f;
    sim.rob[1].FName = "A.txt";
    sim.rob[1].radius = FindRadius(sim, 1);
    sim.MaxRobs = 1;
    sim.rob[1].mem[addr::shoot] = 205;
    sim.rob[1].mem[addr::aimshoot] = 1500;

    robshoot(sim, 1);

    CHECK(sim.rob[1].mem[addr::aimshoot] == 0);  // consumido tras normalizar
    // ShAngle = aim - (1500 Mod 1256)/200 = -1.22: la velocidad del shot
    // evidencia el 244 normalizado en la celda.
    const Shot& s = sim.Shots[1];
    REQUIRE(s.exist);
    const double sh = -244.0 / 200.0;
    CHECK(s.velocity.x == doctest::Approx(40.0 * std::cos(sh)).epsilon(1e-5));
    CHECK(s.velocity.y == doctest::Approx(-40.0 * std::sin(sh)).epsilon(1e-5));
  }
  SUBCASE("vshoot: negativo -> 1 en la celda (sysvar vshoot = 338)") {
    Sim sim;
    InjectedRnd rng({0.5f});  // Random(1,1256) del angulo de Vshoot
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
    sim.rob[1].exist = true;
    sim.rob[1].nrg = 1000.0f;
    sim.rob[1].body = 1000.0f;
    sim.rob[1].radius = FindRadius(sim, 1);
    sim.MaxRobs = 1;
    sim.Shots[5].exist = true;
    sim.Shots[5].stored = true;
    sim.rob[1].mem[addr::VshootSys] = -5;

    Vshoot(sim, 1, 5);

    CHECK(sim.rob[1].mem[addr::VshootSys] == 1);  // normalizado en la celda
    CHECK(sim.Shots[5].nrg == 20.0f);             // 1 * 20
    CHECK(sim.Shots[5].Range == 11.0f);           // 11 + CInt(0.5) = 11
    CHECK_FALSE(sim.Shots[5].stored);
  }
  SUBCASE("vshoot en el tick: BotDNAManipulation lo consume tras el disparo") {
    World w;
    const int a = w.spawn("stop", "A.txt", 1000, 1000);
    w.sim.Shots[5].exist = true;
    w.sim.Shots[5].stored = true;
    w.sim.rob[a].virusshot = 5;
    w.sim.rob[a].Vtimer = 1;
    w.sim.rob[a].mem[addr::VshootSys] = -5;
    w.tick();
    CHECK(w.sim.rob[a].mem[addr::VshootSys] == 0);
    CHECK(w.sim.rob[a].virusshot == 0);
  }
}

// ---------------------------------------------------------------------------
TEST_CASE("M-12 los corpses congelan sus sentidos") {
  World w;
  const int a = w.spawn("stop", "A.txt", 1000, 1000);
  const int b = w.spawn("stop", "B.txt", 1060, 1000);

  w.tick();  // contacto en P1; age 1
  REQUIRE(w.sim.rob[a].mem[addr::hitup] == 1);

  // Repel3 (M4) ya separo los bots en el tick 1: se re-solapan para que el
  // tick del corpse tenga contacto en P1 (la premisa del caso).
  w.sim.rob[a].pos = {1000.0f, 1000.0f};
  w.sim.rob[b].pos = {1060.0f, 1000.0f};

  // El bot cae a corpse en el tick siguiente (nrg < 15, age > 0).
  w.sim.rob[a].nrg = 10.0f;
  w.sim.rob[a].mem[505] = 7;  // ojo poblado: debe borrarse al formarse
  w.tick();
  REQUIRE(w.sim.rob[a].Corpse);
  CHECK(w.sim.rob[a].DisableDNA);
  CHECK(w.sim.rob[a].mem[505] == 0);        // ojos borrados una unica vez
  CHECK(w.sim.rob[a].mem[addr::hitup] == 1);  // contacto de este tick (P1)

  // Sin contacto nuevo: la pasada de EraseSenses salta al corpse.
  w.sim.rob[b].pos = {10000.0f, 10000.0f};
  w.tick();
  w.tick();
  CHECK(w.sim.rob[a].mem[addr::hitup] == 1);  // congelado
  CHECK(w.sim.rob[a].mem[addr::hit] == 1);
  // El vivo si fue borrado.
  CHECK(w.sim.rob[b].mem[addr::hit] == 0);
}
