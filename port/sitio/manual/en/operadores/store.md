---
titulo: store
resumen: "Stores a number at a memory address: it's how every command is given, like 20 .up store to move forward."
etiquetas: [store, write, memory, commands]
estado: revisada
---
<!-- 20-VM §7 (store: dir = tope, valor debajo; dir 0 deja el valor en la pila), §4 (gate); comprobado en el port -->

`v d store` writes `v` to cell `d`. It is the most common word in the DNA:
every command you give the engine is a `store` on a sysvar.

| Word | Stack afterwards |
|---|---|
| `20` | 20 |
| `.up` | 20 1 |
| `store` | (empty); cell 1 holds 20 |

Note that `.up` without an asterisk is just the number 1, the address of
[[.up]]. If you write `*.up` you are pushing what _is_ in that cell, and the
store will write somewhere else (see [[adn/errores#direccion]]).

```adn
' copies the energy to cell 50 and pushes forward
cond
start
 *.nrg 50 store
 20 .up store
stop
```

<!-- sysvars.yaml .nrg (se reescribe cada ciclo), .up (el motor la pone en 0 tras usarla) -->
The write is immediate: whatever comes after it in the same cycle already
reads the new value. If you write a sense sysvar, like [[.nrg]], the engine
overwrites it at the end of the cycle; if it's a command, like [[.up]], the
engine uses it and sets it back to 0, so you have to write it every cycle in
which you want it.

Three details:

- With address 0 nothing happens and nothing is charged, but the value **stays
  on the stack**: in `7 0 store 60 store`, cell 60 ends up at 7.
- The value is clipped to ±32000: `32001` is stored as 1.
- It is one of the stores that notify the tie system when you write to
  [[.tieang1]] or [[.tielen1]] (see [[adn/stores]]).

To add to what's already there, instead of replacing it, there is
[[op:addstore]].
