---
titulo: A bot that shoots
resumen: "Step by step to a complete hunter: turn until it sees, aim with the ref* cells, shoot at close range and reinvest the energy in children."
etiquetas: [tutorial, shots, hunting, aiming, reproduction]
estado: revisada
---
In [[tutoriales/se-mueve]] you wrote a bot that moves forward and turns, and
in [[tutoriales/busca-comida]] you gave it eyes to find food. This tutorial
adds what a hunter is missing: aiming and shooting. At the end you have a bot
that sees, chases, steals energy from a distance and, with what it gains,
reproduces.

## Step 1: the target and the hunter {#blanco}

<!-- i18n/es/bots.json (bots.nuevo «+ Nuevo bot», sembrar); app/bots.md #nuevo #sembrar (ficha → Sembrar; «Sembrar en la corrida actual» / «Nuevo escenario con estos») -->

A hunter without prey isn't noticeable, so we start with the two species. Go
to **Bots** and create two bots with **+ New bot**: "Hunter" and "Target". Give
the Target an empty gene, so it stays still:

```adn
' Practice target: does nothing
cond
start
stop
```

We will write the Hunter's DNA in the steps that follow. Then seed the Hunter
in a new scenario (on its profile, **Seed** → **New scenario with these**) and
the Target in that same run (**Seed into the current run**), with **Number of
bots** at 1 for each and very different colors.

To look closely, click a bot: the inspector lets you follow its energy cycle
by cycle ([[app/inspector]]).

## Step 2: turning until it sees it {#girar}

<!-- 32-VISION §0.2 (abanico: eye5 adelante, 35 unidades por ojo), §0.3; probado: giro.txt contra blanco.txt, semilla 1 (gira 35 por ciclo, ve al blanco en el ciclo 8 y se frena apuntándolo, aim 1136) -->

[[.eye5]] is the front eye: it is 0 if there is nothing ahead and grows the
closer what it sees is. The simplest gene for searching is to turn while that
eye sees nothing:

```adn
' Nothing in sight: turn to search
cond
 *.eye5 0 =
start
 35 .aimdx store
stop
```

[[.aimdx]] turns right by the amount you write to it. With 35 per cycle it
turns exactly one eye at a time: what enters through [[.eye4]] today moves to
the front one in the next cycle. That way it sweeps the front from side to
side.

What you should see: the Hunter spins in place and at some point it stops,
still, looking at the Target. In our run it turned for eight cycles until the
other one entered through its front eye, at about 650 units from edge to edge,
and there it stayed, aiming at it. If it sees nothing in 360 degrees, it keeps
spinning forever.

## Step 3: aiming straight at it {#apuntar}

<!-- 32-VISION §2.6 (el ojo con foco llena las ref*; si no ve nada, valen 0), §4; sysvars .refxpos/.refypos; 20-VM §6.2 (angle); probado: apunta.txt contra caminante.txt (el bot de se-mueve), semilla 1: mantiene al blanco en eye5 mientras lo persigue; y sin nada a la vista: las ref* valen 0 y un bot que apunta a ciegas clava el rumbo hacia la esquina (0, 0) (aim 501 desde (1496, 1107), campo 4000×3000) -->

Turning in steps finds, but doesn't chase: if the target moves, it slips out
of the front eye, which is narrow. To really aim you need to know _where_ it
is, and that is what the `ref*` cells give: what the focus eye sees is
described in them ([[simulacion/vision]]). The other bot's position is in
[[.refxpos]] and [[.refypos]]; the [[op:angle]] operator turns those two
coordinates into the heading toward that point, and [[.setaim]] turns to that
heading. All together in one gene, which also pushes forward to get closer:

```adn
' If I see something: aim at it and get closer
cond
 *.eye5 0 >
start
 *.refxpos *.refypos angle .setaim store
 10 .up store
stop
```

Note that the condition is `*.eye5 0 >` and not "I see something with any
eye": the `ref*` describe what the focus eye sees, and if that eye sees
nothing they are 0 — you would aim at the corner (0, 0) of the field.

What you should see: the Hunter locks its heading on the target and moves
toward it, correcting every cycle. In our run, against a target that was
moving sideways, it kept it in the front eye for the whole trip, never losing
it.

## Step 4: shooting at close range {#disparar}

<!-- 33-SHOTS §2.1 (el −1 pide energía; value = 20 + body/5), §5 (releasenrg: el golpeado pierde y un −2 vuelve hacia el tirador); probado: paso2.txt (disparando a eye5 5, a ~650, no pasa nada), caza50.txt contra blanco.txt, semilla 1 (empieza a cobrar al ciclo 25, más de 200 por ciclo, blanco muerto antes del 40, cazador 3000 → 6164) -->

