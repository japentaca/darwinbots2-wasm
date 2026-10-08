// Capa host (port/wasm/dbcore_api.cpp) frente a los formularios VB6: los
// casos de los pilotos 12 y 13 de la revision del port
// (spec/REVISION-PORT.md, RV-32..RV-40). La API se compila aqui mismo (una
// sola unidad de traduccion la incluye) y se llama como la pagina.
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

// RV-33 — sim cargada: startloaded fija totnvegsDisplayed = -1, totvegs = -1
// y totnvegs = Costs(DYNAMICCOSTTARGET); cooldown arranca en 0 (corregido
// B7-4: el original lo ponia en -RepopCooldown y la primera tanda llegaba en
// el tick 51). El primer tick salta la repoblacion (Master.bas:393) y la
// primera tanda llega en el tick 26.
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
  CHECK(S(g).cooldown == 0);
  CHECK(S(g).totvegs == -1);
  CHECK(S(g).totnvegsDisplayed == -1);
  CHECK(S(g).totnvegs == 77);
  CHECK(FirstRepopTick(g, 80) == 26);
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

// ---------------------------------------------------------------------------
// Piloto 13 (worker.js): RV-38..RV-40. La parte de worker.js la cubre
// tools/rv/smoke_host.mjs.

namespace {

// Sim guardada como la arma la pagina: campo 8000x6000, repoblacion viva,
// 5 algas de la especie "Archivo.txt".
std::vector<unsigned char> SavedSim(void* h) {
  db_sim_set_field(h, 8000, 6000);
  db_sim_set_minvegs(h, 20);
  db_sim_set_repop(h, 5, 2);
  db_sim_set_max_energy(h, 40);
  db_sim_set_start_chlr(h, 3000);
  db_sim_start(h, 1234);
  const int sp = db_sim_add_species(h, kAlga, "Archivo.txt", 1, 0, 3000, 0, 5);
  REQUIRE(db_sim_seed_species(h, sp, 0) == 5);
  int len = 0;
  unsigned char* p = db_sim_save(h, &len);
  std::vector<unsigned char> v(p, p + len);
  db_free(p);
  return v;
}

// Los globales de proceso que la pagina (o el gset) fija.
void SetProcessGlobals(void* h) {
  db_sim_set_start_chlr(h, 3000);
  db_sim_set_opt(h, 92, 3);    // x_restartmode
  db_sim_set_opt(h, 93, 2);    // Disqualify
  db_sim_set_opt(h, 96, 50);   // intFindBestV2
  db_sim_set_opt(h, 97, 7);    // MinRounds
  db_sim_pb_on(h, 1);
  S(h).deadSnp.records = 4;
  S(h).deadSnp.snp = "fila\n";
  S(h).fmt.UseEpiGene = true;
}

void CheckProcessGlobals(void* h) {
  CHECK(S(h).StartChlr == 3000);
  CHECK(S(h).x_restartmode == 3);
  CHECK(S(h).Disqualify == 2);
  CHECK(S(h).intFindBestV2 == 50);
  CHECK(S(h).f1.MinRounds == 7);
  CHECK(S(h).pb.on);
  CHECK(S(h).deadSnp.records == 4);
  CHECK(S(h).deadSnp.snp == "fila\n");
  CHECK(S(h).fmt.UseEpiGene);
}

}  // namespace

// RV-39 — LoadSimulation y startloaded no tocan los globales del proceso
// (gset, F1Mode, menus, DeadRobots.snp): la carga los conserva. El port
// partia de un Sim{} y los dejaba en su default; con StartChlr = 0 los
// vegetales repoblados nacian sin cloroplastos y la repoblacion no paraba.
TEST_CASE("RV-39 - db_sim_load conserva los globales de proceso") {
  void* h = db_sim_create();
  const std::vector<unsigned char> file = SavedSim(h);
  SetProcessGlobals(h);
  db_sim_load(h, file.data(), static_cast<int>(file.size()));
  CheckProcessGlobals(h);
  // El vegetal repoblado nace con StartChlr cloroplastos (Globals.bas:434).
  db_sim_species_set_dna(h, 0, kAlga);
  const int before = S(h).MaxRobs;
  REQUIRE(FirstRepopTick(h, 5) > 0);
  REQUIRE(S(h).MaxRobs > before);
  CHECK(S(h).rob[before + 1].chloroplasts == 3000.0f);
  db_sim_destroy(h);
}

// RV-39 — StartSimul tampoco los toca: la ronda (handle nuevo) los hereda.
TEST_CASE("RV-39 - db_sim_round_carry conserva los globales de proceso") {
  void* a = db_sim_create();
  db_sim_start(a, 1234);
  SetProcessGlobals(a);
  void* b = db_sim_create();
  db_sim_start(b, 99);
  db_sim_round_carry(b, a);
  CheckProcessGlobals(b);
  db_sim_destroy(a);
  db_sim_destroy(b);
}

