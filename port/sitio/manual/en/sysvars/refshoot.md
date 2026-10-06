---
titulo: .refshoot
resumen: "How many times the DNA of the bot you are looking at writes to .shoot: if it is greater than 0, it knows how to shoot."
etiquetas: [vision, refvars, signature, shots]
estado: revisada
---
<!-- sysvars.yaml 707; core senses.hpp makeoccurrlist; probado: firma2.txt (dos 0 .shoot store dan 2); makeoccurrlist solo cuenta un número literal 1..7 seguido de un store (tipo 7), así que una dirección calculada no suma -->
It counts how many times the address of [[.shoot]] (7) appears in the DNA of the
bot being seen right before a write word. Besides being a number in the signature,
like [[.refup]], it has a direct reading: a bot with
`.refshoot` at 0 has no shoot command written in the
usual way, so it is unlikely to attack you with shots (it could shoot with
a computed address, which the signature doesn't count). Vegetables are usually
at 0.

Careful: it counts what is written, not what runs. A bot with a `-1 .shoot store`
in a gene that is never activated counts too. Your own number is [[.myshoot]].

```adn
' if the other can shoot and isn't one of mine, I turn around
cond
*.eye5 0 >
*.refshoot 0 >
*.refeye *.myeye !=
start
628 .aimdx store
stop
```
