---
titulo: root
resumen: "Gives the b-th root of the lower number: 27 3 root gives 3. It ignores signs and, with b at 0, gives 0."
etiquetas: [math, root, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (root: Abs de ambos; b = 0 → 0; a^(1/b) redondeado); comprobado en el port -->

`a b root` leaves the `b`-th root of `a`, rounded to the nearest integer:
`27 3 root` gives 3, `10 2 root` gives 3 (it is 3.16…) and `1024 10 root` gives
2.

Before calculating, it **drops the sign from both**: `-27 3 root` gives 3, not
−3, and `27 -3 root` also gives 3. With `b` at 0 it gives 0.

```adn
cond
start
  27 3 root 50 store
  -27 3 root 51 store
  10 0 root 52 store
stop
```

Cells 50, 51 and 52 end up at 3, 3 and 0.

For the square root there is a shortcut, [[op:sqr]], with one difference:
`sqr` of a negative gives 0, while `-16 2 root` gives 4. The inverse operation
is [[op:pow]].
