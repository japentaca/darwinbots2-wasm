# 00 — Inventario del fuente

> Fase 0 del proceso de extracción. Documento de reconocimiento, **no de especificación**.
> Toda afirmación cita `archivo:línea`. Lo no verificado va marcado.

---

## 1. Identidad y versión

| Dato | Valor | Cita |
|---|---|---|
| Nombre del proyecto | DarwinBots | `Darwinbots2/Iersera.vbp` (`Name="DarwinBots"`) |
| Versión | **2.48.32** | `Iersera.vbp` (`MajorVer=2`, `MinorVer=48`, `RevisionVer=32`) |
| Ejecutable | `Darwin2.48.32.exe` | `Iersera.vbp` (`ExeName32`) |
| Tipo | `Exe` (VB6 nativo) | `Iersera.vbp:1` |
| Punto de entrada | Form `MDIForm1` | `Iersera.vbp` (`Startup="MDIForm1"`) |

Los comentarios fechados más recientes que encontré en el fuente son de **2016**
(`Master.bas:121` "Botsareus 6/12/2016", `Master.bas:91` "Botsareus 1/9/2016",
`Master.bas:306` "4/5/2016"). El desarrollo siguió después de la última versión
documentada en el wiki (~2014). **Esto importa**: cualquier afirmación del wiki sobre
el motor puede describir una versión anterior a este fuente.

### Flags de compilación — hallazgo de primer orden

```
CompilationType=0
OptimizationType=2
FavorPentiumPro(tm)=0
CodeViewDebugInfo=0
NoAliasing=0
BoundsCheck=0
OverflowCheck=0
FlPointCheck=0
FDIVCheck=0
UnroundedFP=0
```
— `Iersera.vbp:92-101`

