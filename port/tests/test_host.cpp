// Capa host (port/wasm/dbcore_api.cpp) frente a los formularios VB6: los
// casos del piloto 12 de la revision del port (spec/REVISION-PORT.md,
// RV-32..RV-37). La API se compila aqui mismo (una sola unidad de
// traduccion la incluye) y se llama como la pagina.
#include <string>

#include "doctest.h"
#include "../wasm/dbcore_api.cpp"

namespace {

// Alga Minimalis (el preset de port/web/index.html).
const char* kAlga =
    "' Alga Minimalis\n"
    "cond\n*.nrg 5000 >\nstart\n50 .repro store\nstop\n\n"
    "cond\n*.fixpos 0 =\nstart\n628 rnd 314 sub .aimdx store\nstop\nend\n";

// Tick en que VegsRepopulate descuenta su primera tanda (el cooldown baja).
int FirstRepopTick(void* h, int max) {
  for (int t = 1; t <= max; ++t) {
    const long before = S(h).cooldown;
    db_sim_tick(h);
    if (S(h).cooldown < before) return t;
  }
  return 0;
}

}  // namespace

// RV-32 — main.frm:1227-1234: sin SunOnRnd, StartSimul fija el sol en el
// campo entero (SunPosition = 0.5, SunRange = 1). El port lo dejaba en 0/0:
// un alga en el centro no recibia luz.
TEST_CASE("RV-32 - db_sim_start inicializa el sol (sin SunOnRnd)") {
  void* h = db_sim_create();
  db_sim_set_field(h, 16000, 16000);
  db_sim_set_max_energy(h, 10);
  db_sim_set_start_chlr(h, 16000);
  db_sim_start(h, 1234);
  CHECK(S(h).SunPosition == 0.5);
  CHECK(S(h).SunRange == 1.0);
  CHECK(db_sim_rng_state(h) == 0xEE3C86);  // sin RNG del preludio
  const int sp = db_sim_add_species(h, kAlga, "a.txt", 1, 1, 3000, 0, 2);
  REQUIRE(db_sim_seed_species(h, sp, 2) == 2);
  S(h).rob[1].pos.x = 8000;
  S(h).rob[2].pos.x = 500;
  const float n1 = S(h).rob[1].nrg, n2 = S(h).rob[2].nrg;
  db_sim_tick(h);
  CHECK(S(h).rob[1].nrg > n1);  // centro: con luz
  CHECK(S(h).rob[2].nrg > n2);
  db_sim_destroy(h);
}

// RV-32 — con SunOnRnd, el preludio de StartSimul entero tras el Randomize:
// skin (3 Rnd, main.frm:1211-1213), SunRange = 0.5, SunChange = Int(Rnd*3) +
// Int(Rnd*2)*10, SunPosition = Rnd, SimGUID = CLng(Rnd). Semilla 1234.
TEST_CASE("RV-32 - db_sim_start con SunOnRnd replica el preludio") {
  void* h = db_sim_create();
  db_sim_set_opt(h, 40, 1);
  db_sim_start(h, 1234);
  CHECK(S(h).SunRange == 0.5);
  CHECK(S(h).SunChange == 11);
  CHECK(S(h).SunPosition == static_cast<double>(0.499984026f));
  CHECK(S(h).opts.SimGUID == 0);  // CLng(0.126738)
  CHECK(db_sim_rng_state(h) == 0x2071E7);  // 7 extracciones
  db_sim_destroy(h);
}

// RV-32 — OptionsForm.frm:4620-4624: aplicar opciones con SunOnRnd apagado
// devuelve el sol al campo entero.
TEST_CASE("RV-32 - db_sim_options_ok normaliza el sol") {
  void* h = db_sim_create();
  db_sim_set_opt(h, 40, 1);
  db_sim_start(h, 1234);
  db_sim_options_ok(h);  // SunOnRnd sigue encendido: no toca nada
  CHECK(S(h).SunRange == 0.5);
  db_sim_set_opt(h, 40, 0);
  db_sim_options_ok(h);
  CHECK(S(h).SunPosition == 0.5);
  CHECK(S(h).SunRange == 1.0);
  db_sim_destroy(h);
}

