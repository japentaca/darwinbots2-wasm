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

// Globales de guardado del original que no viven en SimOpts (flags de UI y
// modo eco-IM). Defaults = los del harness (70-CASOS-DORADOS.md §0).
struct FormatGlobals {
  bool UseEpiGene = false;          // checkbox de opciones (salvarob)
  bool SaveWithoutMutations = false;  // MDIForm1.SaveWithoutMutations
  int y_eco_im = 0;                 // modo eco-IM (⚙): reescribe el tag
  bool sunbelt = false;             // global de mutaciones sunbelt
  bool lblSaving_visible = false;   // Form1.lblSaving (pantalla de autosave)
};

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

}  // namespace db
