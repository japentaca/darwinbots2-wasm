# 34 — Ties y multibots

> Documento B4 de la especificación. Fuente de verdad: el código citado sobre el commit
> `02b20d7`. Cubre: la estructura de la tie y sus puertos, creación y borrado, el ciclo
> de vida (endurecimiento/expiración), comunicación y transferencias por tie, y la
> semántica multibot. La física de la tie (muelle, torque) está en `30-FISICA.md §3`;
> cada celda de memoria en `21-MEMORIA.md`/`sysvars.yaml` (450–487, 830–833, 924).
> `[PROBABLE BUG]` = raro pero real.

---

## 0. Respuestas centrales

1. **Máximo 9 ties simultáneas por bot, no 10**: el array es `Ties(10)` (`Robots.bas:214`)
   pero `maketie` exige `k < MAXTIES And j < MAXTIES` con `MAXTIES = 10`
   (`Ties.bas:42,918`) — el slot 10 solo se llena por corrimiento, nunca por creación.
   El comentario del autor lo admite ("Only allows 9 ties at present", `Ties.bas:827`).
2. **El puerto de una tie es asimétrico**: para el creador, `Port = mem(tie)` (el valor
   almacenado en `.tie`); para el receptor, `Port = su número de slot de tie`
   (`Ties.bas:924,943`). Los dos extremos dirigen la misma tie con números distintos —
   los protocolos multibot dependen de esta convención.
3. **Una tie nueva pisa cualquier tie previa con el mismo par de bots**: `maketie` hace
   `DeleteTie a, b` antes de crear (`Ties.bas:909`). Re-atar reinicia el reloj y el tipo.
4. **El reloj `last` gobierna el destino** (`30-FISICA.md §3.1`): `last > 1` cuenta
   atrás hacia el borrado (ties de nacimiento: 100); `last < 0` cuenta hacia el
   endurecimiento (ties de `.tie`: −20 → a los 19 ciclos, `regang` la vuelve tipo 3
   "hueso", fija su ángulo actual y **convierte al creador en multibot**
   (`Ties.bas:977-1008`)). Solo el lado no-`back` fija ángulo.
5. **La slime deflecta la creación**: `deflect = Random(2,92)` (1 RNG por intento,
   incluso si luego falla) y si `deflect < slime` del objetivo no hay tie; en todo caso
   la slime del objetivo pierde 20 y el creador paga `TIECOST/(numties+1)`
   (`Ties.bas:898-956`).

---

## 1. Estructura y creación

`Type tie` (`Ties.bas:6-40`): `Port`, `pnt` (bot apuntado), `ptt` (índice de la tie
recíproca), `ang`/`bend`/`angreg` (ángulo), `ln`/`shrink` (sin uso vivo: `bend`/`shrink`
como comandos están comentados, `Ties.bas:320-334`; el campo `ln` solo se escribe en
código muerto), `NaturalLength`/`k`/`b`/`type` (física), `last` (reloj), `back`,
`nrgused`/`infused`/`sharing` (colores de render), `stat` ("apparently unused") y
`mem` — **campo muerto: solo lo tocan el save y el load** (`HDRoutines.bas:1638,2047`).

Tipos: 0 = muelle blando (`k=0.01, b=0.02`, toda tie nace así), 3 = hueso
(`k=0.05, b=0.1`, tras `regang`); 1 y 2 declarados y nunca asignados.

**Caminos de creación** (todos vía `maketie`, `Ties.bas:883-958`):

| Camino | Cuándo | Parámetros |
|---|---|---|
| `.tie` (`FireTies`, P5) | `mem(330) ≠ 0` con `lastopp` bot válido a ≤ `4·RobSize + radios` (o el padre/`lasttch` como fallback si `lastopp = 0`, `Robots.bas:1410-1423`) | `last = −20`, `Port = mem(330)` |
| Nacimiento (`Reproduce`/`SexReproduce`) | todo parto | `last = 100`, `Port = 0` |
| — | `maketie` exige además `length ≤ c·1.5` (c = longitud solicitada) | |

