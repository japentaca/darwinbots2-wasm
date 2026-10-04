---
titulo: .xpos
resumen: "La posición horizontal del bot en el mundo: 0 en el borde izquierdo y crece hacia la derecha."
etiquetas: [posición, sentido, coordenadas]
estado: revisada
---
<!-- sysvars.yaml .xpos (WriteSenses P5, doble Mod 32000, xDivisor) -->
`.xpos` es la coordenada horizontal del centro del bot, medida desde el borde
izquierdo del mundo, en las mismas unidades que el tamaño del campo. Su pareja es
[[.depth]], la vertical. El motor la publica al final de cada ciclo; en el primer
ciclo de vida vale 0.

Una celda de memoria guarda como mucho 32000, así que en un mundo más ancho que eso
el valor vuelve a empezar desde 0. La simulación también puede configurarse para
dividir las coordenadas por un factor antes de publicarlas.

Sirve para quedarse en una zona del mapa, para que un multibot sepa dónde está cada
célula o, junto con [[.refxpos]], para saber si lo que ve está a la izquierda o a
la derecha. Este bot vuelve hacia la mitad izquierda de un mundo de 4000 de ancho
cuando se pasa:

```adn
cond
*.xpos 2000 >
start
628 .setaim store
20 .up store
stop
```

El 628 apunta hacia la izquierda de la pantalla (ver [[.aim]]). Ojo con la inercia:
cuando vuelve a estar por debajo de 2000 deja de empujar, pero sin rozamiento sigue
deslizándose hasta la pared de enfrente. Para quedarse en la zona hay que frenar,
como se muestra en [[.velup]].
