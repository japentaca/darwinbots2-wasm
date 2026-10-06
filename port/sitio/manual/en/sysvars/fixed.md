---
titulo: .fixed
resumen: "It is 1 if the bot is anchored in place and 0 if it can move."
etiquetas: [fixed, sense, movement]
estado: revisada
---
<!-- sysvars.yaml .fixed (WriteSenses P5) y .fixpos (ManageFixed P1, DisableFixing) -->
`.fixed` is the report of [[.fixpos]]: 1 if the bot is anchored and 0 if it is
free. The engine publishes it at the end of every cycle, so writing to it neither
anchors nor frees anything; for that you have to write to `.fixpos`.

The difference between the two matters. `.fixpos` is the command and keeps the
number you gave it; `.fixed` says whether the bot actually ended up anchored. If the
simulation has anchoring disabled, `.fixpos` can be 1 and `.fixed` still 0. Also,
`.fixed` is updated at the end of the cycle: in the cycle in which you write to
`.fixpos` you still read the previous state.

<!-- Bestiario: Anon_Terifica_daynight_F1_PY_-20.04.04.txt -->
A typical use is to avoid repeated writes, as _Anon Terifica daynight_, from the
Bestiary, does: it anchors itself at night and releases itself by day:

```adn
cond
*.daytime 1 =
*.fixed 1 =
start
0 .fixpos store
stop

cond
*.daytime 0 =
*.fixed 0 =
start
1 .fixpos store
stop
```
