---
titulo: A bot that looks for food
resumen: "The second bot, step by step: the nine eyes, a DNA tournament to head for the eye that sees the most, eating with shots and reproducing when energy is left over."
etiquetas: [tutorial, eyes, hunting, shots, reproduction]
estado: revisada
---
In [[tutoriales/se-mueve]] you finished a bot that roams the world turning at
random: it moves, but it isn't going anywhere. Here we add what it needs to
make a living: eyes to find food, a way to decide which way to go, a way to
eat it and, when it has energy to spare, children.

## Step 1: a world with food {#comida}

The food in DarwinBots is _vegetables_: bots marked as such, which carry
chloroplasts and make energy from the sun
([[simulacion/cloroplastos]]).
<!-- 50-MUNDO §2.2 (feedvegs, el sol); 31-ENERGIA §0.4 -->

1. Open a run; the one from the previous tutorial will do.
2. In **Observe**, click **Seed** on the bottom bar. Under **Bot**, pick the
   **Alga Minimalis (plant)** preset: it marks it as a vegetable by itself and
   suggests 15 copies with 3000 energy. If you seed another DNA, check
   **Plant (photosynthesizes)** by hand.
3. In the same dialog, seed your bot: 5 copies, 3000 energy, a color that
   stands out.
<!-- app/observar #sembrar (DialogoSembrar: preset Alga Minimalis, 15 y 3000 si es vegetal; «Vegetal (hace fotosíntesis)») -->

