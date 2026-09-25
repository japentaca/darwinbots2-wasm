// dbcore/formats.hpp — B8: formatos de archivo (60-FORMATOS.md).
// Bot de texto (salvarob/DetokenizeDNA + gen epigenético), registro binario
// de bot (SaveRobotBody/LoadRobotBody con FileContinue y centinela 254×3) y
// las conversiones sint/Hash. Casos dorados §7 (FM-01..FM-07).
//
// E/S del port: el core WASM no toca disco — toda la E/S opera sobre búferes
// en memoria (VbBinFile / std::string). La fidelidad exigida es la del
// FORMATO de bytes/texto, no la de archivos (decisión de M5).
//
// Sitios de error / decisiones de port de este módulo:
//  - [PROBABLE BUG] B8-1: el manejador de errores de SaveSimulation se llama
//    a sí mismo (HDRoutines.bas:847-848) — recursión infinita si la ruta no
//    es escribible. En el port la escritura a búfer no puede fallar: el sitio
//    desaparece; si una capa superior (JS) falla al persistir, NO reintenta
//    (decisión de port; el formato de sim completo llega con los milestones
//    de mundo).
//  - SaveRobHeader: `totmut` es Long y la suma Mutations + OldMutations
//    puede desbordar (error 6 con chequeos). Decisión: sumar en 64 bits; el
//    cap explícito a 2e9 (:854-855) absorbe también esos desbordes.
//  - LoadRobotBody: `100000000 / TotalRobotsDisplayed` con contador 0 era
//    error 11. Decisión: umbral infinito (no se salta el campo) y se sigue.
#pragma once

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#include "loader.hpp"
#include "senses.hpp"
#include "sim.hpp"

namespace db {

// FormatGlobals (los globales de guardado del original que no viven en
// SimOpts) se define en sim.hpp desde E7: el tick los lee de Sim::fmt.

// ---------------------------------------------------------------------------
// Archivo binario de VB6 sobre un búfer en memoria. Posición 0-based
// (Seek de VB6 = pos + 1). Modo Binary: sin descriptores — Integer 2 bytes
// LE, Long 4, Single 4 (IEEE), Boolean 2 (0 / -1), String solo sus bytes.
// Get más allá del final rellena con 0 (el flujo normal nunca lo hace:
// FileContinue consulta EOF antes).
struct VbBinFile {
  std::vector<unsigned char> data;
  std::size_t pos = 0;

  bool eof() const { return pos >= data.size(); }

  void put_bytes(const void* p, std::size_t n) {
    const unsigned char* src = static_cast<const unsigned char*>(p);
    if (pos + n > data.size()) data.resize(pos + n);
    std::memcpy(data.data() + pos, src, n);
    pos += n;
  }
  void put_byte(unsigned char v) { put_bytes(&v, 1); }
  void put_i16(vb_integer v) { put_bytes(&v, 2); }
  void put_i32(vb_long v) { put_bytes(&v, 4); }
  void put_f32(vb_single v) { put_bytes(&v, 4); }
  void put_f64(vb_double v) { put_bytes(&v, 8); }
  void put_bool(bool v) { put_i16(v ? -1 : 0); }
  void put_str(const std::string& s) { put_bytes(s.data(), s.size()); }

