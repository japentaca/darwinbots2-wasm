---
titulo: .reftie
resumen: "How many times .tie appears in the DNA of the bot you are looking at: if it is greater than 0, it knows how to tie to other bots."
etiquetas: [vision, refvars, signature, ties]
estado: revisada
---
<!-- sysvars.yaml 712; core senses.hpp makeoccurrlist (occurr 9: el número 330 en cualquier lugar); probado: firma.txt (.tie y 330 dan 2) -->
It counts how many times the number 330, which is the address of [[.tie]],
appears in the DNA of the bot being seen. Unlike [[.refup]] and its neighbors, it doesn't need
to be followed by a write: any appearance counts, both `.tie`
and a loose `330`.

A value greater than 0 says the other has the means to tie itself to you; it is the sign
of the parasites and the multibots that stick to their prey (see
[[simulacion/lazos]]). Your own number is [[.myties]]. Like the rest of the
signature, it isn't recalculated every cycle and it is 0 if you see nothing.

```adn
' I move away from what knows how to tie
cond
*.eye5 0 >
*.reftie 0 >
*.myties 0 =
start
628 .aimdx store
stop
```
