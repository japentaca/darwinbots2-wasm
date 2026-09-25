# Revisión del port contra el fuente VB6

> Revisión independiente del port (`port/core`) **contra el fuente VB6**
> (`Darwinbots2/`, commit `02b20d7`), no contra la spec: si la spec se extrajo mal,
> el port la sigue fielmente y la suite pasa igual. Cada hallazgo confirmado lleva un
> test en `port/tests/test_revision.cpp` que afirma el comportamiento del original,
> marcado `doctest::should_fail()` mientras la divergencia exista. Esta revisión no
> corrige nada: los arreglos se deciden uno a uno.

## Piloto 1 — VM de ADN (2026-09-24)

**Alcance**: ejecución del ADN. `DNA.bas` completo (`ExecuteDNA`, los 14 básicos,
14 avanzados, 9 bitwise, 10 condiciones, 11 lógicos, 14 stores, flujo y `ExecRobs`),
las pilas de `Module1.bas:143-292`, `Bitwise.bas`, y los helpers que usan
(`Random`/`fRnd` de `Common.bas`, `angle`/`angnorm`/`AngDiff` de `Physics.bas`),
frente a `vm.hpp`, `dnaops.hpp`, `stacks.hpp`, `bitwise.hpp`, `common.hpp` y
`master.hpp::ExecRobs`. **Fuera**: el tokenizador (`DNATokenizing.bas`), que queda
para un piloto propio.

**Método**: lectura rutina a rutina de las dos versiones mirando los tipos
declarados y la regla de tipos de cada operador VB6, el orden de los pops, el
momento de cobrar los costes, el orden de consumo del RNG, los rangos y bordes, y
los `[PROBABLE BUG]` conservados. Cada candidato se confirma con un contraejemplo
numérico concreto antes de reportarlo.

**Resultado**: 2 divergencias del port confirmadas, 1 inconsistencia interna de la
spec y 1 nota menor. El resto coincide (ver la lista al final).

### RV-01 · `~=` / `!~=` comparan en `Single`; el original compara en `Double` — CONFIRMADO

- **Fuente** (`DNA.bas:758-784`): `a`, `b` y `d` son `Long`, y `c` es `Single`.
  `a - c` y `a + c` son `Long ± Single`, que por la regla de los operadores
  aritméticos de VB6 da **`Double`**. La comparación con `b` (`Long`) se hace
  también en `Double`.
- **Port** (`dnaops.hpp:318-338`): convierte `a` y `b` a `vb_single` antes de
  operar, así que pierde precisión por encima de 2²⁴.
- **Contraejemplo**: `16777217 16777216 0 ~=` da **False** en el original (con
  `c = 0` la comparación es igualdad exacta) y **True** en el port. `!~=` da lo
  contrario.
- **Alcanzable**: sí. Con `mult` desde literales se llega a ±2·10⁹.
- **Origen**: error del port. La spec (`20-VM.md:450`, `opcodes.yaml:86`) no fija
  el tipo de la comparación.
- **Arreglo propuesto**: `c` sigue siendo `Single`, pero se compara
  `double(a) - double(c) <= double(b)` (y lo mismo con la suma). `cequa`/`cdiff`
  están bien: allí `a` y `b` se declaran `Single`.
- **Test**: RV-01.

### RV-02 · `Random` calcula siempre en `double`; el original depende del subtipo `Variant` — CONFIRMADO, sistémico

- **Fuente** (`Common.bas:53-56`): `Random(low, hi)` tiene parámetros sin tipo
  (`Variant`). La expresión `(hi - low + 1) * rndy + low` toma el tipo de lo que
  llega:
  - `Integer × Single` → **`Single`**; después `+ low` → `Single` y `Int` de un
    `Single`.
  - `Long × Single` → `Double`.
  - Si `hi - low + 1` desborda `Integer`, el `Variant` pasa a `Long` y el
    resultado va por `Double` (p. ej. `Random(-32000, 32000)`).
- **Port** (`common.hpp:97-103`): `Random(double, double)` calcula siempre en
  `double`. La cantidad de extracciones de RNG es la misma; lo que cambia es el
  valor devuelto.
- **Contraejemplo**: `rndy = 855638/2²⁴`.
  - `Random(1, 1000)`: el original devuelve **52** (`Single(1000·r) + 1`) y el
    port **51**.
  - `rndstore` sobre `mem = 999`: el original deja **51** y el port **50**.
- **Frecuencia** (barrido de los 2²⁴ estados del LCG): 2,0·10⁻⁵ por llamada con
  `k = 1000`, y 6,4·10⁻⁴ con `k = 32001` (el `rndstore` de valores altos). Es poco
  por llamada, pero hay muchas llamadas por tick: dos simulaciones con la misma
  semilla acaban separándose.
- **Sitios afectados** (llamadas vivas con los dos argumentos `Integer`, que van
  por la ruta `Single`):
  - `DNA.bas:1098` (`rndstore`).
  - `Robots.bas:992` y `:2129`, `:2456`.
  - `Shots.bas:130`, `:146`, `:807`, `:852`, `:1106`, `:1194` (`genenum`).
  - `Ties.bas:399`, `:467`, `:605`, `:898`.
  - `NeoMutations.bas:558`, `:703`, `:775`, `:981-987`.
  - `Globals.bas:330`, `:411` (`SpeciesNum`).
  - `Obstacles.bas:316` (`numObstacles`) y `:358/361` (`shapeDriftRate`,
    `Integer` en `SimOptions.bas:177`).
  - `Module1.bas:34`, `:41-43`, y los de host (`MDIForm1`, `grafico`, `provvisorio`).
- **Sitios que siguen por `Double`** (`Long`/`Single`/`Double` en algún
  argumento, o desborde a `Long`): `DNA.bas:277` (`rnd`), `Robots.bas:994` y
  `main.frm:1556` (`±32000`), `HDRoutines.bas:209-210`, `Vegs.bas:32`,
  `Teleport.bas:73-74`, `Obstacles.bas:53/69`, `Globals.bas:323/327/328`,
  `main.frm:1537-1538`, `NeoMutations.bas:283/359` (`UBound`) y `:751`
  (`Max As Long`).
- **Por clasificar**: `OptionsForm.frm:3352` (`half`, host).
- **Frecuencia por sitio**: número de estados del LCG (de 2²⁴) en que el valor
  devuelto difiere, contando también el redondeo de `+ low`:

  | Llamada | Estados | Por llamada | Dónde |
  |---|---|---|---|
  | `Random(0, 1)` | 0 | — | colores |
  | `Random(0, 20)` | 0 | — | tipo en `ChangeDNA` |
  | `Random(1, 2)` | 1 | 6·10⁻⁸ | `Globals.bas:330` |
  | `Random(-2, 2)` | 1 | 6·10⁻⁸ | `Shots.bas:130` |
  | `Random(1, 3)` | 2 | 1,2·10⁻⁷ | `mutatecolors` |
  | `Random(0, 9)` | 2 | 1,2·10⁻⁷ | `Robots.bas:2456` |
  | `Random(0, 10)` | 4 | 2,4·10⁻⁷ | `DeltaMut`, `Robots.bas:2129` |
  | `Random(2, 92)` | 12 | 7,2·10⁻⁷ | `Ties.bas:898` |
  | `Random(-20, 20)` | 16 | 9,5·10⁻⁷ | `Shots.bas:146` |
  | `Random(0, 99)` | 37 | 2,2·10⁻⁶ | `ChangeDNA` (cada token mutado) |
  | `Random(1, 1000)` | 339 | 2,0·10⁻⁵ | `Vloc`/`Ploc`, `Robots.bas:992` |
  | `Random(1, 1256)` | 468 | 2,8·10⁻⁵ | `Shots.bas:1106` |
  | `rndstore` con `mem = 32000` | 10792 | 6,4·10⁻⁴ | `DNA.bas:1098` |

