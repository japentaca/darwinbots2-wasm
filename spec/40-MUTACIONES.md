# 40 — Mutaciones

> Documento B6b de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre `NeoMutations.bas` completo: el dispatcher `mutate`, los 11
> operadores, el modelo de tasas y sus derivas, y la matriz `DNAtoInt` (cierra Q16).
> **`DnaOps.bas` es código muerto** (mutador antiguo, cuerpos vaciados) — nada de este
> documento sale de ahí. Los regímenes de nacimiento (quién llama `mutate` y con qué
> deriva Delta2) están en `36-REPRO.md §2-3`. `[PROBABLE BUG]` = raro pero real.

---

## 0. Respuestas centrales

1. **Dos familias con operadores distintos** (`mutate`, `NeoMutations.bas:122-236`):
   - **En vida** (P5, cada ciclo): `PointMutation`, `DeltaMut` (si no `Delta2`),
     `PointMutation2` (si `sunbelt`).
   - **Al nacer** (`reproducing=True`): `CopyError`, `CopyError2` (`sunbelt`),
     `Insertion`, `Reversal`, `Translocation` (`sunbelt`), `Amplification`
     (`sunbelt`), `MajorDeletion`, `MinorDeletion` — **en ese orden exacto**
     (`:177-184`). `sunbelt`, `Delta2`, `epireset` son globales de configuración.
2. **Dos modelos de probabilidad**: Point/Point2 usan **agenda geométrica** — se
   sortea *cuándo* será la próxima mutación (`log(1−u)/log(1−1/(1000·rate))`,
   repartido entre los `DnaLen−1` tokens) y se guarda en `PointMutCycle`/`PointMutBP`
   (`:518-544`, `:482-515`); los demás son **Bernoulli por token**:
   `rndy < 1/(rate/MutCurrMult)` para cada bp en cada pasada — un parto consume
   ~`6×DnaLen` extracciones de RNG solo en sorteos, más `Gauss` (2 rndy por par, con
   caché `gasdev`).
3. **Las tasas son auto-mutantes por efecto secundario**: cada operador impone un
   **suelo** a su propia tasa antes de correr —
   `floor = DnaLen·(Mean+StdDev)·MutCurrMult/(K·30)` — y lo escribe en
   `.Mutables.mutarray` del bot, **permanente y heredable** ("Prevent freezing",
   p. ej. `:462-465`). K por operador: Point/Point2 400, CopyError 25, CE2 5,
   Insertion 5, Reversal 105, Translocation 360, Amplification 1200,
   Minor/MajorDeletion **2.5 ambos y sin factor Mean** (`:904,939`).
4. **Q16 resuelta**: `dnamatrix` registra **77 comandos detokenizables** con índices
   0..76 (`calc_dnamatrix` sondea tipos 2..10 × values 1..14 con `Parse`,
   `DNATokenizing.bas:15-35`); el comentario "76 commands" (`:54`) nombra el índice
   máximo, no el conteo. `DNAtoInt` de un comando = `32691 + índice` — máximo
   **32767 exacto**, sin overflow. Con `ismutating` activo, `debugint`/`debugbool`
   no se reconocen **en ninguna dirección** (`:446-449, :481-484`): las mutaciones no
   pueden crearlos ni el sondeo de tipos los cuenta (Max de tipo 3 = 12 durante
   mutación, 14 en la matriz).
5. **`end` es intocable e increable**: `ChangeDNA` no cruza tokens tipo 10
   ("mutations can't cross control barriers", `:701`) y el sorteo de tipos re-tira
   hasta un tipo con nombre (`TipoDetok`: 0-7 y 9; ni 8 ni 10,
   `DNATokenizing.bas:3285-3306`); las deleciones capan la longitud para no tocar el
   `end` final (`:916,950`); Amplification/Translocation lo re-estampan al terminar
   (`:302-303,381-382`).

---

## 1. El dispatcher — `mutate(robn, reproducing)` (`:122-236`)

