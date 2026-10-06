---
titulo: .eye4
resumen: "The eye centered 10 degrees to the left of the front: 0 if it sees nothing, and the closer what it sees, the higher the value."
etiquetas: [eyes, vision, senses]
estado: revisada
---
One of the bot's nine [[sysvars/ojos|eyes]]. With the factory configuration it
looks 10 degrees to the left of [[.aim]], with a field of 10 degrees.
It sits between [[.eye3]] and [[.eye5]]. It is 0 if it sees nothing, and if it sees something, a number that grows as it gets closer:
1 at the edge of the range, 100 at about 134 units edge to edge and 32000
when they touch (the table is in [[sysvars/ojos#valor]]).
<!-- 32-VISION §0.2, §0.3; sysvars.yaml .eye4 -->

Like all the eyes, it is written by the engine at the end of the cycle, so what
you read is what was seen after the last movement. It can be pointed elsewhere
with [[.eye4dir]] and widened with [[.eye4width]]; if you widen it, it doesn't see as
far and gives smaller numbers at the same distance.
<!-- 32-VISION §0.1, §0.4 -->

A typical use of the side eyes is to turn toward what they see to bring it
in front of [[.eye5]]. 10 degrees is about 35 units of [[.aimsx]]:

```adn
' something on the left and nothing ahead: turn toward it
cond
*.eye4 0 >
*.eye5 0 =
start
35 .aimsx store
stop
```