- **Origen**: la spec lo afirmó mal (`20-VM.md:377` y `70-CASOS-DORADOS.md:96`:
  "`Random` opera en `Variant/Double`") y el port la siguió.
- **Arreglo propuesto**: una variante `RandomI(vb_integer low, vb_integer hi)`
  que calcule `float(hi-low+1) * r + float(low)` en `float`, con el paso a la
  ruta `Double` si `hi-low+1` no cabe en `Integer`. Después, clasificar cada
  llamador por el tipo de sus argumentos.
- **Tests**: RV-02 y RV-02b.

### RV-03 · La spec se contradice sobre `Single + Single` — DECIDIDO: se queda como está (N-06)

> **Decisión del usuario (2026-09-24)**: se mantiene N-06 y el port no cambia
> (`add`/`sub` suman en precisión extendida y redondean al asignar a `c`). Queda
> como excepción documentada a la regla "binary32 por operación" de Q07.
>
> **Evidencia a favor, encontrada en el piloto 2** (`NeoMutations.bas:537-539`):
> la lectura "precisión extendida dentro de la expresión" es la única compatible
> con el propio fuente.
>
> - **Qué pasaría con la otra lectura**: si `1 - 1 / (1000 * mutation_rate)` se
>   redondeara a `Single` en cada operación, con `1000·rate > 2²⁴` (una tasa
>   mayor que unas 16.777, lo normal con `NormMut`) el argumento sería
>   exactamente 1, `Log(1) = 0` y la división lanzaría el error 11 en cada
>   llamada.
> - **Qué confirma el parche de Botsareus**: el "overflow fix" (`While result >
>   1800000000`, 3/15/2013) no podría activarse nunca con `Single`, porque el
>   máximo sería `16,6 / 5,96·10⁻⁸ ≈ 2,8·10⁸`. Solo tiene sentido si el
>   denominador conserva la precisión. Que el autor lo necesitara indica que el
>   EXE calculaba con precisión extendida.
> - **Cuánto importa**: con la tasa por defecto (5000) la diferencia entre las
>   dos lecturas es de un **12 % en la frecuencia de las mutaciones puntuales**,
>   no de 1 ulp. La decisión tomada es la que casa con esta evidencia.
>
> RV-01 y RV-02 **no dependen** de esta decisión. En RV-01 la regla de tipos da
> `Double` o superior. En RV-02 la aritmética `Variant` pasa por el runtime
> (`VarMul`/`VarAdd`), que guarda el resultado `VT_R4` en memoria como `Single`
> de verdad.


- **Fuente** (`DNA.bas:221-233`): `a` y `b` son `Single` y `c` es `Double`, y el
  código hace `c = a + b`. Por las reglas de VB6 la expresión es `Single`.
- **La spec dice dos cosas distintas**:
  - N-06 (`70-CASOS-DORADOS.md:291`, "`16777216 1 add` → `16777217`") exige
    sumar con más precisión que `Single`: es la lectura "x87 extendido dentro de
    la expresión, redondeo solo al asignar" de `00-INVENTARIO.md:66-70`.
  - La decisión de Q07 (`OPEN_QUESTIONS.md:21`) fija "IEEE 754 binary32
    estricto **por operación**, promociones a `double` solo donde el fuente las
    tiene". Aplicada aquí, daría `16777216`.
- **Port**: sigue N-06 (`dnaops.hpp:57`, suma en `double`).
- **Qué dice la documentación de MS**: la ayuda de *Allow Unrounded Floating
  Point Operations* dice que, con la opción desmarcada (`UnroundedFP=0`), "los
  cálculos de coma flotante se redondean a la precisión correcta (`Single` o
  `Double`)". Eso apunta a `16777216`, pero sin el binario no se puede comprobar
  (Q09).
- **Afecta** a `add` y `sub` con sumas de magnitud mayor que 2²⁴.
- **Qué hay que decidir**: qué lectura manda. Después se alinea N-06 o Q07 y se
  documenta. No lleva test hasta decidirlo.

### Nota menor (sin acción)

- **`finddist`** (`DNA.bas:406-407`): `PopIntStack * Form1.yDivisor` es
  `Long × Single`, que da `Double`, redondeado una vez a `Single`. El port
  redondea el `Long` a `float` antes de multiplicar. Solo difiere con divisor
  distinto de 1 (campo mayor que 32000) **y** argumento mayor que 2²⁴: en la
  práctica no se alcanza.

### Verificado sin divergencias

- **Bucle de `ExecuteDNA`**: condición de salida (`end`, `a <= 32000`,
  `a < UBound`), qué tipos de token se ejecutan según el flujo, escritura de
  `thisgene` en cada token de flujo, `condnum`, y la puesta a cero de los stacks y
  de `dbgstring`.
- **Flujo** (`cond`/`start`/`else`/`stop`, `AddupCond`, `CondStateIsTrue`),
  incluido el bug del `else` canónico.
- **Costes**: qué opcode cobra, cuánto y con qué divisor (`/5`, `/7`, `/8`,
  `/10`), la exención de `debugint`/`debugbool` y el cobro de los opcodes fuera de
  rango.
- **Básicos**: `add`/`sub` (salvo RV-03), `mult`, `div` con redondeo bancario,
  `mod`, `rnd`, `*`, `sgn`, `abs`, `dup` sin guarda, `drop`/`clear`/`swap`/`over`.
- **Avanzados**: `findang`, `ceil` en `Single` frente a `floor` en `Long`,
  `sqr`, `sin`/`cos`, `pow`, `root`, `logx`, `pyth`, `anglecmp` y
  `debugint`/`debugbool`.
- **Bitwise**: los 9 operadores, con el patrón `0x80000000` que decodifica a 0.
- **Condiciones**: orden de los pops y `cequa`/`cdiff` en `Single`.
- **Lógicos**: centinela −5; `and`/`or`/`xor` con la pila vacía (`or` → True y
  `xor` → `Not b`).
- **Stores**: los 14, con el momento de cada pop (dentro o fuera del `If`),
  `mod32000`, los flags de `TieAng`/`TieLenOverwrite` solo en los stores de dos
  operandos y `divstore` sin `mod32000`.
- **Pilas**: desplazamiento al llenarse, pop sobre vacío, y la asimetría
  `dupint`/`dupbool`/`over`.
- **`ExecRobs`**: el filtro (`exist`, no `Corpse`, no `DisableDNA`, no `Base`
  oculto) y el filtro de `ga()`.

## Piloto 2 — Mutaciones (2026-09-24)

**Alcance**: `NeoMutations.bas` completo (`mutate` con la rama Delta2 y la
auto-especiación, los 11 operadores, `ChangeDNA`/`ChangeDNA2`, las agendas de
Point/Point2, los suelos anti-freeze y `mutatecolors`) y sus helpers
`MakeSpace`/`Delete` (`NeoMutations.bas:62-106`), `DnaLen`
(`Module1.bas:64-73`) y `Parse` en modo detokenizar (`DNATokenizing.bas:241`),
frente a `mutations.hpp`, `dna.hpp` y `bot.hpp::SetDefaultLengths`.

**Resultado**: **ninguna divergencia nueva**. Lo único que afecta a las
mutaciones es RV-02 (`Random(0, 99)` en cada token, `Random(0, 10)` en
`DeltaMut` y `Random(1, 3)` en los colores; ver la tabla). Además aparece la
evidencia a favor de RV-03 ya anotada.

**Verificado sin divergencias**:

- **Tipos de campo**: `mutarray`/`Mean`/`StdDev` son `Single`, `PointWhatToChange`
  es `Integer`, `LastMut`/`Mutations`/`PointMutCycle`/`PointMutBP` son `Long` y
  `GenMut` es `Single`. `DeltaMainChance`/`DeltaWTC` son `Byte`; sus umbrales
  `/100` quedan cubiertos por la decisión de RV-03.
