---
titulo: <<
resumen: "Shifts the bits of the top number one place to the left, that is, multiplies it by 2: 5 << leaves 10."
etiquetas: [bits, multiply, masks]
estado: revisada
---
<!-- 20-VM §6.3 (<<: shift de 1 bit; edge 2^30 << → 0); comprobado en el port -->

`x <<` pops a number, shifts all its bits one place to the left (a 0 comes in
on the right) and pushes the result. In practice it's multiplying by 2:
`5 <<` gives 10 and `-3 <<` gives −6. It shifts a single place; to multiply by
8 you have to write it three times:

| Stack before | Word | Stack after |
|---|---|---|
| `1` | `<<` | `2` |
| `2` | `<<` | `4` |
| `4` | `<<` | `8` |

It's useful for making the power of 2 that corresponds to a flag, the mask
that [[op:|]] and [[op:&]] then use:

```adn
' turns on the bit of value 8 in cell 50
cond
start
  *50 1 << << << | 50 store
stop
```

The difference from `2 mult` only shows up with numbers over a billion, far
from what fits in memory: [[op:mult]] caps at two billion, while `<<` can
change the sign of the number, and on 1073741824 (2³⁰) it gives 0, a quirk
inherited from DarwinBots 2.48.32. Also remember that the result is clipped to
±32000 only when it is stored (see [[adn/numeros#recorte]]).

With an empty stack it leaves 0. The right shift is [[op:>>]].
