# 21 — El mapa de memoria

> Documento A3 de la especificación; cierra el Bloque A. Fuente de verdad: el código
> citado sobre el commit `02b20d7`. Cubre `mem(0..1000)`: la tabla de nombres
> (`LoadSysVars`), quién escribe/lee/borra cada posición y cuándo, latencias, la memoria
> genética, y las tres tablas `sysvar`/`sysvarIN`/`sysvarOUT`. El detalle posición a
> posición vive en `spec/sysvars.yaml` (producido en esta misma pasada); aquí van la
> estructura, las reglas transversales y los hallazgos. La spec describe el EXE
> (`OverflowCheck=0`, `BoundsCheck=0`); donde el IDE difiere, se anota.
> Lo raro pero real va `[PROBABLE BUG]`; lo no derivable, `[SIN VERIFICAR]`.

---

## 0. Respuestas centrales

1. **`mem` es `mem(1000) As Integer` — 1001 celdas de 16 bits** (`Robots.bas:265`).
   El ADN solo alcanza `1..1000` (`20-VM.md §0.6`). **`mem(0)` sí recibe escrituras del
   motor**: es el sumidero deliberado de venom/poison cuando la dirección pedida mapea a
   340 (§6). Nadie lo lee. Esto cierra la parte `mem` de Q03.
2. **De las 1000 direcciones, 247 tienen nombre** (tabla `sysvar`: 255 entradas menos
   8 pares de aliases) **y 20 más las usa el motor sin nombre** (971..990, memoria
   genética). El resto — más de 700 — son **memoria libre**: persistente, direccionable,
   heredable solo por vía epigenética explícita (el `mem` del hijo nace borrado,
   `Robots.bas:2180`), guardada entera en los saves (`HDRoutines.bas:2067`).
3. **Latencia universal de los sentidos: 1 ciclo.** Todo lo que el motor escribe para el
   bot (contacto, sabores, visión, refvars, publicaciones de estado) se escribe en los
   pasos 14–16 del tick, después del ADN (paso 10); el ADN lo lee al ciclo siguiente.
   Los comandos del bot se consumen en el mismo ciclo en que se escriben (§3).
4. **Q15: en juego normal, ninguna escritura del motor deja valores fuera de ±32000 en
   `mem()`.** Todos los caminos están acotados por clamps explícitos o por geometría.
   Las excepciones son marginales: el contador de kills sin clamp en la vía de shots
   (wrap a −32768 en el EXE con exactamente 32768 kills), el "fudge" de los modos evo
   (deja 32001), y las escrituras de UI (consola, Player Bot Mode). Los edges de
   `absstore`/`negstore` de `20-VM.md §7` son inalcanzables en la práctica (§7).
5. **Q14 (parte A3): `AbsNum` no se publica en memoria.** `GiveAbsNum` incrementa
   `SimOpts.MaxAbsNum As Long` (`HDRoutines.bas:1587-1599`); el valor vive solo en la
   estructura del bot, se usa para `parent` y display. Overflow: +1 por nacimiento sobre
   un `Long` — inalcanzable en la práctica (quedan las comparaciones para B8).
6. **`sysvarIN`/`sysvarOUT` son el vocabulario de las mutaciones, nada más.**
   Solo las lee `ChangeDNA2` (PointMutation2/CopyError2, `NeoMutations.bas:607-676`):
   `sysvarOUT` para inventar pares `número store` funcionales, `sysvarIN` para inventar
   lecturas `*n` informativas (§8).

---

## 1. Las tres tablas de nombres

`LoadSysVars` (`DNATokenizing.bas:862-3167`) puebla tres arrays en la inicialización
(`main.frm:368`):

- **`sysvar(1000) As var`** (`DNA.bas:25`): la tabla que usa el tokenizador
  (`SysvarTok`, `20-VM.md §8.2`). Entradas 1..255, asignación estática nombre→dirección,
  sin huecos de índice. **Ocho pares de aliases** (dos nombres, misma dirección):
  `aimdx`/`aimright`→5, `aimsx`/`aimleft`→6, `velup`/`vel`→200, `depth`/`ypos`→217,
  `refvel`/`refvelup`→699, `strvenom`/`mkvenom`→824, `strpoison`/`mkpoison`→826,
  `light`/`availability`→923. No hay ningún caso de un nombre repetido con direcciones
  distintas dentro de la tabla.
- **`sysvarIN(255)`** ("informational", `DNATokenizing.bas:1632-2398`): el subconjunto
  de sensores. Las entradas que son comandos están **comentadas** en el fuente.
