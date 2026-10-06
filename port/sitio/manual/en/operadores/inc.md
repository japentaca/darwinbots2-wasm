---
titulo: inc
resumen: "Adds 1 to a memory cell: the cheapest counter in the DNA."
etiquetas: [inc, counter, write, memory]
estado: revisada
---
<!-- 20-VM §7 (inc: un operando, mod32000, cost /10, sin flags de lazo); comprobado en el port -->

`d inc` pops the address `d` and adds 1 to whatever is in that cell. It takes
no value from the stack: `50 inc` is the same as
`*50 1 add 50 store`, but in two words and for a tenth of the cost of a
[[op:store]].

| Word | Stack afterwards |
|---|---|
| `50` | 50 |
| `inc` | (empty); cell 50 holds one more |

The typical use is counting cycles in free memory, which is not cleared
between one cycle and the next:

```adn
' counts cycles in cell 50 and turns every 10
start
 50 inc
stop
cond
 *50 10 >=
start
 0 50 store
 100 .aimdx store
stop
```

Cell 50 goes from 1 to 9; in the tenth cycle it reaches 10, the second gene
sets it back to 0 and the bot turns 100 with [[.aimdx]]. So it turns once
every 10 cycles.

Two things to keep in mind:

- If you let it count without a limit, after 32000 it doesn't keep going or
  turn negative: it wraps back to 1.
- On [[.tieang1]] or [[.tielen1]] it changes the number, but the tie doesn't
  find out. For those cells use `1 .tieang1 addstore` (see [[adn/stores]]).

To subtract 1 there is [[op:dec]]; to add another amount, [[op:addstore]].
