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

// Type tie (Ties.bas:6-40). El array del bot es Ties(10): 11 slots, el 10 es
// el "slot fantasma" (34-TIES.md); maketie limita a 9 ties reales.
struct Tie {
  vb_integer Port = 0;  // valor que va en .tienum para direccionar la tie
  vb_integer pnt = 0;   // slot del bot apuntado (0 = slot libre)
  vb_integer ptt = 0;   // índice de la tie espejo en el apuntado
  vb_single ang = 0;
  vb_single bend = 0;
  bool angreg = false;
  vb_long ln = 0;
  vb_long shrink = 0;
  bool stat = false;
  vb_integer last = 0;  // >1: ciclos a destrucción; <-1: ciclos a endurecer
  vb_integer mem = 0;
  bool back = false;
  bool nrgused = false;
  bool infused = false;
  bool sharing = false;
  vb_single Fx = 0, Fy = 0;
  vb_single NaturalLength = 0;
  vb_single k = 0, b = 0;
  unsigned char type = 0;  // 0 spring (nacimiento), 3 bone (endurecida)
};

inline constexpr int MAXTIES = 10;  // Ties.bas:42

// Type robot (Robots.bas:179-357). Subconjunto que el ciclo M3 necesita;
// crece con los milestones (mutación/virus/skin quedan fuera).
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

  // --- existencia y clase ---
  bool exist = false;
  bool Veg = false;
  bool NoChlr = false;
  bool wall = false;
  bool Corpse = false;
  bool Fixed = false;
  bool View = false;
  bool NewMove = false;
  bool Dead = false;
  bool Multibot = false;
  bool CantSee = false;
  bool DisableDNA = false;
  bool DisableMovementSysvars = false;
  bool CantReproduce = false;
  bool VirusImmune = false;

  // --- física ---
  vb_single radius = 0;
  Vector BucketPos{};
  Vector vel{}, actvel{}, opos{};
  Vector ImpulseInd{}, ImpulseRes{};
  vb_single ImpulseStatic = 0;
  vb_single AddedMass = 0;
  vb_single aim = 0;
  Vector aimvector{1.0f, 0.0f};
  vb_single oaim = 0;
  vb_single ma = 0;  // momento angular
  vb_single mt = 0;
  vb_single mass = 0;

  // --- ties ---
  std::array<Tie, MAXTIES + 1> Ties{};  // Ties(0..10); el 0 no se usa... y el
                                        // 10 es el slot fantasma del fuente
  vb_single numties = 0;                // ¡Single en el original!

  // --- recursos ---
  vb_single onrg = 0;
  vb_single chloroplasts = 0;
  vb_single body = 0, obody = 0, vbody = 0;
  vb_single shell = 0, Slime = 0;
  vb_single Waste = 0, Pwaste = 0;
  vb_single poison = 0, venom = 0;
  vb_single Bouyancy = 0;

  // --- venom/poison activos ---
  bool Paralyzed = false;
  vb_single Paracount = 0;
  bool Poisoned = false;
  vb_single Poisoncount = 0;
  vb_integer Ploc = 0, Pval = 0, Vloc = 0, Vval = 0;
  vb_long Vtimer = 0;
  vb_long virusshot = 0;

  vb_integer DecayTimer = 0;
  vb_long Kills = 0;

  // --- memoria genética y firma ---
  std::array<vb_integer, 15> epimem{};   // epimem(0..14)
  std::array<vb_integer, 21> occurr{};   // occurr(0..20)

  // --- visión/contacto ---
  vb_long lastopp = 0;
  vb_integer lastopptype = 0;  // 0 bot, 1 forma, 2 borde
  Vector lastopppos{};
  vb_long lasttch = 0;

  // --- identidad y edad ---
  vb_long AbsNum = 0;
  vb_long parent = 0;
  vb_integer SonNumber = 0;
  vb_long age = 0, newage = 0;
  vb_long BirthCycle = 0;
  vb_integer generation = 0;
  std::string FName;
  vb_integer DnaLen = 0;

  // --- movimiento voluntario (display + M-02) ---
  vb_integer lastup = 0, lastdown = 0, lastleft = 0, lastright = 0;

  // --- reproducción sexual ---
  vb_integer fertilized = 0;
  std::vector<Block> spermDNA;
  vb_integer spermDNAlen = 0;

  unsigned char multibot_time = 0;
  unsigned char Chlr_Share_Delay = 0;
  unsigned char dq = 0;
};

}  // namespace db
