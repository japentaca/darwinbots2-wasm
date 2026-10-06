---
titulo: .mypoison
resumen: "Cuántas veces el ADN del propio bot escribe en .strpoison, la orden de fabricar toxina (poison); a diferencia de las otras my*, no tiene pareja ref*."
etiquetas: [especie, firma, toxina]
estado: revisada
---
Un contador sacado del propio ADN: cuántas escrituras en [[.strpoison]] hay en
el genoma, es decir, cuántas veces aparece su dirección (826) seguida
inmediatamente de una palabra de escritura, como en `100 .strpoison store` o
`.strpoison inc`. Igual que con
[[.myup]], cuenta lo que está escrito, se ejecute o no.
<!-- sysvars.yaml .mypoison (stores a 826); makeoccurrlist -->

:::cuidado
No la compares con [[.refpoison]]. Aunque los nombres se parezcan, `.refpoison`
no es la misma cuenta del otro bot: es cuánta toxina tiene guardada en ese
momento. `.mypoison` no tiene pareja entre las celdas de
[[sysvars/ref|lo que se ve]], así que no sirve para reconocer especies mirando a
otro.
:::
<!-- sysvars.yaml .refpoison: mem(827) del visto -->

Sí le sirve al propio bot para saber si su genoma fabrica toxina, por ejemplo
en un gen escrito para ser compartido entre variantes:

```adn
' si mi ADN no fabrica toxina, escapar de lo que viene de frente
cond
*.mypoison 0 =
*.eye5 1000 >
start
30 .dn store
stop
```

El motor la calcula cuando el ADN cambia (al cargar, al nacer, por un virus o
una mutación; ver [[sysvars/my#cuando]]), no en cada ciclo. Para la toxina que el bot tiene guardada, mirá
[[.poison]]. Más sobre estos contadores en [[sysvars/my]].
