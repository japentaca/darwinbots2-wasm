// Casos dorados N-01..N-19 (70-CASOS-DORADOS.md §2, numérica base).
// Prioridad 1 — salvaguarda 5 de PLAN.md: estos casos cazan regresiones de
// build (overflow, redondeo bancario, promociones FP) y van antes que
// cualquier subsistema.
#include "doctest.h"
#include "dbcore/dnaops.hpp"

using namespace db;

namespace {

// Ejecuta un handler binario "pila ... a b" y devuelve el tope resultante.
template <typename Op>
vb_long run2(Op op, vb_long a, vb_long b) {
  IntStack s;
  s.push(a);
  s.push(b);
  op(s);
  return s.pop();
}

template <typename Op>
vb_long run1(Op op, vb_long a) {
  IntStack s;
  s.push(a);
  op(s);
  return s.pop();
}

vb_long add2(vb_long a, vb_long b) {
  IntStack s;
  VmDiag d;
  s.push(a);
  s.push(b);
  DNAadd(s, d);
  return s.pop();
}

vb_long sub2(vb_long a, vb_long b) {
  IntStack s;
  VmDiag d;
  s.push(a);
  s.push(b);
  DNASub(s, d);
  return s.pop();
}

}  // namespace

TEST_CASE("N-01 redondeo bancario de referencia") {
  CHECK(vb_round64(0.5) == 0);
  CHECK(vb_round64(1.5) == 2);
  CHECK(vb_round64(2.5) == 2);
  CHECK(vb_round64(3.5) == 4);
  CHECK(vb_round64(-0.5) == 0);
  CHECK(vb_round64(-1.5) == -2);
  CHECK(vb_round64(20.5) == 20);
  CHECK(vb_round64(20.67) == 21);
  CHECK(vb_round64(-3.51) == -4);
}

TEST_CASE("N-02 mod32000: normalizacion de escritura a mem") {
  CHECK(mod32000(0) == 0);
  CHECK(mod32000(1) == 1);
  CHECK(mod32000(31999) == 31999);
  CHECK(mod32000(32000) == 32000);
  CHECK(mod32000(32001) == 1);
  CHECK(mod32000(63999) == 31999);
  CHECK(mod32000(64000) == 32000);
  CHECK(mod32000(96000) == 32000);
  CHECK(mod32000(-32000) == -32000);
  CHECK(mod32000(-32001) == -1);
  CHECK(mod32000(-64000) == -32000);
}

TEST_CASE("N-03 div: division real con redondeo bancario (no trunca)") {
  CHECK(run2(DNAdiv, 7, 2) == 4);
  CHECK(run2(DNAdiv, 5, 2) == 2);
  CHECK(run2(DNAdiv, -5, 2) == -2);
  CHECK(run2(DNAdiv, 7, -2) == -4);
  CHECK(run2(DNAdiv, 1, 0) == 0);
  CHECK(run2(DNAdiv, 0, 5) == 0);
}

TEST_CASE("N-04 mod: truncado con el signo del dividendo") {
  CHECK(run2(DNAmod, 7, 3) == 1);
  CHECK(run2(DNAmod, -7, 3) == -1);
  CHECK(run2(DNAmod, 7, -3) == 1);
  CHECK(run2(DNAmod, -7, -3) == -1);
  // b = 0: consume el dividendo y push 0 — la pila queda con solo ese 0.
  {
    IntStack s;
    s.push(5);
    s.push(0);
    DNAmod(s);
    CHECK(s.size() == 1);
    CHECK(s.pop() == 0);
  }
}

TEST_CASE("N-05 add/sub: envolvimiento explicito en +-2e9") {
  CHECK(add2(1500000000, 1500000000) == 1000000000);
  CHECK(add2(-1500000000, -1500000000) == -1000000000);
  CHECK(sub2(1500000000, -1500000000) == 1000000000);
  // El Mod anula el operando limite: 2000000000 x add = x.
  CHECK(add2(2000000000, 1) == 1);
  CHECK(sub2(100, 200) == -100);
}

TEST_CASE("N-06 add: perdida de precision Single sobre 2^24") {
  // 16777217 -> Single 16777216; la suma "no avanza".
  CHECK(add2(16777217, 1) == 16777217);
  // 2000000001 -> Single 2000000000 exacto; Mod 2e9 = 0.
  CHECK(add2(2000000001, 5) == 5);
  // 2^24 es exacto: suma normal.
  CHECK(add2(16777216, 1) == 16777217);
}