- **`sysvarOUT(255)`** ("functional", `:2400-3166`): el subconjunto de comandos; los
  sensores comentados. `tieang1-4`/`tielen1-4` (480–487) están **activas en ambas**
  tablas — los autores las consideraban bidireccionales, y el motor lo confirma (§4).

Dos trampas de nomenclatura que el port debe conocer:

- La constante del motor **`Fixed = 216`** (`Robots.bas:42`) corresponde al sysvar
  **`fixpos`**; el sysvar **`fixed` es 215** (el espejo de solo lectura,
  `Senses.bas:207`). Código que "traduzca por nombre de constante" se equivocará.
- **`tieport1 = 450 = TIEANG`** (`Robots.bas:82-83`): la misma dirección con dos
  constantes; `Update_Ties` usa `tp+2`/`tp+3`/`tp+5` como alias de
  `tieloc`/`tieval`/`tienum` (`Ties.bas:133,339,651`).

## 2. El mapa 1..1000: regiones y huecos

| Rango | Contenido |
|---|---|
| 1–12, 18–19 | Comandos de movimiento/disparo + relojes (`robage`, `mass`, `maxvel`, `timer`) |
| **13–17, 20–193** | **Hueco.** La zona clásica de variables privadas (`def` suele mapear aquí) |
| 194–221 | Sentidos por ciclo: velocidades, contacto, sabores, `edge`, `fixed`, posición, `daytime`, `kills`, `hitang` (muerta, §9.6) |
| 222–299 | Hueco |
| 300–315 | Reproducción y cuerpo (`repro`…`rdboy`) |
| 316–329, 332–334 | Huecos |
| 330–331, 335–341 | Ties (`tie`, `stifftie`) y virus/ADN (`mkvirus`…`thisgene`) |
| 342–399 | Hueco |
| 400–402 | Mundo: `sun`, `totalbots`, `totalmyspecies` |
| 403–409 | Hueco |
| 410–429 | Canales por tie: `tout1-10` / `tin1-10` |
| 430–436 | Hueco |
| 437–487 | trefvars + control de ties (`tieloc`/`tieval`/`tienum`, `fixang`/`fixlen`, `tieang1-4`/`tielen1-4`, espionaje `memloc`/`memval`/`tmemloc`/`tmemval`) |
| 472 | Hueco (aislado; un reset comentado lo menciona, `Senses.bas:123`) |
| 488–499 | Hueco |
| 500 | Hueco **con constante** (`EyeStart`): el barrido borra 501..509, nunca toca 500 (`Quads.bas:184-185`) |
| 501–511 | Ojos: `eye1-9`, `eyef`, `focuseye` |
| 512–520, 530 | Huecos |
| 521–529, 531–539 | Configuración de ojos: `eyeXdir`, `eyeXwidth` |
| 540–684 | Hueco (el más grande con 500+) |
| 685–690, 695–715 | refvars del objeto visto |
| 691–694 | Hueco |
| 700 | Hueco **con constante** (`occurrstart`): `lookoccurr` escribe `occurrstart+1..+10` = 701..710; el +0 no se usa (`Senses.bas:230,359`) |
| 716–720 | Hueco |
| 721–731 | Firma propia (`myup`…`myvenom`) |
| 732–799 | Hueco |
| 800–819 | Comunicación por visión: `out1-10` / `in1-10` |
| 820–839 | Química: slime/shell/venom/poison/waste, sharing, `ploc`/`vloc`/`venval`/`pval` |
| 840–899 | Hueco |
| 900–901 | `backshot`, `aimshoot` |
| 902–919, 925–970 | Huecos |
| 920–924 | Cloroplastos |
| **971–990** | **Memoria genética — usada por el motor SIN nombre simbólico** (§5) |
| 991–1000 | Hueco |

**Los huecos son memoria libre real del bot**: ningún código del motor los escribe salvo
dos vías indiscriminadas — `altzheimer` (valores aleatorios ±32000 en direcciones
aleatorias 1..1000 cuando el waste supera `BadWastelevel`, `Robots.bas:983-998`) y los
**shots de memoria** (tipo positivo: `rob(h).mem(tipo) = valor`, dirección
`(tipo−1) Mod 1000 + 1`, exclusión de 340, `Shots.bas:352-357`). Persisten
indefinidamente, se guardan en los saves, y **no** pasan al hijo (el `mem` del recién
nacido nace de un `Erase`, `Robots.bas:2180`, con la única excepción de §5).

