# 60 — Formatos de archivo

> Documento B8 de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre los tres formatos del motor — bot de texto (`.txt`), organismo
> binario (`.dbo`) y simulación binaria — más los sidecars (`.mrate`, settings) y el
> mecanismo de versionado. El lado de *carga* del formato de texto (LoadDNA/Parse) ya
> está en `20-VM.md §2` y no se repite. **Convención de este documento**: para los
> formatos binarios, la secuencia de `Put`/`Get` del fuente ES la spec normativa — aquí
> se especifica la arquitectura, el orden por grupos y todas las excepciones; la tabla
> campo a campo se genera mecánicamente desde las citas cuando el port la necesite
> (`HDRoutines.bas:2009-2256` para el bot, `:513-849` para la sim).

---

## 0. Respuestas centrales

1. **El versionado binario es un centinela de 3 bytes `254 254 254`** al final de cada
   registro de bot, con `FileContinue` como sonda (`HDRoutines.bas:1979-2007`): el
   lector lee los campos "antiguos" a ciegas y después, campo a campo de las versiones
   posteriores, pregunta si los próximos ≤3 bytes son el terminador. Permite añadir
   campos indefinidamente sin romper archivos viejos. Talón de Aquiles: **un campo
   nuevo cuyo primer byte legítimo sea 254 en tres lecturas consecutivas trunca el
   registro** (probabilístico; no observado, pero estructural).
2. **Solo se persisten 50 de las 1000 variables privadas** (`vars(1..50)`,
   `:2058-2062`) — un bot con más de 50 `def`s pierde el resto al guardar/cargar.
   Irrelevante para la ejecución (las direcciones están tokenizadas) pero visible al
   re-exportar a texto.
3. **`mem()` se persiste crudo y entero** (las 1001 celdas, `mem(0)` incluido,
   `:2067,1655`) — cualquier Integer es legal al cargar, incluida la banda
   (32000, 32767] y −32768 (la válvula de I/O de `21-MEMORIA.md §7`).
4. **`Mutations` se guarda con `Mod 32000`, no con clamp**: `sint(lval) = lval Mod
   32000` (`:2594-2597,2080-2081`) — un bot con 33000 mutaciones renace con 1000.
5. **La memoria epigenética viaja como un gen autodestructivo**: al exportar a texto
   con `UseEpiGene`, `mem(971..990)` se convierte en un gen
   `start … <valor> <dir> store … *.thisgene .delgene store stop` antepuesto al ADN
   (`:2274-2289`) — al ejecutarse una vez, restaura las celdas y **se borra a sí mismo**
   vía `delgene`. Elegante y observable: el bot recargado muta su propio ADN en el
   primer ciclo.
6. **Q06 resuelta**: `Main.bas` **no** define ningún `Sub Main` — son declaraciones
   Win32 y utilidades de subclassing de ventanas (`WindowProc`/`Hook`/`UnHook`,
   scrollbars, registro; `Main.bas:1-450`). El runner de tests lo enlaza como
   dependencia de UI, no como punto de entrada alternativo.

---

## 1. Bot de texto (`.txt`) — `salvarob` (`HDRoutines.bas:2260-2310`)

Estructura del archivo generado:

1. Cabecera `'#generation:` y `'#mutations:` (`SaveRobHeader`,
   `DNATokenizing.bas:850-859`; `Mutations + OldMutations` capado a 2·10⁹).
2. El gen epigenético opcional (§0.5).
3. El ADN destokenizado (`DetokenizeDNA`, semántica y límites en `20-VM.md §9` —
   incluida la inestabilidad `VOID` para ADN degenerado). Con `savingtofile = True`
   los nombres privados **no** se resuelven (`:2291-2293`): el archivo usa las
   direcciones numéricas para los `def`s del bot.
4. Línea en blanco, `'#hash: <20 chars>` — `Hash(texto_previo, 20)`
   (`DNATokenizing.bas:822-846`): suma rodante por posición `Mod f` con acarreo del
   vecino, `Mod 100`, emitida como caracteres `Chr(33..125)`. Al cargar, un hash que
   no cuadra **resetea `generation` y `OldMutations`** (anti-manipulación,
   `20-VM.md §2.2`).
5. `'#tag:` si el bot lleva tag.

Sidecar: `<nombre>.mrate` con las `Mutables` (`Save_mrates`/`Load_mrates`,
`:2562-2592`). `Write #` formatea cada `Single` en formato general con 7 cifras
significativas y el exponente en mayúscula (`1.234568E+07`, `2E+09`). Es el criterio
de `CStr` sobre coma flotante adoptado por el port (fuente secundaria, sin oráculo).
Una tasa ≥ 1E+07 puede cambiar de valor al recargar: 12345678 vuelve como
12345680 (RV-31). Al terminar, un **`MsgBox` interactivo** ofrece renombrar la especie
(`:2307-2309`, ⚙ UI).

