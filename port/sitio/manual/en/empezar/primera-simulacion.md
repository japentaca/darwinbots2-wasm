---
titulo: Your first simulation
resumen: "Step by step: pick a scenario on Home, watch it run in Observe, pause, change the speed, inspect a bot, seed one of your own and save the run."
etiquetas: [first steps, scenario, observe, seed, save]
estado: revisada
---
On this page you'll open the app, set a world running, look at a bot up close,
seed a bot you wrote yourself and save everything to carry on another day. You
don't need to know how to program: the DNA in step 6 is copied and pasted.

## 1. Pick a scenario {#escenario}
<!-- web2/src/screens/Inicio.svelte (iniciar: semillaNueva, correr(true), ir a observar; destino 'competir'); i18n/es/inicio.json; engine/escenarios/fabrica.js (orden) -->

Open the app. The first screen is **Home**. If you haven't run anything yet, it
says “No runs yet” at the top and the **Pick a scenario** button scrolls you
down to the gallery.

A _scenario_ is a ready-to-use world: the size of the field, the physics, the
light, the costs and the species that are seeded at the start. The app ships
seven:

| Scenario | What it has |
|---|---|
| Primordial soup | Algae and a minimal animal, with mutations. The starting point to watch a species evolve. |
| Predator and prey | Zebedee V2.1 hunting over a field of algae. |
| F1 match | Two league bots face to face, under the F1 league rules. |
| Day and night | The sun sets every 1000 cycles and the population oscillates. |
| Maze | A spiral maze the bots can see. |
| Ocean | Water physics in a world with no edges. |
| Archipelago | Rock islands and two teleporters. |

To get started, find **Primordial soup** and click **Start**. The app builds
the world with a new random seed, sets it running and takes you to
**Observe**.

The other button on each card, **Tweak**, opens the scenario in Experiment so
you can change it before starting (see [[app/escenarios]]). On the F1 match
card the main button doesn't say Start but **Pick bots**, and takes you to
Compete, because a match is set up by choosing the entrants.

:::nota
If you go straight to Observe without having started anything, the app starts
Primordial soup on its own with a new seed and sets it running.
:::

## 2. What you're looking at {#pantalla}
<!-- web2/src/screens/Observar.svelte (barra, lateral, Mundo); lib/observar/PanelVivo.svelte; i18n/es/observar.json, mundo.json; lib/sim/sesion.svelte.js (velocidad 10 y vista enriquecida por defecto) -->

Observe has three parts:

- **The world**, on the left. Each circle is a bot, in the color of its
  species: in Primordial soup, the algae are green and the animals are red.
- **The “Live” panel**, on the right: how many bots are alive, how many
  species, the mean energy per bot and the highest generation. Below it, the
  **Population by species** chart and the list of **Events** (population
  peaks, extinctions, record generations). **See full analysis** takes you to
  Analyze.
- **The bottom bar**, with the controls. On the right of the bar you can see
  the cycles per second and the frames per second.

At the very top, in the sections bar, an indicator says whether the simulation
is running (with its name) or paused (with the cycle it stopped at). From any
section, a click there brings you back to Observe.

At first not much will happen: the animals roam the field looking for algae,
and when they see one they approach it and shoot it to take its energy. In time
children are born, the chart climbs and the first events appear. What each bot
does in each cycle is told in [[simulacion/ciclo]].

## 3. Pause and change the speed {#velocidad}
<!-- revisado: lib/sim/corrida-nucleo.js arrancarPorDefecto termina con correr(true) -->
<!-- Observar.svelte (barra: mundo.iniciar/pausar, mundo.unCiclo, VELOCIDADES); lib/sim/sesion.svelte.js VELOCIDADES = [1, 10, 100, 0]; lib/mundo/Mundo.svelte (rueda, arrastre solo con zoom, teclas + - 0 flechas) -->

| Control | What it does |
|---|---|
| **Pause** / **Start** | Stops and resumes the simulation. |
| **One cycle** | Advances exactly one cycle. Useful for following a bot step by step. |
| **× 1**, **× 10**, **× 100** | How many cycles are calculated for each frame drawn. It starts at × 10. |
| **Max** | As fast as your computer can; it draws when it has time. |
| **View** | **Enriched** (the usual one), **Classic** (like the original program) or **Outline**. |
| **Color by** | In the enriched view, colors the bots by species, energy, body, generation, mutations, age, DNA length or genetic distance. |

To move around the world: the mouse wheel zooms in and out, and once you've
zoomed in you can drag the world. The buttons in the corner of the world do the
same (**Zoom in**, **Zoom out**, **Fit the whole field**). With focus on the
world, `+` and `−` zoom in and out, the arrow keys pan, and `0` fits the whole
field again.

With × 100 or **Max**, Primordial soup gets through its first thousands of
cycles right away. That's how you see evolution: it happens over tens of
thousands of cycles, not hundreds.

## 4. Look at a bot up close {#inspeccionar}
<!-- lib/inspector/Inspector.svelte (PESTANAS); i18n/es/inspector.json; mundo.json (mundo.ayuda.clic, seguir); observar.json (observar.mejor) -->

Click a bot. The panel on the right jumps to the **Bot** tab, with the
**inspector**: the name of
its species, its generation, its mutations and its age, and its resources
(energy, body, venom, shell, waste). On the **Summary** tab you also see its
energy curve, what its eyes see and which genes of its DNA ran in this cycle.

A few things to try:

1. Click **Follow**: the camera follows the bot around the world.
2. Pause and advance with **One cycle**, watching **Genes active this cycle**
   to see which gene lights up when the bot sees an alga.
3. Open the **DNA** tab to read its program, or **Senses** to see the fan of
   its nine eyes.
