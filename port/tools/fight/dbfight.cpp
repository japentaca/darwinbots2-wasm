// dbfight — una pelea F1 (un partido de torneo) con el binario nativo, sin
// navegador. Replica la secuencia de la capa host de la web:
//  - contest.js (contestLaunch): reglas del mundo, reinicio, siembra del
//    alga de arranque y de los luchadores, censo (f1start);
//  - worker.js: resetSim, el loop de ticks (runTicks: checkGameState, tope
//    de bots por especie y tope de ciclos del host) y newRound (cada ronda
//    en un handle nuevo con la semilla que sortea la ronda que termina).
// Usa solo la API C de wasm/dbcore_api.cpp, incluida aqui como en
// tests/test_host.cpp: el core no cambia.
//
// Uso:  dbfight <pelea.cfg>      (o "-" para leerla de stdin)
// La configuracion es texto, un dato por linea, campos separados por TAB
// (tools/fight/torneo.mjs la genera con las reglas del panel de la web):
//   seed        <n>                  semilla del partido (la del campo Seed)
//   field       <ancho> <alto>
//   base        <clave> <valor>      minvegs repopamount repopcooldown
//                                    maxenergy startchlr mutations maxpop
//   opt         <id> <valor>         db_sim_set_opt (tabla de dbcore_api.cpp)
//   cost        <i> <valor>          db_sim_set_cost
//   species     <veg> <qty> <nrg> <color> <nombre> <archivo ADN>
//   cap         <ciclos> <pop|nrg>   tope de ciclos por ronda (0 = sin tope)
//   popcap      <n>                  tope de bots por especie (0 = sin tope)
//   maxcycles   <n>                  red de seguridad: ciclos totales
// La primera especie veg es el alga de arranque (newSim), el resto se
// siembra despues del reinicio (seed-species), en el orden del archivo.
//
// Salida: una linea JSON por stdout con el ganador, las victorias por
// especie y cada ronda (quien la gano, en cuantos ciclos y como: 'extinct'
// si el rival se extinguio, 'cap' si la decidio el tope de ciclos).
#include <chrono>
#include <ctime>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include "../../wasm/dbcore_api.cpp"