- **Orden y número de extracciones de RNG** en los 11 operadores, incluidas la
  moneda de `ChangeDNA2` que se consume siempre (el `And` sin cortocircuito), el
  `Choose` y los bucles de reintento.
- **Límites de los `For`** capturados una sola vez mientras el ADN crece o
  encoge: `CopyError`, `Insertion`, `Reversal`, las deleciones y
  `Translocation` (sobre `UBound`).
- **`Amplification`**: arranca con `t = 2` (B-34) y su `GoTo skip` salta a la
  condición del `Loop Until`.
- **Camino de error** de `Amplification`/`Translocation`: sin re-estampar el
  `end`, y el recálculo de `DnaLen` solo en `Amplification`.
- **`ChangeDNA`**: `value And (Mtype = InsertionUP)` (la precedencia deja un
  `And` bit a bit sobre −1), la escala `Gauss(old/10)` y el failsafe
  `Max <= 1`, que deja el `value` del sondeo. `Parse` en modo detokenizar no
  modifica `bp`.
- **`Delete`/`MakeSpace`**: condiciones de rechazo, `EraseUnit (-1,-1)` y el
  `ReDim` a `DnaLen`. La mutación se cuenta aunque `Delete` rechace.
- **`mutate`**: `Delta` se calcula antes de los topes a 32000, `GenMut`, el
  des-anidado del nick `(k)Nombre` y el gate `SpeciesNum < 49`.
- **`SetDefaultLengths`**: los 22 valores.

**Fuera de alcance, anotado para después**: `AddSpecieFromFile`
(`formats.hpp:987`) fija `mutarray = 5000` suponiendo `NormMut = False`, y es
coherente: `sim.NormMut` solo se pone a `true` en un test (`test_gamemodes.cpp:479`);
ni el host ni la carga lo activan. La consecuencia es un **hueco de
funcionalidad**, no una divergencia: el original ofrece `NormMut` en la UI de
mutaciones (valores de fábrica en `HDRoutines.bas:879-881`) y el port no lo
expone. Si se expone, habrá que portar también la rama `NormMut` de
`SetDefaultMutationRates`.

## Piloto 3 — Tokenizador (2026-09-24)

**Alcance**: `DNATokenizing.bas` completo: `LoadDNA`, `Parse` en los dos modos,
`SysvarTok`/`SysvarDetok`, las 16 tablas `*Tok`/`*Detok`, `getvals`, `Hash`,
`SaveRobHeader`, `DetokenizeDNA`, `TipoDetok`, `calc_dnamatrix`/`DNAtoInt`, y
las tres tablas de `LoadSysVars` (`sysvar`, `sysvarIN` y `sysvarOUT`). También
`insertvar` y `RobScriptLoad`/`preparerob` (`Module1.bas:8-55, 114-125`).
Frente a `loader.hpp`, `sysvars.hpp`, `formats.hpp:120-330` y
`mutations.hpp:37-93`.

**Resultado**: 1 divergencia de tolerancia, que conviene documentar como
decisión. Nada más.

### RV-04 · El cargador acepta finales de línea LF; `Line Input` de VB6 no — DECIDIDO: mantener y documentar

> **Decisión del usuario (2026-09-25)**: se mantiene la tolerancia LF como decisión
> de port, documentada en `20-VM.md §2.2`. Sin test y sin cambio en el port.


- **Fuente** (`DNATokenizing.bas:87`): `Line Input #1` termina la línea **solo
  en CR o CRLF**; un LF suelto no corta (documentación de MS de `Line Input #`).
  Un archivo solo-LF llegaba al original como **una única línea**:
  - si empieza por `'`, todo el archivo se trata como comentario y el ADN queda
    vacío;
  - si no, el corte de comentario (`:92-93`) se come todo lo que sigue al
    primer `'`.
- **Port** (`loader.hpp:354-359`): corta en `\n` y quita el `\r` final, así que
  acepta LF y CRLF por igual. Además, un CR suelto (fin de línea del Mac
  clásico), que VB6 sí corta, no lo corta.
- **Por qué importa**: **los 588 bots de `port/web/bots/` son solo-LF**. En el
  original no cargarían como están; en el port cargan bien. Es una divergencia
  a favor de la usabilidad, sin efecto con archivos CRLF, que es lo que
  producía el ecosistema original.
- **Recomendación**: mantener la tolerancia y documentarla como decisión de port
  en `20-VM.md §2`. Opcional: cortar también en un CR suelto para igualar el
  caso que VB6 sí aceptaba.
- Sin test (decisión de port).

**Verificado sin divergencias**:

- **Tablas de sysvars**, comparadas por script entrada a entrada (índice,
  nombre y valor) contra `DNATokenizing.bas:862-3167`: `sysvar` 255/255,
  `sysvarIN` 164/164 y `sysvarOUT` 98/98.
- **Las 16 tablas de tokens**: nombres, alias (`dupint`, `dropint`…), el
  `debugint`/`debugbool` bajo `ismutating` y el orden del encadenado de
  `Parse`.
- **`LoadDNA`**: corte de comentario solo si el `'` no está en la columna 1, tabs
  convertidos en espacios, `Trim` solo de espacios, `def` sensible a mayúsculas
  (`defensa` define), partición de palabras, `end` final, la corrección del
  cero inicial con `useref` (A2-2, con la precedencia `Not (x = 9)`) y el
  rechazo del archivo entero por los errores 5, 6 y 9.
- **`SysvarTok`**: la última coincidencia gana, sysvars sin distinguir
  mayúsculas y privadas distinguiéndolas, y `Val` con el error 6.
- **`SysvarDetok`**: el recorrido hasta `value = 0`, `savingtofile` y el
  `robn > 0 And n <> 0`. Las mutaciones llaman a `Parse` sin `n`, así que no
  resuelven privadas: el port pasa `nullptr`, como corresponde.
- **`getvals`/`Hash`**: los metadatos con `On Error GoTo skip`, el `tag` de 45
  caracteres en un `String * 50` y `Hash` mutando el `hold` del llamador
  (`ByRef`).
- **`DetokenizeDNA`**: los comentarios de gen, byte a byte.
- **Estado de un slot reutilizado**: `posto` hace `rob(posto) = blank`, así que
  no quedan `vars` rancias de un ocupante anterior. El port reinicia `vars` al
  cargar: equivalente.
- **Curiosidad sin efecto**: 9 bots del bestiario usan `‘` (U+2018) como si
  fuera un comentario. Ni el original (byte `0x91` en cp1252) ni el port lo
  tratan como `'`: los dos tokenizan esas palabras como números 0.

**Nota menor, fuera del núcleo**: el modo evo carga `Test.txt`/`Mutate.txt`
sobre `rob(0)` (`Evo.bas:82, 193, 235, 294`) solo para medir `DnaLen`. En el
original, `rob(0).vnum` nunca se reinicia (`preparerob` no corre para el slot 0),
así que los `def` se acumulan entre cargas y tras unos 1000 acumulados
`insertvar` lanza el error 9: `LoadDNA` falla y la longitud medida pasa a 0.
Solo importa en carreras evo muy largas con bots llenos de `def`. Hay que
comprobarlo si se porta esa parte de `Evo.bas`.

## Piloto 4 — Física (2026-09-25)

