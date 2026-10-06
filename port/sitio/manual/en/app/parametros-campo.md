---
titulo: "Parameters: Field and edges"
resumen: "The size of the world and what happens at its edges: walls, or connected sides so that whatever leaves through one comes back in through the other."
etiquetas: [field, edges, toroidal, size, world]
estado: revisada
---
<!-- engine/opciones.js grupo 'campo' (base:fieldW, base:fieldH, opt:1-3), CONTROLES_BASICOS 'tamano' y 'bordes', dimensionesCampo; 50-MUNDO §1; 30-FISICA §5 -->

This group decides how much world there is and how it ends. It has five
parameters: the width and height of the field, and three switches for the
edges. In Experiment's basic mode the same values are chosen with two
controls, **Field size** (the fifteen classic sizes) and **Edges** (walls,
toroidal, or one of the two cylinders); here they show up separately and you
can set them by hand.

Size matters more than it looks: a large field spreads the same population
over more surface, so bots meet each other less often and vegetables get more
light (see [[simulacion/cloroplastos#fotosintesis|photosynthesis]]). The edges
change the geography: with walls there are corners to get cornered in and a
floor where whatever falls piles up; with connected sides there is neither.
How a bot behaves against a wall is covered in
[[simulacion/fisica#bordes|the edges of the world]], and the overall picture
of the world in [[simulacion/mundo#campo|the field]].

:::parametro base:fieldW
<!-- 50-MUNDO §1; wasm dbcore_api db_sim_set_field, RecomputeDivisors; core senses.hpp (mem 219 = pos.x / xDivisor); opciones.js vivo: false -->
The width of the world, in the same units used to measure positions and
speeds. The app starts at 32000; the **F1 league** base sets it to 9237. It
is the only parameter in this group that is **not applied live**: changing it
needs a new simulation.

Up to a width of 32000, [[.xpos]] reads the position as it is. In a wider
field, the engine scales it down proportionally so it fits between 0 and
32000: in a 64000-wide field, a bot at the right edge reads about 32000, not
64000.
:::

:::parametro base:fieldH
<!-- 50-MUNDO §1; core senses.hpp (mem 217 = pos.y / yDivisor); vegs.hpp (profundidad del estanque = pos.y/2000 + 1) -->
The height of the world. The vertical coordinate grows downwards, and the bot
reads it as depth in [[.depth]]; as with the width, in a field taller than
32000 the reading is scaled down proportionally. The app starts at 32000 and
the **F1 league** uses 6928. It also needs a new simulation.

Height matters more when there is gravity ([[param:opt:20]]), because the
floor is the bottom edge, and in pond mode ([[param:opt:30]]), where the light
drops one step every 2000 units of depth (see
[[simulacion/cloroplastos#fotosintesis|photosynthesis]]).
:::

:::parametro opt:1
<!-- opciones.js opt:1 derivado (2 && 3), efectosDe; dbcore_api set_opt case 1 escribe 2 y 3 -->
It is a shortcut: it reads “yes” when both pairs of edges are connected, and
then the world is a _torus_, with no edges in any direction. In the app it
can't be edited: it is **derived**, and you change it with the two parameters
below or with the **Edges** control in basic mode (the **Toroidal** option).
The **F1 league** base connects both axes.
:::

:::parametro opt:2
<!-- 30-FISICA §5 (bordercolls: ReSpawn del organismo, clamp + 5 %); core physics GravityForces (flotabilidad solo sin Updnconnected); shots: envoltura o rebote -->
It connects the top edge with the bottom one: whatever leaves through one
appears through the other at the same speed. It applies to bots, to whole
multibots (they cross in one go, without stretching the ties) and to shots.
When it is off, the two edges are walls: the bot ends up leaning against the
wall, slowed down, and reads [[.edge]] as 1.

Watch out if you use downward gravity ([[param:opt:20]]): with this axis
connected there is no floor, and bots fall forever, reappearing at the top. In
pond mode, buoyancy ([[.setboy]]) also only works with this axis **not**
connected (see
[[simulacion/mundo#gravedad|gravity, ponds and tides]]). With the **Edges**
control, it is the **Cylinder (top↔bottom)** option.
:::

:::parametro opt:3
<!-- 30-FISICA §5; mundo.md (viajero.txt en 2000x1000, con y sin opt:3) -->
It connects the left edge with the right one, in the same way. A bot that
keeps moving right in a field with walls ends up stuck against the edge; with
this axis connected it goes around the world again and again (the example is
in [[simulacion/mundo#bordes|the edges]]). With the **Edges** control, it is
the **Cylinder (left↔right)** option.

With random sun ([[param:opt:40]]), the lit strip also wraps from one side to
the other when it leaves the field, whether or not you connect this axis.
:::
