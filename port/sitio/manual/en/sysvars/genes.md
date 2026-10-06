---
titulo: .genes
resumen: "How many genes the bot's DNA has; it changes if it mutates, if a gene is deleted or if a virus inserts one."
etiquetas: [genes, DNA, sense, virus]
estado: revisada
---
<!-- sysvars.yaml .genes (pinned cada P3 + carga, nacimiento, mutación, delgene, addgene); 35-VIRUS §3 (addgene recalcula genenum); comprobado: se lee desde el primer ciclo -->
The engine counts the genes in the DNA with the same rule it uses to number them
(see [[adn/genes#la-numeracion-de-los-genes]]) and publishes the total here.
Unlike [[.nrg]] or [[.body]], it is already published from the first cycle,
because it is computed when the bot is loaded and when it is born.

It changes when the DNA changes: a gene deleted with [[.delgene]], a virus that
inserted itself (see [[sysvars/adn-y-virus]]) or a mutation. That makes it
useful for noticing that something from outside touched your DNA:

```adn
' At birth, note how many genes it has
cond
 *.robage 0 =
start
 *.genes 60 store
stop
' If it now has more, a virus got in: note it in cell 61
cond
 *.genes *60 >
start
 1 61 store
stop
```

Knowing which gene is the intruder is another matter: a virus enters at a random
place, so the numbers of your own genes can shift. Writing to `.genes` is
useless: the engine rewrites it every cycle. The length in words is in
[[.dnalen]].
