---
titulo: .memval
resumen: "The contents of a cell of the memory of the bot you are looking at; you choose the cell with .memloc."
etiquetas: [memory, spying, sight, species]
estado: revisada
---
<!-- sysvars.yaml .memval (lookoccurr = mem(memloc) del visto; EraseLookOccurr paso 12); 21-MEMORIA §3 régimen A (también desde colisiones); core senses.hpp (memval = 0 al ver una forma) -->
If you put an address between 1 and 1000 in [[.memloc]], `.memval` brings what
that cell holds in the memory of the bot you are looking at: the same bot whose
data reaches the [[sysvars/ref|ref*]] sysvars, like [[.refnrg]] or [[.refage]]. It
is also filled when you collide with another bot.

It is a sense like the eyes: the engine writes it after your DNA, you read it in
the next cycle and it clears itself. It is 0 when you see no bot, when what you
see is an obstacle, and also when the spied cell is 0, so it is a good idea to
combine it with [[.eye5]] or another sign that someone is in front of you.

```adn
' Spy on cell 61 of the bot I see
cond
start
61 .memloc store
stop

' If its cell 61 is 7 (my species' password), cell 50 is 1
cond
*.eye5 0 >
*.memval 7 =
start
1 50 store
stop
```

The most common use is recognizing species, by comparing with [[.dnalen]] or
with a password saved in a cell of your own (see [[sysvars/memoria]]). To spy on
the bot you are tied to, the equivalent pair is [[.tmemloc]] and
[[.tmemval]].