TEST_CASE("N-07 add/sub con operando ~2^31: decision de port (Q17)") {
  // Original: error 6 + truncamiento del tick. Port (20-VM.md §6.1): saturar
  // a Sgn*2e9 y registrar la divergencia.
  {
    IntStack s;
    VmDiag d;
    s.push(2147483647);
    s.push(1);
    DNAadd(s, d);
    CHECK(s.pop() == 2000000000);
    CHECK(d.q17_saturations == 1);
  }
  // 2147483584 (empate al par con mantisa par) tambien redondea a 2^31.
  {
    IntStack s;
    VmDiag d;
    s.push(2147483584);
    s.push(1);
    DNAadd(s, d);
    CHECK(s.pop() == 2000000000);
    CHECK(d.q17_saturations == 1);
  }
  // 2147483583 redondea hacia abajo (2147483520): camino normal, sin flag.
  {
    IntStack s;
    VmDiag d;
    s.push(2147483583);
    s.push(1);
    DNAadd(s, d);
    CHECK(s.pop() == 147483521);
    CHECK(d.q17_saturations == 0);
  }
}

TEST_CASE("N-08 mult: saturacion (asimetria con add/sub)") {
  CHECK(run2(DNAmult, 2000000000, 2) == 2000000000);
  CHECK(run2(DNAmult, -2000000000, 2) == -2000000000);
  CHECK(run2(DNAmult, 32000, 32000) == 1024000000);
  CHECK(run2(DNAmult, 50000, 40000) == 2000000000);
  CHECK(run2(DNAmult, 0, 5) == 0);
}

TEST_CASE("N-09 pow") {
  CHECK(run2(DNApow, 2, 10) == 1024);
  CHECK(run2(DNApow, 2, 15) == 1024);  // b saturado a 10
  CHECK(run2(DNApow, 10, 10) == 2000000000);
  CHECK(run2(DNApow, 2, -1) == 0);
  CHECK(run2(DNApow, 2, -2) == 0);
  CHECK(run2(DNApow, -2, 3) == -8);
  CHECK(run2(DNApow, 0, 0) == 0);  // la guarda a = 0 gana (no es 1)
  CHECK(run2(DNApow, -2, -10) == 0);
}

TEST_CASE("N-10 sqr") {
  CHECK(run1(DNASqr, 16) == 4);
  CHECK(run1(DNASqr, 17) == 4);
  CHECK(run1(DNASqr, 2) == 1);
  CHECK(run1(DNASqr, 3) == 2);
  CHECK(run1(DNASqr, 0) == 0);
  CHECK(run1(DNASqr, -4) == 0);
}

TEST_CASE("N-11 root y logx") {
  CHECK(run2(DNAroot, 8, 3) == 2);
  CHECK(run2(DNAroot, -8, -3) == 2);  // Abs de ambos
  CHECK(run2(DNAroot, 5, 0) == 0);
  CHECK(run2(DNAlogx, 8, 2) == 3);
  CHECK(run2(DNAlogx, 7, 2) == 3);
  CHECK(run2(DNAlogx, -7, -2) == 3);
  CHECK(run2(DNAlogx, 5, 1) == 0);  // b < 2
  CHECK(run2(DNAlogx, 0, 2) == 0);  // a = 0
}

TEST_CASE("N-12 sin/cos: sin normalizacion del argumento") {
  CHECK(run1(DNAsin, 0) == 0);
  CHECK(run1(DNAsin, 314) == 32000);
  CHECK(run1(DNAsin, 628) == 51);  // 628/200 = 3.14 != pi
  CHECK(run1(DNAsin, 1256) == -102);
  CHECK(run1(DNAsin, 100) == 15342);
  CHECK(run1(DNAcos, 0) == 32000);
  CHECK(run1(DNAcos, 628) == -32000);
}

TEST_CASE("N-13 ceil/floor: asimetria de tipos") {
  CHECK(run2(DNAceil, 5, 3) == 3);    // ceil = minimo
  CHECK(run2(DNAfloor, 5, 3) == 5);   // floor = maximo
  CHECK(run2(DNAceil, -5, 3) == -5);
  // ceil compara en Single: ambos -> 16777216.
  CHECK(run2(DNAceil, 16777217, 16777216) == 16777216);
  // floor compara exacto en Long.
  CHECK(run2(DNAfloor, 16777217, 16777216) == 16777217);
}

