---
titulo: swapbool
resumen: "Swaps the top two values of the boolean stack. It lets you compute two conditions and choose which one rules each stretch of the body."
etiquetas: [boolean stack, conditions, swap]
estado: revisada
---
<!-- 20-VM §6.5 (swapbool: ≤1 no-op); comprobado en el port -->

`swapbool` swaps the top two values of the boolean stack. If there is only one
or none, it does nothing.

Inside the body of a gene, the top value is the one that decides whether
stores write. With `swapbool` you can have two conditions ready and switch from
one to the other without recalculating them:

```adn
cond
start
  *.robage 3 >
  *.robage 6 <
  50 inc
  swapbool
  51 inc
  clearbool
stop
```

The first `inc` depends on the top condition, “age less than 6”
([[.robage]]); after the `swapbool` the other one rules, “age greater than 3”.
After 10 cycles cells 50 and 51 hold 6 each: cell 50 counted ages 0 to 5 and
cell 51 ages 4 to 9. The final [[op:clearbool]] leaves the stack clean for the
next gene.

To swap numbers on the integer stack there is [[op:swap]].
