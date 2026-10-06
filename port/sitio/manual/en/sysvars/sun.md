---
titulo: .sun
resumen: "It is 1 when the bot points toward the top of the screen (with about 10 degrees of margin); it has nothing to do with light."
etiquetas: [heading, sense, compass]
estado: revisada
---
<!-- sysvars.yaml .sun (aim entre 1,39 y 1,75 rad = 278..350) -->
Despite the name, `.sun` doesn't measure light or the sun: it is a compass. It is 1 when the bot
points toward the top of the screen, with a margin of about 10 degrees on each
side, and 0 in any other direction. On the [[.aim]] scale, it turns on between
278 and 350 (314 is exactly up).

To know whether it is daytime or whether the sun is shining on a vegetable, the one to use is
[[.daytime]].

The engine publishes it at the end of the cycle, with the heading already turned, and in the first
cycle of life it is 0. It is a cheap way to get your bearings without doing math with
`.aim`, for example to look for north by turning a little at a time:

```adn
' turns until it ends up facing up
cond
*.sun 0 =
start
20 .aimsx store
stop
```

<!-- probado: se para en .aim 280 con .sun 1 -->
This bot stops at the first heading that falls inside the band (near 280,
if it started from lower down). To point exactly up it is more direct to use
`314 .setaim store`.
