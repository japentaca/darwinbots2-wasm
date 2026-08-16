# 33 — Disparos

> Documento B3a de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre: el ciclo de vida del shot, creación (`robshoot`/`newshot`/
> `createshot`), la colisión swept (`NewShotCollision`), los efectos por tipo, el
> decaimiento y la gestión del array. Los virus (tipo −7) y el esperma (−8) como
> mecanismos genéticos van en `35-VIRUS.md` y `36-REPRO.md`; aquí, su balística.
> La posición en el tick está en `10-CICLO.md §4`; las escrituras en `mem()` en
> `21-MEMORIA.md`. `[PROBABLE BUG]` = raro pero real.

---

## 0. Respuestas centrales

1. **Ciclo de vida**: nace en P5 (`Shooting` → `robshoot` → `newshot`), queda inerte
   hasta el `updateshots` del ciclo siguiente (paso 14); ahí **colisiona primero y se
   mueve después**; al golpear marca `flash` y muere al *inicio* del `updateshots`
   siguiente; sin golpe, muere cuando `age > Range` (`Shots.bas:310-405`).
2. **La inmunidad del recién nacido a los shots de su padre está rota**: compara
   `Shots(t).parent` (el **índice de slot** del tirador, `Shots.bas:111`) con
   `rob(h).parent` (el **AbsNum** del padre, `Robots.bas:302,2234`) —
   `Shots.bas:330`. Solo coincide mientras slot = AbsNum (los primeros bots de una sim
   recién sembrada); en cuanto los AbsNum divergen de los slots, la inmunidad
   desaparece. `[PROBABLE BUG]` de alto impacto ecológico.
3. **Un shot nunca golpea el slot que lo disparó** (`Shots(shotnum).parent <> robnum`,
   `Shots.bas:998`) — aunque el tirador haya muerto y el slot lo ocupe **otro bot**:
   los shots huérfanos son inofensivos para el nuevo inquilino. `[PROBABLE BUG]`.
4. **`.shoot` con un múltiplo positivo de 1000 dispara esperma**: `robshoot` hace
   `shtype Mod 1000` (`Robots.bas:1786`) → 0; `newshot` convierte tipo 0 en −8 vía
   `-(Abs(0) Mod 8) → 0 → −8` (`Shots.bas:117-122`). Los tipos negativos se pliegan
   `Mod 8` (−9 → −1, −16 → −8…) "para que las mutaciones hagan cosas interesantes".
5. **Cada disparo consume 2 extracciones de RNG, una de ellas desperdiciada**: `ran =
   Random(-2,2)/20` se calcula y **no se usa** (`Shots.bas:130`); la dispersión real es
   `Random(-20,20)/200` rad (`:146`). El orden del flujo aleatorio depende de ambas.

---

## 1. Estructura y gestión del array

`Type shot` (`Shots.bas:5-36`): todo `Integer`/`Single`/`Long` + `dna() As block` para
−7/−8. Campos clave: `value As Integer` (potencia o valor a escribir), `nrg`/`Range As
Single` (la energía marca el alcance), `memloc`/`Memval` (venom/poison dirigido),
`stored` (virus latente), `flash` (murió este ciclo).

- **Asignación de slots**: `FirstSlot` (`:265-277`) avanza el puntero global circular
  `shotpointer`; si el array se llena, crece un 10% (`ReDim Preserve`, `:102-106`).
- **Compactación** (`CompactShots`, `:426-456`): al final de cada `updateshots`, si la
  ocupación < 70% (y el array > 100), se empaquetan los vivos al frente y el array se
  recorta a `max(100, 1.2·numshots)` (`:414-423`). **Renumera los shots**: el único
  puntero externo, `rob().virusshot`, se re-apunta durante la pasada (`:436`); un shot
  almacenado cuyo dueño ya no existe se destruye aquí (`:438-441`).
- El chequeo `Shots(j).shottype` en `:444` mira el slot **destino** antes de copiarlo
  (vestigial: la asignación de UDT en `:447` copia el array `dna` entera igualmente).

## 2. Creación

### 2.1 `robshoot` (P5, `Robots.bas:1718-1864`)

Dispatch por `mem(shoot)` (tabla completa de consumo de `shoot`/`shootval` en A3). Los
multiplicadores de −1/−6: `shootval` positivo multiplica potencia, negativo multiplica
alcance; sobre 4 se pasa a escala logarítmica `Log(x/2)/Log(2)` cobrando `x·SHOTCOST`
(`:1733-1777`); si el coste supera la energía, se recorta al `nrg` disponible con el
multiplicador recalculado en log₂ (`:1768-1776`).

