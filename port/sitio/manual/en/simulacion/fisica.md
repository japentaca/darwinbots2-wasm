---
titulo: Physics
resumen: "How a bot moves: its mass and radius, the forces that push or slow it, collisions, the edges of the world, the speed cap and turning."
etiquetas: [physics, movement, forces, collisions, edges, turning]
estado: revisada
---
Every bot is a circle sliding on a plane. It has a position, a velocity, a mass, a radius and a heading, and the world updates them in two phases of each cycle ([[simulacion/ciclo]]): in _forces and collisions_ it gathers everything that pushes or slows the bot and resolves the collisions; in _movement_ it applies those forces all at once, turns the bot and moves it. There is no continuous time: everything happens in jumps of one cycle.

## A bot's physical state {#estado}
<!-- 30-FISICA §1, §1.1, §1.2 -->

| What | How your DNA reads it |
|---|---|
| Position | [[.xpos]] and [[.depth]] (depth grows downward) |
| Velocity | [[.velup]] and [[.veldx]] relative to the heading; [[.velscalar]], the speed |
| Heading | [[.aim]] (1256 is a full turn) |
| Mass | [[.mass]] |
| Radius | has no sysvar |
| Anchored or free | [[.fixed]] |

All of them arrive one cycle late, like all the senses ([[adn/ejecucion#retraso]]).

**Mass** comes from the body, the shell and the chloroplasts: 1 for every 1000 of [[.body]], 1 for every 200 of [[.shell]] and almost 1 for every chloroplast. It never drops below 1 or goes over 32000. An ordinary bot weighs 1; one with 500 chloroplasts weighs almost 500 (the details are in [[.mass]]).

**The radius** grows with the body, more and more slowly:

| Body | 100 | 1000 | 5000 | 10000 | 32000 |
|---|---|---|---|---|---|
| Radius | 46 | 114 | 210 | 271 | 415 |

Chloroplasts bring the radius closer to 415, that of a bot with a body of 32000: the more it has, the closer it gets. With the option [[param:opt:21]] every bot measures 60, whatever its body. The radius decides when two bots touch and how much the fluid slows them.

## Forces, inertia and the cap {#fuerzas}
<!-- 30-FISICA §0.1, §2, §6; core UpdatePosition (ZeroMomentum: velscalar sale de la velocidad antes de anularla; vel y veldx, después) -->

Forces don't change the position directly. During _forces and collisions_ they are added up into an accumulator; in _movement_, the velocity receives that accumulator divided by the mass, is clipped to the cap, and only then does the position advance by what the velocity says:

```
forces and collisions                    movement
  friction and fluid: slow it right away   velocity += accumulator ÷ mass
  Brownian, gravity, thrust,               velocity, at most the cap
  ties: go to the accumulator              position += velocity
  collisions, walls, shapes: fix
  the position and slow it
```

What isn't slowed keeps going: with no friction or fluid, a bot that stopped pushing keeps its velocity forever. The cap is [[param:opt:11]] (40 by default; the F1 rules raise it to 180), which the bot reads in [[.maxvel]]. With [[param:opt:10]] turned on, the world zeroes the velocity at the end of every cycle: the bot only moves while it pushes, although [[.velscalar]] still reports how far it advanced in the last cycle ([[.velup]] and [[.veldx]], on the other hand, read 0).

## Voluntary thrust {#empuje}
<!-- 30-FISICA §2.1; comprobado: 10 .up → 7, 13, 20, 26; 100 .up cobra 40 con MOVECOST 1 -->

The bot pushes itself by writing to [[.up]], [[.dn]], [[.sx]] and [[.dx]] (the full group is in [[sysvars/movimiento]]). The world does this calculation:

1. It builds the push with `.up − .dn` forward and `.sx − .dx` sideways, measured from the heading.
2. It multiplies it by the mass and, if the result exceeds the speed cap, clips it to that cap.
3. It applies the efficiency [[param:opt:12]] (0.66 by default) and adds it to the accumulator.

Since it is divided by the mass afterwards, for a light bot the mass cancels out: `10 .up store` adds about 6.6 of velocity per cycle. But the clipping in step 2 kicks in sooner the heavier the bot is, so a heavy bot accelerates very little even when it pushes hard.

**The cost** is the push already clipped in step 2 times [[param:cost:20]] (and times the [[param:cost:54]]). With the cost of moving at 1, `10 .up store` costs 10 and `100 .up store` costs 40, the same as 40, because the cap already clipped it. It is charged even if the push fails to move the bot (because of friction, see below), but never more than the energy it has left. Corpses and fixed bots are not pushed and don't pay.

This bot buys 500 chloroplasts at birth and then pushes at full strength:

```adn
' Buys 500 chloroplasts at birth and, from cycle 5, pushes at full strength
cond
  *.robage 0 =
start
  500 .mkchlr store
stop

cond
  *.robage 4 >
start
  40 .up store
stop
end
```

<!-- comprobado: masa ~490, 40 de energía por ciclo, .velscalar 4 en el ciclo 80; muere en el 82 -->
It weighs about 490. With the cost of moving at 1 it pays 40 per cycle and gains barely 0.05 of velocity: after about 75 cycles of pushing it reaches 4 and runs out of energy. A bot without chloroplasts reaches 40 in two cycles for the same price.

## Friction with the ground {#rozamiento}
<!-- 30-FISICA §2 (FrictionForces; corrección de fricción estática en P1); comprobado con Zgravity 2, 0,6 y 0,4 -->

Friction exists only if [[param:opt:19]] is different from 0: that gravity presses the bots against the ground. It has two parts:

- **Kinetic** ([[param:opt:17]]): every cycle it subtracts mass × Z gravity × coefficient from the speed, without going below 0. That subtraction is not divided by the mass: a heavy bot is slowed much more.
- **Static** ([[param:opt:16]]): if the bot is at rest and the sum of what pushes it in that cycle is less than mass × Z gravity × coefficient, it doesn't move. If it is already moving, it only slows the sideways pushes.

The F1 rules use Z gravity 2, static 0.6 and kinetic 0.4. A bot of mass 1 then loses 0.8 of speed per cycle, and to get going it needs an effective push greater than 1.2: `1 .up store` (0.66) doesn't move it and is still charged, `2 .up store` (1.32) does. The same threshold grows with the mass: with the F1 cap of 180, a bot of more than about 100 mass can't get going with its own thrust.

## The fluid: density and viscosity {#fluido}
<!-- 30-FISICA §1.1 (AddedMass), §2 (SphereDragForces, tope 0,99·v); comprobado: arrastre 0 con viscosidad 0 -->

With [[param:opt:14]] and [[param:opt:15]] different from 0, the world is a fluid. Drag subtracts from the velocity a part that grows with the speed and with the radius (like kinetic friction, it doesn't depend on the mass), and never more than 99%. If either of the two is 0, there is no drag. Density also adds the _added mass_, the fluid the bot drags along with it: more inertia, without more weight for gravity.

This bot pushes for three cycles and then lets itself drift:

```adn
' Pushes for three cycles and then lets itself drift
cond
  *.robage 3 <
start
  40 .up store
stop
end
```

<!-- comprobado en un campo de 20000 × 20000; fluido suave: densidad 1e-7 y viscosidad 0,00005; agua: 1e-7 y 0,0005 -->
Its [[.velscalar]] (body 1000, cap 40) in four different worlds:

| Cycle | No friction or fluid | F1 friction | Mild fluid | “Water” |
|---|---|---|---|---|
| 1 | 26 | 26 | 20 | 20 |
| 3 | 40 | 40 | 40 | 20 |
| 4 | 40 | 39 | 31 | 0 |
| 10 | 40 | 34 | 9 | 0 |
| 20 | 40 | 26 | 2 | 0 |
| 40 | 40 | 10 | 0 | 0 |

Friction slows it little by little and evenly; the fluid, in proportion to the velocity. With the values the app suggests for water, the bot doesn't get past 20 while it pushes and stops dead as soon as it stops.

## Gravity, buoyancy and tides {#gravedad}
<!-- 30-FISICA §2 (GravityForces); 31-ENERGIA §1; Robots.bas mareas: Ygravity = (1−s)·4, PhysBrown 10; comprobado: +1 de velocidad por ciclo con Ygravity 1 -->

[[param:opt:20]] pulls everything downward: every cycle it adds that value to the downward velocity, no matter how much the bot weighs and without going through the efficiency. With 1, a bot at rest falls at 1, 2, 3… up to the cap. In a world with walls it ends up at the bottom; if top and bottom are connected, it falls forever and reappears at the top.

In pond mode ([[param:opt:30]]), with gravity and top not connected to bottom, each bot picks a height with its buoyancy ([[.setboy]], which is read in [[.rdboy]]). If it is above that height, gravity sinks it; if it is below, it pushes it up. Floating costs energy every cycle, in proportion to the buoyancy, the gravity and the mass (which counts up to 192), at the price of [[param:cost:20]].

<!-- Bestiario: B-Alpha_Pond_F2_K0zm0_-25.04.04.txt -->
_B-Alpha_, from the Bestiary, is a pond bot: at birth it asks to lower its buoyancy (with 0 it goes to the bottom) and, when it reaches a certain depth, it anchors itself and stops asking for buoyancy:

```adn
cond
*.depth 6500 >
*.fixed 0 =
start
1 .fixpos store
0 .setboy store
stop
```

With tides ([[param:opt:64]]) the world drives gravity by itself: it raises and lowers it between 0 and 4 over the course of the period, shifts the floating heights, and while gravity is low it turns Brownian motion on.

## Brownian motion {#browniano}
<!-- 30-FISICA §2 (BrownianForces: 3 extracciones; I = PhysBrown·0,5·rnd); comprobado con PhysBrown 10 -->

With [[param:opt:13]] different from 0, every bot receives a random push each cycle, in a random direction and of up to half that value, plus a small random turn. Like every push, it is divided by the mass: heavy bots are barely shaken by it. It is the only force that uses random numbers.

## Collisions between bots {#choques}
<!-- 30-FISICA §0.5, §4.2, §4.3 (Repel3) -->

Two bots collide when their circles overlap. The world checks it in _forces and collisions_, with the positions from the end of the previous cycle, once per pair. Everyone collides: living bots, vegetables and corpses. Each collision does three things:

**It separates them.** If both are at rest (or both fixed), each one backs off half of the overlap and they end up just touching. Otherwise, only a part is corrected per cycle, which depends on [[param:opt:18]]: with 0 about a quarter of the overlap is undone, with 1 almost all of it. The lighter one is the one that moves more.

**It changes their velocity.** Only the part of the velocity along the line joining the centers counts; the sideways part doesn't change. With elasticity 0 (the default, and F1's) the collision is soft: both end up with the same velocity in that direction, as if one pushed the other. With 1 they bounce like billiard balls. A fixed bot counts as mass 32000 and doesn't change its velocity.

**It notifies them.** Both read [[.hit]] in the next cycle, with the side of the hit in [[.hitup]], [[.hitdn]], [[.hitdx]] or [[.hitsx]], and their `ref*` sysvars are filled with the other's data even if they aren't looking at it (see [[sysvars/contacto]] and [[sysvars/ref]]).

## Collisions with shapes {#formas}
<!-- 30-FISICA §4.4 (DoObstacleCollisions: amortiguación vel·0,5, anti-atasco ±200 a la tercera forma, REFTYPE = 1) -->

The shapes in the world ([[simulacion/mundo]]) are solid rectangles. A bot that gets into one ends up outside again, resting against the nearest side. If it came from outside, it also loses part of its velocity on that axis (half if it weighs 1, less the more it weighs) and reads [[.hit]] with the side of the hit; if it was well inside, on the other hand, it gets a push outward. If at that moment its eyes see nothing, [[.reftype]] is 1. If it overlaps three shapes at once, the world takes it out with a jump of 200 on each axis so it doesn't get trapped. A shape doesn't turn [[.edge]] on.

## The edges of the world {#bordes}
<!-- 30-FISICA §5 (bordercolls, ReSpawn del organismo entero); comprobado: reposo en el fondo con .velscalar 20 y .edge 1 -->

Each pair of edges can be connected or be a wall: [[param:opt:2]] and [[param:opt:3]] (if both are on, the world is [[param:opt:1]]).

- **Connected.** A bot that leaves through one side enters through the opposite one. If it is a multicellular bot, the world moves the whole organism at once ([[simulacion/lazos]]).
- **Wall.** A bot that touches the edge is placed against it, reads [[.edge]] as 1 and loses 5% of its velocity on that axis (divided by its mass). It doesn't bounce and its velocity isn't cleared: if it keeps heading outward, it stays stuck to the wall, and since the placement happens before the movement, it can poke out a little past the edge.

With gravity 1 and walls, a bot at rest falls to the bottom and stays there reading [[.velscalar]] 20 and [[.edge]] 1 every cycle: gravity and the wall's braking cancel out. To tell whether a bot is stuck, look at [[.edge]] or compare its position between cycles, not its velocity.

## Heading and turning {#giro}
<!-- 30-FISICA §7 (SetAimFunc: prioridad de setaim, costo |Round((diff+diff2)/200,3)|·TURNCOST, ma); comprobado: 314 .aimsx cuesta 1,57; de 0 a 1200 con 1200 .setaim 6,56 y con -56 .setaim 0,28 -->

The bot turns in _movement_, before moving: [[.aimsx]] and [[.aimdx]] turn _by_ an amount, [[.setaim]] turns _to_ a heading, and if you write to `.setaim` a heading different from the current one, that one takes priority. A fixed bot can also turn.

Turning costs [[param:cost:21]] (multiplied by the [[param:cost:54]]) for every 200 units of turn: a quarter turn (314) costs 1.57 and a full turn, 6.28. With `.setaim` the turn is the shortest one to the requested heading, but the cost depends on the _number_ you write: if it lies more than half a turn from the current heading, it counts as the number, and on top of that as many full turns as fit in the difference are charged, rounding (1256 per turn).

```adn
' Looks at 0 at birth; in cycle 3 turns to 1200 by writing -56
cond
  *.robage 0 =
start
  0 .setaim store
stop

cond
  *.robage 2 =
start
  -56 .setaim store
stop
end
```

With the cost of turning at 1, this bot pays 0.28 to go from 0 to 1200. If it writes `1200` instead of `-56`, it ends up at the same heading but pays 6.56. To avoid overpaying, work out the new heading from the current one (for example, `*.aim 100 add`) or turn with `.aimsx` and `.aimdx`.

**Turning has inertia.** Brownian motion and ties ([[simulacion/lazos]]) can leave the bot with a spin of its own that is added to the heading every cycle, even if the DNA asks for nothing. Friction slows it, the fluid almost always cancels it, and a voluntary turn in the opposite direction subtracts from it. A turn in the same direction doesn't increase it.

## Fixed bots {#fijos}
<!-- 30-FISICA §2 (gate Not Fixed), §4.3 (fijo = masa 32000; la separación posicional mueve también al fijo), §6 (vel = 0) -->

A bot with [[.fixpos]] greater than 0 is anchored: it receives no force at all (not its own thrust, nor gravity, nor Brownian motion), its velocity is 0 and in collisions it counts as a wall of mass 32000. The only thing that can move it a little is the separation from a collision or a shape that lands on top of it. [[param:opt:72]] turns off anchoring for everyone.

## The parameters at a glance {#parametros}
<!-- spec/constants.yaml (valores por defecto); web2/engine/opciones.js (F1_OPTS, F1_COSTOS) -->

| Parameter | What it changes | Default | F1 |
|---|---|---|---|
| [[param:opt:11]] | Speed and thrust cap | 40 | 180 |
| [[param:opt:12]] | Part of the thrust that becomes movement | 0.66 | doesn't change it |
| [[param:opt:19]], [[param:opt:16]], [[param:opt:17]] | Friction with the ground | 0 | 2; 0.6; 0.4 |
| [[param:opt:14]], [[param:opt:15]] | Fluid drag | 0 | 0 |
| [[param:opt:20]] | Downward gravity | 0 | 0 |
| [[param:opt:13]] | Random pushes | 0 | 0 |
| [[param:opt:18]] | Bounce of collisions | 0 | 0 |
| [[param:opt:10]] | Stop dead every cycle | no | doesn't change it |
| [[param:opt:2]], [[param:opt:3]] | Connected edges | no | yes |
| [[param:cost:20]], [[param:cost:21]] | Price of pushing and of turning | 0 | 0.05; 0 |

All of them are in [[app/parametros-fisica]], except the edges ([[app/parametros-campo]]) and the costs ([[app/parametros-costos]]).
