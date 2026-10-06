---
titulo: Memory (memloc, memval and genetic)
resumen: "The addresses for spying on another bot's memory (through sight or through a tie) and those of genetic memory, the kind that passes from parents to children."
etiquetas: [memory, spying, epigenetics, inheritance]
estado: revisada
---
<!-- 21-MEMORIA §3 (memloc y tmemloc persisten), §5 (memoria genética), §6 (mem 0); sysvars.yaml 473-476; Bestiario: EyeBot_F3_Moonfisher_17-01-2009.txt -->
This group brings together three things that have to do with the bot's memory
beyond its own variables.

**Spying on another's memory.** Two pairs of sysvars let you read any cell of
another bot's memory. With [[.memloc]] you choose the address and in [[.memval]]
what the bot you are looking at holds shows up; with [[.tmemloc]] and
[[.tmemval]] it is the same, but with the bot you are tied to. Both
addresses (`memloc` and `tmemloc`) are configuration: you write them once and
they stay.

The most common use in the Bestiary is recognizing members of your own species:
if you point `.memloc` at [[.dnalen]], `.memval` tells you the length of the
other one's DNA, and you compare it with yours. That is what EyeBot by
Moonfisher does, for example:

```adn
' Only once: spy on the DNA length of the bot I see
cond
*.memloc 0 =
start
.dnalen .memloc store
stop

' If what I see has the same DNA length as mine, cell 50 is 1
cond
*.eye5 0 >
*.memval *.dnalen =
start
1 50 store
stop
```

It is also useful for reading an ally's private variables (its cell 50, for
example) or what the other one sees with its eyes.

**Genetic memory.** Cells 971 to 990 have no name, but the engine copies them
from parent to child: [[sysvars/mem-971-975|971–975]] at birth, and
[[sysvars/mem-976-990|976–990]] one per cycle while the child stays tied to its
parent. Together with the [[.timer]], they are the only part of the memory that is
inherited; the full explanation is in [[adn/memoria#memoria-genetica]].

**Address 0.** The DNA cannot reach it; the engine uses it as a dump for attacks
aimed at [[.delgene]]. See [[sysvars/mem-0]].