// RV-33 — la deuda de la repoblacion y los contadores del primer ciclo son
// de startloaded (main.frm:1507-1510), no de StartSimul. Sim nueva en frio:
// cooldown 0, primera tanda en el tick 25 con RepopCooldown = 25.
TEST_CASE("RV-33 - sim nueva: la repoblacion no arrastra la deuda B-37") {
  void* h = db_sim_create();
  db_sim_set_field(h, 16000, 16000);
  db_sim_set_minvegs(h, 10);
  db_sim_set_repop(h, 1, 25);
  db_sim_start(h, 1234);
  CHECK(S(h).cooldown == 0);
  CHECK(S(h).totvegs == 0);
  CHECK(S(h).totnvegs == 0);
  CHECK(S(h).totnvegsDisplayed == 0);
  CHECK(FirstRepopTick(h, 80) == 25);
  db_sim_destroy(h);
}

// RV-33 — sim cargada: startloaded fija cooldown = -RepopCooldown,
// totnvegsDisplayed = -1, totvegs = -1 y totnvegs = Costs(DYNAMICCOSTTARGET);
// el primer tick salta la repoblacion (Master.bas:393) y la primera tanda
// llega en el tick 51.
TEST_CASE("RV-33 - sim cargada: startloaded fija la deuda y los contadores") {
  void* h = db_sim_create();
  db_sim_set_field(h, 16000, 16000);
  db_sim_set_minvegs(h, 10);
  db_sim_set_repop(h, 1, 25);
  db_sim_start(h, 1234);
  for (int t = 0; t < 30; ++t) db_sim_tick(h);
  S(h).vm.costs.v[53] = 77;
  int len = 0;
  unsigned char* buf = db_sim_save(h, &len);
  void* g = db_sim_create();
  db_sim_load(g, buf, len);
  db_free(buf);
  CHECK(S(g).cooldown == -25);
  CHECK(S(g).totvegs == -1);
  CHECK(S(g).totnvegsDisplayed == -1);
  CHECK(S(g).totnvegs == 77);
  CHECK(FirstRepopTick(g, 80) == 51);
  db_sim_destroy(g);
  db_sim_destroy(h);
}

// RV-33/RV-35 — ronda nueva: StartSimul no toca TotRunCycle ni la
// repoblacion; el host los traspasa del handle viejo tras db_sim_start.
TEST_CASE("RV-33/RV-35 - db_sim_round_carry traspasa ciclo y repoblacion") {
  void* old = db_sim_create();
  db_sim_start(old, 1234);
  S(old).opts.TotRunCycle = 4321;
  S(old).cooldown = 7;
  S(old).totvegs = 3;
  S(old).totvegsDisplayed = 4;
  S(old).totnvegs = 5;
  S(old).totnvegsDisplayed = 6;
  void* h = db_sim_create();
  db_sim_start(h, 99);
  db_sim_round_carry(h, old);
  CHECK(S(h).opts.TotRunCycle == 4321);
  CHECK(S(h).cooldown == 7);
  CHECK(S(h).totvegs == 3);
  CHECK(S(h).totvegsDisplayed == 4);
  CHECK(S(h).totnvegs == 5);
  CHECK(S(h).totnvegsDisplayed == 6);
  db_sim_destroy(h);
  db_sim_destroy(old);
}

// RV-34 — main.frm:1197-1198: `Rnd -1 : Randomize UserSeedNumber / 100`
// tambien con semilla 0 (primer Rnd 0.3328429, no el 0.7055475 del LCG sin
// reiniciar).
TEST_CASE("RV-34 - semilla 0 reinicia el LCG") {
  void* h = db_sim_create();
  db_sim_start(h, 0);
  CHECK(db_sim_rng_state(h) == 0x000086);
  CHECK(H(h).rng() == 0.332842886f);
  db_sim_destroy(h);
}

// RV-34 — UserSeedNumber es Long (CLng bancario, OptionsForm.frm:4115-4116)
// y Randomize recibe UserSeedNumber / 100.
TEST_CASE("RV-34 - semilla no entera: CLng antes de Randomize") {
  void* h = db_sim_create();
  db_sim_start(h, 1234.5);
  CHECK(S(h).opts.UserSeedNumber == 1234);
  CHECK(db_sim_rng_state(h) == 0xEE3C86);  // Randomize 12.34
  void* g = db_sim_create();
  db_sim_start(g, 1235.5);
  CHECK(S(g).opts.UserSeedNumber == 1236);
  db_sim_destroy(g);
  db_sim_destroy(h);
}

