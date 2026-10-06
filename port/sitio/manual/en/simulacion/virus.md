---
titulo: Viruses
resumen: "How a bot copies one of its genes into a virus, incubates it and shoots it, where the gene lands in the victim's DNA, how genes are deleted, and what it all costs."
etiquetas: [virus, genes, DNA, delgene, infection]
estado: revisada
---
A _virus_ is a gene packaged into a shot. The bot copies one of its genes,
incubates it for a few cycles and shoots it; if the shot hits another bot, the
gene is inserted into its DNA and from the next cycle on it runs like any other
of its genes. It's the only way to put code into another bot, and the only way,
along with mutations, for a DNA to grow during life.

Four cells are involved: [[.mkvirus]], [[.vtimer]], [[.vshoot]] and
[[.delgene]]. They are grouped in [[sysvars/adn-y-virus]]; this page explains
the complete cycle.

## The life cycle of a virus {#ciclo}
<!-- 35-VIRUS §0-§3; core robots.hpp BotDNAManipulation (fase de movimiento: Vtimer, MakeVirus, Vshoot, delgene) -->

```
 .mkvirus ──► incubation ──► ready ──► .vshoot ──► flight ──► infection
 (gene N)     .vtimer drops  .vtimer    (strength)  random      the gene enters
              by 1           stays at 1             direction   the victim
```

1. **Make.** You write the number of one of your genes into [[.mkvirus]]. The
   engine copies it whole, from its `cond` (or its `start`) to its `stop`.
2. **Incubate.** [[.vtimer]] starts at twice the number of words of the copied
   gene and drops by 1 per cycle. When it reaches 1 it stops: the virus is
   ready.
3. **Shoot.** With the virus ready and a number other than 0 in [[.vshoot]],
   the virus goes out. If you wrote `.vshoot` earlier, the command waits and
   the virus goes out as soon as the incubation ends.
4. **Infect.** If it hits another bot during its flight, it inserts the gene
   into it.

Making and shooting happen in the movement phase, after the DNA has run; the
virus that was shot starts flying in the shots phase of the next cycle, like any other
shot.

## Making {#fabricar}
<!-- 35-VIRUS §0.2, §0.3, §1 (gate Vtimer = 0; mkvirus no se consume; gen inválido no fabrica); core BotDNAManipulation (costo length/2 · DNACOPYCOST · COSTMULTIPLIER); comprobado con probar-adn (--cost 25=1,54=1): un gen de 12 palabras cuesta 12 al fabricar y .vtimer se lee 23 al ciclo siguiente -->

Rules for making:

- **One virus at a time.** While one is incubating or waiting to be shot,
  writing to `.mkvirus` again does nothing.
- **The command isn't cleared on making**, but on shooting: while the virus
  incubates, the cell keeps the gene number.
