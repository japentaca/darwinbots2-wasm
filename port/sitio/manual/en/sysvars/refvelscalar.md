---
titulo: .refvelscalar
resumen: "How fast what you are looking at is moving relative to you, regardless of direction."
etiquetas: [vision, refvars, velocity]
estado: revisada
---
<!-- sysvars.yaml 695 (Sqr(refvelup²+refveldx²), tope 32000); core senses.hpp lookoccurr; probado: firma.txt (4 y 1 dan 4; 3 y 4 dan 5) -->
`.refvelscalar` is the magnitude of the relative velocity of what your focus eye
sees: the square root of [[.refvel]] squared plus [[.refveldx]] squared,
rounded. With `.refvel` at 3 and `.refveldx` at 4 it gives 5. It is never negative.

It is useful when you don't care which way the other is moving, only whether it moves.
Since it is relative, if you and the other are going side by side it is 0 even though both are
running. It is the way to tell whether you have already caught up with it in a chase, or
to tell an easy target from one that is going to be hard to hit.

```adn
' target still relative to me: I shoot
cond
*.eye5 0 >
*.refvelscalar 5 <
*.refeye *.myeye !=
start
-1 .shoot store
stop
```

If you see nothing, it is 0.
