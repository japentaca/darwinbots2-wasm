# PLAN-EXTENSIONES — funcionalidades restantes del original, por etapas

Ampliación del plan tras cerrar M1..M10 + Ext·Rendimiento + Ext·Bestiary
(`PROGRESO.md`). Objetivo: cubrir **el resto de la superficie funcional del
original** (menús de `MDIForm1.frm`, tabs de `OptionsForm.frm`, `SimOptions.bas`)
que el contrato de casos dorados no exigía. Se ejecuta por etapas independientes,
cada una con su criterio de cierre.

**Principio heredado**: el fuente es la spec. Cada etapa distingue **capa core**
(toca `port/core/`, exige casos nuevos y suite en verde en los 3 modos) de
**capa host** (wasm API + JS/HTML; el core no se toca y la suite queda intacta
por construcción).

**Hallazgo que ordena el plan** (2026-08-26): el core ya implementa casi toda la
configuración del original — toroidal (`Updnconnected`/`Dxsxconnected` en
`physics.hpp:503,518`, `robots.hpp:567,573,1682`), pondmode + gradiente de luz,
día/noche con los 3 modos de sol, física de fluidos/sólidos (densidad,
viscosidad, fricciones, elasticidad, Brown, `ZeroMomentum`, `MaxVelocity`),
decay/corpses, tides, formas con deriva y absorción de shots. Los únicos huecos
de core son los pasos ⚙ del tick (`master.hpp`: 3/6-9 torneo+costes dinámicos,
13 PlayerBot, 22-25 autosave/torneo) y la capa de modos de juego
(`F1Mode.bas`, restart/liga). **La mayor parte del valor pendiente es exponer
lo ya portado.**

---

## E1 · Escenario y física configurables — capa host

La demo expone hoy: campo WxH, Costs 0..70, MinVegs, repoblación, MaxEnergy,
mutaciones on/off, StartChlr. Falta el resto del "General" y "Physics and
Costs" del OptionsForm:

| Grupo | Opciones (SimOptions.bas) | Fuente UI |
|---|---|---|
| Forma del campo | `Toroidal` (= `Updnconnected` + `Dxsxconnected`), y los dos ejes sueltos | OptionsForm "General" |
| Tamaño | slider `FieldSize` 1..15: 1 = F1 (9237×6928); 2..12 = 8000×6000 × N; >12 = ×12 × (N−12) × 2 (`OptionsForm.frm:4075-4099`) | ídem |
| Física | presets Fluid/Solid/Custom (`FluidSolidCustom`), `Density`, `Viscosity`, `CoefficientStatic/Kinetic/Elasticity`, `Zgravity`, `Ygravity`, `PhysBrown`, `PhysMoving`, `PhysSwim`, `ZeroMomentum`, `MaxVelocity`, `FixedBotRadii` | tab "Physics and Costs" |
| Luz y ciclo | `Pondmode` + `LightIntensity` + `Gradient`, `DayNight` + `CycleLength`, `SunUp/SunDown` + umbrales + `SunThresholdMode`, `SunOnRnd` | tab "General" |
| Muerte y decay | `CorpseEnabled`, `Decay`, `Decaydelay`, `DecayType`, `NoShotDecay`, `NoWShotDecay`, `BadWastelevel` | ídem |
| Población | `MaxPopulation`, `KillDistVegs`, `BlockedVegs`, `DisableTies`, `DisableTypArepro`, `DisableFixing` | ídem |
| Energía | `EnergyExType`/`EnergyFix`/`EnergyProp`, `VegFeedingToBody`, `Diffuse`, `Tides`/`TidesOf` | "Energy Management" |

Trabajo: setters/getters wasm (~30 exports triviales o un
`db_sim_set_opt(id, val)` genérico), panel de opciones en la página (misma
estructura de tabs del original), y persistencia de las opciones de la UI.
Cierre: sim toroidal visible (bots cruzando bordes), preset F1 de campo, y
smoke test node que fija cada opción y verifica el campo en el struct.

## E2 · Animaciones e inspección de bots — capa host

Lo investigado de `main.frm` (2026-08-26, conversación de visión):

1. **Destellos de impacto** (`DrawShots`, main.frm:953-971 + paleta
   `FlashColor` :397-404): añadir `flash`+`opos` al dump de shots (el core ya
   mantiene ambos, `shots.hpp:645,712`) y pintar el círculo un frame por tipo
   (rojo −1, blanco −2, azul veneno −3, verde waste −4, amarillo poison −5,
   magenta body −6, cian virus −7). Toggle como el original.
2. **Selección de bot + alcance de la vista** (main.frm:1017-1060,
   `showVisionGridToggle`): clic → bot; export nuevo con los 9 ojos
   [dir efectiva con `EYE1DIR`, semiancho con `EYE1WIDTH`, `EyeSightDistance`,
   valor visto]; arcos cian (encogidos a la distancia vista cuando el ojo ve,
   pluma invertida), ojo con foco en rojo. Doble uso: herramienta de
   diagnóstico de visión.
3. **Inspector**: `db_sim_bot_text` ya existe; panel con nrg/body/mem y ADN.
4. **Vectores de movimiento** (`displayMovementVectors`) y **gauges de
   recursos** (`displayResourceGuages`): flechas de `vel` y barras nrg/body.
5. **Skins** (`DrawRobSkin`, main.frm:838) y **monitor RGB de memoria**
   (`DrawMonitor`): al final, valor menor.

Cierre: los 4 toggles del menú View del original funcionando en la página.

## E3 · Objetos del escenario: formas, laberintos, teleporters — capa host

Menú "Objects" del original:

- **Shapes UI**: alta manual, "Add/Delete Ten Random Shapes", borrar todas;
  toggles ya en core (`shapesAreVisable/SeeThrough/AbsorbShots`, deriva
  V/H + `shapeDriftRate`, `makeAllShapesTransparent/Black`) — solo exponer.
- **Mazes** (`Obstacles.bas:45-208`): 6 generadores (horizontal, vertical,
  espiral, checkerboard, polar ice, trash compactor) — transcribir las
  fórmulas de layout como llamadas a `db_sim_add_obstacle` (host) respetando
  su consumo de RNG si generan aleatorio.
- **Teleporters UI**: alta ya exportada; faltan highlight/delete/delete-all.

Cierre: cada maze reproduce el layout del original a igual campo.

## E4 · Costes dinámicos y torneo del tick — CAPA CORE

Los pasos ⚙ 3 y 6-9 de `Master.bas` (hoy fuera de contrato): ajuste dinámico
de costes (`DynamicCosts`, Costs 51..62: target/sensitivity/upper/lower,
`BOTNOCOSTLEVEL`, `COSTXREINSTATEMENTLEVEL`, `ALLOWNEGATIVECOSTX`,
`AGECOSTMAKELOG/LINEAR`), y `PopLimMethod`. Exige: transcripción fiel,
inventario RNG, casos dorados nuevos (familia E4-*), suite en verde en 3
modos. Es el primer trabajo de core desde M8 — rama + revisión.

## E5 · Modos de juego — core + host

- **F1 / League / Restart** (`F1Mode.bas`, tab "Restart and League",
  `Contest_Form.frm`): condiciones de reinicio, liga, contests.
- **Auto-forking** (`SpeciationForkInterval` y compañía; la auto-especiación
  por distancia ya está en `mutations.hpp`).
- **PlayerBot Mode** (paso 13 ⚙): control manual de un bot desde la UI.
- "Automatically tag by name", "Restriction Overwrites", hidepred.

## E6 · Registro y análisis — capa host

- **Gráficas** (`grafico.frm`, `chartingInterval`): población/energía/especies
  en canvas.
- **Snapshots** ("Snapshot of the living/dead", `DeadRobotSnp`,
  `SnpExcludeVegs`) y safemode backup → descargas del navegador.
- **Philogeny / Gene activations / Console / Find Best** (menú Robot).
- **Database/Survival info** solo si aporta: era MDB de Access.

## E6.5 · Vista enriquecida — capa host (render) · ✅ cerrada 2026-09-24 (ver "Resultado" al final)

Añadida el 2026-09-24 a petición del usuario. **No es superficie del
original**: es una segunda forma de mirar la misma sim, con las ideas visuales
de la v1.5 de otro simulador derivado de DarwinBots (Node + Three.js, carpeta
hermana `IAs varias/simulador genetico`: `ROADMAP.md §V1.5` y
`frontend/src/renderer/{OrganismInstances,SceneEffects,organismColors,behaviorStyles}.js`).
Se toman **solo las ideas**: aquel modelo (dietas, cromosomas, estados de
comportamiento, 3D) no se parece al de DB y no hay código que portar. Todo se
dibuja con Canvas 2D sobre los volcados de la API.

