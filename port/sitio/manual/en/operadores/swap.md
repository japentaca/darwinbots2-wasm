---
titulo: swap
resumen: "Swaps the top two numbers of the integer stack: a b swap leaves b a."
etiquetas: [stack, swap, basics]
estado: revisada
---
<!-- 20-VM §3 (SwapIntStack: no-op con ≤1), §6.1; opcodes.yaml alias swapint -->

`a b swap` leaves `b a`. You can also write it as `swapint`. It's useful when
the operands ended up in the opposite order from what the operator needs,
which matters for the non-commutative ones: [[op:sub]], [[op:div]], [[op:mod]],
the comparisons or [[op:store]].

| Word | Stack afterwards |
|---|---|
| `*.eye5` | 30 (for example) |
| `40` | 30 40 |
| `swap` | 40 30 |
| `sub` | 10 |

So, `*.eye5 40 swap sub` calculates `40 − *.eye5`. This bot stores it in cell
50:

```adn
cond
start
  *.eye5 40 swap sub 50 store
stop
```

If the stack has a single number, or none, `swap` does nothing: it doesn't
invent a zero the way [[op:over]] does. Its boolean stack counterpart is
[[op:swapbool]].
