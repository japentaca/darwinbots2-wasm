---
titulo: A tie feeder
resumen: "Step by step: a bot that finds a prey, ties to it, drains its energy through the tie, lets go when it runs dry and reproduces with what it gained."
etiquetas: [tutorial, ties, hunting, energy, parasite]
estado: revisada
---
In [[tutoriales/busca-comida]] you stole energy from vegetables with shots,
and in [[tutoriales/vegetal]] you raised the algae that make energy out of
light. This tutorial builds the third contender: a bot that neither hunts nor
photosynthesizes, but ties to its food and drains it. Each step adds genes to
the DNA and tells you what you should see.

## A tie instead of a shot {#por-que}

<!-- 34-TIES §2 (transferencias por tieloc −1); port/core ties.hpp tie_transfers (al sacar 1000, quien saca gana 700 de nrg, 29 de body y 10 de waste); 30-FISICA §3.1 (el lazo es un muelle amortiguado) -->

Hunting with shots ([[tutoriales/dispara]]) means running after your food.
With a tie ([[simulacion/lazos]]) you tie on _once_ and the tie does the work
by itself: it **pins** the prey down (it is a spring: the prey is not going
anywhere while you eat) and it **drains** it (through the tie you transfer
energy every cycle, straight from its reserve to yours —
[[simulacion/lazos#recursos]]).

The price: out of every 100 you take from it, you keep 70 as energy, almost 3
as body and 1 as waste. That pays less than a good shot; the upside is that
the command goes through every cycle, for free and with no aiming.

## Step 1 · The prey {#presa}

<!-- app/observar #sembrar (DialogoSembrar: «Vegetal (hace fotosíntesis)»); app/bots #nuevo (como en tutoriales/dispara #blanco) -->

You need something with energy that does not defend itself. In **Observe** →
**Seed**, seed the alga you built in [[tutoriales/vegetal]] marked as
**Plant (photosynthesizes)**, or a few copies of a motionless target like the
one in [[tutoriales/dispara]]:

```adn
' Practice target: does nothing
cond
start
stop
```

We are going to watch the target die little by little; the alga, with the sun
behind it, lasts longer. For the measurements in this tutorial we use the
motionless target, a 1200×900 field and bots with 3000 energy.

## Step 2 · Finding it and getting close {#acercarse}

<!-- 34-TIES §1 (FireTies: solo ata al bot que se está viendo, a ≤ 4·RobSize + radios; maketie exige length ≤ 1,5·(radios + 2·RobSize): con bots de 1000 de cuerpo, hasta unos 470 de borde a borde, menos si son chicos); 32-VISION §2.6 (el ojo con foco llena las ref*); sysvars .refnrg (un cadáver muestra su energía real) -->

The tie only reaches the bot you are looking at, and only up close: the
engine does not tie across more than about 480 from edge to edge, and less if
the bots are small. So first comes the usual hunt: turn while searching, aim,
get closer. Two genes are enough, because the focus eye already describes the
one you have best in front of you: its position in [[.refxpos]] and
[[.refypos]], its energy in [[.refnrg]] and its species in [[.refeye]]
([[simulacion/vision#foco]]).

```adn
' Hands free and what's ahead isn't food: turn at random and move forward
cond
 *.tiepres 5 !=
 *.refnrg 100 <
 *.refeye *.myeye =
 or
start
 314 rnd .aimdx store
 10 .up store
stop

' Hands free and prey in sight: aim at it and get closer
cond
 *.tiepres 5 !=
 *.refnrg 100 >
 *.refeye *.myeye !=
start
 *.refxpos *.refypos angle .setaim store
 10 .up store
stop
```

Three new decisions in those conditions:

- **[[.refnrg]] above 100** means “this has energy and is alive”: corpses,
  which show their real energy, 0, are left off the menu.
- **[[.refeye]] different from [[.myeye]]** is the species test from
  [[tutoriales/reconoce-especie]]: it doesn't run after your own kind.
- **[[.tiepres]] different from 5** means “I'm not eating”: 5 is the _port_
  we are going to use to call the tie in the next step, and this check keeps
  the bot from tying to two prey at once.

The first gene uses [[op:or]]: it turns if what it sees is not food _or_ is a
relative, and it always moves forward, pushing whatever is in the way.

**What you should see:** the bot pivots and walks at random until the prey
enters the fan of eyes; then it locks its heading with [[.setaim]] and goes
straight for it. In our run it had the prey in focus at cycle 2 and touched it
at 11.

## Step 3 · Tying to it {#atarla}

<!-- 34-TIES §0.2 (puertos asimétricos: el creador elige el número, el receptor su orden de llegada), §0.5 (TIECOST/(numties+1), baba deflecta: Random(2,92), −20 por intento), §0.1 (máximo 9); opciones.js cost:22 (0 por defecto, 2 en la F1) -->

```adn
' Prey close and ahead: tie to it with port 5
cond
 *.tiepres 5 !=
 *.refnrg 100 >
 *.refeye *.myeye !=
 *.eye5 50 >
start
 5 .tie store
stop
```

An [[.eye5]] of 50 is about 200 units from edge to edge: as the bot crosses
that line, it writes 5 to [[.tie]] and, at the end of the actions phase, the
engine ties it to the bot it is looking at. The 5 is the _port_: the name _you_
will use to pick that tie; the prey will call it 1, by its order of arrival
([[simulacion/lazos#puertos]]). The command is always cleared, whether it
works or not, and every attempt charges the cost of tying ([[param:cost:22]]):
0 in the built-in simulations, 2 in the F1 league.

The prey can still get away: its slime deflects the attempt ([[.slime]] — above
92 no tie is possible) and every attempt, whether it works or not, costs it 20
([[simulacion/defensas#baba]]).

**What you should see:** in the app, a thin line between the two, bluish while
the tie is soft. In the inspector's memory ([[app/inspector]]): the feeder
with [[.numties]] at 1 and `.tiepres` at 5; the prey with `.tiepres` at 1.

:::cuidado
Tying to the same bot twice replaces the old tie, but tying to **two different
prey with the same port** leaves you with two ties called 5, and you lose
control: port commands —transfer, fix, write to the other's memory— reach
**both at once**, while the [[sysvars/tref|tref* cells]] only describe the
first one and [[.deltie]] cuts one tie per pass. That is why all the hunting
genes demand “hands free”: as long as `.tiepres` is 5, this bot doesn't
search, approach or tie to anyone else.
:::
<!-- port/core ties.hpp Update_Ties/tieportcom (las órdenes con .tienum recorren TODOS los lazos con ese puerto; readtie lee el primero; el bucle de .deltie, con el corrimiento de DeleteTie, corta uno por pasada — igual que Ties.bas:193-200); core DeleteTie (borrar el lazo más antiguo deja .tiepres en 0 aunque queden otros) -->

## Step 4 · Draining its energy {#comer}

<!-- 34-TIES §2 (transferencias por tieloc negativo: −1 energía, tope sacar 3000 por ciclo); port/core ties.hpp tie_transfers (al sacar, quien recibe se queda 0,7 como nrg, 0,029 como body y 0,01 como waste; con toxina suficiente en la presa, en vez de comer te envenena); comprobado con probar-adn --otro (1200x900, semilla 3, sin costos ni mutaciones) -->

```adn
' Tied prey that isn't mine: read it and drain its energy
cond
 *.tiepres 5 =
 *.trefeye *.myeye !=
start
 5 .readtie store
 5 .tienum store
 -1 .tieloc store
 -1000 .tieval store
stop
```

Four commands: [[.readtie]] points the tie's senses (the
[[sysvars/tref|tref* cells]]) at port 5; [[.tienum]] picks tie 5 for
everything else; [[.tieloc]] at −1 says “transfer energy” and a negative
[[.tieval]] says “take”. You can take up to 3000 per cycle; we ask for 1000,
and the engine trims it to whatever the prey has left.

The transfer happens in the movement phase of that same cycle, and by the next
one you are already eating. What we measured against the motionless target:

| Cycle | Prey | Feeder (energy / body / waste) |
|---|---|---|
| 12 | 3000 (tied) | 3000 / 1000 / 0 |
| 13 | 2000 | 3700 / 1029 / 10 |
| 14 | 1000 | 4400 / 1058 / 20 |
| 15 | 0: corpse | 5100 / 1087 / 30 |

Each cycle the prey loses 1000 and you gain 700 energy, 29 body and 10 waste
([[.waste]]): the remaining 30% is lost along the way. The condition with
[[.trefeye]] is the same species test, now looking at the tied bot instead of
the seen one.

:::cuidado
Taking energy from a bot with poison poisons you instead of feeding you. In a
run against a prey that made poison with [[.strpoison]], the feeder stayed
marked as poisoned ([[.poisoned]]) cycle after cycle without gaining
anything. It doesn't last forever either: every failed attempt uses up some of
the prey's poison, and when its reserve runs short, the tie starts passing
normal energy — that is what we measured. To avoid taking the punishment,
attack the ones that don't make it first
([[simulacion/defensas#toxina]]).
:::
<!-- port/core ties.hpp tie_transfers (retaliación: con poison > un cuarto de lo pedido, Poisoned en vez de transferir, y la presa pierde esa toxina); comprobado con probar-adn contra una presa con 100 .strpoison por ciclo: poisoned 249 -> 2383 mientras la toxina de la presa baja de ~1000 a ~200, y recien ahi el alimentador empieza a cobrar -->

## Step 5 · The spring: pinning the prey {#resorte}

<!-- 30-FISICA §3.1 (muelle con zona muerta de 20; blando k 0,01, endurecido 0,05; rotura a más de 1000 de borde a borde), §3.2 (TieTorque en ambos bots); 34-TIES §0.4 (endurecimiento a los 19 ciclos, regang, multibot); comprobado con probar-adn: atar a la carrera deja al par deslizando junto unas 200 unidades antes de asentarse; endurecido, .multi 1 en los dos -->

Tying on the run has its own physics. The tie is born with whatever length it
had when it formed and tolerates a difference of 20 units without doing
anything: outside that dead zone it is a spring that pulls on both. Since you
arrive pushing, the length ends up short, the prey ends up almost stuck to
you, and the pair keeps sliding together about 200 units before settling —
dragging works the same the other way around, corpse included. One thing,
though: a vegetable loaded with chloroplasts is far more massive than a bot
made of pure body ([[simulacion/fisica#estado]]).

After 19 cycles the tie stiffens: in the app the line turns ocher and
thicker, and the two bots become multicellular ([[.multi]] is 1 in both). By
then you can send it geometry: [[.fixlen]] fixes the length and [[.fixang]]
the angle, and the prey ends up hanging off you on a short arm, in front of
your nose.

```adn
' Stiffened tie: carry it close and in front
cond
 *.multi 1 =
 *.tiepres 5 =
start
 100 .fixlen store
 0 .fixang store
stop
```

In our run, from the stiffening on, [[.tielen]] went down gradually to about
40 from edge to edge and [[.tieang]] kept getting closer to 0: the prey ended
up within arm's reach, dead ahead. With a small prey the feast lasts less
than those 19 cycles, so the gene only shines with fat prey. Being
multicellular with your own food has side effects —costs are split and your
shots hit harder ([[simulacion/lazos#multicelulares]])— and it is exactly the
mechanism [[tutoriales/multibot]] uses for good.

## Step 6 · Letting go when it runs dry {#soltar}

<!-- 34-TIES §1 (DeleteTie desde cualquier extremo; el cadáver sigue atado); 21-MEMORIA §9 (las tref* se leen con un ciclo de atraso); comprobado con probar-adn: sin este gen el cadaver queda atado cientos de ciclos; con el, numties 0 un ciclo despues de que la presa llega a 0 -->

The dried-up prey doesn't disappear: it stays as a corpse and **stays tied**,
and a bot that doesn't let go ends up dragging its empty pantry around. The
missing gene:

```adn
' The prey dried up: let go
cond
 *.tiepres 5 =
 *.trefbody 0 >
 *.trefnrg 100 <
start
 5 .deltie store
stop
```

[[.trefnrg]] is the tied bot's energy, read through the tie one cycle late.
With less than 100 there is nothing left to drain: [[.deltie]] cuts tie 5 and
the bot is free. The condition with [[.trefbody]] avoids a false positive: in
the tie's first cycle the `tref*` cells are still empty, and without that
check the bot would cut a freshly tied prey.

**What you should see:** one cycle after the prey reaches 0, the two have
`.numties` at 0 and the feeder turns to look for another. It doesn't tie to
the corpse again: the `.refnrg` test from step 2 already leaves it off the
menu.

## The complete bot {#el-bot}

What's left is the usual: when energy is left over, children. The gene asks
for 30% with [[.repro]] starting at 6000, and only with hands free: the birth
needs free room ahead, and while you eat, the prey is covering that room.
This is the whole bot, just as we ran it:

```adn
' A tie feeder
' Looks for prey, ties to it with port 5, drains its energy,
' lets go when it runs dry and, with the gain, has children.

' Hands free and what's ahead isn't food (or is one of mine):
' turn at random and move forward
cond
 *.tiepres 5 !=
 *.refnrg 100 <
 *.refeye *.myeye =
 or
start
 314 rnd .aimdx store
 10 .up store
stop

' Hands free and prey in sight: aim at it and get closer
cond
 *.tiepres 5 !=
 *.refnrg 100 >
 *.refeye *.myeye !=
start
 *.refxpos *.refypos angle .setaim store
 10 .up store
stop

' Prey close and ahead: tie to it with port 5
cond
 *.tiepres 5 !=
 *.refnrg 100 >
 *.refeye *.myeye !=
 *.eye5 50 >
start
 5 .tie store
stop

' Tied prey that isn't mine: read it and drain its energy
cond
 *.tiepres 5 =
 *.trefeye *.myeye !=
start
 5 .readtie store
 5 .tienum store
 -1 .tieloc store
 -1000 .tieval store
stop

' Stiffened tie: carry it close and in front
cond
 *.multi 1 =
 *.tiepres 5 =
start
 100 .fixlen store
 0 .fixang store
stop

' The prey dried up: let go
cond
 *.tiepres 5 =
 *.trefbody 0 >
 *.trefnrg 100 <
start
 5 .deltie store
stop

' Energy to spare and hands free: a child
cond
 *.nrg 6000 >
 *.tiepres 5 !=
start
 30 .repro store
stop
```

Against two motionless targets, in a 1200×900 field: it emptied the first one
in ten cycles (ending at 5100), took about seventy more to find the second,
emptied it just the same, and at cycle 90 the first child was born — the
parent ended at 5037, the child started with 2157 and the same DNA. After
that the two wandered without finding anything: the field was clean.

<!-- probado: final contra 2 blancos (--qty 2) como primera especie y el alimentador como --otro, 1200x900, semilla 3, 150 ciclos: presa 1 muerta al ciclo 10, presa 2 al 85, parto al 90 (padre 5037.84, hijo 2157.84), despues nada mas que vagar; lint sin avisos -->

The Bestiary has real tie feeders. The _Hybrid of a tiefeeder and Alga
Chloroplastus_ is a leaner version of this bot: it ties with `.tie` to whoever
isn't its species, takes 1000 per cycle from it with `.tieloc` at −1 and cuts
the tie if the tied bot turns out to be a relative. We ran it against a
motionless target: it emptied it in about ten cycles, but kept dragging the
corpse around. Letting go of the dried-up prey is the improvement we added.
<!-- Bestiario: port/web/bots/Hybrid_of_a_tiefeeder_and_Alga_Chloroplastus.txt (genes: .tie inc a quien no es de la especie; *.tiepres .tienum store, -1000 .tieval, -1 .tieloc; .deltie si *.trefeye = *.myeye); comprobado con --veg --otro blanco, 1200x900, semilla 5: 3000 -> 0 en el blanco al ciclo ~30 y numties 1 (al cadaver) todavia al 60 -->

## What to try next {#despues}

- **Fat prey.** Against a vegetable that photosynthesizes while you eat,
  raise the extraction: the cap is 3000 per cycle, not 1000. And try letting
  go _before_ it dries up completely: the threshold is in the step 6 gene.
- **Eating the corpses.** The −1 only takes energy; with `.tieloc` at −6 you
  take body, and the tied corpse's body is the after-dinner treat. In a long
  run against a field full of algae, our bot ended up buried among the corpses
  of its own prey: they are walls — and by default they don't even rot,
  because [[param:opt:51|Body decay per cycle]] comes at 0. Emptying them with
  the −6 is the cure.
  <!-- .tieloc (-6 cuerpo, sacar 300 por ciclo); 10-CICLO §5 P2 + 33-SHOTS §5 (Decay: cada opt:52 ciclos el cadáver pierde opt:51/10 de cuerpo; con el 0 de fábrica, nada); opciones.js opt:51 (por defecto 0); comprobado: el alga --veg --vegs 3 como primera especie y el alimentador como --otro, 1500x1000, semilla 7, 600 ciclos: ~33 presas vaciadas (nrg 26095) y desde el ~300 atascado entre cadaveres (eye5 32000, refnrg 0); los cuerpos (1004) no se descompusieron en 540 ciclos -->
- **Keeping it from being stolen.** Another feeder can tie to your prey, or to
  you. Slime is the specific defense: above 92 nobody can tie to you, and each
  failed attempt costs them 20. Poison punishes the one who drains. And since
  `.deltie` cuts from either end, a gene that cuts the ties you didn't ask for
  cleans you of parasites — careful: it would also cut the birth tie with your
  child
  ([[simulacion/lazos#nacimiento]], [[simulacion/defensas]]).
- **Paralyzing the prey.** Venom also travels through the tie: `.tieloc` at −3
  leaves it still with your [[.strvenom]], so it doesn't drag itself along with
  you anywhere ([[.tieloc]]).
- **The same mechanism, for good.** Everything you used here to drain someone
  else, a multibot uses to feed its own: a positive `.tieval` passes energy to
  your partner, and [[.sharenrg]] shares it out evenly. Go on with
  [[tutoriales/multibot]] and, for tournament tactics,
  [[estrategias/multibots]].
