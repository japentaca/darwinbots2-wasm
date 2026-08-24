// dbcore/bot.hpp — el estado del bot que la VM y el cargador tocan.
// Subconjunto del Type robot de Robots.bas; crece con los milestones.
#pragma once

#include <array>
#include <string>
#include <vector>

#include "common.hpp"
#include "dna.hpp"
#include "vb.hpp"

namespace db {

// Variable privada de `def` (Globals.bas:121-124; vars(1000) en Robots.bas:258).
struct Var {
  std::string name;   // case tal cual del archivo
  vb_integer value = 0;
};

struct Bot {
  std::vector<Block> dna;  // índice 0 incluido (fantasma / corrimiento §2.3)
  std::array<vb_integer, MaxMem + 1> mem{};  // mem(0..1000), Integer
  vb_single nrg = 0;
  Vector pos{};  // para angle/dist (unidades de mundo)

  // Privadas: vars[0] no se usa; vnum = próximo índice libre (arranca en 1,
  // preparerob, Module1.bas:46-48). El def nº 1001 desborda vars(1000).
  std::vector<Var> vars{1};
  vb_long vnum = 1;

  // Flags marcados solo por los stores de dos operandos (20-VM.md §7, V-12).
  std::array<bool, 4> TieAngOverwrite{};  // direcciones 480-483
  std::array<bool, 4> TieLenOverwrite{};  // direcciones 484-487

  vb_long genenum = 0;  // CountGenes al cargar
  vb_long condnum = 0;  // contado por ciclo; nadie lo lee (20-VM.md §11)
};

}  // namespace db
