# 10 — El ciclo de simulación

> Documento A1 de la especificación. Fuente de verdad: el código citado, leído línea a
> línea. Toda afirmación cita `archivo:línea` sobre el commit `02b20d7`. Los tipos VB6 se
> anotan donde condicionan el comportamiento. Lo no derivable del fuente va `[SIN VERIFICAR]`.
> Comportamiento raro pero real va `[PROBABLE BUG]`: es parte de la spec, no se corrige.

---

## 0. Respuesta a la pregunta central

**La iteración por bots es secuencial e in situ. No hay doble búfer en ninguna fase.**

Todos los bucles del motor iteran `For t = 1 To MaxRobs` mutando `rob(t)` (y a veces
`rob(j)`, `j ≠ t`) en el momento. El bot `t` ve, dentro de la misma pasada, el estado ya
modificado de todos los bots de índice menor. Pero la consecuencia práctica es más fina de
lo que sugiere el enunciado, porque el ciclo está **fuertemente multipasada** (§5): cada
pasada corta recorre a *todos* los bots antes de que empiece la siguiente. El índice del
bot importa **dentro de cada pasada**, no entre fases.

Efectos de orden concretos, enumerados y citados:

1. **Flujo aleatorio.** El intérprete de ADN consume RNG (`DNA.bas:277` operador aleatorio,
   `DNA.bas:1098`), igual que las fuerzas brownianas (`Physics.bas:113-117`, 3 extracciones
   de `rndy` por bot y ciclo si `PhysBrown ≠ 0`), la digestión de waste con cloroplastos
   (`Vegs.bas:282`), la elección asexual/sexual al reproducir (`Robots.bas:1668`) y las
   mutaciones. Como el RNG es un flujo global único (`Common.bas:228`), **el índice del bot
   determina qué números aleatorios recibe**. Cualquier alta o baja de un bot desplaza las
   extracciones de todos los siguientes.
2. **Colisiones bot-bot.** Cada par se procesa **una sola vez**, cuando el bucle está en el
   índice menor del par (`Quads.bas:259` `If robnumber > n`). `Repel3` modifica las
   velocidades de **ambos** bots en el acto (`Physics.bas:955-960`), escribe los sentidos de
   contacto de ambos (`Physics.bas:964-965` `touch`), `lasttch` (`:968-969`) y los refvars de
   ambos (`:972-973` `lookoccurr`). Asimetría resultante: el bot de índice mayor recibe el
   impulso de colisión **antes** de que corran sus propias `NetForces`; el de índice menor
   las corrió antes de colisionar (`Robots.bas:1544-1545`, orden dentro de la pasada 1).
3. **Comunicación por ties.** `tieportcom` escribe directamente en la memoria del bot atado
   (`Ties.bas:62` `rob(.Ties(k).pnt).mem(...) = .mem(tieval)`), y `Update_Ties` transfiere
   nrg/waste/shell/slime/cloroplastos entre bots en el momento (`Robots.bas:1583`,
   `Ties.bas:141-160`). Un valor inyectado por el bot `i` en el bot `j > i` puede ser
   re-propagado por `j` **en el mismo ciclo**; si `j < i`, recién al ciclo siguiente.
4. **Visión.** El barrido de ojos ocurre por bot dentro de la pasada de acciones
   (`Robots.bas:1633` `WriteSenses` → `Senses.bas:181` `BucketsProximity`). Las posiciones ya
   son las finales del ciclo (la pasada de movimiento terminó), pero el resto del estado es
   mixto: los bots de índice menor ya ejecutaron sus acciones de esta pasada (mutaciones,
   disparos, gestión de body/shell) y los de índice mayor no.
5. **Asignación de slots a los nacimientos.** `posto()` devuelve el índice libre **más
   bajo** (`Robots.bas:2914-2922`). Los nacimientos se procesan en orden de índice del
   padre (§6), así que los padres de índice bajo consiguen para sus hijos los slots bajos
   disponibles: la ventaja de índice se hereda y se compone.

Lo que **no** depende del orden, y mitiga el impacto:

- La fase de ADN no lee ni escribe estado de otros bots: todos los accesos del intérprete
  son `rob(currbot)` (verificado por enumeración exhaustiva de las expresiones `rob(...)` de
  `DNA.bas`; las excepciones son `rob(t)` en el driver `ExecRobs` y `rob(n)` en utilidades de
  display). El acoplamiento entre bots durante `ExecRobs` es únicamente el flujo RNG.
- Los disparos creados en este ciclo (`Robots.bas:1627` `Shooting`) no se mueven ni golpean
  hasta el `updateshots` del ciclo **siguiente**, porque `updateshots` corre antes que
  `UpdateBots` (`Master.bas:362` vs `:371`). El orden entre tiradores dentro de un ciclo no
  importa.
- Las posiciones se integran en una pasada propia que termina antes de la visión y las
  acciones (`Robots.bas:1590` dentro de la pasada 3; visión en la pasada 5).

