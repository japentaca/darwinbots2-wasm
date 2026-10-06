---
titulo: .dnalen
resumen: "The length of the bot's DNA in words, counting the final end; upkeep and the cost of copying it depend on it."
etiquetas: [DNA, sense, costs]
estado: revisada
---
<!-- sysvars.yaml .dnalen (pinned cada P3 y en carga, nacimiento, mutación, delgene, addgene); comprobado: `cond start 1 50 store stop` da 7 desde el primer ciclo -->
It counts the words of the DNA, including the `end` that closes every DNA: a bot
`cond start 1 50 store stop` has 6 words and `.dnalen` is 7. `def`
lines and comments don't count (see [[adn/def]]). Like [[.genes]], it is already
published from the first cycle.

<!-- 31-ENERGIA §1 ((DnaLen−1)·DNACYCCOST por ciclo; DnaLen·DNACOPYCOST al nacer) -->
It matters because of energy. Depending on the configuration, the bot pays every cycle for the length
of its DNA, whether it runs or not ([[param:cost:24]]), and when reproducing it pays for copying it
([[param:cost:25]]); see [[adn/ejecucion#adn-largo]]. A DNA that has grown through
mutations or viruses becomes expensive.

It changes when the DNA changes: mutations, genes deleted with [[.delgene]] or viruses
inserted. Writing to `.dnalen` has no effect: the engine rewrites it every
cycle.

```adn
' If the DNA has grown a lot (for example, from a virus), cancel
' any reproduction request: it goes after the gene that makes it
cond
 *.dnalen 200 >
start
 0 .repro store
stop
```
