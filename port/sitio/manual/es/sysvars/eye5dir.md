---
titulo: .eye5dir
resumen: "Gira el ojo 5 respecto de su lugar de fábrica (justo adelante): positivo hacia la izquierda, negativo hacia la derecha; 1256 es una vuelta."
etiquetas: [ojos, visión, configuración]
estado: revisada
---
Corre la dirección de [[.eye5]], que de fábrica mira justo adelante de [[.aim]].
Se mide en las mismas unidades que `.aim`: una vuelta entera son 1256, media
vuelta 628 y 10 grados unas 35. Los valores positivos llevan el ojo hacia la
izquierda y los negativos hacia la derecha. El ojo sigue atado al bot: si el bot
gira, el ojo gira con él.
<!-- 32-VISION §0.2; sysvars.yaml .eye5dir -->

Es configuración: el motor la lee en cada ciclo pero nunca la borra, así que
alcanza con escribirla una vez. Solo cuenta el resto de dividir por 1256, con
su signo: 1256 equivale a 0 y 1300 a 44. El cambio se nota en lo que el ojo ve
a partir del ciclo siguiente.
<!-- sysvars.yaml .eye5dir (persiste); 32-VISION §0.1 -->

Este bot da vuelta el ojo frontal para que mire hacia atrás (628 es media vuelta). Como [[.eye5]] es también el ojo con foco de fábrica, las celdas de [[sysvars/ref|lo que se ve]] pasan a describir lo que el bot tiene detrás:

```adn
cond
*.robage 0 =
start
628 .eye5dir store
stop
```

Para cambiar cuánto abarca el ojo, usá [[.eye5width]]. El resto de los ojos y
cómo se reparten está en [[sysvars/ojos]].