// RV-34 — la semilla de la ronda sale del LCG de la sim que termina:
// `UserSeedNumber = Rnd * 2147483647` (OptionsForm.frm:4809).
TEST_CASE("RV-34 - db_sim_round_seed toma Rnd * 2147483647 del LCG") {
  void* h = db_sim_create();
  db_sim_set_opt(h, 40, 1);
  db_sim_start(h, 1234);  // estado 2071E7 tras el preludio
  CHECK(db_sim_round_seed(h) == 2001897215.0);
  db_sim_destroy(h);
}

// RV-35 — StartNew fija TotRunCycle = -1 (OptionsForm.frm:4752): el primer
// tick es el ciclo 0.
TEST_CASE("RV-35 - sim nueva: el primer tick es el ciclo 0") {
  void* h = db_sim_create();
  db_sim_start(h, 1234);
  CHECK(db_sim_cycle(h) == -1);
  db_sim_tick(h);
  CHECK(db_sim_cycle(h) == 0);
  db_sim_destroy(h);
}

// RV-36 — TeleportForm: el slider (100..1000) fija el alto y tambien
// teleporterDefaultWidth, con el que NewTeleporter sortea la posicion
// (Teleport.bas:73-74); PollCountDown = BotsPerPoll (:461) y
// CInt(val Mod 32000) en el sondeo (:459-460). Semilla 1234, campo
// 16000 x 12000: con el slider en 1000 la posicion es (7298, 778); con el
// 300 fijo del port salia (7549, 828).
TEST_CASE("RV-36 - teleporter: el slider fija alto y sorteo; sondeo") {
  void* h = db_sim_create();
  db_sim_set_field(h, 16000, 12000);
  db_sim_start(h, 1234);
  const int i = db_sim_add_teleporter(h, 0, 0, 1000, 0, 1, 1, 1, 3, 40007);
  REQUIRE(i == 1);
  const db::Teleporter& t = S(h).Teleporters[1];
  CHECK(t.pos.x == 7298.0f);
  CHECK(t.pos.y == 778.0f);
  CHECK(t.Height == 1000.0f);
  CHECK(t.Width == 750.0f);
  CHECK(t.BotsPerPoll == 3);
  CHECK(t.InboundPollCycles == 8007);
  CHECK(t.PollCountDown == 3);
  db_sim_destroy(h);
}

// RV-37 — Stnrg = val(texto) Mod 32000 (OptionsForm.frm:3582): CLng
// bancario del operando y resto con el signo del dividendo.
TEST_CASE("RV-37 - Stnrg de especie con Mod 32000") {
  void* h = db_sim_create();
  const int a = db_sim_add_species(h, kAlga, "a.txt", 1, 0, 40000, 0, 1);
  const int b = db_sim_add_species(h, kAlga, "b.txt", 1, 0, 3000.5f, 0, 1);
  const int c = db_sim_add_species(h, kAlga, "c.txt", 1, 0, 3001.5f, 0, 1);
  CHECK(S(h).Specie[static_cast<std::size_t>(a)].Stnrg == 8000);
  CHECK(S(h).Specie[static_cast<std::size_t>(b)].Stnrg == 3000);
  CHECK(S(h).Specie[static_cast<std::size_t>(c)].Stnrg == 3002);
  db_sim_destroy(h);
}

// RV-37 — `set` de la consola: la direccion numerica pasa por SysvarTok ->
// val con CInt bancario (console.frm:362); fuera de Integer el original daba
// error 6 y aqui la API devuelve -1.
TEST_CASE("RV-37 - db_sim_sysvar_tok: direccion numerica con CInt") {
  void* h = db_sim_create();
  db_sim_start(h, 1234);
  const int sp = db_sim_add_species(h, kAlga, "a.txt", 1, 0, 3000, 0, 1);
  REQUIRE(db_sim_seed_species(h, sp, 1) == 1);
  CHECK(db_sim_sysvar_tok(h, 1, "5.5") == 6);
  CHECK(db_sim_sysvar_tok(h, 1, "6.5") == 6);
  CHECK(db_sim_sysvar_tok(h, 1, "99999") == -1);
  CHECK(db_sim_sysvar_tok(h, 1, ".nrg") == 310);
  db_sim_destroy(h);
}