| Tipo | Contenido | Potencia/valor en el shot |
|---|---|---|
| ≥ 0 (`Mod 1000`) | escritura de memoria | `value = shootval` (±32000); coste `SHOTCOST` |
| −1 | petición de nrg | `value = (20 + body/5·(numties+1 si MB))·mult` |
| −2 | energía | `value = |shootval|` o `nrg/100` por defecto; **el shot lleva `nrg = value`** (`Shots.bas:193`); coste = valor + SHOTCOST/(numties+1) |
| −3 | venom | `value = min(|shootval|, venom)` o `venom/20`; drena venom |
| −4 | waste | `value = min(|shootval|, waste)` o `waste/20`; −99% waste, +1% pwaste |
| −6 | petición de body | `value = (10 + body/2·(…))·mult` |
| −8 | esperma | copia `dna` y `DnaLen` al shot (`Shots.bas:196-200`) |

−5 (poison) **no es disparable**: solo nace como rebote (`Robots.bas:1844`).

### 2.2 `newshot` (`Shots.bas:88-202`)

`val` clamp ≤32000 (sin suelo), `value = Int(val)`; captura `memloc = mem(835)` y
`Memval = mem(836)` del tirador **para todo shot** (`:124-127`); dirección: `aim`, o
invertida con `backshot`, o desviada con `aimshoot` (normalizado in place Mod 1256),
más el jitter de §0.5; posición en el perímetro (`pos + dir·radius`), corregida por
`actvel − vel` si `offset` (`:152-155`); velocidad = `actvel + dir·40` (`:158`).

**Energía y alcance**: si `vbody > 10` (el body virtual del organismo,
`Ties.bas:138,165`): `nrg = Log(vbody)·60·rngmult`, `Range = (nrg+41)\40` (división
entera, redondeo arriba), `nrg = Range·40` (`:162-171`); si no, `Range = rngmult`,
`nrg = 40·rngmult`. Para −2 la energía se pisa con `value` (`:193`).

### 2.3 `createshot` (`Shots.bas:205-261`)

La variante "partícula" usada por rebotes, `Decay` y poffs: posición/velocidad
explícitas, `nrg = Range+41` (o `val` si −2), `Range = (Range+41)\40`,
`memloc = mem(834)` del *emisor* (ploc — nota: `newshot` usa 835/vloc, `createshot`
834/ploc), `Memval = mem(839)` solo para −5 (`:257-259`).

## 3. `updateshots` — orden por shot (paso 14, `Shots.bas:288-425`)

Confirmación y detalle de `10-CICLO.md §4`:

1. `flash` → destrucción (`:310-314`).
2. Contabilidad: los −2 suman su `nrg` a `TotalSimEnergy` (`:319`).
3. Colisión (`NewShotCollision`, §4) salvo −100 (ornamental) y `stored` (`:321-325`).
4. Con golpe válido (h > 0, y no aplica la pseudo-inmunidad de §0.2):
   - **Decaimiento no lineal**: `nrg *= Atn(tempnum·40 − 40)/Atn(−40)` con
     `tempnum = age/Range` (`:333-347`) — cerca de 1.0 al principio, cae en picado en
     el último ~10% del recorrido. Exento: −2 con `NoShotDecay`, −4 con `NoWShotDecay`.
   - Tipo positivo: normalización `(t−1) Mod 1000 + 1`, salto de 340, bloqueo por
     poison con rebote −5 (`:350-366`; A3 §4).
   - Tipo negativo: dispatch a los efectos (§5).
   - `taste` sobre el golpeado con `opos` del shot (`:383`) y `flash = True`.
5. Rebotes/absorción contra formas (`DoShotObstacleCollisions`, `Obstacles.bas:411-432`).
6. Movimiento: `opos = pos; pos += velocity` (`:388-389`).
7. Envejecimiento (exenciones de decaimiento y `stored`, `:394-400`); muerte por
   `age > Range` si no hay `flash` (`:402-405`).

## 4. `NewShotCollision` (`Shots.bas:921-1081`)

1. **Bordes primero**: toroidal envuelve; rígido clampa y refleja la velocidad con
   `±Abs` (siempre hacia dentro, `:950-980`).
2. Búsqueda **lineal sobre todos los bots** (sin buckets), con prefiltro por caja
   `MaxBotShotSeperation = √(radioMax² + (2·MaxVelocity + 40)²)` calculado al iniciar
   la sim (`main.frm:1291`), exclusión del slot tirador y de `hidepred`.
3. Swept-sphere: posición del bot corregida a `pos − vel + actvel` (`:1010-1011`),
   cuadrática `|p + d·t| = r` con `d = vs − actvel_bot`; raíces en (0,1) exclusivo;
   gana el `t` menor entre todos los bots; si el shot ya está **dentro** del bot en
   t=0, golpe inmediato (`:1015-1020`).
4. Optimización con sesgo: si un golpe ocurre con `t ≤ 0.2` (`MinBotRadius`,
   `:48-51,1061`), se deja de buscar — un bot de índice mayor golpeado aún antes
   pierde. Sesgo por índice adicional al de `10-CICLO.md §0`.
