---
titulo: "Parameters: Light and day/night"
resumen: "When and where there is sun: the day and night cycle, the random sun strip, the thresholds that turn the sun on or off according to the world's energy, and pond mode."
etiquetas: [light, sun, day and night, pond, thresholds]
estado: revisada
---
<!-- engine/opciones.js grupo 'luz' (opt:30-41); CONTROLES_BASICOS 'dia-noche'; 50-MUNDO §2.2; core vegs.hpp feedvegs -->

[[param:base:maxEnergy]] says how much the sun gives; this group says **when**
and **where** it gives it. There are four mechanisms, which can be combined:

| Mechanism | Parameters | What it does |
|---|---|---|
| Day and night | [[param:opt:33]], [[param:opt:34]] | The sun turns on and off on a clock. |
| Random sun | [[param:opt:40]] | Only a vertical strip of the field gets light, and it moves. |
| Thresholds | [[param:opt:35]], [[param:opt:37]] and their settings | The sun turns on or off according to the world's total energy. |
| Pond | [[param:opt:30]], [[param:opt:31]], [[param:opt:32]] | Light weakens with depth. |

If you touch nothing, the app starts with full sun all the time, across the
whole field. The **F1 league** base turns on only the random sun. At night no
bot photosynthesizes, but costs keep being charged, so long nights put heavy
pressure on the vegetables and on the animals that live off them. Bots find
out through [[.daytime]].

