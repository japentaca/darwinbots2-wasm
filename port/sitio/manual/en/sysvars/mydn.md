---
titulo: .mydn
resumen: "How many times the bot's own DNA writes to .dn (the command to push backward): part of the signature used to recognize its own species."
etiquetas: [species, recognition, signature]
estado: revisada
---
A counter taken from the bot's own DNA: how many times a write to
[[.dn]] appears, that is, the number 2 (the address of `.dn`) immediately
followed by a word from the [[adn/stores#la-familia-completa|store
family]], such as [[op:store]], [[op:inc]] or [[op:addstore]].
`20 .dn store` and `.dn inc` both count; a computed address doesn't, and neither does a
`.dn` that isn't right before the write. Since what gets checked is the number,
it also counts if you write the address by hand (`2` instead of `.dn`).

It doesn't say whether those writes run: it counts what is written in the
genome, whether it runs or not.
<!-- sysvars.yaml .mydn; makeoccurrlist (port/core senses.hpp): número 1..7 seguido de un token de tipo store; probado con store, inc, addstore, dec y un gen que no corre -->

Its partner is [[.refdn]], which gives the same count but for the DNA of the bot
being looked at. Comparing them is one way to recognize members of your own
species (see [[sysvars/my]]):
<!-- sysvars.yaml .refdn -->

```adn
' what I see writes to .dn a different number of times than I do
cond
*.eye5 0 >
*.refdn *.mydn !=
start
1 60 store
stop
```

The engine computes it when the DNA changes (on load, at birth, through a virus or
a mutation; see [[sysvars/my#cuando]]), not every cycle. If the bot writes to it, its value changes
for the bot, but everyone else keeps seeing the original count.