**Alcance**: `Physics.bas` completo en lo vivo (`NetForces`, `CalcMass`, `AddedMass`,
`FrictionForces`, `BrownianForces`, `SphereDragForces`, `SphereCd`,
`GravityForces`, `VoluntaryForces`, `TieHooke`, `CheckRobot`, `TieTorque`,
`bordercolls`, `Repel3`, `angle`/`angnorm`/`AngDiff`) y los vectores de
`Common.bas:106-206`, más lo que `physics.hpp` porta de otros módulos:
`UpdatePosition`/`SetAimFunc`/`iceil` (`Robots.bas:774-884`), `ReSpawn`/`ListCells`
(`Multibots.bas:9-114`), `BucketsCollision` (`Quads.bas:223-271`) y el movimiento y
las colisiones de las formas (`Obstacles.bas:152-153, 322-553`). Frente a
`physics.hpp`, `common.hpp`, `ties.hpp:225-370` y `buckets.hpp`.

**Regla que decide casi todo aquí**: en VB6, `Sqr`/`Sin`/`Cos`/`Atn`/`Log` y `^`
devuelven `Double`, y un literal con decimales (`0.99`, `0.1`, `1#`) es `Double`
(ya asumido en el proyecto, p. ej. E4). `Single` con `Double` da `Double`, y el
resultado se redondea **una vez** al asignarlo a un `Single`. La spec
(`30-FISICA.md:24`, "Todo es `Single`") habla del estado, pero no de los
intermedios, y el port los hace en `float`. Q07 fija "promociones a `double`
solo donde el fuente las tiene": aquí el fuente las tiene. Estos hallazgos **no
dependen** de RV-03, salvo RV-07.

**Resultado**: 5 divergencias confirmadas (RV-05, RV-06, RV-08, RV-09 y RV-07, esta
condicionada a la lectura de RV-03), 1 hueco de funcionalidad y 2 notas menores.

### RV-05 · Se pierden las promociones a `Double` de intrínsecas y literales — CORREGIDO en física (rama `rv-05-06-promociones-double`)

> **Arreglo (2026-09-25, decisión del usuario: corregir ya)**: los diez sitios de
> la tabla calculan en `double` con el literal `double` y redondean una vez.
> `DriftObstacles` pasa por `DriftStep`, que reproduce el `VarMul` R4 de
> `Random(..) * Rndy` (o R8 si `2·rate+1` desborda `Integer`). Los umbrales
> `0.00001` de `VectorMagnitude` y `SphereCd` y `0.0001` de `Repel3` comparan en
> `double`. Tests RV-05, RV-05b, RV-05c (`Repel3`) y RV-05d (formas), sin
> `should_fail`. Mutation-check hecho: con el `physics.hpp` anterior, RV-05c y
> RV-05d fallan. Los 126 literales de fuera de física siguen pendientes de
> clasificar en sus pilotos.

- **Qué pasa**: donde el original multiplica un `Single` por un `Double` y
  redondea una sola vez, el port redondea antes el `Double` a `float` y opera en
  `float` (doble redondeo). La diferencia es de 1 ulp, pero ocurre en una
  fracción grande de las llamadas y en rutinas que corren para cada bot en cada
  ciclo.
- **Sitios y frecuencia** (fracción de entradas con resultado distinto, medida
  sobre muestras de 10⁶-10⁷ valores típicos):

  | Fuente | Port | Expresión | Difiere |
  |---|---|---|---|
  | `Common.bas:155` | `common.hpp:48-55` | `maxVal * Sqr(1 + q ^ 2)` (`VectorMagnitude`, y con ella `VectorUnit`/`VectorInvMagnitude`) | **31 %** |
  | `Physics.bas:916,924` | `physics.hpp:376,380` | `Dot(vel, unit) * 0.99` (`Repel3`) | 11,5 % |
  | `Physics.bas:150` | `physics.hpp:126` | `mag * 0.99` (arrastre) | 11,5 % |
  | `Physics.bas:933-934` | `physics.hpp:384,389` | `(e + 1#) * M` (`Repel3`) | 0-55 % según `e` (0 con `e` = 0, 0,5, 0,6 o 0,9) |
  | `Physics.bas:116` | `physics.hpp:52-54` | `Cos(ang) * Impulse`, `Sin(ang) * Impulse` (browniano) | 23 % |
  | `Physics.bas:117` | `physics.hpp:56` | `ma + (Impulse / 100) * (rndy - 0.5)` | 2,3 % |
  | `Physics.bas:686` | `ties.hpp:326` | `m = mm * 0.1` (`TieTorque`) | 20 % |
  | `Physics.bas:690-691` | `ties.hpp:333-339` | `-Sin(anl) * m * dist / 10` y el `Cos` | 40 % |
  | `Obstacles.bas:152-153, 334-344` | `physics.hpp:612-613, 661-673` | `shapeDriftRate * 0.1` y `* 0.01` | 20 % y 27 % de las tasas enteras 1-1000 (la primera: 5) |
  | `Obstacles.bas:359,362` | `physics.hpp:629-638` | `vel + Random(..) * Rndy * 0.01`: `Random(..) * Rndy` es un `Variant` `Single` (VarMul R4); el port lo hace en `double` | 12,7 % |

- **Contraejemplos**:
  - `VectorMagnitude(23.5094757, -8.68048954)`: el original da **25.0608521** y el
    port **25.060854**.
  - Browniano con `PhysBrown = 7` y `rndy` = 8000000/2²⁴, 3000000/2²⁴: la `x`
    del impulso da **0.721829653** en el original y **0.721829593** en el port.
  - `Repel3` con `Dot = 14.9415531`: la proyección da 14.7921371 frente a
    14.7921381.
- **Alcance**: la física del port se separa de la del original desde el primer
  ciclo con movimiento. Q07 ya daba por perdida la igualdad bit a bit por la
  precisión x87, y los dorados de física van con tolerancia, pero esto no es x87:
  es la regla de tipos, y la propia decisión de Q07 la exige.
- **Fuera de física**: el núcleo tiene 126 literales `float` que no son exactos en
  `Single` (robots 19, shots 21, ties 28, senses 23, physics 28…). No todos
  divergen. Cada uno cae en uno de tres casos:
  - `Const … As Single`: correcto.
  - Umbral de comparación: solo difiere en `x = float(L)`; ver la nota.
  - Factor dentro de un producto: divergencia frecuente, como las de la tabla.

  Se clasificarán en los pilotos de disparos, ties, reproducción y visión.
- **Arreglo propuesto**: evaluar esas expresiones en `double` con el literal
  `double` y redondear una vez al asignar. `VectorMagnitude` primero: es la de
  más peso.
- **Tests**: RV-05 y RV-05b.

### RV-06 · `SimOpts.Density` y `Viscosity` son `Double` en el original y `float` en el port — CORREGIDO (rama `rv-05-06-promociones-double`)

> **Arreglo (2026-09-25)**: `vb_double` en `sim.hpp`, lectura y escritura del
> `.set` sin estrechar (`formats.hpp`), `db_sim_set_opt` ids 14/15 sin pasar por
> `float` (`dbcore_api.cpp`), y `AddedMass`, `Reynolds`, el drenaje de `ma` y su
> umbral `< 0.000001` en `double`. Test RV-06 sin `should_fail`.

- **Fuente**: `SimOptions.bas:134-135` (`As Double`). Los presets de
  `OptionsForm.frm:4409-4416` son `Density = 0.0000001` y `Viscosity` = 0.01,
  0.0005 o 0.000025. Ninguno es exacto en `Single`: `float(1e-7)` =
  1.0000000117·10⁻⁷.
- **Port**: `sim.hpp:93` los declara `vb_single`, y `formats.hpp:1706-1707` los
  estrecha al leerlos del archivo, que los guarda como `Double`. Con ello toda
  expresión que los usa pasa de `Double` a `float`:
  - `AddedMass` (`Physics.bas:67`, `physics.hpp:68-69`): difiere en el 34 %.
  - `Reynolds` (`:316`, `physics.hpp:78-79`): del 42 al 45 % según el preset.
  - El drenaje de `ma` `ma * (1# - Density * 1000000)` (`:134`,
    `physics.hpp:113`): 31 %.
  - El impulso de arrastre (`:147-148`).
