# 32 — Visión y sentidos de proximidad

> Documento B2 de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre: geometría de los 9 ojos, alcance de visión, el barrido
> (`BucketsProximity` → `CompareRobots3`/`CompareShapes`), oclusión por formas, el ojo
> con foco y `lastopp`, y los sentidos de contacto/sabor (`touch`/`taste`). Qué celdas
> de memoria escribe cada rutina y cuándo se borran ya está en `21-MEMORIA.md` +
> `sysvars.yaml` y no se repite. `[PROBABLE BUG]` = raro pero real.

---

## 0. Respuestas centrales

1. **El barrido ocurre en P5, dentro de `WriteSenses`**, solo para bots
   `Not CantSee And Not Corpse` (`Senses.bas:180-187`), sobre las posiciones **finales**
   del ciclo (P3 ya movió). El ADN lo lee al ciclo siguiente. Corpses y `CantSee`
   conservan ojos rancios (`10-CICLO.md §7`); al formarse un corpse los ojos se ponen
   a 0 una única vez (`Robots.bas:1325-1327`).
2. **9 ojos de 10° por defecto, apuntables y ensanchables.** El ojo `a` (0..8 =
   `eye1..eye9`) mira a `aim + (4−a)·10° + (eyeXdir Mod 1256)/200` — `eye5` (a=4) es el
   frontal; índices bajos a la izquierda (`Quads.bas:526`). La anchura por defecto es
   `π/18` (10°): el campo se construye como `± [(eyeXwidth Mod 1256)/400 + π/36]`
   (`:533-537`).
3. **El valor de ojo es `1/percentdist²`**, con `percentdist = (dist_borde_a_borde +
   10)/alcance_del_ojo`, clamp 32000; solape físico = 32000 directo (`Quads.bas:566-572`).
   Es una escala relativa al alcance de *ese* ojo: dos bots con ojos de distinta anchura
   ven valores distintos a la misma distancia.
4. **El alcance depende de la anchura**: `1440·(1 − ln(w/35)/4)·eyestrength`
   (`EyeSightDistance`, `Quads.bas:375-381`; `w` = anchura absoluta,
   `AbsoluteEyeWidth = (width Mod 1256)+35`, 0→35, ≤0→+1256, `:350-357`). Ojos más
   estrechos ven más lejos (hasta ~1440 twips); el filtro grueso por bot usa el ojo más
   estrecho (`NarrowestEye`, `:361-370`) con un atajo si las 9 anchuras están a 0
   (`:426-439`). `eyestrength` atenúa por profundidad en pondmode y ×0.8 de noche,
   nunca amplifica (`:383-397`).
5. **La oclusión por formas está rota dos veces** (`ShapeBlocksBot`,
   `Quads.bas:290-344`): los vectores de borde están **transpuestos** — "top" es
   `(0, Width)` y "left" es `(Height, 0)`, describiendo el rectángulo traspuesto, solo
   correcto para formas cuadradas — y el criterio de corte acepta con **`useT Or useS`**
   en vez de `And`: basta que *una* de las dos paramétricas caiga en [0,1] para declarar
   bloqueada la línea de visión. Efecto neto: cerca del AABB de una forma (el weed-out
   de `:306-309` sí es correcto) la visión se bloquea de más y con un patrón traspuesto.
   `[PROBABLE BUG]` de primer orden para el port: replicarlo exige implementar
   exactamente esta función, no "oclusión de verdad". Solo aplica si
   `Not SimOpts.shapesAreSeeThrough` (`:445-447`).

---

## 1. El barrido — `BucketsProximity` (`Quads.bas:174-205`)

1. Resetea `lastopp = 0`, `lastopptype = 0`, `mem(EYEF) = 0` y `mem(501..509) = 0`.
2. Recorre los bots de su bucket y de los hasta 8 adyacentes
   (`CheckBotBucketForVision`, `:207-221`) llamando `CompareRobots3` contra **todos**
   (corpses incluidos; filtro `hidepred` dentro de `CompareRobots3`, `:402`). El radio
   práctico de visión (≤1440) siempre cabe en la vecindad de buckets de 4000.
3. Si `shapesAreVisable`: `CompareShapes n, 12` (§3).
4. Devuelve `lastopp`; `WriteSenses` puebla los refvars según `lastopptype`
   (`lookoccurr` para bot, `lookoccurrShape` para forma, `Senses.bas:181-186`).

El orden de visita (bucket propio, luego adyacentes en el orden precalculado de
`Init_Buckets`) importa solo para empates exactos de `eyevalue` (gana el primero, el
test es `<` estricto, `:575`); la prioridad real es por cercanía.

## 2. Visión de bots — `CompareRobots3` (`Quads.bas:401-592`)

Por bot observado `n2`:

