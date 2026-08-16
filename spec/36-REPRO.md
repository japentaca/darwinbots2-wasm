# 36 — Reproducción y herencia

> Documento B6a de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre: la reproducción asexual (`Reproduce`), la sexual (`takesperm` →
> `SexReproduce` + crossover), la distancia genética, y qué hereda exactamente un hijo.
> La posición en el ciclo (colas `rep()`, orden nacimientos→muertes) está en
> `10-CICLO.md §6`; las siembras de memoria del hijo en `21-MEMORIA.md`; las mutaciones
> de nacimiento en `40-MUTACIONES.md`. `[PROBABLE BUG]` = raro pero real.

---

## 0. Respuestas centrales

1. **El hijo sexual pierde su primer token**: `crossover` construye `Outdna` desde el
   **índice 0** (`Robots.bas:585-588`, primer segmento en `upperbound+1 = 0`) y
   `rob(nuovo).dna = Outdna` lo adopta tal cual (`:2602`). Como la ejecución empieza en
   el índice 1 (`20-VM.md §4`), **el primer token de todo hijo sexual es invisible para
   el intérprete** (visible para mutaciones y `DnaLen`). El "bug fix remove starting
   zero" (`:2589-2594`) solo actúa si ese token es exactamente `(0,0)`. Es el mismo
   fenómeno que el corrimiento de `def`s de `20-VM.md §2.3`, ahora para *toda* la
   descendencia sexual. `[PROBABLE BUG]` mayor.
2. **La pareja no existe como bot**: el "macho" es un shot −8 (`spermDNA` en la
   estructura de la madre, `33-SHOTS.md §5`); todos los recursos del hijo salen de la
   madre (`Robots.bas:2442-2443`), el macho solo pagó el coste del disparo. El
   `SonNumber`/`parent` del macho no se actualizan (comentario del autor,
   `:2681-2686`): el linaje registrado es matrilineal.
3. **Umbral de compatibilidad 0.6**: si la distancia genética madre/esperma supera 0.6,
   no hay hijo y `fertilized = −18` (bloqueo de ~8 ciclos: sube +1 por ciclo hasta −10
   y de ahí a −2, `Robots.bas:2531-2534`, `:1377-1387`). El esperma **no** se descarta:
   puede reintentar al desbloquearse.
4. **Un fallo de `Reproduce` no consume la orden**: `repro`/`mrepro`/`sexrepro` solo se
   ponen a 0 en el camino del éxito (`21-MEMORIA.md`); las guardas (body ≤ 2, colisión
   en el punto de parto, gates vegetales) hacen reintentar cada ciclo.
5. **Los porcentajes son `Mod 100`**: `per = per Mod 100` (`Robots.bas:2132,2459`);
   `reprofix` (opción evo ⚙) mata a los "avaros" con `per < 3` (`:2134,2461`).

---

## 1. Encolado y elección (recap A1 + detalle)

`ManageReproduction` (P5) encola positivo (asexual: `repro` o `mrepro` > 0) o negativo
(sexual: `sexrepro > 0` y `fertilized ≥ 0`); posible doble encolado
(`10-CICLO.md §6`). `ReproduceAndKill` (P6) procesa en orden: para asexual con ambos
`repro` y `mrepro` activos, **1 RNG** decide cuál manda el porcentaje
(`Robots.bas:1667-1675`).

## 2. `Reproduce(n, per)` — asexual (`Robots.bas:2100-2413`)

Guardas en orden: `body < 5` (`:2102`), `DisableTypArepro` para no-vegetales (`:2104`),
`body ≤ 2` o `CantReproduce` (`:2120`), gates vegetales — techo de `TotalChlr`
(`:2123`), lotería `Random(0,10) ≠ 5` sobre el 90% del techo (**1 RNG**, `:2129`),
primer ciclo (`totvegsDisplayed = −1`, `:2130`) —, `per ≤ 0` tras `Mod 100` (`:2136`),
`nrg ≤ 0` (`:2144`), colisión en el punto de parto (`simplecoll`, `:2147`).

