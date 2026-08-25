# 70 — Casos dorados

> Documento del Bloque C; cierra la especificación. Fuente de verdad: el código citado
> sobre el commit `02b20d7`. Cada caso da: estado inicial mínimo, pasos, resultado
> esperado con su derivación citada línea a línea, y clasificación
> **[unit]** / **[ciclo]** / **[integración]**. Los valores esperados se derivaron por
> computación manual verificable desde el fuente; ninguno viene del wiki. Los casos que
> dependen del `Rnd` de VB6 se parametrizan por una **secuencia de RNG inyectada**
> (lista de valores de `rndy`), de modo que el test del subsistema no acopla al
> generador; el generador tiene sus propios casos (§7.1, `[FUENTE EXTERNA: MS]`).
> Regla 4 del brief: los `[PROBABLE BUG]` se testean **como comportamiento correcto**
> (§9 mapea el catálogo completo). Premisa numérica (corrección 2026-08-16,
> `00-INVENTARIO.md §1`): el EXE compila **con** chequeos; no existe el wrap
> silencioso; los sitios de error 6/9/11 truncan el tick (`10-CICLO.md §14`) y cada
> caso de esos sitios especifica la **decisión de port** en vez de un valor.

---

## 0. Convenciones del harness

Estas convenciones aplican a todos los casos salvo indicación contraria:

1. **Costes a cero.** `SimOpts.Costs(0..70) = 0` salvo que el caso fije otra cosa
   (los casos de coste usan el preset F1 de `constants.yaml §preset_f1`). Con costes 0
   la energía del bot no cambia por ejecutar ADN.
2. **Constantes de mundo por defecto**: `MaxMem = 1000` (`main.frm:384`,
   `Robots.bas:376`), `MaxVelocity = 40` (el valor al que la carga fuerza un MaxVelocity
   fuera de (0,200], `HDRoutines.bas:1298-1300`), campo 32000×32000 (⇒
   `xDivisor = yDivisor = 1`, `main.frm:1252-1256`), sin pondmode, `Daytime = True`,
   sin gravedad/fricción/brownianas salvo el caso.
3. **VM aislada**: los casos [unit] de la VM precargan `IntStack`/`Condst` directamente
   (los stacks son globales, `DNA.bas:30-44`) y ejecutan **un** handler de operador, o
   bien ejecutan un `ExecuteDNA` completo sobre un ADN dado (se indica). "Pila
   `… a b`" = `b` en el tope. Todo caso de VM asume `CurrentFlow = body` salvo que el
   caso ejercite el flujo.
4. **Redondeo bancario** = la conversión de VB6 a entero (`CLng`/`CInt`/asignación a
   campo entero): al entero más cercano, empates al par. Tabla de referencia en N-01.
   El push a `PushIntStack(ByVal value As Long)` (`Module1.bas:143`) redondea así
   cualquier expresión no-`Long`.
5. **Tipos**: cada valor esperado se anota con el tipo VB6 del camino que lo produce.
   `mem()` es `Integer` (16 bits); los stacks son `Long`; la física es `Single`.
6. **RNG inyectado**: `rndy → [v1, v2, …]` significa que las llamadas sucesivas a
   `rndy()` (`Common.bas:228-254`, con `UseIntRnd = False` ⇒ `rndy = Rnd`) devuelven
   esos valores. `Random(low, hi) = Int((hi−low+1)·rndy + low)` (`Common.bas:53-56`);
   `fRnd(low, up) = CLng(rndy·(up−low+1) + low)` (`Common.bas:58-60`).
7. **Tolerancia FP**: los casos marcados **[FP·Q07]** involucran transcendentes
   (`Sin`, `Log`, `Sqr`, `Atn`) o cadenas largas en `Single`; el valor esperado se
   deriva en IEEE 754 y se acepta con tolerancia relativa 1e-6 (float sí, bit a bit no
   — decisión de Q07). Cuando el resultado final es un entero (post-redondeo), el
   entero esperado es exacto salvo que el caso diga lo contrario.
8. **Sitios de error**: los casos marcados **[SITIO DE ERROR]** documentan un punto
   donde el original lanzaba error 6/9/11 y truncaba el tick. El caso especifica la
   **decisión de port** (comportamiento explícito documentado); el truncamiento en sí
   no se replica (`10-CICLO.md §14`, decisión de port).

Numeración: `S` = suite de los autores, `N` = numérica, `V` = VM/flujo, `M` =
memoria/ciclo, `F` = física/visión, `R` = secuencias con RNG, `FM` = formatos,
`B` = casos definidos en la tabla de §9.

---

## 1. La suite de los autores (`UnitTests/`)

`DarwinBots2UnitTests.vbp` enlaza el motor entero con SimplyVBUnit
(`00-INVENTARIO.md §8`), pero la suite real es **una sola clase**, `TestCommon.cls`
(569 líneas), que cubre únicamente `Common.bas`: `Random`, `fRnd`, `Dot`, `Cross`,
`VectorAdd`, `VectorSub`, `Gauss`, `Max`, `Min`, `nextlowestmultof2`, `rndy`.
Nada del intérprete, la física o el ciclo. Balance del minado:

- **Regalos** (aserciones concretas adoptadas): S-01, S-03, S-05, S-06.
- **Contradicción de primer orden**: los tests de `fRnd` afirman un rango que el
  fuente no garantiza — S-02. El test de los autores **fallaba probabilísticamente**
  (~4.5% por extracción con rango 11).
- **Propiedades estadísticas** (media/desviación de `Gauss` sobre 1001 muestras,
  rangos de `Random`/`rndy`): no son casos dorados (dependen del RNG real); se
  conservan como evidencia de intención y se reemplazan por casos deterministas con
  RNG inyectado (S-04, R-03).

### S-01 · `Random`: rangos, caso especial y hueco del extremo — [unit]

**Estado**: ninguno. **Pasos**: llamar `Random(low, hi)` con `rndy` inyectado.

| llamada | rndy | esperado | derivación |
|---|---|---|---|
| `Random(10, 0)` | — (consumida igualmente) | `0` | caso especial `If hi < low And hi = 0` (`Common.bas:55`); la extracción de `rndy` ya ocurrió en `:54` |
| `Random(0, 6)` | 0.5 | `3` | `Int(7·0.5 + 0) = Int(3.5) = 3` (`Int` trunca hacia −∞) |
| `Random(0, 6)` | 0.999 | `6` | `Int(6.993) = 6`; 7 es inalcanzable (`rndy < 1`) |
| `Random(−2, 2)` | 0.5 | `0` | `Int(5·0.5 − 2) = Int(0.5) = 0` |
| `Random(10, 5)` | 0.5 | `8` | `Int((5−10+1)·0.5 + 10) = Int(8) = 8` |
| `Random(10, 5)` | 0.0 | `10` | `Int(−4·0 + 10) = 10` |

Con `hi < low` y `hi ≠ 0` el rango alcanzable es `[hi+1, low]`: **`hi` mismo es
inalcanzable** (`Int((hi−low+1)·rndy + low)` con `rndy < 1` nunca llega a `hi`).
El test de los autores (`TestCommon.cls`, `Random_Minus10To10_I_Bigger_Than_J`)
afirma `[j, i]` — pasa, pero es más laxo que la semántica real. Adoptado con el
refinamiento. `Random` opera en `Variant/Double` (parámetros sin tipo,
`Common.bas:53`): sin overflow para los rangos del motor.

### S-02 · `fRnd` devuelve `up+1` con probabilidad ~0.5/(rango) — [unit] · HALLAZGO

**Estado**: ninguno. **Pasos**: `fRnd(10, 20)` con `rndy = 0.97`.
**Esperado**: `21` — **fuera** del rango `[10, 20]` que asertaba el test de los autores.

**Derivación**: `fRnd = CLng(rndy·(up−low+1) + low)` (`Common.bas:58-60`) =
`CLng(0.97·11 + 10) = CLng(20.67) = 21` (bancario, no empate). Todo
`rndy ≥ 10.5/11 ≈ 0.9545` (salvo el empate exacto 20.5, que baja al par 20)
produce 21. Los tests `fRnd_*` de `TestCommon.cls` (p. ej. `fRnd_Positive_I_Less_Than_J`,
66 llamadas) afirmaban `r <= j`: **o la suite fallaba de forma intermitente, o nunca
se corrió lo suficiente**. La spec no está mal: el fuente es así. Consecuencia viva en
el motor: `aggiungirob` posiciona vegetales con `fRnd` sobre el área de la especie
(`Globals.bas:414-415`) — un vegetal puede nacer 1 twip fuera del área nominal.
El caso dorado fija el comportamiento del fuente (21), no la intención del test.

### S-03 · Vectores: `Dot`/`Cross`/`VectorAdd`/`VectorSub` — [unit]

**Estado**: ninguno. Valores de los autores (`TestCommon.cls`), verificados por
recomputación en IEEE 754 binary32 contra las fórmulas del fuente
(`Common.bas:98-123`); tolerancia de la suite 1e-4, la del port 1e-6 relativa [FP·Q07]:

| llamada | esperado |
|---|---|
| `Dot((10.4, 20.67), (5.98, 3.25))` | `129.3695` (f32: 129.36949) |
| `Dot((−100, −20.7), (−5.3, −3.6))` | `604.52` |
| `Dot((10.1, 20.987), (−5.567, −3.6431))` | `−132.6844` (f32: −132.68445) |
| `Cross((10.4, 20.67), (5.98, 3.25))` | `−89.8066` (f32: −89.80659) |
| `Cross((−100, −20.7), (−5.3, −3.6))` | `250.29` |
| `Cross((10.1, 20.987), (−5.567, −3.6431))` | `80.03932` (f32: 80.039314) |
| `VectorAdd((10.4, 20.67), (5.98, 3.25))` | `(16.38, 23.92)` |
| `VectorSub((10.4, 20.67), (5.98, 3.25))` | `(4.42, 17.42)` |

`Dot = x1·x2 + y1·y2` (`Common.bas:99`), `Cross = x1·y2 − y1·x2` (`:103`) — todo
`Single`.

### S-04 · `Gauss`: clamps de media y resultado — [unit]

**Estado**: RNG inyectado `rndy → [0.25, 0.75]` (⇒ `gasdev = +0.8325546`, ver R-03).
**Pasos y esperado**:

| llamada | esperado | derivación |
|---|---|---|
| `Gauss(45.34, 1000000)` | `32000` (Single) | la media se clampa a 32000 **antes** (`Common.bas:66-67`); `32000 + 0.8325546·45.34 = 32037.7` → clamp final 32000 (`:76-77`) |
| `Gauss(45.34, −1000000)` | `−32000 + 0.8325546·45.34 = −31962.25` | media clampada a −32000; sin clamp final (>−32000) |
| `Gauss(10, 100)` | `108.325546` | camino normal `gasdev·StdDev + Mean` (`:73`) |
| `Gauss(0.00000005, 100)` | `100.8325546` | `|StdDev| < 1e-7` y ≠0 ⇒ `Mean + gasdev` (StdDev **ignorada**, `:70-71`) |
| `Gauss(50000, 100)` | `100.8325546` | `|StdDev| > 32000` ⇒ mismo camino (`:70-71`) |
| `Gauss(0, 100)` | `100` | `StdDev = 0` no entra en la guarda (`<> 0#`); `gasdev·0 + 100` — **consume las 2 extracciones igualmente** |

Los tests estadísticos de los autores (`Gauss_1000_Large_Mean` espera media 32000±50)
confirman el clamp; este caso lo fija determinísticamente.

### S-05 · `nextlowestmultof2` — [unit] (+ sitio de error)

Tabla de los autores (`NextLowestMultOf2_*`), verificada contra
`Common.bas:29-36` (`a=1; Do a=a·2 Loop Until a > value; devuelve a/2`):

| entrada | esperado |
|---|---|
| 0, 1 | 1 |
| 2 | 2 |
| 512 | 512 |
| 513, 1023 | 512 |
| −512, −513, −1023 | 1 |

Derivación tipo (513): a = 2, 4, …, 512 (512 > 513 falso), 1024 (> 513) → `1024/2 = 512`.
Con negativos el primer `a = 2` ya supera → 1. **[SITIO DE ERROR]** con
`value ≥ 16384`: `a` es `Integer`; `16384·2 = 32768` desborda → error 6. Único
llamador vivo: el bracket de liga (`MDIForm1.frm:2705,2712`, capa torneo ⚙) — el port
del core no lo necesita; si se porta la liga, definir 16384 como resultado saturado.
Nota: el retorno es `Variant` con `a/2` división real — para las entradas de la tabla
el valor es entero exacto.

### S-06 · `Max`/`Min` de `Single` — [unit]

`Max(0.0005, 0.0001) = 0.0005`; `Max(−0.0005, 0.0001) = 0.0001`;
`Max(2000, 2000) = 2000` (rama `y`, `Common.bas:207-212`); `Min` espejo
(`:215-221`). Sin sorpresas; adoptados tal cual de `TestCommon.cls`.

### S-07 · `rndy` es `Rnd` con `UseIntRnd = False` — [unit]

`rndy()` con `UseIntRnd = False` es una llamada directa a `Rnd` (`Common.bas:250`):
con el LCG de R-01 implementado, `rndy` hereda sus casos. El modo
`UseIntRnd = True` (re-siembra desde archivos de internet, `:231-245`) queda **fuera
del port** (decisión Q02); el test de los autores `rndy_Using_UseIntRnd` no se adopta.

---

## 2. Numérica base (prioridad 1 — salvaguarda 5 de `PLAN.md`)

Estos casos se implementan **antes que cualquier subsistema**: cazan regresiones de
build (overflow, redondeo, promociones FP).

### N-01 · Redondeo bancario de referencia — [unit]

La conversión VB6 float→entero (implícita en `PushIntStack`, `CLng`, `CInt`,
asignaciones a `Integer`/`Long`):

| entrada | esperado |
|---|---|
| 0.5 | 0 |
| 1.5 | 2 |
| 2.5 | 2 |
| 3.5 | 4 |
| −0.5 | 0 |
| −1.5 | −2 |
| 20.5 | 20 |
| 20.67 | 21 |
| −3.51 | −4 |

El helper central del port (salvaguarda 3 de `PLAN.md`) debe pasar esta tabla.
Cita de anclaje: `PushIntStack(ByVal value As Long)` (`Module1.bas:143`) — el paso
ByVal de una expresión `Single`/`Double` a `Long` es la conversión estándar de VB6.

### N-02 · `mod32000` (normalización de escritura a `mem`) — [unit]

`mod32000` (`DNA.bas:1078-1090`): `a Mod 32000` con signo; múltiplos no nulos → ±32000.

| entrada (Long) | esperado (Integer) |
|---|---|
| 0 | 0 |
| 1 | 1 |
| 31999 | 31999 |
| 32000 | 32000 |
| 32001 | 1 |
| 63999 | 31999 |
| 64000 | 32000 |
| 96000 | 32000 |
| −32000 | −32000 |
| −32001 | −1 |
| −64000 | −32000 |

Derivación (64000): `64000 Mod 32000 = 0` y `64000 > 0` ⇒ caso especial `32000`
(`:1082-1083`). Un `store` solo escribe 0 si el valor era exactamente 0.

### N-03 · `div`: división real con redondeo bancario — [unit]

`DNAdiv` (`DNA.bas:264-274`): `b = 0` ⇒ push 0; si no `a / b` **real** y el push
redondea bancario.

| pila `a b` | esperado |
|---|---|
| `7 2` | 4 |
| `5 2` | 2 |
| `−5 2` | −2 |
| `7 −2` | −4 |
| `1 0` | 0 |
| `0 5` | 0 |