**Numeración.** `E6.5` en vez de renumerar: E7/E8 tienen ~25 referencias
vivas (`PROGRESO.md` ×12, `PROMPT-CONTINUACION.md` ×8, este archivo ×4,
`web/index.html` ×1, más los comentarios de E6 que dicen "rama
`InternetSpecies`, de E7"). `E6.5` ordena sola entre E6 y E7, es ASCII para
grep (`E6\.5`) y deja intactas todas las referencias. Rama:
`e6-5-vista-enriquecida`.

**Reglas de la etapa**
1. **Capa host pura**: cero cambios en `port/core/` (`git diff -- port/core/`
   vacío al cierre) y suite intacta por construcción (172/3465 en los tres
   modos). Lo nuevo va en `wasm/dbcore_api.cpp` (volcados de solo lectura),
   `web/worker.js` y `web/index.html`.
2. **La vista fiel no cambia.** Selector "Vista: Original / Enriquecida"; con
   *Original* el `draw()` actual se ejecuta tal cual, sin una rama nueva por
   bot, y el frame no crece (el volcado extendido solo se pide en modo
   enriquecido). Los 4 toggles del menú View siguen siendo de la vista fiel.
3. **Sin efecto en la sim**: nada de lo nuevo escribe en el `Sim` ni consume
   RNG. Única excepción conocida y a neutralizar: `DoGeneticDistance`
   (`robots.hpp:1027`) suma a `sim.diag.err9_simplematch` si el matching se
   corta — el volcado de la lente de distancia guarda y restaura ese contador
   alrededor de la llamada. Verificación: `.dbsim` byte a byte idéntico tras
   N ticks con y sin vista enriquecida (el mismo control que el lint).
4. **Lección de E6**: nada se publica a ritmo de tick. Los eventos se
   **acumulan** en el host del wasm tick a tick y viajan una vez por frame.

### Datos: qué hay y qué falta

El volcado actual de 20 floats (`db_sim_dump_bots`) ya trae posición, radio,
aim, nrg, color de especie, flags Veg/Fixed/Corpse/Multibot/highlight, body,
waste, venom, shell, slime, poison, Vtimer, cloroplastos y `last*`. Faltan la
**identidad** (el índice es el *slot*, que se reutiliza: sin `AbsNum` no se
puede seguir a un bot entre frames ni detectar muertes), los datos de las
lentes y las acciones. Export nuevo `db_sim_dump_bots_vis(h, out, max)`,
paralelo al de 20 y solo en modo enriquecido, ~12 floats por bot:

`[AbsNum, AbsNum de la madre (parent), generation, Mutations, age, DnaLen,
Kills, acciones (bits), estado (bits), ojos (9 bits), especie (idx), reservado]`

- **estado**: Paralyzed, Poisoned, virus en curso (`Vtimer > 0`),
  `fertilized > 0`, nacido desde el último volcado.
- **ojos**: bit a = el ojo a+1 ve algo (`mem(EyeStart+a+1) > 0`); las
  direcciones se piden solo para los bots en pantalla con zoom (ver LOD), con
  la misma cuenta de `db_sim_dump_focus`.
- **especie**: índice en la tabla de especies, que viaja aparte una vez por
  cambio (nombre para el tooltip y la leyenda) — no strings por frame.

### Acciones del tick (anillo de acción)

Los comandos de `mem` se consumen dentro del mismo ciclo (`21-MEMORIA.md`),
así que después del tick **no queda qué "ejecutó" el bot**. Definición de la
etapa: acción = **efecto observable** del tick, obtenido por diferencia
contra el tick anterior en un estado de host del wasm (arrays por slot,
invalidados cuando cambia el `AbsNum` del slot). `db_sim_vis_observe(h)` se
llama tras cada `db_sim_tick` solo en modo enriquecido y hace OR en la
máscara del bot; `db_sim_dump_bots_vis` la vuelca y la limpia. Bits:

| Bit | Acción | Cómo se observa |
|---|---|---|
| 0 | disparo | shot nuevo (slot libre→ocupado o `age` reiniciado) con `parent` = slot; el tipo (`shottype`) da el color del anillo — criterio exacto de "nuevo" contra `Shots.bas` al implementar |
| 1 | reproducción | hijo con `BirthCycle` = ciclo y `parent` = `AbsNum` de este bot |
| 2 | sexual | `fertilized` pasa a > 0 |
| 3 | tie | un slot de `Ties(1..9)` pasa de vacío a ocupado |
| 4 | movimiento | algún `last*` ≠ 0, o `aim` cambió |
| 5 | shell / slime | `shell` o `Slime` suben |
| 6 | venom / poison | `venom` o `poison` suben |
| 7 | come / mata | `Kills` sube, o `nrg` sube en un no-vegetal (shot de robo) |
| 8 | body | `body` cambia sin nacimiento (`strbody`/`fdbody`) |

Coste acotado: un recorrido O(MaxRobs) de pocos campos por tick, en C++. Se
mide la caída de ticks/s con el modo encendido (objetivo ≤ 5 %).

### Correspondencias visuales

| Canal | Qué muestra | Dibujo (Canvas 2D) |
|---|---|---|
| **Forma** | vegetal / animal / multibot | vegetal: hexágono con borde suave; animal: círculo con nariz en la dirección de `aim`; multibot: círculo con la tie dibujada gruesa y del tono de la especie (las de `db_sim_dump_ties` pasan a primer plano) |
| **Tono** | especie | ya existe: `color` del bot (el del original) |
| **Brillo** | nrg y body | nrg → luminosidad del relleno (escala log 0..32000; desteñido cerca de 0, como el "desteñido con poca energía" de la v1.5). body ya es el **radio** en el original (`FindRadius`); con `FixedBotRadii` el body pasa a la opacidad del núcleo |
| **Anillo de acción** | lo que hizo desde el último frame | anillo fino fuera del cuerpo, un color por bit (tabla aparte tipo `behaviorStyles.js`, con los colores de `FlashColor` para los disparos); se desvanece en ~300 ms; late solo en disparo y reproducción |
| **Morfología** | shell, slime, venom/poison, cloroplastos, ojos | shell = grosor del borde (∝ shell/32000); slime = halo translúcido; venom/poison = púas (azul/amarillo, 3-6 según cantidad); cloroplastos = tinte verde mezclado en el relleno; ojos = marcas en el perímetro en la dirección de cada ojo, rellenas si ven |
| **Eventos** | nacimiento, muerte | nacimiento: destello + línea a la madre (su posición, si sigue viva) durante ~600 ms; muerte: el bot que desaparece (por `AbsNum`) se encoge y se apaga en ~900 ms desde su última posición. El cadáver (`Corpse`) sigue como en el original. Un bot que sale por teleporter no se marca como muerte (el host sabe del `outbox`) |
| **Estado** | parálisis, veneno, virus | contorno punteado / tinte amarillo / puntos cian (baratos, solo con zoom) |

**Nivel de detalle (LOD)** — importa más que en 3D: a zoom 1 un bot mide
~1-2 px (campo de 32000 twips en 900 px), así que la morfología **solo se ve
con zoom**. Regla: cuerpo + tono + brillo siempre; anillo de acción a partir
de ~3 px de radio; borde/halo/púas/tinte a partir de ~6 px; ojos y estado a
partir de ~10 px. Fuera de pantalla no se dibuja nada (culling por la caja
de la cámara).

### Lentes "Color por"

Especie (por defecto: el color del original), nrg, body, generación,
mutaciones, edad, longitud del ADN y **distancia genética**. Rampa continua
tipo viridis (la de `organismColors.js`: `#2c1e6b → #fde725`), normalizada
con el mínimo y el máximo de los bots presentes; leyenda con la rampa y los
extremos. La distancia genética es **al bot seleccionado** (sin selección, la
lente pide elegir uno): `db_sim_vis_gendist(h, ref, out, max)` con
`DoGeneticDistance` (O(DnaLen²) por par), recalculada a ≤ 1 Hz en rebanadas
presupuestadas dentro del loop del worker, nunca por frame.

### Inspección

- **Cámara**: zoom con rueda (centrado en el cursor), paneo arrastrando y
  "Seguir" en el inspector (la cámara centra al bot con foco cada frame; se
  suelta al arrastrar). `whichrob` y el resto del hit-test pasan por la
  inversa de la transformación.
- **Rastro** del bot con foco: sus últimas ~120 posiciones (por frame, en la
  página), en línea que se desvanece; se corta en los saltos de toroide.
- **Tooltip** al pasar el ratón: especie, nrg, body, edad, generación y las
  acciones del último frame, con los datos del volcado (sin ida al worker).
- **Leyenda** plegable: formas, colores de acción y rampa de la lente activa.

### Rendimiento: medición con ~2000 bots

**Línea base medida el 2026-09-24** (Chrome 154, canvas 900×900, 2015 bots +
1836 shots, vista fiel, 40 llamadas a `draw()` sobre una copia del frame
pendiente): **mediana 2,6 ms / p90 3,1 ms** sin toggles; **5,7 / 7,7 ms** con
los 4 toggles del menú View.

Presupuesto de la vista enriquecida con 2000 bots y todas las capas: **p90 ≤
8 ms a zoom 1** (el mismo orden que la vista fiel con todo encendido) y
≤ 8 ms con zoom sobre ~300 bots visibles con todos los detalles. Técnicas si
hace falta: agrupar por estilo (un `Path2D` por color de anillo/estado en vez
de `beginPath` por bot), cuantizar el brillo a ~16 niveles para cachear los
`fillStyle`, culling y LOD. Si ni así, se documenta el techo y se evalúa un
`OffscreenCanvas` en el worker (no WebGL: fuera de alcance). Mismo
procedimiento para medir en ambas vistas, más ticks/s con y sin
`db_sim_vis_observe`.

### Trabajo (orden)

1. API: `db_sim_dump_bots_vis`, `db_sim_vis_observe`, `db_sim_vis_gendist`
   y la tabla de especies; smoke node (campos contra `db_sim_bot_*`, bits de
   acción provocados a mano: disparo, repro, tie, shell; `.dbsim` idéntico con
   y sin la vista).
2. Worker: modo enriquecido (pide el volcado extra, llama a `observe` por
   tick, lente de distancia en rebanadas).
3. Página: selector de vista, cámara, `drawRich()` con capas y LOD, lentes,
   eventos, rastro, tooltip y leyenda.
4. Medición de rendimiento y ajustes; verificación en Chrome.

**Cierre**: suite 172/3465 en verde en los tres modos y `port/core/` sin
diff; smoke node; Chrome con las dos vistas (la fiel idéntica a antes), las
8 lentes, los eventos visibles, seguir + rastro + tooltip, consola limpia y
las mediciones anotadas en `PROGRESO.md`.

**Fuera de alcance**: 3D/WebGL, interpolación entre frames (la v1.5 la
necesitaba porque recibía estado cada 80 ms; aquí llega un frame por rAF),
señales entre bots (DB no tiene el concepto; su análogo, `out1..out5`, queda
para una lente futura), radar de cromosomas y árbol gráfico (la philogeny de
E6 ya cubre el parentesco).

### Resultado (2026-09-24)

Aprobado por el usuario con la sugerencia de dejar la cámara también en la
vista original. Hecho según el plan, con estas desviaciones y hallazgos:

- **Registro de 24 floats** (no 12): los 9 ojos van como dirección por ojo
  (la misma cuenta de `db_sim_dump_focus`) para no necesitar un segundo
  volcado con zoom, más la distancia genética y el último `shottype`
  disparado. Muertes y nacimientos salen de `db_sim_vis_events`; la tabla de
  especies, de `db_sim_vis_species_*` (una vez por cambio).
- **Bit de body solo en no-vegetales**: en los vegetales el body cambia cada
  tick de forma pasiva y el anillo lila tapaba todo (visto en Chrome).
- **Cámara en las dos vistas**, arrancando en zoom 1 = identidad. Verificado
  píxel a píxel: la vista original de la rama y la de `HEAD` (página y worker
  anteriores servidos en paralelo) dan el mismo SHA-256 del canvas tras 60
  ticks con un bot seleccionado y los 4 toggles.
- **Carrera de selección heredada de E2**: un frame armado antes de que el
  worker recibiera el `select` traía `focus = 0` y la página deseleccionaba
  (con "seguir" se notaba). Ahora cada selección lleva un número que vuelve
  en `stats.selSeq`, y solo un frame que ya la conoce puede deseleccionar.
- **Hallazgo de rendimiento**: Canvas rellena mal un path con miles de
  subpaths — con la lente "generación" (todos en 0 → un solo grupo de
  color) `draw()` medía 18 ms. Pintando cada grupo en tandas de 64 formas
  bajó a 4 ms.
- **Salida por teleporter**: en vez de contar el `outbox`, un bot que
  desaparece con su última posición dentro de un teleporter Out/Internet se
  marca como salida (anillo cian) y no como muerte. Es aproximado: con
  cadáveres activados (`CorpseEnabled`, el default) una muerte normal deja
  cadáver y no desaparece, así que el caso ambiguo es raro.
- **LOD final**: anillo ≥ 1,5 px de radio, contorno y nariz ≥ 2,5 px,
  morfología ≥ 6 px, ojos y estados ≥ 10 px.

**Mediciones** (Chrome 154, canvas 900×900, 2164 bots + 4321 shots, 100
llamadas a `draw()` sobre una copia del mismo frame; mediana / p90):

| Vista | draw() |
|---|---|
| original, sin toggles | 3,5–3,8 / 3,7–5,6 ms |
| original, 4 toggles | 6,3–7,3 / 7,7–14 ms |
| enriquecida zoom 1, cualquiera de las 8 lentes | 3,8–4,1 / 4,5–5,5 ms |
| enriquecida zoom 4 (morfología) | 2,2–2,5 / 2,9–3,0 ms |
| enriquecida zoom 12 | 1,5–1,7 / 2,4–2,5 ms |

Presupuesto (p90 ≤ 8 ms) cumplido. `db_sim_vis_observe` con ~2000 bots:
0,23–0,38 ms por tick contra un tick de 73–112 ms (0,3 %); volcado de bots
más el registro extendido: 0,4–0,7 ms por frame.

## E7 · Internet / torneo distribuido — capa host (transporte) + una rebanada de core · ✅ cerrada 2026-09-24

La E/S por búferes (`outbox`/`inbox`) ya funciona entre sims. Falta el
transporte real entre navegadores (la capa ⚙ de `50-MUNDO.md §5`).
Rama: `e7-internet`.

### Qué hacía el original (evidencia)

- **El EXE nunca habló con la red.** `F1Internet_Click`
  (`MDIForm1.frm:1259-1380`) crea el teleporter Internet y lanza un proceso
  aparte, `DarwinbotsIM.exe -in <dir> -out <dir> -name <apodo> -port <p>
  -server <ip>` (`:1347-1354`; "PeterIM" = 198.50.150.51:79). Ese cliente
  externo (no está en el fuente) movía los `.dbo` de la carpeta outbound a un
  servidor y los del servidor a la inbound. El simulador solo escribe y lee
  carpetas: `CheckTeleporters` (`Teleport.bas:175-178`) y `TeleportInBots`
  (`:418-446`). Al apagar, `CloseWindow(pid)` y borra los teleporters
  Internet (`:1361-1372`).
- **Estadísticas**: `writeIMdata` (`main.frm:3126-3181`) deja cada 200 ciclos
  (`:2109-2111`, gate `InternetMode.Visible`) un `<ciclo><seed>.stats` con un
  JSON en la misma carpeta outbound — para el cliente IM, que lo sube.
- **`InternetSpecies`** (`provvisorio.bas:19-22`) **nunca se llena**: grep
  sobre todo el fuente — solo la declaración y la lectura de
  `grafico.frm:3747-3751`. Con `numInternetSpecies = 0` el `While` no entra
  y la serie sale con `InternetSpecies(0).color` = **0 (negro)**. El formato
  que debía alimentarla es `SaveSimPopulation` (`HDRoutines.bas:445-490`,
  también muerto): nombre, población, `Veg` y **color** por especie, "used
  for aggregating the population stats from multiple connected sims".
- `NetEvent.frm` es solo el cartelito "Network event" (`Appear` sin
  llamadores: muerto).

### Decisión de transporte

El port replica la **forma** del original: el simulador (el worker) solo
llena y vacía buzones; un "cliente IM" (`web/imnet.js`, dentro del worker)
los mueve. Dos backends con el mismo protocolo:

1. **`BroadcastChannel`** — pestañas del mismo navegador y origen. Sin
   servidor; funciona también en la demo de GitHub Pages.
2. **Relay WebSocket** — `port/tools/imrelay/relay.mjs`, Node sin
   dependencias: un hub que reenvía mensajes dentro de una sala (y, de paso,
   sirve `port/` estático para no depender de `http.server`).

WebRTC descartado: exige señalización (o sea, un servidor igual) para un
tráfico que son unos pocos KB cada 10 ciclos. El hub no decide nada: el
**destino de cada organismo lo sortea el emisor** entre los pares vivos de
la sala (con `Math.random`, nunca el RNG de la sim); sin pares, el `.dbo`
espera en una cola del emisor (como un archivo en la carpeta outbound con el
cliente desconectado).

### Por qué se abre el core (la parada documentada)

`SaveOrganism` estampa `rob(k).LastOwner = IntOpts.IName`
(`HDRoutines.bas:232`) — el apodo del emisor, que el receptor ve en el
inspector — y `SaveRobotBody`/`LoadRobotBody` leen los globales de proceso
`y_eco_im`, `sunbelt` y `SaveWithoutMutations`. En el port esos globales
son `FormatGlobals` (M5) y el **tick los pasa por defecto**: `UpdateBots`
llama a `CheckTeleporters(sim, t)` y `UpdateSim` a
`UpdateTeleporters(sim)` sin argumento, así que el registro que sale del
tick lleva siempre `LastOwner = ""` y `sunbelt = False` aunque la sim tenga
`sim.sunbelt` encendido. El `.dbo` lo produce el core **dentro** del tick y
el organismo muere en el acto (`KillOrganism`): la capa host no puede
volver a serializarlo, y reescribir los bytes desde fuera sería duplicar el
formato para suplir un global que el core ya modela. Rebanada mínima:

- `FormatGlobals` pasa a `sim.hpp` y `Sim` gana `fmt` (globales de proceso,
  **no** persistidos por `SaveSimulation`, como en el original); el tick lo
  pasa a P0a y al paso 18, con `sunbelt` tomado de `sim.sunbelt` (un solo
  global en VB6).
- Default = el de hoy ⇒ la suite heredada queda intacta por construcción.
- Familia nueva **E7-*** (`70-CASOS-DORADOS.md §14`) con el ciclo de siempre
  (rojo → transcripción → verde) y revisión de rama antes de mergear.

**Segundo hueco, encontrado al diseñar el transporte**: `RemoveExtinctSpecies`
(`Robots.bas:1449-1471`, llamado al final de P6 en `:1645`) estaba en el port
como "mantenimiento sin efecto en `mem()`", y `UpdateCounters` sin los topes
de `MAXNATIVESPECIES` (`:1149-1156`). No toca `mem()`, pero `SpeciesNum` es el
gate de `TeleportInBots` (`> 45` suspende TODA entrada, `Teleport.bas:383`):
sin la poda, cada especie llegada por Internet que se extingue queda en el
registro para siempre, y tras 46 la sim deja de aceptar organismos. Se
transcribe con su caso (E7-05).

### Alcance

| Pieza | Decisión |
|---|---|
| Transporte | ✅ `web/imnet.js` (worker) + `tools/imrelay/relay.mjs` |
| Toggle Internet Mode | ✅ `F1Internet_Click` transcrito en la capa wasm: guardas de `x_restartmode`, apodo "Newbie N" con `Random(1, 10000)` si está vacío, `NewTeleporter(False, False, √FieldHeight·10, True)` + sus propiedades; apagar = borrar los Internet con el bucle hasta `MAXTELEPORTERS` |
| `writeIMdata` | ✅ transcrito (JSON byte a byte, `IMgetname` incluido) en la capa wasm; viaja al relay en vez de a la carpeta outbound |
| `InternetSpecies` | ✅ la llenan los censos de los pares (nombre + color, el esquema de `SaveSimPopulation`); el color de serie cae a negro si no está, como el original |
| `LastOwner` | ✅ con el core (arriba) |
| Poda de especies extintas | ✅ con el core (E7-05): sin ella el gate de 45 especies se cerraba para siempre |
| Eco-IM (`y_eco_im`) | ❌ fuera: es una variante de la carrera evo (`Evo.bas` Next_Stage/UpdateWonF1 con 15 `testrob`, `im.gset`, `MDIForm1.frm:2585-2640`) que E5 dejó fuera; lo que toca a los registros (B8-3, la DQ al cargar) ya está en `formats.hpp` y ahora es alcanzable por `sim.fmt` |
| Liga (`MDIForm1.frm:2536-2790`) | ❌ fuera: es orquestación **local** por disco entre reinicios del proceso (`restartmode.gset`, `FileCopy`, `getfiles`), no usa red; no gana nada con el transporte |
| `NetEvent.frm`, `SaveSimPopulation`, `PipeRPC` (`main.frm:2008-2016`) | ❌ muertos en el original |

### Resultado (2026-09-24)

Hecho según lo de arriba, en tres commits de core/host y uno de revisión:

- **Core** (familia E7-01..E7-06, `70-CASOS-DORADOS.md §14`): `Sim::fmt` y
  `TickFormatGlobals` en P0a/paso 18; `RemoveExtinctSpecies` + topes de
  `UpdateCounters`; y (revisión) el `AddSpecie` completo en `UpdateCounters`
  y la auto-especiación, con el slot de reserva `Specie(76)`. Suite
  **178 / 3544** en los tres modos; la heredada, intacta.
- **Host**: `db_sim_im_enable/disable` (F1Internet_Click), `db_sim_im_stats`
  (writeIMdata con el `vbCrLf` de `Print #`), `db_sim_im_species`,
  `db_dbo_peek`, `db_sim_tp_get/set/copy`, `db_sim_set_iname`/`sim_start`;
  `web/imnet.js`; `tools/imrelay/relay.mjs` + `smoke_im.mjs` (44 checks).
- **Transiciones** (del fuente): sim nueva apaga el modo
  (`OptionsForm.frm:4802`); ronda nueva lo conserva y copia los
  teleporters al handle nuevo sin RNG (`StartSimul` no los toca); cargar
  deja el modo encendido **sin puerto** (el menú de carga no vuelve a
  llamar a `F1Internet_Click`, `MDIForm1.frm:2105-2148`).
- **Hallazgo de host heredado**: el teleporter local de M10/E3 no movía a
  nadie (`teleportHeterotrophs`/`Veggies`/`Corpses` en False); ahora con los
  defaults de `TeleportForm.frm:383-388`.

**Revisión de rama** (agente independiente, contra el fuente): 3 altas, 4
medias y varias bajas; corregidas todas salvo las marcadas:

1. Organismos perdidos en ronda nueva/carga: el outbox se vaciaba DESPUÉS
   del chequeo de rondas (sobre el handle nuevo) y el inbox se descartaba →
   ahora el outbox se vacía antes, `.stats` no sale tras un restart
   (`main.frm:2081`), los teleporters pasan a la ronda nueva y lo recibido
   no cargado queda retenido.
2. `imReattach` desplazaba el RNG 2 extracciones al recrear el puerto tras
   el reseed → eliminado (ronda: copia sin RNG; carga: sin puerto, como el
   original).
3. El relay caía con una URL malformada o con `%00` → try/catch y 400.
4. Clones posibles por acks tardíos → el ack solo vale del par destinatario
   y uno tardío saca el `.dbo` de la cola; el resto se cuenta (`late`).
5. `NewTeleporter` no reinicia el slot → replicado: un `local` viejo
   sobrevive en el puerto Internet (`[PROBABLE BUG]`, `Teleport.bas:164`).
6. Guardado sin los globales de proceso → `db_sim_save` y
   `db_sim_save_organism` los pasan (sunbelt real, `SaveWithoutMutations`,
   apodo); E7-04 dejó de ser trivial.
7. `AddSpecie` mínimo en `UpdateCounters` → E7-06.

Quedan anotadas sin cambio: `Random(1, 10000)` con literales Integer (VB6
opera en Single; el port usa la convención Double de S-01), el `For i As
Byte = 0 To -1` de `extractexactname` (sin confirmar si VB6 da error 6) y
que el relay no autentica `from` (es un hub de sala sin cuentas, como
cualquier sala pública). Y un límite de E5 que E7 destapó: la ronda nueva
del port no conserva las formas (el original las regenera desde
`xObstacle`, `main.frm:1357-1365`); los teleporters sí, desde E7.
→ **Cerrado 2026-09-24 como PP-03** (capa host; `PROGRESO.md`).

**Verificación**: smoke node 44/44 (API directa, dos `worker.js` reales por
`BroadcastChannel` y por el relay, caída de un par con cola y re-sorteo,
carga con IM, 8 rondas con el puerto intacto) y Chrome con dos pestañas
intercambiando organismos reales por los dos transportes (apodo como
`LastOwner`, censos, cartel "Internet Mode", salidas con anillo cian en la
vista enriquecida, consola limpia).

## E8 · Extras de menor valor — capa host · ✅ cerrada 2026-09-24

Eye designer (`frmEYE.frm`), imagen de fondo, monitor RGB, skins, E-Grid y
tray icon. **El core no se abre**: los dos campos del `Type robot` que el
port no tenía (`monitor_r/g/b`, `oaim`/`OSkin`) son de render — ningún
sistema de la simulación los lee — y se modelan en la capa wasm con la
misma forma que el estado de la vista enriquecida (por slot; un AbsNum
distinto = `rob(posto) = blank`, `Robots.bas:2962-2963`).

### Decisiones por pieza (con la evidencia)

| Pieza | Decisión | Evidencia |
|---|---|---|
| Eye designer | ✅ ventana flotante | `frmEYE.frm:322-373`: `txtDir/txtWth_Change` escriben `rob(robfocus).mem(EYE1DIR/EYE1WIDTH + i)` (521..529 / **531**..539) con la conversión implícita String→Integer bajo `On Error Resume Next` (basura o fuera de rango = no se escribe); `showEyeDesign_Click` (`MDIForm1.frm:1635-1643`) llena los campos solo al abrir — los cambios van al foco de ESE momento; "Write DNA ..." escribe `Cond / *.robage 0 = / Start / N .eyeKdir store / N .eyeKwidth store / ' … Stop` con el texto crudo; "Ease of Access": `Costs(COSTMULTIPLIER) = 0`, `mem(SetAim) = 0`, `PhysBrown = 0`. Deshabilitado con F1 (`:1715`). Sin foco, el original escribía `rob(0).mem`: no-op en el port. |
| Monitor RGB | ✅ paso 23 en la capa wasm + `DrawMonitor` en la página | `Master.bas:416-427` copia `mem(Monitor_mem_r/g/b)` a `monitor_r/g/b`; los pasos 24-26 no tocan `mem()` ni crean bots (`:429-554`), así que tras `UpdateSim` es el mismo instante: el worker llama a `db_sim_monitor_capture` tras cada tick. Una escritura de UI entre ticks no se ve hasta el tick siguiente, un bot nuevo vale 0 y con el monitor apagado los campos quedan viejos — todo como el original. `frmMonitorSet.frm`: defaults mem 1 / piso 0 / techo 32000; `LostFocus` (dirección por `SysvarTok("." & texto)` y acotada a 1..999; piso/techo ±32000 y separados por 1); `overwrite` (hay que dar OK una vez: `MonitorOn_Click` avisa si no); presets `.mtrp` = 9 `Integer` binarios. |
| Skins | ✅ (E2 las había omitido) | `DrawRobSkin` (`main.frm:838-866`): polilínea de 4 puntos, `OSkin` recalculado solo cuando `oaim <> aim` (skin o radio nuevos con el mismo aim siguen con la forma vieja), nada para cadáveres, `noeyeskin` con más de 500 RobSize a la vista. La skin de la especie la genera `AssignSkin` (`OptionsForm.frm:3411-3472`) al agregarla — el port nunca la había generado (todos los `Skin` en 0) — y ahora se transcribe (`db_sim_species_assign_skin`). El cuerpo del bot del original es hueco (`FillColor = BackColor`, `main.frm:1081`; contorno en `.color`, `:622`): con skins, la página lo pinta así. |
| Imagen de fondo | ✅ | `loadpiccy_Click`/`removepiccy_Click` (`MDIForm1.frm:1433-1446`, `:1558-1561`) y `Form1.Picture`: tamaño natural en la esquina del form, fija a la ventana, repintada por `Cls`. `BackPic` sobrevive a "Remove": sim nueva y cargar sim la vuelven a poner (`main.frm:1241`, `:1422`), y cancelar el diálogo de "Import" repone la anterior — `[PROBABLE BUG]` replicado. |
| E-Grid | ❌ vestigial | Menú `Visible = False` sin un solo handler (`MDIForm1.frm:803-825`); `InitEGrid` comentado (`main.frm:1324-1325`, `:1503-1504`); `Gridmode` se asigna (`MDIForm1.frm:3128`) y nunca se lee; `EGridEnabled/Width` solo se persisten (`HDRoutines.bas:774-775`, `:1438-1441`), cosa que el formato de sim del port ya hace desde M8. |
| Tray icon | ❌ n/a en web | `TrayIcon.cls` + `stealthmode` (`MDIForm1.frm:1693-1699`, `:1822-1827`; `main.frm:3191-3198`): esconde el proceso en la bandeja de Windows con un popup de ciclos/mutaciones/bots — la barra de stats de la página ya muestra eso. |

### Decisiones de host (documentadas en el código)

- **`AssignSkin` corre sobre un LCG propio**, no sobre el de la sim. En el
  original usaba el global: antes de una sim nueva lo borra el `Rnd -1 :
  Randomize seed/100` de `startloaded`, pero agregar una especie con la sim
  en marcha re-sembraba su RNG con el reloj — eso no se replica. El `Timer`
  del `Randomize` final (Skin(6)) se fija la primera vez por especie, así
  las rondas nuevas conservan la skin (en el original la guardaba la
  especie).
- **Presets `.mtrp`**: `Command1_Click` escribe los `Text` sin pasar por
  `LostFocus`, así que un archivo fabricado podía dejar una dirección fuera
  de `mem()` e indexar fuera de rango en el paso 23 (error 9 → truncaba el
  resto del tick). El port acota esa dirección como `LostFocus` al dar OK.
  Piso y techo quedan crudos (sus consecuencias son solo de render).
- **`If MDIForm1.MonitorOn Then`** (`Master.bas:418`) lee la propiedad por
  defecto de un `Menu`; se toma `.Checked` (lo que usa `main.frm:1122`).
  Solo cambia qué se ve al encender el monitor con la sim en pausa.
- **Caché `OSkin`**: se actualiza al volcar y para todos los bots (el
  original solo al dibujar los visibles); el ritmo de frames del port ya no
  es el de un Redraw por ciclo.

### Hallazgos

1. **`DrawMonitor` desborda con rangos válidos**: `ceil − floor` y
   `monitor − floor` son restas de `Integer`; con piso −32000 y techo 32000
   (valores que la UI acepta) da error 6. Con `ignoreerror` el error sube al
   `On Error Resume Next` de `main()` y **aborta el `Redraw` entero**. La
   página lo replica en lo visible (el pase del monitor se corta); ver el
   hallazgo 2 para lo que no se replica.
2. **El `Redraw` del original escribe en la sim** (`main.frm:422-469`):
   antes de dibujar corre cada bot `pos -= vel − actvel` y al final lo
   devuelve. En `Single`, `(x − d) + d` no siempre vuelve a `x` (medido:
   ~0,35 % de las coordenadas por frame, 1 ulp), así que **con el video
   encendido la trayectoria depende de que se dibuje**; y si el Redraw
   aborta (hallazgo 1, o un `OSkin` fuera de `Integer`) los bots **quedan
   corridos** en `vel − actvel`. El port corresponde al original con el
   video apagado (`visualize = False`). No se replica; queda pendiente de
   decisión del usuario.
3. **Sembrar en un campo chico desborda la pila de wasm** (15 algas en
   4000×3000; con 8000×6000 no pasa): es anterior a E8 (la siembra no se
   tocó) y queda anotado para después del plan.

### Resultado (2026-09-24)

- **wasm**: `db_sim_monitor_capture`/`dump_monitor`, `db_sim_dump_skins`,
  `db_sim_species_assign_skin`, `db_sim_sysvar_tok0` (+ los getters de solo
  lectura `bot_skin`/`bot_aim` para el smoke).
- **worker**: cabecera de frame de 13 floats (`extras`), bloques de monitor
  (nB×3) y de skins (nB×9); mensajes `monitor`, `skins`,
  `eye-read`/`eye-vals`, `setmem` y `sysvar`.
- **página**: toggles "skins" y "monitor RGB", grupo "Menú View (extras)",
  ventanas "RGB Memory Monitor Settings" y "Eye Designer".
- **Verificación**: suite 178/3544 intacta en los tres modos; smoke
  `tools/e8/smoke_e8.mjs` **30/30** y `smoke_im.mjs` 44/44; en Chrome,
  skins sobre el cuerpo hueco, monitor configurado por nombre de sysvar
  (`nrg` → 310) con 49 cajas de color y 0 con el rango que desborda, fondo
  cargado / quitado / repuesto por sim nueva, y eye designer escribiendo con
  las reglas de VB6 (`2.5` → 2, `&H10` → 16, `abc` → nada); consola limpia.

**Revisión de rama** (agente independiente, contra el fuente): sin
hallazgos altos; tres bugs reales corregidos — la Skin(6) se re-sorteaba en
cada sim nueva (el `Timer` pasa a fijarse por especie en el worker, con su
caso en el smoke), el orden de dibujo (ahora en pases completos como
`DrawAllRobs`, `main.frm:1076-1116`: con el cuerpo hueco opaco, el bot
siguiente tapaba la skin del anterior) e `IsNumeric`/`Val` con `&H` en la
dirección del monitor. Quedan documentados sin cambio: el gate
`y_eco_im = 2` del eye designer (el port no modela eco-IM), que el abort del
Redraw también saltea teleporters y shots (la página los pinta antes de los
bots), el tramo parcial de una skin que falla, la `r` vieja del bucle de
visibilidad de `main.frm:1100-1112`, y `AssignSkin` sobre bytes UTF-8 (el
original usa `Asc` ANSI: otra skin para nombres con tildes).

## Añadidos fuera del plan (2026-09-25/26) — capa host

Trabajo pedido por el usuario después de cerrar el plan, con la revisión
del port contra VB6 en pausa (`REVISION-PORT.md`, tras el piloto 14). No se
planificó por etapas; se registra aquí para que el plan refleje lo que
existe. Todo es capa host: `port/core/` sin cambios y suite intacta
(270/4092).

| Pieza | Commits | Qué es | Relación con el plan |
|---|---|---|---|
| Inventario de bots | `a3a41ea`, `9e85cea` | `web/inventory.js`: búsqueda, filtros por 30 capacidades, arquetipos, tags, favoritos, notas, selecciones con nombre y siembra en lote (IndexedDB). Perfil genético offline con `tools/bestiary/analyze_bots.js` | amplía la extensión Bestiary; no es superficie del original |
| Laboratorio de híbridos | `a3a41ea` | `web/lab.js`: un ADN con genes de varios bots, con avisos de memoria propia y remapeo de colisiones; guarda los híbridos y los resuelve por nombre al cargar una sim (RV-40) | no es superficie del original |
| Ajustes F1 y panel de costes | `1750216` | `btnSetF1_Click` (`OptionsForm.frm:2579-2668`) y el grupo "Costs" editable, más `MaxPopulation`. Antes los costes llegaban siempre en 0 | **completa E1/E5**: es superficie del original que había quedado fuera |
| Contest F1 | `1384c9d`, `5fc5d36`, `8f8323e` | `web/contest.js`: prepara y arranca el torneo en un clic, con marcador y revancha. "Wins to take it" fija `Maxrounds` (opción 98, `F1Mode.bas:352-359`) | amplía E5 (el contest ya existía en el core; esto es la UI) |
| Canal de TV F1 | `50e9a86`, `ef1a16f`, `5fc5d36`, `8f8323e` | `web/channel.js`: peleas encadenadas al azar, rey de la colina, "Hall of Fame". Tope de ciclos por ronda con `db_sim_f1_cap` (generaliza a N especies el "kill losing species" de `F1Mode.bas:333-347`) | no es superficie del original |
| Bestiary sin duplicados | `fd1774f` | quita las 20 copias con ADN idéntico y da nombres únicos: 568 bots | extensión Bestiary |
| Cache busting de Pages | `42837c2` | `?v=<commit>` en scripts, worker y wasm | despliegue |
| Interfaz en inglés | `f5b03ef`, `1160031`, `39afa70`, `5e86d67`, `9ed1f99`, `64c62a3`, `23b4587` | T1-T6: página, módulos, worker, pistas del lint y Bestiary. Los comentarios y las claves internas siguen en español | ver la nota de abajo |

**Nota para leer las etapas anteriores**: las secciones E1-E8 y E6.5 citan
etiquetas de la UI en español ("Vista: Original / Enriquecida",
"seguir", "Menú View (extras)"…). Es el texto del diseño y se deja tal
cual. En la página actual son "View: Original / Enriched", "Color by",
"follow", "View menu (extras)", etc.

## E9 · Sexualidad visible — capa host

Añadida el 2026-09-26 a petición del usuario. **No es superficie del
original**, igual que E6.5. La reproducción sexual ya está portada entera
(M7: `takesperm`, `SexReproduce` y el crossover, `36-REPRO.md`), pero en la
web solo se ve el anillo rosa de "fertilized" de E6.5. Esta etapa la hace
observable: cuánto sexo hay, entre quiénes y qué gana una especie sexual
frente a una asexual. **Descartado**: los sexos en el motor (macho/hembra).
No existen en el original y se pueden programar en el ADN
(`animal_minimal_gender_Shadowgod2`). Rama: `e9-sexualidad`.

**Reglas**: las tres de E6.5. Cero cambios en `port/core/` y suite intacta
por construcción. Nada escribe en el `Sim` ni consume RNG (`.dbsim` byte a
byte idéntico con y sin la etapa). Los eventos se acumulan en el host del
wasm y viajan una vez por frame.

### Qué se puede observar sin tocar el core (del orden del tick)

Dentro de un tick: paso 14 `updateshots` → `takesperm` pone
`fertilized = 10` y copia el ADN del shot a `spermDNA`. Paso 16, P5:
`ManageReproduction` descuenta 1 y encola el sexo si queda `≥ 0`. P6:
`SexReproduce` deja a la madre en `−1` si hay hijo (`robots.hpp:1537`) o en
`−18` si la distancia genética supera 0,6 (`:1306`). Así que, comparando
el `fertilized` de cada slot antes y después del tick (`v.fert`, que el
observador de E6.5 ya guarda):

| Evento | Criterio post-tick |
|---|---|
| **fecundación** | un shot −8 con `flash` cuyo `dna` es igual al `spermDNA` del bot, y el bot con `fertilized` = 9 (o −1/−18 si el sexo se resolvió en el mismo tick) |
| **nacimiento sexual** | hijo nuevo cuya madre pasó a `fertilized = −1` desde `≥ 1`, o desde cualquier valor si la fecundó un shot en este tick. Un `0 → −1` es caducidad, no sexo. Como una madre puede encolarse dos veces (A1-5), un éxito sexual cuenta **un** hijo sexual y los demás de esa madre en el tick son asexuales |
| **rechazo** | la madre queda en `fertilized = −18` exactamente (solo `SexReproduce` pone ese valor; los ticks siguientes suben a −17…) |
| **donante** | `parent` del shot −8 de la fecundación: es el **slot** del tirador (`sim.hpp:68`). Su `AbsNum` se toma de la foto de antes del tick, porque P6 puede reocupar ese slot |

Los criterios se confirman contra el fuente al implementar. Los casos que
quedan ambiguos se documentan: varios esperma sobre el mismo bot en un
tick (gana el último `takesperm`; el `dna` identifica cuál) o clones del
donante con el mismo ADN (se elige el shot más cercano).

### Piezas

1. **Contadores y gráfica** — `db_sim_sex_stats`: fecundaciones,
   nacimientos sexuales y asexuales, y rechazos, acumulados desde el
   arranque de la sim y por especie de la madre. Contador en la barra de
   estadísticas ("births: N asex / M sex") y una gráfica nueva
   **"Reproduction"** con el aspecto de las de E6 y el mismo
   `chartingInterval`, con las 4 series por intervalo. No se agrega como
   `graphNum` a `CalcStats`: esas son las del original y no cambian. El
   observador pasa a correr **siempre**, no solo con la vista enriquecida,
   porque sin él no hay conteo. Su coste medido en E6.5 es 0,3 % del tick;
   se vuelve a medir. Los contadores no se guardan en el `.dbsim` (son
   estado de host): cargar o empezar una ronda los pone a cero, con un aviso
   en la gráfica.
2. **Vista enriquecida** —
   - Mientras un bot está fecundado, una línea punteada rosa hacia el
     donante (si sigue vivo y en pantalla). El `AbsNum` del donante se añade
     al registro de 24 floats en el campo reservado, o como float 25.
   - El evento de nacimiento gana las coordenadas del padre: un hijo sexual
     dibuja dos líneas (madre y padre) en vez de una.
   - **Lente "fertility"** (selector "Color by"; la UI está en inglés desde T1-T6), categórica en lugar de viridis:
     fecundado (tono según los ciclos que le quedan, 9…0), bloqueado por
     rechazo (`< −10`) y sin esperma. Leyenda con las 3 clases.
   - En el inspector: `fertilized`, AbsNum y especie del donante, y la
     distancia genética madre–esperma cuando existe
     (`DoGeneticDistance` sobre `spermDNA`, con el contador `err9` guardado
     y restaurado como en la lente de distancia).
3. **Escenario "Sexual vs asexual"** — un preset más en "Seed species" que
   siembra algas, `Animal_Minimalis_4G_Numsgil` (asexual) y
   `Animal_Minimalis_Amorous_EvoBot` (su variante sexual), en la misma
   cantidad y energía, con colores fijos y distintos. Activa las mutaciones
   y abre la gráfica "Reproduction" junto a la de población. **Riesgo**:
   Amorous solo se aparea con `robage > 16000`. Si en Chrome no se ven
   nacimientos sexuales en un tiempo razonable, se cambia a otra pareja
   del bestiario (LoveBot, SexBot) y se deja escrito el porqué.

### Trabajo (orden)

1. API: observador de sexo dentro de `db_sim_vis_observe` (que corre
   siempre), `db_sim_sex_stats`, el donante en el registro extendido y en
   los nacimientos, y el volcado del inspector. Smoke node
   `tools/e9/smoke_sex.mjs` con dos bots sexuales en contacto: una
   fecundación, un nacimiento sexual con madre y padre correctos, un rechazo
   por distancia forzado con ADN muy distinto, y un doble encolado
   asexual+sexual que cuenta 1 + 1. `.dbsim` idéntico con y sin observador.
2. Worker y página: gráfica "Reproduction", contador, línea al donante,
   lente, inspector, preset.
3. Chrome: el escenario corriendo con nacimientos de los dos tipos, las
   gráficas y la vista fiel sin cambios. Medición de ticks/s con el
   observador siempre encendido.

**Cierre**: suite 270/4092 (o la vigente) en verde en los tres modos y `port/core/` sin
diff. Smoke E9 en verde, más `smoke_e8`, `smoke_im`, `smoke_formas` y
`smoke_campo`. Verificación en Chrome con la consola limpia. Fila en
`PROGRESO.md`.

## E10 · Ligas — capa host

Añadida el 2026-09-27 a petición del usuario. **No es superficie del
original**. El original tiene un modo liga por carpetas (`F1Mode.bas:380-500`:
`league\stepladder`, `seeded`, `roundN`, `populateladder`) que no guarda
reglas ni estadísticas; la escalera queda como formato opcional de L3. Hoy
la web tiene las piezas sueltas: "F1 settings" pisa el panel, el Contest
guarda su lista en `localStorage`, el Canal guarda su config y el Hall of
Fame por separado, y ningún resultado recuerda con qué reglas se jugó. Esta
etapa reúne todo en un objeto **Liga** con reglas, participantes, formato,
historial y estadísticas. Rama: `e10-ligas`.

**Reglas**: cero cambios en `port/core/` y suite intacta. El único cambio
fuera de `web/` es un parámetro nuevo de `db_sim_f1_cap` (wasm, capa host,
ya fuera de la fidelidad). Nada nuevo escribe en el `Sim` ni consume RNG
fuera de lo que ya hace un contest.

### Decisiones (del usuario, 2026-09-27)

- **Formato elegible en el panel de la liga**: *rey de la colina* (el
  Canal actual: el ganador se queda y se retira invicto con R victorias
  seguidas) o *todos contra todos* (duelos de cada pareja, a una o dos
  vueltas).
- **Varias ligas con los mismos bots**: los participantes no son de una
  liga; cada liga los toma del Inventario. Así "F1 clásica" y "F1 con coste
  de edad" pueden tener la misma plantilla y compararse.

### Modelo (IndexedDB `darwinbots-ligas`, base propia)

- **`leagues`** `{id, name, notes, created, season, format, rules, fmt}`:
  - `rules`: la foto del panel de opciones. Cada control de `aside` con
    `data-id`, `data-cost` o `data-key`, más `o-fsize`, `o-fw`, `o-fh` y
    `o-shape`, como `{id del elemento: valor}`. Aplicar = poner a 0 los
    costes 1..70 que el panel no muestra (lo que hace `applyF1Settings`),
    escribir cada control y disparar su `change`. Se crea desde una base
    (**F1**, **sin costes**) o con **"capturar el panel actual"**, y se
    retoca en el editor.
  - `fmt`: lo del contest: bots por especie, energía inicial, rondas
    mínimas, victorias para ganar (`Maxrounds`), tope de ciclos, **criterio
    del tope** (`pop` = más bots, como hoy; `nrg` = más nrg + body×10), y
    para rey de la colina: luchadores por pelea y racha de retiro; para
    todos contra todos: vueltas (1 o 2).
- **`entrants`** `{league, season, name, color, dna, dnaHash, src}`: el ADN
  queda **congelado** al inscribirlo. Editar un híbrido después no cambia
  la liga (es otro participante) y exportar no depende del Bestiary.
- **`matches`** `{id, league, season, no, date, fighters[], seed, winner,
  wins[], rounds, cycles, capRounds, note}`: `seed` más reglas más ADN
  reproducen el partido (el core es determinista). `note` distingue
  extinción, tope, victorias y nulo.
- **Temporadas**: las reglas se bloquean en cuanto hay un partido. "Nueva
  temporada" las desbloquea, copia los participantes y deja el historial
  anterior consultable. Las estadísticas son siempre de una temporada.

### Estadísticas (derivadas del historial, nada guardado aparte)

Tabla de posiciones (PJ, G, P, % de victorias), **Elo** (K = 32; en una
pelea de N, el ganador le gana a cada uno de los demás con K / (N − 1), así
una pelea de muchos no vale más que un duelo), matriz de
enfrentamientos directos, ciclos promedio por partido y **% de rondas
decididas por el tope**, que delata a los que ganan quedándose quietos. En
una liga, el Hall of Fame del Canal pasa a ser esta tabla.

### Piezas y trabajo

**L1 · Liga y partidos a mano**
1. `web/league.js`: la base, el modelo y la ventana **"🏟 Leagues"**: lista de
   ligas; crear, renombrar y borrar; el editor de reglas y de `fmt` (con
   el selector de formato); los participantes desde el Inventario (todo,
   favoritos, tag, selección o uno a uno).
2. **"Play next match"**: el calendario lo decide el formato (todos contra
   todos: la primera pareja pendiente; rey de la colina: campeón contra
   retador sorteado). Aplica las reglas y lanza con `contestLaunch`
   (fuente `form` con el ADN congelado), y al `f1-over` registra el partido.
3. `db_sim_f1_cap(h, mode)`: `mode = 1` elige por nrg + body×10. El
   mensaje `f1-cap` del worker lleva el criterio.
4. Tabla de posiciones, Elo e historial en la ventana.

**L2 · La liga en la TV**
1. Canal: selector **"League"** (ninguna = el Canal libre de hoy, que queda
   igual). Con una liga, el Canal juega su calendario sin intervención,
   aplica sus reglas en cada pelea (y no solo en la primera) y registra
   cada resultado.
2. Todos contra todos en el Canal: sigue por donde quedó y, al terminar la
   vuelta, anuncia al campeón de la temporada y se apaga.
3. Enfrentamientos directos, ciclos promedio y % por tope. Temporadas.

**L3 · Compartir y repetir**
1. Exportar e importar una liga (JSON con reglas, participantes con su
   ADN e historial).
2. **Repetir** un partido del historial con su semilla, con un aviso si
   el resultado no coincide.
3. Opcional: la escalera del original como tercer formato.

**Cierre de cada parte**: suite en verde en los tres modos, `port/core/`
sin diff, los smokes de host en verde, verificación en Chrome con la
consola limpia y fila en `PROGRESO.md`.

### Resultado L1 (2026-09-27)

Hecha en `web/league.js` (ventana "🏟 Leagues", botón en la barra). Tal
como el diseño, con estos ajustes:

- **Editor de reglas**: no duplica el panel. "Load into the panel" escribe
  las reglas en Sim options, se retocan ahí y "Save the panel as rules" las
  guarda; la ventana muestra un resumen (campo, costes distintos de 0) y
  cuántos controles del panel difieren. Los ids de modo de juego que fija
  cada partido (91, 97-100) quedan fuera de la foto.
- **"Most energy"** mide nrg + body×10: el body se reparte al reproducirse,
  así que tener muchos hijos no suma. Smoke: 3 bots flacos contra 2 gordos
  (`tools/e10/smoke_liga.mjs`, más el calendario de todos contra todos).
- **Hallazgo**: después de lanzar un partido, el Contest y el Canal
  recibían mensajes y frames de la sim anterior (un `f1-over` viejo cerraba
  el partido nuevo). La liga y el Canal ignoran todo hasta el
  `f1-started` del censo nuevo (el worker atiende en orden). Además,
  `f1-over` trae el marcador final y los ciclos jugados (`f1CycAcc` del
  worker): con la pestaña en segundo plano casi no llegan frames.
- Verificado en Chrome: temporada de todos contra todos de 3 (3 partidos,
  temporada completa, nueva temporada) y rey de la colina de 3 por pelea
  con retiro a las 2 victorias; el Canal sin liga sigue igual. Consola
  limpia.

### Resultado L2 (2026-09-27)

- **Canal con liga**: selector "League" arriba de la ventana del Canal
  ("no league: free channel" deja el Canal de siempre). Con liga se ocultan
  el lineup y el pool; del Canal queda solo la pausa entre peleas. Cada
  pelea sale de `lgNextFixture` y se lanza con `lgPlay` (nueva, separada
  de `lgPlayNext`), que aplica las reglas de la temporada **en cada pelea**.
  La liga registra (`lgRecord`) y avisa al Canal con
  `channelOnLeagueResult`: no hay doble registro y el Salón de la fama no
  se toca. El campeón y la racha del Canal salen del historial de la liga
  (`lgKothState`).
- **Todos contra todos**: el Canal sigue el calendario por donde quedó; al
  completarlo anuncia al campeón de la temporada (primero de la tabla),
  deja un rótulo 20 s sobre el campo y se apaga.
- **Tabla**: con liga, el "Hall of Fame" del Canal muestra la tabla de la
  liga. En la ventana de ligas, "Head to head" (fila le ganó a columna,
  hasta 14 participantes) y la columna ⏱ de ciclos promedio por partido.
- **Una sola liga activa**: el calendario lee `lg.matches` de la liga
  abierta. Cambiar de liga en la ventana apaga el Canal que juega otra; con
  el Canal apagado, su selector sigue a la liga abierta. Apagar el Canal no
  abandona el partido en curso: se registra al terminar (o "Abandon").
- Smoke: `smoke_liga` suma rey de la colina (retiro y campeón nuevo),
  enfrentamientos directos y Elo de suma cero (18/18). Verificado en
  Chrome: temporada de todos contra todos completa desde el Canal con el
  rótulo final, rey de la colina con retiro, cambio de liga con el Canal
  encendido y el Canal libre sin cambios. Consola limpia.

### Resultado L3 (2026-09-27) — E10 completa

- **Exportar / importar** (⬇ / ⬆ junto al selector de ligas): un JSON
  `{kind: 'darwinbots-league', version: 1, league, matches}` con la liga
  entera (temporadas con reglas, formato y participantes con su ADN) y
  sus partidos sin id. Al importar, id nuevo, nombre con "(imported)" si
  ya existe, partidos reasignados y validación (tipo, versión, temporadas,
  nombre y ADN de cada participante). `lgExportObj` / `lgImportObj` son
  puras: el smoke hace la ida y vuelta.
- **Repetir** (↻ en cada fila de "Matches", también en las temporadas
  pasadas): `lgPlay(L, fx, {replay})` aplica las reglas y el formato de
  **esa** temporada, siembra los mismos participantes en el mismo orden y
  fija `#seed` a la semilla del partido. No se registra: `lgRecord`
  compara ganador, victorias y ciclos, avisa si difieren y marca la fila
  (✓ / ≠, en memoria). Los partidos de antes de que `f1-over` trajera el
  marcador (0 ciclos) comparan solo el ganador.
- **Determinismo verificado en Chrome**: 10 repeticiones idénticas en
  ganador, victorias y ciclos: duelos de todos contra todos con rondas
  decididas por el tope ("most energy"), temporadas pasadas, rey de la
  colina de 3 por pelea, a velocidad 4 con la pestaña en segundo plano,
  cambiando la velocidad a mitad del partido, y desde una liga importada.
  La semilla, las reglas, el ADN y el orden de siembra reproducen el
  partido; el tope del host (`f1-cap`, después de cada tick) no depende de
  los frames.
- **Escalera** (`populateladder`, `F1Mode.bas:443-500`) como tercer
  formato ("Step ladder"): los participantes entran en el orden de
  inscripción, el primero ocupa el peldaño 1, y cada aspirante desafía
  desde arriba hacia abajo (sembrado peldaño, aspirante, como robotA y
  robotB); si gana, ocupa ese peldaño y empuja a los demás; si pierde con
  todos, queda último. `lgLadderState` la deriva del historial; la tabla
  sigue el orden de la escalera y el Canal la juega hasta el final como
  todos contra todos.
- **Sorteo de participantes** (a pedido del usuario, tras probar la web
  publicada): una liga vacía ya no apaga el Canal con "needs at least 2
  entrants". Con menos de 2 participantes, el Canal muestra "draws N at
  random from the pool" (el pool del Canal libre, 8 por defecto) y al
  encenderse los inscribe con el ADN congelado (`lgDrawRandom`). En la
  ventana de ligas, "🎲 N at random" sortea del Bestiary entero.
- Encender el Canal o el Contest abandona una repetición en curso, como
  un partido normal. Smoke `smoke_liga` 25/25 (escalera y exportar e
  importar); Chrome con consola limpia.

---

## E11 · Torneos unificados — capa host (reingeniería de Contest, Canal y Ligas)

Añadida el 2026-09-27 a petición del usuario, después de probar E10 en la
web publicada: "aún es confuso el manejo de las ligas, los settings del
componente ligas y del diálogo Channel". **No es superficie del original**
(el Contest, el Canal y las Ligas son añadidos de host). Rama sugerida:
`e11-torneos`, desde `main`.

**Reglas**: cero cambios en `port/core/`, suite intacta (270 / 4092 en los
tres modos) y ningún cambio en el wasm. Se conserva todo lo decidido en
E10: ADN congelado al inscribir, reglas y formato bloqueados con el primer
partido de la temporada, Elo con K = 32 / (N − 1), "most energy" = nrg +
body×10, repetición con semilla, exportar e importar, escalera, sin
`alert`/`confirm`/`prompt` nativos.

### Diagnóstico: cómo están repartidos los valores hoy

| Valor | Sim options (Game modes) | Contest | Channel (libre) | Liga (`fmt` / `rules`) |
|---|---|---|---|---|
| Rondas mínimas | `97` "Minimum rounds" | "Minimum rounds" | "…per fight" | "…per match" |
| Victorias para ganar | `98` "Rounds-won cap" | "Wins to take it" | "Wins to take the fight" | "Wins to take the match" |
| Tope de ciclos | `99` (core, solo duelos) | "Cycle cap" → `99`, solo duelos | tope del host (`f1-cap`), N especies | tope del host + criterio (bots / energía) |
| Población máxima | `100` (solo duelos) | sí, solo duelos | — | — |
| Bots por especie | `sp-qty` del formulario | uno por participante | uno para todos | uno para todos |
| Energía inicial | — | sí | sí | sí |
| Reglas del mundo | botón "F1 settings" | checkbox F1: pisa el panel | checkbox F1: pisa el panel solo en la 1.ª pelea | foto (F1 / panel / sin costes) + cargar/guardar |
| Participantes | — | búsqueda, híbrido, selección, formulario, Animal Minimalis (localStorage) | sorteo por pelea desde un pool | pool, híbrido, formulario, 🎲 al azar; con liga vacía, el Canal sortea |
| Luchadores por pelea / retiro | — | — | sí | sí (rey de la colina) |
| Pausa entre peleas | — | — | sí | — (la toma del Canal) |
| Resultados | — | solo el marcador | Hall of Fame (localStorage) | tabla, Elo, enfrentamientos, historial, ↻ |
| Semilla | barra superior | nueva en cada Rematch | nueva por pelea | guardada por partido |

**Solapamientos**: (1) el mismo valor con tres o cuatro nombres en tres o
cuatro lugares, y `contestLaunch` reescribe `91` y `97-100` del panel en
cada partido, así que editarlos ahí no sirve; (2) dos "topes de ciclos"
distintos con el mismo nombre (el del core se apaga con más de 2
especies); (3) tres formas de aplicar las reglas (checkbox que pisa el
panel, foto de la liga, y el Canal con liga que oculta lo suyo); (4) el
Canal es a la vez un torneo propio y un reproductor de ligas; (5) una liga
se juega desde dos ventanas, de ahí "una sola liga activa" y "cambiar de
liga apaga el Canal"; (6) dos selectores de participantes y dos sorteos
distintos; (7) tres marcadores en vivo iguales.

### Decisiones (del usuario, 2026-09-27)

- **Todo es un torneo.** El Contest es una liga de un solo partido; el
  Canal **no es un torneo sino un lanzador de ligas en bucle**.
- **Una sola ventana, "🏆 Tournaments"**, que reemplaza a Contest, Channel
  y Leagues, con pestañas **Setup / Play / Results**.
- **Un único juego de valores del partido**, con un solo nombre cada uno:
  bots por especie, energía inicial, rondas mínimas, victorias para ganar,
  tope de ciclos + criterio. **El tope es siempre el del host** (sirve
  para N especies); los topes `99` y `100` del core salen de los torneos
  (siguen en Sim options para el F1 manual del original).
- **Reglas del mundo siempre como foto** (presets F1 / sin costes / panel
  actual; editar con "Load into the panel" y "Save the panel as rules").
  Desaparecen los checkboxes "Use F1 league settings" que pisan el panel.
- **Canal = TV mode de la pestaña Play**: se elige una liga (la plantilla:
  reglas, formato y valores del partido); el Canal lanza una **edición**
  (temporada nueva) que **sortea N bots al azar del pool**, juega el
  calendario completo según el formato, anuncia al campeón (rótulo),
  pausa y lanza la edición siguiente con un sorteo nuevo, sin fin.
  Desaparece el Canal libre (rey de la colina con sorteo por pelea y
  Hall of Fame propio).
- **El sorteo es de la liga**: fuente de participantes *lista fija* (a
  mano) o *sorteo de N del pool en cada temporada* (pool: Bestiary,
  favoritos, tag o selección del Inventario). El TV mode sortea siempre en
  cada edición con el pool y la N de la liga (por defecto el Bestiary y 8).
- **Hall of Fame = tabla histórica de la liga**: suma todas sus
  temporadas (títulos de temporada, temporadas jugadas, partidos, victorias
  y Elo acumulado). La tabla de cada temporada sigue igual.
- **El rey de la colina termina**: la temporada la gana **el primero que
  se retira invicto** (R victorias seguidas); tope de seguridad de **3 × N
  peleas**, y si se llega, gana el primero por Elo. Los demás formatos ya
  terminan solos.
- **Partido rápido**: al abrir la ventana hay un torneo **Scratch** sin
  guardar, formato *Single match*, para jugar enseguida como el Contest de
  hoy; "Save as tournament" lo convierte en liga.
- **Botón 📺** de la barra: atajo a Tournaments → Play con el TV mode.
  🏆 abre Tournaments; el botón 🏟 Leagues desaparece.
- **Sim options → Game modes** queda para el F1 manual, con una nota:
  "Tournaments set these for each match".

### Modelo

- **Formatos** (`fmt.format`): `single` (partido único con todos los
  participantes, el Contest de hoy), `koth`, `rr`, `ladder`.
- **`fmt`** único para todos: `{format, qty, nrg, rounds, wins, cap,
  capMode, k, retire, legs}`; `entrant.qty` opcional pisa `fmt.qty` (el
  Contest tenía cantidad por participante).
- **`league.draw`** `{mode: 'fixed' | 'random', pool, n}`. Con `random`,
  cada temporada nueva sortea (reusa `lgDrawRandom`).
- **Fin de temporada** para todos: `lgNextFixture` devuelve `null` y un
  `lgSeasonChampion(S, ms)` da el campeón (rey de la colina: el primer
  retiro invicto o el primero por Elo al tope de 3 × N; `single`: el
  ganador del partido; `rr` y `ladder`: el primero de la tabla).
- **Tabla histórica** `lgAllTime(L, matches)`: derivada del historial,
  nada guardado aparte.
- **Scratch**: liga en memoria (id fijo, no se guarda en IndexedDB) con
  sus partidos en memoria; "Save as tournament" la persiste con id nuevo.
- **Exportar**: versión 2 del archivo (con `draw`); importar acepta la 1.
- **Migración**: las ligas guardadas reciben `draw: {mode: 'fixed'}` y los
  valores por defecto que les falten; el roster del Contest
  (localStorage) pasa a los participantes de Scratch; la config del Canal
  se descarta. El Hall of Fame viejo del Canal no tiene partidos de los
  que derivarse: **se ofrece descargarlo como JSON** una vez y se borra
  (confirmar con el usuario al llegar a R1 si prefiere otra salida).

### Piezas y trabajo

**R1 · Modelo** (funciones puras y migración, sin cambiar todavía la UI)
1. Formato `single`; fin de temporada del rey de la colina con tope;
   `lgSeasonChampion`; `entrant.qty`.
2. `league.draw` y temporada nueva con sorteo; `lgAllTime`.
3. Scratch en memoria y "Save as tournament"; exportar v2 e importar v1/v2.
4. Migración de ligas, roster del Contest y Hall of Fame del Canal.
5. Smoke nuevo `tools/e11/smoke_torneos.mjs` (o ampliar `smoke_liga`):
   fin del rey de la colina (retiro y tope), `single`, sorteo sin
   repetidos, tabla histórica, exportar v2 e importar v1.

**R2 · Ventana "🏆 Tournaments"**
1. **Setup**: selector de torneo (Scratch primero), nombre, formato,
   valores del partido, reglas (foto y presets) y **Entrants**: un único
   selector compartido (búsqueda del Bestiary, pool, 🎲 N al azar,
   híbrido, formulario, Animal Minimalis) más la fuente (lista fija o
   sorteo con pool y N).
2. **Play**: un solo marcador, la próxima pelea, "▶ Play next" y el
   interruptor **📺 TV mode** (pausa entre peleas, rótulo sobre el campo,
   bucle de ediciones con sorteo nuevo).
3. **Results**: tabla de la temporada, Hall of Fame (histórica),
   enfrentamientos directos, historial con ↻, temporadas pasadas,
   exportar/importar.
4. Baja de las ventanas Contest y Channel (se conservan los helpers que
   sigan en uso: `contestLaunch`, `contestBoardHtml`, `contestRoundWinner`,
   el rótulo `#ch-overlay`); `contestLaunch` deja de recibir `f1`,
   `maxcyc` y `maxpop` y pone `99` y `100` en 0. Botones de la barra.

**R3 · Limpieza y cierre**
1. Nota en Sim options → Game modes; CSS y código muertos (`ct-*`,
   `ch-*` que ya no se usen); tooltips.
2. Docs: README (§Ligas → §Torneos), PROGRESO (fila E11 y entrada),
   "Resultado R1/R2/R3" aquí.
3. Verificación en Chrome: partido rápido (Scratch) y guardarlo; cada
   formato hasta su fin; TV mode con 2 ediciones seguidas (sorteos
   distintos, rótulo, tabla histórica); repetir un partido; importar un
   archivo exportado por E10 (v1). Consola limpia.

**Cierre de cada parte**: suite en verde en los tres modos, `port/core/`
sin diff, smokes de host en verde (`rv/smoke_host`, `e8/smoke_e8`,
`pp/smoke_formas`, `pp/smoke_campo`, `imrelay/smoke_im`, `e10/smoke_liga`
y el nuevo) y fila en `PROGRESO.md`.

### Resultado R1 (2026-09-27)

Todo en `web/league.js`, con funciones puras donde se pudo:

- **Fin de temporada para todos los formatos**: `lgFixture(S, ms)` (pura;
  `lgNextFixture(L)` la envuelve), `lgSeasonDone` y `lgSeasonChampion`
  → `{name, how}` con `how` = `match` (single), `retired` (rey de la
  colina: el primer retiro invicto), `elo` (rey de la colina al tope de
  3 × N peleas jugadas; los nulos no cuentan) o `table` (rr y escalera).
  `single` lleva a los primeros 20 participantes; un nulo no cierra la
  temporada.
- **`entrant.qty`** pisa `fmt.qty` (`lgLaunchList`); `lgAddEntrant`
  respeta el color pedido si está libre.
- **`league.draw`** `{mode, pool, n}` (limpio con `lgDrawClean`).
  `lgNewSeason(L, {draw})`: con `random` (o `draw: true`, lo que usará el
  TV mode) la temporada nueva sortea n del pool; `lgRedraw` vuelve a
  sortear una temporada sin partidos.
- **`lgAllTime`**: títulos, temporadas jugadas, partidos, victorias y un
  Elo que sigue de temporada en temporada; solo los que jugaron.
- **Scratch**: `lgScratchNew` / `lgScratch` (reglas F1, formato single, id
  fijo `scratch`), no se guarda; sus partidos viven en memoria con id
  negativo. `lgScratchSave(name)` lo persiste por el camino de exportar e
  importar (`lgPromote`) y deja un Scratch limpio con los mismos
  participantes.
- **Archivo v2** (con `draw` y `qty`); importar acepta v1 (sorteo fijo).
- **Migración**: `lgMigrate` al cargar (sorteo fijo y valores de formato
  que falten; las ligas del usuario solo ganaron `draw`).
  `lgMigrateRoster` (roster del Contest → Scratch, leyendo el ADN; los de
  "form" no guardaban ADN y se pierden; borra la config del Canal) y el
  Hall of Fame viejo (`lgOldHofFile`, `lgOldHofDownload`,
  `lgOldHofDiscard`; **el usuario eligió ofrecer la descarga y borrarlo**)
  quedan escritos y se conectan en R2, cuando desaparecen las ventanas
  viejas.
- Toques mínimos de UI: "Single match" en el selector de formato, el
  campeón y su motivo al terminar la temporada (ventana y rótulo del
  Canal).
- Smoke `tools/e11/smoke_torneos.mjs` 38/38. En Chrome: single hasta el
  campeón, temporada nueva con sorteo, rey de la colina cerrado por
  retiro, Scratch jugado y guardado, y su partido repetido idéntico
  desde la liga guardada. Consola limpia.

### Resultado R2 (2026-09-27)

- **`web/tournament.js`** (nuevo): la ventana "🏆 Tournaments". Arriba,
  el selector (⚡ Scratch primero, luego los torneos guardados), ＋ New
  (reglas F1), 💾 Save as tournament (solo con el Scratch), 🗑 (dos
  clics; en el Scratch lo vacía), ⬇ / ⬆.
  - **Setup**: nombre, temporada y candado; formato y valores del partido
    con la regla de victorias explicada; reglas del mundo (resumen, "Load
    into the panel", "Save the panel as rules", presets F1 y sin costes);
    participantes con color y cantidad propia (vacía = la del formato),
    búsqueda en el Bestiary, grupos del Inventario, híbrido, formulario y
    Animal Minimalis; el sorteo ("🎲 Draw N from <pool>", que reemplaza la
    lista si la temporada no tiene partidos) y "Draw new entrants at every
    new season" (`draw.mode`).
  - **Play**: resumen y avance, próxima pelea, ▶ Play next, ✕ Abandon,
    📅 New season (dos clics), un solo marcador y el **📺 TV mode** con la
    pausa entre peleas.
  - **Results**: temporadas (1, 2, …), tabla con 🏆 en el campeón,
    enfrentamientos, partidos con ↻, reglas de una temporada pasada y el
    **Hall of Fame** de todas las temporadas (`lgAllTime`).
- **TV mode** (el Canal de antes): juega el torneo abierto. Si la
  temporada no tiene partidos la vuelve a sortear; si está a medias la
  sigue; si terminó, abre otra con sorteo. Cortinilla con cuenta atrás,
  rótulo en vivo (`#ch-overlay`) y rótulo del campeón (12 s) antes de la
  edición siguiente, sin fin. Cambiar de torneo o repetir un partido lo
  apaga; apagarlo no abandona el partido en curso. Más de 5 nulos o
  fallos seguidos lo apagan.
- **Bajas**: `channel.js` borrado (los colores pasan a `league.js` como
  `LG_COLORS`); la ventana y el roster del Contest salen de `contest.js`,
  que queda con `contestLaunch` (sin `f1`, `maxcyc` ni `maxpop`: pone 99 y
  100 en 0), `contestDna`, el marcador y la regla de victorias. La
  ventana de Ligas sale de `league.js` (`lgRender` y `lgNote` avisan a
  `tournament.js`). `index.html`: botones 🏆 Tournaments y 📺 TV (abre
  Play); los mensajes F1 van a `leagueOnMessage` y las stats a
  `tnOnStats`.
- **Migraciones conectadas**: al abrir la ventana por primera vez, el
  roster del Contest pasa al Scratch (`lgMigrateRoster`) y, si queda el
  Hall of Fame del Canal, un aviso ofrece "⬇ Download it" o "Discard it".
- Verificado en Chrome: migración del roster (2 de 3; el de "form" no
  tenía ADN), partido rápido en el Scratch hasta el campeón, "Save as
  tournament", TV mode con 3 ediciones seguidas con sorteos distintos y
  el Hall of Fame sumándolas, 📺 de la barra, repetición desde Results
  idéntica, borrado en dos clics y "Discard it". Consola limpia.

### Resultado R3 (2026-09-27) — E11 completa

- **Sim options → Game modes**: nota "For the manual F1 of the original.
  🏆 Tournaments set these for each match…" (renglón `note` nuevo del
  panel, `.opt-note`).
- **Limpieza**: CSS de las ventanas viejas (`#ct-roster`, `#ct-q`,
  `#ct-results`, `.ct-h`, `#ch-recent`, `.lg-rand`, `.ch-lgsum`, `#lg-*`)
  quitado o renombrado a `tn-*`; un cruce de selectores y de funciones
  contra su uso no deja nada muerto. Tooltip del 📺 TV mode; la temporada
  elegida en Results se resalta.
- La escalera anuncia a su campeón como "holds the top rung" (`how:
  'ladder'`).
- **Docs**: README §"Torneos (E10 y E11)" en lugar de §"Ajustes F1,
  Contest y Canal" y §"Ligas"; PROGRESO con E11 completa.
- **Verificación en Chrome**: los cuatro formatos hasta su fin en un
  mismo torneo (rey de la colina por retiro, todos contra todos, escalera
  y single; el Hall of Fame suma las 4 temporadas), un archivo v1 como lo
  exportaba E10 (sin `draw` ni `qty`) importado con sus 3 temporadas y 9
  partidos, y la nota de Game modes. Consola limpia. Con la regla nueva,
  una liga vieja de rey de la colina que ya tenía un retiro invicto
  aparece con esa temporada completa.
- Suite 270 / 4092 en los tres modos, `port/core/` sin diff, smokes en
  verde (`smoke_torneos` 38/38).

---

## E12 · Copa (grupos + eliminatorias) — capa host

Añadida el 2026-09-27 a petición del usuario: "un modo donde funcione a
modo de fixture como el mundial de fútbol". **No es superficie del
original.** Es un quinto formato de los torneos de E11 (`fmt.format =
'cup'`): una **fase de grupos** (todos contra todos dentro de cada grupo)
y una **eliminación directa** con cuadro (octavos, cuartos, semis y
final). Rama sugerida: `e12-copa`, desde `main`.

**Reglas**: cero cambios en `port/core/` y en el wasm; suite intacta (270
/ 4092 en los tres modos). Se conserva todo lo de E10 y E11: ADN
congelado, reglas y formato bloqueados con el primer partido, Elo con K =
32 / (N − 1), repetición con semilla, exportar e importar, TV mode, sin
`alert`/`confirm`/`prompt` nativos.

### Por qué

Los formatos actuales hacen bien una sola cosa: el round robin es justo
pero largo y plano (28 duelos con 8 bots); el rey de la colina tiene
drama pero mucho azar; la escalera depende del orden de inscripción. La
copa junta lo justo (los grupos filtran) con la tensión de "se juega
todo en un partido", y en el TV mode da narrativa: "Group C · matchday
2", "Quarter-final", "FINAL".

### Decisiones tomadas (del usuario, 2026-09-27)

- Es un **formato más** de "🏆 Tournaments", no una ventana ni un modo
  aparte: comparte reglas, valores del partido, participantes, sorteo,
  temporadas, Hall of Fame, repetición, exportar e importar y TV mode.
- **Todo se deriva del historial**, como los demás formatos: tablas de
  grupo, clasificados, cuadro y avance salen de recorrer los partidos.
  Lo único que se guarda aparte es el **reparto de los grupos** (tiene
  que quedar fijo).

### Decisiones confirmadas (del usuario, al empezar C1, 2026-09-27)

1. **Solo 8, 16 o 32 participantes** (el usuario prefirió esto a grupos
   de 3 a 5 con byes): grupos fijos de 4, pasan los 2 primeros, el cuadro
   siempre es una potencia de 2 y no hay byes. Con otro tamaño la copa no
   arranca (aviso en "Play" y el TV mode se apaga).
2. **Bombos por Elo**: los cabezas de serie salen del Elo del Hall of
   Fame del torneo (`lgAllTime`); sin historia, 1500 y sorteo dentro del
   bombo. Opción "random" para un sorteo puro.
3. **Eliminatorias a partido único** (el partido F1 ya es "al mejor de"
   varias rondas). Un nulo se repite.
4. **Partido por el 3.er puesto**: opcional, apagado por defecto.

### Modelo

- **`fmt`** suma: `groupLegs` (1 o 2, por defecto 1), `pots` (`'elo'` |
  `'random'`, por defecto `'elo'`) y `third` (bool, por defecto false).
  `lgMigrate` completa los que falten. El tamaño de grupo (4) y los
  clasificados por grupo (2) son fijos.
- **`S.groups`**: `[[nombres del grupo A], [B], …]`, cada grupo con su
  bombo 1 primero, guardado en la temporada. Se sortea con "🎲 Draw
  groups" en Setup o, si falta, al lanzar el primer partido
  (`lgCupEnsure` en `lgPlayNext` y en cada edición del TV mode). Solo vale
  si reparte exactamente a los participantes actuales (`lgCupGroupsOk`):
  si se editan antes del primer partido, deja de valer y se vuelve a
  sortear. Viaja en el archivo exportado (`lgImportObj` lo copia y lo
  descarta si no cuadra).
- **Sorteo de grupos** `lgCupGroups(entrants, fmt, elo, rnd)` (pura, con
  el generador inyectado): G = N / 4; bombos = los participantes ordenados
  por Elo (los empates al azar), en tramos de G; cada grupo recibe uno de
  cada bombo.
- **Estado** `lgCupState(S, ms)` (pura) → `{phase: 'draw' | 'groups' |
  'ko' | 'done', groups: [{name, rows}], played, total, bracket: [[{a, b,
  winner, no, id}]], third, next, label, champion, reach}`:
  - **Grupos**: el round robin de `lgRrFixtures` dentro de cada grupo;
    las jornadas se intercalan entre grupos (A1, B1, C1… A2, B2…). Los
    partidos de grupo son los duelos del calendario hasta completarlo.
    Tabla: victorias; desempates: duelos directos entre los empatados,
    Elo de la fase de grupos, menos rondas ganadas por tope, menos ciclos
    promedio y por último el orden del sorteo.
  - **Cruces**: el del Mundial: 1A-2B, 1C-2D… en la mitad de arriba y
    1B-2A, 1D-2C… en la de abajo, así dos del mismo grupo solo pueden
    volver a verse en la final.
  - **Eliminatorias**: cada cruce es un duelo; solo cuenta el duelo del
    cruce pendiente (como la escalera) y su ganador avanza. Con `third`,
    el partido por el 3.er puesto va antes de la final.
  - **reach**: hasta dónde llegó cada uno (0 = grupos, 1 = primera ronda
    del cuadro…; +0.5 el ganador del 3.er puesto; el campeón, uno más que
    la final).
- **Integración**: `lgFixture` (labels "Group B · matchday 2 of 3",
  "Round of 16 · match 3 of 8", "Quarter-final · match 1 of 4",
  "Semi-final · match 1 of 2", "Third place", "FINAL"), `lgSeasonDone`
  (final jugada), `lgSeasonChampion` (`how: 'cup'` → "wins the final"),
  `lgStandings` (orden: `reach`, luego victorias y Elo), `tnProgress` y
  el rótulo del TV. El Elo, el head to head, el Hall of Fame y la
  repetición no cambian.

### Duración

| Participantes | Grupos | Partidos |
|---|---|---|
| 8 | 2 de 4 | 12 + 3 = 15 |
| 16 | 4 de 4 | 24 + 7 = 31 |
| 32 | 8 de 4 | 48 + 15 = 63 (el Mundial clásico) |

### Piezas y trabajo

**C1 · Modelo** (funciones puras, sin UI)
1. `fmt` de la copa, `lgMigrate`, `S.groups` en exportar e importar.
2. `lgCupGroups` (bombos por Elo o al azar) y `lgCupState` (grupos,
   desempates, cruces, avance, 3.er puesto, campeón).
3. Integración en `lgFixture`, `lgSeasonDone`, `lgSeasonChampion`,
   `lgStandings` y `LG_HOW`.
4. Smoke `tools/e12/smoke_copa.mjs` (vm, como `smoke_torneos`).

**C2 · Interfaz** (`tournament.js`)
1. Setup: "World cup (groups + knockout)" en el selector de formato con
   sus valores, vista previa de los grupos (con su bombo) y "🎲 Draw
   groups".
2. Play: la fase y el partido en el resumen y en "Next"; el rótulo del
   TV mode con la fase ("GROUP C · MATCHDAY 2", "SEMI-FINAL", "FINAL").
3. Results: las tablas de grupo (clasificados resaltados) y el **cuadro
   dibujado** (columnas por ronda, con ganadores y ↻ en cada
   cruce), además de la tabla, el head to head, los partidos y el Hall
   of Fame de siempre.

**C3 · Cierre**
1. README §Torneos, PROGRESO (fila E12 y entrada), "Resultado C1/C2/C3"
   aquí.
2. Chrome: copa de 8 a mano hasta la final; una de 12 que no arranca;
   copa de 16 en TV mode con 2 ediciones (bombos por Elo en la segunda); repetir
   un cruce de eliminatoria; exportar e importar con los grupos. Consola
   limpia.

**Cierre de cada parte**: suite en verde en los tres modos, `port/core/`
sin diff, smokes de host en verde (`rv/smoke_host`, `e8/smoke_e8`,
`pp/smoke_formas`, `pp/smoke_campo`, `imrelay/smoke_im`,
`e10/smoke_liga`, `e11/smoke_torneos` y el nuevo) y fila en
`PROGRESO.md`.

### Resultado C1 (2026-09-27)

- `league.js`: `fmt` suma `groupLegs`, `pots` y `third`; `LG_FORMATS`
  suma `'cup'`. Bloque "Copa (E12)": `LG_CUP_SIZES`, `lgCupGroupsOk`,
  `lgCupGroups`, `lgCupDraw` (pura, con el Elo de `lgAllTime`) y
  `lgCupEnsure` (sortea y guarda), `lgCupSort`, `lgCupRound` y
  `lgCupState`. `lgShuffle` acepta el generador. Integrada en
  `lgFixture`, `lgSeasonDone`, `lgSeasonChampion` (`how: 'cup'`),
  `LG_HOW`, `lgStandings` (por `reach`) y `lgImportObj` (copia y valida
  `S.groups`; exportar lo lleva solo). `lgPlayNext` avisa si el tamaño no
  es de copa y sortea los grupos que falten.
- `tournament.js`: `tvEdition` apaga el TV mode si la edición sorteó un
  tamaño que no es de copa y sortea los grupos de cada edición. El resto
  de la interfaz queda para C2.
- Smoke nuevo `tools/e12/smoke_copa.mjs`: **49/49** (tamaños 8, 16 y 32
  con 15, 31 y 63 partidos, y 27 con ida y vuelta; tamaños que no sirven;
  bombos por Elo y al azar; calendario intercalado; desempates; cruce del
  Mundial; nulos que se repiten; 3.er puesto y tabla; sorteo con el Hall
  of Fame; migración; exportar e importar con los grupos).
- Verificación: suite 270 / 4092 en los tres modos, `port/core/` sin
  diff, los 8 smokes de host en verde y Chrome carga con la consola
  limpia.

### Resultado C2 (2026-09-27)

- `league.js` (`lgFmtHtml`): "World cup (groups + knockout)" en el
  selector, con "Group stage legs", "Pots" (by Elo / random) y
  "Third-place match".
- `tournament.js`:
  - Setup: sección "🌍 World cup groups" con la vista previa (grupo,
    bombo y Elo del Hall of Fame de cada uno) y "🎲 Draw groups"
    (bloqueado con el primer partido o si el tamaño no sirve); cambiar el
    formato o los bombos borra el sorteo. El contador de participantes
    avisa si no son 8, 16 o 32. El formulario acepta selects y checkboxes.
  - Play: `tnFmtText` y `tnProgress` de la copa ("group stage: 5 of 12
    matches", "knockout: Semi-final"); sin grupos, "Play next" sigue
    visible y los sortea; con un tamaño que no sirve, el aviso.
  - TV mode: el rótulo lleva la fase en mayúsculas y en grande (`.ch-phase`:
    "GROUP A · MATCHDAY 1 OF 3", "SEMI-FINAL · MATCH 1 OF 2", "THIRD
    PLACE", "FINAL").
  - Results: "🌍 Groups and bracket" con las tablas de grupo (los 2
    primeros resaltados) y el cuadro dibujado: una columna por ronda,
    los puestos (1A, 2B…) mientras se juegan los grupos, ganador
    resaltado, el cruce pendiente con borde y ↻ en cada cruce jugado; el
    3.er puesto bajo la final.
- `index.html`: estilos `.tn-groups`, `.tn-bracket` y compañía (el ganador
  usa `.tn-won`: `.win` es la clase de las ventanas).
- Chrome: copa de 8 Spinner a mano hasta la final (16 partidos con 3.er
  puesto; tabla campeón → finalista → 3.º → 4.º); ↻ de la final coincide;
  exportar e importar conserva grupos y campeón; una copa de 11 no
  arranca (avisos en Setup, Play y la nota); TV mode con sorteo de 8 de
  11 en dos ediciones (bombos por el Elo del Hall of Fame, rótulos de
  fase, campeón en el rótulo final, grupos nuevos en la siguiente).
  Consola limpia; torneos de prueba borrados y datos del usuario
  restaurados.
- Verificación: suite 270 / 4092 en los tres modos, `port/core/` sin
  diff, los 8 smokes de host en verde.

### Resultado C3 (2026-09-27) — E12 completa

- `port/HISTORIA.md` §"Torneos (E10, E11 y E12)": el formato World cup y su
  smoke.
- `PROGRESO.md`: fila de E12 ✅ y entrada.
- La verificación en Chrome se hizo en C2 (ver arriba). Diferencia con lo
  planeado: la copa en TV mode fue de 8 (sorteo de 8 entre los 11
  Spinner, bots livianos) y no de 16, y la de 12 que no arranca fue de
  11 (el tamaño ya no admite byes). Los tamaños 16 y 32, el cuadro con
  octavos y la cantidad de partidos los cubre el smoke.
- Cierre: suite 270 / 4092 en los tres modos, `port/core/` sin diff, los
  8 smokes de host en verde, Chrome con la consola limpia.

**Alternativa para después**: el **sistema suizo** (cada jornada cruza a
los de igual puntaje; con 64 bots bastan 6 jornadas), bueno para pools
grandes como el Bestiary entero, con menos épica que la copa.

---

## E13 · Backend: cuentas, catálogo de bots y torneos en el servidor — capa host + servidor

Añadida el 2026-09-27 a petición del usuario: "planifica la posibilidad
de que este sistema tenga un backend". **No es superficie del original.**
Hoy todo vive en el navegador: el motor en el worker, el Inventario y los
torneos en IndexedDB (`darwinbots-inventario`, `darwinbots-ligas`), y el
único proceso servidor es el relay de E7 (`tools/imrelay/relay.mjs`),
que no guarda nada. E13 suma un servidor con cuentas de Google donde los
usuarios **suben bots** a un catálogo común y **crean torneos** que
persisten y comparten. Rama sugerida: `e13-backend`, desde `main`.

**Reglas**: cero cambios en `port/core/` y en el wasm; suite intacta (270
/ 4092 en los tres modos). La app sin login sigue funcionando exactamente
igual que antes de E13, también desde GitHub Pages.

### Decisiones tomadas (del usuario, 2026-09-27)

**1 · Rol del servidor: híbrido.** El servidor guarda usuarios, bots,
torneos y resultados; **los partidos los juega el navegador** del
organizador, como hoy. Cada resultado sube con su **receta** (semilla,
versiones exactas de los bots, reglas y opciones: la misma de la
repetición de E10). Como el motor es determinista, el servidor puede
**re-ejecutar** cualquier partido con el mismo wasm en Node y comprobarlo.
Descartados: servidor como mero almacén (resultados falsificables sin
remedio) y servidor árbitro que juega todo (CPU y cola de trabajos para
cada partido).

**2 · Anónimo frente a registrado.**
- La **persistencia local** (IndexedDB) es para todos, con o sin cuenta,
  como hoy.
- El anónimo usa todo lo local, pero **no persiste nada en el backend**:
  no sube bots ni crea torneos en el servidor ni se inscribe.
- El anónimo **ve** el catálogo y los torneos del servidor (solo lectura)
  y puede **descargar** bots del catálogo a su Inventario local.
- En el **primer login** se ofrece subir a la cuenta lo que ya tiene en
  local (bots del Inventario y torneos).

**3 · Bots subidos.**
- **Siempre públicos**: subir un bot = publicarlo en el catálogo.
- **Versiones inmutables**: editar crea una versión nueva; ninguna se
  pisa. Un partido referencia la versión exacta que jugó (encaja con el
  "ADN congelado" de E10).
- **Duplicados**: con el `Hash` del ADN (M5); un ADN idéntico a uno ya
  subido no se bloquea, se marca "idéntico a X de <apodo>".
- **Evolucionados también**: se guardan generación y mutaciones del
  formato (`'#`), y si el bot desciende de una versión del catálogo, el
  vínculo **padre → hijo** (linaje).
- **Retirar, no borrar**: un bot que jugó partidos en el servidor no se
  borra (rompería las re-ejecuciones); el dueño lo **retira** (sale del
  catálogo y de las búsquedas, sus versiones siguen para el historial).
  Uno que nunca jugó sí se puede borrar.
- **Límites**: 64 KB de ADN por versión y 200 bots por usuario.
- **Licencia MIT**: todo bot subido queda bajo MIT (lo dicen los
  términos). La descarga desde el catálogo antepone un comentario con
  nombre, versión, autor y licencia (comprobar que no cambie el `Hash`).
- **Moderación**: botón "denunciar" (bots, torneos, usuarios) con motivo.

**4 · Torneos en el servidor.**
- Los crean solo usuarios registrados, con **cualquiera de los 5
  formatos** de E11/E12.
- **Cerrado**: el organizador elige los participantes del catálogo (todos
  los bots son públicos, así que puede usar bots de cualquiera).
- **Abierto** (entra en la primera versión): se publica con fecha de
  cierre de inscripción y cada usuario inscribe uno de *sus* bots.
- Los partidos los juega el **navegador del organizador**; cada resultado
  se sube al terminar y los demás ven avanzar la tabla. Descartado por
  ahora repartir partidos entre navegadores de participantes.
- **Verificación**: (a) **impugnación**: el dueño de cualquier bot
  participante puede impugnar un partido y el servidor lo re-ejecuta;
  (b) **muestreo**: el servidor re-ejecuta al azar ~10 % de los partidos
  de cada torneo; (c) **a pedido del admin** (ver 6). Si no coincide, el
  partido queda **en disputa**, se corrige con el resultado del servidor
  y el torneo lo muestra.
- La **tabla la recalcula el servidor** a partir de los resultados, con
  la misma lógica de formatos del navegador (ver B3).

**5 · Stack y hosting.**
- **Node** (24 en desarrollo; ≥ 22.5 por `node:sqlite`) y **SQLite** con
  `node:sqlite`: sin dependencias, la línea del relay de E7.
- **Un solo proceso** sirve el front estático, la API (`/api/...`) y el
  relay WebSocket (`/im`, reusando el código de `relay.mjs`). Un solo
  origen: sesión en cookie `httpOnly` + `SameSite=Lax`, sin CORS.
- **Login con Google**: Google Identity Services en el navegador → ID
  token → el servidor lo verifica (RS256 contra las JWKS de Google con
  `node:crypto`, `aud` = client id, `iss`, `exp`) y abre su propia sesión.
- **Hosting**: el servidor que el usuario ya tiene en su proveedor, en
  un **subdominio suyo**; proxy inverso con TLS delante (el que ya use) y
  el proceso bajo systemd o pm2. La demo de GitHub Pages sigue como espejo
  solo anónimo.
- **Backups**: Litestream a un bucket (o `.backup` nocturno copiado fuera
  de la máquina).
- La re-ejecución corre en `worker_threads`, en una cola de baja
  prioridad, para no frenar la API.

**6 · Cuentas y administración.**
- **Apodo**: se elige en el primer login (único, 3-20 caracteres, letras,
  dígitos, `_` y `-`; se sugiere uno desde el nombre de Google) y **queda
  fijo**; solo un admin puede cambiar uno ofensivo. Se muestra con el
  **avatar** de Google; el email nunca. Es el `LastOwner` que estampa E7
  cuando un usuario con sesión usa Internet Mode.
- **Borrar la cuenta: inmediato**, sin gracia. Se confirma escribiendo el
  apodo; antes se ofrece exportar. Se borran email, `sub` y avatar; el
  apodo pasa a mostrarse "usuario eliminado" y queda **reservado**. Bots
  que nunca jugaron en el servidor: se borran; los que jugaron: retirados
  con autor anónimo. Torneos que organizó: los terminados quedan, los en
  curso o con inscripción abierta se cancelan. Sus inscripciones en
  torneos ajenos: se retiran si la inscripción sigue abierta; si el
  torneo ya empezó, el bot sigue jugando.
- **Exportar mis datos**: un `.zip` armado en el momento con
  `bots/<nombre>/v<n>.txt` (todas las versiones), `torneos/<nombre>.json`
  (los que organizó, en el JSON de exportar de E10, importables como
  locales) y `cuenta.json`. Solo lo suyo. **Máximo un zip por día**; si
  ya exportó hoy, el diálogo de borrado lo avisa en vez de ofrecer otro.
- **Admin**:
  - Tabla **`admin`** en la base; altas y bajas **solo por consola**
    (`node server/admin.mjs agregar|quitar <email>`, sobre un usuario que
    ya entró una vez). El panel no gestiona admins.
  - Entra por una **ruta propia, `/admin`** (misma sesión de Google); para
    quien no es admin responde 404. La API `/api/admin/...` comprueba la
    tabla en cada llamada.
  - Acciones: ocultar o mostrar un bot, suspender una cuenta (queda como
    anónimo y sus bots ocultos), cambiar un apodo ofensivo, cancelar un
    torneo, **re-ejecutar cualquier partido**, ver y resolver denuncias.
  - Toda acción queda en **`admin_log`** (quién, qué, sobre qué, cuándo,
    motivo).
- **Privacidad y términos**: páginas estáticas `/privacidad` y
  `/terminos` en **español e inglés** (Google las exige para sacar la
  pantalla de consentimiento de "testing"). Privacidad: qué se guarda
  (email, `sub`, avatar, apodo), solo cookie de sesión, sin analítica,
  exportar y borrar. Términos: bots siempre públicos bajo MIT,
  moderación, sin garantías. Contacto: **japedev@gmail.com**.

### Modelo (SQLite)

| Tabla | Campos principales |
|---|---|
| `usuario` | `id`, `google_sub` (único, nulo si eliminado), `email`, `avatar`, `apodo` (único, fijo), `alta`, `suspendido`, `eliminado`, `ultima_exportacion` |
| `sesion` | `token_hash`, `usuario_id`, `alta`, `expira` |
| `admin` | `usuario_id`, `alta`, `alta_por` |
| `bot` | `id`, `usuario_id`, `nombre`, `alta`, `retirado`, `oculto` |
| `bot_version` | `id`, `bot_id`, `n`, `adn`, `hash`, `generacion`, `mutaciones`, `padre_id` (→ `bot_version`), `alta` |
| `torneo` | `id`, `organizador_id`, `nombre`, `fmt` (JSON), `reglas` (JSON), `modo` (`cerrado`/`abierto`), `cierre_inscripcion`, `estado` (`inscripcion`/`en_curso`/`terminado`/`cancelado`), `grupos` (JSON, copa) |
| `inscripcion` | `torneo_id`, `bot_version_id`, `usuario_id`, `alta` |
| `partido` | `id`, `torneo_id`, `receta` (JSON), `resultado` (JSON), `estado` (`aceptado`/`verificado`/`en_disputa`), `subido_por`, `alta`, `verificado_en` |
| `impugnacion` | `partido_id`, `usuario_id`, `alta`, `resuelta` |
| `denuncia` | `id`, `usuario_id`, `objeto` (`bot`/`torneo`/`usuario`), `objeto_id`, `motivo`, `alta`, `resuelta_por` |
| `admin_log` | `id`, `admin_id`, `accion`, `objeto`, `objeto_id`, `motivo`, `alta` |

Migraciones numeradas en `server/migraciones/NNN.sql`, aplicadas al
arrancar (`PRAGMA user_version`). WAL activado.

### A confirmar al empezar B1

- Cuántos bots puede inscribir un usuario en un torneo abierto
  (propuesta: 1).
- Duración de la sesión (propuesta: 30 días, renovada con el uso).
- Porcentaje de muestreo (propuesta: 10 %) y si el organizador puede
  pedir "verificar todo" en su torneo.
- Ubicación del servidor en el repo (propuesta: `port/server/`, que sirve
  `port/web/` y el wasm de `port/build-wasm/`).

### Piezas y trabajo

**B1 · Servidor base y cuentas**
1. `server/main.mjs`: `node:http`, estático, `/im` (relay de E7
   importado, no copiado), migraciones y WAL.
2. Login con Google (verificación del ID token sin dependencias), sesión,
   primer login con elección de apodo, `/api/yo`, cerrar sesión.
3. Páginas `/privacidad` y `/terminos` (ES/EN).
4. `server/admin.mjs agregar|quitar <email>`.
5. Front: botón "Sign in with Google" y el apodo con avatar en la barra;
   sin sesión, nada cambia.
6. Smoke `tools/e13/smoke_cuentas.mjs` (servidor en un puerto libre con
   base temporal; token de Google simulado con una JWKS de prueba).

**B2 · Catálogo de bots**
1. API: subir (bot nuevo o versión nueva), listar y buscar, ver versiones
   y linaje, descargar con cabecera MIT, retirar, borrar si nunca jugó,
   denunciar. Límites y marca de duplicados.
2. Front: ventana "Catalog" (lectura para todos) y en el Inventario
   "Upload" / "Download to Inventory"; oferta de subir el Inventario en el
   primer login.
3. Smoke `tools/e13/smoke_catalogo.mjs`.

**B3 · Torneos en el servidor**
1. Extraer la lógica pura de formatos de `league.js` (`lgRrFixtures`,
   `lgCupState`, `lgStandings`, Elo…) a un módulo compartido que carguen
   el navegador y Node sin duplicarla; `smoke_torneos` y `smoke_copa`
   siguen en verde.
2. API: crear (cerrado/abierto), inscribirse y retirarse, cerrar la
   inscripción, subir resultado con receta, ver torneo con tabla
   recalculada, cancelar.
3. Front: los torneos del servidor dentro de "🏆 Tournaments" junto a los
   locales (marca de nube); jugar uno del servidor sube cada partido;
   inscripción en abiertos; oferta de subir los torneos locales en el
   primer login.
4. Smoke `tools/e13/smoke_torneos_srv.mjs`.

**B4 · Verificación**
1. Runner headless: el wasm en `worker_threads` juega un partido desde su
   receta y devuelve el resultado.
2. Cola de baja prioridad; impugnación, muestreo y estado `en_disputa`
   con corrección y recálculo de la tabla.
3. Front: botón "Dispute" y la marca de verificado / en disputa.
4. Smoke: un partido honesto verifica; uno adulterado queda en disputa y
   se corrige.

**B5 · Admin y cuenta**
1. `/admin`: denuncias, ocultar/mostrar, suspender, renombrar apodo,
   cancelar torneo, re-ejecutar partido; `admin_log`.
2. Exportar mis datos (zip armado a mano con `zlib`, uno por día) y borrar
   la cuenta con todas las reglas de 6.
3. Smoke `tools/e13/smoke_admin.mjs` (incluye 404 de `/admin` para no
   admins y el borrado).

**B6 · Despliegue y cierre**
1. Guía en `port/server/README.md`: subdominio, proxy con TLS, systemd,
   variables (client id de Google, ruta de la base), backups.
2. Cliente OAuth de Google con el origen del subdominio; pantalla de
   consentimiento a producción con las dos páginas.
3. README §Backend, PROGRESO (fila E13), "Resultado B1..B6" aquí.
4. Chrome contra el servidor desplegado: login, apodo, subir y descargar
   un bot, torneo abierto con dos cuentas, impugnación, `/admin`,
   exportar y borrar una cuenta de prueba. Consola limpia.

**Cierre de cada parte**: suite en verde en los tres modos, `port/core/`
sin diff, los smokes de host de siempre en verde más los de E13, y fila
en `PROGRESO.md`.

---

## Orden recomendado

**E1 → E2 → E3** (todo capa host, valor alto, riesgo nulo para el core) →
**E4** (primer core nuevo, con su familia de casos) → **E5 → E6 → E6.5 → E7
→ E8** según apetito (E6.5, vista enriquecida, añadida el 2026-09-24). Cada etapa cierra con su fila en `PROGRESO.md`.
**Plan completo el 2026-09-24** (balance de lo que quedó fuera en
`PROGRESO.md` §"Siguiente"). **E9** (sexualidad visible, capa host) se
añadió el 2026-09-26 a petición del usuario y está pendiente. **E10**
(ligas, capa host) se añadió el 2026-09-27, también pedida por el usuario:
L1 → L2 → L3, **completa** el mismo día. **E11** (torneos unificados:
una sola ventana para Contest, Canal y Ligas) se añadió el mismo día a
pedido del usuario: R1 → R2 → R3, **completa** el mismo día. **E12** (copa: grupos + eliminatorias,
un formato más de los torneos) se añadió el mismo día a pedido del
usuario: C1 → C2 → C3, **completa** el mismo día. **E13** (backend:
cuentas de Google, catálogo de bots y torneos en el servidor, Node +
SQLite) se añadió el mismo día a pedido del usuario: B1 → B6, pendiente.