// RV-40 — el .sim guarda ruta + nombre de la especie, no su ADN: tras cargar
// no hay archivo hasta que el host lo encuentra por nombre.
TEST_CASE("RV-40 - la carga marca las especies sin archivo") {
  void* h = db_sim_create();
  const std::vector<unsigned char> file = SavedSim(h);
  CHECK(db_sim_species_missing(h, 0) == 0);
  db_sim_load(h, file.data(), static_cast<int>(file.size()));
  REQUIRE(db_sim_num_species(h) == 1);
  CHECK(db_sim_species_missing(h, 0) == 1);
  db_sim_species_set_dna(h, 0, kAlga);
  CHECK(db_sim_species_missing(h, 0) == 0);
  CHECK(S(h).Specie[0].dnatext == kAlga);
  db_sim_destroy(h);
}

// RV-40 — aggiungirob con el .txt ausente: RobScriptLoad falla (LoadDNA =
// False) y la especie deja de ser nativa (Globals.bas:420-424). El port
// cargaba el texto vacio como un robot sin genes.
TEST_CASE("RV-40 - repoblacion de una especie sin archivo") {
  void* h = db_sim_create();
  const std::vector<unsigned char> file = SavedSim(h);
  db_sim_load(h, file.data(), static_cast<int>(file.size()));
  REQUIRE(FirstRepopTick(h, 5) > 0);
  CHECK_FALSE(S(h).Specie[0].Native);
  int alive = 0, empty = 0;
  for (int t = 1; t <= S(h).MaxRobs; ++t)
    if (S(h).rob[t].exist) {
      ++alive;
      if (S(h).rob[t].DnaLen <= 1) ++empty;
    }
  CHECK(alive == 5);  // solo las 5 algas del archivo
  CHECK(empty == 0);
  db_sim_destroy(h);
}

// RV-40 — loadrobs con el .txt ausente: bypassThisSpecies (main.frm:1526-1529).
TEST_CASE("RV-40 - siembra de una especie sin archivo") {
  void* h = db_sim_create();
  const std::vector<unsigned char> file = SavedSim(h);
  db_sim_load(h, file.data(), static_cast<int>(file.size()));
  CHECK(db_sim_seed_species(h, 0, 2) == 0);
  CHECK_FALSE(S(h).Specie[0].Native);
  db_sim_species_set_dna(h, 0, kAlga);
  CHECK(db_sim_seed_species(h, 0, 2) == 2);
  CHECK(S(h).Specie[0].Native);
  db_sim_destroy(h);
}

// RV-40 — RobScriptLoad con el archivo ausente: posto y preparerob corren
// (y consumen su RNG) antes de que LoadDNA falle (Module1.bas:8-26).
TEST_CASE("RV-40 - RobScriptLoadSim con archivo ausente") {
  void* a = db_sim_create();
  void* b = db_sim_create();
  db_sim_start(a, 1234);
  db_sim_start(b, 1234);
  const int na = db::RobScriptLoadSim(S(a), kAlga, "x.txt");
  const int nb = db::RobScriptLoadSim(S(b), kAlga, "x.txt", true);
  CHECK(na == 1);
  CHECK(nb == -1);
  CHECK_FALSE(S(b).rob[1].exist);
  CHECK(db_sim_rng_state(a) == db_sim_rng_state(b));
  db_sim_destroy(a);
  db_sim_destroy(b);
}

// RV-40 — AddSpecie apunta a MainDir\robots, donde no hay .txt de la especie
// nueva (HDRoutines.bas:289).
TEST_CASE("RV-40 - AddSpecie marca la especie sin archivo") {
  void* h = db_sim_create();
  db_sim_start(h, 1234);
  const int sp = db_sim_add_species(h, kAlga, "a.txt", 1, 0, 3000, 0, 1);
  REQUIRE(db_sim_seed_species(h, sp, 1) == 1);
  S(h).rob[1].FName = "(1)a.txt";
  db::AddSpecieFromFile(S(h), 1, false);
  REQUIRE(db_sim_num_species(h) == 2);
  CHECK(db_sim_species_missing(h, 0) == 0);
  CHECK(db_sim_species_missing(h, 1) == 1);
  db_sim_destroy(h);
}

// RV-38 — la ronda arranca de los SimOpts en vivo, que tras una carga son
// los del archivo (MDIForm1.frm:2166-2170), y loadrobs siembra la lista de
// especies tal como quedo (main.frm:1517).
TEST_CASE("RV-38 - opciones base y especies de la ronda") {
  void* h = db_sim_create();
  const std::vector<unsigned char> file = SavedSim(h);
  void* page = db_sim_create();            // el ultimo "Start New" de la pagina
  db_sim_set_field(page, 12000, 6000);
  db_sim_set_minvegs(page, 0);
  db_sim_set_start_chlr(page, 3000);
  db_sim_load(page, file.data(), static_cast<int>(file.size()));
  CHECK(db_sim_field_width(page) == 8000);
  CHECK(db_sim_get_base(page, 0) == 20);
  CHECK(db_sim_get_base(page, 1) == 5);
  CHECK(db_sim_get_base(page, 2) == 2);
  CHECK(db_sim_get_base(page, 3) == 40);
  CHECK(db_sim_get_base(page, 4) == 3000);
  CHECK(db_sim_get_base(page, 5) == 1);
  void* r = db_sim_create();
  db_sim_start(r, 5);
  db_sim_round_species(r, page);
  REQUIRE(db_sim_num_species(r) == 1);
  char* nm = db_sim_species_name(r, 0);
  CHECK(std::string(nm) == "Archivo.txt");
  db_free(nm);
  CHECK(db_sim_species_missing(r, 0) == 1);
  CHECK(S(r).Specie[0].Skin == S(page).Specie[0].Skin);
  db_sim_species_set_dna(r, 0, kAlga);
  CHECK(db_sim_seed_species(r, 0, 0) == 5);
  db_sim_destroy(h);
  db_sim_destroy(page);
  db_sim_destroy(r);
}

