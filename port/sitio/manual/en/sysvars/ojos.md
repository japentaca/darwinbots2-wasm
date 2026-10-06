---
titulo: Eyes
resumen: "The bot's nine eyes, the focus eye and the cells that aim and widen each eye: how a bot sees and what number each eye gives it."
etiquetas: [eyes, vision, senses, focuseye]
estado: revisada
---
A bot has nine eyes, from [[.eye1]] to [[.eye9]], laid out like a fan
around the direction it is pointing ([[.aim]]). Each eye is a cell that the engine
fills in every cycle with a number: 0 if it sees nothing, and bigger the closer
what it sees is. It is the most-used sense of all; almost any bot that
looks for food or fights starts with something like `*.eye5 0 >`. How sight works
inside is explained in [[simulacion/vision]].
<!-- 32-VISION §0.1, §1; sysvars.yaml .eye1 -->

## Where each eye looks {#geometria}

By default each eye covers 10 degrees. [[.eye5]] looks straight ahead; the
lower-numbered ones look to the left and the higher ones to the right, 10
degrees apart: `.eye1` is centered 40 degrees to the left and `.eye9` 40 to the
right. Together the nine cover 90 degrees. A large or close object can
show up in several eyes at once.
<!-- 32-VISION §0.2 -->

## What number they give {#valor}

The value depends on the distance between the edges and on the eye's reach. With
the factory eye, which reaches about 1440 units:

| Distance between edges | Value |
|---|---|
| touching or overlapping | 32000 |
| almost touching | about 20700 |
| 134 | 100 |
| 278 | 25 |
| 710 | 4 |
| 1430 | 1 |

Each eye gives the value of the closest thing it sees. At night the reach drops by 20%,
and in pond mode it shortens with depth.
<!-- 32-VISION §0.3, §0.4, §2.6 -->

## Configuring the eyes {#configurar}

The eyes can be re-aimed with [[.eye1dir]]…[[.eye9dir]] and widened with
[[.eye1width]]…[[.eye9width]]; a wider eye sees less far and gives smaller numbers
at the same distance. [[.focuseye]] chooses which eye is the focus eye: its
value is copied into [[.eyef]] and what it sees fills the cells of
[[sysvars/ref|what it sees]]. All these configuration cells stay as
you leave them; writing them once is enough, for example in the first cycle:
<!-- 32-VISION §0.2, §0.4, §2.6; sysvars.yaml .focuseye .eye1dir .eye1width (persisten) -->

```adn
' front eye a little wider and focus on the front eye
cond
*.robage 0 =
start
35 .eye5width store
0 .focuseye store
stop
```

What the eyes see arrives one cycle late: the engine writes it after
moving everybody (see [[adn/ejecucion#retraso]]).
<!-- 32-VISION §0.1 -->
