---
titulo: dec
resumen: "Subtracts 1 from a memory cell: the cheap way to keep a countdown."
etiquetas: [dec, counter, timer, writing]
estado: revisada
---
<!-- 20-VM §7 (dec: un operando, mod32000, cost /10, sin flags de lazo); comprobado en el port -->

`d dec` pops the address `d` and subtracts 1 from whatever is in that cell. It
is the twin of [[op:inc]]: it takes no value from the stack and costs a tenth
of a [[op:store]].

| Word | Stack after |
|---|---|
| `50` | 50 |
| `dec` | (empty); cell 50 holds one less |

Its natural place is timers: you load a cell with a number and bring it down
one at a time until it reaches 0.

```adn
' turns once every 5 cycles
cond
 *50 0 >
start
 50 dec
stop
cond
 *50 0 =
start
 100 .aimdx store
 5 50 store
stop
```

In the first cycle cell 50 is at 0: the bot turns with [[.aimdx]] and loads it
with 5. Then it goes down 4, 3, 2, 1 and is back at 0 in cycle 6, when it turns
again.

`dec` does not stop at 0: if you do not cut it off with a condition, it keeps
going negative. And below −32000 it goes back to −1. Like [[op:inc]], it also
does not notify the tie system if you write to [[.tieang1]] or [[.tielen1]];
for those cells use `1 .tieang1 substore`.

To subtract another amount, [[op:substore]].
