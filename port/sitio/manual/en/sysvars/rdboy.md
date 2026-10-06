---
titulo: .rdboy
resumen: "The bot's buoyancy, from 0 to 32000, as it was left the last time it changed it with .setboy."
etiquetas: [buoyancy, pond, sense]
estado: revisada
---
It shows the bot's buoyancy on the 0 to 32000 scale (32000 is the maximum). What
buoyancy does is explained in [[.setboy]].

<!-- sysvars.yaml .rdboy (solo cuando setboy ≠ 0); 21-MEMORIA §5 (mem del hijo en 0); comprobado: 1 .setboy store publica el valor -->
The catch is that the engine only updates it in the cycles when the bot writes
[[.setboy]] with something other than 0. The rest of the time it keeps the last value, or
whatever you wrote yourself into the cell. And a child is born with its parent's buoyancy
but with `.rdboy` at 0, because memory isn't inherited: until it touches
`.setboy` for the first time, it will read 0 even though it is floating.

One way to sync it at birth is to send a change that is null in practice: a
`.setboy` of 1 moves the buoyancy by just 1/32000 and forces the engine to
publish it.

```adn
' At birth, ask for its real buoyancy to be published
cond
 *.robage 0 =
start
 1 .setboy store
stop
```
