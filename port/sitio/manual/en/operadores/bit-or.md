---
titulo: |
resumen: "Bitwise or of the top two numbers: leaves set every bit that is set in either one. Good for setting flags."
etiquetas: [bits, flags, masks]
estado: revisada
---
<!-- 20-VM §6.3 (|: OR bit a bit); comprobado en el port -->

`a b |` pops two numbers and leaves a number with every bit set that is set
in `a`, in `b` or in both. `12 10 |` gives 14 (1100 or 1010 is 1110).

It is the way to **set a flag** without touching the others: if the cell
already had the bit, it stays the same; if not, it is added. This bot records
in the bit worth 2 of cell 50 that it has seen something at some point with
the middle eye ([[.eye5]]), and the flag stays with it forever:

```adn
' flags that it has seen something at some point
cond
  *.eye5 0 >
start
  *50 2 | 50 store
stop
```

With numbers that share no bits, `|` is the same as adding: `4 1 |` gives 5.
When they do share bits, it is not: `5 1 |` still gives 5, while `5 1 add`
gives 6. That is why it is safer than [[op:add]] for setting flags: repeating
it changes nothing.

To check or clear a flag you use [[op:&]]; to flip it, [[op:^]]. With an empty
stack it operates on zeros. Do not confuse it with [[op:or]], which combines
trues and falses on the boolean stack.
