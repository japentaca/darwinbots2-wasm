# 50 — El mundo

> Documento B7 de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre: el campo y sus topologías, la economía vegetal (repoblación, sol,
> día/noche), los teleporters (cierra Q10), las formas como entidades del mundo, y el
> deslinde de la capa de torneo ⚙. La física de bordes/formas está en `30-FISICA.md`;
> la visión de formas en `32-VISION.md`; los formatos de disco en B8.
> `[PROBABLE BUG]` = raro pero real.

---

## 0. Respuestas centrales

1. **La repoblación vegetal no cuenta vegetales: cuenta cloroplastos.** El gate del
   paso 20 del tick es `TotalChlr < CLng(SimOpts.MinVegs)` con
   `TotalChlr = Σ chloroplasts / 16000` (`Master.bas:384-394`) — "MinVegs" es un umbral
   en unidades de 16000 cloroplastos, no en bots. Un campo lleno de vegetales pobres en
   cloroplastos repuebla igual.
2. **Q10 resuelta — los teleporters mueven organismos, no bots**: la salida
   (`Out`/`Internet`) **guarda el organismo entero a disco y lo mata**
   (`SaveOrganism` + `KillOrganism`, `Teleport.bas:174-178`); la entrada
   (`In`/`Internet`) sondea un directorio y **carga archivos `.dbo`**
   (`LoadOrganism`, `:388-447`); el `local` re-posiciona el organismo en un punto
   aleatorio del campo (`ReSpawn`, 2 RNG, `:186-189`). Todo es E/S de disco dentro del
   tick, y un archivo extraño dispara un **`MsgBox` modal en mitad del ciclo**
   (`:409,439`).
3. **El sol es una banda vertical móvil** (con `SunOnRnd`): `SunPosition`/`SunRange`
   derivan ±0.0005/ciclo con cambios de rumbo sorteados 1/2000 (**2 RNG por ciclo**,
   `Vegs.bas:44-65`); solo los bots con cloroplastos dentro de la banda comen
   (`:225`). Sin `SunOnRnd` la banda inicial no se mueve. Los umbrales de energía
   total (`SunUp`/`SunDown`, 3 modos) pueden forzar día o noche (`:85-133`).
4. **La capa de torneo es separable y está entretejida**: `hidepred` filtra
   `FName = "Base.txt"` en *cada* bucle del motor; `x_restartmode`, `Disqualify`/`dq`,
   `reprofix`, los modos ZeroBot y la liga F1 (`Evo.bas` 740 LOC, `F1Mode.bas` 528 LOC)
   cuelgan de los pasos 3, 8-9, 22 y 26 del tick y de guardas dispersas. El port puede
   omitirla entera **si además omite sus gates** (un `hidepred` siempre-False hace los
   filtros transparentes).
5. **Q05 resuelta**: `NodeSpeedThings.bas` está **100% comentado** — era el índice
   espacial `Roborder` (bots ordenados por X) del sistema de visión previo a los
   buckets (los `Checkleft`/`Checkright`/`proximity` comentados de `Senses.bas:519-740`
   eran sus consumidores). Diseño abandonado; cero código vivo.

---

## 1. El campo

`FieldWidth`/`FieldHeight As Long` (`SimOptions.bas:67-68`); topología por eje:
`Dxsxconnected`/`Updnconnected` (el flag `Toroidal` del struct es solo el resumen de
UI, `:78-81`). Bordes rígidos o envolventes en `30-FISICA.md §5` (bots),
`33-SHOTS.md §4` (shots), `Teleport.bas:327-368` (teleporters). La escala sysvar
(`xpos`/`ypos` 0..32000) usa `xDivisor = FieldWidth/32000` (`main.frm:1252-1256`,
ya citado en A2/A3).

## 2. Economía vegetal

### 2.1 Repoblación (paso 20 → `VegsRepopulate`, `Vegs.bas:23-38`)

Acumulador `cooldown` +1 por ciclo elegible; al alcanzar `RepopCooldown`, añade
`RepopAmount` vegetales y descuenta el umbral (el resto se conserva — repoblación
"con deuda"). **`cooldown` arranca en `−RepopCooldown`** al iniciar una sim
(`main.frm:1507`): la primera repoblación tarda el doble. Cada vegetal:
`aggiungirob −1, Random(60, W−60), Random(60, H−60)` — pero **esas coordenadas se
descartan**: con `r = −1`, `aggiungirob` re-sortea la especie vegetal (re-tiradas hasta
`checkvegstatus`) **y re-sortea la posición** con `fRnd` dentro del área de la especie
(`Globals.bas:410-415`). `[PROBABLE BUG]` de intención: los dos `Random` del llamador
son puro consumo de RNG.