// ---------------------------------------------------------------------------
// Piloto 14 ("Start New"): RV-42..RV-44. La parte de worker.js la cubre
// tools/rv/smoke_host.mjs.

namespace {

// Sim vieja con Player Bot, registro de muertos y globales de E6/evo vivos.
void* OldSimWithProcessState() {
  void* a = db_sim_create();
  db_sim_start(a, 1234);
  db_sim_pb_on(a, 1);
  REQUIRE(db_sim_pb_add_key(a, 500, 40, 0) >= 0);
  db_sim_pb_key_active(a, 0, 1);
  db_sim_pb_mouse(a, 100, 200);
  S(a).deadSnp.records = 4;
  S(a).deadSnp.started = true;
  S(a).deadSnp.snp = "fila\n";
  S(a).evo.ModeChangeCycles = 60;
  S(a).evo.energydif = 1.5;
  db_sim_graph_set_query(a, 1, "consulta");
  db_sim_graph_set(a, 1, 1, 1);  // graphsave(1)
  db_sim_graph_set(a, 1, 4, 3);  // graphfilecounter(1)
  db_sim_set_sim_start(a, "vieja");
  S(a).f1.Contests = 3;
  S(a).f1.ReStarts = 2;
  S(a).x_restartmode = 3;
  return a;
}

void* NewSim() {
  void* b = db_sim_create();
  db_sim_start(b, 99);
  db_sim_set_sim_start(b, "nueva");
  return b;
}

void CheckEvoCarried(void* b) {
  CHECK(S(b).evo.ModeChangeCycles == 60);
  CHECK(S(b).evo.energydif == 1.5);
  CHECK(S(b).evo.strGraphQuery1 == "consulta");
  CHECK(db_sim_graph_get(b, 1, 1) == 1);
  CHECK(db_sim_graph_get(b, 1, 4) == 3);
  CHECK(S(b).evo.strSimStart == "nueva");  // StartSimul lo vuelve a fijar
}

}  // namespace

// RV-42 — el Player Bot vive en el menu de MDIForm1 y en Globals.bas:15-16:
// "Start New" no lo toca. El handle nuevo nacia apagado y sin teclas.
TEST_CASE("RV-42 - db_sim_startnew_carry conserva el Player Bot") {
  void* a = OldSimWithProcessState();
  void* b = NewSim();
  db_sim_startnew_carry(b, a);
  CHECK(S(b).pb.on);
  REQUIRE(S(b).pb.keys.size() == 1);
  CHECK(S(b).pb.keys[0].memloc == 500);
  CHECK(S(b).pb.keys[0].Active);
  CHECK(S(b).pb.Mouse_loc.x == 100.0f);
  // Efecto: la tecla activa escribe en el bot con foco del mundo nuevo.
  const int sp = db_sim_add_species(b, kAlga, "Alga.txt", 1, 0, 3000, 0, 1);
  REQUIRE(db_sim_seed_species(b, sp, 0) == 1);
  db_sim_set_focus(b, 1);
  db_sim_tick(b);
  CHECK(db_sim_bot_mem(b, 1, 500) == 40);
  db_sim_destroy(a);
  db_sim_destroy(b);
}

// RV-43 — DeadRobots.snp es un archivo que AddRecord abre en Append
// (Database.bas:95-107) y StartNew_Click no borra.
TEST_CASE("RV-43 - db_sim_startnew_carry conserva el registro de muertos") {
  void* a = OldSimWithProcessState();
  void* b = NewSim();
  db_sim_startnew_carry(b, a);
  CHECK(db_sim_dead_records(b) == 4);
  CHECK(S(b).deadSnp.started);  // sin cabecera nueva
  CHECK(S(b).deadSnp.snp == "fila\n");
  db_sim_destroy(a);
  db_sim_destroy(b);
}

// RV-44 — Sim::evo (ModeChangeCycles, consultas y flags de las graficas,
// handicap evo) sigue en "Start New"; strSimStart lo fija StartSimul.
// F1State y el gset no: los reinicia StartNew_Click o los manda el panel.
TEST_CASE("RV-44 - db_sim_startnew_carry conserva Sim::evo") {
  void* a = OldSimWithProcessState();
  void* b = NewSim();
  db_sim_startnew_carry(b, a);
  CheckEvoCarried(b);
  CHECK(S(b).f1.Contests == 0);
  CHECK(S(b).f1.ReStarts == 0);
  CHECK(S(b).x_restartmode == 0);
  db_sim_destroy(a);
  db_sim_destroy(b);
}

