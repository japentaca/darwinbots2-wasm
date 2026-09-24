// PP — pendientes posteriores al plan de extensiones (70-CASOS-DORADOS.md
// §15). PP-01/PP-02: la rejilla de Quads.bas con un campo de menos de
// BucketSize (4000) en algún eje.
//
// En el original, Int(FieldHeight / 4000) = 0 deja NumYBuckets = 0
// (Quads.bas:26-27); UpdateBotBucket clampa la celda a NumYBuckets - 1 = -1
// (:91) y Add_Bot indexa Buckets(x, -1) (:115): error 9 en el primer
// preparerob (Module1.bas:39), sin handler en el camino de StartSimul. La UI
// del original no llega ahí (slider 1..25: F1 = 9237x6928, el menor tamaño
// normal es 8000x6000, OptionsForm.frm:4083-4097); solo un archivo editado.
// En el port el campo es libre (E1) y la rejilla vacía hacía que
// EnsureBuckets (construcción del port) re-inicializara en cada llamada,
// también desde el re-registro de InitBuckets: recursión infinita.
// Decisión de port: al menos 1 celda por eje + SimDiag::err9_bucket_field.
#include <limits>
#include <string>

#include "doctest.h"
#include "dbcore/master.hpp"

using namespace db;

namespace {

const char* kAlga =
    "cond\n*.nrg 5000 >\nstart\n50 .repro store\nstop\n"
    "cond\n*.fixpos 0 =\nstart\n628 rnd 314 sub .aimdx store\nstop\nend\n";

struct Field {
  VbRng rng;
  Sim sim;
  Field(float w, float h) {
    sim.rndy = &rng;
    sim.vm.rndy = &rng;
    sim.opts.FieldWidth = w;
    sim.opts.FieldHeight = h;
    InitBuckets(sim);  // main.frm:1302, antes de loadrobs
    sim.cooldown = -sim.opts.RepopCooldown;
  }
};

// El bot figura exactamente una vez en la celda de su BucketPos, y la celda
// está dentro de la rejilla.
int registrations(Sim& sim, int n) {
  const Vector p = sim.rob[n].BucketPos;
  if (p.x < 0 || p.y < 0 || p.x > sim.NumXBuckets - 1 ||
      p.y > sim.NumYBuckets - 1)
    return -1;
  BucketType& bk = BucketAt(sim, static_cast<int>(p.x), static_cast<int>(p.y));
  int c = 0;
  for (int a = 1; a <= bk.size; ++a)
    if (bk.arr[a] == n) ++c;
  return c;
}

}  // namespace

TEST_CASE("PP-01 campo de menos de 4000 en un eje: rejilla de 1 celda, "
          "siembra y ticks sin recursion") {
  struct Dim { float w, h; int nx, ny; };
  const Dim dims[] = {
      {4000.0f, 3000.0f, 1, 1},   // el caso de la página (15 algas)
      {3000.0f, 4000.0f, 1, 1},
      {8000.0f, 3999.0f, 2, 1},
      {2000.0f, 1500.0f, 1, 1},
  };
  for (const Dim& d : dims) {
    CAPTURE(d.w);
    CAPTURE(d.h);
    Field f(d.w, d.h);
    Sim& s = f.sim;
    REQUIRE(s.NumXBuckets == d.nx);
    REQUIRE(s.NumYBuckets == d.ny);
    REQUIRE(s.Buckets.size() ==
            static_cast<std::size_t>(d.nx) * static_cast<std::size_t>(d.ny));
    CHECK(s.diag.err9_bucket_field == 1);  // el Init_Buckets del arranque

    SpecieCfg cfg;
    cfg.Veg = true;
    cfg.Stnrg = 3000.0f;
    for (int t = 0; t < 15; ++t) REQUIRE(InsertFounder(s, kAlga, "Alga.txt", cfg) > 0);
    for (int n = 1; n <= 15; ++n) {
      CAPTURE(n);
      CHECK(registrations(s, n) == 1);
    }

    for (int t = 0; t < 50; ++t) UpdateSim(s);
    int alive = 0;
    for (int n = 1; n <= s.MaxRobs; ++n) {
      if (!s.rob[n].exist) continue;
      ++alive;
      CAPTURE(n);
      CHECK(registrations(s, n) == 1);
    }
    CHECK(alive >= 15);
    // EnsureBuckets no vuelve a inicializar: la rejilla ya coincide.
    CHECK(s.diag.err9_bucket_field == 1);
  }
}

TEST_CASE("PP-01b el campo se achica con bots ya sembrados: el "
          "re-registro de InitBuckets no recursa") {
  Field f(8000.0f, 6000.0f);
  Sim& s = f.sim;
  SpecieCfg cfg;
  cfg.Veg = true;
  cfg.Stnrg = 3000.0f;
  for (int t = 0; t < 15; ++t) REQUIRE(InsertFounder(s, kAlga, "Alga.txt", cfg) > 0);
  UpdateSim(s);
  CHECK(s.diag.err9_bucket_field == 0);

  // EnsureBuckets ve el campo nuevo en la próxima llamada y re-inicializa
  // con los 15 bots existentes (Quads.bas:56-62).
  s.opts.FieldWidth = 4000.0f;
  s.opts.FieldHeight = 3000.0f;
  UpdateSim(s);
  CHECK(s.NumXBuckets == 1);
  CHECK(s.NumYBuckets == 1);
  CHECK(s.diag.err9_bucket_field == 1);
  for (int n = 1; n <= s.MaxRobs; ++n) {
    if (!s.rob[n].exist) continue;
    CAPTURE(n);
    CHECK(registrations(s, n) == 1);
  }

  // Campos degenerados: no finito o no positivo => 1 celda, sin recursión.
  const float bad[] = {0.0f, -500.0f, std::numeric_limits<float>::quiet_NaN()};
  for (float v : bad) {
    CAPTURE(v);
    s.opts.FieldWidth = 8000.0f;  // rejilla 2x1 antes de cada campo malo
    s.opts.FieldHeight = 6000.0f;
    EnsureBuckets(s);
    REQUIRE(s.NumXBuckets == 2);
    s.opts.FieldWidth = v;
    s.opts.FieldHeight = v;
    const int before = s.diag.err9_bucket_field;
    EnsureBuckets(s);
    CHECK(s.NumXBuckets == 1);
    CHECK(s.NumYBuckets == 1);
    CHECK(s.diag.err9_bucket_field == before + 1);
    for (int n = 1; n <= s.MaxRobs; ++n)
      if (s.rob[n].exist) CHECK(registrations(s, n) == 1);
  }
}

TEST_CASE("PP-02 campos de 4000 o mas: rejilla del fuente, sin registro") {
  struct Dim { float w, h; int nx, ny; };
  const Dim dims[] = {
      {4000.0f, 4000.0f, 1, 1},
      {8000.0f, 6000.0f, 2, 1},    // slider 2, el menor tamaño normal
      {9237.0f, 6928.0f, 2, 1},    // F1
      {16000.0f, 12000.0f, 4, 3},  // default de MDIForm1.frm:2479-2480
  };
  for (const Dim& d : dims) {
    CAPTURE(d.w);
    Field f(d.w, d.h);
    CHECK(f.sim.NumXBuckets == d.nx);
    CHECK(f.sim.NumYBuckets == d.ny);
    CHECK(f.sim.diag.err9_bucket_field == 0);
  }
}