Derivación: 7/2 = 3.5 → 4 (par); 5/2 = 2.5 → 2; −5/2 = −2.5 → −2; 7/−2 = −3.5 → −4.
**No trunca**: un port con división entera C++ (`7/2 = 3`) falla este caso.

### N-04 · `mod`: truncado con el signo del dividendo — [unit]

`DNAmod` (`DNA.bas:297-307`):

| pila `a b` | esperado |
|---|---|
| `7 3` | 1 |
| `−7 3` | −1 |
| `7 −3` | 1 |
| `−7 −3` | −1 |
| `5 0` | 0 (y `a` consumido: pila queda vacía) |

Con `b = 0` hace `PopIntStack` del dividendo y push 0 (`:301-302`). El `Mod` de VB6
trunca (como `%` de C++): mismo signo que el dividendo.

### N-05 · `add`/`sub`: envolvimiento explícito en ±2·10⁹ — [unit]

`DNAadd`/`DNASub` (`DNA.bas:220-251`): operandos a `Single`, `Mod 2000000000`,
suma/resta en `Double`; si `|c| > 2·10⁹`: `c −= Sgn(c)·2·10⁹` (**envuelve**, no satura).

| operación | esperado | derivación |
|---|---|---|
| `1500000000 1500000000 add` | `1000000000` | c = 3·10⁹ > 2·10⁹ ⇒ 3·10⁹ − 2·10⁹ (ambos operandos exactos en Single: 1.5·10⁹ tiene 22 bits significativos) |
| `−1500000000 −1500000000 add` | `−1000000000` | espejo negativo |
| `1500000000 −1500000000 sub` | `1000000000` | c = 3·10⁹ ⇒ envuelve |
| `2000000000 1 add` | `2000000001`… **no**: `1` | ver derivación abajo |
| `100 200 sub` | `−100` | a − b sin sorpresas |

Derivación del cuarto: `a = 2000000000` es exacto en Single y `a Mod 2·10⁹ = 0`;
`b = 1`; c = 1. El `Mod` anula el operando límite: **`2000000000 x add = x`**.

### N-06 · `add`: pérdida de precisión `Single` sobre 2²⁴ — [unit]

Mismo handler; el paso por `Single` (`Dim a As Single`, `DNA.bas:221-224`) redondea
los operandos grandes **antes** de operar:

| operación | esperado | derivación |
|---|---|---|
| `16777217 1 add` | `16777217` | 16777217 = 2²⁴+1 → Single lo redondea a 16777216 (empate al par); 16777216 + 1 = 16777217. La suma "no avanza" |
| `2000000001 5 add` | `5` | 2000000001 → Single = 2000000000 exacto (espaciado 128 en ese rango); `Mod 2·10⁹ = 0`; 0 + 5 = 5 |
| `16777216 1 add` | `16777217` | 2²⁴ es exacto; suma normal |

Cómo llega 2000000001 a la pila: `2000000000 ~` = −2000000001 (N-18), `-` (negate) =
2000000001. El caso preloadea la pila; la ruta de alcanzabilidad es informativa.

### N-07 · `add`/`sub` con operando ≈ 2³¹ — [SITIO DE ERROR] (Q17) — [unit]

**Estado**: pila `2147483647 1` (alcanzable solo por bitwise). **Pasos**: `add`.
**Original**: `a = PopIntStack` a `Single` redondea 2147483647 → 2147483648.0
(espaciado 128; 2147483647 está a 1 del múltiplo superior); `a Mod 2000000000`
convierte a `Long` → **error 6** (2147483648 > máx Long) → truncamiento del tick.
No se produce ningún valor (`20-VM.md §6.1`, Q17 en `OPEN_QUESTIONS.md`).
**Decisión de port** (la recomendada en `20-VM.md §6.1`): detectar el caso (redondeo
bancario + test de rango int32 antes del Mod) y **saturar a `Sgn·2·10⁹`**, registrando
la divergencia. Esperado del port: `add` → `2000000000` + flag de divergencia
en el log del harness. El rango de disparo exacto: tope ∈ [2147483585, 2147483647]
(valores que redondean a 2³¹ en Single); 2147483584 también redondea arriba (empate
al par con mantisa par) — el port debe usar el redondeo de N-01, no un umbral fijo.

### N-08 · `mult`: saturación — [unit]

`DNAmult` (`DNA.bas:253-262`): producto en `Double`, si `|c| > 2·10⁹` **satura** a
`Sgn(c)·2·10⁹` (asimetría con add/sub, que envuelven).

| operación | esperado |
|---|---|
| `2000000000 2 mult` | 2000000000 |
| `−2000000000 2 mult` | −2000000000 |
| `32000 32000 mult` | 1024000000 |
| `50000 40000 mult` | 2000000000 |
| `0 5 mult` | 0 |

### N-09 · `pow` — [unit]

`DNApow` (`DNA.bas:476-492`): `b` saturado a ±10; `a = 0` ⇒ 0; `a^b` en Double,
saturado ±2·10⁹, push bancario.

| pila `a b` | esperado | derivación |
|---|---|---|
| `2 10` | 1024 | 2¹⁰ |
| `2 15` | 1024 | b → 10 |
| `10 10` | 2000000000 | 10¹⁰ = 10¹⁰ > 2·10⁹ ⇒ satura |
| `2 −1` | 0 | 0.5 → bancario 0 |
| `2 −2` | 0 | 0.25 → 0 |
| `−2 3` | −8 | signo conservado |
| `0 0` | 0 | la guarda `a = 0` gana (no es 1) |
| `−2 −10` | 0 | (−2)⁻¹⁰ ≈ 0.00098 → 0. Nota: VB6 evalúa (−2)^entero sin error |

### N-10 · `sqr` — [unit]

`DNASqr` (`DNA.bas:441-453`): `a > 0` ⇒ `Sqr(a)` bancario; si no 0.

| entrada | esperado |
|---|---|
| 16 | 4 |
| 17 | 4 (√17 = 4.123) |
| 2 | 1 (1.4142 → 1) |
| 3 | 2 (1.732 → 2) |
| 0 | 0 |
| −4 | 0 |

### N-11 · `root` y `logx` — [unit]

`DNAroot` (`DNA.bas:495-508`): valores absolutos de ambos; `b = 0` ⇒ 0; `a^(1/b)`
bancario. `DNAlogx` (`:510-523`): absolutos; `b < 2 Or a = 0` ⇒ 0; `Log(a)/Log(b)`
bancario.

| operación | esperado | derivación |
|---|---|---|
| `8 3 root` | 2 | 8^(1/3) |
| `−8 −3 root` | 2 | `Abs` de ambos |
| `5 0 root` | 0 | guarda |
| `8 2 logx` | 3 | log₂8 |
| `7 2 logx` | 3 | 2.807 → 3 |
| `−7 −2 logx` | 3 | `Abs` de ambos |
| `5 1 logx` | 0 | b < 2 |
| `0 2 logx` | 0 | a = 0 |

### N-12 · `sin`/`cos` — [unit] [FP·Q07]

`DNAsin`/`DNAcos` (`DNA.bas:455-472`): `Sin(a/200)·32000` en `Single`, push bancario,
**sin normalización del argumento**.

| operación | esperado (entero) | valor f32 intermedio |
|---|---|---|
| `0 sin` | 0 | 0.0 |
| `314 sin` | 32000 | 31999.9902… |
| `628 sin` | 51 | 50.9615… |
| `1256 sin` | −102 | −101.9229… |
| `100 sin` | 15342 | 15341.617… |
| `0 cos` | 32000 | 32000.0 |
| `628 cos` | −32000 | −31999.9589… |

Nota de escala: un "cuarto de vuelta" del bot es 314 unidades (π·200/2), no 90.
`628 sin` **no** es 0: 628/200 = 3.14 ≠ π. Los enteros esperados son estables frente
a 1 ulp del intermedio (ninguno cae en un empate de redondeo); la deriva del último
bit del `Single` intermedio se acepta [FP·Q07].

### N-13 · `ceil`/`floor`: asimetría de tipos — [unit]

`DNAceil` compara en `Single` (`DNA.bas:419-427`); `DNAfloor` en `Long` (`:430-438`).
`ceil` = mínimo, `floor` = máximo (los nombres describen el uso, no la operación).

| operación | esperado | derivación |
|---|---|---|
| `5 3 ceil` | 3 | min |
| `5 3 floor` | 5 | max |
| `−5 3 ceil` | −5 | min |
| `16777217 16777216 ceil` | **16777216** | ambos → Single 16777216; `a > b` falso ⇒ push `a` ya redondeado |
| `16777217 16777216 floor` | **16777217** | comparación exacta en Long |

### N-14 · `pyth` — [unit] [FP·Q07]

`DNApyth` (`DNA.bas:525-537`): `Sqr(a² + b²)` en `Single`, saturado, bancario.
`3 4 pyth` = 5; `30000 40000 pyth` = 50000; `0 0 pyth` = 0.

### N-15 · `anglecmp` — [unit]

`DNAanglecmp` (`DNA.bas:365-383`): ambos `Mod 1256` llevados a [0,1255];
`AngDiff(a/200, b/200)·200` (AngDiff en ±π, `Physics.bas:638-648`), push bancario.

| pila `a b` | esperado | derivación |
|---|---|---|
| `0 628` | −628 | AngDiff(0, 3.14) = −3.14 (no cruza −π = −3.14159265) |
| `628 0` | 628 | espejo |
| `0 629` | 628 | AngDiff(0, 3.145) = −3.145 < −π ⇒ +2π = 3.1382 → ×200 = 627.64 → 628 |
| `1256 0` | 0 | 1256 Mod 1256 = 0 |
| `100 1356` | 0 | 1356 Mod 1256 = 100 |
| `−100 0` | −101 | −100 Mod 1256 = −100 < 0 → +1256 = 1156; AngDiff(5.78, 0) = 5.78 > π ⇒ −(2π−5.78) = −0.50318 → ×200 = −100.64 → bancario −101 |

(2π usa `PI = 3.14159265` Single, `Common.bas:19`.)

### N-16 · Underflow de stacks: la tabla completa — [unit]

Los stacks nunca fallan (`20-VM.md §3`). Pop entero sobre vacío = 0
(`Module1.bas:158-167`); pop booleano sobre vacío = centinela −5 = "vacío es true"
(`:282-292`). Comportamiento **por operador** (no hay regla general):

| operador sobre pila vacía (o corta) | esperado | cita |
|---|---|---|
| `add`/`sub`/`mult`/`div`/`mod` con pila vacía | opera sobre ceros → push 0 | `DNA.bas:220-307` |
| `dup` (vacía) | **apila DOS ceros** (pop+push+push sin guarda) | `DNA.bas:317-323` |
| `drop` (vacía) | no-op neto (pop de 0) | `DNA.bas:210` |
| `swap` (≤1 elemento) | no-op | `Module1.bas:187-199` |
| `over` (vacía) | no-op | `Module1.bas:200-217` |
| `over` (1 elemento `x`) | apila **0** encima (queda `x 0`) | `Module1.bas:204-207` |
| `dupbool` (vacía) | **no-op** (asimétrico con `dup`) | `Module1.bas:239-249` |
| `swapbool` (≤1) | no-op | `Module1.bas:251-263` |
| `overbool` (vacía) | no-op | `Module1.bas:264-280` |
| `overbool` (1 elemento) | apila **True** | `Module1.bas:269-271` |
| `not` (vacía) | push **False** (Not True) | `DNA.bas:832-835` |
| `and` (vacía) | push True (b ausente → True; a ausente → push b=True) | `DNA.bas:805-813` |
| `or` (1 elemento `False`) | push **True** (a ausente ⇒ True Or b) | `DNA.bas:814-822` |
| `xor` (1 elemento `b`) | push `Not b` | `DNA.bas:823-831` |
| `=` (vacía) | push True (0 = 0) | `DNA.bas:731-733` |
| `<` (vacía) | push False (0 < 0) | `DNA.bas:723-725` |
| `>=` (vacía) | push True | `DNA.bas:790-792` |
| `debugbool` (vacía) | push **True** (`CBool(−5)`) | `DNA.bas:552-561` |

### N-17 · Overflow de stack: descarta el fondo — [unit]

**Estado**: pila vacía. **Pasos**: push de 1, 2, …, 102 (en ese orden); después 102
pops. **Esperado**: los pops devuelven 102, 101, …, 2 (101 valores) y después 0
(underflow): **el valor 1 se perdió**. Derivación: `PushIntStack` con `pos ≥ 101`
desplaza `val(1..100)` a `val(0..99)` — descarta el más viejo — y escribe arriba
(`Module1.bas:143-156`). Mismo contrato para el stack booleano (`:219-232`).

### N-18 · Bitwise: tabla y edges — [unit]

Todas via `NumberToBit`/`BitToNumber` (`Bitwise.bas:17-64`), complemento a dos de
32 bits **con una excepción**: `BitToNumber` suma solo los bits 0..30 tras procesar
el signo — el patrón `0x80000000` decodifica a **0**, y −2³¹ es irrepresentable.

| operación | esperado | derivación |
|---|---|---|
| `0 ~` | −1 | complemento de 0 = todo unos = −1 |
| `5 ~` | −6 | ~x = −x−1 |
| `2000000000 ~` | −2000000001 | magnitud 2000000001 < 2³¹ ⇒ representable |
| `12 10 &` | 8 | 1100 AND 1010 |
| `12 10 \|` | 14 | 1100 OR 1010 |
| `12 10 ^` | 6 | XOR |
| `−1 1 &` | 1 | −1 = todo unos |
| `2147483647 ++` | **0** | 0x7FFFFFFF+1 = 0x80000000 → BitToNumber: bit31, Dec+Invert ⇒ bits 0..30 = 0 ⇒ 0 (`Bitwise.bas:44-64,75-87`) |
| `0 --` | −1 | préstamo hasta el bit 31: 0xFFFFFFFF = −1 (`:90-102`) |
| `5 -` (negate) | −5 | negación Long directa, sin pasar por bits (`DNA.bas:585-586`) |
| `1 <<` | 2 | shift lógico izquierda (`Bitwise.bas:105-113`) |
| `1073741824 <<` | **0** | 2³⁰ → bit31 → 0x80000000 → 0 |
| `1610612736 <<` | −1073741824 | 0x60000000 → 0xC0000000 = −2³⁰·… = −1073741824 |
| `−1 >>` | −1 | aritmético: bit31 se conserva **y** se copia (`:116-127`) |
| `4 >>` | 2 | |
| `−8 >>` | −4 | 0xFFFFFFF8 → 0xFFFFFFFC |

### N-19 · `%=` / `!%=`: el intervalo invertido — [unit]

`cequa` (`DNA.bas:739-747`): con `… a b`, empuja `(a − a/10 ≤ b) And (a + a/10 ≥ b)`,
en `Single`.

| pila `a b` | `%=` | derivación |
|---|---|---|
| `100 105` | True | 90 ≤ 105 ≤ 110 |
| `100 111` | False | 111 > 110 |
| `100 90` | True | borde inferior inclusivo |
| `−100 −100` | **False** | c = −10: exige −90 ≤ −100 (falso). Con `a < 0` **no hay ningún b que pase**, ni b = a |
| `0 0` | True | c = 0 |
| `0 1` | False | |

`!%=` (`:749-757`) es la negación exacta. `~=`/`!~=` (`:758-784`) generalizan con
`c = a/100·d` (pila `a b d`): `10 12 30 ~=` → c = 3 → 7 ≤ 12 ≤ 13 → True;
`10 14 30 ~=` → False; con `a < 0`, siempre False (mismo sesgo).

---

## 3. VM y flujo (prioridad 2)

Estos casos ejecutan `ExecuteDNA` sobre un ADN dado (cargado con `LoadDNA` o
construido token a token). Notación de tokens: `(tipo,value)` según `20-VM.md §1`.

