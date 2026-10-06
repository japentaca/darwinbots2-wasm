---
titulo: .myaimdx
resumen: "How many times the bot's own DNA writes to .aimdx (the turn-right command): part of the signature used to recognize its own species."
etiquetas: [species, recognition, signature]
estado: revisada
---
A counter taken from the bot's own DNA: how many times a write to [[.aimdx]]
appears, that is, the number 5 (the address of `.aimdx`) immediately followed by
a word of the [[adn/stores#la-familia-completa|store
family]], such as [[op:store]], [[op:inc]] or [[op:addstore]].
`35 .aimdx store` and `.aimdx inc` count; a computed address does not, nor does an
`.aimdx` that does not come right before the write. Since what is looked at is the
number, it also counts if you write the address by hand (`5` instead of `.aimdx`).

It does not say whether those writes run: it counts what is written in the
genome, whether it runs or not.
<!-- sysvars.yaml .myaimdx; makeoccurrlist (port/core senses.hpp): número 1..7 seguido de un token de tipo store; probado con store, inc, addstore, dec y un gen que no corre -->

Its partner is [[.refaimdx]], which brings the same count but from the DNA of the
bot being looked at. Comparing them is one way to recognize members of your own
species (see [[sysvars/my]]):
<!-- sysvars.yaml .refaimdx -->

```adn
' what I see writes to .aimdx a different number of times than I do
cond
*.eye5 0 >
*.refaimdx *.myaimdx !=
start
1 60 store
stop
```

The engine computes it when the DNA changes (when loading, at birth, through a
virus or a mutation; see [[sysvars/my#cuando]]), not every cycle. If the bot
writes to it, its value changes for the bot itself, but the others keep seeing the
original count.
