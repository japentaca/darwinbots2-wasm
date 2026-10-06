---
titulo: .bodgain
resumen: "How much body the bot gained in the last cycle; negative if it lost any."
etiquetas: [body, sense, gain]
estado: revisada
---
<!-- sysvars.yaml .bodgain (WriteSenses P5 = body − obody) -->
`.bodgain` is the body ([[.body]]) the bot has at the end of this cycle minus what it
had at the end of the previous one. [[.bodloss]] is the same number with the sign
flipped. It works like [[.pleas]], but for body: the engine publishes it at the
end of every cycle and your DNA reads what happened in the previous cycle.

<!-- 31-ENERGIA §3; 33-SHOTS (takenrg: 4% a body); probado: 100 .strbody da bodgain 10 y pain 100 -->
Body grows mostly when the bot converts energy with [[.strbody]] (every
10 of energy gives 1 of body), and also a little when eating. It drops when the bot
converts it back into energy with [[.fdbody]] or when it is attacked.

A bot placed at the start of the simulation reads all of its body as gain in its second
cycle, just as with energy. The same happens with body for a newborn child
(its energy, in contrast, starts without a jump), and the parent reads that
body it gave up as a loss in [[.bodloss]].

```adn
' stores the last body increase in cell 50
cond
*.bodgain 0 >
start
*.bodgain 50 store
stop
```

With `100 .strbody store` the bot spends 100 of energy and, in the next cycle,
reads `.bodgain` 10 and [[.pain]] 100.
