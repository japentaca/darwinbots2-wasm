---
titulo: .pain
resumen: "Cuánta energía perdió el bot en el último ciclo; negativa si ganó."
etiquetas: [energía, dolor, sentido]
estado: revisada
---
<!-- sysvars.yaml .pain (WriteSenses P5, onrg y nrg acotados a 0..32000); 10-CICLO §5 -->
`.pain` es la energía que el bot tenía al final del ciclo anterior menos la que
tiene al final de este: positiva si perdió, negativa si ganó. Es el cambio neto,
así que suma todo: lo que cuesta su propio ADN, moverse y disparar, lo que le roban
los disparos ajenos, lo que come y lo que convierte en cuerpo. [[.pleas]] es el
mismo número con el signo cambiado.

<!-- probado: parto con pain 0; inserto lee pain −3000 en robage 1 -->
El motor la publica al final de cada ciclo; tu ADN lee lo que pasó en el ciclo
anterior. Algunas rarezas:

- Un bot puesto en la simulación al empezar (no nacido de otro) lee en su segundo
  ciclo un `.pain` negativo igual a toda su energía: para el motor, venía de 0.
- La energía que el bot le pasa a un hijo al reproducirse no cuenta como pérdida.
- Convertir energía en cuerpo con [[.strbody]] sí cuenta: `100 .strbody store`
  da un `.pain` de 100.

<!-- 10-CICLO §5 (Shock); corrección A1-1 del port: la energía pasa a cuerpo -->
:::cuidado
Si un bot (que no sea vegetal) pierde en un solo ciclo más de la mitad de su
energía y aun así le quedan más de 3000, muere de shock: su energía pasa a 0 y lo
que le quedaba se convierte en cuerpo, a razón de 10 de energía por 1 de cuerpo.
`.pain` nunca llega a avisar.
:::

Este bot gira para mirar alrededor cuando algo le saca energía:

```adn
cond
*.pain 30 >
start
314 .aimsx store
stop
```