### V-01 · El `else` tras `start` está muerto — [unit] · [PROBABLE BUG] A2-1

**Estado**: bot con `mem` en cero; ADN texto:

```
cond *50 1 > start 7 100 store else 9 200 store stop
```

**Caso a — condición falsa** (`mem(50) = 0`): `0 > 1` falso.
**Esperado**: `mem(100) = 0` **y `mem(200) = 0`** — ni el cuerpo ni el else ejecutan.
**Caso b — condición cierta** (`mem(50) = 5`): `mem(100) = 7` y **`mem(200) = 0`**.

**Derivación** (`DNA.bas:1159-1203`): en el `start`, `CurrentFlow = COND` ⇒
`CondFlag = AddupCond` (falso en el caso a); `ingene` pasa a False (`:1190`). Al llegar
el `else`: `CurrentFlow` ya no es COND (paso 1 no corre) y `Not ingene` ⇒ **`:1178`
fuerza `CondFlag = NEXTBODY`**; el caso `else` exige `NEXTELSE` (`:1192`) ⇒ nunca
entra en ELSEBODY. La ayuda embebida dice lo contrario (`frmAbout1.frm:716`) — gana
el código. Un port que "arregle" el else falla este caso.

### V-02 · El `else` pegado a las condiciones sí vive — [unit]

**Estado**: `mem` en cero; ADN: `cond 1 2 > else 9 200 store stop`.
**Esperado**: `mem(200) = 9`.
**Derivación**: en el `else`, `CurrentFlow = COND` ⇒ paso 1: `CondFlag = AddupCond` =
(1 > 2) = False (`:1177`); `ingene` sigue True ⇒ `:1178` **no** pisa el flag; caso
`else` con `CondFlag = NEXTELSE` ⇒ `CurrentFlow = ELSEBODY` (`:1192`); el store
ejecuta en ELSEBODY con `CondStateIsTrue` (stack booleano vacío tras AddupCond = True,
`:1219-1232`). Con la condición cierta (`2 1 >`): `mem(200) = 0`.

### V-03 · Condiciones inline gobiernan los stores sin consumirse — [unit]

**Estado**: `mem` en cero; ADN:

```
start 5 100 store 1 2 > 6 101 store 7 102 store dropbool 8 103 store stop
```

**Esperado**: `mem(100) = 5`; `mem(101) = 0`; `mem(102) = 0`; `mem(103) = 8`.

**Derivación**: `start` sin cond ⇒ incondicional (`:1178,1185-1190`). Store a 100:
stack booleano vacío ⇒ `CondStateIsTrue` = True (`:1219-1232`). `1 2 >` apila False
(tipo 5 ejecuta en body, `DNA.bas:135-138`). Stores a 101 y 102: `CondStateIsTrue`
mira el tope **sin consumir** (pop + push de vuelta) ⇒ ambos bloqueados por el mismo
False. `dropbool` lo quita ⇒ store a 103 ejecuta. Los números y comandos **no** están
gateados por el stack booleano (solo por `CurrentFlow ≠ CLEAR`): las direcciones se
apilaron igualmente y los stores bloqueados las consumieron (pop de dirección,
`DNA.bas:894` — el pop ocurre antes del `If b <> 0`... no: el pop de la dirección
ocurre siempre, el del **valor** solo dentro; ver V-10).

### V-04 · `cond` vacío = True; `AddupCond` es un AND que vacía — [unit]

**Estado**: `mem` en cero.

| ADN | esperado | derivación |
|---|---|---|
| `cond start 5 100 store stop` | `mem(100) = 5` | AddupCond sobre stack vacío = True vacuo (`DNA.bas:1205-1216`) |
| `cond 1 1 = 2 3 < start 5 100 store stop` | `mem(100) = 5` | AND(True, True) |
| `cond 1 1 = 3 2 < start 5 100 store stop` | `mem(100) = 0` | AND(True, False) = False |
| `cond 1 1 = 3 2 < or start 5 100 store stop` | `mem(100) = 5` | el `or` (tipo 6) combina en el stack **antes** del AddupCond: True Or False = True |

El AND es implícito y el OR debe ser explícito (`20-VM.md §6.6`).

### V-05 · Numeración de genes y `thisgene` — [ciclo]

**Estado**: `mem` en cero; ADN:

```
cond start 1 100 store stop start 2 101 store stop cond 1 2 > start 3 102 store stop
```

**Esperado tras un `ExecuteDNA`**: `mem(100) = 1`, `mem(101) = 2`, `mem(102) = 0`,
y **`mem(341) = 3`** (`thisgene` = último gen cuyo marcador de flujo corrió,
`DNA.bas:167`); `CountGenes` del ADN = 3 (`Module1.bas:294-323`) ⇒ `mem(339) = 3` al
cargar. **Derivación**: gen 1 = primer `cond` (`currgene += 1` en cond, `:1169`);
gen 2 = el `start` suelto tras el `stop` (`Not ingene` ⇒ `currgene += 1`, `:1186-1188`);
gen 3 = segundo `cond`. Los `stop` y el `start` pegado a un cond no incrementan.
`mem(341)` se escribe tras **cada** token tipo 9, gateado por nada (tipo 9 sin gate).

### V-06 · La corrección del cero inicial desplaza el ADN con `def`s — [integración] · [PROBABLE BUG] A2-2

**Estado**: archivo de bot:

```
def mivar 100
5 .mivar store
start 7 200 store stop
```

**Esperado tras `LoadDNA`**: el array `dna` queda desplazado una posición a la
izquierda: `dna(0) = (0,5)` — **invisible para la ejecución** (que empieza en
`a = 1`, `DNA.bas:84`); `DnaLen` = (nº de tokens) − 1 comparado con el mismo bot sin
`def`. Tras un ciclo: `mem(100) = 0` (el `5` nunca se apila: el token quedó en el
índice 0 y además el resto del par quedó en CLEAR)… con precisión: la secuencia
ejecutada desde `a = 1` es `.mivar store start 7 200 store stop end` ⇒ el `store` de
la posición 2 corre en CLEAR (no ejecuta), `mem(200) = 7` sí. **Derivación**:
`DNATokenizing.bas:165-174` — con `useref` (hubo defs), `dna(0) = (0,0)` (siempre) y
`dna(1).tipo ≠ 9` ⇒ corrimiento total. Sin `def`s, o si el primer token es
`cond`/`start`, no hay corrimiento (caso de control: el mismo archivo sin la línea
`def` deja `mem(100) = 0` igualmente —los tokens pre-flujo no ejecutan— pero
`DnaLen` conserva el token).

### V-07 · Archivo solo-defs = "bomba de tick" — [SITIO DE ERROR] — [integración]

**Estado**: archivo con una sola línea `def x 100`. **Original**: el corrimiento de
V-06 deja `dna(0) = end` y el array de un solo elemento; la primera evaluación del
bucle lee `dna(1)`: **error 9** cada ciclo ⇒ trunca todos los ticks mientras el bot
viva (`20-VM.md §2.3`). **Decisión de port**: el cargador acepta el bot y el
intérprete trata un ADN sin tokens ejecutables como no-op (0 tokens ejecutados,
0 coste), documentando la divergencia (el original no simula nada más allá de ese
punto del tick — comportamiento no útil que ningún bot del corpus explota).

### V-08 · El tokenizador no rechaza nada — [unit]

**Estado**: línea de ADN: `hola *qwerty // .noexiste *.noexiste 12.5`.
**Esperado** (tokens): `(0,0) (1,0) (0,0) (0,0) (1,0) (0,13)`… con matices:

| palabra | token | derivación |
|---|---|---|
| `hola` | (0, 0) | desconocida → `val("hola")` = 0 (`DNATokenizing.bas:289-292,320-338`) |
| `*qwerty` | (1, 0) | dirección `SysvarTok("qwerty")` = 0; al ejecutar, `*0` normaliza a **mem(1000)** (`DNA.bas:97-101`) |
| `//` | (0, 0) | `/` solo comenta a inicio de línea (`:103` procesa antes; en medio es palabra) |
| `.noexiste` | (0, 0) | sysvar desconocida → val(".noexiste") = 0 |
| `12.5` | (0, 12) | `val("12.5")` = 12.5 → asignación a Integer **bancaria** (empate → par) → 12 |

Y la línea
`defensa 50` **es un def**: `Left(a,3) = "def"` (`:103`) ⇒ define la variable `ensa`…
con exactitud: `insertvar` recorta 4 caracteres (`Right(a, Len−4)`, `Module1.bas:118`)
⇒ nombre `nsa 50` partido por el primer espacio ⇒ variable **`nsa`** = 50
(`20-VM.md §2.2.4`).

### V-09 · Qué rechaza el cargador — [integración]

| archivo | esperado | derivación |
|---|---|---|
| contiene el literal `40000` | **no carga** ("no valid robot") | `val` → Double; asignación al retorno Integer de `SysvarTok` → error 6 → handler `fine:` de LoadDNA → rechazo (`DNATokenizing.bas:61,177,209-213`; `20-VM.md §2.4`) |
| contiene 1001 líneas `def` | **no carga** | `vars(1000)`: el def nº 1001 lanza error 9 → mismo handler (`Module1.bas:114-125`, `20-VM.md §8.1`) |
| `def x 5` y `def x 9` | carga; `.x` = 9 | sin detección de colisión, la búsqueda recorre todo y **gana el último** (`DNATokenizing.bas:331-333`) |
| `def NRG 970` y uso de `.NRG` | carga; `.NRG` = 970 | privadas case-sensitive tras las sysvars; la coincidencia posterior sombrea (`:331-333`); `.nrg` (minúsculas) sigue siendo la sysvar 310 |
| genes sin `stop`, conds desparejadas | carga y ejecuta | no hay validación estructural (`20-VM.md §2.5`) |

**Decisión de port**: replicar el rechazo total (bot no entra), sin diálogo modal.

### V-10 · Direccionamiento de stores y el no-op de dirección 0 — [unit]

**Estado**: pila y mem según fila; ejecuta el handler indicado.

| operación | esperado | derivación |
|---|---|---|
| `5 0 store` | no escribe; **el 5 queda en la pila**; sin coste | el pop del valor está dentro del `If b <> 0` (`DNA.bas:891-910`) |
| `5 0 divstore` | no escribe; **el 5 se consume** | `divstore` hace ambos pops antes del If (`:1005-1030`) |
| `7 2000 store` | `mem(1000) = 7` | `Abs(2000) Mod 1000 = 0 → 1000` (`:896-897`) |
| `7 −5 store` | `mem(5) = 7` | `Abs(−5) = 5` |
| `7 1005 store` | `mem(5) = 7` | `1005 Mod 1000 = 5` |
| `0 *` | push `mem(1000)` | deref con el mismo mapeo (`:280-295`) |
| `1005 *` | push `mem(5)` | |
| mem(7)=100; `33000 7 multstore` | `mem(7) = mod32000(100·1000) = 4000` | el operando se normaliza **antes**: mod32000(33000) = 1000; 100000 Mod 32000 = 4000 (`:978-1003`) |
| mem(7)=9; `2 7 divstore` | `mem(7) = 4` | 9/2 = 4.5 → bancario 4 (`:1005-1030`) |
| mem(7)=−9; `7 rndstore` con rndy=0.5 | `mem(7) = −5` | `Random(0, Abs(−9))·Sgn(−9)` = Int(10·0.5)·(−1) = **−5** (`:1092-1102`) |

### V-11 · Stores inmediatos entre genes del mismo ciclo — [ciclo]

**Estado**: `mem` en cero; ADN:
`start 7 50 store stop cond *50 7 = start 1 51 store stop`.
**Esperado tras UN `ExecuteDNA`**: `mem(50) = 7` **y `mem(51) = 1`** — el gen 2 ve en
el mismo ciclo lo que el gen 1 escribió. **Derivación**: `ExecuteStores` escribe
`rob(currbot).mem()` en el acto (`DNA.bas:151,891-910`); la cola `CommandQueue`
(`DNA.bas:38-45`) no se usa. Un port con stores diferidos falla este caso.

### V-12 · Flags `TieAngOverwrite`/`TieLenOverwrite` — [unit] · [PROBABLE BUG] A2-6

**Estado**: bot limpio. | operación | esperado |
|---|---|
| `100 481 store` | `TieAngOverwrite(1) = True` (`DNA.bas:900-905`) |
| `100 485 addstore` | `TieLenOverwrite(1) = True` (`:944-948`) |
| `481 inc` | `mem(481) += 1` pero `TieAngOverwrite(1) = False` — los stores de 1 operando **no marcan** (`:912-922`) |
| `481 negstore` | ídem, sin flag (`:1144-1154`) |

### V-13 · `debugint` altera el tope sobre 2²⁴ — [unit] · [PROBABLE BUG] A2-7

**Estado**: pila `16777217`. **Pasos**: `debugint`. **Esperado**: tope = `16777216`
(round-trip por `Single`, `DNA.bas:540-549`); sin coste (`:331` exime value ≥ 13).
Bajo `ismutating`, el texto `debugint` ni siquiera tokeniza (`DNATokenizing.bas:481-484`).

### V-14 · `end` interior y tokens tras `end` — [unit]

**Estado**: ADN construido: `start 5 100 store stop end start 9 200 store stop end`
(el primer `end` insertado por mutación/construcción). **Esperado**: `mem(100) = 5`,
`mem(200) = 0` — la ejecución para en el primer `(10,1)` (condición del While,
`DNA.bas:87`); los tokens posteriores existen para `DnaLen` = índice del primer `end`
(`Module1.bas:64-73`) y para las mutaciones. **Variante**: si el token interior es
`(10, 2)` (tipo 10 con value ≠ 1, dejado por una mutación), **no** termina: Case 10
es no-op (`DNA.bas:168-169`) y `mem(200) = 9`.

### V-15 · Costes por token (preset F1) — [ciclo]

**Estado**: preset F1 (`constants.yaml`): `COSTSTORE = 0.04`, `CONDCOST = 0.004`,
`COSTMULTIPLIER = 1`, resto de costes de VM 0. Bot con `nrg = 1000` y ADN
`cond 1 1 = start 5 100 store 200 inc 3 300 addstore stop`.
**Esperado**: `nrg = 1000 − 0.004 − 0.04 − 0.04/10 − 0.04/5 = 999.944`.
**Derivación**: la condición `=` cobra CONDCOST (`DNA.bas:697`); `store` cobra
COSTSTORE (`:909`); `inc` COSTSTORE/10 (`:921`); `addstore` COSTSTORE/5 (`:954`);
números y flujo cobran NUMCOST/FLOWCOST = 0 en F1. Todos los cobros multiplican
`Costs(COSTMULTIPLIER)` = 1. La resta es sin suelo (la muerte se evalúa en P5).

### V-16 · Aliases y case-insensitivity del tokenizador — [unit]

`ADD`, `Add`, `add` tokenizan igual (comparación en minúsculas,
`DNATokenizing.bas:278-285`); `dupint` = `dup`, `dropint` = `drop`, `clearint` =
`clear`, `swapint` = `swap`, `overint` = `over` (`:396-415`). Las **privadas** son
case-sensitive (V-09). Esperado: los pares producen `dna()` idénticos.

---

## 4. Memoria y ciclo (prioridad 3)

### M-01 · Latencia de 1 ciclo de los sentidos — [ciclo]

**Estado**: bots A y B solapados (colisión garantizada), sin otras fuerzas; ADN de A:
`start *205 900 store stop` (copia `hitup`→`mem(900)`; hitup = 205,
`Robots.bas:34`; 900 libre).
**Secuencia esperada** (tick a tick, orden de `10-CICLO.md §2`):

