---
titulo: clearbool
resumen: "Empties the boolean stack. Since empty counts as true, every store that follows writes again."
etiquetas: [boolean stack, conditions, clearing]
estado: revisada
---
<!-- 20-VM §6.5 (clearbool), §5.1-5.2 (solo cond limpia; start sin cond no), §4; comprobado en el port -->

`clearbool` empties the boolean stack all at once, whatever it holds. An empty
boolean stack counts as true, so after a `clearbool` all the stores in the body
run again.

It is the safe way to **close a gene** that used inline conditions. A gene that
starts with `start`, without `cond`, does not clear the boolean stack: it
inherits whatever the previous one left (see [[adn/pilas#rareza]]). In this
pair of genes, without the `clearbool`, the false from the first would block
the store in the second and cell 51 would never be written; with it, 51 ends up
at 4:

```adn
start
  1 2 = 3 50 store
  clearbool
stop

start
  4 51 store
stop
```

The other way out is to open every gene with `cond`, which also empties the
boolean stack at the start.

Compared with [[op:dropbool]], which pops only the top one, `clearbool` leaves
nothing underneath that could take charge again. Compared with [[op:true]], it
does not just cover it up: it erases. To empty the integer stack there is [[op:clear]].
