---
titulo: Vision
resumen: "How a bot sees: the nine eyes and their fan, range according to width, what number each eye gives, the focus eye that fills the ref* cells, shapes, spying, and the senses of contact and taste."
etiquetas: [vision, eyes, focuseye, ref, senses, shapes]
estado: revisada
---
<!-- 32-VISION completo; 10-CICLO §0.4; 21-MEMORIA §3; README del port, «Bugs del original corregidos» (A3-1, B2-1, B2-3, B2-4, B2-5) -->
A bot knows nothing about the world except what its senses tell it, and the
most important one is sight. This page explains the mechanism as a whole:
where each eye looks, how far it reaches, what number it gives, how it picks
which thing gets described in detail, and what other senses complete the
picture. The cells one by one are in the reference: [[sysvars/ojos]],
[[sysvars/ref]] and [[sysvars/contacto]].

## When bots look {#cuando}
<!-- 32-VISION §0.1; 10-CICLO §0.4 (visión dentro de la pasada de acciones, posiciones finales) -->

Sight is computed once per cycle, in the **actions** phase, when movement has
already finished: each bot looks at the world with the final positions of the
cycle. Your DNA reads that result in the next cycle. If you turn now, what's
in the new direction only shows up in the next cycle (see
[[adn/ejecucion#retraso]]).

On each pass the nine eyes go back to 0 and are filled in again, so an eye
never carries over what it saw before. Corpses don't look: their eyes stay at 0
from the moment they die.

## The nine eyes {#ojos}
<!-- 32-VISION §0.2 -->

Each bot has nine eyes, from [[.eye1]] to [[.eye9]], spread in a fan around its
heading ([[.aim]]). By default each one spans 10 degrees and they sit side by
side: [[.eye5]] looks straight ahead, the low-numbered ones to the left and the
high-numbered ones to the right.

| Eye | `.eye1` | `.eye2` | `.eye3` | `.eye4` | `.eye5` | `.eye6` | `.eye7` | `.eye8` | `.eye9` |
|---|---|---|---|---|---|---|---|---|---|
| Center | 40° left | 30° left | 20° left | 10° left | ahead | 10° right | 20° right | 30° right | 40° right |

```
                  ahead
        eye4  .   eye5   .  eye6
   eye3   .        |        .   eye7
eye2  .            |            .  eye8
eye1               bot               eye9
      <-- left            right -->
```

Together the nine cover 90 degrees; what's behind and to the sides is a blind
spot. Since the eyes measure up to the _edge_ of what they see, a big or very
close bot takes up several eyes at once.

The eyes turn with the bot. But each one can be re-aimed with
[[.eye1dir]]…[[.eye9dir]] and widened with [[.eye1width]]…[[.eye9width]]. Both
are measured in the units of `.aim`: 1256 is a full turn, so 35 is about 10
degrees. A positive `dir` shifts the eye to the left and a negative one to the
right; the `width` is added to the factory 10 degrees. The engine never clears
these cells: writing them once is enough.
<!-- 32-VISION §0.2 (dir/200 rad, width/400 + π/36 de semiancho); sysvars.yaml eye1dir/eye1width (persisten) -->

_Beholder_, by Welwordion (in the Bestiary), opens the fan in its first
cycle: it shifts each eye 105 units more than its neighbor (from 420 in
`.eye1dir` to −420 in `.eye9dir`) and gives all of them a width of 105. That
leaves nine eyes of about 40 degrees, 40 degrees apart: together they cover the
whole circle, at the price of seeing only up to about 940 units.
<!-- Beholder_F3_Welwordion_28-10-08.txt; alcance 1440·(1 − ln(140/35)/4) ≈ 941 -->

## How far an eye reaches {#alcance}
<!-- 32-VISION §0.4 (1440·(1 − ln(w/35)/4)·eyestrength; noche ×0,8; pondmode por profundidad, nunca amplifica) -->

A factory eye sees up to about 1440 units, measured edge to edge. The range
depends on the width: the wider the eye, the shorter its reach. A 20-degree eye
reaches about 1190, a 100-degree one about 610, and one that goes all the way
around, about 150. The full table is in [[.eye1width]].

Two world settings trim it, never stretch it:

- **Night.** While it's night ([[param:opt:41]] off, whether because of the
  [[param:opt:33]] clock or the energy thresholds; see
  [[simulacion/cloroplastos#dia-y-noche]]), all eyes see 20% less.
- **The pond.** In pond mode ([[param:opt:30]]) sight fades with depth: the
  deeper the bot is, the shorter it sees. How much depends on the gradient
  ([[param:opt:32]]).

## What number an eye gives {#valor}
<!-- 32-VISION §0.3 (1/percentdist², percentdist = (dist + 10)/alcance, clamp 32000, solape = 32000), §2.6 -->

An eye is 0 if it sees nothing. If it sees something, it gives a number that
grows as it gets closer: 1 at the limit of its range, 100 at a tenth of it, and
32000 when what it sees is touching or overlapping the bot. The calculation is
the inverse of the square of the distance, measured as a fraction of _that_
eye's range, so the number jumps up over the last stretch. With the factory
eye:

| Edge-to-edge distance | Value |
|---|---|
| 1430 | 1 |
| 710 | 4 |
| 278 | 25 |
| 134 | 100 |
| touching | 32000 |

If an eye has several things in its field, it gives the value of the closest
one: bots don't block each other, but the eye only reports the first.

Since the scale is relative to the range, a wide eye gives smaller numbers at
the same distance. If your DNA compares against a fixed threshold, such as
`*.eye5 100 >`, the threshold changes meaning when you change the eye's width.

The eye sees everything that is a bot: those of your species, those of other
species, vegetables and corpses. The number doesn't say what it is; that's
what the `ref*` cells are for.

## Example: steering with the fan {#abanico}

This bot uses the side eyes to know which way to turn and the front one to
know when it has something ahead. It turns by 35, which is exactly one eye:
what [[.eye4]] saw moves to [[.eye5]] in the next cycle.

```adn
' Nothing in sight: turn right, searching
cond
 *.eye1 *.eye2 add *.eye3 add *.eye4 add *.eye5 add
 *.eye6 add *.eye7 add *.eye8 add *.eye9 add 0 =
start
 70 .aimdx store
stop

' I see it more on the left: turn that way
cond
 *.eye5 0 =
 *.eye1 *.eye2 add *.eye3 add *.eye4 add
 *.eye6 *.eye7 add *.eye8 add *.eye9 add >
start
 35 .aimsx store
stop

' I see it more on the right
cond
 *.eye5 0 =
 *.eye6 *.eye7 add *.eye8 add *.eye9 add
 *.eye1 *.eye2 add *.eye3 add *.eye4 add >
start
 35 .aimdx store
stop
```

Run in front of a still bot, it turns until the other one enters through
[[.eye9]], corrects three times to the right and ends up with it in the front
eye, without moving any more. If the other one is out of range, it keeps
spinning forever.
<!-- probado: centra.txt contra quieto.txt, semillas 1 y 7 (centra); semilla 4 (fuera de alcance, gira sin parar) -->

## Example: one eye to detect, another to aim {#ancho}

A wide eye detects in all directions but only up close; a narrow one sees far
but in a strip. This bot opens [[.eye1]] to the full circle (1221 wide: about
150 units of range) and turns only when that eye signals that something is
near and the front one doesn't have it yet:

```adn
' Panoramic eye 1, only once
cond
 *.robage 0 =
start
 1221 .eye1width store
stop

' Something near, but not ahead: turn by 10 degrees
cond
 *.eye1 0 >
 *.eye5 0 =
start
 35 .aimdx store
stop

' Save in 50 what the front eye sees
cond
 *.eye5 0 >
start
 *.eye5 50 store
stop
```

In the test, with a bot next to it, `.eye1` read 5 and the bot turned until
`.eye5` found it: the front eye saw it with 476. It's the same bot at the same
distance; the difference is only the scale of each eye.
<!-- probado: radar.txt contra quieto.txt, campo 600x600, semilla 2 (eye1 5, eye5 476) -->

## The focus eye and what you see of the other {#foco}
<!-- 32-VISION §2.6 (lastopp = el de mayor eyevalue en el ojo con foco; Abs(x+4) Mod 9), §4; core senses.hpp lookoccurr -->

The eyes only say _how close_ something is. To know _what_ it is, one of the
nine is the **focus eye**: [[.eye5]] by default, or the one you pick with
[[.focuseye]] (−4 is `.eye1`, 4 is `.eye9`). Two things come out of it:

- Its number is copied into [[.eyef]].
- The closest thing it sees ends up described in the `ref*` cells
  ([[sysvars/ref]]). If the focus eye sees nothing, they are all 0, even if
  another eye is seeing something.

What's known about the other bot:

| What | Cells |
|---|---|
| Its DNA signature: how many times it writes certain sysvars and reads its eyes | [[.refup]], [[.refdn]], [[.refsx]], [[.refdx]], [[.refaimdx]], [[.refaimsx]], [[.refshoot]], [[.refeye]], [[.reftie]] |
| Its state | [[.refnrg]], [[.refbody]], [[.refshell]], [[.refage]], [[.refkills]], [[.refpoison]], [[.refvenom]], [[.refmulti]], [[.reffixed]] |
| Where it is and how it moves relative to you | [[.refxpos]], [[.refypos]], [[.refaim]], [[.refvel]], [[.refveldn]], [[.refveldx]], [[.refvelsx]], [[.refvelscalar]] |
| What it is | [[.reftype]]: 0 a bot, 1 a shape |
| What it publishes | [[.in1]]…[[.in10]], a copy of its [[.out1]]…[[.out10]] |

The signature is what lets you recognize your own species: two bots with the
same DNA have the same one, so comparing [[.refeye]] with your [[.myeye]] is
the classic test (step by step, in [[tutoriales/reconoce-especie]]). A corpse
looks like any other bot, but its signature arrives as 0, just like its
energy; its body, on the other hand, is the real one, so it can be found and
eaten.
<!-- 32-VISION §2 notas (corpses: occurr borrado, refnrg/refbody reales) -->

The other bot's position is the one the engine published for it in its own
pass, which depending on the order in which it walks through the bots can be
this cycle's or the previous one's.
<!-- 32-VISION §4 (refxpos de mem 219/217 del visto; asimetría por índice) -->

:::nota
In the original DarwinBots 2.48.32, [[.refvelsx]] was always 0. This version
fixes it: it's [[.refveldx]] with the sign flipped, just as [[.refveldn]] is
for [[.refvel]].
:::

## Spying on the other's memory {#espionaje}
<!-- 32-VISION §4; sysvars.yaml memloc/memval; core senses.hpp lookoccurr (memloc 1..1000) -->

Besides the `ref*` cells, you can read any cell of the bot in the focus eye.
You write an address between 1 and 1000 into [[.memloc]], and every cycle the
engine copies into [[.memval]] whatever value that cell has in the other bot.
It's useful for looking at its sysvars or its private variables, for
example a species password:

```adn
' Only once: spy on cell 61 of whoever is in focus
cond
 *.memloc 0 =
start
 61 .memloc store
stop

' Search by turning
cond
 *.eye5 0 =
start
 35 .aimdx store
stop

' If its cell 61 is 7, it's one of mine: note it in 50
cond
 *.eye5 0 >
 *.memval 7 =
start
 1 50 store
stop
```

In front of a bot that stores 7 in its cell 61, this bot found it by turning,
read 7 in `.memval` and noted the 1. To spy on a bot you're tied to, the pair
is [[.tmemloc]] and [[.tmemval]] (see [[sysvars/lazos]]).
<!-- probado: espia.txt contra quieto.txt (memval 7, 50 = 1) -->

## Seeing shapes {#formas}
<!-- 32-VISION §0.5, §3; README B2-1, B2-3, B2-4, B2-5; opciones opt:80, opt:81 -->

Shapes are the rectangular obstacles that can be placed in the world (see
[[simulacion/mundo]]). Two options decide how they get along with sight:

| Option | Off (default) | On |
|---|---|---|
| Bots see shapes ([[param:opt:80]]) | the eyes don't register them | the eyes see them like a bot |
| Transparent to sight ([[param:opt:81]]) | a shape blocks the bots behind it | you see through them |

Note the factory combination: shapes are invisible but they block. A bot
hiding behind a wall doesn't show up in any eye, and neither does the wall.

When shapes are visible, the eye measures up to the closest point of the
shape, with the same scale as for a bot. If the closest thing in the focus eye
is a shape, [[.reftype]] is 1, the position and velocity describe the shape,
[[.reffixed]] says whether it's still, and everything else arrives as 0. A bot
that ends up inside a shape sees 32000 in all nine eyes and in [[.eyef]].

:::nota
In the original this part had several errors, which this version fixes: a
shape's shadow didn't match the shape (it was rotated and blocked too much),
the width of the eyes was computed differently for shapes than for bots,
`.eyef` didn't rise to 32000 inside a shape, and the shape's position was only
correct if the focus eye was the front one.
:::

## Contact {#contacto}
<!-- 32-VISION §5 (touch, sectores); 30-FISICA §4.3 (Repel3, lookoccurr en colisión), §4.4 (obstáculos); sysvars.yaml hit* -->

Touch doesn't depend on the eyes. In the **forces and collisions** phase, when
a bot overlaps another (alive, vegetable or corpse) or a shape, the engine
turns on [[.hit]] and one of four directions depending on where what touched
it is, relative to its heading:

| Side | Angle from the front | Collision | Shot |
|---|---|---|---|
| front | less than 45° on each side | [[.hitup]] | [[.shup]] |
| right | from 45° to 135° | [[.hitdx]] | [[.shdx]] |
| back | from 135° to 225° | [[.hitdn]] | [[.shdn]] |
| left | from 225° to 315° | [[.hitsx]] | [[.shsx]] |

A collision with another bot does something more: it fills the `ref*` cells
with the data of the bot that was touched, in both directions. Since sight is
computed afterwards, if the focus eye sees something, the `ref*` cells describe
that; if it sees nothing, they describe the one that collided with it, even if
it came from behind. So a bot that sees nothing still recognizes whoever
touches it. If it collides with a shape without seeing anything, [[.reftype]]
stays at 1. The edge of the world doesn't count as a collision: that's what
[[.edge]] is for.

## The taste of shots {#sabor}
<!-- 32-VISION §5 (taste desde updateshots: shflav = tipo, shang = dang·200); 33-SHOTS §3.4 -->

When a shot hits a bot, in the **shots** phase, it feels two things: what it
was and where it came from.

- [[.shflav]] is the “flavor”: the shot's type, the same number the shooter put
  in its [[.shoot]] (−1 steals energy, −3 is venom, and so on).
- [[.shang]] is the angle of arrival, from 0 to 1256, measured from the front
  toward the right. Copied into [[.aimdx]], it leaves the bot facing the
  shooter.
- The four direction cells from the table above ([[.shup]] and company) store
  the shot's type on the side it came in through.

If several hit it in the same cycle, the last one remains. The details,
including the catch that a hunter also gets the taste of its own gains, are in
[[sysvars/disparos]] and in [[simulacion/disparos]].

## How long each sense lasts {#duracion}
<!-- 21-MEMORIA §3 (régimen A: escritos tras el ADN, borrados en «se borran los sentidos»); sysvars.yaml -->

All these senses are written after your DNA has run and are read in the next
cycle. The `ref*` cells, [[.memval]], the `in*` cells, touch and taste are
cleared in the **senses cleared** phase, right after your DNA: if you don't use
them in that cycle, they're lost. The configuration ([[.focuseye]],
[[.memloc]], the `dir` and the `width` cells) stays as you left it.