| tick | evento | aserción |
|---|---|---|
| N | P1: `Repel3` → `touch` escribe `mem(201)` y `mem(205..208)` de ambos (`Physics.bas:963-965`; `Senses.bas:21-55`) | tras el tick N: `mem(205)` refleja el contacto |
| N+1 | paso 10: el ADN lee `mem(205)` = 1 → `mem(900) = 1`; paso 12: `EraseSenses` borra contacto (`Master.bas:340-344`; `Senses.bas:98-125`) | `mem(900) = 1`; `mem(205) = 0` al final del paso 12 (si los bots ya no se tocan) |
| N+2 | sin contacto nuevo: el ADN lee 0 | `mem(900) = 0` |

La regla general (`21-MEMORIA.md §3`): todo sentido se escribe **después** del ADN del
ciclo N y se borra **después** del ADN del ciclo N+1. Un port que ejecute el ADN tras
la física rompe este caso.

### M-02 · Comandos consumidos en el mismo ciclo: `dir*` — [ciclo]

**Estado**: bot solo, `Fixed = False`, ADN `start 100 1 store stop` (1 = dirup),
`PhysMoving = 0.66` (default de arranque), masa 1, sin fricción.
**Esperado al final del tick**: `mem(1) = 0` (borrado por `UpdatePosition` en P3,
`Robots.bas:861-868`), `lastup = 100` (guardado antes de borrar, `:861`), y la
velocidad refleja el impulso: `VoluntaryForces` (P1) leyó `mem(1) = 100` **del mismo
ciclo** (`Physics.bas:409-463`). Con `aim = 0` y `NewMove = False`:
`dir = (100·masa, 0) = (100, 0)`; `NewAccel = (Dot(aimvector, dir), Cross(aimvector,
dir))` con `aimvector = (1, 0)` = (100, 0); `|100| > MaxVelocity = 40` ⇒ escalado a
(40, 0) (`:437-440`); `ImpulseInd += (40·0.66, 0) = (26.4, 0)`; P3:
`vel = (26.4, 0)`, `pos.x += 26.4`. Publicaciones: `mem(velscalar) = 26`
(iceil de 26.4 → asignación Integer bancaria = 26), `mem(vel) = 26`, `mem(veldn) = −26`
(`Robots.bas:870-874`).

### M-03 · `mem(0)` es el sumidero del remapeo de 340 — [integración]

**Estado**: atacante con `vloc = 340` (`mem(835) = 340`), venom > 0, dispara −3 a la
víctima (sin shell, distinta especie). **Esperado**: la víctima queda con
`Vloc = 0` y cada ciclo de parálisis escribe `mem(0) = Vval` (`Robots.bas:1114-1127`);
`mem(340)` de la víctima **nunca** se toca. **Derivación**: `takeven` computa
`(memloc−1) Mod 1000 + 1` y si da 340 lo sustituye por 0 (`Shots.bas:802-809`);
`Poisons` (P1) escribe `mem(Vloc)` sin excluir el 0 (`21-MEMORIA.md §6`). `mem(0)`
no es legible desde ADN; la aserción se hace sobre el estado interno y sobre que
`mem(340)` sigue en 0 (no se dispara `delgene`).

### M-04 · Régimen C: comandos que NO se consumen — [ciclo]

| comando | estado inicial | esperado tras el tick | cita |
|---|---|---|---|
| `strbody` negativo | `mem(313) = −50` (strbody, `Robots.bas:51`) | `mem(313) = −50` **para siempre** (solo se consume si > 0) | `Robots.bas:1272-1273,1704` |
| `repro` fallido | `mem(300) = 50` con `body = 1` | `mem(300) = 50` (la guarda `body ≤ 2` sale antes del reset) | `Robots.bas:2120,2391-2392` |
| `shootval` sin `shoot` | `mem(8) = 10`, `mem(7) = 0` (shootval/shoot, `Robots.bas:14-15`) | `mem(8) = 10` (solo `robshoot` lo borra) | `Robots.bas:1718-1864` |
| `fixang` sin ties | `mem(468) = 100` (FIXANG, `Robots.bas:98`), `tienum/tiepres = 0` | `mem(468) = 100` (el reset a **32000** está tras el gate `tienum ≠ 0`) | `Ties.bas:231-232,277-279`; `Robots.bas:2196` |
| `fixang` con tie | `mem(468) = 100`, una tie seleccionada | `mem(468) = 32000` (centinela, **no** 0) | `Ties.bas:231-232` |

### M-05 · Memoria genética: instantánea y diferida — [integración]

**Estado**: padre con `mem(971) = 11`, `mem(975) = 55`, `mem(976) = 100`,
`mem(990) = 900`, resto 0; se reproduce (asexual, éxito).
**Esperado**:

1. Al nacer: hijo con `mem(971) = 11`, `mem(975) = 55` (copia directa,
   `Robots.bas:2277-2279`); `mem(976..990) = 0` pero `epimem(0) = 100`,
   `epimem(14) = 900` (`:2281-2283`); **el padre pierde su `epimem`** (`:2285-2287`).
2. Ciclo con `age = 0` (primer `UpdateBots` del hijo): `DoGeneticMemory` entrega
   `mem(976 + 0) = epimem(0) = 100` — una celda por ciclo, gate `age < 15`,
   `numties > 0` y `Ties(1).last > 0` (tie de nacimiento) y **celda aún en 0**
   (`Robots.bas:1586,2850-2865`).
3. Con `age = 14`: `mem(990) = 900`. Total: 15 ciclos.
4. **Contra-casos**: si el hijo corta la tie en el ciclo 3, las celdas 976+3.. no se
   entregan jamás; si el ADN del hijo escribe `mem(979) = 7` antes del ciclo 3, la
   entrega de esa celda se cancela (celda ≠ 0).

### M-06 · `refvelsx` vale 0 siempre — [ciclo] · [PROBABLE BUG] A3-1

**Estado**: bot A mirando a bot B; B con velocidad lateral no nula respecto de A.
**Esperado tras el barrido de visión**: `mem(696) = 0` (refvelsx) y `mem(697) ≠ 0`
(refveldx, funcional). **Derivación**: `lookoccurr` asigna
`mem(refvelsx) = mem(refvelsx) · −1` — se niega a sí misma tras el borrado previo
(⇒ 0), en vez de negar refveldx (`Senses.bas:319`; mismo error en `:434`).

### M-07 · `trefshell` sobrevive a `EraseTRefVars` — [ciclo] · [PROBABLE BUG] A3-2

**Estado**: bots atados; el atado con `shell = 120` ⇒ el lector tiene
`mem(449) = 120` vía `ReadTRefVars` (`Ties.bas:743-796`). Se rompe la tie.
**Esperado**: tras el `EraseTRefVars` del ciclo siguiente, `mem(449) = 120` **sigue**
(la lista de borrado salta el 449: limpia 438–448, 456–465, 475, 478, 479,
`Ties.bas:655-677`), mientras `mem(438..448) = 0`.

### M-08 · Herencia del `timer` y siembra del fundador — [integración]

**Esperado**: (a) el hijo nace con `mem(12)` = `mem(12)` del padre
(`Robots.bas:2383`; sexual `:2817`); (b) cada fundador cargado por `loadrobs` recibe
`mem(12) = Random(−32000, 32000)` — 1 extracción de RNG por fundador
(`main.frm:1556`); con `rndy = 0.5`: `Int(64001·0.5) − 32000 = 0`.

### M-09 · Shots de memoria: dirección, salto de 340 y bloqueo por poison — [integración]

**Estado**: tirador con `mem(shoot)` = tipo positivo; víctima limpia.

| `.shoot` del tirador | esperado en la víctima | derivación |
|---|---|---|
| 205 | `mem(205) = shootval` | tipo positivo escribe directo (`Shots.bas:352-357`) |
| 1205 | `mem(205) = shootval` | `robshoot` hace `shtype Mod 1000` (`Robots.bas:1786`) |
| 340 | **nada** (el shot golpea pero no escribe) | salto explícito de 340 (`Shots.bas:352-357`) |
| 2000 | dispara **esperma** (−8), no escritura | `2000 Mod 1000 = 0`; `newshot` convierte 0 → −8 (`Shots.bas:117-122`) |
| 205, víctima con `poison ≥ shot.nrg` | `mem(205) = 0`; rebote −5 hacia el tirador | bloqueo por poison (`:359-364`) |

### M-10 · Publicaciones al cargar: `DnaLen` y `genenum` — [integración]

**Estado**: bot cargado con ADN de V-05. **Esperado**: `mem(336) = DnaLen` (índice
del primer `end`, base 1) y `mem(339) = 3` (`RobScriptLoad`, `Module1.bas:8-26`;
`DnaLenSys`/`GenesSys`, `Robots.bas:57,60`). Tras una infección vírica o `delgene`
se re-publican (`Shots.bas:1213-1222`); tras mutaciones en vida también
(`NeoMutations.bas` §1) — pero la firma `occurr` no (B-33 de §9).

### M-11 · Normalización in place de comandos — [ciclo]

Los consumidores reescriben la celda normalizada antes de usarla
(`21-MEMORIA.md §3`):

| celda | escrito por el ADN | esperado tras P3/P5 | cita |
|---|---|---|---|
| `mem(830)` (sharenrg) | 250 | `250 Mod 100 = 50` visible en la celda… y **0 → 100**: `mem(830) = 300` ⇒ celda = 100 | `Robots.bas:1955-2007` |
| `mem(833)` (shareslime) | 250 | clamp a 0..99 ⇒ 99 | `Robots.bas:1897-1898` |
| `mem(901)` (aimshoot) | 1500 | `1500 Mod 1256 = 244` al disparar | `Shots.bas:135-142` |
| `mem(338)` (vshoot) | −5 | 1 (normalizado en la celda) | `Shots.bas:1093` |

(El caso exige que la escritura normalizada sea observable por un `*n` posterior en
el mismo régimen de borrado.)

*Corrección 2026-08-24 (M3 del port)*: la fila de vshoot decía `mem(836)`
(venval); el sysvar `vshoot` es **338** (`VshootSys`, `Robots.bas:59`;
`DNATokenizing.bas:1045`) y `Shots.bas:1093` normaliza esa celda. Nótese
además que `sharenrg`/`aimshoot`/`vshoot` se consumen (celda → 0) más tarde
en el mismo tick (`Ties.bas:178-182`, `Shots.bas:143`, `Robots.bas:1094`):
la escritura normalizada es observable dentro del subsistema, no al cierre
del ciclo — el caso se asserta al nivel del consumidor.

### M-12 · Los corpses congelan sus sentidos — [ciclo]

**Estado**: bot con sentidos poblados (contacto reciente) muere a corpse
(`nrg < 15` con corpses activos, `Robots.bas:1309-1318`). **Esperado**: sus
`mem(201)`/`mem(205..208)` **no** se borran más (la pasada de `EraseSenses` salta a los
`DisableDNA`, `Master.bas:340-344`; el corpse pone `DisableDNA = True` al formarse,
`Robots.bas:1318`); los ojos se borran una única vez al formarse (`:1325-1327`) y
quedan rancios.

---

## 5. Física y visión deterministas (prioridad 5)

### F-01 · `CalcMass` — [unit]

`mass = body/1000 + shell/200 + (chloroplasts/32000)·31680`, clamp [1, 32000]
(`Physics.bas:44-52`):

| body | shell | chlr | esperado |
|---|---|---|---|
| 1000 | 0 | 0 | 1 (= 1, justo el clamp) |
| 5000 | 200 | 0 | 6 |
| 100 | 0 | 0 | 1 (0.1 → clamp inferior) |
| 1000 | 0 | 16000 | 1 + 15840 = 15841 |
| 32000 | 32000 | 32000 | 32 + 160 + 31680 = 31872 |

Nota: el clamp superior 32000 es **inalcanzable** con los rangos reales
(máximo 31872); se conserva como guarda.

### F-02 · `FindRadius` — [unit] [FP·Q07]

`(Log(body)·body·905·3·0.25/π)^(1/3)` con suelo body 1, ajuste por cloroplastos
`r += (415−r)·chlr/32000`, suelo final 1 (`Robots.bas:716-740`):

| body | chlr | esperado (Single, tol. 1e-6 rel.) |
|---|---|---|
| 1000 | 0 | 114.2788 |
| 5000 | 0 | 209.5441 |
| 32000 | 0 | 415.4751 |
| 1000 | 16000 | 114.2788 + (415−114.2788)/2 = 264.6394 |
| 1 | 0 | 1 (Log(1) = 0 ⇒ 0 ⇒ suelo) |
| — `FixedBotRadii` | — | 60 (`half`) |

⚠ El comentario del fuente ("radius of 60 for a bot of 1000 body",
`Robots.bas:361-363`) describe la fórmula **anterior** al factor `Log` (añadido
2007): hoy radio(1000) ≈ 114.28, no 60. (Corregida la nota de `constants.yaml` en
este mismo commit.)

### F-03 · `iceil` — [unit]

`If |X| > 32000 Then X = Sgn(X)·32000; iceil = X` (Single→Integer bancario,
`Robots.bas:881-884`):

| entrada | esperado |
|---|---|
| 5.5 | 6 |
| 4.5 | 4 |
| 32000.7 | 32000 |
| 40000 | 32000 |
| −40000 | −32000 |
| −5.5 | −6 |

### F-04 · `UpdatePosition`: integración y clamp — [unit]

(`Robots.bas:826-879`.) **Estado**: `mass = 1`, `AddedMass = 0`, `vel = (0,0)`,
`pos = (1000, 1000)`, `aim = 0`, `MaxVelocity = 40`.

| `ImpulseInd` | esperado | derivación |
|---|---|---|
| (3, 4) | `vel = (3,4)`, `pos = (1003, 1004)`, `mem(200) = 5` | vt = 25 ≤ 1600; velscalar = iceil(√25) = 5 (`:870`) |
| (0, 100) | `vel = (0, 40)`, `pos = (1000, 1040)` | vt = 10000 > 1600 ⇒ `vel = unit·40` (`:841-845`) |
| (3, 4) con `Fixed` | `vel = (0,0)`, `pos` intacta | rama Fixed (`:850-851`) |

Siempre: `ImpulseInd/Res/Static` quedan a 0 al salir (`:855-857`). Publicaciones con
`aim = 0`: `mem(vel) = iceil(cos·vx − sin·vy·(−1)·…)` — para la fila 1:
`mem(vel) = 3`, `mem(veldn) = −3`, `mem(veldx) = 4`, `mem(velsx) = −4` (`:871-874`).
**Clamp lateral**: con `vel = (50000, 0)` entrante, `VectorMagnitudeSquare` clampa
`vel.x` a 32000 **in place** antes de medir (`Common.bas:171-175`) ⇒ el estado del
bot ya queda mutado — parte de la semántica (B-24 de §9).

### F-05 · Muelle de tie con zona muerta — [unit]

(`Physics.bas:465-555`.) **Estado**: bots n (en (1130, 1000)) y m (en (1000, 1000)),
tie tipo 0 (`k = 0.01`, `b = 0.02`, `Ties.bas:932-933`), `NaturalLength = 100`,
velocidades 0, radios cualesquiera con `length − r1 − r2 ≤ 1000`.

- `length = 130` ⇒ `displacement = 100 − 130 = −30`; `|−30| > 20` ⇒ recorte
  `Sgn(−30)·(30−20) = −10` (`:537-539`); `Impulse = 0.01·(−10) = −0.1`;
  `uv = (130, 0)/130 = (1, 0)` (de m hacia n) ⇒ `ImpulseInd_n += (−0.1, 0)` — tira de
  n hacia m. Amortiguación: `Δvel = 0` ⇒ 0 (`:543-545`).
- `length = 110` ⇒ `|disp| = 10 ≤ 20` ⇒ **cero fuerza** (zona muerta).
- `length = 85` ⇒ disp = 15 ≤ 20 ⇒ cero. `length = 70` ⇒ disp = 30 ⇒ recorte +10 ⇒
  `Impulse = +0.1` ⇒ empuja n alejándose de m.
