---
titulo: .refveldn
resumen: "La velocidad con que se te acerca lo que estás viendo: es .refvel con el signo cambiado."
etiquetas: [visión, refvars, velocidad]
estado: revisada
---
<!-- sysvars.yaml 698 (= -mem(699)); core senses.hpp lookoccurr; probado: firma.txt (refvel 4, refveldn -4) -->
`.refveldn` es exactamente [[.refvel]] con el signo cambiado: positiva cuando
lo que ves se te acerca, negativa cuando se aleja. No trae información nueva;
existe para que puedas escribir las condiciones en el sentido que te resulte
más natural, igual que [[.dn]] es el opuesto de [[.up]].

```adn
' algo se me viene encima rápido: lo esquivo
cond
*.eye5 0 >
*.refveldn 20 >
start
50 .dx store
stop
```

Si no ves nada, vale 0.
