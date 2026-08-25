// dbcore/loader.hpp — el cargador de ADN en texto: LoadDNA linea a linea
// (DNATokenizing.bas:59-214), Parse en modo tokenizar (:241-294), SysvarTok
// (:320-338), insertvar (Module1.bas:114-125).
// Contratos: 20-VM.md §2, §8; casos dorados V-06..V-09.
// Fuera de alcance de este milestone: metadatos '#/'# (getvals/hash,
// 60-FORMATOS.md) y la E/S de archivos (el port carga desde string).
#pragma once

#include <cctype>
#include <string>
#include <vector>

#include "bot.hpp"
#include "dna.hpp"
#include "vb.hpp"

namespace db {

// Tabla de sysvars (LoadSysVars llena 247 nombres; A3/sysvars.yaml — se
// cargará completa en el milestone de memoria; los tests inyectan las suyas).
struct SysvarTable {
  std::vector<Var> entries;
};

namespace loader_detail {

// Error runtime de VB6 capturado por el handler `fine:` de LoadDNA — el
// archivo entero se rechaza ("no valid robot", sin diálogo modal: V-09).
struct VbError {
  int number;  // 5, 6 o 9
};

inline std::string lcase(std::string s) {
  for (char& ch : s)
    ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
  return s;
}

// Trim de VB6: solo espacios (no tabs ni CrLf), ambos extremos.
inline std::string vb_trim(const std::string& s) {
  const std::size_t b0 = s.find_first_not_of(' ');
  if (b0 == std::string::npos) return "";
  const std::size_t b1 = s.find_last_not_of(' ');
  return s.substr(b0, b1 - b0 + 1);
}

// stringops.bas:74-83 — replacechars: caracteres de control y altos -> '?'.
inline std::string replacechars(std::string s) {
  for (char& ch : s) {
    const unsigned char u = static_cast<unsigned char>(ch);
    if (u <= 31 || (u >= 127 && u <= 254)) ch = '?';
  }
  return s;
}

// Val() de VB6: parsea el prefijo numerico (signo, digitos, punto decimal,
// exponente); cualquier otra cosa -> 0. Sin soporte &H/&O (no aparece en
// ADN). A diferencia de strtod, no reconoce "inf"/"nan".
inline double vb_val(const std::string& s) {
  size_t i = 0;
  const size_t n = s.size();
  size_t start = i;
  if (i < n && (s[i] == '+' || s[i] == '-')) ++i;
  size_t digits = 0;
  while (i < n && std::isdigit(static_cast<unsigned char>(s[i]))) ++i, ++digits;
  if (i < n && s[i] == '.') {
    ++i;
    while (i < n && std::isdigit(static_cast<unsigned char>(s[i])))
      ++i, ++digits;
  }
  if (digits == 0) return 0.0;
  if (i < n && (s[i] == 'e' || s[i] == 'E' || s[i] == 'd' || s[i] == 'D')) {
    size_t j = i + 1;
    if (j < n && (s[j] == '+' || s[j] == '-')) ++j;
    size_t edig = 0;
    while (j < n && std::isdigit(static_cast<unsigned char>(s[j]))) ++j, ++edig;
    if (edig > 0) i = j;
  }
  return std::stod(s.substr(start, i - start));
}

// Asignacion Double -> Integer de VB6: redondeo bancario; fuera de +-32767
// lanza error 6 (rechaza el archivo entero, V-09 / 20-VM.md §2.4).
inline vb_integer to_vb_integer(double v) {
  const std::int64_t i = vb_round64(v);
  if (i < -32768 || i > 32767) throw VbError{6};
  return static_cast<vb_integer>(i);
}

// SysvarTok (DNATokenizing.bas:320-338). Con prefijo '.': sysvars
// (case-insensitive) y despues privadas del bot (case-sensitive); en ambas
// busquedas gana la ULTIMA coincidencia (una privada sombrea a la sysvar).
// Sin prefijo: val() con el wrap de error 6.
inline vb_integer SysvarTok(const std::string& a, const Bot& bot,
                            const SysvarTable& sysvars) {
  if (!a.empty() && a[0] == '.') {
    const std::string name = a.substr(1);
    const std::string name_lc = lcase(name);
    vb_integer r = 0;
    for (const Var& sv : sysvars.entries)
      if (lcase(sv.name) == name_lc) r = sv.value;
    for (std::size_t t = 1; t < bot.vars.size(); ++t)
      if (bot.vars[t].name == name) r = bot.vars[t].value;
    return r;
  }
  return to_vb_integer(vb_val(a));
}

// Tablas de tokens (DNATokenizing.bas:374-763). Cada una devuelve value 0 si
// no reconoce; el encadenado de Parse prueba en este orden.
inline Block BasicCommandTok(const std::string& s) {
  Block b{tok::BASIC, 0};
  if (s == "add") b.value = 1;
  else if (s == "sub") b.value = 2;
  else if (s == "mult") b.value = 3;
  else if (s == "div") b.value = 4;
  else if (s == "rnd") b.value = 5;
  else if (s == "*") b.value = 6;
  else if (s == "mod") b.value = 7;
  else if (s == "sgn") b.value = 8;
  else if (s == "abs") b.value = 9;
  else if (s == "dup" || s == "dupint") b.value = 10;
  else if (s == "drop" || s == "dropint") b.value = 11;
  else if (s == "clear" || s == "clearint") b.value = 12;
  else if (s == "swap" || s == "swapint") b.value = 13;
  else if (s == "over" || s == "overint") b.value = 14;
  return b;
}

// debugint/debugbool no tokenizan bajo ismutating (DNATokenizing.bas:481-484).
inline Block AdvancedCommandTok(const std::string& s, bool ismutating) {
  Block b{tok::ADVANCED, 0};
  if (s == "angle") b.value = 1;
  else if (s == "dist") b.value = 2;
  else if (s == "ceil") b.value = 3;
  else if (s == "floor") b.value = 4;
  else if (s == "sqr") b.value = 5;
  else if (s == "pow") b.value = 6;
  else if (s == "pyth") b.value = 7;
  else if (s == "anglecmp") b.value = 8;
  else if (s == "root") b.value = 9;
  else if (s == "logx") b.value = 10;
  else if (s == "sin") b.value = 11;
  else if (s == "cos") b.value = 12;
  else if (s == "debugint" && !ismutating) b.value = 13;
  else if (s == "debugbool" && !ismutating) b.value = 14;
  return b;
}

inline Block BitwiseCommandTok(const std::string& s) {
  Block b{tok::BITWISE, 0};
  if (s == "~") b.value = 1;
  else if (s == "&") b.value = 2;
  else if (s == "|") b.value = 3;
  else if (s == "^") b.value = 4;
  else if (s == "++") b.value = 5;
  else if (s == "--") b.value = 6;
  else if (s == "-") b.value = 7;
  else if (s == "<<") b.value = 8;
  else if (s == ">>") b.value = 9;
  return b;
}

inline Block ConditionsTok(const std::string& s) {
  Block b{tok::CONDITION, 0};
  if (s == "<") b.value = 1;
  else if (s == ">") b.value = 2;
  else if (s == "=") b.value = 3;
  else if (s == "!=") b.value = 4;
  else if (s == "%=") b.value = 5;
  else if (s == "!%=") b.value = 6;
  else if (s == "~=") b.value = 7;
  else if (s == "!~=") b.value = 8;
  else if (s == ">=") b.value = 9;
  else if (s == "<=") b.value = 10;
  return b;
}

inline Block LogicTok(const std::string& s) {
  Block b{tok::LOGIC, 0};
  if (s == "and") b.value = 1;
  else if (s == "or") b.value = 2;
  else if (s == "xor") b.value = 3;
  else if (s == "not") b.value = 4;
  else if (s == "true") b.value = 5;
  else if (s == "false") b.value = 6;
  else if (s == "dropbool") b.value = 7;
  else if (s == "clearbool") b.value = 8;
  else if (s == "dupbool") b.value = 9;
  else if (s == "swapbool") b.value = 10;
  else if (s == "overbool") b.value = 11;
  return b;
}

inline Block StoresTok(const std::string& s) {
  Block b{tok::STORE, 0};
  if (s == "store") b.value = 1;
  else if (s == "inc") b.value = 2;
  else if (s == "dec") b.value = 3;
  else if (s == "addstore") b.value = 4;
  else if (s == "substore") b.value = 5;
  else if (s == "multstore") b.value = 6;
  else if (s == "divstore") b.value = 7;
  else if (s == "ceilstore") b.value = 8;
  else if (s == "floorstore") b.value = 9;
  else if (s == "rndstore") b.value = 10;
  else if (s == "sgnstore") b.value = 11;
  else if (s == "absstore") b.value = 12;
  else if (s == "sqrstore") b.value = 13;
  else if (s == "negstore") b.value = 14;
  return b;
}

inline Block FlowTok(const std::string& s) {
  Block b{tok::FLOW, 0};
  if (s == "cond") b.value = 1;
  else if (s == "start") b.value = 2;
  else if (s == "else") b.value = 3;
  else if (s == "stop") b.value = 4;
  return b;
}

inline Block MasterFlowTok(const std::string& s) {
  Block b{tok::MASTER, 0};
  if (s == "end") b.value = 1;
  return b;
}

}  // namespace loader_detail

// DNATokenizing.bas:822-846 — Hash: suma rodante por posición Mod f con
// acarreo del vecino, Mod 100, emitida como Chr(33..125). OJO: `s` va ByRef
// en el original — Hash TRIMEA y recorta los CrLf finales DEL LLAMADOR
// (salvarob imprime el `hold` ya mutado; getvals sigue acumulando sobre el
// `hold` mutado). La firma del port replica esa mutación.
inline std::string Hash(std::string& s, int f) {
  s = loader_detail::vb_trim(s);
  while (s.size() >= 2 && s.compare(s.size() - 2, 2, "\r\n") == 0)
    s.resize(s.size() - 2);
  std::vector<vb_long> buf(101, 0);  // Dim buf(100)
  for (std::size_t k = 1; k <= s.size(); ++k) {
    const std::size_t i = k % static_cast<std::size_t>(f);
    buf[i] += static_cast<unsigned char>(s[k - 1]);           // Asc
    buf[i] += buf[(k - 1) % static_cast<std::size_t>(f)];
    buf[i] %= 100;
  }
  std::string h;
  for (int k = 0; k < f; ++k)
    h += static_cast<char>(buf[k] % 93 + 33);
  return h;
}

namespace loader_detail {

// DNATokenizing.bas:767-817 — getvals: metadatos '#/'#. El `On Error GoTo
// skip` del original convierte cualquier línea malformada en un no-op (el
// archivo NO se rechaza). El hash que no cuadra resetea generation y
// OldMutations (anti-manipulación, FM-04).
inline void getvals(Bot& bot, const std::string& a_in, std::string& hold) {
  const std::size_t colon = a_in.find(':');
  if (colon == std::string::npos) return;  // Left(a, -1) -> error 5 -> skip
  std::string name = vb_trim(a_in.substr(0, colon));
  const std::string value = vb_trim(a_in.substr(colon + 1));
  name = (name.size() >= 2) ? name.substr(2) : "";  // Mid$(Name, 3)

  if (name == "generation") {
    const std::int64_t g = vb_round64(vb_val(value));
    if (g < -32768 || g > 32767) return;  // error 6 -> skip
    bot.generation = static_cast<vb_integer>(g);
  }
  if (name == "mutations") {
    const std::int64_t m = vb_round64(vb_val(value));
    if (m < -2147483648LL || m > 2147483647LL) return;  // error 6 -> skip
    bot.OldMutations = static_cast<vb_long>(m);
  }
  if (name == "tag") {
    // rob(n).tag = Left(replacechars(value), 45): asignación a String * 50
    // rellena con espacios a la derecha.
    std::string t = replacechars(value);
    if (t.size() > 45) t.resize(45);
    t.resize(50, ' ');
    bot.tag = t;
  }
  if (name == "hash") {
    const std::string value2 = Hash(hold, 20);  // muta hold (ByRef)
    if (value2 != value) {
      bot.generation = 0;
      bot.OldMutations = 0;
    }
  }
}

}  // namespace loader_detail

// Parse en modo tokenizar (DNATokenizing.bas:241-294): los comandos se
// comparan en minusculas; lo no reconocido acaba en SysvarTok — el
// tokenizador no rechaza nada (V-08); solo el literal fuera de +-32767
// lanza (error 6, capturado por LoadDNAText).
inline Block ParseToken(const std::string& word, const Bot& bot,
                        const SysvarTable& sysvars, bool ismutating = false) {
  using namespace loader_detail;
  const std::string lc = lcase(word);
  Block bp = BasicCommandTok(lc);
  if (bp.value == 0) bp = AdvancedCommandTok(lc, ismutating);
  if (bp.value == 0) bp = BitwiseCommandTok(lc);
  if (bp.value == 0) bp = ConditionsTok(lc);
  if (bp.value == 0) bp = LogicTok(lc);
  if (bp.value == 0) bp = StoresTok(lc);
  if (bp.value == 0) bp = FlowTok(lc);
  if (bp.value == 0) bp = MasterFlowTok(lc);
  if (bp.value == 0 && !word.empty() && word[0] == '*') {
    bp.tipo = tok::DEREF;
    bp.value = SysvarTok(word.substr(1), bot, sysvars);
  } else if (bp.value == 0) {
    bp.tipo = tok::NUMBER;
    bp.value = SysvarTok(word, bot, sysvars);
  }
  return bp;
}

namespace loader_detail {

// insertvar (Module1.bas:114-125): recorta 4 caracteres y parte por el
// primer espacio. Malformado -> error 5; valor fuera de rango -> error 6;
// def numero 1001 -> error 9 (vars(1000)). Todos rechazan el archivo.
inline void insertvar(Bot& bot, const std::string& line) {
  if (line.size() < 4) throw VbError{5};  // Right(a, Len-4) con Len < 4
  const std::string a = line.substr(4);
  const std::size_t pos = a.find(' ');
  if (pos == std::string::npos) throw VbError{5};  // Left(a, -1)
  const std::string name = a.substr(0, pos);
  const std::string val_text = a.substr(pos + 1);
  if (bot.vnum > 1000) throw VbError{9};  // vars(1000) desbordado
  bot.vars.push_back(Var{name, to_vb_integer(vb_val(val_text))});
  bot.vnum += 1;
}

}  // namespace loader_detail

// LoadDNA linea a linea (DNATokenizing.bas:59-214) sobre texto ya en
// memoria. Devuelve false = "no valid robot" (el bot no entra, V-09).
// Los metadatos '#/'# (getvals) quedan para el milestone de formatos.
inline bool LoadDNAText(const std::string& text, Bot& bot,
                        const SysvarTable& sysvars, bool ismutating = false) {
  using namespace loader_detail;
  bot.dna.assign(1, Block{0, 0});  // ReDim dna(0): fantasma (0,0)
  bot.vars.assign(1, Var{});
  bot.vnum = 1;
  bool useref = false;
  std::string hold;  // acumulador para la verificación de '#hash (FM-04)

  try {
    std::size_t line_start = 0;
    while (line_start <= text.size()) {
      std::size_t nl = text.find('\n', line_start);
      if (nl == std::string::npos) nl = text.size();
      std::string a = text.substr(line_start, nl - line_start);
      line_start = nl + 1;
      if (!a.empty() && a.back() == '\r') a.pop_back();
      const std::string clonea = a;  // la línea cruda, para hold (:87,150)

      // Comentario ' : corta solo si NO esta en la columna 1 (:92-93).
      const std::size_t qpos = a.find('\'');
      if (qpos != std::string::npos && qpos > 0) a = a.substr(0, qpos);

      for (char& ch : a)
        if (ch == '\t') ch = ' ';
      const std::size_t b0 = a.find_first_not_of(' ');
      const std::size_t b1 = a.find_last_not_of(' ');
      a = (b0 == std::string::npos) ? "" : a.substr(b0, b1 - b0 + 1);

      if (!a.empty() && a[0] != '\'' && a[0] != '/') {
        if (a.compare(0, 3, "def") == 0) {
          // Cualquier linea que empiece por "def" define (V-08: "defensa 50"
          // define la variable `nsa`).
          insertvar(bot, a);
          useref = true;
        } else {
          std::size_t wpos = 0;
          while (wpos < a.size()) {
            const std::size_t wend = a.find(' ', wpos);
            const std::string word =
                a.substr(wpos, (wend == std::string::npos ? a.size() : wend) -
                                   wpos);
            wpos = (wend == std::string::npos) ? a.size() : wend + 1;
            if (!word.empty())
              bot.dna.push_back(ParseToken(word, bot, sysvars, ismutating));
          }
        }
      } else if (a.compare(0, 2, "'#") == 0 || a.compare(0, 2, "/#") == 0) {
        // Metadatos: generation/mutations/tag/hash (:144-149, getvals).
        getvals(bot, a, hold);
      }
      hold += clonea + "\r\n";  // here: hold = hold & clonea & vbCrLf (:150)
      if (nl == text.size()) break;
    }
  } catch (const loader_detail::VbError&) {
    return false;  // handler fine: -> "no valid robot", sin dialogo modal
  }

  bot.dna.push_back(Block{10, 1});  // end final, siempre (:156-161)

  // Correccion del cero inicial (:165-174) — [PROBABLE BUG] A2-2 (V-06):
  // con defs, dna(0) fantasma y primer token no-flujo, todo se corre una
  // posicion a la izquierda (el primer token queda fuera del rango
  // ejecutable; un archivo solo-defs deja el array en [end]).
  if (useref && bot.dna[0] == Block{0, 0} && bot.dna.size() >= 2 &&
      bot.dna[1].tipo != tok::FLOW) {
    bot.dna.erase(bot.dna.begin());
  }
  return true;
}

// RobScriptLoad reducido al nucleo (Module1.bas:8-26): carga y publica
// mem(336) = DnaLen y mem(339) = CountGenes. preparerob (6 RNG, nrg=20000)
// queda para el milestone del ciclo.
inline bool RobScriptLoadText(const std::string& text, Bot& bot,
                              const SysvarTable& sysvars,
                              bool ismutating = false) {
  if (!LoadDNAText(text, bot, sysvars, ismutating)) return false;
  bot.genenum = CountGenes(bot.dna);
  bot.mem[DnaLenSys] = static_cast<vb_integer>(DnaLen(bot.dna));
  bot.mem[GenesSys] = static_cast<vb_integer>(bot.genenum);
  return true;
}

}  // namespace db