Al crear: `NaturalLength = length` actual, `mem(numties)` y `mem(tiepres)` de ambos
lados, y **el creador carga los trefvars inmediatamente** (`ReadTRefVars a, k`,
`Ties.bas:929`) — no espera al `readtie` de P1.

`DeleteTie` (`Ties.bas:815-874`): borra por corrimiento en ambos extremos, decrementa
`numties`/`mem(466)` y repara `mem(tiepres)`. `delallties` la itera (`:805-812`).
Borrados automáticos: longitud > 1000 + radios, expiración de `last`, bots
inexistentes — todos en `TieHooke` (`30-FISICA.md §3.1`).

## 2. Comunicación y transferencias

Todo especificado celda a celda en A3; aquí el mapa de operaciones y sus pasadas:

| Operación | Pasada | Gate | Semántica |
|---|---|---|---|
| `tieportcom` | P1 | `tienum ≠ 0` y `tieloc ∈ 1..1000` | escritura remota `mem_ajeno(tieloc) = tieval` en toda tie cuyo puerto = tienum |
| `readtie` → `ReadTRefVars` | P1 | `newage ≥ 2` | carga trefvars desde la tie `readtie` (o `tiepres`); si el puerto no existe, `EraseTRefVars` |
| Transferencias `tieloc` negativo | P3 (`Update_Ties`) | `tienum` (o `tiepres`) ≠ 0 | −1 nrg (±1000/−3000, poison-retaliación), −3 venom (±100), −4 waste (±1000), −6 body (+100/−300, poison-retaliación) — fórmulas exactas en `Ties.bas:339-648` y resumen A3 |
| Sharing | P3, solo multibot y ties no-`back` | `mem(830..833)/mem(924) > 0` | redistribución porcentual del total de nrg/waste/shell/slime/cloroplastos (§2.1) |
| `deltie`/`fixang`/`fixlen`/`stifftie`/`tieang1-4`/`tielen1-4` | P3 | según celda (A3) | control de geometría |
| `UpdateTieAngles` | P5 | — | publica `tieang`/`tielen` de la tie seleccionada |

### 2.1 Sharing (multibot)

Patrón común (`sharenrg` `Robots.bas:1955-2007`, `shareslime :1894-1910`,
`sharewaste :1913-1930`, `shareshell :1933-1952`, `sharechloroplasts :1866-1892`):
el porcentaje pedido se normaliza **en la celda** (nrg: `Mod 100`, 0→100; resto:
clamp 0..99), se suma el total de ambos bots y se reparte `pct`/`100−pct`; cada lado
se capa a 32000 — **el exceso sobre el cap se destruye en silencio** (no se conserva
la suma). Particularidades:

- `sharenrg`: el cambio se limita además por el `body` propio y por los rangos del
  otro; cuesta 1% de lo transferido al iniciador; funciona incluso con el otro a 0.
- `shareshell`: publica `mem(823)` en **ambos** bots (`:1950-1951`).
- `sharechloroplasts`: bloqueada si la distancia genética > 0.25 — impone
  `Chlr_Share_Delay = 8` ciclos de castigo (`:1870-1873`; `DoGeneticDistance` se
  especifica en B6); requiere además `Not NoChlr` y delay a 0 (`Ties.bas:160`).
- Las celdas de sharing se ponen a 0 cada P3 **para todo bot**, tenga o no ties
  (`Ties.bas:178-182`): el "comando" debe re-escribirse cada ciclo.

### 2.2 Efectos laterales de leer

`ReadTRefVars` clampa la **velocidad física** del bot atado a ±16000/eje
(`Ties.bas:776-777`) y puede marcar su `View` (con la celda equivocada,
`21-MEMORIA.md §9.4`). `tieportcom`/transferencias marcan los colores de render
(`infused`/`nrgused`/`sharing`).

## 3. Multibot