The complete mechanics are on the chloroplasts page, in
[[simulacion/cloroplastos#dia-y-noche|Day and night]] and
[[simulacion/cloroplastos#franja|The sun strip]]. In Experiment's basic mode,
the **Day and night** control handles the first two parameters at once: 0
turns the clock off and any other number turns it on with that duration.

:::parametro opt:33
<!-- core vegs.hpp reloj (DayNightCycleCounter > CycleLength → !Daytime); comprobado: planta.txt con opt:33=1, opt:34=3 → 3 ciclos de sol, 4 de noche, 4 de sol -->
Turns on the day and night clock: the sun switches off and on by itself, with
stretches lasting [[param:opt:34]] cycles plus one. Off (as the app starts),
the state stays fixed at whatever [[param:opt:41]] says, which is normally
day.

In a test with a half period of 3, a vegetable ate for three cycles, spent
four in the dark and ate again for four: only the first day is one cycle
shorter.
:::

:::parametro opt:34
<!-- core vegs.hpp (contador > CycleLength); opciones.js ent(500, 1, 32000) -->
How long each stretch of light or darkness lasts, in cycles: it actually lasts
one more than this number, so with 500, the app's value, there are 501 cycles
of sun and 501 of night. It only counts with [[param:opt:33]] on.

A short period alternates quickly and a vegetable with reserves barely
notices; a long one forces it to store energy for the night or to adapt, as
_Chloroplastus_ from the Bestiary does (see
[[simulacion/cloroplastos#tener|having chloroplasts]]).
:::

:::parametro opt:40
<!-- 50-MUNDO §0.3, §2.2 (banda móvil); core vegs.hpp feedvegs (SunPosition/SunRange); wasm db_sim_options_ok (al apagarlo, el sol vuelve al campo entero) -->
With this parameter only a vertical strip of the field, from top to bottom,
gets sun; it drifts slowly and changes heading and width every so often (on
average, once every 2000 cycles). Its width goes from a quarter of the field to
the whole field. Outside the strip no chloroplast produces anything, even in
daytime. The app has it off; the **F1 league** turns it on.

It creates seasons: a vegetable standing still goes through long spells of sun
and shade, and one that moves can follow the light. If you turn it off in a
running simulation, the sun goes back to covering the whole field. See
[[simulacion/cloroplastos#franja|the sun strip]].
:::

:::parametro opt:35
<!-- core vegs.hpp (TotalSimEnergyDisplayed < SunUpThreshold && SunUp); robots.hpp (nrg + 10·body de todo bot que existe) y shots.hpp (energía de los −2 en vuelo); master.hpp paso 5 (valor del ciclo anterior) -->
Turns the sun on when the world's total energy drops below
[[param:opt:36]]. It is useful for rescuing a dying population: if the food
runs out, light arrives even if it is night. What exactly it does to the clock
is decided by [[param:opt:39]]. Off in the app.

The total energy adds up the energy and ten times the body of all bots,
corpses included, plus the energy of the gifts (−2 shots) in flight. It is
measured at the end of a cycle and used in the next one.
:::

:::parametro opt:36
<!-- opciones.js ent(500000, 0, 2147483647, 1000, 'i32') -->
The threshold for [[param:opt:35]], in energy units; the app starts at 500000.
To give you a sense of scale: a freshly seeded bot with 3000 energy and 1000
body counts 13000, so 500000 is about 38 bots like that. It is best to keep
it below [[param:opt:38]].
:::

:::parametro opt:37
<!-- core vegs.hpp (TotalSimEnergyDisplayed > SunDownThreshold && SunDown); comprobado: planta.txt con 37=1, 38=5000 → come el primer ciclo y después no -->
Turns the sun off when the world's total energy goes over
[[param:opt:38]]. It is the brake on a population that grows too much:
without light, the vegetables stop producing and the whole chain slims down.
It is counted the same way as in [[param:opt:35]]. Off in the app.

In a test with a single vegetable (13000 total energy) and the threshold at
5000, the vegetable ate in the first cycle, when there was no measurement yet,
and never saw the sun again.
:::

:::parametro opt:38
<!-- opciones.js ent(1000000, 0, 2147483647, 1000, 'i32') -->
The threshold for [[param:opt:37]], in energy units; the app starts at
1000000, about 77 freshly seeded bots. If you also use [[param:opt:35]], keep
this one higher than [[param:opt:36]]: between the two lies the band of energy
in which the sun follows its normal course.
:::

:::parametro opt:39
<!-- core vegs.hpp TEMPSUNSUSPEND (0: fuerza y OverrideDayNight, el reloj no avanza), PERMSUNSUSPEND (1: fija Daytime; con SunUp y SunDown a la vez, ignora el reloj), ADVANCESUN (2: contador a 0 y fija Daytime) -->
What a threshold does when it is crossed. It only matters with
[[param:opt:35]] or [[param:opt:37]] on:

- **suspend until the next cycle** (0, the app's value): while the energy is on
  the other side of the threshold, every cycle the sun (or the darkness) is
  forced and the day clock is paused. When the energy comes back, the clock
  continues from where it was.
- **suspend for good** (1): the threshold changes the sun's state and the
  state stays that way until something else changes it (the clock, if it is
  on). With both thresholds on, the clock is ignored completely: the sun
  turns on when it drops below [[param:opt:36]] and doesn't turn off until it
  passes [[param:opt:38]], like a thermostat.
- **advance the sun** (2): the threshold sets the day (or the night) and
  restarts the clock; when the energy comes back, that stretch lasts in full
  (with the clock off, the state simply stays that way).
:::

:::parametro opt:30
<!-- core vegs.hpp (Pondmode: depth = round(pos.y/2000 + 1), tok = LightIntensity / depth^Gradient); physics.hpp GravityForces (flotabilidad); comprobado: planta.txt con 30=1 y 31=0 → no come -->
Pond mode: light comes in from the top with the strength of
[[param:opt:31]] and weakens with depth, according to [[param:opt:32]]. In this
mode [[param:base:maxEnergy]] isn't used. In addition, with downward gravity
([[param:opt:20]]) and with top and bottom not connected ([[param:opt:2]]),
bots can float at whatever height they choose with [[.setboy]] (see
[[simulacion/mundo#gravedad|gravity, ponds and tides]]).
:::

:::parametro opt:31
<!-- core vegs.hpp tok = LightIntensity / depth^Gradient, después /3,5 como MaxEnergy; comprobado: 31=100, vegetal a 12031 de profundidad (escalón 7) → +4,65 de energía por ciclo -->
The light at the surface of the pond, in the same units as
[[param:base:maxEnergy]]: in the top strip of the field, a value of 10 gives
the same as solar energy at 10. It only counts with [[param:opt:30]] on.

The app has it at 0, and that means that **if you turn on the pond without
touching this value, nobody photosynthesizes**. In a test with 100, a
vegetable of 16000 chloroplasts at a depth of 12000 gained 4.65 energy per
cycle, and one closer to the surface, more.
:::

:::parametro opt:32
<!-- core vegs.hpp pow(depth, Gradient); profundidad en escalones de 2000 (1 arriba, 17 al fondo de 32000) -->
How much the light fades going down. Depth is counted in steps of 2000 (1 at
the very top, 17 at the bottom of a 32000 field), and the light at each step
is [[param:opt:31]] divided by the step raised to this number. With 1.02, the
app's value, at 2000 depth half the light arrives and at the bottom, about an
eighteenth. With 0 the light is the same across the whole pond; with 2, 1/289
reaches the bottom. It only counts with [[param:opt:30]] on.
:::

:::parametro opt:41
<!-- core vegs.hpp FeedThisCycle = Daytime; reloj lo invierte; PERMSUNSUSPEND y ADVANCESUN escriben Daytime, TEMPSUNSUSPEND solo FeedThisCycle; comprobado: planta.txt con 41=0 → no come, .daytime 0 -->
The state of the sun right now: day or night. With the clock
([[param:opt:33]]), or with a threshold acting in the **suspend for good** or
**advance the sun** modes ([[param:opt:39]]), the engine changes it by itself
and this parameter is for reading it or for forcing a change in a running
simulation. In the **suspend until the next cycle** mode, the threshold turns
the sun on or off without touching this state. Without a clock, on the other
hand, it stays wherever you put it: off means **night forever**. In a test, a
vegetable with this parameter at “no” gained nothing and read [[.daytime]] as 0
the whole time.
:::