- Amortiguación: `length = 130`, `vel_n = (2, 0)`, `vel_m = 0`:
  `Impulse_b = Dot((2,0),(1,0))·(−0.02) = −0.04` ⇒ `ImpulseInd_n += (−0.14, 0)` total.

El reloj: `last = 100` decrementa a 99 en la misma pasada (`:521`); `last = −20`
incrementa a −19 (`:522`); `last = −1` dispara `regang` (endurecimiento, `:529`);
`last` llega a 1 ⇒ `DeleteTie` (`:525-526`).

### F-06 · `Repel3` con masas dadas — [unit]

(`Physics.bas:845-976`.) **Estado**: bot1 masa 1 en (1000, 1000), `vel = (10, 0)`;
bot2 masa 3 en (1100, 1000), `vel = (−5, 0)`; radios 60 y 60 (solape:
`currdist = 100 < 120`); `CoefficientElasticity e = 0`; ninguno Fixed; ambos con
`|vel| > 1e-4`.

**Esperado**:

1. **Separación posicional** (`:889-894`): `fixedSep = 120 − 100 = 20`; factor
   `1/(1 + 55^0.3) = 0.231084`; vector = (20·0.231084, 0) = (4.6217, 0);
   `pos1 −= 4.6217·(3/4) = (996.53, 1000)`; `pos2 += 4.6217·(1/4) = (1101.16, 1000)`
   (masas **invertidas**: el ligero retrocede más).
2. **Velocidades** (`:916-960`): `unit = (1, 0)`; `p1 = 10·0.99 = 9.9` (>0 se
   conserva); `p2 = −5·0.99 = −4.95` (<0 se conserva);
   `V1f = (p2·(e+1)·M2 + p1·(M1 − e·M2))/(M1+M2) = (−14.85 + 9.9)/4 = −1.2375`;
   `V2f = (p1·(e+1)·M1 + p2·(M2 − e·M1))/(M1+M2) = (9.9 − 14.85)/4 = −1.2375`;
   `vel1' = 10 − 9.9 + (−1.2375) = −1.1375`; `vel2' = −5 − (−4.95) + (−1.2375) =
   −1.2875`. (Comprobación: momento 10·1 − 5·3 = −5 = −1.1375 − 3·1.2875 ✓.)
3. **Efectos sensoriales inmediatos** (`:963-973`): ambos con `mem(hit) = 1` y el
   sector de contacto correcto; `lasttch` cruzados; refvars poblados vía `lookoccurr`
   en ambos sentidos (un bot ciego obtiene refvars de lo que lo toca).

Variante Fixed: bot2 `Fixed` ⇒ `M2 = 32000` en la fórmula (`:904-905`) y su `vel` no
se toca (`:958-960`); con ambos quietos (`|vel| < 1e-4`) la separación es mitad y
mitad sin masas (`:882-887`).

### F-07 · `angle`/`angnorm`/`AngDiff` — [unit] [FP·Q07]

(`Physics.bas:607-648`; convención Y invertida.)

| llamada | esperado | derivación |
|---|---|---|
| `angle(0,0, 10,0)` | 0 | dx=10, dy=0 ⇒ Atn(0) |
| `angle(0,0, 0,10)` | 3·π/2 = 4.712389 | dx=0, dy=−10 < 0 |
| `angle(0,0, 0,−10)` | π/2 | dx=0, dy=10 |
| `angle(0,0, 10,10)` | Atn(−1) = −0.785398 (sin normalizar; `angnorm` ⇒ 5.497787) | dy = y1−y2 = −10 |
| `angle(0,0, −10,10)` | Atn(+1) + π = 3.926991 | dy = y1−y2 = −10, dx = −10 ⇒ Atn(+1); dx < 0 ⇒ +π (corregido 2026-08-24 en M4: la tabla arrastraba el Atn(−1) de la fila anterior) |
| `angnorm(−0.5)` | 5.783185 | +2π |
| `angnorm(7.0)` | 0.716815 | −2π |
| `AngDiff(0.5, 6.0)` | 0.783185 | r = −5.5 < −π ⇒ +2π |
| `AngDiff(6.0, 0.5)` | −0.783185 | r = 5.5 > π ⇒ −(2π−r) |

### F-08 · `AbsoluteEyeWidth` y `NarrowestEye` — [unit]

(`Quads.bas:350-370`.)

| `eyeXwidth` | esperado | derivación |
|---|---|---|
| 0 | 35 | caso especial |
| 100 | 135 | 100 Mod 1256 + 35 |
| 1256 | 35 | 1256 Mod 1256 = 0; +35 |
| −100 | 1191 | −100 + 35 = −65 ≤ 0 ⇒ +1256 |
| 1221 | 1256 | máximo alcanzable |
| −35 | 1256 | −35+35 = 0 ≤ 0 ⇒ 1256 |

`NarrowestEye` con las 9 anchuras a 0 ⇒ 35 (el arranque en 1221 es solo el techo,
`:361-370`).

### F-09 · `EyeSightDistance` y `eyestrength` — [unit] [FP·Q07]

`1440·(1 − Log(w/35)/4)·eyestrength` con atajo `w = 35 ⇒ 1440·eyestrength`
(`Quads.bas:375-397`):

| w | día | esperado |
|---|---|---|
| 35 | sí | 1440 |
| 70 | sí | 1190.467 |
| 1256 | sí | 151.0779 |
| 35 | **no** | 1152 (×0.8) |

`eyestrength` clampa a ≤ 1 (nunca amplifica); pondmode atenúa por profundidad
(`:383-397`).

### F-10 · `eyevalue` — [unit]

`percentdist = (edgetoedgedist + 10)/eyedist`; `eyevalue = 1/percentdist²`, clamp
32000; solape físico (dist ≤ 0) ⇒ 32000 directo (`Quads.bas:566-572`):

| edgetoedge | eyedist | esperado |
|---|---|---|
| 350 | 1440 | 16 |
| 110 | 1440 | 144 |
| 0 | 1440 | 32000 (corregido 2026-08-24 en M4: el test del fuente es `edgetoedgedist <= 0`, `Quads.bas:566` — el 0 exacto cae en la rama de solape, no en la fórmula) |
| −5 (solape) | — | 32000 |

Y el mapeo del ojo con foco: `a = Abs(mem(FOCUSEYE) + 4) Mod 9` (`:578`):
`0 → 4 (eye5)`, `−4 → 0 (eye1)`, `4 → 8 (eye9)`, `5 → 0`, `−13 → 0`, `−5 → 1` —
el `Abs` pliega los negativos lejanos de forma no monótona: −5 y −3 dan 1.

### F-11 · Anchura de ojo negativa ⇒ ojo panorámico — [unit] · [PROBABLE BUG] B2-2

**Estado**: `eyeXwidth = −400` para el ojo en cuestión. **Esperado**:
`hw = (−400 Mod 1256)/400 = −1`; la normalización `While hw < −π/36: hw += π`
(`Quads.bas:533-537`; corregido 2026-08-24 en M4: división real `π/36`, no entera —
ver `32-VISION.md §2.4`) ⇒ `hw = 2.1415927`, y el semiancho efectivo
`hw + π/36 = 2.2288592` rad ≈ 127.7° — un ojo de 255° frente a los 10° por defecto.
La aserción práctica: un bot muy fuera del campo de todo ojo normal (p. ej. a 110°
del aim) es visible por ese ojo. Ojo: la anchura absoluta de ese ojo es
`−400 + 35 ≤ 0 ⇒ 891` ⇒ alcance ≈ 275 twips — panorámico pero corto.

### F-12 · `TieTorque`: clamp de `nay` con el signo de `nax` — [unit] · [PROBABLE BUG] B1-1

**Estado**: dentro de `TieTorque` (`Physics.bas:651-729`), un par que produce
componentes crudos `nax = −150`, `nay = 130` antes de los clamps (`:693-694`).
**Esperado**: `nax' = −100` (`100·Sgn(−150)`); `nay' = **−100**` — el clamp de `nay`
usa `Sgn(nax)`: `If Abs(nay) > 100 Then nay = 100·Sgn(nax)`. El componente Y del
torque invierte su signo. Con `|nay| ≤ 100` no se toca (control: `nax = −150`,
`nay = 80` ⇒ (−100, 80)).

### F-13 · La librería de vectores muta sus argumentos — [unit] · [PROBABLE BUG] B1-3

| llamada | esperado | cita |
|---|---|---|
| `VectorScalar(V=(40000, 2), k=3)` | retorno `(96000, 6)`; **`V` queda (32000, 2)** y si `k` fuera >32000 también se clamparía in place | `Common.bas:125-131` |
| `VectorMagnitudeSquare(V=(50000, 0))` | retorno `32000² = 1.024e9`; **`V` queda (32000, 0)** | `Common.bas:171-175` |
| `VectorMagnitude((3, 4))` | 5 | formulación estable `max·√(1+(min/max)²)` (`:144-156`) |
| `VectorMagnitude((1e-6, 0))` | **0** | `maxVal < 0.00001` ⇒ 0 (`:150-151`) |
| `VectorInvMagnitude((0, 0))` | **−1** | centinela de división por cero (`:159-168`) |

### F-14 · Oclusión por formas rota: transposición + `Or` — [unit] · [PROBABLE BUG] B2-1

(`ShapeBlocksBot`, `Quads.bas:290-344`.) **Estado**: forma en `pos = (1000, 1000)`,
`Width = 400`, `Height = 100`; bot n1 en `(955, 1035)`, bot n2 en `(1035, 955)`.
La línea de visión (x+y = 1990) **no** cruza el rectángulo real
(x ∈ [1000,1400], y ∈ [1000,1100], cuyos puntos cumplen x+y ≥ 2000).

**Esperado**: `ShapeBlocksBot = True` (bloqueado) — la geometría correcta diría False.

**Derivación**: el weed-out AABB pasa (n2.x = 1035 ≥ 1000 etc., `:306-309`).
Borde i=1 "top": `D1(1) = (0, Width) = (0, 400)` — **transpuesto** (el borde
superior real sería (400, 0)); `p(1) = (1000, 1000)`. `D0 = n2 − n1 = (80, −80)`.
`numerator = Cross(D0, D1(1)) = 80·400 − (−80)·0 = 32000 ≠ 0`.
`Delta = (45, −35)`; `s = Cross(Delta, D1(1))/num = (45·400)/32000 = 0.5625 ∈ [0,1]`
⇒ `useS = True`; `t = Cross(Delta, D0)/num = (45·(−80) − (−35)·80)/32000 = −0.025 ∉
[0,1]` ⇒ `useT = False`; el criterio es **`useT Or useS`** (`:335`) ⇒ **True** en el
primer borde. (La sightline cruza la *recta infinita* x = 1000 en s = 0.5625, a
y = 990 — fuera del borde — y aun así "bloquea".) Solo aplica con
`Not shapesAreSeeThrough` (`:445-447`). El port replica esta función literalmente.

### F-15 · `touch`: sectores del contacto — [unit]

(`Senses.bas:21-55`; umbrales literales 5.49/0.78/2.36/3.92 sobre `dang`, con
`aim = 6.28 − rob.aim` y π literal 3.14.) **Estado**: bot en (0,0) con `aim = 0`.

| estímulo en | dang | esperado |
|---|---|---|
| (10, 0) | 0 | `hitup = 1` (frente): ang = Atn(0) = 0; dang = 0 − 6.28 → +6.28 = 0 < 0.78 |
| (−10, 0) | 3.14 | `hitdn = 1` (ang = 0 − 3.14; dang = −9.42 → +6.28·2 = 3.14) |
| (0, 10) | dy=10, dx=0 ⇒ ang = 1.57 ⇒ dang = 1.57 | `hitdx = 1` (0.78 < 1.57 < 2.36) |
| (0, −10) | ang = −1.57 ⇒ dang = 4.71 | `hitsx = 1` |
| exactamente dang = 0.78 | — | **ningún** sector lateral ni frontal (todos los umbrales son estrictos) |

Siempre `mem(hit) = 1` (`:55`). `taste` replica la geometría escribiendo el tipo de
shot y `shang = dang·200` (`:60-95`).

---

## 6. Secuencias con RNG inyectado (prioridad 6)

### R-01 · El LCG de VB6 — [unit] · [FUENTE EXTERNA: MS]

Algoritmo cerrado en Q02 (`OPEN_QUESTIONS.md`; autoridad Microsoft, dotnet/runtime
`VBMath.vb`): estado de 24 bits, `seed₀ = &H50000 = 327680`;
`Rnd()`: `seed = (seed·&H43FD43FD + &HC39EC3) And &HFFFFFF`; retorno
`CSng(seed)/2²⁴`. Primeras 6 extracciones desde proceso fresco:

| # | seed (hex) | `Rnd` (Single) |
|---|---|---|
| 1 | 0xB49EC3 | 0.7055475 |
| 2 | 0x888E7A | 0.53342402 |
| 3 | 0x945B55 | 0.57951862 |
| 4 | 0x4A20C4 | 0.28956246 |
| 5 | 0x4D4C77 | 0.30194801 |
| 6 | 0xC6555E | 0.7747401 |

(El 0.7055475 inicial es el valor clásico documentado del `Rnd` de VB — verificación
cruzada de la implementación.) `Rnd(0)` repite el último sin avanzar; `Rnd(n<0)`
re-siembra desde los bits del argumento; **`Randomize n`** reemplaza solo los bytes
medios: `seed = (seed And &HFF0000FF) Or (((bits And &HFFFF) Xor (bits >> 16)) << 8)`
con `bits` = palabra alta del Double `n`. Caso: proceso fresco + `Randomize 12.34`
(la vía del motor: `Randomize UserSeedNumber/100` con seed de usuario 1234,
`main.frm:1198,1392`) ⇒ estado = 0xEE3C00; siguientes `Rnd`: 0.90983218,
0.10807002, 0.29308063. **[PENDIENTE DE BINARIO]** solo como confirmación
independiente: una observación de 3 valores de `Rnd` en cualquier host VB6 real
cerraría la cadena de fuente externa.

### R-02 · `gasdev`: par de extracciones y caché — [unit]

(`Common.bas:82-100`.) **Estado**: `iset = 0` (limpio); `rndy → [0.25, 0.75]`.
**Esperado**: primera llamada: `V1 = −0.5`, `V2 = 0.5`, `rsq = 0.5`;
`fac = √(−2·ln(0.5)/0.5) = 1.6651092`; devuelve `V2·fac = 0.8325546` y **cachea**
`gset = V1·fac = −0.8325546` (`iset = 1`). Segunda llamada: devuelve `−0.8325546`
**sin consumir RNG** (`iset = 0` de nuevo). Tercera llamada: consume 2+ extracciones.
Con `rsq ≥ 1` (p. ej. `rndy → [0.99, 0.99]`: V1 = V2 = 0.98, rsq = 1.92) **re-tira**
el par completo — el consumo de RNG es 2·k con k re-tiradas. El estado `iset/gset` es
`Static`: **estado global del motor** que un save no persiste (`10-CICLO.md §10`).

### R-03 · `Gauss` determinista — [unit]

Con la secuencia de R-02: `Gauss(10, 100)` = `0.8325546·10 + 100 = 108.32555`;
la llamada siguiente (caché) = `−0.8325546·10 + 100 = 91.67445` sin RNG.
(Base de S-04.)

### R-04 · `ChangeDNA` de un número: mutación mínima reproducible — [unit]

