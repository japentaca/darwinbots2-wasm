---
titulo: .in2
resumen: "Input channel number 2 through sight: the value that the bot in your focus eye publishes in its .out2."
etiquetas: [communication, in, out, vision]
estado: revisada
---
It works like [[.in1]]: it brings what the bot you are looking at with the focus
eye (or the one that collided with you) has written in its [[.out2]]. It
arrives one cycle late and the engine clears it after every run of your DNA, so
it is 0 when you see no bot and also when the other one does not use that
channel.
<!-- sysvars.yaml .in2 (= out2 del visto; borra: EraseLookOccurr); 21-MEMORIA §3 (régimen A); 32-VISION §4 -->

What each channel means is decided by whoever writes the bot: the engine just
copies the number. That is why it is a good idea to first confirm with `.in1`
that the other one is of your species. If your species publishes in `.out2` a
role number (1 = gatherer, 2 = hunter), you read it like this:

```adn
' if the one in front is one of mine and is a hunter, I count it in cell 52
cond
*.in1 *.out1 =
*.in2 2 =
start
52 inc
stop
```

See [[sysvars/entradas-salidas]].