namespace {

struct SpeciesCfg {
  bool veg = false;
  int qty = 5;
  float nrg = 3000;
  int color = 0;
  std::string name, dna;
};

struct FightCfg {
  double seed = 0;
  double fieldW = 9237, fieldH = 6928;
  std::map<std::string, double> base;
  std::map<int, double> opts;    // ascendente, como el objeto de collectOptions
  std::map<int, double> costs;
  std::vector<SpeciesCfg> species;
  int capCycles = 0, capMode = 0, popCap = 0;
  long long maxCycles = 2000000;
};

// Ids que la ronda hereda de la sim que termina (worker.js ROUND_OPT_IDS).
const int kRoundOptIds[] = {1, 2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
                            20, 21, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
                            40, 41, 50, 51, 52, 53, 54, 55, 56, 60, 61, 62,
                            63, 64, 70, 71, 72, 80, 81, 82, 83, 84, 85, 110,
                            111, 112};

std::vector<std::string> SplitTabs(const std::string& line) {
  std::vector<std::string> out;
  std::string cur;
  for (char c : line) {
    if (c == '\t') { out.push_back(cur); cur.clear(); }
    else if (c != '\r') cur += c;
  }
  out.push_back(cur);
  return out;
}

bool ReadFile(const std::string& path, std::string& out) {
  std::ifstream f(path, std::ios::binary);
  if (!f) return false;
  std::ostringstream ss;
  ss << f.rdbuf();
  out = ss.str();
  return true;
}

std::string ParseCfg(std::istream& in, FightCfg& c) {
  std::string line;
  int n = 0;
  while (std::getline(in, line)) {
    ++n;
    if (line.empty() || line[0] == '#') continue;
    const auto f = SplitTabs(line);
    const std::string& k = f[0];
    const auto need = [&](std::size_t m) { return f.size() >= m; };
    try {
      if (k == "seed" && need(2)) c.seed = std::stod(f[1]);
      else if (k == "field" && need(3)) { c.fieldW = std::stod(f[1]); c.fieldH = std::stod(f[2]); }
      else if (k == "base" && need(3)) c.base[f[1]] = std::stod(f[2]);
      else if (k == "opt" && need(3)) c.opts[std::stoi(f[1])] = std::stod(f[2]);
      else if (k == "cost" && need(3)) c.costs[std::stoi(f[1])] = std::stod(f[2]);
      else if (k == "cap" && need(3)) { c.capCycles = std::stoi(f[1]); c.capMode = f[2] == "nrg" ? 1 : 0; }
      else if (k == "popcap" && need(2)) c.popCap = std::stoi(f[1]);
      else if (k == "maxcycles" && need(2)) c.maxCycles = std::stoll(f[1]);
      else if (k == "species" && need(7)) {
        SpeciesCfg s;
        s.veg = f[1] == "1";
        s.qty = std::stoi(f[2]);
        s.nrg = std::stof(f[3]);
        s.color = std::stoi(f[4]);
        s.name = f[5];
        if (!ReadFile(f[6], s.dna)) return "line " + std::to_string(n) + ": cannot read " + f[6];
        c.species.push_back(s);
      } else return "line " + std::to_string(n) + ": unknown or incomplete '" + k + "'";
    } catch (...) {
      return "line " + std::to_string(n) + ": bad number";
    }
  }
  return "";
}

std::string JsonStr(const std::string& s) {
  std::string o = "\"";
  for (unsigned char c : s) {
    if (c == '"' || c == '\\') { o += '\\'; o += static_cast<char>(c); }
    else if (c < 0x20) { char b[8]; std::snprintf(b, sizeof b, "\\u%04x", c); o += b; }
    else o += static_cast<char>(c);
  }
  return o + "\"";
}

// StartSimul de la web: fecha "dd/mm/yyyy hh:mm:ss" de E7 (solo informativa).
std::string NowSimStart() {
  const std::time_t t = std::time(nullptr);
  char b[32];
  std::strftime(b, sizeof b, "%d/%m/%Y %H:%M:%S", std::localtime(&t));
  return b;
}

// seedSpecies de worker.js: registrar la especie, su skin y sembrarla.
void SeedSpecies(void* sim, const SpeciesCfg& s) {
  const int idx = db_sim_add_species(sim, s.dna.c_str(), s.name.c_str(),
                                     s.veg ? 1 : 0, 0, s.nrg, s.color, s.qty);
  // La skin es cosmetica (el Timer solo decide el dibujo): 0 fijo.
  db_sim_species_assign_skin(sim, idx, 0.0);
  db_sim_seed_species(sim, idx, 0);
}

// resetSim de worker.js. `old` = sim de la ronda que termina (o nullptr en
// el reinicio del partido); con `old` las especies salen de ella.
void* ResetSim(const FightCfg& c, double seed, const std::map<std::string, double>& base,
               double fw, double fh, const std::map<int, double>& opts,
               const std::map<int, double>& costs, void* old,
               const std::vector<SpeciesCfg>* first) {
  void* sim = db_sim_create();
  db_sim_set_field(sim, fw, fh);
  db_sim_set_minvegs(sim, static_cast<int>(base.at("minvegs")));
  if (base.count("maxpop")) db_sim_set_maxpop(sim, static_cast<float>(base.at("maxpop")));
  db_sim_set_repop(sim, static_cast<int>(base.at("repopamount")),
                   static_cast<int>(base.at("repopcooldown")));
  db_sim_set_max_energy(sim, static_cast<int>(base.at("maxenergy")));
  db_sim_set_start_chlr(sim, static_cast<int>(base.at("startchlr")));
  db_sim_set_mutations(sim, base.at("mutations") != 0 ? 1 : 0);
  for (const auto& [id, v] : opts) db_sim_set_opt(sim, id, v);
  for (const auto& [i, v] : costs) db_sim_set_cost(sim, i, static_cast<float>(v));
  db_sim_start(sim, seed);
  db_sim_set_sim_start(sim, NowSimStart().c_str());
  if (old) {
    db_sim_obs_carry(sim, old);
    db_sim_round_carry(sim, old);
    for (int i = 1; i <= db_sim_num_teleporters(old); ++i) db_sim_tp_copy(sim, old, i);
    db_sim_round_species(sim, old);
    db_sim_destroy(old);
    for (int i = 0; i < db_sim_num_species(sim); ++i) db_sim_seed_species(sim, i, 0);
  } else if (first) {
    for (const auto& s : *first) SeedSpecies(sim, s);
  }
  if (db_sim_get_opt(sim, 91) != 0) db_sim_f1_start(sim);
  db_sim_obs_regen(sim);
  (void)c;
  return sim;
}

std::map<std::string, double> BaseOf(void* sim) {
  return {{"minvegs", db_sim_get_base(sim, 0)},   {"repopamount", db_sim_get_base(sim, 1)},
          {"repopcooldown", db_sim_get_base(sim, 2)}, {"maxenergy", db_sim_get_base(sim, 3)},
          {"startchlr", db_sim_get_base(sim, 4)}, {"mutations", db_sim_get_base(sim, 5)},
          {"maxpop", db_sim_get_base(sim, 6)}};
}

// newRound de worker.js.
void* NewRound(const FightCfg& c, void* sim) {
  std::map<int, double> opts, costs;
  for (int id : kRoundOptIds) opts[id] = db_sim_get_opt(sim, id);
  for (int i = 0; i <= 70; ++i) costs[i] = db_sim_get_cost(sim, i);
  const int contests = db_sim_f1_contests(sim);
  const double minrounds = db_sim_get_opt(sim, 97), optminrounds = db_sim_get_opt(sim, 101);
  const int over = db_sim_f1_over(sim), restarts = db_sim_restarts_count(sim);
  const double restart = db_sim_get_opt(sim, 90), f1 = db_sim_get_opt(sim, 91),
               dq = db_sim_get_opt(sim, 93), maxrounds = db_sim_get_opt(sim, 98),
               maxcycles = db_sim_get_opt(sim, 99), maxpop = db_sim_get_opt(sim, 100);
  int wins[21];
  for (int i = 1; i <= 20; ++i) wins[i] = db_sim_f1_wins(sim, i);
  const double seed = db_sim_round_seed(sim);
  const auto base = BaseOf(sim);
  void* next = ResetSim(c, seed, base, db_sim_field_width(sim), db_sim_field_height(sim),
                        opts, costs, sim, nullptr);
  db_sim_set_opt(next, 90, restart);
  db_sim_set_opt(next, 91, f1);
  db_sim_set_opt(next, 93, dq);
  db_sim_set_opt(next, 97, optminrounds);
  db_sim_set_opt(next, 98, maxrounds);
  db_sim_set_opt(next, 99, maxcycles);
  db_sim_set_opt(next, 100, maxpop);
  db_sim_f1_restore(next, contests, static_cast<int>(minrounds),
                    static_cast<int>(optminrounds), over, restarts);
  for (int i = 1; i <= 20; ++i) db_sim_f1_set_wins(next, i, wins[i]);
  db_sim_f1_start(next);
  return next;
}

struct Round { std::string winner; long long cycles; bool cap; };

}  // namespace

