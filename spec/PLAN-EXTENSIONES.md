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
`xObstacle`, `main.frm:1353`); los teleporters sí, desde E7.

**Verificación**: smoke node 44/44 (API directa, dos `worker.js` reales por
`BroadcastChannel` y por el relay, caída de un par con cola y re-sorteo,
carga con IM, 8 rondas con el puerto intacto) y Chrome con dos pestañas
intercambiando organismos reales por los dos transportes (apodo como
`LastOwner`, censos, cartel "Internet Mode", salidas con anillo cian en la
vista enriquecida, consola limpia).

## E8 · Extras de menor valor

Eye designer (`frmEYE.frm`), imagen de fondo, settings del monitor RGB,
E-Grid (`EGridEnabled/Width` — verificar primero si el original lo consume
de verdad), tray icon (n/a en web).

---

## Orden recomendado

**E1 → E2 → E3** (todo capa host, valor alto, riesgo nulo para el core) →
**E4** (primer core nuevo, con su familia de casos) → **E5 → E6 → E6.5 → E7
→ E8** según apetito (E6.5, vista enriquecida, añadida el 2026-09-24). Cada etapa cierra con su fila en `PROGRESO.md`.
