// dbcore/buckets.hpp — Quads.bas (Buckets_Module): la rejilla de particionado
// espacial. Celdas de 4000x4000 con arrays empaquetados terminados en -1;
// migración desde UpdatePosition/posto/KillRobot; clamp a la rejilla para
// bots fuera del campo (30-FISICA.md §4.1, §9.6).
// Decisión de port: el original llama Init_Buckets al (re)crear el mundo
// (main.frm:1302/1420); aquí EnsureBuckets re-inicializa la rejilla cuando no
// coincide con el campo (mismo efecto, sin UI que marque el momento).
#pragma once

#include "sim.hpp"

namespace db {

inline BucketType& BucketAt(Sim& sim, int x, int y) {
  return sim.Buckets[static_cast<std::size_t>(x) +
                     static_cast<std::size_t>(y) * sim.NumXBuckets];
}

inline void UpdateBotBucket(Sim& sim, int n);

// Quads.bas:26-27 — Int(campo / BucketSize). Un campo no finito o no
// positivo cuenta como 0 celdas (evita el cast de NaN a int, que es UB).
inline int BucketCountRaw(vb_single field) {
  const double q = std::floor(static_cast<double>(field) / BucketSize);
  if (!(q >= 1.0)) return 0;
  return static_cast<int>(q);
}

// Decisión de port PP-01 (70-CASOS-DORADOS.md §15): al menos 1 celda por
// eje. Con 0 celdas el original cae en error 9 (Add_Bot con Buckets(x, -1))
// y en el port la rejilla vacía hacía recursar EnsureBuckets -> InitBuckets
// -> UpdateBotBucket sin fin. Para campos de 4000 o más no cambia nada.
inline int BucketCount(vb_single field) {
  const int n = BucketCountRaw(field);
  return n < 1 ? 1 : n;
}

// Quads.bas:22-63 — Init_Buckets: dimensiona la rejilla, precalcula los
// adyacentes y re-registra todos los bots existentes. También fija
// MaxBotShotSeperation (main.frm:1291, mismo camino de arranque).
inline void InitBuckets(Sim& sim) {
  sim.NumXBuckets = BucketCount(sim.opts.FieldWidth);
  sim.NumYBuckets = BucketCount(sim.opts.FieldHeight);
  // PP-01: con un eje de menos de BucketSize el original hace error 9 en el
  // primer Add_Bot (Buckets(x, -1)); el port da una celda y lo registra.
  if (BucketCountRaw(sim.opts.FieldWidth) < 1 ||
      BucketCountRaw(sim.opts.FieldHeight) < 1)
    sim.diag.err9_bucket_field += 1;

  sim.Buckets.assign(
      static_cast<std::size_t>(sim.NumXBuckets) * sim.NumYBuckets,
      BucketType{});

  for (int y = 0; y <= sim.NumYBuckets - 1; ++y) {
    for (int x = 0; x <= sim.NumXBuckets - 1; ++x) {
      BucketType& bk = BucketAt(sim, x, y);
      for (int z = 1; z <= 8; ++z) bk.adjBucket[z].x = -1;
      int z = 1;
      auto set = [&](int ax, int ay) {
        bk.adjBucket[z].x = static_cast<vb_single>(ax);
        bk.adjBucket[z].y = static_cast<vb_single>(ay);
        z += 1;
      };
      if (x > 0) set(x - 1, y);                                    // izquierda
      if (x < sim.NumXBuckets - 1) set(x + 1, y);                  // derecha
      if (y > 0) set(x, y - 1);                                    // arriba
      if (y < sim.NumYBuckets - 1) set(x, y + 1);                  // abajo
      if (x > 0 && y > 0) set(x - 1, y - 1);
      if (x > 0 && y < sim.NumYBuckets - 1) set(x - 1, y + 1);
      if (x < sim.NumXBuckets - 1 && y > 0) set(x + 1, y - 1);
      if (x < sim.NumXBuckets - 1 && y < sim.NumYBuckets - 1) set(x + 1, y + 1);
    }
  }

  // main.frm:1291 — Sqr(FindRadius(0,-1)^2 + (MaxVelocity*2 + RobSize/3)^2).
  sim.MaxBotShotSeperation = static_cast<vb_single>(std::sqrt(
      std::pow(static_cast<double>(FindRadius(sim, 0, -1.0f)), 2.0) +
      std::pow(static_cast<double>(sim.opts.MaxVelocity) * 2.0 + RobSize / 3.0,
               2.0)));

  for (int x = 1; x <= sim.MaxRobs; ++x) {
    if (sim.rob[x].exist) {
      sim.rob[x].BucketPos.x = -2;
      sim.rob[x].BucketPos.y = -2;
      UpdateBotBucket(sim, x);
    }
  }
}

// Rejilla al día con el campo (ver cabecera). Barata: dos comparaciones.
inline void EnsureBuckets(Sim& sim) {
  const int nx = BucketCount(sim.opts.FieldWidth);
  const int ny = BucketCount(sim.opts.FieldHeight);
  if (sim.NumXBuckets != nx || sim.NumYBuckets != ny || sim.Buckets.empty())
    InitBuckets(sim);
}

// Quads.bas:107-134 — Add_Bot: primer hueco -1, o crece de a 5.
inline void Add_Bot(Sim& sim, int n, const Vector& pos) {
  BucketType& bk = BucketAt(sim, static_cast<int>(pos.x),
                            static_cast<int>(pos.y));
  for (int a = 1; a <= bk.size; ++a) {
    if (bk.arr[a] == -1) {
      bk.arr[a] = static_cast<vb_integer>(n);
      return;
    }
  }
  bk.arr.resize(static_cast<std::size_t>(bk.size) + 6, 0);  // ReDim Preserve
  bk.arr[bk.size + 1] = static_cast<vb_integer>(n);
  bk.arr[bk.size + 2] = -1;
  bk.arr[bk.size + 3] = -1;
  bk.arr[bk.size + 4] = -1;
  bk.arr[bk.size + 5] = -1;
  bk.size = static_cast<vb_integer>(bk.size + 5);
}

// Quads.bas:136-172 — Delete_Bot: compacta y recorta de a 50.
inline void Delete_Bot(Sim& sim, int n, const Vector& pos) {
  if (pos.x < 0 || pos.y < 0) return;  // bots nuevos: aún sin bucket
  if (pos.x > sim.NumXBuckets - 1 || pos.y > sim.NumYBuckets - 1) return;
  BucketType& bk = BucketAt(sim, static_cast<int>(pos.x),
                            static_cast<int>(pos.y));
  for (int a = 1; a <= bk.size; ++a) {
    if (bk.arr[a] == n) {
      while (bk.arr[a] != -1 && a < bk.size) {
        bk.arr[a] = bk.arr[a + 1];
        a += 1;
      }
      bk.arr[a] = -1;
      if (bk.size - a > 50 && bk.size > 55) {
        bk.arr.resize(static_cast<std::size_t>(bk.size) - 50 + 1);
        bk.size = static_cast<vb_integer>(bk.size - 50);
      }
      return;
    }
  }
}

// Quads.bas:65-105 — UpdateBotBucket: migra al bot si cambió de celda,
// clampando a la rejilla si está fuera del campo.
inline void UpdateBotBucket(Sim& sim, int n) {
  EnsureBuckets(sim);
  if (!sim.rob[n].exist) {
    Delete_Bot(sim, n, sim.rob[n].BucketPos);
    return;
  }

  Vector newbucket = sim.rob[n].BucketPos;
  bool changed = false;

  vb_single currbucket = static_cast<vb_single>(
      std::floor(static_cast<double>(sim.rob[n].pos.x) / BucketSize));
  if (currbucket < 0) currbucket = 0;
  if (currbucket >= sim.NumXBuckets)
    currbucket = static_cast<vb_single>(sim.NumXBuckets - 1);
  if (sim.rob[n].BucketPos.x != currbucket) {
    newbucket.x = currbucket;
    changed = true;
  }

  currbucket = static_cast<vb_single>(
      std::floor(static_cast<double>(sim.rob[n].pos.y) / BucketSize));
  if (currbucket < 0) currbucket = 0;
  if (currbucket >= sim.NumYBuckets)
    currbucket = static_cast<vb_single>(sim.NumYBuckets - 1);
  if (sim.rob[n].BucketPos.y != currbucket) {
    newbucket.y = currbucket;
    changed = true;
  }

  if (changed) {
    Delete_Bot(sim, n, sim.rob[n].BucketPos);
    Add_Bot(sim, n, newbucket);
    sim.rob[n].BucketPos = newbucket;
  }
}

}  // namespace db
