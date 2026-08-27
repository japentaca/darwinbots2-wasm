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

// NeoMutations.bas:7-17 — índices de los operadores de mutación (mutarray).
namespace mut {
inline constexpr int PointUP = 0;
inline constexpr int MinorDeletionUP = 1;
inline constexpr int ReversalUP = 2;
inline constexpr int InsertionUP = 3;
inline constexpr int AmplificationUP = 4;
inline constexpr int MajorDeletionUP = 5;
inline constexpr int CopyErrorUP = 6;
inline constexpr int DeltaUP = 7;
inline constexpr int TranslocationUP = 8;
inline constexpr int P2UP = 9;
inline constexpr int CE2UP = 10;
}  // namespace mut

// Type mutationprobs (varspecie.bas:2-13). La agenda/operadores reales son
// B6b; aquí el struct completo porque el registro binario del bot lo
// persiste campo a campo (60-FORMATOS.md §2).
struct Mutationprobs {
  bool Mutations = false;
  std::array<vb_single, 21> mutarray{};
  std::array<vb_single, 21> Mean{};
  std::array<vb_single, 21> StdDev{};
  vb_integer PointWhatToChange = 0;
  vb_integer CopyErrorWhatToChange = 0;
};

// NeoMutations.bas — SetDefaultLengths (medias/desvíos por operador).
inline void SetDefaultLengths(Mutationprobs& changeme) {
  using namespace mut;
  changeme.Mean[PointUP] = 3;
  changeme.StdDev[PointUP] = 1;
  changeme.Mean[DeltaUP] = 500;
  changeme.StdDev[DeltaUP] = 150;
  changeme.Mean[MinorDeletionUP] = 1;
  changeme.StdDev[MinorDeletionUP] = 0;
  changeme.Mean[InsertionUP] = 1;
  changeme.StdDev[InsertionUP] = 0;
  changeme.Mean[CopyErrorUP] = 1;
  changeme.StdDev[CopyErrorUP] = 0;
  changeme.Mean[MajorDeletionUP] = 3;
  changeme.StdDev[MajorDeletionUP] = 1;
  changeme.Mean[ReversalUP] = 3;
  changeme.StdDev[ReversalUP] = 1;
  changeme.CopyErrorWhatToChange = 80;
  changeme.PointWhatToChange = 80;
  changeme.Mean[AmplificationUP] = 250;
  changeme.StdDev[AmplificationUP] = 75;
  changeme.Mean[TranslocationUP] = 250;
  changeme.StdDev[TranslocationUP] = 75;
}

// NeoMutations.bas:1072-1102 — SetDefaultMutationRates con skipNorm = True
// (la rama del cargador binario; la rama NormMut lee el ADN de la especie y
// es de B6b): mutarray = 5000, Mean = 1, StdDev = 0, P2UP a 0 y
// SetDefaultLengths encima.
inline void SetDefaultMutationRatesSkipNorm(Mutationprobs& changeme) {
  for (int a = 0; a <= 20; ++a) {
    changeme.mutarray[a] = 5000;
    changeme.Mean[a] = 1;
    changeme.StdDev[a] = 0;
  }
  changeme.mutarray[mut::P2UP] = 0;
  SetDefaultLengths(changeme);
}

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

  // --- mutación (operadores reales en mutations.hpp desde M7) ---
  Mutationprobs Mutables{};
  vb_long Mutations = 0;
  vb_long OldMutations = 0;  // '#mutations del archivo de texto
  vb_long LastMut = 0;
  std::string LastMutDetail;
  vb_long PointMutCycle = 0;   // agenda geométrica de PointMutation
  vb_long PointMutBP = 0;      // el bp agendado
  vb_long Point2MutCycle = 0;  // agenda de PointMutation2
  vb_double MutEpiReset = 0;   // acumulador del régimen epireset
  vb_single GenMut = 0;  // DnaLen / GeneticSensitivity al cargar
  vb_single OldGD = 0;

  // --- identidad persistida (60-FORMATOS.md §2) ---
  std::string LastOwner;                     // "" -> "Local" al cargar
  std::string tag = std::string(50, '\0');   // String * 50: nace en Chr(0)
  std::array<vb_integer, 14> Skin{};         // Skin(13)
  vb_long color = 0;
  vb_integer oldBotNum = 0;  // slot al guardar; remapeo de ties al cargar
  vb_long sim = 0;           // GUID de la sim de nacimiento
  vb_integer SubSpecies = 0;

  // --- movimiento voluntario (display + M-02) ---
  vb_integer lastup = 0, lastdown = 0, lastleft = 0, lastright = 0;

  // --- reproducción sexual ---
  vb_integer fertilized = 0;
  std::vector<Block> spermDNA;
  vb_integer spermDNAlen = 0;

  unsigned char multibot_time = 0;
  unsigned char Chlr_Share_Delay = 0;
  unsigned char dq = 0;
  bool highlight = false;  // E5 (Robots.bas:318): seleccion Player Bot; no
                           // lo persiste ningun formato (el highlight de
                           // HDRoutines:2330 es el del Teleporter)
};

}  // namespace db
