---
titulo: .eye1
resumen: "The eye centered 40 degrees to the left of the front: 0 if it sees nothing, and the closer what it sees, the higher the value."
etiquetas: [eyes, vision, senses]
estado: revisada
---
One of the bot's nine [[sysvars/ojos|eyes]]. With the factory configuration it
looks 40 degrees to the left of [[.aim]], with a field of 10 degrees.
It is the leftmost eye. It is 0 if it sees nothing, and if it sees something, a number that grows as it gets closer:
1 at the edge of the range, 100 at about 134 units edge to edge and 32000
when they touch (the table is in [[sysvars/ojos#valor]]).
<!-- 32-VISION §0.2, §0.3; sysvars.yaml .eye1 -->

Like all the eyes, it is written by the engine at the end of the cycle, so what
you read is what was seen after the last movement. It can be pointed elsewhere
with [[.eye1dir]] and widened with [[.eye1width]]; if you widen it, it doesn't see as
far and gives smaller numbers at the same distance.
<!-- 32-VISION §0.1, §0.4 -->

With the factory eyes, anything that lies entirely more than 45 degrees to the left is seen by no eye. That makes it the natural candidate to repoint toward the side or the back.

A typical use of the side eyes is to turn toward what they see to bring it
in front of [[.eye5]]. 40 degrees is about 140 units of [[.aimsx]]:

```adn
' something on the left and nothing ahead: turn toward it
cond
*.eye1 0 >
*.eye5 0 =
start
140 .aimsx store
stop
```