- **Contraejemplo**: `AddedMass` con el preset de `Density` y `radius =
  39.2897873` da **0.0127027463** en el original y **0.0127027472** en el port.
- **Origen**: error del port; la spec no fija el tipo.
- **Arreglo propuesto**: `vb_double` para los dos campos, lectura sin estrechar y
  las cuatro expresiones en `double`.
- **Test**: RV-06.

### RV-07 · `SetAimFunc`: `Round(.aim * 200, 0)` redondea un `Single` y `CInt(.aim * 200)` no — CONFIRMADO bajo la lectura adoptada en RV-03

> **Decisión del usuario (2026-09-25)**: queda como divergencia confirmada,
> condicionada a la lectura N-06 de RV-03. El test RV-07 se mantiene.

- **Fuente** (`Robots.bas:781` frente a `:819`): el primer argumento de `Round`
  es `Variant`, así que `.aim * 200` se guarda como un `Single` de verdad
  (`VT_R4`). `CInt(.aim * 200)` se evalúa dentro de la expresión, sin redondear
  a `Single` (lectura N-06 de RV-03). Si el producto exacto cae justo por encima
  o por debajo de un `.5` y el `Single` redondea a `x.5`, los dos resultados
  difieren. Entonces el ciclo siguiente ve `mem(SetAim) <> Round(...)`, entra en
  la rama "el ADN escribió `.setaim`" y gira hasta el valor de `CInt`.
- **Port** (`physics.hpp:275-276, 326`): calcula los dos en `double`, así que
  nunca difieren.
- **Contraejemplo**: con `aim = 3.75250006` y `ma = 0`, `Single(aim·200)` =
  750.5, que `Round` lleva a **750** (bancario), y `CInt(750.500011)` = **751**.
  El original deja `aim` = 751/200 = **3.755**; el port, **3.75**. En la rama
  `setaim` además cambian `diff`, el coste de giro y el ajuste de `ma`.
- **Frecuencia**: 2,9·10⁻⁵ por llamada con `aim` arbitrario. Solo se da con
  `ma ≠ 0` (browniano o `TieTorque`): con `ma = 0`, `aim` es k/200 y el producto
  es casi entero. Con el browniano activo y 100 bots, ocurre una vez cada ~340
  ciclos.
- **Depende de RV-03**: con la lectura "binary32 por operación", `CInt` también
  vería el `Single` y no habría divergencia. Con la decidida (N-06), sí la hay.
- **Mismo patrón, más raro**: `Round((.aim * 200 - .mem(SetAim)) / 1256, 0)`
  (`:788`, `physics.hpp:283-288`).
- **Arreglo propuesto**: comparar con `vb_round64(float(aim * 200.0f))`,
  conservando `vb_cint(double)` en `:819`.
- **Test**: RV-07.

### RV-08 · `SetAimFunc`: el coste de giro va en `Single` (`Variant`) y el port lo hace en `double` — CONFIRMADO, solo con `TURNCOST ≠ 0`

> **Decisión del usuario (2026-09-25)**: queda como divergencia confirmada,
> dependiente de que `Round` conserve el subtipo `Single` y limitada a
> `TURNCOST ≠ 0`. El test RV-08 se mantiene.

- **Fuente** (`Robots.bas:792`): `Round(x, 3)` devuelve un `Variant` del subtipo de
  su argumento (`Single`). Los dos productos por `Costs(...)` son aritmética
  `Variant` (VarMul R4 × R4 → R4): se redondea a `Single` en cada paso, como en
  RV-02.
- **Port** (`physics.hpp:292-298`): `turn` y los productos en `double`, con un
  redondeo final.
- **Contraejemplo**: con `diff = 9`, `TURNCOST = 0.001`, `COSTMULTIPLIER = 1` y
  `nrg = 0`, el original deja `nrg` = **−4.50000043·10⁻⁵** y el port
  **−4.50000007·10⁻⁵**. Difiere en el 25-27 % de los giros con `TURNCOST` =
  0.001-0.1.
- **Alcance**: `TURNCOST` vale 0 por defecto (`CostsForm.frm:1115`), así que
  solo cuenta con costes de giro configurados.
- **Supuesto**: que `Round` conserve el subtipo `Single` de su argumento. Si
  devolviera un `Variant` `Double`, toda la cadena iría en `Double` y el port
  coincidiría.
- **Test**: RV-08.

### RV-09 · `ReSpawn`: `Min` es `Single` y puede cambiar la célula elegida — CONFIRMADO, raro

- **Fuente** (`Multibots.bas:11, 17-19`): `Dim Min As Single`. La distancia al
  cuadrado (`Double`, por el `^`) se compara con un `Min` ya redondeado a `Single`,
  y el `<=` deja pasar a una célula algo más lejana que la anterior si cae dentro
  de ese redondeo. El original elige entonces la **última** de las empatadas.
- **Port** (`physics.hpp:446-456`): `Minv` es `double`.
- **Contraejemplo**: con el destino en (0, 0) y las células en (5000, 1.8) y
  (5000, 2), las distancias al cuadrado son 25000003.24 y 25000004, y
  `Single(25000003.24)` = 25000004.
  - El original elige la segunda y el organismo baja 1 en `y` (la primera
    célula queda en `y` = 0.8).
  - El port elige la primera y el organismo baja 0.8 (queda en `y` = 1.0).
- **Alcance**: solo organismos multibot en campo toroidal y solo con
  distancias casi empatadas por encima de 2²⁴ (a unas 4100 unidades del destino).
- **Test**: RV-09.

### Hueco de funcionalidad (sin acción)

- **`PlanetEaters`** (`Physics.bas:575-604`): el port no la implementa
  (`physics.hpp:202`, "capa F1 ⚙: fuera"), pero carga la opción de los archivos de
  ajustes (`formats.hpp:1704-1705`). Un `.set` con `PlanetEaters = True` se ignora
  en silencio. Es el mismo caso que `NormMut` en el piloto 2. Si se porta, ojo: el
  `IIf` es `Variant` (`Single` o `Integer`) y `1 / mag` es `Single`.

### Notas menores (sin acción)

- **Umbrales `Double` comparados con un `Single`** (los de física ya se
  corrigieron junto con RV-05/RV-06): `x < 0.00001`
  (`VectorMagnitude`), `< 0.0001` (`Repel3`) y `< 0.000001`. El port compara con el
  literal `float`, que es algo **menor** que el `Double`. Solo difiere en
  `x = float(L)` exacto: el original da True y el port False. Con `0.0000001`
  (`float` mayor que el `Double`) no hay diferencia. En la práctica no se alcanza.
- **`FieldWidth`/`FieldHeight` son `Long`** (`SimOptions.bas:67-68`) y el port los
  guarda en `float` (`sim.hpp:91`). Los valores son exactos, pero `FieldWidth -
  .radius` es `Long - Single`, es decir `Double`, y el port lo redondea a
  `float`:
  - **`bordercolls`** (`Physics.bas:792`, `physics.hpp:488-489`): si un bot queda
    fijado por el clamp de `:814` en `CSng(FW) - radius` y ese valor redondeó hacia
    abajo (p. ej. `FW = 16000`, `radius = 23.2333889`), el original lo ve dentro y
    sale, y el port lo trata como borde y suma `vel·0.05` a `ImpulseRes`, que sí
    se usa (`Robots.bas:1558`). Hace falta además que `vel` sea tan pequeña que
    `pos` no cambie.
  - **`GravityForces`** (`:401`): `pos.Y / FieldHeight` va en `Double`. Solo
    cambia el resultado en el umbral exacto.

### Verificado sin divergencias

- **Orden de `NetForces`** y el gate de cada fuerza: `Zgravity = 0`,
  `PhysBrown = 0`, `Density = 0` y vel nula.
