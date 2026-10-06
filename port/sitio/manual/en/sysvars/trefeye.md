---
titulo: .trefeye
resumen: "How many times the tied bot's DNA reads one of its eyes: the signature count most used to recognize members of your species."
etiquetas: [tref, ties, signature, species, eyes]
estado: revisada
---
<!-- sysvars.yaml .trefeye (occurr(8) del atado); core senses.hpp makeoccurrlist (lecturas *501..*509; .eyef es 510 y no cuenta) -->
Counts how many eye reads the tied bot's DNA has: each `*.eye1`…`*.eye9`
adds 1 (`*.eyef` doesn't count). It is the other bot's [[.myeye]], read from your side of the
tie. Like the rest of the signature ([[.trefup]], [[.trefshoot]]…), it comes from the text of the
DNA and not from what runs, so it only changes if the other bot mutates.

<!-- conteo en port/web/bots: .trefeye en 103 bots; formas más comunes «*.trefeye 0 =», «*.trefeye *.myeye %=», «=» y «!=» -->
It is the most used tie sysvar in the Bestiary, almost always compared with your own:
`*.trefeye *.myeye =` (or with [[op:%=]], which allows a 10% difference): if the
tied bot has the same number of eye reads as you do, it is most likely of your species.
`*.trefeye 0 =` also shows up a lot; it is also true when no tie is being read,
because then all the [[sysvars/tref|tref*]] are 0.

```adn
' If the tied bot isn't of my species, I break the tie
cond
*.numties 0 >
*.trefeye *.myeye !=
start
*.tiepres .deltie store
stop
```

The same trick with the bot you see is [[.refeye]]. Other ways of recognizing your own kind
are in [[tutoriales/reconoce-especie]].
