---
titulo: over
resumen: "Copies the second number of the integer stack to the top: a b over leaves a b a."
etiquetas: [stack, copy, basics]
estado: revisada
---
<!-- 20-VM §3 (OverIntStack: vacío no-op, un elemento apila 0), §6.1; opcodes.yaml alias overint; comprobado en el port -->

`a b over` leaves `a b a`: it copies the one below the top and puts it on top,
without popping anything. You can also write it as `overint`. It's like a
[[op:dup]] of the second one, useful when a value is needed again but
something is already on top of it.

| Word | Stack afterwards |
|---|---|
| `7` | 7 |
| `3` | 7 3 |
| `over` | 7 3 7 |

```adn
cond
start
  7 3 over 50 store 51 store 52 store
stop
```

The three [[op:store]]s pop from the top down: cell 50 ends up at 7, cell 51
at 3 and cell 52 at 7.

An inherited quirk: with only one number on the stack, `over` doesn't copy it
but **pushes a 0** (`5 over` leaves `5 0`). With an empty stack it does
nothing. Its boolean stack counterpart, [[op:overbool]], pushes a _true_ when
there is only one value.