// RV-44 — la ronda tampoco los reinicia (StartSimul no los toca).
TEST_CASE("RV-44 - db_sim_round_carry conserva Sim::evo") {
  void* a = OldSimWithProcessState();
  void* b = NewSim();
  db_sim_round_carry(b, a);
  CheckEvoCarried(b);
  db_sim_destroy(a);
  db_sim_destroy(b);
}

// Canal F1 (adaptacion de host): db_sim_f1_popcap poda a cada especie que
// pase del tope, empezando por los bots con menos nrg + body*10; la especie
// que no pasa queda intacta. Sin contest activo no hace nada.
TEST_CASE("F1 popcap - poda por especie a los mas pobres") {
  void* h = db_sim_create();
  db_sim_set_field(h, 16000, 16000);
  db_sim_start(h, 1234);
  const int a = db_sim_add_species(h, kAlga, "Alpha.txt", 0, 1, 3000, 0, 5);
  const int b = db_sim_add_species(h, kAlga, "Beta.txt", 0, 1, 3000, 0, 2);
  REQUIRE(db_sim_seed_species(h, a, 5) == 5);
  REQUIRE(db_sim_seed_species(h, b, 2) == 2);
  CHECK(db_sim_f1_popcap(h, 3) == 0);  // sin contest: no toca nada
  db_sim_set_opt(h, 91, 1);
  REQUIRE(db_sim_f1_start(h) == 2);
  db::Sim& sim = S(h);
  std::vector<int> alpha;
  for (int t = 1; t <= sim.MaxRobs; ++t)
    if (sim.rob[t].exist && sim.rob[t].FName == "Alpha.txt") alpha.push_back(t);
  REQUIRE(alpha.size() == 5);
  for (std::size_t i = 0; i < alpha.size(); ++i) {
    sim.rob[alpha[i]].nrg = 100.0f * static_cast<float>(5 - i);  // el ultimo, el mas pobre
    sim.rob[alpha[i]].body = 0.0f;
  }
  CHECK(db_sim_f1_popcap(h, 0) == 0);  // 0 = sin tope
  CHECK(db_sim_f1_popcap(h, 3) == 2);
  CHECK(sim.rob[alpha[0]].exist);
  CHECK(sim.rob[alpha[1]].exist);
  CHECK(sim.rob[alpha[2]].exist);
  CHECK_FALSE(sim.rob[alpha[3]].exist);
  CHECK_FALSE(sim.rob[alpha[4]].exist);
  int beta = 0;
  for (int t = 1; t <= sim.MaxRobs; ++t)
    if (sim.rob[t].exist && sim.rob[t].FName == "Beta.txt") ++beta;
  CHECK(beta == 2);
  CHECK(db_sim_f1_popcap(h, 3) == 0);  // ya en el tope
  db_sim_destroy(h);
}

// OptionsForm.frm:3290-3296 — AddSpecie: la especie nueva nace con las tasas
// por defecto (SetDefaultMutationRates sin skipNorm: 5000 en las 21 celdas,
// P2UP incluido, y SetDefaultLengths) y Mutations = True. db_sim_add_species
// la dejaba con la tabla vacía: sus bots no mutaban con .repro.
TEST_CASE("db_sim_add_species - tasas de mutacion por defecto, como OptionsForm") {
  void* h = db_sim_create();
  db_sim_set_field(h, 8000, 6000);
  db_sim_start(h, 1234);
  const int sp = db_sim_add_species(h, kAlga, "a.txt", 0, 0, 3000, 0, 1);
  const db::Mutationprobs& m = S(h).Specie[static_cast<std::size_t>(sp)].Mutables;
  CHECK(m.Mutations);
  for (int a = 0; a <= 20; ++a) CHECK(m.mutarray[a] == 5000);
  CHECK(m.Mean[db::mut::PointUP] == 3);
  CHECK(m.StdDev[db::mut::DeltaUP] == 150);
  REQUIRE(db_sim_seed_species(h, sp, 0) == 1);
  CHECK(S(h).rob[1].Mutables.Mutations);
  CHECK(S(h).rob[1].Mutables.mutarray[db::mut::P2UP] == 5000);
  db_sim_destroy(h);
}

// ---------------------------------------------------------------------------
// PLAN-EDITOR.md E1.2 — db_dna_trace: traza de un ciclo de ExecuteDNA sobre un
// bot descartable, en TSV (una linea por token; el formato esta en
// web2/PLAN-EDITOR.md «Formato de traza»). Capa host: no hay equivalente en
// VB6; el gancho del core se prueba en test_trace.cpp.
// ---------------------------------------------------------------------------