- **RNG**: las 3 extracciones del browniano, en su orden.
- **Guardas `1e-7`** de `vel`/`ma`.
- **`CalcMass`**: fórmula y clamps.
- **`FrictionForces`** (todo `Single`): el recorte al módulo de `vel` y el drenaje
  de `ma` con `48`.
- **`SphereCd`**: los tramos y las constantes. El port hace en `double` algunos
  intermedios `Single`, lo que cubre la decisión de RV-03.
- **`GravityForces`**: la condición de rama, el `IIf` con tope 192 (aritmética
  `Variant` R4, que es la misma que el `float` por operación) y la decisión de
  port con `PhysMoving = 0`.
- **`VoluntaryForces`**: el gate, el cruce `sx − dx`, el recorte a `MaxVelocity`,
  el clamp `ByRef` de `NewAccel` antes del coste y los topes del coste.
- **Clamps `ByRef` de `VectorScalar`/`VectorMagnitudeSquare`**: en `vel`,
  `ImpulseInd`, `V1`/`V2` y `fixedSepVector`. Los que el port no replica (el `k`
  `ByRef` sobre `SimOpts.MaxVelocity`/`PhysMoving`) solo actuarían por encima de
  32000.
- **`TieHooke`**: la purga con `CheckRobot`, `rob(0)` tras la purga, la rotura a
  1000, el reloj `last`, la zona muerta de 20 y `-kx - bv`.
- **`TieTorque`**: holgura, el `[PROBABLE BUG]` `Sgn(nax)` en `nay`, el slot
  fantasma, y el recorte `PI/4` de `ma`.
- **`Repel3`**: la precedencia `A And B Or C`, las dos ramas de separación,
  `55 ^ (0.3 - e)` en `Double`, los pisos de la proyección, las masas 32000 de los
  fijos y el orden `touch`/`lasttch`/`lookoccurr`.
- **`bordercolls`**: `smudge`, `VectorMin`/`VectorMax`, las ramas toroidal y
  rígida, `CSng(FW) - radius` y `mem(214)`.
- **`UpdatePosition`**: el suelo 0.25, la integración, el recorte, `ZeroMomentum`,
  los `last*` y las `vel*` publicadas (el port ya usa `double` e `iceil` de
  `Single`).
- **`SetAimFunc`** (salvo RV-07 y RV-08): `Mod 1256` bancario, los bucles de `ma`,
  el ajuste de `ma` según el signo de `diff` y `aimvector`.
- **`ListCells`/`ReSpawn`** (salvo RV-09): los topes de 50 y las guardas del port
  frente al error 9, ya documentadas.
- **`BucketsCollision`**: solo los pares `robnumber > n`, el filtro `Base.txt` y
  la parada en `adjBucket.x = -1`.
- **Formas**: `ObstacleCollision`, `DoObstacleCollisions` (el salto
  anti-atrapamiento y las cuatro ramas con `LastPush`), el compactador y el "tope"
  invertido de `DriftObstacles`.

## Piloto 5 — Disparos (2026-09-25)

**Alcance**: `Shots.bas` completo en lo vivo (`newshot`, `createshot`, `FirstSlot`,
`updateshots`, `CompactShots`, `Decay`, `defacate`, `releasenrg`, `releasebod`,
`takenrg`, `takeven`, `takewaste`, `takepoison`, `takesperm`, `NewShotCollision`,
`Vshoot`, `MakeVirus`, `copygene`, `addgene`), más `robshoot`
(`Robots.bas:1718-1864`), `absx`/`absy` (`Robots.bas:744-771`) y la
inicialización del array (`main.frm:390-392, 1304-1305`). Frente a `shots.hpp`,
`robots.hpp:92-113` (`Decay`) y `sim.hpp:593-595, 689-708`.

**Dato de tipos que cambia la lectura de RV-02 aquí**: `Random` se declara
`As Long` (`Common.bas:53`). Su cálculo interno es el de RV-02, pero lo que
devuelve es un `Long`, así que `Random(..) / 200` es `Long / Integer`, que da
**`Double`**.

**Resultado**: 8 divergencias confirmadas (RV-10 a RV-17), una de ellas un error de
memoria del propio port (RV-12), y 2 notas menores.

> **Arreglo (2026-09-25, decisión del usuario: corregir todo)**: en la rama
> `rv-05-06-promociones-double` están corregidos RV-10 a RV-17, en `shots.hpp`,
> `sim.hpp` (el array inicial de 50 y `absx`/`absy`) y `robots.hpp` (`Decay` y el
> `TotalSimEnergy` de los bots).
>
> - **Tests**: 20 casos (RV-10 a RV-17, con RV-14e-k y RV-15b añadidos para cada
>   sitio corregido), todos sin `should_fail`.
> - **Mutation-check**: con las tres cabeceras de HEAD fallan los 20 casos (28 de
>   28 aserciones).
> - **Sin test propio**: la mitad de RV-16 de `robots.hpp`, que tiene el mismo
>   patrón que la de disparos.
> - **Test anterior ajustado**: R-06 (`test_rng.cpp`) daba por hecho que el virus
>   pasaba del slot 5 al 1. Eso solo ocurría por la compactación que forzaba el
>   array inicial de 300; con 50, el virus se queda en el slot 5.
> - **Notas menores**: no se tocan.

### RV-10 · `createshot` recibe la posición en `Long` y la velocidad en `Integer` — CORREGIDO

- **Fuente** (`Shots.bas:205-206`): `ByVal X As Long, ByVal Y As Long, ByVal vx
  As Integer, ByVal vy As Integer`. Cada rebote (el −2 de `releasenrg` y de
  `releasebod`, el −5 de poison) nace con la posición y la velocidad
  **redondeadas a entero** (bancario).
- **Port** (`shots.hpp:147-162`): los cuatro parámetros son `vb_single`, sin
  redondear.
- **Contraejemplo**: `createshot(123.7, 456.5, -40.3, 2.5, …)` deja en el
  original `pos = (124, 456)` y `velocity = (-40, 2)`; en el port, los valores sin
  tocar.
- **Alcance**: todo rebote de energía o de poison, es decir, prácticamente
  siempre (la velocidad relativa casi nunca es entera). Cambia la trayectoria del
  rebote y, con ella, a quién golpea.
- **Origen**: la spec (`33-SHOTS.md §2.3`) dice "posición/velocidad explícitas"
  sin el tipo.
- **Test**: RV-10.

### RV-11 · Tamaño del array de disparos: arranca en 300 (no en 50) y trunca en lugar de `CLng` — CORREGIDO

- **Fuente**:
  - Una sim nueva hace `maxshotarray = 50` y `ReDim Shots(50)`
    (`main.frm:390-392` y `:1304-1305`).
  - Al crecer, `CLng(maxshotarray * 1.1)` (`Shots.bas:104`, `:217`); al compactar,
    `CLng(numshots * 1.2)` (`:419`). `CLng` redondea (bancario).
- **Port**:
  - Arranca en 300 (`sim.hpp:593-595`), que sale del código comentado de
    `newshot` (`Shots.bas:96-99`). Como 300 > 100, compacta en el primer ciclo y
    baja a 100; el original se queda en 50.
  - `static_cast<vb_long>` trunca (`shots.hpp:45`, `:153`, `:773`).
- **Contraejemplo**: al crecer desde 50, el original da 55, **61**, 67, 74, 81,
  89 y el port 55, **60**, 66, 72, 79, 86. Al compactar con `numshots = 93`, el
  original da 112 y el port 111 (difiere en 364 de los valores 90-999).
- **Por qué importa**: el tamaño decide dónde se da la vuelta a `shotpointer` y,
  por tanto, en qué slot cae cada disparo. `updateshots` procesa por índice: un
  rebote creado durante la pasada en un slot **mayor** que el actual se procesa
  en ese mismo ciclo, y en uno **menor**, en el siguiente. Cambia además el orden
  de los efectos cuando dos disparos alcanzan al mismo bot, y el orden de las
  extracciones de RNG de `takeven`/`takepoison`/`addgene`.