Two things the simulation does on its own. In the sun phase, at the end of
every cycle, every vegetable with chloroplasts collects its share of the
light. And if vegetables become scarce, every so often it seeds more
([[simulacion/cloroplastos#repoblacion]]). All the energy in the world comes
in through there; your bot is going to live by stealing it from the algae.
<!-- 10-CICLO §2 (… nacimientos y muertes → el sol); 50-MUNDO §2.1, §2.2 -->

## Step 2: the eyes {#ojos}

Your bot has nine eyes, from [[.eye1]] to [[.eye9]], open in a 90-degree fan
around its heading: [[.eye5]] looks straight ahead, the low-numbered ones to
the left and the high-numbered ones to the right, 10 degrees per eye. Each
one is 0 if it sees nothing, and grows the closer what it sees is: 1 at the
edge of its range (about 1440 units from edge to edge), 100 at about 134 and
32000 when they overlap. The full detail is in [[simulacion/vision]].
<!-- 32-VISION §0.2, §0.3, §0.4 -->

To watch them in action, start with a bot that does nothing but turn one eye
per cycle:

```adn
' Turn one eye per cycle, to see what each one sees
cond
start
 35 .aimdx store
stop
```

[[.aimdx]] turns right by whatever amount you write; 35 units are about 10
degrees, exactly one eye. When we ran it next to three vegetables, with one
about 360 units away from edge to edge, the bot's eyes read this:

| Cycle | `.eye1` | `.eye2` | `.eye3` | `.eye4` | `.eye5` | `.eye6` | `.eye7` | `.eye8` | `.eye9` |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 15 | 15 | 15 | 5 | 3 |
| 2 | 0 | 0 | 0 | 15 | 15 | 15 | 5 | 3 | 0 |
| 3 | 0 | 0 | 15 | 15 | 15 | 5 | 3 | 0 | 0 |
| 4 | 0 | 15 | 15 | 15 | 5 | 3 | 0 | 0 | 0 |
| 5 | 15 | 15 | 15 | 5 | 3 | 0 | 0 | 0 | 0 |
| 7 | 15 | 5 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| 9 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The vegetable comes in on the right of the fan, crosses the front and leaves
on the left, one eye per cycle: it is the world that seems to turn, because
it is the bot that turns. The patch of 15 takes up three eyes in a row: a big
blob fills several at once. And a full turn is 36 cycles, so the vegetable
goes through the fan once per turn; the rest of the time, all zeros.
<!-- probado: un bot que solo gira 35 .aimdx contra 3 vegetales quietos, campo 1200×900, semilla 7 (los 15 son unas 360 unidades de borde a borde) -->
<!-- 32-VISION §0.2 (abanico), §0.3 (1/percentdist²), §2.6 (valor de lo más cercano) -->

You see the same thing in the app: seed this bot, click it and look at the
inspector's **Memory** tab: any eye drops to 0 and lights up again as it
turns (see [[app/inspector]]).
<!-- app/inspector (pestaña Memoria, consulta de cualquier celda) -->

## Step 3: the tournament for the eye that sees the most {#maximo}

To head for the food you have to turn toward the eye with the highest reading,
and the DNA has no maximum that compares nine values in one go
([[op:floor]] compares in pairs). The solution is a tournament, with two cells
of [[adn/memoria|free memory]]:
<!-- 20-VM §6.2 (floor = max de a pares; no hay máximo de muchos) -->

- cell **50** holds the best value seen so far;
- cell **51** holds how much you would have to turn for that eye to end up
  facing forward.

The tournament is played again every cycle. First, the table is set to zero:

```adn
' 50 holds the best value seen; 51, the turn to that eye
cond
start
 0 50 store
 0 51 store
stop
```

Then, one gene per eye: if that eye sees more than the best so far, it takes
its place. The one for [[.eye9]], for example:

```adn
' If eye 9 sees more than the best so far, take its place
cond
 *.eye9 *50 >
start
 *.eye9 50 store
 140 51 store
stop
```

The 140 it stores is the turn that centers eye 9: with 35 units per eye, the
eyes are at 35, 70, 105 and 140 from the front. The gene for [[.eye1]] stores
−140, the one for [[.eye2]] −105… and the one for [[.eye5]], 0: if what sees
the most is the front eye, there is nothing to turn.

The comparison is a plain [[op:>]], not “greater or equal”: if several eyes
tie, the first one to reach that value wins, the one with the lowest number.
And since the start gene leaves cell 50 at 0, that same cell will serve you as
the “do I see anything?” question in the next step.

The nine genes — one per eye, identical except for the number and the turn —
are in the complete bot at the end: the tournament always leaves what is seen
the most in 50, and which way to turn in 51.
<!-- probado: la celda 51 queda en −140, 70, 35… según de qué lado esté la comida (corridas del paso siguiente) -->

## Step 4: turning and moving forward {#girar}

Three more genes and the bot is already searching:

```adn
' Turn toward the eye that sees the most
cond
 *51 0 !=
start
 *51 .aimdx store
stop

' Always move forward
cond
start
 10 .up store
stop

' Nothing in sight: turn at random so the fan sweeps
cond
 *50 0 =
start
 314 rnd .aimdx store
stop
```

- The first gene turns whatever cell 51 says. A negative number in
  [[.aimdx]] turns left, so the same gene works for both sides.
- The second is the forward movement from the previous tutorial.
- The third searches: while it sees nothing, it turns up to a quarter turn at
  random every cycle, so the fan keeps sweeping every direction while it
  walks. As soon as an eye sees something, the tournament takes over.

When we ran it, the correction looks like this cycle by cycle (a vegetable
coming in from the right):

| Cycle | What the DNA read (eye 9 / eye 5) | Turn command |
|---|---|---|
| 42 | nothing yet | — |
| 43 | 1072 / 0 | 70 to the right |
| 44 | 4814 / 0 | 35 to the right |
| 45 | 32000 / 32000 | 0: straight on, it has it in front |

Two things to read correctly in that table. Each cycle's command answers to
the previous cycle's eyes: vision is computed in the _actions_ phase, with the
final positions, and your DNA only reads it in the next cycle
([[adn/ejecucion#retraso]]). And in cycle 43 the turn is 70 and not 140: eyes
7, 8 and 9 had tied at 1072 and 7 won, the first of the tied ones.
<!-- 32-VISION §0.1 (la vista se calcula en acciones; llega al ciclo siguiente) -->
<!-- probado: el mismo bot del paso 5 contra 3 vegetales, campo 1200×900, semilla 5: el ojo 9 marca 1072 en el ciclo 42 (empatado en 7, 8 y 9) → en el 43 la celda 51 vale 70; 4814 en el 43 → 35 en el 44; 32000 en el frente → 0 -->

What you should see: the bot turns at random until the food enters the fan;
then it turns toward it, gets right up against it and, since it always moves
forward, pushes it. In our runs, the first vegetable it found ended up cornered
against a wall. It doesn't know how to eat yet: the vegetable's energy doesn't
go down (in the app it even goes up, slowly, as long as the sun shines on it).
That is what comes next.
<!-- probado: el bot guía (torneo más estos tres genes) contra 3 vegetales, semilla 11: encara al primero en 5 ciclos y lo empuja hasta arrinconarlo -->

## Step 5: eating {#comer}

A vegetable is not eaten by touching it: your bot has no mouth. It is eaten
with shots. The −1 shot is an _energy request_: when it hits a live bot, the
victim loses 90% of the hit's strength as energy and another 1% as body, and
from the point of impact a gift shot carrying the loot flies back toward the
shooter. On arrival, the shooter keeps 95% as energy, a little as body and a
1% that turns into waste for it ([[simulacion/disparos#energia]]). With about
1000 body, each shot takes about 200 from the vegetable and gives you about
210.
<!-- 33-SHOTS §5 (releasenrg: 90 % nrg, 1 % body, regalo −2; takenrg: 95 % nrg, 4 % body, 1 % waste); probado en [[simulacion/disparos#energia]] con 1000 de cuerpo: −198 / +209 -->

The gene:

```adn
' Food close, ahead: ask it for energy with a shot
cond
 *.eye5 50 >
start
 -1 .shoot store
stop
```

You shoot only when the front eye is over 50, that is, when the food is less
than about 200 units away from edge to edge (the eye's 100 is 134). That is a
safe shooting distance: the shot of a 1000-body bot flies about 440 and loses
strength along the way, so from afar it arrives empty. It is also the same
threshold as the Bestiary's _Animal Minimalis_.
<!-- 32-VISION §0.3 (100 a 134); 33-SHOTS §2.2 (alcance Log(vbody)·60), §3.4 (decaimiento en el vuelo); Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (*.eye5 50 > → −1 .shoot store) -->

When we ran it, the vegetable fell from 3000 to 28 energy in 40 cycles and
died; the hunter, meanwhile, went from 3000 to over 6100. While it eats, it
pushes the vegetable against the wall, so the victim can't get away. If the
vegetable has no energy left, it dies and leaves a corpse
([[simulacion/muerte]]); the −1 no longer takes anything from the corpse,
because it has no energy anymore. To empty bodies there is the −6 shot
([[simulacion/disparos#cuerpo]]).
<!-- probado: el bot de los pasos 3–5 contra 3 vegetales de 3000, campo 1200×900, semilla 11: la primera víctima baja a 28 en 40 ciclos y muere; el cazador sube a 6136 -->

## Step 6: the complete bot {#el-bot}

The cycle already sustains itself: search, get closer, eat. Only the last part
is missing: when energy is left over, have children. This is the whole bot:

```adn
' A bot that looks for food
' 50 = the highest value seen this pass; 51 = turn toward that eye

' Start every cycle with no candidate
cond
start
 0 50 store
 0 51 store
stop

' Eye by eye: if it sees more than the best so far, take its place
cond
 *.eye1 *50 >
start
 *.eye1 50 store
 -140 51 store
stop

cond
 *.eye2 *50 >
start
 *.eye2 50 store
 -105 51 store
stop

cond
 *.eye3 *50 >
start
 *.eye3 50 store
 -70 51 store
stop

cond
 *.eye4 *50 >
start
 *.eye4 50 store
 -35 51 store
stop

cond
 *.eye5 *50 >
start
 *.eye5 50 store
 0 51 store
stop

cond
 *.eye6 *50 >
start
 *.eye6 50 store
 35 51 store
stop

cond
 *.eye7 *50 >
start
 *.eye7 50 store
 70 51 store
stop

cond
 *.eye8 *50 >
start
 *.eye8 50 store
 105 51 store
stop

cond
 *.eye9 *50 >
start
 *.eye9 50 store
 140 51 store
stop

' Turn toward the eye that sees the most
cond
 *51 0 !=
start
 *51 .aimdx store
stop

' Always move forward
cond
start
 10 .up store
stop

' Nothing in sight: turn at random so the fan sweeps
cond
 *50 0 =
start
 314 rnd .aimdx store
stop

' Food close, ahead: shoot it to eat
cond
 *.eye5 50 >
start
 -1 .shoot store
stop

' Energy to spare: have a child
cond
 *.nrg 5000 >
start
 30 .repro store
stop
end
```

The new gene says: with more than 5000 energy, a child that takes 30%
([[.repro]]). You are born with 3000, so 5000 means “I ate more than enough”:
from a parent at 5400, the child is born with about 1600 and the parent ends
at about 3800. The child carries the same DNA and hunts just like the parent.
<!-- 36-REPRO §2 (per = 30 %: nrg y body al hijo, 0,1 % de impuesto); sysvars/repro (30 % de 3000/1000 → 899/300 y 2099/700) -->

The 200-cycle run, against four vegetables: it crossed 5000 at cycle 40, but
the child was only born around 90. The birth needs free room ahead of the
parent, where it is aiming; if it is occupied, the command stays written and
is retried every cycle, and your bot lives stuck to its food and to the
walls. At 200 cycles the
parent was at 7100 with another birth pending, and the child — born with about
1600 — had already eaten its way up to 3000. In the app, the birth shows up as
a flash next to the parent, and the generation jumps of your lineage appear
in **Events**.
<!-- 36-REPRO §0.4 (la orden no se consume si el parto falla), §2 (colisión en el punto de parto); app/observar #eventos (generación récord); web2/src/lib/mundo/render-enriquecido.js (nacimiento: destello + línea a la madre) -->
<!-- probado: el bot completo contra 4 vegetales de 3000, campo 1200×900, semilla 11, 200 ciclos: cruza 5000 en el 40, el parto sale cerca del 90 (5→6 bots), el hijo llega a 3024 y el padre a 7189 -->

The Bestiary's _Animal Minimalis_ is this same bot with fewer pieces: it only
looks at the front eye; while it sees nothing it turns at random; when
[[.eye5]] goes over 50, it shoots; and at 20000 energy it reproduces with 10%.
It also has a detail ours lacks: before shooting, it checks that what it sees
is not of its own species. A good starting point for what follows.
<!-- Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (gira con 314 rnd .aimdx si *.eye5 0 =; dispara con *.eye5 50 > y *.refeye *.myeye !=; 10 .repro con *.nrg 20000 >) -->

## What to try next {#despues}

- **Shoot only at outsiders.** Right now your bot asks for energy from
  anything in front of it, whether a vegetable or a relative. The `ref*` cells
  say what the focus eye is looking at: the classic test is to compare
  [[.refeye]] with your [[.myeye]]. The step by step is in [[tutoriales/dispara]]
  and in [[tutoriales/reconoce-especie]].
  <!-- 32-VISION §2 (firma del ADN: refeye/myeye) -->
- **Eating corpses.** Your −1 no longer takes anything from a corpse; the −6
  empties its body and is the most profitable shot. Seed few vegetables and
  make your bot clean up the field: it takes another gene and another
  threshold.
  <!-- 33-SHOTS §5 (releasebod: cadáver ×4, todo de body) -->
- **The night.** With the day and night clock on, at night the eyes see 20%
  less and vegetables don't make energy. Does your bot find the food all the
  same when everything is darker and thinner?
  ([[simulacion/cloroplastos#dia-y-noche]], [[simulacion/vision#alcance]])
  <!-- 32-VISION §0.4 (noche: 20 % menos alcance); 50-MUNDO §2.2 (de noche no toca comer) -->
- **Panoramic eyes.** The fan leaves a 270-degree blind spot: food that comes
  in from behind shows up only once you have already passed it. A very wide eye
  sees very little but in every direction: the idea is in
  [[simulacion/vision#ancho]].
  <!-- 32-VISION §0.2, §0.4 (width: más ancho, menos alcance) -->