(`NeoMutations.bas:685-745`.) **Estado**: `ismutating = True`; token `(0, 100)` en la
posición t; `PointWhatToChange = 80`; `iset = 0`;
`rndy → [0.5, 0.99, 0.25, 0.75]`.
**Esperado**: token final `(0, 106)`; `Mutations` y `LastMut` +1.
**Derivación**: ① `Random(0, 99)` = Int(100·0.5) = 50 < 80 ⇒ muta el **valor**
(`:703`). ② `|100| ≤ 1000` ⇒ moneda `Int(rndy·2)`: Int(1.98) = 1 ≠ 0 ⇒ rama
`Gauss(7, value)` (`:718-724`). ③ `Gauss(7, 100)`: gasdev con [0.25, 0.75] =
0.8325546 ⇒ 105.8279 → asignación a `.value` (Integer) bancaria ⇒ **106** ≠ 100 ⇒
el `Loop While = old` termina. Con una secuencia que produzca de nuevo 100 (p. ej.
gasdev ≈ 0), el bucle re-tira — el consumo de RNG es variable por diseño.

### R-05 · `newshot`: dos extracciones, una muerta — [unit] · [PROBABLE BUG] B3-4

(`Shots.bas:88-202`.) **Estado**: tirador `aim = 0`, sin `backshot`/`aimshoot`;
`rndy → [0.9, 0.5]`. **Esperado**: `ran = Random(−2, 2)` consume la primera
extracción (Int(5·0.9)−2 = 2) y **se descarta** (`:130`); el jitter real usa la
segunda: `Random(−20, 20)/200` = (Int(41·0.5)−20)/200 = 0/200 = 0 rad (`:146`).
El shot sale exactamente en la dirección del aim. Con `rndy → [0.9, 0.9]`:
jitter = (Int(36.9)−20)/200 = 16/200 = 0.08 rad. La aserción clave para replays:
**2 extracciones por disparo**, en ese orden.

### R-06 · `Vshoot`: doble cobro y dirección aleatoria — [ciclo] · [PROBABLE BUG] B3b-1

(`Shots.bas:1084-1121`.) **Estado**: bot con virus incubado (`Vtimer = 1`),
`mem(vshoot) = 50`, `nrg = 10000`, `SHOTCOST = 2`, `COSTMULTIPLIER = 1`;
`rndy → [0.5]`. **Esperado**: `nrg` final = `10000 − 50 − 2 − 50 − 2 = 9896`
(cargo 1: `tempa/20 = 50` + SHOTCOST; cargo 2: `mem(VshootSys) = 50` + SHOTCOST —
**el precio es doble**, `:1100-1103`); `shot.nrg = 1000` (= 50·20);
`Range = 11 + CInt(50/2) = 36`; dirección = `Random(1, 1256)/200` =
(Int(1256·0.5)+1)/200 = 629/200 = 3.145 rad — **ignora el aim** (1 extracción,
`:1106`); resets: `mem(vshoot) = mem(vtimer) = mem(mkvirus) = 0`, `Vtimer = 0`
(`Robots.bas:1094-1098`).

### R-07 · `maketie`: deflect por slime — [ciclo]

(`Ties.bas:883-958`.) **Estado**: A escribe `.tie` sobre B; slime de B = 50;
`TIECOST = 2`, mult 1. | `rndy` | esperado |
|---|---|
| 0.0 ⇒ `deflect = Random(2, 92) = 2` | 2 < 50 ⇒ **no hay tie**; slime de B −20 (→30); A paga TIECOST/(numties+1) igualmente |
| 0.99 ⇒ deflect = 92 | 92 ≥ 50 ⇒ tie creada (`last = −20`, `Port_A = mem(330)`, `Port_B` = su nº de slot); slime de B −20; A paga |

1 extracción **por intento**, haya tie o no.

### R-08 · Repoblación vegetal: inventario de extracciones — [integración]

(`Vegs.bas:23-38`; `Globals.bas:395-505`; `Module1.bas:28-48`.) **Estado**: 1 especie
vegetal válida, `RepopAmount = 1`, cooldown vencido. **Esperado**: exactamente
**12 extracciones** de `rndy` para el vegetal repoblado, en este orden:

| # | consumidor | cita |
|---|---|---|
| 1-2 | `Random(60, W−60)`, `Random(60, H−60)` — coordenadas **descartadas** (`aggiungirob` con r = −1 las re-sortea) | `Vegs.bas:32`; `Globals.bas:405-415` |
| 3 | `Random(0, SpeciesNum−1)` — especie (con re-tiradas si `checkvegstatus` falla: +1 por re-tirada) | `Globals.bas:410-412` |
| 4-5 | `fRnd` x, `fRnd` y — posición real | `Globals.bas:414-415` |
| 6-11 | `preparerob`: pos.x, pos.y, aim, col1, col2, col3 | `Module1.bas:32-43` |
| 12 | `aim = rndy·2π` — pisa el aim de preparerob | `Globals.bas:466` |

(Corrige el "≈10-11" de `50-MUNDO.md §2.1` — la propia enumeración suma 12 con una
sola tirada de especie; corregido en ese documento en este mismo commit.)

### R-09 · Doble encolado asexual: la moneda — [ciclo]

(`Robots.bas:1667-1675`.) **Estado**: bot encolado asexual con `repro = 30` **y**
`mrepro = 60` activos. | `rndy` | esperado |
|---|---|
| 0.6 (> 0.5) | reproduce con el porcentaje de… la rama `rndy > 0.5` (1 extracción) |
| 0.4 | la otra rama |

La aserción de replays: 1 extracción exacta **solo** cuando ambos comandos están
activos; con uno solo, cero extracciones en la elección.

### R-10 · Loterías vegetales asimétricas — [ciclo] · [PROBABLE BUG] B6-2

**Estado**: vegetal sobre el 90% del techo de cloroplastos, intenta reproducirse.
Asexual: gate `Random(0, 10) <> 5` — pasa solo con resultado **5** (p = 1/11;
`rndy ∈ [5/11, 6/11)` ⇒ pasa) (`Robots.bas:2129`). Sexual: `Random(0, 9) <> 5`
(p = 1/10; `rndy ∈ [0.5, 0.6)`) (`:2456`). Con `rndy = 0.5`: asexual
Int(11·0.5) = 5 ⇒ **pasa**; sexual Int(10·0.5) = 5 ⇒ **pasa**. Con `rndy = 0.46`:
asexual Int(5.06) = 5 ⇒ pasa; sexual Int(4.6) = 4 ⇒ **no pasa**. La asimetría 1/11
vs 1/10 es comportamiento a conservar.

### R-11 · Crossover mínimo: el hijo pierde su primer token — [integración] · [PROBABLE BUG] B6-1

(`Robots.bas:2488-2607,562-694`.) **Estado**: madre y esperma con ADN **idéntico**:
`5 100 store end` → tokens (0,5)(0,100)(7,1)(10,1). Distancia genética 0 ≤ 0.6.
**Esperado**: `simplematch` empareja toda la secuencia (una sola racha); `crossover`
consume 1 moneda por racha para elegir el lado base (con ambos lados idénticos el
resultado es el mismo ADN); ninguno de los tokens tiene `|value| > 999` con el mismo
tipo… (0,100): |100| ≤ 999 ⇒ sin monedas de valor. `Outdna` arranca en el índice
**0** (`:585-588`) ⇒ el hijo tiene `dna(0) = (0,5)`, que la ejecución (desde
`a = 1`) **no ve jamás**: el hijo ejecuta `100 store` — un store con dirección 100 y
pila vacía ⇒ pop de valor = 0 ⇒ `mem(100) = 0`, comportamiento distinto del de la
madre (`mem(100) = 5`). La única excepción: si `dna(0)` resultara exactamente (0,0),
el "bug fix remove starting zero" lo recorta (`:2589-2594`). Aserción adicional:
`DnaLen` del hijo se recalcula sobre el array desplazado.

### R-12 · Orden global de consumo de RNG en el tick — [integración]

Meta-caso para replays: con una sim mínima determinista (1 bot, sin brownianas, sin
mutaciones), el harness registra cada extracción de `rndy` con su consumidor y valida
contra el inventario de Q01 (`OPEN_QUESTIONS.md`): dentro del tick solo consumen los
puntos enumerados (intérprete `rnd`/`rndstore`, disparos 2, mutaciones, repoblación,
fudge/⚙, teleporters/formas con drift, `Decay`, `maketie`, gates vegetales, elección
asexual/sexual, `feedveg2`, sol 2/ciclo con `SunOnRnd`). Cualquier extracción no
inventariada = fallo. Este caso es la red de seguridad de la salvaguarda 4 de
`PLAN.md`.

---

## 7. Formatos ida-y-vuelta (prioridad 7)

### FM-01 · `FileContinue`: el centinela 254×3 — [unit]

(`HDRoutines.bas:1979-2007`.) **Estado**: archivo binario posicionado ante los bytes
indicados. | próximos bytes | esperado | derivación |
|---|---|---|
| `[7, …]` | True (hay campo) | primer byte ≠ 254 corta el bucle |
| `[254, 254, 254]` | **False** (fin de registro) | 3 lecturas de 254 agotan `k < 3` |
| `[254, 254, 9]` | True | el tercer byte ≠ 254 |
| EOF | False | rama EOF (`:1990-1993`) |

En todos los casos la posición del archivo se restaura (`:2005-2006`). Riesgo
estructural documentado (`60-FORMATOS.md §0.1`): un campo legítimo que empiece por
tres bytes 254 truncaría el registro — el port debe conservar el formato, no
"arreglarlo".

### FM-02 · `sint`: Mod, no clamp — [unit] · [PROBABLE BUG] B8-2

(`HDRoutines.bas:2594-2597`.) | entrada (Long) | esperado (Integer) |
|---|---|
| 33000 | 1000 |
| 32000 | 0 |
| 31999 | 31999 |
| −33000 | −1000 |
| 64000 | 0 |

Aplica a `Mutations`/`LastMut` al guardar (`:2080-2081`): un bot con 33000 mutaciones
renace con 1000. Distinto de `mod32000` (N-02): aquí los múltiplos de 32000 dan
**0**, no ±32000.

### FM-03 · El gen epigenético autodestructivo — [integración]

(`HDRoutines.bas:2260-2300`.) **Estado**: `UseEpiGene = True`; bot con
`mem(975) = 7`, `mem(980) = −3`, resto de 971-990 en 0; se guarda a texto.
**Esperado en el archivo** (antes del ADN propio):

```
start
7 975 store
-3 980 store
*.thisgene .delgene store
stop
```

(una línea por celda ≠ 0, `:2276-2286`). **Al recargar y correr 1 ciclo**: el gen 1
ejecuta: `mem(975) = 7`, `mem(980) = −3`, y `mem(340) = mem(341)` — como `thisgene`
vale 1 (el gen en curso), `delgene = 1`; en P3, `BotDNAManipulation` ejecuta
`delgene(bot, 1)` (`Robots.bas:1103-1106`; `NeoMutations.bas:1007-1022`): **el gen
se borra a sí mismo**. Ciclo 2: el ADN original ejecuta ya sin el gen; `DnaLen` y
`mem(336)/mem(339)` re-publicados. La memoria epigenética sobrevivió al formato texto.

### FM-04 · `Hash`: valor concreto y verificación — [unit]

(`DNATokenizing.bas:822-846`.) **Esperado**: `Hash("abc", 20)` =
`!%#"` seguido de 16 `!` (20 caracteres: `buf(0) = 0` ⇒ `Chr(33)`; `buf(1) = 97`
⇒ `Chr(97 Mod 93 + 33) = Chr(37) = %`; `buf(2) = (98+97) Mod 100 = 95` ⇒ `Chr(35) =
#`; `buf(3) = (99+95) Mod 100 = 94` ⇒ `Chr(34) = "`; `buf(4..19) = 0` ⇒ `!`).
Derivación: por carácter k (1-based): `buf(k Mod 20) += Asc(c) + buf((k−1) Mod 20)`,
`Mod 100`; emisión `Chr(buf(k) Mod 93 + 33)`. El `Trim` y el recorte de CrLf previos
(`:828-832`) forman parte del contrato. **Uso**: `'#hash:` en los bots de texto; un
hash que no cuadra al cargar **resetea `generation` y `OldMutations`**
(`:810-816`; `20-VM.md §2.2`) — caso de carga asociado: archivo manipulado ⇒
generation = 0.

### FM-05 · Registro binario de bot: solo 50 vars y `mem` crudo — [integración]

(`HDRoutines.bas:2009-2256` guardar; `:1585-1780` cargar.) **Estado**: bot con 60
variables privadas (`def`s), `mem(500) = −32768` inyectado por estado (solo alcanzable
vía save previo), AbsNum ≠ 0. **Esperado tras guardar y recargar**:

1. Solo `vars(1..50)` sobreviven (`:2058-2062`) — visible únicamente al re-exportar a
   texto (las direcciones ya están tokenizadas).
2. `mem()` entero se restaura **crudo**, las 1001 celdas incluida `mem(0)` y el
   −32768 (`:2067,1655`) — la única vía legal de −32768 en `mem` (`21-MEMORIA.md §7`).
3. `dna(0)` fantasma no se guarda; al cargar se fuerza `end` en el último token
   (`:1663-1665`).
4. El bot conserva su `AbsNum` (solo se regenera si venía 0, `:1595`).
5. Los campos muertos de las ties (`ln`/`shrink`/`stat`/`mem`) van y vuelven
   (`:1638,2047`) — el port los conserva en el formato.

### FM-06 · Ida-y-vuelta de texto inestable para ADN degenerado — [integración] · heredado A2

**Estado**: bot cuyo ADN contiene un token tipo 8 (dejado por mutación de tipo).
**Esperado**: `DetokenizeDNA` lo emite como **`VOID`** (`DNATokenizing.bas:3261`);
al recargar, `VOID` tokeniza como palabra desconocida ⇒ `(0, 0)`. El round-trip
**cambia el ADN** (tipo 8 → número 0): la ida-y-vuelta solo es estable para ADN
canónico. El caso fija ambas mitades (emisión y re-carga).

### FM-07 · `SaveRobHeader`: cap del contador — [unit]

(`DNATokenizing.bas:850-859`.) `generation = 7`, `Mutations = 1.5e9`,
`OldMutations = 1e9` ⇒ el header emite `'#mutations: 2000000000` (cap explícito
`totmut > 2e9 → 2e9`, `:854-855`). Nótese el contraste con la vía binaria (FM-02):
el texto capa, el binario envuelve.

---

## 8. Casos de sitio de error (inventario consolidado)

Los sitios donde el original lanzaba error 6/9/11 con truncamiento de tick
(`10-CICLO.md §14`), cada uno con su decisión de port. Los tres primeros ya tienen
caso propio; el resto se especifica aquí:

| sitio | caso | decisión de port |
|---|---|---|
| `add`/`sub` con operando ≈ 2³¹ | N-07 | saturar a ±2·10⁹ + log de divergencia |
| bot solo-defs (ADN vacío) | V-07 | no-op documentado |
| literal fuera de ±32767 / def 1001+ | V-09 | rechazo de carga (igual que el original, sin diálogo) |
| `rep()` desbordada (≥32001 encolamientos) | — | cola dimensionada a 2×capacidad; inalcanzable (análisis Q13) |
| encogimiento de `rob()` en mitad de P2 (`Robots.bas:1168` + `:3040-3054`) | — | el port no encoge el array a mitad de pasada; semántica: las muertes de P2 no invalidan los índices restantes de la pasada |
| `Kills ≥ 32768` → `mem(220)` (`Shots.bas:594-595`) | — | clamp a 32000 (igual que la vía de ties, `Ties.bas:419-421`) + log de divergencia; el rango 32001..32767 sí se replica (B-24 de §9) |
| `GravityForces` con `PhysMoving = 0` (`Physics.bas:398`) | — | rechazar/clampar `PhysMoving = 0` al cargar opciones (`30-FISICA.md §8`) |
| `TieTorque` con 10 ties y `|mt| > 2π` → `Ties(11)` (`Physics.bas:712`) | — | con el máximo real de 9 ties la escritura cae en `Ties(10)` (slot fantasma, B-27); el caso 10-ties es inalcanzable por creación (`34-TIES.md §0.1`) |
| `nextlowestmultof2 ≥ 16384` (liga ⚙) | S-05 | fuera del core |
| consola/UI escribiendo `val()` sin límites | — | fuera del core (la consola del port valida rango) |

