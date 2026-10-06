---
titulo: .kills
resumen: "How many bots this bot has killed, with shots or through a tie; the engine updates it only when it kills."
etiquetas: [deaths, predator, sense]
estado: revisada
---
<!-- sysvars.yaml .kills (solo al matar, vía lazos y disparos); port/README A3-5 (tope 32000 también por disparos) -->
It counts the bot's victims: every time a shot of its own, or what it takes from
another through a tie, leaves that other one without energy or without body, the
engine adds 1 and writes it here. The cap is 32000 (in the original DarwinBots,
the count by shots did not have one; the port fixed that).

The peculiar thing is that the engine **only writes it when the bot kills**. The
rest of the time it does not touch it, so if you write another number to `.kills`
it stays there until the next kill, and at that moment the engine puts its own
count back (which was not aware of your change). It is no good, then, for keeping
a count of your own: for that, use a free memory cell.

A child is born with `.kills` at 0: kills are not inherited.

```adn
' After the first victim, it stores energy in the body
cond
 *.kills 0 >
 *.nrg 3000 >
start
 100 .strbody store
stop
```

The kills of the bot in front of you are read in [[.refkills]]: a high number
warns you that it is a predator. How killing works with shots is in
[[simulacion/disparos]], and with ties in [[simulacion/lazos]].