1. `edgetoedgedist = |Δpos| − r1 − r2`; descarte si supera el alcance del ojo más
   estrecho (§0.4). Puede ser **negativa** (solape).
2. Oclusión (§0.5) si las formas no son transparentes.
3. Se computan `theta`/`beta`, los ángulos a los dos bordes del bot observado
   (perpendiculares al vector de centros escaladas por `r2`, Y invertida,
   `:451-508`), y `botspanszero` si el bot cruza el ángulo 0.
4. Por ojo `a = 0..8` con alcance suficiente: dirección y semiancho según §0.2, con
   normalizaciones. Ojo: en las normalizaciones del semiancho, `PI \ 36` usa
   **división entera** — `CInt(π)\36 = 0` — así que los bucles reales son
   `While hw > π: hw −= π` / `While hw < 0: hw += π` (`:534-535`): la intención
   aparente era `π/36` pero el efecto es normalizar a [0, π). Consecuencia observable:
   una **anchura negativa** (`eyeXwidth` < 0, `Mod 1256` conserva el signo) produce
   `hw` negativo → +π → un ojo casi panorámico. `[PROBABLE BUG]` heredable.
5. El test de visibilidad es la disyunción de 10 cláusulas (`:553-562`) que cubre:
   borde izquierdo o derecho del bot dentro del campo del ojo, el bot abarcando el ojo
   entero, y las variantes con el ojo o el bot cruzando 0. Se especifica **por
   transcripción literal**, no por intención: cada cláusula es
   `(eyeaimleft ≥ θ|β ≥ eyeaimright)` o su variante span-zero, más el caso
   `eyeaimleft ≤ θ And β ≤ eyeaimright` (bot rodea al ojo) en sus 4 combinaciones.
6. `eyevalue` según §0.3; si supera el valor ya escrito en `mem(501+a)` lo reemplaza, y
   si además `a` es el ojo con foco (`Abs(mem(FOCUSEYE)+4) Mod 9`, `:578`),
   `lastopp = n2` y `mem(EYEF) = eyevalue`.

Notas:

- **Los corpses se ven como cualquier bot** (no hay filtro): sus refvars llegan con
  `occurr` borrado (todo 0 desde `Erase .occurr` al morir) pero `refnrg`/`refbody`
  reales — así se localizan cadáveres para comer.
- `mem(FOCUSEYE)` con valores extremos: `Abs(x+4) Mod 9` — p. ej. −4 → ojo 0 (eye1),
  0 → 4 (eye5), −13 → 0. El wrap `Abs` hace que −5 y −3 den el mismo ojo (1).
- La dirección del ojo usa `rob(n1).aim` sin normalizar (puede venir fuera de [0,2π)
  desde `SetAimFunc`, `30-FISICA.md §7`); los `While` de `:529-530` lo absorben.

## 3. Visión de formas — `CompareShapes` (`Quads.bas:597-943`)

Solo si `shapesAreVisable`. Por forma existente:

1. Descarte por AABB inflado con el alcance del ojo más estrecho (`:638-641`).
2. **Bot dentro de la forma**: los 9 ojos a 32000, `lastopp = o`, `lastopptype = 1`, y
   **sale del bucle de formas** (`GoTo getout`, `:643-653`) — sin actualizar `EYEF`
   `[PROBABLE BUG]`: dentro de una forma, `EYEF` conserva lo que dejara el barrido de
   bots aunque los 9 ojos marquen 32000.
3. Caso general: clasifica la posición del bot en 8 sectores (N/E/S/O y diagonales,
   `:672-705`), calcula por ojo el punto más cercano de la forma (esquina o pie de
   perpendicular) y, si el ojo no lo abarca, intersecta los **dos lados como máximo**
   visibles con los rayos de los bordes del ojo (`SegmentSegmentIntersect`,
   `:947-963`, esta vez con `s` y `t` ambos en [0,1] — la versión correcta).
   La distancia ganadora produce
   `eyevalue = 1/(((lowestDist − radius + 10)/eyedist)²)`, clamp 32000, ≤0 → 32000
   (`:905-918`).
4. Anchura de ojo **distinta a la de bots**: `halfeyewidth = (eyeXwidth + 35)/400`
   sin `Mod` y normalizada a [0, π] con π enteros (`:736-738`) — una anchura de 32000
   da `hw ≈ 80` → normalizado ≈ 0.5–π según el resto. Asimetría bots/formas heredable.
5. `lastopppos` (usado por `lookoccurrShape` para `refxpos/refypos`) **solo se captura
   cuando `a = 4`** (`:807,825-831,…`): si el ojo con foco no es el frontal,
   `lastopppos` queda en `(0,0)` u obsoleto y los refvars de posición de la forma
   mienten. `[PROBABLE BUG]`.