- **Test**: RV-11.

### RV-11b · Compactar con 0 disparos deja `shotpointer = 0` — CORREGIDO, raro

- **Fuente** (`Shots.bas:421`): `shotpointer = numshots`. Si se compacta con
  `numshots = 0` (array mayor que 100 que se vacía de golpe), el siguiente
  `FirstSlot` devuelve el **slot 0**. `updateshots` y `CompactShots` recorren
  desde 1, así que ese disparo queda congelado para siempre: no se mueve, no
  golpea y no envejece. Si es un virus, `MakeVirus` recibe `virusshot = 0` y
  devuelve `False`. Solo puede pasar una vez por sim: después el slot 0 ya está
  ocupado y `FirstSlot` lo salta.
- **Port** (`shots.hpp:775`): fuerza `shotpointer = 1`. La spec lo da por hecho
  (`33-SHOTS.md §8`, Q03: "`FirstSlot` arranca en `shotpointer ≥ 1`"), y es falso
  en este caso.
- **Test**: RV-11b.

### RV-12 · `createshot` reubica `Shots` bajo una referencia viva — ERROR DEL PORT (memoria), CORREGIDO

- **Qué pasa**: `updateshots` (`shots.hpp:651`) y `releasenrg` (`:264`) guardan
  `Shot& s = sim.Shots[t]` y después llaman a `createshot`. Si el array está lleno,
  `createshot` hace `Shots.resize` (`:154`) y el `std::vector` cambia de sitio.
  Todo lo que sigue (`taste`, `s.flash = true`, `opos`, `pos`, `age` y, en
  `releasenrg`, el `Kills` de `s.parent`) **lee y escribe memoria liberada**.
  Lo mismo pasa en el rebote de poison de los disparos de memoria (`:698-701`).
