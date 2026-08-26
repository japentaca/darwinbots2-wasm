// M9/M10 — Semilla de la API WASM del core (PROGRESO.md "Siguiente" M10).
// Exports minimos hacia JS: crear sim, sembrar fundadores, tick y volcado de
// estado para render. Contrato de fidelidad intacto: esta capa solo llama a
// las funciones del core; no toca aritmetica ni RNG por su cuenta.
//
// Decisiones de capa host que M10 debera completar aqui (ver PROGRESO.md):
//  - E/S de teleporters: mover los buferes sim.outbox/sim.inbox desde/hacia
//    el host (el core nunca toca disco).
//  - SimGUID ausente y colores con Rnd crudo (Q01): responsabilidad del host.
#include <cstdint>
#include <new>
#include <string>

#include "dbcore/master.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define DB_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define DB_EXPORT
#endif

namespace {

// El puñado sim + RNG real de VB6: Sim no posee su RndSource (los tests
// inyectan secuencias), asi que el handle agrupa ambos y cablea los punteros
// igual que el harness de tests (sim.rndy y sim.vm.rndy al mismo LCG).
struct SimHandle {
  db::VbRng rng;
  db::Sim sim;

  SimHandle() {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
  }
};

}  // namespace

extern "C" {

// Crea una sim con las opciones por defecto y el LCG en seed0 (&H50000).
DB_EXPORT void* db_sim_create() { return new (std::nothrow) SimHandle(); }

DB_EXPORT void db_sim_destroy(void* h) { delete static_cast<SimHandle*>(h); }

// Randomize n de VB6 (solo reemplaza los bytes medios del estado, Q02/R-01).
DB_EXPORT void db_sim_randomize(void* h, double n) {
  static_cast<SimHandle*>(h)->rng.randomize(n);
}

// Siembra un fundador desde texto de ADN. Devuelve el indice de bot (>0) o
// negativo si el cargador rechaza el ADN. veg/fixed/stnrg como en SpecieCfg.
DB_EXPORT int db_sim_insert_founder(void* h, const char* dnatext,
                                    const char* name, int veg, int fixed,
                                    float stnrg) {
  auto& S = *static_cast<SimHandle*>(h);
  db::SpecieCfg cfg;
  cfg.Veg = veg != 0;
  cfg.Fixed = fixed != 0;
  cfg.Stnrg = stnrg;
  return db::InsertFounder(S.sim, dnatext ? dnatext : "",
                           name ? name : "bot.txt", cfg);
}

// Un ciclo completo de UpdateSim (los 19 pasos del tick, 10-CICLO.md §2).
DB_EXPORT void db_sim_tick(void* h) {
  db::UpdateSim(static_cast<SimHandle*>(h)->sim);
}

DB_EXPORT int db_sim_cycle(void* h) {
  return static_cast<int>(static_cast<SimHandle*>(h)->sim.opts.TotRunCycle);
}

DB_EXPORT int db_sim_total_robots(void* h) {
  return static_cast<SimHandle*>(h)->sim.TotalRobots;
}

DB_EXPORT int db_sim_max_robs(void* h) {
  return static_cast<SimHandle*>(h)->sim.MaxRobs;
}

DB_EXPORT int db_sim_field_width(void* h) {
  return static_cast<int>(static_cast<SimHandle*>(h)->sim.opts.FieldWidth);
}

DB_EXPORT int db_sim_field_height(void* h) {
  return static_cast<int>(static_cast<SimHandle*>(h)->sim.opts.FieldHeight);
}

// Volcado de estado para render: 8 floats por bot existente
//   [indice, pos.x, pos.y, radius, aim, nrg, color RGB (Long), flags]
// flags: bit0 = Veg, bit1 = Fixed, bit2 = Corpse. Devuelve cuantos bots
// escribio (como maximo max_bots).
DB_EXPORT int db_sim_dump_bots(void* h, float* out, int max_bots) {
  const auto& sim = static_cast<SimHandle*>(h)->sim;
  int written = 0;
  for (int n = 1; n <= sim.MaxRobs && written < max_bots; ++n) {
    const auto& b = sim.rob[n];
    if (!b.exist) continue;
    float* r = out + written * 8;
    r[0] = static_cast<float>(n);
    r[1] = b.pos.x;
    r[2] = b.pos.y;
    r[3] = b.radius;
    r[4] = b.aim;
    r[5] = b.nrg;
    r[6] = static_cast<float>(b.color);
    r[7] = static_cast<float>((b.Veg ? 1 : 0) | (b.Fixed ? 2 : 0) |
                              (b.Corpse ? 4 : 0));
    ++written;
  }
  return written;
}

}  // extern "C"
