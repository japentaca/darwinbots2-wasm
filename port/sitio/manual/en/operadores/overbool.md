---
titulo: overbool
resumen: "Pushes a copy of the second value of the boolean stack: a b becomes a b a. With a single value it pushes true."
etiquetas: [boolean stack, conditions, copy]
estado: revisada
---
<!-- 20-VM §6.5 (overbool: vacía no-op; un elemento → verdadero), §3; comprobado en el port -->

`overbool` copies the value that is second from the top of the boolean stack
and puts it on top: `a b` becomes `a b a`. It's useful for combining two
conditions without losing either:

```adn
cond
start
  *.robage 3 >
  *.robage 6 <
  overbool and
  50 inc
  dropbool
  51 inc
  clearbool
stop
```

| After | Boolean stack (top on the right) |
|---|---|
| the two comparisons | greater than 3, less than 6 |
| `overbool` | greater than 3, less than 6, greater than 3 |
| `and` | greater than 3, (less than 6 and greater than 3) |
| `dropbool` | greater than 3 |

Cell 50 counts the cycles with age ([[.robage]]) 4 or 5, and cell 51 all those
with age greater than 3: after 10 cycles they hold 2 and 6.

:::cuidado
With **only one** value on the stack, `overbool` doesn't copy it: it pushes a
_true_ (the second value doesn't exist, and what's missing from the boolean
stack counts as true). With an empty stack it does nothing. It's an asymmetry
with [[op:over]], which pushes a 0 in the same case.
:::

To have two copies of the top one there is [[op:dupbool]].
