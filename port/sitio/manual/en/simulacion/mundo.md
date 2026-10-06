---
titulo: The world
resumen: "The setting where bots live: the size of the field, edges that are walls or connected, obstacles and mazes, teleporters, light, gravity and tides, and the costs that apply to everyone."
etiquetas: [world, field, edges, obstacles, teleporters, costs]
estado: revisada
---
Bots live in a flat rectangle. Everything that isn't a bot (the size of that
rectangle, what happens at its edges, any walls inside it, the light, gravity, what
each action costs) is part of the _world_, and is configured with the app's
parameters (see [[app/experimentar]] and [[app/experimentar-avanzado]]).

This page goes through those pieces. The ones that have a page of their own (the
sun and vegetables, the fine points of physics) are covered here only as much as
needed, with the link.

## The field {#campo}
<!-- 50-MUNDO §1; engine/opciones.js base:fieldW/fieldH, dimensionesCampo; sysvars .xpos .depth -->

The field measures [[param:base:fieldW]] by [[param:base:fieldH]]. The origin is at
the top left: the horizontal coordinate grows to the right and the vertical one
downward, which is why the bot reads its height as a depth, in [[.depth]], and the
horizontal one in [[.xpos]].

The app offers the classic sizes of the original: number 1 is the F1 contest field,
9237 × 6928, and from 2 to 12 they grow in steps of 8000 × 6000 (number 2 measures
16000 × 12000). You can also enter any size by hand. The size can't be changed in a
simulation that is already running: you need a new one.

To get a sense of scale: with the default maximum speed ([[param:opt:11]]), a bot
advances at most 40 units per cycle, so crossing an F1 field takes it more than two
hundred cycles.

## The edges {#bordes}
<!-- 30-FISICA §5 (bordercolls: ReSpawn toroidal del organismo, clamp + amortiguador); engine/opciones.js opt:1-3; probado: viajero.txt en 2000x1000, con y sin opt:3 -->

Each pair of edges can be a wall or be connected:

- [[param:opt:3]]: what leaves through the right comes in through the left, and the
  other way around.
- [[param:opt:2]]: what leaves through the bottom comes in through the top, and the
  other way around.
- [[param:opt:1]] is the shortcut to connect both pairs at once: a _toroidal_
  world, with no edges.