  void get_bytes(void* p, std::size_t n) {
    unsigned char* dst = static_cast<unsigned char*>(p);
    for (std::size_t i = 0; i < n; ++i)
      dst[i] = (pos < data.size()) ? data[pos++] : (++pos, 0);
  }
  unsigned char get_byte() { unsigned char v; get_bytes(&v, 1); return v; }
  vb_integer get_i16() { vb_integer v; get_bytes(&v, 2); return v; }
  vb_long get_i32() { vb_long v; get_bytes(&v, 4); return v; }
  vb_single get_f32() { vb_single v; get_bytes(&v, 4); return v; }
  vb_double get_f64() { vb_double v; get_bytes(&v, 8); return v; }
  vb_integer get_bool_raw() { return get_i16(); }  // el crudo, para guardias
  bool get_bool() { return get_bool_raw() != 0; }
  std::string get_str(std::size_t n) {
    std::string s(n, '\0');
    get_bytes(s.data(), n);
    return s;
  }
};

// HDRoutines.bas:1979-2007 — FileContinue: sonda del centinela 254×3.
// Lee hasta 3 bytes; el primero ≠ 254 corta con True. EOF cuenta como 254.
// La posición se restaura siempre (Get #n, Position-1 deja el puntero donde
// estaba). Riesgo estructural B8-4: un campo legítimo que empiece por tres
// 254 trunca el registro — se conserva, no se "arregla" (FM-01).
inline bool FileContinue(VbBinFile& f) {
  bool cont = false;
  const std::size_t position = f.pos;
  int k = 0;
  do {
    unsigned char Fe;
    if (!f.eof())
      Fe = f.get_byte();
    else
      Fe = 254;  // rama EOF (:1990-1993)
    k += 1;
    if (Fe != 254) cont = true;
  } while (!cont && k < 3);
  f.pos = position;  // :2005-2006
  return cont;
}

// HDRoutines.bas:2594-2597 — sint: Mod 32000, NO clamp ([PROBABLE BUG] B8-2,
// FM-02). Distinto de mod32000 (N-02): los múltiplos de 32000 dan 0.
inline vb_integer sint(vb_long lval) {
  return static_cast<vb_integer>(lval % 32000);
}

// ---------------------------------------------------------------------------
// Detokenización (DNATokenizing.bas). Inversa de las tablas *Tok del
// cargador; los aliases (dupint…) NO se emiten — Detok devuelve el nombre
// canónico. Un value fuera de tabla devuelve "" (→ "VOID" en DetokenizeDNA).

namespace formats_detail {

// Str() de VB6: espacio inicial para no negativos.
inline std::string vb_str(vb_long v) {
  return (v < 0) ? std::to_string(v) : " " + std::to_string(v);
}

inline std::string BasicCommandDetok(vb_integer n) {
  switch (n) {
    case 1: return "add";   case 2: return "sub";   case 3: return "mult";
    case 4: return "div";   case 5: return "rnd";   case 6: return "*";
    case 7: return "mod";   case 8: return "sgn";   case 9: return "abs";
    case 10: return "dup";  case 11: return "drop"; case 12: return "clear";
    case 13: return "swap"; case 14: return "over"; default: return "";
  }
}

inline std::string AdvancedCommandDetok(vb_integer n, bool ismutating) {
  switch (n) {
    case 1: return "angle";  case 2: return "dist";  case 3: return "ceil";
    case 4: return "floor";  case 5: return "sqr";   case 6: return "pow";
    case 7: return "pyth";   case 8: return "anglecmp";
    case 9: return "root";   case 10: return "logx"; case 11: return "sin";
    case 12: return "cos";
    case 13: return ismutating ? "" : "debugint";
    case 14: return ismutating ? "" : "debugbool";
    default: return "";
  }
}

inline std::string BitwiseCommandDetok(vb_integer n) {
  switch (n) {
    case 1: return "~";  case 2: return "&";  case 3: return "|";
    case 4: return "^";  case 5: return "++"; case 6: return "--";
    case 7: return "-";  case 8: return "<<"; case 9: return ">>";
    default: return "";
  }
}

inline std::string ConditionsDetok(vb_integer n) {
  switch (n) {
    case 1: return "<";   case 2: return ">";   case 3: return "=";
    case 4: return "!=";  case 5: return "%=";  case 6: return "!%=";
    case 7: return "~=";  case 8: return "!~="; case 9: return ">=";
    case 10: return "<="; default: return "";
  }
}

inline std::string LogicDetok(vb_integer n) {
  switch (n) {
    case 1: return "and";      case 2: return "or";       case 3: return "xor";
    case 4: return "not";      case 5: return "true";     case 6: return "false";
    case 7: return "dropbool"; case 8: return "clearbool";
    case 9: return "dupbool";  case 10: return "swapbool";
    case 11: return "overbool"; default: return "";
  }
}

inline std::string StoresDetok(vb_integer n) {
  switch (n) {
    case 1: return "store";     case 2: return "inc";       case 3: return "dec";
    case 4: return "addstore";  case 5: return "substore";
    case 6: return "multstore"; case 7: return "divstore";
    case 8: return "ceilstore"; case 9: return "floorstore";
    case 10: return "rndstore"; case 11: return "sgnstore";
    case 12: return "absstore"; case 13: return "sqrstore";
    case 14: return "negstore"; default: return "";
  }
}

inline std::string FlowDetok(vb_integer n) {
  switch (n) {
    case 1: return "cond"; case 2: return "start"; case 3: return "else";
    case 4: return "stop"; default: return "";
  }
}

inline std::string MasterFlowDetok(vb_integer n) {
  return (n == 1) ? "end" : "";
}

}  // namespace formats_detail

// DNATokenizing.bas:296-320 — SysvarDetok: número → nombre. Recorre la tabla
// entera y gana la ÚLTIMA coincidencia; con savingtofile las privadas del
// bot NO se resuelven (el archivo usa direcciones numéricas, §1.3); si se
// resuelven, también gana la última (privada sombrea sysvar).
inline std::string SysvarDetok(vb_integer n, const Bot* bot,
                               const SysvarTable& sysvars, bool savingtofile) {
  std::string r = std::to_string(n);  // SysvarDetok = n (CStr implícito)
  for (const Var& sv : sysvars.entries) {
    if (sv.value == 0) break;  // While sysvar(t+1).value <> 0
    if (sv.value == n) r = "." + sv.name;
  }
  if (savingtofile) return r;
  if (bot != nullptr && n != 0) {  // robn > 0 And n <> 0 (:314)
    for (std::size_t t = 1; t < bot->vars.size(); ++t)
      if (bot->vars[t].value == n) r = "." + bot->vars[t].name;
  }
  return r;
}

// Parse en modo detokenizar (DNATokenizing.bas:241-273). tipo 8 devuelve ""
// — DetokenizeDNA lo convierte en "VOID" (FM-06).
inline std::string ParseDetok(const Block& bp, const Bot* bot,
                              const SysvarTable& sysvars, bool converttosysvar,
                              bool savingtofile, bool ismutating) {
  using namespace formats_detail;
  switch (bp.tipo) {
    case 0:
      return converttosysvar ? SysvarDetok(bp.value, bot, sysvars, savingtofile)
                             : std::to_string(bp.value);
    case 1: return "*" + SysvarDetok(bp.value, bot, sysvars, savingtofile);
    case 2: return BasicCommandDetok(bp.value);
    case 3: return AdvancedCommandDetok(bp.value, ismutating);
    case 4: return BitwiseCommandDetok(bp.value);
    case 5: return ConditionsDetok(bp.value);
    case 6: return LogicDetok(bp.value);
    case 7: return StoresDetok(bp.value);
    case 8: return "";  // 'nothing
    case 9: return FlowDetok(bp.value);
    case 10: return MasterFlowDetok(bp.value);
    default: return "";
  }
}

// DNATokenizing.bas:3169-3283 — DetokenizeDNA: el ADN tokenizado a texto,
// con los comentarios de gen del original (Str() con espacio inicial). La
// numeración de genes replica la de CountGenes. Un token irrepresentable
// (tipo 8, value fuera de tabla, debug* bajo ismutating) emite "VOID": al
// recargar tokeniza como (0,0) — la ida-y-vuelta NO es estable para ADN
// degenerado (FM-06, heredado A2).
inline std::string DetokenizeDNA(const Bot& bot, const SysvarTable& sysvars,
                                 vb_long Position = 0,
                                 bool savingtofile = false,
                                 bool ismutating = false) {
  using formats_detail::vb_str;
  static const std::string AP24 = "''''''''''''''''''''''''";  // 24
  static const std::string AP23 = "'''''''''''''''''''''''";   // 23
  const std::vector<Block>& dna = bot.dna;
  const vb_long ub = static_cast<vb_long>(dna.size()) - 1;

  std::string out;
  bool ingene = false, coding = false, geneEndFlag = false;
  vb_long t = 1, gene = 0, lastgene = 0;

  while (t <= ub && !is_end(dna[t])) {
    std::string temp;
    const Block& b = dna[t];

    // Cortes de gen (:3213-3242)
    if (b.tipo == 9 && (b.value == 2 || b.value == 3)) {
      if (coding && !ingene)
        out += "\r\n" + AP24 + "  Gene: " + vb_str(gene) +
               " Ends at position " + vb_str(t - 1) + "  " + AP23;
      if (!ingene)
        gene += 1;
      else
        ingene = false;
      coding = true;
    }
    if (b.tipo == 9 && b.value == 1) {
      if (coding)
        out += "\r\n" + AP24 + "  Gene: " + vb_str(gene) +
               " Ends at position " + vb_str(t - 1) + "  " + AP23 + "\r\n";
      ingene = true;
      gene += 1;
      coding = true;
    }
    if (b.tipo == 9 && b.value == 4) {
      if (coding) geneEndFlag = true;
      ingene = false;
      coding = false;
    }

    if (gene != lastgene) {  // :3243-3253
      if (gene > 1) {
        temp += "\r\n" + AP24 + "  Gene: " + vb_str(gene) +
                " Begins at position " + vb_str(t) + "  " + AP23 + "\r\n";
      } else {
        temp += "\r\n";
      }
      out += temp;
      temp.clear();
      lastgene = gene;
    }

    const bool converttosysvar = (t + 1 <= ub) && dna[t + 1].tipo == 7;
    temp = ParseDetok(b, &bot, sysvars, converttosysvar, savingtofile,
                      ismutating);
    if (temp.empty()) temp = "VOID";  // :3261 — probably a BUG! (sic)

    const vb_integer tempint = b.tipo;
    if (tempint == 5 || tempint == 6 || tempint == 7 || tempint == 9)
      temp += "\r\n";
    out += " " + temp;

    if (geneEndFlag) {  // :3270-3273
      out += AP24 + "  Gene: " + vb_str(gene) + " Ends at position " +
             vb_str(t) + "  " + AP23 + "\r\n";
      geneEndFlag = false;
    }
    if (Position > 0 && t == Position) out += " '[<POSITION MARKER]\r\n";
    t += 1;
  }
  if (t - 1 >= 0 && t - 1 <= ub &&
      !(dna[t - 1].tipo == 9 && dna[t - 1].value == 4) && coding)
    out += AP24 + "  Gene: " + vb_str(gene) + " Ends at position " +
           vb_str(t - 1) + "  " + AP23 + "\r\n";
  return out;
}

// DNATokenizing.bas:850-859 — SaveRobHeader. El cap a 2e9 es del original;
// la suma en 64 bits es decisión de port (ver cabecera: el Long del original
// desbordaba con error 6 antes de llegar al cap).
inline std::string SaveRobHeader(const Bot& bot) {
  long long totmut =
      static_cast<long long>(bot.Mutations) + bot.OldMutations;
  if (totmut > 2000000000LL) totmut = 2000000000LL;
  return "'#generation: " + std::to_string(bot.generation) +
         "\r\n'#mutations: " + std::to_string(totmut) + "\r\n";
}

// String * 50 al búfer: siempre 50 bytes (relleno Chr(0) si el estado del
// port viniera corto — en VB6 el campo es fijo por tipo).
inline std::string fixed50(std::string s) {
  s.resize(50, '\0');
  return s;
}

// HDRoutines.bas:2260-2310 — salvarob a texto. Devuelve el CONTENIDO del
// archivo (los Print #1 concatenados). El gen epigenético (UseEpiGene)
// serializa mem(971..990) como gen autodestructivo antepuesto al ADN
// (FM-03). El sidecar .mrate, el MsgBox de renombre y el diálogo son ⚙/UI y
// quedan fuera del core. OJO: Hash muta `hold` (ByRef) — el archivo lleva el
// hold ya recortado, y el hash cuadra al recargar.
inline std::string SalvarobText(Sim& sim, int n,
                                const FormatGlobals& g = {}) {
  Bot& bot = sim.rob[n];
  std::string hold = SaveRobHeader(bot);

  if (g.UseEpiGene) {
    std::string epigene;
    for (int a = 971; a <= 990; ++a)
      if (bot.mem[a] != 0)
        epigene += std::to_string(bot.mem[a]) + " " + std::to_string(a) +
                   " store\r\n";
    if (!epigene.empty())
      hold += "start\r\n" + epigene + "*.thisgene .delgene store\r\nstop";
  }

  // savingtofile = True: las privadas no se resuelven a nombre (:2291-2293).
  hold += DetokenizeDNA(bot, *sim.sysvars, 0, /*savingtofile=*/true);
  const std::string hashed = Hash(hold, 20);  // muta hold

  std::string file = hold + "\r\n";       // Print #1, hold
  file += "\r\n";                          // Print #1, ""
  file += "'#hash: " + hashed + "\r\n";    // Print #1, "'#hash: " + hashed
  const std::string blank(50, '\0');       // Dim blank As String * 50
  std::string tag = fixed50(bot.tag);
  if (tag.compare(0, 45, blank, 0, 45) != 0)
    file += "'#tag:" + tag.substr(0, 45) + "\r\n\r\n";  // Print ... + vbCrLf
  return file;
}

// ---------------------------------------------------------------------------
// Registro binario de bot (60-FORMATOS.md §2). La secuencia de Put/Get del
// fuente ES la spec: campos "v2.37" fijos + apéndices gateados por
// FileContinue al cargar + terminador 254×3.

// HDRoutines.bas:2009-2256 — SaveRobotBody. `r` es el slot: se persiste como
// oldBotNum para el remapeo de ties/shots al recargar (:2147).
inline void SaveRobotBody(Sim& sim, int r, VbBinFile& f,
                          const FormatGlobals& g = {}) {
  Bot& b = sim.rob[r];
  const std::string s = "Mutation Details removed in last save.";

  f.put_bool(b.Veg);
  f.put_bool(b.wall);
  f.put_bool(b.Fixed);

  // fisiche
  f.put_f32(b.pos.x);
  f.put_f32(b.pos.y);
  f.put_f32(b.vel.x);
  f.put_f32(b.vel.y);
  f.put_f32(b.aim);
  f.put_f32(b.ma);
  f.put_f32(b.mt);

  // ties: 15 campos, incluidos los muertos ln/shrink/stat/mem (34-TIES §4.4)
  for (int t = 0; t <= MAXTIES; ++t) {
    const Tie& tie = b.Ties[t];
    f.put_i16(tie.Port);
    f.put_i16(tie.pnt);
    f.put_i16(tie.ptt);
    f.put_f32(tie.ang);
    f.put_f32(tie.bend);
    f.put_bool(tie.angreg);
    f.put_i32(tie.ln);
    f.put_i32(tie.shrink);
    f.put_bool(tie.stat);
    f.put_i16(tie.last);
    f.put_i16(tie.mem);
    f.put_bool(tie.back);
    f.put_bool(tie.nrgused);
    f.put_bool(tie.infused);
    f.put_bool(tie.sharing);
  }

  // biologiche
  f.put_f32(b.nrg);

  // Solo vars(1..50): el resto se pierde ([PROBABLE BUG] B8-5, FM-05).
  for (int t = 1; t <= 50; ++t) {
    const Var v =
        (t < static_cast<int>(b.vars.size())) ? b.vars[t] : Var{};
    f.put_i16(static_cast<vb_integer>(v.name.size()));
    f.put_str(v.name);
    f.put_i16(v.value);
  }
  f.put_i16(static_cast<vb_integer>(b.vnum));

  // macchina virtuale: mem() crudo y entero (las 1001 celdas, FM-05).
  for (int i = 0; i <= MaxMem; ++i) f.put_i16(b.mem[i]);
  vb_integer k = static_cast<vb_integer>(DnaLen(b.dna));
  f.put_i16(k);
  for (int t = 1; t <= k; ++t) {  // dna(0) fantasma NO se guarda
    f.put_i16(b.dna[t].tipo);
    f.put_i16(b.dna[t].value);
  }

  for (int t = 0; t <= 20; ++t) f.put_f32(b.Mutables.mutarray[t]);

  // informative — sint envuelve, no clampa (FM-02)
  f.put_i16(b.SonNumber);
  f.put_i16(sint(b.Mutations));
  f.put_i16(sint(b.LastMut));
  f.put_i32(b.parent);
  f.put_i32(b.age);
  f.put_i32(b.BirthCycle);
  f.put_i16(static_cast<vb_integer>(b.genenum));
  f.put_i16(b.generation);
  f.put_i16(b.DnaLen);

  // aspetto
  for (int t = 0; t <= 13; ++t) f.put_i16(b.Skin[t]);
  f.put_i32(b.color);

  // new features
  f.put_f32(b.body);
  f.put_f32(b.Bouyancy);
  f.put_bool(b.Corpse);
  f.put_f32(b.Pwaste);
  f.put_f32(b.Waste);
  f.put_f32(b.poison);
  f.put_f32(b.venom);
  f.put_i16(k);  // campo muerto: DnaLen otra vez (leído a inttmp al cargar)
  f.put_bool(b.exist);
  f.put_bool(b.Dead);

  f.put_i16(static_cast<vb_integer>(b.FName.size()));
  f.put_str(b.FName);
  f.put_i16(static_cast<vb_integer>(b.LastOwner.size()));
  f.put_str(b.LastOwner);

  // LastMutDetail con escape Int→Long: longitud 1 = centinela "viene un
  // Long" (:2113-2132). Un detalle legítimo de longitud 1 dispara el escape
  // al cargar — quirk del original, se conserva.
  if (g.SaveWithoutMutations) {
    f.put_i16(static_cast<vb_integer>(s.size()));
    f.put_str(s);
  } else {
    if (static_cast<vb_long>(b.LastMutDetail.size()) > 32767) {
      f.put_i16(1);
      f.put_i32(static_cast<vb_long>(b.LastMutDetail.size()));
    } else {
      f.put_i16(static_cast<vb_integer>(b.LastMutDetail.size()));
    }
    f.put_str(b.LastMutDetail);
  }

  f.put_bool(b.Mutables.Mutations);
  for (int t = 0; t <= 20; ++t) {
    f.put_f32(b.Mutables.Mean[t]);
    f.put_f32(b.Mutables.StdDev[t]);
  }
  f.put_i16(b.Mutables.CopyErrorWhatToChange);
  f.put_i16(b.Mutables.PointWhatToChange);

  f.put_bool(b.View);
  f.put_bool(b.NewMove);
  f.put_i16(static_cast<vb_integer>(r));  // oldBotNum = slot al guardar

  f.put_bool(b.CantSee);
  f.put_bool(b.DisableDNA);
  f.put_bool(b.DisableMovementSysvars);
  f.put_bool(b.CantReproduce);
  f.put_f32(b.shell);
  f.put_f32(b.Slime);
  f.put_bool(b.VirusImmune);
  f.put_i16(b.SubSpecies);

  if (b.fertilized < 0) b.spermDNAlen = 0;  // muta el bot, como el original
  f.put_i16(b.spermDNAlen);
  for (int t = 1; t <= b.spermDNAlen; ++t) {
    const Block bp = (t < static_cast<int>(b.spermDNA.size()))
                         ? b.spermDNA[t]
                         : Block{};
    f.put_i16(bp.tipo);
    f.put_i16(bp.value);
  }
  f.put_i16(b.fertilized);

  // Ancestros obsoletos: el contador es el `t` sobrante del For anterior
  // (= spermDNAlen + 1 en todos los casos) + 501×3 Longs a 0 (:2168-2173).
  f.put_i16(static_cast<vb_integer>(b.spermDNAlen + 1));
  for (int t = 0; t <= 500; ++t) {
    f.put_i32(0);
    f.put_i32(0);
    f.put_i32(0);
  }

  f.put_i32(b.sim);
  f.put_i32(b.AbsNum);

  // resto de datos de tie (apéndice 2.42.9+)
  f.put_bool(b.Multibot);
  for (int t = 0; t <= MAXTIES; ++t) {
    f.put_byte(b.Ties[t].type);
    f.put_f32(b.Ties[t].b);
    f.put_f32(b.Ties[t].k);
    f.put_f32(b.Ties[t].NaturalLength);
  }

  f.put_f32(b.OldGD);
  f.put_f32(b.chloroplasts);
  for (int t = 0; t <= 14; ++t) f.put_i16(b.epimem[t]);

  // eco-IM (⚙, y_eco_im > 0): el tag se contamina con el nrg antes de
  // persistir ([PROBABLE BUG] B8-3). CStr(Single) del original aproximado
  // con %g de 7 dígitos — solo se ejecuta en modo eco-IM.
  if (!b.Veg && g.y_eco_im > 0 && !g.lblSaving_visible && b.dq < 2) {
    const std::string blank(50, '\0');
    std::string tag = fixed50(b.tag);
    if (tag.compare(0, 45, blank, 0, 45) == 0) {
      tag = b.FName;
      if (tag.size() > 50) tag.resize(50);
      tag.resize(50, ' ');
    }
    char buf[32];
    std::snprintf(buf, sizeof buf, "%.7g", static_cast<double>(b.nrg));
    std::string nrgtxt = std::string(buf) + buf;
    if (nrgtxt.size() > 5) nrgtxt.resize(5);
    b.tag = tag.substr(0, 45) + nrgtxt;
  }
  f.put_str(fixed50(b.tag));

  f.put_bool(g.sunbelt);  // global, no campo del bot
  f.put_bool(b.NoChlr);
  f.put_byte(b.multibot_time);
  f.put_byte(b.Chlr_Share_Delay);
  f.put_byte(b.dq);
  f.put_i32(b.OldMutations);
  f.put_f32(b.actvel.x);
  f.put_f32(b.actvel.y);

  // terminador
  f.put_byte(254);
  f.put_byte(254);
  f.put_byte(254);
}

// HDRoutines.bas:1602-1977 — LoadRobotBody. Los campos "v2.37" se leen a
// ciegas; cada apéndice va gateado por FileContinue. `usesunbelt` no leído
// (archivo viejo) desactiva las 4 tasas sunbelt.
inline void LoadRobotBody(Sim& sim, int r, VbBinFile& f,
                          const FormatGlobals& g = {}) {
  Bot& b = sim.rob[r];
  bool MessedUpMutations = false;
  vb_integer k = 0;
  vb_long L1 = 0;
  bool usesunbelt = false;
  bool oldfile = false;

  b.Veg = f.get_bool();
  b.wall = f.get_bool();
  b.Fixed = f.get_bool();

  b.pos.x = f.get_f32();
  b.pos.y = f.get_f32();
  b.vel.x = f.get_f32();
  b.vel.y = f.get_f32();
  b.aim = f.get_f32();
  b.ma = f.get_f32();
  b.mt = f.get_f32();

  b.BucketPos.x = -2;
  b.BucketPos.y = -2;

  for (int t = 0; t <= MAXTIES; ++t) {
    Tie& tie = b.Ties[t];
    tie.Port = f.get_i16();
    tie.pnt = f.get_i16();
    tie.ptt = f.get_i16();
    tie.ang = f.get_f32();
    tie.bend = f.get_f32();
    tie.angreg = f.get_bool();
    tie.ln = f.get_i32();
    tie.shrink = f.get_i32();
    tie.stat = f.get_bool();
    tie.last = f.get_i16();
    tie.mem = f.get_i16();
    tie.back = f.get_bool();
    tie.nrgused = f.get_bool();
    tie.infused = f.get_bool();
    tie.sharing = f.get_bool();
  }

  b.nrg = f.get_f32();

  b.vars.assign(51, Var{});
  for (int t = 1; t <= 50; ++t) {
    k = f.get_i16();
    b.vars[t].name = f.get_str(static_cast<std::size_t>(k < 0 ? 0 : k));
    b.vars[t].value = f.get_i16();
  }
  b.vnum = f.get_i16();

  for (int i = 0; i <= MaxMem; ++i) b.mem[i] = f.get_i16();
  k = f.get_i16();
  if (k < 0) k = 0;  // ReDim .dna(k) con k negativo era error 9; guarda
  b.dna.assign(static_cast<std::size_t>(k) + 1, Block{});
  for (int t = 1; t <= k; ++t) {
    b.dna[t].tipo = f.get_i16();
    b.dna[t].value = f.get_i16();
  }
  // Force an end base pair (:1663-1665)
  b.dna[k].tipo = 10;
  b.dna[k].value = 1;

  // Defaults razonables antes de leer (:1670)
  SetDefaultMutationRatesSkipNorm(b.Mutables);

  for (int t = 0; t <= 20; ++t) b.Mutables.mutarray[t] = f.get_f32();

  // informative
  b.SonNumber = f.get_i16();
  b.Mutations = f.get_i16();  // inttmp → Long
  b.LastMut = f.get_i16();
  b.parent = f.get_i32();
  b.age = f.get_i32();
  b.BirthCycle = f.get_i32();
  b.genenum = f.get_i16();
  b.generation = f.get_i16();
  b.DnaLen = f.get_i16();

  for (int t = 0; t <= 13; ++t) b.Skin[t] = f.get_i16();
  b.color = f.get_i32();

  // new stuff, gateado por FileContinue
  if (FileContinue(f)) {
    b.body = f.get_f32();
    b.radius = FindRadius(sim, r);
  }
  if (FileContinue(f)) b.Bouyancy = f.get_f32();
  if (FileContinue(f)) b.Corpse = f.get_bool();
  if (FileContinue(f)) b.Pwaste = f.get_f32();
  if (FileContinue(f)) b.Waste = f.get_f32();
  if (FileContinue(f)) b.poison = f.get_f32();
  if (FileContinue(f)) b.venom = f.get_f32();
  if (FileContinue(f)) f.get_i16();  // inttmp (campo muerto)
  if (FileContinue(f)) b.exist = f.get_bool();
  if (FileContinue(f)) b.Dead = f.get_bool();

  if (FileContinue(f)) k = f.get_i16();
  if (FileContinue(f))
    b.FName = f.get_str(static_cast<std::size_t>(k < 0 ? 0 : k));
  if (FileContinue(f)) k = f.get_i16();
  if (FileContinue(f))
    b.LastOwner = f.get_str(static_cast<std::size_t>(k < 0 ? 0 : k));
  if (b.LastOwner.empty()) b.LastOwner = "Local";

  if (FileContinue(f)) k = f.get_i16();

  if (k < 0) {
    // Archivo viejo corrupto: defaults y saltar al terminador (:1730-1755)
    b.LastMutDetail =
        "Problem reading mutation details.  May be a very old sim.  Please "
        "tell the developers.  Mutation Details deleted.";
    b.Mutables.Mutations = true;
    SetDefaultMutationRatesSkipNorm(b.Mutables);
    b.View = true;
    b.NewMove = false;
    b.oldBotNum = 0;
    b.CantSee = false;
    b.DisableDNA = false;
    b.DisableMovementSysvars = false;
    b.CantReproduce = false;
    b.VirusImmune = false;
    b.shell = 0;
    b.Slime = 0;
    oldfile = true;
  }

  if (!oldfile) {
    if (k == 1)
      L1 = f.get_i32();  // el escape: la longitud real viene como Long
    else
      L1 = k;

    if (g.lblSaving_visible) {
      b.LastMutDetail.assign(static_cast<std::size_t>(L1), ' ');
      if (FileContinue(f))
        b.LastMutDetail = f.get_str(static_cast<std::size_t>(L1));
    } else {
      // 100000000 / TotalRobotsDisplayed: con contador 0 el original daba
      // error 11 — decisión de port: umbral infinito (no se salta).
      const bool skip =
          sim.TotalRobotsDisplayed > 0 &&
          static_cast<double>(L1) >
              100000000.0 / static_cast<double>(sim.TotalRobotsDisplayed);
      if (skip) {
        f.pos += static_cast<std::size_t>(L1);  // Seek #n, L1 + Seek(n)
      } else {
        b.LastMutDetail.assign(static_cast<std::size_t>(L1), ' ');
        if (FileContinue(f))
          b.LastMutDetail = f.get_str(static_cast<std::size_t>(L1));
      }
    }

    if (FileContinue(f)) b.Mutables.Mutations = f.get_bool();

    for (int t = 0; t <= 20; ++t) {
      if (FileContinue(f)) b.Mutables.Mean[t] = f.get_f32();
      if (FileContinue(f)) b.Mutables.StdDev[t] = f.get_f32();
    }
    for (int t = 0; t <= 20; ++t) {
      if (b.Mutables.Mean[t] < 0 || b.Mutables.Mean[t] > 32000 ||
          b.Mutables.StdDev[t] < 0 || b.Mutables.StdDev[t] > 32000)
        MessedUpMutations = true;
    }

    if (FileContinue(f)) b.Mutables.CopyErrorWhatToChange = f.get_i16();
    if (FileContinue(f)) b.Mutables.PointWhatToChange = f.get_i16();
    if (b.Mutables.CopyErrorWhatToChange < 0 ||
        b.Mutables.CopyErrorWhatToChange > 32000 ||
        b.Mutables.PointWhatToChange < 0 ||
        b.Mutables.PointWhatToChange > 32000)
      MessedUpMutations = true;
    if (MessedUpMutations) SetDefaultMutationRatesSkipNorm(b.Mutables);

    if (FileContinue(f)) b.View = f.get_bool();
    if (FileContinue(f)) b.NewMove = f.get_bool();

    b.oldBotNum = 0;
    if (FileContinue(f)) b.oldBotNum = f.get_i16();

    // Guardias anti-corrupción: solo el -1 canónico cuenta como True
    // (If CInt(x) > 0 Or CInt(x) < -1 Then x = False).
    b.CantSee = false;
    if (FileContinue(f)) b.CantSee = (f.get_bool_raw() == -1);
    b.DisableDNA = false;
    if (FileContinue(f)) b.DisableDNA = (f.get_bool_raw() == -1);
    b.DisableMovementSysvars = false;
    if (FileContinue(f)) b.DisableMovementSysvars = (f.get_bool_raw() == -1);
    b.CantReproduce = false;
    if (FileContinue(f)) b.CantReproduce = (f.get_bool_raw() == -1);

    b.shell = 0;
    if (FileContinue(f)) b.shell = f.get_f32();
    if (b.shell > 32000) b.shell = 32000;
    if (b.shell < 0) b.shell = 0;

    b.Slime = 0;
    if (FileContinue(f)) b.Slime = f.get_f32();
    if (b.Slime > 32000) b.Slime = 32000;
    if (b.Slime < 0) b.Slime = 0;

    b.VirusImmune = false;
    if (FileContinue(f)) b.VirusImmune = (f.get_bool_raw() == -1);

    b.SubSpecies = 0;
    if (FileContinue(f)) b.SubSpecies = f.get_i16();

    b.spermDNAlen = 0;
    if (FileContinue(f)) {
      b.spermDNAlen = f.get_i16();
      if (b.spermDNAlen < 0) b.spermDNAlen = 0;  // ReDim negativo era error 9
      b.spermDNA.assign(static_cast<std::size_t>(b.spermDNAlen) + 1, Block{});
    }
    for (int t = 1; t <= b.spermDNAlen; ++t) {
      if (FileContinue(f)) b.spermDNA[t].tipo = f.get_i16();
      if (FileContinue(f)) b.spermDNA[t].value = f.get_i16();
    }

    b.fertilized = -1;
    if (FileContinue(f)) b.fertilized = f.get_i16();

    // ancestros obsoletos: contador + 501×3 Longs quemados
    if (FileContinue(f)) f.get_i16();
    for (int t = 0; t <= 500; ++t) {
      if (FileContinue(f)) f.get_i32();
      if (FileContinue(f)) f.get_i32();
      if (FileContinue(f)) f.get_i32();
    }

    b.sim = 0;
    if (FileContinue(f)) b.sim = f.get_i32();
    if (FileContinue(f)) b.AbsNum = f.get_i32();

    if (FileContinue(f)) b.Multibot = f.get_bool();
    for (int t = 0; t <= MAXTIES; ++t) {
      if (FileContinue(f)) b.Ties[t].type = f.get_byte();
      if (FileContinue(f)) b.Ties[t].b = f.get_f32();
      if (FileContinue(f)) b.Ties[t].k = f.get_f32();
      if (FileContinue(f)) b.Ties[t].NaturalLength = f.get_f32();
      if (b.Ties[t].NaturalLength < 0) b.Ties[t].NaturalLength = 0;
      if (b.Ties[t].NaturalLength > 1500) b.Ties[t].NaturalLength = 1500;
    }

    if (FileContinue(f)) b.OldGD = f.get_f32();
    b.GenMut = static_cast<vb_single>(b.DnaLen) /
               static_cast<vb_single>(GeneticSensitivity);

    if (FileContinue(f)) b.chloroplasts = f.get_f32();
    if (b.chloroplasts < 0) b.chloroplasts = 0;
    if (b.chloroplasts > 32000) b.chloroplasts = 32000;

    for (int t = 0; t <= 14; ++t)
      if (FileContinue(f)) b.epimem[t] = f.get_i16();

    if (FileContinue(f)) b.tag = f.get_str(50);  // String * 50

    if (FileContinue(f)) usesunbelt = f.get_bool();
    if (FileContinue(f)) b.NoChlr = f.get_bool();

    if (FileContinue(f)) b.multibot_time = f.get_byte();
    if (FileContinue(f)) b.Chlr_Share_Delay = f.get_byte();
    if (b.Chlr_Share_Delay > 8) b.Chlr_Share_Delay = 8;
    if (FileContinue(f)) b.dq = f.get_byte();
    if (b.dq > 3) b.dq = 3;

    if (FileContinue(f)) b.OldMutations = f.get_i32();

    if (FileContinue(f)) b.actvel.x = f.get_f32();
    if (FileContinue(f)) b.actvel.y = f.get_f32();

    b.dq = static_cast<unsigned char>(b.dq - (b.dq > 1 ? 2 : 0));

    // eco-IM (⚙): descalificación por tag/nombre — solo con y_eco_im > 0.
    if (!b.Veg) {
      if (g.y_eco_im > 0 && !g.lblSaving_visible) {
        std::string tag = fixed50(b.tag);
        char buf[32];
        std::snprintf(buf, sizeof buf, "%.7g", static_cast<double>(b.nrg));
        std::string nrgtxt = std::string(buf) + buf;
        if (nrgtxt.size() > 5) nrgtxt.resize(5);
        if (loader_detail::vb_trim(tag.substr(45)) !=
            loader_detail::vb_trim(nrgtxt))
          b.dq = static_cast<unsigned char>(2 + (b.dq == 1 ? 1 : 0));
        if (b.FName != "Mutate.txt" && b.FName != "Base.txt" &&
            b.FName != "Corpse")
          b.dq = static_cast<unsigned char>(2 + (b.dq == 1 ? 1 : 0));
      }
    } else {
      if (g.y_eco_im > 0 && b.chloroplasts < 2000) b.Dead = true;
      if (sim.TotalChlr > sim.opts.MaxPopulation) b.Dead = true;
    }
    if (b.FName == "Corpse") b.nrg = 0;
  }

  // OldFile: quemar datos de versiones futuras y los tres 254 (:1952-1962)
  while (FileContinue(f)) f.get_byte();
  f.get_byte();
  f.get_byte();
  f.get_byte();

  b.Vtimer = 0;
  b.virusshot = 0;

  if (!usesunbelt) {
    b.Mutables.mutarray[mut::P2UP] = 0;
    b.Mutables.mutarray[mut::CE2UP] = 0;
    b.Mutables.mutarray[mut::AmplificationUP] = 0;
    b.Mutables.mutarray[mut::TranslocationUP] = 0;
  }
}

// HDRoutines.bas:1571-1584 — LoadRobot: cuerpo + AbsNum (solo si venía 0) +
// firma occurr + republicación de DnaLen/genenum. insertsysvars/ScanUsedVars
// solo pueblan usedvars (rasgo abandonado, display) y no entran al core.
inline void LoadRobot(Sim& sim, int n, VbBinFile& f,
                      const FormatGlobals& g = {}) {
  LoadRobotBody(sim, n, f, g);
  if (sim.rob[n].exist) {
    GiveAbsNum(sim, n);  // guardia AbsNum = 0 dentro (FM-05)
    makeoccurrlist(sim, n);
    sim.rob[n].DnaLen = static_cast<vb_integer>(DnaLen(sim.rob[n].dna));
    sim.rob[n].genenum = CountGenes(sim.rob[n].dna);
    sim.rob[n].mem[addr::DnaLenSys] = sim.rob[n].DnaLen;
    sim.rob[n].mem[addr::GenesSys] =
        static_cast<vb_integer>(sim.rob[n].genenum);
  }
}

// ---------------------------------------------------------------------------
// Organismo (.dbo) — 60-FORMATOS.md §3. ListCells vive en physics.hpp; con
// funciones inline basta la declaración (la definición entra en el mismo TU
// vía robots.hpp/master.hpp).
inline void ListCells(Sim& sim, std::array<vb_integer, 51>& lst);

// HDRoutines.bas:217-240 — SaveOrganism: cnum + cnum registros de bot, con
// LastOwner estampado (IntOpts.IName) antes de cada registro.
inline void SaveOrganism(Sim& sim, VbBinFile& f, int r,
                         const FormatGlobals& g = {}) {
  std::array<vb_integer, 51> clist{};
  vb_integer cnum = 0;
  clist[0] = static_cast<vb_integer>(r);
  ListCells(sim, clist);
  while (clist[cnum] > 0) cnum += 1;

  f.put_i16(cnum);
  for (vb_integer k = 0; k <= cnum - 1; ++k) {
    sim.rob[clist[k]].LastOwner = g.IName;
    SaveRobotBody(sim, clist[k], f, g);
  }
}

// HDRoutines.bas:243-297 — AddSpecie: registra la especie de un bot
// cargado/teleportado. Defaults "Species arrived from the Internet":
// qty = 5, Stnrg = 3000, tasas por defecto (la rama NormMut de
// SetDefaultMutationRates está acoplada a la UI y NormMut nace False;
// nótese que SIN skipNorm el P2UP NO se pone a 0, a diferencia del
// cargador binario). Con el registro lleno (k = SpeciesNum = 76) el
// original escribe Specie(76), el slot de reserva de SimOptions.bas:65
// (`Specie(MAXNATIVESPECIES + 1)`), sin incrementar SpeciesNum: las 76
// especies vivas quedan intactas. Aquí ese slot es Sim::SpecieSpare (E7-06;
// hasta E7 el port pisaba la especie 75). Desde E7 también es el AddSpecie
// de UpdateCounters (Robots.bas:1152) y de la auto-especiación
// (NeoMutations.bas:212), que el port resolvía con un registro mínimo.
inline vb_integer AddSpecieFromFile(Sim& sim, int n, bool IsNative) {
  Bot& b = sim.rob[n];
  if (b.Corpse || b.FName == "Corpse" || !b.exist) return 0;

  const vb_integer k = static_cast<vb_integer>(sim.Specie.size());
  Specie* spp;
  if (k < MAXNATIVESPECIES) {
    sim.Specie.emplace_back();
    spp = &sim.Specie.back();
  } else {
    spp = &sim.SpecieSpare;  // Specie(76) con SpeciesNum sin crecer
  }
  Specie& sp = *spp;

  sp.Name = b.FName;
  sp.Veg = b.Veg;
  sp.CantSee = b.CantSee;
  sp.DisableMovementSysvars = b.DisableMovementSysvars;
  sp.DisableDNA = b.DisableDNA;
  sp.CantReproduce = b.CantReproduce;
  sp.VirusImmune = b.VirusImmune;
  sp.population = 1;
  sp.SubSpeciesCounter = 0;
  sp.color = b.color;
  sp.Comment = "Species arrived from the Internet";
  sp.Posrg = 1;
  sp.Posdn = 1;
  sp.Poslf = 0;
  sp.Postp = 0;

  // SetDefaultMutationRates SIN skipNorm y NormMut = False: mutarray = 5000
  // en las 21 celdas (P2UP incluido) + SetDefaultLengths.
  for (int a = 0; a <= 20; ++a) {
    sp.Mutables.mutarray[a] = 5000;
    sp.Mutables.Mean[a] = 1;
    sp.Mutables.StdDev[a] = 0;
  }
  SetDefaultLengths(sp.Mutables);
  sp.Mutables.Mutations = b.Mutables.Mutations;

  sp.qty = 5;
  sp.Stnrg = 3000;
  sp.Native = IsNative;
  sp.path = "";  // MainDir + "\robots" del original: ruta de disco, infra
  sp.dnaMissing = true;  // RV-40: ningún .txt respalda la especie nueva

  return k;
}

// HDRoutines.bas:349-368 — PlaceOrganism: traslada el organismo entero
// relativo a la célula 0 y lo re-registra en los buckets.
inline void PlaceOrganism(Sim& sim, std::array<vb_integer, 51>& clist,
                          vb_single X, vb_single Y) {
  int k = 0;
  const vb_single dx = X - sim.rob[clist[0]].pos.x;
  const vb_single dy = Y - sim.rob[clist[0]].pos.y;
  while (clist[k] > 0) {
    sim.rob[clist[k]].pos.x = sim.rob[clist[k]].pos.x + dx;
    sim.rob[clist[k]].pos.y = sim.rob[clist[k]].pos.y + dy;
    sim.rob[clist[k]].BucketPos.x = -2;
    sim.rob[clist[k]].BucketPos.y = -2;
    UpdateBotBucket(sim, clist[k]);
    k += 1;
  }
}

// HDRoutines.bas:372-400 — RemapTies: re-apunta las ties de las células
// cargadas de oldBotNum a los slots nuevos y poda las que apuntan fuera
// del archivo.
inline void RemapTies(Sim& sim, std::array<vb_integer, 51>& clist,
                      vb_integer cnum) {
  for (vb_integer t = 0; t <= cnum - 1; ++t) {
    const vb_integer ind = sim.rob[clist[t]].oldBotNum;
    for (vb_integer k = 0; k <= cnum - 1; ++k) {
      int j = 1;
      while (j <= MAXTIES && sim.rob[clist[k]].Ties[j].pnt > 0) {
        if (sim.rob[clist[k]].Ties[j].pnt == ind)
          sim.rob[clist[k]].Ties[j].pnt = clist[t];
        j += 1;
      }
    }
  }

  for (vb_integer k = 0; k <= cnum - 1; ++k) {
    int j = 1;
    while (j <= MAXTIES && sim.rob[clist[k]].Ties[j].pnt > 0) {
      bool TiePointsToNode = false;
      for (vb_integer t = 0; t <= cnum - 1; ++t) {
        if (sim.rob[clist[k]].Ties[j].pnt == clist[t]) TiePointsToNode = true;
      }
      if (!TiePointsToNode) sim.rob[clist[k]].Ties[j].pnt = 0;
      j += 1;
    }
  }
}

// HDRoutines.bas:296-346 — LoadOrganism: cnum registros a slots frescos
// (posto), especies desconocidas auto-registradas, recolocación relativa y
// remapeo de ties. Devuelve el slot de la ÚLTIMA célula cargada (como el
// original) o -1. Sitio de error 9 con cnum > 51 (ver SimDiag).
inline int LoadOrganism(Sim& sim, VbBinFile& f, vb_single X, vb_single Y,
                        const FormatGlobals& g = {}) {
  std::array<vb_integer, 51> clist{};
  int result = -1;
  int nuovo = 0;

  const vb_integer cnum = f.get_i16();
  for (vb_integer k = 0; k <= cnum - 1; ++k) {
    nuovo = posto(sim);
    if (k > 50) {
      // clist(51) desbordaba en el original (error 9 -> handler `problem`:
      // deshace el bot a medias y devuelve -1).
      sim.diag.err9_load_organism += 1;
      sim.rob[nuovo].exist = false;
      UpdateBotBucket(sim, nuovo);
      return -1;
    }
    clist[k] = static_cast<vb_integer>(nuovo);
    LoadRobot(sim, nuovo, f, g);
    result = nuovo;

    bool foundSpecies = false;
    for (std::size_t i = sim.Specie.size(); i > 0; --i) {
      if (sim.rob[nuovo].FName == sim.Specie[i - 1].Name) {
        foundSpecies = true;
        break;
      }
    }
    if (!foundSpecies) AddSpecieFromFile(sim, nuovo, false);
  }

  if (X > -1.0f && Y > -1.0f) PlaceOrganism(sim, clist, X, Y);
  RemapTies(sim, clist, cnum);
  return result;
}

// HDRoutines.bas:402-421 — RemapAllTies: tras cargar una sim densa, cada
// tie se re-apunta buscando el oldBotNum entre TODOS los bots.
inline void RemapAllTies(Sim& sim, int numOfBots) {
  for (int i = 1; i <= numOfBots; ++i) {
    int j = 1;
    while (j <= MAXTIES && sim.rob[i].Ties[j].pnt > 0) {
      for (int k = 1; k <= numOfBots; ++k) {
        if (sim.rob[i].Ties[j].pnt == sim.rob[k].oldBotNum) {
          sim.rob[i].Ties[j].pnt = static_cast<vb_integer>(k);
          break;  // GoTo nexttie
        }
      }
      j += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Formato de simulación (60-FORMATOS.md §4). La secuencia de Put/Get del
// fuente ES la spec; se transcribe campo a campo con sus capas históricas
// ("new stuff" … "even even newer newer stuff") y los presets de
// compatibilidad del lado de carga.

inline void RemapAllShots(Sim& sim, vb_long numOfShots);  // definida abajo

namespace formats_detail {
inline void put_vec(VbBinFile& f, const Vector& v) {
  f.put_f32(v.x);
  f.put_f32(v.y);
}
inline Vector get_vec(VbBinFile& f) {
  Vector v;
  v.x = f.get_f32();
  v.y = f.get_f32();
  return v;
}
inline void put_lstr32(VbBinFile& f, const std::string& s) {
  f.put_i32(static_cast<vb_long>(s.size()));
  f.put_str(s);
}
}  // namespace formats_detail

// HDRoutines.bas:2313-2349 — SaveTeleporter.
inline void SaveTeleporter(Sim& sim, VbBinFile& f, int t) {
  using formats_detail::put_vec;
  const Teleporter& tp = sim.Teleporters[t];
  put_vec(f, tp.pos);
  f.put_f32(tp.Width);
  f.put_f32(tp.Height);
  f.put_i32(tp.color);
  put_vec(f, tp.vel);
  f.put_i16(static_cast<vb_integer>(tp.path.size()));  // CInt(Len(.path))
  f.put_str(tp.path);
  f.put_bool(tp.In);
  f.put_bool(tp.Out);
  f.put_bool(tp.local);
  f.put_bool(tp.driftHorizontal);
  f.put_bool(tp.driftVertical);
  f.put_bool(tp.highlight);
  f.put_bool(tp.teleportVeggies);
  f.put_bool(tp.teleportCorpses);
  f.put_bool(tp.RespectShapes);
  f.put_i32(tp.NumTeleported);
  f.put_bool(tp.teleportHeterotrophs);
  f.put_i16(tp.InboundPollCycles);
  f.put_i16(tp.BotsPerPoll);
  f.put_i16(tp.PollCountDown);
  f.put_bool(tp.Internet);
  f.put_byte(254);
  f.put_byte(254);
  f.put_byte(254);
}

// HDRoutines.bas:2352-2399 — LoadTeleporter: campos fijos + apéndices
// FileContinue con sus defaults (heterótrofos sí, sondeo 10/10/10).
inline void LoadTeleporter(Sim& sim, VbBinFile& f, int t) {
  using formats_detail::get_vec;
  Teleporter& tp = sim.Teleporters[t];
  tp.pos = get_vec(f);
  tp.Width = f.get_f32();
  tp.Height = f.get_f32();
  tp.color = f.get_i32();
  tp.vel = get_vec(f);
  const vb_integer k = f.get_i16();
  tp.path = f.get_str(static_cast<std::size_t>(k < 0 ? 0 : k));
  tp.In = f.get_bool();
  tp.Out = f.get_bool();
  tp.local = f.get_bool();
  tp.driftHorizontal = f.get_bool();
  tp.driftVertical = f.get_bool();
  tp.highlight = f.get_bool();
  tp.teleportVeggies = f.get_bool();
  tp.teleportCorpses = f.get_bool();
  tp.RespectShapes = f.get_bool();
  tp.NumTeleported = f.get_i32();

  tp.teleportHeterotrophs = true;
  tp.InboundPollCycles = 10;
  tp.BotsPerPoll = 10;
  tp.PollCountDown = 10;

  if (FileContinue(f)) tp.teleportHeterotrophs = f.get_bool();
  if (FileContinue(f)) tp.InboundPollCycles = f.get_i16();
  if (FileContinue(f)) tp.BotsPerPoll = f.get_i16();
  if (FileContinue(f)) tp.PollCountDown = f.get_i16();
  if (FileContinue(f)) tp.Internet = f.get_bool();

  while (FileContinue(f)) f.get_byte();
  f.get_byte();
  f.get_byte();
  f.get_byte();
  // Nótese que .exist NO se persiste ni se repone: un teleporter cargado
  // queda con exist = False, como en el original (solo la UI lo consulta;
  // CheckTeleporters/UpdateTeleporters no filtran por exist).
}

// Teleport.bas:152-161 — DeleteTeleporter: compacta hacia la izquierda.
inline void DeleteTeleporter(Sim& sim, int i) {
  if (sim.numTeleporters <= 0) return;
  for (int x = i + 1; x <= sim.numTeleporters; ++x)
    sim.Teleporters[x - 1] = sim.Teleporters[x];
  sim.Teleporters[sim.numTeleporters].exist = false;
  sim.numTeleporters -= 1;
}

// HDRoutines.bas:2402-2422 — SaveObstacle.
inline void SaveObstacle(Sim& sim, VbBinFile& f, int t) {
  using formats_detail::put_vec;
  const Obstacle& o = sim.Obstacles[t];
  f.put_bool(o.exist);
  put_vec(f, o.pos);
  f.put_f32(o.Width);
  f.put_f32(o.Height);
  f.put_i32(o.color);
  put_vec(f, o.vel);
  f.put_byte(254);
  f.put_byte(254);
  f.put_byte(254);
}

// HDRoutines.bas:2425-2450 — LoadObstacle.
inline void LoadObstacle(Sim& sim, VbBinFile& f, int t) {
  using formats_detail::get_vec;
  Obstacle& o = sim.Obstacles[t];
  o.exist = f.get_bool();
  o.pos = get_vec(f);
  o.Width = f.get_f32();
  o.Height = f.get_f32();
  o.color = f.get_i32();
  o.vel = get_vec(f);
  while (FileContinue(f)) f.get_byte();
  f.get_byte();
  f.get_byte();
  f.get_byte();
}

// HDRoutines.bas:2453-2501 — SaveShot: el ADN viaja solo para virus (-7) y
// esperma (-8) vivos con DnaLen > 0; si no, un 0.
inline void SaveShot(Sim& sim, VbBinFile& f, vb_long t) {
  using formats_detail::put_vec;
  const Shot& s = sim.Shots[t];
  f.put_bool(s.exist);
  put_vec(f, s.pos);
  put_vec(f, s.opos);
  put_vec(f, s.velocity);
  f.put_i16(s.parent);
  f.put_i16(s.age);
  f.put_f32(s.nrg);
  f.put_f32(s.Range);
  f.put_i16(s.value);
  f.put_i32(s.color);
  f.put_i16(s.shottype);
  f.put_bool(s.fromveg);
  f.put_i16(static_cast<vb_integer>(s.FromSpecie.size()));
  f.put_str(s.FromSpecie);
  f.put_i16(s.memloc);
  f.put_i16(s.Memval);

  if ((s.shottype == -7 || s.shottype == -8) && s.exist && s.DnaLen > 0) {
    f.put_i16(s.DnaLen);
    for (vb_integer x = 1; x <= s.DnaLen; ++x) {
      f.put_i16(static_cast<vb_integer>(s.dna[x].tipo));
      f.put_i16(static_cast<vb_integer>(s.dna[x].value));
    }
  } else {
    f.put_i16(0);
  }

  f.put_i16(s.genenum);
  f.put_bool(s.stored);
  f.put_byte(254);
  f.put_byte(254);
  f.put_byte(254);
}

// HDRoutines.bas:2504-2559 — LoadShot.
inline void LoadShot(Sim& sim, VbBinFile& f, vb_long t) {
  using formats_detail::get_vec;
  Shot& s = sim.Shots[t];
  s.exist = f.get_bool();
  s.pos = get_vec(f);
  s.opos = get_vec(f);
  s.velocity = get_vec(f);
  s.parent = f.get_i16();
  s.age = f.get_i16();
  s.nrg = f.get_f32();
  s.Range = f.get_f32();
  s.value = f.get_i16();
  s.color = f.get_i32();
  s.shottype = f.get_i16();
  s.fromveg = f.get_bool();
  vb_integer k = f.get_i16();
  s.FromSpecie = f.get_str(static_cast<std::size_t>(k < 0 ? 0 : k));
  s.memloc = f.get_i16();
  s.Memval = f.get_i16();

  k = f.get_i16();
  if (k > 0) {
    s.dna.assign(static_cast<std::size_t>(k) + 1, Block{});
    for (vb_integer x = 1; x <= k; ++x) {
      s.dna[x].tipo = f.get_i16();
      s.dna[x].value = f.get_i16();
    }
  }
  s.DnaLen = k;

  s.genenum = f.get_i16();
  s.stored = f.get_bool();
  while (FileContinue(f)) f.get_byte();
  f.get_byte();
  f.get_byte();
  f.get_byte();
}

// HDRoutines.bas:513-849 — SaveSimulation: numOfExistingBots + registros
// DENSOS (solo existentes; por eso los remapeos por oldBotNum al cargar) +
// placeholders "null" + SimOpts por capas + 5 pasadas por especies + Costs
// + teleporters + obstáculos + TODOS los shots (vivos y muertos) +
// MaxAbsNum + gráficas + evo ⚙ + sol + mareas + stagnent.
// [PROBABLE BUG] B8-1: el manejador de errores del original se llama a sí
// mismo (recursión infinita con ruta no escribible); en el port la
// escritura a búfer no falla y la capa host NO reintenta (decisión M5).
inline void SaveSimulation(Sim& sim, VbBinFile& f,
                           const FormatGlobals& gin = {}) {
  using formats_detail::put_lstr32;
  // Form1.lblSaving.Visible = True (:541): SaveRobotBody lo ve encendido
  // (el tag eco-IM no se contamina, :2203). RV-30.
  FormatGlobals g = gin;
  g.lblSaving_visible = true;

  vb_integer numOfExistingBots = 0;
  for (int x = 1; x <= sim.MaxRobs; ++x)
    if (sim.rob[x].exist) numOfExistingBots += 1;

  f.put_i16(numOfExistingBots);
  for (int t = 1; t <= sim.MaxRobs; ++t)
    if (sim.rob[t].exist) SaveRobotBody(sim, t, f, g);

  const vb_integer SpeciesNum = static_cast<vb_integer>(sim.Specie.size());
  auto& C = sim.vm.costs.v;

  put_lstr32(f, "null");
  f.put_i16(0);
  put_lstr32(f, "null");
  f.put_i16(0);
  f.put_bool(sim.opts.BlockedVegs);
  f.put_f32(C[cost::SHOTCOST]);
  f.put_f32(sim.opts.CostExecCond);
  f.put_f32(C[Costs::COSTSTORE]);
  f.put_bool(sim.opts.DeadRobotSnp);
  f.put_bool(sim.opts.SnpExcludeVegs);
  put_lstr32(f, "null");
  f.put_bool(false);
  f.put_bool(sim.opts.DisableTies);
  f.put_bool(sim.opts.EnergyExType);
  f.put_i16(sim.opts.EnergyFix);
  f.put_f32(sim.opts.EnergyProp);
  f.put_i32(vb_clng(static_cast<double>(sim.opts.FieldHeight)));
  f.put_i16(sim.opts.FieldSize);
  f.put_i32(vb_clng(static_cast<double>(sim.opts.FieldWidth)));
  f.put_bool(sim.opts.KillDistVegs);
  f.put_i32(sim.opts.MaxEnergy);
  f.put_i16(static_cast<vb_integer>(sim.opts.MaxPopulation));
  f.put_i16(static_cast<vb_integer>(sim.opts.MinVegs));
  f.put_f32(sim.opts.MutCurrMult);
  f.put_i32(sim.opts.MutCycMax);
  f.put_i32(sim.opts.MutCycMin);
  f.put_bool(sim.opts.MutOscill);
  f.put_f32(sim.opts.PhysBrown);
  f.put_f32(sim.opts.Ygravity);
  f.put_f32(sim.opts.Zgravity);
  f.put_f32(sim.opts.PhysMoving);
  f.put_f32(sim.opts.PhysSwim);
  f.put_i16(sim.opts.PopLimMethod);
  put_lstr32(f, sim.opts.SimName);
  f.put_i16(SpeciesNum);
  f.put_bool(sim.opts.Toroidal);
  f.put_i32(sim.opts.TotBorn);
  f.put_i32(sim.opts.TotRunCycle);
  f.put_i32(sim.opts.TotRunTime);

  // new stuff
  f.put_bool(sim.opts.Pondmode);
  f.put_bool(false);  // KineticEnergy, abandonado
  f.put_i16(sim.opts.LightIntensity);
  f.put_bool(sim.opts.CorpseEnabled);
  f.put_f32(sim.opts.Decay);
  f.put_f32(sim.opts.Gradient);
  f.put_bool(sim.opts.DayNight);
  f.put_i16(sim.opts.CycleLength);

  // new new stuff
  f.put_i16(static_cast<vb_integer>(sim.opts.Decaydelay));
  f.put_i16(static_cast<vb_integer>(sim.opts.DecayType));

  // obsolete
  f.put_f32(C[cost::MOVECOST]);

  f.put_bool(sim.opts.F1);
  f.put_bool(sim.opts.Restart);

  // even even newer newer stuff
  f.put_bool(sim.opts.Dxsxconnected);
  f.put_bool(sim.opts.Updnconnected);
  f.put_i16(sim.opts.RepopAmount);
  f.put_i16(sim.opts.RepopCooldown);
  f.put_bool(sim.opts.ZeroMomentum);
  f.put_i32(sim.opts.UserSeedNumber);
  f.put_bool(true);

  f.put_i16(SpeciesNum);

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    const Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    f.put_i16(sp.Colind);
    f.put_i32(sp.color);
    f.put_bool(sp.Fixed);
    for (int h = 0; h <= 20; ++h) f.put_f32(sp.Mutables.mutarray[h]);
    f.put_bool(sp.Mutables.Mutations);
    put_lstr32(f, sp.Name);
    f.put_i16(8);  // omnifeed obsoleto
    put_lstr32(f, sp.path);
    f.put_i32(vb_clng(static_cast<double>(sim.opts.FieldHeight)));
    f.put_i32(0);
    f.put_i32(vb_clng(static_cast<double>(sim.opts.FieldWidth)));
    f.put_i32(0);
    f.put_i16(sp.qty);
    for (int h = 0; h <= 13; ++h) f.put_i16(sp.Skin[h]);
    f.put_i16(sp.Stnrg);
    f.put_bool(sp.Veg);
  }

  f.put_i16(0);  // CInt(0)
  f.put_f32(sim.opts.VegFeedingToBody);
  f.put_f32(sim.opts.CoefficientStatic);
  f.put_f32(sim.opts.CoefficientKinetic);
  f.put_bool(sim.opts.PlanetEaters);
  f.put_f32(sim.opts.PlanetEatersG);
  f.put_f64(sim.opts.Viscosity);
  f.put_f64(sim.opts.Density);

  // New for 2.4
  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    const Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    f.put_i16(sp.Mutables.CopyErrorWhatToChange);
    f.put_i16(sp.Mutables.PointWhatToChange);
    for (int h = 0; h <= 20; ++h) {
      f.put_f32(sp.Mutables.Mean[h]);
      f.put_f32(sp.Mutables.StdDev[h]);
    }
  }

  for (int k = 0; k <= 70; ++k) f.put_f32(C[k]);

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    const Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    f.put_f32(sp.Poslf);
    f.put_f32(sp.Posrg);
    f.put_f32(sp.Postp);
    f.put_f32(sp.Posdn);
  }

  f.put_i16(static_cast<vb_integer>(sim.opts.BadWastelevel));
  f.put_i16(sim.opts.chartingInterval);
  f.put_f32(sim.opts.CoefficientElasticity);
  f.put_i16(sim.opts.FluidSolidCustom);
  f.put_i16(sim.opts.CostRadioSetting);
  f.put_f32(sim.opts.MaxVelocity);
  f.put_bool(sim.opts.NoShotDecay);
  f.put_i32(sim.opts.SunUpThreshold);
  f.put_bool(sim.opts.SunUp);
  f.put_i32(sim.opts.SunDownThreshold);
  f.put_bool(sim.opts.SunDown);
  f.put_bool(false);
  f.put_bool(false);
  f.put_bool(sim.opts.FixedBotRadii);
  f.put_i32(sim.opts.DayNightCycleCounter);
  f.put_bool(sim.opts.Daytime);
  f.put_i16(sim.opts.SunThresholdMode);

  f.put_i16(static_cast<vb_integer>(sim.numTeleporters));
  for (int x = 1; x <= sim.numTeleporters; ++x) SaveTeleporter(sim, f, x);

  f.put_i16(static_cast<vb_integer>(sim.numObstacles));
  for (int x = 1; x <= sim.numObstacles; ++x) SaveObstacle(sim, f, x);

  f.put_bool(false);

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    const Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    f.put_bool(sp.CantSee);
    f.put_bool(sp.DisableDNA);
    f.put_bool(sp.DisableMovementSysvars);
  }

