---
titulo: .treffixed
resumen: "It is 1 if the tied bot is fixed in place, 0 if it can move."
etiquetas: [tref, ties, fixed]
estado: revisada
---
<!-- sysvars.yaml .treffixed (1/0 según Fixed del atado), .fixpos; 30-FISICA (un bot Fixed no recibe fuerzas, vel = 0) -->
It is 1 if the tied bot is anchored (because it wrote to [[.fixpos]])
and 0 if not. It is the other bot's [[.fixed]], read through the tie; the
sight version is [[.reffixed]].

It's useful in organisms where one cell acts as an anchor and the others move: if you know
the other end is fixed, pulling on it won't move it.

```adn
' If the tied bot is fixed, I anchor myself too
cond
*.numties 0 >
*.treffixed 1 =
start
1 .fixpos store
stop
```