`aggiungirob` (`Globals.bas:395-505`): `RobScriptLoad` (E/S de disco + 6 RNG de
`preparerob`), y después **pisa** lo que el cargador sembró: `Erase mem` (borra
`mem(336)/mem(339)` incluidos, re-publicados al final `:488-489`), body = 1000,
`nrg = Stnrg` de la especie, cloroplastos = `StartChlr` si vegetal, `aim` aleatorio
(1 RNG), generation 0, `parent = 0`, flags de especie, `makeoccurrlist`. El timer
epigenético queda en 0 (a diferencia de los fundadores de `loadrobs`,
`21-MEMORIA.md`). Total = **12 RNG por vegetal repoblado** con una sola tirada de
especie (2 descartados + 1 especie [+1 por re-tirada] + 2 posición + 6 preparerob +
1 aim). *(Corregido en el Bloque C: la cifra "≈10-11" original no sumaba su propia
enumeración; derivación completa en `70-CASOS-DORADOS.md` R-08.)*

### 2.2 El sol (paso 21 → `feedvegs`, `Vegs.bas:41-271`)

En orden: deriva del sol (§0.3, solo `SunOnRnd`) → decisión día/noche — umbrales de
energía total con 3 modos (`TEMPSUNSUSPEND=0` fuerza solo este ciclo,
`PERMSUNSUSPEND=1` bascula entre umbrales, `ADVANCESUN=2` acelera el reloj), si no el
reloj `DayNightCycleCounter`/`CycleLength` (`:135-147`) → `mem(218) = 0` para todo
vivo → si no toca comer, fin. Si toca:

- `LightAval = Σ(radio²π) / (área del campo − formas)`, clamp ≤1 (`:168-186`) —
  **solo se recalcula en ciclos con sol** (la `mem(923)` nocturna es rancia, A3).
- Corrección de área `(1 − LightAval)² · 4`; banda solar
  `[SunPosition ± (0.25 + SunRange³·0.75)/2] · FieldWidth` con lógica de envoltura
  (`:196-210`).
- Por bot vivo con nrg > 0: sin cloroplastos, solo `mem(218) = 1`. Con cloroplastos y
  dentro de la banda: `tok = LightIntensity/depth^Gradient` en pondmode
  (profundidad = `pos.y/2000 + 1`) o `MaxEnergy` plano; `/3.5`; ganancia
  `(AreaCorr · chlr/16000 · 1.25 − (chlr/32000)²) · tok`; impuesto por edad
  `age·chlr/1e9`; con mareas ×`(1 − BouyancyScaling)`; reparto
  nrg/body según `VegFeedingToBody` (body ÷10), caps 32000 (`:213-269`).

### 2.3 Digestión de waste (`feedveg2`, P5 vía `HandleWaste`, `Vegs.bas:273-325`)

Para todo bot con waste y cloroplastos: **1 RNG** decide el orden nrg-primero /
body-primero; cada mitad convierte waste en `chlr/64000`-escalado si no rebasa 32000.
El orden importa: la segunda conversión ve el waste ya reducido.

## 3. Teleporters (Q10)

Array `Teleporters(10)` (`Teleport.bas:53-58`). Cuatro roles combinables por flags:
`Out`, `In`, `local`, `Internet` (con rutas IM propias). Filtros por clase de bot:
`teleportVeggies`/`teleportCorpses`/`teleportHeterotrophs`.

- **Salida** (`CheckTeleporters`, P0a de `UpdateBots`, `Robots.bas:1508-1512`): la
  colisión es un círculo de radio `Width/2 + radius` sobre el **centro** del
  teleporter (`:198-210`). El bot (con `dq > 1`, forzado aunque no toque) se serializa
  a `<fecha><hora><FName><i><contador>.dbo` y **`KillOrganism`** — las células atadas
  mueren con él sin generar poffs. Los puertos `Internet` solo expulsan cuando
  `PollCountDown ≤ 0` — **la tasa de salida queda ligada al contador de sondeo de
  entrada** (`:164`). `[PROBABLE BUG]`.
- **Local**: `ReSpawn` del organismo a un punto uniforme del campo (2 RNG, `:187-189`).
- **Entrada** (`TeleportInBots`, paso 18 del tick): cada `InboundPollCycles` ciclos
  sondea el directorio y carga hasta `BotsPerPoll` archivos `.dbo` (borrándolos del
  disco); los `Internet` entran en posición aleatoria (2 RNG por organismo). Gate
  global: `SpeciesNum > 45` suspende toda entrada (`:383`). Errores de E/S abandonan
  el teleporter del ciclo (`On Error GoTo abandonthiscycle`).
