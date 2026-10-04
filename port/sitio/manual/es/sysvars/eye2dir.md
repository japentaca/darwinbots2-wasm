---
titulo: .eye2dir
resumen: "Gira el ojo 2 respecto de su lugar de fábrica (30 grados a la izquierda): positivo hacia la izquierda, negativo hacia la derecha; 1256 es una vuelta."
etiquetas: [ojos, visión, configuración]
estado: revisada
---
Corre la dirección de [[.eye2]], que de fábrica mira 30 grados a la izquierda de [[.aim]].
Se mide en las mismas unidades que `.aim`: una vuelta entera son 1256, media
vuelta 628 y 10 grados unas 35. Los valores positivos llevan el ojo hacia la
izquierda y los negativos hacia la derecha. El ojo sigue atado al bot: si el bot
gira, el ojo gira con él.
<!-- 32-VISION §0.2; sysvars.yaml .eye2dir -->

Es configuración: el motor la lee en cada ciclo pero nunca la borra, así que
alcanza con escribirla una vez. Solo cuenta el resto de dividir por 1256, con
su signo: 1256 equivale a 0 y 1300 a 44. El cambio se nota en lo que el ojo ve
a partir del ciclo siguiente.
<!-- sysvars.yaml .eye2dir (persiste); 32-VISION §0.1 -->

El bot _All Eyes_ de Spike43884 (en el Bestiario) abre los nueve ojos en abanico para ver casi todo alrededor; a este ojo le pone 300, así que pasa a mirar unos 116 grados a la izquierda:

```adn
cond
*.robage 0 =
start
300 .eye2dir store
stop
```

Para cambiar cuánto abarca el ojo, usá [[.eye2width]]. El resto de los ojos y
cómo se reparten está en [[sysvars/ojos]].
