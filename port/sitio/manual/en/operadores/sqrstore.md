---
titulo: sqrstore
resumen: "Replaces what's in a cell with its rounded square root; if it isn't positive, it leaves it at 0."
etiquetas: [sqrstore, square root, write]
estado: revisada
---
<!-- 20-VM §7 (sqrstore: mem>0 -> Sqr redondeado; si no 0; sin mod32000; cost /7; sin flags de lazo); comprobado en el port -->

`d sqrstore` pops the address `d` and leaves in the cell the square root of
what it held, rounded to the nearest integer. It takes no value from the
stack.

| Word | Stack afterwards |
|---|---|
| `50` | 50 |
| `sqrstore` | (empty); if cell 50 held 50, it now holds 7 |

The root is useful for shrinking big numbers without losing their order: 3000
becomes 55 and 30000 becomes 173.

```adn
' pushes forward according to the root of its energy
cond
start
 *.nrg 50 store
 50 sqrstore
 *50 .up store
stop
```

<!-- 21-MEMORIA §3 (régimen A, latencia 1); 10-CICLO «Flujo de datos de los sentidos» -->
With 3000 energy ([[.nrg]]) the bot asks for 55 with [[.up]]; with less
energy, less. In the first cycle it asks for 0, because the senses haven't
been published yet and `*.nrg` reads 0 (see [[adn/ejecucion]]).

If the cell holds 0 or a negative, it ends up at 0: it's not an error. It's the
same as `*50 sqr 50 store` (see [[op:sqr]]), with fewer words and at a seventh
of the cost of a [[op:store]].