Quirk de guardado en modo eco-IM (`y_eco_im > 0`): el **tag se reescribe con el
nombre + los primeros dígitos del `nrg`** antes de persistirlo (`:2202-2207`) — el
tag deja de ser un identificador estable. Solo ocurre con el cartel `lblSaving`
apagado. `SaveSimulation` y `LoadSimulation` lo encienden durante todo el recorrido de
bots (`:541`, `:1108`), así que dentro de un `.sim` el tag no se contamina ni se
aplica la descalificación eco-IM de la carga (`:1909`) (RV-30).

## 2. Registro binario de bot (`SaveRobotBody`/`LoadRobotBody`)

Un registro = campos fijos "v2.37" + apéndices versionados gateados por
`FileContinue` + terminador `254×3`. Grupos, en orden (`:2023-2254`):

| Grupo | Contenido | Quirks |
|---|---|---|
| flags/física | Veg, wall, Fixed, pos, vel, aim, ma, mt | — |
| ties | `Ties(0..10)` × 15 campos | incluye los campos muertos `ln`/`shrink`/`stat`/`mem` (`34-TIES.md §4.4`); el tipo/b/k/NaturalLength van **aparte**, en un apéndice posterior (`:2180-2185`) |
| biología | nrg; `vars(1..50)` (nombre con longitud-prefijo, valor); vnum | §0.2 |
| VM | `mem()` entero; `DnaLen` + tokens `dna(1..DnaLen)` | `dna(0)` fantasma **no** se guarda ✓; al cargar se fuerza `end` en el último token (`:1663-1665`) |
| mutación | mutarray(0..20); luego (apéndice) Mutations flag, Mean/StdDev, WhatToChange | `sint(Mutations)`/`sint(LastMut)` §0.4; al cargar, defaults previos por si el archivo se corta (`:1669`) |
| identidad | SonNumber, parent, age, BirthCycle, genenum, generation, DnaLen, Skin, color | — |
| apéndices | body, Bouyancy, Corpse, waste/poison/venom, exist, Dead, FName, LastOwner (`"" → "Local"`), LastMutDetail, View, NewMove, **oldBotNum = slot al guardar** (`:2147`), Cant*/shell/Slime/VirusImmune/SubSpecies, spermDNA (si `fertilized ≥ 0`), 501×3 Longs de relleno (ancestros obsoletos, `:2168-2173`), sim, AbsNum, Multibot + tipo/b/k/NaturalLength de ties, OldGD, chloroplasts, `epimem(0..14)`, tag, sunbelt, NoChlr, multibot_time/Chlr_Share_Delay/dq, OldMutations, actvel | `LastMutDetail` con escape Int→Long (longitud 1 = centinela "viene un Long", `:2113-2132`, lector `:1711-1721`) |

Al cargar: `BucketPos` reseteado; `LoadRobot` llama `GiveAbsNum` **solo si
`AbsNum = 0`** (`:1595`) — los bots cargados conservan su AbsNum del archivo, y
`MaxAbsNum` viene del archivo de sim (o `MaxRobs` como default para sims viejas,
`:1417-1418`): un `.dbo` de otra sim puede introducir AbsNum duplicados
(**[SIN VERIFICAR]** el efecto sobre las comparaciones `parent`; acotado: solo se usan
para la inmunidad rota de `33-SHOTS.md §0.2` y displays).

## 3. Organismo (`.dbo`) — `SaveOrganism`/`LoadOrganism` (`:206-346`)

`cnum` (células, ≤50 vía `ListCells`) + `cnum` registros de bot (§2), con `LastOwner`
estampado al guardar. Al cargar: un `posto()` por célula, registro a registro;
especies desconocidas se auto-registran (`AddSpecie` con defaults `qty=5`,
`Stnrg=3000`, comentario "Species arrived from the Internet", tasas de mutación por
defecto, `:244-297`); recolocación relativa a la célula 0 (`PlaceOrganism`); y
**remapeo de ties por `oldBotNum`** (`RemapTies`, `:369-400`) con poda de ties cuyo
extremo no vino en el archivo. El error de E/S deshace el bot a medias (`:337-343`).

## 4. Simulación — `SaveSimulation`/`LoadSimulation` (`:513-849`, `:1073-1568`)

Arquitectura: `numOfExistingBots` + los registros de bot **densos** (solo existentes —
los números de slot cambian al cargar; por eso los shots y ties se remapean por
`oldBotNum`: `RemapAllTies`/`RemapAllShots`, `:402-441`, que además re-apunta
`virusshot` y libera shots huérfanos `:437`) + dos placeholders de cadena "null"
(campos abandonados) + la secuencia fija de `SimOpts` con sus capas históricas
("new stuff" … "even even newer newer stuff") + 5 pasadas por las especies (campos
repartidos por época) + `Costs(0..70)` + teleporters + obstáculos +
**`maxshotarray` registros de shot (vivos y muertos)** + `MaxAbsNum` + gráficas +
estado evo ⚙ + sol (`SunPosition`/`SunRange`/`SunChange`) + mareas + `stagnent`.