---

## 9. Los `[PROBABLE BUG]` como aserciones: catálogo completo

Regla 4: cada uno se testea **como comportamiento correcto**. Mapeo del catálogo de
los documentos A1-B8 a casos; los no cubiertos arriba se definen aquí (B-nn).

| # | bug (doc §) | caso |
|---|---|---|
| A1-1 | `Shock` destruye energía (`10-CICLO.md §11.1`) | **B-01** |
| A1-2 | encogimiento de `rob()` en mitad de pasada | §8 (sitio de error) |
| A1-3 | `KillRobot(0)` alcanzable (`§8`) | **B-02** |
| A1-4 | busy-wait de 67 ms (`§1`) | UI ⚙ — sin caso (el port no lo replica) |
| A1-5 | doble encolado de reproducción | R-09 |
| A1-6 | `UpdateTieAngles` sobre slots vacíos | **B-03** (aserción de no-efecto) |
| A1-7 | los encolados para morir se reproducen antes | **B-04** |
| A2-1 | `else` tras `start` muerto | V-01 |
| A2-2 | corrimiento del cero inicial con `def`s | V-06 / V-07 |
| A2-3 | `dup` vacío apila dos ceros (asimetrías de underflow) | N-16 |
| A2-4 | `%=`/`~=` con referencia negativa siempre falsos | N-19 |
| A2-5 | `++` en 2³¹−1 → 0; `BitToNumber` sin −2³¹ | N-18 |
| A2-6 | flags de tie solo en stores de 2 operandos | V-12 |
| A2-7 | `debugint` altera el tope | V-13 |
| A2-8 | bucle anti-espacios muerto del cargador | sin efecto observable — sin caso |
| A3-1 | `refvelsx` siempre 0 | M-06 |
| A3-2 | `trefshell` nunca borrado | M-07 |
| A3-3 | `trefnrg` congelado con socio a ±32000 | **B-05** |
| A3-4 | espionaje de ojos por tie mira `mem(479)` | **B-06** |
| A3-5 | `mem(220)`/`mem(715)` sin clamp (kills) | **B-24** (+ §8) |
| A3-6 | `hitang` (221) sin escritor | **B-07** |
| A3-7 | `strbody`/`fdbody` negativos eternos | M-04 |
| A3-8 | resets de `fixang`/`fixlen` tras gate; centinela 32000 | M-04 |
| A3-9 | `UpdateTieAngles` slots vacíos (=A1-6) | B-03 |
| A3-10 | `ChangeChlr` no filtra signos | **B-08** |
| B1-1 | `TieTorque` clampa `nay` con `Sgn(nax)` | F-12 |
| B1-2 | `TieTorque` escribe `Ties(j)` en slot fantasma | **B-27** |
| B1-3 | librería de vectores muta argumentos | F-13 |
| B1-4 | `ReSpawn` toroidal mueve el organismo entero | **B-09** |
| B1-5 | corpses colisionan y reciben touch/lookoccurr | **B-10** |
| B1-6 | bucket-clamp fuera del campo | **B-11** |
| B2-1 | oclusión transpuesta con `Or` | F-14 |
| B2-2 | anchura de ojo negativa ⇒ ojo panorámico (normalización `+π` del semiancho) | F-11 |
| B2-3 | `EYEF` no actualizado dentro de forma | **B-12** |
| B2-4 | `lastopppos` solo del ojo frontal | **B-13** |
| B2-5 | anchura de ojo distinta bots/formas | **B-14** |
| B3-1 | inmunidad filial slot-vs-AbsNum | **B-15** |
| B3-2 | slot tirador intocable aunque cambie de dueño | **B-16** |
| B3-3 | `.shoot` múltiplo de 1000 → esperma | M-09 |
| B3-4 | RNG desperdiciado en `newshot` (+`FirstSlot` en `releasenrg`) | R-05 |
| B3-5 | early-exit `MinBotRadius` (sesgo por índice) | **B-17** |
| B3-6 | `takewaste` sin techo inmediato | **B-18** |
| B3b-1 | doble cobro de `Vshoot` | R-06 |
| B3b-2 | slime penetrada amplifica `power` | **B-19** |
| B3b-3 | potencia del virus ∝ número de gen | **B-20** |
| B3b-4 | `mem(mkvirus)` persistente refabrica | **B-21** |
| B4-1 | slot 10 de Ties fantasma con `.ang` heredable | B-27 |
| B4-2 | sharing con caps destruye recursos | **B-22** |
| B4-3 | `tieportcom` inútil con puerto 0 (tie de nacimiento) | **B-23** |
| B5-1 | P4 anti-gigantes muerta (`bodyfix = 32100`) | **B-25** |
| B5-2 | venom 1:1 vs poison 4:1 | **B-26** |
| B5-3 | suelo −1000 de MOVECOST (regalo) | **B-28** |
| B5-4 | `ChangeChlr` cobra solo compras netas y anula si arruina | B-08 |
| B6-1 | el hijo sexual pierde su primer token | R-11 |
| B6-2 | loterías vegetales asimétricas | R-10 |
| B6-3 | crossover pierde tramos / no determinista | **B-29** |
| B6-4 | `nbody As Integer` (bancario) | **B-30** |
| B6-5 | suelos anti-freeze reescriben tasas heredables | **B-31** |
| B6-6 | Minor = MajorDeletion salvo defaults | **B-32** |
| B6-7 | `Insertion` cuenta 2 mutaciones/token | **B-33** |
| B6-8 | `Amplification` empieza en t = 2 | **B-34** |
| B6-9 | mutaciones en vida no refrescan `makeoccurrlist` | **B-35** |
| B7-1 | coordenadas de `VegsRepopulate` descartadas | R-08 |
| B7-2 | salida internet acoplada al sondeo de entrada | nota (⚙ infra; sin caso ejecutable del core) |
| B7-3 | teleporter con un eje de drift no traslada | **B-36** |
| B7-4 | primera repoblación tarda 2× | **B-37** |
| B8-1 | recursión de `SaveSimulation` en error | decisión de port: error limpio, sin recursión — sin caso de valor |
| B8-2 | `sint` envuelve | FM-02 |
| B8-3 | tag contaminado con nrg (eco-IM ⚙) | fuera del core |
| B8-4 | riesgo del centinela 254 | FM-01 |
| B8-5 | vars 51+ perdidas | FM-05 |

### B-01 · `Shock` destruye la energía — [ciclo]

**Estado**: no-vegetal, `nrg = 8000`, `onrg = 8000` (del ciclo previo),
`body = 100`; en este ciclo pierde 5000 nrg (p. ej. un shot −2 enemigo) ⇒
`nrg = 3000 < onrg/2 = 4000` y `nrg > 3000` falla… ajustar: pérdida a 4500 ⇒
`nrg = 3500 > 3000` y `3500 < 4000`. **Esperado en P5 (`Shock`)**: `nrg = 0` y
`body = 100` **sin cambio** — la línea `body += nrg/10` corre después de `nrg = 0` y
suma 0 (`Robots.bas:1281-1297`). La energía se destruye; el body extra que sugiere el
código nunca aparece.

### B-02 · `KillRobot(0)` desde la matanza por presión — [integración]

**Estado**: `totlen > 4·10⁶` y ningún vivo bajo el umbral 320000 de `nrg + body·10`.
**Esperado**: `Call KillRobot(selectrobot)` con `selectrobot = 0` (nunca asignado):
el slot 0 fantasma recibe `delallties 0`, `makepoff 0`, `exist = False`
(`Master.bas:444-459`; `Robots.bas:2970-3056` sin chequeo de `exist`). Aserción:
ningún bot vivo muere, el estado del slot 0 queda "matado", la sim continúa.
El port replica el no-op efectivo (o documenta la divergencia si su slot 0 no existe).

### B-03 · `UpdateTieAngles` sobre slots vacíos: sin efecto — [ciclo]

**Estado**: slot t con `exist = False` (y `numties = 0` residual). **Esperado**: la
pasada P5 llama `UpdateTieAngles t` igualmente (`Robots.bas:1621`) y solo escribe
`mem(450) = mem(451) = 0` del slot (`Ties.bas:87-88`); `posto` borra el slot entero
al reutilizarlo (`Robots.bas:2962-2963`) ⇒ **sin efecto observable**. Aserción de
paridad: un port que salte los slots vacíos es equivalente — el caso documenta que
ambas implementaciones son legales (Q11).

### B-04 · Reproducirse y morir en el mismo ciclo — [ciclo]

**Estado**: bot con `repro` activo y `Dead = True` marcado en P5 (p. ej. veneno
letal); ambos encolados. **Esperado**: `ReproduceAndKill` procesa **primero** toda la
cola `rep()` y después `kil()` (`Robots.bas:1659-1696`): el bot deja un hijo y
muere después. El hijo ocupa un slot libre de ciclos anteriores, nunca el del padre
(las muertes van después).

### B-05 · `trefnrg` congelado a 32000 — [ciclo]

**Estado**: bots atados; el atado con `nrg = 32000` exacto. **Esperado**:
`ReadTRefVars` **no** actualiza `mem(464)` (guarda `< 32000` estricta,
`Ties.bas:721-723`): si la celda traía el valor de otro socio anterior, lo conserva;
si traía 0, queda 0 — "socio a tope de energía" es invisible. Con `nrg = 31999`,
`mem(464) = 31999`.

### B-06 · Espionaje de ojos por tie mira la celda equivocada — [ciclo]

**Estado**: A atado a B; A escribe `tmemloc` (`mem(476)`) = 505 (un ojo de B), y
`trefaim` (`mem(479)`) llega con el aim de B (< 501 normalmente). **Esperado**: el
`View` de B **no** se marca (el chequeo usa `mem(479)` en vez de `mem(476)`,
`Ties.bas:756-758`). Contra-caso: si el aim publicado de B cae en 501..509 (aim
≈ 2.5..2.55 → `trefaim` 501..509), `View` de B se marca **espuriamente**. (Compárese
con la versión correcta por visión: `Senses.bas:335-337`.)

### B-07 · `hitang` no tiene escritor — [ciclo]

**Estado**: bot golpeado/tocado por todos los flancos durante varios ciclos.
**Esperado**: `mem(221)` permanece exactamente como esté (0, o lo que el propio bot
escriba): ningún código del motor la escribe (`21-MEMORIA.md §9.6`). Es memoria
libre con nombre.

### B-08 · `ChangeChlr` suma signos — [ciclo]

(`Robots.bas:1240-1260`.) **Estado**: bot con `chloroplasts = 100`, `nrg = 5000`,
`CHLRCOST = 0.2`, mult 1; ADN escribe `mkchlr = 1`, `rmchlr = −100`.
**Esperado**: `chlr = 100 + 1 − (−100) = 201` (+101); coste = `101·0.2 = 20.2`
(cobra el neto añadido); `nrg = 4979.8`; ambas celdas a 0. **Contra-caso**: con
`nrg = 110`, `newnrg = 110 − 20.2 = 89.8 < 100` ⇒ **la compra se anula** (`chlr`
vuelve a 100) y no se cobra (`:1253-1257`).

### B-09 · `ReSpawn` toroidal traslada el organismo entero — [integración]

**Estado**: multibot de 3 células atadas; una célula cruza el borde toroidal.
**Esperado**: `bordercolls` → `ReSpawn` traslada **las 3 células** el mismo
desplazamiento y sincroniza `opos = pos` de cada una (para que `actvel` no registre
el salto) (`Physics.bas:774-841`; `Multibots.bas:9-49`). Aserción: la geometría
relativa del organismo es idéntica antes y después; `actvel` de las 3 células no
salta.

### B-10 · Los corpses colisionan y se ven — [ciclo]

**Estado**: corpse en la trayectoria de un bot vivo. **Esperado**: (a) la colisión
ocurre (los buckets no filtran `Corpse`, `Quads.bas:223-271`) y el vivo recibe
`touch` + refvars del corpse (con `occurr` borrado pero `refnrg`/`refbody` reales —
así se localizan cadáveres); (b) el corpse recibe `touch` pero su `EraseSenses` no
corre (M-12); (c) el corpse es visible para los ojos (sin filtro en
`CompareRobots3`, `Quads.bas:401-592`).

### B-11 · Bots fuera del campo colisionan en el borde de la rejilla — [ciclo]

**Estado**: bot en `pos.x = −5000` (fuera del campo, p. ej. teleporter mal
configurado). **Esperado**: `UpdateBotBucket` lo clampa a la celda 0 de la rejilla
(`Quads.bas:80-91`): sigue viendo y colisionando como si estuviera en el borde.

### B-12 · Dentro de una forma, `EYEF` no se actualiza — [ciclo]

**Estado**: bot dentro del AABB de una forma visible; su barrido previo de bots dejó
`mem(EYEF) = 144`. **Esperado**: los 9 ojos (`mem(501..509)`) = 32000, `lastopp` = la
forma, `lastopptype = 1`, **pero `mem(EYEF) = 144`** (rancio): el camino "bot dentro
de la forma" sale con `GoTo getout` sin tocar EYEF (`Quads.bas:643-653`).

### B-13 · `lastopppos` solo se captura para el ojo frontal — [ciclo]

**Estado**: `focuseye = 2` (foco en eye7); una forma visible por ese ojo, ninguna
por eye5. **Esperado**: `refxpos/refypos` de la forma (vía `lookoccurrShape`) salen
de un `lastopppos` **obsoleto o (0,0)** — solo el bucle del ojo `a = 4` lo captura
(`Quads.bas:807,825-831`). Con `focuseye = 0` (eye5) los refvars son correctos.

### B-14 · Anchura de ojo: fórmulas distintas bots/formas — [unit]

**Estado**: `eyeXwidth = 1300`. **Esperado**: contra **bots**, semiancho
`(1300 Mod 1256)/400 + π/36 = 44/400 + 0.0872665 = 0.1972665` rad; contra **formas**,
`(1300 + 35)/400 = 3.3375` → normalizado a [0, π] con π enteros (`Quads.bas:736-738`)
= 3.3375 − 3.14159265 = 0.1959073 rad. Mismo sysvar, campos visuales distintos según
el objetivo (`32-VISION.md §3.4`).

### B-15 · La inmunidad filial está rota — [ciclo]

(`Shots.bas:330`.) **Estado**: sim donde slots y AbsNum ya divergieron. Padre
(slot 3, AbsNum 250) dispara; su hijo recién nacido (age ≤ 1, `parent = 250`) está
en la trayectoria. **Esperado**: el shot **golpea al hijo** — la comparación es
`Shots(t).parent (= 3, slot) = rob(h).parent (= 250, AbsNum)` ⇒ falsa.
**Contra-caso** (sim recién sembrada, slot = AbsNum = 3): la inmunidad funciona.
El port replica la comparación slot-vs-AbsNum tal cual.

### B-16 · El slot tirador es intocable aunque cambie de dueño — [ciclo]

(`Shots.bas:998`.) **Estado**: bot en slot 5 dispara y muere; un recién nacido ocupa
el slot 5; el shot sigue volando hacia él. **Esperado**: el shot **nunca** golpea al
nuevo ocupante del slot 5 (`Shots(shotnum).parent <> robnum` compara slots).

### B-17 · Early-exit de la colisión de shots: sesgo por índice — [ciclo]

