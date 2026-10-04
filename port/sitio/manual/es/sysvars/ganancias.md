---
titulo: Ganancias y pérdidas
resumen: "Cuánta energía y cuánto cuerpo ganó o perdió el bot en el último ciclo: el dolor, el placer y sus equivalentes del cuerpo."
etiquetas: [energía, cuerpo, dolor, placer]
estado: revisada
---
<!-- sysvars.yaml .pain .pleas .bodloss .bodgain (WriteSenses P5); 10-CICLO §5 -->
Estas cuatro sysvars miden el cambio de un ciclo al siguiente. [[.pain]] es cuánta
energía perdió el bot y [[.pleas]] cuánta ganó; [[.bodloss]] y [[.bodgain]] hacen
lo mismo con el cuerpo ([[.body]]). En realidad son dos números, cada uno con los
dos signos: `.pleas` es siempre `.pain` con el signo cambiado, y `.bodgain` es
`.bodloss` cambiado de signo. Si el bot perdió 100 de energía, `.pain` vale 100 y
`.pleas` −100.

El motor las calcula al final de cada ciclo comparando con el final del ciclo
anterior, así que miden el cambio _neto_ de todo lo que pasó en el medio: lo que
gastó el ADN, moverse, disparar, lo que comió, lo que le robaron, lo que convirtió
entre energía y cuerpo. No dicen la causa; para eso hay que cruzarlas con otros
sentidos, como el disparo recibido en [[.shflav]] o el choque en [[.hit]].

El uso más frecuente es reaccionar a un ataque: un salto brusco de `.pain` casi
siempre es que le están sacando energía. Este bot huye hacia adelante si en el
último ciclo perdió más de 50:

```adn
cond
*.pain 50 >
start
40 .up store
stop
```

El parto es la excepción: la energía que el bot le pasa a un hijo no cuenta como
pérdida, pero el cuerpo que le cede sí aparece en `.bodloss`.

`.pleas` sirve para lo contrario, por ejemplo para quedarse quieto mientras está
comiendo. El balance de energía completo está en [[simulacion/energia]].
