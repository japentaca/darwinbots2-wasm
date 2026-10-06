---
titulo: .in1
resumen: "First input channel through sight: the value that the bot in your focus eye publishes in its .out1."
etiquetas: [communication, in, out, vision, species]
estado: revisada
---
`.in1` tells you what the bot you are looking at with the focus eye (normally
[[.eye5]]; change it with [[.focuseye]]) has written in its [[.out1]]. It is the
same bot that the [[sysvars/ref|ref*]] senses describe: if there are several in
that eye, the closest one. If another bot collides with you, you also receive its
`.out1`, even if you don't see it.
<!-- sysvars.yaml .in1; 32-VISION §1 (lastopp = bot del ojo con foco con mayor eyevalue), §4 (lookoccurr en visión y en colisión) -->

It arrives one cycle late: the engine fills it after your DNA has run, and clears
it after the next run. That is why it is 0 when you are not seeing any bot, when
what is in front of you is an obstacle, and also when the other one never wrote
its `.out1`. Those three cases cannot be told apart: to know whether someone is
ahead, look at `*.eye5`, not `*.in1`.
<!-- 21-MEMORIA §3 (régimen A: escrito tras el ADN, borrado en el paso 12); lookoccurrShape pone in* en 0 ante una forma -->

The value arrives as is. The random ±1 of the original, which the note in the “Facts” box above mentions, belongs to
an evolution mode of the program that this port does not include.
<!-- 32-VISION §4 (fudge = capa evo); el core no lo implementa -->

The typical comparison is with your own output, to recognize your own kind:

```adn
' I note in cell 51 how many times I saw someone who is not one of mine
start
555 .out1 store
stop

cond
*.eye5 0 >
*.in1 *.out1 !=
start
51 inc
stop
```

The full idea is in [[tutoriales/reconoce-especie]]. There are ten identical
channels, from `.in1` to [[.in10]]; see [[sysvars/entradas-salidas]].