- El autosave "safemode" del tick (paso 25) usa este mismo formato.
- **El registro de especie guarda ruta + nombre, no el ADN** (RV-40). `loadrobs` y
  `aggiungirob` releen el `.txt` con `RobScriptLoad`. Si no está, `LoadDNA` lo busca
  por nombre en la carpeta común `Robots` y, si tampoco, abre un diálogo; al
  cancelarlo devuelve False (`DNATokenizing.bas:177-201`). Entonces
  `RobScriptLoad = −1` después de `posto`/`preparerob`, que ya consumieron sus 6 RNG,
  y la especie queda `Native = False`. Lo mismo vale para las especies de `AddSpecie`
  (path = `MainDir\robots`, donde no hay `.txt` de la especie nueva).
  - Port: `Specie::dnaMissing`, que marcan `LoadSimulation` y `AddSpecieFromFile`.
    El host hace de carpeta `Robots`: busca el ADN por nombre entre las especies de
    la sesión, los presets y el Bestiary (`db_sim_species_set_dna`). Lo que no
    encuentra se comporta como el `.txt` ausente.
- **`LoadSimulation` y `startloaded` no tocan los globales del proceso** (RV-39):
  - los del gset (`StartChlr`, `Disqualify`, `x_restartmode`, `intFindBestV2`,
    `hidePredCycl`, `LFOR` y los de mutación);
  - los de módulo de `F1Mode.bas`;
  - los flags de guardado y el apodo IM;
  - el Player Bot;
  - el `DeadRobots.snp` de disco.

  Tampoco los toca `StartSimul`. En el port, `db_sim_load` y `db_sim_round_carry`
  los traspasan (`CarryProcessGlobals`); los `Static` internos siguen la decisión de
  la `Sim` limpia.
- `SimGUID` ausente se regenera con **`Rnd` crudo** al cargar (`:1451`) — fuera del
  flujo `rndy`, una sola extracción, en carga (no en tick): cierra el resto de
  **Q01** para `HDRoutines` (el otro `Rnd`, `:1035`, es del modo torneo ⚙).
- `[PROBABLE BUG]` **el manejador de errores de `SaveSimulation` se llama a sí mismo**
  (`tryagain: SaveSimulation path`, `:847-848`): una ruta no escribible produce
  recursión infinita → agotamiento de pila del EXE.

## 5. Ajustes globales y RNG externo

`LoadGlobalSettings` (`:852-…`): defaults del programa (p. ej. `bodyfix = 32100`) y el
archivo de settings — los valores van a `constants.yaml` (B5). El modo `UseIntRnd`
(listas de números aleatorios en archivos, `Common.bas:229-245`) consume y **borra**
archivos de disco durante el tick y dispara autosaves (`savenow` a las 3900
extracciones) — ya señalado en `00-INVENTARIO.md §6` como incompatible con replays.

## 6. Resumen de `[PROBABLE BUG]`

1. **Recursión infinita al fallar el guardado de sim** (§4).
2. **`sint` envuelve en vez de saturar** (§0.4).
3. **El tag se contamina con el `nrg` al guardar en modo eco-IM** (§1).
4. **Riesgo estructural del centinela 254** (§0.1).
5. **Las `vars` 51..1000 se pierden** (§0.2).
6. **AbsNum importados sin deduplicar** (§2).
7. Heredado de A2: la ida-y-vuelta texto no es estable para ADN degenerado (`VOID`).

## 7. `[SIN VERIFICAR]`

- El efecto observable de AbsNum duplicados (§2) — acotado a la inmunidad filial ya
  rota y a la genealogía de display.
- La tolerancia real de `LoadSimulation` a archivos de versiones muy anteriores (las
  ramas de compatibilidad `:1073-1568` se especificarían campo a campo solo si el
  port decide importar sims antiguas, no solo bots).
- `SaveSimPopulation`/IM y las utilidades de torneo (`movetopos`, `deseed`…) — ⚙.

## 8. Preguntas que cierra

- **Q06 → RESUELTA** (§0.6).
- **Q01 → COMPLETA**: con `HDRoutines` (§4) y `Obstacles` (B7) cerrados, el inventario
  de consumidores de RNG dentro del tick está terminado; los únicos usos de `Rnd`
  crudo del motor son setup/carga (`AddRandomObstacles`, colores, `SimGUID`) y la UI.
- **Q14 → cerrada**: `MaxAbsNum` se persiste (`:759,1417-1418`); la parte de
  comparaciones queda documentada aquí y en `33-SHOTS.md §0.2-0.3`.