Here comes the part in the title. Writing a number to [[.shoot]] shoots, and
the number picks the type: **−1** is the one that eats: it takes energy from
the target, and a gift with the loot flies back to you, feeding you when it
arrives ([[simulacion/disparos#energia]]). The engine launches the shot in the
_actions_ phase of the same cycle, toward where your heading points.

Now, when to shoot? Not as soon as you see it. Shots lose strength with
distance and die at the end of their range, which with 1000 body reaches
about 440 ([[simulacion/disparos#alcance]]). In our run, with the target at
about 650 units from edge to edge (an `eye5` of 5), the Hunter rained shots
that vanished along the way without touching anyone. Shoot only up close:

```adn
' I have it close and ahead: shoot
cond
 *.eye5 50 >
start
 -1 .shoot store
stop
```

An `eye5` of 50 is about 200 from edge to edge: at that distance the shot
arrives with almost all its strength. It is the same threshold _Hunter 2.16_,
from the Bestiary, uses.
<!-- Bestiario: Hunter_2.16_F2_PY_-23.02.05.txt, gen «shoot at enemy» (*.eye5 50 > → -1 .shoot store) -->

What you should see: in the inspector, the Target's energy goes down cycle by
cycle while the Hunter shoots, and the Hunter's goes up. In our run, as soon as
it crossed the close-range threshold, the target started losing more than 200
per cycle and by the fifteenth it was dead; the hunter had gone from 3000 to
over 6000 energy.

Two more adjustments, for when you need them:

- **The cost.** Every shot has a price ([[param:cost:23]]: 2 in the F1
  league), but in the built-in scenarios, except the F1 match, costs are at 0:
  here shooting is free. In the F1, each shot comes out of your energy
  ([[app/experimentar]]).
  <!-- simulacion/energia #mantenimiento (escenarios de fábrica salvo F1 con costos 0); opciones.js preset F1 (cost:23 = 2; por defecto 0) -->
- **The power.** [[.shootval]] multiplies the strength of the −1: with 8 it
  doubles it, and it is charged like a more expensive shot. You don't need it
  to get started.

## Step 5: spending the gain on children {#reproducirse}

<!-- 36-REPRO §2 (30 %: hijo 899,1/300 de 3000/1000; persiste hasta el éxito); probado: final5000.txt contra caminante.txt, campo 1500x1000, semilla 1 (primera caza: 6164; parto: padre 3952 nrg / 705 body, hijo 2228 / 306); con el umbral en 6000 nunca se reproducía (máximo 5955) -->

A hunter that gathers energy and does nothing with it isn't going anywhere.
The command to split is [[.repro]]: the number is the percentage of energy,
body and chloroplasts that the child takes. With the energy a good hunt
leaves, a threshold of 5000 works well:

```adn
' With energy to spare: a child
cond
 *.nrg 5000 >
start
 30 .repro store
stop
```

The 30% leaves the child with almost a third and the parent with most of it,
to keep hunting. Two things worth knowing ([[.repro]],
[[simulacion/reproduccion]]):

- The command **persists until the child is born**: if the birth fails — for
  example, because there is no room where the young one has to appear — it is
  retried by itself every cycle.
- The child **inherits the DNA**: a few cycles after being born it already
  searches and shoots like the parent.

Why 5000 and not more: a single prey of 3000 leaves the hunter hovering around
6000. With the threshold at 6000, in our run it missed the cutoff by 45 energy
and never reproduced; with 5000, as soon as it killed its first prey the child
was born: the parent was left with about 3950 energy and 700 body, the child
started with about 2230 and 300.

:::cuidado
Your hunter doesn't tell its own apart: a −1 steals energy from any bot,
including its family ([[simulacion/disparos#impacto]]); only the newborn is
safe from its parent's shots during its first cycles. In our run, parent and
child ended up stuck together shooting each other: in ten cycles the child
had gained about 770 and the parent lost about 730. The cure is to recognize
those of your species, and that is precisely the next tutorial:
[[tutoriales/reconoce-especie]].
<!-- probado: final5000.txt, ciclos 60-70 (hijo +770, padre −729); 33-SHOTS §5 (no hay fuego amigo); port/README B3-1 (inmunidad filial corregida: solo los primeros ciclos) -->
:::

## The complete hunter {#el-bot}

Here it is all together, the four genes. Copy it into the editor and seed it
against anything that moves.

<!-- probado: final5000.txt contra caminante.txt, campo 1500x1000, semilla 1, 200 ciclos: caza al caminante en ~50 ciclos, primer parto, hijo caníbal, segundo parto al ~170; lint sin avisos -->

```adn
' Hunter: searches, aims, shoots and reproduces

' Gene 1: nothing in sight, turn to search
cond
 *.eye5 0 =
start
 35 .aimdx store
stop

' Gene 2: if I see something, aim at it and get closer
cond
 *.eye5 0 >
start
 *.refxpos *.refypos angle .setaim store
 10 .up store
stop

' Gene 3: I have it close and ahead: shoot
cond
 *.eye5 50 >
start
 -1 .shoot store
stop

' Gene 4: with energy to spare, a child
cond
 *.nrg 5000 >
start
 30 .repro store
stop
end
```

What you should see: the hunter sweeps with its sight, draws a bead on the
first prey, chases it while shooting and, when energy is left over, splits. In
our run against a single moving target it hunted it down in about fifty
cycles, had two children, and then the family was left spinning in place,
robbing each other of what was left — with no new food, a hunter ends up
turning against its own. Seed more prey, or vegetables with repopulation
([[param:base:minVegs]]), and watch the herd grow.
<!-- probado: final5000.txt, semilla 1: el caminante muerto antes del ciclo 50; bots de la especie: 1 → 2 (ciclo 60) → 3 (ciclo 170) -->

## What to try next {#despues}

<!-- 33-SHOTS §5 (releasenrg: al cadáver, con nrg 0, no le saca nada; releasebod: el −6 sobre cadáver ×4 y todo de body; takeven: el −3 paraliza y escribe Vloc/Vval); 31-ENERGIA §0.3 (caparazón, baba, veneno y toxina) -->

- **Eating corpses.** The −1 takes nothing from the dead, but the −6 steals
  body from them and is the most profitable shot against any target
  ([[simulacion/disparos#cuerpo]]).
- **Venom and defenses.** With −3 you paralyze the target and write to its
  memory; on the other side, shell, slime, poison and venom are the ways to
  keep this from being done to you ([[simulacion/defensas]]).
- **Not shooting your own.** Comparing the other's signature with yours
  ([[.refeye]] against [[.myeye]]) is the natural improvement to this bot:
  [[tutoriales/reconoce-especie]].
- **Hunting with costs.** In the F1 match every shot costs and the prey
  defend themselves too: the same tactic needs thresholds and a budget
  ([[app/experimentar]]).
