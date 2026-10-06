---
titulo: .refvel
resumen: "How fast what you are looking at moves away (positive) or comes closer (negative), in the direction you are looking and relative to yours."
etiquetas: [vision, refvars, velocity, pursuit]
estado: revisada
---
<!-- sysvars.yaml 699 (alias refvelup); core senses.hpp lookoccurr (vel del visto proyectada sobre mi aim, menos mi velup); probado: mira.txt contra firma.txt, sigue.txt contra huye.txt; revisor: sigue.txt contra huye.txt en 4000x3000, lo ve del ciclo 7 al 60 salvo el 44 -->
`.refvel`, also called `.refvelup`, is the velocity of the bot your focus eye
sees measured along your line of sight, and relative to yours:
the engine subtracts your own [[.velup]] from it. Positive means it is moving away
from you straight ahead; negative, that it is coming closer.

Its exact opposite is [[.refveldn]], the sideways component is
[[.refveldx]] and the total is [[.refvelscalar]].

It uses the same convention as [[.up]], and that is why the classic trick is to copy it
there: if the other moves away, you push so as not to fall behind. _Animal Minimalis_
adds a little to it so as to also close in:

```adn
cond
*.eye5 0 >
*.refeye *.myeye !=
start
*.refveldx .dx store
*.refvel 30 add .up store
stop
```

With this gene, plus one that turns when it sees nothing, the bot chased a
fleeing target and kept it in [[.eye5]] almost without losing it for about 50
cycles.

If you see nothing, it is 0. Against a shape, it measures the shape's velocity.