namespace {

// ADN de V-01, el mismo de test_trace.cpp (13 tokens).
const char* kAdnTraza = "cond *50 1 > start 7 100 store else 9 200 store stop";

// Llama al export y libera el buffer: el texto TSV (vacio = sin traza).
std::string Traza(const char* text, const int* mem = nullptr, int memLen = 0,
                  int seed = 1234) {
  char* p = db_dna_trace(text, mem, memLen, seed);
  REQUIRE(p != nullptr);
  std::string s = p;
  db_free(p);
  return s;
}

std::vector<std::string> Lineas(const std::string& tsv) {
  std::vector<std::string> out;
  std::size_t a = 0;
  while (a < tsv.size()) {
    const std::size_t nl = tsv.find('\n', a);
    out.push_back(tsv.substr(a, nl - a));
    a = nl + 1;
  }
  return out;
}

// Las 12 columnas de una linea (TAB); las vacias (ints sin nada) se conservan.
std::vector<std::string> Columnas(const std::string& linea) {
  std::vector<std::string> out;
  std::size_t a = 0;
  for (;;) {
    const std::size_t t = linea.find('\t', a);
    out.push_back(linea.substr(a, t == std::string::npos ? t : t - a));
    if (t == std::string::npos) break;
    a = t + 1;
  }
  return out;
}

bool Termina(const std::string& s, const std::string& fin) {
  return s.size() >= fin.size() &&
         s.compare(s.size() - fin.size(), fin.size(), fin) == 0;
}

}  // namespace

TEST_CASE("db_dna_trace - traza del ADN de V-01 con mem[50]=5") {
  std::vector<int> mem(1001, 0);
  mem[50] = 5;
  const std::string tsv = Traza(kAdnTraza, mem.data(), 1001);
  const std::vector<std::string> l = Lineas(tsv);
  // Misma cuenta que E1.1: un paso por token, sin el fantasma ni el `end`.
  REQUIRE(l.size() == 13);
  CHECK(tsv.back() == '\n');
  for (const std::string& ln : l) CHECK(Columnas(ln).size() == 12);

  // cond: idx 1, flujo siempre ejecutado, flujo COND (1), gen 1, pilas vacias.
  const auto c0 = Columnas(l[0]);
  CHECK(c0[0] == "1");
  CHECK(c0[1] == std::to_string(static_cast<int>(db::tok::FLOW)));
  CHECK(c0[3] == "1");
  CHECK(c0[4] == "1");
  CHECK(c0[5] == "1");
  CHECK(c0[6] == "0");
  CHECK(c0[7] == "");
  CHECK(c0[8] == "0");
  CHECK(c0[9] == "");
  CHECK(c0[10] == "0");
  CHECK(c0[11] == "0");
  // *50 apila 5; 1 queda encima (de abajo hacia arriba).
  const auto c1 = Columnas(l[1]);
  CHECK(c1[0] == "2");
  CHECK(c1[1] == std::to_string(static_cast<int>(db::tok::DEREF)));
  CHECK(c1[2] == "50");
  CHECK(c1[6] == "1");
  CHECK(c1[7] == "5");
  const auto c2 = Columnas(l[2]);
  CHECK(c2[1] == std::to_string(static_cast<int>(db::tok::NUMBER)));
  CHECK(c2[6] == "2");
  CHECK(c2[7] == "5,1");
  // > consume los dos enteros y deja un booleano verdadero (-1).
  const auto c3 = Columnas(l[3]);
  CHECK(c3[6] == "0");
  CHECK(c3[7] == "");
  CHECK(c3[8] == "1");
  CHECK(c3[9] == "-1");
  // start: cuerpo (BODY = 2), gen 1.
  const auto c4 = Columnas(l[4]);
  CHECK(c4[3] == "1");
  CHECK(c4[4] == "2");
  CHECK(c4[5] == "1");
  // El store escribe 7 en 100 y la linea termina en "\t100\t7".
  CHECK(Columnas(l[7])[1] == std::to_string(static_cast<int>(db::tok::STORE)));
  CHECK(Columnas(l[7])[3] == "1");
  CHECK(Termina(l[7], "\t100\t7"));
  // La rama else (9 200 store) no corre y no deja rastro de escritura.
  for (int k = 9; k <= 11; ++k) {
    const auto c = Columnas(l[static_cast<std::size_t>(k)]);
    CHECK(c[3] == "0");
    CHECK(c[10] == "0");
    CHECK(c[11] == "0");
  }
  CHECK(Termina(l[11], "\t0\t0"));
}

TEST_CASE("db_dna_trace - sin memoria es todo cero, y la rama else corre") {
  const std::vector<std::string> l = Lineas(Traza(kAdnTraza));
  REQUIRE(l.size() == 13);
  // *50 vale 0: el comparador deja un booleano falso y start deja el flujo en
  // CLEAR (0); el cuerpo no corre.
  CHECK(Columnas(l[3])[9] == "0");
  CHECK(Columnas(l[4])[4] == "0");
  CHECK(Columnas(l[7])[3] == "0");
  CHECK(Columnas(l[7])[10] == "0");
  // else (ELSEBODY = 3) y su store: escribe 9 en 200.
  CHECK(Columnas(l[8])[4] == "3");
  CHECK(Termina(l[11], "\t200\t9"));
}

