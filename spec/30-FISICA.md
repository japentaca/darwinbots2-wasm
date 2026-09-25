# 30 — Física

> Documento B1 de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre: masa y radio, el pipeline de fuerzas de la pasada P1, colisiones
> bot-bot (buckets + `Repel3`), colisiones con formas, bordes del campo, integración
> (`UpdatePosition`) y rotación (`SetAimFunc`/`TieTorque`). La posición de cada llamada
> dentro del tick está en `10-CICLO.md §5` y no se re-deriva; los efectos sobre `mem()`
> están en `21-MEMORIA.md`/`sysvars.yaml`. La spec describe el EXE. **Corrección
> 2026-08-16** (`00-INVENTARIO.md §1`): el EXE compila **con** chequeos (flags `=0` =
> casilla sin marcar); EXE ≈ IDE y los errores runtime truncan el tick
> (`10-CICLO.md §14`). `[PROBABLE BUG]` = raro pero real.

---

## 0. Respuestas centrales

1. **Integración de Euler semi-implícita con paso 1, en dos tiempos.** Las fuerzas se
   acumulan en P1 como *impulsos* (`ImpulseInd`/`ImpulseRes`, sin dt explícito:
   "timestep = 1", `Physics.bas:84-86`); en P3 `UpdatePosition` hace
   `vel += ImpulseInd/(mass+AddedMass)`, clampa `|vel| ≤ MaxVelocity` y `pos += vel`
   (`Robots.bas:839-847`). Pero **fricción cinética y arrastre no pasan por los
   impulsos: mutan `vel` directamente en P1** (`Physics.bas:103,153`) — el orden de
   fuerzas dentro de `NetForces` es observable.
2. **Todo es `Single`.** No hay `Double` en el estado físico (`vector` =
   2×`Single`, `Common.bas:11-14`). Los autores lucharon contra el FP a mano: guardas
   de underflow `0.0000001` por todas partes (`Physics.bas:31-32,95,100,138,143`),
   `VectorMagnitude` con formulación estable `max·√(1+(min/max)²)` (`Common.bas:144-156`).
   **Ojo con los intermedios** (revisión RV-05/RV-06, `REVISION-PORT.md`): el estado es
   `Single`, pero `Sqr`/`Sin`/`Cos`/`^` devuelven `Double`, los literales con decimales
   (`0.99`, `0.1`, `1#`) son `Double` y `SimOpts.Density`/`Viscosity` son `Double`
   (`SimOptions.bas:134-135`): esas expresiones se evalúan en `Double` y se redondean
   una sola vez al asignar.
3. **La biblioteca de vectores tiene clamps ocultos que MUTAN sus argumentos.**
   `VectorScalar` clampa `k` y los componentes de `V1` a ±32000 **in place** (ByRef,
   `Common.bas:125-131`); `VectorMagnitudeSquare` clampa los componentes de su argumento
   (`Common.bas:171-175`). Cada uso es un clamp lateral sobre el estado real del bot
   (p. ej. `UpdatePosition` clampa `vel` a ±32000/eje al medir su magnitud,
   `Robots.bas:841`). Un port con una librería "pura" diverge.
4. **La masa incluye los cloroplastos y llega a 32000**:
   `mass = body/1000 + shell/200 + (chloroplasts/32000)·31680`, clamp `1..32000`
   (`CalcMass`, `Physics.bas:44-52`). Un vegetal cargado de cloroplastos es ~165× más
   masivo que un bot de puro body. Varios subsistemas usan un **tope de 192** al cobrar
   o gravitar (`Physics.bas:398,593`).
5. **Cada par de bots colisiona una sola vez por ciclo** (índice menor manda,
   `Quads.bas:259`), con teste de solape sobre las posiciones del **final del ciclo
   anterior** (P1 corre antes que el movimiento de P3). `Repel3` responde con impulso
   elástico paramétrico (`CoefficientElasticity`) + separación posicional directa, y
   dispara los sentidos de contacto y los refvars de ambos bots en el acto
   (`Physics.bas:963-973`).

---

## 1. Estado físico del bot