**Para el port:** no se puede paralelizar ninguna pasada sin fijar antes una política de
equivalencia. Reproducir el comportamiento del binario exige iterar en orden de índice
ascendente dentro de cada pasada, con mutación in situ, y consumir el RNG en el mismo orden.

---

## 1. El bucle exterior — `main.frm:2061 Private Sub main()`

Un `Do ... Loop` infinito (`main.frm:2067-2129`). Por iteración, si `Active`:

| Paso | Qué | Cita |
|---|---|---|
| 1 | Captura de errores: si `MDIForm1.ignoreerror`, `On Error Resume Next` — los errores de runtime se tragan y el ciclo continúa con estado inconsistente. La alternativa con autosave está **comentada** | `main.frm:2070-2074` |
| 2 | `UpdateSim` — el tick completo | `main.frm:2078` |
| 3 | `MDIForm1.Follow` (cámara) | `main.frm:2079` |
| 4 | Si `StartAnotherRound`, sale del bucle (reinicio de ronda) | `main.frm:2081` |
| 5 | Render, sólo si `visualize`; con `oneonten` redibuja 1 de cada 10 ciclos (`TotRunCycle Mod 10 = 0`) | `main.frm:2084-2091` |
| 6 | Inspector de bot, gráficas cada `chartingInterval`, datos IM cada 200 ciclos | `main.frm:2093-2111` |
| 7 | `DoEvents` — bombea la UI entre ticks | `main.frm:2113` |
| 8 | Si `limitgraphics`: `clocks = GetTickCount` e inmediatamente después espera activa `While (GetTickCount - clocks < 67)`. Como `clocks` se toma justo antes, la condición de entrada `< 67` es siempre cierta y **cada iteración quema ~67 ms de CPU en un busy-wait**, limitando la simulación a ~15 ciclos/s. `[PROBABLE BUG]` la intención aparente era medir el coste del ciclo; el efecto real es un retardo fijo | `main.frm:2114-2121` |

La simulación y la presentación están desacopladas: el render es opcional y saltable. El
tick no depende de nada del render.

**Segundo llamador de `UpdateSim`:** `console.frm:461-480 Public Sub cycle(num)` — el modo
consola llama exactamente al mismo `UpdateSim` en un `For`, con `Redraw` incondicional por
ciclo. **No hay secuencia de ciclo distinta** (resuelve Q04).

---

## 2. El tick — `Master.bas:23 Sub UpdateSim`, paso a paso

Numeración por orden de ejecución. La columna "Capa" separa el núcleo ecológico del
andamiaje de torneo/UI (marcado ⚙, separable en el port).

