---
titulo: .refeye
resumen: "How many times the DNA of the bot you are looking at reads its eyes: the signature number most used to recognize your own species."
etiquetas: [vision, refvars, signature, recognition]
estado: revisada
---
<!-- sysvars.yaml 708; core senses.hpp makeoccurrlist (lecturas *501..*509); probado: firma.txt (refeye 3), firma2.txt (*.eyef no cuenta); Bestiario: 302 de 684 bots comparan *.refeye *.myeye; Animal_Minimalis_4G_Numsgil_-10.03.05.txt -->
Unlike the other signature numbers, `.refeye` doesn't count writes
but reads: how many times a read of its eyes appears in the DNA of the bot being seen,
from `*.eye1` to `*.eye9`. A bot with `*.eye5` twice and `*.eye1` once
gives 3. The read of [[.eyef]] doesn't count.

It is the most popular number for recognizing your own species, because almost every
bot that hunts looks at its eyes several times and the number changes quite a bit from one
species to another. It is compared with yours, [[.myeye]]. The trick comes from
_Animal Minimalis_, by Numsgil, and hundreds of Bestiary bots use it:

```adn
cond
*.eye5 0 >
*.refeye *.myeye !=
start
-1 .shoot store
stop
```

Like the whole signature (see [[.refup]]), it isn't recalculated every cycle, it counts what is
written even if it doesn't run, and it is 0 if you see nothing or if you see a corpse. If
two different species coincide by chance, this bot can't tell them apart:
to refine it, add another number, such as [[.refshoot]] or [[.refup]]. The step-by-step
is in [[tutoriales/reconoce-especie]].
