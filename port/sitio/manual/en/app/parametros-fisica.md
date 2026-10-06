---
titulo: "Parameters: Physics"
resumen: "The medium the bots move in: maximum speed, thrust efficiency, friction, fluid, gravity, collision bounce, random shoves, inertia and size."
etiquetas: [physics, movement, friction, fluid, gravity, collisions]
estado: revisada
---
<!-- engine/opciones.js grupo 'fisica' (opt:10-21), MEDIOS, F1_OPTS; 30-FISICA; core physics.hpp -->

These parameters define the medium the bots move in: how fast they can go,
what slows them down, what pushes them and how they collide. They change a
lot which kind of strategy pays off. In a world without friction, a bot that
has stopped pushing keeps going forever; in one with strong friction,
standing still is free and moving is expensive.

In Experiment's basic mode, the **Medium** control sets five of these
parameters at once with the original DarwinBots' values:

| Medium | [[param:opt:14]] | [[param:opt:15]] | [[param:opt:16]] | [[param:opt:17]] | [[param:opt:19]] |
|---|---|---|---|---|---|
| **Space** (how the app starts) | 0 | 0 | 0 | 0 | 0 |
| **Fluid** | 0.0000001 | 0.0005 | 0 | 0 | 0 |
| **Solid** (the **F1 league**'s) | 0 | 0 | 0.6 | 0.4 | 2 |

If you change any of them by hand, the control switches to **Custom**.
Everything that happens in the _forces and collisions_ and _movement_ phases
is in [[simulacion/fisica]], with measured examples; here you get what each
parameter changes. What it costs to move isn't in this group but in the costs
([[param:cost:20]], [[param:cost:21]]).

:::parametro opt:11
<!-- 30-FISICA §2.1, §6; core physics.hpp (recorte del empujón y de la velocidad en UpdatePosition; mem maxvel); comprobado: empuje.txt con 11=20, 12=1 → .velscalar y .maxvel 20 -->
The cap on a bot's speed, in units per cycle; bots read it in [[.maxvel]]. The
app starts at 40 and the **F1 league** raises it to 180. It clips two things:
the final speed of each cycle and the shove the bot can give itself with
[[.up]] and company, so the cost of moving doesn't go past this cap either
(see [[simulacion/fisica#empuje|voluntary thrust]]).

With 40, crossing a 32000 field takes at least 800 cycles.
:::

:::parametro opt:12
<!-- 30-FISICA §2.1 (VoluntaryForces: × PhysMoving después del recorte), GravityForces (flotabilidad / PhysMoving); comprobado: empuje.txt, 40 .up → .velscalar 26 con 0,66 -->
What fraction of the requested thrust turns into movement. With 0.66, the
value in the app and in the **F1 league**, `40 .up store` gives a light bot
about 26 speed in the first cycle. The cost is computed on the requested
thrust, not on what it yields: lowering this value makes moving more
expensive without making anything cheaper.

With 1 all the thrust is used; with 0 bots can't move on their own (gravity,
collisions and ties still move them). In pond mode, floating costs more the
lower this value is.
:::

:::parametro opt:13
<!-- 30-FISICA §2 (BrownianForces: impulso = PhysBrown·0,5·rnd, dirección al azar, giro al azar); core robots.hpp mareas (pisa PhysBrown) -->
Random shoves: every cycle, each bot gets a shove in a random direction, of up
to half this value, and a small random turn as well. Like any shove, it is
divided by the mass, so it barely moves heavy bots. The app has it at 0.

It keeps anything from staying completely still: it mixes populations and
gets vegetables out of the fixed positions where they were born. With tides
([[param:opt:64]]) the engine rewrites it every cycle. See
[[simulacion/fisica#browniano|Brownian motion]].
:::

:::parametro opt:14
<!-- 30-FISICA §1.1 (AddedMass), §2 (SphereDragForces: sin arrastre con Density o Viscosity en 0) -->
The density of the fluid. Together with [[param:opt:15]], it decides the
drag: a subtraction from speed that grows with speed and with the bot's
radius, and that doesn't depend on its mass. If either of the two is 0, there
is no drag. Density also adds _added mass_: the fluid the bot drags along with
it gives it more inertia, without making it heavier for gravity.

The app has it at 0; the original's water is 0.0000001 (1e-7), which is what
the **Fluid** medium sets. Useful values are very small: the usual range goes
up to 0.001. See [[simulacion/fisica#fluido|the fluid]].
:::

:::parametro opt:15
<!-- 30-FISICA §2 (SphereCd: Viscosity = 0 → Cd 0); fisica.md tabla «Fluido suave» (1e-7 / 0,00005) y «Agua» (1e-7 / 0,0005) -->
The viscosity of the fluid, the other half of the drag (see
[[param:opt:14]]). The app has it at 0; the original's water, the **Fluid**
medium's, is 0.0005. With those values a bot at the cap of 40 doesn't go past
20 while pushing and stops dead the moment it quits; with a viscosity ten
times smaller, it glides for several cycles. The table in
[[simulacion/fisica#fluido|the fluid]] compares the two.
:::

:::parametro opt:16
<!-- 30-FISICA §2 (FrictionForces: solo con Zgravity ≠ 0; umbral masa·Zgravity·coef) -->
Friction for starting off. If a bot is standing still and what pushes it in
that cycle doesn't exceed mass × [[param:opt:19]] × this coefficient, it
doesn't move, and the thrust is charged anyway. If it is already moving, it
only slows down sideways pushes. Without Z gravity it does nothing.

The app has it at 0 and the **F1 league** at 0.6: with that, a bot of mass 1 (and
[[param:opt:19]] at 2) has a threshold of 1.2 of effective thrust, and since the
engine only uses 0.66 of what you ask for ([[param:opt:12]]), it has to ask for
more than 1.8 (`2 .up store`) to start off. The
threshold grows with mass, so very heavy bots get stuck. See
[[simulacion/fisica#rozamiento|friction]].
:::

:::parametro opt:17
<!-- 30-FISICA §2 (FrictionForces: resta masa·Zgravity·coef de la rapidez, sin pasar de 0); fisica.md tabla «Rozamiento F1» -->
Friction in motion: every cycle it subtracts mass × [[param:opt:19]] × this
coefficient from the bot's speed, without letting it go negative. It isn't
divided by the mass, so it slows heavy bots much more. Without Z gravity it
does nothing.

The app has it at 0 and the **F1 league** at 0.4: a bot of mass 1 loses 0.8
speed per cycle and, if it stops pushing at 40, comes to a halt in about 50
cycles.
:::

:::parametro opt:18
<!-- 30-FISICA §4.2, §4.3 (Repel3: corrección parcial de la superposición y choque con coeficiente e) -->
How much bots bounce when they collide with each other. With 0, the value in
the app and in the **F1 league**, the collision is soft: along the direction
of the hit the two end up with the same velocity, as if one pushed the other.
With 1 they bounce like billiard balls. It also changes how much two
overlapping bots separate per cycle: with 0 about a quarter of the overlap is
undone, with 1 almost all of it.

With high bounce, a bot that rams gets sent flying; with soft collisions, it
can push another one. See [[simulacion/fisica#choques|collisions between bots]].
:::

:::parametro opt:19
<!-- 30-FISICA §2 (FrictionForces: Zgravity = 0 → sin rozamiento) -->
A gravity that moves nobody: it presses the bots against the “floor” and is
what makes friction work. The two coefficients ([[param:opt:16]] and
[[param:opt:17]]) are multiplied by it, so with 0 (as the app starts) there is
no friction even if the coefficients aren't 0. The **F1 league** uses 2.
:::

:::parametro opt:20
<!-- 30-FISICA §2 (GravityForces: impulso Ygravity·masa → +Ygravity de velocidad por ciclo); comprobado en fisica.md (+1 por ciclo con 1) -->
Downward gravity: every cycle it adds this value to the vertical speed of
every bot, whatever it weighs. With 1, a bot standing still falls at 1, 2,
3… up to the speed cap. The app has it at 0.

With walls, everything ends up at the bottom; if top and bottom are connected
([[param:opt:2]]), bots fall forever. In pond mode ([[param:opt:30]]) it is
what lets you float with [[.setboy]]. With tides ([[param:opt:64]]) the engine
rewrites it every cycle. See [[simulacion/fisica#gravedad|gravity and buoyancy]].
:::

:::parametro opt:10
<!-- 30-FISICA §6 (ZeroMomentum: vel = 0 al final de UpdatePosition); comprobado: empuje.txt con 10=1 → avanza 26 por ciclo mientras empuja y se frena en seco; .velscalar 26, .velup 0 -->
No inertia: at the end of every cycle the engine zeroes everyone's velocity. A
bot moves only while it pushes and stops dead when it quits. Nothing builds
up from one cycle to the next: with gravity 1, a bot always falls 1 per cycle
instead of going faster and faster. Off in the app.

In a test, a bot pushing 40 with the default efficiency moved 26 per cycle,
always the same, and stood still in the cycle it stopped pushing. While it
was moving, [[.velscalar]] reported 26, but [[.velup]] and [[.veldx]] read 0.
:::

:::parametro opt:21
<!-- 30-FISICA §1.2 (FindRadius: FixedBotRadii → half = 60); vegs.hpp (el área de los bots tapa la luz) -->
All bots are the same size, with a radius of 60, whatever body or chloroplasts they
have. Mass keeps changing as usual; only the size changes, which decides when
two bots touch, how much the fluid slows them and how much light they block.
Without this option, a bot with 1000 body measures 114 and one full of
chloroplasts approaches 415 (see
[[simulacion/fisica#estado|a bot's physical state]]). Off in the app.

With fixed radii, getting fat doesn't make you easier to reach, and it doesn't
take light from your neighbors.
:::
