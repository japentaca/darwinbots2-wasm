---
titulo: .in5
resumen: "Input channel number 5 through sight: the value that the bot in your focus eye publishes in its .out5."
etiquetas: [communication, in, out, vision]
estado: revisada
---
It works like [[.in1]]: it brings what the bot you are looking at with the focus
eye (or the one that collided with you) has written in its [[.out5]]. It
arrives one cycle late and the engine clears it after every run of your DNA, so
it is 0 when you see no bot and also when the other one does not use that
channel.
<!-- sysvars.yaml .in5 (= out5 del visto; borra: EraseLookOccurr); 21-MEMORIA §3 (régimen A); 32-VISION §4 -->

What each channel means is decided by whoever writes the bot: the engine just
copies the number. That is why it is a good idea to first confirm with `.in1`
that the other one is of your species. If your species publishes in `.out5` the
species code of what it has in front of it, you read it like this:

```adn
' if a companion has in front of it someone who is not one of ours, I count it in cell 55
cond
*.in1 *.out1 =
*.in5 0 !=
*.in5 *.out1 !=
start
55 inc
stop
```

See [[sysvars/entradas-salidas]].
