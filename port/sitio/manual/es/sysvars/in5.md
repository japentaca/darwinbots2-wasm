---
titulo: .in5
resumen: "Canal de entrada por la vista número 5: el valor que publica en su .out5 el bot que tenés en el ojo con foco."
etiquetas: [comunicacion, in, out, vision]
estado: revisada
---
Funciona igual que [[.in1]]: trae lo que tiene escrito en su [[.out5]] el bot
que estás mirando con el ojo con foco (o el que te chocó). Llega con un ciclo de
atraso y el motor la borra después de cada ejecución de tu ADN, así que vale 0
cuando no ves ningún bot y también cuando el otro no usa ese canal.
<!-- sysvars.yaml .in5 (= out5 del visto; borra: EraseLookOccurr); 21-MEMORIA §3 (régimen A); 32-VISION §4 -->

Lo que significa cada canal lo decide quien escribe el bot: el motor solo copia el
número. Por eso conviene confirmar antes con `.in1` que el otro es de tu
especie. Si tu especie publica en `.out5` el código de especie de lo que él tiene enfrente, lo leés así:

```adn
' si un compañero tiene enfrente a alguien que no es de los nuestros, lo cuento en la 55
cond
*.in1 *.out1 =
*.in5 0 !=
*.in5 *.out1 !=
start
55 inc
stop
```

Ver [[sysvars/entradas-salidas]].
