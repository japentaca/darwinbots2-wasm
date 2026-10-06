---
titulo: Free and epigenetic memory
resumen: "The map of a bot's 1000 memory cells: which ones the engine uses, which ones are yours, what gets cleared on its own and what is passed on to children."
etiquetas: [memory, variables, epigenetics, inheritance, mem]
estado: revisada
---
Every bot has a memory of 1000 cells, numbered 1 to 1000. Each cell holds an integer; whatever the DNA writes always ends up between −32000 and 32000 (see [[adn/stores]]). Some cells have a name and the engine uses them to talk to the bot (these are the _sysvars_); the rest are yours. This page is the map.

## The map from 1 to 1000 {#mapa}
<!-- 21-MEMORIA §1-§2; sysvars.yaml (huecos_sin_nombre: 304-309 libres) -->

The named cells are grouped by topic. The full list, with what each one does, is in [[sysvars/todas]].

| Cells | What is there | Group |
|---|---|---|
| 1–12, 18–19 | Movement and shooting commands, age, mass, [[.timer]] | [[sysvars/movimiento]], [[sysvars/cuerpo]] |
| 194–221 | What happened in the cycle: speed, collisions, flavors, edge, position, day (nobody writes cell 221: see below) | [[sysvars/contacto]], [[sysvars/posicion]] |
| 300–303, 310–315 | Reproduction, energy, body | [[sysvars/reproduccion]], [[sysvars/cuerpo]] |
| 330–331, 335–341 | Ties, DNA and viruses | [[sysvars/adn-y-virus]] |
| 400–402 | Sun and bot count | [[sysvars/posicion]] |
| 410–429, 800–819 | Communication channels | [[sysvars/entradas-salidas]] |
| 437–487 | Ties and what is felt through them | [[sysvars/lazos]], [[sysvars/tref]] |
| 501–539 | Eyes and their configuration | [[sysvars/ojos]] |
| 685–715 | What the central eye sees | [[sysvars/ref]] |
| 721–731 | The bot's own signature | [[sysvars/my]] |
| 820–839 | Defenses and waste | [[sysvars/defensas]] |
| 900–901, 920–924 | Backward shot, chloroplasts | [[sysvars/disparos]], [[sysvars/cloroplastos]] |
| 971–990 | Genetic memory, unnamed | [[sysvars/mem-971-975]], [[sysvars/mem-976-990]] |

## Free memory {#memoria-libre}
<!-- sysvars.yaml huecos_sin_nombre; 21-MEMORIA §0.2, §2, §9.6 (hitang sin escritor) -->

More than 700 cells have no name and the engine never touches them. They are these:

> 13–17, 20–193, 222–299, 304–309, 316–329, 332–334, 342–399, 403–409, 430–436, 472, 500, 512–520, 530, 540–684, 691–694, 700, 716–720, 732–799, 840–899, 902–919, 925–970, 991–1000

The 20–193 range is the classic place for your own variables: most bots in the Bestiary put their [[adn/def|def]] variables at 50, 51, 52… What you store in a free cell stays there for the bot's whole life, until you change it. It is also saved along with the simulation.

Cell 221 has a name ([[.hitang]]), but in DarwinBots 2.48.32 nothing ever writes to it: in practice it is just one more free cell.

### Named cells are no good for storing things {#las-celdas-con-nombre-no-sirven-para-guardar}
<!-- 21-MEMORIA §3 régimen B (nrg se publica cada ciclo) -->

If you write to a cell the engine uses, the engine overwrites it. Look at this bot:

```adn
' The .nrg cell is no good for storing anything
def antes 60
def libre 61

cond
start
*.nrg .antes store
1 .nrg store
1 .libre store
stop
```

When you run it, [[.nrg]] goes back to holding the real energy (3000) every cycle (except the first, where a freshly seeded bot still reads it as 0), and that is what cell 60 copies on the next cycle: the `1` was lost. Cell 61, on the other hand, keeps its `1`. Writing to `.nrg` doesn't change the bot's energy either: it is just a number the engine publishes.

### Who else can write to your free memory {#quien-mas-puede-escribir-tu-memoria-libre}
<!-- 21-MEMORIA §2 (altzheimer, shots de memoria), §4 (tieportcom, venom/poison) -->

“Free” means the engine doesn't use it, not that it is safe. There are four ways it can be changed from outside:

- **Memory shots.** Another bot can shoot you a value that gets written to any address in your memory (see [[simulacion/disparos]]).
- **Ties.** A bot tied to you can write to any cell of yours with [[.tieloc]] and [[.tieval]] (see [[simulacion/lazos]]).
- **Venom and poison.** While the effect lasts, they write every cycle to the cell the attacker chose with [[.vloc]] or [[.ploc]] (see [[simulacion/defensas]]).
- **Excess waste.** When the accumulated [[.waste]] passes a threshold, the engine writes random values to random cells across the whole memory (see [[simulacion/energia]]).

## What the engine clears, and when {#que-borra}
<!-- 21-MEMORIA §3 (regímenes A, B, C y excepciones); 10-CICLO §2 -->

