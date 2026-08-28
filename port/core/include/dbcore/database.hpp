// dbcore/database.hpp — Database.bas completo (E6): los dos snapshots del
// original, `Snapshot` (menú Recording → "Snapshot of the living") y
// `AddRecord` (el registro por muerte que dispara KillRobot bajo
// SimOpts.DeadRobotSnp).
//
// Decisión de port, la misma de formats.hpp (M5): el original abría archivos
// (`Open ... For Output/Append`) y el core no toca disco — aquí los dos
// "archivos" son `std::string`. Los diálogos (`SnapBrowse`, el MsgBox de "¿
// generar también el historial de mutaciones?", el "Saved snapshot
// successfully") y la barra de progreso `GraphLab` son UI y quedan fuera; el
// manejador `On Error GoTo fine` del original cubría fallos de disco que aquí
// no existen.
//
// Lo que NO es decisión sino transcripción: el formato de las líneas. VB6
// `Print #n, expr; expr;` concatena sin separador y el `;` final suprime el
// salto de línea; con todos los campos ya envueltos en `CStr` no hay relleno
// numérico de Print. La única aproximación es `CStr` sobre coma flotante
// (Single/Double), como ya se documentó para el tag de eco-IM en
// formats.hpp: %G con 7 / 15 dígitos significativos.
#pragma once

#include <cmath>
#include <cstdio>
#include <string>

#include "formats.hpp"
#include "gamemodes.hpp"
#include "sim.hpp"

