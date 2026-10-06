---
titulo: .refup
resumen: "How many times the DNA of the bot you are looking at writes to .up: one of the numbers in its signature, for recognizing species."
etiquetas: [vision, refvars, signature, recognition]
estado: revisada
---
<!-- sysvars.yaml 701; core senses.hpp makeoccurrlist (número 1..7 seguido de un store), lookoccurr; probado: firma.txt, firma2.txt; opcodes.yaml stores (tipo 7: store, inc, addstore…); README B6-9 (la mutación en vida rehace la firma); 32-VISION §2 (corpses: occurr borrado); revisor: mira.txt contra firma.txt (refup 2, refdx 1, refeye 3, reftie 2) y firma2.txt (refup 1, refshoot 2, refeye 1) -->
`.refup` is the first number of the _signature_ of the bot your focus eye sees:
it counts how many times the address of [[.up]] appears in its DNA right before
a write word ([[op:store]], [[op:inc]], [[op:addstore]]…). A bot
with `5 .up store` and `0 .up store` gives 2.

Note that it counts what is _written_, not what runs: a gene whose
conditions are never met counts anyway. And since `.up` is just the number 1,
`5 1 store` also counts. The number isn't recalculated every cycle: the engine
derives it when the other bot's DNA changes (on load, at birth, on mutating or through a
virus), just like your [[sysvars/my|own numbers]].

On its own it says little; its appeal is in comparing it with your own number, [[.myup]],
just like the other signature numbers ([[.refdn]], [[.refsx]], [[.refdx]],
[[.refaimdx]], [[.refaimsx]], [[.refshoot]], [[.refeye]], [[.reftie]]). If
several match, it is most likely of your species. A corpse has
its signature at 0.

```adn
' I don't shoot at what moves like me
cond
*.eye5 0 >
*.refup *.myup !=
start
-1 .shoot store
stop
```
