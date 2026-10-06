---
titulo: &
resumen: "Bitwise and of the top two numbers: keeps only the bits that are set in both. Good for checking and clearing flags."
etiquetas: [bits, flags, masks, parity]
estado: revisada
---
<!-- 20-VM §6.3 (&: AND bit a bit); comprobado en el port -->

`a b &` pops two numbers and leaves a number with a bit set only where that
bit is set in both `a` _and_ `b`. `12 10 &` gives 8: in binary, 1100 and 1010
share only the bit worth 8.

| Stack before | After `&` |
|---|---|
| `12 10` | `8` |
| `7 4` | `4` |
| `5 2` | `0` |

It has two main uses:

- **Checking a flag**: `*50 4 &` leaves 4 if the bit worth 4 in cell 50 is set
  and 0 if not. Finish it with a comparison: `*50 4 & 0 !=`.
- **Clearing a flag**: with a mask made with [[op:~]], `*50 4 ~ & 50 store`
  clears that bit and leaves the others alone.

A useful special case: `x 1 &` leaves 1 if `x` is odd and 0 if it is even. With
[[.robage]] it makes a gene that runs every other cycle:

```adn
' moves forward only on cycles where its age is even
cond
  *.robage 1 & 0 =
start
  10 .up store
stop
```

With negatives it works on the two's complement: `-1` has all its bits set, so
`x -1 &` leaves `x` as is. With an empty stack it operates on zeros and gives
0. _Or_ and _exclusive or_ are [[op:|]] and [[op:^]]; to combine trues and
falses (not numbers) there is [[op:and]].
