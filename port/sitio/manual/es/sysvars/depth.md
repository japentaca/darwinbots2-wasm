---
titulo: .depth
resumen: "La posición vertical del bot: 0 en el borde de arriba y crece hacia abajo, como una profundidad."
etiquetas: [posición, sentido, coordenadas, estanque]
estado: revisada
---
<!-- sysvars.yaml .depth (WriteSenses P5, doble Mod 32000, yDivisor) -->
`.depth` (también se escribe `.ypos`) es la coordenada vertical del centro del bot,
medida desde el borde de arriba del mundo y creciendo hacia abajo. Por eso se
llama profundidad: en los mundos que imitan un estanque, cuanto más grande el
número, más hondo está el bot. Su pareja es [[.xpos]]. El motor la publica al final
de cada ciclo y en el primer ciclo de vida vale 0.

Como [[.xpos]], al pasar de 32000 vuelve a empezar desde 0, y la configuración
puede dividirla por un factor.

<!-- 50-MUNDO (luz LightIntensity/depth^Gradient en pondmode) -->
En un estanque la luz llega más débil a medida que se baja, y los cloroplastos
rinden menos (ver [[simulacion/cloroplastos]]). Un bot puede usar `.depth` para no
hundirse; este sube cuando pasa de 1000:

```adn
cond
*.depth 1000 >
start
314 .setaim store
20 .up store
stop
```

El 314 apunta hacia arriba de la pantalla (ver [[.aim]]). Como el empuje se suma a
la velocidad, el bot no se detiene al llegar a 1000: si la simulación no tiene
rozamiento, sigue subiendo hasta el borde. Para quedarse en una franja hay que
frenar, como se muestra en [[.velup]].