TEST_CASE("N-14 pyth") {
  CHECK(run2(DNApyth, 3, 4) == 5);
  CHECK(run2(DNApyth, 30000, 40000) == 50000);
  CHECK(run2(DNApyth, 0, 0) == 0);
}

TEST_CASE("N-15 anglecmp") {
  CHECK(run2(DNAanglecmp, 0, 628) == -628);
  CHECK(run2(DNAanglecmp, 628, 0) == 628);
  CHECK(run2(DNAanglecmp, 0, 629) == 628);  // cruza -pi: +2pi
  CHECK(run2(DNAanglecmp, 1256, 0) == 0);
  CHECK(run2(DNAanglecmp, 100, 1356) == 0);
  CHECK(run2(DNAanglecmp, -100, 0) == -101);
}

TEST_CASE("N-16 underflow de stacks: la tabla completa") {
  SUBCASE("aritmetica sobre pila vacia opera sobre ceros") {
    IntStack s;
    VmDiag d;
    DNAadd(s, d);
    CHECK(s.size() == 1);
    CHECK(s.pop() == 0);
    DNAmult(s);
    CHECK(s.pop() == 0);
    DNAdiv(s);
    CHECK(s.pop() == 0);
    DNAmod(s);
    CHECK(s.pop() == 0);
  }
  SUBCASE("dup sobre vacia apila DOS ceros (sin guarda)") {
    IntStack s;
    DNAdup(s);
    CHECK(s.size() == 2);
    CHECK(s.pop() == 0);
    CHECK(s.pop() == 0);
  }
  SUBCASE("drop sobre vacia: no-op neto") {
    IntStack s;
    s.pop();  // drop = PopIntStack descartado
    CHECK(s.size() == 0);
  }
  SUBCASE("swap con <=1 elemento: no-op") {
    IntStack s;
    s.swap();
    CHECK(s.size() == 0);
    s.push(7);
    s.swap();
    CHECK(s.size() == 1);
    CHECK(s.pop() == 7);
  }
  SUBCASE("over: vacia no-op; 1 elemento apila 0 encima") {
    IntStack s;
    s.over();
    CHECK(s.size() == 0);
    s.push(5);
    s.over();
    CHECK(s.size() == 2);
    CHECK(s.pop() == 0);
    CHECK(s.pop() == 5);
  }
  SUBCASE("dupbool sobre vacia: NO-OP (asimetrico con dup)") {
    BoolStack c;
    c.dup();
    CHECK(c.size() == 0);
  }
  SUBCASE("swapbool con <=1: no-op") {
    BoolStack c;
    c.swap();
    CHECK(c.size() == 0);
  }
  SUBCASE("overbool: vacia no-op; 1 elemento apila True") {
    BoolStack c;
    c.over();
    CHECK(c.size() == 0);
    c.push(false);
    c.over();
    CHECK(c.size() == 2);
    CHECK(c.pop() == VB_TRUE);
    CHECK(c.pop() == VB_FALSE);
  }
  SUBCASE("not sobre vacia: push False (Not True)") {
    BoolStack c;
    DNAnot(c);
    CHECK(c.size() == 1);
    CHECK(c.pop() == VB_FALSE);
  }
  SUBCASE("and sobre vacia: push True") {
    BoolStack c;
    DNAand(c);
    CHECK(c.pop() == VB_TRUE);
  }
  SUBCASE("or con 1 elemento False: push True (a ausente => True Or b)") {
    BoolStack c;
    c.push(false);
    DNAor(c);
    CHECK(c.pop() == VB_TRUE);
  }
  SUBCASE("xor con 1 elemento b: push Not b") {
    BoolStack c;
    c.push(true);
    DNAxor(c);
    CHECK(c.pop() == VB_FALSE);
    c.push(false);
    DNAxor(c);
    CHECK(c.pop() == VB_TRUE);
  }
  SUBCASE("comparaciones sobre vacia: 0 contra 0") {
    IntStack s;
    BoolStack c;
    DNAequal(s, c);
    CHECK(c.pop() == VB_TRUE);  // 0 = 0
    DNAless(s, c);
    CHECK(c.pop() == VB_FALSE);  // 0 < 0
    DNAgreaterequal(s, c);
    CHECK(c.pop() == VB_TRUE);  // 0 >= 0
  }
  SUBCASE("debugbool sobre vacia: push True (CBool(-5))") {
    BoolStack c;
    DNAdebugbool(c);
    CHECK(c.pop() == VB_TRUE);
  }
}