int main(int argc, char** argv) {
  if (argc != 2) {
    std::fprintf(stderr, "usage: dbfight <fight.cfg | ->\n");
    return 2;
  }
  FightCfg c;
  std::string err;
  if (std::string(argv[1]) == "-") err = ParseCfg(std::cin, c);
  else {
    std::ifstream f(argv[1]);
    if (!f) { std::fprintf(stderr, "cannot open %s\n", argv[1]); return 2; }
    err = ParseCfg(f, c);
  }
  for (const char* k : {"minvegs", "repopamount", "repopcooldown", "maxenergy",
                        "startchlr", "mutations"})
    if (err.empty() && !c.base.count(k)) err = std::string("missing base ") + k;
  if (err.empty() && (c.species.empty() || !c.species[0].veg))
    err = "the first species must be the starting vegetable";
  if (!err.empty()) { std::fprintf(stderr, "dbfight: %s\n", err.c_str()); return 2; }

  const auto t0 = std::chrono::steady_clock::now();
  // Reinicio (newSim): el alga de arranque; despues los luchadores y el censo.
  const std::vector<SpeciesCfg> alga(c.species.begin(), c.species.begin() + 1);
  void* sim = ResetSim(c, c.seed, c.base, c.fieldW, c.fieldH, c.opts, c.costs,
                       nullptr, &alga);
  for (std::size_t i = 1; i < c.species.size(); ++i) SeedSpecies(sim, c.species[i]);
  const int nsp = db_sim_f1_start(sim);

  std::vector<Round> rounds;
  std::string winner, voidWhy;
  // Ciclos por ronda: Countpop pone TotRunCycle en 0 al dar la ronda por
  // ganada (F1Mode.bas:435), asi que se cuenta el ultimo ciclo visto.
  long long cycAcc = 0, total = 0, lastCyc = 0;
  bool capThisRound = false;
  if (nsp < 2) voidWhy = nsp == 1 ? "only one species in the census" : "no combat species";

  int prevWins[21] = {0};
  while (voidWhy.empty()) {
    db_sim_tick(sim);
    ++total;
    if (db_sim_cycle(sim) > 0) lastCyc = db_sim_cycle(sim);
    // checkGameState
    bool stopped = false, restarted = false;
    const int ev = db_sim_events(sim);
    if (ev) {
      if (ev & (1 << 11)) voidWhy = "only one species in the census";
      if (ev & (1 << 10)) winner = S(sim).events.f1_winner;
      stopped = (ev & 1) != 0;
      db_sim_events_clear(sim);
    }
    // Rondas ganadas en este tick (Countpop suma la victoria antes del gate).
    for (int i = 1; i <= 20; ++i) {
      const int w = db_sim_f1_wins(sim, i);
      if (w > prevWins[i]) {
        rounds.push_back({S(sim).f1.PopArray[i].SpName, lastCyc, capThisRound});
        capThisRound = false;
      }
      prevWins[i] = w;
    }
    if (!winner.empty() || !voidWhy.empty()) break;
    if (db_sim_start_another_round(sim)) {
      db_sim_clear_start_another_round(sim);
      if (!stopped) {
        cycAcc += lastCyc;
        lastCyc = 0;
        sim = NewRound(c, sim);
        capThisRound = false;
        restarted = true;
      }
    }
    if (stopped) { voidWhy = "the core stopped the simulation"; break; }
    if (!restarted) {
      if (c.popCap) db_sim_f1_popcap(sim, c.popCap);
      if (c.capCycles && db_sim_cycle(sim) > c.capCycles &&
          db_sim_f1_cap(sim, c.capMode) > 0)
        capThisRound = true;
    }
    if (total >= c.maxCycles) { voidWhy = "maxcycles reached"; break; }
  }
  const long long cycles = cycAcc + lastCyc;
  const double secs = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();

  std::ostringstream o;
  o << "{\"winner\":" << JsonStr(winner) << ",\"void\":" << JsonStr(voidWhy)
    << ",\"seed\":" << static_cast<long long>(c.seed) << ",\"cycles\":" << cycles
    << ",\"ticks\":" << total << ",\"restarts\":" << db_sim_restarts_count(sim)
    << ",\"species\":[";
  const int n = std::min(db_sim_f1_totspecies(sim), 20);
  for (int i = 1; i <= n; ++i)
    o << (i > 1 ? "," : "") << "{\"name\":" << JsonStr(S(sim).f1.PopArray[i].SpName)
      << ",\"wins\":" << db_sim_f1_wins(sim, i) << ",\"pop\":" << db_sim_f1_pop(sim, i) << "}";
  o << "],\"rounds\":[";
  for (std::size_t i = 0; i < rounds.size(); ++i)
    o << (i ? "," : "") << "{\"winner\":" << JsonStr(rounds[i].winner) << ",\"cycles\":"
      << rounds[i].cycles << ",\"how\":\"" << (rounds[i].cap ? "cap" : "extinct") << "\"}";
  char b[32];
  std::snprintf(b, sizeof b, "%.2f", secs);
  o << "],\"secs\":" << b << "}";
  std::cout << o.str() << std::endl;
  db_sim_destroy(sim);
  return 0;
}