Todos `Single` salvo indicación (`Robots.bas:194-213`): `pos`, `opos` (guardada en el
paso 15 del tick), `vel`, `actvel` (= `pos − opos`, paso 17), `ImpulseInd` (fuerzas
independientes), `ImpulseRes` (resistivas), `ImpulseStatic` (escalar de fricción
estática), `AddedMass`, `aim`/`aimvector`, `ma` (momento angular), `mass`, `radius`,
`Bouyancy` (0..1).

Reset por ciclo: `ImpulseInd/Res/Static` se ponen a 0 en `UpdatePosition` **después** de
aplicarse (`Robots.bas:855-857`), para bots fijos y libres por igual ("to avoid build up
of forces in case fixed bots become unfixed").

### 1.1 Masa y masa añadida

- `CalcMass` (P1, `Physics.bas:44-52`): fórmula de §0.4. El clamp inferior es **1**
  ("stops the Euler integration from wigging out").
- `AddedMass` (P0b, solo si `Density ≠ 0`, `Physics.bas:54-70`):
  `0.5 · Density · (4/3)π · radius³` — masa de fluido desplazado, sumada a la inercia en
  `UpdatePosition` y en la fricción, **no** a la gravedad.
- `UpdatePosition` re-fudgea: si `mass + AddedMass < 0.25`, `mass = 0.25 − AddedMass`
  (`Robots.bas:834`) — con el clamp de `CalcMass` a ≥1 solo puede dispararse si
  `AddedMass` es negativa, que no ocurre (Density ≥ 0). Vestigial.

### 1.2 Radio

`FindRadius` (`Robots.bas:716-740`): si `FixedBotRadii`, constante `half = 60`. Si no:
`(Log(body)·body·905·3·0.25/π)^(1/3)`, con `body` suelo 1; después los cloroplastos lo
empujan hacia 415: `radius += (415 − radius)·chlr/32000`; suelo final 1. El parámetro
`mult` escala body/cloroplastos (usado por `Reproduce` para el `sondist`);
`mult = −1` = radio de un bot de body 32000 sin cloroplastos.

---

## 2. El pipeline de fuerzas — `NetForces` (P1, solo bots no fijos)

Gate del llamador: `If Not rob(t).Fixed Then NetForces t` (`Robots.bas:1544`) — **un bot
fijo no recibe ninguna fuerza**, ni siquiera voluntaria (pero sí gira: `SetAimFunc`
corre en P3 igualmente). Orden exacto dentro de `NetForces` (`Physics.bas:23-42`):

| # | Fuerza | Actúa sobre | Fórmula exacta |
|---|---|---|---|
| 0 | flush de underflow | `vel` | ejes con `|v| < 1e-7` → 0 (`:31-32`) |
| 1 | `PlanetEaters` (si activo) | `ImpulseInd` de **ambos** | gravedad O(n²) por pares `t = n+1..MaxRobs`: `F = G·min(m1,192)·min(m2,192)/d²` sobre la línea de centros (`:575-604`). Bots de índice menor la ejercen primero |
| 2 | `FrictionForces` (si `Zgravity ≠ 0`) | `vel` y `ma` **directamente** | `ImpulseStatic = m·Zg·CoefStatic`; cinética `= m·Zg·CoefKinetic`, capada a `|vel|`, restada del vector `vel`; y **reduce `ma`** linealmente: `ma·(48−I)/48`, 0 si `I ≥ 48` (`:84-103`) |
| 3 | `SphereDragForces` (si `Density ≠ 0` y hay vel) | `vel` y `ma` directamente | `I = 0.5·Cd·ρ·v²·π·r²` con `Cd` por tramos de Reynolds (`SphereCd`, `:306-341`); capado a `0.99·v`; restado de `vel`. `ma` → 0 salvo `Density < 1e-6` (`:132-139`) |
| 4 | `BrownianForces` (si `PhysBrown ≠ 0`) | `ImpulseInd` y `ma` | **3 extracciones de `rndy`**: `I = PhysBrown·0.5·rndy`; ángulo `rndy·2π`; `ma += (I/100)·(rndy−0.5)` (`:113-117`) |
| 5 | `GravityForces` | `ImpulseInd` (o `nrg`) | normal: `+Ygravity·mass` en Y (`:391`). En pondmode no-toroidal con `Ygravity ≠ 0`: la flotabilidad **cobra energía** (`Ygravity/PhysMoving·min(mass,192)·MOVECOST·COSTMULTIPLIER·Bouyancy`, `:398`) y el signo de la gravedad depende de la profundidad relativa a `1/BouyancyScaling` (mareas, `:401-405`) |
| 6 | `VoluntaryForces` | `ImpulseInd` y `nrg` | ver §2.1 |

Después, fuera de `NetForces` pero aún en P1 (`Robots.bas:1545-1558`):
`BucketsCollision` (§4), la corrección de fricción estática — si el bot está quieto y
`ImpulseStatic > |ImpulseInd|` (proyectada por `Cross` si se mueve), `ImpulseInd = 0` —
y `ImpulseInd −= ImpulseRes` (las resistivas acumuladas por bordes y formas).

### 2.1 Fuerzas voluntarias — `VoluntaryForces` (`Physics.bas:409-463`)

Gate: no corpse, no `DisableMovementSysvars`, no `DisableDNA`, existe, y algún `dir* ≠ 0`.
`dir = (dirup−dirdn, dirsx−dirdx)` en `Long` (sin overflow de la resta), multiplicado
por `mass` salvo `NewMove` (=1). Se proyecta al marco del bot
(`Dot/Cross` con `aimvector`), se **clampa la magnitud a `MaxVelocity`** (`:438-440`) y
se acumula `ImpulseInd += NewAccel·PhysMoving`. Coste: `|NewAccel|·MOVECOST·
COSTMULTIPLIER`, capado a `nrg` por arriba y a **−1000** por abajo (costes negativos =
regalo de energía limitado, `:452-458`).

Nota heredada de A2/A3: los `dir*` los borra `UpdatePosition` en P3; `VoluntaryForces`
los lee en P1 del **mismo** ciclo en que el ADN los escribió (paso 10).

---

## 3. Ties como restricciones — `TieHooke` y `TieTorque` (P1)

### 3.1 `TieHooke` (`Physics.bas:465-555`) — también el ciclo de vida de la tie

Corre para todo bot existente (gate solo `numties = 0`). Por tie, en orden:

1. **Purga de ties inválidas**: si el bot apuntado no existe o está fuera del array
   (`CheckRobot`, `:558-573`), borrado in situ con corrimiento y actualización de
   `mem(TIEPRES)` (`:494-510`). Nota: `CheckRobot(0) = False` — una tie con `pnt = 0`
   corta el `While` antes.
2. **Rotura por longitud**: si `length − r1 − r2 > 1000`, `DeleteTie` (`:517-518`).
3. **Reloj de la tie** (`last`): `> 1` decrementa (cuenta atrás a la muerte; al llegar
   a 1, `DeleteTie`, `:521,525-526`); `< 0` incrementa (cuenta atrás al endurecimiento;
   al llegar a −1, `regang` la convierte en tipo 3 "hueso" y marca multibot,
   `:522,529`; `Ties.bas:977-1008`). Las ties de nacimiento nacen con `last = 100`
   (`Robots.bas:2380`); las de `.tie` con `last = −20` (`Robots.bas:1435`).
4. **Muelle amortiguado** con zona muerta: `displacement = NaturalLength − length`;
   si `|displacement| > 20` (deformación libre, `:487,537`), se recorta en 20 y
   `ImpulseInd += uv·(k·displacement) + uv·(−b·(Δvel·uv))` (`:539-545`). Solo actúa
   sobre el bot `n`; el otro extremo recibe su propia mitad cuando su índice pasa por
   TieHooke — **las fuerzas de una tie se aplican en dos momentos distintos de la
   pasada**, con los valores de `vel` ya actualizados por el extremo anterior.
   Constantes: springs nuevas `k=0.01, b=0.02` (`Ties.bas:932-933`); endurecidas
   `k=0.05, b=0.1` (`Ties.bas:983-984`); `stifftie` las reescala (`Ties.bas:268-271`).

### 3.2 `TieTorque` (`Physics.bas:651-729`) — gate: no corpse, no DisableDNA

Para cada tie con ángulo fijado (`angreg`): calcula el error angular
`mm = AngDiff(AngDiff(anl, aim), ang + bend)`, resetea `bend = 0` (`:681`), y si
`|mm| > 5°` aplica un par: `m = (|mm|−slack)·sgn·0.1`,
`na = (−sin anl, −cos anl)·m·dist/10`, con clamp por componente a ±100 (`:693-694`);
`ImpulseInd += TorqueVector` en el bot y `−TorqueVector` en el atado (`:699-700`).
El acumulado `mt` alimenta el momento angular: `ma = mt` (clamp ±π/4, `:715-719`).

`[PROBABLE BUG]` doble aquí:
- El clamp de `nay` usa el signo de **`nax`**: `If Abs(nay) > 100 Then nay = 100 * Sgn(nax)`
  (`:694`) — con pares fuertes el componente Y del torque toma el signo del X.
- Si `|mt| > 2π`, ejecuta `.Ties(j).ang = dlo` (`:712`) con **`j` apuntando una posición
  después de la última tie** (el `While` terminó con `Ties(j).pnt = 0`): escribe el
  ángulo en un slot de tie vacío (o, si el bot tuviera las 10 ties, en `Ties(11)`,
  fuera del array declarado `Ties(10)` — error 9 también en el EXE, chequeos activos
  → truncamiento del tick, `10-CICLO.md §14`; con el máximo real de 9 ties de
  `maketie` la escritura cae dentro). `dlo` y `n` conservan los valores de la última
  tie `angreg` del bucle.

---

## 4. Colisiones bot-bot: buckets y `Repel3`

### 4.1 El particionado (`Quads.bas:1-271`)

Rejilla de celdas de **4000×4000 twips** (`BucketSize`, `Quads.bas:6` — comentario: la
visión máxima 3348 + 2 radios cabe en una celda). `Buckets(x,y)` guarda un array
empaquetado de índices de bot terminado en −1, que crece de 5 en 5 y se encoge de 50 en
50 (`Add_Bot`/`Delete_Bot`, `:107-172`). `UpdateBotBucket` migra al bot cuando cambia de
celda, clampando a la rejilla si está fuera del campo (`:65-105`). Se llama desde
`UpdatePosition` (tras mover), `posto`/`KillRobot`, e `Init_Buckets` al (re)crear el
mundo.

**Consecuencia de orden**: en P1 la detección usa los buckets del final del ciclo
anterior (la migración ocurre en P3), coherente con que las posiciones tampoco han
cambiado aún.

### 4.2 Detección (`BucketsCollision`, `Quads.bas:223-271`)

Por bot: su celda + hasta 8 adyacentes (lista precalculada). Solo pares
`robnumber > n` (una vez por par); filtro `hidepred`; solape si
`|Δpos|² < (r1+r2)²` — con `VectorMagnitudeSquare` **clampando `Δpos` a ±32000/eje in
place** (inofensivo: es una copia local). No hay colisión contra corpses…no: los corpses
**sí** están en buckets y colisionan (ningún filtro `Corpse`).

### 4.3 Respuesta (`Repel3`, `Physics.bas:845-976`)

1. **Separación posicional directa** (antes de tocar velocidades):
   - ambos fijos, o ambos casi quietos (`|vel| < 1e-4`): cada uno retrocede la mitad
     del solape (`:882-887`);
   - si no: retroceso suavizado `solape/(1 + 55^(0.3−e))` repartido por masas
     **invertidas** (el ligero se mueve más, `:889-894`).
2. **Impulso elástico 1-D sobre la línea de centros** con
   `e = CoefficientElasticity`: proyecciones `Dot(vel, unit)·0.99` con pisos
   `±1e-6` para no re-acelerar bots que ya se separan (`:916-929`); fórmula clásica de
   choque con masas (`:933-934`), tratando al fijo como masa 32000 (`:904-905`); la
   nueva `vel` solo se aplica a los no fijos (`:954-960`).
3. **Efectos sensoriales inmediatos en ambos**: `touch` (contacto), `lasttch`,
   `lookoccurr` cruzados (`:963-973`) — por eso una colisión puebla refvars sin mirar.

### 4.4 Colisiones con formas (`DoObstacleCollisions`, `Obstacles.bas:434-553`, P1)

Por forma solapada (`ObstacleCollision`: AABB vs radio como caja): empuja al bot por el
borde más cercano — recoloca `pos` al borde y acumula `ImpulseRes` de amortiguación
(`vel·0.5`) o de muelle (`dist·0.5`) — con histéresis por `LastPush` para no alternar
ejes. A la **tercera** colisión simultánea aplica el anti-atasco: un salto de ±200 por
eje con signo tomado de `TotRunCycle Mod 40/50` (`:456-460`) — determinista, no consume
RNG. Toca sentidos: `touch` en el lado del golpe y, si no ve nada (`EYEF = 0`),
`mem(REFTYPE) = 1` (`:529-531`). Los disparos rebotan o se absorben en
`DoShotObstacleCollisions` (`:411-432`, desde `updateshots`).

---

## 5. Bordes del campo — `bordercolls` (P1, `Physics.bas:774-841`)

Solo actúa si el bot está a menos de `radius` de un borde. Por eje:

- **Toroidal** (`Dxsxconnected`/`Updnconnected`): `ReSpawn` al borde opuesto (con margen
  `radius + 50`). `ReSpawn` es la rutina multibot (`Multibots.bas:9-49`): **traslada el
  organismo entero** (hasta 50 células conectadas, `ListCells`) el mismo desplazamiento,
  y sincroniza `opos = pos` de cada célula (para que `actvel` no registre el salto).
  La célula de referencia es la más cercana al destino; `Min` es `Single`, así que
  entre distancias casi empatadas gana la última (RV-09).
- **Rígido**: `mem(214) = 1`, la posición se clampa al borde y se acumula
  `ImpulseRes += vel·0.05` (amortiguador; el término de muelle `k=0.4` está comentado,
  `:812,833`).

---

## 6. Integración — `UpdatePosition` (P3, `Robots.bas:826-879`)

Ya descrita en A1/A3 por sus efectos; la física exacta:

```
si no Fixed:
  vel += ImpulseInd · 1/(mass + AddedMass)
  si |vel|² > MaxVelocity²:  vel = unit(vel)·MaxVelocity     ' clamp de velocidad
  pos += vel
  UpdateBotBucket
si Fixed: vel = (0,0)
ImpulseInd = ImpulseRes = (0,0); ImpulseStatic = 0            ' siempre
si ZeroMomentum: vel = (0,0)
```

`MaxVelocity As Single`, forzado a 40 si sale de (0,200] al cargar
(`HDRoutines.bas:1298-1300`; `SimOptions.bas:153`). El clamp usa
`VectorMagnitudeSquare(vel)` — que además clampa `vel` a ±32000/eje in place (§0.3).

## 7. Rotación — `SetAimFunc` (P3, `Robots.bas:774-822`)

Prioridad: si `mem(SetAim) ≠ Round(aim·200)`, el `.setaim` del bot manda (giro absoluto
con `AngDiff`+`angnorm` y un término `diff2` que compensa vueltas completas,
`:786-788`); si no, giro relativo `aimsx − aimdx`. Coste
`|Round((diff+diff2)/200,3)|·TURNCOST·COSTMULTIPLIER` (`:792`). Los `Round` reciben
un `Variant` `Single` (el argumento se redondea a `Single` antes de redondear, RV-07) y
el coste es aritmética `Variant` en `Single` en cada producto (RV-08); el
`CInt(aim·200)` de `:819` no pasa por `Single`. El resultado se
normaliza Mod 1256 → radianes, y **se le suma el momento angular** `ma` (clampado a
±2π por wraps, `:799-802`). El giro voluntario puede *cancelar* `ma` (si tienen signos
opuestos) pero nunca aumentarlo (`:806-813`). `ma` lo alimentan TieTorque (§3.2),
Brownian (§2) y lo drenan fricción/arrastre.

`aim` resultante puede quedar fuera de [0,2π) (la suma de `ma` no se renormaliza aquí);
los consumidores usan `Cos/Sin` directamente (`aimvector`, `:815`) o normalizan por su
cuenta. `angle`/`angnorm`/`AngDiff` (`Physics.bas:607-648`): convención Y invertida
(pantalla), `angle` con `dx=0` → π/2 o 3π/2.

---

## 8. Notas numéricas transversales (alimenta Q07)

- Fricción y arrastre se aplican **antes** que las fuerzas de impulso pero mutando
  `vel` del ciclo anterior; el orden §2 es parte del contrato.
- Guardas anti-underflow explícitas: `1e-7` en vel/ma (`Physics.bas:31-32,95,138`),
  `1e-4` en Repel3, `0.00001` en `VectorMagnitude` (cero si el componente mayor es
  menor). Un port debe replicarlas: cambian el punto en que un bot "se para".
- `SphereCd`/`CylinderCd` son curvas por tramos de Reynolds con constantes literales
  (`Physics.bas:306-383`); `CylinderCd` no tiene llamadores vivos (los TieDrag están
  comentados) — **código muerto**.
- División por cero alcanzable: `GravityForces` divide por `PhysMoving` (`:398`) — con
  `PhysMoving = 0` configurado, **error 11 también en el EXE** (chequeo FP activo,
  corrección 2026-08-16) → truncamiento del tick cada ciclo (`10-CICLO.md §14`): una
  sim configurada así no avanza más allá de ese punto del tick. Decisión de port:
  rechazar/clampar `PhysMoving = 0` en la carga de opciones, documentado.

## 9. Resumen de `[PROBABLE BUG]`

1. **`TieTorque` clampa `nay` con `Sgn(nax)`** (`Physics.bas:694`): pares grandes
   tuercen el eje Y hacia el signo del X. Multibots con ángulos fijados y palancas
   largas dependen de esta asimetría.
2. **`TieTorque` con `|mt| > 2π` escribe `Ties(j).ang` en el slot siguiente al último**
   (`Physics.bas:712`): como `maketie` limita a 9 ties (`34-TIES.md §1`), `j ≤ 10` y la
   escritura cae **dentro** del array pero en un slot de tie vacío (`pnt = 0`), cuyo
   `.ang` rancio puede heredar la próxima tie creada ahí (`maketie` no inicializa
   `.ang`). Alimenta Q03 (índices de `Ties`).
3. **La biblioteca de vectores muta sus argumentos** (§0.3) — no es un bug de conducta
   sino una trampa de implementación: los clamps ±32000 de `VectorScalar`/
   `VectorMagnitudeSquare` son parte de la semántica física observable.
4. **`ReSpawn` toroidal mueve el organismo entero** cuando una sola célula cruza el
   borde (§5) — los multibots "saltan" de golpe. Es la mecánica real, contra la que
   evolucionó cualquier bot de campo toroidal.
5. **Los corpses colisionan y reciben `touch`/`lookoccurr`** como cualquier bot (§4.2-4.3)
   pero sus refvars no se pueblan (`lookoccurr` sale al ver `Corpse` — el *observador*
   corpse; el corpse *observado* sí puebla los refvars del vivo). Coherente con A3.
6. **`UpdateBotBucket` clampa a la rejilla** los bots fuera del campo (`Quads.bas:80-91`):
   un bot muy fuera del campo sigue colisionando/viendo en la celda del borde.

## 10. `[SIN VERIFICAR]`

- ~~El valor x87 exacto de `Ygravity/0`~~ → resuelto con la corrección de flags
  (2026-08-16): error 11 + truncamiento, no hay valor (§8). El impacto de la precisión
  extendida sobre `Sqr`/`Atn` encadenados queda cerrado como decisión de port en Q07
  (IEEE 754 estricto; divergencia de doble redondeo acotada y no falsable).
- El efecto neto del bucket-clamp (§9.6) en campos donde los bots pueden salir del
  rango físico (teleporters mal configurados) — cruza con Q10 (B7).

## 11. Preguntas que alimenta

- **Q01**: `BrownianForces` = 3 extracciones exactas por bot/ciclo si `PhysBrown ≠ 0`
  (confirma A1); nada más en física consume RNG.
- **Q03**: nuevo camino a índice fuera de rango en `Ties(j)` (§9.2) — se cierra del
  todo en B4.
- **Q07**: inventario de guardas FP (§8).