**Qué hereda el hijo** (todo del padre): ADN copiado **desde el índice 1** — `dna(0)`
del hijo queda fantasma `(0,0)`, consistente con A2 (`:2156-2159`); `Mutables`,
`Mutations`/`OldMutations`, `LastMutDetail`, `usedvars`/`maxusedvars`, `Skin`, color,
`NewMove`, flags de especie (`Veg`/`NoChlr`/`Fixed`/`CantSee`/`DisableDNA`/
`DisableMovementSysvars`/`CantReproduce`/`VirusImmune`), `SubSpecies`, `OldGD`/`GenMut`,
`tag`, `Bouyancy`, `dq`, mitad del `multibot_time`+2 (`:2257`), memoria genética
(`21-MEMORIA.md §5`), `mem(timersys)`. **No hereda**: `vars()`/`vnum` (reseteado a 1 —
irrelevante: las direcciones ya están tokenizadas), ties, `mem` general, venom/poison/
shell/slime (quedan a 0 del slot en blanco), `LastMut` (a 0).

**Reparto de recursos** (`per` = % al hijo): nrg, waste, pwaste y cloroplastos al
`per`%; body por `nbody = (body/100)·per` (**`Integer`**, redondeo bancario,
`:2108,2140`); impuestos: 0.1% del nrg transferido al padre y 1% al hijo
(`:2214,2230`); posición a `sondist` = suma de los radios que tendrán ambos
(`FindRadius` con `mult`, `:2137`), mirando en sentido opuesto (`aim + π`);
velocidad heredada. Tie de nacimiento (`last=100, Port=0`); `onrg` del padre
sincronizado anti-`Shock` (`:2381`); coste final `DnaLen·DNACOPYCOST·mult` con suelo
en 0 (`:2408-2409`).

**Régimen de mutación del hijo** (`:2290-2372`): con `Delta2` global, deriva aleatoria
de las tasas heredadas (dmoc por tamaño de ADN, `10^((rndy·2−1)/exp)` por tasa…) y
`mutate nuovo, True` — repetido **2 a 4 veces** si el parto fue por `mrepro`
(`For mrep = 0 To (Int(3·rndy)+1)·-(mem(mrepro)>0)`, `:2311`). Sin `Delta2`: `mrepro`
divide las tasas entre 10 (0 → 1000) y fuerza `Mutations=True` solo para ese parto
(`:2352-2366`).

## 3. Sexual: fertilización y `SexReproduce` (`Robots.bas:2417-2847`)

### 3.1 Fertilización

`takesperm` (−8): `fertilized = 10`, `mem(303) = 10`, copia `dna`/`DnaLen` del shot a
`spermDNA` (`Shots.bas:862-874`). `ManageReproduction` decrementa el contador cada P5 y
libera `spermDNA` al llegar a −1 (`Robots.bas:1370-1387`). El esperma **se consume con
un solo parto** (`fertilized = −1` tras el éxito, `:2825`).

### 3.2 Guardas propias

Como las asexuales, más: `IsRobDNABounded(spermDNA)` (`:2440`), y la lotería vegetal usa
`Random(0, 9) ≠ 5` — **1/10 en vez de 1/11**: las vegetales sexuales pasan el gate más a
menudo que las asexuales (`:2456` vs `:2129`). Sin guarda de `DisableTypArepro`.

### 3.3 El crossover (`Robots.bas:2488-2594`, `simplematch :424-532`, `crossover :562-694`)

1. Ambos ADN se proyectan a enteros "nucli" con `DNAtoInt` (la matriz de A2 §9; Q16).
2. `simplematch`: emparejador greedy — acumula listas de tokens de ambos lados hasta
   encontrar una coincidencia, y desde ahí marca la racha común con un número de capa
   (`match = inc`) en ambos; corta con un contador de seguridad `patch > 16000²`
   (`:531`). Tokens sin capa (match 0) = no emparejados.