4. Click **Family** to highlight its descendants in the world.

If you don't know which one to look at, **Find the best** selects the fittest
bot in the simulation (vegetables don't count). To go back to the “Live” panel,
close the inspector with the ✕. The other tabs (**Memory**, **Console**,
**Control**) are covered in [[app/inspector]].

## 5. A bot from the Bestiary {#bestiario}
<!-- lib/observar/DialogoSembrar.svelte (preset biblioteca: 5 bots, 15 si es vegetal, 3000 de energía, color libre); i18n/es/bots.json (bots.selector.*, bots.ficha.sembrar, bots.lote.*) -->

The _Bestiary_ is the collection of community bots that the app ships. To add
one to the world that's running:

1. Click **Seed** on the bottom bar.
2. Under **Bot**, choose **A bot from the library…** and search for it by name
   (try “Zebedee” or “Hunter”).
3. Check the **Count** (5, or 15 if it's a vegetable), the **Starting energy**
   (3000) and the **Color**.
4. Click **Seed**.

The new species shows up in the world and on the chart, and is noted in the
events. You can also seed from the **Bots** section: open a bot's profile and
click **Seed** (see [[app/bots]]).

## 6. Seed a bot of your own {#tu-bot}
<!-- probado: Sopa primordial (Alga minimalis 3.0 ×15 vegetal, Animal Minimalis ×5) + este ADN ×5, base clásica (costos 0, MaxEnergy 10, minVegs 15, repop 10/10, mutaciones encendidas), campo 32000×32000, semillas 1-3: entre 46 y 58 bots en el ciclo 4000 y entre 166 y 534 en el 10000; revisor, semillas 2 y 4-7: 21-66 en el 4000 y 194-1198 en el 10000; sin el Animal Minimalis y sin mutaciones, semillas 1-5: 25-39 en el 4000. Scratch pruebas-c12-empezar/sopa2.mjs. Gen 1 mueve y gira: sin avance, con la semilla 3 no comieron en 10000 ciclos. -->

This DNA is a minimal hunter: if it sees nothing, it moves forward and turns at
random; if it sees a bot of another species, it heads toward it; if it's
close enough, it shoots it to take its energy; and when it has gathered energy to
spare, it reproduces.

```adn
' My first bot: looks for food, eats and reproduces
' Gene 1: if it sees nothing (or sees one of its own), move forward and turn at random
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 10 .up store
 200 rnd .aimdx store
stop
' Gene 2: if it sees another one, go toward it
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 20 .up store
stop
' Gene 3: if it's close enough, shoot it to take its energy
cond
 *.eye5 50 >
 *.refeye *.myeye !=
start
 -1 .shoot store
stop
' Gene 4: with energy to spare, reproduce
cond
 *.nrg 10000 >
start
 50 .repro store
stop
end
```

To seed it:

1. Click **Open in the app** on the block: the app opens the new-bot dialog
   with this DNA already loaded. (The **Copy** button puts it on your
   clipboard, in case you'd rather paste it by hand.)
2. Enter a **Name** (for example, “My first bot”) and click **Create**: the
   editor opens with the DNA.
3. On the bot's profile, click **Seed**, pick a **Color** that stands out,
   leave the **Number of bots** at 5 and the **Starting energy** at 3000, and
   click **Seed into the current run**.

Follow it with the inspector. In the tests we ran with the engine, seeding
these five bots alongside those of Primordial soup, by cycle 4000 there were
already between 20 and 70, and by cycle 10,000, from about 200 to over a
thousand, depending on the seed. Since Primordial soup has mutations turned on,
in time you'll see children with changed DNA: the inspector shows how many
mutations each one has accumulated.

Every line of this bot is explained in the DNA chapter: genes in
[[adn/genes]], eyes in [[simulacion/vision]], shooting in
[[simulacion/disparos]] and reproduction in [[simulacion/reproduccion]]. To
write one from scratch, follow [[tutoriales/se-mueve]]. If you want to keep it
and improve it, create it in **Bots** with **+ New bot**: the
[[app/editor|DNA editor]] warns you about errors as you write.

:::nota
If the DNA has words the engine doesn't recognize, the app tells you how many
when you seed it: those words are worth 0. The most common cause is a
misspelled sysvar (see [[adn/errores#nombre]]).
:::

## 7. Save the run {#guardar}
<!-- lib/observar/DialogoGuardar.svelte; i18n/es/observar.json (observar.guardar.*, observar.corridas.*, observar.aviso.cargada); i18n/es/inicio.json (inicio.corridas.*); web2/PLAN.md decisión 8 y C17 -->

A _run_ is a simulation with its history: the scenario it came from, its seed,
the changes you made to it and its events. To save it:

1. Click **Save** on the bottom bar.
2. Type a **Name**.
3. Click **Save in the browser**.

It's saved in this browser. The app keeps the last 20 runs. If the run was
already saved, the button says **Update the saved run**, and next to it
**Save as new** appears to save a separate copy. **Download .dbsim**, on the
other hand, downloads a file with the simulation, to take it to another
computer.

To carry on another day, open Home and find the run under **Saved runs**, or
use **Runs** on the Observe bar. When you resume it, it comes back paused:
click **Start**. The world carries on from where you left it, although the
randomness doesn't continue exactly as it would have if you hadn't saved it
(see [[tecnico/semillas]]). Where everything you save lives and how to export
it is in [[app/tus-datos]].

## What's next {#ahora}

- Change the light, the costs or the physics of this world in
  [[app/experimentar]].
- See how the population and the species tree changed in [[app/analizar]].
- Make your bot evolve with [[tutoriales/evolucion]].
- If something didn't work as you expected, look in [[empezar/preguntas]].