Gates: `.Mutables.Mutations` (por bot) y `SimOpts.DisableMutations` (global). Flanquea
todo con `ismutating = True/False`. Tras operar, si hubo mutaciones nuevas
(`LastMut` creció): descuenta `GenMut`, muta el color (`mutatecolors`: 1 canal ±20 por
mutación, 2 RNG por iteración, `:969-1001`), **funda subespecie**
(`NewSubSpecies`: contador por especie con wrap ±32000, `:108-116`), recalcula
`genenum`/`DnaLen` y re-publica `mem(336)/mem(339)` — **sin `makeoccurrlist`**: la
firma `occurr`/`my*` queda rancia hasta el próximo evento de carga/parto/virus
(hallazgo de A3). Clamps: `Mutations`/`LastMut` ≤ 32000. La auto-especiación
(`EnableAutoSpeciation`) está en `36-REPRO.md §4`.

El régimen `Delta2` en vida (`:141-173`): cada `DeltaPM` ciclos de edad, deriva
aleatoria de las tasas de Point/Point2 y de `PointWhatToChange`, y resetea las agendas.

## 2. Operadores en vida

### 2.1 `PointMutation` (`:454-479`) — agenda geométrica

Si la agenda venció (`PointMutCycle < age`), re-sortea; mientras `age = PointMutCycle`
(múltiples impactos por ciclo posibles): longitud de la ráfaga
`Gauss(StdDev, Mean) Mod 32000` y `ChangeDNA` sobre `PointMutBP`. La agenda
(`PointMutWhereAndWhen`, `:518-544`): tasa efectiva `rate/MutCurrMult` con suelo 1;
`result = log(1−u)/log(1−1/(1000·rate))` (wrap manual sobre 1.8e9);
`PointMutBP = (result Mod (DnaLen−1)) + 1`; `PointMutCycle = age + result/(DnaLen−1)`.

### 2.2 `PointMutation2` (`:424-452`) — igual agenda, otro mutador

Agenda propia (`Point2MutWhen`) con la tasa dividida por un `Gauss` de las longitudes
de Point (≥1) y ×1.33 "porque ChangeDNA2 puede escribir 2 comandos"; el impacto es
`ChangeDNA2` sobre un token uniforme (**no** usa `PointMutBP`).

### 2.3 `DeltaMut` (`:546-573`) — muta las tasas

Con probabilidad `1/(100·rate/MutCurrMult)`: elige un operador al azar (re-tirando los
apagados) y le asigna `Gauss(Mean(Delta), tasa_actual)` (re-tirando ≤0 o sin cambio).

## 3. Operadores de nacimiento

Todos iteran token a token (1..DnaLen−1) con el Bernoulli de §0.2 y longitud
`Gauss(StdDev, Mean)` re-tirada hasta > 0:

| Operador | Efecto exacto | Notas |
|---|---|---|
| `CopyError` (`:575-598`) | ráfaga `ChangeDNA` de `Length` tokens desde `t` | el mutador general (§4) |
| `CopyError2` (`:388-422`) | `ChangeDNA2` sobre posiciones únicas (array `datahit` anti-repetición, re-tirada uniforme por impacto) | probabilidad `0.75/(rate/(mult·gauss))` |
| `Insertion` (`:811-843`) | `MakeSpace` de `Length` en `t` + `ChangeDNA(…, 0)` (fija tipos) + `ChangeDNA(…, 100)` (fija valores); tope duro `DnaLen+Length ≤ 32000`; acumulador `accum` corrige los índices tras cada inserción | **cada token insertado cuenta 2 mutaciones** (tipo y valor por separado); los números nuevos se siembran con `Gauss(500,0)` (`:707-714`) |
| `Reversal` (`:845-897`) | invierte el tramo `[t−L, t+L]` (`L = Gauss\2`, recortado a los bordes) | ráfaga simétrica alrededor de `t` |
| `Translocation` (`:311-386`) | copia `[t−L, t+L]` a temporal, **borra** el original, `MakeSpace` en `start = Random(1, UBound−2)` e inserta | "still bugy, but I want them" (comentario, `:181`) |
| `Amplification` (`:238-308`) | igual pero **sin borrar** (duplica); bucle `Do…Loop Until t ≥ UBound−1` con `t` arrancando en 2 | tope `UBound + 2L ≤ 32000` |
| `MajorDeletion` (`:934-965`) / `MinorDeletion` (`:899-932`) | borran `Length` tokens desde `t` (capado a no tocar `end`) | **código idéntico**; solo difieren los defaults de Mean (3±1 vs 1±0) y comparten suelo (§0.3) |

## 4. `ChangeDNA` — el mutador token a token (`:685-809`)

Por token de la ráfaga (se detiene en `end` o al llegar a `DnaLen`):