## 3. Latencias y políticas de borrado — las reglas transversales

El orden del tick (`10-CICLO.md §2`) impone tres regímenes:

**Régimen A — sentidos con latencia 1.** Escritos después del ADN del ciclo N, leídos
por el ADN en N+1, borrados en el paso 12 de N+1 justo después de ese ADN:

- Contacto (`hit*`, 201, 205–208) — escrito por `touch` desde `Repel3` (P1) y borrado
  por `EraseSenses` (`Senses.bas:98-125`).
- Sabores (`shflav`, `shang`, `shup/dn/dx/sx`) — escritos por `taste` desde
  `updateshots` (paso 14), borrados en el paso 12.
- `edge` (214) — escrito por `bordercolls` (P1), borrado paso 12.
- refvars e `in*` (685–715, 810–819, 473, 477) — escritos por `lookoccurr` desde el
  barrido de visión (P5) **y también** desde colisiones (`Repel3`, P1,
  `Physics.bas:972-973`); borrados por `EraseLookOccurr` en el paso 12.

Matices del borrado del paso 12: la pasada de `EraseSenses` del tick **salta a los bots
con `DisableDNA`** (`Master.bas:340-344`) — los corpses (que ponen `DisableDNA=True` al
formarse, `Robots.bas:1318`) conservan sus últimos sentidos congelados; además
`EraseLookOccurr` tiene su propio salto de corpses (`Senses.bas:352`).

**Régimen B — publicaciones sobrescritas cada ciclo (nunca "borradas").** `pain`/`pleas`/
`bodgain`/`bodloss`, `nrg`, `body`, `robage`, `vel*`, `mass`, `maxvel`, `aim`, `fixed`,
`xpos`/`ypos`, `sun`, `totalbots`, `totalmyspecies`, `slime`, `poison`, `waste`/`pwaste`,
`chlr`, `light`, `daytime`, `tieang`/`tielen`, `paralyzed`/`poisoned`, `dnalen`, `vtimer`,
`genes`, `thisgene`. Si el bot las escribe, el motor las pisa en el mismo ciclo
(P1–P5 según la variable; ver yaml). Son inútiles como almacén.

**Régimen C — comandos consumidos en el mismo ciclo.** El ADN escribe en el paso 10; el
motor consume y borra dentro del mismo tick: `dir*` (P3, tras aplicarse en P1),
`aimsx`/`aimdx`/`setaim` (P3), `tieloc`/`tieval`/`tienum`/`deltie`/`fixang`/`fixlen`/
`stifftie`/`share*` (P3), `mkvirus`/`vshoot`/`delgene` (P3), `shoot`/`shootval`/
`mkchlr`/`rmchlr`/`setboy`/`mk*`/`str*`/`fdbody`/`strbody`/`tie` (P5),
`backshot`/`aimshoot` (al disparar). Excepciones documentadas en el yaml:

- `repro`/`mrepro`/`sexrepro` solo se borran **si la reproducción tiene éxito**
  (`Robots.bas:2391-2392,2824`); si falla una guarda, reintenta cada ciclo.
- `strbody`/`fdbody` solo se consumen si son **positivos**: un valor negativo persiste
  para siempre (`Robots.bas:1272-1273`).
- `shootval` solo se borra cuando `robshoot` corre (`shoot ≠ 0`); solo, persiste.
- Los resets de `fixang`(→32000, no →0)/`fixlen`/`stifftie` están detrás del gate
  `tienum/tiepres ≠ 0` (`Ties.bas:231-232,277-279`): sin selección de tie, persisten.
- Configuración persistente que el motor lee pero jamás borra: `fixpos` (latch),
  `focuseye`, `eyeXdir`, `eyeXwidth`, `memloc`, `tmemloc` (reset comentado adrede,
  `Ties.bas:665`), `readtie`, `out*`/`tout*`, `ploc`/`vloc`/`venval`/`pval`.

**Normalización in place**: varios consumidores **reescriben el valor normalizado en la
propia celda** antes de usarlo — `mkshell`/`mkslime`/`mkvenom`/`mkpoison` (clamp ±32000),
`sharenrg` (Mod 100, 0→100), `share*` (0..99), `stifftie` (Mod 100), `aimshoot`
(Mod 1256), `vshoot` (<0→1). Observable si otro sistema lee la celda después.

## 4. Escrituras cruzadas: quién puede tocar la memoria de OTRO bot

Inventario completo de escrituras en `mem` ajeno (importa para el orden por índice,
`10-CICLO.md §0`):

