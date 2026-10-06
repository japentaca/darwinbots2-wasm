---
titulo: .thisgene
resumen: "The number of the gene that is running right now; it changes at every cond, start, else or stop."
etiquetas: [genes, DNA, sense]
estado: revisada
---
<!-- sysvars.yaml .thisgene (mem 341 = currgene en cada token de flujo); 20-VM §5.6 -->
While the DNA runs, the engine updates `.thisgene` every time it passes a
gene marker (`cond`, `start`, `else`, `stop`), even if the gene doesn't run.
Read inside a gene, it gives that gene's number; read at the end of the cycle, it gives the number of the
last one. The numbering is in [[adn/genes#la-numeracion-de-los-genes]].

It lets a gene refer to itself without knowing its number in advance, which
can change if a mutation or a virus adds or removes genes before it. The typical case
is the gene that deletes itself after running once:

```adn
cond
start
 *.thisgene 50 store
stop
cond
 *.robage 0 =
start
 *.thisgene .delgene store
stop
```

<!-- comprobado: la celda 50 queda en 1 y .genes baja de 2 a 1 -->
In the first cycle, cell 50 ends up at 1 and the second gene, which is gene 2, deletes
itself with [[.delgene]]. It is also used with [[.mkvirus]], so that a gene
copies itself into a virus.

Writing to `.thisgene` has no effect: the engine overwrites it at the next marker.
