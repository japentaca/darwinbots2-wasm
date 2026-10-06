---
titulo: .refaim
resumen: "Which way the bot you are looking at is pointing, on the same scale as .aim: for knowing whether it is looking at you."
etiquetas: [vision, refvars, angles]
estado: revisada
---
<!-- sysvars.yaml 711 (mem 18 del visto); core senses.hpp lookoccurr; probado: mirada.txt contra mira.txt (70 pasa a 1 cuando se miran); sysvars.yaml 18 (rango 0..~2513 con momento angular); opcodes.yaml anglecmp (Mod 1256 y diferencia con signo ±628); revisor: mirada.txt contra mirada.txt (aims 1176 y 568, 70=1) -->
`.refaim` is the direction the bot your focus eye sees is pointing: what that
bot reads in its [[.aim]]. A full turn is 1256; it is almost always
between 0 and 1255, although while turning it can overshoot a little.

The most useful thing is to compare it with your own heading. If the other bot is looking at you, its
heading is yours turned around, that is, yours plus 628. The operator
[[op:anglecmp]] gives the difference between two angles taking the
full turn into account:

```adn
' is it looking at me? then I sidestep
cond
*.eye5 0 >
*.refaim *.aim 628 add anglecmp abs 60 <
start
50 .sx store
stop
```

With two bots that were turning until they saw each other, the condition was met just as
they ended up face to face. A bot that is looking at you is probably about to
shoot you, especially if its [[.refshoot]] is greater than 0.

If you see nothing, or you see a shape, it is 0.
