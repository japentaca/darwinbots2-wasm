---
titulo: .timer
resumen: "A clock that adds 1 per cycle, that you can write to and that the child inherits from the parent: useful for synchronizing a lineage."
etiquetas: [clock, inheritance, sense, memory]
estado: revisada
---
<!-- sysvars.yaml .timer (Ageing P5 +1, wrap 32000 → −32000; semilla al azar; heredado al nacer); 36-REPRO §2 -->
The engine adds 1 at the end of each cycle to whatever is in `.timer`. Unlike
[[.robage]], the value is yours: if you write 0, the next cycle you read 1, and it keeps
counting from there. When it goes past 32000 it jumps to −32000 and keeps rising.

Two details about where it starts:

- A bot loaded at the start of the simulation gets a random value.
- A child is born with the value its parent had (or its mother, in sexual
  reproduction) and keeps the same count. Along with the genetic memory, it is the only thing in
  memory that is inherited (see [[adn/memoria#al-nacer]]).

That is why it is the tool for making a whole lineage act at once: the descendants
of the same founder share the clock without talking to each other.

```adn
' Every 100 clock cycles, a half turn
cond
 *.timer 100 mod 0 =
start
 628 .aimdx store
stop
```

All of this bot's children turn on the same cycles as it does. If you prefer to count
from each one's birth, set the clock to 0 at birth with
`0 .timer store` inside a gene with `*.robage 0 =`.

<!-- opcodes.yaml mod (signo del dividendo); comprobado: −250 100 mod da −50 -->
Watch out for [[op:mod]] and negative numbers: with the clock at −250, `100 mod` gives −50,
not 50. Comparing with 0 works the same.