Against a wall, the bot doesn't bounce: it ends up resting on the edge, braked, and
[[.edge]] turns on. On a connected edge, on the other hand, it reappears on the
other side with the same velocity. If it is a multibot (see [[simulacion/lazos]]),
the whole organism crosses at once, without the ties stretching. The details of
hitting the wall are in [[simulacion/fisica#bordes]].

This bot looks to the right at birth and always moves forward:

```adn
' Faces right and always moves forward
cond
 *.robage 0 =
start
 0 .setaim store
stop
cond
start
 10 .up store
stop
end
```

In a field 2000 wide with walls, it reaches the right side in cycle 33 and stays
there, with `.edge` at 1. With the sides connected, in cycle 36 it is already near
the left edge and keeps traveling.

## Obstacles and mazes {#obstaculos}
<!-- 50-MUNDO §4; 30-FISICA §4.4; core physics.hpp TrashCompactorMove; wasm db_sim_maze_polar_ice; engine/escenarios/index.js (objetos); i18n experimentar.objetos.* -->

Obstacles (also called _shapes_) are fixed rectangles inside the field. In
Experiment, “World objects”, they are added in three ways: a single obstacle,
batches of ten at random, or a maze. They are placed using the simulation's seed,
so the same seed gives the same map, and changing them requires a new simulation.

There are six mazes; in the row-based ones and in the spiral you choose the width
of the corridor and of the wall, and in the checkerboard, that of the corridor:

| Maze | What it is like |
|---|---|
| horizontal, vertical | Rows of walls, each with an opening at random. |
| spiral | Rectangular rings one inside the other, with the openings offset. |
| checkerboard | A grid of square blocks in the center of the field. |
| polar | Nine big blocks, one on top of the other in the center, that drift apart (the maze turns drift on). |
| trash | Two walls from the sides. If [[param:opt:85]] is greater than 0 when they are created, they advance, cross and come back; with the factory value (0) they stay still. |

A bot that hits an obstacle is pushed out by the nearest side and feels the hit in
[[.hit]] and its directions. If a bot is squeezed between three at once, the engine
makes it jump to free it.

The rest is configured:

| Parameter | What it changes |
|---|---|
| [[param:opt:80]] | Eyes detect obstacles. If not, they are invisible: the bot only finds out when it hits one. See [[simulacion/vision]]. |
| [[param:opt:81]] | You can see through them. |
| [[param:opt:82]] | Shots that touch them disappear (otherwise, they bounce). |
| [[param:opt:84]], [[param:opt:83]], [[param:opt:85]] | Obstacles move on their own, sideways or up and down. |

When the closest thing the focus eye sees is an obstacle, [[.reftype]] is 1, and
that tells it apart from another bot.

## Teleporters {#teleporters}
<!-- 50-MUNDO §3 (local: ReSpawn del organismo, 2 RNG); engine/sim.js case 'teleporter' (ancho 300, vegetales, cadáveres y heterótrofos); escenarios TOPE_TELEPORTERS = 10; web2/PLAN.md C22 -->

A teleporter is a circle that sends whatever touches it somewhere else. In the app
they are _local_: the bot that enters (animal, vegetable or corpse) reappears at a
random point of the field, and if it is a multibot the whole organism travels. Up to
ten can be placed, in random places with the seed.

They are useful, for example, for mixing populations that a maze would keep
separate.

:::nota
The original also had teleporters that sent bots to another computer over the
Internet, and that received them. This app doesn't include them yet.
:::

## Light {#luz}
<!-- 50-MUNDO §2.2 (feedvegs: día/noche, umbrales, banda móvil, estanque); core vegs.hpp (reloj CycleLength); probado: quieto.txt con opt:33=1, opt:34=5 -->

Energy enters the world through the sun, which feeds bots with chloroplasts. How
they eat is in [[simulacion/cloroplastos]]; what the world decides is when and where
there is light:

- **Day and night.** With [[param:opt:33]], the sun turns off and on. Each half
  lasts one cycle more than [[param:opt:34]]: with 5, six cycles of day and six of
  night. Bots read it in [[.daytime]].
- **Random sun.** With [[param:opt:40]], the light falls on a vertical strip that
  shifts little by little and changes direction from time to time. Outside the
  strip nobody eats.
- **Energy thresholds.** [[param:opt:35]] and [[param:opt:37]] turn the sun on or
  off according to the world's total energy (the thresholds are [[param:opt:36]] and
  [[param:opt:38]]), and [[param:opt:39]] says whether that holds for one cycle,
  forever, or whether it advances the day clock.
- **Pond.** With [[param:opt:30]], the light arrives at [[param:opt:31]] at the top
  and weakens with depth, according to [[param:opt:32]].

## Gravity, pond and tides {#gravedad}
<!-- 30-FISICA §2 (GravityForces, flotabilidad); core physics.hpp GravityForces; core robots.hpp mareas (BouyancyScaling pisa Ygravity y PhysBrown); vegs.hpp (acttok × (1 − BouyancyScaling)); probado: boya.txt (opt:30=1, opt:20=0.05) y quieto.txt con opt:64=100 -->

[[param:opt:20]] pulls each bot downward with a force proportional to its mass
([[.mass]]). It is the one that turns the field into a pond with a bottom. The
other one, [[param:opt:19]], moves nobody: it presses the bots against the “ground”
and so activates friction (see [[simulacion/fisica]]).

In pond mode, with gravity and with the top and bottom edges not connected, bots
can float. Each one has a buoyancy between 0 and 1, which it sets with [[.setboy]]
and reads in [[.rdboy]]: the engine pushes it up or down to bring it to the height
that corresponds to it. With buoyancy 0 it sinks to the bottom, with 1 it rises to
the surface and with 0.5 it seeks the middle of the pond. Staying afloat charges
energy like movement does ([[param:cost:20]]).

```adn
' At birth, sets its buoyancy to the middle
cond
 *.robage 0 =
start
 16000 .setboy store
stop
end
```

In a pond 2000 high, with no friction, this bot seeded at a depth of 731 goes down,
passes the middle and comes back: it oscillates around 1000. _B-Alpha Pond_, from
the Bestiary, does the opposite: at birth it writes −50 to `.setboy`, sinks, and
anchors itself with [[.fixpos]] on passing 6500 of depth.

**Tides** ([[param:opt:64]]) make the world oscillate with the period you set, in
cycles. In one part of the period gravity rises (up to 4) and the sun feeds at full
strength; in the other, gravity falls almost to 0, the water gets agitated
(Brownian motion) and vegetables barely eat.

:::cuidado
While there are tides, the engine rewrites gravity and Brownian motion
([[param:opt:13]]) every cycle: whatever you put in those parameters isn't used.
And if you turn them off, they keep the last value the tide gave them.
:::

## Costs {#costos}
<!-- 31-ENERGIA §0.5 (COSTMULTIPLIER escala todo); 10-CICLO §2 pasos 6-7; core master.hpp DynamicCostsStep -->

What each thing costs is also part of the world, the same for all bots: running
instructions, moving, shooting, having a body or a long DNA, making defenses,
reproducing. They are the cost parameters (like [[param:cost:7]] or
[[param:cost:23]]); they come at 0, unless you choose a base that sets them, like
that of the F1 contests. What each one charges and at what moment is in
[[simulacion/energia]] and in [[adn/ejecucion]].

All of them are multiplied by [[param:cost:54]]: with 0 everything is free, with 2
everything costs double. With [[param:cost:56]] that multiplier adjusts itself,
rising when there are too many bots and dropping when there are too few, to bring
the population closer to [[param:cost:53]]; and separately there is a brake that
makes everything free when very few bots are left ([[param:cost:52]]). How the two
work is in [[simulacion/ciclo#costos-dinamicos]].

## Tournaments and other modes {#modos}
<!-- 50-MUNDO §5 (capa de torneo ⚙) -->

The original also came with rules for contests: rounds that restart when no animals
are left ([[param:opt:90]]), the F1 mode in which species compete until one wins
([[param:opt:91]]) or the disqualification of species that do something forbidden
([[param:opt:93]]). They are in the app, but the usual way to use them is from
Compete (see [[app/competir]]), which sets up the matches and keeps the tally.
