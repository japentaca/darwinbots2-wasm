---
titulo: .in4
resumen: "Canal de entrada por la vista número 4: el valor que publica en su .out4 el bot que tenés en el ojo con foco."
etiquetas: [comunicacion, in, out, vision]
estado: revisada
---
Funciona igual que [[.in1]]: trae lo que tiene escrito en su [[.out4]] el bot
que estás mirando con el ojo con foco (o el que te chocó). Llega con un ciclo de
atraso y el motor la borra después de cada ejecución de tu ADN, así que vale 0
cuando no ves ningún bot y también cuando el otro no usa ese canal.
<!-- sysvars.yaml .in4 (= out4 del visto; borra: EraseLookOccurr); 21-MEMORIA §3 (régimen A); 32-VISION §4 -->

Lo que significa cada canal lo decide quien escribe el bot: el motor solo copia el
número. Por eso conviene confirmar antes con `.in1` que el otro es de tu
especie. Si tu especie publica en `.out4` cuánta energía perdió en el último ciclo, lo leés así:

```adn
' si el de enfrente es de los míos y está perdiendo energía, guardo cuánto en la 54
cond
*.in1 *.out1 =
*.in4 0 >
start
*.in4 54 store
stop
```

Ver [[sysvars/entradas-salidas]].
