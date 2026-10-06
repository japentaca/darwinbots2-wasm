---
titulo: .tieval
resumen: "The value that goes with .tieloc: what is written to the other bot's memory or how much is transferred through the tie."
etiquetas: [ties, tie, memory]
estado: revisada
---
By itself it does nothing: it is the second piece of data for [[.tieloc]].

- If `.tieloc` is an address (1 to 1000), `.tieval` is the number that is written
  there, in the tied bot's memory.
- If `.tieloc` is `-1`, `-3`, `-4` or `-6`, `.tieval` is the amount: positive to
  give, negative to take, with the caps shown on the `.tieloc` page.

The engine clears it together with `.tieloc` when the order is carried out; if there is no tie
to pick it up, it can stay written (see the `.tieloc` page).

<!-- sysvars.yaml .tieval (valor a inyectar / cantidad; se borra con tieloc); 34-TIES §2 -->

```adn
' tell my partner on tie 7 that I saw something
cond
*.eye5 0 >
start
7 .tienum store
70 .tieloc store
*.refxpos .tieval store
stop
```

The partner finds the data in its cell 70 in the next cycle. To pass
data permanently, without writing to the other bot's memory, there are also the
channels [[.tout1]] and [[.tin1]] (see [[sysvars/entradas-salidas]]).

<!-- 21-MEMORIA §4.1 (tieportcom P1); sysvars.yaml .tout1/.tin1 (canal persistente leído por el atado) -->
