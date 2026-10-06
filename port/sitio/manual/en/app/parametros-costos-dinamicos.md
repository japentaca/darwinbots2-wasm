---
titulo: "Parameters: Dynamic costs"
resumen: "The multiplier that scales every cost, the adjustment that moves it by itself to steer the population toward a target, and the brake that makes everything free when few bots are left."
etiquetas: [costs, multiplier, population, parameters, dynamic costs]
estado: revisada
---
<!-- opciones.js «Costos dinámicos»; core master.hpp DynamicCostsStep (Master.bas:240-300); 10-CICLO §2 pasos 6-7 -->

All the prices in the [[app/parametros-costos]] group are multiplied by one
and the same number, [[param:cost:54]]. This group has that multiplier and two
mechanisms that move it by themselves while the simulation runs:

- **The dynamic adjustment**, a thermostat: it raises the multiplier when
  there are too many bots and lowers it when there are too few, to bring the
  population closer to a target. It is useful for long evolution runs, where
  you want the population to neither explode nor go extinct without you
  watching over it.
- **The emergency brake**: if the population falls below a threshold,
  everything becomes free until it recovers. It works even if the adjustment
  is off.

With the factory values both are off and the multiplier stays fixed at 1. The
mechanism step by step, with the arithmetic, is in
[[simulacion/ciclo#costos-dinamicos]]; here you get what each knob does and how
to combine them.

## Which population counts {#poblacion}
<!-- master.hpp: totnvegsDisplayed (+ totvegsDisplayed con 61); PopulationLast10Cycles se desplaza cada 10 ciclos (10 casillas); DynamicCountdown 10 (ajusta con la población igual a la de hace cien ciclos solo cuando llega a 0); comprobado: en los dos primeros ciclos la cuenta vale 0 -->

Both mechanisms look at the same figure: the bots that are not vegetables
(plus the vegetables, if you turn on [[param:cost:61]]). The count arrives a
couple of cycles late, so in the first cycles of a simulation it reads 0 even
if the world is full.

The adjustment also compares that figure with the one from about a hundred
cycles ago. It only raises the multiplier if the population, besides being
above the band, has grown; and it only lowers it if, besides being below, it
has dropped. If the population stays stuck at the same number as a hundred
cycles ago, it adjusts anyway, but only after ten cycles of that.

## How to use it {#como-usarlo}
<!-- comprobado: 5 bots, store a 1, objetivo 1, sensibilidad 100000 → el gasto por ciclo sube 0,04 por ciclo; con margen superior 500 % no cambia -->

1. Set prices in [[app/parametros-costos]]: if everything costs 0, moving the
   multiplier changes nothing.
2. Pick the [[param:cost:53|target population]], the population you want to
   sustain.
3. If you don't mind the population oscillating, leave a quiet band with
   [[param:cost:57]] and [[param:cost:58]].
4. Turn on [[param:cost:56]].
5. If the multiplier reacts too slowly or too abruptly, adjust
   [[param:cost:55]].

Every cycle outside the band, the multiplier moves by 0.0000001 × (bots too
many or too few, counted from the edge of the band) × [[param:cost:55]]. With
the factory sensitivity (50) and 200 bots over a target of 100, it rises by
0.0005 per cycle: half a point every thousand cycles. It is a slow thermostat
on purpose, because the population takes a while to respond to prices.

To see what the multiplier is worth at any moment, the classic interface shows
it in its status bar (as _CostX_) when it isn't 1. Bots can't read it: they
notice it in how fast their energy drops.

If the simulation is played in rounds ([[app/parametros-modos]]), the new round
starts with the multiplier as the adjustment left it, not with the value you
set at the beginning.

:::parametro cost:56
<!-- master.hpp: C[USEDYNAMICCOSTS] != 0; la UI escribe -1 -->
Turns on the thermostat: from then on the engine adjusts [[param:cost:54]] at
the start of every cycle, before the DNA runs, so that same cycle is already
paid at the new price. Turning it off leaves the multiplier where it was; it
doesn't return it to its initial value. With the
[[param:cost:53|target population]] at 0 (as it comes), any population other
than 0 is above the target, and turning it on only makes prices climb and
climb.
:::

:::parametro cost:53
<!-- AmountOff = población − objetivo -->
The population, in bots, that the adjustment aims for. It counts only the
bots that aren't vegetables, unless you turn on [[param:cost:61]]. Without
[[param:cost:56]] on, it does nothing. Choose it with the size of the field
and the amount of food in mind: if the world can't feed that many bots, the
multiplier will drop to 0 and stay there.
:::

:::parametro cost:55
<!-- corrección = 0,0000001 × exceso × sensibilidad; comprobado con 100000 → 0,04 por ciclo con 4 de exceso -->
How strongly the adjustment reacts: each step is 0.0000001 × the bots outside
the band × this number. At 0, the thermostat is on but moves nothing. With
very high values the multiplier shoots up in a few cycles and the population
oscillates, because the engine keeps correcting before the bots have time to
respond.
:::

:::parametro cost:57
<!-- UpperRange = % × 0,01 × objetivo; comprobado: objetivo 1, margen 500 %, 5 bots → sin ajuste -->
A margin above the target, as a percentage of the target, within which the
adjustment doesn't raise the multiplier. With the target at 200 and the
margin at 10, the population can reach 220 without anything changing. What
gets corrected is only the excess over the edge of the band, not over the
target.
:::

:::parametro cost:58
<!-- LowerRange = % × 0,01 × objetivo -->
The margin below the target, as a percentage of the target, within which the
adjustment doesn't lower the multiplier. With the target at 200 and the
margin at 25, the population can fall to 150 without prices dropping. With
both margins at 0 (the factory value) the thermostat corrects with a
difference of a single bot.
:::

:::parametro cost:61
<!-- master.hpp: CurrentPopulation += totvegsDisplayed si != 0 -->
Adds the vegetables to the population that the adjustment and the brake
count. It makes sense when the vegetables are part of what you want to
regulate, for example in a world of only vegetables. If the vegetables
repopulate themselves (see [[app/parametros-energia]]), counting them makes
the thermostat react to something the bots don't control.
:::

:::parametro cost:54
<!-- vm.hpp Costs::of; comprobado: store a 1 con multiplicador 2 → −2, 0 → 0, −1 → +1 por ciclo -->
The number by which all the costs in [[app/parametros-costos]] are multiplied:
at 1 (factory value) prices are worth what they say, at 0 everything is free,
at 2 everything costs double. Entered by hand, it can be negative and turn
costs into payments: at −1, every `store` gives the bot energy instead of
charging it. If the dynamic adjustment is on, the value you set is the
starting point and the engine moves it from there.
:::

:::parametro cost:62
<!-- master.hpp: piso en 0 salvo ALLOWNEGATIVECOSTX == 1 exacto (la app escribe 1) -->
Lets the dynamic adjustment take the multiplier below 0. Off (the factory
value), the thermostat never goes below 0: in the worst case everything is
free. On, if the population keeps falling, costs turn into payments and every
action gives the bot energy. It is an extreme way of rescuing a population,
and it also rewards the bots that spend the most.
:::

:::parametro cost:52
<!-- master.hpp :293-300: corre siempre, fuera del gate; población < nivel y multiplicador != 0 → guarda y pone 0 -->
The threshold of the emergency brake: if the population drops below this
number, the multiplier goes to 0 and nothing costs anything. The previous
value is saved so it can be restored when the population exceeds
[[param:cost:59|the reinstatement level]]. It works even if [[param:cost:56]]
is off. At −1 (the factory value) it never acts, because the population can't
be negative. Since the count reads 0 in the first cycles, with any positive
value the simulation starts with costs at 0.
:::

:::parametro cost:59
<!-- comprobado: 3 bots, freno en 10 y reposición en 0 → el store cobra un ciclo sí y otro no; reposición en 20 → nunca cobra -->
The population that has to be exceeded for costs to come back after
[[param:cost:52|the brake]] has acted; the multiplier returns to the value it
had before the brake. Set it **above** the brake threshold, to let the
population recover before charging it again. If it is below, the brake and the
reinstatement step on each other: in a test with 3 bots, the brake at 10 and
the reinstatement at 0 (as it comes), costs were charged every other
cycle.
:::