- **A gene number that doesn't exist** makes nothing. The numbering is the one
  in [[adn/genes#la-numeracion-de-los-genes]].
- **Viruses and photosynthesis don't mix.** If the bot has chloroplasts, the
  command doesn't make the virus and takes all the chloroplasts away from it.
  Since the command stays written, the virus is made in the next cycle.

The copy costs energy according to the gene's length: the DNA copy cost
([[param:cost:25]]) for each word. A long gene is expensive to copy and also
takes longer to incubate: a 12-word gene incubates for 24 cycles.

## Shooting {#disparar}
<!-- 35-VIRUS §2 (energía vshoot·20 con tope 32000; Range = 11 + vshoot/2; dirección Random; velocidad RobSize/3 + actvel; resets); README B3b-1 (un solo cobro); core shots.hpp Vshoot; comprobado con probar-adn (--cost 23=5,54=1): 30 .vshoot cuesta 35 -->

The number you write into [[.vshoot]] is the shot's **strength**. A negative
counts as 1. Three things come out of the strength:

| | With strength F |
|---|---|
| Energy the virus carries | 20 × F (cap 32000) |
| Cycles it flies | 11 + F/2 |
| What the bot pays | F (at most 1600) plus the shot cost ([[param:cost:23]]) |

The virus advances about 40 units per cycle (plus the speed the bot had), so
with strength 30 it flies 26 cycles and travels more than 1000 units: much farther
than an ordinary shot. As it ages it loses energy, like any shot (see
[[simulacion/disparos]]).

What you don't choose is the direction: **it goes out toward a random side**.
Neither [[.aim]] nor [[.aimshoot]] has any influence. That's why bots that live
off viruses don't aim: they shoot when someone is nearby, or all the time.

After the shot, the engine sets `.vshoot`, `.mkvirus` and `.vtimer` to 0, and
the bot is free to make another.

:::nota
In the original DarwinBots, a virus shot was charged twice. In this version
it's charged only once.
:::

## The infection {#infeccion}
<!-- 35-VIRUS §3 (inmunes: corpses; slime; Position = Random(0, genenum); MakeSpace tope 32000; SubSpecies nueva; Mutations +1); README B3b-2, B3b-3; core shots.hpp addgene: power = nrg / (Range·40) < 1 siempre; absorbe si power < slime/20 (slime −= power·20), si no slime = 0; comprobado con probar-adn: una víctima con ~25 de baba no se infecta con fuerza 20 ni con fuerza 1000; los de la misma especie se infectan entre sí -->

When the virus hits a bot, this happens:

1. **Corpses can't be infected.** The virus is lost.
2. **Slime defends.** The virus has a power that comes from the energy it has
   left and how far it has flown. If the bot's slime ([[.slime]]) is enough to
   stop it, the virus is absorbed and the slime is used up a little. If it
   isn't enough, the virus gets through and the slime is used up entirely.
3. **The gene is inserted in a random place.** With a DNA of N genes there are
   N + 1 possible places, all equally likely: before the first gene or right
   after any of them. It never ends up in the middle of a gene.
4. **The victim's DNA really changes.** [[.genes]] and [[.dnalen]] are updated
   on the spot, the infection counts as a mutation and the bot becomes a new
   subspecies (see [[simulacion/especies]]). What its children inherit already
   includes the gene.

A virus's power is always less than 1, and each unit of power is stopped by
20 of slime. In practice, **about 20 of slime stops any virus**, whatever its
strength; with less, the strongest ones get through, and so do those that hit
right after being shot. More about slime in [[simulacion/defensas]].

The virus doesn't tell species apart: a bot doesn't get infected by its own
virus, but it can infect others of its species. A DNA can't go past 32000
words: if the gene doesn't fit, the infection doesn't happen.

Since the gene goes in anywhere, **the genes that came after it shift by one
number**. If the victim uses fixed gene numbers (in `.delgene` or `.mkvirus`),
after an infection they may point to a different gene.

:::nota
In the original, the power was multiplied by the number of the copied gene
(copying gene 7 infected seven times harder than copying gene 1), and going
through a layer of slime strengthened the virus instead of weakening it. This
version fixes both things, which is why slime protects much more than in the
original.
:::

## A virus that spreads by itself {#epidemia}
<!-- 35-VIRUS §3 (el gen inyectado puede contener mkvirus/vshoot); port/web/bots: Coexistence_viral_plant_Apr_2022.txt, Lazy_One.txt (*.thisgene .mkvirus store); comprobado con probar-adn: la víctima empieza a fabricar (su .vtimer deja de valer 0) y paga sus propios disparos -->

The trick for the victim to infect others too is for the gene to package
itself with [[.thisgene]], which holds the number of the gene that's running. That
way it doesn't matter where in the foreign DNA it lands:

```adn
' A gene that packages itself: whoever receives it infects others too
cond
 *.vtimer 0 =
start
 *.thisgene .mkvirus store
 30 .vshoot store
stop
```

<!-- comprobado con probar-adn (epidemia contra una víctima de 2 genes, campo 700x700): la víctima pasa de 2 a 9 genes en 400 ciclos, fabrica y dispara sus propios virus -->
Tested against a two-gene bot, the victim starts making and shooting its own
viruses as soon as it's hit, and in 400 cycles it ends up with several copies
of the gene: each new infection adds another. The energy of each shot is paid
by the victim. Bestiary bots such as _Lazy One_ or _Coexistence viral plant_
(evolved) carry `*.thisgene .mkvirus store` in their genes.

What the virus does depends on what the gene carries. _BodySnatcher_
(k0zm0, 2005), when it sees another bot, shoots it copies of its genes 3 and
4, the ones that convert energy into body and back, so that the victim handles
its body the way it does.

## Deleting genes {#delgene}
<!-- 35-VIRUS §4 (delgene P3, valida 0 < g ≤ genenum; Disqualify); core robots.hpp delgene (sin costo); comprobado con probar-adn: la víctima de este ejemplo queda con .genes 0 y .dnalen 1 -->

[[.delgene]] deletes from the bot's own DNA the gene with that number, whole,
in the movement phase of the same cycle. It costs no energy, and from that
moment the gene doesn't run, doesn't pay upkeep and isn't passed to the
children. A number that doesn't correspond to any gene does nothing. The
classic use is a startup gene that deletes itself with
`*.thisgene .delgene store` (see the `.delgene` page).

Combined with a virus it makes a weapon: a gene that, in the victim, makes it
delete its own genes. So that the same doesn't happen to its maker, the gene
checks a mark that only the maker has:

```adn
' Virus that makes the victim delete its genes
' Gene 1: its own mark and the virus with gene 2
cond
 *.vtimer 0 =
start
 1 90 store
 2 .mkvirus store
 20 .vshoot store
stop
' Gene 2: in whoever lacks the mark, deletes the first gene
cond
 *90 0 =
start
 1 .delgene store
stop
```

In the victim, gene 2 deletes one gene per cycle, starting with the first.
When it has already deleted all the ones before it, it becomes gene 1 itself
and deletes itself. The genes that were after the point where it landed are
safe: if it landed at the end, the victim loses everything; if it landed
first, it only deletes itself. Tested against a two-gene bot, the first
infection deleted one gene; the second landed in front and did nothing to it;
the third took the one that was left, and the victim ended up with no genes at
all: a bot that doesn't think.
<!-- comprobado con probar-adn (victima3 de 2 genes contra borrador.txt, campo 700x700, semilla 1): genes 2 → 1 en el ciclo 93, sin cambio en el 272, 0 en el 381 -->

No shot can write another bot's `.delgene`: memory shots skip it and venom
can't target it. But a tied bot can, with [[.tieloc]] (see
[[simulacion/lazos]]).

## Costs and tournament rules {#costos}
<!-- core BotDNAManipulation, Vshoot (nrg −= tempa/20 + SHOTCOST·mult, tempa = min(20·vshoot, 32000)), delgene; port/README B3b-1; opciones.js opt 93 (nivel 1: virus y lazos con otra especie) -->

| Action | Cost |
|---|---|
| Make | [[param:cost:25]] per word of the copied gene |
| Shoot | The strength plus [[param:cost:23]] |
| Infect | Nothing for the victim, except the slime it uses up |
| Delete a gene | Nothing |

Both parameters are multiplied by the simulation's cost multiplier, like all of
them; the strength you pay when shooting is not. Otherwise, the gene that gets
in weighs on the victim like any other: more DNA means more cost per cycle (see
[[adn/ejecucion]]).

In tournaments, the disqualification option ([[param:opt:93]]) can forbid
viruses and gene deletion; what each level forbids is in that option.
