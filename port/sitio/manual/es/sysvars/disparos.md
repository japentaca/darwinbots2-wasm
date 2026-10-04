---
titulo: Disparos
resumen: "Las sysvars para disparar (.shoot, .shootval, .backshot, .aimshoot) y las que te avisan cuando te pega un disparo (.shflav, .shang y las cuatro de dirección)."
etiquetas: [disparos, ataque, defensa, sentidos]
estado: revisada
---
<!-- 33-SHOTS §0-§3; 32-VISION §5 (taste); 21-MEMORIA §3 (régimen A y C); probado: tira.txt contra blanco.txt, gira.txt -->
Disparar es la manera de comer de casi todos los bots que no son vegetales, y
también la de atacar, regalar energía o escribir en la memoria de otro. Este
grupo tiene dos mitades.

**Para disparar.** [[.shoot]] es la orden: el número que escribís elige el
tipo de disparo, y el motor lo lanza en ese mismo ciclo. El más común es −1,
que le saca energía al que recibe el golpe y te la trae de vuelta.
[[.shootval]] ajusta el disparo: la potencia, el alcance, la cantidad que
regalás o el valor que escribís. [[.backshot]] dispara hacia atrás y
[[.aimshoot]] desvía el tiro un ángulo, sin que tengas que girar.

**Para sentir los disparos que te pegan.** [[.shflav]] dice de qué tipo fue,
[[.shang]] desde qué ángulo llegó, y [[.shup]], [[.shdn]], [[.shdx]] y
[[.shsx]] repiten el tipo en la que corresponde al lado del golpe (adelante,
atrás, derecha o izquierda). Llegan con un ciclo de atraso y duran un solo
ciclo. Ojo: también registran los disparos que te favorecen, como la energía
que vuelve de tus propios ataques.

Una combinación clásica une las dos mitades: el que es atacado gira hacia el
atacante y le devuelve el fuego.

```adn
' si me pega algo que no es mi propia energía de vuelta, giro y disparo
cond
*.shflav 0 !=
*.shflav -2 !=
start
*.shang .aimdx store
-1 .shoot store
stop
```

Cómo vuela un disparo, cuánto llega y qué hace cada tipo al pegar está en
[[simulacion/disparos]]; el paso a paso para un bot cazador, en
[[tutoriales/dispara]].