- Con probabilidad `PointWhatToChange`% (default **80**): **muta el valor**.
  - Números y `*números` (tipo 0/1): re-tira hasta cambiar —
    `|old| ≤ 1000`: moneda 50/50 entre `Gauss(94, old)` (salto grande) y
    `Gauss(7, old)` (salto fino); `|old| > 1000`: `Gauss(old/10, old)` (escala
    proporcional).
  - Comandos: sondea el `Max` legal del tipo detokenizando valores crecientes con
    `Parse` hasta obtener `""` (§0.4) y elige `Random(1, Max)` re-tirando el valor
    original.
- Si no (20%): **muta el tipo** — `Random(0, 20)` re-tirado hasta un tipo con nombre
  distinto del actual; el valor viejo se remapea `((|old|−1) Mod Max) + 1` al rango
  del tipo nuevo (números/`*n` conservan el valor tal cual).

`Insertion` lo invoca con 0% (solo tipos) y luego 100% (solo valores) (`:836-837`).

## 5. `DNAtoInt` y la matriz (cierre de Q16, `DNATokenizing.bas:9-56`)

- Números (tipo 0): `−16646 + value`, con compresión de grandes:
  `|v| > 999 → 512·sgn + v/2.05` — **dos números grandes que difieran en < ~2 mapean
  al mismo entero**: por eso el crossover echa moneda de valores cuando ambos lados
  traen `|value| > 999` (`36-REPRO.md §3.3`, `Robots.bas:651`).
- `*números` (tipo 1): lo mismo `+32729` (rango ≈ [14583, 17583]).
- Comandos (tipos 2-10): `32691 + índice_de_matriz` ∈ [32691, 32767]. Los tres rangos
  son disjuntos. `calc_dnamatrix` se llama en la inicialización (con
  `ismutating = False`, cuenta los 77).

## 6. Resumen de `[PROBABLE BUG]`

1. **Los suelos anti-congelación reescriben las tasas heredables** (§0.3): un bot con
   ADN grande ve sus tasas *subidas* en su propia estructura cada vez que un operador
   corre — la "configuración" muta sola y se hereda. Los linajes largos derivan hacia
   los suelos.
2. **Minor y MajorDeletion son el mismo operador** salvo defaults (§3) — la distinción
   del nombre/UI no existe en el código.
3. **`Insertion` infla los contadores** (2 mutaciones por token insertado) — afecta a
   `Mutations`, y con ello a la auto-especiación y al `epireset`.
4. **`Amplification` empieza en t=2** (el `t=1` inicial se incrementa antes del test,
   `:258-260`): el primer token nunca es centro de amplificación.
5. **`mutatecolors` deriva el color con 2 RNG por mutación acumulada** — el consumo de
   RNG post-mutación depende de `Delta` (nº de mutaciones del ciclo), otra fuente de
   divergencia de replays.
6. Heredado de A3: **las mutaciones en vida no refrescan `makeoccurrlist`** — la firma
   visible (`refshoot`/`refeye`…) miente hasta el próximo parto/virus/carga.

## 7. `[SIN VERIFICAR]`

- Defaults globales: `sunbelt`, `Delta2`, `DeltaPM`, `DeltaMainChance/Exp/Ln`,
  `DeltaDevChance/Exp/Ln`, `DeltaWTC`, `valNormMut`/`valMaxNormMut`, `NormMut`,
  `epiresetemp`/`epiresetOP`, `curr_dna_size`/`y_normsize` → `constants.yaml` (B5) y
  los formularios de opciones (⚙).
- La interacción exacta de `MutCurrMult` (oscilación senoidal/escalón del paso 4 del
  tick, `10-CICLO.md §2.4`) con los suelos: el suelo multiplica por `MutCurrMult`, la
  probabilidad divide por él — verificado el código, no la intención.

## 8. Preguntas que cierra o alimenta

- **Q16 → RESUELTA** (§0.4-§5).
- **Q01**: las mutaciones son el mayor consumidor de RNG por evento del motor
  (~6·DnaLen sorteos por parto + Gauss + re-tiradas + colores).
- **Q03**: `SetDefaultMutationRates` con `NormMut` usa **`rob(0)` como scratch de
  carga de ADN** (`NeoMutations.bas:1080-1085`) — desde el formulario de opciones, no
  dentro del tick. `rob(0)` puede quedar con ADN cargado y `exist=False`.