> **CORRECCIÓN (2026-08-16).** La lectura original de esta sección estaba **invertida**.
> En los `.vbp`, estas claves serializan las casillas de "Advanced Optimizations":
> `0` = casilla **sin marcar** (comportamiento por defecto: chequeos **activos**),
> `−1` = casilla marcada (chequeo eliminado) — True en VB6 es −1, y la doc de Microsoft
> confirma que el defecto es chequear ("By default Visual Basic makes a check on every
> access to an array"; marcar "Remove Array Bounds Checks" es lo que lo elimina)
> `[FUENTE EXTERNA: MS aa716334]`. Coherente con `OptimizationType=2` = "No
> Optimization". La corrección se propagó a todos los documentos afectados; los
> `PROMPT-BLOQUE-*.md` anteriores a la corrección se conservan como registro histórico
> con la premisa vieja.

Consecuencias reales sobre el binario distribuido (`CompilationType=0` = código nativo,
sin optimizar, **con todos los chequeos**):

- **`OverflowCheck=0` (chequeo de overflow ACTIVO)**: el overflow de `Integer`/`Long`
  y las conversiones fuera de rango (`CInt`/`CLng`) lanzan **error 6** también en el
  EXE, igual que en el IDE. El valor **nunca envuelve en silencio** por vía del
  compilador (los envolvimientos explícitos del fuente — `Mod 32000`, la resta
  `Sgn·2·10⁹` de `add`/`sub` — son código y siguen valiendo).
- **`BoundsCheck=0` (chequeo de límites ACTIVO)**: índice fuera de rango lanza
  **error 9** también en el EXE; nunca lee/escribe memoria adyacente. Los chequeos
  manuales (`Shots.bas:1226 IsArrayBounded`, `Module1.bas IsRobDNABounded`) no son
  sustitutos de un chequeo apagado: son manejo anticipado de casos esperados.
- **`FlPointCheck=0` / `FDIVCheck=0` (ACTIVOS)**: los errores de coma flotante se
  chequean (división FP por cero → **error 11** también en el EXE); el workaround del
  FDIV del Pentium está incluido (sin efecto observable).
- **`UnroundedFP=0` (redondeo forzado)**: el compilador **redondea a la precisión
  declarada en cada asignación** (no retiene valores en registros x87 entre
  sentencias). Queda como única fuente de divergencia numérica la precisión extendida
  x87 **dentro de una expresión** (doble redondeo), acotada y no falsable sin el
  binario (ver Q07).
  - **Excepción documentada (2026-09-25, revisión del port, piloto 6)**: en
    `CInt(x * 200)` o `CInt(dist - r1 - r2)` con operandos `Single`:
    - **Lectura N-06** (RV-03 en `REVISION-PORT.md`): se redondearía a entero
      el valor extendido.
    - **Port**: redondea antes el producto o la resta a `float` (binary32 por
      operación). Se acepta como límite asumido, sin tocar el port.
    - **Cuándo difiere**: solo si ese redondeo cruza una frontera de .5, con una
      frecuencia de 10⁻⁵ a 10⁻⁴ por llamada.
    - **Excepción dentro de la excepción**: RV-07, donde el propio fuente
      compara `Round` con `CInt` y la diferencia es observable.

**Qué pasa con esos errores en runtime — la semántica que importa**: la simulación
arranca siempre con `MDIForm1.ignoreerror = True` desde 2014 (`MDIForm1.frm:1701-1703`),
y con él el bucle principal activa `On Error Resume Next` (`main.frm:2070-2071`; la
alternativa `On Error GoTo SaveError` está comentada, `:2073`). Un error 6/9/11 en
cualquier profundidad del tick sin handler local más cercano desenrolla la pila hasta
`main()` y ejecuta la línea siguiente a `UpdateSim` (`main.frm:2079`): **el resto del
tick se trunca en silencio** y el ciclo siguiente arranca normal. Handlers locales que
acotan el daño: `Teleport.bas:393,422`, `Shots.bas:1227`, `NeoMutations.bas:98,239,312`,
`DNATokenizing.bas:61,770`, `Evo.bas:219,278,356,395`, `Module1.bas:58`. Ver
`10-CICLO.md §14` para el contrato completo de truncamiento.

---

## 2. Volumen

| Métrica | Valor |
|---|---|
| Total de líneas (`.bas` + `.cls` + `.frm`) del motor | **53 327** |
| Módulos `.bas` | 36 |
| Clases `.cls` | 6 |
| Formularios `.frm` | 25 |
| Proyectos VB6 en el repo | 7 |

---

## 3. Código muerto — leer antes de especificar nada

Archivos presentes en `Darwinbots2/` que **ningún** `.vbp` del repositorio referencia
(verificado cruzando las entradas `Module=`/`Class=`/`Form=` de los 7 `.vbp` contra el
listado de disco):

| Archivo | LOC | Por qué es una trampa |
|---|---|---|
| `DnaOps.bas` | 962 | Nombre engañosamente central. Contiene una implementación **antigua y no compilada** de mutaciones (`DuplicateRandomGene`, `DeleteRandomGene`, `Mutchange`, `ChangeValue`), superseded por `NeoMutations.bas`. Especificar mutaciones desde aquí produciría una spec de un motor que no existe. |
| `DoubleWord.cls` | 162 | Duplica la funcionalidad de `Bitwise.bas` (`NumberToBit`, `BitAND`, `BitShiftLeft`…). Legacy. |
| `NodeSpeedThings.bas` | 203 | Sin procedimientos públicos detectados. **[SIN VERIFICAR]** contenido. |
| `unixtime.bas` | 60 | `GetCurrentGMTfrom1970`. No usado. |
| `OptionsRobotPlacement.bas` | 1 | Archivo vacío (1 línea). |

**Total código muerto: 1 388 LOC.**

Caso aparte — `Main.bas` (502 LOC): **no** está en `Iersera.vbp` (el simulador), pero
**sí** en `UnitTests/DarwinBots2UnitTests.vbp`. Es decir, no forma parte del ejecutable
distribuido. **[SIN VERIFICAR]** si define un `Sub Main` alternativo para el runner de tests.

---

## 4. Módulos del motor

### 4.1 Núcleo de simulación — prioridad máxima

| Archivo | LOC | Qué hace | Cita clave |
|---|---|---|---|
| `Master.bas` | 555 | **El tick de simulación.** Un único procedimiento público, `UpdateSim`. Orquesta el ciclo completo. | `Master.bas:23` |
| `DNA.bas` | 1 271 | **El intérprete de ADN** (`ExecuteDNA`) más el driver que lo corre sobre todos los bots (`ExecRobs`). Contiene la implementación de cada operador: aritmético, avanzado, bitwise, condicional. | `DNA.bas:56` (`ExecuteDNA`), `DNA.bas:1245` (`ExecRobs`) |
| `Module1.bas` (`DNAManipulations`) | 469 | **Los stacks.** `PushIntStack`, `PopIntStack`, `ClearIntStack`, `DupIntStack`. Además carga de ADN (`RobScriptLoad`), `insertsysvars`, `interpretUSE`, y la comprobación manual de límites `IsRobDNABounded`. | `Module1.bas` |
| `DNATokenizing.bas` | 3 306 | Tokenizador/destokenizador y **la tabla de sysvars**: `LoadSysVars` ocupa de la línea 862 a ~3169, unas **2 300 líneas** de definiciones. Es la fuente de verdad del mapa de memoria. | `DNATokenizing.bas:862` |
| `Robots.bas` | 3 058 | Ciclo de vida del bot: `UpdateBots` (el bucle por bot), metabolismo (`Upkeep`), muerte (`ManageDeath`), reproducción (`ManageReproduction`), disparo (`robshoot`), shell/slime, `altzheimer`, waste, cloroplastos, distancia genética y crossover. | `Robots.bas:1476` (`UpdateBots`) |
| `Physics.bas` | 1 236 | Fuerzas y colisiones: `NetForces`, `CalcMass`, `AddedMass`, `FrictionForces`, `BrownianForces`, `SphereDragForces`, `GravityForces`, `VoluntaryForces`, `TieHooke`, `TieTorque`, `bordercolls`, `Repel3`. | `Physics.bas:23` |
| `Senses.bas` | 823 | Visión y sentidos: `lookoccurr` (el barrido de los ojos), `touch`, `taste`, `WriteSenses`, `EraseSenses`. | `Senses.bas:221` |
| `Shots.bas` | 1 236 | Disparos: creación, actualización, decaimiento, colisión, y los efectos por tipo (`takenrg`, `takeven`, `takewaste`, `takepoison`, `takesperm`, `releasenrg`, `releasebod`). También virus (`Vshoot`, `MakeVirus`, `copygene`, `addgene`). | `Shots.bas:88` |
| `Ties.bas` | 1 030 | Ties: `maketie`, `DeleteTie`, `Update_Ties`, comunicación (`tieportcom`, `readtie`, `ReadTRefVars`), geometría (`UpdateTieAngles`, `regang`, `bend`, `shrink`). | `Ties.bas:124` |
| `NeoMutations.bas` | 1 138 | **Mutaciones vigentes.** `mutate` y los operadores: `PointMutation`, `PointMutation2`, `Insertion`, `Reversal`, `MinorDeletion`, `MajorDeletion`, `Amplification`, `Translocation`, `CopyError`, `CopyError2`, `DeltaMut`. Más `delgene` y las tasas por defecto. | `NeoMutations.bas:122` |
| `Quads.bas` (`Buckets_Module`) | 1 109 | **Particionado espacial** (buckets) para acelerar visión y colisiones: `Init_Buckets`, `UpdateBotBucket`, `BucketsProximity`, `BucketsCollision`, `CompareRobots3`, `CompareShapes`, `SegmentSegmentIntersect`, y geometría de ojos (`AbsoluteEyeWidth`, `NarrowestEye`, `EyeSightDistance`, `eyestrength`). | `Quads.bas:22` |
| `Vegs.bas` | 325 | Vegetales: repoblación (`VegsRepopulate`) y alimentación (`feedvegs`, `feedveg2`). | `Vegs.bas:23` |
| `Multibots.bas` | 170 | Organismos multicelulares: `ReSpawn`, `KillOrganism`, `FreezeOrganism`, `ListCells`. | `Multibots.bas:9` |
| `Common.bas` | 255 | **RNG y álgebra vectorial.** `rndy` (el choke point de aleatoriedad), `Random`, `fRnd`, `Gauss`, `gasdev`, más las operaciones de vector. | `Common.bas:228` (`rndy`) |
| `Bitwise.bas` | 151 | Operaciones bit a bit sobre arrays de bits: `NumberToBit`, `BitToNumber`, `BitAND`/`OR`/`XOR`, shifts, `IncBits`, `DecBits`. | `Bitwise.bas:17` |
| `Globals.bas` | 506 | Declaraciones globales y estado compartido; además hooks de ventana y `aggiungirob`, `checkvegstatus`, `makepoff`. | `Globals.bas` |
| `SimOptions.bas` | 208 | Sin procedimientos: definiciones de tipos y constantes de opciones de simulación (`SimOpts`). | `SimOptions.bas` |

### 4.2 Periféricos del motor

| Archivo | LOC | Qué hace |
|---|---|---|
| `Obstacles.bas` | 567 | Formas/obstáculos y generadores de laberintos. |
| `Teleport.bas` | 477 | Teletransportadores, incluida la variante por internet. |
| `HDRoutines.bas` | 2 597 | E/S en disco: guardar/cargar simulaciones y organismos, gestión de directorios, especies. |
| `Evo.bas` | 740 | Modo evolución/competición: dificultad, etapas, handicaps, ZeroBot. |
| `F1Mode.bas` | 528 | Modo liga F1: reset de contienda, conteo de población, escalera. |
| `Database.bas` | 147 | Snapshots y registro. |
| `Scripts.bas` | 36 | Guardar/cargar scripts. |
| `Flex.bas` | 74 | Utilidad de colecciones. |
| `stringops.bas` | 83 | Utilidades de rutas y cadenas. |
| `colors.bas` | 78 | Conversión HSL↔RGB. |
| `localizzazione.bas` | 102 | Cadenas de interfaz (el proyecto tiene origen italiano). |
| `varspecie.bas` | 46 | Tipo de especie; sin procedimientos. |
| `provvisorio.bas` (`IntOpts`) | 48 | `AttribuisciNome`. Nombre "provisional". |
| `stayontop.bas` | 13 | Declaraciones de API Win32. |

### 4.3 Clases

| Archivo | LOC | Qué hace |
|---|---|---|
| `CRect.cls` | 218 | Rectángulo. |
| `list.cls` / `linked.cls` | 195 / 20 | Lista enlazada. |
| `Class1.cls` (`cevent`) | 22 | Evento. |
| `TrayIcon.cls` | 131 | Icono de bandeja. |

### 4.4 Formularios

Ninguno es núcleo de simulación **salvo `main.frm`**, que contiene el bucle exterior.

| Archivo | LOC | Nombre VB | Rol |
|---|---|---|---|
| `main.frm` | 3 202 | `Form1` | **Bucle exterior de la simulación** y renderizado. |
| `MDIForm1.frm` | 3 147 | `MDIForm1` | Ventana MDI contenedora; punto de entrada. |
| `OptionsForm.frm` | 5 835 | — | "Simulation Settings". El formulario más grande del proyecto: aquí viven muchos parámetros configurables. |
| `grafico.frm` | 4 197 | `grafico` | Gráficas. |
| `frmGset.frm` | 1 762 | — | "Global Settings". |
| `CostsForm.frm` | 1 247 | — | "Costs" — parámetros de la economía energética. |
| `frmAbout1.frm` | 1 158 | — | "Help for DNA commands" — **documentación del lenguaje embebida en el fuente**. |
| `NeoMutprob.frm` | 1 149 | — | "Mutation Probabilities". |
| `robdata.frm` | 799 | `datirob` | "Dati del robot" — inspector de bot. |
| `PhysicsOptions.frm` | 617 | — | "Advanced Physics Options". |
| `frmRestriOps.frm` | 583 | — | "Restriction Options". |
| `TeleportForm.frm` | 529 | — | "New Teleporter". |
| `ObstacleForm.frm` | 498 | — | "Shapes". |
| `console.frm` | 488 | `Consoleform` | Consola; **también llama a `UpdateSim`** (`console.frm:466`). |
| `EnergyForm.frm` | 424 | — | "Energy Management". |
| `frmMonitorSet.frm` | 426 | — | "RGB Memory Monitor Settings". |
| `Contest_Form.frm` | 398 | — | "Contest Results". |
| `frmEYE.frm` | 373 | — | "Eye Designer". |
| `frmAbout.frm` | 278 | — | Acerca de (en italiano). |
| `InfoForm.frm` | 270 | — | "Darwinbots". |
| `colorform.frm` | 251 | — | "Custom Color". |
| `frmPBMode.frm` | 238 | — | "Player Bot Mode Settings". |
| `parentele.frm` | 218 | `parentele` | "Parentele" — parentescos. |
| `NetEvent.frm` | 188 | — | "Network event". |
| `ActivForm.frm` | 147 | — | "Genes Activations". |
| `frmFirstTimeInfo.frm` | 47 | — | Selección de primera simulación. |

---

## 5. El loop principal — localizado

### Bucle exterior

`main.frm:2061` `Private Sub main()` contiene un `Do ... Loop` que por iteración:

```
main.frm:2078   UpdateSim
main.frm:2079   MDIForm1.Follow
main.frm:2081   If StartAnotherRound Then Exit Sub
main.frm:2084   If MDIForm1.visualize Then ... Redraw
```

El render está **fuera** del tick de simulación y puede saltarse
(`main.frm:2087` `oneonten`: redibuja 1 de cada 10 ciclos). Buena noticia para el port:
simulación y presentación ya están desacopladas en el original.

`UpdateSim` tiene un segundo llamador: `console.frm:466`. **[SIN VERIFICAR]** si el modo
consola produce una secuencia de ciclo distinta.

### El tick — `Master.bas:23 Sub UpdateSim`

Secuencia observada (orden de aparición, **pendiente de verificación línea a línea en
`spec/10-CICLO.md`**):

| # | Paso | Cita |
|---|---|---|
| 1 | Tecla F12 → pausa | `Master.bas:42` |
| 2 | `ModeChangeCycles + 1`, `SimOpts.TotRunCycle + 1` | `Master.bas:49-50` |
| 3 | Lógica de modo evo/hidepred (conteos, handicaps, reposicionado) | `Master.bas:64-201` |
| 4 | Oscilación de tasas de mutación | `Master.bas:205-233` |
| 5 | Contabilidad de energía total y población | `Master.bas:236-252` |
| 6 | Costes dinámicos: ajuste de `COSTMULTIPLIER` | `Master.bas:254-300` |
| 7 | **`ExecRobs`** — ejecuta el ADN de todos los bots | `Master.bas:332` |
| 8 | **`EraseSenses`** para cada bot | `Master.bas:340-344` |
| 9 | Sobrescrituras de Player Bot Mode | `Master.bas:347-360` |
| 10 | **`updateshots`** | `Master.bas:362` |
| 11 | Guardar `opos` (posición previa) | `Master.bas:365-369` |
| 12 | **`UpdateBots`** — física, acciones, muerte, reproducción | `Master.bas:371` |
| 13 | Calcular `actvel` = `pos - opos` | `Master.bas:374-379` |
| 14 | `MoveObstacles`, `UpdateTeleporters` | `Master.bas:381-382` |
| 15 | Contar cloroplastos → `VegsRepopulate` si procede | `Master.bas:384-394` |
| 16 | **`feedvegs`** | `Master.bas:396` |
| 17 | Monitor RGB | `Master.bas:417-427` |
| 18 | Matanza por presión de memoria si `totlen > 4 000 000` | `Master.bas:442-461` |
| 19 | Autoguardado safemode | `Master.bas:469-481` |
| 20 | Modos de reinicio / ZeroBot / test | `Master.bas:485-554` |

**Observaciones que condicionan el port:**

- El ADN se ejecuta (paso 7) **antes** de que se borren los sentidos (paso 8) y **antes**
  de `updateshots` (paso 10). El orden intuitivo sería el contrario. El comentario del
  fuente lo justifica: `Master.bas:339` *"updateshots can write to bot sense, so we need
  to clear bot senses before updating shots"*.
- Gran parte de `UpdateSim` (pasos 3, 19, 20 y buena parte del 6) es andamiaje de
  **modos de competición y evolución dirigida**, no ecología base. Es separable:
  el port puede implementar el núcleo sin `hidepred`, `x_restartmode` ni ZeroBot.
- `Master.bas:530` declara `Static totnrgnvegs As Double` **dentro** del procedimiento:
  estado oculto que persiste entre ciclos. Exactamente la trampa que el brief señala.
- `Master.bas:98` define una etiqueta `Mode:` con un `GoTo Mode` en `Master.bas:103`.
  Bucle implementado con salto; hay que leerlo con cuidado al especificar.
- `Master.bas:442-461`: cuando el ADN total supera 4 000 000, el motor **mata bots**
  por presión de memoria eligiendo los de menor `nrg + body*10`. Es una presión
  selectiva artificial que **forma parte del comportamiento observable** y contra la
  que el corpus evolucionó. `[PROBABLE BUG]` como mecánica ecológica, pero real.

---

## 6. Aleatoriedad — punto único, con reservas

Toda la aleatoriedad del motor debería pasar por `Common.bas:228 Public Function rndy()`,
que envuelve el `Rnd` de VB6. Es una buena noticia para la reproducibilidad del port.

Dos complicaciones confirmadas:

1. **Modo `UseIntRnd`** (`Common.bas:229`): cuando está activo, `rndy` consume una lista
   externa (`rndylist`) y llama a `Randomize` cada ~1500 extracciones, leyendo archivos
   de disco y borrándolos (`Common.bas:238-245`). Con `UseIntRnd` activo **los replays no
   son reproducibles**. Además mantiene `Static y As Integer` (`Common.bas:231`).
2. **`gasdev`** (`Common.bas:85`), el generador gaussiano usado por `Gauss`, implementa
   Box-Muller con **caché del segundo valor** en `Static iset` y `Static gset`
   (`Common.bas:87-88`). El estado sobrevive entre llamadas y **entre ciclos**. Un port
   que genere los dos valores sin cachear producirá una secuencia distinta aunque el
   RNG base sea idéntico.

`Rnd`/`Randomize` aparecen además **fuera** de `rndy`. Conteo por archivo:

```
Common.bas:5   DnaOps.bas:2 (muerto)   Globals.bas:1   HDRoutines.bas:2
Obstacles.bas:10   EnergyForm.frm:1   MDIForm1.frm:6   OptionsForm.frm:19   main.frm:15
```

**[SIN VERIFICAR]** Cuáles de esas llamadas ocurren dentro del ciclo de simulación
(y por tanto consumen del mismo flujo, alterando el orden) y cuáles son sólo de
inicialización o de interfaz. Es una pregunta abierta crítica para los replays
deterministas — ver `spec/OPEN_QUESTIONS.md`.

---

## 7. Convenciones VB6 detectadas

- **No hay `Option Base` en ningún archivo.** Los arrays son 0-based por defecto.
  Pero el código itera sistemáticamente `For t = 1 To MaxRobs`
  (`Master.bas:68`, `:303`, `:340`, `:432`…), de modo que **el índice 0 queda sin usar**
  en el array `rob()`. El port debe decidir explícitamente si replica el hueco.
  **[SIN VERIFICAR]** si algún array sí usa el índice 0 con significado.
- **11 módulos sin `Option Explicit`**: `Flex.bas`, `OptionsRobotPlacement.bas`,
  `SimOptions.bas`, `colors.bas`, `localizzazione.bas`, `stayontop.bas`, `stringops.bas`,
  `varspecie.bas`, `Class1.cls`, `linked.cls`, `list.cls`. En ellos cualquier
  identificador mal escrito se convierte en un `Variant` vacío en silencio.
  Ninguno es núcleo de simulación, pero `SimOptions.bas` define opciones.

---

## 8. Otros proyectos del repositorio

| Proyecto | Rol | Nota para la spec |
|---|---|---|
| `UnitTests/DarwinBots2UnitTests.vbp` | Suite de tests (SimplyVBUnit) que **enlaza el motor entero** por referencia relativa `..\Darwinbots2\*`. | Fuente potencial de casos dorados ya escritos por los autores. Revisar en Fase 2. |
| `ManualSexRepro/` | Herramienta de cruce manual. Reutiliza `DNATokenizing.bas`. | Confirma que el tokenizador es reutilizable de forma aislada. |
| `Snapshot Search/`, `GraphJoin/`, `SafeModeBackup/`, `Restarter/` | Utilidades auxiliares. | Sin relevancia para la semántica del motor. |
| `Installer/bots/` | **Corpus de bots originales.** | Material de test de primera. `Animal_Minimalis.txt` está aquí en su forma original. |
| `DBLaunch/` (C#), `LocalDBIM/` (VB.NET), `PeterIM/` (Python) | Lanzador y mensajería. | Fuera del alcance de la spec del motor. |

---

## 9. Estado

Fase 0 completa salvo lo marcado `[SIN VERIFICAR]`. No se ha escrito ninguna línea de
especificación de comportamiento. Los fuentes no han sido modificados.
