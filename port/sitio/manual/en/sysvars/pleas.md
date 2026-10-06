---
titulo: .pleas
resumen: "How much energy the bot gained in the last cycle; negative if it lost."
etiquetas: [energy, pleasure, sense]
estado: revisada
---
<!-- sysvars.yaml .pleas = CInt(nrg − onrg) -->
`.pleas` (from _pleasure_) is the energy the bot has at the end of this
cycle minus what it had at the end of the previous one: positive if it gained, negative if it
lost. It is exactly [[.pain]] with the sign flipped, and everything that page
says applies to it: it measures the net change, it is read one cycle late, and in the
second cycle of a bot placed at the start of the simulation it shows all its energy
as a gain.

Since the change is net, a bot that eats but spends more on moving reads a negative `.pleas`.
To notice that the food pays off, it's better to compare it against a threshold rather than
against 0.

The typical use is not abandoning a good food source: while the energy
goes up, stay where you are and keep shooting at it.

```adn
' while gaining energy, keep shooting to feed
cond
*.pleas 20 >
start
-1 .shoot store
stop
```
