---
titulo: dupbool
resumen: "Duplicates the value on top of the boolean stack. Good for saving a condition and using it again, for example to nest conditions in the body."
etiquetas: [boolean stack, conditions, duplicating, nesting]
estado: revisada
---
<!-- 20-VM §6.5 (dupbool: vacía no-op), §3 (asimetría con dup); Bestiario: This_n_That_1.01_F2_Peksa_-_12.05.08.txt; comprobado en el port -->

`dupbool` pushes a copy of the value on top of the boolean stack. With an empty
stack it does nothing.

Its use is nesting conditions inside the body: you save a copy of the outer
condition, combine it with an inner one using [[op:and]], and when done a
[[op:dropbool]] gives you back the outer one intact for the next. The bot
_This'n'That 1.01_ (Peksa), from the Bestiary, does this to balance energy
([[.nrg]]) and body ([[.body]]):

```adn
' This'n'That 1.01 (Peksa): balances energy and body
cond
start
  *.nrg *.body !%= dupbool
  *.nrg *.body > and
  *.nrg *.body sub 100 ceil .strbody store dropbool
  *.body *.nrg > and
  *.body *.nrg sub 100 ceil .fdbody store
stop
```

The outer condition is “energy and body differ by more than 10%”
([[op:!%=]]). The boolean stack goes through:

| After | Boolean stack (top on the right) |
|---|---|
| `!%= dupbool` | differ, differ |
| `> and` | differ, (differ and energy to spare) |
| `dropbool` | differ |
| `> and` | (differ and body to spare) |

That way, if there is energy to spare it moves it to the body ([[.strbody]]) and
if there is body to spare it moves it to energy ([[.fdbody]]), 100 at a time at
most ([[op:ceil]] keeps the smaller). A bot that starts with 3000 energy and 1000
body stops at 1300 and 1170.

:::nota
`dupbool` is not symmetric with [[op:dup]]: on an empty integer stack, `dup`
pushes two zeros; on an empty boolean one, `dupbool` pushes nothing.
:::
