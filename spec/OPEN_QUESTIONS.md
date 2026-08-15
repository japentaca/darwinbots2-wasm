# Preguntas abiertas

Todo lo marcado `[SIN VERIFICAR]` en los documentos de `spec/`, centralizado.
**Ninguna de estas se responde con el wiki.** Se responden leyendo el fuente, o quedan
abiertas.

Estado: `ABIERTA` · `EN CURSO` · `RESUELTA (cita)` · `IRRESOLUBLE DESDE EL FUENTE`

---

## Desde Fase 0 (reconocimiento)

| # | Pregunta | Origen | Estado |
|---|---|---|---|
| Q01 | ¿Qué llamadas a `Rnd`/`Randomize` fuera de `Common.bas:rndy` ocurren **dentro** del ciclo de simulación? Alteran el orden de consumo del flujo aleatorio y por tanto los replays. Sospechosos: `Obstacles.bas` (10 usos), `main.frm` (15), `Globals.bas` (1), `HDRoutines.bas` (2). **Parcial desde A1**: dentro del tick consumen RNG `VegsRepopulate`/`aggiungirob` (`Vegs.bas:32`, `Globals.bas:411-415`), `feedvegs` (`Vegs.bas:51-52`), `feedveg2` (`Vegs.bas:282`), `BrownianForces` (`Physics.bas:113-117`), el intérprete (`DNA.bas:277`, `:1098`), `ReproduceAndKill` (`Robots.bas:1668`) y las mutaciones. Falta `Obstacles.bas` (`MoveObstacles`, B7) y `HDRoutines.bas`. | `00-INVENTARIO.md §6`, `10-CICLO.md §0.1, §13` | EN CURSO |
| Q02 | ¿Qué algoritmo exacto usa el `Rnd` de VB6 y con qué semilla arranca? Determina si el port puede reproducir secuencias bit a bit. Puede ser `IRRESOLUBLE DESDE EL FUENTE`: es runtime de VB6, no código del proyecto. | `00-INVENTARIO.md §6` | ABIERTA |
| Q03 | ¿Algún array del motor usa el índice 0 con significado? No hay `Option Base` en ningún archivo, pero el código itera `1 To MaxRobs`. **Parcial desde A1**: `rob(0)` nunca se puebla, pero es alcanzable vía `KillRobot(0)` desde la matanza por presión de memoria (`10-CICLO.md §8`). Falta barrer `Shots()`, `Ties`, buckets. | `00-INVENTARIO.md §7`, `10-CICLO.md §8` | EN CURSO |
| Q04 | ¿El modo consola (`console.frm:466`) produce una secuencia de ciclo distinta a la del bucle de `main.frm:2078`? | `00-INVENTARIO.md §5` | RESUELTA (`console.frm:461-480` llama al mismo `UpdateSim`; sólo cambia el render, incondicional por ciclo. `10-CICLO.md §1`) |
| Q05 | ¿Qué contiene `NodeSpeedThings.bas` (203 LOC, código muerto) y por qué se dejó? Puede documentar una intención de diseño abandonada. | `00-INVENTARIO.md §3` | ABIERTA |
| Q06 | ¿`Main.bas` (502 LOC) define un `Sub Main` alternativo para el runner de tests? No está en el EXE, sólo en `UnitTests`. | `00-INVENTARIO.md §3` | ABIERTA |
| Q07 | Impacto real de `FlPointCheck=0` / `UnroundedFP=0` sobre la reproducibilidad numérica: ¿hay acumuladores `Single` donde la precisión extendida x87 cambie el resultado observable? | `00-INVENTARIO.md §1` | ABIERTA |
| Q08 | ¿Divergen el EXE compilado y el IDE en algún punto **observable** por culpa de `OverflowCheck=0` / `BoundsCheck=0`? Localizar los sitios donde el overflow es alcanzable desde ADN de bot. | `00-INVENTARIO.md §1` | ABIERTA |
| Q09 | El árbol llegó **con los finales de línea normalizados**: 68 de los 69 fuentes VB6 del motor tienen LF; sólo `TrayIcon.cls` conserva CRLF, que es lo que VB6 escribe. ¿Carga el IDE de VB6 archivos sin CRLF? Si no, hace falta un paso de conversión para poder abrir `Iersera.vbp` y observar el comportamiento real. Bloquea cualquier validación empírica de la spec contra el binario. No afecta a las citas `archivo:línea`. | verificación de `.gitattributes`, commit `ec0dc6d` | ABIERTA |

---

## Desde A1 (`10-CICLO.md`)

La pregunta central del bloque —simultánea o secuencial— quedó **respondida** en
`10-CICLO.md §0`: secuencial, in situ, sin doble búfer, con efectos de orden enumerados.

| # | Pregunta | Origen | Estado |
|---|---|---|---|
| Q10 | Mecánica interna de los teleporters (`CheckTeleporters` en la pasada P0a, `UpdateTeleporters` en el paso 18 del tick): ¿crean/destruyen bots, en qué orden, consumen RNG? | `10-CICLO.md §6` | ABIERTA (B7) |
| Q11 | `UpdateTieAngles` corre sobre slots inexistentes (`Robots.bas:1621`, antes del chequeo `exist`). ¿Tiene efecto observable sobre un slot en blanco? | `10-CICLO.md §11.6` | ABIERTA (B4) |
| Q12 | ¿`RobScriptLoad` consume RNG al cargar un vegetal desde disco durante `VegsRepopulate`? Afecta a los replays cada vez que repuebla. | `10-CICLO.md §12` | ABIERTA (B8) |
| Q13 | Desborde teórico de `rep(32000)` con población máxima y doble encolado asexual+sexual (`Robots.bas:1391-1400`): ¿es alcanzable en la práctica y qué pisa en el EXE (`BoundsCheck=0`)? | `10-CICLO.md §6` | ABIERTA |
| Q14 | ¿`GiveAbsNum`/`AbsNum` (identidad absoluta de bots, `Robots.bas:2966`) tienen overflow alcanzable en simulaciones largas? `parent` se compara contra `AbsNum` (`Robots.bas:2234`, `Shots.bas:330`). | `10-CICLO.md §12` | ABIERTA (A3/B8) |
