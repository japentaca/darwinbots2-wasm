---
titulo: "Parameters: Shapes (vision and drift)"
resumen: "How obstacles interact with the bots' vision and shots, and whether they move around the field on their own."
etiquetas: [shapes, obstacles, vision, drift, mazes, parameters]
estado: revisada
---
<!-- opciones.js «Formas»; core vision.hpp (shapesAreVisable, shapesAreSeeThrough), shots.hpp DoShotObstacleCollisions, physics.hpp DriftObstacles/MoveObstacles/TrashCompactorMove; 50-MUNDO §4 -->

Shapes are the rectangular obstacles you put in the world, loose or in mazes,
from the **World** bar in Observe or from the scenario's objects in Experiment
(see [[simulacion/mundo#obstaculos]]). To a bot's body they are always solid,
however you configure them: a bot that gets inside one is put back outside
(see [[simulacion/fisica#formas]]). What this group decides is everything
else: whether the eyes see them, whether they hide what is behind them, what
happens to the shots that hit them, and whether they move.

All of them can be changed while the simulation is running, and with no shapes
in the world they do nothing.

## Seeing and blocking {#vista}
<!-- 32-VISION §0.5, §3; simulacion/vision.md#formas -->

The two vision options combine like this:

| | Block what's behind | Don't block ([[param:opt:81]]) |
|---|---|---|
| **Invisible** (factory) | Ghost walls: you can't see them, but they hide the bots behind them. | They don't exist as far as vision is concerned: the eyes see through them and don't register them. |
| **Visible** ([[param:opt:80]]) | They are seen as walls and hide what's behind. | They are seen, and so is whatever is behind them. |

The factory combination is the oddest one: a bot hidden behind a wall shows up
in no eye, and neither does the wall. If you want the bots to learn to dodge
walls, turn visibility on. How the eye measures a shape and which senses it
changes is in [[simulacion/vision#formas]].

## Drift {#deriva}
<!-- physics.hpp DriftObstacles: vel += Random(−r, r) × rnd × 0,01 por eje; bordes: re-arma ±r × 0,01 hacia adentro; tope invertido replicado; comprobado: forma de 500 con deriva horizontal y velocidad 20 → 25 unidades en 200 ciclos; con 2000 → 222 en 50; revisor: MoveObstacles re-arma solo con pos < −Width o pos > FieldWidth; forma de 300 en campo de 8000 con 85=2000 → x entre −300 y 8000, saltos de lado a lado -->

With drift on, each shape changes its speed a little at random every cycle,
sideways ([[param:opt:84]]), up and down ([[param:opt:83]]) or in both
directions; [[param:opt:85]] says by how much. Since what changes at random is
the speed and not the position, the movement accumulates: the shape takes a
heading and gradually bends it. A shape can leave the field almost entirely;
when it leaves completely, the engine puts it just outside the edge and makes
it slowly come back in.

:::cuidado
The shapes' speed cap has a bug from the original that the port keeps: a shape
that goes past the world's speed cap ([[param:opt:11]]), instead of slowing
down, speeds up. With small drift speeds it never happens; with values in the
hundreds or thousands, shapes can go flying from one edge to the other.
:::

## Moving mazes {#laberintos}
<!-- dbcore_api.cpp db_sim_maze_polar_ice (83=84=1, 85=20), db_sim_maze_trash_compactor (vel ±85 × 0,1); web2 ordenes.js DERIVA_POLAR; comprobado: escombros con 85=0 quietos en 200 ciclos, con 20 avanzan 400 -->

Two mazes in the **World** bar use these parameters:

- **Polar** turns drift on in both axes and sets the speed to 20 when it is
  created. It is an options change like any other: it stays in the scenario
  and keeps going even if you later delete the plates.
- **Trash** moves its two walls at a speed of 0.1 × [[param:opt:85]] units per
  cycle, even if drift is off. With the speed at 0, which is the factory
  value, the walls stay still: set a value before creating the maze (with 20
  they advance 2 units per cycle).

:::parametro opt:80
<!-- vision.hpp:547 CompareShapes si shapesAreVisable -->
On, the eyes register shapes the way they register a bot: they give a value
according to the distance to the closest point of the shape, and if the
closest thing in the focus eye is a shape, [[.reftype]] is 1. Off (factory),
the eyes don't see them, and a bot only finds out about a wall when it hits
it ([[.hit]]). See [[simulacion/vision#formas]].
:::

:::parametro opt:81
<!-- vision.hpp:181 if (!shapesAreSeeThrough) — sombras -->
On, shapes don't block: the eyes see the bots behind them. Off (factory),
each shape casts a shadow and whatever is behind it doesn't show up in any
eye, even if the shape itself is invisible. Combined with [[param:opt:80]]
off, shapes disappear from sight completely.
:::

:::parametro opt:82
<!-- shots.hpp DoShotObstacleCollisions: absorbe → s.exist = false; si no, invierte el eje por el que entró -->
On, a shot that hits a shape vanishes, along with its energy or contents. Off
(factory), it bounces: it reverses direction along the side it came in on,
like a ball against a wall, and keeps traveling until its range runs out. With
bounces, a bot can receive shots that don't come from where the shooter is.
See [[simulacion/disparos]].
:::

:::parametro opt:84
<!-- DriftObstacles: eje x -->
Makes shapes randomly change their sideways speed, cycle by cycle. It only
moves anything if [[param:opt:85]] is greater than 0. It doesn't affect the
walls of the trash maze, which have their own movement.
:::

:::parametro opt:83
<!-- DriftObstacles: eje y -->
The same as [[param:opt:84]], for the up-and-down speed. With both on, shapes
wander in any direction.
:::

:::parametro opt:85
<!-- vel += Random(−r, r) × Rndy × 0,01; bordes ±r × 0,01; compactador ±r × 0,1 -->
How much a shape's speed can change each cycle: at most a hundredth of this
number, on each axis that has drift. With 20, the change is 0.2 per cycle at most,
and a shape takes hundreds of cycles to move a noticeable distance. It also
sets the speed at which a shape that left the field comes back in (a hundredth
of this value) and that of the trash maze's walls (a tenth). With 0, nothing
moves.
:::