6. El caso "toca una forma sin ver nada" lo cubre `DoObstacleCollisions` en P1:
   `mem(REFTYPE) = 1` si `EYEF = 0` (`Obstacles.bas:529-531`).

## 4. Refvars y espionaje

Especificados celda a celda en A3 (`sysvars.yaml` 685–715, 473/474, 477). Reglas de
subsistema que conviene fijar aquí:

- `lookoccurr` corre en dos contextos: visión (P5, contra `lastopp`) y **colisión**
  (P1, `Repel3`, contra el bot chocado, ambos sentidos) — un bot ciego obtiene refvars
  de lo que lo toca.
- El fudge (`FudgeEyes`/`FudgeAll`, capa evo ⚙) trucca refvars de especies ajenas con
  ±1 y consume RNG por campo (`21-MEMORIA.md §11`).
- `refxpos/refypos` del bot observado se copian de **su** `mem(219)/mem(217)` — es
  decir, de su posición publicada en su P5 *anterior* si aún no pasó por WriteSenses en
  esta pasada, o la de este ciclo si su índice es menor. La asimetría por índice de
  `10-CICLO.md §0.4` se manifiesta aquí.

## 5. Sentidos de contacto y sabor — `touch`/`taste` (`Senses.bas:21-95`)

Geometría común: ángulo del estímulo respecto de `aim` invertido (`aim = 6.28 − .aim`),
`Atn` con corrección de cuadrante, `dang` normalizado a [0, 6.28] con umbrales fijos:

| Sector | `dang` | touch escribe | taste escribe |
|---|---|---|---|
| frente | > 5.49 o < 0.78 | `hitup=1` | `shup=tipo` |
| atrás | 2.36–3.92 | `hitdn=1` | `shdn=tipo` |
| derecha | 0.78–2.36 | `hitdx=1` | `shdx=tipo` |
| izquierda | 3.92–5.49 | `hitsx=1` | `shsx=tipo` |

Los sectores laterales son **inclusivos en ambos umbrales compartidos** (un `dang`
exacto de 0.78 marca dx pero no up: up exige `< 0.78` estricto… no: up es
`> 5.49 Or < 0.78` — 0.78 exacto no marca up ni dx (`> 0.78` estricto). Los umbrales
exactos no marcan ningún sector lateral doble). `touch` marca además `hit=1`; `taste`
escribe `shang = dang·200` y `shflav = tipo`. Llamadores: `touch` desde `Repel3` (P1) y
`DoObstacleCollisions` (P1); `taste` solo desde `updateshots` (paso 14).

`LandMark` (`Senses.bas:12-17`): `mem(400) = 1` si `1.39 < aim < 1.75` — "mirando
arriba" en la convención de pantalla; cada P5.

## 6. Resumen de `[PROBABLE BUG]`

1. **Oclusión transpuesta y con `Or`** (`ShapeBlocksBot`, §0.5) — el más gordo del
   documento: la sombra de las formas no coincide con las formas.
2. **`PI \ 36` división entera** en la normalización del semiancho de ojo para bots
   (`Quads.bas:534-535`): anchuras negativas producen ojos panorámicos.
3. **Dentro de una forma no se actualiza `EYEF`** (§3.2).
4. **`lastopppos` solo se captura para el ojo frontal** (§3.5): refvars de posición de
   formas incorrectos con `focuseye ≠ 0`.
5. **Anchura de ojo con fórmulas distintas para bots y formas**
   (`Mod 1256`/400 + π/36 vs `(w+35)/400`): el mismo `eyeXwidth` produce campos
   distintos según el objetivo (§2.4 vs §3.4).
6. Heredados de A3, se listan por completitud: `refvelsx` siempre 0; espionaje por tie
   marca `View` con la celda equivocada.

## 7. `[SIN VERIFICAR]`

- El uso real del flag `.View` ("has this bot ever tried to see?", `Robots.bas:191`) —
  aparece escrito por los espionajes (`Senses.bas:336`; `Ties.bas:757`); su(s)
  lector(es) parecen ser de UI/render. Queda para el barrido de display (fuera de la
  spec del core, no bloquea el port).
- El comportamiento del barrido cuando `aim` acumula magnitudes enormes de `ma`
  (los `While` de normalización iteran proporcionalmente — coste, no corrección).

## 8. Preguntas que alimenta

- **Q08**: nuevas divergencias EXE/IDE ninguna (la visión no desborda: todo clampa).
- **Q03**: los buckets usan índice 0 de `arr()` como no-usado (los arrays arrancan las
  búsquedas en 1 y el elemento 0 nunca se escribe: `Add_Bot` escribe desde 1,
  `Quads.bas:117-131`) — patrón consistente con `rob()`.
