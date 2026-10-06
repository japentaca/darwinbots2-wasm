---
titulo: .eye9
resumen: "The eye centered 40 degrees to the right of the front: 0 if it sees nothing, and the closer what it sees, the higher the value."
etiquetas: [eyes, vision, senses]
estado: revisada
---
One of the bot's nine [[sysvars/ojos|eyes]]. With the factory configuration it
looks 40 degrees to the right of [[.aim]], with a field of 10 degrees. It is the
rightmost eye. It is 0 if it sees nothing, and if it sees something, a number
that grows as it gets closer: 1 at the edge of the range, 100 at about 134
units edge to edge, and 32000 when they touch (the table is in
[[sysvars/ojos#valor]]).
<!-- 32-VISION §0.2, §0.3; sysvars.yaml .eye9 -->

Like all eyes, it is written by the engine at the end of the cycle, so what you
read is what was in view after the last movement. You can point it elsewhere
with [[.eye9dir]] and widen it with [[.eye9width]]; if you widen it, it sees
less far and gives smaller numbers at the same distance.
<!-- 32-VISION §0.1, §0.4 -->

With the factory eyes, anything that lies entirely more than 45 degrees to the right is seen by no eye. That makes this one the natural candidate to re-aim toward the side or the back.

A typical use of the side eyes is to turn toward what they see in order to put
it in front of [[.eye5]]. 40 degrees is about 140 units of [[.aimdx]]:

```adn
' something on the right and nothing ahead: turn toward it
cond
*.eye9 0 >
*.eye5 0 =
start
140 .aimdx store
stop
```