| # | Paso | Capa | Cita |
|---|---|---|---|
| 1 | F12 (`GetAsyncKeyState`, funciona incluso sin foco) → pausa | ⚙ UI | `Master.bas:42-47` |
| 2 | `ModeChangeCycles += 1`, `SimOpts.TotRunCycle += 1` | núcleo | `Master.bas:49-50` |
| 3 | Lógica hidepred/evo: conteo de especies, fin de evo, reposicionado de "chasers", alternancia `hidepred` con `rndy` (`:198`, consume RNG), bucle con `GoTo Mode` (`:98-104`) | ⚙ torneo | `Master.bas:52-201` |
| 4 | Oscilación de tasas de mutación: `MutCurrMult` desde `TotRunCycle Mod (MutCycMax+MutCycMin)`, senoidal (`20^Sin(...)`) o escalón (16 / 1/16) | núcleo (opcional) | `Master.bas:203-233` |
| 5 | Contabilidad de energía: `TotalSimEnergyDisplayed = TotalSimEnergy(CurrentEnergyCycle)` (lee el acumulado que el ciclo **anterior** completó), luego `CurrentEnergyCycle = TotRunCycle Mod 100` y se pone a 0 la celda. La celda se rellena durante este ciclo desde `updateshots` (`Shots.bas:319`) y `UpdateBots` (`Robots.bas:1640`). Array `TotalSimEnergy(100) As Long` (`Vegs.bas:11`): 101 celdas, se usan la 0..99 | núcleo | `Master.bas:236-238` |
| 6 | Población para costes dinámicos: `CurrentPopulation` = no-vegetales del ciclo anterior (`totnvegsDisplayed`), + vegetales si `DYNAMICCOSTINCLUDEPLANTS`; historial `PopulationLast10Cycles` desplazado cada 10 ciclos | núcleo | `Master.bas:240-252` |
| 7 | Costes dinámicos: ajuste de `COSTMULTIPLIER` (±1e-7 × desvío × sensibilidad) si la población se aleja del objetivo; suelo en 0 salvo `ALLOWNEGATIVECOSTX`; **cero-costes** bajo `BOTNOCOSTLEVEL` y reinstauración sobre `COSTXREINSTATEMENTLEVEL` (estado en los globales `DynamicCountdown`, `CostsWereZeroed`, `Master.bas:3-4`) | núcleo | `Master.bas:254-300` |
| 8 | Inyección de handicap a los "Mutate.txt" si `hidepred` | ⚙ torneo | `Master.bas:302-313` |
| 9 | `avrnrgStart` (media de nrg pre-update) | ⚙ torneo | `Master.bas:315-330` |
| 10 | **`ExecRobs`** — ejecuta el ADN de todos los bots (§3) | núcleo | `Master.bas:332` |
| 11 | Inspector (si `ShowMemoryEarlyCycle`) | ⚙ UI | `Master.bas:333-337` |
| 12 | **`EraseSenses t`** para cada bot con `exist And Not DisableDNA` (§7) | núcleo | `Master.bas:340-344` |
| 13 | Sobrescrituras de Player Bot Mode (`mem(SetAim)`, teclas → posiciones de memoria) | ⚙ UI | `Master.bas:347-360` |
| 14 | **`updateshots`** — mueve y resuelve los disparos existentes (§4) | núcleo | `Master.bas:362` |
| 15 | `opos = pos` por bot (guardado de posición previa) | núcleo | `Master.bas:365-369` |
| 16 | **`UpdateBots`** — todo lo demás por bot, en 7 pasadas (§5) | núcleo | `Master.bas:371` |
| 17 | `actvel = pos - opos`, sólo si `opos ≠ (0,0)` (protege a los recién nacidos, cuyo `opos` no se configuró) | núcleo | `Master.bas:374-379` |
| 18 | `MoveObstacles` si hay obstáculos; `UpdateTeleporters` si hay teleporters | núcleo | `Master.bas:381-382` |
| 19 | Suma de cloroplastos → `TotalChlr = AllChlr / 16000`. `AllChlr As Long` (`Master.bas:34`), `TotalChlr As Long` (`Globals.bas:164`); `/` es división real en VB6 → asignación a `Long` con **redondeo bancario** | núcleo | `Master.bas:384-390` |
| 20 | Si `TotalChlr < CLng(SimOpts.MinVegs)` y `totvegsDisplayed ≠ -1` (centinela del primer ciclo tras cargar): **`VegsRepopulate`** — nacen vegetales nuevos (§6) | núcleo | `Master.bas:392-394` |
| 21 | **`feedvegs SimOpts.MaxEnergy`** — sol, día/noche, alimentación por cloroplastos (consume RNG: `Vegs.bas:51-52` con `SunOnRnd`) | núcleo | `Master.bas:396` |
| 22 | `avrnrgEnd`, acumula `energydif` | ⚙ torneo | `Master.bas:398-414` |
| 23 | Monitor RGB: copia 3 posiciones de memoria a `monitor_r/g/b` | ⚙ UI | `Master.bas:417-427` |
| 24 | **Matanza por presión de memoria** (§8): si `totlen > 4 000 000`, mata `maxdel+1` bots de menor `nrg + body*10`; si `totlen > 3 000 000`, borra `LastMutDetail` de **todos los slots** 1..MaxRobs, existan o no | núcleo (observable) | `Master.bas:429-466` |
| 25 | Autosave safemode cada 2000 ciclos (o `savenow` con `UseIntRnd`): **escritura a disco dentro del tick** (`SaveSimulation`, borrado de archivos, `Open/Write/Close`) | ⚙ infra | `Master.bas:469-481` |
| 26 | Modos restart/seeding (`x_restartmode = 1`), ZeroBot (`= 7, 8`), test (`= 9`, con `Static totnrgnvegs As Double` **dentro del procedimiento**, `Master.bas:530` — estado que persiste entre ciclos) | ⚙ torneo | `Master.bas:483-554` |

### Flujo de datos de los sentidos entre ciclos

