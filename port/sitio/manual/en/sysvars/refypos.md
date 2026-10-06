---
titulo: .refypos
resumen: "The y coordinate of what you are looking at: together with .refxpos and the angle operator, it lets you aim right at it."
etiquetas: [vision, refvars, position, aiming]
estado: revisada
---
<!-- sysvars.yaml 690; 32-VISION §4; core senses.hpp lookoccurr (mem 217 del visto); 30-FISICA §7 (Y invertida, convención de pantalla) -->
`.refypos` is the vertical coordinate of the bot your focus eye sees, in the
same units as your own [[.ypos]]. As on the screen, it grows downward. It is
always used together with [[.refxpos]], which has the full explanation and an
example.

Both are also useful for remembering where you saw something. If you save the
position in free memory, you can go back and look for it even after you lose
sight of it:

```adn
' I note where I saw the last prey
cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refxpos 50 store
*.refypos 51 store
stop
```

Like `.refxpos`, it brings the position published by the other bot, which can be
one cycle late, and it is 0 if you don't see anything.