TEST_CASE("db_dna_trace - la pila de enteros se recorta a 8 entradas") {
  const std::vector<std::string> l =
      Lineas(Traza("cond start 1 2 3 4 5 6 7 8 9 10 11 12 stop"));
  REQUIRE(l.size() == 15);
  const auto last = Columnas(l.back());
  CHECK(last[6] == "12");
  CHECK(last[7] == "5,6,7,8,9,10,11,12");
}

TEST_CASE("db_dna_trace - memoria: indice 0 ignorado, largo corto, acotada") {
  SUBCASE("memLen corta: lo que sobra de 1001 queda en cero") {
    std::vector<int> mem(1001, 0);
    mem[50] = 5;
    mem[60] = 9;
    const std::vector<std::string> l =
        Lineas(Traza("cond start *50 *60 stop", mem.data(), 51));
    REQUIRE(l.size() == 5);
    CHECK(Columnas(l[3])[7] == "5,0");  // mem[60] no se copio
  }
  SUBCASE("mem[0] se ignora y los valores se acotan a Integer") {
    std::vector<int> mem(1001, 0);
    mem[0] = 77;
    mem[10] = 100000;
    mem[11] = -100000;
    const std::vector<std::string> l =
        Lineas(Traza("cond start *10 *11 stop", mem.data(), 1001));
    REQUIRE(l.size() == 5);
    CHECK(Columnas(l[3])[7] == "32767,-32768");
  }
  SUBCASE("sin memoria quedan las sysvars que publica el cargador") {
    // RobScriptLoad: mem(336) = DnaLen, mem(339) = CountGenes.
    const std::vector<std::string> l =
        Lineas(Traza("cond start *.genes stop"));
    REQUIRE(l.size() == 4);
    CHECK(Columnas(l[2])[7] == "1");
    // Con memoria, lo que pasa el llamador es lo que el gen lee: la pagina
    // muestra los mismos numeros que usa la traza.
    std::vector<int> mem(1001, 0);
    const std::vector<std::string> m =
        Lineas(Traza("cond start *.genes stop", mem.data(), 1001));
    CHECK(Columnas(m[2])[7] == "0");
  }
}

TEST_CASE("db_dna_trace - ADN rechazado, texto nulo y semilla") {
  SUBCASE("def malformado: el cargador rechaza el archivo") {
    CHECK(Traza("def x").empty());
    CHECK(Traza("cond start 1 stop\ndef x").empty());
    CHECK(Traza("def y 40000").empty());  // literal fuera de Integer (error 6)
  }
  SUBCASE("texto nulo o vacio no da traza ni rompe") {
    char* p = db_dna_trace(nullptr, nullptr, 0, 1234);
    REQUIRE(p != nullptr);
    CHECK(std::string(p).empty());
    db_free(p);
    CHECK(Traza("").empty());
  }
  SUBCASE("rnd es determinista por semilla y no toca ninguna sim") {
    void* h = db_sim_create();
    db_sim_start(h, 1234);
    const auto estado = db_sim_rng_state(h);
    const std::string a = Traza("cond start 628 rnd 100 store stop", nullptr, 0, 1234);
    const std::string b = Traza("cond start 628 rnd 100 store stop", nullptr, 0, 1234);
    const std::string c = Traza("cond start 628 rnd 100 store stop", nullptr, 0, 4321);
    CHECK_FALSE(a.empty());
    CHECK(a == b);
    CHECK(a != c);
    CHECK(db_sim_rng_state(h) == estado);
    db_sim_destroy(h);
  }
}

// ---------------------------------------------------------------------------
// PLAN-EDITOR.md E2.1 — traza del bot con foco (db_sim_trace_on /
// db_sim_bot_trace) y volcado de memoria (db_sim_bot_mem_dump). Capa host sobre
// el gancho de ExecRobs (sim.traceSink): la traza es la del ultimo ciclo del bot
// con foco, con una cabecera `#\tciclo\tn\tgenenum`. Solo lee: la sim evoluciona
// igual con la traza encendida.
// ---------------------------------------------------------------------------

namespace {

// Sim recien arrancada con `qty` bots del ADN de la traza (slots 1..qty).
void* SimConBotsDeTraza(int qty) {
  void* h = db_sim_create();
  db_sim_start(h, 1234);
  const int sp = db_sim_add_species(h, kAdnTraza, "t.txt", 0, 1, 3000, 0, qty);
  REQUIRE(db_sim_seed_species(h, sp, qty) == qty);
  return h;
}

// db_sim_bot_trace como lo llama la pagina: texto TSV (vacio = sin traza).
std::string TrazaBot(void* h, int n) {
  char* p = db_sim_bot_trace(h, n);
  REQUIRE(p != nullptr);
  std::string s = p;
  db_free(p);
  return s;
}

}  // namespace