El orden 10→12→14→16 implementa este contrato, confirmado por el comentario del autor
(`Master.bas:339` *"updateshots can write to bot sense, so we need to clear bot senses
before updating shots"*):

- El ADN del ciclo N (paso 10) lee los sentidos escritos durante el ciclo **N−1**
  (por `updateshots` N−1: sabores de disparo; por `UpdateBots` N−1: contacto en la pasada
  de fuerzas, visión y refvars en la pasada de acciones).
- El paso 12 borra contacto, sabores y refvars (no los ojos: esos los borra y reescribe
  `BucketsProximity` en cada barrido, `Quads.bas:183-186`).
- Los pasos 14 y 16 reescriben los sentidos, que el ADN leerá en N+1.

Un port que ejecute el ADN después de la física del mismo ciclo rompe la latencia de un
ciclo que tienen todos los sentidos y contra la que está evolucionado el corpus.

---

## 3. La fase de ADN — `DNA.bas:1245 ExecRobs` y `DNA.bas:56 ExecuteDNA`

`ExecRobs`: `For t = 1 To MaxRobs` (`DNA.bas:1249`); ejecuta `ExecuteDNA t` si
`exist And Not Corpse And Not DisableDNA And Not (FName = "Base.txt" And hidepred)`
(`DNA.bas:1252`). Cada 250 bots llama `DoEvents` (`DNA.bas:1250`; §9).

`ExecuteDNA` (detalle completo en A2 · `20-VM.md`; aquí lo que afecta al ciclo):

- Limpia **ambos stacks al entrar por bot** (`DNA.bas:68-69` `ClearIntStack`,
  `ClearBoolStack`): no hay estado de stack heredado entre bots. `CurrentFlow` se resetea al
  salir (`DNA.bas:174`).
- Recorre el ADN hasta el token `end` maestro (tipo 10, valor 1), con tope
  `a <= 32000 And a < UBound(.dna)` (`DNA.bas:87`).
- **Cobra energía por token ejecutado, en el momento** (`DNA.bas:93` números, `:108`
  lecturas `*n`; los operadores cobran dentro de sus handlers). La energía del bot baja
  durante esta fase, antes de `Upkeep`.
- Los `store` son **inmediatos** sobre `mem` (vía `ExecuteStores`, `DNA.bas:151`; semántica
  exacta en A2): dentro del mismo bot, un gen posterior ve lo que escribió uno anterior en
  el mismo ciclo.
- No toca ningún otro bot ni estado global compartido salvo el RNG y los stacks (que limpia).

**Recién nacidos:** un bot nacido en el ciclo N (§6, al final de `UpdateBots`) ejecuta su
ADN por primera vez en el ciclo N+1, con `age = 0` (el `Ageing` de su primer `UpdateBots`
lo sube a 1 después, `Robots.bas:1201`).

---

## 4. Los disparos — `Shots.bas:288 updateshots`

Una sola pasada `For t = 1 To maxshotarray` (`Shots.bas:305`), `DoEvents` cada 250 (`:307`).
Por disparo existente, **en este orden**:

1. Limpieza de los marcados `flash` en el ciclo anterior (`Shots.bas:310-314`).
2. Contabilidad: los shots de energía (tipo −2) suman a `TotalSimEnergy` (`:319`).
3. **Colisión primero, movimiento después.** `NewShotCollision(t)` (`:324`) usa la posición
   del final del ciclo anterior; los ornamentales (−100) y los virus almacenados (`stored`)
   no colisionan (`:321-322`).
4. Si golpea al bot `h`: inmunidad del recién nacido a los shots de su padre
   (`age <= 1 And Shots(t).parent = rob(h).parent`, `:330`); decaimiento no lineal del nrg
   del shot (`:333-347`); efecto:
   - tipo positivo = escritura directa en la memoria del golpeado:
     `rob(h).mem(shottype) = value` con `shottype = (shottype-1) Mod 1000 + 1` (`:352-357`),
     salvo rebote por poison (`:359-364`);
   - tipo negativo = tabla de efectos −1..−8 (`releasenrg`, `takenrg`, …, `takesperm`)
     (`:370-381`).
   Después escribe el sabor en los sentidos del golpeado (`taste`, `:383`) y marca
   `flash = True` (`:384`) — el shot muere al inicio del `updateshots` **siguiente**.
5. Movimiento: `opos = pos; pos += velocity` (Euler, `:388-389`).
6. Envejecimiento (salvo modos sin decaimiento) y expiración `age > Range` (`:394-405`).

Al final, compactación del array si ocupación < 70% (`:412-423`), que **renumera los
disparos** (los índices de shot no son estables entre ciclos).

Consecuencia de orden con el resto del tick: los disparos creados por `Shooting` durante
`UpdateBots` (paso 16) quedan quietos hasta el paso 14 del ciclo siguiente. Un shot
recorre su primer paso de movimiento un ciclo después de nacer y sólo entonces puede
golpear.

---

## 5. `UpdateBots` — `Robots.bas:1476`: siete pasadas, no un bucle único

`UpdateBots` **no** es un bucle que lo hace todo por bot: son pasadas completas
consecutivas sobre `1..MaxRobs`. Salvo que se indique, cada pasada excluye a los bots con
`Not exist` y a los `Base.txt` bajo `hidepred`.

**Inicialización** (`Robots.bas:1487-1505`): `rp = 1`, `kl = 1`, `kil(1) = 0`, `rep(1) = 0`
(colas de reproducción y muerte, §6); intercambio de contadores mostrados/en curso
(`TotalRobots`, `totnvegs`, `totvegs` → sus `*Displayed`); `Countpop` si `ContestMode` ⚙.

| Pasada | Qué hace, por bot y en orden de índice | Cita |
|---|---|---|
| **P0a** | `CheckTeleporters t` (el comentario lo justifica: "Need to do this first as NetForces can update bots later in the loop") | `Robots.bas:1508-1512` |
| **P0b** | `AddedMass t`, sólo si `SimOpts.Density ≠ 0` | `Robots.bas:1516-1520` |
| — | Cálculo global de mareas (`BouyancyScaling`, muta `SimOpts.Ygravity` y `SimOpts.PhysBrown`) | `Robots.bas:1523-1530` |
| **P1** "pre update" | `Upkeep` (costes de edad/body/ADN; decaimiento de slime y poison ×0.98 — `Robots.bas:1000-1038`) → `Poisons` (efecto de venom/poison activos: reescriben `mem(Vloc)/mem(Ploc)` cada ciclo — `:1114-1137`) → `ManageFixed` (lee `mem(216)`) → `CalcMass` → `DoObstacleCollisions` → `bordercolls` → `TieHooke` → `TieTorque` → `NetForces` (fricción, arrastre, **brownianas con RNG**, gravedad, **`VoluntaryForces`: lee los `dir*` que el ADN escribió en este mismo ciclo** y acumula en `ImpulseInd`, cobrando `MOVECOST` — `Physics.bas:409-463`) → `BucketsCollision` (pares una vez, índice menor manda; `Repel3` con efectos cruzados inmediatos — §0.2) → corrección de fricción estática → `ImpulseInd -= ImpulseRes` → `tieportcom` (escritura cruzada de memoria — §0.3) → `readtie` | `Robots.bas:1533-1563` |
| **P2** contadores | Reset de poblaciones por especie; `UpdateCounters t`: cuenta, y para los corpses llama `Decay` o, si `body ≤ 0`, **`KillRobot t` inmediato en mitad de la pasada** | `Robots.bas:1568-1575`, `:1163-1169` |
| **P3** movimiento | `Update_Ties` (mecánica y compartición por ties, cruzada) → `DoGeneticMemory` si `age < 15` → `SetAimFunc` → `BotDNAManipulation` (virus: `MakeVirus`/`Vshoot`/`delgene` desde `mem`) → **`UpdatePosition`** (aplica `ImpulseInd` a `vel`, satura a `MaxVelocity`, `pos += vel`, `UpdateBotBucket`; **borra `mem(dirup/dirdn/dirsx/dirdx)`** y publica `vel*`, `mass`, `maxvel` en memoria — `Robots.bas:826-879`) → clamps: `nrg` a ±32000, `poison/venom/waste` a 0..32000 | `Robots.bas:1579-1609` |
| **P4** anti-gigantes | Si `chloroplasts < body/2 Or Kills > 5`, y `body > bodyfix`: `KillRobot t` inmediato | `Robots.bas:1613-1617` |
| **P5** acciones | `UpdateTieAngles t` **sin comprobar `exist`** (corre para todos los slots 1..MaxRobs — `Robots.bas:1621`). Para vivos no-corpse con ADN: `mutate t` (mutaciones en vida) → `MakeStuff` (venom/poison/shell/slime desde `mem`) → `HandleWaste` (con RNG vía `feedveg2`) → `Shooting` (`mem(shoot)` → `robshoot`, crea shots para el ciclo siguiente; borra `mem(shoot)`) → `ManageChlr` → `ManageBody` → `ManageBouyancy` → **`ManageReproduction`** (encola en `rep()`: positivo asexual, negativo sexual; **puede encolar dos veces el mismo bot en el mismo ciclo** — `Robots.bas:1367-1401`) → `Shock` → **`WriteSenses`** (barrido de ojos y refvars — §0.4; publica `pain/pleas/bodloss/bodgain` desde `onrg/obody` y actualiza `onrg/obody` — `Senses.bas:169-216`) → `FireTies`. Para vivos aunque tengan ADN deshabilitado: `Ageing` → **`ManageDeath`** (corpse si `nrg < 15`; encola en `kil()` si `Dead` — `Robots.bas:1300-1339`). Para todo `exist`: acumula `nrg + body*10` en `TotalSimEnergy` | `Robots.bas:1619-1642` |
| **P6** | **`ReproduceAndKill`** (§6) → `RemoveExtinctSpecies` | `Robots.bas:1644-1645` |
| — | Si `totnvegs = 0 And SimOpts.Restart And Not SimOpts.F1`: `StartAnotherRound = True` (el bucle exterior reinicia la ronda) | `Robots.bas:1650-1656` |

Notas transversales:

- **`Shock`** (`Robots.bas:1281-1297`): si un no-vegetal con `nrg > 3000` perdió más de la
  mitad de su `onrg` en el ciclo, muere de shock: `nrg = 0` y luego
  `body = body + (nrg / 10)` — **que suma 0 porque `nrg` acaba de ponerse a 0**.
  `[PROBABLE BUG]` la conversión de energía a body es código muerto; la energía se destruye.
- El orden P1→P3 hace que las fuerzas se calculen con las posiciones del ciclo anterior
  (los buckets se actualizan en `UpdatePosition`, P3) y se apliquen todas juntas en P3.
- `Poisons` corre en P1 (antes del borrado de nada): un bot envenenado ve
  `mem(Ploc) = Pval` reescrito **después** de ejecutar su ADN (que corrió en el paso 10 del
  tick) pero antes del ADN del ciclo siguiente.

---

## 6. Nacimientos y muertes: dónde, exactamente

### Colas

Declaradas en `Robots.bas:367-370`: `rep(ROBARRAYMAX)` y `kil(ROBARRAYMAX)` con
`ROBARRAYMAX = 32000` (`Robots.bas:365`), punteros `rp`, `kl` (`Integer`). Se resetean al
entrar en `UpdateBots` (`Robots.bas:1487-1490`). `ManageReproduction` puede encolar el
mismo bot dos veces (asexual y sexual, `Robots.bas:1391-1400`; el comentario del autor lo
reconoce: "Currently possible to reproduce both sexually and asexually in the same
cycle!"). `[PROBABLE BUG]` teórico: con la población al máximo, `rep` puede recibir hasta
2×32000 entradas sobre un array de 32001; en el EXE (`BoundsCheck=0`) el desborde escribe
memoria adyacente en silencio.

### `ReproduceAndKill` — `Robots.bas:1659-1696`

**Primero todos los nacimientos, después todas las muertes.** En orden:

1. Recorre `rep()` en orden de encolado (= orden de índice del padre). Para asexual con
   ambos `Repro` y `mrepro` activos, **elige con `rndy > 0.5`** (`Robots.bas:1668`;
   consumo de RNG dependiente del orden). Llama `Reproduce` o `SexReproduce`.
2. Recorre `kil()` y llama `KillRobot` por cada encolado (`Robots.bas:1692-1695`).

Consecuencias:

- **Un bot encolado para morir en P5 todavía se reproduce en P6** (su entrada en `rep()` se
  procesa antes que su entrada en `kil()`).
- Los recién nacidos ocupan slots liberados en ciclos **anteriores**, nunca los que esta
  ronda de muertes libera (las muertes van después).
- El recién nacido no pasa por ninguna pasada de `UpdateBots` en su ciclo de nacimiento,
  pero **sí** participa en el resto del tick (`Master.bas` pasos 17-24): cuenta cloroplastos,
  recibe `feedvegs`, puede morir por presión de memoria.

### `Reproduce` — `Robots.bas:2100-2413` (lo relevante para el ciclo)

Guardas: `body < 5` sale (`:2102`), `body <= 2` o `CantReproduce` sale (`:2120`),
límites de vegetales (`:2123-2130`), `per = per Mod 100` (`:2132`), colisión en el punto de
nacimiento (`simplecoll`, `:2147`). El slot del hijo es `posto()` (`:2152`). Copia ADN y
estado; el hijo nace a distancia `sondist` en la dirección del `aim` del padre, mirando en
sentido opuesto (`:2183-2194`). Transferencia proporcional `per` de nrg/waste/body/
cloroplastos (`:2209-2232`). Memoria genética: 5 posiciones instantáneas + 15 diferidas, y
se borra la del padre (`:2277-2287`). **Mutaciones de nacimiento**: `mutate nuovo, True`
(con régimen Delta2 o clásico, `:2290-2372`; consume RNG). Tie de nacimiento de 100 ciclos
(`:2380`). `onrg` del padre se actualiza para que no muera de `Shock` por el parto
(`:2381`). `mem(Repro)` y `mem(mrepro)` del padre se ponen a 0 (`:2391-2392`). Coste
`DNACOPYCOST` al padre, con suelo en 0 (`:2408-2409`).

### `posto` — `Robots.bas:2908-2967`

Busca linealmente desde 1 el primer slot con `Not exist` (`:2914-2922`). Si el array está
lleno, `MaxRobs = t` y crece `rob()` con `ReDim Preserve` en incrementos de 100
(`:2925-2948`; el comentario dice 500, el código hace `newsize + 100`). Limpia el slot
asignándole un `robot` en blanco (`:2962-2963`) y le da número absoluto (`GiveAbsNum`).

### `KillRobot` — `Robots.bas:2970-3056`

Muerte **por slot, sin compactación**: borra ties (`delallties`), `exist = False`
(`:3006`), saca al bot de su bucket, crea el "poff" ornamental (`makepoff`, salvo `nopoff`),
mata el virus almacenado si lo hay (`:3017-3020`), libera `spermDNA`. **No comprueba que el
bot exista**: matar un slot ya muerto repite estos efectos. Si `n = MaxRobs`, retrocede
`MaxRobs` hasta el último `exist` (`:3027-3033`) y, si `MaxRobs + 250 < UBound(rob)` con
`MaxRobs > 500`, **encoge el array** con `ReDim Preserve rob(UBound - 250)` (`:3040-3054`).

`[PROBABLE BUG]` — encogimiento en mitad de una pasada: `UpdateCounters` (P2) puede llamar
`KillRobot` con `n = MaxRobs` (`Robots.bas:1168`); si además se cumple la condición de
encogimiento, el array se acorta mientras el bucle de P2 sigue corriendo hasta su límite
**cacheado** (VB6 evalúa el tope del `For` una sola vez). Las iteraciones restantes leen
`rob(t)` con `t > UBound`: en el IDE es un error 9; en el EXE (`BoundsCheck=0`) es una
lectura de memoria adyacente que no falla. Frecuencia baja (requiere que muera justo el
índice máximo con el array poco poblado), pero es una divergencia EXE/IDE observable (Q08).

### Otros puntos de nacimiento y muerte

- **`VegsRepopulate`** (`Vegs.bas:23-38`, tick paso 20): con cooldown acumulativo
  (`cooldown`, global `Vegs.bas:9`), añade `RepopAmount` vegetales por `aggiungirob -1, x, y`
  con posiciones de `Random` (RNG). `aggiungirob` (`Globals.bas:395-434`) elige especie
  vegetal al azar (RNG, `:411`) y **carga el bot desde disco** (`RobScriptLoad`,
  `Globals.bas:419`): E/S de archivo dentro del tick, cada vez que repuebla.
- **Matanza por presión de memoria** (tick paso 24, §8).
- **Muertes inmediatas fuera de la cola `kil`**: `UpdateCounters` P2 (corpse sin body) y la
  pasada P4 anti-gigantes. Ambas ocurren antes de P5, así que un bot matado ahí no llega a
  encolar reproducción ese ciclo.
- Teleporters (`CheckTeleporters` P0a, `UpdateTeleporters` paso 18): pueden sacar y meter
  bots. **[SIN VERIFICAR]** su mecánica interna; queda para B7 (`50-MUNDO.md`).

---

## 7. Limpieza de sysvars: quién borra qué y cuándo

Panorama del ciclo (la tabla exhaustiva posición a posición es de A3 · `21-MEMORIA.md`):

| Momento | Qué se borra/reescribe | Cita |
|---|---|---|
| Tick paso 12, tras el ADN | `EraseSenses`: contacto (`hitup/hitdn/hitdx/hitsx/hit`), sabores (`shflav`, `mem(209)`, `shup/shdn/shdx/shsx`), `mem(214)` (borde), `lasttch`, y todos los refvars/in* vía `EraseLookOccurr` (que **salta a los corpses**, `Senses.bas:352`) | `Senses.bas:98-125`, `:350-393` |
| P3, `UpdatePosition` | `mem(dirup/dirdn/dirsx/dirdx) = 0` tras aplicar el impulso; publica `velscalar/vel/veldn/veldx/velsx`, `masssys`, `maxvelsys` | `Robots.bas:861-877` |
| P5, cada acción consume su comando | `Shooting` borra `mem(shoot)` (`Robots.bas:1214`); `storebody/feedbody` borran `strbody/fdbody` (`:1704`, `:1713`); `ManageBouyancy` borra `setboy` (`:1349`); `tieportcom` borra `tieval/tieloc` al transferir (`Ties.bas:69-70`); `FireTies` borra `mtie` (`Robots.bas:1442`); `Reproduce` borra `Repro/mrepro` del padre (`:2391-2392`) | citadas |
| P5, `WriteSenses` | Ojos: `BucketsProximity` pone `EYEF` y `EyeStart+1..EyeEnd-1` a 0 y los reescribe (los bots `CantSee`/corpse **conservan ojos rancios**) | `Quads.bas:181-186` |
| `updateshots` (paso 14) | Escribe sabores y, para tipos positivos, posiciones arbitrarias de memoria del golpeado | `Shots.bas:357`, `:383` |

---

## 8. La matanza por presión de memoria — `Master.bas:429-466`

Cada ciclo se suma `DnaLen` de todos los vivos (`totlen As Long`). Si `totlen > 4 000 000`:

- `maxdel = 1500 * (CLng(TotalRobotsDisplayed) * 425 / totlen)` (`Master.bas:447`):
  mezcla de aritmética `Long` y división real; para poblaciones con ADN medio de ~425
  tokens, `maxdel ≈ 1500`.
- Bucle `For i = 0 To maxdel` — **mata `maxdel + 1` bots**. En cada iteración busca el
  vivo con menor `nrg + body*10` partiendo de un umbral de 320000 (`:449-458`) y lo mata
  (`:459`).
- `[PROBABLE BUG]` `selectrobot` (`Integer`, inicial 0) sólo se asigna si algún vivo baja
  del umbral. Si ninguno califica (o ya se mataron todos), `Call KillRobot(selectrobot)`
  opera sobre el **último seleccionado otra vez, o sobre `rob(0)`** — el slot 0, que el
  motor nunca puebla (los bucles van de 1 a MaxRobs). `KillRobot` no comprueba `exist`,
  así que ejecuta `delallties 0`, `makepoff 0`, etc. sobre el slot fantasma. Responde
  parcialmente a Q03: **el índice 0 de `rob()` existe, no se usa con significado, pero es
  alcanzable por este camino**.

Es presión selectiva artificial: castiga sistemáticamente a los bots de menor
`nrg + body*10` cuando el genoma agregado de la población crece. El corpus evolucionó con
este techo. El port debe replicarla si quiere la misma ecología en simulaciones largas.

Además, con `totlen > 3 000 000` se borra `rob(t).LastMutDetail` de **todos los slots**
`1..MaxRobs` sin comprobar `exist` (`Master.bas:462-466`) — inocuo, es metadato de UI.

---

## 9. Reentrada por `DoEvents` — estado no atómico del tick

El tick llama `DoEvents` en plena iteración: `DNA.bas:1250` (cada 250 bots),
`Shots.bas:307` (cada 250 shots), `Robots.bas:1534`, `:1565`, `:1577`, `:1580`, `:1610`,
`:1620` (entre y dentro de las pasadas), más el del bucle exterior (`main.frm:2113`).

`DoEvents` bombea la cola de mensajes de Windows: **cualquier manejador de UI puede
ejecutarse en mitad de una pasada** — añadir un bot, cambiar opciones, guardar, pausar.
El estado de la simulación es visible y mutable a mitad de tick. Consecuencias:

- Los replays sólo son deterministas sin interacción del usuario durante el tick.
- El port no debe replicar la reentrada; debe tratar el tick como atómico. Es una
  divergencia deliberada y segura **salvo** que un caso dorado se grabe interactuando.

---

## 10. Estado persistente entre ciclos fuera de `rob()` y `SimOpts`

Inventario de estado oculto que un port debe inicializar/replicar (el RNG ya está en
`00-INVENTARIO.md §6`):

| Estado | Dónde | Usado por |
|---|---|---|
| `Static totnrgnvegs As Double` dentro de `UpdateSim` | `Master.bas:530` | modo test ⚙ |
| `DynamicCountdown`, `CostsWereZeroed`, `PopulationLast10Cycles(10)` | `Master.bas:3-5` | costes dinámicos |
| `energydif*`, `stagnent`, `stopflag`, `savenow` | `Master.bas:9-21` | torneo ⚙ / autosave |
| `cooldown` (repoblación), `TotalSimEnergy(100)`, `CurrentEnergyCycle`, `SunPosition/SunRange/SunChange`, `LightAval` | `Vegs.bas:7-20` | vegetales y sol |
| `rp/kl` y colas `rep()/kil()` | `Robots.bas:367-370` | se resetean por ciclo |
| `MaxRobs`, tamaño de `rob()` | `Robots.bas:366,371` | crece +100 (`posto`), encoge −250 (`KillRobot`) |
| `hidepred`, `ModeChangeCycles`, `hidePredOffset` | globals ⚙ | torneo |
| `Static iset/gset` en `gasdev`, `Static y` en `rndy` | `Common.bas:85-88`, `:231` | toda la aleatoriedad gaussiana |

---

## 11. Resumen de `[PROBABLE BUG]` de este documento

1. **`Shock` destruye energía en vez de convertirla a body** (`Robots.bas:1289-1290`):
   `nrg = 0` antes de leer `nrg/10`. Bots que dependan: cualquiera que explote el shock de
   un rival esperando el cadáver con body; el body extra nunca aparece.
2. **Encogimiento de `rob()` en mitad de pasada** → lectura fuera de rango silenciosa en el
   EXE (`Robots.bas:1168` + `:3040-3054`). Divergencia EXE/IDE (alimenta Q08).
3. **`KillRobot(0)` alcanzable** desde la matanza por presión de memoria
   (`Master.bas:444`, `:459`) — el slot 0 fantasma recibe efectos de muerte.
4. **Busy-wait de 67 ms con `limitgraphics`** (`main.frm:2114-2121`): retardo fijo, no
   límite de framerate.
5. **Doble encolado de reproducción** (asexual+sexual mismo ciclo, `Robots.bas:1391-1400`,
   reconocido por el autor) y desborde teórico de `rep()` con población máxima.
6. **`UpdateTieAngles` corre sobre slots inexistentes** (`Robots.bas:1621`, antes del
   chequeo `exist`). **[SIN VERIFICAR]** si tiene efecto observable (depende de qué haga
   con un slot en blanco; se resuelve en B4 · `34-TIES.md`).
7. **Los bots encolados para morir se reproducen antes de morir** (`Robots.bas:1665-1695`,
   orden nacimientos→muertes). Más que bug, semántica no obvia: un bot puede dejar
   descendencia en su ciclo de muerte, y el corpus pudo evolucionar suicidios reproductivos.

## 12. `[SIN VERIFICAR]` de este documento

- Mecánica interna de teleporters (`CheckTeleporters`/`UpdateTeleporters`) — B7.
- Efecto observable de `UpdateTieAngles` sobre slots vacíos — B4.
- Si `GiveAbsNum` y `AbsNum` tienen overflow alcanzable en simulaciones largas — B8/A3.
- El detalle de `SexReproduce` (`Robots.bas:2417`) — B6; aquí sólo su posición en el ciclo.
- Si `RobScriptLoad` (nacimiento de vegetales desde disco) consume RNG adicional — B8.

## 13. Preguntas de la Fase 0 que este documento cierra

- **Q04 → RESUELTA**: el modo consola llama al mismo `UpdateSim` (`console.frm:466`);
  no hay secuencia distinta.
- **Q03 → parcial**: ningún bucle del motor usa `rob(0)` con significado, pero el slot es
  alcanzable vía `KillRobot(0)` (§8). Falta barrer los demás arrays (shots, ties, buckets)
  en sus documentos.
- **Q01 → parcial**: dentro del tick consumen RNG, además de `rndy`: `Random` en
  `VegsRepopulate`/`aggiungirob` (`Vegs.bas:32`, `Globals.bas:411-415`) y los puntos del §0.1.
  `Obstacles.bas` (`MoveObstacles`, paso 18) queda para B7.