1. **`tieportcom`** (P1): `rob(pnt).mem(mem(452)) = mem(453)`, dirección validada
   1..1000 (`Ties.bas:56-70`). Arbitraria: puede pisar comandos, sensores o memoria libre.
2. **Shots de memoria** (paso 14): `rob(h).mem(shottype) = value` con dirección
   `(t−1) Mod 1000+1 ≠ 340` y el bloqueo por poison (`Shots.bas:352-364`).
3. **Venom/poison activos** (P1): `mem(Vloc)=Vval` / `mem(Ploc)=Pval` cada ciclo
   mientras dure el contador (`Robots.bas:1118,1127`); `Vloc/Ploc` vienen del atacante
   (§6).
4. **`taste`/`touch`/`lookoccurr` sobre el golpeado/tocado** (paso 14 / P1).
5. **`shareshell`** publica `mem(823)` en ambos extremos de la tie (`Robots.bas:1950-1951`).
6. **Espionaje con efecto**: `memloc` apuntando a un ojo del observado marca su
   `View=True` (`Senses.bas:335-337`); `ReadTRefVars` **clampa la velocidad física del
   bot atado** a ±16000 como efecto colateral de leerla (`Ties.bas:776-777`).
7. **UI/⚙**: consola (`console.frm:362`, escribe `val()` sin límites — error 6 en IDE,
   wrap en EXE), Player Bot Mode (`Master.bas:352-354`), Eye Designer
   (`frmEYE.frm:367-372`), frmRestriOps (`mem(216)=1`).

## 5. Memoria genética: 971–990 y `epimem`

El único puente de memoria entre generaciones (`DoGeneticMemory`, confirmando
`10-CICLO.md §5 P3`):

- **971–975 — instantáneas**: al nacer, el hijo recibe copia directa de las 5 celdas del
  padre (`Robots.bas:2277-2279`; sexual: de la madre, `:2734`).