TEST_CASE("db_sim_bot_trace - traza del bot con foco, con cabecera") {
  void* h = SimConBotsDeTraza(1);
  db_sim_set_focus(h, 1);
  db_sim_trace_on(h, 1);
  db_sim_bot_set_mem(h, 1, 50, 5);
  // Encendida pero sin ciclo corrido: no hay nada que mostrar.
  CHECK(TrazaBot(h, 1).empty());
  db_sim_tick(h);
  const std::string tsv = TrazaBot(h, 1);
  const std::vector<std::string> l = Lineas(tsv);
  REQUIRE(l.size() >= 12);  // cabecera + al menos 11 pasos
  CHECK(tsv.compare(0, 2, "#\t") == 0);
  CHECK(tsv.back() == '\n');
  // Cabecera: ciclo de la sim, bot, cantidad de genes (la misma que el export
  // que lee el inspector).
  CHECK(l[0] == "#\t" + std::to_string(db_sim_cycle(h)) + "\t1\t" +
                    std::to_string(db_sim_bot_genenum(h, 1)));
  CHECK(db_sim_cycle(h) == 0);
  CHECK(db_sim_bot_genenum(h, 1) == 2);
  // Los pasos son los del formato de traza, uno por token (13), idx desde 1.
  REQUIRE(l.size() == 14);
  for (std::size_t k = 1; k < l.size(); ++k) {
    const auto c = Columnas(l[k]);
    REQUIRE(c.size() == 12);
    CHECK(c[0] == std::to_string(k));
  }
  // Con mem[50] = 5 el store escribe 7 en 100; la rama else no corre.
  CHECK(Columnas(l[8])[1] == std::to_string(static_cast<int>(db::tok::STORE)));
  CHECK(Termina(l[8], "\t100\t7"));
  CHECK(Columnas(l[10])[3] == "0");
  db_sim_destroy(h);
}

TEST_CASE("db_sim_bot_trace - solo el bot con foco y nunca una traza vieja") {
  void* h = SimConBotsDeTraza(2);
  db_sim_set_focus(h, 1);
  db_sim_trace_on(h, 1);
  db_sim_tick(h);
  CHECK_FALSE(TrazaBot(h, 1).empty());
  CHECK(TrazaBot(h, 2).empty());  // n != robfocus
  // El foco cambia sin que corra un ciclo: la traza guardada es del bot 1 y no
  // se entrega rotulada como la del 2 (ni como la del 1, que ya no tiene foco).
  db_sim_set_focus(h, 2);
  CHECK(TrazaBot(h, 2).empty());
  CHECK(TrazaBot(h, 1).empty());
  db_sim_tick(h);
  const std::vector<std::string> l = Lineas(TrazaBot(h, 2));
  REQUIRE(l.size() == 14);
  CHECK(l[0] == "#\t" + std::to_string(db_sim_cycle(h)) + "\t2\t2");
  CHECK(db_sim_cycle(h) == 1);
  // Sin foco no hay traza; fuera de rango tampoco.
  db_sim_set_focus(h, 0);
  CHECK(TrazaBot(h, 2).empty());
  CHECK(TrazaBot(h, 0).empty());
  CHECK(TrazaBot(h, -1).empty());
  CHECK(TrazaBot(h, 99999).empty());
  // Volver a encender descarta la traza guardada.
  db_sim_set_focus(h, 2);
  CHECK_FALSE(TrazaBot(h, 2).empty());
  db_sim_trace_on(h, 1);
  CHECK(TrazaBot(h, 2).empty());
  db_sim_destroy(h);
}

TEST_CASE("db_sim_bot_trace - apagada no registra, y un bot sin ADN activo tampoco") {
  void* h = SimConBotsDeTraza(1);
  db_sim_set_focus(h, 1);
  SUBCASE("sin encender") {
    CHECK(S(h).traceSink == nullptr);
    db_sim_tick(h);
    CHECK(TrazaBot(h, 1).empty());
  }
  SUBCASE("encendida y despues apagada") {
    db_sim_trace_on(h, 1);
    CHECK(S(h).traceSink != nullptr);
    db_sim_tick(h);
    CHECK_FALSE(TrazaBot(h, 1).empty());
    db_sim_trace_on(h, 0);
    CHECK(S(h).traceSink == nullptr);
    CHECK(TrazaBot(h, 1).empty());
    db_sim_tick(h);
    CHECK(TrazaBot(h, 1).empty());
  }
  SUBCASE("el bot con foco no corrio ADN este ciclo: no queda la del ciclo anterior") {
    db_sim_trace_on(h, 1);
    db_sim_tick(h);
    REQUIRE_FALSE(TrazaBot(h, 1).empty());
    S(h).rob[1].DisableDNA = true;  // ExecRobs lo salta (DNA.bas:1247)
    db_sim_tick(h);
    CHECK(TrazaBot(h, 1).empty());
  }
  db_sim_destroy(h);
}