  f.put_bool(sim.opts.shapesAreVisable);
  f.put_bool(sim.opts.allowVerticalShapeDrift);
  f.put_bool(sim.opts.allowHorizontalShapeDrift);
  f.put_bool(sim.opts.shapesAreSeeThrough);
  f.put_bool(sim.opts.shapesAbsorbShots);
  f.put_i16(sim.opts.shapeDriftRate);
  f.put_bool(sim.opts.makeAllShapesTransparent);
  f.put_bool(sim.opts.makeAllShapesBlack);

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k)
    f.put_bool(sim.Specie[static_cast<std::size_t>(k)].CantReproduce);

  f.put_i32(sim.maxshotarray);
  for (vb_long j = 1; j <= sim.maxshotarray; ++j) SaveShot(sim, f, j);

  f.put_i32(sim.MaxAbsNum);

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k)
    f.put_bool(sim.Specie[static_cast<std::size_t>(k)].VirusImmune);

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    f.put_i16(static_cast<vb_integer>(
        sim.Specie[static_cast<std::size_t>(k)].population));
    f.put_i16(sim.Specie[static_cast<std::size_t>(k)].SubSpeciesCounter);
  }

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k)
    f.put_bool(sim.Specie[static_cast<std::size_t>(k)].Native);

  f.put_i16(sim.opts.EGridWidth);
  f.put_bool(sim.opts.EGridEnabled);
  f.put_f32(sim.opts.oldCostX);
  f.put_bool(sim.opts.DisableMutations);
  f.put_i32(sim.opts.SimGUID);
  f.put_i16(sim.opts.SpeciationGenerationalDistance);
  f.put_i16(sim.opts.SpeciationGeneticDistance);
  f.put_bool(sim.opts.EnableAutoSpeciation);
  f.put_i16(sim.opts.SpeciationMinimumPopulation);
  f.put_i32(sim.opts.SpeciationForkInterval);

  f.put_bool(sim.opts.DisableTypArepro);

  put_lstr32(f, sim.evo.strGraphQuery1);
  put_lstr32(f, sim.evo.strGraphQuery2);
  put_lstr32(f, sim.evo.strGraphQuery3);
  put_lstr32(f, sim.evo.strSimStart);

  for (int k = 1; k <= 18; ++k) {  // NUMGRAPHS
    f.put_i32(sim.evo.graphfilecounter[k]);
    f.put_bool(sim.evo.graphvisible[k]);
    f.put_i32(sim.evo.graphleft[k]);
    f.put_i32(sim.evo.graphtop[k]);
    f.put_bool(sim.evo.graphsave[k]);
  }

  f.put_bool(sim.opts.NoWShotDecay);

  f.put_f64(sim.evo.energydif);
  f.put_f64(sim.evo.energydifX);
  f.put_f64(sim.evo.energydifXP);
  f.put_i32(sim.evo.ModeChangeCycles);
  f.put_i16(sim.evo.hidePredOffset);
  f.put_bool(sim.evo.hidepred);
  f.put_f64(sim.evo.energydif2);
  f.put_f64(sim.evo.energydifX2);
  f.put_f64(sim.evo.energydifXP2);

  f.put_bool(sim.opts.SunOnRnd);
  f.put_bool(sim.opts.DisableFixing);
  f.put_f64(sim.SunPosition);
  f.put_f64(sim.SunRange);
  f.put_byte(sim.SunChange);
  f.put_i16(sim.opts.Tides);
  f.put_i16(sim.opts.TidesOf);
  f.put_bool(sim.opts.MutOscillSine);
  f.put_bool(sim.evo.stagnent);
}