- **Definición operativa**: `Multibot = True` lo pone `regang` (primera tie endurecida,
  `Ties.bas:982`); `False` cuando `numties` llega a 0 (`Ties.bas:187-190`). No hay más
  escritores. Consecuencia: un organismo "de verdad" exige ties de `.tie` maduradas
  (las de nacimiento nunca endurecen: `last = 100 > 0`).
- **`vbody`**: cada P3, `vbody = body + Σ body de los atados` (`Ties.bas:138,165`) —
  la "masa social" usada por `newshot` para la potencia (`33-SHOTS.md §2.2`) y por
  `robshoot` para los valores de −1/−6.
- **Costes divididos**: casi todos los costes de acción se dividen por `numties + 1`
  para multibots (shots, shell, slime, defacate…; citas en cada documento).
- **`multibot_time`** (restricción de torneo ⚙, `Byte`): especies con `kill_mb`
  arrancan a 210; cada P3 sube si conserva una tie a un conespecífico y baja si no;
  bajo 10, muerte (`Ties.bas:170-175`; siembra en `Globals.bas:492`,
  `main.frm:1573`, herencia `Robots.bas:2257`).
- **Operaciones de organismo** (`Multibots.bas`): `ListCells` recorre el grafo de ties
  de multibots hasta 50 células (`:79-114`); `ReSpawn` traslada el organismo entero
  (usada por los bordes toroidales, `30-FISICA.md §5`); `KillOrganism` (teleporters/UI)
  mata todas las células sin poffs; `FreezeOrganism` es UI.

## 4. Resumen de `[PROBABLE BUG]`

1. **El slot 10 de `Ties` es inalcanzable por creación** (§0.1) y sin embargo el
   corrimiento de `DeleteTie` y la escritura extraviada de `TieTorque`
   (`30-FISICA.md §9.2`) sí lo tocan: es un slot "fantasma" con basura heredable
   (`maketie` no inicializa `.ang`/`.bend` — una tie nueva puede nacer con el ángulo
   rancio del ocupante anterior hasta que `regang` lo pise).
2. **Doble contabilidad del reparto con caps**: todo sharing destruye recurso cuando un
   lado supera 32000 (§2.1) — los multibots gigantes "evaporan" nrg/cloroplastos al
   compartir.
3. **`tieportcom` exige `tienum ≠ 0`** (`Ties.bas:56`) pero luego recorre **todas** las
   ties comparando puertos: un bot con una sola tie de puerto 0 (las de nacimiento) no
   puede usarla para `tieloc/tieval` aunque `tiepres` la seleccione en otras
   operaciones — la comunicación por la tie de nacimiento requiere que el **hijo** use
   su puerto autonumerado, no el padre (cuyo puerto es 0).
4. **Los campos `ln`/`shrink`/`stat`/`mem` de la tie son vestigiales** pero se
   persisten en los saves — un port debe conservarlos en el formato o romper la
   compatibilidad de archivo (cruza con B8).
5. Heredados ya documentados: resets de P3 saltados sin `tienum`/`tiepres`
   (`21-MEMORIA.md §9.8`), `trefshell` nunca borrado, `trefnrg` congelado a 32000,
   `Ties(1).last > 0` como test de "tie de nacimiento" en `DoGeneticMemory` (A3 §5 —
   nótese que cualquier tie con `last > 0` en el slot 1 pasa el test, no solo la de
   nacimiento).

## 5. `[SIN VERIFICAR]`

- `DoGeneticDistance` y su umbral 0.25 (§2.1) — B6.
- El efecto de cargar saves con ties cuyos campos vestigiales traen valores ≠ 0 — B8.

## 6. Preguntas que cierra o alimenta

- **Q03 (Ties) → cerrada**: `Ties(0)` no se usa (todos los bucles arrancan en 1);
  `Ties(10)` es el slot fantasma de §4.1; no hay accesos fuera de 0..10.
- **Q11**: ya resuelta en A3 (§9.9 de `21-MEMORIA.md`).
- **Q01**: 1 RNG por intento de `maketie` (deflect), más los ya contados.