The DNA runs in the middle of the cycle; almost everything else (physics, vision, shots) happens afterwards (see [[simulacion/ciclo]]). That gives four behaviors:

| Type of cell | Examples | What happens |
|---|---|---|
| Senses | [[.eye5]], [[.edge]], [[.refxpos]] | The engine writes them after the DNA; your DNA reads them in the next cycle and they are cleared right afterwards. They always arrive one cycle late. |
| Published data | [[.nrg]], [[.body]], [[.robage]], [[.aim]] | The engine rewrites them every cycle. Whatever you store there is lost. |
| Commands | [[.up]], [[.shoot]], [[.aimdx]] | You write them; the engine carries them out and sets them to 0 in the same cycle. |
| Configuration | [[.focuseye]], [[.eye5dir]], [[.memloc]], [[.out1]] | The engine reads them but doesn't clear them: they hold until you change them. |

Some commands are not always cleared, and it is worth knowing which:

- [[.repro]] (and [[.mrepro]], [[.sexrepro]]) is set to 0 only if the child is born. If reproduction can't happen, the value stays and is retried every cycle.
- A negative [[.strbody]] or [[.fdbody]] is cleared with no effect (in the original DarwinBots they stayed there forever).
- [[.shootval]] is cleared only when you actually shoot.
- [[.fixang]], [[.fixlen]] and [[.stifftie]] are cleared only if you have a tie selected with [[.tienum]]; otherwise they stay.

## At birth {#al-nacer}
<!-- 21-MEMORIA §2, §5; sysvars.yaml meta.al_nacer (Erase de mem, timer y 971-975 del padre) -->

A child is born with its entire memory at 0. Then the engine fills in its own part (the energy, the DNA length, the number of genes and a few more) and passes two things on from the parent: the [[.timer]], which keeps counting from the parent's value, and the genetic memory. The variables in your free memory **are not inherited**: the child starts with them at 0.

## Genetic memory (971–990) {#memoria-genetica}
<!-- 21-MEMORIA §5 (971-975 instantáneas; 976-990 por epimem, una por ciclo con age < 15, con tie de nacimiento y celda en 0; el padre pierde su epimem; epireset; UseEpiGene); core sim.hpp (epireset y UseEpiGene en false) -->

Cells 971 to 990 have no name, but the engine treats them differently: they are the only memory bridge between a bot and its children. There are two zones.

**971–975, instant.** At birth, the child gets a copy of those five cells from the parent. They are already there in its first cycle of life. See [[sysvars/mem-971-975]].

**976–990, deferred.** At birth, the parent's fifteen cells are set aside in a reserve belonging to the child, and they reach it one per cycle, in order: first 976, then 977, and so on up to 990, about fifteen cycles after birth. Each delivery has two conditions:

- the child must still be tied to its parent by the birth tie; if it breaks it, or if it replaces it by tying to the parent again with [[.tie]] (the usual case in multicellular organisms), the remaining deliveries are lost;
- the child's cell must still be 0; if the child has already written something there, the delivery doesn't overwrite it.

See [[sysvars/mem-976-990]].

This bot counts generations in cell 971:

```adn
' Counts generations in genetic memory
def generacion 971
def listo 50

' Once in a lifetime: adds 1 to what I inherited
cond
*.listo 0 =
start
.generacion inc
1 .listo store
stop

' Reproduces at 10 cycles of life
cond
*.robage 10 =
start
50 .repro store
stop
```

The founder sets 971 to 1. Its child is born with 971 = 1 (instant copy) and raises it to 2 in its first cycle. The flag in cell 50 keeps it from adding more than once, and it works precisely because cell 50 is **not** inherited: the child gets it at 0.

A few more details:

- In sexual reproduction, the genetic memory comes from the mother (see [[simulacion/reproduccion]]).
- If a bot that was still receiving its own deferred inheritance has a child, the deliveries it was missing are lost.
- The engine also has an _epigenetic reset_, tied to [[simulacion/mutaciones]], which makes the child be born without genetic memory when the lineage has accumulated enough mutations. It ships turned off and the app doesn't let you turn it on.
- With an option, the original DarwinBots could save the values of 971–990 in a bot's `.txt`, as an extra gene at the start of the DNA that restores the cells in the first cycle and deletes itself with [[.delgene]]. The app doesn't add that gene when exporting (see [[adn/formato#exportar]]).

## Address 0 {#la-direccion-0}
<!-- 20-VM §0.6, §7; 21-MEMORIA §6; sysvars.yaml mem_cero -->

The DNA can't reach a cell 0: every address is adjusted into the range 1..1000,
and when reading, 0 falls on 1000 (`*0` and `0 *` read cell 1000). A store to
address 0 does nothing. The rules, with examples, are in
[[adn/numeros#fuera]] and [[adn/numeros#cero]].

Internally a cell 0 does exist, but only the engine uses it, as a dumping ground: if a venom or poison attack aims at 340 ([[.delgene]], the one that deletes genes), the hit is diverted to cell 0 so it can't delete anyone's genes. Nobody reads it. See [[sysvars/mem-0]].
