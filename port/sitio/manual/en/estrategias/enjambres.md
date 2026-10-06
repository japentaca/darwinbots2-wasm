---
titulo: Swarms
resumen: "Many small, cheap bots instead of one big one: three Bestiary herds that line up by sight, follow each other by password, or pass an alarm along by word of mouth, with no boss at all."
etiquetas: [swarm, herd, out1, in1, alignment, bestiary]
estado: revisada
---
After the tutorials you're left with a bot that is a unit: it sees, chases,
shoots and divides. The idea of a swarm is the opposite: instead of one big,
expensive bot, many small, cheap ones that all do the same thing. Each copy is
expendable; the herd isn't. This page dissects three Bestiary swarms with three
different ways of getting together—by sight, by password and by warnings—and
shows what each one gains and what it pays.

## What it gains and what it pays {#costos}

The first thing a swarm gains is coverage. A single bot, with the factory eyes,
covers 90 degrees ([[simulacion/vision#ojos]]); twenty copies spread out cover
twenty different fields, and the first one that finds food drags the rest along.
Also, a small bot is a small target: the eyes measure from edge to edge, so at
the same distance a tiny body gives lower numbers and is detected later
([[simulacion/vision#valor]]).
<!-- 32-VISION §0.2 (abanico de 90°), §0.3 (1/percentdist², dist de borde a borde) -->

The second is resilience. A predator can kill one bot; it can't kill thirty
without one of them dividing in the meantime. Reproducing is cheap in itself:
[[.repro]] hands out a percentage of energy and body, so `10 .repro` makes a
small child and `50 .repro` one that is born with half of everything
([[simulacion/reproduccion#reparto]]). A herd that loses twenty members comes
back from the ten that are left.
<!-- 36-REPRO §0.5 (per Mod 100), §2 (el hijo lleva el mismo % de nrg y body) -->

And what it pays. Every living bot is charged upkeep per cycle: a fee per point
of body and another for each DNA instruction
([[simulacion/energia#mantenimiento]]). Ten copies pay ten times the fee for the
whole genome; and every birth, besides the tax, pays for its copy of the DNA
([[param:cost:25]]). With costs at 0, as the app starts, living is free; under
F1 rules, every extra member weighs.
<!-- 31-ENERGIA §1 (Upkeep: body·BODYUPKEEP + (DnaLen−1)·DNACYCCOST); 36-REPRO (impuestos 0,1 % y 1 %) -->

The other price is physical: the members bump into each other. A collision
separates the two and changes their velocity ([[simulacion/fisica#choques]]), so
a tight herd spends thrust pushing itself around. You'll see it in this page's
runs: the real Bestiary swarms live with the collision, they don't avoid it.

## Coordinating without a boss {#coordinarse}

No boss is possible: no bot can give global orders, each one reads only its own
senses. The Bestiary's swarms come together along three paths, from least to
most signal:

| Path | Mechanism | Bots here |
|---|---|---|
| Loose behavior | Everyone follows the same local rule and order appears on its own | _SWARM 2.0_ |
| Following by sight | Copy the heading of the brother you see, or recognize it by signature or password | _Mr_Swarm_ |
| Warnings through out/in | Publish data in [[.out1]] and [[.in1]] for others to read | _SocialSwarmX_ |

The first row is the idea of flocks of birds: nobody steers, each one imitates
its neighbor. The second and the third use what you saw in
[[tutoriales/reconoce-especie]]: the DNA signature (`ref*` against `my*`) and
the public password.
<!-- SWARM_2.0 (solo compara firmas), Mr_Swarm.txt (publica 43 en .out1 al nacer, lo lee en .in1), SocialSwarmX.txt (publica posición en .out1/.out2, la repite el que ve a un hermano con el dato); 21-MEMORIA §2/§3 (out/in: publican todos, .out* nunca se borra) -->

## Lining up by sight: SWARM 2.0 {#swarm}

<!-- SWARM_2.0_F2_Elite_-10.03.07.txt; probado: qty 1 contra un bot quieto, campo 600x500, semilla 11: eye6 239 al ciclo 4, presa de 3000/1000 a 711/85 al 14, muerta al 16, tirador en 13375 con kills=1; re-corrido: 711/85 al 15, muerta antes del 20, tirador en 12975, hijo antes del 25 -->
_SWARM 2.0 F2 Elite_ (in the Bestiary,
`SWARM_2.0_F2_Elite_-10.03.07.txt`) is a swarm of barely ten genes that doesn't
even use a public password to recognize its brothers: it only compares
signatures. It opens
its front eye [[.eye5]] to a width of 1220, almost the whole way around, and
since range falls with width, it sees only about 150 units around itself: it's a
short-range radar, not a telescope.
<!-- 32-VISION §0.4 (1440·(1 − ln(w/35)/4): vuelta entera ≈ 150) -->

```adn
' Panoramic front eye
cond
 *.robage 0 =
start
 1220 .eye5width store
stop

' Every 5 cycles: if I see a brother, look where he is looking
cond
 *.robage 5 mod 0 =
 *.eye5 0 >
 *.refeye *.myeye =
start
 *.refaim .setaim *.robage sgn mult store
stop
```

That second rule is the whole swarm: every five cycles, the nearest brother
falling in the panoramic eye dictates the heading, by copying its [[.refaim]]
with [[.setaim]]. Since everyone always moves ahead at full speed
(`*.maxvel *.vel sub .up store`), a herd that crosses paths up close ends up
sailing together toward wherever the first one was looking. Nobody leads: each
one imitates its neighbor, and the order comes out on its own.

Against a stranger the signature doesn't match (`*.refeye *.myeye !=`) and it
becomes food: it chases it at full speed and, as it closes in, shoots it with
−6 (`*.eye6 34 >` means “I see it off to the side”), the shot that steals body
and gives back a −2 with the loot. In the run, a single copy bled a stationary prey
dry in 16 cycles and ended with 13375 energy from 3000: the other bot's body
converted into its own energy, which is where the whole herd comes from. After
that, with `*.body 700 >`, each one splits off 30 % and the herd grows by
itself.
<!-- 33-SHOTS §2.1 (−6 releasebod), §5 (shot −2 de vuelta, kills); core shots.hpp releasebod (techo body·10/0.8, 20 % nrg + 8 % body); probado: 3000+1000 → presa 711/85, muerta al 16, hijo nacido al 22 con 3758 -->

Its two weak spots, measured: it pays no attention to the edges of the world (in
a field with walls it ends up piled against them, pushing), and the birth gene
also draws a turn (`314 rnd .aimdx`), which keeps it turning at random while the
birth retries. In a small field, a pair gets tangled: they see each other with
32000, collide and their headings go around in circles. The swarm wins in the
open field.
<!-- probado: qty 2, campo 200x200, semilla 3: eye5 32000 sostenido, aims cambian de ciclo a ciclo; qty 4, campo 2000x1500, semilla 2: apiladas en x=1951, x=48, y=1324 -->

## The herd with a password: Mr_Swarm {#mr-swarm}

<!-- Mr_Swarm.txt; probado: qty 2, campo 300x300, semilla 7: aim 460/460 al ciclo 30 y 759/759 del 40 en adelante, in1=43, 0 disparos; qty 1 contra quieto, campo 500x400, semilla 2: presa muerta entre el 10 y el 20, cazador 3000 → 6164; re-corrido (semilla 7): idéntico, 460/460 al 30 y 759/759 del 40, in1=43, cero disparos -->
_Mr_Swarm_ (`Mr_Swarm.txt`) bets on the password. Each copy publishes a 43 in
`.out1` in its first cycle and never again; whoever has a brother in its focus
eye reads it in [[.in1]] ([[tutoriales/reconoce-especie]]). In a run with six
copies, all of them had the 43 published and received within 20 cycles, without
a shot between them.

```adn
' A brother ahead: note it down once
cond
 *.in1 43 =
 *.eye5 1 >
 *.shoot 0 =
 *27 0 <=
start
 27 inc
stop

' And copy his heading
cond
 *27 1 >=
 *.shoot 0 =
 *.reffixed 0 =
start
 *.refaim .setaim store
 27 dec
stop
```

Following the brother means copying its heading with [[.refaim]]—the same
mechanism as SWARM, with a counter so it isn't rewritten every cycle—and moving
toward it. Measured with two copies: the headings converged and stayed pinned
there (460 and 460, then 759 and 759, for twenty cycles). The password also
arrives by collision, not just by sight: the `in*` get filled the same way when
bodies touch ([[simulacion/vision#contacto]]).
<!-- 32-VISION §5 (contacto llena refvars/in*); probado: semilla 7, eye5 0 en el seguidor con in1 43 recibido por contacto -->

It treats the stranger who doesn't publish the 43 differently: it shoots it with
−1, the shot that drains energy, while aiming at it and advancing.

```adn
' Something ahead that isn't from the herd: drain its energy
cond
 *.eye5 1 >
 *.in1 43 !=
start
 -1 .shoot store
 1 .out2 store
 1 .up store
stop
```

In the run against a stationary prey, it found it within ten cycles, raised its flag
in [[.out2]] (which its brothers can read through [[.in2]]) and left it dead
before cycle 20, finishing with 6164 energy. Apart from that, it breaks the
birth tie in the first cycle and, when it touches an edge, turns at random and
stops reacting to the edge for thirty cycles (`*.edge` with a timer), so it doesn't pile up against the walls
like SWARM, and it only reproduces with 120 body, more than 8000 energy and 100
cycles of life: first the herd, then the children.
<!-- 33-SHOTS §5 (−1 releasenrg: 90 % nrg, 1 % body); probado: presa 3000 → 1613 al 10, muerta al 20; cazador 4464 → 6164 -->

## The alarm by word of mouth: SocialSwarmX {#alarma}

<!-- SocialSwarmX.txt; probado: qty 3 contra quieto, campo 800x600, semilla 4: al ciclo 10 un miembro con out1=114 out2=486 (posición exacta de la presa 114,486) y otro con in1=114; al 80 la manada entera apiñada en la esquina de la presa -->
_SocialSwarmX_ (`SocialSwarmX.txt`) doesn't follow: it passes data along. The
one that sees food publishes _where_ it is, using the pair of cells as
coordinates:

```adn
' I see a stranger: publish its position
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 *.refxpos .out1 store
 *.refypos .out2 store
 *.refveldx .dx *.eye5 sgn mult store
stop

' I see a brother who already has the data: repeat it
cond
 *.eye5 0 >
 *.refeye *.myeye =
 *.in1 0 !=
 *.in2 0 !=
start
 *.in1 .out1 store
 *.in2 .out2 store
stop
```

Since any bot that sees you reads your `out*` in its `in*`, the warning jumps
from brother to brother: whoever sees publishes, whoever sees that one repeats.
In the run, one member published the exact position of the prey (114, 486) and
in that same cycle another already had it noted in its `in1`. The alarm only
matters between brothers, so the relay requires the signature.

Who answers it? The hungry one:

```adn
' With little body and a position in hand: go there
cond
 *.body 500 <
 *.out1 0 !=
 *.out2 0 !=
start
 *.out1 *.out2 angle .setaim store
stop
```

With [[op:angle]] the stored position becomes a heading. The full ones don't
move; the skinny ones converge. At the end of the run the whole herd was
crowded into the corner where the prey had died, eating it with −6 shots: since
the `out*` don't clear on their own, the alarm stayed lit over the corpse, which
was exactly the place worth going to.
<!-- 21-MEMORIA §2 (800-819 out/in), §3 (out*: nunca se borran); probado: semilla 4, al 60 el cuerpo de la presa bajo de 1000 a 49, todos los miembros con el mismo aviso out1=65 out2=596 -->

One extra lesson from this bot: read what the DNA _does_, not what its name
promises. Its first gene wants to break the birth tie with an address
calculation, but the calculation incidentally overwrites the [[.repro]] cell:
at 9 cycles each copy writes a 1 there and gives birth to a child with 1 % of
its energy. In the run these dwarf children (41 energy, 9 body) kept appearing
and slowly dying. The swarm works all the same; the real strategy is messier
than the legend.
<!-- probado: qty 1, campo 800x600, semilla 9: repro=1 desde el ciclo 10, hijo de nrg 40,96 y body 8,90 (≈1 % de la madre en 4100/890); 330×10 = 3300 ≡ 300 (módulo 1000) -->

:::cuidado
The name doesn't decide what something is. _Chaotic Swarm_ and _4-d Swarmer_
aren't loose swarms but multibots: in a run they form ties, share and reach
`.multi` 1. _Turbulent Swarm_, on the other hand, doesn't have a single tie
gene: it's a loose swarm of the kind on this page, which lines up by signature
and passes the enemy's warning along through `out`/`in`. Organisms are covered
in [[estrategias/multibots]].
:::
<!-- probado: Chaotic_Swarm_ver_1.2_MB_SA.txt y 4-d_Swarmer.txt, --qty 3 con un blanco quieto, campo 600x500, 100 ciclos: numties 1-3 y .multi 1; TurbulentSwarm_f3_f2_f1_Shadowgod2_11-2-2014.txt igual: numties 0 los 100 ciclos, mata al blanco sin atarse -->

## A minimal swarm {#minimo}

To see the alignment mechanism with nothing on top, three genes are enough. The
local rule is just one: if the nearest one I see is a brother, I look where he
is looking.
<!-- probado: manada de 4 copias, campo 500x400, semilla 1: al ciclo 10 las cuatro con aim 1248; lo sostienen hasta el 60 y terminan apiladas contra la pared derecha (sin gen de bordes) -->

```adn
' Panoramic front eye, just once
cond
 *.robage 0 =
start
 1221 .eye5width store
stop

' A brother in sight: copy his heading
cond
 *.eye5 0 >
 *.refeye *.myeye =
start
 *.refaim .setaim store
stop

' Always move ahead
cond
 *.velscalar 20 <
start
 20 .up store
stop
```

Seed four copies in a small field and watch [[.aim]]: in the run, by ten cycles
all four pointed at exactly the same heading and held it, sailing as a school
until they hit the wall (they have no edge gene, like SWARM). Change `*.refaim`
to `*.refxpos *.refypos angle` and instead of following him they go straight at
him: the same channel, a different behavior. Add [[.repro]] with a small
percentage and a hunger condition, and you have a herd that reproduces instead
of piling up.

## What to try next {#despues}

<!-- 40-MUTACIONES (la firma deriva al mutar, B6-9); opciones.js F1_COSTOS (cost:23 = 2) -->

**Dividing up roles.** Publish a role number in `.out1` at birth (a different
one per copy, with [[op:rnd]]): the ones that come out as hunters shoot, the
ones that come out as gatherers collect. _Mr_Swarm_'s password already
separates “mine” from “stranger”; separating “hunter” from “gatherer” is the
same channel with another number.

**A swarm that flees.** The warning works for the opposite too: whoever gets
shot publishes the shooter's direction and the others avoid it. Attack signals
and danger signals live in the same family; for the defenses that complement
this, see [[estrategias/defensivos]].

**Tied or loose.** The difference from a multibot is the tie: tied, an organism
shares energy and carries out commands through ports, but it pays for each tie
and loses the whole organism together ([[tutoriales/multibot]]). Loose, each
copy dies alone and the herd goes on. Compare your swarm against a Bestiary
multibot in a [[estrategias/torneos|match]].

**Letting it evolve.** With mutations switched on
([[simulacion/mutaciones]]), each copy's signature drifts on its own and the
herd can split into new species: the 43 password is written once per copy, so a
mutation in that gene is enough for a lineage to stop recognizing its brothers.
A swarm is a good substrate for your first [[tutoriales/evolucion|evolution]]
experiment: there are plenty of copies, and the ones that mutate badly die on
their own.