(`Shots.bas:1061`.) **Estado**: un shot cuya trayectoria de este tick cruza a los
bots A (slot 3) y B (slot 9), con B más cerca en tiempo de impacto (t_B = 0.1 <
t_A = 0.15). **Esperado**: si A se evalúa primero y su t_A = 0.15 ≤ 0.2
(`MinBotRadius`), la búsqueda **se detiene**: golpea A aunque B estaba antes.
Con t_A = 0.3 > 0.2 la búsqueda continúa y gana B (el t menor). El orden de
evaluación es el orden de slots (búsqueda lineal, `:989-1060`).

### B-18 · `takewaste` sin techo inmediato — [ciclo]

(`Shots.bas:817-827`.) **Estado**: víctima con `waste = 31900`; shot −4 de
`power = 500`. **Esperado**: `waste = 32400` **durante el resto del paso 14 y P1-P4**
(visible para los gates de `defacate`/`altzheimer` del mismo tick); el clamp a 32000
llega con `HandleWaste` en P5 (`Robots.bas:1185-1195`).

### B-19 · La slime penetrada amplifica `power` — [ciclo]

(`Shots.bas:1183-1191`.) **Estado**: víctima con `slime = 100`; virus entrante con
`power = 10`. **Esperado**: umbral de absorción `slime·0.05 = 5 ≤ 10` ⇒ penetra;
`slime = 100 − 10·20 = −100` → luego `power = 10 − (−100)·0.05 = 15` (**mayor** que
el original) → slime normalizada a 0 (`< 0.5`). Hoy `power` no se reutiliza tras
esto (la infección procede igual), así que la aserción observable es: slime final 0,
infección **sí** ocurre. **Contra-caso**: `power = 4 < 5` ⇒ absorbido, `slime = 20`,
sin infección. Replicar el orden exacto: cualquier "arreglo" cambiaría el umbral.

### B-20 · Potencia del virus ∝ número de gen — [ciclo]

(`Shots.bas:1124,1183`.) **Estado**: dos bots idénticos fabrican virus del gen 1 y
del gen 7 respectivamente (misma longitud de gen, misma energía de disparo).
**Esperado**: `Shots().value` = 1 y 7; al golpear, `power = nrg/(Range·40)·value` —
el virus del gen 7 lleva 7× la potencia contra la slime. Geometría del código.

### B-21 · `mem(mkvirus)` persistente refabrica — [ciclo]

(`Robots.bas:1049-1112`.) **Estado**: bot escribe `mkvirus = 2` una sola vez; nunca
escribe `vshoot`. **Esperado**: fabrica el virus (Vtimer = 2·genelength, cobro
`genelength·DNACOPYCOST·mult`); `Vtimer` baja hasta **1 y espera** (`If .Vtimer > 1
Then …−1`, `:1056-1058`); `mem(335)` sigue en 2 (**no se consume hasta el disparo**,
`:1096`). Si el virus se dispara (vshoot llega), el reset pone `mkvirus = 0`; si el
bot re-escribe `mkvirus`, refabrica al expirar. Un solo write = un virus incubado
indefinidamente; el cobro de fabricación ocurrió **una** vez (gate `Vtimer = 0`).

### B-22 · El sharing con caps destruye recursos — [ciclo]

(`shareslime`, `Robots.bas:1894-1910`.) **Estado**: multibot A-B; `slime_A = 32000`,
`slime_B = 32000`; A escribe `mem(833) = 90`. **Esperado**: `tot = 64000`;
lado A = `64000·0.9 = 57600 ≥ 32000` ⇒ **32000**; lado B = `64000·0.1 = 6400`.
Total final 38400: **25600 de slime destruidos en silencio**. Mismo patrón para
waste/shell/nrg/cloroplastos (`21-MEMORIA.md`/`34-TIES.md §2.1`).

### B-23 · `tieportcom` y el puerto 0 — [ciclo]

(`Ties.bas:56-70`.) **Estado**: padre e hijo unidos solo por la tie de nacimiento
(puerto del padre = 0, puerto del hijo = su nº de slot de tie ≥ 1,
`Ties.bas:924,943`). El padre escribe `tienum = 0`… **Esperado**: el padre **no
puede** usar `tieloc`/`tieval` por esa tie: el gate exige `mem(tienum) ≠ 0` y su
puerto es 0. El **hijo sí** (su puerto es ≥ 1). La comunicación padre→hijo por la
tie de nacimiento es unidireccional inversa — comportamiento a conservar.

### B-24 · `Kills` 32001..32767 sobre `mem(220)` — [ciclo] (teórico)

(`Shots.bas:594-595`.) **Estado**: tirador con `Kills = 32001` (estado inyectado).
**Esperado**: al matar por shot, `mem(220) = 32001` — **sobre** 32000, sin clamp
(la vía de ties sí clampa, `Ties.bas:419-421`). Único camino del motor que deja
32000 < x < 32768 en `mem` en juego normal (Q15). Con `Kills = 32768` el original
lanzaba error 6 (§8).

### B-25 · La pasada anti-gigantes está muerta — [ciclo]

(`Robots.bas:1613-1617`; `bodyfix = 32100` default, `HDRoutines.bas:854`.)
**Estado**: bot con `body = 32000` (máximo), `chloroplasts = 0`, `Kills = 100`.
**Esperado**: P4 **no** lo mata (`body > bodyfix` = 32000 > 32100 falso; `body` está
clampado a ≤32000 en todos los caminos, `Robots.bas:1275`). La regla "asesinos con
Kills > 5 mueren" no opera en una instalación estándar. Contra-caso de control: con
`bodyfix = 1000` configurado, el mismo bot muere en P4.

### B-26 · Venom 1:1, poison 4:1 — [ciclo]

(`Robots.bas:2010-2089`.) **Estado**: dos bots con `nrg = 1000`; uno escribe
`mkvenom = 100`, el otro `mkpoison = 100`; costes 0 salvo la conversión implícita.
**Esperado**: el primero gana 100 venom por 100 nrg (1:1, `:2015`); el segundo gana
100 poison por **25** nrg (4:1, `:2055`); ambos capados a +100/ciclo. El poison es
4× más barato — geometría del código.

### B-27 · El slot fantasma `Ties(10)` y su `.ang` heredable — [ciclo]

(`Physics.bas:705-712`; `Ties.bas:883-958`.) **Estado**: bot con 9 ties (máximo por
creación) cuyas ties acumulan `|mt| > 2π` en `TieTorque` con `j` apuntando al slot
10 (vacío, `pnt = 0`). **Esperado**: `Ties(10).ang = dlo` se escribe en el slot
vacío; como `maketie` **no inicializa** `.ang` (`34-TIES.md §4.1`), si una tie
posterior ocupa el slot 10 por corrimiento de `DeleteTie`, hereda ese `.ang` rancio
hasta que `regang` lo pise. Aserción: el estado del slot 10 tras la secuencia.

### B-28 · El suelo −1000 del coste de movimiento — [ciclo]

(`Physics.bas:452-458`.) **Estado**: `MOVECOST = −10` (costes negativos
configurados), mult 1; bot con `NewAccel` de magnitud 40. **Esperado**:
`EnergyCost = 40·(−10) = −400 > −1000` ⇒ gana 400 nrg. Con magnitud 200 (clamp de
`MaxVelocity` mediante — usar MaxVelocity = 200): coste crudo −2000 → **suelo
−1000**: gana exactamente 1000. El techo simétrico: EnergyCost > nrg se recorta a
nrg (no puede quedar negativo por moverse).

### B-29 · El crossover pierde tramos — [integración] (RNG-parametrizado)

(`Robots.bas:596-626`.) **Estado**: madre `A B C D end`, esperma `A B D end` (C no
emparejado, presente solo en la madre; A B y D emparejados);
la moneda del tramo no emparejado con `rndy < 0.5` elige el lado de la madre.
**Esperado**: con `rndy = 0.4` el hijo conserva C; con `rndy = 0.6` **C se pierde**
(el tramo se descarta: el hijo es más corto que ambos padres). Cada racha emparejada
consume además 1 moneda de lado. El caso fija la secuencia completa de monedas y el
ADN resultante token a token (más el corrimiento de R-11).

### B-30 · `nbody As Integer`: el body del hijo redondea bancario — [ciclo]

(`Robots.bas:2108,2140` — `Dim nbody As Integer`.) **Estado**: padre con
`body = 501`, `per = 50`. **Esperado**: `nbody = (501/100)·50 = 250.5` → asignación
a Integer **bancaria** → **250** (par); el padre pierde 250, el hijo recibe 250.
Con `body = 503`: 251.5 → 252. Todo lo demás del reparto es Single.

### B-31 · Los suelos anti-freeze reescriben las tasas heredables — [ciclo]

(`NeoMutations.bas:461-465`; K por operador en `constants.yaml`.) **Estado**: bot con
`DnaLen = 1200`, `Mean(PointUP) = 3`, `StdDev(PointUP) = 1`, `MutCurrMult = 1`,
`mutarray(PointUP) = 0.2` (tasa heredada muy baja). **Esperado**: al correr
`PointMutation`, `floor = 1200·(3+1)/(400·30)·1 = 0.4`; como `0.2 < 0.4`,
**`mutarray(PointUP) = 0.4` queda escrito en el bot** — permanente y heredable.
Con `mutarray = 5000` (default), sin cambio. La "configuración" muta sola con el
tamaño del ADN.

### B-32 · Minor y MajorDeletion son el mismo operador — [unit]

(`NeoMutations.bas:899-965`.) **Estado**: mismo ADN, mismas tasas y misma secuencia
RNG para ambos operadores, con `Mean/StdDev` igualados a mano. **Esperado**:
resultado **idéntico** token a token (el código es el mismo; solo difieren los
defaults 3±1 vs 1±0 y comparten suelo K = 2.5 sin factor Mean, `:904,939`).

### B-33 · `Insertion` cuenta 2 mutaciones por token — [ciclo]

(`NeoMutations.bas:811-843,836-837`.) **Estado**: una inserción de `Length = 3`
tokens. **Esperado**: `Mutations`/`LastMut` suben **6** (cada token insertado pasa
por `ChangeDNA` dos veces: tipos con PWTC = 0 y valores con PWTC = 100); los números
nuevos se siembran con `Gauss(500, 0)` (`:713`). Afecta a la auto-especiación y a
`epireset` (contadores inflados).

### B-34 · `Amplification` nunca centra en el token 1 — [ciclo]

(`NeoMutations.bas:258-260`.) **Estado**: ADN cualquiera; forzar la probabilidad a 1
(tasa mínima). **Esperado**: los centros de amplificación observados son t ∈
[2, UBound−1]: el `t = 1` inicial se incrementa **antes** del primer test
(`Do … t = t + 1 … Loop Until`). El primer token nunca es centro.

### B-35 · Las mutaciones en vida no refrescan la firma — [ciclo]

(`NeoMutations.bas §1`; hallazgo A3.) **Estado**: bot cuya única referencia `*n` a
`.shoot` desaparece por mutación en vida. **Esperado**: su `occurr`/`my*`
(`myshoot` etc., mem 721-731) **siguen** anunciando la firma vieja hasta el próximo
parto/virus/carga (que sí llaman `makeoccurrlist`); `mem(336)/mem(339)` en cambio sí
se re-publican tras la mutación.

### B-36 · Teleporter con un solo eje de drift no se mueve — [ciclo]

(`Teleport.bas:320`.) **Estado**: teleporter con drift X activo y drift Y inactivo;
varios ciclos de `DriftTeleporter` acumulando velocidad X. **Esperado**:
`MoveTeleporter` **no traslada** (exige ambos flags); la velocidad acumulada nunca
se aplica. Con ambos flags, traslada con tope `MaxVelocity/4` y rebote/envoltura.

### B-37 · La primera repoblación tarda el doble — [integración]

(`main.frm:1507`; `Vegs.bas:23-38`.) **Estado**: sim nueva con `RepopCooldown = 25`,
sin cloroplastos. **Esperado**: `cooldown` arranca en **−25**: la primera tanda de
vegetales llega tras ~50 ciclos elegibles; las siguientes cada 25 (el acumulador
descuenta el umbral y conserva el resto — repoblación "con deuda").

---

## 10. Cierre: pendientes, tolerancias y hallazgos

### 10.1 ¿Qué queda [PENDIENTE DE BINARIO]?

Con la premisa corregida (chequeos activos ⇒ EXE ≈ IDE) y las decisiones de port de
Q07/Q17, **ningún caso dorado tiene un valor esperado incalculable**. Quedan dos
observaciones que un binario funcional cerraría, ambas de confirmación, no de
bloqueo:

1. **R-01 (LCG)**: los valores derivan de la fuente externa de Q02 (Microsoft). Una
   observación única — los 3 primeros `Rnd` de un VB6 real recién arrancado
   (esperados 0.7055475, 0.5334240, 0.5795186) — convertiría la cadena
   `[FUENTE EXTERNA: MS]` en verificación directa.
2. **Los casos [FP·Q07]** (S-03, N-12, N-14, F-02, F-07, F-09, R-02/R-03): el último
   ulp del `Single` intermedio puede diferir del x87 con doble redondeo. Una
   observación única — `mem` tras ejecutar `314 sin 999 store` y
   `30000 40000 pyth 998 store` en el EXE — acotaría la divergencia real. Los
   enteros esperados de esas tablas no cambiarían salvo empate de redondeo
   (ninguno de los elegidos lo es).

### 10.2 Qué regaló (y qué contradijo) la suite de los autores

- **Regalos**: las tablas de `nextlowestmultof2` (S-05), los 12 valores exactos de
  vectores (S-03), `Random(10,0) = 0` (S-01), los clamps de `Gauss` (S-04),
  `Max`/`Min` (S-06). Todos verificados contra el fuente: coinciden con la spec.
- **Contradicción de primer orden**: los tests de `fRnd` asertan `r ∈ [low, up]`;
  el fuente produce `up+1` con probabilidad ~0.5/(up−low+1) (S-02). No es un error
  de la spec: es un test de los autores que **ya fallaba** (intermitentemente) contra
  su propio motor. El caso dorado fija el comportamiento real (21), y la fuga tiene
  un efecto vivo (posición de vegetales, `Globals.bas:414-415`).
- **Cobertura**: la suite no toca la VM, la física ni el ciclo — el 95% de este
  documento no tenía red previa.

### 10.3 Correcciones a la spec derivadas de este documento

1. **`50-MUNDO.md §2.1`**: el total de RNG por vegetal repoblado es **12** (con una
   tirada de especie), no "≈10-11" — la propia enumeración del documento sumaba 12
   (corregido en este commit; ver R-08).
2. **`constants.yaml` (`CubicTwipPerBody`)**: la nota "radio(1000 body) = 60"
   reproduce el comentario del fuente (`Robots.bas:361-363`), que describe la fórmula
   **anterior** al factor `Log(body)` añadido en 2007; el radio real de body 1000 es
   ≈ 114.28 (F-02). Nota corregida en este commit.

Ninguna otra derivación contradijo los documentos A/B: las semánticas citadas
(mod32000, stacks, flujo, stores, Repel3, muelles, visión, formatos) se verificaron
línea a línea contra el fuente al derivar cada caso.

### 10.4 Cobertura contra las prioridades del brief

| prioridad | casos |
|---|---|
| 1 · numérica base | N-01..N-19, S-02 |
| 2 · VM y flujo | V-01..V-16 |
| 3 · memoria y ciclo | M-01..M-12 |
| 4 · [PROBABLE BUG] | §9 completo (37 aserciones B-nn + cruces) |
| 5 · física determinista | F-01..F-15 |
| 6 · RNG inyectado | R-01..R-12 |
| 7 · formatos | FM-01..FM-07 |
| sitios de error | §8 (10 sitios, cada uno con decisión de port) |