TEST_CASE("db_sim_bot_trace - cargar una sim conserva el interruptor") {
  void* h = SimConBotsDeTraza(1);
  db_sim_trace_on(h, 1);
  int len = 0;
  unsigned char* buf = db_sim_save(h, &len);
  db_sim_load(h, buf, len);  // reemplaza el Sim entero del handle
  db_free(buf);
  CHECK(S(h).traceSink == &H(h).traza);
  db_sim_set_focus(h, 1);
  CHECK(TrazaBot(h, 1).empty());  // la traza de antes de cargar no vale
  db_sim_tick(h);
  CHECK(Lineas(TrazaBot(h, 1)).size() == 14);
  // Y apagada sigue apagada.
  db_sim_trace_on(h, 0);
  buf = db_sim_save(h, &len);
  db_sim_load(h, buf, len);
  db_free(buf);
  CHECK(S(h).traceSink == nullptr);
  db_sim_destroy(h);
}

TEST_CASE("traza del bot con foco - la sim evoluciona igual con la traza encendida") {
  // Dos sims identicas (algas con rnd en el ADN y bots de la traza). La A
  // enciende la traza y llama a los tres exports en cada ciclo; la B no. Los
  // .dbsim y el estado del LCG tienen que salir iguales byte a byte.
  auto armar = [] {
    void* h = db_sim_create();
    db_sim_set_field(h, 16000, 16000);
    db_sim_set_max_energy(h, 10);
    db_sim_set_start_chlr(h, 16000);
    db_sim_start(h, 1234);
    const int a = db_sim_add_species(h, kAlga, "a.txt", 1, 1, 3000, 0, 3);
    const int t = db_sim_add_species(h, kAdnTraza, "t.txt", 0, 1, 3000, 0, 2);
    REQUIRE(db_sim_seed_species(h, a, 3) == 3);
    REQUIRE(db_sim_seed_species(h, t, 2) == 2);
    db_sim_set_focus(h, 4);
    return h;
  };
  void* a = armar();
  void* b = armar();
  db_sim_trace_on(a, 1);
  std::vector<int> mem(1000);
  bool huboTraza = false;
  for (int c = 0; c < 40; ++c) {
    db_sim_tick(a);
    db_sim_tick(b);
    huboTraza = huboTraza || !TrazaBot(a, 4).empty();
    TrazaBot(a, 1);
    CHECK(db_sim_bot_mem_dump(a, 4, mem.data(), 1000) == 1000);
  }
  CHECK(huboTraza);
  CHECK(db_sim_rng_state(a) == db_sim_rng_state(b));
  int la = 0, lb = 0;
  unsigned char* sa = db_sim_save(a, &la);
  unsigned char* sb = db_sim_save(b, &lb);
  REQUIRE(la == lb);
  CHECK(std::memcmp(sa, sb, static_cast<std::size_t>(la)) == 0);
  db_free(sa);
  db_free(sb);
  db_sim_destroy(a);
  db_sim_destroy(b);
}

TEST_CASE("db_sim_bot_mem_dump - copia mem[1..1000] del bot") {
  void* h = SimConBotsDeTraza(1);
  db_sim_bot_set_mem(h, 1, 50, 5);
  db_sim_bot_set_mem(h, 1, 51, -123);
  db_sim_bot_set_mem(h, 1, 1000, 77);
  std::vector<int> out(1000, -999);
  CHECK(db_sim_bot_mem_dump(h, 1, out.data(), 1000) == 1000);
  CHECK(out[49] == 5);  // mem[i] es la direccion i + 1
  CHECK(out[50] == -123);
  CHECK(out[999] == 77);
  bool igual = true;  // un solo CHECK: las 1000 direcciones coinciden
  for (int a = 1; a <= 1000; ++a)
    igual = igual && out[static_cast<std::size_t>(a - 1)] == db_sim_bot_mem(h, 1, a);
  CHECK(igual);
  SUBCASE("max corto: copia solo esas direcciones") {
    std::vector<int> corto(60, -999);
    CHECK(db_sim_bot_mem_dump(h, 1, corto.data(), 10) == 10);
    CHECK(corto[9] == db_sim_bot_mem(h, 1, 10));
    CHECK(corto[10] == -999);
  }
  SUBCASE("max mayor que 1000: copia 1000 y no pasa de ahi") {
    std::vector<int> grande(1005, -999);
    CHECK(db_sim_bot_mem_dump(h, 1, grande.data(), 1005) == 1000);
    CHECK(grande[999] == 77);
    CHECK(grande[1000] == -999);
  }
  SUBCASE("el bot no existe, o los argumentos no sirven") {
    std::vector<int> v(1000, -999);
    CHECK(db_sim_bot_mem_dump(h, 2, v.data(), 1000) == 0);
    CHECK(db_sim_bot_mem_dump(h, 0, v.data(), 1000) == 0);
    CHECK(db_sim_bot_mem_dump(h, -1, v.data(), 1000) == 0);
    CHECK(db_sim_bot_mem_dump(h, 99999, v.data(), 1000) == 0);
    CHECK(db_sim_bot_mem_dump(h, 1, v.data(), 0) == 0);
    CHECK(db_sim_bot_mem_dump(h, 1, v.data(), -5) == 0);
    CHECK(db_sim_bot_mem_dump(h, 1, nullptr, 1000) == 0);
    bool intacto = true;  // ninguna de las llamadas de arriba escribio en v
    for (int x : v) intacto = intacto && x == -999;
    CHECK(intacto);
  }
  db_sim_destroy(h);
}
