---
titulo: Reproduction
resumen: "How a bot has children, alone or with a partner: what the child takes, where it is born, what it inherits, how the DNA is mixed in the sexual kind, and why a birth can fail."
etiquetas: [reproduction, asexual, sexual, sperm, inheritance, birth tie]
estado: revisada
---
A bot doesn't make children out of nothing: it _splits_. It writes a
percentage and, if it can, at the end of the cycle a new bot appears next to
it, carrying that percentage of what the parent had. The child is a copy of its
DNA (with some mutation, if they're on) or, in sexual reproduction, a mix with
the DNA of another bot.

This page explains the whole mechanism. The entry for each command is in
[[sysvars/reproduccion]].

## The three commands {#ordenes}
<!-- 36-REPRO §0.4, §0.5, §1; 10-CICLO §5 P5 y §6 -->

| Command | What it asks for |
|---|---|
| [[.repro]] | An asexual child: a copy of its own DNA. |
| [[.mrepro]] | The same, but the child is born with a much higher chance of mutating ([[simulacion/mutaciones#mrepro]]). |
| [[.sexrepro]] | A sexual child. It only works if the bot was fertilized by another bot's sperm. |

In all three, the number is the **percentage** the child takes, and it works
the same way:

- It's taken **modulo 100**: `50` is half, `150` is too, and `100` is 0 and
  does nothing. A 0 or a negative asks for nothing.
- The command is read in the actions phase of the same cycle in which you write
  it, and the child is born in the births and deaths phase of that cycle (see
  [[simulacion/ciclo#nacimientos-y-muertes]]).
- **The command stays written until the birth succeeds.** If it fails, the
  engine doesn't clear it and tries again every cycle, even if the gene that
  wrote it no longer runs. To cancel it, write 0.
- A bot has **one child per cycle** at most.

If a bot has both [[.repro]] and [[.mrepro]] written, a coin flip decides
which of the two percentages is used; the boosted mutation of [[.mrepro]]
applies either way, whichever way the coin falls. If it's fertilized and has [[.sexrepro]]
written, that cycle it tries only the sexual one and the asexual one waits,
even if the sexual one ends up failing.

:::nota
In the original DarwinBots the same bot could be queued twice in the same
cycle, once for an asexual child and once for a sexual one. In the port it's
queued only once, with the sexual one first.
:::

## How things are split {#reparto}
<!-- 36-REPRO §2 (reparto por per, impuestos 0,1 % y 1 ‰, DNACOPYCOST con suelo 0); port/README B6-4; comprobado con probar-adn: 50 % de 3000/1000 deja 1498,5/500 a cada uno y DNACOPYCOST 1 cobra 10 al padre con un ADN de 10 -->

This bot divides only once, at the third cycle of life:

```adn
' Divides only once, at the third cycle of life
cond
 *.robage 3 =
start
 50 .repro store
stop
```

With 3000 energy and 1000 body, at the end of the cycle there are two bots:

| | Before | Parent after | Child |
|---|---|---|---|
| Energy ([[.nrg]]) | 3000 | 1498.5 | 1498.5 |
| Body ([[.body]]) | 1000 | 500 | 500 |

What happens, item by item:

- **Energy**: the child receives the percentage, minus one thousandth. The
  parent loses the percentage plus another thousandth. In the example, 3 out of
  the 3000 evaporate.
- **Body, chloroplasts and waste** ([[.body]], [[.chlr]], [[.waste]] and
  [[.pwaste]]): split with the same percentage, with no loss.
- **Shell, slime, venom and poison** ([[.shell]], [[.slime]], [[.venom]],
  [[.poison]]): stay with the parent. The child is born with none.
- **Copying the DNA** costs: after the birth the parent pays
  [[param:cost:25]] for each instruction of its DNA (scaled by the cost
  multiplier). With the cost at 1, the bot above, with 10 instructions, pays
  10. If it can't afford it, it drops to 0 energy, but the child is born
  anyway.

The birth doesn't count as a sudden loss of energy: a big bot that splits in
two doesn't die of shock (see [[simulacion/energia#shock]]).

:::nota
In the original DarwinBots the child's body was rounded to a whole number. In
the port it's the exact part: with 501 body and 50%, the child takes 250.5.
:::

## Where it's born {#donde-nace}
<!-- 36-REPRO §2 (sondist = suma de los radios, aim + π, velocidad heredada); 10-CICLO §6; comprobado con probar-adn: aim 160, hijo a 175 unidades en esa dirección, aim del hijo 788 -->

The child appears **in front of the parent**, in the direction it points
([[.aim]]), at exactly the distance at which the two touch: the sum of the radii
they'll have after splitting. It's born **facing the parent**, that is, with
the opposite heading, and with the same speed as the parent.

```
              parent's heading ──►
     ( parent )( child )
                  ◄── child's heading
```

In the test above the parent pointed at 160 and the child appeared 175 units
away in that direction, pointing at 788 (160 + 628, a half turn).

So, for a bot that reproduces a lot, it pays to **turn between births**: if it
always points the same way, the next child wants to be born where the previous
one is.

## The birth tie {#lazo}
<!-- 34-TIES §0.4 (last = 100), §4.3 (puerto 0 del lado del padre); 36-REPRO §2; port/README B4-3 (conservado); comprobado con probar-adn: .numties en 1 para los dos hasta que el hijo tiene 98 de edad, 0 desde 99 -->

Parent and child are born joined by a tie ([[simulacion/lazos]]). It's an
elastic tie that keeps them together and that **breaks by itself at 100
cycles**; both see it in [[.numties]]. The parent creates it with a tie port
number that can't be used, so only the child controls it: it can break it
earlier with [[.deltie]], write to the parent's memory, or pass energy to and
take energy from the parent through it. The parent, on the other hand, can only
feel it (see [[simulacion/lazos#nacimiento]]). Since it never stiffens, it
doesn't turn them into a multicellular organism.

It's also the channel of the deferred genetic memory (below): if it breaks, or
if the child replaces it by tying to the parent with [[.tie]], the child stops
receiving it.

## What the child inherits {#herencia}
<!-- 36-REPRO §2 (qué hereda y qué no); 21-MEMORIA §5; adn/memoria#al-nacer -->

| Inherits | Doesn't inherit |
|---|---|
| The DNA, with the birth mutations if any | The memory: it's all at 0 |
| The species name and the color | The ties (except the birth tie) |
| Its table of mutation rates | The age: it's born with 0 |
| The [[.timer]], which keeps counting | Shell, slime, venom and poison |
| Cells 971–975 and, one at a time, 976–990 | |

The child is of the **generation** after the parent's, and the engine records
who its parent is for the lineage tree ([[simulacion/especies]]).

The genetic memory works like this:

- **971–975**: copied on the spot. The child has them from its first cycle.
- **976–990**: they arrive one per cycle during its first fifteen cycles, as
  long as it's still tied by the birth tie and the cell is still at 0.

The details and an example that counts generations are in
[[adn/memoria#memoria-genetica]].

Also remember that the child is born when that cycle's DNA has already run: it
thinks for the first time in the next cycle, with [[.robage]] at 0 (see
[[simulacion/ciclo#demoras]]).

## When it fails {#cuando-falla}
<!-- 36-REPRO §0.4, §2 (guardas en orden), §3.2; 10-CICLO §6; port/README B6-2 -->

A requested birth doesn't go through if:

| Situation | What happens |
|---|---|
| The bot has less than 5 body | No child. |
| The energy is 0 or less | No child. |
| The percentage, taken modulo 100, gives 0 | No child (`100`, `200`…). |
| The place where the child would be born is occupied | Another bot very close to that point, a shape between the parent and that point, or that point outside the field when the edges aren't connected. |
| The simulation forbids asexual reproduction | With [[param:opt:71]], bots that aren't vegetables can't use [[.repro]] or [[.mrepro]]. Sexual reproduction is still allowed. |
| It's a vegetable and there are already many | If the chloroplasts across the whole world exceed the [[param:base:maxPopulation]], no vegetable reproduces. Above 90% of that cap, only one attempt in eleven goes through. |

In all these cases the command **stays written** and is retried in the next
cycle. The most common case is the occupied place: a child that wants to
reproduce right after being born, still stuck to its parent, or a bot
surrounded by its own offspring. A bot that asks for children and doesn't get
them is usually facing a wall or a sibling.

## Sexual reproduction {#sexual}
<!-- 36-REPRO §0.2, §3.1, §3.4; 33-SHOTS §5; sysvars fertilized/sexrepro -->

There are two roles, and any bot can play both:

1. **The one that provides the sperm** shoots with `-8 .shoot store` (see
   [[.shoot]] and [[simulacion/disparos]]). The shot carries a copy of its DNA.
   It has no children and spends nothing but the shot.
2. **The one that receives it becomes fertilized** for about ten cycles. You see
   it in [[.fertilized]], which counts down from 9 to 0. If within that window
   it has [[.sexrepro]] written, it has a child.

The **mother**, the bot that writes `.sexrepro`, provides everything: energy,
body, chloroplasts, the place where the child is born, the birth tie, the
genetic memory and the clock. The division of resources, the rules for where
it's born and the reasons for failing are the same as in the asexual kind. The
lineage records only the mother.

Each sperm serves for **a single child**: after the birth the fertilization
ends. If another sperm arrives while the mother is fertilized, it replaces the
previous one and the count starts over.

Animal_Minimalis_Sex, by Botsareus, is the classic example from the Bestiary:
when it gathers more than 20000 energy it looks for one of its species (it
compares [[.refeye]] with [[.myeye]]), shoots it sperm and leaves
`10 .sexrepro store` written, which waits until it gets fertilized too.

### How the child's DNA is built {#mezcla}
<!-- 36-REPRO §3.3 (simplematch, crossover, monedas por tramo y por token), §5.3; port/README B6-3 conservado -->

The engine lays the two DNAs side by side and looks for the **common runs**:
sequences of instructions that are the same in both, in the same order. What's
left between those runs are the **differences**. Then it builds the child by
walking through them in order:

- A common run goes to the child as it is.
- Where the two parents have something different, a coin flip picks the run
  from one or from the other.
- Where only one of the two has something (the other lacks that piece), a coin
  flip decides whether that piece goes in or is lost.

```
  mother:   [ common A ] x x x [ common B ] z z [ common C ]
  sperm:    [ common A ] y y   [ common B ]     [ common C ]
                         │                 │
                    coin: x or y      coin: z or nothing
  child:    [ common A ] y y   [ common B ] z z [ common C ]
```

Two consequences:

- **The mix isn't fixed.** The same sperm with the same mother gives different
  children at each birth.
- **The child can come out shorter than both parents**, because the pieces that
  only one has are lost half the time.

The birth mutations are then applied on top of that mix, as in the asexual
kind.

### Relatives, not strangers {#distancia}
<!-- 36-REPRO §0.3, §3.3 paso 3 (distancia > 0,6 → fertilized = −18); core robots.hpp ManageReproduction y takesperm (fertilized < −10 rechaza esperma); comprobado con probar-adn: madre de 64 instrucciones y macho de 15, .fertilized se queda en 8, .sexrepro en 50 y el esperma siguiente entra 13 ciclos después; el bot de sysvars/sexrepro con --otro macho tiene hijo en 3 de 4 semillas (120 ciclos); una madre que mira al macho cuenta 9..4 sin parto (lugar ocupado) -->

The comparison above also measures how different the two DNAs are: the
**genetic distance** is the proportion of instructions that didn't end up in
any common run. If it goes past **60%**, there's no child:

- the sperm is no longer good, even though [[.fertilized]] keeps showing the
  last number it had;
- for about eight cycles the bot doesn't accept new sperm;
- the [[.sexrepro]] command stays written, and is used with the next sperm that
  arrives.

We tested it with two very different bots. The male searches and shoots:

```adn
' Turns until it sees someone and shoots it sperm
cond
 *.eye5 0 =
start
 25 .aimdx store
stop
cond
 *.eye5 0 >
start
 -8 .shoot store
stop
```

The mother stays still and, if she's fertilized, asks for a child. She also
carries a filler gene that never runs and that makes her very different from
the male:

```adn
' Stays still; if fertilized, has a child
cond
 *.fertilized 0 >
start
 50 .sexrepro store
stop
cond
 *.nrg 30000 >
start
 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40
 41 42 43 44 45 46 47 48 49 50
stop
```

The sperm reaches her, [[.fertilized]] shows 9 and then 8, and there it
freezes: no child. Thirteen cycles later another sperm reaches her, which
doesn't work either. By contrast, the example bot of [[.sexrepro]], which has
the male's two genes plus its own, has children with that same male in three
out of four tests.

If [[.fertilized]] freezes, the sperm was rejected. If instead it keeps going
down to 0 without anyone being born, the problem is something else, almost
always the place: a mother who keeps facing the male has the child's spot
taken by him.

That's why sexual bots look for partners among their own species: the sperm of
a relative almost always passes the test, that of a stranger almost never.

## Summary {#resumen}
<!-- Resumen: 36-REPRO §0-§3; 21-MEMORIA §5; 34-TIES §0.4 -->

| Question | Answer |
|---|---|
| How much does the child take? | The requested percentage, modulo 100, of energy (minus one thousandth), body, chloroplasts and waste. |
| What does the parent pay? | An extra thousandth of energy and the DNA copy ([[param:cost:25]]). |
| Where is it born? | In front of the parent, touching it, facing it. |
| How long do they stay together? | The birth tie breaks by itself at 100 cycles. |
| What memory does it inherit? | [[.timer]], 971–975 at birth and 976–990 one at a time. |
| And if it fails? | The command stays written and is retried every cycle. |
| Who provides the resources in the sexual kind? | The mother. The male only shoots. |
| When is the sperm rejected? | If more than 60% of the two DNAs doesn't match. |
