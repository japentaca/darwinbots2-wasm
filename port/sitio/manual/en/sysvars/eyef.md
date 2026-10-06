---
titulo: .eyef
resumen: "What the focus eye sees: repeats the value of the eye you chose with .focuseye, or that of .eye5 if you chose none."
etiquetas: [eyes, vision, senses, focuseye]
estado: revisada
---
A copy of the focus eye's value. With [[.focuseye]] at 0, which is the factory
setting, the focus is [[.eye5]] and `.eyef` has the same value as it; if you
move the focus to another eye, `.eyef` repeats that one instead. It is 0 when
the focus eye sees nothing, and if it sees something it uses the same scale as
the other eyes ([[sysvars/ojos#valor]]).
<!-- sysvars.yaml .eyef; 32-VISION §2.6 -->

It is useful for writing genes that do not depend on which eye is looking: the
bot can keep moving the focus and the rest of the DNA keeps reading `.eyef`.
Also, what the focus eye sees is what the cells of
[[sysvars/ref|what it sees]] describe ([[.refeye]], [[.refnrg]] and the rest),
so an `.eyef` greater than 0 assures you that those cells are talking about
something.
<!-- 32-VISION §1.4, §2.6 -->

:::nota
Reading `*.eyef` does not count as reading an eye for the bot's signature:
[[.myeye]] only counts reads of `.eye1` to `.eye9`. A bot that looks only
through `.eyef` has `.myeye` at 0.
<!-- sysvars.yaml .myeye; makeoccurrlist cuenta *501..*509 (port/core senses.hpp) -->
:::

```adn
' focus on the rightmost eye; if it sees something, turn toward it
cond
*.robage 0 =
start
4 .focuseye store
stop

cond
*.eyef 0 >
*.eye5 0 =
start
140 .aimdx store
stop
```

If the bot is inside an obstacle and obstacles are visible, all nine eyes and
`.eyef` are 32000.
<!-- 32-VISION §3.2; port/README.md B2-3 (el port también pone EYEF en 32000) -->
