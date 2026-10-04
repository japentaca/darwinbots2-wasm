---
titulo: .myvenom
resumen: "Cuántas veces el ADN del propio bot escribe en .strvenom, la orden de fabricar veneno de ataque; a diferencia de las otras my*, no tiene pareja ref*."
etiquetas: [especie, firma, veneno]
estado: revisada
---
Un contador sacado del propio ADN: cuántas escrituras en [[.strvenom]] hay en
el genoma, es decir, cuántas veces aparece su dirección (824) seguida
inmediatamente de una palabra de escritura, como en `100 .strvenom store` o
`.strvenom inc`. Igual que con
[[.myup]], cuenta lo que está escrito, se ejecute o no.
<!-- sysvars.yaml .myvenom (stores a 824); makeoccurrlist -->

:::cuidado
No la compares con [[.refvenom]]. `.refvenom` no es la misma cuenta del otro
bot: es cuánto veneno de ataque tiene guardado. `.myvenom` no tiene pareja
entre las celdas de [[sysvars/ref|lo que se ve]], así que no sirve para
reconocer especies mirando a otro.
:::
<!-- sysvars.yaml .refvenom: mem(825) del visto -->

Sí le sirve al propio bot para saber si su genoma fabrica veneno de ataque:

```adn
' si mi ADN fabrica veneno y no tengo, fabricar un poco
cond
*.myvenom 0 >
*.venom 0 =
start
50 .strvenom store
stop
```

En este ejemplo el gen mismo ya hace que `.myvenom` valga al menos 1.

El motor la calcula cuando el ADN cambia (al cargar, al nacer, por un virus o
una mutación; ver [[sysvars/my#cuando]]), no en cada ciclo. Para el veneno que el bot tiene guardado, mirá
[[.venom]]. Más sobre estos contadores en [[sysvars/my]].
