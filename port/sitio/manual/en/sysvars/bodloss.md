---
titulo: .bodloss
resumen: "How much body the bot lost in the last cycle; negative if it gained any."
etiquetas: [body, sense, loss]
estado: revisada
---
<!-- sysvars.yaml .bodloss (WriteSenses P5 = obody − body) -->
`.bodloss` is the body ([[.body]]) the bot had at the end of the previous cycle
minus what it has at the end of this one: positive if it lost any. It is [[.bodgain]] with the
sign flipped, and it works like [[.pain]] but for body: the engine publishes it
at the end of every cycle and your DNA reads what happened in the previous cycle.

Body drops when the bot converts it into energy with [[.fdbody]] (every 1 of
body gives 10 of energy) or when another bot takes it away with shots. A positive
`.bodloss` that the bot didn't ask for is a sign of attack, more specific than
[[.pain]], which also goes up from the bot's own spending.

Watch out for reproduction: the energy the bot passes to a child doesn't count in
[[.pain]], but the body does. A bot with body 1000 that splits in half reads,
one cycle after giving birth, `.bodloss` 500.

<!-- probado: 50 .repro store con body 1000 da bodloss 500 y pain 0 -->
For a bot that doesn't use `.fdbody` and doesn't reproduce, any loss of body
comes from outside:

```adn
' if it loses body, it escapes
cond
*.bodloss 0 >
start
40 .up store
stop
```
