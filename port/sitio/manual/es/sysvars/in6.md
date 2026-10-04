---
titulo: .in6
resumen: "Canal de entrada por la vista número 6: el valor que publica en su .out6 el bot que tenés en el ojo con foco."
etiquetas: [comunicacion, in, out, vision]
estado: revisada
---
Funciona igual que [[.in1]]: trae lo que tiene escrito en su [[.out6]] el bot
que estás mirando con el ojo con foco (o el que te chocó). Llega con un ciclo de
atraso y el motor la borra después de cada ejecución de tu ADN, así que vale 0
cuando no ves ningún bot y también cuando el otro no usa ese canal.
<!-- sysvars.yaml .in6 (= out6 del visto; borra: EraseLookOccurr); 21-MEMORIA §3 (régimen A); 32-VISION §4 -->

Lo que significa cada canal lo decide quien escribe el bot: el motor solo copia el
número. Por eso conviene confirmar antes con `.in1` que el otro es de tu
especie. Si tu especie publica en `.out6` el tipo del disparo que le acaba de pegar (0 si no le pegó ninguno), lo leés así:

```adn
' si el de enfrente es de los míos y avisa que le pegaron, lo anoto en la 56
cond
*.in1 *.out1 =
*.in6 0 !=
start
*.in6 56 store
stop
```

Ver [[sysvars/entradas-salidas]].
