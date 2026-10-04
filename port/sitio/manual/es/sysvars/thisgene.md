---
titulo: .thisgene
resumen: "El número del gen que se está ejecutando en este momento; cambia en cada cond, start, else o stop."
etiquetas: [genes, ADN, sentido]
estado: revisada
---
<!-- sysvars.yaml .thisgene (mem 341 = currgene en cada token de flujo); 20-VM §5.6 -->
Mientras corre el ADN, el motor actualiza `.thisgene` cada vez que pasa por un
marcador de gen (`cond`, `start`, `else`, `stop`), aunque el gen no se ejecute.
Leída dentro de un gen, da el número de ese gen; leída al final del ciclo, da el del
último. La numeración está en [[adn/genes#la-numeracion-de-los-genes]].

Sirve para que un gen se refiera a sí mismo sin saber su número de antemano, que
puede cambiar si una mutación o un virus agrega o quita genes antes que él. El caso
típico es el gen que se borra después de correr una vez:

```adn
cond
start
 *.thisgene 50 store
stop
cond
 *.robage 0 =
start
 *.thisgene .delgene store
stop
```

<!-- comprobado: la celda 50 queda en 1 y .genes baja de 2 a 1 -->
En el primer ciclo, la celda 50 queda en 1 y el segundo gen, que es el 2, se borra a
sí mismo con [[.delgene]]. También se usa con [[.mkvirus]], para que un gen se
copie a sí mismo en un virus.

Escribir en `.thisgene` no tiene efecto: el motor la pisa en el próximo marcador.
