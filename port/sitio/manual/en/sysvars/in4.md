---
titulo: .in4
resumen: "Input channel number 4 through sight: the value that the bot in your focus eye publishes in its .out4."
etiquetas: [communication, in, out, vision]
estado: revisada
---
It works like [[.in1]]: it brings what the bot you are looking at with the focus
eye (or the one that collided with you) has written in its [[.out4]]. It
arrives one cycle late and the engine clears it after every run of your DNA, so
it is 0 when you see no bot and also when the other one does not use that
channel.
<!-- sysvars.yaml .in4 (= out4 del visto; borra: EraseLookOccurr); 21-MEMORIA §3 (régimen A); 32-VISION §4 -->

What each channel means is decided by whoever writes the bot: the engine just
copies the number. That is why it is a good idea to first confirm with `.in1`
that the other one is of your species. If your species publishes in `.out4` how
much energy it lost in the last cycle, you read it like this:

```adn
' if the one in front is one of mine and is losing energy, I save how much in cell 54
cond
*.in1 *.out1 =
*.in4 0 >
start
*.in4 54 store
stop
```

See [[sysvars/entradas-salidas]].