// HDRoutines.bas:1073-1568 — LoadSimulation: espejo de la secuencia con los
// gates `If Not EOF` y los presets de compatibilidad para archivos cortos.
// Quirks replicados: los teleporters Internet se borran tras cargar (bucle
// con el tope CACHEADO, como el For de VB6); `CInt(DisableMutations) < 0`
// es cierto para True (-1), así que DisableMutations NUNCA sobrevive una
// carga; el SimGUID ausente se regeneraba con Rnd CRUDO (fuera del flujo
// rndy) — aquí queda en 0 y la capa host decide (documentado, Q01).
inline void LoadSimulation(Sim& sim, VbBinFile& f,
                           const FormatGlobals& gin = {}) {
  auto& C = sim.vm.costs.v;
  // Form1.lblSaving.Visible = True (:1108): LoadRobotBody lee siempre el
  // LastMutDetail (:1750) y salta la descalificación eco-IM (:1909). RV-30.
  FormatGlobals g = gin;
  g.lblSaving_visible = true;
  auto get_str32 = [&f]() {
    const vb_long k = f.get_i32();
    return f.get_str(static_cast<std::size_t>(k < 0 ? -k : k));  // Abs
  };

  const vb_integer nbots = f.get_i16();
  sim.MaxRobs = nbots;
  sim.rob.assign(
      static_cast<std::size_t>(sim.MaxRobs + (500 - (sim.MaxRobs % 500))) + 1,
      Bot{});

  for (int k = 1; k <= sim.MaxRobs; ++k) LoadRobot(sim, k, f, g);

  RemapAllTies(sim, sim.MaxRobs);

  get_str32();      // "null"
  f.get_i16();      // 0
  get_str32();      // "null"
  f.get_i16();      // 0
  sim.opts.BlockedVegs = f.get_bool();
  C[cost::SHOTCOST] = f.get_f32();
  sim.opts.CostExecCond = f.get_f32();
  C[Costs::COSTSTORE] = f.get_f32();
  sim.opts.DeadRobotSnp = f.get_bool();
  sim.opts.SnpExcludeVegs = f.get_bool();
  get_str32();      // "null"
  f.get_bool();     // tempbool
  sim.opts.DisableTies = f.get_bool();
  sim.opts.EnergyExType = f.get_bool();
  sim.opts.EnergyFix = f.get_i16();
  sim.opts.EnergyProp = f.get_f32();
  sim.opts.FieldHeight = static_cast<vb_single>(f.get_i32());
  sim.opts.FieldSize = f.get_i16();
  sim.opts.FieldWidth = static_cast<vb_single>(f.get_i32());
  sim.opts.KillDistVegs = f.get_bool();
  sim.opts.MaxEnergy = f.get_i32();
  sim.opts.MaxPopulation = static_cast<vb_single>(f.get_i16());
  sim.opts.MinVegs = f.get_i16();
  sim.opts.MutCurrMult = f.get_f32();
  sim.opts.MutCycMax = f.get_i32();
  sim.opts.MutCycMin = f.get_i32();
  sim.opts.MutOscill = f.get_bool();
  sim.opts.PhysBrown = f.get_f32();
  sim.opts.Ygravity = f.get_f32();
  sim.opts.Zgravity = f.get_f32();
  sim.opts.PhysMoving = f.get_f32();
  sim.opts.PhysSwim = f.get_f32();
  sim.opts.PopLimMethod = f.get_i16();
  sim.opts.SimName = get_str32();
  vb_integer SpeciesNum = f.get_i16();
  sim.opts.Toroidal = f.get_bool();
  sim.opts.TotBorn = f.get_i32();
  sim.opts.TotRunCycle = f.get_i32();
  sim.opts.TotRunTime = f.get_i32();
  sim.opts.Pondmode = f.get_bool();
  sim.opts.CorpseEnabled = f.get_bool();  // dummy (KineticEnergy)
  sim.opts.LightIntensity = f.get_i16();
  sim.opts.CorpseEnabled = f.get_bool();
  sim.opts.Decay = f.get_f32();
  sim.opts.Gradient = f.get_f32();
  sim.opts.DayNight = f.get_bool();
  sim.opts.CycleLength = f.get_i16();
  sim.opts.Decaydelay = f.get_i16();
  sim.opts.DecayType = f.get_i16();

  C[cost::MOVECOST] = f.get_f32();  // obsoleto

  sim.opts.F1 = f.get_bool();
  sim.opts.Restart = f.get_bool();

  // newer stuff
  if (!f.eof()) sim.opts.Dxsxconnected = f.get_bool();
  if (!f.eof()) sim.opts.Updnconnected = f.get_bool();
  if (!f.eof()) sim.opts.RepopAmount = f.get_i16();
  if (!f.eof()) sim.opts.RepopCooldown = f.get_i16();
  if (!f.eof()) sim.opts.ZeroMomentum = f.get_bool();
  if (!f.eof()) sim.opts.UserSeedNumber = f.get_i32();
  if (!f.eof()) f.get_bool();

  if (!f.eof()) SpeciesNum = f.get_i16();
  sim.Specie.assign(static_cast<std::size_t>(SpeciesNum < 0 ? 0 : SpeciesNum),
                    Specie{});

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    // RV-40: el registro trae path + nombre, no el ADN; RobScriptLoad lo
    // relee del disco. Hasta que el host lo encuentre, no hay archivo.
    sp.dnaMissing = true;
    if (!f.eof()) sp.Colind = f.get_i16();
    if (!f.eof()) sp.color = f.get_i32();
    if (!f.eof()) sp.Fixed = f.get_bool();
    if (!f.eof())
      for (int h = 0; h <= 20; ++h) sp.Mutables.mutarray[h] = f.get_f32();
    if (!f.eof()) sp.Mutables.Mutations = f.get_bool();
    if (!f.eof()) sp.Name = get_str32();
    if (!f.eof()) f.get_bool();  // omnifeed obsoleto
    if (!f.eof()) sp.path = get_str32();
    if (!f.eof()) f.get_f32();  // Posdn viejo (descartado)
    if (!f.eof()) f.get_f32();  // Poslf viejo
    if (!f.eof()) f.get_f32();  // Posrg viejo
    if (!f.eof()) f.get_f32();  // Postp viejo
    sp.Posdn = 1;
    sp.Posrg = 1;
    sp.Poslf = 0;
    sp.Postp = 0;
    if (!f.eof()) sp.qty = f.get_i16();
    if (!f.eof())
      for (int h = 0; h <= 13; ++h) sp.Skin[h] = f.get_i16();
    if (!f.eof()) sp.Stnrg = f.get_i16();
    if (!f.eof()) sp.Veg = f.get_bool();
  }

  if (!f.eof()) f.get_i16();
  if (!f.eof()) sim.opts.VegFeedingToBody = f.get_f32();
  if (!f.eof()) sim.opts.CoefficientStatic = f.get_f32();
  if (!f.eof()) sim.opts.CoefficientKinetic = f.get_f32();
  if (!f.eof()) sim.opts.PlanetEaters = f.get_bool();
  if (!f.eof()) sim.opts.PlanetEatersG = f.get_f32();
  if (!f.eof()) sim.opts.Viscosity = f.get_f64();
  if (!f.eof()) sim.opts.Density = f.get_f64();

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    if (!f.eof()) sp.Mutables.CopyErrorWhatToChange = f.get_i16();
    if (!f.eof()) sp.Mutables.PointWhatToChange = f.get_i16();
    for (int j = 0; j <= 20; ++j) {
      if (!f.eof()) sp.Mutables.Mean[j] = f.get_f32();
      if (!f.eof()) sp.Mutables.StdDev[j] = f.get_f32();
    }
  }

  for (int k = 0; k <= 70; ++k)
    if (!f.eof()) C[k] = f.get_f32();

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    if (!f.eof()) sp.Poslf = f.get_f32();
    if (!f.eof()) sp.Posrg = f.get_f32();
    if (!f.eof()) sp.Postp = f.get_f32();
    if (!f.eof()) sp.Posdn = f.get_f32();
  }

  if (!f.eof()) sim.opts.BadWastelevel = f.get_i16();
  if (sim.opts.BadWastelevel == 0) sim.opts.BadWastelevel = 400;

  if (!f.eof()) sim.opts.chartingInterval = f.get_i16();
  if (sim.opts.chartingInterval <= 0 || sim.opts.chartingInterval > 32000)
    sim.opts.chartingInterval = 200;

  sim.opts.CoefficientElasticity = 0;
  if (!f.eof()) sim.opts.CoefficientElasticity = f.get_f32();

  sim.opts.FluidSolidCustom = 2;
  if (!f.eof()) sim.opts.FluidSolidCustom = f.get_i16();
  if (sim.opts.FluidSolidCustom < 0 || sim.opts.FluidSolidCustom > 2)
    sim.opts.FluidSolidCustom = 2;

  sim.opts.CostRadioSetting = 2;
  if (!f.eof()) sim.opts.CostRadioSetting = f.get_i16();
  if (sim.opts.CostRadioSetting < 0 || sim.opts.CostRadioSetting > 2)
    sim.opts.CostRadioSetting = 2;

  sim.opts.MaxVelocity = 40;
  if (!f.eof()) sim.opts.MaxVelocity = f.get_f32();
  if (sim.opts.MaxVelocity <= 0.0f || sim.opts.MaxVelocity > 200.0f)
    sim.opts.MaxVelocity = 40;

  sim.opts.NoShotDecay = false;
  if (!f.eof()) sim.opts.NoShotDecay = f.get_bool();

  sim.opts.SunUpThreshold = 500000;
  if (!f.eof()) sim.opts.SunUpThreshold = f.get_i32();

  sim.opts.SunUp = false;
  if (!f.eof()) sim.opts.SunUp = f.get_bool();

  sim.opts.SunDownThreshold = 1000000;
  if (!f.eof()) sim.opts.SunDownThreshold = f.get_i32();

  sim.opts.SunDown = false;
  if (!f.eof()) sim.opts.SunDown = f.get_bool();

  if (!f.eof()) f.get_bool();
  if (!f.eof()) f.get_bool();

  sim.opts.FixedBotRadii = false;
  if (!f.eof()) sim.opts.FixedBotRadii = f.get_bool();

  sim.opts.DayNightCycleCounter = 0;
  if (!f.eof()) sim.opts.DayNightCycleCounter = f.get_i32();

  sim.opts.Daytime = true;
  if (!f.eof()) sim.opts.Daytime = f.get_bool();

  sim.opts.SunThresholdMode = 0;
  if (!f.eof()) sim.opts.SunThresholdMode = f.get_i16();

  sim.numTeleporters = 0;
  if (!f.eof()) sim.numTeleporters = f.get_i16();

  for (int x = 1; x <= sim.numTeleporters; ++x) LoadTeleporter(sim, f, x);

  {
    // For X = 1 To numTeleporters con el TOPE CACHEADO (semántica del For
    // de VB6): sigue iterando índices aunque DeleteTeleporter encoja.
    const int bound = sim.numTeleporters;
    for (int x = 1; x <= bound; ++x)
      if (sim.Teleporters[x].Internet) DeleteTeleporter(sim, x);
  }

  sim.numObstacles = 0;
  if (!f.eof()) sim.numObstacles = f.get_i16();
  if (static_cast<int>(sim.Obstacles.size()) <= sim.numObstacles)
    sim.Obstacles.resize(static_cast<std::size_t>(sim.numObstacles) + 1);

  for (int x = 1; x <= sim.numObstacles; ++x) LoadObstacle(sim, f, x);

  if (!f.eof()) f.get_bool();

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    sp.CantSee = false;
    sp.DisableDNA = false;
    sp.DisableMovementSysvars = false;
    if (!f.eof()) sp.CantSee = f.get_bool();
    if (!f.eof()) sp.DisableDNA = f.get_bool();
    if (!f.eof()) sp.DisableMovementSysvars = f.get_bool();
  }

  sim.opts.shapesAreVisable = false;
  if (!f.eof()) sim.opts.shapesAreVisable = f.get_bool();
  sim.opts.allowVerticalShapeDrift = false;
  if (!f.eof()) sim.opts.allowVerticalShapeDrift = f.get_bool();
  sim.opts.allowHorizontalShapeDrift = false;
  if (!f.eof()) sim.opts.allowHorizontalShapeDrift = f.get_bool();
  sim.opts.shapesAreSeeThrough = false;
  if (!f.eof()) sim.opts.shapesAreSeeThrough = f.get_bool();
  sim.opts.shapesAbsorbShots = false;
  if (!f.eof()) sim.opts.shapesAbsorbShots = f.get_bool();
  sim.opts.shapeDriftRate = 0;
  if (!f.eof()) sim.opts.shapeDriftRate = f.get_i16();
  sim.opts.makeAllShapesTransparent = false;
  if (!f.eof()) sim.opts.makeAllShapesTransparent = f.get_bool();
  sim.opts.makeAllShapesBlack = false;
  if (!f.eof()) sim.opts.makeAllShapesBlack = f.get_bool();

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    sp.CantReproduce = false;
    if (!f.eof()) sp.CantReproduce = f.get_bool();
  }

  sim.maxshotarray = 0;
  if (!f.eof()) sim.maxshotarray = f.get_i32();

  if (sim.maxshotarray != 0 && sim.maxshotarray > 0 &&
      sim.maxshotarray < 1000000) {
    sim.Shots.assign(static_cast<std::size_t>(sim.maxshotarray) + 1, Shot{});
    for (vb_long j = 1; j <= sim.maxshotarray; ++j) LoadShot(sim, f, j);
    RemapAllShots(sim, sim.maxshotarray);
  } else {
    // Sim vieja sin shots: re-inicialización (StartLoaded).
    sim.maxshotarray = 100;
    sim.Shots.assign(static_cast<std::size_t>(sim.maxshotarray) + 1, Shot{});
  }

  sim.MaxAbsNum = sim.MaxRobs;
  if (!f.eof()) sim.MaxAbsNum = f.get_i32();

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    sp.VirusImmune = false;
    if (!f.eof()) sp.VirusImmune = f.get_bool();
  }

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    sp.population = 0;
    if (!f.eof()) sp.population = f.get_i16();
    sp.SubSpeciesCounter = 0;
    if (!f.eof()) sp.SubSpeciesCounter = f.get_i16();
  }

  for (vb_integer k = 0; k <= SpeciesNum - 1; ++k) {
    Specie& sp = sim.Specie[static_cast<std::size_t>(k)];
    sp.Native = true;
    if (!f.eof()) sp.Native = f.get_bool();
  }

  if (!f.eof()) sim.opts.EGridWidth = f.get_i16();
  sim.opts.EGridEnabled = false;
  if (!f.eof()) sim.opts.EGridEnabled = f.get_bool();
  if (!f.eof()) sim.opts.oldCostX = f.get_f32();

  sim.opts.DisableMutations = false;
  if (!f.eof()) sim.opts.DisableMutations = f.get_bool();
  // CInt(True) = -1 < 0: el flag cargado en True se RESETEA siempre.
  if (sim.opts.DisableMutations) sim.opts.DisableMutations = false;

  sim.opts.SimGUID = 0;  // CLng(Rnd) crudo del original: capa host (Q01)
  if (!f.eof()) sim.opts.SimGUID = f.get_i32();
  if (!f.eof()) sim.opts.SpeciationGenerationalDistance = f.get_i16();
  if (!f.eof()) sim.opts.SpeciationGeneticDistance = f.get_i16();
  if (!f.eof()) sim.opts.EnableAutoSpeciation = f.get_bool();
  if (!f.eof()) sim.opts.SpeciationMinimumPopulation = f.get_i16();

  sim.opts.SpeciationForkInterval = 5000;
  if (!f.eof()) sim.opts.SpeciationForkInterval = f.get_i32();

  sim.opts.DisableTypArepro = false;
  if (!f.eof()) sim.opts.DisableTypArepro = f.get_bool();

  if (!f.eof()) sim.evo.strGraphQuery1 = get_str32();
  if (!f.eof()) sim.evo.strGraphQuery2 = get_str32();
  if (!f.eof()) sim.evo.strGraphQuery3 = get_str32();
  if (!f.eof()) sim.evo.strSimStart = get_str32();

  for (int k = 1; k <= 18; ++k) {
    if (!f.eof()) sim.evo.graphfilecounter[k] = f.get_i32();
    if (!f.eof()) sim.evo.graphvisible[k] = f.get_bool();
    if (!f.eof()) sim.evo.graphleft[k] = f.get_i32();
    if (!f.eof()) sim.evo.graphtop[k] = f.get_i32();
    if (!f.eof()) sim.evo.graphsave[k] = f.get_bool();
    // Form1.NewGraph …: display ⚙.
  }

  sim.opts.NoWShotDecay = false;
  if (!f.eof()) sim.opts.NoWShotDecay = f.get_bool();

  if (!f.eof()) sim.evo.energydif = f.get_f64();
  if (!f.eof()) sim.evo.energydifX = f.get_f64();
  if (!f.eof()) sim.evo.energydifXP = f.get_f64();
  if (!f.eof()) sim.evo.ModeChangeCycles = f.get_i32();
  if (!f.eof()) sim.evo.hidePredOffset = f.get_i16();
  if (!f.eof()) sim.evo.hidepred = f.get_bool();
  if (!f.eof()) sim.evo.energydif2 = f.get_f64();
  if (!f.eof()) sim.evo.energydifX2 = f.get_f64();
  if (!f.eof()) sim.evo.energydifXP2 = f.get_f64();

  if (!f.eof()) sim.opts.SunOnRnd = f.get_bool();

  sim.opts.DisableFixing = false;
  if (!f.eof()) sim.opts.DisableFixing = f.get_bool();

  if (!f.eof()) sim.SunPosition = f.get_f64();
  if (!f.eof()) sim.SunRange = f.get_f64();
  if (!f.eof()) sim.SunChange = f.get_byte();

  if (!f.eof()) sim.opts.Tides = f.get_i16();
  if (!f.eof()) sim.opts.TidesOf = f.get_i16();
  if (!f.eof()) sim.opts.MutOscillSine = f.get_bool();
  if (!f.eof()) sim.evo.stagnent = f.get_bool();

  if (C[55] == 0.0f) C[55] = 500;  // DYNAMICCOSTSENSITIVITY

  // TmpOpts = SimOpts: espejo de UI, fuera del core.
}

