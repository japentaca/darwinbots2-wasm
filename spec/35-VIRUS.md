# 35 — Virus

> Documento B3b de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre el ciclo completo del virus: fabricación (`mkvirus` → `MakeVirus`/
> `copygene`), incubación (`Vtimer`), disparo (`vshoot` → `Vshoot`), infección
> (`addgene`) y el borrado de genes (`delgene`). La balística común de los shots está en
> `33-SHOTS.md`; las celdas de memoria en `21-MEMORIA.md`. Ojo: las rutinas de ADN vivas
> están en `NeoMutations.bas` — las homónimas de `DnaOps.bas` están vaciadas
> (cuerpos comentados, `DnaOps.bas:99-164`) y no compilan en el EXE.

---

## 0. Respuestas centrales

1. **Un virus es un shot tipo −7 almacenado dentro del bot** (`stored = True`): no
   colisiona ni envejece mientras incuba (`Shots.bas:321,394`), sobrevive a la
   compactación del array vía el puntero `rob().virusshot` (`Shots.bas:434-441`) y
   muere con su dueño (`KillRobot`, `Robots.bas:3017-3020`).
2. **Fabricarlo exige no tener cloroplastos, y el intento los destruye**: con
   `chloroplasts > 0`, `mem(mkvirus)` no fabrica nada — pone los cloroplastos a 0 y
   recalcula el radio (`Robots.bas:1081-1086`). La incompatibilidad virus/fotosíntesis
   es bidireccional y castiga el intento.
3. **La incubación dura `2 × longitud_del_gen` ciclos** (tope 32000): `MakeVirus` copia
   el gen y fija `Vtimer = genelength·2` (`Robots.bas:1068-1075`), cobrando
   `genelength·DNACOPYCOST·COSTMULTIPLIER` (la mitad de `length = genelength·2`,
   `:1070`). `Vtimer` decrementa cada P3 y se publica en `mem(337)`.
4. **El disparo cobra doble**: cuando `Vtimer` llega a 1 con `mem(vshoot) ≠ 0`,
   `Vshoot` descuenta `vshoot + SHOTCOST·COSTMULTIPLIER` **dos veces** — una como
   `tempa/20` (`Shots.bas:1100`) y otra como `mem(VshootSys)` (`:1103`).
   `[PROBABLE BUG]` aritmético: el precio real es 2·(vshoot + SHOTCOST·mult).
5. **La potencia del virus escala con el número de gen copiado**: el shot −7 lleva
   `value = número_de_gen` (`MakeVirus` → `newshot(n, −7, Int(gene), 1)`,
   `Shots.bas:1124`), y la potencia de infección es
   `nrg/(Range·40)·value` (`addgene`, `:1183`) — copiar el gen 7 infecta más fuerte
   que copiar el gen 1, a igualdad de energía. Geometría del código, no intención
   documentada.

---

## 1. Fabricación — `BotDNAManipulation` P3 (`Robots.bas:1049-1112`)

Gate: `mem(mkvirus) > 0 And Vtimer = 0` (un virus a la vez). Con cloroplastos, §0.2.
Sin ellos:

- `MakeVirus(n, mem(mkvirus))` (`Shots.bas:1123-1130`): crea el shot −7 con
  `stored = True` y llama `copygene`.
- `copygene` (`Shots.bas:1133-1171`): valida `1 ≤ gene ≤ genenum` (si no, el shot se
  destruye y `newshot` devuelve −1 → `Vtimer = 0`, `virusshot = 0`,
  `Shots.bas:180-185`; `Robots.bas:1076-1079`); copia
  `dna(genepos(p) .. GeneEnd(p))` — **el gen entero incluido su `stop`** — al
  `dna()` del shot, indexado desde 0, y fija `Shots().DnaLen = genelen`.
- Éxito: coste de §0.3 y `Vtimer = min(2·genelength, 32000)`.
- `mem(mkvirus)` **no se consume** hasta el disparo (`Robots.bas:1096`): si el bot lo
  deja escrito, cada expiración de `Vtimer` refabrica.

Nota de A2 que aplica aquí: `genepos`/`GeneEnd` usan la numeración de genes de
`20-VM.md §5.6`; `genelength = GeneEnd − genepos + 1` (`Robots.bas:1040-1047`).

## 2. Disparo — `Vshoot` (`Shots.bas:1084-1121`)

Al ciclo en que `Vtimer = 1` y `mem(vshoot) ≠ 0` (`Robots.bas:1091-1099`):

- `mem(vshoot) < 0` se normaliza a 1 **escribiéndolo en la celda** (`Shots.bas:1093`).
- Energía del shot: `vshoot·20`, clamp 0..32000 (`:1095-1099`).
- Alcance: `Range = 11 + CInt(vshoot/2)` (`:1102`) — un virus vuela mucho más lejos que
  un shot normal.
- Doble cobro (§0.4).
- Dirección **aleatoria** (`Random(1,1256)/200`, 1 extracción de RNG, `:1106`), no la
  del aim; velocidad = `RobSize/3` en esa dirección + `actvel` del tirador
  (`:1111-1115`); `stored = False` → entra en la balística normal al siguiente
  `updateshots`.