namespace db {

namespace database_detail {

// CStr(Long/Integer) — exacto.
inline std::string cstr(vb_long v) { return std::to_string(v); }

// CStr(Single) / CStr(Double): VB6 emite el número en formato general con 7 y
// 15 dígitos significativos y exponente en mayúscula. Aproximación del port.
inline std::string cstr_single(vb_single v) {
  char buf[40];
  std::snprintf(buf, sizeof buf, "%.7G", static_cast<double>(v));
  return std::string(buf);
}
inline std::string cstr_double(double v) {
  char buf[64];
  std::snprintf(buf, sizeof buf, "%.15G", v);
  return std::string(buf);
}

inline const char* kSnpHeader =
    "Rob id,Parent id,Founder name,Generation,Birth cycle,Age,Mutations,"
    "New mutations,Dna length,Offspring number,kills,Fitness,Energy,"
    "Chloroplasts";
inline const char* kMutHeader = "Rob id,Mutation History";

// Database.bas:49-57 y :121-129 — el bloque de "fitness" es idéntico en los
// dos snapshots y es el mismo de Form1.fittest (main.frm:2993-3010) con
// TotalOffspring arrancando en 1. `s = score(...) + nrg + body*10` propaga en
// Double término a término (solo `body * 10` es producto Single).
inline double SnapshotFitness(const Sim& sim, int rn) {
  const double sEnergy =
      static_cast<double>(sim.intFindBestV2 > 100 ? 100 : sim.intFindBestV2) /
      100.0;
  const double sPopulation =
      static_cast<double>(sim.intFindBestV2 < 100 ? 100
                                                  : 200 - sim.intFindBestV2) /
      100.0;
  vb_long TotalOffspring = 1;
  bool Cancer = false;
  const Bot& b = sim.rob[rn];
  double s = score0(sim, rn, 1, 10, TotalOffspring, Cancer) +
             static_cast<double>(b.nrg) + static_cast<double>(b.body * 10.0f);
  if (s < 0) s = 0;
  return std::pow(static_cast<double>(TotalOffspring), sPopulation) *
         std::pow(s, sEnergy);
}

// Database.bas:59-66 / :131-138 — el ADN detokenizado que cierra el registro.
// `savingtofile = True` (las privadas no se resuelven a nombre) y el recorte
// del vbCrLf sobrante: `If Mid(d, Len(d) - 3, 2) = vbCrLf Then d = Left(d,
// Len(d) - 2)` — 1-based, o sea los dos caracteres en las posiciones L-3/L-2.
inline std::string SnapshotDna(Sim& sim, int rn) {
  std::string d = DetokenizeDNA(sim.rob[rn], *sim.sysvars, 0,
                                /*savingtofile=*/true) +
                  "\r\n";
  const std::size_t L = d.size();
  if (L >= 4 && d[L - 4] == '\r' && d[L - 3] == '\n') d.resize(L - 2);
  return d;
}

// Las dos líneas del historial de mutaciones (Database.bas:41-44 / :113-116).
//   Print #5, vbCrLf & CStr(.AbsNum); v;   -> sin salto final
//   Print #5, vbCrLf & .LastMutDetail      -> con salto final
inline void AppendMutRecord(const Bot& b, std::string& out) {
  out += "\r\n" + cstr(b.AbsNum) + ",";
  out += "\r\n" + b.LastMutDetail + "\r\n";
}

// El registro del bot en el .snp (Database.bas:46-67 / :118-139). Los cuatro
// `Print #` del fuente, con sus `;` finales:
//   1) vbCrLf & vbCrLf & AbsNum, parent, FName, generation, BirthCycle, age,
//      Mutations,                                    (sin salto)
//   2) LastMut, DnaLen, SonNumber, Kills,            (sin salto)
//   3) Fitness, nrg + body*10, chloroplasts & vbCrLf (sin salto extra)
//   4) el ADN                                        (sin salto)
inline void AppendSnpRecord(Sim& sim, int rn, std::string& out) {
  const Bot& b = sim.rob[rn];
  const std::string v = ",";
  out += "\r\n\r\n" + cstr(b.AbsNum) + v + cstr(b.parent) + v + b.FName + v +
         cstr(b.generation) + v + cstr(b.BirthCycle) + v + cstr(b.age) + v +
         cstr(b.Mutations) + v;
  out += cstr(b.LastMut) + v + cstr(b.DnaLen) + v + cstr(b.SonNumber) + v +
         cstr(b.Kills) + v;
  out += cstr_double(SnapshotFitness(sim, rn)) + v +
         cstr_single(b.nrg + b.body * 10.0f) + v +
         cstr_single(b.chloroplasts) + "\r\n";
  out += SnapshotDna(sim, rn);
}

}  // namespace database_detail

// Database.bas:89-147 — AddRecord: un registro por muerte. El gate
// DeadRobotSnp/SnpExcludeVegs vive en KillRobot (Robots.bas:2971-2977), como
// en el original. La guarda `If .DnaLen = 1 Then GoTo getout` corre DESPUÉS
// de abrir los archivos y ANTES de escribir nada: un bot de ADN vacío no deja
// registro, pero sí crea las cabeceras.
inline void AddRecord(Sim& sim, int rn) {
  using namespace database_detail;
  if (rn < 1 || rn >= static_cast<int>(sim.rob.size())) return;
  DeadSnapshot& ds = sim.deadSnp;
  if (!ds.started) {  // `If Dir(path) = ""` — cabeceras una sola vez
    ds.snp += std::string(kSnpHeader) + "\r\n";
    ds.mut += std::string(kMutHeader) + "\r\n";
    ds.started = true;
  }
  const Bot& b = sim.rob[rn];
  if (b.DnaLen == 1) return;  // Botsareus 6/16/2016 Bugfix
  AppendMutRecord(b, ds.mut);
  AppendSnpRecord(sim, rn, ds.snp);
  ds.records += 1;
}

// Database.bas:19-87 — Snapshot: el censo de los vivos bajo demanda. Devuelve
// los dos "archivos"; `withMutations` es el MsgBox vbYesNo del original.
// Nótese que la cabecera del .snp lleva su propio vbCrLf con `;` (una sola
// línea) y la del historial sale del salto implícito de Print.
struct SnapshotResult {
  std::string snp;
  std::string mut;
  vb_long records = 0;
};

inline SnapshotResult Snapshot(Sim& sim, bool withMutations = true) {
  using namespace database_detail;
  SnapshotResult r;
  r.snp += std::string(kSnpHeader) + "\r\n";
  if (withMutations) r.mut += std::string(kMutHeader) + "\r\n";
  for (int rn = 1; rn <= sim.MaxRobs; ++rn) {
    if (sim.rob[rn].exist && sim.rob[rn].DnaLen > 1) {
      if (withMutations) AppendMutRecord(sim.rob[rn], r.mut);
      AppendSnpRecord(sim, rn, r.snp);
      r.records += 1;
    }
  }
  return r;
}

}  // namespace db
