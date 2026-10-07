---
titulo: What DarwinBots is
resumen: "DarwinBots is an artificial life simulation: bots with DNA that move, eat, reproduce, mutate and evolve. This is version 2.48.32, ported to the browser."
etiquetas: [introduction, artificial life, evolution, browser]
estado: revisada
---
DarwinBots is an **artificial life** simulation. A flat world is home to some
simple organisms, the _bots_, and each one carries its own program: its
**DNA**. The DNA tells it what to do at every moment: move forward, turn, shoot
to eat, make defenses, tie to another bot, reproduce. Nobody drives the bots
from outside; you set up the world and watch what happens.

Things get interesting when the bots reproduce. When the DNA is copied for the
child, a random error can slip in: a _mutation_. Almost always the change
breaks something or changes nothing you can notice, but every once in a while a
bot comes out that eats better, escapes better or reproduces faster. If it
leaves more children than its neighbors, its version of the DNA gradually takes
over the world. That is evolution by natural selection, and you can watch it
happen right in front of you.

## What the world is like {#mundo}
<!-- simulacion/ciclo, simulacion/energia, simulacion/cloroplastos; 10-CICLO §2 -->

- Time advances in **cycles**. In each cycle every bot runs its DNA and the
  world responds: it moves everyone, resolves the shots and collisions, makes the
  right bots be born or die, and hands out the sunlight. The exact
  order is in [[simulacion/ciclo]].
- Everything revolves around **energy**. **Vegetables** get it from light; the
  other bots almost always take it from another bot, by shooting it. Energy
  pays for moving, thinking and having children, according to the costs the
  world has (see [[simulacion/energia]]).
- Bots **see** with nine eyes, feel when they are touched or hit, and can read
  some things about the bot in front of them (see [[simulacion/vision]]).
- Species **evolve**: each child can be born with slightly changed DNA (see
  [[simulacion/mutaciones]]).

The DNA is a small stack-based programming language, with genes that switch on
when their conditions are met. This is a complete bot that moves forward all
the time:

```adn
' Always moves forward
cond
start
 10 .up store
stop
end
```

If you've never programmed, don't worry: you can use the whole app without
writing a single line, by seeding the bots that already exist. And if you want
to learn, the chapter [[adn/estructura|The DNA language]] starts from scratch.

## This version {#esta-version}
<!-- port/README.md (Estado, Página web, Bugs del original corregidos; Bestiary: 684 bots en total); web/bots/bots.json (684 entradas); PLAN-SITIO.md S1; web2/PLAN.md decisión 17; i18n/es/inicio.json inicio.nota -->

DarwinBots began as a Windows program. This is its version **2.48.32** ported
to **WebAssembly**: the same simulation engine, rewritten to run in the
browser.

- **Nothing to install.** The app lives at `darwinbots-wasm.org/app/` and works
  in a modern browser: the simulation runs on your computer, not on a server.
- **What you save stays in your browser.** Your bots, your runs, your
  scenarios and your tournaments are saved in that browser's storage, on that
  computer; nothing is uploaded to a server. To take them somewhere else, you
  export them to files (see [[app/tus-datos]]).
- **It behaves like the original**, with a list of bugs from the original
  program fixed on purpose. The list and its consequences are in
  [[tecnico/diferencias]].
- **It ships the Bestiary:** 684 bots that the community has published on the
  DarwinBots forum and wiki over the years, ready to seed.

There are two interfaces. The **new app**, in Spanish and English, is the one
this manual describes. The **classic interface**, at `/classic/`, is the first
web version, in English and closer to the original program; it keeps being
published as it is (see [[app/clasica]]).

## What you can do {#que-hacer}
<!-- web2/src/i18n/es/app.json (app.pantalla.*.desc); i18n/es/competir.json (Elo); web2/PLAN.md decisiones 2, 10, 11, 18, 21-23 -->

| If you want to… | Go to | And read |
|---|---|---|
| **Watch** a living world: how they hunt, hide and multiply | Home and Observe | [[empezar/primera-simulacion]] |
| **Experiment**: change the light, the costs, the physics, add obstacles, and see what happens | Experiment | [[app/experimentar]] |
| **Measure**: population charts, species, family tree, replicates with several seeds, reports | Analyze | [[app/analizar]] |
| **Write bots**: a DNA editor with warnings, quick test and versions | Bots | [[app/editor]] and the [[tutoriales/se-mueve|tutorials]] |
| **Compete**: matches and tournaments between bots, with standings, Elo and seasons that play themselves | Compete | [[app/competir]] |

## Where to go next {#seguir}
<!-- solo enlaces; el orden sigue port/sitio/indice.mjs -->

1. [[empezar/primera-simulacion]]: from opening the app to having a world
   running, with a bot of your own inside, in a few minutes.
2. [[empezar/recorrido]]: what each section of the app is for.
3. [[tutoriales/se-mueve]]: your first bot, step by step.
4. [[simulacion/ciclo]]: how the world works on the inside.

If you run into a word you don't know, it's in the [[empezar/glosario]].
The most common questions are in [[empezar/preguntas]].