- **Movimiento** (paso 18): `DriftTeleporter` — 1 RNG por eje con drift — con tope
  `MaxVelocity/4`; `MoveTeleporter` — **solo traslada si ambos flags de drift están
  activos** (`:320`), aunque la deriva haya acumulado velocidad con uno solo
  `[PROBABLE BUG]`; rebote (±10% MaxVelocity) o envoltura toroidal en los bordes; el
  `center` usado para colisión está en `(x + W/2, y + H·0.3)` (`:323-324`) — el 0.3
  responde al dibujo del sprite, no a la geometría.

## 4. Formas (mundo)

Creación: manual (UI), `AddRandomObstacles` (usa `Rnd` **crudo**, no `rndy` — fuera del
flujo reproducible, `Obstacles.bas:243-247`), y los generadores de laberintos
(`DrawHorizontalMaze`/`Vertical`/`Checkerboard`/`PolarIce`/`Spiral`/`TrashCompactor`,
`:45-181`) que sí usan `Random` (rndy) para las aberturas. Colores aleatorios con
`Rnd` crudo (`:201`). En el tick (paso 18, `MoveObstacles`, `:322-350`): deriva
opcional — **2 RNG por eje con drift por forma** (`Random(...)·Rndy·0.01`,
`:358-361`) — con clamps al campo, más la lógica del compactador (`:146-155`).
Cierra el resto de **Q01** para `Obstacles.bas`: sin drift activado, cero RNG.

`SimOpts` de formas: `shapesAreVisable`/`SeeThrough`/`AbsorbShots`,
`shapeDriftRate`, transparencia/negro (render). El "EGrid" del struct
(`EGridEnabled`/`EGridWidth`, `SimOptions.bas:181-183`) no tiene consumidores vivos
(`InitEGrid` comentado, `main.frm:1503-1504`) — vestigial.

## 5. La capa de torneo ⚙ (deslinde)

Inventario de acoplamientos que el port debe *anular*, no implementar:

| Mecanismo | Dónde toca el núcleo |
|---|---|
| `hidepred` + `FName="Base.txt"` | filtro en ExecRobs, todas las pasadas de UpdateBots, buckets, shots, feedvegs |
| `Disqualify`/`dq`/`dreason` | guardas en makeshell/makeslime/venom/poison/ties/shots/repro (marcan `Dead` o expulsan `dq>1` por teleporter) |
| `reprofix` | mata reproductores con `per < 3` |
| `x_restartmode` (1=restart, 7/8=ZeroBot, 9=test) | paso 26 del tick |
| `Evo.bas`/`F1Mode.bas` | pasos 3, 8-9, 22; contadores de contienda; `Contest_Form` |
| Player Bot Mode | paso 13 (overrides de memoria) |

Sus mecánicas internas quedan **fuera de la spec del core** (documentadas aquí solo
como interfaz); si un caso dorado los necesitara, se especificarían entonces.

## 6. Resumen de `[PROBABLE BUG]`

1. **Las coordenadas de `VegsRepopulate` se descartan** (§2.1) — 2 RNG muertos por
   vegetal y la posición real la decide el área de la especie.
2. **Salida a internet acoplada al contador de entrada** (§3).
3. **Teleporter con un solo eje de drift acumula velocidad que nunca aplica** (§3).
4. **`MsgBox` modal dentro del tick** al encontrar archivos extraños (§0.2) — congela
   la simulación hasta el clic (interacción con `10-CICLO.md §9`).
5. **`AddRandomObstacles` y los colores usan `Rnd` crudo** — mezclan un flujo aleatorio
   ajeno a `rndy` (irrelevante para replays si solo se usan en setup, pero es la única
   vía del motor que salta el choke point aparte de la UI).
6. **La primera repoblación tarda `2×RepopCooldown`** (§2.1).

## 7. `[SIN VERIFICAR]`

- `SaveOrganism`/`LoadOrganism` (formato `.dbo`, remapeo de ties `oldBotNum`) — B8.
- `checkvegstatus` (criterio exacto de "especie vegetal elegible") — se cita su rol;
  el detalle vive con las especies en B8/UI.
- La mecánica interna de `Evo.bas`/`F1Mode.bas` (fuera del alcance del core, §5).

## 8. Preguntas que cierra o alimenta

- **Q05 → RESUELTA** (§0.5).
- **Q10 → RESUELTA** (§3): crean/destruyen bots vía disco, en P0a (salida/local) y
  paso 18 (entrada); consumen RNG (drift 1-2/teleporter/ciclo, 2/evento local,
  2/organismo entrante por internet).
- **Q01 → cerrada para `Obstacles.bas`** (§4): solo con drift activado
  (2/eje/forma/ciclo); `HDRoutines.bas` queda para B8.
