---
titulo: A vegetable
resumen: "Step by step, a vegetable that makes its own chloroplasts, lives off the sun and fills the field with children: why to turn when splitting, what happens at night and how the world repopulates it."
etiquetas: [vegetable, chloroplasts, photosynthesis, sun, reproduction, repopulation]
estado: revisada
---
In [[tutoriales/se-mueve]] you built a bot that moves, and in [[tutoriales/busca-comida]],
one that goes hunting the others for food. This tutorial plays for the other team: a
vegetable that chases no one. All its energy comes from the sun, and with it
it fills the field with copies of itself. As always, each step adds a gene to the
DNA and tells you what you should see.

## What a vegetable has {#que-es}

A vegetable is a bot of a species you marked as such: the **Is a vegetable
(photosynthesizes)** checkbox when editing the species in Experiment, or **Vegetable
(photosynthesizes)** when seeding from Observe.
<!-- i18n es: experimentar.especie.vegetal, observar.sembrar.vegetal -->

With that mark, the world treats it differently:

- It's born with [[param:base:startChlr]] chloroplasts (16000 in the app).
- It doesn't suffer shock when it loses energy all at once
  ([[simulacion/energia#shock]]).
- Its children are vegetables too.
- Its population has a cap, and the simulation tops it up when it runs short.

Photosynthesizing, on the other hand, isn't exclusive to vegetables: any bot with
chloroplasts does it. How photosynthesis works, when there's sun and how much it
yields is in [[simulacion/cloroplastos]]; here we use it.

## Step 1: make chloroplasts {#paso-1}

In the app, a freshly seeded vegetable already comes with its 16000 and grows
without you writing a single line. But chloroplasts get lost on their own, are
split with each child and each one weighs something, so the serious algae of the
Bestiary make their own. Let's do the same:

```adn
' Makes chloroplasts while there's free light left over
cond
 *.chlr *.light <
start
 160 .mkchlr store
stop
```

[[.chlr]] says how many it has and [[.light]], how much free light is left in the
field: when bots are plentiful, each one covers its own patch and the light drops.
While the free light exceeds the chloroplasts it has, the gene buys 160 per cycle with [[.mkchlr]]; once
the chloroplasts catch up with the light, it switches itself off. Removing them with [[.rmchlr]] is free, but
gives nothing back.

<!-- 31-ENERGIA §1 y §4 (ChangeChlr: cobra solo las compras, se anula si dejaría nrg < 100), §3 (decaimiento, masa y radio); comprobado con probar-adn --veg en 4000x3000: chlr sube 160 por ciclo y se frena solo cerca de 30700 con la luz en ~30625; con --cost 8=0.2,54=1 (F1: cloroplasto 0,2 y multiplicador 1): 3085 de energia final contra 9229 con costos en 0, unos 6140 menos: lo que costaron; arrancando con 500, rondó entre 100 y 160 los primeros ~200 ciclos y recien despues despego -->

Buying costs [[param:cost:8]] per chloroplast. With costs turned off you don't
notice; with the F1 league price (0.2), an alga that started with 3000 finished
building its factory with about 6140 less energy than a twin with costs at 0: exactly what the
chloroplasts cost it. And since a purchase is canceled entirely if it would leave
the bot with less than 100 energy, an alga that starts poor can't afford the
luxury: in the test, one that was born with 500 spent its first 200 cycles stuck
at the floor of 100, buying little by little what the sun paid it.

**What you should see:** in the inspector, [[.chlr]] goes up by 160 per cycle until
it reaches the free light, and there it stops. After each birth it starts again:
the child takes half.

## Step 2: live off the sun {#paso-2}

With chloroplasts and in daytime, the bot gets paid every cycle, in the sun phase,
the last of the cycle (see [[simulacion/ciclo#fases]]). The split is set by
[[param:opt:63]]: with 0.75, the app's value, a quarter of the gain goes to
[[.nrg]] and three quarters to [[.body]], at 10 for 1.

<!-- 50-MUNDO §2.2 (feedvegs: ganancia y reparto nrg/body), 10-CICLO §2 paso 21 (fotosintesis en la fase del sol); comprobado con --veg --maxe 100 en 4000x3000: de 3000 a 4661 de energia en los primeros 100 ciclos mientras fabrica; con 30709 cloroplastos gana ~225 por ciclo entre energia (56) y cuerpo (17, que valen 170); el tope de 32000 llego entre los ciclos 600 y 650; con --maxe 10 (la app): 3000 a 4749 en 400 ciclos -->

With solar energy at 100, a lone alga goes from 3000 to about 4660 energy in the
first 100 cycles, and with the factory complete it gains about 225 per cycle
between energy and body. Sooner or later it reaches the 32000 cap
([[simulacion/energia#tope]]): in the test it touched it before cycle 650, and from
then on the sun kept shining for nothing. Accumulated energy that goes unused is
energy thrown away; to make it count, you have to have children.

With the app's solar energy (10, [[param:base:maxEnergy]]), everything yields a
tenth: the numbers at that value are in the table in
[[simulacion/cloroplastos#rinde]].

## Step 3: have children {#paso-3}

When there's energy to spare, split. Second gene:

```adn
' With energy to spare, it splits
cond
 *.nrg 6000 >
start
 50 .repro store
stop
```

[[.repro]] asks for a child that takes 50% of the energy, body, chloroplasts and
waste ([[simulacion/reproduccion#reparto]]). The number is the percentage, modulo
100, and the command stays written until the birth goes through. The child is born
in front of the parent, facing it, in the births and deaths phase of the same
cycle ([[simulacion/reproduccion#donde-nace]]).

And here the problem of the still bot appears: **a single birth**. The child is
born where the parent points and stays there; the next one wants to be born in that
same spot, which is already occupied, and the birth fails. In the test, parent and
child ended up locked face to face, the command stayed written retrying cycle
after cycle, and at 500 cycles there were still two of them, full of energy and
unable to split.

<!-- 36-REPRO §2 (reparto por per, sondist = suma de los radios, aim + pi), §0.4 (un fallo no consume la orden: reintenta cada ciclo), §0.5 (per Mod 100); comprobado: quieto, un solo parto en 500 ciclos, *.repro quedo en 50 para siempre y los dos llegaron a ~19500 de energia -->

The solution is to turn between births, like the Bestiary's _Alga minimalis_ does:

```adn
' With energy to spare, it splits and turns for the next one
cond
 *.nrg 6000 >
start
 50 .repro store
 15 .aimdx store
stop
```

By turning with [[.aimdx]], the spot of the next birth points somewhere else. With
that turn alone, the population went from 1 to 2, 4, 8 and 12 bots in 500 cycles.

### The complete bot {#bot-final}

```adn
' A vegetable: makes chloroplasts, grows and multiplies

' Makes chloroplasts while there's free light left over
cond
 *.chlr *.light <
start
 160 .mkchlr store
stop

' With energy to spare, it splits and turns for the next birth
cond
 *.nrg 6000 >
start
 50 .repro store
 15 .aimdx store
stop
```

In a long run it filled the field: 1 → 4 → 12 → 16 → 21 → 23 bots in 1500 cycles,
and there it stopped by itself. It wasn't bad luck: with the field full, each bot
covers the light of the others ([[simulacion/cloroplastos#fotosintesis]]), the free
light dropped to less than half and the gain no longer reaches for more births. If
in addition the chloroplasts of the whole field go over 90% of the cap, only one
in eleven births goes ahead ([[param:base:maxPopulation]] and
[[simulacion/cloroplastos#tope]]).
<!-- 36-REPRO §2, §0.4; cloroplastos#tope (loteria de 1/11 por encima del 90 % del tope); comprobado en 4000x3000: 1 -> 4 -> 12 -> 16 -> 21 -> 23 bots en 1500 ciclos, *.light cayo de ~31900 a 13898 -->

Seed about fifteen copies marked as vegetable in the app and watch the field fill
up with hexagons.

## At night {#dia-y-noche}

By default it's always daytime. In Experiment, the **Day and night** control makes
the sun set: each stretch lasts that value plus 1 cycles, and only the first day
lasts one fewer (with 3: three of day, four of night, four of day…).
<!-- opciones.js, control 'dia-noche' (escribe opt:33 y opt:34; 0 = siempre de dia); 50-MUNDO §2.2 (reloj, primer dia uno menos); comprobado con opt:33 = 1, opt:34 = 3: dia los ciclos 1-3, noche 4-7, dia 8-11 -->

At night there's no photosynthesis: in the test, energy and body stayed pinned
cycle after cycle while [[.daytime]] was 0. The purchasing gene doesn't find
out ([[.light]] isn't recalculated at night) and the bot keeps buying in the dark:
free with costs turned off, energy thrown away with real costs. The Bestiary's
_Chloroplastus_ buys by day and sheds them 1 at a time at night
([[simulacion/cloroplastos#tener]]).

The app's **Day and night** scenario brings 20 _Alga minimalis_ and 5 _Animal
Minimalis_ with days and nights of 1000 cycles: watch the population oscillate
every time the sun sets ([[app/escenarios]]).

## Repopulation {#repoblacion}

The world doesn't let vegetables disappear: if the chloroplasts of the whole field
drop below [[param:base:minVegs]], every [[param:base:repopCooldown]] cycles it
seeds [[param:base:repopAmount]] new vegetables. Mind the unit: the threshold
counts chloroplasts, in units of 16000, not bots.

<!-- 50-MUNDO §2.1 (VegsRepopulate: acumulador con deuda, umbral TotalChlr en unidades de 16000; aggiungirob: body 1000, nrg de la especie, StartChlr; checkvegstatus: especie vegetal con algun bot vivo con cloroplastos); comprobado: umbral en 3 (--vegs 3), un solo vegetal -> 10 nuevos en el ciclo 10 y otros 10 en el 20 (cooldown y cantidad por defecto: 10 y 10) -->

In the test, a lone vegetable with the threshold at 3 received 10 strangers at
cycle 10 and another 10 at 20. Each one is born with 1000 body, the starting
energy of its species and the chloroplasts of [[param:base:startChlr]], in a random
spot. Of which species? Of a vegetable species that is still alive: if yours is the
only one, the world seeds you with clones of yourself
([[simulacion/cloroplastos#repoblacion]]).

## Against the Bestiary's algae {#bestiario}

Our bot is practically the Bestiary's _Alga minimalis 3.0_, which adds a slime
gene:

```adn
' The slime gene of Alga minimalis 3.0
cond
start
 *.nrg 500 div .mkslime store
stop
```

Every cycle it asks for as much slime as its energy divided by 500, computed with
[[op:div]] and written to [[.mkslime]], which gives ten slime for each point of
energy. Slime stops shots and bites ([[simulacion/defensas]]). Running the real
alga marked as a vegetable, in 300 cycles it went from 1 to 4 bots with about 22000
chloroplasts each and a layer of between 280 and 460 slime: the same life as ours,
with armor.
<!-- port/web/bots/Alga_minimalis_3.0.txt; comprobado con probar-adn --veg: 1 -> 2 -> 4 bots en 300 ciclos, chlr ~22000, baba 277-463 -->

_Alga Substantis_, on the other hand, takes the calendar seriously: by day it
stores energy in the body with [[.strbody]] and goes around in circles; at night it
draws from the body with [[.fdbody]] and gives birth to many small children, so
that some of them reach the morning.
<!-- port/web/bots/Alga_Substantis_V_Frankle_-18.12.06.txt; comprobado con --veg --opt 33=1,34=3: los partos salen de noche (*.daytime = 0, .repro 10) y convierte cuerpo -->

## What to try next {#despues}

<!-- 50-MUNDO §0.3 (SunOnRnd: la banda solar deriva y cambia de rumbo al azar; solo los cloroplastos dentro de la banda comen); opciones.js opt:40; Bestiario: Alga_Toxicus (100 .strpoison) -->

- **Follow the sun.** With [[param:opt:40]] the sun is a strip that sweeps across
  the field: a still vegetable suffers seasons, one that moves can follow the
  light ([[simulacion/cloroplastos#franja]]).
- **Give yourself defenses.** The _Alga minimalis_'s slime is the bare minimum; the
  Bestiary has vegetables with poison, like _Alga Toxicus_.
- **Let someone eat you.** Continue with [[tutoriales/alimentador]], which builds a
  bot that feeds on your vegetable through a tie: only then does your alga
  stop being an exercise and real ecology begins.