5. Efecto lateral: `pos` del shot se recoloca en el punto de impacto (`:1075-1080`)
   para que los rebotes salgan de ahí.

## 5. Efectos por tipo (funciones `take*`/`release*`)

Potencia común (−3/−4/−5 y modo `EnergyExType` de −1/−6):
`power = value·nrg/(Range·40)` (×`EnergyProp` en −1/−6; sin `EnergyExType`,
`power = EnergyFix` fijo). Todas ignoran corpses salvo −6.

| Tipo | Función | Semántica exacta |
|---|---|---|
| −1 | `releasenrg` (`:505-598`) | sale si `nrg ≤ 0.5`; corpse: potencia ×0.5; si `poison > power` → rebote −5 con `power` y poison −= 0.9·power; si no → shot −2 de vuelta con `power` (90% de nrg, 1% de body del golpeado), velocidad = relativa + mitad de la del golpeado; si deja `body ≤ 0.5` o `nrg ≤ 0.5`: `Dead` y `Kills`+1 al tirador (sin clamp, A3 §7) |
| −2 | `takenrg` (`:721-756`) | 95% a nrg (overflow sobre 32000 → 10% del exceso a body), 4% a body, 1% a waste |
| −3 | `takeven` (`:758-815`) | conspecífico (por `FName`): absorbe como venom propio; si no: shell absorbe con ×25 de eficacia (`VenumEffectivenessVSShell`, shell −= power/20), el resto paraliza: `Paracount += power` (clamp 32000), `Vloc/Vval` del shot (`21-MEMORIA.md §6`) |
| −4 | `takewaste` (`:817-827`) | `waste += power`, sin techo aquí (el techo lo pone `HandleWaste` en P5) |
| −5 | `takepoison` (`:829-859`) | conspecífico absorbe; si no `Poisoncount += power/1.5`, `Ploc/Pval` |
| −6 | `releasebod` (`:599-718`) | shell absorbe (÷20); techo `(body·10)/0.8 + shell`; corpse: ×4 y todo de body; vivo: 20% de nrg + 8% de body con cascada del sobrante; shot −2 de vuelta; kills |
| −7 | `addgene` | virus — `35-VIRUS.md` |
| −8 | `takesperm` (`:862-874`) | fertiliza 10 ciclos, copia el ADN al `spermDNA` — detalles en B6 |

`Decay` (corpses, `:457-488`): cada `Decaydelay` ciclos, **1 RNG** (aim aleatorio) y un
shot −4 (`DecayType=2`) o −2 (`DecayType=3`) con `min(Decay, body)`; body −= Decay/10.
`defacate` (`:489-502`): shot −4 de 200 con coste `SHOTCOST/(numties+1)`.

## 6. Resumen de `[PROBABLE BUG]`

1. **Inmunidad filial slot-vs-AbsNum** (§0.2): funcional solo en sims recién sembradas.
2. **El slot tirador es intocable aunque cambie de dueño** (§0.3).
3. **`.shoot` múltiplo de 1000 → esperma** (§0.4); negativos plegados Mod 8.
4. **RNG desperdiciado en `newshot`** (§0.5) y `FirstSlot` llamado y descartado al
   entrar en `releasenrg` (`:527`) — avanza `shotpointer` sin usarlo.
5. **El early-exit `MinBotRadius`** (§4.4) añade sesgo por índice a la resolución de
   impactos simultáneos.
6. **`takewaste` sin techo inmediato**: waste puede superar 32000 hasta el `HandleWaste`
   del golpeado (P5), visible entretanto para `defacate`/`altzheimer` en gates.

## 7. `[SIN VERIFICAR]`

- Valores por defecto de `EnergyExType`/`EnergyProp`/`EnergyFix`, `SHOTCOST`,
  `Decay`/`Decaydelay`/`DecayType` → B5 (`constants.yaml`).
- El comportamiento del prefiltro `MaxBotShotSeperation` si `MaxVelocity` cambia en
  caliente (se calcula solo al iniciar/cargar): shots rápidos podrían atravesar el
  prefiltro — cruza con la UI de opciones, no con el core.

## 8. Preguntas que alimenta

- **Q01**: 2 RNG por `newshot` (uno muerto), 1 por `Decay`-evento, re-tiradas de
  `Vloc`/`Ploc` (A3).
- **Q03**: `Shots(0)` existe y no se usa (los bucles van de 1 a `maxshotarray`;
  `FirstSlot` arranca en `shotpointer ≥ 1`) — mismo patrón que `rob(0)`.
- **Q14**: la comparación rota de §0.2 es exactamente la cita `Shots.bas:330` que Q14
  señalaba; queda documentada aquí.
