---
titulo: .bodloss
resumen: "Cuánto cuerpo perdió el bot en el último ciclo; negativo si ganó."
etiquetas: [cuerpo, sentido, pérdida]
estado: revisada
---
<!-- sysvars.yaml .bodloss (WriteSenses P5 = obody − body) -->
`.bodloss` es el cuerpo ([[.body]]) que el bot tenía al final del ciclo anterior
menos el que tiene al final de este: positivo si perdió. Es [[.bodgain]] con el
signo cambiado, y funciona como [[.pain]] pero para el cuerpo: el motor la publica
al final de cada ciclo y tu ADN lee lo que pasó en el ciclo anterior.

El cuerpo baja cuando el bot lo convierte en energía con [[.fdbody]] (cada 1 de
cuerpo da 10 de energía) o cuando otro se lo saca a disparos. Un `.bodloss`
positivo que el bot no pidió es una señal de ataque, más específica que
[[.pain]], que también sube por gastos propios.

Ojo con la reproducción: la energía que el bot le pasa a un hijo no cuenta en
[[.pain]], pero el cuerpo sí. Un bot de cuerpo 1000 que se divide a la mitad lee,
un ciclo después del parto, `.bodloss` 500.

<!-- probado: 50 .repro store con body 1000 da bodloss 500 y pain 0 -->
Para un bot que no usa `.fdbody` ni se reproduce, cualquier pérdida de cuerpo
viene de afuera:

```adn
' si pierde cuerpo, escapa
cond
*.bodloss 0 >
start
40 .up store
stop
```
