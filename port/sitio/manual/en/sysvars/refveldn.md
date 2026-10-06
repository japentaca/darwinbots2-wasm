---
titulo: .refveldn
resumen: "The speed at which what you are looking at comes toward you: it is .refvel with the sign flipped."
etiquetas: [vision, refvars, velocity]
estado: revisada
---
<!-- sysvars.yaml 698 (= -mem(699)); core senses.hpp lookoccurr; probado: firma.txt (refvel 4, refveldn -4) -->
`.refveldn` is exactly [[.refvel]] with the sign flipped: positive when
what you see is coming toward you, negative when it is moving away. It brings no new information;
it exists so that you can write conditions in the sense that feels
more natural to you, just as [[.dn]] is the opposite of [[.up]].

```adn
' something is coming at me fast: I dodge it
cond
*.eye5 0 >
*.refveldn 20 >
start
50 .dx store
stop
```

If you see nothing, it is 0.
