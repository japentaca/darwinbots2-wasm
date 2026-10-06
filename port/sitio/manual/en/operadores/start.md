---
titulo: start
resumen: "Closes the gene's conditions and opens its body, which runs if all of them came out true; with no cond before it, it always runs."
etiquetas: [start, gene, body, flow]
estado: revisada
---
<!-- 20-VM §5.2 (AddupCond: AND de toda la pila booleana, la vacía; vacío = verdadero; start sin cond = incondicional), §5.5, §5.6; comprobado en el port -->

`start` opens the gene's _body_: the part where stores do write. What happens
when it's reached depends on what comes before:

- **After a [[op:cond]]**, it does an _and_ of everything left on the boolean
  stack and leaves it empty. If everything was true (or there was nothing),
  the body runs; if not, it is skipped up to the next marker.
- **With no `cond` before it** (at the start of the DNA, after a [[op:stop]]
  or after another body), it opens a new gene **with no conditions**, which
  always runs.

```adn
' the first gene always runs; the second, only for the first 20 cycles of life
start
 10 .up store
stop
cond
 *.robage 20 <
start
 30 .aimdx store
stop
```

The bot moves forward all the time with [[.up]] and turns with [[.aimdx]] until
cycle 20. After that [[.robage]] reaches 20 and the second body stops running.

Two traps:

- A second `start` in a row is not an “and also”: it opens **another gene with
  no conditions**. If you want two bodies with the same condition, repeat the
  `cond`.
- A `start` with no `cond` doesn't empty the boolean stack. If the previous
  gene left a false on top with an inline condition, that false keeps blocking
  the stores (see [[op:stop]] and [[adn/pilas#rareza]]). `cond start` is
  safer.

Inside the body, a new condition governs the stores that come after it; that is
covered in [[adn/condiciones#en-linea]]. The rest of the gene is in
[[adn/genes]].
