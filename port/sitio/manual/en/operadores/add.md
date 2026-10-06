---
titulo: add
resumen: "Adds the top two numbers of the integer stack and leaves the result."
etiquetas: [arithmetic, addition, basic]
estado: revisada
---
<!-- 20-VM §0.5, §6.1 (add: Single, envuelve en ±2·10⁹); §7 (inc cuesta COSTSTORE/10); comprobado en el port: 20000001+1 = 20000001, 2,048·10⁹ → 48·10⁶ -->

`a b add` leaves `a + b`. It is plain old addition, with the usual order of
DNA: first the two numbers, then the word.

| Word | Stack after |
|---|---|
| `3` | 3 |
| `4` | 3 4 |
| `add` | 7 |

The most common use is adjusting a reading before storing it, or keeping a
count in free memory. This bot adds 1 to cell 50 every cycle:

```adn
cond
start
  *50 1 add 50 store
stop
```

For that specific job there is a shortcut, [[op:inc]] (`50 inc`), which does
the same with fewer words and for a tenth of the energy a [[op:store]] costs
(see [[adn/ejecucion#costos]]).

Two inherited quirks, which only show up with enormous numbers, beyond what
fits in memory:

- Above 16,777,216, addition loses precision: the operands are rounded before
  adding and the result can be off by a few units (more the bigger the number
  is). `20000 1000 mult 1 add 1 add` gives 20000001, not 20000002.
- If the result goes past 2 billion, it **wraps around** instead of stopping
  at the cap: `32000 32000 mult dup add` gives 48 million. [[op:mult]], by
  contrast, saturates.

Subtraction, [[op:sub]], behaves the same way.
