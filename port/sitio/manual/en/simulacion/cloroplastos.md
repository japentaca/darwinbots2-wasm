---
titulo: Chloroplasts and vegetables
resumen: "How a bot with chloroplasts gains energy from the sun, when there is sunlight, why a crowded field yields less, and how vegetables are repopulated."
etiquetas: [chloroplasts, sun, light, vegetables, day and night, repopulation]
estado: revisada
---
The sun is, along with the seeding of new vegetables, the only source of energy in
the world (see [[simulacion/energia]]). Any bot that has chloroplasts
([[.chlr]]) can use it: vegetables are born with them, but an animal can
also buy them. This page explains how much they yield, when there is sunlight, and
how the simulation keeps vegetables in the field. The sysvars for this topic are in
[[sysvars/cloroplastos]].

## Photosynthesis {#fotosintesis}
<!-- 50-MUNDO §2.2 (feedvegs: fase del sol, al final del ciclo); core feedvegs -->

At the end of each cycle, in the sun phase, every living bot that has energy and
chloroplasts gets its share if two things hold:

- it is daytime (see [[simulacion/cloroplastos#dia-y-noche|Day and night]]);
- the bot is inside the lit strip. Without [[param:opt:40]], the strip is the
  whole field.

The gain for one cycle is computed like this:

```
gain = base × (4 × (1 − occupancy)² × 1.25 × chloroplasts/16000
               − (chloroplasts/32000)²)
       − age × chloroplasts / 1000000000
```

- The **base** is [[param:base:maxEnergy]] divided by 3.5. In pond mode
  ([[param:opt:30]]) it depends on depth: it is [[param:opt:31]] divided by
  the depth raised to the power [[param:opt:32]] (depth grows by 1 every 2000
  units downward), and then divided by 3.5.
- The **occupancy** is the part of the field covered by bots, the complement of
  [[.light]]. Squared, it punishes heavily: with half the field covered, the
  first term is worth a quarter of what it is in an empty field.
- The negative term grows with the square of the chloroplasts: more chloroplasts
  yield more, but less and less.
- The rate by age is small: 1 per cycle only with 32000 chloroplasts and 32000
  cycles of life. It is charged outside the strip too, if it is daytime.

The gain is split between energy and body according to [[param:opt:63]]: with 0.75,
which is what the app ships with, a quarter goes to [[.nrg]] and three quarters to
[[.body]] (at 10 to 1). With tides ([[param:opt:64]]), the gain also rises and falls
with the tide period, between nothing and the full gain.

### How much it yields {#rinde}
<!-- comprobado con base:maxEnergy 10 y opt:63 0,75: un vegetal solo en un campo de 32000×32000; y 30 vegetales en un campo de 4000×3000 -->

With solar energy per cycle at 10, as the app starts, a vegetable's gain in
energy per cycle is as follows (the body goes up a little less than a third of
that):

| Chloroplasts | Alone, in a huge field | Among 30, in a 4000×3000 field |
|---|---|---|
| 4000 | +0.9 | +0.6 |
| 8000 | +1.7 | +0.9 |
| 16000 | +3.4 | +0.5 |
| 32000 | +6.4 | −0.7 |

In an empty field, more chloroplasts always yield more. In a full one, past a
certain point they yield less, and with 32000 the vegetable loses. On top of that,
chloroplasts make the bot bigger: 30 vegetables of 32000 chloroplasts cover the
whole small field, and [[.light]] drops to 0.

That's why many Bestiary vegetables buy chloroplasts only as long as the light
allows. This is the gene of _Alga minimalis 3.0_:

```adn
' Buys chloroplasts while it has fewer than the free light
cond
 *.chlr *.light <
start
 160 .mkchlr store
stop
```

Running it with chloroplasts costing 0.2 each (the F1 rules), a lone alga in the field
buys until it is left with about 110 energy, close to the floor of 100 below which
a purchase is canceled. Thirty algae in a small field, on the other hand, stop on
their own near 15400 chloroplasts, where the free light catches up with them.

## Having chloroplasts {#tener}
<!-- 31-ENERGIA §1 (ChangeChlr), §3 (decaimiento, reparto, masa, radio); 35-VIRUS (mkvirus); port/README A3-10 -->

Buying ([[.mkchlr]]) costs [[param:cost:8]] per chloroplast, and the purchase is
canceled entirely if it would leave the bot with less than 100 energy. Removing
([[.rmchlr]]) is free and gives nothing back. In addition:

- **They are lost on their own.** Half a chloroplast per cycle when there are few,
  a twentieth with 8000 and a two-hundredth with 16000.
- **They weigh.** Each chloroplast adds almost 1 of [[.mass]] and enlarges the
  radius, so a bot with many barely moves and blocks more light.
- **They are shared out.** When reproducing, the child takes its percentage
  ([[simulacion/reproduccion]]). Inside an organism they can be shared with
  [[.sharechlr]], only between close relatives.
- **They digest waste.** A bot with chloroplasts slowly converts its waste into
  energy and body (see [[simulacion/energia#desechos]]).
- **They are incompatible with viruses.** If a bot with chloroplasts tries to make
  one with [[.mkvirus]], it loses them all ([[simulacion/virus]]).

A bot can adapt to the day and night cycle. _Chloroplastus_, from the Bestiary,
buys 1 at a time during the day and sheds 1 at a time at night, as long as it has
more than 500:

```adn
' Lightens up at night
cond
 *.daytime 0 =
 *.chlr 500 >
start
 1 .rmchlr store
stop
```

## Day and night {#dia-y-noche}
<!-- 50-MUNDO §2.2 (decisión día/noche: umbrales, luego reloj); core feedvegs; comprobado: opt:33 1, opt:34 3 → 3 ciclos de día, 4 de noche, 4 de día -->

If nobody changes it, it is always daytime. There are two ways to get night:

- **The clock.** With [[param:opt:33]] turned on, day and night alternate. Each
  stretch lasts [[param:opt:34]] cycles plus one (with 3, four cycles of sun and
  four of darkness); only the first day of the simulation lasts one less.
- **The world's total energy**, which adds up the energy and ten times the body of
  every bot, corpses included, plus that of the energy shots in flight. With
  [[param:opt:35]] the sun comes out if it drops below [[param:opt:36]]; with
  [[param:opt:37]] it sets if it goes over [[param:opt:38]]. That way a population
  that grows too much is held back, or one that is dying off is rescued. What the
  threshold does with the clock is decided by [[param:opt:39]]: force only that
  cycle, change the state until the next threshold, or restart the clock from there.

The bot finds out through [[.daytime]], which is 1 by day and 0 at night. For one
with chloroplasts, it is 1 only if it is also in the lit strip. At night
[[.light]] is not recalculated: the last daytime value keeps being read.

### The sun strip {#franja}
<!-- 50-MUNDO §0.3, §2.2 (banda (0,25 + SunRange³·0,75)·FieldWidth, deriva ±0,0005, cambios 1/2000) -->

With [[param:opt:40]], the sun lights a vertical strip of the field, from top to
bottom, that moves on its own. Its width goes from a quarter of the field to the
whole field, and it starts at a little over a third. The strip shifts by 0.05% of
the field width per cycle and its width slowly grows or shrinks. Every so often (on
average, once every 2000 cycles) it chooses again: toward the left, toward the
right or standing still, and whether it widens or narrows. A strip that goes off
one edge continues from the other. For a fixed vegetable, that means long seasons
of sun and shade; one that moves can follow the light.

## Vegetables {#vegetales}
<!-- 50-MUNDO §0.1, §2.1; core VegsRepopulate, checkvegstatus, aggiungirob, Reproduce (MaxPopulation, lotería 1/11), ChangeChlr; port/README B7-1, B7-4; comprobado: MinVegs 3, un vegetal → 10 nuevos en el ciclo 10 -->

A vegetable is a bot of a species you marked as vegetable when setting up the
simulation. It photosynthesizes like any other bot with chloroplasts; what changes
is how the world treats it:

- It is born with [[param:base:startChlr]] chloroplasts (16000 if you don't change
  it).
- It doesn't suffer shock ([[simulacion/energia#shock]]).
- Its children are vegetables too.
- Its population has a cap, and the simulation tops it up when it runs short.

### Repopulation {#repoblacion}
<!-- 50-MUNDO §2.1; core VegsRepopulate (acumulador con deuda), aggiungirob (body 1000, nrg de la especie), checkvegstatus -->

In each cycle, the engine adds up the chloroplasts of all the living bots and
divides by 16000. If the result is below [[param:base:minVegs]], it counts one
waiting cycle; when it reaches [[param:base:repopCooldown]], it seeds
[[param:base:repopAmount]] new vegetables and starts counting again. Each one is
born at a random spot inside its species' zone, with 1000 body and the species'
initial energy.

Watch the unit: the threshold counts **chloroplasts**, not bots. With the app's
value, 15, seeding kicks in if there are fewer than 15 × 16000 chloroplasts in the
whole field. Twenty skinny vegetables, 4000 each, add up to 5 and trigger seeding
all the same. And the animals' chloroplasts count too.

The species of each new vegetable is picked at random among the vegetable species
that still have some living bot with chloroplasts. If no vegetable is left alive,
all of them are eligible.

:::nota
In the original DarwinBots 2.48.32, the first seeding after loading a saved
simulation took twice as many cycles. The port does it on time (see
[[tecnico/diferencias]]).
:::

### The cap {#tope}
<!-- 31-ENERGIA §3; core ChangeChlr (TotalChlr > MaxPopulation y Veg), Reproduce (lotería RandomI(0,10) != 5 por encima del 90 %); port/README B6-2 -->

[[param:base:maxPopulation]] is also measured in units of 16000 chloroplasts.
When the field's total goes over that cap, vegetables can neither reproduce nor
buy chloroplasts; above 90% of the cap, only one in eleven reproduction attempts
goes ahead. The cap doesn't affect animals.
