---
titulo: ~
resumen: "Inverts all the bits of the number on top: x ~ leaves −x − 1, so 5 ~ gives −6 and 0 ~ gives −1."
etiquetas: [bits, flags, masks]
estado: revisada
---
<!-- 20-VM §6.3 (~: complemento a uno); comprobado en el port -->

`~` pops a number, flips each of its 32 bits (0s become 1s and 1s become 0s)
and pushes the result. In two's complement that is always equivalent to
`−x − 1`:

| Stack before | After `~` |
|---|---|
| `5` | `-6` |
| `0` | `-1` |
| `-1` | `0` |
| `4` | `-5` |

Its typical use is building a _mask_ to clear a bit with [[op:&]]: `4 ~` has
every bit set except the one worth 4, and doing `&` with the cell leaves
everything the same except that bit.

```adn
' clears the bit worth 4 in cell 50, leaving the others alone
cond
start
  *50 4 ~ & 50 store
stop
```

If cell 50 held 5 (bits worth 1 and 4), it ends up at 1.

:::cuidado
`~` is not [[op:not]]. `not` inverts a true or false on the boolean stack; `~`
works with numbers on the integer stack. `1 ~` gives −2, which for a
comparison is still a nonzero number.
:::

With an empty stack it operates on 0 and leaves −1. The other bit operations
are in [[operadores/bits]].
