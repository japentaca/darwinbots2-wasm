# Preguntas abiertas

Todo lo marcado `[SIN VERIFICAR]` en los documentos de `spec/`, centralizado.
**Ninguna de estas se responde con el wiki.** Se responden leyendo el fuente, o quedan
abiertas.

Estado: `ABIERTA` · `EN CURSO` · `RESUELTA (cita)` · `IRRESOLUBLE DESDE EL FUENTE`

---

## Desde Fase 0 (reconocimiento)

| # | Pregunta | Origen | Estado |
|---|---|---|---|
| Q01 | ¿Qué llamadas a `Rnd`/`Randomize` fuera de `Common.bas:rndy` ocurren **dentro** del ciclo de simulación? Alteran el orden de consumo del flujo aleatorio y por tanto los replays. Sospechosos: `Obstacles.bas` (10 usos), `main.frm` (15), `Globals.bas` (1), `HDRoutines.bas` (2). | `00-INVENTARIO.md §6` | ABIERTA |
| Q02 | ¿Qué algoritmo exacto usa el `Rnd` de VB6 y con qué semilla arranca? Determina si el port puede reproducir secuencias bit a bit. Puede ser `IRRESOLUBLE DESDE EL FUENTE`: es runtime de VB6, no código del proyecto. | `00-INVENTARIO.md §6` | ABIERTA |
| Q03 | ¿Algún array del motor usa el índice 0 con significado? No hay `Option Base` en ningún archivo, pero el código itera `1 To MaxRobs`. | `00-INVENTARIO.md §7` | ABIERTA |
| Q04 | ¿El modo consola (`console.frm:466`) produce una secuencia de ciclo distinta a la del bucle de `main.frm:2078`? | `00-INVENTARIO.md §5` | ABIERTA |
| Q05 | ¿Qué contiene `NodeSpeedThings.bas` (203 LOC, código muerto) y por qué se dejó? Puede documentar una intención de diseño abandonada. | `00-INVENTARIO.md §3` | ABIERTA |
| Q06 | ¿`Main.bas` (502 LOC) define un `Sub Main` alternativo para el runner de tests? No está en el EXE, sólo en `UnitTests`. | `00-INVENTARIO.md §3` | ABIERTA |
| Q07 | Impacto real de `FlPointCheck=0` / `UnroundedFP=0` sobre la reproducibilidad numérica: ¿hay acumuladores `Single` donde la precisión extendida x87 cambie el resultado observable? | `00-INVENTARIO.md §1` | ABIERTA |
| Q08 | ¿Divergen el EXE compilado y el IDE en algún punto **observable** por culpa de `OverflowCheck=0` / `BoundsCheck=0`? Localizar los sitios donde el overflow es alcanzable desde ADN de bot. | `00-INVENTARIO.md §1` | ABIERTA |

---

## Pendientes de abrir

El Bloque A añadirá las suyas. La pregunta más importante que espera respuesta
—si la actualización de bots es simultánea o secuencial— se resuelve en `10-CICLO.md`
y **no** se registra aquí como abierta: es el objetivo del documento, no un hueco.
