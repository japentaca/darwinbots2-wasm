---
titulo: .bodgain
resumen: "Cuánto cuerpo ganó el bot en el último ciclo; negativo si perdió."
etiquetas: [cuerpo, sentido, ganancia]
estado: revisada
---
<!-- sysvars.yaml .bodgain (WriteSenses P5 = body − obody) -->
`.bodgain` es el cuerpo ([[.body]]) que el bot tiene al final de este ciclo menos el
que tenía al final del anterior. [[.bodloss]] es el mismo número con el signo
cambiado. Funciona como [[.pleas]], pero para el cuerpo: el motor la publica al
final de cada ciclo y tu ADN lee lo que pasó en el ciclo anterior.

<!-- 31-ENERGIA §3; 33-SHOTS (takenrg: 4% a body); probado: 100 .strbody da bodgain 10 y pain 100 -->
El cuerpo crece sobre todo cuando el bot convierte energía con [[.strbody]] (cada
10 de energía dan 1 de cuerpo), y también un poco al comer. Baja cuando lo
convierte de vuelta en energía con [[.fdbody]] o cuando lo atacan.

Un bot puesto al empezar la simulación lee en su segundo ciclo todo su cuerpo como
ganancia, igual que con la energía. Con el cuerpo pasa lo mismo a un hijo recién
nacido (su energía, en cambio, arranca sin salto), y el padre lee ese cuerpo
cedido como pérdida en [[.bodloss]].

```adn
' guarda en la celda 50 el último aumento de cuerpo
cond
*.bodgain 0 >
start
*.bodgain 50 store
stop
```

Con `100 .strbody store` el bot gasta 100 de energía y, en el ciclo siguiente,
lee `.bodgain` 10 y [[.pain]] 100.
