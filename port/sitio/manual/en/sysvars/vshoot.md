---
titulo: .vshoot
resumen: "Fires the incubated virus: the number is the strength of the shot, which determines how far it reaches and how much it costs."
etiquetas: [virus, shots, action]
estado: revisada
---
<!-- 35-VIRUS §2 (dispara con vshoot ≠ 0 y Vtimer = 1; resetea vshoot, vtimer, mkvirus); comprobado: escrita de antemano, el virus sale al terminar la incubación -->
Write a number other than 0 and, if the virus is ready ([[.vtimer]] at 1), it goes out
in that same cycle. If it is still incubating, the command stays written and the virus goes
out as soon as it finishes: there is no need to wait with a condition. After the shot the
engine sets `.vshoot`, [[.mkvirus]] and [[.vtimer]] to 0.

<!-- 35-VIRUS §2 (energía vshoot·20, alcance 11 + vshoot/2, dirección al azar), §3; port/README B3b-1 (un solo cobro) -->
The number is the strength. The higher it is, the more energy the virus carries and the
farther it reaches (much farther than an ordinary shot), and the more it costs: the bot pays
the strength plus the cost of a shot ([[param:cost:23]]). A negative value is taken as 1.

Two things you can't control:

- **The direction is random.** The virus doesn't go where the bot points: neither
  [[.aim]] nor [[.aimshoot]] has any influence.
- **The outcome.** If it touches a bot, the gene enters at a random place in its DNA.
  Corpses don't get infected, and a thick enough layer of slime ([[.slime]]) stops the
  virus and is used up in the attempt.

```adn
' Makes a virus with gene 2 and leaves the shot requested in advance
cond
 *.vtimer 0 =
start
 2 .mkvirus store
 30 .vshoot store
stop
cond
start
 10 .up store
stop
```

The complete cycle is in [[sysvars/adn-y-virus]] and in [[simulacion/virus]].