- **VB6**: `Shots(t)` se vuelve a indexar después del `ReDim Preserve`. El propio
  fuente lo tiene presente (`Shots.bas:584`: "so that no Shots array elements are
  on the stack in case the Shots array gets redimmed").
- **Contraejemplo**: con el array lleno, un −1 alcanza a un bot vivo. El
  original deja el disparo con `flash = True`, `age = 1` y `pos.x` avanzado; en
  el port se quedan `flash = False`, `age = 0` y la posición sin cambiar, porque
  las escrituras se pierden en el bloque liberado. Es comportamiento indefinido:
  hoy no revienta en ninguno de los tres modos, pero podría.
- **Alcance**: cada vez que un rebote hace crecer el array (sims con muchos
  disparos vivos).
- **Arreglo propuesto**: volver a indexar `sim.Shots[t]` después de cada llamada
  que pueda crear un disparo, o reservar capacidad antes de la pasada.
- **Test**: RV-12.

### RV-13 · `Decay`: el port resta `va/10` en vez de `Decay/10`, pone suelo a 0 y no recalcula el radio — CORREGIDO

- **Fuente** (`Shots.bas:485-486`): `body = body - SimOpts.Decay / 10`, sin suelo,
  y `radius = FindRadius(n)`, en cada pulso.
- **Port** (`robots.hpp:112-113`): `body -= va / 10`, recorta a 0 y no toca el
  radio. El comentario dice que "la resta pertenece a B5", pero B5 no la añadió
  (`31-ENERGIA.md:88` remite a `33-SHOTS.md §5`, que sí dice `Decay/10`).
- **Contraejemplo**: con el preset de corpses (`Decay = 75`, `Decaydelay = 3`,
  `DecayType = 3`, `OptionsForm.frm:2775-2777`) y `body = 5`:
  - el original deja `body = -2.5`, y el corpse muere en el siguiente
    `UpdateCounters`;
  - el port deja `body = 4.5`: el corpse decae geométricamente (×0,9 por pulso),
    no muere nunca y sigue emitiendo disparos.
  - El radio se queda en el del último `FindRadius` que hubo, 60 en el test,
    frente a 11,35.
- **Alcance**: toda sim con corpses y `Decay > 0` (la web expone `Decay`, id 51).
- **Test**: RV-13.

### RV-14 · Se pierden las promociones a `Double` en los disparos — CORREGIDO (misma familia que RV-05)

La misma regla de RV-05: un literal con decimales o una intrínseca dan `Double`,
y se redondea una vez al asignar. El port hace cada paso en `float`.

| Fuente | Port | Expresión | Difiere |
|---|---|---|---|
| `Shots.bas:146` | `shots.hpp:85` | `ShAngle + Random(-20, 20) / 200` (`Long / Integer` → `Double`) | 1,8 % de los disparos |
| `Shots.bas:142` | `shots.hpp:82` | `aim - mem(aimshoot) / 200` | 31 % (solo con `aimshoot ≠ 0`) |
| `Shots.bas:345` | `shots.hpp:682-686` | `nrg * Atn(..) / Atn(-40)` (decaimiento en cada impacto) | 36 % |
| `Shots.bas:360-361` | `shots.hpp:700-701` | `(nrg / 2) * 0.9` y `* 0.1` (rebote de poison) | 39 % y 5 % |
| `Shots.bas:560, 565, 575` | `shots.hpp:293, 298, 306` | `power * 0.9`, `power * 0.01` (`releasenrg`) | 31 % y 28 % |
| `Shots.bas:634-635` | `shots.hpp:352-353` | `(body * 10) / 0.8 + shell`: la comparación y la asignación (`releasebod`) | 23 % |
| `Shots.bas:665, 675, 698` | `shots.hpp:378, 386, 403` | `power * 0.2`, `* 0.08`, `leftover * 0.1` | 10-20 % |
| `Shots.bas:738-751` | `shots.hpp:437-449` | `partial * 0.95`, `* 0.004`, `overflow * 0.1`, `* 0.01` (`takenrg`), incluidas las comparaciones con 32000 | 1-37 % |
| `Shots.bas:822` | `shots.hpp:457` | `nrg / (Range * (RobSize / 3)) * value` (`takewaste`; `RobSize / 3` es `Double` y aquí no hay `CSng`) | 26 % |
| `Shots.bas:845` | `shots.hpp:475` | `Poisoncount + power / 1.5` | 2,3 % |
| `Shots.bas:1108-1112` | `shots.hpp:889-892`, `sim.hpp:696-707` | `pos + Cos(a) * radius` y `absx`/`absy` (`Cos(aim) * upTotal`) | 0,6 % y 23 % |
| `Robots.bas:1834` | `shots.hpp:1011` | `Waste - value * 0.99` (`robshoot` −4) | 38 % |

- **Contraejemplos** (los de los tests):
  - `takewaste` con `nrg = 9.76221085`, `Range = 5` y `value = 409`: el original
    da **19.9637203** y el port **19.9637222**.
  - `takenrg` con `nrg = 1000` y `partial = 114.059998`: **1108.35706** frente a
    **1108.35693**.
  - Jitter de `newshot` con `aim = 0.0244212653` y `k = −13`: el ángulo es
    −0.0405787341 en el original y −0.0405787304 en el port.
  - Decaimiento con `nrg = 1342.11816` y `tempnum = 3/7`: difiere en 1 ulp.
- **Fuera de la tabla**: `absx`/`absy` también los usan la reproducción
  (`robots.hpp:658-694, 1202-1293`), que queda para su piloto.
- **Tests**: RV-14 (`takewaste`), RV-14b (`takenrg`), RV-14c (jitter) y RV-14d
  (decaimiento).

### RV-15 · `Vshoot` y `robshoot` reasocian la resta y el producto de costes — CORREGIDO

- **Fuente**:
  - `Vshoot` (`Shots.bas:1100, 1103`) resta de izquierda a derecha:
    `nrg - (tempa / 20#) - coste` (en `Double`) y `nrg - CSng(mem) - coste`.
  - `robshoot` (`Robots.bas:1753, 1761`) multiplica
    `rngmultiplier * Costs(SHOTCOST) * Costs(COSTMULTIPLIER)` de izquierda a
    derecha.
- **Port**:
  - `Vshoot` (`shots.hpp:878-884`) calcula `nrg -= a + coste`: primero redondea la
    suma en `float` y luego resta.
  - `robshoot` (`:913, 932, 940`) precalcula `shotcost = c1 * c2` y hace
    `r * shotcost`.
- **Diferencia**: 5,5 % en `Vshoot`, y **con las dos lecturas de RV-03**. En
  `robshoot`, 17 % de los costes con `COSTMULTIPLIER ≠ 1`; con el valor por
  defecto (1) no hay diferencia.
- **Contraejemplo**: `nrg = 102.160255`, `vshoot = 77` y coste 1.0458796: tras la
  primera línea, el original da 24.1143761 y el port 24.1143723.
- **Test**: RV-15 (`Vshoot`).

### RV-16 · `TotalSimEnergy` redondea el sumando en vez de la suma — CORREGIDO, efecto pequeño

- **Fuente** (`Shots.bas:319`, `Robots.bas:1640`): `TotalSimEnergy` es `Long`
  (`Vegs.bas:11`). `Long + Single` da `Double`, que se redondea **una** vez al
  asignar.
- **Port** (`shots.hpp:662-663`, `robots.hpp:1998-2000`): suma `CLng(x)` al
  acumulado. Con el bancario, la paridad cambia: con `T = 1` y `nrg = 2.5`, el
  original da `CLng(3.5)` = **4** y el port `1 + CLng(2.5)` = **3**.
- **Alcance**: solo con fracción exacta de .5. Alimenta `TotalSimEnergyDisplayed`,
  que decide `SunUp`/`SunDown` (`Vegs.bas:85, 107`): una unidad de diferencia
  solo cuenta en el umbral.
- **Test**: RV-16.

### RV-17 · `(x + 40 + 1) \ 40`: el port redondea `x` antes de sumar — CORREGIDO, raro

- **Fuente** (`Shots.bas:165, 238`): `\` redondea (bancario) el operando **ya
  sumado**.
- **Port** (`shots.hpp:107, 170`): `(vb_round64(x) + 41) / 40`. Como 41 es impar,
  cambia la paridad del bancario cuando `x` acaba en .5 exacto. Con
  `x = 38.5`: el original da `CLng(79.5)` = 80, es decir, **2**; el port
  `CLng(38.5) + 41` = 79, es decir, **1**.
- **Alcance**:
  - En `newshot`: con `vbody = 14.0365772`, `nrg = Log(vbody) * 60` =
    158.5 exacto, y el original da `Range = 5` y `nrg = 200` frente a 4 y 160 en
    el port.
  - Sumando además la cadena `Double` de `Log(..) * 60 * rngmultiplier`
    (`Shots.bas:163`, que es de la familia RV-14), el `Range` difiere en unos 4
    de cada 10⁶ disparos.
- **Test**: RV-17 (`createshot`).

### Notas menores (sin acción)

- **Umbrales `Double`**:
  - `Const MinBotRadius = 0.2` no tiene tipo, así que es `Double`
    (`Shots.bas:48`, frente a `0.2f` en `shots.hpp:503`).
  - `Range < 0.00001` (`Shots.bas:728`, `shots.hpp:432`).
  - Como en la nota del piloto 4, solo difieren si el valor coincide exactamente
    con `float(L)`.
- **`createshot`: `nrg = Range + 40 + 1`**: el port suma en dos pasos `float` y la
  lectura N-06 (RV-03) redondea una sola vez. Solo difiere al cruzar una potencia
  de 2, y para los −2 el valor se pisa con `val`.

### Literales `float` inexactos de `shots.hpp` (21)

- **Factor de un producto** (19), que divergen: todos los de RV-14 (`0.9`,
  `0.01`, `0.8`, `0.2`, `0.08`, `0.1`, `0.95`, `0.004`, `0.99`).
- **Umbral** (2): `0.00001f` (`:432`) y `MinBotRadius = 0.2f` (`:503`), que van en
  las notas.
- **`Const As Single`**: `SlimeEffectiveness = 1 / 20` (`Shots.bas:46`) es
  correcto y no cuenta entre los inexactos, porque el port lo escribe como
  `1.0f / 20.0f`.

### Verificado sin divergencias

- **RNG**: las 2 extracciones de `newshot`, una de ellas muerta; la re-tirada de
  `Vloc`/`Ploc` si sale 340 (es `Random(1, 1000)`, que ya está en RV-02); la
  extracción de `addgene` y la de `Vshoot`. `Random(1, 1256) / 200` coincide
  (división de un entero exacto, un solo redondeo).
- **`newshot`**: el clamp de `val`; `Int(val)`; el plegado `Mod 8` y el −8; `memloc`/`Memval`
  de 835/836; `backshot`/`aimshoot` normalizados en la celda; el `offset`; la
  velocidad `actvel + dir·40`; el virus con `genenum = Int(gene)`; la
  descalificación, y el esperma.
- **`createshot`**: `memloc` 834, `Memval` 839 solo para −5, y `CInt(val)`. El
  `val` `ByRef` recortado a 32000 no llega a notarse en ningún llamador.
- **`FirstSlot`** y la llamada descartada de `releasenrg`.
- **`updateshots`**: el orden (`flash`, contabilidad, colisión, efectos, formas,
  movimiento, edad y muerte); la inmunidad filial rota; el `tempnum` con
  `Range = 0`; las exenciones de `NoShotDecay`/`NoWShotDecay`; `(t - 1) Mod 1000
  + 1` y `DelgeneSys`; el `If t <= maxshotarray`, que nunca salta; y el
  compactador (`virusshot`, huérfanos, `Base.txt` oculto).
- **`NewShotCollision`**: los bordes (toroidal o rígido con `±Abs`), el prefiltro, `pos − vel
  + actvel`, el golpe en t = 0, la cuadrática `DdotP ^ 2 - D2 * (P2 - r ^ 2)` en
  `Double`, las raíces en (0, 1), el "último bot con raíces" como resultado y la
  recolocación.
- **`takeven`/`takepoison`**: la potencia con `CSng` (todo `Single`), el escudo ×25 y
  ÷20, los topes 32000, y `Vloc`/`Ploc` con el remapeo y el 340 → 0.
- **`releasenrg`/`releasebod`** (salvo RV-14): el orden del chequeo de muerte y
  del rebote, `Kills` sin clamp y la cascada de `leftover`.
- **`addgene`**: la potencia en `Single` (aquí `Range * RobSize / 3` es
  `Single * Integer / Integer`); la slime negativa que amplifica (B-19); y el
  `Insert`.
- **`copygene`**, **`takesperm`**, **`MakeVirus`** y **`defacate`**: en
  `defacate`, el `IIf` es `Variant` R4, la misma aritmética que el `float` del
  port.
- **`robshoot`** (salvo RV-14 y RV-15): el `Mod MaxMem`, los multiplicadores, `Log(x / 2) / Log(2)` en
  `Double`, `nrg / 100#`, `venom / 20#` y `Waste / 20#` (una división de `float`
  entre `double` da lo mismo), y el borrado de `shoot`/`shootval`.

## Siguientes pilotos sugeridos

1. **Ties** (`Ties.bas`), **reproducción y energía** (`Robots.bas`, `Vegs.bas`;
   incluye `absx`/`absy` en el nacimiento y la otra mitad de RV-16) y **visión**
   (`Senses.bas`), con el mismo método. En cada uno, clasificar sus literales
   `float` inexactos (ver RV-05).
