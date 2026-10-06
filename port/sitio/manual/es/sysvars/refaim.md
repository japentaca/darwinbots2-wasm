---
titulo: .refaim
resumen: "Hacia dónde apunta el bot que estás viendo, en la misma escala que .aim: para saber si te está mirando."
etiquetas: [visión, refvars, ángulos]
estado: revisada
---
<!-- sysvars.yaml 711 (mem 18 del visto); core senses.hpp lookoccurr; probado: mirada.txt contra mira.txt (70 pasa a 1 cuando se miran); sysvars.yaml 18 (rango 0..~2513 con momento angular); opcodes.yaml anglecmp (Mod 1256 y diferencia con signo ±628); revisor: mirada.txt contra mirada.txt (aims 1176 y 568, 70=1) -->
`.refaim` es la dirección en la que apunta el bot que ve tu ojo con foco: lo
que ese bot lee en su [[.aim]]. Una vuelta completa son 1256; casi siempre está
entre 0 y 1255, aunque mientras gira puede pasarse un poco.

Lo más útil es compararla con tu propio rumbo. Si el otro te está mirando, su
rumbo es el tuyo dado vuelta, o sea el tuyo más 628. El operador
[[op:anglecmp]] da la diferencia entre dos ángulos teniendo en cuenta la
vuelta completa:

```adn
' ¿me está mirando? entonces me corro de costado
cond
*.eye5 0 >
*.refaim *.aim 628 add anglecmp abs 60 <
start
50 .sx store
stop
```

Con dos bots que giraban hasta verse, la condición se cumplió justo cuando
quedaron frente a frente. Un bot que te mira probablemente esté por
dispararte, sobre todo si su [[.refshoot]] es mayor que 0.

Si no ves nada, o ves una forma, vale 0.
