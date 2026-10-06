---
titulo: Glossary
resumen: "The terms used in this manual, each with a short definition and a link to the page that explains it."
etiquetas: [glossary, terms, vocabulary, reference]
estado: revisada
---
The words this manual uses, with the page where each one is explained. The
named memory addresses (such as [[.nrg]] or [[.shoot]]) each have their own
profile in the [[sysvars/todas|sysvars reference]], and the DNA words (such as
[[op:store]] or [[op:add]]) in the [[operadores/todos|operators reference]].

<!-- Términos tomados de los capítulos 3-6 (simulacion/*, adn/*, sysvars, operadores) y de los textos de la app (i18n/es). Toxina = poison, veneno = venom, caparazón = shell, baba = slime (PLAN-SITIO.md). Revisor: cada definición se contrastó con la sección de los capítulos 3-6 que enlaza (defensas, energia#shock, muerte#cadaveres, mundo#obstaculos, lazos#multicelulares, especies#linaje, adn/memoria#memoria-genetica, sysvars/my); Bestiario: web/bots/bots.json, 684 entradas. -->
<!-- En inglés el glosario va en orden alfabético del inglés (no del castellano): las letras y las entradas cambian; los enlaces a #ancla de esta página no existen en ninguna otra. -->

## A {#a}

**Animal.** In the app, any bot that isn't a vegetable: if it doesn't make its
own chloroplasts, it has to take its energy from another bot. See
[[simulacion/cloroplastos#vegetales]].

## B {#b}

**Base.** The set of values a scenario starts from: _Classic_ (no costs, a
32000 × 32000 field) or _F1 league_. A scenario's changes are counted against
the base. See [[app/escenarios]].

**Bestiary.** The collection of 684 community bots from the DarwinBots forum
and wiki that the app ships in its library. See [[app/bots]].

**Body.** A bot's reserve that doesn't get spent on its own: it makes the bot
bigger and heavier, and it can be turned into energy and back. See
[[simulacion/energia#cuerpo]] and [[.body]].

**Bot.** Each organism in the simulation: a circle with energy, a body, its own
memory and a DNA that decides what it does. See [[empezar/que-es]].

## C {#c}

**Chloroplast.** What lets a bot live on light. Up to a point, the more it has,
the more energy it gets from the sun, but they also weigh it down. You buy them
with [[.mkchlr]]. See [[simulacion/cloroplastos]].

**Condition.** What goes between `cond` and `start` in a gene: comparisons that
decide whether the gene runs. See [[adn/genes]] and [[adn/condiciones]].

**Corpse.** What's left of a bot that died without energy, if corpses are
turned on: it doesn't think or move on its own, but it keeps its body, which
others can eat. See [[simulacion/muerte#cadaveres]].

**Costs.** What the world charges a bot, in energy, for thinking, moving,
shooting, having a body or a long DNA. In the _Classic_ base they are 0; in the
_F1 league_ they are not. See [[simulacion/mundo#costos]] and
[[adn/ejecucion#costos]].

**Cycle.** One step of the simulation. In each one the DNA of every bot runs
and the world responds, always in the same order: DNA, senses cleared, shots,
forces and collisions, movement, actions, births and deaths, the sun. See
[[simulacion/ciclo]].

## D {#d}

**def.** The way to give a number a name of its own in the DNA, for example a
free memory location. See [[adn/def]].

**DNA.** A bot's program: a list of words (numbers, sysvars and operators)
organized into genes, which the bot runs in full every cycle. It is saved as a
text file. See [[adn/estructura]].

## E {#e}

**Edges.** What happens at the limit of the field: they can be walls, or
connected sides (what leaves through one comes in through the other). See
[[simulacion/mundo#bordes]].

**Energy** (_nrg_). What keeps a bot alive: it pays for everything with it, and
when it runs out, the bot dies. See [[simulacion/energia]] and [[.nrg]].

**Eye.** Each of a bot's nine vision senses, from [[.eye1]] to [[.eye9]]: they
tell how close what they see is. See [[simulacion/vision]].

## F {#f}

**Founder.** The seeded bot a lineage descends from. The app compares each
species' dominant DNA with its founder's. See [[simulacion/especies#linaje]].

## G {#g}

**Gene.** A block of DNA that starts with `cond` or `start` and ends with
`stop`: if its conditions are met, it does what its body says. See
[[adn/genes]].

**Generation.** How many births separate a bot from its founder: seeded bots
are generation 0, their children generation 1, and so on. See
[[simulacion/especies#linaje]].

**Genetic distance.** How much the DNA of two bots differs. The app can color
the world by the distance to the selected bot. See
[[simulacion/especies#distancia]].

**Genetic memory.** Positions 971 to 990, the only memory bridge between a bot
and its children: at birth, the child receives its parent's (the first five
instantly and the rest one per cycle, as long as it stays tied to it). See
[[adn/memoria#memoria-genetica]].

## I {#i}

**Inspector.** The Observe panel that shows everything about the selected bot:
resources, senses, memory, DNA and a console. See [[app/inspector]].

**Instruction.** Each word of the DNA, once the engine has read it: a number, a
read, a sysvar or an operator. They are also called _tokens_. See
[[adn/estructura#tokens]].

## L {#l}

**Lineage.** The chain of parents and children that leads from a bot back to
its founder. The Phylogeny tab of Analyze draws it as a tree. See
[[simulacion/especies#linaje]].

**Live change.** A parameter change that is applied to the simulation that is
running, without starting over. It is noted in the run as an event. See
[[app/experimentar]].

## M {#m}

**Memory.** The 1000 numbered positions of each bot. Some have a name and a
meaning (the sysvars); the rest are free for the DNA to keep whatever it
wants. See [[adn/memoria]].

**Multibot** (or multicellular). An organism made of several bots joined by
stiffened ties, which share resources and pay less for some things. See
[[simulacion/lazos#multicelulares]] and [[.multi]].

**Mutation.** A random change in the DNA, at birth or during life. It is what
makes evolution possible. See [[simulacion/mutaciones]].

## O {#o}

**Obstacle.** A rectangle in the field that bots can't pass through and that
blocks the view. Mazes are sets of obstacles. See
[[simulacion/mundo#obstaculos]].

**Operator.** A DNA word that does something with the stacks: add, compare,
write to memory. See [[adn/operadores]].

## P {#p}

**Paralysis.** The effect of venom: for a few cycles, the engine writes to
the paralyzed bot a command chosen by whoever shot it. See
[[simulacion/defensas#veneno]] and [[.paralyzed]].

**Poison.** A passive defense: to whoever bites you it returns a poison shot
that poisons them. You make it with [[.mkpoison]]. See
[[simulacion/defensas#toxina]].

## R {#r}

**Replicate.** One of several runs of the same scenario, run without drawing
to see which result repeats; each has a seed of its own (the first repeats
the seed of the run it comes from). See [[app/analizar]].

**Reproduction.** The birth of a child: asexual with [[.repro]] (or
[[.mrepro]], with more mutations) and sexual with [[.sexrepro]]. See
[[simulacion/reproduccion]].

**Run.** A simulation with its history: the scenario it came from, its seed,
the live changes and its events. It is saved in the browser or downloaded as
`.dbsim`. See [[app/tus-datos]].

## S {#s}

**Scenario.** A world ready to run: parameters, species to seed and objects
(obstacles, teleporters). The app ships seven built-in ones and you can save
your own. See [[app/escenarios]].

**Seed.** The number that fixes a simulation's randomness: the same scenario
and the same seed give the same simulation. See [[tecnico/semillas]].

**Shell.** A defense that absorbs part of the shots that steal body and the
venom shots. You make it with [[.mkshell]]. See
[[simulacion/defensas#caparazon]].

**Shock.** The death of a bot (one that isn't a vegetable) that loses more than
half its energy in a single cycle and still has more than 3000 left: what's
left goes to its body and it becomes a corpse. See
[[simulacion/energia#shock]].

**Shot.** What a bot fires by writing to [[.shoot]]: depending on the type, it
takes energy or body from whoever it hits, carries venom, waste or a virus, or
writes to their memory. See [[simulacion/disparos]].

**Signature.** Eleven counters the engine derives from each bot's DNA (how many
times it moves, turns, shoots, looks…). A bot reads its own and those of the
bot it sees, and if they match, it is most likely of its own species. See
[[sysvars/my]] and [[sysvars/ref]].

**Slime.** A defense against ties and viruses: it makes it hard for another bot
to tie to you and slows virus shots. You make it with [[.mkslime]]. See
[[simulacion/defensas#baba]].

**Species.** A group of bots with the same name: all the ones that were seeded
together and their descendants. See [[simulacion/especies#especie]].

**Stack.** Where the DNA leaves the numbers it works with. There are two: the
integer stack, for numbers, and the boolean stack, for true and false. See
[[adn/pilas]].

**Store.** Writing a number to a memory position. This is how a bot gives its
commands: `10 .up store` writes 10 to [[.up]]. See [[adn/stores]] and
[[op:store]].

**Sysvar.** A memory position with a name and a meaning, such as [[.up]]
(move forward) or [[.nrg]] (energy). See [[adn/numeros#sysvar]] and
[[sysvars/todas]].

## T {#t}

**Teleporter.** A field object that takes the bots that enter it to another
place. See [[simulacion/mundo#teleporters]].

**Tie.** A physical link between two bots, used to hold on, communicate and
pass energy or body along. You create it with [[.tie]]. See
[[simulacion/lazos]].

**Toroidal.** A world whose edges are connected on both sides: what leaves
through the right comes in through the left, and what leaves through the top
comes in through the bottom. See [[simulacion/mundo#bordes]].

## V {#v}

**Vegetable.** A bot of a species marked as a vegetable: it lives on light, is
born with chloroplasts and the simulation replenishes it when it runs short.
See [[simulacion/cloroplastos#vegetales]].

**Venom.** A weapon: it is fired and paralyzes the victim. You make it with
[[.mkvenom]]. See [[simulacion/defensas#veneno]].

**Virus.** A gene packaged in a shot: the bot copies one of its genes and fires
it, and if it hits another bot, the gene is inserted into its DNA. You make it
with [[.mkvirus]]. See [[simulacion/virus]].

## W {#w}

**Waste.** What builds up when making defenses and when eating. See
[[simulacion/energia#desechos]] and [[.waste]].