TEST_CASE("N-17 overflow de stack: descarta el fondo") {
  IntStack s;
  for (vb_long i = 1; i <= 102; ++i) s.push(i);
  for (vb_long expect = 102; expect >= 2; --expect) CHECK(s.pop() == expect);
  CHECK(s.pop() == 0);  // el valor 1 se perdio
  // Mismo contrato para el stack booleano: 102 pushes de True tras uno de
  // False; el False del fondo se pierde.
  BoolStack c;
  c.push(false);
  for (int i = 0; i < 101; ++i) c.push(true);
  for (int i = 0; i < 101; ++i) CHECK(c.pop() == VB_TRUE);
  CHECK(c.pop() == BOOL_EMPTY);
}

TEST_CASE("N-18 bitwise: tabla y edges") {
  CHECK(run1(DNABitwiseCompliment, 0) == -1);
  CHECK(run1(DNABitwiseCompliment, 5) == -6);
  CHECK(run1(DNABitwiseCompliment, 2000000000) == -2000000001);
  CHECK(run2(DNABitwiseAND, 12, 10) == 8);
  CHECK(run2(DNABitwiseOR, 12, 10) == 14);
  CHECK(run2(DNABitwiseXOR, 12, 10) == 6);
  CHECK(run2(DNABitwiseAND, -1, 1) == 1);
  // 0x7FFFFFFF ++ = 0x80000000 -> BitToNumber decodifica 0.
  CHECK(run1(DNABitwiseINC, 2147483647) == 0);
  CHECK(run1(DNABitwiseDEC, 0) == -1);
  CHECK(run1(DNAnegate, 5) == -5);
  CHECK(run1(DNABitwiseShiftLeft, 1) == 2);
  CHECK(run1(DNABitwiseShiftLeft, 1073741824) == 0);  // 2^30 -> bit31 -> 0
  CHECK(run1(DNABitwiseShiftLeft, 1610612736) == -1073741824);
  CHECK(run1(DNABitwiseShiftRight, -1) == -1);  // aritmetico
  CHECK(run1(DNABitwiseShiftRight, 4) == 2);
  CHECK(run1(DNABitwiseShiftRight, -8) == -4);
}

TEST_CASE("N-19 %= / !%= : el intervalo invertido") {
  auto cequa = [](vb_long a, vb_long b) {
    IntStack s;
    BoolStack c;
    s.push(a);
    s.push(b);
    DNAcequa(s, c);
    return c.pop() == VB_TRUE;
  };
  CHECK(cequa(100, 105));
  CHECK_FALSE(cequa(100, 111));
  CHECK(cequa(100, 90));  // borde inferior inclusivo
  // Con a < 0 NO hay ningun b que pase, ni b = a.
  CHECK_FALSE(cequa(-100, -100));
  CHECK(cequa(0, 0));
  CHECK_FALSE(cequa(0, 1));

  // !%= es la negacion exacta.
  auto cdiff = [](vb_long a, vb_long b) {
    IntStack s;
    BoolStack c;
    s.push(a);
    s.push(b);
    DNAcdiff(s, c);
    return c.pop() == VB_TRUE;
  };
  CHECK_FALSE(cdiff(100, 105));
  CHECK(cdiff(100, 111));
  CHECK(cdiff(-100, -100));

  // ~= generaliza con c = a/100*d (pila a b d).
  auto customcequa = [](vb_long a, vb_long b, vb_long d) {
    IntStack s;
    BoolStack c;
    s.push(a);
    s.push(b);
    s.push(d);
    DNAcustomcequa(s, c);
    return c.pop() == VB_TRUE;
  };
  CHECK(customcequa(10, 12, 30));
  CHECK_FALSE(customcequa(10, 14, 30));
  CHECK_FALSE(customcequa(-100, -100, 10));  // mismo sesgo con a < 0
}