- Reset completo: `mem(vshoot) = mem(vtimer) = mem(mkvirus) = 0`, `Vtimer = 0`,
  `virusshot = 0` (`Robots.bas:1094-1098`).

Si el bot nunca escribe `vshoot`, el virus incubado queda almacenado para siempre
(`Vtimer` no baja de 1… sí: `If .Vtimer > 1 Then .Vtimer = .Vtimer - 1` — se detiene
en 1 y espera, `Robots.bas:1056-1058`).

## 3. Infección — `addgene` (`Shots.bas:1173-1224`), golpe de un −7

1. Inmunes: corpses y `VirusImmune` (flag de especie) (`:1181`).
2. **Defensa por slime** (`SlimeEffectiveness = 1/20`, `:46`): si
   `power < slime·0.05`, absorbido — `slime −= power·20` y fuera. Si no:
   `slime −= power·20` **primero**, y `power −= slime_nueva·0.05` **después**
   (`:1188-1190`) — como la slime ya quedó reducida (posiblemente negativa), el
   descuento es menor o incluso **negativo**: penetrar una capa de slime deja
   `power ≈ 2·power_original − slime_vieja·0.05`, un virus *más* fuerte.
   `[PROBABLE BUG]`. La slime negativa se normaliza a 0 después (`<0.5 → 0`, `:1191`).
   `power` no se vuelve a usar tras esto — la infección procede igual: el efecto neto
   de la slime es solo el umbral de absorción.
3. **Punto de inserción aleatorio**: `Position = Random(0, genenum)` (1 RNG,
   `:1194`); 0 = delante del primer token; si no, tras el `GeneEnd` del gen elegido.
4. `MakeSpace` (`NeoMutations.bas:62-88`; tope duro `DnaLen + genelen ≤ 32000`, si no
   la inserción **falla en silencio** y el ADN queda intacto) + copia del `dna` del
   shot (`Shots.bas:1207-1211`).
5. Housekeeping: `makeoccurrlist`, `DnaLen`/`genenum` + `mem(336)/mem(339)`,
   `SubSpecies = NewSubSpecies` (la infección funda una subespecie), log,
   `Mutations`/`LastMut` +1 (`:1213-1222`).

El gen inyectado ejecutará desde el ciclo siguiente como parte normal del ADN — incluida
la posibilidad de que contenga `mkvirus`/`vshoot` y se propague (el diseño epidémico
completo emerge de §1-§3 sin código adicional).

## 4. Borrado de genes — `delgene`

- **Comando propio**: `mem(delgene) > 0` en P3 → `delgene n, mem(340)`
  (`Robots.bas:1103-1106`).
- `delgene` (`NeoMutations.bas:1007-1022`): valida `0 < g ≤ genenum`;
  `DeleteSpecificGene` = `Delete(dna, genepos(g), GeneEnd−genepos+1)`
  (`:1062-1070`); actualiza `DnaLen`/`genenum`/`mem(336)/mem(339)` y
  `makeoccurrlist`. En modos torneo puede descalificar (⚙, `:1019-1020`).
- **La dirección 340 está blindada contra ataques externos** (shots de memoria la
  saltan; venom/poison la remapean a `mem(0)`) — `21-MEMORIA.md §6`. El único camino
  externo a `delgene` sería un virus que inyecte un gen que escriba `.delgene`.
- `Delete` (`NeoMutations.bas:90-…`): corrimiento y `ReDim`; con
  `beginning > DNALength−1` no hace nada.

## 5. Resumen de `[PROBABLE BUG]`

1. **Doble cobro de `Vshoot`** (§0.4).
2. **La slime penetrada amplifica `power`** (§3.2) — irrelevante hoy porque `power` no
   se reutiliza, pero cualquier port que "arregle" el orden cambiaría el umbral de
   absorción a futuro; replicar tal cual.
3. **Potencia proporcional al número de gen** (§0.5).
4. **`mem(mkvirus)` persistente**: re-fabricación automática mientras la celda quede
   escrita (§1) — los bots virulentos solo necesitan escribirla una vez.
5. Heredado de 33-SHOTS: la dirección de disparo del virus es aleatoria — el "apuntado"
   de virus no existe; `aimshoot`/`backshot` no se consultan en `Vshoot`.

## 6. `[SIN VERIFICAR]`

- `NewSubSpecies` (contador/asignación de subespecies) — mecánica de identidad, se
  especifica con B6/B8 según dónde caiga su uso.
- Interacción del virus con `spermDNA` (un −7 no toca `spermDNA`; el −8 sí) — cubierto
  en B6.

## 7. Preguntas que alimenta

- **Q01**: RNG del subsistema: 1 por `Vshoot` (dirección), 1 por `addgene` (posición),
  más los 2 de `newshot` en `MakeVirus`.
- **Q03**: `rob(0)` tiene un uso real más: `SetDefaultMutationRates` con `NormMut`
  activo **carga ADN en el slot 0** como scratch para medir la longitud
  (`NeoMutations.bas:1080-1085`) — disparado desde el formulario de opciones (⚙ UI,
  no dentro del tick). Se documenta del todo en B6.