// ---------------------------------------------------------------------------
// Sidecar .mrate (60-FORMATOS.md §1) — HDRoutines.bas:2562-2592. Formato de
// texto de VB6 (Write # / Input #): un valor por línea. Solo persiste los
// operadores 0..10 ("keeping some backword compatability"): las celdas
// 11..20 de mutarray/Mean/StdDev NO viajan. Los Single salen con 7 cifras
// significativas (desde 1E+07 en notación E, que al recargar puede cambiar
// el valor, RV-31); el formateo VB6 de fraccionarios (".5" sin cero
// inicial) se replica por si acaso.

namespace formats_detail {
// Formato general de 7 cifras significativas con exponente en mayúscula
// (1.234568E+07, 2E+09), el criterio de CStr(Single) del port (RV-31).
inline std::string vb_write_single(vb_single v) {
  const double d = static_cast<double>(v);
  char buf[48];
  std::snprintf(buf, sizeof(buf), "%.7G", d);
  std::string s = buf;
  if (s.rfind("0.", 0) == 0) s.erase(0, 1);          // 0.5 -> .5
  else if (s.rfind("-0.", 0) == 0) s.erase(1, 1);    // -0.5 -> -.5
  return s;
}
}  // namespace formats_detail

// Save_mrates: genera el contenido del archivo (un Write # por línea).
inline std::string Save_mrates(const Mutationprobs& mut) {
  using formats_detail::vb_write_single;
  std::string out;
  out += std::to_string(mut.PointWhatToChange) + "\r\n";
  out += std::to_string(mut.CopyErrorWhatToChange) + "\r\n";
  for (int m = 0; m <= 10; ++m) {
    out += vb_write_single(mut.mutarray[m]) + "\r\n";
    out += vb_write_single(mut.Mean[m]) + "\r\n";
    out += vb_write_single(mut.StdDev[m]) + "\r\n";
  }
  return out;
}

