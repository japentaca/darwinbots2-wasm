---
titulo: >>
resumen: "Shifts the bits of the top number one place to the right, keeping the sign: it divides by 2 rounding down, so 7 >> leaves 3 and −5 >> leaves −3."
etiquetas: [bits, divide, rounding]
estado: revisada
---
<!-- 20-VM §6.3 (>>: aritmético, bit 31 se conserva); §6.1 (div bancario); comprobado en el port -->

`x >>` pops a number, shifts its bits one place to the right and pushes the
result. The sign bit is preserved, so a negative stays negative. In practice
it's **dividing by 2 rounding down**:

| Stack before | After `>>` | With `2 div` |
|---|---|---|
| `8` | `4` | `4` |
| `7` | `3` | `4` |
| `5` | `2` | `2` |
| `-5` | `-3` | `-2` |
| `-1` | `-1` | `0` |

Note that it isn't the same as [[op:div]] by 2. `div` rounds to the nearest
integer, and on an exact tie to the even one; `>>` always goes down. With
negatives the difference is more visible: `-1 >>` stays at −1 forever.

This bot keeps in cell 50 a quarter of its energy ([[.nrg]]), with two shifts
in a row:

```adn
cond
start
  *.nrg >> >> 50 store
stop
```

With 3000 energy, the cell ends up at 750. In the first cycle of life it stores
0, because the senses haven't been published yet (see
[[adn/ejecucion#retraso]]).

With an empty stack it leaves 0. The left shift is [[op:<<]].
