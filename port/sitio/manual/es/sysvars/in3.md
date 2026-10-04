---
titulo: .in3
resumen: "Canal de entrada por la vista número 3: el valor que publica en su .out3 el bot que tenés en el ojo con foco."
etiquetas: [comunicacion, in, out, vision]
estado: revisada
---
Funciona igual que [[.in1]]: trae lo que tiene escrito en su [[.out3]] el bot
que estás mirando con el ojo con foco (o el que te chocó). Llega con un ciclo de
atraso y el motor la borra después de cada ejecución de tu ADN, así que vale 0
cuando no ves ningún bot y también cuando el otro no usa ese canal.
<!-- sysvars.yaml .in3 (= out3 del visto; borra: EraseLookOccurr); 21-MEMORIA §3 (régimen A); 32-VISION §4 -->

Lo que significa cada canal lo decide quien escribe el bot: el motor solo copia el
número. Por eso conviene confirmar antes con `.in1` que el otro es de tu
especie. Si tu especie publica en `.out3` lo que ve adelante, lo leés así:

```adn
' guardo en la 53 lo que ve el compañero que tengo enfrente
cond
*.in1 *.out1 =
start
*.in3 53 store
stop
```

Ver [[sysvars/entradas-salidas]].
