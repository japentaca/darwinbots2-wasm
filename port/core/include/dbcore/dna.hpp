// dbcore/dna.hpp — representación tokenizada del ADN (20-VM.md §1) y
// metadatos derivados (§2.6).
#pragma once

#include <vector>

#include "vb.hpp"

namespace db {

// DNA.bas:10-13 — Type block. El índice 0 del array existe (fantasma (0,0)
// que el cargador nunca escribe, salvo el corrimiento de 20-VM.md §2.3); la
// ejecución empieza en el índice 1.
struct Block {
  vb_integer tipo = 0;
  vb_integer value = 0;
  bool operator==(const Block&) const = default;
};

// Categorías de token (20-VM.md §1).
namespace tok {
inline constexpr int NUMBER = 0;    // número literal
inline constexpr int DEREF = 1;     // *número
inline constexpr int BASIC = 2;     // add..over (1-14)
inline constexpr int ADVANCED = 3;  // angle..debugbool (1-14)
inline constexpr int BITWISE = 4;   // ~..>> (1-9)
inline constexpr int CONDITION = 5; // <..<= (1-10)
inline constexpr int LOGIC = 6;     // and..overbool (1-11)
inline constexpr int STORE = 7;     // store..negstore (1-14)
inline constexpr int RESERVED = 8;  // no-op
inline constexpr int FLOW = 9;      // cond/start/else/stop (1-4)
inline constexpr int MASTER = 10;   // end (1); otros values: no-op
}  // namespace tok

// Direcciones de memoria publicadas por el motor (Robots.bas:57-62).
inline constexpr int MaxMem = 1000;     // main.frm:384, Robots.bas:376
inline constexpr int DnaLenSys = 336;
inline constexpr int GenesSys = 339;
inline constexpr int thisgene = 341;

inline bool is_end(const Block& b) { return b.tipo == 10 && b.value == 1; }

// Module1.bas:64-73 — índice del primer `end` (base 1), tope 32001 y UBound.
// Guarda del port: sobre el ADN de un archivo solo-defs (array = [end], V-07)
// el original leía dna(1) fuera de rango (error 9); aquí devuelve 1.
inline vb_long DnaLen(const std::vector<Block>& dna) {
  const vb_long ub = static_cast<vb_long>(dna.size()) - 1;
  vb_long len = 1;
  while (len < ub && len <= 32000 && !is_end(dna[len])) len += 1;
  return len;
}

// Module1.bas:294-323 — cada `cond` es un gen; cada `start`/`else` que no
// sigue a un cond es un gen; `stop` cierra. Misma numeración que currgene
// (20-VM.md §5.6).
inline vb_long CountGenes(const std::vector<Block>& dna) {
  const vb_long ub = static_cast<vb_long>(dna.size()) - 1;
  vb_long genes = 0;
  bool ingene = false;
  for (vb_long i = 1; i <= 32000 && i <= ub; ++i) {
    const Block& b = dna[i];
    if (is_end(b)) break;
    if (b.tipo == tok::FLOW && (b.value == 2 || b.value == 3)) {
      if (!ingene) genes += 1;
      ingene = false;
    }
    if (b.tipo == tok::FLOW && b.value == 1) {
      ingene = true;
      genes += 1;
    }
    if (b.tipo == tok::FLOW && b.value == 4) ingene = false;
  }
  return genes;
}

// Module1.bas:334-356 — GeneEnd: última posición del gen que empieza en
// `position`. Un `stop` se incluye en el gen; un gen con `cond` absorbe el
// primer start/else que le sigue. Guarda del port: el original accede a
// dna(GeneEnd+1) y confiaba en el centinela `end`; aquí el límite ub entra
// en la condición del bucle.
inline vb_long GeneEnd(const std::vector<Block>& dna, vb_long position) {
  const vb_long ub = static_cast<vb_long>(dna.size()) - 1;
  bool condgene = false;
  vb_long ge = position;
  if (position >= 0 && position <= ub && dna[position].tipo == tok::FLOW &&
      dna[position].value == 1)
    condgene = true;
  while (ge + 1 <= 32000 && ge + 1 <= ub) {
    const Block& nx = dna[ge + 1];
    if (nx.tipo == tok::MASTER) break;  // fin de genoma
    if (nx.tipo == tok::FLOW && (nx.value == 1 || nx.value == 4)) {
      if (nx.value == 4) ge += 1;  // el stop es parte del gen
      break;
    }
    if (nx.tipo == tok::FLOW && (nx.value == 2 || nx.value == 3)) {
      if (!condgene) break;  // start/else: gen nuevo
      condgene = false;      // primer start/else tras el cond
    }
    ge += 1;
  }
  return ge;
}

// Module1.bas:366-410 — genepos: posición del gen n (0 = no encontrado).
// Misma numeración que CountGenes/currgene.
inline vb_long genepos(const std::vector<Block>& dna, vb_long n) {
  const vb_long ub = static_cast<vb_long>(dna.size()) - 1;
  bool ingene = false;
  vb_long genenum = 0;
  vb_long k = 1;
  if (n == 0) return 0;
  while (k > 0 && k <= 32000 && k <= ub) {
    const Block& b = dna[k];
    if (b.tipo == tok::FLOW && (b.value == 2 || b.value == 3)) {
      if (!ingene) {
        genenum += 1;
        if (genenum == n) return k;
      } else {
        ingene = false;
      }
    }
    if (b.tipo == tok::FLOW && b.value == 1) {
      ingene = true;
      genenum += 1;
      if (genenum == n) return k;
    }
    if (b.tipo == tok::FLOW && b.value == 4) ingene = false;
    k += 1;
    if (k <= ub && is_end(dna[k])) k = -1;
  }
  return 0;
}

// NeoMutations.bas:90-106 — Delete: corre los tokens a la izquierda y
// recorta el array a DnaLen. El `On Error GoTo step2` del original (índice
// fuera de rango al copiar) se replica cortando el bucle en ub.
inline void NmDelete(std::vector<Block>& dna, vb_long beginning,
                     vb_long elements, vb_long DNALength = -1) {
  const vb_long ub = static_cast<vb_long>(dna.size()) - 1;
  if (DNALength < 0) DNALength = DnaLen(dna);
  if (elements < 1 || beginning < 1 || beginning > DNALength - 1) return;
  for (vb_long t = beginning + elements; t <= DNALength; ++t) {
    if (t > ub || t - elements > ub) break;  // On Error GoTo step2
    dna[t - elements] = dna[t];
  }
  dna.resize(DnaLen(dna) + 1);  // ReDim Preserve dna(DnaLen(dna))
}

// NeoMutations.bas:57-60 — EraseUnit: los huecos/vaciados quedan en
// (-1,-1), NO en (0,0). Importa para las mutaciones: ChangeDNA sobre un
// hueco recién insertado ve tipo -1 (cualquier tipo nuevo vale) y value -1
// (truthy: la siembra Gauss(500,0) de Insertion sí corre).
inline constexpr Block ErasedUnit{-1, -1};

// NeoMutations.bas:62-89 — MakeSpace: abre `Length` huecos DESPUÉS de
// `beginning` (beginning no se mueve); False si no cabe (tope 32000) o los
// límites son inválidos. Los huecos quedan en (-1,-1) — EraseUnit.
inline bool MakeSpace(std::vector<Block>& dna, vb_long beginning,
                      vb_long Length, vb_long DNALength = -1) {
  if (DNALength < 0) DNALength = DnaLen(dna);
  if (Length < 1 || beginning < 0 || beginning > DNALength - 1 ||
      DNALength + Length > 32000)
    return false;

  dna.resize(static_cast<std::size_t>(DNALength + Length) + 1);
  for (vb_long t = DNALength + 1; t <= DNALength + Length; ++t)
    dna[t] = ErasedUnit;
  for (vb_long t = DNALength; t >= beginning + 1; --t) {
    dna[t + Length] = dna[t];
    dna[t] = ErasedUnit;
  }
  return true;
}

// NeoMutations.bas:1062-1070 — DeleteSpecificGene. Si genepos devuelve 0,
// Delete no-opea (beginning < 1), como el original.
inline void DeleteSpecificGene(std::vector<Block>& dna, vb_long k) {
  const vb_long i = genepos(dna, k);
  if (i < 0) return;
  const vb_long f = GeneEnd(dna, i);
  NmDelete(dna, i, f - i + 1);
}

}  // namespace db