- **976–990 — diferidas**: al nacer se copian a `epimem(0..14)` del hijo
  (`Robots.bas:2281-2283`, campo `epimem(14) As Integer`, `Robots.bas:264`) y **el padre
  pierde su `epimem`** (`:2285-2287` — "para que no complete su propia transferencia
  usando al hijo"). `DoGeneticMemory` (P3, gate `age < 15`, `Robots.bas:1586`) entrega
  **una celda por ciclo**: `mem(976+age) = epimem(age)`, solo si el hijo mantiene su
  **tie de nacimiento** (`numties>0` y `Ties(1).last>0`) y **solo si la celda del hijo
  sigue en 0** (`:2850-2865`). Cortar la tie o escribir la celda cancela la entrega.
- `epireset` (régimen de mutación acumulada) puede borrar 971–975 y `epimem` del recién
  nacido (`Robots.bas:2395-2406`).
- Al guardar un bot a disco con `UseEpiGene`, `mem(971..990)` se re-exporta como líneas
  de ADN `valor dirección store` añadidas al archivo (`HDRoutines.bas:2274-2282`) — la
  memoria epigenética sobrevive al formato de texto (detalle para B8).
- El `timer` (12) es el tercer canal hereditario: el hijo nace con el valor del padre
  (`Robots.bas:2383,2817`); los fundadores arrancan con `Random(-32000,32000)`
  (`main.frm:1556`) — consume 1 RNG por bot fundador.

## 6. `mem(0)`: cierre de Q03 para `mem`

La cadena: un shot/tie de venom o poison lleva `memloc` (el `vloc`/`ploc` del atacante).
El golpeado calcula `Vloc/Ploc = (memloc−1) Mod 1000 + 1`; **si el resultado es 340
(`delgene`), se sustituye por 0** — protección explícita contra ataques de borrado de
genes (`Shots.bas:802-809,847-854`; `Ties.bas:394-401,462-469,600-607`; con
`memloc ≤ 0`, dirección aleatoria 1..1000 con re-tirada si sale 340 — consume RNG).
`Poisons` (P1) escribe entonces `mem(0) = Vval/Pval` cada ciclo mientras dure el efecto
(`Robots.bas:1118,1127`). `mem(0)`:

- **nunca se lee** (ninguna expresión `mem(0)` de lectura en el motor);
- **no es alcanzable desde el ADN** (`20-VM.md §0.6`);
- **se persiste** en los saves (`Put #n, , .mem()`, `HDRoutines.bas:2067`).

El port necesita la celda (o un sumidero equivalente) para replicar el
comportamiento: sin ella, el remapeo de 340 tendría que escribir en alguna otra parte.

## 7. Q15: ¿escrituras del motor fuera de ±32000?

Barrido exhaustivo de los ~700 accesos `\.mem(` del árbol (Robots 190, Senses 169,
Ties 166, Shots 30, Quads 30, DNA 31 —el intérprete, ya en A2—, Physics 8, Master 5,
Vegs 2, resto UI/código muerto), clasificando cada escritura. Por tipo,
`mem` es `Integer`: nada puede *almacenar* fuera de ±32767. La pregunta real es el
rango (32000, 32767] y el wrap del EXE. Resultado:

- **Todos los caminos regulares están acotados a ±32000** por clamps explícitos
  (`iceil`, comparaciones a 32000, `Mod 32000`) o por geometría (ángulos ≤1256,
  contadores ≤~16000, masas ≤192). El detalle por celda está en el yaml.
- **Excepción 1 — `Kills` sin clamp en la vía de shots** `[PROBABLE BUG]` teórico:
  al matar por shot, `rob(parent).mem(220) = rob(parent).Kills` **sin** el clamp a
  32000 que sí tiene la vía de ties (`Shots.bas:594-595,712-713` vs `Ties.bas:419-421`).
  `Kills As Long`: con 32001..32767 kills, `mem(220)` queda sobre 32000; con exactamente
  32768, el EXE escribe **−32768** (el IDE lanza error 6) — el único camino del motor
  que puede dejar −32768 en `mem` y habilitar el edge de `absstore`/`negstore`
  (`20-VM.md §7`). Mismo caso en `mem(715) = rob(o).Kills` (`Senses.bas:327`).
  Requiere >32000 kills de un mismo bot: irrelevante ecológicamente, pero es la
  respuesta técnica a Q15.
- **Excepción 2 — fudge**: con `FudgeEyes`/`FudgeAll` (modos evo ⚙), los refvars
  trucados hacen `valor + 1` sin clamp: un `refnrg` de 32000 queda en **32001**
  (`Senses.bas:237,242,278-287,299`; `Ties.bas:743-748,796`).
- **Excepción 3 — I/O y UI**: los saves cargan `mem()` en bruto (cualquier Integer,
  incluido −32768, `HDRoutines.bas:1655`); la consola escribe `val()` de texto sin
  acotar (`console.frm:362`).

**Conclusión para el port**: puede asumirse el invariante ±32000 para toda la ecología
normal, con esas tres válvulas documentadas. Q15 queda **resuelta**.

## 8. `sysvarIN`/`sysvarOUT`: para qué existen

Único consumidor: `ChangeDNA2` (`NeoMutations.bas:600-683`), el generador de
PointMutation2/CopyError2. Con 1/3 de probabilidad genera un par funcional
`número store` eligiendo de `sysvarOUT` (`:645-659`, con casos especiales para
`.shoot`/`.focuseye`/`.tieloc` que insertan valores plausibles, `:613-637`); si no,
material informativo: 1/5 un literal grande `sysvar + n*1000` desde la tabla principal
(`:662-667`), 4/5 una lectura `*n` desde `sysvarIN` (`:670-675`). Es decir: **las
mutaciones "saben" qué direcciones son sensores y cuáles comandos**, y sesgan el ADN
nuevo hacia usos con sentido. El intérprete, el tokenizador y el resto del motor no
tocan estas tablas (confirma `20-VM.md §11`). Para el port: son datos del subsistema de
mutaciones (B6), no del mapa de memoria en runtime.

## 9. `[PROBABLE BUG]` de este documento

1. **`refvelsx` (696) siempre vale 0.** `lookoccurr` asigna
   `mem(refvelsx) = mem(refvelsx) * -1` — se niega a sí misma en vez de negar
   `refveldx` — y como `EraseLookOccurr` la dejó a 0, queda 0 (`Senses.bas:319`; mismo
   error en `lookoccurrShape`, `:434`). El sensor de velocidad lateral izquierda del
   objetivo está muerto; `refveldn` (698) sí funciona. Bots que dependan: cualquiera que
   intente interceptar por la izquierda leyendo `.refvelsx` — evolucionó contra un 0
   constante.
2. **`trefshell` (449) nunca se borra.** `EraseTRefVars` limpia 438–448, 456–465, 475,
   478, 479 — y se salta 449 (`Ties.bas:655-677`): tras perder las ties, el bot sigue
   leyendo el shell del último compañero.
3. **`trefnrg` (464) se congela si el atado tiene ±32000 exactos de nrg**: la guarda
   `< 32000` estricta omite la actualización en el caso frecuente "socio a tope de
   energía" (`Ties.bas:721-723`).
4. **El chequeo de espionaje de ojos por tie mira la celda equivocada**: usa
   `mem(479)` (trefaim) en vez de `mem(476)` (tmemloc) para marcar `View` del atado
   (`Ties.bas:756-758`); compárese con la versión correcta de `lookoccurr`
   (`Senses.bas:335`). Consecuencia: espiar ojos por tie no aviva al espiado, y un
   trefaim entre 501 y 509 lo aviva espuriamente.
5. **`mem(220)`/`mem(715)` pueden desbordar** por la vía de kills con shots (§7).
6. **`hitang` (221) no tiene escritor**: el nombre existe (`DNATokenizing.bas:1000`),
   ningún código escribe la celda. Sysvar fantasma; en la práctica es memoria libre con
   nombre.
7. **`strbody`/`fdbody` negativos no se consumen jamás** (`Robots.bas:1272-1273`):
   quedan como basura persistente que además el bot puede leer.
8. **Los resets de `fixang`/`fixlen`/`stifftie` dependen de tener `tienum`/`tiepres`**
   (`Ties.bas:231-232` vs `:277-279`): un bot sin ties que escriba `fixang` conserva el
   valor indefinidamente. Además el centinela de `fixang` es **32000, no 0**
   (`Robots.bas:2196`): 0 es una orden válida ("ángulo 0").
9. **`UpdateTieAngles` corre sobre slots vacíos** y les pone `mem(450)=mem(451)=0`
   (`Robots.bas:1621`; `Ties.bas:87-88`). Sin efecto observable: la celda de un slot
   inexistente se borra igualmente en `posto` al reutilizarse (`Robots.bas:2962-2963`).
   **Esto resuelve Q11.**
10. **`ChangeChlr` no filtra signos una vez dentro** (`Robots.bas:1244-1247`): el gate
    es `mkchlr>0 Or rmchlr>0`, pero luego suma `mkchlr` y resta `rmchlr` con su signo:
    `mkchlr=1, rmchlr=-100` añade 101 cloroplastos en un ciclo, pagando su coste.

## 10. `[SIN VERIFICAR]` de este documento

- El efecto acumulado del **fudge** sobre replays (cuántas extracciones de RNG por ciclo
  en sims con `FudgeAll`): depende de cuántos bots ven/tocan por ciclo; no cuantificable
  estáticamente.
- La semántica completa de `Vloc`/`Ploc` heredados al **cargar saves antiguos** (si un
  save puede traer `Vloc` fuera de 0..1000 y provocar una escritura fuera del array en
  el EXE): los campos se escriben en el save como Integer crudos; el formato se revisa
  en B8 (`60-FORMATOS.md`).
- `eyestrength`/`EyeSightDistance` (las funciones que escalan la visión) quedan para B2
  (`32-VISION.md`); aquí solo se registró qué celdas leen.
- Los valores por defecto de `PB_keys` (Player Bot Mode) y de `Monitor_mem_r/g/b` — UI ⚙.

## 11. Preguntas que este documento cierra o alimenta

- **Q03 → cerrada para `mem`**: `mem(0)` recibe escrituras del motor por la exclusión
  de 340 en venom/poison (§6); nunca se lee; se persiste. (Quedan `Shots()`/buckets
  para sus documentos B.)
- **Q11 → RESUELTA**: `UpdateTieAngles` sobre slots vacíos solo escribe
  `mem(450)/mem(451)=0` de un slot que se borra al reutilizarse — sin efecto observable.
- **Q14 → parte A3 resuelta**: `AbsNum` no se publica en memoria; overflow impracticable.
  Las comparaciones `parent`/`AbsNum` quedan para B8.
- **Q15 → RESUELTA** (§7): sin caminos regulares fuera de ±32000; excepciones Kills
  (wrap teórico a −32768), fudge (32001), I/O.
- **Q01 → ampliada**: consumidores de RNG dependientes de memoria/estado descubiertos en
  esta pasada: fudge de refvars (1 por campo trucado), `altzheimer` (≥2 por iteración,
  con re-tiradas), remapeo aleatorio de `Vloc`/`Ploc` (re-tiradas hasta ≠340),
  `newshot` (2 por disparo), `Vshoot` (1), `maketie` (1), `addgene` (1),
  `Random(-32000,32000)` por fundador en `loadrobs`.