// Load_mrates: parsea el contenido (Input # tolera CRLF y espacios).
inline Mutationprobs Load_mrates(const std::string& text) {
  Mutationprobs mut{};
  std::size_t pos = 0;
  auto next = [&]() -> double {
    while (pos < text.size() &&
           (text[pos] == '\r' || text[pos] == '\n' || text[pos] == ' ' ||
            text[pos] == ','))
      ++pos;
    std::size_t start = pos;
    while (pos < text.size() && text[pos] != '\r' && text[pos] != '\n' &&
           text[pos] != ',')
      ++pos;
    return std::atof(text.substr(start, pos - start).c_str());
  };
  mut.PointWhatToChange = static_cast<vb_integer>(next());
  mut.CopyErrorWhatToChange = static_cast<vb_integer>(next());
  for (int m = 0; m <= 10; ++m) {
    mut.mutarray[m] = static_cast<vb_single>(next());
    mut.Mean[m] = static_cast<vb_single>(next());
    mut.StdDev[m] = static_cast<vb_single>(next());
  }
  return mut;
}

// HDRoutines.bas:423-441 — RemapAllShots: re-apunta parent por oldBotNum,
// re-engancha virusshot (stored) y libera los huérfanos.
inline void RemapAllShots(Sim& sim, vb_long numOfShots) {
  for (vb_long i = 1; i <= numOfShots; ++i) {
    if (sim.Shots[i].exist) {
      bool found = false;
      for (int j = 1; j <= sim.MaxRobs; ++j) {
        if (sim.rob[j].exist) {
          if (sim.Shots[i].parent == sim.rob[j].oldBotNum) {
            sim.Shots[i].parent = static_cast<vb_integer>(j);
            if (sim.Shots[i].stored) sim.rob[j].virusshot = i;
            found = true;
            break;  // GoTo nextshot
          }
        }
      }
      if (!found) sim.Shots[i].stored = false;  // libera el huérfano
    }
  }
}

}  // namespace db