3. Distancia = no-emparejados / total (`GeneticDistance`, `:409-422`); > 0.6 → §0.3.
4. `crossover`: alterna segmentos — para cada tramo **no emparejado** de cada lado,
   una moneda (**1 RNG**) decide si el tramo del lado 1 o el del 2 entra en el hijo
   (si solo un lado tiene tramo, la moneda decide si entra o se pierde,
   `:596-626`); para cada racha **emparejada**, una moneda elige el lado "base" y,
   token a token, si ambos lados tienen `|value| > 999` y el mismo tipo, otra moneda
   elige el valor (`:638-653`). Consumo de RNG proporcional al número de segmentos.
5. El resultado arranca en el índice 0 (§0.1); `DnaLen` se recalcula y el array se
   recorta a `DnaLen` (`:2604-2607`).

### 3.4 Después

Idéntico a la asexual con la madre como fuente (recursos, siembras, tie de nacimiento,
epigenética, régimen `Delta2` — sin el multiplicador ×2-4 de `mrepro`), y los resets:
`sexrepro = 0`, `fertilized = −1`, `mem(303) = 0` (`:2824-2826`).

## 4. Distancia genética fuera del sexo

`DoGeneticDistance(r1, r2)` (`Robots.bas:534-560`) — el mismo pipeline sin crossover.
Consumidores: `sharechloroplasts` (umbral 0.25, `34-TIES.md §2.1`) y la campaña
periódica de `GenMut` (`GenMut = DnaLen/GeneticSensitivity` con
`GeneticSensitivity = 75`, `Robots.bas:383`; decrementada por mutaciones en `mutate`,
`NeoMutations.bas:224-225`) — el disparador exacto de la re-medición vive en el código
de display/graph (⚙); el core solo mantiene los campos.

**Auto-especiación** (`mutate`, `NeoMutations.bas:193-217`): con
`EnableAutoSpeciation`, cuando `Mutations > DnaLen·SpeciationGeneticDistance/100`, el
bot se renombra `(k)Nombre`, resetea `Mutations` y funda especie (máx. 49). Cambia
`FName` — y con él la inmunidad conspecífica a venom/poison y el `TOTALMYSPECIES`.

## 5. Resumen de `[PROBABLE BUG]`

1. **El primer token del hijo sexual no se ejecuta** (§0.1) — todo linaje sexual corre
   con su ADN efectivo desplazado un token; si el token invisible era un `cond`, la
   estructura del primer gen cambia (los tipo 9 posteriores reactivan el flujo igual,
   `20-VM.md §5.5`).
2. **Loterías vegetales asimétricas** (1/11 asexual vs 1/10 sexual, §3.2).
3. **Pérdida de tramos en el crossover**: un tramo no emparejado presente en un solo
   lado se descarta con probabilidad 1/2 (`Robots.bas:610-626`) — el hijo puede ser más
   corto que ambos padres; junto con la moneda por segmento, el mismo par
   madre×esperma produce hijos distintos (el crossover no es determinista).
4. **`nbody As Integer`**: el body del hijo se redondea a entero (bancario) aunque todo
   lo demás sea `Single` (`:2424,2467`).
5. Heredados y ya documentados: doble encolado asexual+sexual (A1), órdenes de
   reproducción no consumidas en fallo (A3), `Shock` esquivado a mano con
   `onrg = nrg` tras el parto.

## 6. `[SIN VERIFICAR]`

- `DNAtoInt`/`calc_dnamatrix` — el desajuste 76 vs 77 (Q16) afecta a qué tokens
  colisionan como el mismo "nucli" en `simplematch`; pendiente de contar la matriz en
  runtime (se resuelve con `40-MUTACIONES.md`/B8 si el conteo estático basta).
- El disparador de UI de la re-medición de distancia genética (`GenMut`/`OldGD`) — ⚙.

## 7. Preguntas que alimenta

- **Q01**: RNG del subsistema — 1 por elección asexual/sexual doble, 1 por lotería
  vegetal, ~1 por segmento de crossover, y el granizo de `mutate` (B6b).
- **Q13**: sigue abierta (el desborde de `rep()` exige población máxima con doble
  encolado; nada nuevo).
- **Q16**: señalada en §6.
